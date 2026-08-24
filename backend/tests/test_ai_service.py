import asyncio
import json
from pathlib import Path

import httpx
from sqlmodel import Session, select

from app.database.database import engine
from app.models import AIJournalDraft, CommandHistory, ErrorHistory, Project
from app.providers.ai_provider import AIProvider
from app.providers.gemini_provider import GeminiProvider
from app.schemas import AIAnalysisContent, AIJournalContent, CommitMessageSuggestions, DevelopmentJournalContext, ErrorAnalysisContext, GitDiffContext
from app.services.ai_service import AIService, collect_code_snippet


class FakeProvider(AIProvider):
    name = "fake"
    model = "fake-model"

    def __init__(self) -> None:
        self.context: ErrorAnalysisContext | None = None

    async def analyze_error(self, context: ErrorAnalysisContext) -> AIAnalysisContent:
        self.context = context
        return AIAnalysisContent(
            cause="Dependency is missing",
            explanation="필요한 패키지가 설치되지 않았습니다.",
            solution_steps=["의존성을 설치합니다.", "명령을 다시 실행합니다."],
            code_fix=None,
            terminal_commands=["python -m pip install example"],
        )

    async def generate_journal(self, context: DevelopmentJournalContext) -> AIJournalContent:
        return AIJournalContent(
            title=f"{context.project_name} 개발 기록",
            content="완료\n- Phase 10 구현\n\n발생한 오류\n- 기록 없음\n\n해결\n- 기록 없음\n\n다음 작업\n- 검토 후 Notion 저장",
            tags=["CodePad", "AI"],
        )

    async def suggest_commit_messages(self, context: GitDiffContext, language: str) -> CommitMessageSuggestions:
        return CommitMessageSuggestions(suggestions=[
            "Add error history management",
            "Improve error resolution workflow",
            "Support editable error notes",
        ])


def create_error(project_path: Path) -> int:
    with Session(engine) as session:
        project = Project(name="AI project", path=str(project_path), is_selected=True)
        session.add(project)
        session.commit()
        session.refresh(project)
        error = ErrorHistory(
            command_run_id=99,
            project_id=project.id,
            project_name=project.name,
            command="python app.py",
            error_message="NameError: name 'missing' is not defined",
            stack_trace='File "app.py", line 3\nNameError: name \'missing\' is not defined',
            file="app.py",
            line=3,
        )
        session.add(error)
        session.commit()
        session.refresh(error)
        return error.id


def test_ai_service_uses_minimal_context_and_saves_analysis(tmp_path: Path) -> None:
    (tmp_path / "app.py").write_text(
        "first = 1\nsecond = 2\nprint(missing)\nfourth = 4\n",
        encoding="utf-8",
    )
    error_id = create_error(tmp_path)
    provider = FakeProvider()
    service = AIService(provider)

    result = asyncio.run(service.analyze(error_id))

    assert provider.context is not None
    assert provider.context.programming_language == "Python"
    assert "3 | print(missing)" in (provider.context.code_snippet or "")
    assert result.provider == "fake"
    assert result.terminal_commands == ["python -m pip install example"]
    assert service.latest(error_id).id == result.id

    with Session(engine) as session:
        assert session.get(ErrorHistory, error_id).ai_analyzed is True


def test_code_context_never_reads_outside_project(tmp_path: Path) -> None:
    project = tmp_path / "project"
    project.mkdir()
    outside = tmp_path / "secret.py"
    outside.write_text("SECRET = 'do not send'\n", encoding="utf-8")

    assert collect_code_snippet(str(project), str(outside), 1) is None
    assert collect_code_snippet(str(project), "../secret.py", 1) is None


