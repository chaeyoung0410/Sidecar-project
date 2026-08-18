import { useEffect, useState } from 'react'
import { ActionManager } from '../components/ActionManager'
import { AppIcon } from '../components/AppIcon'
import { AppSidebar, type AppRoute } from '../components/AppSidebar'
import { CommandPanel } from '../components/CommandPanel'
import { ConfirmationDialog } from '../components/ConfirmationDialog'
import { DeckActionPicker } from '../components/DeckActionPicker'
import { DeckDetail } from '../components/DeckDetail'
import { DeckDialog } from '../components/DeckDialog'
import { deckIcons } from '../components/deckMetadata'
import { ErrorPanel } from '../components/ErrorPanel'
import { GitStatusPanel } from '../components/GitStatusPanel'
import { NotionPanel } from '../components/NotionPanel'
import { ProjectDialog } from '../components/ProjectDialog'
import { ProjectNameDialog } from '../components/ProjectNameDialog'
import { SettingsPanel } from '../components/SettingsPanel'
import { StatusBadge } from '../components/StatusBadge'
import { useAgentConnection } from '../hooks/useAgentConnection'
import { useCommands } from '../hooks/useCommands'
import { useDashboardActions } from '../hooks/useDashboardActions'
import { useDecks } from '../hooks/useDecks'
import { useErrors } from '../hooks/useErrors'
import { useNotion } from '../hooks/useNotion'
import { useWorkspace } from '../hooks/useWorkspace'
import type { DashboardAction, DashboardActionType } from '../types/action'
import type { Deck, DeckIcon, DeckInput } from '../types/deck'

const routes = new Set<AppRoute>(['#home', '#error-monitor', '#git', '#notion-journal', '#actions', '#settings'])
type DashboardRoute = AppRoute | `#decks/${number}`

const actionRoutes: Record<DashboardActionType, AppRoute> = {
  ai_error: '#error-monitor',
  git_commit: '#git',
  git_push: '#git',
  git_pull: '#git',
  notion: '#notion-journal',
  command: '#actions',
}

function currentRoute(): DashboardRoute {
  const hash = window.location.hash
  if (routes.has(hash as AppRoute)) return hash as AppRoute
  return /^#decks\/\d+$/.test(hash) ? hash as DashboardRoute : '#home'
}

