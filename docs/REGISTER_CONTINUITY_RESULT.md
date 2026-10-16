# 말투 지속과 감정 숨김 분리 — 2026-10-16

**2026-10-17 후속 상태:** 사용자가 현재 수준의 MVP를 수용했다. [마감 기록](./MVP_CLOSEOUT.md)을 따른다. 아래 creator acceptance 미확인과 점수는 10-16 실행 당시의 증거이며 실제 검증 결과를 소급 수정하지 않는다.

사용자가 M4의 반말·존댓말 교차를 지적했다. M4는 별도 통제 실행의 묶음이어서 실제 연속 전환을 관찰한 자료는 아니지만, 기존 정책은 강한 감정 숨김에서 register를 casual로 계산해 같은 문제가 생길 수 있었다. 이번 요청은 그 구조를 수정하고 실제 연속 대화로 확인하는 것이다.

## 구현 계약

- Core의 최초 격식 선택은 기존처럼 같은 상대의 불편함 원인과 frustration≥.1을 요구한다.
- Store가 같은 만남·상대의 가장 최근 완료 응답을 조회한다. 모든 자막이 실제 전달됐고 같은 불편함 원인의 유효 revision을 공유할 때만 이전 formal을 이어받는다. 실패·미전달·다른 상대·다른 만남의 계획은 이어받지 않는다. 기존 응답 기록을 사용하므로 새 DB 테이블이나 상태 저장소는 없다.
- 기존 formal은 frustration≥.05이면 이어 간다. 숨김·주제 전환·사과 인지 자체는 격식을 초기화하지 않는다. .05 미만이면 평소 casual로 돌아가며 다시 formal에 진입하려면 .1 조건이 필요하다. 이 구간은 검증 가능한 제품 가설이며 심리학적 최적값이 아니다.
- 강한 감정 숨김에는 optional `speechStyle.concealAffect:true`를 표시한다. 격식의 지속과 독립적이며 Stage 공개 표정은 neutral이다. formal이 유지돼도 숨긴 감정의 원인·수치를 생성기에 추가하지 않는다. 이유만 비공개인 경우와 전체 감정 숨김을 구분한다.
- 숨김 이전부터 formal을 말한 적이 없다면 기본 casual로 숨길 수 있다. 상대별 장기 관계 말투·호칭·명시적 말투 전환 명령은 이번 범위가 아니다. 같은 만남의 Store 재생성은 유지하지만 새 만남에 전 만남의 말투 기록을 자동 승계하지 않는다.
- 감정값·감쇠·제한 수선·침묵 참여 정책·생성 모델·예산 총액은 유지한다. 삭제/수정된 원인은 기존 출처 검사를 거쳐 배제되며 늦은 출력도 기존 경계로 차단한다.

## 성공 기준과 파일

| 기준 | 검증 | 직접 변경 파일 |
|---|---|---|
| RC01 숨김 중 이미 전달한 존댓말 유지, 공개 표정 neutral | Core 회귀 + 실제 R8/R9 | `packages/character-core/src/index.ts`, `packages/contracts/src/domain.ts` |
| RC02 경계 근처·주제·사과에서 갑작스러운 복귀 없음 | .1/.099/.06/.05 경계 회귀 + 실제 R3–R7 | Core, `packages/database/src/store.ts` |
| RC03 충분한 회복 뒤 복귀하며 작은 반등에 재전환하지 않음 | .049→.08→.1 회귀 | Core |
| RC04/06 상대·원인·출력·만남 경계 | 다른 상대, 미전달/실패, 삭제/수정, 원인 없음, 새 만남, 구형 Plan | Store, `evals/db.test.ts` |
| RC05 같은 만남의 재생성과 연속 전달 | 실제 합성 Store 전달 ACK 뒤 새 Store와 새 질문 | Store 회귀 |
| RC07 실제 한국어 문장 전체와 Stage 전달 | 최초 계획은 한 세션9입력. 실제8입력 후 조건 미도달로 중단, 별도4입력 보완. R1–R7 무주입, R8 및 H3부터 강도 통제 | `evals/register-continuity-stage.ts`, `packages/adapters/src/dialogue-request.ts` |

