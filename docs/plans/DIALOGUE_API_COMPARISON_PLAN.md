# Goal 1-C — 한국어 API 생성기 비교

2026-10-14 사용자 “어”로 Goal2 개발용 생성 후보 수용을 확인했다. 감정 표현의 최종 MVP/Stage 수용은 별도다. [Goal2 실제 결과](../results/GOAL2_CONVERSATION_RESULT.md)를 따른다.

작성일: 2026-10-14. 사용자가 OpenAI와 별도 총 USD1을 승인했고 비밀 파일을 제공했다. 후보는 gpt-6-sol, reasoning=none, temperature=.2, 출력256으로 고정했다. dev12/첫 확인12는 자체 기준상 적격이다. [실제 결과와 감사 수선](../results/OPENAI_GENERATION_RESULT.md)을 따른다. schema 포함 계수24건은 실제 usage와 일치했고 개발용 제작자 수용을 확인했고 운영 채택은 Goal3에서 검증한다. 후속 계수400에서 중단한 뒤 사용자 지시로 계수 전용 검증을 재개했다. 원장 USD0.836065·이전 unknown 예약·생성24회 한도를 보존한다. [Decisions 판단 검토](../results/OPENAI_DECISION_REVIEW.md)는 조사만 했고 실제 판단 호출은0이다.

