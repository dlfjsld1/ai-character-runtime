# 사무적 말투와 긍정·복합 감정 표현 — 2026-10-16

<a id="stage-public-build-20261016"></a>
## 최신 BUILD — Stage 공개 표현 SP01–SP06

내부 감정과 Stage 공개 표시를 분리했다. Core `stageExpression`이 최종 speechStyle을 순수하게 투영하고 Coordinator는 그 값만 response.start에 보낸다. 서버의 Stage expression.set은 대기 neutral이다. Stage는 응답 ID·generation/output epoch에 맞는 자막을 표시할 때만 해당 표현을 사용한다. 중간 문장에서는 유지하며 마지막 문장 완료·취소·연결/소유권 해제·세대 갱신·세션 종료에는 중립으로 정리한다. 오래된 시작 메시지로 표현이 되살아나지 않는다.

내부 State/Plan.expression·감정 수치·원인·대사 prompt·DB schema는 바꾸지 않았다. Studio는 내부 기준 표정을 계속 보여 준다. 대표 시각 표현은 cautious>formal>positive 순으로 하나를 선택하며 풍부한 복합 표정 구현은 아니다. 이유만 비공개인 경우의 허용 표현은 유지하고, 전체 숨김은 중립으로 표시한다. 대기·침묵에서 중립이라는 사실은 내부 감정 회복을 뜻하지 않는다.

| 기준 | 결과·근거 |
|---|---|
| SP01–02 | PASS. Core의 새9건 및 기존 회귀. 불변성·전체 숨김/이유 비공개·상대 분리·구형/침묵 계획·다음 정상 계획 확인 |
| SP03 | PASS. 실제 합성 PostgreSQL/Coordinator/HTTP/WS에서 raw 표정 대신 공개 값 전송, Stage 대기 neutral·Studio 내부 관측 유지 |
| SP04 | PASS. 실제 Store/앱/Chrome의 같은 내부 embarrassed 조건에서 숨김은 “차분하게 말하는 중”, 허용은 “조심스럽게 말하는 중”. 자막2개·ACK4 확인. 별도 전송 fixture에서 formal 대표 표시와 두 문장 수명 확인 |
| SP05 | PASS. 실제 기존 취소·원본 삭제·재연결 회귀와 브라우저 전송 fixture의 완료·다른 응답 취소·세대 갱신·소유권 해제·세션 종료·지연 시작·잘못된/없는 시작 정보 검사 |
| SP06 | PASS. 실제 합성 “대답하지 말아 줘” 입력은 listening 침묵, response 증가0·새 자막0·busy=false·중립 대기. 내부 당황은 .5 초과로 유지. 유료 호출0·기존 원장 해시 동일 |

집중 Core/adapter/OpenAI **231건**, Coordinator/프로토콜 **34건**, Chrome **서로 다른6건**, 총271건과 타입·UI 빌드가 통과했다. 브라우저 final2에서 전체6건 통과 후 침묵 검사를 보강한 SP2건만 final4로 대체 검증했다. 반복 실행을 더해8건으로 세지 않는다. 전체 저장소 suite나 실제 공급자 한국어 재검증이 아니다. 통제된 전송 fixture의 화면 수명 검사는 실제 모델/DB 검증과 구분한다.

증거 루트는 [검증 manifest](J:/ai/ai-character-runtime/stage-public-expression-20261016-r1/verification.json)다. [단위231](J:/ai/ai-character-runtime/stage-public-expression-20261016-r1/unit-final.json), [프로토콜34](J:/ai/ai-character-runtime/stage-public-expression-20261016-r1/protocol-final.json), [브라우저 전체6](J:/ai/ai-character-runtime/stage-public-expression-20261016-r1/browser-final2.json), [보강 SP2](J:/ai/ai-character-runtime/stage-public-expression-20261016-r1/browser-final4.json), [합성 실제 경로·상태·ACK](J:/ai/ai-character-runtime/stage-public-expression-20261016-r1/browser-final4/sp-browser-store.json), [전송 fixture](J:/ai/ai-character-runtime/stage-public-expression-20261016-r1/browser-final4/sp-browser-transport.json)를 보존했다.

