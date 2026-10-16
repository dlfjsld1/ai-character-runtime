# 다음 결정과 연구 채택 기준

작성일: 2026-10-02  
상태: 의사결정 제안. 모델·상태·사용자 실험은 미실행.  
읽기 순서: [현황](./CURRENT_STATE_AUDIT.md) → [아키텍처](./AFFECTIVE_ARCHITECTURE_V2.md) → [R&D](./REPRESENTATION_STEERING_RND.md) → [인계 패키지](./TWO_AGENT_RND_HANDOFF.md)

## 1. 지금 유지할 결정

**기존 MVP를 구현할 때 필요한 결정과 감정 확장 연구의 채택 결정을 분리한다.** 지금 확정할 수 있는 것은 소유권·비용·증거 경계다. 최적 감정 축이나 벡터 세기는 아직 정할 수 없다.

| ID | 결정 | 근거와 필요한 증거 | 확인 방법 | 시점 |
|---|---|---|---|---|
| D01 | 로컬 실행·추가 서비스 비용 0원 유지 | 사용자의 기존 제약, MVP/기술 설계 | provider 준비·실행 시 외부 추론/유료 fallback 없음 확인 | 지금부터 모든 단계 |
| D02 | Core만 지속 상태의 writer | 기존 도메인·DB·AI 계약 | 위조 patch/source·stale·중복 입력의 거절 검사 | 설계 경계는 지금, 구현 증거는 후속 |
| D03 | 모델 교체와 상태/history 수명 분리 | 캐릭터 지속성 목표 | 모델 변경 전후 canonical/history 비교 | 계약은 지금, 실제 이식은 G5 |
| D04 | 네 감정·pleasantness·관계 근거를 기본으로 유지 | 승인 MVP와 구체 도메인 수식 | 기존 도메인 fixture를 기준선으로 사용 | 지금 |
| D05 | Canonical을 기존 상태의 읽기 projection으로 제안 | 상태 원본 중복 방지 | 동일 snapshot+시각의 동일 projection, 읽기 부작용 0 | 연구 계약 동결 때 |
| D06 | Activation steering은 선택적 provider 기능 | 필수로 삼을 근거 없음 | context만으로도 동작하는 baseline 유지 | 지금 |
| D07 | 연구 결과를 실제 구현 완료로 표시하지 않음 | 현재는 P00–P01만 구현 | 코드/fixture/실모델/사용자 평가 증거 분리 | 모든 보고 |
| D08 | 기존 MVP·DB·root dependencies·OmniVoice 환경 유지 | 이번 요청은 문서·R&D 패키지 | 변경 파일 범위 확인 | 이번 작업 |

API-only adapter의 논리적 호환성을 설계해도 현재 유료·원격 provider 사용이 허용되는 것은 아니다. 문헌의 API 실험을 재현하기 위해 예산 조건을 바꾸지 않는다.

## 2. 아직 결정하면 안 되는 사항

| ID | 미결 결정 | 필요한 증거 | 실험 | 결정 시점 |
|---|---|---|---|---|
| U01 | VAD 전체 또는 hurt/vigilance 등 축 추가 | 기존 상태로 설명 못 하는 반복된 행동 사례, 축 제거 시 성능 하락 | 기존 변수 vs 단일 추가 축 ablation | G1 이후 |
| U02 | trust 통합 점수·attachment | 근거 목록/affinity/familiarity보다 설명력이 높고 과잉 관계 추론 없음 | 상대·활동별 도움/오류/부재 시나리오 | 관계 근거 기준선 통과 후 |
| U03 | scar를 제품에 넣을지 | 유효 trigger·회복·정정·대상 구분과 사람 평가에서의 가치 | baseline vs trace, 긍정 trace 포함 | G2 |
| U04 | sensitization과 habituation resistance를 모두 둘지 | 각각의 독립적 기여 | 두 옵션 제거 ablation, 장기 포화 궤적 | 단순 trace G2 통과 후 |
| U05 | affect-aware retrieval·embedding 도입 | 현재 필터+활동/상대 검색이 놓치는 구체적 유효 기억 | tags 기준선 vs 재순위화 vs embedding | G2, 주제 무관 검색 증가 시 보류 |
| U06 | memory-conditioned appraisal | state modifier만으로 해결되지 않는 해석 문제 | 동일 사건의 근거 정확도·오분류 비교, 삭제 전파 검사 | G2 이후 별도 계약 검토 |
| U07 | HF 실행기·steering framework 확정 | 정확한 모델 지원, 0-vector 동등성, 요청 간 오염 없음, VRAM 측정 | 작은 로컬 모델 smoke + baseline | G3 |
| U08 | 벡터 이름·layer·alpha·token 위치 | held-out 구별, 인과 효과, 관련 개념 대조, 부작용 | 후보 발견/개입/fingerprint | G3–G4, 감정 이름은 마지막 |
| U09 | 이미 공개된 벡터의 재사용 | checkpoint·tokenizer·layer·정규화·라이선스 호환 및 재검증 | 같은/다른 revision·양자화 비교 | G3 |
| U10 | learned latent mapper, VAE, 다축 혼합 | 단일 벡터·고정 mapping이 반복해서 실패한 증거 | 단순 mapping과 같은 budget 비교 | G4 뒤에도 필요할 때 |
| U11 | 연구용 LLM 판단을 제품 행동 선택에 반영 | Core 정책보다 유용하고 권한·사실 경계 유지 | shadow 판단 비교 후 제한된 action 후보 평가 | G4 이후 별도 MVP/도메인 변경 |
| U12 | 저장 schema의 trace 컬럼/테이블 | 실제 조회·수명·삭제 요구가 기존 주석으로 불충분 | fixture→schema 영향·transaction 검토 | G2 채택 후, migration 전에 |
| U13 | 실시간 음성 경로에 steering 통합 | TTS·VRM/OBS 공존 VRAM, 전체 지연·취소 검증 | 실제 통합 M0/M3 검증 | G4–G5 및 기존 성능 gate 고정 후 |

