# Goal2 판단 대안 — 고정 실행 계획

이 문서는 실행이 끝난 v1 비교 계약이다. 후속 [독립 행위 구조 v2](./INTERACTION_V2_PLAN.md)와 [구현 결과](../results/INTERACTION_V2_RESULT.md)가 현재 작업이다. v1 점수와 gate는 역사 기록으로 보존하며 v2는 별도 진단으로 다룬다.

2026-10-14 사용자 “써도됨”으로 기존 USD1 안의 판단 실행을 승인받았다. 계획대로 dev24를 실행했으나 기능21/24라 확인12를 보내지 않고 후보를 거절했다. [실제 결과](../results/GOAL2_DECISIONS_RESULT.md)를 따른다. 아래 실행 기준은 원래 고정한 계약이며 실패 뒤 문턱·분모를 바꾸지 않았다.

현재 Jev 후보의 실패를 프롬프트 재시도나 확신 문턱 완화로 덮지 않는다. OpenAI 생성 후보는 개발용으로 수용됐지만 자동 감정 수선까지 성공한 것은 아니다. 사용자 요청에 따라 검토한 Decisions를 **평가용 후보**로 비교하는 안이다. 운영 Jev를 빼거나 교체하는 결정은 별도다.

## 수정할 설계

감정의 target(평가 대상)과 대화의 addressee(현재 발화 상대)를 분리한다. 원래 감정·관계 경로는 기존 target과 strict appraisal/S1B를 사용한다. 듣기/이유 질문/사과 시도는 별도 character addressee와 conversation_act의 확신·유일 최빈·출처를 확인한다. repair_target=candidate의 별도 권한과 Store의 원인/사용 marker는 그대로다. 감정 증가량이나 생성 문장으로 참여·수선 권한을 만들지 않는다.

Decisions gpt-6-luna의 한 요청에서 기존5항목과 addressee/conversation_act/repair_target을 평가한다. 별도 provider 이름·mapping version·verifier를 사용하며 OpenAI 답을 Jev provenance로 포장하지 않는다. 비교 단계에서는 기존 AppraisalProvider 계약을 사용해 기존 Jev와 독립된 후보로 실행한다. 운영에서 Jev 유지+별도 대화 판단과 판단기 교체 중 어느 방식이 필요한지는 비교 결과 뒤 결정한다. 불필요하게 판단 서비스를 항상 두 개 호출하는 구성으로 먼저 바꾸지 않는다.

## 실행 단위와 성공 기준

1. 공식 베타 계약과 키 권한·가격을 확인하고 질문/모델/코드/자료를 고정한다. 같은 OpenAI 키의 **기존 총 USD1** 안에서만 수행하며 시작 시 보수 차감 USD0.836065·이전 실패 예약을 모두 유지한다. 생성24회 한도는 늘리지 않는다. 사용자 “써도됨”으로 승인된 판단 범위만 실행한다.
2. 기존 A24를 고정 dev로 쓰고 아직 공급자에 보내지 않은 HA12를 확인으로 둔다. A01–22는 이미 전송했고 A23–24는 미전송이지만 전체를 dev로 취급한다. 최대 판단36회, 준비 추론0, 자동 재시도0. 모든 dev 필수 기능·보호 기준을 만족할 때만 확인12를 한 번 실행한다. 실패한 뒤 질문/문턱/분모를 바꾸거나 다른 후보로 같은 확인을 재사용하지 않는다.
3. addressee/행위/수선 권한은 후보의 직접 확신≥.8·유일 최빈·실제 source hash로 검증한다. 공급자 confidence는 정답 보장이 아니므로 기존 Jev 값과 같은 정확도라고 주장하지 않는다. target=other라도 현재 상대=character인 정정은 시도를 받아들일 수 있고 감정 권한은 얻지 않는다.
4. 사과 A06·정정 A07은 현재 직접 공격 자극0, 유효한 미사용 원인에 정확한 제한 완화가 있어야 한다. A08 반복·삭제·타인·없는 후보는 추가 완화0이다. 인용/제삼자/가정/부정 입력은 잘못된 재접근·강제 침묵·사과 수선 권한0이다. 기존 긍정과 직접 공격도 정상 기능에 도달해야 한다.
5. 기본 유료 차단, 비용 선예약·usage·오류 중단, 출처 변조, 선택 중 삭제, 완화 marker의 삭제/복구 보존, 공급자 실패≠의도적 침묵을 검사한다. 실제 판단 통과와 Core/DB 모의 통과·Stage·제작자 최종 체감은 각각 기록한다.

## 필요한 파일

`packages/contracts/src/conversation.ts`/`appraisal.ts`/`ai-ports.ts`의 addressee 근거와 별도 provenance; 후보 `packages/adapters/src/openai-conversation.ts`/집중 검사와 별도 verifier; 기존 `jev.ts`는 원문/질문을 유지한 기준선; `evals/conversation-actions-probe.ts`의 공급자 독립 gate 또는 명시적 후보 실행기와 고정 fixture; `Store.commitAppraisal`과 Core의 addressee 근거 소비. 기존 marker·회복 수식·상태 ownership·DB schema는 유지한다. 운영 factory/비밀 파일을 자동 전환하지 않는다.

예산 구현은 기존 OpenAI 원장에 역할·모델별 판단 entry를 추가하고 총한도/실패 예약/생성 한도를 보존하는 최소 변경으로 제한한다. 새 원장으로 사용액을 리셋하지 않는다. 한 역할의 사용량 불명을 다른 역할로 우회할 권한으로 해석하지 않는다. 이후 실행 범위와 재개 권한을 명시적으로 기록한다.
