"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useFileSystem } from "@/lib/contexts/file-system-context";
import { DesignReview } from "@/lib/review/schema";

type ReviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; review: DesignReview; provider: string; modelId: string; ms: number }
  | { status: "error"; message: string };

interface ReviewContextType {
  state: ReviewState;
  open: boolean;
  setOpen: (open: boolean) => void;
  run: () => Promise<void>;
}

const ReviewContext = createContext<ReviewContextType | undefined>(undefined);

export function ReviewProvider({ children }: { children: ReactNode }) {
  const { fileSystem } = useFileSystem();
  const [state, setState] = useState<ReviewState>({ status: "idle" });
  const [open, setOpen] = useState(false);

  const run = async () => {
    setOpen(true);
    setState({ status: "loading" });
    const started = performance.now();
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: fileSystem.serialize() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      // Validamos de novo no cliente: o contrato vale nas duas pontas.
      const review = DesignReview.parse(json.review);
      setState({
        status: "done",
        review,
        provider: json.provider,
        modelId: json.modelId,
        ms: Math.round(performance.now() - started),
      });
    } catch (error) {
      setState({ status: "error", message: (error as Error).message });
    }
  };

  return (
    <ReviewContext.Provider value={{ state, open, setOpen, run }}>{children}</ReviewContext.Provider>
  );
}

export function useReview() {
  const ctx = useContext(ReviewContext);
  if (!ctx) throw new Error("useReview must be used within a ReviewProvider");
  return ctx;
}
