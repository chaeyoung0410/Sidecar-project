from fastapi import APIRouter, HTTPException, Query, status
from app.schemas import ErrorHistoryRead
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
