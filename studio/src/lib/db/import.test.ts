import { describe, expect, it } from "vitest";
import { starterDraft } from "@/lib/draft/starter";
import { inferFromDraft } from "@/lib/infer/from-draft";
import { expandDb } from "@/lib/infer/expand";
import { toDbml, toSql } from "./codegen";
import { ensureAuthUsers, type ErModel } from "./model";
import { detectFormat, importSchema } from "./import";

/** Forma comparável: nomes no lugar de ids, sem posições. */
function shape(m: ErModel) {
  const name = new Map(m.tables.map((t) => [t.id, t.name]));
  return {
    tables: m.tables
      .map((t) => ({ name: t.name, columns: t.columns.map(({ id: _id, ...c }) => ({ pk: false, nullable: false, unique: false, ...c })) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    relations: m.relations.map((r) => `${name.get(r.from)} ${r.kind} ${name.get(r.to)} ${r.onDelete}`).sort(),
  };
}

function sample(): ErModel {
  const db = ensureAuthUsers(expandDb(inferFromDraft(starterDraft()).db));
  const id = (n: string) => db.tables.find((t) => t.name === n)?.id;
  const mk = (name: string, extra: ErModel["tables"][number]["columns"]) => {
    const t = { id: `t_${name}`, name, position: { x: 0, y: 0 }, columns: [{ id: `${name}_id`, name: "id", type: "uuid" as const, pk: true, default: "uuid" }, ...extra] };
    db.tables.push(t);
    return t;
  };
  const a = mk("profiles", [{ id: "p1", name: "bio", type: "text", nullable: true }]);
  const b = mk("tags", [{ id: "g1", name: "label", type: "varchar", unique: true }, { id: "g2", name: "weight", type: "decimal", default: "1.5" }]);
  // cobre 1-1, set null e n-n além do que a inferência gera
  db.relations.push({ id: "x1", from: a.id, to: id("users")!, kind: "1-1", onDelete: "cascade" });
  db.relations.push({ id: "x2", from: b.id, to: id("users")!, kind: "n-1", onDelete: "set null" });
  db.relations.push({ id: "x3", from: a.id, to: b.id, kind: "n-n", onDelete: "cascade" });
  return db;
}

describe("importSchema: ida e volta", () => {
  it.each([
    ["DBML", (m: ErModel) => toDbml(m)],
    ["SQL Postgres", (m: ErModel) => toSql(m, "postgres")],
    ["SQL MySQL", (m: ErModel) => toSql(m, "mysql")],
  ])("%s exportado volta igual", (_, gen) => {
    const db = sample();
    const r = importSchema(gen(db));
    expect(r.warnings).toEqual([]);
    expect(shape(r.model)).toEqual(shape(db));
  });
});

describe("importSchema: SQL escrito à mão", () => {
  const SQL = `
    -- loja
    CREATE TABLE IF NOT EXISTS public.customers (
      id serial PRIMARY KEY,
      email varchar(120) NOT NULL UNIQUE,
      active boolean DEFAULT true,
      created_at timestamp with time zone DEFAULT now()
    );
    CREATE TABLE orders (
      id bigint GENERATED ALWAYS AS IDENTITY,
      buyer integer REFERENCES customers(id) ON DELETE CASCADE,
      total numeric(10,2) NOT NULL DEFAULT 0,
      status text DEFAULT 'novo'::text,
      tags text[],
      CONSTRAINT orders_pk PRIMARY KEY (id)
    );
    CREATE INDEX orders_buyer_idx ON orders (buyer);`;

  it("lê tipos, defaults e a FK inline, avisando o que muda", () => {
    expect(detectFormat(SQL)).toBe("sql");
    const { model, warnings } = importSchema(SQL);
    const orders = model.tables.find((t) => t.name === "orders")!;
    const customers = model.tables.find((t) => t.name === "customers")!;
    expect(customers.columns.find((c) => c.name === "id")).toMatchObject({ type: "int", pk: true, default: "autoincrement" });
    expect(customers.columns.find((c) => c.name === "email")).toMatchObject({ type: "varchar", unique: true });
    expect(customers.columns.find((c) => c.name === "active")).toMatchObject({ type: "boolean", nullable: true, default: "true" });
    expect(customers.columns.find((c) => c.name === "created_at")).toMatchObject({ type: "timestamp", default: "now" });
    expect(orders.columns.map((c) => c.name)).toEqual(["id", "total", "status", "tags"]);
    expect(orders.columns.find((c) => c.name === "id")).toMatchObject({ type: "bigint", pk: true, default: "autoincrement" });
    expect(orders.columns.find((c) => c.name === "status")).toMatchObject({ default: "novo" });
    expect(model.relations).toEqual([expect.objectContaining({ from: orders.id, to: customers.id, kind: "n-1", onDelete: "cascade" })]);
    expect(warnings.some((w) => w.includes("buyer vira customer_id"))).toBe(true);
    expect(warnings.some((w) => w.includes('"text[]"'))).toBe(true);
  });

  it("formato desconhecido dá erro amigável", () => {
    expect(() => importSchema("olá")).toThrow(/Não reconheci/);
  });
});

describe("importSchema: DBML do dbdiagram", () => {
  it("lê ref inline, Ref com <, indexes [pk] e ignora Note/Enum", () => {
    const { model, warnings } = importSchema(`
      Enum status { ativo inativo }
      Table users as U {
        id uuid [pk, default: \`gen_random_uuid()\`]
        name varchar [note: 'nome, completo']
        Note: 'clientes'
      }
      Table posts {
        id int [pk, increment]
        author_id uuid [not null, ref: > users.id]
        state status
      }
      Table likes {
        user_id uuid
        post_id int
        indexes { (user_id, post_id) [pk] }
      }
      Ref: users.id < likes.user_id
      Ref: likes.post_id > posts.id [delete: cascade]
    `);
    const t = (n: string) => model.tables.find((x) => x.name === n);
    expect(t("likes")).toBeUndefined(); // tabela de junção vira n-n
    expect(model.relations.map((r) => r.kind).sort()).toEqual(["n-1", "n-n"]);
    expect(t("users")!.columns[0]).toMatchObject({ pk: true, default: "uuid" });
    expect(t("posts")!.columns.map((c) => c.name)).toEqual(["id", "state"]);
    expect(warnings.some((w) => /Enums/.test(w))).toBe(true);
    expect(warnings.some((w) => /author_id vira user_id/.test(w))).toBe(true);
  });
});
