// Chat de ajustes no código React (aba React). Mesma ideia do vitrine-ia:
// a IA edita arquivos com ferramentas (ver, trocar trecho, gravar) num
// sistema de arquivos em memória e cada edição passa pelo Babel; erro de
// sintaxe volta como resultado da ferramenta para a IA corrigir no passo
// seguinte. Devolve só os arquivos alterados.
import { generateText, isStepCount, tool } from "ai";
import { z } from "zod/v4";
import * as Babel from "@babel/standalone";
import { resolveModel } from "@/lib/ai/providers";
import { friendlyAIError } from "@/lib/ai/errors";
import type { ProviderSettings } from "@/lib/ai/settings";
import { AI_PATH_ERROR, isAiEditablePath } from "@/lib/security/paths";

export const MAX_STEPS = 12;
// Groq free tier: 8 mil tokens por minuto. O contexto inicial leva só as páginas
// (pequenas); componentes e CSS a IA abre com view_file quando precisar.
const CONTEXT_BUDGET = 9_000;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ReactChatResult {
  reply: string;
  /** Arquivos criados ou alterados (conteúdo completo). */
  changed: Record<string, string>;
  deleted: string[];
  steps: number;
  provider: string;
  modelId: string;
  error?: string;
}

/** Compila como o preview: devolve a mensagem de erro, ou null. */
export function syntaxError(path: string, code: string): string | null {
  if (!/\.(tsx?|jsx?)$/.test(path)) return null;
  try {
    Babel.transform(code, {
      filename: path,
      presets: [["react", { runtime: "automatic" }], ...(/\.tsx?$/.test(path) ? [["typescript", { isTSX: path.endsWith("x"), allExtensions: true }]] : [])],
      sourceType: "module",
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

const numbered = (code: string, from = 1, to?: number) =>
  code
    .split("\n")
    .slice(from - 1, to)
    .map((l, i) => `${String(from + i).padStart(4)}| ${l}`)
    .join("\n");

// Horários, preços, porcentagens, telefones e anos: os fatos que a IA mais inventa.
const FACT = /R\$\s?\d[\d.,]*|\b\d{1,2}\s?h(?:\s?\d{2})?\b|\b\d{1,3}\s?%|\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b|\b(?:19|20)\d{2}\b/g;

/**
 * Fatos novos nas linhas que a IA acrescentou (sem classes CSS), que não
 * existiam em nenhum arquivo antes. Só avisa; não desfaz nada.
 */
export function newFacts(before: Record<string, string>, changed: Record<string, string>): string[] {
  const known = new Set(Object.values(before).join("\n").match(FACT) ?? []);
  const found = new Set<string>();
  for (const [path, content] of Object.entries(changed)) {
    const old = new Set((before[path] ?? "").split("\n"));
    for (const line of content.split("\n")) {
      if (old.has(line)) continue;
      const text = line.replace(/className=(?:"[^"]*"|\{`[^`]*`\})/g, "");
      for (const m of text.match(FACT) ?? []) if (!known.has(m)) found.add(m.trim());
    }
  }
  return [...found].slice(0, 8);
}

/** Ferramentas sobre uma cópia dos arquivos. `files` é alterado no lugar. */
export function buildTools(files: Map<string, string>, touched: Set<string>, deleted: Set<string>) {
  const check = (path: string, ok: string) => {
    const err = syntaxError(path, files.get(path) ?? "");
    return err ? `${ok}\nERRO DE SINTAXE em ${path} (o preview vai quebrar): ${err}\nCorrija agora com str_replace.` : ok;
  };
  return {
    list_files: tool({
      description: "Lista os arquivos do projeto com o tamanho em linhas.",
      inputSchema: z.object({}),
      execute: async () => [...files.entries()].map(([p, c]) => `${p} (${c.split("\n").length} linhas)`).join("\n"),
    }),
    view_file: tool({
      description: "Mostra um arquivo com números de linha. Use antes de editar um arquivo que você ainda não viu.",
      inputSchema: z.object({
        path: z.string().describe("Caminho absoluto, ex.: /src/pages/Inicio.tsx"),
        start: z.number().int().nullable().describe("Primeira linha (opcional)"),
        end: z.number().int().nullable().describe("Última linha (opcional)"),
      }),
      execute: async ({ path, start, end }) => {
        const c = files.get(path);
        return c === undefined ? `Erro: ${path} não existe. Use list_files.` : numbered(c, start ?? 1, end ?? undefined);
      },
    }),
    str_replace: tool({
      description: "Troca um trecho exato de um arquivo por outro. old_str precisa aparecer exatamente uma vez (copie com espaços e quebras de linha, sem os números de linha).",
      inputSchema: z.object({
        path: z.string(),
        old_str: z.string().describe("Trecho exato a trocar (único no arquivo)"),
        new_str: z.string().describe("Novo trecho"),
      }),
      execute: async ({ path, old_str, new_str }) => {
        if (!isAiEditablePath(path)) return AI_PATH_ERROR;
        const c = files.get(path);
        if (c === undefined) return `Erro: ${path} não existe. Use list_files ou write_file.`;
        const n = old_str ? c.split(old_str).length - 1 : 0;
        if (n !== 1) return `Erro: o trecho aparece ${n} vezes em ${path}; precisa aparecer 1. Use view_file e copie um trecho maior e único.`;
        files.set(path, c.replace(old_str, () => new_str));
        touched.add(path);
        return check(path, `OK: ${path} atualizado.`);
      },
    }),
    write_file: tool({
      description: "Cria um arquivo novo (ou reescreve um inteiro). Prefira str_replace para mudanças pequenas.",
      inputSchema: z.object({ path: z.string().describe("Caminho absoluto, ex.: /src/components/Galeria.tsx"), content: z.string() }),
      execute: async ({ path, content }) => {
        if (!path.startsWith("/")) return "Erro: use caminho absoluto começando com /.";
        if (!isAiEditablePath(path)) return AI_PATH_ERROR;
        files.set(path, content);
        touched.add(path);
        deleted.delete(path);
        return check(path, `OK: ${path} gravado.`);
      },
    }),
    delete_file: tool({
      description: "Apaga um arquivo que não é mais usado.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => {
        if (!files.has(path)) return `Erro: ${path} não existe.`;
        if (!isAiEditablePath(path)) return AI_PATH_ERROR;
        if (/^\/src\/entries\/|\.html$|^\/src\/components\/landing\.tsx$/.test(path)) return `Erro: ${path} é necessário para o site funcionar.`;
        files.delete(path);
        touched.delete(path);
        deleted.add(path);
        return `OK: ${path} apagado.`;
      },
    }),
  };
}

export function reactChatSystem(): string {
  return `Você ajusta o código de um site em React que o usuário exportou do Vitrine Studio. Responda sempre em português do Brasil.

Projeto: Vite + React 19 + TypeScript + Tailwind CSS v4.
- Uma página por arquivo em /src/pages/*.tsx; cada página tem uma entrada /src/entries/<pagina>.tsx e um /<pagina>.html (não mexa nas entradas nem nos .html, a não ser para criar uma página nova).
- Componentes da landing em /src/components/landing.tsx (Page, Navbar, Hero, Section, Grid, Feature, Testimonial, PricingCard, Footer, FormCard, TextField, Button, Text, Card, Image…). Pode alterar e criar componentes novos em /src/components/.
- Estilos em /src/index.css: paletas por variáveis CSS (--lp-bg, --lp-fg, --lp-soft, --lp-accent, --lp-accent-bg, --lp-muted-bg…) e classes .lp-btn, .lp-card, .tone-*. Use essas variáveis para manter a paleta.
- Responsivo por container queries do Tailwind v4: @md: (448px), @xl: (576px), @3xl: (768px), @5xl: (1024px). NÃO use sm:/md:/lg: (dependem da janela, não do quadro).
- Pacotes disponíveis: react, react-dom, lucide-react (ícones; não tem ícones de marcas como Instagram). Não adicione outros pacotes.
- Imports locais são relativos (ex.: "../components/landing").

Como trabalhar:
- Edite só com as ferramentas (str_replace para mudanças pontuais, write_file para arquivos novos). Nunca cole código na resposta.
- Faça a menor mudança que resolve o pedido. Mantenha os textos do site, a não ser que o pedido seja mudá-los.
- Não invente fatos (preços, horários, endereços, depoimentos, números). Se faltar, use marcadores como [preço].
- Se uma ferramenta acusar ERRO DE SINTAXE, corrija antes de terminar.
- Ao terminar, responda em 1 a 3 frases o que mudou e em quais arquivos.`;
}

/** Contexto inicial: lista de arquivos + conteúdo dos principais (até o orçamento). */
export function projectContext(files: Map<string, string>): string {
  const list = [...files.keys()].join("\n");
  const priority = [...files.keys()].filter((p) => p.startsWith("/src/pages/"));
  let budget = CONTEXT_BUDGET;
  const shown: string[] = [];
  for (const p of priority) {
    const c = files.get(p)!;
    if (c.length > budget) continue;
    budget -= c.length;
    shown.push(`### ${p}\n${numbered(c)}`);
  }
  return `Arquivos do projeto:\n${list}\n\nPáginas (com números de linha). Para os componentes (/src/components/landing.tsx) e o CSS (/src/index.css), use view_file, de preferência com start/end:\n\n${shown.join("\n\n")}`;
}

export async function runReactChat(input: { files: Record<string, string>; message: string; history?: ChatTurn[]; settings?: ProviderSettings }): Promise<ReactChatResult> {
  const resolved = resolveModel(input.settings);
  const base = { provider: resolved.kind, modelId: resolved.modelId };
  const empty = { changed: {}, deleted: [], steps: 0 };
  if (resolved.kind === "mock") {
    return { ...base, ...empty, reply: "O chat de código precisa de uma IA de verdade: escolha um provedor (Groq, Google, Anthropic ou local) na engrenagem.", error: "provedor mock" };
  }
  const files = new Map(Object.entries(input.files));
  const touched = new Set<string>();
  const deleted = new Set<string>();
  const history = (input.history ?? []).slice(-6);
  try {
    const res = await generateText({
      model: resolved.model,
      system: reactChatSystem(),
      messages: [
        { role: "user", content: projectContext(files) },
        { role: "assistant", content: "Entendi o projeto. O que você quer mudar?" },
        ...history.map((t) => ({ role: t.role, content: t.content })),
        { role: "user", content: input.message },
      ],
      tools: buildTools(files, touched, deleted),
      stopWhen: isStepCount(MAX_STEPS),
      temperature: 0.2,
      maxOutputTokens: 8000,
      maxRetries: 4,
      providerOptions: resolved.providerOptions as never,
    });
    const changed = Object.fromEntries([...touched].filter((p) => files.has(p)).map((p) => [p, files.get(p)!]));
    const broken = Object.entries(changed)
      .map(([p, c]) => [p, syntaxError(p, c)] as const)
      .filter(([, e]) => e);
    const reply = res.text.trim() || (touched.size ? "Pronto." : "Não fiz mudanças.");
    const facts = newFacts(input.files, changed);
    const warnings = [
      broken.length ? `Atenção: ainda há erro de sintaxe em ${broken.map(([p]) => p).join(", ")}.` : "",
      facts.length ? `Confira antes de publicar: a IA escreveu ${facts.map((f) => `"${f}"`).join(", ")}, que não estava no site. Se não for verdade, troque por um marcador como [horário].` : "",
    ].filter(Boolean);
    return {
      ...base,
      reply: warnings.length ? `${reply}\n\n${warnings.join("\n")}` : reply,
      changed,
      deleted: [...deleted],
      steps: res.steps.length,
    };
  } catch (err) {
    return { ...base, ...empty, reply: "", error: friendlyAIError(err, resolved.kind, resolved.baseURL) };
  }
}
