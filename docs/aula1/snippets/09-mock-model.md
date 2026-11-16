# O "modelo" é só uma interface (mock)

**Onde:** `src/lib/mock-model.ts:26-31`

```ts
export class MockLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = "v4" as const;
  readonly provider = "mock";
  readonly modelId: string;
  readonly supportedUrls = {};
  // Tempo entre tokens. Os testes podem zerar para rodar rápido.
```

**Onde:** `src/lib/mock-model.ts:112-124`

```ts
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

```

## O que está acontecendo

O `MockLanguageModel` implementa a mesma interface que o Claude e o Gemini implementam (`LanguageModelV4`): um `doStream` que devolve partes tipadas (`text-delta`, `tool-call`, `finish`) e um `doGenerate` para quando não há stream.

Ele não tem nada de inteligente: conta quantas ferramentas já rodaram (`step`) e devolve o próximo passo de um roteiro fixo. Mesmo assim, o app inteiro funciona: streaming, loop, preview e até o Design Review.

## Por que importa

Desmonta o mistério: para a aplicação, um modelo nada mais é do que uma função que recebe mensagens e devolve pedaços tipados. Isso permite testar tudo sem chave e sem custo, inclusive no CI (o e2e do Playwright roda com o mock).

> **Perceba:** No `doGenerate`, quando o SDK pede JSON (`responseFormat.type === "json"`), o mock devolve um Design Review pronto. É assim que o structured output também funciona offline.
