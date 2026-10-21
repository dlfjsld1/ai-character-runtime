# 문서 안내

현재 상태는 [STATUS](STATUS.md) 한곳에서 관리합니다. 기획 문서에는 요구사항과 기준을, 결과 문서에는 해당 실행의 증거와 한계를 남깁니다. 과거의 “다음 작업”을 오늘의 지시로 읽지 않습니다.

## 어디서 읽을까

| 목적 | 문서 |
|---|---|
| 지금 어디까지 했는지 | [현재 진행 상태](STATUS.md) |
| Claude에 이어 맡기기 | [맥락·문제·다음 작업 인계](guides/CLAUDE_HANDOFF.md) |
| 무엇을 만드는지 | [제품 기획](product/PRODUCT_PLAN_V3.md), [MVP 범위](product/MVP_SPEC.md), [캐릭터 설정](product/CHARACTER_PRESET.md) |
| 감정·기억·통신 구조 | [감정 구조](architecture/AFFECTIVE_ARCHITECTURE_V2.md), [도메인](architecture/CHARACTER_DOMAIN_SPEC.md), [DB](architecture/DATABASE_SPEC.md), [프로토콜](architecture/RUNTIME_PROTOCOL.md) |
| 실행과 모델 연결 | [실행 안내](guides/RUNBOOK.md), [로컬 모델](guides/LOCAL_AI_INTEGRATION.md), [DeepSeek](guides/DEEPSEEK_CONNECTION.md) |
| 홈 비서의 다음 범위 | [H2-A](plans/HOME_ASSISTANT_H2A_PLAN.md) |
| 사건·결과에 따른 감정 | [전체 계획](plans/OUTCOME_AFFECT_PLAN.md), [현재 C2-L 기준과 결과](plans/OUTCOME_AFFECT_REFERENCE_PLAN.md#r4-c2l-build) |
| 마감된 릴리스 | [텍스트 MVP](results/MVP_CLOSEOUT.md), [홈 비서 H1](results/HOME_ASSISTANT_H1_RESULT.md) |
| 변경 이유와 과거 작업 | [기획 변경 기록](history/PLANNING_CHANGELOG.md), [개발 이력](history/BUILD_HISTORY.md) |

## 폴더 구분

- `product/`: 제품 목적, 범위, 캐릭터 설정
- `architecture/`: 도메인, 저장소, 통신과 감정 구조
- `guides/`: 실행·연결 안내
- `plans/`: 단계별 계획과 성공 기준. 누적 계획은 각 절의 시점을 함께 읽습니다.
- `results/`: 실행별 결과와 마감 기록. 과거 PASS를 현재 코드 전체의 보증으로 사용하지 않습니다.
- `research/`: 미채택 연구와 선택적 실험
- `history/`: 누적 인계, 이전 결정, 과거 실행 절차
- `archive/`: 기획 개정 전 원본. 원본 해시·경로·내용을 보존하므로 현재 실행 안내로 사용하지 않습니다.

## 로컬 경로와 증거 표기

공유 문서는 개인 드라이브나 사용자 홈의 절대 경로를 지정하지 않습니다. 검증 자료는 Git 밖에 보관하고, 결과에는 실행 폴더 이름과 파일 이름을 남깁니다.

이전 기록의 경로는 `${ARTIFACT_ROOT}`(프로젝트 검증 자료), `${LOCAL_AI_ROOT}`(모델·도구), `${REPO_ROOT}`(체크아웃), `${USER_HOME}`(사용자 홈), `${MODEL_CACHE_ROOT}`(모델 캐시), `${LOCAL_SOURCE_ROOT}`(로컬 참고 자료), `${LEGACY_LOCAL_ROOT}`(이전 독립 설치 폴더 전체)로 표기했습니다. 이것은 문서의 자리표시자이며 런타임이 자동으로 읽는 새 환경변수가 아닙니다. 과거 명령을 재현할 때 실제 로컬 위치로 대입해야 합니다. 일부 평가 도구에는 기존 실행 위치 제약이 남아 있으므로, 표기 변경이 도구의 출력 경로 제한을 바꾼 것은 아닙니다.

`archive/`의 원본은 이 치환 대상에서 제외했습니다. 보관소 안의 예전 상대 링크도 당시 디렉터리 구조를 기준으로 합니다. 현재 탐색에는 이 안내와 STATUS를 사용합니다.
