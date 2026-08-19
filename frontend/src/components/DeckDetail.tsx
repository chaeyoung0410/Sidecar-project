import { actionIcons } from './actionMetadata'
import { deckIcons } from './deckMetadata'
import type { DashboardAction } from '../types/action'
import type { Deck, DeckIcon } from '../types/deck'

interface DeckDetailProps {
  deck: Deck
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onAdd: () => void
  onOpenAction: (action: DashboardAction) => void
  onEditAction: (action: DashboardAction) => void
  onRemoveAction: (actionId: number) => void
  onMoveAction: (actionId: number, direction: -1 | 1) => void
}

export function DeckDetail({ deck, onBack, onEdit, onDelete, onAdd, onOpenAction, onEditAction, onRemoveAction, onMoveAction }: DeckDetailProps) {
  return <section className="py-12">
    <button type="button" onClick={onBack} className="text-sm font-medium text-apple">‹ Deck 목록</button>
    <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
      <div className="flex min-w-0 gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-apple/10 font-mono text-xl text-apple">{deckIcons[deck.icon as DeckIcon] ?? '▦'}</span><div><h2 className="break-words text-[32px] font-bold tracking-tight text-white">{deck.name}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">{deck.description || '이 Deck에 자주 사용하는 Action을 추가해보세요.'}</p><p className="mt-2 text-xs text-zinc-600">{deck.actions.length}개의 Action</p></div></div>
      <div className="flex gap-2"><button type="button" onClick={onEdit} className="rounded-xl bg-[#2c2c2e] px-4 py-2.5 text-sm font-semibold text-zinc-200">수정</button><button type="button" onClick={onDelete} className="rounded-xl bg-rose-400/10 px-4 py-2.5 text-sm font-semibold text-rose-300">삭제</button></div>
    </div>
    <div className="mt-9 grid grid-cols-2 gap-3 lg:grid-cols-3">
      {deck.actions.map((action, index) => <article key={action.id} className="pressable-card relative flex min-h-44 flex-col rounded-[22px] border border-transparent bg-panel p-5 hover:border-apple/30 hover:bg-[#242426] sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-apple/15 font-mono text-apple">{actionIcons[action.icon]}</span>
          <details className="group/menu relative z-10">
            <summary aria-label={`${action.name} 관리 메뉴`} className="flex h-9 min-h-0 w-9 cursor-pointer list-none items-center justify-center rounded-full text-lg tracking-widest text-zinc-500 hover:bg-white/[0.07] hover:text-white">•••</summary>
            <div className="absolute right-0 top-10 w-40 overflow-hidden rounded-xl border border-white/[0.1] bg-[#2c2c2e] p-1 shadow-2xl">
              <button type="button" onClick={() => onEditAction(action)} className="w-full rounded-lg px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/[0.07]">Action 수정</button>
              <button type="button" disabled={index === 0} onClick={() => onMoveAction(action.id, -1)} className="w-full rounded-lg px-3 py-2 text-left text-xs text-zinc-400 hover:bg-white/[0.07] disabled:opacity-30">앞으로 이동</button>
              <button type="button" disabled={index === deck.actions.length - 1} onClick={() => onMoveAction(action.id, 1)} className="w-full rounded-lg px-3 py-2 text-left text-xs text-zinc-400 hover:bg-white/[0.07] disabled:opacity-30">뒤로 이동</button>
              <button type="button" onClick={() => onRemoveAction(action.id)} className="w-full rounded-lg px-3 py-2 text-left text-xs text-rose-300 hover:bg-white/[0.07]">Deck에서 제거</button>
            </div>
          </details>
        </div>
        <button type="button" onClick={() => onOpenAction(action)} className="flex flex-1 flex-col text-left"><span className="mt-auto pt-7 text-[17px] font-semibold text-white">{action.name}</span><span className="mt-2 text-sm text-zinc-500">상세 화면으로 이동합니다. <span aria-hidden="true" className="text-apple">›</span></span></button>
      </article>)}
      <button type="button" onClick={onAdd} className="pressable-card min-h-44 rounded-[22px] border border-dashed border-white/[0.18] p-5 text-left hover:border-apple/60 hover:bg-apple/[0.04]"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-xl text-apple">＋</span><p className="mt-8 text-[17px] font-semibold text-white">Action 추가</p><p className="mt-2 text-sm text-zinc-500">기존 Action을 이 Deck에 연결합니다.</p></button>
    </div>
  </section>
}
