import asyncio
import json

import httpx
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.database.database import engine
from app.main import app
from app.models import Project
from app.providers.notion_provider import NotionDestination, NotionProvider
from app.schemas import NotionLogCreate
from app.services.notion_service import NotionService


def test_provider_resolves_database_and_creates_page_with_discovered_properties() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path == "/v1/databases/database-1":
            return httpx.Response(200, json={"data_sources": [{"id": "source-1"}]})
        if request.url.path == "/v1/data_sources/source-1":
            return httpx.Response(200, json={
                "title": [{"plain_text": "Engineering journal"}],
                "properties": {
                    "Name": {"type": "title"},
                    "Labels": {"type": "multi_select"},
                },
            })
        if request.url.path == "/v1/pages":
            return httpx.Response(200, json={"id": "page-1", "url": "https://notion.so/page-1"})
        return httpx.Response(404)

    async def run() -> tuple[dict, NotionDestination]:
        provider = NotionProvider(
            "secret-token",
            database_id="database-1",
            transport=httpx.MockTransport(handler),
        )
        try:
            return await provider.create_page("Phase 9", "Implemented Notion", ["CodePad", "API"])
        finally:
            await provider.close()

    page, destination = asyncio.run(run())
    create_request = requests[-1]
    body = json.loads(create_request.content)

    assert page["id"] == "page-1"
    assert destination.name == "Engineering journal"
    assert body["parent"] == {"type": "data_source_id", "data_source_id": "source-1"}
    assert body["properties"]["Name"]["title"][0]["text"]["content"] == "Phase 9"
    assert body["properties"]["Labels"]["multi_select"] == [{"name": "CodePad"}, {"name": "API"}]
    assert create_request.headers["authorization"] == "Bearer secret-token"
    assert create_request.headers["notion-version"] == "2026-03-11"


class FakeNotionProvider:
    async def create_page(self, title: str, content: str, tags: list[str]):
        assert (title, content, tags) == ("Daily log", "Built Phase 9", ["CodePad"])
        return (
            {"id": "saved-page", "url": "https://notion.so/saved-page"},
            NotionDestination("source-1", "Journal", "Name", "Tags"),
        )


def test_service_saves_confirmed_page_in_local_history() -> None:
    with Session(engine) as session:
        session.add(Project(name="CodePad", path="/tmp/codepad", is_selected=True))
        session.commit()

    result = asyncio.run(NotionService(FakeNotionProvider()).create(NotionLogCreate(
        title="Daily log",
        content="Built Phase 9",
        tags=["CodePad"],
        confirmed=True,
    )))

    assert result.notion_page_id == "saved-page"
    assert result.project_name == "CodePad"
    assert NotionService().recent()[0].title == "Daily log"


def test_api_rejects_unconfirmed_notion_write() -> None:
    with TestClient(app) as client:
        response = client.post("/api/notion/logs", json={
            "title": "No confirmation",
            "content": "Must not be sent",
            "tags": [],
            "confirmed": False,
        })

    assert response.status_code == 422
