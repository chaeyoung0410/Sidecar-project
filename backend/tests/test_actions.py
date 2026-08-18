from fastapi.testclient import TestClient

from app.main import app


def test_default_actions_and_crud_reorder() -> None:
    with TestClient(app) as client:
        defaults = client.get("/api/actions").json()
        assert [action["type"] for action in defaults] == [
            "ai_error", "git_commit", "git_push", "git_pull", "notion", "command"
        ]

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


def test_deleting_every_action_does_not_reseed_defaults() -> None:
    with TestClient(app) as client:
        for action in client.get("/api/actions").json():
            assert client.delete(f"/api/actions/{action['id']}").status_code == 204
        assert client.get("/api/actions").json() == []

    with TestClient(app) as client:
        assert client.get("/api/actions").json() == []
