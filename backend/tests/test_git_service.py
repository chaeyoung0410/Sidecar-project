import subprocess
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.services.git_service import GitService


def run_git(path: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *arguments],
        cwd=path,
        check=True,
        capture_output=True,
        text=True,
    )


def initialize_repository(path: Path, branch: str = "main") -> None:
    run_git(path, "init", "-b", branch)
    run_git(path, "config", "user.name", "CodePad Test")
    run_git(path, "config", "user.email", "codepad@example.test")


def test_parse_git_status() -> None:
    output = " M src/main.py\0A  new file.py\0?? notes.txt\0R  renamed.py\0old.py\0"

    files = GitService.parse_porcelain(output)

    assert [file.path for file in files] == [
        "src/main.py",
        "new file.py",
        "notes.txt",
        "renamed.py",
    ]
    assert files[0].unstaged is True
    assert files[0].staged is False
    assert files[1].staged is True
    assert files[2].status == "?"
    assert files[3].original_path == "old.py"


def test_reads_branch_and_changes_from_local_repository(tmp_path: Path) -> None:
    initialize_repository(tmp_path)
    (tmp_path / "hello.py").write_text("print('hello')\n", encoding="utf-8")

    status = GitService(1, "Temporary project", str(tmp_path)).status()

    assert status.branch == "main"
    assert status.repository == "Temporary project"
    assert len(status.changed_files) == 1
    assert status.changed_files[0].path == "hello.py"
    assert status.changed_files[0].status == "?"


def test_git_status_api_uses_selected_project(tmp_path: Path) -> None:
    initialize_repository(tmp_path, "feature/phase-3")
    (tmp_path / "README.md").write_text("# Test\n", encoding="utf-8")

    with TestClient(app) as client:
        project = client.post(
            "/api/projects",
            json={"name": "API project", "path": str(tmp_path)},
        )
        assert project.status_code == 201

        response = client.get("/api/git/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["branch"] == "feature/phase-3"
    assert payload["changed_files"][0]["path"] == "README.md"


def test_commit_only_includes_selected_files(tmp_path: Path) -> None:
    initialize_repository(tmp_path)
    first_file = tmp_path / "first.txt"
    second_file = tmp_path / "second.txt"
    first_file.write_text("initial\n", encoding="utf-8")
    second_file.write_text("initial\n", encoding="utf-8")
    run_git(tmp_path, "add", "--", "first.txt", "second.txt")
    run_git(tmp_path, "commit", "-m", "Initial commit")

    first_file.write_text("selected\n", encoding="utf-8")
    second_file.write_text("not selected\n", encoding="utf-8")
    run_git(tmp_path, "add", "--", "second.txt")

    result = GitService(1, "Test", str(tmp_path)).commit(["first.txt"], "Update first")

    assert result.branch == "main"
    assert result.files == ["first.txt"]
    assert run_git(tmp_path, "show", "--pretty=", "--name-only", "HEAD").stdout.strip() == "first.txt"
    remaining = GitService(1, "Test", str(tmp_path)).status().changed_files
    assert [file.path for file in remaining] == ["second.txt"]
    assert remaining[0].staged is True


def test_pushes_current_branch_to_origin_without_force(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    remote = tmp_path / "remote.git"
    repository.mkdir()
    run_git(tmp_path, "init", "--bare", str(remote))
    initialize_repository(repository)
    (repository / "app.py").write_text("print('v1')\n", encoding="utf-8")
    run_git(repository, "add", "--", "app.py")
    run_git(repository, "commit", "-m", "Initial")
    run_git(repository, "remote", "add", "origin", str(remote))

    service = GitService(1, "Test", str(repository))
    preview = service.push_preview()
    assert preview.branch == "main"
    assert preview.ahead == 1
    assert preview.upstream_exists is False

    result = service.push()
    assert result.pushed is True
    assert run_git(remote, "rev-parse", "refs/heads/main").stdout.strip() == run_git(
        repository, "rev-parse", "HEAD"
    ).stdout.strip()
    assert service.push_preview().ahead == 0
