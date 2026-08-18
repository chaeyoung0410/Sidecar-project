import { apiRequest } from './api'
import type { ErrorHistory } from '../types/error'

export function listErrors(): Promise<ErrorHistory[]> {
  return apiRequest<ErrorHistory[]>('/api/errors')
}

export function getError(errorId: number): Promise<ErrorHistory> {
  return apiRequest<ErrorHistory>(`/api/errors/${errorId}`)
}
