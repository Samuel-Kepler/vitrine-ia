// Gera os prints e vídeos de docs/aula1/. Não roda no CI.
//
//   CAPTURE_SET=main  E2E_PROVIDER=anthropic npm run docs:capture   → 01..09 + vídeo
//   CAPTURE_SET=alt   E2E_PROVIDER=mock      npm run docs:capture   → 11..13 (outro badge)
//   CAPTURE_SET=error E2E_PROVIDER=groq      npm run docs:capture   → 14 (chave ausente)
//
// Os GIFs saem do vídeo com scripts/make-gifs.sh, usando os tempos salvos em marks.json.
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const set = process.env.CAPTURE_SET ?? "main";
const OUT = path.resolve("docs/aula1");
const SCREENS = path.join(OUT, "screens");
const VIDEO_DIR = path.resolve("test-results/capture-video");
fs.mkdirSync(SCREENS, { recursive: true });

const PROMPT =
  "Landing page de cafeteria artesanal com hero animado, cardápio em cards e botão de reservar mesa";

test.use({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  video: set === "main" ? { mode: "on", size: { width: 1440, height: 900 } } : "off",
});

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SCREENS, `${name}.png`) });
}

test("captura", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const t0 = Date.now();
  const marks: Record<string, number> = {};
  const mark = (k: string) => (marks[k] = (Date.now() - t0) / 1000);

  if (set === "env") return captureEnvSwap(page);

  await page.goto("/");
  await expect(page.getByTestId("empty-state")).toBeVisible();
  await page.waitForTimeout(1200); // deixa as animações de entrada terminarem

  if (set === "error") {
    await page.getByRole("button", { name: /Cafeteria/ }).click();
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(500);
    await shot(page, "14-erro-chave-ausente");
    return;
  }

  const p = set === "main" ? "" : "alt-";
  if (set === "main") await shot(page, "01-app-vazio");
  else await shot(page, "11-outro-provedor-badge");

  // Prompt digitado
  const box = page.getByRole("textbox");
  await box.click();
  await box.pressSequentially(PROMPT, { delay: set === "main" ? 18 : 0 });
  if (set === "main") await shot(page, "02-prompt");
  mark("send");
  await box.press("Enter");

  // Streaming (o mais cedo possível)
  await page
    .waitForFunction(() => document.querySelectorAll(".token-in").length >= 6, null, { polling: "raf", timeout: 60_000 })
    .catch(() => {});
  mark("streaming");
  // No main, o print 03 é substituído por um frame do vídeo (scripts/make-gifs.sh).
  if (set === "main") await shot(page, "03-streaming");
  else {
    await page.waitForFunction(() => document.querySelectorAll(".token-in").length >= 9, null, { polling: "raf" });
    await shot(page, "03b-streaming-token-a-token");
  }

  // Timeline com tool call em andamento (spinner ainda girando)
  await page
    .waitForSelector('[data-testid="tool-step"] .animate-spin', { timeout: 120_000 })
    .catch(() => {});
  mark("first-tool");
  await page.waitForTimeout(1200);
  if (set === "main") await shot(page, "04-timeline-tools");

  // Pronto + preview
  await expect(page.getByTestId("done")).toBeVisible({ timeout: 180_000 });
  mark("done");
  await page.waitForTimeout(3500); // preview + animações da landing
  if (set === "main") await shot(page, "05-preview");
  else await shot(page, "12-outro-provedor-fluxo");
  mark("preview");

  if (set === "main") {
    // Código gerado: abre o componente principal se existir
    await page.getByRole("tab", { name: "Código" }).click();
    const comp = page.getByText(/\.jsx$/).filter({ hasNotText: "App.jsx" }).first();
    await page.getByText("components").first().click().catch(() => {});
    if (await comp.isVisible().catch(() => false)) await comp.click();
    else await page.getByText("App.jsx").first().click();
    await page.waitForTimeout(1500);
    await shot(page, "06-codigo-gerado");
    await page.getByRole("tab", { name: "Preview" }).click();
    await page.waitForTimeout(2500);
  }

  // Design Review
  mark("review-click");
  await page.getByTestId("review-button").click();
  await page.getByTestId("review-loading").waitFor({ timeout: 10_000 }).catch(() => {});
  if (set === "main") await shot(page, "07-review-carregando");
  await expect(page.getByTestId("review-summary")).toBeVisible({ timeout: 120_000 });
  mark("review-done");
  await page.waitForTimeout(2200);
  if (set === "main") await shot(page, "08-review-resultado");
  else await shot(page, "13-outro-provedor-review");

  if (set === "main") {
    await page.getByRole("button", { name: "JSON" }).click();
    await page.waitForTimeout(600);
    await shot(page, "09-review-json");
    mark("end");
    fs.writeFileSync(path.join(OUT, "gifs", "marks.json"), JSON.stringify(marks, null, 2));
  }
  void p;

  // Copia o vídeo para um caminho previsível
  await page.close();
  const video = page.video();
  if (video) {
    fs.mkdirSync(VIDEO_DIR, { recursive: true });
    await video.saveAs(path.join(VIDEO_DIR, "main.webm"));
  }
  void testInfo;
});

