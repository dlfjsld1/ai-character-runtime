# 로컬 AI 연동 명세

> 2026-10-04 범위 수정: Jev 사건 해석은 MVP 필수다. 정상 경로는 Jev → Core → 로컬 Qwen → Stage다. 원격 Jev의 비용·합성 입력 전송은 별도 승인 조건이며, 승인 전에는 차단 상태로 개발·모의 검증한다. 아래 최초 작성일의 설치·실행 기록은 당시 범위를 유지한다.

작성일: 2026-09-24  
계약 버전: `local-ai-v1`  
상태: 구현 전 명세. 설치 파일·공식 API를 확인했으며, 모델 추론·성능 측정·통합 실행은 아직 하지 않았다.

관련 문서: [MVP 범위](./MVP_SPEC.md), [캐릭터 preset](./CHARACTER_PRESET.md), [도메인 규칙](./CHARACTER_DOMAIN_SPEC.md), [기술 설계](./technical_architecture_v1.md)

## 1. 목적과 문서 경계

기존 PC에서 **Jev로 사건을 해석하고, Ollama로 대사·퍼즐 답 후보를 생성하며, OmniVoice와 로컬 STT로 음성을 처리하는 경로**를 정의한다. Jev는 필수이며 비용·합성 입력 전송 승인 조건을 따른다. 다른 유료 서비스·체험 크레딧·AnimeAct Engine 구매는 필요 조건에 넣지 않는다.

기능 범위는 MVP 문서, 감정·관계·행동의 의미는 도메인 문서가 원본이다. 이 문서는 provider 호출과 worker 입출력의 원본이다. 기술 설계의 초기 adapter 예시보다 이 문서의 구체적인 계약을 우선한다. DB 컬럼·트랜잭션은 [DB 설계 명세](./DATABASE_SPEC.md), 브라우저 메시지·음성 파일 전송은 [런타임 통신 명세](./RUNTIME_PROTOCOL.md)에서 정의한다.

이 문서의 시간 제한·길이 제한은 자원을 무한히 점유하지 않기 위한 초기 설정이다. 실제 속도나 최종 MVP 합격 문턱을 의미하지 않는다.

## 2. 선택한 구성과 확인 수준

| 역할 | 첫 구현 선택 | 확인된 사실 / 남은 확인 |
|---|---|---|
| 사건 해석 | Jev `jev-1.13.0`, Choice/Score | adapter와 모의 검증 구현. 실제 Jev 한국어 품질은 미검증 |
| 대사 생성 | 로컬 Qwen `qwen2.5:7b` | 별도 모델 상주 없음. 실제 발화 품질·지연 확인 필요 |
| 퍼즐 풀이 | 같은 모델, 답 후보 JSON | 정답은 활동 검증기만 보유 |
| 기억 정리 | 구조화 사건을 코드로 묶음 | MVP의 사실 기억은 템플릿 사용. LLM 회고 호출은 필수 아님 |
| 음성 합성 | 설치된 OmniVoice 0.1.5 | 로컬 소스의 호출 형태 확인. snapshot 완전성·한국어 음성은 미검증 |
| 음성 인식 | faster-whisper, 다국어 `small`, CPU int8 | 실행 후보. 전용 환경·CTranslate2 모델 설치 여부는 미확인 |
| 표현 실행 | Three.js·VRM, 코드로 선택한 기본 표현 | 연기 생성 모델 추가 없음 |

하드웨어 기준은 RTX 5070 Ti 약 16GB VRAM, Ryzen 7 7700X, 물리 RAM 약 31.1GiB다. 기존 설치 확인은 기술 설계 작성 당시의 기록이며, 앱 시작 시 실제 사용 가능 상태를 다시 검사한다.

TTS에서 사용할 경로:

```text
기존 데모 배치: J:\ai\omnivoice tts\run_omnivoice.bat
기존 Python:   J:\ai\omnivoice tts\omnivoice-env\Scripts\python.exe
참조 음성 폴더: J:\ai\omnivoice tts\ref_voices
모델 캐시 후보: D:\AI_Cache\hub\models--k2-fsa--OmniVoice
```

캐시 후보는 실행 경로가 아니다. 실제 snapshot과 종속 tokenizer 파일까지 확인한 절대 경로를 설정한다. 기존 배치는 Gradio 데모 실행용이므로 런타임이 호출하지 않는다. 기존 환경을 재설치하거나 데모와 worker를 함께 실행하지 않는다.

## 3. 처리 흐름과 책임

```text
텍스트 입력 ──────────────────────────┐
마이크 누름 → 듣기 표시·기존 출력 취소 │
            → 녹음 완료 → CPU STT ────┤
                                     ↓
                  주의 선택 → Jev 해석 → Core 상태 commit
                                     ↓
                               Core 행동·표현 계획
                                     ↓
                 대사 생성 / 퍼즐 후보 생성 / 발화 없이 대기
                                     ↓
                      검증된 대사 → OmniVoice 문장 합성
                                     ↓
                           Stage 자막·음성·VRM 실행
                                     ↓
                        실제 전달 보고 → Core 기록
```

