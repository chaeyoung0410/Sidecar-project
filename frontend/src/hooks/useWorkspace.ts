import { useCallback, useEffect, useState } from 'react'
import {
  commitChanges as commitChangesRequest,
  getGitStatus,
  getPullPreview,
  getPushPreview,
  pullCurrentBranch,
  pushCurrentBranch,
  refreshRemoteStatus as refreshRemoteStatusRequest,
  suggestCommitMessages,
} from '../services/gitApi'
import {
  createProject as createProjectRequest,
  deleteProject as deleteProjectRequest,
  listProjects,
  selectProject as selectProjectRequest,
  updateProject as updateProjectRequest,
} from '../services/projectApi'
import type { GitRemoteStatus, GitStatus } from '../types/git'
import type { Project, ProjectCreate } from '../types/project'

export function useWorkspace() {
  const [projects, setProjects] = useState<Project[]>([])
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [remoteStatus, setRemoteStatus] = useState<GitRemoteStatus | null>(null)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gitError, setGitError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    setRemoteStatus(null)
    setRemoteError(null)
    try {
      const loadedProjects = await listProjects()
      setProjects(loadedProjects)
      const selectedProject = loadedProjects.find((project) => project.is_selected)

      if (selectedProject) {
        try {
          setGitStatus(await getGitStatus())
          setGitError(null)
        } catch (requestError) {
          setGitStatus(null)
          setGitError(requestError instanceof Error ? requestError.message : 'Unable to read Git status')
        }
      } else {
        setGitStatus(null)
        setRemoteStatus(null)
        setGitError(null)
      }
    } catch (requestError) {
      setProjects([])
      setGitStatus(null)
      setRemoteStatus(null)
      setError(requestError instanceof Error ? requestError.message : 'Unable to load projects')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createProject = useCallback(async (payload: ProjectCreate) => {
    await createProjectRequest(payload)
    await refresh()
  }, [refresh])

  const selectProject = useCallback(async (projectId: number) => {
    await selectProjectRequest(projectId)
    await refresh()
  }, [refresh])

  const deleteProject = useCallback(async (projectId: number) => {
    await deleteProjectRequest(projectId)
    await refresh()
  }, [refresh])

  const updateProject = useCallback(async (projectId: number, name: string) => {
    await updateProjectRequest(projectId, { name })
    await refresh()
  }, [refresh])

  const commitChanges = useCallback(async (files: string[], message: string) => {
    const result = await commitChangesRequest(files, message)
    await refresh()
    return result
  }, [refresh])

  const pushChanges = useCallback(async () => {
    const result = await pushCurrentBranch()
    await refresh()
    return result
  }, [refresh])

  const pullChanges = useCallback(async () => {
    const result = await pullCurrentBranch()
    await refresh()
    return result
  }, [refresh])

  const refreshRemoteStatus = useCallback(async () => {
    setRemoteLoading(true)
    try {
      const result = await refreshRemoteStatusRequest()
      setRemoteStatus(result)
      setRemoteError(null)
      return result
    } catch (requestError) {
      setRemoteError(requestError instanceof Error ? requestError.message : 'Remote Repository 정보를 가져오지 못했습니다.')
      throw requestError
    } finally {
      setRemoteLoading(false)
    }
  }, [])

  return {
    projects,
    currentProject: projects.find((project) => project.is_selected) ?? null,
    gitStatus,
    remoteStatus,
    remoteLoading,
    remoteError,
    loading,
    error,
    gitError,
    refresh,
    createProject,
    selectProject,
    updateProject,
    deleteProject,
    commitChanges,
    suggestCommitMessages,
    getPushPreview,
    pushChanges,
    getPullPreview,
    pullChanges,
    refreshRemoteStatus,
  }
}
