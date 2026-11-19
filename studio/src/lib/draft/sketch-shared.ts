// "Desenhar no Bloco livre": desenho (imagem) + descrição -> blocos do
// catálogo. Puro (cliente e servidor). A IA devolve o mesmo formato do
// "Gerar com IA" (GeneratedPageSchema), então o resultado é A2UI validado e
// herda temas, movimento, exportação e a regra de não inventar fatos.
import { generateSystem, templateFromPrompt } from "./generate-shared";
import { createNode, type DraftNode } from "./tree";

/** Tamanho máximo da imagem enviada (data URL). */
export const MAX_SKETCH_BYTES = 1_500_000;

export function sketchSystem(year = new Date().getFullYear()): string {
  return `${generateSystem(year)}

Agora você recebe o DESENHO À MÃO de UMA parte da página (um rascunho rápido, tipo wireframe), não a página inteira.
Como ler o desenho:
- Retângulos lado a lado = cards ou colunas (Grid); um retângulo grande com X ou montanhas = imagem; linhas onduladas = texto; um retângulo pequeno e cheio = botão; círculos = foto de pessoa ou ícone; texto escrito à mão = use exatamente essas palavras.
- Siga a disposição do desenho (o que está em cima vem primeiro; o que está lado a lado fica em Grid).
- Responda com 1 a 3 blocos "section" (sem navbar, hero e footer, a menos que o desenho mostre claramente um deles), cada um começando por um heading.
- Use os componentes que mais se parecem com o desenho: feature, stat, step, team, testimonial, pricing, faq, gallery, logos, contact, image, text, button.
- Textos que não estão legíveis no desenho nem na descrição viram marcadores entre colchetes.`;
}

export function sketchPrompt(description?: string, brief?: string, withImage = true): string {
  return [
    brief?.trim() ? `Briefing do negócio: ${brief.trim()}` : "",
    description?.trim() ? `O que o usuário quer neste bloco: ${description.trim()}` : "",
    withImage ? "O desenho está na imagem anexada." : "Sem imagem: monte o bloco só pela descrição.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Seção só com um título + a seção seguinte = uma seção (a IA às vezes separa o título dos cards). */
export function mergeHeadingOnly(nodes: DraftNode[]): DraftNode[] {
  const out: DraftNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const next = nodes[i + 1];
    const onlyHeading = n.type === "section" && n.children?.length === 1 && n.children[0].type === "heading";
    if (onlyHeading && next?.type === "section") {
      out.push({ ...next, children: [n.children![0], ...(next.children ?? [])] });
      i++;
    } else out.push(n);
  }
  return out;
}

/**
 * Encaixa o resultado onde estava o Bloco livre: no topo da página entram as
 * seções; dentro de um container entra só o conteúdo (sem seção dentro de seção).
 */
export function fitSketch(nodes: DraftNode[], nested: boolean): DraftNode[] {
  const body = nodes.filter((n) => n.type !== "navbar" && n.type !== "footer");
  if (!nested) return body;
  return body.flatMap((n) => (n.type === "section" ? (n.children ?? []) : [n]));
}

/** Sem IA com visão: monta pelo texto da descrição (modelo por palavras-chave) ou um bloco neutro. */
export function templateFromSketch(name?: string, description?: string): DraftNode[] {
  const text = `${name ?? ""} ${description ?? ""}`.trim();
  const body = text ? templateFromPrompt(text).filter((n) => n.type === "section") : [];
  if (body.length) return body;
  const s = createNode("section");
  const h = createNode("heading");
  h.props = { ...h.props, text: name?.trim() || "[título da seção]" };
  const t = createNode("text");
  t.props = { text: description?.trim() || "[conteúdo desta seção]" };
  s.children = [h, t];
  return [s];
}
