from datetime import UTC, datetime
from pathlib import Path

from sqlmodel import Session, select

from app.models import Project
from app.schemas import ProjectCreate, ProjectUpdate


class ProjectNotFoundError(LookupError):
    pass


class InvalidProjectPathError(ValueError):
    pass


class DuplicateProjectError(ValueError):
    pass


class ProjectService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list(self) -> list[Project]:
        statement = select(Project).order_by(Project.last_used_at.desc())
        return list(self.session.exec(statement).all())

    def current(self) -> Project | None:
        return self.session.exec(select(Project).where(Project.is_selected)).first()

    def create(self, payload: ProjectCreate) -> Project:
        name = payload.name.strip()
        if not name:
            raise ValueError("Project name cannot be empty")

        try:
            resolved_path = Path(payload.path).expanduser().resolve(strict=True)
        except (OSError, RuntimeError) as error:
            raise InvalidProjectPathError("Project path does not exist") from error

        if not resolved_path.is_dir():
            raise InvalidProjectPathError("Project path must be a directory")

        normalized_path = str(resolved_path)
        duplicate = self.session.exec(select(Project).where(Project.path == normalized_path)).first()
        if duplicate:
            raise DuplicateProjectError("This project path is already registered")

        self._clear_selection()
        now = datetime.now(UTC)
        project = Project(
            name=name,
            path=normalized_path,
            is_selected=True,
            created_at=now,
            last_used_at=now,
        )
        self.session.add(project)
        self.session.commit()
        self.session.refresh(project)
        return project

    def select(self, project_id: int) -> Project:
        project = self.session.get(Project, project_id)
        if not project:
            raise ProjectNotFoundError("Project not found")

        self._clear_selection()
        project.is_selected = True
        project.last_used_at = datetime.now(UTC)
        self.session.add(project)
        self.session.commit()
        self.session.refresh(project)
        return project

    def update(self, project_id: int, payload: ProjectUpdate) -> Project:
        project = self.session.get(Project, project_id)
        if not project:
            raise ProjectNotFoundError("Project not found")

        name = payload.name.strip()
        if not name:
            raise ValueError("Project name cannot be empty")

        project.name = name
        self.session.add(project)
        self.session.commit()
        self.session.refresh(project)
        return project

    def delete(self, project_id: int) -> None:
        project = self.session.get(Project, project_id)
        if not project:
            raise ProjectNotFoundError("Project not found")

        was_selected = project.is_selected
        self.session.delete(project)
        self.session.commit()

        if was_selected:
            replacement = self.session.exec(
                select(Project).order_by(Project.last_used_at.desc())
            ).first()
            if replacement:
                replacement.is_selected = True
                replacement.last_used_at = datetime.now(UTC)
                self.session.add(replacement)
                self.session.commit()

    def _clear_selection(self) -> None:
        selected_projects = self.session.exec(select(Project).where(Project.is_selected)).all()
        for project in selected_projects:
            project.is_selected = False
            self.session.add(project)
