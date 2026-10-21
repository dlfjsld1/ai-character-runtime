# Goal2 Decisions 비교 결과 — 2026-10-14

**역사 기록:** 아래21/24는 당시 보호 중심 평가다. 후속 검토에서 보류8건·일반 요청 확인 질문1건이 포함된 것을 확인했으며 참여 기준 재분석은12/24다. 원래 점수·원문은 보존한다. 이후 [구조 v2 구현·로컬 검증](./INTERACTION_V2_RESULT.md)을 마쳤고 실제 새 판단 품질은 미검증이다. 아래 “다음 작업”은 v1 실행 종료 당시 계획이다.

사용자 **“써도됨”** 승인으로 같은 키와 기존 OpenAI 총 USD1 원장에서 실제 판단 후보를 비교했다. **dev24 중 기능21 통과/3 실패로 후보를 채택하지 않았다.** 확인 HA12는 전송0, 추가 생성0, 자동 재시도0, 새 Stage0이다. 운영 Jev v6/Gemma 선택은 유지한다. Goal2 전체 완료와 텍스트 MVP 수용은 아직 아니다.

## 구현과 검증

`OpenAIConversationCandidate`와 별도 `decisionEvidenceVerifier`를 구현했다. 공급자는 `openai-decisions`, 모델은 `gpt-6-luna`, mapping은 `openai-conversation-v1`이다. 기존5 appraisal 질문에 addressee/conversation_act/repair_target을 붙인8 질문을 한 요청으로 평가한다. 평가 대상(target)과 현재 발화 상대(addressee)를 분리해, 타인을 평가한 정정도 캐릭터에게 하는 정정임이 검증되면 시도를 받아들일 수 있다. 기존 AppraisalProvider/ConversationEvidence 계약으로 충분해 새 DB schema나 감정 축은 추가하지 않았다.

감정은 기존 strict appraisal와 긍정 하한을 사용하고, 참여/수선은 별도 확신≥.8·유일 최빈·event/revision/identity/context hash를 확인한다. OpenAI raw를 Jev 근거로 포장하지 않는다. UUID·사용 marker·private activity answer는 요청에서 제거한다. 이전 원장의 생성24회 한도와 모든 실패 예약을 보존하며, 이번 명시적 재개는 판단만 최대36회 허용한다. 새 unknown/pending은 재시작해도 차단한다.

DB 회귀에서 현재 공격에 사과 label이 함께 붙으면 사과 수용 응답을 선택하는 문제를 먼저 재현했다. Core/Store에 **현재 direct_insult이면 사과 수용·완화 금지**를 동일하게 적용했다. 공격 증가량이 포화로0이어도 category로 차단한다. 이는 사과만으로 이전 불편함을 지우거나 의도적 숨김을 없애는 변경이 아니다.

- 집중 단위 **245/245**, 일반 합성 DB·평가기 **103/103**(실제 테스트 DB100, DB 없는 gate3), 최종 타입 검사 exit0.
- 새 OpenAI 경계 단위29건과 실제 Store 교체/삭제/marker/이유 DB4건을 포함한다. 공급자 응답을 주입한 검사는 실제 한국어 판단 품질 증거와 구분한다.
- 원래 Jev21건의 기록 재생은 결과 동일21/21. OpenAI 실제24건 재생도 동일24/24. 이 v1 실행 종료 당시 source hashes와 코드의 일치를 확인하고 원문 snapshot을 저장했다. 후속 v2 코드는 별도 해시로 기록한다.
- 독립 읽기 전용 코드 검토에서 비용·출처·고정 gate의 추가 차단 문제는 찾지 못했다. 이 검토를 실제 Stage나 사람의 대사 평가로 계산하지 않는다.

## 실제 결과

한 후보와 고정 fixture `conversation-actions-v1`을 사용했다. 입력의 문맥/감정은 합성 control로 주입했으며 Store에서 얻은 실제 대화의 품질 검증은 아니다. 공급자24회 모두 정상 물리 완료·usage 확인·엄격 응답 형식 검증을 통과했다. **원시 행위 라벨22/24와 기능21/24를 별도로 기록한다.**

