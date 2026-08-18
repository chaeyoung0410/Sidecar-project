import { useEffect, useState } from 'react'
import { BrandMark } from './BrandMark'
import { AppIcon, type AppIconName } from './AppIcon'

interface NavItem { label: string; href: string; icon: AppIconName }

const mainItems: NavItem[] = [
  { label: '홈', href: '#home', icon: 'home' },
  { label: 'Error', href: '#error-monitor', icon: 'error' },
  { label: 'Git', href: '#git', icon: 'git' },
  { label: 'Notion', href: '#notion-journal', icon: 'notion' },
  { label: 'Actions', href: '#actions', icon: 'actions' },
]

export function AppSidebar({ onManageActions }: { onManageActions: () => void }) {
  const [active, setActive] = useState('#home')
  useEffect(() => {
    const sectionIds = [...mainItems.map((item) => item.href.slice(1)), 'settings']
    const sections = sectionIds.map((id) => document.getElementById(id)).filter((section): section is HTMLElement => section !== null)
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (visible) setActive(`#${visible.target.id}`)
    }, { rootMargin: '-15% 0px -65%', threshold: [0, 0.1, 0.5] })
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])
  const linkStyle = (href: string) => active === href ? 'bg-apple/15 text-apple' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white'
  return (
    <>
      <aside className="sticky top-0 hidden h-screen border-r border-white/[0.08] bg-[#0b0b0c] px-4 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))] md:flex md:flex-col">
        <a href="#home" className="flex items-center gap-3 px-2 py-2 text-white"><BrandMark /><div><p className="text-base font-semibold tracking-tight">CodePad</p><p className="text-xs text-zinc-500">Mac 개발 도구</p></div></a>
        <nav aria-label="주요 메뉴" className="mt-8 space-y-1">
          {mainItems.map((item) => <a key={item.href} href={item.href} onClick={() => setActive(item.href)} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition focus-visible:bg-white/[0.06] ${linkStyle(item.href)}`}><AppIcon name={item.icon} />{item.label}</a>)}
        </nav>
        <div className="mt-auto border-t border-white/[0.08] pt-4">
          <a href="#settings" onClick={() => setActive('#settings')} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition ${linkStyle('#settings')}`}><AppIcon name="settings" />설정</a>
          <button type="button" onClick={onManageActions} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] text-zinc-500 transition hover:bg-white/[0.06] hover:text-white"><AppIcon name="actions" className="h-4 w-4" />Action 편집</button>
        </div>
      </aside>

      <nav aria-label="모바일 메뉴" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-white/[0.1] bg-[#151516]/95 px-[max(.35rem,env(safe-area-inset-left))] pb-[max(.35rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl md:hidden">
        {[...mainItems, { label: '설정', href: '#settings', icon: 'settings' as const }].map((item) => <a key={item.href} href={item.href} onClick={() => setActive(item.href)} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium active:bg-white/[0.08] ${active === item.href ? 'text-apple' : 'text-zinc-400'}`}><AppIcon name={item.icon} className="h-5 w-5" />{item.label}</a>)}
      </nav>
    </>
  )
}
