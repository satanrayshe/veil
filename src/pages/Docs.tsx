import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { aiFindings } from '../lib/ai/ner'
import { detect } from '../lib/detect/engine'
import { ENTITY, type Finding } from '../lib/detect/types'
import { buildText, findingsToRedactions } from '../lib/doc/layout'
import { loadFile, type LoadedDoc } from '../lib/doc/load'
import { ocrCanvas, preloadOcr } from '../lib/doc/ocr'
import { findQrCodes } from '../lib/doc/qr'
import { canvasesToPdf, canvasToBlob, composePage, download, thumbnail, type RedactStyle } from '../lib/doc/render'
import type { Box, DocPage, Redaction, WatermarkSpec } from '../lib/doc/types'
import { addToLedger, newCode } from '../lib/ledger'
import { DOC_SAMPLES, fetchSample } from '../lib/samples'
import { go } from '../router'
import { CanvasView, DocViewer } from '../ui/DocViewer'
import { AiToggle, FindingList, Insights, useAiState, type Row } from '../ui/findings'
import { I, Segmented, Switch, useLocalState } from '../ui/kit'

type Stage = { kind: 'empty' } | { kind: 'busy'; msg: string; progress?: number; preview?: HTMLCanvasElement } | { kind: 'ready' } | { kind: 'error'; msg: string }

interface Doc {
  name: string
  kind: LoadedDoc['kind']
  pages: DocPage[]
  exif?: LoadedDoc['exif']
  truncated?: number
}

const today = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

