import { describe, expect, it } from "vitest";
import { isAIDebug, redactUrl, summarizeRequest } from "@/lib/debug-fetch";

describe("debug-fetch", () => {
  it("só liga com AI_DEBUG=1 ou true", () => {
    expect(isAIDebug({})).toBe(false);
    expect(isAIDebug({ AI_DEBUG: "1" })).toBe(true);
    expect(isAIDebug({ AI_DEBUG: "true" })).toBe(true);
  });

  it("apaga a chave que vai na URL", () => {
    expect(redactUrl("https://x.dev/v1/models/gemini:stream?alt=sse&key=SEGREDO")).toBe(
      "https://x.dev/v1/models/gemini:stream?alt=sse&key=***"
    );
  });

  it("resume uma requisição no formato OpenAI (Groq/OpenRouter)", () => {
    const body = {
      model: "openai/gpt-oss-20b",
      messages: [{}, {}, {}, {}],
      tools: [{ function: { name: "str_replace_editor" } }, { function: { name: "file_manager" } }],
      tool_choice: "auto",
    };
    expect(summarizeRequest(body, "https://api.groq.com/openai/v1/chat/completions", 7270)).toBe(
      "openai/gpt-oss-20b · 4 mensagens · tools [str_replace_editor, file_manager] · tool_choice=auto · 7,1 KB"
    );
  });

  it("resume uma requisição no formato Anthropic e Google", () => {
    expect(
      summarizeRequest({ model: "claude-haiku-5-5", messages: [{}], tools: [{ name: "file_manager" }] }, "", 1024)
    ).toContain("claude-haiku-5-5 · 1 mensagens · tools [file_manager] · tool_choice=auto");
    expect(
      summarizeRequest(
        { contents: [{}, {}], tools: [{ functionDeclarations: [{ name: "str_replace_editor" }] }] },
        "https://g.dev/v1beta/models/gemini-flash-latest:streamGenerateContent",
        10
      )
    ).toContain("gemini-flash-latest · 2 mensagens · tools [str_replace_editor]");
  });
});
