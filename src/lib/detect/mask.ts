import { ENTITY, type EntityType, type Finding } from './types'
import { digitsOnly, verhoeffCheckDigit } from './validators'

export type MaskMode = 'token' | 'synthetic' | 'partial' | 'redact'

export const MASK_MODES: { id: MaskMode; label: string; hint: string; reversible: boolean }[] = [
  { id: 'token', label: 'Placeholders', hint: '[PERSON_1], [AADHAAR_1]… Best for chatbots. Reversible.', reversible: true },
  { id: 'synthetic', label: 'Look-alikes', hint: 'Realistic fake values with valid formats. Reversible.', reversible: true },
  { id: 'partial', label: 'Partial', hint: 'XXXX XXXX 1234 — the UIDAI masked style. One-way.', reversible: false },
  { id: 'redact', label: 'Blackout', hint: '████ — nothing left to recover. One-way.', reversible: false },
]

export interface VaultEntry {
  type: EntityType
  original: string
  replacement: string
}

/**
 * Remembers what each original value was replaced with, so the same value
 * always gets the same placeholder and replies can be restored. Lives only in
 * memory (and optionally sessionStorage) — never leaves the device.
 */
export class Vault {
  entries: VaultEntry[] = []
  private counters = new Map<EntityType, number>()

  static from(entries: VaultEntry[]) {
    const v = new Vault()
    for (const e of entries) {
      v.entries.push(e)
      const n = /_(\d+)\]$/.exec(e.replacement)
      if (n) v.counters.set(e.type, Math.max(v.counters.get(e.type) ?? 0, +n[1]))
    }
    return v
  }

  private norm(type: EntityType, value: string) {
    const v = value.trim().toLowerCase()
    return ['AADHAAR', 'AADHAAR_VID', 'CARD', 'PHONE', 'BANK_ACCOUNT'].includes(type) ? digitsOnly(v).slice(-10) : v.replace(/\s+/g, ' ')
  }

  lookup(type: EntityType, value: string, mode: MaskMode): VaultEntry | undefined {
    const k = this.norm(type, value)
    const pool = this.entries.filter((e) => e.type === type && e.replacement.startsWith('[') === (mode === 'token'))
    const exact = pool.find((e) => this.norm(type, e.original) === k)
    if (exact) return exact
    // "Rohan" should reuse the placeholder of "Rohan Mehta"
    if (type === 'PERSON') return pool.find((e) => this.norm(type, e.original).split(/[\s.]+/).includes(k))
  }

  get(type: EntityType, value: string, mode: MaskMode): string {
    const hit = this.lookup(type, value, mode)
    if (hit && mode === 'synthetic' && type === 'PERSON' && this.norm(type, hit.original) !== this.norm(type, value)) {
      // "Rohan" alone → matching part of the look-alike, stored so it restores to "Rohan" (not the full name)
      const idx = hit.original.trim().split(/\s+/).findIndex((w) => w.toLowerCase() === value.trim().toLowerCase())
      const part = hit.replacement.split(/\s+/)[idx] ?? hit.replacement
      this.entries.push({ type, original: value, replacement: part })
      return part
    }
    if (hit) return hit.replacement
    const n = (this.counters.get(type) ?? 0) + 1
    this.counters.set(type, n)
    const replacement = mode === 'token' ? `[${ENTITY[type].token}_${n}]` : synthesize(type, value, n)
    this.entries.push({ type, original: value, replacement })
    return replacement
  }

  clear() {
    this.entries = []
    this.counters.clear()
  }
}

export interface MaskedSpan {
  start: number
  end: number
  findingId: string
  type: EntityType
}

export interface MaskResult {
  text: string
  spans: MaskedSpan[]
}

