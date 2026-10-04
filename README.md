# AI Character Runtime

2026-10-04 Jev 필수 연결을 구현했습니다. 모의 Jev→Core→Stage와 저장·삭제·취소는 검증했고, 실제 Jev 한국어 품질과 실제 Jev→Qwen→Stage는 비용·전송 승인 및 예산 전까지 미검증입니다. 키는 무시되는 `runtime-data/jev.env`에 넣고 채팅/로그로 공유하지 않습니다.

한국어 로컬 AI 캐릭터 MVP 개발 프로젝트입니다. PostgreSQL 텍스트 runtime과 Studio/자막 Stage를 구현했고, 2026-10-04 기존 로컬 Qwen의 응답이 실제 Chrome Stage에 표시되고 완료 ACK로 저장되는 경로를 확인했습니다. 전체 MVP와 대사 품질·성능 검증은 아직 완료되지 않았습니다. 현재 실행 방법은 [RUNBOOK](./RUNBOOK.md), 범위별 결과는 [BUILD_HANDOFF](./BUILD_HANDOFF.md)를 참고합니다.

## 지금 실행할 수 있는 명령

Node.js 22.19 이상과 pnpm 11.9를 사용합니다. 확인된 현재 PC는 Node 22.19.0, pnpm 11.9.0입니다.

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test:unit
pnpm diagnose
```

`pnpm diagnose`는 실행 환경·로컬 경로·Ollama API를 **읽기만** 합니다. 모델 다운로드, DB 생성, TTS 합성, 기존 프로세스 재시작은 하지 않습니다. `installed`, `reachable`, `files_present`는 실제 추론·DB 인증이 성공했다는 뜻이 아닙니다.

기본 설정은 코드에 있으며, 필요한 값은 [.env.example](./.env.example)을 `.env`로 복사해 채울 수 있습니다. `.env`는 버전 관리에서 제외합니다. `OMNIVOICE_MODEL_PATH`에는 검사한 snapshot의 절대 경로를 입력하고, 목소리는 선택한 `VOICE_PRESET_ID`를 지정해야 합니다. 현재 디렉터리의 두 TTS snapshot 후보는 메타데이터만 확인했으며 로딩 검증은 P03에서 진행합니다.

Ollama 서버의 `OLLAMA_NO_CLOUD=1`, `OLLAMA_NUM_PARALLEL=1`은 별도로 실행하는 Ollama 프로세스 환경에 적용해야 합니다. 프로젝트 `.env`만으로 이미 실행 중인 Ollama가 바뀌지는 않습니다. 사건 해석은 필수 Jev `jev-1.13.0`, 대사·풀이 후보는 로컬 Qwen입니다. Jev만 비용·합성 입력 외부 전송의 별도 승인 예외가 필요하며 기본 설정에서는 차단됩니다. 자동 Qwen 해석 fallback은 없습니다.

## 2026-10-02 진단 기록

- Node·pnpm 준비됨.
- PostgreSQL 연결 정보 미설정.
- Ollama API에 현재 연결되지 않음.
- OmniVoice Python 설치 경로 확인, snapshot 메타데이터 후보 2개, 사용할 snapshot·목소리는 미선택.
- STT 환경·모델 미설정.
- Studio·Stage는 아직 미구현.

다음 개발 작업은 P02 Ollama adapter, P03 OmniVoice wrapper, P04 로컬 STT 실험입니다. 실제 모델 준비와 성능 합격 판정은 [검증 계획](./VALIDATION_PLAN.md)을 따릅니다.


## 2026-10-03 구현

PostgreSQL 텍스트 runtime과 React Studio/자막 Stage의 대표 저장 경로를 구현했다. 전체 MVP는 실제 AI/음성 자원 및 P05 게이트 때문에 BLOCKED다. [실행 문서](./RUNBOOK.md), [변경·검증·남은 작업](./BUILD_HANDOFF.md)을 참고한다. 합성 fixture 검사 결과를 실제 모델 품질로 해석하지 않는다.
