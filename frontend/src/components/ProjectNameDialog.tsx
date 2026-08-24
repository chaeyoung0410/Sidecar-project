import { useEffect, useState, type FormEvent } from 'react'
import type { Project } from '../types/project'

interface ProjectNameDialogProps {
  project: Project | null
  open: boolean
  onClose: () => void
  onSave: (projectId: number, name: string) => Promise<void>
}

export function ProjectNameDialog({ project, open, onClose, onSave }: ProjectNameDialogProps) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && project) setName(project.name)
    setError(null)
  }, [open, project])

  if (!open || !project) return null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave(project.id, name.trim())
      onClose()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '프로젝트 이름을 수정하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6" role="presentation">
      <form onSubmit={(event) => void submit(event)} role="dialog" aria-modal="true" aria-labelledby="project-name-title" className="w-full max-w-md rounded-t-[28px] border border-white/[0.1] bg-[#1c1c1e] p-6 shadow-2xl sm:rounded-[28px]">
        <h2 id="project-name-title" className="text-[24px] font-bold text-white">프로젝트 이름 수정</h2>
        <p className="mt-2 text-sm text-zinc-500">표시 이름만 변경되며 로컬 경로는 그대로 유지됩니다.</p>
        <label className="mt-6 block text-xs font-medium text-zinc-500">
          프로젝트 이름
          <input autoFocus required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full border border-line bg-ink px-4 py-3 text-sm text-white outline-none focus:border-apple" />
        </label>
        <div className="mt-4 rounded-xl bg-black/20 px-4 py-3"><p className="text-xs text-zinc-500">프로젝트 경로</p><p className="mt-1 break-all font-mono text-xs text-zinc-400">{project.path}</p></div>
        {error && <p role="alert" className="mt-3 text-sm text-rose-400">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-xl bg-[#2c2c2e] px-4 py-2.5 text-sm font-semibold text-zinc-300">취소</button>
          <button type="submit" disabled={busy || !name.trim()} className="rounded-xl bg-apple px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy ? '저장 중…' : '저장'}</button>
        </div>
      </form>
    </div>
  )
}
