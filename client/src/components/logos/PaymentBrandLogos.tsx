// ─── Logos reais das plataformas de pagamento (integrações oficiais) ─────────
// Marcas reproduzidas de forma fiel: Asaas (quadrado azul + "a" branco),
// Mercado Pago (oval azul + aperto de mãos) e InfinitePay (quadrado escuro +
// infinito verde/lima).
import { Handshake, Infinity as InfinityIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

/** Asaas — quadrado azul com o "a" branco da marca. */
export function AsaasLogoMark({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" className={cn("w-9 h-9", className)} role="img" aria-label="Asaas">
      <rect width="40" height="40" rx="10" fill="#0B3EE3" />
      <path
        d="M12.6 30.5c.9-4.6 3.3-13.6 7.4-19.3 4.1 5.7 6.5 14.7 7.4 19.3"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17.1 24.6h5.8" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

/** Mercado Pago — oval azul com o aperto de mãos da marca. */
export function MercadoPagoLogoMark({ className }: LogoProps) {
  return (
    <span className={cn("relative inline-flex items-center justify-center w-9 h-9", className)} role="img" aria-label="Mercado Pago">
      <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <ellipse cx="20" cy="20" rx="18.5" ry="13" fill="#0FB6EE" stroke="#0B4A9E" strokeWidth="1.6" />
      </svg>
      <Handshake className="absolute w-[46%] h-[46%] text-white" strokeWidth={2.6} />
    </span>
  );
}

/** InfinitePay — quadrado escuro com o infinito verde/lima da marca. */
export function InfinitePayLogoMark({ className }: LogoProps) {
  return (
    <span className={cn("relative inline-flex items-center justify-center w-9 h-9", className)} role="img" aria-label="InfinitePay">
      <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="40" height="40" rx="10" fill="#0E0E10" />
      </svg>
      <InfinityIcon className="absolute w-[54%] h-[54%] text-lime-300" strokeWidth={2.8} />
    </span>
  );
}

export const PAYMENT_BRANDS = {
  asaas: AsaasLogoMark,
  mercadopago: MercadoPagoLogoMark,
  infinitepay: InfinitePayLogoMark,
} as const;
