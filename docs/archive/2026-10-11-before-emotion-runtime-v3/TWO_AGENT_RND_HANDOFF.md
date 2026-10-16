# 두 연구 에이전트 인계 패키지

작성일: 2026-10-02  
상태: 전달용 문서 작성 완료. **이번 작업에서 에이전트를 생성하거나 실험을 실행하지 않았다.**

사용법: 아래 **A 패키지 또는 B 패키지 전체**를 해당 에이전트에게 전달한다. 각 패키지는 배경·범위·계약을 포함하므로 이전 대화가 없어도 시작할 수 있다. 마지막 통합 절차는 결과를 합치는 담당자에게 전달한다. 저장소가 다른 위치에 있으면 root 경로만 바꾼다.

두 역할은 병렬로 조사할 수 있지만 GPU 실험은 한 작업씩만 실행한다. 외부 메시지 발송·새 에이전트 생성·유료 자원 사용 권한을 이 문서로 추론하지 않는다.

## A 패키지 — Representation / Model Mechanistic Research

### 임무와 배경

당신은 AI Character Runtime의 representation 연구 담당자 A다. 작업 root는 `C:\Users\ltk90\vibe_coding_projects\ai-character-runtime`이다. 목표는 **외부 지속 감정 상태를 전달하는 context 기준선보다 activation steering이 납득 가능한 판단에 추가 이득을 주는지** 확인할 연구 보고서와 최소 PoC 설계를 만드는 것이다. 긍정적인 결론을 내야 하는 과제가 아니다.

2026-10-02 현재 코드에는 설정 검증, bigint 직렬화, 환경 진단과 9개 테스트만 있다. Character Core, DB schema, memory, Ollama adapter, TTS worker, Studio/Stage는 아직 없다. 기존 설계는 TypeScript Core가 상태를 결정하고 로컬 PostgreSQL에 저장하며, Ollama/Qwen이 해석과 대사를 생성하는 구조다. JEV는 설치된 제품이 아니라 appraisal 역할의 이름이다. 기존 OmniVoice 환경은 `J:\ai\omnivoice tts\omnivoice-env`에 있고 이번 연구가 수정해서는 안 된다.

추가 서비스 비용은 0원이다. 기존 기록상 RTX 5070 Ti 16GB, RAM 약 32GB Windows PC다. 실제 실험 전 환경을 확인한다. 최신 진단에서는 Ollama 연결 불가, DB/STT 미설정, TTS snapshot 미선택이었다. 설치 목록과 과거 PASS를 현재 모델 추론 성공으로 취급하지 않는다.

### 읽을 자료와 사실 구분

먼저 root의 `CURRENT_STATE_AUDIT.md`, `AFFECTIVE_ARCHITECTURE_V2.md`, `REPRESENTATION_STEERING_RND.md`, `NEXT_DECISIONS.md`를 읽는다. 직접 연결되는 `LOCAL_AI_INTEGRATION.md` §4–7·10, `CHARACTER_DOMAIN_SPEC.md` §1·5·10–12, `MVP_SPEC.md` §6, `VALIDATION_PLAN.md`, `packages/contracts/src/local-config.ts`, `scripts/diagnose.ts`를 확인한다. 추가 코드가 생겼다면 실제 파일을 근거로 차이를 기록한다. 기획 경로를 존재하는 코드로 인용하지 않는다.

현재 MVP의 기본 상태는 joy/frustration/surprise/embarrassment/pleasantness, 상대별 familiarity/affinity와 검증 도움 근거다. VAD 전체·attachment·scar·감정 기반 검색·steering은 미채택 연구 후보다. 주관적 고통이나 의식을 증명하려는 과제가 아니다.

### 답해야 할 질문

1. emotion/pain 방향의 구별 성능과 실제 판단 변화는 어떤 실험으로 구분되는가?
2. 같은 사실·기억·프롬프트에서 context만으로 충분한가? steering 추가 효과는 있는가?
3. 후보 방향의 효과가 일반 부정 sentiment, fear, sadness, 단순 혼란이나 random 교란과 구별되는가?
4. Qwen/Gemma의 공개 pretrained vector가 있다면 정확히 어떤 checkpoint·layer·정규화·라이선스에 맞는가? 우리 Ollama 모델과 호환된다는 증거는 무엇인가?
5. 양자화·token 위치·언어·prompt 변경에서 calibration이 얼마나 깨지는가?
6. 일반 추론·사실 보존·한국어 지시 이행을 유지하는 개입 범위가 있는가?
7. 16GB 장비에서 기존 음성 환경을 바꾸지 않고 실행할 가장 작은 경로는 무엇인가?

