import { useEffect, useState, type FormEvent } from 'react'
import { deckIcons } from './deckMetadata'
import type { Deck, DeckIcon, DeckInput } from '../types/deck'

interface DeckDialogProps {
  open: boolean
  deck: Deck | null
  onClose: () => void
  onSave: (payload: DeckInput) => Promise<void>
}

const empty: DeckInput = { name: '', description: '', icon: 'grid' }

export function DeckDialog({ open, deck, onClose, onSave }: DeckDialogProps) {
  const [form, setForm] = useState<DeckInput>(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) setForm(deck ? { name: deck.name, description: deck.description, icon: deck.icon as DeckIcon } : empty)
    setError(null)
  }, [open, deck])

  if (!open) return null
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null)
    try { await onSave({ ...form, name: form.name.trim(), description: form.description.trim() }); onClose() }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Deck을 저장하지 못했습니다.') }
    finally { setBusy(false) }
  }

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6" role="presentation">
    <form onSubmit={(event) => void submit(event)} role="dialog" aria-modal="true" aria-labelledby="deck-dialog-title" className="w-full max-w-lg rounded-t-[28px] border border-white/[0.1] bg-[#1c1c1e] p-6 shadow-2xl sm:rounded-[28px]">
      <h2 id="deck-dialog-title" className="text-[24px] font-bold text-white">{deck ? 'Deck 수정' : 'Deck 추가'}</h2>
      <p className="mt-2 text-sm text-zinc-500">자주 사용하는 Action을 하나의 Deck으로 묶습니다.</p>
      <div className="mt-6 space-y-4">
        <label className="block text-xs font-medium text-zinc-500">Deck 이름<input autoFocus required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Backend Deck" className="mt-2 w-full border border-line bg-ink px-4 py-3 text-sm text-white outline-none focus:border-apple" /></label>
        <label className="block text-xs font-medium text-zinc-500">설명<textarea maxLength={500} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="서버와 API 개발에 사용하는 기능" className="mt-2 w-full resize-none rounded-xl border border-line bg-ink px-4 py-3 text-sm text-white outline-none focus:border-apple" /></label>
        <div><p className="text-xs font-medium text-zinc-500">아이콘</p><div className="mt-2 grid grid-cols-6 gap-2">{(Object.entries(deckIcons) as [DeckIcon, string][]).map(([icon, symbol]) => <button key={icon} type="button" onClick={() => setForm({ ...form, icon })} aria-label={`${icon} 아이콘`} className={`h-12 rounded-xl border font-mono ${form.icon === icon ? 'border-apple bg-apple/10 text-apple' : 'border-line text-zinc-500'}`}>{symbol}</button>)}</div></div>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-rose-400">{error}</p>}
      <div className="mt-6 flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-xl bg-[#2c2c2e] px-4 py-2.5 text-sm font-semibold text-zinc-300">취소</button><button type="submit" disabled={busy || !form.name.trim()} className="rounded-xl bg-apple px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy ? '저장 중…' : '저장'}</button></div>
    </form>
  </div>
}
