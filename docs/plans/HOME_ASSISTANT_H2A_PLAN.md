# H2-A — 단일 사용자 텍스트 홈비서의 일상 사용 기반

상태: **BUILD 진행 중, A1–A3 구현·로컬 검증**. 구현 증거는 §10, 실제 검증 준비와 추가1장면은 §11, MyCemory 규약의 선택적 참고는 §8을 따른다. 최초 2026-10-17 요청 “H2-A 구체적인 계획이랑 성공기준 작성하고 기존 문서도 맞춰줘”는 계획만 승인했으며, 아래 PLAN 당시 기록은 그 범위를 보존한다. 이후 구현 착수와 유료 검증·게시 승인은 구분한다.

기준: `main`의 `fc883fae300e04f57ea01290b8eb43331fd0fbfa`, 태그 `v0.2.0-home-assistant-h1`. 계획 시작 시 작업 트리는 깨끗했다. PLAN 작성 당시 변경은 이 계획과 직접 연결되는 기존 문서뿐이었다. [H1 마감](../results/HOME_ASSISTANT_H1_RESULT.md)과 당시 실패·원응답은 보존한다. PLAN 당시 revision1, 수정/재감사0회. 현재 BUILD 현황은 §10이며 대기 중인 감사 제안은 없다.

## 1. 목표와 제외 범위

같은 사용자가 앱을 다시 켜거나 새 만남을 시작해도 지정 자료와 명시적으로 저장한 정보를 다시 쓸 수 있게 한다. 무엇이 저장됐는지 확인하고 수정·삭제할 수 있어야 한다. 정보를 저장했다는 응답은 DB 반영 뒤에만 보여준다. 캐릭터의 감정·숨김·선택적 침묵 정책은 유지한다.

예: 사용자가 ‘음료 선호 = 보리차’를 저장하고 새 만남에서 물으면 보리차라고 답한다. ‘루이보스차’로 수정하면 이후 저장 근거는 새 값만 사용한다. 삭제하면 저장된 선호가 없다고 처리한다. 지정 자료를 ‘계속 보관’으로 가져온 경우 새 만남에서도 조회하되 ‘이번 만남만’ 자료는 다음 만남으로 넘기지 않는다.

이번 범위는 인증된 로컬 운영자 한 명의 텍스트 사용이다. 가족 등록·수동 가족 ID 선택·화자 인식·STT/TTS·웹 검색·IoT·원격 공개·Raspberry Pi 배치·Hermes·새 검색 엔진·임베딩 다운로드는 하지 않는다. 자동 프로필 추론, 전체 대화의 자동 장기 저장, 자연어 저장/삭제 의도 분류기도 만들지 않는다. 기존 H1-F01 문장부호와 퍼즐 성능을 선행 조건으로 삼지 않는다. 데이터 보존은 데이터베이스/저장장치를 초기화하지 않은 정상 종료·비정상 프로세스 종료·재시작 범위다. 저장장치 고장이나 백업에서 복원한 삭제 전 데이터까지 자동 제거한다는 약속은 하지 않는다.

## 2. 코드에서 확인한 출발점

| 현재 소유자 | 실제 상태 | H2-A에서 필요한 차이 |
|---|---|---|
| `knowledge_documents`, `knowledge-store.ts`, `PostgresKnowledgeRetriever.search` | character/session/identity 범위, 활성 만남에서만 조회. 현재 문서 revision과 sessions.knowledge_revision으로 출력 검증 | 요청 만남의 유효성은 유지하면서 같은 운영자의 지속 자료도 조회. 임시 자료의 세션 격리는 보존 |
| `0002_m2.sql`의 memories, `Store.memory`, `Store.memories` | 종류는 활동 결과·검증된 도움·미완료 활동·전달한 제안, fact_kind는 observed. identity는 조회 우선순위이며 강제 필터가 아님 | 사용자 선호를 관측된 활동 기억으로 위장하지 않음. 새 명시적 정보는 별도 소유권 필터와 수명으로 저장 |
| `Store.invalidateOutputs`, response_sources, conversation_refs | 출처 수정·삭제 후 파생 응답·판단·침묵 이유 폐쇄를 처리 | 지속 자료와 사용자 정보의 의존성을 이 폐쇄에 연결하고 과거 만남에서 파생된 답변도 추적 |
| `Store.recover`, `startSession`, `stopSession`, migrate/assertMigrations | 재시작은 미완료 출력을 중단하고 기존 만남을 정리함. 시작 시 자동 migration하지 않음 | 사용자 데이터는 보존하되 과거 출력을 자동 재생하지 않음. migration0001–0005는 수정하지 않음 |
| Studio와 HTTP 인증 | 자료·경험 기억 UI 및 Studio 역할/Origin/Bearer, 합성 상대 A/B 선택이 있음 | 단일 운영자에게 연결된 지속 자료·내가 저장한 정보 UI. 합성 상대 선택을 실제 가족 식별로 취급하지 않음 |

## 3. 구현 결정과 데이터 계약

### 3.1 지정 자료: 기존 엔터티를 확장