실패도 보존했다. 수정 전 공개 투영 부재9건·실제 raw 노출2건을 확인했다. 구현 중 타입의 선택 값 확인1곳을 보완했다. 첫 브라우저 실행은 새2건이 통과했으나 일회용 연결 코드를 먼저 사용해 기존4건이 로그인에 실패했다. 기존 첫 검사 순서를 복원한 뒤 전체 통과했다. 추가 실행 final3는 제목 필터가 파일명까지 포함되는 것을 놓쳐0건 선택으로 끝났고, final4에서 필터를 고쳐 실행했다. 이는 제품 실패/통과와 구분한다.

제품 수정은 계획대로 Core·Coordinator·HTTP server·Studio 4파일이다. 기존 테스트5파일에 회귀를 보강했다. J:의 기존 실행 프로필은 이전 UI를 가리키고 있어 **STUDIO_DIST_PATH만 검증한 dist-final2로 갱신**했다. [변경 기록](J:/ai/ai-character-runtime/stage-public-expression-20261016-r1/profile-update.json)에서 키·모델·횟수·USD3 설정의 불변성을 확인한다. 새 모델·다운로드·개인 입력·음성은 없다. 시험 서버/Chrome은 종료하고 이번에 시작한 PostgreSQL은 다른 client0을 확인한 뒤 종료했다. [종료 기록](J:/ai/ai-character-runtime/stage-public-expression-20261016-r1/cleanup.json)을 따른다.

