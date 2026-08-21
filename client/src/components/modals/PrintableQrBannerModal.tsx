import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import QRCode from "react-qr-code";
import QRCodeLib from "qrcode";
import { Printer, Download, Music, Shield, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface PrintableQrBannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolName: string;
  schoolLogo?: string | null;
  token: string | null;
}

export function PrintableQrBannerModal({
  open,
  onOpenChange,
  schoolName,
  schoolLogo,
  token,
}: PrintableQrBannerModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPng = async () => {
    if (!token) {
      toast.error("Token do QR Code não encontrado. Recarregue a página.");
      return;
    }
    try {
      toast.loading("Gerando imagem em alta resolução...", { id: "qr-download" });

      // ─── 1. Gerar QR Code via toDataURL e carregar como Image nativa ───
      // toDataURL gera uma imagem PNG em base64 pura (sem SVG, sem Canvas DOM issues).
      // Ao carregar a imagem em um HTMLImageElement garantimos 100% de compatibilidade com ctx.drawImage.
      const qrDataUrl = await QRCodeLib.toDataURL(token, {
        width: 600,
        margin: 2,
        color: { dark: "#000000", light: "#f8fafc" },
        errorCorrectionLevel: "Q",
      });

      const qrImg = new Image();
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => resolve();
        qrImg.onerror = (e) => reject(e);
        qrImg.src = qrDataUrl;
      });

      // ─── 2. Montar o totem completo num canvas principal 1200×1600 ───
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 1600;
      const ctx = canvas.getContext("2d");
      if (!ctx) { toast.dismiss("qr-download"); return; }

      // Fundo branco
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Borda decorativa (azul índigo)
      ctx.strokeStyle = "#4f46e5";
      ctx.lineWidth = 14;
      ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);

      // Badge "PRESENÇA DIGITAL"
      const badgeW = 340;
      const badgeH = 50;
      const badgeX = (canvas.width - badgeW) / 2;
      ctx.fillStyle = "#eef2ff";
      if (ctx.roundRect) ctx.roundRect(badgeX, 68, badgeW, badgeH, 25); else ctx.rect(badgeX, 68, badgeW, badgeH);
      ctx.fill();
      ctx.strokeStyle = "#c7d2fe";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#4338ca";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✦  PRESENÇA DIGITAL  ✦", canvas.width / 2, 103);

      // Nome da escola
      ctx.fillStyle = "#0f172a";
      ctx.font = "900 52px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(schoolName.toUpperCase(), canvas.width / 2, 190);

      // Subtítulo
      ctx.fillStyle = "#4f46e5";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText("FAÇA SEU CHECK-IN DE AULA", canvas.width / 2, 244);

      // Instrução
      ctx.fillStyle = "#64748b";
      ctx.font = "500 22px sans-serif";
      ctx.fillText("Aponte a câmera do celular para o QR Code abaixo", canvas.width / 2, 285);

      // ─── Container do QR Code ───
      const qrSize = 600;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = 318;
      const pad = 28;
      ctx.fillStyle = "#f8fafc";
      if (ctx.roundRect) ctx.roundRect(qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2, 28); else ctx.rect(qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2);
      ctx.fill();
      ctx.strokeStyle = "#e0e7ff";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Desenha o QR Code REAL diretamente (Image PNG base64)
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // ─── Box dos 3 Passos ───
      const stepsY = 1020;
      const stepsW = 920;
      const stepsH = 270;
      const stepsX = (canvas.width - stepsW) / 2;
      ctx.fillStyle = "#f8fafc";
      if (ctx.roundRect) ctx.roundRect(stepsX, stepsY, stepsW, stepsH, 24); else ctx.rect(stepsX, stepsY, stepsW, stepsH);
      ctx.fill();
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 2;
      ctx.stroke();

      const drawStep = (num: string, text: string, y: number, color: string) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(stepsX + 52, y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(num, stepsX + 52, y + 8);
        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 26px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(text, stepsX + 94, y + 9);
      };

      drawStep("1", "Abra a câmera do celular ou o Portal do Aluno", stepsY + 58, "#4f46e5");
      drawStep("2", "Aponte para este QR Code de presença", stepsY + 138, "#4f46e5");
      // Passo 3 (verde)
      ctx.fillStyle = "#059669";
      ctx.beginPath();
      ctx.arc(stepsX + 52, stepsY + 218, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✓", stepsX + 52, stepsY + 226);
      ctx.fillStyle = "#065f46";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Pronto! Sua presença foi confirmada.", stepsX + 94, stepsY + 227);

      // Rodapé
      ctx.fillStyle = "#94a3b8";
      ctx.font = "500 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Totem Oficial  •  ${schoolName}  •  MusicPro`, canvas.width / 2, 1520);

      // ─── 3. Exportar PNG e acionar download ───
      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = `totem-presenca-qrcode-${schoolName.toLowerCase().replace(/\s+/g, "-")}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Placa QR Code baixada em alta resolução!", { id: "qr-download" });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar a imagem do totem.", { id: "qr-download" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] flex flex-col p-0 border border-white/10 bg-slate-950 text-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header fixo no topo */}
        <DialogHeader className="p-5 px-6 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 bg-slate-900/80 backdrop-blur-md">
          <div className="min-w-0">
            <DialogTitle className="text-lg sm:text-xl font-black uppercase tracking-wider flex items-center gap-2.5 text-white">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
                <Printer size={16} />
              </div>
              <span>Imprimir Totem / Placa de Recepção</span>
            </DialogTitle>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Gere a placa em alta definição para fixar na recepção ou nas salas de aula da sua escola.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadPng}
              className="gap-2 rounded-xl bg-white/5 hover:bg-white/15 border-white/15 text-white font-bold text-xs h-9 px-4 transition-all cursor-pointer"
            >
              <Download size={14} />
              Baixar PNG (HD)
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-5 shadow-lg shadow-indigo-500/25 transition-all cursor-pointer"
            >
              <Printer size={14} />
              Imprimir
            </Button>
          </div>
        </DialogHeader>

        {/* ── Visualização da Folha / Totem com scroll sutil apenas quando necessário ─────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-center justify-center bg-slate-950/90 subtle-scrollbar">
          <div
            ref={printRef}
            id="printable-totem-card"
            className="w-full max-w-[420px] bg-white text-slate-900 rounded-3xl p-6 border-4 border-indigo-600 shadow-2xl flex flex-col items-center text-center relative overflow-hidden my-auto"
          >
            {/* Top Badge */}
            <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-black uppercase tracking-widest mb-3">
              <Sparkles size={12} />
              Presença Digital
            </div>

            {/* Logo & School Name */}
            <div className="flex flex-col items-center gap-1.5 mb-3">
              {schoolLogo ? (
                <div className="w-14 h-14 rounded-2xl overflow-hidden border border-slate-200 p-1 flex items-center justify-center bg-white shadow-sm">
                  <img src={schoolLogo} alt={schoolName} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
                  <Music size={24} />
                </div>
              )}
              <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                {schoolName}
              </h2>
            </div>

            {/* Chamada */}
            <div className="mb-3">
              <h3 className="text-base font-black text-indigo-900 leading-tight">
                Faça seu Check-in de Aula
              </h3>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                Aponte a câmera do seu celular para o QR Code abaixo
              </p>
            </div>

            {/* QR Code Container */}
            <div className="p-3 bg-slate-50 border-2 border-indigo-100 rounded-2xl shadow-inner mb-4">
              {token ? (
                <QRCode
                  id="qr-code-totem-svg"
                  value={token}
                  size={200}
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                  level="Q"
                />
              ) : (
                <div className="w-[200px] h-[200px] flex items-center justify-center text-slate-400 text-xs">
                  Gerando código...
                </div>
              )}
            </div>

            {/* 3 Passos */}
            <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-left space-y-1.5 mb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                  1
                </span>
                <p className="text-[11px] font-bold text-slate-700">
                  Abra a câmera ou o <b>Portal do Aluno</b>
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                  2
                </span>
                <p className="text-[11px] font-bold text-slate-700">
                  Aponte para o <b>QR Code</b>
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                  ✓
                </span>
                <p className="text-[11px] font-bold text-emerald-800">
                  Pronto! Sua presença foi confirmada.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-semibold">
              <Shield size={11} className="text-indigo-500" />
              <span>Totem Oficial • {schoolName}</span>
            </div>
          </div>
        </div>

        {/* Estilo Global de Impressão (@media print) */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            #printable-totem-card, #printable-totem-card * {
              visibility: visible !important;
            }
            #printable-totem-card {
              position: fixed !important;
              left: 50% !important;
              top: 50% !important;
              transform: translate(-50%, -50%) !important;
              width: 90% !important;
              max-width: 600px !important;
              box-shadow: none !important;
              border: 4px solid #4f46e5 !important;
            }
          }
        ` }} />
      </DialogContent>
    </Dialog>
  );
}