- `knowledge_documents`에 `retention: session | persistent`를 추가한다. 기본값은 session. 기존 session_id는 임시 자료의 소유 만남 또는 지속 자료의 최초 가져오기 만남으로 보존한다. 기존 문서를 자동 공유·승격·복제하지 않는다.
- 새 `knowledge_libraries(character_id, identity_id, revision)`는 지속 자료 모음의 revision만 소유한다. 문서/청크 본문 저장소를 이중으로 만들지 않는다. 만남 revision과 지속 모음 revision은 별도로 비교한다.
- 검색은 현재 유효한 요청 만남의 임시 자료 + 동일 character/identity의 지속 자료만 합친다. 같은 이름의 서로 다른 문서를 자동 병합하지 않는다. 검색 후보500청크·상위5·문서32KiB 제한은 우선 유지하며 초과를 명시적으로 거부한다.
- 새 파일 가져오기에서 보관 기간을 선택한다. 기본은 ‘이번 만남만’, ‘계속 보관’은 명시적 선택이다. H1에 이미 가져온 자료를 계속 쓰려면 그 원본을 다시 지정하여 새 지속 문서로 등록한다. 자동 이전·일괄 승격은 범위 밖이다.
- 기존 HTTP 경로와 입력은 호환한다. 생략된 retention은 session이며 새 지속 자료의 owner는 인증된 로컬 운영자에서 결정한다. 임의 identityId로 지속 자료 권한을 얻을 수 없어야 한다. 합성 A/B 검증은 별도 테스트 구성에서 수행한다.
- `DialogueKnowledge`의 기존 revision은 요청 만남 revision으로 유지하고 optional libraryRevision을 추가한다. 지속 자료를 포함하는 새 요청은 두 revision을 반드시 기록한다. 기존 H1 snapshot에 필드가 없으면 당시 세션 자료만 검증한다. 필드 부재를 지속 자료 접근 허용으로 해석하지 않는다.

### 3.2 명시적 사용자 정보: 활동 기억과 분리

- 신규 `personal_facts`는 id, character_id, identity_id, key, value, revision, deleted_at, 생성/수정 시각을 가진다. 활성 항목의 `(character_id, identity_id, 정규화 key)`는 유일하다. key는 앞뒤 공백 제거·NFKC 정규화, 1–80자. value는 1–300자, NUL 금지. 활성20개를 초기 상한으로 두고 초과는 명시적으로 거부한다. 이는 장기 규모 최적화가 아닌 문맥 크기 제한이다.
- 내용은 ‘사용자가 저장한 진술’이며 외부 검증된 사실·모델 명령·새 감정 사건이 아니다. 기존 memories/관계 근거를 복사하거나 종류 제한을 풀지 않는다.
- Studio ‘내가 저장한 정보’에서 이름과 값을 명시적으로 입력·저장한다. 수정·삭제는 해당 항목과 revision을 지정한다. 같은 key를 단순 생성으로 덮어쓰지 않고 충돌을 알려 편집으로 유도한다. 모호한 자연어 ‘그거 잊어’로 여러 항목을 삭제하지 않는다.
- 새 CRUD는 `/api/sessions/:id/personal-facts`와 `/:factId` 아래에 둔다. owner identity는 서버에서 단일 운영자에 바인딩한다. GET은 목록, POST는 생성, PATCH는 수정, DELETE는 삭제다. mutation은 Idempotency-Key 필수, 수정/삭제는 If-Match 필수다. 사용자에게 가족 ID 입력을 요구하지 않는다.
- Studio token은 현재 로컬 운영자의 관리 권한이며 다중 사용자 인증이 아니다. 기존 합성 상대 API가 존재한다는 이유로 가족 간 보안 격리 구현 완료를 주장하지 않는다. 일반 H2-A 사용은 운영자로 고정하고 legacy 합성 시험 구성을 별도로 유지한다.
- 저장 명령 event에는 factId/revision과 멱등성 digest 등 최소 metadata만 남긴다. value를 timeline·로그·모델 호출 승인 기록에 중복 저장하지 않는다. 저장 UI 자체를 모델 입력으로 보내지 않고 저장 완료는 DB 결과로 표시한다.
- 삭제는 value를 지우고 revision을 올려 tombstone을 남긴다. 같은 키 재등록은 새 명시적 생성이며 새 ID를 사용한다. 옛 멱등 요청·늦은 provider 결과로 삭제 항목이 살아나지 않는다.

### 3.3 응답 문맥과 수정·삭제의 영향

