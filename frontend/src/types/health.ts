import type { ErrorHistory } from './error'

export interface HealthResponse {
  status: 'ok'
  service: string
  version: string
}

export interface AgentInfo {
  name: string
  hostname: string
  local_hostname: string
  ip: string
  port: number
  status: 'running'
}

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting' | 'discovering'

export interface AgentConnectedEvent {
  type: 'agent.connected'
  timestamp: string
  data: {
    service: string
    version: string
  }
}

export interface PongEvent {
  type: 'pong'
  timestamp: string
}

export interface ErrorDetectedEvent {
  type: 'error.detected' | 'error.updated'
  timestamp: string
  data: ErrorHistory
}

export type AgentEvent = AgentConnectedEvent | PongEvent | ErrorDetectedEvent
