// Auto-layout (dagre) para os canvases de Arquitetura e Banco: esquerda → direita,
// seguindo as ligações. Puro: devolve cópias com posições novas.
import dagre from "@dagrejs/dagre";
import type { ArchGraph } from "@/lib/arch/model";
import { fkColumns, type ErModel } from "@/lib/db/model";

interface Box {
  id: string;
  width: number;
  height: number;
}

function run(boxes: Box[], links: { from: string; to: string }[], opts: { nodesep: number; ranksep: number }): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: opts.nodesep, ranksep: opts.ranksep, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const b of boxes) g.setNode(b.id, { width: b.width, height: b.height });
  for (const l of links) if (l.from !== l.to && g.hasNode(l.from) && g.hasNode(l.to)) g.setEdge(l.from, l.to);
  dagre.layout(g);
  const out = new Map<string, { x: number; y: number }>();
  for (const b of boxes) {
    const n = g.node(b.id);
    // dagre devolve o centro; o React Flow usa o canto superior esquerdo.
    out.set(b.id, { x: Math.round(n.x - b.width / 2), y: Math.round(n.y - b.height / 2) });
  }
  return out;
}

export const ARCH_NODE = { width: 210, height: 90 };

export function layoutArch(g: ArchGraph): ArchGraph {
  if (!g.nodes.length) return g;
  const pos = run(
    g.nodes.map((n) => ({ id: n.id, ...ARCH_NODE })),
    g.edges.map((e) => ({ from: e.source, to: e.target })),
    { nodesep: 50, ranksep: 110 },
  );
  return { ...g, nodes: g.nodes.map((n) => ({ ...n, position: pos.get(n.id)! })) };
}

export const TABLE_WIDTH = 250;
const tableHeight = (cols: number) => 48 + cols * 28;

/** Pais à direita dos filhos não lê bem num ER: as setas vão do pai para o filho. */
export function layoutDb(m: ErModel): ErModel {
  if (!m.tables.length) return m;
  const fks = fkColumns(m);
  const pos = run(
    m.tables.map((t) => ({ id: t.id, width: TABLE_WIDTH, height: tableHeight(t.columns.length + fks.filter((f) => f.table.id === t.id).length) })),
    m.relations.map((r) => ({ from: r.to, to: r.from })),
    { nodesep: 40, ranksep: 90 },
  );
  return { ...m, tables: m.tables.map((t) => ({ ...t, position: pos.get(t.id)! })) };
}
