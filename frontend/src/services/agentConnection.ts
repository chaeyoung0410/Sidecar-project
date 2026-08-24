import type { AgentInfo, HealthResponse } from '../types/health'

const STORAGE_KEY = 'codepad.agentConnection.v1'
const LEGACY_URL_KEYS = ['codepad.agentUrl', 'codepad.agent-url', 'agentUrl']
const DEFAULT_PORT = 8000
const HEALTH_TIMEOUT_MS = 3_000

export type ConnectionMethod = 'hostname' | 'ip' | 'automatic' | 'manual'

export interface AgentConnection {
  hostname: string | null
  lastSuccessfulIp: string | null
  port: number
  protocol: 'http:' | 'https:'
  lastConnectedAt: string | null
  connectionMethod: ConnectionMethod | null
}

export interface ResolvedAgentConnection {
  baseUrl: string
  method: ConnectionMethod
  configuration: AgentConnection
  health: HealthResponse
  agent: AgentInfo | null
}

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
let activeBaseUrl: string | null = null
let pendingResolution: Promise<ResolvedAgentConnection> | null = null
let pendingAbortController: AbortController | null = null

function defaultProtocol(): 'http:' | 'https:' {
  return window.location.protocol === 'https:' ? 'https:' : 'http:'
}

function emptyConnection(): AgentConnection {
  return {
    hostname: null,
    lastSuccessfulIp: null,
    port: DEFAULT_PORT,
    protocol: defaultProtocol(),
    lastConnectedAt: null,
    connectionMethod: null,
  }
}

function isIpAddress(hostname: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)
}

function isUsableAgentIp(hostname: string): boolean {
  return isIpAddress(hostname) && !hostname.startsWith('127.') && hostname !== '0.0.0.0'
}

function parseAgentUrl(value: string, allowLoopback = false): URL {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) throw new Error('Mac Agent 주소를 입력해주세요.')
  const withProtocol = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
  const url = new URL(withProtocol)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('http 또는 https 주소를 입력해주세요.')
  if (!allowLoopback && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
    throw new Error('iPad의 localhost가 아닌 Mac의 .local 주소 또는 로컬 IP를 입력해주세요.')
  }
  url.pathname = ''
  url.search = ''
  url.hash = ''
  if (!url.port) url.port = String(DEFAULT_PORT)
  return url
}

function baseUrl(protocol: string, hostname: string, port: number): string {
  return `${protocol}//${hostname}:${port}`
}

function migrateLegacyConnection(): AgentConnection {
  const connection = emptyConnection()
  for (const key of LEGACY_URL_KEYS) {
    const legacyUrl = window.localStorage.getItem(key)
    if (!legacyUrl) continue
    try {
      const parsed = parseAgentUrl(legacyUrl, true)
      connection.protocol = parsed.protocol as 'http:' | 'https:'
      connection.port = Number(parsed.port)
      if (isIpAddress(parsed.hostname)) connection.lastSuccessfulIp = parsed.hostname
      else connection.hostname = parsed.hostname
      return connection
    } catch {
      // Preserve invalid legacy values and continue with normal discovery.
    }
  }
  return connection
}

export function loadAgentConnection(): AgentConnection {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return migrateLegacyConnection()
    const value = JSON.parse(stored) as Partial<AgentConnection>
    const validMethods: Array<AgentConnection['connectionMethod']> = ['hostname', 'ip', 'automatic', 'manual', null]
    return {
      hostname: typeof value.hostname === 'string' ? value.hostname : null,
      lastSuccessfulIp: typeof value.lastSuccessfulIp === 'string' ? value.lastSuccessfulIp : null,
      port: typeof value.port === 'number' && value.port > 0 ? value.port : DEFAULT_PORT,
      protocol: value.protocol === 'https:' ? 'https:' : 'http:',
      lastConnectedAt: typeof value.lastConnectedAt === 'string' ? value.lastConnectedAt : null,
      connectionMethod: validMethods.includes(value.connectionMethod ?? null) ? value.connectionMethod ?? null : null,
    }
  } catch {
    return migrateLegacyConnection()
  }
}

function saveAgentConnection(connection: AgentConnection): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(connection))
}

function candidateUrls(connection: AgentConnection): Array<{ url: string; method: ConnectionMethod }> {
  const candidates: Array<{ url: string; method: ConnectionMethod }> = []
  const add = (url: string, method: ConnectionMethod) => {
    const normalized = url.replace(/\/+$/, '')
    if (!candidates.some((candidate) => candidate.url === normalized)) candidates.push({ url: normalized, method })
  }

  if (connection.hostname) add(baseUrl(connection.protocol, connection.hostname, connection.port), 'hostname')
  if (connection.lastSuccessfulIp) add(baseUrl(connection.protocol, connection.lastSuccessfulIp, connection.port), 'ip')

  if (configuredBaseUrl) {
    try { add(parseAgentUrl(configuredBaseUrl, true).origin, 'automatic') } catch { /* Ignore invalid build-time configuration. */ }
  }

  const pageHostname = window.location.hostname
  if (pageHostname) add(baseUrl(defaultProtocol(), pageHostname, DEFAULT_PORT), 'automatic')
  return candidates
}