- 계약에 `PersonalFact {id, key, value, revision}`와 소유자/모음 revision을 담는 `PersonalFactSnapshot`을 추가한다. 새 `personal_fact_scopes(character_id, identity_id, revision)`는 추가·수정·삭제 시 증가한다. 빈 목록으로 계획한 응답에도 모음 revision을 기록해 ‘저장된 정보 없음’의 오래된 결과를 막는다.
- 단일 사용자 일반 대화가 발화하기로 결정되면 같은 운영자의 활성 정보만 별도 `DialogueContext.personalFacts`로 전달한다. 최대20개를 정렬해 동일 snapshot으로 계수·생성한다. 예산 초과 시 기존 fit 오류 경로로 실패하며 임의 항목을 조용히 버리지 않는다. 인사 등 무관한 말마다 저장 정보를 억지로 언급하지 않도록 생성 지침에 명시한다.
- 자료 검색의 사실 근거는 H1의 검증된 청크만 사용한다. 개인 선호를 설명서 내용이나 출처로 섞지 않는다. 저장된 진술 안의 ‘이전 지시 무시’도 권한이 없다. 판단 모델에 새 개인 정보 전체를 추가하지 않는다.
- `response_runs.personal_context`에 실제 제공한 snapshot을 고정하고 `response_sources.personal_fact_id` 및 source_version으로 의존성을 남긴다. 기존 event/memory/response와 새 fact 중 정확히 하나의 출처만 허용하는 CHECK/FK를 추가한다. same-character/owner를 Store에서 재검증한다.
- 생성 직전·생성 완료·출력 ACK에서 snapshot 유효성을 확인한다. 수정/삭제 시 기존 invalidateOutputs에 fact 의존 응답 ID를 초기 집합으로 주고 파생 일반 답변·판단 문맥까지 폐쇄한다. personal_context 본문도 지운다. 지속 자료 변경은 현재 만남뿐 아니라 같은 소유자의 모든 과거 관련 응답에서 시작한다.
- 이미 화면으로 전달된 정보를 회수할 수 있다고 주장하지 않는다. 현재 자막·출처는 지우고 이후 출력·검색·문맥 재사용은 막는다. 저장 정보 삭제는 별개 사용자가 독립적으로 말한 모든 대화까지 문자열 검색으로 지우는 기능이 아니다. 기록 삭제는 기존 별도 동작이다. 새 저장 UI는 대화 원문 복사 저장 없이 시작해 이 경계를 명확히 한다.
- 새로운 만남은 지속 정보만 이어 쓴다. 종료된 만남의 전체 대사나 pending 입력을 자동 복원하지 않는다. 감정·관계·격식 수식과 의도적 숨김은 변경하지 않으며 기존 시간 감쇠를 유지한다.

### 3.4 실패·migration

변경은 기존 character_state lock과 단일 DB transaction에 묶는다. 잠금 순서는 character_state → 요청 session → 소유자 모음/항목 순으로 고정한다. CAS 충돌·다른 owner·DB 오류·입력 한도 초과는 원본을 바꾸지 않고 정규화된 오류를 반환한다. 외부 모델이 저장 성공을 대신 판정하지 않는다.

신규 migration 이름은 `0006_home_assistant_persistence.sql`로 계획한다. 구현 시작 시 번호 충돌을 확인한다. H1 데이터가 들어 있는 합성 복제 DB에서 migration·재실행·assertMigrations를 시험한다. 기존 문서는 session으로 남고 기존 원장·감정·경험 기억은 동일해야 한다. schema.ts는 실제 ORM으로 읽는 열을 추가할 때만 맞춘다. 복구는 백업 복원/새 복제 DB 전환이며 운영 DB에 down migration이나 TRUNCATE를 실행하지 않는다.

## 4. 작업 묶음과 건드릴 파일

| 순서 | 기존/신규 파일과 소유 심볼 | 할 일 | 기준 |
|---|---|---|---|
| A1 저장 경계 | 신규 `packages/database/migrations/0006_home_assistant_persistence.sql`; 기존 `packages/database/src/knowledge-store.ts`, `Store.knowledgeDocuments/knowledgeRevision/mutateKnowledge/knowledgeValid/startSession/stopSession/recover` | retention·모음 revision·호환 migration·지속 자료 변경 폐쇄 | P01–P04, P08–P12 |
| A1 명시 정보 | 신규 `packages/contracts/src/personal-facts.ts`, `packages/database/src/personal-fact-store.ts`; 기존 `packages/database/src/store.ts`의 새 CRUD 및 invalidateOutputs/deleteEvent/validResponse/responseContextIn | 저장·수정·삭제·모음 snapshot·출처와 파생 제거. 기존 기억 엔터티를 전용하지 않음 | P05–P12 |
| A2 검색·생성 | 기존 `packages/contracts/src/knowledge.ts`, `ai-ports.ts`, `packages/adapters/src/postgres-knowledge.ts`의 search, `dialogue-request.ts`의 dialogueMaterial/buildDialogueRequest/buildKnowledgeRequest | 지속 자료 조회와 일반 대화의 명시 정보 입력 분리. 근거 전용 생성 보존 | P01–P03, P07–P09, P13 |
| A2 런타임 | 기존 `apps/runtime/src/coordinator/index.ts`의 drain/dispatch, `http/server.ts`의 auth·knowledge 경로와 신규 personal-facts 경로, `index.ts`의 composition; `Store.response/fitResponseConversation/generated/report/recentConversation/readConversation` | 운영자 바인딩, 계수·전송 동일 snapshot, 갱신/취소 barrier, stale ACK 거부 | P07–P13 |
| A2 공급자 결합 | 기존 `packages/adapters/src/openai.ts`, `ollama.ts`의 fitConversation/dialogue | 새 context를 실제 payload 계수·생성에 동일 반영. 모델명·sampling·비용 계산식은 유지 | P07, P09, P13 |
| A3 사용 흐름 | 기존 `apps/studio/src/main.tsx`의 KnowledgePanel/Studio 및 style.css; `scripts/import-knowledge.ts` | 보관 기간 표시·선택, 운영자 자동 연결, 명시 정보 목록·입력·수정·삭제·충돌 표시. CLI `--retention` optional, 기본 session | P01–P06, P10, P14 |
| A3 합성 브라우저 서버 | 기존 `scripts/test-server.ts`의 syntheticKnowledge와 fixture provider 조합; `evals/helpers.ts` | 새 UI의 정보 저장/조회가 합성 공급자로 동작하도록 준비. 운영 fallback은 만들지 않으며 DB 초기화 guard 유지 | P05, P09, P14 |
| A1–A3 검증 | 신규 `evals/persistence-store.test.ts`, `evals/persistence-runtime.test.ts`, `evals/persistence-http.test.ts`, `evals/browser/persistence.spec.ts`, `evals/fixtures/persistence-v1.json`, `evals/persistence-stage.ts`; 기존 `packages/adapters/src/knowledge-dialogue.test.ts`, `evals/knowledge-runtime.test.ts`, conversation/protocol/provider tests와 `evals/db.test.ts` migration 기대값 | 아래 고정 시나리오와 경계·기존 동작 회귀. 완료 증거를 이 문서에 연결 | 전체 |

