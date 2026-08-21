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
      // Cria um canvas em alta resolução a partir do SVG do QR Code
      const svgElement = printRef.current?.querySelector("svg");
      if (!svgElement) {
        toast.error("Não foi possível gerar a imagem.");
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

        // Borda decorativa
        ctx.strokeStyle = "#4f46e5";
        ctx.lineWidth = 16;
        ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

        // Header / Nome da Escola
        ctx.fillStyle = "#1e1b4b";
        ctx.font = "bold 52px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(schoolName.toUpperCase(), canvas.width / 2, 140);

        // Subtítulo
        ctx.fillStyle = "#4f46e5";
        ctx.font = "bold 32px sans-serif";
        ctx.fillText("SISTEMA DE PRESENÇA DIGITAL", canvas.width / 2, 200);

        // Título de Chamada
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 44px sans-serif";
        ctx.fillText("APONTE SUA CÂMERA E FAÇA SEU CHECK-IN", canvas.width / 2, 280);

        // QR Code no centro
        const qrSize = 650;
        const qrX = (canvas.width - qrSize) / 2;
        const qrY = 340;
        ctx.drawImage(image, qrX, qrY, qrSize, qrSize);

        // Instruções
        ctx.fillStyle = "#334155";
        ctx.font = "600 28px sans-serif";
        ctx.fillText("1. Abra a câmera do celular ou o Portal do Aluno", canvas.width / 2, 1080);
        ctx.fillText("2. Aponte para este QR Code", canvas.width / 2, 1140);
        ctx.fillText("3. Sua presença é registrada automaticamente!", canvas.width / 2, 1200);

        // Rodapé
        ctx.fillStyle = "#64748b";
        ctx.font = "bold 24px sans-serif";
        ctx.fillText(`Presença Segura • ${schoolName} • MusicPro`, canvas.width / 2, 1480);

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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 border-0 bg-slate-900 text-white rounded-3xl shadow-2xl">
        <DialogHeader className="p-6 pb-2 border-b border-white/10 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-xl font-black uppercase tracking-wider flex items-center gap-2 text-white">
              <Printer size={20} className="text-indigo-400" />
              Imprimir Totem / Placa de Recepção
            </DialogTitle>
            <p className="text-xs text-white/50 mt-1">
              Imprima ou baixe esta placa em alta definição para fixar na recepção ou nas salas de aula.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadPng}
              className="gap-2 rounded-xl bg-white/10 hover:bg-white/20 border-white/10 text-white font-bold text-xs"
            >
              <Download size={14} />
              Baixar PNG
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-500/25"
            >
              <Printer size={14} />
              Imprimir
            </Button>
          </div>
        </DialogHeader>

        {/* ── Visualização da Folha / Totem ─────────────────────────── */}
        <div className="p-6 flex justify-center bg-slate-950/60">
          <div
            ref={printRef}
            id="printable-totem-card"
            className="w-full max-w-[500px] bg-white text-slate-900 rounded-3xl p-8 border-4 border-indigo-600 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
          >
            {/* Top Badge */}
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black uppercase tracking-widest mb-4">
              <Sparkles size={14} />
              Presença Digital
            </div>

            {/* Logo & School Name */}
            <div className="flex flex-col items-center gap-2 mb-4">
              {schoolLogo ? (
                <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 p-1 flex items-center justify-center bg-white shadow-sm">
                  <img src={schoolLogo} alt={schoolName} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
                  <Music size={28} />
                </div>
              )}
              <h2 className="text-xl font-black tracking-tight text-slate-900 uppercase mt-1">
                {schoolName}
              </h2>
            </div>

            {/* Chamada */}
            <div className="mb-4">
              <h3 className="text-lg font-black text-indigo-900 leading-tight">
                Faça seu Check-in de Aula
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Aponte a câmera do seu celular para o QR Code abaixo
              </p>
            </div>

            {/* QR Code Container */}
            <div className="p-4 bg-slate-50 border-2 border-indigo-100 rounded-2xl shadow-inner mb-6">
              {token ? (
                <QRCode
                  value={token}
                  size={260}
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                  level="Q"
                />
              ) : (
                <div className="w-[260px] h-[260px] flex items-center justify-center text-slate-400">
                  Gerando código...
                </div>
              )}
            </div>

            {/* 3 Passos */}
            <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left space-y-2 mb-4">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  1
                </span>
                <p className="text-xs font-bold text-slate-700">
                  Abra a câmera ou o <b>Portal do Aluno</b>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  2
                </span>
                <p className="text-xs font-bold text-slate-700">
                  Aponte para o <b>QR Code</b>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  ✓
                </span>
                <p className="text-xs font-bold text-emerald-800">
                  Pronto! Sua presença foi confirmada.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-semibold">
              <Shield size={12} className="text-indigo-500" />
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
