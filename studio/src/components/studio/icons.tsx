import {
  BadgeHelp,
  BarChart3,
  Building2,
  Columns3,
  Footprints,
  GalleryHorizontal,
  MapPin,
  Users,
  CreditCard,
  Heading,
  Image,
  LayoutPanelTop,
  MousePointerClick,
  PanelBottom,
  PanelTop,
  Quote,
  Rows3,
  Sparkles,
  Square,
  SquareDashed,
  TextCursorInput,
  Type,
  Wand2,
  type LucideProps,
} from "lucide-react";
import type { BlockType } from "@/lib/draft/blocks";

const MAP: Record<BlockType, React.ComponentType<LucideProps>> = {
  section: SquareDashed,
  row: Columns3,
  column: Rows3,
  card: Square,
  navbar: PanelTop,
  hero: LayoutPanelTop,
  heading: Heading,
  text: Type,
  button: MousePointerClick,
  image: Image,
  feature: Sparkles,
  testimonial: Quote,
  pricing: CreditCard,
  stat: BarChart3,
  faq: BadgeHelp,
  step: Footprints,
  team: Users,
  contact: MapPin,
  logos: Building2,
  gallery: GalleryHorizontal,
  form: TextCursorInput,
  footer: PanelBottom,
  custom: Wand2,
};

export function BlockIcon({ type, ...rest }: { type: BlockType } & LucideProps) {
  const Icon = MAP[type];
  return <Icon {...rest} />;
}
