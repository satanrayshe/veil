import { chromium } from 'playwright'
const BASE = process.env.BASE || 'http://localhost:5173/'
const OUT = process.env.OUT || 'e2e/shots'
import { mkdirSync } from 'node:fs'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()))

await page.goto(BASE)
await page.waitForTimeout(1800)
await page.screenshot({ path: `${OUT}/home.png`, fullPage: true })

await page.goto(BASE + '#/shield?sample=loan')
await page.waitForTimeout(800)
const masked = await page.locator('pre[aria-label="Masked text"]').innerText()
console.log('MASKED:\n' + masked)
await page.screenshot({ path: `${OUT}/shield.png`, fullPage: true })

await page.goto(BASE + '#/docs?sample=tenant')
const t0 = Date.now()
await page.getByText('Hidden on this copy').waitFor({ timeout: 120000 })
console.log('tenant processed in', Date.now() - t0, 'ms')
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/docs-tenant.png`, fullPage: true })
const text = await page.locator('details pre').innerText().catch(() => '')
console.log('OCR TEXT:\n' + text)
const rows = await page.locator('aside li').allInnerTexts()
console.log('ROWS:', rows.map((r) => r.replace(/\s+/g, ' ')).join('\n'))
console.log('ERRORS:', errors)
await browser.close()
