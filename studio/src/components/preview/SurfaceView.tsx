"use client";
// Renderiza mensagens A2UI v1.0: processador do web_core + view do @a2ui/react.
// Carregue este arquivo só no navegador (next/dynamic com ssr:false).
import { useMemo, useState } from "react";
import { MessageProcessor } from "@a2ui/web_core/v1_0";
import { A2uiSurface, MarkdownContext } from "@a2ui/react/v0_9";
import { renderMarkdown } from "@a2ui/markdown-it";
import { landingCatalog } from "@/lib/a2ui/views";
import { SURFACE_ID } from "@/lib/a2ui/catalog-api";

export interface A2uiAction {
  name: string;
  context?: Record<string, unknown>;
  sourceComponentId?: string;
}

interface Props {
  messages: unknown[];
  onAction?: (action: A2uiAction) => void;
}

export default function SurfaceView({ messages, onAction }: Props) {
  const [handler] = useState(() => ({ current: onAction }));
  handler.current = onAction;

  const { surface, errors } = useMemo(() => {
    const processor = new MessageProcessor([landingCatalog as never], (a: A2uiAction) => handler.current?.(a));
    const errs = (processor as any).processMessagesWithErrors(messages) as unknown[];
    return { surface: processor.model.surfacesMap.get(SURFACE_ID), errors: errs ?? [] };
  }, [messages, handler]);

  if (errors.length) {
    return (
      <div className="m-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-semibold">O renderer recusou a página</p>
        <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(errors, null, 2)}</pre>
      </div>
    );
  }
  if (!surface) return <p className="p-6 text-sm text-gray-500">Nenhuma superfície A2UI.</p>;
  return (
    <MarkdownContext.Provider value={renderMarkdown as never}>
      <A2uiSurface surface={surface as never} />
    </MarkdownContext.Provider>
  );
}
