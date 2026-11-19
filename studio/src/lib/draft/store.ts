"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { temporal } from "zundo";
import type { BlockType } from "./blocks";
import { BLOCKS } from "./blocks";
import {
  cloneWithNewIds,
  createNode,
  duplicateNode,
  findNode,
  insertNode,
  locate,
  moveNode,
  newId,
  removeNode,
  replaceNode,
  isNested,
  shiftNode,
  updateProps,
  type DraftNode,
  type DropTarget,
} from "./tree";
import { starterDraft } from "./starter";
import { fitSketch } from "./sketch-shared";
import type { Shape } from "@/lib/sketch/shapes";
import { addLink, commitActive, homePage, HOME_ID, newPageTree, chromeOf, removeLink, renameLink, uniqueSlug, migrateStudio, type Page } from "./pages";
import type { ReimagineResult } from "@/lib/reimagine/reimagine";
import type { ProviderSettings } from "@/lib/ai/settings";
import { usesOwnAuth, type ArchGraph } from "@/lib/arch/model";
import { ensureAuthUsers, type ErModel } from "@/lib/db/model";
import type { AiReviewResult, ReviewMode } from "@/lib/review/ai-input";
import { blankProjectData, PROJECT_KEYS, STUDIO_VERSION, type ProjectData } from "@/lib/projects/data";

export { blankProjectData, PROJECT_KEYS, STUDIO_VERSION, type ProjectData };

export interface SavedComponent {
  id: string;
  name: string;
  node: DraftNode;
}

export type DragPayload = { kind: "new"; type: BlockType } | { kind: "saved"; savedId: string } | { kind: "move"; id: string };

export type StudioTab = "canvas" | "landing" | "code" | "react";
export type StudioMode = "ui" | "arch" | "db";
export type FlowSelection = { kind: "node" | "edge"; id: string } | null;

interface StudioState {
  tree: DraftNode[];
  selectedId: string | null;
  brief: string;
  palette: string; // "auto" ou um nome de paleta
  theme: string; // "auto" ou um tema (moderno, elegante…)
  motion: string; // "auto" ou none | calm | lively
  saved: SavedComponent[];
  result: ReimagineResult | null;
  busy: boolean;
  tab: StudioTab;
  settings: ProviderSettings;
  mode: StudioMode;
  arch: ArchGraph;
  db: ErModel;
  flowSel: FlowSelection;
  suggestNotes: string[];
  /** Todas as páginas do site; a aberta (pageId) vive em tree/result. */
  pages: Page[];
  pageId: string;
  switchPage: (id: string) => void;
  addPage: (name: string) => void;
  renamePage: (id: string, name: string) => void;
  duplicatePage: (id: string) => void;
  removePage: (id: string) => void;
  /** Desenhos dos Blocos livres (id do bloco -> PNG em data URL). Fora do rascunho para não pesar nas chamadas de IA. */
  sketches: Record<string, string>;
  /** Mesmo desenho como objetos editáveis (formas), para reabrir e continuar. */
  sketchDocs: Record<string, Shape[]>;
  setSketch: (id: string, dataUrl: string | null, shapes?: Shape[]) => void;
  /** Troca o Bloco livre pelos blocos montados a partir do desenho (entra no histórico: Ctrl+Z desfaz). */
  applySketch: (id: string, nodes: DraftNode[]) => void;
  /** Projeto React (aba React): caminho absoluto -> conteúdo. null = ainda não gerado. */
  reactFiles: Record<string, string> | null;
  /** true depois que o código foi editado na aba React (Exportar usa o código editado). */
  reactEdited: boolean;
  setReactFiles: (files: Record<string, string> | null) => void;
  setReactFile: (path: string, content: string) => void;
  /** Troca o site inteiro (Gerar site); a primeira página abre. */
  replaceSite: (pages: { name: string; tree: DraftNode[] }[]) => void;
  /** Páginas com a aberta já gravada e o menu/rodapé espalhados. */
  allPages: () => Page[];
  /** Última revisão com IA de cada modo (não vai para o localStorage). */
  reviews: Partial<Record<ReviewMode, AiReviewResult>>;
  setReview: (r: AiReviewResult) => void;

