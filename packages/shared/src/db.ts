import { Pool, type PoolConfig, type QueryResultRow } from "pg";
import { getEnv } from "./env.js";

function resolveSslConfig(connectionString: string): PoolConfig["ssl"] {
  const sslModeFromEnv = getEnv("POSTGRES_SSL_MODE", "").trim().toLowerCase();
  const rejectUnauthorized =
    getEnv("POSTGRES_SSL_REJECT_UNAUTHORIZED", sslModeFromEnv.startsWith("verify") ? "true" : "false") ===
    "true";

  try {
    const url = new URL(connectionString);
    const sslModeFromUrl = url.searchParams.get("sslmode")?.trim().toLowerCase() ?? "";
    const sslMode = sslModeFromUrl || sslModeFromEnv;
    const shouldUseSsl = ["require", "verify-ca", "verify-full"].includes(sslMode);

    if (!shouldUseSsl) {
      return undefined;
    }

    return { rejectUnauthorized };
  } catch {
    return sslModeFromEnv ? { rejectUnauthorized } : undefined;
  }
}

export function createPool(connectionString: string, applicationName?: string): Pool {
  return new Pool({
    connectionString,
    ssl: resolveSslConfig(connectionString),
    application_name: applicationName
  });
}

export async function runStatements(pool: Pool, statements: string[]): Promise<void> {
  for (const statement of statements) {
    await pool.query(statement);
  }
}

export async function one<T extends QueryResultRow>(
  pool: Pool,
  text: string,
  values: unknown[] = []
): Promise<T | null> {
  const result = await pool.query<T>(text, values);
  return result.rows[0] ?? null;
}

export async function many<T extends QueryResultRow>(
  pool: Pool,
  text: string,
  values: unknown[] = []
): Promise<T[]> {
  const result = await pool.query<T>(text, values);
  return result.rows;
}
