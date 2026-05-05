import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const OUT_DIR = path.resolve('.claude/artifacts/perf')
const STORAGE_STATE = path.resolve('.claude/artifacts/perf/auth-state.json')

const extraction = { bean: { bean_name: 'Trace Bean', roaster: 'Trace Roaster', variety: null, finca: null, producer: null, process: 'washed', origin: 'Ethiopia', altitude_masl: 1800, roast_level: 'light', tasting_notes: ['berry'], roast_date: null }, confidence: { origin: 0.8, roast_level: 0.8, process: 0.8, altitude_masl: 0.8 } }
const recs = [
  { method: 'v60', displayName: 'V60', rank: 1, score: 0.9, rationale: 'Balanced extraction', reasonBadges: ['clarity'], confidence: 'high', confidenceNote: 'Synthetic trace seed.' },
  { method: 'origami', displayName: 'Origami', rank: 2, score: 0.8, rationale: 'Good balance', reasonBadges: ['sweetness'], confidence: 'high', confidenceNote: 'Synthetic trace seed.' },
  { method: 'kalita_wave', displayName: 'Kalita Wave', rank: 3, score: 0.7, rationale: 'Forgiving flow', reasonBadges: ['forgiving'], confidence: 'medium', confidenceNote: 'Synthetic trace seed.' },
]

const now = () => Date.now()

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ storageState: STORAGE_STATE })
  const page = await context.newPage()

  const inFlight = new Map()
  const api = []

  page.on('request', (req) => {
    if (!req.url().includes('/api/')) return
    inFlight.set(req, now())
  })
  page.on('response', (res) => {
    const req = res.request()
    if (!req.url().includes('/api/')) return
    const start = inFlight.get(req)
    api.push({ url: req.url(), method: req.method(), status: res.status(), durationMs: start ? now() - start : null })
    inFlight.delete(req)
  })

  await page.addInitScript(([extractionPayload, recommendations]) => {
    sessionStorage.setItem('extractionResult', JSON.stringify(extractionPayload))
    sessionStorage.setItem('scanned_bag_image_data_url', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB')
    sessionStorage.setItem('methodRecommendations', JSON.stringify(recommendations))
  }, [extraction, recs])

  await page.goto(`${BASE}/analysis`, { waitUntil: 'networkidle' })
  const t0 = now()

  await page.getByTestId('save-and-generate-recipe').click({ timeout: 15000 })

  const duplicateBtn = page.getByRole('button', { name: /Use Existing/i })
  const methodsUrlPromise = page.waitForURL('**/methods', { timeout: 30000 }).then(() => 'methods').catch(() => null)
  const duplicatePromise = duplicateBtn.waitFor({ timeout: 30000 }).then(() => 'duplicate').catch(() => null)
  const firstHop = await Promise.race([methodsUrlPromise, duplicatePromise])

  if (firstHop === 'duplicate') {
    await duplicateBtn.click()
    await page.waitForURL('**/methods', { timeout: 30000 })
  } else if (firstHop !== 'methods') {
    throw new Error(`Did not reach methods. Current URL: ${page.url()}`)
  }

  const tMethods = now()

  await page.locator('button[aria-pressed]').first().click()
  const tContinueClick = now()
  await page.getByRole('button', { name: /Continue with/i }).click({ timeout: 15000 })
  await page.waitForURL((url) => /\/recipe$|\/recipes\//.test(url.pathname), { timeout: 60000 })
  const tRecipe = now()

  const out = {
    generatedAt: new Date().toISOString(),
    totalMs: tRecipe - t0,
    analysisToMethodsMs: tMethods - t0,
    methodsSelectionToRecipeMs: tRecipe - tContinueClick,
    finalUrl: page.url(),
    api,
  }

  const outPath = path.join(OUT_DIR, 'analysis-to-recipe-network-breakdown.json')
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ outPath, out }, null, 2))

  await context.close(); await browser.close()
}

run().catch((e)=>{console.error(e);process.exit(1)})