export default function Docs({ sample }: { sample?: string }) {
  const [stage, setStage] = useState<Stage>({ kind: 'empty' })
  const [doc, setDoc] = useState<Doc | null>(null)
  const [ruleFindings, setRuleFindings] = useState<Finding[][]>([])
  const [aiExtra, setAiExtra] = useState<Finding[][]>([])
  const [qr, setQr] = useState<Box[][]>([])
  const [manual, setManual] = useState<Redaction[]>([])
  const [off, setOff] = useState<Set<string>>(new Set())
  const [pageIdx, setPageIdx] = useState(0)
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [hover, setHover] = useState<string | null>(null)
  const [keepLast4, setKeepLast4] = useLocalState('veil.keepLast4', true)
  const [style, setStyle] = useLocalState<RedactStyle>('veil.style', 'solid')
  const [watchlist] = useLocalState<string[]>('veil.watchlist', [])
  const [wmOn, setWmOn] = useState(true)
  const [wm, setWm] = useState<WatermarkSpec>(() => ({ recipient: '', purpose: '', date: today(), code: newCode() }))
  const [toast, setToast] = useState<string | null>(null)
  const aiStatus = useAiState().status
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => preloadOcr(), [])

  const process = useCallback(
    async (file: File) => {
      try {
        setDoc(null)
        setManual([])
        setOff(new Set())
        setPageIdx(0)
        setView('edit')
        setStage({ kind: 'busy', msg: 'Opening file' })
        const loaded = await loadFile(file, (i, n) => setStage({ kind: 'busy', msg: `Rendering page ${i} of ${n}` }))
        const pages: DocPage[] = []
        for (let i = 0; i < loaded.pages.length; i++) {
          const lp = loaded.pages[i]
          const of = loaded.pages.length > 1 ? ` (page ${i + 1} of ${loaded.pages.length})` : ''
          let words = lp.textWords
          const source = words ? 'pdf-text' : 'ocr'
          if (!words) {
            setStage({ kind: 'busy', msg: `Reading text${of}`, preview: lp.canvas, progress: 0 })
            words = await ocrCanvas(lp.canvas, (p) =>
              setStage({ kind: 'busy', msg: p.status === 'recognizing text' ? `Reading text${of}` : 'Starting the text reader', progress: p.progress, preview: lp.canvas }),
            )
          }
          const { text, spans } = buildText(words)
          pages.push({ index: i, width: lp.canvas.width, height: lp.canvas.height, canvas: lp.canvas, words, text, spans, source, pointSize: lp.pointSize })
        }
        setStage({ kind: 'busy', msg: 'Looking for QR codes', preview: loaded.pages[0].canvas })
        await new Promise((r) => setTimeout(r, 30))
        setQr(pages.map((p) => findQrCodes(p.canvas)))
        setAiExtra(pages.map(() => []))
        setDoc({ name: loaded.name, kind: loaded.kind, pages, exif: loaded.exif, truncated: loaded.truncated })
        setStage({ kind: 'ready' })
      } catch (e) {
        console.error(e)
        setStage({ kind: 'error', msg: e instanceof Error ? e.message : String(e) })
      }
    },
    [],
  )

  // rule-based detection (re-runs when the watchlist changes)
  useEffect(() => {
    if (doc) setRuleFindings(doc.pages.map((p) => detect(p.text, { watchlist, extra: aiExtra[p.index] ?? [] })))
  }, [doc, watchlist, aiExtra])

  // AI pass per page once the model is on
  useEffect(() => {
    if (!doc || aiStatus !== 'ready') return
    let dead = false
    Promise.all(doc.pages.map((p) => aiFindings(p.text).catch(() => [])))
      .then((r) => !dead && setAiExtra(r))
      .catch(() => {})
    return () => {
      dead = true
    }
  }, [doc, aiStatus])

  useEffect(() => {
    if (!sample) return
    fetchSample(sample).then((f) => f && process(f))
  }, [sample, process])

  // paste an image straight from the clipboard
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/') || x.type === 'application/pdf')
      if (f) process(f)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [process])

  const redactions: Redaction[] = useMemo(() => {
    if (!doc) return []
    const auto = doc.pages.flatMap((p) => [
      ...findingsToRedactions(p, ruleFindings[p.index] ?? [], keepLast4),
      ...(qr[p.index] ?? []).map((box, k) => ({ id: `QR:${p.index}:${k}`, page: p.index, box, type: 'QR_CODE' as const, findingId: `QR:${p.index}:${k}`, label: 'QR', on: true })),
    ])
    return [...auto, ...manual].map((r) => ({ ...r, on: !off.has(r.id) }))
  }, [doc, ruleFindings, qr, keepLast4, manual, off])

  const rows: Row[] = useMemo(() => {
    if (!doc) return []
    const out: Row[] = []
    doc.pages.forEach((p) => {
      for (const f of ruleFindings[p.index] ?? []) {
        const reds = redactions.filter((r) => r.findingId === f.id && r.page === p.index)
        if (!reds.length) continue
        out.push({ key: `${p.index}:${f.id}`, finding: f, page: doc.pages.length > 1 ? p.index : undefined, on: reds.some((r) => r.on) })
      }
      ;(qr[p.index] ?? []).forEach((_, k) => {
        const id = `QR:${p.index}:${k}`
        out.push({
          key: `${p.index}:${id}`,
          finding: { id, type: 'QR_CODE', start: 0, end: 0, value: 'QR code', confidence: 'high', reason: 'Machine-readable code — may encode your details', source: 'rule' },
          page: doc.pages.length > 1 ? p.index : undefined,
          on: !off.has(id),
        })
      })
    })
    return out
  }, [doc, ruleFindings, qr, redactions, off])

  const toggleRow = (row: Row, on: boolean) => {
    const ids = redactions.filter((r) => r.findingId === row.finding.id && (row.page === undefined || r.page === row.page)).map((r) => r.id)
    const next = new Set(off)
    ids.forEach((id) => (on ? next.delete(id) : next.add(id)))
    setOff(next)
  }
  const toggleRed = (r: Redaction) => {
    if (r.type === 'MANUAL') {
      setManual(manual.filter((m) => m.id !== r.id))
      return
    }
    const next = new Set(off)
    if (next.has(r.id)) next.delete(r.id)
    else next.add(r.id)
    setOff(next)
  }
  const addBox = (box: Box, label = 'Area') => setManual([...manual, { id: `M:${Date.now()}:${Math.random()}`, page: pageIdx, box, type: 'MANUAL', label, on: true }])

  const page = doc?.pages[pageIdx]
  const wmSpec = wmOn ? wm : null
  const composed = useMemo(() => (doc && page && view === 'preview' ? composePage(page, redactions, { style, watermark: wmSpec }) : null), [doc, page, view, redactions, style, wmSpec])

  const activeFindings = useMemo(() => {
    if (!doc) return []
    const onIds = new Set(redactions.filter((r) => r.on).map((r) => r.findingId))
    return (ruleFindings.flat() ?? []).filter((f) => onIds.has(f.id))
  }, [doc, ruleFindings, redactions])

  const onCount = redactions.filter((r) => r.on).length

  async function doExport(format: 'auto' | 'jpg', share = false) {
    if (!doc) return
    const canvases = doc.pages.map((p) => composePage(p, redactions, { style, watermark: wmSpec }))
    const base = doc.name.replace(/\.[^.]+$/, '')
    let blob: Blob
    let name: string
    if (doc.kind === 'pdf') {
      blob = await canvasesToPdf(canvases, doc.pages.map((p) => p.pointSize))
      name = `${base}.veil.pdf`
    } else {
      const jpg = format === 'jpg'
      blob = await canvasToBlob(canvases[0], jpg ? 'image/jpeg' : 'image/png')
      name = `${base}.veil.${jpg ? 'jpg' : 'png'}`
    }
    if (wmSpec) {
      addToLedger({
        code: wmSpec.code,
        recipient: wmSpec.recipient || 'Unnamed recipient',
        purpose: wmSpec.purpose || 'Unspecified purpose',
        createdAt: Date.now(),
        fileName: doc.name,
        pages: doc.pages.length,
        redactions: onCount,
        types: [...new Set(redactions.filter((r) => r.on).map((r) => (r.type === 'MANUAL' ? 'Manual area' : ENTITY[r.type].label)))],
        thumb: thumbnail(canvases[0]),
      })
    }
    const file = new File([blob], name, { type: blob.type })
    if (share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name })
      } catch {
        /* user cancelled */
      }
    } else download(blob, name)
    if (wmSpec) {
      setToast(`Logged in your ledger as ${wmSpec.code}. The next copy gets a fresh reference.`)
      setWm({ ...wm, code: newCode() })
    } else setToast('Saved. Metadata stripped, redactions burned in.')
    setTimeout(() => setToast(null), 5200)
  }

  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare

  // ------------------------------------------------------------------ render

  if (stage.kind !== 'ready' || !doc || !page)
    return (
      <div className="mx-auto max-w-[1240px] px-4 pb-20 pt-8 sm:px-6">
        <Intro />
        {stage.kind === 'busy' ? (
          <Busy stage={stage} />
        ) : (
          <Drop onFile={process} inputRef={fileInput} error={stage.kind === 'error' ? stage.msg : undefined} />
        )}
      </div>
    )

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-20 pt-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="label">{doc.kind === 'pdf' ? `PDF · ${doc.pages.length} page${doc.pages.length > 1 ? 's' : ''}` : 'Image'} · {page.source === 'ocr' ? 'text read by OCR' : 'text layer'}</p>
          <h1 className="mt-1 truncate font-serif text-[38px] leading-none">{doc.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => fileInput.current?.click()}>
            <I.upload size={14} /> Another file
          </button>
          <input ref={fileInput} type="file" accept="image/*,application/pdf" hidden onChange={(e) => e.target.files?.[0] && process(e.target.files[0])} />
        </div>
      </div>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* viewer */}
        <section className="sheet min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5">
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                { id: 'edit', label: 'Edit boxes' },
                { id: 'preview', label: 'Preview copy' },
              ]}
            />
            {doc.pages.length > 1 && (
              <div className="flex items-center gap-1">
                {doc.pages.map((p) => (
                  <button
                    key={p.index}
                    onClick={() => setPageIdx(p.index)}
                    className={`h-8 min-w-8 rounded-md px-2 font-mono text-[12px] ${p.index === pageIdx ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-line/60'}`}
                    aria-label={`Page ${p.index + 1}`}
                  >
                    {p.index + 1}
                  </button>
                ))}
              </div>
            )}
            <span className="ml-auto text-[12.5px] text-mute">{onCount} boxes</span>
          </div>
          <div className="bg-[#e9e5da] p-3 sm:p-5">
            <div className="mx-auto max-w-[900px] shadow-lift">
              {view === 'edit' ? (
                <DocViewer
                  page={page}
                  redactions={redactions.filter((r) => r.page === pageIdx)}
                  hover={hover}
                  onToggle={toggleRed}
                  onAddBox={(b) => addBox(b)}
                  onAddWord={(w) => {
                    const word = page.words[w]
                    const pad = (word.y1 - word.y0) * 0.14
                    addBox({ x0: word.x0 - pad, y0: word.y0 - pad, x1: word.x1 + pad, y1: word.y1 + pad }, word.text)
                  }}
                />
              ) : (
                composed && <CanvasView source={composed} />
              )}
            </div>
          </div>
          <p className="border-t border-line px-4 py-2.5 text-[12.5px] text-mute">
            {view === 'edit' ? 'Click a box to switch it off · click any word to hide it · drag to cover a photo, signature or anything else' : 'This is exactly what you will share. No hidden text, no metadata.'}
          </p>
        </section>

        {/* sidebar */}
        <aside className="space-y-4">
          <section className="sheet p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[15px] font-semibold">Hidden on this copy</h3>
              <span className="text-[12.5px] text-mute">{rows.filter((r) => r.on).length} items</span>
            </div>
            <div className="mt-3">
              <Insights findings={activeFindings} />
            </div>
            <div className="scroll-thin mt-3 max-h-[380px] overflow-y-auto pr-1">
              <FindingList rows={rows} onToggle={toggleRow} hover={hover} setHover={(k) => setHover(k ? k.split(':').slice(1).join(':') : null)} empty="Nothing detected automatically. Click words or drag boxes to hide them yourself." />
            </div>
            {manual.length > 0 && <p className="mt-3 text-[12.5px] text-mute">{manual.length} area{manual.length > 1 ? 's' : ''} you covered by hand (click one to remove it).</p>}
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <label className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-[13.5px] font-semibold">Keep last 4 digits</p>
                  <p className="text-[12.5px] leading-snug text-mute">Masked-Aadhaar style, for Aadhaar, cards and bank accounts. Enough to recognise, useless to misuse.</p>
                </div>
                <Switch on={keepLast4} onChange={setKeepLast4} label="Keep last 4 digits visible" />
              </label>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13.5px] font-semibold">Box style</p>
                <Segmented
                  label="Box style"
                  value={style}
                  onChange={setStyle}
                  options={[
                    { id: 'solid', label: 'Solid' },
                    { id: 'labelled', label: 'Labelled' },
                  ]}
                />
              </div>
            </div>
            <div className="mt-4 border-t border-line pt-4">
              <AiToggle />
            </div>
          </section>

          <section className="sheet p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className="text-[15px] font-semibold">Purpose stamp</h3>
                <p className="mt-0.5 text-[12.5px] leading-snug text-mute">Says who this copy is for and why. A copy stamped “hotel check-in” is useless for opening a loan.</p>
              </div>
              <Switch on={wmOn} onChange={setWmOn} label="Add purpose stamp" />
            </div>
            {wmOn && (
              <div className="mt-3 space-y-2.5">
                <label className="block">
                  <span className="label">Shared with</span>
                  <input className="field mt-1" placeholder="e.g. Hotel Sunrise, Goa" value={wm.recipient} onChange={(e) => setWm({ ...wm, recipient: e.target.value })} />
                </label>
                <label className="block">
                  <span className="label">Only for</span>
                  <input className="field mt-1" placeholder="e.g. check-in" value={wm.purpose} onChange={(e) => setWm({ ...wm, purpose: e.target.value })} />
                </label>
                <div className="flex items-center justify-between gap-2 rounded-md bg-paper px-3 py-2">
                  <div className="min-w-0">
                    <p className="label">Reference</p>
                    <p className="font-mono text-[13px] font-semibold">{wm.code}</p>
                  </div>
                  <p className="text-right text-[12px] text-mute">{wm.date}</p>
                  <button className="btn btn-ghost btn-sm" onClick={() => setWm({ ...wm, code: newCode() })} aria-label="New reference">
                    <I.refresh size={14} />
                  </button>
                </div>
              </div>
            )}
          </section>

          <MetaPanel exif={doc.exif} kind={doc.kind} />

          <section className="sheet p-4">
            <button className="btn btn-ink h-11 w-full" onClick={() => doExport('auto')}>
              <I.download /> Download safe copy ({doc.kind === 'pdf' ? 'PDF' : 'PNG'})
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {doc.kind === 'image' && (
                <button className="btn btn-ghost btn-sm" onClick={() => doExport('jpg')}>
                  JPG (smaller)
                </button>
              )}
              {canShare && (
                <button className="btn btn-ghost btn-sm" onClick={() => doExport('auto', true)}>
                  <I.share size={14} /> Share…
                </button>
              )}
            </div>
            {wmOn && (
              <p className="mt-3 text-[12px] leading-snug text-mute">
                Each download is recorded in your{' '}
                <button className="underline underline-offset-2 hover:text-ink" onClick={() => go('ledger')}>
                  ledger
                </button>{' '}
                on this device, so a leaked copy can be traced back to who you gave it to.
              </p>
            )}
          </section>

          <details className="sheet p-4 text-[13px]">
            <summary className="cursor-pointer font-semibold">Text Veil read on this page</summary>
            <pre className="scroll-thin mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-ink-2">{page.text || '(no text found)'}</pre>
          </details>
        </aside>
      </div>

      {toast && (
        <div role="status" className="fade-in fixed inset-x-4 bottom-5 z-40 mx-auto max-w-md rounded-lg bg-ink px-4 py-3 text-[13.5px] text-paper shadow-lift">
          {toast}
        </div>
      )}
    </div>
  )
}

