import subprocess
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.git_service import GitService, GitServiceError, NotGitRepositoryError


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


def initialize_remote_pair(tmp_path: Path) -> tuple[Path, Path]:
    remote = tmp_path / "remote.git"
    source = tmp_path / "source"
    local = tmp_path / "local"
    source.mkdir()
    run_git(tmp_path, "init", "--bare", str(remote))
    initialize_repository(source)
    (source / "app.txt").write_text("initial\n", encoding="utf-8")
    run_git(source, "add", "--", "app.txt")
    run_git(source, "commit", "-m", "Initial")
    run_git(source, "remote", "add", "origin", str(remote))
    run_git(source, "push", "-u", "origin", "main")
    run_git(tmp_path, "clone", "--branch", "main", str(remote), str(local))
    run_git(local, "config", "user.name", "CodePad Test")
    run_git(local, "config", "user.email", "codepad@example.test")
    return source, local


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


def test_diff_context_only_contains_selected_files_and_is_bounded(tmp_path: Path) -> None:
    initialize_repository(tmp_path)
    selected = tmp_path / "selected.txt"
    excluded = tmp_path / "excluded.txt"
    selected.write_text("initial\n", encoding="utf-8")
    excluded.write_text("private initial\n", encoding="utf-8")
    run_git(tmp_path, "add", "--", "selected.txt", "excluded.txt")
    run_git(tmp_path, "commit", "-m", "Initial")
    selected.write_text("initial\nselected change\n", encoding="utf-8")
    excluded.write_text("private secret change\n", encoding="utf-8")

    service = GitService(1, "Test", str(tmp_path))
    context = service.diff_context(["selected.txt"], max_characters=500)

    assert context.files == ["selected.txt"]
    assert "selected change" in context.diff
    assert "private secret change" not in context.diff
    assert context.additions == 1
    assert context.truncated is False

    bounded = service.diff_context(["selected.txt"], max_characters=80)
    assert bounded.truncated is True
    assert "[Diff truncated by CodePad]" in bounded.diff
    assert len(bounded.diff) <= 80


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


def test_remote_status_fetches_and_push_blocks_diverged_branch(tmp_path: Path) -> None:
    source, local = initialize_remote_pair(tmp_path)
    (local / "local.txt").write_text("local\n", encoding="utf-8")
    run_git(local, "add", "local.txt")
    run_git(local, "commit", "-m", "Local only")
    (source / "remote.txt").write_text("remote\n", encoding="utf-8")
    run_git(source, "add", "remote.txt")
    run_git(source, "commit", "-m", "Remote only")
    run_git(source, "push", "origin", "main")

    service = GitService(1, "Test", str(local))
    remote = service.remote_status()

    assert remote.ahead == 1
    assert remote.behind == 1
    assert remote.diverged is True
    assert remote.up_to_date is False
    with pytest.raises(GitServiceError, match="Remote에 Local에 없는 Commit"):
        service.push()


