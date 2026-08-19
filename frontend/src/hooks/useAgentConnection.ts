import { useCallback, useEffect, useRef, useState } from 'react'
import {
  connectToManualAgent,
  clearActiveAgentBaseUrl,
  loadAgentConnection,
  resolveAgentConnection,
  websocketUrl,
  type AgentConnection,
  type ResolvedAgentConnection,
} from '../services/agentConnection'
import type { AgentEvent, AgentInfo, ConnectionState, HealthResponse } from '../types/health'

const HEARTBEAT_INTERVAL_MS = 20_000
const HEARTBEAT_TIMEOUT_MS = 45_000
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000]
const DISCONNECTED_AFTER_ATTEMPTS = 3

export function useAgentConnection() {
  const [state, setState] = useState<ConnectionState>('discovering')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [agent, setAgent] = useState<AgentInfo | null>(null)
  const [configuration, setConfiguration] = useState<AgentConnection>(loadAgentConnection)
  const [activeBaseUrl, setActiveBaseUrl] = useState<string | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const heartbeatTimerRef = useRef<number | null>(null)
  const attemptsRef = useRef(0)
  const lastMessageAtRef = useRef(0)
  const mountedRef = useRef(false)
  const generationRef = useRef(0)
  const connectRef = useRef<() => void>(() => undefined)

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current)
    if (heartbeatTimerRef.current !== null) window.clearInterval(heartbeatTimerRef.current)
    reconnectTimerRef.current = null
    heartbeatTimerRef.current = null
  }, [])

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current || !navigator.onLine) {
      setState('disconnected')
      return
    }
    attemptsRef.current += 1
    setState(attemptsRef.current >= DISCONNECTED_AFTER_ATTEMPTS ? 'disconnected' : 'reconnecting')
    const delay = RECONNECT_DELAYS_MS[Math.min(attemptsRef.current - 1, RECONNECT_DELAYS_MS.length - 1)]
    reconnectTimerRef.current = window.setTimeout(() => connectRef.current(), delay)
  }, [])

  const openSocket = useCallback((resolved: ResolvedAgentConnection) => {
    if (!mountedRef.current) return
    setHealth(resolved.health)
    setAgent(resolved.agent)
    setConfiguration(resolved.configuration)
    setActiveBaseUrl(resolved.baseUrl)

    const socket = new WebSocket(websocketUrl(resolved.baseUrl))
    socketRef.current = socket

    socket.onopen = () => {
      if (!mountedRef.current || socketRef.current !== socket) return
      attemptsRef.current = 0
      lastMessageAtRef.current = Date.now()
      setState('connected')
      heartbeatTimerRef.current = window.setInterval(() => {
        if (socket.readyState !== WebSocket.OPEN) return
        if (Date.now() - lastMessageAtRef.current > HEARTBEAT_TIMEOUT_MS) socket.close()
        else socket.send(JSON.stringify({ type: 'ping' }))
      }, HEARTBEAT_INTERVAL_MS)
    }

    socket.onmessage = (message) => {
      lastMessageAtRef.current = Date.now()
      try {
        const event = JSON.parse(message.data as string) as AgentEvent
        window.dispatchEvent(new CustomEvent('codepad:agent-event', { detail: event }))
        if (event.type === 'agent.connected') setHealth({ status: 'ok', ...event.data })
      } catch {
        // Unknown future event types remain backwards compatible.
      }
    }

    socket.onerror = () => socket.close()
    socket.onclose = () => {
      if (!mountedRef.current || socketRef.current !== socket) return
      if (heartbeatTimerRef.current !== null) window.clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
      socketRef.current = null
      clearActiveAgentBaseUrl()
      scheduleReconnect()
    }
  }, [scheduleReconnect])

  const connect = useCallback(() => {
    if (!mountedRef.current || socketRef.current?.readyState === WebSocket.OPEN) return
    if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current)
    reconnectTimerRef.current = null
    const generation = ++generationRef.current
    setState(attemptsRef.current === 0 ? 'discovering' : 'reconnecting')
    void resolveAgentConnection({ force: true })
      .then((resolved) => {
        if (mountedRef.current && generationRef.current === generation) openSocket(resolved)
      })
      .catch(() => {
        if (!mountedRef.current || generationRef.current !== generation) return
        setHealth(null)
        setActiveBaseUrl(null)
        scheduleReconnect()
      })
  }, [openSocket, scheduleReconnect])
  connectRef.current = connect

  const retry = useCallback(() => {
    clearTimers()
    attemptsRef.current = 0
    generationRef.current += 1
    clearActiveAgentBaseUrl()
    setActiveBaseUrl(null)
    const socket = socketRef.current
    socketRef.current = null
    socket?.close()
    setState('discovering')
    connectRef.current()
  }, [clearTimers])

  const connectManual = useCallback(async (url: string) => {
    clearTimers()
    const generation = ++generationRef.current
    const socket = socketRef.current
    socketRef.current = null
    socket?.close()
    setActiveBaseUrl(null)
    setState('discovering')
    try {
      const resolved = await connectToManualAgent(url)
      if (!mountedRef.current || generationRef.current !== generation) return
      attemptsRef.current = 0
      openSocket(resolved)
    } catch (error) {
      if (!mountedRef.current || generationRef.current !== generation) return
      setState('disconnected')
      throw error
    }
  }, [clearTimers, openSocket])

  useEffect(() => {
    mountedRef.current = true
    connectRef.current()

    const handleOnline = () => retry()
    const handleOffline = () => {
      clearTimers()
      generationRef.current += 1
      clearActiveAgentBaseUrl()
      setState('disconnected')
      const socket = socketRef.current
      socketRef.current = null
      socket?.close()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      mountedRef.current = false
      generationRef.current += 1
      clearActiveAgentBaseUrl()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearTimers()
      const socket = socketRef.current
      socketRef.current = null
      socket?.close()
    }
  }, [clearTimers, retry])

  return {
    state,
    health,
    agent,
    configuration,
    activeBaseUrl,
    lastConnectedAt: configuration.lastConnectedAt,
    retry,
    connectManual,
  }
}
