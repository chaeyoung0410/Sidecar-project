from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ErrorAnalysisContext(BaseModel):
    error_id: int
    programming_language: str
    framework: str | None
    error_message: str
    stack_trace: str
    file: str | None
    line: int | None
    code_snippet: str | None
    command: str
    project_name: str


class AIAnalysisContent(BaseModel):
    cause: str
    explanation: str
    solution_steps: list[str]
    code_fix: str | None
    terminal_commands: list[str]


class AIAnalyzeRequest(BaseModel):
    confirmed: Literal[True]


class AIAnalysisRead(AIAnalysisContent):
    model_config = ConfigDict(from_attributes=True)

    id: int
    error_id: int
    provider: str
    model: str
    created_at: datetime


class AIStatusResponse(BaseModel):
    provider: Literal["gemini"] = "gemini"
    configured: bool
    model: str


class JournalCommit(BaseModel):
    commit: str
    message: str
    files: list[str]


class JournalCommand(BaseModel):
    name: str
    command: str
    status: str


class JournalError(BaseModel):
    message: str
    file: str | None
    line: int | None
    ai_analyzed: bool
    ai_resolution: str | None = None


class DevelopmentJournalContext(BaseModel):
    project_id: int
    project_name: str
    date: str
    branch: str | None
    commits: list[JournalCommit]
    changed_files: list[str]
    commands: list[JournalCommand]
    errors: list[JournalError]


class AIJournalContent(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=100_000)
    tags: list[str] = Field(default_factory=list, max_length=20)


class AIJournalGenerateRequest(BaseModel):
    confirmed: Literal[True]


class AIJournalRead(AIJournalContent):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    project_name: str
    provider: str
    model: str
    source_counts: dict[str, int]
    created_at: datetime
