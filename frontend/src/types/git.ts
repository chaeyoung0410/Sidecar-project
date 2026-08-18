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

export interface GitPushPreview {
  repository: string
  branch: string
  remote: 'origin'
  ahead: number
  upstream_exists: boolean
}

export interface GitPushResult {
  repository: string
  branch: string
  remote: 'origin'
  pushed: boolean
  message: string
}
