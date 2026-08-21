import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import QRCode from "react-qr-code";
import { Printer, Download, Music, QrCode, Smartphone, CheckCircle, Shield, Sparkles } from "lucide-react";
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
    try {
      // 1. Busca especificamente o SVG do QR Code (e não os ícones do Lucide como Sparkles/Music/Shield)
      const svgElement = printRef.current?.querySelector("#qr-code-totem-svg");
      if (!svgElement) {
        toast.error("Não foi possível encontrar o QR Code para gerar a imagem.");
        return;
      }

      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = 3; // Ultra HD
        canvas.width = 1200;
        canvas.height = 1600;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Fundo Branco limpo
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Borda decorativa interna
        ctx.strokeStyle = "#4f46e5";
        ctx.lineWidth = 14;
        ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);

        // Badge superior
        ctx.fillStyle = "#eef2ff";
        ctx.roundRect ? ctx.roundRect((canvas.width - 320) / 2, 70, 320, 48, 24) : ctx.fillRect((canvas.width - 320) / 2, 70, 320, 48);
        ctx.fill();
        ctx.strokeStyle = "#c7d2fe";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#4338ca";
        ctx.font = "bold 22px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("PRESENÇA DIGITAL", canvas.width / 2, 102);

        // Header / Nome da Escola
        ctx.fillStyle = "#0f172a";
        ctx.font = "900 48px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(schoolName.toUpperCase(), canvas.width / 2, 180);

        // Subtítulo
        ctx.fillStyle = "#4f46e5";
        ctx.font = "bold 26px sans-serif";
        ctx.fillText("FAÇA SEU CHECK-IN DE AULA", canvas.width / 2, 230);

        // Título de Chamada
        ctx.fillStyle = "#64748b";
        ctx.font = "600 22px sans-serif";
        ctx.fillText("Aponte a câmera do celular para o QR Code abaixo", canvas.width / 2, 270);

        // QR Code no centro com moldura
        const qrSize = 600;
        const qrX = (canvas.width - qrSize) / 2;
        const qrY = 320;

        // Container do QR Code
        ctx.fillStyle = "#f8fafc";
        ctx.roundRect ? ctx.roundRect(qrX - 25, qrY - 25, qrSize + 50, qrSize + 50, 30) : ctx.fillRect(qrX - 25, qrY - 25, qrSize + 50, qrSize + 50);
        ctx.fill();
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 3;
        ctx.stroke();

        // Desenha o QR Code real
        ctx.drawImage(image, qrX, qrY, qrSize, qrSize);

        // Container dos 3 Passos
        const stepsBoxY = 1000;
        const stepsBoxW = 900;
        const stepsBoxH = 260;
        const stepsBoxX = (canvas.width - stepsBoxW) / 2;

        ctx.fillStyle = "#f8fafc";
        ctx.roundRect ? ctx.roundRect(stepsBoxX, stepsBoxY, stepsBoxW, stepsBoxH, 24) : ctx.fillRect(stepsBoxX, stepsBoxY, stepsBoxW, stepsBoxH);
        ctx.fill();
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Passos
        ctx.textAlign = "left";
        
        // Passo 1
        ctx.fillStyle = "#4f46e5";
        ctx.beginPath();
        ctx.arc(stepsBoxX + 50, stepsBoxY + 55, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("1", stepsBoxX + 50, stepsBoxY + 62);

        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("Abra a câmera do celular ou o Portal do Aluno", stepsBoxX + 90, stepsBoxY + 63);

        // Passo 2
        ctx.fillStyle = "#4f46e5";
        ctx.beginPath();
        ctx.arc(stepsBoxX + 50, stepsBoxY + 130, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("2", stepsBoxX + 50, stepsBoxY + 137);

        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("Aponte para este QR Code de presença", stepsBoxX + 90, stepsBoxY + 138);

        // Passo 3
        ctx.fillStyle = "#059669";
        ctx.beginPath();
        ctx.arc(stepsBoxX + 50, stepsBoxY + 205, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("✓", stepsBoxX + 50, stepsBoxY + 212);

        ctx.fillStyle = "#065f46";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("Pronto! Sua presença foi confirmada.", stepsBoxX + 90, stepsBoxY + 213);

        // Rodapé
        ctx.fillStyle = "#94a3b8";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`Totem Oficial • ${schoolName} • MusicPro`, canvas.width / 2, 1500);

        // Download
        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `totem-presenca-qrcode-${schoolName.toLowerCase().replace(/\s+/g, "-")}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(blobURL);
        toast.success("Placa QR Code baixada em alta resolução!");
      };

      image.src = blobURL;
    } catch (err) {
      console.error(err);
      toast.error("Erro ao baixar a placa em imagem.");
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
