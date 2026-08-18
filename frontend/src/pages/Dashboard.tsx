import { useState } from 'react'
import { ActionCard } from '../components/ActionCard'
import { ActionManager } from '../components/ActionManager'
import { actionIcons } from '../components/actionMetadata'
import { AppIcon } from '../components/AppIcon'
import { AppSidebar } from '../components/AppSidebar'
import { CommandPanel } from '../components/CommandPanel'
import { ConfirmationDialog } from '../components/ConfirmationDialog'
import { ErrorPanel } from '../components/ErrorPanel'
import { GitStatusPanel } from '../components/GitStatusPanel'
import { NotionPanel } from '../components/NotionPanel'
import { ProjectDialog } from '../components/ProjectDialog'
import { SettingsPanel } from '../components/SettingsPanel'
import { StatusBadge } from '../components/StatusBadge'
import { API_BASE_URL } from '../services/api'
import { useAgentConnection } from '../hooks/useAgentConnection'
import { useCommands } from '../hooks/useCommands'
import { useDashboardActions } from '../hooks/useDashboardActions'
import { useErrors } from '../hooks/useErrors'
import { useNotion } from '../hooks/useNotion'
import { useWorkspace } from '../hooks/useWorkspace'
import type { DashboardAction } from '../types/action'
import type { SavedCommand } from '../types/command'

const actionDescriptions = {
  ai_error: '발생한 Error를 Gemini가 분석하고 해결 방법을 제안합니다.',
  git_commit: '변경한 파일을 선택하고 현재 Branch에 Commit합니다.',
  git_push: '현재 Branch의 Commit을 원격 Repository로 Push합니다.',
  notion: '오늘의 개발 내용을 정리하고 Notion에 저장합니다.',
  command: '등록된 Command를 확인한 뒤 Mac에서 실행합니다.',
}

