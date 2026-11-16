// Modelo "fake" que implementa a interface LanguageModelV4 do AI SDK.
// Usado quando nenhuma chave de API está configurada: o app inteiro
// (streaming, tool calls, preview e Design Review) funciona sem chamar
// nenhum provedor.
// Didático: para a aplicação, um "modelo" é só um objeto que recebe um
// prompt e devolve partes tipadas (doStream) ou um resultado (doGenerate).
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4Prompt,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
  LanguageModelV4ToolCall,
  LanguageModelV4Usage,
} from "@ai-sdk/provider";

type Kind = "landing" | "card" | "form";

const COMPONENT: Record<Kind, string> = {
  landing: "Hero",
  card: "PricingCard",
  form: "ContactForm",
};

export class MockLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = "v4" as const;
  readonly provider = "mock";
  readonly modelId: string;
  readonly supportedUrls = {};
  // Tempo entre tokens. Os testes podem zerar para rodar rápido.
  tokenDelayMs: number;

  constructor(modelId: string, tokenDelayMs = Number(process.env.MOCK_TOKEN_DELAY_MS ?? 18)) {
    this.modelId = modelId;
    this.tokenDelayMs = tokenDelayMs;
  }

  private async delay(ms: number) {
    if (ms <= 0) return;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Simula o streaming de texto: text-start -> N x text-delta -> text-end
  // Envia por "palavra" para parecer um modelo de verdade.
  private async *streamText(text: string): AsyncGenerator<LanguageModelV4StreamPart> {
    const id = `text_${Math.random().toString(36).slice(2, 10)}`;
    yield { type: "text-start", id };
    for (const token of text.match(/\S+\s*|\s+/g) ?? []) {
      yield { type: "text-delta", id, delta: token };
      await this.delay(this.tokenDelayMs * 3);
    }
    yield { type: "text-end", id };
  }

  private usage(input: number, output: number): LanguageModelV4Usage {
    return {
      inputTokens: { total: input, noCache: input, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: output, text: output, reasoning: 0 },
    };
  }

  private extractUserPrompt(messages: LanguageModelV4Prompt): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role === "user") {
        const content = message.content as unknown;
        if (Array.isArray(content)) {
          return content
            .filter((part: { type: string }) => part.type === "text")
            .map((part: { text: string }) => part.text)
            .join(" ");
        } else if (typeof content === "string") {
          return content;
        }
      }
    }
    return "";
  }

  private kindFor(prompt: string): Kind {
    const p = prompt.toLowerCase();
    if (/landing|página|pagina|site/.test(p)) return "landing";
    if (p.includes("form") || p.includes("contato")) return "form";
    if (p.includes("card") || p.includes("preço") || p.includes("pricing")) return "card";
    return "landing";
  }

  private toolCall(id: string, input: object): LanguageModelV4StreamPart {
    return {
      type: "tool-call",
      toolCallId: id,
      toolName: "str_replace_editor",
      input: JSON.stringify(input),
    };
  }

  private finish(reason: "tool-calls" | "stop"): LanguageModelV4StreamPart {
    return {
      type: "finish",
      finishReason: { unified: reason, raw: undefined },
      usage: this.usage(120, 80),
    };
  }

  // O loop agêntico, encenado: o "passo" é o número de resultados de
  // ferramenta que já voltaram no histórico.
  private async *generateMockStream(
    messages: LanguageModelV4Prompt,
    userPrompt: string
  ): AsyncGenerator<LanguageModelV4StreamPart> {
    const step = messages.filter((m) => m.role === "tool").length;
    const kind = this.kindFor(userPrompt);
    const name = COMPONENT[kind];

    if (step === 0) {
      yield* this.streamText(
        `Modo demonstração (modelo mock, sem chave de API). Vou montar a estrutura começando pelo /App.jsx.`
      );
      yield this.toolCall("call_1", { command: "create", path: "/App.jsx", file_text: appCode(kind) });
      yield this.finish("tool-calls");
      return;
    }

    if (step === 1) {
      yield* this.streamText(`Agora o componente principal, ${name}, com animações de entrada.`);
      yield this.toolCall("call_2", {
        command: "create",
        path: `/components/${name}.jsx`,
        file_text: componentCode(kind),
      });
      yield this.finish("tool-calls");
      return;
    }

    if (step === 2) {
      yield* this.streamText(`Ajustando o CTA com uma micro-interação no hover.`);
      yield this.toolCall("call_3", {
        command: "str_replace",
        path: `/components/${name}.jsx`,
        old_str: REPLACE[kind][0],
        new_str: REPLACE[kind][1],
      });
      yield this.finish("tool-calls");
      return;
    }

    yield* this.streamText(
      `Pronto! Criei **/App.jsx** e **/components/${name}.jsx**. Configure \`AI_PROVIDER\` no \`.env\` para usar um modelo de verdade.`
    );
    yield this.finish("stop");
  }

  // Structured output: quando o SDK pede JSON (Output.object), devolvemos
  // um Design Review determinístico baseado nos arquivos do prompt.
  private mockReview(options: LanguageModelV4CallOptions): string {
    const promptText = JSON.stringify(options.prompt);
    const files = [...promptText.matchAll(/### FILE: (\/[^\s\\]+)/g)].map((m) => m[1]);
    const main = files.find((f) => f.startsWith("/components/")) ?? files[0] ?? "/App.jsx";
    const app = files.includes("/App.jsx") ? "/App.jsx" : main;
    const slug = (f: string) => f.split("/").pop()!.replace(/\.\w+$/, "").toLowerCase();

    return JSON.stringify({
      score: 78,
      summary:
        "Boa hierarquia e animações de entrada consistentes. Faltam estados de foco nos botões, o subtítulo tem contraste baixo e não há estado de carregamento.",
      issues: [
        {
          id: `${slug(main)}-cta-no-focus`,
          title: "CTA principal sem estado de foco visível",
          file: main,
          severity: "high",
          rule: "accessibility",
          suggestion:
            "Adicione `focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300` ao botão principal para quem navega por teclado.",
        },
        {
          id: `${slug(main)}-subtitle-low-contrast`,
          title: "Subtítulo do hero com contraste baixo",
          file: main,
          severity: "medium",
          rule: "color",
          suggestion: "Troque `text-stone-400` por `text-stone-600` no parágrafo abaixo do título.",
        },
        {
          id: `${slug(app)}-no-loading-state`,
          title: "Página sem estado de carregamento",
          file: app,
          severity: "low",
          rule: "empty-loading-states",
          suggestion:
            "Mostre um skeleton com `animate-shimmer` enquanto o cardápio carrega, em vez de uma área vazia.",
        },
      ],
    });
  }

  async doGenerate(options: LanguageModelV4CallOptions): Promise<LanguageModelV4GenerateResult> {
    if (options.responseFormat?.type === "json") {
      await this.delay(this.tokenDelayMs * 40);
      return {
        content: [{ type: "text", text: this.mockReview(options) }],
        finishReason: { unified: "stop", raw: undefined },
        usage: this.usage(800, 300),
        warnings: [],
      };
    }

    const userPrompt = this.extractUserPrompt(options.prompt);
    const parts: LanguageModelV4StreamPart[] = [];
    for await (const part of this.generateMockStream(options.prompt, userPrompt)) {
      parts.push(part);
    }

    const text = parts
      .filter((p) => p.type === "text-delta")
      .map((p) => (p as { delta: string }).delta)
      .join("");
    const toolCalls = parts.filter((p): p is LanguageModelV4ToolCall => p.type === "tool-call");
    const finish = parts.find((p) => p.type === "finish") as
      | Extract<LanguageModelV4StreamPart, { type: "finish" }>
      | undefined;

    return {
      content: [...(text ? [{ type: "text" as const, text }] : []), ...toolCalls],
      finishReason: finish?.finishReason ?? { unified: "stop", raw: undefined },
      usage: finish?.usage ?? this.usage(100, 200),
      warnings: [],
    };
  }

  async doStream(options: LanguageModelV4CallOptions): Promise<LanguageModelV4StreamResult> {
    const userPrompt = this.extractUserPrompt(options.prompt);
    const generator = this.generateMockStream(options.prompt, userPrompt);

    const stream = new ReadableStream<LanguageModelV4StreamPart>({
      async start(controller) {
        try {
          controller.enqueue({ type: "stream-start", warnings: [] });
          for await (const chunk of generator) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return { stream };
  }
}

// ---------------------------------------------------------------------------
// Código "gerado" pelo mock. Sem imagens externas, para o e2e ser estável.

function appCode(kind: Kind): string {
  const name = COMPONENT[kind];
  if (kind === "landing") {
    return `import Hero from '@/components/Hero';

export default function App() {
  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <Hero />
    </main>
  );
}`;
  }
  return `import ${name} from '@/components/${name}';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-sky-50 flex items-center justify-center p-8">
      <${name} />
    </div>
  );
}`;
}

const REPLACE: Record<Kind, [string, string]> = {
  landing: [
    `className="rounded-full bg-amber-500 px-7 py-3 font-semibold text-white shadow-lg"`,
    `className="rounded-full bg-amber-500 px-7 py-3 font-semibold text-white shadow-lg shadow-amber-500/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-amber-600 hover:shadow-xl active:scale-95"`,
  ],
  card: [
    `className="w-full rounded-full bg-violet-600 py-3 font-semibold text-white"`,
    `className="w-full rounded-full bg-violet-600 py-3 font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-xl active:scale-95"`,
  ],
  form: [
    `className="w-full rounded-full bg-sky-600 py-3 font-semibold text-white"`,
    `className="w-full rounded-full bg-sky-600 py-3 font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-sky-700 hover:shadow-xl active:scale-95"`,
  ],
};

function componentCode(kind: Kind): string {
  if (kind === "card") {
    return `const features = ['Agenda online ilimitada', 'Lembretes por WhatsApp', 'Relatório mensal'];

export default function PricingCard() {
  return (
    <div className="w-full max-w-sm animate-scale-in rounded-3xl border border-violet-100 bg-white p-8 shadow-2xl shadow-violet-200/50">
      <span className="inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-violet-700">Mais escolhido</span>
      <h2 className="mt-4 text-2xl font-black tracking-tight">Plano Studio</h2>
      <p className="mt-1 text-stone-500">Para salões e estúdios com até 5 profissionais.</p>
      <p className="mt-6 text-5xl font-black">R$ 89<span className="text-lg font-medium text-stone-400">/mês</span></p>
      <ul className="mt-6 space-y-3">
        {features.map((f, i) => (
          <li key={f} className="flex animate-fade-up items-center gap-3" style={{ animationDelay: \`\${200 + i * 120}ms\` }}>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-violet-600 text-xs text-white">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <button className="w-full rounded-full bg-violet-600 py-3 font-semibold text-white">Assinar agora</button>
    </div>
  );
}`;
  }
  if (kind === "form") {
    return `import { useState } from 'react';

export default function ContactForm() {
  const [sent, setSent] = useState(false);
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setSent(true); }}
      className="w-full max-w-md animate-fade-up space-y-4 rounded-3xl bg-white p-8 shadow-2xl"
    >
      <h2 className="text-3xl font-black tracking-tight">Fale com a gente</h2>
      <p className="text-stone-500">Respondemos em até 2 horas no horário comercial.</p>
      <input required placeholder="Seu nome" className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-4 focus:ring-sky-100" />
      <input required type="email" placeholder="seu@email.com" className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-4 focus:ring-sky-100" />
      <textarea rows={4} placeholder="Como podemos ajudar?" className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-4 focus:ring-sky-100" />
      <button className="w-full rounded-full bg-sky-600 py-3 font-semibold text-white">{sent ? 'Enviado! ✓' : 'Enviar mensagem'}</button>
    </form>
  );
}`;
  }
  return `const menu = [
  { name: 'Espresso da Casa', price: 'R$ 7', note: 'Blend 100% arábica do Sul de Minas' },
  { name: 'Cappuccino Aurora', price: 'R$ 14', note: 'Com canela e cacau 70%' },
  { name: 'Pão de Queijo', price: 'R$ 9', note: 'Saindo do forno a cada 30 min' },
];

export default function Hero() {
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100 bg-[length:200%_200%] animate-gradient-x">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-amber-300/40 blur-3xl animate-float" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-rose-300/40 blur-3xl animate-float [animation-delay:2s]" />
        <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <span className="text-xl font-black tracking-tight">☕ Café Aurora</span>
          <a href="#menu" className="rounded-full bg-white/70 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white">Cardápio</a>
        </nav>
        <div className="relative mx-auto max-w-6xl px-6 pb-28 pt-16">
          <p className="animate-fade-up text-sm font-bold uppercase tracking-[0.2em] text-amber-700">Torrefação própria · Vila Madalena</p>
          <h1 className="mt-4 max-w-3xl animate-fade-up text-5xl font-black leading-[1.05] tracking-tight md:text-7xl [animation-delay:150ms]">
            O café que faz a sua manhã começar <span className="bg-gradient-to-r from-amber-600 to-rose-500 bg-clip-text text-transparent">devagar.</span>
          </h1>
          <p className="mt-6 max-w-xl animate-fade-up text-lg text-stone-400 [animation-delay:300ms]">
            Grãos torrados toda semana, pão de queijo saindo do forno e um cantinho para trabalhar com calma.
          </p>
          <div className="mt-10 flex animate-fade-up gap-4 [animation-delay:450ms]">
            <button className="rounded-full bg-amber-500 px-7 py-3 font-semibold text-white shadow-lg">Reservar mesa</button>
            <a href="#menu" className="rounded-full border border-stone-300 px-7 py-3 font-semibold transition hover:bg-white/60">Ver cardápio</a>
          </div>
        </div>
      </section>
      <section id="menu" className="mx-auto grid max-w-6xl gap-6 px-6 py-20 md:grid-cols-3">
        {menu.map((item, i) => (
          <article
            key={item.name}
            className="animate-fade-up rounded-3xl border border-stone-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            style={{ animationDelay: \`\${600 + i * 150}ms\` }}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="text-xl font-bold">{item.name}</h3>
              <span className="font-black text-amber-600">{item.price}</span>
            </div>
            <p className="mt-2 text-stone-500">{item.note}</p>
          </article>
        ))}
      </section>
    </>
  );
}`;
}
