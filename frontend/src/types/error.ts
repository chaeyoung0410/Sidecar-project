export interface ErrorHistory {
  id: number
  command_run_id: number
  project_id: number
  project_name: string
  command: string
  error_message: string
  stack_trace: string
  file: string | null
  line: number | null
  ai_analyzed: boolean
  created_at: string
  updated_at: string
}
