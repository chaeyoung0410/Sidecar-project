from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class NotionStatusResponse(BaseModel):
    configured: bool
    connected: bool
    destination: str | None = None
    data_source_id: str | None = None
    message: str | None = None


class NotionLogCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=100_000)
    tags: list[str] = Field(default_factory=list, max_length=20)
    confirmed: Literal[True]

    @field_validator("title", "content")
    @classmethod
    def strip_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value.strip()

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, values: list[str]) -> list[str]:
        result: list[str] = []
        for value in values:
            tag = value.strip()[:100]
            if tag and tag not in result:
                result.append(tag)
        return result


class NotionLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    tags: list[str]
    notion_page_id: str
    notion_url: str
    project_id: int | None
    project_name: str | None
    created_at: datetime
