import { useCallback, useEffect, useState } from 'react'
import {
  commitChanges as commitChangesRequest,
  getGitStatus,
  getPushPreview,
  pushCurrentBranch,
} from '../services/gitApi'
import {
  createProject as createProjectRequest,
  deleteProject as deleteProjectRequest,
  listProjects,
  selectProject as selectProjectRequest,
} from '../services/projectApi'
import type { GitStatus } from '../types/git'
import type { Project, ProjectCreate } from '../types/project'

export function useWorkspace() {
  const [projects, setProjects] = useState<Project[]>([])
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gitError, setGitError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
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
        setGitError(null)
      }
    } catch (requestError) {
      setProjects([])
      setGitStatus(null)
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

  return {
    projects,
    currentProject: projects.find((project) => project.is_selected) ?? null,
    gitStatus,
    loading,
    error,
    gitError,
    refresh,
    createProject,
    selectProject,
    deleteProject,
    commitChanges,
    getPushPreview,
    pushChanges,
  }
}
