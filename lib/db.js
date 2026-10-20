// Postgres access. Production uses Neon over HTTP (DATABASE_URL, set by the Vercel Neon integration).
// Tests set PGLITE=1 to run against an in-process Postgres.
let _q;
async function driver() {
  if (_q) return _q;
  if (process.env.PGLITE) {
    const { PGlite } = await import('@electric-sql/pglite');
    const db = globalThis.__pglite || (globalThis.__pglite = new PGlite());
    _q = async (text, params = []) => (await db.query(text, params)).rows;
  } else {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(url);
    _q = (text, params = []) => sql.query(text, params);
  }
  return _q;
}

export async function q(text, params) { return (await driver())(text, params); }

let ready;
export function ensure() {
  ready = ready || (async () => {
    await q(`create table if not exists styles (
      key text primary key,
      data jsonb not null,
      seaa boolean not null default false,
      first_seen timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      last_date text)`);
    await q(`create table if not exists snapshots (
      key text not null, date text not null, at timestamptz not null,
      units integer, c jsonb not null, ck bigint,
      primary key (key, date))`);
    await q(`create table if not exists daily (
      key text not null, date text not null,
      units integer, sold integer, recv integer, rev double precision, min_offer double precision, first boolean,
      primary key (key, date))`);
  })().catch(e => { ready = null; throw e; });
  return ready;
}
