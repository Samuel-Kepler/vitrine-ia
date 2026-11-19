"use client";
import { Boxes, Trash2 } from "lucide-react";
import { BLOCKS, GROUP_LABELS, type BlockGroup, type BlockType } from "@/lib/draft/blocks";
import { useStudio } from "@/lib/draft/store";
import { BlockIcon } from "./icons";
import { endDrag, startDrag } from "./dnd";
import { GeneratePanel } from "./GeneratePanel";

const ORDER: BlockGroup[] = ["secoes", "conteudo", "layout", "livre"];

export function Palette() {
  const addByClick = useStudio((s) => s.addByClick);
  const saved = useStudio((s) => s.saved);
  const removeSaved = useStudio((s) => s.removeSaved);

  return (
    <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-line bg-panel" aria-label="Paleta de componentes">
      <GeneratePanel />
      <p className="px-4 pt-4 text-xs text-muted">Ou arraste blocos para o canvas (ou clique para adicionar).</p>
      {ORDER.map((group) => (
        <section key={group} className="px-3 pt-4">
          <h3 className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{GROUP_LABELS[group]}</h3>
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
                  className="flex cursor-grab flex-col items-start gap-1 rounded-lg border border-line bg-white px-2.5 py-2 text-left text-xs transition hover:border-brand hover:bg-brand-soft active:cursor-grabbing"
                >
                  <BlockIcon type={b.type} size={16} className="text-brand" />
                  <span className="font-medium">{b.label}</span>
                </button>
              ))}
          </div>
        </section>
      ))}
      <section className="px-3 pb-6 pt-4">
        <h3 className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Meus componentes</h3>
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
                  className="flex flex-1 cursor-grab items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-2 text-left text-xs hover:border-brand hover:bg-brand-soft"
                >
                  <Boxes size={15} className="text-brand" />
                  <span className="truncate font-medium">{c.name}</span>
                </button>
                <button
                  onClick={() => removeSaved(c.id)}
                  className="rounded p-1.5 text-muted opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                  aria-label={`Apagar ${c.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
