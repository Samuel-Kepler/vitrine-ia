# Vendo a rede: do navegador até o modelo

Tem **duas viagens** HTTP em cada mensagem do chat. Dá para mostrar as duas na aula:

```
navegador ──POST /api/chat──▶ nosso servidor (Next) ──POST https://api.groq.com/...──▶ modelo
          ◀── stream (SSE) ──                       ◀──────── stream (SSE) ─────────
             viagem 1: DevTools                              viagem 2: AI_DEBUG=1
```

SSE (*Server-Sent Events*, ou seja, eventos enviados pelo servidor) é só uma resposta HTTP que não fecha: o servidor vai escrevendo linhas `data: {...}` e o navegador lê conforme chegam. É assim que o streaming funciona por baixo.

---

## Viagem 1 · Navegador ↔ nosso servidor (DevTools)

1. Abra o app, aperte `F12` (ou `Cmd+Option+I`) e vá na aba **Network**.
2. Filtre por `chat` e mande um prompt.
3. Clique na requisição `chat`:
   - **Payload**: o que o navegador mandou. As `messages` (o histórico inteiro da conversa) e os `files` (o sistema de arquivos virtual). O servidor não guarda nada entre uma mensagem e outra: o navegador manda tudo de novo.
   - **Response** (ou **EventStream**): o stream que o `toUIMessageStream` produz, um evento por linha:

```
data: {"type":"start-step"}
data: {"type":"tool-input-available","toolName":"str_replace_editor","input":{"command":"create","path":"/App.jsx",...}}
data: {"type":"finish-step"}
data: {"type":"text-delta","delta":"Vou"}
data: {"type":"text-delta","delta":" criar"}
```

**O que o aluno deve perceber:** a timeline da tela é só esses eventos desenhados. `tool-input-available` vira cartão, `start-step` vira "loop · passo N", `text-delta` vira texto aparecendo.

Para o Review, filtre por `review`: a resposta é **um JSON só**, não um stream. É o contraste da aula (texto livre em stream × objeto validado).

---

## Viagem 2 · Nosso servidor ↔ provedor (`AI_DEBUG=1`)

O DevTools não vê essa viagem: ela acontece no servidor. Para ver, rode:

```bash
npm run dev:debug
```

Cada requisição ao provedor vira duas linhas no terminal. Exemplo real com o Groq ("Crie um botão roxo com hover"):

```
[chat] groq/openai/gpt-oss-20b
[ai-debug] → #1 groq POST /openai/v1/chat/completions · openai/gpt-oss-20b · 2 mensagens · tools [str_replace_editor, file_manager] · tool_choice={"type":"function","function":{"name":"str_replace_editor"}} · 5,9 KB
[ai-debug] ← #1 200 em 0.7 s · 1º pedaço em 0.7 s · fim em 1.1 s · 142 eventos SSE · 41,5 KB
[ai-debug] → #2 groq POST /openai/v1/chat/completions · openai/gpt-oss-20b · 4 mensagens · tools [...] · tool_choice=auto · 7,1 KB
[ai-debug] ← #2 200 em 0.4 s · 1º pedaço em 0.4 s · fim em 0.7 s · 8 eventos SSE · 3,2 KB
[ai-debug] → #3 groq POST /openai/v1/chat/completions · openai/gpt-oss-20b · 6 mensagens · tools [...] · tool_choice=auto · 8,0 KB
[ai-debug] ← #3 200 em 0.4 s · 1º pedaço em 0.4 s · fim em 0.6 s · 39 eventos SSE · 10,5 KB
[chat] fim: stop · 3 passos · 456 tokens de saída
```

E os corpos completos ficam em `logs/ai/<data-hora>/`:

| Arquivo | O que tem |
|---|---|
| `001-groq-request.json` | o JSON exato que foi para o Groq: `model`, `messages`, `tools` (o schema das ferramentas), `tool_choice`, `max_tokens`, `stream` |
| `001-groq-response.sse.txt` | o stream cru que o Groq devolveu, pedaço por pedaço |

Os headers **não** são salvos (é onde vai a chave da API) e `logs/` está no `.gitignore`.

### O que mostrar nesses logs (a parte mais rica da aula)

1. **Uma mensagem no chat = várias requisições.** Três passos do loop, três `POST`. O "agente" nada mais é do que o nosso servidor chamando o modelo de novo enquanto ele pedir ferramentas.
2. **O modelo não tem memória (stateless, ou seja, sem estado).** Abra o `002-groq-request.json`: lá dentro estão o system prompt, o pedido do usuário, a tool call do passo 1 **e o resultado dela** (`"File created: /App.jsx"`). Tudo é reenviado a cada passo.
3. **Por isso o custo cresce:** 2 → 4 → 6 mensagens, 5,9 → 7,1 → 8,0 KB. Numa landing grande isso chega a dezenas de KB por passo, e é o que estoura os 8 mil tokens por minuto do Groq.
4. **A ferramenta é só JSON Schema.** Em `tools` aparece o `inputSchema` do zod convertido em JSON. É isso que o modelo "vê" da ferramenta: nome, descrição e campos.
5. **`tool_choice` forçado no passo 1** (o `prepareStep` da rota): só a 1ª requisição tem `{"name":"str_replace_editor"}`, as outras têm `auto`.
6. **Streaming de verdade:** no `.sse.txt` o texto chega em pedaços como `"delta":{"content":"Cr"}`. Compare com a viagem 1: o AI SDK traduziu o formato do Groq para o formato dele (`text-delta`). Troque para `AI_PROVIDER=anthropic` e o formato da viagem 2 muda (`content_block_delta`), mas o da viagem 1 continua igual. Essa é a vantagem de ter um SDK no meio.

### Onde está o código

- `src/lib/debug-fetch.ts`: todo provedor do AI SDK aceita um `fetch` próprio. Esse arquivo embrulha o `fetch` padrão: loga, duplica o stream da resposta (`tee`) para gravar uma cópia e devolve o original para o SDK.
- `src/lib/provider.ts`, função `buildModel`: liga o fetch de debug só quando `AI_DEBUG=1`.

> Dica para a demo: deixe o terminal e o DevTools lado a lado, e use um prompt pequeno ("Crie um botão roxo com hover") para os logs caberem na tela.
