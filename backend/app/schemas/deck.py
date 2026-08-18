from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.action import DashboardActionRead


class DeckCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    icon: str = Field(default="grid", min_length=1, max_length=40)


class DeckUpdate(DeckCreate):
    pass


class DeckRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    name: str
    description: str
    icon: str
    position: int
    actions: list[DashboardActionRead]
    created_at: datetime
    updated_at: datetime


class DeckReorder(BaseModel):
    deck_ids: list[int] = Field(min_length=1)


class DeckActionAdd(BaseModel):
    action_id: int = Field(gt=0)


class DeckActionOrder(BaseModel):
    action_ids: list[int] = Field(min_length=1)
