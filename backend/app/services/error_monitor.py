import re
from datetime import UTC, datetime

from sqlmodel import Session, select

from app.database.database import engine
from app.models import CommandHistory, ErrorHistory, Project
from app.services.connection_manager import connection_manager


PYTHON_LOCATION_PATTERN = re.compile(r'File ["\'](?P<file>.+?)["\'], line (?P<line>\d+)')
GENERIC_LOCATION_PATTERN = re.compile(
    r"(?P<file>(?:[A-Za-z]:)?[^\s:]+\.(?:py|ts|tsx|js|jsx|go|rs|java|kt|swift|c|cc|cpp|h|hpp)):(?P<line>\d+)"
)
ERROR_LINE_PATTERN = re.compile(
    r"(?:error|exception|traceback|failed|failure|fatal|panic|not found|permission denied)",
    re.IGNORECASE,
)
MAX_STACK_TRACE_CHARS = 100_000


def parse_error_context(stack_trace: str) -> tuple[str, str | None, int | None]:
    lines = [line.strip() for line in stack_trace.splitlines() if line.strip()]
    matching_lines = [line for line in lines if ERROR_LINE_PATTERN.search(line)]
    error_message = (matching_lines[-1] if matching_lines else (lines[-1] if lines else "Unknown error"))[:2000]

    location_matches = list(PYTHON_LOCATION_PATTERN.finditer(stack_trace))
    if not location_matches:
        location_matches = list(GENERIC_LOCATION_PATTERN.finditer(stack_trace))
    if not location_matches:
        return error_message, None, None

    location = location_matches[-1]
    return error_message, location.group("file"), int(location.group("line"))


def error_event_payload(error: ErrorHistory) -> dict[str, object]:
    return {
        "id": error.id,
        "command_run_id": error.command_run_id,
        "project_id": error.project_id,
        "project_name": error.project_name,
        "command": error.command,
        "error_message": error.error_message,
        "stack_trace": error.stack_trace,
        "file": error.file,
        "line": error.line,
        "ai_analyzed": error.ai_analyzed,
        "created_at": error.created_at.isoformat(),
        "updated_at": error.updated_at.isoformat(),
    }


class ErrorMonitor:
    def list(self, limit: int = 50) -> list[ErrorHistory]:
        with Session(engine) as session:
            statement = select(ErrorHistory).order_by(ErrorHistory.updated_at.desc()).limit(limit)
            return list(session.exec(statement).all())

    def get(self, error_id: int) -> ErrorHistory | None:
        with Session(engine) as session:
            error = session.get(ErrorHistory, error_id)
            if error:
                session.expunge(error)
            return error

    async def capture(self, run_id: int) -> ErrorHistory | None:
        with Session(engine) as session:
            run = session.get(CommandHistory, run_id)
            if not run or not run.stderr.strip():
                return None
            project = session.get(Project, run.project_id)
            if not project or project.id is None:
                return None

            error = session.exec(
                select(ErrorHistory).where(ErrorHistory.command_run_id == run_id)
            ).first()
            is_new = error is None
            stack_trace = run.stderr[-MAX_STACK_TRACE_CHARS:]
            message, file, line = parse_error_context(stack_trace)
            now = datetime.now(UTC)

            if error is None:
                error = ErrorHistory(
                    command_run_id=run_id,
                    project_id=project.id,
                    project_name=project.name,
                    command=run.command,
                    error_message=message,
                    stack_trace=stack_trace,
                    file=file,
                    line=line,
                    created_at=now,
                    updated_at=now,
                )
            else:
                error.error_message = message
                error.stack_trace = stack_trace
                error.file = file
                error.line = line
                error.updated_at = now

            session.add(error)
            session.commit()
            session.refresh(error)
            session.expunge(error)

        await connection_manager.broadcast(
            {
                "type": "error.detected" if is_new else "error.updated",
                "timestamp": now.isoformat(),
                "data": error_event_payload(error),
            }
        )
        return error


error_monitor = ErrorMonitor()
