import time
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.connection_manager import connection_manager


def register_project(client: TestClient, path: Path) -> None:
    response = client.post(
        "/api/projects",
        json={"name": "Command project", "path": str(path)},
    )
    assert response.status_code == 201


def wait_for_terminal_status(client: TestClient, run_id: int) -> dict[str, object]:
    for _ in range(60):
        payload = client.get(f"/api/commands/runs/{run_id}").json()
        if payload["status"] in {"succeeded", "failed", "stopped"}:
            return payload
        time.sleep(0.05)
    raise AssertionError("Command did not finish")


def test_saved_command_crud_and_execution(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    broadcast = AsyncMock()
    monkeypatch.setattr(connection_manager, "broadcast", broadcast)
    with TestClient(app) as client:
        register_project(client, tmp_path)
        created = client.post(
            "/api/commands",
            json={
                "name": "Python check",
                "command": "python3 -c \"import sys; print('out'); print('err', file=sys.stderr)\"",
                "working_directory": ".",
            },
        )
        assert created.status_code == 201
        command = created.json()

        unconfirmed = client.post(
            f"/api/commands/{command['id']}/run",
            json={"confirmed": False},
        )
        assert unconfirmed.status_code == 422

        started = client.post(
            f"/api/commands/{command['id']}/run",
            json={"confirmed": True},
        )
        assert started.status_code == 202
        result = wait_for_terminal_status(client, started.json()["id"])
        assert result["status"] == "succeeded"
        assert result["exit_code"] == 0
        assert "out" in result["stdout"]
        assert "err" in result["stderr"]
        errors = client.get("/api/errors").json()
        assert errors == []
        assert broadcast.await_count == 0

        updated = client.put(
            f"/api/commands/{command['id']}",
            json={"name": "Updated", "command": "python3 --version", "working_directory": "."},
        )
        assert updated.status_code == 200
        assert updated.json()["name"] == "Updated"
        assert len(client.get("/api/commands").json()) == 1
        assert client.delete(f"/api/commands/{command['id']}").status_code == 204


def test_failed_command_creates_error_and_websocket_event(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    broadcast = AsyncMock()
    monkeypatch.setattr(connection_manager, "broadcast", broadcast)
    with TestClient(app) as client:
        register_project(client, tmp_path)
        command = client.post(
            "/api/commands",
            json={
                "name": "Broken command",
                "command": "python3 -c \"import sys; print('TypeError: broken', file=sys.stderr); sys.exit(1)\"",
                "working_directory": ".",
            },
        ).json()
        started = client.post(f"/api/commands/{command['id']}/run", json={"confirmed": True}).json()
        result = wait_for_terminal_status(client, started["id"])

        assert result["status"] == "failed"
        assert result["exit_code"] == 1
        errors = client.get("/api/errors").json()
        assert len(errors) == 1
        assert errors[0]["command_run_id"] == result["id"]
        assert errors[0]["error_message"] == "TypeError: broken"
        assert any(call.args[0]["type"] == "error.detected" for call in broadcast.await_args_list)


def test_dangerous_and_shell_commands_are_blocked() -> None:
    with TestClient(app) as client:
        for command in ["rm -rf build", "git push --force origin main", "echo ok && rm file"]:
            response = client.post(
                "/api/commands",
                json={"name": "Blocked", "command": command, "working_directory": "."},
            )
            assert response.status_code == 400


def test_running_command_can_be_stopped(tmp_path: Path) -> None:
    with TestClient(app) as client:
        register_project(client, tmp_path)
        command = client.post(
            "/api/commands",
            json={
                "name": "Long task",
                "command": "python3 -c \"import time; print('started', flush=True); time.sleep(30)\"",
                "working_directory": ".",
            },
        ).json()
        started = client.post(
            f"/api/commands/{command['id']}/run",
            json={"confirmed": True},
        ).json()

        for _ in range(40):
            current = client.get(f"/api/commands/runs/{started['id']}").json()
            if current["status"] == "running":
                break
            time.sleep(0.05)

        stopped = client.post(
            f"/api/commands/runs/{started['id']}/stop",
            json={"confirmed": True},
        )
        assert stopped.status_code == 200
        assert stopped.json()["status"] == "stopped"
