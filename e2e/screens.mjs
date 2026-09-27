// Captures the README / submission screenshots from a running build.
import { chromium } from 'playwright'
const BASE = process.env.BASE || 'http://localhost:4173/'
const OUT = 'docs/screens'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true })
const page = await ctx.newPage()

// 1. hero
await page.goto(BASE)
await page.waitForTimeout(2200)
await page.screenshot({ path: `${OUT}/1-home.png` })

// 2. safe ID copy — edit view with findings
await page.goto(BASE + '#/docs?sample=tenant')
await page.getByText('Hidden on this copy').waitFor({ timeout: 120000 })
await page.getByPlaceholder('e.g. Hotel Sunrise, Goa').fill('Sharma Estates')
await page.getByPlaceholder('e.g. check-in').fill('rental verification')
await page.setViewportSize({ width: 1440, height: 1180 })
await page.evaluate(() => window.scrollTo(0, 70))
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/2-safe-copy.png` })

// 3. preview of the stamped copy
await page.getByRole('radio', { name: 'Preview copy' }).click()
await page.waitForTimeout(700)
await page.screenshot({ path: `${OUT}/3-stamped-preview.png` })
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download safe copy/ }).click()])
const exported = `${OUT}/../exported.png`
await dl.saveAs(exported)

// 4. PDF statement
await page.setViewportSize({ width: 1440, height: 1000 })
await page.goto(BASE + '#/docs?sample=statement')
await page.getByText('Hidden on this copy').waitFor({ timeout: 120000 })
await page.evaluate(() => window.scrollTo(0, 70))
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/4-bank-statement.png` })

// 5. prompt shield with on-device AI and a restored reply
await page.setViewportSize({ width: 1440, height: 1320 })
await page.goto(BASE + '#/shield?sample=loan')
await page.waitForTimeout(600)
await page.getByRole('switch', { name: 'Enable on-device AI' }).click()
await page.getByText('Active. Runs in a background worker').waitFor({ timeout: 300000 })
await page.waitForTimeout(2500)
await page.getByRole('button', { name: 'Use an example reply' }).click()
await page.waitForTimeout(600)
await page.evaluate(() => window.scrollTo(0, 0))
await page.screenshot({ path: `${OUT}/5-prompt-shield.png` })

// 6. ledger trace of the exported copy
await page.setViewportSize({ width: 1440, height: 900 })
await page.goto(BASE + '#/ledger')
await page.locator('input[type=file]').first().setInputFiles(exported)
await page.getByText(/You gave this copy to/).waitFor({ timeout: 90000 })
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/6-ledger-trace.png` })

// mobile check
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const mp = await m.newPage()
await mp.goto(BASE)
await mp.waitForTimeout(2000)
await mp.screenshot({ path: `${OUT}/m-home.png` })
await mp.goto(BASE + '#/docs?sample=tenant')
await mp.getByText('Hidden on this copy').waitFor({ timeout: 120000 })
await mp.waitForTimeout(500)
await mp.screenshot({ path: `${OUT}/m-docs.png` })
await mp.goto(BASE + '#/shield')
await mp.waitForTimeout(800)
await mp.screenshot({ path: `${OUT}/m-shield.png` })
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
console.log('mobile horizontal overflow:', overflow)
await browser.close()
console.log('done')