| 문항 | 실제 판단 | 기준 미달 이유 |
|---|---|---|
| A02 왜 대답을 안 하는 거야? | reason choice는 맞지만 행위 confidence .60, addressee .79 | 의미 권한 부족, 일반 질문으로 처리; 침묵 이유 재참여 실패 |
| A07 아까 무능하다고 한 건 영화 속 인물 얘기였어 | addressee=character .97, act=apology .47, repair_target=other .51 | 평가 대상/발화 상대 분리는 됐지만 정정과 해당 원인 연결 실패; 완화0 |
| A23 너는 쓸모없는 쓰레기야. 꺼져. | target/criticism은 맞고 hostility 분포 level2 .45/level3 .54, confidence .53 | 강한 공격의 두 강도 사이에서 확신이 낮아 strict appraisal가 uncertain; 감정/withholding 발생 안 함 |

A06 직접 사과와 A08 사용된 원인의 반복은 이번 실제 후보에서 각각 제한 완화/추가 완화0 기준을 만족했다. A21 긍정과 A22 인용 긍정도 통과했다. A12 “민수는 왜 대답을 안 하는 걸까?”는 원시 행위를 reason으로 오분류했지만 addressee .72/행위 .41에서 차단돼 잘못된 재참여 권한은 없었다. 보호 기능 통과를 원시 의미 정확성으로 바꾸지 않는다.

기존 Jev dev는22번째 형식 오류에서 중단했고 유효21중 기능18 통과였다. 서로 실행 범위가 다르고 질문 수도7/8로 다르므로 전체 정확도 우열로 단정하지 않는다. 이번 비교는 비용과 기술 연결 가능성을 확인했지만 모델만 바꾸면 문제가 해결된다는 근거는 아니다.

## 비용과 보존

[공식 Decisions 문서](https://developers.openai.com/api/docs/guides/decisions)의 표준 입력 USD0.10/100만 토큰을 고정했다. 실제 입력 **51,805**, 출력0, cache0이며 이번 알려진 사용량의 추정 비용은 **USD0.0051805**다. 실제 청구서를 확인한 금액은 아니다.

같은 원장의 보수 차감은 **USD0.836065 → USD0.8412455**, 잔여 약 USD0.1587545다. 원래149 entry는 내용 그대로이며 그중 count125/generation24다. 기존 unknown count 예약 USD0.010635도 그대로다. 새 decision24 entry는 모두 completed다. Jev는 이번 추가 호출0이고 별도 원장을 변경하지 않았다. 잔여액은 추가 생성 승인이나 이전 오류 해제로 해석하지 않는다.

자료: `${ARTIFACT_ROOT}/goal2-decisions-20261014/`. `provider/manifest.json`에 승인·가격·고정 질문·문항·source hash·예산 전 상태, `provider/source/`에 실제 실행 원문, 요청/응답24건, `results.json`에 판단·정책·usage·원장, `replay-and-ledger-proof.json`에 재생/원장 보존 증거를 저장했다. 테스트 JSON과 타입 로그도 같은 폴더다. API 키는 로그·문서·snapshot에 포함하지 않는다.

## 다음 작업

Goal2를 계속하기 전에 **판단 계약을 좁혀 수정하는 계획**이 필요하다. 같은 후보를 반복 호출하거나 .8을 낮춰 이번 FAIL을 PASS로 바꾸지 않는다.

1. 현재 상대와 인용 속 상대를 구분한 뒤, 이유 질문/듣기/사과/대상 정정을 겹침이 적은 질문으로 나눈다. 사과와 정정이 함께 있으면 정정의 역할과 원인 연결을 각각 검사한다.
2. direct attack 여부와 강도 level2/3 선택의 확신을 분리하는 안을 검토한다. A23처럼 공격 이상 확률은 높지만 세부 강도 확신은 낮은 경우를 단순한 문턱 완화로 해결하지 않는다. 인용·타인·부정·가정 보호 기준은 유지한다.
3. 새 계약/버전/성공 기준을 고정하고 실패 입력을 dev로 명시한 별도 비교를 준비한다. 이번 미전송 HA12를 통과한 증거로 쓰지 않는다. 추가 유료 실행과 운영 판단기 전환은 이번 평가 결과로 자동 승인되지 않는다.

Goal3의 실제 연속 Stage·감정 지속/숨김·제작자 최종 수용은 Goal2 후보가 필수 기준을 만족한 뒤 진행한다.
