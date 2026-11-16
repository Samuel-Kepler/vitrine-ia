# Aula 1 · IA dentro da aplicação: streaming, system prompt e structured output

Projeto: **Vitrine**, o uigen turbinado. Um gerador de landing pages animadas para pequenos negócios (cafeteria, salão, personal, pizzaria). A pessoa descreve o negócio, a IA cria os arquivos React em loop e o preview aparece ao vivo. Depois, um **Design Review** devolve um objeto validado com score e issues.

A pergunta que atravessa a aula: **o que está acontecendo por baixo, e como eu sei que está certo?**

- Prints: [`screens/`](screens) (2880×1800, Haiku real salvo onde não diz o contrário)
- GIFs e vídeos: [`gifs/`](gifs) (cada `.gif` tem um `.mp4` mais leve para slide)
- Snippets: [`snippets/`](snippets) (código real com caminho e linha + explicação)
- Como regerar tudo: [final deste arquivo](#como-regerar-o-material)

---

## Ordem de apresentação

| # | Visual | Snippet | O que o aluno deve perceber aqui |
|---|---|---|---|
| 1 | [`01-app-vazio.png`](screens/01-app-vazio.png) | – | É um produto, não um CRUD. Badge no topo: **anthropic · claude-haiku-5-5** (lembre dele no passo 10). |
| 2 | [`02-prompt.png`](screens/02-prompt.png) | [06 · useChat + transport](snippets/06-usechat-e-transport.md) | O prompt sai do navegador por um `POST /api/chat` comum, junto com o estado dos arquivos. |
| 3 | [`01-streaming.gif`](gifs/01-streaming.gif) · [`03-streaming.png`](screens/03-streaming.png) · [`03b-streaming-token-a-token.png`](screens/03b-streaming-token-a-token.png) | [01 · streamText](snippets/01-chamada-streamtext.md) · [05 · resposta em stream](snippets/05-resposta-em-stream.md) | A resposta chega **aos pedaços**. Com o Haiku os pedaços são grandes (a frase inteira em ~0,5 s); no mock (03b) chega palavra por palavra. Pedaço de stream ≠ palavra: cada provedor decide o tamanho. |
| 4 | – (mostre o arquivo) | [02 · system prompt + cache](snippets/02-system-prompt-e-cache.md) | O produto "Vitrine" é **um texto**. Mesmo modelo, outro system prompt, outro produto. O cache deixa esse texto mais barato a partir da 2ª chamada. |
| 5 | [`04-timeline-tools.png`](screens/04-timeline-tools.png) · [`02-timeline-loop.gif`](gifs/02-timeline-loop.gif) | [03 · tool com inputSchema](snippets/03-tool-com-inputschema.md) | O modelo **não executa nada**: ele pede "chama `str_replace_editor` com estes argumentos". Quem executa é o nosso código. Cada cartão da timeline é um pedido desses. |
| 6 | [`05-preview.png`](screens/05-preview.png) | [04 · loop com stopWhen](snippets/04-loop-agentico-stopwhen.md) · [07 · onToolCall](snippets/07-ontoolcall-aplica-no-fs.md) | "loop · passo 2": o modelo olhou o próprio resultado e **corrigiu sozinho** um `style` inline que violava o system prompt. Isso é o loop: agir, olhar, corrigir. O preview foi aparecendo arquivo por arquivo. |
| 7 | [`06-codigo-gerado.png`](screens/06-codigo-gerado.png) | [11 · renderizando parts](snippets/11-renderizando-parts.md) | Os arquivos existem só na memória (FS virtual). A timeline é só um `map` nas `parts` da mensagem. |
| 8 | [`07-review-carregando.png`](screens/07-review-carregando.png) → [`03-review.gif`](gifs/03-review.gif) → [`08-review-resultado.png`](screens/08-review-resultado.png) | [10 · Output.object + schema](snippets/10-structured-output-review.md) | **O contraste da aula.** O chat devolve texto livre em stream; o review devolve um **objeto** que a interface consome: anel de score, badge de severidade, arquivo, regra. |
| 9 | [`09-review-json.png`](screens/09-review-json.png) | [12 · reviewToIssues](snippets/12-review-to-issues.md) | O botão "JSON" mostra o objeto cru, validado com zod. Como é objeto, vira issue do GitHub com uma função pura → gancho para a Aula 2. |
| 10 | [`10-troca-provedor-env.png`](screens/10-troca-provedor-env.png) | [08 · provider.ts](snippets/08-provider-registry.md) | Trocar de provedor é **uma linha no `.env`**. Nenhum arquivo de código muda. (Este print é uma ilustração renderizada com as chaves mascaradas; o log do Gemini é ilustrativo, não foi rodado.) |
| 11 | [`11-outro-provedor-badge.png`](screens/11-outro-provedor-badge.png) → [`12-outro-provedor-fluxo.png`](screens/12-outro-provedor-fluxo.png) → [`13-outro-provedor-review.png`](screens/13-outro-provedor-review.png) | [09 · mock model](snippets/09-mock-model.md) | Mesmo fluxo, outro badge: **mock · mock-uigen**. Um "modelo" nada mais é do que um objeto com `doStream`/`doGenerate`. Por isso o CI testa tudo sem chave. |
| 12 | [`14-erro-chave-ausente.png`](screens/14-erro-chave-ausente.png) | [01 · streamText](snippets/01-chamada-streamtext.md) (bloco do `try/catch`) | Mostre falhando: `AI_PROVIDER=groq` sem `GROQ_API_KEY`. Badge vermelho + mensagem clara, antes de gastar token. |
| – | [`00-fluxo-completo.gif`](gifs/00-fluxo-completo.gif) | – | Resumo de 8 s do fluxo inteiro (10× mais rápido). Bom para abertura ou fechamento. |

### Onde a demo pode dar errado (e virar lição)

- **O modelo usa um ícone que não existe** (`Instagram` do `lucide-react`): o preview mostra "Failed to load app". Aconteceu preparando a aula. A correção foi **uma linha no system prompt**, não no código. Corrige o contexto, não xinga o modelo.
- **Landing grande demais**: com `maxOutputTokens` baixo o loop para no meio (`finishReason: "length"`) e a timeline mostra os passos como "interrompido". O log `[chat] fim: ... tokens de saída` no terminal mostra o porquê.
- **Plano B**: se a internet ou a cota cair, `AI_PROVIDER=mock` no `.env` e o fluxo inteiro continua funcionando (prints 11–13).

### Ângulo freelancer (fechamento)

O que foi vendido na tela: landing page animada + revisão de qualidade automática. O que o freela entrega ao cliente pequeno: a página pronta (exporta o código), uma rodada de review e ajustes. Custo de IA por landing com Haiku: ~12 mil tokens de saída (veja o log). Com o free tier do Gemini/Groq, o custo de IA é zero para começar.

---

## Exercício guiado (no fork de vocês)

Pré-requisitos: Node 22+, um fork deste repositório e **uma** chave free tier (veja o [README](../../README.md#provedores)).

### Parte 1 · Trocar o provedor para um free tier (15 min)

1. `cp .env.example .env` e preencha **só** um provedor. Exemplo com Gemini:
   ```
   AI_PROVIDER=google
   GOOGLE_GENERATIVE_AI_API_KEY=sua-chave
   ```
2. `npm run setup` e depois `npm run dev`.
3. Abra http://localhost:3000. **Critério de pronto:** o badge no topo mostra `google · gemini-flash-latest` e o terminal loga `[chat] google/gemini-flash-latest`.
4. Clique em um prompt de exemplo. Anote: quantos passos e tool calls apareceram em "pronto"? Quantos tokens o terminal mostrou?
5. Desafio: troque para `groq` ou `openrouter` e compare o mesmo prompt. Qual foi mais rápido? Qual seguiu melhor o system prompt?

### Parte 2 · Mexer no system prompt (20 min)

1. Abra `src/lib/prompts/generation.tsx`.
2. Mude **uma regra** de cada vez e gere o mesmo prompt de novo. Sugestões:
   - Troque o público: "landing pages para **clínicas veterinárias**" em vez de pequenos negócios em geral.
   - Imponha uma identidade: "sempre use a paleta emerald/stone e a fonte serifada para títulos".
   - Peça uma seção obrigatória: "toda landing tem uma seção de FAQ com 4 perguntas".
3. **Critério de pronto:** um print antes/depois mostrando que a regra nova apareceu na página gerada.
4. Pergunta para discutir: o que acontece se você escreve duas regras que se contradizem?

### Parte 3 · Adicionar um campo no schema do Review (25 min)

1. Em `src/lib/review/schema.ts`, adicione ao `DesignReview` um campo novo, por exemplo:
   ```ts
   strengths: z.array(z.string()).describe("Pontos fortes do design, curtos"),
   ```
2. Rode `npm test`. **Algum teste quebrou? Por quê?** (Dica: o mock devolve um review fixo, sem esse campo. O schema é o contrato, e o mock não cumpre mais.)
3. Corrija atualizando o `mockReview` em `src/lib/mock-model.ts` (ou torne o campo `.optional()` e explique a diferença).
4. Mostre os `strengths` no painel (`src/components/review/ReviewPanel.tsx`), por exemplo como chips verdes acima das issues.
5. **Critério de pronto:** `npm test`, `npm run lint` e `npm run test:e2e` verdes, e um print do painel com os pontos fortes vindos do modelo de verdade.

> ⚠️ No repositório da aula **não** altere os campos existentes (`score`, `summary`, `issues`, `ReviewIssue`): a Aula 2 depende deles. No seu fork, fique à vontade.

### Entregável

Link do fork + 3 prints (badge do free tier, antes/depois do system prompt, painel com o campo novo).

---

## Como regerar o material

```bash
# prints 01–09 + vídeo, com o Haiku (precisa de ANTHROPIC_API_KEY no .env)
CAPTURE_SET=main E2E_PROVIDER=anthropic npm run docs:capture
./scripts/make-gifs.sh            # GIFs/MP4 + frame do print 03

# prints 11–13 (mock), 14 (chave ausente) e 10 (.env)
CAPTURE_SET=alt   E2E_PROVIDER=mock MOCK_TOKEN_DELAY_MS=40 npm run docs:capture
CAPTURE_SET=error E2E_PROVIDER=groq npm run docs:capture
CAPTURE_SET=env   E2E_PROVIDER=mock npm run docs:capture

# snippets (código real + explicação, localizados por âncora)
node scripts/build-snippets.mjs
```

Pare o `npm run dev` antes: o Next 16 só aceita um servidor de dev por pasta.
