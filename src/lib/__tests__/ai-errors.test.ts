import { describe, expect, it } from "vitest";
import { APICallError, RetryError } from "ai";
import { friendlyAIError, isRateLimit } from "@/lib/ai-errors";

const rateLimit = new APICallError({
  message: "Rate limit reached for model `openai/gpt-oss-120b` on tokens per minute (TPM): Limit 8000",
  url: "https://api.groq.com/openai/v1/chat/completions",
  requestBodyValues: {},
  statusCode: 429,
});

describe("friendlyAIError", () => {
  it("explica o limite por minuto do Groq em português", () => {
    const msg = friendlyAIError(rateLimit, "groq");
    expect(msg).toContain("Limite de uso do groq");
    expect(msg).toContain("8 mil tokens por minuto");
    expect(msg).toContain("continue");
  });

  it("acha o 429 dentro do RetryError (depois de esgotar as tentativas)", () => {
    const retry = new RetryError({
      message: "Failed after 3 attempts",
      reason: "maxRetriesExceeded",
      errors: [rateLimit, new Error("Cannot connect to API")],
    });
    expect(isRateLimit(retry)).toBe(true);
    expect(friendlyAIError(retry, "groq")).toContain("Limite de uso");
  });

  it("diferencia a cota diária (que não resolve esperando 1 minuto)", () => {
    const daily = new APICallError({
      message: "Rate limit reached for model `openai/gpt-oss-120b` on tokens per day (TPD): Limit 200000",
      url: "x",
      requestBodyValues: {},
      statusCode: 429,
    });
    expect(friendlyAIError(daily, "groq")).toContain("cota diária");
  });

  it("avisa de chave recusada", () => {
    const unauthorized = new APICallError({
      message: "Invalid API Key",
      url: "x",
      requestBodyValues: {},
      statusCode: 401,
    });
    expect(friendlyAIError(unauthorized, "groq")).toContain("chave do groq foi recusada");
  });
});