def test_remote_fetch_failure_is_classified(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    initialize_repository(repository)
    (repository / "app.txt").write_text("initial\n", encoding="utf-8")
    run_git(repository, "add", "app.txt")
    run_git(repository, "commit", "-m", "Initial")
    run_git(repository, "remote", "add", "origin", str(tmp_path / "missing.git"))

    with pytest.raises(GitServiceError, match="Remote Repository 정보를 가져오지 못했습니다"):
        GitService(1, "Test", str(repository)).remote_status()


def test_remote_refresh_api_returns_structured_status(tmp_path: Path) -> None:
    _, local = initialize_remote_pair(tmp_path)
    with TestClient(app) as client:
        assert client.post(
            "/api/projects", json={"name": "Remote project", "path": str(local)}
        ).status_code == 201
        response = client.post("/api/git/remote/refresh")

    assert response.status_code == 200
    payload = response.json()
    assert payload["remote"] == "origin"
    assert payload["ahead"] == 0
    assert payload["behind"] == 0
    assert payload["up_to_date"] is True
    assert payload["last_fetched_at"]


def test_pulls_remote_commit_and_reports_already_up_to_date(tmp_path: Path) -> None:
    source, local = initialize_remote_pair(tmp_path)
    (source / "app.txt").write_text("remote update\n", encoding="utf-8")
    run_git(source, "commit", "-am", "Remote update")
    run_git(source, "push", "origin", "main")

    service = GitService(1, "Test", str(local))
    preview = service.pull_preview()
    assert preview.branch == "main"
    assert preview.changed_files == []
    assert preview.ahead == 0
    assert preview.behind == 1
    assert preview.diverged is False

    with patch.object(service, "_run", wraps=service._run) as git_run:
        result = service.pull()
    assert result.success is True
    assert result.conflict is False
    assert result.already_up_to_date is False
    assert result.fast_forward is True
    assert result.diverged is False
    assert any(call.args[:4] == ("pull", "--ff-only", "origin", "main") for call in git_run.call_args_list)
    assert result.commits == 1
    assert result.files_changed == 1
    assert (local / "app.txt").read_text(encoding="utf-8") == "remote update\n"

    current = service.pull()
    assert current.success is True
    assert current.already_up_to_date is True
    assert current.fast_forward is True


def test_pull_preview_reports_local_changes(tmp_path: Path) -> None:
    _, local = initialize_remote_pair(tmp_path)
    (local / "app.txt").write_text("local edit\n", encoding="utf-8")
    (local / "untracked.txt").write_text("new\n", encoding="utf-8")

    preview = GitService(1, "Test", str(local)).pull_preview()

    assert {file.path for file in preview.changed_files} == {"app.txt", "untracked.txt"}
    assert any(file.unstaged for file in preview.changed_files)
    assert any(file.status == "?" for file in preview.changed_files)


def test_pull_blocks_diverged_branch_without_modifying_worktree(tmp_path: Path) -> None:
    source, local = initialize_remote_pair(tmp_path)
    (local / "app.txt").write_text("local commit\n", encoding="utf-8")
    run_git(local, "commit", "-am", "Local update")
    (source / "app.txt").write_text("remote commit\n", encoding="utf-8")
    run_git(source, "commit", "-am", "Remote update")
    run_git(source, "push", "origin", "main")

    before = run_git(local, "rev-parse", "HEAD").stdout.strip()
    result = GitService(1, "Test", str(local)).pull()

    assert result.success is False
    assert result.diverged is True
    assert result.conflict is False
    assert result.fast_forward is False
    assert run_git(local, "rev-parse", "HEAD").stdout.strip() == before
    assert run_git(local, "status", "--porcelain").stdout == ""


def test_pull_blocks_existing_merge_conflict(tmp_path: Path) -> None:
    source, local = initialize_remote_pair(tmp_path)
    (local / "app.txt").write_text("local commit\n", encoding="utf-8")
    run_git(local, "commit", "-am", "Local update")
    (source / "app.txt").write_text("remote commit\n", encoding="utf-8")
    run_git(source, "commit", "-am", "Remote update")
    run_git(source, "push", "origin", "main")
    run_git(local, "fetch", "origin")
    merge = subprocess.run(
        ["git", "merge", "origin/main"], cwd=local, check=False, capture_output=True, text=True
    )
    assert merge.returncode != 0

    result = GitService(1, "Test", str(local)).pull()

    assert result.success is False
    assert result.conflict is True
    assert result.conflict_files == ["app.txt"]
    assert result.diverged is False


def test_pull_rejects_missing_origin_and_non_repository(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    initialize_repository(repository)
    (repository / "app.txt").write_text("initial\n", encoding="utf-8")
    run_git(repository, "add", "--", "app.txt")
    run_git(repository, "commit", "-m", "Initial")

    with pytest.raises(GitServiceError):
        GitService(1, "Test", str(repository)).pull_preview()

    plain_directory = tmp_path / "plain"
    plain_directory.mkdir()
    with pytest.raises(NotGitRepositoryError):
        GitService(1, "Plain", str(plain_directory)).pull_preview()
