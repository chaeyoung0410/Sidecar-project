import asyncio
import os
import shlex
import signal
from datetime import UTC, datetime
from pathlib import Path

from sqlmodel import Session, select

from app.database.database import engine
from app.models import CommandHistory, Project, SavedCommand
from app.schemas import SavedCommandCreate, SavedCommandUpdate
from app.services.error_monitor import error_monitor


MAX_OUTPUT_CHARS = 100_000
TERMINAL_STATUSES = {"succeeded", "failed", "stopped"}
SHELL_OPERATORS = {"|", "||", "&&", ";", ">", ">>", "<", "2>", "2>>"}


class CommandServiceError(RuntimeError):
    pass


class CommandNotFoundError(LookupError):
    pass


class CommandValidationError(ValueError):
    pass


def validate_command(command: str) -> list[str]:
    try:
        arguments = shlex.split(command)
    except ValueError as error:
        raise CommandValidationError(f"Invalid command syntax: {error}") from error

    if not arguments:
        raise CommandValidationError("Command cannot be empty")
    if any(argument in SHELL_OPERATORS for argument in arguments):
        raise CommandValidationError("Shell operators are not supported; register one command at a time")

    executable = Path(arguments[0]).name.lower()
    lowered = [argument.lower() for argument in arguments[1:]]
    if executable == "sudo":
        raise CommandValidationError("sudo commands are not supported")
    if executable == "rm" and any(
        argument in {"-rf", "-fr", "--recursive", "--force"} or
        (argument.startswith("-") and "r" in argument and "f" in argument)
        for argument in lowered
    ):
        raise CommandValidationError("Recursive forced deletion commands are blocked")
    if executable == "git" and "push" in lowered and any(
        argument in {"-f", "--force", "--force-with-lease"} for argument in lowered
    ):
        raise CommandValidationError("Force push commands are blocked")
    if executable == "git" and "reset" in lowered and "--hard" in lowered:
        raise CommandValidationError("git reset --hard commands are blocked")
    return arguments


def resolve_working_directory(project_path: str, configured_path: str) -> Path:
    try:
        project_root = Path(project_path).resolve(strict=True)
        candidate = Path(configured_path).expanduser()
        if candidate.is_absolute():
            candidate = candidate.resolve(strict=True)
        else:
            candidate = (project_root / candidate).resolve(strict=True)
    except (OSError, RuntimeError) as error:
        raise CommandValidationError("Working directory does not exist") from error

    if not candidate.is_dir():
        raise CommandValidationError("Working directory must be a directory")
    if not candidate.is_relative_to(project_root):
        raise CommandValidationError("Working directory must be inside the selected project")
    return candidate


class SavedCommandService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list(self) -> list[SavedCommand]:
        return list(self.session.exec(select(SavedCommand).order_by(SavedCommand.updated_at.desc())).all())

    def create(self, payload: SavedCommandCreate) -> SavedCommand:
        validate_command(payload.command)
        if not payload.name.strip():
            raise CommandValidationError("Command name cannot be empty")
        command = SavedCommand(
            name=payload.name.strip(),
            command=payload.command.strip(),
            working_directory=payload.working_directory.strip(),
        )
        self.session.add(command)
        self.session.commit()
        self.session.refresh(command)
        return command

    def update(self, command_id: int, payload: SavedCommandUpdate) -> SavedCommand:
        command = self.get(command_id)
        validate_command(payload.command)
        if not payload.name.strip():
            raise CommandValidationError("Command name cannot be empty")
        command.name = payload.name.strip()
        command.command = payload.command.strip()
        command.working_directory = payload.working_directory.strip()
        command.updated_at = datetime.now(UTC)
        self.session.add(command)
        self.session.commit()
        self.session.refresh(command)
        return command

    def delete(self, command_id: int) -> None:
        command = self.get(command_id)
        self.session.delete(command)
        self.session.commit()

    def get(self, command_id: int) -> SavedCommand:
        command = self.session.get(SavedCommand, command_id)
        if not command:
            raise CommandNotFoundError("Saved command not found")
        return command