function Intro() {
  return (
    <div className="mb-7 max-w-2xl">
      <h1 className="font-serif text-[46px] leading-none">Safe ID copy</h1>
      <p className="mt-2 text-[15px] text-ink-2">
        Drop a photo or PDF of an Aadhaar or PAN card, a rent agreement, payslip or bank statement. Veil reads it on this device, hides what the other side doesn't need, and stamps it for one purpose.
      </p>
    </div>
  )
}

function Drop({ onFile, inputRef, error }: { onFile: (f: File) => void; inputRef: React.RefObject<HTMLInputElement | null>; error?: string }) {
  const [over, setOver] = useState(false)
  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const f = e.dataTransfer.files[0]
          if (f) onFile(f)
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors sm:py-24 ${over ? 'border-ink bg-sheet' : 'border-line-2 bg-sheet/60 hover:border-ink-2'}`}
      >
        <I.upload size={28} className="text-ink-2" />
        <p className="mt-4 text-[18px] font-semibold">Drop an image or PDF here</p>
        <p className="mt-1 text-[14px] text-mute">or click to choose · paste a screenshot with Ctrl+V</p>
        <input ref={inputRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      {error && <p className="mt-3 rounded-md bg-stamp-soft px-3 py-2 text-[13.5px] text-stamp">Couldn't process that file: {error}</p>}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-[13.5px] text-mute">No document handy? Try a sample:</span>
        {DOC_SAMPLES.map((s) => (
          <button key={s.id} className="btn btn-ghost btn-sm" onClick={() => go('docs', s.id)}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Busy({ stage }: { stage: Extract<Stage, { kind: 'busy' }> }) {
  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
      <div className="sheet overflow-hidden bg-[#e9e5da] p-4">
        <div className="relative mx-auto max-w-[760px] overflow-hidden shadow-lift">
          {stage.preview ? <CanvasView source={stage.preview} /> : <div className="aspect-[3/4] bg-white" />}
          <div className="scan" />
        </div>
      </div>
      <div className="sheet p-5" role="status" aria-live="polite">
        <p className="text-[15px] font-semibold">{stage.msg}…</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-ink transition-[width] duration-200" style={{ width: `${Math.max(4, (stage.progress ?? 0.04) * 100)}%` }} />
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-mute">Text recognition runs inside this tab using a local copy of Tesseract. The file isn't uploaded anywhere.</p>
      </div>
    </div>
  )
}

function MetaPanel({ exif, kind }: { exif?: Doc['exif']; kind: Doc['kind'] }) {
  return (
    <section className="sheet p-4">
      <h3 className="text-[15px] font-semibold">Hidden data in the file</h3>
      {exif?.gps ? (
        <div className="mt-3 flex gap-3 rounded-lg border border-stamp/30 bg-stamp-soft px-3 py-2.5">
          <I.pin size={17} className="mt-0.5 flex-none text-stamp" />
          <div className="text-[13px] leading-snug text-ink-2">
            <p className="font-semibold text-ink">
              GPS location: {exif.gps.lat.toFixed(4)}, {exif.gps.lon.toFixed(4)}
            </p>
            <p className="mt-0.5">This photo records exactly where it was taken. For a document shot at home, that's your address. Removed on export.</p>
          </div>
        </div>
      ) : null}
      {exif ? (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
          {exif.camera && (
            <>
              <dt className="text-mute">Camera</dt>
              <dd className="truncate">{exif.camera}</dd>
            </>
          )}
          {exif.takenAt && (
            <>
              <dt className="text-mute">Taken</dt>
              <dd>{exif.takenAt}</dd>
            </>
          )}
          {exif.software && (
            <>
              <dt className="text-mute">Software</dt>
              <dd className="truncate">{exif.software}</dd>
            </>
          )}
          <dt className="text-mute">Fields</dt>
          <dd>{exif.fieldCount} metadata fields, all dropped</dd>
        </dl>
      ) : (
        <p className="mt-1.5 text-[13px] text-mute">
          {kind === 'pdf' ? 'Exported PDFs are rebuilt from page images, so the old text layer, author and edit history are gone.' : 'No camera metadata found. Exports never carry any.'}
        </p>
      )}
    </section>
  )
}
