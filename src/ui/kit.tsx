import { useEffect, useState, type ReactNode, type SVGProps } from 'react'
import { ENTITY, type EntityType, type Group } from '../lib/detect/types'

// ---------------------------------------------------------------- colour roles

export const GROUP_COLOR: Record<Group, { bg: string; edge: string; ink: string }> = {
  identity: { bg: 'rgb(232 176 42 / 0.30)', edge: '#c8901a', ink: '#7a5306' },
  financial: { bg: 'rgb(74 124 222 / 0.22)', edge: '#3f6fd0', ink: '#23468f' },
  contact: { bg: 'rgb(145 96 214 / 0.22)', edge: '#8456c9', ink: '#5a3395' },
  personal: { bg: 'rgb(46 150 136 / 0.22)', edge: '#2a8a7c', ink: '#1b5c52' },
  secret: { bg: 'rgb(214 70 44 / 0.24)', edge: '#c2402a', ink: '#8e2413' },
  custom: { bg: 'rgb(110 105 93 / 0.22)', edge: '#6f695d', ink: '#3b3830' },
}

export const typeColor = (t: EntityType | 'MANUAL') => GROUP_COLOR[t === 'MANUAL' ? 'custom' : ENTITY[t].group]

// ---------------------------------------------------------------- icons

type IconProps = SVGProps<SVGSVGElement> & { size?: number }
const Svg = ({ size = 16, children, ...p }: IconProps & { children: ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
    {children}
  </svg>
)
export const I = {
  upload: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 15V4m0 0 4 4m-4-4-4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
    </Svg>
  ),
  copy: (p: IconProps) => (
    <Svg {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h8" />
    </Svg>
  ),
  check: (p: IconProps) => (
    <Svg {...p}>
      <path d="m5 12.5 4.2 4.2L19 7" />
    </Svg>
  ),
  arrow: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </Svg>
  ),
  external: (p: IconProps) => (
    <Svg {...p}>
      <path d="M14 5h5v5m0-5-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </Svg>
  ),
  trash: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </Svg>
  ),
  refresh: (p: IconProps) => (
    <Svg {...p}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />
    </Svg>
  ),
  download: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />
    </Svg>
  ),
  share: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.4m-7.6 6.8 7.6 4.4" />
    </Svg>
  ),
  eye: (p: IconProps) => (
    <Svg {...p}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </Svg>
  ),
  chip: (p: IconProps) => (
    <Svg {...p}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4" />
    </Svg>
  ),
  pin: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </Svg>
  ),
  x: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  ),
  search: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </Svg>
  ),
  alert: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" />
      <path d="M12 10v4.2m0 2.6v.2" />
    </Svg>
  ),
}

// ---------------------------------------------------------------- bits

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span aria-hidden className="inline-block h-[0.62em] w-[1.15em] rounded-[2px] bg-bar" />
      <span className="font-serif text-[1.55em] leading-none tracking-[-0.01em]">Veil</span>
    </span>
  )
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)} />
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[9px] border border-line-2 bg-sheet p-[3px]">
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`h-8 rounded-[6px] px-3 text-[13px] font-medium transition-colors ${value === o.id ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function useCopy(): [boolean, (text: string) => Promise<void>] {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(false), 1600)
    return () => clearTimeout(t)
  }, [done])
  return [
    done,
    async (text) => {
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      }
      setDone(true)
    },
  ]
}

export function useLocalState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  return [
    v,
    (next: T) => {
      setV(next)
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        /* storage blocked: keep in memory */
      }
    },
  ]
}

export function TypeTag({ type }: { type: EntityType | 'MANUAL' }) {
  const c = typeColor(type)
  return (
    <span className="inline-flex h-[20px] items-center gap-1.5 rounded-[5px] px-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.04em]" style={{ background: c.bg, color: c.ink }}>
      {type === 'MANUAL' ? 'Manual' : ENTITY[type].label}
    </span>
  )
}
