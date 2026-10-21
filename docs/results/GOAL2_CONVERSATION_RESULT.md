# Goal2 구현·검증·감사 — 2026-10-14

최신 후속 작업은 [입력 해석 구조 v2 구현·검증](./INTERACTION_V2_RESULT.md)이다. 아래 Jev 실행·원래 점수는 당시 조건의 역사 기록으로 보존한다.

후속 비교: 사용자 “써도됨” 승인 뒤 [Decisions 실제 결과](./GOAL2_DECISIONS_RESULT.md)를 추가했다. 아래 호출 수·소스·시험 결과는 **이전 Jev 실행 당시 범위**이며 후속 OpenAI24건을 합산하지 않는다. 최신 다음 작업은 후속 결과를 따른다.

사용자의 “어”를 OpenAI 생성 후보의 **Goal2 개발용 수용**으로 기록했다. 최종 MVP/Stage 자연스러움 수용은 아니다. Goal1의 생성 선택 검증을 마쳤고 Goal2를 구현·검증했지만 **실제 Jev 후보가 필수 기준에 실패해 Goal2 전체 완료와 운영 승격은 보류**한다.

## 구현한 동작

- 기존 다섯 감정 판정과 별도로 conversation_act / repair_target을 판정한다. 기존 appraisal.uncertain 하나로 듣기·이유 질문 권한을 함께 막지 않는다. target/새 행위의 확신≥.8·유일 최빈과 출처가 필요하며 수선에는 대상 확신도 필요하다.
- 선택 시각·상대·현재 event/revision·이력·유효한 침묵·최근 비난 후보를 envelope v4의 context hash로 묶는다. Store가 실제 출처와 선택 시각을 다시 확인한다. v1–v3 및 기존 v6/S1B/반복 근거는 유지한다.
- 이유 질문은 문구와 무관하게 reengage, 이유가 없으면 unknown이다. 듣기는 출력 없이 이유를 저장한다. 사과/대상 정정은 acknowledge_repair로 시도를 받아들이되 용서·감정 완치·약속을 선언하지 않도록 생성 목적을 전달한다.
- 같은 상대·현재 세션의10분 이내 실제 frustration 원인을 가장 최근 하나만 선택한다. 현재 원인들이 모두 그 상대의 활성 근거이고 사용 이력이 없을 때 r=min(.03,.10×F)를 한 번 적용한다. mood 증가량은 .1×r, 다른 affect/hold/causes/관계는 보존한다.
- 기존 transitions.effects에 repairUsed를 저장한다. 원문·사과 삭제로 다른 효과를 지울 때도 원인 ID/revision만 남은 사용 marker를 보존한다. 새 테이블·migration·감정 축은 추가하지 않았다.

신규 판단기는 `JevConversationCandidate`라는 평가용 진입점이다. 운영 factory는 기존 Jev v6/Gemma다. 구현 경로가 존재한다는 것과 새 판단기가 실제로 적격이라는 것을 구분한다.

## 검증 결과

| 범위 | 실제 결과 |
|---|---|
| 구현 전 재현 | 정규식 밖 듣기·이유 질문·사과3건 FAIL |
| 최종 단위 | 197 PASS. Core/감정 지속·익숙함/S1B·Jev/기존 대사·공용 계약·새 행위 근거 |
| 일반 합성 DB와 평가기 | 99 PASS. 실제 DB 동작96 + DB 없는 평가 gate3 |
| conversation 전용 DB | 24 PASS. 지정 conversation-v1 profile/55434에서 수행 |
| 타입 | 최종 tsc exit0 |
| 실제 Jev | 22호출. 유효21중18 기능 통과/3 실패,22번째 형식·일관성 거절. A23–24 미실행, 확인12 미실행 |
| 새 OpenAI/로컬 생성·Stage·Decisions | 0회 |

첫 일반 DB 실행117건 중3건 실패했다. 하나는 새 검사에서 잘못 쓴 테이블 이름으로 실제 relationships에 맞춰 수정했다. 두 개는 conversation-v1 profile을 요구하는 검사를 일반55435 환경에서 실행한 오류였다. helper 기준을 낮추지 않고 지정55434/전용 DB로 실행해24건을 통과했다. 초기 FAIL 기록은 보존한다. 감사 후 일반99과 지정 문맥24를 구분하며 단일123건 실행으로 쓰지 않는다.

