# CodePad

CodePad는 Mac에서 실행되는 로컬 Agent를 iPad PWA에서 확인하고 제어하기 위한 개인용 개발 도구입니다. 현재 저장소는 Phase 10까지 구성되어, Project/Git 제어, Command Runner, Error Assistant, 사용자 설정 Dashboard와 AI 기반 Notion 개발일지를 사용할 수 있습니다.

## 현재 구현 기능

- React + TypeScript + Vite 기반 반응형 PWA
- iPad 우선 다크 Dashboard
- FastAPI `GET /api/health` 상태 확인
- FastAPI `WS /ws` 실시간 연결 및 heartbeat
- 연결 종료 시 지수 백오프 자동 재접속
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
- Gemini Provider 기반 오류 원인·설명·해결 단계 구조화
- 분석 전 외부 전송 Context 확인
- AI 분석 기록 SQLite 저장 및 코드·명령 복사
- Dashboard Action 추가·편집·삭제·순서 변경
- Action 이름·아이콘·유형·Saved Command 연결 설정
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

기본값은 Mac 브라우저의 로컬 개발에 맞춰져 있습니다. `.env`는 Git에서 제외됩니다. iPad에서 다른 포트나 HTTPS Agent를 사용한다면 `VITE_API_BASE_URL`을 설정하세요. Gemini와 Notion API Key는 Backend에서만 읽으며 Frontend 응답에는 포함하지 않습니다.

## Backend 실행

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

확인 주소는 `http://localhost:8000/api/health`, WebSocket 주소는 `ws://localhost:8000/ws`, API 문서는 `http://localhost:8000/docs`입니다. SQLite 파일 `backend/codepad.db`는 첫 실행 시 자동 생성됩니다.

## Frontend 실행

새 Terminal에서 실행합니다.

```bash
cd frontend
npm install
npm run dev
```

화면에 표시된 Network 주소를 Mac 또는 iPad Safari에서 엽니다. 기본 포트는 `5173`입니다.

## iPad에서 접속

1. Mac의 시스템 설정에서 로컬 IP 주소를 확인합니다. 예: `192.168.0.20`.
2. Backend와 Frontend를 위와 같이 실행합니다.
3. `.env`의 `CORS_ORIGINS`에 `http://192.168.0.20:5173`을 추가하고 Backend를 재시작합니다.
4. iPad Safari에서 `http://192.168.0.20:5173`을 엽니다.
5. Mac 방화벽이 연결을 묻는 경우 Python과 Node의 로컬 네트워크 접근을 허용합니다.

Frontend는 별도 설정이 없으면 현재 페이지의 호스트명과 `8000` 포트를 조합해 Agent에 접속합니다.

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

- Error Monitor, Git Commit, Git Push, Notion, Saved Command 유형을 추가할 수 있습니다.
- 이름과 아이콘을 변경할 수 있습니다.
- 위·아래 버튼으로 Dashboard 표시 순서를 변경할 수 있습니다.
- Saved Command 유형은 특정 Command를 연결하거나 Command Runner로 이동하게 설정할 수 있습니다.
- 특정 Command를 연결한 Action도 실행 전 명령·프로젝트·작업 폴더 확인을 반드시 거칩니다.

기본 Action은 새 DB에서 최초 한 번만 생성됩니다. 모든 Action을 삭제한 경우에도 Agent 재시작 시 자동으로 다시 추가되지 않습니다. Notion Action은 개발일지 작성 영역으로 이동합니다.

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
