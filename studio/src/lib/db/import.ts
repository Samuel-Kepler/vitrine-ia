// Importa um schema existente (DBML ou SQL CREATE TABLE) para o diagrama ER.
// Leitor próprio e enxuto (sem @dbml/core, que pesa alguns MB): cobre tabelas,
// colunas, PK (simples e composta), NOT NULL, UNIQUE, DEFAULT, auto-incremento,
// chaves estrangeiras (inline, FOREIGN KEY, ALTER TABLE, Ref:) e tabelas de junção.
import { COL_TYPES, singular, snake, type ColType, type Column, type ErModel, type OnDelete, type RelKind, type Table } from "./model";

export type SchemaFormat = "dbml" | "sql";

export interface ImportResult {
  model: ErModel;
  format: SchemaFormat;
  warnings: string[];
}

interface RawCol {
  name: string;
  type: string;
  pk: boolean;
  notNull: boolean;
  unique: boolean;
  auto: boolean;
  default?: string;
}
interface RawTable {
  name: string;
  cols: RawCol[];
  pk: string[];
}
interface RawRef {
  from: string;
  fromCol: string;
  to: string;
  toCol: string;
  /** ">" n-1, "-" 1-1, "<>" n-n */
  kind: ">" | "-" | "<>";
  onDelete?: string;
}
interface Raw {
  tables: RawTable[];
  refs: RawRef[];
  warnings: string[];
}

// ---------------- utilidades ----------------

/** Tira aspas/crases/colchetes e o prefixo de schema (public.users -> users). */
function ident(s: string): string {
  const parts = s.trim().split(".");
  return parts[parts.length - 1].replace(/^["`[]|["`\]]$/g, "");
}

/** Divide por vírgula fora de parênteses, aspas e crases. */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let cur = "";
  for (const ch of s) {
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === "'" || ch === '"' || ch === "`") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

function stripComments(s: string, line: RegExp): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(line, "");
}

const TYPE_RULES: [RegExp, ColType][] = [
  [/^(uuid|uniqueidentifier|char\(36\))$/, "uuid"],
  [/^(bigint|int8|bigserial|serial8)/, "bigint"],
  [/^(tinyint\(1\)|bool|boolean|bit)$/, "boolean"],
  [/^(int|integer|int4|int2|smallint|mediumint|tinyint|serial|serial4|smallserial)/, "int"],
  [/^(numeric|decimal|real|float|double|money)/, "decimal"],
  [/^(timestamp|timestamptz|datetime)/, "timestamp"],
  [/^date$/, "date"],
  [/^(json|jsonb)$/, "json"],
  [/^(varchar|character varying|nvarchar|char|character|nchar|citext)/, "varchar"],
  [/^(text|string|tinytext|mediumtext|longtext|clob)$/, "text"],
];

function mapType(raw: string, where: string, warnings: string[]): ColType {
  const t = raw.toLowerCase().replace(/\s+/g, " ").trim();
  for (const [re, ct] of TYPE_RULES) if (re.test(t)) return ct;
  if ((COL_TYPES as readonly string[]).includes(t)) return t as ColType;
  warnings.push(`${where}: tipo "${raw}" não suportado, virou text.`);
  return "text";
}

function mapDefault(raw?: string): string | undefined {
  if (raw == null) return undefined;
  let v = raw.trim().replace(/^`|`$/g, "");
  while (/^\(.*\)$/.test(v)) v = v.slice(1, -1).trim();
  if (/^(now\(\)|current_timestamp(\(\d*\))?|localtimestamp|getdate\(\))$/i.test(v)) return "now";
  if (/^(gen_random_uuid\(\)|uuid_generate_v4\(\)|uuid\(\)|newid\(\))$/i.test(v)) return "uuid";
  if (/^null$/i.test(v)) return undefined;
  const q = v.match(/^'((?:[^']|'')*)'(::[\w ]+)?$/) ?? v.match(/^"(.*)"$/);
  if (q) return q[1].replace(/''/g, "'");
  return v.replace(/::[\w ]+$/, "");
}

function mapOnDelete(raw?: string): OnDelete | undefined {
  const v = raw?.toLowerCase().replace(/\s+/g, " ").trim();
  if (!v) return undefined;
  if (v === "cascade") return "cascade";
  if (v === "set null") return "set null";
  return "restrict"; // restrict, no action, set default
}

// ---------------- DBML ----------------

