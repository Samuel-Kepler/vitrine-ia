import { describe, expect, it } from "vitest";
import { createNode } from "@/lib/draft/tree";
import { blankProjectData, type ProjectData } from "./data";
import {
  createProject,
  deleteProject,
  duplicateProject,
  ensureIndex,
  FILE_FORMAT,
  INDEX_KEY,
  loadProject,
  parseProjectFile,
  projectFile,
  projectFileName,
  projectKey,
  renameProject,
  saveProject,
  sortedProjects,
  StorageFullError,
  switchProject,
  type KV,
} from "./projects";

function memory(limit = Infinity): KV & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      const size = [...map].reduce((n, [key, val]) => n + (key === k ? 0 : val.length), 0) + v.length;
      if (size > limit) throw Object.assign(new Error("quota"), { name: "QuotaExceededError" });
      map.set(k, v);
    },
    removeItem: (k) => void map.delete(k),
  };
}

function withHero(title: string): ProjectData {
  const d = blankProjectData();
  const hero = createNode("hero");
  hero.props.title = title;
  d.tree = [hero];
  d.pages = [{ ...d.pages[0], tree: [hero] }];
  d.brief = `briefing ${title}`;
  return d;
}

const t = (min: number) => new Date(Date.UTC(2026, 10, 19, 12, min));

describe("projetos no navegador", () => {
  it("primeira vez: o estado atual vira 'Meu projeto'; depois reaproveita o índice", () => {
    const kv = memory();
    const idx = ensureIndex(kv, withHero("Café"), t(0));
    expect(idx.list).toHaveLength(1);
    expect(idx.list[0].name).toBe("Meu projeto");
    expect(loadProject(kv, idx.currentId)!.brief).toBe("briefing Café");
    expect(ensureIndex(kv, withHero("Outro"), t(1))).toEqual(idx);
  });

  it("criar, trocar, salvar e reabrir mantém cada projeto separado", () => {
    const kv = memory();
    let idx = ensureIndex(kv, withHero("Café"), t(0));
    const first = idx.currentId;
    const r = createProject(kv, idx, "Pet shop", withHero("Pet"), t(1));
    idx = r.idx;
    expect(idx.currentId).toBe(r.id);

    idx = saveProject(kv, idx, r.id, withHero("Pet v2"), t(2));
    idx = switchProject(kv, idx, first);
    expect(idx.currentId).toBe(first);
    expect(loadProject(kv, first)!.brief).toBe("briefing Café");
    expect(loadProject(kv, r.id)!.brief).toBe("briefing Pet v2");
    expect(sortedProjects(idx).map((p) => p.name)).toEqual(["Pet shop", "Meu projeto"]);
  });

  it("renomear, duplicar e apagar (nunca o último)", () => {
    const kv = memory();
    let idx = ensureIndex(kv, withHero("Café"), t(0));
    const first = idx.currentId;
    idx = renameProject(kv, idx, first, "  Café Aurora  ");
    expect(idx.list[0].name).toBe("Café Aurora");
    expect(renameProject(kv, idx, first, "   ")).toEqual(idx);

    const dup = duplicateProject(kv, idx, first, t(1))!;
    expect(dup.idx.list.map((p) => p.name)).toContain("Café Aurora (cópia)");
    expect(loadProject(kv, dup.id)!.brief).toBe("briefing Café");

    idx = deleteProject(kv, dup.idx, dup.id);
    expect(idx.currentId).toBe(first);
    expect(kv.getItem(projectKey(dup.id))).toBeNull();
    expect(deleteProject(kv, idx, first)).toEqual(idx); // último: fica
  });

  it("armazenamento cheio vira erro com instrução", () => {
    const kv = memory(400);
    expect(() => ensureIndex(kv, withHero("x".repeat(2000)))).toThrow(StorageFullError);
  });

  it("índice corrompido é ignorado (recria)", () => {
    const kv = memory();
    kv.setItem(INDEX_KEY, "{lixo");
    expect(ensureIndex(kv, blankProjectData()).list).toHaveLength(1);
  });
});

describe("arquivo .json do projeto", () => {
  it("salva e abre de volta, sem settings (chave de API) nem biblioteca", () => {
    const data = withHero("Café");
    const text = projectFile("Café Aurora", { ...data, settings: { kind: "groq", apiKey: "gsk_segredo" } } as never);
    const json = JSON.parse(text);
    expect(json.format).toBe(FILE_FORMAT);
    const back = parseProjectFile(text);
    expect(back.name).toBe("Café Aurora");
    expect(back.data.brief).toBe("briefing Café");
    expect(back.data.tree[0].props.title).toBe("Café");
    expect(JSON.stringify(back.data)).not.toContain("gsk_segredo");
    expect("saved" in back.data).toBe(false);
  });

  it("projeto v1 (uma página só) é migrado", () => {
    const hero = createNode("hero");
    const text = JSON.stringify({ format: FILE_FORMAT, version: 1, name: "Antigo", data: { tree: [hero], brief: "b" } });
    const { data } = parseProjectFile(text);
    expect(data.pages).toHaveLength(1);
    expect(data.pages[0].tree[0].id).toBe(hero.id);
  });

  it.each([
    ["não é JSON", "oi", /JSON válido/],
    ["outro formato", JSON.stringify({ format: "x" }), /não é um projeto/],
    ["versão futura", JSON.stringify({ format: FILE_FORMAT, version: 99, data: {} }), /versão mais nova/],
    ["sem páginas", JSON.stringify({ format: FILE_FORMAT, version: 2, data: { tree: [], pages: [] } }), /faltam as páginas/],
  ])("recusa %s", (_, text, msg) => {
    expect(() => parseProjectFile(text)).toThrow(msg);
  });

  it("nome de arquivo seguro", () => {
    expect(projectFileName("Café Aurora!")).toBe("cafe-aurora.vitrine.json");
    expect(projectFileName("../../etc")).toBe("etc.vitrine.json");
    expect(projectFileName("")).toBe("projeto.vitrine.json");
  });
});
