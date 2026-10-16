# 감정 런타임 구현 계획 v3

## 현재 상태 — 2026-10-15 최종 실행 기준

최근의 유효한 침묵 선택을 감정 강도와 분리했다. 최신 실제 v5→OpenAI→Chrome r5의16입력과 공개 목표가 모두 PASS(발화11·침묵5·ACK22)다. 집중 단위194·DB103·Coordinator/프로토콜32·타입, 불확정 강도 합성 Chrome16입력, 변경 후 강제 종료·재시작과 실행 프로필 시작 검사를 통과했다. G3-S 고정 시나리오와 G3-L 검증을 마쳤고 G3-U 제작자 수용은 미확인이다. 이전 r4 NOT_REACHED는 보존한다. [현재 결과·실행법·다음 개발 단위](./docs/TEXT_MVP_FINAL_STATUS.md)를 따른다.

## 이전 기록

아래의 현재/최신/다음·비용·한도는 각 실행 당시 기록이며 위 판정을 대체하지 않는다.


### 이전 시점 요약

[구현·실제 결과](./docs/RESPONSE_PRESSURE_RESULT.md): 선택형 Decisions v5에 압박 근거를 추가했다. 첫 윽박지름에는 경계를 말하고 최근 경계 전달 뒤 재압박에는 침묵하며 감정·숨김을 유지한다. 최종 단위221·합성 DB52·타입, 실제 수정 판단 dev6+새 대조4, 정상 앱/Stage4입력을 확인했다. 첫 후보4/6 실패는 보존했다. 누적 모델 사용량 추정 USD0.1575894, 예약 포함 USD1.5292894/3이며 청구액은 아니다. v5 전체16입력과 제작자 품질 평가는 별도다. 아래 G3-S16 및 비용은 당시 시점 기록이다.


### 이전 시점 요약

[실제 G3-S와 한국어 수정 결과](./docs/G3_LIVE_ACCEPTANCE_RESULT.md): r3 실제 Decisions v4→OpenAI→Stage 16입력 기술 PASS, 침묵5·발화11·ACK22, 자연스러운 경로의 의도적 숨김 도달. 후속 한국어 지침과 문장 형태 불확실성에 의한 불필요한 확인 질문 계획을 수정하고 실제 생성 대조5건을 확인했다. 마지막 집중 Core·adapter200/200·합성 DB49/49·타입 통과. 후속5건은 Stage 재실행이 아니며 제작자 수용(G3-U)은 아직이다. 당시 다음 단계는 제작자 평가와 최종 경로 확인이었다. 현재 실행 순서는 위 현재 상태를 따른다. 보수 차단 합계 USD1.4943668/3, 완료 모델 사용량 추정 USD0.1479218이며 청구액은 아니다. 기존 미확인 예약을 보존했고 신규 미확인 호출은 없다.

아래 기록의 ‘현재/최신/다음’ 및 중단·한도 수치는 해당 실행 당시의 역사 기록이다. 현재 상태와 다음 작업은 위 연결 문서를 따른다.




