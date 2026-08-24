from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class SystemRecord(SQLModel, table=True):
    """Minimal persisted record proving the Phase 1 database is initialized."""

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
