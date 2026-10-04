import json, pathlib
root = pathlib.Path(__file__).resolve().parents[1]
package = json.loads((root/'package.json').read_text(encoding='utf-8-sig'))
package['scripts'].update({
 'test:unit':'vitest run --config vitest.config.ts',
 'test:db':'vitest run --config vitest.integration.config.ts evals/db.test.ts',
 'test:protocol':'vitest run --config vitest.integration.config.ts evals/protocol.test.ts',
 'test:e2e':'playwright test --config playwright.config.ts',
 'db:migrate':'node --experimental-transform-types scripts/db.ts migrate',
 'db:seed':'node --experimental-transform-types scripts/db.ts seed',
 'dev':'node --experimental-transform-types apps/runtime/src/index.ts',
 'dev:ui':'vite --config apps/studio/vite.config.ts --host localhost',
 'build':'vite build --config apps/studio/vite.config.ts',
 'start':'node --experimental-transform-types apps/runtime/src/index.ts',
 'db:setup':'python scripts/setup-local-db.py',
})
(root/'package.json').write_text(json.dumps(package,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
ts=json.loads((root/'tsconfig.json').read_text(encoding='utf-8-sig'))
ts['compilerOptions']['jsx']='react-jsx'
ts['include']=['packages/**/*.ts','scripts/**/*.ts','apps/**/*.ts','apps/**/*.tsx','evals/**/*.ts','*.config.ts']
(root/'tsconfig.json').write_text(json.dumps(ts,indent=2)+'\n',encoding='utf8')
