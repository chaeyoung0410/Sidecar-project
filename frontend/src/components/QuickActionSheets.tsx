import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QuickActionSheet, type QuickActionSheetStatus } from './QuickActionSheet'
import { analyzeError, generateJournal, getAIStatus, getAnalysisContext, getJournalContext, getLatestAnalysis } from '../services/aiApi'
import type { DashboardAction } from '../types/action'
import type { AIAnalysis, AIStatus, DevelopmentJournalContext, ErrorAnalysisContext } from '../types/ai'
import type { CommandRun, SavedCommand } from '../types/command'
import type { ErrorHistory } from '../types/error'
import type { CommitMessageSuggestions, GitCommitResult, GitPullPreview, GitPullResult, GitPushPreview, GitPushResult, GitStatus } from '../types/git'
import type { NotionLog, NotionLogInput, NotionStatus } from '../types/notion'
import type { Project } from '../types/project'

interface QuickActionSheetsProps {
  action: DashboardAction | null
  gitStatus: GitStatus | null
  errors: ErrorHistory[]
  notionStatus: NotionStatus | null
  notionSaving: boolean
  commands: SavedCommand[]
  project: Project | null
  onClose: () => void
  onOpenFull: (route: '#error-monitor' | '#git' | '#notion-journal' | '#actions') => void
  onCommit: (files: string[], message: string) => Promise<GitCommitResult>
  onSuggestCommitMessages: (files: string[], language?: 'en' | 'ko') => Promise<CommitMessageSuggestions>
  onGetPushPreview: () => Promise<GitPushPreview>
  onPush: () => Promise<GitPushResult>
  onGetPullPreview: () => Promise<GitPullPreview>
  onPull: () => Promise<GitPullResult>
  onSaveNotion: (input: NotionLogInput) => Promise<NotionLog>
  onRunCommand: (commandId: number) => Promise<CommandRun>
}

function requestStatus(busy: boolean, success: boolean, error: string | null): QuickActionSheetStatus {
  if (busy) return 'loading'
  if (success) return 'success'
  if (error) return 'error'
  return 'idle'
}

function ErrorMessage({ message }: { message: string | null }) {
  return message ? <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm leading-6 text-rose-300">{message}</p> : null
}

function SuccessMessage({ children }: { children: string }) {
  return <div className="rounded-2xl bg-lime/[0.08] p-6 text-center"><p className="text-2xl text-lime">✓</p><p className="mt-2 font-semibold text-white">{children}</p></div>
}

function EmptyGit({ onOpenFull }: { onOpenFull: () => void }) {
  return <div className="py-6 text-center"><p className="font-semibold text-zinc-200">Git 변경 정보를 사용할 수 없습니다.</p><p className="mt-2 text-sm text-zinc-500">프로젝트와 Git Status를 확인해주세요.</p><button type="button" onClick={onOpenFull} className="mt-4 text-sm font-medium text-apple">Git 전체 보기 →</button></div>
}

