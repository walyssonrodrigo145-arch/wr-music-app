// ─── Moldura de celular (iPhone-style) para os prints do sistema ─────────────
// Usada nas páginas públicas de funcionalidades; o print é escolhido no Super Admin.
import { useState } from "react";
import { cn } from "@/lib/utils";
import type React from "react";

/** Imagem com shimmer até carregar (e placeholder se falhar). */
function FrameImage({ src, alt, imgClassName }: { src: string; alt: string; imgClassName: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <div className="h-full w-full animate-pulse bg-gradient-to-r from-muted via-muted/50 to-muted" aria-hidden="true" />;
  }

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 z-10 animate-pulse bg-gradient-to-r from-muted via-muted/50 to-muted" aria-hidden="true" />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(imgClassName, "transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
      />
    </>
  );
}

export function PhoneFrame({
  src,
  alt,
  children,
  className,
}: {
  src?: string | null;
  alt?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative mx-auto w-[240px] sm:w-[270px] shrink-0", className)}>
      {/* Botões laterais */}
      <span className="absolute -left-[3px] top-[16%] h-8 w-[3px] rounded-l-md bg-slate-700" />
      <span className="absolute -left-[3px] top-[26%] h-12 w-[3px] rounded-l-md bg-slate-700" />
      <span className="absolute -left-[3px] top-[37%] h-12 w-[3px] rounded-l-md bg-slate-700" />
      <span className="absolute -right-[3px] top-[24%] h-16 w-[3px] rounded-r-md bg-slate-700" />

      {/* Corpo do aparelho */}
      <div className="relative aspect-[9/19.2] rounded-[2.75rem] bg-slate-950 p-[9px] shadow-2xl ring-1 ring-white/10">
        <div className="relative h-full w-full overflow-hidden rounded-[2.25rem] bg-background">
          {src ? (
            <FrameImage src={src} alt={alt || "MusicPro no celular"} imgClassName="h-full w-full object-cover" />
          ) : (
            children
          )}
          {/* Notch */}
          <span className="absolute left-1/2 top-[6px] h-[18px] w-[86px] -translate-x-1/2 rounded-full bg-slate-950" />
        </div>
      </div>
    </div>
  );
}

/** Moldura de notebook (MacBook-style) para prints da versão web. */
export function LaptopFrame({
  src,
  alt,
  children,
  className,
}: {
  src?: string | null;
  alt?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[680px]", className)}>
      {/* Tela */}
      <div className="relative rounded-t-[1.4rem] bg-slate-950 p-[10px] pb-[12px] shadow-2xl ring-1 ring-white/10">
        <div className="relative aspect-[16/10] overflow-hidden rounded-[0.6rem] bg-background">
          {src ? (
            <FrameImage src={src} alt={alt || "MusicPro no computador"} imgClassName="h-full w-full object-cover object-top" />
          ) : (
            children
          )}
          {/* Notch da câmera */}
          <span className="absolute left-1/2 top-0 h-[10px] w-[86px] -translate-x-1/2 rounded-b-lg bg-slate-950" />
        </div>
      </div>

      {/* Base (teclado) — mais larga que a tela */}
      <div className="relative -mx-[2.5%] h-[12px] sm:h-[16px] rounded-b-[1rem] bg-gradient-to-b from-slate-300 via-slate-400 to-slate-500 shadow-xl">
        <span className="absolute left-1/2 top-0 h-[5px] w-24 -translate-x-1/2 rounded-b-md bg-slate-500/70" />
        <span className="absolute left-1/2 top-0 h-[3px] w-44 -translate-x-1/2 rounded-b bg-slate-700/30" />
      </div>
      {/* Sombra de apoio */}
      <div className="mx-auto h-3 w-[92%] rounded-b-full bg-slate-950/20 blur-md" />
    </div>
  );
}
