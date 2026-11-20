"use client";
import { Panel, useReactFlow } from "@xyflow/react";
import { LayoutGrid } from "lucide-react";

/** Botão "Organizar" no canto do canvas: aplica o auto-layout e reenquadra. */
export function LayoutButton({ onLayout, disabled }: { onLayout: () => void; disabled?: boolean }) {
  const { fitView } = useReactFlow();
  return (
    <Panel position="top-right">
      <button
        disabled={disabled}
        data-testid="auto-layout"
        title="Reorganizar automaticamente seguindo as ligações"
        onClick={() => {
          onLayout();
          requestAnimationFrame(() => requestAnimationFrame(() => void fitView({ padding: 0.15, duration: 300 })));
        }}
        className="flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-ink shadow-sm hover:bg-canvas disabled:opacity-40"
      >
        <LayoutGrid size={14} /> Organizar
      </button>
    </Panel>
  );
}
