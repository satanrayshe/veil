import { relaxedSimd, simd } from 'wasm-feature-detect'

/**
 * Once the service worker controls the page, fetch the OCR engine (the same
 * core variant Tesseract will pick on this device) and the demo files so the
 * service worker caches them. After this, Safe ID copy works with no network.
 */
export async function warmEngines() {
  if (!navigator.serviceWorker?.controller) return
  const base = new URL(import.meta.env.BASE_URL, document.baseURI).href
  const core = (await relaxedSimd())
    ? 'tesseract-core-relaxedsimd-lstm.wasm.js'
    : (await simd())
      ? 'tesseract-core-simd-lstm.wasm.js'
      : 'tesseract-core-lstm.wasm.js'
  const files = ['tesseract/worker.min.js', `tesseract/${core}`, 'tesseract/eng.traineddata.gz', 'samples/tenant-form.jpg', 'samples/bank-statement.pdf']
  await Promise.all(files.map((f) => fetch(base + f).catch(() => undefined)))
}
