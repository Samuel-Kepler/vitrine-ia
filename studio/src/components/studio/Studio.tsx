"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { useStudio } from "@/lib/draft/store";
import { Header } from "./Header";
import { PageBar } from "./PageBar";
import { Palette } from "./Palette";
import { Canvas } from "./Canvas";
import { Inspector } from "./Inspector";
import { LandingTab } from "./LandingTab";
import { CodeTab } from "./CodeTab";
import { SettingsDialog, type ServerStatus } from "./SettingsDialog";
import { runReimagine, runReimagineAll } from "./reimagine-client";

// React Flow só no navegador e só quando o modo é aberto.
const ArchCanvas = dynamic(() => import("@/components/arch/ArchCanvas"), { ssr: false });
const DbCanvas = dynamic(() => import("@/components/db/DbCanvas"), { ssr: false });

export default function Studio() {
  const tab = useStudio((s) => s.tab);
  const mode = useStudio((s) => s.mode);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus] = useState<ServerStatus>();

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  // Atalhos: Ctrl+Z / Ctrl+Shift+Z e Delete no bloco selecionado.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      const { temporal } = useStudio;
      if (useStudio.getState().mode !== "ui") return; // React Flow cuida dos atalhos lá
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) temporal.getState().redo();
        else temporal.getState().undo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && useStudio.getState().selectedId && useStudio.getState().tab === "canvas") {
        e.preventDefault();
        useStudio.getState().remove(useStudio.getState().selectedId!);
      } else if (e.key === "Escape") {
        useStudio.getState().select(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const reimagineNow = async () => {
    setError(null);
    const r = await runReimagine();
    if (r.error) setError(r.error);
  };

  const [progress, setProgress] = useState<string | null>(null);
  const reimagineAll = async () => {
    setError(null);
    const r = await runReimagineAll((done, total, name) => setProgress(done < total ? `${done + 1}/${total} · ${name}` : null));
    setProgress(null);
    if (r.error) setError(r.error);
  };

  return (
    <div className="flex h-screen flex-col">
      <Header onReimagine={reimagineNow} onReimagineAll={reimagineAll} progress={progress} onOpenSettings={() => setSettingsOpen(true)} serverDefault={status ? `${status.defaultKind} · ${status.defaultModel}` : undefined} />
      {mode === "ui" ? <PageBar /> : null}
      {error ? (
        <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800" role="alert">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} aria-label="Fechar aviso">
            <X size={16} />
          </button>
        </div>
      ) : null}
      <main className="flex min-h-0 flex-1">
        {mode === "arch" ? (
          <ArchCanvas />
        ) : mode === "db" ? (
          <DbCanvas />
        ) : tab === "canvas" ? (
          <>
            <Palette />
            <Canvas />
            <Inspector />
          </>
        ) : tab === "landing" ? (
          <LandingTab />
        ) : (
          <CodeTab />
        )}
      </main>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} status={status} />
    </div>
  );
}
