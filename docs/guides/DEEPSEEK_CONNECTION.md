# DeepSeek 연결과 검증 — 2026-10-18

<a id="cx-stage-preparation"></a>
## 현재: CX 실제 생성8회→DB→Stage 검증 완료

2026-10-21: 사용자 승인으로 원장 `limitUsd`를0.25→0.35로 올리고 C2-P 개발24호출을 실행했다([결과](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md#r4-c2p-dev2-result)). 이어 정정 귀속 수정 후 24호출을 추가로 실행해 현재 원장은207항목·차감0.1459173, 최초64항목 이후0.0828285/추가 승인0.20이다. C2-P 실행기는 기준점 hash와 추가0.20 한도를 장면마다 검사한다. 기존 cap0.25와 시작151항목을 전제하는 CX 실행기(`contextual-expression-live.ts`, `contextual-stage.ts`)는 이 원장을 거부하므로 재사용하려면 새 준비·승인이 필요하다.

[실제 실행 결과](../plans/OUTCOME_AFFECT_PLAN.md#contextual-stage-live-20261018): `evals/contextual-stage.ts`로 실제 DeepSeek 생성8회·침묵1건·8세그먼트·16 ACK를 검증했다. 판단·감정 조건은 합성 통제이며 실제 판단 호출은0이다. 원문 재생도 일치했다. 기술 전달 PASS이고 CX-SF01·표현 여운·경어 품질은 후속이다. 제품 설정·소스·키 파일을 변경하지 않았다. 초기 준비·모의에는 실제 키/원장 접근이 없었으며 이번에는 명시적 실호출 승인으로 기존 키와 원장을 사용했다.

이번 usage 기반 보수 차감은USD0.0051591, 누적159회·USD0.1161756/0.25·미해결0이다. 최초64회 이후 추가 승인 사용액은USD0.0530868/0.20이며 실청구액은 아니다. 기존151항목 보존·잠금 해제·키 파일 바이트 불변을 확인했다. **누적 호출 승인159/159는 소진했으므로 아래 실호출 인수는 실행 기록이며 재사용하지 않는다.** 다음 호출은 새 범위·시작점·호출 한도와 잔여 예산을 맞춘 뒤 별도로 진행한다.

빌드와 실행 결과는 로컬 `${ARTIFACT_ROOT}` 아래에 둔다. 해당 루트는 사용자가 지정한 AI 자료 폴더이며 저장소 문서에는 머신 절대 경로를 기록하지 않는다. `${UI_ROOT}`는 그 아래 새 Vite 빌드, `${PREPARED}`는 준비 JSON, `${PREPARED_HASH}`는 그 파일의 SHA256이다. DB는 기존 테스트 계정의 인증 설정을 사용하되 매 실행 새 `character_runtime_cx_stage_mock_20261018_rN` 또는 `character_runtime_cx_stage_live_20261018_rN` DB로 제한한다. 기존 DB 초기화·삭제는 하지 않는다. 비밀번호를 명령·문서에 쓰지 않고 프로세스의 `PGPASSWORD`로 전달한다.

```text
node node_modules/vite/bin/vite.js build --config apps/studio/vite.config.ts --outDir ${UI_ROOT}
node --experimental-transform-types evals/contextual-stage.ts --prepare --out ${ARTIFACT_ROOT}/prepared --ui ${UI_ROOT}
node --experimental-transform-types evals/contextual-stage.ts --rehearse --out ${ARTIFACT_ROOT}/mock --ui ${UI_ROOT} --prepared ${PREPARED} --prepared-hash ${PREPARED_HASH} --database ${NEW_MOCK_DATABASE_URL} --chrome ${CHROME_EXE} --synthetic-inputs
```

이번 실제 실행은 위 모의 경로의 `--rehearse`를 `--live`로 바꾸고 새 live DB·새 출력 폴더를 지정했다. 함께 사용한 인수는 `--allow-paid-providers`, `--ledger`, `--ledger-hash`, `--origin`, `--origin-hash`, `--key-file`, `--approved-max-calls 159`, `--approved-additional-usd 0.20`이다. 키 파일의 `DEEPSEEK_API_KEY`만 읽고 증거에 복사하지 않았다. 키를 채팅이나 CLI 값으로 붙이지 않는다. 승인 원점은 최초64항목, 시작 원장은151항목의 동일 prefix였으며 기존 총USD0.25/최초 승인 이후 추가USD0.20 누적을 유지했다. 8회 보수 예약 상한USD0.0811008은 실제 사용액 예측이 아니다. 현재159항목은 시작 전제151과 달라 같은 live 실행기는 거부한다. 실패 후 재시도·다른 공급자 우회는 없다.

생성 원문·실제 DB 문장·Stage 전 문장·shown/finished와 command.result를 연결한다. `results.json`의 기술 전달 PASS는 한국어 품질 PASS가 아니다. 미해결 `CX-SF01`과 자연 감정 도달은 후속으로 유지한다.

이번 실행의 준비 식별자는 `cx-stage-20261018-prepared4/prepared.json`, SHA256은 `53f97d92eab400bcec936a320f62a3490dfbc8f4dacf56fa4e4bb21a69382414`다. UI는 `cx-stage-20261018-build1/ui`와 hash로 연결됐다. 앞선 [감사·수정](../plans/OUTCOME_AFFECT_PLAN.md#contextual-stage-audit-20261018)의 집중133/133·타입·오류5종·모의8발화/침묵1건·9세그먼트/18 ACK는 당시 API0회 증거로 보존한다. 이번에는 소스·UI 변경 없이 실제8발화/침묵1건·8세그먼트/16 ACK를 별도 확인했다. 실제 출력이 모두 단문이어서 모의와 세그먼트 수가 다르다. 결과는 `cx-stage-20261018-live1/`, 재생은 `cx-stage-20261018-live1-replay/`, 사전 확인·원문 검토·정리는 `cx-stage-20261018-live1-checks/`에 있다. 기존 결과 폴더와 DB는 덮어쓰지 않는다.

저장 증거 재생은 다음 명령으로 실행한다. `${RECORDED_RUN}`은 해당 실행의 manifest/results/source/ledger-before를 가진 폴더다. 현재 원장·API 키·DB·네트워크 없이 저장된 스냅샷만 읽으며, 현재 소스와 기록의 hash가 다르면 거부한다. 정상 기록의 `VERIFIED_RECORDED_PASS`는 새 실행 성공을 뜻하지 않는다. FAIL/RUNNING은 `STOPPED`로 유지하고 아직 기록되지 않은 호출 수는 `null`로 남긴다.

```text
node --experimental-transform-types evals/contextual-stage-replay.ts --recorded ${RECORDED_RUN} --out ${ARTIFACT_ROOT}/new-replay
```

오류 통합 검사는 `evals/contextual-stage-failure.test.ts`다. `CX_STAGE_FAILURE_ROOT`(새 증거 폴더), `CX_STAGE_FAILURE_UI`, `CX_STAGE_FAILURE_DB_PROFILE`(`TEST_DATABASE_URL` 설정), `CX_STAGE_FAILURE_CHROME`, `CX_STAGE_FAILURE_DB_START`(사용하지 않은 DB 번호5개)를 지정하고 기존 Vitest 설정에서 이 파일만 실행한다. 필수 환경이 없으면 skip이며 성공 증거가 아니다. 최종 `audit-failures3`의 decoder/usage/late/cancel/finished5건은 모두 합성 전송1회 뒤 중단·추가 생성0·실제 API0이었다. finished ACK 소실은 순번 불일치에 따른 연결 취소를 확인했고 연결 유지 ACK timeout은 미검증이다.

## 이전: CX 내용·표현 수정 검증, 품질 후속1건

2026-10-18 사용자가 승인한 추가 최대USD0.20은 원래64항목부터 누적 적용한다. [현재 수정·원문 판정](../plans/OUTCOME_AFFECT_PLAN.md#contextual-expression-surface-20261018): 두 번의 고정22호출을 실행했고 마지막22개에서 말투·부분 숨김은 충족했으나 불필요한 재확인 요구1건이 남았다. 이번44호출의 usage 비용0.0264657, 승인 이후 전체87호출/0.0479277이다. 원장151회·차감0.1110165·총한도0.25·미해결0이며 과거 항목은 보존했다. 실청구액 확인은 아니고 세 차례 지침 수정 뒤 잔여 문제는 후속으로 남겼다. 전체 CX/O1·Stage 완료가 아니다. 이전43호출/0.021462는 [직전 기록](../plans/OUTCOME_AFFECT_PLAN.md#contextual-expression-audit-20261018)에 보존한다.

전용 `evals/contextual-expression-live.ts`는 `full`, `repair14`, `mixed22`를 구분한다. 마지막 범위는24턴/22생성/2침묵이며 formal 공개·부분 숨김을 추가한 통제 대조다. prepare→모의→소스/원장/승인 경계 감사→실제 실행 순서를 유지한다. 실제 실행은 정확한 준비 hash·현재 원장 파일 hash·이전 호출 수·새 누적 상한 외에 `--authorization-origin-ledger`와 `--approved-origin-hash`가 필수다. 원점 파일의64항목·완료 상태·hash·현재 prefix·기존 cap을 확인하고, 매 호출 전 원점 이후 지출에 새 예약을 더해 추가0.20을 검사한다. 현재 실행부터0.20을 새로 시작하지 않는다. 과거 CLI/준비 자료를 그대로 재실행하지 않으며 기존 C2 실행기도 자동 재개하지 않는다. 이번 평가 뒤 추가 호출은 중단했고 임시 비밀 설정과 잠금을 정리했다.

## 이전: C2-P 수정계획1 로컬 재감사 PASS, 실제 개선 미검증

아래는 C2-P BUILD 당시 증거다. 이후 동일 대화 맥락 재감사에서 집중47건·타입 검사·모의 재생을 확인했다. 현재 작업 순서는 [STATUS](../STATUS.md)를 따른다. 위 CX 생성 평가와 C2-P 실제 의미 평가 준비, O2/O3 전체 연결은 구분한다.

[BUILD 결과·CR01–06](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md#r4-c2p-repair-build)을 따른다. 범위별 인용 선택지, 성향 관련성·기여 귀속 지침, 누락된 role 검사와 scope 판정을 수정했다. 집중192/192·타입 검사, 저장 원문6건 회귀·작성 대조12건, 개발/확인 각각12장면·24가짜 호출의 모의·재생을 통과했다. 증거는 `affect-appraisal-r4c-20261017-c2p-repair1/`이다. 실제 API·키·현재 원장 접근0이며 실제 모델 개선은 미검증이다. 옛 준비 hash는 새 소스에서 사용할 수 없다. BUILD 뒤의 재감사는 완료했으며 실제 모델 개선 평가는 남아 있다.

## 직전 실제 평가: 개발12회 호출 후 A06 계약 오류로 중단

[실제 결과와 원문 검토](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md#r4-c2p-dev-result)를 따른다. 원장 연결 수정분 재감사 PASS 뒤 사용자 승인으로 총 USD0.25·누적76회를 적용해 개발만 실행했다. A01–A06에12회 호출했고 A06의 null 범위에 episode 근거가 섞여 중단했다. 전체 해석 성공5·자동 rubric 일치3이며 원문 검토는 적합1·보류2·불일치2·계약 거부1이다. 나머지6장면과 확인 평가는 미실행이다.

기존52항목 보존·누적64/76회·보수 차감0.0630888/0.25·미해결0, 임시 설정 바이트 복원·잠금 해제를 당시 확인했다. 재시도0이며 후속 [저장 원문 기반 수정계획1](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md#r4-c2p-repair-plan)의 로컬 BUILD 결과는 위에 기록했다. 부분 실행을 자동 재개하거나 아래 과거 명령을 다시 실행하지 않는다. 마지막 관측64회 원장은 개발 시작 전제52회와 달라 새 실제 호출에는 별도 계획/승인이 필요하다. 실제 실행 증거는 `affect-appraisal-r4c-20261017-c2p-dev1/`에 보존했다.

## 직전: C2-P 전용 실행 경로 준비·수정 당시 실제 호출0

[현재 진행 상태](../STATUS.md)와 [C2-P 준비·실행 조건](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md#r4-c2p-preparation)을 따른다. 전용 `evals/affect-reconnect-live.ts`의 감사에서 발견한 개발→확인 원장 연결 누락(C2P-A1)을 수정했다. 집중63/63·타입 검사 및 개발/확인 모의·재생을 통과했으며 실제 키·원장 접근이나 API 호출은 없다. 수정분 재감사와 실제 호출 승인이 남았다. 새 준비는 `affect-appraisal-r4c-20261017-c2p-fix1/`이며 옛 준비/승인용 hash를 재사용하지 않는다.

DeepSeekAppraisalProbe는 기존 전송/예산 처리를 재사용한다. 기존 C2-L의 `evals/affect-reconnect.ts`에는 준비·모의·재생만 있고 live 모드나 비밀 설정 로딩은 없다. C2-P는 이를 변경하지 않고 별도 실행기에서 전체 집합과 장면별 예산, 개발 원문 검토, 고정 요청·소스, 공유 잠금을 검사한다. 확인 시 설정 원장의 과거 항목 전체가 검토한 개발 실행의 최종 원장과 같아야 한다. 별도 승인된 총한도 변경만 허용하며 연결 불일치는 출력·예약·전송 전에 거부한다. 재생도 저장된 연결 hash를 검사한다. 운영 어댑터 등록은 하지 않았다.

## 직전: B2 실제8건 완료·누적36회 한도 소진

[OB06–07 결과](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md#r4-b2-result): B1 수정 재감사 PASS 뒤 사용자 승인으로 B2 실제8건을 각1회 실행했다. 계약8/8·고정 outcome8/8·assistant 원문 검토8/8·재생8/8 PASS다. 옛 실패 D02/D09/P02가 이번에 개선됐고 기존 적합5개도 유지했다. 알려진 개발8건의 관찰이며 독립 확인·감정 연결·O1/Stage 완료는 아니다.

이번 usage 기반 보수 차감 USD0.0028878, 누적0.0506409/0.20·잔여0.1493591이며 실청구액 확인은 아니다. 누적36/36회로 호출 한도는 소진했다. 과거28항목 보존·미해결0·설정 바이트 복원·두 lock 없음이다. 추가 호출 없이 R4-C의 확인 평가/감정 재연결 범위를 다음에 계획한다. 기존 repair-r1/mock 준비를 사용했고 새 증거는 outcome-isolation-b2-r1/live 및 replay다. 키 파일의 임시 LOCAL_ONLY/ALLOW_PAID/예산 설정은 원래 바이트로 복원했다. 같은 요청의 자동 재실행은 금지하며 다음 유료 평가는 호출 범위를 별도로 정해야 한다.

## 직전: R4-B1 REPLAN 1 수정 BUILD 완료·재감사 대기

[수정 결과·BR01–06](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md#r4-b1-repair-1-build): 실행기와 회귀 테스트 두 파일에서 출력 소유권과 설정 검증 순서를 수정했다. 경합 상대의 기록 보존·설정 오류 시 출력/호출0·lock 해제·기존 중단/재생 유지가 BR01–06의 BUILD 검증을 통과했다. 새 평가96+provider32=128/128·타입·모의8/재생8 PASS다. 실제 API·키/실제 원장 접근0이며 B2 실제 의미/정산·감정 연결/O1/Stage는 미검증이다.

새 준비는 outcome-isolation-repair-r1/offline, 모의는 mock, 재생은 replay다. source16개 일치·원본/요청 hash와 예약 계산0.0307278 불변, 옛 준비의 source 불일치 사전 거부를 확인했다. 유료 진단은 실행하지 않았으며 다음은 재감사다. 아래 예전 경로는 역사 증거로 보존한다.

## 직전: R4-B1 감사 후 REPLAN 1·수정 미구현

[REPLAN 1·BR01–06](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md#r4-b1-repair-1)에 출력 소유권과 provider 설정 검증 순서의 수정을 확정했다. 다음 BUILD는 `evals/affect-outcome-run.ts`와 `.test.ts` 두 파일, 실제 키/원장 없이 합성 설정·가짜 HTTP로 검증한다. 기존 전송/키 검증·예산 정책·운영 선택은 바꾸지 않는다. B2 유료 실행은 아직 하지 않는다.

수정 뒤에는 새 `outcome-isolation-repair-r1/offline` → `mock` → `replay`를 준비할 예정이며 현재는 존재·완료를 주장하지 않는다. 아래 offline-r2/mock-r1은 수정 전 증거다. source hash를 수동 갱신해 재사용하지 않으며 새 준비에서도 기존 원본/요청 hash와 예약 계산0.0307278이 유지되는지 확인한다. 이번 계획의 코드/테스트 실행·API·키/실제 원장 접근0이다.

## 직전: R4-B1 전용 실행/재생 구현 완료·감사 대기

[R4-B1 인계](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md)의 DeepSeekOutcomeProbe와 evals/affect-outcome-run.ts를 구현했다. 기존 예산·전송 계층을 재사용하고 운영에는 등록하지 않았다.173/173·타입·모의8/재생8 PASS이며 실제 API/모델 추론·키/원장 접근0이다. 다음은 구현 감사이고 B2 유료 실행은 미실행이다.

새 준비는 outcome-isolation-offline-r2, 실제 실행 전 검토할 모의 준비는 outcome-isolation-mock-r1이다. 둘은 artifactVersion outcome-probe-preparation-v2와 source16개를 사용한다. 기존 r1은 역사 증거로 유지한다. 승인 hash는 ec8dc80773eed4d7aff64a02bef3b928e44eb4e3f9acb66d582a7f1dda19736d, 예약 계산은 USD0.0307278이며 준비 자체가 실제 호출 승인은 아니다. 실행 모드·인수·중단 기준과 검증 명령은 위 인계/계획을 따른다.

## 직전: R4-A 감사 PASS·R4-B 전용 실행 경로 계획

[R4-B 계획](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md)에 기존 `DeepSeekChat` 전송/예산을 재사용하는 실험용 `DeepSeekOutcomeProbe`와 전용 실행/재생 CLI를 확정했다. 현재는 미구현이다. 다음 B1은 로컬 구현·가짜8건·replay까지이며 실제 실행은 B2에서 구체 범위를 확인한다. 기존 offline/full-task CLI의 차단과 운영 선택은 유지한다.

구현 후 새 `outcome-isolation-offline-r2` → `outcome-isolation-mock-r1`을 준비한다. 과거 r1 준비/실제 응답은 보존하고 새 실행에 재사용하지 않는다. 기준은 사실 outcome8/8과 원문 의미8/8이며 감정·Stage 완료를 뜻하지 않는다. 현재 원장28회/보수0.0477531·잔여0.1522469·미해결0, 후보8건 예약 계산0.0307278이다. 총0.20/누적36 증액은 필요 없지만 최종 body/요금/잔여는 실행 직전에 다시 확인한다. 이번 API·키 접근·원장 수정은0이다.

## 직전: DeepSeek 유지·R4-A 오프라인 후보 구현 완료

OpenAI 크레딧은 소진 상태다. [R4-A 결과](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md)의 사실 전용 후보와 offline CLI를 구현하고101/101·타입·diagnostic8/작성24 검증을 마쳤다. 실제 API/모델 추론·키/원장 접근0이다. 기존 포트/운영 선택·실제8건의 FAIL은 보존하고 다음은 R4-A 구현 감사다. 새 후보의 실제 의미 품질은 NOT_RUN이다.

```powershell
# r1 폴더는 이미 존재하는 증거다. 새 준비에는 다른 별도 로컬 저장소 폴더를 지정한다.
node --experimental-transform-types evals/affect-outcome-probe.ts --prepare-outcome-probe --output ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/outcome-isolation-offline-r1
```

artifact의 `OUTCOME_OFFLINE_PREPARED`/`outcome-only-diagnostic-v1`은 기존 refs 실제 준비와 다른 과제다. 원본은 `original-inputs.json`, 전송은 `requests.json`, 작성 대조는 `authored-results.json`으로 구분한다. 해석 결과에는 감정 appraisals/status를 반환하지 않고 운영 `EventInterpreter`에 연결하지 않는다. 기존 실제 CLI는 이 manifest를 거부하며 새 live 옵션은 없다. 예약 계산 USD0.0307278은8건의 보수 계산값이지 실제 차감이나 호출 승인이 아니다.

## 직전: R3-B 실제8건 완료

[실제 실행 결과](../results/DEEPSEEK_DEV_RESULT.md): 별칭 참조8/8 통과, 고정 의미 기준4/8 FAIL이다. `refs-deepseek-live-r1`은 이미 실행했고 동일 요청 재실행은 차단된다. 이번 보수0.0108264달러·누적28회/0.0477531·미해결0, 설정을 원래 바이트로 복원했다. 아래 실행 명령은 이력이며 새 호출 지시가 아니다.

## 직전: R3-A 실행 경로 구현·모의 검증 완료

[R3-A 결과](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md): 새 DeepSeek `--live-reference-diagnostic` 모드만 refs 실제 경로를 제공하며 고정8건·명시 승인 요청 hash·원본/전송/준비 일치를 키 읽기 전에 검사한다. 기존 OpenAI와 UUID live 경로는 계속 refs를 거부한다. 관련30/30·타입·새 모의8 PASS이며 실제 호출0이다. 다음은 R3-A 감사 후 R3-B 실제8건 범위 확인이다. 명령의 플래그만으로 사람의 실행 승인을 대신하지 않는다.

최신 준비는 `${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/refs-deepseek-prepare-live-r1`이며 예약 USD0.0484908이다. 아래 실제 명령은 **R3-B에서 이미 실행한 이력**이다. 준비·범위·실행 직전 원장/요금/설정을 확인한 뒤 한 번 실행했으며 동일 후보를 재호출하지 않는다. 키는 이미 있는 파일을 사용하고 채팅/명령 인자로 전달하지 않는다.

```powershell
node --experimental-transform-types evals/affect-deepseek.ts --live-reference-diagnostic --output ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/refs-deepseek-live-r1 --prepared ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/refs-deepseek-prepare-live-r1 --wire-format refs-v1 --approved-request-hash 952a8661bc547c89cc2fee408e0ae64e0ee7964ad6c22927adb1b3b443776545 --allow-paid-providers --synthetic-inputs
```

## 현재 구현: refs-v1 로컬 후보·기존 유료 실행 차단

[R2 BUILD 결과](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md)를 따른다. 기본 UUID는 유지한다. 공통 별칭 후보는 `DeepSeekEventInterpreter`/`OpenAIEventInterpreter`의 명시적 두 번째 인자 `refs-v1`로 선택하며 운영 env 선택은 추가하지 않았다. 아래는 R2 모의 진단8과 replay 이력이다. 기존 `--live-dev`/`--live-diagnostic`는 refs 요청/manifest를 키·원장 전에 거부하고 위 새 모드만 별도로 검사한다. 실제 공급자 품질은 미검증이다.

```powershell
# 아래 폴더는 이미 검증 증거가 있으므로 새 실행에는 새 경로를 사용한다.
node --experimental-transform-types evals/affect-deepseek.ts --prepare-diagnostic --wire-format refs-v1 --output ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/refs-deepseek-mock-r1
node --experimental-transform-types evals/affect-probe.ts --rehearse-reference-diagnostic --wire-format refs-v1 --output ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/refs-openai-mock-r1
node --experimental-transform-types evals/affect-deepseek-replay.ts --recorded ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/refs-deepseek-mock-r1 --output ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/refs-deepseek-replay-r1
```

`event-inputs.json`에는 필터 전 합성 UUID 요청을 보존한다. replay는 버전·원본/source/wire hash를 확인하고 같은 요청을 재생성한 뒤 decode한다. 과거 UUID 기록은 visible-input 범위에서만 재검증하며 원본 전체를 복원했다고 하지 않는다. 관련164검사·타입·모의/replay와 로컬 구현 감사를 통과했다. 아래 실제4건 기록은 R2 구현 전 UUID 후보의 기록이다.

## 현재: 승인된 진단8 중 실제4건에서 중단

`deepseek-diagnostic-live-r1` 실행은 D09의 잘못된 출처 UUID로 중단됐다. D01/D06 핵심 의미는 적합, D02는 중립 self 항목의 고정 agency 기준 FAIL이며 실제 자기 결과 오귀속은 없었다. [상세·Core 대조·후속](../results/DEEPSEEK_DEV_RESULT.md)을 따른다. 남은4건 미호출, 자동 재시도 없음. 누적20건/보수0.0369267달러·미해결0, 총0.20·누적36 유지. 임시 설정은 원래 키 파일로 복원했다. 아래 실제 명령은 **이미 실행한 이력**이며 동일 시도는 차단된다.

## 직전: 진단8 준비 및 승인 요청 당시

기존 개발6건과 새 대조2건의 고정 진단을 추가했다. [문항·성공 기준·검증 결과](../results/DEEPSEEK_DEV_RESULT.md)를 따른다. 로컬41/41·타입 PASS, 모의8/기존30 PASS, 실제0이다. 준비는 `deepseek-diagnostic-prepare-r1`, 예약0.0531702달러로 기존 총0.20·누적36회 안이다. 아래 실제 명령은 **새8건 범위 승인 후** 사용하며 자동 재시도하지 않는다. 기존16건과 실패 기록을 보존한다.

```powershell
# 오프라인 준비. 이미 존재하는 r1 폴더를 덮어쓰지 않으므로 새로 준비할 때는 새 경로 사용.
node --experimental-transform-types evals/affect-deepseek.ts --prepare-diagnostic --output ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/deepseek-diagnostic-prepare-r1
# 준비 hash 및 기존 원장·총상한·누적횟수와 승인 문구를 확인한 뒤 실행.
node --experimental-transform-types evals/affect-deepseek.ts --live-diagnostic --output ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/deepseek-diagnostic-live-r1 --prepared ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/deepseek-diagnostic-prepare-r1 --allow-paid-providers --synthetic-inputs
```

아래 full30 준비는 이전 검증 기록이다. 이번 실행기 변경으로 이전 준비의 소스 hash는 현재와 다르므로 실제 실행에 재사용하지 않는다. 기존30 경로의 현재 모의 호환성 증거는 `deepseek-dev-compatibility-r1`이며 전체30의 새 유료 실행 승인을 뜻하지 않는다.

## 이전 연결·평가 기록

**2026-10-17 최신 v3-dev2 로컬 수정:** 불완전 검색의 episode를 모델 입력에서 제외하고 요청 schema를 허용 ID/null로 제한했다. 원본 입력의 사후 검증은 유지한다. 같은 목표도 서로 다른 현재 관측의 양·음 평가를 허용하며 인용 순서·중복·과거 근거 추가를 통한 복제는 거부한다. 관련234/234·타입 PASS, DeepSeek 모의30/OpenAI 모의 HTTP144·추가 API0이다. D02 미사용 의미 오판은 미해결이고 실제 D02/D06/D10 FAIL을 보존한다. O1 PARTIAL·운영/Stage 미연결이다. [구현·증거·후속](../results/DEEPSEEK_DEV_RESULT.md)을 따른다. 새 준비는 deepseek-prepare-v3-dev2-r1이다. full30 예약0.176322·누적46회는 기존 총0.20·누적36 한도를 넘어 실행하지 않는다. 아래 live-v3-r1 명령은 실패한 이전 후보의 기록이다.

아래 연결·실행 이력은 당시 기록이다. 현재 소스와 다른 r1/r3 준비로 실행하지 않는다.

**직전 실제 재평가:** 총0.20 유지·누적34 승인으로 r3를 실행했으나2건째 D02에서 출처 검증 실패로 중단했다. 당시 원장 누적6건/보수 추정0.0094371달러이며 남은28건 미실행이다. 같은 r3의 재실행은 차단됐다.

**이전 로컬 수정:** [dev2 지침·진단 보존·재평가 준비](../results/DEEPSEEK_DEV_RESULT.md)를 완료했다. 313/313·타입 PASS, 모의30/replay26이며 실제 추가 호출0이다. 당시 준비 경로는 `deepseek-prepare-r3`였다. 아래 r1 실행 명령은 연결 준비 당시 기록이고 현재 소스와 hash가 맞지 않아 사용하지 않는다. 새 실제 실행은 총0.20달러 내 수정본30건/누적34회 승인 확인 뒤 `deepseek-live-r2`에 남기는 제안이다.

**후속 실제 실행:** 사용자가 별도 USD0.20/개발30을 승인해4건 호출했고 D04 `invalid_output`에서 중단했다. D02는 타인 추천의 실패를 자기 미사용 추천에 연결한 의미 실패다. 사용량 기반 보수 추정은0.0062196달러이며 남은26건은 미실행이다. [실제 결과·실패·다음 수정](../results/DEEPSEEK_DEV_RESULT.md)이 현재 상태다. 키는 저장됐고 임시 유료 실행 설정은 복원했다. 아래 실제0회·키/승인 미준비는 연결 준비 당시 기록이다.

최초 연결 당시: 사용자가 OpenAI 크레딧 소진을 알리고 DeepSeek 연결을 요청했다. OpenAI 총 USD5.10 증액/개발30 실행 제안은 보류한다. 기존 OpenAI 키·원장·운영 프로필은 수정하지 않았다. **DeepSeek 연결 구현·모의 검증 완료, 실제 호출0회, 의미 품질과 Stage 미검증**이다. 새 유료 공급자의 키·예산·실행 범위를 따로 확인한 뒤 실행한다.

## 구조와 범위

`contracts/ai-ports.ts`의 `EventInterpreter`(사건 해석)와 `DialogueGenerator`(대사/자료 답변/추천 생성)가 포트다. `DeepSeekEventInterpreter`와 `DeepSeekDialogue`가 외부 어댑터이며 OpenAI 구현을 상속하거나 호출하지 않는다. 자연어 성향의 해석 지침, 출처/인용 검증, 추천 annotation 검증과 순수 감정 Core를 재사용한다. 공급자 변경을 이유로 사건별 감정 규칙을 추가하지 않았다.

- 대사 공급자는 `apps/runtime/src/providers.ts`에서 `DIALOGUE_PROVIDER=deepseek`, `DIALOGUE_MODEL=deepseek-flash`로 선택할 수 있다. 기본 선택·실제 운영 설정은 바꾸지 않았다.
- 새 사건 해석은 O1 평가 실행기에서 연결했다. O2의 DB/선택/표현/Stage 연결은 아직 남았다.
- 기존 `AppraisalProvider`와 새 `EventInterpreter`는 다른 계약이다. 대사를 DeepSeek로 바꿔도 `APPRAISAL_PROVIDER=openai-decisions-*`는 OpenAI를 계속 필요로 한다. 이 요청에서 Decisions를 DeepSeek로 자동 번역하거나 Jev로 전환하지 않았다. 따라서 **현재 운영 프로필 전체가 OpenAI 없이 동작한다고 주장하지 않는다.**
- 감정 Core와 포트는 공급자 독립 구조다. OpenAI의 기존 평가 실행기/원장에는 공급자별 구현이 남아 있으며 이번에는 이를 변경하지 않고 별도 DeepSeek 연결을 추가했다.

## 공급자 계약과 비용

현재 공식 문서의 `deepseek-flash`, Chat Completions, `thinking.type=disabled`, `response_format.type=json_object`를 사용한다. JSON 모드는 구조 전체의 정합성을 보장하지 않으므로 공통 로컬 검증기를 반드시 통과해야 한다. 빈 응답·잘린 출력·모델 불일치·도구 호출·잘못된 JSON/근거는 실패로 처리하며 재시도하지 않는다. [API 계약](https://api-docs.deepseek.com/api/create-chat-completion/)과 [JSON 모드](https://api-docs.deepseek.com/guides/json_mode/) 기준이다.

OpenAI 토큰 계수 API를 재사용하지 않는다. 전체 요청 JSON의 UTF-8 바이트수+1024를 입력 토큰의 보수적 추정치로 사용하고32768을 넘으면 호출 전 차단한다. 최근 대화는768바이트의 보수적 제한으로 줄인다. **정확한 토큰 계수가 아니며 기존 OpenAI의3328/8192 정확 계수 정책과 동일하지 않다.** 실제 usage가 예약 입력량을 초과하면 전체 예약 또는 더 큰 관측 비용을 남기고 중단한다. 출력은 일반/자료256, 추천512, 사건2048토큰이다.

비용은2026-10-17 확인한 peak/cache-miss 입력$0.30·출력$1.20/백만 토큰을 사용한다. 캐시·비수기 할인은 예약에 적용하지 않는다. 실제 청구액 보증이 아닌 앱의 보수적 제한이며 요금 변경 시 재확인이 필요하다. [공식 가격표](https://api-docs.deepseek.com/quick_start/pricing/).

`DeepSeekBudget`은 공급자·모델·요금·누적 호출 수·명시 승인 문구를 가진 별도 원장을 사용한다. OpenAI 원장은 형식 검사에서 거부한다. HTTP 오류/사용량 미확인 시 예약액을 유지하고, 새 unknown/reserved가 있으면 재시작한 인스턴스도 차단한다. 논리 시간 초과 뒤 실제 요청이 진행 중이면 reserved를 유지한다. 원장 상한 자동 증액·초기화·unknown 우회는 없다.

## 키와 실행 방법

키 입력 파일: `runtime-data/deepseek.env`. 키가 이미 제공됐으며 이 파일을 덮어쓰거나 키를 다시 요청하지 않는다. `.gitignore`의 `runtime-data/`와 `*.env`에 의해 제외된다. 이번 로컬 구조 변경에서는 실제 키를 읽거나 출력하지 않았다. `scripts/env.ts`가 기존 환경/설정 다음에 이 파일을 읽으며 앞서 설정된 환경값이 우선한다.

키를 저장하는 것만으로 과금 실행은 켜지지 않는다. 실제 O1 실행을 승인받으면 이 파일에 다음 별도 설정을 적용한다. 금액·누적횟수·승인 문구는 실제 승인 범위와 일치해야 한다. 아래는 값의 이름을 설명하는 예시이며 그대로 실행할 설정이 아니다.

```dotenv
LOCAL_ONLY=false
ALLOW_PAID_PROVIDERS=true
DEEPSEEK_API_KEY=
DEEPSEEK_BUDGET_PATH=${ARTIFACT_ROOT}/deepseek-o1/budget.json
DEEPSEEK_BUDGET_USD=0
DEEPSEEK_MAX_CALLS=0
DEEPSEEK_BUDGET_AUTHORIZATION=
```

원장 부모 폴더는 미리 만들고 실제 키·원장·실행 산출물은 공유하지 않는다. O1 실행기는 이 파일의 설정을 직접 읽으며 기존 OpenAI 설정에서 값이나 승인을 복사하지 않는다. Stage의 대사 공급자 선택에는 위의 `DIALOGUE_PROVIDER`/`DIALOGUE_MODEL`도 필요하며 기존 appraisal 설정을 별도 점검해야 한다.

무료 로컬 준비 명령(매번 새 출력 폴더):

```powershell
node --experimental-transform-types evals/affect-deepseek.ts --prepare --output ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/deepseek-prepare-v3-new
```

기존 증거를 덮어쓰지 않도록 매번 새 폴더 이름을 쓴다. 현재 검증 완료 준비는 `deepseek-prepare-v3-dev2-r1`이다. 이 모드는 키/실제 원장을 읽지 않고 가짜 전송 응답으로30건을 검사한다. 실제 평가용 입력은 개발26해석+4추천뿐이며 정답/rubric은 모델에 보내지 않는다.

**2026-10-17 승인 후 실행한 명령 기록**이다. D10에서 중단했고 결과 폴더와 원장 시도 기록이 있으므로 재실행하지 않는다:

```powershell
node --experimental-transform-types evals/affect-deepseek.ts --live-dev --output ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/deepseek-live-v3-r1 --prepared ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/deepseek-prepare-v3-r1 --allow-paid-providers --synthetic-inputs
```

v3 개발30요청의 보수적 합계는 **$0.1795488**. 사용자 승인 후10건을 호출하고 출력 오류로 중단했으며 현재 원장 누적16건이다. 남은20건은 자동 재개하지 않는다. 입력·소스 hash가 바뀌면 준비를 다시 해야 한다. 동일 개발 요청의 실제 재실행을 원장에서 차단하고, 실행기 전체 lock과 원장 요청 lock으로 중복 실행을 막는다. 확인/전이/Stage/H2-A·자동 재시도는 포함하지 않는다. 의미 판정은 실제 원문 검수 전까지 REVIEW_REQUIRED다.

## 최초 연결 당시 검증 결과

증거: `${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/`.

| 검사 | 실제 결과 |
|---|---|
| 집중 회귀 `deepseek-final.json` | 310/310 PASS. DeepSeek20 포함, 기존 OpenAI/예산/근거·표현 검증. 전체 프로젝트 검사는 아님 |
| 독립 검토 결함 재현 `deepseek-review-red.json` | 19PASS/1FAIL. 일반 대화/자료 답변에 Zod 내부 객체를 보낸 결함 |
| 수정 | 생성용 JSON Schema인 format을 우선 사용. 회귀 검사와 독립 재검토 완료 |
| `tsc --noEmit -p tsconfig.json` | PASS |
| `deepseek-prepare-r1/manifest.json` | MOCK_PASS, 가짜 전송30회, 실제0회, 미해결 예약0 |
| 키 파일 ignore / `git diff --check` | PASS |

실제 HTTP 호환성, 한국어 의미 품질, 실제 과금·시간 초과, Stage 동작을 검증한 결과는 아니다. 모델·요금·전송 방식이 바뀌므로 과거 OpenAI 품질 결과를 DeepSeek 결과로 승계하지 않는다. 다음은 새 키와 DeepSeek 예산 승인 뒤 개발30건 원문 평가이며, O2/O3는 그 이후다. 커밋·태그·푸시는 하지 않았다.
