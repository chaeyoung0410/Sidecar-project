import type { ReactNode } from 'react'

interface ConfirmationDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  busy: boolean
  disabled?: boolean
  children: ReactNode
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  busy,
  disabled = false,
  children,
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="presentation">
      <section role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" className="w-full max-w-lg rounded-t-[28px] border border-white/[0.1] bg-[#1c1c1e] p-6 shadow-2xl sm:rounded-[28px]">
        <p className="text-xs font-semibold text-[#ffd60a]">실행 전 확인</p>
        <h2 id="confirmation-title" className="mt-2 text-2xl font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
        <div className="mt-6">{children}</div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" disabled={busy} onClick={onCancel} className="rounded-xl bg-[#2c2c2e] px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-[#3a3a3c] disabled:opacity-40">취소</button>
          <button type="button" disabled={busy || disabled} onClick={onConfirm} className="rounded-xl bg-apple px-4 py-3 text-sm font-semibold text-white hover:bg-[#409cff] disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? '처리 중…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
