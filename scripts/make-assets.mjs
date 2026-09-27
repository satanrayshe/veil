// Generates demo documents and app icons. All personal data is fictional.
// Run: npm run assets
import { chromium } from 'playwright'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import piexif from 'piexifjs'
import { mkdirSync, writeFileSync } from 'node:fs'

mkdirSync('public/samples', { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })

// ------------------------------------------------------------------ icons
for (const size of [192, 512]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<body style="margin:0;background:#f3f0e8;display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${size * 0.62}px;height:${size * 0.25}px;background:#0b0b0a;border-radius:${size * 0.04}px"></div></body>`)
  await page.screenshot({ path: `public/icon-${size}.png` })
}

// ------------------------------------------------------------------ tenant form (as a phone photo)
const qr = await QRCode.toDataURL('TENANT|Rohan Mehta|DOB 14-08-1996|UID 4918 3527 4063|PAN BQRPM4821K|+91 98765 43210', { margin: 1, width: 360 })
const row = (k, v) => `<tr><td class="k">${k}</td><td class="v">${v}</td></tr>`
await page.setViewportSize({ width: 1500, height: 1960 })
await page.setContent(`<!doctype html><html><head><style>
  body{margin:0;width:1500px;height:1960px;background:radial-gradient(120% 90% at 30% 20%,#8a7760,#4a3c2e);display:grid;place-items:center;font-family:Arial,Helvetica,sans-serif}
  .paper{width:1240px;height:1754px;background:#fbf9f3;box-shadow:0 30px 60px rgba(0,0,0,.45);transform:rotate(-0.5deg);padding:72px 84px;box-sizing:border-box;color:#1d1b17;position:relative}
  h1{font-size:40px;letter-spacing:3px;margin:0 0 6px}
  .sub{font-size:21px;color:#555;margin:0 0 34px}
  table{border-collapse:collapse;width:100%}
  td{padding:15px 0;border-bottom:2px solid #d9d3c4;font-size:27px;vertical-align:top}
  td.k{width:330px;color:#555}
  td.v{font-weight:600;font-family:'Courier New',Courier,monospace;font-size:29px;color:#111}
  .photo{position:absolute;right:84px;top:64px;width:170px;height:210px;border:2px solid #999;background:#e8e4da;display:grid;place-items:center;color:#888;font-size:18px}
  .qr{position:absolute;right:84px;bottom:92px;width:240px}
  .sig{position:absolute;left:84px;bottom:110px;font-size:22px;color:#555}
  .sig svg{display:block;margin-bottom:8px}
  .stamp{position:absolute;left:84px;bottom:60px;font-size:18px;color:#777}
</style></head><body><div class="paper">
  <div class="photo">PHOTO</div>
  <h1>TENANT DETAILS FORM</h1>
  <p class="sub">For landlord and society records · Sample with fictional data</p>
  <table>
    ${row('Tenant name', 'Rohan Mehta')}
    ${row("Father's name", 'Suresh Mehta')}
    ${row('Date of birth', '14/08/1996')}
    ${row('Mobile', '+91 98765 43210')}
    ${row('Email', 'rohan.mehta@example.com')}
    ${row('Aadhaar No.', '4918 3527 4063')}
    ${row('PAN', 'BQRPM4821K')}
    ${row('Vehicle No.', 'KA 05 MX 2231')}
    ${row('Permanent address', '23, Shanti Kunj, Paldi,<br>Ahmedabad - 380007')}
    ${row('Current address', 'Flat 402, Lotus Residency,<br>HSR Layout, Bengaluru - 560102')}
    ${row('Employer', 'Infosys Ltd, Electronic City')}
    ${row('Bank A/c (deposit)', '50100234567810')}
    ${row('IFSC', 'HDFC0001234')}
    ${row('UPI ID', 'rohan.sample@okaxis')}
  </table>
  <div class="sig"><svg width="300" height="70" viewBox="0 0 300 70"><path d="M8 50 C 30 10, 50 10, 60 40 S 90 70, 110 30 S 150 5, 160 40 S 200 60, 220 25 S 270 35, 292 20" fill="none" stroke="#1d3a8a" stroke-width="3.2"/></svg>Signature of tenant</div>
  <div class="stamp">Received by: Sharma Estates, HSR Layout</div>
  <img class="qr" src="${qr}"/>
</div></body></html>`)
await page.waitForTimeout(150)
const jpg = await page.screenshot({ type: 'jpeg', quality: 90 })

// EXIF like a phone camera would write — including where the photo was taken.
const toDms = (deg) => {
  const d = Math.floor(deg)
  const mFloat = (deg - d) * 60
  const m = Math.floor(mFloat)
  const s = Math.round((mFloat - m) * 60 * 100)
  return [[d, 1], [m, 1], [s, 100]]
}
const exif = {
  '0th': { [piexif.ImageIFD.Make]: 'Samsung', [piexif.ImageIFD.Model]: 'Galaxy A54 5G', [piexif.ImageIFD.Software]: 'A546EXXU7CXK1' },
  Exif: { [piexif.ExifIFD.DateTimeOriginal]: '2026:09:21 19:42:10' },
  GPS: {
    [piexif.GPSIFD.GPSLatitudeRef]: 'N',
    [piexif.GPSIFD.GPSLatitude]: toDms(12.9121),
    [piexif.GPSIFD.GPSLongitudeRef]: 'E',
    [piexif.GPSIFD.GPSLongitude]: toDms(77.6446),
  },
}
const withExif = piexif.insert(piexif.dump(exif), 'data:image/jpeg;base64,' + jpg.toString('base64'))
writeFileSync('public/samples/tenant-form.jpg', Buffer.from(withExif.split(',')[1], 'base64'))

// ------------------------------------------------------------------ bank statement (digital PDF)
const pdf = await PDFDocument.create()
const pg = pdf.addPage([595.28, 841.89])
const f = await pdf.embedFont(StandardFonts.Helvetica)
const fb = await pdf.embedFont(StandardFonts.HelveticaBold)
const ink = rgb(0.1, 0.1, 0.09)
const mute = rgb(0.42, 0.4, 0.36)
let y = 790
const t = (s, x, size = 10, font = f, color = ink) => pg.drawText(s, { x, y, size, font, color })
pg.drawRectangle({ x: 0, y: 770, width: 595.28, height: 72, color: rgb(0.12, 0.23, 0.35) })
y = 808
t('Sahyadri Co-operative Bank Ltd.', 40, 17, fb, rgb(1, 1, 1))
y = 790
t('Statement of Account  ·  SAMPLE with fictional data', 40, 10, f, rgb(0.85, 0.88, 0.92))
y = 740
const kv = [
  ['Account holder', 'Ananya Krishnamurthy'],
  ['Address', 'Flat 12B, Palm Grove Apartments, Andheri West, Mumbai 400053'],
  ['A/c No.', '002301563487'],
  ['IFSC', 'SAHY0000417'],
  ['PAN', 'CKXPK7730L'],
  ['Mobile', '+91 91234 56780'],
  ['Email', 'ananya.k@example.com'],
  ['Period', '01 Aug 2026 to 31 Aug 2026'],
]
for (const [k, v] of kv) {
  t(k, 40, 10, f, mute)
  t(v, 150, 10.5, fb)
  y -= 18
}
y -= 14
const cols = [40, 110, 380, 450, 520]
const head = ['Date', 'Narration', 'Debit', 'Credit', 'Balance']
pg.drawLine({ start: { x: 40, y: y + 14 }, end: { x: 555, y: y + 14 }, thickness: 1, color: rgb(0.8, 0.78, 0.72) })
head.forEach((h, i) => t(h, cols[i], 9.5, fb, mute))
y -= 8
pg.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: rgb(0.8, 0.78, 0.72) })
y -= 16
const tx = [
  ['01-08-2026', 'Opening balance', '', '', '42,310.50'],
  ['02-08-2026', 'UPI/meera.iyer@ybl/Rent share Aug', '9,000.00', '', '33,310.50'],
  ['03-08-2026', 'UPI/freshmart.andheri@okicici/Groceries', '1,245.00', '', '32,065.50'],
  ['05-08-2026', 'NEFT/Zeta Suite Pvt Ltd/Stipend Aug', '', '35,000.00', '67,065.50'],
  ['09-08-2026', 'ATM WDL/Andheri W', '5,000.00', '', '62,065.50'],
  ['12-08-2026', 'UPI/kabir.rao@oksbi/Trip share', '3,400.00', '', '58,665.50'],
  ['18-08-2026', 'POS/Card xx1111/Amazon Pay India', '2,899.00', '', '55,766.50'],
  ['25-08-2026', 'IMPS/Rohan Mehta/Loan repayment', '', '5,000.00', '60,766.50'],
  ['31-08-2026', 'Closing balance', '', '', '60,766.50'],
]
for (const r of tx) {
  r.forEach((c, i) => c && t(c, cols[i], 9.5, i === 1 ? f : f))
  y -= 20
}
y -= 20
t('This is a computer-generated statement created to demonstrate Veil. No real person or bank.', 40, 8.5, f, mute)
writeFileSync('public/samples/bank-statement.pdf', await pdf.save())

// ------------------------------------------------------------------ social card
await page.setViewportSize({ width: 1200, height: 630 })
await page.setContent(`<!doctype html><html><head><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Inter+Tight:wght@400;600&display=swap" rel="stylesheet"><style>
  body{margin:0;width:1200px;height:630px;background:#f3f0e8;font-family:'Inter Tight',sans-serif;color:#16140f;display:flex;flex-direction:column;justify-content:center;padding:0 90px;box-sizing:border-box}
  .mark{display:flex;align-items:center;gap:14px;font-family:'Instrument Serif';font-size:44px}
  .mark span{display:inline-block;width:52px;height:26px;background:#0b0b0a;border-radius:3px}
  h1{font-family:'Instrument Serif';font-weight:400;font-size:96px;line-height:.98;margin:40px 0 0;letter-spacing:-1px}
  .bar{background:#0b0b0a;color:#0b0b0a}
  p{font-size:26px;color:#3b3830;margin:28px 0 0;max-width:900px}
</style></head><body><div class="mark"><span></span>Veil</div>
<h1>Share the document.<br>Not your <span class="bar">identity</span>.</h1>
<p>Masked Aadhaar &amp; PAN copies, purpose stamps with a leak ledger, and a privacy shield for AI prompts. 100% in your browser.</p></body></html>`)
await page.waitForTimeout(1200)
await page.screenshot({ path: 'public/og.png' })

await browser.close()
console.log('assets written')
