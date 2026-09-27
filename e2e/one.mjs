import { chromium } from 'playwright'
const BASE = process.env.BASE || 'http://localhost:5173/'
const [route, out, sel] = process.argv.slice(2)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto(BASE + route)
if (route.includes('docs?')) await page.getByText('Hidden on this copy').waitFor({ timeout: 120000 })
await page.waitForTimeout(900)
if (sel) await page.locator(sel).first().screenshot({ path: out })
else await page.screenshot({ path: out, fullPage: true })
console.log('errors', errors)
await browser.close()
