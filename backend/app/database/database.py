from collections.abc import Generator

from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings


settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine_kwargs = {"connect_args": connect_args}
if settings.database_url in {"sqlite://", "sqlite:///:memory:"}:
    engine_kwargs["poolclass"] = StaticPool
engine = create_engine(settings.database_url, **engine_kwargs)


def create_db_and_tables() -> None:
    """Create the small MVP schema on application startup."""
    # Importing models registers their SQLModel metadata before create_all.
    from app.models import AIHistory, AIJournalDraft, CommandHistory, DashboardAction, DashboardState, ErrorHistory, NotionLog, Project, SavedCommand, SystemRecord  # noqa: F401

    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
