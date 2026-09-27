import { useEffect, useState } from 'react'
import { aiState, disableAi, enableAi, onAiState, type AiState } from '../lib/ai/ner'
import { insights } from '../lib/detect/engine'
import { partialMask } from '../lib/detect/mask'
import { ENTITY, GROUP_LABEL, type Finding, type Group } from '../lib/detect/types'
import { GROUP_COLOR, I, Switch, TypeTag } from './kit'

const GROUP_ORDER: Group[] = ['identity', 'financial', 'secret', 'contact', 'personal', 'custom']

export interface Row {
  key: string
  finding: Finding
  on: boolean
  page?: number
  count?: number
}

export function FindingList({
  rows,
  onToggle,
  hover,
  setHover,
  empty,
}: {
  rows: Row[]
  onToggle: (row: Row, on: boolean) => void
  hover?: string | null
  setHover?: (key: string | null) => void
  empty: React.ReactNode
}) {
  if (!rows.length) return <div className="px-1 py-6 text-center text-[13.5px] text-mute">{empty}</div>
  const groups = GROUP_ORDER.map((g) => [g, rows.filter((r) => ENTITY[r.finding.type].group === g)] as const).filter(([, r]) => r.length)
  return (
    <div className="space-y-4">
      {groups.map(([g, rs]) => (
        <section key={g}>
          <h4 className="label mb-1.5 flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: GROUP_COLOR[g].edge }} />
            {GROUP_LABEL[g]} <span className="text-faint">· {rs.length}</span>
          </h4>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
            {rs.map((r) => (
              <li
                key={r.key}
                onMouseEnter={() => setHover?.(r.key)}
                onMouseLeave={() => setHover?.(null)}
                className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${hover === r.key ? 'bg-paper' : ''} ${r.on ? '' : 'opacity-55'}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <TypeTag type={r.finding.type} />
                    {r.finding.detail && <span className="text-[11.5px] text-mute">{r.finding.detail}</span>}
                    {r.finding.confidence === 'medium' && <span className="text-[11px] font-medium text-stamp">possible</span>}
                    {!!r.count && r.count > 1 && <span className="font-mono text-[10.5px] text-mute">×{r.count}</span>}
                    {r.page !== undefined && <span className="ml-auto font-mono text-[10.5px] text-faint">p.{r.page + 1}</span>}
                  </div>
                  <p className={`mt-1 truncate font-mono text-[12.5px] ${r.on ? 'text-ink' : 'text-mute line-through'}`} title={r.finding.value}>
                    {r.on ? partialMask(r.finding.type, r.finding.value) : r.finding.value}
                  </p>
                  <p className="mt-0.5 truncate text-[11.5px] text-mute" title={r.finding.reason}>
                    {r.finding.reason}
                  </p>
                </div>
                <Switch on={r.on} onChange={(v) => onToggle(r, v)} label={`${r.on ? 'Stop masking' : 'Mask'} ${ENTITY[r.finding.type].label}`} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function Insights({ findings }: { findings: Finding[] }) {
  const list = insights(findings)
  if (!list.length) return null
  return (
    <div className="space-y-2">
      {list.map((i) => (
        <div key={i.title} className={`flex gap-3 rounded-lg border px-3.5 py-3 ${i.level === 'critical' ? 'border-stamp/30 bg-stamp-soft' : 'border-line-2 bg-paper'}`}>
          <I.alert size={17} className={`mt-0.5 flex-none ${i.level === 'critical' ? 'text-stamp' : 'text-ink-2'}`} />
          <div>
            <p className="text-[13.5px] font-semibold text-ink">{i.title}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{i.body}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function useAiState() {
  const [s, setS] = useState<AiState>(aiState)
  useEffect(() => onAiState(setS), [])
  return s
}

export function AiToggle() {
  const s = useAiState()
  const mb = (n: number) => Math.round(n / 1e6)
  const on = s.status === 'ready' || s.status === 'loading'
  return (
    <div className="flex items-start gap-3">
      <I.chip size={18} className="mt-0.5 flex-none text-ink-2" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold">On-device AI for names & places</p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-mute">
          {s.status === 'off' && 'Catches names the rules don’t know. Downloads a 66 MB model once; your text stays here.'}
          {s.status === 'loading' && (s.total ? `Downloading model… ${mb(s.loaded)} of ${mb(s.total)} MB` : 'Starting…')}
          {s.status === 'ready' && 'Active. Runs in a background worker on this device.'}
          {s.status === 'error' && `Couldn't load the model: ${s.error}`}
        </p>
        {s.status === 'loading' && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-ink transition-[width]" style={{ width: `${s.total ? (s.loaded / s.total) * 100 : 4}%` }} />
          </div>
        )}
      </div>
      <Switch on={on} onChange={(v) => (v ? enableAi().catch(() => {}) : disableAi())} label="Enable on-device AI" />
    </div>
  )
}
