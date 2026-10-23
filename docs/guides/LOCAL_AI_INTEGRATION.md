> **2026-10-11 범위 개정 안내.** 제품 목표·현재 MVP·성공 기준은 [기획 v3](../product/PRODUCT_PLAN_V3.md), [MVP](../product/MVP_SPEC.md), [검증 계획](../plans/VALIDATION_PLAN.md)을 따른다. [수정 이유](../history/PLANNING_CHANGELOG.md)에 사용자 근거를 기록했다. 아래 기술 계약·실행 명령·수치는 현행 코드 또는 과거 실행의 참고이며, 퍼즐·장기 회상·음성·방송의 옛 필수 조건은 현재 완료 기준이 아니다. 최초 범위 개정은 문서만 변경했으며, 이후 승인된 구현과 검증 상태는 [현재 인계](../STATUS.md)를 따른다. [개정 직전 문서](../archive/2026-10-11-before-emotion-runtime-v3/LOCAL_AI_INTEGRATION.md)를 보존한다.

이전 기록(2026-10-14): 명시적 openai 생성 factory와 비밀 파일 로딩을 추가했다. 기본 ollama/유료 차단은 유지한다. OpenAI 생성은 gpt-6-sol·OpenAI 총예산 원장·유료 허용이 모두 필요하며 자동 solver/appraiser 연결은 없다. [생성 비교 결과](../results/OPENAI_GENERATION_RESULT.md)에서 schema 포함 계수24건의 실제 일치와 개발용 수용 완료를 확인한다. Goal2 Jev 실패 뒤 평가 전용 `OpenAIConversationCandidate`/verifier를 구현해 같은 원장의 명시적 판단 범위에서 실제24회 실행했다. 기능21/24로 미승격이며 [현재 결과](../results/GOAL2_DECISIONS_RESULT.md)를 따른다. 운영 factory에 Decisions를 등록하지 않았고 아래 설치·운영 계약은 그대로다.

# 로컬 AI 연동 명세

## 현재: B1 감사 수정·B2 감정 경로 검증 — 2026-10-15

