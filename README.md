# CodePad

> **Mac에서 개발하고, iPad에서 빠르게 제어하는 로컬 개발 보조 도구**

CodePad는 Mac에서 실행되는 **Local Agent**와 iPad의 **PWA Dashboard**를 연결하여 개발 중 반복적으로 사용하는 작업을 빠르게 처리할 수 있도록 만든 개인용 개발 도구입니다.

Mac에서는 기존처럼 VS Code와 Terminal을 사용해 개발하고, iPad에서는 CodePad를 통해 프로젝트 상태 확인, Git 작업, Command 실행, Error 분석, 개발일지 작성 등의 보조 작업을 수행할 수 있습니다.

현재 프로젝트는 **MVP / Phase 10** 단계이며, Mac과 iPad가 같은 로컬 네트워크에 연결된 환경을 기준으로 동작합니다.

---

## Why CodePad?

개발을 하다 보면 코드 작성 외에도 여러 작업을 반복하게 됩니다.

* Git 변경사항 확인
* Commit / Push / Pull
* 개발 서버 실행
* 오류 메시지 확인
* AI에게 오류 질문
* Commit Message 작성
* 개발 내용 기록

CodePad는 이런 작업 때문에 개발 흐름이 끊기는 문제를 줄이고자 시작했습니다.

```text
Mac
└─ 코드 작성 / 프로젝트 실행
        │
        │ Local Network
        ▼
iPad - CodePad
├─ Git Control
├─ Command Runner
├─ Error Monitor
├─ Gemini Assistant
└─ Notion Journal
```

핵심 아이디어는 간단합니다.

> **Mac은 개발 작업에 집중하고, iPad는 개발을 보조하는 Sidecar처럼 사용합니다.**

---

# How It Works

CodePad는 **Mac Agent + iPad PWA** 구조로 동작합니다.

```text
┌─────────────────────────────┐
│        iPad / Safari        │
│                             │
│       CodePad PWA           │
│                             │
│  Quick Actions / Dashboard  │
└──────────────┬──────────────┘
               │
          REST / WebSocket
               │
        Local Network
               │
┌──────────────▼──────────────┐
│          Mac Agent          │
│          FastAPI            │
│                             │
├─ Project Management         │
├─ Git                        │
├─ Command Runner             │
├─ Error Monitor              │
├─ SQLite                     │
├─ Gemini API                 │
└─ Notion API                 │
└─────────────────────────────┘
```

Mac에서 FastAPI Agent를 실행하면 iPad의 CodePad PWA가 같은 Wi-Fi를 통해 Agent에 연결합니다.

CodePad는 Mac의 프로젝트 파일 자체를 iPad로 옮기는 방식이 아니라, **Mac에서 필요한 작업을 실행하고 그 결과를 iPad Dashboard에 전달하는 방식**으로 동작합니다.

---

# Main Features

## 1. Project Management

Mac에 있는 개발 프로젝트를 CodePad에 등록할 수 있습니다.

프로젝트를 등록할 때 실제 Mac의 절대 경로를 사용합니다.

```text
/Users/me/Projects/my-app
```

등록 후에는 여러 프로젝트 사이를 전환할 수 있으며 현재 선택된 프로젝트를 기준으로 Git, Command, Error 기능이 동작합니다.

프로젝트를 CodePad에서 제거하더라도 실제 Mac의 프로젝트 폴더나 파일은 삭제되지 않습니다.

---

## 2. Deck & Quick Actions

자주 사용하는 개발 기능을 **Quick Action**으로 등록하고 목적에 따라 **Deck**으로 묶어서 관리할 수 있습니다.

예를 들어 다음과 같이 구성할 수 있습니다.

```text
Backend Deck

├─ Git Commit
├─ Git Push
├─ Git Pull
├─ Run Backend
└─ AI Error
```

지원되는 Action 유형은 다음과 같습니다.

* AI Error
* Git Commit
* Git Push
* Git Pull
* Notion
* Saved Command

Quick Action을 짧게 누르면 별도 페이지로 이동하지 않고 **현재 화면 위에 Sheet 형태로 기능이 열립니다.**

작업이 끝나면 다시 Home 화면으로 자연스럽게 돌아갈 수 있습니다.

### Quick Action 순서 변경

