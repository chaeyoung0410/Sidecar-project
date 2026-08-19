from datetime import UTC, datetime, time, timedelta
from pathlib import Path

from sqlmodel import Session, select

from app.core.config import get_settings
from app.database.database import engine
from app.models import AIHistory, AIJournalDraft, CommandHistory, ErrorHistory, Project
from app.providers import AIProvider, GeminiProvider
from app.schemas import (
    AIAnalysisRead,
    CommitMessageSuggestionResponse,
    AIJournalRead,
    DevelopmentJournalContext,
    ErrorAnalysisContext,
    GitDiffContext,
    JournalCommand,
    JournalError,
)
from app.services.git_service import GitService, GitServiceError


MAX_SOURCE_FILE_BYTES = 1_000_000
MAX_CODE_SNIPPET_CHARS = 8_000
MAX_AI_STACK_TRACE_CHARS = 30_000
CONTEXT_LINES = 20

LANGUAGES = {
    ".py": "Python",
    ".ts": "TypeScript",
    ".tsx": "TypeScript / React",
    ".js": "JavaScript",
    ".jsx": "JavaScript / React",
    ".swift": "Swift",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".kt": "Kotlin",
    ".c": "C",
    ".cc": "C++",
    ".cpp": "C++",
}


class AIServiceError(RuntimeError):
    pass


class AIConfigurationError(AIServiceError):
    pass


class AIErrorNotFoundError(LookupError):
    pass


def collect_code_snippet(project_path: str, file_name: str | None, line: int | None) -> str | None:
    if not file_name:
        return None
    try:
        project_root = Path(project_path).resolve(strict=True)
        candidate = Path(file_name).expanduser()
        source_file = candidate.resolve(strict=True) if candidate.is_absolute() else (
            project_root / candidate
        ).resolve(strict=True)
        if not source_file.is_relative_to(project_root) or not source_file.is_file():
            return None
        if source_file.stat().st_size > MAX_SOURCE_FILE_BYTES:
            return None
        lines = source_file.read_text(encoding="utf-8", errors="replace").splitlines()
    except (OSError, RuntimeError):
        return None

    target_line = line if line and line > 0 else 1
    start = max(1, target_line - CONTEXT_LINES)
    end = min(len(lines), target_line + CONTEXT_LINES)
    numbered_lines = [f"{number:>5} | {lines[number - 1]}" for number in range(start, end + 1)]
    return "\n".join(numbered_lines)[:MAX_CODE_SNIPPET_CHARS] or None


def infer_language(file_name: str | None, command: str) -> str:
    if file_name:
        language = LANGUAGES.get(Path(file_name).suffix.lower())
        if language:
            return language
    lowered = command.lower()
    if any(token in lowered for token in ("python", "pytest", "uvicorn")):
        return "Python"
    if any(token in lowered for token in ("npm", "node", "vite")):
        return "JavaScript / TypeScript"
    return "Unknown"


def infer_framework(project_path: str, command: str) -> str | None:
    lowered = command.lower()
    if "uvicorn" in lowered or "fastapi" in lowered:
        return "FastAPI"
    if "pytest" in lowered:
        return "pytest"
    if "vite" in lowered:
        return "Vite"
    try:
        root = Path(project_path)
        if (root / "vite.config.ts").exists() or (root / "vite.config.js").exists():
            return "Vite"
        if (root / "pyproject.toml").exists() or (root / "requirements.txt").exists():
            return "Python"
    except OSError:
        return None
    return None