class CommandRunner:
    def __init__(self) -> None:
        self._processes: dict[int, asyncio.subprocess.Process] = {}
        self._tasks: set[asyncio.Task[None]] = set()
        self._locks: dict[int, asyncio.Lock] = {}

    async def start(self, command: SavedCommand, project: Project) -> CommandHistory:
        if command.id is None or project.id is None:
            raise CommandServiceError("Command and project must be saved before execution")

        arguments = validate_command(command.command)
        working_directory = resolve_working_directory(project.path, command.working_directory)
        with Session(engine) as session:
            run = CommandHistory(
                command_id=command.id,
                project_id=project.id,
                name=command.name,
                command=command.command,
                working_directory=str(working_directory),
            )
            session.add(run)
            session.commit()
            session.refresh(run)
            run_id = run.id

        if run_id is None:
            raise CommandServiceError("Unable to create command history")

        task = asyncio.create_task(self._execute(run_id, arguments, working_directory))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return self.get_run(run_id)

    def list_runs(self, limit: int = 20) -> list[CommandHistory]:
        with Session(engine) as session:
            statement = select(CommandHistory).order_by(CommandHistory.started_at.desc()).limit(limit)
            return list(session.exec(statement).all())

    def get_run(self, run_id: int) -> CommandHistory:
        with Session(engine) as session:
            run = session.get(CommandHistory, run_id)
            if not run:
                raise CommandNotFoundError("Command run not found")
            session.expunge(run)
            return run

    async def stop(self, run_id: int) -> CommandHistory:
        process = self._processes.get(run_id)
        if not process or process.returncode is not None:
            run = self.get_run(run_id)
            if run.status in TERMINAL_STATUSES:
                return run
            raise CommandServiceError("Command process is not active")

        await self._terminate_process(process)
        self._set_finished(run_id, "stopped", process.returncode)
        return self.get_run(run_id)

    def recover_interrupted_runs(self) -> None:
        with Session(engine) as session:
            runs = session.exec(
                select(CommandHistory).where(CommandHistory.status.in_(["queued", "running"]))
            ).all()
            for run in runs:
                run.status = "failed"
                run.stderr = (run.stderr + "\nCodePad Agent restarted before the command finished.").strip()
                run.finished_at = datetime.now(UTC)
                session.add(run)
            session.commit()

    async def shutdown(self) -> None:
        for process in tuple(self._processes.values()):
            if process.returncode is None:
                await self._terminate_process(process)

    async def _execute(self, run_id: int, arguments: list[str], cwd: Path) -> None:
        self._locks[run_id] = asyncio.Lock()
        try:
            process = await asyncio.create_subprocess_exec(
                *arguments,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                start_new_session=True,
            )
            self._processes[run_id] = process
            self._set_running(run_id, process.pid)
            await asyncio.gather(
                self._read_stream(run_id, process.stdout, "stdout"),
                self._read_stream(run_id, process.stderr, "stderr"),
            )
            exit_code = await process.wait()
            current = self.get_run(run_id)
            if current.status != "stopped":
                self._set_finished(run_id, "succeeded" if exit_code == 0 else "failed", exit_code)
        except (OSError, ValueError) as error:
            self._append_output(run_id, "stderr", str(error))
            self._set_finished(run_id, "failed", None)
        finally:
            self._processes.pop(run_id, None)
            self._locks.pop(run_id, None)

    async def _read_stream(
        self,
        run_id: int,
        stream: asyncio.StreamReader | None,
        field: str,
    ) -> None:
        if stream is None:
            return
        while chunk := await stream.read(4096):
            lock = self._locks[run_id]
            async with lock:
                self._append_output(run_id, field, chunk.decode(errors="replace"))
                if field == "stderr":
                    await error_monitor.capture(run_id)

    def _set_running(self, run_id: int, pid: int) -> None:
        with Session(engine) as session:
            run = session.get(CommandHistory, run_id)
            if run:
                run.status = "running"
                run.pid = pid
                session.add(run)
                session.commit()

    def _append_output(self, run_id: int, field: str, text: str) -> None:
        with Session(engine) as session:
            run = session.get(CommandHistory, run_id)
            if run:
                current = getattr(run, field)
                setattr(run, field, (current + text)[-MAX_OUTPUT_CHARS:])
                session.add(run)
                session.commit()

    def _set_finished(self, run_id: int, status: str, exit_code: int | None) -> None:
        with Session(engine) as session:
            run = session.get(CommandHistory, run_id)
            if run:
                run.status = status
                run.exit_code = exit_code
                run.finished_at = datetime.now(UTC)
                session.add(run)
                session.commit()

    async def _terminate_process(self, process: asyncio.subprocess.Process) -> None:
        try:
            os.killpg(process.pid, signal.SIGTERM)
            await asyncio.wait_for(process.wait(), timeout=5)
        except ProcessLookupError:
            return
        except TimeoutError:
            os.killpg(process.pid, signal.SIGKILL)
            await process.wait()


command_runner = CommandRunner()
