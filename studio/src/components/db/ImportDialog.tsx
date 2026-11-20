"use client";
import { useState } from "react";
import { FileUp, X } from "lucide-react";
import { useStudio } from "@/lib/draft/store";
import { importSchema } from "@/lib/db/import";
import { layoutDb } from "@/lib/layout/auto";
import type { ErModel } from "@/lib/db/model";

/** Cola ou abre um arquivo .dbml/.sql e substitui o diagrama do Banco. */
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const db = useStudio((s) => s.db);
  const setDb = useStudio((s) => s.setDb);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ warnings: string[]; tables: number; relations: number; previous: ErModel } | null>(null);

  const run = () => {
    setError(null);
    try {
      const r = importSchema(text);
      const previous = db;
      setDb(layoutDb(r.model));
      setDone({ warnings: r.warnings, tables: r.model.tables.length, relations: r.model.relations.length, previous });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
      <div role="dialog" aria-label="Importar schema" className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <FileUp size={18} className="text-emerald-600 dark:text-emerald-400" />
          <h2 className="font-semibold">Importar DBML ou SQL</h2>
          <button onClick={onClose} className="ml-auto rounded p-1 hover:bg-line" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {done ? (
          <div className="space-y-3 overflow-y-auto p-4 text-sm" data-testid="import-done">
            <p>
              Importado: <b>{done.tables}</b> {done.tables === 1 ? "tabela" : "tabelas"} e <b>{done.relations}</b> {done.relations === 1 ? "relação" : "relações"}.
            </p>
            {done.warnings.length ? (
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-100">
                <p className="mb-1 font-medium">Ajustes feitos na importação ({done.warnings.length}):</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {done.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDb(done.previous);
                  setDone(null);
                }}
                className="rounded-md border border-line px-3 py-1.5 hover:bg-canvas"
              >
                Desfazer importação
              </button>
              <button onClick={onClose} className="ml-auto rounded-md bg-ink px-3 py-1.5 text-on-solid hover:opacity-90">
                Pronto
              </button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
            <p className="text-xs text-muted">
              Cole um DBML (dbdiagram.io) ou SQL com <code>CREATE TABLE</code>, ou abra um arquivo. Substitui o diagrama atual; dá para desfazer em seguida.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              data-testid="import-text"
              spellCheck={false}
              placeholder={"Table users {\n  id uuid [pk]\n  email varchar [unique, not null]\n}"}
              className="min-h-64 flex-1 rounded-md border border-line p-2 font-mono text-xs outline-none focus:border-brand"
            />
            {error ? <p className="rounded-md bg-red-50 dark:bg-red-950/40 p-2 text-xs text-red-800 dark:text-red-200">{error}</p> : null}
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-sm hover:bg-canvas">
                Abrir arquivo…
                <input
                  type="file"
                  accept=".dbml,.sql,.txt"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setText(await f.text());
                  }}
                />
              </label>
              <button onClick={run} disabled={!text.trim()} data-testid="import-run" className="ml-auto rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50">
                Importar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
