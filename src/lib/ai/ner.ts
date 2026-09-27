import type { Finding } from '../detect/types'
import type { NerSpan } from './ner.worker'

type Listener = (s: AiState) => void

export interface AiState {
  status: 'off' | 'loading' | 'ready' | 'error'
  loaded: number
  total: number
  error?: string
}

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, { resolve: (v: NerSpan[]) => void; reject: (e: Error) => void }>()
const files = new Map<string, { loaded: number; total: number }>()
let state: AiState = { status: 'off', loaded: 0, total: 0 }
const listeners = new Set<Listener>()

const set = (s: Partial<AiState>) => {
  state = { ...state, ...s }
  listeners.forEach((l) => l(state))
}

export const aiState = () => state
export function onAiState(l: Listener) {
  listeners.add(l)
  return () => void listeners.delete(l)
}

function ensureWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./ner.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e) => {
    const m = e.data
    if (m.kind === 'progress') {
      files.set(m.file, { loaded: m.loaded, total: m.total })
      let loaded = 0
      let total = 0
      files.forEach((f) => ((loaded += f.loaded), (total += f.total)))
      set({ loaded, total })
    } else if (m.kind === 'ready') {
      set({ status: 'ready' })
      pending.get(m.id)?.resolve([])
      pending.delete(m.id)
    } else if (m.kind === 'result') {
      set({ status: 'ready' })
      pending.get(m.id)?.resolve(m.spans)
      pending.delete(m.id)
    } else if (m.kind === 'error') {
      set({ status: 'error', error: m.message })
      pending.get(m.id)?.reject(new Error(m.message))
      pending.delete(m.id)
    }
  }
  return worker
}

function call(msg: { kind: 'load' } | { kind: 'run'; text: string }): Promise<NerSpan[]> {
  const id = ++seq
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ensureWorker().postMessage({ id, ...msg })
  })
}

export async function enableAi() {
  if (state.status === 'ready' || state.status === 'loading') return
  set({ status: 'loading', error: undefined })
  await call({ kind: 'load' })
}

/** Stops using AI findings. The model stays cached, so turning it back on is instant. */
export function disableAi() {
  set({ status: 'off' })
}

const LABEL_MAP = { PER: 'PERSON', LOC: 'PLACE', ORG: 'ORG' } as const

/** Names (and places / organisations) the rules can't know about, as extra findings. */
export async function aiFindings(text: string): Promise<Finding[]> {
  if (state.status !== 'ready' || !text.trim()) return []
  const spans = await call({ kind: 'run', text })
  return spans
    .filter((s) => s.label in LABEL_MAP)
    .map((s) => {
      const type = LABEL_MAP[s.label as keyof typeof LABEL_MAP]
      return {
        id: `AI:${s.start}:${s.end}`,
        type,
        start: s.start,
        end: s.end,
        value: text.slice(s.start, s.end),
        confidence: s.score > 0.9 ? ('high' as const) : ('medium' as const),
        reason: `AI model: ${s.label === 'PER' ? 'person' : s.label === 'LOC' ? 'place' : 'organisation'} (${Math.round(s.score * 100)}%)`,
        source: 'ai' as const,
      }
    })
}
