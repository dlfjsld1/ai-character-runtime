"""P04 offline WAV probe; no microphone or automatic download."""
import argparse, contextlib, json, os, pathlib, time, wave
os.environ['HF_HUB_OFFLINE']='1';os.environ['TRANSFORMERS_OFFLINE']='1'
def inspect_wav(path):
    with wave.open(str(path),'rb') as f:
        if f.getnchannels()!=1 or f.getsampwidth()!=2 or f.getframerate()!=16000 or f.getnframes()==0 or f.getnframes()>15*16000:
            raise ValueError('unsupported_audio')
        data=f.readframes(f.getnframes())
        if len(data)!=f.getnframes()*2:raise ValueError('unsupported_audio')
        return any(data)
def transcribe(model_path,audio):
    speech=inspect_wav(audio)
    if not speech:return {'status':'completed','text':'','empty':True}
    root=pathlib.Path(model_path)
    if not all((root/name).is_file() for name in ('model.bin','config.json','tokenizer.json','vocabulary.txt')):return {'status':'failed','code':'model_missing'}
    import sys
    with contextlib.redirect_stdout(sys.stderr):
        from faster_whisper import WhisperModel
        start=time.monotonic();model=WhisperModel(str(root),device='cpu',compute_type='int8',local_files_only=True,cpu_threads=4)
        load_ms=round((time.monotonic()-start)*1000)
        print(json.dumps({'status':'ready','worker':'stt','loadMs':load_ms}),file=sys.__stdout__,flush=True)
        inference_start=time.monotonic()
        segments,_=model.transcribe(str(audio),language='ko',beam_size=5,vad_filter=False)
        text=' '.join(s.text.strip() for s in segments).strip()
    return {'status':'completed','text':text,'empty':not text,'durationMs':round((time.monotonic()-start)*1000),'loadMs':load_ms,'inferenceMs':round((time.monotonic()-inference_start)*1000),'device':'cpu','computeType':'int8','cpuThreads':4}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--model',required=True);p.add_argument('--audio',required=True);args=p.parse_args()
    try:result=transcribe(args.model,args.audio)
    except (ValueError,wave.Error,EOFError,OSError):result={'status':'failed','code':'unsupported_audio'}
    except ImportError:result={'status':'failed','code':'provider_unavailable'}
    print(json.dumps(result,ensure_ascii=False))
