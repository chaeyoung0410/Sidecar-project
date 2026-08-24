from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(UTC)


class SavedCommand(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, max_length=120)
    command: str = Field(max_length=2000)
    working_directory: str = Field(default=".", max_length=2048)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class CommandHistory(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    command_id: int | None = Field(default=None, foreign_key="savedcommand.id", index=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    name: str = Field(max_length=120)
    command: str = Field(max_length=2000)
    working_directory: str = Field(max_length=2048)
    status: str = Field(default="queued", index=True, max_length=20)
    pid: int | None = None
    exit_code: int | None = None
    stdout: str = ""
    stderr: str = ""
    started_at: datetime = Field(default_factory=utc_now)
    finished_at: datetime | None = None
