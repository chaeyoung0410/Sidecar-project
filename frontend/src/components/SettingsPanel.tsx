import { useEffect, useState, type FormEvent } from 'react'
import { getAIStatus } from '../services/aiApi'
import type { AgentConnection } from '../services/agentConnection'
import type { AIStatus } from '../types/ai'
import type { AgentInfo, ConnectionState } from '../types/health'
import type { NotionStatus } from '../types/notion'
import type { Project } from '../types/project'

function SettingRow({ title, detail, status }: { title: string; detail: string; status?: 'ok' | 'warning' }) {
  return <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3"><div className="min-w-0"><p className="text-[15px] font-medium text-zinc-100">{title}</p><p className="mt-0.5 break-all text-[13px] leading-5 text-zinc-500">{detail}</p></div>{status && <span className={`shrink-0 text-[13px] font-medium ${status === 'ok' ? 'text-lime' : 'text-[#ffd60a]'}`}>{status === 'ok' ? '연결됨' : '확인 필요'}</span>}</div>
}

const connectionCopy: Record<ConnectionState, string> = {
  connected: 'Mac Agent에 정상적으로 연결되어 있습니다.',
  reconnecting: '저장된 주소로 다시 연결하고 있습니다.',
  discovering: '연결 가능한 Mac Agent를 찾고 있습니다.',
  disconnected: 'Mac Agent에 연결할 수 없습니다.',
}

const methodCopy: Record<NonNullable<AgentConnection['connectionMethod']>, string> = {
  hostname: 'Local Hostname',
  ip: 'Last Successful IP',
  automatic: 'Current Network Address',
  manual: 'Manual Address',
}

interface SettingsPanelProps {
  connection: ConnectionState
  agent: AgentInfo | null
  configuration: AgentConnection
  activeBaseUrl: string | null
  project: Project | null
  notion: NotionStatus | null
  onRetry: () => void
  onConnectManual: (url: string) => Promise<void>
}

