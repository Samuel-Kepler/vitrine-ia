"use client";
import dynamic from "next/dynamic";

// O editor vive só no navegador: estado em localStorage e renderer A2UI
// (que acessa HTMLElement ao ser importado).
const Studio = dynamic(() => import("@/components/studio/Studio"), {
  ssr: false,
  loading: () => <div className="flex h-screen items-center justify-center text-sm text-gray-500">Abrindo o Vitrine Studio…</div>,
});

export default function Page() {
  return <Studio />;
}