function parseDbml(src: string): Raw {
  const text = stripComments(src, /\/\/.*$/gm);
  const raw: Raw = { tables: [], refs: [], warnings: [] };

  const pushRef = (expr: string, settings?: string) => {
    const m = expr.match(/^\s*([\w".]+)\.([\w"]+)\s*(<>|>|<|-)\s*([\w".]+)\.([\w"]+)\s*$/);
    if (!m) {
      raw.warnings.push(`Ref ignorada: "${expr.trim()}".`);
      return;
    }
    const del = settings?.match(/delete\s*:\s*([\w ]+?)\s*(,|$)/i)?.[1];
    let [, a, ac, op, b, bc] = m;
    if (op === "<") [a, ac, b, bc, op] = [b, bc, a, ac, ">"];
    raw.refs.push({ from: ident(a), fromCol: ident(ac), to: ident(b), toCol: ident(bc), kind: op as RawRef["kind"], onDelete: del });
  };

  // Ref: a.b > c.d [delete: cascade]   |   Ref nome { a.b > c.d }
  for (const m of text.matchAll(/^\s*Ref\b[^:{\n]*:\s*([^\n[]+?)\s*(?:\[([^\]]*)\])?\s*$/gim)) pushRef(m[1], m[2]);
  for (const m of text.matchAll(/^\s*Ref\b[^{:\n]*\{([^}]*)\}/gim)) {
    for (const line of m[1].split("\n").filter((l) => l.trim())) {
      const s = line.match(/^(.*?)(?:\[([^\]]*)\])?\s*$/)!;
      pushRef(s[1], s[2]);
    }
  }

  // Table nome [settings] { ... } — com blocos internos (indexes { }) de um nível.
  const tableRe = /^\s*Table\s+([\w".]+)(?:\s+as\s+\w+)?\s*(?:\[[^\]]*\])?\s*\{((?:[^{}]|\{[^{}]*\})*)\}/gim;
  for (const m of text.matchAll(tableRe)) {
    const t: RawTable = { name: ident(m[1]), cols: [], pk: [] };
    let body = m[2];
    // indexes { (a, b) [pk] }
    body = body.replace(/indexes\s*\{([^}]*)\}/i, (_, idx: string) => {
      for (const line of idx.split("\n")) {
        const pk = line.match(/^\s*\(([^)]*)\)\s*\[[^\]]*\bpk\b[^\]]*\]/i);
        if (pk) t.pk = pk[1].split(",").map(ident);
      }
      return "";
    });
    for (const line of body.split("\n")) {
      const l = line.trim();
      if (!l || /^note\s*:/i.test(l)) continue;
      const c = l.match(/^([\w"]+)\s+("[^"]+"|[\w.]+(?:\s*\([^)]*\))?(?:\[\])?)\s*(?:\[(.*)\])?\s*$/);
      if (!c) {
        raw.warnings.push(`${t.name}: linha ignorada "${l}".`);
        continue;
      }
      const col: RawCol = { name: ident(c[1]), type: ident(c[2]), pk: false, notNull: false, unique: false, auto: false };
      for (const a of splitTop(c[3] ?? "")) {
        const low = a.toLowerCase();
        if (low === "pk" || low === "primary key") col.pk = true;
        else if (low === "not null") col.notNull = true;
        else if (low === "unique") col.unique = true;
        else if (low === "increment") col.auto = true;
        else if (low.startsWith("default:")) col.default = a.slice(a.indexOf(":") + 1).trim();
        else if (low.startsWith("ref:")) pushRef(`${t.name}.${col.name} ${a.slice(a.indexOf(":") + 1).trim()}`);
      }
      t.cols.push(col);
    }
    raw.tables.push(t);
  }
  if (/^\s*Enum\s+/im.test(text)) raw.warnings.push("Enums do DBML não são suportados: colunas desse tipo viram text.");
  return raw;
}

// ---------------- SQL ----------------

const STOP = /^(not|null|primary|unique|default|references|constraint|generated|auto_increment|autoincrement|identity|check|collate|on|comment)$/i;

