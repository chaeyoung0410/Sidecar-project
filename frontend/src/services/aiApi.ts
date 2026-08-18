import { apiRequest } from './api'
import type { AIAnalysis, AIJournalDraft, AIStatus, DevelopmentJournalContext, ErrorAnalysisContext } from '../types/ai'

export function getAIStatus(): Promise<AIStatus> {
  return apiRequest<AIStatus>('/api/ai/status')
}

export function getAnalysisContext(errorId: number): Promise<ErrorAnalysisContext> {
  return apiRequest<ErrorAnalysisContext>(`/api/ai/errors/${errorId}/context`)
}

export function getLatestAnalysis(errorId: number): Promise<AIAnalysis | null> {
  return apiRequest<AIAnalysis | null>(`/api/ai/errors/${errorId}/analysis`)
}

export function analyzeError(errorId: number): Promise<AIAnalysis> {
  return apiRequest<AIAnalysis>(`/api/ai/errors/${errorId}/analyze`, {
    method: 'POST',
    body: JSON.stringify({ confirmed: true }),
  })
}

export function getJournalContext(): Promise<DevelopmentJournalContext> {
  return apiRequest<DevelopmentJournalContext>('/api/ai/journal/context')
}

export function generateJournal(): Promise<AIJournalDraft> {
  return apiRequest<AIJournalDraft>('/api/ai/journal/generate', {
    method: 'POST',
    body: JSON.stringify({ confirmed: true }),
  })
}
