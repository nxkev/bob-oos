import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const password = process.env.SUPABASE_DB_PASSWORD;
const projectRef = process.env.SUPABASE_PROJECT_REF;
const region = process.env.SUPABASE_POOLER_REGION || "aws-1-us-east-2";

if (!password || !projectRef) {
  console.error(
    "Missing SUPABASE_DB_PASSWORD or SUPABASE_PROJECT_REF. Run via `op run` or set env vars directly."
  );
  process.exit(1);
}

const sql = readFileSync(
  resolve(__dirname, "../supabase/schema.sql"),
  "utf-8"
);

const client = new Client({
  host: `${region}.pooler.supabase.com`,
  port: 5432,
  user: `postgres.${projectRef}`,
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log("connected to supabase pooler");
  await client.query(sql);
  console.log("schema applied ✓");
} catch (err) {
  console.error("failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