Quick Action Card를 약 **0.5초간 길게 누른 뒤 Drag**하면 원하는 위치로 이동시킬 수 있습니다.

변경된 순서는 SQLite에 저장되며 저장에 실패하면 이전 배치로 복원됩니다.

각 Action의 `•••` 메뉴에서는 Action 수정 또는 현재 Deck에서 제거가 가능합니다.

Built-in Action은 완전히 삭제할 수 없지만 Deck에서는 제거할 수 있습니다.

---

## 3. Git Control

선택한 프로젝트의 Git 상태를 iPad에서 확인하고 기본적인 Git 작업을 실행할 수 있습니다.

### Git Status

현재 Branch와 변경된 파일을 확인할 수 있습니다.

```text
main

M  frontend/src/App.tsx
A  frontend/src/components/QuickAction.tsx
D  frontend/src/old.ts
```

staged / unstaged 상태뿐만 아니라 수정, 추가, 삭제, 이름 변경 상태를 구분하여 표시합니다.

### Git Commit

Commit할 파일을 직접 선택한 뒤 Commit Message를 입력하여 Commit할 수 있습니다.

Commit 전에는 다음 내용을 다시 확인합니다.

```text
Branch
Commit Message
Selected Files
```

선택하지 않은 파일은 Commit에 포함하지 않습니다.

### AI Commit Message

선택한 파일의 Git Diff를 Gemini가 분석하여 최대 3개의 Commit Message를 추천합니다.

```text
feat: add drag-and-drop ordering for quick actions
```

Gemini가 추천한 메시지는 사용자가 직접 수정할 수 있으며 AI가 자동으로 Commit하지 않습니다.

### Git Push

현재 Branch를 `origin`으로 Push합니다.

Push 전 Remote 상태를 확인하고 Remote에 Local에 없는 Commit이 존재하는 경우 Push를 차단합니다.

### Safe Pull

Git Pull은 다음 방식만 사용합니다.

```bash
git pull --ff-only origin <branch>
```

CodePad는 자동 Merge, Rebase, Stash를 수행하지 않습니다.

Branch가 분기되었거나 Conflict가 있는 경우 작업 트리를 임의로 수정하지 않고 Mac에서 직접 해결하도록 안내합니다.

---

# 4. Command Runner

프로젝트에서 자주 사용하는 Terminal Command를 저장하고 iPad에서 실행할 수 있습니다.

예를 들어 다음 Command를 등록할 수 있습니다.

```text
Name
Run Backend

Command
uvicorn app.main:app --reload

Working Directory
backend
```

실행 전에는 다음 정보를 다시 확인할 수 있습니다.

* 실행할 Command
* 선택된 Project
* Working Directory

실행 결과의 `stdout`, `stderr`, 종료 코드가 저장되며 이전 실행 기록도 확인할 수 있습니다.

장시간 실행되는 서버와 같은 Process는 **Stop** 버튼으로 종료할 수 있습니다.

### Command Safety

Command는 shell string이 아닌 argument list 방식으로 실행됩니다.

따라서 다음과 같은 Shell 연산자는 직접 지원하지 않습니다.

```bash
&&
|
>
```

또한 실수로 시스템이나 Git Repository에 큰 영향을 줄 수 있는 일부 명령은 차단합니다.

```text
sudo
rm -rf
git push --force
git reset --hard
```

---

# 5. Error Monitor

CodePad를 통해 실행한 Command에서 실제 Error가 발생하면 자동으로 감지하여 Error History에 저장합니다.

다음과 같은 정보를 자동으로 추출합니다.

```text
Error Message
Stack Trace
File
Line
Command
Project
Occurred Time
```

Python Traceback과 다음과 같은 일반적인 파일 위치 형식을 인식합니다.

```text
frontend/src/App.tsx:27
```

단순 Warning이나 정상 Server 실행 로그는 Error History에 저장하지 않습니다.

Error별로 다음 상태를 관리할 수 있습니다.

* 해결 / 미해결
* 개인 메모
* Error 기록 삭제

원본 Error Message, Stack Trace, 파일 위치와 실행 Command는 임의로 수정할 수 없습니다.

---

# 6. Gemini Error Assistant

저장된 Error를 Gemini에게 분석 요청할 수 있습니다.

