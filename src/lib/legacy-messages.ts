import type { UIMessage } from "ai";

// Projetos salvos antes da migração usam o formato de mensagem do AI SDK 4
// ({ content, parts: [{ type: "tool-invocation", toolInvocation }] }).
// Esta função converte para o formato UIMessage atual (só `parts`).
// Mensagens já no formato novo passam sem alteração.
export function normalizeMessages(raw: unknown): UIMessage[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m, index): UIMessage => {
      const id: string = m.id ?? `legacy-${index}`;

      if (Array.isArray(m.parts) && !hasLegacyParts(m.parts)) {
        return { id, role: m.role, parts: m.parts };
      }

      const parts: UIMessage["parts"] = [];
      for (const part of m.parts ?? []) {
        if (part.type === "text" && typeof part.text === "string") {
          parts.push({ type: "text", text: part.text });
        } else if (part.type === "reasoning" && typeof part.reasoning === "string") {
          parts.push({ type: "reasoning", text: part.reasoning });
        } else if (part.type === "step-start") {
          parts.push({ type: "step-start" });
        } else if (part.type === "tool-invocation" && part.toolInvocation) {
          const t = part.toolInvocation;
          if (t.state === "result") {
            parts.push({
              type: `tool-${t.toolName}`,
              toolCallId: t.toolCallId,
              state: "output-available",
              input: t.args,
              output: t.result,
            } as UIMessage["parts"][number]);
          }
        }
      }

      if (parts.length === 0 && typeof m.content === "string" && m.content) {
        parts.push({ type: "text", text: m.content });
      }

      return { id, role: m.role, parts };
    });
}

function hasLegacyParts(parts: Array<{ type?: string }>): boolean {
  return parts.some(
    (p) => p.type === "tool-invocation" || ("reasoning" in p && p.type === "reasoning")
  );
}
