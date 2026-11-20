import type { LucideIcon } from "lucide-react";
import {
  Blocks,
  Cpu,
  Database,
  Download,
  FolderOpen,
  Globe,
  Images,
  Code2,
  Layers,
  LayoutGrid,
  Network,
  PenTool,
  ShieldCheck,
  ClipboardCheck,
  Sparkles,
  Wand2,
} from "lucide-react";

export interface ToolInfo {
  name: string;
  icon: LucideIcon;
  description: string;
}

/** Ferramentas do Studio, conforme README e componentes em src/components/studio. */
export const TOOLS: ToolInfo[] = [
  {
    name: "Gerar com IA",
    icon: Sparkles,
    description: "Descreva a página ou o site inteiro em texto. A IA escolhe os blocos e preenche os textos; o que você não informou vira marcador, como [preço].",
  },
  {
    name: "Paleta de blocos",
    icon: LayoutGrid,
    description: "Menu, hero, benefícios, depoimentos, preços, formulário e rodapé, além de seções prontas: número, pergunta, passo, equipe, contato, logos e galeria.",
  },
  {
    name: "Desenho → blocos",
    icon: PenTool,
    description: "Rabisque a ideia num quadro e a IA monta a seção com os blocos do catálogo. Você vê o que vai entrar antes de aplicar no canvas.",
  },
  {
    name: "Reimaginar",
    icon: Wand2,
    description: "Transforma o rascunho em landing page A2UI validada, com temas de tipografia, variações de hero e cards, e movimento calmo, animado ou nenhum.",
  },
  {
    name: "Revisão com IA",
    icon: ClipboardCheck,
    description: "Dá uma nota de 0 a 100 e até 6 problemas, cada um com sugestão. As regras fixas valem mesmo sem IA.",
  },
  {
    name: "Fotos gratuitas",
    icon: Images,
    description: "Busca fotos no Openverse e no Pexels. Preencher fotos vazias completa heróis, imagens e galerias de uma vez.",
  },
  {
    name: "Importar site HTML",
    icon: Globe,
    description: "Escolha os .html de um site (até 6 páginas). O Studio lê títulos e textos e monta o rascunho para você editar.",
  },
  {
    name: "Múltiplas páginas",
    icon: Layers,
    description: "Crie o site página por página, com menu e rodapé compartilhados. Reimaginar → Todas refaz as páginas com a mesma paleta.",
  },
  {
    name: "Código A2UI e React",
    icon: Code2,
    description: "Veja o JSON A2UI da landing. Na aba React, edite o projeto com o chat de código e acompanhe o preview ao vivo.",
  },
  {
    name: "Arquitetura",
    icon: Network,
    description: "Desenhe APIs, serviços, filas e workers. Gere os moldes do backend (Node + Hono) com docker-compose, Postgres e Redis.",
  },
  {
    name: "Banco",
    icon: Database,
    description: "Desenhe tabelas e relações. Gere SQL para Postgres, MySQL e SQLite, Prisma, Drizzle ou DBML, e importe arquivos .dbml ou .sql.",
  },
  {
    name: "Exportar projeto",
    icon: Download,
    description: "Baixe um .zip com o site em HTML, o projeto React (Vite), o backend com docker-compose e os schemas do banco.",
  },
  {
    name: "Projetos",
    icon: FolderOpen,
    description: "Vários projetos no mesmo navegador, salvos automaticamente. Cada um também pode ser salvo e aberto como arquivo .vitrine.json.",
  },
  {
    name: "IA local e na nuvem",
    icon: Cpu,
    description: "Use Ollama, LM Studio, llama.cpp ou OpenRouter, ou provedores na nuvem como Groq, Google Gemini e Anthropic Claude. Sem chave, o modo mock mantém a demo funcionando.",
  },
  {
    name: "Não inventa fatos",
    icon: ShieldCheck,
    description: "Preço, horário, produto ou depoimento que você não escreveu vira marcador. Se a IA citar um número ou nome novo, um aviso amarelo lista cada um.",
  },
];

/** Como funciona: do rascunho ao projeto exportado. */
export const STEPS: { title: string; description: string }[] = [
  {
    title: "Rascunho",
    description: "Monte a página arrastando blocos da paleta, ou gere um rascunho inteiro a partir de um texto com Gerar com IA.",
  },
  {
    title: "Reimaginar",
    description: "A IA escreve a landing em A2UI, o compilador valida o resultado e você vê a página ao vivo, com temas e movimento.",
  },
  {
    title: "Arquitetura e Banco",
    description: "Clique em Sugerir da landing para propor a API, as filas e as tabelas que o site precisa. Revise os avisos e gere o backend e o schema.",
  },
  {
    title: "Exportar projeto",
    description: "Baixe um .zip com o site em HTML, o projeto React, o backend com docker-compose e os schemas do banco.",
  },
];
