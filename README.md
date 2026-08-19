# CodePad

CodePad는 Mac에서 실행되는 로컬 Agent를 iPad PWA에서 확인하고 제어하기 위한 개인용 개발 도구입니다. 현재 저장소는 Phase 10까지 구성되어, Project/Git 제어, Command Runner, Error Assistant, 사용자 설정 Dashboard와 AI 기반 Notion 개발일지를 사용할 수 있습니다.

## 현재 구현 기능

- React + TypeScript + Vite 기반 반응형 PWA
- iPad 우선 다크 Dashboard
- FastAPI `GET /api/health` 상태 확인
- FastAPI `GET /api/agent/info` Mac hostname, `.local` 주소, 현재 IP 확인
- FastAPI `WS /ws` 실시간 연결 및 heartbeat
- `.local` hostname 우선 연결과 마지막 성공 IP fallback
- 연결 종료 시 1초, 2초, 5초, 10초 간격 자동 재접속
- `Connected / Disconnected / Reconnecting` 상태와 수동 재시도
- FastAPI 시작 시 SQLite/SQLModel 스키마 초기화
- 로컬 네트워크 접속을 고려한 API 주소 자동 설정
- Mac 프로젝트 등록, 선택, 목록 조회 및 제거
- 선택 프로젝트의 현재 Git branch와 변경 파일 조회
- staged/unstaged 및 수정·추가·삭제·이름 변경 상태 표시
- 변경 파일을 직접 선택하고 메시지를 검토한 뒤 Commit
- 현재 checkout된 branch의 ahead commit 확인 및 `origin` Push
- Commit/Push 직전 확인 모달과 성공·실패 결과 표시
- 자주 사용하는 명령 등록·편집·제거
- 실행 직전 명령어, 선택 프로젝트, 작업 폴더 확인
- 비동기 명령 실행과 stdout/stderr, 종료 코드, 실행 기록 저장
- 실행 중인 장기 프로세스 중지
- Command stderr의 실시간 오류 감지와 WebSocket 전송
- 오류 메시지, stack trace, 파일명, 라인 번호 자동 추출 및 SQLite 저장
- 최근 오류 카드와 상세 화면
- Error 해결/미해결 상태, 사용자 메모 및 확인 삭제
- Gemini Provider 기반 오류 원인·설명·해결 단계 구조화
- 분석 전 외부 전송 Context 확인
- AI 분석 기록 SQLite 저장 및 코드·명령 복사
- Dashboard Action 추가·편집·삭제·순서 변경
- Action 이름·아이콘·유형·Saved Command 연결 설정
- Deck Action의 `•••` 관리 메뉴와 Built-in Action 삭제 보호
- 선택한 Git Diff 기반 Gemini Commit Message 후보 3개 추천
- Blue, Purple, Green, Orange, Pink Accent Color 설정
- Dashboard 설정 SQLite 영구 저장
- Notion 연결 상태 및 대상 Data Source 확인
- 제목·본문·태그를 검토한 뒤 Notion 개발일지 페이지 생성
- 최근 Notion 저장 기록과 페이지 링크 SQLite 보관
- 선택 프로젝트의 오늘 Commit·변경 파일·Command·Error 기록 수집
- 전송 Context 확인 후 Gemini 개발일지 초안 생성
- AI 초안을 직접 수정한 뒤 별도 확인을 거쳐 Notion 저장

자유 배치 Custom Action은 이후 Phase에서 구현합니다.

## Requirements

- Node.js 20.19+ 또는 22.12+
- Python 3.11+
- Mac과 iPad가 연결된 동일한 로컬 네트워크

## 환경 변수 설정

루트의 예시 파일을 복사해 개인 설정 파일을 만듭니다.

```bash
cp .env.example .env
```

기본값은 Mac 브라우저의 로컬 개발에 맞춰져 있습니다. `.env`는 Git에서 제외됩니다. Backend 포트를 바꾸면 `AGENT_PORT`와 실제 Uvicorn `--port`를 같은 값으로 설정하세요. iPad에서 다른 포트나 HTTPS Agent를 사용한다면 최초 연결 주소 또는 `VITE_API_BASE_URL`을 설정할 수 있습니다. Gemini와 Notion API Key는 Backend에서만 읽으며 Frontend 응답에는 포함하지 않습니다.

