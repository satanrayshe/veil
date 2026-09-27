import { RULES } from './rules'
import { isFirstName, isLastName, NOT_NAMES } from './names'
import { ENTITY, type DetectOptions, type Finding } from './types'

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const findingKey = (f: Pick<Finding, 'type' | 'value'>) => `${f.type}:${f.value.trim().toLowerCase()}`

function mk(f: Omit<Finding, 'id'>): Finding {
  return { ...f, id: `${f.type}:${f.start}:${f.end}` }
}

// ---------------------------------------------------------------- names

// Cues after which a capitalised run is taken as a name.
const STRONG_CUE =
  /\b(?:my name is|my name's|(?:full |applicant |candidate |father'?s |mother'?s |spouse |guardian |customer |account holder |holder'?s |employee |student |patient |tenant |owner'?s |owner )?name\s*[:\-–]|mr\.?|mrs\.?|ms\.?|dr\.?|prof\.?|shri|smt\.?|sri|kumari|s\/o|d\/o|w\/o|c\/o|son of|daughter of|wife of|husband of|regards,?|sincerely,?|yours truly,?|signed\s*:?|attn\.?\s*:?)[ \t]*\n?[ \t]*/gi
// Softer cues: still accepted without a dictionary hit, but at medium confidence.
const WEAK_CUE = /\b(?:i am|i'm|this is|named|called|dear|hi|hello|hey)[ \t]+/gi

const TOKEN = /([A-Z][a-zA-Z'’-]+|[A-Z]\.)(?=[\s,.;:)!?]|$)([ \t]*)/y

function takeNameTokens(text: string, from: number, max: number) {
  const toks: { s: number; e: number; w: string }[] = []
  TOKEN.lastIndex = from
  let m: RegExpExecArray | null
  while (toks.length < max && (m = TOKEN.exec(text))) {
    const w = m[1]
    if (NOT_NAMES.has(w.toLowerCase().replace(/\.$/, ''))) break
    toks.push({ s: m.index, e: m.index + w.length, w })
    if (!m[2]) break // punctuation, newline or end of text follows
  }
  while (toks.length && /^[A-Z]\.$/.test(toks[toks.length - 1].w)) toks.pop()
  if (!toks.length) return null
  return { start: toks[0].s, end: toks[toks.length - 1].e }
}

function detectNames(text: string): Finding[] {
  const out: Finding[] = []
  const push = (start: number, end: number, confidence: 'high' | 'medium', reason: string, source: Finding['source']) =>
    out.push(mk({ type: 'PERSON', start, end, value: text.slice(start, end), confidence, reason, source }))

  for (const [re, strong] of [[STRONG_CUE, true], [WEAK_CUE, false]] as const) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      const span = takeNameTokens(text, m.index + m[0].length, strong ? 4 : 3)
      if (span) push(span.start, span.end, strong ? 'high' : 'medium', `Follows "${m[0].trim()}"`, 'context')
    }
  }

  // Dictionary pass over capitalised runs (Title Case and ALL CAPS forms).
  const RUN = /\b(?:[A-Z][a-z]+|[A-Z]{2,})(?:[ \t]+(?:[A-Z][a-z]+|[A-Z]{2,})){0,3}\b/g
  let m: RegExpExecArray | null
  while ((m = RUN.exec(text))) {
    const base = m.index
    const words = [...m[0].matchAll(/\S+/g)].map((w) => ({ w: w[0], s: base + w.index! }))
    const firstIdx = words.findIndex((x) => isFirstName(x.w))
    if (firstIdx < 0) continue
    let i = firstIdx
    let j = firstIdx
    // one unknown surname may follow a first name; beyond that only known surnames
    while (j + 1 < words.length) {
      const next = words[j + 1].w
      if (NOT_NAMES.has(next.toLowerCase())) break
      if (isLastName(next) || isFirstName(next) || j === firstIdx) j++
      else break
    }
    while (i - 1 >= 0 && isLastName(words[i - 1].w)) i--
    const full = j > i
    push(words[i].s, words[j].s + words[j].w.length, full ? 'high' : 'medium', full ? 'Known first name + surname' : 'Known first name', 'dictionary')
  }
  return out
}

// ---------------------------------------------------------------- core

function resolve(cands: Finding[], accepted: Finding[] = []): Finding[] {
  const sorted = [...cands].sort(
    (a, b) =>
      (b.source === 'manual' ? 1000 : ENTITY[b.type].priority) - (a.source === 'manual' ? 1000 : ENTITY[a.type].priority) ||
      (a.confidence === b.confidence ? 0 : a.confidence === 'high' ? -1 : 1) ||
      b.end - b.start - (a.end - a.start),
  )
  const out = [...accepted]
  for (const c of sorted) {
    if (c.end <= c.start) continue
    if (out.some((a) => c.start < a.end && a.start < c.end)) continue
    out.push(c)
  }
  return out
}

export function detect(text: string, opts: DetectOptions = {}): Finding[] {
  const cands: Finding[] = []

  for (const rule of RULES) {
    rule.re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = rule.re.exec(text))) {
      if (m[0].length === 0) {
        rule.re.lastIndex++
        continue
      }
      const hit = rule.verify(m, text)
      if (!hit) continue
      const start = m.index + (hit.start ?? 0)
      const end = m.index + (hit.end ?? m[0].length)
      cands.push(
        mk({ type: rule.type, start, end, value: text.slice(start, end), confidence: hit.confidence, reason: hit.reason, detail: hit.detail, source: 'rule' }),
      )
    }
  }

  cands.push(...detectNames(text))

  for (const term of opts.watchlist ?? []) {
    const t = term.trim()
    if (t.length < 2) continue
    const re = new RegExp(`(?<![\\w])${escapeRe(t)}(?![\\w])`, 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(text)))
      cands.push(mk({ type: 'CUSTOM', start: m.index, end: m.index + m[0].length, value: m[0], confidence: 'high', reason: 'On your watchlist', source: 'custom' }))
  }

  for (const f of opts.extra ?? []) if (f.end <= text.length) cands.push({ ...f, value: text.slice(f.start, f.end) })

  const keep = (f: Finding) => !opts.disabled?.has(f.type) && !opts.allow?.has(findingKey(f))
  let accepted = resolve(cands.filter(keep))

  // Propagate names: once "Rohan Mehta" is known, "Rohan" and "Mehta" elsewhere are the same person.
  const persons = accepted.filter((f) => f.type === 'PERSON')
  if (persons.length && !opts.disabled?.has('PERSON')) {
    const extra: Finding[] = []
    const seen = new Set<string>()
    for (const p of persons) {
      const parts = [p.value, ...p.value.split(/[\s.]+/)].map((w) => w.trim()).filter((w) => w.length >= 3 && !NOT_NAMES.has(w.toLowerCase()))
      for (const w of parts) {
        const k = w.toLowerCase()
        if (seen.has(k)) continue
        seen.add(k)
        const re = new RegExp(`(?<![\\w@.])${escapeRe(w)}(?![\\w@])`, 'gi')
        let m: RegExpExecArray | null
        while ((m = re.exec(text))) {
          // skip lower-case mentions of common words; names are capitalised
          if (!/^[A-Z]/.test(m[0])) continue
          extra.push(mk({ type: 'PERSON', start: m.index, end: m.index + m[0].length, value: m[0], confidence: p.confidence, reason: `Same name as "${p.value}"`, source: p.source }))
        }
      }
    }
    accepted = resolve(extra.filter(keep), accepted)
  }

  return accepted.sort((a, b) => a.start - b.start)
}

