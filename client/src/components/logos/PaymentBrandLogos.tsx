// ─── Logos reais das plataformas de pagamento (integrações oficiais) ─────────
// Ícones oficiais baixados dos próprios sites:
//   Asaas        → asaas.com (web-app-manifest-512x512.png)
//   Mercado Pago → mercadopago.com.br (ícone oficial)
//   InfinitePay  → infinitepay.io (ícone oficial)
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

/** Asaas — ícone oficial. */
export function AsaasLogoMark({ className }: LogoProps) {
  return (
    <img
      src="/logos/asaas.png"
      alt="Asaas"
      width={512}
      height={512}
      loading="lazy"
      decoding="async"
      className={cn("w-9 h-9 object-contain", className)}
    />
  );
}

/** Mercado Pago — ícone oficial. */
export function MercadoPagoLogoMark({ className }: LogoProps) {
  return (
    <img
      src="/logos/mercadopago.png"
      alt="Mercado Pago"
      width={128}
      height={128}
      loading="lazy"
      decoding="async"
      className={cn("w-9 h-9 object-contain", className)}
    />
  );
}

/** InfinitePay — ícone oficial. */
export function InfinitePayLogoMark({ className }: LogoProps) {
  return (
    <img
      src="/logos/infinitepay.png"
      alt="InfinitePay"
      width={128}
      height={128}
      loading="lazy"
      decoding="async"
      className={cn("w-9 h-9 object-contain", className)}
    />
  );
}

export const PAYMENT_BRANDS = {
  asaas: AsaasLogoMark,
  mercadopago: MercadoPagoLogoMark,
  infinitepay: InfinitePayLogoMark,
} as const;