Gemini에게 바로 데이터를 보내지 않고 **전송될 Context를 먼저 사용자에게 보여준 뒤 확인을 받은 경우에만 요청**합니다.

전송되는 정보는 필요한 범위로 제한됩니다.

```text
Error
Stack Trace
File / Line
관련 코드 일부
```

프로젝트 전체 코드를 Gemini에게 전송하지 않습니다.

오류가 발생한 파일이 현재 프로젝트 내부에 있는 경우 해당 Line 주변 일부 코드만 Context에 포함합니다.

Gemini 분석 결과는 다음과 같이 구조화됩니다.

```text
원인
쉬운 설명
해결 단계
수정 코드
Terminal Command
```

추천된 코드와 Command는 사용자가 확인하고 복사할 수 있지만 CodePad가 자동으로 소스 코드를 수정하거나 AI가 제안한 Command를 실행하지는 않습니다.

---

# 7. Notion Development Journal

개발 내용을 Notion에 바로 기록할 수 있습니다.

사용자가 직접 다음 내용을 작성할 수 있습니다.

```text
Title
Content
Tags
```

저장 전 Review 단계에서 실제로 Notion에 전송될 내용을 다시 확인합니다.

### AI Development Journal

Gemini를 이용해 하루 동안의 개발 기록을 바탕으로 개발일지 초안을 생성할 수도 있습니다.

CodePad는 현재 선택한 프로젝트에서 오늘 발생한 다음 정보를 수집합니다.

```text
Commit
Changed Files
Command History
Error History
AI Error Summary
```

전송 Context를 사용자에게 먼저 보여주고 확인 후 Gemini에게 전달합니다.

Command의 전체 출력, Error Stack Trace 전체, 프로젝트 소스 코드 전체는 개발일지 생성 Context에 포함하지 않습니다.

Gemini가 생성한 결과는 **초안**으로만 사용됩니다.

사용자가 제목, 내용, 태그를 자유롭게 수정한 후 별도의 확인 과정을 거쳐야 Notion에 저장됩니다.

---

# 8. Local Network Connection

CodePad는 기본적으로 **Mac과 iPad가 같은 Local Network에 있는 환경**에서 동작합니다.

Frontend는 Agent 연결 시 다음 순서로 연결을 시도합니다.

```text
1. 마지막으로 연결된 .local hostname
2. 마지막으로 성공한 Local IP
3. VITE_API_BASE_URL
4. 현재 PWA Host의 Port 8000
5. 사용자가 직접 입력한 Agent 주소
```

예:

```text
chae-young-macbook.local:8000
```

Wi-Fi 변경으로 Mac의 `192.168.x.x` IP 주소가 변경되더라도 `.local` hostname이 정상적으로 동작하면 별도의 설정 변경 없이 다시 연결할 수 있습니다.

연결이 끊어진 경우 다음 간격으로 자동 재연결을 시도합니다.

```text
1s → 2s → 5s → 10s → 10s ...
```

현재는 서로 다른 Wi-Fi 또는 외부 인터넷을 통한 Remote Connection은 지원하지 않습니다.

---

# 9. Custom UI

CodePad는 iPad에서 사용하기 편하도록 Apple 스타일의 Dark Dashboard를 기반으로 디자인되어 있습니다.

Settings에서 Accent Color를 변경할 수 있습니다.

```text
Blue
Purple
Green
Orange
Pink
```

Accent Color는 다음 UI 요소에 적용됩니다.

* Primary Button
* 선택된 Menu
* Link
* Focus Ring
* Action Icon

Error의 Red와 Success / Connection 상태의 Green 등 의미를 나타내는 색상은 Theme의 영향을 받지 않습니다.

`prefers-reduced-motion` 설정도 지원하여 운영체제에서 Animation 감소 옵션을 사용하면 화면 효과를 최소화합니다.

---

# Tech Stack

## Frontend

```text
React 19
TypeScript
Vite
Tailwind CSS
Vite PWA
```

## Backend

```text
Python 3.11+
FastAPI
SQLModel
SQLite
WebSocket
Uvicorn
```

## External API

```text
Google Gemini API
Notion API
```

---

# Getting Started

## Requirements

실행 전 다음 환경이 필요합니다.

