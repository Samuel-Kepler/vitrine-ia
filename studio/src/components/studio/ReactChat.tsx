"use client";
// Chat de ajustes no código React: a IA edita os arquivos da aba React com
// ferramentas (no servidor) e o Studio aplica só o que mudou, com Desfazer.
import { useEffect, useRef, useState } from "react";
import { Bot, FileCode2, Loader2, Send, Undo2, X } from "lucide-react";
import { useStudio } from "@/lib/draft/store";
import type { ReactChatResult } from "@/lib/react-chat/agent";

interface Msg {
  role: "user" | "assistant";
  content: string;
  changed?: string[];
  deleted?: string[];
  error?: boolean;
  /** Arquivos antes desta resposta (Desfazer). */
  before?: Record<string, string>;
  source?: string;
}

const EXAMPLES = ["Anime os cards de benefícios ao aparecer", "Deixe o hero com fundo escuro e texto claro", "Crie uma seção de perguntas frequentes antes do rodapé"];

export function ReactChat({ onClose, onOpenFile }: { onClose: () => void; onOpenFile: (path: string) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  // Corpo em chaves: o efeito não pode devolver nada (o React trataria como limpeza).
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, sending]);

  const send = async (message = text) => {
    const s = useStudio.getState();
    if (!s.reactFiles || message.trim().length < 2 || sending) return;
    const before = s.reactFiles;
    const history = msgs.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: message.trim() }]);
    setText("");
    setSending(true);
    try {
      const clean = Object.fromEntries(Object.entries(s.settings).filter(([, v]) => typeof v === "string" && v.trim()));
      const res = await fetch("/api/react-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: message.trim(), files: before, history, settings: clean.kind ? clean : undefined }),
      });
      const json = (await res.json()) as ReactChatResult & { error?: string };
      if (!res.ok || json.error) {
        setMsgs((m) => [...m, { role: "assistant", content: json.reply || json.error || `Erro ${res.status}`, error: true }]);
        return;
      }
      const changed = Object.keys(json.changed);
      if (changed.length || json.deleted.length) {
        // Aplica por cima do estado atual (o usuário pode ter digitado no editor enquanto a IA trabalhava).
        const cur = { ...(useStudio.getState().reactFiles ?? {}), ...json.changed };
        for (const p of json.deleted) delete cur[p];
        useStudio.setState({ reactFiles: cur, reactEdited: true });
        if (changed[0]) onOpenFile(changed[0]);
      }
      setMsgs((m) => [...m, { role: "assistant", content: json.reply, changed, deleted: json.deleted, before, source: `${json.provider} · ${json.modelId} · ${json.steps} passos` }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : String(e), error: true }]);
    } finally {
      setSending(false);
    }
  };

  const undo = (i: number) => {
    const before = msgs[i].before;
    if (!before) return;
    useStudio.setState({ reactFiles: before, reactEdited: true });
    setMsgs((m) => m.map((x, k) => (k === i ? { ...x, before: undefined, content: `${x.content}\n\n(desfeito)` } : x)));
  };

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-line bg-panel" aria-label="Chat de código" data-testid="react-chat">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <Bot size={15} className="text-brand" />
        <span className="label-mono">Chat de código</span>
        <button onClick={onClose} className="ml-auto rounded p-1 text-muted hover:bg-line" aria-label="Fechar chat">
          <X size={14} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-xs">
        {msgs.length === 0 ? (
          <div className="space-y-2 text-muted">
            <p>Peça ajustes no código do site. A IA edita só os arquivos necessários e o preview atualiza sozinho.</p>
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => send(e)} className="block w-full rounded-md border border-line bg-panel px-2.5 py-1.5 text-left text-ink hover:border-brand">
                {e}
              </button>
            ))}
          </div>
        ) : null}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-6 rounded-lg bg-ink px-3 py-2 text-on-solid" : `mr-2 rounded-lg border px-3 py-2 ${m.error ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200" : "border-line bg-panel text-ink"}`}>
            <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
            {m.changed?.length ? (
              <ul className="mt-2 space-y-0.5">
                {m.changed.map((p) => (
                  <li key={p}>
                    <button onClick={() => onOpenFile(p)} className="flex items-center gap-1 font-mono text-[11px] text-brand hover:underline">
                      <FileCode2 size={11} /> {p.slice(1)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {m.deleted?.length ? <p className="mt-1 font-mono text-[11px] text-muted">apagado: {m.deleted.map((p) => p.slice(1)).join(", ")}</p> : null}
            {m.before && (m.changed?.length || m.deleted?.length) ? (
              <button onClick={() => undo(i)} className="mt-2 flex items-center gap-1 text-[11px] text-brand hover:underline" data-testid="react-chat-undo">
                <Undo2 size={11} /> Desfazer
              </button>
            ) : null}
            {m.source ? <p className="mt-1 text-[10px] text-muted">{m.source}</p> : null}
          </div>
        ))}
        {sending ? (
          <p className="flex items-center gap-2 text-muted">
            <Loader2 size={13} className="animate-spin" /> Editando o código…
          </p>
        ) : null}
        <div ref={end} />
      </div>

      <form
        className="border-t border-line p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={3}
          maxLength={4000}
          placeholder="Ex.: troque o botão do hero por um link para o WhatsApp"
          data-testid="react-chat-input"
          className="w-full resize-none rounded-md border border-line bg-panel p-2 text-xs outline-none focus:border-brand"
        />
        <button type="submit" disabled={sending || text.trim().length < 2} data-testid="react-chat-send" className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md bg-brand py-1.5 text-xs font-semibold text-on-solid hover:brightness-110 disabled:opacity-50">
          {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Enviar
        </button>
        <p className="mt-1 text-[10px] text-muted">Enter envia, Shift+Enter quebra linha. Usa o provedor da engrenagem.</p>
      </form>
    </aside>
  );
}
