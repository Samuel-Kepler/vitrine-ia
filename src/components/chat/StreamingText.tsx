"use client";

import { MarkdownRenderer } from "./MarkdownRenderer";

// Enquanto o texto chega, cada "token" (palavra) é um <span> com key
// estável: o React só monta os novos, e só eles fazem a animação de entrada.
// Quando o stream termina, trocamos para o Markdown renderizado.
export function StreamingText({ text, streaming }: { text: string; streaming: boolean }) {
  if (!streaming) {
    return <MarkdownRenderer content={text} className="prose-sm prose-invert" />;
  }
  const tokens = text.match(/\S+\s*|\s+/g) ?? [];
  return (
    <p className="whitespace-pre-wrap leading-relaxed" data-testid="streaming-text">
      {tokens.map((t, i) => (
        <span key={i} className="token-in">
          {t}
        </span>
      ))}
      <span className="caret" aria-hidden />
    </p>
  );
}
