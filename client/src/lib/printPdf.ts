/**
 * printPdf.ts — Abre um PDF (base64) em nova aba para impressão ou
 * "Salvar como PDF". Se o popup for bloqueado, baixa o arquivo.
 *
 * No app Android (Capacitor) o WebView não abre Blob URLs, então o PDF é
 * salvo/compartilhado pelo plugin nativo via `downloadBase64`.
 */
import { base64ToBlob, downloadBase64, isNativeApp } from "@/lib/nativeDownload";

/** Remove caracteres inválidos para nomes de arquivo (Windows/Android). */
export function sanitizeFileName(fileName: string | null | undefined, fallback = "contrato.pdf"): string {
  const base = String(fileName || "")
    .replace(/[\u0000-\u001f\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
  if (!base) return fallback;
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}

export function openPdfPrint(base64: string, fileName = "contrato.pdf"): void {
  if (!base64) return;

  const safeFileName = sanitizeFileName(fileName);

  if (isNativeApp()) {
    void downloadBase64(base64, safeFileName, "application/pdf");
    return;
  }

  const url = URL.createObjectURL(base64ToBlob(base64, "application/pdf"));
  const win = window.open(url, "_blank");

  if (!win) {
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", safeFileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Abre/compartilha o link de assinatura (Web Share API com fallback de cópia). */
export async function shareSignUrl(signUrl: string, contractNumber?: string | null): Promise<"shared" | "copied"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: contractNumber ? `Contrato ${contractNumber}` : "Contrato para assinatura",
        text: "Assine o contrato pelo link abaixo:",
        url: signUrl,
      });
      return "shared";
    } catch (e: any) {
      if (e?.name === "AbortError") return "shared";
    }
  }
  await navigator.clipboard.writeText(signUrl);
  return "copied";
}
