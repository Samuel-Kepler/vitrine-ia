import { expect, test } from "@playwright/test";
import { DesignReview } from "../src/lib/review/schema";

const provider = process.env.E2E_PROVIDER ?? "mock";
const isMock = provider === "mock";

test.beforeEach(async ({ page }) => {
  // Observa o DOM desde o início: registra se algum token chegou em stream
  // (com modelos rápidos o texto termina antes de o teste conseguir "ver").
  await page.addInitScript(() => {
    const w = window as unknown as { __tokens: number };
    w.__tokens = 0;
    new MutationObserver((records) => {
      for (const r of records)
        r.addedNodes.forEach((n) => {
          if (n instanceof HTMLElement && n.classList.contains("token-in")) w.__tokens++;
        });
    }).observe(document, { childList: true, subtree: true });
  });
});

test("prompt → streaming → timeline → preview → código → Design Review", async ({ page }) => {
  await page.goto("/");

  // 1. App vazio, com o provedor ativo no badge
  await expect(page.getByTestId("empty-state")).toBeVisible();
  await expect(page.getByTestId("provider-badge")).toContainText(provider);
  await expect(page.getByTestId("review-button")).toBeDisabled();

  // 2. Prompt de exemplo clicável
  await page.getByRole("button", { name: /Cafeteria/ }).click();
  await expect(page.getByTestId("thinking")).toBeVisible();

  // 4. Timeline do loop agêntico: ao menos uma tool call criando arquivo
  await expect(page.getByTestId("tool-step").first()).toBeVisible();
  await expect(page.getByTestId("done")).toBeVisible();

  // 3. Streaming: o texto chegou em pedaços. Conferido depois do "pronto"
  // porque nos modelos abertos o 1º passo é forçado a ser tool call e o
  // texto, quando vem, vem no fim (e o modelo pode não escrever nada).
  // Cada provedor decide o tamanho do pedaço; o mock manda palavra a palavra.
  const tokens = () => page.evaluate(() => (window as any).__tokens as number);
  if (isMock) await expect.poll(tokens).toBeGreaterThan(3);
  else if (provider === "anthropic") await expect.poll(tokens).toBeGreaterThan(0);
  else test.info().annotations.push({ type: "pedaços de texto", description: String(await tokens()) });
  await expect(page.getByTestId("tool-step").filter({ hasText: "/App.jsx" }).first()).toBeVisible();

  // 5. Preview renderizado dentro do iframe
  const preview = page.frameLocator('iframe[title="Preview"]');
  if (isMock) {
    await expect(preview.getByRole("heading", { level: 1 })).toContainText("O café");
  } else {
    await expect(preview.locator("#root > *").first()).toBeVisible();
  }

  // 6. Código gerado
  await page.getByRole("tab", { name: "Código" }).click();
  await expect(page.getByTestId("file-tree").getByText("App.jsx")).toBeVisible();
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await page.getByRole("tab", { name: "Preview" }).click();

  // 7. Design Review: objeto validado pelo mesmo schema zod
  await page.getByTestId("review-button").click();
  await expect(page.getByTestId("review-panel")).toBeVisible();
  await expect(page.getByTestId("review-summary")).not.toBeEmpty();
  if (isMock) await expect(page.getByTestId("review-issue")).toHaveCount(3);

  await page.getByRole("button", { name: "JSON" }).click();
  const raw = await page.getByTestId("review-json").textContent();
  const review = DesignReview.parse(JSON.parse(raw ?? "{}"));
  expect(review.score).toBeGreaterThanOrEqual(0);
  expect(review.score).toBeLessThanOrEqual(100);
});

test("API /api/review rejeita projeto vazio", async ({ request }) => {
  const res = await request.post("/api/review", { data: { files: {} } });
  expect(res.status()).toBe(400);
});