```text
Node.js 20.19+ 또는 22.12+
Python 3.11+
Mac
iPad
동일한 Local Network
```

---

## 1. Clone Repository

```bash
git clone <repository-url>
cd Sidecar-project-agent-codepad-mvp
```

---

## 2. Environment Variables

루트의 `.env.example`을 복사합니다.

```bash
cp .env.example .env
```

기본 설정은 다음과 같습니다.

```env
APP_NAME=CodePad Agent
APP_ENV=development
AGENT_PORT=8000

DATABASE_URL=sqlite:///./codepad.db

CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

VITE_API_BASE_URL=

GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash

NOTION_API_KEY=
NOTION_DATA_SOURCE_ID=
NOTION_DATABASE_ID=
NOTION_VERSION=2026-03-11
```

`.env` 파일은 Git에서 제외됩니다.

API Key는 Frontend가 아닌 Backend에서만 사용합니다.

---

# Backend

Backend 폴더로 이동합니다.

```bash
cd backend
```

Python 가상환경을 생성합니다.

```bash
python3 -m venv .venv
```

macOS에서 가상환경을 활성화합니다.

```bash
source .venv/bin/activate
```

Dependency를 설치합니다.

```bash
pip install -r requirements-dev.txt
```

FastAPI Agent를 실행합니다.

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

정상 실행되면 다음 주소를 사용할 수 있습니다.

```text
Health Check
http://localhost:8000/api/health

Agent Info
http://localhost:8000/api/agent/info

API Docs
http://localhost:8000/docs

WebSocket
ws://localhost:8000/ws
```

SQLite Database인 다음 파일은 최초 실행 시 자동으로 생성됩니다.

```text
backend/codepad.db
```

Backend 시작 로그에는 다음 정보가 표시됩니다.

```text
Hostname
Recommended Address
Fallback Address
Port
```

iPad 연결 시 **Recommended Address** 사용을 권장합니다.

---

# Frontend

새 Terminal을 열고 Frontend 폴더로 이동합니다.

```bash
cd frontend
```

Dependency를 설치합니다.

```bash
npm install
```

Vite 개발 서버를 실행합니다.

```bash
npm run dev
```

기본 포트는 `5173`입니다.

Mac 또는 iPad Safari에서 Terminal에 표시된 Network 주소를 열면 됩니다.

---

# Connect from iPad

1. Mac에서 Backend를 실행합니다.
2. Mac에서 Frontend를 실행합니다.
3. Mac과 iPad가 같은 Wi-Fi에 연결되어 있는지 확인합니다.
4. iPad Safari에서 Vite Network 주소를 엽니다.
5. Agent 연결이 필요하면 Backend 로그의 `Recommended Address`를 입력합니다.
6. macOS에서 Python 또는 Node의 네트워크 접근을 요청하면 Local Network 접근을 허용합니다.

예:

```text
Frontend
http://your-mac.local:5173

Backend Agent
http://your-mac.local:8000
```

---

# Add to iPad Home Screen

Safari에서 CodePad를 연 뒤

```text
공유 → 홈 화면에 추가
```

를 선택하면 일반 앱처럼 실행할 수 있습니다.

CodePad는 PWA를 지원합니다.

단, Local HTTP 환경에서는 iPadOS 보안 정책에 따라 Service Worker 설치가 제한될 수 있으며 안정적인 PWA 설치를 위해 Local HTTPS 구성이 필요할 수 있습니다.

---

# Gemini Setup

`.env`에 Gemini API Key를 설정합니다.

```env
GEMINI_API_KEY=your-api-key
GEMINI_MODEL=gemini-3.6-flash
```

설정 변경 후 Backend를 다시 실행합니다.

Gemini는 현재 다음 기능에서 사용됩니다.

```text
Error 분석
Git Commit Message 추천
Notion 개발일지 초안 생성
```

AI 기능은 자동으로 Git 작업이나 파일 수정을 수행하지 않습니다.

---

# Notion Setup

Notion에서 Internal Integration을 생성한 뒤 사용할 Database / Data Source를 Integration에 공유합니다.

`.env`에 다음 값을 입력합니다.

```env
NOTION_API_KEY=your-internal-integration-secret
NOTION_DATA_SOURCE_ID=your-data-source-id
```

