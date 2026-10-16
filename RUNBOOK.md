> **2026-10-11 범위 개정 안내.** 제품 목표·현재 MVP·성공 기준은 [기획 v3](./PRODUCT_PLAN_V3.md), [MVP](./MVP_SPEC.md), [검증 계획](./VALIDATION_PLAN.md)을 따른다. [수정 이유](./PLANNING_CHANGELOG.md)에 사용자 근거를 기록했다. 퍼즐·장기 회상·음성·방송의 옛 필수 조건은 현재 완료 기준이 아니다. 최초 범위 개정은 문서만 변경했으며, 이후 승인된 구현과 검증 상태는 [현재 인계](./BUILD_HANDOFF.md)를 따른다. 아래 날짜별 설치·실행 기록은 당시 환경과 결과를 보존한 것이며 현재 서버 생존 상태를 뜻하지 않는다. [개정 직전 문서](./docs/archive/2026-10-11-before-emotion-runtime-v3/RUNBOOK.md)를 보존한다.

## 현재 실행 후보 — 2026-10-16 말투 지속 반영

최신 [말투 지속 검증](./docs/REGISTER_CONTINUITY_RESULT.md)은 집중383건·타입과 실제 자연7입력/별도 통제4입력에서 확인했다. 늦은 모호 질문의 숨김 미도달은 보존했다. 실행 프로필은 키·모델·UI·총 USD3를 유지하고 다음 수동3회 여유만 누적 판단230/생성144로 맞췄다. 보수적 금액 guard 잔여0.1177467이 먼저 막을 수 있다. 시험 앱·Chrome·이번에 시작한 PostgreSQL은 종료했다. 아래 Stage 빌드와 이전 검증은 당시 기록이다.

