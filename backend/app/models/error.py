from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(UTC)


class ErrorHistory(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    command_run_id: int = Field(foreign_key="commandhistory.id", index=True, unique=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    project_name: str = Field(max_length=120)
    command: str = Field(max_length=2000)
    error_message: str = Field(max_length=2000)
    stack_trace: str = ""
    file: str | None = Field(default=None, max_length=2048)
    line: int | None = None
    ai_analyzed: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=utc_now, index=True)
    updated_at: datetime = Field(default_factory=utc_now)
