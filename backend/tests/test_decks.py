from pathlib import Path

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.database.database import engine
from app.main import app
from app.models import DashboardAction, Deck, DeckAction, Project
from app.services import DeckService


def test_deck_crud_actions_order_and_project_isolation(tmp_path: Path) -> None:
    first_path = tmp_path / "first"
    second_path = tmp_path / "second"
    first_path.mkdir()
    second_path.mkdir()

    with TestClient(app) as client:
        first_project = client.post(
            "/api/projects", json={"name": "First", "path": str(first_path)}
        ).json()
        assert client.get("/api/decks").json() == []

        backend = client.post(
            "/api/decks",
            json={"name": "Backend", "description": "API 개발", "icon": "server"},
        )
        assert backend.status_code == 201
        backend_deck = backend.json()
        git_deck = client.post(
            "/api/decks", json={"name": "Git", "description": "", "icon": "git"}
        ).json()

        actions = client.get("/api/actions").json()
        commit_action = next(action for action in actions if action["type"] == "git_commit")
        pull_action = next(action for action in actions if action["type"] == "git_pull")

        assert client.post(
            f"/api/decks/{backend_deck['id']}/actions",
            json={"action_id": commit_action["id"]},
        ).status_code == 200
        client.post(
            f"/api/decks/{backend_deck['id']}/actions",
            json={"action_id": pull_action["id"]},
        )
        client.post(
            f"/api/decks/{git_deck['id']}/actions",
            json={"action_id": commit_action["id"]},
        )

        reordered_actions = client.patch(
            f"/api/decks/{backend_deck['id']}/actions/order",
            json={"action_ids": [pull_action["id"], commit_action["id"]]},
        ).json()
        assert [action["id"] for action in reordered_actions["actions"]] == [
            pull_action["id"], commit_action["id"]
        ]

        renamed = client.patch(
            f"/api/decks/{backend_deck['id']}",
            json={"name": "FastAPI Backend", "description": "서버 개발", "icon": "server"},
        ).json()
        assert renamed["name"] == "FastAPI Backend"

        reordered_decks = client.post(
            "/api/decks/reorder",
            json={"deck_ids": [git_deck["id"], backend_deck["id"]]},
        ).json()
        assert [deck["id"] for deck in reordered_decks] == [git_deck["id"], backend_deck["id"]]

        removed = client.delete(
            f"/api/decks/{backend_deck['id']}/actions/{commit_action['id']}"
        ).json()
        assert [action["id"] for action in removed["actions"]] == [pull_action["id"]]
        assert [action["id"] for action in client.get(f"/api/decks/{git_deck['id']}").json()["actions"]] == [commit_action["id"]]

        second_project = client.post(
            "/api/projects", json={"name": "Second", "path": str(second_path)}
        ).json()
        assert client.get("/api/decks").json() == []
        assert client.get(f"/api/decks/{git_deck['id']}").status_code == 404

        client.post(f"/api/projects/{first_project['id']}/select")
        assert [deck["name"] for deck in client.get("/api/decks").json()] == ["Git", "FastAPI Backend"]
        assert client.delete(f"/api/decks/{backend_deck['id']}").status_code == 204
        assert any(action["id"] == pull_action["id"] for action in client.get("/api/actions").json())
        client.post(f"/api/projects/{second_project['id']}/select")


def test_migrates_existing_actions_once_without_deleting_them(tmp_path: Path) -> None:
    with Session(engine) as session:
        project = Project(name="Existing", path=str(tmp_path), is_selected=True)
        action = DashboardAction(name="Existing Action", type="command", icon="terminal", position=0)
        session.add(project)
        session.add(action)
        session.commit()

    DeckService.migrate_existing_actions()
    DeckService.migrate_existing_actions()

    with Session(engine) as session:
        decks = list(session.exec(select(Deck)).all())
        links = list(session.exec(select(DeckAction)).all())
        actions = list(session.exec(select(DashboardAction)).all())
        assert len(decks) == 1
        assert decks[0].name == "Quick Actions"
        assert len(links) == 1
        assert len(actions) == 1
