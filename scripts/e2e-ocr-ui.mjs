import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const port = Number(process.env.OCR_E2E_PORT ?? '3001')
const origin = `http://localhost:${port}`
const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const fixtureRoot = join(scriptDirectory, '..', 'tests', 'fixtures')
const fixtureSetSelection = process.env.OCR_E2E_FIXTURE_SET ?? 'all'
const supportedFixtureSetSelections = new Set(['all', 'optimized', 'original'])

if (!process.env.OCR_BAG_DIR && !supportedFixtureSetSelections.has(fixtureSetSelection)) {
  throw new Error(
    `Unsupported OCR_E2E_FIXTURE_SET ${JSON.stringify(fixtureSetSelection)}. Expected one of: ${[...supportedFixtureSetSelections].join(', ')}.`,
  )
}

const fixtureSets = process.env.OCR_BAG_DIR
  ? [{ name: 'custom', directory: process.env.OCR_BAG_DIR }]
  : [
      { name: 'optimized', directory: join(fixtureRoot, 'coffee-bags') },
      { name: 'original', directory: join(fixtureRoot, 'coffee-bags-original') },
    ].filter(({ name }) => fixtureSetSelection === 'all' || fixtureSetSelection === name)

const cases = [
  {
    file: 'bourbon-rosa-large.jpg',
    name: 'Bourbon Rosa · Bella Vista · Familia Plazas',
    originIncludes: 'Acevedo-Huila',
    process: 'washed',
    roast: 'unknown',
    altitude: '1750',
    bean: { variety: 'Bourbon Rosa', finca: 'Bella Vista', producer: 'Familia Plazas' },
    notes: ['manzana', 'mandarina', 'panela'],
  },
  {
    file: 'gesha-natural-large.jpg',
    name: 'Geisha · Loma Verde · Esperanza Aguilar',
    originIncludes: 'El Salvador',
    process: 'natural',
    roast: 'medium-light',
    altitude: '1200',
    bean: { variety: 'Geisha', finca: 'Loma Verde', producer: 'Esperanza Aguilar' },
    notes: ['higo', 'durazno', 'chocolate'],
  },
  {
    file: 'jaho-brazil-washed.jpg',
    name: 'Minas',
    originIncludes: 'Brazil',
    process: 'washed',
    roast: 'medium',
    altitude: '',
    bean: { bean_name: 'Minas' },
    notes: ['concord grape', 'strawberry fruit tart', 'wildflower honey'],
  },
  {
    file: 'pacamara-natural.jpg',
    name: 'Pacamara · Las Ventanas · Yobani Ochoa',
    originIncludes: 'El Salvador',
    process: 'natural',
    roast: 'unknown',
    altitude: '1450',
    bean: { variety: 'Pacamara', finca: 'Las Ventanas', producer: 'Yobani Ochoa' },
    notes: ['avellana', 'chocolate', 'cereza', 'naranja', 'ciruela', 'blueberry', 'cardamomo'],
  },
  {
    file: 'pacas-natural.jpg',
    name: 'Pacas · El Roble · Saúl Gutierrez',
    originIncludes: 'El Salvador',
    process: 'natural',
    roast: 'unknown',
    altitude: '1800',
    bean: { variety: 'Pacas', finca: 'El Roble', producer: 'Saúl Gutierrez' },
    notes: ['piña', 'frambuesa', 'avellana', 'naranja dulce', 'blue berry', 'toffee'],
  },
  {
    file: 'sl28-natural-large.jpg',
    name: 'SL28 · La Divina · Roberto Ulloa',
    originIncludes: 'Apaneca, Ilamatepec, Santa Ana',
    process: 'natural',
    roast: 'unknown',
    altitude: '1550',
    bean: { variety: 'SL28', finca: 'La Divina', producer: 'Roberto Ulloa' },
    notes: ['toronja', 'pera', 'te verde', 'caramelo'],
  },
]
const selectedCases = process.env.OCR_E2E_CASE
  ? cases.filter(testCase => testCase.file.includes(process.env.OCR_E2E_CASE))
  : cases

