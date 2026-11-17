"use client";
// Arrastar e soltar nativo (HTML5). O payload fica num módulo porque o
// navegador não deixa ler dataTransfer durante o dragover.
import type { DragPayload } from "@/lib/draft/store";

export const DND_MIME = "application/x-vitrine-block";
let current: DragPayload | null = null;

export function startDrag(e: React.DragEvent, payload: DragPayload) {
  current = payload;
  e.dataTransfer.effectAllowed = payload.kind === "move" ? "move" : "copy";
  e.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
  e.dataTransfer.setData("text/plain", payload.kind);
}

export function currentDrag(): DragPayload | null {
  return current;
}

export function endDrag() {
  current = null;
}

export function readDrop(e: React.DragEvent): DragPayload | null {
  const raw = e.dataTransfer.getData(DND_MIME);
  if (raw) {
    try {
      return JSON.parse(raw) as DragPayload;
    } catch {
      /* ignora */
    }
  }
  return current;
}
