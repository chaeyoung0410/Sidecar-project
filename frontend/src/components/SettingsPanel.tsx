import { useEffect, useState } from 'react'
import { getAIStatus } from '../services/aiApi'
import { API_BASE_URL } from '../services/api'
import type { AIStatus } from '../types/ai'
import type { ConnectionState } from '../types/health'
import type { NotionStatus } from '../types/notion'
import type { Project } from '../types/project'

function SettingRow({ title, detail, status }: { title: string; detail: string; status?: 'ok' | 'warning' }) {
  return <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3"><div className="min-w-0"><p className="text-[15px] font-medium text-zinc-100">{title}</p><p className="mt-0.5 break-all text-[13px] leading-5 text-zinc-500">{detail}</p></div>{status && <span className={`shrink-0 text-[13px] font-medium ${status === 'ok' ? 'text-lime' : 'text-[#ffd60a]'}`}>{status === 'ok' ? '연결됨' : '확인 필요'}</span>}</div>
}

export function SettingsPanel({ connection, project, notion }: { connection: ConnectionState; project: Project | null; notion: NotionStatus | null }) {
  const [ai, setAI] = useState<AIStatus | null>(null)
  useEffect(() => { void getAIStatus().then(setAI).catch(() => setAI(null)) }, [])
  return <section id="settings" aria-labelledby="settings-title" className="py-12 sm:py-16">
    <div className="mb-7"><h2 id="settings-title" className="text-[30px] font-bold tracking-tight text-white">설정</h2><p className="mt-2 text-[15px] leading-6 text-zinc-500">CodePad의 연결과 현재 작업 환경을 확인합니다.</p></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <div><h3 className="mb-2 px-4 text-[13px] font-medium text-zinc-500">연결</h3><div className="divide-y divide-white/[0.08] overflow-hidden rounded-[20px] bg-panel"><SettingRow title="Mac Agent URL" detail={API_BASE_URL} /><SettingRow title="연결 상태" detail={connection === 'connected' ? 'Mac Agent에 정상적으로 연결되어 있습니다.' : connection === 'reconnecting' ? 'Mac Agent에 다시 연결하고 있습니다.' : 'Mac Agent 연결이 끊어졌습니다.'} status={connection === 'connected' ? 'ok' : 'warning'} /></div></div>
      <div><h3 className="mb-2 px-4 text-[13px] font-medium text-zinc-500">프로젝트</h3><div className="divide-y divide-white/[0.08] overflow-hidden rounded-[20px] bg-panel"><SettingRow title="현재 프로젝트" detail={project?.name ?? '선택된 프로젝트가 없습니다.'} /><SettingRow title="프로젝트 경로" detail={project?.path ?? 'Project 메뉴에서 프로젝트를 등록하세요.'} /></div></div>
      <div><h3 className="mb-2 px-4 text-[13px] font-medium text-zinc-500">연동 서비스</h3><div className="divide-y divide-white/[0.08] overflow-hidden rounded-[20px] bg-panel"><SettingRow title="Gemini" detail={ai?.configured ? ai.model : 'GEMINI_API_KEY가 설정되지 않았습니다.'} status={ai?.configured ? 'ok' : 'warning'} /><SettingRow title="Notion" detail={notion?.connected ? notion.destination ?? 'Data Source 연결됨' : notion?.message ?? '연결 상태를 확인하지 못했습니다.'} status={notion?.connected ? 'ok' : 'warning'} /></div></div>
      <div><h3 className="mb-2 px-4 text-[13px] font-medium text-zinc-500">화면</h3><div className="overflow-hidden rounded-[20px] bg-panel"><SettingRow title="Dark Mode" detail="Apple 기기의 시스템 UI에 맞춘 Dark Theme를 사용합니다." status="ok" /></div></div>
    </div>
  </section>
}
