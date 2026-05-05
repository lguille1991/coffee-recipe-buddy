import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const OUT_DIR = path.resolve('.claude/artifacts/perf')
const STORAGE_STATE = path.resolve('.claude/artifacts/perf/auth-state.json')

const extraction = {
  bean: {
    bean_name: 'Trace Bean', roaster: 'Trace Roaster', variety: null, finca: null, producer: null,
    process: 'washed', origin: 'Ethiopia', altitude_masl: 1800, roast_level: 'light', tasting_notes: ['berry'], roast_date: null,
  },
  confidence: { origin: 0.8, roast_level: 0.8, process: 0.8, altitude_masl: 0.8 },
}

const recs = [
  { method: 'v60', displayName: 'V60', rank: 1, score: 0.9, rationale: 'Balanced extraction', reasonBadges: ['clarity'], confidence: 'high', confidenceNote: 'Synthetic trace seed.' },
  { method: 'origami', displayName: 'Origami', rank: 2, score: 0.8, rationale: 'Good balance', reasonBadges: ['sweetness'], confidence: 'high', confidenceNote: 'Synthetic trace seed.' },
  { method: 'kalita_wave', displayName: 'Kalita Wave', rank: 3, score: 0.7, rationale: 'Forgiving flow', reasonBadges: ['forgiving'], confidence: 'medium', confidenceNote: 'Synthetic trace seed.' },
]

const now = () => Number(process.hrtime.bigint() / 1000000n)

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: STORAGE_STATE })
  const page = await context.newPage()

  const apiTimings = []
  page.on('response', async (res) => {
    const url = res.url()
    if (!url.includes('/api/')) return
    const req = res.request()
    const timing = req.timing()
    const start = timing.startTime
    const end = timing.responseEnd
    const dur = (start > 0 && end > 0) ? end - start : null
    apiTimings.push({
      url,
      method: req.method(),
      status: res.status(),
      durationMs: dur,
    })
  })

  await page.addInitScript(([extractionPayload, recommendations]) => {
    sessionStorage.setItem('extractionResult', JSON.stringify(extractionPayload))
    sessionStorage.setItem('scanned_bag_image_data_url', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB')
    sessionStorage.setItem('methodRecommendations', JSON.stringify(recommendations))
  }, [extraction, recs])

  await page.goto(`${BASE}/analysis`, { waitUntil: 'networkidle' })
  const t0 = now()
  await page.getByTestId('save-and-generate-recipe').click({ timeout: 15000 })
  await page.waitForURL('**/methods', { timeout: 30000 })
  const tMethods = now()

  await page.locator('button[aria-pressed]').first().click()
  const tContinueClick = now()
  await page.getByRole('button', { name: /Continue with/i }).click({ timeout: 15000 })

  await page.waitForURL((url) => /\/recipe$|\/recipes\//.test(url.pathname), { timeout: 60000 })
  const tRecipe = now()

  const summary = {
    generatedAt: new Date().toISOString(),
    flow: '/analysis -> /recipe',
    totalMs: tRecipe - t0,
    analysisToMethodsMs: tMethods - t0,
    methodsSelectionToRecipeMs: tRecipe - tContinueClick,
    apiTimings,
    finalUrl: page.url(),
  }

  const outPath = path.join(OUT_DIR, 'analysis-to-recipe-breakdown.json')
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2))
  console.log(JSON.stringify({ outPath, summary }, null, 2))

  await context.close()
  await browser.close()
}

run().catch((e) => { console.error(e); process.exit(1) })
