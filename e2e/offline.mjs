import { chromium } from 'playwright'
const BASE = process.env.BASE || 'http://localhost:4173/'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
// First visit: just the home page, like a real user skimming.
await page.goto(BASE)
await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30000 })
await page.getByTitle(/Veil runs entirely/).getByText('Works offline').waitFor({ timeout: 20000 })
await page.waitForTimeout(6000) // idle warm-up of the OCR engine
const cached = await page.evaluate(async () => {
  const names = await caches.keys()
  const out = {}
  for (const n of names) out[n] = (await (await caches.open(n)).keys()).map((r) => r.url.split('/').slice(-2).join('/'))
  return out
})
console.log('CACHES', JSON.stringify(cached['veil-engines']))
await ctx.setOffline(true)
await page.goto(BASE + '#/docs?sample=tenant')
await page.reload()
await page.getByText('Hidden on this copy').waitFor({ timeout: 120000 })
console.log('OFFLINE OCR rows:', await page.locator('aside li').count())
await page.goto(BASE + '#/shield?sample=code')
await page.waitForTimeout(800)
console.log('OFFLINE shield:\n' + (await page.locator('pre[aria-label="Masked text"]').innerText()))
console.log('errors', errors.filter((e) => !/ERR_INTERNET_DISCONNECTED/.test(e)))
await browser.close()
