// ─── Coordenador de modais globais ───────────────────────────────────────────
// Evita que dois modais promocionais/avisos abram ao mesmo tempo (ex.: anúncio
// do Indique & Ganhe + lembrete de renovação). Quem chega primeiro "reivindica"
// o slot por uma janela curta; os demais aguardam o próximo ciclo.

const SLOT_KEY = "mp_modal_slot_at";

export function claimModalSlot(windowMs = 20_000): boolean {
  try {
    const now = Date.now();
    const last = Number(localStorage.getItem(SLOT_KEY) || 0);
    if (Number.isFinite(last) && now - last < windowMs) return false;
    localStorage.setItem(SLOT_KEY, String(now));
    return true;
  } catch {
    // Sem storage: permite abrir (nunca bloqueia o app por isso)
    return true;
  }
}
