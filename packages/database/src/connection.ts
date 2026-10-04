import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.ts';
import { RuntimeError } from '../../contracts/src/domain.ts';
export class Database {
  pool:pg.Pool;
  orm:ReturnType<typeof drizzle<typeof schema>>;
  owner:pg.PoolClient|null=null;
  healthy=true;
  constructor(url:string) {
    const parsed=new URL(url);
    if(!['postgres:','postgresql:'].includes(parsed.protocol)||!['localhost','127.0.0.1'].includes(parsed.hostname)) throw new RuntimeError('local_database_required',400);
    this.pool=new pg.Pool({connectionString:url,max:8,connectionTimeoutMillis:3000});
    this.pool.on('error',()=>{this.healthy=false;});
    this.orm=drizzle(this.pool,{schema});
  }
  async transaction<T>(fn:(client:pg.PoolClient)=>Promise<T>):Promise<T> {
    const client=await this.pool.connect();
    try {await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}
    catch(e) {await client.query('ROLLBACK');throw e;}
    finally {client.release();}
  }
  async own(characterId:string,onLost:()=>void) {
    this.owner=await this.pool.connect();
    const result=await this.owner.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',[characterId]);
    if(!result.rows[0].acquired){this.owner.release();this.owner=null;throw new RuntimeError('runtime_already_running');}
    this.owner.on('error',()=>{this.healthy=false;onLost();});
  }
  async close(){if(this.owner){await this.owner.query('SELECT pg_advisory_unlock_all()').catch(()=>{});this.owner.release();this.owner=null;}await this.pool.end();}
}
