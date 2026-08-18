from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.database import create_db_and_tables
from app.routers import actions, ai, commands, errors, git, health, notion, project, websocket
from app.services import ActionService, command_runner


settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    create_db_and_tables()
    ActionService.seed_defaults()
    command_runner.recover_interrupted_runs()
    try:
        yield
    finally:
        await command_runner.shutdown()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Local network agent for the CodePad iPad dashboard.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(project.router)
app.include_router(git.router)
app.include_router(commands.router)
app.include_router(errors.router)
app.include_router(ai.router)
app.include_router(actions.router)
app.include_router(notion.router)
app.include_router(websocket.router)
