from fastapi import APIRouter, HTTPException, Query, Response, status
from app.schemas import ErrorHistoryRead, ErrorHistoryUpdate
from app.services import error_monitor


router = APIRouter(prefix="/api/errors", tags=["errors"])


@router.get("", response_model=list[ErrorHistoryRead])
def list_errors(limit: int = Query(default=50, ge=1, le=200)) -> list[ErrorHistoryRead]:
    return error_monitor.list(limit)


@router.get("/{error_id}", response_model=ErrorHistoryRead)
def get_error(error_id: int) -> ErrorHistoryRead:
    error = error_monitor.get(error_id)
    if not error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Error not found")
    return error


@router.patch("/{error_id}", response_model=ErrorHistoryRead)
def update_error(error_id: int, payload: ErrorHistoryUpdate) -> ErrorHistoryRead:
    error = error_monitor.update(error_id, payload)
    if not error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Error not found")
    return error


@router.delete("/{error_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_error(error_id: int) -> Response:
    if not error_monitor.delete(error_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Error not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
