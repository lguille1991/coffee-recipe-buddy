import { chromium } from 'playwright';
import fs from 'fs';

const out = '.claude/artifacts/perf/auth-state.json';
fs.mkdirSync('.claude/artifacts/perf', { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('http://localhost:3000/auth');
console.log('Log in manually, then press Enter here in terminal...');
process.stdin.resume();
await new Promise(resolve => process.stdin.once('data', resolve));

await context.storageState({ path: out });
await browser.close();
console.log(`Saved ${out}`);
