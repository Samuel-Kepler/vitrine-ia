"use client";
import { createContext, useContext, useState } from "react";
import { MousePointer2 } from "lucide-react";
import { BLOCKS } from "@/lib/draft/blocks";
import { lines, type DraftNode, type DropTarget } from "@/lib/draft/tree";
import { useStudio } from "@/lib/draft/store";
import { BlockIcon } from "./icons";
import { endDrag, readDrop, startDrag } from "./dnd";

type Indicator = DropTarget | null;
const DropCtx = createContext<{ indicator: Indicator; setIndicator: (i: Indicator) => void }>({
  indicator: null,
  setIndicator: () => {},
});

function sameTarget(a: Indicator, b: Indicator) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Canvas do rascunho de UI: wireframe editável com arrastar e soltar. */
export function Canvas() {
  const tree = useStudio((s) => s.tree);
  const select = useStudio((s) => s.select);
  const drop = useStudio((s) => s.drop);
  const [indicator, setIndicatorState] = useState<Indicator>(null);
  const setIndicator = (i: Indicator) => setIndicatorState((prev) => (sameTarget(prev, i) ? prev : i));

  const onDrop = (e: React.DragEvent, target: DropTarget) => {
    e.preventDefault();
    e.stopPropagation();
    const payload = readDrop(e);
    setIndicator(null);
    endDrag();
    if (payload) drop(payload, target);
  };

  return (
    <DropCtx.Provider value={{ indicator, setIndicator }}>
      <div
        className="flex-1 overflow-auto bg-canvas"
        onClick={() => select(null)}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIndicator(null);
        }}
      >
        <div
          data-testid="canvas-page"
          className="mx-auto my-8 min-h-[70vh] w-full max-w-4xl rounded-xl border border-line bg-white p-4 shadow-sm"
          onDragOver={(e) => {
            e.preventDefault();
            setIndicator({ kind: "inside", parentId: null });
          }}
          onDrop={(e) => onDrop(e, { kind: "inside", parentId: null })}
        >
          {tree.length === 0 ? (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center text-muted">
              <MousePointer2 />
              <p className="max-w-xs text-sm">Arraste blocos da paleta para cá, ou descreva a página em <b>Gerar com IA</b>, à esquerda. Depois clique em <b>Reimaginar</b> para virar uma landing page.</p>
            </div>
          ) : (
            <NodeList nodes={tree} direction="column" parentId={null} onDrop={onDrop} />
          )}
          {indicator?.kind === "inside" && indicator.parentId === null && tree.length > 0 ? (
            <div className="mt-2 h-1 rounded bg-brand" />
          ) : null}
        </div>
      </div>
    </DropCtx.Provider>
  );
}

interface ListProps {
  nodes: DraftNode[];
  direction: "row" | "column";
  parentId: string | null;
  onDrop: (e: React.DragEvent, t: DropTarget) => void;
}

function NodeList({ nodes, direction, onDrop }: ListProps) {
  return (
    <div className={direction === "row" ? "flex flex-wrap items-stretch gap-2" : "flex flex-col gap-2"}>
      {nodes.map((n) => (
        <BlockView key={n.id} node={n} direction={direction} onDrop={onDrop} />
      ))}
    </div>
  );
}

