import subprocess
import os
import re
from datetime import UTC, datetime
from pathlib import Path

from app.schemas import (
    ChangedFile,
    GitCommitResponse,
    GitDiffContext,
    GitPullPreview,
    GitPullResponse,
    GitPushPreview,
    GitPushResponse,
    GitRemoteStatus,
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

    def diff_context(self, files: list[str], max_characters: int = 30_000) -> GitDiffContext:
        current_status = self.status()
        changed_files = {file.path: file for file in current_status.changed_files}
        selected_paths = list(dict.fromkeys(files))
        if not selected_paths:
            raise GitServiceError("Select at least one changed file")
        unknown_paths = [path for path in selected_paths if path not in changed_files]
        if unknown_paths:
            raise GitServiceError(f"Files are no longer changed: {', '.join(unknown_paths)}")

        tracked_paths: list[str] = []
        untracked_paths: list[str] = []
        for path in selected_paths:
            changed = changed_files[path]
            if changed.status == "?":
                untracked_paths.append(path)
            else:
                tracked_paths.append(path)
                if changed.original_path:
                    tracked_paths.append(changed.original_path)

        parts: list[str] = []
        if tracked_paths:
            unique_tracked_paths = list(dict.fromkeys(tracked_paths))
            head_exists = self._run("rev-parse", "--verify", "HEAD", check=False).returncode == 0
            if head_exists:
                results = [self._run(
                    "diff", "--no-ext-diff", "--unified=3", "HEAD", "--",
                    *unique_tracked_paths, check=False,
                )]
            else:
                results = [
                    self._run("diff", "--no-ext-diff", "--cached", "--unified=3", "--", *unique_tracked_paths, check=False),
                    self._run("diff", "--no-ext-diff", "--unified=3", "--", *unique_tracked_paths, check=False),
                ]
            for result in results:
                if result.returncode not in {0, 1}:
                    raise GitServiceError(result.stderr.strip() or "Unable to create Git diff")
                parts.append(result.stdout)
        for path in untracked_paths:
            result = self._run(
                "diff", "--no-ext-diff", "--no-index", "--unified=3", "--", "/dev/null", path,
                check=False,
            )
            if result.returncode not in {0, 1}:
                raise GitServiceError(result.stderr.strip() or f"Unable to read diff for {path}")
            parts.append(result.stdout)

        full_diff = "\n".join(part for part in parts if part)
        additions = sum(1 for line in full_diff.splitlines() if line.startswith("+") and not line.startswith("+++"))
        deletions = sum(1 for line in full_diff.splitlines() if line.startswith("-") and not line.startswith("---"))
        truncated = len(full_diff) > max_characters
        diff = full_diff[:max_characters]
        if truncated:
            marker = "\n\n[Diff truncated by CodePad]"
            diff = full_diff[:max(0, max_characters - len(marker))] + marker
        return GitDiffContext(
            branch=current_status.branch,
            files=selected_paths,
            diff=diff,
            additions=additions,
            deletions=deletions,
            truncated=truncated,
        )

    def remote_status(self, fetch: bool = True) -> GitRemoteStatus:
        branch = self._current_branch("inspect Remote status")
        self._run("remote", "get-url", "origin")
        fetched_at = self._fetch_origin() if fetch else datetime.now(UTC)
        remote_ref = f"refs/remotes/origin/{branch}"
        upstream_exists = self._run("show-ref", "--verify", "--quiet", remote_ref, check=False).returncode == 0
        if upstream_exists:
            counts = self._run("rev-list", "--left-right", "--count", f"HEAD...origin/{branch}").stdout.split()
            ahead, behind = (int(counts[0]), int(counts[1])) if len(counts) == 2 else (0, 0)
        else:
            ahead = int(self._run("rev-list", "--count", "HEAD").stdout.strip() or "0")
            behind = 0
        return GitRemoteStatus(
            repository=self.project_name,
            branch=branch,
            ahead=ahead,
            behind=behind,
            diverged=ahead > 0 and behind > 0,
            up_to_date=upstream_exists and ahead == 0 and behind == 0,
            upstream_exists=upstream_exists,
            last_fetched_at=fetched_at,
        )

    def push_preview(self) -> GitPushPreview:
        remote = self.remote_status(fetch=True)
        return GitPushPreview(
            repository=self.project_name,
            branch=remote.branch,
            ahead=remote.ahead,
            behind=remote.behind,
            diverged=remote.diverged,
            up_to_date=remote.up_to_date,
            upstream_exists=remote.upstream_exists,
            last_fetched_at=remote.last_fetched_at,
        )

    def push(self) -> GitPushResponse:
        preview = self.push_preview()
        if preview.behind > 0:
            raise GitServiceError(
                "Remote에 Local에 없는 Commit이 있습니다. Git Pull 또는 직접 Merge/Rebase한 후 다시 시도해주세요."
            )
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

    def pull_preview(self) -> GitPullPreview:
        remote = self.remote_status(fetch=True)
        current_status = self.status()
        conflict_files = self._conflict_files()
        return GitPullPreview(
            repository=self.project_name,
            branch=remote.branch,
            changed_files=current_status.changed_files,
            conflict_files=conflict_files,
            ahead=remote.ahead,
            behind=remote.behind,
            diverged=remote.diverged,
            up_to_date=remote.up_to_date,
            upstream_exists=remote.upstream_exists,
            last_fetched_at=remote.last_fetched_at,
        )

    def pull(self) -> GitPullResponse:
        preview = self.pull_preview()
        if preview.conflict_files:
            return GitPullResponse(
                success=False,
                repository=self.project_name,
                branch=preview.branch,
                message="Merge Conflict 해결이 필요합니다. Git Pull 전에 충돌 파일을 먼저 해결해주세요.",
                stdout="",
                stderr="",
                conflict=True,
                conflict_files=preview.conflict_files,
                already_up_to_date=False,
                fast_forward=False,
                diverged=False,
            )
        if preview.diverged:
            return GitPullResponse(
                success=False,
                repository=self.project_name,
                branch=preview.branch,
                message="Local Branch와 Remote Branch의 기록이 분기되어 있습니다. Mac에서 Merge 또는 Rebase 방식을 직접 선택해주세요.",
                stdout="",
                stderr="",
                conflict=False,
                conflict_files=[],
                already_up_to_date=False,
                fast_forward=False,
                diverged=True,
            )
        if not preview.upstream_exists:
            raise GitServiceError(f"Remote Branch origin/{preview.branch}를 찾을 수 없습니다.")
        if preview.behind == 0:
            return GitPullResponse(
                success=True,
                repository=self.project_name,
                branch=preview.branch,
                message="Already up to date",
                stdout="",
                stderr="",
                conflict=False,
                conflict_files=[],
                already_up_to_date=True,
                fast_forward=True,
                diverged=False,
            )
        before = self._run("rev-parse", "HEAD").stdout.strip()
        result = self._run(
            "pull",
            "--ff-only",
            "origin",
            preview.branch,
            timeout=120,
            check=False,
        )
        output = "\n".join(part for part in (result.stdout, result.stderr) if part)
        conflict_files = self._conflict_files() if result.returncode != 0 else []
        diverged = result.returncode != 0 and self.remote_status(fetch=False).diverged

        already_up_to_date = any(
            phrase in output.lower()
            for phrase in ("already up to date", "already up-to-date")
        )
        files_changed, insertions, deletions = self._parse_pull_summary(output)
        commits = 0
        if result.returncode == 0:
            after = self._run("rev-parse", "HEAD").stdout.strip()
            if before != after:
                commits = int(self._run("rev-list", "--count", f"{before}..{after}").stdout.strip() or "0")

        conflict = bool(conflict_files)
        if conflict:
            message = "Merge conflict detected"
        elif diverged:
            message = "Local Branch와 Remote Branch의 기록이 분기되어 있습니다. Mac에서 Merge 또는 Rebase 방식을 직접 선택해주세요."
        elif result.returncode != 0:
            message = result.stderr.strip() or result.stdout.strip() or "Git Pull failed"
        elif already_up_to_date:
            message = "Already up to date"
        else:
            message = "Git Pull completed"

        return GitPullResponse(
            success=result.returncode == 0,
            repository=self.project_name,
            branch=preview.branch,
            message=message,
            stdout=result.stdout.strip(),
            stderr=result.stderr.strip(),
            conflict=conflict,
            conflict_files=conflict_files,
            already_up_to_date=already_up_to_date,
            fast_forward=result.returncode == 0,
            diverged=diverged,
            commits=commits,
            files_changed=files_changed,
            insertions=insertions,
            deletions=deletions,
        )

    def _fetch_origin(self) -> datetime:
        result = self._run("fetch", "--prune", "origin", timeout=120, check=False)
        if result.returncode != 0:
            detail = result.stderr.strip() or result.stdout.strip() or "Git Fetch failed"
            lowered = detail.lower()
            if any(token in lowered for token in ("authentication failed", "could not read username", "permission denied (publickey)")):
                reason = "Git 인증에 실패했습니다."
            elif any(token in lowered for token in ("could not resolve host", "failed to connect", "network is unreachable", "timed out")):
                reason = "네트워크 연결을 확인해주세요."
            elif "not found" in lowered or "does not appear to be a git repository" in lowered:
                reason = "Remote Repository를 찾을 수 없습니다."
            else:
                reason = "Repository 접근 권한과 Remote 설정을 확인해주세요."
            raise GitServiceError(f"Remote Repository 정보를 가져오지 못했습니다. {reason}\n{detail}")
        return datetime.now(UTC)

    def _conflict_files(self) -> list[str]:
        return [
            path for path in self._run(
                "diff", "--name-only", "--diff-filter=U", "-z", check=False
            ).stdout.split("\0") if path
        ]

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

    @staticmethod
    def _parse_pull_summary(output: str) -> tuple[int, int, int]:
        files_match = re.search(r"(\d+) files? changed", output)
        insertions_match = re.search(r"(\d+) insertions?\(\+\)", output)
        deletions_match = re.search(r"(\d+) deletions?\(-\)", output)
        return (
            int(files_match.group(1)) if files_match else 0,
            int(insertions_match.group(1)) if insertions_match else 0,
            int(deletions_match.group(1)) if deletions_match else 0,
        )

    def _current_branch(self, operation: str = "push or commit") -> str:
        branch = self._run("branch", "--show-current").stdout.strip()
        if not branch:
            raise GitServiceError(f"Cannot {operation} while HEAD is detached")
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
