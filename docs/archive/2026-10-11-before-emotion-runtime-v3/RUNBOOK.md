# 로컬 캐릭터 작업실 실행

2026-10-11 최신 BUILD: §18.10 grounded-v2 구현·검증 결과는 §18.11입니다. 관련 회귀44/44·실제 J: DB Q03 5/5·타입 PASS. Gemma dev18/24·형식18/24·진단2/4, 집중10/16·형식14/16·금지 사실4로 품질 FAIL입니다. 추론50회·유료0·다운로드0, 새 final/Stage 미실행. 운영 Qwen/Jev 유지, 새 자료는 J:/ai/ai-character-runtime/model-comparison/grounding-v2입니다. 이번 서버와 새 테스트 DB를 종료했고 다음은 AUDIT입니다.

현재 결과 (2026-10-11 §18.8 수정 BUILD): 준비/형식 검사를 분리하고 늦은 완료를 직렬 저장합니다. 기존 Qwen/Jev 운영을 유지합니다. Qwen3.5 dev11/24·형식18/24, Gemma 실험 후보 dev22/24·형식22/24·집중7/8로 미달이며 새 final/Stage를 실행하지 않았습니다. 이번 추론73회·유료0회·다운로드0회, 모델 unload 확인 뒤 이번 Ollama를 종료했고 DB는 시작하지 않았습니다. 최신 수정 실행법은 이 문서 마지막 절, 증거는 J:/ai/ai-character-runtime/model-comparison/repair-20261011/runs/summary.json과 IMPLEMENTATION_PLAN.md §18.9입니다.

> 현재 단계 (2026-10-09): 텍스트 캐릭터 우선. 필수 Jev·기존 Qwen·자막 Stage를 검증하고 TTS/STT·마이크·VRM·OBS는 후속 확장으로 미룬다. 실제 Jev 합성 검증은 누적 USD 1 승인 범위에서 실행하며 공급자 오류 시 중단한다. 아래 과거 준비/실행 기록은 당시 결과이고 최신 상태는 BUILD_HANDOFF.md를 따른다.

2026-10-04 Jev 필수 연결 이후 현재 실행은 아래 추가 절을 따른다. 이전 Qwen 사건 해석 검증은 당시 로컬 비교 증거로 남으며 실제 Jev 성공을 뜻하지 않는다.

현재 구현은 PostgreSQL에 저장되는 텍스트 경로다. 2026-10-04 기존 Ollama/Qwen의 응답을 실제 Chrome Stage에 표시하고 완료 ACK까지 저장하는 경로를 두 합성 만남에서 확인했다. 한국어 대사 품질·음성·VRM·OBS·고정 성능 검증은 완료되지 않았다. `20261003-text-m2-build1`의 합성 provider 결과와 10-04 실제 모델 결과는 별도 증거다.

## 설치한 프로젝트 전용 구성

- Node 22.19.0, pnpm 11.9.0. 새 TS 실행 명령은 `--experimental-transform-types`를 사용한다.
- 공식 EDB PostgreSQL 18.6 portable ZIP을 `runtime-data/tools`에 받았다. server bin/lib/share만 풀었고 시스템 서비스나 PATH를 바꾸지 않았다.
- PostgreSQL: `127.0.0.1:55432`, cluster `runtime-data/postgres`.
- `character_runtime`: 고정 preset/계정/문제만 seed한 실행 DB. `runtime_migrator`가 schema를 소유하고 실행은 소유자 권한 없는 `runtime_app`으로 한다.
- `character_runtime_test`, `character_runtime_restore_test`: 합성 검증 전용. 테스트는 정확한 DB 이름을 검사한 뒤에만 초기화한다. 일반 `DATABASE_URL`을 초기화하지 않는다.
- 연결 설정과 임의 생성한 비밀번호는 `runtime-data/local.env`, `runtime-data/db-credentials.json`에만 있다. 공개하거나 버전 관리하지 않는다. `.env` 및 실행 환경에 명시한 설정을 우선한다.

## 준비와 실행

이 프로젝트 폴더에서 PowerShell로 실행한다.

```powershell
pnpm db:setup
pnpm db:migrate
pnpm db:seed
pnpm diagnose
pnpm build
pnpm start
```

`db:setup`은 이미 준비한 portable ZIP을 사용한다. ZIP이 없으면 자동 다운로드하지 않는다. 서버가 이미 이 cluster에서 실행 중이면 재기동하지 않는다. migration과 seed는 앱 시작과 분리돼 있다. `pnpm start`는 loopback 3001에만 바인딩한다. 터미널에 표시된 일회용 Studio 코드를 `http://127.0.0.1:3001/studio`에 입력한다. 코드는 5분/1회, 교환된 자격은 8시간 유효하다.

작업실에서 새 만남 시작 → 상대 A/B/C 선택 → 입력을 보낸다. 저장 ACK와 관측 상태는 다르다. 입력은 commit이 확인된 뒤에만 지우고, 거절이나 연결 유실이면 문장을 유지한다. 결과가 불명확할 때 `입력 결과 확인`으로 확인하고 자동 재전송하지 않는다.

