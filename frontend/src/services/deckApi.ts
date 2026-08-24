import { apiRequest } from './api'
import type { Deck, DeckInput } from '../types/deck'

export const listDecks = () => apiRequest<Deck[]>('/api/decks')
export const createDeck = (payload: DeckInput) => apiRequest<Deck>('/api/decks', { method: 'POST', body: JSON.stringify(payload) })
export const updateDeck = (deckId: number, payload: DeckInput) => apiRequest<Deck>(`/api/decks/${deckId}`, { method: 'PATCH', body: JSON.stringify(payload) })
export const deleteDeck = (deckId: number) => apiRequest<void>(`/api/decks/${deckId}`, { method: 'DELETE' })
export const reorderDecks = (deckIds: number[]) => apiRequest<Deck[]>('/api/decks/reorder', { method: 'POST', body: JSON.stringify({ deck_ids: deckIds }) })
export const addDeckAction = (deckId: number, actionId: number) => apiRequest<Deck>(`/api/decks/${deckId}/actions`, { method: 'POST', body: JSON.stringify({ action_id: actionId }) })
export const removeDeckAction = (deckId: number, actionId: number) => apiRequest<Deck>(`/api/decks/${deckId}/actions/${actionId}`, { method: 'DELETE' })
export const reorderDeckActions = (deckId: number, actionIds: number[]) => apiRequest<Deck>(`/api/decks/${deckId}/actions/order`, { method: 'PATCH', body: JSON.stringify({ action_ids: actionIds }) })
