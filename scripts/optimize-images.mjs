// ─── Otimização de imagens da landing (execução única/local) ─────────────────
// Converte os PNGs decorativos para WebP e gera og-image.jpg (1200×630).
// Uso: pnpm add -D sharp && node scripts/optimize-images.mjs && pnpm remove sharp
// (o sharp não fica nas dependências do projeto — é ferramenta de manutenção)
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const PUBLIC_DIR = path.resolve(process.cwd(), "client", "public");
const targets = ["piano-trans", "guitar-trans", "sax-trans", "synth-trans", "violin-trans"];

for (const name of targets) {
  const src = path.join(PUBLIC_DIR, "img", `${name}.png`);
  const out = path.join(PUBLIC_DIR, "img", `${name}.webp`);
  if (!fs.existsSync(src)) {
    console.warn(`[images] não encontrado: ${src}`);
    continue;
  }
  const before = fs.statSync(src).size;
  const meta = await sharp(src).metadata();
  await sharp(src).webp({ quality: 80, effort: 5 }).toFile(out);
  const after = fs.statSync(out).size;
  console.log(
    `[images] ${name}: ${meta.width}x${meta.height} · ${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB (webp)`
  );
}

// og-image.jpg (1200×630) a partir do mockup real do sistema
const mockup = path.join(PUBLIC_DIR, "musicpro_real_ui_mockup.jpg");
if (fs.existsSync(mockup)) {
  await sharp(mockup)
    .resize(1200, 630, { fit: "cover", position: "top" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(PUBLIC_DIR, "og-image.jpg"));
  console.log(`[images] og-image.jpg gerado (1200×630)`);
} else {
  console.warn("[images] mockup não encontrado para gerar og-image.jpg");
}
