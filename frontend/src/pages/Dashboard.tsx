import { useEffect, useState } from 'react'
import { ActionCard } from '../components/ActionCard'
import { ActionManager } from '../components/ActionManager'
import { actionIcons } from '../components/actionMetadata'
import { AppIcon } from '../components/AppIcon'
import { AppSidebar, type AppRoute } from '../components/AppSidebar'
import { CommandPanel } from '../components/CommandPanel'
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
import { useErrors } from '../hooks/useErrors'
import { useNotion } from '../hooks/useNotion'
import { useWorkspace } from '../hooks/useWorkspace'
import type { DashboardAction, DashboardActionType } from '../types/action'

const routes = new Set<AppRoute>(['#home', '#error-monitor', '#git', '#notion-journal', '#actions', '#settings'])

const actionDescriptions: Record<DashboardActionType, string> = {
  ai_error: '발생한 Error를 확인하고 Gemini로 분석합니다.',
  git_commit: '변경한 파일을 선택하고 Commit합니다.',
  git_push: '현재 Branch의 Commit을 확인하고 Push합니다.',
  notion: '개발 기록을 작성하고 Notion에 저장합니다.',
  command: '등록된 Command를 확인하고 실행합니다.',
}

const actionRoutes: Record<DashboardActionType, AppRoute> = {
  ai_error: '#error-monitor',
  git_commit: '#git',
  git_push: '#git',
  notion: '#notion-journal',
  command: '#actions',
}

function currentRoute(): AppRoute {
  const hash = window.location.hash as AppRoute
  return routes.has(hash) ? hash : '#home'
}

export function Dashboard() {
  const { state, retry } = useAgentConnection()
  const workspace = useWorkspace()
  const commandState = useCommands()
  const actionState = useDashboardActions()
  const errorState = useErrors()
  const notionState = useNotion()
  const [route, setRoute] = useState<AppRoute>(currentRoute)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [projectNameOpen, setProjectNameOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)

  useEffect(() => {
    const updateRoute = () => setRoute(currentRoute())
    window.addEventListener('hashchange', updateRoute)
    if (!window.location.hash || !routes.has(window.location.hash as AppRoute)) window.history.replaceState(null, '', '#home')
    return () => window.removeEventListener('hashchange', updateRoute)
  }, [])

  const navigate = (nextRoute: AppRoute) => {
    if (window.location.hash !== nextRoute) window.location.hash = nextRoute
    setRoute(nextRoute)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const navigateAction = (action: DashboardAction) => navigate(actionRoutes[action.type])
  return <main className="min-h-screen bg-ink text-[#f5f5f7]">
    <div className="md:grid md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[236px_minmax(0,1fr)]">
      <AppSidebar active={route} onNavigate={navigate} onManageActions={() => { navigate('#actions'); setActionsOpen(true) }} />
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

            {(workspace.error || actionState.error) && <p role="alert" className="mt-5 rounded-2xl bg-[#ff453a]/10 px-4 py-3 text-sm text-[#ff6961]">{workspace.error ?? actionState.error}</p>}
            <div className="mb-5 mt-12 flex items-end justify-between"><div><h2 className="text-[22px] font-semibold text-white">Quick Actions</h2><p className="mt-1 text-sm text-zinc-500">기능을 확인하고 실행할 상세 화면으로 이동합니다.</p></div><button type="button" onClick={() => navigate('#actions')} className="rounded-xl px-3 text-sm font-medium text-apple">관리</button></div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {actionState.actions.map((action) => <ActionCard key={action.id} name={action.name} shortcut={actionDescriptions[action.type]} symbol={actionIcons[action.icon]} disabled={false} onClick={() => navigateAction(action)} />)}
              <ActionCard name="Actions" shortcut="등록된 Action과 Custom Command를 관리합니다." symbol="▣" disabled={false} onClick={() => navigate('#actions')} />
            </div>
          </section>}

          {route === '#error-monitor' && <ErrorPanel errors={errorState.errors} loading={errorState.loading} error={errorState.error} onRefresh={() => void errorState.refresh()} />}
          {route === '#git' && <GitStatusPanel status={workspace.gitStatus} loading={workspace.loading} error={workspace.gitError} hasProject={workspace.currentProject !== null} onRefresh={() => void workspace.refresh()} onManageProjects={() => setProjectsOpen(true)} onCommit={workspace.commitChanges} onGetPushPreview={workspace.getPushPreview} onPush={workspace.pushChanges} />}
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
  </main>
}
