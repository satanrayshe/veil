import type { EntityType } from '../detect/types'

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface DocWord extends Box {
  text: string
  line: number
  /** Per-character boxes when the source gives them (OCR symbols). */
  chars?: Box[]
}

export interface DocPage {
  index: number
  width: number
  height: number
  /** Original rendering of the page — never modified. */
  canvas: HTMLCanvasElement
  words: DocWord[]
  /** Reconstructed page text that detection runs on. */
  text: string
  /** Character range of each word inside `text`. */
  spans: { start: number; end: number }[]
  source: 'ocr' | 'pdf-text'
  /** PDF page size in points, for exporting a PDF with the same dimensions. */
  pointSize?: { w: number; h: number }
}

export interface Redaction {
  id: string
  page: number
  box: Box
  type: EntityType | 'MANUAL'
  findingId?: string
  label: string
  on: boolean
}

export interface ExifSummary {
  camera?: string
  takenAt?: string
  software?: string
  gps?: { lat: number; lon: number }
  fieldCount: number
}

export interface WatermarkSpec {
  recipient: string
  purpose: string
  date: string
  code: string
}
