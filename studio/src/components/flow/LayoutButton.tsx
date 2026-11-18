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
        className="flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-40"
      >
        <LayoutGrid size={14} /> Organizar
      </button>
    </Panel>
  );
}
