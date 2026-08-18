export type DashboardActionType = 'ai_error' | 'git_commit' | 'git_push' | 'git_pull' | 'notion' | 'command'
export type DashboardActionIcon = 'spark' | 'commit' | 'push' | 'pull' | 'notion' | 'terminal' | 'play' | 'bug' | 'server'

export interface DashboardAction {
  id: number
  name: string
  type: DashboardActionType
  icon: DashboardActionIcon
  position: number
  config: { command_id?: number; [key: string]: unknown }
  created_at: string
  updated_at: string
}

export interface DashboardActionInput {
  name: string
  type: DashboardActionType
  icon: DashboardActionIcon
  config: { command_id?: number; [key: string]: unknown }
}