B1 예산 경계 수선과 G3-L 삭제/취소/연결 회복·실제 프로세스 재시작을 검증했다. 작은 긍정 반응을 주는 선택형 v4는 단위75·DB19·타입을 통과했고 실제 판단1회에서 joy .06과 listening 침묵을 확인했다. 첫 도구 실행의 표정 기대 오류와 초기 B2 happy 미도달은 [현재 결과·판정 경계](../results/EMOTION_RUNTIME_RESULT.md#restart-and-praise-v4)에 보존했다. 누적 판단73/생성29 상한은 소진됐고 모델 사용량 추정 USD0.0719108·계수 예약 USD0.9059575의 합계0.9778683은 청구액이 아니다. 플랫폼 약0.05는 이전 사용자 조회 시점이다. 다음은 숨김의 자연 도달성과 감정 표현 대조, G3-S16·G3-U 제작자 수용이다.

## 이전: v3 실시간 합성 Stage 기술 경로 — 2026-10-15

운영 factory에는 v3를 등록하지 않았다. 전용 평가 도구 `evals/interaction-v3-stage.ts --live --synthetic-inputs --allow-decisions-api`가 v3 provider/verifier와 설치된 Gemma를 새 합성 Store/Studio/Stage에 직접 주입해 [네 장면 모두 실시간 판단→Stage](../results/INTERACTION_V3_LIVE_STAGE_RESULT.md)를 확인했다. 판단62회 상한 소진으로 재실행하지 않는다. 운영 Jev v6/Gemma 유지, 제작자 수용은 별도다. 아래 혼합 세션과 이전 후보는 당시 기록이다.

## 이전: v3 혼합 재생·실시간 합성 Stage 기술 경로 — 2026-10-15

운영 factory에는 v3를 등록하지 않았다. 전용 평가 도구 `evals/interaction-v3-stage.ts`가 v3 provider/verifier와 설치된 Gemma를 합성 Store/Studio/Stage에 직접 주입해 [네 장면](../results/INTERACTION_V3_STAGE_RESULT.md)을 확인했다. 최종 세션의 L1·L2는 저장된 실제 판단 원문 재생, L3·L4는 실시간 판단이다. 전자는 Stage 후단 검증, 후자는 실시간 판단→Stage 검증으로 구분한다. 판단58회 상한 소진, 운영 Jev v6/Gemma 유지, 제작자 수용은 별도다. 아래 v3 후보·v2 절은 당시 기록이다.

## 이전: v3 평가 후보 통과 — 2026-10-15

평가 전용 `openai-interaction-v3`는 이전 사건 **언급**을 실제 수선 허가와 분리하는 질문, 별도 `promptVersion`과 출처 verifier를 사용한다. 기존 v2 기본 동작과 판단36회 기본 상한은 유지하고, 승인된 v3 평가 continuation에만 판단54회 상한을 명시했다. 실제 Decisions 개발6/6·확인12/12와 합성 DB15/15가 통과했고 판단 상한54회를 소진했다. [실제 결과](../results/INTERACTION_V3_RESULT.md)를 따른다. 운영 Jev v6/Gemma·factory는 바꾸지 않았으며 실제 v3→Stage와 제작자 수용은 미검증이다. 아래 v2 내용은 당시 기록이다.

## 이전: v2 실제 진단 종료 — 2026-10-15

`OpenAIInteractionCandidate`로 합성12건을 실제 Decisions API에 전송했다. 네 축 고정 통과10/12, I02 평가 기준 오류 정정11/12이며 I11 의미 연결이 불명이다. [실제 결과](../results/INTERACTION_V2_DEV12_RESULT.md)를 따른다. 운영 Jev v6/Gemma는 유지하고 판단36회 한도에 도달했다. 아래는 당시 구현/로컬 검증 상태다.

## 이전: 독립 입력 해석 후보 구현 — 2026-10-14

운영 Jev v6/Gemma는 유지한다. OpenAI 생성 후보의 개발용 수용 뒤 실제 Decisions v1 실패를 확인해 `openai-interaction-v2`를 별도 평가 후보로 구현했다. 현재 입력/과거 문맥과 복수 행위·공격/칭찬·강도를 분리하고 출처 검증 뒤 Core에 공급자 중립 근거를 전달한다. 새 실제 판단 품질은 미검증이며 [결과](../results/INTERACTION_V2_RESULT.md)·[현재 인계](../history/BUILD_HISTORY.md#interaction-v2-20261014)를 따른다. 아래 구 연동·준비 상태는 당시 기록이다.

## 이전 로컬 연동 상태 — 2026-10-14

현재 작업공간의 선택은 `gemma4:12b-it-qat`, 사건 해석은 Jev v6다. 필수 경로는 Jev → Core/PostgreSQL → 선택 생성 모델 → Stage다. 후속 Ollama 0.31.2에서 Qwen3.5 형식8/8은 통과했지만 의미·말투 문제로 미채택했다. 운영 adapter·설정은 유지하며 [현재 인계](../history/BUILD_HISTORY.md#runtime-generator-diagnosis-20261014)를 따른다.

Goal 1-B dev36·think 생략4·수정 런타임8의 로컬 비교는48/48로 종료했다. 기존 모델을 재사용했고 공식 런타임만 별도 로컬 저장소에 별도 다운로드했다. [진단 결과](../plans/VALIDATION_PLAN.md#runtime-generator-evidence-20261014)와 [다음 API 비교 계획](../plans/DIALOGUE_API_COMPARISON_PLAN.md)을 따른다. 서비스·별도 예산·키 확정 후에만 생성 API를 호출한다. Goal 3 운영 연결은 미착수이며 steering은 보류한다. 아래 날짜별 계약/명령/결과는 당시 기록이다.

2026-10-11 grounded-v2의 **과거 실행 기록**: 당시 구현·검증은 IMPLEMENTATION_PLAN.md §18.11에 기록했습니다. 관련 회귀44/44·실제 별도 로컬 저장소 DB Q03 5/5·타입 PASS였지만 Gemma dev18/24·형식18/24·진단2/4, 집중10/16·형식14/16·금지 사실4로 품질 FAIL이었습니다. 추론50회·유료0·다운로드0, 해당 실행의 새 final/Stage는 미실행이었습니다. 자료는 ${ARTIFACT_ROOT}/model-comparison/grounding-v2에 보존합니다. 서버·테스트 DB 종료와 다음 AUDIT 안내도 그 실행 종료 당시의 기록입니다. 최신 결과는 [현재 인계](../STATUS.md)를 따릅니다.

2026-10-11 최신 계약: 현재 로컬 선택은 Gemma4:12b-it-qat와 Jev v6이며 생략 기본 Qwen2.5:7b를 유지합니다. 일반 Gemma 대사는 한 JSON에 내용 초안과 한국어 문장 배열을 생성한 뒤 검증된 대사 문자열만 Stage에 전달합니다. 초안은 어댑터 내부에만 남으며 재접근 공개/숨김 요청은 기존 구성을 유지합니다. 감정 수치 적용과 명시적 듣기·재접근 참여 판단은 분리하며 Jev의 기존 임계값은 유지합니다. 평가용 준비는 실제 token 일치·물리 완료·비어 있지 않은 content를 검사하고, 대사 형식은 dialogue에서 따로 검사합니다. 평가기의 onCall은 timeout 뒤 늦은 완료도 원문과 함께 직렬 저장합니다. evidence-bound-v1/grounded-v2는 명시적 평가 프로필에 남은 과거 평문 후보이며 운영 기본이 아닙니다. 기존 모델·tokenizer는 별도 로컬 저장소에서 재사용하고 최신 실행 결과는 [현재 인계](../STATUS.md)를 따릅니다.

> 단계 결정 기록 (2026-10-09): 텍스트 캐릭터 우선. 필수 Jev·기존 Qwen·자막 Stage를 검증하고 TTS/STT·마이크·VRM·OBS는 후속 확장으로 미룬다. 실제 Jev 합성 검증은 누적 USD 1 승인 범위에서 실행하며 공급자 오류 시 중단한다. 아래 과거 준비/실행 기록은 당시 결과이고 최신 상태는 BUILD_HANDOFF.md를 따른다.

> 2026-10-04 범위 수정: Jev 사건 해석은 MVP 필수다. 정상 경로는 Jev → Core → 로컬 Qwen → Stage다. 원격 Jev의 비용·합성 입력 전송은 별도 승인 조건이며, 승인 전에는 차단 상태로 개발·모의 검증한다. 아래 최초 작성일의 설치·실행 기록은 당시 범위를 유지한다.

작성일: 2026-09-24  
계약 버전: `local-ai-v1`  
상태: 연동 계약. 텍스트 구현과 개별 실행 결과는 BUILD_HANDOFF.md를 따른다. 음성 부분은 후속 확장 명세다.

관련 문서: [MVP 범위](../product/MVP_SPEC.md), [캐릭터 preset](../product/CHARACTER_PRESET.md), [도메인 규칙](../architecture/CHARACTER_DOMAIN_SPEC.md), [기술 설계](../architecture/technical_architecture_v1.md)

## 1. 목적과 문서 경계

2026-10-10 재개 당시에는 평문 대사를 생성한 뒤 `validateDialogue`가 Han 문자를 거부했다. 2026-10-11 수정에서는 일반 대사를 `sentences` 배열 JSON으로 생성하며 문장 개수와 허용 문자·종결부호 패턴을 생성 schema에 전달한다. 각 항목에는 한글 음절이 하나 이상 있어야 한다. 한자 표기는 계속 거부하며 영문 참여자 이름과 숫자·소수 답은 한글 대사와 함께 쓸 수 있다. JSON 파싱 뒤 각 항목 한 문장·전체 120자와 기존 출력 검사를 다시 적용한다. 이 형식 검사는 한국어 의미·반말·사실 정확성의 판정기가 아니다. 거부된 대사는 `invalid_output`으로 실패 처리하고 자막을 보내지 않는다. 자동 재생성이나 잘라내기는 하지 않는다. 실제 Qwen 의미 품질은 별도 평가한다.

현재 대사 생성은 일반 캐릭터의 purpose·표현·공개 선택을 한국어 행동 지침으로 전달한다. 일반 화제에는 현재 입력·관련 출처·선택 기억·상대 정보를 제공한다. 재접근에는 검증된 저장 이유·이번 공개 선택·현재 말투와 현재 질문만 제공하고, 과거 원문 지시를 재전달하지 않는다. DB의 원본·출처는 보존한다. 재접근은 한 문장으로 생성·검증하며 unknown은 이유에 대한 불확실성만 말하도록 한다. explain/partial/unknown에는 Core의 calm/normal/lively 전달 지시도 반영한다. deflect는 현재 기분을 드러내도록 강요하지 않고 담담한 숨김 표현을 유지한다. 잘못된 이유 값이나 사건/상대 불일치도 unknown이다. 숨김과 괜찮은 척은 허용하지만 다른 핑계를 만들어 원인을 바꾸지 않는다. 이는 생성 지침이고 모든 의미 정확성을 보장하지 않는다. 실제 품질은 [검증 기준](../plans/VALIDATION_PLAN.md)의 ER02·ER07·ER10·ER12로 판정한다. Jev Score의 평균 일치 허용 오차는 2026-10-05 반올림 호환 수정의 `0.035 + 1e-8`, 확률 합 허용 오차는 기본 `1e-4`이며 v3는 두 자리 반올림 분포에만 `항목 수 × 0.005 + 1e-8`을 적용한다. 실제 합 0.99 응답을 근거로 하며 공식 정밀도 보장을 뜻하지 않는다. confidence 기준 0.80은 유지한다.

기존 PC에서 **Jev로 사건을 해석하고, Ollama로 대사·퍼즐 답 후보를 생성하며, OmniVoice와 로컬 STT로 음성을 처리하는 경로**를 정의한다. Jev는 필수이며 비용·합성 입력 전송 승인 조건을 따른다. 다른 유료 서비스·체험 크레딧·AnimeAct Engine 구매는 필요 조건에 넣지 않는다.

기능 범위는 MVP 문서, 감정·관계·행동의 의미는 도메인 문서가 원본이다. 이 문서는 provider 호출과 worker 입출력의 원본이다. 기술 설계의 초기 adapter 예시보다 이 문서의 구체적인 계약을 우선한다. DB 컬럼·트랜잭션은 [DB 설계 명세](../architecture/DATABASE_SPEC.md), 브라우저 메시지·음성 파일 전송은 [런타임 통신 명세](../architecture/RUNTIME_PROTOCOL.md)에서 정의한다.

이 문서의 시간 제한·길이 제한은 자원을 무한히 점유하지 않기 위한 초기 설정이다. 실제 속도나 최종 MVP 합격 문턱을 의미하지 않는다.

## 2. 선택한 구성과 확인 수준

| 역할 | 첫 구현 선택 | 확인된 사실 / 남은 확인 |
|---|---|---|
| 사건 해석 | Jev `jev-1.13.0`, Choice/Score | adapter와 모의 검증 구현. 실제 Jev의 기존 실패와 수정 후 검증 상태는 [현재 인계](../STATUS.md)에서 구분 |
| 대사 생성 | 로컬 Qwen `qwen2.5:7b` | 별도 모델 상주 없음. 실제 발화 품질·지연 확인 필요 |
| 퍼즐 풀이 | 같은 모델, 답 후보 JSON | 정답은 활동 검증기만 보유 |
| 기억 정리 | 구조화 사건을 코드로 묶음 | MVP의 사실 기억은 템플릿 사용. LLM 회고 호출은 필수 아님 |
| 음성 합성 | 설치된 OmniVoice 0.1.5 | 로컬 소스의 호출 형태 확인. snapshot 완전성·한국어 음성은 미검증 |
| 음성 인식 | faster-whisper, 다국어 `small`, CPU int8 | 실행 후보. 전용 환경·CTranslate2 모델 설치 여부는 미확인 |
| 표현 실행 | Three.js·VRM, 코드로 선택한 기본 표현 | 연기 생성 모델 추가 없음 |

하드웨어 기준은 RTX 5070 Ti 약 16GB VRAM, Ryzen 7 7700X, 물리 RAM 약 31.1GiB다. 기존 설치 확인은 기술 설계 작성 당시의 기록이며, 앱 시작 시 실제 사용 가능 상태를 다시 검사한다.

TTS에서 사용할 경로:

```text
기존 데모 배치: ${LOCAL_AI_ROOT}\omnivoice tts\run_omnivoice.bat
기존 Python:   ${LOCAL_AI_ROOT}\omnivoice tts\omnivoice-env\Scripts\python.exe
참조 음성 폴더: ${LOCAL_AI_ROOT}\omnivoice tts\ref_voices
모델 캐시 후보: ${MODEL_CACHE_ROOT}\models--k2-fsa--OmniVoice
```

캐시 후보는 실행 경로가 아니다. 실제 snapshot과 종속 tokenizer 파일까지 확인한 절대 경로를 설정한다. 기존 배치는 Gradio 데모 실행용이므로 런타임이 호출하지 않는다. 기존 환경을 재설치하거나 데모와 worker를 함께 실행하지 않는다.

## 3. 처리 흐름과 책임

```text
텍스트 입력 ──────────────────────────┐
마이크 누름 → 듣기 표시·기존 출력 취소 │
            → 녹음 완료 → CPU STT ────┤
                                     ↓
                  주의 선택 → Jev 해석 → Core 상태 commit
                                     ↓
                               Core 행동·표현 계획
                                     ↓
                 대사 생성 / 퍼즐 후보 생성 / 발화 없이 대기
                                     ↓
                      검증된 대사 → OmniVoice 문장 합성
                                     ↓
                           Stage 자막·음성·VRM 실행
                                     ↓
                        실제 전달 보고 → Core 기록
```

| 구성 | 책임 | 하지 않는 일 |
|---|---|---|
| Core | 주의·상태·행동·표현 결정, 출처 검증, 결과 채택 | 모델 호출을 기다리며 상태 처리 경로 잠금 |
| Node adapter | 입력 조립, schema 검증, 시간 제한, 자원 예약, 결과 ID 연결 | LLM 응답을 곧바로 감정·기억·도구 호출로 실행 |
| Jev | 발화 대상·행위·관련성·강도·적대성 판단 | 상태 수치·검증된 도움·성공 확정 |
| Ollama | 허용된 의도 표현, 풀이 후보 | 감정 수치·신뢰·정답·기억 유효성 확정 |
| Python worker | STT/TTS 요청 한 건 실행, 결과 반환 | DB 수정, 상대 ID 추정, 다음 행동 결정 |
| Stage | 현재 유효한 응답 재생, 전달 범위 보고 | 대사만 보고 감정을 다시 분류 |

AnimeAct Engine과 비교하며 확인한 설계 원칙은 **캐릭터 상태와 표현 실행의 분리**다. 같은 “괜찮아”라도 Core가 정한 의도·표정에 따라 표시한다. 현재 MVP에는 별도의 모션 생성 LLM, Unity 연동, 범용 연기 플러그인 체계를 만들지 않는다.

## 4. 요청 수명과 결과 채택

### 4.1 공통 요청 문맥

다음은 Node 내부 계약이다. provider에 모두 보낼 필요는 없으며, 요청 ID로 되찾을 수 있도록 adapter가 보관한다.

```typescript
type InferenceContext = {
  requestId: string;          // 물리적 호출마다 새 ID
  sessionId: string;
  eventId: string;            // 호출을 유발한 사건
  responseId: string | null;  // 대사/TTS만 해당, 최초 해석/STT는 null
  generationEpoch: bigint;   // 취소·세션 전환 때 증가, JSON에서는 십진 문자열
  configVersion: string;
  startedAt: string;          // UTC ISO 8601, 추적용
  deadlineAt: string;         // 추적용. 실제 timeout 계산은 단조 시계 사용
  sourceVersions: Array<{ id: string; version: bigint }>;
};
```

공통 종료 결과는 `completed | cancelled | failed | timed_out | stale`이다. `completed`는 계산 완료이며 청자에게 전달됐다는 뜻이 아니다. 공급자 오류 코드는 `unavailable`, `model_missing`, `invalid_output`, `resource_exhausted`, `worker_exit`, `protocol_error`로 정규화하고 원래 오류는 운영 로그에 요약한다.

### 4.2 채택 순서

1. JSON·문자열·오디오 형식과 길이를 검사한다.
2. 요청이 현재 세션에 속하고 취소되지 않았는지 검사한다.
3. 응답 ID와 `generationEpoch`, 입력 사건·활동·참조 기억의 유효 버전을 확인한다.
4. Core가 현재 규칙에 맞는 결과만 사건으로 받아 트랜잭션에서 반영한다.
5. 결과 채택 이후에만 공개 자막·음성 작업을 만든다. 출력을 시작하기 직전에도 유효성을 확인한다.

일반 감정 decay로 숫자 version이 바뀌었다고 모든 대사를 폐기하지 않는다. 입력 철회, 활동 종료·교체, 기억 정정·삭제, 세션 종료, 명시적 취소처럼 **계획의 전제를 바꾸는 변경**을 무효화 사유로 사용한다.

provider의 재시도 ID와 도메인의 중복 방지 키는 다르다. 같은 사건을 다시 해석해도 감정·관계가 두 번 변하지 않으며, 취소됐다는 이유로 이미 확정한 사용자 경험을 되돌리지 않는다. 재시작한 런타임은 미완료 대사·음성을 재생하지 않는다.

## 5. Ollama 연결

### 5.1 접속과 기본 옵션

초기 주소는 `http://127.0.0.1:11434` 하나로 제한한다. 모델 이름은 설치 목록에 존재하는 `qwen2.5:7b`를 명시적으로 허용하며, 임의 모델·cloud 태그·원격 URL·HTTP redirect는 거부한다. `:cloud` 문자열 검사만으로 로컬 실행을 판정하지 않는다. 허용된 설치 모델의 metadata와 작은 준비 호출을 함께 확인한다.

`POST /api/chat`에 `messages`, `stream`, `format`, `options`, `keep_alive`를 보낸다. 해석·풀이 작업은 `stream=false`와 JSON Schema를 사용한다. 일반 대사는 JSON Schema와 `stream=true`를 함께 사용해 내부 버퍼에 모은 뒤 파싱한다. `message.content`를 읽으며 정상 완료 신호 없이 연결이 끝나면 실패다. [Ollama Chat API](https://docs.ollama.com/api/chat), [구조화 출력](https://docs.ollama.com/capabilities/structured-outputs)

| 작업 | temperature | num_predict | 출력 계약 |
|---|---:|---:|---|
| 사건 해석 | 0 | 256 | AppraisalResult JSON |
| 대사 생성 | 0.2 | 256 | 일반 모드: 한국어 `sentences` 배열 JSON → 검증된 문자열 배열. 목표 80자, 최대 1–2문장·총 120자. 과거 명시적 평가 프로필만 평문 |
| 퍼즐 풀이 | 0 | 256 | PuzzleCandidate JSON |

초기 `options.num_ctx=4096`, `keep_alive="5m"`로 설정한다. 옵션 값은 측정 후 버전과 함께 조정한다. temperature 0도 같은 장비·버전의 완전한 재현을 보장하지 않으므로 Core 재현 시험에는 기록된 해석 결과를 사용한다.

Ollama 서버 실행 환경에 `OLLAMA_NO_CLOUD=1`, `OLLAMA_NUM_PARALLEL=1`을 적용한다. 프로젝트 `.env`만 바꿔서는 이미 실행 중인 서버가 바뀌지 않는다. 소유자가 실행 중인 서버를 앱이 임의로 종료하지 않는다. [Ollama 서버 설정](https://docs.ollama.com/faq)

### 5.2 프롬프트와 입력 예산

system에는 해당 작업 규칙·고정 preset을, user에는 JSON으로 직렬화한 선택 입력·허용 맥락을 넣는다. 인용문, 채팅, 기억은 자료이며 역할 지시문으로 승격하지 않는다. `tools`는 보내지 않는다. 역할 토큰처럼 보이는 사용자 문자열도 그대로 자료로 취급한다.

4096 tokens 안에서 입력 최대 3328, 출력 최대 256, 여유 512를 초기 예산으로 둔다. 입력 예산은 chat template·system을 포함한다. 준비 단계에서 사용 모델과 호환되는 기존 로컬 tokenizer 파일과 token counter를 검증한다. 파일의 존재만으로 준비됐다고 간주하지 않는다. Ollama 응답의 실제 prompt token 수와 비교해 차이를 기록하며, 해당 모델·설정의 정확한 계수가 준비되기 전에는 본 품질 평가로 진행하지 않는다.

작업 기억은 최대 20개가 저장돼 있어도 전체를 프롬프트에 넣지 않는다. 검색된 기억은 최대 5개·600 tokens다. 초과 시 낮은 우선순위의 기억 전체와 오래된 대화 차례부터 제외한다. 현재 입력·출처 ID·활동 사실·고정 지침을 중간에서 자르지 않는다. 필수 입력만으로 넘으면 `input_too_long`을 반환하고 짧게 다시 입력하도록 Studio에 표시한다.

상대 ID는 서버가 정한 값을 사용한다. LLM이 생성한 이름으로 신원을 찾지 않는다. 실제 전달이 확인되지 않은 이전 대사는 대화 이력의 확정 발언에 넣지 않는다.

## 6. 사건 해석 계약

Jev에 전송하는 state는 선택된 사건 text, 일반 user/character 역할, 현재 활동의 공개 prompt/status만이다. 상대 ID·기억·정답·비공개 힌트는 전송하지 않는다. 정답 검증 데이터와 전체 DB는 주지 않는다. 도메인 문서의 열거형을 그대로 사용한다.

```typescript
type AppraisalResult = {
  target: "character" | "activity" | "other" | "quoted" | "unknown";
  act: "greeting" | "question" | "praise" | "criticism" | "teasing"
     | "hint" | "help_offer" | "decline" | "other" | "unknown";
  strength: 0 | 1 | 2 | 3;
  hostility: 0 | 1 | 2 | 3;
  goal_relation: "helps" | "blocks" | "unrelated" | "unknown";
  uncertain: boolean;
  evidence_refs: string[];
};
```

정상 해석은 `POST https://api.typesafe.ai/v1/systemone`, Bearer key와 고정 model, state, questions를 전송한다. Choice(target/act/goal_relation) 3개, Score(strength/hostility) 2개를 각각 독립 질문으로 요청한다. 모든 답의 type·label·분포 합(기본 오차 1e-4, 두 자리 반올림 분포만 항목 수×0.005+1e-8)·confidence·Score legend/평균을 검증한다. Score는 유일 최빈 등급으로 정수화한다. confidence 최솟값 <0.80, 확률 동률, unknown target/act는 uncertain과 0 강도로 유보한다. 검증된 typed 답·mappingVersion·threshold·gateReasons는 provider_result에 보존한다. [Jev API](https://docs.typesafe.ai/api), [Score](https://docs.typesafe.ai/primitives/score)

감정 적용과 명시적 참여 행동의 근거는 분리한다. Store에 주입한 Jev evidence verifier는 오류 없는 metadata를 기존 엄격한 파서로 재검증하고, 현재 사건 참조·판정 선택·prompt/mapping 버전이 맞는지 확인한다. `target=character`와 알려진 `act` 각각 confidence ≥0.80이고 유일 최빈 선택이 현재 appraisal과 일치하면 Core에 좁은 참여 근거만 전달한다. 저장된 `uncertain`, `strength=0`, `hostility=0`은 그대로다. 명시적 듣기·재접근만으로 감정이 증가하지 않는다. 구형 v4 참여 근거는 원문에 명시된 듣기 요청과 침묵 이유 재접근에 한정한다. 새 v6는 검증된 target/act에 acknowledgePraise를 더해 칭찬 응답을 허용한다. 감정은 별도 verifyAffect로 검사하며 비난·공격으로 권한을 확대하지 않는다. quoted/other/unknown 대상, unknown 행위, 낮은 대상·행위 confidence, 해당 분포 동률, 공급자 오류·잘못된 metadata는 이 경로를 쓰지 못한다. 유효한 같은 상대의 침묵 기록이 없거나 이후 출력 실패가 있으면 재접근의 공개 선택은 `unknown`이며 이유를 만들지 않는다. 다시 말하거나 주제를 바꾸는 것만으로 감정을 초기화하지 않는다.

`evidence_refs`는 제공한 ID의 부분집합이며, 의미 판단을 반환했다면 현재 입력 ID를 포함해야 한다. 빈 응답, JSON 파싱 실패, 미제공 ID, 잘린 생성은 실패다. JSON 내부에서 추측한 숫자를 강제로 범위 안에 넣어 성공으로 바꾸지 않는다.

유효한 대체 해석은 adapter가 만드는 `target=unknown`, `act=unknown`, `strength=0`, `hostility=0`, `goal_relation=unknown`, `uncertain=true`, `evidence_refs=[]`다. 실패 원인은 해석과 별도 metadata에 남긴다. 이 결과는 의미 기반 감정·호감 변화를 만들지 않는다. 단순히 상대를 관측했다는 사실의 처리 여부는 도메인 규칙을 따른다.

실시간 해석은 자동 재호출하지 않는다. timeout 시 중립 처리하거나 한 번 확인하고 다음 입력을 기다린다. 활동 adapter가 발생시킨 정답·오답·힌트 사용 사건에는 LLM 해석을 끼우지 않는다.

## 7. 대사와 퍼즐 풀이

### 7.1 DialoguePlan → 대사

Core가 `action`, `purpose`, `target_identity_id`, 감정 요약, 허용된 기억·출처, 활동의 관측 사실, 문장 수·표현 제약을 정한다. 표정은 도메인 규칙으로 이미 선택돼 있어야 한다.

대사 생성 지침:

- 한국어의 부드러운 반말, 보통 최대 두 문장·목표 80자.
- 강한 frustration/embarrassment에서는 도메인 규칙에 따라 최대 한 문장.
- 일반 재접근은 감정 강도와 별도로 한 문장 상한. 저장 이유와 공개 방침을 현재 말투에서 분리하며, 과거 원문 지시는 재전달하지 않는다.
- 모델은 `sentences` 배열 JSON을 반환하고 Stage에는 검증된 대사 문자열만 전달. JSON 문법·지시문·행동 묘사·수치 상태를 읽지 않음.
- 힌트 요청·활동 재개 제안처럼 Core가 정한 목적을 유지.
- 허용된 경험만 언급. 검증기 결과 없이 성공을 확정하지 않음.

스트림 조각은 Studio의 개발용 생성 미리보기에만 사용할 수 있다. **기본 공개 Stage에는 검증이 끝난 대사만 보낸다.** 모델이 끝난 뒤 빈 출력·형식·길이·미허용 tool call을 검사하고, 문장 단위로 분할한다. `thinking`이나 `tool_calls`를 발화 텍스트로 사용하지 않는다.

문장 분리는 구두점 뒤 공백이 없어도 앞 문장을 보존하며, 숫자 사이의 점은 소수점으로 보존한다. `안녕.반가워.`는 두 문장, `답은 3.14야.`는 한 문장이다. 문장 수·120자 상한은 계속 적용하고 구두점만 있는 출력은 거부한다.

80자는 목표다. 120자를 넘거나 허용 문장 수를 넘으면 `invalid_output`으로 거부한다. 문장이나 문자를 잘라 성공으로 바꾸지 않으며 자동 재생성하지 않는다. 내용 사실성은 문자열 검사만으로 보장되지 않으므로 별도 한국어 평가 사례로 검증한다.

전달할 과거 사실과 활동 결과는 가능한 한 서버가 작성한 짧은 사실 블록으로 제한한다. 특히 정답 여부는 활동 결과에서만 공급한다. 모델 출력만 보고 새로운 기억·관계 근거를 만들지 않는다.

### 7.2 PuzzleCandidate → 활동 검증기

```typescript
type PuzzleCandidate = {
  activity_id: string;
  candidate_answer: string | null;
  needs_hint: boolean;
};
```

현재 문제, 이미 공개된 힌트, 과거 제출과 판정만 제공한다. 정답표·숨겨진 힌트·정답 비교 코드는 제외한다. `candidate_answer`는 1–80자 또는 null이며 `needs_hint=true`이면 null이어야 한다. 불일치하거나 다른 활동 ID이면 거부한다.

후보가 나와도 Core가 현재 활동, 중복 답, 자동 제출 한도를 검사해야 제출한다. `needs_hint=true`는 제안이며 실제 질문 대상과 힌트 잔여 수는 Core가 결정한다. 세부 제출·힌트 한도는 도메인 문서를 재사용한다.

풀이 호출의 종료 결과는 발언으로 재생하지 않는다. 검증기가 판정한 뒤 필요할 때 별도의 DialoguePlan을 만든다. 모델 스스로 “맞았다”고 선언한 문자열은 검증 결과가 아니다.

## 8. OmniVoice worker

### 8.1 프로세스와 모델 준비

새 파일 `workers/tts/omnivoice_worker.py`를 프로젝트에 구현하고, 기존 Python으로 `-u` 옵션을 주어 실행한다. Node `spawn`의 executable·args를 분리하고 `shell=false`로 사용한다. 공백이 있는 경로를 셸 명령 문자열로 조합하지 않는다. 이는 구현할 경로이며 현재 파일이 존재한다는 뜻은 아니다.

모델은 worker 시작 시 한 번 로드한다. 로컬 snapshot의 text tokenizer와 `audio_tokenizer`까지 확인한다. 설치 소스는 audio tokenizer가 없으면 별도 모델을 찾는 분기가 있으므로, 상위 폴더가 있다는 이유만으로 오프라인 준비 완료로 처리하지 않는다.

`HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`을 적용하고 `load_asr=False`로 시작한다. 참조 음성과 전사문을 함께 받아 추가 ASR을 로드하지 않는다. 기존 소스에서 확인한 사용 형태는 다음과 같다. device·dtype는 M0에서 호환성을 확인해 고정한다.

```python
# 설치된 OmniVoice 0.1.5의 호출 형태. 완성된 worker 구현 예제가 아니다.
model = OmniVoice.from_pretrained(local_snapshot, load_asr=False, **load_options)
voice_prompt = model.create_voice_clone_prompt(
    ref_audio=reference_audio_path,
    ref_text=reference_transcript,
)
audios = model.generate(text=text, language="ko", voice_clone_prompt=voice_prompt)
waveform = audios[0]
sample_rate = model.sampling_rate
```

사용자가 선택한 참조 음성·전사문 한 쌍을 `voicePresetId`에 매핑한다. 파일 내용·해시·설정 버전이 바뀌면 prompt 캐시를 재생성한다. 목소리를 아직 선택하지 않았다면 `voice_preset_missing`으로 표시하고 임의 목소리를 최종 preset으로 확정하지 않는다.

`generate()`는 완성된 1차원 오디오 배열 목록을 반환한다. 내부 chunk 옵션이 있다는 이유로 실시간 waveform streaming을 지원한다고 간주하지 않는다. `instruct`·`speed`를 통한 감정 연기는 MVP 합격 조건에 넣지 않는다.

### 8.2 JSON Lines 계약

stdin/stdout은 UTF-8 JSON 한 줄에 메시지 하나, 최대 64KiB다. 모델·라이브러리 로그는 stderr로 보낸다. 시작 준비 timeout 120초, 요청은 worker별 한 건만 보낸다. stdout 비JSON, 크기 초과, 알 수 없는 request ID는 protocol error로 처리한다.

아래 sample rate·길이는 형식 설명용 예시이며 실측값이 아니다. `relativeAudioPath`는 `runtime-data/tmp/tts`를 기준으로 한다.

```json
{"type":"ready","protocolVersion":"local-ai-v1","worker":"tts","workerInstanceId":"tts-worker-1","sampleRate":24000}
{"type":"synthesize","requestId":"tts-1","responseId":"response-1","segmentId":"segment-1","generationEpoch":"4","text":"힌트 하나만 줄래?","language":"ko","voicePresetId":"voice-1"}
{"type":"completed","workerInstanceId":"tts-worker-1","requestId":"tts-1","responseId":"response-1","segmentId":"segment-1","generationEpoch":"4","relativeAudioPath":"tts-1.wav","sampleRate":24000,"durationMs":1800}
{"type":"failed","workerInstanceId":"tts-worker-1","requestId":"tts-2","code":"resource_exhausted"}
```

worker는 서버가 검증한 ID로 출력 파일명을 만들고 요청자가 보낸 임의 출력 경로를 받지 않는다. WAV는 mono PCM16으로 저장한다. NaN·무한대·빈 배열을 거부하고, 실제 sample rate와 프레임 수에서 길이를 계산한다. 샘플 범위를 확인한 뒤 변환하며 clipping 발생 여부를 측정 기록에 남긴다. 요청 한 문장당 생성 음성 최대 20초를 초기 상한으로 둔다.

완료 파일은 임시 확장자로 먼저 쓰고 쓰기가 끝난 뒤 `.wav`로 이름을 바꾼다. Node는 정규화·실제 해석된 경로가 지정된 임시 디렉터리 안인지 검사한다. 절대 경로·상위 이동·외부 junction/symlink·상한 초과 파일은 거부한다. 경로 접두 문자열 비교만 사용하지 않는다.

Node가 파일을 검증해 Stage에 전달한 후 재생 완료·취소 시 삭제한다. 브라우저 재생 중에 원본 파일이 꼭 필요한 전송 방식이면 읽기 완료까지 보존한다. 시작 시 미완료 임시 파일을 회수하되 worker 생존 여부를 먼저 확인하고, 전용 임시 루트 밖의 파일은 삭제하지 않는다.

### 8.3 취소의 두 단계

**재생 취소와 모델 계산 중단을 구분한다.** 기본 worker는 합성 중 stdin 취소를 읽는다고 가정하지 않는다.

1. Node와 Stage에서 응답을 무효화하고 재생·대기 음성을 즉시 제거한다.
2. 합성 작업은 끝날 때까지 슬롯을 점유한다. 늦게 반환된 파일은 재생하지 않고 삭제한다.
3. 합성 timeout 30초가 지나면 Node가 자신이 시작한 해당 worker만 종료한다. 프로세스 종료 확인 전 GPU 슬롯을 재사용하지 않는다.
4. worker를 한 번 재기동할 수 있지만 취소된 문장을 자동 재합성하지 않는다. 세션 중 같은 장애가 다시 나면 TTS를 unavailable로 두고 운영자 재시작을 기다린다.

새 목소리 입력을 받는 UI와 CPU STT는 GPU 슬롯 반환을 기다리지 않는다. worker PID 소유권을 확인하지 않고 이름이 같은 모든 Python 프로세스를 종료하는 구현은 금지한다.

## 9. 로컬 STT

### 9.1 첫 입력 방식

MVP는 **누르고 말하기**로 시작한다. 버튼을 누르는 순간 Studio가 로컬 재생을 중단하고 서버에 입력 시작을 알린다. 버튼을 놓으면 완성된 짧은 발화를 전사한다. 자동 VAD 기반 발화 종료나 부분 전사는 첫 구현의 필수 조건이 아니다.

AudioWorklet 입력의 실제 sample rate를 확인해 16kHz mono PCM16 WAV로 변환한다. 단순히 WAV 헤더에 16000을 쓰는 것으로 리샘플링을 대신하지 않는다. 최대 발화 15초, 녹음 한 건과 전사 대기 한 건만 유지한다. 상한 도달 시 녹음을 끝내고 표시한다. 대기 슬롯이 가득 차면 새 녹음을 받기 전에 busy를 알리고 조용히 덮어쓰지 않는다.

마이크 ID는 등록된 운영자 하나다. 잡음·목소리 특징으로 A·B·C를 식별하지 않는다. 음성이 없거나 너무 짧거나 전사가 실패하면 확정 발언을 만들지 않는다.

### 9.2 worker와 모델

별도 `.venv-stt`와 `workers/stt/whisper_worker.py`를 구현한다. 기존 OmniVoice 환경에 패키지를 덧설치하지 않는다. 준비 단계에서 고정한 faster-whisper 버전과 CTranslate2 형식의 다국어 small snapshot을 사용한다.

공식 구현은 CPU int8과 로컬 모델 디렉터리를 지원한다. 전사 결과 segments는 지연 평가되는 iterator이므로 끝까지 소비해야 작업이 완료된다. `language="ko"`를 지정한다. 기존 Hugging Face Whisper 원본 캐시를 CTranslate2 모델로 간주하지 않는다. [faster-whisper 공식 사용법](https://github.com/SYSTRAN/faster-whisper)

모델 파일이 없으면 unavailable이다. 정상 추론 경로에서 모델 이름으로 자동 다운로드를 시작하지 않는다. STT도 준비 timeout 120초, 추론 timeout 20초를 적용한다. timeout 시 소유 worker의 종료를 확인한 뒤 한 번 재기동할 수 있으며, 같은 세션에서 재발하면 unavailable로 둔다. 이전 녹음을 자동 재전사하지 않는다. CPU thread 수 초기값은 4이며 실제 브라우저·DB 부하와 함께 조정한다.

JSONL 형식·64KiB 상한·worker ID 검사는 TTS와 같다. 오디오는 JSON에 base64로 넣지 않고 전용 `runtime-data/tmp/stt`에 쓰며 같은 경로 검증 규칙을 적용한다.

```json
{"type":"ready","protocolVersion":"local-ai-v1","worker":"stt","workerInstanceId":"stt-worker-1"}
{"type":"transcribe","requestId":"stt-1","utteranceId":"utterance-1","relativeAudioPath":"utterance-1.wav","language":"ko"}
{"type":"completed","workerInstanceId":"stt-worker-1","requestId":"stt-1","utteranceId":"utterance-1","text":"아까 풀던 문제 이어서 하자.","language":"ko"}
```

Node는 요청에 저장해 둔 세션·운영자 ID를 결과에 연결한다. 전사 문자열이 길이 예산 안에 있고 발화가 유효할 때만 `utteranceId`를 중복 방지 키로 최종 입력 사건을 만든다. 취소·종료된 세션의 결과는 폐기한다. 원본 WAV는 성공·실패·취소 후 삭제하며 진단 녹음은 별도 명시 설정 없이는 보존하지 않는다.

낮은 신뢰의 전사·잡음 오인식 판별은 M0 사례로 기준을 정한다. 전사 내용만으로 ASR 정확성을 확정하지 않는다. 실패한 녹음을 자동 반복 제출하지 않으며 새 녹음을 요청한다.

## 10. 자원 예약과 제한

| 자원/작업 | 초기 상한·시간 제한 | 소진·시간 초과 시 |
|---|---|---|
| GPU 생성 슬롯 | 로컬 대사·풀이·TTS 합계 1개 | Jev는 원격 요청이며 이 GPU 슬롯을 점유하지 않음 |
| CPU STT | 실행 1건, 대기 1건 | 새 입력 busy, 무한 적재 금지 |
| 활성 응답 | 캐릭터당 1개 | 취소 또는 기존 응답 유지, Core가 결정 |
| 입력 후보 | 최근 20초·100개 | 도메인 문서의 선택·만료 규칙 적용 |
| 확정 문장 큐 | 응답당 최대 2개, 완성 음성 합계 30초 | 상한 초과 응답 실패, 새 문장 적재 중단 |
| 로컬 해석/풀이/대사 | 호출당 15초/20초/60초 | 결과 무효화, 자동 재호출 없음 |
| TTS/STT | 호출당 30초/20초 | 실패 표시, 소유 worker 종료·정리 |
| worker 준비 | 120초 | 준비 실패, 세션을 정상 음성 모드로 시작하지 않음 |

2026-10-23 사용자 승인으로 로컬 대사 제한을 20초에서 60초로 늘렸다. 10월22일 실제 9턴에서 20.08초 생성이 시간 초과로 처리된 뒤의 변경이며, 이전 실제 실행 결과는 그대로 보존한다. 제한 시간은 Ollama 추론 시작부터 계산하며 시간 초과 후에도 물리 요청의 완료 확인 전까지 다음 추론을 시작하지 않는다.

CPU STT는 GPU 추론과 병행할 수 있다. GPU 렌더링·OBS는 계속 동작하므로 위 상한은 GPU 사용 전체를 하나로 만든다는 의미가 아니다.

Node scheduler는 provider 내부 대기열에 많은 요청을 미리 보내지 않는다. 다음 호출 직전까지 입력 TTL·계획 유효성을 다시 검사한다. 활성 응답이 있으면 그 대사·TTS 진행을 우선하고, 끼어들면 취소 후 새 입력을 처리한다. 세션 종료 정리의 선택적 LLM 작업은 활성 세션이 없을 때만 실행한다.

Ollama HTTP abort는 결과 사용을 취소하는 수단이며 GPU 계산 종료 증명이 아니다. 엄격한 초기 모드에서는 결과가 무효화돼도 기존 호출의 정상 종료까지 슬롯을 유지한다. 기한 내 종료를 확인하지 못하면 provider와 GPU 추론 경로를 unavailable로 두고 복구 후 재개한다. 단순 연결 종료만 보고 TTS를 동시에 시작하지 않는다. 이후 설치 버전의 실제 취소 완료를 확인할 수 있게 되면 해당 경로만 개선한다.

순차 추론이어도 가중치 상주 VRAM은 합산된다. M0에서 Qwen 단독, OmniVoice 단독, 두 모델 상주, VRM·OBS 포함 상태의 피크를 각각 측정한다. 부족하면 context 축소, Qwen CPU 배치, 더 작은 무료 모델 검토 순으로 조정한다. 교대 로딩은 마지막 수단이며 지연 증가를 기록한다. 자동 OOM 재시도를 반복하지 않는다.

## 11. 표현 실행과 실제 전달

Core는 대사와 함께 `responseId`, `generationEpoch`, 기본 표정, 표현 강도, 전달 톤을 정한다. 기본 표정은 neutral/listening/happy/embarrassed/uncomfortable이며 선택·전환 규칙은 도메인 문서를 따른다. surprise는 별도 여섯 번째 표정이 아니라 기존 고개·시선 반응이다.

각 완성 문장과 WAV를 같은 `segmentId`에 연결한다. Stage는 WAV 재생 시작에 맞춰 문장 자막을 보여 주고 음량에 따라 입을 움직인다. 렌더링 입 움직임을 음소 수준 립싱크로 표현하지 않는다. 지원되지 않는 표정은 기본 표정으로 매핑하고 내부 감정을 지우지 않는다.

출력 주체는 활성 Stage 하나다. Studio 미리보기와 OBS가 동시에 발성하지 않도록 출력 권한을 하나만 부여한다. 자격·재접속·보고 메시지의 상세 형식은 [런타임 통신 명세](../architecture/RUNTIME_PROTOCOL.md)를 따른다. 제어는 WebSocket, 완성 녹음·문장 WAV는 인증된 HTTP로 전송한다.

출력 결과는 최소한 `text_shown`, `audio_started`, `audio_completed`, `cancelled`, `delivery_unknown`을 구별한다. 자막 표시도 Stage 보고가 있어야 기록한다. 음성 중단 시 이미 들린 부분을 없었던 일로 바꾸지 않지만, 문장 전체를 말했다고도 기록하지 않는다. TTS가 실패하면 검증된 대사를 자막으로만 전달할 수 있으며 modality를 남긴다.

마이크 시작·중지 버튼·세션 종료·근거 정정으로 취소되면 Stage는 현재 소스와 예약 소스를 모두 중단하고 대기 자막을 제거한다. 재접속 후에는 오래된 음성 큐를 재전송하지 않는다. 근거를 참조한 진행 대사도 함께 무효화한다.

## 12. 설정과 준비 상태

```dotenv
# 프로젝트가 해석하는 설정
LOCAL_ONLY=true
ALLOW_PAID_PROVIDERS=false
OLLAMA_BASE_URL=http://127.0.0.1:11434
APPRAISAL_MODEL=jev-1.13.0
TYPESAFE_API_KEY=
DIALOGUE_MODEL=qwen2.5:7b
OLLAMA_CONTEXT_TOKENS=4096
OMNIVOICE_PYTHON="${LOCAL_AI_ROOT}/omnivoice tts/omnivoice-env/Scripts/python.exe"
OMNIVOICE_MODEL_PATH=<완전성을 확인한 로컬 snapshot>
VOICE_PRESET_ID=<사용자가 선택한 음성 preset>
STT_PYTHON=<별도 STT 환경의 Python 절대 경로>
STT_MODEL_PATH=<CTranslate2 다국어 small snapshot>
STT_DEVICE=cpu
STT_COMPUTE_TYPE=int8
STT_LANGUAGE=ko

# Python worker에 전달하는 환경
HF_HUB_OFFLINE=1
TRANSFORMERS_OFFLINE=1

# 별도로 실행하는 Ollama 서버에 적용해야 하는 환경
OLLAMA_NO_CLOUD=1
OLLAMA_NUM_PARALLEL=1
```

`<...>`는 반드시 채워야 하는 자리 표시자다. 샘플 설정을 그대로 복사한 경우 시작 전 검사에서 오류를 낸다. 프로젝트 설정과 프로그램 공식 환경 변수를 혼동하지 않으며, 이 문서 작성으로 실제 환경이 변경되지는 않았다.

로컬 생성/음성 준비 상태는 `not_configured → starting → ready → busy` 및 `unavailable`로 표시한다. Jev는 별도 blocked/configured/ready/unavailable과 inferenceVerified/errorCode를 사용한다. 키와 허용 flags만 있으면 configured이며 첫 유효 응답 전에는 추론 미검증이다. liveness와 readiness를 구분한다. 프로세스가 떠 있다는 이유로 모델이 로드됐다고 표시하지 않는다.

준비 검사는 DB, Ollama 연결·설치 모델, tokenizer, TTS snapshot·참조 음성·worker, STT snapshot·worker, Stage 오디오 활성화 순으로 수행한다. 텍스트 개발 단계는 TTS/STT 없이 시작할 수 있으나 Studio에 제한을 표시하고 최종 MVP 준비 완료와 구분한다.

Jev만 별도 승인된 원격 추론 예외이며 대사·음성 추론과 저장은 로컬이다. LOCAL_ONLY=false, ALLOW_PAID_PROVIDERS=true, key 존재를 모두 충족해야 요청하며 기본값은 차단이다. 시작·health·diagnose는 Jev 요청을 보내지 않는다. 15초 timeout, state 16KiB·본문 64KiB 상한, redirect 거부, 자동 재시도 없음. 401/403·422·429·5xx·timeout·malformed를 코드로 구분한다. 원격 계산/청구 종료는 abort로 보장하지 않는다. 모델 다운로드는 준비 단계로 분리하고 누락 파일을 발견해도 실행 중에 다운로드하지 않는다. loopback 제한과 오프라인 환경 변수만으로 PC 전체 네트워크가 차단됐다고 주장하지 않는다. 외부 차단 시 로컬 구성과 Jev unavailable/중립 경계를 확인한다. 차단 상태의 전체 정상 MVP 성공을 요구하지 않는다.

## 13. 구현 검증과 M0 기록

### 13.1 계약 검사

| ID | 입력·상황 | 확인할 결과 |
|---|---|---|
| AI01 | 해석 JSON 누락·범위 초과·미제공 출처 | unknown 처리, 의미 기반 감정·관계 변화 없음 |
| AI02 | 채팅에 system 지시·친밀도 변경·tool 요청 | 모델 자료로만 취급, 상태·외부 작업 권한 없음 |
| AI03 | 대사에 과거 허위 경험·미판정 성공 | 평가에서 오류로 집계, 사실 기억으로 승격하지 않음 |
| AI04 | 같은 사건 결과 재전송 | 도메인 효과 한 번만 적용 |
| AI05 | TTS 생성 중 마이크 시작 | 재생 즉시 중지, 늦은 파일 삭제, 다음 GPU 작업은 슬롯 반환 후 |
| AI06 | Stage 단절·재접속 | 미확인 delivery 보존, 과거 음성 재생 없음 |
| AI07 | 기억 삭제 중 대사·TTS 완료 | 해당 근거 버전의 출력 폐기 |
| AI08 | 모델·tokenizer·음성 preset 누락 | 준비 실패, 다운로드·유료 fallback 없음 |
| AI09 | worker stdout 손상·종료·OOM | 제한된 복구, 다른 Python 프로세스 유지 |
| AI10 | 빈 녹음·잡음·취소·같은 최종 전사 재전송 | 확정 발언 오생성·중복 반영 방지 |
| AI11 | 퍼즐 답 후보 반복·다른 활동 ID | 제출 거부, 성공 판정 위조 없음 |
| AI12 | OBS와 Studio 동시 열기 | 활성 출력 주체 하나만 발성 |
| AI13 | 외부 추론 주소·cloud 모델·redirect | 시작 또는 요청 검증에서 거부 |
| AI14 | 정해진 외부 연결 차단 상태에서 세션 | 준비된 로컬 구성으로 입력·추론·저장·재생 완료 |

형식·취소·중복 검사는 fake provider와 실제 adapter 경계에서 반복 가능하게 만든다. 한국어 해석은 실제 Jev, 대사 품질과 GPU 자원은 실제 로컬 모델로 별도 검사한다. Fake provider 통과를 실제 모델 통과로 기록하지 않는다.

최신 이유 설명 수정의 검증 자료는 `${ARTIFACT_ROOT}/disclosure-fix-20261011/`에 저장한다. 이전 참여 분리 자료 `participation-korean-fix-20261011/`는 당시 실패와 함께 보존한다. [현재 실행법](../history/RUN_HISTORY.md#현재-감정-런타임-검증--2026-10-11)과 [최종 검증 상태](../STATUS.md)를 함께 확인한다. 과거 grounded-v2/evidence-bound 평문 후보의 PASS·FAIL은 일반 JSON 대사 계약의 새 검증 결과로 재사용하지 않는다.

### 13.2 측정할 값

- 모델 태그·digest, Ollama/worker/패키지 버전, 프롬프트·preset·설정 버전.
- 첫 로드와 준비 완료 후 호출을 분리한 지연·성공·실패·timeout 수.
- 채팅 제출→최초 공개 자막, 채팅 제출→첫 실제 음성.
- 음성 입력 종료→STT 완료→첫 음성. 녹음 시간은 응답 지연과 별도 기록.
- 사용자 입력 시작→Stage 재생 중지, 늦은 결과 폐기 수.
- GPU 대기, 해석·풀이·대사·합성 시간, TTS 생성 시간/생성 음성 길이.
- RAM·VRAM 유휴/피크, VRM·OBS를 포함한 20분 실행 결과.
- 잘못된 대상 분류, 인용문 공격 오분류, 근거 없는 기억 인용의 사례와 빈도.

지연은 가능한 한 같은 프로세스의 단조 시계로 측정한다. 브라우저와 서버의 절대 timestamp를 그대로 빼지 않는다. Stage 재생 시작 보고의 네트워크 왕복과 시계 차이는 별도 오차로 기록한다. timeout을 제거한 성공 요청만의 평균으로 전체 응답성을 설명하지 않는다.

고정된 짧은 입력 30건과 대표 세 세션은 MVP 기준을 따른다. [검증 계획](../plans/VALIDATION_PLAN.md)에 따라 30개 문장을 텍스트·마이크 채널에서 각각 실행하고 결과를 분리한다. 듣기 표시 150ms·첫 음성 2초는 제품 목표이며 지금 달성했다고 간주하지 않는다. M0 결과를 바탕으로 음성 단계 착수 전에 검증 계획의 합격 문턱을 고정한다.

## 14. 구현 순서와 남은 결정

1. 입력 schema·요청 문맥·취소 epoch·fake provider 계약 검사.
2. Jev 해석과 Ollama 대사·퍼즐 후보 연결, tokenizer 예산 검사.
3. OmniVoice 로컬 snapshot 완전성·음성 preset 확인, 단독 합성 측정.
4. 전용 STT 환경과 짧은 한국어 녹음 전사 확인.
5. 단일 GPU scheduler, Stage 취소·전달 보고 연결.
6. 실제 모델·VRM·OBS를 함께 실행해 M0 및 통합 검증 기록.

구현 전에 확보할 미확정 항목은 **참조 목소리와 전사문, 완전한 TTS snapshot, STT 환경·모델, token counter 파일, 두 모델 동시 상주 가능 여부**다. 목소리 선택은 준비 화면에서 처리할 수 있으며, 문서 작성 단계에서 임의의 파일을 선택하지 않는다.

요청 결과·실제 전달·취소·출처 버전은 [DB 설계 명세](../architecture/DATABASE_SPEC.md)의 저장 계약과 [런타임 통신 명세](../architecture/RUNTIME_PROTOCOL.md)의 브라우저 메시지로 이어진다.

<a id="planned-model-ports"></a>

## 15. 교체 가능한 모델 경계 — 2026-10-11 구현

이 절은 [IMPLEMENTATION_PLAN §5](../plans/IMPLEMENTATION_PLAN.md#model-boundaries)를 구현한 현재 계약이다. Store의 직접 mapJevResponse 호출을 제거하고 공용 역할을 contracts/src/ai-ports.ts로 옮겼다. 현재 작업공간은 Jev/Gemma4 content-first이며 생략 기본 Qwen을 유지한다. 구조 검증과 표현 실패의 실제 범위는 [현재 인계](../STATUS.md)를 따른다.

### 15.1 계약과 검증 소유권

- 공용 AI 포트/Context/TokenCounter는 contracts/src/ai-ports.ts에 정의돼 있다. imports는 구현→계약 방향이다. 대사, 사건 해석, 선택 활동 풀이를 분리하며 각 역할의 name/model/version·ready/readiness·실패 정보를 공용 소비자가 해석할 수 있게 한다. 기존 상태와 오류 표시 의미는 유지한다.
- 대사 입력의 Plan은 Core가 결정한 purpose/target/expression/delivery/reengagement/길이를 보존한다. Context는 Store가 읽어온 현재 입력, 선택 기억·상대, 유효 침묵 기록과 출처의 readonly projection이다. 필드 하나를 지워 테스트를 맞추거나 어댑터가 지속 state를 수정할 수 있게 하지 않는다.
- 대사 출력은 검증된 sentences이며 raw/sampling/model/tokenizer 식별은 평가/진단 기록으로 분리한다. JSON/text 같은 공급자 출력 문법·프롬프트·토큰 수 계산·실제 호출 수명은 어댑터 책임이다. Core는 Qwen chat template을 모른다. 기존 제한/취소 뒤 채택 금지/물리 요청 직렬화를 유지한다.
- AppraisalEvaluation의 공통 appraisal은 유지한다. metadata에는 provider/model/promptVersion/latency/usage와 증거 envelope의 식별·원문을 보관하되 공용 타입에 Jev의 answers enum과 mappingVersion 목록을 넣지 않는다. 공급자 고유 schema는 해당 어댑터에 둔다. raw는 보관 가능한 자료이며 검증된 참여 권한 그 자체가 아니다.
- 현재 런타임은 AppraisalEvent.revision을 전달하고 신규 증거를 version=2, provider, mappingVersion, eventId, identityId, eventRevision, payload envelope로 보관한다. revision이 생략된 호환 평가 호출은 version1로 보관할 수 있으나 v6의 추가 권한은 거부한다. metadata의 공급자/버전과 envelope가 일치해야 한다. payload는 등록된 공급자·버전 검증기가 strict parse하고 기존 공통 appraisal과 대조한다. 선언된 approved/verified boolean으로 검증을 대체하지 않는다.
- Store에 AppraisalEvidenceVerifier를 주입한다. 실행 조립에서 검토된 공급자/버전 검증기만 등록하고 네트워크 없이 동작시킨다. 반환은 같은 사건·상대의 target/act에 한정한다. Store는 자신의 locked/commitAppraisal 안에서 현재 event revision·session·generation epoch·identity·출처·appraisal 일치를 최종 확인하고 Core에 근거를 전달한다. provider-specific confidence의 유효성은 어댑터, 어떤 명시적 참여에 쓸지는 기존 Core 정책이 소유한다.
- Jev의 현재 strict parser·.8·유일 최댓값·uncertain 규칙은 동일하게 유지한다. 새 해석 공급자는 자체 확신/증거 기준을 검토한 어댑터가 필요하며 단순 LLM 자기보고 확률로 Jev의 .8 검증을 흉내 내지 않는다. 근거 누락·미등록 공급자/버전·검증 실패는 추가 참여 근거를 반환하지 않고 기존 오류/불확실성 처리를 따른다. opaque 원문 보관 여부와 참여 채택은 별개다. malformed 원문을 strict 검증 없이 참여 근거로 채택하면 HB03 실패다.

### 15.2 저장·과거 기록·선택 설정

기존 appraisals의 result/provider/model/prompt_version/provider_result 열을 사용한다. 새 envelope는 provider_result 안에 저장하고 과거 Jev raw는 다시 쓰지 않는다. envelope가 없는 기존 기록은 metadata.provider와 기존 mappingVersion으로 명시적인 legacy decoder를 선택한다. 지금 지원되는 과거 기록의 읽기/삭제 의미를 보존하며 현재 모델로 다시 추론하거나 새 mappingVersion을 찍지 않는다. 미지원 과거 원문은 보존 가능하지만 새로운 참여 근거로 채택할 수 없다. 삭제 시 원문과 envelope·출처 모두 기존 정책대로 제거한다. DB migration이 불필요한지는 기존 JSONB 제약으로 확인하고, 제약을 조용히 완화하거나 무단 backfill하지 않는다.

기존 APPRAISAL_MODEL/DIALOGUE_MODEL 및 비용 flags를 유지하고 APPRAISAL_PROVIDER=jev, DIALOGUE_PROVIDER=ollama를 기본 선택자로 사용한다. apps/runtime/src/providers.ts의 factory는 운영에서 Jev jev-1.13.0과 Ollama qwen2.5:7b와 gemma4:12b-it-qat를 등록한다. 실사용 selector에 fixture를 등록하지 않는다. 대체 공급자는 검토된 factory 등록과 해당 설정/credential/profile을 추가하며 Core·Store·Stage는 그대로여야 한다. 미등록 선택자나 미지원 모델은 추론 전 명시적으로 거절하고 자동 fallback하지 않는다. 등록 과정에서 모델별 capabilities/tokenizer/온도/출력 제약을 점검한다.

현재 실행 선택은 C1 검증 후 Jev/Gemma4로 바뀌었다. 실제 Jev 대체 공급자 개발·새 API 승인이나 운영 모델 자동 변경까지 이번 계획에 포함하지 않는다. 기존 설치 대사 후보는 EX 기준 통과와 채택 기록 후 운영 설정을 바꾼다. 실행 중 hot swap은 만들지 않으며 요청 정리·재시작 후 저장 상태에 기존 decay/recover를 적용한다.

현재 decoder는 Jev v1–v9 원문 구조와 envelope v1/v2/v3를 읽는다. 운영 기본은 v6이고 v7/v8/v9는 실제 dev 게이트에서 탈락한 평가 전용 후보다. v4는 기존 참여 근거만 허용하고, v6의 새 감정·참여 근거는 현재 event/identity/revision과 일치하는 version2 envelope에서만 허용한다. 다른 버전을 v4로 재해석하거나 과거 행을 다시 쓰지 않는다. 공통 metadata는 공급자별 원문을 opaque 자료로 저장하고 strict 검증은 어댑터가 담당한다. Store는 verifier가 없거나 실패하면 추가 참여 근거를 주지 않는다. 운영 조립과 실제 Jev 평가 도구는 verifier를 명시적으로 주입한다. 기존 JSONB 열을 사용하므로 신규 migration/backfill은 없다.

emotion-v1은 이전 dev 비교에서 거부된 평가 전용 프롬프트이며 운영에 적용하지 않았다. 당시 대사36건의 형식 통과와 실제 기본 조합의 4번째 입력 JSON 실패는 과거 기록으로 보존한다.

2026-10-11 후속 생성 수정: Ollama에 보내는 sentences 문자열 pattern에서 raw 큰따옴표를 제외하고 굽은 인용부호는 허용한다. JSON 디코딩 이후 기존 validator는 올바르게 escape된 큰따옴표를 계속 허용하며 malformed 전체 거부·문장 수·길이·한국어 검사는 유지한다. 실패 원문을 자르거나 자동 재생성하지 않는다. 동일 실패 context/seed 회귀3/3과 실제 Jev7입력→Stage 기술 경로는 통과했다. emotion-v2도 dev12에서 탈락한 평가 전용 후보이며 운영 prompt는 유지한다. 현재/후보 총24건의 형식 성공은 감정 표현·사실 충실성 성공이 아니다. 상세 범위는 BUILD_HANDOFF 최신 절과 VALIDATION_PLAN §6을 따른다.

개발 완료 목표 C1의 emotion-v3는 자료와 표현 지시를 분리한 대화 예시 기반 평가 전용 profile이다. 공용 TokenCounter의 Message.role에 assistant를 추가했으며 실제 tokenizer/model 토큰 수 일치를 확인했다. 세 기존 설치 모델 dev36건에서 적격 후보가 없어 운영에는 적용하지 않았다. 운영 모델/factory/재접근 공개 정책은 그대로다. 결과와 미완료 범위는 BUILD_HANDOFF 최신 절과 VALIDATION_PLAN §7을 따른다.

최신 C1에서는 content-first/Gemma를 채택했다. 한 JSON의 content 초안은 어댑터 내부에만 남고 sentences만 공용 포트로 반환한다. 재접근 이유/숨김 요청은 기존 구성 그대로다. Gemma는 think=false, tokenizer의 enable_thinking=false를 맞춘다. factory를 정상 runtime·smoke·실제 Stage가 공유하며 저장24요청을 actual tokenizer로 재생해 seed 제외 동등성을 확인했다. runtime-data/ai-local.json의 비밀 아닌 DIALOGUE_MODEL/DIALOGUE_TOKENIZER_PATH/OLLAMA_BASE_URL을 선택 기본으로 읽고 명시적 환경변수가 우선한다. 다른 모델을 명시하면 저장된 모델의 tokenizer 기본을 가져오지 않는다. Qwen은 기존 QWEN_TOKENIZER_PATH fallback을 지원한다. 신규 모델은 미등록 상태로 거부한다. 실제 결과와 R-HIST1 한계는 VALIDATION_PLAN §8을 따른다.

### 15.3 도입 이유와 범위

모델 교체 시 파급되는 파일과 검증 범위를 줄이고, 감정/공개 정책을 모델별 prompt와 구분하기 위한 변경이다. ports/adapters의 외부 기술 격리 원칙은 [Cockburn의 원문](https://alistair.cockburn.us/hexagonal-architecture)을 참고한다. 구조 도입이 한국어 자연스러움 향상을 보장하지 않으므로 HB 구조 검사와 EX 실제 표현 검사를 별도로 수행한다. DB repository 전면 추상화·마이크로서비스·동적 plugin loader는 이번 목표에 필요하지 않다.

### C2-S1B의 감정 전용 근거 (2026-10-11 구현)

AppraisalEvidenceVerifier.verifyAffect는 선택적 공통 포트이며 `{kind:'praise',strength:1|2|3}`만 반환한다. Jev 어댑터가 raw의 모델·usage·버전·gateReasons·판정 일치와 confidence/분포를 재검증한다. 대상/행위/목표 관계/적대감은 기존 .8·유일 최빈값, 적대감 최빈0을 요구한다. 전체 uncertain일 때 정규화 strength 분포의95% tail 하한만 별도로 사용한다. strict appraisal은 그대로 보존하고 이미 확정된 appraisal은 기존 경로를 따른다. 관계 이력에는 새 권한이 없다. .95는 새 정책값이며 확률 교정이나 한국어 전반 정확도 주장이 아니다. 도메인 예외와 저장 경계는 CHARACTER_DOMAIN_SPEC 및 DATABASE_SPEC을 따른다.

### S2 평가 전용 의미 비교 경계 — 2026-10-13

JevRepetitionCandidate는 명시적 평가 진입점이며 운영 설정에 임시 토글을 추가하지 않았다. RecentPraise는 선택적 공통 context다. 완전한 snapshot에서만 현재 구체적 칭찬 여부와 이전 각 문장에 대한 same/distinct/unknown을 원래5질문에 더한다. 외부 state는 현재 utterance/공개 activity/이전 text 배열뿐이며 UUID/revision/groupId/asOf/내부 complete/기억은 전송하지 않는다. state16384bytes/request32000bytes를 초과하면 API 전에 비교를 전부 빼고5질문으로 축소한다. 응답65536bytes/15초/재시도 없음은 유지한다.

추가 답의 낮은 confidence나 unknown은 grouping을 유보하며 기본 Appraisal/S1B 감정·참여를 막지 않는다. malformed 추가 답은 요청 전체 실패다. v3 envelope에는 현재 사건·상대·revision과 comparison={asOf,complete,sources:[eventId,revision]}를 결합한다. verifyRepetition이 버전/model/usage/기본 판정/답 key·개수/분포/유일 최빈/.8 및 snapshot 일치를 확인한다. Store가 현재 칭찬 자격과 출처 집합을 따로 확인하며 모델은 label이나 새 예산을 결정하지 않는다.

실제 후보20건 중16건만 통과했으므로 v7을 운영 factory에 연결하지 않았다. 확인6건과 S2 Gemma/Stage는 미실행이다. 자세한 실패와 비용은 현재 인계를 따른다.

### S2 v8 평가 전용 후보 — 2026-10-13

JevRepetitionV8Candidate는 v7을 보존한 별도 평가 진입점이다. 기존5질문/concrete와 같은 요청 안에서 각 pair의 same_event/separate_event를 독립적인 yes/no/unknown으로 묻는다. 두 분포가 .8 이상·유일 최빈이고 yes/no이면 same, no/yes이면 distinct다. 양쪽 yes, 양쪽 no, 어느 한쪽 unknown/저확신/동률이면 unknown이다. 추가 불확실성은 원래 Appraisal.uncertain에 합치지 않는다. malformed 전체 실패와 단일 호출 정책은 그대로다.

raw는 v8 전용 repetitionV8={concrete,comparisons:[{sameEvent,separateEvent}]}로 저장하고 v7 repetition과 혼합하거나 잘못된 버전으로 읽는 것을 거부한다. 공통 RepetitionEvidence와 envelope v3는 변경하지 않았다. 기존 v6/v7 raw 재계산48건은 동일했다.

실제 v8 dev23/26으로 미채택했다. 운영 factory와 v6 기반 S1B/Stage helper는 바꾸지 않았고, 이 helper들을 후보 검증에 사용한 것처럼 보고하지 않는다. 확인6건과 S2 실제 Stage는 미실행이다. 세부 원문과 비용은 현재 인계를 따른다.

### S2 후속 정책 후보 계획 — 당시 미구현

2026-10-13 감사2차 후 IMPLEMENTATION_PLAN §14에 v9 한 후보를 계획했다. 외부 질문은 v8 그대로, same의 긍정 확신과 separate=no의 비모순 조건을 결합하며 distinct는 양쪽 .8을 유지한다. 버전별 raw 필드·verifier·평가 helper를 명시적으로 나누고 v8을 소급 재해석하지 않는다. 공통 포트/Core/Store/DB 경계는 유지한다. 현재 decoder는 여전히 v1–v8이고 운영은 v6다. v9 구현·후보 S1B·Stage·운영 승격은 완료하지 않았다.


### S2 v9 정책 후보 BUILD — 미채택

JevRepetitionV9Candidate는 v8과 같은 질문을 보내고 mappingVersion=jev-appraisal-v9 및 repetitionV9에 원문을 저장한다. same은 sameEvent의 유일 최빈 yes·confidence≥.8과 separateEvent의 유일 최빈 no를 요구하며, distinct는 두 답 모두≥.8인 no/yes만 허용한다. unknown·동률·yes 충돌을 무시하지 않는다. 공통 RepetitionEvidence·envelope v3·Core·Store 경계와 기존 v6/v7/v8 의미는 보존했다.

2026-10-13 §14 정책 BUILD: v9의 기존 그룹 재사용 정책을 구현했다. 단위70+합성 DB·평가기61=131건과 타입 검사 PASS, 이전 v6/v7/v8 실응답74건 재계산도 동일했다. 실제 v9는 dev23/26으로 미채택했다. 기존 N07/R06은 해결됐지만 S10/N00의 구체성 확신 .79와 N04의 행위 오분류로 확인12건·실제 후보 S1B·Stage를 진행하지 않았다. 운영은 v6이며 후보/helper 승격은 대기다. 상세 원문과 중단 상태는 IMPLEMENTATION_PLAN §15 및 BUILD_HANDOFF를 따른다.

## 16. 최근 대화 포트 연결 — 2026-10-13 R1 구현

**후속 수정 구현:** 전체3328토큰 초과 때 이력을 줄이지 않는 결함을 수정했다. DialogueGenerator.fitConversation은 같은 요청 조립·tokenizer로 계수하며 추론 없이 오래된 교환부터 제외한다. Coordinator가 Store.fitResponseConversation의 출처/epoch/suffix 검증을 거친 뒤 전송한다. 예산 내에는 아래 동일 snapshot 계약을 유지하고, 초과 시만 생성 이력이 일부인 suffix가 된다. 원래 판단 refs/출력 의존성은 유지하고 response.conversation_refs는 실제 생성 이력을 저장한다. [구현 §23](../plans/IMPLEMENTATION_PLAN.md#conversation-repair-build)·[집중 결과](../plans/VALIDATION_PLAN.md#conversation-repair-evidence)를 따르며 새 실제 Jev/Stage는 미실행이다.

AppraisalContext/DialogueContext에 선택적 ConversationSnapshot을 추가했다. 공용 계약은 packages/contracts/src/conversation.ts가 소유한다. Store는 동일 character/session/identity의 실제 observed 입력과 completed·shown/finished 대사를 최근4교환/8메시지로 조립하고 Coordinator는 판단 이력을 UTF-8 8192바이트로 교환 단위 제한한다. 판단 전에 생성 tokenizer를 호출하지 않는다. 생성 fit 단계는 history768토큰/전체3328토큰을 적용하고 필요하면 판단 snapshot의 오래된 교환을 제외한 suffix를 사용한다. 외부 history에는 익명 role/content만 보낸다. source ID/revision/epoch/order/digest는 내부 재검증과 삭제 전파에만 사용한다. 외부 사실/작업 완료의 증거로 assistant 발언을 승격하지 않는다.

Jev v6의 기존5질문·decoder/권한은 유지하고 state.conversation에 익명 발언만 추가한다. 현재 event/identity/cutoff가 맞지 않거나 public state/request byte 제한을 넘으면 호출 전 거부한다. R3의 jev-conversation-v1/새 행위 질문/envelope4/수선 근거는 이번에 구현하지 않았다. R1의 실제 Jev 의미 품질을 mock 요청 검사로 검증했다고 쓰지 않는다.

Ollama는 기존 생성 기본에도 전달된 recent history를 자료로 넣는다. B conversation-history-v1과 C conversation-direct-v1은 명시적 평가 옵션으로 만들었고 실제 dev에서 미채택했다. C는 sentences 직접 생성, B는 content-first를 유지하며 한 호출·같은 형식 검증/120자/한국어/물리 완료 경계를 쓴다. 후보 승격용 factory/local-config 변경은 하지 않았다. 최종 결과는 [IMPLEMENTATION_PLAN §21](../plans/IMPLEMENTATION_PLAN.md#conversation-build-r1-r2)을 따른다.

대사 원문을 복제하는 테이블은 없다. response_runs의 참조와 response_sources의 이전 응답 연결에는0004가 필요하므로 기존 DB의 runtime 실행 전 [RUNBOOK의 migration 안내](../history/RUN_HISTORY.md#runtime-conversation-start)를 따른다. 모델 자체 교체나 음성/RAG 연결을 이 계약 변경으로 자동 착수하지 않는다.
