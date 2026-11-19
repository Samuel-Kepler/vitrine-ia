import { z } from "zod";
import { BLOCKS, BLOCK_TYPES, type BlockType } from "./blocks";

export interface DraftNode {
  id: string;
  type: BlockType;
  props: Record<string, string>;
  children?: DraftNode[];
}

export const DraftNodeSchema: z.ZodType<DraftNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(64),
    type: z.enum(BLOCK_TYPES),
    props: z.record(z.string().max(4000)),
    children: z.array(DraftNodeSchema).max(200).optional(),
  }),
);

export const DraftSchema = z.array(DraftNodeSchema).max(200);

let counter = 0;
export function newId(prefix = "b"): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function createNode(type: BlockType): DraftNode {
  const def = BLOCKS[type];
  return { id: newId(), type, props: { ...def.defaults }, ...(def.container ? { children: [] } : {}) };
}

export function cloneWithNewIds(node: DraftNode): DraftNode {
  return { ...node, id: newId(), props: { ...node.props }, children: node.children?.map(cloneWithNewIds) };
}

export function findNode(tree: DraftNode[], id: string): DraftNode | undefined {
  for (const n of tree) {
    if (n.id === id) return n;
    const found = n.children && findNode(n.children, id);
    if (found) return found;
  }
  return undefined;
}

/** Retorna [lista que contém o nó, índice] ou undefined. */
export function locate(tree: DraftNode[], id: string): { list: DraftNode[]; index: number; parent?: DraftNode } | undefined {
  const walk = (list: DraftNode[], parent?: DraftNode): ReturnType<typeof locate> => {
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) return { list, index: i, parent };
      const kids = list[i].children;
      if (kids) {
        const r = walk(kids, list[i]);
        if (r) return r;
      }
    }
    return undefined;
  };
  return walk(tree);
}

export function isDescendant(tree: DraftNode[], ancestorId: string, id: string): boolean {
  const anc = findNode(tree, ancestorId);
  return !!anc?.children && !!findNode(anc.children, id);
}

/** Onde soltar: dentro de um container (no fim) ou antes/depois de um nó. */
export type DropTarget =
  | { kind: "inside"; parentId: string | null }
  | { kind: "before" | "after"; targetId: string };

function clone(tree: DraftNode[]): DraftNode[] {
  return structuredClone(tree);
}

function insertAt(tree: DraftNode[], node: DraftNode, target: DropTarget): DraftNode[] | null {
  if (target.kind === "inside") {
    if (target.parentId === null) {
      tree.push(node);
      return tree;
    }
    const parent = findNode(tree, target.parentId);
    if (!parent || !BLOCKS[parent.type].container) return null;
    (parent.children ??= []).push(node);
    return tree;
  }
  const loc = locate(tree, target.targetId);
  if (!loc) return null;
  loc.list.splice(target.kind === "before" ? loc.index : loc.index + 1, 0, node);
  return tree;
}

export function insertNode(tree: DraftNode[], node: DraftNode, target: DropTarget): DraftNode[] {
  return insertAt(clone(tree), node, target) ?? tree;
}

export function moveNode(tree: DraftNode[], id: string, target: DropTarget): DraftNode[] {
  if (target.kind !== "inside" && target.targetId === id) return tree;
  const targetRef = target.kind === "inside" ? target.parentId : target.targetId;
  if (targetRef && (targetRef === id || isDescendant(tree, id, targetRef))) return tree;
  const next = clone(tree);
  const loc = locate(next, id);
  if (!loc) return tree;
  const [node] = loc.list.splice(loc.index, 1);
  return insertAt(next, node, target) ?? tree;
}

export function removeNode(tree: DraftNode[], id: string): DraftNode[] {
  const next = clone(tree);
  const loc = locate(next, id);
  if (!loc) return tree;
  loc.list.splice(loc.index, 1);
  return next;
}

/** Troca um bloco por outros no mesmo lugar (ex.: Bloco livre -> seção gerada do desenho). */
export function replaceNode(tree: DraftNode[], id: string, nodes: DraftNode[]): DraftNode[] {
  const next = clone(tree);
  const loc = locate(next, id);
  if (!loc) return tree;
  loc.list.splice(loc.index, 1, ...nodes);
  return next;
}

/** true se o bloco está dentro de um container (seção, linha, coluna, cartão). */
export function isNested(tree: DraftNode[], id: string): boolean {
  return !!locate(tree, id)?.parent;
}

export function updateProps(tree: DraftNode[], id: string, props: Record<string, string>): DraftNode[] {
  const next = clone(tree);
  const node = findNode(next, id);
  if (!node) return tree;
  node.props = { ...node.props, ...props };
  return next;
}

export function duplicateNode(tree: DraftNode[], id: string): { tree: DraftNode[]; newId?: string } {
  const node = findNode(tree, id);
  if (!node) return { tree };
  const copy = cloneWithNewIds(node);
  return { tree: insertNode(tree, copy, { kind: "after", targetId: id }), newId: copy.id };
}

export function shiftNode(tree: DraftNode[], id: string, delta: -1 | 1): DraftNode[] {
  const next = clone(tree);
  const loc = locate(next, id);
  if (!loc) return tree;
  const j = loc.index + delta;
  if (j < 0 || j >= loc.list.length) return tree;
  [loc.list[loc.index], loc.list[j]] = [loc.list[j], loc.list[loc.index]];
  return next;
}

export function countNodes(tree: DraftNode[]): number {
  return tree.reduce((n, node) => n + 1 + countNodes(node.children ?? []), 0);
}

export function lines(value: string | undefined): string[] {
  return (value ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
