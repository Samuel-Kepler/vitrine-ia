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
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChangeset,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Boxes, Cloud, Cog, Database, Globe, HardDrive, KeyRound, Layers, Server, Trash2, Zap } from "lucide-react";
import { useStudio } from "@/lib/draft/store";
import { ARCH, ARCH_KINDS, EDGE_KINDS, EDGE_LABELS, authMode, defaultEdgeKind, type ArchKind, type ArchNode } from "@/lib/arch/model";
import { archFiles } from "@/lib/arch/codegen";
import { dbFiles } from "@/lib/db/codegen";
import { reviewArch } from "@/lib/review/rules";
import { useFlowNodes } from "@/components/flow/use-flow-nodes";
import { ReviewList } from "@/components/flow/ReviewList";
import { FilesPanel } from "@/components/flow/FilesPanel";
import { FlowSidebarFooter } from "@/components/flow/FlowSidebarFooter";
import { AiReviewPanel } from "@/components/review/AiReviewPanel";
import { LayoutButton } from "@/components/flow/LayoutButton";
import { layoutArch } from "@/lib/layout/auto";

export const ARCH_ICONS: Record<ArchKind, typeof Server> = {
  web: Globe,
  api: Server,
  service: Boxes,
  worker: Cog,
  queue: Layers,
  cache: Zap,
  postgres: Database,
  storage: HardDrive,
  external: Cloud,
  auth: KeyRound,
};

const input = "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
let seq = 0;
const nid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

function ArchNodeView({ data, selected }: NodeProps) {
  const node = (data as { node: ArchNode }).node;
  const def = ARCH[node.kind];
  const Icon = ARCH_ICONS[node.kind];
  const routes = (node.props.routes ?? "").split("\n").filter((r) => r.trim() && r.trim() !== "GET /health");
  return (
    <div className={`w-52 overflow-hidden rounded-lg border border-line bg-white shadow-sm ${selected ? "ring-2 ring-brand" : ""}`} style={{ borderTop: `3px solid ${def.color}` }}>
      <Handle type="target" position={Position.Left} className="!size-2.5 !border-2 !border-white !bg-ink" />
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <Icon size={14} style={{ color: def.color }} />
        <span className="truncate text-[13px] font-semibold text-ink">{node.name}</span>
      </div>
      <div className="px-3 py-2 text-[11px] text-gray-600">
        <p className="label-mono">{def.label}</p>
        {routes.slice(0, 4).map((r) => (
          <p key={r} className="truncate font-mono">
            {r}
          </p>
        ))}
        {routes.length > 4 ? <p className="text-muted">+{routes.length - 4} rotas</p> : null}
      </div>
      <Handle type="source" position={Position.Right} className="!size-2.5 !border-2 !border-white !bg-ink" />
    </div>
  );
}

const nodeTypes = { arch: ArchNodeView };

