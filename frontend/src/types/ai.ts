export interface AIStatus {
  provider: 'gemini'
  configured: boolean
  model: string
}

export interface ErrorAnalysisContext {
  error_id: number
  programming_language: string
  framework: string | null
  error_message: string
  stack_trace: string
  file: string | null
  line: number | null
  code_snippet: string | null
  command: string
  project_name: string
}

export interface AIAnalysis {
  id: number
  error_id: number
  provider: string
  model: string
  cause: string
  explanation: string
  solution_steps: string[]
  code_fix: string | null
  terminal_commands: string[]
  created_at: string
}

export interface JournalCommit {
  commit: string
  message: string
  files: string[]
}

export interface JournalCommand {
  name: string
  command: string
  status: string
}

export interface JournalError {
  message: string
  file: string | null
  line: number | null
  ai_analyzed: boolean
  ai_resolution: string | null
}

export interface DevelopmentJournalContext {
  project_id: number
  project_name: string
  date: string
  branch: string | null
  commits: JournalCommit[]
  changed_files: string[]
  commands: JournalCommand[]
  errors: JournalError[]
}

export interface AIJournalDraft {
  id: number
  project_id: number
  project_name: string
  provider: string
  model: string
  title: string
  content: string
  tags: string[]
  source_counts: Record<string, number>
  created_at: string
}
