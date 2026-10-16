import {it,expect} from 'vitest';
import {mkdtemp,writeFile,readFile,unlink,rmdir} from 'node:fs/promises';
import {join} from 'node:path';
import {DialogueRecording} from './dialogue-recording.ts';
import {OllamaProvider} from '../packages/adapters/src/ollama.ts';

it('persists late physical completion without changing a timeout failure to success',async()=>{
  const directory=await mkdtemp(join('J:/ai/ai-character-runtime/model-comparison/tmp','dialogue-recording-')),file=join(directory,'results.json');
  const report={status:'INCOMPLETE',requestCount:1,physicalCompletionPending:true,calls:[] as any[],failure:null as string|null};
  const recording=new DialogueRecording(snapshot=>writeFile(file,snapshot));
  let release!:()=>void,recorded!:()=>void;const gate=new Promise<void>(resolve=>release=resolve),completed=new Promise<void>(resolve=>recorded=resolve);
  const provider=new OllamaProvider('qwen2.5:7b',{count:async()=>10,countText:async()=>10},undefined,async()=>{await gate;return new Response('{"message":{"content":"안녕."},"done":true,"prompt_eval_count":10}\n',{headers:{'content-type':'application/x-ndjson'}});},{deadlinesMs:{dialogue:5,appraise:5,solve:5},onCall:call=>{report.calls.push(call);report.physicalCompletionPending=false;void recording.save(report).then(recorded);}});
  try{
    try{await provider.dialogue({action:'answer',purpose:'question',targetIdentityId:null,expression:'neutral',maxSentences:2,delivery:'normal',memoryIds:[]},{});}catch(error){report.failure=(error as any).code;report.status='FAIL';}
    await recording.save(report);
    expect(JSON.parse(await readFile(file,'utf8'))).toMatchObject({status:'FAIL',requestCount:1,physicalCompletionPending:true,calls:[]});
    await expect(provider.unloadOwnedModel()).rejects.toMatchObject({code:'physical_call_unconfirmed'});
    release();await completed;await recording.flush();
    const saved=JSON.parse(await readFile(file,'utf8'));
    expect(saved).toMatchObject({status:'FAIL',failure:'provider_timeout',physicalCompletionPending:false});
    expect(saved.calls).toHaveLength(1);expect(saved.calls[0]).toMatchObject({physicalCompleted:true,deadlineExceeded:true});
  }finally{release();await recording.flush();await unlink(file);await rmdir(directory);}
});
it('serializes overlapping snapshots in their observed order',async()=>{
  const saved:string[]=[];let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
  const recording=new DialogueRecording(async snapshot=>{if(saved.length===0)await gate;saved.push(snapshot);});
  const first=recording.save({calls:0}),second=recording.save({calls:1});release();await Promise.all([first,second]);await recording.flush();
  expect(saved.map(x=>JSON.parse(x).calls)).toEqual([0,1]);
});
it('retains write failures even if a subsequent snapshot writes successfully',async()=>{
  let count=0;const recording=new DialogueRecording(async()=>{if(count++===0)throw new Error('synthetic_disk_failure');});
  await expect(recording.save({calls:0})).rejects.toThrow('synthetic_disk_failure');
  await recording.save({calls:1});await expect(recording.flush()).rejects.toThrow('synthetic_disk_failure');
});
