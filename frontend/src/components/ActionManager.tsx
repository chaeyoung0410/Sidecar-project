import { useState, type FormEvent } from 'react'
import { actionIcons } from './actionMetadata'
import type { DashboardAction, DashboardActionIcon, DashboardActionInput, DashboardActionType } from '../types/action'
import type { SavedCommand } from '../types/command'

interface ActionManagerProps {
  open: boolean
  actions: DashboardAction[]
  commands: SavedCommand[]
  onClose: () => void
  onCreate: (payload: DashboardActionInput) => Promise<void>
  onUpdate: (actionId: number, payload: DashboardActionInput) => Promise<void>
  onDelete: (actionId: number) => Promise<void>
  onMove: (actionId: number, direction: -1 | 1) => Promise<void>
}

const typeLabels: Record<DashboardActionType, string> = {
  ai_error: 'AI Error', git_commit: 'Git Commit', git_push: 'Git Push', git_pull: 'Git Pull', notion: 'Notion', command: 'Custom Command',
}

const defaultIcons: Record<DashboardActionType, DashboardActionIcon> = {
  ai_error: 'spark', git_commit: 'commit', git_push: 'push', git_pull: 'pull', notion: 'notion', command: 'terminal',
}

const emptyForm: DashboardActionInput = { name: '', type: 'command', icon: 'terminal', config: {} }

export function ActionManager({ open, actions, commands, onClose, onCreate, onUpdate, onDelete, onMove }: ActionManagerProps) {
  const [form, setForm] = useState<DashboardActionInput>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (editingId === null) await onCreate(form)
      else await onUpdate(editingId, form)
      setEditingId(null)
      setForm(emptyForm)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Action을 저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const edit = (action: DashboardAction) => {
    setEditingId(action.id)
    setForm({ name: action.name, type: action.type, icon: action.icon, config: action.config })
    setError(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="actions-dialog-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[28px] border border-white/[0.1] bg-[#1c1c1e] p-5 shadow-2xl sm:rounded-[28px] sm:p-7">
        <div className="flex items-center justify-between">
          <div><h2 id="actions-dialog-title" className="text-[28px] font-bold">Actions</h2><p className="mt-2 text-sm text-zinc-500">Dashboard에서 사용할 기능을 관리합니다.</p></div>
          <button type="button" onClick={onClose} className="rounded-xl bg-[#2c2c2e] px-4 text-sm text-zinc-200 hover:text-white">닫기</button>
        </div>

        <div className="mt-6 space-y-2">
          {actions.map((action, index) => (
            <div key={action.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#2c2c2e] p-3 sm:flex-nowrap">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] font-mono text-lime">{actionIcons[action.icon]}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-zinc-200">{action.name}</p><p className="mt-0.5 text-xs text-zinc-600">{typeLabels[action.type]}</p></div>
              <div className="ml-auto flex gap-1">
                <button type="button" disabled={busy || index === 0} onClick={() => void onMove(action.id, -1)} aria-label={`${action.name} 위로 이동`} className="rounded-lg border border-line px-2 text-xs text-zinc-400 disabled:opacity-20">↑</button>
                <button type="button" disabled={busy || index === actions.length - 1} onClick={() => void onMove(action.id, 1)} aria-label={`${action.name} 아래로 이동`} className="rounded-lg border border-line px-2 text-xs text-zinc-400 disabled:opacity-20">↓</button>
                <button type="button" disabled={busy} onClick={() => edit(action)} className="rounded-lg px-2 text-xs text-zinc-300 hover:text-white">수정</button>
                <button type="button" disabled={busy} onClick={() => { if (window.confirm(`${action.name} Action을 Dashboard에서 삭제할까요?`)) void onDelete(action.id).catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'Action을 삭제하지 못했습니다.')) }} className="rounded-lg px-2 text-xs text-zinc-500 hover:text-[#ff6961]">삭제</button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={(event) => void submit(event)} className="mt-7 border-t border-line pt-6">
          <div className="flex items-center justify-between"><h3 className="font-semibold text-zinc-200">{editingId === null ? 'Action 추가' : 'Action 수정'}</h3>{editingId !== null && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm) }} className="text-xs text-zinc-500 hover:text-white">수정 취소</button>}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-zinc-500">Action 이름<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Run Test" className="mt-2 w-full border border-line bg-ink px-4 py-3 text-sm text-white outline-none focus:border-apple" /></label>
            <label className="text-xs font-medium text-zinc-500">Action 유형<select value={form.type} onChange={(event) => { const type = event.target.value as DashboardActionType; setForm({ ...form, type, icon: defaultIcons[type], config: {} }) }} className="mt-2 w-full border border-line bg-ink px-4 py-3 text-sm text-white outline-none focus:border-apple">{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>

          <div className="mt-4"><p className="text-xs font-medium text-zinc-500">아이콘</p><div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">{(Object.entries(actionIcons) as [DashboardActionIcon, string][]).map(([icon, symbol]) => <button key={icon} type="button" onClick={() => setForm({ ...form, icon })} aria-label={`${icon} 아이콘 사용`} className={`rounded-xl border font-mono ${form.icon === icon ? 'border-apple bg-apple/10 text-apple' : 'border-line text-zinc-500'}`}>{symbol}</button>)}</div></div>

          {form.type === 'command' && (
            <label className="mt-4 block text-xs font-medium text-zinc-500">연결할 Command<select value={String(form.config.command_id ?? '')} onChange={(event) => setForm({ ...form, config: event.target.value ? { command_id: Number(event.target.value) } : {} })} className="mt-2 w-full border border-line bg-ink px-4 py-3 text-sm text-white outline-none focus:border-apple"><option value="">Custom Command 화면 열기</option>{commands.map((command) => <option key={command.id} value={command.id}>{command.name} · {command.command}</option>)}</select></label>
          )}

          {error && <p role="alert" className="mt-3 text-sm text-rose-400">{error}</p>}
          <button type="submit" disabled={busy || !form.name.trim()} className="mt-4 w-full rounded-xl bg-apple px-5 py-3 text-sm font-semibold text-white hover:bg-[#409cff] disabled:opacity-40">{busy ? '저장하는 중…' : editingId === null ? 'Dashboard에 추가' : '변경사항 저장'}</button>
        </form>
      </section>
    </div>
  )
}
