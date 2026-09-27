import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { aiFindings } from '../lib/ai/ner'
import { detect, findingKey } from '../lib/detect/engine'
import { MASK_MODES, maskText, unmaskText, Vault, type MaskMode, type VaultEntry } from '../lib/detect/mask'
import { ENTITY, type EntityType, type Finding } from '../lib/detect/types'
import { TEXT_SAMPLES } from '../lib/samples'
import { AiToggle, FindingList, Insights, useAiState, type Row } from '../ui/findings'
import { GROUP_COLOR, I, Segmented, typeColor, useCopy, useLocalState } from '../ui/kit'

const VAULT_KEY = 'veil.vault'

function loadCommitted(): VaultEntry[] {
  try {
    return JSON.parse(sessionStorage.getItem(VAULT_KEY) || '[]')
  } catch {
    return []
  }
}

const CHATS = [
  { id: 'chatgpt', label: 'ChatGPT', url: (q: string) => `https://chatgpt.com/?q=${encodeURIComponent(q)}` },
  { id: 'claude', label: 'Claude', url: (q: string) => `https://claude.ai/new?q=${encodeURIComponent(q)}` },
  { id: 'gemini', label: 'Gemini', url: () => 'https://gemini.google.com/app' },
]

export default function Shield({ sample }: { sample?: string }) {
  const [text, setText] = useState(() => TEXT_SAMPLES.find((s) => s.id === sample)?.text ?? sessionStorage.getItem('veil.prompt') ?? TEXT_SAMPLES[0].text)
  const [mode, setMode] = useLocalState<MaskMode>('veil.mode', 'token')
  const [watchlist, setWatchlist] = useLocalState<string[]>('veil.watchlist', [])
  const [allow, setAllow] = useState<Set<string>>(new Set())
  const [hover, setHover] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [committed, setCommitted] = useState<VaultEntry[]>(loadCommitted)
  const [ai, setAi] = useState<{ text: string; findings: Finding[] }>({ text: '', findings: [] })
  const [selection, setSelection] = useState('')
  const aiStatus = useAiState().status

  useEffect(() => {
    if (sample) {
      const s = TEXT_SAMPLES.find((x) => x.id === sample)
      if (s) setText(s.text)
    }
  }, [sample])

  useEffect(() => {
    try {
      sessionStorage.setItem('veil.prompt', text)
    } catch {
      /* ignore */
    }
  }, [text])

  const dText = useDeferredValue(text)

  // On-device AI pass (debounced; results only apply to the text they were computed for)
  useEffect(() => {
    if (aiStatus !== 'ready') return
    const t = setTimeout(() => {
      aiFindings(dText)
        .then((findings) => setAi({ text: dText, findings }))
        .catch(() => {})
    }, 350)
    return () => clearTimeout(t)
  }, [dText, aiStatus])

  const all = useMemo(
    () => detect(dText, { watchlist, extra: aiStatus === 'ready' && ai.text === dText ? ai.findings : [] }),
    [dText, watchlist, ai, aiStatus],
  )
  const active = useMemo(() => all.filter((f) => !allow.has(findingKey(f))), [all, allow])

  const rows: Row[] = useMemo(() => {
    const byKey = new Map<string, Row>()
    for (const f of all) {
      const key = findingKey(f)
      const r = byKey.get(key)
      if (r) r.count = (r.count ?? 1) + 1
      else byKey.set(key, { key, finding: f, on: !allow.has(key), count: 1 })
    }
    return [...byKey.values()]
  }, [all, allow])

  // Masking uses the committed vault as a base so numbering stays stable while typing.
  const { masked, vault } = useMemo(() => {
    const v = Vault.from(committed)
    return { masked: maskText(dText, active, mode, v), vault: v }
  }, [dText, active, mode, committed])

  const restored = useMemo(() => unmaskText(reply, vault), [reply, vault])
  const reversible = MASK_MODES.find((m) => m.id === mode)!.reversible

  const commit = () => {
    setCommitted(vault.entries)
    try {
      sessionStorage.setItem(VAULT_KEY, JSON.stringify(vault.entries))
    } catch {
      /* ignore */
    }
  }
  const burn = () => {
    setCommitted([])
    sessionStorage.removeItem(VAULT_KEY)
    setReply('')
  }

  const [copied, copy] = useCopy()
  const [copiedBack, copyBack] = useCopy()

  const toggle = (r: Row, on: boolean) => {
    const next = new Set(allow)
    if (on) next.delete(r.key)
    else next.add(r.key)
    setAllow(next)
  }

  const openChat = async (c: (typeof CHATS)[number]) => {
    commit()
    await copy(masked.text)
    const url = masked.text.length < 6000 ? c.url(masked.text) : c.url('')
    window.open(url, '_blank', 'noopener')
  }

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-20 pt-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[46px] leading-none">Prompt shield</h1>
          <p className="mt-2 max-w-xl text-[15px] text-ink-2">Paste what you're about to send a chatbot. Send the safe version, then paste the reply back to get your real details restored, all on this device.</p>
        </div>
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <Segmented label="Masking style" value={mode} onChange={setMode} options={MASK_MODES.map((m) => ({ id: m.id, label: m.label }))} />
          <p className="text-[12.5px] text-mute">{MASK_MODES.find((m) => m.id === mode)!.hint}</p>
        </div>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        {/* 1 · input */}
        <section className="sheet flex min-w-0 flex-col">
          <Head step="1" title="Your text">
            <div className="flex flex-wrap gap-1.5">
              {TEXT_SAMPLES.map((s) => (
                <button key={s.id} className="btn btn-ghost btn-sm" onClick={() => setText(s.text)}>
                  {s.label}
                </button>
              ))}
            </div>
          </Head>
          <Editor value={text} onChange={setText} findings={all} allow={allow} hover={hover} onSelection={setSelection} />
          <div className="flex min-h-12 flex-wrap items-center gap-2 border-t border-line px-4 py-2 text-[12.5px] text-mute">
            <span>
              {active.length} masked{all.length - active.length ? ` · ${all.length - active.length} let through` : ''}
            </span>
            {selection && (
              <button
                className="btn btn-ghost btn-sm ml-auto max-w-[60%]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (!watchlist.includes(selection)) setWatchlist([...watchlist, selection])
                  setSelection('')
                }}
              >
                <span className="truncate">Always mask “{selection}”</span>
              </button>
            )}
            {!selection && text && (
              <button className="ml-auto text-[12.5px] underline decoration-line-2 underline-offset-2 hover:text-ink" onClick={() => setText('')}>
                Clear
              </button>
            )}
          </div>
        </section>

        {/* 2 · masked */}
        <section className="sheet flex min-w-0 flex-col">
          <Head step="2" title="Safe to send">
            <button className="btn btn-ink btn-sm" disabled={!text} onClick={() => (commit(), copy(masked.text))}>
              {copied ? <I.check /> : <I.copy />} {copied ? 'Copied' : 'Copy'}
            </button>
          </Head>
          <pre className="editor scroll-thin h-[340px] overflow-y-auto text-ink" aria-label="Masked text">
            {renderSpans(masked.text, masked.spans, (t, s) => (
              <span key={s.start} className="rounded-[3px] px-[1px]" style={{ background: typeColor(s.type).bg, color: typeColor(s.type).ink }}>
                {t}
              </span>
            ))}
            {!text && <span className="text-faint">The masked version appears here.</span>}
          </pre>
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
            <span className="text-[12.5px] text-mute">Copy &amp; open</span>
            {CHATS.map((c) => (
              <button key={c.id} className="btn btn-ghost btn-sm" disabled={!text} onClick={() => openChat(c)}>
                {c.label} <I.external size={13} />
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
        {/* findings */}
        <section className="sheet min-w-0 p-4 sm:p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-[15px] font-semibold">What Veil found</h3>
            <span className="text-[12.5px] text-mute">Switch off anything that's fine to share</span>
          </div>
          <Insights findings={active} />
          <div className={active.length ? 'mt-4' : ''}>
            <FindingList rows={rows} onToggle={toggle} hover={hover} setHover={setHover} empty="Nothing personal found yet. Paste some text or try a sample." />
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <AiToggle />
          </div>
          <Watchlist items={watchlist} onChange={setWatchlist} />
        </section>

        {/* 3 · restore */}
        <section className="sheet flex min-w-0 flex-col">
          <Head step="3" title="Paste the reply">
            {reply ? (
              <span className="text-[12.5px] text-mute">{restored.restored} restored</span>
            ) : (
              <button className="btn btn-ghost btn-sm" disabled={!reversible || !vault.entries.length} onClick={() => (commit(), setReply(exampleReply(vault.entries)))}>
                Use an example reply
              </button>
            )}
          </Head>
          {!reversible && (
            <p className="mx-4 mt-3 rounded-md bg-paper px-3 py-2 text-[12.5px] text-ink-2">
              {MASK_MODES.find((m) => m.id === mode)!.label} is one-way. Switch to Placeholders or Look-alikes to restore replies.
            </p>
          )}
          <textarea
            className="editor scroll-thin h-[140px] resize-none border-b border-line bg-transparent outline-none placeholder:text-faint"
            placeholder="Paste the chatbot's answer here…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            aria-label="Chatbot reply"
          />
          <pre className="editor scroll-thin min-h-[150px] flex-1 overflow-y-auto text-ink" aria-label="Restored reply">
            {reply ? (
              renderSpans(restored.text, restored.spans, (t, s) => (
                <span key={s.start} className="rounded-[3px] bg-safe-soft px-[1px] text-safe">
                  {t}
                </span>
              ))
            ) : (
              <span className="text-faint">Your restored answer appears here.</span>
            )}
          </pre>
          {restored.unknown.length > 0 && (
            <p className="mx-4 mb-2 text-[12.5px] text-stamp">Not in this session's vault: {restored.unknown.slice(0, 4).join(', ')}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
            <button className="btn btn-ink btn-sm" disabled={!reply} onClick={() => copyBack(restored.text)}>
              {copiedBack ? <I.check /> : <I.copy />} {copiedBack ? 'Copied' : 'Copy restored'}
            </button>
            <VaultPeek entries={vault.entries} onBurn={burn} />
          </div>
        </section>
      </div>
    </div>
  )
}

/** A stand-in chatbot answer built from this session's placeholders, so the restore step can be tried without leaving the page. */
function exampleReply(entries: VaultEntry[]): string {
  const first = (t: EntityType) => entries.find((e) => e.type === t)?.replacement
  const name = first('PERSON')
  const lines: string[] = [name ? `Hi **${name}**, happy to help. Here's what to keep ready:` : "Happy to help. Here's what to keep ready:", '']
  const seen = new Set<EntityType>()
  for (const e of entries) {
    if (seen.has(e.type) || e.type === 'PERSON') continue
    seen.add(e.type)
    const r = e.replacement
    const say: Partial<Record<EntityType, string>> = {
      PAN: `Your PAN card (${r}). Lenders use it to pull your credit report.`,
      AADHAAR: `Aadhaar ${r} for eKYC. Share the masked version where you can.`,
      BANK_ACCOUNT: `Six months of statements for account ${r}.`,
      IFSC: `The branch IFSC (${r}) for the disbursal mandate.`,
      PHONE: `Keep ${r} reachable. The lender will call to verify.`,
      EMAIL: `Watch ${r} for the sanction letter.`,
      DOB: `Your date of birth (${r}) must match across PAN and Aadhaar.`,
      SECRET: `Rotate ${r} right away and load it from an environment variable.`,
      OTP: `Never read out an OTP like ${r}. Banks don't ask for it.`,
      CARD: `Block the card ${r} from your banking app.`,
      UPI: `Refunds never need you to share ${r} with a caller.`,
      ADDRESS: `Proof of address for ${r}, such as a utility bill.`,
    }
    lines.push(`- ${say[e.type] ?? `Double-check ${r}.`}`)
  }
  // chatbots often drop the brackets when repeating a placeholder
  if (name) lines.push('', `Good luck, ${/^\[.+\]$/.test(name) ? name.slice(1, -1) : name}!`)
  return lines.join('\n')
}

function Head({ step, title, children }: { step: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-13 flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
      <h2 className="flex items-center gap-2.5 text-[15px] font-semibold">
        <span className="grid size-5 place-items-center rounded-full bg-ink font-mono text-[10.5px] text-paper">{step}</span>
        {title}
      </h2>
      {children}
    </div>
  )
}

function renderSpans<S extends { start: number; end: number }>(text: string, spans: S[], wrap: (t: string, s: S) => ReactNode) {
  const out: ReactNode[] = []
  let cur = 0
  for (const s of spans) {
    if (s.start > cur) out.push(text.slice(cur, s.start))
    out.push(wrap(text.slice(s.start, s.end), s))
    cur = s.end
  }
  out.push(text.slice(cur))
  return out
}

/** Textarea with a pixel-aligned highlight layer behind it. */
function Editor({
  value,
  onChange,
  findings,
  allow,
  hover,
  onSelection,
}: {
  value: string
  onChange: (v: string) => void
  findings: Finding[]
  allow: Set<string>
  hover: string | null
  onSelection: (s: string) => void
}) {
  const ta = useRef<HTMLTextAreaElement>(null)
  const back = useRef<HTMLDivElement>(null)
  const sync = () => {
    if (back.current && ta.current) back.current.scrollTop = ta.current.scrollTop
  }
  useEffect(sync, [value])
  const readSel = () => {
    const el = ta.current
    if (!el) return
    const s = value.slice(el.selectionStart, el.selectionEnd).trim()
    onSelection(s.length >= 2 && s.length <= 80 && !s.includes('\n') ? s : '')
  }
  return (
    <div className="relative h-[340px]">
      <div ref={back} aria-hidden className="editor scroll-thin absolute inset-0 overflow-y-auto text-transparent" style={{ scrollbarGutter: 'stable', scrollbarColor: 'transparent transparent' }}>
        {renderSpans(value, findings, (t, f) => {
          const key = findingKey(f)
          const off = allow.has(key)
          const c = typeColor(f.type as EntityType)
          return (
            <mark
              key={f.id}
              style={
                off
                  ? { background: 'transparent', textDecoration: `underline dashed ${c.edge}`, textUnderlineOffset: 4 }
                  : { background: c.bg, boxShadow: hover === key ? `0 0 0 1.5px ${c.edge}` : undefined }
              }
            >
              {t}
            </mark>
          )
        })}
        {'\n '}
      </div>
      <textarea
        ref={ta}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={sync}
        onSelect={readSel}
        onKeyUp={readSel}
        spellCheck={false}
        placeholder="Paste an email, a question for ChatGPT, a config file…"
        aria-label="Text to check"
        className="editor scroll-thin absolute inset-0 h-full w-full resize-none overflow-y-auto bg-transparent text-ink caret-ink outline-none placeholder:text-faint"
        style={{ scrollbarGutter: 'stable' }}
      />
    </div>
  )
}

function Watchlist({ items, onChange }: { items: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const t = draft.trim()
    if (t && !items.includes(t)) onChange([...items, t])
    setDraft('')
  }
  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="text-[13.5px] font-semibold">Watchlist</p>
      <p className="mt-0.5 text-[12.5px] text-mute">Words Veil should always mask: your company, a client, a project codename. Saved on this device.</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {items.map((t) => (
          <span key={t} className="inline-flex h-7 items-center gap-1 rounded-md border border-line-2 bg-white pl-2.5 pr-1 text-[13px]">
            {t}
            <button className="grid size-5 place-items-center rounded text-mute hover:bg-line hover:text-ink" aria-label={`Remove ${t}`} onClick={() => onChange(items.filter((x) => x !== t))}>
              <I.x size={12} />
            </button>
          </span>
        ))}
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <input className="field h-7 w-44 text-[13px]" placeholder="Add a word…" value={draft} onChange={(e) => setDraft(e.target.value)} />
        </form>
      </div>
    </div>
  )
}

function VaultPeek({ entries, onBurn }: { entries: VaultEntry[]; onBurn: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="ml-auto flex items-center gap-2">
      <div className="relative">
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(!open)} aria-expanded={open}>
          <I.eye size={14} /> Vault · {entries.length}
        </button>
        {open && (
          <div className="sheet fade-in absolute bottom-10 right-0 z-20 w-[min(88vw,380px)] p-3 shadow-lift">
            <p className="label mb-2">Stays in this tab only</p>
            {entries.length ? (
              <ul className="scroll-thin max-h-64 space-y-1 overflow-y-auto">
                {entries.map((e, i) => (
                  <li key={i} className="grid grid-cols-[auto_1fr] items-baseline gap-2 font-mono text-[12px]">
                    <span className="rounded px-1" style={{ background: GROUP_COLOR[ENTITY[e.type].group].bg }}>
                      {e.replacement}
                    </span>
                    <span className="truncate text-ink-2" title={e.original}>
                      → {e.original}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-mute">Empty.</p>
            )}
          </div>
        )}
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onBurn} title="Forget every mapping in this session">
        <I.trash size={14} /> Burn
      </button>
    </div>
  )
}