def test_gemini_provider_requests_structured_output() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["header"] = request.headers.get("x-goog-api-key")
        captured["body"] = json.loads(request.content)
        analysis = {
            "cause": "Missing import",
            "explanation": "가져오기가 누락되었습니다.",
            "solution_steps": ["import를 추가합니다."],
            "code_fix": "import example",
            "terminal_commands": [],
        }
        return httpx.Response(
            200,
            json={"candidates": [{"content": {"parts": [{"text": json.dumps(analysis)}]}}]},
        )

    async def run_provider() -> AIAnalysisContent:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            provider = GeminiProvider("secret-key", "gemini-test", client)
            return await provider.analyze_error(
                ErrorAnalysisContext(
                    error_id=1,
                    programming_language="Python",
                    framework="FastAPI",
                    error_message="ImportError",
                    stack_trace="ImportError",
                    file="app.py",
                    line=1,
                    code_snippet="1 | import example",
                    command="python app.py",
                    project_name="Test",
                )
            )

    result = asyncio.run(run_provider())

    assert captured["header"] == "secret-key"
    body = captured["body"]
    assert body["generationConfig"]["responseMimeType"] == "application/json"
    assert result.code_fix == "import example"


def test_journal_context_is_minimal_and_generated_draft_is_saved(tmp_path: Path) -> None:
    with Session(engine) as session:
        project = Project(name="Journal project", path=str(tmp_path), is_selected=True)
        session.add(project)
        session.commit()
        session.refresh(project)
        run = CommandHistory(
            project_id=project.id,
            name="Tests",
            command="pytest",
            working_directory=str(tmp_path),
            status="succeeded",
        )
        session.add(run)
        session.commit()
        session.refresh(run)
        session.add(ErrorHistory(
            command_run_id=run.id,
            project_id=project.id,
            project_name=project.name,
            command=run.command,
            error_message="One test failed",
            stack_trace="sensitive full output",
        ))
        session.commit()

    service = AIService(FakeProvider())
    context = service.journal_context()
    result = asyncio.run(service.generate_journal())

    assert context.commands[0].command == "pytest"
    assert context.errors[0].message == "One test failed"
    assert not hasattr(context.errors[0], "stack_trace")
    assert result.title == "Journal project 개발 기록"
    assert result.source_counts == {"commits": 0, "changed_files": 0, "commands": 1, "errors": 1}
    with Session(engine) as session:
        assert session.get(AIJournalDraft, result.id).content.startswith("완료")


def test_gemini_provider_generates_structured_journal() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        draft = {"title": "오늘의 CodePad", "content": "완료\n- Phase 10", "tags": ["CodePad"]}
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": json.dumps(draft)}]}}]})

    async def run_provider() -> AIJournalContent:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            provider = GeminiProvider("secret-key", "gemini-test", client)
            return await provider.generate_journal(DevelopmentJournalContext(
                project_id=1,
                project_name="CodePad",
                date="2026-08-18",
                branch="main",
                commits=[],
                changed_files=["app.py"],
                commands=[],
                errors=[],
            ))

    result = asyncio.run(run_provider())
    body = captured["body"]

    assert body["generationConfig"]["responseJsonSchema"]["required"] == ["title", "content", "tags"]
    assert result.title == "오늘의 CodePad"


def test_gemini_provider_generates_bounded_commit_message_suggestions() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        result = {"suggestions": [" Add error notes ", "Fix reconnect logic\nwithout noise", "Add error notes"]}
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": json.dumps(result)}]}}]})

    async def run_provider() -> CommitMessageSuggestions:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            provider = GeminiProvider("secret-key", "gemini-test", client)
            return await provider.suggest_commit_messages(GitDiffContext(
                branch="main",
                files=["app.py"],
                diff="+print('safe')",
                additions=1,
                deletions=0,
                truncated=False,
            ), "en")

    result = asyncio.run(run_provider())

    assert result.suggestions == ["Add error notes", "Fix reconnect logic without noise"]
    assert "untrusted data" in captured["body"]["system_instruction"]["parts"][0]["text"]


def test_ai_service_returns_commit_suggestions_without_saving_history() -> None:
    class FakeGitService:
        def diff_context(self, files: list[str]) -> GitDiffContext:
            return GitDiffContext(
                branch="main",
                files=files,
                diff="+resolved = True",
                additions=1,
                deletions=0,
                truncated=False,
            )

    result = asyncio.run(AIService(FakeProvider()).suggest_commit_messages(
        FakeGitService(), ["backend/app/models/error.py"], "en"
    ))

    assert len(result.suggestions) == 3
    assert result.model == "fake-model"
    assert result.files_analyzed == 1
    with Session(engine) as session:
        assert session.exec(select(AIJournalDraft)).all() == []
