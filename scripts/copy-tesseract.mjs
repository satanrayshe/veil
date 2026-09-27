// Copies the OCR engine into public/ so it is served from Veil's own origin
// (works offline, and document images never meet a third-party CDN).
import { cpSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const out = 'public/tesseract'
mkdirSync(out, { recursive: true })
const core = dirname(require.resolve('tesseract.js-core/package.json'))
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'])
  cpSync(join(core, f), join(out, f))
cpSync(join(dirname(require.resolve('tesseract.js/package.json')), 'dist/worker.min.js'), join(out, 'worker.min.js'))
const eng = join(dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int/eng.traineddata.gz')
if (!existsSync(eng)) throw new Error('eng traineddata missing')
cpSync(eng, join(out, 'eng.traineddata.gz'))
console.log('tesseract assets ready')
