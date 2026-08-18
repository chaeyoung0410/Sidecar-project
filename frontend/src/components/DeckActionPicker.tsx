import { actionIcons } from './actionMetadata'
import type { DashboardAction } from '../types/action'

interface DeckActionPickerProps {
  open: boolean
  actions: DashboardAction[]
  busy: boolean
  onClose: () => void
  onAdd: (actionId: number) => Promise<void>
}

export function DeckActionPicker({ open, actions, busy, onClose, onAdd }: DeckActionPickerProps) {
  if (!open) return null
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="deck-action-title" className="max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-white/[0.1] bg-[#1c1c1e] p-6 shadow-2xl sm:rounded-[28px]">
      <div className="flex items-center justify-between"><div><h2 id="deck-action-title" className="text-[24px] font-bold">Action 추가</h2><p className="mt-2 text-sm text-zinc-500">이 Deck에서 사용할 기존 Action을 선택하세요.</p></div><button type="button" onClick={onClose} className="rounded-xl bg-[#2c2c2e] px-4 py-2 text-sm text-zinc-300">닫기</button></div>
      <div className="mt-6 space-y-2">{actions.map((action) => <button key={action.id} type="button" disabled={busy} onClick={() => void onAdd(action.id)} className="flex w-full items-center gap-3 rounded-2xl bg-[#2c2c2e] p-4 text-left hover:bg-[#3a3a3c] disabled:opacity-40"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-apple/10 font-mono text-apple">{actionIcons[action.icon]}</span><span><span className="block font-semibold text-zinc-100">{action.name}</span><span className="mt-1 block text-xs text-zinc-500">{action.type.replace('_', ' ')}</span></span><span className="ml-auto text-xl text-zinc-600">＋</span></button>)}</div>
      {!actions.length && <div className="mt-6 rounded-2xl bg-[#2c2c2e] p-7 text-center text-sm text-zinc-500">추가할 수 있는 Action이 없습니다.</div>}
    </section>
  </div>
}
