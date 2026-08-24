interface ActionCardProps {
  name: string
  shortcut: string
  symbol: string
  accent?: boolean
  disabled?: boolean
  onClick?: () => void
}

export function ActionCard({ name, shortcut, symbol, accent = false, disabled = true, onClick }: ActionCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={disabled ? `${name} 기능은 아직 사용할 수 없습니다.` : `${name} 열기`}
      className={`group min-h-40 rounded-[22px] p-5 text-left transition duration-200 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-44 sm:p-6 ${
        accent
          ? 'bg-apple text-white'
          : `bg-panel ${disabled ? '' : 'hover:bg-[#242426]'}`
      }`}
    >
      <div className="flex h-full flex-col justify-between gap-8">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-mono text-lg ${accent ? 'bg-white/15' : 'bg-apple/15 text-apple'}`}>
          {symbol}
        </div>
        <div className="relative pr-7">
          <p className="text-[17px] font-semibold text-white">{name}</p>
          <p className={`mt-2 line-clamp-2 text-sm leading-5 ${accent ? 'text-white/75' : 'text-zinc-400'}`}>
            {shortcut}
          </p>
          {!disabled && <span aria-hidden="true" className={`absolute bottom-0 right-0 text-xl transition group-hover:translate-x-1 ${accent ? 'text-white/80' : 'text-zinc-500'}`}>›</span>}
        </div>
      </div>
    </button>
  )
}
