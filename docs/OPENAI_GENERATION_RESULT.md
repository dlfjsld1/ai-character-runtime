# OpenAI 생성 비교 결과 — 2026-10-14

2026-10-14 사용자 “어”로 Goal2 개발용 생성 후보 수용을 확인했다. 감정 표현의 최종 MVP/Stage 수용은 별도다. [Goal2 실제 결과](./GOAL2_CONVERSATION_RESULT.md)를 따른다.

현재 추가 확인: 사용자의 재개 지시 뒤 수정된 schema 포함 계수를 실제 서비스에서24건 확인했다. 생성 때의 input usage와 delta0, 입력·schema·conversation도24/24 동일하다. 이번 계수38회·추가 생성0·공급자 오류0이다. 이전 unknown 계수 예약과 금액을 그대로 보존한 명시적 계수 전용 재개이며 새 실패를 무시하는 예외는 없다. 보수 원장 누적은 USD0.836065(한도1), 생성 추정 USD0.03782는 그대로다. 실제 청구 총액은 미확인이다. 기술 검증과 개발용 제작자 수용을 마쳤다. [제작자 검토](./OPENAI_DIALOGUE_ACCEPTANCE.md) 기록은 유지한다.


사용자가 제공한 키와 생성 전용 총 USD1 승인으로 gpt-6-sol 한 후보를 검증했다. 기존 conversation-history-v1 요청, temperature=.2, reasoning=none, 출력256, 입력3328/이력768을 유지했다. 제약 없는 다른 프롬프트나 모델로 재시도하지 않았다. 감정 상태와 공개 수준을 주입한 생성 검사이며 실제 Jev·Core 연속 선택·Stage나 사용자 수용은 아니다.

## 실제 결과

| 검사 | 결과 | 범위 |
|---|---|---|
| dev12 | 형식12/12, hard12/12 | 같은 맥락의 Codex N/U/C/E=1.92/2/2/1.6, 거리 차이1, 기준상 적격 |
| 첫 확인 H12 | 형식12/12, hard12/12 | N/U/C/E=1.92/2/2/1.8, 거리 차이1, 기준상 적격. 이 문항은 이제 미사용 자료가 아님 |
| 이전 요청 추출 회귀 | 216/216 동일 | 9프로필×2모델×dev12. 모델 호출0, messages/schema/검증 schema 비교 |
| 직전 단위 | 98 PASS | 기존 adapter70, config와 신규 비용·출력·계수·timeout 검사. 공급자 모의 |
| DB 교체 경계 | 8 PASS | 전용 합성 PostgreSQL55435. 공급자는 모의. 실제 OpenAI/Stage 경로 아님 |
| 타입 | 최종 tsc exit0 | 초기 실행의 타입 오류는 최종 검사에서 재현되지 않음. 최종 로그 보존 |
| 수선 뒤 기록 재생 | 24/24 요청·출력 동일 | 실제 대사/usage를 모의 envelope에 담아 검증. 외부 호출0 |

G01은 “따뜻한 국물에 면이 들어 있어서 잔치국수를 골랐어”, G04는 그림 그리기 하나, G11은 “연필이랑 볼펜이 있어”로 답했다. 이전 로컬 실패인 역할 반전·예시 사실 유입·수량 오류·존댓말은 이번24건에서 관측되지 않았다.

감정 대조는 G05 “응, 합성 모임은 수요일이야” / G07 “수요일이야”, H05 “응, 전시실은 2층이야” / H07 “2층이야”다. 사실 보존과 최소 거리 차이는 만족하지만, 호응 하나와 길이 차이를 넘어 풍부한 감정 표현을 입증하지 않았다. 숨김 두 답변의 “지금 … 않았어”는 시제가 조금 어색해 자연스러움1로 채점했다. 제작자·독립·블라인드 평가는 미실행이다.

## 직전 비교·감사 당시 비용과 중단