function parseSqlColumn(item: string, table: RawTable, raw: Raw) {
  const tokens = item.match(/"[^"]+"|`[^`]+`|\[[^\]]+\]|\S+/g) ?? [];
  const name = ident(tokens[0] ?? "");
  const typeParts: string[] = [];
  let i = 1;
  for (; i < tokens.length && !STOP.test(tokens[i]); i++) typeParts.push(tokens[i]);
  const rest = tokens.slice(i).join(" ");
  const type = typeParts.join(" ").replace(/\s*\(\s*/g, "(").replace(/\s*\)/g, ")");
  const col: RawCol = {
    name,
    type,
    pk: /\bprimary\s+key\b/i.test(rest),
    notNull: /\bnot\s+null\b/i.test(rest),
    unique: /\bunique\b/i.test(rest),
    auto: /\b(auto_increment|autoincrement|identity)\b/i.test(rest) || /^(small|big)?serial\d?$/i.test(type),
  };
  const def = rest.match(/\bdefault\s+('(?:[^']|'')*'(?:::[\w ]+)?|\((?:[^()]|\([^()]*\))*\)|[^\s,]+)/i);
  if (def) col.default = def[1];
  const ref = rest.match(/\breferences\s+([\w".`[\]]+)\s*(?:\(\s*([\w"`[\]]+)\s*\))?(?:.*?\bon\s+delete\s+(set\s+null|cascade|restrict|no\s+action|set\s+default))?/i);
  if (ref) raw.refs.push({ from: table.name, fromCol: name, to: ident(ref[1]), toCol: ref[2] ? ident(ref[2]) : "", kind: ">", onDelete: ref[3] });
  table.cols.push(col);
}

function parseFk(s: string, from: string, raw: Raw): boolean {
  const m = s.match(/foreign\s+key\s*\(([^)]*)\)\s*references\s+([\w".`[\]]+)\s*(?:\(([^)]*)\))?(?:.*?\bon\s+delete\s+(set\s+null|cascade|restrict|no\s+action|set\s+default))?/i);
  if (!m) return false;
  const cols = m[1].split(",").map(ident);
  if (cols.length > 1) {
    raw.warnings.push(`${from}: chave estrangeira composta (${cols.join(", ")}) ignorada.`);
    return true;
  }
  raw.refs.push({ from, fromCol: cols[0], to: ident(m[2]), toCol: m[3] ? ident(m[3].split(",")[0]) : "", kind: ">", onDelete: m[4] });
  return true;
}

