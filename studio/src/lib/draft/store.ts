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
  shiftNode,
  updateProps,
  type DraftNode,
  type DropTarget,
} from "./tree";
import { starterDraft } from "./starter";
import type { ReimagineResult } from "@/lib/reimagine/reimagine";
import type { ProviderSettings } from "@/lib/ai/settings";
import { usesOwnAuth, type ArchGraph } from "@/lib/arch/model";
import { ensureAuthUsers, type ErModel } from "@/lib/db/model";
import type { AiReviewResult, ReviewMode } from "@/lib/review/ai-input";

export interface SavedComponent {
  id: string;
  name: string;
  node: DraftNode;
}

export type DragPayload = { kind: "new"; type: BlockType } | { kind: "saved"; savedId: string } | { kind: "move"; id: string };

export type StudioTab = "canvas" | "landing" | "code";
export type StudioMode = "ui" | "arch" | "db";
export type FlowSelection = { kind: "node" | "edge"; id: string } | null;

interface StudioState {
  tree: DraftNode[];
  selectedId: string | null;
  brief: string;
  palette: string; // "auto" ou um nome de paleta
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
  setResult: (r: ReimagineResult | null) => void;
  setBusy: (b: boolean) => void;
  setSettings: (s: ProviderSettings) => void;
  reset: (tree?: DraftNode[]) => void;
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
        reviews: {},
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
        setResult: (result) => set({ result }),
        setBusy: (busy) => set({ busy }),
        setSettings: (settings) => set({ settings }),
        reset: (tree) => set({ tree: tree ?? [], selectedId: null }),
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
      version: 1,
      partialize: (s) => ({
        tree: s.tree,
        brief: s.brief,
        palette: s.palette,
        saved: s.saved,
        result: s.result,
        settings: s.settings,
        mode: s.mode,
        arch: s.arch,
        db: s.db,
        suggestNotes: s.suggestNotes,
      }),
    },
  ),
);

export const useHistory = () => useStudio.temporal.getState();
