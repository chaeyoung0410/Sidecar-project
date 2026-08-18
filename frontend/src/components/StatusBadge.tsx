import type { ConnectionState } from '../types/health'

const statusCopy = {
  connected: { label: 'Mac Agent 연결됨', dot: 'bg-lime', pulse: false },
  disconnected: { label: '연결 끊김', dot: 'bg-[#ff453a]', pulse: false },
  reconnecting: { label: '다시 연결하는 중', dot: 'bg-[#ffd60a]', pulse: true },
} satisfies Record<ConnectionState, { label: string; dot: string; pulse: boolean }>

export function StatusBadge({ state }: { state: ConnectionState }) {
  const status = statusCopy[state]

  return (
    <div className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white/[0.07] px-3 py-1.5 text-[13px] font-medium text-zinc-200">
      <span className={`h-2 w-2 rounded-full ${status.dot} ${status.pulse ? 'animate-pulse' : ''}`} aria-hidden="true" />
      <span>{status.label}</span>
    </div>
  )
}
