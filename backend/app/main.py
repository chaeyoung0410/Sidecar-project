from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.database import create_db_and_tables
from app.routers import actions, ai, commands, decks, errors, git, health, notion, project, websocket
from app.services import ActionService, DeckService, command_runner
from app.services.network_service import get_network_info


settings = get_settings()
logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    create_db_and_tables()
    ActionService.seed_defaults()
    DeckService.migrate_existing_actions()
    command_runner.recover_interrupted_runs()
    network = get_network_info()
    logger.info(
        "CodePad Agent started\n\n"
        "Hostname\n%s\n\n"
        "Recommended Address\nhttp://%s:%s\n\n"
        "Fallback Address\nhttp://%s:%s\n\n"
        "Port\n%s",
        network.hostname,
        network.local_hostname,
        settings.agent_port,
        network.ip,
        settings.agent_port,
        settings.agent_port,
    )
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
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(project.router)
app.include_router(git.router)
app.include_router(commands.router)
app.include_router(errors.router)
app.include_router(ai.router)
app.include_router(actions.router)
app.include_router(decks.router)
app.include_router(notion.router)
app.include_router(websocket.router)
