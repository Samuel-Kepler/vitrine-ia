"use client";
import { useMemo, useState } from "react";
import { Download, FileCode2, X } from "lucide-react";
import type { GeneratedFile } from "@/lib/db/codegen";
import { downloadZip } from "@/components/studio/export";

export function FilesPanel({ title, files, zipName, onClose }: { title: string; files: GeneratedFile[]; zipName: string; onClose: () => void }) {
  const [active, setActive] = useState(files[0]?.path);
  const current = files.find((f) => f.path === active) ?? files[0];
  const tree = useMemo(() => [...files].sort((a, b) => a.path.localeCompare(b.path)), [files]);

  const onDownload = () => downloadZip(zipName, files);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
      <div role="dialog" aria-label={title} className="flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <FileCode2 size={18} className="text-brand" />
          <h2 className="font-semibold">{title}</h2>
          <span className="text-xs text-muted">{files.length} arquivos</span>
          <button onClick={onDownload} data-testid="download-zip" className="ml-auto flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-sm text-on-solid hover:opacity-90">
            <Download size={15} /> Baixar .zip
          </button>
          <button onClick={onClose} className="rounded p-1 hover:bg-line" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1">
          <ul className="w-72 shrink-0 overflow-y-auto border-r border-line py-2 text-xs">
            {tree.map((f) => (
              <li key={f.path}>
                <button
                  onClick={() => setActive(f.path)}
                  className={`block w-full truncate px-4 py-1.5 text-left font-mono ${f.path === current?.path ? "bg-brand-soft text-brand" : "hover:bg-canvas"}`}
                  title={f.path}
                >
                  {f.path}
                </button>
              </li>
            ))}
          </ul>
          <pre className="flex-1 overflow-auto bg-[#0f1115] p-4 font-mono text-[12.5px] leading-relaxed text-gray-200">{current?.content}</pre>
        </div>
      </div>
    </div>
  );
}
