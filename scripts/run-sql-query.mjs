import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const { Client } = pg;

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/run-sql-query.mjs <path-to-sql>");
  process.exit(1);
}

const password = process.env.SUPABASE_DB_PASSWORD;
const projectRef = process.env.SUPABASE_PROJECT_REF;
const region = process.env.SUPABASE_POOLER_REGION || "aws-1-us-east-2";

const sql = readFileSync(resolve(process.cwd(), file), "utf-8");

const client = new Client({
  host: `${region}.pooler.supabase.com`,
  port: 5432,
  user: `postgres.${projectRef}`,
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

await client.connect();
const result = await client.query(sql);
console.log(JSON.stringify(result.rows, null, 2));
await client.end();
