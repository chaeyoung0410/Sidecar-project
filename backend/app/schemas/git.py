from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ChangedFile(BaseModel):
    path: str
    status: str
    staged: bool
    unstaged: bool
    original_path: str | None = None


class GitStatusResponse(BaseModel):
    project_id: int
    repository: str
    branch: str
    changed_files: list[ChangedFile]


class GitCommitRequest(BaseModel):
    files: list[str] = Field(min_length=1)
    message: str = Field(min_length=1, max_length=500)
    confirmed: Literal[True]


class GitCommitResponse(BaseModel):
    commit: str
    branch: str
    message: str
    files: list[str]


class CommitMessageSuggestionRequest(BaseModel):
    files: list[str] = Field(min_length=1, max_length=20)
    language: Literal["en", "ko"] = "en"


class GitDiffContext(BaseModel):
    branch: str
    files: list[str]
    diff: str
    additions: int
    deletions: int
    truncated: bool


class CommitMessageSuggestions(BaseModel):
    suggestions: list[str] = Field(min_length=1, max_length=3)


class CommitMessageSuggestionResponse(CommitMessageSuggestions):
    model: str
    files_analyzed: int
    diff_characters: int
    truncated: bool


class GitPushRequest(BaseModel):
    confirmed: Literal[True]


class GitRemoteStatus(BaseModel):
    repository: str
    branch: str
    remote: Literal["origin"] = "origin"
    ahead: int
    behind: int
    diverged: bool
    up_to_date: bool
    upstream_exists: bool
    last_fetched_at: datetime


class GitPushPreview(BaseModel):
    repository: str
    branch: str
    remote: Literal["origin"] = "origin"
    ahead: int
    behind: int
    diverged: bool
    up_to_date: bool
    upstream_exists: bool
    last_fetched_at: datetime


class GitPushResponse(BaseModel):
    repository: str
    branch: str
    remote: Literal["origin"] = "origin"
    pushed: bool
    message: str


class GitPullRequest(BaseModel):
    confirmed: Literal[True]


class GitPullPreview(BaseModel):
    repository: str
    branch: str
    remote: Literal["origin"] = "origin"
    changed_files: list[ChangedFile]
    conflict_files: list[str]
    ahead: int
    behind: int
    diverged: bool
    up_to_date: bool
    upstream_exists: bool
    last_fetched_at: datetime


class GitPullResponse(BaseModel):
    success: bool
    repository: str
    branch: str
    remote: Literal["origin"] = "origin"
    message: str
    stdout: str
    stderr: str
    conflict: bool
    conflict_files: list[str]
    already_up_to_date: bool
    fast_forward: bool
    diverged: bool
    commits: int = 0
    files_changed: int = 0
    insertions: int = 0
    deletions: int = 0
