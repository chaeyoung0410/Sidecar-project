import { apiRequest } from './api'
import type { NotionLog, NotionLogInput, NotionStatus } from '../types/notion'

export function getNotionStatus(): Promise<NotionStatus> {
  return apiRequest('/api/notion/status')
}

export function listNotionLogs(): Promise<NotionLog[]> {
  return apiRequest('/api/notion/logs?limit=8')
}

export function createNotionLog(input: NotionLogInput): Promise<NotionLog> {
  return apiRequest('/api/notion/logs', {
    method: 'POST',
    body: JSON.stringify({ ...input, confirmed: true }),
  })
}