function parseSql(src: string): Raw {
  const text = stripComments(src, /--.*$/gm);
  const raw: Raw = { tables: [], refs: [], warnings: [] };
  for (const stmt of text.split(";")) {
    const s = stmt.trim();
    const ct = s.match(/^create\s+(?:temporary\s+|temp\s+)?table\s+(?:if\s+not\s+exists\s+)?([\w".`[\]]+)\s*\(([\s\S]*)\)[^)]*$/i);
    if (ct) {
      const t: RawTable = { name: ident(ct[1]), cols: [], pk: [] };
      for (let item of splitTop(ct[2])) {
        item = item.replace(/^constraint\s+[\w"`[\]]+\s+/i, "");
        const pk = item.match(/^primary\s+key\s*\(([^)]*)\)/i);
        if (pk) t.pk = pk[1].split(",").map(ident);
        else if (/^foreign\s+key/i.test(item)) parseFk(item, t.name, raw);
        else if (/^unique\s*(key|index)?\s*[\w"`]*\s*\(/i.test(item)) {
          const cols = item.match(/\(([^)]*)\)/)![1].split(",").map(ident);
          if (cols.length === 1) t.cols.forEach((c) => c.name === cols[0] && (c.unique = true));
          else raw.warnings.push(`${t.name}: UNIQUE composto (${cols.join(", ")}) ignorado.`);
        } else if (/^(check|index|key|fulltext|spatial|exclude)\b/i.test(item)) continue;
        else parseSqlColumn(item, t, raw);
      }
      raw.tables.push(t);
      continue;
    }
    const alter = s.match(/^alter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?([\w".`[\]]+)\s+add\s+(?:constraint\s+[\w"`[\]]+\s+)?(foreign\s+key[\s\S]*)$/i);
    if (alter) parseFk(alter[2], ident(alter[1]), raw);
  }
  return raw;
}

// ---------------- Raw -> ErModel ----------------

let n = 0;
const nid = (p: string) => `${p}imp${Date.now().toString(36)}${(n++).toString(36)}`;

function toModel(raw: Raw): { model: ErModel; warnings: string[] } {
  const warnings = [...raw.warnings];
  const byName = new Map(raw.tables.map((t) => [t.name, t]));
  const refs = raw.refs.filter((r) => {
    const ok = byName.has(r.from) && byName.has(r.to);
    if (!ok) warnings.push(`Ligação ${r.from}.${r.fromCol} → ${r.to} ignorada: tabela não encontrada.`);
    return ok;
  });
  const pkNames = (t: RawTable) => (t.pk.length ? t.pk : t.cols.filter((c) => c.pk).map((c) => c.name));

  // Tabela de junção: só duas colunas, ambas FK para tabelas diferentes -> n-n.
  const junctions = new Set<string>();
  for (const t of raw.tables) {
    const out = refs.filter((r) => r.from === t.name && r.kind !== "<>");
    if (t.cols.length === 2 && out.length === 2 && out[0].to !== out[1].to && t.cols.every((c) => out.some((r) => r.fromCol === c.name))) {
      junctions.add(t.name);
    }
  }

  const tables = new Map<string, Table>();
  for (const t of raw.tables) {
    if (junctions.has(t.name)) continue;
    const pks = new Set(pkNames(t));
    const fkCols = new Set(refs.filter((r) => r.from === t.name && r.kind !== "<>").map((r) => r.fromCol));
    const columns: Column[] = t.cols
      .filter((c) => !fkCols.has(c.name) || pks.has(c.name))
      .map((c) => {
        const pk = pks.has(c.name);
        const col: Column = { id: nid("c"), name: snake(c.name), type: mapType(c.type, `${t.name}.${c.name}`, warnings) };
        if (pk) col.pk = true;
        if (!pk && !c.notNull) col.nullable = true;
        if (c.unique && !pk) col.unique = true;
        const d = c.auto ? "autoincrement" : mapDefault(c.default);
        if (d) col.default = d;
        return col;
      });
    if (!columns.some((c) => c.pk)) warnings.push(`${t.name}: sem chave primária.`);
    tables.set(t.name, { id: nid("t"), name: snake(t.name), columns, position: { x: 0, y: 0 } });
  }

  const relations: ErModel["relations"] = [];
  const add = (from: string, to: string, kind: RelKind, onDelete: OnDelete) => {
    const a = tables.get(from);
    const b = tables.get(to);
    if (a && b) relations.push({ id: nid("r"), from: a.id, to: b.id, kind, onDelete });
  };
  for (const name of junctions) {
    const [r1, r2] = refs.filter((r) => r.from === name);
    add(r1.to, r2.to, "n-n", "cascade");
  }
  for (const r of refs) {
    if (junctions.has(r.from)) continue;
    if (r.kind === "<>") {
      add(r.from, r.to, "n-n", "cascade");
      continue;
    }
    const child = byName.get(r.from)!;
    const col = child.cols.find((c) => c.name === r.fromCol);
    if (pkNames(child).includes(r.fromCol)) {
      warnings.push(`${r.from}.${r.fromCol}: chave primária que também é estrangeira; a ligação foi ignorada.`);
      continue;
    }
    const parentPk = pkNames(byName.get(r.to)!);
    if (r.toCol && parentPk.length && !parentPk.includes(r.toCol)) warnings.push(`${r.from}.${r.fromCol} aponta para ${r.to}.${r.toCol}, que não é a chave primária; o diagrama liga à chave primária.`);
    const expected = `${singular(snake(r.to))}_id`;
    if (snake(r.fromCol) !== expected) warnings.push(`${r.from}.${r.fromCol} vira ${expected} (o Studio nomeia a FK pela tabela pai).`);
    const nullable = col ? !col.notNull && !col.pk : false;
    const onDelete = mapOnDelete(r.onDelete) ?? (nullable ? "set null" : "restrict");
    add(r.from, r.to, r.kind === "-" || col?.unique ? "1-1" : "n-1", onDelete);
  }
  return { model: { tables: [...tables.values()], relations }, warnings };
}

export function detectFormat(text: string): SchemaFormat | null {
  if (/^\s*Table\s+[\w".]+[^\n{]*\{/im.test(text)) return "dbml";
  if (/\bcreate\s+table\b/i.test(text)) return "sql";
  return null;
}

/** Lê DBML ou SQL. Lança erro com mensagem amigável se nada for reconhecido. */
export function importSchema(text: string, format: SchemaFormat | null = detectFormat(text)): ImportResult {
  if (!format) throw new Error("Não reconheci o formato: cole um DBML (Table nome { ... }) ou SQL com CREATE TABLE.");
  const raw = format === "dbml" ? parseDbml(text) : parseSql(text);
  if (!raw.tables.length) throw new Error("Nenhuma tabela encontrada.");
  const { model, warnings } = toModel(raw);
  return { model, format, warnings: [...new Set(warnings)] };
}
