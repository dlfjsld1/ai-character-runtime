"""Only dumps synthetic character_runtime_test to the dedicated restore_test DB."""
import json,os,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[1];binary=root/'runtime-data'/'tools'/'pgsql'/'bin'
keys=json.loads((root/'runtime-data'/'db-credentials.json').read_text());env={**os.environ,'PGPASSWORD':keys['test']}
archive=root/'runtime-data'/'synthetic-test-backup.dump'
def run(exe,args,**kwargs):return subprocess.run([str(binary/exe),*map(str,args)],env=env,check=True,capture_output=True,**kwargs)
metadata_sql="SELECT json_build_object('jev_records',count(*),'metadata_digest',md5(coalesce(string_agg(jsonb_build_object('id',id,'provider',provider,'model',model,'prompt_version',prompt_version,'latency_ms',latency_ms,'usage',usage,'provider_result',provider_result)::text,',' ORDER BY id),''))) FROM appraisals WHERE provider_result IS NOT NULL;"
def metadata(database):return json.loads(run('psql.exe',['-h','127.0.0.1','-p','55432','-U','runtime_test','-d',database,'-At','-c',metadata_sql]).stdout.decode().strip())
before=metadata('character_runtime_test')
run('pg_dump.exe',['-h','127.0.0.1','-p','55432','-U','runtime_test','-d','character_runtime_test','--no-owner','--no-acl','-Fc','-f',archive])
run('pg_restore.exe',['-h','127.0.0.1','-p','55432','-U','runtime_test','-d','character_runtime_restore_test','--clean','--if-exists','--no-owner','--no-acl','--exit-on-error',archive])
result=run('psql.exe',['-h','127.0.0.1','-p','55432','-U','runtime_test','-d','character_runtime_restore_test','-At','-c',"SELECT json_build_object('database',current_database(),'migrations',(SELECT count(*) FROM schema_migrations),'identities',(SELECT count(*) FROM identities),'state_check',(SELECT count(*) FROM pg_constraint WHERE conname='character_state_body_check'),'jev_column',(SELECT count(*) FROM information_schema.columns WHERE table_name='appraisals' AND column_name='provider_result'));"]).stdout.decode().strip()
observed=json.loads(result)
assert observed['database']=='character_runtime_restore_test' and observed['migrations']==3 and observed['identities']==4 and observed['state_check']==1 and observed['jev_column']==1
after=metadata('character_runtime_restore_test');assert before==after
observed.update(after);observed['metadata_matches_source']=True
print(json.dumps({'status':'PASS','mode':'synthetic_postgresql_restore','observed':observed}))
