import { useEffect, useRef, useState } from 'react'
import type { Box, DocPage, Redaction } from '../lib/doc/types'
import { wordAt } from '../lib/doc/layout'
import { typeColor } from './kit'

/** Paints a source canvas into a visible one (keeps the original untouched). */
export function CanvasView({ source, className = '' }: { source: HTMLCanvasElement; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    c.width = source.width
    c.height = source.height
    c.getContext('2d')!.drawImage(source, 0, 0)
  }, [source])
  return <canvas ref={ref} className={`block h-auto w-full ${className}`} />
}

export function DocViewer({
  page,
  redactions,
  hover,
  onToggle,
  onAddBox,
  onAddWord,
}: {
  page: DocPage
  redactions: Redaction[]
  hover: string | null
  onToggle: (r: Redaction) => void
  onAddBox: (b: Box) => void
  onAddWord: (wordIdx: number) => void
}) {
  const svg = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<{ x: number; y: number; x2: number; y2: number } | null>(null)
  const [hoverWord, setHoverWord] = useState(-1)

  const toPage = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * page.width, y: ((e.clientY - r.top) / r.height) * page.height }
  }
  const hitRedaction = (x: number, y: number) =>
    [...redactions].reverse().find((r) => x >= r.box.x0 && x <= r.box.x1 && y >= r.box.y0 && y <= r.box.y1)

  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const p = toPage(e)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setDrag({ x: p.x, y: p.y, x2: p.x, y2: p.y })
  }
  const move = (e: React.PointerEvent) => {
    const p = toPage(e)
    if (drag) setDrag({ ...drag, x2: p.x, y2: p.y })
    else setHoverWord(hitRedaction(p.x, p.y) ? -1 : wordAt(page, p.x, p.y))
  }
  const up = (e: React.PointerEvent) => {
    if (!drag) return
    const p = toPage(e)
    const dx = Math.abs(p.x - drag.x)
    const dy = Math.abs(p.y - drag.y)
    const scale = svg.current!.getBoundingClientRect().width / page.width
    if (dx * scale < 5 && dy * scale < 5) {
      const r = hitRedaction(p.x, p.y)
      if (r) onToggle(r)
      else {
        const w = wordAt(page, p.x, p.y)
        if (w >= 0) onAddWord(w)
      }
    } else {
      onAddBox({ x0: Math.min(drag.x, p.x), y0: Math.min(drag.y, p.y), x1: Math.max(drag.x, p.x), y1: Math.max(drag.y, p.y) })
    }
    setDrag(null)
  }

  const hw = hoverWord >= 0 ? page.words[hoverWord] : null
  return (
    <div className="relative">
      <CanvasView source={page.canvas} />
      <svg
        ref={svg}
        viewBox={`0 0 ${page.width} ${page.height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={() => setHoverWord(-1)}
        role="img"
        aria-label="Document with redaction boxes. Click a box to toggle it, click a word to hide it, or drag to cover an area."
      >
        {hw && <rect x={hw.x0 - 3} y={hw.y0 - 3} width={hw.x1 - hw.x0 + 6} height={hw.y1 - hw.y0 + 6} rx={3} fill="rgb(22 20 15 / 0.08)" stroke="#16140f" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
        {redactions.map((r) => {
          const c = typeColor(r.type)
          const hot = hover === r.id || hover === r.findingId
          return (
            <rect
              key={r.id}
              x={r.box.x0}
              y={r.box.y0}
              width={r.box.x1 - r.box.x0}
              height={r.box.y1 - r.box.y0}
              rx={2}
              fill={r.on ? 'rgb(11 11 10 / 0.86)' : 'transparent'}
              stroke={c.edge}
              strokeWidth={hot ? 3 : 1.6}
              strokeDasharray={r.on ? undefined : '5 4'}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
        {drag && (
          <rect
            x={Math.min(drag.x, drag.x2)}
            y={Math.min(drag.y, drag.y2)}
            width={Math.abs(drag.x2 - drag.x)}
            height={Math.abs(drag.y2 - drag.y)}
            fill="rgb(11 11 10 / 0.5)"
            stroke="#16140f"
            strokeDasharray="5 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  )
}
