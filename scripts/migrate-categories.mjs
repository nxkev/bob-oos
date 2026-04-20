import pg from "pg";

const { Client } = pg;

const password = process.env.SUPABASE_DB_PASSWORD;
const projectRef = process.env.SUPABASE_PROJECT_REF;
const region = process.env.SUPABASE_POOLER_REGION || "aws-1-us-east-2";

const client = new Client({
  host: `${region}.pooler.supabase.com`,
  port: 5432,
  user: `postgres.${projectRef}`,
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

await client.connect();

await client.query("begin");
try {
  await client.query(
    "alter table public.oos_reports drop constraint if exists oos_reports_category_check"
  );
  const upd = await client.query(
    "update public.oos_reports set category = 'grocery' where category in ('food','drink')"
  );
  console.log(`updated ${upd.rowCount} rows to 'grocery'`);
  await client.query(
    "alter table public.oos_reports add constraint oos_reports_category_check check (category in ('grocery','alcohol'))"
  );
  await client.query("commit");
  console.log("migration committed ✓");
} catch (e) {
  await client.query("rollback");
  console.error("rolled back:", e.message);
  process.exitCode = 1;
}

await client.end();
