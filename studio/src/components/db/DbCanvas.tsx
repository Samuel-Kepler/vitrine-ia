"use client";
import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type EdgeChangeset,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { ArrowLeftRight, FileUp, KeyRound, Link2, Plus, Table2, Trash2 } from "lucide-react";
import { useStudio } from "@/lib/draft/store";
import { COL_TYPES, ON_DELETE, REL_KINDS, REL_LABELS, fkColumns, snake, type Column, type ErModel, type Table } from "@/lib/db/model";
import { dbFiles } from "@/lib/db/codegen";
import { reviewDb } from "@/lib/review/rules";
import { useFlowNodes } from "@/components/flow/use-flow-nodes";
import { ReviewList } from "@/components/flow/ReviewList";
import { FilesPanel } from "@/components/flow/FilesPanel";
import { FlowSidebarFooter } from "@/components/flow/FlowSidebarFooter";
import { AiReviewPanel } from "@/components/review/AiReviewPanel";
import { LayoutButton } from "@/components/flow/LayoutButton";
import { layoutDb } from "@/lib/layout/auto";
import { ImportDialog } from "./ImportDialog";
import { ResizableAside } from "@/components/studio/ResizableAside";

const input = "w-full rounded-md border border-line bg-white px-2 py-1 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
let seq = 0;
const nid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

type TableData = { table: Table; fks: { name: string; type: string; ref: string }[] };

function TableNodeView({ data, selected }: NodeProps) {
  const { table, fks } = data as TableData;
  return (
    <div className={`w-60 overflow-hidden rounded-lg border border-line bg-white text-xs shadow-sm ${selected ? "ring-2 ring-brand" : ""}`} style={{ borderTop: "3px solid #059669" }}>
      <Handle type="target" position={Position.Left} className="!size-2.5 !border-2 !border-white !bg-ink" />
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <Table2 size={14} className="text-emerald-700" />
        <span className="font-mono text-[12.5px] font-semibold text-ink">{snake(table.name)}</span>
      </div>
      <ul className="divide-y divide-gray-100">
        {table.columns.map((c) => (
          <li key={c.id} className="flex items-center gap-1.5 px-3 py-1">
            {c.pk ? <KeyRound size={11} className="text-amber-500" /> : <span className="w-[11px]" />}
            <span className={c.pk ? "font-semibold" : ""}>{snake(c.name)}</span>
            <span className="ml-auto font-mono text-muted">
              {c.type}
              {c.nullable ? "?" : ""}
            </span>
          </li>
        ))}
        {fks.map((f) => (
          <li key={f.name} className="flex items-center gap-1.5 bg-sky-50/60 px-3 py-1 text-sky-800" title={`→ ${f.ref}`}>
            <Link2 size={11} />
            <span>{f.name}</span>
            <span className="ml-auto font-mono">{f.type}</span>
          </li>
        ))}
      </ul>
      <Handle type="source" position={Position.Right} className="!size-2.5 !border-2 !border-white !bg-ink" />
    </div>
  );
}

const nodeTypes = { table: TableNodeView };

function newTable(model: ErModel, position?: { x: number; y: number }): Table {
  let name = "nova_tabela";
  for (let i = 2; model.tables.some((t) => t.name === name); i++) name = `nova_tabela_${i}`;
  return {
    id: nid("t"),
    name,
    columns: [
      { id: nid("c"), name: "id", type: "uuid", pk: true, default: "uuid" },
      { id: nid("c"), name: "created_at", type: "timestamp", default: "now" },
    ],
    position: position ?? { x: 60 + model.tables.length * 40, y: 60 + model.tables.length * 40 },
  };
}

