import { useState } from "react";
import { cn } from "@/lib/utils";

interface SeoImageProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  width?: number;
  height?: number;
  eager?: boolean;
}

/** Imagem das páginas públicas com shimmer até carregar (e placeholder se falhar). */
export function SeoImage({ src, alt, className, imgClassName, width, height, eager }: SeoImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn("animate-pulse bg-gradient-to-r from-muted via-muted/50 to-muted", className)}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {!loaded && (
        <div
          className="absolute inset-0 animate-pulse bg-gradient-to-r from-muted via-muted/50 to-muted"
          aria-hidden="true"
        />
      )}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(imgClassName, "transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}
