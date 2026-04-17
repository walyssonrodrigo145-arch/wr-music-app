import { Express, Request, Response } from "express";
import axios from "axios";
import { ENV } from "./env";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import * as db from "../db";
import crypto from "crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export function registerGoogleAuthRoutes(app: Express) {
  // 1. Redirecionar para o Google
  app.get("/api/auth/google", (req: Request, res: Response) => {
    if (!ENV.googleClientId) {
      return res.status(500).json({ error: "Google Client ID não configurado." });
    }

    const redirectUri = `${ENV.appUrl}/api/auth/google/callback`;
    const scope = ["openid", "email", "profile"].join(" ");
    
    const params = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scope,
      access_type: "offline",
      prompt: "select_account",
    });

    res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  });

  // 2. Callback do Google
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const { code } = req.query;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Código de autorização não fornecido." });
    }

    try {
      const redirectUri = `${ENV.appUrl}/api/auth/google/callback`;

      // Trocar código por token
      const tokenResponse = await axios.post(GOOGLE_TOKEN_URL, {
        code,
        client_id: ENV.googleClientId,
        client_secret: ENV.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      });

      const { access_token } = tokenResponse.data;

      // Obter info do usuário
      const userResponse = await axios.get(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const googleUser = userResponse.data; // { sub, name, email, picture, email_verified }

      if (!googleUser.email) {
        return res.status(400).json({ error: "E-mail não retornado pelo Google." });
      }

      // Upsert do usuário no banco local
      // Usamos o 'sub' do Google como openId único
      const openId = `google_${googleUser.sub}`;
      
      await db.upsertUser({
        openId,
        name: googleUser.name,
        email: googleUser.email,
        loginMethod: "google",
        isEmailVerified: true, // Google já verificou o e-mail
        lastSignedIn: new Date(),
      });

      // Criar sessão
      const sessionToken = await sdk.createSessionToken(openId, {
        name: googleUser.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Redirecionar para home
      res.redirect("/");
    } catch (error: any) {
      // Extraímos o erro real do banco de dados se disponível (Drizzle envolve o erro original)
      const dbErr = error.driverError || error;
      const errorMessage = error.message || "Erro desconhecido";
      
      console.error("[Google Auth] Error:", errorMessage);
      if (error.driverError) {
        console.error("[Google Auth] Driver Error Detail:", {
          code: dbErr.code,
          detail: dbErr.detail,
          table: dbErr.table,
          schema: dbErr.schema,
          column: dbErr.column,
          constraint: dbErr.constraint
        });
      }

      const dbError = dbErr.code ? {
        code: dbErr.code,
        detail: dbErr.detail,
        table: dbErr.table,
        constraint: dbErr.constraint
      } : null;

      res.status(500).json({ 
        error: "Falha na autenticação com Google.",
        details: errorMessage,
        dbError
      });
    }

  });
}
