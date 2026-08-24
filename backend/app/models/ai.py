from datetime import UTC, datetime

from sqlalchemy import Column, JSON, Text
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(UTC)


class AIHistory(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    error_id: int = Field(foreign_key="errorhistory.id", index=True)
    provider: str = Field(max_length=40)
    model: str = Field(max_length=120)
    cause: str = Field(sa_column=Column(Text, nullable=False))
    explanation: str = Field(sa_column=Column(Text, nullable=False))
    solution_steps: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    code_fix: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    terminal_commands: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utc_now, index=True)


class AIJournalDraft(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    project_name: str = Field(max_length=120)
    provider: str = Field(max_length=40)
    model: str = Field(max_length=120)
    title: str = Field(max_length=200)
    content: str = Field(sa_column=Column(Text, nullable=False))
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    source_counts: dict[str, int] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utc_now, index=True)