function Inner() {
  const db = useStudio((s) => s.db);
  const setDb = useStudio((s) => s.setDb);
  const flowSel = useStudio((s) => s.flowSel);
  const setFlowSel = useStudio((s) => s.setFlowSel);
  const [showFiles, setShowFiles] = useState(false);

  const fks = useMemo(() => fkColumns(db), [db]);
  const commit = useMemo(
    () => ({
      move: (id: string, position: { x: number; y: number }) => setDb((m) => ({ ...m, tables: m.tables.map((t) => (t.id === id ? { ...t, position } : t)) })),
      remove: (ids: string[]) => {
        setDb((m) => ({ tables: m.tables.filter((t) => !ids.includes(t.id)), relations: m.relations.filter((r) => !ids.includes(r.from) && !ids.includes(r.to)) }));
        setFlowSel(null);
      },
    }),
    [setDb, setFlowSel],
  );
  const { nodes, onNodesChange } = useFlowNodes(
    db.tables,
    (t) => ({
      id: t.id,
      type: "table",
      position: t.position,
      data: { table: t, fks: fks.filter((f) => f.table.id === t.id).map((f) => ({ name: f.name, type: f.type, ref: f.ref.name })) } satisfies TableData,
    }),
    commit,
    db.relations,
  );

  const edges: Edge[] = useMemo(
    () =>
      db.relations.map((r) => ({
        id: r.id,
        source: r.from,
        target: r.to,
        label: r.kind,
        selected: flowSel?.kind === "edge" && flowSel.id === r.id,
        style: { stroke: "#0ea5e9", strokeWidth: 2, strokeDasharray: r.kind === "n-n" ? "6 4" : undefined },
        labelStyle: { fontSize: 11, fill: "#0369a1", fontWeight: 700 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#0ea5e9" },
      })),
    [db.relations, flowSel],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChangeset<Edge>) => {
      const removed = [...changes].filter((c) => c.type === "remove").map((c) => c.id);
      if (removed.length) setDb((m) => ({ ...m, relations: m.relations.filter((r) => !removed.includes(r.id)) }));
    },
    [setDb],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return;
      setDb((m) => {
        if (m.relations.some((r) => r.from === c.source && r.to === c.target)) return m;
        return { ...m, relations: [...m.relations, { id: nid("r"), from: c.source!, to: c.target!, kind: "n-1", onDelete: "cascade" }] };
      });
    },
    [setDb],
  );

  const addTable = () => {
    const t = newTable(db);
    setDb((m) => ({ ...m, tables: [...m.tables, t] }));
    setFlowSel({ kind: "node", id: t.id });
  };

  const [showImport, setShowImport] = useState(false);
  const findings = useMemo(() => reviewDb(db), [db]);
  const files = useMemo(() => (showFiles ? dbFiles(db) : []), [showFiles, db]);

  return (
    <>
      <ResizableAside side="left" storageKey="studio.left" defaultWidth={288} className="flex shrink-0 flex-col gap-3 overflow-y-auto border-r border-line bg-panel p-3" aria-label="Ferramentas do banco">
        <button onClick={addTable} data-testid="add-table" className="flex items-center justify-center gap-2 rounded-lg bg-ink py-2 text-sm font-medium text-white hover:opacity-90">
          <Plus size={16} /> Nova tabela
        </button>
        <button onClick={() => setShowImport(true)} data-testid="import-schema" className="flex items-center justify-center gap-2 rounded-lg border border-line bg-white py-2 text-sm hover:bg-gray-50">
          <FileUp size={16} /> Importar DBML/SQL
        </button>
        <p className="text-xs text-muted">
          Para relacionar, arraste da bolinha <b>direita</b> da tabela filha (que recebe a chave estrangeira) até a bolinha <b>esquerda</b> da tabela pai.
        </p>
        <p className="text-xs text-muted">As colunas de chave estrangeira (azuis) são criadas pelas relações. Muitos-para-muitos gera a tabela de junção sozinho.</p>
      </ResizableAside>

      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, n: Node) => setFlowSel({ kind: "node", id: n.id })}
          onEdgeClick={(_, e: Edge) => setFlowSel({ kind: "edge", id: e.id })}
          onPaneClick={() => setFlowSel(null)}
          deleteKeyCode={["Delete"]}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} />
          <Controls position="bottom-left" />
          <LayoutButton disabled={db.tables.length < 2} onLayout={() => setDb((m) => layoutDb(m))} />
        </ReactFlow>
        {db.tables.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="max-w-sm rounded-lg bg-white/90 p-4 text-center text-sm text-muted shadow-sm">
              Crie tabelas à esquerda ou clique em <b>Sugerir da landing</b>: o formulário vira a tabela de leads, os planos viram plans e subscriptions…
            </p>
          </div>
        ) : null}
      </div>

      <ResizableAside side="right" storageKey="studio.right" defaultWidth={336} className="shrink-0 overflow-y-auto border-l border-line bg-panel" aria-label="Propriedades do banco">
        {flowSel?.kind === "node" && db.tables.some((t) => t.id === flowSel.id) ? (
          <TableEditor id={flowSel.id} />
        ) : flowSel?.kind === "edge" && db.relations.some((r) => r.id === flowSel.id) ? (
          <RelationEditor id={flowSel.id} />
        ) : (
          <div className="p-4">
            <h2 className="mb-3 font-semibold">Revisão</h2>
            <AiReviewPanel mode="db" hideRules onPick={(id) => setFlowSel({ kind: "node", id })} />
            <h3 className="mb-2 mt-4 border-t border-line pt-3 label-mono">Regras</h3>
            <ReviewList findings={findings} onPick={(id) => setFlowSel({ kind: "node", id })} />
            <FlowSidebarFooter generateLabel="Gerar schema (SQL, Prisma, Drizzle, DBML)" disabled={db.tables.length === 0} disabledHint="Crie ao menos uma tabela." onGenerate={() => setShowFiles(true)} />
          </div>
        )}
      </ResizableAside>
      {showImport ? <ImportDialog onClose={() => setShowImport(false)} /> : null}
      {showFiles ? <FilesPanel title="Schema do banco" files={files} zipName="banco.zip" onClose={() => setShowFiles(false)} /> : null}
    </>
  );
}

