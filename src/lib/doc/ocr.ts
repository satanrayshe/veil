import { createWorker, type Worker } from 'tesseract.js'
import type { DocWord } from './types'

type Progress = (p: { status: string; progress: number }) => void

let workerP: Promise<Worker> | null = null
let listener: Progress | null = null

// Everything is served from our own origin (copied from node_modules at build time)
// so OCR works offline and the image never touches a third-party server.
const asset = (p: string) => new URL(`${import.meta.env.BASE_URL}tesseract/${p}`, document.baseURI).href

function getWorker() {
  workerP ??= createWorker('eng', 1, {
    workerPath: asset('worker.min.js'),
    corePath: asset(''),
    langPath: asset(''),
    gzip: true,
    logger: (m) => listener?.({ status: m.status, progress: m.progress ?? 0 }),
  }).catch((e) => {
    workerP = null
    throw e
  })
  return workerP
}

/** Warm the OCR engine in the background so the first document feels instant. */
export function preloadOcr() {
  getWorker().catch(() => {})
}

export async function ocrCanvas(canvas: HTMLCanvasElement, onProgress?: Progress): Promise<DocWord[]> {
  listener = onProgress ?? null
  const worker = await getWorker()
  const { data } = await worker.recognize(canvas, {}, { blocks: true, text: false })
  listener = null
  const words: DocWord[] = []
  let line = 0
  for (const block of data.blocks ?? [])
    for (const para of block.paragraphs)
      for (const l of para.lines) {
        for (const w of l.words) {
          const text = w.text.trim()
          if (!text || w.confidence < 20) continue
          const chars = w.symbols.length === text.length ? w.symbols.map((s) => ({ ...s.bbox })) : undefined
          words.push({ text, line, ...w.bbox, chars })
        }
        line++
      }
  return words
}

/** OCR just a strip of the image (used to read a Veil reference off a leaked copy). */
export async function ocrText(canvas: HTMLCanvasElement, rect?: { left: number; top: number; width: number; height: number }) {
  const worker = await getWorker()
  const { data } = await worker.recognize(canvas, rect ? { rectangle: rect } : {}, { text: true })
  return data.text
}
