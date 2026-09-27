import jsQR from 'jsqr'
import type { Box } from './types'

/**
 * Finds QR codes (e.g. the Secure QR on an Aadhaar card, which encodes name,
 * DOB, gender, address and photo). Each hit is painted over and the scan is
 * repeated so several codes on one page are all found.
 */
export function findQrCodes(src: HTMLCanvasElement, max = 3): Box[] {
  const found: Box[] = []
  for (const scale of [1, 0.5]) {
    const w = Math.round(src.width * scale)
    const h = Math.round(src.height * scale)
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(src, 0, 0, w, h)
    for (const b of found) {
      ctx.fillStyle = '#fff'
      ctx.fillRect(b.x0 * scale, b.y0 * scale, (b.x1 - b.x0) * scale, (b.y1 - b.y0) * scale)
    }
    for (let i = found.length; i < max; i++) {
      const img = ctx.getImageData(0, 0, w, h)
      const hit = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' })
      if (!hit) break
      const pts = [hit.location.topLeftCorner, hit.location.topRightCorner, hit.location.bottomLeftCorner, hit.location.bottomRightCorner]
      const xs = pts.map((p) => p.x)
      const ys = pts.map((p) => p.y)
      // Quiet zone around the code is part of what we hide.
      const pad = (Math.max(...xs) - Math.min(...xs)) * 0.08
      const box = { x0: Math.min(...xs) - pad, y0: Math.min(...ys) - pad, x1: Math.max(...xs) + pad, y1: Math.max(...ys) + pad }
      ctx.fillStyle = '#fff'
      ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0)
      if (!looksLikeQr(img, box, hit.data)) continue
      found.push({ x0: box.x0 / scale, y0: box.y0 / scale, x1: box.x1 / scale, y1: box.y1 / scale })
    }
    if (found.length) break
  }
  return found
}

/**
 * jsQR occasionally "decodes" table rulings in statements. A real code is
 * roughly square, carries data, and is close to half dark modules.
 */
function looksLikeQr(img: ImageData, b: { x0: number; y0: number; x1: number; y1: number }, data: string): boolean {
  const w = b.x1 - b.x0
  const h = b.y1 - b.y0
  if (!data || w < 24 || h < 24 || w / h < 0.8 || w / h > 1.25) return false
  let dark = 0
  let n = 0
  const step = Math.max(1, Math.floor(Math.min(w, h) / 60))
  for (let y = Math.max(0, Math.floor(b.y0)); y < Math.min(img.height, b.y1); y += step)
    for (let x = Math.max(0, Math.floor(b.x0)); x < Math.min(img.width, b.x1); x += step) {
      const i = (y * img.width + x) * 4
      if (img.data[i] + img.data[i + 1] + img.data[i + 2] < 384) dark++
      n++
    }
  const ratio = dark / Math.max(1, n)
  return ratio > 0.25 && ratio < 0.75
}
