# AI Character Runtime — 구현 계획

작성일: 2026-09-27  
계획 버전: `implementation-v1`  
상태 (2026-10-03): P00/P01/P06 DONE. P02–P05 BLOCKED(실제 자원/음성 선택), P07–P15 IN_PROGRESS(텍스트 경로 구현 및 대표 검사 PASS), P16–P19 NOT_STARTED(P05 gate), P20 BLOCKED, P21 IN_PROGRESS. 상세 근거: [BUILD 인계](./BUILD_HANDOFF.md), [실행 문서](./RUNBOOK.md).

현재 작업 (2026-10-04): **Jev는 MVP 필수 구성이다.** 사용자가 기존 제외 결정을 바로잡았다. PLAN 이후 사용자가 개발을 승인해 BUILD를 진행했다. 실제 Jev API는 별도 비용·전송 승인 및 예산 전까지 호출하지 않는다. 바로 이어서 개발할 범위·계약·검사는 [§14 Jev 필수 복원 개발 계획](#14-jev-필수-복원-개발-계획)에 정리했다. 앞선 로컬 전용 계획과 다른 명세의 Jev 제외 문구는 당시 결정의 기록이며, 이번 작업의 요구사항을 대신하지 않는다. 유료 호출은 아직 승인되지 않았다.

관련 문서: [MVP 범위](./MVP_SPEC.md), [캐릭터 preset](./CHARACTER_PRESET.md), [도메인 규칙](./CHARACTER_DOMAIN_SPEC.md), [로컬 AI](./LOCAL_AI_INTEGRATION.md), [DB 설계](./DATABASE_SPEC.md), [런타임 통신](./RUNTIME_PROTOCOL.md), [검증 계획](./VALIDATION_PLAN.md), [기술 설계](./technical_architecture_v1.md)

## 1. 첫 구현 목표와 순서

**첫 제품 동작은 입력 한 건이 관측되고, 상태에 한 번 적용되어 저장되며, 재시작 후에도 이어지는 것**이다. 그 전에 현재 PC에서 실제 로컬 모델·음성 환경이 작동하는지 작은 실험으로 확인한다.

큰 틀은 다음 순서를 따른다.

```mermaid
flowchart LR
    A[기반 구성과 로컬 AI 확인] --> B[저장 가능한 텍스트 캐릭터]
    B --> C[퍼즐·관계·기억·다음 만남]
    C --> D[실제 음성·VRM·OBS]
    D --> E[통합 검증과 실행 문서]
```

처음부터 아바타 동작이나 방송 연출을 완성하지 않는다. 핵심 경험이 실제로 저장되는 경로를 먼저 만든 뒤 동일한 출력 계획을 음성과 표정으로 표현한다. 문서에 등장하는 모든 확장 기능을 구현하지 않고 F01–F25만 완료한다.

실행 순서의 기본 경로는 P00→P01→P02/P03/P04→P05→P06–P10→P11–P15→P16–P19→P20→P21이다. `/`로 묶은 작업은 선행 조건이 같다는 뜻이며 여러 agent를 실행하라는 지시가 아니다. 실제 추론은 단일 GPU 슬롯 규칙을 지킨다.

## 2. 문서와 코드의 책임

| 판단할 내용 | 기준 |
|---|---|
| 포함 기능·제외 기능·완료 범위 | MVP_SPEC |
| 말투·기억을 드러내는 방식 | CHARACTER_PRESET |
| 감정·관계·활동·Agenda 계산 | CHARACTER_DOMAIN_SPEC |
| provider·worker 입출력과 자원 제한 | LOCAL_AI_INTEGRATION |
| 테이블·키·정정·복구 | DATABASE_SPEC |
| Studio·Stage·HTTP/WS·전달 보고 | RUNTIME_PROTOCOL |
| 합격 판정과 성능 문턱 | VALIDATION_PLAN |
| 작업 의존성·산출물·개발 순서 | 이 문서 |

초기 기술 설계보다 구체적인 명세를 우선한다. 충돌을 발견하면 실제 행동에 영향을 주는 한 가지 결정을 해당 원본 문서에 반영하고 직접 연결된 설명을 맞춘다. 서로 다른 세 종류의 메시지·epoch·상태 이름을 코드에 동시에 남기지 않는다.

검증 ID는 검사 결과를 연결하는 이름이다. 문서에 ID가 있다는 사실이나 fake provider 통과를 실제 모델·OBS 검증 통과로 표시하지 않는다.

## 3. 생성할 코드 구조

```text
apps/
  runtime/src/
    http/                  API·인증·음성 파일 전송
    ws/                    연결·메시지 순서·snapshot
    coordinator/           mailbox·commit·작업 dispatch·취소
    output/                출력 소유권·segment·전달 기록
    tasks/                 종료 정리·lease
  studio/src/
    studio/                입력·활동·상태·기억·준비 화면
    stage/                 VRM·자막·AudioContext
packages/
  contracts/src/           Zod·DTO·ID·버전 직렬화
  character-core/src/      순수 reducer·주의·관계·표현·Agenda
  database/src/            Drizzle schema·queries·transactions
  database/migrations/    검토된 SQL
  adapters/src/            Ollama·Python worker 연결·퍼즐 검증기
workers/
  tts/                     기존 OmniVoice 환경의 Python wrapper
  stt/                     별도 환경의 STT wrapper
character-presets/         curious-puzzle-v1 설정
fixtures/puzzles/          문제 3개·검증기용 비공개 정답 자료
evals/                    개발/최종 입력·rubric·검사 실행기
scripts/                  환경 진단·로컬 실험·실행 보조
validation/runs/           버전별 측정·검증 결과
runtime-data/tmp/          재생·전사용 임시 파일, 버전 관리 제외
```

해당 작업을 시작할 때 필요한 폴더만 만든다. 기존 명세 파일은 루트에 유지하며 문서 정리를 위해 지금 이동하지 않는다. Python 가상환경·모델·참조 음성·DB 데이터·원문 로그는 Git에 넣지 않는다. 검증 결과도 원문·음성 없는 작은 요약만 명시적으로 선택해 관리한다.

의존성 방향:

- contracts는 DB·브라우저·모델 실행기에 의존하지 않는다.
- character-core는 contracts와 순수 설정만 사용한다. 시간·유효 근거·현재 상태는 외부에서 전달한다.
- database와 adapters는 Core의 상태를 직접 변경하지 않는다.
- runtime이 입력·DB·Core·adapter를 조정한다. 모델을 기다리며 트랜잭션을 열어 두지 않는다.
- studio/stage는 공개 DTO만 사용한다. database·서버용 퍼즐 fixture를 import하지 않는다.

MVP Core는 결정적이므로 난수 인자를 추가하지 않는다. HTTP/WS JSON과 worker JSONL의 bigint는 십진 문자열로 변환하고, 작은 ms·sample rate와 혼동하지 않는다.

## 4. 작업 목록과 상태

2026-10-03 현재 P00/P01/P06은 `DONE`, P02–P05/P20은 `BLOCKED`, P07–P15/P21은 `IN_PROGRESS`, P16–P19는 `NOT_STARTED`다. 실제 PostgreSQL 텍스트 경로/대표 관계·기억·Agenda 검사와 합성 provider 브라우저 시연을 확인했다. 실제 모델/음성/전체 검증은 완료가 아니며 performance gate는 UNFROZEN이다. 정확한 작업별 근거와 남은 경계는 [BUILD_HANDOFF.md](./BUILD_HANDOFF.md)를 읽는다.

| 완료 작업 | 확인한 결과 |
|---|---|
| P00 | pnpm workspace·TypeScript·contracts·Zod·Vitest 구성. Node 22.19.0, pnpm 11.9.0에서 `pnpm typecheck`와 `pnpm test:unit` 9개 통과 |
| P01 | `.env.example`과 읽기 전용 `pnpm diagnose` 실행. DB 미설정·Ollama API 연결 불가·TTS Python 존재와 snapshot 메타데이터 후보 2개·STT 미설정을 구분 |

2026-09-27 기준 실제 모델 추론·DB 연결·TTS 합성은 실행하지 않았다. `pnpm diagnose`의 파일 존재·포트 상태를 기능 준비 완료로 해석하지 않는다. 현재 디렉터리는 Git 저장소가 아니다.

### M0 — 기반과 로컬 실행 가능성

| ID | 작업·산출물 | 선행 | 완료 기준 |
|---|---|---|---|
| P00 | pnpm workspace·TypeScript 설정·최소 contracts·검사 runner | 없음 | 필요한 package만 생성, typecheck·최소 계약 검사 실행 가능 |
| P01 | 환경 진단·비밀값 없는 설정 예시·준비 상태 | P00 | 실제 설치 경로·모델·DB 준비 여부와 누락을 구분, 자동 다운로드 없음 |
| P02 | Ollama adapter·token counter·실제 구조화/대사 실험 | P01 | 로컬 Qwen 해석·대사·풀이 후보 호출 성공, tokenizer 예산·오류 처리 확인 |
| P03 | 기존 OmniVoice wrapper의 최소 합성 실험 | P01 | 선택한 참조 음성으로 유효 WAV 생성, sample rate·소요 시간·VRAM 기록 |
| P04 | 별도 STT 환경·최소 전사 실험 | P01 | 짧은 한국어 WAV를 CPU int8로 전사, 빈 입력·누락 모델 처리 |
| P05 | 직렬 추론·자원 파일럿·성능 gate 고정 | P02, P03, P04 | 실제 연결 실험·공존 VRAM 측정·설정 고정, 검증 계획 gate가 FROZEN |

### M1 — 저장 가능한 텍스트 캐릭터

| ID | 작업·산출물 | 선행 | 완료 기준 |
|---|---|---|---|
| P06 | DB M1 schema·migration·기본 seed·명령 중복 키 | P00, P01 | 실제 PostgreSQL에 생성·재실행·rollback·빈 DB 복원 검사 |
| P07 | 상태 reducer·주의·시간·초기 행동·표현 규칙 | P00 | 해당 D 검사와 주의/표현 경계 검사 통과, DB 없이 실행 가능 |
| P08 | runtime coordinator·상태 commit·Ollama 연결 | P02, P06, P07 | 입력 하나를 한 번만 적용, stale 결과 폐기, commit 후만 출력 |
| P09 | 인증·HTTP/WS·snapshot·text segment/ACK | P06, P08 | 역할별 접근·명령 재시도·단일 출력 권한의 텍스트 경로 작동 |
| P10 | 최소 Studio·자막 Stage·실제 텍스트 시연 | P09 | A/B/C 입력·상태·선택 이유·오류 표시, 재시작 후 상태 유지 |

### M2 — 경험이 다음 행동으로 연결

| ID | 작업·산출물 | 선행 | 완료 기준 |
|---|---|---|---|
| P11 | 퍼즐 schema·fixture 3개·활동 adapter·풀이 | P08, P10 | 실제 후보 제출→검증 결과, 정답 비노출·힌트/시도 한도·재개 유지 |
| P12 | 관계 evidence·source group·일일/반복 집계 | P11 | 같은 도움 중복 증가 없음, 날짜/독립 근거·재계산 검사 통과 |
| P13 | 사실 기억 생성·출처·검색·종료 정리 task | P12 | 중요 사실 즉시 저장, 종료 정리 멱등성·lease·5개/600 tokens 제한 |
| P14 | Agenda 생성·예약·전달·수락/거절·재개 | P13 | 세션당 한 번, 실제 완전 전달 뒤 offered, 기존 활동 재개 |
| P15 | 기억/원본 정정·삭제·관계 재집계·출력 무효화 | P14 | 삭제 두 종류 구분, 파생 자료 정리·재생성 방지·경합 검사 |

### M3 — 음성·아바타·운영 복구

| ID | 작업·산출물 | 선행 | 완료 기준 |
|---|---|---|---|
| P16 | production worker 계약·통합 scheduler·실패 복구 | P03, P04, P05, P08, P15 | TTS/STT JSONL·단일 GPU 슬롯·timeout·소유 worker 정리·늦은 결과 폐기 |
| P17 | 마이크 capture·WAV 업로드·전사·입력 취소 | P09, P16 | start/end 순서, 실제 sample rate 변환, 최종 발화만 입력, 기존 출력 취소 |
| P18 | VRM Stage·음성 재생·OBS·전달 보고 | P14, P16, P17 | 실제 표정·자막·입 움직임·음성, 단일 소유권·즉시 취소·재접속 |
| P19 | 전체 재시작·삭제·장애·backpressure 통합 | P15, P18 | DB/통신 장애 경계·복구·출력 unknown·오프라인 검증 통과 |

### M4 — 검증과 인계

| ID | 작업·산출물 | 선행 | 완료 기준 |
|---|---|---|---|
| P20 | 실제 모델 품질·고정 성능·세 세션·20분 결과 | P19 | 검증 계획의 필수 항목 PASS, F01–F25 증거, 알려진 제한 기록 |
| P21 | RUNBOOK·실행/종료/백업/복원 절차·최종 인계 | P20 | 문서의 실제 명령을 확인한 로컬 실행, 경로/버전/검증 결과 연결 |

P00–P21은 22개 작업이다. 작업 하나가 반드시 commit 하나라는 뜻은 아니다. 수정·검증 가능한 작은 단위로 나누되 같은 행동 계약을 여러 번 다른 형태로 구현하지 않는다.

## 5. M0의 실제 진행 방법

### 5.1 P00–P01: 먼저 확인할 것

현재 workspace에는 기획·명세 문서가 있다. Node·pnpm·PostgreSQL 설치·DB 계정·개발용 package lock 존재를 가정하지 않고 필요한 범위만 확인한다. Git 저장소 여부도 착수 시 확인하고 기존 저장소가 있으면 사용자 변경을 보존한다. 원격 저장소 생성·push는 첫 작업의 필수 조건이 아니다.

프로젝트 설정 검사기는 다음을 나눠 보여 준다.

- 파일/프로세스 존재와 실제 로드 가능 상태.
- 설치된 Ollama 모델과 허용한 local 모델.
- OmniVoice Python·snapshot·audio tokenizer·참조 음성·전사문.
- STT 전용 환경과 CTranslate2 형식 모델.
- tokenizer 계수 준비 상태, DB 접속·schema 상태.

누락됐다고 자동 다운로드·자동 환경 업그레이드·Gradio 데모 실행을 하지 않는다. 필요한 무료 의존성 준비는 구체적인 파일·용량·설치 대상이 정해진 단계에서 수행한다. 유료 fallback 설정은 만들지 않는다.

### 5.2 P02–P04: 버리지 않을 작은 adapter

P02는 production에서 사용할 Ollama adapter로 실제 한 건을 호출한다. 별도 LangChain/LangGraph 계층을 먼저 만들지 않는다. JSON schema·출처 ID·token 예산·timeout·abort와 계산 종료의 차이를 검사한다.

P03은 `J:\ai\omnivoice tts\omnivoice-env\Scripts\python.exe`에서 프로젝트 wrapper를 실행한다. 기존 `run_omnivoice.bat`를 수정하지 않는다. 참조 음성·전사문은 사용자가 선택한 preset이 있어야 실제 음색을 고정할 수 있다. 미선택이면 TTS 작업만 BLOCKED로 표시하고 독립된 텍스트·DB 작업은 계속할 수 있다.

P04는 별도 환경에서 WAV 입력→최종 전사만 연결한다. 마이크 UI·부분 전사·자동 VAD는 이 단계에 추가하지 않는다. 정상 입력과 무음 fixture를 구분하고 실제 녹음 품질은 P17에서 확인한다.

실험용 CLI는 adapters/worker의 실제 함수를 호출한다. 이후 UI 연결 때 같은 provider를 다시 만드는 구조를 피한다. 미완성 UI 없이도 진단을 실행할 수 있게 하되 실험 전용 코드에 DB 상태 변경을 넣지 않는다.

### 5.3 P05: 자원과 성능 판단

Qwen 단독, OmniVoice 단독, 두 모델 상주, 직렬 해석→대사→합성, CPU STT 병행을 순서대로 측정한다. 모델 파일 크기를 VRAM 피크로 간주하지 않는다. 본격 Stage 전에는 작은 재생 probe로 오디오 경로를 확인하고, OBS/VRM이 준비되면 렌더 부하를 포함한 최종 결과는 P18–P20에서 다시 측정한다.

메모리가 부족하면 기존 불필요한 데모의 상태 확인, context·출력 길이, CPU 배치, 더 작은 무료 모델 순으로 검토한다. 다른 앱을 무차별 종료하거나 GPU 메모리 부족을 무한 재시도로 해결하지 않는다.

M0 결과는 파일럿이며 최종 검증 표본에 합치지 않는다. 검증 계획의 gate version·고정 시각·측정 run ID·config hash·합격 문턱을 기록해야 P05가 DONE이다. P05가 미완료여도 독립적인 P06–P15 구현은 가능하지만 **M3 착수와 성능 통과 판정은 금지**한다.

## 6. M1: 한 사건의 저장 경로

### 6.1 P06–P08의 구현 단위

첫 migration은 characters/configs/identities/sessions, events/appraisals/state/transitions, response_runs/response_sources/speech_segments를 만든다. 관계·기억의 영구 테이블은 M2에서 추가한다. 아직 없는 schema를 조회하는 빈 repository 메서드를 미리 만들지 않는다.

첫 동작의 확인 순서:

1. 고정 캐릭터·계정 seed, 세션 시작.
2. 같은 request ID로 채팅 두 번 제출 → events 원본 한 건.
3. 주의 선택과 해석 채택을 별도 단계 사건으로 저장.
4. Core의 감정 변화·표현 계획·transition·state version을 원자적으로 commit.
5. commit 이후 대사 생성과 text segment 전달.
6. 정상 종료·재시작 후 같은 상태에서 경과 시간 감쇠 확인.

처음에는 fake 해석으로 상태/DB 경계를 확인하고 P08 완료 전에 실제 Ollama를 연결한다. rollback 검사와 늦게 도착한 결과 폐기를 먼저 검증한 뒤 기능을 늘린다. GPU 자원이 없는 순수 Core·DB 검사는 가짜 provider로 충분하다.

familiarity·affinity의 순수 계산은 P07에서 일부 검사할 수 있지만 영구 저장·한국 날짜별 한도·신뢰 근거는 P12 전에는 완료라고 표시하지 않는다. D06처럼 여러 계층에 걸친 ID는 부분 결과를 남기고 마지막 통합 검사가 끝날 때 통과시킨다.

### 6.2 P09–P10의 화면 범위

Studio에는 계정 선택·채팅 입력·현재 활동 영역·상태·근거 timeline·준비/오류 표시를 둔다. 아직 구현되지 않은 활동/기억 기능은 연결되지 않은 데모로 보여 주지 않는다. Stage는 초기에는 검증된 자막과 중립/듣기 표시만 출력한다.

텍스트 단계부터 페어링·역할 검사·command ACK·outputEpoch·source revision을 적용한다. 공개 Stage에 원본 채팅·상태 숫자·기억 원문을 보내지 않는다. 같은 Stage 코드를 이후 음성·VRM에 확장한다.

M1 완료의 시연은 **실제 텍스트 입력→실제 해석→저장된 상태→검증된 대사→자막 ACK**다. 관계 지속성·음성·아바타·세 세션 전체 완료를 주장하지 않는다.

## 7. M2: 퍼즐·관계·기억·Agenda

### 7.1 P11–P12: 검증 가능한 활동과 도움

퍼즐은 기존 명세의 한 종류로 제한한다. 등록 문제 세 개와 정답 validator를 서버 영역에 둔다. 브라우저와 모델에는 공개 문제·답 형식·이미 공개된 힌트만 제공한다. 후보 답 제출, 판정, 힌트 사용, 추가 시도 허용은 서로 다른 사건이다.

관계 근거는 활동을 연결한 뒤 구현한다. 칭찬·관측 날짜·검증된 도움의 업무 키와 source group을 생성하고, 동일 문제를 다른 activity_run에서 다시 풀어도 독립된 새 신뢰로 세지 않는다. 적용량 0인 사회적 근거도 반복 수 계산에 필요한 경우 남긴다.

테스트에서는 오답·도움 성공을 주입해 한도를 확인할 수 있다. 실제 모델 시연에서 일부러 정답을 숨겨 답을 틀리게 하거나 가짜 성공 결과를 만들지 않는다. 정상 풀이에서 도움이 발생하지 않으면 해당 시연 분기는 미검증으로 남긴다.

### 7.2 P13–P14: 사실 기억과 다음 만남

활동 결과·사용한 도움·미완료 의도는 확정 시점에 즉시 저장한다. 종료 task는 이미 있는 사실을 묶으며 새 경험을 만들어 내는 두 번째 reducer가 아니다. LLM 회고·semantic memory·embedding은 구현하지 않는다.

검색은 유효 source·현재 활동·참여자·최근 사건 순으로 제한한다. 낮은 우선순위 기억을 통째로 제외해 token 예산을 맞추며 원문 중간 절단으로 사실을 바꾸지 않는다.

Agenda는 pending→reserved→offered→종료 흐름이다. plan commit 때 attempt 예산을 소비하고, 완전한 자막 또는 음성 전달 뒤 offered로 바꾼다. P14에서는 text ACK로 우선 검증한다. 실제 음성·부분 전달·OBS 재접속 검사는 P18에서 추가한다.

### 7.3 P15: 삭제를 마지막 장식으로 두지 않기

DB 출처 연결을 사용해 기억-only 삭제와 원본 삭제를 각각 구현한다. 관계 재집계, 독립 source group 보존, tombstone 재생성 방지, 현재 대사 취소를 같은 기능으로 검증한다. 삭제된 내용을 로그·작업 결과·segment에 그대로 남기지 않는다.

이 단계는 M2의 완료 조건이다. “데이터는 저장되지만 수정할 수 없음” 상태로 음성 기능을 먼저 완성하지 않는다. 영향이 작은 문구 정정과 관측 사실 정정을 구분하고 사실은 validator 근거로만 바꾼다.

M2 완료 시 실제 텍스트 세션 사이에 미완료 활동과 근거가 이어져야 한다. 최종 실제 음성 포함 세 번의 만남은 P20에서 별도로 실행한다.

## 8. M3: 음성·VRM·OBS

### 8.1 P16–P17: 작업 수명과 마이크

P03/P04의 wrapper를 production 계약으로 완성한다. stdout JSONL·stderr 로그, worker instance ID, 상대 경로 검사, 제한된 재기동, 모델 누락 준비 상태, 임시 파일 수명을 연결한다. STT는 CPU, 해석·대사·풀이·TTS는 통합 GPU 슬롯 하나다.

취소된 계산은 끝날 수 있지만 출력은 금지한다. worker 종료 확인 전 슬롯 재사용, 시스템의 모든 Python 종료, 실패한 녹음/문장의 무한 재호출을 금지한다.

마이크는 AudioWorklet에서 실제 sample rate를 읽고 PCM16 16kHz로 변환한다. 누름 시 start, 놓음 시 end, 완성 WAV HTTP 업로드 순서다. 짧은 발화·start ACK 전 종료·장치 권한 거부·blur·세션 종료·잘못된 파일을 검사한다. 부분 발화를 확정 event로 만들지 않는다.

### 8.2 P18: 출력의 실제 완료

기존 보유 또는 무료 VRM 에셋 한 개를 연결한다. 에셋 선택과 사용 조건이 확인되지 않으면 맞춤 모델 구매를 제안하며 작업을 대체하지 않고 해당 단계만 미완료로 남긴다. 기본 다섯 표현을 지원 범위에서 매핑하고 입 움직임은 음량 기반으로 시작한다.

Stage는 검증된 한 문장 WAV를 재생하며 다음 문장을 장시간 예약하지 않는다. text_shown, audio_started, audio_completed, cancelled, unknown을 분리한다. `ended` callback이 취소 때문에 발생한 경우 완료 ACK로 처리하지 않는다.

OBS와 일반 브라우저에서 각각 준비/재생을 확인하고, 둘을 동시에 열어 소유 Stage 하나만 발성하는지 검증한다. 이전 Stage의 중지 ACK가 없으면 timeout만으로 다른 Stage를 자동 활성화하지 않는다. 브라우저의 autoplay 해제와 OBS 상호작용 절차는 실제 확인 뒤 RUNBOOK 초안에 기록한다.

### 8.3 P19: 실제 복구

텍스트 단계부터 있던 복구 절차를 실제 worker·AudioContext·임시 파일까지 확장한다. 정상 재연결, 서버 재시작, DB 실패, ACK 유실, 원본 삭제와 decode 완료 경합을 각각 검사한다. 오래된 결과가 끝났다는 이유로 새 음성을 내지 않는다.

정상 20분 시연과 강제 종료·OOM 주입은 다른 시험이다. 장애 시험에서 사용한 데이터·성능 통계를 정상 시연 결과와 섞지 않는다. offline 검증을 위해 사용자 PC의 네트워크를 문서나 앱 시작만으로 임의 차단하지 않는다.

M3 완료에는 fake audio 검사뿐 아니라 실제 마이크·TTS·VRM·OBS, 고정된 performance gate의 통과가 필요하다.

## 9. P20–P21: 최종 결과와 실행 문서

P20은 [검증 계획](./VALIDATION_PLAN.md)을 그대로 실행한다. 새 합격 기준을 이 문서에서 만들지 않는다. 기본 검사·한국어 해석/대사·STT/TTS·채널별 30건·취소 20회·세 세션·20분·오프라인 결과를 run manifest에 연결한다.

실패하면 관련 작업을 다시 IN_PROGRESS로 돌리고 원인을 수정한다. 기존 실패 기록은 유지하고 새 run ID로 재검증한다. 모델·설정 변경은 성능 gate·평가 데이터의 유효성을 검토하며 최종 결과를 보고 사후에 문턱을 완화하지 않는다.

RUNBOOK 초안은 실제 실행 명령이 생긴 작업부터 작성할 수 있다. P21에서 다음을 최종 확인한다.

- 새 터미널에서 개발/방송 모드 실행, 로컬 모델과 DB 준비 상태 확인.
- 목소리 preset·VRM·Stage 페어링·OBS 출력 소유권 선택.
- 정상 종료, 미종료 프로세스/worker 구분, 복구 후 재시작.
- 테스트 DB 초기화와 실제 경험 DB 초기화의 구분.
- DB 백업·별도 DB 복원 확인, 삭제 반영 전 백업의 격리.
- 모델 누락·메모리 부족·자동 재생 차단·TTS/STT 실패의 실제 오류별 대응.
- 코드·migration·의존성·모델 버전과 검증 report 위치.

MVP 완료는 P20의 필수 결과와 P21 실행 문서가 모두 확인된 상태다. 문서에 “완료”를 적기 위해 미확인 명령을 추측하지 않는다.

## 10. 개발 명령의 예정 계약

다음은 package scripts의 현재 상태와 앞으로 구현할 이름이다. 실행 가능 항목은 위 P00–P01에서 확인했으며 나머지는 앞으로 만들 계약이다. 실제 설치 도구 버전·프로젝트 구조를 확인한 뒤 RUNBOOK에 검증 결과를 남긴다.

| 예정 명령 | 목적·제한 |
|---|---|
| `pnpm typecheck` | 구현됨: 현재 존재하는 package의 타입 검사 |
| `pnpm test:unit` | 구현됨: 계약 검사 9개, 모델 로드 없음. Core 검사는 P07에서 추가 |
| `pnpm test:db` | 명시한 test DB만 사용, 실제 PostgreSQL |
| `pnpm test:protocol` | HTTP/WS·역할·명령 수명·오류 경로 |
| `pnpm test:e2e` | fake provider 기반 브라우저 반복 검사 |
| `pnpm diagnose` | 구현됨: 경로·설치·환경 준비 상태, 자동 수정/다운로드 없음 |
| `pnpm db:migrate` | 검토된 migration만 적용, 일반 앱 시작과 분리 |
| `pnpm db:seed` | 고정 기본 자료를 중복 없이 추가, 관계/기억 가짜 seed 없음 |
| `pnpm dev` | 개발 화면·서버 실행, 기존 Ollama/DB를 무단 재시작하지 않음 |
| `pnpm build` / `pnpm start` | production 화면 build와 로컬 실행 |
| `pnpm eval:models` | 고정 실제 모델 품질 세트, GPU 작업 중복 실행 금지 |
| `pnpm eval:latency` | manifest·고정 gate를 확인한 실제 측정 |

기본 unit/e2e 명령이 모델을 자동 다운로드하거나 음성을 재생하지 않게 한다. 실제 모델 평가는 명시적인 eval 경로로 실행한다. 테스트 편의를 위해 임의 셸 실행 API·운영 상태 강제 변경 API를 공개하지 않는다.

## 11. 검증과 작업의 연결

| 작업 | 우선 확인할 검사·기능 |
|---|---|
| P00–P02 | schema·bigint 직렬화·AI01–AI04·AI08·AI13 |
| P03–P05 | 실제 TTS/STT 준비·자원·품질 파일럿·성능 gate |
| P06–P08 | D01–D06·D09·D17–D18의 해당 부분, DB01–DB06·DB16·DB18 |
| P09–P10 | RT01–RT05·RT13·RT16–RT18의 텍스트 부분, F01·F03–F06·F23 |
| P11–P12 | D07–D11, AI11, DB07–DB09·DB17 |
| P13–P15 | D12–D16, DB10–DB13·DB15, AI07, RT12·RT14의 텍스트 부분 |
| P16–P19 | AI05–AI10·AI12–AI14, DB14·DB16–DB18, RT01–RT18의 실제 출력 부분 |
| P20–P21 | 모든 필수 결과·추적표·실제 모델·F01–F25·실행/복원 문서 |

이 표는 우선순위이며 전체 검사 목록의 대체물이 아니다. 정확한 68개 ID와 보완 기능 검사는 검증 계획에서 추적한다. 이미 통과한 관련 검사를 코드 변화 없이 이유 없이 반복하지 않는다. 반대로 같은 ID의 실제 환경 하위 검사가 남았으면 fake 결과만으로 완료시키지 않는다.

## 12. 미확정 항목과 진행 가능한 범위

| 미확정 항목 | 해결 작업 | 해결 전 가능한 작업 |
|---|---|---|
| Node·pnpm·PostgreSQL 실제 설치/계정 | P01 | 문서·순수 계약 설계, 의존성 준비 계획 |
| TTS snapshot 완전성·audio tokenizer | P03 | 텍스트 Core·DB·Ollama |
| 사용할 참조 목소리·전사문 | P03 | 파일 검사·worker 계약, 실제 합성 완료는 보류 |
| STT 환경·모델 | P04 | 텍스트·TTS·DB |
| 두 모델 상주·실제 응답성 | P05 | M1/M2의 독립 구현, M3 통과는 보류 |
| 사용할 무료/보유 VRM | P18 | 텍스트 Stage·오디오·표현 DTO |
| OBS 실제 오디오 준비·지연 | P18–P20 | 브라우저 검사, OBS 완료 주장은 보류 |

설치나 선택이 필요한 시점에는 이미 확인한 로컬 후보를 먼저 제시한다. 범위가 명확한 구현 결정을 매번 재확인하지 않는다. 다만 목소리/에셋의 선택, 필수 범위 변경, 유료 전환, 사용자 데이터 파괴를 임의로 결정하지 않는다. 유료 전환은 현재 요구사항과 맞지 않는다.

추가 모델·새 라이브러리를 찾기 전에 기존 구성에서 실패한 사례와 자원 기록을 남긴다. 같은 접근의 수정이 세 번 연속 진전이 없으면 원인을 재평가하고 지원되는 대안을 검토한다.

## 13. 일정 추정과 첫 착수 범위

아직 실행 성능과 개발 환경을 확인하지 않았으므로 날짜·인일을 확정하지 않는다. P05와 M1 저장 경로를 완료한 뒤 실제 작업량·모델 한계·남은 범위를 근거로 일정표를 만든다. 테스트 수를 줄이거나 음성·기억을 빼서 일정에 맞춘다고 가정하지 않는다.

**첫 개발 범위 P00–P01은 완료했다. 다음 작업은 P02–P04의 로컬 모델 연결이다.** 아래는 이번 범위에서 수행한 순서다.

1. 환경·기존 파일·저장소 상태를 필요한 범위에서 확인한다.
2. workspace와 최소 contracts/runtime/Core/DB 진입점을 해당 구현에 필요한 만큼 생성한다.
3. 설정 schema, bigint 전송 변환, `.env.example`, 원문·모델·임시 파일을 제외하는 ignore 규칙을 만든다.
4. `typecheck`, 최소 계약 검사, 읽기 위주의 환경 진단을 실행한다.
5. 실제 결과와 다음 미확정 항목을 기록하고 P02–P04로 이어간다.

현재 완료된 코드는 workspace·설정 계약·진단이며 검증은 타입 검사·계약 검사 9개·읽기 전용 진단까지다. 모델 로드·DB 생성·Studio/Stage·MVP 통합 검증은 남아 있다.

## 14. Jev 필수 복원 개발 계획

### 14.1 요청·단계·현재 기준선

- 계획 ID: `jev-required-v1`, 작성일 2026-10-04. 단계 **PLAN 완료 → 다음 BUILD**, 수정/재감사 라운드 0.
- 요청: “MVP에서 제브가 빠지면 안 된다.” 이어서 “일단 계획만 해. 개발만 남은 단계에 멈춰.” 이번 편집은 이 계획 파일 하나로 한정한다.
- 목표: **합성 입력 → 실제 Jev 사건 해석 → 기존 Core 상태/행동 결정 → 로컬 Qwen 대사 → Stage 표시·완료 ACK**. 정상 실행에서 Jev를 빼거나 Qwen 해석으로 자동 대체한 결과는 이 목표의 완료가 아니다.
- 기존 코드: `OllamaProvider.appraise()`가 해석까지 담당하며 `Coordinator.drain()`은 동일 provider의 결과를 `Store.commitAppraisal()`에 전달한다. `createServer()`의 준비 상태는 대화 모델만 구분한다. Jev adapter는 없다.
- 앞선 완료 작업: Prompt v2 4개와 local config 2개 적용, 기존 Readiness 5개 보존. 실제 Qwen→Stage 두 만남의 전달 성공은 `BUILD_HANDOFF.md`의 10-04 기록을 따른다. 첫 대사의 중국어 혼합/문장 품질과 target=activity 분류도 남아 있다. 이를 Jev 검증 증거로 재사용하지 않는다.
- 작업 폴더는 Git 저장소가 아니다. HEAD/commit을 가정하지 않는다. 구현자는 아래 해시와 실제 파일을 비교하고 후속 변경이 있으면 해당 부분만 다시 확인한다. `runtime-data/stage-validation-20261004/source-hashes.json`에 이전 관련 소스의 전체 목록도 있다.

| 현재 기존 파일 | 계획 작성 시 SHA256 |
|---|---|
| `packages/adapters/src/ollama.ts` | `ee94acf5b34eee9f8598992ee48215546473ff7861be111260085a84b281e36b` |
| `packages/contracts/src/domain.ts` | `99dbfe849d40b3a892efbff14d2ba78c9346c0ec45d785dca7e5330c5f40f710` |
| `packages/contracts/src/local-config.ts` | `93cb3024ef357af777ee12267dd8a356e2abe4dd5df32e0a5b485f8f51b34fce` |
| `apps/runtime/src/coordinator/index.ts` | `5d184fe1171849870f601b384f054c34085c487ce7fccbe9faa23500502f50a7` |
| `apps/runtime/src/http/server.ts` | `a6e012bfc7a419e532e6b339107b287684165d2e31ad3d8c2becac8a196ee54a` |
| `apps/runtime/src/index.ts` | `de3069213efa46adec5a44f7890cf95bda709263058d0d12f7b0a6737d04cb70` |
| `apps/studio/src/main.tsx` | `ff7543cbf1a54b0450286edc774094dbb1bc4e1425089287724089ff29798328` |
| `packages/database/src/store.ts` | `4132eb0fc4eceb68c34896b84de818e4a56b389830f8c15d1be8694ff381e2ed` |
| `evals/real-stage.ts` | `969ae6eded62976e21a6b8535fb5547b40de134e59514d164b3c6c8ae898c63f` |

### 14.2 공식 연동 계약과 비용 경계

2026-10-04 공식 문서를 직접 확인했다. API 규격·제품 조건은 아래 출처에 근거하며, 이 PC/계정의 실제 Jev 호출 성공은 아직 확인하지 않았다.

- [API reference](https://docs.typesafe.ai/api): `POST https://api.typesafe.ai/v1/systemone`, Bearer API key, `{model,state,questions}` 요청과 `{model,answers,usage}` 응답. HTTP client는 기존 Node `fetch`를 사용하고 새 SDK는 설치하지 않는다.
- [Models](https://docs.typesafe.ai/models): 현재 고정 모델 `jev-1.13.0`, 입력 100만 토큰당 USD 0.042, 출력 토큰 무료. 계정의 접근·잔액·실제 청구는 확인하지 않았다. `jev-latest` alias 대신 위 버전을 고정하고 응답 model도 검사한다.
- [Choice](https://docs.typesafe.ai/primitives/choice), [Score](https://docs.typesafe.ai/primitives/score), [Confidence](https://docs.typesafe.ai/confidence): 각 질문은 같은 state를 독립적으로 평가한다. Choice의 confidence와 선택 확률은 서로 다르며, Score 값은 정수가 아닌 가중 평균일 수 있다. JSON schema 일치나 confidence만으로 한국어 정확성이 증명되지는 않는다.
- 기존 설치 모델만 사용하는 조건으로 실제 Jev를 대신 구현할 수 있다고 가정하지 않는다. 이번에 확인한 공식 제공 경로는 원격 API다. 로컬 Jev 배포/가중치 경로는 확인되지 않았다.

**개발 진행 조건:** 명세 수정, adapter·runtime 연결, 모의 응답 및 로컬 DB/브라우저 검사는 개발할 수 있다. 실제 Jev 요청은 이전의 유료 API 금지와 충돌하므로 사용자의 Jev API 비용·외부 전송 예외 승인 및 사용 가능한 `TYPESAFE_API_KEY`가 필요하다. 키는 실행 환경 또는 무시되는 `.env`로만 제공하고 채팅/로그/브라우저/문서에 넣지 않는다. 승인·키가 없으면 JR08만 BLOCKED로 남기며 Jev를 다시 제외하지 않는다.

이 계획과 후속 개발 승인은 실제 유료 호출 승인 자체가 아니다. 개발자가 flags를 바꾸어 승인으로 간주하거나 무료 체험·Playground로 우회하지 않는다. 과금 예외가 승인돼도 이 작업의 외부 입력은 명시된 합성 fixture뿐이다. 개인 파일·음성, 새 모델 다운로드, 음성·VRM·OBS 신규 개발, activation steering, Core 감정 수치 개편은 범위 밖이다.

### 14.3 확정할 코드 계약과 동작

**책임 분리**

1. 새 `AppraisalProvider`는 `name`, `model`, `promptVersion`, `readiness()`와 `evaluate(event, context)`를 제공한다. 반환은 `{appraisal: Appraisal, metadata: {provider, model, promptVersion, latencyMs, usage, providerResult}}`다. 공유 Evaluation/Metadata 타입은 `packages/contracts`가 소유하며 DB가 adapters를 import하지 않는다. `Appraisal`의 기존 필드·정수 범위는 바꾸지 않는다. providerResult의 버전·질문 rubric·confidence gate는 `jev-appraisal-v1`에 묶는다.
2. `JevAppraisalProvider`만 정상 runtime의 appraiser로 주입한다. 생성 provider는 기존 Ollama 객체이며 대사·퍼즐·token counter를 담당한다. 기존 `OllamaProvider.appraise()`는 명시적 로컬 비교 검사에서만 유지한다. 일반 runtime에 자동 fallback이나 선택용 플러그인 registry를 만들지 않는다.
3. `Coordinator(store, generationProvider, sink, appraiser)`는 별도 appraiser를 필수 인자로 받고 `drain()`에서 해당 `evaluate()`만 호출한다. 결과 metadata를 `Store.commitAppraisal()`에 전달한다. `createServer(store, generationProvider, appraiser, options?)`로 조립하며 직접 호출자도 전부 수정한다. Core와 DB가 감정·관계·기억의 writer인 경계는 유지한다.

**원격 전송과 질문**

- 요청 state는 이번 사건의 text, 사용자→캐릭터라는 역할 정보, 현재 활동의 공개 prompt/status만 allowlist로 구성한다. 전체 context 객체를 그대로 직렬화하지 않는다. 상대 계정 정보·장기 기억·DB 원문·비공개 정답·힌트·API 키를 보내지 않는다. event ID/source revision은 로컬 요청과 결과를 연결한다.
- 질문은 5개: `target`, `act`, `goal_relation`은 기존 enum 값의 Choice, `strength`, `hostility`는 0–3의 Score. 모든 질문 instructions에 평가 대상을 명시한다. API의 질문 key 이름이나 다른 질문의 답에 의존하지 않는다.
- strength rubric은 0 없음/1 약함/2 명확함/3 강함, hostility는 0 없음/1 날카로움/2 직접 비하/3 명백한 공격이다. 기존 `CHARACTER_DOMAIN_SPEC.md` §5의 의미를 유지한다. 인용·제삼자·활동 불만을 캐릭터 공격으로 바꾸지 않도록 각 질문에 경계를 명시한다.
- adapter가 원격 판단을 기존 `Appraisal`로 변환한다. `evidence_refs=[현재 사건 ID]`는 로컬에서 붙인다. 이것은 해석 대상의 provenance이며, 도움·성공이 검증됐다는 근거가 아니다.

**엄격한 변환과 불확실성**

- 필수 5개 answers, type, option/level keys, 유한한 score/confidence/probability, 범위를 검사한다. 확률은 각각 0–1, 합은 `1 ± 1e-4`, Choice는 최대 확률 option이어야 한다. Score의 legend는 0–3 rubric과 대응하고 score는 분포 가중 평균과 `1e-4` 이내에서 일치해야 한다. 미지 label·누락·모델 버전 불일치·malformed 응답은 거부한다.
- Score 평균을 정수로 반올림하지 않는다. 유일하게 가장 높은 확률의 등급을 strength/hostility 정수로 채택한다. 평균 score와 전체 확률·confidence는 providerResult에 보존한다.
- 초기 gate는 5개 질문 confidence의 최솟값 `0.80`이다. 하나라도 미달하거나 최고 확률이 동률이면 `uncertain=true`, strength/hostility=0으로 유보한다. 유효한 target/act/goal_relation은 유지해 질문인 경우 기존 Core의 clarify가 가능하게 한다. target 또는 act가 unknown이어도 uncertain=true다. goal_relation=unknown만으로는 불확실성을 강제하지 않는다.
- `0.80`은 검증 전 초기 보수 정책이다. 개발용 24건에서만 조정할 수 있고 최종 24건 평가 전에 rubric/threshold/version/hash를 고정한다. 판정 후 문턱을 낮춰 PASS로 만들지 않는다. confidence를 affinity/trust에 직접 더하지 않는다.

**실패·취소·설정·준비 상태**

- 실시간 해석은 한 사건당 최대 1회, 자동 재시도 없음. 시작 시/health poll에서 Jev 추론하지 않는다. deadline 15초, 입력 state 16KiB 이하 및 기존 채팅 1,000자/4,096 bytes 제한, 응답 body 64KiB 이하로 제한한다. redirect는 거부하고 endpoint는 위 HTTPS 주소에 고정한다.
- 401/403, 422, 429, 5xx, timeout, malformed는 구분된 오류 코드로 저장·표시한다. 실패는 기존 neutralAppraisal과 failureCode로 commit한다. 단순 관측 처리는 유지하되 실패한 의미 판단으로 감정·호감·도움·성공을 만들지 않는다.
- Jev는 원격 호출이므로 로컬 GPU 슬롯을 점유하지 않는다. timeout의 논리적 종료와 원격 계산/청구 종료를 동일시하지 않는다. 늦은 결과, 세션 종료, 삭제, generationEpoch 변경은 기존 stale 검사로 재적용·출력을 차단한다.
- `APPRAISAL_MODEL`의 정상 기본값/허용값은 `jev-1.13.0`, `DIALOGUE_MODEL`은 기존 `qwen2.5:7b`다. 기존 APPRAISAL_MODEL=qwen 설정은 Jev 필수 조건 오류와 정정 방법을 표시하며 조용히 대체하지 않는다. Ollama 생성에는 DIALOGUE_MODEL을 사용한다.
- 기존 LOCAL_ONLY/ALLOW_PAID_PROVIDERS 값을 boolean 설정으로 받되 defaults `true`/`false`를 유지한다. Jev 요청은 **LOCAL_ONLY=false AND ALLOW_PAID_PROVIDERS=true AND TYPESAFE_API_KEY 존재**를 모두 만족할 때만 가능하다. 이 예외는 고정 Jev endpoint에만 적용하며 Ollama/DB/음성의 로컬 제한은 유지한다. 어떤 실제 설정 파일도 개발자가 임의로 활성화하지 않는다.
- `readiness()`는 blocked/configured/ready/unavailable와 inferenceVerified, 오류 코드를 구분한다. 키가 있고 flags가 열려도 첫 유효한 Jev 응답 전까지 configured·inferenceVerified=false다. Studio에는 **사건 해석(Jev)**과 **대사 생성(Qwen)**을 별도로 표시한다. Qwen만 ready인 경우 Jev까지 준비됐다고 표시하지 않는다. `diagnose`는 키 존재 여부만 확인하며 원격 호출을 하지 않는다.

**저장·삭제 계약**

- `appraisals.result`는 기존 엄격한 Appraisal JSON이다. 새 nullable `provider_result jsonb` 컬럼에 검증된 typed answers, mappingVersion, confidenceThreshold, gateReasons만 저장한다. 요청 원문·header·키·원격 오류 body를 보관하지 않는다. model/prompt_version/latency_ms/usage는 기존 컬럼을 사용한다.
- 기존 두 migration을 편집하지 않고 `0003_jev_appraisal.sql`로 additive 변경한다. 기존 Qwen/합성 행은 provider_result=NULL 상태로 유지한다. 정상 result와 metadata는 같은 기존 트랜잭션에서 commit한다. 별도 Jev 상태 테이블이나 두 번째 canonical 상태는 만들지 않는다.
- 원본 삭제/무효화 때 `Store.deleteEvent()`가 기존 appraisals.result/context_refs와 함께 provider_result도 제거한다. memory-only 삭제는 기존 원본 유지 의미를 바꾸지 않는다. 새 데이터 때문에 기존 삭제 계약에 흔적이 남으면 완료가 아니다.
- SQL migration이 현재 배포 원본이고 appraisals는 Drizzle mapping에 없다. 이번 컬럼을 위해 사용하지 않는 Drizzle 테이블 mapping을 새로 만들지 않는다. startup과 restore 검사에 있는 migration 개수 2를 신규 migration 3과 일치시킨다.

### 14.4 성공 기준

아래는 개발 후 필요한 증거이며 이번 PLAN에서 테스트한 결과가 아니다.

| ID | 관측 가능한 기준·경계 사례 | 증거·검사 | 상태 |
|---|---|---|---|
| JR01 | MVP/기술/AI/검증 명세가 Jev 필수 해석 + 로컬 Qwen 생성에 일치. 유료 예외 미승인은 미완료 조건으로 남음 | 관련 문서 diff, Jev 제외·완전 오프라인 성공 문구의 현재 의미 확인 | NOT VERIFIED |
| JR02 | disabled/missing key면 fetch 0회. 고정 endpoint/모델/전송 whitelist만 사용. health/diagnose/startup에서 Jev 요청 0회 | config·adapter·protocol spies, 유효/거절 counterexample | NOT VERIFIED |
| JR03 | 정상 typed 결과→기존 Appraisal, 분수 Score·동률·0.80 경계·미지 label·잘못된 분포·불완전 response를 정해진 규칙대로 처리 | 새 Jev adapter unit tests. confidence를 강도로 오인하지 않는 사례 포함 | NOT VERIFIED |
| JR04 | Coordinator는 Jev appraiser만 호출하고 Qwen.appraise 호출 0회. 생성/풀이 기존 경로 유지. 낮은 confidence는 의미 자극 없음 | 실제 PG coordinator tests, 호출 spy, 상태·관계 delta 검사 | NOT VERIFIED |
| JR05 | provider/model/prompt/원래 typed 판단/usage가 같은 appraisal 행에 저장. 중복 1회, stale 재적용 없음, 원본 삭제 시 provider_result 제거 | 실제 PG migration/commit/delete/restart tests + 전용 DB dump/restore | NOT VERIFIED |
| JR06 | 401/429/5xx/timeout/late success를 대체 Qwen 해석으로 숨기지 않음. 취소/삭제 뒤 자막·상태 적용 없음 | adapter·coordinator·HTTP/WS 오류 주입 및 지연 Promise 검사 | NOT VERIFIED |
| JR07 | Studio가 Jev와 Qwen 준비 상태를 구분. mock Jev→Core→mock dialogue→Stage의 표시·완료 ACK가 정상 | Chrome fixture E2E + 실제 PG; providerFixture=true 명시 | NOT VERIFIED |
| JR08 | 실제 Jev→Core→실제 Qwen→Stage, 별도 두 만남·모든 segment shown/finished·response completed. 한국어 최종 해석 24건 중 22건 이상 및 중대한 잘못된 상태 반영 0건 | 승인·키 제공 후 실제 공급자 run, source hashes, model/rubric/usage/지연 및 화면 캡처. 모의 결과로 대체 불가 | NOT VERIFIED — 실호출 승인·키 필요 |

JR01–JR07은 개발과 오프라인 검증으로 구현 완료를 판정한다. JR08이 없으면 실제 Jev 통합은 미검증이며 전체 MVP 완료도 아니다. 한국어 대사 품질은 기존 `VALIDATION_PLAN.md` §6.2와 별개로 계속 남는다. 이번 변경이 Qwen 대사의 중국어 혼합까지 해결했다고 주장하지 않는다.

### 14.5 구현 순서와 정확한 변경 대상

| 순서 | 파일·심볼 (새 파일은 명시) | 작업·이유 | 기준 |
|---|---|---|---|
| B1 | 기존 `MVP_SPEC.md` §1/3/F04/6, `technical_architecture_v1.md` §1/2.2/설정 예, `jev_ai_character_runtime_plan_v2.md` 머리말/§6, `LOCAL_AI_INTEGRATION.md` §1/2/6/설정/오프라인 경계, `VALIDATION_PLAN.md` §1/2/3/6/오프라인/F04, `DATABASE_SPEC.md` §5.2/삭제 | Jev 필수와 이번 계약 반영. 기존 dated PASS는 과거 조건으로 보존. 오프라인 검사는 Jev 완성 시연이 아니라 차단·중립처리 복구 검사로 명확화 | JR01 |
| B2 | **새** `packages/contracts/src/appraisal.ts`의 AppraisalEvaluation/Metadata 및 providerResult 검증, 기존 `packages/contracts/src/index.ts` export, **새** `packages/adapters/src/appraisal.ts`의 AppraisalProvider/Readiness 인터페이스, **새** `packages/adapters/src/jev.ts`의 JevAppraisalProvider 및 request/mapping 함수 | §14.3의 실제 HTTP adapter·검증·안전한 오류·readiness 구현. DB는 공통 계약만 import. SDK/모델 설치 없음 | JR02/03/06 |
| B3 | 기존 `packages/contracts/src/local-config.ts` configSchema/parseConfig, `.env.example`, `scripts/diagnose.ts` check/report | 모델 역할과 명시적 API gate. 진단은 Jev 설정 존재만 보고 원격 무호출. 비밀값 미출력 | JR02 |
| B4 | **새** `packages/database/migrations/0003_jev_appraisal.sql`, 기존 `packages/database/src/store.ts` commitAppraisal/deleteEvent, `apps/runtime/src/index.ts` migration 검사, `scripts/check-restore.py` 결과 검사 | bounded provider_result 추가와 metadata 저장/삭제. 기존 migration 불변. migration 3개에 맞게 직접 소비자 갱신 | JR05 |
| B5 | 기존 `apps/runtime/src/coordinator/index.ts` constructor/drain, `apps/runtime/src/http/server.ts` createServer/health-ready, `apps/runtime/src/index.ts` provider 조립 | appraiser를 필수로 주입. Jev 실패/미준비 시 Qwen appraise fallback 없음. 생성은 DIALOGUE_MODEL 사용 | JR04/06 |
| B6 | 기존 `apps/studio/src/main.tsx` readiness 표시, 기존 `RUNTIME_PROTOCOL.md` 준비 상태 계약, `README.md`, `RUNBOOK.md`, `BUILD_HANDOFF.md` | Jev/Qwen 분리 표시·실행법·정확한 검증 범위. Stage 렌더/디자인/음성은 변경 필요 없음 | JR01/07 |
| B7 | **새** `packages/adapters/src/jev.test.ts`, 기존 `packages/contracts/src/contracts.test.ts`, `evals/helpers.ts`, `evals/db.test.ts`, `evals/coordinator.test.ts`, `evals/protocol.test.ts`, `evals/browser/text.spec.ts` | JR02–JR07 경계/정상 사례. helper에 명시적인 mock appraiser를 만들고 mock임을 보존 | JR02–07 |
| B8 | 기존 `scripts/test-server.ts`, `scripts/smoke-runtime.ts`, `evals/real-stage.ts` | 모든 createServer 호출자에 appraiser 인자를 연결. smoke는 원격 Jev 추론 없이 준비 상태 검사. real-stage는 기본 Jev, 기존 Ollama 해석 비교는 명시적 `--local-baseline` 때만 허용 | JR02/07/08 |
| B9 | **새** `evals/fixtures/jev-appraisal.json`, **새** `evals/jev-quality.ts` | 기존 검증 계획의 12범주×4 합성 사례를 24 dev/24 final로 구분. 최종 정답은 request에 포함하지 않음. stage·quality 두 도구 모두 명시적 `--allow-jev-api` 없으면 외부 요청 전에 종료 | JR08 |

B1→B2/B3→B4→B5→B6→B7/B8의 순서다. B9의 fixture와 실행기는 호출 없이 개발 가능하며 실제 실행은 승인·키 조건을 충족한 뒤다. B7의 regression 사례는 해당 구현 변경 전에 먼저 실패를 확인하고 이후 PASS를 확인한다. 공유 계약과 DB가 바뀌므로 adapter만 검사하고 끝내지 않는다.

기존 `packages/character-core`의 계산식, `packages/contracts/src/domain.ts`의 Appraisal/state/Stage 메시지, `apps/studio/src/wire.ts`, worker, fixture puzzle 정답은 이번 구현 변경 대상이 아니다. 필요성이 실제 오류로 입증될 경우 이유·영향·검사를 기록한 뒤 최소 변경한다. `runtime-data/ai-local.json`과 local-probe-status는 기존 내용을 보존한다. 준비된 Readiness 패치를 다시 복사하지 않는다.

### 14.6 집중 검증 명령과 실행 조건

작업 디렉터리: `C:\Users\ltk90\vibe_coding_projects\ai-character-runtime`. 기존 Node·node_modules·Chrome·전용 PostgreSQL 사용. 새 의존성 설치·모델 다운로드 없이 진행한다. 아래는 **앞으로 실행할 명령**이다. 이번 PLAN에서는 실행하지 않았다.

```powershell
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
node node_modules/vitest/vitest.mjs run --config vitest.config.ts packages/contracts/src/contracts.test.ts packages/adapters/src/adapter.test.ts packages/adapters/src/jev.test.ts
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts evals/db.test.ts evals/coordinator.test.ts evals/protocol.test.ts
node node_modules/vite/bin/vite.js build --config apps/studio/vite.config.ts
node node_modules/@playwright/test/cli.js test --config playwright.config.ts
python scripts/check-restore.py
node --experimental-strip-types scripts/diagnose.ts
```

DB 검사는 `character_runtime_test`, restore는 `character_runtime_restore_test`만 초기화할 수 있다. migration 3개 신규 설치뿐 아니라 기존 2개가 적용된 테스트 DB 업그레이드도 확인한다. 테스트/mock 결과에 Jev 실제 추론 성공이라는 표기를 하지 않는다. pytest나 전체 repo 검사를 추가로 도입하지 않는다.

실제 공급자 검증은 사용자 승인 후, 키와 허용 flags가 명시된 환경에서만 아래 **개발 예정 CLI**로 실행한다. `--allow-jev-api`는 오실행 방지 인자이며 사람의 비용 승인을 대신하지 않는다.

```powershell
node --experimental-transform-types evals/jev-quality.ts --synthetic-inputs --allow-jev-api --split dev
# dev에서 rubric/gate 고정 후 별도 final 평가. 총 48건, 자동 retry 없음.
node --experimental-transform-types evals/jev-quality.ts --synthetic-inputs --allow-jev-api --split final
node --experimental-transform-types evals/real-stage.ts --synthetic-inputs --allow-jev-api --validation-env 'J:/AI-Character-Runtime-Local-20261003-P02P04/validation.env'
```

첫 실호출 묶음은 quality 48건과 Stage 2건으로 최대 50회다. 종료/health/준비검사는 Jev 요청을 추가하지 않는다. quota·401·지속 장애가 생기면 중단하고 비용·실패를 기록한다. 비용 승인 금액/계정 한도가 없으면 실호출하지 않는다. input_tokens는 실제 usage로 합산하며 문서 가격에 근거한 추정과 계정 청구를 구분한다. 평가 기록은 전용 `validation/runs/`에 저장하고 원본 실패를 덮어쓰지 않는다.

결과물에는 source hash, 고정 model, rubric/mapping version, 각 사례 입력 ID·판정·confidence·usage·시간, Core 반영, Stage 캡처와 ACK를 연결한다. 최종 24건을 본 후 프롬프트를 바꿨으면 기존 결과를 유지하고 해당 세트를 dev로 돌린 뒤 새 final을 고정한다. 공급자 광고 지연을 로컬 실측 목표의 통과 근거로 사용하지 않는다.

### 14.7 감사 초점·정지 지점·다음 지시

- 가장 중요한 감사 대상은 (1) 실제 경로에 Jev 대신 Ollama 해석이 남는가, (2) confidence/확률/강도를 혼동하는가, (3) Jev readiness와 생성 모델 readiness가 섞이는가, (4) 취소·삭제 후 늦은 결과/새 provider_result가 남는가, (5) 원격 전송 state에 비공개 자료가 섞이는가다.
- 0원·완전 로컬이라는 기존 문구를 계속 완료 조건으로 사용하면서 실제 Jev 성공을 주장할 수 없다. 비용·외부 전송 승인 전에는 JR08을 BLOCKED로 남긴다. 사용자 선택이 필요한 사항은 이 실제 서비스 사용 조건이며, mock 기반 코드 개발 자체는 진행 가능한 설계다.
- 이번 PLAN의 확인은 현재 소스/호출자/DB 컬럼·삭제 경로·설정 소비자·공식 API를 읽은 것까지다. 개발, migration 적용, 네트워크 추론, 테스트 실행, 서비스 기동은 하지 않았다.
- 다음 개발 지시: **“IMPLEMENTATION_PLAN.md §14의 jev-required-v1 계획대로 B1–B9를 개발하고 모의/로컬 검증을 완료해. 실제 Jev API는 별도 승인과 키·예산이 없으면 호출하지 말고 JR08을 미검증으로 남겨. 개발 결과를 기록한 뒤 감사 전에서 멈춰.”**
- 사용자 요청에 따라 **현재는 여기서 정지한다.** 실제 코드 개발이나 자동 후속 실행을 시작하지 않는다.

### 14.8 BUILD 인계 — 2026-10-04

사용자가 이후 “이어서 개발해 그럼”으로 BUILD를 승인했다. B1–B9의 코드·문서·평가 도구와 모의/로컬 검증을 완료했으며 **BUILD → AUDIT 대기**, 수정/재감사 라운드 0이다. 14.1–14.7은 당시 PLAN 기록이며 현재 결과는 이 절과 BUILD_HANDOFF.md 마지막 절을 따른다.

JR01 문서·계약 정정 완료, JR02–JR07 개발 범위 PASS: unit 47/47, 실제 PG/Coordinator/HTTP·WS 41/41, startup 이전 spy 보강 protocol 10/10, 실제 Chrome mock Jev/fixture 생성 Stage 표시·shown/finished ACK·completed 1/1, typed metadata 포함 dump/restore PASS, 타입·build·diagnose·Qwen 준비 smoke PASS. 기존 2-migration DB에서 3으로 업그레이드했고 운영/validation 데이터는 보존했다. Qwen 앱 해석과 도메인 schema 소스는 기준선 해시와 같다.

실제 변경 파일·심볼과 검증 범위는 BUILD_HANDOFF.md, 소스 manifest/기록은 validation/runs/jev-required-build-20261004에 있다. 작은 조정: diagnose는 strip-only 호환성을 위해 config 모듈을 직접 import하며, 두 실호출 CLI는 사람이 정한 비용 예산을 명시 인자로 요구한다. 이 예산은 usage 기반 중단 정책이며 계정의 강제 과금 상한을 보장하지 않는다.

사용자가 무시 경로 runtime-data/jev.env에 키를 입력했고 존재만 확인했다. 유료 요청 flags는 true/false 차단 기본값을 유지한다. **JR08은 BLOCKED**: 비용·합성 입력 외부 전송 승인과 예산이 아직 없다. 실제 API 호출은 0회이며 실제 Jev 한국어 22/24·위험 오반영 0·Jev→Qwen→Stage 두 만남을 완료로 표시하지 않는다. 개발 완료는 전체 MVP 완료가 아니다.

다음 행동은 요청받으면 AUDIT, 실제 공급자 검증은 별도 승인 후다. 이 BUILD에서 자동 감사나 유료 호출을 이어서 수행하지 않는다.

## 15. 4e608b4 감사 지적 수정 — 라운드 1

사용자가 전달한 정적 검토 6건을 재현한 뒤 BUILD로 수정한다. 기준선 HEAD=4e608b43d0d8df966bdf4624a95891559f162c6e, 착수 시 작업 트리 clean. 실제 Jev와 새 기능은 이번 검증 범위 밖이다.

성공 기준: AR01 기억 수정/삭제 후 기존 Stage가 새 epoch의 자막을 표시·완료 ACK하고 다음 입력도 처리하며, 취소된 frame/timer는 새 재생을 건드리지 않는다. AR02 같은 인증 Stage 재연결은 새로운 output epoch로 소유권을 복구하고 과거 응답을 재생하지 않으며 다른 Stage의 무확인 takeover는 계속 거부한다. AR03 이전 정답 근거 삭제는 새 열린 활동을 보존하고 삭제 commit에 성공한다. AR04 같은 날 새 유효 관측은 무효화된 familiarity 근거를 중복 증가 없이 재활성화한다. AR05 정정된 기억 content는 현재 version/facts와 함께 생성 context에 전달하고 삭제/무효화된 기억은 제외한다. AR06 문장 전체를 보존하며 무공백 구두점과 소수점을 처리하고 기존 길이·문장 개수 제한을 유지한다.

순서: browser/protocol로 AR01·02를 먼저 FAIL 재현하고 Stage/main.tsx와 서버 연결·소유권 경로를 최소 수정한다. 이어 db/adapter의 AR03–06 FAIL을 재현해 Store 삭제/근거/context와 validateDialogue를 수정한다. 기존 전용 test DB·Chrome·mock Jev/fixture 생성만 사용한다. 관련 회귀와 타입/build를 실행하고 실제 결과를 BUILD_HANDOFF.md에 남겨 AUDIT 전에서 멈춘다. 자동 commit/push/실제 API 호출은 하지 않는다.

### 15.1 BUILD 결과 — 2026-10-04

AR01–AR06은 수정 전 실행 FAIL을 확인하고 수정 후 집중 검증 PASS를 얻었다. 직접 관련 기존 묶음까지 DB/Coordinator/HTTP·WS 45/45, 대사 adapter 15/15, 실제 Chrome browser 3/3, TypeScript/Vite PASS다. browser는 idle 기억 정정, 진행 중 삭제와 지연된 렌더 ACK, 같은 인증 Stage 재연결, 새 응답의 shown/finished·completed를 확인했다. AR05는 실제 DB context를 Ollama adapter의 모의 transport에 넘겨 요청 JSON의 정정 문구·버전·facts까지 확인했다. 실제 Jev/Qwen 모델 품질 검증은 아니다.

수정 파일: apps/studio/src/main.tsx의 generation/playback lifecycle, apps/runtime/src/http/server.ts의 소유권 목록·grant·stage.ready·disconnect, packages/database/src/store.ts의 evidence/responseContext/deleteEvent, packages/adapters/src/ollama.ts의 validateDialogue. 검사는 evals/browser/text.spec.ts, evals/db.test.ts, evals/protocol.test.ts, packages/adapters/src/adapter.test.ts에 추가했다. 직접 계약 문서는 RUNTIME_PROTOCOL.md·DATABASE_SPEC.md·LOCAL_AI_INTEGRATION.md에 반영했다.

계획의 작은 조정: browser 재현 중 실제 기억 삭제 UI가 빈 body에 application/json을 붙여 Fastify에서 거부되는 경로를 확인했다. 같은 삭제 계약을 충족하기 위해 apps/studio/src/wire.ts에서 body가 있을 때만 Content-Type을 붙이도록 수정했고 실제 삭제 버튼으로 검증했다. 중간 검사의 잘못된 버튼 이름/삭제 후 관계 행 존재 가정도 검사 코드에서 바로잡았으며 그 실패를 제품 결함 증거로 사용하지 않았다.

소스 상태는 HEAD=4e608b43d0d8df966bdf4624a95891559f162c6e 위의 이 작업 소유 미커밋 변경이다. 실제 결과·명령은 BUILD_HANDOFF.md 마지막 절, 소스 해시는 validation/runs/audit-repair-4e608b4-20261004/source-manifest.json에 기록한다. **BUILD 완료 → AUDIT 제안 대기**, 수정 라운드 1. 자동 감사·commit·push는 하지 않았다. 실제 Jev API 호출은 0회이며 JR08과 전체 MVP 품질/음성·아바타·OBS의 미검증 경계는 유지한다.

### 15.2 A01 heartbeat timeout 복구 — 수정 라운드 2

라운드 1 감사는 AR01·03–06 PASS, AR02 FAIL이었다. 정상 소켓 종료의 재연결은 동작하지만 서버의 1008/heartbeat_timeout 이후 Wire가 재접속하지 않는 기존 경로를 실제 WS·PG·Wire로 확인했다. 사용자가 “어 해”로 수정 BUILD를 승인했다. 기준선은 위 라운드 1 미커밋 소스이며 기존 수정은 보존한다.

성공 기준 A01: heartbeat timeout 뒤 기존 backoff로 같은 인증 Stage가 재접속하고 새 output epoch·새 자막·완료 ACK를 얻는다. 인증 만료와 그 밖의 1008 인증/프로토콜 종료는 자동 재시도하지 않는다. server.ts의 만료 사유와 wire.ts의 재시도 분기를 함께 수정하고 Wire 정책 검사·실제 WS 만료 검사·실제 Chrome timeout 복구로 증명한다.

검증 중 발견한 작은 추가 범위: protocol 테스트의 다음 reset에서 deadlock이 발생했다. 종료가 queued ownership 취소와 진행 중 tick을 기다리지 않는 두 경로를 별도 gate로 각각 FAIL 재현했다. server.onClose는 ownershipTail을 기다리고 Coordinator.stop은 전체 tick 완료를 기다리도록 수정했다. 임의 대기나 테스트 재시도로 숨기지 않고 종료 계약 자체를 보완한다. 검증은 기존 protocol/coordinator 묶음과 두 종료 회귀 검사에 한정한다. 결과는 BUILD_HANDOFF.md 마지막 절을 따른다.

라운드 2 BUILD 결과: A01 및 두 종료 경계 검사 PASS, Wire/protocol/coordinator 33/33 PASS, Chrome 4/4 PASS, 타입/build PASS. 실제 API 0회, 기존 DB/adapter 소스와 증거 유지, commit/push 없음. 결과·수정 파일·제한은 BUILD_HANDOFF.md 마지막 절에 기록했다. 소스 manifest는 validation/runs/audit-repair-4e608b4-20261004/round2-source-manifest.json이다. 다음은 이 수정분의 AUDIT이며 자동 수행하지 않았다.

### 15.3 A02 명시적 종료와 재접속 취소 — 수정 라운드 3

2026-10-05 재감사에서 A01 및 서버 종료 순서는 PASS였고 A02는 FAIL이었다. heartbeat 재접속이 예약된 뒤 Wire.close를 호출해도 650ms 뒤 소켓이 1개에서 2개가 되고 closed=false로 돌아오는 기존 타이머 정리 누락을 재현했다. 사용자 “그래 수정하고 나머지도 ㄱㄱ”는 A02 수정·검증, 지금까지의 수정 커밋/푸시, 합성 입력의 실제 Jev 품질 및 Stage 검증을 승인한다. 실제 API 최대 총예산은 후속 답변으로 USD 1을 승인했다.

성공 기준: close 시 타이머 취소, 늦은 콜백의 종료 상태 검사, 기존 timeout 복구/인증 차단 유지. wire.ts의 reconnectTimer/close/onclose를 수정하고 evals/wire.test.ts에 명시적 close와 이미 대기한 콜백 두 검사를 추가한다. 실제 API는 dev 24 → 결과 확인 및 mapping 고정 → final 24 → Stage 2 순서로 최대 50회, 합산 USD 1의 usage 추정 예산을 적용하며 공급자 오류 시 재시도 없이 중단한다. 정상 앱의 유료 flags는 바꾸지 않고 승인된 CLI 프로세스에만 적용한다. 모델·의존성 다운로드 및 개인 자료/음성 사용은 하지 않는다.

이번 요청은 수정 후 다음 실행까지 승인했으므로 단계마다 다시 승인받지 않는다. 코드 수정/검증 결과와 실제 API 결과는 BUILD_HANDOFF.md 마지막 절에 기록한다. 기존 검증은 관련 소스가 유효한 범위에서 재사용한다. 사용자 요청으로 진행한 3차 수정이며 이후 같은 수정/재감사 루프를 자동 확장하지 않는다.
