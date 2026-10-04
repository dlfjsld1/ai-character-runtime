import { loadLocalEnv } from './env.ts';
import { Database } from '../packages/database/src/connection.ts';
import { migrate } from '../packages/database/src/migrate.ts';
import { seed } from '../packages/database/src/seed.ts';
loadLocalEnv();
const url=process.argv.includes('--test')?process.env.TEST_DATABASE_URL:process.argv.includes('migrate')?process.env.MIGRATION_DATABASE_URL??process.env.DATABASE_URL:process.env.DATABASE_URL;
if(!url)throw new Error('database_not_configured');
const db=new Database(url);
try {
  if(process.argv.includes('migrate')){
    await migrate(db);
    const role=(await db.pool.query('SELECT current_user AS role')).rows[0].role;
    if(role==='runtime_migrator')await db.pool.query('GRANT USAGE ON SCHEMA public TO runtime_app; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO runtime_app; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO runtime_app');
  }
  if(process.argv.includes('seed'))await seed(db);
  console.log('Database operation completed');
}finally{await db.close();}