`Stage 열기`로 별도 자격의 자막 화면을 열고 `출력 선택`을 누른다. 다른 Stage로 전환할 때 기존 Stage의 중지 ACK가 필요하다. 기존 연결을 잃었다고 timeout만으로 새 Stage를 자동 활성화하지 않는다. 현재 UI는 명시적인 `previousStageClosed=true` 전환 확인 UI를 아직 제공하지 않는다. 기존 화면을 닫은 뒤 재연결 절차를 새로 시작한다.

모델이 없으면 입력 원문 저장/관측은 가능하고 의미 효과는 중립 대체 해석으로 저장된다. 오류 코드와 실제 추론 미검증 상태를 표시하며 fixture 대사나 다른 공급자로 대체하지 않는다. 정상 사건 해석은 필수 Jev이며 flags 차단/키 누락/장애는 중립 결과와 명시적 오류로 남는다. 정상 실행 CLI는 합성 provider를 사용하지 않는다.

퍼즐은 등록 문제 세 개만 제공한다. 정답과 비공개 힌트는 브라우저/풀이 prompt에 들어가지 않는다. 처음 풀이와 등록 힌트 사용 이후에는 같은 실행 ID/예산을 이어간다. 실제 해석/풀이 모델이 준비되기 전 활동 기능의 품질을 검증했다고 보지 않는다.

개발 화면이 필요하면 별도 터미널에서 `pnpm dev:ui`를 실행한다. localhost5173에서 API/WS를 loopback3001로 proxy한다. 서버는 `pnpm dev`로 실행하며 기존 DB/Ollama를 무단 재시작하지 않는다.

## 종료와 복구

작업실의 만남 종료는 미완료 활동/참여자/Agenda를 저장하고 출력을 취소한다. 터미널 Ctrl+C는 이 runtime만 닫는다. 재시작 때 남은 active/ending 세션은 interrupted가 되고 미완료 응답은 자동 재생되지 않는다. 저장된 미완료 퍼즐은 직접 재개하거나, 다음 세션에서 참여자를 관측하고 30초/8초 조건을 채운 Agenda로 재개한다.

프로젝트 DB를 멈추거나 다시 시작하는 확인한 명령:

```powershell
& '.\runtime-data\tools\pgsql\bin\pg_ctl.exe' -D '.\runtime-data\postgres' status
& '.\runtime-data\tools\pgsql\bin\pg_ctl.exe' -D '.\runtime-data\postgres' -m fast -w stop
pnpm db:setup
```

2026-10-03 검증 종료 당시 DB는 loopback55432에서 실행 중이었다. 현재 프로세스 생존 여부는 실행 전에 확인한다. 테스트/스모크 runtime은 종료돼 있다. 다른 Python/Ollama/ZIP 프로세스를 종료하지 않았다. 실제 모델을 로드하지 않아 이번 작업이 내릴 GPU 모델도 없다.

## 확인한 검사

```powershell
pnpm typecheck
pnpm test:unit
pnpm test:db
pnpm test:protocol
pnpm build
pnpm test:e2e
python scripts/check-restore.py
node --experimental-transform-types scripts/smoke-runtime.ts
```

현재 결과: 단위 29/29, 실제 PostgreSQL 15/15, HTTP/WS 9/9, 실제 headless Chrome의 합성 provider 텍스트 E2E 1/1 PASS. 정상 provider 설정의 서버 기동/종료 smoke는 liveness와 Studio HTTP200, 비소유자 app 역할을 확인했으며 추론은 실행하지 않았다.

`test:e2e`는 명시적인 `--synthetic-fixtures` 서버를 테스트 DB에서만 띄운다. 일반 runtime fallback이 아니다. 테스트 시작 때 해당 DB의 합성 자료만 초기화한다. 개인 대화나 음성은 사용하지 않았다. 캡처는 `runtime-data/playwright-results`에 있다.

## 백업과 복원

`python scripts/check-restore.py`는 합성 `character_runtime_test`만 custom-format dump해 전용 `character_runtime_restore_test`에 복원한다. 2개 migration, 4개 계정, state CHECK 보존을 실제 확인했다. 이 명령은 운영 경험 DB 백업 명령이 아니다.

운영 DB 백업에는 공식 `pg_dump.exe`를 사용해 명시적으로 선택한 프로젝트 파일에 저장한다. 비밀번호를 명령행에 넣지 않고 연결 자격을 별도로 제공한다. 운영 자료가 생긴 뒤 백업/복원/제거를 할 때는 그 데이터에 대한 명시적 범위를 확인한다. 이전 삭제 전 백업은 격리하고 삭제 요청을 다시 반영하기 전 앱에 연결하지 않는다.

## 실제 모델 준비의 남은 조건

아래 목록은 2026-10-03의 준비 상태 기록이다. 10-04 현재 실행 상태와 재현 명령은 문서 끝의 추가 기록을 따른다.

