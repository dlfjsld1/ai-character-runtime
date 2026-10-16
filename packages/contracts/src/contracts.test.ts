import { describe, expect, it } from 'vitest';
import { parseConfig, parseWireCounter, serializeWireCounter } from './index.ts';
import { stateSchema } from './domain.ts';
import { initialState } from '../../character-core/src/index.ts';
import { randomUUID } from 'node:crypto';

describe('ER11 bounded silence records',()=>{
  const silence=()=>({eventId:randomUUID(),eventRevision:'1',stateVersion:'9007199254740993',identityId:randomUUID(),at:1,reason:'listening' as const,sourceRefs:[{kind:'event' as const,id:randomUUID(),version:'1'}],affect:{joy:0,frustration:.2,surprise:0,embarrassment:0,pleasantness:.58}});
  it('reads old snapshots with an empty silence collection',()=>{
    const state=initialState(0);state.turn={listening:false,acknowledgements:{}} as typeof state.turn;
    expect(stateSchema.parse(state).turn.recentSilences).toEqual([]);
  });
  it('retains a bounded versioned reason without raw text and rejects duplicate identities',()=>{
    const state=initialState(0),record=silence();
    expect(stateSchema.parse({...state,turn:{...state.turn,recentSilences:[record]}}).turn.recentSilences).toEqual([record]);
    expect(()=>stateSchema.parse({...state,turn:{...state.turn,recentSilences:[record,{...record,eventId:randomUUID()}]}})).toThrow();
    expect(()=>stateSchema.parse({...state,turn:{...state.turn,recentSilences:Array.from({length:21},silence)}})).toThrow();
    expect(()=>stateSchema.parse({...state,turn:{...state.turn,recentSilences:[{...record,text:'private input'}]}})).toThrow();
    for(const version of ['0','01','-1','1.1',1])expect(()=>stateSchema.parse({...state,turn:{...state.turn,recentSilences:[{...record,eventRevision:version}]}})).toThrow();
  });
});

describe('wire counters', () => {
  it('preserves integers beyond JavaScript safe number range', () => {
    const value = '9007199254740993';
    expect(serializeWireCounter(parseWireCounter(value))).toBe(value);
  });

  it.each(['01', '-1', '1.0', '1e3', 1, null])('rejects invalid wire value %s', (value) => {
    expect(() => parseWireCounter(value)).toThrow();
  });
});

describe('local-only configuration', () => {
  it('requires Jev explicitly and gates the exception without opening local services',()=>{
    expect(parseConfig({})).toMatchObject({APPRAISAL_MODEL:'jev-1.13.0',LOCAL_ONLY:true,ALLOW_PAID_PROVIDERS:false,TYPESAFE_API_KEY:''});
    expect(()=>parseConfig({APPRAISAL_MODEL:'qwen2.5:7b'})).toThrow('APPRAISAL_MODEL=jev-1.13.0');
    expect(parseConfig({LOCAL_ONLY:'false',ALLOW_PAID_PROVIDERS:'true',TYPESAFE_API_KEY:'test'}).ALLOW_PAID_PROVIDERS).toBe(true);
    expect(()=>parseConfig({LOCAL_ONLY:'false',ALLOW_PAID_PROVIDERS:'true',OLLAMA_BASE_URL:'https://example.com'})).toThrow();
  });
  it('rejects a remote Ollama URL and paid providers', () => {
    expect(() => parseConfig({ OLLAMA_BASE_URL: 'https://example.com', LOCAL_ONLY: 'true' })).toThrow();
    expect(() => parseConfig({ DATABASE_URL: 'postgresql://db.example.com/runtime' })).toThrow();
    expect(() => parseConfig({ ALLOW_PAID_PROVIDERS: 'true' })).toThrow();
  });

  it('rejects cloud model identifiers', () => {
    expect(() => parseConfig({ APPRAISAL_MODEL: 'qwen2.5:cloud' })).toThrow();
  });
});
