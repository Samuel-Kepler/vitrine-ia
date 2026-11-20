"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, FileDown, FileUp, FolderOpen, Globe, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useStudio } from "@/lib/draft/store";
import { blankProjectData, PROJECT_KEYS } from "@/lib/projects/data";
import {
  createProject,
  deleteProject,
  duplicateProject,
  ensureIndex,
  loadProject,
  parseProjectFile,
  projectFile,
  projectFileName,
  renameProject,
  saveProject,
  sortedProjects,
  StorageFullError,
  switchProject,
  type KV,
  type ProjectIndex,
} from "@/lib/projects/projects";
import { extractOutline, MAX_IMPORT_PAGES, type PageOutline } from "@/lib/import/outline";
import type { ImportResult } from "@/lib/import/import";
import { download } from "./export";
import { generateSource } from "./GeneratePanel";

const MAX_HTML_BYTES = 3 * 1024 * 1024;
const kv = (): KV => window.localStorage;

const when = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

/** index.html primeiro; o resto na ordem do nome. */
function byPageOrder(a: File, b: File) {
  const home = (f: File) => (/^(index|home|inicio)\.html?$/i.test(f.name) ? 0 : 1);
  return home(a) - home(b) || a.name.localeCompare(b.name);
}

/** Projetos: criar, abrir, renomear, duplicar, apagar, salvar/abrir arquivo e importar site HTML. */
export function ProjectsMenu() {
  const [idx, setIdx] = useState<ProjectIndex | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const idxRef = useRef<ProjectIndex | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);
  const htmlInput = useRef<HTMLInputElement>(null);

  const apply = (next: ProjectIndex) => {
    idxRef.current = next;
    setIdx(next);
  };
  const guard = (fn: () => void) => {
    try {
      setError(null);
      fn();
    } catch (e) {
      setError(e instanceof StorageFullError || e instanceof Error ? e.message : String(e));
    }
  };
  /** Grava o projeto aberto agora (antes de trocar ou baixar). */
  const saveNow = () => {
    const cur = idxRef.current;
    if (cur) apply(saveProject(kv(), cur, cur.currentId, useStudio.getState().projectData()));
  };

  // Depois que o store leu o localStorage: o estado atual vira (ou já é) um projeto.
  useEffect(() => {
    const init = () => guard(() => apply(ensureIndex(kv(), useStudio.getState().projectData())));
    if (useStudio.persist.hasHydrated()) init();
    else return useStudio.persist.onFinishHydration(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salvamento automático: 800ms depois da última mudança no projeto.
  useEffect(() => {
    if (!idx) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const unsub = useStudio.subscribe((s, prev) => {
      if (!PROJECT_KEYS.some((k) => s[k] !== prev[k])) return;
      clearTimeout(t);
      t = setTimeout(() => guard(saveNow), 800);
    });
    const onLeave = () => guard(saveNow);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      clearTimeout(t);
      unsub();
      window.removeEventListener("beforeunload", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!idx]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!idx) return null;
  const current = idx.list.find((p) => p.id === idx.currentId);

  const openProject = (id: string) =>
    guard(() => {
      if (id === idx.currentId) return setOpen(false);
      saveNow();
      const data = loadProject(kv(), id);
      if (!data) throw new Error("Não consegui ler esse projeto.");
      apply(switchProject(kv(), idxRef.current!, id));
      useStudio.getState().loadProjectData(data);
      setNotes([]);
      setOpen(false);
    });

  const newProject = (name = "Novo projeto") =>
    guard(() => {
      saveNow();
      const data = blankProjectData();
      apply(createProject(kv(), idxRef.current!, name, data).idx);
      useStudio.getState().loadProjectData(data);
      setNotes([]);
      setOpen(false);
    });

  const commitRename = (id: string) =>
    guard(() => {
      apply(renameProject(kv(), idxRef.current!, id, nameDraft));
      setEditing(null);
    });

  const remove = (id: string) =>
    guard(() => {
      const wasCurrent = id === idxRef.current!.currentId;
      const next = deleteProject(kv(), idxRef.current!, id);
      apply(next);
      setConfirmDelete(null);
      if (wasCurrent) useStudio.getState().loadProjectData(loadProject(kv(), next.currentId) ?? blankProjectData());
    });

  const duplicate = (id: string) =>
    guard(() => {
      saveNow();
      const r = duplicateProject(kv(), idxRef.current!, id);
      if (!r) throw new Error("Não consegui duplicar esse projeto.");
      apply(r.idx);
      useStudio.getState().loadProjectData(loadProject(kv(), r.id)!);
    });

  const saveFile = () =>
    guard(() => {
      saveNow();
      const name = current?.name ?? "projeto";
      download(projectFileName(name), projectFile(name, useStudio.getState().projectData()), "application/json");
    });

  const openFile = async (file: File) => {
    setError(null);
    try {
      const { name, data } = parseProjectFile(await file.text());
      guard(() => {
        saveNow();
        apply(createProject(kv(), idxRef.current!, name, data).idx);
        useStudio.getState().loadProjectData(data);
        setNotes([`Projeto "${name}" aberto do arquivo ${file.name}.`]);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const importHtml = async (files: File[]) => {
    setError(null);
    setNotes([]);
    const html = files.filter((f) => /\.html?$/i.test(f.name)).sort(byPageOrder);
    if (!html.length) return setError("Escolha arquivos .html.");
    if (html.length > MAX_IMPORT_PAGES) return setError(`No máximo ${MAX_IMPORT_PAGES} páginas por vez (escolhidas: ${html.length}).`);
    const big = html.find((f) => f.size > MAX_HTML_BYTES);
    if (big) return setError(`${big.name} é grande demais (máx. 3 MB).`);
    setBusy("Lendo o site…");
    try {
      // DOMParser não executa os scripts do arquivo: só lemos o conteúdo.
      const parser = new DOMParser();
      const outlines: PageOutline[] = [];
      for (const f of html) outlines.push(extractOutline(parser.parseFromString(await f.text(), "text/html"), f.name));
      if (!outlines.some((o) => o.items.length)) throw new Error("Não achei conteúdo (títulos, textos) nesses arquivos.");

      setBusy("Convertendo em blocos…");
      const s = useStudio.getState();
      const clean = Object.fromEntries(Object.entries(s.settings).filter(([, v]) => typeof v === "string" && v.trim()));
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outlines, settings: clean.kind ? clean : undefined }),
      });
      const json = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`);

      const name = outlines[0].brand || outlines[0].title || "Site importado";
      guard(() => {
        saveNow();
        apply(createProject(kv(), idxRef.current!, name, blankProjectData()).idx);
        const st = useStudio.getState();
        st.loadProjectData(blankProjectData());
        st.replaceSite(json.pages);
        const dropped = outlines.flatMap((o) => o.items).length ? [] : ["Nenhum conteúdo encontrado."];
        setNotes([
          generateSource(json),
          `${json.pages.length} página(s) importada(s): ${json.pages.map((p) => p.name).join(", ")}. Clique em Reimaginar para gerar a landing em A2UI.`,
          "Imagens com endereço relativo (sem https://) ficam de fora: o arquivo .html não traz as imagens.",
          ...json.notes,
          ...dropped,
        ]);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const item = "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-canvas disabled:opacity-50";

  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-52 items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs hover:bg-canvas"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Projetos: criar, abrir, salvar, importar site"
        data-testid="projects-menu"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <FolderOpen size={13} />}
        <span className="truncate font-medium">{current?.name ?? "Projeto"}</span>
        <ChevronDown size={12} className="shrink-0 text-muted" />
      </button>

      {open || error || notes.length || busy ? (
        <div
          role="dialog"
          aria-label="Projetos"
          className={`absolute left-0 top-full z-50 mt-1.5 w-[22rem] rounded-xl border border-line bg-panel p-2 shadow-2xl ${open ? "" : "w-[22rem]"}`}
        >
          {open ? (
            <>
              <div className="grid grid-cols-2 gap-1 border-b border-line pb-2">
                <button className={item} onClick={() => newProject()} data-testid="project-new">
                  <Plus size={14} /> Novo projeto
                </button>
                <button className={item} onClick={saveFile} data-testid="project-save-file">
                  <FileDown size={14} /> Salvar arquivo
                </button>
                <button className={item} onClick={() => jsonInput.current?.click()} data-testid="project-open-file">
                  <FileUp size={14} /> Abrir arquivo
                </button>
                <button className={item} onClick={() => htmlInput.current?.click()} disabled={!!busy} data-testid="project-import-html" title="Escolha os .html do site (até 6 páginas)">
                  <Globe size={14} /> Importar site (HTML)
                </button>
              </div>

              <p className="px-2.5 pb-1 pt-2 label-mono">Neste navegador · salvo automaticamente</p>
              <ul className="max-h-72 overflow-y-auto" data-testid="project-list">
                {sortedProjects(idx).map((p) => (
                  <li key={p.id} className={`group flex items-center gap-1 rounded-md pr-1 ${p.id === idx.currentId ? "bg-brand-soft" : "hover:bg-canvas"}`}>
                    {editing === p.id ? (
                      <form
                        className="flex flex-1 items-center gap-1 px-1.5 py-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          commitRename(p.id);
                        }}
                      >
                        <input
                          autoFocus
                          value={nameDraft}
                          maxLength={80}
                          onChange={(e) => setNameDraft(e.target.value)}
                          onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                          className="min-w-0 flex-1 rounded border border-line px-1.5 py-0.5 text-xs outline-none focus:border-brand"
                          aria-label="Nome do projeto"
                        />
                        <button type="submit" className="rounded p-1 hover:bg-panel" aria-label="Salvar nome">
                          <Check size={13} />
                        </button>
                      </form>
                    ) : (
                      <button className="min-w-0 flex-1 px-2.5 py-1.5 text-left" onClick={() => openProject(p.id)} title={`Abrir ${p.name}`}>
                        <span className={`block truncate text-xs ${p.id === idx.currentId ? "font-semibold text-brand" : ""}`}>{p.name}</span>
                        <span className="block text-[10px] text-muted">{when(p.updatedAt)}</span>
                      </button>
                    )}
                    {confirmDelete === p.id ? (
                      <span className="flex items-center gap-1 text-[11px]">
                        <button className="rounded bg-red-600 px-1.5 py-0.5 text-white" onClick={() => remove(p.id)} data-testid="project-delete-confirm">
                          apagar
                        </button>
                        <button className="rounded p-0.5 hover:bg-panel" onClick={() => setConfirmDelete(null)} aria-label="Cancelar">
                          <X size={12} />
                        </button>
                      </span>
                    ) : editing !== p.id ? (
                      <span className="flex opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                        <button className="rounded p-1 hover:bg-panel" onClick={() => (setEditing(p.id), setNameDraft(p.name))} title="Renomear" aria-label={`Renomear ${p.name}`}>
                          <Pencil size={12} />
                        </button>
                        <button className="rounded p-1 hover:bg-panel" onClick={() => duplicate(p.id)} title="Duplicar" aria-label={`Duplicar ${p.name}`}>
                          <Copy size={12} />
                        </button>
                        {idx.list.length > 1 ? (
                          <button className="rounded p-1 text-red-700 dark:text-red-300 hover:bg-panel" onClick={() => setConfirmDelete(p.id)} title="Apagar" aria-label={`Apagar ${p.name}`}>
                            <Trash2 size={12} />
                          </button>
                        ) : null}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {busy ? (
            <p className="flex items-center gap-2 px-2.5 py-2 text-xs text-ink">
              <Loader2 size={13} className="animate-spin" /> {busy}
            </p>
          ) : null}
          {error ? (
            <p className="m-1 flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-950/40 p-2 text-xs text-red-800 dark:text-red-200" role="alert">
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} aria-label="Fechar aviso">
                <X size={12} />
              </button>
            </p>
          ) : null}
          {notes.length ? (
            <div className="m-1 rounded-md bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-900 dark:text-amber-100" data-testid="project-notes">
              <div className="flex">
                <ul className="flex-1 list-disc space-y-0.5 pl-4">
                  {notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
                <button className="self-start" onClick={() => setNotes([])} aria-label="Fechar avisos">
                  <X size={12} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <input
        ref={jsonInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void openFile(f);
        }}
      />
      <input
        ref={htmlInput}
        type="file"
        accept=".html,.htm,text/html"
        multiple
        hidden
        onChange={(e) => {
          const fs = [...(e.target.files ?? [])];
          e.target.value = "";
          if (fs.length) void importHtml(fs);
        }}
      />
    </div>
  );
}
