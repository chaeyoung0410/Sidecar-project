import { apiRequest } from './api'
import type { Project, ProjectCreate } from '../types/project'

export function listProjects(): Promise<Project[]> {
  return apiRequest<Project[]>('/api/projects')
}

export function createProject(payload: ProjectCreate): Promise<Project> {
  return apiRequest<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function selectProject(projectId: number): Promise<Project> {
  return apiRequest<Project>(`/api/projects/${projectId}/select`, { method: 'POST' })
}

export function deleteProject(projectId: number): Promise<void> {
  return apiRequest<void>(`/api/projects/${projectId}`, { method: 'DELETE' })
}
