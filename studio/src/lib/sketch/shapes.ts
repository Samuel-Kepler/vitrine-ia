// Quadro de desenho do Bloco livre como objetos (não pixels): cada forma pode
// ser selecionada, movida, redimensionada e apagada. Puro: geometria testável;
// o desenho no <canvas> fica em render.ts.

export type ShapeKind = "pen" | "rect" | "ellipse" | "line" | "arrow" | "text";

export interface BaseShape {
  id: string;
  kind: ShapeKind;
  color: string;
  width: number;
}
export interface PenShape extends BaseShape {
  kind: "pen";
  points: [number, number][];
}
export interface BoxShape extends BaseShape {
  kind: "rect" | "ellipse";
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface LineShape extends BaseShape {
  kind: "line" | "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface TextShape extends BaseShape {
  kind: "text";
  x: number;
  y: number;
  text: string;
  size: number;
}
export type Shape = PenShape | BoxShape | LineShape | TextShape;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const COLORS = ["#111111", "#d92d20", "#1570ef", "#079455", "#dc6803"] as const;
export const WIDTHS = [3, 6, 10] as const;

let seq = 0;
export const shapeId = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Largura aproximada do texto (sem medir no canvas): suficiente para seleção. */
export const textWidth = (t: TextShape) => Math.max(t.size * 0.6 * t.text.length, t.size);

/** Caixa que envolve a forma (normalizada: w e h positivos). */
export function bbox(s: Shape): Box {
  switch (s.kind) {
    case "pen": {
      const xs = s.points.map((p) => p[0]);
      const ys = s.points.map((p) => p[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    case "rect":
    case "ellipse":
      return { x: Math.min(s.x, s.x + s.w), y: Math.min(s.y, s.y + s.h), w: Math.abs(s.w), h: Math.abs(s.h) };
    case "line":
    case "arrow":
      return { x: Math.min(s.x1, s.x2), y: Math.min(s.y1, s.y2), w: Math.abs(s.x2 - s.x1), h: Math.abs(s.y2 - s.y1) };
    case "text":
      return { x: s.x, y: s.y, w: textWidth(s), h: s.size * 1.25 };
  }
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** A forma está sob o ponto? (tolerância em px do quadro) */
export function hit(s: Shape, x: number, y: number, tol = 8): boolean {
  switch (s.kind) {
    case "line":
    case "arrow":
      return distToSegment(x, y, s.x1, s.y1, s.x2, s.y2) <= tol + s.width / 2;
    case "pen":
      return s.points.some((p, i) => i > 0 && distToSegment(x, y, s.points[i - 1][0], s.points[i - 1][1], p[0], p[1]) <= tol + s.width / 2) || (s.points.length === 1 && Math.hypot(x - s.points[0][0], y - s.points[0][1]) <= tol);
    default: {
      const b = bbox(s);
      return x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol;
    }
  }
}

/** Forma de cima para baixo (a última desenhada fica por cima). */
export function topHit(shapes: Shape[], x: number, y: number): Shape | undefined {
  for (let i = shapes.length - 1; i >= 0; i--) if (hit(shapes[i], x, y)) return shapes[i];
  return undefined;
}

export function move(s: Shape, dx: number, dy: number): Shape {
  switch (s.kind) {
    case "pen":
      return { ...s, points: s.points.map(([x, y]) => [x + dx, y + dy] as [number, number]) };
    case "line":
    case "arrow":
      return { ...s, x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy };
    default:
      return { ...s, x: s.x + dx, y: s.y + dy };
  }
}

/** Alças de redimensionar: cantos da caixa; linha e seta usam as pontas. */
export type Handle = "nw" | "ne" | "sw" | "se" | "p1" | "p2";

export function handles(s: Shape): { h: Handle; x: number; y: number }[] {
  if (s.kind === "line" || s.kind === "arrow") return [{ h: "p1", x: s.x1, y: s.y1 }, { h: "p2", x: s.x2, y: s.y2 }];
  const b = bbox(s);
  return [
    { h: "nw", x: b.x, y: b.y },
    { h: "ne", x: b.x + b.w, y: b.y },
    { h: "sw", x: b.x, y: b.y + b.h },
    { h: "se", x: b.x + b.w, y: b.y + b.h },
  ];
}

export function handleAt(s: Shape, x: number, y: number, tol = 9): Handle | undefined {
  return handles(s).find((p) => Math.abs(p.x - x) <= tol && Math.abs(p.y - y) <= tol)?.h;
}

const MIN = 8;

/**
 * Redimensiona arrastando uma alça até (x, y), a partir da forma original
 * (do começo do arrasto, para não acumular erro).
 */
export function resize(orig: Shape, h: Handle, x: number, y: number): Shape {
  if (orig.kind === "line" || orig.kind === "arrow") {
    return h === "p1" ? { ...orig, x1: x, y1: y } : h === "p2" ? { ...orig, x2: x, y2: y } : orig;
  }
  const b = bbox(orig);
  const left = h === "nw" || h === "sw" ? Math.min(x, b.x + b.w - MIN) : b.x;
  const right = h === "ne" || h === "se" ? Math.max(x, b.x + MIN) : b.x + b.w;
  const top = h === "nw" || h === "ne" ? Math.min(y, b.y + b.h - MIN) : b.y;
  const bottom = h === "sw" || h === "se" ? Math.max(y, b.y + MIN) : b.y + b.h;
  const nb = { x: left, y: top, w: right - left, h: bottom - top };
  switch (orig.kind) {
    case "rect":
    case "ellipse":
      return { ...orig, ...nb };
    case "text":
      // Texto cresce pela altura: muda o tamanho da fonte.
      return { ...orig, x: nb.x, y: nb.y, size: Math.max(12, Math.round(nb.h / 1.25)) };
    case "pen": {
      const sx = b.w ? nb.w / b.w : 1;
      const sy = b.h ? nb.h / b.h : 1;
      return { ...orig, points: orig.points.map(([px, py]) => [nb.x + (px - b.x) * sx, nb.y + (py - b.y) * sy] as [number, number]) };
    }
  }
}

/** Formas criadas por arrasto: a partir do ponto inicial e do atual. */
export function fromDrag(kind: Exclude<ShapeKind, "pen" | "text">, x0: number, y0: number, x: number, y: number, color: string, width: number): Shape {
  const id = shapeId();
  if (kind === "line" || kind === "arrow") return { id, kind, color, width, x1: x0, y1: y0, x2: x, y2: y };
  return { id, kind, color, width, x: x0, y: y0, w: x - x0, h: y - y0 };
}

/** Forma pequena demais (clique sem arrastar) é descartada. */
export function tooSmall(s: Shape): boolean {
  const b = bbox(s);
  return s.kind !== "text" && s.kind !== "pen" && Math.max(b.w, b.h) < 6;
}
