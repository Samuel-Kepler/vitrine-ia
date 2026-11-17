"use client";
import { useCallback, useEffect, useState } from "react";
import type { Node, NodeChangeset } from "@xyflow/react";

/**
 * Nós do React Flow em estado local (o RF precisa medir os nós), com a
 * posição salva no store só ao soltar. Mudanças vindas do store (inspetor,
 * sugestão da IA) re-sincronizam preservando medidas e seleção.
 */
export function useFlowNodes<T extends { id: string; position: { x: number; y: number } }>(
  items: T[],
  toNode: (item: T) => Node,
  commit: { move: (id: string, pos: { x: number; y: number }) => void; remove: (ids: string[]) => void },
  /** Outra fonte que muda o conteúdo dos nós (ex.: relações -> colunas FK). */
  extra?: unknown,
) {
  const [nodes, setNodes] = useState<Node[]>(() => items.map(toNode));

  useEffect(() => {
    setNodes((prev) => {
      const old = new Map(prev.map((n) => [n.id, n]));
      return items.map((it) => {
        const fresh = toNode(it);
        const o = old.get(it.id);
        return o ? { ...o, data: fresh.data, position: fresh.position, type: fresh.type } : fresh;
      });
    });
    // toNode muda a cada render; items é a fonte da verdade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, extra]);

  const onNodesChange = useCallback(
    (changes: NodeChangeset<Node>) => {
      setNodes((ns) => changes.applyTo(ns));
      const removed: string[] = [];
      for (const ch of changes) {
        if (ch.type === "position" && ch.dragging === false && ch.position) commit.move(ch.id, ch.position);
        if (ch.type === "remove") removed.push(ch.id);
      }
      if (removed.length) commit.remove(removed);
    },
    [commit],
  );

  return { nodes, onNodesChange };
}