직전 Stage 공개 표현 BUILD는 [집중271건·타입·합성 Chrome 검증](./docs/MIXED_AFFECT_EXPRESSION_RESULT.md#stage-public-build-20261016)을 완료했다. 아래 start.ps1의 app.env는 STUDIO_DIST_PATH만 `J:/ai/ai-character-runtime/stage-public-expression-20261016-r1/dist-final2`로 갱신했다. 기존 UI 디렉터리를 삭제하지 않는다. 키·모델·USD3·수동 횟수 한도는 유지한다. 실행 전에 기존 PostgreSQL 시작 절차를 따른다. 이번 시험 앱·Chrome은 종료되며 자동 입력은 없다. 아래 실제 API 기록은 이전 소스 당시 결과다.

감사 수정1 뒤 실제 API→Stage 검증에서 복합 말투 지침을1회 보완했다. 현재 소스의 발화4·ACK8과 영향119검사·타입을 확인했다. 추천 질문의 긍정 호응과 풍부한 혼합 표현은 제한적으로 남는다. [실제 결과·실패·표정 라벨 한계](./docs/MIXED_AFFECT_EXPRESSION_RESULT.md#cautious-live-20261016)를 따른다. 키·모델 설정은 유지한다.

```powershell
& "J:\ai\ai-character-runtime\text-mvp-20261015\start.ps1"
```

localhost:3001/studio에서 터미널의 일회용 코드로 연결하고 새 만남·Stage 출력 선택을 한다. 만남 종료 후 Ctrl+C로 앱을 종료한다. 10-16 검증 앱·Chrome·세션과 이번에 시작한 PostgreSQL 55434는 정상 종료했다. 데이터는 보존했으며 아래 기존 클러스터 시작 명령만 먼저 실행한다. 이미 실행 중이면 중복 시작하지 않는다.

이 후보는 별도 character_runtime_text_mvp DB와 J:의 UI를 사용한다. 선택형 Decisions v5/gpt-6-luna와 OpenAI/gpt-6-sol, 기존 키 파일과 총 USD3 원장을 공유한다. 최신10-16 후속 검증 뒤 누적 판단215/생성131, 후보 한도218/134로 다음 수동 입력 최대3회분이다. 기본 Jev/Ollama는 유지했다. 입력은 실제 API를 호출하며 차단 한도는 추가 USD3 승인이 아니다. [현재 결과·잔여 문제·비용](./docs/TEXT_MVP_FINAL_STATUS.md)을 확인한다. 새 표현의 실제 Stage 검증과 작성자 품질·자연 도달의 구분은 [별도 결과](./docs/MIXED_AFFECT_EXPRESSION_RESULT.md)를 따른다.

아래 프로필과 한도는 날짜별 실행 기록이다. 현재 후보 대신 과거 시험 프로필을 복사하지 않는다.

# 로컬 캐릭터 작업실 실행

<a id="runtime-baseline-run"></a>
## 이전 B1 일반 앱 실행 — 2026-10-15

진단의 `checks.openaiBudget`은 `modelUsageEstimateUsd`(사용량 기반 추정), `tokenCountReserveUsd`(계수 예약), `unconfirmedModelReserveUsd`(미확인 모델 예약), `enforcedTotalUsd`/`remainingGuardUsd`(차단 계산)를 구분한다. `billingVerified:false`이므로 이 값을 플랫폼 청구액으로 읽지 않는다. 진단은 원장을 생성·수정하거나 추론을 호출하지 않는다. 정책과 후속 문항은 [B2 후속 계획](./docs/EMOTION_POLICY_FOLLOWUP.md)을 따른다.

[B1 결과](./docs/RUNTIME_BASELINE_RESULT.md)는 공식 `apps/runtime/src/index.ts`와 factory로 Decisions v3→Core/Store→OpenAI→Stage를 검증했다. 별도 평가 서버를 조립하지 않는다. 아래는 저장된 합성 프로필을 사용하는 명령이며 repo 루트에서 실행한다. 앱/DB는 검증 후 종료했다.

```powershell
# 기존 시험 클러스터를 다시 사용할 때만 시작한다. 기존 데이터는 유지한다.
& './runtime-data/tools/pgsql/bin/pg_ctl.exe' -D 'J:/ai/ai-character-runtime/model-comparison/grounding-v2/postgres' -o '-h 127.0.0.1 -p 55434' -l 'J:/ai/ai-character-runtime/runtime-baseline-20261015/postgres.log' -w start
node --env-file=J:/ai/ai-character-runtime/runtime-baseline-20261015/app-live.env --experimental-transform-types scripts/diagnose.ts
node --env-file=J:/ai/ai-character-runtime/runtime-baseline-20261015/app-live.env --experimental-transform-types apps/runtime/src/index.ts
```

`http://127.0.0.1:3001/studio`에서 터미널의 일회용 코드로 연결한다. Stage를 열고 출력을 선택한다. 이 프로필의 `STUDIO_DIST_PATH`는 J:에 빌드한 UI를 가리킨다. 키는 프로필에 복사하지 않고 기존 `runtime-data/dialogue-api.env`에서 읽는다. DB는 신규 합성 `character_runtime_app_baseline`이며 기존 운영 DB로 바꾸는 명령이 아니다.

**이 B1 프로필의 판단64/생성25와 후속 B2 프로필의 판단72/생성29 및 v4 단일 진단 프로필의 판단73/생성29 누적 한도는 모두 소진됐다.** 따라서 위 명령으로 시작/화면/진단은 가능하지만 새 추론은 차단된다. 다음 실행 범위와 누적 상한을 정한 뒤 같은 원장을 유지해 설정한다. 새 원장으로 초기화하거나 과거 unknown 예약을 지우지 않는다. 후속 v4 단일 판단까지 모델 사용량 기반 추정 USD0.0719108와 미확인 계수 예약 USD0.9059575를 합친 예산 차단용 합계는 USD0.9778683이다. 이는 실제 청구액이 아니다. 사용자 보고는 어제0.04/오늘0.01이며 [결과·정산 미완료 경계](./docs/EMOTION_RUNTIME_RESULT.md)를 따른다. B2 프로필은 `J:/ai/ai-character-runtime/emotion-runtime-20261015/app.env`, v4 단일 진단 프로필은 `J:/ai/ai-character-runtime/praise-policy-v4-20261015/app.env`다. 둘 다 재호출용 잔여 횟수는 없다.

선택 설정은 `.env.example`의 `APPRAISAL_PROVIDER=openai-decisions-v3`, `APPRAISAL_MODEL=gpt-6-luna`, `DIALOGUE_PROVIDER=openai`, `DIALOGUE_MODEL=gpt-6-sol`과 기존 유료 허용·키·공유 예산 설정을 따른다. `OPENAI_MAX_DECISION_CALLS`/`OPENAI_MAX_DIALOGUE_CALLS`는 이번 실행 횟수가 아닌 누적 한도다. 기본36/24 외의 값이나 USD1 초과 한도에는 `OPENAI_BUDGET_AUTHORIZATION`이 필요하다. 설정 금액은 기존 원장의 limitUsd와 같아야 하며 앱이 원장 상한을 자동 갱신하지 않는다. `OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID`와 `OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID`는 각각 승인한 과거 unknown 계수/생성 한 건을 식별한다. 실제 호출 프로세스의 종료와 사용자 재개 승인을 먼저 확인하고 전체 예약액을 보존한다. reserved 상태는 이 설정으로 우회할 수 없고, 새 unknown/reserved는 모든 역할을 차단한다. 앱은 설정 문자열만으로 사람의 승인을 확인해 주지 않으므로 승인 범위를 실행 기록과 함께 보존한다.

`evals/runtime-baseline.ts`의 `--inspect`, `--prepare-live`, `--live --synthetic-inputs --allow-paid-providers`는 이번 고정 실험에 사용한 순서다. 이미 출력과 원장이 달라졌으므로 재실행용 명령으로 사용하지 않는다. 일반 시작은 위 명령을 사용한다. 종료는 앱 터미널에서 Ctrl+C 후, 이번에 시작한 시험 클러스터에만 아래를 실행한다.

```powershell
& './runtime-data/tools/pgsql/bin/pg_ctl.exe' -D 'J:/ai/ai-character-runtime/model-comparison/grounding-v2/postgres' -m fast -w stop
```

## 이전: v3 실시간 합성 Stage 결과 — 2026-10-15

[실시간 판단4회·자막·원장 결과](./docs/INTERACTION_V3_LIVE_STAGE_RESULT.md)를 따른다. 새 전용 J: 합성 DB에서 한 세션의 실시간 Decisions→Gemma→Stage L1–L4 4/4가 통과했다. 판단 누적62회 상한이 소진됐으므로 평가 스크립트를 다시 실행하지 않는다. `live-run/` 원문·감사·캡처를 보존했고 평가용 포트3001/55434/11435는 종료했다. 운영 Jev v6/Gemma·factory는 유지한다. 아래 혼합 세션과 이전 결과는 당시 기록이다.

## 이전: v3 혼합 재생·실시간 합성 Stage 결과 — 2026-10-15

[실제 자막·실패 복구·원장 결과](./docs/INTERACTION_V3_STAGE_RESULT.md)를 따른다. 저장된 실제 L1·L2 판단을 재생하고 L3·L4는 실시간 Decisions로 평가한 한 세션의 합성 Stage4/4가 통과했다. 판단 누적58회 상한 소진이므로 평가 스크립트를 다시 실행하지 않는다. 전용 J: DB 두 개의 기록과 `final-run/` 증거는 보존하고, 평가용 포트3001/55434/11435는 종료했다. 운영 Jev v6/Gemma·factory는 유지한다. 아래 v3 후보·v2 절은 당시 기록이다.

## 이전: v3 실제 평가 후보 통과 — 2026-10-15

[v3 실제 결과와 원문 위치](./docs/INTERACTION_V3_RESULT.md)를 따른다. Decisions 개발6/6·확인12/12와 합성 DB 통합15/15를 통과했다. 판단 누적54회 상한이 소진됐으므로 저장된 평가 명령을 다시 실행하지 않는다. 평가 후보는 운영 factory에 연결하지 않았고 Jev v6/Gemma를 유지한다. 실제 v3→Stage와 제작자 수용은 남았다. 아래 v2 절은 당시 실행 기록이다.

## 이전: v2 실제 진단12 종료 — 2026-10-15

[실제 결과·원문·비용](./docs/INTERACTION_V2_DEV12_RESULT.md)을 따른다. 고정 기준10/12, 사전 기대값 오류를 별도 정정하면11/12이며 I11 원인 연결이 남았다. 동일 OpenAI 원장에서 판단36회 한도에 도달했다. 운영 Jev/Gemma는 유지하며 v2를 운영 factory에 등록하지 않았다. 이번 진단은 합성 입력 평가이고 Stage 실행은 아니다. 아래 2026-10-14 준비/실행 설명은 당시 기록이다.

## 이전: v2 구조 로컬 검증 완료 — 2026-10-14

[현재 결과·네트워크 없는 재분석 명령](./docs/INTERACTION_V2_RESULT.md)을 따른다. v2 평가 adapter는 구현했지만 운영 factory에 등록하지 않았다. 운영 Jev v6/Gemma는 그대로다. 단위279·통합122·타입을 확인했고 실제 새 API/Stage 실행은0이다. 준비된 진단12 요청은 실행 범위를 확정하기 전까지 전송하지 않는다. 아래 설치·서버 명령·이전 예산 설명은 당시 실행 기록이다.

<a id="runtime-generator-run-20261014"></a>
## 이전 로컬 진단 인계 — 2026-10-14

로컬 비교는48/48로 종료했다. [최종 결과](./VALIDATION_PLAN.md#runtime-generator-evidence-20261014)와 [현재 인계](./BUILD_HANDOFF.md#runtime-generator-diagnosis-20261014)를 따른다. API 비교는 [별도 계획](./docs/DIALOGUE_API_COMPARISON_PLAN.md)이며 서비스·예산·키 확정 전에는 실행하지 않는다. 운영 Gemma/Jev 설정은 아직 바꾸지 않았다.

실제로 사용한 별도 런타임은 `J:/ai/ai-character-runtime/runtimes/ollama-0.31.2/bin/ollama.exe`다. ZIP/공식 hash/검증 기록을 같은 상위 폴더에 보존했다. 기존 설치를 덮어쓰지 않았고 모델은 기존 J: 저장소를 읽었다. 다음은 향후 별도로 승인된 실행에서 사용할 서버 시작 설정이며 현재 실행 중인 서버를 뜻하지 않는다.

~~~powershell
$env:OLLAMA_HOST = 'http://127.0.0.1:11435'
$env:OLLAMA_MODELS = 'J:/ai/ai-character-runtime/model-comparison/models'
$env:OLLAMA_NO_CLOUD = 'true'
$env:OLLAMA_NOPRUNE = 'true'
$env:OLLAMA_NUM_PARALLEL = '1'
$env:OLLAMA_MAX_LOADED_MODELS = '1'
$env:TEMP = 'J:/ai/ai-character-runtime/installed-model-v1-20261014/tmp'
$env:TMP = $env:TEMP
& 'J:/ai/ai-character-runtime/runtimes/ollama-0.31.2/bin/ollama.exe' serve
~~~

진단 원문/실행 소스는 `installed-model-v1-20261014/runtime-0312-probe-20261014-162811/`과 `runtime-0312-semantic-20261014-163109/`의 manifest/results/run-diagnostic.mjs에 있다. 소스·model digest·요청·총 호출 조건을 검사한 뒤 실제 앱 검증기를 호출했다. 이제 ledger가48이므로 이 스크립트를 재실행하면 호출 전에 중단되는 것이 정상이다. root를 바꿔 한도를 피하지 않는다. 종료 전 모델 빈 목록은 확인하지 못했지만, 최종 `runtime-diagnosis-docs/resource-final-check.json`에서 서버/runner 프로세스와 포트 종료를 확인했다.

<a id="installed-model-run-20261014"></a>
## 이전: 설치 모델 비교 실행 — 2026-10-14

Goal 1-B의 새 평가기를 구현하고 dev36을 실행했다. 후보 두 개가 모두 실패해 확인0으로 종료했다. 현재 설정은 Jev v6/Gemma이며 다음 제안은 이번 평가기 변경 감사다. [실제 결과](./VALIDATION_PLAN.md#goal-1b-evidence-20261014)와 [인계](./BUILD_HANDOFF.md#goal-1b-build-20261014)를 따른다. 아래 content-first-v2와 R1-A03은 과거 실행 기록이다.

다음은 **당시 실행했던 명령**이다. 설치 모델 서버는 아래 기존 전용11435 시작 절을 사용했고 TEMP/TMP·모델·로그는 J:에 지정했다. 당시 소유 모델 unload와 PID7196 종료를 확인했다. 당시 ledger는36회였고 현재는 후속 진단을 포함해48회다. 이 명령의 중복 시도는 거부되는 것이 정상이다. 다른 root로 바꿔 같은 문항을 새 검증처럼 재호출하지 않는다.

~~~powershell
$taskRoot = 'J:/ai/ai-character-runtime/installed-model-v1-20261014'
$env:TEMP = Join-Path $taskRoot 'tmp'
$env:TMP = $env:TEMP
$env:HF_HUB_OFFLINE = '1'
$env:TRANSFORMERS_OFFLINE = '1'
node --experimental-transform-types evals/conversation-eval.ts --synthetic-inputs --experiment installed-model-v1 --phase generation-dev --candidates gemma-current,gemma-history,qwen35-history --qwen-tokenizer J:/ai/ai-character-runtime/model-comparison/tokenizers/qwen35 --output-root J:/ai/ai-character-runtime/installed-model-v1-20261014
~~~

실행 결과 읽기: 위 root의 execution-checks.json, dev 하위 manifest.json/results.json/review.json/gate.json을 확인한다. 모델별 tokenizer/digest/template·물리 완료·전송 원문·36개 자체 채점을 보존했다. 두 후보로 confirmation 진입을 시도한 결과 candidate_not_eligible_or_selected로 호출/ledger 변경 전에 차단됐다. ledger reserved0·확인0이므로 재개할 미완료 호출이 없다. 사용자 수용은 NOT REVIEWED다.

공급자/토큰 불일치/timeout/물리 완료 미확인은 즉시 중단하며 동일 문항을 재시도하지 않는다. 논리 timeout 뒤에는 최대120초 물리 종료를 기다리고 확인이 안 되면 다른 호출 없이 STOPPED로 남긴다. 그런 경우 GPU 소유권을 완료로 간주하거나 서버를 무조건 종료하지 않는다. 이번36회에는 해당 실패가 없었다. 추가 실험은 새로운 범위·문항·판정 조건을 결정한 뒤 진행한다.

평가기 검증은 `node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts evals/conversation-eval.test.ts --no-cache`, adapter 검증은 같은 CLI의 unit config와 packages/adapters/src/adapter.test.ts, 타입은 `pnpm typecheck`다. 이번에는 J: TEMP/TMP와 JSON reporter 출력 경로를 명시해 평가기11·adapter70·타입 PASS를 기록했다. DB/Stage 테스트는 이번 범위에서 실행하지 않았다.

## 이전 후보의 실행·재현 기록

2026-10-13 content-first-v2 과거 실행 기록은 `J:/ai/ai-character-runtime/content-fidelity-20261013/`이다. 새 후보 dev18건 형식 PASS지만 초안 밖 내용 추가로 미채택했다. 확인/새 Jev/Stage는 실행하지 않았다. 운영 v6/Gemma/content-first는 그대로다. 전용11435 종료, 사용자11434 보존, DB 기동0. [현재 인계](./BUILD_HANDOFF.md)를 따른다.

이번 후보의 재현 명령은 아래와 같다. 기존 J: 모델을 사용하는 전용11435와 J: TEMP/TMP를 준비해야 한다. 이18건은 이미 관측한 진단 자료이며 미사용 확인 평가가 아니다. 현재 dev FAIL이므로 `--confirmation`을 붙여 승격 근거를 만들지 않는다.

~~~powershell
$env:OLLAMA_BASE_URL = 'http://127.0.0.1:11435'
node --experimental-transform-types evals/emotion-expression.ts --fixed-facts --fixture evals/fixtures/emotion-content-v2.json --model gemma4:12b-it-qat --prompt-variant content-first-v2 --tokenizer J:/ai/ai-character-runtime/model-comparison/tokenizers/gemma4 --output-root J:/ai/ai-character-runtime/content-fidelity-20261013/dev
~~~

직전 실행은 `J:/ai/ai-character-runtime/e4-budget-20261013/`에 있다. 예산 사전 차단·집중20건/타입과 실제 Jev7→Stage 기술 경로는 통과했고 표현 품질은 미달이었다. 당시 운영 v6/Gemma 설정을 유지했다. 소유11435/55434는 종료했고 사용자11434는 보존했다.

이번 표현 비교 명령은 아래와 같다. 기존 J: Gemma 서버11435 준비 후 사용하며 로그/cache/TEMP/TMP도 J:로 지정한다. 이미 관측한12건의 재현 명령이고 미사용 확인 평가가 아니다.

~~~powershell
$env:OLLAMA_BASE_URL = 'http://127.0.0.1:11435'
node --experimental-transform-types evals/emotion-expression.ts --delivery-controls --model gemma4:12b-it-qat --prompt-variant content-first --tokenizer J:/ai/ai-character-runtime/model-comparison/tokenizers/gemma4 --output-root J:/ai/ai-character-runtime/e4-budget-20261013/expression
~~~

실제 Stage는 아래 기존 continuity 명령의 output-root를 `J:/ai/ai-character-runtime/e4-budget-20261013/browser`로 지정했다. 새 검증을 자동 재호출하지 않는다. 이번 Jev 추정USD0.000422856, 알려진 누적USD0.019659906+과거 usage불명1회이며 청구 총액은 미확인이다. S2 평가기는 예산을 provider 호출 전에 검사하지만 별도 확인 단계 재개 기능은 아직 없고 v9 dev도 FAIL이다.

2026-10-11 grounded-v2의 **과거 실행 기록**: 당시 IMPLEMENTATION_PLAN.md §18.11의 관련 회귀44/44·실제 J: DB Q03 5/5·타입 PASS, Gemma dev18/24·형식18/24·진단2/4, 집중10/16·형식14/16·금지 사실4로 품질 FAIL이었습니다. 추론50회·유료0·다운로드0, 해당 실행의 새 final/Stage는 미실행이었습니다. 자료는 J:/ai/ai-character-runtime/model-comparison/grounding-v2에 보존하며, 서버 종료와 다음 AUDIT 안내도 당시 기록입니다. 최신 실행법은 아래 현재 감정 런타임 절, 최신 결과는 [현재 인계](./BUILD_HANDOFF.md)를 따릅니다.

과거 결과 (2026-10-11 §18.8 수정 BUILD): 준비/형식 검사를 분리하고 늦은 완료를 직렬 저장했습니다. Qwen3.5 dev11/24·형식18/24, Gemma 실험 후보 dev22/24·형식22/24·집중7/8로 미달이며 해당 실행의 새 final/Stage를 실행하지 않았습니다. 추론73회·유료0회·다운로드0회, 모델 unload 확인 뒤 당시 Ollama를 종료했고 DB는 시작하지 않았습니다. 당시 실행법은 §18.8, 증거는 J:/ai/ai-character-runtime/model-comparison/repair-20261011/runs/summary.json과 IMPLEMENTATION_PLAN.md §18.9입니다.

> 단계 결정 기록 (2026-10-09): 텍스트 캐릭터 우선. 필수 Jev·기존 Qwen·자막 Stage를 검증하고 TTS/STT·마이크·VRM·OBS는 후속 확장으로 미룬다. 실제 Jev 합성 검증은 누적 USD 1 승인 범위에서 실행하며 공급자 오류 시 중단한다. 아래 과거 준비/실행 기록은 당시 결과이고 최신 상태는 BUILD_HANDOFF.md를 따른다.

2026-10-04 Jev 필수 연결 당시 실행은 아래 날짜별 추가 절에 보존한다. 이전 Qwen 사건 해석 검증은 당시 로컬 비교 증거로 남으며 실제 Jev 성공을 뜻하지 않는다.

현재 구현은 PostgreSQL에 저장되는 텍스트 경로다. 2026-10-04 기존 Ollama/Qwen의 응답을 실제 Chrome Stage에 표시하고 완료 ACK까지 저장하는 경로를 두 합성 만남에서 확인했다. 한국어 대사 품질·음성·VRM·OBS·고정 성능 검증은 완료되지 않았다. `20261003-text-m2-build1`의 합성 provider 결과와 10-04 실제 모델 결과는 별도 증거다.

<a id="current-c1-run"></a>

## 현재 C1 실행 — Jev/Gemma4 content-first

현재 로컬 선택은 gemma4:12b-it-qat, tokenizer는 J:/ai/ai-character-runtime/model-comparison/tokenizers/gemma4, Ollama endpoint는 127.0.0.1:11435다. runtime-data/ai-local.json의 이 세 선택만 바꿨으며 API 키/DB/다른 설정은 유지했다. 명시적 process/.env 값이 우선한다. 모든 모델 선택을 생략한 parseConfig 기본은 Qwen이다. 다른 모델을 명시하면 저장된 Gemma tokenizer 기본은 따라오지 않는다. 명시적 tokenizer를 주는 경우 선택한 모델과 맞춰야 한다.

C1 지정 범위의 결과는 dev12/확인12, factory 요청 parity24, 실제 Jev7→Stage 침묵3·완료4·자막4/ACK8 PASS다. R-HIST1 과거 회상 오류, 추가 질문/구두점/추천 구체성 한계와 사용자 ER07 미검증은 남는다. BUILD_HANDOFF의 최신 결과를 따른다. 증거는 J:/ai/ai-character-runtime/content-first-20261011/이다. 아래 명령은 실행 인계이며 자동 유료 재시도 지시가 아니다.

후속 C1-R1 확인: 준비 후 모델을 명시적으로 unload하고 비상주 상태에서 정상 운영 대사1건을 실행해6.735초에 완료했다(로딩3.625초). 운영 제한·설정은 변경하지 않았다. 자연5분 만료나 디스크 cache 없는 로딩 검증은 아니다. 원문/소유 서버 종료 기록은 J:/ai/ai-character-runtime/c1-reload-20261011/을 따른다.

### 설치 모델 서버 시작과 일반 실행

PowerShell에서 프로젝트 폴더를 사용한다. 기존 사용자 서버11434는 그대로 둔다. 11435가 이미 열려 있다면 이 작업의 같은 서버인지 확인한 뒤 사용하고 중복 기동하지 않는다. 아래는 이번에 사용한 J: 모델 경로다. 모델을 다운로드하지 않는다.

~~~powershell
$runtimeEvidence = 'J:/ai/ai-character-runtime/content-first-20261011'
$env:TEMP = Join-Path $runtimeEvidence 'tmp'
$env:TMP = $env:TEMP
$env:OLLAMA_MODELS = 'J:/ai/ai-character-runtime/model-comparison/models'
$env:OLLAMA_HOST = '127.0.0.1:11435'
$env:OLLAMA_NO_CLOUD = '1'
$env:OLLAMA_NUM_PARALLEL = '1'
$env:OLLAMA_MAX_LOADED_MODELS = '1'
$env:OLLAMA_VULKAN = '1'
$runtimeOllama = Start-Process -FilePath "$env:LOCALAPPDATA/Programs/Ollama/ollama.exe" -ArgumentList 'serve' -WindowStyle Hidden -PassThru
~~~

일반 실행에는 runtime-data/local.env 또는 .env에 이미 설정한 DB가 실행돼 있고 migration이 맞아야 한다. 기존 비밀 파일을 출력하거나 test DB로 바꿔 쓰지 않는다. 프로젝트 UI를 빌드한 뒤 runtime을 실행한다. 모델 선택은 위 로컬 설정에서 읽는다.

~~~powershell
pnpm build
pnpm start
~~~

터미널의 Studio 주소 http://127.0.0.1:3001/studio 와 일회용 코드를 사용해 Stage를 연결한다. 일반 실행의 DB/유료 허용 설정은 기존 값을 따른다. 이번 실제 검증은 아래 별도 합성 DB 하네스였으므로 일반 운영 DB까지 새로 검증한 것은 아니다. 종료할 때 runtime을 먼저 Ctrl+C로 멈추고, 이 PowerShell에서 시작한 $runtimeOllama의 PID·시작 시각·경로가 여전히 일치할 때만 종료한다. 기존11434 프로세스를 종료하지 않는다.

### 완료한 합성 Stage 검증 재현

전용 DB는 J:/ai/ai-character-runtime/model-comparison/grounding-v2/postgres, loopback55434/character_runtime_test다. 기존 DB가 살아 있다면 cluster/port 소유권을 먼저 확인한다. 중지된 해당 cluster는 다음 명령으로 시작할 수 있다. 초기화/seed/reset 명령은 사용하지 않는다.

~~~powershell
& './runtime-data/tools/pgsql/bin/pg_ctl.exe' -D 'J:/ai/ai-character-runtime/model-comparison/grounding-v2/postgres' -l 'J:/ai/ai-character-runtime/content-first-20261011/logs/postgres.log' -o '-h 127.0.0.1 -p 55434' -w start
$env:OLLAMA_BASE_URL = 'http://127.0.0.1:11435'
$env:DIALOGUE_MODEL = 'gemma4:12b-it-qat'
$env:DIALOGUE_TOKENIZER_PATH = 'J:/ai/ai-character-runtime/model-comparison/tokenizers/gemma4'
node node_modules/vite/bin/vite.js build --config apps/studio/vite.config.ts --configLoader runner --outDir J:/ai/ai-character-runtime/content-first-20261011/browser/ui
node --experimental-transform-types evals/emotion-participation-stage.ts --synthetic-inputs --real-dialogue --allow-jev-api --max-cost-usd 0.005 --emotion-continuity --validation-env J:/ai/ai-character-runtime/model-comparison/grounding-v2/test.env --output-root J:/ai/ai-character-runtime/content-first-20261011/browser
~~~

이 명령은 유료 Jev 최대7회와 로컬 준비1회/대사4회를 사용한다. 새 재실행 전에 누적 예산과 공급자 중단 상태를 확인한다. 완료 기록의 자동 qualityStatus는 NOT_REVIEWED이며 같은 루트 stage-review.json이 이후 Codex 원문/PNG 검토다. 확인용12는 이미 소비했으므로 재실행을 미사용 평가로 표시하지 않는다. 이번 추정 Jev 비용 USD0.000393162, 알려진 누적 USD0.008234898+과거 usage불명1회다. 최종 자원 상태는 cleanup.json을 따른다.

## 이전 C1 후보 검증 기록 — emotion-v3 탈락

개발 종료까지 [네 목표](./IMPLEMENTATION_PLAN.md#completion-goals)를 순서로 삼는다. 이번 C1은 평가 전용 emotion-v3 후보 구현·로컬 비교까지 진행했지만 채택 기준에 미달해 **미완료**다. 운영 prompt와 모델은 바꾸지 않았고 Jev/DB/Stage는 새로 호출하지 않았다. 자료는 `J:/ai/ai-character-runtime/completion-goal1-20261011/`, 최종 집중 검사47건·타입 PASS, 실제 로컬 대사36건이다. 서버 종료 상태는 같은 루트 `cleanup.json`을 따른다.

사용한 명령은 다음과 같다. 기존 J: 모델과 tokenizer·로컬 Ollama가 준비돼 있어야 한다. 아래는 완료한 비교의 재현 경로이며 탈락 후보를 자동 재시도하거나 운영에서 켜라는 뜻이 아니다. `--confirmation`은 적격 후보가 없어서 실행하지 않았다.

~~~powershell
$goalEvidenceRoot = 'J:/ai/ai-character-runtime/completion-goal1-20261011'
$env:TEMP = Join-Path $goalEvidenceRoot 'tmp'
$env:TMP = $env:TEMP
node node_modules/vitest/vitest.mjs run --config vitest.config.ts --configLoader runner --no-cache packages/adapters/src/adapter.test.ts packages/contracts/src/ai-ports.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
node --experimental-transform-types evals/emotion-expression.ts --fixed-facts --prompt-variant emotion-v3 --output-root J:/ai/ai-character-runtime/completion-goal1-20261011/expression/qwen
node --experimental-transform-types evals/emotion-expression.ts --fixed-facts --prompt-variant emotion-v3 --model gemma4:12b-it-qat --tokenizer J:/ai/ai-character-runtime/model-comparison/tokenizers/gemma4 --output-root J:/ai/ai-character-runtime/completion-goal1-20261011/expression/gemma
node --experimental-transform-types evals/emotion-expression.ts --fixed-facts --prompt-variant emotion-v3 --model qwen3.5:9b-q4_K_M --tokenizer J:/ai/ai-character-runtime/model-comparison/tokenizers/qwen35 --output-root J:/ai/ai-character-runtime/completion-goal1-20261011/expression/qwen35
~~~

## 이전 생성 수정·검증 기록 — 2026-10-11

JSON 생성 schema를 수정한 뒤 같은 실패 context의 세 seed에서 형식3/3, adapter44/44·타입·UI build를 통과했다. 실제 Jev7입력은 침묵3건·발화완료4건·자막5개·ACK10건·브라우저 오류0이다. 감정/이유 지속과 별개로 현재/후보 표현 dev24건은 품질 미달이며 emotion-v2를 운영에 채택하지 않았다. 감사는 기술 경로 PASS, G02/EX02 FAIL, ER07 NOT VERIFIED다.

증거는 `J:/ai/ai-character-runtime/generation-repair-20261011/`에 있다. 아래는 완료한 실행의 재현 명령이며 자동 재시도 지시가 아니다. 기존 J: 모델/tokenizer·Ollama와 전용 `127.0.0.1:55434/character_runtime_test`를 먼저 준비한다. 비밀 값은 출력하지 않는다. DB 초기화 검사를 함께 실행하면 보관 중인 합성 기록이 지워지므로 병행하지 않는다. 실행 종료 후 소유 자원 상태는 해당 루트의 `cleanup.json`을 따른다.

~~~powershell
$generationEvidenceRoot = 'J:/ai/ai-character-runtime/generation-repair-20261011'
$env:TEMP = Join-Path $generationEvidenceRoot 'tmp'
$env:TMP = $env:TEMP
node node_modules/vitest/vitest.mjs run --config vitest.config.ts --configLoader runner --no-cache packages/adapters/src/adapter.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
node --experimental-transform-types evals/emotion-expression.ts --fixed-facts --output-root J:/ai/ai-character-runtime/generation-repair-20261011/expression/current
node --experimental-transform-types evals/emotion-expression.ts --fixed-facts --prompt-variant emotion-v2 --output-root J:/ai/ai-character-runtime/generation-repair-20261011/expression/candidate
node node_modules/vite/bin/vite.js build --config apps/studio/vite.config.ts --configLoader runner --outDir J:/ai/ai-character-runtime/generation-repair-20261011/browser/ui
node --experimental-transform-types evals/emotion-participation-stage.ts --synthetic-inputs --real-dialogue --allow-jev-api --max-cost-usd 0.005 --emotion-continuity --validation-env J:/ai/ai-character-runtime/model-comparison/grounding-v2/test.env --output-root J:/ai/ai-character-runtime/generation-repair-20261011/browser
~~~

이번 Jev7회 추정 USD0.000393162, 알려진 누적 USD0.007841736 + 과거 usage불명1회다. 청구 총액은 미확인이다. 후보 탈락으로 확인용12건은 실행하지 않았다. 원문과 같은 컨텍스트 감사의 지적 G-A1/G-A2는 [현재 인계](./BUILD_HANDOFF.md)를 따른다.

## 이전 모델 경계와 표현 비교 실행 — 2026-10-11

공용 역할·증거 verifier·명시적 factory를 구현했다. 선택자를 생략하면 APPRAISAL_PROVIDER=jev, DIALOGUE_PROVIDER=ollama이며 기존 환경변수와 실행 명령을 그대로 쓴다. 운영 등록은 Jev jev-1.13.0 / Ollama qwen2.5:7b다. 등록하지 않은 이름이나 모델은 호출 전 거절한다. .env.example에 선택자를 추가했으며 기존 비밀 파일은 수정하지 않았다. 교체는 요청 종료 후 재시작으로 수행한다.

아래는 이번에 실행한 로컬 비교 명령이다. 기존 J: 모델/tokenizer와 Ollama가 준비돼 있어야 하며 하네스는 모델을 다운로드하지 않는다. --fixed-facts는 dev12건, 여기에 --confirmation을 더하면 분리한 확인용12건이다. 확인용은 적격 dev 후보만 한 번 실행한다. 이번에는 후보가 없어 확인용을 실행하지 않았다. 모델이 다른 경우 해당 tokenizer를 반드시 지정한다.

~~~powershell
$boundaryEvidenceRoot = 'J:/ai/ai-character-runtime/model-boundaries-build-20261011'
$env:TEMP = Join-Path $boundaryEvidenceRoot 'tmp'
$env:TMP = $env:TEMP
node --experimental-transform-types evals/emotion-expression.ts --fixed-facts --output-root J:/ai/ai-character-runtime/model-boundaries-build-20261011/expression/current
node --experimental-transform-types evals/emotion-expression.ts --fixed-facts --prompt-variant emotion-v1 --output-root J:/ai/ai-character-runtime/model-boundaries-build-20261011/expression/candidate
node --experimental-transform-types evals/emotion-expression.ts --fixed-facts --model gemma4:12b-it-qat --tokenizer J:/ai/ai-character-runtime/model-comparison/tokenizers/gemma4 --output-root J:/ai/ai-character-runtime/model-boundaries-build-20261011/expression/alternate
~~~

emotion-v1은 평가 전용이며 운영에 채택하지 않았다. 일반 사실 질문의 deflect는 expression을 중립으로 가린 주입 대조이고 Core의 새 숨김 정책이 아니다. 재참여 4조건은 실제 공개 계약을 사용한다. 형식36/36이지만 모든 설정이 감정 표현 채택 기준에 미달했다. 재실행해서 새 미사용 합격 증거로 바꾸지 않는다.

당시 실제 경로의 실행 명령은 다음과 같다. 전용 합성 DB 이름·J: cluster·loopback55434 확인 후 실행하고 DB 초기화 테스트와 동시에 돌리지 않는다. 당시 실패는 새 화제의 invalid_output이며 아래 명령을 자동 재시도하라는 뜻이 아니다. 후속 수정 결과는 위 최신 절을 따른다.

~~~powershell
node node_modules/vite/bin/vite.js build --config apps/studio/vite.config.ts --configLoader runner --outDir J:/ai/ai-character-runtime/model-boundaries-build-20261011/browser/ui
node --experimental-transform-types evals/emotion-participation-stage.ts --synthetic-inputs --real-dialogue --allow-jev-api --max-cost-usd 0.005 --emotion-continuity --validation-env J:/ai/ai-character-runtime/model-comparison/grounding-v2/test.env --output-root J:/ai/ai-character-runtime/model-boundaries-build-20261011/browser
~~~

이번 실행은 Jev4입력 뒤 중단했고 나머지3입력은 미실행이다. 알려진 누적 비용 추정 USD0.007448574와 과거 usage불명1회를 분리한다. 다음 디버깅은 저장된 실패 plan/context/raw의 로컬 재생부터 시작한다. 자세한 증거와 자원 종료 상태는 [현재 인계](./BUILD_HANDOFF.md)를 따른다.

## 현재 감정 런타임 검증 — 2026-10-11

직전 A1 말투 전달 복구와 실제 연속 검증은 [검증 보고서](J:/ai/ai-character-runtime/delivery-continuity-20261011/review.md)를 따른다. 출력 루트는 `J:/ai/ai-character-runtime/delivery-continuity-20261011`이다. 아래 기본 명령의 출력 루트를 이 경로로 바꾸고, 표현 비교에는 `--delivery-controls`, 실제 Jev Stage에는 `--emotion-continuity`를 추가하면 이번 12조건/7입력 시나리오다. delivery-controls는 replay/confirmation과 함께 사용하지 않는다. continuity는 실제 Jev flags·예산이 필요하고 기본5입력에 반복 공격과 주제 전환 뒤 재질문을 더한다. 형식·상태 지속과 말투 체감을 구분하며 이번 기분별 말투 차이는 미입증이다.

아래 disclosure-fix 실행 예시는 직전 검증 기록으로 보존한다.

현재 로컬 선택은 Jev v4와 Gemma4 content-first다. 생략 기본 Qwen과 이전 Qwen 실행 기록은 보존한다. Jev의 엄격한 감정 매핑과 `.8` 임계값은 유지한다. 검증된 raw target/act가 각각 `.8` 이상·유일 최빈 선택·현재 appraisal 일치이고 대상이 character일 때만 명시적 듣기 요청과 침묵 이유 재접근을 별도로 처리한다. 감정 `uncertain`과 강도 0은 바꾸지 않으며, 공급자 실패·불명/인용 대상·낮은 대상/행위 확신·대상/행위 동률은 우회하지 않는다. 같은 상대의 유효한 침묵 이유가 없으면 `unknown`으로 재접근하고 이유를 만들지 않는다. 상세 계약은 [로컬 AI 연동 §6](./LOCAL_AI_INTEGRATION.md#6-사건-해석-계약)을 따른다.

일반 대사는 `sentences` 배열 JSON으로 생성한다. 생성 schema와 파싱 후 검증 모두 항목당 한글 음절·한 문장과 전체 길이 제한을 적용하며, 검증된 문자열만 Stage로 전달한다. 오류는 `invalid_output`으로 종료하고 자동 재생성·절단·대체 대사를 쓰지 않는다. `grounded-v2`와 `evidence-bound-v1`은 명시적 과거 평가 프로필에서만 평문을 유지한다. 형식 통과, 공개/숨김 의도 정합성, 사용자의 자연스러움 평가는 별개다.

최신 재접근 생성은 한 문장 상한이다. 저장 이유·공개 방침·현재 말투를 별도로 전달하고 과거 발언 원문의 지시를 재전달하지 않는다. 설명, 이유에 대한 모름, 알고도 숨기기를 구분한다. DB 원본과 일반 주제의 자료 전달은 보존한다.

현재 하네스는 [공개/숨김 비교](./evals/emotion-expression.ts), [브라우저 연속 장면](./evals/emotion-participation-stage.ts), [독립 Jev 6건](./evals/emotion-jev.ts)이다. 입력·공개 선택·소스 hash를 실행 전에 기록한다. 이전 설명 수정 자료는 `J:/ai/ai-character-runtime/disclosure-fix-20261011/`에 보존하며 최신 자료는 위 model-boundaries-build 루트를 따른다. 명령 자체는 성공이나 사용자 품질 승인을 뜻하지 않으며 결과·사용량은 [현재 인계](./BUILD_HANDOFF.md)를 따른다.

저장소 루트에서 기존 J: tokenizer·모델과 소유가 확인된 로컬 Ollama를 사용한다. 브라우저 검증에는 `J:/ai/ai-character-runtime/model-comparison/grounding-v2/postgres`의 전용 합성 DB `127.0.0.1:55434/character_runtime_test`가 필요하다. 접속 파일 내용을 출력하지 않는다. DB를 reset하는 다른 검사와 동시에 실행하지 않는다.

~~~powershell
$participationEvidenceRoot = 'J:/ai/ai-character-runtime/disclosure-fix-20261011'
$env:TEMP = Join-Path $participationEvidenceRoot 'tmp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Force -Path $env:TEMP,(Join-Path $participationEvidenceRoot 'logs') | Out-Null
node node_modules/vite/bin/vite.js build --config apps/studio/vite.config.ts --outDir J:/ai/ai-character-runtime/disclosure-fix-20261011/browser/ui
node --experimental-transform-types evals/emotion-expression.ts --output-root J:/ai/ai-character-runtime/disclosure-fix-20261011/runs
node --experimental-transform-types evals/emotion-participation-stage.ts --synthetic-inputs --validation-env J:/ai/ai-character-runtime/model-comparison/grounding-v2/test.env --output-root J:/ai/ai-character-runtime/disclosure-fix-20261011/browser --real-dialogue
~~~

위 Stage 명령은 Jev를 mock으로 고정하고 선택된 실제 로컬 모델 대사를 검사한다. `--real-dialogue`도 빼면 대사까지 fixture다. 실제 Jev 검증은 현재 승인된 배정 예산을 확인한 뒤 `--allow-jev-api --max-cost-usd 0.005`를 추가한다. 실제 모드는 공격→재접근→주제 전환과 듣기 요청→재접근의 두 장면, 최대 5회 Jev 호출을 사전 고정하며 감정이나 이유를 주입하지 않는다. API 허용 flags는 해당 프로세스에만 적용한다. 첫 공급자 오류·사용량 불명·기록 실패·배정 추정 예산 도달·대사 생성 실패 시 중단한다. 브라우저 하네스는 기존 DB를 reset하지 않고 자신의 합성 세션을 종료한다.

공개/숨김 기본 비교는 이미 관측한 실패의 6조건 회귀다. 같은 내부 상태·입력·모델·seed에서 공개 선택만 다른 쌍을 비교한다. `--confirmation`은 다른 입력과 seed로 사전 고정한 별도 4조건이며, 튜닝한 뒤 같은 자료를 반복해 새 합격 증거로 삼지 않는다. 두 모드 모두 감정·계획을 주입한 표현 검사이므로 실제 Core 선택·Jev·Stage·사용자 체감을 입증하지 않는다.

저장된 실제 실패 재현은 아래 명령을 사용한다. A/B는 실제 Stage의 plan/context, U는 기록 없는 기존 대조, D는 A의 disclosure만 deflect로 바꾼 대조다. 기본 8건(seed 17/29), `--confirmation` 추가 시 바뀐 질문의 8건(seed 71/83)이다. 과거 Jev 응답을 다시 과금 호출하지 않는다. 각 case의 실제 plan/context와 requests가 입력 증거이며, 공통 가상 상태로 실제 실행을 설명하지 않는다.

~~~powershell
node --experimental-transform-types evals/emotion-expression.ts --replay-failures J:/ai/ai-character-runtime/participation-korean-fix-20261011 --output-root J:/ai/ai-character-runtime/disclosure-fix-20261011/runs
~~~

## 설치한 프로젝트 전용 구성

아래 설치·준비·검사·제한 목록은 2026-10-03 텍스트 경로의 최초 기록이다. 당시 C: runtime-data 경로와 서버 상태·검사 수를 최신 검증 환경으로 재사용하지 않는다. 현재 검증의 저장 위치와 도구는 위 절을 따른다.

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

2026-10-03 당시 결과: 단위 29/29, 실제 PostgreSQL 15/15, HTTP/WS 9/9, 실제 headless Chrome의 합성 provider 텍스트 E2E 1/1 PASS. 정상 provider 설정의 서버 기동/종료 smoke는 liveness와 Studio HTTP200, 비소유자 app 역할을 확인했으며 추론은 실행하지 않았다.

`test:e2e`는 명시적인 `--synthetic-fixtures` 서버를 테스트 DB에서만 띄운다. 일반 runtime fallback이 아니다. 테스트 시작 때 해당 DB의 합성 자료만 초기화한다. 개인 대화나 음성은 사용하지 않았다. 캡처는 `runtime-data/playwright-results`에 있다.

## 백업과 복원

`python scripts/check-restore.py`는 합성 `character_runtime_test`만 custom-format dump해 전용 `character_runtime_restore_test`에 복원한다. 2개 migration, 4개 계정, state CHECK 보존을 실제 확인했다. 이 명령은 운영 경험 DB 백업 명령이 아니다.

운영 DB 백업에는 공식 `pg_dump.exe`를 사용해 명시적으로 선택한 프로젝트 파일에 저장한다. 비밀번호를 명령행에 넣지 않고 연결 자격을 별도로 제공한다. 운영 자료가 생긴 뒤 백업/복원/제거를 할 때는 그 데이터에 대한 명시적 범위를 확인한다. 이전 삭제 전 백업은 격리하고 삭제 요청을 다시 반영하기 전 앱에 연결하지 않는다.

## 실제 모델 준비의 남은 조건

아래 목록은 2026-10-03의 준비 상태 기록이다. 10-04 실행 상태는 그 날짜의 추가 절에 보존하며 최신 상태는 현재 인계를 따른다.

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

이 절의 "현재"와 서버 생존 상태는 2026-10-04 실행 당시 기준이다. 아래 경로와 명령은 당시 재현 기록이며 새 검증의 저장 위치·소유권 확인을 대신하지 않는다.

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

2026-10-10 당시 Stage 도구의 입력은 합성 계산 질문과 다음 만남 B의 A 경험 질문이었다. 준비는 Store의 실제 등록 힌트·정답 사건으로 하며 유료 해석은 실제 두 입력에만 사용했다. 준비된 활동 자체를 실제 모델이 풀었다는 증거는 아니다. 당시 이 경로는 실행 미검증이었으며 의미 검토와 전송/ACK 결과를 별도 기록하도록 했다.

## §17.7 수정 실행 결과와 현재 사용법 — 2026-10-10

이 절의 도구 버전·복원 상태·비용·미실행 표기는 2026-10-10 당시 기록이다. 현재 감정 참여·한국어 검증 명령은 문서 앞의 현재 감정 런타임 절을 따른다.

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

두 명령은 당시 도구 사용법이며 같은 세트를 다시 실행하라는 재검증 권고는 아니다. R2 후보는 거부·복원했고 해당 실행의 새 final/Stage는 미실행이었다. 실제 Jev v5 dev는 16번째 응답에서 choice/modal 불일치로 중단했다. 기존 공급자 오류 중단 조건을 지켜 유료 재시도하지 않았다. 당시 알려진 누적 비용 추정 USD 0.005818806과 과거 1회 미확인 비용을 구분한다. 후속 실제 검증의 배정 범위와 누적 추정은 현재 인계를 따른다.

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

이 모델 비교의 당시 결과는 IMPLEMENTATION_PLAN.md §18.7 및 `J:/ai/ai-character-runtime/model-comparison/runs/summary.json`이다. Gemma dev PASS/final FAIL, Qwen3.5 dev 미실행이었다. 이 절의 명령은 재현용이며, 소진된 final-v3를 다시 acceptance로 채점하지 않는다.

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

이 수정 실행의 당시 결과는 IMPLEMENTATION_PLAN.md §18.9와 `J:/ai/ai-character-runtime/model-comparison/repair-20261011/runs/summary.json`이다. §18의 이전 Qwen3.5 준비 실패는 수정 전 기록이며, 이 실행에서는 기술 준비를 통과한 뒤 본 대화 품질을 평가했다. 당시 운영 기본 모델/프롬프트는 기존 Qwen으로 유지했다.

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

이 실행의 DB 검증은 grounding-v2/postgres, loopback55434, character_runtime_test였다. 당시 검증 후 종료했으며 재시작 시 data_directory와 DB 이름을 검증한다. test.env의 비밀번호를 출력하지 않는다. 아래 Q03 검사는 해당 합성 전용 DB 데이터를 reset하므로 과거 postgres-final에 연결하지 않는다. 새 Stage/실제 Jev 품질 검증을 대신하지 않는다.

~~~powershell
node --env-file=J:/ai/ai-character-runtime/model-comparison/grounding-v2/test.env node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts --no-cache evals/db.test.ts -t Q03
~~~

unit/model/recording 검사 명령은 앞 절과 같으며 로그와 cache는 J:로 보낸다. 실행된 대사44+준비6=50회가 모두 물리 완료·token 차이0이었다. 실패 후보라 운영 전환이나 새 final은 수행하지 않았다.

## 감정 런타임 실제 Jev·공개/숨김 검증 — 2026-10-11 최초 실행 기록

사용자가 실제 Jev와 한국어 자연스러움 검증을 명시적으로 재개 승인했다. 기존 누적 USD 1 한도 안에서 이번 실행에 추정 USD 0.01·최대 9회를 배정하고, 입력·공개 의도·source hash를 먼저 고정했다. production Core·Jev 임계값·Qwen prompt와 사용자 env 파일은 바꾸지 않았다. API 허용 값은 해당 평가 프로세스에만 적용했다.

실제 Jev 분류 6회는 응답 계약 6/6이며 확실한 해석까지 요구한 사전 기준은 2/6이다. 실제 Stage에서는 Jev 2회 뒤 Qwen의 중국어 혼입으로 `invalid_output`이 발생해 중단했다. 세 번째 입력은 실행하지 않았다. 공개/숨김 6조건의 대사는 형식 5/6, 문장 수 위반과 근거 없는 핑계가 관측됐으며 사용자 체감은 미평가다. 자세한 판정은 [현재 인계](./BUILD_HANDOFF.md)를 따른다.

이번 확인된 입력 사용량 비용 추정은 USD 0.000450156, 알려진 누적 추정은 USD 0.006268962다. 과거 사용량 미확인 1회와 계정 청구액 미확인은 그대로 남긴다. 위의 이전 비용·미실행 기록은 당시 범위다. 신규 증거·임시·브라우저 파일은 `J:/ai/ai-character-runtime/emotion-live-20261011/`에 있다.

아래는 **이번에 실행한 명령의 기록**이며, 실패한 경로를 자동 반복하는 지시가 아니다. 첫 공급자 오류·사용량 불명·기록 실패·배정 추정 예산 도달 시 추가 호출을 중단한다. Stage는 생성 실패도 중단 조건으로 삼는다. 브라우저 도구는 DB를 초기화하지 않으며 기존 전용 합성 DB와 output-root/ui 빌드가 필요하다.

~~~powershell
node --experimental-transform-types evals/emotion-jev.ts --synthetic-inputs --allow-jev-api --max-cost-usd 0.005 --output-root J:/ai/ai-character-runtime/emotion-live-20261011/runs
node --experimental-transform-types evals/emotion-expression.ts --output-root J:/ai/ai-character-runtime/emotion-live-20261011/runs
node --experimental-transform-types evals/emotion-participation-stage.ts --synthetic-inputs --validation-env J:/ai/ai-character-runtime/model-comparison/grounding-v2/test.env --output-root J:/ai/ai-character-runtime/emotion-live-20261011/browser --real-dialogue --allow-jev-api --max-cost-usd 0.005
~~~

수정 전 소스에서 저장된 응답을 오프라인 Core로 재생해 추가 유료 호출 없이 J05의 defer와 J06의 clarify를 재현했다. 당시에는 유효한 침묵 기록을 주어도 먼저 적용되는 uncertain 분기 때문에 J06이 reengage에 도달하지 않았다. 이는 실제 Stage 성공이 아니며, 이후 승인된 감정·참여 판정 분리 수정의 근거다. 이 실패 원본은 보존하며 수정 후 결과와 섞지 않는다.

<a id="runtime-conversation-start"></a>

## 최근 대화 R1 실행 안내 — 2026-10-13

최근4교환의 실제 전달 대사와 삭제 전파 코드가0004 migration의 새 컬럼을 사용한다. 이번 적용/검증 대상은 J:의 새 character_runtime_conversation_test이고 기존 운영/증거 DB에는 적용하지 않았다. 기존 DB로 runtime을 시작하기 전에 저장소 루트에서 아래 기존 migration 명령을 실행한다. MIGRATION_DATABASE_URL(설정돼 있으면) 또는 DATABASE_URL의 권한을 사용하며 seed/reset을 함께 실행하지 않는다.

~~~powershell
node --experimental-transform-types scripts/db.ts migrate
~~~

권한이 없으면 필요한 권한 승인을 요청하고 다른 DB/소유자 권한으로 우회하지 않는다. 실제 R1 검사와 R2 생성 비교 결과는 [구현 결과](./IMPLEMENTATION_PLAN.md#conversation-build-r1-r2)·[검증 결과](./VALIDATION_PLAN.md#conversation-build-evidence)를 따른다. 이번 Gemma B/C 생성 후보는 미채택이므로 운영 기본을 바꾸는 명령을 추가하지 않는다.

합성 출처 재검사는 이미 생성한 J: DB와 `J:/ai/ai-character-runtime/conversation-v1/test.env`를 사용한다. 기존 pg_ctl 시작 명령의 J: cluster/55434를 기동한 뒤 `node --env-file=J:/ai/ai-character-runtime/conversation-v1/test.env node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts --configLoader runner --no-cache evals/conversation-context.test.ts`로 확인한다. helper는 전용 profile/URL/실제 DB를 검사한 뒤 이 새 합성 DB만 reset한다. 기존 evidence DB를 reset하지 않는다. 로그·임시·모델 cache는 J:/ai에 둔다. 완료된 dev36은 ledger로 중복 전송을 차단하므로 재현을 이유로 자동 재호출하지 않는다.
# OpenAI 생성 비교 실행 기록 — 2026-10-14

이번 고정 비교는 `node --experimental-transform-types evals/conversation-api-eval.ts --synthetic-inputs`, 적격 dev 뒤 같은 명령에 `--confirmation`을 더해 실행했다. 출력/임시/원장은 `J:/ai/ai-character-runtime/openai-generation-20261014/`다. 이 두 단계는 이미 실행됐고24회 한도·후속 계수 오류로 종료됐다. 명령 재실행이나 새 원장으로 반복하지 않는다. 현재 소스 변경은 frozen manifest와 달라 재실행 gate도 거절한다.

비밀 파일은 `runtime-data/dialogue-api.env`이며 키는 채팅이나 로그에 쓰지 않는다. 기본 ollama를 그대로 둔다. 명시적 OpenAI 선택에는 LOCAL_ONLY=false, ALLOW_PAID_PROVIDERS=true, DIALOGUE_PROVIDER=openai, DIALOGUE_MODEL=gpt-6-sol, DIALOGUE_API_KEY, 양수 DIALOGUE_BUDGET_USD(USD1 초과는 별도 명시 승인과 OPENAI_BUDGET_AUTHORIZATION 필요), DIALOGUE_BUDGET_PATH가 모두 필요하다. 운영 선택용으로 아직 적용하지 않았다. 원장은 초기화하지 말고 unknown/reserved·실패 여유분을 보존한다.

사용자 재개 후 model/input/reasoning/text 계수 계약의 실제24건 확인을 마쳤다(delta0). 계수 전용 실행기는 `node --experimental-transform-types evals/conversation-api-count.ts --synthetic-inputs --authorized-count-continuation`이며 이미38회 실행됐고 같은 phase 재실행을 거절한다. 이전 실패 예약을 보존하며 새 계수 오류는 다시 차단한다. 생성0·보수 원장 누적 USD0.836065이고 일반 runtime의 원장은 여전히 차단 상태다. 이후 사용자의 개발용 수용을 확인했고 Goal2를 실행했다. 현재 후속 상태는 아래 Goal2 절을 따른다. [결과·비용·남은 검증](./docs/OPENAI_GENERATION_RESULT.md)과 [판단 후보 검토](./docs/OPENAI_DECISION_REVIEW.md)를 따른다. 아래 이전 실행 기록은 당시 조건의 근거다.


## Goal2 실행·중단 기록 — 2026-10-14

`node --experimental-transform-types evals/conversation-actions-probe.ts --synthetic-inputs --allow-jev-api`로 후보 하나만 실행했다. 출력은 J:/ai/ai-character-runtime/goal2-conversation-20261014/provider, 할당.01/기존 Jev1이다. 이미22회 사용했고 오류로 종료했으며 같은 root는 중복 실행을 거절한다. 새 root로 자동 재시도하지 않는다. 기존 알려진 누적 USD0.021049266+과거 usage불명1회를 유지한다.

DB 회귀는 c2-20261011/test.env의 전용55435, 최근 문맥 회귀는 conversation-v1/test.env의 별도 전용55434에서 각각 실행한다. reset 검사와 실제 Stage를 동시에 돌리지 않는다. 이번 새 schema/migration은0이다. 운영 factory의 Jev v6/Gemma를 유지하고 새 candidate를 준비 검사나 실제 runtime에 자동 연결하지 않는다. 후속 Decisions의 현재 상태는 아래 절을 따른다.

## Decisions 비교 종료 기록 — 2026-10-14

사용자 “써도됨” 승인 뒤 `node --experimental-transform-types evals/openai-decisions-probe.ts --synthetic-inputs --allow-decisions-api`를 실행했다. 같은 OpenAI USD1 원장과 이전 unknown count 예약을 보존하며 dev24를 실행했고 기능21/24로 후보를 거절했다. 이 명령은 이미 생성된 provider 폴더/원장의 decision entry가 있으면 재실행을 거절한다. HA12·추가 생성·재시도·Stage0이다.

[현재 결과와 자료 경로](./docs/GOAL2_DECISIONS_RESULT.md)를 따른다. 단위245·일반 합성 DB/평가기103·타입 exit0이다. 이번에 켠 전용55435 DB는 종료했고 listener0을 확인했다. 평상시 runtime 원장은 이전 unknown 예약으로 계속 차단된다. 평가용 판단 재개는 별도 명시적 role continuation이며 다른 역할이나 새 unknown의 재개를 허용하지 않는다. 운영 전환이나 추가 실행이 필요하면 먼저 새 계약·평가 범위를 고정한다.
