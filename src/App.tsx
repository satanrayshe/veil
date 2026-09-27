import { lazy, Suspense, useEffect, useState } from 'react'
import { Wordmark } from './ui/kit'
import Home from './pages/Home'
import { useOnlineStatus, OfflineBadge } from './ui/pwa'
import { parseRoute, type Route } from './router'

const Docs = lazy(() => import('./pages/Docs'))
const Shield = lazy(() => import('./pages/Shield'))
const Ledger = lazy(() => import('./pages/Ledger'))

const NAV: { id: Route; label: string }[] = [
  { id: 'docs', label: 'Safe ID copy' },
  { id: 'shield', label: 'Prompt shield' },
  { id: 'ledger', label: 'Ledger' },
]

export default function App() {
  const [{ route, sample }, setState] = useState(parseRoute)
  const online = useOnlineStatus()

  useEffect(() => {
    const on = () => {
      setState(parseRoute())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-3 px-4 sm:px-6">
          <a href="#/" className="mr-2 text-[15px] text-ink" aria-label="Veil home">
            <Wordmark />
          </a>
          <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto" aria-label="Tools">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#/${n.id}`}
                aria-current={route === n.id ? 'page' : undefined}
                className={`whitespace-nowrap rounded-[7px] px-2.5 py-1.5 text-[13.5px] font-medium transition-colors sm:px-3 ${route === n.id ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-line/60'}`}
              >
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto hidden md:block">
            <OfflineBadge online={online} />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Suspense fallback={<div className="mx-auto max-w-[1240px] px-6 py-16 text-mute">Loading…</div>}>
          {route === 'home' && <Home />}
          {route === 'docs' && <Docs sample={sample} />}
          {route === 'shield' && <Shield sample={sample} />}
          {route === 'ledger' && <Ledger />}
        </Suspense>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-4 py-6 text-[13px] text-mute sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Veil has no server. Your files and text are processed in this tab and never uploaded.</p>
          <p>
            Built for CodeStorm 2026: FutureForge ·{' '}
            <a className="underline decoration-line-2 underline-offset-2 hover:text-ink" href="https://github.com/satanrayshe/veil" target="_blank" rel="noreferrer">
              Source on GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
