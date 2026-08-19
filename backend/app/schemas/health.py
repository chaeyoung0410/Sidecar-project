from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str


class AgentInfoResponse(BaseModel):
    name: str
    hostname: str
    local_hostname: str
    ip: str
    port: int
    status: Literal["running"]
