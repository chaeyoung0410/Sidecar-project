from dataclasses import dataclass
from typing import Any

import httpx


class NotionProviderError(RuntimeError):
    pass


@dataclass(frozen=True)
class NotionDestination:
    data_source_id: str
    name: str
    title_property: str
    tags_property: str | None


class NotionProvider:
    def __init__(
        self,
        api_key: str,
        *,
        database_id: str = "",
        data_source_id: str = "",
        notion_version: str = "2026-03-11",
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.database_id = database_id.strip()
        self.data_source_id = data_source_id.strip()
        self.client = httpx.AsyncClient(
            base_url="https://api.notion.com/v1",
            headers={
                "Authorization": f"Bearer {api_key.strip()}",
                "Notion-Version": notion_version,
                "Content-Type": "application/json",
            },
            timeout=20,
            transport=transport,
        )

    async def close(self) -> None:
        await self.client.aclose()

    async def destination(self) -> NotionDestination:
        data_source_id = self.data_source_id
        if not data_source_id:
            if not self.database_id:
                raise NotionProviderError("NOTION_DATA_SOURCE_ID or NOTION_DATABASE_ID is required")
            database = await self._request("GET", f"/databases/{self.database_id}")
            sources = database.get("data_sources", [])
            if len(sources) != 1:
                raise NotionProviderError(
                    "The configured database must contain exactly one data source; set NOTION_DATA_SOURCE_ID explicitly"
                )
            data_source_id = sources[0].get("id", "")

        source = await self._request("GET", f"/data_sources/{data_source_id}")
        properties = source.get("properties", {})
        title_property = next(
            (name for name, definition in properties.items() if definition.get("type") == "title"),
            None,
        )
        if not title_property:
            raise NotionProviderError("The Notion data source has no title property")
        tags_property = next(
            (name for name, definition in properties.items() if definition.get("type") == "multi_select" and name.lower() in {"tag", "tags"}),
            None,
        ) or next(
            (name for name, definition in properties.items() if definition.get("type") == "multi_select"),
            None,
        )
        return NotionDestination(
            data_source_id=data_source_id,
            name=source.get("name") or self._plain_text(source.get("title", [])) or "Notion development log",
            title_property=title_property,
            tags_property=tags_property,
        )

    async def create_page(self, title: str, content: str, tags: list[str]) -> tuple[dict[str, Any], NotionDestination]:
        destination = await self.destination()
        properties: dict[str, Any] = {
            destination.title_property: {
                "title": [{"type": "text", "text": {"content": title}}],
            }
        }
        if destination.tags_property and tags:
            properties[destination.tags_property] = {
                "multi_select": [{"name": tag} for tag in tags],
            }

        body = content
        if tags and not destination.tags_property:
            body = f"Tags: {', '.join(tags)}\n\n{content}"
        payload = {
            "parent": {"type": "data_source_id", "data_source_id": destination.data_source_id},
            "properties": properties,
            "children": self._paragraph_blocks(body),
        }
        return await self._request("POST", "/pages", json=payload), destination

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        try:
            response = await self.client.request(method, path, **kwargs)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as error:
            try:
                message = error.response.json().get("message")
            except (ValueError, AttributeError):
                message = None
            raise NotionProviderError(message or f"Notion API returned {error.response.status_code}") from error
        except (httpx.HTTPError, ValueError) as error:
            raise NotionProviderError("Could not connect to the Notion API") from error

    @staticmethod
    def _plain_text(items: list[dict[str, Any]]) -> str:
        if not isinstance(items, list):
            return ""
        return "".join(item.get("plain_text", "") for item in items)

    @staticmethod
    def _paragraph_blocks(content: str) -> list[dict[str, Any]]:
        # Notion limits rich text content to 2,000 characters and page creation
        # to 100 child blocks. The API schema caps journal content at 100k, so
        # 1,900-character blocks remain comfortably within both constraints.
        chunks = [content[index:index + 1900] for index in range(0, len(content), 1900)] or [""]
        return [
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {"rich_text": [] if chunk == "" else [{"type": "text", "text": {"content": chunk}}]},
            }
            for chunk in chunks
        ]
