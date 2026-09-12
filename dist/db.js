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
export function query(text, params) {
    return pool.query(text, params);
}