if (selectedCases.length === 0) {
  throw new Error(
    `OCR_E2E_CASE ${JSON.stringify(process.env.OCR_E2E_CASE)} matched no coffee bags. Available files: ${cases.map(testCase => testCase.file).join(', ')}.`,
  )
}

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

function assertIncludes(label, actual, expected) {
  if (!actual.toLocaleLowerCase().includes(expected.toLocaleLowerCase())) {
    throw new Error(`${label}: expected ${JSON.stringify(actual)} to include ${JSON.stringify(expected)}`)
  }
}

function assertBeanFields(file, actual, expected) {
  for (const [field, value] of Object.entries(expected)) {
    assertEqual(`${file} extraction.${field}`, actual?.[field], value)
  }
}

function assertExtraction(file, actual, testCase) {
  assertBeanFields(file, actual, {
    ...testCase.bean,
    process: testCase.process,
    roast_level: testCase.roast,
  })
  assertIncludes(`${file} extraction.origin`, actual?.origin ?? '', testCase.originIncludes)
  assertEqual(
    `${file} extraction.altitude_masl`,
    actual?.altitude_masl === undefined ? '' : String(actual.altitude_masl),
    testCase.altitude,
  )
  const notes = Array.isArray(actual?.tasting_notes)
    ? actual.tasting_notes.join(' ').toLocaleLowerCase()
    : ''
  for (const note of testCase.notes) {
    assertIncludes(`${file} extraction.tasting_notes`, notes, note)
  }
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
  const failures = []
  page.on('request', request => {
    const url = request.url()
    if (new URL(url).pathname === '/api/extract-bean') extractionRequests.push(url)
    if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return
    unexpectedRequests.push(url)
  })

  for (const fixtureSet of fixtureSets) {
    for (const testCase of selectedCases) {
      const label = `${fixtureSet.name}/${testCase.file}`
      try {
        const filePath = join(fixtureSet.directory, testCase.file)
        await access(filePath)
        await page.goto(`${origin}/scan`)
        await page.locator('[data-testid="coffee-photo-file-input"]').setInputFiles(filePath)
        await page.waitForURL(`${origin}/analysis`, { timeout: 120_000 })

        const extraction = await page.evaluate(() => {
          const stored = sessionStorage.getItem('extractionResult')
          return stored ? JSON.parse(stored) : null
        })
        console.log(`${label}: ${JSON.stringify(extraction?.bean)}`)
        assertExtraction(label, extraction?.bean, testCase)
        assertEqual(`${label} coffee name`, await page.locator('[data-testid="coffee-name"]').inputValue(), testCase.name)
        assertIncludes(`${label} origin`, await page.locator('[data-testid="bean-origin"]').inputValue(), testCase.originIncludes)
        assertEqual(`${label} process`, await page.locator('[data-testid="bean-process"]').inputValue(), testCase.process)
        assertEqual(`${label} roast`, await page.locator('[data-testid="roast-level-input"]').inputValue(), testCase.roast)
        assertEqual(`${label} altitude`, await page.locator('[data-testid="altitude"]').inputValue(), testCase.altitude)
        const renderedNotes = await page.getByRole('heading', { name: 'Flavor Notes' }).locator('..').innerText()
        for (const note of testCase.notes) {
          assertIncludes(`${label} tasting notes`, renderedNotes, note)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        failures.push(`${label}: ${message}`)
        console.error(`${label}: FAILED: ${message}`)
      }
    }
  }

  if (extractionRequests.length) throw new Error(`OCR UI called the removed extraction endpoint: ${extractionRequests.join(', ')}`)
  if (unexpectedRequests.length) throw new Error(`OCR UI made unexpected non-local requests: ${unexpectedRequests.join(', ')}`)
  if (failures.length) throw new Error(`OCR UI failures:\n${failures.join('\n')}`)
  console.log(`Verified ${selectedCases.length * fixtureSets.length} coffee bags through the authenticated Scan → Analysis UI.`)
} finally {
  await browser?.close()
  await stopServer(app)
}
