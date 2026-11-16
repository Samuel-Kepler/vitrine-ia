# A chamada ao modelo com `streamText`

**Onde:** `src/app/api/chat/route.ts:37-59`

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

  // Projeto vazio = o usuário quer criar algo. Modelos abertos (ex.: gpt-oss
  // no Groq) às vezes "respondem" colando o código no chat em vez de chamar
  // a ferramenta, e aí nenhum arquivo é criado. Nesses provedores, o 1º passo
  // é obrigado a usar a ferramenta. O Haiku segue o prompt sozinho e ainda
  // escreve a frase de abertura em stream, então deixamos livre.
  const isNewProject = !fileSystem.getNode("/")?.children?.size;
  const forceFirstTool = isNewProject && provider !== "anthropic" && provider !== "mock";

  const result = streamText({
    model,
    // System prompt. O providerOptions de cache só é lido pela Anthropic;
    // os outros provedores ignoram.
    instructions: {
```

## O que está acontecendo

A rota `/api/chat` é uma rota HTTP comum do Next. Ela recebe as mensagens do chat, descobre qual modelo usar (`getModelConfig()`) e chama `streamText`.

`streamText` nada mais é do que "chama o modelo e me devolve a resposta **aos pedaços**, conforme ela vai sendo gerada". Em vez de esperar 40 segundos pela landing page inteira, a gente recebe pedacinho por pedacinho (*tokens*, ou seja, os pedaços de texto em que o modelo divide a resposta).

Repare que o código não sabe se o modelo é Claude, Gemini ou o mock: ele só recebe um `model`.

## Por que importa

Streaming muda a experiência: o usuário vê a IA trabalhando em 1 segundo, em vez de olhar uma tela parada. Em produto, isso é a diferença entre "travou?" e "uau".

> **Perceba:** O erro de configuração (chave faltando) vira um 500 com mensagem clara, antes de gastar qualquer token.
