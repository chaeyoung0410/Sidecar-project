export interface ChangedFile {
  path: string
  status: string
  staged: boolean
  unstaged: boolean
  original_path: string | null
}

export interface GitStatus {
  project_id: number
  repository: string
  branch: string
  changed_files: ChangedFile[]
}

export interface GitCommitResult {
  commit: string
  branch: string
  message: string
  files: string[]
}

export interface CommitMessageSuggestions {
  suggestions: string[]
  model: string
  files_analyzed: number
  diff_characters: number
  truncated: boolean
}

export interface GitPushPreview {
  repository: string
  branch: string
  remote: 'origin'
  ahead: number
  behind: number
  diverged: boolean
  up_to_date: boolean
  upstream_exists: boolean
  last_fetched_at: string
}

export type GitRemoteStatus = GitPushPreview

export interface GitPushResult {
  repository: string
  branch: string
  remote: 'origin'
  pushed: boolean
  message: string
}

export interface GitPullPreview {
  repository: string
  branch: string
  remote: 'origin'
  changed_files: ChangedFile[]
  conflict_files: string[]
  ahead: number
  behind: number
  diverged: boolean
  up_to_date: boolean
  upstream_exists: boolean
  last_fetched_at: string
}

export interface GitPullResult {
  success: boolean
  repository: string
  branch: string
  remote: 'origin'
  message: string
  stdout: string
  stderr: string
  conflict: boolean
  conflict_files: string[]
  already_up_to_date: boolean
  fast_forward: boolean
  diverged: boolean
  commits: number
  files_changed: number
  insertions: number
  deletions: number
}
