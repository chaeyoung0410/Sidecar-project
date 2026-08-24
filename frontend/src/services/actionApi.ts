import { apiRequest } from './api'
import type { DashboardAction, DashboardActionInput } from '../types/action'

export function listActions(): Promise<DashboardAction[]> {
  return apiRequest<DashboardAction[]>('/api/actions')
}

export function createAction(payload: DashboardActionInput): Promise<DashboardAction> {
  return apiRequest<DashboardAction>('/api/actions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateAction(actionId: number, payload: DashboardActionInput): Promise<DashboardAction> {
  return apiRequest<DashboardAction>(`/api/actions/${actionId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteAction(actionId: number): Promise<void> {
  return apiRequest<void>(`/api/actions/${actionId}`, { method: 'DELETE' })
}

export function reorderActions(actionIds: number[]): Promise<DashboardAction[]> {
  return apiRequest<DashboardAction[]>('/api/actions/reorder', {
    method: 'POST',
    body: JSON.stringify({ action_ids: actionIds }),
  })
}