// Print 10: a troca de provedor é só mudar o .env. Renderizado a partir de
// texto (chaves mascaradas) para nunca vazar segredo em print.
async function captureEnvSwap(page: Page) {
  const line = (sign: string, text: string) =>
    `<div class="l ${sign === "-" ? "del" : sign === "+" ? "add" : ""}"><span class="s">${sign}</span>${text}</div>`;
  const kv = (k: string, v: string) => `<span class="k">${k}</span>=<span class="v">${v}</span>`;
  await page.setViewportSize({ width: 1200, height: 750 });
  await page.setContent(`<!doctype html><html><head><style>
    body{margin:0;background:#09090b;font:15px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;color:#d4d4d8;padding:40px}
    .win{border:1px solid #27272a;border-radius:16px;overflow:hidden;background:#111113;box-shadow:0 30px 80px -20px #000}
    .bar{display:flex;gap:8px;align-items:center;padding:12px 16px;border-bottom:1px solid #27272a;color:#71717a;font-size:13px}
    .dot{width:11px;height:11px;border-radius:50%}.code{padding:18px 0}
    .l{padding:0 20px;white-space:pre}.s{display:inline-block;width:22px;color:#52525b}
    .del{background:rgba(244,63,94,.12)}.del .s{color:#fb7185}.add{background:rgba(16,185,129,.12)}.add .s{color:#34d399}
    .k{color:#c4b5fd}.v{color:#fcd34d}.c{color:#52525b}
    .term{margin-top:24px}.p{color:#34d399}.hl{color:#fff;background:rgba(139,92,246,.25);padding:1px 6px;border-radius:4px}
  </style></head><body>
  <div class="win"><div class="bar"><span class="dot" style="background:#fb7185"></span><span class="dot" style="background:#fbbf24"></span><span class="dot" style="background:#34d399"></span>&nbsp; .env</div>
  <div class="code">
    ${line(" ", '<span class="c"># AI_PROVIDER escolhe o provedor: anthropic | google | groq | openrouter | mock</span>')}
    ${line("-", kv("AI_PROVIDER", "anthropic"))}
    ${line("+", kv("AI_PROVIDER", "google"))}
    ${line(" ", kv("AI_MODEL", ""))}
    ${line(" ", kv("ANTHROPIC_API_KEY", "••••••••••••••••••••••"))}
    ${line("+", kv("GOOGLE_GENERATIVE_AI_API_KEY", "••••••••••••••••••••••"))}
  </div></div>
  <div class="win term"><div class="bar">terminal — npm run dev</div><div class="code">
    ${line(" ", '<span class="p">$</span> npm run dev')}
    ${line(" ", '<span class="c">  ▲ Next.js 16 · Reload env: .env</span>')}
    ${line(" ", '[chat] <span class="hl">google/gemini-flash-latest</span>')}
    ${line(" ", '[review] <span class="hl">google/gemini-flash-latest</span>')}
  </div></div></body></html>`);
  await shot(page, "10-troca-provedor-env");
}
