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
