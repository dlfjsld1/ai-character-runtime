"""P03 minimum OmniVoice experiment. Explicit reference/transcript required.
Does not select personal recordings, start demos or download any model.
"""
import argparse,contextlib,json,os,pathlib,time,wave
os.environ['HF_HUB_OFFLINE']='1';os.environ['TRANSFORMERS_OFFLINE']='1'
def synthesize(model_path,reference,transcript,text,output,synthetic_auto_voice=False,device="cpu"):
    if not synthetic_auto_voice and (not reference or not transcript):return {'status':'failed','code':'voice_preset_missing'}
    root=pathlib.Path(model_path)
    if not (root/'config.json').is_file() or not (root/'tokenizer_config.json').is_file() or not (root/'audio_tokenizer').is_dir():return {'status':'failed','code':'model_missing'}
    import sys
    with contextlib.redirect_stdout(sys.stderr):
        import numpy as np
        import torch
        from omnivoice import OmniVoice
        start=time.monotonic();model=OmniVoice.from_pretrained(str(root),load_asr=False,device_map=device,dtype=torch.bfloat16 if device=='cuda' else torch.float32)
        load_ms=round((time.monotonic()-start)*1000)
        print(json.dumps({'status':'ready','worker':'tts','loadMs':load_ms}),file=sys.__stdout__,flush=True)
        synthesis_start=time.monotonic()
        options={} if synthetic_auto_voice else {'voice_clone_prompt':model.create_voice_clone_prompt(ref_audio=reference,ref_text=transcript)}
        # Explicit synthetic probe mode never configures the character's voice preset.
        audio=np.asarray(model.generate(text=text,language='ko',num_step=16,**options)[0],dtype=np.float32)
        rate=int(model.sampling_rate)
        if audio.ndim!=1 or not len(audio) or not np.isfinite(audio).all() or len(audio)/rate>20:raise ValueError('invalid_output')
        clipped=int(np.count_nonzero(np.abs(audio)>1));pcm=(np.clip(audio,-1,1)*32767).astype('<i2')
        with wave.open(str(output),'wb')as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(pcm.tobytes())
    return {'status':'completed','sampleRate':rate,'durationMs':round(len(audio)/rate*1000),'elapsedMs':round((time.monotonic()-start)*1000),'loadMs':load_ms,'inferenceMs':round((time.monotonic()-synthesis_start)*1000),'clippedSamples':clipped,'syntheticAutoVoice':synthetic_auto_voice,'voicePresetConfigured':False if synthetic_auto_voice else True,'device':device}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--model',default='');p.add_argument('--reference',default='');p.add_argument('--transcript',default='');p.add_argument('--text',default='힌트 하나만 줄래?');p.add_argument('--output',required=True);p.add_argument('--synthetic-auto-voice',action='store_true');p.add_argument('--device',choices=['cpu','cuda'],default='cpu');a=p.parse_args()
    try:result=synthesize(a.model,a.reference,a.transcript,a.text,a.output,a.synthetic_auto_voice,a.device)
    except ImportError:result={'status':'failed','code':'provider_unavailable'}
    except Exception:result={'status':'failed','code':'invalid_output'}
    print(json.dumps(result,ensure_ascii=False))
