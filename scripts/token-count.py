"""Offline tokenizer/template count; no model, Torch or remote code load."""
import json,sys,pathlib
try:
    from tokenizers import Tokenizer
    from jinja2.sandbox import ImmutableSandboxedEnvironment
    root=pathlib.Path(sys.argv[1]);tokenizer=Tokenizer.from_file(str(root/'tokenizer.json'))
    data=json.load(sys.stdin)
    if 'messages' in data:
        config=json.loads((root/'tokenizer_config.json').read_text(encoding='utf-8'))
        env=ImmutableSandboxedEnvironment(trim_blocks=True,lstrip_blocks=True,extensions=['jinja2.ext.loopcontrols'])
        def raise_exception(message):raise ValueError(message)
        env.globals['raise_exception']=raise_exception
        env.filters['tojson']=lambda value,**kwargs:json.dumps(value,ensure_ascii=False,**kwargs)
        template_source=config.get('chat_template') or (root/'chat_template.jinja').read_text(encoding='utf-8')
        options=data.get('templateOptions',{})
        if set(options)-{'enable_thinking'}:raise ValueError('unsupported_template_options')
        template=env.from_string(template_source)
        text=template.render(messages=data['messages'],add_generation_prompt=True,tools=None,**{k:v for k,v in config.items() if k.endswith('_token')},**options)
    else:text=data['text']
    print(json.dumps({'tokens':len(tokenizer.encode(text,add_special_tokens=False).ids)}))
except Exception:
    print(json.dumps({'error':'tokenizer_unavailable'}));sys.exit(1)
