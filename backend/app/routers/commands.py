from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlmodel import Session

from app.database import get_session
from app.schemas import (
    CommandRunRead,
    CommandRunRequest,
    CommandStopRequest,
    SavedCommandCreate,
    SavedCommandRead,
    SavedCommandUpdate,
)
from app.services import ProjectService, SavedCommandService, command_runner
from app.services.command_service import (
    CommandNotFoundError,
    CommandServiceError,
    CommandValidationError,
)


router = APIRouter(prefix="/api/commands", tags=["commands"])


@router.get("", response_model=list[SavedCommandRead])
def list_commands(session: Session = Depends(get_session)) -> list[SavedCommandRead]:
    return SavedCommandService(session).list()


@router.post("", response_model=SavedCommandRead, status_code=status.HTTP_201_CREATED)
def create_command(
    payload: SavedCommandCreate,
    session: Session = Depends(get_session),
) -> SavedCommandRead:
    try:
        return SavedCommandService(session).create(payload)
    except CommandValidationError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.put("/{command_id}", response_model=SavedCommandRead)
def update_command(
    command_id: int,
    payload: SavedCommandUpdate,
    session: Session = Depends(get_session),
) -> SavedCommandRead:
    try:
        return SavedCommandService(session).update(command_id, payload)
    except CommandNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except CommandValidationError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.delete("/{command_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_command(command_id: int, session: Session = Depends(get_session)) -> Response:
    try:
        SavedCommandService(session).delete(command_id)
    except CommandNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{command_id}/run", response_model=CommandRunRead, status_code=status.HTTP_202_ACCEPTED)
async def run_command(
    command_id: int,
    _: CommandRunRequest,
    session: Session = Depends(get_session),
) -> CommandRunRead:
    try:
        command = SavedCommandService(session).get(command_id)
        project = ProjectService(session).current()
        if not project:
            raise CommandValidationError("Select a project before running a command")
        return await command_runner.start(command, project)
    except CommandNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except (CommandValidationError, CommandServiceError) as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.get("/runs/recent", response_model=list[CommandRunRead])
def list_recent_runs(limit: int = Query(default=20, ge=1, le=100)) -> list[CommandRunRead]:
    return command_runner.list_runs(limit)


@router.get("/runs/{run_id}", response_model=CommandRunRead)
def get_command_run(run_id: int) -> CommandRunRead:
    try:
        return command_runner.get_run(run_id)
    except CommandNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post("/runs/{run_id}/stop", response_model=CommandRunRead)
async def stop_command(run_id: int, _: CommandStopRequest) -> CommandRunRead:
    try:
        return await command_runner.stop(run_id)
    except CommandNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except CommandServiceError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
