/// <reference lib="webworker" />
// Runs a small named-entity model (DistilBERT, ~66 MB, quantised) entirely in
// this worker. Weights are fetched once from the Hugging Face CDN and cached by
// the browser; the text being analysed never leaves the device.
import { pipeline, env, type TokenClassificationPipeline } from '@huggingface/transformers'

export const MODEL_ID = 'onnx-community/distilbert-NER-ONNX'

env.allowLocalModels = false

let ner: Promise<TokenClassificationPipeline> | null = null

type In = { id: number; kind: 'load' } | { id: number; kind: 'run'; text: string }

export interface NerSpan {
  start: number
  end: number
  label: 'PER' | 'LOC' | 'ORG' | 'MISC'
  score: number
}

function load(id: number) {
  ner ??= pipeline('token-classification', MODEL_ID, {
    dtype: 'q8',
    progress_callback: (p: { status: string; loaded?: number; total?: number; file?: string }) => {
      if (p.status === 'progress' && p.total) postMessage({ id, kind: 'progress', loaded: p.loaded, total: p.total, file: p.file })
    },
  }) as Promise<TokenClassificationPipeline>
  return ner
}

// Title-case ALL-CAPS words (same length, so offsets survive) — form scans
// shout names in capitals, which cased NER models handle badly.
const soften = (t: string) => t.replace(/\b[A-Z]{3,}\b/g, (w) => w[0] + w.slice(1).toLowerCase())

function chunks(text: string, max = 900): { off: number; s: string }[] {
  const out: { off: number; s: string }[] = []
  let off = 0
  while (off < text.length) {
    let end = Math.min(text.length, off + max)
    if (end < text.length) {
      const cut = Math.max(text.lastIndexOf('\n', end), text.lastIndexOf('. ', end))
      if (cut > off + max / 3) end = cut + 1
    }
    out.push({ off, s: text.slice(off, end) })
    off = end
  }
  return out
}

async function run(text: string): Promise<NerSpan[]> {
  const model = await ner!
  const spans: NerSpan[] = []
  for (const { off, s } of chunks(soften(text))) {
    const toks = (await model(s)) as unknown as { entity: string; score: number; word: string }[]
    // The pipeline returns word-pieces without offsets: re-align them to the text.
    let cursor = 0
    let cur: NerSpan | null = null
    for (const t of toks) {
      const piece = t.word.replace(/^##/, '')
      const at = s.indexOf(piece, cursor)
      if (at < 0) continue
      const isCont = t.word.startsWith('##') || at === cursor
      cursor = at + piece.length
      const label = t.entity.replace(/^[BI]-/, '') as NerSpan['label']
      const begins = t.entity.startsWith('B-') && !t.word.startsWith('##')
      const gapOk = cur && /^[\s.'-]*$/.test(s.slice(cur.end - off, at))
      if (cur && cur.label === label && (isCont || (!begins && gapOk))) {
        cur.end = off + cursor
        cur.score = Math.min(cur.score, t.score)
      } else {
        if (cur) spans.push(cur)
        cur = { start: off + at, end: off + cursor, label, score: t.score }
      }
    }
    if (cur) spans.push(cur)
  }
  return spans.filter((sp) => sp.score > 0.6 && sp.end - sp.start > 1)
}

self.onmessage = async (e: MessageEvent<In>) => {
  const msg = e.data
  try {
    if (msg.kind === 'load') {
      await load(msg.id)
      postMessage({ id: msg.id, kind: 'ready' })
    } else {
      if (!ner) await load(msg.id)
      postMessage({ id: msg.id, kind: 'result', spans: await run(msg.text) })
    }
  } catch (err) {
    postMessage({ id: msg.id, kind: 'error', message: String((err as Error)?.message ?? err) })
  }
}
