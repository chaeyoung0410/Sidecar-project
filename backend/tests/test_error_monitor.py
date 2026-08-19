from pathlib import Path

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.database.database import engine
from app.main import app
from app.models import AIHistory, CommandHistory, ErrorHistory, Project
from app.services.error_monitor import parse_error_context


def test_parses_python_traceback_location_and_message() -> None:
    traceback = """Traceback (most recent call last):
  File "/code/app/user.py", line 43, in create_user
    import missing_package
ModuleNotFoundError: No module named 'missing_package'
"""

    message, file, line = parse_error_context(traceback)

    assert message == "ModuleNotFoundError: No module named 'missing_package'"
    assert file == "/code/app/user.py"
    assert line == 43


def test_parses_javascript_style_location() -> None:
    message, file, line = parse_error_context("TypeError: broken\n    at src/main.ts:27:4")

    assert message == "TypeError: broken"
    assert file == "src/main.ts"
    assert line == 27


def test_error_metadata_persists_and_delete_cleans_only_analysis(tmp_path: Path) -> None:
    with Session(engine) as session:
        project = Project(name="Error project", path=str(tmp_path), is_selected=True)
        session.add(project)
        session.commit()
        session.refresh(project)
        run = CommandHistory(
            project_id=project.id,
            name="Tests",
            command="pytest",
            working_directory=str(tmp_path),
            status="failed",
        )
        session.add(run)
        session.commit()
        session.refresh(run)
        error = ErrorHistory(
            command_run_id=run.id,
            project_id=project.id,
            project_name=project.name,
            command=run.command,
            error_message="AssertionError",
            stack_trace="immutable trace",
        )
        session.add(error)
        session.commit()
        session.refresh(error)
        analysis = AIHistory(
            error_id=error.id,
            provider="fake",
            model="fake-model",
            cause="cause",
            explanation="explanation",
            solution_steps=[],
            terminal_commands=[],
        )
        session.add(analysis)
        session.commit()
        error_id, analysis_id, run_id, project_id = error.id, analysis.id, run.id, project.id

    with TestClient(app) as client:
        updated = client.patch(
            f"/api/errors/{error_id}",
            json={"resolved": True, "user_note": " dependency 설치 후 해결 "},
        )
        assert updated.status_code == 200
        payload = updated.json()
        assert payload["resolved"] is True
        assert payload["resolved_at"]
        assert payload["user_note"] == "dependency 설치 후 해결"
        assert payload["error_message"] == "AssertionError"
        assert payload["stack_trace"] == "immutable trace"

        cleared = client.patch(f"/api/errors/{error_id}", json={"resolved": False, "user_note": ""})
        assert cleared.json()["resolved_at"] is None
        assert cleared.json()["user_note"] is None
        assert client.delete(f"/api/errors/{error_id}").status_code == 204
        assert client.get(f"/api/errors/{error_id}").status_code == 404

    with Session(engine) as session:
        assert session.get(AIHistory, analysis_id) is None
        assert session.get(CommandHistory, run_id) is not None
        assert session.get(Project, project_id) is not None