위 표의 Store 심볼은 `packages/database/src/store.ts`가 소유한다. 신규 표시는 PLAN 당시 기준이며 생성 현황은 §10를 따른다. 삭제 예정 파일은 없다. 공급자별 DB 조회, 새 범용 에이전트 프레임워크, 감정 Core 리팩터링을 끼워 넣지 않는다.

## 5. 성공 기준 — PLAN 당시 NOT VERIFIED, 현재 증거는 §10

| ID | 관찰할 동작·반례 | 필요한 증거  상태 |
|---|---|------|
| P01 | S1 지속 MD/TXT를 S2에서 재가져오기 없이 검색; 임시 자료는 S2에서 조회0 | 실제 PostgreSQL + API + Chrome 새 만남, 저장/출처 ID 대조  NOT VERIFIED |
| P02 | 프로세스 종료·재기동 후 지속 자료·명시 정보의 ID/revision/value 보존, 과거 자막 재생0 | 실제 runtime 프로세스 재시작·DB 전후·Stage ACK  NOT VERIFIED |
| P03 | 기존 H1 자료 자동 승격0, 동일 제목 별도 문서의 근거 혼합0, 원문을 재지정한 지속 등록은 새 ID | migration 전후 표·검색 케이스  NOT VERIFIED |
| P04 | 서로 다른 owner/character 및 종료된 요청 만남은 읽기·쓰기 거부. 위조 identityId는 지속 권한이 되지 않음 | 직접 DB/Store 격리 + HTTP Origin/Bearer/Studio·Stage 역할 거부 시험  NOT VERIFIED |
| P05 | 명시 저장만 생성, 일반 잡담·문서 지시로 저장0. 같은 key 생성 충돌. 성공 알림은 commit 후 | DB 및 브라우저 성공/오류·rollback 시험  NOT VERIFIED |
| P06 | 수정 CAS, 삭제 tombstone, 새 ID 재등록, 멱등 재시도/내용 충돌. 20개·80/300자·32KiB 경계 | DB 병렬 수정·실패 후 원본 동일·HTTP 상태/정규화 오류  NOT VERIFIED |
| P07 | 새 만남의 질문에 저장 진술을 정확히 사용; 무관한 인사에 선호 나열 안 함. 자료 답에 개인값 혼입0 | 공급자 payload 검사와 실제 대사 직접 검수  NOT VERIFIED |
| P08 | 수정·삭제 후 완료된 옛 답과 파생 일반 답·개인 snapshot이 새 생성 문맥에 재유입0 | 세션 간 출처 폐쇄, 최근 대화 읽기·새 provider payload 검사  NOT VERIFIED |
| P09 | 조회/계수/생성/Stage 출력 중 변경, 빈 목록 후 새 저장에서도 stale 발화·ACK 채택0; 다음 입력 가능 | 지연 가능한 합성 공급자와 실제 DB race·Chrome 취소  NOT VERIFIED |
| P10 | DB 오류·CAS 실패·용량 초과에서 성공 표시0, 부분 쓰기0, busy 해제·다음 요청 가능 | 오류 주입 및 후속 정상 요청  NOT VERIFIED |
| P11 | 저장한 문구는 명령권한 없음; 키 출력·파일 읽기·무단 저장/도구 완료 주장0 | 고정 악성 문구 fixture·payload·실제 대사; no tool 권한 정적 확인  NOT VERIFIED |
| P12 | H1 데이터가 있는 DB 업그레이드/재실행 성공, 감정·경험 기억·과거 migration checksum 보존, 복제본 복원 확인 | migration 전후 값·checksum·백업 복원 및 assertMigrations  NOT VERIFIED |
| P13 | 감정 자연 감쇠·숨김·침묵·말투 지속 및 H1 근거 답변 보존; 계수와 실제 전송의 정보 snapshot 동일 | 기존 회귀 + 새 payload/assertion. 동일 초기상태·시간에서 비교  NOT VERIFIED |
| P14 | 사용자 ID 입력 없이 저장·새 만남·수정·삭제 가능. 390px 화면 넘침0, 미저장/실패를 저장완료로 표시 안 함 | 실제 Chrome 화면과 네트워크 결과  NOT VERIFIED |
| P15 | 최초8장면 + P07의 무관 인사1장면, 총9장면의 답·근거·취소·표시 확인, 비용·p50/p95 기록, 실패 포함 보존 후 사용자 수용 | 아래 실제 실행과 결과 검수. 단순 문자열/인용 ID 검사만으로 의미 PASS 불가  NOT VERIFIED |

