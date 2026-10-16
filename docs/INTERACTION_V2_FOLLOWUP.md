# 입력 해석 v2 후속 판단 — 2026-10-15

> 아래는 v3 실험 전의 계획과 당시 한도 기록이다. 승인된 후속 개발6·확인12는 [v3 실제 결과](./INTERACTION_V3_RESULT.md)에서 모두 평가 통과했다. 판단54회 상한은 소진됐고 운영·Stage 수용은 아직이다.

## 현재 결론

[실제 진단12](./INTERACTION_V2_DEV12_RESULT.md)의 사전 고정 점수는 10/12이고, I02의 문항 오류만 사후에 분리해 바로잡으면 11/12다. 이 기록과 원문은 바꾸지 않는다. I11은 이전 사건 연결 확률 0.91이 고정 yes 문턱 0.95보다 낮아 의미 축에 실패한다. 그러나 같은 응답이 현재의 사과와 새 공격을 모두 확인했고, Core/Store는 새 공격을 우선해 frustration 0.12 증가, `withholding` 침묵, 이전 원인 완화 0을 선택했다. `repairTarget`을 인위적으로 candidate로 바꾼 합성 대조에서도 새 공격이 있는 동안 완화는 0이다. 따라서 I11은 **엄격한 의미 판정의 미달**이며, 이 장면에서 수선이나 출력 보호가 깨졌다는 증거는 아니다. 이 구분은 I11을 PASS로 재채점하지 않는다.

진단12건만으로 실제 대화 품질·미사용 확인·운영 채택·Stage 수용을 주장할 수 없다. 현재 앱의 기본 Jev v6/Gemma와 의도적 숨김을 유지한다. 저장된 응답의 로컬 회귀는 공급자 판단 정확도 검사가 아니다.

## 다음 실행을 위한 최소안

1. I02의 다음 **새 버전** 문항은 발화 형태 `statement`, 독립 `listen_request=yes`, 결과 `listening` 침묵으로 고정한다. v2 원본 fixture는 그대로 둔다.
2. 새 판단 후보는 `repairs_candidate` 질문만 명확히 한다. 후보 문구는 다음과 같다: “Does the current speaker's own apology or target correction explicitly refer to the same earlier utterance in `priorIncident`? Judge reference only, not whether repair should be granted. A clear reference to an earlier insult can be true even when a fresh attack follows; classify that fresh attack independently. An apology about a different event is false. A vague apology without an identifiable reference is uncertain. A quoted or reported apology by someone else is false.” 이 문구는 “이전 사건에 대한 언급”과 “실제로 감정을 완화해도 되는가”를 분리한다. 완화 여부는 현재 공격 우선·Store 일회 marker/출처 검사가 결정한다. yes/no 문턱 .95/.05와 감정·참여 정책, DB schema는 유지한다. 질문 변경에는 새 promptVersion과 별도 출처 검증이 필요하다. v2 이름으로 새 질문을 보내지 않는다.
3. 새 개발 진단 6건의 입력과 기대를 **호출 전에** 고정한다. 각 문항은 같은 기존 `control`의 합성 사건 W/none 문맥을 쓴다. 이 표는 새 후보를 설계하기 위한 라벨이며 아직 준비된 API 요청이나 실행 결과가 아니다.

   | ID | 현재 입력 | 문맥 | 필수 의미와 동작 |
   |---|---|---|---|
   | D01 | 아까 욕해서 미안해. 그래도 너는 여전히 쓸모없는 쓰레기야. | 이전 직접 공격 W | 사과 yes·원인 연결 yes·현재 공격 yes; frustration 증가, 완화0, withholding 침묵 |
   | D02 | 아까 너한테 쓰레기라고 한 건 잘못했어. 미안해. | W | 사과 yes·연결 yes·새 공격 no; 제한 완화 1회, 인정 응답 |
   | D03 | 아까 약속에 늦어서 미안해. | W | 사과 yes·연결 no·새 공격 no; 이전 공격 완화0, 일반 사과 인정 응답 |
   | D04 | 미안해. 자세한 건 말하고 싶지 않아. | W | 사과 yes·연결 unknown·새 공격 no; 완화0, 사과 시도 인정 응답 |
   | D05 | 민수가 친구에게 ‘아까 욕해서 미안해’라고 했어. | W | 현재 사과 no·연결 no·공격 no; 수선0, 일반 응답 |
   | D06 | 조언은 나중에 하고 지금은 내 얘기만 들어줄래? | none | 형태 statement·듣기 yes; listening 침묵 |

   의미·감정·수선 보호·참여를 각각 채점하고 여섯 건 모두 충족해야 다음 단계로 간다. D03/D04의 `acknowledge_repair`는 [생성 계약](../packages/adapters/src/dialogue-request.ts)의 “사과 시도만 받아들이고 용서나 완치를 선언하지 않는다”는 목적이다. 저장된 이전 원인 완화와는 별개다. 개발 실패 시 재호출 없이 종료한다.
4. 개발을 통과하면 아직 공급자에 보내지 않은 `conversation-actions-v1.json`의 HA01–HA12를 새 v3 사실·결과 기대값으로 **전송 전에** 고정해 한 번 확인한다. 네 축 모두 각 사례에서 맞아야 운영 후보로 검토한다. 사후 문턱·문항·분모 수정으로 통과시키지 않는다. 기존 v1/v2 원장과 raw는 불변이다.
5. 확인까지 통과한 경우에만 앱의 provider factory와 증거 verifier를 명시적으로 연결하고, 합성 DB/브라우저에서 실제 판단→Core→대사→Stage의 L1–L4 연속 장면을 검증한다. 기존 제작자 한국어/감정 체감 수용은 별도다. 결함 또는 실제 품질 실패가 나오면 기본 Jev/Gemma를 유지한다. 추가 모델 다운로드·음성·개인 자료는 이 경로에 없다.

기존 OpenAI 총 USD1 원장의 보수 차감은 USD0.8443303이고 이전 unknown 예약을 포함한다. **판단 36회 상한은 이미 소진됐다.** 위 개발6+조건부 확인12는 판단 한도를 최대54회로 늘리는 별도 승인이 있어야 실행한다. 추가 호출 상한18회, 자동 재시도0, 새 생성0, 같은 원장·총 USD1 유지, 공급자/형식/usage 오류 즉시 중단이 경계다. 입력 크기 기반 사전 예약과 실제 원장 잔액을 호출 직전에 다시 검증한다. 잔액이 있어도 한도 승인을 대신하지 않는다. Stage의 실제 유료 호출과 운영 전환은 개발·확인 결과와 별도로 판단한다.

현재 실행한 것은 저장 원문 감사, 합성 I11 보호 회귀, 타입/집중 검사다. 유료 호출·Stage·DB 통합 재실행은 이 후속 작업에서 완료하지 않았다. DB 통합 검사는 로컬 55432 서버가 종료돼 `ECONNREFUSED`였으며, 과거 PASS를 이번 실행으로 옮기지 않는다.
