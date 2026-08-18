import { useCallback, useEffect, useRef, useState } from 'react'
import { getHealth } from '../services/healthApi'
import { WEBSOCKET_URL } from '../services/api'
import type { AgentEvent, ConnectionState, HealthResponse } from '../types/health'

const HEARTBEAT_INTERVAL_MS = 20_000
const HEARTBEAT_TIMEOUT_MS = 45_000
const MAX_RECONNECT_DELAY_MS = 10_000
const DISCONNECTED_AFTER_ATTEMPTS = 3

export function useAgentConnection() {
  const [state, setState] = useState<ConnectionState>('reconnecting')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [lastConnectedAt, setLastConnectedAt] = useState<string | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const heartbeatTimerRef = useRef<number | null>(null)
  const attemptsRef = useRef(0)
  const lastMessageAtRef = useRef(0)
  const mountedRef = useRef(false)

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current)
    if (heartbeatTimerRef.current !== null) window.clearInterval(heartbeatTimerRef.current)
    reconnectTimerRef.current = null
    heartbeatTimerRef.current = null
  }, [])

  const refreshHealth = useCallback(async () => {
    try {
      setHealth(await getHealth())
    } catch {
      setHealth(null)
    }
  }, [])

  const connect = useCallback(() => {
    if (!mountedRef.current || socketRef.current?.readyState === WebSocket.OPEN) return

    clearTimers()
    setState(attemptsRef.current >= DISCONNECTED_AFTER_ATTEMPTS ? 'disconnected' : 'reconnecting')

    const socket = new WebSocket(WEBSOCKET_URL)
    socketRef.current = socket

    socket.onopen = () => {
      if (!mountedRef.current) return
      attemptsRef.current = 0
      lastMessageAtRef.current = Date.now()
      setState('connected')
      void refreshHealth()
      heartbeatTimerRef.current = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          if (Date.now() - lastMessageAtRef.current > HEARTBEAT_TIMEOUT_MS) {
            socket.close()
          } else {
            socket.send(JSON.stringify({ type: 'ping' }))
          }
        }
      }, HEARTBEAT_INTERVAL_MS)
    }

    socket.onmessage = (message) => {
      lastMessageAtRef.current = Date.now()
      try {
        const event = JSON.parse(message.data as string) as AgentEvent
        window.dispatchEvent(new CustomEvent('codepad:agent-event', { detail: event }))
        if (event.type === 'agent.connected') {
          setHealth({ status: 'ok', ...event.data })
          setLastConnectedAt(event.timestamp)
        }
      } catch {
        // Ignore unknown events so future event types remain backwards compatible.
      }
    }

    socket.onerror = () => socket.close()

    socket.onclose = () => {
      if (!mountedRef.current || socketRef.current !== socket) return
      if (heartbeatTimerRef.current !== null) window.clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
      socketRef.current = null
      attemptsRef.current += 1

      const isOffline = !navigator.onLine
      setState(isOffline || attemptsRef.current >= DISCONNECTED_AFTER_ATTEMPTS ? 'disconnected' : 'reconnecting')

      if (!isOffline) {
        const delay = Math.min(1_000 * 2 ** (attemptsRef.current - 1), MAX_RECONNECT_DELAY_MS)
        reconnectTimerRef.current = window.setTimeout(connect, delay)
      }
    }
  }, [clearTimers, refreshHealth])

  const retry = useCallback(() => {
    attemptsRef.current = 0
    socketRef.current?.close()
    socketRef.current = null
    setState('reconnecting')
    connect()
  }, [connect])

  useEffect(() => {
    mountedRef.current = true
    void refreshHealth()
    connect()

    const handleOnline = () => retry()
    const handleOffline = () => {
      clearTimers()
      setState('disconnected')
      socketRef.current?.close()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      mountedRef.current = false
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearTimers()
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [clearTimers, connect, refreshHealth, retry])

  return { state, health, lastConnectedAt, retry }
}
