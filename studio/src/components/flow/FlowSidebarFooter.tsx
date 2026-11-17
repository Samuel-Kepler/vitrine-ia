"use client";
import { useState } from "react";
import { FileCode2, Loader2, Sparkles, Undo2 } from "lucide-react";
import { useStudio } from "@/lib/draft/store";
import { canUndoSuggest, runSuggest, undoSuggest } from "./suggest-client";

/** Rodapé do painel lateral: sugerir da landing (IA), notas e gerar código. */
export function FlowSidebarFooter({ generateLabel, onGenerate, disabled, disabledHint }: { generateLabel: string; onGenerate: () => void; disabled?: boolean; disabledHint?: string }) {
  const busy = useStudio((s) => s.busy);
  const notes = useStudio((s) => s.suggestNotes);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="mt-6 space-y-3 border-t border-line pt-4">
      <button
        disabled={busy}
        data-testid="suggest"
        onClick={async () => {
          setMsg(null);
          const r = await runSuggest();
          if (r.error) setMsg(r.error);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand py-2 text-sm font-medium text-brand hover:bg-brand-soft disabled:opacity-60"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Sugerir da landing
      </button>
      <p className="text-[11px] text-muted">Lê o rascunho da aba UI e propõe arquitetura e banco juntos. Substitui o que está nos dois canvases.</p>
      {msg ? <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">{msg}</p> : null}
      {notes.length ? (
        <div className="rounded-md bg-canvas p-2.5 text-xs text-gray-700">
          <ul className="list-disc space-y-1 pl-4">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          {canUndoSuggest() ? (
            <button className="mt-2 flex items-center gap-1 text-brand hover:underline" onClick={undoSuggest}>
              <Undo2 size={12} /> desfazer sugestão
            </button>
          ) : null}
        </div>
      ) : null}
      <button
        disabled={disabled}
        onClick={onGenerate}
        data-testid="generate-files"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
      >
        <FileCode2 size={15} /> {generateLabel}
      </button>
      {disabled && disabledHint ? <p className="text-[11px] text-muted">{disabledHint}</p> : null}
    </div>
  );
}
