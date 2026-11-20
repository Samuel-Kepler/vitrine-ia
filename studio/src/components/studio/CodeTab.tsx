"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useStudio } from "@/lib/draft/store";

const VIEWS = [
  { id: "express", label: "A2UI Express (o que a IA escreveu)" },
  { id: "messages", label: "Mensagens A2UI v1.0" },
  { id: "draft", label: "Rascunho (JSON)" },
] as const;

export function CodeTab() {
  const result = useStudio((s) => s.result);
  const tree = useStudio((s) => s.tree);
  const [view, setView] = useState<(typeof VIEWS)[number]["id"]>("express");
  const [copied, setCopied] = useState(false);
  if (!result) return null;

  const text = view === "express" ? result.express : view === "messages" ? JSON.stringify(result.messages, null, 2) : JSON.stringify(tree, null, 2);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-panel">
      <div className="flex items-center gap-1 border-b border-line px-4 py-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`rounded-md px-3 py-1.5 text-xs ${view === v.id ? "bg-brand-soft font-medium text-brand" : "text-muted hover:bg-line"}`}
          >
            {v.label}
          </button>
        ))}
        <button
          className="ml-auto flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs hover:bg-canvas"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="flex-1 overflow-auto bg-[#0f1115] p-4 font-mono text-[12.5px] leading-relaxed text-gray-200">{text}</pre>
    </div>
  );
}
