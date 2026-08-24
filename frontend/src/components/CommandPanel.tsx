import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ConfirmationDialog } from './ConfirmationDialog'
import type { CommandRun, SavedCommand, SavedCommandInput } from '../types/command'

interface CommandPanelProps {
  project: { name: string; path: string } | null
  commands: SavedCommand[]
  runs: CommandRun[]
  loading: boolean
  error: string | null
  onCreate: (payload: SavedCommandInput) => Promise<void>
  onUpdate: (commandId: number, payload: SavedCommandInput) => Promise<void>
  onDelete: (commandId: number) => Promise<void>
  onRun: (commandId: number) => Promise<CommandRun>
  onStop: (runId: number) => Promise<CommandRun>
}

const statusStyles = {
  queued: 'text-amber-300',
  running: 'text-sky-300',
  succeeded: 'text-lime',
  failed: 'text-rose-400',
  stopped: 'text-zinc-400',
}

const statusLabels = {
  queued: '대기 중', running: '실행 중', succeeded: '완료', failed: '실패', stopped: '중지됨',
}

const emptyForm: SavedCommandInput = { name: '', command: '', working_directory: '.' }

export function CommandPanel({ project, commands, runs, loading, error, onCreate, onUpdate, onDelete, onRun, onStop }: CommandPanelProps) {
  const [form, setForm] = useState<SavedCommandInput>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [pendingCommand, setPendingCommand] = useState<SavedCommand | null>(null)
  const [pendingStop, setPendingStop] = useState<CommandRun | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null,
    [runs, selectedRunId],
  )

  useEffect(() => {
    if (selectedRunId === null && runs[0]) setSelectedRunId(runs[0].id)
  }, [runs, selectedRunId])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setActionError(null)
    setSuccess(null)
    try {
      if (editingId === null) await onCreate(form)
      else await onUpdate(editingId, form)
      setSuccess(editingId === null ? 'Command가 저장되었습니다.' : 'Command가 수정되었습니다.')
      setEditingId(null)
      setForm(emptyForm)
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Command를 저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const confirmRun = async () => {
    if (!pendingCommand) return
    setBusy(true)
    setActionError(null)
    setSuccess(null)
    try {
      const run = await onRun(pendingCommand.id)
      setSelectedRunId(run.id)
      setPendingCommand(null)
      setSuccess(`${run.name} Command를 실행하고 있습니다.`)
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Command를 시작하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const confirmStop = async () => {
    if (!pendingStop) return
    setBusy(true)
    setActionError(null)
    try {
      await onStop(pendingStop.id)
      setPendingStop(null)
      setSuccess(`${pendingStop.name} Command가 중지되었습니다.`)
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Command를 중지하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const workingDirectory = pendingCommand && project
    ? (pendingCommand.working_directory === '.'
        ? project.path
        : pendingCommand.working_directory.startsWith('/')
          ? pendingCommand.working_directory
          : `${project.path}/${pendingCommand.working_directory}`)
    : pendingCommand?.working_directory

  return (
    <section id="command-runner" aria-labelledby="command-title" className="rounded-[28px] bg-panel p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="command-title" className="text-[22px] font-semibold tracking-tight text-white">Custom Command</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">선택한 프로젝트에서 실행할 Command를 등록하고 결과를 확인합니다.</p>
        </div>
        {runs.some((run) => run.status === 'running') && <span className="rounded-full bg-apple/10 px-3 py-1.5 text-xs text-apple">● 실행 중</span>}
      </div>

      {(error || actionError || success) && (
        <p role="status" className={`mt-5 rounded-xl border px-4 py-3 text-sm ${error || actionError ? 'border-rose-400/20 bg-rose-400/[0.06] text-rose-300' : 'border-lime/20 bg-lime/[0.06] text-lime'}`}>
          {error ?? actionError ?? success}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="space-y-2">
            {commands.map((command) => {
              const activeRun = runs.find((run) => run.command_id === command.id && (run.status === 'queued' || run.status === 'running'))
              return (
                <div key={command.id} className="rounded-2xl border border-line bg-ink/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-200">{command.name}</p>
                      <p className="mt-1 truncate font-mono text-xs text-zinc-500">{command.command}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-zinc-700">cwd · {command.working_directory}</p>
                    </div>
                    {activeRun && <span className="shrink-0 text-xs text-apple">실행 중</span>}
                  </div>
                  <div className="mt-4 flex gap-2">
                    {activeRun ? (
                      <button type="button" onClick={() => setPendingStop(activeRun)} className="rounded-lg bg-[#ff453a]/10 px-3 text-xs font-semibold text-[#ff6961]">중지</button>
                    ) : (
                      <button type="button" disabled={!project || busy} onClick={() => setPendingCommand(command)} className="rounded-lg bg-apple px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30">실행</button>
                    )}
                    <button type="button" disabled={busy} onClick={() => { setEditingId(command.id); setForm({ name: command.name, command: command.command, working_directory: command.working_directory }) }} className="rounded-lg bg-white/[0.06] px-3 text-xs text-zinc-300 hover:text-white">수정</button>
                    <button
                      type="button"
                      disabled={busy || Boolean(activeRun)}
                      onClick={() => {
                        if (window.confirm(`${command.name} Command를 삭제할까요? 실행 기록은 유지됩니다.`)) {
                          setBusy(true)
                          void onDelete(command.id).catch((requestError: unknown) => setActionError(requestError instanceof Error ? requestError.message : 'Command를 삭제하지 못했습니다.')).finally(() => setBusy(false))
                        }
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs text-zinc-600 hover:text-rose-400 disabled:opacity-30"
                    >삭제</button>
                  </div>
                </div>
              )
            })}
            {!commands.length && !loading && <div className="rounded-2xl border border-dashed border-zinc-700 p-6 text-center"><p className="text-sm font-medium text-zinc-300">아직 등록된 Command가 없습니다.</p><p className="mt-1 text-xs text-zinc-600">자주 사용하는 개발 명령을 아래에서 추가하세요.</p></div>}
          </div>

          <form onSubmit={(event) => void submit(event)} className="mt-5 rounded-2xl border border-line p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-300">{editingId === null ? 'Custom Command 추가' : 'Custom Command 수정'}</h3>
              {editingId !== null && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm) }} className="text-xs text-zinc-500 hover:text-white">수정 취소</button>}
            </div>
            <div className="mt-3 space-y-3">
              <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Action 이름 · FastAPI 실행" className="w-full border border-line bg-ink px-4 py-3 text-sm text-white outline-none focus:border-apple" />
              <input required value={form.command} onChange={(event) => setForm({ ...form, command: event.target.value })} placeholder="실행 Command · uvicorn app.main:app --reload" className="w-full border border-line bg-ink px-4 py-3 font-mono text-sm text-white outline-none focus:border-apple" />
              <input required value={form.working_directory} onChange={(event) => setForm({ ...form, working_directory: event.target.value })} placeholder="Working Directory · backend" className="w-full border border-line bg-ink px-4 py-3 font-mono text-sm text-white outline-none focus:border-apple" />
            </div>
            <button type="submit" disabled={busy || !form.name.trim() || !form.command.trim() || !form.working_directory.trim()} className="mt-3 w-full rounded-xl bg-apple px-4 py-2.5 text-sm font-semibold text-white hover:bg-apple-hover disabled:cursor-not-allowed disabled:opacity-30">{editingId === null ? 'Command 저장' : '변경사항 저장'}</button>
          </form>
        </div>

        <div className="min-w-0">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {runs.slice(0, 10).map((run) => (
              <button key={run.id} type="button" onClick={() => setSelectedRunId(run.id)} className={`shrink-0 rounded-xl border px-3 py-2 text-left ${selectedRun?.id === run.id ? 'border-lime/40 bg-lime/[0.05]' : 'border-line bg-ink/40'}`}>
                <span className="block max-w-28 truncate text-xs font-semibold text-zinc-300">{run.name}</span>
                <span className={`mt-1 block text-[10px] ${statusStyles[run.status]}`}>● {statusLabels[run.status]}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 min-h-80 overflow-hidden rounded-2xl border border-line bg-[#050607]">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-mono text-xs text-zinc-500">{selectedRun ? `$ ${selectedRun.command}` : '실행 결과'}</span>
              {selectedRun && <span className={`text-[10px] ${statusStyles[selectedRun.status]}`}>{statusLabels[selectedRun.status]}{selectedRun.exit_code !== null ? ` · exit ${selectedRun.exit_code}` : ''}</span>}
            </div>
            {selectedRun ? (
              <div className="max-h-[32rem] overflow-auto p-4 font-mono text-xs leading-6">
                <pre className="whitespace-pre-wrap break-words text-zinc-300">{selectedRun.stdout || 'stdout 출력을 기다리는 중입니다…'}</pre>
                {selectedRun.stderr && <pre className="mt-3 whitespace-pre-wrap break-words border-t border-rose-400/10 pt-3 text-rose-300">{selectedRun.stderr}</pre>}
              </div>
            ) : (
              <p className="p-6 text-center text-sm text-zinc-600">저장된 Command를 실행하면 stdout과 stderr가 여기에 표시됩니다.</p>
            )}
          </div>
        </div>
      </div>

      <ConfirmationDialog open={pendingCommand !== null} title="다음 Command를 실행할까요?" description="아래 내용을 확인한 후 선택한 Mac 프로젝트에서 실행합니다." confirmLabel="Command 실행" busy={busy} onCancel={() => setPendingCommand(null)} onConfirm={() => void confirmRun()}>
        <dl className="space-y-3 rounded-2xl border border-line bg-ink p-4 text-sm">
          <div><dt className="text-zinc-500">Command</dt><dd className="mt-1 break-all font-mono text-zinc-200">{pendingCommand?.command}</dd></div>
          <div><dt className="text-zinc-500">Working directory</dt><dd className="mt-1 break-all font-mono text-xs text-zinc-300">{workingDirectory}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-zinc-500">Project</dt><dd className="text-zinc-200">{project?.name}</dd></div>
        </dl>
      </ConfirmationDialog>

      <ConfirmationDialog open={pendingStop !== null} title="이 Command를 중지할까요?" description="실행 중인 프로세스를 종료하고 중지 상태로 기록합니다." confirmLabel="Command 중지" busy={busy} onCancel={() => setPendingStop(null)} onConfirm={() => void confirmStop()}>
        <div className="rounded-2xl border border-line bg-ink p-4 font-mono text-sm text-zinc-300">{pendingStop?.command}</div>
      </ConfirmationDialog>
    </section>
  )
}
