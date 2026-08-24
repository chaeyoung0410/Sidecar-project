import re
from datetime import UTC, datetime

from sqlmodel import Session, select

from app.database.database import engine
from app.models import AIHistory, CommandHistory, ErrorHistory, Project
from app.schemas import ErrorHistoryUpdate
from app.services.connection_manager import connection_manager


PYTHON_LOCATION_PATTERN = re.compile(r'File ["\'](?P<file>.+?)["\'], line (?P<line>\d+)')
GENERIC_LOCATION_PATTERN = re.compile(
    r"(?P<file>(?:[A-Za-z]:)?[^\s:]+\.(?:py|ts|tsx|js|jsx|go|rs|java|kt|swift|c|cc|cpp|h|hpp)):(?P<line>\d+)"
)
ERROR_LINE_PATTERN = re.compile(
    r"(?:error|exception|traceback|failed|failure|fatal|panic|not found|permission denied)",
    re.IGNORECASE,
)
ERROR_PATTERNS = (
    re.compile(r"Traceback \(most recent call last\):", re.IGNORECASE),
    re.compile(r"\b[A-Za-z_]*(?:Error|Exception):"),
    re.compile(r"(?:^|\n)\s*(?:ERROR|FATAL|PANIC|FAILED)(?:\s|:|!)", re.IGNORECASE),
    re.compile(r"(?:\bPermission denied\b|\bUnhandledPromiseRejection\b|npm ERR!)", re.IGNORECASE),
    re.compile(r"\bthread\s+['\"].+['\"]\s+panicked at\b", re.IGNORECASE),
)
WARNING_PATTERNS = (
    re.compile(r"\b(?:DeprecationWarning|FutureWarning|UserWarning|RuntimeWarning|Warning):", re.IGNORECASE),
    re.compile(r"(?:^|\n)\s*WARN(?:ING)?(?:\s|:)", re.IGNORECASE),
)
MAX_STACK_TRACE_CHARS = 100_000


def should_capture_error(stderr: str, exit_code: int | None, status: str | None = None) -> bool:
    output = stderr.strip()
    if not output:
        return False
    if (exit_code is not None and exit_code != 0) or status == "failed":
        return True
    has_error_pattern = any(pattern.search(output) for pattern in ERROR_PATTERNS)
    warning_only = any(pattern.search(output) for pattern in WARNING_PATTERNS) and not has_error_pattern
    return has_error_pattern and not warning_only


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
        "resolved": error.resolved,
        "resolved_at": error.resolved_at.isoformat() if error.resolved_at else None,
        "user_note": error.user_note,
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

    def update(self, error_id: int, payload: ErrorHistoryUpdate) -> ErrorHistory | None:
        with Session(engine) as session:
            error = session.get(ErrorHistory, error_id)
            if not error:
                return None
            now = datetime.now(UTC)
            if "resolved" in payload.model_fields_set and payload.resolved is not None:
                error.resolved = payload.resolved
                error.resolved_at = now if payload.resolved else None
            if "user_note" in payload.model_fields_set:
                note = (payload.user_note or "").strip()
                error.user_note = note or None
            error.updated_at = now
            session.add(error)
            session.commit()
            session.refresh(error)
            session.expunge(error)
            return error

    def delete(self, error_id: int) -> bool:
        with Session(engine) as session:
            error = session.get(ErrorHistory, error_id)
            if not error:
                return False
            analyses = session.exec(select(AIHistory).where(AIHistory.error_id == error_id)).all()
            for analysis in analyses:
                session.delete(analysis)
            session.delete(error)
            session.commit()
            return True

    async def capture(self, run_id: int) -> ErrorHistory | None:
        with Session(engine) as session:
            run = session.get(CommandHistory, run_id)
            if not run or not should_capture_error(run.stderr, run.exit_code, run.status):
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
