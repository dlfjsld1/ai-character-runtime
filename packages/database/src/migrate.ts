import { readFile,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Database } from './connection.ts';
export async function migrate(db:Database) {
  const directory=fileURLToPath(new URL('../migrations/',import.meta.url));
  await db.transaction(async c=>{
    await c.query('SELECT pg_advisory_xact_lock(734211901)');
    await c.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    for(const name of (await readdir(directory)).filter(x=>x.endsWith('.sql')).sort()) {
      const sql=await readFile(directory+name,'utf8'),hash=createHash('sha256').update(sql).digest('hex');
      const prior=await c.query('SELECT sha256 FROM schema_migrations WHERE name=$1',[name]);
      if(prior.rowCount){if(prior.rows[0].sha256!==hash)throw new Error('migration_checksum_mismatch');continue;}
      await c.query(sql);await c.query('INSERT INTO schema_migrations(name,sha256) VALUES($1,$2)',[name,hash]);
    }
  });
}
