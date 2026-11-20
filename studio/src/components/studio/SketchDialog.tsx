"use client";
// Quadro de desenho do Bloco livre. O desenho é guardado como objetos
// (src/lib/sketch/shapes.ts): dá para selecionar, mover, redimensionar,
// mudar cor e apagar cada forma. A IA com visão recebe a imagem e monta a
// seção com os blocos do catálogo; você vê o resultado antes de aplicar.
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Circle, Eraser, Loader2, MousePointer2, Pencil, Redo2, Slash, Sparkles, Square, Trash2, Type, Undo2, X } from "lucide-react";
import { useStudio } from "@/lib/draft/store";
import { findNode, type DraftNode } from "@/lib/draft/tree";
import { BLOCKS } from "@/lib/draft/blocks";
import type { SketchResult } from "@/lib/draft/sketch";
import { COLORS, WIDTHS, fromDrag, handleAt, move, resize, shapeId, tooSmall, topHit, type Handle, type Shape, type TextShape } from "@/lib/sketch/shapes";
import { render } from "@/lib/sketch/render";

const W = 900;
const H = 520;
type Tool = "select" | "pen" | "rect" | "ellipse" | "line" | "arrow" | "text" | "eraser";
const KEYS: Record<string, Tool> = { v: "select", p: "pen", r: "rect", o: "ellipse", l: "line", a: "arrow", t: "text", e: "eraser" };

/** Lista legível do que a IA montou: "Seção: Título, Benefício ×3". */
export function summarize(nodes: DraftNode[]): string[] {
  const label = (n: DraftNode) => BLOCKS[n.type]?.label ?? n.type;
  return nodes.map((n) => {
    if (!n.children?.length) return label(n);
    const counts = new Map<string, number>();
    for (const c of n.children) counts.set(label(c), (counts.get(label(c)) ?? 0) + 1);
    return `${label(n)}: ${[...counts].map(([k, v]) => (v > 1 ? `${k} ×${v}` : k)).join(", ")}`;
  });
}

type Drag =
  | { mode: "draw"; shape: Shape; x0: number; y0: number }
  | { mode: "move"; id: string; orig: Shape; x0: number; y0: number }
  | { mode: "resize"; id: string; orig: Shape; handle: Handle }
  | { mode: "erase" };