- Ollama 서버는 현재 접속되지 않는다. 기존 서버를 종료하거나 전역 환경을 바꾸지 않았다. `OLLAMA_NO_CLOUD=1`, `OLLAMA_NUM_PARALLEL=1`을 지정한 소유 서버 환경과 installed local metadata를 확인해야 한다.
- 허용 모델 `qwen2.5:7b`: 약 4.7GB Q4_K_M, 공식 digest `845dbda0ea48`. 다운로드하지 않았다. [공식 모델](https://ollama.com/library/qwen2.5:7b)
- 호환 tokenizer: Qwen2.5-7B-Instruct `tokenizer.json` 7.03MB와 `tokenizer_config.json` 7.31kB. HF 15GB 모델 weights는 필요 없다. `QWEN_TOKENIZER_PATH`, `TOKENIZER_PYTHON`을 설정하고 actual Ollama prompt-token 수와 비교해야 한다. [공식 파일](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct/tree/main)
- STT: 별도 Python 환경의 faster-whisper 및 CTranslate2 `Systran/faster-whisper-small` 약 486MB, CPU/int8/ko. 기존 HF whisper-large-v3-turbo와 포맷이 다르다. 다운로드하거나 모델을 로드하지 않았다. [공식 파일](https://huggingface.co/Systran/faster-whisper-small/tree/main)
- TTS: 기존 OmniVoice Python은 발견됐고 snapshot 메타데이터 후보 두 개다. 실제 snapshot 완전성과 사용자가 선택한 참조 음성/전사문은 미확인. 목소리를 임의 선택하거나 개인 음성 파일을 읽지 않았다.
- P03/P04 최소 probe는 파일 입력 기반이며 마이크를 열지 않는다. 무음/빈 WAV/누락 모델 검사는 실제 STT 품질 검증이 아니다.
- P05 실제 직렬 추론/공존 VRAM/지연 측정과 performance gate FROZEN이 필요하다. 전까지 P16–P19 음성/mic/VRM/OBS production 단계는 시작하지 않는다.

## 알려진 구현/검증 제한

실제 모델 대사/한국어 해석/토큰 오차, 3회 만남의 실제 모델 경험, 음성, OBS, 20분, 오프라인, 필수68개 전체 검증은 NOT_RUN이다. 이번 결과는 텍스트 저장 경로와 대표 M2 불변조건의 구현 증거이며 F01–F25 전체 완료가 아니다.

종료 task의 장기 실행/주기 lease renewal, 5초/30초 재시도 지연, result_ready 별도 crash 회복과 전체 fault/backpressure matrix는 추가 검증/정리가 필요하다. 기억 문구 정정은 canonical facts/참여자를 바꾸지 않으며 대사 모델의 행동 근거에는 canonical facts만 공급한다. 완전한 의미 정정은 유효 validator 근거가 확보된 별도 경로가 필요하다. 목록 API의 cursor pagination과 모든 명령 재시도 경계, 활동 결과와 기존 발화가 겹치는 자동 풀이 경계도 후속 감사 대상이다.

## 2026-10-04 현재 실행과 실제 Stage 검증

프로젝트 DB(55432)와 기존 Qwen을 쓰는 Ollama(11434)는 실행 중이다. 검증용 runtime은 종료했으므로 프로젝트 폴더에서 아래 명령을 실행한다. 모델은 기동 시 준비 검사에서 로드된다.

```powershell
pnpm start
```

[작업실](http://127.0.0.1:3001/studio)에 터미널의 일회용 Studio 코드를 입력한다. 새 만남 시작 → Stage 열기 → 준비된 Stage의 출력 선택 → `안녕. 다시 만났네.` 입력 보내기 순서로 실행한다. 정상 종료는 runtime 터미널에서 Ctrl+C다. Stage는 실제 표시한 자막에 대해 shown/finished를 보고한다. 음성 및 아바타는 아직 연결되지 않는다.

PC 재부팅 후 프로젝트 DB가 내려가 있으면 기존 cluster만 아래처럼 기동한다.

```powershell
& '.\runtime-data\tools\pgsql\bin\pg_ctl.exe' -D '.\runtime-data\postgres' -l '.\runtime-data\postgres.log' -w start
```

Ollama가 내려가 있고 11434에 다른 서버가 없다면 별도 PowerShell 터미널에서 기존 모델 디렉터리를 지정한다. 이미 서버가 있으면 재기동하지 않는다. 다음 설정은 해당 터미널에만 적용되며 다운로드 명령은 없다.

```powershell
$env:OLLAMA_MODELS='J:\AI-Character-Runtime-Local-20261003-P02P04\models\ollama'
$env:OLLAMA_HOST='127.0.0.1:11434'
$env:OLLAMA_NO_CLOUD='1'
$env:OLLAMA_NUM_PARALLEL='1'
$env:OLLAMA_MAX_LOADED_MODELS='1'
& 'C:\Users\ltk90\AppData\Local\Programs\Ollama\ollama.exe' serve
```

`runtime-data/ai-local.json`에 기존 tokenizer/Python/model 경로를 반영했다. 개인 음성과 음성 preset은 설정하지 않았다. 합성 음성·STT 상태 파일은 이전 파일 probe의 근거이며 이번 Stage 음성 검증을 뜻하지 않는다.

실제 모델 텍스트 검증을 재현하려면 수동 runtime을 먼저 Ctrl+C로 종료하고 다음을 실행한다. 전용 `character_runtime_validation` DB의 기존 합성 자료를 보존하며 정상 재시작 복구를 적용한다. 운영 DB는 사용하지 않는다.

```powershell
node --experimental-transform-types evals/real-stage.ts --synthetic-inputs --local-baseline --validation-env 'J:/AI-Character-Runtime-Local-20261003-P02P04/validation.env'
```

기존 Chrome과 Qwen2.5:7b, local-only tokenizer만 사용한다. 두 만남에서 같은 Stage를 재사용하고 화면 캡처, 모든 segment의 표시·완료 ACK와 response completed를 검사한다. 결과는 `runtime-data/stage-validation-20261004/<실행 UTC 시간>/results.json`과 PNG에 저장된다. PASS 범위는 전달 경로다. 첫 실제 응답에는 중국어와 불완전한 한국어가 섞였으므로 대사 품질은 별도 미해결 항목이다. 성능 gate도 UNFROZEN이다.

## 2026-10-04 Jev 필수 연결 실행

정상 실행은 Jev 사건 해석 + 로컬 Qwen 생성이다. migration 0003을 적용하고 build 후 `pnpm start`로 실행한다. 시작은 Qwen 준비 추론을 실행하지만 Jev는 호출하지 않는다. 이번 개발에서 기존 운영 DB에 migration 3을 적용했으며 내용 삭제·초기화는 하지 않았다.

키 입력 파일은 무시되는 `runtime-data/jev.env`다. `TYPESAFE_API_KEY`는 출력하지 않는다. 환경 우선순위는 실행 환경 → `.env` → `runtime-data/jev.env` → `runtime-data/local.env`이며 기존 tokenizer 경로는 `ai-local.json`에서 부족한 값만 보충한다. 이전 APPRAISAL_MODEL=qwen 설정이 남으면 `APPRAISAL_MODEL=jev-1.13.0`으로 정정해야 한다. 정상 런타임에서 해석 대체는 없다.

기본 `LOCAL_ONLY=true`, `ALLOW_PAID_PROVIDERS=false`에서는 Jev가 blocked다. 입력 관측은 저장하되 의미 효과·응답을 성공으로 표시하지 않는다. 키가 존재하더라도 이 flags를 개발자가 임의로 활성화하지 않는다. 실제 Jev 비용·합성 입력 전송 승인과 예산을 받은 뒤에만 운영자가 false/true로 설정한다. flags 활성화만으로 추론 성공을 표시하지 않고 첫 유효 응답 전에는 configured다.

모델 다운로드·음성·개인 자료 없이 검사하려면:

```powershell
node node_modules/vitest/vitest.mjs run --config vitest.config.ts packages/contracts/src/contracts.test.ts packages/adapters/src/adapter.test.ts packages/adapters/src/jev.test.ts
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts evals/db.test.ts evals/coordinator.test.ts evals/protocol.test.ts
node node_modules/@playwright/test/cli.js test --config playwright.config.ts
node --experimental-transform-types evals/jev-quality.ts --validate-fixtures
pnpm diagnose
```

브라우저 검사는 전용 test DB와 `jev-mock` transport 및 생성 fixture로 실제 Chrome 표시/완료 ACK를 확인한다. 실제 Jev/Qwen 품질을 뜻하지 않는다.

실제 Jev 평가는 **승인 이후에만** 다음 도구를 사용한다. `--max-cost-usd`는 사용자가 정한 양수 USD 예산을 필수로 받는다. 아래 `<approved-budget>`를 승인된 숫자로 바꾼다. CLI 인자는 사람의 승인을 대체하지 않는다. usage 기반 가격 추정은 계정 청구나 하드 과금 상한 보장이 아니다. 예산 소진·공급자 오류 시 중단하며 재시도하지 않는다. 첫 묶음은 dev 24 + final 24 + Stage 2, 최대 50회로 한 번씩 실행한다.

```powershell
node --experimental-transform-types evals/jev-quality.ts --synthetic-inputs --allow-jev-api --max-cost-usd <approved-budget> --split dev
# dev 결과 검토 후 mapping/rubric 고정. final을 본 뒤 조정한 결과는 재사용하지 않음.
node --experimental-transform-types evals/jev-quality.ts --synthetic-inputs --allow-jev-api --max-cost-usd <approved-budget> --split final
node --experimental-transform-types evals/real-stage.ts --synthetic-inputs --allow-jev-api --max-cost-usd <approved-budget> --validation-env 'J:/AI-Character-Runtime-Local-20261003-P02P04/validation.env'
```

quality의 manifest/results는 `validation/runs/jev-*`에 새로 저장한다. 모델·mapping/fixture hash·confidence gate·각 판정·실제 usage·Core 효과·실패를 유지한다. Stage 실행 전 전용 validation DB도 migration 3이 있어야 하며 수동 runtime을 종료해 3001 충돌을 피한다. 2026-10-09 Jev dev는 7/24, final은 12번째 응답 파서 오류로 중단됐다. 수정된 v3의 실제 final과 Jev→Qwen→Stage 두 만남은 미검증이다. Qwen 최종 대사는 Codex rubric 검토 12/24로 실패다. 음성·VRM·OBS·성능 gate는 후속 확장이다.

## 텍스트 단계 검증 도구 — 2026-10-09

일반 개발에는 모델을 상주시키지 않는다. 아래 fixture 검사와 DB 재생은 API·Qwen 호출이 없다. DB 재생은 기존 `character_runtime_test`를 초기화하므로 다른 DB 검사와 동시에 실행하지 않는다.

```powershell
node --experimental-transform-types evals/dialogue-quality.ts --validate-fixtures --split dev
node --experimental-transform-types evals/dialogue-quality.ts --validate-fixtures --split final
node --experimental-transform-types evals/jev-replay.ts --synthetic-replay --results validation/runs/text-build-20261009/results.json
```

실제 로컬 대사 평가에는 기존 Ollama/Qwen과 tokenizer가 필요하다. `--split dev`는 개발 세트, `--split final`은 고정 최종 세트다. 이미 확인한 final로 프롬프트를 튜닝한 뒤 같은 세트의 PASS를 최종 성공으로 쓰지 않는다.

```powershell
node --experimental-transform-types evals/dialogue-quality.ts --synthetic-inputs --split dev --validation-env 'J:/AI-Character-Runtime-Local-20261003-P02P04/validation.env'
```

실행기는 24개 출력 원문과 형식 검사 결과를 보존하고 별도의 rubric 검토를 기다린다. 종료 시 자신이 사용한 Qwen을 unload한다. 새 모델 설치·개인 자료·음성은 사용하지 않는다. 실제 Jev는 10-09 공급자 응답 오류 뒤 재중단했으므로, 위 유료 명령들을 일괄 재실행하지 않는다. 키는 저장돼 있지만 존재만으로 재시도 승인을 대신하지 않는다.

## §17 후속 도구 — 2026-10-10

이번 사용자 재개 승인으로 Jev v4 dev/final을 48회 실행했다. 새 final은 16/24로 FAIL이며 Qwen 후보도 거부했다. 새 Stage는 미실행이다. 품질 실패를 지우고 다음 단계를 일괄 실행하지 않는다. 현재 대사 지침은 후속 BUILD 전 것으로 복원됐다.

구조 검사는 모델·DB 호출이 없다.

```powershell
node --experimental-transform-types evals/dialogue-quality.ts --validate-fixtures --split dev --fixture evals/fixtures/dialogue-quality-v2.json
node --experimental-transform-types evals/dialogue-quality.ts --validate-fixtures --split final --fixture evals/fixtures/dialogue-final-v2.json
node --experimental-transform-types evals/jev-quality.ts --validate-fixtures --fixture evals/fixtures/jev-appraisal-v2.json
```

실제 Store 문맥 dev 평가는 기존 Qwen/tokenizer와 `character_runtime_test`가 필요하다. **test DB를 초기화하므로 다른 DB 검사와 동시에 실행하지 않는다.** 준비 appraisal은 모의이며 대사는 실제 Qwen이다.

```powershell
node --experimental-transform-types evals/dialogue-quality.ts --synthetic-inputs --split dev --fixture evals/fixtures/dialogue-quality-v2.json --validation-env 'J:/AI-Character-Runtime-Local-20261003-P02P04/validation.env'
node --experimental-transform-types evals/jev-replay.ts --synthetic-replay --results validation/runs/jev-final-2026-10-10T04-44-09-786Z/results.json
```

기존 세트는 기존 기본 경로와 버전으로 읽는다. dev 파일을 final로 지정하면 `fixture_split_mismatch`로 중단한다. 새로운 Jev run은 fixtures.json을 저장하며 replay는 해당 hash를 확인한다. 과거 run에 snapshot이 없을 때는 기존 fixture hash가 manifest와 일치해야 한다.

Stage 도구의 최신 입력은 합성 계산 질문과 다음 만남 B의 A 경험 질문이다. 준비는 Store의 실제 등록 힌트·정답 사건으로 하며 유료 해석은 실제 두 입력에만 사용한다. 준비된 활동 자체를 실제 모델이 풀었다는 증거는 아니다. 현재 이 경로는 실행 미검증이며 의미 검토와 전송/ACK 결과를 별도 기록한다.

## §17.7 수정 실행 결과와 현재 사용법 — 2026-10-10

Stage 준비는 DB 소유권 확보 뒤 기존 미완료 활동을 검사한다. 남아 있으면 `stage_preparation_requires_no_active_activity`로 중단한다. 기존 활동을 보존하며 DB를 자동 reset하지 않는다. 검증에는 명시적으로 선택한 전용 합성 DB를 사용한다.

구조 검사에는 모델·DB가 필요 없다.

```powershell
node --experimental-transform-types evals/dialogue-quality.ts --validate-fixtures --split dev --fixture evals/fixtures/dialogue-quality-v3.json
node --experimental-transform-types evals/dialogue-quality.ts --validate-fixtures --split final --fixture evals/fixtures/dialogue-final-v3.json
node --experimental-transform-types evals/jev-quality.ts --validate-fixtures --fixture evals/fixtures/jev-appraisal-v3.json
```

실제 Store 문맥 dev 실행은 기존 Ollama/Qwen/tokenizer와 전용 test DB가 필요하며 DB를 reset한다. 다른 DB 검사와 동시에 실행하지 않는다. `--diagnostics`는 동일 계산 입력의 question/clarify를 각각 2회 추가하고 24건 점수와 구분한다. final에서는 이 옵션을 허용하지 않는다.

```powershell
node --experimental-transform-types evals/dialogue-quality.ts --synthetic-inputs --split dev --diagnostics --fixture evals/fixtures/dialogue-quality-v3.json --validation-env 'J:/AI-Character-Runtime-Local-20261003-P02P04/validation.env'
```

기존 실행에서 캡처한 같은 문맥만 비교하려면 `--contexts <results.json>`을 추가한다. 이 모드에서는 DB를 reset하지 않는다. fixture hash/split과 Store provenance가 일치해야 한다. source/config가 다른 모델 결과의 점수를 새 결과로 가져오는 기능은 아니다.

```powershell
node --experimental-transform-types evals/dialogue-quality.ts --synthetic-inputs --split dev --diagnostics --fixture evals/fixtures/dialogue-quality-v3.json --contexts validation/runs/dialogue-2026-10-10T08-29-11-666Z/results.json --validation-env 'J:/AI-Character-Runtime-Local-20261003-P02P04/validation.env'
```

두 명령은 현재 도구 사용법이며 같은 세트를 다시 실행하라는 재검증 권고는 아니다. R2 후보는 거부·복원했고 새 final/Stage는 미실행이다. 실제 Jev v5 dev는 16번째 응답에서 choice/modal 불일치로 중단했다. 기존 공급자 오류 중단 조건을 지켜 유료 재시도하지 않는다. 알려진 누적 비용 추정 USD 0.005818806과 과거 1회 미확인 비용을 구분한다. 새 실제 검증을 재개할 때에는 남은 범위·공급자 오류 조건부터 해결한다.

## §17.9 실패 사용량과 정책 분석 실행법 — 2026-10-10

다음 검사는 외부 API·Ollama·DB 없이 가짜 HTTP 응답과 저장 자료를 사용한다. 기존 integration 설정 이름과 달리 아래 두 테스트 파일은 DB를 열지 않는다.

```powershell
node node_modules/vitest/vitest.mjs run --config vitest.config.ts packages/adapters/src/jev.test.ts packages/adapters/src/adapter.test.ts
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts evals/jev-accounting.test.ts evals/jev-policy-analysis.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
node --experimental-transform-types evals/jev-policy-analysis.ts --results validation/runs/jev-dev-2026-10-10T04-41-59-557Z/results.json
node --experimental-transform-types evals/jev-policy-analysis.ts --results validation/runs/jev-dev-2026-10-10T08-30-00-707Z/results.json
```

policy 도구는 지정한 결과 옆의 manifest.json/fixtures.json hash·split·mappingVersion을 확인한다. v4/v5 통계를 섞지 않는다. v4 dev는 NO_ADOPTION_EVIDENCE(추가 허용 0), v5 부분 dev는 DIAGNOSTIC_BENEFIT(추가 인사 2, 정상 15/기록 16/계획 24)다. 이 상태는 새 모델 정확도 PASS나 production 정책 채택이 아니다. 노출된 과거 final을 지정하면 historical diagnostic으로 표시하며 새 final 증거로 쓰지 않는다.

quality/Stage의 `calls` 또는 `jevCalls`에는 callId·HTTP 상태·usageStatus·검증한 usage·errorCode가 들어간다. `knownInputTokens`/`estimatedKnownCostUsd`는 실패 응답의 확인된 usage도 포함한다. `inputTokens`/`estimatedCostUsd`는 같은 값의 호환 별칭이다. `unknownUsageCalls>0`이면 `costEstimateComplete=false`이며 전체 비용을 확정할 수 없다. `observationFailures`가 있으면 관측 실패를 성공 평가로 집계하지 않는다. 계정 청구액은 확인되지 않았다. DB appraisals의 usage를 다시 더하지 않는다.

clarify 단일 후보는 dev 13/24·형식 23/24·진단 2/4로 거부했고 production Qwen은 실험 전 소스로 복원했다. 실제 대사 28건/readiness 1건, 유료 API 0회다. 새 후보를 만들거나 같은 세트를 자동 재실행하지 않는다. 모델 unload 0개를 확인하고 이번 Ollama를 종료했으며 PostgreSQL/Chrome는 실행하지 않았다. 최종 기록은 validation/runs/clarify-accounting-repair-20261010/다.

## §18 모델 비교 실행과 저장 위치 — 2026-10-11

최신 결과는 IMPLEMENTATION_PLAN.md §18.7 및 `J:/ai/ai-character-runtime/model-comparison/runs/summary.json`이다. Gemma dev PASS/final FAIL, Qwen3.5 dev 미실행이다. 이 절의 명령은 재현용이며, 소진된 final-v3를 다시 acceptance로 채점하지 않는다.

저장 구조:

- `models/`: Ollama 모델. 기존 Qwen blob hardlink와 신규 Gemma/Qwen3.5.
- `tokenizers/gemma4`, `tokenizers/qwen35`: 공식 tokenizer와 template, 출처 revision.
- `runs/`: 요청·원문·manifest·review·비교 요약.
- `logs/`, `tmp/`: 로그와 임시 파일. GPU CSV는 장치 전체1초 샘플이다.
- `postgres-final/`: 합성 final 검증 DB 데이터. 현재 종료 상태.
- `comparison.env`: 새 검증 DB 접속 설정. 비밀번호가 있어 출력·커밋하지 않는다.
- `baseline-source/`: 이번 수정 전 소스 사본.

저장소 루트에서 로컬 Ollama를 다시 띄울 때는 모든 경로를 먼저 지정한다. 기존11434 서버가 있으면 그 소유/저장 위치를 확인하고 중복 시작하지 않는다. 기존 모델 설치 폴더나 일반 runtime 설정은 바꾸지 않는다.

```powershell
$comparisonRoot = 'J:\ai\ai-character-runtime\model-comparison'
$env:OLLAMA_MODELS = Join-Path $comparisonRoot 'models'
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_NO_CLOUD = '1'
$env:OLLAMA_NUM_PARALLEL = '1'
$env:OLLAMA_MAX_LOADED_MODELS = '1'
$env:TEMP = Join-Path $comparisonRoot 'tmp'
$env:TMP = $env:TEMP
$env:HF_HOME = Join-Path $comparisonRoot 'tmp\huggingface'
$env:PYTHONDONTWRITEBYTECODE = '1'
$comparisonServer = Start-Process -FilePath 'C:\Users\ltk90\AppData\Local\Programs\Ollama\ollama.exe' -ArgumentList 'serve' -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $comparisonRoot 'logs\ollama-out.log') -RedirectStandardError (Join-Path $comparisonRoot 'logs\ollama-error.log')
```

Gemma dev 재현은 고정된 과거 Store 문맥을 읽으므로 DB를 시작하지 않는다. 출력 폴더는 평가 모델을 지정할 때 필수다.

```powershell
node --experimental-transform-types evals/dialogue-quality.ts --synthetic-inputs --model gemma4:12b-it-qat --tokenizer-path J:/ai/ai-character-runtime/model-comparison/tokenizers/gemma4 --output-root J:/ai/ai-character-runtime/model-comparison/runs --split dev --diagnostics --fixture evals/fixtures/dialogue-quality-v3.json --contexts validation/runs/dialogue-2026-10-10T08-29-11-666Z/results.json --validation-env J:/ai/ai-character-runtime/model-comparison/comparison.env
```

Qwen 기준선은 model을 `qwen2.5:7b`, tokenizer-path를 `J:/AI-Character-Runtime-Local-20261003-P02P04/models/qwen-tokenizer`로 바꾼다. Qwen3.5는 model `qwen3.5:9b-q4_K_M`, tokenizer-path `J:/ai/ai-character-runtime/model-comparison/tokenizers/qwen35`지만 현재 준비 형식 실패가 재현돼 있다. 이를 곧바로 정상 비교 명령이라고 간주하지 않는다. 새 평가 실행 자체가 유료 Jev를 사용하지 않는다.

각 평가기는 자신의 모델 unload를 시도하고 실패를 결과에 기록한다. `/api/ps`에 로드 모델0을 확인한 뒤 자신이 시작한 `$comparisonServer`만 종료한다. 테스트는 `--no-cache`와 위 TEMP/TMP 설정으로 실행하고 로그를 J:로 리다이렉트한다. DB 재시작이 필요한 후속 검증은 `postgres-final`·loopback55433을 사용하며, pg_ctl의 Start-Process에는 -Wait를 쓰지 않고 반환된 프로세스의 WaitForExit()로 pg_ctl 자체만 기다린다.

## §18.8 평가기 감사 수정 실행 — 2026-10-11

최신 결과는 IMPLEMENTATION_PLAN.md §18.9와 `J:/ai/ai-character-runtime/model-comparison/repair-20261011/runs/summary.json`이다. §18의 이전 Qwen3.5 준비 실패는 수정 전 기록이다. 지금은 기술 준비를 통과하고 본 대화 품질을 평가한다. 운영 기본 모델/프롬프트는 기존 Qwen이다.

§18에 있는 J: OLLAMA_MODELS/TEMP/TMP/HF_HOME 및 loopback 설정으로 Ollama를 시작하고 `/api/version`과 `/api/tags` 응답을 확인한 뒤 평가를 실행한다. 준비 중 서버 확인 실패를 실제 추론 실패로 집계하지 않는다. 모든 출력 루트는 아래 J: repair 경로를 명시한다.

```powershell
node --experimental-transform-types evals/dialogue-quality.ts --synthetic-inputs --model qwen3.5:9b-q4_K_M --tokenizer-path J:/ai/ai-character-runtime/model-comparison/tokenizers/qwen35 --output-root J:/ai/ai-character-runtime/model-comparison/repair-20261011/runs --split dev --diagnostics --fixture evals/fixtures/dialogue-quality-v3.json --contexts validation/runs/dialogue-2026-10-10T08-29-11-666Z/results.json --validation-env J:/ai/ai-character-runtime/model-comparison/comparison.env
```

Gemma 실험 후보 재현은 model을 gemma4:12b-it-qat, tokenizer-path를 tokenizers/gemma4로 바꾸고 `--evidence-prompt`를 추가한다. 이 후보는 dev/집중 기준 미달이며 운영 권장 설정이 아니다. 기존 동일 dev28건을 실행한다. `repair-20261011/focused-probe.mjs`는 과거 소진 final의 회귀 진단8건을 실행하는 승인된 합성 전용 도구다. 진단 결과를 새 acceptance로 표시하지 않는다.

새 `repair-20261011/fixtures/dialogue-final-v4.json`은 이번에 실행하지 않았다. dev/진단/금지 사실 기준을 충족한 후보가 나온 뒤 별도의 실행 범위에서 사용한다. 기존 final-v3는 소진된 자료다.

```powershell
node node_modules/vitest/vitest.mjs run --config vitest.config.ts --no-cache packages/adapters/src/adapter.test.ts
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts --no-cache evals/dialogue-models.test.ts evals/dialogue-recording.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

위 검사는 저장소 루트에서 실행한다. TEMP/TMP를 §18의 J: tmp로 지정하고 stdout/stderr도 J: logs로 저장한다. 기록 회귀 검사는 J: tmp를 직접 사용한다. 평가 결과의 requestCount와 완료 calls를 구분하고 physicalCompletionPending/unloadError를 확인한다. timeout 이후 늦은 완료 관측도 결과를 저장하지만 평가 FAIL을 PASS로 바꾸지 않는다. 모델 서버는 로드 모델0을 확인한 뒤 자신이 시작한 PID만 종료한다.

## §18.10 grounded-v2 실행과 결과 — 2026-10-11

결과는 IMPLEMENTATION_PLAN.md §18.11 및 J:/ai/ai-character-runtime/model-comparison/grounding-v2/runs/summary.json이다. 후보는 dev/집중 기준 미달이며 운영 설정이 아니다. --evidence-prompt는 기존 v1, --prompt-variant grounded-v2는 이번 후보이며 동시 사용을 거부한다. 새 final-v4는 실행하지 않았다.

모든 TEMP/TMP/HF cache와 출력은 J:를 사용한다. 기존 §18 Ollama 시작 설정을 쓰되 로그·임시 경로는 grounding-v2 아래로 지정한다. 기존 모델 store와 tokenizer는 model-comparison 아래 것을 재사용한다. 아래는 소진 dev와 회귀 진단의 **재현 명령**이며 새 acceptance나 자동 재실행 지시가 아니다.

~~~powershell
node --experimental-transform-types evals/dialogue-quality.ts --synthetic-inputs --model gemma4:12b-it-qat --prompt-variant grounded-v2 --tokenizer-path J:/ai/ai-character-runtime/model-comparison/tokenizers/gemma4 --output-root J:/ai/ai-character-runtime/model-comparison/grounding-v2/runs --split dev --diagnostics --fixture evals/fixtures/dialogue-quality-v3.json --contexts validation/runs/dialogue-2026-10-10T08-29-11-666Z/results.json --validation-env J:/ai/ai-character-runtime/model-comparison/grounding-v2/test.env
node --experimental-transform-types J:/ai/ai-character-runtime/model-comparison/grounding-v2/focused-probe.mjs
~~~

이번 DB 검증은 grounding-v2/postgres, loopback55434, character_runtime_test였다. 현재 종료 상태이며 재시작 시 data_directory와 DB 이름을 검증한다. test.env의 비밀번호를 출력하지 않는다. 아래 Q03 검사는 해당 합성 전용 DB 데이터를 reset하므로 과거 postgres-final에 연결하지 않는다. 새 Stage/실제 Jev 품질 검증을 대신하지 않는다.

~~~powershell
node --env-file=J:/ai/ai-character-runtime/model-comparison/grounding-v2/test.env node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts --no-cache evals/db.test.ts -t Q03
~~~

unit/model/recording 검사 명령은 앞 절과 같으며 로그와 cache는 J:로 보낸다. 실행된 대사44+준비6=50회가 모두 물리 완료·token 차이0이었다. 실패 후보라 운영 전환이나 새 final은 수행하지 않았다.
