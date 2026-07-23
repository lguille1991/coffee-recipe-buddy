import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const port = Number(process.env.OCR_E2E_PORT ?? '3001')
const origin = `http://localhost:${port}`
const bagDirectory = process.env.OCR_BAG_DIR ?? '/Users/guillermoabrego/Desktop/my-coffee-recipes/coffee-bags'

const cases = [
  { file: 'gesha-natural-large.jpeg', name: 'Geisha · Loma Verde', process: 'unknown', roast: 'medium-light', altitude: '' },
  { file: 'bourbon-rosa-large.jpeg', name: 'Bourbon Rosa', process: 'washed', roast: 'unknown', altitude: '' },
  { file: 'jaho-brazil-washed.jpg', name: '', process: 'washed', roast: 'medium', altitude: '' },
  { file: 'pacamara-yellow-honey.JPG', name: 'Pacamara · Machuca', process: 'honey', roast: 'unknown', altitude: '1850' },
  { file: 'sl28-natural-large.jpeg', name: 'SL28 · La Divina · Roberto Ulloa', process: 'natural', roast: 'unknown', altitude: '1550' },
]

async function waitForServer(child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`E2E app stopped before it was ready (exit ${child.exitCode}).`)
    try {
      const response = await fetch(`${origin}/scan`)
      if (response.ok) return
    } catch {
      // The local server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('Timed out waiting for the local E2E app.')
}

async function stopServer(child) {
  if (child.exitCode !== null) return
  child.kill('SIGTERM')
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    // The process group can already be gone after a startup failure.
  }
  await new Promise(resolve => setTimeout(resolve, 250))
  if (child.exitCode === null) {
    child.kill('SIGKILL')
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch {
      // The process group has already exited.
    }
  }
}

function assertEqual(label, actual, expected) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
}

const app = spawn('npm', ['run', 'dev', '--', '--port', String(port)], {
  env: { ...process.env, OCR_E2E_TEST_MODE: '1', NEXT_PUBLIC_E2E_TEST_AUTH: '1' },
  stdio: 'inherit',
  detached: true,
})
let browser

try {
  await waitForServer(app)
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const unexpectedRequests = []
  const extractionRequests = []
  page.on('request', request => {
    const url = request.url()
    if (new URL(url).pathname === '/api/extract-bean') extractionRequests.push(url)
    if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return
    unexpectedRequests.push(url)
  })

  for (const testCase of cases) {
    const filePath = join(bagDirectory, testCase.file)
    await access(filePath)
    await page.goto(`${origin}/scan`)
    await page.locator('[data-testid="coffee-photo-file-input"]').setInputFiles(filePath)
    await page.waitForURL(`${origin}/analysis`, { timeout: 120_000 })

    assertEqual(`${testCase.file} coffee name`, await page.locator('[data-testid="coffee-name"]').inputValue(), testCase.name)
    assertEqual(`${testCase.file} process`, await page.locator('[data-testid="bean-process"]').inputValue(), testCase.process)
    assertEqual(`${testCase.file} roast`, await page.locator('[data-testid="roast-level-input"]').inputValue(), testCase.roast)
    assertEqual(`${testCase.file} altitude`, await page.locator('[data-testid="altitude"]').inputValue(), testCase.altitude)
  }

  if (extractionRequests.length) throw new Error(`OCR UI called the removed extraction endpoint: ${extractionRequests.join(', ')}`)
  if (unexpectedRequests.length) throw new Error(`OCR UI made unexpected non-local requests: ${unexpectedRequests.join(', ')}`)
  console.log(`Verified ${cases.length} coffee bags through the authenticated Scan → Analysis UI.`)
} finally {
  await browser?.close()
  await stopServer(app)
}