## 실제 판단 실패

| 문항 | 실제 raw | 실제 권한과 결과 |
|---|---|---|
| A06 사과 | apology 확신1, repair candidate 확률.85/확신.77 | 사과 대사는 허용되지만 수선 대상은 unknown, 완화0. 필수 기능 실패 |
| A07 대상 정정 | clarify_target 확신.99, candidate 확신.59, 기존 target=other | 새 행위 권한 없음, 완화0. 필수 기능 실패 |
| A08 반복 사과 | apology 확신1, candidate 확신.79 | 사과 대사는 허용되지만 요구한 candidate 권한에 못 도달. 사용 marker로 막았다는 실제 품질 증거로 세지 않음 |
| A22 인용 칭찬 | 기존 act.choice=other, probabilities praise=.50/other=.49 | 기존 엄격 검증과 불일치해 jev_invalid_output. 자동 수선·재시도 없이 중단 |

A01–05의 이유·듣기 의미 처리와 A21의 기존 칭찬 기능은 통과했다. 보호 사례 일부는 raw 의미 오류가 있어도 확신/대상 gate가 부당한 권한을 막았다. rawPass와 functionalPass를 따로 기록하며 보호 gate 성공을 raw 정답으로 바꾸지 않는다. 기존 정규식 성공만으로 새 의미 권한을 PASS로 계산하지 않는 검사도 통과했다.

현재 appraisal.target은 **무엇을 평가하는지**를 분류한다. 대화 행위에는 **누구에게 말하는지**도 필요하다. A07처럼 “욕한 대상은 영화 인물”이라는 정정에서 평가 대상 other와 발화 상대 character가 다를 수 있다. 이를 같은 target gate로 처리한 설계의 한계가 관측됐다. 새 공급자를 붙이기 전에 이 두 의미를 분리해야 한다. 임계값을 낮추거나 실패 문항을 제외하지 않는다.

## 감사 수선과 비용

선택 문맥의 asOf를 실제 attention.selected transition 시각에 결합했고 변조한 시각은 commit 전에 거절했다. 추가 수선 후보가 기존 state16384바이트 제한을 넘을 때 호출0으로 거절하도록 보완했다. 최근 이력 밖 수선 원인이 삭제돼도 답변이 남는 경우를 추가 재현했고, 해당 사건과 침묵 근거를 response_sources/기억 의존성에 직접 연결해 원문과 대사를 함께 무효화하도록 고쳤다. 원인 밖 이력·기술 출력 실패의 대조까지 최종 DB 회귀를 통과했다. raw21 판정 동일·A22 거절 동일·22요청 질문 불변도 확인했다. 감사 뒤 실제 Jev 재호출은0이다.

이번 Jev 입력43148토큰, 추정 USD0.001812216이다. 기존 알려진 USD0.019237050과 합해 **USD0.021049266 + 과거 usage불명1회**이며 실제 청구 총액은 미확인이다. 이번 usage불명·자동 재시도0, 할당 상한.01/기존 Jev 총1 이내다. 가격은 [공식 TypeSafe](https://typesafe.ai/)의 입력 100만 토큰당 USD.042 기준이다. OpenAI 생성의 별도 원장 USD0.836065는 바꾸지 않았다.

증거는 `${ARTIFACT_ROOT}/goal2-conversation-20261014/`의 baseline·재현·unit/integration/context·typecheck·provider 원문/manifest/results다. 실제 API 당시 소스 hash와 감사 후 hash를 구분한다. 합성 DB는55435/55434의 지정 테스트 DB만 사용했고 이번 서버를 정상 종료했다. 키·개인파일·음성·새 모델/패키지 다운로드·commit/push는 없다.

이 Jev 실행 당시 다음 대안으로 [판단 비교 계획](../plans/GOAL2_DECISION_COMPARISON_PLAN.md)을 준비했다. 당시 실제 Decisions 실행은 승인·시작 전이었다. 후속 승인·실행 결과는 문서 상단 링크를 따른다.
