from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ErrorHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    command_run_id: int
    project_id: int
    project_name: str
    command: str
    error_message: str
    stack_trace: str
    file: str | None
    line: int | None
    ai_analyzed: bool
    created_at: datetime
    updated_at: datetime
