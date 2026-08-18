from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session

from app.database import get_session
from app.schemas import (
    DashboardActionCreate,
    DashboardActionRead,
    DashboardActionReorder,
    DashboardActionUpdate,
)
from app.services import ActionService
from app.services.action_service import ActionNotFoundError, ActionValidationError


router = APIRouter(prefix="/api/actions", tags=["actions"])


@router.get("", response_model=list[DashboardActionRead])
def list_actions(session: Session = Depends(get_session)) -> list[DashboardActionRead]:
    return ActionService(session).list()


@router.post("", response_model=DashboardActionRead, status_code=status.HTTP_201_CREATED)
def create_action(
    payload: DashboardActionCreate,
    session: Session = Depends(get_session),
) -> DashboardActionRead:
    try:
        return ActionService(session).create(payload)
    except ActionValidationError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.put("/{action_id}", response_model=DashboardActionRead)
def update_action(
    action_id: int,
    payload: DashboardActionUpdate,
    session: Session = Depends(get_session),
) -> DashboardActionRead:
    try:
        return ActionService(session).update(action_id, payload)
    except ActionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ActionValidationError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.delete("/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_action(action_id: int, session: Session = Depends(get_session)) -> Response:
    try:
        ActionService(session).delete(action_id)
    except ActionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/reorder", response_model=list[DashboardActionRead])
def reorder_actions(
    payload: DashboardActionReorder,
    session: Session = Depends(get_session),
) -> list[DashboardActionRead]:
    try:
        return ActionService(session).reorder(payload.action_ids)
    except ActionValidationError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
