import { useCallback, useEffect, useState } from 'react'
import { deleteError, listErrors, updateError } from '../services/errorApi'
import type { ErrorHistory, ErrorHistoryUpdate } from '../types/error'
import type { AgentEvent } from '../types/health'

export function useErrors() {
  const [errors, setErrors] = useState<ErrorHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setErrors(await listErrors())
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load errors')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const handleAgentEvent = (browserEvent: Event) => {
      const event = (browserEvent as CustomEvent<AgentEvent>).detail
      if (event.type === 'agent.connected') {
        void refresh()
        return
      }
      if (event.type !== 'error.detected' && event.type !== 'error.updated') return

      setErrors((current) => {
        const withoutCurrent = current.filter((item) => item.id !== event.data.id)
        return [event.data, ...withoutCurrent]
          .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
          .slice(0, 50)
      })
    }

    window.addEventListener('codepad:agent-event', handleAgentEvent)
    return () => window.removeEventListener('codepad:agent-event', handleAgentEvent)
  }, [refresh])

  const update = useCallback(async (errorId: number, payload: ErrorHistoryUpdate) => {
    const result = await updateError(errorId, payload)
    setErrors((current) => current.map((item) => item.id === errorId ? result : item))
    return result
  }, [])

  const remove = useCallback(async (errorId: number) => {
    await deleteError(errorId)
    setErrors((current) => current.filter((item) => item.id !== errorId))
  }, [])

  return { errors, loading, error, refresh, update, remove }
}