function Inner() {
  const arch = useStudio((s) => s.arch);
  const db = useStudio((s) => s.db);
  const setArch = useStudio((s) => s.setArch);
  const flowSel = useStudio((s) => s.flowSel);
  const setFlowSel = useStudio((s) => s.setFlowSel);
  const { screenToFlowPosition } = useReactFlow();
  const [showFiles, setShowFiles] = useState(false);

  const commit = useMemo(
    () => ({
      move: (id: string, position: { x: number; y: number }) =>
        setArch((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, position } : n)) })),
      remove: (ids: string[]) => {
        setArch((g) => ({ nodes: g.nodes.filter((n) => !ids.includes(n.id)), edges: g.edges.filter((e) => !ids.includes(e.source) && !ids.includes(e.target)) }));
        setFlowSel(null);
      },
    }),
    [setArch, setFlowSel],
  );
  const { nodes, onNodesChange } = useFlowNodes(arch.nodes, (n) => ({ id: n.id, type: "arch", position: n.position, data: { node: n } }), commit);

  const edges: Edge[] = useMemo(
    () =>
      arch.edges.map((e) => {
        const color = e.kind === "event" ? "#f59e0b" : e.kind === "http" ? "#6366f1" : "#10b981";
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          label: EDGE_LABELS[e.kind],
          animated: e.kind === "event",
          selected: flowSel?.kind === "edge" && flowSel.id === e.id,
          style: { stroke: color, strokeWidth: 2 },
          labelStyle: { fontSize: 11, fill: color, fontWeight: 600 },
          markerEnd: { type: MarkerType.ArrowClosed, color },
        };
      }),
    [arch.edges, flowSel],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChangeset<Edge>) => {
      const removed = [...changes].filter((c) => c.type === "remove").map((c) => c.id);
      if (removed.length) setArch((g) => ({ ...g, edges: g.edges.filter((e) => !removed.includes(e.id)) }));
    },
    [setArch],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return;
      setArch((g) => {
        if (g.edges.some((e) => e.source === c.source && e.target === c.target)) return g;
        const s = g.nodes.find((n) => n.id === c.source)!;
        const t = g.nodes.find((n) => n.id === c.target)!;
        return { ...g, edges: [...g.edges, { id: nid("e"), source: c.source, target: c.target, kind: defaultEdgeKind(s.kind, t.kind) }] };
      });
    },
    [setArch],
  );

  const addNode = (kind: ArchKind, position?: { x: number; y: number }) => {
    const count = arch.nodes.filter((n) => n.kind === kind).length;
    const node: ArchNode = {
      id: nid("a"),
      kind,
      name: count ? `${ARCH[kind].label} ${count + 1}` : ARCH[kind].label,
      props: { ...ARCH[kind].defaults },
      position: position ?? { x: 80 + arch.nodes.length * 30, y: 80 + arch.nodes.length * 30 },
    };
    setArch((g) => ({ ...g, nodes: [...g.nodes, node] }));
    setFlowSel({ kind: "node", id: node.id });
  };

  const findings = useMemo(() => reviewArch(arch, db), [arch, db]);
  const files = useMemo(() => (showFiles ? [...archFiles(arch, db), ...(db.tables.length ? dbFiles(db).filter((f) => f.path !== "db/schema.postgres.sql") : [])] : []), [showFiles, arch, db]);

  return (
    <>
      <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-line bg-panel p-3" aria-label="Blocos de arquitetura">
        <p className="pb-3 text-xs text-muted">Arraste para o canvas e ligue as bolinhas: da direita (quem chama) para a esquerda (quem é chamado).</p>
        <div className="grid grid-cols-2 gap-1.5">
          {ARCH_KINDS.map((k) => {
            const Icon = ARCH_ICONS[k];
            return (
              <button
                key={k}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("application/x-arch", k)}
                onClick={() => addNode(k)}
                title={ARCH[k].hint}
                data-testid={`arch-palette-${k}`}
                className="flex cursor-grab flex-col items-start gap-1 rounded-lg border border-line bg-white px-2.5 py-2 text-left text-xs hover:border-brand hover:bg-brand-soft"
              >
                <Icon size={16} style={{ color: ARCH[k].color }} />
                <span className="font-medium">{ARCH[k].label}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <div
        className="relative flex-1"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("application/x-arch")) e.preventDefault();
        }}
        onDrop={(e) => {
          const kind = e.dataTransfer.getData("application/x-arch") as ArchKind;
          if (!kind) return;
          e.preventDefault();
          addNode(kind, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
        }}
      >
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
          deleteKeyCode={["Delete", "Backspace"]}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} />
          <Controls position="bottom-left" />
          <LayoutButton disabled={arch.nodes.length < 2} onLayout={() => setArch((g) => layoutArch(g))} />
        </ReactFlow>
        {arch.nodes.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="max-w-sm rounded-lg bg-white/90 p-4 text-center text-sm text-muted shadow-sm">
              Arraste blocos da esquerda ou clique em <b>Sugerir da landing</b> para a IA propor a arquitetura a partir do seu rascunho.
            </p>
          </div>
        ) : null}
      </div>

      <aside className="w-80 shrink-0 overflow-y-auto border-l border-line bg-panel" aria-label="Propriedades da arquitetura">
        {flowSel?.kind === "node" && arch.nodes.some((n) => n.id === flowSel.id) ? (
          <NodeEditor id={flowSel.id} />
        ) : flowSel?.kind === "edge" && arch.edges.some((e) => e.id === flowSel.id) ? (
          <EdgeEditor id={flowSel.id} />
        ) : (
          <div className="p-4">
            <h2 className="mb-3 font-semibold">Revisão</h2>
            <AiReviewPanel mode="arch" hideRules onPick={(id) => setFlowSel({ kind: "node", id })} />
            <h3 className="mb-2 mt-4 border-t border-line pt-3 label-mono">Regras</h3>
            <ReviewList findings={findings} onPick={(id) => setFlowSel({ kind: arch.edges.some((e) => e.id === id) ? "edge" : "node", id })} />
            <FlowSidebarFooter
              generateLabel="Gerar moldes do backend"
              disabled={!arch.nodes.some((n) => ARCH[n.kind].runnable)}
              disabledHint="Adicione ao menos uma API, Serviço ou Worker."
              onGenerate={() => setShowFiles(true)}
            />
          </div>
        )}
      </aside>
      {showFiles ? <FilesPanel title="Moldes do backend" files={files} zipName="backend.zip" onClose={() => setShowFiles(false)} /> : null}
    </>
  );
}

