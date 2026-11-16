# `toUIMessageStream` + resposta em stream

**Onde:** `src/app/api/chat/route.ts:75-79`

```ts
  const stream = toUIMessageStream({
    stream: result.stream,
    tools,
    originalMessages: messages,
    onEnd: async ({ messages: allMessages }) => {
```

**Onde:** `src/app/api/chat/route.ts:103-103`

```ts
  return createUIMessageStreamResponse({ stream });
```

## O que está acontecendo

O `streamText` produz eventos "crus" do modelo. O `toUIMessageStream` traduz esses eventos para o formato que a interface entende: pedaços de mensagem como `text-delta` (mais um pedaço de texto), `tool-input-available` (o modelo pediu uma ferramenta) e `tool-output-available` (a ferramenta respondeu).

`createUIMessageStreamResponse` embrulha tudo numa `Response` HTTP que fica aberta, mandando uma linha por evento (*Server-Sent Events*, ou seja, o servidor vai empurrando eventos pela mesma conexão).

O `onEnd` roda quando acaba: é ali que o projeto é salvo no banco.

## Por que importa

Dá para ver isso cru: abra o DevTools → Network → `/api/chat` e observe as linhas `data: {"type":"text-delta",...}` chegando. O teste `route.test.ts` lê exatamente essas linhas.

> **Perceba:** Salvar no `onEnd` garante que a gente persiste a conversa completa, inclusive o que o loop fez em todos os passos.
