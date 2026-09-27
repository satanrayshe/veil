// The share ledger: a private, on-device record of every watermarked copy.
// If a copy of your document turns up somewhere it shouldn't, the reference
// printed on it tells you exactly who you gave it to.

export interface LedgerEntry {
  code: string
  recipient: string
  purpose: string
  createdAt: number
  fileName: string
  pages: number
  redactions: number
  types: string[]
  thumb: string
}

const KEY = 'veil.ledger.v1'
// No 0/O, 1/I/L, 2/Z, 5/S, 8/B — survives phone cameras, photocopies and OCR.
const ALPHABET = 'ACDEFHJKMNPRTUVWXY34679'

export function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return 'VEIL-' + [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')
}

export function loadLedger(): LedgerEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

function save(entries: LedgerEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    // storage full or blocked — the export itself still works
  }
}

export function addToLedger(e: LedgerEntry) {
  const all = loadLedger().filter((x) => x.code !== e.code)
  save([e, ...all])
}

export function removeFromLedger(code: string) {
  save(loadLedger().filter((x) => x.code !== code))
}

export function clearLedger() {
  save([])
}

/** Pulls a Veil reference out of OCR'd or typed text, tolerating OCR noise. */
export function extractCode(text: string): string | null {
  const m = /V\s*E\s*[I1l|]\s*L\s*[-–—:#\s]?\s*([A-Z0-9]{6})/i.exec(text)
  if (!m) return null
  const fix: Record<string, string> = { '0': 'D', O: 'D', Q: 'D', '1': 'T', I: 'T', L: 'T', G: '6', B: '6', S: '9', Z: '7' }
  const raw = m[1].toUpperCase()
  const cleaned = [...raw].map((c) => (ALPHABET.includes(c) ? c : fix[c] ?? c)).join('')
  return 'VEIL-' + cleaned
}

/** Exact match first, then allow one misread character (photographed or re-scanned copies). */
export function findEntry(code: string): { entry: LedgerEntry; exact: boolean } | undefined {
  const c = code.toUpperCase().replace(/\s/g, '').replace(/^VEIL-?/, 'VEIL-')
  const all = loadLedger()
  const exact = all.find((e) => e.code === c)
  if (exact) return { entry: exact, exact: true }
  const near = all.filter((e) => e.code.length === c.length && [...e.code].filter((ch, i) => ch !== c[i]).length === 1)
  return near.length === 1 ? { entry: near[0], exact: false } : undefined
}
