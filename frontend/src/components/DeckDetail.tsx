import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { actionIcons } from './actionMetadata'
import { deckIcons } from './deckMetadata'
import type { DashboardAction } from '../types/action'
import type { Deck, DeckIcon } from '../types/deck'

const LONG_PRESS_MS = 500
const MOVE_TOLERANCE_PX = 10
const CLICK_SUPPRESSION_MS = 450

interface DeckDetailProps {
  deck: Deck
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onAdd: () => void
  onOpenAction: (action: DashboardAction) => void
  onEditAction: (action: DashboardAction) => void
  onRemoveAction: (actionId: number) => void
  onReorderActions: (actionIds: number[]) => Promise<void>
}

interface DragOverlayState {
  actionId: number
  left: number
  top: number
  width: number
  height: number
  offsetX: number
  offsetY: number
}

interface PointerSession {
  pointerId: number
  actionId: number
  startX: number
  startY: number
  currentX: number
  currentY: number
  timer: number | null
  active: boolean
  cancelled: boolean
  originalIds: number[]
  captureTarget: HTMLElement
}

function reorderToIndex(actions: DashboardAction[], draggedId: number, targetIndex: number): DashboardAction[] {
  const from = actions.findIndex((action) => action.id === draggedId)
  if (from < 0 || targetIndex < 0 || targetIndex >= actions.length || from === targetIndex) return actions
  const next = [...actions]
  const [dragged] = next.splice(from, 1)
  next.splice(targetIndex, 0, dragged)
  return next
}

function preventDragScroll(event: TouchEvent) {
  event.preventDefault()
}

