import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 800 } })
const data = readFileSync('e2e/video/veil-demo.webm').toString('base64')
await p.setContent(`<body style="margin:0;background:#000"><video id=v muted style="width:1280px;height:800px" src="data:video/webm;base64,${data}"></video></body>`)
await p.waitForFunction(() => document.getElementById('v').readyState >= 1)
// webm from Playwright may report Infinity duration; seek far to force it
const dur = await p.evaluate(async () => { const v = document.getElementById('v'); if (!isFinite(v.duration)) { v.currentTime = 1e6; await new Promise(r => v.onseeked = r) } return v.duration })
console.log('duration', dur)
for (const t of [14, 24, 30, 36, 44]) {
  await p.evaluate(async (t) => { const v = document.getElementById('v'); v.currentTime = t; await new Promise(r => v.onseeked = r) }, t)
  await p.screenshot({ path: `e2e/video/frame-${t}.png` })
}
await b.close()
