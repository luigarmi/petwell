import { Pool, type QueryResultRow } from "pg";

export function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString
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