export function DeckDetail({ deck, onBack, onEdit, onDelete, onAdd, onOpenAction, onEditAction, onRemoveAction, onReorderActions }: DeckDetailProps) {
  const [orderedActions, setOrderedActions] = useState(deck.actions)
  const [dragOverlay, setDragOverlay] = useState<DragOverlayState | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const orderedActionsRef = useRef(deck.actions)
  const pointerSessionRef = useRef<PointerSession | null>(null)
  const cardRefs = useRef(new Map<number, HTMLElement>())
  const dragSlotRectsRef = useRef<DOMRect[]>([])
  const previousRectsRef = useRef(new Map<number, DOMRect>())
  const suppressClickUntilRef = useRef(0)
  const savedTimerRef = useRef<number | null>(null)
  const previousBodyOverflowRef = useRef('')

  useEffect(() => {
    if (!pointerSessionRef.current?.active) {
      orderedActionsRef.current = deck.actions
      setOrderedActions(deck.actions)
    }
  }, [deck.actions])

  useEffect(() => () => {
    const session = pointerSessionRef.current
    if (session?.timer !== null && session?.timer !== undefined) window.clearTimeout(session.timer)
    if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current)
    document.removeEventListener('touchmove', preventDragScroll)
    document.body.style.overflow = previousBodyOverflowRef.current
  }, [])

  useLayoutEffect(() => {
    if (!previousRectsRef.current.size || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      previousRectsRef.current.clear()
      return
    }
    for (const [actionId, element] of cardRefs.current) {
      if (actionId === pointerSessionRef.current?.actionId) continue
      const previous = previousRectsRef.current.get(actionId)
      if (!previous) continue
      const current = element.getBoundingClientRect()
      const deltaX = previous.left - current.left
      const deltaY = previous.top - current.top
      if (!deltaX && !deltaY) continue
      element.animate(
        [{ transform: `translate(${deltaX}px, ${deltaY}px)` }, { transform: 'translate(0, 0)' }],
        { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
      )
    }
    previousRectsRef.current.clear()
  }, [orderedActions])

  const rememberRects = () => {
    previousRectsRef.current = new Map(
      [...cardRefs.current].map(([actionId, element]) => [actionId, element.getBoundingClientRect()]),
    )
  }

  const activateDrag = (session: PointerSession) => {
    if (pointerSessionRef.current !== session || session.cancelled) return
    const card = cardRefs.current.get(session.actionId)
    if (!card) return
    const rect = card.getBoundingClientRect()
    dragSlotRectsRef.current = orderedActionsRef.current.flatMap((action) => {
      const element = cardRefs.current.get(action.id)
      return element ? [element.getBoundingClientRect()] : []
    })
    session.active = true
    session.timer = null
    suppressClickUntilRef.current = Date.now() + CLICK_SUPPRESSION_MS
    previousBodyOverflowRef.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('touchmove', preventDragScroll, { passive: false })
    try { session.captureTarget.setPointerCapture(session.pointerId) } catch { /* Pointer may have ended at the activation boundary. */ }
    setDragOverlay({
      actionId: session.actionId,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      offsetX: session.currentX - rect.left,
      offsetY: session.currentY - rect.top,
    })
  }

  const endSession = (save: boolean) => {
    const session = pointerSessionRef.current
    if (!session) return
    if (session.timer !== null) window.clearTimeout(session.timer)
    if (session.active) {
      suppressClickUntilRef.current = Date.now() + CLICK_SUPPRESSION_MS
      document.removeEventListener('touchmove', preventDragScroll)
      document.body.style.overflow = previousBodyOverflowRef.current
    }
    try { session.captureTarget.releasePointerCapture(session.pointerId) } catch { /* Capture can already be released. */ }
    pointerSessionRef.current = null
    dragSlotRectsRef.current = []
    setDragOverlay(null)

    if (!session.active) {
      if (save && !session.cancelled) {
        suppressClickUntilRef.current = Date.now() + CLICK_SUPPRESSION_MS
        const action = orderedActionsRef.current.find((item) => item.id === session.actionId)
        if (action) onOpenAction(action)
      }
      return
    }
    const currentActions = orderedActionsRef.current
    const currentIds = currentActions.map((action) => action.id)
    const changed = currentIds.some((actionId, index) => actionId !== session.originalIds[index])
    if (!save) {
      const byId = new Map(currentActions.map((action) => [action.id, action]))
      const restored = session.originalIds.flatMap((actionId) => byId.get(actionId) ?? [])
      orderedActionsRef.current = restored
      setOrderedActions(restored)
      return
    }
    if (!changed) return

    setSaveState('saving')
    void onReorderActions(currentIds)
      .then(() => {
        setSaveState('saved')
        if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current)
        savedTimerRef.current = window.setTimeout(() => setSaveState('idle'), 1200)
      })
      .catch(() => {
        const byId = new Map(orderedActionsRef.current.map((action) => [action.id, action]))
        const restored = session.originalIds.flatMap((actionId) => byId.get(actionId) ?? [])
        orderedActionsRef.current = restored
        setOrderedActions(restored)
        setSaveState('error')
      })
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>, actionId: number) => {
    if (saveState === 'saving' || event.button !== 0 || !event.isPrimary) return
    if ((event.target as HTMLElement).closest('[data-no-action-drag]')) return
    const session: PointerSession = {
      pointerId: event.pointerId,
      actionId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      timer: null,
      active: false,
      cancelled: false,
      originalIds: orderedActionsRef.current.map((action) => action.id),
      captureTarget: event.currentTarget,
    }
    session.timer = window.setTimeout(() => activateDrag(session), LONG_PRESS_MS)
    pointerSessionRef.current = session
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const session = pointerSessionRef.current
    if (!session || session.pointerId !== event.pointerId) return
    session.currentX = event.clientX
    session.currentY = event.clientY
    const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY)
    if (!session.active) {
      if (distance > MOVE_TOLERANCE_PX) {
        session.cancelled = true
        if (session.timer !== null) window.clearTimeout(session.timer)
        session.timer = null
        suppressClickUntilRef.current = Date.now() + CLICK_SUPPRESSION_MS
        pointerSessionRef.current = null
      }
      return
    }

    event.preventDefault()
    setDragOverlay((current) => current ? {
      ...current,
      left: event.clientX - current.offsetX,
      top: event.clientY - current.offsetY,
    } : current)
    const targetIndex = dragSlotRectsRef.current.findIndex((rect) => (
      event.clientX >= rect.left
      && event.clientX <= rect.right
      && event.clientY >= rect.top
      && event.clientY <= rect.bottom
    ))
    if (targetIndex < 0) return
    const current = orderedActionsRef.current
    const next = reorderToIndex(current, session.actionId, targetIndex)
    if (next === current) return
    rememberRects()
    orderedActionsRef.current = next
    setOrderedActions(next)
  }

  const handleActionClick = (action: DashboardAction) => {
    if (Date.now() < suppressClickUntilRef.current || pointerSessionRef.current?.active) return
    onOpenAction(action)
  }

  const draggedAction = dragOverlay ? orderedActions.find((action) => action.id === dragOverlay.actionId) ?? null : null

  return <section className="py-12">
    <button type="button" onClick={onBack} className="text-sm font-medium text-apple">‹ Deck 목록</button>
    <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
      <div className="flex min-w-0 gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-apple/10 font-mono text-xl text-apple">{deckIcons[deck.icon as DeckIcon] ?? '▦'}</span><div><h2 className="break-words text-[32px] font-bold tracking-tight text-white">{deck.name}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">{deck.description || '이 Deck에 자주 사용하는 Action을 추가해보세요.'}</p><p className="mt-2 text-xs text-zinc-600">{deck.actions.length}개의 Action · 길게 눌러 순서 변경</p></div></div>
      <div className="flex items-center gap-3">{saveState !== 'idle' && <span role="status" className={`text-xs ${saveState === 'error' ? 'text-rose-300' : 'text-zinc-500'}`}>{saveState === 'saving' ? '순서 저장 중…' : saveState === 'saved' ? '순서 저장됨' : '순서를 저장하지 못해 이전 배치로 복원했습니다.'}</span>}<div className="flex gap-2"><button type="button" onClick={onEdit} className="rounded-xl bg-[#2c2c2e] px-4 py-2.5 text-sm font-semibold text-zinc-200">수정</button><button type="button" onClick={onDelete} className="rounded-xl bg-rose-400/10 px-4 py-2.5 text-sm font-semibold text-rose-300">삭제</button></div></div>
    </div>
    <div className="mt-9 grid grid-cols-2 gap-3 lg:grid-cols-3">
      {orderedActions.map((action) => <article
        key={action.id}
        ref={(element) => { if (element) cardRefs.current.set(action.id, element); else cardRefs.current.delete(action.id) }}
        data-action-card-id={action.id}
        onPointerDown={(event) => handlePointerDown(event, action.id)}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => { if (pointerSessionRef.current?.pointerId === event.pointerId) endSession(true) }}
        onPointerCancel={(event) => { if (pointerSessionRef.current?.pointerId === event.pointerId) endSession(false) }}
        onPointerLeave={(event) => {
          const session = pointerSessionRef.current
          if (event.pointerType === 'mouse' && session?.pointerId === event.pointerId && !session.active) {
            if (session.timer !== null) window.clearTimeout(session.timer)
            pointerSessionRef.current = null
          }
        }}
        onLostPointerCapture={(event) => { if (pointerSessionRef.current?.pointerId === event.pointerId) endSession(false) }}
        onContextMenu={(event) => { if (!(event.target as HTMLElement).closest('[data-no-action-drag]')) event.preventDefault() }}
        className={`sortable-action-card pressable-card relative flex min-h-44 flex-col rounded-[22px] border bg-panel p-5 sm:p-6 ${dragOverlay?.actionId === action.id ? 'is-drag-placeholder border-apple/15' : 'border-transparent hover:border-apple/30 hover:bg-[#242426]'}`}
      >
        <button type="button" aria-label={`${action.name} Quick Action 열기`} onClick={() => handleActionClick(action)} className="absolute inset-0 z-0 rounded-[inherit] text-left" />
        <div className="pointer-events-none relative z-[1] flex items-start justify-between gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-apple/15 font-mono text-apple">{actionIcons[action.icon]}</span>
          <details data-no-action-drag className="group/menu pointer-events-auto relative z-10">
            <summary aria-label={`${action.name} 관리 메뉴`} className="flex h-9 min-h-0 w-9 cursor-pointer list-none items-center justify-center rounded-full text-lg tracking-widest text-zinc-500 hover:bg-white/[0.07] hover:text-white">•••</summary>
            <div className="absolute right-0 top-10 w-40 overflow-hidden rounded-xl border border-white/[0.1] bg-[#2c2c2e] p-1 shadow-2xl">
              <button type="button" onClick={() => onEditAction(action)} className="w-full rounded-lg px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/[0.07]">Action 수정</button>
              <button type="button" onClick={() => onRemoveAction(action.id)} className="w-full rounded-lg px-3 py-2 text-left text-xs text-rose-300 hover:bg-white/[0.07]">Deck에서 제거</button>
            </div>
          </details>
        </div>
        <div className="pointer-events-none relative z-[1] mt-auto pt-7 text-left"><span className="text-[17px] font-semibold text-white">{action.name}</span></div>
      </article>)}
      <button type="button" onClick={onAdd} className="pressable-card min-h-44 rounded-[22px] border border-dashed border-white/[0.18] p-5 text-left hover:border-apple/60 hover:bg-apple/[0.04]"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-xl text-apple">＋</span><p className="mt-8 text-[17px] font-semibold text-white">Action 추가</p><p className="mt-2 text-sm text-zinc-500">기존 Action을 이 Deck에 연결합니다.</p></button>
    </div>

    {dragOverlay && draggedAction && createPortal(<div aria-hidden="true" className="quick-action-drag-overlay fixed z-[80] flex flex-col rounded-[22px] border border-apple/25 bg-[#242426] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.32)] sm:p-6" style={{ left: dragOverlay.left, top: dragOverlay.top, width: dragOverlay.width, height: dragOverlay.height }}><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-apple/15 font-mono text-apple">{actionIcons[draggedAction.icon]}</span><div className="mt-auto pt-7"><p className="text-[17px] font-semibold text-white">{draggedAction.name}</p><p className="mt-2 text-sm text-zinc-400">원하는 위치로 이동하세요.</p></div></div>, document.body)}
  </section>
}
