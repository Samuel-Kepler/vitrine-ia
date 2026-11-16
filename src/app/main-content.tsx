"use client";

import { useState } from "react";
import type { UIMessage } from "ai";
import { motion } from "motion/react";
import { Code2, Eye, ScanSearch } from "lucide-react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { FileSystemProvider, useFileSystem } from "@/lib/contexts/file-system-context";
import { ChatProvider, useChat } from "@/lib/contexts/chat-context";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { FileTree } from "@/components/editor/FileTree";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { PreviewFrame } from "@/components/preview/PreviewFrame";
import { HeaderActions } from "@/components/HeaderActions";
import { ProviderBadge } from "@/components/brand/ProviderBadge";
import { ReviewProvider, useReview } from "@/components/review/review-context";
import { ReviewPanel } from "@/components/review/ReviewPanel";
import { cn } from "@/lib/utils";
import type { ActiveModelInfo } from "@/lib/provider";

interface MainContentProps {
  user?: { id: string; email: string } | null;
  project?: {
    id: string;
    name: string;
    messages: UIMessage[];
    data: any;
    createdAt: Date;
    updatedAt: Date;
  };
  modelInfo?: ActiveModelInfo;
}

type View = "preview" | "code";

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 shadow-lg shadow-fuchsia-900/40">
        <span className="text-sm font-black text-white">V</span>
        <span className="absolute inset-0 bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,.45)_50%,transparent_70%)] bg-[length:250%_100%] animate-[shine_3.5s_ease-in-out_infinite]" />
      </div>
      <div className="leading-none">
        <h1 className="text-[15px] font-black tracking-tight text-white">Vitrine</h1>
        <p className="mt-0.5 text-[10px] text-zinc-500">landing pages com IA · uigen</p>
      </div>
    </div>
  );
}

function ViewSwitch({ view, setView }: { view: View; setView: (v: View) => void }) {
  const items: { id: View; label: string; icon: typeof Eye }[] = [
    { id: "preview", label: "Preview", icon: Eye },
    { id: "code", label: "Código", icon: Code2 },
  ];
  return (
    <div role="tablist" className="relative flex rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          role="tab"
          aria-selected={view === id}
          onClick={() => setView(id)}
          className={cn(
            "relative z-10 flex items-center gap-1.5 rounded-[10px] px-3.5 py-1.5 text-xs font-semibold transition-colors",
            view === id ? "text-white" : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          {view === id && (
            <motion.span layoutId="view-pill" className="absolute inset-0 -z-10 rounded-[10px] bg-white/10" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
          )}
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

function ReviewButton() {
  const { run, state } = useReview();
  const { getAllFiles, refreshTrigger } = useFileSystem();
  const { status } = useChat();
  void refreshTrigger; // re-renderiza quando o FS muda
  const hasFiles = Array.from(getAllFiles().keys()).some((p) => /\.(jsx|tsx|js|ts)$/.test(p));
  const busy = state.status === "loading" || status === "streaming" || status === "submitted";
  return (
    <button
      onClick={run}
      disabled={!hasFiles || busy}
      data-testid="review-button"
      className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-zinc-950 shadow-lg shadow-violet-900/30 transition-all hover:-translate-y-0.5 hover:shadow-violet-700/40 active:scale-95 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-500 disabled:shadow-none disabled:hover:translate-y-0"
    >
      <ScanSearch className={cn("h-3.5 w-3.5", state.status === "loading" && "animate-spin")} />
      {state.status === "loading" ? "Revisando…" : "Design Review"}
    </button>
  );
}

export function MainContent({ user, project, modelInfo }: MainContentProps) {
  const [view, setView] = useState<View>("preview");
  const info = modelInfo ?? { provider: "mock", modelId: "mock-uigen" };

  return (
    <FileSystemProvider initialData={project?.data}>
      <ChatProvider projectId={project?.id} initialMessages={project?.messages}>
        <ReviewProvider>
          <div className="app-bg dark flex h-screen w-screen flex-col overflow-hidden text-zinc-100">
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] px-5">
              <div className="flex items-center gap-4">
                <Logo />
                <ProviderBadge info={info} />
              </div>
              <HeaderActions user={user} projectId={project?.id} />
            </header>

            <ResizablePanelGroup direction="horizontal" className="flex-1">
              <ResizablePanel defaultSize={36} minSize={26} maxSize={50}>
                <div className="h-full border-r border-white/[0.06] bg-zinc-950/40">
                  <ChatInterface />
                </div>
              </ResizablePanel>

              <ResizableHandle className="w-px bg-white/[0.06] transition-colors hover:bg-violet-400/50" />

              <ResizablePanel defaultSize={64}>
                <div className="flex h-full flex-col p-3 pl-2">
                  <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 shadow-2xl shadow-black/50">
                    <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] px-3">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1.5 pl-1">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                        </div>
                        <ViewSwitch view={view} setView={setView} />
                      </div>
                      <ReviewButton />
                    </div>

                    <div className="relative flex-1 overflow-hidden">
                      {view === "preview" ? (
                        <div className="h-full bg-white">
                          <PreviewFrame />
                        </div>
                      ) : (
                        <ResizablePanelGroup direction="horizontal" className="h-full">
                          <ResizablePanel defaultSize={28} minSize={18} maxSize={50}>
                            <div className="h-full border-r border-white/[0.06] bg-zinc-950/60">
                              <FileTree />
                            </div>
                          </ResizablePanel>
                          <ResizableHandle className="w-px bg-white/[0.06]" />
                          <ResizablePanel defaultSize={72}>
                            <div className="h-full bg-[#1e1e1e]">
                              <CodeEditor />
                            </div>
                          </ResizablePanel>
                        </ResizablePanelGroup>
                      )}
                      <ReviewPanel />
                    </div>
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </ReviewProvider>
      </ChatProvider>
    </FileSystemProvider>
  );
}
