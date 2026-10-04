"""Install only the downloaded official portable binaries into this project.
Creates a private loopback cluster, dedicated app/test roles and databases.
Never changes system services, PATH, pg_hba of an existing cluster or other DBs.
"""
import json, os, pathlib, secrets, subprocess, zipfile

root = pathlib.Path(__file__).resolve().parents[1]
tools = root / 'runtime-data' / 'tools'
archive = tools / 'postgresql-18.6-windows-x64.zip'
binary = tools / 'pgsql' / 'bin'
if not binary.exists():
    with zipfile.ZipFile(archive) as z:
        for info in z.infolist():
            if info.filename.startswith(('pgsql/bin/', 'pgsql/lib/', 'pgsql/share/')) or info.filename == 'pgsql/server_license.txt':
                dest = (tools / info.filename).resolve()
                if tools.resolve() not in dest.parents:
                    raise ValueError('archive path escape')
                z.extract(info, tools)
data = root / 'runtime-data' / 'postgres'
credential = root / 'runtime-data' / 'db-credentials.json'
if credential.exists():
    keys = json.loads(credential.read_text())
else:
    keys = {name: secrets.token_hex(32) for name in ('admin', 'app', 'test')}
    credential.write_text(json.dumps(keys))
if 'migration' not in keys:
    keys['migration']=secrets.token_hex(32)
    credential.write_text(json.dumps(keys))

def run(exe, args, **kwargs):
    return subprocess.run([str(binary / exe), *map(str,args)], check=True, **kwargs)

if not (data / 'PG_VERSION').exists():
    pwfile = root / 'runtime-data' / 'init-password.tmp'
    pwfile.write_text(keys['admin'])
    try:
        run('initdb.exe', ['-D',data,'-U','runtime_admin','--pwfile',pwfile,'--auth=scram-sha-256','--encoding=UTF8','--locale=C'])
    finally:
        pwfile.unlink(missing_ok=True)
    with (data / 'postgresql.conf').open('a') as f:
        f.write("\nlisten_addresses = '127.0.0.1'\nport = 55432\nmax_connections = 25\nshared_buffers = '64MB'\n")

status = subprocess.run([str(binary/'pg_ctl.exe'),'-D',str(data),'status'],capture_output=True)
if status.returncode:
    run('pg_ctl.exe',['-D',data,'-l',root/'runtime-data'/'postgres.log','-w','start'],creationflags=subprocess.CREATE_NO_WINDOW)
env = {**os.environ,'PGPASSWORD':keys['admin']}
def sql(text):
    return run('psql.exe',['-h','127.0.0.1','-p','55432','-U','runtime_admin','-d','postgres','-v','ON_ERROR_STOP=1','-At'],input=text,text=True,env=env,capture_output=True).stdout
for role,key in [('runtime_app','app'),('runtime_migrator','migration'),('runtime_test','test')]:
    if sql(f"SELECT 1 FROM pg_roles WHERE rolname='{role}';").strip() != '1':
        sql(f"CREATE ROLE {role} LOGIN PASSWORD '{keys[key]}' NOSUPERUSER NOCREATEDB NOCREATEROLE;")
for db,role in [('character_runtime','runtime_migrator'),('character_runtime_test','runtime_test'),('character_runtime_restore_test','runtime_test')]:
    if sql(f"SELECT 1 FROM pg_database WHERE datname='{db}';").strip() != '1':
        sql(f'CREATE DATABASE {db} OWNER {role};')
sql('ALTER DATABASE character_runtime OWNER TO runtime_migrator;')
(root/'runtime-data'/'local.env').write_text(f"DATABASE_URL=postgresql://runtime_app:{keys['app']}@127.0.0.1:55432/character_runtime\nMIGRATION_DATABASE_URL=postgresql://runtime_migrator:{keys['migration']}@127.0.0.1:55432/character_runtime\nTEST_DATABASE_URL=postgresql://runtime_test:{keys['test']}@127.0.0.1:55432/character_runtime_test\n")
print(json.dumps({'version':sql('SELECT version();').strip(),'port':55432,'bind':'127.0.0.1','databases':['character_runtime','character_runtime_test','character_runtime_restore_test'],'system_services_changed':False}))
