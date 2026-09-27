import { PDFDocument } from 'pdf-lib'
import type { DocPage, Redaction, WatermarkSpec } from './types'

export type RedactStyle = 'solid' | 'labelled'

export interface ComposeOptions {
  style: RedactStyle
  watermark?: WatermarkSpec | null
}

export const footerText = (w: WatermarkSpec) =>
  `Copy for ${w.recipient || 'recipient'} · ${w.purpose || 'stated purpose'} only · ${w.date} · not valid for any other use`

/**
 * Burns redactions (and the optional purpose watermark) into a fresh canvas.
 * The output is pixels only: no text layer, no metadata, nothing under the
 * black boxes to recover.
 */
export function composePage(page: DocPage, reds: Redaction[], opts: ComposeOptions): HTMLCanvasElement {
  const W = page.width
  const strip = opts.watermark ? Math.max(30, Math.round(W * 0.034)) : 0
  const c = document.createElement('canvas')
  c.width = W
  c.height = page.height + strip
  const ctx = c.getContext('2d')!
  ctx.drawImage(page.canvas, 0, 0)

  for (const r of reds) {
    if (!r.on || r.page !== page.index) continue
    const { x0, y0, x1, y1 } = r.box
    ctx.fillStyle = '#0b0b0a'
    ctx.fillRect(Math.floor(x0), Math.floor(y0), Math.ceil(x1 - x0), Math.ceil(y1 - y0))
    if (opts.style === 'labelled') {
      const h = y1 - y0
      const size = Math.max(8, Math.min(h * 0.46, 22))
      ctx.font = `600 ${size}px "JetBrains Mono", ui-monospace, monospace`
      const label = r.label
      if (ctx.measureText(label).width < x1 - x0 - 6) {
        ctx.fillStyle = '#f3f0e8'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'center'
        ctx.fillText(label, (x0 + x1) / 2, (y0 + y1) / 2 + 1)
      }
    }
  }

  if (opts.watermark) drawWatermark(ctx, W, page.height, strip, opts.watermark)
  return c
}

function drawWatermark(ctx: CanvasRenderingContext2D, W: number, H: number, strip: number, wm: WatermarkSpec) {
  const line = `${(wm.purpose || 'Stated purpose').toUpperCase()} ONLY · ${(wm.recipient || 'Recipient').toUpperCase()} · ${wm.date}`
  const size = Math.max(14, Math.round(Math.min(W, H) / 27))
  ctx.save()
  ctx.font = `600 ${size}px "Inter Tight Variable", system-ui, sans-serif`
  ctx.fillStyle = 'rgba(176, 38, 20, 0.17)'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.translate(W / 2, H / 2)
  ctx.rotate(-Math.PI / 7)
  const text = `${line}   ·   ${wm.code}   ·   `
  const tw = ctx.measureText(text).width
  const diag = Math.hypot(W, H)
  const rowGap = size * 3.4
  for (let y = -diag / 2, row = 0; y < diag / 2; y += rowGap, row++) {
    const shift = (row % 2) * (tw / 2)
    for (let x = -diag / 2 - tw + shift; x < diag / 2; x += tw) ctx.fillText(text, x, y)
  }
  ctx.restore()

  // Clear footer strip — readable by people and by Veil's own leak tracer.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, H, W, strip)
  ctx.fillStyle = '#b02614'
  ctx.fillRect(0, H, W, Math.max(2, strip * 0.07))
  ctx.fillStyle = '#16140f'
  ctx.textBaseline = 'middle'
  // Reference on the right in bold monospace: the part OCR has to read exactly.
  const mid = H + strip * 0.54
  const ref = `Ref ${wm.code}`
  ctx.font = `600 ${Math.round(strip * 0.5)}px "JetBrains Mono", ui-monospace, monospace`
  ctx.textAlign = 'right'
  ctx.fillText(ref, W - strip * 0.5, mid)
  const refW = ctx.measureText(ref).width
  let fs = Math.round(strip * 0.42)
  const foot = footerText(wm)
  const room = W - strip * 1.5 - refW
  ctx.font = `500 ${fs}px "Inter Tight Variable", system-ui, sans-serif`
  while (ctx.measureText(foot).width > room && fs > 8) {
    fs--
    ctx.font = `500 ${fs}px "Inter Tight Variable", system-ui, sans-serif`
  }
  ctx.textAlign = 'left'
  ctx.fillText(foot, strip * 0.5, mid)
}

export function canvasToBlob(c: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality = 0.92): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Export failed'))), type, quality))
}

/** Builds a flattened PDF: every page is a single image, so no hidden text survives. */
export async function canvasesToPdf(canvases: HTMLCanvasElement[], pointSizes: ({ w: number; h: number } | undefined)[]): Promise<Blob> {
  const pdf = await PDFDocument.create()
  pdf.setProducer('Veil')
  pdf.setCreator('Veil')
  for (let i = 0; i < canvases.length; i++) {
    const c = canvases[i]
    const jpg = await pdf.embedJpg(await (await canvasToBlob(c, 'image/jpeg', 0.9)).arrayBuffer())
    const size = pointSizes[i]
    const w = size?.w ?? c.width * 0.75
    const h = size ? size.w * (c.height / c.width) : c.height * 0.75
    const p = pdf.addPage([w, h])
    p.drawImage(jpg, { x: 0, y: 0, width: w, height: h })
  }
  const bytes = await pdf.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function thumbnail(c: HTMLCanvasElement, max = 220): string {
  const s = Math.min(1, max / Math.max(c.width, c.height))
  const t = document.createElement('canvas')
  t.width = Math.round(c.width * s)
  t.height = Math.round(c.height * s)
  t.getContext('2d')!.drawImage(c, 0, 0, t.width, t.height)
  return t.toDataURL('image/jpeg', 0.7)
}
