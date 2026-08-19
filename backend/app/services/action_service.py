from __future__ import annotations

from datetime import UTC, datetime

from sqlmodel import Session, select

from app.database.database import engine
from app.models import DashboardAction, DashboardState, DeckAction, SavedCommand
from app.schemas import DashboardActionCreate, DashboardActionUpdate


DEFAULT_ACTIONS = [
    {"name": "AI Error", "type": "ai_error", "icon": "spark", "config": {}},
    {"name": "Git Commit", "type": "git_commit", "icon": "commit", "config": {}},
    {"name": "Git Push", "type": "git_push", "icon": "push", "config": {}},
    {"name": "Git Pull", "type": "git_pull", "icon": "pull", "config": {}},
    {"name": "Notion", "type": "notion", "icon": "notion", "config": {}},
    {"name": "Command Runner", "type": "command", "icon": "terminal", "config": {}},
]


class ActionNotFoundError(LookupError):
    pass


class ActionValidationError(ValueError):
    pass


class ActionService:
    def __init__(self, session: Session) -> None:
        self.session = session

    @staticmethod
    def seed_defaults() -> None:
        with Session(engine) as session:
            if session.get(DashboardState, 1):
                return
            for position, data in enumerate(DEFAULT_ACTIONS):
                session.add(DashboardAction(position=position, is_builtin=True, **data))
            session.add(DashboardState(id=1))
            session.commit()

    def list(self) -> list[DashboardAction]:
        statement = select(DashboardAction).order_by(DashboardAction.position, DashboardAction.id)
        return list(self.session.exec(statement).all())

    def create(self, payload: DashboardActionCreate) -> DashboardAction:
        name = payload.name.strip()
        if not name:
            raise ActionValidationError("Action name cannot be empty")
        self._validate_config(payload.type, payload.config)
        last = self.session.exec(
            select(DashboardAction).order_by(DashboardAction.position.desc())
        ).first()
        action = DashboardAction(
            name=name,
            type=payload.type,
            icon=payload.icon,
            position=(last.position + 1) if last else 0,
            config=payload.config,
        )
        self.session.add(action)
        self.session.commit()
        self.session.refresh(action)
        return action

    def update(self, action_id: int, payload: DashboardActionUpdate) -> DashboardAction:
        action = self.get(action_id)
        name = payload.name.strip()
        if not name:
            raise ActionValidationError("Action name cannot be empty")
        self._validate_config(payload.type, payload.config)
        action.name = name
        action.type = payload.type
        action.icon = payload.icon
        action.config = payload.config
        action.updated_at = datetime.now(UTC)
        self.session.add(action)
        self.session.commit()
        self.session.refresh(action)
        return action

    def delete(self, action_id: int) -> None:
        action = self.get(action_id)
        if action.is_builtin:
            raise ActionValidationError("Built-in Actions cannot be deleted; remove them from a Deck instead")
        for link in self.session.exec(select(DeckAction).where(DeckAction.action_id == action_id)).all():
            self.session.delete(link)
        self.session.delete(action)
        self.session.commit()
        self._normalize_positions()

    def reorder(self, action_ids: list[int]) -> list[DashboardAction]:
        current = self.list()
        current_ids = [action.id for action in current]
        if len(action_ids) != len(set(action_ids)) or set(action_ids) != set(current_ids):
            raise ActionValidationError("Reorder request must contain every action exactly once")
        by_id = {action.id: action for action in current}
        for position, action_id in enumerate(action_ids):
            action = by_id[action_id]
            action.position = position
            action.updated_at = datetime.now(UTC)
            self.session.add(action)
        self.session.commit()
        return self.list()

    def get(self, action_id: int) -> DashboardAction:
        action = self.session.get(DashboardAction, action_id)
        if not action:
            raise ActionNotFoundError("Dashboard action not found")
        return action

    def _normalize_positions(self) -> None:
        for position, action in enumerate(self.list()):
            action.position = position
            self.session.add(action)
        self.session.commit()

    def _validate_config(self, action_type: str, config: dict[str, object]) -> None:
        if action_type == "command" and "command_id" in config:
            command_id = config["command_id"]
            if not isinstance(command_id, int) or isinstance(command_id, bool) or command_id < 1:
                raise ActionValidationError("command_id must be a positive integer")
            if not self.session.get(SavedCommand, command_id):
                raise ActionValidationError("Configured saved command does not exist")
