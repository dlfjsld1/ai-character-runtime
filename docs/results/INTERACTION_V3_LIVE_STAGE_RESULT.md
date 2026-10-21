# 입력 해석 v3 실시간 판단→Stage 검증 — 2026-10-15

> 후속: [B1 일반 앱 연결](./RUNTIME_BASELINE_RESULT.md)을 완료했다. 아래62회 상한·factory 미등록은 이 실험 당시 상태다. 최신 누적 상한은64/25이며 이번4입력은 원래 G3-S 16입력을 대체하지 않는다.

사용자 승인으로 OpenAI Decisions 판단 상한을 누적 58회에서 **62회**로 늘리고, 기존 총 USD1 원장을 유지했다. 추가 **4회**는 한 합성 세션의 L1–L4에서 모두 실시간 호출됐다. 저장 응답 재생0, 물리 완료·usage 확인4/4, 자동 재시도0, 생성 API 호출0이다. 설치된 `gemma4:12b-it-qat`와 실제 Studio/Stage 브라우저를 연결했다. 감정·참여·대사·자막/ACK가 **4/4 통과**했고 독립 원장/DB 감사 실패0, 브라우저 오류0이다.

| 입력 | 실제 결과 |
|---|---|
| L1 공격 | frustration 0→0.12, `withholding` 침묵, 자막 없음 |
| L2 같은 사건 사과 | frustration 0.12→0.108, “사과해줘서 고마워.” |
| L3 점심 메뉴로 주제 전환 | frustration 약0.103이 남은 채 “그래, 이제 점심 메뉴 얘기해보자.” |
| L4 침묵 이유 질문 | 저장된 L1 이유를 참조해 “사실 아까 네 말이 좀 불편해서 대꾸 안 했어.” |

이전 [Stage 검증](./INTERACTION_V3_STAGE_RESULT.md)은 L1·L2 저장 원문 재생과 L3·L4 실시간 호출의 혼합 세션이었다. 그 당시 2/2 실시간 범위와 실패·복구 기록은 그대로다. 이번에는 새 전용 합성 DB `character_runtime_v3_stage_live`에 공식 마이그레이션 0001–0004와 초기 상태를 적용해 이전 상대의 감정 원인이 섞이지 않도록 했다. 재생 없이 한 세션의 네 판단 모두에서 실시간 Decisions→Core/Store→Gemma→Stage 경로를 확인했다. 준비 스크립트의 `--live` 인자 검증이 첫 실행에서 API 호출 전 거부됐으며, 이를 고친 뒤 manifest를 새로 고정했다. 거부된 manifest도 별도 보존했다.

원장 207 entry·판단58회·보수 차감 USD0.8500562에서 **211 entry·판단62회·USD0.8511103**가 됐다. 추가 입력10,541토큰의 [공식 단가](https://developers.openai.com/api/docs/guides/decisions) 기준 추정 비용은 USD0.0010541이다. 기존 usage 불명 예약1건은 보존했고 실제 청구 총액은 확인하지 못했다. 누적 판단 **62회 상한은 소진**됐으므로 남은 USD 잔액만으로 재실행하지 않는다.

`${ARTIFACT_ROOT}/interaction-v3-stage-20261015/live-run/`의 `audit.json`, `results.json`, L1–L4 request/response 원문, `L4-stage.png`, source snapshot, `cleanup.json`이 증거다. 독립 감사는 원장 접두부와 4개 예약·usage, source/manifest 해시, 합성 DB의 appraisal/response 완료, Stage 전달 기록을 대조했다. 집중 adapter 회귀77/77과 TypeScript 검사도 통과했다. 평가용 3001/55434/11435 서비스는 종료했다.

이는 평가 후보의 합성 경로 검증이다. **운영 factory는 Jev v6/Gemma 그대로**이며 v3 운영 채택, 제작자의 한국어·감정 체감 수용, 다중 상대·다중 감정 원인의 부분 수선 정책은 별도다. Goal2 전체와 Goal3/MVP 완료를 선언하지 않는다.
