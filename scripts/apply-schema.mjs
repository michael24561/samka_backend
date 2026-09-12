import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL no configurada en server/.env");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const schema = readFileSync(join(__dirname, "../src/sql/schema_v2.sql"), "utf8");

try {
  await client.connect();
  await client.query(schema);
  console.log("Schema aplicado correctamente.");
} catch (err) {
  console.error("Error aplicando schema:", err);
  process.exitCode = 1;
} finally {
  await client.end();
}