## Backend 실행

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

확인 주소는 `http://localhost:8000/api/health`, Agent 정보는 `http://localhost:8000/api/agent/info`, WebSocket 주소는 `ws://localhost:8000/ws`, API 문서는 `http://localhost:8000/docs`입니다. SQLite 파일 `backend/codepad.db`는 첫 실행 시 자동 생성됩니다.

시작 로그에는 Mac hostname, 권장 `.local` 주소, 현재 IP fallback 주소와 포트가 표시됩니다. iPad의 첫 연결 화면에는 로그의 `Recommended Address`를 입력하는 것을 권장합니다. Uvicorn은 계속 `0.0.0.0`에 bind하므로 같은 로컬 네트워크의 iPad에서 접근할 수 있습니다.

## Frontend 실행

새 Terminal에서 실행합니다.

```bash
cd frontend
npm install
npm run dev
```

화면에 표시된 Network 주소를 Mac 또는 iPad Safari에서 엽니다. 기본 포트는 `5173`입니다. Mac의 IP가 바뀌어도 같은 주소를 쓰려면 Backend 시작 로그의 hostname을 사용하세요(예: `http://your-mac.local:5173`). 개발 서버는 로컬 네트워크의 `.local` hostname을 허용합니다.

## iPad에서 접속

1. Backend와 Frontend를 위와 같이 실행합니다.
2. iPad Safari에서 Vite가 표시한 Network 주소를 엽니다.
3. 첫 연결이 필요하면 Backend 시작 로그의 `Recommended Address`(예: `chae-young-macbook.local:8000`)를 입력합니다.
4. Mac 방화벽이 연결을 묻는 경우 Python과 Node의 로컬 네트워크 접근을 허용합니다.

기본 CORS 정책은 명시된 `CORS_ORIGINS`에 더해 localhost, RFC1918 사설 IP, `*.local` origin만 허용합니다. Public origin 전체를 허용하지 않습니다.

## Mac Agent 연결 방식

Frontend는 연결 정보를 브라우저 localStorage에 보관하고 다음 순서로 Agent를 확인합니다.

1. 마지막 연결에서 받은 `.local` hostname
2. 마지막으로 성공한 로컬 IP
3. `VITE_API_BASE_URL` 또는 현재 PWA 페이지와 같은 host의 `8000` 포트
4. 자동 연결 실패 후 사용자가 입력한 주소

연결에 성공하면 `/api/agent/info`에서 현재 `.local` hostname과 IP를 다시 받아 저장합니다. 따라서 Wi-Fi 변경으로 `192.168.x.x` 주소가 달라져도 같은 네트워크에서 `.local` 이름이 해석되면 설정 변경 없이 연결되며, 새 IP도 다음 fallback으로 갱신됩니다. 기존 `codepad.agentUrl`, `codepad.agent-url`, `agentUrl` localStorage 값은 삭제하지 않고 첫 fallback 설정으로 마이그레이션합니다.

REST API와 WebSocket은 별도 주소를 만들지 않습니다. health check가 성공한 동일한 base URL에서 `/api/...`와 `/ws`를 만들며, HTTPS Agent에서는 `wss://`를 사용합니다. 연결이 끊기면 매번 hostname부터 다시 확인하고 1초, 2초, 5초, 10초(이후 10초) backoff로 재시도합니다.

### 연결 실패 해결

- Mac Agent가 실행 중이고 `--host 0.0.0.0`으로 시작했는지 확인합니다.
- Mac과 iPad가 같은 Wi-Fi 또는 같은 로컬 네트워크에 있는지 확인합니다.
- macOS 방화벽에서 Python/Uvicorn의 수신 연결이 허용됐는지 확인합니다.
- `.local` 이름이 해석되지 않으면 Settings의 **연결 설정 변경**에서 시작 로그의 `Fallback Address`를 입력합니다.
- HTTPS로 제공되는 PWA는 브라우저 mixed-content 정책상 HTTP Agent에 접근하지 못할 수 있으므로 양쪽 프로토콜 구성을 맞춥니다.