class AIService:
    def __init__(self, provider: AIProvider | None = None) -> None:
        self.provider = provider

    def status(self) -> tuple[bool, str]:
        settings = get_settings()
        return bool(settings.gemini_api_key.strip()), settings.gemini_model

    def context(self, error_id: int) -> ErrorAnalysisContext:
        with Session(engine) as session:
            error = session.get(ErrorHistory, error_id)
            if not error:
                raise AIErrorNotFoundError("Error not found")
            project = session.get(Project, error.project_id)
            if not project:
                raise AIServiceError("Project for this error no longer exists")

            return ErrorAnalysisContext(
                error_id=error.id,
                programming_language=infer_language(error.file, error.command),
                framework=infer_framework(project.path, error.command),
                error_message=error.error_message,
                stack_trace=error.stack_trace[-MAX_AI_STACK_TRACE_CHARS:],
                file=error.file,
                line=error.line,
                code_snippet=collect_code_snippet(project.path, error.file, error.line),
                command=error.command,
                project_name=error.project_name,
            )

    async def analyze(self, error_id: int) -> AIAnalysisRead:
        context = self.context(error_id)
        provider = self.provider or self._configured_provider()
        content = await provider.analyze_error(context)

        with Session(engine) as session:
            error = session.get(ErrorHistory, error_id)
            if not error:
                raise AIErrorNotFoundError("Error not found")
            history = AIHistory(
                error_id=error_id,
                provider=provider.name,
                model=provider.model,
                cause=content.cause,
                explanation=content.explanation,
                solution_steps=content.solution_steps,
                code_fix=content.code_fix,
                terminal_commands=content.terminal_commands,
            )
            error.ai_analyzed = True
            session.add(history)
            session.add(error)
            session.commit()
            session.refresh(history)
            return AIAnalysisRead.model_validate(history)

    def latest(self, error_id: int) -> AIAnalysisRead | None:
        with Session(engine) as session:
            error_exists = session.get(ErrorHistory, error_id)
            if not error_exists:
                raise AIErrorNotFoundError("Error not found")
            statement = (
                select(AIHistory)
                .where(AIHistory.error_id == error_id)
                .order_by(AIHistory.created_at.desc())
            )
            history = session.exec(statement).first()
            return AIAnalysisRead.model_validate(history) if history else None

    def journal_context(self) -> DevelopmentJournalContext:
        local_now = datetime.now().astimezone()
        local_start = datetime.combine(local_now.date(), time.min, tzinfo=local_now.tzinfo)
        start_utc = local_start.astimezone(UTC)
        end_utc = (local_start + timedelta(days=1)).astimezone(UTC)

        with Session(engine) as session:
            project = session.exec(select(Project).where(Project.is_selected)).first()
            if not project or project.id is None:
                raise AIServiceError("Select a project before generating a development journal")

            command_statement = (
                select(CommandHistory)
                .where(CommandHistory.project_id == project.id)
                .where(CommandHistory.started_at >= start_utc)
                .where(CommandHistory.started_at < end_utc)
                .order_by(CommandHistory.started_at.desc())
                .limit(30)
            )
            commands = [
                JournalCommand(name=run.name, command=run.command, status=run.status)
                for run in session.exec(command_statement).all()
            ]

            error_statement = (
                select(ErrorHistory)
                .where(ErrorHistory.project_id == project.id)
                .where(ErrorHistory.created_at >= start_utc)
                .where(ErrorHistory.created_at < end_utc)
                .order_by(ErrorHistory.created_at.desc())
                .limit(20)
            )
            errors: list[JournalError] = []
            for error in session.exec(error_statement).all():
                analysis = session.exec(
                    select(AIHistory)
                    .where(AIHistory.error_id == error.id)
                    .order_by(AIHistory.created_at.desc())
                ).first() if error.ai_analyzed else None
                resolution = None
                if analysis:
                    steps = "; ".join(analysis.solution_steps[:3])
                    resolution = f"{analysis.cause}. {steps}".strip()
                errors.append(JournalError(
                    message=error.error_message[:2_000],
                    file=error.file,
                    line=error.line,
                    ai_analyzed=error.ai_analyzed,
                    ai_resolution=resolution,
                ))

            git_service = GitService(project.id, project.name, project.path)
            branch: str | None = None
            changed_files: list[str] = []
            commits = []
            try:
                git_status = git_service.status()
                branch = git_status.branch
                changed_files = [file.path for file in git_status.changed_files[:100]]
                commits = git_service.recent_commits(start_utc, end_utc)
            except GitServiceError:
                pass

            return DevelopmentJournalContext(
                project_id=project.id,
                project_name=project.name,
                date=local_now.date().isoformat(),
                branch=branch,
                commits=commits,
                changed_files=changed_files,
                commands=commands,
                errors=errors,
            )

    async def generate_journal(self) -> AIJournalRead:
        context = self.journal_context()
        provider = self.provider or self._configured_provider()
        content = await provider.generate_journal(context)
        counts = {
            "commits": len(context.commits),
            "changed_files": len(context.changed_files),
            "commands": len(context.commands),
            "errors": len(context.errors),
        }
        with Session(engine) as session:
            draft = AIJournalDraft(
                project_id=context.project_id,
                project_name=context.project_name,
                provider=provider.name,
                model=provider.model,
                title=content.title,
                content=content.content,
                tags=content.tags,
                source_counts=counts,
            )
            session.add(draft)
            session.commit()
            session.refresh(draft)
            return AIJournalRead.model_validate(draft)

    async def suggest_commit_messages(
        self,
        git_service: GitService,
        files: list[str],
        language: str = "en",
    ) -> CommitMessageSuggestionResponse:
        context: GitDiffContext = git_service.diff_context(files)
        provider = self.provider or self._configured_provider()
        content = await provider.suggest_commit_messages(context, language)
        return CommitMessageSuggestionResponse(
            suggestions=content.suggestions,
            model=provider.model,
            files_analyzed=len(context.files),
            diff_characters=len(context.diff),
            truncated=context.truncated,
        )

    @staticmethod
    def _configured_provider() -> GeminiProvider:
        settings = get_settings()
        if not settings.gemini_api_key.strip():
            raise AIConfigurationError("GEMINI_API_KEY is not configured on the Mac Agent")
        return GeminiProvider(settings.gemini_api_key, settings.gemini_model)
