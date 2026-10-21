# 실행 안내

저장소 루트에서 명령을 실행합니다. Node.js 22.19 이상, `package.json`에 지정된 pnpm, PostgreSQL, 선택한 공급자 설정이 필요합니다. 현재 개발·검증 범위는 [진행 상태](../STATUS.md)를 확인합니다.

## 로컬 설정

[.env.example](../../.env.example)을 참고해 Git에서 제외된 `.env`와 `runtime-data/`의 로컬 설정을 준비합니다. 기존 파일이 있다면 덮어쓰지 않습니다. `DATABASE_URL`, 선택한 판단·생성 공급자, 필요한 인증과 모델 경로를 본인 환경에 맞춥니다. 음성·아바타는 현재 텍스트 실행의 필수 요소가 아닙니다.

설정 로딩 순서와 우선순위의 구현은 [scripts/env.ts](../../scripts/env.ts)를 따릅니다. 셸에 이미 설정된 값이 우선하며 파일 로딩은 `.env`, Jev, DB, 대화 API, DeepSeek 설정 순입니다. 기본 샘플은 유료 공급자를 차단하므로 키만 채운다고 모든 경로가 실행 가능해지는 것은 아닙니다.

```powershell
pnpm diagnose
```

진단은 추론이나 모델 다운로드를 하지 않습니다. 필요한 설정과 DB 상태를 확인한 후 진행합니다. DeepSeek의 C2-L 감정 평가기는 아직 평가 전용이며 운영 공급자 선택에 등록된 것이 아닙니다.

## DB 준비와 실행

기존 DB는 백업과 migration 대상 확인 후 변경합니다. 새로 만든 전용 DB에서는 다음 순서로 준비할 수 있습니다. migration은 `MIGRATION_DATABASE_URL`이 있으면 그 주소를, 없으면 `DATABASE_URL`을 사용합니다. seed는 `DATABASE_URL`을 사용합니다.

```powershell
pnpm db:migrate
pnpm db:seed
pnpm build
pnpm start
```

서버가 출력하는 일회용 Studio 코드로 `http://127.0.0.1:3001/studio`에 연결합니다. 새 만남을 열고 Stage 출력을 선택합니다. 대화 입력은 선택한 공급자를 실제 호출할 수 있습니다. 종료는 실행 터미널에서 Ctrl+C입니다.

UI를 개발할 때는 런타임과 별도 터미널에서 `pnpm dev:ui`를 실행합니다. Vite는 5173 포트에서 API를 런타임 3001 포트로 전달합니다. 빌드 UI의 기본 위치는 `apps/studio/dist`이며 `STUDIO_DIST_PATH`로 별도 빌드를 지정할 수 있습니다.

## 검증과 과거 실행

문서 정리 과정에서는 앱·DB·모델을 실행하지 않았습니다. 위 명령은 현재 소스와 package scripts에 근거한 안내이며 새로운 실행 성공 기록이 아닙니다.

검사는 변경 범위에 맞춰 선택합니다. [검증 기준](../plans/VALIDATION_PLAN.md), [C2-L 결과](../plans/OUTCOME_AFFECT_REFERENCE_PLAN.md#r4-c2l-build)를 참고합니다. 과거 프로필·DB·예산을 사용한 명령은 [실행 이력](../history/RUN_HISTORY.md)에 보존했으며 현재 기본값으로 복사하지 않습니다.
