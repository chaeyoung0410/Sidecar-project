import { useEffect, useState } from 'react'
import { ConfirmationDialog } from './ConfirmationDialog'
import { analyzeError, getAIStatus, getAnalysisContext, getLatestAnalysis } from '../services/aiApi'
import type { AIAnalysis, AIStatus, ErrorAnalysisContext } from '../types/ai'
import type { ErrorHistory, ErrorHistoryUpdate } from '../types/error'

interface ErrorPanelProps {
  errors: ErrorHistory[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onUpdate: (errorId: number, payload: ErrorHistoryUpdate) => Promise<ErrorHistory>
  onDelete: (errorId: number) => Promise<void>
}

function locationLabel(error: ErrorHistory): string {
  if (!error.file) return '파일 위치를 확인할 수 없음'
  return error.line ? `${error.file}:${error.line}` : error.file
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('복사하지 못했습니다.')
}

export function ErrorPanel({ errors, loading, error, onRefresh, onUpdate, onDelete }: ErrorPanelProps) {
  const [selected, setSelected] = useState<ErrorHistory | null>(null)
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null)
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null)
  const [context, setContext] = useState<ErrorAnalysisContext | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiError, setAIError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [noteEditing, setNoteEditing] = useState(false)
  const [note, setNote] = useState('')
  const [managing, setManaging] = useState(false)
  const [deletePending, setDeletePending] = useState(false)

  useEffect(() => {
    void getAIStatus().then(setAIStatus).catch(() => setAIStatus(null))
  }, [])

  const selectedCurrent = selected
    ? errors.find((item) => item.id === selected.id) ?? selected
    : null

  const openDetail = async (item: ErrorHistory) => {
    setSelected(item)
    setNote(item.user_note ?? '')
    setNoteEditing(false)
    setAnalysis(null)
    setAIError(null)
    try {
      const [latestAnalysis, currentStatus] = await Promise.all([
        getLatestAnalysis(item.id),
        getAIStatus(),
      ])
      setAnalysis(latestAnalysis)
      setAIStatus(currentStatus)
    } catch (requestError) {
      setAIError(requestError instanceof Error ? requestError.message : 'AI 분석을 불러오지 못했습니다.')
    }
  }

  const updateMetadata = async (payload: ErrorHistoryUpdate) => {
    if (!selectedCurrent) return
    setManaging(true)
    setAIError(null)
    try {
      const updated = await onUpdate(selectedCurrent.id, payload)
      setSelected(updated)
      setNote(updated.user_note ?? '')
      setNoteEditing(false)
    } catch (requestError) {
      setAIError(requestError instanceof Error ? requestError.message : 'Error 정보를 저장하지 못했습니다.')
    } finally {
      setManaging(false)
    }
  }

  const confirmDelete = async () => {
    if (!selectedCurrent) return
    setManaging(true)
    setAIError(null)
    try {
      await onDelete(selectedCurrent.id)
      setDeletePending(false)
      setSelected(null)
      setAnalysis(null)
    } catch (requestError) {
      setDeletePending(false)
      setAIError(requestError instanceof Error ? requestError.message : 'Error 기록을 삭제하지 못했습니다.')
    } finally {
      setManaging(false)
    }
  }

  const prepareAnalysis = async () => {
    if (!selectedCurrent) return
    if (!aiStatus?.configured) {
      setAIError('Mac Agent에 GEMINI_API_KEY가 설정되지 않았습니다.')
      return
    }
    setAnalyzing(true)
    setAIError(null)
    try {
      setContext(await getAnalysisContext(selectedCurrent.id))
    } catch (requestError) {
      setAIError(requestError instanceof Error ? requestError.message : 'AI 분석 Context를 준비하지 못했습니다.')
    } finally {
      setAnalyzing(false)
    }
  }

  const confirmAnalysis = async () => {
    if (!context) return
    setAnalyzing(true)
    setAIError(null)
    try {
      setAnalysis(await analyzeError(context.error_id))
      setContext(null)
      onRefresh()
    } catch (requestError) {
      setAIError(requestError instanceof Error ? requestError.message : 'Gemini 분석에 실패했습니다.')
    } finally {
      setAnalyzing(false)
    }
  }

  const copy = async (label: string, value: string) => {
    try {
      await copyText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(null), 1_500)
    } catch {
      setAIError('브라우저에서 Clipboard 접근이 거부되었습니다.')
    }
  }

  return (
    <section id="error-monitor" aria-labelledby="errors-title" className="py-12 sm:py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="errors-title" className="text-[30px] font-bold tracking-tight text-white">Error</h2>
          <p className="mt-2 text-[15px] leading-6 text-zinc-500">최근 개발 과정에서 발생한 Error를 확인하고 Gemini로 분석합니다.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button type="button" disabled={loading} onClick={onRefresh} className="rounded-xl bg-[#2c2c2e] px-4 text-sm font-semibold text-white hover:bg-[#3a3a3c] disabled:opacity-40">{loading ? 'Error를 불러오는 중…' : '새로고침'}</button>
          <span className={`font-mono text-[9px] uppercase tracking-wider ${aiStatus?.configured ? 'text-lime' : 'text-zinc-700'}`}>
            Gemini · {aiStatus?.configured ? '연결됨' : '설정 필요'}
          </span>
        </div>
      </div>

      {error && <p role="alert" className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-300">{error}</p>}

      {errors.length ? (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {errors.map((item) => (
            <button key={item.id} type="button" onClick={() => void openDetail(item)} className="rounded-[20px] bg-panel p-5 text-left transition hover:bg-[#242426]">
              <div className="flex items-center justify-between gap-3">
                <span className={`text-xs font-medium ${item.resolved ? 'text-lime' : 'text-[#ff6961]'}`}>{item.resolved ? '✓ 해결됨' : '● 미해결'}</span>
                <time className="text-xs text-zinc-600">{new Date(item.updated_at).toLocaleTimeString('ko-KR')}</time>
              </div>
              <p className="mt-3 truncate font-mono text-xs text-zinc-500">{locationLabel(item)}</p>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-200">{item.error_message}</p>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-zinc-600">
                <span>{item.project_name}</span>
                <span className={item.ai_analyzed ? 'text-lime' : ''}>{item.ai_analyzed ? 'AI 분석 완료' : 'AI 분석 전'}</span>
              </div>
            </button>
          ))}
        </div>
      ) : !loading && (
        <div className="mt-6 rounded-[20px] bg-panel p-10 text-center">
          <p className="font-semibold text-zinc-300">아직 발생한 Error가 없습니다.</p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">개발 중 Error가 발생하면<br />여기에 자동으로 표시됩니다.</p>
        </div>
      )}

      {selectedCurrent && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="error-detail-title" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl border border-line bg-[#0d1014] p-5 shadow-2xl sm:rounded-3xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#ff6961]">Error 상세</p>
                <h2 id="error-detail-title" className="mt-2 break-words text-xl font-semibold text-white">{selectedCurrent.error_message}</h2>
                <p className="mt-2 break-all font-mono text-xs text-zinc-500">{locationLabel(selectedCurrent)}</p>
              </div>
              <div className="flex shrink-0 items-start gap-2"><details className="relative"><summary aria-label="Error 관리 메뉴" className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl bg-[#2c2c2e] tracking-widest text-zinc-300 hover:text-white">•••</summary><div className="absolute right-0 top-12 z-10 w-44 overflow-hidden rounded-xl border border-white/[0.1] bg-[#2c2c2e] p-1 shadow-2xl"><button type="button" disabled={managing} onClick={() => void updateMetadata({ resolved: !selectedCurrent.resolved })} className="w-full rounded-lg px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/[0.07]">{selectedCurrent.resolved ? '미해결로 표시' : '해결됨으로 표시'}</button><button type="button" onClick={() => setNoteEditing(true)} className="w-full rounded-lg px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/[0.07]">메모 {selectedCurrent.user_note ? '수정' : '추가'}</button>{selectedCurrent.user_note && <button type="button" disabled={managing} onClick={() => void updateMetadata({ user_note: null })} className="w-full rounded-lg px-3 py-2 text-left text-xs text-zinc-400 hover:bg-white/[0.07]">메모 삭제</button>}<button type="button" onClick={() => setDeletePending(true)} className="w-full rounded-lg px-3 py-2 text-left text-xs text-rose-300 hover:bg-white/[0.07]">Error 삭제</button></div></details><button type="button" onClick={() => { setSelected(null); setContext(null); setAIError(null) }} className="rounded-xl bg-[#2c2c2e] px-4 text-sm text-zinc-200 hover:text-white">닫기</button></div>
            </div>

            <dl className="mt-6 grid gap-3 rounded-2xl border border-line bg-ink p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-zinc-600">프로젝트</dt><dd className="mt-1 text-zinc-300">{selectedCurrent.project_name}</dd></div>
              <div><dt className="text-zinc-600">발생 시간</dt><dd className="mt-1 text-zinc-300">{new Date(selectedCurrent.created_at).toLocaleString('ko-KR')}</dd></div>
              <div className="sm:col-span-2"><dt className="text-zinc-600">Command</dt><dd className="mt-1 break-all font-mono text-xs text-zinc-300">{selectedCurrent.command}</dd></div>
            </dl>

            <div className="mt-5 grid gap-3 rounded-2xl border border-line bg-ink p-4 sm:grid-cols-[160px_1fr]">
              <div><p className="text-xs text-zinc-600">상태</p><button type="button" disabled={managing} onClick={() => void updateMetadata({ resolved: !selectedCurrent.resolved })} className={`mt-2 rounded-full px-3 py-1.5 text-xs font-semibold ${selectedCurrent.resolved ? 'bg-lime/10 text-lime' : 'bg-rose-400/10 text-rose-300'}`}>{selectedCurrent.resolved ? '✓ 해결됨' : '● 미해결'}</button>{selectedCurrent.resolved_at && <p className="mt-2 text-[10px] text-zinc-600">{new Date(selectedCurrent.resolved_at).toLocaleString('ko-KR')}</p>}</div>
              <div><div className="flex items-center justify-between"><p className="text-xs text-zinc-600">메모</p>{!noteEditing && <button type="button" onClick={() => setNoteEditing(true)} className="min-h-0 text-xs text-apple">{selectedCurrent.user_note ? '수정' : '추가'}</button>}</div>{noteEditing ? <div className="mt-2"><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={20000} rows={3} placeholder="해결 과정이나 참고 내용을 기록하세요." className="w-full resize-y border border-line bg-[#151619] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-apple" /><div className="mt-2 flex justify-end gap-2"><button type="button" onClick={() => { setNote(selectedCurrent.user_note ?? ''); setNoteEditing(false) }} className="min-h-0 px-2 py-1 text-xs text-zinc-500">취소</button><button type="button" disabled={managing} onClick={() => void updateMetadata({ user_note: note })} className="min-h-0 rounded-lg bg-apple px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">저장</button></div></div> : <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{selectedCurrent.user_note ?? '작성된 메모가 없습니다.'}</p>}</div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-[#050607]">
              <p className="border-b border-line px-4 py-3 font-mono text-xs uppercase tracking-wider text-zinc-600">Stack trace</p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-6 text-rose-200">{selectedCurrent.stack_trace}</pre>
            </div>

            {aiError && <p role="alert" className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-300">{aiError}</p>}

            {analysis && (
              <div className="mt-6 space-y-5 rounded-3xl border border-lime/20 bg-lime/[0.03] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-xs font-semibold text-apple">AI 분석</p><p className="mt-1 font-mono text-[10px] text-zinc-600">{analysis.model}</p></div>
                  <time className="font-mono text-[10px] text-zinc-600">{new Date(analysis.created_at).toLocaleString()}</time>
                </div>
                <div><h3 className="text-sm font-semibold text-zinc-400">1. 오류 원인</h3><p className="mt-2 whitespace-pre-wrap leading-7 text-zinc-200">{analysis.cause}</p></div>
                <div><h3 className="text-sm font-semibold text-zinc-400">2. 쉽게 설명</h3><p className="mt-2 whitespace-pre-wrap leading-7 text-zinc-300">{analysis.explanation}</p></div>
                <div><h3 className="text-sm font-semibold text-zinc-400">3. 해결 방법</h3><ol className="mt-2 list-decimal space-y-2 pl-5 text-zinc-300">{analysis.solution_steps.map((step) => <li key={step}>{step}</li>)}</ol></div>
                {analysis.code_fix && (
                  <div><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-zinc-400">4. 수정 코드</h3><button type="button" onClick={() => void copy('code', analysis.code_fix!)} className="text-xs text-apple">{copied === 'code' ? '복사됨' : '코드 복사'}</button></div><pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-2xl bg-ink p-4 font-mono text-xs leading-6 text-zinc-200">{analysis.code_fix}</pre></div>
                )}
                {analysis.terminal_commands.length > 0 && (
                  <div><h3 className="text-sm font-semibold text-zinc-400">5. Terminal Command</h3><div className="mt-2 space-y-2">{analysis.terminal_commands.map((command, index) => <div key={`${command}-${index}`} className="flex items-center gap-3 rounded-xl bg-ink p-3"><code className="min-w-0 flex-1 break-all text-xs text-zinc-300">{command}</code><button type="button" onClick={() => void copy(`command-${index}`, command)} className="shrink-0 text-xs text-apple">{copied === `command-${index}` ? '복사됨' : '복사'}</button></div>)}</div><p className="mt-2 text-xs text-zinc-600">제안된 Command는 자동으로 실행되지 않습니다. 내용을 확인한 뒤 직접 사용하세요.</p></div>
                )}
              </div>
            )}

            <button type="button" disabled={analyzing || !aiStatus?.configured} onClick={() => void prepareAnalysis()} className="mt-5 w-full rounded-xl bg-apple px-5 py-3 text-sm font-semibold text-white hover:bg-apple-hover disabled:cursor-not-allowed disabled:opacity-30">
              {analyzing ? 'Gemini 분석을 준비하는 중…' : analysis ? 'Gemini로 다시 분석하기' : 'Gemini로 분석하기'}
            </button>
            {!aiStatus?.configured && <p className="mt-2 text-center text-xs text-zinc-600">Mac Agent의 .env에 GEMINI_API_KEY를 설정하고 다시 시작하세요.</p>}
          </section>
        </div>
      )}

      <ConfirmationDialog open={context !== null} title="이 Context를 Gemini로 보낼까요?" description="표시된 Error 정보와 작은 코드 일부만 전송합니다. 프로젝트 전체는 전송하지 않습니다." confirmLabel="Gemini 분석" busy={analyzing} onCancel={() => setContext(null)} onConfirm={() => void confirmAnalysis()}>
        <div className="max-h-80 space-y-3 overflow-y-auto rounded-2xl border border-line bg-ink p-4 text-sm">
          <div className="grid grid-cols-2 gap-3"><div><p className="text-zinc-600">Language</p><p className="mt-1 text-zinc-300">{context?.programming_language}</p></div><div><p className="text-zinc-600">Framework</p><p className="mt-1 text-zinc-300">{context?.framework ?? '알 수 없음'}</p></div></div>
          <div><p className="text-zinc-600">Error</p><p className="mt-1 break-words text-zinc-300">{context?.error_message}</p></div>
          <div><p className="text-zinc-600">File</p><p className="mt-1 break-all font-mono text-xs text-zinc-300">{context?.file ?? '소스 파일 없음'}</p></div>
          <div><p className="text-zinc-600">Stack trace</p><pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-5 text-zinc-400">{context?.stack_trace}</pre></div>
          {context?.code_snippet && <div><p className="text-zinc-600">관련 코드 일부</p><pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-5 text-zinc-400">{context.code_snippet}</pre></div>}
        </div>
      </ConfirmationDialog>
      <ConfirmationDialog open={deletePending} title="Error 기록을 삭제할까요?" description="이 기록과 연결된 AI 분석 기록도 함께 삭제됩니다. Project와 Command 기록에는 영향을 주지 않습니다." confirmLabel="삭제" busy={managing} onCancel={() => setDeletePending(false)} onConfirm={() => void confirmDelete()}>
        <p className="rounded-2xl bg-rose-400/[0.06] p-4 text-sm text-zinc-400">Error 원본과 연결된 Gemini 분석만 삭제되며 이 작업은 되돌릴 수 없습니다.</p>
      </ConfirmationDialog>
    </section>
  )
}