export function Dashboard() {
  const { state, health, lastConnectedAt, retry } = useAgentConnection()
  const workspace = useWorkspace()
  const commandState = useCommands()
  const actionState = useDashboardActions()
  const errorState = useErrors()
  const notionState = useNotion()
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [quickCommand, setQuickCommand] = useState<SavedCommand | null>(null)
  const [quickBusy, setQuickBusy] = useState(false)
  const [quickError, setQuickError] = useState<string | null>(null)

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  const runDashboardAction = (action: DashboardAction) => {
    if (action.type === 'ai_error') return scrollTo('error-monitor')
    if (action.type === 'git_commit' || action.type === 'git_push') return scrollTo('git')
    if (action.type === 'notion') return scrollTo('notion-journal')
    if (action.type === 'command') {
      const command = commandState.commands.find((item) => item.id === action.config.command_id)
      if (command) { setQuickError(null); setQuickCommand(command) }
      else scrollTo('command-runner')
    }
  }

  const confirmQuickCommand = async () => {
    if (!quickCommand) return
    setQuickBusy(true); setQuickError(null)
    try {
      await commandState.runCommand(quickCommand.id)
      setQuickCommand(null)
      window.setTimeout(() => scrollTo('command-runner'), 50)
    } catch (requestError) {
      setQuickError(requestError instanceof Error ? requestError.message : 'Command를 시작하지 못했습니다.')
    } finally { setQuickBusy(false) }
  }

  const latestError = errorState.errors[0]

  return <main className="min-h-screen bg-ink text-[#f5f5f7]">
    <div className="md:grid md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[236px_minmax(0,1fr)]">
      <AppSidebar onManageActions={() => setActionsOpen(true)} />
      <div className="min-w-0 pb-24 md:pb-0">
        <div className="mx-auto max-w-[1180px] px-5 pb-12 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 lg:px-10">
          <section id="home" className="pb-12 pt-1 sm:pb-16">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
              <div><p className="text-[13px] font-medium text-zinc-500">개발 작업 공간</p><h1 className="mt-1 text-[30px] font-bold tracking-[-0.03em] text-white sm:text-[34px]">홈</h1></div>
              <div className="flex items-center gap-3"><StatusBadge state={state} />{state === 'disconnected' && <button type="button" onClick={() => void retry()} className="rounded-xl bg-apple px-4 text-sm font-semibold text-white">다시 연결</button>}</div>
            </header>

            <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
              <button type="button" onClick={() => setProjectsOpen(true)} className="group min-h-52 rounded-[28px] bg-panel p-6 text-left transition hover:bg-[#242426] sm:p-8">
                <div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-apple/15 text-apple"><AppIcon name="folder" /></span><span className="text-sm font-medium text-apple">프로젝트 변경</span></div>
                <p className="mt-8 text-sm text-zinc-500">현재 프로젝트</p><p className="mt-2 break-words text-[28px] font-bold tracking-tight text-white sm:text-[34px]">{workspace.currentProject?.name ?? '프로젝트를 선택하세요'}</p>
                <p className="mt-3 break-all text-sm leading-6 text-zinc-500">{workspace.currentProject?.path ?? 'Mac에서 작업할 프로젝트를 등록하면 Git과 Command 기능을 사용할 수 있습니다.'}</p>
              </button>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[22px] bg-panel p-5"><AppIcon name="branch" className="h-5 w-5 text-apple" /><p className="mt-6 text-xs text-zinc-500">현재 Branch</p><p className="mt-1 break-all font-mono text-sm text-zinc-100">{workspace.gitStatus?.branch ?? '—'}</p></div>
                <div className="rounded-[22px] bg-panel p-5"><AppIcon name="git" className="h-5 w-5 text-apple" /><p className="mt-6 text-xs text-zinc-500">변경된 파일</p><p className="mt-1 text-xl font-semibold text-white">{workspace.gitStatus?.changed_files.length ?? 0}개</p></div>
                <div className="rounded-[22px] bg-panel p-5"><AppIcon name="error" className={`h-5 w-5 ${latestError ? 'text-[#ff453a]' : 'text-lime'}`} /><p className="mt-6 text-xs text-zinc-500">최근 Error</p><p className="mt-1 line-clamp-2 text-sm font-medium text-zinc-100">{latestError ? latestError.error_message : '발생한 Error 없음'}</p></div>
                <div className="rounded-[22px] bg-panel p-5"><AppIcon name="terminal" className="h-5 w-5 text-apple" /><p className="mt-6 text-xs text-zinc-500">Mac Agent</p><p className="mt-1 text-sm font-medium text-zinc-100">{health ? `v${health.version}` : API_BASE_URL}</p><p className="mt-1 text-xs text-zinc-600">{lastConnectedAt ? new Date(lastConnectedAt).toLocaleTimeString('ko-KR') : '연결 기록 없음'}</p></div>
              </div>
            </div>

            {(workspace.error || actionState.error) && <p role="alert" className="mt-5 rounded-2xl bg-[#ff453a]/10 px-4 py-3 text-sm text-[#ff6961]">{workspace.error ?? actionState.error}</p>}
            <div className="mb-5 mt-12 flex items-end justify-between"><div><h2 className="text-[22px] font-semibold text-white">Quick Actions</h2><p className="mt-1 text-sm text-zinc-500">자주 사용하는 개발 기능을 바로 실행합니다.</p></div><button type="button" onClick={() => setActionsOpen(true)} className="rounded-xl px-3 text-sm font-medium text-apple">편집</button></div>
            {actionState.actions.length ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">{actionState.actions.map((action) => <ActionCard key={action.id} name={action.name} shortcut={action.type === 'command' && action.config.command_id ? `${commandState.commands.find((item) => item.id === action.config.command_id)?.name ?? '연결된 Command 없음'}을 Mac에서 실행합니다.` : actionDescriptions[action.type]} symbol={actionIcons[action.icon]} disabled={false} onClick={() => runDashboardAction(action)} />)}<button type="button" onClick={() => setActionsOpen(true)} className="min-h-40 rounded-[22px] border border-dashed border-white/[0.18] p-5 text-left text-zinc-400 transition hover:border-apple/60 hover:bg-apple/[0.05] sm:min-h-44 sm:p-6"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-2xl text-apple">＋</span><p className="mt-8 text-[17px] font-semibold text-white">Action 추가</p><p className="mt-2 text-sm leading-5 text-zinc-500">자주 사용하는 기능을 Dashboard에 추가합니다.</p></button></div> : <button type="button" onClick={() => setActionsOpen(true)} className="w-full rounded-[22px] border border-dashed border-white/[0.18] p-8 text-center"><p className="font-semibold text-zinc-200">아직 등록된 Action이 없습니다.</p><p className="mt-2 text-sm text-zinc-500">자주 사용하는 개발 기능을 Dashboard에 추가해보세요.</p></button>}
          </section>

          <ErrorPanel errors={errorState.errors} loading={errorState.loading} error={errorState.error} onRefresh={() => void errorState.refresh()} />
          <GitStatusPanel status={workspace.gitStatus} loading={workspace.loading} error={workspace.gitError} hasProject={workspace.currentProject !== null} onRefresh={() => void workspace.refresh()} onManageProjects={() => setProjectsOpen(true)} onCommit={workspace.commitChanges} onGetPushPreview={workspace.getPushPreview} onPush={workspace.pushChanges} />
          <NotionPanel status={notionState.status} logs={notionState.logs} loading={notionState.loading} saving={notionState.saving} error={notionState.error} projectName={workspace.currentProject?.name ?? null} onRefresh={() => void notionState.refresh()} onSave={notionState.save} />
          <section id="actions" className="py-12 sm:py-16"><div className="mb-7 flex items-end justify-between gap-4"><div><h2 className="text-[30px] font-bold tracking-tight text-white">Actions</h2><p className="mt-2 text-[15px] text-zinc-500">Dashboard Action과 Mac에서 실행할 Custom Command를 관리합니다.</p></div><button type="button" onClick={() => setActionsOpen(true)} className="rounded-xl bg-[#2c2c2e] px-4 text-sm font-semibold text-white">Action 관리</button></div><CommandPanel project={workspace.currentProject} commands={commandState.commands} runs={commandState.runs} loading={commandState.loading} error={commandState.error} onCreate={commandState.createCommand} onUpdate={commandState.updateCommand} onDelete={commandState.deleteCommand} onRun={commandState.runCommand} onStop={commandState.stopCommand} /></section>
          <SettingsPanel connection={state} project={workspace.currentProject} notion={notionState.status} />
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] py-6 text-xs text-zinc-600"><span>Local Network 전용</span><span>CodePad · Apple Minimal UI</span></footer>
        </div>
      </div>
    </div>

    <ProjectDialog open={projectsOpen} projects={workspace.projects} onClose={() => setProjectsOpen(false)} onCreate={workspace.createProject} onSelect={workspace.selectProject} onDelete={workspace.deleteProject} />
    <ActionManager open={actionsOpen} actions={actionState.actions} commands={commandState.commands} onClose={() => setActionsOpen(false)} onCreate={actionState.createAction} onUpdate={actionState.updateAction} onDelete={actionState.deleteAction} onMove={actionState.moveAction} />
    <ConfirmationDialog open={quickCommand !== null} title="이 Command를 실행할까요?" description="아래 내용을 확인한 뒤 Mac에서 Command를 실행합니다." confirmLabel="Command 실행" busy={quickBusy} disabled={!workspace.currentProject} onCancel={() => { setQuickCommand(null); setQuickError(null) }} onConfirm={() => void confirmQuickCommand()}><div className="space-y-3 rounded-2xl bg-black/30 p-4 text-sm"><div><p className="text-zinc-500">Command</p><p className="mt-1 break-all font-mono text-zinc-200">{quickCommand?.command}</p></div><div><p className="text-zinc-500">프로젝트</p><p className="mt-1 text-zinc-300">{workspace.currentProject?.name ?? '먼저 프로젝트를 선택하세요.'}</p></div><div><p className="text-zinc-500">Working Directory</p><p className="mt-1 break-all font-mono text-xs text-zinc-300">{quickCommand?.working_directory}</p></div>{quickError && <p className="text-[#ff6961]">{quickError}</p>}</div></ConfirmationDialog>
  </main>
}
