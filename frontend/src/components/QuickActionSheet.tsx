import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

export type QuickActionSheetSize = 'sm' | 'md' | 'lg'
export type QuickActionSheetStatus = 'idle' | 'loading' | 'success' | 'error'

interface QuickActionSheetProps {
  title: string
  subtitle: string
  size?: QuickActionSheetSize
  status?: QuickActionSheetStatus
  dirty?: boolean
  autoCloseMs?: number
  children: ReactNode
  onClose: () => void
}

const sizeClasses: Record<QuickActionSheetSize, string> = {
  sm: 'max-w-lg',
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function QuickActionSheet({ title, subtitle, size = 'md', status = 'idle', dirty = false, autoCloseMs, children, onClose }: QuickActionSheetProps) {
  const sheetRef = useRef<HTMLElement | null>(null)
  const discardRef = useRef<HTMLDivElement | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const requestCloseRef = useRef<() => void>(() => undefined)
  const confirmDiscardRef = useRef(false)
  const [closing, setClosing] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const finishClose = useCallback(() => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
    setClosing(true)
    closeTimerRef.current = window.setTimeout(onClose, 190)
  }, [onClose])

  const requestClose = useCallback(() => {
    if (status === 'loading') return
    if (dirty) setConfirmDiscard(true)
    else finishClose()
  }, [dirty, finishClose, status])
  requestCloseRef.current = requestClose
  confirmDiscardRef.current = confirmDiscard

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => {
      const focusable = sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      ;(focusable?.[0] ?? sheetRef.current)?.focus()
    }, 0)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (confirmDiscardRef.current) {
          setConfirmDiscard(false)
          window.setTimeout(() => sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus(), 0)
        }
        else requestCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusRoot = confirmDiscardRef.current ? discardRef.current : sheetRef.current
      const focusable = [...(focusRoot?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!focusRoot?.contains(document.activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
        return
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      restoreFocusRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    if (status !== 'success' || !autoCloseMs) return
    const timer = window.setTimeout(finishClose, autoCloseMs)
    return () => window.clearTimeout(timer)
  }, [autoCloseMs, finishClose, status])

  return <div role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) requestClose() }} className={`fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 backdrop-blur-[6px] sm:items-center sm:p-6 ${closing ? 'quick-sheet-overlay-closing' : 'quick-sheet-overlay'}`}>
    <section ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="quick-sheet-title" aria-describedby="quick-sheet-subtitle" aria-busy={status === 'loading'} tabIndex={-1} className={`relative max-h-[88vh] w-full overflow-y-auto rounded-t-[28px] border border-white/[0.1] bg-[#1c1c1e] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] outline-none sm:rounded-[28px] sm:p-7 ${sizeClasses[size]} ${closing ? 'quick-sheet-closing' : 'quick-sheet-opening'}`}>
      <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-5"><div className="min-w-0"><h2 id="quick-sheet-title" className="text-2xl font-semibold tracking-tight text-white">{title}</h2><p id="quick-sheet-subtitle" className="mt-1 text-sm leading-6 text-zinc-500">{subtitle}</p></div><button type="button" disabled={status === 'loading'} onClick={requestClose} aria-label="Quick Action 닫기" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-xl text-zinc-300 hover:text-white disabled:opacity-30">×</button></div>
      <div className="pt-5">{children}</div>

      {confirmDiscard && <div ref={discardRef} className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-black/75 p-5 backdrop-blur-sm"><div role="alertdialog" aria-modal="true" aria-labelledby="discard-title" className="w-full max-w-sm rounded-[22px] border border-white/[0.1] bg-[#2c2c2e] p-5"><h3 id="discard-title" className="text-lg font-semibold text-white">작성 중인 내용이 있습니다.</h3><p className="mt-2 text-sm leading-6 text-zinc-400">변경 내용을 저장하지 않고 닫을까요?</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" autoFocus onClick={() => { setConfirmDiscard(false); window.setTimeout(() => sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus(), 0) }} className="rounded-xl bg-white/[0.07] px-3 py-2.5 text-sm font-semibold text-zinc-200">계속 작성</button><button type="button" onClick={finishClose} className="rounded-xl bg-rose-400/10 px-3 py-2.5 text-sm font-semibold text-rose-300">닫기</button></div></div></div>}
    </section>
  </div>
}
