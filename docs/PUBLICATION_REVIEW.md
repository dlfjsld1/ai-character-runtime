# MVP 게시 전 점검 — 2026-10-17

범위는 이번 릴리스의 Git 포함 파일, 로컬에서 도달 가능한 Git 이력, 비밀 제외 규칙, 기존 localhost 서버의 인증·오류 출력, 운영 의존성의 알려진 취약점이다. 원격 서비스 침투검사나 모든 취약점 부재를 보증하는 검사는 아니다.

## 비밀 파일과 이력

실제 비밀값을 출력하지 않고 로컬 환경 파일에서 확인한 비밀값5개를 후보 파일과 Git blob에 대조했다. provider 토큰·개인키·긴 리터럴 비밀·자격 포함 URL 패턴도 검사했다. 첫 검사에서 후보263개 파일, 로컬 도달 가능5개 커밋/375개 blob의 비밀값 일치·패턴 탐지0건, 금지 경로 포함0건이었다. 문서 추가 후 최종 staged index266개 파일을 다시 검사해 비밀 탐지0건·금지 경로0건을 확인했다. 로컬에 없는 원격 ref, unreachable 객체, 알 수 없는 형식의 모든 비밀까지 검사한 것은 아니다.

`.gitignore`의 기존 규칙은 `.env.production`이나 루트 `dialogue-api.env`를 막지 못했다. `.env.*`, `*.env`, 개인키·인증서·로컬 DB·브라우저 시험 출력의 제외를 보완했고, `.env.example`과 `*.env.example`은 예제로 허용했다. `.env`, `.env.production`, `dialogue-api.env`, 중첩 `jev.env`, runtime-data·첨부 파일·개인키·시험 출력 경로의 제외와 `.env.example`의 포함을 실제 `git check-ignore --no-index`로 확인했다. 포함된 example 파일의 API 키 필드는 비어 있었다.

이미 추적된 파일은 ignore로 보호되지 않으므로 Git index와 이력을 별도로 검사한다. `runtime-data/`, `.codex-remote-attachments/`, `.env`, 실제 키, DB와 원장, 브라우저 프로필은 릴리스에 포함하지 않는다. 원격 URL에 내장 자격은 없고 대상은 `github.com/dlfjsld1/ai-character-runtime.git`이다. 문서의 로컬 계정명·경로와 합성 실험 원문은 남아 있다. 로컬 경로를 보안 비밀이나 누구나 재현 가능한 공개 파일 링크로 취급하지 않는다.

## 서버·공급자 정적 검토

별도 에이전트가 읽기 전용으로 확인했다. 서버는127.0.0.1에 고정돼 있고 HTTP origin/Bearer, WebSocket origin·초기 인증·역할·만료 경계를 유지한다. 공급자 오류는 정규화된 코드로 전달하며 인증 헤더나 오류 원문을 일반 로그로 출력하는 경로는 발견되지 않았다. Stage 연결 코드는 사용 후 URL에서 제거하고, UI는 텍스트 렌더링을 사용한다. `.env.example`은 local-only와 유료 공급자 차단 기본값, 빈 API 키를 유지한다. 실제 LAN/인터넷 공개 배포를 검증한 것은 아니다.

## 의존성과 검사 증거

`pnpm audit --prod --json`은 설치/업데이트 없이 레지스트리를 조회했다. 운영 의존성 조회 결과 info/low/moderate/high/critical 모두0건이었다. 조회 시점과 레지스트리에 등록된 알려진 취약점 범위이며 개발 의존성 전체나 미공개 취약점까지 안전하다는 뜻은 아니다.

비밀 대조 보고서와 원시 의존성 응답은 Git 제외된 `runtime-data/publication-audit-working.json`, `publication-audit-index.json`, `dependency-audit-20261017.json`에 보존한다. 게시할 문서에는 비밀값·일회용 연결 코드·환경 파일 원문을 넣지 않는다.

마감 단위 검사는24개 파일447건 통과, 실패0·건너뜀0이었다. 결과는 `J:/ai/ai-character-runtime/mvp-closeout-20261017/unit.json`에 보존한다. `tsc --noEmit -p tsconfig.json`도 통과했다. 이번 변경은 문서와 ignore 규칙이며 제품 소스 해시는 직전 말투 지속 검증의 `verification.json`과 일치했다. 직전 실제 모델/Stage 검증은 [범위와 실패 기록](./REGISTER_CONTINUITY_RESULT.md)을 재사용하며 이번 점검에서 DB·브라우저·유료 모델을 다시 실행하지 않았다.

커밋·태그와 GitHub push는 별도 상태다. 이번 작업은 로컬 커밋과 annotated tag를 만들며 원격 push는 실행하지 않는다.

`git diff --cached --check`는 보존한 구버전 문서의 Markdown 줄바꿈용 공백과 기존 fixture/test 두 파일의 마지막 빈 줄을 보고했다. 동작 오류는 아니며 이 마감에서 원본·제품 소스를 공백 정리 목적으로 바꾸지 않았다. 신규 마감 문서3개의 상대 파일 링크는 모두 존재함을 확인했다.