function BlockView({ node, direction, onDrop }: { node: DraftNode; direction: "row" | "column"; onDrop: ListProps["onDrop"] }) {
  const def = BLOCKS[node.type];
  const selected = useStudio((s) => s.selectedId === node.id);
  const select = useStudio((s) => s.select);
  const { indicator, setIndicator } = useContext(DropCtx);

  const sideOf = (e: React.DragEvent): "before" | "after" => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return direction === "row" ? (e.clientX < r.left + r.width / 2 ? "before" : "after") : e.clientY < r.top + r.height / 2 ? "before" : "after";
  };

  const showBefore = indicator && indicator.kind === "before" && indicator.targetId === node.id;
  const showAfter = indicator && indicator.kind === "after" && indicator.targetId === node.id;
  const lineCls = direction === "row" ? "top-0 bottom-0 w-1" : "left-0 right-0 h-1";

  return (
    <div
      className={`relative ${direction === "row" ? "min-w-[140px] flex-1" : ""}`}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        startDrag(e, { kind: "move", id: node.id });
      }}
      onDragEnd={() => {
        endDrag();
        setIndicator(null);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIndicator({ kind: sideOf(e), targetId: node.id });
      }}
      onDrop={(e) => onDrop(e, { kind: sideOf(e), targetId: node.id })}
      onClick={(e) => {
        e.stopPropagation();
        select(node.id);
      }}
      data-testid={`block-${node.type}`}
      data-block-id={node.id}
    >
      {showBefore ? <div className={`drop-line ${lineCls} ${direction === "row" ? "-left-1.5" : "-top-1.5"}`} /> : null}
      <div
        className={`group cursor-grab rounded-lg border bg-white transition active:cursor-grabbing ${
          selected ? "border-brand ring-2 ring-brand/30" : "border-dashed border-gray-300 hover:border-brand/60"
        } ${def.container ? "bg-gray-50/60 p-2" : "p-3"}`}
      >
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
          <BlockIcon type={node.type} size={13} />
          {def.label}
        </div>
        {def.container ? (
          <div
            className={`min-h-14 rounded-md ${
              indicator?.kind === "inside" && indicator.parentId === node.id ? "bg-brand-soft outline-2 outline-dashed outline-brand" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIndicator({ kind: "inside", parentId: node.id });
            }}
            onDrop={(e) => onDrop(e, { kind: "inside", parentId: node.id })}
          >
            {node.children?.length ? (
              <NodeList nodes={node.children} direction={def.container.direction} parentId={node.id} onDrop={onDrop} />
            ) : (
              <p className="flex h-14 items-center justify-center text-xs text-muted">Solte blocos aqui</p>
            )}
          </div>
        ) : (
          <Wireframe node={node} />
        )}
      </div>
      {showAfter ? <div className={`drop-line ${lineCls} ${direction === "row" ? "-right-1.5" : "-bottom-1.5"}`} /> : null}
    </div>
  );
}

/** Bloco livre: nome, descrição e a miniatura do desenho, se houver. */
function CustomPreview({ id, name, description }: { id: string; name?: string; description?: string }) {
  const sketch = useStudio((s) => s.sketches[id]);
  return (
    <div className="flex gap-3 text-sm">
      {sketch ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sketch} alt="Desenho do bloco" className="h-14 w-24 shrink-0 rounded border border-line bg-white object-contain" />
      ) : null}
      <div className="min-w-0">
        <b>{name}</b>
        <p className="text-xs text-muted">{description}</p>
        {sketch ? <p className="mt-0.5 text-[10px] text-brand">desenho pronto para transformar</p> : null}
      </div>
    </div>
  );
}

/** Miniatura de cada bloco folha (só para o rascunho). */
function Wireframe({ node }: { node: DraftNode }) {
  const p = node.props;
  switch (node.type) {
    case "navbar":
      return (
        <div className="flex items-center gap-3 text-sm">
          <b>{p.brand}</b>
          <span className="ml-auto flex gap-3 text-xs text-muted">
            {lines(p.links).map((l) => (
              <span key={l}>{l}</span>
            ))}
          </span>
          {p.cta ? <span className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs text-white">{p.cta}</span> : null}
        </div>
      );
    case "hero":
      return (
        <div className="py-3 text-center">
          <p className="text-xl font-bold">{p.title}</p>
          {p.subtitle ? <p className="mt-1 text-sm text-muted">{p.subtitle}</p> : null}
          {p.cta ? <span className="mt-3 inline-block rounded-full bg-gray-800 px-3 py-1 text-xs text-white">{p.cta}</span> : null}
        </div>
      );
    case "heading":
      return <p className={`font-bold ${p.level === "1" ? "text-xl" : p.level === "3" ? "text-sm" : "text-base"}`}>{p.text}</p>;
    case "text":
      return <p className="line-clamp-3 text-sm text-gray-600">{p.text}</p>;
    case "button":
      return <span className="inline-block rounded-full bg-gray-800 px-3 py-1 text-xs text-white">{p.label}</span>;
    case "image":
      return <div className="flex h-20 items-center justify-center rounded bg-gray-100 text-xs text-muted">{p.url ? "imagem" : "sem URL"}</div>;
    case "feature":
      return (
        <div>
          <p className="text-sm font-semibold">{p.title}</p>
          <p className="line-clamp-2 text-xs text-muted">{p.text}</p>
        </div>
      );
    case "testimonial":
      return (
        <p className="text-sm italic text-gray-600">
          “{p.quote}” <span className="not-italic text-muted">— {p.author}</span>
        </p>
      );
    case "pricing":
      return (
        <div className="text-sm">
          <b>{p.name}</b> · {p.price}
          {p.period}
          <p className="text-xs text-muted">{lines(p.features).join(" · ")}</p>
        </div>
      );
    case "stat":
      return (
        <p className="text-sm">
          <b className="text-base">{p.value}</b> <span className="text-muted">{p.label}</span>
        </p>
      );
    case "faq":
      return (
        <div className="text-sm">
          <b>{p.question}</b>
          <p className="line-clamp-2 text-xs text-muted">{p.answer}</p>
        </div>
      );
    case "step":
      return (
        <div className="text-sm">
          <b>{p.title}</b>
          <p className="line-clamp-2 text-xs text-muted">{p.text}</p>
        </div>
      );
    case "team":
      return (
        <p className="text-sm">
          <b>{p.name}</b> <span className="text-muted">{p.role}</span>
        </p>
      );
    case "contact":
      return (
        <div className="space-y-0.5 text-xs text-muted">
          {lines(p.hours).map((h) => (
            <p key={h}>{h}</p>
          ))}
          {p.address ? <p>{p.address}</p> : null}
          {[p.phone, p.whatsapp, p.email].filter(Boolean).join(" · ")}
        </div>
      );
    case "logos":
      return (
        <div className="text-sm">
          <p className="text-xs text-muted">{p.title}</p>
          <p className="font-semibold">{lines(p.names).join(" · ")}</p>
        </div>
      );
    case "gallery":
      return (
        <div className="grid grid-cols-3 gap-1">
          {(lines(p.captions).length ? lines(p.captions) : ["foto", "foto", "foto"]).slice(0, 6).map((c, i) => (
            <div key={i} className="flex h-12 items-center justify-center rounded bg-gray-100 text-[10px] text-muted">
              {lines(p.images)[i] ? "imagem" : c}
            </div>
          ))}
        </div>
      );
    case "form":
      return (
        <div className="space-y-1">
          <p className="text-sm font-semibold">{p.title}</p>
          {lines(p.fields).map((f) => (
            <div key={f} className="rounded border border-gray-200 px-2 py-1 text-xs text-muted">
              {f}
            </div>
          ))}
          <span className="inline-block rounded-full bg-gray-800 px-3 py-1 text-xs text-white">{p.cta}</span>
        </div>
      );
    case "footer":
      return <p className="text-xs text-muted">{p.text}</p>;
    case "custom":
      return <CustomPreview id={node.id} name={p.name} description={p.description} />;
    default:
      return null;
  }
}
