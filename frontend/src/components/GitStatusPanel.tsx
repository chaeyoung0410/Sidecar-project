import { useEffect, useState } from 'react'
import { ConfirmationDialog } from './ConfirmationDialog'
import type { GitCommitResult, GitPullPreview, GitPullResult, GitPushPreview, GitPushResult, GitStatus } from '../types/git'

interface GitStatusPanelProps {
  status: GitStatus | null
  loading: boolean
  error: string | null
  hasProject: boolean
  onRefresh: () => void
  onManageProjects: () => void
  onCommit: (files: string[], message: string) => Promise<GitCommitResult>
  onGetPushPreview: () => Promise<GitPushPreview>
  onPush: () => Promise<GitPushResult>
  onGetPullPreview: () => Promise<GitPullPreview>
  onPull: () => Promise<GitPullResult>
}

const statusNames: Record<string, string> = {
  M: 'Modified', A: 'Added', D: 'Deleted', R: 'Renamed', C: 'Copied', '?': 'Untracked', U: 'Conflict',
}

export function GitStatusPanel({ status, loading, error, hasProject, onRefresh, onManageProjects, onCommit, onGetPushPreview, onPush, onGetPullPreview, onPull }: GitStatusPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [commitOpen, setCommitOpen] = useState(false)
  const [pushOpen, setPushOpen] = useState(false)
  const [pushPreview, setPushPreview] = useState<GitPushPreview | null>(null)
  const [pullOpen, setPullOpen] = useState(false)
  const [pullPreview, setPullPreview] = useState<GitPullPreview | null>(null)
  const [pullResult, setPullResult] = useState<GitPullResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const availablePaths = new Set(status?.changed_files.map((file) => file.path) ?? [])
    setSelected((current) => new Set([...current].filter((path) => availablePaths.has(path))))
  }, [status])

  const toggleFile = (path: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const openPushConfirmation = async () => {
    setBusy(true)
    setActionError(null)
    setSuccess(null)
    try {
      setPushPreview(await onGetPushPreview())
      setPushOpen(true)
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Git Push 정보를 준비하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const confirmCommit = async () => {
    setBusy(true)
    setActionError(null)
    try {
      const result = await onCommit([...selected], message)
      setCommitOpen(false)
      setSelected(new Set())
      setMessage('')
      setSuccess(`Git Commit이 완료되었습니다 · ${result.commit}`)
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Git Commit에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const confirmPush = async () => {
    setBusy(true)
    setActionError(null)
    try {
      const result = await onPush()
      setPushOpen(false)
      setSuccess(result.pushed ? `Git Push가 완료되었습니다 · origin/${result.branch}` : result.message)
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Git Push에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const openPullConfirmation = async () => {
    setBusy(true)
    setActionError(null)
    setSuccess(null)
    setPullResult(null)
    try {
      setPullPreview(await onGetPullPreview())
      setPullOpen(true)
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Git Pull 정보를 준비하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const confirmPull = async () => {
    setBusy(true)
    setActionError(null)
    try {
      const result = await onPull()
      setPullOpen(false)
      setPullResult(result)
      if (result.conflict) {
        setActionError(`Merge Conflict가 발생했습니다 · 충돌 파일 ${result.conflict_files.length}개`)
      } else if (!result.success) {
        setActionError(`Git Pull에 실패했습니다 · ${result.message}`)
      } else if (result.already_up_to_date) {
        setSuccess('이미 최신 상태입니다. 새로 가져올 원격 변경사항이 없습니다.')
      } else {
        setSuccess(`Git Pull이 완료되었습니다 · Commit ${result.commits}개 · 변경 파일 ${result.files_changed}개`)
      }
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Git Pull에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const allSelected = Boolean(status?.changed_files.length) && selected.size === status?.changed_files.length

  return (
    <section id="git" aria-labelledby="repository-title" className="py-12 sm:py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="repository-title" className="text-[30px] font-bold tracking-tight text-white">Git</h2>
          <p className="mt-2 text-[15px] leading-6 text-zinc-500">현재 프로젝트의 Git 상태와 변경 내용을 관리합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasProject && status && (
            <button type="button" disabled={busy || loading} onClick={() => void openPushConfirmation()} className="rounded-xl bg-[#2c2c2e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3a3a3c] disabled:opacity-40">Git Push</button>
          )}
          <button type="button" onClick={hasProject ? onRefresh : onManageProjects} disabled={loading || busy} className="rounded-xl bg-[#2c2c2e] px-4 text-sm font-semibold text-white hover:bg-[#3a3a3c] disabled:opacity-40">
            {hasProject ? (loading ? 'Git 상태를 불러오는 중…' : '새로고침') : '프로젝트 추가'}
          </button>
        </div>
      </div>

      {(actionError || success) && (
        <p role="status" className={`mt-5 rounded-xl border px-4 py-3 text-sm ${actionError ? 'border-rose-400/20 bg-rose-400/[0.06] text-rose-300' : 'border-lime/20 bg-lime/[0.06] text-lime'}`}>{actionError ?? success}</p>
      )}

      {pullResult && (pullResult.conflict || !pullResult.success) && (
        <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/[0.04] p-4 text-sm">
          {pullResult.conflict && <><p className="font-semibold text-rose-300">충돌 파일</p><ul className="mt-2 space-y-1 font-mono text-xs text-zinc-300">{pullResult.conflict_files.map((file) => <li key={file}>{file}</li>)}</ul><p className="mt-3 text-zinc-500">Mac의 VS Code에서 충돌 내용을 수정한 뒤 Commit해주세요. CodePad는 충돌을 자동 해결하지 않습니다.</p></>}
          {(pullResult.stdout || pullResult.stderr) && <details className="mt-3"><summary className="cursor-pointer text-xs text-zinc-500">Git 상세 정보</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-ink p-3 font-mono text-xs text-zinc-400">{[pullResult.stdout, pullResult.stderr].filter(Boolean).join('\n')}</pre></details>}
        </div>
      )}

      {hasProject && status && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-panel p-5">
          <div><p className="font-semibold text-zinc-100">Git Pull</p><p className="mt-1 text-sm leading-6 text-zinc-500">현재 Branch의 원격 변경사항을 로컬 프로젝트로 가져옵니다.</p></div>
          <button type="button" disabled={busy || loading} onClick={() => void openPullConfirmation()} className="rounded-xl bg-apple px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#409cff] disabled:opacity-40">{busy ? '원격 변경사항을 가져오는 중…' : 'Git Pull'}</button>
        </div>
      )}

      {error ? (
        <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4">
          <p className="text-sm font-semibold text-amber-200">Git Status를 확인할 수 없습니다.</p>
          <p className="mt-1 text-sm text-zinc-500">{error}</p>
        </div>
      ) : !hasProject ? (
        <div className="mt-6 rounded-[20px] bg-panel p-7 text-center"><p className="font-semibold text-zinc-200">선택된 프로젝트가 없습니다.</p><p className="mt-2 text-sm text-zinc-500">Mac 프로젝트를 등록하면 현재 Branch와 변경 파일을 확인할 수 있습니다.</p></div>
      ) : status?.changed_files.length ? (
        <>
          <div className="mt-6 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-zinc-500">
              <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(status.changed_files.map((file) => file.path)))} className="h-4 w-4 accent-[#b7f75c]" />
              전체 선택
            </label>
            <span className="text-xs text-zinc-600">{status.changed_files.length}개 중 {selected.size}개 선택</span>
          </div>
          <div className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {status.changed_files.map((file) => (
              <label key={`${file.status}-${file.path}`} className="flex min-h-14 cursor-pointer items-center gap-3 bg-panel px-4 py-3.5 hover:bg-[#242426]">
                <input type="checkbox" checked={selected.has(file.path)} onChange={() => toggleFile(file.path)} className="h-4 w-4 shrink-0 accent-[#b7f75c]" />
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] font-mono text-xs font-bold text-lime" aria-hidden="true">{file.status}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-sm text-zinc-300">{file.path}</span>
                  <span className="mt-0.5 block text-xs text-zinc-600">{statusNames[file.status] ?? file.status}{file.staged ? ' · Staged' : ''}{file.unstaged ? ' · Unstaged' : ''}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} placeholder="변경 내용을 간단하게 입력하세요." className="min-w-0 flex-1 border border-line bg-panel px-4 py-3 text-sm text-white outline-none focus:border-apple" />
            <button type="button" disabled={!selected.size || !message.trim() || busy} onClick={() => { setActionError(null); setSuccess(null); setCommitOpen(true) }} className="rounded-xl bg-apple px-6 py-3 text-sm font-semibold text-white hover:bg-[#409cff] disabled:cursor-not-allowed disabled:opacity-40">Git Commit</button>
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-[20px] bg-panel p-8 text-center">
          <p className="font-semibold text-zinc-200">변경된 파일이 없습니다.</p>
          <p className="mt-2 text-sm text-zinc-500">현재 프로젝트의 모든 변경 사항이 Commit된 상태입니다.</p>
        </div>
      )}

      <ConfirmationDialog open={commitOpen} title="Git Commit 확인" description="선택한 파일만 현재 Branch에 Commit합니다. 아래 내용을 확인하세요." confirmLabel="Git Commit" busy={busy} onCancel={() => setCommitOpen(false)} onConfirm={() => void confirmCommit()}>
        <dl className="space-y-3 rounded-2xl border border-line bg-ink p-4 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-zinc-500">Branch</dt><dd className="font-mono text-zinc-200">{status?.branch}</dd></div>
          <div><dt className="text-zinc-500">Commit Message</dt><dd className="mt-1 text-zinc-200">{message}</dd></div>
          <div><dt className="text-zinc-500">선택된 파일 · {selected.size}개</dt><dd className="mt-1 max-h-28 whitespace-pre-wrap overflow-y-auto font-mono text-xs leading-6 text-zinc-300">{[...selected].join('\n')}</dd></div>
        </dl>
      </ConfirmationDialog>

      <ConfirmationDialog open={pushOpen} title="Git Push를 진행할까요?" description="현재 Branch의 Commit을 원격 Repository로 Push합니다. Force Push는 지원하지 않습니다." confirmLabel="Git Push" busy={busy} disabled={!pushPreview?.ahead} onCancel={() => setPushOpen(false)} onConfirm={() => void confirmPush()}>
        <dl className="space-y-3 rounded-2xl border border-line bg-ink p-4 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-zinc-500">Repository</dt><dd className="text-zinc-200">{pushPreview?.repository}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-zinc-500">Branch</dt><dd className="font-mono text-zinc-200">{pushPreview?.branch}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-zinc-500">원격 Repository</dt><dd className="font-mono text-zinc-200">origin/{pushPreview?.branch}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-zinc-500">Push할 Commit</dt><dd className="font-mono text-apple">{pushPreview?.ahead ?? 0}개</dd></div>
        </dl>
      </ConfirmationDialog>

      <ConfirmationDialog open={pullOpen} title={pullPreview?.changed_files.length ? '로컬 변경사항이 있습니다.' : 'Git Pull을 진행할까요?'} description={pullPreview?.changed_files.length ? 'Git Pull을 진행하면 Merge Conflict가 발생할 수 있습니다. 변경사항은 자동으로 Stash하지 않습니다.' : '원격 Repository의 최신 변경사항을 현재 프로젝트로 가져옵니다.'} confirmLabel={pullPreview?.changed_files.length ? '그래도 Git Pull' : 'Git Pull'} busy={busy} onCancel={() => setPullOpen(false)} onConfirm={() => void confirmPull()}>
        <dl className="space-y-3 rounded-2xl border border-line bg-ink p-4 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-zinc-500">Repository</dt><dd className="text-zinc-200">{pullPreview?.repository}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-zinc-500">현재 Branch</dt><dd className="font-mono text-zinc-200">{pullPreview?.branch}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-zinc-500">원격 Repository</dt><dd className="font-mono text-zinc-200">origin/{pullPreview?.branch}</dd></div>
          {Boolean(pullPreview?.changed_files.length) && <div><dt className="text-rose-300">Commit되지 않은 변경 파일 · {pullPreview?.changed_files.length}개</dt><dd className="mt-2 max-h-36 space-y-1 overflow-y-auto font-mono text-xs text-zinc-300">{pullPreview?.changed_files.map((file) => <p key={`${file.status}-${file.path}`}>{file.status === '?' ? '??' : file.status} {file.path}{file.staged ? ' · Staged' : ''}{file.unstaged ? ' · Unstaged' : ''}</p>)}</dd></div>}
        </dl>
      </ConfirmationDialog>
    </section>
  )
}