P01–P14의 로컬 gate 통과 전 실제 API 검증으로 넘어가지 않는다. 오류를 반복 수정하는 같은 문제는3회 후 원인·남은 기준을 기록해 재결정한다. 필수 실패를 무시해 다음 묶음 완료로 처리하지 않는다.

## 6. 고정 평가 흐름과 실행 방법

합성 fixture에 아래 흐름과 정답을 구현 전에 고정한다. A/B는 격리 검사 전용이며 사용자에게 수동 가족 선택을 요구하는 UX가 아니다.

1. 운영자 A가 ‘음료 선호=보리차’ 저장. 일반 대화의 선호 질문에 보리차.
2. 새 만남에서 같은 질문에 보리차; 별도 B에는 없음. 임시 문서 제외, 지속 문서 포함.
3. runtime 재시작 후 다시 보리차. 지난 답변 자동 재생0.
4. 루이보스차로 정정. 새 답에는 루이보스차, 이전 개인값을 사용한 답·snapshot은 문맥에서 제거.
5. 삭제 후 저장된 선호 없음. 생성 중 수정·삭제, CAS/DB 실패, 빈 모음에 저장 경합도 별도 재현.
6. 합성 설명서를 지속 보관으로 등록한 뒤 새 만남에서6개월 답과 출처.
7. 설명서를12개월로 교체하고 통제된 불편/숨김 조건에서도12개월·정해진 격식으로 전달.
8. 설명서 삭제 뒤 확인 불가. 비슷한 제품/악성 문구 자료를 함께 두고 옛6/12개월 답 복구·개인값 보완·문서 명령 실행 없음.

최초 PLAN은 위1–8을 각각1회, 판단5회·생성8회로 잡았다. BUILD에서 P07의 무관 인사 반례가 이8개에 없음을 확인해 1 직후 ‘안녕!’1건을 추가했다. 기존8개는 삭제하지 않으며 현재 제안 범위는 총9장면, 판단 최대6회·생성9회·계수18회다. 자연 질문이나 인사가 침묵으로 처리되면 결과를 실패/미검증으로 기록하고 강제 발화로 바꿔 PASS 처리하지 않는다. 나머지 경합·권한·오류 반례는 합성 공급자·DB/브라우저에서 집중 검증한다. 7의 감정과 숨김은 명시적 시험 통제 조건이며 자연 도달로 주장하지 않는다.

현재 승인 총상한은 USD3.50, H1 종료 시 guard 잔여0.3846942였으나 실행 직전 원장 재확인이 필요하다. 이전 ‘12건 실행’ 승인은 소진된 H1 범위이므로 새9건의 실제 호출은 요청 크기·계수 예약·최대 횟수를 제시해 승인받은 뒤 진행한다. 상한 증액도 별도 승인 전 적용하지 않는다. preflight/rehearsal은 키를 열거나 실제 원장을 변경하지 않는다. 로컬/합성 검증에는 유료 호출이 없다.

cwd는 저장소 루트. 기존 Node/pnpm, 기존 별도 로컬 저장소 PostgreSQL과 Chrome을 사용한다. 결과·새 테스트 DB·UI 빌드·임시 파일은 `${ARTIFACT_ROOT}/home-assistant-h2a-YYYYMMDD/`에 둔다. `evals/helpers.ts`의 전용 DB 검증을 유지하고 기존 conversation-v1 테스트 프로필의 합성 DB만 초기화한다. 실제 사용 DB와 H1 증거 DB는 초기화하지 않는다.

계획한 명령(아직 실행하지 않음):

```powershell
pnpm typecheck
node --env-file=${ARTIFACT_ROOT}/conversation-v1/test.env node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts evals/persistence-store.test.ts evals/persistence-runtime.test.ts evals/persistence-http.test.ts
node --env-file=${ARTIFACT_ROOT}/conversation-v1/test.env node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts evals/knowledge-store.test.ts evals/knowledge-runtime.test.ts evals/knowledge-http.test.ts evals/knowledge-retrieval.test.ts evals/conversation-context.test.ts evals/provider-boundaries.test.ts evals/protocol.test.ts evals/db.test.ts
pnpm test:unit
pnpm exec playwright test --config playwright.config.ts evals/browser/persistence.spec.ts evals/browser/knowledge.spec.ts
```

Chrome 실행 전 새 H2-A 빌드를 별도 로컬 저장소에 만들고 기존 Playwright 설정의 출력·서버 환경을 그 빌드와 전용 합성 DB로 지정한다. 기본값이 운영 DB/C: 아티팩트로 향하면 실행하지 않는다. §11의9건 harness는 명시적 preflight/rehearsal/live 옵션·신규 증거 폴더·실패 시 중단·원장 보존을 사용한다. 모의 응답 리허설을 실제 공급자 품질 PASS로 바꾸지 않는다.

## 7. 감사 초점과 문서 인계

핵심 감사점은 지속 자료의 원래 session_id를 조회 권한으로 오해하는 경우, legacy snapshot의 필드 부재로 지속 권한을 넓히는 경우, 개인정보 조회를 기존 memories 우선순위 정렬에 맡기는 경우, 과거 만남의 파생 답변을 삭제 폐쇄에서 놓치는 경우, 저장/수정 payload가 로그·멱등 event에 원문으로 중복 남는 경우다. 검증용 운영자와 실제 가족 인증을 혼동하지 않는다.

