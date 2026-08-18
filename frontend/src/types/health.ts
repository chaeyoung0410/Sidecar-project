import type { ErrorHistory } from './error'

export interface HealthResponse {
  status: 'ok'
  service: string
  version: string
}

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting'

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
