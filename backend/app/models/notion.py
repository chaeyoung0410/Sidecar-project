from datetime import UTC, datetime

from sqlalchemy import Column, JSON, Text
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(UTC)


class NotionLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str = Field(max_length=200)
    content: str = Field(sa_column=Column(Text, nullable=False))
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    notion_page_id: str = Field(index=True, unique=True, max_length=80)
    notion_url: str = Field(max_length=500)
    data_source_id: str = Field(max_length=80)
    project_id: int | None = Field(default=None, foreign_key="project.id", index=True)
    project_name: str | None = Field(default=None, max_length=120)
    created_at: datetime = Field(default_factory=utc_now, index=True)
