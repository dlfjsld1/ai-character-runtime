# 사건·성향 공통 평가 O1 — 로컬 구현 결과

2026-10-17. 기준 HEAD `fc883fa`와 기존 미커밋 H2-A 변경. 사용자 진행 승인 뒤 [계획 v2](../plans/OUTCOME_AFFECT_PLAN.md)의 O1 기반과 OpenAI 연결·예산 처리를 구현했다. **O1 전체는 PARTIAL이다. 실제 모델이 성향을 자연스럽게 해석하는지, 감정이 대사와 Stage에 연결되는지는 아직 확인하지 않았다.**

## 최신 후속 — C2-L 구현·모의/재생 완료

[현재 진행 상태](../STATUS.md)와 [C2-L 상세 결과](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md#r4-c2l-build)를 따른다.

## 직전 — B2 실제8건 완료

[OB06–07 결과](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md#r4-b2-result): B1 수정 재감사 PASS 뒤 사용자 승인으로 B2 실제8건을 각1회 실행했다. 계약8/8·고정 outcome8/8·assistant 원문 검토8/8·재생8/8 PASS다. 옛 실패 D02/D09/P02가 이번에 개선됐고 기존 적합5개도 유지했다. 알려진 개발8건의 관찰이며 독립 확인·감정 연결·O1/Stage 완료는 아니다.

이번 usage 기반 보수 차감 USD0.0028878, 누적0.0506409/0.20·잔여0.1493591이며 실청구액 확인은 아니다. 누적36/36회로 호출 한도는 소진했다. 과거28항목 보존·미해결0·설정 바이트 복원·두 lock 없음이다. 추가 호출 없이 R4-C의 확인 평가/감정 재연결 범위를 다음에 계획한다. 실원문·자동 결과는 live/, 별도 의미 검토는 semantic-review.json, 재생은 replay/에 보존했다. 자세한 문항별 검토는 [DeepSeek B2 결과](./DEEPSEEK_DEV_RESULT.md#r4-b2-actual)를 따른다.

## 직전 — R4-B1 REPLAN 1 수정 BUILD 완료·재감사 대기

[수정 결과·BR01–06](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md#r4-b1-repair-1-build): 실행기와 회귀 테스트 두 파일에서 출력 소유권과 설정 검증 순서를 수정했다. 경합 상대의 기록 보존·설정 오류 시 출력/호출0·lock 해제·기존 중단/재생 유지가 BR01–06의 BUILD 검증을 통과했다. 새 평가96+provider32=128/128·타입·모의8/재생8 PASS다. 실제 API·키/실제 원장 접근0이며 B2 실제 의미/정산·감정 연결/O1/Stage는 미검증이다. 새 준비/모의/재생은 별도 로컬 저장소 outcome-isolation-repair-r1 아래에 보존했다. 수정 전173/173·첫 감사 FAIL은 당시 기록이며 다음은 두 파일 수정 delta 재감사다.

## 직전 — R4-B1 감사 수정 필요·REPLAN 1 완료

첫 감사의 출력 경합 P2/OB02와 설정 실패 기록 P3/OB05는 재현된 실행기 결함이다. [REPLAN 1](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md#r4-b1-repair-1)에 두 수정 파일·BR01–06·검증 명령을 확정했다. 수정은 아직 미구현이고 새 기준은 NOT VERIFIED다. 아래173/173·모의8/재생8은 당시 성공한 범위의 증거이며 이번 두 반례까지 증명하지 않는다. 이번 계획은 문서만 변경했고 실제 API·키/원장 접근0, B2·O1 전체·Stage 미검증을 유지한다.

## 직전 — R4-B1 구현·모의 검증 완료

[R4-B1 OB01–05](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md)는 로컬/모의 범위 PASS다. 계획6파일의 전송/실행/비교/재생 구현과173/173·타입·모의8/재생8을 마쳤다. 기존 outcome5적합/3FAIL과 REVIEW_REQUIRED 상태를 보존하고 부분 실행·늦은 원문의 성공 승격을 막았다. 실제 API/추론·키/원장 접근0, OB06–07 실제 의미/정산은 미검증이며 다음은 R4-B1 감사다.

## 직전 — R4-A 감사 PASS·R4-B 계획 완료

대화에서 OP01–06의 로컬 감사 PASS·필수 수정 없음을 확인했다. 기존101/101 기록·소스15 hash, 요청8 재생성·작성24·과거8 판정이 일치한다. [R4-B 계획](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md)의 B1 전송/실행/재생/비교 구현이 다음이며, OB01–07은 아직 NOT VERIFIED다. 실제8건과 의미 성공8/8은 향후 B2의 기준이고 이번에는 새 모델 결과가 없다.

## 직전 — R4-A 사실 전용 후보 BUILD 완료

[OP01–06 결과](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md): 순수 요청/decoder·원본 snapshot·기존8건 보존·작성24·offline CLI를 구현하고101/101·타입·준비를 통과했다. 사실 전용 결과를 감정 평가 결과로 반환하지 않는다. 기존 full-task raw는 옛 codec으로 검사해 전체4FAIL·outcome3FAIL을 보존한다.

API/추론·키/원장 접근0이다. 모델 의미 개선은 아직 미검증이며 다음은 R4-A 구현 감사다. 기존 포트/Core/DB/운영 경계와 OpenAI 소진/DeepSeek 유지 조건은 바꾸지 않았다.

## 직전 — R4 오프라인 요청 구조 검토

[검토와 R4-A 계획](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md)을 작성했다. OpenAI 크레딧 소진을 반영해 공급자 추가를 즉시 후속으로 잡은 결론을 수정했다. 현재 prompt에도 사실/감정 분리 지시가 있으므로 같은 지시 증설이나 두 호출 구조를 바로 구현하지 않는다. 성향·감정과 appraisal 출력을 뺀 사실 전용 후보부터 로컬 계약을 검증한다.

실제 R3-B 원문8·소스21 hash는 그대로다. 기존 전체4/8·outcome5/8·D12 입력 극성 실패를 구분했고 새 의미 개선이나 인과 효과는 미검증이다. 이번은 문서만 변경했고 키·원장·API·로컬 추론0이다.

## 직전 — R3-B 실제 진단8 완료

[문항별 결과와 후속](./DEEPSEEK_DEV_RESULT.md), [RS 기준별 판정](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md)을 따른다. R3-A 감사 PASS 뒤 승인된8건을 실행했다. RS04 참조8/8 PASS·RS05 고정 의미 기준4/8 FAIL·RS06 비용/보존 PASS다. D02/P02는 오귀속한 자기 episode 감정이 실제 오프라인 Core에 기여한다. D09는 사용 사실 오류, D12는 가정 자체 구분은 맞지만 입력 양극성 기준 실패다.

실제8회·자동 재시도0, 이번 보수0.0108264달러·누적28회/0.0477531·미해결0. 원문·FAIL·과거 원장·설정 복원을 확인했고 코드/프롬프트/운영 변경0이다. 당시 후속 공급자 비교 제안은 현재 R4-A 오프라인 계획으로 수정했다. O1 PARTIAL·O2/Stage 미연결을 유지한다.

## 직전 — R3-A BUILD 완료

[R3-A 결과](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md): RS01–03 로컬/모의 PASS, 관련30/30·타입·diff·모의8을 확인했다. 실제 응답을 authored fixture와 같게 강제하지 않으며 잘못된 준비/승인은 키 읽기 전에 거부한다. 다음은 R3-A 감사다. 실제 API0, RS04–06 및 O1 통합은 미검증이다.

## 직전 — R2 감사 PASS·R3 계획 완료

[감사 기록과 R3 기준](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md): RC01–08 로컬/모의 PASS, 필수 수정 없음. 기존164/164 증거와 현재 소스 일치·추가40경계·replay를 확인했다. 다음은 DeepSeek 별칭 진단8을 위한 R3-A 실행 guard·모의 준비이고 실제8건은 미실행이다. 실제 모델 품질·O1 전체·O2/Stage는 미검증/미완료로 유지한다. 이번 계획은 문서만 변경하고 원장 합계만 읽었으며 API0이다.

## 직전 — 참조 표현 R2 로컬 BUILD 완료

[R2 BUILD 인계·기준별 증거](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md)를 따른다. 별칭 codec·두 공급자 후보 선택·원본/hash 기록·replay·refs live 차단을 구현했다. 관련164/164·타입·diff PASS와 양쪽 진단8 모의를 통과했다. 기본 UUID 요청 hash와 이전 실제 응답4건의 결과를 보존했다. 실제 키/원장 접근·API 호출0이며 의미 품질·전체 O1·Store/Stage는 여전히 미완료다. 다음 단계는 별도 구현 감사다.

## 직전 — 평가 진단 R1 완료, 참조 표현 R2 설계

**후속 계획 검수:** [R2 계획 RP01–05](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md)의 권한·빈집합·이력 참조·기록/replay·후보 기본값 공백을 수정하고 두 읽기 전용 검토자의 재검수를 마쳤다. 계획 범위 PASS이며 RC01–08 구현 검증은 NOT VERIFIED다. 이 검수에서는 코드·테스트·유료 호출을 실행하지 않았다.

[R1 검증·R2 후속](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md): 기존 FAIL/기대값을 유지하고 agency 불일치 항목의 Core drive를 별도로 설명하도록 평가기를 보완했다. 실제 D02/D09 고정 원문과 중립·활성도 반례 포함51/51·타입·모의8 PASS, 추가 API0이다. R2는 SDK·DB UUID를 유지한 어댑터 내부 별칭 설계이며 아직 미구현이다. 운영 품질·Store/Stage·전체 O1은 여전히 미완료다.

## 직전 — 진단 실제4건 및 로컬 Core 반영 확인

승인된 진단8건 중4건을 호출하고 D09의 잘못된 출처 UUID에서 중단했다. D02 미사용 사실과 범위 구분, D06 양·음 동시 보존은 이번 실제 응답에서 관측했다. D02 고정 agency 기준은 중립 self 항목도 금지해 FAIL이지만 해당 항목 제거 대조에서 Core snapshot이 같았으며 자기 사건 감정도 없다. 원문·고정 FAIL을 보존하고 기준 적합성을 후속 검토한다. D09 방어 검증은 정상 작동했다. 남은4건·Stage는 미검증이며 O1 PARTIAL·운영 미채택이다. [상세 결과·다음 방향](./DEEPSEEK_DEV_RESULT.md)을 따른다. 누적20건/보수0.0369267달러, 미해결0, 키 설정 복원·재시도 없음.

## 직전 — v3-dev2 경계 수정 로컬 완료

[경계 수정과 증거](./DEEPSEEK_DEV_RESULT.md): 생성 전 허용 후보·ID 제한과 같은 목표의 서로 다른 관측 평가를 구현했다. 관련199+35=234/234·타입, DeepSeek 모의30/OpenAI 모의 HTTP144가 통과했다. 원본 출처의 삭제 의존성·Core 수치·포트는 유지한다. 추가 실제 호출0이며 D02 의미 오판은 미해결이다. 기존 실제 D02/D06/D10은 계속 실패한다. 전체30건 재준비는 실행 승인이 아니며 누적 비용·호출 상한을 넘어서 실행하지 않았다. 다음은 좁힌 실제 비교 범위 선정이다. O1 PARTIAL·기존 개발 FAIL·운영/Stage 미연결을 유지한다.

## 직전 — v3 실제 개발 평가 FAIL

총 USD0.20·누적36회 승인 후 준비된 개발30건 중10건을 실제 호출했다. D02 미사용 오판, D06 복합 감정 누락, D10 불확실한 후보 임의 확정이 남았고 D10 출처 검증 오류에서 중단했다. 형식·근거 계약9건 수용/1건 거부, 문항 검사7건 REVIEW_REQUIRED/3건 FAIL이며 남은20건은 미실행이다. [원문 분석·비용·다음 수정 방향](./DEEPSEEK_DEV_RESULT.md)을 따른다.

이번 보수 비용0.019587달러, 누적16건/0.0290241달러, 미해결0이다. 옛 원장·실패는 보존하고 임시 실행 설정을 복원했다. 실제 원문10건의 로컬 재검증도 같은 결과다. **O1 PARTIAL·v3 개발 FAIL·O2/Stage 미연결**이며 추가 재호출은 하지 않는다. 아래 승인 대기·외부0은 각 이전 작업의 기록이다.

## 직전 — v3 구조 분리 로컬 완료

[v3 구현·검증 상세](./DEEPSEEK_DEV_RESULT.md): 자기 행동의 사용/결과 기록과 appraisal별 감정 범위를 분리했다. 입력 공감은 자기 결과에 붙이지 않으며, 미사용/가정은 관측된 결과 감정을 만들지 않는다. Core 기여·반복 감쇠도 범위별로 구분한다. 새 v3 평가기는 outcome/episode/input을 각각 검사하고 필수 결과 누락을 거부한다. v2 자료·실패는 보존했다.

관련 단위183/183 + 자료·평가기30/30 = **213/213**, 타입 검사 PASS. DeepSeek 모의30, OpenAI 모의 HTTP144, 저장 응답 검사와 독립 검토를 마쳤다. 외부 호출0이며 실제 v3 의미 품질·DB·Stage는 미검증이다. 새 실제 개발30건의 준비 예약은0.1795488달러이고 누적 호출36회가 필요하므로 기존34회 승인으로 실행하지 않았다. **O1 PARTIAL, 이전 실제 개발 FAIL 유지.**

## 직전 — DeepSeek dev2 실제 재평가

[재평가 결과](./DEEPSEEK_DEV_RESULT.md): 총0.20 유지·누적34 승인 후 실제2건을 실행하고 D02의 `affect_missing_episode_evidence`로 중단했다. 미사용 판단은 관측됐지만 타인 결과와 자기 episode 평가가 섞여 개발 FAIL이다. 저장 원문으로 오류를 로컬 재현했으며 추가 모델 호출은 없었다. 누적6건/보수 비용0.0094371달러, 남은28건 미실행. 다음은 episode 연결과 감정 평가 범위의 구조 분리 검토다. 아래 누적34 승인 대기는 승인·실행 전 기록이다.

## 직전 — DeepSeek 실패 후 로컬 수정

[진단 기록·dev2 귀속 지침 수정 결과](./DEEPSEEK_DEV_RESULT.md)를 따른다. 관련313/313·타입 PASS, 모의30와 저장된 사건 응답26의 오프라인 검증을 마쳤다. 추가 실제 호출0이며 기존 D02 실패의 의미 개선은 미검증이다. 다음은 기존 총0.20달러 내 수정본30건 재평가 제안(누적34회 승인 필요)이며 확인/Stage 승격은 하지 않는다. 최종 준비는 deepseek-prepare-r3다.

## 직전 — DeepSeek 실제 개발 평가

별도 USD0.20/개발30 승인으로 실제4건을 호출했고 D04 출력 검증 실패에서 중단했다. D02의 타인 추천/자기 미사용 사건 귀속 오류로 현재 개발 기준 FAIL이다. D01/D03의 제한적 적합과 D04 원인 미확정은 독립 검토했다. 보수적 사용량 비용0.0062196달러, 미해결 예약0, 남은26건 미실행이다. [실제 결과와 다음 수정](./DEEPSEEK_DEV_RESULT.md)을 따른다. 같은 요청 재시도나 확인/Stage 승격은 하지 않았다. 아래 키·예산 미준비는 이전 기록이다.

## 직전 — DeepSeek 연결 준비 당시

사용자가 OpenAI 크레딧 소진을 알리고 공급자 추가를 요청했다. [DeepSeek 결과와 실행 방법](../guides/DEEPSEEK_CONNECTION.md)이 최신 연결 기록이다. 기존 포트·Core·검증기를 유지하고 별도 어댑터/키/원장/개발30 실행기를 추가했다. 관련310/310·타입 PASS, 모의30·실제0이다. 보수적 개발 예약은0.155127달러이며 새 키·별도 예산 승인은 아직 없다. 아래 총5.10 OpenAI 실행 제안과 명령은 보류한다. O1 전체 PARTIAL, 의미 품질·O2/O3는 미완료다. 대사 공급자 등록은 했지만 기존 OpenAI Decisions appraisal 및 O1 Stage 연결까지 자동 대체하지 않았다.

## 직전 — OpenAI 공급자 연결·예산·개발 실행 준비 당시

`OpenAIEventInterpreter`는 사건 해석 전용 포트로 입력8192/출력2048토큰 상한을 사용한다. `OpenAIDialogue.generateTurn`은 추천 annotation을 포함해 출력512토큰을 예약한다. 기존 대화256·자료 답변·Decisions는 유지했다. 공통 Responses 전송 코드를 공유하지만 사건 해석기에 dialogue 역할을 추가하지 않는다. factory와 운영 런타임에는 아직 새 경로를 켜지 않았다.

계수와 생성에 같은 messages·schema·reasoning을 보낸다. 일반 대화 fit은 annotation schema의 계수로 재사용하지 않는다. 원장에는 새 생성 요청의 maxOutputTokens를 기록하고, 옛 항목은256으로 읽으며 변경하지 않는다. 사용량 초과·HTTP 오류·미확인 사용량·지연은 중단/unknown을 보존한다. 근거 인용이 잘못된 새 사건 해석도 자동 재호출하지 않는다.

공식 문서의 [계수](https://developers.openai.com/api/docs/guides/token-counting), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-6 Sol 가격](https://developers.openai.com/api/docs/models/gpt-6-sol)을 확인했다. 기존 보수적 요율인 입력/cache-write $2.50·출력 $10.00/백만 토큰을 유지한다. 계수 호출의 청구 여부는 확인되지 않아 예약을 보존한다. 아래 금액은 청구 예측이나 외부 결제 상한이 아니라 앱의 보수적 예약 계산이다.

| 이번 증거 | 실제 결과 |
|---|---|
| provider-baseline.json | 기존 OpenAI27/27 |
| provider-r1.json | 기존27+신규18 =45/45 |
| provider-regression.json | 관련 OpenAI/Decisions/생성·말투·개인 문맥/새 해석기250/250 |
| provider-review-red.json → provider-review-fixed.json | 개발 재실행 식별자 결함1건 실패 재현 →13/13 |
| 타입 검사 | exit0 |
| provider-rehearsal-r2/manifest.json | 실제 어댑터에 모의 HTTP144회(계수72+생성72), 모두 통과. 외부 API0·의미 품질 NOT_RUN |
| provider-rehearsal-r2/dev-preflight.json | 개발26해석+4추천·계수30의 실행 준비. 실제 원장 hash 불변 |

이번 최종 검사는 **어댑터250 + 자료/실행 식별자13 =263/263**이며 아래 초기122건과 합산하지 않는다. 공급자 코드 검토에서 추가 결함은 없었다. 실행기 검토는 전체 준비 hash가 확인 문항 수정으로 달라져 같은 개발 입력을 재실행할 수 있다는 문제를 찾았다. 개발 요청의 kind/body만 정렬해 hash하도록 고쳤고, 준비 hash에 실행기 소스와 annotation 산출물도 포함했다. 좁힌 재검토에서 두 수정이 확인됐다. 실행은 단일 프로세스를 전제로 하며 서로 다른 실행기를 동시에 돌리는 운영 검증은 아니다.

`evals/affect-probe.ts --rehearse-providers`는 키와 실제 원장을 쓰지 않는다. `evals/affect-live.ts --preflight`는 원장·기존 과거 unknown 승인 ID만 읽고 키·HTTP·쓰기는 사용하지 않는다. 명시적 `--live-dev`는 준비 소스/요청 hash를 재검사하고 개발만 실행하며, 같은 개발 묶음 재시도·확인·전이·Stage를 실행하지 않는다. 유효한 실제 결과도 자동 PASS 대신 의미 검수 대기로 기록한다.

2026-10-17 사전 점검: 기존 원장721항목, 총상한3.50, 예약 합3.1153058, 잔여0.3846942, 과거 unknown2 유지. 개발30출력+계수30의 보수적 예약은 **1.929075**, 최소 필요 총상한은5.05다. 여유를 둔 **총 USD5.10 및 개발30건만** 승인 요청했으며 답변 대기다. 확인30의 예약1.911415와 전이12의0.805695는 참고 계산이고 실행 승인 범위가 아니다. H2-A 실제9장면도 별도다. 아직 키·실제 원장·운영 프로필을 변경하지 않았고 유료 호출은0이다.

## 1. 구현한 것

- `packages/contracts/src/affect-appraisal.ts`: 자연어 성향·목표, 현재 사건, 과거 발화자·전달 사실·검증 범위, 공통 평가 축과 근거 인용 계약. owner/character·revision·시각·실제 전달·설정 인용을 검사한다. 의미가 참이라는 증명은 아니다.
- `packages/character-core/src/event-affect.ts`와 `public.ts`: 긍정·부정·활성도를 분리한 순수 계산, 시간 감쇠, 원인별 익숙해짐·포화, 새 원인에 대한 반응, 중복 억제, 정정·삭제의 의존성 회수. 성향이나 사건 이름에 따른 분기는 없다.
- `packages/adapters/src/event-interpreter.ts`: 같은 프롬프트와 schema에 자연어 설정·사건·근거를 넣는 교체 가능한 해석기. 주입한 transport를 최대1회 호출하고 오류는 unavailable로 반환한다. 후속 `openai.ts` 연결은 위 최신 기록을 따른다.
- `packages/contracts/src/outcomes.ts`, `packages/adapters/src/recommendation-capture.ts`: 추천 annotation 후보와 실제 대사 span 검사, 응답 전체의 shown/finished 완료 조건을 판정하는 순수 함수. annotation 불량은 유효한 대사를 버리지 않는다. 실제 Store ACK 저장·중복 처리는 O2다.
- `packages/contracts/src/ai-ports.ts`: optional `generateTurn`, `EventInterpreter`, `ExperienceReadPort` 계약을 추가했다. 기존 생성·판단 소비자는 유지한다. OpenAI 구현과 모의 HTTP 검증은 완료했지만 ExperienceReadPort의 실제 저장소 연결은 남았다.
- `evals/affect-cases.ts`, `affect-cases.test.ts`, `affect-probe.ts`: dev/confirm-v3에서 결과 기록·자기 사건 감정·현재 입력 감정을 따로 검사한다. v2 문항은 보존하며 annotation/transfer-v2는 그대로 사용한다. 문항 ID·성향 계열·정답·검수 메모는 모델 메시지에 보내지 않는다. 자동 검사 통과도 `REVIEW_REQUIRED`이며 의미 PASS가 아니다.

공통 정책 `event-affect-v3-dev1`은 gain .35, 원인·평가 범위별 상한 .6, 전체 상한 .9, 감정 반감기20분, 익숙해짐 반감기10분이다. 수치는 유지하고 그룹을 `[causeId, episodeId]`로 분리했다. **임시 개발값이며 실제 대화에 검증된 심리 수치가 아니다.** 같은 상태·축·시각에서는 같은 값을 만든다. 긍정·부정을 상쇄하지 않고, 불확실성은 기여를 줄인다. agency/controllability는 해석에 보존하지만 현재 세 수치의 직접 가중치나 대응 선택으로 연결하지 않았다.

새 값은 기존 State의 네 감정에 아직 합산하지 않는다. 참여·침묵·숨김·격식·친밀도를 바꾸는 코드도 이번 추가 경로에는 없다. 여러 번 답이 왔다고 같은 사건의 시각·기여가 늘지 않으며, 새 사건이 들어올 때 원인 ID를 어떤 근거로 묶을지는 O2 host가 소유한다. 모델이 원인 ID를 생성하도록 맡기지 않는다.

## 2. 초기 로컬 기반 검사와 발견한 결함 — 공급자 연결 전 기록

증거 폴더: `${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/`. API·DB·브라우저 실행은0, 키·예산 원장·운영 프로필·모델 설치 변경도0이다. 기존 H2-A 작업을 유지했고 이번 코드 변경은 새 O1 파일과 ai-ports의 추가 계약이다.

| 검사 | 실제 결과 | 범위 |
|---|---|---|
| 시작 기준 `baseline.json` | 63/63 PASS | 기존 Core·말투 지속·포트 |
| 검토 전 새 코드 `core-capture-r2.json` | 41/41 PASS | 초기 Core·해석기·추천 순수 검사 |
| 지적 재현 `review-repro.json` | 29 PASS / 3 FAIL | 아래3개 결함의 수정 전 재현 |
| 수정 후 `review-fixed.json` | 44/44 PASS | 세 회귀 포함 |
| 최종 `final-unit.json` | 110/110 PASS | 새 코드44 + 기존 Core/말투/포트63 + H2-A 개인 정보 생성3 |
| 최종 `final-fixture.json` | 12/12 PASS | 문항 분할·대조·발화자·정답 누출·모의 연결. DB 미사용 |
| TypeScript `--noEmit` | exit0 | 프로젝트 타입 검사 |
| `offline-r1/manifest.json` | 모의 해석64·annotation decoder8 완료 | 일정한 합성 abstention 응답 사용. 의미 품질 `NOT_RUN` |

최종 자동 검사 합계는 **122/122**다. 앞선 단계 검사나 모의72건을 여기에 중복 합산하지 않는다. 전체 suite나 기존 H1/H2-A DB·Chrome 회귀를 재실행한 것은 아니다.

독립 정적 검토에서 세 문제를 확인해 먼저 재현한 뒤 수정했다.

1. A를 정정할 때 무효화된 후속 B의 감정 상태를 새 A 해석이 다시 참고할 수 있었다. 제거될 후속 사건을 참조한 정정은 거부하고 정리된 문맥으로 해석하도록 했다.
2. 일반 input 경로에 outcome을 넣으면 episode 원문 인용 검사를 건너뛸 수 있었다. 입력 종류와 무관하게 연결된 episode 인용을 요구한다.
3. 과거 원문에 발화자 ID가 없어 ‘같은 사람이 설명 뒤 다시 주장했는지’ 보존할 수 없었다. source별 speakerId와 알려진 actor 검사를 추가하고 null은 불명으로 남긴다.

좁힌 재검토에서 추가 필수 결함은 발견하지 않았고 별도 읽기 전용 검사7개를 통과했다. 이는 실제 모델 의미·전체 시스템 감사의 PASS가 아니다. 검토·수정은1라운드다.

## 3. 기준별 현재 상태

| 기준 | 현재 판정 |
|---|---|
| OA01 | PARTIAL: 원문 span·완료 조건·불량 annotation 대사 보존. 실제 생성 구분8건·Store 저장·중복 ACK는 미검증 |
| OA02–04, OA18 | 실제 v3 개발10건에서 D02 미사용·D06 복합 감정·D10 모호한 후보 확정 실패. 개발 FAIL이며 남은20건·가치관/성향 일반화는 미검증 |
| OA05 | 순수 계산 범위 PASS. 모델 재호출의 결정성이나 O2 대응 선택의 동일성까지 주장하지 않음 |
| OA06–07 | NOT VERIFIED: 기존 행동 선택과 아직 연결되지 않음 |
| OA08 | PARTIAL:100회 재수신, 공통 포화, 새 원인, JSON 복원과 감쇠 검사. DB·실제 프로세스 재시작은 O2 |
| OA09–10 | PARTIAL: 참조 폐쇄·정정·owner/config·알 수 없는 과거·전달 검사. DB/생성/침묵/Stage 무효화는 남음 |
| OA11–14 | NOT VERIFIED: 기록 UI, 전체 통합·Stage·기억/감정 대조는 미구현 |
| OA15 | PARTIAL: public 순수 진입점과 외부 의존 검사. PostgreSQL/in-memory 포트 일치 검사는 남음 |
| OA16–17 | PARTIAL: 자료 분리·공통 프롬프트·복합 극성·중복/감쇠의 로컬 검사. 실제 의미·표현과 확인 전 버전 고정은 남음 |

개발/확인 본문은 각각24(결과12·가치관12, 경로별 명확8·보류4)다. 개발 가치관은 존중·정확성·약속 이행의3계열, 확인은 탐구·공평·자율의3계열이다. 설정만 바꾸는 대조는 분할마다2개를 별도로 둔다. 본문48 + 설정 대조4 + 전이 진단12 = 의미 입력64개, annotation8개까지 출력 요청 후보72개다.

양쪽 문항을 같은 작성자가 만들었다. 계열 이름의 분리 검사는 의미적 독립성을 자동 증명하지 않는다. 확인 모델 출력은 아직 없으며 확인 결과에 맞춘 튜닝도 없다. 직접 대화의 미등록 성향은 지원 대상이고, 책/음식·계획 등의 행동 capture와 외부 자료의 감정 원인화만 미지원 경로로 구분한다. 진단용 합성 과거를 실제 행동 기록으로 세지 않는다.

## 4. 다음 순서와 남은 구현

1. **O1 구조 수정·실제 평가 기록:** v3 범위 분리·모의 검증 뒤 실제10건을 추가 평가했고 실패했다. 세 번의 부분 실제 실행과 원문·원장을 보존한다. DeepSeek 키는 이미 제공됐으며 새 키 요청은 없다. OpenAI 유료 실행은 크레딧 소진으로 보류한다.
2. **O1 잔여 의미 평가:** 후보 권한·관측별 평가를 로컬 검증했다. D02는 의미 오판이 남았으므로 자기/타인 사용·미사용·가정·사용 후 대기와 D06/D10의 실제 비교 범위를 좁힌다. full30 예약0.176322에 기존0.0290241을 더하면0.2053461달러, 누적46회가 필요해 현 승인 한도로 실행하지 않는다. 동일 후보 재시도와 남은20건 자동 재개는 하지 않는다. 이전 실패·원장을 보존하며 확인·전이·Stage는 개발 적격 이후다.
3. **O2:** 자연어 설정의 버전 고정·읽기 경로, 실제 전달 사건과 평가의 DB 수명, 현재 감정·이력의 유효 snapshot, 원인 묶음, 기존 social과의 중복 억제·한 번의 commit, 관련 다음 선택·숨김·말투·정정/삭제·검사 UI를 연결한다. 현재 seed `character_configs.body`에는 preset 식별자만 있으므로 자연어 본문이 이미 있다고 가정하지 않는다.
4. **O3:** 실제 Stage10흐름, 기억/감정/성향 대조, PostgreSQL과 in-memory SDK 소비 계약을 검증한다. 전체 목표 완료는 여기까지의 필수 기준으로 판단한다.

H2-A 실제9장면의 총 USD3.60 제안은 별도 승인 대기다. 기존 USD3.50이나 H2-A 승인을 새 O1 호출의 권한으로 쓰지 않는다. 이번에는 실제 API 호출·commit·tag·push를 하지 않았다.

## 5. 재실행 방법

저장소 루트에서 실행한다. 별도 로컬 저장소 쓰기 승인이 필요한 환경은 정상 승인 경로를 이용한다. 기록 폴더는 새 이름을 쓰며 기존 증거를 덮어쓰지 않는다.

```powershell
$env:TEMP = '${ARTIFACT_ROOT}\affect-appraisal-o1-20261017\tmp'
$env:TMP = $env:TEMP
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
node node_modules/vitest/vitest.mjs run --config vitest.config.ts --no-cache packages/character-core/src/event-affect.test.ts packages/adapters/src/event-interpreter.test.ts packages/adapters/src/recommendation-capture.test.ts
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts --no-cache evals/affect-cases.test.ts
node --experimental-transform-types evals/affect-probe.ts --prepare --output ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/offline-r2
```

`affect-probe.ts`에는 live 모드가 없다. 위 명령으로 키를 읽거나 공급자에 요청하지 않는다. 최신 공급자 모의 검증은 `--prepare` 대신 `--rehearse-providers`와 새 출력 폴더를 사용한다. 운영 캐릭터에서 새 감정 기능을 켜는 실행 명령은 O2 연결 뒤에 제공한다.

아래 OpenAI 명령은 공급자 연결 당시 기록이다. 크레딧 소진으로 보류했으며 옛 준비 hash는 현재 v3 소스와 일치하지 않는다. 현재 DeepSeek 준비/실행 경계는 [연결 문서](../guides/DEEPSEEK_CONNECTION.md)를 따른다.

```powershell
node --experimental-transform-types evals/affect-live.ts --preflight --prepared ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/provider-rehearsal-r2
```

아래는 **총5.10·개발30 승인 후에만** 사용할 명령이다. 실행기가 원장 총상한을 자동 변경하지 않으며, 변경 전후 모든 기존 항목 동일성을 확인해야 한다.

```powershell
node --experimental-transform-types evals/affect-live.ts --live-dev --prepared ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/provider-rehearsal-r2 --approved-total-usd 5.10 --output ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/live-dev-r1 --allow-paid-providers --synthetic-inputs
```
