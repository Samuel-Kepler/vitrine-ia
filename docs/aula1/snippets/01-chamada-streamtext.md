# A chamada ao modelo com `streamText`

**Onde:** `src/app/api/chat/route.ts:36-58`

```ts
  let config;
  try {
    config = getModelConfig();
  } catch (error) {
    // Erro de configuração (provedor inválido ou chave ausente)
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
  const { provider, modelId, model } = config;
  console.log(`[chat] ${provider}/${modelId}`);

  const result = streamText({
    model,
    // System prompt. O providerOptions de cache só é lido pela Anthropic;
    // os outros provedores ignoram.
    instructions: {
      role: "system",
      content: generationPrompt,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    },
    messages: await convertToModelMessages(messages, { tools }),
    tools,
```

## O que está acontecendo

A rota `/api/chat` é uma rota HTTP comum do Next. Ela recebe as mensagens do chat, descobre qual modelo usar (`getModelConfig()`) e chama `streamText`.

`streamText` nada mais é do que "chama o modelo e me devolve a resposta **aos pedaços**, conforme ela vai sendo gerada". Em vez de esperar 40 segundos pela landing page inteira, a gente recebe pedacinho por pedacinho (*tokens*, ou seja, os pedaços de texto em que o modelo divide a resposta).

Repare que o código não sabe se o modelo é Claude, Gemini ou o mock: ele só recebe um `model`.

## Por que importa

Streaming muda a experiência: o usuário vê a IA trabalhando em 1 segundo, em vez de olhar uma tela parada. Em produto, isso é a diferença entre "travou?" e "uau".

> **Perceba:** O erro de configuração (chave faltando) vira um 500 com mensagem clara, antes de gastar qualquer token.
