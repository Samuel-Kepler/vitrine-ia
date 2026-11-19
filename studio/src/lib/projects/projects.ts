// Vários projetos no mesmo navegador + salvar/abrir como arquivo .json.
//
// O estado de trabalho continua em "vitrine-studio:v1" (persist do store): é o
// projeto aberto. Cada projeto tem uma cópia em "vitrine-studio:project:<id>",
// atualizada pelo salvamento automático; trocar de projeto grava a cópia do
// atual e carrega a do outro.
import { blankProjectData, PROJECT_KEYS, STUDIO_VERSION, type ProjectData } from "./data";
import { migrateStudio } from "@/lib/draft/pages";

/** O que o módulo precisa do localStorage (injetável nos testes). */
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectIndex {
  currentId: string;
  list: ProjectMeta[];
}

export const INDEX_KEY = "vitrine-studio:projects";
export const projectKey = (id: string) => `vitrine-studio:project:${id}`;
export const FILE_FORMAT = "vitrine-studio-project";
/** Arquivo grande demais provavelmente não é um projeto (ou vai estourar o localStorage). */
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export class StorageFullError extends Error {
  constructor() {
    super("O armazenamento do navegador está cheio. Salve este projeto em arquivo (.json) e apague projetos antigos.");
  }
}

function write(kv: KV, key: string, value: string) {
  try {
    kv.setItem(key, value);
  } catch (e) {
    // QuotaExceededError (nome varia entre navegadores)
    if (e instanceof Error && /quota|exceeded|full/i.test(`${e.name} ${e.message}`)) throw new StorageFullError();
    throw e;
  }
}

