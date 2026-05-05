import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const OUT_DIR = path.resolve('.claude/artifacts/perf')
const STORAGE_STATE = path.resolve('.claude/artifacts/perf/auth-state.json')

if (!fs.existsSync(STORAGE_STATE)) throw new Error(`Missing storage state: ${STORAGE_STATE}`)

function now() { return Number(process.hrtime.bigint() / 1000000n) }

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: STORAGE_STATE })
  const page = await context.newPage()

  const tracePath = path.join(OUT_DIR, 'pw-flow-recipes-to-detail-auth-rerun.trace.zip')
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false })

  let result
  try {
    await page.goto(`${BASE}/recipes`, { waitUntil: 'networkidle' })

    if (page.url().includes('/auth')) {
      result = { flow: '/recipes -> /recipes/[id]', status: 'blocked', reason: 'redirected_to_auth', from: page.url() }
    } else {
      const cards = page.locator('[data-testid^="open-recipe-"]')
      const count = await cards.count()
      if (count === 0) {
        result = { flow: '/recipes -> /recipes/[id]', status: 'blocked', reason: 'no_recipe_cards_found', from: page.url() }
      } else {
        const firstId = await cards.first().getAttribute('data-testid')
        const t0 = now()
        await cards.first().click()
        await page.waitForURL(/\/recipes\/[^/]+$/, { timeout: 30000 })
        const t1 = now()
        result = {
          flow: '/recipes -> /recipes/[id]',
          status: 'ok',
          durationMs: t1 - t0,
          to: page.url(),
          firstCardTestId: firstId,
          cardCount: count,
        }
      }
    }
  } catch (error) {
    result = { flow: '/recipes -> /recipes/[id]', status: 'error', error: String(error) }
  }

  await context.tracing.stop({ path: tracePath })
  result.tracePath = tracePath

  const outPath = path.join(OUT_DIR, 'playwright-recipes-detail-rerun-summary.json')
  fs.writeFileSync(outPath, JSON.stringify({ baseUrl: BASE, generatedAt: new Date().toISOString(), result }, null, 2))
  console.log(JSON.stringify({ outPath, result }, null, 2))

  await context.close()
  await browser.close()
}

run().catch((err) => { console.error(err); process.exit(1) })
