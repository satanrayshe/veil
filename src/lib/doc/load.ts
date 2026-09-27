import * as pdfjs from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import exifr from 'exifr'
import type { DocWord, ExifSummary } from './types'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

const MAX_EDGE = 2200
const MAX_PAGES = 12

export interface LoadedPage {
  canvas: HTMLCanvasElement
  /** Words from the PDF text layer, when the page has real text. */
  textWords?: DocWord[]
  pointSize?: { w: number; h: number }
}

export interface LoadedDoc {
  kind: 'image' | 'pdf'
  name: string
  pages: LoadedPage[]
  exif?: ExifSummary
  truncated?: number
}

export async function loadFile(file: File, onPage?: (i: number, n: number) => void): Promise<LoadedDoc> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (isPdf) return loadPdf(file, onPage)
  const [bitmap, exif] = await Promise.all([createImageBitmap(file), readExif(file)])
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return { kind: 'image', name: file.name, pages: [{ canvas }], exif }
}

async function readExif(file: File): Promise<ExifSummary | undefined> {
  try {
    const all = await exifr.parse(file, { tiff: true, exif: true, gps: true, xmp: true, icc: false, iptc: true })
    if (!all) return undefined
    const lat = all.latitude
    const lon = all.longitude
    const camera = [all.Make, all.Model].filter(Boolean).join(' ') || undefined
    const taken = all.DateTimeOriginal ?? all.CreateDate ?? all.ModifyDate
    return {
      camera,
      takenAt: taken instanceof Date ? taken.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : taken ? String(taken) : undefined,
      software: all.Software,
      gps: typeof lat === 'number' && typeof lon === 'number' ? { lat, lon } : undefined,
      fieldCount: Object.keys(all).length,
    }
  } catch {
    return undefined
  }
}

async function loadPdf(file: File, onPage?: (i: number, n: number) => void): Promise<LoadedDoc> {
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const doc = await task.promise
  const n = Math.min(doc.numPages, MAX_PAGES)
  const pages: LoadedPage[] = []
  for (let i = 1; i <= n; i++) {
    onPage?.(i, n)
    const page = await doc.getPage(i)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(3, 1700 / base.width)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    const textWords = await pdfTextWords(page, viewport)
    pages.push({ canvas, textWords: textWords.length >= 8 ? textWords : undefined, pointSize: { w: base.width, h: base.height } })
  }
  const total = doc.numPages
  await task.destroy()
  return { kind: 'pdf', name: file.name, pages, truncated: total > n ? total - n : undefined }
}

/** Word boxes straight from the PDF text layer — exact text, no OCR guesswork. */
async function pdfTextWords(page: pdfjs.PDFPageProxy, viewport: pdfjs.PageViewport): Promise<DocWord[]> {
  const tc = await page.getTextContent()
  const raw: (DocWord & { base: number; h: number })[] = []
  // pdf.js gives one width per text run; measure glyph advances with a similar
  // font so boxes for part of a run (a UPI ID inside a narration) line up.
  const meter = document.createElement('canvas').getContext('2d')!
  for (const item of tc.items) {
    if (!('str' in item) || !item.str.trim()) continue
    const tx = pdfjs.Util.transform(viewport.transform, item.transform)
    const h = Math.hypot(tx[2], tx[3])
    if (Math.abs(tx[1]) > 0.01 * h) continue // skip rotated text
    const x = tx[4]
    const base = tx[5]
    const width = item.width * viewport.scale
    const family = tc.styles[item.fontName]?.fontFamily || 'sans-serif'
    meter.font = `${h}px ${family}`
    const k = width / Math.max(1, meter.measureText(item.str).width)
    const at = (i: number) => x + meter.measureText(item.str.slice(0, i)).width * k
    for (const m of item.str.matchAll(/\S+/g)) {
      const s = m.index!
      const chars = [...m[0]].map((_, c) => ({ x0: at(s + c), x1: at(s + c + 1), y0: base - h * 0.82, y1: base + h * 0.22 }))
      raw.push({ text: m[0], line: 0, x0: at(s), x1: at(s + m[0].length), y0: base - h * 0.82, y1: base + h * 0.22, chars, base, h })
    }
  }
  // group into lines by baseline, then order left→right
  raw.sort((a, b) => a.base - b.base || a.x0 - b.x0)
  let line = -1
  let lastBase = -Infinity
  for (const w of raw) {
    if (Math.abs(w.base - lastBase) > w.h * 0.5) {
      line++
      lastBase = w.base
    }
    w.line = line
  }
  raw.sort((a, b) => a.line - b.line || a.x0 - b.x0)
  return raw.map(({ base: _b, h: _h, ...w }) => w)
}
