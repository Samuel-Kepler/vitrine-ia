// Exporta o site como projeto React (Vite + React + Tailwind), sem IA:
// cada página A2UI vira um .tsx que usa os mesmos componentes do preview
// (landing-components.tsx, copiado tal e qual). Várias páginas = várias
// entradas HTML do Vite (index.html, cardapio.html…), sem roteador.
import type { GeneratedFile } from "@/lib/db/codegen";
import { LANDING_COMPONENTS_TSX, LANDING_CSS } from "./react-sources";

export interface ReactPage {
  name: string;
  /** index.html, cardapio.html… (o mesmo nome do site estático). */
  file: string;
  messages: unknown[];
}

interface Comp {
  id: string;
  component: string;
  [k: string]: unknown;
}

export const REACT_VERSIONS = {
  react: "19.3.1",
  "react-dom": "19.3.1",
  "lucide-react": "0.577.0",
  vite: "7.3.7",
  "@vitejs/plugin-react": "5.2.0",
  tailwindcss: "4.3.5",
  "@tailwindcss/vite": "4.3.5",
  typescript: "5.9.3",
  "@types/react": "19.3.0",
  "@types/react-dom": "19.3.0",
} as const;

/** Lista plana de componentes das mensagens (createSurface + updateComponents; o último vence). */
export function componentsOf(messages: unknown[]): Map<string, Comp> {
  const map = new Map<string, Comp>();
  for (const m of messages as Record<string, { components?: Comp[] } | undefined>[]) {
    for (const c of m?.createSurface?.components ?? m?.updateComponents?.components ?? []) map.set(c.id, c);
  }
  return map;
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.map((c) => (typeof c === "string" ? c : (c as { id?: string })?.id)).filter((x): x is string => !!x) : []);
const pascal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("")
    .replace(/^(\d)/, "P$1") || "Pagina";

