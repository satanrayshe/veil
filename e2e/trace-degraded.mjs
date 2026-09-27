// Export a stamped copy, degrade it like WhatsApp would, and trace it back.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const BASE = process.env.BASE || 'http://localhost:5173/'
mkdirSync('e2e/shots', { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
const page = await ctx.newPage()
await page.goto(BASE + '#/docs?sample=tenant')
await page.getByText('Hidden on this copy').waitFor({ timeout: 120000 })
await page.getByPlaceholder('e.g. Hotel Sunrise, Goa').fill('Hotel Sunrise, Goa')
await page.getByPlaceholder('e.g. check-in').fill('check-in')
const code = (await page.locator('p.font-mono.font-semibold').first().innerText()).trim()
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download safe copy/ }).click()])
await dl.saveAs('e2e/shots/clean.png')
const b64 = readFileSync('e2e/shots/clean.png').toString('base64')
for (const [scale, q] of [[1, 0.92], [0.6, 0.55], [0.45, 0.5]]) {
  const out = await page.evaluate(async ({ b64, scale, q }) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + b64
    await img.decode()
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * scale)
    c.height = Math.round(img.height * scale)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', q).split(',')[1]
  }, { b64, scale, q })
  const f = `e2e/shots/degraded-${scale}.jpg`
  writeFileSync(f, Buffer.from(out, 'base64'))
  await page.goto(BASE + '#/ledger')
  await page.waitForTimeout(300)
  await page.locator('input[type=file]').first().setInputFiles(f)
  await page.getByText(/You gave this copy to|No copy with|Couldn/).waitFor({ timeout: 90000 })
  const r = (await page.locator('[aria-live=polite]').innerText()).split('\n').slice(0, 2).join(' | ')
  console.log(`scale ${scale} q ${q} (${code}):`, r)
}
await browser.close()
