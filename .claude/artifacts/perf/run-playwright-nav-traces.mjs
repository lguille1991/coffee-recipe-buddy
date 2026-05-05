import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const OUT_DIR = path.resolve('.claude/artifacts/perf')
fs.mkdirSync(OUT_DIR, { recursive: true })

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

function now() { return Number(process.hrtime.bigint() / 1000000n) }

async function withTrace(context, name, fn) {
  const tracePath = path.join(OUT_DIR, `${name}.trace.zip`)
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false })
  try {
    const result = await fn()
    await context.tracing.stop({ path: tracePath })
    return { ...result, tracePath }
  } catch (error) {
    await context.tracing.stop({ path: tracePath })
    return { flow: name, status: 'error', error: String(error), tracePath }
  }
}

async function seedForAnalysis(page) {
  await page.addInitScript(([extractionPayload, recommendations]) => {
    sessionStorage.setItem('extractionResult', JSON.stringify(extractionPayload))
    sessionStorage.setItem('scanned_bag_image_data_url', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB')
    sessionStorage.setItem('methodRecommendations', JSON.stringify(recommendations))
  }, [extraction, recs])
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const results = []

  results.push(await withTrace(context, 'pw-flow-scan-to-analysis', async () => {
    await seedForAnalysis(page)
    await page.goto(`${BASE}/scan`, { waitUntil: 'networkidle' })
    const from = page.url()
    if (from.includes('/auth')) return { flow: '/scan -> /analysis', status: 'blocked', reason: 'redirected_to_auth', from }

    const t0 = now()
    await page.evaluate(() => window.location.assign('/analysis'))
    await page.waitForURL('**/analysis', { timeout: 30000 })
    await page.getByTestId('save-and-generate-recipe').waitFor({ timeout: 15000 })
    const t1 = now()
    return { flow: '/scan -> /analysis', status: 'ok', durationMs: t1 - t0, to: page.url() }
  }))

  results.push(await withTrace(context, 'pw-flow-analysis-to-recipe', async () => {
    await seedForAnalysis(page)
    await page.goto(`${BASE}/analysis`, { waitUntil: 'networkidle' })
    if (page.url().includes('/scan') || page.url().includes('/auth')) {
      return { flow: '/analysis -> /recipe', status: 'blocked', reason: 'redirected_before_analysis_ready', at: page.url() }
    }

    const t0 = now()
    await page.getByTestId('save-and-generate-recipe').click({ timeout: 15000 })
    await page.waitForURL('**/methods', { timeout: 30000 })
    const tMethods = now()
    const recButtons = page.locator('button[aria-pressed]')
    if (await recButtons.count() === 0) return { flow: '/analysis -> /recipe', status: 'blocked', reason: 'no_method_recommendations', at: page.url() }

    await recButtons.first().click()
    await page.getByRole('button', { name: /Continue with/i }).click({ timeout: 15000 })
    await page.waitForURL((url) => /\/recipe$|\/recipes\//.test(url.pathname), { timeout: 60000 })
    const t1 = now()
    return { flow: '/analysis -> /recipe', status: 'ok', durationToMethodsMs: tMethods - t0, durationTotalMs: t1 - t0, to: page.url() }
  }))

  results.push(await withTrace(context, 'pw-flow-recipes-to-detail', async () => {
    await page.goto(`${BASE}/recipes`, { waitUntil: 'networkidle' })
    const from = page.url()
    if (from.includes('/auth')) return { flow: '/recipes -> /recipes/[id]', status: 'blocked', reason: 'redirected_to_auth', from }

    const cards = page.locator('[data-testid^="open-recipe-"]')
    if (await cards.count() === 0) return { flow: '/recipes -> /recipes/[id]', status: 'blocked', reason: 'no_recipe_cards_found', from }

    const t0 = now()
    await cards.first().click()
    await page.waitForURL(/\/recipes\/[^/]+$/, { timeout: 30000 })
    const t1 = now()
    return { flow: '/recipes -> /recipes/[id]', status: 'ok', durationMs: t1 - t0, to: page.url() }
  }))

  const summaryPath = path.join(OUT_DIR, 'playwright-nav-trace-summary.json')
  fs.writeFileSync(summaryPath, JSON.stringify({ baseUrl: BASE, generatedAt: new Date().toISOString(), results }, null, 2))
  console.log(JSON.stringify({ summaryPath, results }, null, 2))

  await context.close(); await browser.close()
}

run().catch((err) => { console.error(err); process.exit(1) })
