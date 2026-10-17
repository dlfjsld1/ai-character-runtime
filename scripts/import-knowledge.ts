import { lstat,open,realpath } from 'node:fs/promises';
import { basename,extname,resolve,parse,dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { knowledgePutSchema } from '../packages/database/src/knowledge-store.ts';

const MAX_BYTES=32768;
const privatePart=/^(?:\.git|\.aws|\.ssh|\.codex-remote-attachments|\.env(?:\..*)?|credentials?|secrets?)$/i;
function samePath(a:string,b:string){return process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;}
export async function readExplicitKnowledgeFile(file:string){
 const requested=resolve(file);
 if(!['.md','.txt'].includes(extname(requested).toLowerCase())||requested.split(/[\\/]/).some(p=>privatePart.test(p))||/(?:^|[._-])(?:api[._-]?key|private[._-]?key|credentials?|secrets?)(?:[._-]|$)/i.test(basename(requested)))throw new Error('knowledge_file_not_allowed');
 // Check every explicit path component, without enumerating directories.
 for(let part=requested;part!==parse(part).root;part=dirname(part))if((await lstat(part)).isSymbolicLink())throw new Error('knowledge_symlink_not_allowed');
 const canonical=await realpath(requested);
 if(!samePath(canonical,requested))throw new Error('knowledge_symlink_not_allowed');
 const before=await lstat(requested);
 if(!before.isFile()||before.size>MAX_BYTES)throw new Error('knowledge_file_size_or_type');
 const handle=await open(requested,'r');
 try{
  const opened=await handle.stat();
  if(!opened.isFile()||opened.dev!==before.dev||opened.ino!==before.ino||opened.size>MAX_BYTES)throw new Error('knowledge_file_changed');
  const data=Buffer.alloc(MAX_BYTES+1);let size=0;
  while(size<data.length){const {bytesRead}=await handle.read(data,size,data.length-size,null);if(!bytesRead)break;size+=bytesRead;}
  const after=await handle.stat();
  if(size>MAX_BYTES||after.size!==opened.size||after.mtimeMs!==opened.mtimeMs||!samePath(await realpath(requested),canonical))throw new Error('knowledge_file_changed');
  let body:string;try{body=new TextDecoder('utf-8',{fatal:true}).decode(data.subarray(0,size));}catch{throw new Error('knowledge_utf8_required');}
  if(/-----BEGIN (?:[A-Z ]*PRIVATE KEY|OPENSSH PRIVATE KEY)-----|\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}|\bgh[pousr]_[A-Za-z0-9]{20,}/.test(body))throw new Error('knowledge_secret_content_rejected');
  return knowledgePutSchema.parse({title:basename(requested,extname(requested)),body});
 }finally{await handle.close();}
}
export async function importKnowledgeMain(args=process.argv.slice(2)){
 const files:string[]=[];const opts:Record<string,string>={};
 for(let i=0;i<args.length;i++){
  const key=args[i];if(!['--session','--identity','--file','--document','--revision'].includes(key)||!args[i+1]||args[i+1].startsWith('--'))throw new Error('usage: --session UUID --identity UUID --file exact.md [--file exact.txt] [--document UUID --revision N]');
  const value=args[++i];if(key==='--file')files.push(value);else{if(opts[key])throw new Error('duplicate_option');opts[key]=value;}
 }
 const sessionId=z.uuid().parse(opts['--session']),identityId=z.uuid().parse(opts['--identity']);
 if(!files.length||files.length>20||(opts['--document']||opts['--revision'])&&files.length!==1)throw new Error('knowledge_explicit_files_required');
 if(Boolean(opts['--document'])!==Boolean(opts['--revision']))throw new Error('knowledge_update_requires_document_and_revision');
 const token=process.env.STUDIO_ACCESS_TOKEN;if(!token||!/^[0-9a-f]{64}$/.test(token))throw new Error('studio_access_token_required');
 // Validate every explicitly listed file before any mutation; paths never leave this process.
 const documents=[];for(const file of files)documents.push(knowledgePutSchema.parse({...await readExplicitKnowledgeFile(file),...(opts['--document']?{documentId:opts['--document'],expectedRevision:opts['--revision']}:{})}));
 const results=[];
 for(const document of documents){
  const response=await fetch(`http://127.0.0.1:3001/api/sessions/${sessionId}/knowledge`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{origin:'http://127.0.0.1:3001',authorization:`Bearer ${token}`,'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({identityId,...document})});
  if(!response.ok)throw new Error(`knowledge_import_http_${response.status}_completed_${results.length}`);
  const result=await response.json() as {data:{documentId:string;revision:string}};results.push({documentId:z.uuid().parse(result.data.documentId),revision:z.string().regex(/^[1-9][0-9]*$/).parse(result.data.revision)});
  console.log(JSON.stringify(results.at(-1)));
 }
 return results;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)importKnowledgeMain().catch(error=>{console.error(error instanceof Error&&/^(knowledge_|studio_|usage:|duplicate_option)/.test(error.message)?error.message:'knowledge_import_failed');process.exitCode=1;});
