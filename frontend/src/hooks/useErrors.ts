import { useCallback, useEffect, useState } from 'react'
import { listErrors } from '../services/errorApi'
import type { ErrorHistory } from '../types/error'
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

  return { errors, loading, error, refresh }
}
