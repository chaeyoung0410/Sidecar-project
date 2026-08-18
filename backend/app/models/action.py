from datetime import UTC, datetime

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(UTC)


class DashboardAction(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=120)
    type: str = Field(index=True, max_length=40)
    icon: str = Field(default="terminal", max_length=40)
    position: int = Field(default=0, index=True)
    config: dict[str, object] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class DashboardState(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)
    initialized_at: datetime = Field(default_factory=utc_now)
