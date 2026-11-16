"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { ActiveModelInfo } from "@/lib/provider";

const DOT: Record<string, string> = {
  anthropic: "bg-orange-400",
  google: "bg-sky-400",
  groq: "bg-rose-400",
  openrouter: "bg-violet-400",
  mock: "bg-zinc-400",
};

// Mostra qual provedor/modelo o servidor está usando agora.
// Troque AI_PROVIDER no .env, recarregue a página e o badge muda.
export function ProviderBadge({ info }: { info: ActiveModelInfo }) {
  return (
    <motion.div
      key={`${info.provider}/${info.modelId}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      title={info.error ?? "Provedor ativo (definido no .env)"}
      data-testid="provider-badge"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px]",
        info.error ? "border-rose-400/40 bg-rose-500/10 text-rose-200" : "border-white/10 bg-white/[0.04] text-zinc-300"
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", DOT[info.provider] ?? DOT.mock)} />
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", info.error ? "bg-rose-400" : (DOT[info.provider] ?? DOT.mock))} />
      </span>
      <span className="text-white">{info.provider}</span>
      <span className="text-zinc-500">·</span>
      <span>{info.modelId}</span>
    </motion.div>
  );
}
