# 로컬 캐릭터 작업실 실행

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

DB는 현재 loopback55432에서 실행 중이다. 테스트/스모크 runtime은 종료돼 있다. 다른 Python/Ollama/ZIP 프로세스를 종료하지 않았다. 실제 모델을 로드하지 않아 이번 작업이 내릴 GPU 모델도 없다.

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

quality의 manifest/results는 `validation/runs/jev-*`에 새로 저장한다. 모델·mapping/fixture hash·confidence gate·각 판정·실제 usage·Core 효과·실패를 유지한다. Stage 실행 전 전용 validation DB도 migration 3이 있어야 하며 수동 runtime을 종료해 3001 충돌을 피한다. 실제 Jev 한국어 22/24와 위험 오반영 0, Jev→Qwen→Stage 두 만남 검증은 현재 미실행이다. 앞선 중국어 혼합 대사 문제와 음성·VRM·OBS·성능 gate도 남아 있다.
