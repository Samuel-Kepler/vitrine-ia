// Design Review: a mesma IA do chat, mas devolvendo um OBJETO validado
// em vez de texto livre. É o structured output da Aula 1.
import { generateText, Output, type LanguageModel } from "ai";
import type { FileNode } from "@/lib/file-system";
import { DesignReview, ReviewRule } from "./schema";

export const reviewPrompt = `
You are a senior product designer reviewing React + Tailwind code generated for a small-business landing page.

Evaluate ONLY the files provided. Score from 0 (unusable) to 100 (ship it).
Report at most 6 issues, the most impactful first. Each issue must:
- point to the exact file path where the fix belongs (e.g. "/App.jsx");
- use one rule from: ${ReviewRule.options.join(", ")};
- have a short title (max 70 chars) that works as a GitHub issue title;
- have an "id" that is a stable kebab-case slug: <file-name>-<element>-<problem>, e.g. "app-hero-no-hover";
- have an actionable "suggestion" naming the Tailwind classes or markup to change.
Write "summary", "title" and "suggestion" in Brazilian Portuguese.
`.trim();

// Transforma o FS virtual serializado em texto que cabe no prompt.
export function filesToPrompt(files: Record<string, FileNode>): string {
  return Object.values(files)
    .filter((n) => n.type === "file" && typeof n.content === "string")
    .map((n) => `### FILE: ${n.path}\n\`\`\`jsx\n${n.content}\n\`\`\``)
    .join("\n\n");
}

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
