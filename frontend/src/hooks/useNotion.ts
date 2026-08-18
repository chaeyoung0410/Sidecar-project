import { useCallback, useEffect, useState } from 'react'
import { createNotionLog, getNotionStatus, listNotionLogs } from '../services/notionApi'
import type { NotionLog, NotionLogInput, NotionStatus } from '../types/notion'

export function useNotion() {
  const [status, setStatus] = useState<NotionStatus | null>(null)
  const [logs, setLogs] = useState<NotionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [nextStatus, nextLogs] = await Promise.all([getNotionStatus(), listNotionLogs()])
      setStatus(nextStatus)
      setLogs(nextLogs)
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load Notion status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const save = useCallback(async (input: NotionLogInput) => {
    setSaving(true)
    setError(null)
    try {
      const created = await createNotionLog(input)
      setLogs((current) => [created, ...current].slice(0, 8))
      return created
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to save to Notion'
      setError(message)
      throw requestError
    } finally {
      setSaving(false)
    }
  }, [])

  return { status, logs, loading, saving, error, refresh, save }
}
