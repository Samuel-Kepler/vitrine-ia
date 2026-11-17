// Modelo do canvas de banco (diagrama ER). Chaves estrangeiras não são
// colunas guardadas: derivam das relações (ver fkColumns).
import { z } from "zod";

export const COL_TYPES = ["uuid", "text", "varchar", "int", "bigint", "decimal", "boolean", "timestamp", "date", "json"] as const;
export type ColType = (typeof COL_TYPES)[number];

export const REL_KINDS = ["n-1", "1-1", "n-n"] as const;
export type RelKind = (typeof REL_KINDS)[number];
export const ON_DELETE = ["cascade", "set null", "restrict"] as const;
export type OnDelete = (typeof ON_DELETE)[number];

export interface Column {
  id: string;
  name: string;
  type: ColType;
  pk?: boolean;
  nullable?: boolean;
  unique?: boolean;
  /** "now" | "uuid" | "autoincrement" | literal */
  default?: string;
}

export interface Table {
  id: string;
  name: string;
  columns: Column[];
  position: { x: number; y: number };
}

/** `from` (filha) aponta para `to` (pai). n-n gera tabela de junção. */
export interface Relation {
  id: string;
  from: string;
  to: string;
  kind: RelKind;
  onDelete: OnDelete;
}

export interface ErModel {
  tables: Table[];
  relations: Relation[];
}

export const REL_LABELS: Record<RelKind, string> = { "n-1": "muitos → um", "1-1": "um → um", "n-n": "muitos ↔ muitos" };

export const ErModelSchema = z.object({
  tables: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        name: z.string().max(64),
        columns: z
          .array(
            z.object({
              id: z.string(),
              name: z.string().max(64),
              type: z.enum(COL_TYPES),
              pk: z.boolean().optional(),
              nullable: z.boolean().optional(),
              unique: z.boolean().optional(),
              default: z.string().max(200).optional(),
            }),
          )
          .max(100),
        position: z.object({ x: z.number(), y: z.number() }),
      }),
    )
    .max(100),
  relations: z
    .array(z.object({ id: z.string(), from: z.string(), to: z.string(), kind: z.enum(REL_KINDS), onDelete: z.enum(ON_DELETE) }))
    .max(300),
});

export function singular(name: string): string {
  if (/ies$/.test(name)) return name.replace(/ies$/, "y");
  if (/(ses|xes|zes|ches|shes)$/.test(name)) return name.replace(/es$/, "");
  if (/s$/.test(name) && !/ss$/.test(name)) return name.slice(0, -1);
  return name;
}

export function pkOf(t: Table): Column | undefined {
  return t.columns.find((c) => c.pk);
}

export interface FkColumn {
  table: Table;
  name: string;
  type: ColType;
  nullable: boolean;
  unique: boolean;
  ref: Table;
  refColumn: string;
  onDelete: OnDelete;
  relation: Relation;
}

/** Colunas FK derivadas das relações n-1 e 1-1. */
export function fkColumns(model: ErModel): FkColumn[] {
  const byId = new Map(model.tables.map((t) => [t.id, t]));
  const out: FkColumn[] = [];
  for (const r of model.relations) {
    if (r.kind === "n-n") continue;
    const child = byId.get(r.from);
    const parent = byId.get(r.to);
    if (!child || !parent) continue;
    const pk = pkOf(parent);
    out.push({
      table: child,
      name: `${singular(parent.name)}_id`,
      type: pk?.type ?? "uuid",
      nullable: r.onDelete === "set null",
      unique: r.kind === "1-1",
      ref: parent,
      refColumn: pk?.name ?? "id",
      onDelete: r.onDelete,
      relation: r,
    });
  }
  return out;
}

export interface JoinTable {
  name: string;
  a: Table;
  b: Table;
  relation: Relation;
}

export function joinTables(model: ErModel): JoinTable[] {
  const byId = new Map(model.tables.map((t) => [t.id, t]));
  return model.relations
    .filter((r) => r.kind === "n-n" && byId.has(r.from) && byId.has(r.to))
    .map((r) => {
      const a = byId.get(r.from)!;
      const b = byId.get(r.to)!;
      return { name: `${a.name}_${b.name}`, a, b, relation: r };
    });
}

export function snake(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "tabela"
  );
}

export function pascal(s: string): string {
  return snake(s)
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

export function camel(s: string): string {
  const p = pascal(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
}
