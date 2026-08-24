from datetime import UTC, datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(UTC)


class Deck(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    name: str = Field(max_length=120)
    description: str = Field(default="", max_length=500)
    icon: str = Field(default="grid", max_length=40)
    position: int = Field(default=0, index=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class DeckAction(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("deck_id", "action_id"),)

    id: int | None = Field(default=None, primary_key=True)
    deck_id: int = Field(foreign_key="deck.id", index=True)
    action_id: int = Field(foreign_key="dashboardaction.id", index=True)
    position: int = Field(default=0, index=True)


class DeckState(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)
    migrated_at: datetime = Field(default_factory=utc_now)
