# 2026-10-03 구현 인계

현재 인계 (2026-10-04): **jev-required-v1 BUILD 완료 → AUDIT 대기.** 아래 10-03 기록과 앞선 10-04 Qwen 비교 검증은 각각 원래 환경의 증거다. Jev 필수 연결의 최신 결과는 이 파일 마지막 절을 따른다. 실제 Jev 비용·전송 승인과 예산은 아직 없으며 키만 설정됐다.

단계: BUILD → 부모의 AUDIT. 사용자 승인 범위의 코드를 대상 폴더에 적용했고 Git 저장소/commit/upload는 만들지 않았다. 기존 기획/PROPOSED affective 연구안을 구현 원본으로 대체하지 않았다.

전체 MVP 판정은 **BLOCKED**. 성능 gate는 **UNFROZEN**. 완료 증거가 있는 것은 실제 PostgreSQL에 연결한 텍스트 경로와 대표 M2 불변조건이다. 합성 provider 결과를 실제 Qwen/음성 품질로 표시하지 않는다.

## 변경 묶음

- `packages/contracts/src/domain.ts`: 해석/상태/plan/worker 이전 텍스트 wire 계약과 엄격한 payload 검증.
- `packages/character-core/src/index.ts`: 감정/기분/hold/반복 상한/표현 hysteresis/주의 공정성/한국 날짜별 관계 재집계/Agenda 발화 조건.
- `packages/database/migrations/0001_m1.sql`, `0002_m2.sql`: 23개 계약 테이블, composite FK, UNIQUE/부분 index/CHECK. migrations는 직접 검토한 SQL이며 Drizzle schema mapping은 조회 컬럼에 대한 별도 코드다. Drizzle 생성 migration이라고 주장하지 않는다.
- `packages/database/src`: pg+Drizzle 접속, migration checksum, 고정 seed, 원본/선택/해석 단계 사건, 원자적 상태·근거·계획 commit, 퍼즐/독립 help source group, 기억/tombstone/lease/Agenda/삭제/재시작.
- `packages/adapters/src`: pinned loopback Ollama 구조화/스트림/후보/토큰 예산, private 퍼즐 검증기. `scripts/token-count.py`: local-only 실제 chat-template tokenizer 경로. 실제 모델 호출은 미실행.
- `apps/runtime/src`: mailbox coordinator, local pairing/auth, exact Origin/role/strict envelope, text snapshot/ACK/단일 출력 소유권/중지 ACK 전환, cancel barrier/stale fencing.
- `apps/studio`: React/Vite 작업실과 자막 Stage. 입력 commit ACK/복구, activity/state/action/기억/삭제, Stage 선택, 한국어 오류/준비 표시, 반응형 화면.
- `workers/tts/synthesize_probe.py`, `workers/stt/transcribe_probe.py`: P03/P04 최소 파일 기반 실험 경로. production worker/mic 경로가 아니다.
- `fixtures/puzzles/problems.json`: 비공개 validator를 포함한 서버 fixture 3개. 브라우저와 후보 모델에는 explicit public DTO만 보낸다.
- `evals`, package scripts/config, `scripts`, `RUNBOOK.md`: 전용 DB/프로토콜/브라우저 검증과 local lifecycle.

## 확인 결과

| 기준 | 실제 명령/범위 | 결과 |
|---|---|---|
| 타입 | `pnpm typecheck` | PASS |
| 순수 도메인/계약/adapter/합성 WAV | `pnpm test:unit` | PASS 29/29 |
| 실제 PG transaction/duplicates/rollback/FK/restart/evidence/memory/Agenda/lease/stale | `pnpm test:db` | PASS 15/15 |
| 실제 HTTP/WS 역할/Origin/sequence/소유권 경합/텍스트 delivery | `pnpm test:protocol` | PASS 9/9 |
| React/Vite production | `pnpm build` | PASS |
| 실제 Chrome, 합성 provider 입력→PG→Stage 자막 | `pnpm test:e2e` | PASS 1/1 |
| 합성 fixture dump→별도 restore DB | `python scripts/check-restore.py` | PASS: 2migrations/4identities/stateCHECK |
| 정상 real-provider 설정 startup/shutdown, 추론 없음 | `node --experimental-transform-types scripts/smoke-runtime.ts` | PASS: loopback3001, health/Studio200, app role 비소유자 |
| 실제 모델/음성/VRAM/고정 성능 | 실행하지 않음 | BLOCKED/NOT VERIFIED |

처음 실패한 Node strip-only parameter-property 실행, pg JSON 배열 직렬화, Fastify BigInt serialization, 브라우저 safe GET Origin 경계, 테스트 종료 background/DB 경합은 수정 후 관련 검사를 통과했다. 이를 모델 실패/성능 결과로 합치지 않았다.

