import { apiRequest } from './api'
import type { ErrorHistory, ErrorHistoryUpdate } from '../types/error'

export function listErrors(): Promise<ErrorHistory[]> {
  return apiRequest<ErrorHistory[]>('/api/errors')
}

export function getError(errorId: number): Promise<ErrorHistory> {
  return apiRequest<ErrorHistory>(`/api/errors/${errorId}`)
}

export function updateError(errorId: number, payload: ErrorHistoryUpdate): Promise<ErrorHistory> {
  return apiRequest<ErrorHistory>(`/api/errors/${errorId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteError(errorId: number): Promise<void> {
  return apiRequest<void>(`/api/errors/${errorId}`, { method: 'DELETE' })
}