브라우저/PWA는 네이티브 Bonjour service browser를 안정적으로 제공하지 않으므로 `_codepad._tcp.local` 자동 탐색은 구현하지 않았습니다. 이 기능은 `.local` DNS 이름 해석을 사용하며, 서로 다른 Wi-Fi나 외부 인터넷을 통한 원격 연결은 지원하지 않습니다.

## PWA 홈 화면에 추가

iPad Safari에서 CodePad를 연 뒤 공유 버튼을 누르고 **홈 화면에 추가**를 선택합니다. 로컬 HTTP 환경에서는 iPadOS 버전 및 보안 정책에 따라 Service Worker 설치가 제한될 수 있으며, 안정적인 설치를 위해서는 로컬 HTTPS가 필요할 수 있습니다.

## 프로젝트 등록

1. Dashboard의 **Project** 카드 또는 **Add project** 버튼을 누릅니다.
2. 표시 이름과 Mac에 존재하는 절대 경로를 입력합니다. 예: `/Users/me/Projects/my-app`.
3. **Register & select**를 누르면 프로젝트가 SQLite에 저장되고 즉시 선택됩니다.
4. 여러 프로젝트가 있다면 Projects 화면에서 원하는 항목을 눌러 전환합니다.

프로젝트를 제거해도 실제 폴더나 파일은 삭제되지 않으며 CodePad 등록 정보만 제거됩니다. 선택한 경로가 Git 저장소가 아니면 프로젝트 등록은 가능하지만 Git 상태 영역에 안내가 표시됩니다.

## Git Commit과 Push

1. **Git control**에서 Commit할 변경 파일만 체크합니다.
2. Commit 메시지를 입력하고 **Review commit**을 누릅니다.
3. branch, 메시지, 선택 파일을 확인한 뒤 **Commit**을 누릅니다.
4. Push할 때는 **Push**를 누르고 현재 branch, `origin` 목적지, ahead commit 수를 확인합니다.

CodePad는 선택한 파일만 Commit하며 선택하지 않은 staged 파일도 Commit에 포함하지 않습니다. Push 대상은 현재 checkout된 branch와 `origin`으로 고정됩니다. Force push는 지원하지 않습니다. Git 인증이 필요한 경우 Mac에 설정된 SSH key 또는 credential helper를 사용하며, Agent가 대화형 비밀번호 입력을 요청하지는 않습니다.

Commit할 파일을 선택한 뒤 **AI로 Commit Message 추천**을 누르면 Gemini가 영어 Commit Message 후보를 최대 3개 생성합니다. 선택한 변경 파일만 `git diff` 대상으로 사용하며 최대 20개 파일, 최대 30,000자의 Diff만 전송합니다. 큰 Diff는 잘린 사실을 UI에 표시합니다. 추천 문구를 선택해도 입력창에서 자유롭게 수정할 수 있고, 기존 확인 화면을 거쳐야만 Commit됩니다. Gemini는 자동 Commit이나 Push를 실행하지 않으며, 추천 실패 시에도 직접 입력하는 기존 Commit 흐름은 그대로 사용할 수 있습니다.

## Command Runner

1. 먼저 실행 대상 Project를 선택합니다.
2. **Command runner**에서 이름, 명령어, 작업 폴더를 입력합니다.
3. 작업 폴더는 선택한 Project 기준 상대 경로로 입력합니다. Project 루트는 `.`, Backend 폴더는 `backend`처럼 입력합니다.
4. **Run**을 누른 뒤 표시되는 전체 명령과 실제 작업 폴더를 확인합니다.
5. **Run command**를 눌러 실행하면 stdout/stderr가 Output 영역에 표시됩니다.

명령은 shell을 통하지 않고 argument list 형태로 실행됩니다. `&&`, pipe, redirect와 같은 shell 연산자는 지원하지 않으며 명령을 각각 등록해야 합니다. `sudo`, `rm -rf`, force push, `git reset --hard`는 차단됩니다. 출력은 실행당 최근 100,000자까지 SQLite에 저장됩니다. 장시간 실행되는 서버는 **Stop**을 누르고 다시 확인한 뒤 종료할 수 있습니다.

## Error Monitor

CodePad가 실행한 Command에서 stderr가 발생하면 실행별 오류 기록을 생성하고 WebSocket으로 Dashboard에 즉시 전달합니다. 추가 stderr는 같은 기록의 stack trace에 이어지며 최근 100,000자까지 저장됩니다.

