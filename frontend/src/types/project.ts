export interface Project {
  id: number
  name: string
  path: string
  is_selected: boolean
  created_at: string
  last_used_at: string
}

export interface ProjectCreate {
  name: string
  path: string
}