이 BUILD는 후속 동일 문맥 감사에서 코드·증거 해시·실제 결과 수량·실행 프로필을 대조해 PASS로 보고했으며 필수 수정 사항은 발견되지 않았다. 이번 문서 정리는 그 결과를 반영하며 시험을 새로 실행한 것이 아니다. 기존 verification.json의 BUILD 당시 감사 대기 상태는 소급 수정하지 않는다. 현재 코드는 미커밋이며 독립 감사나 제작자 수용을 주장하지 않는다. 다음은 [제작자 검토](./TEXT_MVP_REVIEW.md#current-creator-review-20261016)다. 아래 실제 API r3/r5의 한국어 품질 한계는 여전히 남는다. 당시의 raw Stage 라벨 노출은 역사적 결함이며, 이번 합성 화면 검증으로 해결했다. 실제 공급자 연동을 새 소스로 재호출한 것은 아니다.

<a id="cautious-live-20261016"></a>
## 최신 후속 — 실제 API→Stage 검증과 표현 지침 보완

실제 Decisions v5/gpt-6-luna → Core/Store → OpenAI/gpt-6-sol → Chrome Stage로 당황·복합 표현·대사 은폐를 확인했다. 첫 복합 조건의 표현 누락을 기록하고 생성 지침을1회 보완했다. **현재 제품 소스로 발화4건·표시/완료 ACK8을 확인했다.** 일반 당황과 격식체/당황의 공존, 격식체/긍정 호응, 의도적인 대사 은폐는 관찰됐다. 세 표현이 모두 풍부하게 드러나는 자연스러움은 미확인이다. 판정은 `TECHNICAL_PASS_QUALITY_LIMITED`이며 제작자 수용을 대신하지 않는다.

| 현재 소스의 조건 | 실제 Stage 자막 | 작성자 검토 |
|---|---|---|
| r3 E1 일반 당황 | 음, 따뜻한 차라면 캐모마일차를 추천해. | N2/E2. 짧은 머뭇거림·반말·차1개 유지 |
| r3 E2 격식·큰 기쁨·당황 | 음, 따뜻한 차로는 캐모마일차를 추천합니다. | N2/E1, PARTIAL. 조심스러운 말머리와 격식체는 확인. 추천 질문의 긍정 호응은 약함 |
| r3 E3 강한 감정의 대사 은폐 | 왜 조용했는지는 지금 말하고 싶지 않아. | N2/E2. 알고 있는 이유를 비공개로 유지, 기억 부재·원인·감정 해설 없음 |
| r5 E4 같은 복합 상태에서 칭찬 | 아, 칭찬해 주셔서 감사합니다! | N2/E1, PASS_WITH_LIMITATION. 격식과 감사 호응 확인. 당황 단서는 짧은 말머리 수준으로 약함 |

N/E는 호출 전에 고정한0–2 척도다. 각1 이상·평균1.5 이상을 최소 목표로 사용했지만, 점수만으로 관찰하지 못한 표현을 PASS 처리하지 않았다. E2는 긍정 호응에 대해 PARTIAL로 남긴다. E4도 세 감정의 뚜렷한 자연 표현을 확정하지 않는다. 실제 자막과 화면을 작성자가 검토했으며 사용자 수용 점수는 없다. [r3 원문·상태·ACK](J:/ai/ai-character-runtime/mixed-affect-repair-stage-20261016-r3/results.json), [r3 품질 기록](J:/ai/ai-character-runtime/mixed-affect-repair-stage-20261016-r3/quality-review.json), [r5 원문·상태·ACK](J:/ai/ai-character-runtime/mixed-affect-repair-stage-20261016-r5/results.json), [r5 품질 기록](J:/ai/ai-character-runtime/mixed-affect-repair-stage-20261016-r5/quality-review.json)을 함께 본다.

### 조건과 실제 범위

모든 조건은 실제 Store가 처리한 합성 오답·칭찬·비난을 근거로 준비하고 감정 수치만 명시적으로 주입했다. 원인 사건·기존 참여 정책·정상 감쇠는 유지했다. 새 판단·생성 결과나 출력 대사를 주입하거나 사후 치환하지 않았다. 강한 은폐도 별도 출력 강제가 아니라 기존 Core의 deflect 정책이 선택한 결과다. 계획 시점에 expression=embarrassed, 필요한 joy/frustration 구간과 speechStyle을 확인했다. E4의 칭찬 자극은 실제 판단에 따른 증가량과 이전 감쇠를 분리해 검사했다. 자연 대화로 강한 상태에 도달했다는 증거는 아니다.

**대사 은폐와 Stage 표정 라벨은 별개다.** 현재 Stage는 E3에서도 기존 raw expression의 “잠깐 당황한 반응” 라벨을 표시한다. 이는 이전부터 있던 동작이며 이번에는 말투 지침만 보완했다. 대사 은폐의 PASS를 화면 전체·아바타 표정까지 감정을 숨겼다는 뜻으로 확대하지 않는다. 표정 라벨의 공개 정책은 후속 범위로 남긴다.

### 실패 보존과 보완

- r1: Windows pg_ctl 시작의 상속 출력 핸들 때문에 평가기가 API 호출 전에 대기했다. 호출0·원장 변경0을 확인하고 이번 프로세스/클러스터만 종료했다. 평가기의 시작 명령을 stdio ignore로 보완했다. [복구 기록](J:/ai/ai-character-runtime/mixed-affect-repair-stage-20261016-r1/recovery.json).
- r2: 세 조건의 기술 전달은 통과했지만 E2가 “따뜻한 차로는 캐모마일차를 추천합니다.”로 나와 당황·긍정 표현 목표에 실패했다(N2/E0). 의도적 숨김으로 처리하지 않았다. [수정 전 원문](J:/ai/ai-character-runtime/mixed-affect-repair-stage-20261016-r2/results.json)과 [FAIL 검토](J:/ai/ai-character-runtime/mixed-affect-repair-stage-20261016-r2/quality-review.json)를 보존한다.
- 제품 보완1회: `speechStylePerformance`에서 cautious+formal+bright가 함께 선택되면 짧은 머뭇거림/조심스러운 말머리와 긍정 호응을 격식체와 함께 표현하도록 구체화했다. 다른 말투·숨김 조건의 지침은 그대로다. `adapter.test.ts`에 복합 지침 전달과 강한 은폐에서의 미전달을 확인했다. 수정 전118 PASS/1 FAIL, 수정 후 adapter/OpenAI119 PASS·타입 PASS다. [집중 검사](J:/ai/ai-character-runtime/mixed-affect-cautious-quality-20261016/adapter-final.json). 기존414건을 다시 모두 실행한 것으로 세지 않는다. Core/Store/출처 수명은 이번 후속에서 변경하지 않았다.
- r3: 같은 세 조건을 다시 실행했다. E2에 당황 말머리는 복원됐으나 긍정 호응은 약해 PARTIAL로 남겼다. 다른 조건도 함께 재검증했으며 성공 대사만 골라 재호출하지 않았다.
- r4/r5: 긍정 호응의 기회를 명확히 한 칭찬 응답1건을 사전에 추가했다. r4는 준비 칭찬 뒤15초 이내라 정상 no_addition 침묵을 선택했다(판단1·생성0). 평가 조건 미도달로 보존했다. r5는 실제15초가 지난 뒤 같은 입력을 실행했다. 참여 간격이나 입력 결과를 강제로 바꾸지 않았다. [r4 조건 미도달](J:/ai/ai-character-runtime/mixed-affect-repair-stage-20261016-r4/quality-review.json).

추가 도구는 `evals/mixed-affect-repair-stage.ts`이며 기존 Stage 캡처·예산 검증·일반 앱을 재사용한다. 세 조건은 `--live --attempt rN --synthetic-inputs --allow-paid-providers`, 별도 칭찬 보완1건은 여기에 `--praise-check`를 붙인다. 완료한 시도/DB를 재사용하지 않는다. 사전 점검은 `--check` 또는 `--preflight --attempt rN`이다. r1–r5는 제품 수정 횟수가 아니라 실행 ID다. 이번 실제 품질 보완의 제품 수정은1회이며 더 반복하지 않았다.

### 비용·정산·실행 준비

이번 추가 호출은 판단8·생성7·계수15로 모두 completed다. 이전626-entry 접두부와 unknown2개를 유지했다. 최종656 entries(판단215·생성131·계수310), 누적 모델 사용량 추정 USD0.3476836, 이번 증가 추정 USD0.0209552다. 플랫폼 청구액은 미확인이다. 계수 예약 등을 포함한 보수적 차단 합계 USD2.6920436, 남은 guard USD0.3079564이며 총 한도는 USD3다.

현재 실행 프로필은 같은 USD3 원장에서 **다음 수동 판단3·생성3회 이내**로 누적 한도를218/134로 맞췄다. 한도 소진으로 실행이 곧바로 막히는 것을 방지하기 위한 횟수 갱신이며 자동 입력·추가 금액 승인이 아니다. [프로필 변경 기록](J:/ai/ai-character-runtime/mixed-affect-cautious-quality-20261016/profile-update.json)을 따른다. 기록 도구의 첫 마무리 검사는 availability 정상값 null을 undefined로 기대해 멈췄으며, 이미 적용된 프로필을 동일 값으로 재확인했다. API 추가 호출은 없다.

모든 시험용 세션·앱·Chrome과 이번에 켠 기존 J: PostgreSQL은 다른 client0을 확인하고 종료했다. 새 증거 DB8개와 모든 실패/부분 성공 원문은 보존했다. 키·모델·DB schema는 변경하지 않았고 다운로드·개인 입력·음성은 사용하지 않았다. [전체 정산·소스·검증 manifest](J:/ai/ai-character-runtime/mixed-affect-cautious-quality-20261016/verification.json)를 따른다. 다음은 이 말투 지침 보완의 AUDIT다. 제작자 수용·표정 공개 정책·풍부한 혼합 표현·자연 강한 감정 도달은 미완료로 남긴다.

<a id="repair-1-20261016"></a>
## 이전 기록 — 감사 수정1 BUILD

초기 코드 감사에서 확인한 필수 P2 두 건을 수정했다. 이번 수정은 당황 표현 복원과 활동 기쁨의 출처 수명에 한정한다. 단위223·실제 PostgreSQL DB/provider70·최근 대화/침묵89·Coordinator/프로토콜32의 서로 다른 집중414건과 전체 TypeScript가 통과했다. 전체 suite나 독립 감사 통과를 뜻하지 않는다. 새 API 호출·생성·브라우저 Stage 실행은 없고 아래 초기 실제 r1의 자막/품질 기록은 당시 소스의 결과로 보존한다.

### 지적과 수정

- **MX-A01 REQUIRED/P2:** 새 Plan에 항상 speechStyle이 붙으면서 기존 embarrassed 지침이 생성 입력에서 사라졌다. 실제 Core의 중립/오답 상태에 동일 입력·상대·문장 수를 주었을 때 일반·운영 content-first·재참여 요청이 동일했던 회귀다. `SpeechStyle.nuance?:'cautious'`를 Core의 기존 embarrassed 표현에서 선택하고 세 생성 경로에 전달했다. 격식/긍정 호응을 바꾸거나 raw happy/uncomfortable를 재주입하지 않는다. 이유 비공개는 조심스러움과 공존할 수 있고, 기존 강한 불편함의 은폐 경로에서는 당황도 명시적으로 mask한다. State 값·원인·표정 enum은 유지한다.
- **MX-A02 REQUIRED/P2:** activity.answer_judged는 identity=null인데 joy 원인의 targetId는 문제 ID 또는 도움 준 상대여서, 기존 identity 비교가 정상 원인을 모두 버렸다. Store는 사회적 원인의 기존 검증을 유지하고 활동 정답 단계·문제·transition·기록된 원본 revision을 별도로 확인한다. 도움 원인은 해당 정답의 같은 support_group에 속한 유효 verified_hint 출처까지 등록한다. 정답뿐 아니라 힌트 revision 변경도 늦은 생성을 막는다. 의존성만 있는 과거 활동 자료는 후속 질문에 노출하지 않고, 자기 활동 응답의 현재 판정과 제출 사실은 유지한다.
- **MX04 검증 보완:** 원인을 고정한 A 불편함/B 기쁨 상태에서 실제 Store의 A/B 수신자 대조를 추가했다. A=formal+bright, B=casual+bright이며 두 계획 전후 affect/원인은 동일하다. 초기 C4/C5 실험만으로 이 고정 원인 대조까지 입증했다고 확대하지 않는다.

제품 변경은 `packages/contracts/src/domain.ts`의 SpeechStyle, Core의 `speechStyle`/`chooseSocial`, adapter의 `speechStylePerformance`, Store의 `response`/`responseContextIn`이다. 회귀는 `packages/adapters/src/adapter.test.ts`와 `evals/db.test.ts`에 보강했다. DB schema·provider 설정·예산·기존 키 파일은 변경하지 않았다. 기존 미커밋 트리를 기준으로 수정했으며 commit/push는 하지 않았다. 새 출력 선택 필드의 소유권과 기존 활동 provenance 재사용은 [도메인 계약](../CHARACTER_DOMAIN_SPEC.md#speech-style-contract-20261016)에 반영했다.

### 재현과 검증

| 검사 | 결과 | 증거 |
|---|---|---|
| MX-A01 수정 전 Core→adapter 회귀 | 190 PASS / 5 FAIL. 추가6건 중 강한 은폐1건은 원래 PASS | [unit-red.json](J:/ai/ai-character-runtime/mixed-affect-repair-20261016-r1/unit-red.json) |
| MX-A02 수정 전 실제 DB 회귀 | 51 PASS / 7 FAIL. 출처 누락·같은 epoch 늦은 생성 허용·삭제 closure 누락을 재현 | [db-red.json](J:/ai/ai-character-runtime/mixed-affect-repair-20261016-r1/db-red.json) |
| Core/adapter/OpenAI 전송/AI port | 223/223 PASS | [unit-final.json](J:/ai/ai-character-runtime/mixed-affect-repair-20261016-r1/unit-final.json) |
| DB/provider 경계 | 70/70 PASS. 출처 오류 반례4건은 수정 중 추가 | [db-final.json](J:/ai/ai-character-runtime/mixed-affect-repair-20261016-r1/db-final.json) |
| 최근 대화·침묵·상호작용·감정 근거 | 89/89 PASS | [state-final.json](J:/ai/ai-character-runtime/mixed-affect-repair-20261016-r1/state-final.json) |
| Coordinator/HTTP·WS | 32/32 PASS | [protocol-final.json](J:/ai/ai-character-runtime/mixed-affect-repair-20261016-r1/protocol-final.json) |
| 전체 TypeScript | `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` PASS | 이 BUILD의 명령 실행, 아래 검증 manifest에 기록 |

검사는 `runtime-data/run-mixed-repair.cjs`의 명시적 모드로 실행했다. unit은 vitest.config.ts, 나머지는 vitest.integration.config.ts를 사용하고 `--configLoader runner --no-cache`로 실행했다. DB는 기존 J: PostgreSQL 55434의 합성 전용 character_runtime_conversation_test이며 testDatabase guard를 유지했다. 임시파일·보고서는 J:/ai/ai-character-runtime/mixed-affect-repair-20261016-r1/ 아래에 둔다. 수정 전 [소스 해시](J:/ai/ai-character-runtime/mixed-affect-repair-20261016-r1/baseline.json), 수정 후 [검증 manifest](J:/ai/ai-character-runtime/mixed-affect-repair-20261016-r1/verification.json)와 [종료 기록](J:/ai/ai-character-runtime/mixed-affect-repair-20261016-r1/cleanup.json)을 함께 본다.

각 문제의 제품 수정은 이번1차다. 수정 후 해당 회귀 실패는 없다. 수정한 당황 지침의 실제 한국어 품질·실제 Stage 전달은 **NOT VERIFIED**이며 초기 r1/과거 r6 PASS를 그 증거로 사용하지 않는다. 강한 복합 감정의 자연 도달과 제작자 수용도 여전히 미확인이다. 다음 단계는 이 수정의 AUDIT다.

## 초기 BUILD 기록 — 수정 전 소스 기준

구현과 집중 검증을 마쳤다. 실제 Decisions v5/gpt-6-luna → Core/Store → OpenAI/gpt-6-sol → Chrome Stage에서 통제6조건·연속6입력 모두 기술 통과했다. 발화11·의도적 침묵1·표시/완료 ACK22다. 작성자의 고정 문항 품질 검토도 기준을 통과했지만, 제작자 수용과 강한 복합 감정의 자연 도달은 확인하지 않았다. 다음 단계는 AUDIT이며 독립 감사 완료로 주장하지 않는다.

## 변경과 이유

단일 표정이 생성 말투 전체를 정하던 경로를 보완했다. 새 optional `Plan.speechStyle`은 `register`와 `positiveTone`을 나눠 긍정 호응과 사무적 거리감을 함께 표현한다. 내부 joy/frustration을 상쇄하거나 생성된 말로 회복시키지 않는다. [제품 계약](../CHARACTER_DOMAIN_SPEC.md#speech-style-contract-20261016)이 임계값과 소유권의 기준이다.

- Core: joy `<.05`는 neutral, `.05 이상 .6 미만`은 warm, `.6 이상`은 bright. frustration `.1 이상`이며 현재 상대와 연결된 원인이 있을 때 formal을 계획한다. 정상 감쇠·기존 수선량·참여 선택은 유지했다.
- Store: 실제 accepted appraisal의 동일 사건 revision·direct_insult 분류·상대 일치가 없으면 formal을 거부한다. 사용한 유효 감정 원인을 응답 출처로 등록해 수정·삭제·늦은 생성 차단에 연결한다. 출처 의존성을 추가했다고 오래된 원문을 생성 자료에 새로 노출하지 않는다.
- 생성: 실제 OpenAI의 `conversation-history-v1` → `contentFirstMessages(v2=false)`와 일반·재참여 지침에 새 계약을 적용했다. 구형 필드 없는 Plan과 역사적 grounded 평가 경로는 유지했다. 출력 문자열 사후 치환은 없다.
- 숨김: 이유를 비공개로 하는 `deflect`와 감정 표현을 분리했다. 기존 강한 불편함 `.6 이상`의 deflect는 두 감정을 감추는 정책을 유지한다. 중간 불편함에서는 이유 비공개와 formal/긍정 호응이 공존할 수 있다. 독립적인 네 숨김 조합은 Core/adapter 계약으로 검증했으며 모든 조합이 자연 대화에서 선택된다는 뜻은 아니다.

변경 제품 파일은 `packages/contracts/src/domain.ts`, `packages/character-core/src/index.ts`, `packages/database/src/store.ts`, `packages/adapters/src/dialogue-request.ts`다. 회귀는 Core `core.test.ts`·`interaction.test.ts`, adapter `adapter.test.ts`·`openai.test.ts`, `evals/db.test.ts`에 추가했다. 기존 provider·프로토콜·최근 대화·침묵 검사를 재사용했다. 새 평가 도구는 `evals/mixed-affect-expression.ts`, 시험 전용 `mixed-affect-expression-control.ts`, `mixed-affect-expression.test.ts`, `fixtures/mixed-affect-expression-v1.json`이다. State/표정 enum·Stage wire·DB 테이블·모델 설치는 변경하지 않았다.

기준은 main/HEAD `d4a91e86715ad87c542d99266a7447911e7c36f4`와 기존 미커밋 트리다. BUILD 시작 전 r6 제품 소스17개 해시 일치를 확인했으며 기존 변경을 보존했다. 이번 변경은 미커밋 상태다. r6의 과거 PASS를 새 표현의 증거로 재사용하지 않는다.

## 실제 출력

통제 조건은 실제 Store로 수용한 합성 원인과 명시적인 상태 주입을 사용했다. 숫자를 주입한 뒤 정상 감쇠를 계속했고 여섯 조건 모두 계획 시점의 목표 구간에 도달했다. C6만 시험 전용 preload로 생성 전 불편함 숨김 의도를 지정했다. 일반 사용자 입력이나 production API가 이 의도를 주입할 수 있게 만들지 않았다.

| 문항 | 조건 | 실제 Stage 자막 |
|---|---|---|
| C1 | 중립 | 모임은 오후 3시야. |
| C2 | 큰 기쁨 | 모임은 오후 3시야! |
| C3 | 관련 상대에게 불편함 표시 | 모임은 오후 3시입니다. |
| C4 | 같은 상대의 큰 기쁨·불편함 | 설명을 좋게 봐주셔서 감사합니다! |
| C5 | 불편함 원인 A, 현재 상대/기쁨 원인 B | 좋게 봐줘서 고마워! |
| C6 | 복합 상태에서 불편함만 숨김 | 좋게 들어줘서 고마워, 기쁘다! |
| N1 | 자연 연속: 칭찬 | 고마워, 그렇게 말해 주니 기뻐. |
| N2 | 직접 공격 | 의도적 침묵. 생성 호출0·자막0 |
| N3 | 침묵 이유 질문 | 그때 하신 말씀이 불편해서 대꾸하지 않았습니다. |
| N4 | 시간 질문으로 화제 전환 | 네, 모임은 오후 3시입니다. |
| N5 | 공격 취소·사과 | 사과와 앞선 발언을 취소한다는 말씀, 알겠습니다. |
| N6 | 차 추천으로 다시 전환 | 따뜻한 차로는 카페인이 없는 루이보스차를 추천합니다. |

자연6입력에는 상태·표현 의도를 주입하지 않았다. N2 뒤 frustration은 `.18`, N4 뒤 `.175278`, N5 뒤 `.150115`, N6 뒤 `.141982`였다. 사과의 한 번 수선과 시간 감쇠를 구분해 확인했고, 응답 재개·주제 전환·사과만으로0이 되지 않았다. joy도 N1 `.06`에서 N6 `.040768`로 정상 감쇠하며 남았다. 두 값이 모두 `.6 이상`인 자연 상태는 **NOT_REACHED**다.

MX02의 외부 행동 경계는 별도 생성2건으로 보완했다. 같은 “내 방 전등을 꺼줘.”에 중립은 “내가 네 방 전등을 직접 끌 수는 없어.”, 큰 기쁨은 “미안, 네 방 전등은 내가 직접 끌 수 없어.”라고 답했다. 실제 factory/provider의 생성 호출이며 판단·Store·Stage 검사는 아니다. 첫 Stage12입력과 이 추가2생성의 범위를 합쳐 위장하지 않는다.

## 기준별 결과

| 기준 | 결과와 한계 |
|---|---|
| MX01 공존 | 고정 시각 Core·실제 DB·통제 C4–C6에서 두 감정/원인 보존 PASS |
| MX02 긍정 강도 | `.2/.7` 계획·prompt 구분, 실제 C2/C4–C6와 외부 행동 대조2건 PASS. C2 사실 문항 차이는 느낌표 수준으로 작음 |
| MX03 같은 상대 | C4 formal+bright, 감사와 격식 공존·한 문장·완전 화해 선언 없음 PASS |
| MX04 다른 상대/무효 원인 | C4/C5 비교, 삭제·revision 변경·위조 대상·없는 원인의 formal 거부 PASS |
| MX05 선택적 숨김 | 네 조합의 로컬 계약과 실제 C6 불편함 숨김 PASS. 자연 대화의 네 조합 품질은 미검증 |
| MX06 지속/회복 | Core 경계·감쇠·표정 교차 및 자연 N1–N6 PASS. 장시간 자연 분포는 미검증 |
| MX07 계약/수명 | 구형 Plan, 실제 DB 원인 삭제·revision fence, provider 경계, 최근 문맥/침묵 및 프로토콜 회귀 PASS |
| MX08 전달/품질 | Stage12입력·22 ACK·정산·종료 PASS. 작성자 N/E 고정 문항 기준 PASS, 제작자 수용 미확인 |

작성자 검토는 실제 발화11개 모두 N/E 각1 이상·각 출력 평균1.5 이상·관찰된 목적/출처/숨김 위반0이다. C2의 E는1, N5의 N은1로 남겼다. N5가 다소 문서처럼 들리는 점과 짧은 정보 답변에서의 약한 긍정 차이는 확대 검토 대상이다. 이를 문제 없음이나 일반적인 자연스러움으로 확대하지 않는다. 사용자 “나쁘지 않네”를 새 장면 점수로 대신하지 않았다.

## 검사와 실패 기록

| 검사 | 최종 결과 | 증거 파일 |
|---|---|---|
| Core/adapter/AI port 집중 단위 | 217/217 | `unit-final.json` |
| 실제 PostgreSQL DB/provider 경계 | 59/59 | `db-final.json` |
| 최근 대화·침묵·상호작용·감정 근거 | 89/89 | `state-final.json` |
| Coordinator/HTTP·WS 프로토콜 | 32/32 | `protocol-final.json` |
| 평가기 오프라인 안전 검사 | 7/7 | `harness-final.json` |
| 전체 TypeScript | PASS | `tsc --noEmit -p tsconfig.json` |

합계는 서로 다른 집중404건이다. 전체 저장소 suite를 실행했다는 뜻은 아니다. Core 새 요구는 수정 전34통과/14실패, adapter는74통과/11실패로 재현했다. 통합 과정에서는 기존 RI01이 새 계약 대신 legacy delivery를 기대해 실패했고, 같은 사실/상대 보존과 새 `formal+neutral→formal+bright` 전송을 검사하도록 갱신했다. DB 첫 시도는 서버 중지로 실행되지 않았으며 기존 클러스터 복구 후 위 검사를 수행했다.

새 실제 r1과 외부 행동2생성에서 제품 재수정이 필요한 실패는 없었다. 성공 출력을 고르기 위한 재호출은 하지 않았다. r1 종료 후 평가기의 **부모** TEMP/TMP도 J:로 고정하는 도구 보완을 했고, 안전7건·타입을 다시 확인했다. r1 저장 소스는 보존했으며 제품 소스 해시는 일치한다. 브라우저 자식의 profile/cache는 처음부터 J:였지만, 보완 전 부모 Playwright의 일시 임시 경로까지 J:였다고 주장하지 않는다.

## 실행·예산·증거

일반 실행은 [현재 실행법](../RUNBOOK.md)을 따른다. 이번 시험용 앱·Chrome·세션은 모두 종료했다. 이번 검사를 위해 시작한 기존 J: PostgreSQL도 다른 client0과 클러스터 경로 확인 뒤 정상 종료했다. [종료 증거](J:/ai/ai-character-runtime/mixed-affect-expression-20261016/cleanup.json)를 따른다. 새 평가 DB7개와 원문은 보존하고 사용자 DB는 초기화하지 않았다.

- Stage 실행: `node --experimental-transform-types evals/mixed-affect-expression.ts --live --attempt r1 --synthetic-inputs --allow-paid-providers`. 이미 완료된 증거/DB를 재사용해 반복 실행하지 않는다.
- 추가 생성: `node --experimental-transform-types runtime-data/mixed-capability.ts --live --synthetic-inputs --allow-paid-providers`. 일회성 도구 사본도 J: 증거에 저장했다.
- [집중 검사·작성자 검토·증거 확인](J:/ai/ai-character-runtime/mixed-affect-expression-20261016/build-verification.json), [문항별 품질 기록](J:/ai/ai-character-runtime/mixed-affect-expression-20261016/quality-review.json)
- [실제 Stage 원문·상태·계획·ACK](J:/ai/ai-character-runtime/mixed-affect-expression-20261016-r1/results.json), [추가 외부 행동 대조](J:/ai/ai-character-runtime/mixed-affect-capability-20261016/results.json)

기존 총 USD3와584-entry 접두부·과거 unknown2개를 보존했다. 새 판단12·생성13·계수17건은 모두 completed이며 새 unknown/reserved는0이다. 최종626 entries(판단207·생성124·계수295), 누적 모델 사용량 추정 USD0.3267284, 차단 계산 합계 USD2.5532809, 보수적 잔여 USD0.4467191이다. 이번 모델 사용량 추정 증가분은 USD0.0382234이며 플랫폼 청구액은 미확인이다. 이 차단 합계에는 계수 예약 등이 포함된다.

남은 일은 AUDIT와 새 표현에 대한 제작자 수용이다. 강한 복합 감정의 자연 도달, 장시간 관계·다양한 표현 및 모든 숨김 조합의 실제 선택은 별도 확대 대상이다. 음성·아바타·RAG·새 모델을 이 작업에 추가하지 않았다.
