import { go } from '../router'
import { I } from '../ui/kit'

const CATCHES: [string, string][] = [
  ['Aadhaar & VID', 'Verhoeff checksum — the algorithm UIDAI uses — so random 12-digit numbers are left alone'],
  ['PAN', 'Structure plus the holder-type letter (P individual, C company, H HUF…)'],
  ['GSTIN', 'State code, embedded PAN and the mod-36 check character'],
  ['Cards & CVV', 'Luhn checksum and card network: RuPay, Visa, Mastercard, Amex'],
  ['Bank account & IFSC', 'Account keywords nearby; IFSC matched to 42 banks'],
  ['UPI IDs', '75 bank handles — @okaxis, @ybl, @paytm, @oksbi…'],
  ['Phone & email', 'Indian mobiles written any way (+91, 0-prefixed, spaced), plus international'],
  ['Passport, voter ID, DL, vehicle', 'Indian formats, confirmed by the words around them'],
  ['OTPs & passwords', '“Your OTP is 482913”, “password: …”, key = value in configs'],
  ['API keys & secrets', '22 formats — OpenAI, Anthropic, GitHub, AWS, Google, Stripe, Razorpay, JWTs, private keys, database URLs'],
  ['Names, addresses, birth dates', 'Context cues, a 660-name dictionary, and an optional on-device AI model'],
  ['Aadhaar QR codes', 'Located in the image and blacked out — the QR holds your name, DOB and address'],
]

export default function Home() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
      {/* Hero */}
      <section className="grid items-center gap-10 pb-16 pt-12 md:grid-cols-[1.15fr_1fr] md:pt-20">
        <div>
          <h1 className="font-serif text-[clamp(44px,7.4vw,88px)] leading-[0.98] tracking-[-0.015em] text-ink">
            Share the document.
            <br />
            Not your <span className="bar">identity</span>.
          </h1>
          <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-ink-2">
            Hotels, landlords, colleges and SIM shops all want a copy of your Aadhaar. Chatbots want your whole story. Veil hides the numbers that matter, stamps each copy with who it's for, and keeps
            your details out of AI prompts. It all happens inside your browser.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button className="btn btn-ink h-11 px-5" onClick={() => go('docs')}>
              Make a safe ID copy <I.arrow />
            </button>
            <button className="btn btn-ghost h-11 px-5" onClick={() => go('shield')}>
              Shield an AI prompt
            </button>
          </div>
          <p className="mt-5 text-[13px] text-mute">
            No sign-up · nothing uploaded · works offline once loaded ·{' '}
            <a className="underline decoration-line-2 underline-offset-2 hover:text-ink" href={`${import.meta.env.BASE_URL}demo.mp4`} target="_blank" rel="noreferrer">
              watch the 1-minute demo
            </a>
          </p>
        </div>
        <SampleCopy />
      </section>

      {/* Tools */}
      <section className="grid gap-5 border-t border-line py-14 md:grid-cols-2">
        <article className="sheet flex flex-col p-6 sm:p-7">
          <h2 className="font-serif text-[34px] leading-none">Safe ID copy</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">Drop a photo or PDF of any ID, form or statement. Get back a copy that's only good for the one thing you're sharing it for.</p>
          <ul className="mt-5 space-y-2.5 text-[14.5px] text-ink-2">
            <Li>Aadhaar masked the way UIDAI does it: only the last 4 digits stay visible</Li>
            <Li>A stamp saying who the copy is for, why, and when, with a reference you can trace</Li>
            <Li>GPS location and camera details removed from photos</Li>
            <Li>A flattened file with no hidden text left under the black boxes</Li>
          </ul>
          <div className="mt-auto flex flex-wrap gap-2 pt-7">
            <button className="btn btn-ink" onClick={() => go('docs')}>
              Open <I.arrow />
            </button>
            <button className="btn btn-ghost" onClick={() => go('docs', 'tenant')}>
              Try a sample form
            </button>
          </div>
        </article>

        <article className="sheet flex flex-col p-6 sm:p-7">
          <h2 className="font-serif text-[34px] leading-none">Prompt shield</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">Mask, ask, unmask. Get help from ChatGPT, Gemini or Claude without handing over your name, IDs or API keys.</p>
          <div className="mt-5 overflow-hidden rounded-lg border border-line bg-white font-mono text-[12.5px] leading-[1.7]">
            <div className="border-b border-line px-4 py-2.5 text-ink-2">
              I'm <Hl>Priya Nair</Hl>, PAN <Hl>BQRPN4821K</Hl>. Should I file ITR-1?
            </div>
            <div className="border-b border-line bg-paper/60 px-4 py-2.5 text-ink">I'm [PERSON_1], PAN [PAN_1]. Should I file ITR-1?</div>
            <div className="px-4 py-2.5 text-ink-2">
              Yes, <span className="rounded bg-safe-soft px-0.5 text-safe">Priya Nair</span>. With salary income, ITR-1 fits…
            </div>
          </div>
          <div className="mt-auto flex flex-wrap gap-2 pt-7">
            <button className="btn btn-ink" onClick={() => go('shield')}>
              Open <I.arrow />
            </button>
            <button className="btn btn-ghost" onClick={() => go('shield', 'loan')}>
              Try a sample prompt
            </button>
          </div>
        </article>
      </section>

      {/* What it catches */}
      <section className="grid gap-8 border-t border-line py-14 md:grid-cols-[1fr_2fr]">
        <div>
          <h2 className="font-serif text-[40px] leading-[1.02]">Checks, not guesses</h2>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-ink-2">
            Most identifiers carry their own proof. Veil verifies it, so an order number doesn't get mistaken for your Aadhaar and your Aadhaar doesn't slip through.
          </p>
        </div>
        <dl className="grid gap-x-8 sm:grid-cols-2">
          {CATCHES.map(([k, v]) => (
            <div key={k} className="border-t border-line py-3.5">
              <dt className="text-[14.5px] font-semibold text-ink">{k}</dt>
              <dd className="mt-1 text-[13.5px] leading-snug text-mute">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Private by construction */}
      <section className="border-t border-line py-14">
        <h2 className="max-w-2xl font-serif text-[40px] leading-[1.02]">Private because there's nowhere to send it</h2>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          <Point title="No server">Veil is a static page. Text recognition, detection and the optional AI model all run in your browser tab. There is no backend that could receive a file.</Point>
          <Point title="Works offline">After the first visit Veil keeps a copy of itself. Switch off Wi-Fi and it keeps working, which is the simplest proof that nothing leaves your device.</Point>
          <Point title="Real redaction">
            Exports are redrawn from pixels, so there's no text layer under the boxes and no photo metadata. Veil has no blur option because blurred text can often be recovered.
          </Point>
        </div>
        <p className="mt-12 max-w-3xl border-l-2 border-stamp pl-4 text-[15px] leading-relaxed text-ink-2">
          India's Digital Personal Data Protection Act, 2023 is built on collecting only what a purpose needs. Veil puts that into practice on your side, for the documents you hand out every week.
        </p>
      </section>
    </div>
  )
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden className="mt-[0.55em] h-[3px] w-3 flex-none bg-ink" />
      <span>{children}</span>
    </li>
  )
}