function newProjectId(): string {
  const buf = new Uint8Array(6);
  globalThis.crypto.getRandomValues(buf);
  return "prj_" + Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Só as chaves de projeto, com os valores padrão no que faltar. */
export function normalizeData(raw: unknown, version = STUDIO_VERSION): ProjectData {
  const migrated = migrateStudio(raw, version);
  const base = blankProjectData();
  const out = { ...base } as Record<string, unknown>;
  for (const k of PROJECT_KEYS) if (migrated[k] !== undefined) out[k] = migrated[k];
  const data = out as unknown as ProjectData;
  if (!Array.isArray(data.tree) || !Array.isArray(data.pages) || !data.pages.length) throw new Error("Projeto inválido: faltam as páginas.");
  if (!data.pages.some((p) => p.id === data.pageId)) data.pageId = data.pages[0].id;
  return data;
}

export function readIndex(kv: KV): ProjectIndex | null {
  try {
    const raw = kv.getItem(INDEX_KEY);
    if (!raw) return null;
    const idx = JSON.parse(raw) as ProjectIndex;
    if (!Array.isArray(idx.list) || !idx.list.length || typeof idx.currentId !== "string") return null;
    if (!idx.list.some((p) => p.id === idx.currentId)) idx.currentId = idx.list[0].id;
    return idx;
  } catch {
    return null;
  }
}

function writeIndex(kv: KV, idx: ProjectIndex) {
  write(kv, INDEX_KEY, JSON.stringify(idx));
}

export function saveProject(kv: KV, idx: ProjectIndex, id: string, data: ProjectData, now = new Date()): ProjectIndex {
  write(kv, projectKey(id), JSON.stringify({ version: STUDIO_VERSION, data }));
  const next = { ...idx, list: idx.list.map((p) => (p.id === id ? { ...p, updatedAt: now.toISOString() } : p)) };
  writeIndex(kv, next);
  return next;
}

export function loadProject(kv: KV, id: string): ProjectData | null {
  try {
    const raw = kv.getItem(projectKey(id));
    if (!raw) return null;
    const { version, data } = JSON.parse(raw) as { version?: number; data: unknown };
    return normalizeData(data, version ?? STUDIO_VERSION);
  } catch {
    return null;
  }
}

/** Primeira vez: o que já estava no Studio vira o projeto "Meu projeto". */
export function ensureIndex(kv: KV, current: ProjectData, now = new Date()): ProjectIndex {
  const existing = readIndex(kv);
  if (existing) return existing;
  const id = newProjectId();
  const t = now.toISOString();
  const idx: ProjectIndex = { currentId: id, list: [{ id, name: "Meu projeto", createdAt: t, updatedAt: t }] };
  return saveProject(kv, idx, id, current, now);
}

export function createProject(kv: KV, idx: ProjectIndex, name: string, data: ProjectData, now = new Date()): { idx: ProjectIndex; id: string } {
  const id = newProjectId();
  const t = now.toISOString();
  const meta: ProjectMeta = { id, name: name.trim() || "Projeto sem nome", createdAt: t, updatedAt: t };
  const withNew = { currentId: id, list: [meta, ...idx.list] };
  return { idx: saveProject(kv, withNew, id, data, now), id };
}

export function switchProject(kv: KV, idx: ProjectIndex, id: string): ProjectIndex {
  if (!idx.list.some((p) => p.id === id)) return idx;
  const next = { ...idx, currentId: id };
  writeIndex(kv, next);
  return next;
}

export function renameProject(kv: KV, idx: ProjectIndex, id: string, name: string): ProjectIndex {
  const clean = name.trim();
  if (!clean) return idx;
  const next = { ...idx, list: idx.list.map((p) => (p.id === id ? { ...p, name: clean } : p)) };
  writeIndex(kv, next);
  return next;
}

/** Apaga um projeto. Não apaga o último; se for o aberto, o próximo vira o atual. */
export function deleteProject(kv: KV, idx: ProjectIndex, id: string): ProjectIndex {
  if (idx.list.length < 2 || !idx.list.some((p) => p.id === id)) return idx;
  const list = idx.list.filter((p) => p.id !== id);
  const next = { currentId: idx.currentId === id ? list[0].id : idx.currentId, list };
  kv.removeItem(projectKey(id));
  writeIndex(kv, next);
  return next;
}

export function duplicateProject(kv: KV, idx: ProjectIndex, id: string, now = new Date()): { idx: ProjectIndex; id: string } | null {
  const src = idx.list.find((p) => p.id === id);
  const data = src && loadProject(kv, id);
  if (!src || !data) return null;
  return createProject(kv, idx, `${src.name} (cópia)`, structuredClone(data), now);
}

/** Lista para o menu: mais recente primeiro. */
export function sortedProjects(idx: ProjectIndex): ProjectMeta[] {
  return [...idx.list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// ---------------- arquivo .json ----------------

export function projectFile(name: string, data: ProjectData, now = new Date()): string {
  return JSON.stringify({ format: FILE_FORMAT, version: STUDIO_VERSION, name, exportedAt: now.toISOString(), data }, null, 2);
}

export function parseProjectFile(text: string): { name: string; data: ProjectData } {
  if (text.length > MAX_FILE_BYTES) throw new Error("Arquivo grande demais para um projeto do Vitrine Studio.");
  let json: { format?: unknown; version?: unknown; name?: unknown; data?: unknown };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("O arquivo não é um JSON válido.");
  }
  if (json?.format !== FILE_FORMAT) throw new Error("Este arquivo não é um projeto do Vitrine Studio.");
  const version = typeof json.version === "number" ? json.version : STUDIO_VERSION;
  if (version > STUDIO_VERSION) throw new Error("Projeto salvo por uma versão mais nova do Studio.");
  const name = typeof json.name === "string" && json.name.trim() ? json.name.trim().slice(0, 80) : "Projeto importado";
  return { name, data: normalizeData(json.data, version) };
}

/** Nome de arquivo seguro: "Café Aurora" -> "cafe-aurora.vitrine.json". */
export function projectFileName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "projeto"}.vitrine.json`;
}
