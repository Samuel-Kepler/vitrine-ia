"use client";
import { useEffect, useState } from "react";
import { Loader2, RefreshCw, X } from "lucide-react";
import { useStudio } from "@/lib/draft/store";
import { PROVIDER_KINDS, PROVIDER_LABELS, type ProviderKind, type ProviderSettings } from "@/lib/ai/settings";

export interface ServerStatus {
  defaultKind: ProviderKind;
  defaultModel: string;
  defaultModels: Record<ProviderKind, string>;
  keys: Record<string, boolean>;
  baseURLs: Record<"ollama" | "openai-compatible", string>;
}

const input =
  "w-full rounded-md border border-line bg-panel px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const LOCAL: ProviderKind[] = ["ollama", "openai-compatible"];
const CLOUD_WITH_KEY: ProviderKind[] = ["groq", "google", "anthropic", "openai-compatible"];

export function SettingsDialog({ open, onClose, status }: { open: boolean; onClose: () => void; status?: ServerStatus }) {
  const saved = useStudio((s) => s.settings);
  const setSettings = useStudio((s) => s.setSettings);
  const [draft, setDraft] = useState<ProviderSettings>(saved);
  const [models, setModels] = useState<string[]>([]);
  const [probe, setProbe] = useState<{ loading: boolean; error?: string }>({ loading: false });

  useEffect(() => {
    if (open) setDraft(saved);
  }, [open, saved]);

  if (!open) return null;
  const kind = draft.kind;
  const isLocal = kind ? LOCAL.includes(kind) : false;

  const listModels = async () => {
    if (!kind || !isLocal) return;
    setProbe({ loading: true });
    const qs = new URLSearchParams({ kind, ...(draft.baseURL ? { baseURL: draft.baseURL } : {}) });
    try {
      const res = await fetch(`/api/providers?${qs}`);
      const json = (await res.json()) as { models: string[]; error?: string };
      setModels(json.models ?? []);
      setProbe({ loading: false, error: json.error ?? (json.models?.length ? undefined : "Servidor respondeu, mas sem modelos.") });
    } catch (e) {
      setProbe({ loading: false, error: String(e) });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Provedor de IA" className="w-full max-w-lg rounded-xl bg-panel p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center">
          <h2 className="font-semibold">Provedor de IA</h2>
          <button className="ml-auto rounded p-1 hover:bg-line" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium">Provedor</span>
          <select
            className={input}
            value={kind ?? ""}
            data-testid="provider-select"
            onChange={(e) => {
              setModels([]);
              setProbe({ loading: false });
              setDraft({ kind: (e.target.value || undefined) as ProviderKind | undefined });
            }}
          >
            <option value="">Padrão do servidor ({status ? `${status.defaultKind} · ${status.defaultModel}` : "…"})</option>
            {PROVIDER_KINDS.map((k) => (
              <option key={k} value={k}>
                {PROVIDER_LABELS[k]}
                {status?.keys[k] ? " · chave no .env" : ""}
              </option>
            ))}
          </select>
        </label>

        {kind && kind !== "mock" ? (
          <>
            {isLocal ? (
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-medium">URL do servidor</span>
                <input
                  className={input}
                  value={draft.baseURL ?? ""}
                  placeholder={status?.baseURLs[kind as "ollama"] ?? ""}
                  onChange={(e) => setDraft({ ...draft, baseURL: e.target.value })}
                />
              </label>
            ) : null}

            <label className="mt-3 block">
              <span className="mb-1 flex items-center text-xs font-medium">
                Modelo
                {isLocal ? (
                  <button type="button" onClick={listModels} className="ml-auto flex items-center gap-1 text-brand hover:underline">
                    {probe.loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} listar modelos do servidor
                  </button>
                ) : null}
              </span>
              <input
                className={input}
                list="model-options"
                value={draft.model ?? ""}
                placeholder={status?.defaultModels[kind] ?? ""}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              />
              <datalist id="model-options">
                {models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              {probe.error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{probe.error}</p> : null}
              {models.length ? <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">{models.length} modelo(s) encontrados.</p> : null}
            </label>

            {CLOUD_WITH_KEY.includes(kind) ? (
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-medium">Chave de API {status?.keys[kind] ? "(opcional: o .env já tem uma)" : ""}</span>
                <input
                  className={input}
                  type="password"
                  autoComplete="off"
                  value={draft.apiKey ?? ""}
                  onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                />
                <span className="mt-1 block text-[11px] text-muted">Fica só neste navegador e vai junto em cada pedido. Não é salva no servidor.</span>
              </label>
            ) : null}
          </>
        ) : null}

        {kind === "ollama" ? (
          <p className="mt-3 rounded-md bg-canvas p-2.5 text-xs text-muted">
            Ollama: instale em ollama.com, rode <code>ollama pull qwen2.5-coder:7b</code> e deixe o app aberto. O contexto é ajustado para 16k tokens.
          </p>
        ) : kind === "openai-compatible" ? (
          <p className="mt-3 rounded-md bg-canvas p-2.5 text-xs text-muted">
            LM Studio: <code>http://localhost:1234/v1</code> · llama.cpp: <code>http://127.0.0.1:8080/v1</code> · OpenRouter: <code>https://openrouter.ai/api/v1</code>
          </p>
        ) : kind === "mock" ? (
          <p className="mt-3 rounded-md bg-canvas p-2.5 text-xs text-muted">Sem IA: gera a landing direto do rascunho. Bom para testar a interface.</p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-md px-3 py-1.5 text-sm hover:bg-line" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-on-solid"
            data-testid="save-settings"
            onClick={() => {
              setSettings(draft);
              onClose();
            }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
