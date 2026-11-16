import { describe, test, expect } from "vitest";
import { resolveProvider } from "../provider";

describe("resolveProvider", () => {
  test("falls back to mock when no key is set", () => {
    expect(resolveProvider({})).toBe("mock");
  });

  test("auto-detects the first provider with a key", () => {
    expect(resolveProvider({ GROQ_API_KEY: "x" })).toBe("groq");
    expect(
      resolveProvider({ ANTHROPIC_API_KEY: "a", GOOGLE_GENERATIVE_AI_API_KEY: "g" })
    ).toBe("anthropic");
  });

  test("respects AI_PROVIDER when its key exists", () => {
    expect(
      resolveProvider({
        AI_PROVIDER: "openrouter",
        ANTHROPIC_API_KEY: "a",
        OPENROUTER_API_KEY: "o",
      })
    ).toBe("openrouter");
  });

  test("AI_PROVIDER=mock forces the mock even with keys", () => {
    expect(resolveProvider({ AI_PROVIDER: "mock", ANTHROPIC_API_KEY: "a" })).toBe("mock");
  });

  test("throws a clear error when the chosen provider has no key", () => {
    expect(() => resolveProvider({ AI_PROVIDER: "google" })).toThrow(
      /GOOGLE_GENERATIVE_AI_API_KEY/
    );
  });

  test("throws on unknown provider", () => {
    expect(() => resolveProvider({ AI_PROVIDER: "openai" })).toThrow(/não é suportado/);
  });
});
