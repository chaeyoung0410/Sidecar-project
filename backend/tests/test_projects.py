from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_project_update_allows_cors_patch() -> None:
    with TestClient(app) as client:
        response = client.options(
            "/api/projects/1",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "PATCH",
                "Access-Control-Request-Headers": "content-type",
            },
        )

    assert response.status_code == 200
    assert "PATCH" in response.headers["access-control-allow-methods"]


def test_project_crud_and_selection(tmp_path: Path) -> None:
    first_path = tmp_path / "first"
    second_path = tmp_path / "second"
    first_path.mkdir()
    second_path.mkdir()

    with TestClient(app) as client:
        assert client.get("/api/projects/current").json() is None

        first_response = client.post(
            "/api/projects", json={"name": "First", "path": str(first_path)}
        )
        assert first_response.status_code == 201
        first = first_response.json()
        assert first["is_selected"] is True
        assert first["path"] == str(first_path.resolve())

        second_response = client.post(
            "/api/projects", json={"name": "Second", "path": str(second_path)}
        )
        second = second_response.json()
        assert second["is_selected"] is True

        selected_response = client.post(f"/api/projects/{first['id']}/select")
        assert selected_response.status_code == 200
        assert selected_response.json()["name"] == "First"

        renamed_response = client.patch(
            f"/api/projects/{first['id']}", json={"name": "Renamed project"}
        )
        assert renamed_response.status_code == 200
        assert renamed_response.json()["name"] == "Renamed project"
        assert renamed_response.json()["path"] == first["path"]
        assert client.get("/api/projects/current").json()["name"] == "Renamed project"

        projects = client.get("/api/projects").json()
        assert len(projects) == 2
        assert sum(project["is_selected"] for project in projects) == 1

        delete_response = client.delete(f"/api/projects/{first['id']}")
        assert delete_response.status_code == 204
        assert client.get("/api/projects/current").json()["name"] == "Second"


def test_project_rejects_invalid_and_duplicate_paths(tmp_path: Path) -> None:
    project_path = tmp_path / "project"
    project_path.mkdir()

    with TestClient(app) as client:
        invalid = client.post(
            "/api/projects", json={"name": "Missing", "path": str(tmp_path / "missing")}
        )
        assert invalid.status_code == 400

        assert client.post(
            "/api/projects", json={"name": "Project", "path": str(project_path)}
        ).status_code == 201
        duplicate = client.post(
            "/api/projects", json={"name": "Duplicate", "path": str(project_path)}
        )
        assert duplicate.status_code == 400
