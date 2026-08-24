from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


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
    resolved: bool
    resolved_at: datetime | None
    user_note: str | None
    created_at: datetime
    updated_at: datetime


class ErrorHistoryUpdate(BaseModel):
    resolved: bool | None = None
    user_note: str | None = Field(default=None, max_length=20_000)

    @model_validator(mode="after")
    def require_change(self) -> "ErrorHistoryUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one editable field is required")
        if "resolved" in self.model_fields_set and self.resolved is None:
            raise ValueError("resolved must be true or false")
        return self