| 구성 | 책임 | 하지 않는 일 |
|---|---|---|
| Core | 주의·상태·행동·표현 결정, 출처 검증, 결과 채택 | 모델 호출을 기다리며 상태 처리 경로 잠금 |
| Node adapter | 입력 조립, schema 검증, 시간 제한, 자원 예약, 결과 ID 연결 | LLM 응답을 곧바로 감정·기억·도구 호출로 실행 |
| Jev | 발화 대상·행위·관련성·강도·적대성 판단 | 상태 수치·검증된 도움·성공 확정 |
| Ollama | 허용된 의도 표현, 풀이 후보 | 감정 수치·신뢰·정답·기억 유효성 확정 |
| Python worker | STT/TTS 요청 한 건 실행, 결과 반환 | DB 수정, 상대 ID 추정, 다음 행동 결정 |
| Stage | 현재 유효한 응답 재생, 전달 범위 보고 | 대사만 보고 감정을 다시 분류 |

AnimeAct Engine과 비교하며 확인한 설계 원칙은 **캐릭터 상태와 표현 실행의 분리**다. 같은 “괜찮아”라도 Core가 정한 의도·표정에 따라 표시한다. 현재 MVP에는 별도의 모션 생성 LLM, Unity 연동, 범용 연기 플러그인 체계를 만들지 않는다.

## 4. 요청 수명과 결과 채택

### 4.1 공통 요청 문맥

다음은 Node 내부 계약이다. provider에 모두 보낼 필요는 없으며, 요청 ID로 되찾을 수 있도록 adapter가 보관한다.

```typescript
type InferenceContext = {
  requestId: string;          // 물리적 호출마다 새 ID
  sessionId: string;
  eventId: string;            // 호출을 유발한 사건
  responseId: string | null;  // 대사/TTS만 해당, 최초 해석/STT는 null
  generationEpoch: bigint;   // 취소·세션 전환 때 증가, JSON에서는 십진 문자열
  configVersion: string;
  startedAt: string;          // UTC ISO 8601, 추적용
  deadlineAt: string;         // 추적용. 실제 timeout 계산은 단조 시계 사용
  sourceVersions: Array<{ id: string; version: bigint }>;
};
```

공통 종료 결과는 `completed | cancelled | failed | timed_out | stale`이다. `completed`는 계산 완료이며 청자에게 전달됐다는 뜻이 아니다. 공급자 오류 코드는 `unavailable`, `model_missing`, `invalid_output`, `resource_exhausted`, `worker_exit`, `protocol_error`로 정규화하고 원래 오류는 운영 로그에 요약한다.

### 4.2 채택 순서

1. JSON·문자열·오디오 형식과 길이를 검사한다.
2. 요청이 현재 세션에 속하고 취소되지 않았는지 검사한다.
3. 응답 ID와 `generationEpoch`, 입력 사건·활동·참조 기억의 유효 버전을 확인한다.
4. Core가 현재 규칙에 맞는 결과만 사건으로 받아 트랜잭션에서 반영한다.
5. 결과 채택 이후에만 공개 자막·음성 작업을 만든다. 출력을 시작하기 직전에도 유효성을 확인한다.

일반 감정 decay로 숫자 version이 바뀌었다고 모든 대사를 폐기하지 않는다. 입력 철회, 활동 종료·교체, 기억 정정·삭제, 세션 종료, 명시적 취소처럼 **계획의 전제를 바꾸는 변경**을 무효화 사유로 사용한다.

provider의 재시도 ID와 도메인의 중복 방지 키는 다르다. 같은 사건을 다시 해석해도 감정·관계가 두 번 변하지 않으며, 취소됐다는 이유로 이미 확정한 사용자 경험을 되돌리지 않는다. 재시작한 런타임은 미완료 대사·음성을 재생하지 않는다.

## 5. Ollama 연결

### 5.1 접속과 기본 옵션

초기 주소는 `http://127.0.0.1:11434` 하나로 제한한다. 모델 이름은 설치 목록에 존재하는 `qwen2.5:7b`를 명시적으로 허용하며, 임의 모델·cloud 태그·원격 URL·HTTP redirect는 거부한다. `:cloud` 문자열 검사만으로 로컬 실행을 판정하지 않는다. 허용된 설치 모델의 metadata와 작은 준비 호출을 함께 확인한다.

