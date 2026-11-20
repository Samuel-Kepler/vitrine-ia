import type { DraftNode } from "@/lib/draft/tree";
import { draftOutline, draftToExpress } from "@/lib/draft/to-express";
import { SKELETON_CLOSE, SKELETON_OPEN } from "@/lib/ai/mock-model";
import { PALETTES } from "@/lib/a2ui/catalog-api";
import { MOTIONS, THEMES, THEME_DEFS } from "@/lib/a2ui/themes";
import { NO_INVENTED_FACTS } from "@/lib/ai/rules";

/** Direção de arte: quando usar cada tema e variação, para as páginas não saírem todas iguais. */
export const ART_DIRECTION = `Direção de arte (é isso que deixa a página bonita e diferente):
- Tema (theme) pelo tipo de negócio: ${THEMES.map((t) => `${t} = ${THEME_DEFS[t].hint}`).join("; ")}.
- Hero.variant: com imagem, "split" ou "image-bg"; sem imagem, "gradient" (impacto), "minimal" (combina com editorial e elegante) ou "centered". Use "eyebrow" para um rótulo curto acima do título quando ajudar.
- Benefícios: Grid(variant="bento") com 3 a 5 Feature dá destaque ao primeiro; Feature.variant "icon-left" para listas mais leves e "minimal" para um visual editorial. Use a mesma variant nos irmãos.
- Depoimentos: um só depoimento fica melhor como Testimonial(variant="quote"); vários, em Grid com "card".
- Ritmo: alterne os tons das seções (nunca o mesmo tom duas vezes seguidas) e use tone="gradient" no máximo uma vez, de preferência numa faixa de chamada para ação perto do fim.
- Seções prontas para quando o rascunho ou o briefing pedirem: Stat (2 a 4 em Grid, só números reais), FaqItem (vários numa Column), Step (3 a 4 em Grid, index "1", "2"…), TeamMember (em Grid), MenuItem (itens de cardápio/produtos com preço, em Grid columns "2"; só itens e preços dados; se o rascunho trouxer MenuList(source=...), mantenha o MenuList e o source iguais), ContactInfo (horários, endereço, telefone, WhatsApp), LogoStrip (só nomes reais de clientes) e Gallery (só URLs dadas). Sem os dados, mantenha os marcadores entre colchetes.
- Movimento (motion): "calm" na maioria; "lively" para negócios alegres e jovens (infantil, eventos, tecnologia, academia); "none" para assuntos sérios (saúde, jurídico, contabilidade). LogoStrip com 5 nomes ou mais pode usar variant="marquee". Gallery: "mosaic" com 4 a 6 fotos, "strip" com muitas. MenuItem com fotos: variant="card". Stat em seção "muted": variant="card".
- Section.animation (entrada ao rolar): varie ao longo da página em vez de repetir; "zoom" em seções com Gallery ou Image, "blur" combina com temas elegante e editorial, "slide" em sequências (passos, benefícios). Omita na maioria e use em 2 ou 3 seções. Com motion "none", não use. Se o rascunho já traz animation, respeite.
- Se o rascunho já define um estilo (variant) ou o pedido indica tema ou movimento, respeite.`;

export function systemPrompt(catalogSnippet: string): string {
  return `Você é um designer de landing pages. Transforme o rascunho do usuário numa landing page bonita e persuasiva, descrita em A2UI.

Regras do resultado:
- Responda com UMA frase curta em português e depois UM único bloco <a2ui> ... </a2ui> com a página inteira.
- root = Page(child=<coluna com as seções>, palette="<${PALETTES.join("|")}>", theme="<${THEMES.join("|")}>", motion="<${MOTIONS.join("|")}>").
- Paleta pelo tipo de negócio: barbearia, bar, tatuagem, noite ou premium → noir; café, padaria, restaurante ou confeitaria → espresso; beleza, estética, unhas, casamento ou floricultura → rose; saúde, natureza, orgânicos ou pet → forest; tecnologia, SaaS ou startup → ocean ou grape; varejo ou geral → sunset ou ocean. Use mono só se o usuário pedir minimalista ou preto e branco.
- Se o Hero do rascunho tiver imagem, use variant image-bg ou split (nunca gradient com foto disponível).
- Cada parte da página fica dentro de Section(child=Column(...), tone=...). Alterne os tons (default, muted, accent, dark) para dar ritmo. Navbar, Hero e Footer podem ficar direto na coluna da página.
- Use Heading para títulos (Text não tem tamanho de título). Use Grid para benefícios, planos e depoimentos.
${ART_DIRECTION}
- Mantenha a ORDEM e a INTENÇÃO dos blocos do rascunho. Melhore os textos (claros, em português do Brasil) e o layout. Não acrescente seções novas.

${NO_INVENTED_FACTS}

- "Bloco livre" traz uma descrição: interprete-a usando só os componentes do catálogo. Se ele pede algo que depende de dados reais que não foram dados (ex.: "Logos de clientes", "Números", "Parceiros"), use um título e um texto descritivo neutro, sem nomes de empresas, sem números e sem prova social inventada.
- Não invente URLs de imagem: use Image só com URLs que o usuário forneceu.
- URLs que começam com https://asset.invalid/ são fotos que o usuário enviou: copie cada uma EXATAMENTE (sem mudar uma letra) no mesmo lugar do rascunho (Hero.image, Image.url, TeamMember.photo, Gallery.images). Não descarte nenhuma. Hero com foto: variant "split" ou "image-bg".
- Nomes de variáveis em snake_case (letras, números e _).
- Se o compilador recusar sua resposta, corrija exatamente o erro apontado e envie o bloco inteiro de novo.

${catalogSnippet}`;
}

export interface UserPromptOptions {
  brief?: string;
  palette?: string;
  theme?: string;
  motion?: string;
  /** Página atual (A2UI Express) para melhorar, em vez de partir do rascunho. */
  previous?: string;
  /** Correções pedidas pela revisão. */
  feedback?: string[];
}

export function userPrompt(draft: DraftNode[], opts: UserPromptOptions): string {
  const base = opts.previous?.trim()
    ? opts.previous.trim()
    : draftToExpress(draft, { palette: opts.palette, theme: opts.theme, motion: opts.motion });
  const skeleton = base.replace(/^<a2ui>\n/, "").replace(/\n<\/a2ui>$/, "");
  const fixes = (opts.feedback ?? []).filter((f) => f.trim()).slice(0, 8);
  return [
    opts.brief?.trim() ? `Briefing do negócio: ${opts.brief.trim()}` : "Briefing do negócio: (não informado; deduza pelo rascunho)",
    opts.palette ? `Paleta preferida: ${opts.palette}` : "Paleta: escolha a que combina com o negócio.",
    opts.theme ? `Tema obrigatório: ${opts.theme}` : "Tema: escolha o que combina com o negócio (veja a direção de arte).",
    opts.motion ? `Movimento obrigatório: ${opts.motion}` : "",
    "",
    "Rascunho (de cima para baixo):",
    draftOutline(draft) || "(vazio)",
    "",
    ...(fixes.length
      ? [
          "Correções pedidas pela revisão (aplique todas; mantenha o que já está bom, os textos que vieram do usuário e a regra de não inventar fatos):",
          ...fixes.map((f) => `- ${f}`),
          "",
        ]
      : []),
    opts.previous?.trim() ? "Página atual em A2UI Express (já compila). Melhore esta página aplicando as correções:" : "Esqueleto A2UI Express que já compila. Use como ponto de partida e melhore:",
    SKELETON_OPEN,
    skeleton,
    SKELETON_CLOSE,
  ].join("\n");
}
