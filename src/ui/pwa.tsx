import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { warmEngines } from '../lib/warm'

export function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 1500))

export function OfflineBadge({ online }: { online: boolean }) {
  const {
    offlineReady: [ready],
  } = useRegisterSW({ immediate: true })
  const [controlled, setControlled] = useState(() => !!navigator.serviceWorker?.controller)

  useEffect(() => {
    const sw = navigator.serviceWorker
    if (!sw) return
    const onChange = () => setControlled(!!sw.controller)
    sw.addEventListener('controllerchange', onChange)
    return () => sw.removeEventListener('controllerchange', onChange)
  }, [])

  // As soon as the service worker is in charge, pull the OCR engine into its cache.
  useEffect(() => {
    if (controlled && online) idle(() => void warmEngines())
  }, [controlled, online])

  const cached = ready || controlled
  const text = !online ? 'Offline — still working' : cached ? 'Works offline' : 'Runs on this device'
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-sheet px-3 py-1 text-[12px] font-medium text-ink-2" title="Veil runs entirely in your browser. After the first visit it also works without internet.">
      <span className={`size-1.5 rounded-full ${!online ? 'bg-stamp' : 'bg-safe'}`} />
      {text}
    </span>
  )
}
