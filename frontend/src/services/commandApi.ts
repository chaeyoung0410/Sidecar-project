import { apiRequest } from './api'
import type { CommandRun, SavedCommand, SavedCommandInput } from '../types/command'

export function listCommands(): Promise<SavedCommand[]> {
  return apiRequest<SavedCommand[]>('/api/commands')
}

export function createCommand(payload: SavedCommandInput): Promise<SavedCommand> {
  return apiRequest<SavedCommand>('/api/commands', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateCommand(commandId: number, payload: SavedCommandInput): Promise<SavedCommand> {
  return apiRequest<SavedCommand>(`/api/commands/${commandId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteCommand(commandId: number): Promise<void> {
  return apiRequest<void>(`/api/commands/${commandId}`, { method: 'DELETE' })
}

export function runCommand(commandId: number): Promise<CommandRun> {
  return apiRequest<CommandRun>(`/api/commands/${commandId}/run`, {
    method: 'POST',
    body: JSON.stringify({ confirmed: true }),
  })
}

export function listCommandRuns(): Promise<CommandRun[]> {
  return apiRequest<CommandRun[]>('/api/commands/runs/recent')
}

export function stopCommand(runId: number): Promise<CommandRun> {
  return apiRequest<CommandRun>(`/api/commands/runs/${runId}/stop`, {
    method: 'POST',
    body: JSON.stringify({ confirmed: true }),
  })
}
