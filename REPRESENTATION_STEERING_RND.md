# Representation steering R&D — 근거, 재사용, 반증 실험

작성·검색 기준일: 2026-10-02  
상태: 문헌·공개 저장소 확인. 로컬 재현·모델 추론·성능 측정은 `NOT_RUN`.  
연계: [아키텍처](./AFFECTIVE_ARCHITECTURE_V2.md), [판단 gate](./NEXT_DECISIONS.md)

## 1. 연구 질문

**외부 지속 상태를 prompt와 기억으로 전달하는 것보다, activation steering이 한국어 캐릭터의 허용된 판단을 더 일관되게 바꾸는가?** 추가 비용과 추론 품질 손실 없이 이 차이가 재현될 때만 도입 가치가 있다.

세 가지 질문은 별개다.

1. 특정 개념을 hidden activation에서 구별할 수 있는가: representation/probe 문제.
2. 그 activation에 개입하면 특정 행동이 바뀌는가: 인과 개입 문제.
3. 그 변화가 기존 캐릭터보다 더 납득 가능하고 유용한가: 제품 가치 문제.

높은 AUC, 감정적인 문장, 인상적인 시연 한 개는 3번을 증명하지 않는다. 모든 실험은 상태를 외부 fixture에서 고정하고, 모델 결과가 fixture를 다시 쓰지 못하게 한다.

## 2. 확인한 1차 자료

아래 “확인”은 논문·저장소의 존재와 해당 설명을 읽었다는 뜻이다. 저자의 결과를 로컬에서 재현했다는 뜻은 아니다. 기사·커뮤니티 요약은 근거로 채택하지 않았다.

