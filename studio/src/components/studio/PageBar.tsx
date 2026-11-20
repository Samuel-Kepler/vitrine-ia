"use client";
import { useState } from "react";
import { Check, Copy, FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import { useStudio } from "@/lib/draft/store";

const btn = "rounded p-1 text-muted hover:bg-line hover:text-ink";

function NameInput({ initial, onDone, testId }: { initial: string; onDone: (name: string | null) => void; testId: string }) {
  const [v, setV] = useState(initial);
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        onDone(v.trim() || null);
      }}
    >
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onDone(null)}
        data-testid={testId}
        maxLength={40}
        className="w-32 rounded border border-brand px-1.5 py-0.5 text-xs outline-none"
      />
      <button type="submit" className={btn} aria-label="Confirmar">
        <Check size={13} />
      </button>
      <button type="button" className={btn} aria-label="Cancelar" onClick={() => onDone(null)}>
        <X size={13} />
      </button>
    </form>
  );
}

/** Abas de páginas do site (modo UI): trocar, criar, renomear, duplicar e apagar. */
export function PageBar() {
  const pages = useStudio((s) => s.pages);
  const pageId = useStudio((s) => s.pageId);
  const { switchPage, addPage, renamePage, duplicatePage, removePage } = useStudio.getState();
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-canvas px-3 text-sm" role="tablist" aria-label="Páginas" data-testid="page-bar">
      <span className="mr-1 label-mono">Páginas</span>
      {pages.map((p, i) => {
        const active = p.id === pageId;
        if (active && renaming) {
          return (
            <NameInput
              key={p.id}
              initial={p.name}
              testId="page-rename-input"
              onDone={(name) => {
                if (name) renamePage(p.id, name);
                setRenaming(false);
              }}
            />
          );
        }
        return (
          <div key={p.id} className={`flex items-center gap-0.5 rounded-md ${active ? "bg-panel shadow-sm" : ""}`}>
            <button
              role="tab"
              aria-selected={active}
              onClick={() => {
                setConfirmDelete(false);
                switchPage(p.id);
              }}
              onDoubleClick={() => active && setRenaming(true)}
              data-testid={`page-tab-${p.slug}`}
              title={i === 0 ? "Página inicial (index.html)" : `${p.slug}.html`}
              className={`flex items-center gap-1.5 px-3 py-1.5 ${active ? "font-semibold text-ink" : "text-muted hover:text-ink"}`}
            >
              <FileText size={15} /> {p.name}
              {p.result ? null : <span className="size-1.5 rounded-full bg-amber-400" title="Ainda não reimaginada" />}
            </button>
            {active && !confirmDelete ? (
              <>
                <button className={btn} title="Renomear" aria-label="Renomear página" onClick={() => setRenaming(true)}>
                  <Pencil size={14} />
                </button>
                <button className={btn} title="Duplicar" aria-label="Duplicar página" onClick={() => duplicatePage(p.id)}>
                  <Copy size={14} />
                </button>
                {pages.length > 1 ? (
                  <button className={btn} title="Apagar" aria-label="Apagar página" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </>
            ) : null}
            {active && confirmDelete ? (
              <span className="flex items-center gap-1 pr-1 text-red-700 dark:text-red-300">
                Apagar “{p.name}”?
                <button
                  className="rounded bg-red-600 px-1.5 py-0.5 text-white"
                  data-testid="page-delete-confirm"
                  onClick={() => {
                    removePage(p.id);
                    setConfirmDelete(false);
                  }}
                >
                  sim
                </button>
                <button className="rounded px-1.5 py-0.5 hover:bg-line" onClick={() => setConfirmDelete(false)}>
                  não
                </button>
              </span>
            ) : null}
          </div>
        );
      })}
      {adding ? (
        <NameInput
          initial=""
          testId="page-new-input"
          onDone={(name) => {
            if (name) addPage(name);
            setAdding(false);
          }}
        />
      ) : (
        <button onClick={() => setAdding(true)} data-testid="page-add" className="ml-1 flex items-center gap-1 rounded-md px-2.5 py-1.5 text-brand hover:bg-brand-soft">
          <Plus size={15} /> Nova página
        </button>
      )}
      <span className="ml-auto whitespace-nowrap pl-3 text-muted">Menu e rodapé valem para todas as páginas.</span>
    </div>
  );
}