function NodeEditor({ id }: { id: string }) {
  const node = useStudio((s) => s.arch.nodes.find((n) => n.id === id))!;
  const setArch = useStudio((s) => s.setArch);
  const setFlowSel = useStudio((s) => s.setFlowSel);
  const def = ARCH[node.kind];
  const patch = (p: Partial<ArchNode>) => setArch((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, ...p } : n)) }));
  return (
    <div className="p-4">
      <p className="mb-1 text-xs font-medium" style={{ color: def.color }}>
        {def.label}
      </p>
      <p className="mb-4 text-xs text-muted">{def.hint}</p>
      <label className="block">
        <span className="mb-1 block text-xs font-medium">Nome</span>
        <input className={input} value={node.name} onChange={(e) => patch({ name: e.target.value })} />
      </label>
      {def.fields
        .filter((f) => !f.showIf || (node.props[f.showIf.key] ?? def.defaults[f.showIf.key]) === f.showIf.value)
        .map((f) => (
        <label key={f.key} className="mt-3 block">
          <span className="mb-1 block text-xs font-medium">{f.label}</span>
          {f.kind === "select" ? (
            <select
              className={input}
              data-testid={`field-${f.key}`}
              value={node.props[f.key] ?? def.defaults[f.key] ?? ""}
              onChange={(e) => patch({ props: { ...node.props, [f.key]: e.target.value } })}
            >
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.kind === "lines" ? (
            <textarea
              className={`${input} min-h-32 font-mono text-xs`}
              placeholder={f.placeholder}
              value={node.props[f.key] ?? ""}
              onChange={(e) => patch({ props: { ...node.props, [f.key]: e.target.value } })}
            />
          ) : (
            <input className={input} placeholder={f.placeholder} value={node.props[f.key] ?? ""} onChange={(e) => patch({ props: { ...node.props, [f.key]: e.target.value } })} />
          )}
          {f.help ? <span className="mt-1 block text-[11px] text-muted">{f.help}</span> : null}
        </label>
      ))}
      {node.kind === "auth" && authMode(node) === "propria" ? (
        <p className="mt-2 text-[11px] text-muted">Ligue uma API → Autenticação. A API precisa gravar no Postgres; a tabela users entra no canvas Banco automaticamente.</p>
      ) : null}
      {node.kind === "api" || node.kind === "service" ? (
        <p className="mt-2 text-[11px] text-muted">Rota com nome de tabela (ex.: POST /leads) + ligação “grava” no Postgres = handler com SQL pronto.</p>
      ) : null}
      <button
        className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-md border border-line py-2 text-sm hover:border-red-300 hover:bg-red-50 hover:text-red-600"
        onClick={() => {
          setArch((g) => ({ nodes: g.nodes.filter((n) => n.id !== id), edges: g.edges.filter((e) => e.source !== id && e.target !== id) }));
          setFlowSel(null);
        }}
      >
        <Trash2 size={15} /> Apagar bloco
      </button>
    </div>
  );
}

function EdgeEditor({ id }: { id: string }) {
  const edge = useStudio((s) => s.arch.edges.find((e) => e.id === id))!;
  const nodes = useStudio((s) => s.arch.nodes);
  const setArch = useStudio((s) => s.setArch);
  const setFlowSel = useStudio((s) => s.setFlowSel);
  const name = (nid: string) => nodes.find((n) => n.id === nid)?.name ?? "?";
  const patch = (p: Partial<typeof edge>) => setArch((g) => ({ ...g, edges: g.edges.map((e) => (e.id === id ? { ...e, ...p } : e)) }));
  return (
    <div className="p-4">
      <h2 className="mb-4 font-semibold">
        {name(edge.source)} → {name(edge.target)}
      </h2>
      <label className="block">
        <span className="mb-1 block text-xs font-medium">Tipo de ligação</span>
        <select className={input} value={edge.kind} onChange={(e) => patch({ kind: e.target.value as typeof edge.kind })}>
          {EDGE_KINDS.map((k) => (
            <option key={k} value={k}>
              {EDGE_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="rounded-md border border-line py-2 text-sm hover:bg-gray-50" onClick={() => patch({ source: edge.target, target: edge.source })}>
          Inverter
        </button>
        <button
          className="rounded-md border border-line py-2 text-sm hover:border-red-300 hover:bg-red-50 hover:text-red-600"
          onClick={() => {
            setArch((g) => ({ ...g, edges: g.edges.filter((e) => e.id !== id) }));
            setFlowSel(null);
          }}
        >
          Apagar
        </button>
      </div>
    </div>
  );
}

export default function ArchCanvas() {
  return (
    <ReactFlowProvider>
      <Inner />
    </ReactFlowProvider>
  );
}