export function Dashboard() {
  const { state, retry } = useAgentConnection()
  const workspace = useWorkspace()
  const deckState = useDecks(workspace.currentProject?.id ?? null)
  const commandState = useCommands()
  const actionState = useDashboardActions()
  const errorState = useErrors()
  const notionState = useNotion()
  const [route, setRoute] = useState<DashboardRoute>(currentRoute)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [projectNameOpen, setProjectNameOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [deckDialogOpen, setDeckDialogOpen] = useState(false)
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null)
  const [actionPickerOpen, setActionPickerOpen] = useState(false)
  const [deleteDeck, setDeleteDeck] = useState<Deck | null>(null)
  const [deckBusy, setDeckBusy] = useState(false)

  useEffect(() => {
    const updateRoute = () => setRoute(currentRoute())
    window.addEventListener('hashchange', updateRoute)
    if (!window.location.hash) window.history.replaceState(null, '', '#home')
    return () => window.removeEventListener('hashchange', updateRoute)
  }, [])

  const navigate = (nextRoute: DashboardRoute) => {
    if (window.location.hash !== nextRoute) window.location.hash = nextRoute
    setRoute(nextRoute)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const navigateAction = (action: DashboardAction) => navigate(actionRoutes[action.type])
  const selectedDeckId = route.startsWith('#decks/') ? Number(route.split('/')[1]) : null
  const selectedDeck = selectedDeckId === null ? null : deckState.decks.find((deck) => deck.id === selectedDeckId) ?? null

  const saveDeck = async (payload: DeckInput) => {
    if (editingDeck) await deckState.update(editingDeck.id, payload)
    else await deckState.create(payload)
  }

  const confirmDeleteDeck = async () => {
    if (!deleteDeck) return
    setDeckBusy(true)
    try { await deckState.remove(deleteDeck.id); setDeleteDeck(null); navigate('#home') }
    finally { setDeckBusy(false) }
  }

  const sidebarRoute: AppRoute = route.startsWith('#decks/') ? '#home' : route as AppRoute
  return <main className="min-h-screen bg-ink text-[#f5f5f7]">
    <div className="md:grid md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[236px_minmax(0,1fr)]">
      <AppSidebar active={sidebarRoute} onNavigate={navigate} onManageActions={() => { navigate('#actions'); setActionsOpen(true) }} />
      <div className="min-w-0 pb-24 md:pb-0">
        <div className="mx-auto max-w-[1180px] px-5 pb-12 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 lg:px-10">
          <header className={`flex flex-wrap items-center gap-4 border-b border-white/[0.08] pb-5 ${route === '#home' ? 'justify-between' : 'justify-end'}`}>
            {route === '#home' && <div><p className="text-[13px] font-medium text-zinc-500">개발 작업 공간</p><h1 className="mt-1 text-[30px] font-bold tracking-[-0.03em] text-white sm:text-[34px]">홈</h1></div>}
            <div className="flex items-center gap-3"><StatusBadge state={state} />{state === 'disconnected' && <button type="button" onClick={() => void retry()} className="rounded-xl bg-apple px-4 py-2 text-sm font-semibold text-white">다시 연결</button>}</div>
          </header>

          {route === '#home' && <section className="pb-12 pt-8">
            <div className="rounded-[28px] bg-panel p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-apple/15 text-apple"><AppIcon name="folder" /></span>
                  <div className="min-w-0"><p className="text-sm text-zinc-500">현재 프로젝트</p><p className="mt-1 break-words text-[28px] font-bold tracking-tight text-white sm:text-[34px]">{workspace.currentProject?.name ?? '프로젝트를 선택하세요'}</p></div>
                </div>
                <div className="flex gap-2">
                  {workspace.currentProject && <button type="button" onClick={() => setProjectNameOpen(true)} className="rounded-xl bg-white/[0.06] px-3 py-2 text-sm font-medium text-zinc-300 hover:text-white">이름 수정</button>}
                  <button type="button" onClick={() => setProjectsOpen(true)} className="rounded-xl bg-white/[0.06] px-3 py-2 text-sm font-medium text-apple">프로젝트 변경</button>
                </div>
              </div>
              <div className="mt-7 grid gap-4 border-t border-white/[0.08] pt-6 sm:grid-cols-3">
                <div><p className="text-xs text-zinc-500">프로젝트 경로</p><p className="mt-2 break-all font-mono text-xs leading-5 text-zinc-300">{workspace.currentProject?.path ?? '등록된 프로젝트 없음'}</p></div>
                <div><p className="text-xs text-zinc-500">Mac Agent</p><p className="mt-2 flex items-center gap-2 text-sm font-medium text-zinc-200"><span className={`h-2 w-2 rounded-full ${state === 'connected' ? 'bg-lime' : 'bg-zinc-600'}`} />{state === 'connected' ? '연결됨' : '연결 안 됨'}</p></div>
                <div><p className="text-xs text-zinc-500">현재 Branch</p><p className="mt-2 break-all font-mono text-sm text-zinc-200">{workspace.gitStatus?.branch ?? '—'}</p></div>
              </div>
            </div>

            {(workspace.error || actionState.error || deckState.error) && <p role="alert" className="mt-5 rounded-2xl bg-[#ff453a]/10 px-4 py-3 text-sm text-[#ff6961]">{workspace.error ?? actionState.error ?? deckState.error}</p>}
            <div className="mb-5 mt-12 flex items-end justify-between"><div><h2 className="text-[22px] font-semibold text-white">Deck</h2><p className="mt-1 text-sm text-zinc-500">Quick Actions를 목적별 Deck으로 관리합니다.</p></div><button type="button" disabled={!workspace.currentProject} onClick={() => { setEditingDeck(null); setDeckDialogOpen(true) }} className="rounded-xl px-3 text-sm font-medium text-apple disabled:opacity-30">＋ Deck 추가</button></div>
            {deckState.loading ? <div className="rounded-[22px] bg-panel p-8 text-center text-sm text-zinc-500">Deck을 불러오는 중…</div> : deckState.decks.length ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{deckState.decks.map((deck, index) => <article key={deck.id} className="group rounded-[22px] bg-panel p-5 sm:p-6"><button type="button" onClick={() => navigate(`#decks/${deck.id}`)} className="w-full text-left"><div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-apple/10 font-mono text-apple">{deckIcons[deck.icon as DeckIcon] ?? '▦'}</span><span className="text-2xl text-zinc-600 transition group-hover:translate-x-1">›</span></div><p className="mt-7 break-words text-[19px] font-semibold text-white">{deck.name}</p><p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-zinc-500">{deck.description || '설명 없음'}</p><p className="mt-4 text-xs text-zinc-600">{deck.actions.length}개의 Action</p></button><div className="mt-4 flex justify-end gap-1 border-t border-white/[0.07] pt-3"><button type="button" disabled={index === 0} onClick={() => void deckState.moveDeck(deck.id, -1)} aria-label={`${deck.name} 위로 이동`} className="rounded-lg px-2 py-1 text-xs text-zinc-500 disabled:opacity-20">↑</button><button type="button" disabled={index === deckState.decks.length - 1} onClick={() => void deckState.moveDeck(deck.id, 1)} aria-label={`${deck.name} 아래로 이동`} className="rounded-lg px-2 py-1 text-xs text-zinc-500 disabled:opacity-20">↓</button></div></article>)}</div> : <div className="rounded-[22px] border border-dashed border-white/[0.18] p-9 text-center"><p className="font-semibold text-zinc-200">아직 생성된 Deck이 없습니다.</p><p className="mt-2 text-sm leading-6 text-zinc-500">자주 사용하는 개발 기능을 Deck으로 묶어서 관리해보세요.</p><button type="button" disabled={!workspace.currentProject} onClick={() => { setEditingDeck(null); setDeckDialogOpen(true) }} className="mt-5 rounded-xl bg-apple px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-30">Deck 추가</button></div>}
          </section>}

          {route.startsWith('#decks/') && selectedDeck && <DeckDetail deck={selectedDeck} onBack={() => navigate('#home')} onEdit={() => { setEditingDeck(selectedDeck); setDeckDialogOpen(true) }} onDelete={() => setDeleteDeck(selectedDeck)} onAdd={() => setActionPickerOpen(true)} onOpenAction={navigateAction} onRemoveAction={(actionId) => { if (window.confirm('이 Action을 현재 Deck에서 제거할까요? 원본 Action은 삭제되지 않습니다.')) void deckState.removeAction(selectedDeck.id, actionId) }} onMoveAction={(actionId, direction) => void deckState.moveAction(selectedDeck.id, actionId, direction)} />}
          {route.startsWith('#decks/') && !selectedDeck && !deckState.loading && <section className="py-16 text-center"><p className="font-semibold text-zinc-200">Deck을 찾을 수 없습니다.</p><button type="button" onClick={() => navigate('#home')} className="mt-4 text-sm text-apple">Deck 목록으로 돌아가기</button></section>}

          {route === '#error-monitor' && <ErrorPanel errors={errorState.errors} loading={errorState.loading} error={errorState.error} onRefresh={() => void errorState.refresh()} />}
          {route === '#git' && <GitStatusPanel status={workspace.gitStatus} loading={workspace.loading} error={workspace.gitError} hasProject={workspace.currentProject !== null} onRefresh={() => void workspace.refresh()} onManageProjects={() => setProjectsOpen(true)} onCommit={workspace.commitChanges} onGetPushPreview={workspace.getPushPreview} onPush={workspace.pushChanges} onGetPullPreview={workspace.getPullPreview} onPull={workspace.pullChanges} />}
          {route === '#notion-journal' && <NotionPanel status={notionState.status} logs={notionState.logs} loading={notionState.loading} saving={notionState.saving} error={notionState.error} projectName={workspace.currentProject?.name ?? null} onRefresh={() => void notionState.refresh()} onSave={notionState.save} />}
          {route === '#actions' && <section id="actions" className="py-12"><div className="mb-7 flex items-end justify-between gap-4"><div><h2 className="text-[30px] font-bold tracking-tight text-white">Actions</h2><p className="mt-2 text-[15px] text-zinc-500">실행할 내용을 확인하고 Action과 Custom Command를 관리합니다.</p></div><button type="button" onClick={() => setActionsOpen(true)} className="rounded-xl bg-[#2c2c2e] px-4 py-2.5 text-sm font-semibold text-white">Action 관리</button></div><CommandPanel project={workspace.currentProject} commands={commandState.commands} runs={commandState.runs} loading={commandState.loading} error={commandState.error} onCreate={commandState.createCommand} onUpdate={commandState.updateCommand} onDelete={commandState.deleteCommand} onRun={commandState.runCommand} onStop={commandState.stopCommand} /></section>}
          {route === '#settings' && <SettingsPanel connection={state} project={workspace.currentProject} notion={notionState.status} />}
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] py-6 text-xs text-zinc-600"><span>Local Network 전용</span><span>CodePad · Apple Minimal UI</span></footer>
        </div>
      </div>
    </div>

    <ProjectDialog open={projectsOpen} projects={workspace.projects} onClose={() => setProjectsOpen(false)} onCreate={workspace.createProject} onSelect={workspace.selectProject} onDelete={workspace.deleteProject} />
    <ProjectNameDialog project={workspace.currentProject} open={projectNameOpen} onClose={() => setProjectNameOpen(false)} onSave={workspace.updateProject} />
    <ActionManager open={actionsOpen} actions={actionState.actions} commands={commandState.commands} onClose={() => setActionsOpen(false)} onCreate={actionState.createAction} onUpdate={actionState.updateAction} onDelete={actionState.deleteAction} onMove={actionState.moveAction} />
    <DeckDialog open={deckDialogOpen} deck={editingDeck} onClose={() => setDeckDialogOpen(false)} onSave={saveDeck} />
    <DeckActionPicker open={actionPickerOpen} busy={deckBusy} actions={actionState.actions.filter((action) => !selectedDeck?.actions.some((current) => current.id === action.id))} onClose={() => setActionPickerOpen(false)} onAdd={async (actionId) => { if (!selectedDeck) return; setDeckBusy(true); try { await deckState.addAction(selectedDeck.id, actionId) } finally { setDeckBusy(false) } }} />
    <ConfirmationDialog open={deleteDeck !== null} title={`'${deleteDeck?.name ?? ''}'을 삭제할까요?`} description="Deck에 포함된 Action 연결도 함께 제거됩니다. 실제 Git, Command 또는 프로젝트 데이터는 삭제되지 않습니다." confirmLabel="Deck 삭제" busy={deckBusy} onCancel={() => setDeleteDeck(null)} onConfirm={() => void confirmDeleteDeck()}><p className="rounded-2xl bg-rose-400/[0.06] p-4 text-sm text-zinc-400">이 작업은 Deck 구성만 삭제하며 원본 Action은 그대로 유지합니다.</p></ConfirmationDialog>
  </main>
}
