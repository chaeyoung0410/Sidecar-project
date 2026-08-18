import os

import pytest
from sqlmodel import SQLModel

os.environ["DATABASE_URL"] = "sqlite://"


@pytest.fixture(autouse=True)
def reset_database():
    from app.database.database import engine
    from app.models import AIHistory, AIJournalDraft, CommandHistory, DashboardAction, DashboardState, ErrorHistory, NotionLog, Project, SavedCommand, SystemRecord  # noqa: F401

    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    yield
    SQLModel.metadata.drop_all(engine)
