// Importar site (servidor): esboço das páginas -> rascunho com blocos.
// Com IA: o modelo reorganiza o conteúdo nos blocos do catálogo, sem inventar.
// Mock ou erro: conversão determinística (outlinesToSite).
import { generateText, Output } from "ai";
import { resolveModel } from "@/lib/ai/providers";
import { friendlyAIError } from "@/lib/ai/errors";
import type { ProviderSettings } from "@/lib/ai/settings";
import { plainText } from "@/lib/ai/plain-text";
import type { DraftNode } from "@/lib/draft/tree";
import { blockCatalog, GeneratedPageSchema, GeneratedSiteSchema, toDraft, toSite, type GeneratedPage, type GeneratedSite } from "@/lib/draft/generate-shared";
import { outlinesToSite, outlineToPrompt, pageNameFromFile, type PageOutline } from "./outline";

export interface ImportResult {
  pages: { name: string; tree: DraftNode[] }[];
  notes: string[];
  provider: string;
  modelId: string;
  /** true quando a conversão foi feita sem IA (mock ou erro da IA). */
  fallback: boolean;
  error?: string;
}

const FALLBACK_NOTE = "Convertido sem IA: cada título virou uma seção. Revise os blocos e use Reimaginar para gerar a landing em A2UI.";

export function importSystem(multiPage: boolean, year = new Date().getFullYear()): string {
  return `Ano atual: ${year}.
Você converte o CONTEÚDO EXTRAÍDO de um site que já existe no RASCUNHO de ${multiPage ? "um site" : "uma landing page"} com blocos prontos. Responda só com a estrutura pedida.
${blockCatalog()}

Regras:
- Use os TEXTOS ORIGINAIS do site (títulos, frases, itens, botões). Pode encurtar texto longo, mas não troque o sentido.
- NÃO INVENTE NADA: nada de preço, horário, endereço, telefone, número, nome, depoimento, produto ou marca que não esteja no conteúdo. Se faltar algo que o bloco pede, deixe vazio.
- Escolha o bloco que melhor representa cada trecho: lista de benefícios -> feature; perguntas e respostas -> faq; citação com autor -> testimonial; planos com preço -> pricing; números de destaque -> stat; contato (telefone, e-mail, endereço, horário) -> contact; campos de formulário -> form.
- Mantenha a ordem das seções do original. Cada seção começa com um heading.
- Imagens: use só as URLs que aparecem nas linhas IMG; nunca invente endereço de imagem.
- props é uma lista de {key, value}; use só as chaves dos campos de cada bloco. "children" só em section; nos outros, [].
- Os blocos dentro de children têm SÓ type e props (não há aninhamento além de section -> filhos).
${multiPage ? "- Uma página do rascunho para cada página do conteúdo, com o mesmo nome e na mesma ordem. navbar: brand e cta; footer: text e links.\n" : ""}- Em notes, diga em 1 a 3 frases o que ficou de fora ou precisa de revisão.`;
}

export async function importSite(input: { outlines: PageOutline[]; brief?: string; settings?: ProviderSettings }): Promise<ImportResult> {
  const { outlines } = input;
  const resolved = resolveModel(input.settings);
  const base = { provider: resolved.kind, modelId: resolved.modelId };
  const fallback = (error?: string): ImportResult => ({ ...base, pages: outlinesToSite(outlines), notes: [FALLBACK_NOTE], fallback: true, error });
  if (resolved.kind === "mock") return fallback();

  const multi = outlines.length > 1;
  const prompt = [
    input.brief?.trim() ? `Briefing: ${input.brief.trim()}` : "",
    multi ? `Páginas, nesta ordem: ${outlines.map((o) => pageNameFromFile(o.file, o.title)).join(", ")}` : "",
    ...outlines.map((o) => outlineToPrompt(o, multi ? 4000 : 9000)),
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    if (!multi) {
      const res = await generateText({
        model: resolved.model,
        system: importSystem(false),
        prompt,
        output: Output.object({ schema: GeneratedPageSchema }),
        temperature: 0.2,
        maxOutputTokens: 6000,
        maxRetries: 3,
        providerOptions: resolved.providerOptions as never,
      });
      const g = res.output as GeneratedPage;
      const tree = toDraft(g);
      if (!tree.length) return fallback("a IA devolveu uma página vazia");
      return { ...base, pages: [{ name: pageNameFromFile(outlines[0].file, outlines[0].title), tree }], notes: g.notes.map(plainText), fallback: false };
    }
    const res = await generateText({
      model: resolved.model,
      system: importSystem(true),
      prompt,
      output: Output.object({ schema: GeneratedSiteSchema }),
      temperature: 0.2,
      maxOutputTokens: 9000,
      maxRetries: 3,
      providerOptions: resolved.providerOptions as never,
    });
    const site = toSite(res.output as GeneratedSite);
    if (site.pages.length < 2) return fallback("a IA juntou as páginas em uma só");
    return { ...base, pages: site.pages, notes: site.notes, fallback: false };
  } catch (err) {
    return fallback(friendlyAIError(err, resolved.kind, resolved.baseURL));
  }
}