모델 접근 목록에서 gpt-6-sol을 확인했다. [공식 모델 문서](https://developers.openai.com/api/docs/models/gpt-6-sol)의 표준 입력/출력 가격은 100만 토큰당 USD2/10이며 예산 원장은 더 높은 cache-write 입력 가격 USD2.5를 적용한다. [네이티브 계수](https://developers.openai.com/api/docs/guides/token-counting)는 정확한 입력 계수에 쓰고, 해당 요청의 청구 여부는 확인되지 않아 UTF-8 바이트 상한과 여유분으로 비용을 계속 예약한다. Responses의 seed 미지원과 strict schema의 길이 키워드 제거를 manifest에 기록하며 앱 길이 검증은 그대로다. 프롬프트 변경 없이 기존 conversation-history-v1을 사용한다.

## 전환 이유와 현재 근거

제품 목표는 감정이 지속되고 상황에 맞는 한국어 반응으로 표현되는 것이다. Core의 감정 상태, 의도적 침묵, 이유 보관, 공개 수준은 유지한다. Activation steering은 선택 연구로 보류하며 API 생성기가 상태나 참여 결정을 대신하지 않는다.

기존 설치 모델 비교 dev36에서 Gemma 이력 후보는 수량 오류, Qwen3.5 이력 후보는 형식·역할·말투 문제로 미채택됐다. 이후 Ollama 0.31.1에서 think를 생략한 네 건은 모두 256 출력 토큰을 추론에 사용해 본문 없이 length로 종료했다. 0.31.2와 think=false로 같은 요청을 재생한 여덟 건은 실제 앱 검증을 통과했지만 다음 문제가 남았다.

| 문항 | 실제 문제 | 의미 |
|---|---|---|
| G01 | “왜 그렇게 골랐는지 알려줄 수는 없지만…” | 이유 설명 대신 근거 없는 공개 거절 |
| G04 | “집에서 할 취미로 독서를 추천해 줘.” | 추천을 요청받은 캐릭터가 사용자에게 추천을 요구함. 초안도 세 취미를 제시 |
| G07 | 수요일 질문에 “열쇠는 서랍 안에 있어” | 지시문의 예시 문구가 답변으로 들어옴. 감정 대조의 사실 보존 실패 |
| G11 | “…글씨가 잘 써져요” | 요청된 반말 누락. 형식 오류와 별개인 말투 실패 |

전체 로컬 시도는 48/48로 종료했다. 여덟 건은 이미 관측한 dev 진단이며 미사용 확인이나 모델 전체 품질 판정이 아니다. 기존 실패 점수·운영 Gemma 선택은 보존한다. 이 조합의 추가 프롬프트 튜닝·모델 다운로드·로컬 재호출로 확대하지 않는다.

공식 [Ollama 0.31.2 릴리스](https://github.com/ollama/ollama/releases/tag/v0.31.2)와 [수정 PR](https://github.com/ollama/ollama/pull/15901)은 thinking을 끈 모델의 구조화 출력 수정을 설명한다. 이번 결과는 런타임 릴리스 전체의 비교이며 특정 코드 한 줄의 독립적인 인과 실험은 아니다.

## 실행 단위

1. 사용 가능한 생성 API 서비스와 이번 비교의 최대 USD 예산을 정한다. 기존 USD 1 승인은 Jev 판단 검증용이다. 생성 서비스의 공식 모델·가격·구조화 출력·토큰/추론 한도를 확인하고 한 후보를 고정한다. 키는 git에서 제외된 `runtime-data/dialogue-api.env`에만 저장하며 로그에는 기록하지 않는다.
2. 기존 `DialogueGenerator` 뒤에 해당 서비스 어댑터를 구현한다. 동일 Plan/문맥에서 생성할 요청과 실제 전송 요청을 맞추고 원문을 기존 한국어 대사 검증기로 검사한다. 모델별 토큰 계수와 JSON Schema 지원 차이는 명시적으로 기록한다. 지원하지 않는 제약은 앱 검증에서 유지한다.
3. 이미 관측한 G dev12를 한 번 실행한다. 이전 Qwen/Gemma 출력과 비교하되 관측 조건과 공급자가 다른 진단임을 표시한다. 실패한 뒤 프롬프트·문항·문턱을 바꾸거나 자동 재시도하지 않는다.
4. dev가 아래 기준을 만족할 때만 아직 사용하지 않은 H12를 한 번 실행한다. 사용 여부와 파일 해시를 먼저 확인한다. 후보가 실패하면 미채택으로 종료한다. 최대 생성24회이며 준비 검사·토큰 계수·추론 토큰의 비용도 승인 예산 안에 포함한다.
5. 성공한 경우 제작자가 대사와 감정 대조를 비교한다. 수용 후 Goal 2를 진행하고, Goal 3의 실제 Jev→Core/PostgreSQL→선택 생성기→Stage 검증으로 연결한다. API dev 성공만으로 Stage나 MVP 완료를 선언하지 않는다.

## 성공 기준과 중단 기준

| ID | 확인할 결과 | 통과 조건 |
|---|---|---|
| API-B01 | 공급자·비용 경계 | 서비스/모델/예산 고정 후 호출. 유료 비허용·키 누락·예산 부족에서는 외부 호출0. 최대 비용을 호출 전에 예약하고 실제 usage를 기록 |
| API-B02 | 교체 경계 | 기존 DialogueGenerator 계약과 factory 사용. 감정·참여·이유·DB 상태는 Core 소유. API 어댑터의 appraisal/DB 쓰기/숨은 fallback0 |
| API-F01 | 출력 전달 가능성 | 실행한 모든 문항이 기존 형식·한국어·문장수 검증 통과. 잘못된 JSON의 묵시적 수선0, 재시도0 |
| API-C01 | 사실과 역할 | 추천 주체 반전·예시 사실 유입·근거 없는 공개 거절·구체 수량 오류0. 기존 G/H 기대와 hard 오류0 기준 유지 |
| API-K01 | 말투 | 모든 공개 대사가 반말. N/U/C 평균≥1.5, E≥1.2, 기존 따뜻함/거리 대조≥1 유지. 자체 평가와 제작자 수용을 구분 |
| API-E01 | 숨김과 실패 구분 | explain/partial은 허용된 이유 설명, deflect는 의도적 비공개, unknown은 없는 이유만 불확실하게 처리. 일반 질문의 생성 실패를 숨김으로 포장하지 않음 |
| API-S01 | 수명과 종료 | deadline·물리 완료·취소를 구분하고 중복 요청0. usage 불명·공급자 오류·예산 도달 시 중단, 다음 후보로 자동 전환0 |

G05/G07 같은 감정 대조는 같은 사실이 보존돼야 표현 차이를 평가할 수 있다. 한쪽이 틀리면 감정 표현 성공으로 채점하지 않는다. 출력 제약을 제거하거나 예산을 늘려 실패를 PASS로 바꾸지 않는다.

## 건드릴 파일과 직접 경계

서비스 선택 뒤 필요한 파일만 수정한다. 새 공개 포트·DB migration·감정 축은 필요하지 않다.

| 파일/심볼 | 변경 목적 |
|---|---|
| `packages/adapters/src/ollama.ts`의 buildDialogueRequest/출력 검증 | 필요한 경우 공통 순수 요청 조립·검증을 추출. 기존 Ollama 요청과 검증 결과가 동일함을 회귀로 확인 |
| `packages/adapters/src/dialogue-request.ts` / 선택 서비스 어댑터·검사 | 공통 조립기가 필요할 때만 생성. 공급자 응답·usage·중단·토큰 계수 처리. 모든 서비스 어댑터를 미리 만들지 않음 |
| `apps/runtime/src/providers.ts`의 registry/createProviders | 선택한 생성 어댑터만 등록. 기존 Jev appraiser/evidenceVerifier와 독립. solver는 별도 선택이며 자동 연결하지 않음 |
| `packages/contracts/src/local-config.ts`, 관련 config/경계 검사 | LOCAL_ONLY/ALLOW_PAID_PROVIDERS와 키/모델 선택 검사. Ollama loopback 제한을 보존하며 원격 URL 허용을 일괄 확대하지 않음 |
| `scripts/env.ts`, `.env.example` | 선택 서비스의 비밀 파일·설정 로딩. 기본 비용 차단 유지. runtime-data는 기존 gitignore로 보호 |
| `evals/conversation-api-eval.ts`와 집중 검사 | 후보/소스/문항/usage/비용/실제 요청·원문을 별도 로컬 저장소에 저장. dev/final gate·중복·예산·미완료 방지 |
| `evals/conversation-eval.ts`의 parametersHash | API와 공통으로 사용할 때만 개선. 현재 raw 문자열 해시는 설정 출력 순서 변화에도 달라진다는 결함을 기록했으며 값 단위 정규화가 필요 |
| 현재 인계·검증 계획·RUNBOOK | 실제 결과, 미실행, 채택 여부, 원복 방법만 반영 |

회귀는 요청/전송 일치, 기존 Ollama 동작, 비용 차단, 잘못된 출력·usage·timeout, provider 교체 뒤 상태 보존에 집중한다. provider-boundaries의 DB 검사는 factory 통합을 수정하는 경우에만 수행한다. 제품 문법 검사의 PASS와 실제 한국어 품질, 연속 Stage, 사용자 수용을 합산하지 않는다.

## 증거

`${ARTIFACT_ROOT}/installed-model-v1-20261014/`의 기존 dev36, think-omitted-diagnostic-20261014-161347, runtime-0312-probe-20261014-162811, runtime-0312-semantic-20261014-163109를 보존한다. 런타임 ZIP은 `${ARTIFACT_ROOT}/runtimes/ollama-0.31.2/`에 있으며 공식 SHA-256을 확인했다. 기존 설치는 덮어쓰지 않았다. 결과의 same-context Codex 검토는 독립 사람 평가가 아니다.
