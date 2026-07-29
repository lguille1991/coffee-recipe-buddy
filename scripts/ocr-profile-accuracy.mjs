import { spawn } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const port = Number(process.env.OCR_PROFILE_PORT ?? '3002')
const origin = `http://localhost:${port}`
const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(scriptDirectory, '..')
const profilesDirectory = join(repoRoot, 'profiles')
const bagsDirectory = join(repoRoot, 'bags')

const NOTE_QUALIFIER_START = /^(?:fragancia|aroma|resabio|final)\b/i
const NOTE_LEAD_IN = /^notas?\s+(?:a|de)\s+/i

const EXPECTED_NOTE_ALIASES = [
  ['strawberry fruit tart', 'strawberry fruit tart'],
  ['wildflower honey', 'wildflower honey'],
  ['concord grape', 'concord grape'],
  ['naranja dulce', 'naranja dulce'],
  ['blue berry', 'blue berry'],
  ['blueberry', 'blueberry'],
  ['frambuesa', 'frambuesa'],
  ['cardamomo', 'cardamomo'],
  ['mandarina', 'mandarina'],
  ['durazno', 'durazno'],
  ['chocolate', 'chocolate'],
  ['avellana', 'avellana'],
  ['caramelo', 'caramelo'],
  ['toronja', 'toronja'],
  ['te verde', 'te verde'],
  ['manzana', 'manzana'],
  ['naranja', 'naranja'],
  ['ciruela', 'ciruela'],
  ['cereza', 'cereza'],
  ['panela', 'panela'],
  ['toffee', 'toffee'],
  ['higo', 'higo'],
  ['pera', 'pera'],
  ['pina', 'piña'],
]

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function unquote(value) {
  const trimmed = value.trim()
  const match = trimmed.match(/^"(.*)"$/)
  return match ? match[1] : trimmed
}

function parseProfile(markdown) {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!frontmatter) throw new Error('Profile is missing a frontmatter block.')
  const coffee = {}
  let sourceImage = null
  let inCoffee = false
  for (const line of frontmatter[1].split(/\r?\n/)) {
    if (/^coffee:\s*$/.test(line)) {
      inCoffee = true
      continue
    }
    if (inCoffee && /^\S/.test(line)) inCoffee = false
    if (!inCoffee) {
      const topLevel = line.match(/^source_image:\s*(.+)$/)
      if (topLevel) sourceImage = unquote(topLevel[1])
      continue
    }
    const listItem = line.match(/^\s{4,}-\s+(.*)$/)
    if (listItem) continue
    const entry = line.match(/^\s{2}(\w+):\s*(.*)$/)
    if (!entry || entry[2] === '') continue
    coffee[entry[1]] = unquote(entry[2])
  }
  return { coffee, sourceImage, tastingNotes: parseTastingNotes(markdown) }
}

