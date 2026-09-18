import { downloadBase64 } from "@/lib/nativeDownload";

export function downloadBase64File(base64Data: string, type: 'csv' | 'excel', filename: string) {
  const mimeType = type === 'csv'
    ? 'text/csv;charset=utf-8;'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  const extension = type === 'csv' ? '.csv' : '.xlsx';
  // Se o filename já não tiver extensão
  const finalName = filename.endsWith(extension) ? filename : `${filename}${extension}`;

  // Funciona no navegador (Blob + <a download>) e no app Android (plugin nativo)
  void downloadBase64(base64Data, finalName, mimeType);
}
