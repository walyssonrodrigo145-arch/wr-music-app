// ─── FallbackService (§7/§29) — texto numerado quando botões/listas não estão
// disponíveis, e montagem de mensagens no padrão curto (§30).

import { InteractiveButton } from "./types";

const NUMBER_EMOJI = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

/** Fallback textual: o número escolhido é mapeado de volta ao botão via parseFallbackChoice. */
export function buildFallbackText(title: string, body: string, buttons: InteractiveButton[]): string {
  const lines = [
    `*${title}*`.trim(),
    "",
    body.trim(),
    "",
    ...buttons.slice(0, 10).map((b, i) => `${NUMBER_EMOJI[i] ?? `${i + 1}.`} ${b.text}`),
    "",
    "_Digite o número da opção._",
  ];
  return lines.join("\n");
}
