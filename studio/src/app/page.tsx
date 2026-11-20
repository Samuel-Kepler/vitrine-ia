import type { Metadata } from "next";
import { Home } from "@/components/home/Home";

export const metadata: Metadata = {
  title: "Vitrine Studio",
  description: "Arraste blocos ou descreva a página, e a IA transforma o rascunho em landing page (A2UI). Depois gere o backend, o banco e exporte o projeto.",
};

export default function Page() {
  return <Home />;
}
