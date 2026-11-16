"use client";

import { useEffect, useRef, useState } from "react";
import { useFileSystem } from "@/lib/contexts/file-system-context";
import {
  createImportMap,
  createPreviewHTML,
} from "@/lib/transform/jsx-transformer";
import { AlertCircle } from "lucide-react";

export function PreviewFrame() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { getAllFiles, refreshTrigger } = useFileSystem();
  const [error, setError] = useState<string | null>(null);
  const [entryPoint, setEntryPoint] = useState<string>("/App.jsx");
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    const updatePreview = () => {
      try {
        const files = getAllFiles();

        // Clear error first when we have files
        if (files.size > 0 && error) {
          setError(null);
        }

        // Find the entry point - look for App.jsx, App.tsx, index.jsx, or index.tsx
        let foundEntryPoint = entryPoint;
        const possibleEntries = [
          "/App.jsx",
          "/App.tsx",
          "/index.jsx",
          "/index.tsx",
          "/src/App.jsx",
          "/src/App.tsx",
        ];

        if (!files.has(entryPoint)) {
          const found = possibleEntries.find((path) => files.has(path));
          if (found) {
            foundEntryPoint = found;
            setEntryPoint(found);
          } else if (files.size > 0) {
            // Just use the first .jsx/.tsx file found
            const firstJSX = Array.from(files.keys()).find(
              (path) => path.endsWith(".jsx") || path.endsWith(".tsx")
            );
            if (firstJSX) {
              foundEntryPoint = firstJSX;
              setEntryPoint(firstJSX);
            }
          }
        }

        if (files.size === 0) {
          if (isFirstLoad) {
            setError("firstLoad");
          } else {
            setError("No files to preview");
          }
          return;
        }

        // We have files, so it's no longer the first load
        if (isFirstLoad) {
          setIsFirstLoad(false);
        }

        if (!foundEntryPoint || !files.has(foundEntryPoint)) {
          setError(
            "No React component found. Create an App.jsx or index.jsx file to get started."
          );
          return;
        }

        const { importMap, styles, errors } = createImportMap(files);
        const previewHTML = createPreviewHTML(foundEntryPoint, importMap, styles, errors);

        if (iframeRef.current) {
          const iframe = iframeRef.current;

          // Need both allow-scripts and allow-same-origin for blob URLs in import map
          iframe.setAttribute(
            "sandbox",
            "allow-scripts allow-same-origin allow-forms"
          );
          iframe.srcdoc = previewHTML;

          setError(null);
        }
      } catch (err) {
        console.error("Preview error:", err);
        setError(err instanceof Error ? err.message : "Unknown preview error");
      }
    };

    updatePreview();
  }, [refreshTrigger, getAllFiles, entryPoint, error, isFirstLoad]);

  if (error) {
    if (error === "firstLoad") {
      return (
        <div className="relative flex h-full items-center justify-center overflow-hidden bg-zinc-950 p-8" data-testid="preview-empty">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,.15),transparent_60%)]" />
          <div className="relative w-full max-w-md">
            {/* "Wireframe" de landing page esperando o código chegar */}
            <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="skeleton h-3 w-20 rounded-full" />
                <div className="skeleton h-6 w-16 rounded-full" />
              </div>
              <div className="skeleton mt-6 h-8 w-4/5 rounded-lg" />
              <div className="skeleton h-8 w-3/5 rounded-lg" />
              <div className="skeleton h-3 w-2/3 rounded-full" />
              <div className="flex gap-2 pt-2">
                <div className="h-9 w-28 rounded-full bg-gradient-to-r from-violet-500/60 to-fuchsia-500/60" />
                <div className="skeleton h-9 w-24 rounded-full" />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-4">
                <div className="skeleton h-16 rounded-xl" />
                <div className="skeleton h-16 rounded-xl" />
                <div className="skeleton h-16 rounded-xl" />
              </div>
            </div>
            <p className="mt-6 text-center text-sm font-semibold text-white">O preview aparece aqui, ao vivo</p>
            <p className="mt-1 text-center text-xs text-zinc-500">
              Cada arquivo que a IA cria no sistema de arquivos virtual re-renderiza este iframe.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 p-8">
        <div className="max-w-md text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
            <AlertCircle className="h-8 w-8 text-zinc-500" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">Sem preview</h3>
          <p className="text-sm text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full border-0 bg-white"
      title="Preview"
    />
  );
}