최신 구조에서는 `NOTION_DATA_SOURCE_ID` 사용을 권장합니다.

기존 Database ID만 사용하는 경우 다음 설정도 지원합니다.

```env
NOTION_DATABASE_ID=your-database-id
```

단, Database 내부에 여러 Data Source가 있다면 `NOTION_DATA_SOURCE_ID`를 직접 설정해야 합니다.

---

# Project Structure

```text
CodePad/
│
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   └── config.py
│   │   │
│   │   ├── database/
│   │   │
│   │   ├── models/
│   │   │   ├── action.py
│   │   │   ├── ai.py
│   │   │   ├── command.py
│   │   │   ├── deck.py
│   │   │   ├── error.py
│   │   │   ├── notion.py
│   │   │   └── project.py
│   │   │
│   │   ├── providers/
│   │   │   ├── gemini_provider.py
│   │   │   └── notion_provider.py
│   │   │
│   │   ├── routers/
│   │   │   ├── actions.py
│   │   │   ├── ai.py
│   │   │   ├── commands.py
│   │   │   ├── decks.py
│   │   │   ├── errors.py
│   │   │   ├── git.py
│   │   │   ├── health.py
│   │   │   ├── notion.py
│   │   │   ├── project.py
│   │   │   └── websocket.py
│   │   │
│   │   ├── services/
│   │   │
│   │   └── main.py
│   │
│   └── tests/
│
├── frontend/
│   ├── public/
│   │
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       ├── services/
│       ├── types/
│       ├── App.tsx
│       └── main.tsx
│
├── .env.example
├── .gitignore
└── README.md
```

---

# Testing

## Backend

```bash
cd backend

source .venv/bin/activate

pytest
```

## Frontend

Lint:

```bash
cd frontend
npm run lint
```

Type Check:

```bash
npm run typecheck
```

Production Build:

```bash
npm run build
```

---

# Privacy & Safety

CodePad는 개발 프로젝트를 다루는 도구인 만큼 사용자의 확인 없이 중요한 작업이 실행되지 않도록 설계했습니다.

### Local First

Mac Agent와 iPad는 기본적으로 같은 Local Network 안에서 통신합니다.

### API Keys

Gemini와 Notion API Key는 Backend에서만 읽으며 Frontend API 응답에 포함하지 않습니다.

### AI Context Review

Gemini에게 데이터를 보내기 전에 전송될 Context를 사용자가 확인합니다.

프로젝트 전체 소스 코드를 자동으로 Gemini에 전송하지 않습니다.

### Git Safety

다음과 같은 위험한 Git 작업은 자동으로 수행하지 않습니다.

```text
Force Push
자동 Merge
자동 Rebase
자동 Stash
Hard Reset
```

### Command Safety

`sudo`, 강제 재귀 삭제, Force Push 등 위험도가 높은 Command는 차단합니다.

---

# Current Status

```text
Version       0.10.0
Stage         MVP / Phase 10
Frontend      React PWA
Backend       FastAPI Local Agent
Database      SQLite
Target        macOS + iPadOS
Network       Local Network
```

현재 주요 기능은 실제 사용이 가능한 형태로 구현되어 있으며, 안정성과 사용성을 계속 개선하고 있습니다.

---

# Roadmap

현재 코드 이후에는 다음과 같은 개선을 진행할 수 있습니다.

* 전체 MVP 통합 검증 및 안정화
* Quick Action 사용성 개선
* Custom Action 기능 확장
* Deck 관리 UX 개선
* Mac ↔ iPad 연결 안정성 향상
* PWA 설치 및 Local HTTPS 환경 개선
* 오류 처리 및 사용자 안내 개선

---

# Project Goal

CodePad의 목표는 새로운 IDE를 만드는 것이 아닙니다.

VS Code, Terminal, Git과 같은 기존 개발 도구는 그대로 사용하면서, 개발 과정에서 반복적으로 발생하는 보조 작업을 iPad로 분리하여 **코딩 흐름이 끊기는 시간을 줄이는 것**이 목표입니다.

```text
Mac
"코드 작성에 집중"

        +

iPad
"반복적인 개발 작업을 빠르게 처리"
```

> **CodePad — Your Mac development companion for iPad.**
