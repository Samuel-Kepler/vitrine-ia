"use client";

import { isToolUIPart, type UIMessage } from "ai";
import { motion } from "motion/react";
import { Check, FilePen, FilePlus2, Loader2, RotateCw, Sparkles, TriangleAlert, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { StreamingText } from "./StreamingText";
import { toolPartToStep, type AgentStep } from "./agent-steps";

interface MessageListProps {
  messages: UIMessage[];
  isLoading?: boolean;
}

const enter = {
  initial: { opacity: 0, y: 8, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { type: "spring" as const, stiffness: 380, damping: 30 },
};

function Node({
  icon,
  tone = "muted",
  active,
  children,
  testId,
}: {
  icon: React.ReactNode;
  tone?: "muted" | "accent" | "success" | "error";
  active?: boolean;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <motion.li {...enter} className="relative flex gap-3 pb-4 last:pb-0" data-testid={testId}>
      <span
        className={cn(
          "relative z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px]",
          tone === "muted" && "border-white/10 bg-zinc-900 text-zinc-400",
          tone === "accent" && "border-violet-400/40 bg-violet-500/15 text-violet-300",
          tone === "success" && "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
          tone === "error" && "border-rose-400/40 bg-rose-500/15 text-rose-300"
        )}
      >
        {active && <span className="absolute inset-0 animate-ping rounded-full bg-violet-400/30" />}
        {icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </motion.li>
  );
}

function ToolNode({ step }: { step: AgentStep }) {
  const Icon = step.command === "create" ? FilePlus2 : step.command === "str_replace" ? FilePen : Wrench;
  return (
    <Node
      testId="tool-step"
      active={step.state === "running"}
      tone={step.state === "done" ? "success" : step.state === "running" ? "accent" : "error"}
      icon={
        step.state === "running" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : step.state === "error" || step.state === "interrupted" ? (
          <TriangleAlert className="h-3 w-3" />
        ) : (
          <Icon className="h-3 w-3" />
        )
      }
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-3 py-2 text-xs transition-colors",
          step.state === "running"
            ? "border-violet-400/30 bg-violet-500/10 shimmer-border"
            : "border-white/5 bg-white/[0.03]"
        )}
      >
        <span className="text-zinc-300">{step.verb}</span>
        <code className="font-mono text-[12px] text-white">{step.target}</code>
        <span className="ml-auto rounded-md bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
          {step.tool}
        </span>
      </div>
    </Node>
  );
}

function AssistantMessage({ message, live }: { message: UIMessage; live: boolean }) {
  const parts = message.parts;
  const toolCount = parts.filter(isToolUIPart).length;
  const stepCount = Math.max(1, parts.filter((p) => p.type === "step-start").length);
  let loopIndex = 0;
  const lastTextIndex = parts.map((p) => p.type).lastIndexOf("text");

  return (
    <ol className="timeline relative" data-testid="agent-timeline">
      {parts.map((part, i) => {
        if (isToolUIPart(part)) return <ToolNode key={i} step={toolPartToStep(part, live)} />;
        switch (part.type) {
          case "step-start":
            loopIndex++;
            return loopIndex > 1 ? (
              <Node key={i} icon={<RotateCw className="h-3 w-3" />}>
                <span className="text-[11px] font-medium uppercase tracking-widest text-zinc-500">
                  loop · passo {loopIndex}
                </span>
              </Node>
            ) : null;
          case "text":
            if (!part.text.trim()) return null;
            return (
              <Node key={i} tone="accent" icon={<Sparkles className="h-3 w-3" />}>
                <div className="text-sm text-zinc-200">
                  <StreamingText
                    text={part.text}
                    streaming={live && i === lastTextIndex && part.state === "streaming"}
                  />
                </div>
              </Node>
            );
          case "reasoning":
            return (
              <Node key={i} icon={<Sparkles className="h-3 w-3" />}>
                <details className="text-xs text-zinc-400">
                  <summary className="cursor-pointer select-none">Reasoning</summary>
                  <p className="mt-1 whitespace-pre-wrap">{part.text}</p>
                </details>
              </Node>
            );
          case "source-url":
            return (
              <Node key={i} icon={<Sparkles className="h-3 w-3" />}>
                <span className="text-xs text-zinc-500">Source: {part.url}</span>
              </Node>
            );
          default:
            return null;
        }
      })}
      {live ? (
        <Node active tone="accent" icon={<Loader2 className="h-3 w-3 animate-spin" />} testId="thinking">
          <span className="shimmer-text text-sm font-medium">
            {toolCount === 0 ? "pensando…" : "trabalhando…"}
          </span>
        </Node>
      ) : (
        <Node tone="success" icon={<Check className="h-3 w-3" />} testId="done">
          <span className="text-xs text-zinc-400">
            <span className="font-semibold text-emerald-300">pronto</span> · {stepCount}{" "}
            {stepCount === 1 ? "passo" : "passos"} · {toolCount} tool {toolCount === 1 ? "call" : "calls"}
          </span>
        </Node>
      )}
    </ol>
  );
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <div className="flex flex-col gap-6 px-1 py-4">
      {messages.map((message, idx) => {
        const live = Boolean(isLoading) && idx === messages.length - 1 && message.role === "assistant";
        if (message.role === "user") {
          const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          return (
            <motion.div key={message.id} {...enter} className="flex justify-end" data-role="user">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm text-white shadow-lg shadow-violet-900/30">
                <span className="whitespace-pre-wrap">{text}</span>
              </div>
            </motion.div>
          );
        }
        return (
          <div key={message.id} data-role="assistant">
            <AssistantMessage message={message} live={live} />
          </div>
        );
      })}
      {isLoading && messages.at(-1)?.role === "user" && (
        <ol className="timeline relative" data-testid="agent-timeline">
          <Node active tone="accent" icon={<Loader2 className="h-3 w-3 animate-spin" />} testId="thinking">
            <span className="shimmer-text text-sm font-medium">pensando…</span>
          </Node>
        </ol>
      )}
    </div>
  );
}