**Error monitor**에서 시간, 프로젝트, 파일과 라인, 오류 요약을 확인할 수 있습니다. 카드를 누르면 실행 명령과 전체 stack trace가 표시됩니다. 일반적인 Python traceback과 `file.ts:27` 형태의 위치를 자동 인식합니다. 일부 개발 도구는 정상 진행 정보도 stderr로 출력하므로 Phase 6에서는 해당 출력도 오류 후보로 기록될 수 있습니다. AI 분석은 Phase 7에서 연결합니다.

Error 상세의 상태 버튼 또는 `•••` 메뉴에서 해결 여부를 변경하고 개인 메모를 추가·수정·삭제할 수 있습니다. Error Message, Stack Trace, 파일, 줄 번호, 발생 시간, 실행 Command 원본은 수정할 수 없습니다. Error 기록을 삭제하면 확인 절차 후 연결된 AI 분석만 함께 정리되며 Project와 Command 기록은 유지됩니다.

## Gemini Error Assistant

루트 `.env`에 Gemini API Key와 모델을 설정하고 Backend를 재시작합니다.

```env
GEMINI_API_KEY=your-api-key
GEMINI_MODEL=gemini-3.6-flash
```

Error detail에서 **Analyze with Gemini**를 누르면 전송될 언어, Framework, 오류, stack trace, 파일 위치와 관련 코드 일부를 먼저 확인할 수 있습니다. 다시 **Analyze**를 눌러야 API가 호출됩니다.

프로젝트 전체 코드는 전송하지 않습니다. 오류 파일이 선택 프로젝트 내부에 있을 때만 해당 라인 앞뒤 20줄, 최대 8,000자를 포함하며 stack trace는 최근 30,000자로 제한합니다. 프로젝트 외부 파일, 1MB를 넘는 파일, 읽을 수 없는 파일은 코드 Context에서 제외됩니다.

분석 결과는 원인, 쉬운 설명, 해결 단계, 수정 코드, Terminal command로 나뉘어 SQLite에 저장됩니다. 코드와 명령은 복사만 가능하며 CodePad가 자동으로 파일을 수정하거나 AI 제안 명령을 실행하지 않습니다.

## Custom Dashboard

Dashboard의 **Manage** 또는 **+ Add action**을 누르면 Action을 관리할 수 있습니다.

- Error Monitor, Git Commit, Git Push, Git Pull, Notion, Saved Command 유형을 추가할 수 있습니다.
- 이름과 아이콘을 변경할 수 있습니다.
- 위·아래 버튼으로 Dashboard 표시 순서를 변경할 수 있습니다.
- Saved Command 유형은 특정 Command를 연결하거나 Command Runner로 이동하게 설정할 수 있습니다.
- 특정 Command를 연결한 Action도 실행 전 명령·프로젝트·작업 폴더 확인을 반드시 거칩니다.

기본 Action은 새 DB에서 최초 한 번만 생성되며 Built-in으로 보호됩니다. 사용자가 만든 Custom Action은 삭제해도 Agent 재시작 시 다시 추가되지 않습니다. Notion Action은 개발일지 작성 영역으로 이동합니다.

Deck의 Quick Action Card는 실행에 집중하도록 상시 관리 버튼을 표시하지 않습니다. 우측 상단 `•••` 메뉴에서 Action 수정, 순서 이동, 현재 Deck에서 제거를 선택할 수 있습니다. Deck에서 제거해도 원본 Action은 유지됩니다. Git, AI Error, Notion, 기본 Command Runner와 같은 Built-in Action은 완전히 삭제할 수 없지만 Deck에서는 제거할 수 있습니다.

Quick Action Card를 누르면 별도 페이지로 이동하는 대신 현재 화면 위에 팝업형 Sheet가 열립니다. Git Commit·Push·Pull, AI Error, Notion 개발일지, Saved Command를 Sheet 안에서 확인하고 실행할 수 있으며, 각 Sheet의 `전체 보기` 링크를 통해 기존 상세 페이지도 계속 사용할 수 있습니다.

