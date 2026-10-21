# AI Character Runtime

감정이 대화 사이에 이어지고, 상황에 따라 말하거나 의도적으로 침묵하는 캐릭터 런타임입니다. 판단·생성 모델은 어댑터로 분리하고, 감정 상태와 기억은 런타임이 관리합니다. 홈 비서의 자료 검색과 사용자 정보 저장으로 확장하고 있습니다.

- [문서 안내](docs/README.md): 기획, 설계, 실행 방법, 검증 결과
- [현재 진행 상태](docs/STATUS.md): 완료 범위, 미검증 항목, 다음 작업
- [제품 기획](docs/product/PRODUCT_PLAN_V3.md)
- [실행 안내](docs/guides/RUNBOOK.md)

텍스트 MVP와 홈 비서 H1은 마감했습니다. 이후 H2-A와 사건 기반 감정 처리는 개발 중입니다. 모의 검증 통과와 실제 모델·Stage 검증을 구분하며, 상세 판정은 현재 진행 상태를 따릅니다.

## 구성

| 위치 | 역할 |
|---|---|
| `apps/runtime` | 런타임 서버와 공급자 연결 |
| `apps/studio` | Studio와 Stage 화면 |
| `packages` | 감정 Core, 계약, 어댑터, PostgreSQL 저장소 |
| `evals` | 합성 평가, 회귀 검사, 저장 응답 재생 |
| `docs` | 프로젝트 문서 |

Node.js 22.19 이상과 저장소가 지정한 pnpm을 사용합니다. 실제 실행에는 PostgreSQL과 선택한 모델의 설정이 필요합니다. 설정 항목은 [.env.example](.env.example)을 참고하세요. 개인 경로와 비밀 값은 Git에서 제외된 로컬 설정에 둡니다.
