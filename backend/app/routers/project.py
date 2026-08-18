from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session

from app.database import get_session
from app.schemas import ProjectCreate, ProjectRead, ProjectUpdate
from app.services.project_service import (
    DuplicateProjectError,
    InvalidProjectPathError,
    ProjectNotFoundError,
    ProjectService,
)


router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectRead])
def list_projects(session: Session = Depends(get_session)) -> list[ProjectRead]:
    return ProjectService(session).list()


@router.get("/current", response_model=ProjectRead | None)
def get_current_project(session: Session = Depends(get_session)) -> ProjectRead | None:
    return ProjectService(session).current()


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, session: Session = Depends(get_session)) -> ProjectRead:
    try:
        return ProjectService(session).create(payload)
    except (InvalidProjectPathError, DuplicateProjectError, ValueError) as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.post("/{project_id}/select", response_model=ProjectRead)
def select_project(project_id: int, session: Session = Depends(get_session)) -> ProjectRead:
    try:
        return ProjectService(session).select(project_id)
    except ProjectNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    session: Session = Depends(get_session),
) -> ProjectRead:
    try:
        return ProjectService(session).update(project_id, payload)
    except ProjectNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, session: Session = Depends(get_session)) -> Response:
    try:
        ProjectService(session).delete(project_id)
    except ProjectNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