function GitCommitSheet({ gitStatus, onClose, onOpenFull, onCommit, onSuggest }: { gitStatus: GitStatus | null; onClose: () => void; onOpenFull: () => void; onCommit: QuickActionSheetsProps['onCommit']; onSuggest: QuickActionSheetsProps['onSuggestCommitMessages'] }) {
  const availableFiles = useMemo(() => gitStatus?.changed_files ?? [], [gitStatus?.changed_files])
  const [initialPaths, setInitialPaths] = useState(() => new Set(availableFiles.map((file) => file.path)))
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialPaths))
  const initializedRef = useRef(availableFiles.length > 0)
  const [message, setMessage] = useState('')
  const [suggestions, setSuggestions] = useState<CommitMessageSuggestions | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const dirty = Boolean(message.trim()) || selected.size !== initialPaths.size

  useEffect(() => {
    if (initializedRef.current || !availableFiles.length) return
    const paths = new Set(availableFiles.map((file) => file.path))
    initializedRef.current = true
    setInitialPaths(paths)
    setSelected(new Set(paths))
  }, [availableFiles])

  const suggest = async () => {
    if (selected.size > 20) { setError('AI 추천은 최대 20개 파일까지 분석할 수 있습니다.'); return }
    setBusy(true); setError(null)
    try { setSuggestions(await onSuggest([...selected], 'en')) }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Commit Message 추천에 실패했습니다.') }
    finally { setBusy(false) }
  }
  const commit = async () => {
    setBusy(true); setError(null)
    try { await onCommit([...selected], message); setSuccess(true) }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Git Commit에 실패했습니다.') }
    finally { setBusy(false) }
  }

  return <QuickActionSheet title="Git Commit" subtitle="선택한 변경 파일을 현재 Branch에 Commit합니다." size="lg" status={requestStatus(busy, success, error)} dirty={!success && dirty} autoCloseMs={success ? 850 : undefined} onClose={onClose}>
    {success ? <SuccessMessage>Git Commit이 완료되었습니다.</SuccessMessage> : !gitStatus ? <EmptyGit onOpenFull={onOpenFull} /> : !availableFiles.length ? <div className="py-6 text-center text-sm text-zinc-500">Commit할 변경 파일이 없습니다.</div> : <div className="space-y-5">
      <div className="flex justify-between rounded-xl bg-black/20 px-4 py-3 text-sm"><span className="text-zinc-500">현재 Branch</span><span className="font-mono text-zinc-200">{gitStatus.branch}</span></div>
      <div><div className="flex items-center justify-between"><p className="text-sm font-semibold text-zinc-300">변경된 파일</p><button type="button" onClick={() => setSelected(selected.size === availableFiles.length ? new Set() : new Set(initialPaths))} className="min-h-0 text-xs text-apple">{selected.size === availableFiles.length ? '전체 해제' : '전체 선택'}</button></div><div className="mt-2 max-h-52 divide-y divide-white/[0.07] overflow-y-auto rounded-xl border border-white/[0.08]">{availableFiles.map((file) => <label key={file.path} className="flex min-h-12 cursor-pointer items-center gap-3 bg-black/10 px-3 py-2"><input type="checkbox" checked={selected.has(file.path)} onChange={() => { const next = new Set(selected); if (next.has(file.path)) next.delete(file.path); else next.add(file.path); setSelected(next); setSuggestions(null) }} className="h-4 w-4 accent-apple" /><span className="font-mono text-xs text-zinc-300">{file.path}</span></label>)}</div></div>
      <label className="block text-sm text-zinc-300">Commit Message<input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} placeholder="변경 목적을 간단하게 입력하세요." className="mt-2 w-full border border-line bg-black/20 px-4 py-3 text-white outline-none focus:border-apple" /></label>
      <div><button type="button" disabled={!selected.size || busy} onClick={() => void suggest()} className="w-full rounded-xl bg-white/[0.07] px-4 py-3 text-sm font-semibold text-apple disabled:opacity-30">{busy ? 'Gemini가 변경사항을 분석하고 있습니다…' : 'AI로 Commit Message 추천'}</button>{suggestions && <div className="mt-3 space-y-2">{suggestions.suggestions.map((item) => <button key={item} type="button" onClick={() => setMessage(item)} className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm ${message === item ? 'border-apple bg-apple/10 text-white' : 'border-white/[0.08] text-zinc-300'}`}>○ {item}</button>)}</div>}</div>
      <ErrorMessage message={error} />
      <div className="flex items-center justify-between gap-3"><button type="button" onClick={onOpenFull} className="text-sm text-zinc-500 hover:text-apple">Git 전체 보기 →</button><button type="button" disabled={!selected.size || !message.trim() || busy} onClick={() => void commit()} className="rounded-xl bg-apple px-6 py-3 text-sm font-semibold text-white hover:bg-apple-hover disabled:opacity-30">Git Commit</button></div>
    </div>}
  </QuickActionSheet>
}

function GitPushSheet({ gitStatus, onClose, onOpenFull, onPreview, onPush }: { gitStatus: GitStatus | null; onClose: () => void; onOpenFull: () => void; onPreview: QuickActionSheetsProps['onGetPushPreview']; onPush: QuickActionSheetsProps['onPush'] }) {
  const [preview, setPreview] = useState<GitPushPreview | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const loadPreview = useCallback(async () => { setBusy(true); setError(null); try { setPreview(await onPreview()) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Git Push 정보를 불러오지 못했습니다.') } finally { setBusy(false) } }, [onPreview])
  useEffect(() => { void loadPreview() }, [loadPreview])
  const push = async () => { setBusy(true); setError(null); try { const result = await onPush(); setSuccess(result.pushed || result.message.toLowerCase().includes('up to date')) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Git Push에 실패했습니다.') } finally { setBusy(false) } }
  return <QuickActionSheet title="Git Push" subtitle="최신 Remote 상태를 확인한 뒤 origin으로 Push합니다." size="sm" status={requestStatus(busy, success, error)} autoCloseMs={success ? 850 : undefined} onClose={onClose}>{success ? <SuccessMessage>Git Push가 완료되었습니다.</SuccessMessage> : <div className="space-y-4">{busy && !preview ? <p className="py-6 text-center text-sm text-zinc-500">Remote 상태를 확인하고 있습니다…</p> : preview ? <><dl className="space-y-3 rounded-2xl bg-black/20 p-4 text-sm"><div className="flex justify-between"><dt className="text-zinc-500">현재 Branch</dt><dd className="font-mono text-zinc-200">{preview.branch}</dd></div><div className="flex justify-between"><dt className="text-zinc-500">Push할 Commit</dt><dd className="text-apple">{preview.ahead}개</dd></div><div className="flex justify-between"><dt className="text-zinc-500">Remote에만 있는 Commit</dt><dd className={preview.behind ? 'text-[#ffd60a]' : 'text-zinc-200'}>{preview.behind}개</dd></div><div className="border-t border-white/[0.08] pt-3 text-[10px] text-zinc-600">마지막 확인 {new Date(preview.last_fetched_at).toLocaleString('ko-KR')}</div></dl>{preview.behind > 0 && <p className="rounded-xl border border-[#ffd60a]/20 bg-[#ffd60a]/[0.05] px-4 py-3 text-xs leading-5 text-[#ffd60a]">Remote에 Local에 없는 Commit이 있습니다. 먼저 Git Pull 또는 직접 Merge/Rebase해주세요.</p>}</> : !gitStatus && <EmptyGit onOpenFull={onOpenFull} />}<ErrorMessage message={error} />{error && <button type="button" disabled={busy} onClick={() => void loadPreview()} className="w-full rounded-xl bg-white/[0.07] px-4 py-2.5 text-sm text-zinc-200">Remote 상태 다시 확인</button>}<div className="flex items-center justify-between"><button type="button" onClick={onOpenFull} className="text-sm text-zinc-500 hover:text-apple">Git 전체 보기 →</button><button type="button" disabled={busy || !preview?.ahead || Boolean(preview?.behind)} onClick={() => void push()} className="rounded-xl bg-apple px-5 py-3 text-sm font-semibold text-white disabled:opacity-30">Git Push</button></div></div>}</QuickActionSheet>
}

function GitPullSheet({ onClose, onOpenFull, onPreview, onPull }: { onClose: () => void; onOpenFull: () => void; onPreview: QuickActionSheetsProps['onGetPullPreview']; onPull: QuickActionSheetsProps['onPull'] }) {
  const [preview, setPreview] = useState<GitPullPreview | null>(null)
  const [result, setResult] = useState<GitPullResult | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const success = Boolean(result?.success && !result.conflict)
  const loadPreview = useCallback(async () => { setBusy(true); setError(null); try { setPreview(await onPreview()) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Git Pull 정보를 불러오지 못했습니다.') } finally { setBusy(false) } }, [onPreview])
  useEffect(() => { void loadPreview() }, [loadPreview])
  const pull = async () => { setBusy(true); setError(null); try { const next = await onPull(); setResult(next); if (!next.success) setError(next.message) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Git Pull에 실패했습니다.') } finally { setBusy(false) } }
  const blocked = Boolean(preview?.diverged || preview?.conflict_files.length || !preview?.upstream_exists)
  return <QuickActionSheet title="Git Pull" subtitle="Remote를 Fetch한 뒤 Fast-forward only로 가져옵니다." size="sm" status={requestStatus(busy, success, error || (result?.conflict || result?.diverged ? 'blocked' : null))} autoCloseMs={success ? 900 : undefined} onClose={onClose}>{success ? <SuccessMessage>{result?.already_up_to_date ? '이미 최신 상태입니다.' : 'Git Pull이 완료되었습니다.'}</SuccessMessage> : <div className="space-y-4">{busy && !preview ? <p className="py-6 text-center text-sm text-zinc-500">Remote 상태를 확인하고 있습니다…</p> : preview && <><dl className="space-y-3 rounded-2xl bg-black/20 p-4 text-sm"><div className="flex justify-between"><dt className="text-zinc-500">현재 Branch</dt><dd className="font-mono text-zinc-200">{preview.branch}</dd></div><div className="flex justify-between"><dt className="text-zinc-500">Remote 상태</dt><dd className={preview.diverged ? 'text-[#ffd60a]' : 'font-mono text-zinc-200'}>{preview.diverged ? '분기됨' : `↑ ${preview.ahead} · ↓ ${preview.behind}`}</dd></div><div className="flex justify-between"><dt className="text-zinc-500">로컬 변경 파일</dt><dd className={preview.changed_files.length ? 'text-[#ffd60a]' : 'text-zinc-200'}>{preview.changed_files.length}개</dd></div><div className="border-t border-white/[0.08] pt-3 text-[10px] text-zinc-600">마지막 확인 {new Date(preview.last_fetched_at).toLocaleString('ko-KR')}</div></dl>{preview.diverged && <p className="rounded-xl border border-rose-400/20 bg-rose-400/[0.05] px-4 py-3 text-xs leading-5 text-rose-300">Branch가 분기되었습니다. CodePad는 자동 Merge 또는 Rebase를 수행하지 않습니다.</p>}{preview.conflict_files.length > 0 && <p className="rounded-xl border border-rose-400/20 bg-rose-400/[0.05] px-4 py-3 text-xs leading-5 text-rose-300">Merge Conflict 파일을 먼저 해결해주세요: {preview.conflict_files.join(', ')}</p>}{preview.changed_files.length > 0 && !blocked && <p className="rounded-xl border border-[#ffd60a]/20 bg-[#ffd60a]/[0.05] px-4 py-3 text-xs leading-5 text-[#ffd60a]">Commit 또는 Stash를 권장합니다. 변경사항을 자동 Stash하지 않습니다.</p>}</>}{result?.conflict && <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.05] p-4"><p className="font-semibold text-rose-300">Merge Conflict 해결이 필요합니다.</p><div className="mt-3 space-y-1 font-mono text-xs text-zinc-300">{result.conflict_files.map((file) => <p key={file}>{file}</p>)}</div></div>}{result?.diverged && <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.05] p-4 text-sm leading-6 text-rose-300">Mac의 VS Code 또는 Terminal에서 Merge 또는 Rebase 방식을 직접 선택해주세요.</div>}<ErrorMessage message={error} />{error && !result && <button type="button" disabled={busy} onClick={() => void loadPreview()} className="w-full rounded-xl bg-white/[0.07] px-4 py-2.5 text-sm text-zinc-200">Remote 상태 다시 확인</button>}<div className="flex items-center justify-between"><button type="button" onClick={onOpenFull} className="text-sm text-zinc-500 hover:text-apple">Git 상세 보기 →</button><button type="button" disabled={busy || !preview || blocked} onClick={() => void pull()} className="rounded-xl bg-apple px-5 py-3 text-sm font-semibold text-white disabled:opacity-30">{preview?.changed_files.length ? '그래도 Git Pull' : 'Git Pull'}</button></div></div>}</QuickActionSheet>
}

function AIErrorSheet({ errors, onClose, onOpenFull }: { errors: ErrorHistory[]; onClose: () => void; onOpenFull: () => void }) {
  const [selected, setSelected] = useState<ErrorHistory | null>(errors[0] ?? null)
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null)
  const [context, setContext] = useState<ErrorAnalysisContext | null>(null)
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { void getAIStatus().then(setAIStatus).catch(() => setAIStatus(null)) }, [])
  useEffect(() => { if (!selected && errors[0]) setSelected(errors[0]) }, [errors, selected])
  useEffect(() => { if (!selected) return; setAnalysis(null); setContext(null); void getLatestAnalysis(selected.id).then(setAnalysis).catch(() => undefined) }, [selected])
  const prepare = async () => { if (!selected) return; setBusy(true); setError(null); try { setContext(await getAnalysisContext(selected.id)) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'AI Context를 준비하지 못했습니다.') } finally { setBusy(false) } }
  const analyze = async () => { if (!selected) return; setBusy(true); setError(null); try { setAnalysis(await analyzeError(selected.id)); setContext(null) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Gemini 분석에 실패했습니다.') } finally { setBusy(false) } }
  return <QuickActionSheet title="AI Error" subtitle="최근 Error를 확인하고 Gemini로 빠르게 분석합니다." size="md" status={requestStatus(busy, false, error)} onClose={onClose}><div className="space-y-4">{!errors.length ? <p className="py-8 text-center text-sm text-zinc-500">최근 Error가 없습니다.</p> : <><div className="grid gap-2 sm:grid-cols-[220px_1fr]"><div className="max-h-64 space-y-2 overflow-y-auto">{errors.slice(0, 8).map((item) => <button key={item.id} type="button" onClick={() => setSelected(item)} className={`w-full rounded-xl border p-3 text-left ${selected?.id === item.id ? 'border-apple bg-apple/10' : 'border-white/[0.08] bg-black/10'}`}><p className="line-clamp-2 text-xs text-zinc-200">{item.error_message}</p><p className="mt-2 text-[10px] text-zinc-600">{new Date(item.updated_at).toLocaleString('ko-KR')}</p></button>)}</div><div className="min-w-0 rounded-2xl bg-black/20 p-4">{selected && <><p className="break-words text-sm font-semibold text-rose-300">{selected.error_message}</p><p className="mt-2 break-all font-mono text-xs text-zinc-500">{selected.file ? `${selected.file}${selected.line ? `:${selected.line}` : ''}` : '파일 위치 없음'}</p><pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap text-[10px] leading-5 text-zinc-400">{selected.stack_trace}</pre></>}</div></div>{context && <div className="rounded-2xl border border-apple/20 bg-apple/[0.04] p-4"><p className="text-sm font-semibold text-zinc-200">이 Context를 Gemini로 보낼까요?</p><p className="mt-2 text-xs leading-5 text-zinc-500">Error, Stack Trace와 관련 코드 일부만 전송하며 프로젝트 전체는 전송하지 않습니다.</p><button type="button" disabled={busy} onClick={() => void analyze()} className="mt-3 rounded-xl bg-apple px-4 py-2.5 text-sm font-semibold text-white">Gemini 분석</button></div>}{analysis && <div className="space-y-4 rounded-2xl border border-lime/20 bg-lime/[0.03] p-4"><div><p className="text-xs text-zinc-600">원인</p><p className="mt-1 text-sm leading-6 text-zinc-200">{analysis.cause}</p></div><div><p className="text-xs text-zinc-600">해결 방법</p><ol className="mt-1 list-decimal space-y-1 pl-5 text-sm leading-6 text-zinc-300">{analysis.solution_steps.map((step) => <li key={step}>{step}</li>)}</ol></div>{analysis.terminal_commands.length > 0 && <div><p className="text-xs text-zinc-600">Terminal Command</p>{analysis.terminal_commands.map((command) => <div key={command} className="mt-2 flex items-center gap-2 rounded-lg bg-black/30 p-2"><code className="min-w-0 flex-1 break-all text-xs text-zinc-300">{command}</code><button type="button" onClick={() => void navigator.clipboard?.writeText(command)} className="min-h-0 shrink-0 text-xs text-apple">복사</button></div>)}</div>}</div>}</>}<ErrorMessage message={error} /><div className="flex items-center justify-between"><button type="button" onClick={onOpenFull} className="text-sm text-zinc-500 hover:text-apple">모든 Error 보기 →</button>{selected && !context && <button type="button" disabled={busy || !aiStatus?.configured} onClick={() => void prepare()} className="rounded-xl bg-apple px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-30">{analysis ? 'Gemini로 다시 분석' : 'Gemini로 분석하기'}</button>}</div></div></QuickActionSheet>
}

function parseTags(value: string): string[] { return [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))].slice(0, 20) }

function NotionSheet({ status, saving, project, onClose, onOpenFull, onSave }: { status: NotionStatus | null; saving: boolean; project: Project | null; onClose: () => void; onOpenFull: () => void; onSave: QuickActionSheetsProps['onSaveNotion'] }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [context, setContext] = useState<DevelopmentJournalContext | null>(null)
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const dirty = Boolean(title.trim() || content.trim() || tags.trim())
  useEffect(() => { void getAIStatus().then(setAIStatus).catch(() => setAIStatus(null)) }, [])
  const prepareAI = async () => { setBusy(true); setError(null); try { setContext(await getJournalContext()) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'AI 개발일지 Context를 준비하지 못했습니다.') } finally { setBusy(false) } }
  const generate = async () => { setBusy(true); setError(null); try { const draft = await generateJournal(); setTitle(draft.title); setContent(draft.content); setTags(draft.tags.join(', ')); setContext(null) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Gemini 개발일지 생성에 실패했습니다.') } finally { setBusy(false) } }
  const save = async () => { if (!title.trim() || !content.trim()) { setError('제목과 개발 내용을 모두 입력하세요.'); return } setBusy(true); setError(null); try { await onSave({ title: title.trim(), content: content.trim(), tags: parseTags(tags) }); setSuccess(true) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Notion에 저장하지 못했습니다.') } finally { setBusy(false) } }
  const sheetBusy = busy || saving
  return <QuickActionSheet title="Notion 개발일지" subtitle="홈을 벗어나지 않고 개발 기록을 작성하고 저장합니다." size="lg" status={requestStatus(sheetBusy, success, error)} dirty={!success && dirty} autoCloseMs={success ? 900 : undefined} onClose={onClose}>{success ? <SuccessMessage>Notion에 저장되었습니다.</SuccessMessage> : <div className="space-y-4"><label className="block text-sm text-zinc-300">제목<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} className="mt-2 w-full border border-line bg-black/20 px-4 py-3 text-white outline-none focus:border-apple" /></label><label className="block text-sm text-zinc-300">내용<textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={100000} rows={8} className="mt-2 w-full resize-y border border-line bg-black/20 px-4 py-3 leading-6 text-white outline-none focus:border-apple" /></label><label className="block text-sm text-zinc-300">태그<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Backend, Bugfix" className="mt-2 w-full border border-line bg-black/20 px-4 py-3 text-white outline-none focus:border-apple" /></label>{context && <div className="rounded-2xl border border-apple/20 bg-apple/[0.04] p-4"><p className="text-sm font-semibold text-zinc-200">오늘의 개발 기록을 Gemini로 보낼까요?</p><p className="mt-2 text-xs text-zinc-500">Commit {context.commits.length}개 · 변경 파일 {context.changed_files.length}개 · Command {context.commands.length}개 · Error {context.errors.length}개</p><button type="button" onClick={() => void generate()} disabled={sheetBusy} className="mt-3 rounded-xl bg-apple px-4 py-2.5 text-sm font-semibold text-white">AI 초안 생성</button></div>}<ErrorMessage message={error} /><div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={onOpenFull} className="text-sm text-zinc-500 hover:text-apple">Notion 전체 보기 →</button><div className="flex gap-2"><button type="button" disabled={!project || !aiStatus?.configured || sheetBusy} onClick={() => void prepareAI()} className="rounded-xl bg-white/[0.07] px-4 py-3 text-sm font-semibold text-zinc-200 disabled:opacity-30">AI로 개발일지 생성</button><button type="button" disabled={!status?.connected || sheetBusy || !title.trim() || !content.trim()} onClick={() => void save()} className="rounded-xl bg-apple px-4 py-3 text-sm font-semibold text-white disabled:opacity-30">Notion에 저장</button></div></div></div>}</QuickActionSheet>
}

function CommandSheet({ action, commands, project, onClose, onOpenFull, onRun }: { action: DashboardAction; commands: SavedCommand[]; project: Project | null; onClose: () => void; onOpenFull: () => void; onRun: QuickActionSheetsProps['onRunCommand'] }) {
  const configuredId = typeof action.config.command_id === 'number' && commands.some((item) => item.id === action.config.command_id) ? action.config.command_id : null
  const [commandId, setCommandId] = useState<number | null>(() => configuredId)
  const effectiveCommandId = commandId ?? configuredId ?? commands[0]?.id ?? null
  const command = commands.find((item) => item.id === effectiveCommandId) ?? null
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const run = async () => { if (!command) return; setBusy(true); setError(null); try { await onRun(command.id); setSuccess(true) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Command 실행에 실패했습니다.') } finally { setBusy(false) } }
  return <QuickActionSheet title={action.name} subtitle="실행할 Command와 Working Directory를 확인합니다." size="sm" status={requestStatus(busy, success, error)} autoCloseMs={success ? 900 : undefined} onClose={onClose}>{success ? <SuccessMessage>Command 실행을 시작했습니다.</SuccessMessage> : <div className="space-y-4">{!configuredId && commands.length > 1 && <label className="block text-sm text-zinc-300">Saved Command<select value={effectiveCommandId ?? ''} onChange={(event) => setCommandId(Number(event.target.value))} className="mt-2 w-full border border-line bg-black/20 px-4 py-3 text-white outline-none focus:border-apple">{commands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}{command ? <dl className="space-y-4 rounded-2xl bg-black/20 p-4"><div><dt className="text-xs text-zinc-600">실행 Command</dt><dd className="mt-1 break-all font-mono text-sm text-zinc-200">{command.command}</dd></div><div><dt className="text-xs text-zinc-600">Working Directory</dt><dd className="mt-1 break-all font-mono text-sm text-zinc-300">{command.working_directory}</dd></div><div><dt className="text-xs text-zinc-600">Project</dt><dd className="mt-1 text-sm text-zinc-300">{project?.name ?? '선택되지 않음'}</dd></div></dl> : <p className="py-6 text-center text-sm text-zinc-500">실행할 Saved Command가 없습니다.</p>}<ErrorMessage message={error} /><div className="flex items-center justify-between"><button type="button" onClick={onOpenFull} className="text-sm text-zinc-500 hover:text-apple">Command 전체 보기 →</button><button type="button" disabled={!command || !project || busy} onClick={() => void run()} className="rounded-xl bg-apple px-5 py-3 text-sm font-semibold text-white disabled:opacity-30">{busy ? '실행 중…' : 'Command 실행'}</button></div></div>}</QuickActionSheet>
}

export function QuickActionSheets(props: QuickActionSheetsProps) {
  const { action } = props
  if (!action) return null
  const openFull = (route: Parameters<QuickActionSheetsProps['onOpenFull']>[0]) => { props.onClose(); props.onOpenFull(route) }
  if (action.type === 'git_commit') return <GitCommitSheet key={action.id} gitStatus={props.gitStatus} onClose={props.onClose} onOpenFull={() => openFull('#git')} onCommit={props.onCommit} onSuggest={props.onSuggestCommitMessages} />
  if (action.type === 'git_push') return <GitPushSheet key={action.id} gitStatus={props.gitStatus} onClose={props.onClose} onOpenFull={() => openFull('#git')} onPreview={props.onGetPushPreview} onPush={props.onPush} />
  if (action.type === 'git_pull') return <GitPullSheet key={action.id} onClose={props.onClose} onOpenFull={() => openFull('#git')} onPreview={props.onGetPullPreview} onPull={props.onPull} />
  if (action.type === 'ai_error') return <AIErrorSheet key={action.id} errors={props.errors} onClose={props.onClose} onOpenFull={() => openFull('#error-monitor')} />
  if (action.type === 'notion') return <NotionSheet key={action.id} status={props.notionStatus} saving={props.notionSaving} project={props.project} onClose={props.onClose} onOpenFull={() => openFull('#notion-journal')} onSave={props.onSaveNotion} />
  return <CommandSheet key={action.id} action={action} commands={props.commands} project={props.project} onClose={props.onClose} onOpenFull={() => openFull('#actions')} onRun={props.onRunCommand} />
}
