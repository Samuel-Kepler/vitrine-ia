import { defineConfig, devices } from "@playwright/test";

// E2E_PROVIDER escolhe o provedor do servidor de teste.
//   mock (padrão, roda no CI, sem chave)  → npm run test:e2e
//   anthropic | google | groq | openrouter → npm run test:e2e:real (usa as chaves do .env)
const provider = process.env.E2E_PROVIDER ?? "mock";
const isMock = provider === "mock";
const port = isMock ? 3100 : 3200;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: process.env.CAPTURE ? undefined : "**/capture-*.spec.ts",
  // Free tiers (ex.: Groq, 8 mil tokens/min) esperam o limite entre passos.
  timeout: isMock ? 90_000 : 420_000,
  expect: { timeout: isMock ? 20_000 : 300_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      AI_PROVIDER: provider,
      MOCK_TOKEN_DELAY_MS: process.env.MOCK_TOKEN_DELAY_MS ?? "12",
    },
  },
});