async function fetchWithTimeout(url: string, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    return await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

async function inspectCandidate(
  candidate: { url: string; method: ConnectionMethod },
  previous: AgentConnection,
  signal?: AbortSignal,
): Promise<ResolvedAgentConnection> {
  const healthResponse = await fetchWithTimeout(`${candidate.url}/api/health`, signal)
  if (!healthResponse.ok) throw new Error(`Agent returned ${healthResponse.status}`)
  const health = await healthResponse.json() as HealthResponse
  if (health.status !== 'ok') throw new Error('Mac Agent health check failed')

  let agent: AgentInfo | null = null
  try {
    const infoResponse = await fetchWithTimeout(`${candidate.url}/api/agent/info`, signal)
    if (infoResponse.ok) agent = await infoResponse.json() as AgentInfo
  } catch {
    // Older Agents may not expose the info endpoint; health remains compatible.
  }

  const parsed = new URL(candidate.url)
  const reportedIp = agent?.ip && isUsableAgentIp(agent.ip) ? agent.ip : null
  const configuration: AgentConnection = {
    hostname: agent?.local_hostname ?? (parsed.hostname.endsWith('.local') ? parsed.hostname : previous.hostname),
    lastSuccessfulIp: reportedIp ?? (isUsableAgentIp(parsed.hostname) ? parsed.hostname : previous.lastSuccessfulIp),
    port: agent?.port ?? Number(parsed.port || DEFAULT_PORT),
    protocol: parsed.protocol as 'http:' | 'https:',
    lastConnectedAt: new Date().toISOString(),
    connectionMethod: candidate.method,
  }
  activeBaseUrl = candidate.url
  saveAgentConnection(configuration)
  return { baseUrl: candidate.url, method: candidate.method, configuration, health, agent }
}

async function resolve(signal?: AbortSignal): Promise<ResolvedAgentConnection> {
  const connection = loadAgentConnection()
  let lastError: unknown = null
  for (const candidate of candidateUrls(connection)) {
    if (signal?.aborted) throw new DOMException('Connection cancelled', 'AbortError')
    try {
      return await inspectCandidate(candidate, connection, signal)
    } catch (error) {
      lastError = error
    }
  }
  activeBaseUrl = null
  throw lastError instanceof Error ? lastError : new Error('Mac Agent를 찾을 수 없습니다.')
}

export function resolveAgentConnection(options: { force?: boolean; signal?: AbortSignal } = {}): Promise<ResolvedAgentConnection> {
  if (options.force) {
    pendingAbortController?.abort()
    pendingAbortController = null
    pendingResolution = null
  }
  if (!pendingResolution) {
    const controller = new AbortController()
    const abort = () => controller.abort()
    options.signal?.addEventListener('abort', abort, { once: true })
    if (options.signal?.aborted) controller.abort()
    const promise = resolve(controller.signal)
    pendingAbortController = controller
    pendingResolution = promise
    const clear = () => {
      options.signal?.removeEventListener('abort', abort)
      if (pendingResolution === promise) {
        pendingResolution = null
        pendingAbortController = null
      }
    }
    void promise.then(clear, clear)
  }
  return pendingResolution
}

export async function connectToManualAgent(value: string, signal?: AbortSignal): Promise<ResolvedAgentConnection> {
  pendingAbortController?.abort()
  pendingAbortController = null
  pendingResolution = null
  activeBaseUrl = null
  const parsed = parseAgentUrl(value)
  const previous = loadAgentConnection()
  const candidate = { url: parsed.origin, method: 'manual' as const }
  try {
    const result = await inspectCandidate(candidate, previous, signal)
    // A manual IP is retained as fallback; Agent Info promotes its .local hostname.
    return result
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('입력한 주소의 Mac Agent에 연결할 수 없습니다.')
  }
}

export function getActiveAgentBaseUrl(): string | null {
  return activeBaseUrl
}

export function clearActiveAgentBaseUrl(): void {
  activeBaseUrl = null
  pendingAbortController?.abort()
  pendingAbortController = null
  pendingResolution = null
}

export async function requireAgentBaseUrl(signal?: AbortSignal): Promise<string> {
  return activeBaseUrl ?? (await resolveAgentConnection({ signal })).baseUrl
}

export function websocketUrl(base: string): string {
  return `${base.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')}/ws`
}
