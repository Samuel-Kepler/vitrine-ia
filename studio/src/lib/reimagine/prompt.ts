import type { DraftNode } from "@/lib/draft/tree";
import { draftOutline, draftToExpress } from "@/lib/draft/to-express";
import { SKELETON_CLOSE, SKELETON_OPEN } from "@/lib/ai/mock-model";
import { PALETTES } from "@/lib/a2ui/catalog-api";

export function systemPrompt(catalogSnippet: string): string {
  return `Você é um designer de landing pages. Transforme o rascunho do usuário numa landing page bonita e persuasiva, descrita em A2UI.

Regras do resultado:
- Responda com UMA frase curta em português e depois UM único bloco <a2ui> ... </a2ui> com a página inteira.
- root = Page(child=<coluna com as seções>, palette="<${PALETTES.join("|")}>").
- Cada parte da página fica dentro de Section(child=Column(...), tone=...). Alterne os tons (default, muted, accent, dark) para dar ritmo. Navbar, Hero e Footer podem ficar direto na coluna da página.
- Use Heading para títulos (Text não tem tamanho de título). Use Grid para benefícios, planos e depoimentos.
- Mantenha a ORDEM e a INTENÇÃO dos blocos do rascunho. Melhore os textos (claros, concretos, em português do Brasil), complete o que estiver vago e acrescente no máximo uma seção que faça falta.
- "Bloco livre" traz uma descrição: interprete-a usando só os componentes do catálogo.
- Não invente URLs de imagem: use Image só com URLs que o usuário forneceu.
- Nomes de variáveis em snake_case (letras, números e _).
- Se o compilador recusar sua resposta, corrija exatamente o erro apontado e envie o bloco inteiro de novo.

${catalogSnippet}`;
}

export function userPrompt(draft: DraftNode[], opts: { brief?: string; palette?: string }): string {
  const skeleton = draftToExpress(draft, { palette: opts.palette })
    .replace(/^<a2ui>\n/, "")
    .replace(/\n<\/a2ui>$/, "");
  return [
    opts.brief?.trim() ? `Briefing do negócio: ${opts.brief.trim()}` : "Briefing do negócio: (não informado; deduza pelo rascunho)",
    opts.palette ? `Paleta preferida: ${opts.palette}` : "Paleta: escolha a que combina com o negócio.",
    "",
    "Rascunho (de cima para baixo):",
    draftOutline(draft) || "(vazio)",
    "",
    "Esqueleto A2UI Express que já compila. Use como ponto de partida e melhore:",
    SKELETON_OPEN,
    skeleton,
    SKELETON_CLOSE,
  ].join("\n");
}
