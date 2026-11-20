"use client";
import { Boxes, LayoutTemplate, Trash2 } from "lucide-react";
import { BLOCKS, GROUP_LABELS, type BlockGroup, type BlockType } from "@/lib/draft/blocks";
import { useStudio } from "@/lib/draft/store";
import { RECIPES } from "@/lib/draft/recipes";
import { BlockIcon } from "./icons";
import { endDrag, startDrag } from "./dnd";
import { GeneratePanel } from "./GeneratePanel";
import { ResizableAside } from "./ResizableAside";

const ORDER: BlockGroup[] = ["secoes", "conteudo", "layout", "livre"];

export function Palette() {
  const addByClick = useStudio((s) => s.addByClick);
  const saved = useStudio((s) => s.saved);
  const removeSaved = useStudio((s) => s.removeSaved);

  return (
    <ResizableAside side="left" storageKey="studio.left" defaultWidth={288} className="flex shrink-0 flex-col overflow-y-auto border-r border-line bg-panel" aria-label="Paleta de componentes">
      <GeneratePanel />
      <p className="px-4 pt-4 text-xs text-muted">Ou arraste blocos para o canvas (ou clique para adicionar).</p>
      {ORDER.map((group) => (
        <section key={group} className="px-3 pt-4">
          <h3 className="px-1 pb-2 label-mono">{GROUP_LABELS[group]}</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.values(BLOCKS)
              .filter((b) => b.group === group)
              .map((b) => (
                <button
                  key={b.type}
                  draggable
                  onDragStart={(e) => startDrag(e, { kind: "new", type: b.type as BlockType })}
                  onDragEnd={endDrag}
                  onClick={() => addByClick({ kind: "new", type: b.type as BlockType })}
                  title={b.hint}
                  data-testid={`palette-${b.type}`}
                  className="flex cursor-grab flex-col items-start gap-1.5 rounded-lg border border-line bg-panel px-3 py-2.5 text-left text-sm transition hover:border-brand hover:bg-brand-soft active:cursor-grabbing"
                >
                  <BlockIcon type={b.type} size={16} className="text-brand" />
                  <span className="font-medium">{b.label}</span>
                </button>
              ))}
          </div>
        </section>
      ))}
      <section className="px-3 pt-4">
        <h3 className="px-1 pb-2 label-mono">Receitas de seção</h3>
        <ul className="space-y-1.5">
          {RECIPES.map((r) => (
            <li key={r.id}>
              <button
                draggable
                onDragStart={(e) => startDrag(e, { kind: "recipe", recipeId: r.id })}
                onDragEnd={endDrag}
                onClick={() => addByClick({ kind: "recipe", recipeId: r.id })}
                title={r.hint}
                data-testid={`recipe-${r.id}`}
                className="flex w-full cursor-grab items-start gap-2 rounded-lg border border-line bg-panel px-3 py-2.5 text-left text-sm hover:border-brand hover:bg-brand-soft active:cursor-grabbing"
              >
                <LayoutTemplate size={16} className="mt-0.5 shrink-0 text-brand" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="block truncate text-[11px] text-muted">{r.hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="px-3 pb-6 pt-4">
        <h3 className="px-1 pb-2 label-mono">Meus componentes</h3>
        {saved.length === 0 ? (
          <p className="px-1 text-xs text-muted">Selecione um bloco e use “Salvar como componente” para reutilizá-lo aqui.</p>
        ) : (
          <ul className="space-y-1.5">
            {saved.map((c) => (
              <li key={c.id} className="group flex items-center gap-1">
                <button
                  draggable
                  onDragStart={(e) => startDrag(e, { kind: "saved", savedId: c.id })}
                  onDragEnd={endDrag}
                  onClick={() => addByClick({ kind: "saved", savedId: c.id })}
                  className="flex flex-1 cursor-grab items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2.5 text-left text-sm hover:border-brand hover:bg-brand-soft"
                >
                  <Boxes size={16} className="text-brand" />
                  <span className="truncate font-medium">{c.name}</span>
                </button>
                <button
                  onClick={() => removeSaved(c.id)}
                  className="rounded p-1.5 text-muted opacity-0 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 group-hover:opacity-100"
                  aria-label={`Apagar ${c.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ResizableAside>
  );
}
