from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session

from app.database import get_session
from app.schemas import (
    DeckActionAdd,
    DeckActionOrder,
    DeckCreate,
    DeckRead,
    DeckReorder,
    DeckUpdate,
)
from app.services import DeckService
from app.services.deck_service import DeckNotFoundError, DeckValidationError


router = APIRouter(prefix="/api/decks", tags=["decks"])


def handle_error(error: Exception) -> HTTPException:
    if isinstance(error, DeckNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))


@router.get("", response_model=list[DeckRead])
def list_decks(session: Session = Depends(get_session)) -> list[DeckRead]:
    try:
        return DeckService(session).list()
    except DeckValidationError as error:
        raise handle_error(error) from error


@router.post("", response_model=DeckRead, status_code=status.HTTP_201_CREATED)
def create_deck(payload: DeckCreate, session: Session = Depends(get_session)) -> DeckRead:
    try:
        return DeckService(session).create(payload)
    except DeckValidationError as error:
        raise handle_error(error) from error


@router.post("/reorder", response_model=list[DeckRead])
def reorder_decks(payload: DeckReorder, session: Session = Depends(get_session)) -> list[DeckRead]:
    try:
        return DeckService(session).reorder(payload.deck_ids)
    except DeckValidationError as error:
        raise handle_error(error) from error


@router.get("/{deck_id}", response_model=DeckRead)
def get_deck(deck_id: int, session: Session = Depends(get_session)) -> DeckRead:
    try:
        return DeckService(session).get(deck_id)
    except (DeckNotFoundError, DeckValidationError) as error:
        raise handle_error(error) from error


@router.patch("/{deck_id}", response_model=DeckRead)
def update_deck(deck_id: int, payload: DeckUpdate, session: Session = Depends(get_session)) -> DeckRead:
    try:
        return DeckService(session).update(deck_id, payload)
    except (DeckNotFoundError, DeckValidationError) as error:
        raise handle_error(error) from error


@router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deck(deck_id: int, session: Session = Depends(get_session)) -> Response:
    try:
        DeckService(session).delete(deck_id)
    except (DeckNotFoundError, DeckValidationError) as error:
        raise handle_error(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{deck_id}/actions", response_model=DeckRead)
def add_deck_action(
    deck_id: int,
    payload: DeckActionAdd,
    session: Session = Depends(get_session),
) -> DeckRead:
    try:
        return DeckService(session).add_action(deck_id, payload.action_id)
    except (DeckNotFoundError, DeckValidationError) as error:
        raise handle_error(error) from error


@router.delete("/{deck_id}/actions/{action_id}", response_model=DeckRead)
def remove_deck_action(
    deck_id: int,
    action_id: int,
    session: Session = Depends(get_session),
) -> DeckRead:
    try:
        return DeckService(session).remove_action(deck_id, action_id)
    except (DeckNotFoundError, DeckValidationError) as error:
        raise handle_error(error) from error


@router.patch("/{deck_id}/actions/order", response_model=DeckRead)
def reorder_deck_actions(
    deck_id: int,
    payload: DeckActionOrder,
    session: Session = Depends(get_session),
) -> DeckRead:
    try:
        return DeckService(session).reorder_actions(deck_id, payload.action_ids)
    except (DeckNotFoundError, DeckValidationError) as error:
        raise handle_error(error) from error
