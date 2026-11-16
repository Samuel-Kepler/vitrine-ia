# Um ponto só para escolher o provedor (`provider.ts`)

**Onde:** `src/lib/provider.ts:72-91`

```ts
function buildModel(provider: ProviderId, modelId: string): LanguageModel {
  switch (provider) {
    case "anthropic":
      return anthropic(modelId);
    case "google":
      return google(modelId);
    case "groq":
      return groq(modelId);
    case "openrouter":
      return createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })(modelId);
    case "mock":
      return new MockLanguageModel(modelId);
  }
}

export function getModelConfig(): ModelConfig {
  const provider = resolveProvider();
  const modelId = process.env.AI_MODEL?.trim() || DEFAULT_MODELS[provider];
  return { provider, modelId, model: buildModel(provider, modelId) };
}
```

## O que está acontecendo

Toda a aplicação fala com a interface `LanguageModel` do AI SDK. Cada pacote `@ai-sdk/*` (anthropic, google, groq) e o `@openrouter/ai-sdk-provider` sabe traduzir essa interface para a API do seu provedor.

`getModelConfig()` lê `AI_PROVIDER` e `AI_MODEL` do `.env` e devolve o modelo pronto. Sem `AI_PROVIDER`, usa o primeiro provedor com chave; sem nenhuma chave, cai no mock.

## Por que importa

Trocar de Claude para Gemini (free tier) é **mudar uma linha do `.env`** e recarregar. Nenhum outro arquivo muda. O badge no topo da UI mostra qual está ativo (print 10 → 11).

> **Perceba:** Free tiers mudam toda hora. Por isso `AI_MODEL` existe: se o modelo padrão sair do catálogo, troque sem mexer em código.
