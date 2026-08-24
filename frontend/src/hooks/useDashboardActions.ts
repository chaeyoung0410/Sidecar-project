import { useCallback, useEffect, useState } from 'react'
import {
  createAction as createActionRequest,
  deleteAction as deleteActionRequest,
  listActions,
  reorderActions,
  updateAction as updateActionRequest,
} from '../services/actionApi'
import type { DashboardAction, DashboardActionInput } from '../types/action'

export function useDashboardActions() {
  const [actions, setActions] = useState<DashboardAction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setActions(await listActions())
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load dashboard actions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createAction = useCallback(async (payload: DashboardActionInput) => {
    await createActionRequest(payload)
    await refresh()
  }, [refresh])

  const updateAction = useCallback(async (actionId: number, payload: DashboardActionInput) => {
    await updateActionRequest(actionId, payload)
    await refresh()
  }, [refresh])

  const deleteAction = useCallback(async (actionId: number) => {
    await deleteActionRequest(actionId)
    await refresh()
  }, [refresh])

  const moveAction = useCallback(async (actionId: number, direction: -1 | 1) => {
    const index = actions.findIndex((action) => action.id === actionId)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= actions.length) return
    const reordered = [...actions]
    ;[reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]]
    setActions(reordered)
    try {
      setActions(await reorderActions(reordered.map((action) => action.id)))
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to reorder actions')
      await refresh()
    }
  }, [actions, refresh])

  return { actions, loading, error, createAction, updateAction, deleteAction, moveAction }
}
