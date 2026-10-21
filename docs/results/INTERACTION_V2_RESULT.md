# 입력 해석 구조 v2 구현 결과 — 2026-10-14

후속 상태: 2026-10-15 [실제 v2 진단12건](./INTERACTION_V2_DEV12_RESULT.md)을 실행했다. 고정 기준10/12·I02 평가 기준 정정11/12로 미채택이다. 아래 API0·원장173 entry는 이 문서 작성 당시의 구현/로컬 검사 범위다.

사용자의 “구조나 질문 자체에 구조적 결함이 있는 것 아니냐”와 “작업해”에 따라 [계획](../plans/INTERACTION_V2_PLAN.md)을 구현했다. **로컬 계약·정책·실제 합성 DB 검증은 완료했다. v2 실제 한국어 판단 품질과 공급자→생성→Stage는 미검증이다.** 운영 Jev v6/Gemma는 유지하며 새 후보는 평가용이다.

## 바뀐 동작

- 현재 입력과 과거 대화·침묵·원인을 분리한다. 현재 speaker/recipient는 입력 경로에서 제공하며 인용 안의 상대와 혼용하지 않는다.
- 이유 질문·듣기·사과·대상 정정을 각각 yes/no/unknown으로 표현한다. 사과와 정정이 함께 성립할 수 있다. 직접 공격·칭찬·세부 강도도 분리했다.
- 강도2/3 확률 질량으로 하한2가 확인되면 제한된 감정 자극을 준다. 최빈 단계의 confidence 때문에 전체 사건을 지우지 않는다. 강도 하한이 없으면 감정 증가0이지만 확인된 행위는 처리한다.
- 현재 공격은 증가0이어도 수선보다 우선한다. 듣기는 설명보다 우선하고 이유 설명 자체로 감정을 완화하지 않는다. 칭찬+새 질문은 질문에 답하며 반복 칭찬의 no_addition 침묵은 유지한다.
- v2 출처·버전·usage·event revision·context hash·저장 appraisal이 일치하지 않으면 Store가 중립 판정과 기술적 보류로 처리한다. 실패 표시와 비중립 판정이 함께 들어와도 감정을 올리거나 의도적 침묵 이유를 만들지 않는다.
- 유효한 같은 상대/원인·한 번의 marker를 요구하는 제한 회복, 주제 전환 뒤 감정 지속, explain/partial/deflect를 유지했다. 새 감정 축·DB migration·wire 형식은 없다. v2 감정 근거로 관계 점수를 바꾸지 않는다.

9질문과 `openai-interaction-v2` mapper/verifier를 구현했다. 기존 전송·비용·timeout 수명주기를 재사용하고 운영 factory에는 등록하지 않았다. predicate .95/.05는 새 계약의 가설이며 한국어 정확도가 검증됐다는 뜻이 아니다. [공식 Decisions 계약](https://developers.openai.com/api/docs/guides/decisions)의 predicate/choice/score 형태를 사용한다.

## 실제 확인 결과

| 검사 | 결과와 범위 |
|---|---|
| 변경 전 재현 | 일반 인용 발화 보류, 복수 행위, 공격 하한, 의미/기술 보류 구분 4건 실패 후 수정 |
| 단위 | **279/279**, adapter·계약·Core·기존 생성/판단 회귀 |
| 통합 | **122/122**: 실제 전용 PostgreSQL 114건 + DB 없는 평가기8건 |
| v2 DB | 위114 중14건: 공격→화제 전환→사과+정정→반복0, 삭제·복구, 선택 중 삭제, 혼합 행위, 출처, 침묵 이유, 자막 전달 프로토콜 |
| 타입 | tsc --noEmit exit0 |
| 기존 실제 기록 | Decisions24/24·Jev21/21 결과 동일, Decisions 요청24/24 동일 |
| 독립 검토 | 칭찬+새질문이 반복 침묵이 되던 문제 수정·동일 재현 확인. 실패 표시+위조 감정은 DB에서 .18 증가를 재현한 뒤0으로 수정 |

DB 자막 검사는 합성 대사의 generated→caption.shown→caption.finished 프로토콜 검사다. 브라우저 시각 확인이나 실제 생성 품질 검사로 계산하지 않는다. 합성 답을 주입한 검사를 모델의 한국어 인용·부정 이해 성공으로 바꾸지 않는다.

## 이전 점수의 해석 수정

[Decisions v1](./GOAL2_DECISIONS_RESULT.md)의 원래 기능 점수 **21/24**는 보존한다. 당시 보호 문항은 금지 행위가 없으면 defer도 합격 처리했다. A11/A13/A14/A15/A16/A20/A22/A24 **8건이 보류 상태의 합격**이었다. A09는 일반 메뉴 추천 요청에 확인 질문을 했지만 합격이었다.

동일 기록에 일반 입력의 정상 응답 기준을 추가하면 **12/24**다. 과거 결과 재분석이며 새 모델 점수나 재실행이 아니다. 새 평가기는 의미·감정·보호·참여를 따로 보고하고 response/clarification/intentional_silence/semantic_defer/technical_defer를 구분한다. 의도적 침묵이 정답이면 응답을 강요하지 않는다.

## 비용·자료·다음 단계

이번 API·생성·다운로드0. 기존 원장173 entry는 byte 단위로 동일하고 보수 차감 **USD0.8412455**, 이전 unknown 예약과 생성24/판단36 한도를 유지한다. 잔여액/횟수는 새 실험의 자동 실행 승인이 아니다. 기존 미사용 HA12를 v2 확인 평가로 전용하지 않는다.

자료는 `${ARTIFACT_ROOT}/interaction-v2-20261014/`의 baseline/, red/최종 검사 JSON, compatibility-proof.json, historical-outcomes.json, prepared-dev12.json, docs-before/다. 이번에 시작한 전용 DB55435는 종료했고 listener0을 cleanup.json으로 확인했다.

다음은 [고정 진단12문항](../../evals/fixtures/interaction-v2.json)에 **실제 공급자 답**을 넣어 네 축을 확인하는 것이다. 해당 과거 사건을 문맥에 넣은 요청·기대값을 준비했다. 알려진 실패를 포함한 진단이며 미사용 확인 세트가 아니다. 실제 실행 범위와 동일 원장 사용 권한을 확정한 뒤 진행하고, 통과하면 별도 확인 평가·Goal3 연속 Stage·제작자 수용으로 간다. Goal2 전체/MVP 완료·운영 교체는 아직 아니다.

네트워크 없는 재분석과 요청 준비:

```powershell
node --experimental-transform-types evals/interaction-eval.ts ${ARTIFACT_ROOT}/goal2-decisions-20261014/provider/results.json ${ARTIFACT_ROOT}/interaction-v2-20261014/historical-outcomes.json
node --experimental-transform-types evals/interaction-eval.ts --prepare ${ARTIFACT_ROOT}/interaction-v2-20261014/prepared-dev12.json
```

요청을 다시 준비하면 합성 UUID가 새로 만들어진다. 실제 비교는 실행 직전 고정한 manifest의 요청·질문·소스 해시를 사용한다.
