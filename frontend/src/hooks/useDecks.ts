import { useCallback, useEffect, useState } from 'react'
import * as deckApi from '../services/deckApi'
import type { Deck, DeckInput } from '../types/deck'

export function useDecks(projectId: number | null) {
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (projectId === null) {
      setDecks([])
      setError(null)
      return
    }
    setLoading(true)
    try {
      setDecks(await deckApi.listDecks())
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Deck을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void refresh() }, [refresh])

  const mutate = useCallback(async (operation: () => Promise<unknown>) => {
    await operation()
    await refresh()
  }, [refresh])

  const create = useCallback((payload: DeckInput) => mutate(() => deckApi.createDeck(payload)), [mutate])
  const update = useCallback((deckId: number, payload: DeckInput) => mutate(() => deckApi.updateDeck(deckId, payload)), [mutate])
  const remove = useCallback((deckId: number) => mutate(() => deckApi.deleteDeck(deckId)), [mutate])
  const addAction = useCallback((deckId: number, actionId: number) => mutate(() => deckApi.addDeckAction(deckId, actionId)), [mutate])
  const removeAction = useCallback((deckId: number, actionId: number) => mutate(() => deckApi.removeDeckAction(deckId, actionId)), [mutate])

  const moveDeck = useCallback(async (deckId: number, direction: -1 | 1) => {
    const index = decks.findIndex((deck) => deck.id === deckId)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= decks.length) return
    const reordered = [...decks]
    ;[reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]]
    setDecks(reordered)
    try { setDecks(await deckApi.reorderDecks(reordered.map((deck) => deck.id))) }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Deck 순서를 저장하지 못했습니다.'); await refresh() }
  }, [decks, refresh])

  const moveAction = useCallback(async (deckId: number, actionId: number, direction: -1 | 1) => {
    const deck = decks.find((item) => item.id === deckId)
    if (!deck) return
    const index = deck.actions.findIndex((action) => action.id === actionId)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= deck.actions.length) return
    const reordered = [...deck.actions]
    ;[reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]]
    setDecks((current) => current.map((item) => item.id === deckId ? { ...item, actions: reordered } : item))
    try {
      const updated = await deckApi.reorderDeckActions(deckId, reordered.map((action) => action.id))
      setDecks((current) => current.map((item) => item.id === deckId ? updated : item))
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Action 순서를 저장하지 못했습니다.'); await refresh() }
  }, [decks, refresh])

  return { decks, loading, error, refresh, create, update, remove, moveDeck, addAction, removeAction, moveAction }
}