데스크톱/모바일/Stage 캡처는 `runtime-data/playwright-results/studio-desktop.png`, `studio-mobile.png`, `stage-text.png`. 실제 이미지 세 장을 열어 확인했다. 원문은 승인된 합성 fixture다. `validation/runs/20261003-text-m2-build1`에는 source hash/기준별 요약을 기록한다. 이는 모든68개 검사 실행 결과가 아니다.

## 작업 상태

| 작업 | 상태 | 근거/제한 |
|---|---|---|
| P00/P01 | DONE | 기존 기반 유지, 진단은 local DB/text build 상태를 갱신 |
| P02 | BLOCKED | adapter/token counter 코드와 오류 검사 구현. 실제 Qwen/tokenizer/서버 없음 |
| P03 | BLOCKED | 기존 OmniVoice 사용 probe. 참조 음성/전사문 선택 및 actual synth 없음 |
| P04 | BLOCKED | offline CPU/int8 probe. 실제 전용 환경/CTranslate2 모델/한국어 전사 없음 |
| P05 | BLOCKED | 실제 resource pilot 미실행, gate UNFROZEN |
| P06 | DONE | 실제 PG migration/seed/idempotence/rollback/constraints/dump restore, app/migration 역할 분리 |
| P07 | IN_PROGRESS | 대표 결정적 Core 규칙 PASS. 전체 도메인/행동 우선순위/표현 경계 검증까지 완료라 하지 않음 |
| P08–P10 | IN_PROGRESS | 실제 DB/HTTP/WS/브라우저 text 경로 PASS, 실제 모델 시연/전체 프로토콜 matrix 남음 |
| P11–P15 | IN_PROGRESS | 퍼즐·관계·기억·Agenda·삭제 대표 경로 구현/PASS. 전체 검증 ID/자동 활동·정정/lease 경계 남음 |
| P16–P19 | NOT_STARTED | P05 미완료라 M3 착수 금지 유지 |
| P20 | BLOCKED | 실제 모델/음성/VRM/OBS/3session/20min/offline/전체68 검사 없음 |
| P21 | IN_PROGRESS | 현재 실제 실행/종료/테스트 복원 문서. 최종 voice/OBS/운영백업 검증은 아직 없음 |

## 명세와 다른 점 및 알려진 제한

브라우저의 same-origin GET fetch는 Origin을 생략하므로 GET만 **Origin이 없고 Sec-Fetch-Site=same-origin이며 Referer의 origin이 정확한 allowlist**일 때 허용한다. 인증은 여전히 필수이고 mutation/WS는 exact Origin 그대로다. hostile/missing Referer/cross-site 거부 검사를 추가했다. RUNTIME_PROTOCOL에도 이 결정이 반영된다.

새 TS 명령은 Node22 `--experimental-transform-types`가 필요하다. 기존 diagnose의 strip-only 코드는 변환 불필요한 소스를 사용한다. React/Vite/Fastify/pg/Drizzle/ws 및 types/Playwright는 프로젝트에만 설치했고 lockfile을 갱신했다. 공식 PG ZIP은 약385MB, server 부분 약148MB를 프로젝트에만 풀었다.

RUNBOOK의 알려진 제한을 감사한다. 특히 완전한 domain behavior selector, 모든 HTTP 재시도/목록 cursor, 활동 결과와 기존 발화/자동 다음 풀이 경합, task의 장기 lease renewal/retry/crash matrix는 아직 전체 완료가 아니다. full MVP나 실제 H3 품질 PASS를 선언하지 않는다.

필요한 자원은 Qwen2.5:7b 4.7GB, 호환 tokenizer 약7MB, faster-whisper-small CTranslate2 약486MB와 전용 Python 환경, 선택한 OmniVoice snapshot/참조 음성·전사문, 이후 VRM/OBS다. 이번 작업은 모델을 새로 다운로드하거나 개인 대화/기억/목소리 파일을 읽거나 mic/camera를 열지 않았다. root가 정확한 자원 필요를 사용자에게 전달한다.

PostgreSQL은 프로젝트 cluster loopback55432에 남아 있고, runtime/test 서버와 브라우저는 종료됐다. GPU 모델은 로드하지 않았다. 전체 기획을 완료로 만들려고 gate를 완화하지 않았다. 다음 동작은 부모 AUDIT이며, 실제 자원 준비 뒤 P02–P05 검증 및 남은 독립 구현 경계 수정을 이어간다.

## 2026-10-04 실제 모델 → Stage 재개 결과

이번 사용자 승인 범위는 미적용 Prompt v2 4개, Local config 2개, Stage 연결에 필요한 최소 수정과 기존 로컬 모델·합성 입력 검증이다. 위의 2026-10-03 결과는 당시 기록으로 유지한다.