실제 생성24회, 입력13980/출력986토큰, cached0이다. [공식 표준 가격](https://developers.openai.com/api/docs/models/gpt-6-sol)의 생성 비용 추정은 USD0.03782이며 계정 청구 총액은 확인하지 않았다. 예산 원장은 cache-write 상한 가격으로 생성 USD0.04481과 계수87회의 보수적 여유분 USD0.514525를 합쳐 **USD0.559335**를 차감했다. 이 원장 값은 실제 청구액이 아니다. 계수 청구 여부 미확인과 후속 실패1건의 여유분을 제거하지 않는다.

본 비교는 계수86회/생성24회 모두 물리 완료·usage 확인 후 끝났다. 후속 감사에서 전체 생성 payload를 계수에 그대로 보낸 첫1회는 HTTP400으로 중단됐고 재시도0이다. 실패 계수1건의 예약 USD0.010635는 unknown으로 보존했다. 원장이 이후 외부 호출을 차단하며 생성24회 한도도 소진됐다. 남은 한도를 새 원장·다른 키·출력 한도 증가로 우회하지 않는다. 실패 응답 본문을 당시 저장하지 않아 서버가 지목한 필드는 미확인이다.

## 직전 감사 수정과 당시 남은 검증

API-A01: 최초 계수에는 출력 schema가 빠져 실제 input usage보다30/37토큰 적었다. 실제24건 최대 입력713으로 상한3328 내였지만 긴 문맥의 방어에는 결함이었다. schema를 포함하도록 수정했다. [공식 OpenAI SDK의 InputTokenCountParams](https://github.com/openai/openai-node/blob/master/src/resources/responses/input-tokens.ts)는 model/input/reasoning/text를 지원하고 store/temperature/max_output_tokens를 나열하지 않는다. 후속 HTTP400 이후 이 입력 계약에 맞춰 수정하고 필드 일치·상한 초과·실제 usage 불일치의 호출 차단을 모의로 검증했다. **당시 수정된 schema 포함 계수의 실제 서비스 검증은 미완료**였다. 당시 계수 오류 중단을 지켜 추가 호출하지 않았다. 이후 명시적 사용자 재개와 현재 실제 계수 결과는 위 추가 확인을 따른다.

API-A02: headers 수신을 물리 완료로 표시하고 논리 timeout 뒤 결과 저장이 먼저 끝날 수 있었다. body 수신 완료 후에만 확인하고, pending 동안 busy를 유지하며 늦은 terminal callback도 결과에 저장하도록 수정했다. 수정 전 회귀 실패를 보존했고 수정 후 모의 검사는 통과했다. 실제 API timeout을 새로 유발하지 않았다.

유료24건의 원래 소스/manifest와 수선 후 소스를 구분한다. prompts/schema/생성 request와 실제 대사 재생은 불변이며 수선 뒤 실제 생성은0이다. 전체 안전장치의 실제 서비스 PASS나 Goal1 완료로 합산하지 않는다. 당시 다음 작업은 schema 포함 계수 검증과 제작자 수용이었다. 현재는 계수 확인과 개발용 수용 뒤 Goal2를 실행했고 실제 Stage는 Goal3이다. 운영 Jev v6/Gemma 설정은 유지한다.

## 구현과 자료

공통 요청·출력 검증은 `dialogue-request.ts`, 선택 생성기는 `openai.ts`, 비용 원장은 파일 잠금·원자 저장·예약으로 구현했다. 기본 유료 차단을 유지하며 OpenAI는 명시적 선택·키·모델·예산 원장이 필요하다. solver나 감정 판단으로 자동 연결하지 않는다. 키는 `runtime-data/dialogue-api.env`, 업로드 첨부본도 Git 제외이며 값을 출력하지 않았다.

자료는 `J:/ai/ai-character-runtime/openai-generation-20261014/`다. manifest/attempts/budget, dev/confirmation의 원문·review·score, tested-source, baseline, request-parity, audit-reproduction/audit-repair, final-unit-tests, boundary-tests, offline-replay, full-request-count-audit, final-typecheck를 보존한다. 새 모델·패키지 다운로드, 개인자료·음성·로컬 추론·Jev·브라우저·commit/push0이다.

같은 키의 Decisions 판단 후보는 [별도 검토](./OPENAI_DECISION_REVIEW.md)를 따른다. 실제 Decisions 호출이나 Jev 교체는 하지 않았다.

## 이번 계수 재개 증거

기존 원장은111개 entry 전체가 그대로이며 그 뒤 count38개만 추가했다. 생성24회 상한과 unknown 예약 USD0.010635는 변하지 않았다. 일반 runtime factory에는 재개 권한이 없고 기존 unknown은 여전히 호출을 차단한다. CLI는 해당 실패 ID·한도·기존24회·원장 baseline을 확인하고 한 번만 실행한다. 요청 URL은 input_tokens만 허용하며 키/헤더는 저장하지 않는다. 최종 단위99 PASS, tsc exit0이다. 실제 계수 최대713,24건 delta0, conversation 절단/변경0이다. 기존 DB 경계8건은 factory/Core/Store가 바뀌지 않아 관련 증거로 유지하며 DB·Stage는 재실행하지 않았다.

증거: 기존 root의 count-continuation-20261014/manifest.json·results.json·budget-before/after.json·unit-tests.json·typecheck.log. 실행한 명령은 node --experimental-transform-types evals/conversation-api-count.ts --synthetic-inputs --authorized-count-continuation 이며 중복 실행은 거절한다. 대사를 재생성하거나 사용한 확인 문항을 새 미사용 자료로 취급하지 않았다.
