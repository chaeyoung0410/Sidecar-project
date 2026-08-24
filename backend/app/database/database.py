from collections.abc import Generator

from sqlalchemy import inspect, text
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
    from app.models import AIHistory, AIJournalDraft, CommandHistory, DashboardAction, DashboardState, Deck, DeckAction, DeckState, ErrorHistory, NotionLog, Project, SavedCommand, SystemRecord  # noqa: F401

    SQLModel.metadata.create_all(engine)
    _migrate_sqlite_schema()


def _migrate_sqlite_schema() -> None:
    """Add small nullable/defaulted columns without replacing a user's SQLite DB."""
    if engine.dialect.name != "sqlite":
        return
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    migrations = {
        "errorhistory": {
            "resolved": "ALTER TABLE errorhistory ADD COLUMN resolved BOOLEAN NOT NULL DEFAULT 0",
            "resolved_at": "ALTER TABLE errorhistory ADD COLUMN resolved_at DATETIME",
            "user_note": "ALTER TABLE errorhistory ADD COLUMN user_note TEXT",
        },
        "dashboardaction": {
            "is_builtin": "ALTER TABLE dashboardaction ADD COLUMN is_builtin BOOLEAN NOT NULL DEFAULT 0",
        },
    }
    with engine.begin() as connection:
        for table, columns in migrations.items():
            if table not in table_names:
                continue
            existing = {column["name"] for column in inspect(engine).get_columns(table)}
            for column, statement in columns.items():
                if column not in existing:
                    connection.execute(text(statement))

        if "dashboardaction" in table_names:
            connection.execute(text(
                "UPDATE dashboardaction SET is_builtin = 1 "
                "WHERE (name = 'AI Error' AND type = 'ai_error') "
                "OR (name = 'Git Commit' AND type = 'git_commit') "
                "OR (name = 'Git Push' AND type = 'git_push') "
                "OR (name = 'Git Pull' AND type = 'git_pull') "
                "OR (name = 'Notion' AND type = 'notion') "
                "OR (name = 'Command Runner' AND type = 'command')"
            ))


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
