/**
 * nativeDownload.ts — Download de arquivos (PDF, CSV, XLSX, PNG) que funciona
 * tanto no navegador/PWA quanto no app Android (Capacitor WebView).
 *
 * No app nativo o WebView não baixa arquivos sozinho, então o conteúdo é
 * enviado ao plugin nativo FileSaver (salva em Downloads/MusicPro ou abre o
 * compartilhamento do Android). No navegador seguimos com Blob + <a download>.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";

interface FileSaverPlugin {
  saveBase64(options: { base64: string; fileName: string; mimeType: string }): Promise<{ uri: string; folder?: string }>;
  shareBase64(options: { base64: string; fileName: string; mimeType: string }): Promise<{ uri: string }>;
}

const FileSaver = registerPlugin<FileSaverPlugin>("FileSaver");

export type DownloadResult = "downloads" | "shared" | "browser" | "failed";

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function defaultMimeFor(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf": return "application/pdf";
    case "csv": return "text/csv;charset=utf-8;";
    case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "xls": return "application/vnd.ms-excel";
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "txt": return "text/plain;charset=utf-8;";
    default: return "application/octet-stream";
  }
}

export function fileNameFromUrl(url: string, fallback = "arquivo"): string {
  try {
    const clean = url.split("?")[0].split("#")[0];
    const last = clean.substring(clean.lastIndexOf("/") + 1);
    return last ? decodeURIComponent(last) : fallback;
  } catch {
    return fallback;
  }
}

function cleanBase64(base64: string): string {
  const value = base64.trim();
  if (value.startsWith("data:")) {
    const comma = value.indexOf(",");
    if (comma >= 0) return value.slice(comma + 1);
  }
  return value;
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const clean = cleanBase64(base64);
  const byteCharacters = atob(clean);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(cleanBase64(String(reader.result || "")));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function triggerBrowserDownload(href: string, fileName: string, isObjectUrl = false) {
  const link = document.createElement("a");
  link.setAttribute("href", href);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (isObjectUrl) setTimeout(() => URL.revokeObjectURL(href), 1500);
}

async function saveNativeBase64(base64: string, fileName: string, mimeType: string): Promise<DownloadResult> {
  try {
    await FileSaver.saveBase64({ base64, fileName, mimeType });
    return "downloads";
  } catch {
    try {
      await FileSaver.shareBase64({ base64, fileName, mimeType });
      return "shared";
    } catch {
      return "failed";
    }
  }
}

/** Salva conteúdo base64 (aceita com ou sem prefixo data:). */
export async function downloadBase64(base64: string, fileName: string, mimeType?: string): Promise<DownloadResult> {
  const mime = mimeType || defaultMimeFor(fileName);
  if (isNativeApp()) {
    const result = await saveNativeBase64(cleanBase64(base64), fileName, mime);
    if (result !== "failed") return result;
  }
  triggerBrowserDownload(URL.createObjectURL(base64ToBlob(base64, mime)), fileName, true);
  return "browser";
}

/** Salva um Blob. */
export async function downloadBlob(blob: Blob, fileName: string): Promise<DownloadResult> {
  const mime = blob.type || defaultMimeFor(fileName);
  if (isNativeApp()) {
    try {
      const base64 = await blobToBase64(blob);
      const result = await saveNativeBase64(base64, fileName, mime);
      if (result !== "failed") return result;
    } catch {
      // cai para o fluxo do navegador
    }
  }
  triggerBrowserDownload(URL.createObjectURL(blob), fileName, true);
  return "browser";
}

/** Baixa de uma URL (mesma origem com cookie ou URL pública assinada). */
export async function downloadUrl(url: string, fileName?: string): Promise<DownloadResult> {
  const name = fileName || fileNameFromUrl(url);
  if (isNativeApp()) {
    try {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      return await downloadBlob(blob, name);
    } catch {
      // tenta o caminho padrão do WebView (DownloadListener nativo cobre)
    }
  }
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", name);
  link.setAttribute("rel", "noopener");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return "browser";
}

/**
 * Interceptador para <a href download>: use no onClick.
 * Ex.: onClick={(e) => interceptNativeDownload(e, url, name)}
 */
export function interceptNativeDownload(
  event: { preventDefault: () => void },
  url: string,
  fileName?: string
): boolean {
  if (!isNativeApp()) return false;
  event.preventDefault();
  void downloadUrl(url, fileName);
  return true;
}

/** Pré-visualiza PDF: no app salva/compartilha; no navegador abre em nova aba. */
export async function previewOrDownloadBase64(base64: string, fileName: string, mimeType = "application/pdf"): Promise<DownloadResult> {
  if (isNativeApp()) return downloadBase64(base64, fileName, mimeType);
  const url = URL.createObjectURL(base64ToBlob(base64, mimeType));
  window.open(url, "_blank");
  return "browser";
}

/** Abre um arquivo por URL: no app salva/compartilha; no navegador abre em nova aba. */
export async function openOrDownloadUrl(url: string, fileName?: string): Promise<DownloadResult> {
  if (isNativeApp()) return downloadUrl(url, fileName);
  window.open(url, "_blank", "noopener");
  return "browser";
}
