# agent/ — Loop Engineering (Aula 2)

Um agente que mantém o site de um cliente (`demo-site/`): lê uma issue do
GitHub, edita o código, roda os testes de verdade e abre um **PR em draft**
com prints de antes/depois. Um humano aprova. Esse é o ciclo:

```
 issue rotulada        ┌─────────────┐
 `agent:ready` ──────► │ 1. GATILHO  │  GitHub Actions, on: issues [labeled]
                       └──────┬──────┘
                              ▼
                       ┌─────────────┐
                       │ 2. CONTEXTO │  issue-context.ts + tools.ts (list/read)
                       └──────┬──────┘
                              ▼
                       ┌─────────────┐     falhou: erro volta
                ┌────► │ 3. AÇÃO     │     como mensagem ─────┐
                │      │ write_file  │                        │
                │      └──────┬──────┘                        │
                │             ▼                               │
                │      ┌─────────────┐                        │
                └──────│ 4. VERIFICA │◄── lint + testes reais │ (máx. N×)
        erro no prompt │ verify.ts   │    (verify.ts)         │
                       └──────┬──────┘                        │
                              │ passou                        │
                              ▼
                       ┌─────────────┐
                       │ 5. CHECKPOINT│  PR draft + prints antes/depois.
                       │    HUMANO   │  Nada entra na main sozinho.
                       └─────────────┘
```

## Onde cada parte mora

| Parte do ciclo | Arquivo |
|---|---|
| 1. Gatilho | `.github/workflows/agent-loop.yml` (`on: issues: types: [labeled]`) |
| 2. Contexto | `issue-context.ts`, `prompts.ts` |
| 3. Ação | `tools.ts` (tools `list_files`/`read_file`/`write_file` do AI SDK) |
| 4. Verificação | `loop.ts` (o `for` de tentativas), `verify.ts` |
| 5. Checkpoint humano | `.github/workflows/agent-loop.yml` (step `gh pr create --draft`) |
| 6. Estado e guardrails | `config.ts` (limites), `guardrails.ts` (allowlist, prompt injection), `permissions:` do workflow |

## Rodar localmente

```bash
# com qualquer provedor configurado (GOOGLE_GENERATIVE_AI_API_KEY, GROQ_API_KEY...)
ISSUE_NUMBER=1 ISSUE_TITLE="Adicionar hover state no CTA" \
ISSUE_BODY="O botão não reage ao mouse." npx tsx agent/run-agent.ts

# print do site do cliente
npx tsx agent/screenshot.ts --out antes.png

# review → issues (depende de src/lib/review/review.ts, da Aula 1)
npx tsx agent/review-to-issues.ts --dry-run
```

## Decisões de design (por que assim?)

- **O loop é código, não mágica.** `loop.ts` tem ~80 linhas: `generateText`
  com tools, `stopWhen` como teto de passos, e um `for` que realimenta o
  erro da verificação. Dá para ler, debugar e testar (vide `__tests__/`).
- **Guardrails fora do prompt.** Allowlist de paths e limite de tokens são
  aplicados em código. Prompt não é mecanismo de segurança.
- **Issue é input não confiável.** Título e corpo entram no prompt dentro
  de tags `<untrusted-*>`, truncados. Vale o disclaimer: isso reduz, não
  elimina, prompt injection — por isso a allowlist é a última linha.
- **Verificação fora do modelo.** O agente não tem tool de shell. Quem diz
  que a correção funciona é `npm run lint` + `npm test`, não o LLM.
- **Checkpoint humano é o produto.** O valor vendável não é "IA que edita
  site" — é "PR com evidência (prints + testes) que um humano aprova em
  30 segundos".
