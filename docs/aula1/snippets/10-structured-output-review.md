# Structured output: `Output.object` + schema zod do Review

**Onde:** `src/lib/review/schema.ts:20-34`

```ts
export const ReviewIssue = z.object({
  id: z.string(), // slug estável, ex. "app-hero-no-hover"
  title: z.string(), // curto, vira título de issue no GitHub
  file: z.string(), // ex. "/App.jsx"
  severity: z.enum(["low", "medium", "high"]),
  rule: ReviewRule,
  suggestion: z.string(), // o que mudar, acionável
});

export const DesignReview = z.object({
  score: z.number().min(0).max(100),
  summary: z.string(),
  issues: z.array(ReviewIssue),
});

```

**Onde:** `src/lib/review/review.ts:28-45`

```ts
export async function runDesignReview(
  model: LanguageModel,
  files: Record<string, FileNode>
): Promise<DesignReview> {
  const { output } = await generateText({
    model,
    instructions: reviewPrompt,
    prompt: filesToPrompt(files),
    // O SDK pede JSON ao provedor e valida a resposta com o schema zod.
    // Se o modelo devolver algo fora do schema, a chamada falha (não chega lixo na UI).
    output: Output.object({
      schema: DesignReview,
      name: "design_review",
      description: "Structured design review of the generated UI",
    }),
  });
  return output;
}
```

## O que está acontecendo

O chat devolve **texto livre** em stream. O Design Review devolve **um objeto**: `{ score, summary, issues[] }`.

`generateText` com `output: Output.object({ schema })` faz duas coisas: pede ao provedor uma resposta em JSON seguindo o schema e **valida** a resposta com zod. Se o modelo inventar uma severidade `"critical"` ou esquecer o `file`, a chamada falha em vez de entregar lixo para a tela.

(`generateObject` era o jeito antigo e está *deprecated*, ou seja, marcado para sair.)

## Por que importa

Esse é o salto de "chatbot" para "IA dentro de sistema". Com um objeto validado, a aplicação pode desenhar um anel de score, ordenar issues por severidade e até abrir issues no GitHub com `reviewToIssues` (Aula 2). Texto livre não dá para integrar com segurança.

> **Perceba:** O mesmo schema valida em três lugares: na rota (via SDK), no cliente (`DesignReview.parse` no `review-context.tsx`) e no teste e2e. O schema é o contrato.