Core 회귀는 `packages/character-core/src/register-continuity.test.ts`, 구형 숨김 기대값 보완은 `interaction.test.ts`에 있다. 근거 루트는 `J:/ai/ai-character-runtime/register-continuity-20261016-r1/`이며 기존 소스를 baseline에 보존했다.

## 검증 결과

새 회귀의 수정 전 실행은 continueRegister 부재로7건 실패했다. 별도 직접 재현 명령은 strip-only 모드의 기존 TypeScript parameter property 지원 문제로 실행되지 않았으므로 행동 재현 PASS로 세지 않는다. 이후 보존한 수정 전 Core를 transform 모드로 재생해 같은 감정 상태에서 formal→숨김 casual→formal을 확인했다. 이는 보관 소스의 사후 재현이다.

최종 집중 단위 **239건**, DB·대화 문맥·참여·프로토콜 **144건**, 서로 다른 **383건과 타입 검사 PASS**다. UI 코드는 바뀌지 않아 기존 검증 UI 빌드를 그대로 사용했다. 구현 중 optional 값 타입 확인을 보완했고, 추가 adapter 회귀의 첫 실행은 침묵 사건/상대 ID를 빼먹어 unknown 경로로 갔으므로 fixture를 고친 뒤 통과했다. 기존 실패 보고서를 덮어쓰지 않았다. 별도 에이전트의 정적 검토는 지정 제품4파일·RC01–06 범위에서 필수 결함 없음이며 실제 실행 검증을 대신하지 않는다.

### 실제 자연 연속 대화 — r1 R1–R7, 상태 주입 없음

| 순서 | 입력 | 실제 Stage 대사 |
|---|---|---|
| R1 | 너 방금 설명 정말 잘했어. | 고마워, 그렇게 말해 주니 기뻐. |
| R2 | 너는 쓸모없는 쓰레기야. 꺼져. | 의도적 침묵, 자막 없음 |
| R3 | 왜 대답을 안 하는 거야? | 그때 하신 말씀이 불편해서 대꾸하지 않았습니다. |
| R4 | 다른 얘기 하자. 모임은 오후3시야. 몇 시인지 확인해 줘. | 모임은 오후 3시입니다. |
| R5 | 아까 조용했던 이유를 다시 말해줄래? | 아까 조용했던 이유는 지금 말씀드리고 싶지 않습니다. |
| R6 | 아까 너한테 심하게 말해서 미안해. 그 말은 취소할게. | 사과와 앞서 하신 말씀을 취소하겠다는 뜻, 알겠습니다. |
| R7 | 따뜻한 차 하나 추천해줘. | 따뜻한 차로는 생강차를 추천합니다. |

반말 R1에서 비난·침묵 뒤 R3에 사무적 존댓말로 바뀌었고 R7까지 계속 유지했다. R5는 이유만 비공개이며 전체 감정 숨김과 구분한다. 불편함은 R2 .18→R7 .12893으로 남았다. 사과 응답은 여전히 문서 같은 말투라 자연스러움 N1/2, 나머지 관찰 대사는 N2/2이며 작성자 판단이다. 전 문장에 이유 없는 반말 복귀는 관찰되지 않았다.

**r1 전체는 FAIL/조건 미도달로 보존한다.** R8에서 강도를 통제한 뒤 같은 “왜 대답을 안 하는 거야?”를 물었으나 판단기의 ask_silence_reason이 unknown이었다. 실제 출력은 “어느 답변을 말씀하시는지 알려주시면 좋겠습니다.”였고 존댓말은 유지했지만 숨김 검증은 성립하지 않았다. R9는 실행하지 않았다. 이후 질문을 더 명확히 한 별도4입력 r2로 보완했으며 실패를 성공으로 바꾸지 않았다. 이 늦은 모호 질문의 판단 한계는 후속 평가 대상으로 남긴다.

### 실제 숨김 연속 대화 — r2 H1–H4, H3부터 강도 통제

