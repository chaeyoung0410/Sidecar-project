import { apiRequest } from './api'
import type { CommitMessageSuggestions, GitCommitResult, GitPullPreview, GitPullResult, GitPushPreview, GitPushResult, GitStatus } from '../types/git'

export function getGitStatus(): Promise<GitStatus> {
  return apiRequest<GitStatus>('/api/git/status')
}

export function commitChanges(files: string[], message: string): Promise<GitCommitResult> {
  return apiRequest<GitCommitResult>('/api/git/commit', {
    method: 'POST',
    body: JSON.stringify({ files, message, confirmed: true }),
  })
}

export function suggestCommitMessages(files: string[], language: 'en' | 'ko' = 'en'): Promise<CommitMessageSuggestions> {
  return apiRequest<CommitMessageSuggestions>('/api/git/commit-message/suggest', {
    method: 'POST',
    body: JSON.stringify({ files, language }),
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

export function getPullPreview(): Promise<GitPullPreview> {
  return apiRequest<GitPullPreview>('/api/git/pull-preview')
}

export function pullCurrentBranch(): Promise<GitPullResult> {
  return apiRequest<GitPullResult>('/api/git/pull', {
    method: 'POST',
    body: JSON.stringify({ confirmed: true }),
  })
}
