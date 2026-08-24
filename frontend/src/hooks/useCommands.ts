import { useCallback, useEffect, useState } from 'react'
import {
  createCommand as createCommandRequest,
  deleteCommand as deleteCommandRequest,
  listCommandRuns,
  listCommands,
  runCommand as runCommandRequest,
  stopCommand as stopCommandRequest,
  updateCommand as updateCommandRequest,
} from '../services/commandApi'
import type { CommandRun, SavedCommand, SavedCommandInput } from '../types/command'

const POLL_INTERVAL_MS = 1_500

export function useCommands() {
  const [commands, setCommands] = useState<SavedCommand[]>([])
  const [runs, setRuns] = useState<CommandRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [savedCommands, recentRuns] = await Promise.all([listCommands(), listCommandRuns()])
      setCommands(savedCommands)
      setRuns(recentRuns)
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load commands')
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshRuns = useCallback(async () => {
    try {
      setRuns(await listCommandRuns())
    } catch {
      // Preserve the latest output when a polling request briefly fails.
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const hasActiveRun = runs.some((run) => run.status === 'queued' || run.status === 'running')
  useEffect(() => {
    if (!hasActiveRun) return
    const interval = window.setInterval(() => void refreshRuns(), POLL_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [hasActiveRun, refreshRuns])

  const createCommand = useCallback(async (payload: SavedCommandInput) => {
    await createCommandRequest(payload)
    await refresh()
  }, [refresh])

  const updateCommand = useCallback(async (commandId: number, payload: SavedCommandInput) => {
    await updateCommandRequest(commandId, payload)
    await refresh()
  }, [refresh])

  const deleteCommand = useCallback(async (commandId: number) => {
    await deleteCommandRequest(commandId)
    await refresh()
  }, [refresh])

  const runCommand = useCallback(async (commandId: number) => {
    const run = await runCommandRequest(commandId)
    setRuns((current) => [run, ...current.filter((item) => item.id !== run.id)])
    return run
  }, [])

  const stopCommand = useCallback(async (runId: number) => {
    const run = await stopCommandRequest(runId)
    setRuns((current) => current.map((item) => item.id === run.id ? run : item))
    return run
  }, [])

  return { commands, runs, loading, error, createCommand, updateCommand, deleteCommand, runCommand, stopCommand }
}