PLAN 작성 당시에는 문서만 수정했다. 이후 BUILD 상태는 §10를 따른다. 유료 호출·게시 권한을 확대하지 않으며 H1 수용·게시 사실과 H1-F01 후속을 보존한다.

BUILD 인계: “docs/HOME_ASSISTANT_H2A_PLAN.md의 A1→A2→A3을 구현하고 P01–P14를 검증해. 실제 API P15는 준비된 요청 범위·비용을 확인한 뒤 승인받아 실행해. H1과 기존 감정 경계를 보존하고 결과를 같은 문서에 추가해.”

## 8. MyCemory 규약 참고 — 2026-10-17

사용자가 제안한 `${LOCAL_AI_ROOT}/codex/workspaces/mycemory`의 README, SCHEMA, INTEGRATE, APPROVE를 참고했다. 직접 관련되는 `mycemory/retrieval.py`의 ReadService와 `consumer.py`의 run_grounded_report도 정적으로 확인했다. 해당 프로젝트의 실행·품질·보안을 새로 검증한 것은 아니다. 아래는 규약의 선택적 적용이며 라이브러리 설치, 볼트 읽기, 서비스 연결 또는 자동 수집 승인이 아니다.

| 참고 근거 | H2-A 적용과 이유 | 기존 성공 기준의 구체 반례 |
|---|---|---|
| APPROVE A01–A02: 모델에 저장·정정 권한 없음, 사람 저장을 다시 승인시키지 않음 | 기존 명시 저장 UI와 서버의 owner·CAS 검사를 유지한다. 모델은 저장 진술을 읽을 뿐 사용자 정정을 덮어쓰지 않는다 | P05/P06/P11: 문서·모델이 저장/정정을 요구해도 DB 변화0; 사용자의 한 번 저장은 commit 후 완료 표시 |
| SCHEMA S07.1, consumer.py: 검색과 후속 읽기의 snapshot/revision 고정 | H2-A의 session/library/personal revision으로 계수·생성·출력의 같은 근거를 검증한다. 유효하지 않은 근거를 최신 값으로 몰래 바꾸지 않는다 | P08/P09/P13: 조회 뒤 수정·삭제 또는 빈 모음에 추가되면 옛 결과를 출력하지 않고 다음 새 요청은 정상 처리 |
| SCHEMA S06, ReadService._finish: 과거 자료에도 현재 접근 제한 적용 | H2-A에서는 삭제·owner 검사와 파생 응답 무효화로 적용한다. 현재 없는 범용 정책 엔진이나 policy_revision을 추가하지 않는다 | P04/P08/P09: 종료 만남·다른 owner·삭제한 정보의 옛 snapshot이 권한을 되살리지 않음 |
| SCHEMA S04–S05, S00.3: 저장/확인/실행 상태와 의미 품질을 구분 | 사용자 진술을 검증된 외부 사실·실행 완료·새 감정 사건으로 취급하지 않는다. 문장 속 부정·조건을 그대로 전달한다 | P07/P11/P13: ‘카페인 없는 차만 선호’의 조건 보존; ‘조명을 끌 예정’ 저장만으로 실제 제어 완료나 감정 변화 주장0 |
| APPROVE A07: 중복 요청과 불확실한 결과 처리 | 기존 멱등 키·CAS·transaction을 사용한다. 재시도는 같은 결과를 돌려주며 삭제 뒤 옛 저장 요청이 항목을 복원하지 않는다 | P05/P06/P10: commit 응답 유실 뒤 같은 요청 재시도에도 중복 생성0; 다른 payload는 충돌, 실패를 저장 성공으로 표시하지 않음 |

**가져오지 않는 부분.** MyCemory의 자동 추출·충돌 심사·승인 대기열은 현재 명시 입력20개 범위에 필요하지 않다. 같은 정보를 두 저장소에 쓰지 않는다. Git의 원문·수정 이력 보존과 source 철회는 H2-A의 value 삭제·개인 snapshot 제거와 의미가 다르므로 개인정보 삭제 구현으로 대체하지 않는다. 보고서를 근거 인용으로 조립하는 방식도 감정 캐릭터의 일상 대사 전체에 적용하지 않는다.

**후속 연동 후보.** H2-A 완료 후 필요하면 기존 검색 port 뒤의 읽기 전용 adapter로 MyCemory를 평가한다. 정본은 MyCemory 한 곳에 두고 source ID/revision·현재 권한·정정/조건을 전달한다. 검색 접근 권한과 외부 모델 전송 권한은 별개로 확인해야 한다. 자료를 허용하지 않은 공급자로 전송하거나 실패 시 제한 없는 로컬 복사본으로 대체해서는 안 된다. 이는 미구현 후속 설계이며 이번에는 개인 자료나 MyCemory 볼트를 읽지 않고 합성 자료만 사용한다.

## 9. BUILD 중간 확인 — MyCemory 참고 시점

A1의 migration0006, personal-facts 계약/저장 모듈, 지속 자료 조회·revision 검사와 저장 검사를 작성했다. 일반 대화의 personal snapshot 연결, 운영자 HTTP 바인딩, UI와 종단 검증은 아직 남았다. 저장 모듈 존재만으로 P01–P15 완료를 선언하지 않는다.

