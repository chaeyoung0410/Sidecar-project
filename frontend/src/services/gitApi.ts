import { apiRequest } from './api'
import type { GitCommitResult, GitPushPreview, GitPushResult, GitStatus } from '../types/git'

export function getGitStatus(): Promise<GitStatus> {
  return apiRequest<GitStatus>('/api/git/status')
}

export function commitChanges(files: string[], message: string): Promise<GitCommitResult> {
  return apiRequest<GitCommitResult>('/api/git/commit', {
    method: 'POST',
    body: JSON.stringify({ files, message, confirmed: true }),
  })
}

export function getPushPreview(): Promise<GitPushPreview> {
  return apiRequest<GitPushPreview>('/api/git/push-preview')
}

export function pushCurrentBranch(): Promise<GitPushResult> {
  return apiRequest<GitPushResult>('/api/git/push', {
    method: 'POST',
    body: JSON.stringify({ confirmed: true }),
  })
}
