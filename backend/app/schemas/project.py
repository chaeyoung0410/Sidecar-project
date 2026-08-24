from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    path: str = Field(min_length=1, max_length=2048)


class ProjectUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    path: str
    is_selected: bool
    created_at: datetime
    last_used_at: datetime
