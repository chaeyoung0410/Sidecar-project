from fastapi.testclient import TestClient

from sqlmodel import Session, select

from app.database.database import engine
from app.main import app
from app.models import DashboardAction, DashboardState, Deck, DeckAction, Project
from app.services import ActionService


def test_default_actions_and_crud_reorder() -> None:
    with TestClient(app) as client:
        defaults = client.get("/api/actions").json()
        assert [action["type"] for action in defaults] == [
            "ai_error", "git_commit", "git_push", "git_pull", "notion", "command"
        ]
        assert all(action["is_builtin"] for action in defaults)

        created = client.post(
            "/api/actions",
            json={"name": "Tests", "type": "command", "icon": "play", "config": {}},
        )
        assert created.status_code == 201
        action = created.json()
        assert action["position"] == 6

        updated = client.put(
            f"/api/actions/{action['id']}",
            json={"name": "Run tests", "type": "command", "icon": "terminal", "config": {}},
        )
        assert updated.status_code == 200
        assert updated.json()["name"] == "Run tests"

        all_actions = client.get("/api/actions").json()
        reversed_ids = [item["id"] for item in reversed(all_actions)]
        reordered = client.post("/api/actions/reorder", json={"action_ids": reversed_ids})
        assert reordered.status_code == 200
        assert [item["id"] for item in reordered.json()] == reversed_ids

        assert client.delete(f"/api/actions/{action['id']}").status_code == 204
        remaining = client.get("/api/actions").json()
        assert [item["position"] for item in remaining] == list(range(6))


def test_action_reorder_rejects_incomplete_list() -> None:
    with TestClient(app) as client:
        actions = client.get("/api/actions").json()
        response = client.post(
            "/api/actions/reorder",
            json={"action_ids": [actions[0]["id"]]},
        )
        assert response.status_code == 400


def test_builtin_actions_cannot_be_deleted() -> None:
    with TestClient(app) as client:
        actions = client.get("/api/actions").json()
        response = client.delete(f"/api/actions/{actions[0]['id']}")

    assert response.status_code == 400
    assert "Built-in Actions cannot be deleted" in response.json()["detail"]


def test_missing_default_action_is_added_to_existing_quick_actions_deck(tmp_path) -> None:
    with Session(engine) as session:
        project = Project(name="Existing", path=str(tmp_path), is_selected=True)
        commit = DashboardAction(
            name="Git Commit", type="git_commit", icon="commit", position=0, is_builtin=True
        )
        session.add(project)
        session.add(commit)
        session.add(DashboardState(id=1))
        session.commit()
        session.refresh(project)
        session.refresh(commit)
        deck = Deck(project_id=project.id, name="Quick Actions", position=0)
        session.add(deck)
        session.commit()
        session.refresh(deck)
        session.add(DeckAction(deck_id=deck.id, action_id=commit.id, position=0))
        session.commit()

    ActionService.seed_defaults()
    ActionService.seed_defaults()

    with Session(engine) as session:
        pull_actions = list(session.exec(
            select(DashboardAction).where(DashboardAction.type == "git_pull")
        ).all())
        assert len(pull_actions) == 1
        assert pull_actions[0].is_builtin is True
        pull_links = list(session.exec(
            select(DeckAction).where(DeckAction.action_id == pull_actions[0].id)
        ).all())
        assert len(pull_links) == 1
        assert pull_links[0].position == 3
