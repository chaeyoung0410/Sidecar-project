export interface SavedCommand {
  id: number
  name: string
  command: string
  working_directory: string
  created_at: string
  updated_at: string
}

export interface SavedCommandInput {
  name: string
  command: string
  working_directory: string
}

export type CommandRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'stopped'

export interface CommandRun {
  id: number
  command_id: number | null
  project_id: number
  name: string
  command: string
  working_directory: string
  status: CommandRunStatus
  pid: number | null
  exit_code: number | null
  stdout: string
  stderr: string
  started_at: string
  finished_at: string | null
}
