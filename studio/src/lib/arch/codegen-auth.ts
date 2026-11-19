// Gera src/auth.ts dos serviços. Dois níveis:
// - só middleware (rotas marcadas com "auth" ou Autenticação Externa): valida JWT HS256;
// - Própria: + users no Postgres, scrypt (node:crypto, sem binário nativo) e
//   POST /auth/register, POST /auth/login, GET /auth/me.
import { PASSWORD_COL, USERS_TABLE } from "@/lib/db/model";

export interface OwnAuthSpec {
  /** Lista SQL das colunas devolvidas ao cliente (nunca inclui password_hash). */
  userCols: string;
  /** Coluna da chave primária de users. */
  pk: string;
  /** Campos extras aceitos no register (além de email e password), já em zod. */
  extraFields: { name: string; zod: string }[];
}


export function authFile(own?: OwnAuthSpec): string {
  const head = `// Autenticação com JWT (HS256) — gerado pelo Vitrine Studio.
${own ? 'import { randomBytes, scrypt, timingSafeEqual, type BinaryLike } from "node:crypto";\n' : ""}${own ? 'import { Hono } from "hono";\n' : ""}import { jwt${own ? ", sign" : ""} } from "hono/jwt";
${own ? 'import { z } from "zod";\nimport { db } from "./db.js";\n' : ""}
const secret = process.env.JWT_SECRET;
// Segredo curto é quebrável por força bruta: HS256 pede pelo menos 32 bytes.
if (!secret || secret.length < 32) throw new Error("JWT_SECRET precisa ter pelo menos 32 caracteres (veja .env; gere com: openssl rand -hex 32).");
const JWT_SECRET: string = secret;

export type JwtClaims = { sub: string; email: string; exp: number };
export type AuthEnv = { Variables: { jwtPayload: JwtClaims } };

/** Exige "Authorization: Bearer <token>". Sem token, expirado ou inválido: 401. */
export const requireAuth = jwt({ secret: JWT_SECRET, alg: "HS256" });
`;
  if (!own) return head;

  const extra = own.extraFields.map((f) => `\n  ${JSON.stringify(f.name)}: ${f.zod},`).join("");
  return `${head}
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

// ---- Senhas: scrypt do node:crypto (sem dependência nativa, roda no Alpine) ----

function scryptAsync(password: BinaryLike, salt: BinaryLike, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, keylen, (err, key) => (err ? reject(err) : resolve(key))));
}

/** Formato guardado: scrypt$<salt base64>$<hash base64>. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return \`scrypt$\${salt.toString("base64")}$\${key.toString("base64")}\`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, salt, key] = stored.split("$");
  if (alg !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Login com e-mail inexistente também roda o scrypt: o tempo de resposta não
// revela quais e-mails estão cadastrados.
const DUMMY_HASH = hashPassword(randomBytes(12).toString("hex"));

// ---- Rotas /auth ----

z.config(z.locales.pt());
const email = z.string().trim().toLowerCase().pipe(z.email().max(255));
const RegisterInput = z.object({
  email,
  password: z.string().min(8).max(200),${extra}
});
const LoginInput = z.object({ email, password: z.string().min(1).max(200) });

// Colunas devolvidas ao cliente. ${PASSWORD_COL} nunca sai do banco.
const USER_COLS = ${JSON.stringify(own.userCols)};

function issuesOf(error: z.ZodError) {
  return error.issues.map((i) => ({ campo: i.path.join(".") || "(corpo)", erro: i.message }));
}

function tokenFor(user: { ${own.pk}: unknown; email: string }): Promise<string> {
  const claims: JwtClaims = { sub: String(user.${own.pk}), email: user.email, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS };
  return sign(claims, JWT_SECRET, "HS256");
}

export const authRoutes = new Hono<AuthEnv>();

authRoutes.post("/register", async (c) => {
  const parsed = RegisterInput.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) return c.json({ error: "Corpo inválido.", issues: issuesOf(parsed.error) }, 400);
  const { password, ...rest } = parsed.data;
  const data: [string, unknown][] = [...Object.entries(rest).filter(([, v]) => v !== undefined), ["${PASSWORD_COL}", await hashPassword(password)]];
  const sql = \`insert into "${USERS_TABLE}" (\${data.map(([k]) => \`"\${k}"\`).join(", ")}) values (\${data.map((_, i) => \`$\${i + 1}\`).join(", ")}) returning \${USER_COLS}\`;
  try {
    const { rows } = await db.query(sql, data.map(([, v]) => v));
    const user = rows[0];
    return c.json({ token: await tokenFor(user), user }, 201);
  } catch (err) {
    if ((err as { code?: string }).code === "23505") return c.json({ error: "E-mail já cadastrado." }, 409);
    throw err;
  }
});

authRoutes.post("/login", async (c) => {
  const parsed = LoginInput.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) return c.json({ error: "Corpo inválido.", issues: issuesOf(parsed.error) }, 400);
  const { rows } = await db.query(\`select \${USER_COLS}, "${PASSWORD_COL}" from "${USERS_TABLE}" where "email" = $1\`, [parsed.data.email]);
  const row = rows[0];
  const ok = await verifyPassword(parsed.data.password, row?.${PASSWORD_COL} ?? (await DUMMY_HASH));
  if (!row || !ok) return c.json({ error: "E-mail ou senha incorretos." }, 401);
  const { ${PASSWORD_COL}: _hash, ...user } = row;
  return c.json({ token: await tokenFor(user), user });
});

authRoutes.get("/me", requireAuth, async (c) => {
  const { rows } = await db.query(\`select \${USER_COLS} from "${USERS_TABLE}" where "${own.pk}" = $1\`, [c.get("jwtPayload").sub]);
  return rows[0] ? c.json(rows[0]) : c.json({ error: "Usuário não encontrado." }, 404);
});
`;
}