export function SketchDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const node = useStudio((s) => findNode(s.tree, id));
  const savedPng = useStudio((s) => s.sketches[id]);
  const savedDoc = useStudio((s) => s.sketchDocs[id]);
  const setSketch = useStudio((s) => s.setSketch);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const bg = useRef<HTMLImageElement | null>(null);
  const textInput = useRef<HTMLInputElement>(null);
  const drag = useRef<Drag | null>(null);
  const [shapes, setShapes] = useState<Shape[]>(savedDoc ?? []);
  const [past, setPast] = useState<Shape[][]>([]);
  const [future, setFuture] = useState<Shape[][]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>(COLORS[0]);
  const [width, setWidth] = useState<number>(WIDTHS[0]);
  const [editing, setEditing] = useState<{ id?: string; x: number; y: number; value: string } | null>(null);
  const [description, setDescription] = useState(node?.props.description ?? "");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SketchResult | null>(null);

  const sel = shapes.find((s) => s.id === selected);

  // Campo de texto: foco no quadro seguinte (depois do clique terminar).
  const editingKey = editing ? `${editing.id ?? "novo"}:${editing.x}:${editing.y}` : null;
  useEffect(() => {
    if (!editingKey) return;
    const raf = requestAnimationFrame(() => textInput.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [editingKey]);

  // Desenho antigo salvo só como imagem (antes dos objetos): vira fundo.
  useEffect(() => {
    if (savedPng && !savedDoc) {
      const img = new Image();
      img.onload = () => {
        bg.current = img;
        paint();
      };
      img.src = savedPng;
    }
    box.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paint = useCallback(
    (list: Shape[] = shapes, extra?: Shape, selection?: Shape) => {
      const c = canvas.current?.getContext("2d");
      if (c) render(c, W, H, list, { background: bg.current, extra, selected: selection });
    },
    [shapes],
  );

  useEffect(() => paint(shapes, undefined, sel), [shapes, sel, paint]);

  /** Grava um passo no histórico e aplica a nova lista. */
  const commit = (next: Shape[]) => {
    setPast((p) => [...p.slice(-49), shapes]);
    setFuture([]);
    setShapes(next);
    setDirty(true);
  };
  const undo = () => {
    const prev = past[past.length - 1];
    if (!prev) return;
    setFuture((f) => [shapes, ...f]);
    setPast((p) => p.slice(0, -1));
    setShapes(prev);
    setSelected(null);
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setPast((p) => [...p, shapes]);
    setFuture((f) => f.slice(1));
    setShapes(next);
  };

  const point = (e: React.PointerEvent | React.MouseEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const startText = (x: number, y: number, existing?: TextShape) => {
    setEditing({ id: existing?.id, x: existing?.x ?? x, y: existing?.y ?? y, value: existing?.text ?? "" });
  };
  const commitText = () => {
    if (!editing) return;
    const value = editing.value.trim();
    const existing = shapes.find((s) => s.id === editing.id) as TextShape | undefined;
    if (existing) commit(value ? shapes.map((s) => (s.id === existing.id ? { ...existing, text: value } : s)) : shapes.filter((s) => s.id !== existing.id));
    else if (value) commit([...shapes, { id: shapeId(), kind: "text", color, width, x: editing.x, y: editing.y, text: value, size: 22 + width * 2 }]);
    setEditing(null);
  };

  const down = (e: React.PointerEvent) => {
    // Texto: o clique não pode levar o foco para a janela (o campo de texto fecharia vazio).
    if (tool === "text") e.preventDefault();
    if (editing) commitText();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    if (tool === "select") {
      const h = sel ? handleAt(sel, p.x, p.y) : undefined;
      if (sel && h) {
        drag.current = { mode: "resize", id: sel.id, orig: sel, handle: h };
        return;
      }
      const target = topHit(shapes, p.x, p.y);
      setSelected(target?.id ?? null);
      if (target) drag.current = { mode: "move", id: target.id, orig: target, x0: p.x, y0: p.y };
      return;
    }
    if (tool === "eraser") {
      const target = topHit(shapes, p.x, p.y);
      if (target) commit(shapes.filter((s) => s.id !== target.id));
      drag.current = { mode: "erase" };
      return;
    }
    if (tool === "text") {
      startText(p.x, p.y);
      return;
    }
    const shape: Shape = tool === "pen" ? { id: shapeId(), kind: "pen", color, width, points: [[p.x, p.y]] } : fromDrag(tool, p.x, p.y, p.x, p.y, color, width);
    drag.current = { mode: "draw", shape, x0: p.x, y0: p.y };
  };

  const moveEv = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = point(e);
    if (d.mode === "draw") {
      d.shape = d.shape.kind === "pen" ? { ...d.shape, points: [...d.shape.points, [p.x, p.y]] } : fromDrag(d.shape.kind as Exclude<Shape["kind"], "pen" | "text">, d.x0, d.y0, p.x, p.y, d.shape.color, d.shape.width);
      d.shape.id = d.shape.id || shapeId();
      paint(shapes, d.shape);
    } else if (d.mode === "move") {
      const moved = move(d.orig, p.x - d.x0, p.y - d.y0);
      paint(shapes.map((s) => (s.id === d.id ? moved : s)), undefined, moved);
    } else if (d.mode === "resize") {
      const r = resize(d.orig, d.handle, p.x, p.y);
      paint(shapes.map((s) => (s.id === d.id ? r : s)), undefined, r);
    } else if (d.mode === "erase") {
      const target = topHit(shapes, p.x, p.y);
      if (target) commit(shapes.filter((s) => s.id !== target.id));
    }
  };

  const up = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const p = point(e);
    if (d.mode === "draw") {
      if (!tooSmall(d.shape)) commit([...shapes, d.shape]);
      else paint();
    } else if (d.mode === "move") {
      if (Math.hypot(p.x - d.x0, p.y - d.y0) > 1) commit(shapes.map((s) => (s.id === d.id ? move(d.orig, p.x - d.x0, p.y - d.y0) : s)));
    } else if (d.mode === "resize") {
      commit(shapes.map((s) => (s.id === d.id ? resize(d.orig, d.handle, p.x, p.y) : s)));
    }
  };

  const dbl = (e: React.MouseEvent) => {
    const p = point(e);
    const target = topHit(shapes, p.x, p.y);
    if (target?.kind === "text") startText(p.x, p.y, target);
  };

  const pickColor = (c: string) => {
    setColor(c);
    if (sel) commit(shapes.map((s) => (s.id === sel.id ? { ...s, color: c } : s)));
  };
  const pickWidth = (w: number) => {
    setWidth(w);
    if (sel && sel.kind !== "text") commit(shapes.map((s) => (s.id === sel.id ? { ...s, width: w } : s)));
  };
  const remove = () => {
    if (!sel) return;
    commit(shapes.filter((s) => s.id !== sel.id));
    setSelected(null);
  };
  const clear = () => {
    bg.current = null;
    commit([]);
    setSelected(null);
  };

  // Atalhos do quadro. stopPropagation: o Ctrl+Z daqui não pode desfazer o canvas do Studio.
  const onKey = (e: React.KeyboardEvent) => {
    const typing = (e.target as HTMLElement).tagName === "TEXTAREA" || (e.target as HTMLElement).tagName === "INPUT";
    e.stopPropagation();
    if (typing) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if ((e.ctrlKey || e.metaKey) && k === "y") {
      e.preventDefault();
      redo();
    } else if (k === "delete" || k === "backspace") {
      e.preventDefault();
      remove();
    } else if (k === "escape") {
      if (selected) setSelected(null);
      else onClose();
    } else if (!e.ctrlKey && !e.metaKey && KEYS[k]) setTool(KEYS[k]);
  };

  /** PNG do quadro (sem seleção); null se está vazio. */
  const image = (): string | null => {
    if (!shapes.length && !bg.current) return null;
    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    render(off.getContext("2d")!, W, H, shapes, { background: bg.current });
    return off.toDataURL("image/png");
  };

  const save = () => {
    setSketch(id, image(), shapes);
    if (description !== node?.props.description) useStudio.getState().update(id, { description });
    setDirty(false);
  };

  const transform = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      save();
      const s = useStudio.getState();
      const clean = Object.fromEntries(Object.entries(s.settings).filter(([, v]) => typeof v === "string" && v.trim()));
      const res = await fetch("/api/sketch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: image() ?? undefined, name: node?.props.name, description, brief: s.brief || undefined, settings: clean.kind ? clean : undefined }),
      });
      const json = (await res.json()) as SketchResult & { error?: string };
      if (!res.ok) setError(json.error ?? `Erro ${res.status}`);
      else setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!result) return;
    useStudio.getState().applySketch(id, result.draft);
    onClose();
  };

  const toolBtn = (t: Tool, Icon: typeof Pencil, label: string, key: string) => (
    <button
      key={t}
      onClick={() => setTool(t)}
      aria-pressed={tool === t}
      title={`${label} (${key})`}
      aria-label={label}
      data-testid={`sketch-tool-${t}`}
      className={`rounded-md p-2 ${tool === t ? "bg-ink text-on-solid" : "text-muted hover:bg-line"}`}
    >
      <Icon size={16} />
    </button>
  );

  // Posição da caixa de texto sobre o canvas (coordenadas do quadro -> CSS).
  const textPos = () => {
    const r = canvas.current?.getBoundingClientRect();
    if (!r || !editing) return {};
    return { left: (editing.x / W) * r.width, top: (editing.y / H) * r.height };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        ref={box}
        tabIndex={-1}
        onKeyDown={onKey}
        role="dialog"
        aria-label="Desenhar bloco"
        className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-panel shadow-2xl outline-none"
        onClick={(e) => e.stopPropagation()}
        data-testid="sketch-dialog"
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <Pencil size={16} className="text-brand" />
          <h2 className="font-semibold">Desenhar: {node?.props.name || "Bloco livre"}</h2>
          <span className="hidden text-xs text-muted md:inline">Caixas lado a lado viram cards, círculos viram foto ou ícone, linhas viram texto e o que você escrever é usado como está.</span>
          <button onClick={onClose} className="ml-auto rounded p-1 hover:bg-line" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 lg:flex-row">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-1" role="toolbar" aria-label="Ferramentas">
              {toolBtn("select", MousePointer2, "Selecionar e mover", "V")}
              {toolBtn("pen", Pencil, "Caneta", "P")}
              {toolBtn("rect", Square, "Retângulo", "R")}
              {toolBtn("ellipse", Circle, "Círculo", "O")}
              {toolBtn("line", Slash, "Linha", "L")}
              {toolBtn("arrow", ArrowUpRight, "Seta", "A")}
              {toolBtn("text", Type, "Texto", "T")}
              {toolBtn("eraser", Eraser, "Borracha (apaga a forma)", "E")}
              <span className="mx-1 h-5 w-px bg-line" />
              {COLORS.map((c) => (
                <button key={c} onClick={() => pickColor(c)} aria-label={`Cor ${c}`} aria-pressed={color === c} className={`size-6 rounded-full border-2 ${color === c ? "border-ink" : "border-white"}`} style={{ background: c, boxShadow: "0 0 0 1px #e1e2dd" }} />
              ))}
              <span className="mx-1 h-5 w-px bg-line" />
              {WIDTHS.map((w) => (
                <button key={w} onClick={() => pickWidth(w)} aria-label={`Espessura ${w}`} aria-pressed={width === w} className={`flex size-8 items-center justify-center rounded-md ${width === w ? "bg-line" : "hover:bg-line"}`}>
                  <span className="rounded-full bg-ink" style={{ width: w + 2, height: w + 2 }} />
                </button>
              ))}
              <span className="mx-1 h-5 w-px bg-line" />
              <button onClick={undo} disabled={!past.length} title="Desfazer (Ctrl+Z)" aria-label="Desfazer" className="rounded-md p-2 text-muted hover:bg-line disabled:opacity-30">
                <Undo2 size={16} />
              </button>
              <button onClick={redo} disabled={!future.length} title="Refazer (Ctrl+Y)" aria-label="Refazer" className="rounded-md p-2 text-muted hover:bg-line disabled:opacity-30">
                <Redo2 size={16} />
              </button>
              <button onClick={remove} disabled={!sel} title="Apagar selecionado (Delete)" aria-label="Apagar selecionado" className="rounded-md p-2 text-muted hover:bg-line disabled:opacity-30">
                <Trash2 size={16} />
              </button>
              <button onClick={clear} title="Limpar tudo" className="ml-1 rounded-md px-2 py-1.5 text-xs text-muted hover:bg-line">
                Limpar
              </button>
            </div>
            <div className="relative">
              <canvas
                ref={canvas}
                width={W}
                height={H}
                onPointerDown={down}
                onPointerMove={moveEv}
                onPointerUp={up}
                onPointerCancel={up}
                onDoubleClick={dbl}
                data-testid="sketch-canvas"
                className={`aspect-[900/520] w-full touch-none rounded-lg border border-line bg-white ${tool === "select" ? "cursor-default" : tool === "text" ? "cursor-text" : "cursor-crosshair"}`}
              />
              {editing ? (
                <input
                  ref={textInput}
                  value={editing.value}
                  onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") commitText();
                    if (e.key === "Escape") setEditing(null);
                  }}
                  onBlur={commitText}
                  placeholder="Digite e Enter"
                  data-testid="sketch-text-input"
                  className="absolute min-w-40 rounded border border-brand bg-panel px-1.5 py-0.5 text-sm outline-none"
                  style={textPos()}
                />
              ) : null}
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-72">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink">O que deve ter (opcional)</span>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDirty(true);
                }}
                rows={4}
                maxLength={2000}
                placeholder="Ex.: três diferenciais com ícone; depois um botão para agendar"
                className="w-full rounded-md border border-line p-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <button onClick={save} disabled={!dirty} className="rounded-md border border-line py-1.5 text-sm hover:bg-canvas disabled:opacity-50">
              Salvar desenho
            </button>
            <button onClick={transform} disabled={busy} data-testid="sketch-transform" className="flex items-center justify-center gap-2 rounded-md bg-brand py-2 text-sm font-semibold text-on-solid hover:brightness-110 disabled:opacity-60">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {busy ? "Lendo o desenho…" : "Transformar com IA"}
            </button>
            {error ? <p className="rounded-md bg-red-50 dark:bg-red-950/40 p-2 text-xs text-red-800 dark:text-red-200">{error}</p> : null}
            {result ? (
              <div className="space-y-2 rounded-md border border-line p-3 text-xs" data-testid="sketch-result">
                <p className={result.fallback && result.error ? "font-medium text-amber-800 dark:text-amber-200" : "text-muted"}>
                  {result.provider === "mock"
                    ? "Fonte: modelo automático pela descrição (provedor mock, sem IA)."
                    : result.fallback
                      ? `Não deu para ler o desenho (${result.provider} · ${result.modelId}: ${result.error ?? "erro"}). Montado pela descrição.`
                      : `Lido por ${result.provider} · ${result.modelId}`}
                </p>
                <p className="font-medium">Vai virar:</p>
                <ul className="list-disc pl-4">
                  {summarize(result.draft).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
                {result.notes.length ? <p className="text-muted">{result.notes.join(" ")}</p> : null}
                <div className="flex gap-2 pt-1">
                  <button onClick={apply} data-testid="sketch-apply" className="flex-1 rounded-md bg-ink py-1.5 font-medium text-on-solid hover:opacity-90">
                    Aplicar no canvas
                  </button>
                  <button onClick={() => setResult(null)} className="rounded-md border border-line px-2.5 py-1.5 hover:bg-canvas">
                    Descartar
                  </button>
                </div>
              </div>
            ) : null}
            <p className="text-[11px] text-muted">Atalhos: V selecionar · P caneta · R retângulo · O círculo · L linha · A seta · T texto · E borracha · Delete apaga · Ctrl+Z/Ctrl+Y · duplo clique edita texto.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
