import { describe, expect, it } from 'vitest';
import { parseConfig, parseWireCounter, serializeWireCounter } from './index.ts';

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
