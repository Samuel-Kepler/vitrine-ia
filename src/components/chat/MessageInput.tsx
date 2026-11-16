"use client";

import { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  input: string;
  handleInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
}

export const INPUT_PLACEHOLDER = "Descreva a landing page ou o componente que você quer criar...";

export function MessageInput({ input, handleInputChange, handleSubmit, isLoading }: MessageInputProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };
  const canSend = !isLoading && input.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="p-4">
      <div className="glow-ring relative rounded-2xl">
        <textarea
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={INPUT_PLACEHOLDER}
          disabled={isLoading}
          rows={3}
          className="w-full min-h-[84px] max-h-[200px] resize-none rounded-2xl border border-white/10 bg-zinc-900/80 py-3.5 pl-4 pr-14 text-[15px] text-white placeholder:text-zinc-500 transition-all focus:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60"
        />
        <button
          type="submit"
          aria-label="Enviar"
          disabled={!canSend}
          className={cn(
            "absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-xl transition-all disabled:cursor-not-allowed",
            canSend
              ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-900/40 hover:scale-105 active:scale-95"
              : "bg-white/5 text-zinc-500"
          )}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </div>
      <p className="mt-2 px-1 text-[11px] text-zinc-500">
        Enter envia · Shift+Enter quebra linha
      </p>
    </form>
  );
}
