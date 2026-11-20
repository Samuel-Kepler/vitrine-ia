"use client";
import { useSyncExternalStore } from "react";
import {
  DEFAULT_THEME_PREF,
  SYSTEM_DARK_QUERY,
  applyTheme,
  readThemePref,
  resolveTheme,
  writeThemePref,
  type ResolvedTheme,
  type ThemePref,
} from "@/lib/studio/theme";

const listeners = new Set<() => void>();
let systemQuery: MediaQueryList | null = null;
let systemQueryListening = false;

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function systemQueryList(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(SYSTEM_DARK_QUERY);
}

function systemDark(): boolean {
  return systemQueryList()?.matches ?? false;
}

function notify() {
  listeners.forEach((l) => l());
}

/** Reaplica o tema efetivo e avisa os componentes. Com "sistema", acompanha mudanças do SO. */
function reapply(pref: ThemePref) {
  applyTheme(document.documentElement, resolveTheme(pref, systemDark()));
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!systemQuery) systemQuery = systemQueryList();
  if (systemQuery && !systemQueryListening) {
    systemQueryListening = true;
    systemQuery.addEventListener("change", () => reapply(readThemePref(getStorage())));
  }
  return () => {
    listeners.delete(listener);
  };
}

/** Define a preferência, salva e aplica. */
export function setThemePref(pref: ThemePref) {
  writeThemePref(getStorage(), pref);
  reapply(pref);
}

/** Preferência salva ("light" | "dark" | "system"). */
export function useThemePref(): ThemePref {
  return useSyncExternalStore(
    subscribe,
    () => readThemePref(getStorage()),
    () => DEFAULT_THEME_PREF,
  );
}

/** Tema efetivo lido do <html data-theme>, que o script inicial e reapply mantêm atualizado. */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"),
    () => "light",
  );
}
