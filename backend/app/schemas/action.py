from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


ActionType = Literal["ai_error", "git_commit", "git_push", "git_pull", "notion", "command"]
ActionIcon = Literal["spark", "commit", "push", "pull", "notion", "terminal", "play", "bug", "server"]


class DashboardActionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: ActionType
    icon: ActionIcon = "terminal"
    config: dict[str, object] = Field(default_factory=dict)


class DashboardActionUpdate(DashboardActionCreate):
    pass


class DashboardActionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: ActionType
    icon: ActionIcon
    position: int
    config: dict[str, object]
    is_builtin: bool
    created_at: datetime
    updated_at: datetime


class DashboardActionReorder(BaseModel):
    action_ids: list[int] = Field(min_length=1)
