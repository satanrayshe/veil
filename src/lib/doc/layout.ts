import { ENTITY, type Finding } from '../detect/types'
import type { Box, DocPage, DocWord, Redaction } from './types'

/** Joins words into page text (space between words, newline between lines) and records offsets. */
export function buildText(words: DocWord[]): { text: string; spans: { start: number; end: number }[] } {
  let text = ''
  const spans: { start: number; end: number }[] = []
  let prevLine = -1
  for (const w of words) {
    if (prevLine !== -1) text += w.line !== prevLine ? '\n' : ' '
    prevLine = w.line
    spans.push({ start: text.length, end: text.length + w.text.length })
    text += w.text
  }
  return { text, spans }
}

const KEEP_LAST4 = new Set(['AADHAAR', 'AADHAAR_VID', 'CARD', 'BANK_ACCOUNT'])

/** Offset where the last four digits of the finding begin (so they stay visible). */
function lastFourCut(text: string, f: Finding): number {
  let digits = 0
  for (let i = f.end - 1; i >= f.start; i--) {
    if (/\d/.test(text[i]) && ++digits === 4) {
      let cut = i
      while (cut > f.start && /\s|-/.test(text[cut - 1])) cut--
      return cut
    }
  }
  return f.end
}

function union(a: Box | null, b: Box): Box {
  return a ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : { ...b }
}

export function findingsToRedactions(page: DocPage, findings: Finding[], keepLast4: boolean): Redaction[] {
  const out: Redaction[] = []
  for (const f of findings) {
    const end = keepLast4 && KEEP_LAST4.has(f.type) && f.value.replace(/\D/g, '').length >= 8 ? lastFourCut(page.text, f) : f.end
    const start = f.start
    const byLine = new Map<number, Box>()
    page.words.forEach((w, i) => {
      const s = page.spans[i]
      if (s.end <= start || s.start >= end) return
      let box: Box = w
      if (w.chars && (s.start < start || s.end > end)) {
        const a = Math.max(0, start - s.start)
        const b = Math.min(w.chars.length, end - s.start) - 1
        if (b >= a) box = { x0: w.chars[a].x0, x1: w.chars[b].x1, y0: w.y0, y1: w.y1 }
      }
      byLine.set(w.line, union(byLine.get(w.line) ?? null, box))
    })
    let k = 0
    for (const box of byLine.values()) {
      const pad = Math.max(2, (box.y1 - box.y0) * 0.14)
      out.push({
        id: `${f.id}#${k++}`,
        page: page.index,
        box: { x0: box.x0 - pad, y0: box.y0 - pad, x1: box.x1 + pad, y1: box.y1 + pad },
        type: f.type,
        findingId: f.id,
        label: ENTITY[f.type].token,
        on: true,
      })
    }
  }
  return out
}

/** Word under a point, for click-to-redact on anything detection missed. */
export function wordAt(page: DocPage, x: number, y: number): number {
  return page.words.findIndex((w) => x >= w.x0 - 2 && x <= w.x1 + 2 && y >= w.y0 - 2 && y <= w.y1 + 2)
}