기존 실행 결과 `${ARTIFACT_ROOT}/home-assistant-h2a-20261017/a1-storage-r2.json`을 확인했다. persistence-store 및 H1 knowledge 저장/런타임/HTTP/검색의 합계50건 중49 PASS, 1 FAIL이다. 실패는 P01/P03의 다른 만남에 속한 임시 문서 수정에서 기대 오류 `knowledge_not_found`와 실제 `knowledge_revision_conflict`가 다른 경우다. 오류 계약을 확인한 뒤 수정·재검증해야 하며 이 기록은 해결 완료를 뜻하지 않는다. r1은 포트 연결 실패로 시험을 수행하지 못했으며 r2와 구분한다. MyCemory 참고 작업에서는 제품 코드·DB·API 호출을 추가 변경하지 않았다.

## 10. A1–A3 구현과 로컬 검증 중간 결과 — 2026-10-17

미커밋 BUILD다. 신규0006·명시 정보 저장·지속 자료 검색·개인 snapshot/출처·생성/ACK 검증·삭제 폐쇄·운영자 HTTP/WS 바인딩·Studio·CLI를 연결했다. 개인정보 UI는 main.tsx에 긴 폼을 추가하는 대신 `apps/studio/src/personal-facts.tsx`로 분리했다. 감정 Core와 공급자 모델/가격/예산은 바꾸지 않았다. 유료 호출0, 운영 DB/실행 프로필 변경0, 커밋/게시0이다.

증거 루트는 `${ARTIFACT_ROOT}/home-assistant-h2a-20261017/`다. 실제 프로세스 재시작과 백업 복원은 별도 `evals/persistence-restart.test.ts`, fixture 전용 worker 및 `evals/persistence-backup.test.ts`로 추가했다. worker는 실제 Node 서버/Store/HTTP/WS를 사용하지만 판단·생성은 합성 공급자다. 운영자 연결을 시험하며 실제 가족 인증을 주장하지 않는다.

| 검사 | 실제 결과와 범위 | 증거 파일 |
|---|---|---|
| 저장·snapshot·H1 저장/런타임/HTTP/검색 | 57/57 PASS | a2-snapshot-r1.json |
| 운영자 HTTP + 기존 HTTP/WS | 32/32 PASS | a2-http-r1.json |
| 단위 전체 | 초회472/473. 새 OpenAI fixture가 필수 content 필드를 누락해1실패. fixture 보정 후 관련3/3 PASS. 전체를 다시 실행한 결과로 합치지 않음 | unit-r1.json, personal-unit-r2.json |
| 지정 대화·공급자·프로토콜·DB 및 H2-A | 초회142/143. 기존 삭제 후 문맥 점검 API를 새 예외로 막은 회귀1건. 생성 차단은 유지하고 개인 snapshot이 제거된 조회를 허용한 뒤 DB/개인 런타임78/78 PASS | a2-regression-r1.json, context-compat-r2.json |
| 개인 정보 파생 판단·침묵 이유 제거와 실제 백업 복원 | 13/13 PASS. pg_dump/pg_restore는 합성 UUID 스키마만 사용; H1 경험 기억·원문·상태·옛 checksum 보존 | closure-backup-r1.json |
| 다른 character 격리와 실제 프로세스 재시작 | 저장10건 + 재시작1건 PASS. 강제 종료/정상 종료, 새 Stage shown/finished ACK, WS 상대 위조 거부 | isolation-restart-r2.json |
| 개인 snapshot·생성 경합·지속 자료 세션 간 무효화 최종 집중 | 13/13 PASS | persistence-runtime-r3.json |
| 실제 Chrome H2-A | 초회는 존재하지 않는 버튼 이름을 기다린 테스트 실패. 현재 버튼명으로 고친 뒤1/1 PASS. 저장/실패 입력 보존/CAS/새 만남/지속·임시 자료/Stage 삭제/390px 넘침0 | browser-r1.json, browser-r2.json |
| 실제 Chrome H1 회귀 | 합성 상대 전용 구성에서1/1 PASS. 출처·교체·삭제·상대별 자료 격리 | h1-browser-r1.json |
| 타입·UI 빌드 | 타입 PASS, UI 빌드 성공. mobile/Stage PNG 직접 확인 | ui-r1, browser-r2/playwright-results |

원래 A1 r1 연결 실패와 r2의49/50은 §9에 보존한다. 수정 회수는 같은 결함 기준으로 각각1회이며 독립 감사는 아직 하지 않았다. 실시간 모델의 의미 품질은 합성 텍스트나 mock token counter로 인증하지 않는다. 새 `evals/fixtures/persistence-v1.json`은 §6의8장면·정답·반례를 구체화했으며 실제 API 실행 전 고정했다. 구현 전에 고정 완료했다고 소급 주장하지 않는다.

| 기준 | 현재 판정 | 남은 확인 |
|---|---|---|
| P01–P06 | 로컬 PASS | 운영 DB 배치는 별도이며 실제 사용자 자료 미사용 |
| P07 | PARTIAL | 실제 모델의 선호 사용·무관 질문 비노출은 아직 미검증. payload 보존만 확인 |
| P08–P10 | 로컬 PASS | 최초8장면과 추가 인사1장면의 사용자 가시 결과도 P15에서 확인 |
| P11 | PARTIAL | 권한/명령 구분 지침·payload 및 no-tool 경계 확인. 실제 모델의 악성 문구 대응은 미검증 |
| P12 | 로컬 PASS | 운영 데이터 백업/복원·저장장치 고장 검증을 뜻하지 않음 |
| P13 | PARTIAL | 기존 감정/말투 회귀와 OpenAI/Ollama 계수·전송 일치 통과. 실제 새 문맥의 말투는 P15에서 검수 |
| P14 | 로컬 PASS | Chrome 합성 흐름과390px 화면 범위 |
| P15 | NOT VERIFIED | §11의 harness/preflight 준비 이후 새 호출 승인·실제9장면·비용/지연·대사 검수·사용자 수용 |