function TableEditor({ id }: { id: string }) {
  const table = useStudio((s) => s.db.tables.find((t) => t.id === id))!;
  const setDb = useStudio((s) => s.setDb);
  const setFlowSel = useStudio((s) => s.setFlowSel);
  const patchTable = (p: Partial<Table>) => setDb((m) => ({ ...m, tables: m.tables.map((t) => (t.id === id ? { ...t, ...p } : t)) }));
  const patchCol = (cid: string, p: Partial<Column>) => patchTable({ columns: table.columns.map((c) => (c.id === cid ? { ...c, ...p } : c)) });

  return (
    <div className="p-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium">Nome da tabela</span>
        <input className={input} value={table.name} onChange={(e) => patchTable({ name: e.target.value })} />
      </label>
      <div className="mt-4 mb-1 grid grid-cols-[1fr_92px_repeat(3,22px)_24px] items-center gap-1 text-[10px] font-semibold uppercase text-muted">
        <span>coluna</span>
        <span>tipo</span>
        <span title="Chave primária">PK</span>
        <span title="Aceita vazio (null)">∅</span>
        <span title="Único">U</span>
        <span />
      </div>
      <ul className="space-y-1.5">
        {table.columns.map((c) => (
          <li key={c.id} className="rounded-md border border-line p-1.5">
            <div className="grid grid-cols-[1fr_92px_repeat(3,22px)_24px] items-center gap-1">
              <input className={input} value={c.name} aria-label="Nome da coluna" onChange={(e) => patchCol(c.id, { name: e.target.value })} />
              <select className={`${input} px-1`} value={c.type} aria-label="Tipo" onChange={(e) => patchCol(c.id, { type: e.target.value as Column["type"] })}>
                {COL_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <input type="checkbox" aria-label="Chave primária" checked={!!c.pk} onChange={(e) => patchCol(c.id, { pk: e.target.checked })} />
              <input type="checkbox" aria-label="Aceita nulo" checked={!!c.nullable} onChange={(e) => patchCol(c.id, { nullable: e.target.checked })} />
              <input type="checkbox" aria-label="Único" checked={!!c.unique} onChange={(e) => patchCol(c.id, { unique: e.target.checked })} />
              <button className="text-muted hover:text-red-600" aria-label={`Apagar coluna ${c.name}`} onClick={() => patchTable({ columns: table.columns.filter((x) => x.id !== c.id) })}>
                <Trash2 size={14} />
              </button>
            </div>
            <input
              className={`${input} mt-1 text-xs`}
              placeholder="padrão: now, uuid, autoincrement ou um valor"
              value={c.default ?? ""}
              onChange={(e) => patchCol(c.id, { default: e.target.value || undefined })}
            />
          </li>
        ))}
      </ul>
      <button
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-line py-1.5 text-sm hover:border-brand hover:text-brand"
        onClick={() => patchTable({ columns: [...table.columns, { id: nid("c"), name: `coluna_${table.columns.length + 1}`, type: "varchar" }] })}
      >
        <Plus size={14} /> coluna
      </button>
      <button
        className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-md border border-line py-2 text-sm hover:border-red-300 hover:bg-red-50 hover:text-red-600"
        onClick={() => {
          setDb((m) => ({ tables: m.tables.filter((t) => t.id !== id), relations: m.relations.filter((r) => r.from !== id && r.to !== id) }));
          setFlowSel(null);
        }}
      >
        <Trash2 size={15} /> Apagar tabela
      </button>
    </div>
  );
}

function RelationEditor({ id }: { id: string }) {
  const rel = useStudio((s) => s.db.relations.find((r) => r.id === id))!;
  const tables = useStudio((s) => s.db.tables);
  const setDb = useStudio((s) => s.setDb);
  const setFlowSel = useStudio((s) => s.setFlowSel);
  const name = (tid: string) => tables.find((t) => t.id === tid)?.name ?? "?";
  const patch = (p: Partial<typeof rel>) => setDb((m) => ({ ...m, relations: m.relations.map((r) => (r.id === id ? { ...r, ...p } : r)) }));
  return (
    <div className="p-4">
      <h2 className="mb-1 font-semibold">
        {name(rel.from)} → {name(rel.to)}
      </h2>
      <p className="mb-4 text-xs text-muted">{rel.kind === "n-n" ? `Gera a tabela ${name(rel.from)}_${name(rel.to)}.` : `${name(rel.from)} recebe a coluna de chave estrangeira.`}</p>
      <label className="block">
        <span className="mb-1 block text-xs font-medium">Cardinalidade</span>
        <select className={input} value={rel.kind} onChange={(e) => patch({ kind: e.target.value as typeof rel.kind })}>
          {REL_KINDS.map((k) => (
            <option key={k} value={k}>
              {REL_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      {rel.kind !== "n-n" ? (
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium">Ao apagar o pai</span>
          <select className={input} value={rel.onDelete} onChange={(e) => patch({ onDelete: e.target.value as typeof rel.onDelete })}>
            {ON_DELETE.map((k) => (
              <option key={k} value={k}>
                {k === "cascade" ? "apagar os filhos (cascade)" : k === "set null" ? "deixar vazio (set null)" : "impedir (restrict)"}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="flex items-center justify-center gap-1 rounded-md border border-line py-2 text-sm hover:bg-gray-50" onClick={() => patch({ from: rel.to, to: rel.from })}>
          <ArrowLeftRight size={14} /> Inverter
        </button>
        <button
          className="rounded-md border border-line py-2 text-sm hover:border-red-300 hover:bg-red-50 hover:text-red-600"
          onClick={() => {
            setDb((m) => ({ ...m, relations: m.relations.filter((r) => r.id !== id) }));
            setFlowSel(null);
          }}
        >
          Apagar
        </button>
      </div>
    </div>
  );
}

export default function DbCanvas() {
  return (
    <ReactFlowProvider>
      <Inner />
    </ReactFlowProvider>
  );
}