/** Atributo JSX: strings e listas via JSON (escapa aspas, quebras e chaves). */
function attrs(o: Record<string, unknown>): string {
  return Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== "" && v !== false && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}={${JSON.stringify(v)}}`))
    .join("");
}

interface Ctx {
  map: Map<string, Comp>;
  used: Set<string>;
  hasForm: boolean;
  href: (label: string) => string;
}

function hasTextField(ctx: Ctx, id: string, seen = new Set<string>()): boolean {
  const c = ctx.map.get(id);
  if (!c || seen.has(id)) return false;
  seen.add(id);
  if (c.component === "TextField") return true;
  return [str(c.child), ...ids(c.children)].some((x) => !!x && hasTextField(ctx, x, seen));
}

/** Componente A2UI (e filhos) -> JSX com indentação. */
function emit(ctx: Ctx, id: string, depth: number, inForm = false): string {
  const pad = "  ".repeat(depth);
  const c = ctx.map.get(id);
  if (!c) return `${pad}{/* componente "${id}" não encontrado */}`;
  const tag = (name: string, props: Record<string, unknown>, kids?: string[]) => {
    ctx.used.add(name);
    return kids?.length ? `${pad}<${name}${attrs(props)}>\n${kids.join("\n")}\n${pad}</${name}>` : `${pad}<${name}${attrs(props)} />`;
  };
  const child = (x: unknown, form = inForm) => (str(x) ? [emit(ctx, str(x)!, depth + 1, form)] : []);
  const children = (x: unknown, form = inForm) => ids(x).map((k) => emit(ctx, k, depth + 1, form));

  switch (c.component) {
    case "Page":
      return tag("Page", { palette: str(c.palette) }, child(c.child));
    case "Navbar": {
      const links = strList(c.links);
      return tag("Navbar", { brand: str(c.brand), links, hrefs: links.map(ctx.href), cta: str(c.cta) });
    }
    case "Footer": {
      const links = strList(c.links);
      return tag("Footer", { text: str(c.text), links, hrefs: links.map(ctx.href) });
    }
    case "Hero":
      return tag("Hero", { title: str(c.title), subtitle: str(c.subtitle), cta: str(c.cta), image: str(c.image), eyebrow: str(c.eyebrow) });
    case "Heading":
      return tag("Heading", { text: str(c.text), level: str(c.level), align: str(c.align) });
    case "Section":
      return tag("Section", { tone: str(c.tone) }, child(c.child));
    case "Grid":
      return tag("Grid", { columns: str(c.columns) }, children(c.children));
    case "Column":
      return tag("Column", {}, [...child(c.child), ...children(c.children)]);
    case "Row":
      return tag("Row", {}, [...child(c.child), ...children(c.children)]);
    case "Feature":
      return tag("Feature", { icon: str(c.icon), title: str(c.title), text: str(c.text) });
    case "Testimonial":
      return tag("Testimonial", { quote: str(c.quote), author: str(c.author), role: str(c.role) });
    case "PricingCard":
      return tag("PricingCard", { name: str(c.name), price: str(c.price), period: str(c.period), features: strList(c.features), cta: str(c.cta), highlighted: c.highlighted === true });
    case "Card": {
      if (hasTextField(ctx, c.id)) {
        ctx.hasForm = true;
        ctx.used.add("FormCard");
        const kids = child(c.child, true);
        return `${pad}<FormCard endpoint={LEADS_URL}>\n${kids.join("\n")}\n${pad}</FormCard>`;
      }
      return tag("Card", {}, child(c.child));
    }
    case "TextField": {
      const path = (c.value as { "@path"?: string } | undefined)?.["@path"];
      const label = str(c.label) ?? "";
      const name = path?.split("/").filter(Boolean).pop() ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      return tag("TextField", { label, name });
    }
    case "Button": {
      const label = ctx.map.get(str(c.child) ?? "");
      const text = str(label?.text) ?? "Enviar";
      const action = (c.action as { event?: { name?: string } } | undefined)?.event?.name;
      ctx.used.add("Button");
      return `${pad}<Button${attrs({ variant: str(c.variant), type: inForm || action === "lead_submit" ? "submit" : undefined })}>{${JSON.stringify(text)}}</Button>`;
    }
    case "Text":
      ctx.used.add("Text");
      return `${pad}<Text>{${JSON.stringify(str(c.text) ?? "")}}</Text>`;
    case "Image":
      return tag("Image", { src: str(c.url) ?? str(c.src), alt: str(c.alt) ?? str(c.description) });
    case "Divider":
      return tag("Divider", {});
    case "Icon":
      return tag("Icon", { name: str(c.name) });
    default:
      return `${pad}{/* componente A2UI "${c.component}" ainda não exportado para React */}`;
  }
}

/** Uma página A2UI -> arquivo .tsx (componente default). */
export function pageToTsx(page: ReactPage, href: (label: string) => string): { code: string; component: string } {
  const map = componentsOf(page.messages);
  const root = [...map.values()].find((c) => c.component === "Page")?.id ?? [...map.keys()].pop();
  const ctx: Ctx = { map, used: new Set(), hasForm: false, href };
  const body = root ? emit(ctx, root, 2) : "    <div />";
  const component = pascal(page.name);
  const imports = [...ctx.used].sort();
  const code = [
    `// Página "${page.name}" exportada do Vitrine Studio.`,
    `import { ${imports.join(", ")} } from "../components/landing";`,
    "",
    ...(ctx.hasForm ? ['// Endereço que recebe o formulário (ex.: http://localhost:3001/leads). Sem ele, o envio só confirma na tela.', "const LEADS_URL = import.meta.env.VITE_LEADS_URL as string | undefined;", ""] : []),
    `export default function ${component}() {`,
    "  return (",
    body,
    "  );",
    "}",
    "",
  ].join("\n");
  return { code, component };
}

const htmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** Projeto Vite completo, sob react/. */
export function reactProject(pages: ReactPage[], opts: { brand?: string } = {}): GeneratedFile[] {
  const byLabel = new Map(pages.map((p) => [p.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(), p.file]));
  const href = (label: string) => byLabel.get(label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()) ?? "#";
  const files: GeneratedFile[] = [];
  const add = (path: string, content: string) => files.push({ path: `react/${path}`, content });
  const entries: { key: string; html: string }[] = [];
  const names = new Set<string>();

  for (const page of pages) {
    const key = page.file.replace(/\.html$/, "");
    let { code, component } = pageToTsx(page, href);
    // Duas páginas com o mesmo nome em PascalCase: diferencia o componente.
    if (names.has(component)) {
      const next = `${component}${names.size + 1}`;
      code = code.replace(`function ${component}()`, `function ${next}()`);
      component = next;
    }
    names.add(component);
    add(`src/pages/${component}.tsx`, code);
    add(
      `src/entries/${key}.tsx`,
      [
        'import { StrictMode } from "react";',
        'import { createRoot } from "react-dom/client";',
        'import "../index.css";',
        `import ${component} from "../pages/${component}";`,
        "",
        `createRoot(document.getElementById("root")!).render(\n  <StrictMode>\n    <${component} />\n  </StrictMode>,\n);`,
        "",
      ].join("\n"),
    );
    const title = opts.brand && opts.brand !== page.name ? `${page.name} · ${opts.brand}` : page.name;
    add(
      page.file,
      `<!doctype html>\n<html lang="pt-BR">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${htmlEscape(title)}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/entries/${key}.tsx"></script>\n  </body>\n</html>\n`,
    );
    entries.push({ key, html: page.file });
  }

  add("src/components/landing.tsx", LANDING_COMPONENTS_TSX);
  add(
    "src/index.css",
    `@import "tailwindcss";\n\n@theme {\n  --font-landing: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;\n}\n\nhtml,\nbody {\n  margin: 0;\n}\n\n${LANDING_CSS}`,
  );
  add("src/vite-env.d.ts", '/// <reference types="vite/client" />\n\ninterface ImportMetaEnv {\n  readonly VITE_LEADS_URL?: string;\n}\n');
  add(
    "vite.config.ts",
    [
      'import { defineConfig } from "vite";',
      'import react from "@vitejs/plugin-react";',
      'import tailwindcss from "@tailwindcss/vite";',
      'import { fileURLToPath } from "node:url";',
      "",
      "// Uma entrada HTML por página do site (sem roteador): os links do menu",
      "// apontam para index.html, cardapio.html… igual ao site estático.",
      "export default defineConfig({",
      "  plugins: [react(), tailwindcss()],",
      "  build: {",
      "    rollupOptions: {",
      "      input: {",
      ...entries.map((e) => `        ${JSON.stringify(e.key)}: fileURLToPath(new URL(${JSON.stringify(`./${e.html}`)}, import.meta.url)),`),
      "      },",
      "    },",
      "  },",
      "});",
      "",
    ].join("\n"),
  );
  add(
    "tsconfig.json",
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "bundler",
          jsx: "react-jsx",
          strict: true,
          skipLibCheck: true,
          noEmit: true,
          isolatedModules: true,
        },
        include: ["src"],
      },
      null,
      2,
    ) + "\n",
  );
  const v = REACT_VERSIONS;
  add(
    "package.json",
    JSON.stringify(
      {
        name: "vitrine-site",
        private: true,
        version: "0.1.0",
        type: "module",
        scripts: { dev: "vite", build: "tsc && vite build", preview: "vite preview" },
        dependencies: { react: v.react, "react-dom": v["react-dom"], "lucide-react": v["lucide-react"] },
        devDependencies: {
          vite: v.vite,
          "@vitejs/plugin-react": v["@vitejs/plugin-react"],
          tailwindcss: v.tailwindcss,
          "@tailwindcss/vite": v["@tailwindcss/vite"],
          typescript: v.typescript,
          "@types/react": v["@types/react"],
          "@types/react-dom": v["@types/react-dom"],
        },
      },
      null,
      2,
    ) + "\n",
  );
  add(".gitignore", "node_modules\ndist\n.env\n");
  add(".env.example", "# Endereço que recebe os formulários (a API gerada pelo Studio, por exemplo).\nVITE_LEADS_URL=http://localhost:3001/leads\n");
  add(
    "README.md",
    [
      "# Site em React (exportado do Vitrine Studio)",
      "",
      "Vite + React + Tailwind. Mesmo visual do preview do Studio: os componentes de `src/components/landing.tsx` são os mesmos.",
      "",
      "```bash",
      "npm install",
      "npm run dev      # http://localhost:5173",
      "npm run build    # gera dist/ (um HTML por página)",
      "```",
      "",
      "## Estrutura",
      "",
      ...pages.map((p) => `- \`${p.file}\` → \`src/pages/${pascal(p.name)}.tsx\` (${p.name})`),
      "- `src/components/landing.tsx`: os componentes (Navbar, Hero, Section, Feature, PricingCard, FormCard…).",
      "- `src/index.css`: Tailwind + paletas e estilos da landing (`.lp-*`).",
      "",
      "## Formulários",
      "",
      "Copie `.env.example` para `.env` e aponte `VITE_LEADS_URL` para a rota que recebe os dados (por exemplo, `POST /leads` da API gerada pelo Studio). Os campos são enviados em JSON com os nomes de `name` de cada `TextField`; confira se batem com as colunas da tabela.",
      "",
      "## Daqui em diante é código",
      "",
      "Edite à vontade. Reimaginar de novo no Studio gera outra exportação; ajustes feitos aqui não voltam para o Studio.",
      "",
    ].join("\n"),
  );
  return files;
}
