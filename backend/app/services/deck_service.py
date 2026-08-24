from __future__ import annotations

from datetime import UTC, datetime

from sqlmodel import Session, select

from app.database.database import engine
from app.models import DashboardAction, Deck, DeckAction, DeckState, Project
from app.schemas import (
    DashboardActionRead,
    DeckCreate,
    DeckRead,
    DeckUpdate,
)


class DeckNotFoundError(LookupError):
    pass


class DeckValidationError(ValueError):
    pass


class DeckService:
    def __init__(self, session: Session) -> None:
        self.session = session

    @staticmethod
    def migrate_existing_actions() -> None:
        with Session(engine) as session:
            if session.get(DeckState, 1):
                return
            actions = list(session.exec(select(DashboardAction).order_by(DashboardAction.position)).all())
            projects = list(session.exec(select(Project)).all())
            for project in projects:
                if project.id is None or not actions:
                    continue
                deck = Deck(
                    project_id=project.id,
                    name="Quick Actions",
                    description="기존 Dashboard Action을 모아둔 Deck입니다.",
                    icon="grid",
                    position=0,
                )
                session.add(deck)
                session.commit()
                session.refresh(deck)
                for position, action in enumerate(actions):
                    if deck.id is not None and action.id is not None:
                        session.add(DeckAction(deck_id=deck.id, action_id=action.id, position=position))
            session.add(DeckState(id=1))
            session.commit()

    def list(self) -> list[DeckRead]:
        project = self._current_project()
        decks = self.session.exec(
            select(Deck).where(Deck.project_id == project.id).order_by(Deck.position, Deck.id)
        ).all()
        return [self._read(deck) for deck in decks]

    def get(self, deck_id: int) -> DeckRead:
        return self._read(self._get_model(deck_id))

    def create(self, payload: DeckCreate) -> DeckRead:
        project = self._current_project()
        name = payload.name.strip()
        if not name:
            raise DeckValidationError("Deck name cannot be empty")
        last = self.session.exec(
            select(Deck).where(Deck.project_id == project.id).order_by(Deck.position.desc())
        ).first()
        deck = Deck(
            project_id=project.id,
            name=name,
            description=payload.description.strip(),
            icon=payload.icon,
            position=(last.position + 1) if last else 0,
        )
        self.session.add(deck)
        self.session.commit()
        self.session.refresh(deck)
        return self._read(deck)

    def update(self, deck_id: int, payload: DeckUpdate) -> DeckRead:
        deck = self._get_model(deck_id)
        name = payload.name.strip()
        if not name:
            raise DeckValidationError("Deck name cannot be empty")
        deck.name = name
        deck.description = payload.description.strip()
        deck.icon = payload.icon
        deck.updated_at = datetime.now(UTC)
        self.session.add(deck)
        self.session.commit()
        self.session.refresh(deck)
        return self._read(deck)

    def delete(self, deck_id: int) -> None:
        deck = self._get_model(deck_id)
        links = self.session.exec(select(DeckAction).where(DeckAction.deck_id == deck_id)).all()
        for link in links:
            self.session.delete(link)
        self.session.delete(deck)
        self.session.commit()
        self._normalize_deck_positions(deck.project_id)

    def reorder(self, deck_ids: list[int]) -> list[DeckRead]:
        decks = self.list()
        current_ids = [deck.id for deck in decks]
        if len(deck_ids) != len(set(deck_ids)) or set(deck_ids) != set(current_ids):
            raise DeckValidationError("Reorder request must contain every Deck exactly once")
        for position, deck_id in enumerate(deck_ids):
            deck = self.session.get(Deck, deck_id)
            if deck:
                deck.position = position
                deck.updated_at = datetime.now(UTC)
                self.session.add(deck)
        self.session.commit()
        return self.list()

    def add_action(self, deck_id: int, action_id: int) -> DeckRead:
        deck = self._get_model(deck_id)
        if not self.session.get(DashboardAction, action_id):
            raise DeckValidationError("Action not found")
        existing = self.session.exec(
            select(DeckAction).where(
                DeckAction.deck_id == deck_id,
                DeckAction.action_id == action_id,
            )
        ).first()
        if existing:
            raise DeckValidationError("Action is already in this Deck")
        last = self.session.exec(
            select(DeckAction).where(DeckAction.deck_id == deck_id).order_by(DeckAction.position.desc())
        ).first()
        self.session.add(DeckAction(
            deck_id=deck_id,
            action_id=action_id,
            position=(last.position + 1) if last else 0,
        ))
        deck.updated_at = datetime.now(UTC)
        self.session.add(deck)
        self.session.commit()
        return self._read(deck)

    def remove_action(self, deck_id: int, action_id: int) -> DeckRead:
        deck = self._get_model(deck_id)
        link = self.session.exec(
            select(DeckAction).where(
                DeckAction.deck_id == deck_id,
                DeckAction.action_id == action_id,
            )
        ).first()
        if not link:
            raise DeckValidationError("Action is not in this Deck")
        self.session.delete(link)
        deck.updated_at = datetime.now(UTC)
        self.session.add(deck)
        self.session.commit()
        self._normalize_action_positions(deck_id)
        return self._read(deck)

    def reorder_actions(self, deck_id: int, action_ids: list[int]) -> DeckRead:
        deck = self._get_model(deck_id)
        links = list(self.session.exec(
            select(DeckAction).where(DeckAction.deck_id == deck_id).order_by(DeckAction.position)
        ).all())
        current_ids = [link.action_id for link in links]
        if len(action_ids) != len(set(action_ids)) or set(action_ids) != set(current_ids):
            raise DeckValidationError("Reorder request must contain every Deck Action exactly once")
        by_action_id = {link.action_id: link for link in links}
        for position, action_id in enumerate(action_ids):
            link = by_action_id[action_id]
            link.position = position
            self.session.add(link)
        deck.updated_at = datetime.now(UTC)
        self.session.add(deck)
        self.session.commit()
        return self._read(deck)

    def _current_project(self) -> Project:
        project = self.session.exec(select(Project).where(Project.is_selected)).first()
        if not project or project.id is None:
            raise DeckValidationError("No project selected")
        return project

    def _get_model(self, deck_id: int) -> Deck:
        project = self._current_project()
        deck = self.session.get(Deck, deck_id)
        if not deck or deck.project_id != project.id:
            raise DeckNotFoundError("Deck not found")
        return deck

    def _read(self, deck: Deck) -> DeckRead:
        links = self.session.exec(
            select(DeckAction).where(DeckAction.deck_id == deck.id).order_by(DeckAction.position, DeckAction.id)
        ).all()
        actions = [self.session.get(DashboardAction, link.action_id) for link in links]
        return DeckRead(
            id=deck.id,
            project_id=deck.project_id,
            name=deck.name,
            description=deck.description,
            icon=deck.icon,
            position=deck.position,
            actions=[DashboardActionRead.model_validate(action) for action in actions if action],
            created_at=deck.created_at,
            updated_at=deck.updated_at,
        )

    def _normalize_deck_positions(self, project_id: int) -> None:
        decks = self.session.exec(
            select(Deck).where(Deck.project_id == project_id).order_by(Deck.position, Deck.id)
        ).all()
        for position, deck in enumerate(decks):
            deck.position = position
            self.session.add(deck)
        self.session.commit()

    def _normalize_action_positions(self, deck_id: int) -> None:
        links = self.session.exec(
            select(DeckAction).where(DeckAction.deck_id == deck_id).order_by(DeckAction.position, DeckAction.id)
        ).all()
        for position, link in enumerate(links):
            link.position = position
            self.session.add(link)
        self.session.commit()
