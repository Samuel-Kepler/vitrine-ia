// Modelo falso (LanguageModelV4) para rodar sem chave e nos testes.
// Ele lê o esqueleto A2UI Express que a rota coloca no prompt e o devolve
// como se fosse a resposta "reimaginada" de um modelo de verdade.
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4Prompt,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
  LanguageModelV4Usage,
} from "@ai-sdk/provider";

export const SKELETON_OPEN = "<a2ui-skeleton>";
export const SKELETON_CLOSE = "</a2ui-skeleton>";

function lastUserText(prompt: LanguageModelV4Prompt): string {
  for (let i = prompt.length - 1; i >= 0; i--) {
    const m = prompt[i];
    if (m.role !== "user") continue;
    return (m.content as Array<{ type: string; text?: string }>)
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("\n");
  }
  return "";
}

function firstUserText(prompt: LanguageModelV4Prompt): string {
  const m = prompt.find((x) => x.role === "user");
  if (!m) return "";
  return (m.content as Array<{ type: string; text?: string }>).map((p) => p.text ?? "").join("\n");
}

export class MockLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = "v4" as const;
  readonly provider = "mock";
  readonly supportedUrls = {};
  constructor(readonly modelId: string) {}

  private usage(input: number, output: number): LanguageModelV4Usage {
    return {
      inputTokens: { total: input, noCache: input, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: output, text: output, reasoning: 0 },
    };
  }

  private answer(options: LanguageModelV4CallOptions): string {
    const text = firstUserText(options.prompt);
    const start = text.indexOf(SKELETON_OPEN);
    const end = text.indexOf(SKELETON_CLOSE);
    const body =
      start >= 0 && end > start
        ? text.slice(start + SKELETON_OPEN.length, end).trim()
        : 'root = Page(child=page_col)\npage_col = Column(children=[t])\nt = Heading(text="Página vazia")';
    const retry = lastUserText(options.prompt).startsWith("O compilador recusou");
    return `${retry ? "Corrigido." : "Reimaginei o rascunho mantendo a ordem dos blocos."}\n<a2ui>\n${body}\n</a2ui>`;
  }

  async doGenerate(options: LanguageModelV4CallOptions): Promise<LanguageModelV4GenerateResult> {
    const text = this.answer(options);
    return {
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage: this.usage(1200, Math.ceil(text.length / 4)),
      warnings: [],
    };
  }

  async doStream(options: LanguageModelV4CallOptions): Promise<LanguageModelV4StreamResult> {
    const text = this.answer(options);
    const usage = this.usage(1200, Math.ceil(text.length / 4));
    const stream = new ReadableStream<LanguageModelV4StreamPart>({
      start(controller) {
        controller.enqueue({ type: "stream-start", warnings: [] });
        controller.enqueue({ type: "text-start", id: "t0" });
        for (const chunk of text.match(/[\s\S]{1,40}/g) ?? []) controller.enqueue({ type: "text-delta", id: "t0", delta: chunk });
        controller.enqueue({ type: "text-end", id: "t0" });
        controller.enqueue({ type: "finish", finishReason: { unified: "stop", raw: undefined }, usage });
        controller.close();
      },
    });
    return { stream };
  }
}