function Hl({ children }: { children: React.ReactNode }) {
  return <span className="rounded-[3px] bg-[rgb(232_176_42/0.3)] px-0.5">{children}</span>
}

function Point({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[16px] font-semibold">{title}</h3>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{children}</p>
    </div>
  )
}

/** The output of the Safe ID copy tool, drawn in HTML: what a shared copy looks like. */
function SampleCopy() {
  const Bar = ({ w }: { w: string }) => <span className="inline-block h-[1.05em] translate-y-[0.18em] rounded-[1px] bg-bar" style={{ width: w }} />
  return (
    <figure className="relative mx-auto w-full max-w-[460px] select-none" aria-label="Example of a copy produced by Veil">
      <div className="sheet relative overflow-hidden bg-white shadow-lift" style={{ transform: 'rotate(1.2deg)' }}>
        <div className="px-6 pb-4 pt-5">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-2">Tenant details form</p>
            <p className="font-mono text-[10px] text-faint">Sample</p>
          </div>
          <div className="mt-4 space-y-2.5 font-mono text-[12.5px] text-ink">
            <p>
              <span className="text-mute">Name ........ </span>Rohan Mehta
            </p>
            <p>
              <span className="text-mute">Aadhaar ..... </span>
              <Bar w="4.2ch" /> <Bar w="4.2ch" /> 4063
            </p>
            <p>
              <span className="text-mute">PAN ......... </span>
              <Bar w="7.4ch" />
              21K
            </p>
            <p>
              <span className="text-mute">Mobile ...... </span>
              <Bar w="11ch" />
            </p>
            <p>
              <span className="text-mute">Bank a/c .... </span>
              <Bar w="10ch" /> 7810
            </p>
            <p>
              <span className="text-mute">Address ..... </span>Flat 402, Lotus Residency
            </p>
          </div>
          <div className="mt-4 flex justify-end">
            <span className="grid size-14 place-items-center rounded-[3px] bg-bar font-mono text-[9px] font-semibold text-paper">QR</span>
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-center gap-7 overflow-hidden" style={{ transform: 'rotate(-24deg) scale(1.5)' }}>
          {[0, 1, 2, 3].map((i) => (
            <p key={i} className="whitespace-nowrap text-[15px] font-semibold tracking-wide text-stamp/[0.16]" style={{ marginLeft: i % 2 ? '-4rem' : '0' }}>
              RENTAL VERIFICATION ONLY · SHARMA ESTATES · 27 SEP 2026 · VEIL-K7M3RX · RENTAL VERIFICATION ONLY
            </p>
          ))}
        </div>
        <div className="relative border-t-2 border-stamp bg-white px-4 py-2 text-[10.5px] text-ink-2">
          Copy for Sharma Estates · rental verification only · 27 Sep 2026 · Ref VEIL-K7M3RX
        </div>
      </div>
      <figcaption className="mt-4 text-center text-[12.5px] text-mute">What a Veil copy looks like: masked, stamped, traceable.</figcaption>
    </figure>
  )
}
