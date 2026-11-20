"use client";
import { useStore } from "zustand";
import { Braces, Code2, Database, LayoutTemplate, Loader2, Network, PenTool, Redo2, Settings, Undo2, Wand2 } from "lucide-react";
import { useStudio, type StudioMode, type StudioTab } from "@/lib/draft/store";
import { PROVIDER_LABELS } from "@/lib/ai/settings";
import { ExportProject } from "./ExportProject";
import { ProjectsMenu } from "./ProjectsMenu";

const TABS: { id: StudioTab; label: string; icon: typeof PenTool }[] = [
  { id: "canvas", label: "Rascunho", icon: PenTool },
  { id: "landing", label: "Landing", icon: LayoutTemplate },
  { id: "code", label: "Código A2UI", icon: Code2 },
  { id: "react", label: "React", icon: Braces },
];

const MODES: { id: StudioMode; label: string; icon: typeof PenTool; hint: string }[] = [
  { id: "ui", label: "UI", icon: LayoutTemplate, hint: "Rascunho → landing page (A2UI)" },
  { id: "arch", label: "Arquitetura", icon: Network, hint: "Canvas de arquitetura → moldes de backend" },
  { id: "db", label: "Banco", icon: Database, hint: "Diagrama ER → SQL, Prisma, Drizzle, DBML" },
];

export function Header({
  onReimagine,
  onReimagineAll,
  progress,
  onOpenSettings,
  serverDefault,
}: {
  onReimagine: () => void;
  onReimagineAll: () => void;
  /** Texto do progresso do "Reimaginar todas" (ex.: "2/4 · Cardápio"). */
  progress?: string | null;
  onOpenSettings: () => void;
  serverDefault?: string;
}) {
  const pageCount = useStudio((s) => s.pages.length);
  const tab = useStudio((s) => s.tab);
  const setTab = useStudio((s) => s.setTab);
  const busy = useStudio((s) => s.busy);
  const hasResult = useStudio((s) => !!s.result);
  const settings = useStudio((s) => s.settings);
  const { undo, redo, pastStates, futureStates } = useStore(useStudio.temporal);
  const mode = useStudio((s) => s.mode);
  const setMode = useStudio((s) => s.setMode);

  const providerLabel = settings.kind
    ? `${PROVIDER_LABELS[settings.kind].split(" (")[0]}${settings.model ? ` · ${settings.model}` : ""}`
    : `Padrão do servidor${serverDefault ? ` · ${serverDefault}` : ""}`;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
      <div className="flex items-baseline gap-1.5 pr-3">
        <span className="text-[15px] font-semibold tracking-tight">vitrine</span>
        <span className="label-mono">studio</span>
      </div>

      <ProjectsMenu />

      <nav className="flex items-center gap-1 rounded-lg bg-canvas p-1" aria-label="Modos">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            data-testid={`mode-${m.id}`}
            aria-pressed={mode === m.id}
            title={m.hint}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${mode === m.id ? "bg-white font-semibold shadow-sm" : "text-gray-600 hover:text-ink"}`}
          >
            <m.icon size={15} /> {m.label}
          </button>
        ))}
      </nav>

      <div className={`mx-2 flex items-center gap-1 ${mode === "ui" ? "" : "invisible"}`} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            disabled={t.id !== "canvas" && t.id !== "react" && !hasResult}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm transition disabled:opacity-40 ${
              tab === t.id ? "bg-brand-soft font-medium text-brand" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1">
        {mode === "ui" ? (
          <>
            <button className="rounded-md p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-30" onClick={() => undo()} disabled={!pastStates.length} title="Desfazer" aria-label="Desfazer">
              <Undo2 size={17} />
            </button>
            <button className="rounded-md p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-30" onClick={() => redo()} disabled={!futureStates.length} title="Refazer" aria-label="Refazer">
              <Redo2 size={17} />
            </button>
          </>
        ) : null}
        <ExportProject />
        <button
          onClick={onOpenSettings}
          className="ml-1 flex items-center gap-1.5 whitespace-nowrap rounded-md border border-line px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          title="Escolher provedor de IA"
          data-testid="open-settings"
        >
          <Settings size={16} />
          <span className="max-w-56 truncate">{providerLabel}</span>
        </button>
        {mode === "ui" ? (
          <div className="ml-2 flex items-stretch overflow-hidden rounded-lg bg-brand text-white shadow-sm">
            <button
              onClick={onReimagine}
              disabled={busy}
              data-testid="reimagine"
              title={pageCount > 1 ? "Reimaginar a página aberta" : "Reimaginar"}
              className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition hover:brightness-110 disabled:opacity-70"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              {busy ? (progress ? `Reimaginando ${progress}…` : "Reimaginando…") : "Reimaginar"}
            </button>
            {pageCount > 1 ? (
              <button
                onClick={onReimagineAll}
                disabled={busy}
                data-testid="reimagine-all"
                title={`Reimaginar as ${pageCount} páginas, uma de cada vez, com a mesma paleta`}
                className="border-l border-white/20 px-3 text-sm font-medium transition hover:brightness-110 disabled:opacity-70"
              >
                Todas ({pageCount})
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
