// Desenha as formas no <canvas>. Caneta com perfect-freehand (~2 KB, sem
// dependências): traço suave, com espessura variando como caneta de verdade.
import { getStroke } from "perfect-freehand";
import { bbox, handles, type Shape } from "./shapes";

function penPath(points: [number, number][], size: number): Path2D {
  const outline = getStroke(points, { size, thinning: 0.5, smoothing: 0.6, streamline: 0.5, simulatePressure: true });
  const path = new Path2D();
  if (!outline.length) return path;
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i - 1];
    const [x1, y1] = outline[i];
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.closePath();
  return path;
}

function arrowHead(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width: number) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const len = 12 + width * 2;
  c.beginPath();
  c.moveTo(x2, y2);
  c.lineTo(x2 - len * Math.cos(a - Math.PI / 7), y2 - len * Math.sin(a - Math.PI / 7));
  c.moveTo(x2, y2);
  c.lineTo(x2 - len * Math.cos(a + Math.PI / 7), y2 - len * Math.sin(a + Math.PI / 7));
  c.stroke();
}

export function drawShape(c: CanvasRenderingContext2D, s: Shape) {
  c.save();
  c.strokeStyle = s.color;
  c.fillStyle = s.color;
  c.lineWidth = s.width;
  c.lineCap = "round";
  c.lineJoin = "round";
  switch (s.kind) {
    case "pen":
      c.fill(penPath(s.points, s.width * 2.2));
      break;
    case "rect":
      c.strokeRect(s.x, s.y, s.w, s.h);
      break;
    case "ellipse": {
      c.beginPath();
      c.ellipse(s.x + s.w / 2, s.y + s.h / 2, Math.abs(s.w / 2), Math.abs(s.h / 2), 0, 0, Math.PI * 2);
      c.stroke();
      break;
    }
    case "line":
    case "arrow":
      c.beginPath();
      c.moveTo(s.x1, s.y1);
      c.lineTo(s.x2, s.y2);
      c.stroke();
      if (s.kind === "arrow") arrowHead(c, s.x1, s.y1, s.x2, s.y2, s.width);
      break;
    case "text":
      c.font = `600 ${s.size}px ui-sans-serif, system-ui, sans-serif`;
      c.textBaseline = "top";
      c.fillText(s.text, s.x, s.y);
      break;
  }
  c.restore();
}

/** Contorno tracejado e alças da forma selecionada. */
export function drawSelection(c: CanvasRenderingContext2D, s: Shape) {
  const b = bbox(s);
  c.save();
  c.strokeStyle = "#1570ef";
  c.lineWidth = 1.5;
  c.setLineDash([6, 4]);
  if (s.kind !== "line" && s.kind !== "arrow") c.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
  c.setLineDash([]);
  c.fillStyle = "#fff";
  for (const p of handles(s)) {
    c.fillRect(p.x - 5, p.y - 5, 10, 10);
    c.strokeRect(p.x - 5, p.y - 5, 10, 10);
  }
  c.restore();
}

/**
 * Fundo branco + imagem de fundo (desenho antigo) + formas + forma em
 * andamento + seleção. Sem seleção = a imagem que vai para a IA.
 */
export function render(c: CanvasRenderingContext2D, w: number, h: number, shapes: Shape[], opts: { background?: CanvasImageSource | null; extra?: Shape; selected?: Shape } = {}) {
  c.fillStyle = "#fff";
  c.fillRect(0, 0, w, h);
  if (opts.background) c.drawImage(opts.background, 0, 0, w, h);
  for (const s of shapes) drawShape(c, s);
  if (opts.extra) drawShape(c, opts.extra);
  if (opts.selected) drawSelection(c, opts.selected);
}