  setMode: (m: StudioMode) => void;
  setArch: (g: ArchGraph | ((g: ArchGraph) => ArchGraph)) => void;
  setDb: (m: ErModel | ((m: ErModel) => ErModel)) => void;
  setFlowSel: (s: FlowSelection) => void;
  setSuggestNotes: (n: string[]) => void;
  select: (id: string | null) => void;
  setTab: (tab: StudioTab) => void;
  drop: (payload: DragPayload, target: DropTarget) => void;
  addByClick: (payload: Exclude<DragPayload, { kind: "move" }>) => void;
  update: (id: string, props: Record<string, string>) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  shift: (id: string, delta: -1 | 1) => void;
  saveAsComponent: (id: string, name: string) => void;
  removeSaved: (savedId: string) => void;
  setBrief: (brief: string) => void;
  setPalette: (palette: string) => void;
  setTheme: (theme: string) => void;
  setMotion: (motion: string) => void;
  setResult: (r: ReimagineResult | null) => void;
  /** Resultado do Reimaginar de qualquer página (a aberta vai para result). */
  setPageResult: (id: string, r: ReimagineResult | null) => void;
  setBusy: (b: boolean) => void;
  setSettings: (s: ProviderSettings) => void;
  reset: (tree?: DraftNode[]) => void;
  /** Dados do projeto aberto (o que vai para o snapshot e para o arquivo .json). */
  projectData: () => ProjectData;
  /** Troca o projeto aberto inteiro; desfazer não atravessa projetos. */
  loadProjectData: (d: ProjectData) => void;
}


function nodeFromPayload(state: StudioState, payload: Exclude<DragPayload, { kind: "move" }>): DraftNode | undefined {
  if (payload.kind === "new") return createNode(payload.type);
  const saved = state.saved.find((s) => s.id === payload.savedId);
  return saved ? cloneWithNewIds(saved.node) : undefined;
}

