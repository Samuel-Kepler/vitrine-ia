"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { ExamplePrompts } from "./ExamplePrompts";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChat } from "@/lib/contexts/chat-context";

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex h-full flex-col justify-center gap-6 py-8" data-testid="empty-state">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />
          IA gerando código ao vivo
        </span>
        <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight text-white">
          Landing pages que vendem,{" "}
          <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
            em segundos.
          </span>
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Descreva o negócio do seu cliente. Você vê o modelo pensando, criando arquivos e o preview
          aparecendo na hora.
        </p>
      </motion.div>
      <ExamplePrompts onPick={onPick} />
    </div>
  );
}

// A rota devolve { error } em JSON; o useChat repassa o corpo cru.
function readableError(error: Error) {
  try {
    return JSON.parse(error.message).error ?? error.message;
  } catch {
    return error.message;
  }
}

export function ChatInterface() {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { messages, input, handleInputChange, handleSubmit, status, sendText, error } = useChat();
  const busy = status === "submitted" || status === "streaming";

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages, status]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-hidden">
        <div className="px-5">
          {messages.length === 0 ? (
            <EmptyState onPick={(p) => sendText?.(p)} />
          ) : (
            <MessageList messages={messages} isLoading={busy} />
          )}
          {error && (
            <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200" role="alert">
              Erro na chamada ao modelo: {readableError(error)}
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="flex-shrink-0">
        <MessageInput
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isLoading={busy}
        />
      </div>
    </div>
  );
}
