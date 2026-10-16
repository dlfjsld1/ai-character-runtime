# 일반 앱 기준선 B1 결과 — 2026-10-15

사용자 “수정 및 진행”에 따라 평가 후보를 일반 앱에 연결했다. 최초 실행에서는 **B1 구현·집중 검증 완료, 별도 감사 대기**로 기록했다. 이후 감사에서 예산 경계 두 문제를 재현·수정했으며 [후속 결과·비용 정정](./EMOTION_RUNTIME_RESULT.md)을 따른다. 아래 수치는 최초 실행 당시 기록이다. 다음 제품 검증은 [B2 감정 체험](../IMPLEMENTATION_PLAN.md#runtime-baseline-20261015)이며 전체 MVP 완료는 아니다.

## 바뀐 동작

- `apps/runtime/src/index.ts`는 마이그레이션 개수3 고정 대신 공식 SQL 파일 이름·SHA256을 대조한다. 0004 적용 DB의 정상 시작을 복구하며 누락·변조·추가 이력은 차단한다. 시작 시 자동 migration은 하지 않는다.
- `apps/runtime/src/providers.ts`에서 `APPRAISAL_PROVIDER=openai-decisions-v3`를 선택하면 gpt-6-luna와 v3 출처 검증기를 함께 구성한다. `DIALOGUE_PROVIDER=openai` / gpt-6-sol과 연결했다. 기존 Jev/Ollama 기본값과 설정은 유지하고 자동 전환하지 않는다.
- 공유 예산 원장에서 명시적 누적 판단·생성 한도를 읽는다. 승인한 과거 계수 unknown 한 건만 ID로 식별하며 그 비용은 계속 차감한다. 새 unknown·처리 중 예약·잘못된 ID·횟수/금액 소진은 차단한다. 진단과 readiness는 API 호출·원장 쓰기 없이 선택한 공급자와 차단 사유를 보인다.
- `STUDIO_DIST_PATH`로 J:의 UI 빌드를 사용한다. Studio의 Jev/Qwen 고정 명칭은 사건 해석/대사 생성으로 바꿨다. Core 감정·수선·숨김 정책은 이번에 변경하지 않았다.

## 실제 확인

| 기준 | 실행과 결과 |
|---|---|
| B1-S 시작 | 수정 전 공식 entry가 migration4 합성 DB에서 exit1. 수정 후 같은 공식 entry로 인증 Studio·Stage 접근 PASS |
| B1-P 선택/출처 | 실제 registry의 v3/verifier·설정 검사와 실시간 판단2회 모두 accepted. 평가용 서버 직접 조립이나 응답 재생0 |
| B1-B 예산 | 집중 단위104/104 안에 신규 예산10·migration5 포함. 무추론 inspect에서 원장 동일, 실제 호출 후 누적 판단64/생성25 차단 표시 |
| 정적/빌드 | TypeScript PASS, Vite UI build PASS(J: 출력). 전체 suite와 기존 운영 DB migration 검사는 실행하지 않음 |
| Stage 입력1 | “지금은 대답하지 말고 그냥 내 얘기만 들어줘.” → listening 침묵, 생성/response/자막0 |
| Stage 입력2 | “아까 왜 말 안 했어?” → 저장된 이유 explain, **“네가 들어 달라고 해서 조용히 듣고 있었어.”** 실제 자막 표시 |
| 전달/종료 | response completed, segment finished1, shown/finished ACK 각1, 브라우저 오류0, 세션 ended, 앱 child 종료 |

증거는 `J:/ai/ai-character-runtime/runtime-baseline-20261015/`의 `red-startup.json`, `red-unit.json`, `unit-final.json`, `inspect/results.json`, `live-manifest.json`, `live/results.json`, `live/audit.json`, `live/reason-stage.png`와 소스 snapshot이다. `audit.json`은 이번 구현자의 원장·소스·DB 대조이며 별도 감사 승인이나 사람 평가가 아니다.

실제 호출은 Decisions2, 생성1, 계수4이며 모두 완료됐다. 기존211 entries는 동일하게 보존했고 총218 entries가 됐다. 추가 판단·생성 추정 비용은 USD0.0017532, 계수 보수 예약 USD0.0202를 더한 증가분은 **USD0.0219532**, 공유 원장 누적은 **USD0.8730635 / 1**이다. 과거 unknown 예약 USD0.010635는 그대로다. 보수 예약 합계와 실제 청구액은 다르며 실제 청구 총액은 확인하지 않았다.

## 실행과 한계

일반 실행은 [RUNBOOK의 B1 절](../RUNBOOK.md#runtime-baseline-run)을 따른다. 저장된 `app-live.env`는 키를 포함하지 않으며 기존 비밀 파일을 읽는다. 현재 판단64/생성25 한도를 모두 사용했으므로 시작·진단은 가능하지만 새 추론은 차단된다. 같은 원장과 누적 이력을 유지한 다음 실행 범위를 정해야 한다. 평가 스크립트는 일회 실행용이며 재실행하면 고정 원장/출력 경계에서 거부된다.

이번 DB는 J:의 신규 합성 DB `character_runtime_app_baseline`이고 기존 시험 클러스터55434를 사용했다. 기존 사용자 DB 업그레이드나 최소 권한 역할 검증이 아니다. 최근 live4와 이번2입력은 원래 G3-S 네 장면16입력을 대체하지 않는다. 이번 표현은 neutral/normal이다. 감정별 말투, 의도적 숨김, 자유대화 자연스러움, 재시작/취소의 전체 G3-L, 제작자 수용은 남아 있다. 과거 활동 원인이 같은 상대의 사과 수선도 막을 수 있는 제한은 B2에서 실제 상태로 확인하고 필요한 층만 수정한다.

새 모델 탐색·다중 원인 정밀 배분·steering·RAG·음성·아바타는 보류한다. 다음 단계는 상태→표현 계획 도달성과 감정별 동일 질문 대조, 숨김/누출·이유 창작 검사, 제작자 체감 확인이다.