export const useStudio = create<StudioState>()(
  persist(
    temporal(
      (set, get) => ({
        tree: starterDraft(),
        selectedId: null,
        brief: "",
        palette: "auto",
        theme: "auto",
        motion: "auto",
        saved: [],
        result: null,
        busy: false,
        tab: "canvas",
        settings: {},
        mode: "ui",
        arch: { nodes: [], edges: [] },
        db: { tables: [], relations: [] },
        flowSel: null,
        suggestNotes: [],
        pages: [homePage()],
        pageId: HOME_ID,
        allPages: () => {
          const s = get();
          return commitActive(s.pages, s.pageId, s.tree, s.result);
        },
        replaceSite: (list) => {
          if (!list.length) return;
          const pages: Page[] = [];
          list.forEach((x, i) => pages.push({ id: i === 0 ? HOME_ID : newId("p"), name: x.name, slug: uniqueSlug(x.name, pages), tree: x.tree, result: null }));
          set({ pages, pageId: pages[0].id, tree: pages[0].tree, result: null, selectedId: null, tab: "canvas", reviews: {} });
          useStudio.temporal.getState().clear();
        },
        switchPage: (id) => {
          const s = get();
          if (id === s.pageId) return;
          const pages = s.allPages();
          const target = pages.find((p) => p.id === id);
          if (!target) return;
          set({ pages, pageId: id, tree: target.tree, result: target.result, selectedId: null, tab: !target.result && s.tab === "code" ? "canvas" : s.tab });
          // Desfazer não atravessa páginas.
          useStudio.temporal.getState().clear();
        },
        addPage: (name) => {
          const s = get();
          const clean = name.trim() || "Nova página";
          const tree = addLink(s.tree, clean);
          const pages = commitActive(s.pages, s.pageId, tree, s.result);
          const page: Page = { id: newId("p"), name: clean, slug: uniqueSlug(clean, pages), tree: newPageTree(clean, chromeOf(tree)), result: null };
          set({ pages: [...pages, page], pageId: page.id, tree: page.tree, result: null, selectedId: null, tab: "canvas" });
          useStudio.temporal.getState().clear();
        },
        renamePage: (id, name) => {
          const s = get();
          const clean = name.trim();
          const old = s.pages.find((p) => p.id === id);
          if (!clean || !old || clean === old.name) return;
          const tree = renameLink(s.tree, old.name, clean);
          const pages = commitActive(s.pages, s.pageId, tree, s.result).map((p) => (p.id === id ? { ...p, name: clean, slug: uniqueSlug(clean, s.pages, id) } : p));
          set({ pages, tree });
        },
        duplicatePage: (id) => {
          const s = get();
          const pages = s.allPages();
          const src = pages.find((p) => p.id === id);
          if (!src) return;
          const name = `${src.name} (cópia)`;
          const tree = addLink(s.tree, name);
          const synced = commitActive(pages, s.pageId, tree, s.result);
          const copy: Page = { ...structuredClone(src), id: newId("p"), name, slug: uniqueSlug(name, synced) };
          copy.tree = commitActive([copy], "", tree, null)[0].tree;
          set({ pages: [...synced, copy], pageId: copy.id, tree: copy.tree, result: copy.result, selectedId: null });
          useStudio.temporal.getState().clear();
        },
        removePage: (id) => {
          const s = get();
          if (s.pages.length < 2) return;
          const gone = s.pages.find((p) => p.id === id);
          if (!gone) return;
          const tree = removeLink(s.tree, gone.name);
          const pages = commitActive(s.pages, s.pageId, tree, s.result).filter((p) => p.id !== id);
          if (id !== s.pageId) {
            set({ pages, tree });
            return;
          }
          const next = pages[0];
          set({ pages, pageId: next.id, tree: commitActive([next], "", tree, null)[0].tree, result: next.result, selectedId: null });
          useStudio.temporal.getState().clear();
        },
        reviews: {},
        reactFiles: null,
        sketches: {},
        sketchDocs: {},
        setSketch: (id, dataUrl, shapes) => {
          // Limpa desenhos de blocos que não existem mais em nenhuma página.
          const alive = new Set<string>();
          const visit = (ns: DraftNode[]) => ns.forEach((n) => (alive.add(n.id), visit(n.children ?? [])));
          get().allPages().forEach((p) => visit(p.tree));
          alive.add(id);
          const keep = <T,>(m: Record<string, T>) => Object.fromEntries(Object.entries(m).filter(([k]) => alive.has(k)));
          const next = keep(get().sketches);
          const docs = keep(get().sketchDocs);
          if (dataUrl) next[id] = dataUrl;
          else delete next[id];
          if (shapes?.length) docs[id] = shapes;
          else delete docs[id];
          set({ sketches: next, sketchDocs: docs });
        },
        applySketch: (id, nodes) => {
          const s = get();
          const fitted = fitSketch(nodes, isNested(s.tree, id));
          if (!fitted.length) return;
          // O desenho fica guardado: se o Ctrl+Z trouxer o Bloco livre de volta, ele vem com o desenho.
          set({ tree: replaceNode(s.tree, id, fitted), selectedId: fitted[0].id });
        },
        reactEdited: false,
        setReactFiles: (reactFiles) => set({ reactFiles, reactEdited: false }),
        setReactFile: (path, content) => set({ reactFiles: { ...(get().reactFiles ?? {}), [path]: content }, reactEdited: true }),
        setReview: (r) => set({ reviews: { ...get().reviews, [r.mode]: r } }),

        setMode: (mode) => set({ mode, flowSel: null }),
        setArch: (g) => {
          const arch = typeof g === "function" ? g(get().arch) : g;
          // Autenticação Própria ligada a uma API: o diagrama ER ganha/completa users(email, password_hash).
          set({ arch, db: usesOwnAuth(arch) ? ensureAuthUsers(get().db) : get().db });
        },
        setDb: (m) => set({ db: typeof m === "function" ? m(get().db) : m }),
        setFlowSel: (flowSel) => set({ flowSel }),
        setSuggestNotes: (suggestNotes) => set({ suggestNotes }),
        select: (id) => set({ selectedId: id }),
        setTab: (tab) => set({ tab }),
        drop: (payload, target) => {
          const s = get();
          if (payload.kind === "move") {
            set({ tree: moveNode(s.tree, payload.id, target), selectedId: payload.id });
            return;
          }
          const node = nodeFromPayload(s, payload);
          if (node) set({ tree: insertNode(s.tree, node, target), selectedId: node.id });
        },
        addByClick: (payload) => {
          const s = get();
          const node = nodeFromPayload(s, payload);
          if (!node) return;
          // Selecionado é container -> entra nele; senão -> logo depois dele; senão -> fim da página.
          const sel = s.selectedId ? findNode(s.tree, s.selectedId) : undefined;
          let target: DropTarget = { kind: "inside", parentId: null };
          if (sel && BLOCKS[sel.type].container) target = { kind: "inside", parentId: sel.id };
          else if (sel) target = { kind: "after", targetId: sel.id };
          set({ tree: insertNode(s.tree, node, target), selectedId: node.id });
        },
        update: (id, props) => set({ tree: updateProps(get().tree, id, props) }),
        remove: (id) => {
          const s = get();
          const loc = locate(s.tree, id);
          const next = loc?.list[loc.index + 1]?.id ?? loc?.list[loc.index - 1]?.id ?? loc?.parent?.id ?? null;
          set({ tree: removeNode(s.tree, id), selectedId: next });
        },
        duplicate: (id) => {
          const r = duplicateNode(get().tree, id);
          set({ tree: r.tree, selectedId: r.newId ?? id });
        },
        shift: (id, delta) => set({ tree: shiftNode(get().tree, id, delta) }),
        saveAsComponent: (id, name) => {
          const node = findNode(get().tree, id);
          if (!node) return;
          set({ saved: [...get().saved, { id: newId("c"), name: name.trim() || "Meu componente", node: structuredClone(node) }] });
        },
        removeSaved: (savedId) => set({ saved: get().saved.filter((s) => s.id !== savedId) }),
        setBrief: (brief) => set({ brief }),
        setPalette: (palette) => set({ palette }),
        setTheme: (theme) => set({ theme }),
        setMotion: (motion) => set({ motion }),
        setResult: (result) => set({ result }),
        setPageResult: (id, result) => {
          if (id === get().pageId) set({ result });
          else set({ pages: get().pages.map((p) => (p.id === id ? { ...p, result } : p)) });
        },
        setBusy: (busy) => set({ busy }),
        setSettings: (settings) => set({ settings }),
        reset: (tree) => set({ tree: tree ?? [], selectedId: null }),
        projectData: () => {
          const s = get();
          // Grava a página aberta em pages antes de tirar a foto.
          const data = Object.fromEntries(PROJECT_KEYS.map((k) => [k, s[k]])) as unknown as ProjectData;
          return { ...data, pages: s.allPages() };
        },
        loadProjectData: (d) => {
          set({ ...blankProjectData(), ...d, selectedId: null, tab: "canvas", busy: false, reviews: {}, flowSel: null });
          useStudio.temporal.getState().clear();
        },
      }),
      {
        // Desfazer/refazer só olha a árvore do rascunho.
        partialize: (s) => ({ tree: s.tree }),
        limit: 100,
        equality: (a, b) => a.tree === b.tree,
      },
    ),
    {
      name: "vitrine-studio:v1",
      version: STUDIO_VERSION,
      // v1 tinha uma página só: ela vira a "Início".
      migrate: (persisted, version) => migrateStudio(persisted, version) as never,
      partialize: (s) => ({
        tree: s.tree,
        brief: s.brief,
        palette: s.palette,
        theme: s.theme,
        motion: s.motion,
        saved: s.saved,
        result: s.result,
        settings: s.settings,
        mode: s.mode,
        arch: s.arch,
        db: s.db,
        suggestNotes: s.suggestNotes,
        pages: s.pages,
        pageId: s.pageId,
        reactFiles: s.reactFiles,
        sketches: s.sketches,
        sketchDocs: s.sketchDocs,
        reactEdited: s.reactEdited,
      }),
    },
  ),
);

export const useHistory = () => useStudio.temporal.getState();
