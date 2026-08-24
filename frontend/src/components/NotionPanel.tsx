import { useEffect, useState } from 'react'
import { ConfirmationDialog } from './ConfirmationDialog'
import { generateJournal, getAIStatus, getJournalContext } from '../services/aiApi'
import type { AIStatus, DevelopmentJournalContext } from '../types/ai'
import type { NotionLog, NotionLogInput, NotionStatus } from '../types/notion'

interface NotionPanelProps {
  status: NotionStatus | null
  logs: NotionLog[]
  loading: boolean
  saving: boolean
  error: string | null
  projectName: string | null
  onRefresh: () => void
  onSave: (input: NotionLogInput) => Promise<NotionLog>
}

function parseTags(value: string): string[] {
  return [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))].slice(0, 20)
}

export function NotionPanel({ status, logs, loading, saving, error, projectName, onRefresh, onSave }: NotionPanelProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tagText, setTagText] = useState('')
  const [preview, setPreview] = useState<NotionLogInput | null>(null)
  const [saved, setSaved] = useState<NotionLog | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null)
  const [journalContext, setJournalContext] = useState<DevelopmentJournalContext | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    void getAIStatus().then(setAIStatus).catch(() => setAIStatus(null))
  }, [])

  const prepareSave = () => {
    setSubmitError(null)
    if (!title.trim() || !content.trim()) {
      setSubmitError('제목과 개발 내용을 모두 입력하세요.')
      return
    }
    setPreview({ title: title.trim(), content: content.trim(), tags: parseTags(tagText) })
  }

  const confirmSave = async () => {
    if (!preview) return
    setSubmitError(null)
    try {
      const created = await onSave(preview)
      setSaved(created)
      setPreview(null)
      setTitle('')
      setContent('')
      setTagText('')
    } catch (requestError) {
      setSubmitError(requestError instanceof Error ? requestError.message : 'Notion에 저장하지 못했습니다.')
    }
  }

  const prepareGeneration = async () => {
    setSubmitError(null)
    setGenerating(true)
    try {
      setJournalContext(await getJournalContext())
    } catch (requestError) {
      setSubmitError(requestError instanceof Error ? requestError.message : 'AI 개발일지 Context를 준비하지 못했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  const confirmGeneration = async () => {
    setGenerating(true)
    setSubmitError(null)
    try {
      const draft = await generateJournal()
      setTitle(draft.title)
      setContent(draft.content)
      setTagText(draft.tags.join(', '))
      setJournalContext(null)
      setSaved(null)
    } catch (requestError) {
      setSubmitError(requestError instanceof Error ? requestError.message : 'Gemini 개발일지 생성에 실패했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <section id="notion-journal" aria-labelledby="notion-title" className="py-12 sm:py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="notion-title" className="text-[30px] font-bold tracking-tight text-white">Notion</h2>
          <p className="mt-2 text-[15px] leading-6 text-zinc-500">오늘의 개발 내용을 정리하고 Notion에 저장합니다.</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <button type="button" disabled={loading} onClick={onRefresh} className="rounded-xl bg-[#2c2c2e] px-4 text-sm font-semibold text-white hover:bg-[#3a3a3c] disabled:opacity-40">{loading ? '연결을 확인하는 중…' : '연결 확인'}</button>
          <span className={`font-mono text-[9px] uppercase tracking-wider ${status?.connected ? 'text-lime' : 'text-zinc-600'}`}>
            Notion · {status?.connected ? '연결됨' : status?.configured ? '연결 실패' : '설정 필요'}
          </span>
        </div>
      </div>

      {status?.connected && <p className="mt-5 rounded-xl bg-lime/[0.08] px-4 py-3 text-sm text-zinc-400">저장 위치 · <span className="text-lime">{status.destination}</span></p>}
      {status && !status.connected && <p className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] px-4 py-3 text-sm text-amber-200">{status.message}</p>}
      {(error || submitError) && <p role="alert" className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-300">{submitError ?? error}</p>}
      {saved && <div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-lime/[0.08] px-4 py-3 text-sm"><span className="min-w-0 text-zinc-300">“{saved.title}” 저장이 완료되었습니다.</span><a href={saved.notion_url} target="_blank" rel="noreferrer" className="shrink-0 font-semibold text-lime hover:underline">Notion에서 열기 ↗</a></div>}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
        <form onSubmit={(event) => { event.preventDefault(); prepareSave() }} className="space-y-4 rounded-[24px] bg-panel p-5 sm:p-6">
          <label className="block text-sm text-zinc-300">제목<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="오늘 어떤 기능을 개발했나요?" className="mt-2 w-full border border-line bg-[#2c2c2e] px-4 py-3 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-apple" /></label>
          <label className="block text-sm text-zinc-300">개발 내용<textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={100000} rows={9} placeholder="변경 사항, 결정한 내용, 해결한 Error와 다음 작업을 기록하세요." className="mt-2 w-full resize-y border border-line bg-[#2c2c2e] px-4 py-3 leading-6 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-apple" /></label>
          <label className="block text-sm text-zinc-300">태그 <span className="text-zinc-600">· 쉼표로 구분</span><input value={tagText} onChange={(event) => setTagText(event.target.value)} placeholder="CodePad, Frontend, Bugfix" className="mt-2 w-full border border-line bg-[#2c2c2e] px-4 py-3 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-apple" /></label>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs leading-5 text-zinc-600">{projectName ? `현재 프로젝트 · ${projectName}` : '프로젝트 없이도 개발일지를 저장할 수 있습니다.'}</p>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button type="button" disabled={!projectName || !aiStatus?.configured || generating} onClick={() => void prepareGeneration()} className="rounded-xl bg-[#2c2c2e] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3a3a3c] disabled:cursor-not-allowed disabled:opacity-30">{generating ? 'Gemini가 생성하는 중…' : 'AI로 개발일지 생성'}</button>
              <button type="submit" disabled={!status?.connected || saving} className="shrink-0 rounded-xl bg-apple px-5 py-3 text-sm font-semibold text-white hover:bg-apple-hover disabled:cursor-not-allowed disabled:opacity-30">Notion에 저장</button>
            </div>
          </div>
          {!aiStatus?.configured && <p className="text-right text-xs text-zinc-600">AI 초안을 생성하려면 GEMINI_API_KEY를 설정하세요.</p>}
        </form>

        <div className="rounded-[24px] bg-panel p-5 sm:p-6">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-zinc-300">최근 저장</h3><span className="text-xs text-zinc-600">Local 기록</span></div>
          {logs.length ? <div className="mt-4 space-y-2">{logs.map((log) => <a key={log.id} href={log.notion_url} target="_blank" rel="noreferrer" className="block rounded-xl bg-[#2c2c2e] p-3 transition hover:bg-[#3a3a3c]"><p className="break-words text-sm font-medium text-zinc-300">{log.title}</p><div className="mt-2 flex justify-between gap-2 text-xs text-zinc-600"><span className="min-w-0 break-words">{log.project_name ?? '프로젝트 없음'}</span><time>{new Date(log.created_at).toLocaleDateString('ko-KR')}</time></div></a>)}</div> : <p className="mt-6 text-sm text-zinc-600">Notion에 저장한 개발일지가 여기에 표시됩니다.</p>}
        </div>
      </div>

      <ConfirmationDialog open={preview !== null} title="Notion에 저장할까요?" description="검토한 제목, 개발 내용과 태그를 설정된 Notion Data Source로 전송합니다." confirmLabel="Notion에 저장" busy={saving} onCancel={() => setPreview(null)} onConfirm={() => void confirmSave()}>
        <div className="max-h-80 space-y-4 overflow-y-auto rounded-2xl border border-line bg-ink p-4 text-sm">
          <div><p className="text-zinc-600">저장 위치</p><p className="mt-1 text-zinc-300">{status?.destination ?? '설정된 Data Source'}</p></div>
          <div><p className="text-zinc-600">제목</p><p className="mt-1 font-medium text-zinc-200">{preview?.title}</p></div>
          <div><p className="text-zinc-600">개발 내용</p><p className="mt-1 whitespace-pre-wrap break-words leading-6 text-zinc-300">{preview?.content}</p></div>
          <div><p className="text-zinc-600">태그</p><p className="mt-1 text-zinc-300">{preview?.tags.length ? preview.tags.join(', ') : '태그 없음'}</p></div>
        </div>
      </ConfirmationDialog>

      <ConfirmationDialog open={journalContext !== null} title="오늘의 개발 기록을 Gemini로 보낼까요?" description="아래 요약 정보만 전송합니다. Gemini는 편집 가능한 초안만 만들며 Notion에 자동 저장하지 않습니다." confirmLabel="AI 초안 생성" busy={generating} onCancel={() => setJournalContext(null)} onConfirm={() => void confirmGeneration()}>
        <div className="max-h-80 space-y-4 overflow-y-auto rounded-2xl border border-line bg-ink p-4 text-sm">
          <div className="grid grid-cols-2 gap-3"><div><p className="text-zinc-600">프로젝트</p><p className="mt-1 text-zinc-300">{journalContext?.project_name}</p></div><div><p className="text-zinc-600">날짜 / Branch</p><p className="mt-1 text-zinc-300">{journalContext?.date} · {journalContext?.branch ?? 'Git Branch 없음'}</p></div></div>
          <div><p className="text-zinc-600">Commit · {journalContext?.commits.length ?? 0}개</p><ul className="mt-1 space-y-1 text-zinc-300">{journalContext?.commits.map((commit) => <li key={commit.commit}>• {commit.message} <span className="text-xs text-zinc-600">({commit.files.length}개 파일)</span></li>)}</ul></div>
          <div><p className="text-zinc-600">현재 변경 파일 · {journalContext?.changed_files.length ?? 0}개</p><p className="mt-1 break-words font-mono text-xs text-zinc-400">{journalContext?.changed_files.join(', ') || '없음'}</p></div>
          <div><p className="text-zinc-600">Command · {journalContext?.commands.length ?? 0}개</p><ul className="mt-1 space-y-1 text-zinc-300">{journalContext?.commands.map((command, index) => <li key={`${command.command}-${index}`}>• {command.name} · {command.status}</li>)}</ul></div>
          <div><p className="text-zinc-600">Error · {journalContext?.errors.length ?? 0}개</p><ul className="mt-1 space-y-1 text-zinc-300">{journalContext?.errors.map((item, index) => <li key={`${item.message}-${index}`}>• {item.message} {item.ai_analyzed && <span className="text-lime">· AI 분석 완료</span>}</li>)}</ul></div>
        </div>
      </ConfirmationDialog>
    </section>
  )
}
