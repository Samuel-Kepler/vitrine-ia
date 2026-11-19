"use client";
// Quadro de desenho do Bloco livre: desenhe a ideia (wireframe à mão) e a IA
// com visão monta a seção com os blocos do catálogo. Duas etapas: ver o que
// a IA montou e só então aplicar no canvas (o Ctrl+Z desfaz).
import { useEffect, useRef, useState } from "react";
import { Eraser, Loader2, Pencil, RotateCcw, Sparkles, Square, Trash2, X } from "lucide-react";
import { useStudio } from "@/lib/draft/store";
import { findNode, type DraftNode } from "@/lib/draft/tree";
import { BLOCKS } from "@/lib/draft/blocks";
import type { SketchResult } from "@/lib/draft/sketch";

const W = 900;
const H = 520;
type Tool = "pen" | "rect" | "eraser";

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

export function SketchDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const node = useStudio((s) => findNode(s.tree, id));
  const saved = useStudio((s) => s.sketches[id]);
  const setSketch = useStudio((s) => s.setSketch);
  const canvas = useRef<HTMLCanvasElement>(null);
  const history = useRef<ImageData[]>([]);
  const drag = useRef<{ x: number; y: number; snap?: ImageData } | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [description, setDescription] = useState(node?.props.description ?? "");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SketchResult | null>(null);

  const ctx = () => canvas.current!.getContext("2d")!;

  // Fundo branco + desenho salvo (se houver).
  useEffect(() => {
    const c = ctx();
    c.fillStyle = "#fff";
    c.fillRect(0, 0, W, H);
    if (saved) {
      const img = new Image();
      img.onload = () => c.drawImage(img, 0, 0, W, H);
      img.src = saved;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const stroke = (c: CanvasRenderingContext2D) => {
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = tool === "eraser" ? "#fff" : "#111";
    c.lineWidth = tool === "eraser" ? 26 : 4;
  };

  const down = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const c = ctx();
    history.current = [...history.current.slice(-19), c.getImageData(0, 0, W, H)];
    const p = point(e);
    drag.current = { ...p, snap: tool === "rect" ? c.getImageData(0, 0, W, H) : undefined };
    stroke(c);
    if (tool !== "rect") {
      c.beginPath();
      c.moveTo(p.x, p.y);
    }
    setDirty(true);
  };
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const c = ctx();
    const p = point(e);
    if (tool === "rect") {
      c.putImageData(drag.current.snap!, 0, 0);
      stroke(c);
      c.strokeRect(drag.current.x, drag.current.y, p.x - drag.current.x, p.y - drag.current.y);
    } else {
      c.lineTo(p.x, p.y);
      c.stroke();
    }
  };
  const up = () => {
    drag.current = null;
  };

  const undo = () => {
    const last = history.current.pop();
    if (last) ctx().putImageData(last, 0, 0);
  };
  const clear = () => {
    const c = ctx();
    history.current = [...history.current.slice(-19), c.getImageData(0, 0, W, H)];
    c.fillStyle = "#fff";
    c.fillRect(0, 0, W, H);
    setDirty(true);
  };

  /** PNG do quadro; null se está em branco. */
  const image = (): string | null => {
    const data = ctx().getImageData(0, 0, W, H).data;
    for (let i = 0; i < data.length; i += 16) if (data[i] < 200) return canvas.current!.toDataURL("image/png");
    return null;
  };

  const save = () => {
    setSketch(id, image());
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

  const toolBtn = (t: Tool, Icon: typeof Pencil, label: string) => (
    <button
      onClick={() => setTool(t)}
      aria-pressed={tool === t}
      title={label}
      aria-label={label}
      className={`rounded-md p-2 ${tool === t ? "bg-ink text-white" : "text-gray-600 hover:bg-gray-100"}`}
    >
      <Icon size={16} />
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-label="Desenhar bloco" className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid="sketch-dialog">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <Pencil size={16} className="text-brand" />
          <h2 className="font-semibold">Desenhar: {node?.props.name || "Bloco livre"}</h2>
          <span className="text-xs text-muted">Rabisque a ideia (caixas, linhas, círculos, palavras). A IA monta com os blocos do catálogo.</span>
          <button onClick={onClose} className="ml-auto rounded p-1 hover:bg-gray-100" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 lg:flex-row">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-1">
              {toolBtn("pen", Pencil, "Caneta")}
              {toolBtn("rect", Square, "Retângulo")}
              {toolBtn("eraser", Eraser, "Borracha")}
              <span className="mx-1 h-5 w-px bg-line" />
              <button onClick={undo} title="Desfazer traço" aria-label="Desfazer traço" className="rounded-md p-2 text-gray-600 hover:bg-gray-100">
                <RotateCcw size={16} />
              </button>
              <button onClick={clear} title="Limpar" aria-label="Limpar" className="rounded-md p-2 text-gray-600 hover:bg-gray-100">
                <Trash2 size={16} />
              </button>
            </div>
            <canvas
              ref={canvas}
              width={W}
              height={H}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              data-testid="sketch-canvas"
              className="aspect-[900/520] w-full cursor-crosshair touch-none rounded-lg border border-line bg-white"
            />
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-72">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-700">O que deve ter (opcional)</span>
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
            <button onClick={save} disabled={!dirty} className="rounded-md border border-line py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">
              Salvar desenho
            </button>
            <button onClick={transform} disabled={busy} data-testid="sketch-transform" className="flex items-center justify-center gap-2 rounded-md bg-brand py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {busy ? "Lendo o desenho…" : "Transformar com IA"}
            </button>
            {error ? <p className="rounded-md bg-red-50 p-2 text-xs text-red-800">{error}</p> : null}
            {result ? (
              <div className="space-y-2 rounded-md border border-line p-3 text-xs" data-testid="sketch-result">
                <p className={result.fallback && result.error ? "font-medium text-amber-800" : "text-muted"}>
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
                  <button onClick={apply} data-testid="sketch-apply" className="flex-1 rounded-md bg-ink py-1.5 font-medium text-white hover:opacity-90">
                    Aplicar no canvas
                  </button>
                  <button onClick={() => setResult(null)} className="rounded-md border border-line px-2.5 py-1.5 hover:bg-gray-50">
                    Descartar
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