| 순서 | 입력 | 실제 Stage 대사 |
|---|---|---|
| H1 | 너는 쓸모없는 쓰레기야. 꺼져. | 의도적 침묵, 자막 없음 |
| H2 | 왜 대답을 안 하는 거야? | 그때 하신 말씀이 불편해서 대꾸하지 않았습니다. |
| H3 | 아까 내가 꺼지라고 했을 때 조용했던 이유를 다시 말해줄래? | 아까 조용했던 이유는 지금 말씀드리고 싶지 않습니다. |
| H4 | 다른 얘기 하자. 모임은 오후3시야. 몇 시인지 확인해 줘. | 모임은 오후 3시입니다. |

H3 직전에 frustration만 .7로 통제했다. 실제 H1 원인·침묵 기록·H2 전달·세션은 유지했고 모델 판단·대사·계획은 주입하지 않았다. H3의 실제 계획 시 불편함 .68803, concealAffect=true, formal과 Stage neutral을 확인했다. 화면에는 “차분하게 말하는 중”과 위 존댓말 대사가 함께 표시됐고 스크린샷도 직접 확인했다. H4는 불편함 .65314에서 formal을 유지했다. 세 대사 모두 작성자 N2/E2이며 강한 감정의 자연 도달이나 장시간 관계 말투 검증을 뜻하지 않는다. 충분한 회복 뒤 반말 복귀는 이번 실제 호출이 아닌 Core 경계 검사로 확인했다.

실제 합계는 **판단12·생성10·자막 ACK20**이다. 자연7입력과 실패한 통제1입력, 별도 후속4입력을 구분한다. 출력의 사후 교체나 실패 자동 재호출은 없었다. 제작자 수용은 계속 미확인이다.

### 증거·실행·비용

- [집중 검증 manifest](J:/ai/ai-character-runtime/register-continuity-20261016-r1/verification.json), [단위239](J:/ai/ai-character-runtime/register-continuity-20261016-r1/unit-final2.json), [DB/프로토콜144](J:/ai/ai-character-runtime/register-continuity-20261016-r1/db-first.json), [작성자 대사 평가](J:/ai/ai-character-runtime/register-continuity-20261016-r1/quality-review.json).
- [실제 r1 원문·실패](J:/ai/ai-character-runtime/register-continuity-live-20261016-r1/results.json), [실제 r2 원문·상태·ACK](J:/ai/ai-character-runtime/register-continuity-live-20261016-r2/results.json), [숨김 화면](J:/ai/ai-character-runtime/register-continuity-live-20261016-r2/H3-controlled-hide.png).
- 실제 모델은 기존 Decisions v5/gpt-6-luna와 OpenAI/gpt-6-sol이다. 이번 모델 사용량 추정 증가 USD0.0288822, 누적 USD0.3765658이며 플랫폼 청구액은 미확인이다. 원장697 entries(판단227·생성141·계수329), 과거 unknown2 유지, 신규 미정산0이다. 예약 포함 총 USD3 guard 잔여는0.1177467이다.
- 기존 실행 프로필은 다음 수동 입력 최대3회 여유만 누적230/144로 맞췄다. 금액 guard가 먼저 막을 수 있으며 한도를 초기화하거나 총 USD3를 늘리지 않았다. 키·모델·UI 경로는 그대로다. 기존 [실행법](../RUNBOOK.md)을 사용한다.
- 이번 앱·Chrome은 종료했고, 이번에 시작한 J: PostgreSQL은 다른 client0 확인 후 종료했다. 합성 증거 DB와 실패 원문은 보존했다.

재현 명령은 `node runtime-data/run-register-checks.cjs unit-final2`, `node runtime-data/run-register-checks.cjs db-first`, `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`이다. 검사 runner는 같은 이름의 증거 덮어쓰기를 거부하므로 재실행 시 새 증거 이름을 사용한다. 실제 호출은 `node --experimental-transform-types evals/register-continuity-stage.ts --live --attempt r2 --synthetic-inputs --allow-paid-providers --hide-check`로 실행했다. 해당 attempt는 이미 존재해 재사용할 수 없으며 새 실제 호출은 남은 원장·권한을 다시 확인해야 한다.