function parseTastingNotes(markdown) {
  const section = markdown.match(/### Tasting Notes\r?\n([\s\S]*?)(?:\r?\n#{1,3} |$)/)
  if (!section) return []
  const quoteLines = section[1].split(/\r?\n/).filter(line => line.trim().startsWith('>'))
  const originalLine = quoteLines.find(line => line.includes('**Original:**')) ?? quoteLines[0]
  if (!originalLine) return []
  const text = originalLine
    .replace(/^>\s*/, '')
    .replace(/\*\*(?:Original|English):\*\*/g, '')
    .trim()
  const notes = []
  for (const sentence of text.split(/\.\s+/)) {
    const cleanedSentence = sentence.replace(/\.$/, '').trim()
    if (!cleanedSentence || NOTE_QUALIFIER_START.test(cleanedSentence)) continue
    const body = cleanedSentence.replace(NOTE_LEAD_IN, '')
    for (const segment of body.split(',')) {
      for (const piece of segment.split(/\s+y\s+/i)) {
        const note = piece.trim()
        if (note) notes.push(note)
      }
    }
  }
  return notes.map(canonicalNote).filter(Boolean)
}

function canonicalNote(note) {
  const normalized = normalizeText(note).replace(/[.,;:]+$/, '')
  if (!normalized) return null
  for (const [alias, canonical] of EXPECTED_NOTE_ALIASES) {
    if (normalized === alias) return canonical
  }
  return normalized
}

function isNotPrinted(value) {
  return /^not printed$/i.test(value.trim())
}

function isUnknown(value) {
  return /^unknown\b/i.test(value.trim())
}

function originComponents(value) {
  return value
    .replace(/\([^)]*\)/g, '')
    .split(',')
    .map(component => normalizeText(component))
    .filter(Boolean)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findNoiseNotes(notes) {
  const normalized = notes.map(note => ({ raw: note, normalized: normalizeText(note) }))
  return normalized
    .filter(candidate => {
      if (candidate.normalized.length < 3) return true
      if (/^(?:resabio|final|fragancia|aroma|notas?)\b/.test(candidate.normalized)) return true
      return normalized.some(other => {
        if (other.normalized === candidate.normalized) return false
        if (other.normalized.length <= candidate.normalized.length) return false
        if (new RegExp(`(?:^|\\s)${escapeRegExp(candidate.normalized)}(?:\\s|$)`).test(other.normalized)) return true
        return candidate.normalized.length <= 8 && other.normalized.includes(candidate.normalized)
      })
    })
    .map(candidate => candidate.raw)
}

function buildExpectations(profile) {
  const { coffee, tastingNotes } = profile
  const expectations = []
  const scalarFields = [
    ['bean_name', coffee.bean_name],
    ['variety', coffee.variety],
    ['finca', coffee.farm],
    ['producer', coffee.producer],
  ]
  for (const [field, value] of scalarFields) {
    if (value === undefined) continue
    expectations.push({ field, kind: isNotPrinted(value) ? 'absent' : 'exact', expected: value })
  }
  expectations.push({
    field: 'process',
    kind: 'canonical',
    expected: isUnknown(coffee.process) ? 'unknown' : normalizeText(coffee.process),
  })
  expectations.push({
    field: 'roast_level',
    kind: 'canonical',
    expected: isUnknown(coffee.roast_level) ? 'unknown' : normalizeText(coffee.roast_level).replace('medium light', 'medium-light'),
  })
  expectations.push({
    field: 'altitude_masl',
    kind: isNotPrinted(coffee.elevation) ? 'absent' : 'altitude',
    expected: coffee.elevation,
  })
  expectations.push({ field: 'origin', kind: 'origin', expected: coffee.origin })
  expectations.push({ field: 'tasting_notes', kind: 'notes', expected: tastingNotes })
  return expectations
}

function compareField(expectation, bean) {
  const actual = bean?.[expectation.field]
  const missing = actual === undefined || actual === null || actual === ''
  if (expectation.kind === 'absent') {
    return missing
      ? { status: 'exact', detail: 'absent as expected' }
      : { status: 'unexpected', detail: `expected absent, got ${JSON.stringify(actual)}` }
  }
  if (expectation.kind === 'canonical') {
    if (missing) return { status: 'missing', detail: `expected ${expectation.expected}` }
    return normalizeText(actual) === expectation.expected
      ? { status: 'exact', detail: String(actual) }
      : { status: 'wrong', detail: `expected ${expectation.expected}, got ${JSON.stringify(actual)}` }
  }
  if (expectation.kind === 'exact') {
    if (missing) return { status: 'missing', detail: `expected ${expectation.expected}` }
    return normalizeText(actual) === normalizeText(expectation.expected)
      ? { status: 'exact', detail: String(actual) }
      : { status: 'wrong', detail: `expected ${expectation.expected}, got ${JSON.stringify(actual)}` }
  }
  if (expectation.kind === 'altitude') {
    const expectedAltitude = Number(expectation.expected.match(/\d[\d,]*/)?.[0].replace(',', ''))
    if (missing) return { status: 'missing', detail: `expected ${expectedAltitude}` }
    return Number(actual) === expectedAltitude
      ? { status: 'exact', detail: String(actual) }
      : { status: 'wrong', detail: `expected ${expectedAltitude}, got ${JSON.stringify(actual)}` }
  }
  if (expectation.kind === 'origin') {
    const components = originComponents(expectation.expected)
    if (missing) return { status: 'missing', detail: `expected ${components.join(', ')}` }
    const normalizedActual = normalizeText(actual).replace(/-/g, ', ')
    const absent = components.filter(component => !normalizedActual.includes(component))
    if (absent.length === 0) return { status: 'exact', detail: String(actual) }
    return absent.length === components.length
      ? { status: 'wrong', detail: `expected ${components.join(', ')}, got ${JSON.stringify(actual)}` }
      : { status: 'partial', detail: `missing components: ${absent.join(', ')} (got ${JSON.stringify(actual)})` }
  }
  if (expectation.kind === 'notes') {
    const actualNotes = Array.isArray(actual) ? actual : []
    const normalizedActual = actualNotes.map(normalizeText)
    const missingNotes = expectation.expected.filter(note => !normalizedActual.includes(normalizeText(note)))
    const noise = findNoiseNotes(actualNotes)
    if (missingNotes.length === 0 && noise.length === 0) {
      return { status: 'exact', detail: actualNotes.join(', ') }
    }
    const problems = []
    if (missingNotes.length) problems.push(`missing: ${missingNotes.join(', ')}`)
    if (noise.length) problems.push(`noise: ${noise.join(', ')}`)
    return { status: missingNotes.length >= expectation.expected.length / 2 ? 'wrong' : 'partial', detail: `${problems.join('; ')} (got ${JSON.stringify(actualNotes)})` }
  }
  return { status: 'wrong', detail: 'unsupported expectation kind' }
}

async function loadCases() {
  const files = (await readdir(profilesDirectory)).filter(file => file.endsWith('.md') && !file.startsWith('OCR Gap Analysis'))
  const cases = []
  for (const file of files.toSorted()) {
    const profile = parseProfile(await readFile(join(profilesDirectory, file), 'utf8'))
    if (!profile.sourceImage) throw new Error(`${file} does not declare source_image.`)
    cases.push({
      profile: file,
      bagFile: join(bagsDirectory, basename(profile.sourceImage)),
      expectations: buildExpectations(profile),
    })
  }
  const selection = process.env.OCR_PROFILE_CASE
  const selected = selection ? cases.filter(testCase => testCase.bagFile.includes(selection)) : cases
  if (selected.length === 0) {
    throw new Error(`OCR_PROFILE_CASE ${JSON.stringify(selection)} matched no bags. Available: ${cases.map(testCase => basename(testCase.bagFile)).join(', ')}`)
  }
  return selected
}

async function waitForServer(child) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Dev server stopped before it was ready (exit ${child.exitCode}).`)
    try {
      const response = await fetch(`${origin}/scan`)
      if (response.ok) return
    } catch {
      // The local server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('Timed out waiting for the dev server.')
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

const cases = await loadCases()

if (process.env.OCR_PROFILE_DRY_RUN === '1') {
  for (const testCase of cases) {
    console.log(`\n=== ${basename(testCase.bagFile)} (${testCase.profile}) ===`)
    for (const expectation of testCase.expectations) {
      console.log(`  ${expectation.field.padEnd(14)} ${expectation.kind.padEnd(10)} ${JSON.stringify(expectation.expected)}`)
    }
  }
  process.exit(0)
}

const app = spawn('npm', ['run', 'dev', '--', '--port', String(port)], {
  env: { ...process.env, OCR_E2E_TEST_MODE: '1', NEXT_PUBLIC_E2E_TEST_AUTH: '1' },
  stdio: 'inherit',
  detached: true,
})
let browser
let exactChecks = 0
let totalChecks = 0
const failures = []

try {
  await waitForServer(app)
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  for (const testCase of cases) {
    const bagName = basename(testCase.bagFile)
    console.log(`\n=== ${bagName} (${testCase.profile}) ===`)
    let bean = null
    try {
      await page.goto(`${origin}/scan`)
      await page.locator('[data-testid="coffee-photo-file-input"]').setInputFiles(testCase.bagFile)
      await page.waitForURL(`${origin}/analysis`, { timeout: 240_000 })
      const extraction = await page.evaluate(() => {
        const stored = sessionStorage.getItem('extractionResult')
        return stored ? JSON.parse(stored) : null
      })
      bean = extraction?.bean
      console.log(`extracted: ${JSON.stringify(bean)}`)
      if (process.env.OCR_PROFILE_DEBUG_DIR) {
        const blocks = await page.evaluate(() => sessionStorage.getItem('ocrDebugBlocks'))
        const { mkdir, writeFile } = await import('node:fs/promises')
        await mkdir(process.env.OCR_PROFILE_DEBUG_DIR, { recursive: true })
        await writeFile(join(process.env.OCR_PROFILE_DEBUG_DIR, `${bagName}.blocks.json`), blocks ?? '[]')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`${bagName}: OCR run failed: ${message}`)
      console.error(`${bagName}: OCR run failed: ${message}`)
      totalChecks += testCase.expectations.length
      continue
    }
    for (const expectation of testCase.expectations) {
      totalChecks += 1
      const result = compareField(expectation, bean)
      if (result.status === 'exact') exactChecks += 1
      else failures.push(`${bagName} ${expectation.field}: [${result.status}] ${result.detail}`)
      console.log(`  ${expectation.field.padEnd(14)} ${result.status.toUpperCase().padEnd(11)} ${result.detail}`)
    }
  }
} finally {
  await browser?.close()
  await stopServer(app)
}

const accuracy = totalChecks === 0 ? 0 : (exactChecks / totalChecks) * 100
console.log(`\n=== Accuracy: ${exactChecks}/${totalChecks} checks exact (${accuracy.toFixed(1)}%) across ${cases.length} bags ===`)
if (failures.length) {
  console.error(`\nFailing checks:\n${failures.map(failure => `  - ${failure}`).join('\n')}`)
  process.exit(1)
}
console.log('All in-scope fields match their profiles.')
