// O que pertence a um projeto do Studio (sem React nem zustand: usado no store,
// no módulo de projetos e nos testes).
import type { DraftNode } from "@/lib/draft/tree";
import { homePage, HOME_ID, type Page } from "@/lib/draft/pages";
import type { ReimagineResult } from "@/lib/reimagine/reimagine";
import type { ArchGraph } from "@/lib/arch/model";
import type { ErModel } from "@/lib/db/model";
import type { Shape } from "@/lib/sketch/shapes";

/** Versão do formato do estado (a mesma do persist do store). */
export const STUDIO_VERSION = 2;

/**
 * Ficam de fora, globais no navegador: settings (provedor e chave de API, que
 * não podem ir para um arquivo compartilhável) e saved (biblioteca de
 * componentes, reaproveitada entre projetos).
 */
export interface ProjectData {
  tree: DraftNode[];
  brief: string;
  palette: string;
  theme: string;
  motion: string;
  result: ReimagineResult | null;
  mode: "ui" | "arch" | "db";
  arch: ArchGraph;
  db: ErModel;
  suggestNotes: string[];
  pages: Page[];
  pageId: string;
  reactFiles: Record<string, string> | null;
  sketches: Record<string, string>;
  sketchDocs: Record<string, Shape[]>;
  reactEdited: boolean;
}

export const PROJECT_KEYS = [
  "tree",
  "brief",
  "palette",
  "theme",
  "motion",
  "result",
  "mode",
  "arch",
  "db",
  "suggestNotes",
  "pages",
  "pageId",
  "reactFiles",
  "sketches",
  "sketchDocs",
  "reactEdited",
] as const satisfies readonly (keyof ProjectData)[];

export function blankProjectData(): ProjectData {
  return {
    tree: [],
    brief: "",
    palette: "auto",
    theme: "auto",
    motion: "auto",
    result: null,
    mode: "ui",
    arch: { nodes: [], edges: [] },
    db: { tables: [], relations: [] },
    suggestNotes: [],
    pages: [homePage()],
    pageId: HOME_ID,
    reactFiles: null,
    sketches: {},
    sketchDocs: {},
    reactEdited: false,
  };
}
