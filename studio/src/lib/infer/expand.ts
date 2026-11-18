// Formato compacto (IA ou inferência) -> grafo/ER completos com ids e posições.
import { ARCH, type ArchGraph, type ArchKind } from "@/lib/arch/model";
import { snake, type ErModel } from "@/lib/db/model";
import type { CompactArch, CompactDb } from "./from-draft";

let n = 0;
const id = (p: string) => `${p}${Date.now().toString(36)}${(n++).toString(36)}`;

/** Colunas por "camada": front, API/serviços, mensageria/workers, dados/externos. */
const LAYER: Record<ArchKind, number> = { web: 0, auth: 4, api: 1, service: 2, queue: 2, worker: 3, cache: 3, postgres: 3, storage: 3, external: 4 };

const DATA = new Set<ArchKind>(["postgres", "cache", "storage"]);

export function expandArch(c: CompactArch): ArchGraph {
  const keyToId = new Map<string, string>();
  const perLayer = new Map<number, number>();
  const nodes = c.nodes
    .filter((x) => ARCH[x.kind])
    .map((x) => {
      const layer = LAYER[x.kind];
      const row = perLayer.get(layer) ?? 0;
      perLayer.set(layer, row + 1);
      const nid = id("a");
      keyToId.set(x.key, nid);
      const props: Record<string, string> = { ...ARCH[x.kind].defaults };
      if (x.routes?.length) props.routes = [...new Set(x.routes)].join("\n");
      if (x.kind === "postgres") props.database = "app";
      return { id: nid, kind: x.kind, name: x.name, props, position: { x: 40 + layer * 260, y: 40 + row * 150 } };
    });
  const edges = c.edges
    .filter((e) => keyToId.has(e.from) && keyToId.has(e.to))
    .map((e) => ({ id: id("e"), source: keyToId.get(e.from)!, target: keyToId.get(e.to)!, kind: e.kind }));

  // Banco, cache e arquivos vão para uma faixa ABAIXO de quem os usa. Na mesma
  // linha das colunas, a ligação api → postgres atravessava a Fila e o rótulo
  // "grava" parecia sair dela.
  const byId = new Map(nodes.map((nd) => [nd.id, nd]));
  const bandY = 40 + Math.max(1, ...perLayer.values()) * 150 + 40;
  const usedX = new Map<number, number>();
  for (const nd of nodes.filter((x) => DATA.has(x.kind))) {
    const writer = edges.map((e) => (e.target === nd.id ? byId.get(e.source) : undefined)).find((s) => s && !DATA.has(s.kind));
    const x = writer?.position.x ?? 40 + 3 * 260;
    const row = usedX.get(x) ?? 0;
    usedX.set(x, row + 1);
    nd.position = { x: x + row * 230, y: bandY };
  }
  return { nodes, edges };
}

export function expandDb(c: CompactDb): ErModel {
  const nameToId = new Map<string, string>();
  const tables = c.tables.map((t, i) => {
    const tid = id("t");
    nameToId.set(snake(t.name), tid);
    return {
      id: tid,
      name: snake(t.name),
      columns: t.columns.map((col) => ({ id: id("c"), ...col, name: snake(col.name) })),
      position: { x: 40 + (i % 3) * 300, y: 40 + Math.floor(i / 3) * 280 },
    };
  });
  const relations = c.relations
    .filter((r) => nameToId.has(snake(r.from)) && nameToId.has(snake(r.to)))
    .map((r) => ({ id: id("r"), from: nameToId.get(snake(r.from))!, to: nameToId.get(snake(r.to))!, kind: r.kind, onDelete: "cascade" as const }));
  return { tables, relations };
}