export function SettingsPanel({ connection, agent, configuration, activeBaseUrl, project, notion, onRetry, onConnectManual }: SettingsPanelProps) {
  const [ai, setAI] = useState<AIStatus | null>(null)
  const [editingConnection, setEditingConnection] = useState(false)
  const [manualUrl, setManualUrl] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)
  const [manualBusy, setManualBusy] = useState(false)

  useEffect(() => { void getAIStatus().then(setAI).catch(() => setAI(null)) }, [])
  useEffect(() => { if (connection === 'disconnected') setEditingConnection(true) }, [connection])

  const submitManual = async (event: FormEvent) => {
    event.preventDefault()
    setManualBusy(true)
    setManualError(null)
    try {
      await onConnectManual(manualUrl)
      setEditingConnection(false)
    } catch (error) {
      setManualError(error instanceof Error ? error.message : '입력한 주소에 연결할 수 없습니다.')
    } finally {
      setManualBusy(false)
    }
  }

  const storedAddress = configuration.hostname
    ? `${configuration.hostname}:${configuration.port}`
    : configuration.lastSuccessfulIp
      ? `${configuration.lastSuccessfulIp}:${configuration.port}`
      : '저장된 Agent 주소가 없습니다.'

  return <section id="settings" aria-labelledby="settings-title" className="py-12 sm:py-16">
    <div className="mb-7"><h2 id="settings-title" className="text-[30px] font-bold tracking-tight text-white">설정</h2><p className="mt-2 text-[15px] leading-6 text-zinc-500">CodePad의 연결과 현재 작업 환경을 확인합니다.</p></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="lg:col-span-2"><h3 className="mb-2 px-4 text-[13px] font-medium text-zinc-500">Mac Agent</h3><div className="overflow-hidden rounded-[20px] bg-panel">
        <div className="divide-y divide-white/[0.08]"><SettingRow title="상태" detail={connectionCopy[connection]} status={connection === 'connected' ? 'ok' : 'warning'} /><SettingRow title="Mac" detail={agent?.name ? `${agent.name} · ${agent.hostname}` : '연결 후 Mac 정보를 표시합니다.'} /><SettingRow title="연결 주소" detail={activeBaseUrl ?? storedAddress} /><SettingRow title="현재 IP" detail={agent?.ip ?? configuration.lastSuccessfulIp ?? '연결 후 확인할 수 있습니다.'} /><SettingRow title="연결 방식" detail={configuration.connectionMethod ? methodCopy[configuration.connectionMethod] : '아직 연결되지 않았습니다.'} /></div>
        {connection === 'disconnected' && <div className="border-t border-white/[0.08] px-4 py-4 text-sm leading-6 text-zinc-400"><p className="font-medium text-zinc-200">Mac Agent를 찾을 수 없습니다.</p><ul className="mt-2 list-disc pl-5"><li>Mac Agent가 실행 중인지 확인</li><li>Mac과 iPad가 같은 Wi-Fi인지 확인</li><li>Mac 방화벽이 연결을 차단하지 않는지 확인</li></ul></div>}
        <div className="flex flex-wrap gap-2 border-t border-white/[0.08] px-4 py-4"><button type="button" onClick={onRetry} className="rounded-xl bg-apple px-4 py-2.5 text-sm font-semibold text-white">다시 연결</button><button type="button" onClick={() => setEditingConnection((value) => !value)} className="rounded-xl bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-zinc-200">연결 설정 변경</button></div>
        {editingConnection && <form onSubmit={(event) => void submitManual(event)} className="border-t border-white/[0.08] px-4 py-5"><label htmlFor="agent-url" className="text-sm font-medium text-zinc-200">Mac Agent 주소</label><p className="mt-1 text-xs leading-5 text-zinc-500">Mac Agent 시작 화면의 <span className="font-mono">mac-name.local:8000</span> 주소를 권장합니다.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input id="agent-url" value={manualUrl} onChange={(event) => setManualUrl(event.target.value)} placeholder="chae-young-macbook.local:8000" autoCapitalize="none" autoCorrect="off" className="min-w-0 flex-1 rounded-xl border border-white/[0.12] bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-apple" /><button type="submit" disabled={manualBusy || !manualUrl.trim()} className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-40">{manualBusy ? '연결 중…' : '연결'}</button></div>{manualError && <p role="alert" className="mt-3 text-sm text-[#ff6961]">{manualError}</p>}</form>}
      </div></div>
      <div><h3 className="mb-2 px-4 text-[13px] font-medium text-zinc-500">프로젝트</h3><div className="divide-y divide-white/[0.08] overflow-hidden rounded-[20px] bg-panel"><SettingRow title="현재 프로젝트" detail={project?.name ?? '선택된 프로젝트가 없습니다.'} /><SettingRow title="프로젝트 경로" detail={project?.path ?? 'Project 메뉴에서 프로젝트를 등록하세요.'} /></div></div>
      <div><h3 className="mb-2 px-4 text-[13px] font-medium text-zinc-500">연동 서비스</h3><div className="divide-y divide-white/[0.08] overflow-hidden rounded-[20px] bg-panel"><SettingRow title="Gemini" detail={ai?.configured ? ai.model : 'GEMINI_API_KEY가 설정되지 않았습니다.'} status={ai?.configured ? 'ok' : 'warning'} /><SettingRow title="Notion" detail={notion?.connected ? notion.destination ?? 'Data Source 연결됨' : notion?.message ?? '연결 상태를 확인하지 못했습니다.'} status={notion?.connected ? 'ok' : 'warning'} /></div></div>
      <div><h3 className="mb-2 px-4 text-[13px] font-medium text-zinc-500">화면</h3><div className="overflow-hidden rounded-[20px] bg-panel"><SettingRow title="Dark Mode" detail="Apple 기기의 시스템 UI에 맞춘 Dark Theme를 사용합니다." status="ok" /></div></div>
    </div>
  </section>
}
