"use client";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { Finding } from "@/lib/review/rules";

const ICON = { error: AlertCircle, warning: AlertTriangle, info: Info } as const;
const COLOR = { error: "text-red-600 dark:text-red-400", warning: "text-amber-600 dark:text-amber-400", info: "text-sky-600 dark:text-sky-400" } as const;

export function ReviewList({ findings, onPick }: { findings: Finding[]; onPick?: (id: string) => void }) {
  if (!findings.length) {
    return (
      <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 size={16} /> Nada a apontar.
      </p>
    );
  }
  const order = { error: 0, warning: 1, info: 2 };
  return (
    <ul className="space-y-2" data-testid="review-list">
      {[...findings]
        .sort((a, b) => order[a.severity] - order[b.severity])
        .map((f, i) => {
          const Icon = ICON[f.severity];
          return (
            <li key={i}>
              <button
                className="flex w-full items-start gap-2 rounded-md p-1.5 text-left text-xs hover:bg-canvas"
                onClick={() => f.targetId && onPick?.(f.targetId)}
              >
                <Icon size={15} className={`mt-px shrink-0 ${COLOR[f.severity]}`} />
                <span>
                  {f.message} <span className="text-muted">({f.code})</span>
                </span>
              </button>
            </li>
          );
        })}
    </ul>
  );
}
