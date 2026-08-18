import type { DashboardAction } from './action'

export type DeckIcon = 'grid' | 'frontend' | 'server' | 'git' | 'spark' | 'folder'

export interface Deck {
  id: number
  project_id: number
  name: string
  description: string
  icon: string
  position: number
  actions: DashboardAction[]
  created_at: string
  updated_at: string
}

export interface DeckInput {
  name: string
  description: string
  icon: DeckIcon
}
