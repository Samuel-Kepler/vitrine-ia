// Gera docs/aula1/snippets/*.md com o trecho REAL do código + explicação.
// Os trechos são localizados por âncora (texto), então se o código mudar
// basta rodar de novo:  node scripts/build-snippets.mjs
import fs from "node:fs";
import path from "node:path";

const OUT = "docs/aula1/snippets";
fs.mkdirSync(OUT, { recursive: true });

// Encontra a linha que contém `anchor` (a partir de `after`, opcional) e devolve N linhas.
function block(file, anchor, count, after) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const from = after ? lines.findIndex((l) => l.includes(after)) : 0;
  const idx = lines.findIndex((l, i) => i >= from && l.includes(anchor));
  if (idx < 0) throw new Error(`Âncora não encontrada em ${file}: ${anchor}`);
  const code = lines.slice(idx, idx + count);
  const ext = path.extname(file).slice(1).replace("mjs", "js");
  return {
    ref: `\`${file}:${idx + 1}-${idx + count}\``,
    md: "```" + (ext === "tsx" ? "tsx" : "ts") + "\n" + code.join("\n") + "\n```",
  };
}

const snippets = [
  {
    file: "01-chamada-streamtext.md",
    title: "A chamada ao modelo com `streamText`",
    blocks: [block("src/app/api/chat/route.ts", "let config;", 23)],
    what: `A rota \`/api/chat\` é uma rota HTTP comum do Next. Ela recebe as mensagens do chat, descobre qual modelo usar (\`getModelConfig()\`) e chama \`streamText\`.

\`streamText\` nada mais é do que "chama o modelo e me devolve a resposta **aos pedaços**, conforme ela vai sendo gerada". Em vez de esperar 40 segundos pela landing page inteira, a gente recebe pedacinho por pedacinho (*tokens*, ou seja, os pedaços de texto em que o modelo divide a resposta).

Repare que o código não sabe se o modelo é Claude, Gemini ou o mock: ele só recebe um \`model\`.`,
    why: `Streaming muda a experiência: o usuário vê a IA trabalhando em 1 segundo, em vez de olhar uma tela parada. Em produto, isso é a diferença entre "travou?" e "uau".`,
    notice: `O erro de configuração (chave faltando) vira um 500 com mensagem clara, antes de gastar qualquer token.`,
  },
  {
    file: "02-system-prompt-e-cache.md",
    title: "System prompt (`instructions`) + cache",
    blocks: [
      block("src/app/api/chat/route.ts", "instructions: {", 7),
      block("src/lib/prompts/generation.tsx", "export const generationPrompt", 10),
    ],
    what: `O *system prompt* (instruções do sistema) é o texto que vai **antes** de toda conversa. É o "contrato do produto": quem a IA é, o que pode fazer, que padrão de qualidade seguir. O usuário nunca vê esse texto, mas ele pesa em toda resposta.

No AI SDK 7 ele vai no campo \`instructions\`. O \`providerOptions.anthropic.cacheControl\` pede para a Anthropic **guardar esse começo em cache** (*prompt caching*): como o system prompt é igual em toda chamada, as próximas leem do cache, mais rápido e mais barato. Os outros provedores simplesmente ignoram essa opção.`,
    why: `O produto "Vitrine" existe por causa desse texto. Trocar "componentes React" por "landing pages animadas para pequenos negócios", e listar as classes de animação que o preview aceita, foi o que fez a saída ficar vendável. Mesmo modelo, outro prompt, outro produto.`,
    notice: `O prompt cita classes como \`animate-fade-up\`, que só existem porque o preview (\`jsx-transformer.ts\`) as define. O prompt é o contrato entre o modelo e o resto do sistema.`,
  },
  {
    file: "03-tool-com-inputschema.md",
    title: "Uma ferramenta (*tool*) com `inputSchema`",
    blocks: [
      block("src/lib/tools/str-replace.ts", "const TextEditorInput", 5),
      block("src/lib/tools/str-replace.ts", "export const buildStrReplaceTool", 23),
    ],
    what: `Uma *tool* (ferramenta) nada mais é do que uma função sua que o modelo pode pedir para rodar. Ela tem três partes:

1. \`description\`: texto que explica ao modelo para que ela serve (sim, é prompt também).
2. \`inputSchema\`: um schema zod com os argumentos. O SDK transforma isso em JSON Schema e manda para o modelo, que devolve os argumentos nesse formato.
3. \`execute\`: o código que roda **no servidor** quando o modelo chama a ferramenta.

O modelo não executa nada. Ele só escreve "quero chamar \`str_replace_editor\` com \`{ command: "create", path: "/App.jsx", ... }\`". Quem executa é o seu código.`,
    why: `É assim que a IA sai do "texto" e passa a **agir** num sistema: criar arquivo, consultar banco, mandar e-mail. E o \`.describe()\` de cada campo é contexto que melhora a chance de o modelo acertar os argumentos.`,
    notice: `O arquivo é criado num sistema de arquivos **virtual** (memória), nunca no disco do servidor.`,
  },
  {
    file: "04-loop-agentico-stopwhen.md",
    title: "O loop agêntico com `stopWhen`",
    blocks: [block("src/app/api/chat/route.ts", "messages: await convertToModelMessages", 16)],
    what: `Loop agêntico: a IA lê o pedido, chama uma ferramenta, **olha o resultado** e decide o próximo passo, repetindo até terminar. Cada volta é um *step* (passo).

Quem faz o loop é o SDK: depois que as ferramentas rodam, ele chama o modelo de novo, já com os resultados. O \`stopWhen: isStepCount(40)\` é o freio: no máximo 40 voltas. Sem freio, um modelo confuso pode ficar girando e gastando token.

O \`onFinish\` loga por que parou (\`stop\`, \`length\`...), quantos passos e quantos tokens saíram.`,
    why: `Na timeline da UI cada "loop · passo N" é uma volta dessas. No print 05 o Haiku criou 6 arquivos no passo 1 e, no passo 2, **corrigiu sozinho** um \`style\` inline que violava o system prompt. Isso é o loop: agir, olhar, corrigir.`,
    notice: `Bug real que apareceu preparando esta aula: com \`maxOutputTokens: 10_000\`, uma landing completa estourava o limite (\`finishReason: "length"\`) e o loop parava no meio, com os arquivos pela metade. O log do \`onFinish\` mostrou ~11.700 tokens. Subimos para 32.000. A lição é olhar o motivo de parada.`,
  },
  {
    file: "05-resposta-em-stream.md",
    title: "`toUIMessageStream` + resposta em stream",
    blocks: [
      block("src/app/api/chat/route.ts", "const stream = toUIMessageStream", 5),
      block("src/app/api/chat/route.ts", "return createUIMessageStreamResponse", 1),
    ],
    what: `O \`streamText\` produz eventos "crus" do modelo. O \`toUIMessageStream\` traduz esses eventos para o formato que a interface entende: pedaços de mensagem como \`text-delta\` (mais um pedaço de texto), \`tool-input-available\` (o modelo pediu uma ferramenta) e \`tool-output-available\` (a ferramenta respondeu).

\`createUIMessageStreamResponse\` embrulha tudo numa \`Response\` HTTP que fica aberta, mandando uma linha por evento (*Server-Sent Events*, ou seja, o servidor vai empurrando eventos pela mesma conexão).

O \`onEnd\` roda quando acaba: é ali que o projeto é salvo no banco.`,
    why: `Dá para ver isso cru: abra o DevTools → Network → \`/api/chat\` e observe as linhas \`data: {"type":"text-delta",...}\` chegando. O teste \`route.test.ts\` lê exatamente essas linhas.`,
    notice: `Salvar no \`onEnd\` garante que a gente persiste a conversa completa, inclusive o que o loop fez em todos os passos.`,
  },
  {
    file: "06-usechat-e-transport.md",
    title: "`useChat` + `DefaultChatTransport` no cliente",
    blocks: [block("src/lib/contexts/chat-context.tsx", "const [input, setInput]", 31)],
    what: `No navegador, o hook \`useChat\` cuida da conversa: guarda as mensagens, mostra o \`status\` (\`submitted\` → \`streaming\` → \`ready\`) e vai montando a mensagem do assistente conforme os eventos chegam.

O *transport* (\`DefaultChatTransport\`) diz **para onde** mandar: \`/api/chat\`. E o \`sendMessage(..., { body })\` manda junto o que a rota precisa além do texto: o estado atual dos arquivos e o id do projeto.`,
    why: `O input é estado da aplicação (\`useState\`), não do SDK. Isso deixa a gente controlar o envio, como no \`sendText\`, que os prompts de exemplo clicáveis usam e que bloqueia envio duplo enquanto o modelo ainda responde.`,
    notice: `O FS virtual vai no body a cada mensagem: o servidor não guarda estado entre chamadas. O modelo também não (*stateless*, ou seja, sem memória): tudo que ele "lembra" é o que a gente manda.`,
  },
  {
    file: "07-ontoolcall-aplica-no-fs.md",
    title: "`onToolCall`: aplicando a tool call no FS do cliente",
    blocks: [
      block("src/lib/contexts/chat-context.tsx", "onToolCall:", 3),
      block("src/lib/contexts/file-system-context.tsx", "const handleToolCall = useCallback", 17),
    ],
    what: `A ferramenta roda no servidor, num FS virtual temporário. Mas o preview está no navegador. Como o arquivo chega lá?

Cada vez que o stream traz uma tool call, o \`useChat\` chama \`onToolCall\`. A gente repete a mesma operação no FS do navegador (\`createFileWithParents\`, \`replaceInFile\`...). O FS muda, o \`refreshTrigger\` muda, e o iframe do preview re-renderiza.`,
    why: `É por isso que o preview aparece **enquanto** a IA ainda trabalha, arquivo por arquivo. O mesmo evento alimenta a timeline animada e o preview.`,
    notice: `Servidor e cliente aplicam a mesma operação nos dois lados. Se divergirem, o próximo pedido manda o estado do cliente (snippet 06), que vira a verdade.`,
  },
  {
    file: "08-provider-registry.md",
    title: "Um ponto só para escolher o provedor (`provider.ts`)",
    blocks: [block("src/lib/provider.ts", "function buildModel", 20)],
    what: `Toda a aplicação fala com a interface \`LanguageModel\` do AI SDK. Cada pacote \`@ai-sdk/*\` (anthropic, google, groq) e o \`@openrouter/ai-sdk-provider\` sabe traduzir essa interface para a API do seu provedor.

\`getModelConfig()\` lê \`AI_PROVIDER\` e \`AI_MODEL\` do \`.env\` e devolve o modelo pronto. Sem \`AI_PROVIDER\`, usa o primeiro provedor com chave; sem nenhuma chave, cai no mock.`,
    why: `Trocar de Claude para Gemini (free tier) é **mudar uma linha do \`.env\`** e recarregar. Nenhum outro arquivo muda. O badge no topo da UI mostra qual está ativo (print 10 → 11).`,
    notice: `Free tiers mudam toda hora. Por isso \`AI_MODEL\` existe: se o modelo padrão sair do catálogo, troque sem mexer em código.`,
  },
  {
    file: "09-mock-model.md",
    title: "O \"modelo\" é só uma interface (mock)",
    blocks: [
      block("src/lib/mock-model.ts", "export class MockLanguageModel", 6),
      block("src/lib/mock-model.ts", "const step = messages.filter", 13),
    ],
    what: `O \`MockLanguageModel\` implementa a mesma interface que o Claude e o Gemini implementam (\`LanguageModelV4\`): um \`doStream\` que devolve partes tipadas (\`text-delta\`, \`tool-call\`, \`finish\`) e um \`doGenerate\` para quando não há stream.

Ele não tem nada de inteligente: conta quantas ferramentas já rodaram (\`step\`) e devolve o próximo passo de um roteiro fixo. Mesmo assim, o app inteiro funciona: streaming, loop, preview e até o Design Review.`,
    why: `Desmonta o mistério: para a aplicação, um modelo nada mais é do que uma função que recebe mensagens e devolve pedaços tipados. Isso permite testar tudo sem chave e sem custo, inclusive no CI (o e2e do Playwright roda com o mock).`,
    notice: `No \`doGenerate\`, quando o SDK pede JSON (\`responseFormat.type === "json"\`), o mock devolve um Design Review pronto. É assim que o structured output também funciona offline.`,
  },
  {
    file: "10-structured-output-review.md",
    title: "Structured output: `Output.object` + schema zod do Review",
    blocks: [
      block("src/lib/review/schema.ts", "export const ReviewIssue", 15),
      block("src/lib/review/review.ts", "export async function runDesignReview", 18),
    ],
    what: `O chat devolve **texto livre** em stream. O Design Review devolve **um objeto**: \`{ score, summary, issues[] }\`.

\`generateText\` com \`output: Output.object({ schema })\` faz duas coisas: pede ao provedor uma resposta em JSON seguindo o schema e **valida** a resposta com zod. Se o modelo inventar uma severidade \`"critical"\` ou esquecer o \`file\`, a chamada falha em vez de entregar lixo para a tela.

(\`generateObject\` era o jeito antigo e está *deprecated*, ou seja, marcado para sair.)`,
    why: `Esse é o salto de "chatbot" para "IA dentro de sistema". Com um objeto validado, a aplicação pode desenhar um anel de score, ordenar issues por severidade e até abrir issues no GitHub com \`reviewToIssues\` (Aula 2). Texto livre não dá para integrar com segurança.`,
    notice: `O mesmo schema valida em três lugares: na rota (via SDK), no cliente (\`DesignReview.parse\` no \`review-context.tsx\`) e no teste e2e. O schema é o contrato.`,
  },
  {
    file: "11-renderizando-parts.md",
    title: "Renderizando as `parts` da mensagem (a timeline)",
    blocks: [block("src/components/chat/MessageList.tsx", "const lastTextIndex", 26)],
    what: `No AI SDK 7, uma mensagem não é uma string: é uma lista de \`parts\` (partes) em ordem. Pode ser \`text\`, \`reasoning\` (o raciocínio do modelo, quando o provedor manda), uma tool call (\`tool-str_replace_editor\`) ou \`step-start\` (começou uma nova volta do loop).

A timeline é só um \`map\` nessa lista, decidindo o desenho de cada tipo. A tool call vira "criando /App.jsx" via \`toolPartToStep\`, uma função pura e testada que olha o \`state\` da parte (\`input-streaming\`, \`output-available\`...).`,
    why: `É isso que deixa o loop **visível** para o aluno: cada parte que chega no stream vira um nó animado. Nenhuma mágica, só renderizar o que o SDK já entrega.`,
    notice: `O texto que ainda está chegando é dividido em \`<span>\` por pedaço, cada um com uma animação de entrada. O React só monta os spans novos, então só os pedaços novos animam.`,
  },
  {
    file: "12-review-to-issues.md",
    title: "Bônus: `reviewToIssues`, a ponte para a Aula 2",
    blocks: [block("src/lib/review/schema.ts", "export function reviewToIssues", 20)],
    what: `Função pura (mesma entrada, mesma saída, sem efeito colateral) que transforma o review em rascunhos de issue do GitHub: \`{ title, body, labels }\`, com labels \`design-review\` e \`severity:<x>\`.

O botão "issues" no painel do review copia exatamente esse resultado.`,
    why: `Na Aula 2, um agente vai ler essas issues, corrigir o código e abrir PR. O structured output de hoje vira o **gatilho** do loop de amanhã.`,
    notice: `O comentário \`design-review-id\` no corpo da issue usa o \`id\` estável do review, o que permite saber se aquela issue já foi aberta antes.`,
  },
];

for (const s of snippets) {
  const parts = [
    `# ${s.title}`,
    "",
    ...s.blocks.flatMap((b) => [`**Onde:** ${b.ref}`, "", b.md, ""]),
    "## O que está acontecendo",
    "",
    s.what,
    "",
    "## Por que importa",
    "",
    s.why,
    "",
    `> **Perceba:** ${s.notice}`,
    "",
  ];
  fs.writeFileSync(path.join(OUT, s.file), parts.join("\n"));
  console.log("ok", s.file, s.blocks.map((b) => b.ref).join(" "));
}