- 두 manifest의 원본·준비본 SHA256을 모두 비교한 뒤 Prompt v2 4개를 적용하고 `runtime-data/ai-local.json`, `runtime-data/local-probe-status.json`을 생성했다. 기존 Readiness 5개는 적용 해시와 일치했으며 재적용하지 않았다. Ollama 소스에는 그 위에 Prompt v2 변경만 반영했다.
- Prompt v2는 발화자와 대화 상대, 해석 target의 의미를 전달한다. DB에는 provider의 실제 `appraisalPromptVersion`을 저장하며 이전 provider는 `appraisal-v1` 기본값을 유지한다. schema/migration 변경은 없다.
- UI를 다시 빌드했다. 현재 Stage 소스는 실제 검증에서 정상 작동해 추가 수정하지 않았다.
- `evals/real-stage.ts`는 명시적 `--synthetic-inputs`와 전용 검증 DB만 허용하며, 기존 자료를 초기화하지 않는다. 일반 재시작 복구 후 두 합성 만남을 만들고 같은 Stage에서 실제 Ollama 응답·브라우저 표시·모든 segment의 shown/finished ACK·response completed를 확인한다. 개인 파일·음성·마이크는 사용하지 않는다.

이번 집중 검사:

| 검사 | 실제 결과와 범위 |
|---|---|
| `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | PASS: 현재 소스와 실제 Stage 검증 스크립트 |
| `node node_modules/vitest/vitest.mjs run --config vitest.config.ts packages/adapters/src/adapter.test.ts` | PASS 10/10: 구조화 결과·인용 target·deadline/transport fencing |
| `node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts evals/db.test.ts evals/protocol.test.ts` | PASS 28/28: 실제 PG와 HTTP/WS, 합성 provider 사용 |
| `node node_modules/vite/bin/vite.js build --config apps/studio/vite.config.ts` | PASS |
| `evals/real-stage.ts --synthetic-inputs --validation-env .../validation.env` | PASS: 실제 Chrome, 기존 Qwen2.5:7b, 합성 입력 두 만남, 같은 Stage 재사용, 총 3 segments 표시/완료 ACK와 두 responses completed |
| 일반 `pnpm start` | PASS: 전용 `character_runtime_validation` DB 환경에서 기동, live/Studio HTTP200, 실제 모델 `ready`와 inferenceVerified=true |

실제 모델 run은 `runtime-data/stage-validation-20261004/2026-10-04T05-05-20-279Z/results.json`, 화면은 같은 폴더의 `stage-1.png`, `stage-2.png`, `studio.png`다. 두 Stage 이미지를 직접 열어 확인했다. CLI 기동 결과는 `runtime-data/stage-validation-20261004/cli-results.json`이다. 최초 preflight 실패 기록은 기존 합성 세션이 active였기 때문이며, 전용 DB에서 정상 재시작 복구를 적용한 후 실행했다. 기존 10-03 실패 기록도 보존했다.

첫 입력 `잘했어. 네 풀이가 정말 좋았어.`는 v2에서 target=activity/act=praise로 분류되어 응답이 생성됐다. 첫 표시까지 4,473ms, 두 번째 인사 입력은 4,456ms였다. 이는 각 입력 한 번의 브라우저 관측이며 성능 gate 통과를 뜻하지 않는다. 모든 실제 호출은 물리적 완료가 확인됐고 해당 호출의 tokenizer/Ollama prompt token 차이는 0이었다.

**대사 품질 제한:** 첫 응답은 불완전한 한국어 문장과 중국어 문장이 섞여 있었다. 두 번째 응답은 `안녕, 오늘도 퍼즐을 찾으러 가볼까?`였다. 이번 PASS는 Stage 전달 경로만 증명하며, 한국어 품질·대상 분류 정확도·사실 보존을 보증하지 않는다. 성능 gate는 UNFROZEN이며 전체 MVP/P02 품질을 DONE으로 바꾸지 않는다. 음성·VRM·OBS는 이번 검증 범위 밖이다.

검증 runtime/Chrome은 종료했다. 프로젝트 DB loopback55432와 이번에 시작한 Ollama loopback11434는 다음 수동 실행을 위해 유지한다. Ollama는 기존 `J:/AI-Character-Runtime-Local-20261003-P02P04/models/ollama`만 사용하고 NO_CLOUD=1, NUM_PARALLEL=1이다. 모델 다운로드·설치 변경·유료 호출은 없었다.

## 2026-10-04 Jev 필수 연결 BUILD 결과

계획: IMPLEMENTATION_PLAN.md §14 `jev-required-v1`. 사용자가 PLAN 이후 개발을 승인했다. 개발/로컬 검증은 완료했으며 AUDIT은 실행하지 않았다. 실제 Jev를 Qwen 해석으로 대체하지 않는다. 전체 MVP는 여전히 미완료다.

변경 묶음:

- contracts/AppraisalEvaluation·Metadata와 adapter/AppraisalProvider·JevAppraisalProvider 추가. endpoint/model 고정, 공개 state allowlist, 5 typed 질문·분포·legend·평균 검증, 유일 최빈 Score 등급, confidence 0.80 gate, timeout/본문 상한/redirect 거부/오류 코드/재시도 없음.
- 정상 Coordinator와 createServer에 별도 필수 appraiser를 주입하고 생성 모델은 DIALOGUE_MODEL을 사용한다. runtime은 Jev만 주입한다. Ollama.appraise는 명시적 `--local-baseline` 비교만 남겼으며 Ollama 소스 해시는 계획 기준선과 동일하다. domain/Appraisal와 Core 계산식·Stage 메시지도 유지했다.
- 0003 additive migration과 Store metadata 저장·원본 삭제 정리, migration 개수 소비자 및 복원 검사 수정. 기존 0001/0002는 변경하지 않았다. test/운영/validation DB를 3으로 업그레이드했다. 운영/validation 자료를 초기화하지 않았다.
- 설정·진단·HTTP/Studio는 Jev 해석과 Qwen 생성을 분리한다. 키를 보관하는 무시 경로 `runtime-data/jev.env`를 추가했고 사용자 입력 후 존재만 확인했다. LOCAL_ONLY=true/ALLOW_PAID_PROVIDERS=false 그대로이며 키는 로그/결과물에 복사하지 않았다.
- helpers와 test-server는 명시적 jev-mock transport로 실제 parser를 실행한다. browser 검사는 실제 Chrome 표시와 PG shown/finished ACK·completed까지 확인한다. fixture 생성 대사와 실제 Jev/Qwen 품질을 구분한다.
- 합성 fixture 48건(12범주별 dev 2/final 2), jev-quality 실행기, real-stage Jev 기본 경로/명시적 로컬 비교와 source hash 기록 추가. 실호출 도구는 합성/API flags·허용 설정·키·양수 예산을 요구한다. 실제 평가는 한 번씩 최대 24+24+2회, 실패 시 중단하며 재시도하지 않는다. 가격 추정은 계정 청구나 강제 과금 상한이 아니다.
- MVP/기술/AI/검증/DB/통신/README/RUNBOOK의 직접 관련 계약을 Jev 필수로 정정했다. 원래 날짜의 실행 기록은 보존했다.

| 기준 | 실제 검사·결과 | 검증 범위 |
|---|---|---|
| JR01 | 관련 명세/실행 문서 정정 완료 | 코드 경로·비용 예외·미검증 경계 일치 |
| JR02/JR03 | 계약·Ollama·Jev unit **47/47 PASS** | 차단 시 fetch 0, 전송 allowlist, fractional mode/0.80/tie/unknown/malformed/HTTP/timeout/상한; 실제 원격 추론 아님 |
| JR04/JR05/JR06 | 실제 PG db/coordinator/protocol **41/41 PASS** | 전용 test DB, separate appraiser·중립/uncertain의 0 효과, metadata 저장/삭제/재시작, 중복·늦은 세션종료/삭제/epoch 결과 차단 |
| JR02 추가 | startup 이전 spy로 보강한 protocol **10/10 PASS** | 시작·health 3회 동안 evaluate 0, readiness 구분 |
| JR07 | 기존 Chrome browser **1/1 PASS**, 정상 종료 9.5s 실행기 기록 | Jev 모의 transport + 생성 fixture, 자막·shown/finished·completed, metadata·모바일 표시 확인 |
| JR05 복원 | pg_dump/pg_restore **PASS** | 전용 restore_test DB, migrations=3, Jev metadata 1행의 digest 원본과 일치 |
| 공통 | TypeScript·Vite build PASS | 추가 의존성 설치 없음 |
| 준비 | 정상 startup/shutdown smoke PASS | loopback3001, live/Studio200, app role 비소유자. 기존 Qwen 준비 추론 ready; Jev blocked·추론 미검증 |
| 도구 | diagnose PASS, fixture 구조 48/24/24 PASS, API 인자 없는 quality/stage는 명시적 오류 종료 | 진단 Jev API 0회, CLI 거절은 기대 결과 |
| JR08 | **BLOCKED / NOT RUN** | 실제 Jev 비용·합성 입력 전송 승인 및 예산 없음. 키는 존재. 실제 한국어 품질 22/24·위험 오반영 0과 Jev→Qwen→Stage는 미검증 |

실행 명령은 RUNBOOK 마지막 절을 따른다. 첫 browser 실행은 테스트 자체 PASS 후 sandbox의 종료 정리에서 대기했다. 확인한 작업 소유 test-server만 종료해 CLI exit 0을 얻었고, ACK 보강 후 권한 있는 실행에서는 자동 정리까지 exit 0/1 passed였다. 다른 서비스를 종료하지 않았다. diagnose는 strip-only가 runtime 타입 재수출을 따라 parameter property를 읽는 오류를 재현한 뒤 설정 모듈 직접 import로 고쳐 같은 명령을 통과했다. 이는 구현 계획의 작은 소비자 조정이다.

종료 상태: 개발/검증 runtime·Chrome 종료, PG/Ollama 서비스 유지, 이번 smoke가 로드한 Qwen은 unload 후 loadedModels=[] 확인. 새 모델 다운로드·유료 호출·개인 파일/음성·마이크 사용 없음. 검증 기록과 소스 manifest는 `validation/runs/jev-required-build-20261004/`에 저장한다.

다음은 사용자가 요청하면 AUDIT이다. 실제 Jev 평가는 별도 비용·전송 승인과 예산 후 JR08로 수행한다. confidence 0.80은 검증 전 초기 정책이며 앞선 중국어 혼합 대사, 음성·VRM·OBS·전체 MVP·성능 gate는 해결됐다고 주장하지 않는다.

## 2026-10-04 4e608b4 감사 지적 수정 — 라운드 1

사용자 제공 정적 지적 6건을 실행 재현한 뒤 수정했다. 기준선 HEAD는 4e608b43d0d8df966bdf4624a95891559f162c6e이며 현재 결과는 이 HEAD 위의 미커밋 변경이다. BUILD 완료로 AUDIT을 제안하는 상태다. 감사 승인·GitHub 반영을 주장하지 않는다.

| 기준 | 수정 전 실제 재현 | 수정 후 실제 확인 |
|---|---|---|
| AR01 기억 변경 뒤 출력 | Chrome에서 정정 후 fixture 자막이 빈 문자열로 남아 실패 | snapshot으로 generation을 갱신하고 취소된 frame/timer를 playback version으로 차단. idle 정정 후 자막, 진행 중 삭제 후 즉시 제거, 지연 렌더 콜백 해제 후 새 응답과 다음 입력 completed PASS |
| AR02 Stage 재연결 | WS에서 output.granted를 받지 못해 실패 | 같은 인증 Stage ready에서 disconnect 취소 후 새 outputEpoch 부여. WS와 실제 Chrome 재연결·새 자막 완료 PASS. 다른 Stage의 무확인 takeover 거절과 정상 release ACK 전환은 기존 protocol 검사 PASS |
| AR03 과거 정답 삭제 | PostgreSQL 23505 activity_runs_one_open_uq로 삭제 rollback | 이전 닫힌 활동의 정답 근거가 사라지면 ended. 삭제 commit·새 열린 활동 보존 PASS |
| AR04 같은 날 새 관측 | 새 유효 관측 후 first_observed status가 invalidated로 남아 실패 | 새 출처로 기존 일일 evidence 재활성화. evidence 1개·친숙함 0.02·interaction_days 1 PASS |
| AR05 정정 문구 전달 | responseContext에 content/content_version 누락 | 현재 version의 active 기억 content/version/facts 전달. DB에서 만든 context를 모의 Ollama 요청 JSON까지 확인하고 삭제 기억 제외 PASS |
| AR06 문장 분리 | 안녕.반가워. 앞 문장 누락, 3.14 분리, 공백 없는 3문장 상한 누락 | 문장 전체·소수점·연속 구두점 보존, 문장/120자 상한·빈 출력 거부 PASS |

직접 수정: apps/studio/src/main.tsx, apps/runtime/src/http/server.ts, packages/database/src/store.ts, packages/adapters/src/ollama.ts. 브라우저 재현에서 발견한 직접 소비자 문제도 apps/studio/src/wire.ts에 수정했다. body 없는 DELETE의 application/json 헤더 때문에 Fastify가 요청을 거부했으며, body가 있을 때만 Content-Type을 붙인 뒤 실제 UI 기억 삭제 버튼으로 통과했다. schema/migration·Jev mapping·Core 계산식은 변경하지 않았다. 관련 계약 문서는 RUNTIME_PROTOCOL.md·DATABASE_SPEC.md·LOCAL_AI_INTEGRATION.md에 반영했다.

실행 환경: 기존 loopback PostgreSQL의 전용 character_runtime_test, 기존 Chrome, jev-mock transport와 생성 fixture. DB/browser reset은 서로 겹치지 않게 실행했다. 실제 Jev·Qwen 추론, 새 모델/의존성 다운로드, 개인 자료·음성·마이크 사용은 하지 않았다.

| 실행 명령 | 최종 결과 |
|---|---|
| node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts evals/db.test.ts evals/protocol.test.ts evals/coordinator.test.ts | **45/45 PASS**, 3 files, 10.23s 실행기 기록 |
| node node_modules/vitest/vitest.mjs run --config vitest.config.ts packages/adapters/src/adapter.test.ts | **15/15 PASS** |
| node node_modules/@playwright/test/cli.js test --config playwright.config.ts | **3/3 PASS**, 40.0s 실행기 기록·정상 종료 |
| node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json | **PASS**, exit 0 |
| node node_modules/vite/bin/vite.js build --config apps/studio/vite.config.ts | **PASS**, exit 0 |

집중 FAIL 재현 후 전체 관련 묶음을 확인했다. 중간 검사에서 잘못된 삭제 버튼 이름으로 발생한 timeout과 삭제 뒤 relationships 행이 반드시 있다고 가정한 assertion은 검사 코드 문제로 정정했다. 실패로 worker가 재시작된 뒤 소비된 pairing code를 다시 사용하는 실패도 독립 fresh 실행과 최종 3-test 연속 실행으로 구분했다. 이 실패들을 제품 수정 근거로 세지 않았다.

현재 build는 갱신됐다. 수동 실행은 프로젝트 폴더에서 pnpm start 후 Studio 페어링 → 새 만남 → Stage 열기 → 출력 선택 순서다. LOCAL_ONLY=true/ALLOW_PAID_PROVIDERS=false 기본값은 유지했으므로 정상 앱의 Jev 의미 해석·응답은 차단 상태다. 비용·전송 없이 이번 수정의 자막을 재확인할 때는 위 Playwright 명령을 사용한다. 실제 Jev 한국어 판단 품질과 Jev→Qwen→Stage 전체 실행은 **NOT VERIFIED**이며 JR08 조건은 이전 절 그대로다.

검증 runtime/Chrome은 종료됐다. Git commit/push는 하지 않았다. 소스 해시는 validation/runs/audit-repair-4e608b4-20261004/source-manifest.json에 보관한다. 다음 행동은 이 미커밋 소스의 **AUDIT**이다.

## 2026-10-04 A01 heartbeat timeout 수정 — 라운드 2

라운드 1 감사에서 같은 Stage의 정상 재연결은 PASS였지만 heartbeat timeout은 FAIL이었다. 실제 서버가 1008/heartbeat_timeout으로 닫은 뒤 전송을 복구해도 Wire의 재연결 수는 0, connectionId는 빈 값이었다. 사용자의 후속 수정 승인으로 A01을 구현했다. 기준선은 라운드 1 미커밋 소스이며 HEAD=4e608b4는 그대로다.

- apps/studio/src/wire.ts: 1008 종료 중 정확히 heartbeat_timeout일 때만 기존 backoff 재연결을 허용한다. 다른 1008 인증·프로토콜 오류는 차단한다.
- apps/runtime/src/http/server.ts: 인증 만료를 먼저 검사해 token_expired로 구분한다. 만료와 heartbeat timeout이 동시에 발생해도 재접속 가능한 사유로 잘못 표시하지 않는다.
- evals/wire.test.ts: 재접속 간격과 인증/프로토콜 사유 8개의 차단을 검사한다. evals/protocol.test.ts는 실제 만료 close 사유를 검사한다. 수정 전 재접속 횟수와 만료 사유 assertion의 FAIL을 확인했다.
- evals/browser/text.spec.ts: 기존 정상 종료 재연결 검사를 유지하고, 실제 Chrome Stage에서 heartbeat.pong만 차단해 서버 timeout을 유발한다. close 이후 송신을 복구하고 새 소켓 1개·새 output epoch·과거 자막 미재생·새 응답 shown/finished/completed를 확인한다.
- 직접 계약 문서 RUNTIME_PROTOCOL.md에 timeout 재시도와 인증 만료 구분을 반영했다.

검증 중 protocol의 다음 테스트 DB reset에서 deadlock이 발생했다. 기존 종료 경로가 아직 queued ownership 취소 및 진행 중 tick의 완료를 기다리지 않는 두 문제를 gate 기반 회귀 검사로 각각 FAIL 재현했다. 작은 추가 수정으로 server.onClose는 ownershipTail을 먼저 기다리고, apps/runtime/src/coordinator/index.ts의 stop은 진행 중 tick 전체가 끝날 때까지 기다린다. tick의 session 조회 후 종료 상태도 확인한다. 임의 sleep을 추가해 테스트를 통과시키지 않았으며 두 종료 검사를 포함한 관련 묶음이 최종 통과했다. 이는 A01 검증 과정에서 발견한 종료 lifecycle 보완이다.

| 기준/검사 | 최종 결과·범위 |
|---|---|
| A01 timeout 복구 | 실제 Chrome 자동 재접속·새 Stage 자막·완료 ACK PASS |
| A01 인증/프로토콜 경계 | Wire 정책 9개 + 실제 WS token_expired 검사 PASS |
| 종료 경쟁 | queued 취소·진행 중 tick을 보류한 상태에서 종료가 먼저 완료되지 않음 PASS |
| node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts evals/wire.test.ts evals/protocol.test.ts evals/coordinator.test.ts | **33/33 PASS**, Wire 9·protocol 14·coordinator 10 |
| node node_modules/@playwright/test/cli.js test --config playwright.config.ts | **4/4 PASS**, 기존 기본/기억 변경/정상 재연결 + timeout 재연결, CLI 정상 종료 |
| node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json | **PASS**, exit 0 |
| node node_modules/vite/bin/vite.js build --config apps/studio/vite.config.ts | **PASS**, exit 0 |

앞선 Store·대사 adapter 소스와 해당 검사는 이번 라운드에서 변경하지 않아 라운드 1의 DB 24/24·adapter 15/15 증거를 유지한다. 이번에 이 두 묶음을 다시 실행했다고 주장하지 않는다. 모든 새 검사는 기존 전용 test PostgreSQL·Chrome·모의 Jev/생성 fixture를 사용했다. 실제 Jev 호출·모델 추론·다운로드·개인 입력은 없었다. 실제 Jev 품질 및 Jev→Qwen→Stage는 계속 NOT VERIFIED다.

현재 소스 manifest는 validation/runs/audit-repair-4e608b4-20261004/round2-source-manifest.json이다. 검증 runtime/Chrome은 종료했고 commit/push는 하지 않았다. **BUILD 완료 → 재감사 제안 대기**, 수정 라운드 2다. 재감사 PASS를 뜻하지 않는다.

## 2026-10-05 A02 수정 및 GitHub 반영

사용자가 3차 감사에서 발견한 A02의 수정과 후속 커밋/푸시·실제 합성 API 검증을 승인했다. 실제 Jev 총예산은 후속 답변 USD 1이다. 이전의 API 승인 대기 기록은 당시 경계이며 현재 승인은 합성 평가 및 Stage 2건에만 적용한다.

apps/studio/src/wire.ts는 재접속 타이머를 보관하고 close에서 취소한다. 콜백 실행 직전에도 closed를 확인하며 종료 시 watchdog 참조를 정리한다. evals/wire.test.ts에 두 회귀 검사를 추가했다. 수정 전 명시적 close 뒤 소켓 2개가 생기는 FAIL을 확인했고, 수정 후 Wire **11/11 PASS**와 TypeScript/Vite **PASS**를 얻었다. 기존 Chrome의 기본 출력·기억 정정/삭제·일반 재연결·heartbeat timeout 재연결은 **4/4 PASS**, 실행기 정상 종료다. 첫 브라우저 시도는 기존 DB 서비스가 내려가 있어 시작하지 못했으며, 기존 PostgreSQL과 설치 모델 전용 Ollama를 기동한 뒤 검증했다. 설치·다운로드·운영 DB 초기화는 하지 않았다.

직접 계약은 RUNTIME_PROTOCOL.md에 반영했다. 기존 Store·adapter·Coordinator/server 소스의 유효한 검증 근거는 앞선 절을 유지한다. 이번 수정은 기존 6건과 A01을 보존한다. 기존 테스트 증거를 재사용했으며 전체 새 감사가 완료됐다고 주장하지 않는다.

사용자 승인에 따라 지금까지의 수정 전체를 커밋/푸시한 뒤 실제 API 검증을 진행한다. 키와 runtime-data/validation/runs는 Git 무시 경로를 유지한다. 정상 실행 flags는 그대로 두고 승인된 검증 프로세스만 LOCAL_ONLY=false/ALLOW_PAID_PROVIDERS=true로 실행한다. dev 24건 결과를 먼저 확인하고 mapping/rubric을 고정한 상태에서 final 24건 및 실제 Qwen/Stage 두 만남을 진행하며, 공급자 오류 시 중단한다. 실제 사용 결과는 아래 후속 절에 기록한다.

코드·검사·문서 16개 파일은 **3b4eac46c14cc407f4cbb1bc6696bba1270f1e05**로 커밋했고 GitHub origin/main의 같은 SHA를 확인했다. staged 자격증명 패턴 검사 0건, 키·검증 자료의 Git 제외 확인을 완료했다.

실제 dev 실행을 시도했으나 approvedSyntheticJev 사전 검사에서 **jev_key_missing**으로 종료됐다. Node의 실제 env parser로 현재 runtime-data/jev.env의 TYPESAFE_API_KEY 할당이 빈 값인 것을 확인했으며 키 값은 출력하지 않았다. **API 요청 0회, 추정 사용 비용 USD 0**이다. 합성 fixture 48건 구조 PASS, 기존 character_runtime_validation DB의 migration 3·캐릭터 1개도 확인했다. 실제 dev/final 품질과 Jev→Qwen→Stage 두 만남은 아직 NOT RUN이다. 사용자에게 키 파일 입력을 요청한 상태이며, 입력되면 이미 승인된 총 USD 1 범위에서 이어서 실행한다. 추가 예산·합성 전송 승인을 다시 요구하지 않는다.

### 키 저장 후 실제 Jev 실행 — 2026-10-05

사용자가 키 입력·저장 완료를 알린 뒤 같은 승인 범위로 dev 평가를 실행했다. 명령은 검증 프로세스에만 LOCAL_ONLY=false/ALLOW_PAID_PROVIDERS=true를 설정한 `node --experimental-transform-types evals/jev-quality.ts --synthetic-inputs --allow-jev-api --max-cost-usd 1 --split dev`다. 첫 합성 입력 greeting-1에서 **jev_invalid_output**, CLI exit 1로 중단했다. 이는 HTTP 성공 이후 JSON 해석 또는 엄격한 응답 검증에서 발생하는 오류다. 인증 실패 코드가 아니지만 실제 응답 본문을 보존하지 않아 어떤 검사에서 실패했는지는 확정할 수 없다. 공식 API 문서 https://docs.typesafe.ai/api 의 Choice/Score/usage 구조와 현재 계약을 비교했으며, 문서만으로 특정 필드 불일치를 입증하지 못했다.

증거는 Git 제외 경로 validation/runs/jev-dev-2026-10-05T09-17-02-138Z/{manifest,results}.json이다. **API 호출 시도 1회, 정상 평가 0건**이며 dev의 나머지 23건, final 24건, 실제 Jev→Qwen→Stage 2건은 **NOT RUN**이다. 공급자 오류 시 재시도 없이 중단한다는 승인 조건을 지켰다. results.json의 inputTokens=0/estimatedCostUsd=0은 검증된 usage를 누적하지 못한 값이며 실제 무과금의 증거가 아니다. **실제 사용량·청구 비용은 UNKNOWN**이다. 키는 출력하거나 Git에 포함하지 않았다.

기존 A02 및 브라우저 fixture PASS는 유지하지만 실제 Jev 한국어 품질과 Jev→Qwen→Stage 성공을 뜻하지 않는다. 다음 작업은 비밀을 제외한 응답 구조·검증 실패 위치를 수집해 원인을 특정하고, 그 응답의 오프라인 회귀 검사로 필요한 최소 수정을 입증하는 것이다. 이번 3차 수정/재감사 루프를 자동 확장하거나 실패한 유료 호출을 다시 실행하지 않았다. 이후 실행은 누적 USD 1 예산과 실패한 첫 요청의 미확인 비용을 함께 고려해야 한다.

### 재발급 키 재시도 및 반올림 호환 수정 — 2026-10-05

사용자가 “키 재발급했어 다시 해봐”로 실제 호출 재시도를 승인했다. 이전 미확인 요청 비용을 위한 USD 0.01 여유를 남기고 재시도 명령의 예산은 USD 0.99로 설정했다. Git 제외 진단 wrapper는 요청 헤더·키를 기록하지 않고 성공 응답의 model/answers/usage만 저장했다. 실제 합성 dev 호출 **2회 모두 HTTP 200**이다. greeting-1은 parser 정상 처리 후 낮은 goal_relation confidence로 uncertain=true가 되어 rubric FAIL이었다. greeting-2는 strength.score=0.01, strength.probabilities={0:1,1:0,2:0,3:0}을 반환해 평균 오차 0.01이 기존 1e-4 한도를 초과하면서 jev_invalid_output이 발생했다. 이번 오류는 키 인증 실패가 아니다. 실제 dev 결과는 validation/runs/jev-dev-2026-10-05T09-24-57-956Z/results.json, 응답 진단은 validation/runs/jev-retry-20261005/response-{1,2}.json이다.

packages/adapters/src/jev.ts의 Score 평균 일치 검사만 두 자리 독립 반올림의 최대 오차 0.035(+부동소수점 여유)까지 허용했다. 근거는 이번 실제 응답이며 공식 문서가 소수 정밀도를 보장한다고 주장하지 않는다. 점수 자체의 반올림 오차 0.005와 확률의 가중 오차 (0+1+2+3)*0.005를 합친 보수적 경계다. 반환 강도는 기존과 같이 확률 최빈값으로 정하므로 이 허용 오차가 강도를 올리지는 않는다. 확률 합·모델·필드·legend·범위·confidence 기준은 유지했다. 잘못된 0.04 차이는 여전히 거부한다. 수정 전 strength/hostility 0.01 회귀 **2 FAIL**을 재현했고 수정 후 packages/adapters/src/jev.test.ts **31/31 PASS**, 저장한 실제 응답 2건의 오프라인 parser 재생 **2/2 PASS**, TypeScript **PASS**다. 이번에 브라우저 검사를 다시 실행하지 않았다.

이번 실제 응답 usage 합계는 **input_tokens 2142**, 공식 입력 단가 기준 추정 **USD 0.000089964**다. dev 실행기 자체의 누적 값은 실패한 두 번째 응답 usage를 제외한 1071 tokens/USD 0.000044982이므로 진단 자료 합산과 구분한다. 이전 첫 요청의 사용량과 계정 청구액은 여전히 미확인이다. 총 승인 예산 USD 1은 유지한다. 이번 공급자 응답 실패 후 추가 유료 호출은 하지 않았다. **실제 dev 전체·final·Jev→Qwen→Stage는 NOT VERIFIED/NOT RUN**이고, 낮은 confidence의 인사 품질 문제를 rubric/threshold 변경으로 숨기지 않았다. 다음 실행은 수정된 parser로 dev부터 다시 평가하고 고정된 mapping/rubric으로 final 및 Stage를 확인하는 것이다. 새 기능·다운로드·개인 자료·음성 사용은 없다.
