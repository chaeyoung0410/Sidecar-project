from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.database import get_session
from app.schemas import (
    GitCommitRequest,
    GitCommitResponse,
    CommitMessageSuggestionRequest,
    CommitMessageSuggestionResponse,
    GitPullPreview,
    GitPullRequest,
    GitPullResponse,
    GitPushPreview,
    GitPushRequest,
    GitPushResponse,
    GitStatusResponse,
)
from app.providers.gemini_provider import AIProviderError
from app.services import AIService, GitService, ProjectService
from app.services.ai_service import AIConfigurationError, AIServiceError
from app.services.git_service import GitServiceError, NotGitRepositoryError


router = APIRouter(prefix="/api/git", tags=["git"])


def selected_git_service(session: Session) -> GitService:
    project = ProjectService(session).current()
    if not project or project.id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No project selected")
    return GitService(project.id, project.name, project.path)


@router.get("/status", response_model=GitStatusResponse)
def get_git_status(session: Session = Depends(get_session)) -> GitStatusResponse:
    try:
        return selected_git_service(session).status()
    except NotGitRepositoryError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except GitServiceError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error


@router.post("/commit", response_model=GitCommitResponse)
def commit_changes(
    payload: GitCommitRequest,
    session: Session = Depends(get_session),
) -> GitCommitResponse:
    try:
        return selected_git_service(session).commit(payload.files, payload.message)
    except (NotGitRepositoryError, GitServiceError) as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.post("/commit-message/suggest", response_model=CommitMessageSuggestionResponse)
async def suggest_commit_message(
    payload: CommitMessageSuggestionRequest,
    session: Session = Depends(get_session),
) -> CommitMessageSuggestionResponse:
    try:
        return await AIService().suggest_commit_messages(
            selected_git_service(session), payload.files, payload.language
        )
    except AIConfigurationError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except (NotGitRepositoryError, GitServiceError) as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except (AIServiceError, AIProviderError) as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error


@router.get("/push-preview", response_model=GitPushPreview)
def get_push_preview(session: Session = Depends(get_session)) -> GitPushPreview:
    try:
        return selected_git_service(session).push_preview()
    except (NotGitRepositoryError, GitServiceError) as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.post("/push", response_model=GitPushResponse)
def push_current_branch(
    _: GitPushRequest,
    session: Session = Depends(get_session),
) -> GitPushResponse:
    try:
        return selected_git_service(session).push()
    except (NotGitRepositoryError, GitServiceError) as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.get("/pull-preview", response_model=GitPullPreview)
def get_pull_preview(session: Session = Depends(get_session)) -> GitPullPreview:
    try:
        return selected_git_service(session).pull_preview()
    except (NotGitRepositoryError, GitServiceError) as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.post("/pull", response_model=GitPullResponse)
def pull_current_branch(
    _: GitPullRequest,
    session: Session = Depends(get_session),
) -> GitPullResponse:
    try:
        return selected_git_service(session).pull()
    except (NotGitRepositoryError, GitServiceError) as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
