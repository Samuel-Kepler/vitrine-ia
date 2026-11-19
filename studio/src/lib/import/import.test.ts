import { describe, expect, it } from "vitest";
import type { PageOutline } from "./outline";

const outline = (file: string, h1: string): PageOutline => ({
  file,
  title: h1,
  brand: "Café Aurora",
  nav: [],
  items: [
    { kind: "h1", text: h1 },
    { kind: "p", text: "Texto original" },
  ],
  footer: { text: "", links: [] },
});

describe("POST /api/import", () => {
  it("mock: converte sem IA e avisa", async () => {
    const { POST } = await import("@/app/api/import/route");
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ outlines: [outline("index.html", "Bem-vindo"), outline("sobre.html", "Sobre")], settings: { kind: "mock" } }) }),
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ provider: "mock", fallback: true });
    expect(json.pages.map((p: { name: string }) => p.name)).toEqual(["Início", "Sobre"]);
    expect(json.pages[0].tree[1].props.title).toBe("Bem-vindo");
  });

  it("recusa corpo inválido e páginas demais", async () => {
    const { POST } = await import("@/app/api/import/route");
    const bad = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ outlines: [] }) }));
    expect(bad.status).toBe(400);
    const many = Array.from({ length: 7 }, (_, i) => outline(`p${i}.html`, `P${i}`));
    const tooMany = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ outlines: many, settings: { kind: "mock" } }) }));
    expect(tooMany.status).toBe(400);
  });
});
