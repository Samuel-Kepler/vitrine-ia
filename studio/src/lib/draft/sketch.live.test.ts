// Diagnóstico manual: desenho -> blocos com o modelo de visão do Groq.
// Rodar: RUN_LIVE=1 npx vitest run src/lib/draft/sketch.live.test.ts
import { expect, it } from "vitest";
import { deflateSync } from "node:zlib";
if (process.env.RUN_LIVE) process.loadEnvFile(".env");
import { runSketch } from "./sketch";
import type { DraftNode } from "./tree";

/** PNG de wireframe: barra de título + 3 caixas com círculo (ícone) e linhas (texto). */
function wireframe(): string {
  const w = 600, h = 360;
  const px = new Uint8Array(w * h).fill(255);
  const rect = (x0: number, y0: number, x1: number, y1: number, fill = false) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (fill || x - x0 < 3 || x1 - x < 3 || y - y0 < 3 || y1 - y < 3) px[y * w + x] = 0;
  };
  const circle = (cx: number, cy: number, r: number) => {
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) { const d = Math.hypot(x - cx, y - cy); if (d <= r && d >= r - 3) px[y * w + x] = 0; }
  };
  rect(150, 20, 450, 50, true); // título
  for (let i = 0; i < 3; i++) {
    const x0 = 30 + i * 190;
    rect(x0, 90, x0 + 160, 330);
    circle(x0 + 40, 135, 22);
    rect(x0 + 20, 180, x0 + 130, 192, true);
    for (let k = 0; k < 3; k++) rect(x0 + 20, 215 + k * 25, x0 + 140 - k * 15, 220 + k * 25, true);
  }
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w + 1)] = 0; for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = px[y * w + x]; }
  const crc = (b: Buffer) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t: string, d: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

const show = (n: DraftNode, d = 0): string => `${"  ".repeat(d)}- ${n.type} ${JSON.stringify(Object.fromEntries(Object.entries(n.props).filter(([, v]) => v && v !== "auto")))}\n` + (n.children ?? []).map((c) => show(c, d + 1)).join("");

it.skipIf(!process.env.RUN_LIVE)("desenho -> blocos ao vivo", { timeout: 180_000 }, async () => {
  const kind = (process.env.SKETCH_KIND as "groq" | "ollama" | undefined) ?? "groq";
  const r = await runSketch({ image: wireframe(), name: "Diferenciais", description: "por que escolher a barbearia", brief: "barbearia de bairro em BH", settings: { kind } });
  console.log(`${r.provider}/${r.modelId} fallback=${r.fallback} ${r.error ?? ""}\n${r.draft.map((n) => show(n)).join("")}notas: ${r.notes.join(" | ")}`);
  expect(r.fallback, r.error).toBe(false);
});
