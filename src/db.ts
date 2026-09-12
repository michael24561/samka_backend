import pg from "pg";
import { env } from "./env.js";

if (!env.databaseUrl) {
  throw new Error("DATABASE_URL no está configurada en server/.env");
}

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
});

pool.on("error", (err) => {
  console.error("Error inesperado en el pool de PostgreSQL", err);
});

export function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}
