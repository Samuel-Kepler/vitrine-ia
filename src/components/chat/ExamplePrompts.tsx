"use client";

import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";

export const EXAMPLE_PROMPTS = [
  { emoji: "☕", label: "Cafeteria", prompt: "Landing page de cafeteria artesanal com hero animado, cardápio em cards e botão de reservar mesa" },
  { emoji: "💇‍♀️", label: "Salão de beleza", prompt: "Landing de salão de beleza com hero em gradiente animado, lista de serviços com preços e depoimentos de clientes" },
  { emoji: "🏋️", label: "Personal trainer", prompt: "Página de personal trainer com planos mensais em cards de preço, contador de alunos animado e CTA de WhatsApp" },
  { emoji: "🍕", label: "Pizzaria", prompt: "Landing de pizzaria delivery com marquee de promoções, cardápio por categoria e botão flutuante de pedido" },
];

export function ExamplePrompts({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {EXAMPLE_PROMPTS.map((ex, i) => (
        <motion.button
          key={ex.label}
          type="button"
          onClick={() => onPick(ex.prompt)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 + i * 0.08, type: "spring", stiffness: 300, damping: 26 }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:border-violet-400/40 hover:bg-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <span className="text-xl leading-none">{ex.emoji}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-sm font-semibold text-white">
              {ex.label}
              <ArrowUpRight className="h-3.5 w-3.5 text-zinc-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-violet-300" />
            </span>
            <span className="mt-0.5 line-clamp-2 text-xs text-zinc-400">{ex.prompt}</span>
          </span>
        </motion.button>
      ))}
    </div>
  );
}