// ---------------------------------------------------------------- insight

export interface Insight {
  level: 'critical' | 'warn'
  title: string
  body: string
}

/** Explains what an attacker could do with the *combination* of what was found. */
export function insights(findings: Finding[]): Insight[] {
  const has = (t: Finding['type'], detail?: string) => findings.some((f) => f.type === t && (!detail || f.detail === detail))
  const out: Insight[] = []
  if (has('SECRET'))
    out.push({ level: 'critical', title: 'Live credentials', body: 'Keys and passwords pasted into a chatbot can end up in logs and training data. If this was already shared, rotate the key now.' })
  if (has('OTP'))
    out.push({ level: 'critical', title: 'OTP in the text', body: 'No bank, courier or government office will ever ask for an OTP. Sharing one is how most UPI and "KYC update" frauds complete.' })
  if (has('CARD', 'CVV') || (has('CARD') && findings.filter((f) => f.type === 'CARD').length > 1))
    out.push({ level: 'critical', title: 'Card number with CVV', body: 'Together these are enough to make online payments on many sites.' })
  if (has('AADHAAR') && (has('PHONE') || has('DOB')))
    out.push({ level: 'critical', title: 'Aadhaar + phone/DOB', body: 'The classic kit for SIM-swap social engineering and fake eKYC. UIDAI recommends sharing a masked Aadhaar instead.' })
  if (has('PAN') && (has('DOB') || has('PERSON')))
    out.push({ level: 'critical', title: 'PAN + name/DOB', body: 'Enough to pull a credit report or apply for instant loans in your name on lax lending apps.' })
  if (has('BANK_ACCOUNT') && has('IFSC'))
    out.push({ level: 'warn', title: 'Account + IFSC', body: 'Anyone can now add you as a payee. With your phone number, this enables convincing "refund" vishing calls.' })
  if (has('ADDRESS') && has('PERSON'))
    out.push({ level: 'warn', title: 'Name + home address', body: 'This ties a real person to a physical location.' })
  return out
}
