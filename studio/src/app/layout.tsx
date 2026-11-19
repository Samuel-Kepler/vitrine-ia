import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Interface do Studio: Plex Sans no texto, JetBrains Mono em rótulos e dados.
// A landing gerada (.lp) tem a própria fonte e não herda estas.
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "Vitrine Studio",
  description: "Monte a página com blocos e reimagine como landing page com IA (A2UI).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${plex.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