이 시점 이후 harness 준비는 §11에서 이어간다. 실제 의미 품질을 요구하는 P07/P11/P13의 로컬 부분과 P15의 실제 부분을 구분한다. 로컬 gate 통과가 실제 부분 PASS를 뜻하지 않는다. MyCemory 자동 수집/연동, 음성/가족/IoT와 H1-F01은 추가하지 않는다. 승인 전 호출하지 않으며 원래 H1 실패·원장·과거 unknown을 유지한다.

## 11. 실제 검증 도구 준비 — 2026-10-17

`evals/persistence-stage.ts`와 평가 전용 `persistence-stage-runtime.ts`를 추가했다. 기존8개 + 저장 직후 무관 인사1개를 고정하고 악성 합성 진술/책상 자료를 함께 등록한다. 외부 호출 내용은 합성 자료뿐이며 개인 파일·실제 비밀값을 모델 입력에 넣지 않는다. 정상 앱에 시험 분기를 추가하지 않았다.

- 실제 저장소·migration·HTTP·WS·운영자·OpenAI 어댑터·Chrome Stage 경로를 사용한다. rehearsal만 어댑터의 HTTP 응답을 모의 처리하며 키 파일을 읽지 않는다. 계수도 모의300토큰이므로 모델 품질이나 실제 토큰 수의 증거가 아니다.
- 새 만남과 실제 서버 종료/재시작, 정보 수정/삭제, 지속 자료 수정/삭제, 자막과 shown/finished ACK, 현재 출처와 화면 표시, 요청 전후 저장 데이터 불변을 검사한다. 자동 재시도나 실패 장면 교체는 없다.
- 7번 장면의 부정 감정은 기록된 합성 판단으로 만든다. 형식적 말투의 계획이 생긴 뒤, 계수 전에 해당 planned 응답 하나의 concealAffect를 명시적으로 켠다. 생성 요청과 DB 계획을 같이 고정하며 Stage neutral과 formal을 확인한다. 이는 숨김 전달 계약 시험이지 실제 판단 모델이 스스로 숨김을 선택했다는 증거가 아니다.
- 최대 생성9·판단6·계수18회는 기존 누적 횟수에 더한 제한이다. 별도 모의 원장 외 실제 원장을 수정하지 않으며 과거 unknown2건도 유지한다. 공급자 오류·추가 unknown·상한 도달 시 중단한다.
- preflight는 리허설과 현재 소스/빌드 해시 일치를 요구한다. 요청 바이트 기준 전체 예약 합계에25% 여유와 계수 추가6회 여유를 더한 계획 추정치를 제시한다. 이는 청구액도 수학적 최댓값도 아니며 실제 개별 호출은 기존 원장 guard로 제한한다.

리허설 r1은 Decisions 모의 usage의 필수 필드 누락으로 첫 판단 뒤 중단됐다. 실제 원장 불변을 확인했고 실패 원장도 보존했다. 필드를 보정한 r2는9/9장면, 계수12·생성9·판단6, 프로세스 종료 PASS다. r3는 출처의 실제 화면 표시 검사를 추가해9/9 PASS, 계수12·생성9·판단6, 실제 원장 불변·자식 프로세스 종료를 재확인했다. 숨김 장면 PNG에서12개월 대사와 현재 문서 버전2의 출처가 보이는 것도 직접 확인했다. 타입 검사와 git diff --check도 통과했다. 증거는 `${ARTIFACT_ROOT}/home-assistant-h2a-rehearsal-20261017-r1/`부터 각 폴더의 results.json·PNG·source에 보존한다. 유료 실행은 아직 없고 P07/P11/P13 의미 품질·P15는 미검증이다.

현재 preflight는 r3 폴더의 `preflight.json`이다. 기존 총상한3.50, 누적 guard3.1153058, 잔여0.3846942, 리허설 요청 전체 예약 합계0.3044304, 여유를 포함한 계획 추정0.473763이다. 따라서 총상한3.60 및 실제9장면 실행을 새로 요청했다. 아직 답변 대기이며 키 파일·실제 원장·운영 프로필 변경0이다. 승인되면 원장 전체를 백업하고 과거 entries를 그대로 둔 채 limitUsd만 승인값으로 변경한 뒤 preflight를 다시 실행한다. 승인 없이 live 실행이나 상한 변경을 하지 않는다. 자동으로 새 한도를 기록하는 코드는 없다.

```powershell
node --experimental-transform-types evals/persistence-stage.ts --preflight --attempt r3
# 아래는 새 실제 호출 승인 이후에만 실행한다. 기존 폴더가 있으면 덮어쓰지 않는다.
node --experimental-transform-types evals/persistence-stage.ts --live --attempt r3 --synthetic-inputs --allow-paid-providers
```
