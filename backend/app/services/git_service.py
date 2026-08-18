import subprocess
import os
from datetime import datetime
from pathlib import Path

from app.schemas import (
    ChangedFile,
    GitCommitResponse,
    GitPushPreview,
    GitPushResponse,
    GitStatusResponse,
    JournalCommit,
)


class GitServiceError(RuntimeError):
    pass


class NotGitRepositoryError(GitServiceError):
    pass


class GitService:
    def __init__(self, project_id: int, project_name: str, project_path: str) -> None:
        self.project_id = project_id
        self.project_name = project_name
        self.project_path = Path(project_path)

    def status(self) -> GitStatusResponse:
        repository_check = self._run("rev-parse", "--is-inside-work-tree")
        if repository_check.stdout.strip() != "true":
            raise NotGitRepositoryError("Selected project is not a Git repository")

        branch_result = self._run("branch", "--show-current")
        branch = branch_result.stdout.strip()
        if not branch:
            branch = self._run("rev-parse", "--short", "HEAD").stdout.strip()
            branch = f"detached@{branch}"

        status_output = self._run(
            "-c",
            "core.quotepath=false",
            "status",
            "--porcelain=v1",
            "-z",
            "--untracked-files=all",
        ).stdout

        return GitStatusResponse(
            project_id=self.project_id,
            repository=self.project_name,
            branch=branch,
            changed_files=self.parse_porcelain(status_output),
        )

    def commit(self, files: list[str], message: str) -> GitCommitResponse:
        clean_message = message.strip()
        if not clean_message:
            raise GitServiceError("Commit message cannot be empty")

        current_status = self.status()
        changed_files = {file.path: file for file in current_status.changed_files}
        selected_paths = list(dict.fromkeys(files))
        unknown_paths = [path for path in selected_paths if path not in changed_files]
        if unknown_paths:
            raise GitServiceError(f"Files are no longer changed: {', '.join(unknown_paths)}")

        pathspecs: list[str] = []
        for path in selected_paths:
            changed_file = changed_files[path]
            pathspecs.append(path)
            if changed_file.original_path:
                pathspecs.append(changed_file.original_path)
        pathspecs = list(dict.fromkeys(pathspecs))

        self._run("add", "--", *pathspecs)
        self._run("commit", "--only", "-m", clean_message, "--", *pathspecs)
        commit_hash = self._run("rev-parse", "--short", "HEAD").stdout.strip()

        return GitCommitResponse(
            commit=commit_hash,
            branch=self._current_branch(),
            message=clean_message,
            files=selected_paths,
        )

    def push_preview(self) -> GitPushPreview:
        branch = self._current_branch()
        self._run("remote", "get-url", "origin")
        remote_ref = f"refs/remotes/origin/{branch}"
        upstream_exists = self._run(
            "show-ref", "--verify", "--quiet", remote_ref, check=False
        ).returncode == 0

        if upstream_exists:
            ahead_output = self._run(
                "rev-list", "--count", f"origin/{branch}..HEAD"
            ).stdout.strip()
        else:
            ahead_output = self._run("rev-list", "--count", "HEAD").stdout.strip()

        return GitPushPreview(
            repository=self.project_name,
            branch=branch,
            ahead=int(ahead_output or "0"),
            upstream_exists=upstream_exists,
        )

    def push(self) -> GitPushResponse:
        preview = self.push_preview()
        if preview.ahead == 0:
            return GitPushResponse(
                repository=self.project_name,
                branch=preview.branch,
                pushed=False,
                message="Current branch is already up to date",
            )

        arguments = ["push"]
        if not preview.upstream_exists:
            arguments.append("--set-upstream")
        arguments.extend(["origin", preview.branch])
        result = self._run(*arguments, timeout=120)

        return GitPushResponse(
            repository=self.project_name,
            branch=preview.branch,
            pushed=True,
            message=result.stderr.strip() or result.stdout.strip() or "Push completed",
        )

    def recent_commits(
        self,
        since: datetime,
        until: datetime,
        limit: int = 20,
    ) -> list[JournalCommit]:
        result = self._run(
            "log",
            f"--since={since.isoformat()}",
            f"--until={until.isoformat()}",
            f"--max-count={limit}",
            "--pretty=format:%H%x1f%s%x1e",
        )
        commits: list[JournalCommit] = []
        for record in result.stdout.split("\x1e"):
            record = record.strip()
            if not record or "\x1f" not in record:
                continue
            commit_hash, message = record.split("\x1f", 1)
            files_result = self._run(
                "show",
                "--pretty=format:",
                "--name-only",
                "-z",
                commit_hash,
            )
            files = [path for path in files_result.stdout.split("\0") if path]
            commits.append(JournalCommit(commit=commit_hash[:12], message=message.strip(), files=files))
        return commits

    @staticmethod
    def parse_porcelain(output: str) -> list[ChangedFile]:
        entries = output.split("\0")
        files: list[ChangedFile] = []
        index = 0

        while index < len(entries):
            entry = entries[index]
            index += 1
            if not entry or len(entry) < 4:
                continue

            xy = entry[:2]
            path = entry[3:]
            original_path: str | None = None

            if "R" in xy or "C" in xy:
                if index < len(entries) and entries[index]:
                    original_path = entries[index]
                    index += 1

            index_status, worktree_status = xy
            display_status = "?" if xy == "??" else (
                index_status if index_status != " " else worktree_status
            )
            files.append(
                ChangedFile(
                    path=path,
                    status=display_status,
                    staged=index_status not in {" ", "?"},
                    unstaged=worktree_status != " ",
                    original_path=original_path,
                )
            )

        return files

    def _current_branch(self) -> str:
        branch = self._run("branch", "--show-current").stdout.strip()
        if not branch:
            raise GitServiceError("Cannot push or commit while HEAD is detached")
        return branch

    def _run(
        self,
        *arguments: str,
        timeout: int = 10,
        check: bool = True,
    ) -> subprocess.CompletedProcess[str]:
        try:
            environment = os.environ.copy()
            environment["GIT_TERMINAL_PROMPT"] = "0"
            result = subprocess.run(
                ["git", *arguments],
                cwd=self.project_path,
                capture_output=True,
                text=True,
                check=False,
                timeout=timeout,
                env=environment,
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            raise GitServiceError("Unable to run Git command") from error

        if check and result.returncode != 0:
            message = result.stderr.strip() or "Git command failed"
            if "not a git repository" in message.lower():
                raise NotGitRepositoryError("Selected project is not a Git repository")
            raise GitServiceError(message)

        return result