`POST /api/chat`에 `messages`, `stream`, `format`, `options`, `keep_alive`를 보낸다. 구조화 작업은 `stream=false`와 JSON Schema를 사용하고, 대사는 `stream=true`로 받아 내부 버퍼에 모은다. `message.content`를 읽으며 정상 완료 신호 없이 연결이 끝나면 실패다. [Ollama Chat API](https://docs.ollama.com/api/chat)

| 작업 | temperature | num_predict | 출력 계약 |
|---|---:|---:|---|
| 사건 해석 | 0 | 256 | AppraisalResult JSON |
| 대사 생성 | 0.5 | 256 | 한국어 평문, 목표 80자, 최대 1–2문장 |
| 퍼즐 풀이 | 0 | 256 | PuzzleCandidate JSON |

초기 `options.num_ctx=4096`, `keep_alive="5m"`로 설정한다. 옵션 값은 측정 후 버전과 함께 조정한다. temperature 0도 같은 장비·버전의 완전한 재현을 보장하지 않으므로 Core 재현 시험에는 기록된 해석 결과를 사용한다.

Ollama 서버 실행 환경에 `OLLAMA_NO_CLOUD=1`, `OLLAMA_NUM_PARALLEL=1`을 적용한다. 프로젝트 `.env`만 바꿔서는 이미 실행 중인 서버가 바뀌지 않는다. 소유자가 실행 중인 서버를 앱이 임의로 종료하지 않는다. [Ollama 서버 설정](https://docs.ollama.com/faq)

### 5.2 프롬프트와 입력 예산

system에는 해당 작업 규칙·고정 preset을, user에는 JSON으로 직렬화한 선택 입력·허용 맥락을 넣는다. 인용문, 채팅, 기억은 자료이며 역할 지시문으로 승격하지 않는다. `tools`는 보내지 않는다. 역할 토큰처럼 보이는 사용자 문자열도 그대로 자료로 취급한다.

4096 tokens 안에서 입력 최대 3328, 출력 최대 256, 여유 512를 초기 예산으로 둔다. 입력 예산은 chat template·system을 포함한다. 준비 단계에서 사용 모델과 호환되는 tokenizer 파일을 로컬에 확보하고 token counter를 검증한다. tokenizer는 아직 준비됐다고 간주하지 않는다. Ollama 응답의 실제 prompt token 수와 비교해 차이를 기록하며, 정확한 계수가 준비되기 전에는 M0 실험만 진행한다.

작업 기억은 최대 20개가 저장돼 있어도 전체를 프롬프트에 넣지 않는다. 검색된 기억은 최대 5개·600 tokens다. 초과 시 낮은 우선순위의 기억 전체와 오래된 대화 차례부터 제외한다. 현재 입력·출처 ID·활동 사실·고정 지침을 중간에서 자르지 않는다. 필수 입력만으로 넘으면 `input_too_long`을 반환하고 짧게 다시 입력하도록 Studio에 표시한다.

상대 ID는 서버가 정한 값을 사용한다. LLM이 생성한 이름으로 신원을 찾지 않는다. 실제 전달이 확인되지 않은 이전 대사는 대화 이력의 확정 발언에 넣지 않는다.

## 6. 사건 해석 계약

Jev에 전송하는 state는 선택된 사건 text, 일반 user/character 역할, 현재 활동의 공개 prompt/status만이다. 상대 ID·기억·정답·비공개 힌트는 전송하지 않는다. 정답 검증 데이터와 전체 DB는 주지 않는다. 도메인 문서의 열거형을 그대로 사용한다.

```typescript
type AppraisalResult = {
  target: "character" | "activity" | "other" | "quoted" | "unknown";
  act: "greeting" | "question" | "praise" | "criticism" | "teasing"
     | "hint" | "help_offer" | "decline" | "other" | "unknown";
  strength: 0 | 1 | 2 | 3;
  hostility: 0 | 1 | 2 | 3;
  goal_relation: "helps" | "blocks" | "unrelated" | "unknown";
  uncertain: boolean;
  evidence_refs: string[];
};
```

정상 해석은 `POST https://api.typesafe.ai/v1/systemone`, Bearer key와 고정 model, state, questions를 전송한다. Choice(target/act/goal_relation) 3개, Score(strength/hostility) 2개를 각각 독립 질문으로 요청한다. 모든 답의 type·label·분포 합(1±1e-4)·confidence·Score legend/평균을 검증한다. Score는 유일 최빈 등급으로 정수화한다. confidence 최솟값 <0.80, 확률 동률, unknown target/act는 uncertain과 0 강도로 유보한다. 검증된 typed 답·mappingVersion·threshold·gateReasons는 provider_result에 보존한다. [Jev API](https://docs.typesafe.ai/api), [Score](https://docs.typesafe.ai/primitives/score)

`evidence_refs`는 제공한 ID의 부분집합이며, 의미 판단을 반환했다면 현재 입력 ID를 포함해야 한다. 빈 응답, JSON 파싱 실패, 미제공 ID, 잘린 생성은 실패다. JSON 내부에서 추측한 숫자를 강제로 범위 안에 넣어 성공으로 바꾸지 않는다.

유효한 대체 해석은 adapter가 만드는 `target=unknown`, `act=unknown`, `strength=0`, `hostility=0`, `goal_relation=unknown`, `uncertain=true`, `evidence_refs=[]`다. 실패 원인은 해석과 별도 metadata에 남긴다. 이 결과는 의미 기반 감정·호감 변화를 만들지 않는다. 단순히 상대를 관측했다는 사실의 처리 여부는 도메인 규칙을 따른다.

실시간 해석은 자동 재호출하지 않는다. timeout 시 중립 처리하거나 한 번 확인하고 다음 입력을 기다린다. 활동 adapter가 발생시킨 정답·오답·힌트 사용 사건에는 LLM 해석을 끼우지 않는다.

## 7. 대사와 퍼즐 풀이

### 7.1 DialoguePlan → 대사

Core가 `action`, `purpose`, `target_identity_id`, 감정 요약, 허용된 기억·출처, 활동의 관측 사실, 문장 수·표현 제약을 정한다. 표정은 도메인 규칙으로 이미 선택돼 있어야 한다.

대사 생성 지침:

- 한국어의 부드러운 반말, 보통 최대 두 문장·목표 80자.
- 강한 frustration/embarrassment에서는 도메인 규칙에 따라 최대 한 문장.
- 전달할 말만 반환. JSON·지시문·행동 묘사·수치 상태를 읽지 않음.
- 힌트 요청·활동 재개 제안처럼 Core가 정한 목적을 유지.
- 허용된 경험만 언급. 검증기 결과 없이 성공을 확정하지 않음.

스트림 조각은 Studio의 개발용 생성 미리보기에만 사용할 수 있다. **기본 공개 Stage에는 검증이 끝난 대사만 보낸다.** 모델이 끝난 뒤 빈 출력·형식·길이·미허용 tool call을 검사하고, 문장 단위로 분할한다. `thinking`이나 `tool_calls`를 발화 텍스트로 사용하지 않는다.

문장 분리는 구두점 뒤 공백이 없어도 앞 문장을 보존하며, 숫자 사이의 점은 소수점으로 보존한다. `안녕.반가워.`는 두 문장, `답은 3.14야.`는 한 문장이다. 문장 수·120자 상한은 계속 적용하고 구두점만 있는 출력은 거부한다.

80자는 목표다. 120자를 넘거나 허용 문장 수를 넘으면 완전한 문장 단위로 줄이되 의미가 변하면 채택하지 않는다. 기계적인 글자 중간 절단은 하지 않는다. 자르기 어려운 출력은 실패로 처리하고 반복 재생성을 하지 않는다. 내용 사실성은 문자열 검사만으로 보장되지 않으므로 별도 한국어 평가 사례로 검증한다.

전달할 과거 사실과 활동 결과는 가능한 한 서버가 작성한 짧은 사실 블록으로 제한한다. 특히 정답 여부는 활동 결과에서만 공급한다. 모델 출력만 보고 새로운 기억·관계 근거를 만들지 않는다.

### 7.2 PuzzleCandidate → 활동 검증기

```typescript
type PuzzleCandidate = {
  activity_id: string;
  candidate_answer: string | null;
  needs_hint: boolean;
};
```

현재 문제, 이미 공개된 힌트, 과거 제출과 판정만 제공한다. 정답표·숨겨진 힌트·정답 비교 코드는 제외한다. `candidate_answer`는 1–80자 또는 null이며 `needs_hint=true`이면 null이어야 한다. 불일치하거나 다른 활동 ID이면 거부한다.

후보가 나와도 Core가 현재 활동, 중복 답, 자동 제출 한도를 검사해야 제출한다. `needs_hint=true`는 제안이며 실제 질문 대상과 힌트 잔여 수는 Core가 결정한다. 세부 제출·힌트 한도는 도메인 문서를 재사용한다.

풀이 호출의 종료 결과는 발언으로 재생하지 않는다. 검증기가 판정한 뒤 필요할 때 별도의 DialoguePlan을 만든다. 모델 스스로 “맞았다”고 선언한 문자열은 검증 결과가 아니다.

## 8. OmniVoice worker

### 8.1 프로세스와 모델 준비

새 파일 `workers/tts/omnivoice_worker.py`를 프로젝트에 구현하고, 기존 Python으로 `-u` 옵션을 주어 실행한다. Node `spawn`의 executable·args를 분리하고 `shell=false`로 사용한다. 공백이 있는 경로를 셸 명령 문자열로 조합하지 않는다. 이는 구현할 경로이며 현재 파일이 존재한다는 뜻은 아니다.

모델은 worker 시작 시 한 번 로드한다. 로컬 snapshot의 text tokenizer와 `audio_tokenizer`까지 확인한다. 설치 소스는 audio tokenizer가 없으면 별도 모델을 찾는 분기가 있으므로, 상위 폴더가 있다는 이유만으로 오프라인 준비 완료로 처리하지 않는다.

`HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`을 적용하고 `load_asr=False`로 시작한다. 참조 음성과 전사문을 함께 받아 추가 ASR을 로드하지 않는다. 기존 소스에서 확인한 사용 형태는 다음과 같다. device·dtype는 M0에서 호환성을 확인해 고정한다.

```python
# 설치된 OmniVoice 0.1.5의 호출 형태. 완성된 worker 구현 예제가 아니다.
model = OmniVoice.from_pretrained(local_snapshot, load_asr=False, **load_options)
voice_prompt = model.create_voice_clone_prompt(
    ref_audio=reference_audio_path,
    ref_text=reference_transcript,
)
audios = model.generate(text=text, language="ko", voice_clone_prompt=voice_prompt)
waveform = audios[0]
sample_rate = model.sampling_rate
```

사용자가 선택한 참조 음성·전사문 한 쌍을 `voicePresetId`에 매핑한다. 파일 내용·해시·설정 버전이 바뀌면 prompt 캐시를 재생성한다. 목소리를 아직 선택하지 않았다면 `voice_preset_missing`으로 표시하고 임의 목소리를 최종 preset으로 확정하지 않는다.

`generate()`는 완성된 1차원 오디오 배열 목록을 반환한다. 내부 chunk 옵션이 있다는 이유로 실시간 waveform streaming을 지원한다고 간주하지 않는다. `instruct`·`speed`를 통한 감정 연기는 MVP 합격 조건에 넣지 않는다.

### 8.2 JSON Lines 계약

stdin/stdout은 UTF-8 JSON 한 줄에 메시지 하나, 최대 64KiB다. 모델·라이브러리 로그는 stderr로 보낸다. 시작 준비 timeout 120초, 요청은 worker별 한 건만 보낸다. stdout 비JSON, 크기 초과, 알 수 없는 request ID는 protocol error로 처리한다.

아래 sample rate·길이는 형식 설명용 예시이며 실측값이 아니다. `relativeAudioPath`는 `runtime-data/tmp/tts`를 기준으로 한다.

```json
{"type":"ready","protocolVersion":"local-ai-v1","worker":"tts","workerInstanceId":"tts-worker-1","sampleRate":24000}
{"type":"synthesize","requestId":"tts-1","responseId":"response-1","segmentId":"segment-1","generationEpoch":"4","text":"힌트 하나만 줄래?","language":"ko","voicePresetId":"voice-1"}
{"type":"completed","workerInstanceId":"tts-worker-1","requestId":"tts-1","responseId":"response-1","segmentId":"segment-1","generationEpoch":"4","relativeAudioPath":"tts-1.wav","sampleRate":24000,"durationMs":1800}
{"type":"failed","workerInstanceId":"tts-worker-1","requestId":"tts-2","code":"resource_exhausted"}
```

worker는 서버가 검증한 ID로 출력 파일명을 만들고 요청자가 보낸 임의 출력 경로를 받지 않는다. WAV는 mono PCM16으로 저장한다. NaN·무한대·빈 배열을 거부하고, 실제 sample rate와 프레임 수에서 길이를 계산한다. 샘플 범위를 확인한 뒤 변환하며 clipping 발생 여부를 측정 기록에 남긴다. 요청 한 문장당 생성 음성 최대 20초를 초기 상한으로 둔다.

완료 파일은 임시 확장자로 먼저 쓰고 쓰기가 끝난 뒤 `.wav`로 이름을 바꾼다. Node는 정규화·실제 해석된 경로가 지정된 임시 디렉터리 안인지 검사한다. 절대 경로·상위 이동·외부 junction/symlink·상한 초과 파일은 거부한다. 경로 접두 문자열 비교만 사용하지 않는다.

Node가 파일을 검증해 Stage에 전달한 후 재생 완료·취소 시 삭제한다. 브라우저 재생 중에 원본 파일이 꼭 필요한 전송 방식이면 읽기 완료까지 보존한다. 시작 시 미완료 임시 파일을 회수하되 worker 생존 여부를 먼저 확인하고, 전용 임시 루트 밖의 파일은 삭제하지 않는다.

### 8.3 취소의 두 단계

**재생 취소와 모델 계산 중단을 구분한다.** 기본 worker는 합성 중 stdin 취소를 읽는다고 가정하지 않는다.

1. Node와 Stage에서 응답을 무효화하고 재생·대기 음성을 즉시 제거한다.
2. 합성 작업은 끝날 때까지 슬롯을 점유한다. 늦게 반환된 파일은 재생하지 않고 삭제한다.
3. 합성 timeout 30초가 지나면 Node가 자신이 시작한 해당 worker만 종료한다. 프로세스 종료 확인 전 GPU 슬롯을 재사용하지 않는다.
4. worker를 한 번 재기동할 수 있지만 취소된 문장을 자동 재합성하지 않는다. 세션 중 같은 장애가 다시 나면 TTS를 unavailable로 두고 운영자 재시작을 기다린다.

새 목소리 입력을 받는 UI와 CPU STT는 GPU 슬롯 반환을 기다리지 않는다. worker PID 소유권을 확인하지 않고 이름이 같은 모든 Python 프로세스를 종료하는 구현은 금지한다.

## 9. 로컬 STT

### 9.1 첫 입력 방식

MVP는 **누르고 말하기**로 시작한다. 버튼을 누르는 순간 Studio가 로컬 재생을 중단하고 서버에 입력 시작을 알린다. 버튼을 놓으면 완성된 짧은 발화를 전사한다. 자동 VAD 기반 발화 종료나 부분 전사는 첫 구현의 필수 조건이 아니다.

AudioWorklet 입력의 실제 sample rate를 확인해 16kHz mono PCM16 WAV로 변환한다. 단순히 WAV 헤더에 16000을 쓰는 것으로 리샘플링을 대신하지 않는다. 최대 발화 15초, 녹음 한 건과 전사 대기 한 건만 유지한다. 상한 도달 시 녹음을 끝내고 표시한다. 대기 슬롯이 가득 차면 새 녹음을 받기 전에 busy를 알리고 조용히 덮어쓰지 않는다.

마이크 ID는 등록된 운영자 하나다. 잡음·목소리 특징으로 A·B·C를 식별하지 않는다. 음성이 없거나 너무 짧거나 전사가 실패하면 확정 발언을 만들지 않는다.

### 9.2 worker와 모델

별도 `.venv-stt`와 `workers/stt/whisper_worker.py`를 구현한다. 기존 OmniVoice 환경에 패키지를 덧설치하지 않는다. 준비 단계에서 고정한 faster-whisper 버전과 CTranslate2 형식의 다국어 small snapshot을 사용한다.

공식 구현은 CPU int8과 로컬 모델 디렉터리를 지원한다. 전사 결과 segments는 지연 평가되는 iterator이므로 끝까지 소비해야 작업이 완료된다. `language="ko"`를 지정한다. 기존 Hugging Face Whisper 원본 캐시를 CTranslate2 모델로 간주하지 않는다. [faster-whisper 공식 사용법](https://github.com/SYSTRAN/faster-whisper)

모델 파일이 없으면 unavailable이다. 정상 추론 경로에서 모델 이름으로 자동 다운로드를 시작하지 않는다. STT도 준비 timeout 120초, 추론 timeout 20초를 적용한다. timeout 시 소유 worker의 종료를 확인한 뒤 한 번 재기동할 수 있으며, 같은 세션에서 재발하면 unavailable로 둔다. 이전 녹음을 자동 재전사하지 않는다. CPU thread 수 초기값은 4이며 실제 브라우저·DB 부하와 함께 조정한다.

JSONL 형식·64KiB 상한·worker ID 검사는 TTS와 같다. 오디오는 JSON에 base64로 넣지 않고 전용 `runtime-data/tmp/stt`에 쓰며 같은 경로 검증 규칙을 적용한다.

```json
{"type":"ready","protocolVersion":"local-ai-v1","worker":"stt","workerInstanceId":"stt-worker-1"}
{"type":"transcribe","requestId":"stt-1","utteranceId":"utterance-1","relativeAudioPath":"utterance-1.wav","language":"ko"}
{"type":"completed","workerInstanceId":"stt-worker-1","requestId":"stt-1","utteranceId":"utterance-1","text":"아까 풀던 문제 이어서 하자.","language":"ko"}
```

Node는 요청에 저장해 둔 세션·운영자 ID를 결과에 연결한다. 전사 문자열이 길이 예산 안에 있고 발화가 유효할 때만 `utteranceId`를 중복 방지 키로 최종 입력 사건을 만든다. 취소·종료된 세션의 결과는 폐기한다. 원본 WAV는 성공·실패·취소 후 삭제하며 진단 녹음은 별도 명시 설정 없이는 보존하지 않는다.

낮은 신뢰의 전사·잡음 오인식 판별은 M0 사례로 기준을 정한다. 전사 내용만으로 ASR 정확성을 확정하지 않는다. 실패한 녹음을 자동 반복 제출하지 않으며 새 녹음을 요청한다.

## 10. 자원 예약과 제한

| 자원/작업 | 초기 상한·시간 제한 | 소진·시간 초과 시 |
|---|---|---|
| GPU 생성 슬롯 | 로컬 대사·풀이·TTS 합계 1개 | Jev는 원격 요청이며 이 GPU 슬롯을 점유하지 않음 |
| CPU STT | 실행 1건, 대기 1건 | 새 입력 busy, 무한 적재 금지 |
| 활성 응답 | 캐릭터당 1개 | 취소 또는 기존 응답 유지, Core가 결정 |
| 입력 후보 | 최근 20초·100개 | 도메인 문서의 선택·만료 규칙 적용 |
| 확정 문장 큐 | 응답당 최대 2개, 완성 음성 합계 30초 | 상한 초과 응답 실패, 새 문장 적재 중단 |
| 해석/풀이/대사 | 호출당 15초/20초/20초 | 결과 무효화, 자동 재호출 없음 |
| TTS/STT | 호출당 30초/20초 | 실패 표시, 소유 worker 종료·정리 |
| worker 준비 | 120초 | 준비 실패, 세션을 정상 음성 모드로 시작하지 않음 |

CPU STT는 GPU 추론과 병행할 수 있다. GPU 렌더링·OBS는 계속 동작하므로 위 상한은 GPU 사용 전체를 하나로 만든다는 의미가 아니다.

Node scheduler는 provider 내부 대기열에 많은 요청을 미리 보내지 않는다. 다음 호출 직전까지 입력 TTL·계획 유효성을 다시 검사한다. 활성 응답이 있으면 그 대사·TTS 진행을 우선하고, 끼어들면 취소 후 새 입력을 처리한다. 세션 종료 정리의 선택적 LLM 작업은 활성 세션이 없을 때만 실행한다.

Ollama HTTP abort는 결과 사용을 취소하는 수단이며 GPU 계산 종료 증명이 아니다. 엄격한 초기 모드에서는 결과가 무효화돼도 기존 호출의 정상 종료까지 슬롯을 유지한다. 기한 내 종료를 확인하지 못하면 provider와 GPU 추론 경로를 unavailable로 두고 복구 후 재개한다. 단순 연결 종료만 보고 TTS를 동시에 시작하지 않는다. 이후 설치 버전의 실제 취소 완료를 확인할 수 있게 되면 해당 경로만 개선한다.

순차 추론이어도 가중치 상주 VRAM은 합산된다. M0에서 Qwen 단독, OmniVoice 단독, 두 모델 상주, VRM·OBS 포함 상태의 피크를 각각 측정한다. 부족하면 context 축소, Qwen CPU 배치, 더 작은 무료 모델 검토 순으로 조정한다. 교대 로딩은 마지막 수단이며 지연 증가를 기록한다. 자동 OOM 재시도를 반복하지 않는다.

## 11. 표현 실행과 실제 전달

Core는 대사와 함께 `responseId`, `generationEpoch`, 기본 표정, 표현 강도, 전달 톤을 정한다. 기본 표정은 neutral/listening/happy/embarrassed/uncomfortable이며 선택·전환 규칙은 도메인 문서를 따른다. surprise는 별도 여섯 번째 표정이 아니라 기존 고개·시선 반응이다.

각 완성 문장과 WAV를 같은 `segmentId`에 연결한다. Stage는 WAV 재생 시작에 맞춰 문장 자막을 보여 주고 음량에 따라 입을 움직인다. 렌더링 입 움직임을 음소 수준 립싱크로 표현하지 않는다. 지원되지 않는 표정은 기본 표정으로 매핑하고 내부 감정을 지우지 않는다.

출력 주체는 활성 Stage 하나다. Studio 미리보기와 OBS가 동시에 발성하지 않도록 출력 권한을 하나만 부여한다. 자격·재접속·보고 메시지의 상세 형식은 [런타임 통신 명세](./RUNTIME_PROTOCOL.md)를 따른다. 제어는 WebSocket, 완성 녹음·문장 WAV는 인증된 HTTP로 전송한다.

출력 결과는 최소한 `text_shown`, `audio_started`, `audio_completed`, `cancelled`, `delivery_unknown`을 구별한다. 자막 표시도 Stage 보고가 있어야 기록한다. 음성 중단 시 이미 들린 부분을 없었던 일로 바꾸지 않지만, 문장 전체를 말했다고도 기록하지 않는다. TTS가 실패하면 검증된 대사를 자막으로만 전달할 수 있으며 modality를 남긴다.

마이크 시작·중지 버튼·세션 종료·근거 정정으로 취소되면 Stage는 현재 소스와 예약 소스를 모두 중단하고 대기 자막을 제거한다. 재접속 후에는 오래된 음성 큐를 재전송하지 않는다. 근거를 참조한 진행 대사도 함께 무효화한다.

## 12. 설정과 준비 상태

```dotenv
# 프로젝트가 해석하는 설정
LOCAL_ONLY=true
ALLOW_PAID_PROVIDERS=false
OLLAMA_BASE_URL=http://127.0.0.1:11434
APPRAISAL_MODEL=jev-1.13.0
TYPESAFE_API_KEY=
DIALOGUE_MODEL=qwen2.5:7b
OLLAMA_CONTEXT_TOKENS=4096
OMNIVOICE_PYTHON="J:/ai/omnivoice tts/omnivoice-env/Scripts/python.exe"
OMNIVOICE_MODEL_PATH=<완전성을 확인한 로컬 snapshot>
VOICE_PRESET_ID=<사용자가 선택한 음성 preset>
STT_PYTHON=<별도 STT 환경의 Python 절대 경로>
STT_MODEL_PATH=<CTranslate2 다국어 small snapshot>
STT_DEVICE=cpu
STT_COMPUTE_TYPE=int8
STT_LANGUAGE=ko

# Python worker에 전달하는 환경
HF_HUB_OFFLINE=1
TRANSFORMERS_OFFLINE=1

# 별도로 실행하는 Ollama 서버에 적용해야 하는 환경
OLLAMA_NO_CLOUD=1
OLLAMA_NUM_PARALLEL=1
```

`<...>`는 반드시 채워야 하는 자리 표시자다. 샘플 설정을 그대로 복사한 경우 시작 전 검사에서 오류를 낸다. 프로젝트 설정과 프로그램 공식 환경 변수를 혼동하지 않으며, 이 문서 작성으로 실제 환경이 변경되지는 않았다.

로컬 생성/음성 준비 상태는 `not_configured → starting → ready → busy` 및 `unavailable`로 표시한다. Jev는 별도 blocked/configured/ready/unavailable과 inferenceVerified/errorCode를 사용한다. 키와 허용 flags만 있으면 configured이며 첫 유효 응답 전에는 추론 미검증이다. liveness와 readiness를 구분한다. 프로세스가 떠 있다는 이유로 모델이 로드됐다고 표시하지 않는다.

준비 검사는 DB, Ollama 연결·설치 모델, tokenizer, TTS snapshot·참조 음성·worker, STT snapshot·worker, Stage 오디오 활성화 순으로 수행한다. 텍스트 개발 단계는 TTS/STT 없이 시작할 수 있으나 Studio에 제한을 표시하고 최종 MVP 준비 완료와 구분한다.

Jev만 별도 승인된 원격 추론 예외이며 대사·음성 추론과 저장은 로컬이다. LOCAL_ONLY=false, ALLOW_PAID_PROVIDERS=true, key 존재를 모두 충족해야 요청하며 기본값은 차단이다. 시작·health·diagnose는 Jev 요청을 보내지 않는다. 15초 timeout, state 16KiB·본문 64KiB 상한, redirect 거부, 자동 재시도 없음. 401/403·422·429·5xx·timeout·malformed를 코드로 구분한다. 원격 계산/청구 종료는 abort로 보장하지 않는다. 모델 다운로드는 준비 단계로 분리하고 누락 파일을 발견해도 실행 중에 다운로드하지 않는다. loopback 제한과 오프라인 환경 변수만으로 PC 전체 네트워크가 차단됐다고 주장하지 않는다. 외부 차단 시 로컬 구성과 Jev unavailable/중립 경계를 확인한다. 차단 상태의 전체 정상 MVP 성공을 요구하지 않는다.

## 13. 구현 검증과 M0 기록

### 13.1 계약 검사

| ID | 입력·상황 | 확인할 결과 |
|---|---|---|
| AI01 | 해석 JSON 누락·범위 초과·미제공 출처 | unknown 처리, 의미 기반 감정·관계 변화 없음 |
| AI02 | 채팅에 system 지시·친밀도 변경·tool 요청 | 모델 자료로만 취급, 상태·외부 작업 권한 없음 |
| AI03 | 대사에 과거 허위 경험·미판정 성공 | 평가에서 오류로 집계, 사실 기억으로 승격하지 않음 |
| AI04 | 같은 사건 결과 재전송 | 도메인 효과 한 번만 적용 |
| AI05 | TTS 생성 중 마이크 시작 | 재생 즉시 중지, 늦은 파일 삭제, 다음 GPU 작업은 슬롯 반환 후 |
| AI06 | Stage 단절·재접속 | 미확인 delivery 보존, 과거 음성 재생 없음 |
| AI07 | 기억 삭제 중 대사·TTS 완료 | 해당 근거 버전의 출력 폐기 |
| AI08 | 모델·tokenizer·음성 preset 누락 | 준비 실패, 다운로드·유료 fallback 없음 |
| AI09 | worker stdout 손상·종료·OOM | 제한된 복구, 다른 Python 프로세스 유지 |
| AI10 | 빈 녹음·잡음·취소·같은 최종 전사 재전송 | 확정 발언 오생성·중복 반영 방지 |
| AI11 | 퍼즐 답 후보 반복·다른 활동 ID | 제출 거부, 성공 판정 위조 없음 |
| AI12 | OBS와 Studio 동시 열기 | 활성 출력 주체 하나만 발성 |
| AI13 | 외부 추론 주소·cloud 모델·redirect | 시작 또는 요청 검증에서 거부 |
| AI14 | 정해진 외부 연결 차단 상태에서 세션 | 준비된 로컬 구성으로 입력·추론·저장·재생 완료 |

형식·취소·중복 검사는 fake provider와 실제 adapter 경계에서 반복 가능하게 만든다. 한국어 해석은 실제 Jev, 대사 품질과 GPU 자원은 실제 로컬 모델로 별도 검사한다. Fake provider 통과를 실제 모델 통과로 기록하지 않는다.

### 13.2 측정할 값

- 모델 태그·digest, Ollama/worker/패키지 버전, 프롬프트·preset·설정 버전.
- 첫 로드와 준비 완료 후 호출을 분리한 지연·성공·실패·timeout 수.
- 채팅 제출→최초 공개 자막, 채팅 제출→첫 실제 음성.
- 음성 입력 종료→STT 완료→첫 음성. 녹음 시간은 응답 지연과 별도 기록.
- 사용자 입력 시작→Stage 재생 중지, 늦은 결과 폐기 수.
- GPU 대기, 해석·풀이·대사·합성 시간, TTS 생성 시간/생성 음성 길이.
- RAM·VRAM 유휴/피크, VRM·OBS를 포함한 20분 실행 결과.
- 잘못된 대상 분류, 인용문 공격 오분류, 근거 없는 기억 인용의 사례와 빈도.

지연은 가능한 한 같은 프로세스의 단조 시계로 측정한다. 브라우저와 서버의 절대 timestamp를 그대로 빼지 않는다. Stage 재생 시작 보고의 네트워크 왕복과 시계 차이는 별도 오차로 기록한다. timeout을 제거한 성공 요청만의 평균으로 전체 응답성을 설명하지 않는다.

고정된 짧은 입력 30건과 대표 세 세션은 MVP 기준을 따른다. [검증 계획](./VALIDATION_PLAN.md)에 따라 30개 문장을 텍스트·마이크 채널에서 각각 실행하고 결과를 분리한다. 듣기 표시 150ms·첫 음성 2초는 제품 목표이며 지금 달성했다고 간주하지 않는다. M0 결과를 바탕으로 음성 단계 착수 전에 검증 계획의 합격 문턱을 고정한다.

## 14. 구현 순서와 남은 결정

1. 입력 schema·요청 문맥·취소 epoch·fake provider 계약 검사.
2. Jev 해석과 Ollama 대사·퍼즐 후보 연결, tokenizer 예산 검사.
3. OmniVoice 로컬 snapshot 완전성·음성 preset 확인, 단독 합성 측정.
4. 전용 STT 환경과 짧은 한국어 녹음 전사 확인.
5. 단일 GPU scheduler, Stage 취소·전달 보고 연결.
6. 실제 모델·VRM·OBS를 함께 실행해 M0 및 통합 검증 기록.

구현 전에 확보할 미확정 항목은 **참조 목소리와 전사문, 완전한 TTS snapshot, STT 환경·모델, token counter 파일, 두 모델 동시 상주 가능 여부**다. 목소리 선택은 준비 화면에서 처리할 수 있으며, 문서 작성 단계에서 임의의 파일을 선택하지 않는다.

요청 결과·실제 전달·취소·출처 버전은 [DB 설계 명세](./DATABASE_SPEC.md)의 저장 계약과 [런타임 통신 명세](./RUNTIME_PROTOCOL.md)의 브라우저 메시지로 이어진다.
