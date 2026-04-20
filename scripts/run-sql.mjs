import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const { Client } = pg;

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/run-sql.mjs <path-to-sql>");
  process.exit(1);
}

const password = process.env.SUPABASE_DB_PASSWORD;
const projectRef = process.env.SUPABASE_PROJECT_REF;
const region = process.env.SUPABASE_POOLER_REGION || "aws-1-us-east-2";

if (!password || !projectRef) {
  console.error("Missing SUPABASE_DB_PASSWORD or SUPABASE_PROJECT_REF");
  process.exit(1);
}

const sql = readFileSync(resolve(process.cwd(), file), "utf-8");

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
  console.log(`connected; running ${file}`);
  await client.query(sql);
  console.log("ok ✓");
} catch (err) {
  console.error("failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