“논문이 존재한다”, “GPU에 올라간다”, “상처처럼 말한다”는 위 결정의 충분한 증거가 아니다. 수치가 잘 맞아 보여도 데이터 분할과 합격 기준을 결과 후에 바꿨다면 탐색 결과로만 남긴다.

## 3. 단계별 gate와 탈락 경로

아래 G0의 조사만 이번 문서 작업에서 수행했다. G1–G5는 `NOT_RUN`이다. 수치 문턱은 [R&D §7](./REPRESENTATION_STEERING_RND.md)의 **제안값**이며 실행 전에 고정해야 한다. 기존 제품의 `performance gate UNFROZEN`을 대체하지 않는다.

| Gate | 판단할 것 | 통과에 필요한 증거 | 실패/미결 시 |
|---|---|---|---|
| G0 현황·문헌 | 실제 코드와 논문이 존재하고 범위를 구분했는가 | 파일·symbol, 원문 URL·버전, source limitations | 미확인 주장은 후보로만 유지 |
| G1 단순 상태 기준선 | 새 축 없이 지속 상태를 올바르게 계산·전달 가능한가 | 결정성·감쇠·중복·identity·정정 불변조건, context baseline | 상태/입력 품질부터 수정. steering으로 우회하지 않음 |
| G2 trace/검색 가치 | 기존 기억보다 일관성이 좋아지고 오작동이 늘지 않는가 | baseline 대비 유효 기억·행동 이득, 회복·삭제·대상 구분, 작은 사람 평가 | trace와 검색을 각각 제거하거나 보류 |
| G3 모델 개입 타당성 | hook 가능한 작은 로컬 모델에서 검증 가능한 방향인가 | zero-vector 비교, 독립 split 구별, 모델·벡터 manifest, 피크 자원 | 작은 모델에서 plumbing만 증명하거나 중단 |
| G4 추가 행동 효과 | 같은 backend의 context baseline을 넘어서는가 | 사전 rubric 행동 +10%p 후보, CI, random/related controls, capability/경계 보존 | 문체만 또는 generic effect면 특수 감정 steering 기각 |
| G5 이식·운영 가치 | 다른 모델·실제 runtime에서도 쓸 가치가 있는가 | 별도 calibration, 상태/history 동일, 한국어 품질·취소·공존 측정 | 오프라인 연구로 한정, 제품은 context 유지 |

통과는 단계 범위 안에서만 유효하다. G3에서 작은 Qwen이 성공해도 Qwen 7B·Gemma·한국어 대화·OmniVoice 통합이 성공한 것이 아니다. 사람 평가가 없으면 “인간다움 향상”은 미확인으로 남긴다.

## 4. 비용과 실험 예산의 결정

첫 검증은 모델 없는 CPU trajectory다. 두 번째는 이미 설치된 모델의 짧은 텍스트 context 실험이다. Hook 실험은 이 둘과 독립적으로 설치·호환성 위험을 기록하며 TTS를 포함하지 않는다.

표본·layer·alpha sweep는 [R&D §6](./REPRESENTATION_STEERING_RND.md)의 작은 시작 예산을 기준으로 한다. 현재 PC에서 실제 속도를 측정하지 않았으므로 “몇 시간 안에 완료” 같은 약속은 하지 않는다. 실행자가 파일럿의 처리 시간·메모리로 전체 비용을 추산하고 확대 전에 상한을 기록한다.