export function maskText(text: string, findings: Finding[], mode: MaskMode, vault: Vault): MaskResult {
  const sorted = [...findings].sort((a, b) => a.start - b.start)
  let out = ''
  let cursor = 0
  const spans: MaskedSpan[] = []
  for (const f of sorted) {
    if (f.start < cursor) continue
    out += text.slice(cursor, f.start)
    const rep =
      mode === 'token' || mode === 'synthetic'
        ? vault.get(f.type, f.value, mode)
        : mode === 'partial'
          ? partialMask(f.type, f.value)
          : f.value.replace(/[^\s]/g, '█')
    spans.push({ start: out.length, end: out.length + rep.length, findingId: f.id, type: f.type })
    out += rep
    cursor = f.end
  }
  out += text.slice(cursor)
  return { text: out, spans }
}

export interface RestoredSpan {
  start: number
  end: number
  type: EntityType
}

/** Puts original values back into text returned by a chatbot. */
export function unmaskText(text: string, vault: Vault): { text: string; spans: RestoredSpan[]; restored: number; unknown: string[] } {
  const tokenMap = new Map<string, VaultEntry>()
  const literal: VaultEntry[] = []
  for (const e of vault.entries) {
    const t = /^\[([A-Z_]+?)_(\d+)\]$/.exec(e.replacement)
    if (t) tokenMap.set(`${t[1]}_${t[2]}`, e)
    else literal.push(e)
  }
  const parts: string[] = []
  // Tolerate what chatbots do to placeholders: [PERSON_1], PERSON_1, [Person 1], {PERSON-1}, **[PERSON_1]**
  const tokenNames = [...new Set([...tokenMap.keys()].map((k) => k.replace(/_\d+$/, '')))].sort((a, b) => b.length - a.length)
  if (tokenNames.length)
    // Whitespace is only absorbed inside brackets, never around a bare PERSON_1.
    parts.push(`(?:[\\[{<(]\\s*)?(?<![A-Za-z])(?:${tokenNames.map((n) => n.replace(/_/g, '[_\\s-]?')).join('|')})[_\\s-]?\\d+(?!\\d)(?:\\s*[\\]}>)])?`)
  const lits = literal.filter((e) => e.replacement.length >= 3).sort((a, b) => b.replacement.length - a.replacement.length)
  for (const e of lits) parts.push(e.replacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

  const unknown = new Set<string>()
  if (!parts.length) return { text, spans: [], restored: 0, unknown: [] }
  const re = new RegExp(parts.join('|'), 'gi')
  let out = ''
  let cursor = 0
  let restored = 0
  const spans: RestoredSpan[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    let entry: VaultEntry | undefined
    const tok = /([A-Z][A-Z_\s-]*?)[_\s-]?(\d+)/i.exec(m[0])
    if (tok && /^[[{<(]?\s*[A-Z]/i.test(m[0]) && !literal.some((e) => e.replacement.toLowerCase() === m![0].toLowerCase())) {
      const key = `${tok[1].toUpperCase().replace(/[\s-]/g, '_').replace(/_+$/, '')}_${tok[2]}`
      entry = tokenMap.get(key)
      if (!entry) unknown.add(m[0])
    } else {
      entry = literal.find((e) => e.replacement.toLowerCase() === m![0].toLowerCase())
    }
    if (!entry) continue
    out += text.slice(cursor, m.index)
    spans.push({ start: out.length, end: out.length + entry.original.length, type: entry.type })
    out += entry.original
    cursor = m.index + m[0].length
    restored++
  }
  out += text.slice(cursor)
  return { text: out, spans, restored, unknown: [...unknown] }
}

// ---------------------------------------------------------------- partial

export function partialMask(type: EntityType, v: string): string {
  const keepLast = (s: string, n: number, ch = 'X') => {
    let seen = 0
    const total = s.replace(/[^A-Za-z0-9]/g, '').length
    return s.replace(/[A-Za-z0-9]/g, (c) => (++seen > total - n ? c : ch))
  }
  switch (type) {
    case 'AADHAAR':
    case 'AADHAAR_VID':
    case 'CARD':
    case 'BANK_ACCOUNT':
      return keepLast(v, 4)
    case 'PHONE':
      return keepLast(v, 2, '•')
    case 'PAN':
    case 'PASSPORT':
    case 'VOTER_ID':
    case 'DRIVING_LICENSE':
    case 'GSTIN':
      return keepLast(v, 3)
    case 'EMAIL': {
      const [u, d] = v.split('@')
      return `${u[0]}${'•'.repeat(Math.max(2, u.length - 2))}${u.length > 1 ? u[u.length - 1] : ''}@${d}`
    }
    case 'UPI': {
      const [u, d] = v.split('@')
      return `${u.slice(0, 2)}${'•'.repeat(Math.max(2, u.length - 2))}@${d}`
    }
    case 'PERSON':
      return v
        .split(/\s+/)
        .map((w) => `${w[0]}.`)
        .join(' ')
    case 'SECRET':
      return v.length > 10 ? `${v.slice(0, 4)}…${v.slice(-4)}` : '••••••'
    case 'DOB':
      return v.replace(/\d/g, (c, i) => (i >= v.length - 4 ? c : '•'))
    case 'ADDRESS':
      return '[address hidden]'
    case 'QR_CODE':
      return v
    default:
      return keepLast(v, 2, '•')
  }
}

// ---------------------------------------------------------------- synthetic

const FAKE_FIRST = ['Aarav', 'Meera', 'Kabir', 'Isha', 'Vihaan', 'Tara', 'Arjun', 'Naina', 'Rehan', 'Diya', 'Kunal', 'Anika']
const FAKE_LAST = ['Kapoor', 'Iyer', 'Menon', 'Bhatia', 'Saxena', 'Rao', 'Dutta', 'Malhotra', 'Pillai', 'Chawla']
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function seeded(seed: number) {
  let s = seed * 2654435761 % 2 ** 32
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32
    return s / 2 ** 32
  }
}

/** Keeps separators/case shape of the original, swaps the characters. */
function shapeLike(original: string, rnd: () => number) {
  return original.replace(/[A-Z]/g, () => LETTERS[Math.floor(rnd() * 26)]).replace(/[a-z]/g, () => LETTERS[Math.floor(rnd() * 26)].toLowerCase()).replace(/\d/g, () => String(Math.floor(rnd() * 10)))
}

export function synthesize(type: EntityType, original: string, n: number): string {
  const rnd = seeded(n * 97 + type.length * 13 + original.length)
  switch (type) {
    case 'PERSON': {
      const words = original.trim().split(/\s+/)
      const first = FAKE_FIRST[(n - 1) % FAKE_FIRST.length]
      const out = words.length > 1 ? `${first} ${FAKE_LAST[(n * 3) % FAKE_LAST.length]}` : first
      return original === original.toUpperCase() ? out.toUpperCase() : out
    }
    case 'AADHAAR': {
      let body = String(2 + Math.floor(rnd() * 8))
      while (body.length < 11) body += Math.floor(rnd() * 10)
      const full = body + verhoeffCheckDigit(body)
      const sep = /\d(\D)\d/.exec(original)?.[1]
      return sep ? `${full.slice(0, 4)}${sep}${full.slice(4, 8)}${sep}${full.slice(8)}` : full
    }
    case 'EMAIL':
      return `${FAKE_FIRST[(n - 1) % FAKE_FIRST.length].toLowerCase()}.${n}@example.com`
    case 'UPI':
      return `${FAKE_FIRST[(n - 1) % FAKE_FIRST.length].toLowerCase()}${n}@upi`
    case 'PHONE': {
      // keep the country code and separators, swap the last 10 digits for a fake 9xxxxxxxxx
      const fresh = '9' + Array.from({ length: 9 }, () => Math.floor(rnd() * 10)).join('')
      const total = digitsOnly(original).length
      let seen = 0
      return original.replace(/\d/g, (c) => {
        const i = seen++ - (total - 10)
        return i < 0 ? c : fresh[i]
      })
    }
    case 'SECRET':
      return `${original.slice(0, Math.min(4, original.length - 4))}${shapeLike(original.slice(Math.min(4, original.length - 4)), rnd)}`
    case 'ADDRESS':
      return `${10 + n} Sample Street, Anytown ${560000 + n}`
    default:
      return shapeLike(original, rnd)
  }
}
