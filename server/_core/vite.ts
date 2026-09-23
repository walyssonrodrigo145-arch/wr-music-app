import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Assets com hash no nome: cache imutável. HTML: sempre revalidar (SEO).
  app.use(express.static(distPath, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache");
      } else {
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
    },
  }));

  // HTML pré-renderizado por rota (SEO): /blog/guia → dist/public/blog/guia/index.html.
  // O conteúdo é gerado no build por scripts/prerender.ts.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const pathname = decodeURIComponent(req.path || "/");
    if (pathname.startsWith("/api/") || pathname.startsWith("/uploads")) return next();

    const safe = path.normalize(pathname).replace(/^([/\\]|\.\.[/\\])+/, "");
    const candidate = path.resolve(distPath, safe, "index.html");
    if (candidate.startsWith(distPath) && fs.existsSync(candidate)) {
      res.setHeader("Cache-Control", "no-cache");
      return res.sendFile(candidate, (err) => {
        if (err) next();
      });
    }

    // Fallback SPA
    res.setHeader("Cache-Control", "no-cache");
    return res.sendFile(path.resolve(distPath, "index.html"), (err) => {
      if (err) next();
    });
  });
}
