"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { Braces, ClipboardCheck, FileCode2, Github, ScanSearch, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { reviewToIssues, type DesignReview, type Severity } from "@/lib/review/schema";
import { useReview } from "./review-context";

const SEVERITY: Record<Severity, { label: string; className: string }> = {
  high: { label: "alta", className: "bg-rose-500/15 text-rose-300 border-rose-400/30" },
  medium: { label: "média", className: "bg-amber-500/15 text-amber-200 border-amber-400/30" },
  low: { label: "baixa", className: "bg-sky-500/15 text-sky-300 border-sky-400/30" },
};

function scoreColor(score: number) {
  if (score >= 85) return "#34d399";
  if (score >= 65) return "#fbbf24";
  return "#fb7185";
}

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const value = useMotionValue(0);
  const offset = useTransform(value, (v) => c - (v / 100) * c);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const controls = animate(value, score, { duration: 1.2, ease: [0.2, 0.8, 0.2, 1] });
    const unsub = value.on("change", (v) => setShown(Math.round(v)));
    return () => {
      controls.stop();
      unsub();
    };
  }, [score, value]);

  return (
    <div className="relative h-32 w-32 shrink-0" data-testid="review-score">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={scoreColor(score)}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          style={{ strokeDashoffset: offset, filter: `drop-shadow(0 0 8px ${scoreColor(score)}66)` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-4xl font-black tabular-nums text-white">{shown}</div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">de 100</div>
        </div>
      </div>
    </div>
  );
}

function ReviewResult({ review, provider, modelId, ms }: { review: DesignReview; provider: string; modelId: string; ms: number }) {
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyIssues = async () => {
    await navigator.clipboard?.writeText(JSON.stringify(reviewToIssues(review), null, 2)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-5 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-5"
      >
        <ScoreRing score={review.score} />
        <div className="min-w-0">
          <p className="text-sm leading-relaxed text-zinc-200" data-testid="review-summary">
            {review.summary}
          </p>
          <p className="mt-2 font-mono text-[10px] text-zinc-500">
            {provider} · {modelId} · {(ms / 1000).toFixed(1)}s
          </p>
        </div>
      </motion.div>

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          {review.issues.length} {review.issues.length === 1 ? "issue" : "issues"}
        </h3>
        <div className="flex gap-1.5">
          <button
            onClick={() => setShowJson((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors",
              showJson ? "border-violet-400/40 bg-violet-500/15 text-violet-200" : "border-white/10 text-zinc-400 hover:text-white"
            )}
          >
            <Braces className="h-3.5 w-3.5" /> JSON
          </button>
          <button
            onClick={copyIssues}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:text-white"
            title="Copia o resultado de reviewToIssues(review)"
          >
            {copied ? <ClipboardCheck className="h-3.5 w-3.5 text-emerald-300" /> : <Github className="h-3.5 w-3.5" />}
            {copied ? "copiado" : "issues"}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {showJson ? (
          <motion.pre
            key="json"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-h-[60vh] overflow-auto rounded-2xl border border-white/10 bg-black/50 p-4 font-mono text-[11px] leading-relaxed text-emerald-200"
            data-testid="review-json"
          >
            {JSON.stringify(review, null, 2)}
          </motion.pre>
        ) : (
          <motion.ul key="cards" className="space-y-3" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.09, delayChildren: 0.25 } } }}>
            {review.issues.map((issue) => (
              <motion.li
                key={issue.id}
                variants={{ hidden: { opacity: 0, x: 24 }, show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 26 } } }}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20"
                data-testid="review-issue"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", SEVERITY[issue.severity].className)}>
                    {SEVERITY[issue.severity].label}
                  </span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] text-zinc-400">{issue.rule}</span>
                  <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-zinc-500">
                    <FileCode2 className="h-3 w-3" />
                    {issue.file}
                  </span>
                </div>
                <h4 className="mt-2 text-sm font-semibold text-white">{issue.title}</h4>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">{issue.suggestion}</p>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ReviewPanel() {
  const { state, open, setOpen } = useReview();

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="review"
          initial={{ x: "100%", opacity: 0.4 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="absolute inset-y-0 right-0 z-30 flex w-full max-w-[440px] flex-col border-l border-white/10 bg-zinc-950/95 shadow-2xl shadow-black backdrop-blur-xl"
          data-testid="review-panel"
          aria-label="Design Review"
        >
          <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                <ScanSearch className="h-4 w-4 text-violet-300" /> Design Review
              </h2>
              <p className="text-[11px] text-zinc-500">structured output · validado com zod</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fechar review" className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-5">
            {state.status === "loading" && (
              <div className="space-y-3" data-testid="review-loading">
                <div className="flex items-center gap-5 rounded-3xl border border-white/10 p-5">
                  <div className="h-32 w-32 animate-pulse rounded-full border-[10px] border-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-full rounded" />
                    <div className="skeleton h-3 w-4/5 rounded" />
                    <div className="skeleton h-3 w-2/3 rounded" />
                  </div>
                </div>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton h-24 rounded-2xl" />
                ))}
                <p className="shimmer-text text-center text-xs">analisando hierarquia, cor, estados…</p>
              </div>
            )}
            {state.status === "error" && (
              <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                {state.message}
              </div>
            )}
            {state.status === "done" && <ReviewResult {...state} />}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
