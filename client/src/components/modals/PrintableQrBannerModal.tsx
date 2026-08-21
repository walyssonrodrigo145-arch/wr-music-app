import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import QRCode from "react-qr-code";
import html2canvas from "html2canvas";
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
    if (!printRef.current) {
      toast.error("Elemento da placa não encontrado na tela.");
      return;
    }

    try {
      toast.loading("Renderizando placa oficial em alta definição...", { id: "qr-download" });

      // Captura o próprio elemento do Totem diretamente do DOM usando html2canvas
      // Isso garante 100% que o QR Code, logotipo, 3 passos e textos sairão exatamente como na tela
      const canvas = await html2canvas(printRef.current, {
        scale: 3, // Ultra Resolução 300 DPI
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = `totem-presenca-qrcode-${schoolName.toLowerCase().replace(/\s+/g, "-")}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Placa QR Code baixada com sucesso!", { id: "qr-download" });
    } catch (err) {
      console.error("Erro no html2canvas:", err);
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
              disabled={!token}
              onClick={handleDownloadPng}
              className="gap-2 rounded-xl bg-white/5 hover:bg-white/15 border-white/15 text-white font-bold text-xs h-9 px-4 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} />
              {token ? "Baixar PNG (HD)" : "Gerando..."}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!token}
              onClick={handlePrint}
              className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-5 shadow-lg shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Estilo Global de Impressão Oficial (@media print) */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body {
              visibility: hidden !important;
              background: #ffffff !important;
            }
            #printable-totem-card, #printable-totem-card * {
              visibility: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #printable-totem-card {
              position: absolute !important;
              left: 50% !important;
              top: 50% !important;
              transform: translate(-50%, -50%) scale(1.1) !important;
              width: 85% !important;
              max-width: 520px !important;
              margin: 0 auto !important;
              padding: 24px !important;
              box-shadow: none !important;
              border: 4px solid #4f46e5 !important;
              border-radius: 24px !important;
              background-color: #ffffff !important;
              color: #0f172a !important;
            }
          }
        ` }} />
      </DialogContent>
    </Dialog>
  );
}
