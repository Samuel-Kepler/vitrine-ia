# Bônus: `reviewToIssues`, a ponte para a Aula 2

**Onde:** `src/lib/review/schema.ts:48-67`

```ts
export function reviewToIssues(review: DesignReview): GitHubIssueDraft[] {
  return review.issues.map((issue) => ({
    title: issue.title,
    body: [
      `**Arquivo:** \`${issue.file}\``,
      `**Regra:** \`${issue.rule}\``,
      `**Severidade:** ${issue.severity}`,
      "",
      "### Sugestão",
      issue.suggestion,
      "",
      "---",
      `Score geral do review: ${review.score}/100`,
      `<!-- design-review-id: ${issue.id} -->`,
    ].join("\n"),
    labels: ["design-review", `severity:${issue.severity}`],
  }));
}

```

## O que está acontecendo

Função pura (mesma entrada, mesma saída, sem efeito colateral) que transforma o review em rascunhos de issue do GitHub: `{ title, body, labels }`, com labels `design-review` e `severity:<x>`.

O botão "issues" no painel do review copia exatamente esse resultado.

## Por que importa

Na Aula 2, um agente vai ler essas issues, corrigir o código e abrir PR. O structured output de hoje vira o **gatilho** do loop de amanhã.

> **Perceba:** O comentário `design-review-id` no corpo da issue usa o `id` estável do review, o que permite saber se aquela issue já foi aberta antes.