Sheet는 작업 크기에 따라 `sm`, `md`, `lg` 너비를 사용하고 iPad 세로 화면에서는 하단 Sheet 형태로 표시됩니다. 바깥 영역, 닫기 버튼, `Esc`로 닫을 수 있고 입력 중인 내용이 있으면 저장되지 않은 변경사항을 확인합니다. 실행 중에는 실수로 닫히지 않으며 성공 시 약 0.9초 뒤 자동으로 닫힙니다. 실패, Git Conflict, AI 분석 결과는 확인할 수 있도록 열린 상태를 유지합니다. 열린 동안 배경 스크롤과 키보드 Focus가 Sheet 안에 고정되고, 닫으면 원래 누른 카드로 Focus가 돌아갑니다.

## Accent Color

Settings의 **화면 → Accent Color**에서 Blue, Purple, Green, Orange, Pink 중 하나를 선택할 수 있습니다. 선택값은 localStorage에 저장되어 새로고침과 PWA 재실행 후에도 유지됩니다. 배경과 카드의 Dark/Neutral 구조는 유지하고 Primary Button, 선택 메뉴, 링크, focus ring과 Action 아이콘에만 Accent를 적용합니다. Error의 Red와 성공·연결 상태의 Green은 의미 보존을 위해 테마 영향을 받지 않습니다.

카드 press와 페이지 진입에는 짧은 scale/opacity/translate 효과만 사용합니다. 운영체제에서 `prefers-reduced-motion: reduce`를 설정한 경우 Animation과 부드러운 scroll을 최소화합니다.

## Notion 개발일지

Notion에서 Internal Integration을 만들고 대상 Database/Data Source를 해당 Integration에 공유한 뒤 루트 `.env`에 설정합니다. 최신 API에서는 Data Source ID 사용을 권장합니다.

```env
NOTION_API_KEY=your-internal-integration-secret
NOTION_DATA_SOURCE_ID=your-data-source-id
```

기존 Database ID만 알고 있고 그 Database에 Data Source가 하나뿐이라면 `NOTION_DATABASE_ID`를 대신 사용할 수 있습니다. 여러 Data Source가 있다면 `NOTION_DATA_SOURCE_ID`를 직접 지정해야 합니다. Backend를 재시작한 뒤 **Development journal**의 **Check connection**으로 연결과 대상을 확인하세요.

제목과 본문을 입력하고 태그는 쉼표로 구분합니다. **Review & save**에서 전송 내용을 다시 확인해야만 Notion 페이지가 생성됩니다. 연결된 Data Source의 실제 title 속성을 자동 탐색하며 multi-select 속성이 있으면 태그를 저장합니다. multi-select 속성이 없다면 태그는 페이지 본문 첫 줄에 기록됩니다. API 키는 Mac Agent 밖으로 전달되지 않습니다.

**Generate with Gemini**를 누르면 현재 선택 프로젝트에서 오늘 생성된 Commit과 관련 파일, 아직 Commit하지 않은 변경 파일명, 실행한 Command와 상태, 감지된 Error 및 기존 AI 해결 요약을 먼저 보여줍니다. 확인 후에만 이 요약이 Gemini로 전송됩니다. Command 출력 전체, Error stack trace, 프로젝트 소스 코드는 개발일지 생성 Context에 포함하지 않습니다.

Gemini 결과는 입력 폼을 채우는 초안일 뿐입니다. 제목·본문·태그를 자유롭게 수정할 수 있으며 **Review & save**를 다시 눌러야 Notion에 저장됩니다. AI 생성 직후 자동 저장은 수행하지 않습니다.

## 테스트 및 검증

Backend:

```bash
cd backend
source .venv/bin/activate
pytest
```

Frontend:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
```

## 프로젝트 구조

```text
CodePad/
├── backend/
│   ├── app/
│   │   ├── core/         # 환경 설정
│   │   ├── database/     # SQLModel engine/session
│   │   ├── models/       # DB 모델
│   │   ├── routers/      # HTTP 라우터
│   │   ├── schemas/      # API 응답 스키마
│   │   └── main.py
│   └── tests/
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       ├── services/
│       └── types/
├── .env.example
└── README.md
```

## 향후 기능

다음 Phase에서는 MVP 통합 검증과 사용성 개선을 진행할 수 있습니다.