새 모델이 필요한 경우 무료 checkpoint의 모델명·라이선스·디스크 크기·경로·필요 이유를 먼저 확정한다. 실행 환경이 없으면 문서·데이터 설계는 계속 진행하되 실험은 BLOCKED로 기록한다. 서비스 요금 0원은 전력·인터넷·디스크·작업 시간이 사라진다는 뜻이 아니다.

## 5. 이 방향에 대한 비판적 검토

### 1. 더 인간답게 만드는가, 복잡성만 늘리는가?

아직 모른다. 상태가 남는다는 사실은 일관성의 필요조건일 수 있지만 충분조건은 아니다. 부정 감정이 오래가거나 같은 기억을 반복 언급하면 오히려 단조롭고 피곤한 캐릭터가 된다. 현재 MVP의 공동 경험·대상 구분·다음 만남을 먼저 검증하고, 같은 대화를 조건을 가려 비교해야 한다. 변수 추가보다 원인 추적과 적절한 회복이 우선이다.

### 2. JEV-like appraisal + persistent Core만으로 충분할 가능성은?

충분히 있다. 감정 숫자, 관계 근거, 활동 목표, 검색된 기억을 Core가 관리하면 모델이 세션마다 마음대로 관계를 초기화하는 문제의 상당 부분은 구조적으로 다룰 수 있다. 이 접근 자체도 아직 실제 코드로 검증하지 않았다. 따라서 steering을 필수 전제로 삼는 것은 현재 단계에서 근거가 부족하다.

### 3. Steering이 줄 수 있는 실제 이점은 무엇인가?

가능한 이점은 같은 근거·문맥에서 모델의 선택이 목표 상태에 더 안정적으로 반응하거나, 긴 상태 설명 없이도 효과를 유지하는 것이다. 모두 가설이다. 목표 행동만 늘고 facts/한국어/추론 능력이 유지되는지, context 대비 추가 이득과 hook 운영 비용을 함께 봐야 한다. 상태를 보존하는 능력 자체는 외부 Core의 역할이며 steering의 공로가 아니다.

### 4. 가장 싸고 빠르게 반증할 가설은?

“상처 기억을 붙이면 같은 맥락에서만 반응이 되살아나고, 무관한 상대·삭제된 출처에는 영향을 주지 않는다”를 CPU fixture로 먼저 검사한다. 재조회만으로 감정이 커지거나 삭제된 trace가 돌아오면 설계가 즉시 반증된다. 이어서 “기존 상태+문맥만으로 행동 차이를 낼 수 없다”는 주장을 기존 모델의 텍스트 기준선으로 시험한다. 둘 다 벡터 추출보다 선행할 수 있다.

### 5. 어떤 결과면 포기해야 하는가?

포기할 단위를 나눈다. Steering의 추가 효과가 없거나 random/부정 방향과 구별되지 않으면 steering을 포기한다. Trace가 적절한 맥락을 구분하지 못하거나 과잉 부정 반응을 만들면 trace를 보류한다. 추가 축이 기존 변수와 같은 결과를 내면 그 축을 제거한다. 지속 상태 자체도 사용자가 납득할 경험 차이를 만들지 못하면 캐릭터 목표와 interaction 설계를 재검토해야 한다. 어떤 경우에도 인상적인 예문을 고르기 위해 alpha나 상처 지속 시간을 계속 올리지 않는다.

### 6. 기존 구현을 가장 적게 건드리는 PoC는?

후속 실행 위임 시 `research/affect-rnd/`의 합성 사건·상태 fixture와 독립 CPU simulator, 읽기 전용 모델 호출 비교만 둔다. 제품 코드·DB schema·root 의존성·OmniVoice 환경은 그대로 유지한다. Activation 실험은 같은 fixture를 읽는 별도 worker로 수행하며 결과는 판단 후보와 측정 로그뿐이다. 제품으로 통합하지 않아도 가설을 반증할 수 있다.

## 6. 연구 결과를 받은 뒤의 결정 기록 양식

```text
decision_id:
claim:
choice: adopt | defer | reject
scope: state | trace | retrieval | steering | model_portability
compared_baseline:
evidence: 원문/소스/run ID와 버전
effect_and_uncertainty:
failed_or_unrun_checks:
cost_and_operational_impact:
affected_contract_owners:
reason_to_prefer_simpler_option:
revisit_trigger:
```

채택되면 해당 결정의 소유 문서와 직접 연결된 계약만 갱신한다. 예를 들어 trace 채택은 MVP 범위·도메인·DB·검증에 영향을 주며, activation 채택은 provider·자원·취소·모델 평가에 영향을 준다. 기존 계획의 완료 표시는 실제 구현·검증이 진행됐을 때만 바꾼다.

이번 산출물은 **채택 판단을 위한 연구 패키지**다. 지금 승인된 MVP를 멈추거나 다축 감정 엔진부터 구현해야 한다는 결론이 아니다.
