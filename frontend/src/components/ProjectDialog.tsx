import { useEffect, useState, type FormEvent } from 'react'
import type { Project, ProjectCreate } from '../types/project'

interface ProjectDialogProps {
  open: boolean
  projects: Project[]
  onClose: () => void
  onCreate: (payload: ProjectCreate) => Promise<void>
  onSelect: (projectId: number) => Promise<void>
  onDelete: (projectId: number) => Promise<void>
}

export function ProjectDialog({ open, projects, onClose, onCreate, onSelect, onDelete }: ProjectDialogProps) {
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) setError(null)
  }, [open])

  if (!open) return null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onCreate({ name: name.trim(), path: path.trim() })
      setName('')
      setPath('')
      onClose()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '프로젝트를 등록하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '프로젝트 작업에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] border border-white/[0.1] bg-[#1c1c1e] p-5 shadow-2xl sm:rounded-[28px] sm:p-7"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 id="project-dialog-title" className="text-[28px] font-bold">프로젝트</h2>
            <p className="mt-2 text-sm text-zinc-500">Mac에서 작업할 프로젝트를 선택합니다.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-[#2c2c2e] px-4 text-sm text-zinc-300 hover:text-white">
            닫기
          </button>
        </div>

        {projects.length > 0 && (
          <div className="mt-6 space-y-2">
            {projects.map((project) => (
              <div key={project.id} className={`flex items-center gap-3 rounded-2xl p-4 ${project.is_selected ? 'bg-apple/[0.12]' : 'bg-[#2c2c2e]'}`}>
                <button
                  type="button"
                  disabled={busy || project.is_selected}
                  onClick={() => void runAction(() => onSelect(project.id))}
                  className="min-w-0 flex-1 text-left disabled:cursor-default"
                >
                  <span className="flex items-center gap-2 font-semibold text-zinc-100">
                    {project.name}
                    {project.is_selected && <span className="rounded-full bg-apple/15 px-2 py-0.5 text-[10px] text-apple">선택됨</span>}
                  </span>
                  <span className="mt-1 block truncate font-mono text-xs text-zinc-500">{project.path}</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`${project.name} 프로젝트를 CodePad에서 삭제할까요? 실제 파일은 삭제되지 않습니다.`)) {
                      void runAction(() => onDelete(project.id))
                    }
                  }}
                  className="rounded-lg px-2 py-1 text-xs text-zinc-600 hover:bg-rose-400/10 hover:text-rose-400"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
        {projects.length === 0 && <div className="mt-6 rounded-[20px] bg-[#2c2c2e] p-7 text-center"><p className="font-semibold text-zinc-200">아직 등록된 프로젝트가 없습니다.</p><p className="mt-2 text-sm leading-6 text-zinc-500">아래에 Mac 프로젝트의 이름과<br />절대 경로를 입력해 등록하세요.</p></div>}

        <form onSubmit={(event) => void submit(event)} className="mt-7 border-t border-line pt-6">
          <h3 className="font-semibold text-zinc-200">프로젝트 등록</h3>
          <p className="mt-1 text-sm text-zinc-500">이 Mac에 존재하는 폴더의 절대 경로를 입력하세요.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[0.8fr_1.6fr]">
            <label className="text-xs font-medium text-zinc-500">
              표시 이름
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="CodePad"
                className="mt-2 w-full border border-line bg-ink px-4 py-3 text-sm text-white outline-none focus:border-apple"
              />
            </label>
            <label className="text-xs font-medium text-zinc-500">
              절대 경로
              <input
                required
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="/Users/me/Projects/codepad"
                className="mt-2 w-full border border-line bg-ink px-4 py-3 font-mono text-sm text-white outline-none focus:border-apple"
              />
            </label>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={busy || !name.trim() || !path.trim()}
            className="mt-4 w-full rounded-xl bg-apple px-5 py-3 text-sm font-semibold text-white transition hover:bg-apple-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? '등록하는 중…' : '등록하고 선택'}
          </button>
        </form>
      </section>
    </div>
  )
}
