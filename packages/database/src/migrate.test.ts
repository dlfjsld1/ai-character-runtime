import {expect,it,vi} from 'vitest';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import type {Database} from './connection.ts';
import {assertMigrations} from './migrate.ts';

async function rows(){const directory=new URL('../migrations/',import.meta.url);return Promise.all((await readdir(directory)).filter(n=>n.endsWith('.sql')).map(async name=>({name,sha256:createHash('sha256').update(await readFile(new URL(name,directory))).digest('hex')})));}
it('startup accepts the checkout migration manifest, without writing or auto-migrating',async()=>{
 const query=vi.fn(async()=>({rows:await rows()}));await expect(assertMigrations({pool:{query}} as unknown as Database)).resolves.toBeUndefined();
 expect(query.mock.calls).toHaveLength(1);
});
it.each(['missing','same-count-wrong-name','hash','extra'])('startup rejects %s schema evidence',async kind=>{
 const records=await rows();if(kind==='missing')records.pop();if(kind==='same-count-wrong-name')records[0]!.name='0000_unrelated.sql';if(kind==='hash')records[0]!.sha256='wrong';if(kind==='extra')records.push({name:'9999_future.sql',sha256:'unknown'});
 await expect(assertMigrations({pool:{query:async()=>({rows:records})}} as unknown as Database)).rejects.toThrow(kind==='hash'?'migration_checksum_mismatch':'schema_migration_required');
});