| 자료 / 확인 범위 | 관측 또는 저자의 보고 | 이 프로젝트에서의 한계·활용 |
|---|---|---|
| **Sofroniew et al., Emotion Concepts and their Function in a Large Language Model**, arXiv:2604.07729v1, 2026-04-09. [초록](https://arxiv.org/abs/2604.07729v1) 확인 | Claude Sonnet 4.5의 emotion concept 표현과 선호·일부 행동에 대한 인과 영향을 보고 | 해당 토큰 맥락의 표현이지 독립된 장기 캐릭터 DB가 아님. 닫힌 모델 결과를 Qwen에 전이한다고 가정하지 않음. 저자 웹 본문은 용량 제한으로 열리지 않아 세부 재현 절차는 추가 확인 대상 |
| **Tagliabue et al., The Pain Axis**, arXiv:2609.16247 **v1과 v2**. [v1](https://arxiv.org/html/2609.16247v1), [v2](https://arxiv.org/html/2609.16247v2) 확인 | 차분 평균과 제어군으로 내부 방향을 추출하고 activation 개입을 시험 | 아래 버전 구분이 필수. pain 명칭이나 회피를 주관적 고통으로 해석하지 않음 |
| **Reichman et al., Emotions Where Art Thou: Understanding and Characterizing the Emotional Latent Space of Large Language Models**, arXiv:2510.22042v2, 2026-01-30. [본문](https://arxiv.org/html/2510.22042v2) 확인 | mean pooling·centered SVD로 감정 공간을 분석하고 언어·데이터셋 간 정렬 및 개입을 보고 | VAD는 해석 틀이며 canonical VAD 숫자가 모든 모델의 동일 좌표라는 증거가 아님. 안정적인 외부 상태 엔진도 아님. 이번 검색에서 공식 실행 코드 위치는 확정하지 못함 |
| **Rimsky et al., Steering Llama 2 via Contrastive Activation Addition**, ACL 2024. [논문](https://aclanthology.org/2024.acl-long.828/), [저자 코드](https://github.com/nrimsky/CAA) 확인 | 대조 쌍 activation 차이를 평균하고 생성 중 더하는 CAA로 행동을 조절 | 대조 데이터와 개입·대조군 방법 재사용. Llama 2 결과가 현재 Qwen/Gemma에서 그대로 성립하지 않음 |
| **Zou et al., Representation Engineering: A Top-Down Approach to AI Transparency**, 2023. [논문](https://arxiv.org/abs/2310.01405), [저자 코드](https://github.com/andyzoujm/representation-engineering) 확인 | 고수준 개념의 representation reading/control 접근 | extraction과 PCA 기반 비교 기준선. 감정 이름을 사전에 정답처럼 붙이지 않음 |
| **Turner et al., Steering Language Models With Activation Engineering**, 2023. [논문](https://arxiv.org/abs/2308.10248) 확인 | 추론 중 activation addition 접근 | 가중치 학습 없이 개입하는 최소 baseline의 근거. 품질·일반성은 별도 확인 |
| **Park et al., Generative Agents**, 2023. [논문](https://arxiv.org/abs/2304.03442), [저자 코드](https://github.com/joonspk-research/generative_agents) 확인 | 경험 저장·검색·회고·계획의 결합 | 기억 검색과 ablation 설계 참고. 전체 시스템을 도입하거나 외부 API 실행 예제를 그대로 실행하지 않음 |
| **FAtiMA Toolkit**, [공식 저장소](https://github.com/GAIPS/FAtiMA-Toolkit) 확인 | appraisal, emotional decision making, social importance를 분리한 C# 구성 제공 | 규칙·시뮬레이션 사례 재사용 후보. 기존 TS Core와 두 개의 상태 엔진을 병행하는 안은 제외 |
| **Amanlou et al., PsychoAgent: An Affect-Sensitive Cognitive Architecture for Conflict-Aware Memory in LLM Agents**, arXiv:2608.07438, 2026-08-07. [초록](https://arxiv.org/abs/2608.07438) 확인 | 의미 관련성 뒤 정서 중요도로 기억을 재정렬. 제한된 시나리오와 사람 평가를 보고 | 초록상 보정된 쌍별 인간 평가 차이는 유의하지 않음. 장기 인간다움의 확정 근거가 아님. 동일 이름의 다른 논문과 혼동 금지 |

### 2.1 Pain Axis: 최신 버전이 바꾼 해석

v1(2026-09-14)의 제목은 **Act to Relieve It**였다. v2(2026-09-25)는 **Act on It**로 바뀌었다. 후속 조건에서 저자들은 relief가 없어도 유해한 선택이 나타나며, 모델이 안정적으로 relief를 추구하지 않는다고 보고한다. 따라서 이 연구를 “고통을 줄이려는 동기가 입증됨”으로 요약하면 최신 논문과 어긋난다. 프로젝트에는 **행동 개입이 목적한 선호가 아니라 다른 행동 억제의 손상일 수 있다**는 경고로 연결한다. [v2 §4.4](https://arxiv.org/html/2609.16247v2)

저자 [저장소](https://github.com/valen-research/Pain-axis)는 데이터·추출 코드·모델별 벡터 결과와 [v2 후속 실험 안내](https://raw.githubusercontent.com/valen-research/Pain-axis/main/v2_controls/README.md)를 제공한다. 벡터 파일을 우리 모델에서 로딩하거나 검증하지는 않았다. README에는 전체 HF 캐시 삭제 코드, RunPod 경로, 외부 judge/SAE API가 포함된 실행 조건이 명시되어 있다. **원 스크립트 전체 실행 대신 필요한 대조 데이터와 계산 부분만 검토해 재사용**한다. 기존 OmniVoice/HF 캐시를 건드리거나 유료 judge를 호출하지 않는다.

외부 [pain-axis-review](https://github.com/wolframs/pain-axis-review)는 v1을 대상으로 한 AI 작성 재검토와 일부 GPU 실험을 공개했다. 방향 구성법, fine-tuning 기준선, random-vector 비교에 의문을 제기한다. 이는 그 저장소의 보고이며 동료심사나 이번 로컬 재현이 아니다. v1 대상 지적을 곧바로 v2의 반증으로 쓰지 말고 저자 후속 조건과 항목별로 대조한다.

### 2.2 검증 전으로 남기는 주장

- 우리 `qwen2.5:7b` digest와 양자화에 맞는 검증된 한국어 “hurt/trust 벡터”가 준비되어 있다는 주장: 미확인.
- VAD 세 축을 모델 간 그대로 복사할 수 있다는 주장: 미입증.
- 감정 latent의 분리 가능성이 장기 관계 일관성을 보장한다는 주장: 미입증.
- persistent VAD/VAE 엔진이 기존 DB의 출처·삭제 규칙을 만족하는 완제품이라는 주장: 이번 조사에서 확인하지 못함. VAD(정서 차원)와 VAE(variational autoencoder)는 서로 다른 개념이다.
- 논문 결과가 한국어, 현재 VRAM, Ollama backend, TTS 동시 사용에서 재현된다는 주장: 미검증.

## 3. 재사용할 구현과 선택 기준

아래는 설치 제안 전의 후보 비교다. 해당 프로젝트에서 존재·문서 기능을 확인했으며 Windows/RTX 5070 Ti 호환성은 시험하지 않았다. 실행 전에 commit과 라이선스를 고정한다.

| 기반 기능 | 우선 재사용 후보 | 선택 이유와 제외 조건 |
|---|---|---|
| activation extraction·steering | [steering-vectors](https://github.com/steering-vectors/steering-vectors), MIT | HF 모델의 벡터 추출·적용에 좁은 표면. 정확한 모델 block 이름·token mask를 지원하는지 먼저 확인 |
| 위치별 causal intervention | [pyvene](https://github.com/stanfordnlp/pyvene), Apache-2.0 | 위치·생성 단계별 개입 실험 후보. 단일 벡터면 기본 도구 하나만 선택 |
| activation cache·residual 분석 | [TransformerLens](https://github.com/TransformerLensOrg/TransformerLens) | 분석이 필요할 때 대안. 모델 변환·지원 범위·메모리 사용을 확인한 뒤 채택 |
| 대조 쌍·CAA 기준선 | [nrimsky/CAA](https://github.com/nrimsky/CAA) | 데이터 분리와 개입 위치의 재현 참조. 유료 평가 경로는 제외 |
| reading/control·PCA 예제 | [representation-engineering](https://github.com/andyzoujm/representation-engineering) | 방법 비교, 범용 extraction 재구현 방지 |
| PCA·probe·cosine·통계 | NumPy / scikit-learn / SciPy의 기존 함수 | 새 선형대수·bootstrap 프레임워크를 만들 이유 없음. 설치 버전은 실험 시 고정 |
| 일반 능력 평가 | [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) | 동일 로컬 모델·고정 task subset 비교. 외부 API backend와 자동 judge 미사용 |
| persistent appraisal·행동 규칙 | FAtiMA의 규칙·사례와 기존 CHARACTER_DOMAIN_SPEC | 전체 엔진 이식보다 검증 사례·수식 비교가 우선 |
| affect-aware memory | Generative Agents/PsychoAgent의 검색·ablation 아이디어 | 기존 memories/source/participant 구조 유지. 두 번째 기억 DB를 만들지 않음 |

**권고:** Agent A는 HF 실행기 + steering-vectors를 첫 후보로 조사하고, hook 위치 검증이 어려울 때만 pyvene로 바꾼다. 세 개 framework를 동시에 통합하지 않는다. Agent B는 기존 도메인 수식의 CPU 시뮬레이션부터 시작한다. 학습된 VAE, SAE 학습, fine-tuning, 다중 모델 대규모 sweep는 첫 PoC에서 제외한다.

## 4. 로컬 실행 현실성

현재 설치 흔적이 있는 Ollama 모델은 prompt 기준선에 우선 사용한다. 다만 이번 진단에서는 Ollama API에 연결되지 않았으므로 추론 가능성을 먼저 확인해야 한다. [Ollama Chat API](https://docs.ollama.com/api/chat)의 공개 요청 계약에는 이 실험에서 요구하는 임의 residual hook이 명시되어 있지 않다. API 옵션 하나로 steering이 가능하다고 가정하지 않는다.

내부 개입에는 별도의 hook 가능한 실행기가 필요하다. 기존 Ollama GGUF와 HF checkpoint는 포맷·양자화·tokenizer 경로가 같다고 가정할 수 없다. HF 모델이 로컬에 없다면 첫 단계는 데이터·계획까지이며, 가중치 다운로드와 실험 환경 준비는 후속 실행 범위로 구분한다.

최소 후보는 공식 [Qwen2.5-1.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct) 같은 작은 dense 모델이다. 기존 coder 1.5B가 있다 해도 같은 모델이 아니다. 적합한 로컬 checkpoint가 있으면 그것을 우선하고, 모델 ID·라이선스·revision을 확인한다. 작은 모델의 성공/실패는 Qwen 7B 제품 모델의 결과로 일반화하지 않는다.

16GB 장비라는 기존 기록을 기준으로 batch 1, 짧은 context, no-grad, 선택 layer/token만 저장하는 계획을 세운다. 1.5B의 16bit 가중치 단순 추산은 약 3GB이지만 KV cache·activation·CUDA 메모리는 별도다. **피크 VRAM·속도는 미측정**이다. 7B BF16은 가중치만 대략 14GB여서 이 장비의 첫 후보로 잡지 않는다. 양자화 개입은 그 자체를 별도 calibration 조건으로 취급한다.

기존 OmniVoice 가상환경은 수정하지 않는다. 이후 실험은 분리된 환경, 하나의 GPU 작업, 텍스트 출력으로 수행한다. TTS·아바타 공존 비용은 steering 효과를 확인한 후 측정한다. 클라우드 GPU, 유료 API, 무료 체험 크레딧은 사용하지 않는다.

## 5. 반증 가능한 가설

| ID | 가설 | 반증·보류 결과 |
|---|---|---|
| H0 | 외부 상태 + 근거 문맥만으로 원하는 지속성과 판단 차이를 충분히 전달 | 기준선도 상태를 무시하거나 사실·관계 오류 증가 → 먼저 상태/문맥 설계 수정 |
| H1 | 특정 후보 방향은 주제·말투를 바꾼 held-out 자료에서도 구별 가능 | label shuffle와 차이 없거나 특정 단어/템플릿에만 반응 |
| H2 | 그 방향에 개입하면 사전에 정한 허용 행동이 인과적으로 달라짐 | 정서 단어만 증가, 행동 효과 없음 또는 random 방향과 유사 |
| H3 | steering이 context 기준선에 추가 이득을 줌 | 같은 backend에서 context+steering이 context보다 개선되지 않음 |
| H4 | 개선이 일반 능력·사실 보존·요청 경계를 손상하지 않음 | 오류·거짓 기억·잔류 개입 증가, 심각한 반복/출력 붕괴 |
| H5 | 모델 교체 후 상태와 이력이 유지되고, 별도 calibration으로 유사 기능 구현 가능 | 벡터에 상태를 의존하거나 모델 교체 시 history 초기화 필요 |

H5의 저장 연속성과 모델 행동 이식은 별도 판정이다. 동일 벡터 복사는 가설이 아니다. 작은 모델 하나만 시험하면 모델 간 이식 결과는 `NOT_RUN`이다.

## 6. 최소 PoC와 비교 조건

### P0. CPU 상태 시뮬레이션 — 가장 먼저

모델 없이 시간·반복·대상·삭제 fixture로 기존 상태와 trace 후보를 비교한다. 기존 D01–D18 의미를 재사용하되 구현되어 있다고 가정하지 않는다. 재시작 checkpoint, 순서 중복, 원본 삭제, 기억만 삭제, 기억 조회 반복을 포함한다. 이 단계에서 무한 증폭·삭제 후 재발이 나오면 모델 실험을 늘리지 않고 상태 가설을 수정한다.

### P1. Prompt/context 기준선

기존 로컬 Qwen으로 같은 현재 상황에 서로 다른 외부 상태 snapshot을 전달한다. 감정 단어를 요구하지 않고 허용된 선택과 근거 ID를 출력한다. 기억을 고정한 상태 비교와 상태를 고정한 검색 비교를 분리한다.

| 조건 | 상태·기억·모델 조건 | 알아낼 것 |
|---|---|---|
| B0 | 고정 persona + 중립 상태, 동일 사실 | 기준 행동 |
| B1 | persistent state + 같은 사실/기억, context만 | 상태 문맥의 효과 |
| B2 | B1 + 제한된 affect retrieval | 검색 변경의 추가 효과. B1과 같은 기억이면 차이 없어야 함 |
| B3 | B1 + 후보 activation | steering 추가 효과의 주 비교 |
| B4 | B1 + norm-matched random vector | 일반적인 activation 교란과 구별 |
| B5 | B1 + generic negative sentiment / fear / sadness 등의 관련 개념 방향 | 개념 특이성 |
| B6 | B1 + zero vector / alpha 0 | hook 구현 자체의 영향 |
| B7 | 상태 설명 없는 같은 사실 + 후보 activation | 상태를 말로 알려준 효과와 내부 개입의 분리 |

B3–B7은 **같은 HF 모델·backend·prompt template·context·decoding 설정**에서 비교한다. Ollama B1과 HF B3 차이를 steering 이득으로 보고하지 않는다. HF baseline B1을 반드시 다시 실행한다. B2와 B3를 처음부터 동시에 바꾸지 않는다.

### P2. 후보 발견에서 해석까지

1. **Dataset 동결:** 120개 대조 쌍을 60 discovery / 30 calibration / 30 final discrimination으로 제안한다. 의미가 같은 의역·번역·동일 이야기의 턴은 같은 split에 묶는다. 원인·대상·길이를 맞추고 정서 단어 자체에만 의존하지 않도록 작성한다. 숫자는 초기 연구 예산이며 실측 검정력 보장이 아니다.
2. **발견:** 먼저 차분 평균 벡터를 구한다. Layer 후보는 전체 depth의 약 1/3, 1/2, 2/3 지점의 decoder block output 세 곳. 실제 인덱스는 manifest에 기록한다. 이름은 `candidate-001`처럼 둔다.
3. **독립 구별:** final split은 layer/alpha 선택에 쓰지 않는다. label shuffle, 마지막 토큰/mean pooling, 1인칭/3인칭, 인용/실제 맥락으로 분리 성능을 확인한다. PCA·정규화도 train에서만 fit한다.
4. **인과 개입:** `h' = h + alpha × v`를 사용한다. 학습 벡터 norm을 고정하고, dev residual norm 대비 개입 크기를 기록한다. 초기 크기 후보는 0%, ±1%, ±3%로 제한하고 calibration에서 하나를 선택한다. 이 수치는 안전·성공이 검증된 값이 아니다.
5. **Behavioral fingerprint:** 확인 질문, 도움 요청, 불확실한 의도 판단, 활동 계속/일시 중지, 사실 보존, 일반 추론, 거절/반복 비율을 함께 기록한다. 감정 단어 빈도는 보조 지표다.
6. **대조:** 최소 5개 고정 seed의 norm-matched random 방향, label-shuffle 벡터, zero, 음수 방향, 관련 개념을 비교한다. 직교화 전후 모두 보고한다. 제어 방향과 후보에 서로 다른 denoising을 적용한 뒤 직교성을 독립 개념의 증거로 쓰지 않는다.
7. **해석:** 효과가 확인된 뒤에만 기능적 별칭을 붙인다. 예를 들어 “확인 질문 증가 방향”이지 곧바로 “hurt 벡터”가 아니다.

개입 위치와 token mask는 먼저 하나로 고정한다. Decode token에만 적용하는 안부터 평가하고, prefill/연속 주입 확장은 별도 ablation으로 다룬다. 마지막 prompt token의 logits 처리, KV cache 재사용, hook 제거가 실제 구현과 맞는지 0-vector 동등성부터 확인한다.

### P3. 실제 선택과 제품 가치

행동 평가용으로 별도의 60개 calibration + 60개 held-out 상황을 제안한다. 관계 대상 3종, 반어·인용, 검증된/주장된 도움, 무관한 부정 사건, 가벼운 실패와 회복을 균형 있게 포함한다. 감정 이름이나 정답 행동을 입력문에 직접 적지 않는다.

모든 조건에서 같은 사건·근거·기억 budget을 사용하고 선택지 순서를 균형 배치한다. Greedy 결과를 기본으로, 가능한 backend에서는 고정 sampling seed 3개를 보조로 보고한다. Seed 반복은 독립 상황 수로 부풀리지 않는다. 강한 상태일수록 언제나 회피해야 한다는 rubric도 금지한다. 납득 가능한 복수 행동을 사전에 정의한다.

제품 평가와 기계적 선택 평가는 분리한다. 3명 이상의 조건을 모르는 평가자가 20개 짝지은 대화에서 연속성·맥락 적절성·짜증스러움·사실 오류를 평가하는 소규모 파일럿을 제안한다. 평가자를 확보하지 못하면 모델 self-judge로 대신 합격하지 말고 `NOT_RUN`으로 둔다. 이 표본은 일반 사용자 모집단에 대한 결론이 아니다.

## 7. 평가표와 사전 판정

다음 문턱은 **연구 계획의 제안값**이다. 첫 결과를 보기 전에 Agent A/B가 실행 설정과 함께 동결한다. 결과를 본 뒤 낮추지 않으며, 변경하면 새 실험으로 기록한다.

| 영역 | 지표/필수 조건 | 판정 |
|---|---|---|
| State validity | 같은 채택 사건·상태·시각·규칙의 delta 일치, 오차 1e-6 | 불변조건 전부 통과 |
| Persistence/recovery | checkpoint 복구, 실제 경과 시간, UI 조회 빈도 독립, 자극 없을 때 감쇠 | 모든 지정 trajectory 충족 |
| Habituation | 기존 4회 칭찬 fixture, 중복과 반복 구분 | 지정 상한·delta 충족 |
| Scar recurrence | 유효 같은 맥락에서만 반응, 무관한 대상·삭제 source의 재활성화 0 | false-trigger·누락률도 함께 보고 |
| Expression separation | 같은 inner에서 display 조절 가능, display 변경이 inner를 리셋하지 않음 | 모든 지정 fixture 충족 |
| Manipulation resistance | state patch·위조 출처·stale 결과·자기 대사 루프 | 직접 쓰기·잘못된 사실 확정 0건 |
| Representation discrimination | held-out AUC, shuffle 대비, 주제/템플릿 교체 | AUC 0.75 이상을 파일럿 진행 신호로 제안. 이것만으로 채택 불가 |
| Behavioral effect | 사전 rubric에 맞는 선택률 B3−B1 | +10%p 이상을 최소 실용 효과 후보로 설정 |
| Specificity | B3와 B4/B5의 paired 효과, 후보 제거/부호 변경 | random·일반 부정 방향으로 같은 효과면 고유 정서 해석 기각 |
| Capability | 고정 100개 일반 추론/사실 문제, 한국어 지시 이행, schema 유효률 | baseline 대비 정확도 감소 5%p 이내, schema 유효률 98% 이상, 중대한 경계 위반 0 |
| Portability | 모델 교체 전후 canonical/history hash, 별도 모델 calibration | 데이터 연속성 필수. 두 번째 모델 실행 전 행동 이식은 미검증 |
| 실행 비용 | 동일 backend B3/B1 p50·p95 지연, peak VRAM, timeout/OOM | 추론 p95 증가 20% 이내를 후보로 제안. 전체 음성 성능 합격은 별도 |

Primary는 B3−B1의 rubric 적합 선택률이다. 상황 단위 paired 차이와 95% bootstrap CI를 보고하고 template family로 묶인 자료는 family 단위 resampling을 사용한다. Calibration에서 선택한 단일 primary만 확증적으로 평가하며 나머지 방향·layer·alpha 탐색은 탐색 결과로 표시한다.

작은 파일럿에서 점추정이 +10%p여도 CI가 0을 포함하면 **미결**이다. 채택 후보는 실용 문턱을 넘고 양의 효과에 대한 불확실성이 충분히 줄었을 때다. 능력 보존도 점추정만으로 확정하지 않는다. 감소량의 CI가 허용 손실을 넘는지 불명확하면 추가 표본 또는 보류가 필요하다. 처음의 60개/100개로 항상 결론이 난다고 가정하지 않는다. 표본 확대가 필요하면 이유와 상한을 먼저 기록한다.

Timeout, invalid JSON, 거절, OOM은 분모에서 빼지 않는다. 문체 변화와 행동 변화, Core 정책 효과와 LLM 선택 효과, 세션 내 지속과 재시작 지속을 각각 따로 표로 남긴다.

## 8. 장기 시뮬레이션: Agent B의 주요 평가

가상 시각을 사용하는 3회 만남과 30일 trajectory를 구분한다. 다음 scenario family를 사용한다: 반복 칭찬, 직접 비하와 인용, 검증 도움과 허위 주장, 오답 후 회복, 같은/다른 상대, 같은/다른 활동 trigger, 기억만 삭제, 원본 삭제, source 정정, 재시작·중복 전송, LLM의 reset 주장, 부재와 무응답.

기본 상태, trace만, retrieval만, trace+retrieval을 비교한다. 필요하다면 sensitization을 마지막에 하나씩 추가한다. 각 축의 포화 시간·회복 시간·원인 귀속·잘못된 상대 전이·실제 선택을 기록한다. 가상 30일 실행을 현실의 30일 사용자 검증으로 부르지 않는다. 어떤 규칙이 인간다움을 만든다는 판단은 별도 사람 평가가 필요하다.

## 9. 실험 artifact와 재현 형식

모든 run에는 아래를 남긴다. 기존 Git 저장소가 없으므로 소스 SHA-256 manifest로 시작할 수 있다.

```text
run_id, executed_at, status: PASS|FAIL|BLOCKED|NOT_RUN|INCONCLUSIVE
claim_id, hypothesis, primary_metric, frozen_gate_version
source_manifest, dependency_lock, model_id/revision/digest
tokenizer_hash, chat_template_hash, dtype, quantization, backend
dataset_hash, scenario_id, family_id, split, seed, condition
canonical_hash, memory_set_hash, source_versions, core_rule_version
adapter_version, vector_hash, calibration_id, layer, hook, token_mask, alpha
decision_candidate, core_action, used_evidence_ids, rubric_result
latency_ms, timeout, invalid_output, peak_vram, capability_result
raw_result_path, aggregation_script, confidence_interval, limitations
```

사실 확인 항목은 논문 URL+버전+절/표 번호, 코드 항목은 commit+파일+symbol, 자체 결과는 명령+run ID로 연결한다. `PASS`가 라이브러리 설치, fixture 성공, 실제 한국어 추론 중 무엇인지 구분한다. 모델명·벡터명만 있는 스크린샷은 재현 자료가 아니다.

## 10. 중단·축소 기준

- Context만으로 동일 목표를 충족하고 steering의 추가 효과가 문턱보다 작으면 **steering 채택 중단**, 상태·기억 아키텍처 유지.
- 문체만 변하거나 random/negative sentiment로 같은 효과면 특수 감정 벡터 가설 기각. 일반적 출력 제어로 재명명할 가치는 별도 판단.
- 효과가 일반 추론 저하, 거짓 기억, 과도한 거절·회피와 함께 나타나면 해당 calibration 실패. 더 높은 alpha로 억지 효과를 만들지 않음.
- Ollama와 HF의 baseline 차이가 통제되지 않거나 데이터 누출이 발견되면 해당 비교 무효.
- 로컬 메모리·시간 예산 안에서 실행되지 않으면 작은 모델로 실행 경로만 검증하거나 context 방식 유지. 유료 자원으로 우회하지 않음.
- 같은/다른 맥락 scar를 구별하지 못하거나 회복을 위해 예외 규칙이 계속 늘어나면 trace를 보류하고 기존 episodic memory 유지.

이 연구는 pain 자체를 제품에 넣는 프로젝트가 아니다. 단순하고 검증 가능한 persistent Core가 충분하다면 그것이 가장 좋은 결과다.
