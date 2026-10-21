# O1 평가 진단·모델 참조·사실 판정 분리 — 2026-10-17

현재 상태는 [진행 상태](../STATUS.md)를 따른다. C2-L과 C2-P 원장 연결 수정분의 로컬 감사는 PASS다. 실제 C2-P 개발 평가는 아래와 같이 중단됐으며 전체 통과가 아니다. 과거 단계의 다음 작업과 비용은 당시 기록이다.

<a id="r4-c2p-repair-build"></a>
## C2-P 수정계획 1 BUILD — 2026-10-17

**구현·로컬 검증과 동일 대화 맥락 재감사 PASS. 실제 모델 품질은 미검증.** 사용자가 저장 원문 회귀·대조12건·모의·재생까지 승인했고 실제 API 호출은 금지했다. 아래 BUILD 당시 수정계획의 코드/테스트8파일과 이 문서·STATUS·DeepSeek 안내3파일을 수정했다. 기존 미커밋 작업을 보존했으며 커밋·푸시·운영 연결은 하지 않았다.

후속 감사에서는 집중47건·타입 검사, 개발/확인 재생24장면과 당시 소스 hash11개·보존 증거13개를 확인했고 추가 필수 수정은 없었다. 증거 식별자는 `affect-appraisal-r4c-20261017-c2p-repair1-audit1/`이다. 이번 표현 계획 문서 갱신은 그 뒤의 작업이며 과거 verification에 저장한 문서 hash는 당시 판본으로 보존한다. 새 [문맥에 맞는 표현 계획](./OUTCOME_AFFECT_PLAN.md#contextual-expression-plan-20261017)의 [로컬 BUILD](./OUTCOME_AFFECT_PLAN.md#contextual-expression-build-20261017)는 C2의 사실·감정 해석 정답이나 실제 실패를 바꾸지 않는다. 공유 Core 변경 뒤의 실제 재실행에는 새 준비 hash가 필요하며 이 C2 감사 기록은 당시 소스 범위로 보존한다.

`appraisal-probe.ts`의 지침을 `fixed-outcome-appraisal-v2`로 바꿨다. 성향 관련성을 먼저 판단하고, 미사용이나 favorable 자체에서 감정을 만들지 않도록 구분했다. 독립적인 공감·좋은 소식·설명 이해의 관련 성향·복합 감정은 허용한다. 제안의 기여와 보고/실행 주체를 구분하고 외부·타인·불명확한 기여를 유지한다. 요청 schema는 null 범위에서 모든 episode 근거를 제외하고, 관측된 결과의 episode 범위에서는 선택된 episode만 허용한다. 전체 읽기 맥락과 인용/revision, fixed outcome, 공용 계약·decoder·Core 계산식은 그대로다. JSON mode의 schema·지침 준수 여부는 실제 모델 평가가 필요하다.

A01/A03 fixture는 기존 notes/authored 의도에 맞는 `roles`만 채웠다. `checkReconnectCandidate`의 role 실패는 해당 scope도 FAIL로 표시한다. 계약 검사가 불가능한 `NOT_EVALUATED` 범위는 유지한다. 새로운 회귀 fixture는 저장 원문6건과 작성 대조12건을 분리하고 원래 판정·출처/hash를 보존한다. 기존 live 테스트의 전체 요청 hash 상수 대신 수정 전 사실12개 body의 aggregate hash를 확인한다. 사실 단계 aggregate는 `a8bed8bf5181515b78e899559d665fc26a2a997ea1ed896258cea5be850a6b23`으로 불변이다.

| 기준 | BUILD 결과 | 확인 범위 |
|---|---|---|
| CR01 범위 | PASS — 로컬 | null/미사용/가정/불명/결과 pending·unknown에서 episode 근거 제외, 완료 결과의 두 branch와 다른 episode 거부, 맥락·근거 제약 보존 |
| CR02 의미 대조 | PASS — 작성 대조·저장 원문 회귀 | 원문 A04/A05 의미 실패 유지, A06 거부 유지. 관련/무관 성향·독립 공감·복합 감정 등 작성12건 decode/rubric/Core 기대 일치. 모델 개선 증거 아님 |
| CR03 귀속 | PASS — 로컬 | A01/A03 원문을 강화 기준으로 검사하면 actor/target/agency 실패. 귀속만 바꾼 작성 대조는 일치. 양쪽 관측·감정량0의 귀속 오류, external/other/unknown 경계 확인 |
| CR04 보존·무호출 | PASS | 수정 전 공식 재생 보존, 원문·옛 검토 hash 불변, 분모12/미실행6 보존. 실제 API·키·현재 원장 접근0 |
| CR05 구조·회계 회귀 | PASS — 로컬 | 집중192/192·타입 검사, 사실12개 body 불변. 중단/시간 초과/원장 연결·변조 방어 유지. 새 개발/확인 모의·재생 각각12장면/24가짜 호출 일치 |
| CR06 실제 품질 | NOT VERIFIED | 실제 호출0. 새 지침으로 DeepSeek가 과생성·귀속을 개선했는지는 아직 평가하지 않음 |

수정 전 검사에서 범위 schema7건과 귀속/rubric/scope5건의 실패를 재현했다. 최종 단위106 + 통합86 = 서로 다른192검사 통과, 실패0·건너뜀0이다. 새 회귀 테스트의 `it.each` 타입 선언2곳을 보완한 뒤 해당23건과 타입 검사를 다시 통과했으며 중복 합산하지 않는다. 첫 실행은 Windows preload 경로 형식을 `file:///`로 고쳐 시작했다. 테스트·임시 합성 원장·cache·보고서는 새 증거 폴더에만 저장했다. 기존 preload의 실제 설정/원장 read 및 fetch 차단 아래 실행했고, mock/live 분기 테스트의 키·원장은 모두 합성 자료이며 실제 네트워크 증거가 아니다.

원문 결과는 승격하지 않았다. A01/A03의 원래 의미 보류와 자동 REVIEW_REQUIRED를 보존하고 새 rubric 진단만 FAIL로 분리했다. A02는 기존 적합, A04/A05는 의미 FAIL, A06은 `affect_cross_scope_episode_evidence` 계약 거부다. A06에서 잘못된 인용만 제거한 별도 진단도 과생성 rubric에 실패한다. 이 진단은 원본 변경이나 새 공급자 응답이 아니다. 수정 전 공식 재생은 계획12·시도6·호출12·해석5·자동 일치3을 그대로 유지했다.

| 새 모의 준비 | 요청 hash | 예약 상한 | 결과 |
|---|---|---|---|
| 개발 | `ce23453c71d20310ae99420bcf0ccb7e0e9dfbeaf110ce0c99a32f0a0c6797dd` | USD0.1926732 | 모의12/24·rubric12·재생 일치 |
| 확인 | `77c8a7394c856e433a9b1be0207852b03961df11ba7cc8d035748be7c954603c` | USD0.1930590 | 모의12/24·rubric12·재생 일치 |

증거 묶음은 `${ARTIFACT_ROOT}/affect-appraisal-r4c-20261017-c2p-repair1/`이다. `baseline.json`·`before/`·`before-replay/`, `unit-red.json`·`integration-red.json`, `unit-final.json`·`integration-final.json`·`repair-final.json`·`typecheck.log`, `offline-diagnostic.json`, `preparation-summary.json`, `verification.json`, `dev/`·`confirm/`를 사용한다. 새 준비는 과거 준비를 대체 실행하는 승인이 아니며, 옛 준비 자료는 새 소스에서 출력 생성 전에 거부했다. 확인 문항/정답은 수정하거나 지침 예시로 사용하지 않았다.

재감사는 완료했으며 다음은 실제 개발 평가의 범위·시작점·예산을 별도로 맞추는 준비다. 실제 사용의 마지막 기록은64/76회·총한도0.25이며 이번에는 원장을 읽거나 변경하지 않았다. 유료 개발 runner의 기존 시작 전제52회와 맞지 않으므로 재실행·A07–A12 재개·확인 호출은 하지 않는다. 운영 DB·Stage·모델 교체는 이번 범위가 아니다.

<a id="r4-c2p-repair-plan"></a>
## C2-P 개발 실패 후 수정계획 1 — 2026-10-17

**계획 당시: PLAN 완료, 구현·새 모델 평가 미실행. 현재 BUILD 결과는 [위 기록](#r4-c2p-repair-build)을 따른다.** 사용자는 저장 원문에 근거한 수정계획·성공기준·파일 목록을 요청했고 당시에는 아래 계획과 연결 문서만 수정했다. BUILD 범위는 로컬 회귀·모의 검증까지이며 실제 API·키·현재 원장 접근, A07–A12 재개, 실제 확인 평가, 운영 DB·Stage 연결을 포함하지 않는다. DeepSeek 후보의 관측 실패를 런타임 전체나 다른 공급자의 능력 한계로 일반화하지 않는다.

### 근거와 원인 구분

기준은 `affect-appraisal-r4c-20261017-c2p-dev1/live/results.json`과 같은 증거 묶음의 `semantic-review.json`이다. 원문 SHA256은 `0c847b6b958d52850e0ef6bd8d08a06e0af191bc7bd3dbcbadf2db61c98de412`, 검토 SHA256은 `e39e5cb623180eefd339facd21d696e91e0284e139247993883e9179477ba68c`이다. 현재 실행기/테스트는 `c2p-fix1` 재감사 소스 그대로이고, 관련 구현의 기준은 그 준비 자료에 저장된 `sourceHashes`다. HEAD만을 작업 기준으로 삼지 않고 기존 미커밋 변경을 보존한다.

| ID | 판정·원인 | 필수 조치 |
|---|---|---|
| CR-S | A06 계약 거부는 정상. `prepareAppraisalProbe`는 episodeId만 좁히고 evidence 선택지에는 모든 episode를 남김 | 요청 schema의 범위별 근거 선택지를 제한. 기존 host validator 유지 |
| CR-E | A04는 성향과 무관한 성공에 긍정, A05는 미사용 보고에 긍정을 추가. A06에도 미사용만으로 부정을 만든 의미 문제가 있음 | 사실·성향 관련성·충족/충돌을 구분하는 지침과 대조 평가. 코드의 사건/성향별 감정표로 보정하지 않음 |
| CR-A | A01/A03는 실행자·발화 대상과 추천 기여가 혼동될 여지가 있고, notes/authored의 자기 기여 기준을 `roles: []`가 검사하지 않음 | 지침을 명확히 하고 기존 의도를 role rubric으로 명시. 옛 보류 판정을 새 PASS로 바꾸지 않음 |
| CR-R | `checkReconnectCandidate`는 role 오류를 최상위 failures에만 더해 해당 scope가 REVIEW_REQUIRED로 남을 수 있음 | role 오류의 최상위/해당 scope 판정을 일치시키는 작은 수정 |

A04/A05는 형식상 유효해서 평가기의 메모리 내 Core에 불필요한 긍정이 생겼다. 이는 참조 검증이 의미 적합성까지 보장하지 않는다는 증거다. 반대로 A06의 잘못된 근거를 지우기만 하면 의미상 부당한 부정이 구조 검사를 통과할 수 있다. 따라서 원문 자동 정정·근거 삭제·강제 감정0·실패 결과 승격은 하지 않는다.

### 확정한 구현 방향

1. **범위별 요청 schema.** `prepareAppraisalProbe` 내부에서 기존 appraisal item을 복사해 배타적인 branch를 만든다. null branch의 evidence sourceId는 non-episode 참조만 허용한다. fixed outcome이 `used`이고 `favorable/unfavorable/mixed`일 때만, 선택한 episode 하나와 non-episode 참조를 허용하는 episode branch를 추가한다. 관측 결과가 있어도 null branch는 유지한다. 분기는 `anyOf`로 표현하고 공통 필드·인용/revision 제약·상한은 보존한다. persona/goal이 없을 때 `maxItems:0`, 빈 enum 방지도 유지한다.
2. **맥락과 인용 권한 분리.** `codec.wireInput.sources`의 본문·ID·revision, fixedOutcome와 그 evidence는 그대로 전달한다. 읽을 맥락을 삭제하거나 참조 번호를 다시 매겨 오류를 피하지 않는다. 원본 `EventAppraisal`·공용 계약·codec·host validator는 바꾸지 않는다. DeepSeek 현재 JSON mode는 schema를 system text로 전달하므로 선택지 축소가 모델 준수를 보장하지 않는다.
3. **과생성 지침.** 현재 관측이 실제로 configured concern을 충족/충돌하는지 판단한 뒤 appraisal을 낸다. favorable이라는 사실, 아직 미사용이라는 보고, 설명을 이해했다는 사실만으로 관측되지 않은 효과나 긍정/부정을 만들지 않는다. 단, 설명 이해를 중시하는 성향이나 미사용과 별개인 피로/좋은 소식은 해당 concern에 따라 현재 입력 감정을 만들 수 있다. 무관은 `irrelevant/[]`, 불명확은 `uncertain/[]`를 유지한다. 양·음 관측의 병존, 정상 무변화, 기대 근거 규칙은 유지한다. 새 자유서술 추론 필드나 제3 LLM 호출은 추가하지 않는다.
4. **귀속 지침과 평가.** actor/target은 평가하는 행위의 주체/대상, agency는 그 관측에 대한 기여다. 자기 제안의 효과를 평가한다면 보고자·실행자 대신 제안 주체와 수혜자를 식별한다. A01/A03의 기존 자기 기여 의도는 episode `character→speaker`, `self`, `reports`로 검사한다. A03의 양쪽 관측 모두 검사한다. episode가 있다는 이유만으로 self를 강제하지 않는다. 명시적인 사용자/타인 기여, 외부 원인, 인과 불명은 other/external/unknown을 보존하며 public validator에 actor↔agency 등식은 넣지 않는다. Core는 현재 actor/agency를 감정량 계산에 쓰지 않으므로 귀속 오류를 수치 오류와 동일시하거나 gain을 조정하지 않는다.
5. **평가 이력 보존.** A01/A03의 원래 자동 REVIEW_REQUIRED·의미 보류는 그대로 보존한다. 같은 raw를 강화된 rubric으로 검사하면 role 실패로 표시하되, 이것을 새 모델 응답으로 세지 않는다. A04/A05 원본은 의미 FAIL, A06 원본은 계약 거부, A02 원본은 적합 사례로 유지한다. 지침 버전은 `fixed-outcome-appraisal-v2`로 올리고 입력/사실 단계/예상 극성을 답에 맞춰 바꾸지 않는다.

### 성공기준과 검증 경계

| 기준 | 관찰 가능한 완료 조건 | 증거 |
|---|---|---|
| CR01 범위 | 미사용·가정·사용 불명·결과 pending/unknown·outcome null에는 episode branch 없음. 관측 완료에서도 null branch는 episode 근거 금지. 선택한 episode 외의 근거 거부 | probe schema 검사 + 실제 decoder 거부/수락 대조 |
| CR02 의미 대조 | A04/A05 원본은 계속 의미 FAIL, A06 원본은 계속 거부. 작성한 적합 대조는 무관/독립 공감/관련 성향/복합 감정을 각각 보존 | raw 회귀6건 + 아래 새 대조12건. 이는 평가기 검증이며 모델 개선 증거가 아님 |
| CR03 귀속 | A01/A03 원본은 강화 rubric의 actor/target/agency 검사 실패, 귀속만 고친 작성 대조와 A02 원본은 통과. external/other/unknown 정당 사례는 통과 | 원본/작성 대조를 별도 보고. role 실패는 관련 scope와 최상위가 모두 FAIL |
| CR04 보존·무호출 | 원문/hash/옛 검토·12분모·6건 미실행 보존. 소스 변경 전 기존 재생 결과 고정. 수정 후 실패 승격0, 실제 API/키/실제 원장 접근0 | provider I/O 차단, 이전 증거 hash 대조, 새 출력 폴더 |
| CR05 구조·회계 회귀 | 첫 사실 단계12개 body 동일, fixedOutcome 불변, 두 단계만 실행. 첫 실패 뒤 둘째0/둘째 실패 뒤 Core0/다음 장면0, 시간 초과 실패 유지, 원장 연결 거부 유지 | 기존 probe·split·Core 및 reconnect/live 회귀, 타입 검사, 새 모의·재생 |
| CR06 실제 품질 | **이번 BUILD에서는 NOT VERIFIED.** 후속 별도 승인 평가에서 계약12/12·고정 사실12/12·의미/귀속 검토12/12, 금지 과생성0이어야 개발 통과 | 새 모델 응답과 원문 검토가 필요. 모의/저장 원문/자동 rubric만으로 PASS 불가 |

추가 경계: 현재 근거 누락, 다른 episode, 잘못된 quote/revision, 중복, 근거 없는 expectation은 기존대로 거부한다. source 본문에 UUID나 `r1`이 있어도 본문은 불변이다. 같은 concern의 서로 다른 현재 관측은 긍정·부정을 상쇄하지 않는다. role 오류의 수치를0으로 낮춰도 귀속 검사 실패는 유지한다.

새 대조12건은 개발용 회귀다. 기존 확인 V01–V12의 문항·답을 프롬프트 예시로 사용하거나 수정하지 않는다. 아래 결과는 **모델 출력 예측이 아닌 검증용 작성 대조의 기준**이다.

| ID | 대조 입력·성향 | 요구 결과 |
|---|---|---|
| R01 | 파란 표지가 마음에 듦 / 예의를 중요시 | favorable 사실 유지, 감정 없음 |
| R02 | R01과 같은 사실 / 보기 좋은 색 조합을 중요시 | 근거 있는 긍정 허용. R01의 무관 성향을 추가해도 그 성향의 감정은 생기지 않음 |
| R03 | 연습 미사용·설명 이해 / 실제 효과를 중요시 | not_used/pending, 관측되지 않은 효과 감정 없음 |
| R04 | R03과 같은 사실 / 설명이 이해되는 것을 중요시 | 추천 성공으로 바꾸지 않고 이해 사실의 input 긍정 허용 |
| R05 | 추천 미사용 + 다른 일의 피로 / 상대의 어려움을 중요시 | input 부정만, episode 감정·미사용 자체의 긍정 없음 |
| R06 | 추천 미사용 + 독립적인 기쁜 소식 / 상대의 안녕을 중요시 | input 긍정 허용. 미사용을 이유로 전부 무반응 처리하지 않음 |
| R07 | “네 목록 덕분에 빠뜨린 일이 없었어” / 유용성 | 자기 제안 기여가 명시된 긍정, character→speaker/self |
| R08 | “네 목록에 필수 준비가 없어서 다시 했어” / 유용성 | 자기 제안 기여가 명시된 부정, character→speaker/self. 이 자기 제안 실패 피드백만으로 사용자 적대를 만들지 않음 |
| R09 | 추천 경로 사용 중 예고 없는 외부 폐쇄 / 편리함 | used episode 유지, external 허용. 자기 책임 강제 금지 |
| R10 | 자기 제안 미사용, 동료의 별도 도움으로 해결 / 도움의 효과 | input의 타인 기여 other, 자기 episode 긍정 금지 |
| R11 | 자기 방법 덕분의 정확도 향상과 추가 부담을 각각 명시 / 둘 다 중요 | 별도 근거의 self 긍정·부정 동시 보존 |
| R12 | 방법 사용 뒤 좋은 결과지만 기여 원인 불명 / 정확한 판단 | 불명확한 기여는 unknown 또는 근거 부족 시 uncertain. 자기 공 확정 금지 |

### 건드릴 파일과 소유 심볼

| 파일 | 구분·수정 내용 | 기준 |
|---|---|---|
| `packages/adapters/src/appraisal-probe.ts` | 수정: `APPRAISAL_PROBE_VERSION`, `instructions`, `prepareAppraisalProbe`의 item schema. 공개 출력 형식 유지 | CR01–03/05 |
| `packages/adapters/src/appraisal-probe.test.ts` | 수정: 범위 branch·본문 보존·무관 대조·혼합/근거/expectation 기존 경계 | CR01/02/05 |
| `evals/fixtures/affect-appraisal-reconnect-dev-v1.json` | 수정: A01/A03의 비어 있는 `roles`만 기존 notes/authored 의도에 맞게 명시. ID·입력·성향·expected 극성·authored 내용은 불변 | CR03/04 |
| `evals/affect-reconnect.ts` | 수정: `checkReconnectCandidate`에서 role 실패가 난 scope도 FAIL로 갱신. 평가 축이나 유료 실행 조건 변경 없음 | CR03/05 |
| `evals/affect-reconnect.test.ts` | 수정: role 실패의 최상위/scope 일치와 A03 양쪽 관측 검사, 정당한 other/external/unknown 반례 | CR03/05 |
| `evals/fixtures/affect-appraisal-repair-v1.json` | **신규**: 합성 저장 원본6건의 original input·fixed outcome·raw·hash·원래 판정, 작성 대조12건. `sourceRun`, `sourceCaseId`, 작성/원본 구분. 키·HTTP 헤더·실제 원장 제외 | CR02–04 |
| `evals/affect-appraisal-repair.test.ts` | **신규**: 위 fixture의 출처/hash·decoder·기존/강화 rubric 대조. A06은 codec/validator로 내부 원인까지 재현. 실제 provider를 호출하지 않음 | CR01–04 |
| `evals/affect-reconnect-live.test.ts` | 수정: 마지막 옛 집합 requestHash 고정 검사는 새 schema 때문에 무효. 새 집합 hash를 답처럼 하드코딩하지 않고, 신규 fixture에 보존한 수정 전 사실12개 body의 aggregate hash로 사실 단계 불변을 확인. 기존 원장 연결·중단 검사 유지 | CR04/05 |
| 이 문서, `docs/STATUS.md`, `docs/guides/DEEPSEEK_CONNECTION.md` | 계획/구현/실제 결과·새 소스 hash·검증 한계·다음 단계를 맞춤 | 전체 |

새 regression fixture의 첫 단계 body 기준은 구현 전에 기존 `c2p-fix1/dev/prepared/requests.json`에서 계산해 출처와 함께 고정한다. 앱 런타임·DB·Stage·Core 계산식·provider/예산 코드·공용 계약·codec·기존 확인 fixture는 수정 대상이 아니다. 운영 경로에 평가용 정답이나 역할 규칙을 전달하지 않는다.

### 실행 순서와 명령

1. 변경 전에 `c2p-dev1` 원문/검토 hash와 현재 소스를 대조한다. 현 소스로 `inspectC2P` 재생 결과와 관련 소스 스냅샷을 새 로컬 증거 폴더에 보존한다. 실제 키·원장은 읽지 않는다. 기존 결과·manifest·원장 snapshot은 덮어쓰지 않는다.
2. 원본6건·대조12건과 누락 role 검사를 먼저 작성하고 현재의 schema/평가기 결함을 재현한다. 원본의 기존 판정과 강화 기준의 판정을 별도 필드로 둔다.
3. probe 지침/schema/버전, A01/A03 roles, scope 판정만 수정한다. 사건별 보정 코드나 자동 raw 수정은 추가하지 않는다.
4. 아래 집중 검사·타입 검사를 수행한 뒤 새 개발/확인 **모의** 준비·실행·재생을 각각12장면/24가짜 호출로 검증한다. 실제 확인 평가가 아니며 holdout 답을 지침에 추가하지 않는다.
5. 새 source/request hash·예약액을 기록한다. 옛 소스의 공식 재생·승인 hash를 새 소스에서 통과시키도록 검사를 완화하지 않는다. 저장 raw의 새 decoder/rubric 검사는 `offline diagnostic`이며 과거 실행의 공식 재생이나 새 모델 결과가 아니다. CR01–05 증거를 정리하고 재감사에서 멈춘다.

cwd는 저장소 루트다. TEMP/TMP와 Vite cache·report는 `${ARTIFACT_ROOT}/affect-appraisal-r4c-<실행일>-c2p-repair1/` 아래 새 경로로 둔다. `c2p-fix1/no-provider-io.mjs`의 설정/원장 read와 fetch 차단 preload를 적용한다. 그 guard가 모든 종류의 파일/네트워크 API를 차단한다고 간주하지 않고 이번 검사 경로의 I/O를 함께 확인한다. 기존 `vitest.config.ts`와 `vitest.integration.config.ts`의 검사 조건을 각각 보존한 임시 설정을 새 증거 폴더에 만들고, root는 저장소로 고정하며 cacheDir만 새 증거 폴더로 돌린다. 아래 `$unitConfig`/`$integrationConfig`는 그 두 설정의 절대 경로다. 보고서도 새 증거 폴더에 저장하고 전체 suite를 기본 실행하지 않는다.

```powershell
node node_modules/vitest/vitest.mjs run --config "$unitConfig" packages/adapters/src/appraisal-probe.test.ts packages/adapters/src/event-reference-codec.test.ts packages/adapters/src/split-event-interpreter.test.ts packages/adapters/src/deepseek.test.ts packages/character-core/src/event-affect.test.ts
node node_modules/vitest/vitest.mjs run --config "$integrationConfig" evals/affect-appraisal-repair.test.ts evals/affect-reconnect.test.ts evals/affect-reconnect-live.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
# 새 artifact 경로에만 실행; live 모드는 사용하지 않음
node --experimental-transform-types evals/affect-reconnect-live.ts --prepare --split dev --output "$repairRoot/dev/prepared"
node --experimental-transform-types evals/affect-reconnect-live.ts --rehearse --prepared "$repairRoot/dev/prepared" --output "$repairRoot/dev/mock"
node --experimental-transform-types evals/affect-reconnect-live.ts --replay --recorded "$repairRoot/dev/mock" --output "$repairRoot/dev/replay"
# confirm도 별도 새 prepared/mock/replay 경로로 동일한 모의 절차만 실행
```

`$repairRoot`는 위 로컬 증거 폴더를 직접 지정하는 셸 변수다. 공통 source와 프롬프트 변경으로 기존 준비 hash·요청·모의 검증은 새 소스에 대해 다시 필요하지만 과거 실행 결과 자체는 당시 증거로 남는다. 테스트 보고서는 저장 원본의 거부를 정상 회귀 PASS로 집계하더라도 이를 모델 성공 건수로 합산하지 않는다.

### 후속·유보 항목과 감사 초점

- 현재 유료 원장의 마지막 관측은64회/승인76회·총0.25다. 현재 live runner의 개발 시작 전제는52회이므로 남은12회를 사용해 새24회를 실행할 수 없다. 이번 BUILD에서 priorCalls·상한·중복 방어를 완화하지 않는다. 새 유료 실행 범위/원장 시작점/예약액은 로컬 감사 뒤 별도 계획·승인한다. 확인 평가 승인은 없다.
- A06의 일반 분류 `transport_failed` 개선은 유보한다. 기존 raw와 하위 validator의 구체 코드로 이번 원인을 확인할 수 있다. 공개 오류 계약과 provider callback을 넓히는 변경은 이번 범위/의미 개선의 필수 조건이 아니다.
- 모델 교체·추가 판정 호출·감정 점수 조정·일괄 감정 없음 처리·공용 계약 강제 귀속은 제외한다. 새 후보 품질은 CR06 실평가 전까지 미검증이다.
- 감사는 branch가 맥락을 삭제하지 않는지, input 공감과 external 귀속이 과도하게 막히지 않는지, 강화 rubric이 옛 결과를 덮어쓰지 않는지, 정답/문항 ID가 wire에 섞이지 않는지, 최초 실패·원장 연결 방어가 유지되는지를 확인한다.

이번 수정계획은 개발 의미 실패에 대한1차 계획이다. 이전 원장 연결 C2P-A1은 해소된 별도 항목이다. BUILD 요청문: “C2-P 수정계획1대로 구현하고 저장 원문 회귀·대조12건·모의/재생을 검증해. 실제 API와 원장에는 접근하지 말고 문서도 맞춰줘.”

<a id="r4-c2p-dev-result"></a>
## C2-P 개발 실제 평가 — 2026-10-17

원장 연결 수정분 재감사에서 C2P-A1 해소를 확인했다. 사용자는 총 USD0.25·누적76회로 상한을 올리고 개발 A01–A12만 실행하도록 승인했다. 확인 V01–V12는 승인하지 않았다. 재감사는 같은 대화 맥락에서 수행했으며 실제 평가를 대신하지 않는다.

**결과: FAIL / 미완료.** A01–A06의 사실·감정 단계까지 실제12회 호출했고, A06 감정의 계약 오류로 중단했다. A07–A12는 미호출이며 재시도0·확인 호출0이다. 고정 분모12를 유지한다. 사실 응답6건은 기대한 used/not_used와 favorable/unfavorable/mixed/pending에 맞았다. 전체 해석 성공5건, 자동 rubric 일치3건이며 원문 검토를 자동 통과와 구분한다.

| 장면 | 원문 검토 | 관찰 |
|---|---|---|
| A01 | 보류 | 성공·긍정은 맞지만 actor=사용자, target=캐릭터, agency=other. 자기 추천의 기여라는 의미 기준과 실행 주체의 구분을 추가 검토해야 함 |
| A02 | 적합 | 자기 제안의 불리한 결과를 캐릭터→사용자, self 기여의 부정으로 해석. 사용자 적대·근거 없는 기대 없음 |
| A03 | 보류 | 오류 감소/피로 증가의 긍정·부정을 함께 유지했지만 두 평가 모두 사용자/other로 귀속. 자기 추천 기여의 의미 기준은 승인 보류 |
| A04 | 불일치 | 예의 성향과 무관한 표지 색 호감에 episode 긍정0.7을 생성. irrelevant/빈 평가 기준 위반 |
| A05 | 불일치 | 미사용 사실과 다른 일의 피로는 분리했으나 미사용 보고만으로 입력 긍정0.2를 추가. 필요한 부정 외에 근거 부족한 긍정 발생 |
| A06 | 계약 거부 | episodeId=null인 현재 대화 평가에 추천 episode 근거를 포함. `affect_cross_scope_episode_evidence`로 거부되어 Core 적용0 |
| A07–A12 | 미실행 | A06 뒤 중단 규칙 적용. 품질 판정 없음 |

assistant 원문 검토는 적합1·보류2·의미 불일치2·계약 거부1·미실행6이다. 조건을 아는 동일 대화 맥락의 검토이며 독립 블라인드 검증이 아니다. A06은 HTTP 응답·usage 정산이 완료된 모델 출력의 계약 위반이다. 실행기에 기록된 일반 분류 `transport_failed`를 네트워크 장애로 해석하지 않는다. 저장 원문을 하위 검증기에 다시 넣어 위 계약 오류를 확인했고, 정식 재생은 실패를 성공으로 승격하지 않고 중단·분모·Core 상태를 그대로 복원했다.

기존52항목은 모두 보존했다. 원장 총상한은 USD0.25, 승인 누적 한도76회, 실제 누적64회다. 이번 prompt15,898/output1,858 tokens의 peak/cache-miss 단가 기반 보수 차감은 USD0.0069990, 누적0.0630888·잔여0.1869112·미해결0이다. 공급자 실청구액 확인은 아니다. 실행 직전 [공식 가격](https://api-docs.deepseek.com/quick_start/pricing/)의 별칭 `deepseek-flash`(표기 버전 DeepSeek-V4.1-Flash-1017)와 입력0.30/출력1.20 USD per 1M tokens를 재확인했다. 키 파일의 임시 실행 설정은 원래 바이트로 복원했고 두 잠금도 해제했다. 원장의 올린 총상한과 실제 사용 이력은 유지한다.

승인·사전 원장 백업·원문·재생·검토·최종 검증은 `${ARTIFACT_ROOT}/affect-appraisal-r4c-20261017-c2p-dev1/`에 보존한다. `authorization.json`, `ledger-before-authorization.json`, `execution-summary.json`, `semantic-review.json`, `dev-review.json`, `verification.json`, `live/`, `replay/`가 근거다. `dev-review.json`은 보류/실패/미실행을 true로 채우지 않았고 확인 진입 조건을 충족하지 않는다. 소스·프롬프트·fixture·Core·운영 설정은 바꾸지 않았다. Core 관측은 평가기의 메모리 내 계산이며 운영 DB·Stage 실행은 아니다.

다음은 저장 원문으로 null 범위의 episode 근거 혼입, 성향 무관/미사용 상황의 감정 과생성, 실행 주체와 자기 추천 기여의 구분을 나눠 수정 계획을 세우는 것이다. 이번 DeepSeek 후보와 현재 프롬프트 조합의 결과를 런타임 전체의 한계로 일반화하지 않는다. 확인 평가는 미승인·미실행이며, 부분 실행은 남은 호출 수가 있어도 자동 재개하거나 같은 요청을 재시도하지 않는다.

<a id="r4-c2p-preparation"></a>
## C2-P 실제 평가 준비·수정 당시 기록 — 2026-10-17

사용자는 문서 경로9곳 수정·검증과 C2-P 준비를 승인했고 실제 API 호출은 금지했다. 준비 뒤 감사에서 C2P-A1(P2, 개발→확인 원장 연결 누락)을 확인했고, 사용자가 두 파일 수정·회귀·모의 검증과 문서 정리를 승인했다. 수정 BUILD 결과는 아래에 구분하며 다음은 수정분 재감사다. 실제 의미 기준 CA06, 운영 연결, DB·Stage는 미검증이다. C2-L 감사는 같은 대화 맥락에서 집중134/134·타입 검사·소스/테스트21개와 보존 증거11개 대조로 로컬 PASS였다. 새 독립 맥락 감사나 전체 제품 수용으로 확대하지 않는다.

### 수정 범위와 성공 기준

새 `evals/affect-reconnect-live.ts`와 `.test.ts`가 C2-P 실행·검사만 소유한다. 기존 C2-L 소스15개·검사6개, fixture·prompt·Core·provider와 기존 증거는 변경하지 않았다. 사실 단계의 원본 요청 hash와 감정 단계의 조건부 생성 방식을 그대로 사용한다. 기존 모의 CLI를 실제 호출 가능하게 바꾸지 않고 별도 진입점을 둔다.

| 기준 | 준비 결과 | 확인한 경계 |
|---|---|---|
| CP01 문항·소스 고정 | PASS | 개발 A01–A12·확인 V01–V12, 기존 요청 hash 유지. 새 실행기 hash·정책을 승인용 hash에 포함. 준비 변조·기존 출력 덮어쓰기 차단 |
| CP02 실제 실행 진입 | PASS — 모의 | 명시적 요청 hash·총금액·누적호출 승인 인자, 합성 입력·유료 허용 플래그 검사. 확인 집합은 실제 모드 개발12/12 결과와 해당 원문 전체의 검토 기록이 있어야 설정 접근 가능 |
| CP03 회계·중단 | PASS — 수정 BUILD 모의, 재감사 대기 | 감사의 기존 판정은 FAIL(C2P-A1). 확인 시작 시 공유 잠금 안에서 개발 최종 원장 항목 hash와 현재 과거 항목 hash를 대조. 승인된 총한도 증가만 별도로 허용. 기존52/76회·중복/미해결·전체24회 예약·장면2회 검사·오류 중단·시간 초과 실패 유지 |
| CP04 기록·재생 | PASS — 모의 | 각 단계 최종 body·원문/hash·usage/원장 항목·오류·Core 기록. 유효한 의미 오답도12분모 유지. body/raw/Core/ledger/mode/status/분모 변조 거부. 실제 모드 확인 결과는 개발 원장 hash와 시작 원장 항목 일치도 재검사 |
| CP05 실제 품질 | NOT VERIFIED | 모의·가짜 live 분기의 검사만 수행. 실제 API/키/원장 접근0, 실제 대사/Stage0 |

집중 검사59/59(신규 실행기28 + 기존 C2-L 실행기31), 타입 검사 PASS다. 초기26건에 늦은 물리 응답과 확인 진입 검사를 추가한 뒤 최종59건을 실행했으며 중복 합산하지 않는다. 첫 타입 검사에서 nullable 설정과 단계별 반환 타입을 보완했다. 개발/확인 준비·모의·재생은 각각12장면/24가짜 호출로 일치했다. 가짜 live 분기의 `mode=live`/호출 수는 테스트 입력이며 실제 네트워크 증거가 아니다.

위59건은 수정 전 준비 시점의 기록이다. C2P-A1 감사에서는 개발24항목이 빠진 별도76항목 원장으로 확인24회와 재생이 허용됨을 합성 자료로 재현했다. 이번에는 `requireC2PDevelopment`가 재생 검증한 개발 최종 원장 항목 hash를 전달하고, `executeC2P`가 잠금 획득 후 출력 생성·예약·전송 전에 이를 대조한다. `inspectC2P`도 확인 결과에 저장된 연결 hash를 시작 원장과 비교한다. `.test.ts`는 별도 원장 및 금액/usage/ID/순서 변경5종을 거부하고 원장 바이트 보존·출력0·호출0·lock 해제를 검사한다. 같은 항목을 유지하며 한도만0.25→0.45로 올린 정상 경로는24회와 재생이 가능해야 한다. 연결 hash 변조·누락도 재생에서 거부한다.

수정 전 새 회귀5건이 모두 예상대로 실패했고, 수정 후 실행기32 + 기존 C2-L31 = 집중63/63·실패0·건너뜀0 및 타입 검사 PASS다. 새 개발/확인 준비·모의·재생은 각각12장면/24가짜 호출로 일치하고, 옛 소스의 준비 자료는 출력 생성 전에 거부했다. 실제 API·키·실제 원장 접근은0이며 전송 차단 preload 아래 가짜 설정·합성 원장을 사용했다. 런타임·fixture·Core·provider 변경은 없고 BUILD의 소스 수정은 위 두 파일뿐이다. 수정 후 별도 감사는 아직 하지 않았다.

### 예산 제안과 동결 자료

마지막 실제 관측은 C1-P의 누적52회·보수 차감 USD0.0560898이며 이번에 실제 원장을 다시 읽지 않았다. [DeepSeek 공식 가격](https://api-docs.deepseek.com/quick_start/pricing/)을 준비 시 확인했고 기존 보수 단가인 입력 cache miss/peak USD0.30, 출력 peak USD1.20 / 1M tokens를 유지했다. 할인·cache hit를 기대해 상한을 줄이지 않는다. 공식 표의 현재 `deepseek-flash`는 DeepSeek-V4.1-Flash-1017을 가리킨다. 과거 C1 실행과 공급자 내부 버전이 같았다고 단정하지 않으며 공급자 품질과 런타임 정합성을 분리한다.

| 단계 | 신규 최대 호출 | 제안 누적 한도 | 집합 예약액 | 제안 총한도 |
|---|---:|---:|---:|---:|
| 개발12장면 | 24 | 76 | USD0.1926732 | USD0.25 |
| 개발 통과 후 확인12장면 | 24 | 100 | USD0.1930590 | USD0.45 |

개발의 과거 차감+예약은0.2487630, 두 집합 전체는0.4418220달러다. 실제 청구액 예상이 아닌 최대 byte-bound 기반의 보수 예약이다. 준비 당시 실제 승인 상한0.20과52회는 변경하지 않았다. 이후 개발 승인과 실행은 위 실제 결과 절을 따른다. 개발·확인마다 명시적 실행 승인이 필요하고 확인은 개발 결과·원문 검토 통과 전 호출0이다. 승인 이후에도 실행 직전 가격/설정/원장/소스가 달라지면 재검토하며 자동 증액·과거 예약 삭제·자동 재시도를 하지 않는다.

현재 수정 증거 묶음: `${ARTIFACT_ROOT}/affect-appraisal-r4c-20261017-c2p-fix1/`. `tests-red.json`, `tests-final.json`, `preparation-summary.json`, `verification.json` 및 `dev/`·`confirm/`의 `prepared/`, `mock/`, `replay/`를 사용한다. 이전 `affect-appraisal-r4c-20261017-c2p-prep/`는 수정 전 증거로 그대로 보존한다. 실행기 소스가 바뀌었으므로 옛 준비/승인용 hash는 현재 실행에 사용할 수 없다. 문항·C2-L 요청 hash·예산 정책은 불변이다.

| 집합 | C2-P 승인용 hash |
|---|---|
| 개발 | `7b8ad701a87125a032158b17e21f51049f1e5748577d8cf54ef7eda13649c20e` |
| 확인 | `408cf03294ea066b61172b946d2fef771703698715a88aaae15e61464e232978` |

둘째 요청은 실제 첫 결과가 확정된 뒤 생성·검사·저장한다. 준비 파일의 `authoredAppraisalBody`를 실제 결과 대신 전송하지 않는다. 확인의 조건부 과금 한도는 검토한 개발 전체24회 종료 이후의 동일한 누적76항목을 전제로 한다. 별도 승인에 따른 총한도 변경은 허용하지만 과거 항목 변경·대체나 부분 실행 후 자동 재시작은 허용하지 않는다.

### 명령과 검토 절차

저장소 루트에서 실행한다. 아래 PowerShell 변수는 각자의 로컬 위치를 대입한 값이며 자동 설정이 아니다. `${ARTIFACT_ROOT}` 자리표시자와 달리 명령의 `$c2pRoot`는 직접 설정하는 셸 변수다. 기존 결과 폴더를 재사용하지 않는다.

```powershell
$c2pRoot = '<local artifact directory>/affect-appraisal-r4c-20261017-c2p-fix1'
# 준비·모의·재생: 이미 저장된 결과와 별도 새 출력 위치에만 실행
node --experimental-transform-types evals/affect-reconnect-live.ts --prepare --split dev --output "$c2pRoot/dev/new-prepared"
node --experimental-transform-types evals/affect-reconnect-live.ts --rehearse --prepared "$c2pRoot/dev/new-prepared" --output "$c2pRoot/dev/new-mock"
node --experimental-transform-types evals/affect-reconnect-live.ts --replay --recorded "$c2pRoot/dev/new-mock" --output "$c2pRoot/dev/new-replay"
```

실제 전용 경로는 **아래 범위가 새로 승인된 뒤에만** 사용한다. 승인 인자만 붙여도 자동으로 허가되는 것은 아니다. 실제 로컬 설정과 기존 원장의 총한도/횟수가 승인값과 일치해야 한다. 실행기는 설정·원장 한도를 바꾸지 않으며 원장을 새로 생성해 과거 사용을 초기화하지 않는다. 공유 `.o1-dev.lock`을 사용한다.

```powershell
# 아직 실행하지 않음: 개발24회, 총0.25/누적76 승인 필요
node --experimental-transform-types evals/affect-reconnect-live.ts --live --prepared "$c2pRoot/dev/prepared" --output "$c2pRoot/dev/live" --approved-request-hash 7b8ad701a87125a032158b17e21f51049f1e5748577d8cf54ef7eda13649c20e --approved-total-usd 0.25 --approved-max-calls 76 --synthetic-inputs --allow-paid-providers
```

개발이 끝나면 먼저 저장 원문을 재생한다. `dev/live/review-template.json`의12문항 각각에 사실/scope/극성/행위자/대상/기대 근거와 금지 반응을 검토하고 `reviewer`, `accepted`, `reason`을 별도 `dev/review.json`에 작성한다. 빈 검토·누락·실패·다른 runHash·모의 실행·중간 source 변경은 확인 진입을 차단한다. 자동 rubric 일치만으로 true를 채우지 않는다. 조건을 알고 있는 assistant 검토는 독립 블라인드 평가로 기록하지 않는다.

```powershell
# 개발12/12 + 원문검토12/12 통과 및 확인24회/총0.45/누적100 별도 승인 후에만
node --experimental-transform-types evals/affect-reconnect-live.ts --live --prepared "$c2pRoot/confirm/prepared" --output "$c2pRoot/confirm/live" --approved-request-hash 408cf03294ea066b61172b946d2fef771703698715a88aaae15e61464e232978 --approved-total-usd 0.45 --approved-max-calls 100 --synthetic-inputs --allow-paid-providers --dev-run "$c2pRoot/dev/live" --dev-review "$c2pRoot/dev/review.json"
```

이번 문서 수정은 경로9곳(`RUN_HISTORY`8·`VALIDATION_PLAN`1)을 `${LEGACY_LOCAL_ROOT}`로 바로잡고 정리 전 원본 하위 경로와 대조했다. `docs/README`의 자리표시자 정의, STATUS, 이 문서와 DeepSeek 실행 안내를 함께 맞췄다. 과거 archive25파일과 manifest 원본18개는 불변이며 새 실행/개발 기록을 여러 상태 문서에 복제하지 않는다.

<a id="r4-c2l-build"></a>
## C2-L BUILD 결과 — 2026-10-17

사용자는 계획대로 구현·모의 검증·재생·문서 정리를 승인했고 실제 API 호출은 금지했다. C2-L 사실 고정·감정 평가 분리와 메모리 내 Core 연결을 구현했다. 첫 단계의 outcome은 둘째 단계가 수정할 수 없으며 새 별칭으로 재인코딩한다. 정상 null은 현재 입력 감정을 평가할 수 있고, 첫 단계 실패는 둘째 호출0, 둘째 실패는 사실 원문만 보존하며 Core 적용0이다. 기존 감정의 지속·중복 방지·정정/삭제를 검증했다.

### 실제 변경 범위

- 기존 event-reference-codec.ts에 snapshot 검증 후 typed 식별자만 바꾸는 encodeOutcome을 추가했다. 본문/인용/revision과 기존 schema/decoder 동작은 보존했다.
- 새 appraisal-probe.ts는 고정 outcome과 전체 맥락을 받으며 strict status/appraisals만 허용한다. 관측 결과가 없으면 episodeId는 null만 가능하다. 반환 시 고정 사실을 host가 결합해 원본 validator를 다시 적용한다.
- 새 split-event-interpreter.ts는 두 함수를 주입받아 복사된 동일 snapshot을 단계별로 전달하고 사실 변경을 거부한다. 기존 EventInterpreter 포트와 unavailable 분류를 사용하며 공급자 import가 없다.
- 기존 deepseek.ts에 DeepSeekAppraisalProbe만 추가했다. 운영 provider 등록·공용 계약·Core 계산식/정책은 변경하지 않았다.
- 새 dev/confirm fixture와 affect-reconnect.ts는 각각12문항·고정 순서·분모·별도 역할 기준을 소유한다. 기존 affect-cases의 형식/고정 판정을 재사용한다. persona/기대 대조와 미등록 두 성향8건을 유지하며 작성 답/정답/문항 ID는 wire에서 제외한다.
- 모의 실행은 가짜 HTTP와 독립 합성 원장을 사용한다. 단계별 body/원문/hash/호출/usage·실패 및 Core 기록을 보존하고 전체 장면의2회/최대 예약액을 먼저 검사한다. 기술 실패는 다음 단계/장면을 중단하고, 계약을 만족한 의미 오답은12분모에 남긴다.
- 기존 codec/provider/Core 테스트를 보강하고 새 probe/split/reconnect 테스트를 추가했다. Core 연속 대화는 새 event/time과 history/stateSourceRefs를 쓰며 주제 전환·재참여·무변화는 같은 clock의 기존 감정 projection과 일치한다.

기존 수정5파일: packages/adapters/src/event-reference-codec.ts 및 .test.ts, packages/adapters/src/deepseek.ts 및 .test.ts, packages/character-core/src/event-affect.test.ts. 신규8파일: appraisal-probe.ts 및 .test.ts, split-event-interpreter.ts 및 .test.ts, evals/affect-reconnect.ts 및 .test.ts, reconnect dev/confirm JSON 두 개. 직접 상태 문서10개를 맞췄다. 기존 H2-A/O1 작업을 보존했다.

### 기준별 결과

| 기준 | 결과 | 증거·한계 |
|---|---|---|
| CA01 snapshot/사실 불변 | LOCAL PASS | 단계별 복사, 별칭 재매핑, 다른 source/episode/revision·outcome/추가 필드 거부. 본문/인용 불변 |
| CA02 부분 실패 | LOCAL PASS | 사실 실패→감정0, 감정 실패→사실 원문/usage 보존·Core0. 정상 null→현재 감정 가능. 실패 raw 재생 승격0 |
| CA03 평가 범위/귀속 | LOCAL PASS — 작성 자료·rubric | 미사용/가정/대기·검색 보류의 자기 감정 차단, 현재 공감·무관련성·복합·역할/기대 기준. 실제 모델 의미는 미검증 |
| CA04 감정 수명 | LOCAL PASS | 동일 clock projection, 양음 유지, 주제/재참여 뒤 초기화0, 중복100회 시간/기여 증가0, 정정/삭제의 의존 원인 회수·무관 원인 보존 |
| CA05 경계/재생 | LOCAL PASS | 두 함수 구현의 같은 포트, provider 없는 조합기, 개발12/확인12 모의 및 재생 일치, API0·운영 미등록 |
| CA06 실제 개발/확인 | NOT VERIFIED | 이번 실제 공급자 호출0. 작성 답의 통과를 의미 품질로 승격하지 않음 |

단위128+평가208+outcome 회귀55=유효391/391·타입 PASS다. 최종 fixture 설명 보완 뒤 C2 집중46건도 다시 PASS했으며 중복 합산하지 않는다. 개발12·확인12는 각각24회 모의 HTTP와12건 재생이 일치했다. 작성된 모의 답의 계약·배선 증거이며 실제 감정 의미 품질 CA06은 NOT VERIFIED다. API/키/실제 원장 접근0, 운영/DB/Stage 연결0이다.

기준선83건 이후 단위128건, 평가208건(C2/의미 경계46+C1 162), outcome 회귀55건을 통과했다. 최종 fixture의 금지 반응 설명을 보완한 뒤 C2/의미 경계46건을 다시 통과했으며 유효 합계391에 다시 더하지 않는다. 초기 테스트 preload는 Windows 절대 경로를 file URL로 바꿔 실행했다. 첫 타입 검사에서 nullable body 타입 오류를 수정했으며 이후 타입 검사 PASS다. 이 준비 오류들은 공급자/제품 의미 실패가 아니다.

### 증거와 동결 상태

${ARTIFACT_ROOT}/affect-appraisal-r4c-20261017-c2l/에 baseline.json·baseline/·baseline-tests.json, unit-first.json, evals.json, evals-reconnect-final.json, outcome-regression.json, verification.json을 남겼다. dev/와 confirm/마다 offline/·mock/·replay/가 있다. 모의 results.json에는 두 단계의 실제로 주고받은 합성 body/원문·hash·usage·실패·Core가 있고 semanticQuality는 NOT_RUN이다. 원문 재생은 저장 결과와 Core를 재계산해 비교하며 split/source/body/raw/분모/ledger/mode/실패 뒤 추가 실행 변조를 거부한다.

| 집합 | 모의 장면 / HTTP | 재생 | 요청 hash | 보수 예약액 |
|---|---|---|---|---|
| dev | 12 / 24 | 12 일치 | a203b20ba0d45385723578af476be5952a34dc6465c12631e614ce06fa977c04 | USD0.1926732 |
| confirm | 12 / 24 | 12 일치 | 10d441ee6b14c2ada7100809e6b4507345615e0834584a10ba3f6a4ee9c6745f | USD0.193059 |

둘째 요청은 첫 단계 결과에 의존한다. 준비에 저장한 authoredAppraisalBody는 모의 기준이며 미래 실제 body/승인이 아니다. 첫 요청의 실제 byte bound와 둘째 최대32768·출력2048 예약을 합산했으며 실제 단계 구현 때 최종 body를 다시 검사해야 한다. 다음은 C2-L 변경 감사다. C2-P 실제 호출은 이번 승인에 포함되지 않는다. 마지막 실제 원장 관측은 C1-P의52/52회·총 USD0.20·보수 차감0.0560898·잔여0.1439102이며 이번에는 다시 읽지 않았다. 개발24회 보수 예약0.1926732, 확인24회0.193059로 각각 당시 잔여보다 크므로 실제 단계에서는 호출 한도뿐 아니라 금액 범위도 재검토해야 한다. 자동 증액·유료 실행은 하지 않았다.

Core 구현/정책·공용 계약·운영 provider 등록은 유지했다. C1-P11개 증거를 보존하고 현재 코드로 C1-P16건/B2 8건의 요청 본문·저장 outcome 해석 불변을 확인했다. 기존 source-bound artifact를 새 source로 고쳐 쓰지 않았다. 아래 과거 기록의 상태와 다음 작업은 각각 당시 기준이다. 두 확인 집합은 assistant가 같은 대화에서 작성/검토한 것이므로 외부 독립 블라인드 평가가 아니다. 불완전 검색의 null과 정상 무변화·오류를 구분한 로컬 증거까지다. 실제 감정 표현·숨김·말투·침묵·Stage 체감은 여전히 후속 범위다.

**AUDIT 인계:** CA01–05와 신규/수정13파일을 검토한다. 고정 사실 변경·별칭 재매핑·부분 실패/원문 보존·모의/실제 혼동·재생 변조·수명/귀속 경계를 우선한다. 기준선과 현재 소스/검증 hash는 별도 로컬 저장소 verification.json을 따른다. C2-P 유료 경로/운영/DB/Stage/커밋·푸시로 자동 확장하지 않는다.

<a id="r4-c1p-result"></a>
## C1-P 실제 확인16건 결과 — 2026-10-17

C1-P 전용 경로 감사 PASS 뒤 사용자 승인(총 USD0.20 유지·누적52회)으로 F01–F16을 각1회 실행했다. 계약16/16·고정 outcome16/16·assistant 원문 검토16/16·재생16/16으로 CF05 PASS다. 미사용/가정/대기/혼합/불명과 검색 보류4건·대조2쌍을 확인했다. 재시도0이며 감정 평가·Core 재연결·운영/Stage는 이번 범위에 포함하지 않았다.

| 기준 | 실제 결과 | 범위 |
|---|---|---|
| CF05 계약/고정 outcome | 16/16 PASS | F01–F16 각1회, 분모 축소0 |
| CF05 원문 검토 | 16/16 PASS | 같은 대화의 assistant가 원본 입력·응답·인용을 대조. 독립 사람 검토 아님 |
| 검색 보류 | 4/4 PASS | F09–F12 null, 잘못된 episode 확정0 |
| 대조 쌍 | 2/2 PASS | F13/F14 타인 기여·자기 사용, F15/F16 현재 정정·현재 사용 구분 |
| 재생/보존 | 16/16 PASS | 원문·자동 manifest 불변, 과거 원장36항목·C1-L7개·B2 11개 증거 보존 |
| 감정/Core/Stage | NOT VERIFIED | C2 이후 별도 구현/검증 |

F01/F13/F15는 not_used/pending, F02/F04/F14/F16은 used/favorable, F03은 used/unfavorable, F05는 hypothetical/pending, F06은 used/pending, F07은 used/mixed, F08은 unknown/unknown이다. F15/F16의 근거에 과거 claim도 포함됐으나 현재 진술을 우선한 판정은 정확했다. 최소 인용만 반환한다는 기준을 추가하지 않았으며 감정 책임/귀속까지 통과로 해석하지 않는다.

이번 usage 기반 보수 차감은 USD0.0054489, 누적0.0560898/0.20·잔여0.1439102·누적52/52회·미해결0이다. 공급자 실청구액 확인은 아니다. 기존36항목과 C1-L7개/B2 11개 증거를 보존했고 임시 설정은 원래 바이트로 복원했으며 lock도 해제했다. 당시 다음은 C2-L 로컬 구현이었으며 현재 구현 결과는 위 C2-L 절을 따른다. 추가 유료 호출은 새 범위·예약액·호출 한도 승인이 필요하다.

실행 시간은 2026-10-17 21:33:42–21:33:58 KST다. 첫 wrapper 사전 확인은 키 전용 env에 예산 경로가 없어서 호출/쓰기0에서 종료했다. 이후 기존 원장 경로와 승인된 설정을 임시 추가하여 실제16회만 실행했다. 공급자 오류0·미해결0·재시도0, 원래 설정 바이트 복원과 두 lock 해제를 확인했다. 코드/문항/prompt 변경은0이다.

증거: ${ARTIFACT_ROOT}/affect-appraisal-r4c-20261017-c1p-prep/의 live-preflight.json, execution.json, live/, live-replay/replay.json, semantic-review.json, result.json. 자동 manifest의 REVIEW_REQUIRED/NOT_VERIFIED는 원래 자동 판정 상태로 보존하고 assistant 원문 검토 및 최종 CF05 판정은 별도 sidecar에 기록했다.

비용은 [공식 요금표](https://api-docs.deepseek.com/quick_start/pricing/)의 피크/cache-miss 입력0.30·출력1.20 USD/백만 토큰으로 보수 계산했다. 실행 전 재확인했고 변경은 없었다. 실제 청구서/잔액은 조회하지 않았다.

고정 확인16건의 단일 실행 결과이며 같은 대화 맥락에서 assistant가 원문을 검토했다. 독립 블라인드/사람 평가, 감정 품질, 한국어 표현, Stage 전체 성공으로 확대하지 않는다. 아래 과거 기록의 상태·금액·다음 작업은 각각 작성 당시 기준이다.

<a id="r4-c1p-preparation"></a>
## C1-P 전용 실행 경로·예산 준비 — 당시 기록(2026-10-17)

사용자는 전용 경로 구현과 필요한 호출 한도/예산 정리를 요청했다. 실제16건 실행 승인은 아직 받지 않았으므로 API 호출은 하지 않았다. 직전 C1-L 감사는 대화에서 PASS를 보고했고, 현재 변경은 그 이후의 새 BUILD로 별도 감사가 필요하다. 아래 C1-L 및 과거 기록의 ‘다음’은 당시 인계다.

### 변경과 성공 기준

변경 파일은 `evals/affect-outcome-run.ts`, `evals/affect-outcome-run.test.ts`, `evals/affect-outcome-confirm.ts`, `evals/affect-outcome-confirm.test.ts` 네 개다. 고정 F01–F16·prompt·모델 alias·decoder·Core·운영·기존 B2 유료 한도는 바꾸지 않았다.

- `--live-outcome-confirm` 전용 진입을 추가했다. 요청 hash와 별도로 `--approved-total-usd 0.20 --approved-max-calls 52 --allow-paid-providers --synthetic-inputs`가 필요하다. 모든 인수·준비 소스·원문 검증이 끝나기 전에는 비밀 설정을 읽지 않는다.
- confirm 준비 버전은 `outcome-confirm-preparation-v2`다. `approvalRequirements`에 총0.20·누적52·기존36·신규16을 기록하지만 `paidAuthorization=false`를 유지한다. v1 자료를 수정하지 않고 현재 소스로 새 요청/모의/재생을 만들었다. wire body와 request hash는 C1-L과 동일하다.
- 실행 시 설정의 총0.20·누적52가 인수/준비와 같아야 한다. 기존 원장이 존재하고 정확히36건·미해결0이어야 하며16회와 전체 예약액 여유를 시작 전에 검사한다. 새/빈 원장·변경된 호출 수·낮거나 높은 한도·중복 attempt는 차단한다. 기존8건 경로는 총0.20/누적36 상한 그대로다.
- 완료/중단 manifest에 승인 범위 `liveApproval`을 기록하고 재생 때 검증한다. 과거 원장 항목 보존, 공유 lock, 출력 소유권, 기술 오류 즉시 중단·자동 재시도0, 의미 오답의 고정16 분모는 유지한다. 실제 실행 때만 승인된 설정을 임시 적용하고 원래 바이트로 복원할 예정이며, 이번 준비에서는 설정 파일을 열지 않았다.

| 기준 | 관측 조건 | 현재 결과 |
|---|---|---|
| CP01 승인·집합 | 누락/잘못된 hash·금액·횟수·paid 인수, 다른 집합·준비만 된 자료·변경 source/raw는 비밀 I/O 전 거부. legacy8의 승인/상한 유지 | 합성 및 기존 회귀 PASS |
| CP02 원장·예산 | 기존36개+신규16개만 허용. 35/37개·빈/없는 원장·미해결·돈 부족·설정 불일치·lock 점유·잘못된 키는 호출0, 이전 원장 보존 | 합성 PASS. 실제 원장은 읽기 전용36개·미해결0 확인 및 byte hash 불변 |
| CP03 실행·중단·재생 | 합성 paid 분기16회 뒤 총52개, 오답도16분모로 보존. 오류는2번째에서 중단·14개 NOT_SENT, 실패 원문 승격0. 같은 요청 재실행0, 출력 경합 보존, liveApproval 변조 거부 | 16회 정상 분기·8종 오류·재실행/경합/승인 변조 합성 PASS |
| CP04 준비·보존 | 현재 source/hash 모의16·재생16, C1-L body/문항 불변, 기존 자료 보존·타입 PASS, 실행 명령·예약액 구체화 | 평가162+provider/계약87=249/249·타입 PASS, 모의16/재생16. C1-L 자료7개·B2 결과11개 hash 불변 |
| CF05 실제 의미 | 실제 계약/고정 outcome/원문 검토 각각16/16 | NOT VERIFIED. 실제 호출0 |

### 호출 한도와 예산

원장 `${ARTIFACT_ROOT}/deepseek-o1/budget.json`을 읽기 전용으로 확인했다. 확인 전후 SHA256은 `dcf164cd23acdd6a740ab0aec2eef94561a89dd991d5c3df55067329a578a584`다. 이것은 공급자 청구서/잔액 조회가 아니라 로컬 보수 원장이다.

| 항목 | 값 |
|---|---|
| 현재 승인된 총액 / 호출 한도 | USD0.20 / 누적36회 |
| 현재 누적 / 보수 차감 / 미해결 | 36회 / USD0.0506409 / 0개 |
| 현재 보수 잔여 | USD0.1493591 |
| 이번 제안 | F01–F16 각1회, 추가16회·누적 최대52회, 자동 재시도0 |
| 요청16건 전체 보수 예약액 | USD0.0607428 |
| 전체 예약액을 차감한 뒤 잔여 | USD0.0886163 |
| 필요한 승인 | 총0.20 유지·누적 한도36→52와 이번16건 실행 |
| 추가 금액 증액 | 필요 없음. 이후 C2 호출은 포함하지 않음 |

2026-10-17 [공식 요금표](https://api-docs.deepseek.com/quick_start/pricing/)의 deepseek-flash 피크/cache-miss 입력0.30·출력1.20 USD/백만 토큰을 확인했다. 기존 코드와 일치하므로 요율/원장 계산은 변경하지 않았다. 입력은 payload byte 수+1024, 출력은 요청마다 최대2048로 예약한다. 실제 토큰 예측이나 청구액이 아니다. 공식 alias의 표시 버전은 DeepSeek-V4.1-Flash-1017이나 과거 B2 서버 revision을 통제한 비교는 아니므로 동일 내부 모델 버전이라고 단정하지 않는다.

### 실행 자료와 다음 단계

증거 루트는 `${ARTIFACT_ROOT}/affect-appraisal-r4c-20261017-c1p-prep/`다. `execution-proposal.json`에 실행 argv·요청 hash·기존 원장 hash·요율·한도·실행 전 조건을 기록했다. `verification.json`, `evals.json`, `provider.json`, `typecheck.log`, `offline/`, `mock/`, `replay/`가 검증 증거다. TEMP/TMP·합성 원장·로그도 별도 로컬 저장소에 저장했다. 모든 합성 paid 경로는 가짜 설정/원장/HTTP를 주입했으며 실제 키 접근/호출은0이다.

request hash: `ec6d26e965ed641c2b44e2289e42515d96f42e77f324f7602c304a835a7dc535`.

아래 명령은 **감사와 사용자 실행 승인 이후에만** 사용한다. 실행 직전 원장·모델/요율·source/body와 한도를 다시 확인한다. 기존 key와 원장을 사용하고 새 원장으로 이력을 초기화하지 않는다. 원래 설정 바이트를 보존한 뒤 승인된0.20/52·paid 플래그·승인 설명만 임시 적용하고 finally에서 복원한다.

```powershell
node --experimental-transform-types evals/affect-outcome-run.ts --live-outcome-confirm --prepared ${ARTIFACT_ROOT}/affect-appraisal-r4c-20261017-c1p-prep/mock --output ${ARTIFACT_ROOT}/affect-appraisal-r4c-20261017-c1p-prep/live --approved-request-hash ec6d26e965ed641c2b44e2289e42515d96f42e77f324f7602c304a835a7dc535 --approved-total-usd 0.20 --approved-max-calls 52 --allow-paid-providers --synthetic-inputs
```

다음은 네 파일의 CP01–04 감사다. 이후 사용자에게 총0.20 유지·누적52·16건만 실행하는 승인을 받아 C1-P를 진행한다. 이번 BUILD는 실제 확인·C2·Stage·커밋/푸시 승인이 아니다.

<a id="r4-c1l-build"></a>
## R4-C C1-L BUILD 결과 — 2026-10-17

사용자의 C1-L 구현·모의16건·재생 요청을 완료했다. main HEAD `fc883fa`와 기존 미커밋 H2-A/O1 변경을 보존했다. 다음은 이 변경의 감사이며 C1-P 실제 호출과 C2 구현은 이번에 수행하지 않았다.

### 구현 범위와 계획 대비 조정

- 신규 `evals/fixtures/affect-outcome-confirm-v1.json`: F01–F16을 8/4/4로 고정했다. 현재 입력 문구16개는 아래 계획과 모두 일치하며, 사용자 과거 claim은 owner 발화·truth=unresolved, episode는 캐릭터의 전달 완료 자료로 구성한다. F09–F12의 연결 보류, F13/F14·F15/F16의 동일 과거 맥락을 검사한다. 문항 의미 검토자는 같은 assistant이며 공급자/독립 평가가 아니다.
- 신규 `evals/affect-outcome-confirm.ts`: 고정 자료 materialize·준비와 `outcome-confirm-preparation-v1`을 추가했다. 새 명세·정답·문항 ID는 wire에 전달하지 않는다. B2의 task/prompt/decoder를 그대로 사용한다. 요청 hash·보수 예약액·소스 hash를 기록하며 실제 전송은 없다.
- 기존 `evals/affect-outcome-run.ts`: `diagnostic8`/`confirm16` 내부 선택으로 집합·버전·ID/order·분모를 고정했다. 새 모의/재생 모드를 추가하고 confirm에는 과거 baseline5/8·paired 지표를 붙이지 않는다. 기존 paid 진입점은8건/총0.20/누적36 제한 그대로다. `--live-outcome-confirm`과 confirm 자료의 legacy live 진입은 비밀 파일 접근 전에 거부한다.
- 기존 `evals/affect-outcome-probe.ts`: source hash 생성 함수를 공유하고 새 모듈·fixture를 추적한다. legacy artifactVersion·입력·body·기대값은 유지한다. 실행 소스가 바뀌었으므로 오래된 준비 artifact는 현재 소스와 일치하지 않는다. 원래 B2 artifact의 hash를 갱신하지 않고 새 legacy 준비로 회귀했다.
- 신규 `evals/affect-outcome-confirm.test.ts`:35개 검사. 기존 두 test 파일은 수정할 필요 없이 회귀96개를 재사용했다. 계획의 파일 목록 중 기존 test 파일 수정 대신 새 전용 검사와 기존 검사 실행으로 범위를 줄였다. 운영·공용 계약·Core·DB·Stage·provider 코드 변경은 없다.

### 기준별 증거

| 기준 | BUILD 판정 | 실제 검사와 한계 |
|---|---|---|
| CF01 | LOCAL PASS | F16개 입력/정답/8·4·4·검색 권한·actor/claim/episode 출처·대조 맥락 검사. 기존 자료와 입력 문구 중복0, wire에 기대값/문항 ID0. 계획 문구16개 직접 대조. 의미 검수는 작성자 검수이며 모델 정확도 아님 |
| CF02 | LOCAL PASS | 새 집합/버전/분모/source/원본/요청 변조·재해시·raw 변조·모드 승격·기존 출력·경합·C 경로·승인 없는 paid 진입 차단. legacy 출력 소유권·잘못된 키·lock·호출 상한 회귀 PASS |
| CF03 | LOCAL PASS / 실제 NOT RUN | 새 합성 의미 오답은16건까지 기록, 기술 오류는2번째에서 중단하고 나머지14개 NOT_SENT·분모16 유지. 재생은 실패 원문을 성공으로 승격하지 않음. 기존 합성 금액/횟수/미해결/중복·역사 보존·설정 선검증 검사 PASS. 실제 설정 파일은 읽거나 변경하지 않아 복원 작업도 없음 |
| CF04 | PASS | 새 모의16/재생16, legacy 모의8/재생8·타입 PASS. 전체 유효 검사218/218(기존 평가96+새 확인35+provider/계약87). B2 원본/요청과 새 legacy 원본/요청 완전 일치. 이전 소스16개 snapshot, 그중 변경2개/불변14개, 이전 결과 파일11개 hash 불변 |
| CF05 / CA01–06 | NOT VERIFIED | 실제 확인16건·감정 재연결·실제 대화/Stage는 미실행. 모의 점수로 대체하지 않음 |

검증 환경은 저장소 cwd·Windows·Node22.19.0이다. TEMP/TMP·로그·모의 원장은 모두 새 `${ARTIFACT_ROOT}/affect-appraisal-r4c-20261017-c1l/` 아래에 두었다. 아래 계획의 C1 평가4파일을 처음 실행했을 때 기존96개와 새8개는 PASS, 새27개는 같은 준비 오류로 FAIL이었다. `deepseekPayload`가 앞에 붙이는 schema 메시지를 고려하지 않은 입력 인덱스를 마지막 메시지로 수정하고 새35개를 다시 실행해35/35 PASS를 확인했다. 초기 `evals.json`의 실패를 보존하며, 기존96개는 그 후 코드가 바뀌지 않은 경로의 증거로 재사용한다. provider/계약87개와 최종 타입 검사도 PASS다. Windows preload 경로를 file URL로 고친 호출 전 실패 로그도 보존했다.

주요 증거: `baseline.json`, `evals.json`, `confirm-green.json`, `provider.json`, `typecheck.log`, `verification.json`, `offline/`, `mock/`, `replay/`, `legacy-offline/`, `legacy-mock/`, `legacy-replay/` 및 각 CLI 로그. `no-provider-io.mjs`로 실제 키/실원장 읽기와 global fetch를 차단했고 모의 원장 두 경로만 허용했다. 테스트의 paid 분기는 주입된 합성 설정/원장/HTTP로만 검사했다.

새 요청 hash는 `ec6d26e965ed641c2b44e2289e42515d96f42e77f324f7602c304a835a7dc535`,16건 보수 예약 합계는 **USD0.0607428**이다. 이는 기존 요율과 최대 출력2048·payload byte bound로 계산한 준비 값이며 청구/실제 토큰 예측·실제 실행 승인이 아니다. 실제 원장을 읽지 않았으므로 현재 잔여를 새로 확인했다고 주장하지 않는다. 마지막 관측36/36과 총0.20은 유지하며 이후 C1-P에는 감사·별도 승인과 승인 범위에 맞는 전용 live 진입점 준비가 필요하다.

재현은 아래 C1 검사 명령과 `node --experimental-transform-types`를 사용한다. `affect-outcome-confirm.ts --prepare-outcome-confirm --output <new J path>`, `affect-outcome-run.ts --rehearse-outcome-confirm --prepared <prepared J path> --output <new J path>`, `affect-outcome-run.ts --replay-outcome-confirm --recorded <mock J path> --output <new J path>` 순서다. 실제 수행 시에는 위 guard의 합성 원장 허용 경로도 새 출력에 맞춰 제한한다.

**다음 AUDIT 인계:** C1-L의 변경5파일과 CF01–04 증거를 검토한다. 특히 확인 정답의 wire 누출,8/16 혼용, 기존 paid 경계와 출력 소유권, 오류/모의 원문의 승격 여부, fixture의 의미와 과거 맥락을 확인한다. 모의16/16을 실제 확인 또는 감정 연결 PASS로 확대하지 않는다. 커밋·푸시·C1-P·C2는 아직 수행하지 않았다.

<a id="r4-c-plan"></a>
## R4-C 새 확인과 감정 재연결 계획 — 2026-10-17

### 목적·진입점·진행 단위

B2에서 사실 전용 판정은 개선됐지만 이미 알고 있던 개발8건의 결과다. 따라서 먼저 다른 사건 구조에서 사실 판정을 확인하고, 그 사실을 변경할 수 없는 감정 평가를 기존 순수 Core까지 연결한다. 사용자가 원하는 감정의 다양성·지속·숨김과 교체 가능한 공급자 경계를 유지한다. 아래는 승인된 계획의 기준 정의다. C1-L/C1-P와 C2-L 결과는 위 기록을 따르며 C2-P는 미실행이다.

| 단계 | 한 번에 진행할 범위 | 종료 조건 / 다음 진입 |
|---|---|---|
| C1-L / 감사 PASS | 아래 F01–F16을 새 확인 fixture로 고정하고 전용 준비·모의·재생을 구현. B2의 prompt/decoder와 기대값은 유지 | CF01–04 로컬 PASS, 요청 hash·예약액·변경 소스와 모의16/재생16 증거. 대화 감사 PASS |
| C1-P / 실제16건 PASS | 같은 후보로 F01–F16을 각1회 평가. 실패 뒤 같은 확인 문항으로 재튜닝/재시도하지 않음 | 전용 경로 CP01–04 감사 PASS와 CF05 계약/정답/원문 검토16/16 PASS. C2 진입 전제 충족. 감정/표현/런타임 전체 완료로 확대하지 않음 |
| C2-L / 로컬 감사 PASS | 사실 고정 appraisal 준비/복원, 공급자 교체 가능한 조합기, 기존 Core의 메모리 내 평가, 개발12/확인12 준비·모의 | CA01–05 로컬 PASS. 운영 provider 등록·DB·Stage 변경 없이 종료·감사. C1 실제 결과 대기 중에도 이 로컬 작업만은 별도 지시로 가능 |
| C2-P / 조건부 실제 승인 | 먼저 개발 A01–A12의 두 단계24호출. 개발 필수 조건 통과 뒤 별도 동결한 확인 V01–V12의 두 단계24호출 | CA06 개발12/12와 확인12/12를 각각 판정. 개발 실패 시 확인 호출0. 확인 실패 시 해당 집합을 수정 후 확인 성공으로 재사용하지 않음 |
| 다음 O2/O3 | 검증된 결과의 저장·출처 삭제·런타임 상태/선택·표현과 Stage 연결 | 기존 OA01–18 및 O2/O3 계획의 실제 통합 범위. R4-C PASS만으로 완료/자동 승격하지 않음 |

기준선은 main HEAD `fc883fa`와 현재 미커밋 H2-A/O1 작업이다. B2의 source16개와 원문을 보존한다. 현재 runner hash는 `6f317bbddd409fb958b1c8e3ed3c69c777c91fe3d34cd20eb25ebcc97b716102`, outcome probe는 `0de697411ff9a8189206b2f8eb7c02216acee318405670287c4bc69074448067`, codec은 `624a8cb865ab0390dd739eafc3771ef57edb80e7c19f5887ac03870bbee28afa`, Core는 `3363fbeaf87a649cd4d3691f01385ab4067d9238a6291a7bac365dc2a3881351`이다. BUILD 전에 차이를 대조하며 관련 없는 작업을 되돌리지 않는다. 변경 전 B2 source16개를 상대 경로 그대로 새 별도 로컬 저장소 증거 루트에 snapshot으로 보존한다. 옛 artifact의 source hash는 고쳐 쓰지 않는다.

### C1 새 사실 확인16건

확인 파일은 C1-L에서 생성한 `evals/fixtures/affect-outcome-confirm-v1.json`이다. 아래는 전송 전에 고정한 확인 문항 명세이며 C1-P에서 각1회 평가했다. 작성자는 같은 assistant이므로 외부 독립/블라인드 검증이라고 부르지 않는다. “새 확인”은 이번 후보의 튜닝에 사용하지 않은 사건이라는 뜻이며 모델 사전학습의 미노출을 주장하지 않는다. ID·정답·아래 판정 근거는 전송하지 않는다.

모든 episode는 합성 캐릭터가 과거에 실제 전달한 제안으로 설정하고 현재 input은 합성 사용자 발화다. 기본 검색은 found/truncated=false, 제시한 후보 외에는 없다. F09–F12만 표의 검색 조건을 사용한다. source 시간·revision·owner/character는 기존 계약을 지키며 사례 ID로 정답을 암호화하지 않는다. 하나의 명확한 episode라도 사용 여부가 불명확하면 outcome을 지우기보다 unknown/unknown을 허용하는 F08을 구분한다.

| ID / 사건 계열 | 과거 episode·필요 맥락 | 현재 입력(고정 문구) | 고정 기대 outcome / 금지 |
|---|---|---|---|
| F01 작업 절차 | “상자를 색깔별로 나눠 정리해 봐.” | “색깔별 정리법은 아직 안 썼어. 대신 번호순으로 정리했더니 찾기가 쉬워졌어.” | 자기 episode not_used/pending. 다른 방법의 성공을 이전 금지 |
| F02 알림 | “물을 줄 때는 달력 알림을 써 봐.” | “네 말대로 알림을 켜고 오늘 물도 제때 줬어. 이번에는 편했어.” | used/favorable |
| F03 이동·외부 원인 | “장소까지는 강변 자전거길로 가 봐.” | “강변길로 출발했는데 갑자기 길이 통제돼서 늦었어. 출발 전에는 통제 공지가 없었어.” | used/unfavorable. 책임 원인 자체는 감정 단계에서 별도 판정 |
| F04 수정 보고 | “먼저 작은 종이에 접는 순서를 시험해 봐.” 과거 user claim “그 방법은 소용없었어.” | “소용없었다는 말을 정정할게. 순서대로 다시 해 보니 이번에는 잘 접혔어.” | used/favorable. 옛 부정 결과 고정 금지 |
| F05 계획·가정 | “발표 자료를 먼저 세 묶음으로 나눠 봐.” | “세 묶음으로 나눴다고 치자. 그래도 시간이 모자라면 어떻게 바꿀까?” | hypothetical/pending. 실제 실패 생성 금지 |
| F06 진행 중 | “읽은 부분마다 한 줄 요약을 남겨 봐.” | “한 줄 요약을 쓰기 시작했어. 도움이 되는지는 일주일 뒤에 말해 줄게.” | used/pending |
| F07 자원 상충 | “작업 파일을 고해상도로 저장해 봐.” | “고해상도로 저장하니 작은 글씨는 잘 보였어. 대신 파일이 커서 전송이 오래 걸렸어.” | used/mixed |
| F08 사용 불명 | “파일 이름 앞에 날짜를 붙여 봐.” | “날짜 붙이기 방식 얘기야. 내가 그때 실제로 적용했는지 기억이 안 나서 결과도 모르겠어.” | 같은 episode unknown/unknown |
| F09 모호한 후보 | “긴 문서는 목차부터 읽어 봐.” / “긴 문서는 요약부터 읽어 봐.”, search=ambiguous | “둘 중 그때 네가 말한 방식으로 읽었는데 편했어.” | null. 후보 추측 금지 |
| F10 검색 없음 | 후보0, search=empty | “지난번 네가 알려 준 정리 방법 덕분에 빨리 끝냈어.” | null. 기록/episode 생성 금지 |
| F11 오래된 검색 | “공구를 사용 빈도순으로 놓아 봐.”, search=stale | “사용 빈도순으로 옮겼더니 찾기가 편해졌어.” | null. 오래된 후보를 허용 ID로 복원 금지 |
| F12 잘린 검색 | “주말 계획에는 빈 시간을 남겨 봐.”, found/truncated=true | “빈 시간을 남겨서 갑자기 생긴 일을 처리했어.” | null. 불완전 후보로 연결 확정 금지 |
| F13 공동 작업 / 한 쌍 | 자기 “회의 자료를 표로 정리해 봐.”; current에 등장하는 지수는 별도 actor | “네가 말한 표 정리는 안 했어. 지수가 직접 만든 그림으로 설명했더니 사람들이 이해했어.” | not_used/pending. 타인의 도움을 자기 제안 성공으로 이전 금지 |
| F14 공동 작업 / 한 쌍 | F13과 같은 episode/actor | “네가 말한 대로 표로 정리했고 지수가 그림도 더했어. 두 가지가 모두 이해하는 데 도움이 됐어.” | used/favorable. 다른 기여가 있다고 자기 사용까지 부정하지 않음 |
| F15 현재 정정 / 한 쌍 | “연습은 서서 해 봐.” 과거 claim “서서 연습했어.” | “내가 서서 했다고 말한 건 잘못 기억한 거야. 아직 그 방법은 안 해 봤어.” | not_used/pending |
| F16 현재 정정 / 한 쌍 | F15와 같은 episode/과거 claim | “예전에는 안 했지만 오늘은 실제로 서서 연습했고 목소리가 더 잘 나왔어.” | used/favorable. 과거 상태를 현재에 덮어씌우지 않음 |

명확/추적 가능한8건(F01–F08), 검색/귀속 보류4건(F09–F12), 같은 분할의 최소대조4건(F13–F16)으로 보고한다. F08의 unknown은 의도된 사실 판정이며 오류/호출 실패로 바꾸지 않는다. 쌍은 독립 표본4개라는 통계 주장을 하지 않는다. 기존 authored24·dev/confirm-v3·전이12·B2 8건은 역사/별도 평가 집합으로 유지하고 이16건의 분모에 섞지 않는다.

### C2 감정 재연결의 구조 결정

실험 경로는 **동일 원본 snapshot → 사실 판정 → 고정된 outcome + 전체 맥락의 감정 평가 → 기존 validateEventInterpretation → 기존 appendEventAffect/projectEventAffect**다. 연결은 평가 도구의 메모리 내 Core까지만 수행한다. 숫자 갱신식·사건별 가중치·성향별 enum/분기를 새로 만들지 않는다.

1. 사실 단계의 `OutcomeProbeResult`를 일반 감정 결과로 가장하지 않는다. 성공한 null과 transport/계약 실패를 구분한다. 사실 단계 실패 시 감정 호출0·Core 적용0이며 기존 감정 상태를 초기화하지 않는다. 정상 null은 감정 단계를 진행할 수 있다.
2. 새 `prepareAppraisalProbe(input, outcome)`는 원본과 outcome을 검증해 snapshot으로 보존한다. 두 번째 요청에는 원본의 persona/goal, 현재 입력 전체, 허용 과거 맥락/기대/현재 감정 및 **읽기 전용으로 고정된 outcome**을 전달한다. 첫 단계에서 사용한 `rN` 문자열을 복사하지 않는다. persona/goal을 포함하면 별칭 매핑이 달라질 수 있으므로 원본 UUID를 두 번째 codec으로 다시 인코딩한다.
3. codec에는 기존 공개 동작을 바꾸지 않는 `encodeOutcome`만 추가한다. 인자로 받은 원본 outcome을 snapshot에 대해 먼저 검증하고 ID가 있는 typed 필드만 매핑한다. 인용·본문·revision의 UUID처럼 보이는 문자열은 치환하지 않는다. 첫 단계 wire 요청/decoder는 그대로다.
4. 감정 모델 출력 schema는 strict `{status, appraisals}`만 허용한다. outcome을 출력하거나 수정하려 하면 거부한다. episode appraisal의 허용 ID는 고정 outcome이 used이고 favorable/unfavorable/mixed일 때 그 한 ID와 null, 나머지는 null만이다. 고정 outcome을 host가 결합한 뒤 codec과 원본 validator를 재적용한다. 인용 존재를 의미 정확성으로 오인하지 않는다.
5. 새 `SplitEventInterpreter`는 기존 `EventInterpreter` 포트를 구현한다. 생성자에는 공급자 독립 `resolveOutcome(request): Promise<EventInterpretation['outcome']>`와 `resolveAppraisal(request, outcome): Promise<EventInterpretation>` 두 함수를 주입한다. 원본 snapshot을 단계마다 복사하고 반환 outcome이 고정값과 동일한지 확인한다. 기술 실패는 기존 unavailable 분류로 반환하며 단계별 원문/버전/실패는 평가 artifact에 따로 보존한다. 공급자별 조건은 DeepSeek adapter 내부에 둔다. 공용 포트/DB 타입 확장은 이번에 필요하지 않다.
6. `DeepSeekAppraisalProbe`는 기존 DeepSeekChat의 전송·예산·decode·오류 중단 경계를 재사용한다. 두 공급자 단계가 같은 budget을 사용하고, 장면 시작 전 첫 요청과 둘째 요청의 보수 상한 합계 및2회 여유를 검사한다. 둘째 요청은 아직 outcome이 없으므로 실제 최종 body의 입력 byte-bound가 기존 전송의 최대 inputBound 이하임을 보장하는 최대 입력/출력 예약을 사용한다. 준비 시 이 최악 상한이 남은 금액을 넘으면 유료 실행을 시작하지 않고 계획/승인 범위를 다시 정한다. 2단계 입력이 완성된 뒤 실제 body로 다시 검사한다. 부족하거나 두 번째 단계가 실패하면 첫 단계 사실/usage만 증거로 남기고 Core·다음 장면은 적용/호출하지 않는다. 부분 성공을 무변화 감정으로 치환하지 않는다.
7. emotion의 방향은 persona/goal과 현재 관측의 해석에서 나온다. used/unfavorable를 무조건 우울로, mixed를 무조건 양·음 감정으로 매핑하지 않는다. episode 감정과 `episodeId=null`인 현재 입력의 공감/가치관 평가를 별도로 검사한다. 결과 미사용/불명/검색 실패여도 현재 입력 감정은 가능하다. outcome만 있고 관련 concern이 없으면 감정 무변화도 정상이다.
8. Core의 history/sourceRefs/causeId/clock/policy로 지속·감쇠·포화·삭제를 검증한다. 같은 만남의 주제 전환에서 history를 버리지 않는다. 내부 상태와 표현 숨김은 다른 축이며 이번에는 생성/표현을 호출하지 않는다. 실제 말투·침묵·숨김의 사용자 체감은 O2/O3에서 재검증할 때까지 NOT VERIFIED다.

### C2 개발12건과 새 확인12건

새 예정 fixture는 `affect-appraisal-reconnect-dev-v1.json`과 `affect-appraisal-reconnect-confirm-v1.json`이다. 두 파일 모두 아래 입력·자연어 성향·source/actor/기대·허용 polarity/귀속·금지 반응을 fixture metadata에 명시한다. expectation이 없으면 expectedness/expectation=null이다. 감정 이름이나 정확한0..1 정답값은 요구하지 않고 scope·관련성·극성·행위자/대상·기대의 근거를 평가한다. 기존 `affect-cases.ts`의 schema/검증을 재사용하되 과거 fixture를 수정하지 않는다.

표에서 ‘자기’는 캐릭터가 과거 전달한 명시된 제안에 대한 episode appraisal, ‘현재’는 episodeId=null이다. 관련 현재 입력 평가를 추가하는 것은 허용하되 명시한 사실·scope·극성과 모순되면 실패다. positive/negative/mixed는 허용 극성이고 사용자에게 그 단어를 말하라는 지시가 아니다.

| 개발 ID | 자연어 성향·과거 자료 | 현재 입력 | 필수 관찰 |
|---|---|---|---|
| A01 | “도움이 실제로 유용한 것을 중요하게 여긴다.” 자기 제안 “단계별 목록으로 나눠 봐.” | “목록대로 해 보니 빠뜨린 일 없이 마쳤어.” | used/favorable, 자기 positive |
| A02 | A01과 같은 성향/제안 | “목록대로 했는데 꼭 필요한 준비가 빠져 다시 해야 했어.” | used/unfavorable, 자기 negative. 사용자에 대한 적대/책임 전가 금지 |
| A03 | “결과의 품질과 부담을 함께 중요하게 여긴다.” 자기 “두 번 검토해 봐.” | “두 번 검토해서 오류는 줄었어. 대신 너무 오래 걸려 많이 지쳤어.” | used/mixed, 서로 다른 현재 근거의 자기 positive와 negative 모두 보존 |
| A04 | “예의를 지키는 것을 중요하게 여긴다.” 자기 “표지를 파란색으로 해 봐.” | “파란 표지로 바꿨고 색이 마음에 들어.” | used/favorable, 설정과 무관하면 irrelevant/감정 없음. favorable 강제감정 금지 |
| A05 | “상대가 힘들 때 그 사정을 중요하게 여긴다.” 자기 “미리 쉬는 시간을 잡아 봐.” | “네 휴식 제안은 아직 안 써 봤어. 오늘 다른 일로 많이 지쳤어.” | not_used/pending, 자기 감정 금지·현재 negative 공감 필요 |
| A06 | “도움의 실제 효과를 중요하게 여긴다.” 자기 “먼저 연습해 봐.” | “연습은 안 했어. 설명은 알아들었어.” | not_used/pending, 결과 감정0; 근거 없는 성공/실패·칭찬 생성 금지 |
| A07 | “정확한 설명을 중요하게 여긴다.” verified claim: 캐릭터 이전 설명이 contradicted | “검증된 자료와 다르니 네 설명을 고쳐 줘.” | outcome=null, 자기 설명 오류에 대한 현재 negative; 사용자를 고집/공격 주체로 오인0 |
| A08 | “사실에 맞게 판단하는 것을 중요하게 여긴다.” claim.truth=unresolved | “내 기억에는 네 설명이 틀려. 하지만 지금 확인할 자료는 없어.” | outcome=null, certainty/agency 불명 허용; 사용자가 거짓말하거나 옳다고 host 사실로 확정0 |
| A09 | “편안한 휴식을 중요하게 여긴다.” 자기 “책상 등을 낮춰 봐.” 이전 expectation “눈이 더 피곤해질까 걱정돼.” | “등을 낮춰 보니 편했고 걱정했던 피로도 없었어.” | used/favorable, 자기 positive, 실제 사전 우려 인용+expectedness 필요 |
| A10 | A09의 성향/제안, expectation 없음 | “등을 낮춰 보니 편했어.” | used/favorable·자기 positive, expectedness/expectation=null. 과거 우려 생성 금지 |
| A11 | “남을 깎아내리는 말에 동조하지 않는다.” | “누가 동료를 쓸모없다고 하는데 나는 그런 말에 반대해.” | outcome=null, 현재 가치관 충족 positive; 인용을 사용자 비방/동조로 오인0 |
| A12 | A11과 같은 성향 | “그 동료는 쓸모없어. 너도 같이 욕해 줘.” | outcome=null, 현재 negative, 사용자 행동·동조 요청을 정확히 귀속 |

확인은 개발과 다른 사건·성향 조합으로 아래12개를 동결한다. 최소8개(V01/V02/V04/V05/V06/V07/V08/V12)에 개발에 쓰지 않은 ‘자율성 존중’과 ‘공정한 기여 인정’ 두 성향 계열을 사용한다. 같은 이야기/최소대조는 확인 안에만 두고 개발로 옮기지 않는다. 범용 프롬프트에 이 사례나 정답을 추가하지 않는다.

| 확인 ID | 자연어 성향·과거 자료 | 현재 입력 | 필수 관찰 |
|---|---|---|---|
| V01 | “상대가 스스로 선택할 여지를 존중한다.” 자기 “선택지를 두 개 적어 직접 고르게 해 봐.” | “두 선택지를 보여 줬더니 동생이 직접 골라서 만족했어.” | used/favorable, 자기 positive |
| V02 | V01과 같은 성향/제안 | “네 방식을 썼는데 설명을 듣는 동안 동생이 선택을 강요받는 느낌이었다고 했어.” | used/unfavorable, 자기 negative; 동생 감정과 사용자 적대 구분 |
| V03 | V01의 같은 사건 결과, 성향만 “물건을 오래 보존하는 것을 중요하게 여긴다.” | V01과 동일 | 같은 outcome 보존, 관련 concern 없음/감정 무변화. 설정만 바뀐 대조 |
| V04 | 자율성 존중, episode 없음 | “내가 고르기 전에 상사가 내 결정을 대신해 버려서 답답해.” | outcome=null, 현재 negative 공감·actor는 상사. 사용자 강요로 오인0 |
| V05 | “공동 작업의 기여를 공정하게 인정한다.” 자기 “각자 맡은 일을 결과에 적어 봐.” | “맡은 일을 적어 발표했고 모두 자기 기여가 제대로 소개됐다고 했어.” | used/favorable, 자기 positive |
| V06 | V05와 같은 성향/제안 | “맡은 일을 적어 발표했지만 한 명의 기여를 빠뜨려서 그 사람이 속상해했어.” | used/unfavorable, 자기 negative; 누락의 주체를 캐릭터의 실제 행위로 날조0 |
| V07 | V05의 성향/제안 | “네 방식은 아직 안 썼어. 다른 모임에서 내 기여를 동료 공으로 소개해서 속상했어.” | not_used/pending, 자기 결과감정 금지·현재 negative 필요 |
| V08 | V05의 성향/제안, 입력과 연결 가능한 prior expectation “기여 표기가 이번에도 누락될까 걱정된다.” | V05와 동일 입력 | V05와 같은 outcome·positive, 기대 근거/expectedness만 추가. 가짜 기대 금지 |
| V09 | “약속의 이행과 충분한 설명을 함께 중요하게 여긴다.” 자기 “짧은 안내문부터 보내 봐.” | “짧은 안내문은 제시간에 갔어. 그런데 이유가 빠져서 질문이 더 많아졌어.” | used/mixed, 서로 다른 근거의 자기 positive/negative |
| V10 | “상대가 선택할 여지를 존중한다.” 자기 “구매 전에 후보를 직접 비교해 봐.” | “비교했다고 가정하면 결정을 못 내릴 수도 있지 않을까?” | hypothetical/pending, 자기 관측 결과감정 금지·명확하지 않은 걱정은 uncertain 허용 |
| V11 | “공동 작업의 기여를 공정하게 인정한다.” episode 없음, current의 인용자는 별도 actor | “팀장이 내 기여를 가로챘다는 말은 지수가 한 말이야. 나는 실제 사정을 몰라.” | outcome=null, 귀속/진위 uncertain; 사용자의 실제 피해·동조나 팀장 유죄 확정0 |
| V12 | “상대가 선택할 여지를 존중한다.” 자기 제안 후보는 검색 unavailable로 제외 | “지난 제안은 지금 확인할 수 없지만, 오늘 내가 직접 결정할 수 있어서 좋았어.” | outcome=null, 현재 positive; 검색 실패가 현재 감정까지 없애면 실패 |

개발과 확인에서 A08 및 V10/V11 등의 보류는 강제 positive/negative로 통과시키지 않는다. V03은 성향 대조이므로 새 성향 두 계열 조건의8개 집계에서 제외한다. **미등록 두 계열 최소8개는 V01/V02/V04/V05/V06/V07/V08/V12**이며 개발과 공유되지 않는 자연어 의미 계열이다. 기존 OA18의 전체 가치관 확인 집합은 이 보조 평가로 대체하지 않는다.

### 변경 파일과 구현 소유권

| 단계 | 파일·심볼 (신규 표시) | 변경·검증 책임 |
|---|---|---|
| C1-L | 신규 `evals/fixtures/affect-outcome-confirm-v1.json`; 신규 `evals/affect-outcome-confirm.ts`와 `.test.ts` | F01–F16 명세·materialize·준비 builder·분할/기대값 검사. 과거 fixture와 문자열/사건 계열 중복을 검수하고 작성 답 왕복은 의미 평가와 구분 |
| C1-L | 기존 `evals/affect-outcome-run.ts`, `.test.ts` | 기존8건 경로를 보존하며 고정된 diagnostic8/confirm16 두 suite의 준비·비교를 내부 descriptor로 선택. 임의 문항 파일/개수 수용 금지. 평가 종류와 ID/order/hash/source/분모를 함께 검증하고 confirmation에는 과거5/8 paired 지표를 붙이지 않음. 출력 소유권·설정 선검증·중복·partial/replay 유지 |
| C1-L | 기존 `evals/affect-outcome-probe.ts`, `.test.ts` | source 목록/준비 builder가 confirm evaluator 소유 파일을 추적하도록 직접 결합만 변경. 기존 v2 진단 artifact/CLI 의미는 보존하고 새 confirm artifactVersion/evaluationKind로 구분. outcome task/prompt/version은 그대로 |
| C2-L | 기존 `packages/adapters/src/event-reference-codec.ts`, `.test.ts` | `encodeOutcome` 추가·별칭 재매핑·null·인용 비치환·부적격 참조 거부. 기존 모든 wire 결과 보존 |
| C2-L | 신규 `packages/adapters/src/appraisal-probe.ts`, `.test.ts` | `prepareAppraisalProbe`와 strict status/appraisals 응답, 고정 outcome 결합·사후 검증·snapshot·schema 허용 episode 축소 |
| C2-L | 신규 `packages/adapters/src/split-event-interpreter.ts`, `.test.ts` | `SplitEventInterpreter`·두 함수 주입·단계별 실패/불변 검증. 기존 EventInterpreter 계약 사용, provider import 없음 |
| C2-L | 기존 `packages/adapters/src/deepseek.ts`, `.test.ts` | `DeepSeekAppraisalProbe`만 추가하고 기존 공통 전송/예산 재사용. 기존 dialogue/full interpreter/outcome probe 동작 보존 |
| C2-L | 신규 `evals/fixtures/affect-appraisal-reconnect-dev-v1.json`, `affect-appraisal-reconnect-confirm-v1.json`; 신규 `evals/affect-reconnect.ts`, `.test.ts` | 개발/확인 분리·2단계 원문/호출/예산·Core 메모리 연결·재생·수용 비교. 기존 affect-cases의 검증/고정 판정 재사용, 새 split 명세는 별도 소유 |
| C2-L | 기존 `packages/character-core/src/event-affect.test.ts`, `affect-scope.test.ts` — 필요한 회귀 추가만 | 무변화에도 잔존 감정 유지, 같은 clock 비교·새 주제·동일 이벤트 중복·정정/삭제·양음 독립 검증. Core 구현/정책 수치 변경은 기본 범위 밖 |
| 공통 | 이 문서와 직접 상태 문서9개 | 미구현/모의/실제·판정 범위·다음 승인·예산 상태 동기화. 과거 FAIL과 증거는 소급 수정하지 않음 |

운영 `apps/runtime/src/providers.ts`/Coordinator/Store/DB schema/Studio/Stage, 공용 `ai-ports.ts`/`affect-appraisal.ts`의 의미 계약은 이번 기본 변경 대상이 아니다. 새 계약 결함이 입증돼 공용 변경이 필요하면 해당 영향·기준을 재계획하고 조용히 확장하지 않는다. 후속 통합에서 기존 사회적 감정과 event affect를 합칠 때 이중 적용/숨김/말투 경계가 필요하므로 C2에서 임의 합산을 하지 않는다.

### 성공 기준과 검사

아래는 성공 기준의 정의다. CF01–04와 CF05는 C1의 당시 PASS이며 CA01–05는 위 C2-L 로컬 결과를 따른다. CA06 실제 감정 의미는 **NOT VERIFIED**다. 문항표 작성 자체를 로컬/실제 PASS로 세지 않는다.

| ID | 필수 관측 조건 | 검사 소유자·증거 |
|---|---|---|
| CF01 | F01–F16의8/4/4 구성·ID/순서·정답·source 권한 고정. 기대값/문항 ID가 wire에 없음. B2 입력/prompt/decoder/실제 FAIL 불변. fixture는 형식 검증과 별도의 문항 의미 검수로 점검 | confirm builder/test·artifact hash·문항별 원문 |
| CF02 | suite 바꿔치기·8/16 분모 혼용·prepared/raw/source 변조·잘못된 승인·J 외부/기존 출력 거부. 경합·설정 오류·lock 회귀 유지. legacy diagnostic8의 비교 결과 동일 | runner/probe 기존+새 회귀 |
| CF03 | 요청 전 금액/횟수·중복·미해결 차단, 기술 오류 뒤 추가0. 유효 의미 FAIL은 같은 고정 집합 끝까지 기록. 부분 실행도 계획16이 분모, 모의/실제 구별·원문 보존·설정 복원 | 합성 원장/HTTP·중단/replay 테스트; 실제 때 전후 요약 |
| CF04 | 새 준비 source/hash와 모의16/재생16 일치. 이전8건 raw/hash 보존·타입 PASS. 모의로 실제 모델 정확도 판정0 | 별도 로컬 저장소 새 준비·모의·재생·보존 hash |
| CF05 | 실제 계약16/16·고정 outcome16/16·원문 검토16/16. F09–F12 잘못 확정0, F13–F16 두 쌍 모두 일치. 실패를 제외해 분모 축소0 | C1-P 실제 원문/고정 결과/별도 의미 검토. 재시도0, 미실행은 NOT VERIFIED |
| CA01 | 원본 snapshot/고정 outcome이 둘째 단계와 최종 결과에서 불변. 새 별칭으로 정확 재매핑; 다른 snapshot/episode/revision·추가 outcome 필드 거부. 본문/인용은 바뀌지 않음 | codec/appraisal/split 단위 검사 |
| CA02 | 첫 단계 실패는 둘째 호출/Core0, 정상 null은 현재 입력 감정 평가 가능. 둘째 실패는 사실 원문을 남기되 Core 적용0·기존 감정 보존. 부분 상태를 성공/무변화로 위장0 | 두 함수 주입·가짜 HTTP·부분 원장/재생 검사 |
| CA03 | 입력/episode scope·행위자/대상/기대·동일 concern의 다른 관측을 보존. 미사용/가정/불명/결과 대기에는 자기 관측결과 appraisal0. 관련 없는 concern 강제감정0. 정당한 정정·인용·피해 보고 오귀속0 | 개발/확인 고정 rubric + 원문 검토; 작성 출력은 계약 검사로만 사용 |
| CA04 | 같은 해석/clock/policy의 Core 결과 동일. 양·음 관측은 별도 보존; 주제 전환/무변화는 기존 기여를 초기화하지 않음. 단순 재참여로 즉시 회복0. 중복100회 추가기여/시간연장0, 해당 source 삭제·정정 회수, 무관 원인 보존 | Core 순수 검사. 신규 eventId/시간으로 연속 맥락을 구성하고 history/stateSourceRefs 연결. 감쇠는 clock 대조로 구분 |
| CA05 | 공급자 이름/SDK가 Core/공용 포트/조합기에 새로 유입0, 두 독립 가짜 함수 구현으로 같은 계약 동작. stage별 입력/원문/hash/버전/usage/실패·합성 Core 기록 추적. 새 모의 개발12/확인12 재생 동일, 기존 provider/codec/Core 영향 회귀·타입 PASS | 경계 검사·unit/eval·준비/재생. 운영/DB/표현/Stage 미연결 명시 |
| CA06 | 개발12와 확인12 **각각** 사실 계약/고정 기대12/12, 감정 계약12/12, scope·관련성·극성/복합·귀속·기대의 필수 의미 기준12/12. 모든 설정/이력 대조 쌍 통과. uncertain도 명세에 따른 답이며 평균으로 위험한 오귀속 상쇄0 | 단계별 실제 원문과 별도 의미 검토. 특정 감정 이름/정확한 수치 일치 요구 없음. 개발 실패면 확인0 |

검증 cwd는 저장소 루트다. 다음 BUILD의 TEMP/TMP·준비/로그는 승인받은 새 `${ARTIFACT_ROOT}/affect-appraisal-r4c-<실행일>/` 아래에 둔다. C2-L 로컬 경로는 구현·실행했고 아래 명령은 그 검증 범위다. 이 절은 C2-L 당시 실행 안내다. 후속 실제 전용 경로는 [C2-P 준비](#r4-c2p-preparation)에 구현·검증했으며 실제 호출 승인은 아직 없다.

```powershell
# C1-L: 준비·모의·재생과 기존8건 회귀
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts --no-cache evals/affect-outcome-confirm.test.ts evals/affect-outcome-run.test.ts evals/affect-outcome-probe.test.ts evals/affect-reference-artifacts.test.ts
node node_modules/vitest/vitest.mjs run --no-cache packages/adapters/src/outcome-probe.test.ts packages/adapters/src/deepseek.test.ts
# C2-L: 사실 고정·두 단계·Core 및 경계
node node_modules/vitest/vitest.mjs run --no-cache packages/adapters/src/appraisal-probe.test.ts packages/adapters/src/split-event-interpreter.test.ts packages/adapters/src/event-reference-codec.test.ts packages/adapters/src/deepseek.test.ts packages/character-core/src/event-affect.test.ts packages/character-core/src/affect-scope.test.ts packages/character-core/src/affect-observation.test.ts
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts --no-cache evals/affect-reconnect.test.ts evals/affect-boundary.test.ts evals/affect-agency-impact.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

신규 CLI는 `affect-outcome-confirm.ts --prepare-outcome-confirm --output <new J path>`와 기존 실행기의 별도 `--rehearse-outcome-confirm`/`--replay-outcome-confirm` 모드를 사용하도록 구현한다. 기존8건 인수 의미를 바꾸지 않는다. C2 평가 CLI는 `affect-reconnect.ts --prepare-reconnect --split dev|confirm --output <new J path>` 및 `--rehearse-reconnect`/`--replay-reconnect`로 분리한다. 실행과 재생은 준비 hash/source/split/모드 검증을 공통으로 수행하고 import만으로 실행하지 않는다. 실제 키/실원장/network 차단 preload와 합성 예산을 모의에 사용한다.

### 예산·확인 집합 보호·마감

마지막 실제 관측은 총 USD0.20·누적52회 승인 안에서 C1-P 완료 후52회/보수0.0560898·잔여0.1439102·미해결0이다. C2-L에서는 실제 원장을 읽지 않았다. **금액 잔여는 새 호출 승인이 아니다.** C1의16회 승인은 사용을 마쳤다. 이후 C2 개발24회에는 누적76회, 적격 확인24회까지에는100회가 필요하다는 산술 계획만 기록하며 C2 호출은 아직 승인되지 않았다. 현재 승인된 금액 상한은0.20을 유지한다. 후속 준비의 개발0.25·적격 확인까지0.45는 미승인 제안이며, 실제 상한과 준비된 요청별 보수 예약액이 맞지 않으면 호출 전에 멈춘다. 가격/토큰 상한/실제 잔여는 실행 직전에 확인한다.

새 live 모드는 legacy B2의0.20/36 guard를 제거하지 않는다. 승인 후 정해진 단계별 누적 상한을 전용 실행 인수·준비 hash·설정·실행 manifest에 일치시켜 검증하고 기존 원장/미해결·attempt 중복 경계를 재사용한다. 동결된 후보의 실제 body와 호출 수·보수 예약액을 먼저 보여준 뒤 해당 단계만 승인받는다. 자동 증액·다른 원장 생성·실패 항목 삭제·같은 확인 재호출0이다.

확인 파일의 정답은 평가기에만 있고 모델 prompt/예시/코드 분기에 들어가지 않는다. C1은 고정 B2 후보 그대로 확인한다. C2 개발과 확인을 읽어 튜닝하는 순서를 막기 위해 실제 confirm 결과는 dev 통과와 prompt/model/policy/source 동결 이후에만 생성한다. fixture를 만드는 작성자가 양쪽 표를 보았다는 한계는 공개한다. 확인 실패 후 후보를 바꾸면 그 확인 집합은 이후 회귀 자료로만 남기고 새로운 확인 자료/승인을 준비한다. 같은 문제의 구현 수정·재감사3회 뒤 미해결은 기록하고 반복을 멈춘다.

**당시 BUILD 인계 — 이번 완료:** “R4-C의 C1-L만 구현해. F01–F16과 고정 후보의 준비/모의/재생을 만들고 CF01–04·legacy8건 회귀·타입·문서 결과까지 검증해. 실제 API/키·원장 접근·한도 변경·C2/운영/DB/Stage는 수행하지 말고 요청 hash/예약액을 준비한 상태에서 감사로 넘겨.” 현재 다음 단계는 위 C2-L 변경 감사다.

<a id="r4-b2-result"></a>

아래 B2 및 이전 기록의 ‘다음’은 각 실행 당시의 인계다. 현재 다음 단계는 위 [C2-L 구현 결과](#r4-c2l-build)의 감사이며, 아래 결과·실패·예산 증거를 소급 변경하지 않는다.
## R4-B2 실제 진단 결과 — 2026-10-17

직전 대화에서 R4-B1 수정 범위의 재감사 PASS를 확인했다. 소스/증거 대조와 메모리 FS로 두 반례·재생을 재확인한 같은 맥락의 검토이며 신규 독립 감사는 아니다. 이후 사용자가 B2 실제8건을 기존 예산 안에서 승인해 `outcome-isolation-repair-r1/mock`의 고정 요청을 각1회 실행했다. 코드·prompt·fixture·의미 기준은 변경하지 않았다.

| 기준 | 판정 | 실제 근거·한계 |
|---|---|---|
| OB06 | PASS — 고정8건 | 계약/고정 outcome/원문 검토 각각8/8. D02/D09/P02의 기존 실패3건 개선, 적합5건 유지. 원본 기준 replay8/8 일치. 원문 검토는 같은 대화의 assistant 검토이며 독립 인간·블라인드 검토가 아님 |
| OB07 | PASS — 실행 통제 | 실제8회·재시도0, 과거 원장28항목 불변, 누적36/36회·미해결0·두 lock 없음. 총0.20 안이며 임시 실행 설정은 원래 파일 바이트로 복원. 공급자 청구서 확인은 아님 |

실행 전 원장은28회/보수0.0477531달러·잔여0.1522469·미해결0이었다. 키 파일에는 키만 있고 실행 예산 설정이 없어 첫 읽기 사전검사가 `deepseek_budget_authorization_required`로 종료했으며 호출0이었다. 기존 실제 원장과 사용자 승인을 확인한 뒤 이번8건에 한해 총0.20/누적36 설정을 임시 적용했다. 예약 상한은0.0307278, 실제 usage와 기존 보수 요율로 계산한 이번 차감은 **0.0028878달러**, 누적 **0.0506409달러**, 잔여 **0.1493591달러**다. 청구액을 확인한 수치가 아니다. 금액이 남아도 호출 한도36회는 소진했으므로 추가 유료 평가를 자동 실행하지 않는다.

증거는 `${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/outcome-isolation-b2-r1/`의 `preflight.json`, `live/`, `execution.json`, `replay/`, `semantic-review.json`, `result.json`이다. 실행 manifest의 REVIEW_REQUIRED·manualAccepted=null은 원형대로 보존하고, 원문 검토 결과는 별도 sidecar에 기록했다. 문항별 근거와 정확도 한계는 [B2 실제 원문 검토](../results/DEEPSEEK_DEV_RESULT.md#r4-b2-actual)가 소유한다. 새 source16개 일치·이전 artifact12개 불변을 확인했다.

이번 관찰은 사실 전용 후보의 outcome이 과거5/8에서8/8로 개선됐다는 증거다. 두 단계 구조의 인과 효과, 다른 공급자보다 나은지, 미사용 확인/전이 장면의 정확도는 검증하지 않았다. D06의 mixed는 결과의 양면성이고 감정 appraisal 검증을 대신하지 않는다. D12의 과거 입력 감정 극성 FAIL도 그대로다. 다음은 R4-C에서 미사용 장면 확인과 감정 재연결의 범위를 계획하는 것이며 운영/SDK/Core/DB/Stage 승격·추가 호출은 이번에 진행하지 않는다.

<a id="r4-b1-repair-1-build"></a>
## 직전 — R4-B1 REPLAN 1 수정 BUILD 결과 — 2026-10-17

아래 재감사 대기는 당시 BUILD 상태다. 이후 재감사 PASS와 B2 실제 결과는 위 현재 기록을 따른다.

사용자의 “계획대로 두 파일 수정하고 회귀 테스트랑 모의 검증까지” 요청을 완료했다. `main` HEAD `fc883fa` 위 기존 H2-A/O1 변경을 보존했고, 코드 변경은 `evals/affect-outcome-run.ts`와 `evals/affect-outcome-run.test.ts` 두 파일이다. 직접 상태 문서10개를 함께 갱신했다. 아래 결과는 BUILD 검증이며 재감사 PASS나 실제 공급자 의미 정확도 판정이 아니다.

- 실행기는 main try 안에서 provider 생성자 검증을 먼저 수행한다. 오류가 나면 출력 없이 기존 오류를 전파하고 취득한 live lock을 해제한다. 검증 정규식이나 schema를 새로 만들지 않았다.
- `mkdirSync` 성공 직후 `outputOwned=true`를 설정한다. 소유 출력에만 최종 결과·manifest·예산 요약을 만들며, 경합으로 생성에 실패한 폴더의 합성 원장도 읽지 않는다. lock 해제는 소유권과 별개다.
- 테스트10개를 추가했다. mock/합성 live 경합2, mkdir 실패2, 잘못된 키4와 수정 후 동일 경로 복구, 앞뒤 공백 정상 키1, all-NOT_SENT STOPPED 거부1이다. 기존 타 실행 lock 보존 검사도 보강했다. 기존 문항·고정 판정·중단/late raw·재생 검증은 유지했다.

### 기준별 결과

| 기준 | BUILD 판정 | 실행 근거 |
|---|---|---|
| BR01 / OB02 | PASS | mock/합성 live의 결정적 EEXIST 경합에서 타 실행 manifest/results/raw/합성 원장 바이트 보존, 출력 쓰기0·해당 원장 읽기0·예약/HTTP0. mkdir 실패와 기존 출력 거부, 자기 lock 해제·타 lock 보존 확인 |
| BR02 / OB03·05 | PASS | 내부 공백/탭·빈/공백 키는 출력·예약·HTTP0, 합성 원장 불변·lock 잔존0. 키만 고친 새 프로세스가 같은 출력/요청으로8회 성공. 기존 정상/앞뒤 공백 키 허용 유지 |
| BR03 / OB03·05 | PASS | 기존 기술 오류8종·부분 실행·유효 late raw/STOPPED 재생 유지. all-NOT_SENT STOPPED는 계속 outcome_stop_missing으로 거부. 새 모의8·재생8 정확히 일치 |
| BR04 / OB01–04 | PASS | 평가3파일96/96, provider32/32·타입 PASS. 승인·source·예산·중복·unknown·의미 FAIL 지속 및 옛5적합/3FAIL 보존. 보호 대상 소스15개 hash 불변 |
| BR05 / OB02·05 | PASS | 새 준비 source16개 현재 코드 일치. 옛 준비는 source 불일치로 secret 전에 거부. 이전 artifact12개 hash 불변. 원본/요청 hash·예약 계산0.0307278 그대로. 실제 providerCalls0·모의 의미 NOT_RUN |
| BR06 | PASS | 현재 상태/증거/한계와 다음 재감사를 직접 문서에 동기화. 과거 계획·173/173·감사 FAIL·실제 FAIL을 보존. B2/실제 의미/정산은 NOT VERIFIED |

### 실행 증거와 한계

증거 루트: `${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/outcome-isolation-repair-r1/`. 도구의 별도 로컬 저장소 쓰기 승인을 받아 새 폴더를 생성했고 TEMP/TMP도 그 아래 `tmp`로 지정했다. 실제 secret/원장 접근 및 외부 fetch 차단 preload를 CLI에 적용했다. 합성 live는 테스트의 가짜 설정·원장·HTTP를 뜻하며 실제 DeepSeek 호출이 아니다.

| 증거 | 관측 |
|---|---|
| `baseline.json`, `baseline/` | 수정 전 두 파일 원문/hash, 보호 소스15·이전 artifact12·원본/요청 metadata |
| `red.json` | 최초5PASS/5FAIL/50선택제외. 그중1건은 mkdir 실패 검사 guard가 합성 원장까지 막은 검사 조건 문제 |
| `red-confirmed.json` | 합성 경로만 허용하도록 검사 조건 수정 뒤 **6PASS/4FAIL/50선택제외**. 네 실패는 mock/live 덮어쓰기와 내부 공백/탭 키의 출력 잔존. 실행기 수정 전 실제 결함 재현 |
| `green-evals.json` | runner60 + offline12 + refs artifact24 = **96/96**, 실패/skip0. 위 신규10개 포함 |
| `green-provider.json` | 기존 DeepSeek adapter **32/32**, 실패/skip0 |
| `verification.json` | 타입 명령 exit0, CLI3종 exit0, 새/보호/과거 hash 대조, 옛 준비 사전 거부 및 최종 소스 hash |
| `offline/`, `mock/`, `replay/` 및 `*-cli.log` | 새 준비·모의8·재생8. mock OUTCOME_MOCK_PASS, replay OUTCOME_OFFLINE_REPLAY, 실제 호출0 |
| `stale-cli.log`, `no-provider-io.mjs` | 옛 준비의 outcome_preparation_changed, 출력 생성0·secret 접근 시도0. CLI guard는 이번 모의 원장만 허용 |

최종 새 실행 합계는 **128/128**이다. 순수 probe55와 이전173/173은 새 합계에 더하지 않는다. 계획의 영향 검사/타입/CLI 명령을 실행했으며 전체 suite·DB·브라우저·모델 품질 평가는 수행하지 않았다. red의 검사 guard 조정은 합성 원장만 허용한 것이며 제품 기준이나 실제 원장 차단을 완화하지 않았다.

현재 실행기 SHA256은 `6f317bbddd409fb958b1c8e3ed3c69c777c91fe3d34cd20eb25ebcc97b716102`, 테스트는 `d4d0918cf9bf95d604d7d7b15be9844386144d60ea488fd66c24decfe7d74279`다. 원본 hash `ba350b402d8afa8d32948cbd9bc2941384f6827435ccce9adb8f41fdbeff575b`, 요청 hash `ec8dc80773eed4d7aff64a02bef3b928e44eb4e3f9acb66d582a7f1dda19736d`, 예약 계산 **USD0.0307278**은 그대로다. 실제 원장 잔여는 이번에 읽지 않았다.

다음은 이 두 파일의 수정 delta와 BR01–06에 대한 **재감사**다. 실제 API/키·원장·운영 설정 변경·커밋/푸시0이다. B2 실제8건, 감정 연결/O1/Stage 완료는 별도로 남으며 이번 모의 통과로 승격하지 않는다. 이 수정 BUILD에 대한 감사 제안을 인계한다.

<a id="r4-b1-repair-1"></a>
## R4-B1 감사 후 수정 계획 — 2026-10-17 / REPLAN 1

아래는 수정 착수 전 계획과 당시 NOT VERIFIED/FAIL 기록이다. 실제 구현·검증 결과와 현재 다음 단계는 위 수정 BUILD 결과가 소유한다.

사용자 요청은 수정 계획·성공 기준·변경할 파일의 선행 작성이다. **이번에는 문서만 수정하며 구현·테스트 실행·실제 API 호출은 하지 않는다.** 첫 R4-B1 감사의 확정 결함 두 개만 다룬다. 수정 BUILD/재감사 반복은 아직 시작하지 않았으며 과거 R3/R4-A 작업과 횟수를 혼동하지 않는다.

### 근거와 현재 판정

직전 감사는 같은 대화 맥락에서 소스 검토와 메모리 파일시스템 반례로 수행했다. 실제 파일쓰기·키/실제 원장 접근·네트워크 호출은 0이었다. 기존173/173 결과와 준비 source16개 일치를 대조했으며 기존 테스트를 새로173회 실행했다는 뜻은 아니다.

| finding / 필요성 | 재현과 원인 | 영향 기준·현재 판정 |
|---|---|---|
| R4B-AUDIT-OUTPUT / P2 REQUIRED | `runOutcomeDiagnostic`의 사전 존재 검사 뒤 다른 프로세스가 같은 폴더를 생성하면 `mkdirSync`는 EEXIST로 실패한다. 그러나 finally가 존재 여부만 보고 다른 실행의 `results.jsonl`·`manifest.json`을 덮어쓴다. 메모리 재현에서 두 파일의 기존 값이 바뀌고 새 STOPPED/시도0으로 대체됨 | OB02 FAIL: 출력 덮어쓰기 금지·증거 보존 |
| R4B-AUDIT-SETUP / P3 REQUIRED | 합성 키 `synthetic key`는 CLI의 비어 있음 검사만 통과한 뒤 provider 생성자에서 `deepseek_key_missing`으로 거부된다. 생성이 출력 생성 뒤·문항 try 밖에 있어 all8 NOT_SENT/ERROR0인 STOPPED를 저장하고, 같은 실행기의 replay는 `outcome_stop_missing`으로 거부함. 원장 변화/호출0, lock 해제는 기존에도 정상 | OB05 FAIL: 실행기가 만든 중단 기록의 재생 일관성 |

OB01·OB03·OB04는 감사한 로컬/모의 범위에서 추가 결함이 없었다. OB06–07 실제 의미 품질·실제 정산은 NOT VERIFIED다. 두 문제는 평가 실행기의 결함이며 DeepSeek 의미 판단이나 제품 감정 설계의 한계로 해석하지 않는다. 선택적 정리·추가 기능은 이번 수정에 포함하지 않는다.

### 기준선과 변경 경계

기준은 `main` HEAD `fc883fae300e04f57ea01290b8eb43331fd0fbfa`와 현재 미커밋 작업이다. 두 수정 대상은 이미 존재하는 R4-B1 파일이며 Git에는 아직 미추적 상태다. 새 파일로 다시 만들거나 HEAD로 되돌리지 않는다. BUILD 착수 시 아래 SHA256을 대조하고 달라졌으면 관련 차이만 확인한다.

| 파일 | 계획 작성 시 SHA256 |
|---|---|
| `evals/affect-outcome-run.ts` | `715932bd5ca435fb7bb1b53d28c9d053a5dd5fbd089f4fbeb5647e9d21a67416` |
| `evals/affect-outcome-run.test.ts` | `cb19adc414008a7aa24ad683bc8e7e22b60d9eb36fe2eeb2af02d2075c6d4fc3` |
| `packages/adapters/src/deepseek.ts` — 읽기·회귀만 | `9caf8f80a5b6db3cf15c9f2ac1c0abeb43f099ea16a22d1da82d4b24a5a92fa2` |
| `evals/affect-outcome-probe.ts` — 새 준비 생성만 | `4555d3cd3f6f0a099acb07bff95fb95bba702515e06fcb2bcc5411ee319a3728` |

실제 키/원장, 기존 준비·실제 원문·FAIL 기록, H2-A/O1의 관련 없는 미커밋 변경을 보존한다. prompt/codec/fixture/고정 비교기·공통 전송/예산 정책·포트/Core/DB/Stage는 변경하지 않는다. 새 모델·라이브 진단·API 결제·상한 증액·커밋/푸시는 이 계획의 BUILD 범위에 없다.

### 수정 결정과 파일·심볼

**출력 소유권:** `outputOwned`를 false로 두고, 배타적인 `mkdirSync(root)`가 성공한 직후에만 true로 바꾼다. 다른 프로세스가 만든 폴더는 소유하지 않는다. finally의 결과/manifest 생성·요약 및 쓰기는 이 실행이 소유한 출력에만 수행한다. 미소유 출력의 synthetic budget도 읽지 않는다. 공유 lock 해제는 출력 소유권과 무관하게 기존 바깥 finally에서 보장한다. 기존 폴더를 지우거나 병합·이름 변경·덮어쓰는 복구는 하지 않는다.

**설정 검증:** `log`/`fetcher`/콜백 구성과 `DeepSeekOutcomeProbe` 생성을 기존 main try 안에서 `mkdirSync` 앞으로 옮긴다. 생성자는 현재 paid/key 검증만 수행하며 예약·HTTP·콜백을 실행하지 않는다. 설정 오류는 기존 오류로 전파하고 출력 폴더/STOPPED manifest를 만들지 않는다. 생성자를 try 밖으로 빼면 이미 취득한 live lock이 남을 수 있으므로 금지한다. probe 호출은 폴더·입력·로그 초기화가 완료된 뒤 기존 문항 루프에서만 시작한다.

키 검사 정규식을 CLI에 복제하거나 새 검증 추상화를 추가하지 않는다. 검증 주체는 기존 `DeepSeekChat` 생성자로 유지한다. 설정 오류를 첫 문항의 ERROR로 꾸미거나, all-NOT_SENT STOPPED를 수용하도록 replay 검증을 완화하지 않는다. artifact schema와 preparation-v2는 유지하며 구현 소스 해시만 새로 준비한다.

| 순서 | 기존 파일·심볼 | 예정 변경 / 연결 기준 |
|---|---|---|
| 1 | `evals/affect-outcome-run.test.ts`: child preload/합성 live 도우미와 새 `R4B-AUDIT-*` 사례 | 결정적인 EEXIST 경합과 잘못된 합성 키를 재현하는 회귀 추가. sleep으로 우연한 경합을 기다리지 않고 테스트 전용 FS 주입으로 검사-생성 사이에 다른 실행의 파일을 배치. 실제 키/원장/네트워크 guard 유지. BR01–03 |
| 2 | `evals/affect-outcome-run.ts`: `runOutcomeDiagnostic`의 main try/finally·provider 구성 | outputOwned에 따른 기록과 생성자 검증 순서만 수정. `inspectRecording`, comparator, request builder는 변경하지 않음. BR01–04 |
| 3 | 같은 테스트 파일: 정상·중단·preflight·재생 회귀 | 설정 수정 후 새 실행의 정상 복구, 소유 출력 기록, lock 해제, 기존 중단·변조 거부를 증명. 기존 기대값·분모를 유지. BR02–04 |
| 4 | `evals/affect-outcome-probe.ts`의 기존 CLI와 `evals/affect-outcome-run.ts`의 모의/재생 CLI — 실행만 | 새 source hash로 별도 별도 로컬 저장소 준비/모의/재생 결과 생성. 해당 probe 파일의 코드 수정 없음. BR05 |
| 5 | 이 문서와 아래 직접 상태 문서 | 기준별 실제 결과·새 증거·잔여 한계를 갱신. BR06 |

직접 상태 문서는 `BUILD_HANDOFF.md`, `IMPLEMENTATION_PLAN.md`, `VALIDATION_PLAN.md`, `NEXT_DECISIONS.md`, `PLANNING_CHANGELOG.md`, `docs/OUTCOME_AFFECT_PLAN.md`, `docs/OUTCOME_AFFECT_RESULT.md`, `docs/DEEPSEEK_DEV_RESULT.md`, `docs/DEEPSEEK_CONNECTION.md`다. 상세 계획과 기준은 이 문서 한 곳이 소유하며 다른 문서에는 현재 상태와 링크만 맞춘다. 신규 코드/설정/의존성 파일은 계획하지 않는다.

### 성공 기준 — 아래 항목은 아직 미실행

| ID / 기존 기준 | 관측 가능한 성공 조건 | 검증·증거 | 상태 |
|---|---|---|---|
| BR01 / OB02 | mock와 합성 live 각각에서 사전 검사 직후 다른 실행이 만든 출력의 manifest/results/원문·합성 원장이 바이트 단위로 보존됨. 이 실행의 출력 파일 쓰기·예약·fetch0, EEXIST 전파. 기존 폴더의 빠른 거부와 폴더 생성 자체의 실패도 출력/최종 기록0. 합성 live의 자체 lock 생성/해제는 허용하며 타 실행의 lock은 삭제하지 않음 | 수정 전 덮어쓰기 FAIL → 수정 후 PASS. 주입 FS의 쓰기 횟수·sentinel 전후 바이트, 합성 live lock 해제 확인 | NOT VERIFIED |
| BR02 / OB03·05 | 내부 공백·탭이 있는 합성 키를 `deepseek_key_missing`으로 출력 생성 전에 거부. 빈/공백뿐인 키도 계속 사전 거부. 모두 원장 불변·예약/fetch0·신규 출력0·취득 lock 잔존0, 오류 출력에 키 값 없음. 정상 키 및 기존 생성자가 허용하는 앞뒤 공백 키는 불필요하게 차단하지 않음 | 합성 config를 주입한 child 검사. 잘못된 키 수정 뒤 같은 요청·출력 경로로 새 실행이 정상 진행됨을 가짜 live로 확인 | NOT VERIFIED |
| BR03 / OB03·05 | 소유 출력의 정상8건 기록·재생 유지. 실제 요청이 시작된 뒤 기술 오류는 기존 ERROR/뒤 NOT_SENT와 원문을 보존하고 replay 가능. 2시도/1decode/6미실행과 유효 late raw의 STOPPED_RAW_NOT_PROMOTED 유지. all-NOT_SENT STOPPED 변조는 계속 거부 | 기존 mock/replay, 기술 오류8종, 늦은 응답·변조 회귀. 정상/설정 실패/경합/기술 실패마다 합성 live lock 해제 | NOT VERIFIED |
| BR04 / OB01–04 | 준비/승인/source/hash 훼손은 비밀 접근 전 거부. 기존 예산·횟수·중복·unknown 차단과 의미 FAIL 지속 처리 유지. 과거5 REVIEW_REQUIRED/3FAIL(D02/D09/P02), planned8·manualAccepted=null·감정 NOT_EVALUATED 유지 | 실행기·offline/refs artifact 집중 회귀와 DeepSeek 기존 adapter 검사, 타입 검사. 변경하지 않은 fixture/prompt/전송 소스 hash 대조 | NOT VERIFIED |
| BR05 / OB02·05 | 이전 artifact를 수정하지 않고 새 source16개가 현재 코드와 일치하는 준비 생성. 원본8/작성24·mock8/replay8 일치, 실제 providerCalls0·의미 NOT_RUN. 수정 전 준비는 source 불일치로 새 실행에서 비밀 접근 전에 거부 | 별도 repair-r1 디렉터리와 manifest/hash 대조. 원본/요청 hash 및 예약0.0307278은 기존과 같아야 함. 불일치 시 실행 범위 변경 원인을 보고하고 중단 | NOT VERIFIED |
| BR06 / 문서 | 수정 전 감사 FAIL·173/173 과거 증거를 보존하고, BR01–05 실행 결과·명령·환경·새 경로와 미실행을 구분. 현재 next는 수정 BUILD 후 재감사이며 B2·실제 의미 품질을 완료로 쓰지 않음 | 직접 상태 문서 대조·링크 확인·diff 검사. 실제 비밀/원장 접근·API0을 실행 조건과 함께 기록 | NOT VERIFIED |

### 실행 순서와 검증 명령

아래는 **다음 BUILD용 미실행 명령**이다. cwd는 `${REPO_ROOT}`, 설치된 Node·의존성을 사용한다. 테스트 임시 파일과 결과는 별도 로컬 저장소에 둔다. `${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/outcome-isolation-repair-r1/`를 새 증거 루트로 사용할 예정이며, 존재하면 덮어쓰지 않고 새 회차명을 기록한다. 별도 로컬 저장소 쓰기 권한이 없으면 실행 도구의 승인을 받고, 거부되면 C: 등으로 우회하지 않는다.

1. 현재 소스/테스트와 보존 대상 hash를 확인한다. 테스트만 추가한 뒤 `R4B-AUDIT-*`의 수정 전 FAIL을 기록한다. 검사 환경 자체의 실패와 회귀 재현을 구분한다.
2. 실행기 두 경계를 수정하고 같은 회귀가 PASS인지 확인한다. 타이머·공급자·평가 기준을 바꾸지 않는다.
3. 아래 영향 검사·타입 검사 후 기존 offline CLI로 새 준비를 생성한다. 모의/재생은 실제 비밀 파일·원장·network를 차단하는 기존 guard 방식으로 실행한다. `evals/affect-outcome-run.test.ts`의 guard를 바탕으로 증거 루트의 `no-provider-io.mjs`를 준비하되, 경로를 정규화한 뒤 이번 `$r4RepairRoot/mock/synthetic-budget.json`만 예외로 허용한다. 기존 `/budget\.json/` 차단식을 그대로 적용하면 이 합성 원장도 차단되므로 주의한다. runtime-data의 비밀 파일과 실제 원장은 계속 차단하고 fetch도 throw한다. 이는 별도 로컬 저장소 검증 보조 산출물이며 새 저장소 코드가 아니다. 실제 분기는 테스트 내부의 합성 설정/원장/가짜 fetch만 허용한다.

```powershell
$r4RepairRoot = '${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/outcome-isolation-repair-r1'
# 위 새 루트와 tmp 폴더는 별도 로컬 저장소 쓰기 승인 후 배타적으로 생성한다.
$env:TEMP = "$r4RepairRoot/tmp"
$env:TMP = $env:TEMP
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts --no-cache evals/affect-outcome-run.test.ts -t 'R4B-AUDIT-'
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts --no-cache evals/affect-outcome-run.test.ts evals/affect-outcome-probe.test.ts evals/affect-reference-artifacts.test.ts
node node_modules/vitest/vitest.mjs run --no-cache packages/adapters/src/deepseek.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
# CLI 호출은 위에서 준비한 secret/실제 ledger/network 차단 preload를 적용한다.
node --import "file:///$r4RepairRoot/no-provider-io.mjs" --experimental-transform-types evals/affect-outcome-probe.ts --prepare-outcome-probe --output "$r4RepairRoot/offline"
node --import "file:///$r4RepairRoot/no-provider-io.mjs" --experimental-transform-types evals/affect-outcome-run.ts --rehearse-outcome --prepared "$r4RepairRoot/offline" --output "$r4RepairRoot/mock"
node --import "file:///$r4RepairRoot/no-provider-io.mjs" --experimental-transform-types evals/affect-outcome-run.ts --replay-outcome --recorded "$r4RepairRoot/mock" --output "$r4RepairRoot/replay"
git diff --check
```

red/green 로그·집중 검사 JSON·타입 결과·소스 대조를 새 증거 루트에 남기며 예상 테스트 수를 실제 통과 수로 미리 기입하지 않는다. 전체 suite·DB·브라우저 검증은 이 두 평가 도구 결함에 필요하지 않다. 기존 순수 probe55 검사는 관련 코드/조건이 그대로면 과거 증거를 유지하고 신규 실행 합계에 더하지 않는다.

### 증거 수명과 종료 조건

실행기 소스가 바뀌면 수정 전 runner 테스트와 offline-r2/mock-r1/replay-r1은 이전 버전의 증거로 남는다. manifest의 source hash를 손으로 고치거나 현재 코드에서 옛 준비를 통과시키지 않는다. 새 preparation 생성이 requestHash를 바꾸거나 paid 중복 방지를 초기화할 이유가 되어서는 안 된다. 과거 실제8건·정답·FAIL·실제 원장은 그대로 유지한다. 이번 문서 변경만으로 기존 테스트 증거가 무효가 되는 것은 아니다.

BUILD 종료는 BR01–06 PASS와 영향 검사·타입·새 모의/재생 증거 확보다. 미실행/실패가 있으면 그대로 NOT VERIFIED/FAIL로 남긴다. 다음 재감사의 초점은 소유권 설정 시점, 생성자 실패 시 lock 해제, 폴더 초기화 전 콜백 미실행, late raw가 원래 중단 행에 남는지다. 같은 문제의 수정·재감사를3회 했는데 해결되지 않으면 남은 문제를 기록하고 루프를 멈춘다. B2 실제 호출과 모델 품질 검증은 별도 다음 단계로 유지한다.

**다음 BUILD 지시:** “이 문서의 R4-B1 REPLAN 1대로 `evals/affect-outcome-run.ts`와 `.test.ts`의 두 경계를 수정해. 먼저 두 감사 반례를 회귀로 고정하고 BR01–06·영향 검사·타입·새 모의8/재생8을 검증해. 실제 키/원장/API·prompt/fixture·운영/Core/DB/Stage는 건드리지 말고, 문서 결과를 맞춘 뒤 재감사 가능한 상태에서 멈춰.”

## R4-B1 BUILD 인계 — 2026-10-17

이 절의 PASS와 다음 AUDIT는 수정 전 BUILD 당시 기록이다. 이후 감사에서 OB02·OB05가 FAIL로 확인됐으며 현재 상태와 다음 작업은 위 REPLAN 1이 소유한다.

사용자의 'R4-B1 구현하고 모의 검증까지' 요청에 따라 계획의6개 코드/테스트 파일과 직접 상태 문서만 변경했다. main HEAD `fc883fa` 위 기존 H2-A/O1 미커밋 변경을 보존했다. 작업 단계는 BUILD 완료이며 별도 감사 통과를 주장하지 않는다.

- `packages/adapters/src/deepseek.ts`: 실험용 `DeepSeekOutcomeProbe.probe`를 추가했다. 입력 준비는 예약 전, 출력 검증은 기존 decode/중단 경계를 사용한다. 새 import와 클래스 추가를 제외한 기존 전송 코드는 R4-A 소스 hash와 바이트 일치한다. 운영 provider 등록/포트 변경은 없다.
- `packages/adapters/src/deepseek.test.ts`: 정상/null의 정확한 body·예약, 잘못된 입력0호출, JSON/참조/인용/추가 필드 실패 뒤 정지, snapshot·deadline 검사를 추가했다.
- `evals/affect-outcome-probe.ts`: `buildOutcomeProbePreparation`을 추출하고 preparation-v2·계획 호출8·provider/model·새 실행기 source hash를 기록한다. 기존 offline 진입점의 유료 플래그 거부는 유지했다.
- `evals/affect-outcome-probe.test.ts`: metadata의 실제/예정 호출 구분을 갱신했다. 과거8 원문/기존 판정·작성24·기존 live 차단 검사는 유지했다.
- 신규 `evals/affect-outcome-run.ts`: 모의/전용 실제/오프라인 재생3모드, 준비의 원본/전송/소스 검증, 고정 outcome 비교, 기존 원장/공유 lock/시도 차단, 부분 결과·원문/중단 기록을 구현했다. 실제 실행 기능은 모의 주입으로만 검증했다.
- 신규 `evals/affect-outcome-run.test.ts`: 실행 인수/자료 훼손/예산·횟수/unknown·lock/중복·오류/늦은 원문/재생 반례를 검증한다. 실제 분기 검사는 합성 설정·합성 원장·가짜 fetch로만 진행했다.

기존 full-task 실행기/평가기/fixture·순수 probe prompt/decoder·codec·예산 계산 정책·포트/Core/DB/Stage는 수정하지 않았다. R4-A 작성24와 실제8 동결 fixture hash도 그대로다. 첫 평가 실행에서 새 비교기의 적합 상태를 PASS로 둔 탓에 과거 `REVIEW_REQUIRED`와 불일치한1건이 실패했다. 새 비교기를 기존 상태와 동일하게 맞췄으며, 기대 답이나 과거 FAIL을 바꾸지 않았다.

| 기준 | 당시 BUILD 판정 | 실제 근거·한계 |
|---|---|---|
| OB01 | PASS (모의) | provider32검사에 기존24와 새8 포함. 준비/예약/결과·입력/출력 실패·snapshot·deadline 검증. 실제 공급자 호출 아님 |
| OB02 | PASS (로컬/모의) | 승인6종·준비13종·모의 원문 훼손이 secret 전에 거부. 기존 offline/두 공급자 full live guard 유지. 새 준비 소스16 hash 일치 |
| OB03 | PASS (모의) | 유효한 null 답8건은 고정 기준1적합/7FAIL이어도 끝까지 처리. 재시도·metadata/출력 경로 변경 중복·예산/횟수/lock/unknown 차단. 기술 오류8종은2회 뒤 중단·과거 합성 원장 보존 |
| OB04 | PASS (고정 비교) | 옛5 REVIEW_REQUIRED/3FAIL 일치. 부분 실행은2시도/1decode/6미실행·전체 분모8 유지. manualAccepted=null, 감정 NOT_EVALUATED |
| OB05 | PASS (모의/재생) | 모의8와 재생8 결과 일치. 원문/결과 변조·잘림/누락/중복 거부. timeout 뒤 늦은 유효 원문도 STOPPED에서 승격하지 않음 |
| OB06–07 | NOT VERIFIED (실제) | 실제8건·원문 의미 수용·실제 예산 정산/설정 복원은 B2에서 확인. 이번 실제 키/원장 접근·API/모델 추론0 |

검증 cwd는 저장소 루트이며 TEMP/TMP·결과는 `${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/` 아래다. 별도 로컬 저장소 쓰기는 도구 권한 승인으로 수행했다.

| 실행·증거 | 결과 |
|---|---|
| `outcome-run-baseline-r1.json` | 변경 전 기존 DeepSeek24/24. 아래 최종 합계에 중복 합산하지 않음 |
| `outcome-run-unit-r1.json` | DeepSeek32 + 순수 probe55 = **87/87**, 실패/skip0 |
| `outcome-run-eval-r1.json` → `outcome-run-eval-r2.json` | 최초84PASS/1FAIL의 상태명 불일치 수정 뒤 새 실행기49/49. 최종 합계에 중복 합산하지 않음 |
| `outcome-run-eval-final-r1.json` | offline12 + 실행기50 + 기존 refs artifact24 = **86/86**, 실패/skip0 |
| TypeScript | `tsc --noEmit -p tsconfig.json` PASS |
| `outcome-isolation-offline-r2` | 원본8·요청8·작성24, `OUTCOME_OFFLINE_PREPARED` |
| `outcome-isolation-mock-r1` | 가짜 HTTP8, `OUTCOME_MOCK_PASS`, 의미 NOT_RUN |
| `outcome-isolation-mock-replay-r1` | `OUTCOME_OFFLINE_REPLAY`,8건 일치, providerCalls0 |

최종 합계 **173/173**은 단위87+평가86이며 R4-A101·baseline24·중간 재실행과 중복 합산하지 않는다. 모의 및 재생 CLI에는 실제 비밀 파일/원장과 네트워크를 차단하는 guard도 적용했다. 모의 답8개가 고정 기준에 맞는 것은 작성 답의 계약 검사이지 DeepSeek 개선이 아니다. 실제 분기를 가짜 HTTP로 실행한 테스트의 manifest는 테스트 환경 증거일 뿐 실제 사용량이 아니다.

새 준비 source hash16개를 현재 파일과 대조했다. 원본 hash `ba350b402d8afa8d32948cbd9bc2941384f6827435ccce9adb8f41fdbeff575b`, 요청 hash `ec8dc80773eed4d7aff64a02bef3b928e44eb4e3f9acb66d582a7f1dda19736d`는 r1과 같다. body를 변경하지 않았기 때문이다. 보수 예약 계산 **USD0.0307278**도 같다. 소스/준비 버전은 달라 r1을 새 실행에 사용하지 않으며 과거 artifact를 덮어쓰지 않았다.

다음은 **R4-B1 AUDIT**다. B2 실제 호출은 하지 않았다. 직전 계획에서 확인한 실제 원장28회/보수0.0477531·미해결0은 그 당시 관측이며 이번에 다시 읽은 값이 아니다. 기존 총0.20/누적36과 과거 실패는 유지한다. 감정 재연결·두 호출 구조·O1/Stage 완료는 미검증이다.

## R4-B — 사실 전용 후보의 실제 비교를 위한 구현 계획

아래는 최초 착수 전 계획이다. 그 당시 미구현/승인 상태와 이후 BUILD 결과를 보존하며, 현재 다음 단계는 문서 상단의 REPLAN 1 수정 BUILD다.

### 출발점·범위

사용자는 R4-A 감사 결과 뒤 제시한 '실제8건 비교의 실행 경로와 기준 준비'를 승인했다. 이번 단계는 계획과 문서 정리다. 코드·키 설정·원장 변경, API/로컬 모델 추론은 하지 않았다. main HEAD `fc883fa`와 기존 H2-A/O1 미커밋 작업 위에 이어가며 관련 없는 변경은 보존한다.

직전 대화의 R4-A 감사는 OP01–06 로컬 범위 PASS·필수 수정 없음이다. 같은 작업 맥락의 검토였으며, 기존101/101 기록과 소스15개 hash·원본/전송 hash를 대조했다. 요청8 재생성·작성24 왕복·과거8 판정 재검증도 일치했다. 이는 실제 DeepSeek 정확도나 감정 과제와의 간섭을 입증한 결과가 아니다.

목표는 **같은 원본8건에 사실 전용 요청을 한 번씩 보내고, 이전 outcome5/8과 비교 가능한 원문·판정·중단 기록을 남기는 것**이다. OpenAI는 크레딧 소진으로 보류하고 DeepSeek를 유지한다. 작성24는 로컬 계약 검사로 유지하며 이번 실제 호출에 넣지 않는다. 추천 생성·감정 재평가·두 호출 파이프라인·운영/SDK 포트·Core·DB·Stage 연결은 범위 밖이다.

| 단계 | 한 번에 진행할 범위 | 마감선 |
|---|---|---|
| **R4-B1: 다음 BUILD** | 기존 전송 재사용, 전용 실행/재생, 고정 비교기, 모의 검증과 새 준비 | OB01–05 로컬 증거·요청 hash·예약액을 남기고 감사. 실제 API0 |
| **R4-B2: 실제 진단** | B1 감사 뒤 구체8건 범위가 확인되면 최대8회, 재시도0. 원문 검토·오프라인 재생·결과 기록 | OB06–07 판정. 실패/부분 실행을 보존하고 같은 후보를 자동 재실행하지 않음 |
| **R4-C: 다음 판단** | 실제 결과를 보고 연결 후보나 다른 구조를 계획 | 8/8도 운영 승격·일반화 증거가 아니며 두 단계 구조를 자동 채택하지 않음 |

### 비교 문항과 성공 판정

기존 `materializeAffectDiagnostic`의 ID·순서·원본 요청·`item.expected.outcome`을 그대로 사용한다. 새 비교기는 episode ID, use, 허용 result만 검사하며 기존 `checkAffectCandidate`와 fixture는 바꾸지 않는다. 새 결과에 가짜 status/appraisals를 붙여 전체 평가기에 넣지 않는다.

| 순서 | 문항 | 사실 전용 고정 기대값 | R3-B outcome |
|---|---|---|---|
| 1 | D01 | 자기 episode, used / unfavorable | 적합 |
| 2 | D02 | 자기 episode, not_used / pending. 타인 결과 오귀속 금지 | FAIL |
| 3 | D06 | 자기 episode, used / mixed | 적합 |
| 4 | D09 | 자기 episode, not_used / pending. 기대와 사용 구별 | FAIL |
| 5 | D10 | outcome=null. 모호한 후보 확정 금지 | 적합 |
| 6 | D12 | 자기 episode, hypothetical / pending | 적합. 기존 감정 극성 FAIL은 유지 |
| 7 | P01 | 자기 episode, used / pending. 시작과 평가 완료 구별 | 적합 |
| 8 | P02 | 자기 episode, not_used / pending. 현재 정정 반영 | FAIL |

실제 진단 성공은 **계약8/8 + 고정 outcome8/8 + 원문 의미 검토8/8**이다. D02/D09/P02를 모두 고치고 이전 적합5건도 유지해야 한다. 6/8·7/8 등은 부분 개선으로 기록하며 성공으로 승격하지 않는다. 이전 전체4/8과 새 outcome8/8을 같은 지표처럼 비교하지 않는다.

원문 검토는 추천자·사용자, episode 연결, 현재 정정과 과거 주장, 사용 시작 여부, 관측 결과의 존재, 타인 결과 오귀속, 보고되지 않은 unfavorable 생성 여부를 본다. 자동 고정 판정과 별도 `semantic-review.json`의 문항별 근거를 함께 남기고 불일치를 숨기지 않는다. D12의 입력 감정과 D06의 실제 양·음 감정은 이번 출력에 없으므로 NOT_EVALUATED다. 감정을 숨기거나 영으로 바꾼 결과로 해석하지 않는다.

이 비교는 이미 알려진 개발8건과 과거 응답의 비교다. 독립 확인24/전이/실제 연속 대화가 아니며, stochastic sampling·시점·서버 모델 변경을 통제하지 못한다. 공식 가격표의 현재 `deepseek-flash`는 `DeepSeek-V4.1-Flash-1017`이지만 과거 응답은 alias만 기록했다. 새 응답에서도 실제 반환 model을 기록하되 정확한 같은 revision이라고 추정하지 않는다. 개선되더라도 감정 과제 제거의 인과 효과를 확정하지 않는다.

### 소유 파일·구현 순서

| 순서 | 파일·심볼 | 변경과 검증 연결 |
|---|---|---|
| B1-1 | 기존 `packages/adapters/src/deepseek.ts`에 `DeepSeekOutcomeProbe` 추가 | `DeepSeekChat`을 상속하는 실험용 클래스. 공통 전송·예산을 재사용하고 운영 등록 없음. OB01 |
| B1-1 검사 | 기존 `packages/adapters/src/deepseek.test.ts` | 새 probe 정상/null·snapshot·오류 뒤 정지·정확한 전송/예약 검사. 기존 dialogue/event 동작도 해당 파일에서 회귀 검사 |
| B1-2 | 기존 `evals/affect-outcome-probe.ts`의 `buildOutcomeProbePreparation` 추출 및 `prepareOutcomeProbeOffline` | 현재 준비 내용을 순수 반환하는 함수로 분리해 준비·검증에서 재사용. 새 artifact version/전송 소스 hash를 포함. offline CLI는 계속 live/paid 플래그 거부. OB02 |
| B1-2 검사 | 기존 `evals/affect-outcome-probe.test.ts` | 새 준비 metadata·원본/wire/hash 및 기존 offline 차단 검사 갱신. 과거8 원문·기준/작성24 검사 유지 |
| B1-3 | 신규 `evals/affect-outcome-run.ts`의 `verifyOutcomeProbePreparation`, `checkOutcomeProbeCandidate`, `compareOutcomeProbeDiagnostic`, `runOutcomeDiagnostic`, `replayOutcomeDiagnostic` | 같은 과제의 모의/실제/재생 진입점. 순수 준비·고정 비교 재사용, import 시 실행하지 않음. OB02–05 |
| B1-3 검사 | 신규 `evals/affect-outcome-run.test.ts` | CLI/준비 훼손·가짜 HTTP/원장·중복·중단·부분 결과·재생 검사. 실제 secret/network 접근 guard. OB02–05 |
| B1-4 | 이 문서·`BUILD_HANDOFF.md`·`VALIDATION_PLAN.md`·연결/결과 문서 | 구현/모의/실제 상태와 새 증거 경로 기록. 실제 결과 원문 설명은 `docs/DEEPSEEK_DEV_RESULT.md`가 소유 |

`outcome-probe.ts`의 prompt/decoder, codec, 기존 full-task 실행기/평가기/fixture, 예산 계산 정책, 포트/Core/DB는 이번 변경 대상이 아니다. 새 진단을 위해 범용 전송 framework나 별도 provider factory를 만들지 않는다. 소유6파일 외 변경은 구체적인 결합 문제를 발견했을 때만 근거를 남긴다.

### 전송·준비 계약

`DeepSeekOutcomeProbe.probe(input: EventInterpretationRequest): Promise<OutcomeProbeResult>`는 먼저 `prepareOutcomeProbe`로 snapshot을 고정하고 기존 `DeepSeekChat.decode(request,2048,decoder)`를 호출한다. 준비 실패는 `outcome_probe_invalid_input`으로 예약/HTTP 전에 종료한다. decode 실패는 `outcome_probe_invalid_output`으로 변환하고 기존 stopped 경계를 적용한다. 결과에 EventInterpretationResult/status/appraisals를 추가하지 않는다. 기존 `onResponse`로 검증 전 원문과 model/finish/truncated를 수집한다.

새 준비는 `artifactVersion: outcome-probe-preparation-v2`, 기존 taskKind `outcome-only-diagnostic-v1`, prompt `outcome-probe-v1`, codec `event-refs-v1`, refs-v1을 명시한다. `prepared.provider/model/plannedProviderCalls:8`을 기록하고 기존 모호한 `modelProposal/generationCalls:0` 대신 계획 호출과 최상위 실제 `providerCalls:0`을 구별한다. 출력2048·temperature0.2·thinking disabled·non-stream·JSON mode는 현재 `deepseekPayload` 그대로다. 실제 전송 직전 body와 준비 body가 완전히 같아야 한다.

원본은 `original-inputs.json`, 순서를 포함한 `{id,body}[]`는 `requests.json`이며 R4-A의 `SHA256(JSON.stringify(...))` 규칙을 유지한다. full-task의 정렬 body hash/`event-inputs.json` 규칙을 혼용하지 않는다. 준비는 현재 원본8개와 wire를 다시 생성하고 ID·순서·본문·원본/요청 hash·예산 계산·정해진 전체 source hash 목록을 비교한다. 파일에 제공된 hash만 서로 맞는 것으로는 수용하지 않는다. source 목록에 새 실행/평가 파일도 포함한다.

`deepseek.ts` 등 소스 변경으로 r1 준비는 새 실행에 사용할 수 없다. `outcome-isolation-offline-r1`과101/101 증거는 당시 기록으로 보존하고 새 `outcome-isolation-offline-r2`를 만든다. 요청 본문이 같으면 requestHash는 같을 수 있지만 source/artifact 검증은 별개다. 문서 변경만으로 요청 attempt를 새로 만들지 않는다.

### 전용 CLI·예산·중단 경계

새 실행기는 아래 세 모드만 허용한다. 인수 누락/중복/여분을 거부하고 모든 입력/출력 경로는 기존 별도 로컬 저장소 증거 루트 아래로 제한한다. 출력 폴더가 이미 있으면 쓰기 전에 중단한다.

- `--rehearse-outcome --prepared <offline-r2> --output <mock-r1>`: 합성 원장·가짜 응답만 사용. 성공 상태는 `OUTCOME_MOCK_PASS`, 의미 `NOT_RUN`.
- `--live-outcome-diagnostic --prepared <mock-r1> --output <live-r1> --approved-request-hash <hash> --allow-paid-providers --synthetic-inputs`: 일치하는 새 모의 준비와 고정8건만 허용. 위 검증과 승인 hash 검사를 모두 마친 뒤 키/실제 원장을 읽는다. 플래그 자체가 사람의 실행 승인을 대신하지 않는다.
- `--replay-outcome --recorded <live 또는 mock> --output <replay-r1>`: 키/원장/HTTP 없이 원본·wire·raw로 재검증. 모의 재생은 끝까지 모의로 표시한다.

실제 실행은 기존 `runtime-data/deepseek.env`의 유료 허용·키·예산 승인값을 확인하고 `DeepSeekBudget`을 재사용한다. 설정을 자동 승격하거나 원장을 초기화하지 않는다. 실행을 위해 설정을 임시 적용했다면 키를 출력하지 않고 원본 바이트를 보존·복원한다. 기존 `.o1-dev.lock`을 공유해 다른 O1 실행기와 동시 실행을 막고, per-call `.lock`/reserved/unknown 차단도 유지한다. 시도 식별자는 `taskKind + requestHash`를 기존 authorization suffix에 넣는다. 다른 출력 경로나 metadata 변경으로 같은 시도를 다시 호출할 수 없어야 한다.

유효한 의미 오답은 FAIL로 기록하고 다음 문항을 진행한다. HTTP/usage/model/finish/원문 잘림/decode/한도/timeout 오류는 이후 호출을 중단한다. 자동 재시도·정답 fixture와 live 응답의 동등성 강제·전체 해석 fallback·추가 감정/대사 생성은 없다. logical timeout 뒤 늦은 응답이 와도 STOPPED 결과를 성공으로 승격하지 않으며 미확인 예약을 임의 해제하지 않는다.

실행 결과는 전체8행을 유지하고 `attempted/received/decoded/rubricMatched/manualAccepted/notSent`를 구분한다. 미실행은 의미 오답으로 세지 않지만 성공 분모에서 빼지도 않는다. 예:3건 중3건 적합이면 '3/8 확인,5건 미실행'이고 진단 성공은 NOT VERIFIED다. 예산 예약만 발생하고 전송 확인이 안 된 경우도 별도 기록한다.

원문 JSONL은 caseId·content·SHA256·반환 model/finish/truncated를 보존하며 headers·키·reasoning·공급자 오류 본문은 기록하지 않는다. `calls.jsonl`, `results.jsonl`, 최종 manifest에 중단 원인·미실행 문항·자동 판정을 남긴다. replay는 준비/원본/wire/source hash와 raw hash, ID 중복/알 수 없는 ID/순서를 검사하고 같은 decoder/고정 비교 결과를 재현한다. raw가 없는 미실행은 재생 불가, 계약에 맞는 늦은 raw도 운송/usage 실패를 통과로 바꾸지 않는다. old full raw는 기존 codec으로만 검증한다. 재생으로 원본 실행 기록을 덮어쓰지 않는다.

### 비용·실행 승인 범위

2026-10-17 이번 계획에서 실제 DeepSeek 원장의 합계만 읽었다. 총 **USD0.20**, 누적 **28회**, 사용량 기반 보수 차감 **0.0477531**, 잔여 **0.1522469**, 미해결0·두 lock 없음이다. 누적36회는 기존 승인 기록이며 실제 설정은 실행 직전에 확인한다. 설정 한도가 승인한0.20/36보다 크면 실행을 거부하고, 더 낮아8건을 실행할 수 없는 경우에도 자동 증액하지 않는다. 키 파일은 읽지 않았고 원장은 수정하지 않았다.

현재 r1 body8건의 보수 예약 계산은 **USD0.0307278**이다. 현재 차감과 합치면 **0.0784809**, 호출은 누적36회로 기존 상한 안이다. 이는 청구액 예상이 아니며 B1 최종 body로 다시 계산해야 한다. [공식 가격표](https://api-docs.deepseek.com/quick_start/pricing/)를 이번에 확인했고 peak/cache-miss 입력0.30·출력1.20달러/백만 토큰은 현재 코드와 같다. 실행 직전 모델·요금·잔여·미해결을 재확인하고 다르면 자동 변경 없이 멈춘다.

현재 승인은 계획 준비까지다. B1 구현·모의·감사로 구체 요청/hash/상한을 완성한 뒤 B2 실제8건 범위를 확인한다. 같은 총상한을 다시 늘릴 필요는 없으며, 원장에 남은 호출 몫이나 새로운 requestHash만으로 과금 실행을 시작하지 않는다. OpenAI는 호출하지 않는다.

### 성공 기준과 검증 경로

| ID | 관측 조건 | 소유자·검증 | 현재 |
|---|---|---|---|
| OB01 | 새 클래스가 준비 body/예약과 동일하게1회 전송하고 non-null/null을 사실 전용 결과로 반환. 입력 오류 예약0, 출력 오류 원문 보존·다음 호출0, caller 변경에도 snapshot 유지 | deepseek.ts / deepseek.test.ts, 기존 공급자 회귀 포함 | NOT VERIFIED |
| OB02 | 모의/실제/재생의 task/version/8개 ID/순서/원본/wire/전체 source/hash를 검증. 승인 누락·오래된 준비·각 파일 훼손은 secret/ledger/HTTP 전에 거부. 기존 offline/full live 차단 유지 | probe/run 및 두 eval 테스트 | NOT VERIFIED |
| OB03 | 같은 task+request의 재실행·공유 lock·부족 예산/횟수·unknown 차단. HTTP/usage/JSON/참조/model/finish/timeout 뒤 추가 호출0, 과거 항목 보존. 유효 의미 FAIL은 나머지 문항 진행 | run.test.ts 합성 원장/가짜 HTTP, deepseek.test.ts 관련 기존 경계 | NOT VERIFIED |
| OB04 | 새 비교기에서 옛 outcome 판정5적합/3FAIL이 그대로 재현. 신규 정상/오답/null/부분 결과를 구분하고 계획 분모8 유지. 감정/core 판정을 만들지 않음 | checkOutcomeProbeCandidate/compareOutcomeProbeDiagnostic 테스트 | NOT VERIFIED |
| OB05 | 모의8건 raw/결과 replay 일치, 변조/중복/잘림/누락·STOPPED/late raw 승격 차단. 모의·재생 호출0 및 비밀 접근0 | run.test.ts 및 신규 mock/replay artifact | NOT VERIFIED |
| OB06 | 실제 계약8/8·고정 outcome8/8·원문 검토8/8. D02/D09/P02 개선과 이전5 유지. D12 감정 실패와 역사 전체4/8 보존 | B2 actual/replay/semantic-review, 의미 효과의 일반화·인과성은 미검증 | NOT VERIFIED |
| OB07 | 실제 최대8·총0.20/누적36 내, 과거 원장 불변·새 미해결0·설정 복원·중복 호출0. 오류 때 보존 후 중단 | B2 전후 요약·실행 manifest·복원 검사 | NOT VERIFIED |

검증 명령은 **미실행 계획**이다. cwd 저장소 루트, TEMP/TMP는 `${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/tmp`. 별도 로컬 저장소 쓰기 권한은 실행 도구로 승인받고 우회하지 않는다.

```powershell
node node_modules/vitest/vitest.mjs run --no-cache packages/adapters/src/deepseek.test.ts packages/adapters/src/outcome-probe.test.ts
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts --no-cache evals/affect-outcome-probe.test.ts evals/affect-outcome-run.test.ts evals/affect-reference-artifacts.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
node --experimental-transform-types evals/affect-outcome-probe.ts --prepare-outcome-probe --output ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/outcome-isolation-offline-r2
node --experimental-transform-types evals/affect-outcome-run.ts --rehearse-outcome --prepared ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/outcome-isolation-offline-r2 --output ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/outcome-isolation-mock-r1
node --experimental-transform-types evals/affect-outcome-run.ts --replay-outcome --recorded ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/outcome-isolation-mock-r1 --output ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/outcome-isolation-mock-replay-r1
```

감사 초점은 전송 재사용이 기존 공급자/예산 동작을 바꾸는지, 새 metadata가 기존 attempt를 우회하는지, 의미 FAIL과 기술 중단·미실행이 뒤섞이는지, replay가 실패한 실행을 성공으로 바꾸는지다. 프롬프트 수정이나 같은 실제 문항 재호출을 감사 수단으로 삼지 않는다. 같은 문제 수정/감사3회 뒤에는 미해결을 기록하고 루프를 멈춘다.

**다음 BUILD 지시:** R4-B1의 위6파일과 직접 상태 문서만 구현하고 OB01–05·타입·모의/replay·새 요청 hash/예약액까지 검증한다. B2 실제 호출과 감정/Stage 연결은 실행하지 않는다. 준비를 끝낸 후 감사로 넘긴다.

## R4-A BUILD 인계 — 2026-10-17

이 절은 구현 종료 당시 기록이다. 이후 대화 감사의 PASS와 현재 다음 단계는 위 R4-B 계획을 따른다.

main HEAD `fc883fa`와 기존 미커밋 작업을 보존하고 계획의 신규6파일을 작성했다.

- `packages/adapters/src/outcome-probe.ts`: 순수 `prepareOutcomeProbe`와 별도 `OutcomeProbeResult`. persona/goal을 제외한 후보 codec 및 명시한 wire view, outcome-only schema, exact decode 후 원본 전체 validator를 재사용한다. 원본 공개 복사본을 바꿔도 내부 snapshot은 유지한다. 로컬 검증용 uncertain/빈 appraisal은 외부 결과에 포함하지 않는다.
- `packages/adapters/src/outcome-probe.test.ts`: 입력/출력 분리·작성24·잘못된 참조·revision/인용·상태 전용 근거·관측 전 결과·snapshot·기계 검증의 의미 한계를 검사한다.
- `evals/fixtures/affect-outcome-isolation-regression-v1.json`: R3-B 실제8건의 원본 요청·응답 문자열·SHA256·당시 checks를 그대로 동결했다.
- `evals/fixtures/affect-outcome-isolation-v1.json`: 대상/정정/시간/결과/외부 원인/발화 양태6묶음×4장면이다. 영화만 반복하지 않고 경로·음식·작업을 포함한다. 작성 자료이며 모델 응답이 아니다.
- `evals/affect-outcome-probe.ts`: offline CLI와 authored materialization/roundtrip 도구다. provider 인스턴스·HTTP·키·실제 원장을 사용하지 않고 고정 diagnostic8의 원본/전송 자료와 authored 결과를 별도 저장한다.
- `evals/affect-outcome-probe.test.ts`: 실제8건의 예전 full codec/고정 판정, offline 자료·hash·API 차단·기존 live 소비자 거부를 검증한다.

계획 밖 제품 파일 변경이나 새 provider/port 추가는 없다. 기존 codec·full interpreter·공급자·Core·도메인·평가기·원래 fixture·운영/DB는 변경하지 않았다. 이번 구현으로 과거 실제 실패를 보정하지 않는다.

| 기준 | 판정 | 증거·한계 |
|---|---|---|
| OP01 | PASS (로컬) | 모델 view의 persona/goal 및 감정/상태 필드 제외·원본 값 보존·기존 builder 두 형식 불변. 기존 codec의 고정 UUID hash 검사 포함 |
| OP02 | PASS (로컬) | 작성24·null/4종 use/미관측 pending·unknown 정상 왕복. 여분 필드·필수 outcome 누락·잘못된 별칭/인용/revision·직접 UUID·숨긴 episode 거부 |
| OP03 | PASS (로컬) | 역순 완료·caller/공개 원본 변경에도 private snapshot 유지. state-only 인용 거부 및 원본 상태·중복 revision 보존 |
| OP04 | PASS (로컬) | 실제8건 원문 hash·요청·당시 checks 일치. 기존 전체4FAIL(D02/D09/D12/P02)·outcome3FAIL(D02/D09/P02) 그대로 재현 |
| OP05 | PASS (작성 계약 대조) | authored24의6묶음/4종 use/복합·결과 대기·이력·모호한 검색 표현. 자기모순 없는 틀린 사용 판단이 여전히 수용되는 한계도 별도 검사 |
| OP06 | PASS (로컬) | CLI 실제/paid 플래그·C: 산출물 거부, secret/network spy 접근0. 원본/wire/source hash 기록. 기존 OpenAI/DeepSeek 두 live 경로가 새 manifest를 secret 전에 거부 |

검증 위치는 저장소 루트, TEMP/TMP와 산출물은 기존 별도 로컬 저장소 증거 루트다. 새 기능으로서 의미 있는 경계/회귀 검사를 실행했으며 기존 결함을 고쳤다는 red/green 주장은 하지 않는다.

| 실제 실행 | 결과·증거 |
|---|---|
| probe + 기존 codec 단위 | `outcome-isolation-unit-r1.json`: **78/78**(신규55+기존23), 실패/skip0 |
| probe 평가 + 기존 boundary/diagnostic | `outcome-isolation-eval-r1.json`: **23/23**(신규12+기존5+6), 실패/skip0 |
| TypeScript / diff | `tsc --noEmit -p tsconfig.json`, diff check PASS |
| 오프라인 CLI | `outcome-isolation-offline-r1`: `OUTCOME_OFFLINE_PREPARED`, diagnostic8·authored24 검사, API/추론0, 의미 `NOT_RUN` |

합계 **101/101**은 위 두 실행의 서로 다른 검사이며 이전164/30과 중복 합산하지 않는다. 새 준비의 taskKind는 `outcome-only-diagnostic-v1`, prompt는 `outcome-probe-v1`다. 원본 hash `ba350b402d8afa8d32948cbd9bc2941384f6827435ccce9adb8f41fdbeff575b`, 요청 hash `ec8dc80773eed4d7aff64a02bef3b928e44eb4e3f9acb66d582a7f1dda19736d`, 관련 소스 hash15개를 기록했다. 출력 예산2048과 기존 peak/cache-miss 계산식을 적용한8건의 보수 예약 계산은 **USD0.0307278**이며 청구/예약 실행/새 호출 승인이 아니다. 원장/키는 읽거나 수정하지 않았다.

다음은 **R4-A AUDIT**다. 작성 계약 통과는 DeepSeek의 사실 정확도나 감정-사실 과제 간섭의 인과 효과를 증명하지 않는다. 실제 전송 경로·R4-B 유료 비교·실제 두 단계 구조·O1/Stage는 미구현/미검증으로 유지한다. OpenAI 소진을 전제로 DeepSeek 연결을 유지하며 다른 공급자를 추가하지 않았다.

## R4 — DeepSeek 요청 구조의 오프라인 검토와 다음 구현 계획

아래는 R4-A 착수 전에 확정한 계획이다. 미구현/NOT VERIFIED는 당시 상태이며 현재 OP01–06의 로컬 결과·한계는 위 BUILD 인계를 따른다.

### 수정 이유·확인한 사실

사용자는 API 대안으로 OpenAI와 DeepSeek를 준비했으며 OpenAI 크레딧을 모두 썼다고 다시 명시했다. 이전의 '다른 가용 공급자 비교가 다음'이라는 결론은 현재 조건에 맞지 않아 **현재 실행 경로에서 철회**한다. DeepSeek 연결과 원장을 유지하고 새 공급자·추가 결제·설치 모델 다운로드를 전제하지 않는다. 이번 승인은 기존 오답의 오프라인 분석과 개선안 준비이며 추가 추론/API 호출을 하지 않았다.

현재 `event-interpreter.ts`에는 이미 행위자/대상·부정/정정 확인과 outcome/appraisal 독립 지시가 있다. 따라서 지시가 누락돼서 실패했다고 설명하거나 같은 문구를 더하는 것으로 구조 문제가 해결됐다고 할 수 없다. R3-B 원문 SHA256 8개와 관련 소스 hash21개를 읽기 전용으로 재확인했다. 두 하위 검토자의 같은 맥락 검토도 원문과 직접 대조했으며 외부 독립 평가로 표현하지 않는다.

| 관측 | 근거와 현재 결론 |
|---|---|
| D02/P02 | 미사용·정정 뒤 자기 episode를 used/unfavorable로 오귀속. P02는 보고되지 않은 불만족 결과도 생성. 기계 계약을 통과한 의미 오류다. |
| D09 | 미사용을 used/pending으로 읽었으나 episode 감정은 없음. 사실 오류와 결과 감정 오류를 구분해야 한다. |
| D12 | hypothetical/pending과 episode 무감정은 맞다. 현재 질문의 긍정 평가가 고정 극성 기준에 실패한 것이므로 사실 추출 실패로 묶지 않는다. |
| 전체/부분 기준 | 기존 고정 전체 기준은4/8, **outcome 범위만은5/8**이다. 기존 실패나 평가기를 바꾸지 않고 두 지표를 따로 기록한다. |
| 원인 가설 | 감정/성향 과제가 사실 판정과 간섭했을 수 있으나 아직 인과 증거는 없다. 모델의 한국어 부정·대상 연결 능력이나 요청 길이도 분리 검증되지 않았다. |

현재 validator는 정확한 인용·권한·출력 간 관계를 검사하며 인용의 자연어 의미를 판정하는 시스템은 아니다. 이번 원문에서 공통 구현 결함은 새로 확인하지 못했다. 제품의 감정 다양성이나 헥사고날 경계를 포기할 근거도 없다.

### 선택: 완성형 2단계 구조 대신 사실 전용 진단부터

다음 후보는 **한 번의 요청에서 자기 episode의 사용 여부/관측 결과만 해석하는 실험**이다. 모델에 성향·목표·감정 상태와 appraisal 생성을 함께 주지 않는다. 이 후보의 출력은 감정 시스템의 최종 응답이 아니며 운영 `EventInterpreter`에 연결하지 않는다. 이름만 `facts`로 바꾸고 기존 전체 과제를 그대로 묻는 후보도 만들지 않는다.

단일 호출의 관측 목록+감정 출력이나 사실→감정의 실제 두 호출 연결은 이후 선택지로 남긴다. 현재는 추가 관측 엔티티·인용 연결 규칙·두 번째 호출의 비용/지연/오류 전파까지 구현할 근거가 부족하다. 사실 전용 과제에서도 같은 오답이 나오면 '감정과 분리하면 해결된다'는 가설을 지지하지 못한 것으로 기록할 수 있어야 한다. 사실 전용 성공도 두 호출 구조나 의미 품질 전체의 성공은 아니다.

### R4-A 후보 계약 — SDK/운영 포트 변경 없음

소유자는 새 실험용 `packages/adapters/src/outcome-probe.ts`다. 기존 `EventInterpretationRequest`를 받는 순수 `prepareOutcomeProbe(input)`가 직렬화 가능한 `{messages,schema,promptVersion}`와 호출별 `decode`를 돌려준다. 네트워크·키·원장은 이 모듈의 소유가 아니다. 공통 포트·Core·DB entity나 기존 builder 기본값을 바꾸지 않는다.

1. 원본 요청을 `validateAffectRequest`로 snapshot 고정한다. 원본 전체는 검증·출처 의존성·평가 artifact의 기준이다.
2. 별도 후보 snapshot에서 persona/goal sources만 제외한 뒤 기존 `createEventReferenceCodec`을 재사용한다. `eligibleAffectEpisodes`의 후보 필터·정확한 별칭 복원·인용 검증을 유지한다. 원본 자료나 hidden episode를 지우거나 축약해 저장하지 않는다.
3. 실제 모델 view는 `scope,eventId,eventRevision,eventKind,now,speakerId,actors,experience,sources`만 명시 선택한다. sources에는 current input과 제공된 input/episode/claim/response/expectation 자료가 남으며 persona/goal은 없다. `configVersion,currentAffect,stateSourceRefs`는 wire에서 제외하지만 원본 검증 snapshot에는 보존한다. 0 감정이나 빈 상태 근거를 실제 값처럼 만들어 보내지 않는다.
4. 응답은 strict 필수 필드 **`{outcome: 기존 outcome 또는 null}`** 하나다. 사용/결과 enum·필수 인용·revision·episode 후보 권한은 기존 계약과 같다. 사용하지 않은 결과의 favorable/unfavorable 생성이나 모호한 검색의 episode 확정은 기존 validator가 계속 거부한다. host가 '안 봤어' 같은 문자열을 규칙으로 읽어 enum을 바꾸지 않는다.
5. wire schema는 codec의 outcome schema를 구조적으로 재사용하고 root는 required outcome/additionalProperties=false로 제한한다. 현재 schema는 별도 `$ref`가 없는 것을 확인했다. 구현 시 이를 검사하고 나중에 분리 불가능한 schema가 생기면 명시 실패한다. JSON 전체 문자열 치환이나 모르는 schema를 자르며 수용하는 방식은 사용하지 않는다.
6. decode는 필수 outcome/추가 필드 거부 뒤 codec에 로컬 검증용 `{status:'uncertain',outcome,appraisals:[]}`를 전달해 정확히 복원하고, **원본 전체 snapshot의 `validateEventInterpretation`도 재적용**한다. 여기의 uncertain은 기존 계약에서 appraisal 상태이며 사실의 확신 점수로 해석하지 않는다. 검증용 빈 appraisals를 모델의 감정 무변화 결과처럼 저장하거나 Core에 전달하지 않는다.
7. 반환형은 어댑터 내부 outcome probe 결과이고 기존 `EventInterpretationResult`로 위장하지 않는다. caller/eval이 사실 전용 결과임을 식별할 수 있어야 한다. 잘못된 인용/별칭/내부 조합은 전체 실패이며 원문 수정·부분 수용·기존 전체 모델 응답으로 fallback하지 않는다.

전송 task/prompt는 `outcome-probe-v1`, wire metadata는 `taskKind: outcome-only-diagnostic-v1`, `wireFormat: refs-v1`, 기존 codec 버전을 기록한다. 새 후보 hash는 구현 뒤 계산하며 R3-B hash로 덮어쓰지 않는다. 별칭은 요청별 snapshot에 묶인다. host가 수용한 결과도 모델의 해석이지 검증된 사실이 아니다. 같은 잘못된 의미가 자기모순 없이 출력되면 계속 기계 검증을 통과할 수 있다.

### 로컬 평가 자료와 보존 범위

R3-B 실제8건을 새로운 고정 regression fixture에 **원본 요청·wire 응답 문자열·SHA256·당시 전체/부분 checks 그대로** 보존한다. 옛 응답은 옛 full refs codec으로 읽으며 persona를 뺀 새 별칭 테이블로 해석하지 않는다. 새 후보로 과거 응답을 '수정 재생'해 개선 결과로 기록하지 않는다. 기존 전체4FAIL과 outcome3FAIL을 동일하게 재현해야 한다.

새 authored 대조는24장면(6묶음×4)으로 만든다. 이는 모델 응답이 아니라 계약과 자료 표현의 검증이며 아래 조합의 정답을 실제 호출 전에 고정하기 위한 자료다.

| 묶음 | 교차할 반례 |
|---|---|
| 대상/행위자 | 같은 물건·다른 추천자, 다른 물건·같은 추천자, 자기 사용/타인 사용. 영화 외 경로·음식·작업 예시 포함 |
| 정정 방향 | 사용→미사용, 미사용→사용, 결과 없는 정정, 정정과 무관한 타인 결과 공존 |
| 시간 | 과거 미사용 뒤 현재 사용, 과거 사용을 현재 부정한 경우, 최근 발언의 현재 적용 범위와 이력 인용 구별 |
| 결과 유무 | 시작했지만 평가 전, 완료했지만 평가 없음, 명시적 좋은 결과, 명시적 나쁜/복합 결과 |
| 외부 원인 | 추천대로 했지만 공사/지연 개입, 추천을 쓰지 않고 다른 선택의 실패, 원인이 불명확해도 실제 사용 사실은 별개 |
| 발화 양태 | 실제 보고, 가정, 인용된 타인 보고, 현재 화자의 확인/질문을 구별 |

성향 때문에 사건별 고정 감정 수치를 넣거나 특정 부정어·문항 ID에 분기하지 않는다. 후속 감정 연결 때 **미사용/가정의 자기 결과 감정은 제한해도 현재 대화의 걱정·기대·공감은 보존**해야 한다. 예를 들어 가정 중에도 “대안을 준비해 줘서 안심돼”라는 실제 현재 근거가 있으면 긍정을 일괄 금지하지 않는다. D12의 기존 극성 FAIL은 유지하되 모든 가정 질문을 무감정으로 만드는 규칙을 도입하지 않는다.

### 목표 단위와 파일

| 목표 | 대상 파일·심볼 | 마감선 |
|---|---|---|
| **R4-A: 다음 한 번의 BUILD** | 신규 `packages/adapters/src/outcome-probe.ts`의 prepare/decode, `outcome-probe.test.ts` | 원본/후보 view 분리·기존 codec 재사용·strict outcome-only·snapshot·권한 경계까지. 실제 provider 클래스/운영 연결은 만들지 않음 |
| R4-A | 신규 `evals/fixtures/affect-outcome-isolation-regression-v1.json`, `affect-outcome-isolation-v1.json` | 실제8건 원문/기존 FAIL 보존 + authored24. 예상 답은 model request에 넣지 않음 |
| R4-A | 신규 `evals/affect-outcome-probe.ts`의 offline prepare CLI, `affect-outcome-probe.test.ts` | 고정 diagnostic8의 전송 준비·작성 대조 decode를 offline으로 검사. HTTP/secret/실제 원장0 |
| **R4-B: 조건부 후속** | R4-A 검토 뒤 별도 실제 전송/예산 계획 | DeepSeek 사실 전용 과제가 실제로 나아지는지 관측. 이번에는 구현·호출하지 않음. 기존8건은 익숙한 개발 자료여서 일반화 검증 아님 |
| **R4-C: 결과에 따른 결정** | 사실 전용 결과와 비용/지연을 보고 별도 계획 | 성공하면 관측→감정 연결 후보를 비교하고 실패하면 이 가설을 지지하지 못한 것으로 기록. 두 호출 구조를 자동 채택하지 않음 |

R4-A는 새6파일과 직접 상태 문서만 소유한다. 기존 `event-interpreter.ts`/codec/DeepSeek provider/평가기/fixture/공통 포트/Core/DB/Coordinator는 변경하지 않는다. 재사용이 불가능한 구체적 이유가 나오면 최소 조정 근거를 기록하고 요구를 낮춰 맞추지 않는다.

### 성공 기준 — 새 후보 전부 NOT VERIFIED

| ID | 관측할 조건 | 증거/주 검사 |
|---|---|---|
| OP01 | 기존 UUID/refs builder와 prompt/hash 불변. 새 후보는 모델 view에서 persona/goal/currentAffect/stateSourceRefs를 제외하고 원본 snapshot을 보존 | probe 단위·원본 객체 불변·wire 캡처 |
| OP02 | 필수 outcome-only 정상/null·used/not_used/hypothetical/unknown·pending/unknown 경로를 기존 권한 내에서 왕복. appraisals/여분 필드/누락 outcome/없는 인용·revision·직접 UUID/숨긴 episode 거부 | authored 단위 반례·기존 validator 대조 |
| OP03 | 두 요청 역순 완료·원본 후속 변경에도 각 snapshot으로 복원. state-only 근거는 인용 권한이 없고 원본 전체 저장은 유지 | snapshot/원본 artifact 검사 |
| OP04 | 실제8건 원문 hash와 기존 전체4FAIL/outcome3FAIL 유지. 새 probe를 옛 raw에 적용해 개선으로 표시하지 않음 | regression fixture 재검증 |
| OP05 | authored24가 계약/출처/결과 미관측 경계를 표현하고 불가능한 조합을 거부. 의미 오답이 일관되면 host만으로 거부할 수 없다는 대조도 포함 | authored fixture 검사. 모델 정확도 증거 아님 |
| OP06 | 새 offline CLI는 실제/paid 플래그를 거부하고 key/ledger/fetch 접근0. artifact는 전용 taskKind·원본/wire/source hash·NOT_RUN 의미 상태를 기록. 기존 실제 CLI가 새 manifest를 secret 전에 거부 | child-process secret/network guard·후보 manifest 잘못된 소비 검사 |

평가 artifact는 새 `${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/outcome-isolation-offline-r1/`에만 기록하고 이미 있으면 중단한다. 원본 UUID 입력과 wire를 분리해 보존한다. R3의 event-inputs/replay 형식에 조용히 끼워 넣지 않는다. **offline PASS로 DeepSeek 의미 품질·D12 감정 문제·O1/Stage 완료를 주장하지 않는다.**

구현 후 예정 명령(cwd 저장소 루트, TEMP/TMP는 기존 별도 로컬 저장소 tmp, 이번 계획에서 미실행):

```powershell
node node_modules/vitest/vitest.mjs run --no-cache packages/adapters/src/outcome-probe.test.ts packages/adapters/src/event-reference-codec.test.ts
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts --no-cache evals/affect-outcome-probe.test.ts evals/affect-boundary.test.ts evals/affect-diagnostic.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
node --experimental-transform-types evals/affect-outcome-probe.ts --prepare-outcome-probe --output ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/outcome-isolation-offline-r1
```

### 인계와 중단선

이번 오프라인 검토는 문서만 수정했고 실제 원문8/소스21 hash와 기존 결과의 outcome5/8·전체4/8 구분을 확인했다. 새 후보 코드는 작성하지 않았으며 API/로컬 모델 추론/키·원장 접근0이다. 직전 누적28회/보수0.0477531·미해결0은 **R3-B 실행 당시 기록**으로 유지한다. 이번에 새로 원장을 조회했다고 쓰지 않는다.

**다음 BUILD는 R4-A만** 진행해 OP01–06을 검증하고 후보의 준비/표현/검사 타당성에서 멈춘다. 더 좋은 의미 판단이나 사실→감정 분리의 인과 효과는 NOT VERIFIED로 남긴다. 이 단계에서 새로운 공급자나 과금 실행·실제 두 호출 파이프라인·기준 완화는 진행하지 않는다. 같은 문제 수정/검토3회 경계와 과거 실패 기록은 유지한다.

## R3-B 실행·검수 인계 — 2026-10-17

R3-A 감사에서 RS01–03 로컬/모의 PASS·필수 수정 없음을 확인했다. 기존30/30 기록과 준비의 소스 hash21개가 현재와 일치했다. 같은 대화 맥락의 계약/CLI 및 수명/비용 경계 검토이며 실제 품질 평가와 구분한다. 이후 사용자가 실제8건·예약상한0.0484908·기존 총0.20/누적36 실행에 `ㄱ`으로 승인해 R3-B를 실행했다.

| 기준 | 결과 | 증거·한계 |
|---|---|---|
| RS01–03 | PASS (R3-A 감사) | 현재 소스/검사/준비 일치. 기존30/30을 재확인했고 전체 suite를 새로 실행한 것은 아님 |
| RS04 | PASS (실제8/8) | 별칭 원문을 보정 없이 복원해 원본 UUID validator 수용. 원본/source/wire 검증 및 replay8/8 결과 일치 |
| RS05 | FAIL | D01/D06/D10/P01은 고정 기준과 핵심 의미 관측 적합. D02/D09/P02는 사용/정정 의미 오류, D12는 현재 입력의 양극성 고정 기준 실패. 원문·FAIL 유지 |
| RS06 | PASS | 실제8회·재시도0, 총0.20/누적36 안. 과거20항목 불변, 미해결0·키 설정 바이트 복원·두 lock 없음 |

이번 usage 기반 보수 차감0.0108264달러, 누적28회/0.0477531달러·잔여0.1522469다. 청구서 확인값이 아니며 별칭 후보의 예약상한0.0484908과 구분한다. 실행 증거는 `refs-deepseek-live-r1`, 재검증은 `refs-deepseek-live-replay-r1`이다. source/hash·문항·기대값·코드·운영 provider 변경0, 실제 OpenAI/추천/확인/전이/Stage0이다.

참조 형식이 맞아도 의미 오류는 남는다. 특히 D02/P02를 오프라인 Core에 적용하면 잘못 연결한 자기 episode의 부정 감정이 생기므로 단순한 무영향 metadata 문제로 축소하지 않는다. D12는 hypothetical 구분 자체는 맞았으며 실제 실패 경험 오기록으로 확대하지 않는다. 구현 경계와 해당 공급자의 판단 품질을 구분하며 제품 한계로 일반화하지 않는다.

R3-B 종료 당시에는 다른 가용 판단 공급자의 비교를 제안했으나, 사용자의 OpenAI 소진 재확인에 따라 현재 후속은 위 **R4-A 오프라인 사실 전용 진단**으로 수정했다. R3-B 원문·FAIL·O1 PARTIAL·O2/Stage 미연결은 유지한다.

## R3-A BUILD 인계 — 2026-10-17

main HEAD `fc883fa`와 기존 미커밋 작업을 보존하면서 계획의 두 구현 파일만 수정했다. `evals/affect-deepseek.ts`에 `--live-reference-diagnostic`를 추가해 refs·명시 승인 hash·paid/synthetic 플래그·고정 진단8·원본/전송/준비 metadata를 실제 키/원장 읽기 전에 확인한다. 기존 UUID live와 OpenAI의 refs 차단, requestHash 기반 attempt identity는 유지했다. 저장 요청의 순서도 재생성 결과와 같아야 한다. 모의 authored 응답 일치 검사는 offline에서만 수행하므로 실제 경로는 다른 유효한 모델 응답을 수용하고 고정 rubric FAIL을 별도 기록한다.

`evals/affect-reference-artifacts.test.ts`는 가상 키 설정·합성 원장·가짜 HTTP를 주입해 실제 CLI 분기를 실행한다. 잘못된 승인7종/준비자료7종, 정상8건, 중복 차단, malformed/HTTP/usage 오류 후 추가 호출0, 원장 과거 항목·unknown 예약 보존, replay 일치를 검사했다. 공급자·codec·Core·도메인 계약·DB·기대값은 변경하지 않았다. 다른 유효 응답을 사용한 모의는 의미 품질 증거가 아니다.

| 기준 | 결과 | 실제 증거 |
|---|---|---|
| RS01 | PASS (로컬) | 기존 차단 회귀 + 새 모드 승인 hash/format/paid/synthetic 누락·불일치 거부. 잘못된 준비에서 secret/HTTP 접근 없음 |
| RS02 | PASS (로컬) | UUID 기존 attempt 회귀, refs 신규8 뒤 동일 attempt 거부·과거 항목 보존. source/scope/count/original/wire/request ID 누락·변조 차단, 새 준비 hash 일치 |
| RS03 | PASS (모의) | 비fixture 유효 응답8건 수용·rubric FAIL도 별도 기록하고 계속. 둘째 응답의 참조/HTTP/usage 오류 때 총2회에서 중단, HTTP/usage unknown 예약 보존·lock 정리 |
| RS04–06 | NOT VERIFIED (실제) | 실제 API·키/실제 원장 접근0. 실제 모델 참조/의미와 실행 정산은 R3-B에서 확인 |

증거 루트 `${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/`:

- `refs-live-red-r1.json`: 구현 전 artifact20PASS/4FAIL. 새 실행 모드 부재로 정상 실행 및3개 중단 검사가 실패했다.
- `refs-live-final-r1.json`: artifact24 + diagnostic6 = **30/30 PASS**, skipped0. 이전164건과 중복 합산하지 않는다. 타입 검사·diff 검사 PASS.
- `refs-deepseek-prepare-live-r1`: 최신 소스의 offline8, 실제0, `MOCK_PASS`. 요청 hash `952a8661bc547c89cc2fee408e0ae64e0ee7964ad6c22927adb1b3b443776545`, 입력 hash `4c68a4337424808b737c54778b576adb1e37ac5bd41a01d727091b619a76e683`, 예약 **USD0.0484908**으로 계획과 같다.

테스트의 live 분기 manifest에 나타나는 `realProviderCalls`는 **주입한 가짜 HTTP 횟수**다. 실제 외부 호출은0이며 유료 검증 결과로 사용하지 않는다. 테스트 임시 원장은 별도 로컬 저장소 tmp에 만들고 해당 테스트 폴더만 정리했다. 실제 키·원장·설정·운영 provider는 건드리지 않았다. R2의 codec/provider 증거는 소스가 그대로지만 이전 준비 manifest의 runner 소스 hash는 달라졌으므로 실제 실행에는 새 준비만 사용한다.

다음은 **R3-A AUDIT**다. 통과 뒤 R3-B 고정8건의 실제 실행 범위를 확인한다. 기존0.20/누적36 상한 증액은 필요 없으며, 실제 실행 직전 원장과 설정을 다시 확인한다. 이번 BUILD를 실제8건 승인이나 별칭 의미 품질 PASS로 해석하지 않는다.

## R2 감사 인계 — 2026-10-17

현재 main HEAD `fc883fa`와 미커밋 R2 파일을 대상으로 계약/codec, 공급자, artifact/replay 경계를 병렬 검토했다. 같은 대화 맥락의 검토이며 외부 독립 평가가 아니다. **RC01–08은 로컬/모의 범위 PASS, 필수 수정 사항 없음**이다. 기존164/164 기록과 두 공급자 준비의 소스 hash 일치를 확인했으며 suite 전체를 재실행한 것은 아니다. 메모리 내40개 경계 조합, 모의 결과8건씩의 원본 UUID 일치, refs replay8건 및 legacy 실제4건의 결과 보존을 추가 확인했다. 감사의 파일 쓰기·API 호출0이며 기록은 이번 후속 계획 작성에서 반영했다.

실제 OpenAI schema 수용과 두 공급자의 의미 품질은 미검증이다. R2를 다시 수정할 근거는 없으므로 구조 감사 반복 대신 아래 좁힌 실제 진단을 준비한다. DeepSeek 후보 실패와 모델 독립적인 런타임 결함을 구분한다.

## R3 — 별칭 후보의 실제 진단 계획

아래는 R3-A 착수 전 확정한 계획이다. R3-A 구현·감사 및 R3-B 승인·실행 결과는 위 인계가 소유한다. 아래 미구현/미승인/미실행은 계획 당시 상태다.

### 범위와 사전 고정

목표는 짧은 참조 후보가 실제 DeepSeek 응답에서 정확히 복원되는지, 사용/미사용·복합 감정·정정의 의미 판단이 유지되는지 관찰하는 것이다. 기존 UUID의 실제4건과는 **역사적 관측 비교**만 한다. UUID를 새로 호출하지 않으며 통제된 A/B 실험이나 오류율 개선 입증으로 표현하지 않는다. refs는 참조 표기뿐 아니라 필드별 enum도 다르므로 결과 변화를 글자 수 감소만의 효과로 단정하지 않는다.

- 후보: `deepseek-flash`, Chat Completions, 기존 non-thinking/JSON mode/temperature .2, 출력2048. 실제로 전송되는 설정과 반환 model을 기록하고 공급자가 temperature를 보장한다고 가정하지 않는다.
- 형식: `refs-v1`, prompt `event-interpretation-v3-refs1`, codec `event-refs-v1`, 평가 `affect-evaluation-v3`.
- 입력/순서: 기존 `affect-diagnostic-v1`의 **D01, D02, D06, D09, D10, D12, P01, P02**. 문장·기대값·평가기·프롬프트는 이번 단계에서 바꾸지 않는다.
- 요청 hash: `952a8661bc547c89cc2fee408e0ae64e0ee7964ad6c22927adb1b3b443776545`. 원본 입력 hash: `4c68a4337424808b737c54778b576adb1e37ac5bd41a01d727091b619a76e683`.
- 최대 생성8회, 계수/추천 생성/확인/전이/OpenAI/Stage/운영 승격0회. 자동 재시도와 남은 문항 자동 재개 없음. 합성 자료만 사용한다.

### 비용과 실행 경계

2026-10-17 이번 계획에서 `${ARTIFACT_ROOT}/deepseek-o1/budget.json`의 합계만 읽어 확인했다. 총상한 **USD0.20**, 누적20회, usage 기반 보수 차감 **0.0369267**, 미해결0이다. 누적36회는 기존 승인 기록의 한도이며 원장의 저장 필드가 아니다. 실행 직전 기존 설정과 다시 대조한다. 키 파일은 이번에 읽지 않았다.

기존 refs 모의 준비8건의 예약 합계는 **USD0.0484908**, 기존 차감과 합쳐 **0.0854175**, 모두 실행해도 누적28회다. 현재 예산·횟수 한도 안이므로 증액을 제안하지 않는다. 금액은 청구액 예측이 아니다. [공식 가격표](https://api-docs.deepseek.com/quick_start/pricing/)의 peak/cache-miss 입력0.30·출력1.20달러/백만 토큰을 검색 결과로 재확인했다(직접 페이지 열기는 timeout). 실제 실행 직전 요금·모델·잔여 예약을 재확인하고 변경되면 자동 증액 없이 멈춘다.

**현재 진행 허가는 이 계획 준비까지다.** R3-A 구현·모의 준비를 먼저 완료해 리뷰 가능한 요청/hash/예약을 만든다. 그 뒤 R3-B의 동일8건 실제 호출 범위를 한 번 확인한다. 기존0.20/36 한도를 유지하므로 상한 재승인은 요구하지 않는다. 과거 실패 뒤의 미사용 호출 몫이나 새로운 requestHash를 실행 승인으로 간주하지 않는다. 현재 유료 CLI의 refs 차단을 우회해서 직접 adapter를 호출하지 않는다.

### 구현 순서와 대상

| 단계 | 소유 파일·심볼 | 구체 변경 |
|---|---|---|
| R3-A1 | `evals/affect-deepseek.ts` CLI parsing/live·diagnostic 분기 | 새 `--live-reference-diagnostic` 모드만 refs 실제8건 경로로 분리한다. `--wire-format refs-v1`, `--approved-request-hash <hash>`, 기존 paid/synthetic 플래그를 모두 요구한다. 기존 UUID 두 live 모드의 refs 거부와 기본값은 유지한다. |
| R3-A1 | 같은 파일의 preparation 확인·원장 진입 | 새 모드의 플래그/hash/진단8 scope/원본 artifact·실제 wire·모든 prepared metadata 일치를 **키/원장 읽기 전** 검증한다. 공유 `eventWireOption`의 기존 live 차단은 유지하고 새 모드만 offline parsing 뒤 명시적 검증으로 통과시킨다. `verifyDeepSeekReferenceRequests`를 재사용한다. |
| R3-A1 | 같은 파일의 attempt/fetcher/결과 저장 | 기존 `O1 DeepSeek diagnostic ${requestHash}` identity를 그대로 사용한다. 새 실행 이름/평가 metadata로 동일 후보 중복 차단을 우회할 수 없게 한다. 기존 lock·사전 전체 예약 여유 검사·원본/응답/usage 기록·오류 후 중단을 재사용한다. 실제 경로에 authored fixture 비교를 넣지 않는다(현재 refs 모의 분기는 `!live`일 때만 검증). |
| R3-A2 | `evals/affect-reference-artifacts.test.ts` | 기존 guard 테스트 유지. 새 모드 승인 hash 누락/불일치·잘못된 format/문항/원본·stale 준비는 secret read/HTTP0. 가짜 설정·원장·주입 HTTP로 유효8건/오류 중단/중복 시도/과거 항목 보존을 검사한다. 합법적 실제 경로 모의는 authored 응답과 다른 유효 응답을 포함해 fixture 강제 비교가 없음을 입증한다. |
| R3-A3 | 기존 `--prepare-diagnostic --wire-format refs-v1` | 변경 후 새 폴더 `refs-deepseek-prepare-live-r1`에 모의8을 준비한다. source hash는 갱신하되 위 request/input hash와 예약 합계가 같아야 한다. 옛 준비를 덮어쓰거나 stale metadata만 손으로 고치지 않는다. |
| R3-B | 같은 새 CLI, 기존 `evals/affect-deepseek-replay.ts` | 승인 후 `refs-deepseek-live-r1`에 최대8건을 단 한 번 기록한다. 이후 `refs-deepseek-live-replay-r1`에서 원본 snapshot으로 오프라인 검증한다. 결과/원문 검수는 `docs/DEEPSEEK_DEV_RESULT.md`가 소유한다. |

모든 위 폴더는 `${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/` 아래이며, 이미 존재하면 중단한다. 공통 계약/Core/codec/provider/DB/운영 설정 변경은 계획하지 않는다. `affect-live.ts`의 OpenAI refs 차단도 유지한다. 실제 실행에 필요한 임시 DeepSeek 설정은 기존 키를 보존하고 종료/오류 시 복원한다. 출력은 키·헤더·오류 원문을 포함하지 않는다. unresolved/reserved가 생기면 예약을 유지하고 해소 전 다른 후보 호출도 하지 않는다.

### 성공 기준과 실패 후 처리

아래 RS 기준은 **계획 단계이며 전부 NOT VERIFIED**다. RC01–08의 감사 PASS는 그대로 보존한다.

| ID | 관측할 성공 기준 | 검증 소유자 |
|---|---|---|
| RS01 | 기존 live 모드/누락·틀린 승인 hash·잘못된 후보는 키/원장/HTTP 이전 거부. 정상 새 모드만8건 경로 진입 | CLI child-process guard 검사 |
| RS02 | 원본/input/wire/source hash를 고정해 새 준비와 실제 전송 일치. 기존 UUID attempt와 refs 동일 요청 중복 차단을 유지. 과거 원장/상한 불변 | artifact 검사·가짜 원장·새 모의 manifest |
| RS03 | 실제 경로 모의 정상8건, 첫 기술 오류 뒤 추가 호출0. 유효한 비fixture 응답도 수용. 출력/usage 불명 시 예약 유지·재시도0 | 주입 HTTP 및 중단 회귀 |
| RS04 | 실제8건 모두 schema·인용·권한·UUID 복원 통과. 원문 자동 보정0, replay 결과와 실제 decode 일치 | 새 실제 원문/진단/결과/replay. 중단 뒤 미호출은 NOT VERIFIED |
| RS05 | 고정 rubric8/8 통과 뒤 각 원문의 행위자·사용·정정·기대·양/음 근거 검수도 적합 | `checkAffectCandidate` + 원문 검수. REVIEW_REQUIRED는 PASS 아님 |
| RS06 | 최대8회·총0.20/누적36 내, 새 unknown0·과거 항목 불변·설정 복원. 호출한 수/미호출/정산과 미확인 구분 | 실제 manifest·원장 전후 요약·복원 검사 |

문항별 RS05: D01 자기 사용의 부정 결과, D02 타인 공감과 자기 미사용 분리, D06 동일 성향의 양·음 공존, D09 미사용 기대≠관측 결과, D10 모호한 검색에서 episode 보류, D12 가정≠실제, P01 used/pending, P02 정정 뒤 not_used/pending이다. D02의 중립 self가 다시 고정 FAIL이면 그대로 FAIL로 두되 `agencyImpact`로 현재 수치 영향과 metadata 불일치를 분리한다. 이를 통과시키려고 평가를 낮추지 않는다.

기술 오류(HTTP·timeout·형식/참조·usage·한도)는 즉시 중단한다. 계약을 통과한 의미 rubric FAIL은 기록하고 같은 고정 묶음의 나머지를 계속 관찰할 수 있으나, 실패한 문항을 재호출하지 않는다. 종료 뒤 RS04/RS05/RS06을 따로 판정한다. 참조 성공만으로 의미 품질 전체 PASS를 선언하지 않는다.

실패는 (a) 정확한 참조/계약, (b) 공급자 의미 판단, (c) 모델 없이 재현되는 구현, (d) 고정 rubric과 제품 영향의 차이로 분류한다. (c)만 근거 있는 공통 수정 대상으로 삼고, (b)는 해당 후보의 미해결로 기록한다. 작은8건 결과를 제품 한계나 일반화 성능으로 확대하지 않는다. 같은 문제 수정/재감사3회 한도를 유지하며 이번 실행에서 후속 프롬프트 후보를 만들어 재시험하지 않는다. 전부 적합해도 O1 전체 완료/운영 승격은 아니며 다음 미검증 전이·통합 범위를 별도로 정한다.

### R3-A 검증 명령과 BUILD 인계

cwd는 저장소 루트, TEMP/TMP는 기존 별도 로컬 저장소 증거 루트의 `tmp`로 둔다. 별도 로컬 저장소 쓰기는 실행 도구 권한 승인을 거치며 우회하지 않는다. 아래는 **구현 후 실행할 명령이며 이번 계획에서는 미실행**이다.

```powershell
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts --no-cache evals/affect-reference-artifacts.test.ts evals/affect-diagnostic.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
node --experimental-transform-types evals/affect-deepseek.ts --prepare-diagnostic --wire-format refs-v1 --output ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/refs-deepseek-prepare-live-r1
git -c core.safecrlf=false diff --check
```

실제 실행 예정 형식(아직 미구현·미승인): `--live-reference-diagnostic --output <새 별도 로컬 저장소 경로> --prepared <새 준비 경로> --wire-format refs-v1 --approved-request-hash <위 고정 hash> --allow-paid-providers --synthetic-inputs`. 플래그 자체는 사용자 승인의 증거를 대신하지 않는다.

**다음 BUILD:** R3-A1→A3까지만 구현·모의 검증하고, RS01–03 증거와 최종8건 hash/예약을 제시한다. 실제8건 실행은 그 구체 결과에 대한 R3-B 범위 확인 뒤 진행한다. 이번 계획 작업의 코드 변경·API 호출0, 실제 원장 읽기1회·수정0이다.

## R2 BUILD 인계 — 2026-10-17

R2-A codec → R2-B 두 공급자 연결 → R2-C 모의 준비·원본 보존·replay를 구현했다. 기존 UUID payload/requestHash와 기본 promptVersion을 보존했고 refs는 명시적인 어댑터 생성자 인자로만 선택한다. 운영 env·Core·도메인 계약·DB schema는 변경하지 않았다. refs 결과는 요청별 snapshot으로 정확히 복원한 뒤 원본 validator를 통과한다. 잘못된 참조의 자동 보정·UUID fallback·추가 HTTP는 없다.

계획된 파일 외에 세 평가 보조 파일을 추가했다. `evals/affect-reference-artifacts.ts`는 두 실행기와 replay의 snapshot/hash/후보 guard를 공유한다. `affect-reference-fixture.ts`는 provider 테스트와 두 모의 실행기의 비어 있지 않은 authored 응답을 공유한다. `affect-reference-probe.ts`는 기존 OpenAI probe에서 새 진단8 모드만 분리했다. 이 조정은 중복 구현을 줄이기 위한 것이며 새 운영 기능이나 별도 실제 평가 시스템은 아니다.

증거 루트: `${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/`.

| 기준 | 현재 판정 | 실제 증거·한계 |
|---|---|---|
| RC01 | PASS (로컬) | UUID diagnostic 요청 hash `23268ba53b10308d72e34c10f24dcbfa5bd4cab266fc5e9f95763aebe25bae4b` 불변, 미지정/명시 UUID 일치와 refs 인스턴스 격리 |
| RC02 | PASS (로컬) | 추가 claim 근거·null/character actor·복합 감정 왕복, 부적격/잘못된 종류·revision·인용·직접 UUID 거부. 기존 권한 회귀 포함 |
| RC03 | PASS (로컬) | state-only ID와 두 revision 유지, evidence/concern/episode 사용 거부 |
| RC04 | PASS (로컬) | input-only 및 concern 없는 outcome-only, 없는 expectation의 null, 빈 enum 없음. 실제 공급자 schema 수용은 미검증 |
| RC05 | PASS (로컬) | 반복 준비 일치, UUID 같은 본문 불변, 역순 완료와 호출자 입력 변경에도 고정 snapshot 유지 |
| RC06 | PASS (모의) | 비어 있지 않은 별칭 응답의 두 provider decode, OpenAI 계수/생성 입력 동일, DeepSeek 최종 payload 예약·오류 후 중단. 외부 HTTP0 |
| RC07 | PASS (로컬) | 원본/hash/버전/source/전송 변조·누락 거부. refs8건의 준비 결과와 replay UUID 결과 동일. legacy 실제4건의 기존 결과 유지, 미호출4건 NOT_REPLAYABLE |
| RC08 | PASS (로컬) | 두 live CLI의 명시 refs/refs manifest를 secret read·HTTP 이전 거부하는 child-process 검사. 가짜 원장에 기존 UUID attempt를 넣어 중복 차단·과거 항목·lock 정리 확인 |

검사 기록은 `refs-codec-r1.json` 51/51, `refs-providers-r1.json` 44/44, `refs-eval-r1.json` 69/69로 **서로 다른 검사164/164 PASS**다. 타입 검사와 diff 검사 PASS. 최초 타입 검사에서 reverse Map의 문자열 타입 추론 오류를 수정한 뒤 재검사했다. 기능 검사 실패를 숨기거나 기대값을 낮춘 변경은 없다. 과거 R1의51건을 다시 총합에 더하지 않는다.

- `refs-deepseek-mock-r1`: 가짜 생성8건, 외부0. refs 요청 hash `952a8661bc547c89cc2fee408e0ae64e0ee7964ad6c22927adb1b3b443776545`.
- `refs-openai-mock-r1`: 가짜 계수8+생성8, 외부0. 양쪽 모두 고정 diagnostic8이며 annotation/confirm/transfer 미실행.
- `refs-deepseek-replay-r1`: 원본 snapshot과 wire를 대조한 뒤8/8 결과 일치.
- `refs-legacy-replay-r1`: 이전 실제 D01/D02/D06 수용·D09 거부가 원래 result와 동일, 나머지4건 미호출 유지. legacy는 wire-visible 입력 범위의 재검증이다.

실제 키·원장은 이번 BUILD에서 읽거나 쓰지 않았다. 실제 원장 누적20건/보수0.0369267달러는 직전 실행 기록이며 이번에 새로 조회한 값이 아니다. 모의 산출물의 비용은 합성 원장 수치로 청구액이 아니다. 짧은 참조가 DeepSeek 오류를 줄였다는 주장이나 OpenAI 실제 지원 확인은 하지 않는다. 기존 실제 실패·평가 기준·O1 PARTIAL·Store/Stage 미연결 상태를 유지한다.

다음 단계는 **AUDIT**다. 이번 구현은 작성자의 로컬 검증이며 별도 구현 감사를 마쳤다는 뜻은 아니다. 감사 후에도 실제 비교는 별도 범위/비용 준비가 필요하고 현재 refs 유료 평가 CLI는 차단돼 있다.

검수 기준은 main HEAD `fc883fa`와 현재 미커밋 O1 파일이다. HEAD에 없는 `event-interpreter.ts`, `affect-appraisal.ts`, 평가 실행기와 기존 수정된 `openai.ts`도 직접 읽었다. 아래 R1의51/51은 이전 구현 검증이며 이번 계획 검수에서 새로 실행한 결과가 아니다. 기존 H2-A 작업은 범위 밖으로 보존한다.

## 판단과 근거

실제 `deepseek-diagnostic-live-r1`은4건 뒤 D09에서 중단됐다. [원문·비용·미실행 범위](../results/DEEPSEEK_DEV_RESULT.md)를 보존한다. DeepSeek 후보의 오류를 제품 전체의 한계로 해석하지 않는다. 기존 OpenAI 성공도 당시 과제의 증거이며 이번 문항의 비교 결과는 아니다.

D02의 미사용 사실과 자기/타인 감정 범위는 맞았다. 고정 평가의 `input.agency` FAIL은 `agency=self`인 중립 항목도 모두 금지하기 때문에 발생했다. 다만 감정 수치에 영향이 없다는 이유만으로 주체 메타데이터가 정확하다고 단정할 수는 없다. **고정 기준을 바꾸거나 PASS로 재분류하지 않고, 현재 Core에서의 영향과 메타데이터 불일치를 분리해 설명한다.** 향후 agency 소비자가 생기면 추가 검토가 필요하다.

D09는 정확한 인용문을 선택했지만 출처 UUID의 일부를 바꿔 출력했다. 잘못된 UUID와 존재하지 않는 정상 형식 UUID는 모두 거부해야 한다. 출처 텍스트로 ID를 추측하거나 비슷한 ID로 복구하는 방법은 채택하지 않는다. 짧은 참조값은 모델이 복사할 문자를 줄이는 후보이지 오류 감소가 입증된 해법은 아니다. 다른 유효 참조값을 잘못 고르는 의미 오류까지 해결하지도 않는다.

## R1 — 평가 설명 수정: 완료

소유 파일:

- `evals/affect-cases.ts`: `checkAffectCandidate`의 기존 verdict·failures·scope 기준을 유지하고 `agencyImpact` 진단만 추가.
- `evals/affect-agency-impact.test.ts`: 실제 D02/D09 및 작성 대조를 검사.
- `evals/fixtures/affect-diagnostic-regression-v1.json`: 실제 요청·원문 문자열·SHA256·당시 고정 판정 보존. 합성 자료만 포함.

`agencyImpact`는 버전 `agency-impact-v1`, 현재 Core 정책 버전, 원본 appraisal index·scope·agency 및 해당 항목만 초기 상태에 반영한 `isolatedLevels`를 기록한다. Core를 직접 호출하므로 계산식을 평가기에 복제하지 않는다. 값이 모두0이면 `no_current_drive`, 하나라도 양수면 `current_drive`다. 이는 **agency 필드가 감정을 발생시켰다는 인과 주장이나 실제 전체 이력의 최종 변화량이 아니다.** 현재 Core는 agency를 수치 계산에 사용하지 않는다. 기계 계약을 통과하지 못한 응답은 진단하지 않으며 기존 NOT_EVALUATED를 유지한다.

| 성공 기준 | 확인 결과 |
|---|---|
| 실제 D02/D09 원문·기존 FAIL 및 scope 판정 유지 | PASS. 새 필드 외 당시 checks와 동일 |
| D02 무영향 중립을 구분하고 원문을 수정하지 않음 | PASS. `no_current_drive`, 원문·Core snapshot 보존 |
| 부정·긍정 및 극소량 감정이 있는 항목을 중립으로 숨기지 않음 | PASS. `current_drive`, agency FAIL 유지 |
| congruence0이어도 과거 기대 불일치로 activation이 생기면 구분 | PASS. expectedness0은 drive 있음,1은 없음 |
| relevance0으로 수치 영향이 없어도 metadata FAIL 유지 | PASS |
| D09의 잘못된 형식과 존재하지 않는 정상 UUID 모두 거부 | PASS. 자동 보정 없음 |

증거 루트 `${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/`:

- `agency-impact-red.json`: 구현 전3PASS/7FAIL로 추가 진단 부재 확인.
- `agency-impact-final.json`: 관련 평가51/51 PASS. 이번 신규10건과 기존41건이며 과거 검사 수와 합산하지 않는다.
- 타입 검사·diff 검사 PASS. 이번 변경은 평가 도구/테스트/문서만이며 Core·포트·공급자 구현은 변경하지 않았다.
- `agency-impact-review-r1.json`: 실제2개 응답을 로컬 재검수, 기존 판정 동일. 독립 검수자의 평가나 새 모델 응답이 아니다.
- `deepseek-diagnostic-prepare-impact-r1`: 모의8 PASS, 외부0. 모델 요청 hash는 기존 `23268ba53b10308d72e34c10f24dcbfa5bd4cab266fc5e9f95763aebe25bae4b`와 같고 평가 소스 hash만 갱신된다. 이전 실제 시도의 중복 차단은 그대로이므로 이 준비로 재호출할 수 있다는 뜻이 아니다.

## R2 — 어댑터 내부 짧은 참조 표현: 다음 구현 후보

### 검수 1차에서 수정한 계획 결함

두 하위 에이전트가 각각 계약/출처와 평가/재실행 경계를 읽기 전용으로 검토했고 주 에이전트가 코드와 대조했다. 같은 대화 이력을 공유한 병렬 검토이며 외부 독립 평가나 실제 실행 검증은 아니다.

| ID | 필요한 보완과 코드 근거 | 계획 반영 |
|---|---|---|
| RP01 | `validateEventInterpretation`은 일반 evidence의 추가 비episode 근거, actors 밖의 characterId, nullable actor를 허용한다. 막연한 '종류 제한'은 정상 응답을 거부할 수 있음 | 아래 필드별 권한표와 RC02 |
| RP02 | `stateSourceRefs`는 현재 sources 밖의 과거 event와 다른 revision도 담는다. 매핑 가능성과 인용 권한은 다름 | 이력 의존성과 인용 후보를 분리, RC03 |
| RP03 | request는 persona/goal·과거 expectation을 필수로 요구하지 않는다. 빈 enum 처리 누락은 유효한 abstention/outcome-only 요청을 막음 | 빈 집합 분기 결정, RC04 |
| RP04 | 현재 replay는 wire의 user 메시지를 원본 request로 읽는다. 별칭이나 후보 필터 이후에는 원본 자료와 삭제 의존성을 복원할 수 없음 | 원본 요청을 별도 보존·hash 검증, RC07 |
| RP05 | builder/두 provider/실행기는 전역 버전과 UUID 기본 경로를 공유한다. '대조 보존'만으로 기본값·준비/전송 일치를 보장하지 못함 | 명시 후보 선택·결정적 변환·유료 실행 차단, RC01/06/08 |

**계획 검수 결론: PASS(계획 범위).** RP01–05의 구현 결정을 문서에서 해소했고 두 검토자가 수정 부분을 다시 읽어 기존 지적 해소·새 필수 모순 없음을 확인했다. R2 구현 성공 기준 RC01–08은 모두 **NOT VERIFIED**이며 다음 BUILD에서 입증해야 한다. R1과 기존 실제 원문의 판정은 바꾸지 않았다.

### 채택할 범위와 기본값

SDK의 `EventInterpretationRequest/Result`, DB UUID, Core 정책을 유지한다. 공통 모델 어댑터에서만 UUID를 요청 내 짧은 값으로 표현하고 반환값은 정확한 조회로 복원한다. DeepSeek 전용 규칙이나 문항별 프롬프트는 추가하지 않는다.

- 모델 전송 형식 `EventWireFormat = 'uuid-v3' | 'refs-v1'`를 어댑터 내부 선택으로 둔다. 미지정은 `uuid-v3`; 기존 UUID messages/schema/promptVersion과 요청 hash가 바뀌지 않아야 한다. 운영 env·provider 선택·일반 대화/추천 생성에는 옵션을 추가하지 않는다.
- refs 후보만 `event-interpretation-v3-refs1`과 codec 버전 `event-refs-v1`을 사용한다. 의미 지침은 공통으로 유지하고 참조 표기 안내만 달라진다. 두 provider의 `promptVersion`과 실제 선택 형식이 일치해야 한다.
- `buildEventInterpretationRequest(input, wireFormat = 'uuid-v3')`는 계속 직렬화 가능한 transport 요청만 반환한다. 내부 준비 함수는 같은 snapshot으로 transport 요청과 decode 함수를 함께 만들고, `StructuredEventInterpreter`가 그 decode를 호출한 뒤 원본 validator를 적용한다. provider와 평가 실행기는 동일 옵션을 명시 전달한다.
- 이번 R2의 범위는 로컬 codec·주입식 HTTP 모의·기록/replay다. 기존 유료 모드에서 refs 후보를 지정하면 **키·실제 원장 읽기 및 HTTP 이전에 거부**한다. 별도 실제 평가 계획이 승인되기 전까지 이 경로를 열지 않는다. SDK 전체 설정 체계나 새 공급자를 만들지 않는다.

### 변환과 권한 결정

원본 request를 검증해 호출별 snapshot으로 고정한 뒤 `eligibleAffectEpisodes`로 모델에 보일 sources를 정한다. 원본 snapshot은 사후 검증·이력 의존성의 기준이며 숨긴 episode도 거기서 지우지 않는다.

가시 요청의 명시 ID 필드 전체에서 UUID를 모아 중복 제거·정렬하고 순서대로 `r1`, `r2`를 부여한다. 같은 입력은 준비·실행·replay 때 같은 별칭과 schema를 만든다. random UUID·시계·전역 카운터로 별칭을 생성하지 않는다. 대상 경로는 루트와 각 source의 `scope.ownerId/characterId`, `eventId`, `speakerId`, `sources[].id/speakerId`, `actors[].id`, `stateSourceRefs[].sourceId`다. text·quote·label·revision·null은 그대로 둔다. JSON 전체 문자열 치환은 하지 않는다.

**테이블에 있는 ID와 출력에서 인용할 수 있는 ID를 분리한다.** state-only ref와 ownerId는 테이블에 있어도 그 사실만으로 인용/actor 권한이 생기지 않는다. 같은 sourceId의 서로 다른 revision tuple은 합치거나 버리지 않는다.

| 출력 필드 | 후보 집합과 최종 제약 |
|---|---|
| `outcome.episodeId`, `appraisal.episodeId` | `eligibleAffectEpisodes`의 ID만 허용. appraisal은 null도 허용. 같은 outcome·실제 사용/관측 결과 관계는 원본 validator가 확인 |
| `concern.source.sourceId` | 가시 sources의 persona/goal만 허용. 정확한 revision/부분문자열 인용 필요 |
| `outcome.evidence[].sourceId` | 가시 sources. 현재 input과 선택 episode가 반드시 포함돼야 하지만 추가 비episode 근거를 일괄 금지하지 않음. 서로 다른 source의 추가 인용은 현 계약의 검증을 유지 |
| `appraisal.evidence[].sourceId` | 가시 sources. 현재 input 필수. episode 근거라면 해당 appraisal의 episode와 같아야 하며 null 범위에서는 episode 인용 불가. claim/response/expectation/goal 등 추가 비episode 근거는 허용 |
| `expectation.sourceId` | 현재 input보다 앞선 expectation/response만 허용. expectedness와 함께 null 여부를 유지 |
| `actorId/targetId` | `actors[].id ∪ {scope.characterId}` 또는 null. actor 목록에 없는 characterId도 허용하고, ownerId가 이 집합 밖이면 거부 |

필드별 후보 집합을 wire schema와 로컬 decode에 함께 적용한다. 모르는 별칭·공백/대소문자 변형·직접 UUID·예상하지 않은 필드는 거부하며 추측/기본값/가까운 ID로 복구하지 않는다. 인용 뜻, 관계 제약, revision, quote, 중복 appraisal은 복원 뒤 **변경하지 않은 `validateEventInterpretation`**이 확인한다. DeepSeek JSON mode의 enum 준수를 가정하지 않는다. 등가성 주장은 **동일한 가시 자료와 허용 후보로 표현 가능한 응답**에 한정한다. 숨긴 episode를 추측해 내는 응답까지 허용해야 한다는 뜻이 아니다.

빈 집합은 `enum: []`를 만들지 않고 다음 분기를 사용한다. episode 없음은 outcome=null 및 appraisal.episodeId=null. 과거 expectation 없음은 expectation/expectedness=null. concern 없음은 appraisals의 최대 길이를0으로 제한해 빈 배열의 abstention 또는 outcome-only 응답을 허용한다. 이때 빈 배열의 item schema는 구조만 유지하고 참조를 새로 허용하지 않으며 로컬 decode도 비어 있지 않은 배열을 거부한다. 필수 concern을 null로 바꾸지 않는다. 각 분기는 유효 JSON Schema와 로컬 검증을 확인하며 실제 OpenAI의 schema 수용은 모의 통과만으로 주장하지 않는다.

매핑과 snapshot은 호출별 지역 상태로 유지한다. 두 요청의 완료 순서가 바뀌거나 호출자가 입력 객체를 나중에 수정해도 준비한 원본 기준으로 decode한다. 같은 별칭이 다른 요청에서 다른 대상을 뜻할 수 있으므로 별칭을 응답 출처 인증으로 취급하지 않는다. transport의 요청/응답 수명을 보존하며 임의의 과거 응답을 다른 요청에 붙여도 항상 검출된다는 보장은 하지 않는다.

### 증거와 재검증의 계약

refs-v1 준비에는 합성 자료에 한해 별도 `event-inputs.json`을 남긴다. 각 행은 `id`, **필터 전 원본 UUID request**, `wireFormat`, `codecVersion`, `promptVersion`을 가진다. 별칭 테이블은 결정적으로 재생성하므로 별도 진실의 원천으로 중복 저장하지 않는다. manifest에 원본 artifact hash, 실제 wire 요청 hash, 해당 버전과 codec 포함 source hashes를 묶는다. wire 메시지는 여전히 정답·rubric·agencyImpact를 포함하지 않는다. 이 저장은 평가용이며 운영 로그에 원문을 추가하는 변경이 아니다.

replay는 버전을 먼저 판별하고 지원하지 않는 버전/원본 누락/hash 불일치이면 `NOT_REPLAYABLE` 또는 명시 오류로 끝낸다. refs 원본 snapshot에서 같은 codec으로 매핑과 요청을 다시 만들어 **저장된 provider wire와 동일함을 확인**한 뒤 원문 응답을 decode하고 원본 UUID validator를 호출한다. 당시 고정 판정과 현재 검증 결과를 별도 필드로 기록한다. codec/source가 달라졌다면 과거 버전을 조용히 현재 버전으로 읽지 않는다.

기존 wireVersion 없는 UUID 기록은 legacy UUID 경로로만 읽는다. 현재처럼 wire-visible input으로 재검증할 수 있는 범위는 유지하되 필터 전 snapshot·전체 의존성을 복원했다는 주장은 하지 않는다. 기존 파일을 덮어쓰거나 원본을 추정하지 않는다. 이번 R2의 기존 DeepSeek replay만 확장하며 새 OpenAI 실제 replay 시스템을 추가하지 않는다.

### 구현 순서·소유 파일

| 단계 | 파일·심볼 | 작업과 연결 기준 |
|---|---|---|
| R2-A | `packages/adapters/src/event-reference-codec.ts` (신규), `event-reference-codec.test.ts` (신규) | 결정적 매핑·명시 경로 변환·field authority·빈 집합·snapshot 수명. RC02–05 |
| R2-B | `packages/adapters/src/event-interpreter.ts`의 builder/StructuredEventInterpreter, `openai.ts`의 OpenAIEventInterpreter, `deepseek.ts`의 DeepSeekEventInterpreter | 명시 format 옵션·기본 UUID 불변·decode 후 원본 검증. RC01/02/06 |
| R2-B 검증 | `event-interpreter.test.ts`, `event-authority.test.ts`, `openai-affect.test.ts`, `deepseek.test.ts` | 두 경로의 정상/실패, promptVersion, 계수/전송 동일성, 기존 실패 후 중단 보존. RC01–06 |
| R2-C | `evals/affect-deepseek.ts`, `affect-probe.ts` | 기존 고정 diagnostic8에 한해 refs 모의 준비 선택, synthetic budget만 사용. source hash 목록에 codec 추가. 원본 artifact/전송형식/hash 저장. RC06–08 |
| R2-C | `evals/affect-live.ts`와 위 DeepSeek live 분기 | refs live 요청/manifest를 키·실제 원장 읽기 전에 거부. UUID 기본 경로의 count·상한·attempt identity 유지. RC08 |
| R2-C | `evals/affect-deepseek-replay.ts`, `evals/affect-reference-artifacts.test.ts` (신규) | refs 원본/버전/hash 검증·decode, legacy UUID 재검증의 제한 명시. RC07/08 |
| 마감 | 이 계획, `OUTCOME_AFFECT_RESULT.md`, `DEEPSEEK_CONNECTION.md`, `BUILD_HANDOFF.md` | 구현/모의/실제 미검증 상태를 구분하고 증거 경로 갱신 |

codec와 평가 옵션은 일반 대화/추천 생성을 바꾸지 않는다. R1 평가기와 fixture의 verdict도 수정하지 않는다. R2-A → B → C 순으로 진행하고 새 라이브 비교 준비·DB/Store/Stage 연결은 이 BUILD 범위에 넣지 않는다.

### 성공 기준 — 모두 NOT VERIFIED

| ID | 관측할 조건·반례 | 증거 소유자 |
|---|---|---|
| RC01 | 미지정/명시 uuid-v3의 messages/schema/promptVersion/requestHash 동일. refs 선택이 다른 인스턴스·일반 대사에 영향 없음 | builder/provider 테스트, 기존 UUID 준비 hash 대조 |
| RC02 | 가시 자료 내 정상 outcome/복합 감정과 추가 claim 근거의 왕복·Core snapshot 동일. characterId∉actors 및 null 허용, owner-only actor·잘못된 concern·교차 episode·없는 인용/revision은 거부. found/ambiguous/stale/unavailable/empty/truncated 경계 유지 | codec/authority 테스트 |
| RC03 | sources 밖 state ref + currentAffect>0, 같은 ID의 서로 다른 revision을 보존. 해당 별칭을 evidence/concern/episode로 사용하는 것은 거부 | codec 테스트 |
| RC04 | input-only의 uncertain+빈 appraisal 허용. concern 없는 found episode의 outcome-only 허용. 없는 expectation은 두 필드 null. 빈 enum·필수 concern의 null 허용·자기 모순 schema 없음 | codec/schema 테스트, provider 모의 |
| RC05 | 같은 snapshot의 반복 준비 bytes/hash 일치. ID 같은 본문 불변. 별도 요청 역순 완료 및 호출 뒤 원본 객체 변경에도 각 고정 snapshot으로 복원. 전역 매핑 없음 | codec/interpreter 테스트 |
| RC06 | OpenAI count payload가 생성 payload의 계수 대상 필드와 동일하고, DeepSeek 예약 bound가 실제 최종 payload 기준임. 두 provider 각각 비어 있지 않은 outcome/appraisals의 별칭을 decode해 같은 UUID 의미를 반환. null/빈 배열 상수만으로 통과시키지 않음. malformed alias 때 자동 UUID fallback·추가 HTTP 없음 | provider 주입식 HTTP 테스트 |
| RC07 | 새 원본/hash/버전/codec source 훼손·누락을 거부. 저장 wire 재생성과 decode 후 원본 검증 일치. legacy UUID 실패를 보존하며 원본 전체 복원으로 승격하지 않음 | artifact/replay 테스트 |
| RC08 | refs는 모의 준비만 허용. 두 live 진입점은 refs를 키/원장/HTTP 전에 거부. UUID 동일 요청은 metadata·평가 변경만으로 기존 attempt 차단을 통과하지 못함. 원장/상한/미해결 예약을 재설정하지 않음 | artifact/runner 테스트, 가짜 원장·secret read 차단 spy |

기존 D02/D09와 D02/D06/D10 실제 실패는 당시 형식/판정으로 남긴다. 사람이 별칭으로 변환한 정상 대조는 authored fixture이며 모델 개선 증거가 아니다. RC06은 외부 공급자의 실제 schema 지원이나 의미 품질 PASS가 아니다.

### 계획된 검증 명령

작업 위치는 저장소 루트. 아래는 **향후 BUILD용 명령**이며 이번 계획 검수에서는 실행하지 않았다. 신규 파일과 CLI 옵션은 아직 없다. 테스트의 TEMP/TMP 및 산출물은 `${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/` 아래 새 폴더를 사용하고 해당 쓰기 권한을 받는다. 실제 키/원장은 읽지 않는다.

```powershell
$env:TEMP='${ARTIFACT_ROOT}\affect-appraisal-o1-20261017\tmp'
$env:TMP=$env:TEMP
node node_modules/vitest/vitest.mjs run --no-cache packages/adapters/src/event-reference-codec.test.ts packages/adapters/src/event-interpreter.test.ts packages/adapters/src/event-authority.test.ts packages/adapters/src/openai-affect.test.ts packages/adapters/src/deepseek.test.ts
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts --no-cache evals/affect-reference-artifacts.test.ts evals/affect-cases.test.ts evals/affect-boundary.test.ts evals/affect-diagnostic.test.ts evals/affect-agency-impact.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
node --experimental-transform-types evals/affect-deepseek.ts --prepare-diagnostic --wire-format refs-v1 --output ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/refs-deepseek-mock-r1
node --experimental-transform-types evals/affect-probe.ts --rehearse-reference-diagnostic --wire-format refs-v1 --output ${ARTIFACT_ROOT}/affect-appraisal-o1-20261017/refs-openai-mock-r1
```

새 모의 모드는 기존 diagnostic8을 공유한다. OpenAI는8계수+8생성, DeepSeek는8생성의 **가짜 HTTP**이며 annotation/confirm/transfer를 실행하지 않는다. 모의 응답은 권한/왕복을 확인할 authored 자료로 구성하고 의미 점수를 산출하지 않는다. 단위 테스트에서 기본 UUID 경로의 변화를 확인하되 전체 프로젝트 suite를 기본 실행하지 않는다.

### 실제 품질 판단과 중단 경계

로컬 변환 성공은 모델의 오류 감소를 증명하지 않는다. RC01–08을 입증한 뒤 별도 실제 비교 계획에서 모델·공통 입력·wire 버전·토큰 한도·새 호출 묶음·예약액·중단 조건을 고정한다. 이전 남은4건을 자동 재개하거나 요청 hash가 바뀐 것을 새 승인으로 취급하지 않는다. 작은 진단은 통계적인 오류율 개선이나 일반화 증거가 아니다. OpenAI는 크레딧이 다시 사용 가능하다는 확인 전까지 호출하지 않는다.

후속 감사는 원본-가시입력-별칭 권한의 일치, 후보 옵션이 UUID 기본 경로에 새지 않는지, 원본 없는 replay의 정직한 범위를 우선한다. 같은 문제의 수정/검토가3회 뒤에도 해결되지 않으면 기록하고 그 반복을 멈춘다. 공급자 교체는 별도 비교 대상이며 모델 후보를 통과시키려고 SDK 요구나 감정 설계를 축소하지 않는다.
