"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { nextThemePref, type ThemePref } from "@/lib/studio/theme";
import { setThemePref, useThemePref } from "./useTheme";

const LABELS: Record<ThemePref, string> = { light: "Claro", dark: "Escuro", system: "Sistema" };
const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

/** Botão que cicla Claro → Escuro → Sistema. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const pref = useThemePref();
  const Icon = ICONS[pref];
  const next = nextThemePref(pref);
  return (
    <button
      type="button"
      onClick={() => setThemePref(next)}
      title={`Tema: ${LABELS[pref]}. Mudar para ${LABELS[next]}`}
      aria-label={`Tema: ${LABELS[pref]}. Mudar para ${LABELS[next]}`}
      data-testid="theme-toggle"
      className={`flex items-center gap-1.5 rounded-md border border-line px-2.5 py-2 text-sm text-ink hover:bg-canvas ${className}`}
    >
      <Icon size={16} aria-hidden />
      <span className="hidden md:inline">{LABELS[pref]}</span>
    </button>
  );
}