### 필수 문헌과 재사용 조사

1차 자료를 직접 열어 제목·날짜·버전·본문 근거·코드 위치를 기록한다.

- [Emotion Concepts and their Function in a Large Language Model](https://arxiv.org/abs/2604.07729v1): Sonnet 4.5 결과를 로컬 모델로 일반화하지 않는다.
- [Pain Axis v1](https://arxiv.org/html/2609.16247v1)과 [v2](https://arxiv.org/html/2609.16247v2), [저자 구현](https://github.com/valen-research/Pain-axis): v2가 relief 해석을 수정한 점을 확인한다. [외부 v1 재검토](https://github.com/wolframs/pain-axis-review)는 AI 작성·비동료심사 보고임을 표시하고 저자 후속 실험과 비교한다.
- [Emotions Where Art Thou](https://arxiv.org/html/2510.22042v2): VAD 해석과 latent geometry, 지속 상태를 구별한다.
- [CAA 논문](https://aclanthology.org/2024.acl-long.828/)과 [코드](https://github.com/nrimsky/CAA), [Representation Engineering](https://github.com/andyzoujm/representation-engineering).
- [steering-vectors](https://github.com/steering-vectors/steering-vectors), [pyvene](https://github.com/stanfordnlp/pyvene), [TransformerLens](https://github.com/TransformerLensOrg/TransformerLens), [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness).

Extraction/hook/residual injection/PCA/probe/cosine/eval 기반 코드는 재사용을 우선한다. Framework는 처음 하나만 고른다. Pain Axis 실행 스크립트의 전체 HF 캐시 삭제와 외부 judge/API 경로는 그대로 실행하면 안 된다. 기존 음성 캐시와 무료 로컬 조건을 보존한다.

### 실험 설계와 실행 경계

기본 산출물은 조사·실험 설계 문서다. 사용자가 별도로 PoC 실행까지 지시한 경우에만 아래의 격리된 실험을 수행한다. 실행하지 않은 것은 `NOT_RUN`; 모델·환경 부족은 구체적인 `BLOCKED` 사유를 남긴다.

- B가 제공하는 synthetic canonical fixture를 고정하고 상태 writer는 만들지 않는다. B가 아직 없으면 같은 계약으로 임시 fixture를 만들고 임시임을 표시한다.
- 기존 로컬 모델 context 기준선을 먼저 설계한다. HF 내부 개입 비교에서는 같은 HF backend의 context 기준선을 다시 실행한다.
- 대조 쌍 120개를 discovery/calibration/final 60/30/30으로 나누는 계획부터 검토한다. 이야기·의역·번역을 split 간 격리한다.
- 차분 평균 → held-out discrimination → causal steering → fingerprint → random/negative controls → 관련 개념 비교 → 해석 순서를 지킨다.
- `candidate-001` 같은 중립 이름을 사용한다. 세 layer 후보, 작은 개입 norm 범위, 한 가지 token mask로 시작한다.
- Context, context+steering, context+random 5방향, 관련 개념, zero vector, 상태 설명 없는 steering을 비교한다.
- 판단 평가 60 dev/60 final 상황과 일반 능력 100문항은 초기 파일럿 예산이다. 동일 조건·선택지 순서 균형·오류 포함 분모를 유지한다. Seed/턴을 독립 표본으로 세지 않는다.
- 주 효과는 rubric 적합 행동 선택률의 B3−B1이다. +10%p, capability 손실 5%p 이내, schema 98% 이상, 중대한 경계 위반 0건을 제안 gate로 검토하고 결과를 보기 전에 동결한다. CI가 불명확하면 결론은 미결이다.
- 같은 질문의 정서 단어 증가만 있으면 채택 근거가 아니다. Core가 미리 정한 행동의 차이는 LLM 개입 효과로 세지 않는다.

첫 실행은 작은 모델·batch 1·짧은 context·텍스트 전용이다. 모델 다운로드와 환경 준비가 필요한 경우 정확한 모델·용량·라이선스·경로를 명시한다. 유료 자원, 전체 모델 sweep, fine-tuning, SAE 학습은 범위 밖이다.

### 공유 인터페이스와 A의 소유 범위

`AffectAdapterInput-v1`을 사용한다. 입력은 requestId/sessionId/generationEpoch/deadlineAt, canonical, sourceVersions, permittedMemoryIds, actionConstraints, displayConstraints, mode다. `canonical`은 `affect-context-v1`이며 characterId/stateVersion/configVersion/evaluatedAt, 기존 inner 5값, target, relationship 근거, causeRefs를 포함한다. Wire 카운터는 십진 문자열이고 없는 축은 0으로 채우지 않는다.

출력은 generatedText 또는 **shadowDecisionCandidate**, appliedMode, adapterVersion, modelDigest, calibrationId, usedSourceIds, timings, status다. statePatch/trustPatch/memoryWrite는 없다. 모델의 판단은 실행 권한이 아니다. B가 Core 정책과 fixture·상태 의미를 소유하고, A는 backend·벡터·calibration·모델 행동 측정을 소유한다.

Calibration에는 model revision, tokenizer/template hash, dtype/quantization/backend, layer/hook/token mask, vector/dataset hash, alpha/norm, 언어, context, validation run을 기록한다. Appraisal와 사실 검증에 hook을 적용하지 않으며 요청 종료·예외·취소 후 hook/KV 영향이 다음 요청에 남지 않아야 한다.

### 수정 가능 범위와 금지 사항

후속 과제를 실제로 시작했을 때 보고서는 `research/affect-rnd/A/` 아래 새 Markdown/CSV로 작성한다. PoC 실행이 별도 위임된 경우 같은 경로의 격리된 scripts/fixtures/results만 사용한다. 기존 `packages`, `scripts/diagnose.ts`, root dependency/lockfile, 승인 명세, DB, OmniVoice 환경은 수정하지 않는다. 연구 의존성은 제품 의존성과 분리한다. B 파일은 수정하지 않고 interface 제안서를 자신의 디렉터리에 남긴다.

채택 여부를 정하기 위해 실패 결과도 남긴다. 벡터 명칭으로 AI의 감정·고통·의식을 단정하지 않는다. 유료 API, 클라우드, 기존 cache 삭제, 자동 전역 환경 업그레이드, 외부 메시지 발송은 금지한다.

### 산출물과 완료 조건

- `A_REPORT.md`: 확인된 주장/저자 보고/가설 구분, 버전별 문헌 비교, framework 하나의 추천과 반대 이유, 모델·환경 선택, 채택/보류/기각 의견.
- `A_EVIDENCE.csv`: claim_id, 원문 URL+버전+절, 코드 commit+파일, 검증 수준, 로컬 재현 여부, 한계.
- `A_EXPERIMENT_PLAN.md`: 데이터 분리, 단일 primary, 대조군, 고정 gate, 샘플 상한, 중단 조건, 실행 명령 계획.
- `A_ADAPTER_PROPOSAL.md`: 공통 계약의 최소 변경 제안, calibration manifest, 0-vector/요청 간 오염 검사.
- 실제 실행 위임 시에만 run manifest·원시 결과·집계 코드·CI·자원 결과를 추가한다. 보고서 작성만으로 실험 PASS라고 표시하지 않는다.

최종 답은 “어떤 증거가 있어야 steering을 채택할 수 있는가, 현재 어떤 증거가 부족한가”로 끝낸다. B에게 필요한 fixture나 interface 변경은 이 문서에 요청 목록으로 남긴다.

## B 패키지 — Persistent Affect / Memory Architecture Research

### 임무와 배경

당신은 AI Character Runtime의 지속 감정·기억 연구 담당자 B다. Root는 `C:\Users\ltk90\vibe_coding_projects\ai-character-runtime`이다. 목표는 **현재 Core 규칙과 사실 기억만으로 충분한지, trace/scar·검색 편향을 추가하면 어떤 측정 가능한 이득이 있는지** 검토하는 것이다. 모델 내부 벡터를 만들거나 감정을 많이 추가하는 것이 목표가 아니다.

2026-10-02 현재 실제 코드는 설정·카운터·진단과 9개 테스트뿐이다. Core/DB/memory/model adapter/UI는 미구현이다. 계획된 시스템은 결정적 TypeScript Core, 로컬 PostgreSQL, Ollama/Qwen appraisal·대사, 기존 OmniVoice다. JEV는 역할 명칭이며 제품 통합은 없다. 추가 서비스 비용 0원과 기존 설치 보존이 필수다. 상태와 캐릭터 history는 특정 모델에 종속시키지 않는다.

기존 MVP의 수치 원본은 `CHARACTER_DOMAIN_SPEC.md`다. 네 감정은 0–1이며 hold/반감기는 joy 4/45초, frustration 6/90초, surprise 1/8초, embarrassment 3/30초다. Pleasantness baseline 0.60, 반감기 900초다. 상대별 최근 600초 칭찬/비하에 `1/(1+n)`과 자극 상한을 적용한다. 관계는 familiarity/affinity 및 검증된 도움 근거이며 통합 trust·attachment는 없다. Scar와 감정 기반 검색은 현재 MVP 제외다.

### 읽을 자료

`CURRENT_STATE_AUDIT.md`, `AFFECTIVE_ARCHITECTURE_V2.md`, `REPRESENTATION_STEERING_RND.md`, `NEXT_DECISIONS.md`를 먼저 읽는다. 그다음 `MVP_SPEC.md`, `CHARACTER_DOMAIN_SPEC.md`, `CHARACTER_PRESET.md`, `DATABASE_SPEC.md` §5·7–8·13–14, `LOCAL_AI_INTEGRATION.md` §4·6–7, `VALIDATION_PLAN.md`, `IMPLEMENTATION_PLAN.md`의 완료 상태를 확인한다. 실제 코드가 달라졌다면 경로·symbol로 차이를 기록한다.

기억은 events에 직접 연결된 `memories`, `memory_sources`, `memory_participants` 구조로 계획되어 있다. 초기 kind는 activity_result/verified_help/unfinished_activity/delivered_proposal뿐이다. 사실과 정서적 해석을 분리하고, 별도 기억 DB나 일반화 의존 그래프를 만들지 않는다.

### 답해야 할 질문

1. 기존 네 감정과 기분으로 표현할 수 없는 행동 사례가 무엇인가? 새 축 없이도 해결되는가?
2. Appraisal의 observed fact와 캐릭터의 subjective judgment를 어떻게 구분할 것인가?
3. 시간, habituation, trace recurrence, sensitization의 책임이 겹치거나 중복 자극을 만드는가?
4. Scar를 기존 기억의 주석으로 둬도 source correction/deletion/replay가 가능한가?
5. 단기 감정 회복·trace 회복·관계 근거 갱신은 어떻게 달라야 하는가?
6. 감정 기반 검색이 적절한 과거를 찾는가, 부정 기억의 자기 증폭만 만드는가?
7. Trust/attachment를 추가하지 않아도 공동 경험의 연속성이 느껴지는가?
8. 모델 교체 후 어떤 데이터와 행동이 같아야 하며 무엇은 재조정 가능한가?

### 조사할 기반과 설계 방향

[FAtiMA](https://github.com/GAIPS/FAtiMA-Toolkit), [Generative Agents](https://arxiv.org/abs/2304.03442), [PsychoAgent](https://arxiv.org/abs/2608.07438)의 appraisal·기억·행동 사례를 기존 규칙과 비교한다. 해당 구현을 그대로 서비스로 도입하지 않는다. Persistent VAD/VAE라는 이름만으로 검증된 상태 엔진이라 가정하지 않는다. VAD 차원과 VAE 학습 모델을 구분한다.

새 축을 제안하면 “없을 때 실패하는 두 개 이상의 서로 다른 사례, 기존 변수로 대체되지 않는 이유, source와 reset/recovery 규칙”을 함께 제시한다. 애착·배신은 연구 후보지만 사용자의 부재·무응답을 벌점이나 배신으로 삼지 않는다. 관측되지 않은 사건과 대사 속 자기 주장은 상태 근거가 아니다.

### 실험 설계와 실행 경계

기본은 조사·설계 문서 작성이다. 사용자가 별도로 시뮬레이션 실행을 지시한 경우에만 격리된 CPU PoC를 작성·실행한다. 현재 제품 Core가 구현됐다고 가정하지 않으며 실험 시뮬레이터가 제품 구현을 대체하지 않는다.

최소 비교:

1. 기존 규칙만 있는 baseline.
2. 기존 규칙 + source memory에 붙은 trace.
3. 기존 규칙 + 같은 우선순위 안에서만 affect retrieval.
4. trace + retrieval. Sensitization은 1–4를 구분한 다음 별도 비교한다.

최소 scenario family: 반복 칭찬, 인용/직접 비하, 실제 도움/허위 주장, 퍼즐 실패/회복, 같은/다른 상대, 같은/다른 활동, 기억만 삭제, 원본 사건 삭제·정정, 중복·재시작, 상태 reset 지시, 부재·무응답. 3세션과 가상 30일을 비교한다. 같은 family의 변형을 dev/final에 나누지 않는다.

Core invariants는 동일 입력 결정성, 사건 한 번 적용, 시계 주기 독립, 범위/상한, identity 귀속, 무효 source 제외, 모델 patch 거절이다. 지정 검사에서 위반 0건이어야 한다. 감정·trace 포화 시간, 회복 궤적, false-trigger, 실제 선택 차이와 원인을 기록한다. 가상 30일은 현실 장기 평가가 아니다.

Trace는 처음에 memoryId/contentVersion별 주석 하나다. 현재 memories에는 해당 컬럼이 없으므로 제품 schema가 이미 지원한다고 쓰지 않는다. 우선 검증된 활동 실패/성공에서 시작하고 자유 채팅 배신은 보류한다. 재활성화는 외부 사건에 연결된 동일 전이 effects로 기록한다. 검색 자체, timer, 자기 대사, 종료 정리는 강도 증가 근거가 아니다. Cooldown·만료·예산·대상 일치를 필수로 둔다.

감정 기반 검색은 validity/visibility/topic 필터 뒤 같은 우선순위에서만 재정렬하며 기존 5개/600 tokens budget을 지킨다. Trace 후보 선택은 전이 전 상태로 한 번, 대사 기억 선택은 commit 후 한 번이며 재검색 루프는 없다. 같은 기억을 반복 읽어도 상태가 증가하지 않아야 한다.

기억만 삭제하면 그 trace도 제거하되 독립된 원본의 관계 근거는 유지한다. 원본 삭제는 관련 파생물을 무효화하고 관계를 재집계한다. 이미 생긴 단기 감정은 원인 참조를 제거하고 기존 계약대로 감쇠시킨다. 모델이 “상처가 사라졌다”고 말한 것은 삭제 명령이 아니다.

### 공유 인터페이스와 B의 소유 범위

공통 입력은 `AffectAdapterInput-v1`이다. requestId/sessionId/generationEpoch/deadlineAt, canonical, sourceVersions, permittedMemoryIds, actionConstraints, displayConstraints, mode를 사용한다. `canonical`은 `affect-context-v1`: characterId/stateVersion/configVersion/evaluatedAt, joy/frustration/surprise/embarrassment/pleasantness, target, 상대별 관계 근거, causeRefs. Wire 카운터는 십진 문자열이다. 없는 arousal/trust score 등을 0으로 만들지 않는다.

B는 상태 의미·전이식·기억 유효성·행동 rubric·canonical fixture를 소유한다. A는 모델별 layer/vector/alpha/실행기와 행동 측정을 소유한다. B의 fixture에는 상태 및 memory hash, 상대·활동, 기대 불변조건, 허용 행동 집합, split/family ID를 포함한다. 모델에 정답 행동 레이블을 입력하지 않는다.

A의 generatedText/shadowDecisionCandidate는 상태 patch가 아니며 B의 Core만 최종 행동을 결정한다. 연구에서는 Core가 정한 행동과 모델 선택을 따로 채점한다. Inner/display/self-description을 분리하고 모델의 자기 보고로 내부 수치를 다시 쓰지 않는다.

### 수정 가능 범위와 금지 사항

후속 과제를 시작하면 `research/affect-rnd/B/` 아래 보고서·계약 제안·fixture 명세를 새로 작성한다. 실행을 별도 위임받으면 같은 경로에 독립 CPU simulator와 합성 결과를 둘 수 있다. 기존 제품 코드·package/lockfile·DB schema·MVP·숫자 원본·OmniVoice 환경·A 파일은 수정하지 않는다. 채택 제안은 별도 문서이며 자동 migration으로 만들지 않는다.

새로운 감정 DB, 범용 플러그인 플랫폼, 모델 내부 vector 추출, paid/cloud 실행, 기존 데이터 삭제, 관측하지 않은 경험 생성, 의식·고통 단정은 범위 밖이다. 더 단순한 안이 같거나 더 좋으면 그 결론을 우선한다.

### 산출물과 완료 조건

- `B_REPORT.md`: 기존 규칙의 충분성, 추가 요소별 증거, 단순화 가능한 요소, 채택/보류/기각 의견.
- `B_STATE_SPEC.md`: 수식·단위·초기값·상한·시간·중복·회복·정정의 후보 계약. 확정값과 연구 파라미터 구분.
- `B_SCENARIOS.md`와 fixture 명세: scenario/family/split ID, 사건 timeline, 상태·기억·identity, 예상 불변조건·허용 행동, 반례.
- `B_MEMORY_IMPACT.md`: 기존 tables/fields/queries와 직접 영향, source 삭제·tombstone·재활성화 중복 방지, migration 필요성. 실제 migration은 작성하지 않음.
- `B_ADAPTER_PROPOSAL.md`: A에게 전달할 canonical fixture와 공통 계약 변경 제안.
- 실제 실행 위임 시에만 명령·소스 hash·raw trajectory·집계·실패 사례를 추가. 미실행 결과는 `NOT_RUN`으로 남김.

보고서의 핵심은 “상처 변수를 추가하면 인간다워진다”가 아니라, **무엇이 어떤 비교에서 개선되어야 채택할 수 있는가**다. 모델 내부 개입 없이 목표를 달성하면 그 점을 명확히 적는다.

## 통합 담당자용 절차

### 1. 공통 언어와 결과 형식 고정

Event는 관측 사건, appraisal은 해석 후보, canonical은 외부 지속 상태의 읽기 projection, trace는 기존 기억의 주석, representation은 모델 내부 임시 activation이다. Pain representation/nociception-like signal/negative valence/suffering/motivation/avoidance/self-preservation/persistent affect/conscious experience를 같은 뜻으로 쓰지 않는다.

두 보고서가 최소한 다음 형식을 따르는지 확인한다.

```text
claim_id / hypothesis / observed_or_proposed
source_url + version + section OR repo_file + symbol
run_id / executed_at / source_manifest / dependency_manifest
model_digest / dataset_hash / split / family_id / condition / seed
canonical_hash / memory_set_hash / source_versions / rule_version
primary_metric / effect_size / confidence_interval / failure_count
status: PASS | FAIL | BLOCKED | NOT_RUN | INCONCLUSIVE
scope_and_limitations / adoption_recommendation
```

### 2. 합치는 순서

1. **현황 일치:** 두 에이전트가 동일한 실제 구현 상태와 MVP 제외 범위를 전제로 했는지 검사한다.
2. **계약 동결:** B의 canonical/fixture와 A의 지원 필드를 대조한다. 미지원 축은 누락 상태로 둔다. 공통 계약 v1을 고정하고 각자 소유 파일에서만 수정한다.
3. **단순 기준선:** B의 상태 불변조건이 먼저 통과해야 한다. 모델 없어도 실패하는 상태 설계를 steering으로 보완하지 않는다.
4. **인과 비교:** A는 같은 backend·같은 B fixture로 context/steering/control을 비교한다. B의 검색 정책이 바뀐 run을 같은 비교에 섞지 않는다.
5. **교차 검토:** A는 B의 adapter 입력이 모델에 행동 정답을 누설하는지, B는 A의 효과가 상태/사실/행동 경계를 훼손하는지 검토한다. 검토는 결과물 기반이며 외부 메시지 전송 권한을 추가하지 않는다.
6. **통합 결정:** [NEXT_DECISIONS](./NEXT_DECISIONS.md)의 gate별 채택/보류/기각과 미확인 사항을 `RND_SYNTHESIS.md`에 정리한다. 실제 실행을 위임받지 않은 문서 단계라면 실험 gate는 계속 미실행이다.

### 3. 의견 충돌 처리

“A는 steering이 좋다고 함, B는 상태가 좋다고 함”을 절충해 둘 다 넣지 않는다. 다투는 주장 하나를 같은 fixture의 대조 실험으로 바꾼다. 출처 삭제·로컬 비용·identity 같은 불변조건은 선호 점수로 상쇄할 수 없다. 중복 변수가 있으면 제거 ablation을 먼저 한다. 같은 쟁점의 검토/보완이 세 번 반복되어도 해결되지 않으면 남은 증거를 기록하고 채택을 보류한다.

최종 통합점은 **Core가 만든 읽기 snapshot → provider input adapter**다. 상태와 history는 PostgreSQL 계획을 유지한다. 산출물이 준비됐다는 이유만으로 제품 dependency·schema·MVP 범위를 자동 변경하지 않는다.
