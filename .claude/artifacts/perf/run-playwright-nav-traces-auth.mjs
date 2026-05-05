import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const OUT_DIR = path.resolve('.claude/artifacts/perf')
const STORAGE_STATE = path.resolve('.claude/artifacts/perf/auth-state.json')

if (!fs.existsSync(STORAGE_STATE)) {
  throw new Error(`Missing storage state: ${STORAGE_STATE}`)
}

const extraction = {
  bean: {
    bean_name: 'Trace Bean', roaster: 'Trace Roaster', variety: null, finca: null, producer: null,
    process: 'washed', origin: 'Ethiopia', altitude_masl: 1800, roast_level: 'light', tasting_notes: ['berry'], roast_date: null,
  },
  confidence: { origin: 0.8, roast_level: 0.8, process: 0.8, altitude_masl: 0.8 },
}

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

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: STORAGE_STATE,
  })
  const page = await context.newPage()
  const results = []

  results.push(await withTrace(context, 'pw-flow-scan-to-analysis-auth', async () => {
    await page.goto(`${BASE}/scan`, { waitUntil: 'networkidle' })
    if (page.url().includes('/auth')) {
      return { flow: '/scan -> /analysis', status: 'blocked', reason: 'still_redirected_to_auth', from: page.url() }
    }

    const t0 = now()
    await page.evaluate((payload) => {
      sessionStorage.setItem('extractionResult', JSON.stringify(payload))
      sessionStorage.setItem('scanned_bag_image_data_url', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB')
      window.location.assign('/analysis')
    }, extraction)

    await page.waitForURL('**/analysis', { timeout: 30000 })
    await page.getByTestId('save-and-generate-recipe').waitFor({ timeout: 15000 })
    const t1 = now()
    return { flow: '/scan -> /analysis', status: 'ok', durationMs: t1 - t0, to: page.url() }
  }))

  results.push(await withTrace(context, 'pw-flow-recipes-to-detail-auth', async () => {
    await page.goto(`${BASE}/recipes`, { waitUntil: 'networkidle' })
    if (page.url().includes('/auth')) {
      return { flow: '/recipes -> /recipes/[id]', status: 'blocked', reason: 'still_redirected_to_auth', from: page.url() }
    }

    const cards = page.locator('[data-testid^="open-recipe-"]')
    const count = await cards.count()
    if (count === 0) {
      return { flow: '/recipes -> /recipes/[id]', status: 'blocked', reason: 'no_recipe_cards_found', from: page.url() }
    }

    const t0 = now()
    await cards.first().click()
    await page.waitForURL(/\/recipes\/[^/]+$/, { timeout: 30000 })
    const t1 = now()
    return { flow: '/recipes -> /recipes/[id]', status: 'ok', durationMs: t1 - t0, to: page.url() }
  }))

  const summaryPath = path.join(OUT_DIR, 'playwright-nav-trace-summary-auth.json')
  fs.writeFileSync(summaryPath, JSON.stringify({ baseUrl: BASE, generatedAt: new Date().toISOString(), storageState: STORAGE_STATE, results }, null, 2))
  console.log(JSON.stringify({ summaryPath, results }, null, 2))

  await context.close(); await browser.close()
}

run().catch((err) => { console.error(err); process.exit(1) })
