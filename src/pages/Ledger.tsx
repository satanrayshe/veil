import { useState } from 'react'
import { loadFile } from '../lib/doc/load'
import { ocrText } from '../lib/doc/ocr'
import { clearLedger, extractCode, findEntry, loadLedger, removeFromLedger, type LedgerEntry } from '../lib/ledger'
import { go } from '../router'
import { I } from '../ui/kit'

type Trace = { kind: 'idle' } | { kind: 'busy'; msg: string } | { kind: 'found'; entry: LedgerEntry; exact: boolean; code: string } | { kind: 'none'; code: string | null }

const when = (t: number) => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function Ledger() {
  const [entries, setEntries] = useState(loadLedger)
  const [trace, setTrace] = useState<Trace>({ kind: 'idle' })
  const [typed, setTyped] = useState('')

  const lookup = (code: string | null) => {
    if (!code) return setTrace({ kind: 'none', code: null })
    const hit = findEntry(code)
    setTrace(hit ? { kind: 'found', entry: hit.entry, exact: hit.exact, code } : { kind: 'none', code })
  }

  const traceFile = async (file: File) => {
    try {
      setTrace({ kind: 'busy', msg: 'Opening the copy' })
      const doc = await loadFile(file)
      const c = doc.pages[0].canvas
      setTrace({ kind: 'busy', msg: 'Reading the reference strip' })
      // The reference sits in the footer strip: read an enlarged copy of the bottom first, then the whole page.
      const band = Math.round(c.height * 0.1)
      const strip = document.createElement('canvas')
      strip.width = c.width * 2
      strip.height = band * 2
      const sctx = strip.getContext('2d')!
      sctx.imageSmoothingQuality = 'high'
      sctx.drawImage(c, 0, c.height - band, c.width, band, 0, 0, strip.width, strip.height)
      let code = extractCode(await ocrText(strip))
      if (!code) {
        setTrace({ kind: 'busy', msg: 'Reading the whole page' })
        code = extractCode(await ocrText(c))
      }
      lookup(code)
    } catch (e) {
      setTrace({ kind: 'none', code: null })
      console.error(e)
    }
  }

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-20 pt-8 sm:px-6">
      <div className="max-w-2xl">
        <h1 className="font-serif text-[46px] leading-none">Share ledger</h1>
        <p className="mt-2 text-[15px] text-ink-2">
          Every stamped copy you make is recorded here, and only here, on this device. If one turns up somewhere it shouldn't, drop it below to see who you gave it to.
        </p>
      </div>

      <div className="mt-7 grid items-start gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
        <section className="sheet p-5">
          <h2 className="text-[16px] font-semibold">Trace a copy</h2>
          <p className="mt-1 text-[13px] text-mute">Drop a screenshot, photo or PDF of a copy you find in the wild, or type the reference printed on it.</p>
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files[0]
              if (f) traceFile(f)
            }}
            className="mt-4 flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-line-2 px-4 py-8 text-center hover:border-ink-2"
          >
            <I.search size={22} className="text-ink-2" />
            <span className="mt-2 text-[14px] font-semibold">Drop a suspicious copy</span>
            <span className="text-[12.5px] text-mute">read locally, like everything else</span>
            <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => e.target.files?.[0] && traceFile(e.target.files[0])} />
          </label>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              lookup(extractCode(typed) ?? (typed.trim() ? `VEIL-${typed.trim().toUpperCase().replace(/^VEIL-?/, '')}` : null))
            }}
          >
            <input className="field font-mono" placeholder="VEIL-K7M3RX" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Reference code" />
            <button className="btn btn-ink" type="submit">
              Look up
            </button>
          </form>

          <div className="mt-4" aria-live="polite">
            {trace.kind === 'busy' && <p className="text-[13.5px] text-mute">{trace.msg}…</p>}
            {trace.kind === 'found' && (
              <div className="fade-in rounded-lg border border-stamp/30 bg-stamp-soft p-4">
                <p className="label text-stamp">{trace.exact ? 'Match' : 'Probable match (one character differs)'}</p>
                <p className="mt-1 text-[16px] font-semibold leading-snug">
                  You gave this copy to {trace.entry.recipient}
                  <span className="font-normal text-ink-2"> for {trace.entry.purpose}</span>
                </p>
                <p className="mt-1 text-[13px] text-ink-2">
                  {when(trace.entry.createdAt)} · {trace.entry.code}
                </p>
                <p className="mt-2 text-[12.5px] leading-snug text-ink-2">
                  If it's being used for anything else, you have a dated record of who received it and for what. That's useful for a complaint to them, your bank, or the cyber-crime portal (cybercrime.gov.in).
                </p>
              </div>
            )}
            {trace.kind === 'none' && (
              <p className="rounded-md bg-paper px-3 py-2 text-[13px] text-ink-2">
                {trace.code ? `No copy with reference ${trace.code} in this device's ledger.` : 'Couldn’t find a Veil reference on that copy.'}
              </p>
            )}
          </div>
        </section>

        <section className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[16px] font-semibold">
              Copies you've shared <span className="font-normal text-mute">· {entries.length}</span>
            </h2>
            {entries.length > 0 && (
              <button
                className="text-[12.5px] text-mute underline underline-offset-2 hover:text-stamp"
                onClick={() => {
                  if (confirm('Delete the whole ledger from this device?')) {
                    clearLedger()
                    setEntries([])
                  }
                }}
              >
                Clear ledger
              </button>
            )}
          </div>
          {entries.length === 0 ? (
            <div className="sheet px-6 py-12 text-center">
              <p className="text-[15px] font-semibold">Nothing shared yet</p>
              <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-mute">Make a stamped copy of a document and it will be listed here with its reference.</p>
              <button className="btn btn-ink mt-5" onClick={() => go('docs')}>
                Make a safe ID copy <I.arrow />
              </button>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {entries.map((e) => (
                <li key={e.code} className={`sheet flex gap-3 p-3 ${trace.kind === 'found' && trace.entry.code === e.code ? 'ring-2 ring-stamp' : ''}`}>
                  <img src={e.thumb} alt="" className="h-24 w-20 flex-none rounded border border-line bg-white object-cover object-top" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold">{e.recipient}</p>
                    <p className="truncate text-[13px] text-ink-2">for {e.purpose}</p>
                    <p className="mt-1 font-mono text-[12px] font-semibold">{e.code}</p>
                    <p className="text-[12px] text-mute">{when(e.createdAt)}</p>
                    <p className="mt-1 truncate text-[11.5px] text-mute" title={e.types.join(', ')}>
                      {e.redactions} hidden · {e.types.slice(0, 3).join(', ')}
                      {e.types.length > 3 ? '…' : ''}
                    </p>
                  </div>
                  <button
                    className="grid size-7 flex-none place-items-center rounded text-mute hover:bg-line hover:text-stamp"
                    aria-label={`Delete ${e.code}`}
                    onClick={() => {
                      removeFromLedger(e.code)
                      setEntries(loadLedger())
                    }}
                  >
                    <I.trash size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
