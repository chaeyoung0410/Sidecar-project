import { apiRequest } from './api'
import type { HealthResponse } from '../types/health'

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/api/health', { signal })
}
