import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { env } from "./env";

type Sql = ReturnType<typeof postgres>;

const g = globalThis as unknown as { __sql?: Sql; __schema?: Promise<void> };

export function sql(): Sql {
  g.__sql ??= postgres(env.databaseUrl!, {
    max: 5,
    idle_timeout: 20,
    prepare: false, // compatible con poolers en modo transacción (Neon, Supabase)
    ssl: /localhost|127\.0\.0\.1/.test(env.databaseUrl ?? "") ? false : "require",
  });
  return g.__sql;
}

/** Aplica db/schema.sql una vez por instancia (todas las sentencias son idempotentes). */
export function ensureSchema(): Promise<void> {
  g.__schema ??= (async () => {
    const ddl = await readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8");
    await sql().unsafe(ddl);
  })().catch((err) => {
    g.__schema = undefined;
    throw err;
  });
  return g.__schema;
}

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

/**
 * Comprueba que quien escribe tiene la llave de edición del catálogo.
 * "missing" = el catálogo aún no existe (la primera sincronización lo crea).
 */
export async function checkEditKey(catalogId: string, editKey: string): Promise<"ok" | "missing" | "forbidden"> {
  const rows = await sql()`select edit_key_hash from catalogs where id = ${catalogId}`;
  if (!rows.length) return "missing";
  return rows[0].edit_key_hash === hashKey(editKey) ? "ok" : "forbidden";
}
