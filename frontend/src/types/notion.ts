export interface NotionStatus {
  configured: boolean
  connected: boolean
  destination: string | null
  data_source_id: string | null
  message: string | null
}

export interface NotionLog {
  id: number
  title: string
  content: string
  tags: string[]
  notion_page_id: string
  notion_url: string
  project_id: number | null
  project_name: string | null
  created_at: string
}

export interface NotionLogInput {
  title: string
  content: string
  tags: string[]
}
