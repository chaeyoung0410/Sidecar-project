from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SavedCommandCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    command: str = Field(min_length=1, max_length=2000)
    working_directory: str = Field(default=".", min_length=1, max_length=2048)


class SavedCommandUpdate(SavedCommandCreate):
    pass


class SavedCommandRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    command: str
    working_directory: str
    created_at: datetime
    updated_at: datetime


class CommandRunRequest(BaseModel):
    confirmed: Literal[True]


class CommandStopRequest(BaseModel):
    confirmed: Literal[True]


class CommandRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    command_id: int | None
    project_id: int
    name: str
    command: str
    working_directory: str
    status: Literal["queued", "running", "succeeded", "failed", "stopped"]
    pid: int | None
    exit_code: int | None
    stdout: str
    stderr: str
    started_at: datetime
    finished_at: datetime | None
