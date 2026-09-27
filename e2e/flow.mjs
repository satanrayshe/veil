import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const BASE = process.env.BASE || 'http://localhost:5173/'
const OUT = process.env.OUT || 'e2e/shots'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()))

// ---- tenant: stamp, preview, export
await page.goto(BASE + '#/docs?sample=tenant')
await page.getByText('Hidden on this copy').waitFor({ timeout: 120000 })
const rows = await page.locator('aside li').allInnerTexts()
console.log('ROW TYPES:', rows.map((r) => r.split('\n')[0]).join(' | '))
await page.getByPlaceholder('e.g. Hotel Sunrise, Goa').fill('Sharma Estates')
await page.getByPlaceholder('e.g. check-in').fill('rental verification')
const code = (await page.locator('p.font-mono.font-semibold').first().innerText()).trim()
console.log('CODE', code)
await page.getByRole('radio', { name: 'Preview copy' }).click()
await page.waitForTimeout(600)
await page.locator('section.sheet').first().screenshot({ path: `${OUT}/docs-preview.png` })
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download safe copy/ }).click()])
const exported = `${OUT}/${dl.suggestedFilename()}`
await dl.saveAs(exported)
console.log('EXPORTED', exported)
await page.waitForTimeout(400)
console.log('TOAST', await page.getByRole('status').last().innerText().catch(() => '-'))

// ---- ledger: trace the exported copy
await page.goto(BASE + '#/ledger')
await page.waitForTimeout(500)
await page.locator('input[type=file]').first().setInputFiles(exported)
await page.getByText(/You gave this copy to|No copy with|Couldn/).waitFor({ timeout: 60000 })
console.log('TRACE:', (await page.locator('[aria-live=polite]').innerText()).replace(/\s+/g, ' '))
await page.screenshot({ path: `${OUT}/ledger.png`, fullPage: true })

// ---- bank statement PDF (text layer path)
await page.goto(BASE + '#/docs?sample=statement')
await page.getByText('Hidden on this copy').waitFor({ timeout: 120000 })
await page.waitForTimeout(400)
const rows2 = await page.locator('aside li').allInnerTexts()
console.log('PDF ROWS:', rows2.map((r) => r.replace(/\s+/g, ' ')).join('\n'))
await page.screenshot({ path: `${OUT}/docs-statement.png`, fullPage: true })
const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download safe copy/ }).click()])
await dl2.saveAs(`${OUT}/${dl2.suggestedFilename()}`)
console.log('PDF EXPORTED', dl2.suggestedFilename())
console.log('ERRORS:', errors)
await browser.close()
