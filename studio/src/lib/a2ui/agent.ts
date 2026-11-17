// Lado do agente: gera o trecho de prompt do catálogo e compila/valida a
// resposta do modelo (A2UI Express -> mensagens v1.0) com @a2ui/agent.
import {
  A2uiGenerator,
  CatalogConfig,
  ComponentPruningTransformer,
  FunctionPruningTransformer,
} from "@a2ui/agent";
import { BASIC_ALLOWED, CATALOG_ID, CUSTOM_APIS, SURFACE_ID, buildCatalog } from "./catalog-api";

export type A2uiMessage = Record<string, unknown> & { version: "1.0" };

let generator: A2uiGenerator | undefined;

function getGenerator(): A2uiGenerator {
  if (!generator) {
    const catalog = buildCatalog(CUSTOM_APIS);
    const cfg = new CatalogConfig(catalog as any, [
      new ComponentPruningTransformer([...CUSTOM_APIS.map((c) => c.name), ...BASIC_ALLOWED]),
      new FunctionPruningTransformer([]),
    ]);
    generator = new A2uiGenerator([cfg]);
  }
  return generator;
}

/** Processador novo por requisição: o SDK guarda estado de superfície. */
function createProcessor() {
  return getGenerator().createProcessor({ "1.0": { supportedCatalogIds: [CATALOG_ID] } });
}

export function promptSnippet(): string {
  return createProcessor().promptSnippet;
}

export interface CompileResult {
  messages: A2uiMessage[];
  express: string;
  prose: string;
}

/** Extrai o bloco <a2ui> e compila. Lança erro com mensagem acionável. */
export function compileResponse(text: string): CompileResult {
  const proc = createProcessor();
  const parts = proc.parseResponse(text) as Array<{ type: string; a2ui?: unknown; text?: string }>;
  const messages: A2uiMessage[] = [];
  const prose: string[] = [];
  for (const part of parts) {
    if (part.type === "a2ui" && part.a2ui) {
      const list = Array.isArray(part.a2ui) ? part.a2ui : [part.a2ui];
      messages.push(...(list as A2uiMessage[]));
    } else if (typeof part.text === "string" && part.text.trim()) {
      prose.push(part.text.trim());
    }
  }
  if (!messages.some((m) => "createSurface" in m)) {
    throw new Error(
      "Nenhum bloco <a2ui> válido com root foi encontrado. Envie a página inteira dentro de <a2ui> ... </a2ui>, com root = Page(...).",
    );
  }
  const match = text.match(/<a2ui>[\s\S]*?<\/a2ui>/);
  return { messages: normalizeSurface(messages), express: match ? match[0] : text, prose: prose.join("\n\n") };
}

/** Garante surfaceId e catalogId fixos (o modelo pode inventar outros). */
function normalizeSurface(messages: A2uiMessage[]): A2uiMessage[] {
  return messages
    .filter((m) => !("deleteSurface" in m))
    .map((m) => {
      const key = Object.keys(m).find((k) => k !== "version")!;
      const body: Record<string, unknown> = { ...(m[key] as Record<string, unknown>), surfaceId: SURFACE_ID };
      if (key === "createSurface") body.catalogId = CATALOG_ID;
      return { version: "1.0", [key]: body } as A2uiMessage;
    });
}