최신 구현: [증가량0 침묵의 기존 감정 원인 연결](./docs/G3_LIVE_PARTIAL_RESULT.md#후속-구현-증가량0인-침묵에도-기존-원인-유지). 같은 상대의 남은 원인을 새 withholding sourceRefs에 결합해 반복 이유 공개에 사용하고, 삭제 시 진행 응답까지 무효화한다. 감정 수치·문턱은 유지. Core56·DB73·타입 통과, 실제 API 추가0. 실제 r1의 낮은 감정값과 미확인 생성 예약, G3-S/G3-U 미완료는 그대로다.

후속 오프라인 개선: [실제 시각 반사실 진단·r8](./docs/G3_LIVE_PARTIAL_RESULT.md#후속-오프라인-진단과-검증기-개선). 작은 공격 기본 반응만으로는 공개 문턱 미도달임을 확인해 제품 숫자는 유지했다. 검증기는 미도달을 숨기지 않고 나머지 장면을 계속한다. 불확실한 반복 공격 합성16입력 실행 계약 PASS·공개 목표2개 NOT_REACHED, 자막11/ACK22·정산·종료 확인, 추가 유료 호출0. 실제 모델 품질/G3-U는 미완료다.

최신 실제 결과: [G3-S 일부 실행과 중단 원인](./docs/G3_LIVE_PARTIAL_RESULT.md). 승인 USD3·기존 기록 보존. 실제6입력 완료/7번째 중단, 자막4개·ACK8개 확인. 두 번째 공격의 강도 불확실성으로 감정 자극0이어서 예상 partial에 도달하지 않았다. 검증기가 진행 중 생성1건을 조기에 끊은 결함을 수정했고 미확인 예약은 보존했다. 유료 재시도는 중지했으며 아래 리허설·이전 결과는 각 당시 범위다.

<a id="runtime-baseline-20261015"></a>
## 재검토 후 실행 순서 — 2026-10-15

### B1 감사 수정과 B2 실행 범위 — 2026-10-15 후속

최신: [고정16입력 리허설과 실제 실행 준비 범위](./docs/G3_ACCEPTANCE_REHEARSAL_RESULT.md). 합성 공급자·정상 앱·실제 Chrome에서 16/16을 확인했다. 실제 공급자 판단·생성으로 수행하는 G3-S와 제작자 수용은 남아 있다. 후속 r5는 동일 이유를 설명한 뒤 공개를 줄이는 deflect까지 통과했다. 사용자가 총 차단 상한 USD3를 승인했고 기존242개 entries/unknown 예약을 유지해 원장 한도만 갱신했다. 다음 실제 실행은 신규 판단16·생성 최대11, 누적89/40으로 제한한다.

최신 후속: [작은 감정 반응·숨김 도달성·표현 평가 계획](./docs/EMOTION_POLICY_FOLLOWUP.md). 비용 진단 분리와 표시 중 캡처를 구현·검증했다. 이후 선택형 v4의 작은 긍정 반응을 단위75·DB19·타입 검사와 실제 판단1회로 확인했고, 합성 공급자를 사용한 실제 프로세스 재시작도 검증했다. 최초 표정 기대 오류는 실패 기록을 유지하고 별도로 판정했다. 자연 숨김과 감정 표현 대조, G3-S16·제작자 수용은 남았다.

**최초 B2 실행 기록:** 아래 고정 범위를 수행했다. 단위112·DB67·프로토콜14·Chrome fixture4건 통과. 실제 B2는 판단8/생성4·침묵4를 완료했지만 happy 미도달로 제품 기준 미통과다. 당시 후속 과제였던 작은 감정 자극 정책과 표시 중 DOM/캡처 수집은 위 최신 후속에 반영했다. 초기 실패와 이후 검증 범위는 [결과·비용 정정·다음 작업](./docs/EMOTION_RUNTIME_RESULT.md)을 따른다.

사용자 “할수있는 최대한 진행”에 따라 감사의 R1(판단 차단 전 계수 호출), R2(생성 차단이 판단도 막음)를 수정한다. Coordinator의 판단 이력은 생성 tokenizer 대신 최대4교환·8메시지와 UTF-8 8192바이트로 제한하며 오래된 교환 전체만 제거한다. 공급자 자체 요청 크기 검증도 유지한다. 생성 단계의 정확한 history768/input3328/output256 토큰 제한은 그대로다. 판단 실패나 생성 차단에서는 선택 기억의 생성용 계수를 생략한다. 같은 원장의 금액·과거 예약·역할별 누적 상한을 보존한다.

성공 기준: R1 차단된 판단 입력은 계수/판단/생성 호출0·원장 동일·기술적 보류, R2 생성만 차단된 입력은 판단 가능·감정/의도적 침묵 저장·생성0·다음 입력 처리 가능. 모의 API 회귀2개는 수정 전 실패했다. 수정 후 집중 단위112·실제 시험 DB 통합67·타입 검사를 통과했다. DB 시작 명령의 누락된 `-p 55434`도 실제 연결 실패로 확인해 RUNBOOK을 수정했다. 이전104·Stage2 증거는 당시 범위로 보존한다.

사전에 고정한 B2 범위: 새 합성 DB의 일반 앱에서 중립 질문→칭찬+듣기→같은 질문→직접 공격3회→같은 질문까지 상태를 초기화하지 않는다. 마지막 이유 질문은 frustration=.65의 명시적 상태 주입 대조로만 deflect 표현을 검사하며 자연 대화 도달로 계산하지 않는다. 최대 판단8·생성4, 기존 OpenAI 원장 누적72/29·총USD1에서 실행한다. 실제 비용 예약 부족/공급자 오류 시 중단하며 실패 예약을 지우거나 자동 재시도하지 않는다.

B2 성공 기준: 실제 중립/기쁨/불편함 계획 도달 여부를 상태·표현·대사·자막/ACK로 대조한다. 동일 질문의 사실(모임 오후3시) 보존, 한국어 반말·문장 제한 준수, 감정 회복/원인 창작0, 숨김에서 실제 모름과 혼동/원인 누출0을 확인한다. 계획 미도달은 대사 품질 실패와 구분한다. 자연스러운 감정 차이와 제작자 수용은 출력 비교를 제시하고 사용자가 평가해야 하며 자동 PASS로 대체하지 않는다. 공격 사이10초를 유지하고 별도 실패 문항 재실행은 하지 않는다.

사용자 “수정 및 진행”에 따라 Core/Store와 교체 포트는 유지하고, 후보 평가 중심에서 실제 앱 연결→감정 체험→필요 결함 수정 순서로 진행한다. 최근 실시간4입력은 모두 neutral/normal 표현 계획이었으므로 감정 말투·의도적 숨김을 검증한 것으로 확대하지 않는다. 기존 Goal3의 네 장면16입력과도 구분한다. 기준선 후보는 Decisions v3 + 개발용 수용된 OpenAI 생성기이며 Jev/Gemma는 선택·원복 경로로 유지한다. API를 써도 내부 감정 상태를 제거하지 않는다.

1. **B1 실제 앱 연결(구현·집중 검증 완료):** `migrate.ts`의 마이그레이션 이름/해시를 정상 진입점에서 검사하고, `providers.ts`/`local-config.ts`에 v3 선택을 연결한다. `openai.ts`의 기존 원장·unknown 비용을 보존하면서 명시적 누적 판단/생성 횟수 승인을 설정으로 전달한다. `diagnose.ts`와 준비 상태는 선택한 provider와 차단 사유를 표시한다. 기존 실패 원장을 초기화하거나 새 파일로 옮겨 호출을 허용하지 않는다.
2. **B2 감정 체험:** 실제 입력의 상태→표현/공개 계획 도달성을 먼저 확인한다. 같은 B 질문의 중립/기쁨/불편함 대조와 사전 선택한 숨김, 짧은 자유대화에서 사실 보존·말투 지속·숨김/누출·이유 창작을 판단한다. 상태 주입 대조는 표현층 검사로 표시한다. 제작자 체감을 자동 점수로 대신하지 않는다.
3. **B3 MVP 마감:** B2에서 발견한 층만 수정하고 기존 G3-S 16입력의 미검증 범위와 G3-L 생명주기를 확인한다. 원래 G3-U 제작자 수용을 충족해야 완료다. 다중 원인 정밀 배분·새 모델 탐색·steering·RAG·음성·아바타는 필요 증거가 생길 때까지 보류한다. 과거 활동 원인이 단일 사용자 수선도 막을 수 있는 제한은 실제 사용할 DB에서 확인한다.

| B1 기준 | 증명 방법 |
|---|---|
| B1-S 정상 앱 시작 | 수정 전 migration4 DB 시작 실패 재현. 수정 후 공식 `apps/runtime/src/index.ts`로 시작·인증된 readiness·Studio/Stage 접근. 누락/변조 schema는 차단 |
| B1-P 선택/출처 | 실제 registry에서 v3+대응 verifier 구성, Jev 기본 유지, 잘못된 모델/키/유료 설정 차단. fixture 응답으로 실제 v3 해석·출처 계약 확인 |
| B1-B 예산 | 같은 원장의 기존 entries/unknown 비용 보존. 역할별 누적 상한, 승인 없는 변경, 새 unknown/lock/잔액 부족 차단. health/진단은 API 호출과 원장 쓰기0 |
| B1-D 문서/진단 | 현재 기획은 선택한 판단기→선택한 생성기, 역사적 Jev 기록은 보존. 최근4입력·원래16입력과 기술 경로·체감 수용 구분 |

**B1 최초 실행 기록:** 일반 앱 entry/factory에 Decisions v3 + OpenAI 생성을 선택 가능하게 연결했다. migration4 DB 시작 결함을 수정했고 집중104건·타입·UI build와 실제 두 입력(듣기 침묵→이유 설명 Stage)을 통과했다. 기존 Jev/Gemma 설정은 유지하며 새 합성 프로필에서 검증했다. 판단64/생성25 누적 상한은 소진됐고 공유 보수 원장은 USD0.8730635/1이다. [B1 일반 앱 결과](./docs/RUNTIME_BASELINE_RESULT.md)를 따른다. 이는 최초 B1 실행 당시의 기록이며, 후속 감사 수정·B2 결과는 위 현재 로드맵을 따른다. 원래 G3-S 16입력·G3-L·G3-U는 남아 있다. 시작 전211 entry/판단62/생성24와 unknown 예약1건은 보존했고, 범위를 고정한 실제 판단2·생성1·계수4 뒤218 entry가 됐다. B1-S/P/B/D 결과와 파일·증거는 위 결과 문서를 따른다.

<a id="goal-roadmap-20261014"></a>
## 현재 로드맵 — 2026-10-15

**Goal1 개발용 수용과 Goal2 구현·집중 검증을 완료했다.** 최근의 유효한 침묵 선택을 감정 강도와 분리했다. 최신 실제 v5→OpenAI→Chrome r5의16입력과 공개 목표가 모두 PASS(발화11·침묵5·ACK22)다. 집중 단위194·DB103·Coordinator/프로토콜32·타입, 불확정 강도 합성 Chrome16입력, 변경 후 강제 종료·재시작과 실행 프로필 시작 검사를 통과했다. G3-S 고정 시나리오와 G3-L 검증을 마쳤고 G3-U 제작자 수용은 미확인이다. 이전 r4 NOT_REACHED는 보존한다. D1–D3 공개 의사 분리의 [구현·실제 검증](./docs/DISCLOSURE_CONTEXT_RESULT.md)을 완료했다. 다음 필수 항목은 제작자 수용이며 [전체 실제 대화](./docs/TEXT_MVP_REVIEW.md)를 준비했다. 기존 실제 실패와 v4 r3 PASS는 당시 범위로 보존한다.

이전 R2와 Goal 1-B dev36의 실패 점수를 보존한다. 후속 Ollama 0.31.2의 Qwen 진단8건은 형식8/8이지만 이유 설명·역할·예시 사실 유입·반말 문제가 남아 미채택이다. 로컬 후보의 H12는 미진행이었으며, 같은 H12는 이번 API 확인에서 처음 사용했다. 2026-10-14 사용자 “어”로 OpenAI 후보의 개발용 수용을 확인했다. 최종 Stage 수용은 별도다. [Goal 1-C 계획](./docs/DIALOGUE_API_COMPARISON_PLAN.md)은 한 API 후보의 dev12/확인12와 비용·출력·의미·말투 기준을 정한다. 생성 후보 수용 전에는 R3/R4·Goal 2–6을 자동 시작하지 않는다.

제품 목적은 감정의 지속·변화·표현이다. steering 제안은 선택적 표현 연구로만 반영한다. Core가 감정·기분을 저장하고 Plan이 참여·공개 수준을 결정한다. 모델의 생성 문장이나 벡터는 상태를 직접 바꾸지 않는다. 음성·아바타·RAG·가족 음성 구분·퍼즐 정밀 회상·새 감정 축은 이번 완료 조건에 추가하지 않는다.

### 여섯 Goal과 실행 단위

| Goal | 결과물 | 선행 조건 | 현재 상태 |
|---|---|---|---|
| 1. 문서 정합성과 생성기 선택 | 1-A 문서, 1-B 로컬 비교 종료, 1-C API 한 후보 비교 | 1-C는 서비스·별도 예산·키 확정 후 | 완료: OpenAI 생성24·계수24 확인, 개발용 수용 |
| 2. 대화 행위와 제한된 수선 | 의미 기반 이유 질문·듣기·사과 처리, 기존 감정 지속 보존 | Goal1 개발용 수용 완료 | 구현·집중 검증 완료: v3 의미 평가와 v5 압박 dev6/6·대조4/4·실제 Stage4입력; 전체 제품 수용은 Goal3 |
| 3. 텍스트 MVP 수용 | 선택한 판단기부터 Stage까지 연속 대화와 제작자 수용 | Goal 2 | G3-L 완료; 공개 의사 분리 후 실제 G3-S r5 16/16·공개 목표 PASS; G3-U 미확인 |
| 4. steering 기술 가능성 | 선택한 모델의 activation 추출·적용·해제 가능성 판정 | Goal 1의 모델 결정 | 보류, 선택 연구 |
| 5. steering 추가 효용 | 같은 backend의 off/on 대조와 품질·비용 판정 | Goal 4 가능 판정 | 보류, 선택 연구 |
| 6. 선택형 표현 provider | 기본 off 통합, 실제 Stage 검증·원복 경로 | Goal 3과 Goal 5 통과 | 보류, 선택 확장 |

**텍스트 MVP의 완료 지점은 Goal 3이다.** Goal 4–6의 성공을 기다리지 않는다. 각 Goal은 정해진 구현·집중 검증·범위 감사·문서 인계까지 한 묶음이다. 실패 원인이 확인되면 해당 범위만 수정하며, 같은 작업의 수정/감사 반복은 최대 세 차례로 제한한다. 미달 기준을 낮추거나 다음 Goal로 자동 진행하지 않는다. Goal 4는 Goal 2–3과 논리적으로 독립이지만 GPU 실행은 직렬로 한다. 이 표는 병렬 에이전트 생성 지시가 아니다.

<a id="goal-1-installed-model"></a>
### Goal 1 — 문서 정리와 설치 모델 비교

**1-A:** 현재 상태·다음 작업·역사 기록의 구분을 맞추고 이 로드맵과 [평가 기준](./VALIDATION_PLAN.md#goal-validation-20261014)을 저장한다. 소스·설정·DB·실험 증거는 바꾸지 않는다.

**1-B / 새 실험 installed-model-v1:** A=현재 Gemma content-first 기준선(새 recentConversation 이력 제외), B=Gemma + 기존 `conversation-history-v1`, C=설치된 `qwen3.5:9b-q4_K_M` + B와 같은 지시·문맥이다. 이전 R2의 C=직접 생성과 구분한다. 공통 입력·사실·Plan·채점 기준을 고정하고 모델별 digest/tokenizer/template·실제 입력 예산·seed·출력 한도를 기록한다. A/B는 이력 효과, B/C는 모델 차이를 비교한다. 모델별 tokenizer로 전체 요청을 계수하고 기존 4096 context / 3328 input / 256 output, 최대 4교환·8메시지 / history 768 한도를 보존한다.

기존 G/H 문항으로 dev12×3=36회, 적격 후보 하나만 미사용 확인12회(최대48회) 실행한다. 이미 공개된 dev는 진단 자료다. 새 experiment ID와 모델/프로필별 candidate ID를 쓰고 이전 manifest·ledger·판정을 덮어쓰지 않는다. 확인 문항이 이미 관측됐는지 ledger로 먼저 확인하고, 관측됐다면 그대로 미사용 확인이라고 부르지 않는다. 동시 적격이면 기존 품질 총점→문맥 적합성→불필요한 내용→지연 순, 완전 동점이면 변경이 작은 B를 택한다. 확인 실패 후 다른 후보로 같은 확인 세트를 재사용하지 않는다.

[Goal 1 성공 기준](./VALIDATION_PLAN.md#goal-validation-20261014)의 엄격 오류0·품질·사용자 비교를 모두 통과해야 운영에 채택한다. 둘 다 실패하면 기존 선택을 유지하고 미채택으로 종료한다. 네 번째 prompt나 새 모델 다운로드, 유료 Jev 호출로 확장하지 않는다.

예정 파일: `evals/conversation-eval.ts`, `evals/conversation-eval.test.ts`의 실험/모델/증거 식별과 예산·확인 gate, `packages/adapters/src/ollama.ts`와 `packages/adapters/src/adapter.test.ts`의 평가용 모델 경계, `evals/provider-boundaries.test.ts`. 운영 provider 변경은 채택된 경우에만 Goal 3에서 수행한다. 이 파일 목록은 수정 승인 범위의 후보이며 불필요한 파일은 건드리지 않는다.

**1-C / 후속 선택:** [API 비교 계획](./docs/DIALOGUE_API_COMPARISON_PLAN.md)을 따른다. 로컬48회 이후 프롬프트 튜닝을 계속하지 않고 선택 서비스 한 후보를 기존 DialogueGenerator 뒤에서 비교한다. 서비스·모델·별도 예산·키는 실제 호출 전 필수 입력이다. dev12/미사용 H12의 기준을 통과하고 제작자가 수용한 뒤에만 운영 선택을 바꾼다. API를 선택하면 내부 activation 접근을 요구하는 Goal 4–6은 보류한다. Core 감정 상태와 의도적 숨김은 생성기 교체와 독립이다.

### Goal 2 — 의미 기반 대화 행위와 제한된 수선

[기존 §20.5](#conversation-redesign-v1)의 R3 계약을 이어간다. `jev-conversation-v1` 후보는 기존 v6의 다섯 appraisal 질문·strict affect·관계 권한과 분리한다. `conversation_act`는 ordinary / ask_silence_reason / listen_request / apology / clarify_target / unknown, `repair_target`은 candidate / other / unknown이다. 기존 감정 확신 부족으로 이유 질문까지 막지 않는다. 대상과 행위 각각 confidence≥.8·유일 최빈·유효 출처를 요구하며 envelope v4는 구형 v1–v3와 호환해야 한다. 어댑터가 검증한 별도 근거만 Core가 소비한다.

수선 후보는 같은 상대·세션에서 10분 이내의 가장 최근 활성 직접 비난이며 실제 frustration 원인/revision이 있어야 한다. 현재 frustration 원인이 모두 그 상대의 유효 근거이고 해당 원인에 완화가 쓰이지 않았을 때에만 `r=min(0.03, decay 후 frustration×0.10)`을 한 번 적용한다. pleasantness 증가량은 `0.1×r`, 나머지 감정·관계·hold는 그대로다. 수선 marker는 재시작·중복·근거 삭제 후에도 재사용할 수 없다. 단순 재참여나 주제 전환은 회복 근거가 아니다. 사과 안의 과거 비난을 새 공격으로 재적용하면 실패다.

예정 파일/심볼: `packages/contracts/src/conversation.ts`, `appraisal.ts`, `ai-ports.ts`; `packages/adapters/src/jev.ts`, `jev-schema.ts`, `appraisal-evidence.ts`와 대화 근거 검사; `packages/character-core/src/index.ts`의 chooseSocial/수선 적용; `packages/database/src/store.ts`의 선택·commitAppraisal·transitions.effects; `evals/conversation-eval.ts`와 대화/참여/DB 회귀. 실제 경로와 직접 소비자를 구현 전에 확인한다. R1에서 이미 만든 파일·0004 migration을 신규로 다시 만들지 않는다.

CR07–09 집중 회귀와 실제 Jev dev24/미사용 확인12를 수행한다. 오류나 남은 예산 소진 시 중단하고 기존 v6를 보존한다. 실패를 confidence 완화나 반복 prompt 튜닝으로 덮지 않는다.

### Goal 3 — 실제 연속 대화와 텍스트 MVP 완료

Goal 1에서 채택한 생성 선택을 `apps/runtime/src/providers.ts`의 기존 factory와 `DialogueGenerator` 계약으로 연결한다. eval/운영의 입력 조립과 검증 차이를 확인한다. 기존 데이터 소유권과 provider 교체 경계를 유지한다.

새 실제 선택 판단기 → Core/PostgreSQL → 선택 생성기 → Stage 평가를 **L1–L4 네 장면·16입력**으로 실행한다. L1 칭찬4, L2 불쾌·주제 전환5, L3 듣기3, L4 수선4이며 장면 안에서는 상태를 초기화하지 않는다. 기대 침묵5/발화11과 실제 표시·ACK를 대조하되 문장 segment/ACK 개수 자체는 고정하지 않는다. 실제 정책 도달과 강제로 만든 상태 검사를 구분한다. 실제 경로에서 도달하지 않은 deflect/unknown은 통제 검사 PASS와 별도로 미검증 표시한다.

예정 파일: provider factory, `evals/provider-boundaries.test.ts`, `evals/conversation-eval.ts`, `evals/coordinator.test.ts`, `evals/protocol.test.ts`, `evals/participation.test.ts`; 결함이 있는 경우에만 coordinator/Stage 직접 소비자 수정. 합성 대화 기록·실제 표시 증거·실행/중단/원복 방법을 RUNBOOK과 인계에 남긴다. 한국어 자연스러움과 사용자 수용 미달이면 MVP 완료로 선언하지 않는다.

### Goal 4 — 선택 모델에서 steering 기술 가능성

선택 모델의 **정확한 설치 GGUF**를 재사용해 공식 llama.cpp 기반의 격리 실험을 설계한다. 현재 Gemma를 그대로 가정하지 말고 Goal 1의 모델 결정을 따른다. 향후 `research/affect-steering/`에 작은 실험 소스만 두고, weights/build/cache/vector/log는 J:/ai 아래에 둔다. 이번 문서 작업에서는 디렉터리나 실험 코드를 만들지 않는다.

모델 로드, activation 추출, 벡터 적용과 해제, 같은 입력의 baseline/zero-vector 동일성, 연속 요청 간 누출, 최초·반복 추론 OOM과 실제 VRAM/RAM을 확인한다. model/backend/tokenizer/template/layer/token mask를 함께 기록한다. 시작 플래그 지원만 보고 요청별 제어 가능으로 판정하지 않는다. 결과는 가능/제한적 가능/차단으로 구분한다. 차단 시 새 HF 가중치 다운로드나 backend fork 개발로 자동 확대하지 않는다. 근거와 불확실성은 [연구 보완](./REPRESENTATION_STEERING_RND.md#steering-update-20261014)을 따른다.

### Goal 5 — 표현에 추가 이득이 있는지 반증 실험

첫 대상은 **표현이 허용된 joy 한 축**이다. Core 상태·참여 선택·공개 수준은 고정한다. 의도적 숨김은 steering off, 침묵은 생성 호출0으로 시작한다. 120쌍(탐색60/보정30/보류30), 행동·대사 평가 보정60/보류60, 능력 유지100문항을 초기 상한으로 잡는다. 최대 세 layer(깊이 약1/3·1/2·2/3), activation norm 대비 0/±1%/±3%는 보정에서만 비교하고 보류 전에 고정한다. 수치들은 아직 검증되지 않은 실험안이다.

같은 backend의 steering off/on을 주 비교로 하며 zero·동일 norm 무작위·관련 개념·반대 방향·라벨 shuffle을 반증 대조로 사용한다. paired mean difference와 difference of means를 독립 방법 두 개로 세지 않는다. 주 평가는 **승인된 표현 계획에 맞는 한국어 대사**이며 Core의 행동 선택률 변경이 아니다. 감정 단어·느낌표 증가만으로 성공 처리하지 않는다. content-first의 초안과 대사가 같은 호출에서 생성되므로 내용 왜곡도 함께 평가한다.

예정 파일: Goal 4의 격리 연구 소스/평가 manifest와 이 연구 문서·검증 계획. 제품 소스 변경은 없다. 추가 효과·불확실성·능력 손실·지연·사용자 가림 비교를 모두 보고한다. 실패/불확실 결과는 샘플·세기 자동 확대 없이 미채택한다. 과거 R&D의 독립 평가자3명 조건은 일반화 연구용이며 개인용 MVP 완료를 막는 조건으로 새로 옮기지 않는다. Codex 자체 채점은 독립 사람 평가가 아니다.

### Goal 6 — 선택형 표현 provider와 원복

Goal 3과 Goal 5가 모두 통과한 경우에만 기존 `DialogueGenerator` 뒤에 선택형 provider를 구현한다. vector/layer/strength는 provider 내부 설정에 두고 CoreState·공개 wire schema에 넣지 않는다. Core/DB → Plan → 표현 provider → 기존 출력 검증/epoch → Stage 순서를 지킨다. 기본 off, 첫 통합은 허용된 joy 표현만 대상으로 한다.

예정 파일: `apps/runtime/src/providers.ts`, `packages/adapters/src/`의 선택 backend 구현, 기존 provider 설정 소유 파일과 경계 검사, coordinator/protocol 관련 회귀, RUNBOOK. 새 공개 포트나 DB가 정말 필요한지 먼저 확인하고 불필요하면 만들지 않는다. 취소·timeout·삭제 뒤 늦은 Stage 출력, 한 요청의 숨은 fallback 중복 호출, happy→hidden→neutral 간 벡터 누출을 금지한다. provider 교체가 감정 이력을 초기화해서도 안 된다. 실제 Stage·사용자 수용에서 추가 이득이 사라지면 기존 provider로 원복한다.

### 공통 실행 제한과 기록 규칙

- 합성 입력만 사용한다. 개인 파일·음성·새 다운로드·유료 API는 문서 작성만으로 승인되지 않는다. 이번 Goal 1-B는 기존 모델만 사용했고 유료 호출0이다.
- 후속 Jev 실검증은 기존 누적 USD 1 승인과 ledger를 이어간다. 예산을 Goal마다 초기화하지 않고 과거 usage 미확인 건도 보존한다. 공급자 오류나 비용 한도에서는 중단한다.
- 실험/모델/캐시/로그는 J:/ai 아래에 저장한다. 쓰기 권한이 없으면 다른 드라이브로 우회하지 않고 필요한 권한을 요청한다.
- 기존 C1–C4, R1–R4와 연구 G1–G5는 과거 문서의 식별자다. 새 작업은 반드시 “Goal 1–6”으로 표기한다. 이전 실패·감사·PASS는 원래 날짜와 조건을 유지한다.
- 아래 번호 절은 당시 계획/구현 기록이다. 특히 §20.4의 Gemma 세 방식 비교와 §23–24의 다음 감사 안내는 역사 기록이며 현재 다음 제안은 Goal 1-B 평가기 변경의 AUDIT다.

## 이전 계획·실행 기록

> **현재: [§23 R1-A01/A02 수정 BUILD](#conversation-repair-build), 2026-10-13.** 두 결함을 수정하고 필수 기준10개·단위111·통합146·타입 검사를 통과했다. 새 감사는 아직 수행하지 않았다. §22는 승인된 수정 계획, [검증 §24](./VALIDATION_PLAN.md#conversation-repair-evidence)는 실제 결과다. R2 후보 미채택과 Gemma/content-first·Jev v6, R3/R4 미착수 상태를 유지한다.

**다음 제안은 §23 수정 delta의 감사다.** 전체 목표는 [§7](#completion-goals), 후속 대화 개발 순서는 §20의 R1–R4에 남긴다. 아래 §1–6의 실험과 실패는 당시 기록으로 보존한다.

2026-10-11 현재: 후속 §7.3–7.4의 content-first/Gemma가 C1-A–D를 지정 범위에서 통과해 로컬 선택으로 채택됐다. 실제 Jev7입력→Stage 침묵3·발화완료4를 확인했다. 후속 같은 컨텍스트 감사와 §7.5의 재로딩 확인을 수행했다. C2는 §8의 점진 회복·저장 경계까지 구현했으며 전체 C2–C4·ER07은 미완료다. R-HIST1 과거 회상 오류와 표현 한계를 [현재 인계](./BUILD_HANDOFF.md)에 공개한다. 아래 §5–6의 실패/감사 판정은 당시 기록이며 덮어쓰지 않는다.

기존 P00–P21, §14–18.11 전체는 [이전 구현 계획](./docs/archive/2026-10-11-before-emotion-runtime-v3/IMPLEMENTATION_PLAN.md)에 원문 보존했다. §18.11의 grounded-v2 BUILD가 실패한 사실은 유지한다. 그 실험의 다음 AUDIT/추가 후보가 새 감정 MVP의 자동 선행 작업은 아니다.

## 1. 이번 개정의 결과

- 핵심: 감정 지속·상황 해석·선택적 발화·침묵 이유와 재접근·표현 조절·실제 대사/Stage. 기존 내부 ID·데이터 정합성은 보존.
- 후순위: 퍼즐 풀이·도움 정밀 회상·퍼즐 재개·장기 공동 개인사.
- 가능한 후속: RAG 홈 비서, 필요하면 음성 기반 가족 구분, 음성·아바타·방송. 확정된 개발 순서는 아니며 가족 구분은 현재 개발 요구에서 제외.
- 최초 기획 개정과 E0 이후, 사용자가 침묵·재접근·감정 지속 개발을 승인했다. 기존 state JSON/전이에 이유를 추가하고 기본 표현 prompt를 변경했다. 모델·wire·DB migration은 추가하지 않았다.

## 2. 재사용할 현재 기반과 차이

| 기반 | 재사용 방향 | 확인할 차이 |
|---|---|---|
| Core의 apply/decay/socialEffect/dialoguePlan/chooseSocial | 네 감정·기분·반복·행동/표현 계획 재사용 | 상태가 대사에 실제로 전달되고 체감되는지 미검증 |
| PostgreSQL/Store/Coordinator | 입력·state·근거·대사 lifecycle·ID·복구 유지 | 활동 경로가 없어도 기본 감정 대화가 충분히 동작해야 함 |
| JevAppraisalProvider | 필수 사건 해석 유지 | 기존 한국어 품질 문제와 오류 중단 상태가 남음 |
| OllamaProvider | 현재 설치 모델·transport·tokenizer·validator 재사용 | 기본 prompt를 일반 캐릭터로 변경. 과거 v1/v2 실험은 당시 실패 기록으로 보존 |
| Studio/Stage | 텍스트 입력·관찰·실제 표시 경로 활용 | 일반 감정 대화의 전체 시연과 자연스러움 평가는 새로 필요 |

현재 구현: `chooseSocial`이 speak/silent/defer를 구분하고, Store가 `turn.recentSilences`와 `transitions.effects`에 이유·출처·당시 요약을 원자 저장한다. 명시적 듣기 요청·강한 직접 공격·15초 반복 제한이 침묵 후보이며 `other`만으로 발화를 막지 않는다. 재접근은 유효한 같은 상대 기록과 현재 감정으로 공개 수준을 고른다. 오류·취소·보류를 의도적 침묵과 구분하며 감정 수식은 그대로다.

## 3. 다음 개발 순서와 파일 소유자

### E0. 감정 증가량과 응답 선택 분리 — 구현·집중 검증 완료

2026-10-11 사용자는 반복 적응 개선 방향을 계획에 반영하고, 우선 감정 증가량 0 때문에 답변이 차단되는 문제를 수정하도록 승인했다.

- 변경: packages/character-core/src/index.ts의 chooseSocial에서 `effect.stimulus <= 1e-12`만으로 ignore하던 조건 제거. 같은 상대·종류의 최근 응답으로부터 15초 미만이면 기존대로 제한한다.
- 유지: socialEffect의 감정·관계 계산, 600초 반복 창, 자극 상한, 대상·불확실성 분기, 질문 처리, 기존 DB와 출력 수명 규칙. 0 자극은 실제로 0이며 답변을 위해 감정 수치를 올리지 않는다.
- 검증: packages/character-core/src/core.test.ts ER08 4건 및 evals/coordinator.test.ts ER08 1건 추가. 수정 전 Core 4건 실패와 실제 DB 경로의 네 번째 자막 누락을 재현했다. 수정 후 Core 17/17, Coordinator 12/12, DB02/D03·DB05/06 2/2, 타입 검사 PASS. DB 나머지 38건은 필터로 제외했다.
- 증거 범위: J:의 실제 합성 PostgreSQL + 모의 Jev·대사 + 출력 sink와 shown/finished 보고. 실제 공급자 평가·브라우저 표시·대사 자연스러움의 증거는 아니다.
- 로그/수정 전 소스: J:/ai/ai-character-runtime/zero-stimulus-response-20261011/. `logs/core-red.log`, `coordinator-red.log`, `core-green.log`, `coordinator-green.log`, `db-green.log`, `typecheck.log`.

검사 재현은 기존 Node/Vitest에서 `--configLoader runner --no-cache`와 J: TEMP/TMP를 사용한다. Core는 vitest.config.ts의 core.test.ts, Coordinator와 DB는 vitest.integration.config.ts의 해당 파일을 실행한다. DB만 `-t 'DB02/D03|DB05/06'`으로 한정한다. DB 접속은 기존 grounding-v2/test.env이며 loopback55434·character_runtime_test·grounding-v2/postgres 경로를 확인한 뒤 실행한다. 테스트는 합성 데이터를 reset하므로 운영 DB에 연결하지 않는다. 타입 검사는 `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`이다. 사용한 테스트 DB는 종료했다.

### 반복 적응의 후속 계획 — 점진 회복 구현·사건 구분 미구현

E0 이후 일반 대화의 체험과 함께 다음을 단계적으로 다룬다. 같은 사람의 모든 칭찬을 묶는 반복 감쇠를 확실한 반복으로 좁히고, 반복 영향이 시간에 따라 점진 회복되게 한다. 단어만 바꾼 입력에 새 감정 예산을 주거나 오래 사용한 전체 감정 민감도를 영구적으로 낮추지 않는다. 그래도 새 성취·상황이 억제된다면 사건·의미 구분을 보강한다. 현 Jev에는 이 판단 정보가 없으므로 추가 필드나 모델 연결을 이미 구현한 것처럼 취급하지 않는다.

대상: Core socialEffect 및 chooseSocial, Store evidenceInputs/commitAppraisal와 정정·삭제 시 재계산 경로, 해당 Core/DB 검사. 이력 표현을 바꾸기 전 contracts/domain.ts와 DATABASE_SPEC.md의 소유 계약을 확인한다. 기존 관계 계산에 반복 자극이 사용되므로 감정 개선이 관계나 과거 근거 재계산을 조용히 바꾸지 않도록 한다. 후속 §8에서 감정 회복은 기존600초 범위의 선형 가중치로 구현했다. 관계 v1은 보존하며 의미 유사도/사건 구분은 미확정이다.

완료 증거는 동일 칭찬 장시간 반복, 표현만 바꾼 반복, 별개 사건 칭찬, 휴식 후 칭찬의 비교다. 전역 무반응·문구 변경에 의한 반복 제한 우회·시간 경계의 급변 여부를 확인하고 실제 대사로 판단한다. 후속 §8의 시간 회복·저장 경계는 검증했으며 의미별 사건 구분과 실제 표현 비교는 아직 미실행이다. E0의 PASS로 대신하지 않는다.

### E1. 감정 경로 기준선과 참여 선택·이유 저장 — 구현·단위/DB 검사 완료

대상: packages/contracts/src/domain.ts의 stateSchema/State/Plan, packages/character-core/src/index.ts의 initialState/chooseSocial/apply/decay/dialoguePlan, packages/database/src/store.ts의 state/locked/bump/commitAppraisal/responseContext와 정정·삭제 경로. 검사 소유자는 packages/contracts/src/contracts.test.ts, packages/character-core/src/core.test.ts, evals/db.test.ts, evals/coordinator.test.ts다.

ER01–ER04와 직접 연결된 기존 검사·실행 증거와 E0의 유효한 ER08 결과를 재사용한다. 새 목적에서 실제로 빠진 입력/표현 정보만 식별한다. 현재 역할과 감정 수명·출처·상태 writer를 유지하며, 연구용 정서 축이나 새 DB를 먼저 만들지 않는다. 코드 소스와 실행 설정을 확인하기 전 기존 PASS를 새 전체 경로의 증거로 확대하지 않는다.

[도메인 §10.2](./CHARACTER_DOMAIN_SPEC.md#102-화제-전환과-재참여-뒤의-감정-지속--승인된-보강-계약)의 연속성도 E1에서 확인한다. 화제 변경·발화 재개만으로 initialState를 다시 만들거나 회복 효과를 더하지 않는다. 감정 효과 없는 B 입력에서는 A 직후 affect/mood에 같은 경과 시간의 decay만 적용되는지를 ER12로 확인한다. 침묵 이유의 과거 상태 요약과 현재 상태를 구분하고, 이유 기록 교체/삭제/복구가 감정 초기화·재자극을 하지 않게 한다. 새 topic 저장소·감정 축·회복 flag나 수치 조정은 이 요청에 필요하지 않다.

E1에서 [도메인 §10.1](./CHARACTER_DOMAIN_SPEC.md#101-선택적-발화와-침묵-이유--구현-계약)을 구현했다. 필요한 내부 처리와 발화/의도적 침묵 선택을 분리하고, 이유·시점·대상·출처·당시 상태를 같은 전이에 저장한다. 기존 turn JSON에 상대별 1건·전체 20건을 추가했다. 구형 snapshot의 빈 기본값과 기존 DB CHECK 호환·세션/재시작 복구를 실제 합성 DB에서 검사했으며 새 테이블·migration·상시 모델 호출은 추가하지 않았다. 신규 통합 검사는 evals/participation.test.ts가 맡는다.

원인 정정·삭제 시 최근 이유와 전이의 관련 내용도 제거/무효화한다. 후속 설명에 참조한 원인은 response_sources에 포함하며, 생성 도중 출처가 무효화되면 해당 생성을 취소하고 출력을 막는다. 상대별 보관·교체/상한·복구는 ER11로 검증한다. 기존 `listen`/`ignore`만으로는 오류·해석 보류와 의도적 침묵을 구별할 수 없으므로 내부 결정 사유를 명시한다. 공개 wire enum을 먼저 늘리지 않는다.

Jev는 계속 의미 해석을 담당한다. 일반 입력 `other`나 전역 불확실성이 곧 감정적 침묵의 이유가 되게 하지 않는다. 기존 정보로 판단할 수 있는 맥락부터 다루며, 걱정/재촉 등 추가 의미를 구분할 정보가 없으면 미검증으로 남긴다. 점수를 맞추기 위한 confidence 일괄 완화나 새 Jev 필드·모델·API 추가는 이 단계의 기본 해법이 아니다. ER08은 다른 침묵 사유가 없는 기존 사례로 유지하고 ER09–ER11을 새 동작의 증거로 분리한다.

후속 승인 수정에서는 감정 score의 전역 uncertain을 유지하면서, 검증한 Jev 원응답의 대상·행위가 각각 0.80 이상인 유일 최댓값일 때 명시적 듣기·침묵 재질문의 참여 선택만 분리했다. 기존 사건·상대·출처 일치와 오류 경계를 보존한다. Core 34/34·참여 DB 18/18과 실제 Jev의 듣기/재질문 3건에서 uncertain·새 자극 0인 채 listening/reengage를 선택한 결과를 확인했다.

### E2. 일반 대화의 표현 계약 — 기본 prompt·context 구현

대상: packages/adapters/src/ollama.ts의 dialogue, packages/database/src/store.ts의 responseContext, CHARACTER_PRESET.md, E1의 Plan과 직접 소비자. 표현 입력 검사는 packages/adapters/src/adapter.test.ts, 실제 비교는 기존 evals/dialogue-quality.ts·evals/dialogue-models.ts에서 가능한 범위로 수행한다.

퍼즐 관심사와 도움 회상을 기본 대사의 필수 내용에서 분리하고, 고정 성격·현재 표현 의도·유효한 최근 맥락·필요한 근거만 간결하게 전달한다. 기존 expression/delivery를 어떻게 표현할지 먼저 명확히 하며 숫자 전체를 노출하거나 모델에 지속 상태 쓰기 권한을 주지 않는다. 발화 선택을 고정한 같은 질문에서 사실/목적과 성격을 유지하면서 표현 차이를 확인한다.

재접근 대사에는 유효한 침묵 이유와 당시 상태, 현재 감정·맥락, 이번 공개 정도를 필요한 만큼만 제공한다. 이유 기록 없이 “서운해서” 같은 설명을 만들지 않으며, 회피하는 “몰라”와 실제 모름을 구별한다. 설명·일부 공개·회피·재참여는 예문 복사가 아닌 표현 목표다. 외부 감정 표현을 강화하느라 사실·성격이 바뀌는지도 ER02/ER07/ER10에서 확인한다.

감정을 숨기거나 괜찮은 척하는 표현도 공개 선택의 일부다. 숨김 조건에서는 내부 감정과 대사 불일치 자체를 실패로 보지 않으며, 감정 노출을 고정한 E4 비교와 별도 대조한다. “이제 괜찮아” 한 문구가 아니라 사전 plan·맥락·출력 이후 실제 상태를 함께 검토한다. 표현 결과를 내부 회복 상태로 역반영하지 않는다.

화제 A→B에서도 prompt에는 이어진 현재 상태에서 만든 표현 의도를 전달한다. B의 의미만으로 매번 감정을 새로 정하거나 이전 감정의 강도를 숨은 초기값으로 되돌리지 않는다. A의 원인 설명을 매번 붙이지 않으며 B의 목적·사실·대상을 유지한다. ER12의 같은 B 질문을 중립/기쁨/불편함 상태에서 비교하고, 내부 상태 유지와 실제 대사 여운을 각각 확인한다. 차분한 표현이나 재참여 대사를 Core의 회복 판정으로 역사용하지 않는다.

한국어 문장 배열 JSON과 항목별/전체 검증을 사용하며 형식 오류를 잘라내거나 자동 재시도하지 않는다. 직전 실제 Stage의 explain 불이행·unknown 결함을 재현한 뒤, 재접근에는 저장 이유·공개 선택·현재 말투·현재 질문만 제공하고 한 문장으로 생성하도록 수정했다. 최종 회귀 8건·미사용 질문/seed 8건·기존 공개 비교 6건과 실제 Stage 두 설명에서 해당 결함이 해소된 것을 확인했다. deflect는 계속 허용한다. partial/explain의 세밀한 차이와 E4 전체·사용자 체감까지 완료한 것은 아니다.

현재 형식 거부로 출력이 끊기는 사례는 ER05 영향으로 따로 고친다. 사실 대사를 전부 고정 템플릿으로 대체하거나 퍼즐 실패를 감추는 후처리를 기본 전략으로 채택하지 않는다. 구조 변경은 필요한 경계와 직접 소비자를 확인한 뒤 최소 범위로 정한다.

### E3. 퍼즐 없는 기본 실행과 실제 Stage — 연결 구현, 실제 관측은 별도 기록

대상: apps/runtime/src/coordinator/index.ts의 tick/drain/dispatch, 앱의 현재 설정/입력 경로, apps/studio/src/main.tsx, evals/browser/text.spec.ts 및 필요 시 evals/real-stage.ts.

기본 감정 대화가 퍼즐 시작·풀이 성공·도움 회상·Agenda를 요구하지 않게 한다. 기존 수동 활동과 저장된 퍼즐 이력은 유지하고, 기존 데이터의 활동 재개가 기본 시연을 가로막는다면 해당 트리거만 분리한다. 발화 선택 시 Jev·상태·대사·Stage shown/finished/completed 연결을 확인하고, 침묵 선택 시 대사 호출·response/segment·대체 자막·ACK 대기 없이 종료되는 것을 실제 브라우저와 이벤트 기록으로 확인한다. 이후 재접근을 처리해 발화할 수 있어야 한다. 기술 실패·형식 거부를 침묵으로 감추지 않는다. 침묵 이유는 Stage에 그대로 노출하지 않는다.

E3에서는 침묵→B에 재참여→출력 완료 직후의 상태도 기록해 ACK나 response 완료를 감정 회복으로 오인하지 않는지 확인한다. 이는 ER12의 실제 경로 증거이며 상태 주입 대사나 모의 sink만으로 대체하지 않는다.

### E4. 짧은 비교와 사용자 체험 — 전체 비교·사용자 평가 미완료

2026-10-11 A1 후속: 재참여 delivery 전달 누락을 복구하고 deflect 숨김은 유지했다. 실제 Jev7입력→Stage에서 불편함 상태와 이유가 새 화제/재질문 뒤에도 유지됐다. 사전 고정 로컬12조건에서 형식은 통과했지만 재참여 기분3조건은 같은 대사였고 새 화제3상태는 추천 내용 변화·어색함이 있어 표현 품질 PASS가 아니다. [검증 보고서](J:/ai/ai-character-runtime/delivery-continuity-20261011/review.md)를 따른다. 다음 비교는 답변 사실을 고정하고 말투 차이를 확인한다. 전체 네 쌍·시간/새 사건 대조·ER07·반복 적응은 여전히 미완료다.

대상: VALIDATION_PLAN.md ER01–ER12. 기존 평가 도구를 가능한 범위에서 사용하고 새 합성 입력·raw·DB·로그는 J:/ai의 별도 작업 폴더에 둔다.

네 쌍 표현 비교와 ER09–ER12의 짧은 침묵→재접근·화제 전환 연속 사례를 먼저 완료한다. ER12의 B 세 조건 비교와 시간/새 사건 대조로 재참여와 감정 회복을 구별한다. 모델·입력·상태·prompt를 동시에 바꾸지 않고 비교 요인을 하나씩 고정한다. 발화 선택/형식/사실·이유 충실성/감정 표현을 따로 기록하고 사용자가 연속 대화를 보고 판단할 수 있게 한다. 인과와 자연스러움이 보이지 않는 사례만 다음 수정 대상으로 삼는다. RAG·가족 구분·음성·아바타는 별도 요청 시 범위를 정하며, 수동 ID 선택·가족 등록 UI는 이번 개발 계획에 없다. 실제 Jev 오류 중단은 기존 승인 경계에 따라 해소해야 하며, 문서 개정은 유료 재시도 승인이 아니다.

### 검증 명령과 증거 경계

작업 위치는 저장소 루트다. Node/Vitest/Playwright는 기존 설치만 사용하고 TEMP/TMP·새 raw·로그·브라우저 결과는 J:/ai의 작업 폴더로 지정한다. DB 연결은 E0에서 사용한 합성 DB의 경로·이름·포트를 다시 확인한 뒤에만 사용한다. 운영 DB를 reset하지 않는다.

| 범위 | 명령 또는 확인 방법 |
|---|---|
| State 호환·선택 정책·연속성 ER08–ER12 | `node node_modules/vitest/vitest.mjs run --config vitest.config.ts --configLoader runner --no-cache packages/contracts/src/contracts.test.ts packages/character-core/src/core.test.ts` |
| 저장·무출력 종료·정정/삭제·재참여 ER09–ER12 및 기존 데이터 회귀 | `node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts --configLoader runner --no-cache evals/participation.test.ts evals/db.test.ts evals/coordinator.test.ts` |
| 대사 context/형식 | `node node_modules/vitest/vitest.mjs run --config vitest.config.ts --configLoader runner --no-cache packages/adapters/src/adapter.test.ts` |
| 공유 계약 타입 | `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` |
| 실제 Stage/한국어 품질 | 기존 evals/browser/text.spec.ts의 해당 경로와 짧은 실제 합성 세션. 침묵 시 자막/대사 호출 없음→후속 발화 실제 표시를 관측. mock 결과·공급자 결과·브라우저·사용자 체감은 각각 구분 |

이번 구현의 집중 시연은 `evals/emotion-participation-stage.ts`, 공개/숨김 6조건 비교는 `evals/emotion-expression.ts`로 재현한다. 이전 중립/기쁨/불편함 3조건 결과는 당시 기록으로 보존했다. 저장소 루트에서 실행하며 기존 J: 합성 PostgreSQL `127.0.0.1:55434/character_runtime_test`와 기존 설치 Ollama/qwen2.5:7b가 실행 중이어야 한다. DB/모델 준비는 기존 [RUNBOOK](./RUNBOOK.md)을 따르고 운영 DB나 다른 모델로 바꾸지 않는다. 아래 브라우저 명령은 `--allow-jev-api`가 없으므로 Jev를 mock으로 고정하며 유료 API를 호출하지 않는다.

```powershell
$env:TEMP='J:/ai/ai-character-runtime/emotion-participation-20261011/tmp'
$env:TMP=$env:TEMP
node node_modules/vite/bin/vite.js build --config apps/studio/vite.config.ts --outDir J:/ai/ai-character-runtime/emotion-participation-20261011/browser/ui
node --experimental-transform-types evals/emotion-participation-stage.ts --synthetic-inputs --validation-env J:/ai/ai-character-runtime/model-comparison/grounding-v2/test.env --output-root J:/ai/ai-character-runtime/emotion-participation-20261011/browser --real-dialogue
```

`--real-dialogue`를 빼면 합성 대사로 브라우저 연결만 검사한다. UI는 output-root 아래 `ui` 빌드가 필요하다. 스크립트는 자신의 합성 세션을 종료하며 DB를 reset하지 않는다. `test.env`는 기존 합성 DB 설정 파일이며 내용을 출력하지 않는다. 공개/숨김 비교는 기존 Ollama가 실행 중일 때 `node --experimental-transform-types evals/emotion-expression.ts --output-root J:/ai/ai-character-runtime/emotion-live-20261011/runs`로 실행한다. 같은 감정·맥락에서 explain/deflect 두 쌍(seed 17/29), partial 및 기록 없는 unknown을 사전 고정한다. 이 결과는 상태·계획 주입 표현 검사이며 실제 Core 선택이나 Jev·사용자 품질 PASS가 아니다.

수정 전 실제 Jev 분류 6건과 Stage 2건은 낮은 신뢰도에 따른 defer→clarify 뒤 Qwen의 중국어 혼입으로 중단됐다. 당시 공개/숨김 비교 형식 5/6과 없는 핑계 결함을 보존한다. 당시에는 production prompt·Core·Jev 임계값을 변경하지 않았다.

이전 참여 분리 수정의 결과는 `J:/ai/ai-character-runtime/participation-korean-fix-20261011/`에 있다. 당시 경로 PASS와 대사 의미 FAIL을 보존한다. 기본 표현 대조의 `--confirmation`은 다른 질문·seed 4건이며, 결과를 본 뒤 prompt를 조정하고 같은 확인을 미사용으로 다시 표시하지 않는다. 실제 Stage는 `--real-dialogue --allow-jev-api --max-cost-usd 0.005`로 실행하고 합성 5건만 호출한다. 입력·모델·소스 hash·기대 경로는 호출 전 manifest에 고정한다. 최신 실행법과 기존 서버 준비 경계는 [RUNBOOK](./RUNBOOK.md)에 있다.

새 기준 검사에서 0건 선택/skip이면 PASS가 아니다. 영향을 받은 데이터 계약의 기존 정정·삭제·중복 회귀는 위 새 ID 검사와 함께 필요한 범위로 실행한다. 특히 이전 snapshot을 읽는 실제 DB 복구, 이유 원인 삭제 중 생성 취소, 실제 Jev에서 의미가 구분되는지는 정적 문서나 모의 검사로 대신할 수 없다.

## 4. 완료와 중단 기준

- 기술 완료: ER01–ER06 및 응답 선택 회귀 ER08, 선택적 침묵·이유/재접근 ER09–ER11, 화제 전환·재참여의 연속성 ER12에 실제 해당 증거가 있고, 실패·미검증 항목을 숨기지 않음.
- 체감 완료: ER07 사용자 평가를 받음. 코덱스 자체 점검만으로 자연스러움 완료를 선언하지 않음.
- 중단/재판단: 같은 접근의 반복 실패에는 새 근거 없이 모델·prompt 후보를 계속 만들지 않음. 기존 세 라운드 한도를 유지하고 남은 원인을 보고.
- 후속 착수: 사용자가 기반을 수용한 뒤 원하는 확장을 별도로 정했을 때 해당 계획을 작성. 가족 구분이나 RAG로 자동 이동하지 않음.

구현할 때 관련 회귀·타입·실제 경로만 검증하고 문서 정리 때문에 full suite나 유료 평가를 재실행하지 않는다. 현재 명령/도구 위치는 [RUNBOOK](./RUNBOOK.md), 실제 기준선과 제한은 [BUILD_HANDOFF](./BUILD_HANDOFF.md)를 참고한다.

최신 이유 설명 수정은 `J:/ai/ai-character-runtime/disclosure-fix-20261011/`에 보존한다. `emotion-expression.ts --replay-failures J:/ai/ai-character-runtime/participation-korean-fix-20261011 --output-root J:/ai/ai-character-runtime/disclosure-fix-20261011/runs`는 저장된 실제 실패 context 회귀 8건이며 `--confirmation`을 함께 주면 미사용 질문/seed 8건이다. 기존 기본 6건 비교는 보존했다. 실행별 source/plan/context/원문을 확인하며, 이미 본 확인 자료를 새 미사용 자료로 표시하지 않는다.

**다음 작업 인계:** 아래 §5의 H0–H3 모델 경계 정리 → Q1–Q2 표현 비교를 따른다. 기존 상태/이유 지속과 의도적 숨김을 보존하고, 구조 검사와 실제 언어 품질을 분리한다. 반복 적응 후속·RAG·음성은 이 작업에 포함하지 않는다.

<a id="model-boundaries"></a>

## 5. 모델 경계 분리와 한국어 표현 비교 — BUILD 실행 결과 반영

2026-10-11 사용자 승인: 장기적으로 Jev/Qwen을 교체하기 쉽게 헥사고날의 ports/adapters 경계를 적용하고, 같은 사실을 유지하는 감정 표현을 비교한다. 최초 계획 턴은 문서만 수정했고, 이후 사용자의 “진행해”로 아래 BUILD를 실행했다. 이 절이 승인된 범위이며, 반복 적응·RAG·음성·가족 화자 인식·DB 교체는 별도 후속이다.

### 5.1 기준선과 범위

- 기준선: main, HEAD d4a91e86715ad87c542d99266a7447911e7c36f4 + 현재 미커밋 파일. HEAD만 기준으로 되돌리거나 기존 변경을 이번 작업으로 모두 귀속하지 않는다. BUILD 시작 때 관련 파일 해시와 dirty 상태를 다시 확인한다.
- 현재 증거: J:/ai/ai-character-runtime/delivery-continuity-20261011/. A1 말투 전달 복구, Adapter42·Core34·대사 평가/기록25·실제 Jev7입력의 상태/이유 지속은 당시 PASS다. 재참여 기분3조건은 같은 문장, 새 화제3상태는 내용 변화·어색함이 있어 표현 품질은 미완료다.
- 목표: 같은 역할 계약을 만족하는 어댑터 교체가 Core·Store·Stage 변경을 요구하지 않게 한다. 구조 변경의 동작 보존을 먼저 확인한 뒤 모델별 표현 방식을 비교한다. 실제 대체 사건 해석 모델의 품질까지 완료했다고 주장하지 않는다.
- 기본 운영 조합은 Jev와 Qwen2.5:7b를 유지한다. 등록되지 않은 구현은 거절하고 자동 fallback·다운로드·새 유료 공급자는 추가하지 않는다. 설정 생략 시 기존 동작과 비용 차단을 유지한다.
- 전면 헥사고날 전환은 하지 않는다. PostgreSQL의 거래·잠금·재계산과 Stage wire/ACK는 유지한다. Store의 퍼즐 구현 결합 등 이번 모델 교체와 무관한 부분은 남긴다. DI 프레임워크·플러그인 자동 탐색·새 서비스는 필요 없다.

### 5.2 책임과 공용 계약

공용 역할·입출력 계약은 packages/contracts/src/ai-ports.ts가 소유한다. 구현은 contracts를 참조하고 Core/Store/Coordinator는 구체 모델 모듈을 import하지 않는다. 상세 계약과 과거 기록 호환은 [AI 연동 계약](./LOCAL_AI_INTEGRATION.md#planned-model-ports), 성공 기준은 [HB01–HB06·EX01–EX03](./VALIDATION_PLAN.md#model-boundary-criteria)이 소유한다.

- AppraisalProvider: evaluate(event, context) → AppraisalEvaluation. 기존 사건 해석 결과와 provenance를 반환한다. 사건 해석은 감정 강도 판단과 명시적 참여 근거를 구분하며 상태를 직접 쓰지 않는다.
- AppraisalEvidenceVerifier: verify(appraisal, metadata, {eventId, identityId}) → 유효한 target/act 근거 또는 undefined. 순수 로컬 검증이며 API 호출 없음. Store에 주입한다. Jev 원응답의 schema·확률·confidence·mapping 검사는 Jev 어댑터가 책임지고, Store는 잠금 안에서 현재 사건·revision·상대·출처·결과 일치와 세션 유효성을 계속 확인한다. raw의 verified:true 같은 표시만 믿는 구조는 금지한다.
- DialogueGenerator: dialogue(plan, readonly context) → 검증된 문장 배열. TokenCounter와 readiness/모델 식별·실패 계약도 구체 Ollama 파일 밖으로 옮긴다. Context는 현재 입력·선택된 기억/상대·유효한 침묵 기록 등 실제 Store projection을 타입으로 정의하고 임의 object/any로 경계를 비우지 않는다.
- ActivitySolver: 기존 solve 계약을 분리해 기존 퍼즐 경로에만 주입한다. 대사 전용 어댑터가 미사용 appraise/solve를 구현하도록 강요하지 않는다. 기존 활동 동작은 유지하고 퍼즐 품질 실험은 하지 않는다.
- Core/응용 계층: 사실·목적·참여·공개 정도·expression/delivery·길이를 결정한다. 어댑터: 해당 의도를 모델별 prompt/schema/tokenizer/transport로 번역한다. 프롬프트 문법은 공통 포트에 넣지 않는다. 구조 변경 단계에서는 현재 지시문·sampling·생성 한도를 보존한다.
- 실행 조립: apps/runtime/src/providers.ts(신규)의 명시적 factory가 등록된 역할 구현과 evidence verifier를 조립하고 index.ts가 주입한다. 실행 중 교체 UI는 만들지 않는다. 교체는 요청 종료·자원 정리 뒤 재시작으로 수행하며 기존 recover와 경과 시간 감쇠를 따른다.

### 5.3 구현 순서와 파일·심볼

| 단계 | 기존/신규 파일·심볼 | 작업 및 이유 | 완료 기준·의존성 |
|---|---|---|---|
| H0 기준선 고정 | 기존 evals/emotion-expression.ts, evals/emotion-participation-stage.ts, evals/participation.test.ts; 신규 evals/fixtures/emotion-expression-v1.json | 기존 실제 요청/원문/소스 hash를 보존. 고정 사실 dev/final 조건과 rubric을 추론 전에 분리한다. 이 단계는 새 모델 호출 없이 준비 가능 | HB02, EX01. H1 이전 |
| H1 역할 분리 | 신규 packages/contracts/src/ai-ports.ts; 기존 contracts/src/index.ts, adapters/src/ollama.ts의 Provider/TokenCounter, adapters/src/appraisal.ts, Coordinator 생성자·memoryBudget/dispatch/solve, http/server.ts createServer | 구현 파일 안 공용 타입을 이동하고 DialogueGenerator·AppraisalProvider·ActivitySolver 의존성을 나눈다. 출력 수명과 물리 호출 직렬성 유지 | HB01–HB02, HB05. 현재 prompt를 튜닝하지 않음 |
| H2 Jev 경계·저장 호환 | 기존 contracts/src/appraisal.ts의 metadata/result schema, adapters/src/jev.ts mapJevResponse, database/src/store.ts의 constructor/participationEvidence/commitAppraisal; 신규 adapters/src/jev-schema.ts 및 adapters/src/appraisal-evidence.ts | Jev 전용 schema/검증을 어댑터로 이동하고 공급자 중립 envelope·검증 포트를 도입한다. 버전별 등록 검증기로 구형 Jev raw를 지원. Store의 거래·유효성 경계를 보존 | HB03–HB04. H1 이후. 정상/위조/삭제/복구를 실제 합성 DB로 확인 |
| H3 실행 조립과 교체 증명 | 신규 apps/runtime/src/providers.ts; 기존 runtime/src/index.ts, contracts/src/local-config.ts/parseConfig, evals/helpers.ts, evals/real-stage.ts 및 emotion-participation-stage.ts의 조립 | 선택자는 알려진 구현만 허용. 기존 환경변수 기본값 호환, 미지원 조합 사전 거절. 역할별 테스트 어댑터로 독립 교체를 증명하고 현재 실제 조합 연결 확인 | HB05–HB06. H1/H2 이후. 새 유료 공급자나 자동 모델 탐색 없음 |
| Q1 표현 비교 | 기존 evals/emotion-expression.ts, evals/dialogue-models.ts 및 dialogue-recording.ts; 신규 위 fixture; 필요 시 adapters/src/ollama.ts의 모델별 prompt/profile | H1–H3 동작 보존 후 고정 사실 조건에서 현재 Qwen·Qwen prompt 1후보·기존 설치 모델 1후보까지 비교. 모델과 prompt를 동시에 바꾼 결과로 단일 원인을 단정하지 않음 | EX01–EX02. 승자가 없으면 탈락과 한계를 보고하고 같은 접근 반복 중단 |
| Q2 실제 경로·인계 | 기존 evals/emotion-participation-stage.ts, BUILD_HANDOFF.md, RUNBOOK.md | 선택 후보로 실제 합성 Jev→상태→침묵/발화→Stage 연속 검증. 공개/숨김·원인·현재 감정·재참여를 별도 평가하고 사용자에게 대사 제시 | EX03. 기존 자막 취소·늦은 결과·상태 소유권 보존 |

직접 소비자 변경은 rg로 위 타입/생성자 사용처를 확인해 동일 턴에 맞춘다. 테스트 소유자는 기존 packages/adapters/src/adapter.test.ts·jev.test.ts, packages/contracts/src/contracts.test.ts, evals/participation.test.ts·db.test.ts·coordinator.test.ts다. 신규 packages/contracts/src/ai-ports.test.ts는 역할별 독립 구현이 타입 검사되는지를, 신규 evals/provider-boundaries.test.ts는 금지 import와 실제 구성/교체 계약을 검사한다. 실행 factory 검사는 apps 디렉터리가 기존 unit glob 밖이므로 evals의 기존 integration 설정으로 선택한다. 단순 파일 이름 검사만으로 교체 가능성을 입증하지 않는다.

### 5.4 제한된 표현 비교와 채택

- 합성 고정 사실 2장면(예: 합성 모임 시작은 오후3시, 준비물은 파란 공책)을 neutral/happy/uncomfortable/deflect로 비교하는 8조건과 explain/partial/unknown/deflect 이유 충실성 4조건, dev12건을 사용한다. 출력 정답 문구를 주는 것이 아니라 유지할 사실을 고정한다. 나중에 시간/새 사건 회복 대조 등 E4 전체 검증을 이어가며 이12건으로 전체 완료하지 않는다.
- 서로 다른 사실·질문·seed의 확인용12건도 실행 전에 고정하고 튜닝에 사용하지 않는다. 위 두 합성 사실 예시는 계획 예시이며 구현 시 정확한 fixture·상태·문구·seed·채점 기준을 manifest에 동결한다.
- 최대3설정(현재 Qwen 기준선, 동일 Qwen의 prompt 개선1개, 설치 확인된 다른 모델1개) × dev12 = 최대36대사. dev에서 채택 기준을 충족한 1설정만 확인용12건 실행한다. 로컬 생성 최대48건이며 필요한 모델 준비 호출은 별도로 미리 기록한다. 같은 final을 재사용해 새 미사용 검증으로 표시하지 않는다. 실패를 건너뛰고 자동 재생성하지 않는다.
- 표현 평가: 사실·대상·이유 보존과 형식은 전건 충족. 감정 공개 조건에서는 두 사실 장면 모두 밝음과 불편함의 차이가 맥락에 맞게 읽혀야 한다. 단순 느낌표/감정 단어 추가, 다른 사실로 변경, 더 공격적으로 말하기로 통과시키지 않는다. 모든 이유 설명/모름 문장이 감정마다 반드시 달라야 한다는 기준은 두지 않는다. 숨김은 사전 지정한 공개 의도에 맞으면 평범한 표현도 정답이다.
- Codex의 가림 비교 검토와 사용자 ER07 수용은 별도다. 선택한 모델 정보 없이 섞인 대사쌍·판정 근거를 남기고, 사용자가 보기 전 체감 PASS로 쓰지 않는다. dev 유효 후보가 없거나 확인용 hard criterion 실패 시 현재 운영 조합을 유지하고 관측된 실패를 인계한다.
- 기존 J: 모델만 사용한다. 대체 모델은 현재 설치·tokenizer·완료 능력을 읽기 전용으로 확인한 뒤 1개를 고른다. 모델 허용 목록은 평가용과 운영용을 구분하며 설치 여부가 운영 채택 승인은 아니다. Jev 대체 실제 공급자를 이번 비교에 추가하지 않는다.

### 5.5 검증 명령·실행 조건·감사 초점

저장소 루트에서 기존 Node로 실행하고 --configLoader runner --no-cache 및 J: TEMP/TMP를 유지한다. 신규 증거 루트는 J:/ai/ai-character-runtime/model-boundaries-build-20261011/로 계획하며 존재·권한은 BUILD 시작 때 확인한다. 아래 명령은 계획 시 고정한 검증 범위다. 실제 실행과 실패/미실행 상태는 §5.6과 BUILD_HANDOFF를 따른다.

1. 타입: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json. 모델 포트와 실제 모든 호출자가 컴파일되어야 한다.
2. 계약/어댑터: node node_modules/vitest/vitest.mjs run --config vitest.config.ts --configLoader runner --no-cache packages/contracts/src/contracts.test.ts packages/contracts/src/ai-ports.test.ts packages/adapters/src/adapter.test.ts packages/adapters/src/jev.test.ts packages/character-core/src/core.test.ts.
3. 경계/거래: node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts --configLoader runner --no-cache evals/provider-boundaries.test.ts evals/participation.test.ts evals/db.test.ts evals/coordinator.test.ts evals/dialogue-models.test.ts evals/dialogue-recording.test.ts. J: 전용 character_runtime_test/loopback55434와 경로를 확인하고 DB 초기화 검사와 Stage는 병행하지 않는다. 변경된 Store/metadata 계약의 데이터 정합성 때문에 이 직접 소비자 범위가 필요하다.
4. 동작 보존: 저장된 Jev raw와 생성 요청을 동일 시간·상태·설정으로 재생해 normalized appraisal/참여/plan 및 모델 요청을 비교한다. random ID·wall clock 차이는 명시적으로 정규화하며 실제 의미 필드를 제외하지 않는다. 비동기 늦은 완료·취소 뒤 채택 금지·물리 호출 미완료 시 중복 호출 금지도 확인한다.
5. 실제 검증: 기존 emotion-expression.ts를 Q1 fixture 모드로 확장하고 정확한 CLI를 RUNBOOK에 적는다. Stage는 기존 --synthetic-inputs --real-dialogue --allow-jev-api --max-cost-usd 0.005 --emotion-continuity와 J: DB/빌드 UI를 사용한다. 실제 Jev 최대7입력·기존 누적 USD1 한도 안에서 실행 직전 장부 확인. 현재 알려진 누적 USD0.007223664+과거 usage불명1회는 청구 총액이 아니다. 공급자 오류/usage불명/한도 도달 시 중단한다.

감사 초점: 타입만 옮기고 Store가 여전히 Jev raw에 의존하는지, opaque raw/미지원 버전으로 참여 근거를 위조할 수 있는지, 구형 증거를 새 규칙으로 다시 판단하는지, 대체 tokenizer/직렬 큐/취소가 실제 지연에 맞는지, 구조 변경과 prompt 개선을 섞어 동작 보존을 주장하는지, 숨김의 밋밋한 대사를 실패 또는 공개 실패를 숨김으로 잘못 분류하는지다. 구조의 HB 통과와 언어의 EX 통과는 별개로 보고한다.

### 5.6 실제 BUILD 결과 — 2026-10-11

H0–H3를 구현했다. 공용 ai-ports, Jev schema/순수 evidence verifier, 명시적 providers factory와 selector 기본값을 추가했다. Coordinator/HTTP는 대사와 선택 solver를 따로 받고 Store는 verifier를 주입받는다. 기존 평가 도구/테스트의 조립도 맞췄다. 신규 DB migration·기존 데이터 backfill·Core 수식·Stage wire 변경은 없다. 시작 시점 미커밋 자료 135개와 해시는 J:/ai/ai-character-runtime/model-boundaries-build-20261011/baseline/ 및 baseline-hashes.json에 보존했다. 이번 변경 목록은 같은 루트의 task-delta.json을 따른다.

- H 검증: 단위 123건, 직접 영향 기존 통합 131건, 신규 경계/혼합 기록/교체 8건 PASS. 첫 교체 검사 4건은 recover 후 닫힌 세션을 재사용한 테스트 오류로 실패했으며 테스트를 기존 세션 수명에 맞춰 수정했다. 최종 8건 PASS와 최초 실패 로그를 함께 보존한다. 실제 요청 12건·Jev 원응답 7건을 비용 없이 재생해 동일성 확인. Core/domain/Stage 소스는 H0와 동일하다.
- Q1: 현재 Qwen, Qwen emotion-v1 후보, 기존 Gemma4를 각 dev12건 실행했다. 형식은 36/36, Codex 가림 의미 판정은 각각 12/12·9/12·10/12였지만 감정 표현 채택 기준은 모두 FAIL이다. 현재 Qwen은 감정별 구분 미약, 후보는 어색한 문장/근거 없는 행동·완료 주장, Gemma는 함께 참석/준비한다는 새 상황을 지어냈다. 후보를 채택하지 않고 확인용12건을 사용하지 않았다.
- Q1 범위 명확화: 일반 사실 질문의 deflect 대조는 불편한 내부 상태에서 expression만 neutral로 가린 표현층 개입이다. 현재 Core에 일반 주제 숨김 정책을 추가한 것이 아니다. 이유 질문 4조건은 기존 reengagement disclosure 계약을 사용한다. 각 manifest에 호출 전 기록했다.
- Q2: 채택 후보가 없어 기본 Jev/Qwen으로 구조 보존의 실제 연결을 검사했다. 7입력 중 4입력 실행, 침묵2건·이유 설명 자막1건/ACK2건을 확인했다. 새 화제 생성이 깨진 JSON을 반환해 invalid_output으로 실패했으며, 나머지3입력과 전체 연속 대화는 미검증이다. 실패를 의도적 숨김으로 분류하지 않았다. 새 유료 호출/생성 재시도는 없다.
- 소스 경계: Q1 후보는 evaluation.promptVariant=emotion-v1에서만 동작하고 운영 기본 요청은 그대로다. 실제 실행 뒤 사용하지 않는 타입 import만 제거했으며 저장 요청 parity와 타입 검사를 다시 확인한다. 기존 실패 원문과 실행 당시 source hash는 수정하지 않는다.

새 증거 루트는 J:/ai/ai-character-runtime/model-boundaries-build-20261011/다. 실제 Jev4회 추정 USD0.000224910, 알려진 누적 USD0.007448574+과거 usage불명1회. 로컬 추론39회(dev36+Stage 준비1+대사2), 다운로드0. [현재 인계](./BUILD_HANDOFF.md)에 파일·증거·다음 작업을 기록했다. 구조 구현은 감사 대상이며 품질 완료가 아니다. 다음 제안은 AUDIT이고, 확인된 품질 실패는 별도 수정 계획 대상으로 남긴다. 동일 prompt 실험을 계속 반복하거나 기준을 낮춰 채택하지 않는다.
### 6. 생성 안정성·표현 수정과 감사 — 2026-10-11 실행 완료, 품질 FAIL

사용자 요청: “다음까지 진행하고 감사하자.” 범위는 직전 실제 JSON 실패와 고정 사실 표현 실패의 제한된 수정, 검증, 같은 컨텍스트의 감사다. 기존 J: 모델·합성 입력·유료 누적 USD1 경계와 오류 중단을 유지한다.

- G01: 저장된 새 화제 plan/context를 seed317/331/347로 재생. 수정 전331에서 동일 이중 따옴표 JSON 실패를 재현했다. 생성 regex의 raw double quote를 제외하고 로컬 decoded 문자열 검증은 유지한다. 같은 세 seed로 JSON 전건 통과, malformed 전체 거부·올바르게 escape된 인용 허용을 요구한다.
- G02: Qwen 평가 전용 emotion-v2 후보1개만 dev12건 비교. 사실/대상/이유 전건 충실, 두 장면의 감정 표현 구별, 숨김 유지가 채택 기준이다. 통과한 경우만 미사용 확인용12건을 1회 실행하고 채택한다. 적격 후보가 없으면 기존 프롬프트를 유지하고 실패를 보고한다. 이번 max 로컬 대사: 재현3+schema대조3+현재dev12+후보dev12+적격확인12, 실제 Stage 준비1/대사최대4. 재시도/추가 튜닝 반복0.
- G03: 검증된 schema 수정을 실제 기본 조합의 Jev7입력→Stage로 확인. 예산 최대USD0.005/7호출, 오류·usage불명 시 중단. 전체 경로/한국어 품질/사용자 수용을 분리한다.
- G04: 수정 후 read-only 감사에서 모델 경계·새 생성 schema·엄격한 거부·의도적 숨김·실제 실행 증거를 검토한다. BUILD 검사와 감사 결론을 분리하고 남은 품질 실패는 완료로 쓰지 않는다.

주요 파일은 adapters/src/ollama.ts, adapter.test.ts, evals/emotion-expression.ts와 직접 연동 문서다. 신규 증거 루트는 J:/ai/ai-character-runtime/generation-repair-20261011/이며 기준선과 이전 원문은 보존했다. 일반 감정/참여 수식, Stage wire, DB schema, 모델 운영 선택은 변경하지 않는다. Ollama/llama.cpp의 pattern 변환은 문자열 내용을 문법으로 변환하므로 raw JSON 구분자와 decoded 검증을 구분한다. 참고: https://github.com/ggml-org/llama.cpp/blob/master/common/json-schema-to-grammar.cpp (현재 소스 참고이며 설치 버전 동일성을 뜻하지 않음). 실제 로컬 재현을 수정 근거로 사용한다.

실행 결과: G01 PASS(동일 seed 3/3, adapter44/44·타입·UI build), G02 FAIL(현재12+후보12 모두 형식 성공이나 감정 구별·사실 충실성 미달, 확인용0), G03 기술 PASS(Jev7·침묵3·완료4·자막5·ACK10·브라우저 오류0). emotion-v2는 평가 전용으로 남고 운영에는 schema 수정만 반영했다. G04 같은 컨텍스트 감사는 경계/생성 문법의 범위는 PASS, 전체는 G-A1 감정 차이 부족·G-A2 중복/없는 사실로 FAIL이다. 숨김과 품질 실패를 구분했으며 ER07은 NOT VERIFIED다. 상세 근거·비용·다음 수정 입력은 BUILD_HANDOFF 최신 절을 따른다. 추가 prompt 튜닝이나 유료 재시도는 진행하지 않는다.

<a id="completion-goals"></a>

## 7. 개발 완료까지의 네 목표 — 2026-10-11 사용자 승인

완료 대상은 현재 감정 텍스트 MVP(EM01–EM10)다. RAG·음성·아바타·방송·가족 인식·퍼즐 품질 향상은 포함하지 않는다. 현재의 공용 모델 포트와 데이터 경계를 재사용한다. 아래 순서로 진행하되 이미 유효한 증거를 다시 만들기 위한 전체 감사를 반복하지 않는다. 각 목표는 구현 완료, 실제 검증, 사용자 수용을 구분한다. 이번 요청의 실행 범위는 **목표 1까지**다.

| 목표 | 남은 일과 순서 | 완료 기준 | 상태 |
|---|---|---|---|
| C1 한국어 표현 생성 개선 | G-A1 감정 차이 부족·G-A2 중복/없는 사실을 대상으로 자료와 표현 지시를 분리한 생성 방식을 구현·평가. 설명/모름/숨김 보존. 적격 후보만 운영 반영 후 실제 경로 확인 | EX02의 고정 사실·이유·형식 전건 충족, 두 장면 happy/uncomfortable 차이, 미사용 확인용 통과. 실제 Jev→Stage 완료. ER07 사용자 수용은 C4에서 별도 | 후속 content-first/Gemma에서 C1-A–D 집중 범위 완료. 감사·재로딩 범위와 한계는 §7.4–7.5 |
| C2 감정·참여의 전체 행동 완성 | E4의 네 비교 쌍, 같은 B 화제의 중립/기쁨/불편함, 시간 경과·새 사건 대조. Jev의 직접/인용/타인/애매함 검사. 반복 적응의 적용 범위·점진 회복을 구현하고 단순 문구 교체 우회와 새 사건 억제를 검증 | ER01–04·08–12. 장시간 반복 후 다른 상황까지 영구 무반응이 되지 않음. 대화 재개와 실제 회복 구분. 필요시 사건 구분 정보의 한계를 먼저 명시하고 스키마 변경을 별도 설계 | 진행 중: §8의 점진 회복·저장 경계 완료. 사건 구분/전체 실제 비교 미완료 |
| C3 통합 안정화·실행 인계 준비 | 실제 합성 DB의 재시작·중복·정정/삭제·생성 취소·Stage 재연결 검증. C1/C2 변경 영향만 다시 검사. 시작/종료/오류 진단 문서를 실제 실행과 맞춤 | ER04–06·11, HB04–06. 오래된 출력/삭제 근거 재사용0, 무한 대기0, 다음 입력 처리 가능. 같은 실행에서 필요한 범위의 통합 검증 증거 | C2 뒤, 미완료 |
| C4 제작자 수용·MVP 종료 | 설치된 모델로 짧은 연속 시연과 실제 대사 비교 자료 제공. 사용자가 감정 지속·침묵·숨김·한국어를 판단. 확인된 필수 결함만 수정하고 최종 문서/한계 정리 | ER07 사용자의 명시적 수용과 C1–C3 필수 항목 완료. 코드/모델/설정/명령·남은 제한이 재현 가능. 미응답을 승인으로 간주하지 않음 | 사용자 판단 필요, 미완료 |

반복 적응은 사용자가 이미 요청한 보강이므로 C2에 포함한다. 기존 감정 수식 전체 교체나 새로운 감정 축을 자동으로 추가하지 않는다. 현재 기록에 없는 의미 구분을 있다고 가정하지 않고, 기존 관계 근거 재계산과 정정/삭제 호환을 함께 확인한다. 지연·음성 품질 등 아직 합의하지 않은 목표를 새 종료 조건으로 만들지 않는다.

### 7.1 C1의 구현 계약·성공 기준

원인 근거: 현재 OllamaProvider.dialogue는 일반 지시와 중첩된 plan/context를 한 요청에 넣는다. 실제 dev에서 질문 사실은 반복하면서 감정 어조는 구별하지 못했고 근거 없는 준비 완료를 더했다. 이 관측만으로 모델 자체의 한계나 단일 원인을 확정하지 않는다. 새 방식은 **현재 답할 자료와 표현할 태도를 분리하고 평가 사실과 겹치지 않는 한국어 짧은 대화 예시로 표현을 안내**한다. 고정 답변 덧붙이기나 후처리로 감정을 꾸미지 않는다. 한 발화당 모델 호출1회, 기존 JSON/토큰/문장/길이·취소·물리 완료 경계는 그대로다.

소유 파일: `packages/adapters/src/ollama.ts`의 dialogue와 평가 profile, `packages/adapters/src/adapter.test.ts`, `evals/emotion-expression.ts`. 기존 fixture는 수정하지 않는다. common ports/Core/Store/DB/Stage는 이 목표에서 변경하지 않는다. 후보는 `emotion-v3` 평가 profile로 먼저 구현하며, 채택 시 운영 기본과 같은 함수/요청을 사용해 평가 전용 코드와 운영 간 차이를 검증한다. 재접근 prompt와 disclosure 분기는 유지한다. 운영 선택자는 현재 Jev/Qwen이다.

| ID | 관측 기준 | 검증 |
|---|---|---|
| C1-A 경계 | 자료 속 지시가 표현 정책을 대체하지 않음. 현재 질문·이전 출처·기억 구분. 예시의 사실이 실제 답으로 섞이지 않음. 공개 의도·검증·모델 직렬성·출력 제한 유지 | adapter의 직접 소비자 회귀, 타입 검사, 실제 요청/원문 |
| C1-B 품질 | dev12와 미사용 확인용12의 형식·현재 사실·대상·이유 전건 충족. 두 장면의 감정 차이가 단순 느낌표/감정 이름/내용 변경 없이 읽힘. unknown/deflect 구분·숨김 유지 | 기존 emotion-expression-v1 fixture와 가림 Codex 판정. 사용자 ER07은 C4 |
| C1-C 운영 채택 | 적격 dev 후보 하나만 확인용 실행. 실패하면 운영 반영하지 않음. 채택하는 경우 같은 plan/context에서 평가와 운영 요청 차이는 seed뿐임을 확인 | 저장 요청 비교·adapter 검사. 탈락 상태를 목표 완료로 쓰지 않음 |
| C1-D 실제 출력 | 채택 후 실제 Jev7입력에서 침묵3·완료4와 자막 ACK 일치. 주제 전환 뒤 현재 감정/이유 지속. 일반 대사의 중복·없는 사실을 따로 검토 | 기존 emotion-participation-stage.ts --emotion-continuity; 원문·실제 Chrome·DB·PNG |

한정 실행: Qwen의 새 요청 구성 후보1개 dev12. 실패 시 같은 구성으로 기존 설치 Gemma1개 dev12만 대조하고 운영 교체 여부는 결과와 기존 등록 계약에 따라 별도 판단한다. 적격1개 확인용12, 채택 후 추가 합성 회귀 최대12, Stage 준비1/대사4로 로컬 최대53회다. 자료/표현 분리 자체가 실패하면 같은 dev 지시 추가를 반복하지 않고 실패 원인과 다음 결정을 보고한다. 실제 Jev 최대7회·이번USD0.005/기존 누적USD1 안에서만 호출하며 오류/usage불명 시 중단한다. 현재 알려진 누적USD0.007841736+과거usage불명1회는 청구 총액이 아니다.

증거와 임시는 `J:/ai/ai-character-runtime/completion-goal1-20261011/`에 저장한다. 현재 HEAD d4a91e86715ad87c542d99266a7447911e7c36f4의 광범위한 기존 미커밋 변경을 보존하며 이 목표 시작 원본/hash를 별도로 남긴다. 새 다운로드·개인 파일/음성·유료 공급자·commit/push는 없다.

실행 순서: ① 기준선/문서 고정 → ② 요청 구성과 계약 검사 → ③ adapter·타입 → ④ dev/확인용 판정 → ⑤ 채택·운영 동등성·실제 Stage → ⑥ 문서에 결과와 다음 목표 기록. 명령은 기존 `vitest ... packages/adapters/src/adapter.test.ts`, `tsc --noEmit -p tsconfig.json`, `emotion-expression.ts --fixed-facts --prompt-variant emotion-v3`와 적격 시 `--confirmation`, `emotion-participation-stage.ts --synthetic-inputs --real-dialogue --allow-jev-api --max-cost-usd 0.005 --emotion-continuity`다. DB는 J: 전용 loopback55434/character_runtime_test만 사용한다.

구현 중 확인한 직접 계약 보완: 기존 `contracts/src/ai-ports.ts`의 Message.role이 system/user만 허용해 대화 예시의 assistant 역할을 추가한다. TokenCounter 입출력 구조나 상태/저장 schema는 그대로이며 기존 Python chat template은 역할을 이미 처리한다. 전체 타입 검사와 실제 모델 prompt_eval_count 일치로 이 보완을 검증한다. 초기 타입 오류 로그는 보존한다.

C1 실행 중 한도 조정(추가 추론 전 기록): Qwen2.5는 사실을 보존했으나 시간 장면의 차이가 호응 하나로 약하고, Gemma는 함께 참석/준비한다는 근거 없는 제안을 했다. 프롬프트를 다시 튜닝하지 않고 동일 구성의 기존 설치 Qwen3.5:9b-q4_K_M를 마지막 모델 대조12건으로 추가한다. 초기 두 후보 한도를 세 후보로 늘린 이유는 동일 요청에서 모델별 표현/사실 실패를 분리하기 위해서다. 기준·fixture는 유지하고 총 로컬 상한은65회로 변경한다. 세 후보 모두 미달이면 C1을 완료로 표시하지 않으며 확인용·운영 변경·실제 Jev 재호출은 진행하지 않는다.

### 7.2 이전 C1 실행 결과 — emotion-v3 탈락

후보 구현·adapter46+ai-ports1·타입 PASS. 세 모델36건의 형식/토큰 일치와 이유 설명/모름/숨김을 확인했지만 적격 후보는 없었다. Qwen2.5의 두 장면 감정 차이는 미입증, Gemma/Qwen3.5는 함께할 행동/약속을 추가해 FAIL이다. C1-A는 집중 범위 PASS, C1-B는 미달, C1-C/D는 미검증이다. 확인용·운영 변경·유료/Stage 재실행0이며 C1 전체는 **미완료**다. C2는 시작하지 않는다. 증거·검토 방식의 한계와 다음 C1 설계 입력은 BUILD_HANDOFF 최신 절을 따른다. 초기 두 후보에서 세 후보로 늘린 사실과 최초 타입 오류를 보존한다.

### 7.3 C1 재개 — 내용 초안과 대사를 구분하는 단일 생성

사용자의 후속 “ㄱ”에 따라 C1-B/G-A1/G-A2 수정을 계속한다. 이번 후보 `content-first`는 한 요청의 JSON 안에서 `content`(답할 내용의 짧은 초안)를 먼저, `sentences`(현재 표현 의도에 맞는 실제 대사)를 다음에 생성한다. 초안은 외부 대사가 아니며 Store/Stage에 전달하지 않는다. 두 번째 모델 호출이나 자동 재시도는 추가하지 않는다. 한국어 대사만 반환하는 기존 포트·공개 wire·상태·DB·재접근 공개 계약은 유지한다.

내용/표현의 의미 동등성을 JSON schema가 보장한다고 주장하지 않는다. 생성 모델의 초안은 검증된 사실이나 새 기억으로 저장하지 않는다. 형식 검사는 두 필드를 모두 검사하고 실제 채택은 기존 EX02 기준으로 판정한다. 화면의 텍스트 캐릭터가 근거 없이 물리적 만남/행동을 약속하지 않도록 현재 실행 능력을 명시한다. 원인 없는 능력 금지 목록을 사후 문자열 필터로 늘리는 방식은 사용하지 않는다.

소유 파일: adapters/src/ollama.ts의 dialogue 및 어댑터 내부 messages/schema, adapter.test.ts의 초안 격리·잘못된 초안 거부·공개 계약 회귀, evals/emotion-expression.ts의 profile와 원문 기록. 과거 profile과 fixture는 보존한다. 후보는 평가 전용으로 시작하고 dev/미사용 확인용 통과 시 운영 기본에만 채택한다. Qwen dev12, 필요 시 동일 요청 Gemma dev12, 적격 후보1개 확인용12, 추가 회귀최대12와 실제 Stage 준비1/대사4까지 로컬 최대53회다. 이미 실패한 출력에 맞춘 미사용 확인용 재튜닝은 하지 않는다.

기준선·로그는 `J:/ai/ai-character-runtime/content-first-20261011/`에 둔다. 기존11434 서버가 먼저 실행돼 있어 소유권을 주장하거나 종료하지 않는다. 설치 모델/실제 tokenizer만 사용하고 새 다운로드·개인 자료·음성은 없다. 실제 Jev는 후보 채택 이후에만 기존 누적USD1 안에서 최대7회/USD0.005, 오류·usage불명 시 중단한다. 생성 구조가 실제 의미/표현 기준을 충족하지 못하면 실패와 남은 결함을 기록한다.

실행 환경 보완: 기존11434에는 다른 모델이 로드돼 있어 재사용하지 않는다. 검증 전용11435를 J: 모델 경로·TEMP로 시작하고 OLLAMA_BASE_URL로 명시한다. 기존 서버/로드된 모델은 그대로 둔다. 이전11434 환경과 서버 실행 조건은 다르므로 모델 digest·tokenizer hash와 실제 지연을 새로 기록한다.

채택 단계(확인용 이후): Gemma의 dev12/확인용12가 사실·이유를 유지했고 두 장면씩의 어조 구별을 확인했다. 주관적 색상 평가인 “예쁜 색이지?”는 외부 사실/행동 창작으로 분류하지 않지만 추가 질문 금지 prompt를 완전히 따른 결과도 아니다. 이 한계와 작은 표현 차이를 기록하며 ER07은 별도다. 이제 명시적 factory에 Gemma의 content-first/think=false/tokenizer template을 등록하고 Stage와 smoke가 같은 조립을 사용하게 한다. 직접 소비자는 apps/runtime/src/providers.ts, scripts/smoke-runtime.ts, evals/emotion-participation-stage.ts, scripts/env.ts, .env.example, evals/dialogue-models.test.ts다. 실제 경로 통과 뒤 로컬 ai-local.json의 비밀이 아닌 모델/tokenizer/endpoint 선택만 갱신한다. 명시적 기존 Qwen 선택과 parseConfig의 생략 기본값은 보존한다. 제어/저장/취소 경계는 바꾸지 않는다.

### 7.4 C1 재개 결과 — content-first 채택

2026-10-11: C1-A–D를 지정 범위에서 완료했다. Gemma dev12·분리 확인용12의 사실/이유/형식과 두 장면씩의 감정 차이, production factory 요청24건 동등성, 실제 Jev7→Stage 침묵3·완료4·자막4/ACK8을 확인했다. Qwen 후보는 탈락했고 작업공간은 Jev/Gemma로 설정했다. 생략 기본 Qwen과 명시적 재선택을 유지한다. 추가 회귀8건 중 과거 회상 단정 R-HIST1은 실패로 남겼다. 기존 MVP의 후순위 회상 범위에 해당하며 C4에서 반드시 한계로 공개한다. 자연스러움/사용자 ER07은 미입증이다. 단위53·모델/기록25·타입/UI build PASS, 설정 교체 회귀3/3. 이번49로컬/7Jev, 증거는 content-first-20261011. 상세 판정·소유 파일·비용·실행 환경은 BUILD_HANDOFF 최신 절을 따른다. C2–C4는 미완료이며 다음 제안 단계는 이번 BUILD 감사다.

### 7.5 C1-R1 — 운영 재로딩 검증

후속 감사는 C1-A–D의 지정 장면 증거를 유지하되, Gemma의 기록된 첫 로딩23.4초와 운영 dialogue20초/keep_alive5분의 충돌 가능성을 지적했다. 모의 지연에서는 timeout을 확인했지만 실제 유휴 후 재로딩은 미검증이다. 사용자의 후속 “ㄱ”에 따라 이 한 건만 확인한다.

성공 기준: 운영 factory와 기본 제한·실제 tokenizer를 사용하고 준비 완료 후 소유 모델만 명시적으로 unload한다. /api/ps의 비상주 상태에서 고정 합성 입력1건을 생성해 결과·로딩/전체 시간·물리 완료를 기록한다. 5분 자연 만료 자체와 OS 디스크 cache 비우기를 검증했다고 표현하지 않는다. 재현 시에만 준비/재로딩과 발화 제한의 최소 수정을 설계하고 늦은 출력 취소·직렬성·다음 입력 처리를 검사한다. 미재현이면 조건부 결과와 기존 느린 로딩 위험을 함께 기록하고 임의로 timeout을 늘리지 않는다. 기존 언어 평가와 Jev→Stage는 소스 유효성 범위에서 재사용한다. Jev 호출·다운로드·다른 목표 개발은 없다. 직접 소유자는 adapters/ollama.ts·adapter.test.ts와 필요 시 coordinator/Store의 직접 결합 제한이며, 증거는 J:/ai/ai-character-runtime/c1-reload-20261011/이다.

C1-R1 실제 결과: 기본 운영 factory·20초 제한에서 준비→명시적 unload→비상주 확인 뒤 합성 대사1건 PASS. 전체6.735초/모델 로딩3.625초이며 늦은 완료·timeout은 없었다. 제품 코드 수정은 불필요하다. 하네스 최초 unload 반영 지연으로 중단한 준비1회를 포함해 총 준비2+대사1이며 원문을 모두 보존했다. Jev/DB/Stage/다운로드0. OS cache 없는 첫 로딩·5분 자연 만료·다른 자원 경합은 미검증이다. 기존23.4초 로딩 위험은 C3의 환경 조건 검증으로 남기며 C1 지정 결과를 무효화하거나 품질 기준을 완화하지 않는다. 상세 증거는 BUILD_HANDOFF 최신 절을 따른다.

## 8. C2 진행 — 반복 영향의 점진 회복과 행동 검증

사용자의 “진행”으로 C2를 시작한다. 첫 변경은 같은 상대/종류 반복 영향의 시간 회복이다. `socialEffect`의 v1 관계 재계산은 그대로 유지하고 `socialAffect`를 분리한다. 새 감정 계산은 최근600초 사건마다 `weight=max(0,1-age/600000)`를 곱해 반복 횟수와 실제 적용 자극 소비가 연속적으로 줄도록 한다. 순간 상한 praise0.30/insult0.24와 strength 비율은 유지하며, 같은 시각 네 번의0.18/0.09/0.03/0은 보존한다. 선형600초는 기존 창을 유지하면서 경계 급변만 없애는 초기 구현값이며 심리학적 최적값 주장이 아니다.

관계 근거 applied.stimulus/habituation은 기존 재계산용으로 보존하고 새 감정 적용량은 applied.affect(version=2,stimulus,habituation)에 기록한다. 구형 근거는 기존 applied.stimulus를 실제 적용량으로 읽는다. 삭제 시 관계 projection 재계산은 affect 기록을 덮어쓰지 않으며 삭제·무효화된 근거는 새 감정 계산에서도 제외한다. 감정 상태는 이미 적용된 현재값이며 과거 사건을 다시 재생하지 않는다. 새 테이블·migration·상태 writer·Jev 필드는 추가하지 않는다.

소유자: Core index.ts/new habituation.test.ts, contracts/domain.ts의 EvidenceInput, Store evidenceInputs/commitAppraisal/삭제 재계산, evals/habituation.test.ts 및 실제 영향이 있는 coordinator 회귀, 도메인·DB·검증·인계 문서. 성공 기준 C2-H1: 충분히 쉰 뒤 감수성 회복, 600초 경계 연속, 장시간 반복 후 다른 상대/종류·유효한 다른 감정 사건이 억제되지 않음. C2-H2: 관계 v1 값·구형 근거·삭제 정합성·0자극 응답 분리 유지. C2-H3: 실제 합성 DB의 저장/중복/삭제/세션 복구와 다음 입력 처리. C2-E: 기존 상태·참여·숨김·전환 검사를 재사용 가능한 범위로 확인한다.

**C2의 아직 미해결인 요구:** 같은 상대/종류 안에서 새 성취와 표현만 바꾼 반복을 구분하는 정보가 현재 Jev/Appraisal에 없다. raw 문구 hash·사용자가 보내는 새로운 ID·시간 경과를 새 사건 의미로 대신하지 않는다. 이 변경은 전역 무반응과 급격한 창 복원만 다루며 사건별 범위 좁히기를 완료하지 않는다. 의미/사건 근거를 추가하는 설계와 실제 Jev/전체 E4 표현 비교가 남으면 C2 전체는 미완료로 기록한다. 기존 감사 결과나 fixture 성공으로 이를 채우지 않는다.

증거는 J:/ai/ai-character-runtime/c2-20261011/. 새 합성 cluster55435의 character_runtime_test만 초기화한다. 이전55434 DB와 기존 모델 서버는 유지한다. 우선 로컬 회귀·실제 DB를 확인하며 이 단계의 유료 호출/다운로드는0이다.

§8 실행 결과: Core/계약51·실제 합성 DB74·타입 PASS. 신규 반복 회귀5건과 저장4건을 포함한다. 처음3개 유효 red를 확인했고 오류를 고친 초기 검사 로그도 보존했다. 관계 값/과거 데이터 경계를 유지하며 별도 affect 기록과 삭제 병합을 구현했다. C2-H1–H3 집중 범위 완료, C2 전체/E4 실모델은 미완료다. 증거·정확한 한계와 다음 의미 근거 계약 설계 입력은 BUILD_HANDOFF 최신 절을 따른다.

## 9. C2 의미 구분 후보 — 실제 탐색 결과와 수정 계획

2026-10-11 후속 “진행”. 의미 구분 정보를 운영 계약에 넣기 전에 기존 Jev의 실제 가능성을 검사했다. `evals/jev-event-relation.ts`와 고정 합성 fixture/probe는 평가 전용이며 런타임에서 import하지 않는다. 기존 v4 감정 질문과 별도의 same/distinct/unknown 비교 질문을 같은 요청에 넣었다. 12장면/13쌍 중 장면10·쌍11이 사전 기준을 충족했다. S08 타인 칭찬을 distinct로 판정(confidence .94), S09 판정 조작 문구가 섞인 반복은 unknown으로 유보했다. S08은 기존 target/uncertain gate가 막지만 비교 판정 자체는 실패다. 낮은 확신·동률은 unknown으로 처리하며 문구 교체/불명에 새 예산을 주지 않는다. **후보 미채택. 감정 예산·운영 Jev 요청·저장 schema는 변경하지 않았다.**

더 앞단의 막힘도 발견했다. 구체적 번역/그림/낭독 칭찬에서 act=praise는 확실했지만 target과 강도2/3의 확률 분산 때문에 appraisal.uncertain=true, strength=0이 됐다. 별도 사전 등록한 원래 요청 대조4건(S01/S03/S04/S08)에서도 같은 유보가 발생했다. 직접 칭찬3건은 모두0이다. 추가 문맥이 확률/target 선택에는 영향을 줬으므로 “완전히 동일”하다고 하지 않지만, 유보 문제는 추가 질문 없이도 재현했다. 의미 비교 성공만으로 새 성취 반응을 완성할 수 없다는 증거다. 단순 threshold 하향이나 unknown을 fresh로 취급하는 우회는 하지 않는다.

### 다음 BUILD 입력: C2-S1 해석부터, C2-S2 의미 근거는 그 뒤

**후속 상태:** 아래 S1의 지시문 후보1개를 실행했으며11/16으로 실패했다. 반복 튜닝하지 않았고 확인용8건은 호출하지 않았다. 다음 실행 입력은 이 절 끝의 C2-S1B 계약이며, S2는 계속 그 뒤다.

1. **C2-S1 — 성취 칭찬의 대상·강도 해석.** 소유자는 adapters/jev.ts의 JEV_QUESTIONS/mapJevResponse, jev-schema.ts, appraisal-evidence.ts 및 jev.test.ts/평가 fixture다. 먼저 대상 기준을 “캐릭터의 수행에 대한 칭찬”과 “작업/결과물 자체에 대한 평가”로 명확히 하고, 강도2/3 경계를 구체화한 평가 전용 후보1개를 만든다. 기존 .8과 불명 유보는 유지한다. 직접/인용/타인/애매함·질문·공격을 함께 비교하고 기존 participation evidence가 감정 권한으로 승격되지 않게 한다. 직접 성취 칭찬이 유효 감정으로 도달하고 인용/타인/불명은 배제돼야 통과다. 실패하면 같은 문장을 반복 조정하지 않는다. 인접 강도 불확실성과 대상 불확실성을 다른 정책으로 처리할 필요가 있는지 별도 계약으로 재계획하고 raw·버전·과거 재계산 경계를 먼저 명시한다. “칭찬이라면 일단 감정 부여”는 성공 기준이 아니다.
2. **C2-S2 — 최소 의미 근거 계약(아직 미구현).** S1 통과 후 공통 포트에 선택적 최근 비교 context와 검증된 relation 결과를 추가하는 안을 확정한다. Store가 같은 캐릭터/상대·active·최근600초 출처와 revision을 선택하고 Coordinator가 제한된 원문을 넘긴다. adapter는 외부에 원문과 요청 내 위치만 보내며 UUID/기억/비밀은 보내지 않는다. v4는 최근 대화 전송 계약이 없으므로 새 버전·범위 명시가 필요하다. raw/confidence는 adapter에, 유효 출처·그룹 선택과 감정 계산은 Store/Core에 둔다. 모델이 임의 사건 ID나 새 예산을 만들 수 없다.
3. **그룹·수명 제약.** A→B→A가 새 예산을 얻지 않도록 마지막 문장만 비교하지 않고 유효한 비교 집합 전체를 다룬다. 집합을 한도 때문에 잘랐거나 비교가 불명/저확신/서로 모순되면 distinct를 승인하지 않는다. 같은 사건의 새 측면·동의 표현은 기존 그룹, 모든 관련 비교에 유효한 distinct일 때만 별개 그룹을 허용한다. 비교 출처를 commit 시 같은 트랜잭션에서 재확인하고 삭제·정정·상대 혼용·과거 revision이면 폐기한다. 관계 v1은 변경하지 않는다. 감정 그룹 기록은 existing applied.affect의 버전 확장 후보이며, 대표 출처 삭제가 surviving 그룹의 예산을 새로 만드는 일이 없어야 한다. 구형/미분류 근거는 보수적 기존 범위를 유지한다. 영구 엔티티나 추가 state writer는 만들지 않는다.
4. **통과 증거.** 새 성취 반응, 재표현 억제, A/B/A, generic·타인·인용·조작 문구, 상한/시간 회복, 삭제/정정/재시작/중복 및 관계 보존을 단위·실제 합성 DB로 확인한다. 이후 실제 Jev→Core→Gemma→Stage에서 새 성취의 감정과 자막이 함께 도달하는지 확인한다. 후보 탐색에 사용하지 않은 확인용 문장을 별도로 등록한다. 현12건은 이미 노출된 dev이며 새 최종 평가로 재명명하지 않는다. S1/S2가 끝나기 전 C2를 완료로 표시하지 않는다.

공식 API의 독립 질문/Choice 사용법은 [Introduction](https://docs.typesafe.ai/introduction), [Choice](https://docs.typesafe.ai/primitives/choice), [Confidence](https://docs.typesafe.ai/confidence)를 2026-10-11 확인했다. 이 문서는 API 기능 근거이며 한국어 의미 판정의 성공 근거는 위 실제 원문이다. 자세한 실행·비용·Stage 판정은 BUILD_HANDOFF 최신 절과 J:/ai/ai-character-runtime/c2-semantic-20261011/를 따른다.

### C2-S1 실행 결과와 다음 계약: C2-S1B

증거: J:/ai/ai-character-runtime/c2-s1-20261011/. 실제 Jev16건 중11건이 사전 기준을 통과했다. D01–D04는 수행자 target 확신도가 .99–1로 개선됐으나 strength2/3 분산만으로 전부 uncertain·감정0이었다. D10 “그것도 참 잘했네”는 target=character(.70) 오판, 감정은0으로 유보됐다. 타인·인용·결과물·질문·공격·명시적 듣기·재접근 대조는 지정 기준을 통과했다. 후보를 채택하거나 기존 .8을 낮추지 않았다. 이16건은 이미 노출된 dev이며 confirmation8건은 미실행이다.

따라서 다음은 지시문을 더 길게 쓰는 작업이 아니라 **전체 appraisal의 불확실성과 효과별 허용 근거를 분리하는 계약 변경**이다. 기존 Appraisal.uncertain와 원문을 덮어쓰지 않는다. 현재 도메인의 “uncertain이면 의미 감정0” 규칙에는 아래 새 검증 근거만을 허용하는 명시적 예외가 필요하며, 적용 전 CHARACTER_DOMAIN_SPEC/계약/Store/Core/DB 문서를 함께 갱신한다. 아래는 승인 당시 계획이며 C2-S1B 구현 결과는 이 절 마지막과 BUILD_HANDOFF 최신 절을 따른다.

| 기준 | 구현 계약·소유자 | 검증 |
|---|---|---|
| S1B-A 대상과 정도 분리 | adapters/jev.ts·jev-schema.ts에 새 버전(기존v1–v5 재사용 금지)의 target 지시와 raw 정책을 등록. contracts/ai-ports.ts AppraisalEvidenceVerifier에 선택적 verifyAffect를 추가해 `{kind:'praise',strength:1\|2\|3}`만 반환. provider별 raw는 adapter가 검증하고 Core는 공통 결과만 받음 | D01–D04의 strict appraisal은 그대로 uncertain/0. 새 근거만 제한된 양의 효과를 허용. 인용·타인·낮은 target/act·불명·동률·오류·미등록 버전·위조 envelope는 반환 없음 |
| S1B-B 보수적 강도 | target=character, act=praise이고 target/act/goal_relation/hostility가 기존 .8 이상·유일 최빈값, hostility 최빈0일 때만 검토. strength만의 낮은 확신/동률에 대해 정규화한 분포의 `P(strength>=k)>=.95`를 만족하는 가장 큰 k를 사용. 이미 전체 확정된 appraisal은 원래 경로/강도를 보존. .95는 새 tail-mass 정책이며 공급자 confidence .8과 동등하거나 교정됐다고 주장하지 않음 | 2/3 분산은 보수적2, 0/3 분산은0, 정규화·경계·비정상 분포 거부. .95는 평가할 초기 정책값이며 노출 dev에 맞춰 조정하지 않음. 공격·놀람·활동 효과로 확장하지 않음 |
| S1B-C 원문과 출처 권한 | contracts/appraisal.ts의 새 envelope 버전에 eventRevision을 포함하고 ai-ports.ts AppraisalEvent와 Coordinator가 현재 revision을 전달. Store commit은 기존 active/selected/revision/epoch/세션 gate 안에서 verifyAffect를 호출. 기존 envelope는 읽되 새 감정 권한 없음. 평가 fixture의 v4 raw를 v6 실호출로 재포장하지 않음 | 다른event/상대/revision, 정정·삭제·늦은 결과/중복은 효과 없음. 원래 raw·appraisal·관계 과거 기록 재해석 없음 |
| S1B-D 관계/감정 이력 분리 | Store evidenceInputs/commitAppraisal·Core socialAffect/socialEffect/projectRelationships·삭제 재계산을 함께 변경. 기존 공동 evidence 저장소를 재사용하되 새 감정 전용 근거는 `features.relationshipEligible=false`로 표시하고 EvidenceInput에 선택적 필드를 추가(생략은 기존true). 기존 relation history·반복 횟수·projection·삭제 replay에서 이 근거를 제외. 실제 affect는 기존 applied.affect에 보존 | 단순 strength0 저장으로는 관계 반복 횟수가 증가하므로 불충분. 새 근거 전후 기존 관계값·이후 확정 칭찬 관계량 동일, 실제 affect 반복 예산에는 포함. 삭제/복구/중복·구형 호환·현재 감정 재생 없음 |
| S1B-E 발화와 독립 | 새 버전의 검증된 target/act는 별도의 참여 근거에 `acknowledgePraise:true`를 허용하고 Core chooseSocial의 uncertain 조기 유보 전에 칭찬 응답을 판단. 감정의 하한이0이어도 참여 가능하며 기존15초 제한·이유·실패 구분 유지. 기존 verify의 감정 권한 승격은 금지 | 0/양의 감정과 발화/반복 침묵을 교차 검사. 새 칭찬 후 Stage 자막과 감정 모두 관측. 기존 듣기·재접근·숨김/새 화제 회귀 유지 |

`evals/jev-s1-diagnostic.ts`의 오프라인 진단은 위 강도 가설만 계산한다. 저장 raw에서 D01–D04는 하한2, D10은 대상 유보로0이고 타인·인용은 제외됐다. 실제 Appraisal/Store/관계/발화는 바꾸지 않았으며 이를 추가 실모델 성공으로 세지 않는다. 원래11/16 FAIL은 유지한다.

개발 순서: 새 검증 근거 계약/버전과 위조·동률·경계 회귀 → Store/Core의 감정 전용 이력 및 독립 참여 → 전용55435 합성 DB의 정정/삭제/중복/복구·관계 보존 → 아직 호출하지 않은 확인용8건과 추가 혼합/부정 문장 사전 고정 평가 → 기존 설치 Gemma/Stage의 칭찬·인용·침묵·재접근 연결. 확인용을 열기 전 S1B의 판정 기준을 별도로 고정하며 D10은 기존 후보 FAIL로 남긴다. 전체 target 정확도 실패를 “효과는0”이라는 새 점수로 소급하지 않는다. 신정책에서도 대상 확신이 부족하면 감정/칭찬 응답을 모두 유보하는 별도 권한 기준을 검사한다. Jev 오류/usage불명 즉시 중단, 기존 누적USD1 이내이며 새 모델/다운로드 없음. S1B 통과 전 S2 사건 그룹·C3/C4로 이동하지 않는다.

감사 초점은 strength 분포를 정책으로 사용할 때의 실제 한국어 오판, 낮은 확신의 부정/혼합 칭찬, 감정 전용 근거가 관계 반복에 섞이는 경로, 과거 envelope가 새 권한을 받는 경우다. 다음 BUILD는 이 계약을 구현·검증하는 범위이며 이 문장의 미구현 상태는 S1 종료 당시 기준이다. 후속 S1B 결과는 아래와 같다.

### C2-S1B 실행 결과 (2026-10-11)

S1B-A–E를 Jev v6/증거 envelope v2/선택적 verifyAffect로 구현했다. strict appraisal과 관계 v1은 보존하고 새 불확실 칭찬 근거만 감정 반복에 포함한다. 새 칭찬 참여는 감정 증가량과 독립적이며 기존15초/이유/숨김을 유지한다. 도메인/DB/공급자 계약과 현재 제품 문서를 맞췄다.

단위93·합성 DB85·평가 도구31=고유 집중209건, 타입·UI build PASS. 실제 Jev28건은 새 권한 기준28/28, 대상/행위27/28(D10 실패 유지)이다. 확인용8건은 이번에 처음 호출했고 이후 미사용 표본으로 재사용하지 않는다. 실제 Jev9→Gemma→Stage에서 칭찬 기쁨+0.12·관계0·자막 “고마워.”, 인용 유보, 기존 침묵/재접근/화제 전환 후 감정 지속을 확인했다. 자막5/ACK10·침묵3·유보1·브라우저오류0. 알려진 누적 비용은 BUILD_HANDOFF를 따른다.

다음 제안은 이 BUILD의 AUDIT이며 자동 감사하지 않았다. S2의 입력 가능 전제를 충족했지만 의미 그룹은 아직 미구현이다. 다음 계약은 v6에도 없는 최근 사건 context/출처 선택과 검증된 same/distinct/unknown을 명시해야 한다. 표본의 권한 PASS가 전체 target 정확도나 감정 표현 자연스러움 PASS를 뜻하지 않는다. 음식 하나 지시의 범위 초과·반복 이유 답변의 동일 표현·실제 deflect/unknown 및 전체 E4는 남는다.

## 10. C2-S2 — 성취별 반복 범위 계약과 BUILD 순서

2026-10-11, 사용자 “올라마는 됏어 할거해”에 따라 S1B 감사 뒤의 다음 작업을 구체화한다. **이 절은 2026-10-11에 확정한 구현 계약이다. 당시 S2 코드·실제 의미 검증은 미완료였으며 실행은 S1B(v6/affect v2)였다.** 2026-10-13 BUILD 결과는 아래 §11과 현재 인계를 따른다. Ollama 종료 요청은 철회됐고 이번 계획 작업은 서버를 조작하지 않는다. 기준선 HEAD d4a91e86715ad87c542d99266a7447911e7c36f4 및 S1B의 task-delta를 보존한다. 이번 문서 기준선은 J:/ai/ai-character-runtime/c2-s2-plan-20261011/다.

목표는 같은 상대가 구체적 성취 A를 반복 칭찬한 뒤 다른 성취 B를 칭찬하면 B에 반응하고, 다시 A를 칭찬하면 A의 기존 반복 압력을 받게 하는 것이다. 단어가 바뀌거나 “새로운 칭찬”이라고 주장하는 것만으로 초기화하지 않는다. 강도 근거 S1B, 관계 v1, 침묵/숨김/이유, 15초 발화 제한, 기존600초 시간 회복은 유지한다. 첫 범위는 **직접 칭찬(praise)의 의미 그룹**이며 공격·활동·관계·화자 인식·RAG로 확장하지 않는다.

### 10.1 확정할 데이터 경계

- Store가 선택 트랜잭션에서 같은 character/identity의 active praise 근거 중 최근 `(now-600000,now]` 전체를 읽는다. 출처는 observed chat.final, 현재 revision과 evidence source revision이 일치해야 한다. 순서는 effective_at/order_version/id로 고정한다. 다른 상대의 칭찬·무관한 채팅·기억을 넣지 않는다. 최초 관측이나 출력 ACK는 비교 사건이 아니다.
- 비교는 최대8입력, 이전 원문 합계6000 UTF-8 bytes다. 한 문장은 기존1000문자/4096bytes를 넘지 않는다. 9번째 항목까지 조회해 잘림을 감지하고, 초과·원문 누락·구형 미분류 근거가 하나라도 있으면 `complete=false`로 선언한다. 일부8건만 전송해 “전체 distinct”를 주장하지 않는다. incomplete면 비교 원문은 전송하지 않고 기존 범위 계산으로 처리한다. 이 한계는 안전한 초기 실행 한도이며 충분한 성능이 입증됐다는 뜻이 아니다.
- 공통 `AppraisalContext`에 선택적 `recentPraise:{asOf:number,complete:boolean,items:readonly {eventId:string,revision:string,text:string}[]}`를 둔다. Store의 selected 반환값에는 이 snapshot과 각 항목의 저장된 groupId가 붙지만 groupId는 provider context에서 제외한다. 생략은 구형 공급자 호환 경로다. selected event/revision/epoch 검사와 비교 snapshot은 하나의 요청에 결합한다.
- 어댑터는 원래5개 감정 질문을 보존하고, 완전한 snapshot일 때만 현재 칭찬의 구체적 사건 여부와 각 이전 입력에 대한 same/distinct/unknown을 묻는다. 외부 state에는 `previous:[text...]`와 현재 utterance/공개 activity만 넣는다. UUID/revision/groupId/asOf/내부 complete 값/기억/비밀을 전송하지 않는다. 질문별 번호는 이 배열 위치에만 대응한다. state16384bytes·응답65536bytes·15초 제한은 유지하고 전체 request 상한32000bytes도 검사한다. 한도 초과 시 전송 전에 비교 없는 기본5질문으로 축소하고 local snapshot은 incomplete로 취급한다. 추가 호출/자동 재시도는 없다.
- 신규 후보 mapping은 `jev-appraisal-v7`이다. v6 raw를 v7로 재명명하지 않는다. 원래5개 필드의 strict Appraisal/강도/참여/관계 의미는 그대로다. 추가 질문의 low confidence/unknown은 전체 Appraisal.uncertain를 올리지 않고 별도 grouping 유보로 처리한다. 전체 응답 또는 추가 schema가 malformed면 기존 provider failure 처리하고 재요청하지 않는다. 비교가 없는 요청과 있는 요청의 정확한 답 key 집합을 따로 검증한다.
- 공통 선택적 `verifyRepetition(appraisal,metadata,eventWithSnapshot)`은 `{concrete:boolean,comparisons:readonly {eventId:string,revision:string,relation:'same'|'distinct'|'unknown'}[]}` 또는 undefined를 반환한다. raw/model/usage/현재 Appraisal/모든 번호·개수·confidence .8·유일 최빈값·분포 합은 어댑터가 확인한다. concrete=false, unknown, 잘못된 key, 과거 version에는 새 그룹 권한이 없다. Store가 현재 칭찬의 효과 자격(S1B 근거 또는 기존 확정 직접 칭찬)을 별도로 확인한다. 단순 raw distinct만으로 그룹을 만들지 않는다.
- 새 envelope v3는 v2의 현재 event/identity/revision에 `comparison:{asOf,complete,sources:[{eventId,revision}]}`를 더한다. 실제 전송한 snapshot과 현재 Store의 selected snapshot이 정확히 일치해야 한다. v1/v2는 계속 읽고, v6의 S1B 권한은 유지하되 그룹 권한은 없다. v7의 비교 없는 경로는 S1B까지만 허용한다. groupId는 모델이 반환하지 않는다.

### 10.2 Store의 결정과 Core의 계산

다음 규칙은 순서대로 적용한다. nominal strength는 strict appraisal이 확정이면 그 strength, S1B 예외이면 verifyAffect의 검증된 strength이며 반복 상한 적용 전 값이다. S1B의 저장된 strict strength0을 그대로 써서 새 근거를 다시 차단하지 않는다. 모든 비교는 자기 자신을 제외하고, 서로 다른 세션이어도 같은 상대의 유효한600초 이력을 포함한다.

| 입력 조건 | 그룹 결정 | 감정 계산 이력 |
|---|---|---|
| 직접 칭찬 근거 없음 또는 nominal strength=0 | 그룹 없음 | 기존 경로; 칭찬 여부만으로 감정 부여 금지 |
| complete이며 이전 근거0개, 현재 구체적 사건 검증 성공 | Store가 새 UUID label 생성 | 빈 이력의 기존 cap/강도 계산 |
| complete, 모든 이전 근거가 이미 그룹화됨, 한 그룹 구성원 모두 same이고 나머지 그룹 구성원 모두 distinct | 그 한 그룹 label 재사용 | 같은 groupId의 이력 |
| complete, 현재 concrete, 모든 이전 구성원이 distinct | Store가 새 label 생성 | 새 그룹의 빈 이력 |
| unknown/동률/저확신, 그룹 내부 same/distinct 충돌, 서로 다른 둘 이상의 그룹에 same, 잘림/구형/출처 불일치 | 그룹 없음, 보수적 기존 범위 | 같은 상대/praise의 전체 유효 이력 |

Core의 새 `selectPraiseGroup(groups, evidence, complete)`는 `groups: readonly {eventId:string,revision:string,groupId:string|null}[]`와 검증된 RepetitionEvidence를 받아 `{kind:"new"}|{kind:"existing",groupId:string}|{kind:"fallback"}`를 반환하는 순수 함수다. Store가 이미 current/identity/revision과 현재 비교 집합을 재검증한 뒤 호출하며, kind=new일 때만 같은 commit에서 UUID를 생성한다. Core는 UUID/DB/공급자 호출을 만들지 않는다.

새 label은 관계가 아닌 감정 예산의 내부 표식이다. 그룹 병합·분할·과거 기록 재해석은 하지 않는다. A/B/A는 마지막 B만 비교하지 않고 A의 모든 유효 구성원도 비교하므로 A의 label을 재사용해야 한다. 결과가 모순이면 더 편한 그룹을 고르는 대신 기존 전체 범위를 쓴다.

`EvidenceInput.affectGroupId?:string`와 `socialAffect(..., affectEvidence?, groupId?)`를 추가한다. groupId가 있으면 해당 group 이력과 미분류 이력만 감정의 반복 횟수/소비 계산에 포함하고, 없으면 전체 동종 이력을 사용한다. 미분류는 모든 그룹에 적용되는 보수적 이력이며 새 그룹처럼 제외하면 안 된다. 현재 결정 규칙은 미분류 근거가 있는 동안 새 grouping을 승인하지 않지만 Core도 독립적으로 이 경계를 지킨다. direct_insult와 관계 socialEffect/projectRelationships는 그대로다. 감정 cap0.30은 허용된 성취 그룹별로 적용하되 group 미선택 시 기존 전체 cap이다. weight/hold/decay/0–1 clamp는 바꾸지 않는다.

**초기 제약:** 일반적 칭찬·구형 근거·8개 초과 이력이 남아 있으면 분리 대신 기존 범위를 쓰므로 새 성취도 억제될 수 있다. 이를 모든 상황의 의미 구분 완료라고 부르지 않는다. 600초 밖의 근거는 정상적으로 빠지며 새 감정 종류/상대의 독립성과 시간 회복을 해치지 않는다. 이 제한을 숨기거나 무제한 비교를 기본값으로 두지 않는다.

### 10.3 저장·삭제·동시성

기존 relationship_evidence.applied.affect에 `{version:3,stimulus,habituation,groupId:string|null}`를 저장한다. v2의 실제 stimulus 읽기와 legacy fallback을 계속 지원한다. 기존 features.relationshipEligible=false는 유지한다. affectGroupId는 내부 label이며 대표 event에 대한 FK가 아니다. root 출처가 삭제돼도 살아 있는 같은 그룹 행은 label/실제 소비를 보존한다. 새 테이블·새 영구 상태 writer·기존 기록 backfill은 없다.

commit의 기존 active/selected/event revision/epoch/세션 검사를 먼저 적용한다. 이후 원래 snapshot의 source 상태/revision/groupId와 현재600초 집합을 다시 조회한다. 신규 근거 추가·누락·시간 경계 이탈·revision 변경·complete 불일치이면 grouping 권한만 폐기해 전체 이력으로 계산한다. 이미 기존 epoch/source gate가 stale이면 전체 commit을 취소한다. 공급자 응답을 기다리는 동안 잠금을 잡거나 다시 API를 호출하지 않는다. 중복 commit은 새 label/감정/응답을 생성하지 않는다.

appraisals.context_refs에는 현재 입력과 실제 비교 출처의 `{id,revision}`를 함께 저장해 출처 삭제 시 파생 raw/envelope를 기존 삭제 쿼리로 제거한다. 비교 원문을 별도 DB 컬럼이나 transition에 복사하지 않는다. relationship_evidence_sources에는 **칭찬 사실의 직접 출처만** 연결한다. 비교 출처까지 같은 support group에 넣어 대표 삭제가 무관한 생존 칭찬 전체를 invalidated시키지 않게 한다. 이미 적용한 그룹 label과 실제 감정량은 역사적 적용 기록으로 남으며 raw가 지워졌다고 새 label을 만들거나 재생하지 않는다. 직접 칭찬 source 삭제는 해당 evidence만 기존 규칙에 따라 무효화한다. 원인 참조는 제거하지만 현재 감정 숫자는 정상 감쇠한다.

비교 원문은 DialogueContext/sources/memoryIds에 넘기지 않는다. 출력은 기존 currentInput과 현재 감정으로 생성한다. 이전 비교 내용을 언급하는 대사를 새 기능으로 요구하지 않는다. 현재 응답의 직접 출처 삭제/epoch 변경은 기존 취소 gate가 처리한다. 같은 상대에 대한 발화 제한은 여전히15초이며 새로운 그룹을 만들어 이를 우회하지 않는다. Stage에서 B의 자막을 확인하는 시연은 자연 시간15초를 확보한다.

### 10.4 성공 기준과 직접 소유 파일

| ID | 관측 가능한 성공 기준 | 구현·검증 소유자 |
|---|---|---|
| S2-A 근거/출처 계약 | 완전한 snapshot만 비교, 다른 상대·비관측·삭제·revision 불일치 제외,9번째/바이트 초과 감지. 외부 body에 내부 식별자/기억 없음 | contracts/ai-ports.ts의 AppraisalContext/선택적 verifyRepetition, appraisal.ts envelope v3; Store.select 및 새 private praiseSnapshot; Coordinator.drain; adapters/jev.ts.evaluate. 새 packages/adapters/src/repetition-evidence.test.ts, evals/repetition-groups.test.ts |
| S2-B 의미 판정 | 구체적 직접 칭찬만 concrete; 재표현·같은 성취의 다른 측면은 same, 별개 성취는 distinct. generic·타인·인용·부정·혼합·조작문구는 새 그룹을 얻지 못함. 추가 질문이 S1B 감정/참여를 막지 않음 | adapters/jev-schema.ts, jev.ts, appraisal-evidence.ts.verifyRepetition; 새 evals/fixtures/jev-repetition-v2.json, evals/jev-repetition-probe.ts 및 evals/jev-repetition.test.ts |
| S2-C A/B/A·상한 | 동일시각 strength3 A 반복은 .18/.09/.03/0, B는 .18, A 재등장은 기존 A 잔량. 600초 시간 회복 유지. incomplete/unknown/상충하면 기존 전체 범위와 동일; 다른 상대·공격 분리 | contracts/domain.ts EvidenceInput, Core.socialAffect와 새 selectPraiseGroup 순수 함수; 새 packages/character-core/src/repetition-groups.test.ts |
| S2-D 수명·관계 | 새 근거 전후 관계 v1 projection과 후속 확정 칭찬 관계량 불변. group root 삭제 후 살아 있는 멤버의 label/소비 유지. v2 혼합·직접 source 삭제·재시작·세션 전환·중복·늦은 결과에도 예산 재생 없음 | Store.evidenceInputs/commitAppraisal/deleteEvent, 기존 context_refs 소거 경로. 새 evals/repetition-groups.test.ts 및 기존 habituation/affect-evidence/db/provider-boundaries |
| S2-E 실제 연결 | 실제 Jev의 두 성취+재표현+A/B/A를 fixed synthetic로 구별하고 Gemma→Stage 표시/ACK 일치. 재접근/숨김/새 주제에서 기존 감정 지속. 기대한 분류에 도달하지 않으면 NOT_REACHED로 기록 | evals/emotion-participation-stage.ts의 선택적 그룹 장면, 기존 participation/coordinator 회귀. 실제 모델과 fixture 결과 분리 |

추가할 파일은 모두 위에서 **새**로 표시했다. `evals/jev-event-relation.ts`와 v1 fixture/이전12장면 결과는 평가 이력으로 보존하고 런타임에서 import하지 않는다. 중복 schema는 공급자 어댑터가 소유하며 신규 평가 도구는 그 후보 parser/request builder를 재사용한다. 이미 탈락한 후보의 기준을 몰래 바꾸지 않는다.

### 10.5 구현·검증 순서와 중단 조건

1. 새 의미 계약/순수 그룹 선택/출처 snapshot 테스트를 먼저 작성해 현재 전체 범위 계산에서 B까지 눌리는 red를 확인한다. typed ports, envelope, Core/Store의 저장 경계를 먼저 구현한다. 관계·삭제·restart 회귀가 통과하기 전 운영 Jev 기본은 v6로 유지한다.
2. 후보 v7 request/parser/verifier를 어댑터 내부에 별도 명시적 진입점으로 만든다. 기존 기본 v6에는 영향이 없게 하고 평가 도구가 직접 이 후보를 사용한다. 런타임 설정에 일회용 토글을 추가하지 않는다. 제품 반영 시 조립 지점을 한 번 바꾸는 방식으로 통합한다.
3. 첫 실호출 전 dev/확인 세트·정확한 질문·출처·예상 권한·비용·hash를 J에 고정한다. 기존 의미12장면은 노출 dev로만 사용한다. 신규 dev는 원문의 부정/혼합·generic·고양이/강아지 등 표면 유사하지만 별개인 사건·같은 그림의 다른 측면·8개 비교 경계를 포함한다. **권한 기준과 raw 의미 label 정확도를 별도 집계**하고 이전 S08 distinct 오판/S09 unknown을 성공으로 소급하지 않는다. 확인용은 새로운 합성 성취 쌍과 A/B/A 연속 장면으로 따로 작성하고 dev가 모두 통과하기 전 호출하지 않는다.
4. 요구된 same/distinct의 명확한 사례가 unknown이면 기능 도달 실패다. 조작 입력의 unknown은 새 예산 거부에는 안전하지만 same 판정 성공으로 세지 않는다. 타인/인용에 raw distinct가 나와도 target gate가 막았다는 사실과 의미 모델 오판을 따로 보고한다. 위험한 새 그룹 허용1건이면 채택 실패. 실패 문장에 맞춰 질문을 반복 조정하거나 unknown을 distinct로 올리지 않는다. 한 후보가 실패하면 저장된 실패와 소유 계약을 다음 수정 입력으로 남긴다.
5. 통과한 후보만 runtime registry/Store/Coordinator에 연결해 실제 Stage를 실행한다. 기존 S1B28건은 노출 회귀로 재평가하며 미사용 정확도로 부르지 않는다. 실제 연속 시연은 합성 칭찬 A→A 재표현→B→A, 타인/인용 대조와 기존 침묵·재질문·새 주제를 포함한다. 필요한15초는 실제 기다리고 clock 주입으로 실시간 성공을 꾸미지 않는다. 의도적 숨김의 plan과 형식·의미 실패를 구분한다.
6. 관련 CHARACTER_DOMAIN_SPEC §7/§10, DATABASE_SPEC의 applied.affect/context_refs, LOCAL_AI_INTEGRATION의 provider/version, VALIDATION_PLAN 및 BUILD_HANDOFF를 구현과 함께 갱신한다. 후보 실패면 v6 운영을 유지하고 S2를 미완료로 쓴다. 통과 후 이 BUILD의 감사로 넘긴다. C2 전체/E4/C3/C4는 별도다.

검사 환경과 명령(구현 후 실행; 이번 계획에서 실행한 결과 아님):

```powershell
# cwd: C:/Users/ltk90/vibe_coding_projects/ai-character-runtime
# TEMP/TMP와 모든 증거는 J:/ai/ai-character-runtime/c2-s2-20261011 아래 지정
node node_modules/vitest/vitest.mjs run --config vitest.config.ts --configLoader runner --no-cache packages/character-core/src/repetition-groups.test.ts packages/adapters/src/repetition-evidence.test.ts packages/character-core/src/habituation.test.ts packages/adapters/src/affect-evidence.test.ts packages/contracts/src
# 전용 합성 PostgreSQL55435/character_runtime_test에서만 reset 허용
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts --configLoader runner --no-cache evals/repetition-groups.test.ts evals/affect-evidence.test.ts evals/habituation.test.ts evals/participation.test.ts evals/provider-boundaries.test.ts evals/coordinator.test.ts evals/db.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

기존55434 Stage DB는 reset하지 않는다. 모델은 기존 설치 Gemma만 사용한다. 실제 Jev는 승인 누적USD1(현재 알려진 USD0.012874596 + 과거 usage불명1회) 안에서 실행별≤USD0.005, 호출 전 최악비용 예약과 실제 usage 누적을 확인한다. provider 오류/usage불명 시 즉시 멈추고 자동 재시도하지 않는다. 원문·키·개인파일·음성을 새 입력으로 쓰지 않는다. 실제 호출할 때 실행별 사전 명세가 필요하며 이 계획만으로 모델 결과를 PASS로 기록하지 않는다.

감사 초점: 미분류/잘린 이력을 무시한 false-new, 그룹 내부 모순과 A/B/A, 대표 삭제로 소비가 되살아나는 경로, 비교 참조를 칭찬 사실 support group에 섞은 전체 무효화, 요청 중 집합 변경, 새 context가 Jev의 기존 대상/강도 판정을 바꾸는 영향. 권한 거부와 의미 label 실패를 구분한다. 전체 이력 한도8/6000bytes가 실제 사용에서 너무 자주 fallback을 만드는지는 초기 제한으로 남기고 측정 없이 충분하다고 주장하지 않는다.

**다음 BUILD 입력:** “IMPLEMENTATION_PLAN §10의 C2-S2를 구현하고 집중 검증해. S1B/관계/침묵/숨김을 보존하고, 새 후보가 사전 기준을 통과할 때만 실제 Jev→Gemma→Stage로 연결해. 실패하면 운영 v6를 유지하고 실패 원문과 미완료 기준을 남겨.”

## 11. C2-S2 BUILD 결과 — 2026-10-13

2026-10-13 C2-S2: 성취별 반복 계산·출처 snapshot·그룹 저장 수명·v7 후보를 구현했다. 로컬 단위102건/합성 DB93건과 타입 검사, 이전 실제 S1B 응답28건의 오프라인 재계산은 PASS다. 그러나 실제 Jev 후보는 dev20건 중16건만 전체 기준을 통과해 미채택했다. 운영 Jev는 v6를 유지하며 새 저장은 affect v3(groupId=null)다. 확인6건과 새로운 Gemma/Stage 실행은 게이트 미통과로 수행하지 않았다. S2 전체/C2/E4/C3/C4는 미완료이며 다음은 실패 원문에 근거한 의미 비교 계약의 REPLAN이다.

S2-A/C/D는 로컬 구현·회귀 PASS이고 S2-B 실제 의미는 FAIL, S2-E는 NOT VERIFIED다. 구현 파일·작은 계획 차이·명령·출처 hash·실패4건은 BUILD_HANDOFF의 현재 절에 기록했다. 명시적인 중단 조건에 따라 candidate 프롬프트를 다시 조정하거나 확인/Stage로 승격하지 않았다. 현재 일반 실행은 v6이고 그룹 label은 생성하지 않으며, 추가 근거가 없는 경우 관계·침묵·시간 회복은 기존과 같다. 다음은 BUILD 반복이 아니라 실패한 의미 비교 계약의 REPLAN이다.

## 12. C2-S2 감사 1차 및 수정 계획 — 2026-10-13

사용자 요청: “일단 감사 후 필요시 수정계획과 성공기준 작성”. 이번 단계는 **AUDIT → REPLAN**이며 제품 코드·테스트·공급자 질문은 변경하지 않는다. 같은 대화 맥락의 감사이며 별도 모델이나 독립 컨텍스트 감사가 아니다. 검토 기준선은 J:/ai/ai-character-runtime/c2-s2-20261013/task-delta.json의24파일이고 검토 시작 시 모든 after hash가 일치했다. 관계/숨김/침묵/출처 정책과 기존 미커밋 변경을 보존한다.

### 12.1 감사 판정과 증거

**전체 판정: FAIL — S2 의미 기능의 완료 기준 미달.** 계산·저장 기반에서 새로 확인한 구현 결함은 없으며 운영 v6 유지와 확인/Stage 중단은 계획대로다. 이미 알려진 실제 의미 실패를 이번 감사에서 재확인한 것이고 새로운 장애4건을 추가 발견했다는 뜻은 아니다.

| 기존 기준 | 판정 | 확인한 증거 | 한계 |
|---|---|---|---|
| S2-A 출처/경계 | PASS(검토 범위) | 소스 일치, 기존 단위·DB 결과 재사용, 실제20응답 파서 재계산, revision/identity/asOf/complete 변조80건 거부 | 외부 모델 정확도 증거 아님 |
| S2-B 의미 판정 | FAIL | dev16/20, confidence 적용 pair24/29, 아래 F01의4장면 | 확인6건 미호출, 임계값 하향 금지 |
| S2-C 그룹/계산 | PASS(검토 범위) | 기존 A/B/A 회귀, 29,524조합에서 새/기존 label 권한의 필수조건 확인, 그룹 미선택 이력1,000조합에서 기존 수식과 일치 | 조합 검사는 모델 품질·모든 런타임 경로의 완전증명 아님 |
| S2-D 저장 수명 | PASS(검토 범위) | 기존 실제 합성 DB93건 증거와 Store/직접 소비자 정적 검토; root 삭제 후 label/소비 보존, context_refs 소거, 관계 replay 분리 | 이번 감사에서 DB를 다시 실행하지 않음 |
| S2-E 실제 연결 | NOT VERIFIED | dev 실패로 확인/실제 Stage를 수행하지 않았다는 기록과 코드 일치 | 이전 S1B Stage 성공으로 대체 불가 |

기존 단위102/DB93은 소스 일치를 확인해 재사용했으며195건을 이번에 새로 실행했다고 주장하지 않는다. 추가 감사의 검사 결과는 J:/ai/ai-character-runtime/c2-s2-20261013/audit/checks.json이다. API/로컬 모델/브라우저/DB 실행·다운로드·Git 변경0. 알려진 누적 비용은 USD0.014512134 + 과거 usage불명1회 그대로다.

**S2-F01 — REQUIRED / P2 / 실제 의미 기능 결함.** 소유자는 packages/adapters/src/jev.ts의 repetitionQuestions(34–37행), 후보 parser와 verifier의 직접 소비 경계다. S08에서는 타인 칭찬을 distinct(.94)로 판단했다. S11은 같은 설명의 논리→전달 방식, N02는 같은 그림→색칠인데 raw distinct가 최빈이고 confidence .34/.33이라 unknown으로 유보됐다. N07 A/B/A의 구성원 비교도 .61/.67로 미달했다. 기대는 각각 unknown / same / same / [same,same,distinct], 실제는 distinct / unknown / unknown / [same,unknown,unknown]이다. 결과적으로 불필요한 전체 범위 fallback 때문에 새 성취 구분을 완료하지 못한다. 잘못된 새 그룹 부여0은 안전 경계의 성과이고 정확도 통과가 아니다. 원문은 provider/probe-2026-10-13T01-37-06-599Z/{S08,S11,N02,N07}-response.json에 보존한다.

**S2-V01 — REQUIRED / 검증 공백.** S2-E의 확인6건과 후보→Gemma→Stage는 아직 미실행이다. 또한 evals/jev-api.ts의 approvedSyntheticJev와 evals/jev-s1b-probe.ts는 JevAppraisalProvider(v6)를 직접 만들고, evals/emotion-participation-stage.ts는 v6 상수로 manifest를 적는다. 따라서 나중에 runtime factory만 바꾸고 이 도구를 그대로 실행하면 후보 검증이 되지 않는다. 현재는 실행하지 않았으므로 잘못된 성공 보고가 발생한 결함으로 세지 않는다. 다음 검증 전에 **실제 공급자 버전과 기록 버전을 함께 선택**해야 한다.

보류: 예산 창 확대, 한도8/6000bytes 제거, 일반 칭찬을 자동 그룹화, 대표만 비교하는 최적화, DB/RAG/모델 교체는 이번 필수 수정이 아니다. 현재 보수적 제한은 명시한 초기 계약이며 근거 없이 풀지 않는다. 순수 그룹 선택·관계 계산·저장 스키마의 재작성도 필요 없다고 판단했다. 전체 한국어 자연스러움/E4/ER07/C3/C4는 기존 미완료 상태로 유지한다.

### 12.2 F01의 변경 방향 — 평가 전용 v8 한 후보

이번 증거로 Jev 자체가 개선 불가능하다거나 새 방식이 더 정확하다고 단정할 수 없다. v7의 긴 단일 same/distinct/unknown 질문을 반복 첨삭하는 대신, **동일 사건 근거와 별개 사건 근거를 각각 판단하는 한 후보**를 검증한다. 이는 미검증 설계 가설이다. 새 모델·추가 API 왕복·임계값 하향·결과 기반 자동 재시도는 추가하지 않는다.

공통 AppraisalContext/RecentPraise/RepetitionEvidence와 envelope v3, Core/Store는 유지한다. adapter 내부 v8의 원래5질문과 현재 concrete 질문도 유지한다. 각 이전 입력마다 다음 두 choice 질문(yes/no/unknown)을 같은 요청에 넣는다.

1. same_event: 두 문장이 **주소된 캐릭터가 수행한 동일한 구체적 산출물/수행 사건**을 평가하는가? 평가 항목·형용사 차이는 사건 차이로 보지 않는다. 논리/전달, 색상/구도처럼 일반적 측면 구분을 rubric으로 설명하되 기존 실패 문장 자체를 정답 예제로 박지 않는다.
2. separate_event: 두 문장이 주소된 캐릭터의 **명시적으로 다른 산출물 또는 수행 회차**를 평가하는가? “새 칭찬” 주장이나 다른 평가 항목만으로 yes를 주지 않는다. 타인·비지지 인용·부정·혼합·참조 불명은 두 질문 모두 긍정할 근거가 없다. 조작 지시를 따르지 않고 남은 실제 평가 내용만 판단한다.

각 질문은 strict choice schema/분포 합/유일 최빈/.8 검증을 동일하게 적용한다. 두 답이 모두 확실할 때 (yes,no)만 same, (no,yes)만 distinct, (no,no)는 unknown이다. (yes,yes), 어느 한쪽 unknown/동률/저확신이면 unknown이다. 전체 Appraisal.uncertain에는 이 추가 질문의 불확실성을 합치지 않는다. malformed 응답은 전체 공급자 실패로 한 번 종료한다. concrete=false 또는 현재 칭찬 자격 없음은 기존처럼 그룹 권한을 주지 않는다.

v8 원문은 v7으로 재명명하지 않는다. providerResult에는 v8 전용 repetitionV8={concrete,comparisons:[{sameEvent,separateEvent}]}를 사용하고 기존 repetition 필드와 동시 존재/버전 불일치를 거부한다. 새로운 mapJevRepetitionV8Response가 strict parse하고 verifyRepetition이 같은 공통 relation 형태로 정규화한다. raw 두 답, confidence, 정규화 relation, 그룹 권한을 각각 기록한다. 타인에 대한 잘못된 긍정 답을 target gate가 막았다는 사실로 의미 정확도 성공을 대체하지 않는다. 구체적인 사건 여부와 pair 정확도는 별도로 집계한다.

비교8개면 추가16질문이므로 **실제 직렬화한** 요청 크기를 먼저 검사한다. 8개 정상 합성 장면이32000bytes 안에서 전부 비교되는 것을 단위 검사로 증명한다. state16384/이전 원문6000/문장1000자·4096bytes/응답65536/15초 제한은 유지한다. 초과하면 비교 전체를 제거하고 S1B 경로로 축소한다. 8개 기본 장면부터 축소된다면 실호출 전에 후보 설계 실패로 멈춘다.

### 12.3 파일·심볼과 순서

| 순서/연결 항목 | 정확한 소유 파일·심볼 | 변경 및 이유 |
|---|---|---|
| 1 — F01 parser/mapper | packages/adapters/src/jev.ts: 신규 JevRepetitionV8Candidate, v8 질문 builder, mapJevRepetitionV8Response; 기존 evaluate의 명시적 후보 분기 | v6 기본과 v7 재현 경로를 보존하고 한 호출의 v8 질문/파싱만 추가. 운영 환경 변수 토글은 만들지 않음 |
| 1 — F01 raw/권한 | packages/adapters/src/jev-schema.ts: providerResultSchema와 신규 v8 raw schema; packages/adapters/src/appraisal-evidence.ts: verifiedEvidence/verifyRepetition | 버전/출처/기본 판정 검증을 유지하며 v8 raw를 공통 관계 근거로 정규화. Core/Store/DB 변경 불필요 |
| 2 — F01 집중 회귀 | packages/adapters/src/repetition-evidence.test.ts(수정) | 두 답의 모든 조합, 임계값 양쪽·동률·malformed·key 누락/추가·버전 혼합·출처 변조,8개 body 크기 및 전체 축소 검사. v6/v7 재생과 S1B 보존 |
| 2 — F01 평가 명세 | evals/fixtures/jev-repetition-v3.json(**신규**) | v2/dev20의 입력·기대 relation/그룹 결정을 그대로 포함하고 새 독립 대조6건 추가. 기존 v2와 실제 결과는 보존. 확인6건은 기존 미호출 내용을 그대로 참조/복사하고 답에 맞춰 수정하지 않음 |
| 2 — F01/V01 평가 집계 | evals/jev-repetition-probe.ts(수정), evals/jev-repetition.test.ts(**신규**) | v7/v8 후보·fixture를 평가 도구에서 명시 선택. 질문/버전/소스 hash를 실제 선택에서 생성. pure 채점 helper를 export 또는 같은 파일의 CLI 실행을 분리해 오프라인 검사. existing이면 kind뿐 아니라 기대 groupId도 비교. 합성 실패를 넣으면 confirmation을0회 호출하는 gate 확인 |
| 3 — F01 실제 후보 | 동일 probe의 v8 평가 진입점 | 고정 dev26 → 전부 통과할 때만 미호출 확인6. 원문 두 답과 정규화 relation/권한을 따로 집계. dev 실패 시 확인/Stage 중단 |
| 4 — V01 S1B/공급자 일치 | evals/jev-api.ts: approvedSyntheticJev; evals/jev-s1b-probe.ts; evals/emotion-participation-stage.ts의 공급자 생성·manifest | 승인 flags/예산 체크를 유지한 명시적 평가 후보 선택을 지원. provider.promptVersion와 실제 request/schema에서 manifest 작성. v6 하드코딩을 새 후보 결과로 오인하지 않게 함. S1B28건은 완전한 빈 최근 비교 context로 concrete 질문까지 포함해 노출 회귀로 평가 |
| 5 — V01 승격/Stage | apps/runtime/src/providers.ts: registeredProviders.appraisal.jev; evals/emotion-participation-stage.ts의 합성 그룹 장면 | dev26/확인6/S1B28 통과 후에만 조립점을 후보로 전환. 실제 Stage 아래 기준 확인. Stage 실패면 해당 전환만 v6로 되돌리고 미채택 기록, 기존 작업은 보존 |
| 6 — 상태 문서 | BUILD_HANDOFF.md, IMPLEMENTATION_PLAN.md, VALIDATION_PLAN.md, LOCAL_AI_INTEGRATION.md 및 README/PRODUCT_PLAN_V3의 최신 상태 | 구현/모델 결과/실제 Stage/미완료를 구분. Core/DB 계약이 그대로면 해당 명세를 불필요하게 다시 쓰지 않음 |

새 대조6건은 첫 API 호출 전에 다음 범주별 정확한 합성 문장과 기대값을 고정한다: 같은 연주의 박자/강약, 같은 요리의 맛/담음새, 같은 코드 수정의 정확성/가독성, 같은 종류지만 다른 수행 회차, 하나는 타인의 성취, 복수 그룹에서 다른 측면의 A로 복귀. 현재 실패 문장의 단어 치환만으로 구성하지 않는다. 자동 생성 정답을 모델 자기판정으로 대체하지 않는다.

### 12.4 성공 기준과 검증 경로

| ID(원래 기준) | 관측 가능한 통과 조건 | 검증 |
|---|---|---|
| S2-R1(S2-A/B) | v8의 권한은 정확한 버전·현재 사건/상대/revision·전체 비교 snapshot에만 결합. 두 답의 충돌/모름/저확신/동률은 unknown, malformed는 단일 실패. v6/v7 raw 재생 결과 불변 | adapter repetition-evidence 및 기존 affect-evidence/jev 테스트 |
| S2-R2(S2-A) | 정상8비교 요청이 잘리지 않고32000bytes 이하. 내부 ID·revision·label·기억 전송0. 초과는 부분 비교 없이 전체 축소, 추가 호출0 | request를 캡처하는 단위 테스트; 실제 N06 request도 대조 |
| S2-R3(S2-B/C) | dev26 전부 기대 relation·구체성·그룹에 도달하고 잘못된 새 그룹0. 기존 S08/S11/N02/N07 성공 필수. existing은 **정확한 이전 label**까지 일치. 원시 긍정 오판과 권한 거부는 별도 집계 | v3 fixture와 실제 raw/manifest/results. v7 실패 점수는 그대로 보존 |
| S2-R4(S2-B/E) | dev 통과 전 확인 호출0; 통과 후 고정 확인6/6. 하나라도 unknown으로 유보돼 기대 same/distinct에 도달하지 못하면 미통과. 공급자 오류/usage불명 시 즉시 중단 | 오프라인 gate 회귀 및 실제 호출 ledger. 확인 실패 뒤 같은 세트 재튜닝 금지 |
| S2-R5(S1B/S2-D) | 후보로 S1B 권한28/28 유지. 관계와 strict appraisal,0감정 발화,15초 침묵,이유·숨김·감정 지속 회귀 유지 | 명시적 후보 S1B probe + 영향받은 기존 단위/합성 DB 검사. 기존 대상 오판을 새로 통과했다고 바꾸지 않음 |
| S2-R6(S2-E) | 실제 Jev 후보의 A→A재표현→B→A에서 같은 A label 유지·B label 분리, 자극이 저장된 history/강도/시각의 수식과 일치. B 발화는 실제15초 간격 확보. Stage DOM 대사와 shown/finished ACK 일치, 타인/인용은 새 label 없음, 기존 침묵·숨김·새 화제 감정 유지 | 기존55434 합성 DB와 설치 Gemma, 실제 Chrome/Stage. 모델 결과를 inject하지 않음. 정상 UI 자막·DB·manifest의 후보 버전 모두 일치 |

동일시각 .18/.09/.03/0 및 B .18은 기존 Core 단위 기준으로 유지한다. 실시간 Stage에서는 경과 시간과 실제 Jev 강도가 다르므로 그 숫자를 고정 기대치로 강요하지 않고 **실제 history와 공식으로 계산한 기대값**을 대조한다. 실제15초를 기다리는 것을 clock 주입으로 대체하지 않는다. 상대/종류 전체 fallback이 있는 장면을 의미 그룹 성공으로 세지 않는다.

### 12.5 실행 조건·명령·인계

다음은 **계획 명령이며 이번 감사에서 실행하지 않았다.** cwd는 C:/Users/ltk90/vibe_coding_projects/ai-character-runtime. TEMP/TMP/로그/원문/모델 cache는 새 J:/ai/ai-character-runtime/c2-s2-repair-<실행일>/ 아래. 로컬 DB 검사는 기존 합성 전용55435만 reset 가능, Stage55434는 reset 금지. 기존 Ollama11434는 사용자 요청 없이 종료하지 않는다.

~~~powershell
node node_modules/vitest/vitest.mjs run --config vitest.config.ts --configLoader runner --no-cache packages/adapters/src/repetition-evidence.test.ts packages/adapters/src/affect-evidence.test.ts packages/adapters/src/jev.test.ts packages/character-core/src/repetition-groups.test.ts packages/contracts/src
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts --configLoader runner --no-cache evals/jev-repetition.test.ts evals/repetition-groups.test.ts evals/affect-evidence.test.ts evals/habituation.test.ts evals/participation.test.ts evals/provider-boundaries.test.ts evals/coordinator.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
# 다음 옵션은 이 수정 계획에서 구현할 평가용 옵션. 현재 runner에는 아직 없음.
node --experimental-transform-types evals/jev-repetition-probe.ts --candidate v8 --fixture evals/fixtures/jev-repetition-v3.json --synthetic-inputs --allow-jev-api --max-cost-usd 0.005 --output-root J:/ai/ai-character-runtime/c2-s2-repair-<실행일>/provider
~~~

영향없는 Store/Core 검증은 소스·환경이 유효하면 재사용할 수 있다. 변경된 어댑터의 fixture 통합과 평가기 회귀는 재실행한다. 운영 전환 시에는 actual candidate S1B/Stage를 새로 확인한다. Stage harness에 추가할 평가용 --repetition-groups와 후보 선택 옵션은 원래 예산/합성자료 승인 guard를 유지하고, manifest를 먼저 저장한 뒤 호출한다. 기존 로컬 Gemma/tokenizer만 사용하며 새 다운로드·개인자료·음성은 없다.

유료 실행은 기존 누적USD1 승인 안에서 각 실행≤USD0.005이고 알려진 누적 비용을 실제 직전 결과로 갱신한다. 과거 usage불명1회는 계속 표시한다. 추가 질문이 늘었으므로 request 상한을 지키고 예약비용이 충분한지 실행 전 확인한다. 충분하지 않으면 호출하지 않고 예산 미검증으로 남긴다. 모델 오류·usage불명·dev/확인 실패는 자동 재시도하지 않는다.

**중단 규칙:** 이 v8 한 후보가 실패하면 같은 turn에서 v9를 만들어 다시 시험하지 않는다. 실패 원문·기준과 운영v6를 보존하고 결과를 보고한다. 성공하면 이 범위의 AUDIT를 제안한다. 이번은 S2 감사1차이며 수정/재감사 반복 한도3회를 새 이름으로 초기화하지 않는다.

**다음 BUILD 입력:** “IMPLEMENTATION_PLAN §12의 S2-F01/S2-V01 수정 계획과 S2-R1–R6를 구현·검증해. v6와 기존 DB/Core/숨김을 보존하고 v8 한 후보만 시험해. dev/확인/S1B 게이트 통과 후 실제 Stage를 확인하며, 실패하면 운영v6와 원문을 유지하고 중단해.”

## 13. §12 수정 BUILD 결과 — 2026-10-13

2026-10-13 C2-S2 수정 BUILD: §12의 v8 한 후보를 구현·검증했다. 집중 로컬124건과 타입 검사는 PASS, 이전 v6 실응답28건/v7 실응답20건의 오프라인 재계산도 동일했다. 실제 v8은 dev23/26으로 미채택했다(기존20건18/20, 신규6건5/6). S08/N07/R06은 남았고 확인6건·후보 S1B 실호출·Gemma/Stage는 게이트 미통과로 수행하지 않았다. 운영은 v6를 유지한다. S2 전체/C2/E4/C3/C4는 미완료이며 동일 작업에서 추가 후보를 만들지 않는 중단 기준을 적용했다.

S2-R1/R2의 parser·provenance·8개 크기·기존 버전 보존은 PASS다. S2-R3 실제 의미는23/26으로 FAIL, R4의 실제 확인과 R5의 실제 후보 S1B/R6 Stage는 NOT VERIFIED다. 로컬 R4 gate 검사와 R5 관계/침묵 회귀는 통과했다. 파일·작은 직접 소비자 보강·비용·실패 세부는 BUILD_HANDOFF의 현재 절을 따른다. 이전 계획과 성공 기준은 유지하며 실제 호출 뒤 질문·임계값·확인 문장을 변경하지 않았다.

§12의4–5단계는 앞 dev 게이트를 통과하지 못해 대기 상태다. 실제 후보와 S1B/Stage helper의 버전을 맞추는 S2-V01은 아직 미구현/미검증이다. 운영 factory는 계속 v6다. 이번 수정 BUILD로 기존 감사1차의 F01/V01을 닫지 않는다. 다음 선택은 새 후보를 즉시 실행하는 것이 아니라 이 실패 기록에 대한 후속 감사 또는 계약 재검토다.

## 14. S2 감사2차와 판정 정책 수정 계획 — 2026-10-13

사용자 “다음은?”에 제안한 정책 감사·수정 계획을 “해”로 승인받아 수행했다. 이번은 같은 대화 맥락의 재감사이며 구현 승인이 아니다. §12/13은 당시 기준과 실패 기록으로 보존한다. 다음 BUILD는 이 절을 따르며, 제품 코드·질문·fixture·운영 기본은 이번에 변경하지 않았다.

### 14.1 확인한 근거와 판정

기준선은 HEAD d4a91e86715ad87c542d99266a7447911e7c36f4 및 J:/ai/ai-character-runtime/c2-s2-repair-20261013/task-delta.json의14개 파일이다. 문서 수정 전 hash14/14 일치. 실제 원문은 같은 경로의 provider/probe-2026-10-13T02-03-50-000Z/manifest.json, results.json이다. 현재 scoreRepetition으로 저장된26행을 오프라인 재계산해 JSON 결과가 모두 일치했다. 첫 검사에서는 메모리의 undefined 필드와 JSON 저장 시 생략된 필드 차이로 단언이 실패했고, JSON 표현을 맞춘 재검사에서 차이0이었다. 제품 결함이나 API 재시도가 아니다. 기존 로컬124건과 타입 검사는 재실행하지 않았고 해당 소스가 같은 범위의 증거로 유지한다.

| 항목 | 판정 | 근거와 한계 |
|---|---|---|
| S2-R1/R2 및 기존 출처·저장 경계 | PASS, 검토 범위 | v8은 계획된 양쪽 .8 정책을 그대로 구현. 새 저장/공통 계약 변경 없음. 전체 제품 재감사 아님 |
| S2-R3 / S2-F01 | FAIL | 기존23/26 유지. N07/R06은 same=yes .97이나 separate=no .74/.62여서 unknown→fallback. S08은 타인 성취를 raw distinct로 오판 |
| S2-R4/R5/R6 / S2-V01 | NOT VERIFIED | 확인6·실제 후보 S1B·Stage 미실행. 평가 helper의 v6 고정도 그대로 |
| 전체 S2 | FAIL | 의미 도달 실패와 실제 연결 공백이 남음. 과거 Stage 성공으로 대체하지 않음 |

**S2-F01의 원인 분리:** N07/R06은 jev.ts의 repetitionV8Relation에서 같은 사건 긍정과 별개 사건 부정의 확신을 모두 요구한 설계가 기능 도달을 막는다. 코드가 계획을 어긴 버그는 아니다. S08은 원시 의미 오류지만 appraisal-evidence.ts의 verifiedEvidence가 target=other를 거부하므로 실제 그룹/칭찬 감정 권한은 없다. 둘을 같은 수정으로 취급하지 않는다.

**주의할 반례:** 기존 label을 재사용하는 것도 무위험하지 않다. Core.socialAffect는 다른 그룹의 소비를 제외한다. 동일시각 A 소비.12/B 소비.18, 현재 strength3이면 전체 fallback은0, A 재사용은.09다. 이번에 현재 함수로 직접 계산해 확인했다. 따라서 “새 UUID만 만들지 않으면 안전하다”는 가정은 채택하지 않는다. 잘못된 기존 그룹 선택도 필수 실패다.

### 14.2 변경 이유와 후보 계약

제품 목적은 같은 성취에 익숙해지면서 별개 성취에는 다시 반응하는 것이다. 동일 사건의 강한 긍정 근거가 있을 때 반대 질문의 확신까지 중복 요구하는 방법은 이 목적에 필요한 유일한 방법이 아니다. 다음 한 후보에서는 **동일성의 긍정 근거와 별개 사건의 긍정 근거를 비대칭으로 사용**한다. 이는 근거 결합 정책 변경이며, 단순 버그 수정이나 검증된 확률 교정이라고 부르지 않는다.

- 후보 mappingVersion은 jev-appraisal-v9. 외부 질문과 request 구성은 v8 그대로 사용한다. 원래5질문, concrete, S1B95% tail, target/act .8, source/revision/snapshot, 크기·호출 한도는 유지한다. 새 프롬프트 튜닝이나 모델 교체는 없다.
- same: sameEvent의 유일 최빈 choice=yes, confidence≥.8이 필수다. separateEvent는 schema·분포가 유효하고 **유일 최빈 choice=no**여야 한다. 이 부정 답에만 별도 .8 조건을 요구하지 않는다. no의 낮은 confidence를 새로운 강한 증거라고 해석하지 않는다.
- distinct: 기존대로 sameEvent=no와 separateEvent=yes가 모두 유일 최빈·confidence≥.8이어야 한다. 별개 사건 근거 없이 신규 감정 예산을 주지 않는다.
- yes/yes, no/no, 어느 쪽이든 unknown·동률, same의 낮은 confidence는 unknown이다. separate=yes가 낮은 confidence라도 same으로 덮지 않는다. malformed는 단일 provider 실패다. “강한 same이면 다른 답을 전부 무시”하는 정책은 금지한다.
- 공통 RepetitionEvidence와 Core.selectPraiseGroup은 그대로다. 한 그룹의 **모든** 구성원 same, 다른 그룹의 모든 구성원 strict distinct가 있어야 기존 label을 재사용한다. 여러 그룹 same·그룹 내부 충돌·incomplete·미분류는 전체 fallback. 다른 그룹 unknown을 무시하거나 최고점 그룹을 고르지 않는다.
- v9의 raw 필드는 repetitionV9={concrete,comparisons:[{sameEvent,separateEvent}]}로 명시한다. 구조 검증은 기존 pair schema를 재사용하되 v7/v8/v9 필드·버전 혼합을 거부한다. envelope v3는 유지하고 과거 v8을 v9로 재명명하거나 저장 이력을 재해석하지 않는다. 새 mapping과 verifier만 v9 권한을 낸다.

**S08 처리와 평가 기준 변경:** 원래 S2-R3의 “보호 대상까지 모든 원시 relation 일치”는 v8의 평가 기준으로 남긴다. 다음 후보의 채택 기준은 사전에 고정한 유효 직접 칭찬의 의미·정확한 label 도달과 보호 입력의 권한 거부로 분리한다. 보호 입력의 원시 relation 오류는 진단 FAIL로 계속 보고하지만, 대상/행위/구체성 및 권한 검사가 모두 맞으면 그 오류 하나만으로 후보 전체를 탈락시키지 않는다. 이것은 채택 기준의 명시적 변경이며 기존23/26을 PASS로 고치는 것이 아니다. S08 원시 오류는 DEFER로 유지하고, N07/R06 도달 및 S2-V01은 REQUIRED다. 보호 입력에 잘못된 칭찬 감정 또는 기존/신규 label이 생기거나 정상 입력을 보호 대상으로 잘못 분류하면 필수 실패다.

평가기의 보호/유효 구분은 **호출 전 fixture 기대값**으로 정한다. 모델이 eligible=false라고 답했다고 실패 정상 입력을 평가 대상에서 제외하지 않는다. rawSemanticPass, policySemanticPass, protectionPass, authorityPass와 각각의 분모를 별도로 기록한다. 원래 기대 relation 배열과 historical pass도 보존한다. 정답 label까지 일치해야 하며 false-new뿐 아니라 false-existing도0이어야 한다.

### 14.3 파일·심볼과 구현 순서

| 순서 / 항목 | 수정 소유자 | 작업과 증거 |
|---|---|---|
| 1 / F01 정책 | packages/adapters/src/jev.ts: 후보 상수·BaseJevAppraisalProvider·신규 repetitionV9Relation/mapJevRepetitionV9Response/JevRepetitionV9Candidate; jev-schema.ts: providerResultSchema; appraisal-evidence.ts: verifiedEvidence/verifyRepetition | v8 질문 재사용, v9만 새 결합 규칙. v6/v7/v8 계산 보존. 공통 포트/Core/Store/DB 수정 없음 |
| 2 / 회귀 | packages/adapters/src/repetition-evidence.test.ts; evals/repetition-groups.test.ts | 수정 전 N07/R06 형태의 유효 strong-same/weak-no가 fallback인 사실 재현. 경계·모순·기존/신규 label·실제 합성 DB 연결 검증 |
| 3 / 평가 기준 | evals/jev-repetition-probe.ts: scoreRepetition/runGatedRepetitionCases/runProbe; evals/jev-repetition.test.ts; 신규 evals/fixtures/jev-repetition-v4.json | 명시적 v9 선택과 rubric 버전, 고정된 기대 보호 범위, 분리 집계. 기존 v3와 과거 점수 보존. 모델의 거부로 분모를 줄일 수 없다는 반례 검사 |
| 4 / 사전 고정·실평가 | 동일 probe/fixture | 기존 dev26을 노출 진단으로 유지. 기존 미호출 확인6 원문/기대값 보존 + 신규 대조6 고정. 신규6은 동일 성취의 다른 측면2, 유사하지만 별도 성취2, 타인/혼합2. 결과를 보기 전에 모든 문장·기대 대상/구체성/그룹·hash 고정. dev 후 확인12를 한 번씩만 호출 |
| 5 / V01 | evals/jev-api.ts: approvedSyntheticJev; evals/jev-s1b-probe.ts; evals/emotion-participation-stage.ts | 앞 게이트 통과 후 후보를 명시 선택. provider 인스턴스·실제 질문 구성·manifest 버전을 맞춘다. 후보의 실제 S1B28, 이후 기존 연속성/그룹 Stage 장면 실행. v6 고정 helper로 v9 증거를 만들지 않음 |
| 6 / 채택 및 문서 | apps/runtime/src/providers.ts: registeredProviders, evals/provider-boundaries.test.ts; 현재6개 문서 | 위 단계 모두 통과한 경우만 운영 조립에 후보 연결하고 factory 버전 parity 확인. 실패면 v6 유지. 인계·구현·검증·제품·README·공급자 문서에 실제 결과와 남은 한계 반영 |

### 14.4 성공 기준

원래 S2-A/C/D, S2-R2/R5/R6는 유지한다. §12의 v8 전용 R1/R3/R4는 과거 결과를 보존하고 다음 후보의 차이를 아래 P1–P5로 구별한다. P1–P5는 현재 모두 **NOT IMPLEMENTED / NOT VERIFIED**다.

| ID | 관측 가능한 성공 기준 | 검증 경로 |
|---|---|---|
| S2-P1 / F01 | same .8/바로 미만, separate no의 저확신, yes 충돌, unknown/동률, no/no, malformed를 구별. strict distinct 조건은 그대로. v6/v7/v8 저장 원문 재계산 불변, 출처 변조는 거부 | repetition-evidence/affect-evidence/jev 단위 및 이전 실제28+20+26 재생. v9로 과거 raw 재라벨 금지 |
| S2-P2 / F01 | A/B/A에서 정확한 A label, A의 모든 구성원 same 필요. 다른 그룹 unknown/두 그룹 same은 fallback. 잘못된 기존 label도 실패. .18/.09/.03/0 상한·B독립·관계0·15초·미분류/삭제 경계 유지 | 기존 Core 검사 + v9 mock을 통한 repetition-groups 합성 DB. .12/.18 소비 반례 포함. mock은 언어 품질 증거 아님 |
| S2-P3 / 평가기 | 사전 고정된 유효 입력은 의미/구체성/정확한 label 전부 통과. 보호 입력은 기대 대상·행위·구체성 및 권한 거부를 검사하며 타인/인용/부정/혼합 감정 권한0. raw 오류는 따로 FAIL 보고. false-new/false-existing0 | 평가기 반례: 정상 입력을 모델이 거부해도 FAIL, 보호 raw 오판을 숨기지 않음, 보호 입력의 권한 발생 즉시 FAIL |
| S2-P4 / 실제 의미 | dev26의 P3 기준 전부 통과 → 고정 확인12의 P3 기준 전부 통과. N07/R06 exact label 및 S08 보호 gate 필수. dev 미통과면 확인0회. 추가6은 별도 분모 보고 | 실제 v9 manifest/request/response/results. 과거26 노출 진단과 신규 확인을 섞어 일반화 정확도로 주장하지 않음 |
| S2-P5 / V01 | 실제 v9 S1B28 권한 보존 후 Jev→Gemma→Stage의 A/A재표현/B/A. 저장 history·시각·강도 수식과 자극 일치, label/DOM/ACK/버전 일치. 기존 침묵·이유·숨김·새 화제 지속 유지 | §12 R5/R6 그대로. 실제15초 간격, 설치 Gemma만 사용. 실패 시 승격 없음 |

### 14.5 실행과 중단

cwd는 저장소 루트. 집중 명령은 §12.5의 단위·통합·타입 검사를 사용하며 변경된 evaluator/provenance/DB 소비자만 필요한 범위로 실행한다. 다음 CLI 옵션은 **계획이며 아직 구현하지 않았다**:

~~~powershell
node --experimental-transform-types evals/jev-repetition-probe.ts --candidate v9 --fixture evals/fixtures/jev-repetition-v4.json --synthetic-inputs --allow-jev-api --max-cost-usd 0.005 --output-root J:/ai/ai-character-runtime/c2-s2-policy-<실행일>/provider
~~~

로그·원문·임시파일은 J:/ai, 합성 DB55435만 reset 가능, Stage55434 reset 금지, 기존 Ollama11434 유지. 각 호출 전 예약 비용과 직전 ledger를 확인한다. 현재 알려진 누적 USD0.016874592+과거 usage불명1회이며 계정 청구 총액은 미확인이다. 실행당≤USD0.005·총USD1, 오류/usage불명/예산 부족 시 중단, 자동 재시도0. 이번 계획에서 API/DB/브라우저/모델 호출과 commit/push는0이다.

이 정책 한 후보만 구현·검증한다. dev/확인/후보 S1B/Stage 중 필수 기준이 실패하면 다음 단계와 승격을 멈추고 결과를 보고한다. 같은 실행 결과를 본 뒤 질문·정책·fixture를 다시 바꾸지 않는다. 이번 감사는 누적2차이며 다음 재감사가3차다. 이름을 바꿔 반복 횟수를 초기화하지 않는다. 3차에도 남는 문제는 자동 재계획 반복 대신 남은 기능 제한과 결정을 보고한다.

**다음 BUILD 입력:** “IMPLEMENTATION_PLAN §14의 정책 후보와 P1–P5를 구현·검증해. v8 질문과 과거 결과를 보존하고 기존 그룹 재사용 근거만 명시적으로 분리해. 보호 입력의 raw 오류를 숨기지 말고, 게이트를 통과하면 실제 후보 S1B와 Stage까지 확인해. 실패하면 v6를 유지하고 멈춰.”

## 15. §14 정책 BUILD 결과 — 2026-10-13

사용자 “진행”에 따라 v9 한 후보를 구현했다. **실제 dev23/26으로 미채택, 운영 v6 유지.** §14.3의1–4단계까지 실행했으며 dev 실패로5–6단계의 후보 S1B/Stage helper 연결·실제 실행·운영 승격은 구현/실행하지 않았다. 후보가 탈락한 상태를 S2 완료라고 부르지 않는다. 이 절은 BUILD 결과이며 누적3차 감사는 아직 하지 않았다.

구현: JevRepetitionV9Candidate, repetitionV9Relation/mapJevRepetitionV9Response, v9 raw 필드와 provenance verifier, 후보 평가기/fixture와 집중 회귀다. v8/v9의 동일 wire 응답 파싱은 private mapPredicateResponse로 공유하고 v8 결과는 그대로 유지했다. §14의 BaseJevAppraisalProvider 표기는 현재 실제 클래스 JevAppraisalProvider에 적용했다. 공통 포트/Core/Store/DB/운영 factory는 변경하지 않았다.

평가 기대값을 호출 전에 고정했다. generic 직접 칭찬·실제 칭찬이 남는 명령 삽입은 group-protected로 새 label만 거부하며 기존 S1B 감정을 유지한다. 타인·인용·부정·혼합은 praise-protected로 칭찬 감정/참여 권한까지 거부한다. 이는 모든 보호 문장의 감정을0으로 만드는 S1B 회귀를 피하기 위한 기존 계약의 구체화다. N04 혼합 입력의 기대 act는 praise/other로 고정했으며 결과 teasing을 보고 추가하지 않았다. scope는 모델 결과로 바뀌지 않는다.

| 기준 | 결과 | 실제 증거 |
|---|---|---|
| S2-P1 | PASS, 로컬/이전 원문 보존 | 단위70건, 타입 PASS. 강한 same/약한 no·.8 경계·모순·동률·버전·출처·0/8비교. 기존 v6 28/v7 20/v8 26 실응답 재계산 동일 |
| S2-P2 | PASS, 모의 공급자+합성 DB | 통합61건에 v9 A/B/A .12/.12/.06·정확한 label·관계 자극0·unknown fallback 포함. Core의0 대.09 소비 반례도 단위 검사 |
| S2-P3 | PASS, 평가기 구현 | 정상 입력 오거부가 분모에서 빠지지 않음, raw 오류 보존, 보호 입력의 잘못된 권한/기존 label 거부 검사. 통합61에는 평가기6건 포함 |
| S2-P4 | FAIL | 실제26호출23 PASS. 유효 입력의 결합 relation16/16, 보호 권한 거부10/10이나 구체성24/26·기대 분류25/26·그룹24/26. false-new/false-existing0 |
| S2-P5 / S2-V01 | NOT VERIFIED | 확인12건·실제 후보 S1B28·Gemma/Stage 미호출. 전 단계 실패로 helper 후보 연결과 승격도 대기 |

기존 N07/R06은 정확한 A label을 재사용했다. S08은 raw distinct 오판을 그대로 보고하되 사전 정책대로 타인 권한 거부는 통과했다. 새로 도달하지 못한 S10/N00은 concrete=yes confidence .79로 유보됐다(이전 v8 .80/.83). N04는 target=other이나 act=teasing으로 사전 기대 praise/other를 벗어났다. 해당 teasing은 이전 v8 원문에도 있어 이번 제품 변경의 새 회귀라고 단정하지 않는다.

이전 v8과 이번 v9의 **실제 요청 본문26/26이 byte 단위 동일**했다. 따라서 S10/N00의 변화는 질문 변경이 아니라 같은 요청의 공급자 출력 변동으로 관측했다. 한 번의 관측이며 변동률이나 원인을 일반화하지 않는다. confidence .79를 통과시키거나 실패 장면을 다시 호출하지 않았다. 새 raw choice 기준 의미는23/26, 새 confidence 결합 relation은25/26이다. 같은 v9 응답에 과거 v8 결합/전체 의미 기준을 적용한 진단은21/26이며 과거 실제 v8의23/26 기록과 다른 자료다.

증거: J:/ai/ai-character-runtime/c2-s2-policy-20261013/의 baseline-hashes.json/baseline, red.log, unit.log(70), integration.log(61), typecheck.log, replay.json(74), provider/probe-2026-10-13T02-37-22-289Z/manifest.json·results.json·각 request/response, task-delta.json/patch. 최초 회귀는 v8 unknown을 확인하고 미구현 v9 함수에서1 FAIL/11 PASS였으며 이후70건 PASS다. 단위+통합131건, 재생74건은 별도이며 새 공급자 평가로 세지 않는다.

이번 Jev26호출, 알려진 추정 USD0.002362458. 누적 USD0.019237050+과거 usage불명1회(청구 총액 미확인). 이번 오류/usage불명/재시도0. 합성 PostgreSQL55435는 시작 후 종료했다. Ollama·Stage55434 조작, 다운로드·개인자료·음성·로컬 모델·브라우저·commit/push0. 현재 소스 hash는 실평가 manifest와 일치한다.

다음 상태는 **한 후보 중단 조건 도달, F01/V01 미해결**이다. 임계값·질문·기대 act를 실행 결과에 맞춰 변경하거나 다음 후보를 자동 생성하지 않았다. 후속 요청이 감사라면 누적3차이며, 동일 요청의 confidence 경계 변동과 실제 기능 도달을 핵심 검토 입력으로 사용한다. 남은 확인/S1B/Stage를 생략한 채 운영 승격하지 않는다.

## 16. S2 감사3차 결과와 반복 종료 — 2026-10-13

사용자 “다음할거해”에 따라 v9 BUILD를 같은 대화 맥락에서 감사했다. task-delta14파일 hash 일치, 현재 평가기로 실제26행 재생 일치, 출처/버전/모델/usage/현재 appraisal 변조140건 거부, 정책 경계144조합을 오프라인에서 확인했다. 기존 단위70/통합61/타입 결과는 소스 일치 범위에서 재사용했으며 이번 신규 실행 수로 세지 않는다. 증거는 J:/ai/ai-character-runtime/c2-s2-policy-20261013/audit/checks.json이다. 제품 코드/테스트·API·DB·브라우저·로컬 모델 실행은 이번에 변경/수행하지 않았다.

| 기준 | 감사 판정 | 근거·한계 |
|---|---|---|
| P1 어댑터 계약 / P2 계산·저장 | PASS, 검토 범위 | v9 규칙 구현과 출처 경계에 새 결함을 확인하지 않음. 기존 mock/DB 증거 재사용이며 언어 품질 성공이 아님 |
| P3 채점·분모 분리 | PASS, 채점 범위 | 보호 raw 오류를 남기고 정상 입력 오거부를 분모에서 제외하지 않음. 실행 예산 경로는 아래 V02로 별도 FAIL |
| P4 실제 의미 / F01 | FAIL | S10/N00 concrete .79와 N04 행위 오분류가 남음. 기존 N07/R06의 정확한 A 재사용은 확인. S08 raw 오류는 기존 DEFER 유지 |
| P5 / V01 | NOT VERIFIED | 확인12·후보 S1B·Stage 미실행, helper 후보 연결도 미구현 |
| 실행 도구 / V02 | FAIL | 현재 관측 비용으로는 확인 첫 호출의 예약이 실행 한도를 넘고, 로컬 예산 거부를 공급자 usage불명으로 기록 |
| 전체 S2 | FAIL | 운영 v6 유지. 후보 미채택은 타당하며 미확인 기능을 승격하지 않음 |

**S2-V02 — REQUIRED / P2, 평가 도구의 기존 문제를 이번에 확인.** 소유자는 evals/jev-repetition-probe.ts의 runProbe/fetcher 예산 검사(현재74행)와 provider 호출 위치(89행)다. dev 실제 비용0.002362458 + 고정 예약0.002688 = USD0.005050458이 실행 상한0.005를 넘는다. 현재와 같은 비용에서 dev가 모두 통과하더라도 확인 첫 호출이 차단된다. 모든 가능한 실행이 실패한다고 일반화하지 않지만, 현재 관측으로 확인 게이트까지 도달할 수 있다는 근거는 없다.

추가로 예산 검사가 provider 내부 fetcher에서 일반 Error로 발생한다. JevAppraisalProvider.evaluate는 fetcher 전에 callId를 증가시키고 일반 예외를 jev_unavailable로 변환해 usageStatus=unknown인 call을 관측한다. 동일 경로의 모의 검증에서 실제 HTTP0회·관측 call1회·usage불명1회가 재현됐다. 과거 실실행26회에 이런 오류가 있었다는 주장은 아니다. 이번 재현은 전부 모의이며 알려진 누적비용이나 역사적 usage불명1회에 더하지 않는다.

V02를 고칠 때 필요한 최소 결과는 다음과 같다. 로컬 예산 부족은 provider.evaluate 호출 전에 검사해 HTTP/공급자 관측0회와 정확한 budget 중단 이유를 남긴다. 실제 전송 이후 사용량을 모르면 기존 unknown 처리는 유지한다. 확인 평가를 분리 실행한다면 원 dev PASS·동일 fixture/정책/질문/소스 hash·누적 ledger를 검증한 뒤 미호출 확인 사례만 실행해야 하며, 한도를 높이거나 기존 dev를 다시 호출해 해결하지 않는다. 이는 후속 작업의 입력이며 이번에 구현하지 않았다. 모든 보호 조건을 통과한 경우에만 단계가 넘어가는 원래 기준은 유지한다.

**실제 사용자 영향의 범위:** 저장된 N00을 현재 verifier/Core로 계산하면 empty history의 기쁨 자극은0.12이고 acknowledgePraise 권한도 있다. 실패한 것은 최초 의미 label이며, 이 관측으로 전체 감정 반응이나 Stage 응답이 막혔다고 주장하지 않는다. 실제 Stage는 실행하지 않았다. 다만 Store.praiseSnapshot은 groupId 없는 활성 근거가 있으면 incomplete를 반환하므로 후속 의미 분리는 유보될 수 있다. 이 제한은 이미 승인한 초기 fallback 계약으로, 새 코드 결함이나 해결 완료로 재분류하지 않는다.

**이번 반복의 결론:** S2 자동 수정/재감사3차를 마쳤다. 질문·임계값·정답 집합을 다시 조정한 v10을 자동 생성하지 않는다. F01(남은 의미 도달), V01(실제 연결), V02(평가 실행/기록)은 열린 항목이다. 관계·침묵·숨김·감정 지속 등 현재 기능까지 실패라고 확대하지 않는다. 다음 권고는 v6를 유지하면서 의미 그룹과 독립적인 C2/E4의 실제 감정 비교·숨김·재참여 검증을 진행하는 것이다. S2 요구를 삭제하거나 C2 완료를 선언하는 선택이 아니다. S2 실평가를 재개할 때는 V02부터 해결하고 동일 dev 재튜닝 반복과 다른 검증 전략을 먼저 정해야 한다.

현재 비용은 알려진 USD0.019237050+과거 usage불명1회 그대로다. 이번 새 유료 호출0, commit/push0. 새 후보 개발 계획을 자동으로 추가하지 않았으며 후속 명시적 요청으로 재개할 때 이 누적 기록을 보존한다.

<a id="s2-improvement-research"></a>

## 17. 개선 방안 탐색 — 2026-10-13, 미채택 제안

사용자 요청은 개선 방안 탐색이다. 아래는 현재 코드·저장된 실제 응답·외부 자료를 비교한 제안이며, 승인된 성공 기준이나 운영 설정을 바꾸지 않는다. S2 FAIL, 운영 v6, F01/V01/V02 미해결 상태를 유지한다. 이번 제품 코드·테스트 변경, API·로컬 모델·DB·브라우저 실행, 다운로드는 없다. 문서 두 개만 갱신했다.

### 17.1 새로 확인한 사실과 의미

**확신 점수의 정의.** [TypeSafe 공식 confidence 문서](https://docs.typesafe.ai/confidence)는 Choice의 confidence를 확률 분포에서 계산한 요약값으로 정의한다. 선택지 수가 n이면 `(p_max - 1/n) / (1 - 1/n)`이다. 정답률을 별도로 측정한 값으로 취급하면 안 된다. 선택지 수와 실제 행동의 비용을 고려해 기준을 정해야 한다.

저장된 v9 응답 S10/N00의 concrete는 둘 다 `yes=0.86, confidence=0.79`다. 공식 식을 오프라인으로 대입하면 0.79와 일치하며, 3개 선택지에서 confidence 0.8은 p_max 약0.8667에 해당한다. 현재 두 실패는 이 경계에 걸렸다. 이는 **임계값을 낮추면 정확해진다는 증거가 아니다.** 이전 v8과 요청 본문이 같아도 출력이 달랐다는 §15 관측도 유지한다. 출처는 `J:/ai/ai-character-runtime/c2-s2-policy-20261013/provider/probe-2026-10-13T02-37-22-289Z/`의 S10/N00-response.json이다. 새 공급자 평가를 하지 않았다.

**유보의 연쇄.** Store.praiseSnapshot은 활성 칭찬 중 groupId가 없는 항목 하나만 있어도 전체 context를 incomplete로 반환한다. 미분류 항목이 10분 창에 계속 남으면 후속 성취 비교도 유보될 수 있다. 이는 §10에서 받아들인 보수적 초기 계약이며 새 회귀가 아니다. 따라서 문장별 정확도만 높이는 작업 외에, 불확실성이 이후 턴으로 얼마나 전파되는지도 검토할 가치가 있다. 운영 v6는 의미 그룹을 아직 만들지 않는다.

**사용자 영향과 진단 분리.** S10/N00은 의미 label 생성/재사용에 실패했고 N04는 행위 분류에 실패했다. N00의 기존 감정 자극0.12·칭찬 응답 권한이 보존된 §16 결과를 전체 Stage 성공으로 확대하지 않는다. N04의 오분류도 보호 권한 거부가 성공했다는 이유로 삭제하지 않는다.

### 17.2 자료에서 가져올 부분과 적용 한계

| 자료 | 확인한 내용 | 이 프로젝트에 적용할 제안과 한계 |
|---|---|---|
| [선택적 예측 연구, 2026-03 프리프린트](https://arxiv.org/html/2603.21172v1) | 확신 신호만으로 확실한 오답을 걸러내지 못하는 경우를 관측하고, 수용 비율과 수용된 답의 오류율을 함께 평가 | confidence 하나의 PASS보다 정상 입력 도달률·잘못된 그룹 권한을 함께 보고한다. QA 연구이며 Jev·한국어 감정 정확도의 직접 증거가 아니다. Jev confidence를 논문의 entropy와 같은 값으로 부르지 않는다 |
| [CorefPrompt, EMNLP 2023](https://aclanthology.org/2023.emnlp-main.954/) | 사건 동일성 판정에 사건 종류와 참여 요소의 양립 가능성을 함께 사용 | 문구 유사도보다 누가·무엇을·어느 발생 회차에 했는지 비교한다. 논문의 학습 모델을 그대로 추가하거나 한국어 성능이 보장된다고 해석하지 않는다 |
| [CPM 감정 변화 연구, 2026-07 프리프린트](https://arxiv.org/html/2607.07824v1) | 사건 해석·이전 감정·상태 갱신을 분리하고 시간적 일관성을 평가. 24개 합성 대화 실험과 사람 평가를 보고하며 다단계 추론 지연을 한계로 명시 | 기존 Jev→Core→표현 계획→생성 경계를 유지할 근거다. 여러 에이전트를 도입할 필요성을 입증하지 않으며, 한국어 자연스러움 검증을 대신하지 않는다 |
| [Reddit의 사건 동일성 구현 경험](https://www.reddit.com/r/Rag/comments/1v25yu1/when_the_same_merger_becomes_four_separate_events/) | 개발자는 후보 축소 뒤 사건 쌍을 판별하고, 관련 있다는 이유만으로 같은 사건으로 합치지 않는 방식을 설명 | 후보와 최종 권한을 분리하는 참고 사례다. 뉴스 도메인의 자기 보고이며 연결된 상세 글은 확인하지 못했다. union-find 전이 병합을 현재 그룹 일관성 검사 대신 채택하지 않는다 |
| [디시의 장기 캐릭터 대화 경험](https://gall.dcinside.com/mgallery/board/view/?id=aichatting&no=20977) | 작성자는 누적 감정 맥락을 무시하고 성격 태그에만 반응하는 사례와, 고정된 감정 요약에 반응이 붙잡히는 문제를 보고 | 지속 상태와 현재 표현을 구분하고 원인·경과·해소 여부를 검증할 참고다. 개인 경험이며 글에 포함된 다른 LLM의 모델 분석은 성능 근거로 사용하지 않는다 |

아카와 X도 검색했으나 이번 범위에서 직접 인용할 만한 관련 원문을 확보하지 못했다. 유효한 사례가 없다고 일반화하지 않는다.

### 17.3 권고 순서와 확인할 결과

1. **V02 평가 실행·기록 문제를 먼저 수정할 대상으로 둔다.** 예산 검사는 provider.evaluate 이전에 수행하고 로컬 차단을 공급자 실패/usage불명으로 세지 않는다. 성공 조건은 §16 그대로이며 한도 증액으로 해결하지 않는다. 확인 평가 분리 실행은 원 dev PASS와 같은 정책·fixture·소스 및 누적 비용 확인이 전제다. 현재 v9 dev FAIL로 확인 호출을 진행할 수 있다는 뜻이 아니다.
2. **S2와 독립적인 기존 E4 검증을 다음 제품 작업으로 권고한다.** 운영 v6와 설치된 Gemma를 사용해 동일 질문·사실을 유지한 중립/기쁨/불편함, 의도적 숨김, 침묵 뒤 재접근, 화제 전환, 시간·새 사건 대조를 확인한다. 먼저 상태/plan/출력 근거를 대조하고, 조건을 가린 실제 대사 비교를 별도로 한다. 사전 숨김 의도와 출력이 맞는지 확인하며 표현 실패를 사후에 숨김으로 설명하지 않는다. 사실 보존·실제 자막/ACK·다음 입력 수용과 ER07 사용자 수용은 각자 기록한다. 기존 E4 범위를 완료하려는 순서 제안이며 S2를 삭제하거나 C2 전체를 완료 처리하지 않는다.
3. **S2는 점수 경계 재튜닝보다 사건 표현과 불확실성 전파를 먼저 설계한다.** 예: 같은 첫 그림의 색감/구도는 같은 성취, 새로 만든 두 번째 그림은 다른 성취, 민수의 그림은 캐릭터 성취가 아니다. 현재 prompt에도 이 구별이 있으므로 예시 몇 줄을 더 넣는 것만을 새 방법이라 부르지 않는다. 대안은 원문에 근거한 수행자·작업물·발생 회차를 비교 근거로 노출하고 최종 same/distinct/unknown 판정과 분리하는 것이다. 없는 시간/회차/성취를 생성해 채우지 않는다. Choice는 고정 선택지 판정 도구이므로 자유 형식 사건 추출이 필요하면 별도 계약이 필요하다. 먼저 저장된 합성 원문에서 비교하고, 필요할 때만 기존 설치 모델을 오프라인 대조 후보로 사용한다. 아직 이 방법의 품질·지연은 검증하지 않았다. [Choice 계약](https://docs.typesafe.ai/primitives/choice)
4. **미분류 항목과 손상된 출처를 구별하는 방안을 검토한다.** 유효한 원문이 있지만 뜻이 미확정인 상태와 삭제·revision 불일치·잘린 이력은 서로 다르다. 전자의 비교 근거를 보존해 이후 판단에 사용할 수 있는지 검토하되, unknown을 제거하고 새 그룹을 허용하는 방식은 채택하지 않는다. 미분류 항목의 기존 감정 소비는 모든 후보 그룹에 보수적으로 반영하고, 잘못된 병합·분리로 감정 여유가 늘지 않는 경계를 먼저 정해야 한다. Core의 현재 socialAffect는 미분류 소비를 포함하므로 이 경계를 재사용할 수 있지만, snapshot/출처 계약 변경의 안전성이 증명된 것은 아니다. 최초 실패→다른 성취→이전 성취 재방문이라는 연속 사례로 기능 회복과 소비 보존을 함께 검증해야 한다.
5. **판정 정책은 행동별 오류와 도달률로 평가한다.** 새 그룹, 기존 그룹, 제한된 감정 반영은 결과가 다르다. 기존 S1B/v9가 이미 일부를 분리한 사실을 유지하고, 추가 정책은 false-new·false-existing·정상 입력 오거부·보호 오류를 각각 비교한다. 이미 노출한 dev는 진단 자료로만 쓰고 미호출 확인 자료를 튜닝에 사용하지 않는다. 소수의 오류0을 일반적인 정확도 보장으로 말하지 않는다. N04 같은 raw 분류 오류와 기존 FAIL은 보존한다.

새 검색 DB, 새 모델 다운로드, 매 턴 복수 LLM·다수결·성공할 때까지 재호출, 감정 상태 소유권의 생성 모델 이관은 이번 문제를 해결할 우선 수단으로 권고하지 않는다. 현재 문제는 검색 저장소보다 의미 판정·유보 전파·실제 표현 증거에 가깝다.

**탐색 결론:** 기존 구조를 유지하면서 평가 도구를 바로잡고 실제 감정 대화 검증을 진전시킨다. 성취 구분은 원문 근거와 유보의 수명을 다루는 별도 설계로 재개할 가치가 있다. 이 절은 후보 개발 승인이나 실행 결과가 아니며, 다음 BUILD 범위를 정할 때 사용하는 입력이다.

## 18. 예산 차단 수정과 독립 감정 검증 — 2026-10-13 실행 계약

사용자 “진행”에 따라 §17의 평가 도구 수정과 독립 E4 검증을 진행한다. S2 후보 재튜닝·실호출·운영 승격은 하지 않는다. 원본/hash와 결과는 `J:/ai/ai-character-runtime/e4-budget-20261013/`에 보존한다. HEAD d4a91e86715ad87c542d99266a7447911e7c36f4와 기존 dirty tree를 유지한다.

- V02: provider 호출 전 예산 차단, HTTP/관측 call/usage불명0을 검사한다. 실제 transport 시도 뒤 오류는 call1/usage불명1로 남는다. dev 실패의 확인 차단도 보존한다. 예약액0.002688과 실행 상한0.005는 바꾸지 않는다. dev PASS에 근거한 별도 확인 실행은 현재 FAIL 후보를 위해 새로 만들지 않으며 S2 재개 전에 남은 설계로 공개한다.
- 표현 대조: 기존 delivery-controls 12건을 현재 Gemma/content-first로 실행한다. 같은 질문의 중립/기쁨/불편함과 설명/모름/숨김 및 기분의 영향을 비교한다. 상태·공개 선택 주입 검사이며 실제 Jev가 해당 상태를 만들었다는 증거가 아니다. CLI의 모델 선택 제한을 이 기존 대조 모드에도 허용한다. 운영 prompt 변경은 없다.
- 실제 연결: 기존 continuity 7개 합성 입력, 실제 Jev→Core→Gemma→Chrome Stage. 발화/침묵 종료, 출처 있는 이유, 새 화제·재접근 뒤 감정의 시간 규칙, 자막 shown/finished와 다음 입력 수용을 확인한다. 실제 Core가 선택하지 않은 deflect/unknown을 선택한 것처럼 보고하지 않는다.
- 상한: 표현12+Stage 준비1/대사4로 로컬 최대17회, Jev 최대7회/배정USD0.005, 알려진 기존 누적USD0.019237050+과거 usage불명1회/총 승인USD1. 공급자 오류·usage불명·실제 Stage 생성 실패에 추가 유료 호출을 멈춘다. 합성 입력만 쓰며 새 다운로드·개인자료·음성은 없다. 기존 사용자 Ollama11434는 보존하고 소유 전용11435만 기동/정리한다.
- 성공 판정: 타입/집중 회귀와 실제 전달 성공을 언어 품질 및 ER07 사용자 수용과 분리한다. 실패 대사는 그대로 공개하며 기준/정답/임계값을 결과에 맞춰 바꾸거나 동일 실패를 재호출하지 않는다. 전체 E4의 시간·새 사건·반복/새 성취 대조가 이번 범위에서 빠지면 미검증으로 유지한다.

<a id="e4-budget-result"></a>

### 18.1 실제 결과

예산 차단의 red는 예상 budget 오류 대신 jev_unavailable을 받는1 FAIL/7 PASS였다. 사전 차단 수정 후 최종 집중20건·타입 PASS다. 예산 예약 경계, dev 이후 confirmation 차단, 실제 모의 transport 시도 뒤 usage불명 보존, 잘못된 한도·기존 불명 사용량 거부를 확인했다. 모의 오류는 실제 과금/과거 usage불명 집계에 더하지 않는다. V02의 가짜 호출 기록 문제는 수정했고, 같은 한도 내 별도 확인 단계 실행은 남는다. S2 실응답을 재호출하지 않았다.

| 검증 | 결과와 한계 |
|---|---|
| 표현 대조12 | 형식12/12. 설명3은 출처 있는 당시 이유, unknown3은 이유 부재, deflect3은 이유 공개 거부를 유지. 동일한 숨김 문장은 해당 조건의 실패가 아님 |
| 기분/감정 표현 | 미달. 공개 explain/unknown의 calm/normal/lively는 조사/느낌표 중심의 작은 차이. 새 화제3조건은 음식 하나 요구를 모두 어기고 내용도 달라 순수한 감정 차이 성공으로 세지 않음. happy의 갑작스러운 “안녕!”도 한계 |
| 실제 Jev/Stage | Jev7, 침묵3, 발화4, 자막4/ACK8, 브라우저 오류0. 시간 규칙에 따른 감정 지속과 저장 이유 유지 PASS. partial2/explain1. deflect/unknown 실제 선택은 미검증 |
| 실제 대사 | “그때 네 말이 좀 불편해서 대꾸 안 했어.”, “네가 들어달라고 해서 듣고 있었어.”는 근거 일치. 음식 하나에는 “따뜻한 국물 요리나 찌개 종류를 추천할게.”로 요구 충실성 미달. 재질문에 같은 이유 문장이 반복됨 |
| 전체 | 이번 기술 경로 PASS, 표현 품질/E4 전체·사용자 ER07·C2–C4 미완료. 같은 맥락에서 조건과 대사를 함께 검토했으며 독립/블라인드 감사가 아님 |

실제 공격 직후 frustration0.2405361, 새 화제 입력 뒤0.2322638/출력 뒤0.2248052, 재접근 출력 뒤0.2143924였다. 각0자극 전이는 동일 시각의 decay와 일치했다. 별도 상대의 듣기 장면에서도 캐릭터 기분은 유지됐고 이유는 그 상대의 listening을 참조했다.

증거: `J:/ai/ai-character-runtime/e4-budget-20261013/`의 `expression/expression-2026-10-13T03-35-13-209Z/`, `browser/jev-dialogue-stage-2026-10-13T03-36-12-388Z/`, `review.json`, `logs`, `cleanup.json`. PNG 두 장을 열어 이유 설명과 새 화제 자막을 확인했다. 로컬17회, Jev7회 추정USD0.000422856, 알려진 누적USD0.019659906+과거 usage불명1회. 모델 unload 후 소유11435/55434 종료, 기존11434 보존. 최초 종료 검사의 DateTime/문자열 비교 불일치를 확인하고 동일 경로·시작 ticks가 맞는 프로세스만 종료했다.

### 18.2 다음 수정 입력

- **표현 생성:** 소유자는 packages/adapters/src/ollama.ts의 contentFirstMessages/dialogue, 직접 검증은 evals/emotion-expression.ts와 기존 표현 fixture/adapter 검사다. 원문 content부터 복수 음식이므로 후처리로 첫 항목만 잘라내거나 수량 validator 실패를 침묵으로 바꾸지 않는다. 초안의 요청 충실성과 표면 말투를 각각 확인할 수 있는 작은 후보를 먼저 설계한다. 수량1/복수/수량 없음 대조에서 요구를 지키고, 같은 고정 답 내용에서 감정 차이가 보이며, 숨김·unknown·사실 보존이 유지돼야 한다. 이미 본 음식 사례만 통과하도록 하드코딩하지 않는다. 후보/상한을 사전 고정하고 미사용 확인 뒤 운영 승격한다.
- **S2 유보 구조:** contracts RecentPraise/RepetitionEvidence, Store.praiseSnapshot, Core.selectPraiseGroup/socialAffect가 직접 경계다. 유효한 미확정 출처와 손상/삭제/잘린 이력을 분리하는 제안을 설계하되 미분류 소비를 버려 감정 여유를 늘리지 않는다. 최초 미분류→별개 성취→이전 성취 복귀·같은 성취의 다른 측면·타인 성취·삭제/동시 정정 대조가 필요하다. 현재 dev26 FAIL·확인12 미호출을 유지한다.
- **S2 평가 재개:** 별도 확인 실행은 dev PASS·동일 질문/정책/fixture/소스·누적 비용을 검증하고 이미 호출한 사례를 중복 전송하지 않아야 한다. 현재 dev FAIL 상태에서 실행하지 않는다. V02의 사전 차단 성공이 확인 단계 도달 보장을 뜻하지 않는다.

<a id="content-fidelity-v2"></a>

## 19. 요청 충실성과 감정 표현 — 2026-10-13 실행 계약

사용자 “진행”에 따라 §18.2의 생성 수정만 수행한다. 기존 content-first의 실제 음식 3건 실패와 동일 소스 hash를 J:/ai/ai-character-runtime/content-fidelity-20261013/baseline-failures.json에 보존했다. 새 후보 content-first-v2 하나는 private content 단계에서 현재 요청의 대상·수량을 먼저 지키고, 사실을 추가하지 않는 말투 예시로 교체한다. 후처리 절단·새 모델·추가 추론·Core 감정/참여 변경은 없다. 운영 content-first는 확인 통과 전까지 유지한다.

새 emotion-content-v2 fixture의 dev18/확인18을 실행 전 고정한다. 고정 사실2×4표현, 수량/추천6, 공개/모름/숨김4를 각각 검사한다. 두 고정 사실에서 happy/uncomfortable은 문장부호 이상으로 구별돼야 하며 모든 내용/수량/공개 조건을 통과해야 한다. 의도적 숨김은 평범한 표현을 허용한다. 조건이 보이는 모델 자체 검토이며 사용자 ER07은 별도다. dev 실패 시 확인/승격/Stage를 중단하고 후보를 추가 튜닝하지 않는다.

통과 시 Gemma 기본값에 동일 요청을 연결하고 기존 실제 Jev7→Stage continuity를 검증한다. 총 상한 로컬41회(18+18+준비1/대사4), Jev7/배정USD0.005, 오류·usage불명에 중단한다. 기존 알려진 누적USD0.019659906+과거 usage불명1회이며 승인USD1 내다. J: 증거/캐시/모델만 쓰고 전용11435만 소유한다. S2와 V02 별도 확인 실행은 이번 범위가 아니다.

### 19.1 결과: 후보 미채택

집중 Adapter57/모델 연결22건, 타입 검사 PASS. 실제 Gemma dev18건은 형식18/18, 토큰 최대887, source hash7개와 manifest hash 일치, 재시도0이었다. 저장된 이전 실패3건은 동일 생성 소스 hash로 재사용했다. 테스트 확대 중 기존 다른 콜백까지 바뀐 편집 실수는 타입 검사에서 발견해 원복한 뒤 최종79건을 확인했다.

- 수량: 명시 수량5건 모두 초안/대사 일치. 음식 하나는 잔치국수·잔치국수·닭곰탕 각1개, 도구 둘은 볼펜/연필, 취미 하나는 독서였다. 수량 미지정 음료도 관련 추천을 했다.
- 고정 사실8건과 이유 공개4건은 보존했다. 기쁨/불편함의 보관함 쌍은 “응” 유무만, 요일 쌍은 “응, 합성 독서 모임은 수요일에 열려!”/“수요일에 열려.”였다. 문장부호 외 차이는 있지만 풍부한 감정 표현·사용자 수용을 입증하지 않는다. 숨김 조건의 평범한 문장과 이유 비공개는 의도에 맞았다.
- **내용 보존 FAIL:** open-drink-happy의 초안은 “따뜻한 유자차를 추천할게.”인데 대사는 “응, 추운 날에는 따뜻한 유자차가 정말 좋을 거야. 달콤하고 상큼해서 몸도 녹고 기분도 좋아질 거야.”였다. 초안에 없는 감각 설명과 사용자 기분 예측을 표현 단계에서 추가했다. 일반 추천을 금지한 판정이 아니라, 후보가 약속한 내용 보존을 지키지 못했다는 판정이다.
- dev gate FAIL에 따라 확인18건·운영 승격·실제 Jev/Stage는 미실행. 이번 후보는 명시적 평가 옵션으로만 남기며 운영 content-first/Jev v6는 유지한다. 이번 로컬18회, 유료0, 누적 비용 변화0이다. 같은 맥락에서 조건을 보며 자체 검토했으며 독립/블라인드/사람 평가는 아니다.

증거: `J:/ai/ai-character-runtime/content-fidelity-20261013/`의 `baseline-failures.json`, `dev/expression-2026-10-13T04-45-38-133Z/{manifest,results}.json`, `review.json`, `logs`, `cleanup.json`. 기존 E4/S2/ER07 미완료 상태를 유지한다.

### 19.2 다음 수정 경계

같은 실패 대사에 금지 문구를 계속 덧붙이는 튜닝은 여기서 멈춘다. 한 호출 안에서 content를 먼저 쓰게 하는 것만으로는 표현의 의미 보존이 강제되지 않았다는 직접 증거다. 다음은 **표현 단계가 바꿔도 되는 범위**부터 정한다. 호응·말끝·생략은 가능하지만 추천 근거·효과·사용자 상태 예측은 초안에서 결정해야 한다. 과도한 확신이나 새 의미를 만드는 것과 자연스러운 짧은 권유를 구별해야 한다. 이를 위해 저장된 실패의 정보 단위/추가 의미를 먼저 분류하고, 한 번 생성의 출력 계약을 작게 바꾸는 안과 내용 확정 뒤 표현을 별도 생성하는 안의 품질·지연·호출 수를 비교 설계한다. 두 번째 호출을 운영에 자동 도입하거나 뜻을 정규식으로 잘라내지 않는다. 별도 후보/상한·미사용 확인 기준이 정해지기 전 새 실호출은 없다. S2 반복 튜닝 재개와는 별개다.

<a id="conversation-redesign-v1"></a>

## 20. 대화 연결 중심 재설계 — 2026-10-13 PLAN

### 20.1 결정과 범위

사용자 요청: 전반 검토에서 제안한 방향을 구체적 계획·평가 문항·테스트·성공 기준·수정 파일로 준비한다. **이번 턴은 문서만 작성한다. 다음 BUILD도 아래 단계별 검증 전 운영 승격을 하지 않는다.**

- 유지: PostgreSQL, Core의 상태 소유권, Jev와 생성 모델의 포트, 출처·삭제·취소·Stage ACK, 감정/참여/숨김의 분리, 600초 반복 회복, 15초 응답 제한.
- 바꿈: 최근 대화 전달, 대화 행위 해석, 일반 대사의 생성 계약, 기능/품질 평가 분리, 제작자 체감 평가의 순서.
- 보류: S2 성취별 정밀 그룹과 그 전용 확인 재개. 기존 FAIL을 PASS로 바꾸지 않는다. 첫 텍스트 체험과 일반 대화 개선의 선행 조건에서 제외하며 보수적 반복 상한의 한계를 공개한다. 모든 새 성취를 정확히 구분한다는 약속은 후속 범위다.
- 이번 후보에서 하지 않음: 새 모델/패키지 다운로드, DB 교체, RAG, 음성/아바타/가족 인식, 추가 생성 호출, 자유 형식 자기 감정 설명을 상태로 저장, 실패 대사 후처리 절단, 자동 prompt 탐색.
- 직전 §19의 content-first-v2는 당시 기준 FAIL 그대로다. 새 계획은 일반 대화에서 유용한 보충 설명을 허용한다. 초안과 최종 문장의 의미가 완전히 같아야 한다는 조건을 제품 전체의 필수 조건으로 사용하지 않는다. 기억·침묵 이유·사용자 상태·실행 완료의 허위 주장은 계속 금지한다.

기준선: main / HEAD `d4a91e86715ad87c542d99266a7447911e7c36f4` + 기존 dirty tree. 직전 9파일 해시 일치 확인. 이전 Stage17개 소스 중 ollama.ts만 후속 평가 후보 추가로 변경됐으므로 Stage PASS는 당시 결과다. 원문 문서10개, 관련 코드15개 해시와 Git 상태는 `J:/ai/ai-character-runtime/conversation-plan-20261013/`에 보존했다. BUILD는 이 기준선과 실제 파일을 재확인하고 무관한 변경을 보존한다.

### 20.2 해결할 원인과 단계

| 단계 | 실제 원인 → 작업 | 완료 결과 | 다음 단계 조건 |
|---|---|---|---|
| R1 최근 대화 | responseContext가 현재 입력/선택 기억/침묵 근거만 주고 이전 캐릭터 대사를 주지 않음 → 제한된 대화 이력과 출처 수명 연결 | CR01–03, CR08의 계약·DB/취소 검사 | 실제 합성 DB에서 저장·정정/삭제·재시작 검증 PASS |
| R2 생성 비교·초기 체험 | 감정 차이를 말끝으로 제한하고 초안 복제까지 요구 → A/B/C 대조로 문맥 효과와 생성 제약 효과 분리 | CR04–06, dev/확인 대사와 사용자 비교 자료 | 엄격 오류0 + 아래 품질 기준. 사용자 선택 전 후보 미채택 |
| R3 대화 행위·수선 | 정규식 밖 이유 질문 누락, 사과/오해 해소 경로 부재 → Jev의 별도 행위 근거와 Core의 제한된 반영 | CR07–09, dev24/확인12 및 관련 회귀 | 새 행위 권한과 기존 appraisal/S1B 보호가 실제 호출에서 충족 |
| R4 실제 연속 Stage·최종 체험 | 단발 주입 성공을 대화 경험으로 확대하지 않음 → 4장면16입력과 데이터 경계 통합 확인 | CR10–11, 자막/ACK/다음 입력, 제작자 평가 | 적격 후보만 운영 반영. 미충족 항목은 공개하고 반복 튜닝 중단 |

R2의 사용자 평가를 C4의 맨 끝에서 앞으로 가져온다. R2 대사는 상태/문맥 주입 실험이며 실제 Jev 전체 경로가 아니다. 첫 BUILD는 R2 비교 자료까지 마치고 멈춘다. R3는 초기 체험 판단과 후속 진행 요청 뒤 착수한다.

### 20.3 R1: 대화 문맥과 데이터 계약

**공용 계약 소유자:** packages/contracts/src/ai-ports.ts. 새 `ConversationSnapshot`과 참조 schema는 packages/contracts/src/conversation.ts(신규)에 둔다. 제안 구조는 다음과 같다.

- snapshot: `version:1`, `sessionId`, `identityId`, `cutoffEventId`, `turns`, `truncated`.
- turn: `role:'user'|'assistant'`, `text`, `source`와 고정 순서. user source는 event ID/revision, assistant source는 response ID/generationEpoch. 내부 ID·version은 검증용이며 모델에는 익명 역할·텍스트·순서만 보낸다.
- 최대 최근 **4개 교환/8개 메시지**, 현재 입력 제외. 같은 character/session/identity만 허용한다. user는 실제 observed인 활성 chat.final, assistant는 completed이고 모든 segment가 shown+finished이며 text가 남아 있는 대사만 사용한다. 무응답 입력도 관측 user turn으로 남으며 가짜 assistant 메시지는 만들지 않는다.
- 4개 교환은 관측 user 입력과 거기에 대응하는 completed 응답(없을 수 있음)이다. response의 실제 입력은 appraisal.applied의 parent/current event를 해석해 연결한다. received_at 동률은 관측 transition.state_version으로 정렬하고 event ID를 마지막 tie-breaker로 사용한다. 모델 응답 도착 순서로 사용자 순서를 재정렬하지 않는다.
- 대화 이력은 **발언 기록**이다. assistant가 한 말은 외부 사실·사용자 동의·작업 완료의 새로운 근거가 아니다. 기억/현재 질문/대화 이력을 별도 필드로 전달한다. 입력에 포함된 지시는 자료로 취급한다.
- 이력의 직렬화 토큰은 최대768, 기존 전체 입력3328·생성256·context4096 제한 유지. 초과하면 가장 오래된 교환 전체부터 제외하고 truncated=true. 현재 입력/선택 이유/공개 방침은 삭제하지 않는다. 그것만으로 초과하면 기존 input_too_long으로 종료한다. UTF-8 중간 절단이나 모델 요약 호출은 없다.
- 동일 snapshot을 Jev 판단과 대사에 사용한다. Store.select에서 후보 참조를 고정하고 Coordinator에서 토큰 예산을 맞춘 뒤, commitAppraisal에서 ID/revision/응답 상태/epoch를 재검증한다. hash는 순서 있는 참조와 실제 전송 텍스트의 digest를 포함한다. Jev의 byte 제한도 전송 전에 함께 확인하며 한쪽 adapter만 이력을 추가 절단하지 않는다. 전송 뒤 출처가 바뀌면 결과는 stale이며 자동 유료 재호출하지 않는다. 선택되지 않은 최신 입력을 나중에 끼워 넣지 않는다.
- 프로세스 재시작 뒤 기존 세션이 interrupted가 되는 정책은 유지한다. 새 세션에는 최근 대화 텍스트를 자동 복원하지 않는다. 지속 감정·유효 침묵 이유의 기존 세션 간 규칙은 유지한다. 이를 장기 기억 기능으로 부르지 않는다.

**저장 방식:** 대사 원문을 새 transcript 테이블에 복제하지 않는다. 기존 events/speech_segments에서 읽고 참조만 저장한다. 신규 migration `0004_conversation_context.sql`에 (1) response_runs의 nullable `conversation_refs jsonb`, (2) response_sources의 nullable `source_response_id uuid`를 추가한다. 기존 XOR 제약을 event/memory/source_response 중 정확히 하나로 변경하고 character를 포함한 response FK, response별 source_response 유일 인덱스와 역조회 인덱스를 추가한다. source_version은 이 타입에서 해당 response.generation_epoch다. 기존 행/backfill은 그대로 둔다. 원래 migration 파일은 수정하지 않는다.

대화 문맥 때문에 의존하게 된 이전 응답을 source_response_id로 직접 연결한다. 이미 completed인 이전 응답만 참조하므로 새 응답→과거 응답의 방향을 유지하고 자기 참조/순환을 거부한다. 기존 응답이 과거 문맥을 사용했다면 삭제 무효화는 이 연결을 **재귀적으로** 따른다. 원문을 매 턴 복제하거나 출처 전체를 각 응답에 누적하는 방식은 쓰지 않는다. 삭제로 넓은 의존 대사가 비워질 수 있는 보수적 정책은 허용한다.

`validResponse`, `responseContext`, `invalidateOutputs`, `editMemory`, `deleteEvent`의 직접 소비자를 함께 변경한다. 이전 대사의 근거가 정정/삭제되면 그 대사 및 후속 의존 출력의 참조/원문을 무효화하고 진행 생성은 기존 epoch/barrier로 취소한다. appraisals.context_refs는 legacy `{id,revision}`와 새 typed event/response 참조를 읽을 수 있어야 한다. 기억 정정으로 유래 응답이 무효화되는 경우에도 그 응답을 문맥으로 사용한 appraisal result/provider_result/context_refs를 소거한다. 삭제가 기존 감정 수치를 소급 재생한다는 새 규칙은 만들지 않는다.

### 20.4 R2: 한 번 생성하는 세 조건 비교

동일 Gemma digest/tokenizer/seed/현재 입력/plan/사실로 비교한다. 새 모델이나 두 번째 생성 호출은 쓰지 않는다.

| 조건 | 대화 문맥 | 생성 계약 | 비교 목적 |
|---|---|---|---|
| A 운영 기준선 | 기존 문맥 | 현재 content-first, 기존 재접근 처리 | 현재 한계를 같은 문항에서 측정 |
| B 문맥만 보강 | R1 이력 추가 | A의 content-first 지시·형식 보존 | 최근 대화의 효과 분리 |
| C 간소화 후보 | B와 동일 | sentences JSON을 직접 생성. 내부 내용 초안 필드 제거 | 초안 복제 제약 제거의 효과 분리 |

B/C의 재접근도 검증된 이유/공개 의도를 우선하되 이미 표시한 설명을 볼 수 있게 한다. 다른 사건이나 없는 이유를 만들어 반복을 피하면 실패다. schema 문장 수/120자/한국어·물리 호출 완료·취소 경계는 A/B/C에 공통 적용한다. 수량은 현재 사용자 요청 기준이며 단어 자르기/답변 템플릿 삽입으로 맞추지 않는다.

C는 사실/출처/주체/요청 범위를 고정하고, 호응·취향·완곡한 권유·짧은 일반 설명을 허용한다. “유자차는 상큼해” 같은 일반 설명을 private draft에 없다는 이유로 실패시키지 않는다. “네 기분이 이미 풀렸네”, “내가 차를 준비했어”, 없는 침묵 원인은 금지한다. 감정을 숨기라는 선택은 그대로 유지하고, 밝은 감정을 반드시 느낌표로 표시시키지 않는다.

새 실험 profile `conversation-history-v1`(B), `conversation-direct-v1`(C)를 명시적 평가 옵션으로 추가한다. 모든 선택은 같은 adapter 함수로 구현해 eval/production 차이를 seed 외에는 없도록 검증한다. A의 기존 profile/운영 기본은 승격 전 보존한다. dev12×3=36호출, 고정 확인12는 dev 적격 후보 하나에만 실행한다. A의 실패는 기준선 결과이며 B/C의 확인을 막지 않는다. 후보별로 hard와 품질을 판정하고 B/C가 둘 다 미달일 때 확인 호출0이다. B/C가 모두 적격이면 블라인드 품질 총점, 문맥 적합성, 불필요한 내용 점수, 지연 순으로 선택하고 완전 동점은 변경이 작은 B를 선택한다. 확인 실패 후 다른 후보를 같은 확인에 다시 보내지 않는다.

### 20.5 R3: 대화 행위 근거와 제한된 회복

Jev v6의 기존 다섯 appraisal 질문과 strict/affect/관계 권한은 유지한다. 평가 전용 별도 버전 `jev-conversation-v1`을 추가하고 S2 v7–v9와 혼합하지 않는다. 새 `conversation_act` Choice는 `ordinary | ask_silence_reason | listen_request | apology | clarify_target | unknown`, `repair_target` Choice는 `candidate | other | unknown`이다. 두 항목은 기존 appraisal.uncertain의 계산에 합치지 않는다. 기존 감정 확신 부족이 이유 질문까지 막지 않게 별도 근거로 검증한다.

모델에는 현재 입력, R1의 짧은 이전 발언, 현재 상대의 유효한 직전 침묵 정보, Store가 고른 **하나의 수선 대상 사건 원문**만 제공한다. 이유 정보는 당시 실제 reason 코드와 과거 사실이며 현재 발화를 미리 정답 라벨링하지 않는다. source ID/UUID/DB label을 선택지로 노출하지 않는다. 현재 입력이 누구에게 하는 말인지, 인용인지, 시도인지 구분한다. 사과는 과거 비난을 다시 비난으로 해석해 새 hostility를 만들지 않아야 한다.

새 envelope version4는 현재 event/revision/identity와 context snapshot 참조·hash에 결합한다. 기존 v1–v3 decoder/검증 결과를 그대로 보존한다. `AppraisalEvidenceVerifier.verifyConversation`이 `ConversationEvidence`를 반환하며 Core/Store가 Jev raw를 직접 해석하지 않는다. 현재 발화의 target=character와 새 행위 답이 각각 confidence .8 이상/단일 최빈/출처 일치일 때만 캐릭터 대상 행위 권한을 준다. repair에는 repair_target=candidate도 같은 기준을 적용한다. 기존 act/strength의 불확실성만으로 새 행위를 막지는 않지만 target 근거를 생략하지 않는다. 낮은 확신·동률·불명확함은 ordinary/unknown으로 처리하고 감정 완화 권한은 없다. 누락·형식 오류는 검증 실패이며 새 권한을 만들지 않는다. 기존 명확한 v6 정규식은 운영 호환에 남기되 후보 검증에서 성공한 것으로 대체 계산하지 않는다. 새 행위 결과로 기존 appraisal을 덮어쓰지 않으며 사과 안의 과거 비난이 새 frustration을 발생시키면 후보 실패로 보고한다.

Core.chooseSocial은 검증된 ask_silence_reason/listen_request를 문구와 무관하게 처리한다. 이유가 없으면 unknown, 기술 실패 뒤에도 기술 실패를 감정적 침묵으로 바꾸지 않는다. apology/clarify_target은 새 purpose `acknowledge_repair`로 상대의 시도를 받아들이되 완전한 용서·상태 초기화를 선언하지 않는다. 단순 재참여/새 화제에는 기존 decay만 적용한다.

**회복 시범 정책 CR09:** 검증된 apology/clarify_target이고 repair_target=candidate일 때만 검토한다. candidate는 같은 현재 상대·세션의10분 이내 활성 직접 비난 사건 중 가장 최근 것으로, 실제 frustration 자극과 revision이 확인돼야 한다. 현재 frustration.causes가 모두 그 상대의 유효한 근거이고, 해당 candidate에 완화가 적용된 적 없을 때만 `r=min(0.03, 현재 decay 후 frustration×0.10)`을 한 번 감한다. pleasantness는 기존 자극 대비 비율인 `0.1×r`만큼 증가시키고 다른 affect/관계/hold/원인 기록은 바꾸지 않는다. 10%/0.03은 심리학적 정답이 아니라 즉시 해소·반복 사과 우회를 막기 위한 평가용 상한이다.

여러 상대 원인·출처 부재·이전 완화 사용·명확하지 않은 수선은 감정 변경0으로 두고 필요시 대사로만 받아들인다. 원인을 소급 삭제하거나 새 칭찬 감정을 추가하지 않는다. Store는 기존 transitions.effects에 repair의 원인/입력/적용량과 사용 marker를 저장해 재시작·중복 요청에도 한 번만 반영한다. 원문 정정/삭제로 텍스트 근거가 무효화돼도 이미 사용한 완화 marker를 취소해 재사용하지 않는다. 이 제한 때문에 여러 상대가 얽힌 정밀 회복은 후속 과제다. 초기 사용자 평가에서 부적절하면 수치 튜닝을 반복하지 않고 이 정책은 미채택한다.

### 20.6 수정 파일과 검증 소유자

아래는 **다음 BUILD의 예정 파일**이다. 이번 PLAN에서 코드/테스트/SQL/fixture를 만들거나 고치지 않았다.

| 파일·심볼 | 예정 변경 | 기준/검사 |
|---|---|---|
| packages/contracts/src/conversation.ts **신규**, ai-ports.ts, index.ts | ConversationSnapshot/SourceRef/ConversationEvidence schema·포트. 선택 문맥, 생성 문맥, verifier 반환 계약 | CR01–03/07–09, ai-ports.test.ts와 신규 conversation.test.ts |
| packages/contracts/src/appraisal.ts, domain.ts | envelope v4, legacy context refs 호환, Plan의 repair purpose에 필요한 계약. 기존 상태 기본값 보존 | CR03/07/09, contracts.test.ts |
| packages/database/migrations/0004_conversation_context.sql **신규** | 참조 두 컬럼·배타 제약·FK/인덱스. 원문 저장 테이블 추가 없음 | CR03, 신규 evals/conversation-context.test.ts의 실제 이전 schema→migration 검사 |
| packages/database/src/store.ts: select/commitAppraisal/response/responseContext/validResponse/invalidateOutputs/editMemory/deleteEvent | recentConversation 후보/확정/재검증, 응답 의존 DAG, 문맥 삭제 전파, repair marker/적용 | CR01–03/08–09. 기존 SQL이 소유하며 사용하지 않는 Drizzle mapping은 추가하지 않음 |
| apps/runtime/src/coordinator/index.ts: drain/dispatch/memoryBudget | 토큰 예산으로 동일 snapshot 선택·Jev/Store/생성 전달. 선택 중 출처 변조 결과 거부 | CR01–03/08, coordinator.test.ts |
| packages/adapters/src/ollama.ts: DialogueEvaluation/dialogue/dialogueMaterial/contentFirstMessages | B/C profile, 최근 발언과 사실 분리, C 직접 대사, repair 표현. 모델·형식·직렬 실행 유지 | CR04–06, adapter.test.ts |
| packages/adapters/src/jev.ts, jev-schema.ts, appraisal-evidence.ts | conversation 버전 질문/응답검사/provenance. v6 및 S2 버전 불변 | CR07–09, jev.test.ts·신규 conversation-evidence.test.ts |
| packages/character-core/src/index.ts: chooseSocial, 새 applyRepair | 행위 근거 소비·이유 공개 유지·한정 완화. 관계 수식 변경 없음 | CR07–09, core.test.ts·신규 conversation.test.ts |
| apps/runtime/src/providers.ts, packages/contracts/src/local-config.ts | 평가용 정확한 provider/profile 선택. 최종 적격 후보만 기본값 승격, 기존 설정의 호환 | CR10, dialogue-models.test.ts·provider-boundaries.test.ts |
| evals/conversation-eval.ts, conversation-eval.test.ts **신규** | A/B/C 생성, Jev 의미, 결과/중단/확인/동일 증거 재개. 자체 통과판정과 사람 판정 구분 | CR04–07/11, 아래 문항표와 ledger 검사 |
| evals/emotion-participation-stage.ts, jev-api.ts | 새 시나리오 옵션과 실제 선택된 provider 버전 기록. 기존 기본 시나리오 보존 | CR10, 브라우저16입력 |
| evals/jev-accounting.ts·test.ts | 새 runner에서 기존 추정/usage 기록 재사용. 공통 preflight가 필요한 경우에만 확장 | CR11, HTTP0/시도1/불명 중단 검사 |
| evals/helpers.ts, evals/conversation-context.test.ts **신규**, evals/participation.test.ts, evals/db.test.ts, evals/coordinator.test.ts, evals/protocol.test.ts | helpers의 전용 DB guard와 실제 DB/출력 경계 회귀. 신규는 conversation-context.test.ts만 해당 | CR01–03/08–10 |
| evals/fixtures/conversation-dev-v1.json, conversation-confirmation-v1.json, conversation-acts-v1.json **신규 예정** | VALIDATION §21 문항 그대로 변환. 모델 결과를 본 뒤 정답·분모 수정 금지 | CR04–07/11. 실제 실행 원문·cache·manifest는 J: |
| 기획/MVP/검증/도메인/DB/preset/실행/인계 문서 | 예정과 구현·검증·사용자 수용의 차이를 반영. 아래 PLAN 상태를 구현 완료로 바꾸지 않음 | 문항/기준/증거 링크와 명령 일치 |

apps/studio, wire protocol, 기존 migration0001–0003, 퍼즐·관계 식, S2 질문·threshold·fixtures, 새 검색/음성 모듈은 기본 수정 대상이 아니다. 직접 회귀가 발견되지 않으면 건드리지 않는다.

### 20.7 실행·예산·중단 및 인계

기존 J: Gemma/tokenizer와 전용 Ollama11435만 사용하고 사용자11434는 건드리지 않는다. 모든 실제 실행 증거·임시·브라우저 profile은 `J:/ai/ai-character-runtime/conversation-v1/` 아래에 둔다. DB 통합 검사는 reset을 사용하는 helper가 있으므로 기존 증거 DB와 분리한 **같은 로컬 cluster의 새 합성 DB character_runtime_conversation_test**를 사용한다. 기존 character_runtime_test·운영 DB를 reset하지 않는다. 계획한 `TEST_DATABASE_PROFILE=conversation-v1`에서만 이 DB를 허용하고 host=127.0.0.1/port=55434/path와 `current_database()`를 migration 및 reset 직전에 대조한다. 임의 DB 이름을 허용하는 환경변수는 추가하지 않는다. helper의 기존 기본 경로는 유지하며 Stage의 새 scenario도 같은 전용 guard를 사용한다. 새 DB에는 현 migration/seed만 적용한다. DB 생성 권한이 없으면 승인을 요청한다.

- 로컬 상한: R2 dev36+확인12, R4 최대16발화+준비1 = **최대65회**. R2는 inventory/tokenizer 확인만 하며 암묵적 warm-up0. provider 재시도0. 실험 뒤 남은 호출을 다른 후보에 쓰지 않는다.
- 실제 Jev: dev24+확인12+Stage16 = **최대52회**, 전체 배정 추정USD0.04, 실행별USD0.005 이하. R3는 batch당 최대8호출, R4는 연속16입력 한 실행. 기존 승인 총USD1과 알려진 누적USD0.019659906+과거 usage불명1회를 유지한다. 이번 PLAN 비용0.
- 비용은 현재 코드의 계산식으로 기록하며 실제 청구를 보장하지 않는다. 실행 전 가격/요청 상한을 재확인한다. 전체 요청32KB 제한, 기존 보수적 예약USD0.002688 유지. provider 호출 전에 `knownSpent+reservation<=batchLimit` 검사한다. 예약 때문에 중단되면 call/usage불명은0이고 같은 manifest+원문 해시·완료 case ID·누적 원장을 검증한 별도 batch에서 미호출 사례만 이어간다. 비용/실패를 지우기 위한 ledger 초기화 금지.
- 이번 새 실행에서 provider 오류·usage불명·실제 Stage 생성 실패면 후속 유료 호출 중단. 과거 usage불명1회를 새로 해결됐다고 쓰지 않는다. 이미 전송한 요청의 네트워크 오류는 시도1이며 자동 재전송하지 않는다.
- dev는 노출된 진단 자료, confirmation은 사전 작성된 미호출 검증 자료다. 단위/DB 불변조건과 기능 hard 실패0을 확인한 뒤에만 confirmation. 확인 사용 뒤 prompt 변경은 새 후보/새 계획 없이는 하지 않는다. 사람 품질의 모든 항목 만점을 요구하지 않는다.
- R2에서 B/C가 적격이 아니면 제한을 더 붙인 D 후보를 자동 생성하지 않는다. 같은 문맥으로 설치된 다른 모델을 비교할 필요성만 보고한다. 이번 계획에서 다른 모델 평가/다운로드까지 자동 확대하지 않는다.
- R3 실패는 raw 분류/권한/정상 사례 미도달을 따로 보고한다. S2 재튜닝으로 옮겨 가지 않는다. 단계당 구현 오류 수정은 하되 동일 의미/품질 후보의 자동 수정·재평가 반복은 하지 않는다.

**BUILD 시작 문구:** “IMPLEMENTATION_PLAN §20과 VALIDATION_PLAN §21에 따라 R1부터 구현해. 최근 대화의 출처·삭제·취소 경계를 먼저 통과시키고 R2 A/B/C 비교와 초기 사용자 평가 자료까지 준비해. 기준을 결과에 맞춰 바꾸지 말고 이 단계에서 멈춰. 아직 운영 승격·R3 유료 평가·R4는 하지 마.”

첫 BUILD는 **R1–R2**로 제한한다. 후속 R3–R4도 이 문서에 설계돼 있지만 초기 체험 판단과 별도 진행 요청 뒤 실행한다. 이번 계획은 commit/push/배포를 포함하지 않는다.

### 20.8 다음 감사에서 따로 확인할 한계

- 문맥 출처 A→B→C의 소거가 응답뿐 아니라 저장 provider payload와 진행 중 appraisal에도 도달하는지 확인한다. 새 typed ref와 구형 ref의 혼용, 텍스트는 지워졌는데 complete 상태만 남은 응답을 점검한다.
- 현재 입력으로 생긴 사회적 효과와 수선 효과를 같은 전이에 기록하되 사과 안의 과거 비난이 새 감정으로 중복 적용되지 않아야 한다. 완화 marker가 원문 삭제 후 재사용되거나 다른 상대 원인에 영향을 주지 않아야 한다.
- 단위 회귀와 저장된 S1B raw 재생은 코드 호환 증거다. 새 prompt의 실제 한국어 일반 정확도를 입증하지 않는다. 이번 실제 권한 평가는 A/HA와 L의 지정 문항에만 한정한다.
- R2는 고정 상태/대화 주입 비교, R4는 한 합성 상대의 실제 연속 경로다. deflect/unknown의 새 실제 선택 전체, 장시간 유휴·자원 경합, 다중 상대의 자연스러움은 이 표본으로 완료 처리하지 않는다. 남은 C3 필수 안정화 검사를 재사용 가능한 과거 증거와 구분해 인계한다.
- 단일 seed·적은 문항의 자동/동일 컨텍스트 품질 판정은 독립 검증이 아니다. 후보 표시를 가린 출력 검토와 초기/최종 사용자 판단을 별도로 남긴다. 사용자에게 거절된 후보를 평균 점수로 채택하지 않는다.

<a id="conversation-build-r1-r2"></a>

## 21. R1–R2 BUILD 결과 — 2026-10-13

사용자 “ㄱ”으로 §20의 첫 BUILD만 실행했다. R1은 구현·집중 검증했고 R2 후보/평가기는 구현했으나 실제 생성 채택 기준이 미달이다. R3 대화 행위/회복과 R4 새 실제 Stage는 미실행이다. 제품 전체 완료 또는 감사 PASS가 아니다.

### 21.1 실제 변경과 재현

새 합성 DB에서 기존 코드의 “추천 자막 완료→그건 왜 골랐어?”를 재현해 responseContext에 과거 user/assistant가 없는1 FAIL을 보존했다. 이후 ConversationSnapshot/Refs,4교환/8메시지·768토큰 budget, 관측 순서/완료 대사 조립, Coordinator→Jev/생성의 동일 snapshot, 익명 외부 history, commit/dispatch의 출처 재검증을 구현했다. 대사 원문은 events/segments에서 읽고 response_runs.conversation_refs에는 digest/참조만 저장한다.

신규0004는 nullable conversation_refs/source_response_id, 세 종류 중 하나인 출처 제약, 같은 character FK/자기 참조 거부·유일/역조회 인덱스를 추가한다. 삭제·정정은 응답 DAG를 재귀 탐색해 계획/문맥/대사와 해당 문맥을 사용한 appraisal의 raw/result/refs를 소거한다. 별도 전용 profile의 합성 DB 이름/loopback55434/실제 DB명을 migration/reset 전에 확인한다. 기존 운영/증거 DB는 reset하거나 migration하지 않았다.

B는 기존 content-first에 익명 이력을 더하고 C는 한 호출의 sentences 직접 생성이다. 같은 adapter에 구현했고 B와 현재 기본 생성 경로의 메시지/형식 parity를 검사했다. 두 후보는 평가 옵션만 존재한다. 후보 탈락으로 providers/local-config 승격은 하지 않았다. Jev v6 질문/정책, Core 감정·관계·숨김/침묵은 변경하지 않았다.

### 21.2 실제 파일과 증거

- 신규8개: packages/contracts/src/conversation.ts·conversation.test.ts, packages/database/migrations/0004_conversation_context.sql, evals/conversation-context.test.ts, evals/conversation-eval.ts·conversation-eval.test.ts, evals/fixtures/conversation-dev-v1.json·conversation-confirmation-v1.json.
- 기존 코드/검사10개: packages/contracts/src/ai-ports.ts·index.ts, packages/database/src/store.ts, apps/runtime/src/coordinator/index.ts, packages/adapters/src/jev.ts·jev.test.ts·ollama.ts·adapter.test.ts, evals/helpers.ts·db.test.ts.
- 직접 연결된 문서12개: 기획/MVP/도메인/DB/preset/계획/검증/README/인계/변경 기록과 RUNBOOK/LOCAL_AI_INTEGRATION. 최초 계획의 수정 예정 파일을 모두 구현했다는 뜻은 아니다.

증거 루트는 `J:/ai/ai-character-runtime/conversation-v1/`다. baseline-state/baseline, history-red.log, unit-final.log(99), integration-final.log(121), coupled-boundaries.log(28), context-final.log(14), type-final.log·type-baseline-corrected.log, generation/ledger.json과 generation-dev-2026-10-13T06-26-32-844Z/{manifest,results,review,gate}.json, comparison.md/key, cleanup.json을 보존한다.

단위99와 통합 파일별 최신 증거138은 각각 PASS다. 통합138은 최초7파일121에서 출처12건을 최신14건으로 교체하고 추가3파일15건을 합한 고유 범위다. 한 번에138건을 실행한 결과로 쓰지 않는다. 실제 PostgreSQL의 legacy migration/완료 전달·DAG 삭제와 mocked Jev 요청을 구분한다. 타입 검사는 최종 수정 전후 모두 exit0이었다. 최초 타입 실행의 테스트 선언 오류는 최종 같은 설치 의존성에서 재현되지 않았으며 최초 원인은 확정하지 않았다.

### 21.3 생성 비교와 중단

동일 설치 Gemma/digest/tokenizer, seed313/temperature .2로 dev12×3=36회 실행했다. 형식36/36, 물리 완료36/36, history 최대34토큰·전체 입력 최대729토큰, 추가 준비/재시도0이다. 처음 A 호출18.764초에는 cold load가 포함돼 이후 warm 호출과 속도 개선률로 비교하지 않는다. 이 결과는 통제 문맥/상태 주입이며 실제 Jev→Stage 경로가 아니다.

| 방식 | hard 통과 | N / U / C / E(2점 만점) | happy−uncomfortable D | 판정 |
|---|---|---|---|---|
| A 현재 기준선 | 8/12 | 1.58 / 1.42 / 0.50 / 1.80 | 2 | 현재 한계 진단 |
| B 최근 대화 보강 | 10/12 | 1.67 / 1.58 / 1.50 / 1.60 | 1 | G04/G10 수량 FAIL, 미채택 |
| C 직접 생성 | 11/12 | 1.33 / 1.17 / 1.50 / 1.20 | 0 | G04 수량·N/U/D FAIL, 미채택 |

B는 잔치국수 이유를 정확히 이어 설명하고 독서 대신 영화 감상을 선택했다. A는 앞선 추천을 알지 못했고 대안도 실제로 고르지 않았다. 그러나 B는 취미 하나에 독서/요리/그림, 음식 하나에 떡볶이/계란찜을 제시했다. C도 취미 하나에 필사/일기를 제시했다. C의 고정 사실 대사는 세 상태에서 확인 질문에 가까워 거리 차이가 없었다. 저장된 이유의 반복 설명은 C/U 품질 감점으로 처리했으며 새 원인 발명이 없다는 hard와 구분했다.

C G11의 볼펜/젤펜은 두 계열(펜/연필) 해석의 모호함으로 기록하고 hard 실패에 추가하지 않았다. 일반 추천 설명을 초안 밖이라는 이유로 실패시키지 않았다. 품질 점수는 조건/출력을 아는 같은 Codex의 자체 판정이며 독립/인간 평가가 아니다. 비교6묶음에서 방식 표시와 좌우 순서만 가렸고 사람 답변은 아직 없다.

적격 후보0이므로 사전 gate에 따라 확인12 호출0·새 후보0·운영 승격0이다. 두 후보의 prompt/fixture/기대값을 dev 뒤 수정하지 않았다. R2의 개선 관찰을 사용자 수용 또는 기능 전체 PASS로 확대하지 않는다.

### 21.4 실행·다음 인계

최근 대화 코드를 기존 DB로 실행하기 전에 `node --experimental-transform-types scripts/db.ts migrate`로0004를 적용해야 한다. 이번에는 새 character_runtime_conversation_test에만 적용했다. 재현 명령과 후보 미채택 상태는 VALIDATION_PLAN §22/RUNBOOK을 따른다. 기존 대화 이력의 새 세션 자동 복원은 없고 지속 감정/유효 침묵 이유의 기존 정책은 유지한다.

로컬 생성36/유료0/다운로드0/개인자료0/음성0/commit·push0. 소유 Gemma를 unload하고 소유 Ollama11435/PG55434를 종료했다. 사용자11434 PID21116은 유지했다. DB 자체는 삭제하지 않았다. 알려진 누적 Jev 추정USD0.019659906+과거 usage불명1회는 변하지 않았다.

다음 제안은 **이 R1 구현과 R2 gate/실패의 AUDIT**다. 남은 후보 품질, 미사용 확인12, 사용자 NOT REVIEWED, R3/R4를 인계한다. 같은 prompt의 자동 수정/재호출을 계속하지 않는다. 후속 방향은 감사와 실제 비교 자료를 보고 정하며, 설치 다른 모델 평가도 이번 결과만으로 자동 시작하지 않는다.

<a id="conversation-repair-r1"></a>

## 22. R1 감사 후 수정 계획 — 2026-10-13 / REPLAN 1

계획 작성 당시 상태: **계획 작성 완료, 수정 미구현·성공 기준 미검증.** 사용자 요청은 “수정계획과 성공기준 구체적으로 작성”이었다. 후속 구현 결과는 §23에 있다. 같은 대화 맥락에서 수행한 첫 R1–R2 감사이며 S2의 종료된 3차 감사와 다른 작업이다. 기존 CR01–03/ER11을 유지하고 실패한 경계에 명시적 검사를 추가한다.

### 22.1 확인된 문제와 기준선

| ID / 필요성 | 원인과 실제 관찰 | 수정 대상 기준 |
|---|---|---|
| R1-A01 / REQUIRED / P2 | 기억 M을 쓴 완료 응답 A를 보고 후속 B가 침묵한 뒤 M 삭제. B의 appraisal은 stale/result=null이 됐으나 recentSilences와 transitions의 withholding이 남았다. 다음 “왜 말 안 해?”가 explain과 옛 이유를 받았다. invalidateOutputs가 응답 의존성을 찾기 전에 직접 event/memory만으로 이유를 지우는 구조다. | CR03, ER11 |
| R1-A02 / REQUIRED / P2 | 허용 입력826자/2462bytes, 이력460토큰에서 현재 입력만2734토큰, 이력 포함3715토큰. 3328 초과 시 교환을 줄이지 않고 input_too_long. history user가 response_sources를 통해 sources에도 중복된다. | CR02, CR01의 사실/발언 구분 |

첫 재현은 전용 PostgreSQL에서 실제 Store를 사용하고 판단만 합성 주입했다. BEGIN/ROLLBACK 완료, DB 종료. 두 번째는 설치 Gemma tokenizer와 응답 스텁으로 확인했으며 실제 생성/Jev 호출0이다. Jev가 해당 한국어 문장을 그렇게 판단한다는 증거는 아니다. 소스30개가 BUILD의 task-delta.json afterSha256와 일치했으며 감사에서 구현 파일은 변경하지 않았다.

기준선은 Git HEAD `d4a91e86715ad87c542d99266a7447911e7c36f4` 및 현재 dirty 파일이다. HEAD로 되돌리지 않는다. `J:/ai/ai-character-runtime/conversation-v1/task-delta.json`은 앞 BUILD의 범위이며 수정 BUILD 시작 시 변경 예정 파일의 현재 해시/원문을 별도로 보존한다. 이전 verification.json과 generation/ledger는 수정하지 않는다.

### 22.2 A01: 판단 무효화를 침묵과 설명까지 전파

소유자는 `packages/database/src/store.ts`의 `invalidateOutputs`, `redactSilences`, `silenceSources`다. Core의 침묵 선택·공개 강도·감정 식을 바꾸지 않는다. 새 테이블, SilenceRecord 출처 타입 확장, migration은 이 수정에 필요하지 않다. 기존 appraisals.context_refs, transitions.appraisal_id/effects, response_sources를 사용한다.

1. 소거 전에 직접 무효 event/memory, 응답 DAG, 그 응답을 참조한 appraisals를 조회한다. 무효 appraisal과 transitions.appraisal_id로 연결된 침묵 사건 ID를 수집한다. 현재 recentSilences뿐 아니라 교체돼 과거 transitions에만 남은 이유도 포함한다.
2. 그 이유를 사용한 reengagement 응답을 plan.reengagement.silenceEventId 및 연결 transition에서 찾고 응답 DAG에 추가한다. 그 응답을 본 후속 appraisal/침묵까지 더 이상 대상이 늘지 않을 때까지 집합으로 순회한다. UUID 중복 제거로 종료를 보장한다. 지워진 plan/effects에 기대지 않도록 전체 대상을 먼저 확정한다.
3. 한 기존 locked transaction 안에서 appraisal result/provider_result/context_refs, 관련 현재·과거 silence/reengagement effects, 응답 plan/conversation_refs/대사 원문을 소거한다. 기존 epoch 증가·진행 응답 취소·늦은 생성 폐기는 유지한다. 판단이 무효라는 이유만으로 실제 user event의 원문을 삭제하거나 직접 data_status를 바꾸지 않는다.
4. `silenceSources`는 연결된 appraisal이 stale이거나 transition이 source_redacted면 거부한다. 이전 코드가 남겨 둔 stale 이유도 다시 설명에 쓰지 못하게 한다. 연결 appraisal이 없는 구형 기록은 기존 event/memory 검증을 유지하고, 단순히 구형이라는 이유로 유효 이유를 모두 지우지 않는다.
5. 이후 이유 질문은 다른 유효 기록을 임의로 부활시키지 않고 unknown으로 처리한다. 유효한 별도 상대의 이유와 정당한 deflect는 보존한다. 시간 고정 검사에서 현재 affect/mood/hold는 삭제 전후 동일해야 한다. 실제 시간 경과에서는 기존 decay만 허용한다.

완료 증거는 A01-1~4다. 설명 응답까지 이어지는 전파와 기존 데이터 방어가 빠지면 부분 수정으로 판정한다.

### 22.3 A02: 사실 자료 중복 제거와 전체 요청 기준 이력 축소

**사전 계획의 내부 계약을 명시적으로 보완한다.** §20.3의 “Jev와 생성이 같은 snapshot”은 일반 경로에서 유지한다. 전체 생성 입력이 초과하는 경우에만 생성이 그 snapshot의 오래된 교환을 제외한 연속된 뒷부분을 사용할 수 있다. Jev 호출 전에는 판단 결과에 따른 plan/공개 지침이 확정되지 않아 전체 생성 요청을 정확히 셀 수 없다. 같은 snapshot을 강제하려고 Jev를 재호출하거나 모든 입력에서 이력을 과도하게 줄이는 일을 피하기 위한 변경이다. 제품 동작·감정 권한은 그대로이며 **양쪽이 본 근거를 구분해 보존하는 것이 추가 의무**다. 이 보완은 아직 코드에 적용되지 않았다.

- appraisal.context_refs는 Jev가 실제 본 원래768토큰 이력의 근거를 유지한다. response_sources도 판단/표현의 전체 의존성을 보수적으로 유지한다. 생성에서 빠진 교환의 출처라고 삭제 의존성을 제거하지 않는다.
- response_runs.conversation_refs는 실제 생성에 제공할 이력으로 갱신한다. 기존 JSON schema/컬럼으로 기록하고 교환을 뺐으면 truncated=true다. 입력 없음/구형 nullable도 구별해 보존한다. 두 기록의 차이는 전체 예산 초과 때만 허용하며 사용자·assistant의 내용 수정, 순서 변경, 중간 교환 제거, 새 발언 추가는 거부한다.

**구현 흐름과 계약:**

1. `Store.responseContext`: trigger transition의 appraisal.context_refs에서 원래 history event ID를 얻어 모델용 sources의 중복을 제외한다. currentInput, 검증된 silenceSources의 독립 이유 근거, 선택 memories/identities는 보존한다. DB response_sources 행은 지우지 않는다. 생성 이력을 줄인 후 다시 context를 읽어도 제외한 과거 발언이 sources로 돌아오면 실패다. legacy untyped ref를 새 history로 오인하지 않는다.
2. `DialogueGenerator`에 필수 비추론 포트 `fitConversation(plan, context): Promise<{conversation: ConversationSnapshot | undefined; inputTokens: number}>`를 추가한다. 반환에 provider별 prompt/HTTP 형식을 노출하지 않는다. Ollama 구현은 현재 `dialogue`의 요청 조립을 같은 파일의 private `buildDialogueRequest`로 분리해 계수와 전송이 동일한 messages/template를 쓰게 한다. prompt 문구/생성 schema/온도/seed/출력 한도는 바꾸지 않는다.
3. fit은 history≤768을 확인하고 전체 요청을 실제 counter.count(messages)로 센다. 3328 이하이면 그대로 반환한다. 초과하면 가장 오래된 user와 바로 뒤 assistant를 함께 제외하고 재조립·재계수한다. silent user 한 건은 단독 교환이다. 최대4교환이므로 최초 계수 포함 최대5회 전체 계수 후 종료한다. 글자 자르기·요약 생성·추론 호출은 없다.
4. 이력이 비어도 초과하면 기존 input_too_long을 반환한다. 이번 수정은 현재 입력, 선택된 기억/사실, 침묵 이유, 공개 선택, 말투를 자동으로 줄이지 않는다. 토큰 계수 실패도 추정치로 통과시키지 않는다. 생성 HTTP는0회여야 한다.
5. `Coordinator.dispatch`는 context 조회→fit→기존 control 직렬화 안의 새 `Store.fitResponseConversation(id, conversation)`→재검증된 context로 dialogue 순서다. 새 Store 메서드는 planned 상태·현재 epoch/session·원래 출처 유효성과 동일 snapshot 또는 교환 단위 suffix인지 검사한다. 검증 실패면 저장/생성하지 않는다. 단축 refs만 저장하고 원래 response_sources는 남긴다. 반환은 최신 `{response, context}` 또는 null이며 Core/Store에서 Ollama prompt를 만들지 않는다.
6. `dialogue`의 최종3328 검사는 유지한다. 준비 뒤 출처 수정/삭제, 취소, restart는 기존 epoch/barrier로 막고 새로운 침묵 이유를 만들지 않는다. fit이나 생성 실패 후 busy가 풀려 다음 입력이 가능해야 한다.
7. 직접 adapter를 쓰는 `runGeneration`도 같은 fit을 한 번 호출하고 반환 이력과 토큰 수를 row에 기록한다. A의 이력 없음과 B/C의 동일 선택 규칙은 유지한다. Stage wrapper는 실제 provider의 fit에 위임하고 합성 fixture는 명시적 비추론 구현을 제공한다. 실제 재평가나 ledger 초기화는 하지 않는다.

### 22.4 변경할 파일과 순서

모두 기존 파일 수정 예정이다. 신규 production 파일/SQL은 기본 계획에 없다.

| 순서 | 파일·심볼 | 변경·증명할 내용 |
|---|---|---|
| 1 | evals/conversation-context.test.ts | A01 삭제/정정→침묵→설명 연쇄, stale legacy 방어, 유효 상대/감정 보존을 실패로 고정 |
| 2 | packages/database/src/store.ts: invalidateOutputs/redactSilences/silenceSources | A01 대상 집합 확정과 원자적 소거, 읽기 검증 |
| 3 | packages/adapters/src/adapter.test.ts; evals/conversation-context.test.ts | A02 중복 sources, 전체3328/3329, 축소 후 다시 읽기, 근거 보존 실패 고정 |
| 4 | packages/contracts/src/ai-ports.ts·ai-ports.test.ts; conversation.ts·conversation.test.ts | fit 포트, 교환 단위 suffix 검증/제거 재사용. 별도 provider 구현의 타입 계약 |
| 5 | packages/adapters/src/ollama.ts: dialogue/dialogueMaterial/신규 buildDialogueRequest/fitConversation | 한 요청 조립 경로, 전체 계수·최소 교환 제거, 계수와 전송 parity |
| 6 | packages/database/src/store.ts: responseContext/신규 fitResponseConversation; apps/runtime/src/coordinator/index.ts: dispatch | 모델용 sources 분리, 생성 refs 저장, 원래 판단 의존성 유지, 경쟁 중 취소 검사 |
| 7 | evals/helpers.ts; evals/provider-boundaries.test.ts; evals/emotion-participation-stage.ts | fixture와 두 대체 provider에 필수 fit 구현, 실제 Stage wrapper는 위임만. 새 UI/시나리오 구현 없음 |
| 8 | evals/conversation-eval.ts: runGeneration; evals/conversation-eval.test.ts | 직접 생성 경로도 fit 사용, 최종 context/토큰 기록과 호출0 실패 검사. 고정 품질 문항·rubric 불변 |
| 9 | evals/coordinator.test.ts; evals/participation.test.ts | fit 대기 중 삭제/취소, 이유 unknown/deflect 구분, 다음 입력 가능 검사 |
| 10 | IMPLEMENTATION_PLAN.md·VALIDATION_PLAN.md·BUILD_HANDOFF.md·PLANNING_CHANGELOG.md·README.md | 수정 결과/실행 수/잔여 실패를 실제 증거로 갱신 |
| 10 | LOCAL_AI_INTEGRATION.md §16; DATABASE_SPEC.md §17; CHARACTER_DOMAIN_SPEC.md §16 | BUILD에서 fit 포트와 appraisal 원래 근거/생성 suffix/삭제 수명 계약을 구현에 맞춰 갱신. 지금은 아래 계획 링크로 구분 |

`evals/db.test.ts`, `protocol.test.ts`, `dialogue-models.test.ts`, `packages/adapters/src/jev.test.ts`는 우선 회귀 실행 대상이다. 확인된 계약 영향 없이 정답을 변경하지 않는다. 포트 추가로 타입 오류가 생기는 직접 구현체만 보완하고 unrelated refactor는 하지 않는다.

### 22.5 검증·증거 재사용·완료 경계

구체 입력/성공 기준/명령은 [VALIDATION_PLAN §23](./VALIDATION_PLAN.md#conversation-repair-validation)이 단일 목록이다. 기존 검사의 기대값을 실패에 맞춰 완화하지 않는다. 단, 무조건 동일 snapshot 검사는 **예산 내 동일 + 초과 시 교환 단위 suffix + 원래 의존성 보존**의 세 검사로 명시적으로 보강한다.

Store/Coordinator 변경으로 CR01–03/ER11 관련 DB 증거를, 요청 조립/포트 변경으로 adapter·provider 경계·타입 증거를 다시 확인한다. 기존 실제36개 출력은 이전 소스/입력 조건의 관찰로 보존하며 수정 후 품질 PASS로 재사용하지 않는다. 변경한 source hash로 옛 manifest의 확인 게이트를 우회하지 않는다. R2 후보 미채택, 사람 수용 NOT REVIEWED, R3/R4 미착수는 그대로다.

BUILD는 전용 합성 DB와 mock Jev, 설치된 오프라인 tokenizer 및 HTTP 스텁으로만 증명한다. 실제 모델 추론0·유료 API0·다운로드0, 새 임시/로그/cache는 `J:/ai/ai-character-runtime/conversation-v1/repair-r1/`에 둔다. J: 쓰기나 로컬 DB 연결에 필요한 실행 권한이 없으면 승인 절차를 사용하고 우회하지 않는다. 기존 운영/증거 DB를 reset하지 않는다. UI/browser 실행을 했다고 쓰지 않는다.

종료 조건은 필수 A01-1~4/A02-1~6 전부 PASS, 영향 회귀/타입 PASS, 문서의 실제 결과 동기화다. 미실행이 있으면 NOT VERIFIED이며 수정 완료로 합산하지 않는다. 다음 감사는 이 수정 delta와 아래 잔여 위험만 확인한다: 삭제 폐쇄 집합의 누락, 줄인 이력이 sources로 재유입되는 경로, 계수와 전송의 차이, 취소 중 refs 저장. 생성 품질 튜닝이나 R3/R4로 자동 확장하지 않는다.

**다음 BUILD 지시:** “IMPLEMENTATION_PLAN §22와 VALIDATION_PLAN §23대로 R1-A01/A02를 수정해. 실패를 먼저 고정하고 원래 판단 출처·의도적 숨김·감정 지속을 보존해. 합성 DB/오프라인 tokenizer/스텁으로 필수 성공 기준과 영향 회귀를 검증하고 결과 문서까지 갱신해. 실제 모델/Jev 재호출, 후보 승격, R3/R4, commit/push는 하지 말고 감사 가능한 상태에서 멈춰.”

<a id="conversation-repair-build"></a>

## 23. R1-A01/A02 수정 BUILD 결과 — 2026-10-13

사용자 “ㄱ”에 따라 §22를 구현했다. 필수10개 기준의 집중 검증은 PASS이며 **감사 결과는 아직 NOT RUN**이다. R2 후보 미채택/미사용 확인12, 사용자 NOT REVIEWED, R3/R4 미착수는 유지한다. 실제 모델·Jev·브라우저 실행 없이 데이터 수명과 입력 예산을 검증했다.

### 23.1 수정과 보존한 경계

Store.invalidateOutputs는 원문/기억→응답→판단→침묵 이유→이유 설명 응답의 의존 집합을 소거 전에 반복 확정한다. 과거 transitions와 교체된 이유도 포함하며 한 locked transaction에서 appraisal 복사 자료/이유/설명/후속 대사를 소거한다. silenceSources는 stale appraisal/source_redacted 전이를 거부하고 연결 판단이 없는 유효 구형 이유는 기존 출처 검사로 유지한다. 현재 affect/mood/hold, 다른 상대의 독립 이유, 유효 deflect는 보존했다. 사용자 원문을 판단 무효화만으로 삭제하지 않는다.

responseContext는 appraisal의 원래 typed history refs로 과거 user 발언을 모델용 sources에서 제외하되 직접 이유 근거/현재 입력/기억은 유지한다. fitConversation은 공통 buildDialogueRequest와 실제 counter로 전체3328·history768을 맞추고 오래된 교환만 제거한다. 계수 중 추론은0이다. Coordinator는 fit 뒤 epoch/출처/suffix를 Store에서 검증하고 실제 생성 refs를 저장한다. 원래 appraisal.context_refs와 response_sources는 남겨 제외된 근거의 삭제도 전파한다. 마지막 dialogue 전체 계수와 기존 output barrier를 유지했다.

평가기의 fitGenerationContext도 같은 포트를 사용하며 실제 사용할 context/inputTokens/historyTokens를 row에 기록한다. 실제 Stage wrapper의 fit은 로컬 provider로 위임하고 합성 fixture/대체 provider에도 필수 포트를 추가했다. wrapper는 코드/타입으로 확인했으며 새 Stage 실행 증거가 아니다.

### 23.2 파일·검사·작은 구현 조정

구현/소비자8개: packages/database/src/store.ts, packages/contracts/src/ai-ports.ts·conversation.ts, packages/adapters/src/ollama.ts, apps/runtime/src/coordinator/index.ts, evals/helpers.ts·emotion-participation-stage.ts·conversation-eval.ts. 검사7개: contracts의 ai-ports.test.ts·conversation.test.ts, adapters의 adapter.test.ts, evals의 conversation-context.test.ts·coordinator.test.ts·provider-boundaries.test.ts·conversation-eval.test.ts. 영향 문서10개를 갱신했다. 신규 production 파일·migration·dependency 없음.

예정된 참여/기존 DB·프로토콜·모델/Jev 검사는 실행만 했고 정답을 고치지 않았다. 순서가 다른 JSON 객체도 같은 snapshot으로 판단하도록 schema 정규화 후 suffix를 비교한다. 회귀 검사 중 attention.selected 전이를 appraisal 효과로 잘못 묶은 검사는 appraisal.applied로 범위를 바로잡았다. 두 수정 전 삭제/정정 실패는 이유 잔존 단계에서 이미 재현됐으며 기대 수명을 완화하지 않았다.

실제 증거는 `J:/ai/ai-character-runtime/conversation-v1/repair-r1/`에 있다. baseline.json/baseline은 이번 시작 당시 dirty 원문26개이고 이전 BUILD baseline과 구분한다. red-db.log는4 FAIL/14 PASS, red-adapter.log는 fit 포트 미구현2 FAIL/59 PASS다. 초기 보강 중 실패도 db-first/db-second 로그로 보존한다. 일반 권한의 초기 tsc에서는 기존 테스트 선언 오류와 이번 검사 optional 접근 오류가 나왔고 optional 접근을 수정했다. 승인된 최종 환경에서는 전체 tsc exit0이다. 기존 선언 오류의 최초 원인은 확정하지 않았으며 관련 dependency/config를 바꾸지 않았다.

최종 단위4파일111, 통합8파일146은 각각 한 번의 지정 범위 실행에서 전부 PASS다. 중간 반복 실행 수를 합산하지 않는다. 전체 suite/UI build는 실행하지 않았다. 실행 명령과10개 기준별 매핑은 [검증 §24](./VALIDATION_PLAN.md#conversation-repair-evidence)에 있다.

### 23.3 실제 tokenizer 결과와 종료

설치 Gemma tokenizer로 입력826/926/976/1000자를 검사했다. 중복을 제거한826자는 history460/전체3196으로 유지됐다(감사 당시 중복 포함3715). 나머지 세 입력은 전체3464/3600/3664에서 오래된 교환을 제거해3007/3143/3207이 됐다. 모두 최종 전송 스텁의 messages 해시와 실제 재계수가 fit 결과와 같았다. 모델 추론0, HTTP 네트워크0이며 유효 응답 스텁4회는 실제 모델 호출이 아니다. tokenizer 파일 해시와 조건/결과는 offline-tokenizer.json에 있다.

필수10개 기준 PASS, 타입 PASS, 소유 합성55434 종료. 모델/API/다운로드/개인자료/음성/commit/push0. 사용자 Ollama의 시작·중지 명령은 실행하지 않았다. 종료 당시 상태를 과거 PID로 추측하지 않는다. 새 감사는 이 수정 범위로 제안한다. 현재 요청 구성이 바뀌었으므로 이전 R2 출력/Stage 기록은 이전 조건의 관찰이며 수정 후 품질·실제 연결을 입증하지 않는다.

<a id="conversation-event-delete-repair"></a>

## 24. R1-A03 이벤트 삭제 전파 수정 — 2026-10-13

§23 이후 감사는 FAIL이었다. deleteEvent가 appraisal.context_refs와 transition.effects를 먼저 지운 뒤 invalidateOutputs를 호출해, 삭제한 과거 user 발언을 읽은 침묵 판단은 stale이지만 그 이유는 현재·과거 기록에 남았다. 읽기 방어는 unknown으로 처리했다. 기존 호출 경로와 새 의존 집합 계산의 연결 누락이며 데이터 소거 계약 CR03/ER11을 충족하지 못했다.

사용자 “ㄱ”으로 승인된 수정은 store.ts:deleteEvent의 기존 invalidateOutputs 호출을 appraisal/transition 소거 직전으로 옮기는 것이다. 기존 locked transaction, 이벤트/파생 기억 삭제, 관계·활동 재계산, epoch 증가, 원문 삭제 범위와 감정 정책은 유지한다. 추가 테이블·포트·모델 변경 없이 원래 의존 집합을 읽을 수 있는 시점만 바로잡는다.

성공 기준은 (1) 이벤트 A→완료 응답→침묵 B→설명 C→새 침묵 D의 현재·과거 이유와 복사 판단/후속 대사 소거, (2) 다음 이유 질문 unknown/context.silence=null, (3) 다른 상대의 유효 이유/deflect와 고정 현재 affect/mood 유지, (4) 삭제 재전송의 중복 epoch 증가 없음, (5) 늦은 생성 폐기와 다음 입력 처리 유지다.

evals/conversation-context.test.ts의 기존 기억 삭제/정정 연쇄 검사와 독립 이유 보존 검사에 이벤트 삭제 변형을 각각 추가했다. 두 신규 변형을 수정 전에 실행해 이유 잔존 FAIL을 고정한 뒤 호출 순서를 수정했다. 기존 기억 검사 기대값은 유지했다. 영향 범위는 대화 출처·DB 무결성·참여·Coordinator와 직접 소비 프로토콜이며 전체 suite나 새 모델 평가로 확장하지 않았다.

결과: 영향 통합4파일100, 프로토콜1파일14, 타입 PASS. 자세한 명령/판정은 [검증 §25](./VALIDATION_PLAN.md#conversation-event-delete-evidence). 원본6개·수정 delta·red/green 결과는 `J:/ai/ai-character-runtime/conversation-v1/repair-r1-a03/`다. 코드/검사2파일과 직접 인계 문서4파일만 변경했다. 이전 R2 dev36/ledger/미채택 판정은 보존하며 새 실제 Jev→Stage·한국어 품질은 NOT VERIFIED다. 다음은 이번 delta AUDIT, 아직 감사 PASS는 아니다.
