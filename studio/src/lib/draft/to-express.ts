// Compilador determinístico: rascunho -> A2UI Express.
// Usado (1) pelo modelo mock, (2) como plano B quando a IA falha e
// (3) para mostrar ao modelo um "esqueleto" válido do rascunho.
import type { DraftNode } from "./tree";
import { lines } from "./tree";
import { BLOCKS } from "./blocks";
import { SECTION_ANIMATIONS } from "@/lib/a2ui/themes";

export interface ExpressOptions {
  palette?: string;
  /** Tema visual (moderno, elegante…). Sem tema: Page fica sem theme (= moderno). */
  theme?: string;
  /** Movimento (none, calm, lively). Sem: Page fica sem motion (= calm). */
  motion?: string;
}

const str = (s: string | undefined) => JSON.stringify(s ?? "");

export function slug(s: string): string {
  const base = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return /^[a-z_]/.test(base) ? base || "campo" : `f_${base}`;
}

function safeUrl(u: string | undefined): string | undefined {
  if (!u) return undefined;
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

const GRIDDABLE = new Set(["feature", "pricing", "testimonial", "stat", "step", "team", "menuitem"]);
const PAGE_LEVEL = new Set(["navbar", "hero", "section", "footer"]);

class Emitter {
  out: string[] = [];
  data: Record<string, unknown> = {};
  private n = 0;

  v(id: string, suffix = ""): string {
    return `n_${id.replace(/[^A-Za-z0-9_]/g, "_")}${suffix}`;
  }
  fresh(prefix: string): string {
    this.n += 1;
    return `${prefix}_${this.n}`;
  }
  line(name: string, expr: string): string {
    this.out.push(`${name} = ${expr}`);
    return name;
  }

  /** Emite uma lista de irmãos, agrupando sequências de cards em Grid. */
  list(nodes: DraftNode[]): string[] {
    const names: string[] = [];
    for (let i = 0; i < nodes.length; ) {
      const t = nodes[i].type;
      let j = i;
      while (j < nodes.length && nodes[j].type === t) j++;
      if (GRIDDABLE.has(t) && j - i >= 2) {
        // Passos ganham o número pela posição na sequência.
        const kids = nodes.slice(i, j).map((n, k) => this.node(n, t === "step" ? k + 1 : undefined)).filter(Boolean) as string[];
        const cols = Math.min(Math.max(kids.length, 2), t === "pricing" ? 3 : t === "menuitem" ? 2 : 4);
        names.push(this.line(this.fresh("grid"), `Grid(children=[${kids.join(", ")}], columns="${cols}")`));
        i = j;
      } else {
        const name = this.node(nodes[i]);
        if (name) names.push(name);
        i++;
      }
    }
    return names;
  }

  column(nodes: DraftNode[], name: string): string {
    const kids = this.list(nodes);
    return this.line(name, `Column(children=[${kids.join(", ")}])`);
  }

  node(n: DraftNode, index?: number): string | undefined {
    const p = n.props;
    const v = this.v(n.id);
    switch (n.type) {
      case "section": {
        const col = this.column(n.children ?? [], this.v(n.id, "_col"));
        // "auto" (ou vazio): não manda; o Reimaginar pode escolher, senão vale o padrão.
        const anim = (SECTION_ANIMATIONS as readonly string[]).includes(p.animation) ? `, animation=${str(p.animation)}` : "";
        return this.line(v, `Section(child=${col}, tone=${str(p.tone || "default")}${anim})`);
      }
      case "column":
        return this.column(n.children ?? [], v);
      case "row": {
        const kids = this.list(n.children ?? []);
        return this.line(v, `Row(children=[${kids.join(", ")}], align="center")`);
      }
      case "card": {
        const col = this.column(n.children ?? [], this.v(n.id, "_col"));
        return this.line(v, `Card(child=${col})`);
      }
      case "navbar": {
        const links = lines(p.links).map(str).join(", ");
        const cta = p.cta ? `, cta=${str(p.cta)}, onCta=Event("cta_click", {source: "navbar"})` : "";
        return this.line(v, `Navbar(brand=${str(p.brand)}, links=[${links}]${cta})`);
      }
      case "hero": {
        const parts = [`title=${str(p.title)}`];
        if (p.subtitle) parts.push(`subtitle=${str(p.subtitle)}`);
        if (p.cta) parts.push(`cta=${str(p.cta)}`, `onCta=Event("cta_click", {source: "hero"})`);
        const img = safeUrl(p.image);
        if (img) parts.push(`image=${str(img)}`);
        // image-bg sem imagem não faz sentido: deixa o componente decidir.
        if (p.variant && p.variant !== "auto" && !(p.variant === "image-bg" && !img)) parts.push(`variant=${str(p.variant)}`);
        return this.line(v, `Hero(${parts.join(", ")})`);
      }
      case "heading":
        return this.line(v, `Heading(text=${str(p.text)}, level=${str(p.level || "2")})`);
      case "text":
        return this.line(v, `Text(text=${str(p.text)})`);
      case "button": {
        const lbl = this.line(this.v(n.id, "_lbl"), `Text(text=${str(p.label)})`);
        return this.line(
          v,
          `Button(child=${lbl}, variant=${str(p.variant || "primary")}, action=Event("cta_click", {label: ${str(p.label)}}))`,
        );
      }
      case "image": {
        const url = safeUrl(p.url) ?? "https://placehold.co/960x540/png?text=Imagem";
        return this.line(v, `Image(url=${str(url)}, description=${str(p.alt)}, fit="cover", variant="mediumFeature")`);
      }
      case "feature": {
        const variant = p.variant && p.variant !== "auto" ? `, variant=${str(p.variant)}` : "";
        return this.line(v, `Feature(icon=${str(p.icon || "sparkles")}, title=${str(p.title)}, text=${str(p.text)}${variant})`);
      }
      case "testimonial": {
        const role = p.role ? `, role=${str(p.role)}` : "";
        const variant = p.variant && p.variant !== "auto" ? `, variant=${str(p.variant)}` : "";
        return this.line(v, `Testimonial(quote=${str(p.quote)}, author=${str(p.author)}${role}${variant})`);
      }
      case "pricing": {
        const feats = lines(p.features).map(str).join(", ");
        const period = p.period ? `, period=${str(p.period)}` : "";
        return this.line(
          v,
          `PricingCard(name=${str(p.name)}, price=${str(p.price)}${period}, features=[${feats}], cta=${str(p.cta || "Assinar")}, onCta=Event("plan_selected", {plan: ${str(p.name)}}), highlighted=${p.highlighted === "yes"})`,
        );
      }
      case "form": {
        const fields = lines(p.fields);
        const keys = fields.map((f, i) => `${slug(f)}${fields.slice(0, i).some((g) => slug(g) === slug(f)) ? `_${i}` : ""}`);
        const form: Record<string, string> = {};
        keys.forEach((k) => (form[k] = ""));
        this.data[`form_${n.id}`] = form;
        const base = `/form_${n.id}`;
        const title = this.line(this.v(n.id, "_title"), `Heading(text=${str(p.title)}, level="3")`);
        const inputs = fields.map((f, i) => this.line(this.v(n.id, `_f${i}`), `TextField(label=${str(f)}, value=$${base}/${keys[i]})`));
        const ctx = keys.map((k) => `${k}: $${base}/${k}`).join(", ");
        const lbl = this.line(this.v(n.id, "_lbl"), `Text(text=${str(p.cta || "Enviar")})`);
        const btn = this.line(this.v(n.id, "_btn"), `Button(child=${lbl}, variant="primary", action=Event("lead_submit", {${ctx}}))`);
        const col = this.line(this.v(n.id, "_col"), `Column(children=[${[title, ...inputs, btn].join(", ")}])`);
        return this.line(v, `Card(child=${col})`);
      }
      case "stat":
        return this.line(v, `Stat(value=${str(p.value)}, label=${str(p.label)})`);
      case "faq":
        return this.line(v, `FaqItem(question=${str(p.question)}, answer=${str(p.answer)})`);
      case "step":
        return this.line(v, `Step(title=${str(p.title)}, text=${str(p.text)}${index ? `, index="${index}"` : ""})`);
      case "team": {
        const opt = (k: string, val?: string) => (val?.trim() ? `, ${k}=${str(val.trim())}` : "");
        const photo = safeUrl(p.photo);
        return this.line(v, `TeamMember(name=${str(p.name)}${opt("role", p.role)}${opt("bio", p.bio)}${photo ? `, photo=${str(photo)}` : ""})`);
      }
      case "menuitem": {
        const opt = (k: string, val?: string) => (val?.trim() ? `, ${k}=${str(val.trim())}` : "");
        const photo = safeUrl(p.photo);
        return this.line(v, `MenuItem(name=${str(p.name)}${opt("price", p.price)}${opt("description", p.description)}${photo ? `, photo=${str(photo)}` : ""})`);
      }
      case "contact": {
        const opt = (k: string, val?: string) => (val?.trim() ? `, ${k}=${str(val.trim())}` : "");
        const hours = lines(p.hours).map(str).join(", ");
        return this.line(v, `ContactInfo(hours=[${hours}]${opt("address", p.address)}${opt("phone", p.phone)}${opt("email", p.email)}${opt("whatsapp", p.whatsapp)})`);
      }
      case "logos": {
        const opt = (k: string, val?: string) => (val?.trim() ? `, ${k}=${str(val.trim())}` : "");
        const variant = p.variant && p.variant !== "auto" ? `, variant=${str(p.variant)}` : "";
        return this.line(v, `LogoStrip(names=[${lines(p.names).map(str).join(", ")}]${opt("title", p.title)}${variant})`);
      }
      case "gallery": {
        const images = lines(p.images).map((u) => safeUrl(u)).filter((u): u is string => !!u).map(str).join(", ");
        const captions = lines(p.captions).map(str).join(", ");
        return this.line(v, `Gallery(images=[${images}], captions=[${captions}])`);
      }
      case "footer": {
        const links = lines(p.links).map(str).join(", ");
        return this.line(v, `Footer(text=${str(p.text)}, links=[${links}])`);
      }
      case "custom": {
        const h = this.line(this.v(n.id, "_h"), `Heading(text=${str(p.name)}, level="3")`);
        const t = this.line(this.v(n.id, "_t"), `Text(text=${str(p.description)})`);
        const col = this.line(this.v(n.id, "_col"), `Column(children=[${h}, ${t}])`);
        return this.line(v, `Card(child=${col})`);
      }
      default: {
        const _exhaustive: never = n.type;
        return _exhaustive;
      }
    }
  }
}

/** Agrupa blocos soltos do topo em Seções, para a página ter faixas. */
function toPageSections(tree: DraftNode[]): DraftNode[] {
  const out: DraftNode[] = [];
  let loose: DraftNode[] = [];
  const flush = () => {
    if (loose.length) {
      out.push({ id: `auto${out.length}`, type: "section", props: { tone: out.length % 2 ? "muted" : "default" }, children: loose });
      loose = [];
    }
  };
  for (const n of tree) {
    if (PAGE_LEVEL.has(n.type)) {
      flush();
      out.push(n);
    } else loose.push(n);
  }
  flush();
  return out;
}

export function draftToExpress(tree: DraftNode[], opts: ExpressOptions = {}): string {
  const e = new Emitter();
  const sections = toPageSections(
    tree.length
      ? tree
      : [{ id: "empty", type: "heading", props: { text: "Arraste blocos para o canvas", level: "2" } }],
  );
  const pageCol = e.column(sections, "page_col");
  const palette = opts.palette ?? "ocean";
  const dataLines = Object.entries(e.data).map(([k, val]) => `$/${k} = ${toExpressValue(val)}`);
  return [
    "<a2ui>",
    ...dataLines,
    ...e.out,
    `root = Page(child=${pageCol}, palette=${str(palette)}${opts.theme ? `, theme=${str(opts.theme)}` : ""}${opts.motion ? `, motion=${str(opts.motion)}` : ""})`,
    "</a2ui>",
  ].join("\n");
}

function toExpressValue(v: unknown): string {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return `{${Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${toExpressValue(x)}`).join(", ")}}`;
  }
  if (Array.isArray(v)) return `[${v.map(toExpressValue).join(", ")}]`;
  return JSON.stringify(v);
}

/** Resumo legível do rascunho para o prompt (economiza tokens vs. JSON cru). */
export function draftOutline(tree: DraftNode[], depth = 0): string {
  return tree
    .map((n) => {
      const def = BLOCKS[n.type];
      const props = Object.entries(n.props)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${JSON.stringify(v.length > 160 ? v.slice(0, 160) + "…" : v)}`)
        .join(" ");
      const head = `${"  ".repeat(depth)}- ${def.label} [${n.type}] ${props}`.trimEnd();
      const kids = n.children?.length ? "\n" + draftOutline(n.children, depth + 1) : "";
      return head + kids;
    })
    .join("\n");
}
