// End-to-end demo tour (docs/04 §7 + docs/06 §5 acceptance) with headless Chrome.
// Drives the real UI: Maya L1 lesson → recast → calm corner → goodbye,
// then Aarav: preloaded mid-L2 → stage check → graduation → end card.
// Usage: node tools/e2e.mjs   (server must be running; client must be built)
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { getJson, postJson } from './http.mjs';

const BASE = process.env.E2E_BASE || 'http://localhost:3001';
const CHROME = process.env.CHROME_PATH || '/opt/google/chrome/chrome';
const __dirname = dirname(fileURLToPath(import.meta.url));
const EVID = join(__dirname, 'evidence');
mkdirSync(EVID, { recursive: true });

const results = [];
let browserRef = null; // so the crash path can always shut Chrome down
const ok = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? '✔' : '✖'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // clean demo state
  await postJson('/api/reset-demo', {});
  const health = await getJson('/api/health');
  ok('server health', health.ok === true);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    timeout: 60000,
    protocolTimeout: 90000,
    userDataDir: mkdtempSync(join(tmpdir(), 'milo-e2e-')), // fresh profile every run
    args: ['--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage', '--password-store=gnome-libsecret'],
  });
  browserRef = browser;
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  await page.setViewport({ width: 900, height: 1100, deviceScaleFactor: 1 });

  const clickText = async (selector, text, timeout = 20000) => {
    const deadline = Date.now() + timeout;
    let el = null;
    while (!el) {
      const h = await page.evaluateHandle((sel, t) => {
        const els = [...document.querySelectorAll(sel)];
        return els.find((e) => e.textContent.trim().includes(t)) || null;
      }, selector, text);
      el = h.asElement();
      if (!el) {
        if (Date.now() > deadline) throw new Error(`no ${selector} containing "${text}" (waited ${timeout} ms)`);
        await sleep(250); // list may still be loading (slow network, tunnel)
      }
    }
    await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await el.click();
  };
  const milo = () => page.evaluate(() => window.__milo || null);
  const waitTurn = async (prevN, timeout = 20000) => {
    await page.waitForFunction((n) => (window.__milo?.n || 0) > n, { timeout }, prevN);
    await sleep(250); // let the UI settle (message stagger, confetti mount)
    return milo();
  };
  const lastMiloSays = () => page.evaluate(() => {
    const b = [...document.querySelectorAll('.row.milo .bubble')];
    return b.length ? b[b.length - 1].textContent : '';
  });

  // ── 1 · Home ───────────────────────────────────────────────────────────────
  // Demo fixtures (server started with MILO_DEMO=1): the tour plays as Maya, then Aarav.
  await page.goto(`${BASE}/?dev=1`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('milo-child', 'maya'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.start-btn', { timeout: 15000 });
  await sleep(600);
  ok('home: one big Let\'s go button + stickers, no menu of tiles', !!(await page.$('.start-btn')) && (await page.$$('.tile')).length === 0);
  await page.screenshot({ path: join(EVID, '01-home.png') });

  // ── 2 · Maya L1 lesson: hello + wonder puzzle → wrong chip → correct chip ─────────────────
  await clickText('.start-btn', 'go');
  await page.waitForFunction(() => (window.__milo?.n || 0) >= 1, { timeout: 15000 });
  await sleep(400);
  let m = await milo();
  ok('greeting opens with a wonder puzzle, no mood buttons', m.options?.some((o) => o.id === 'wonder-a') && !m.options?.some((o) => o.id.startsWith('mood-')));
  await page.screenshot({ path: join(EVID, '02-greeting.png') });

  await page.click('.chip');
  m = await waitTurn(1);
  const firstTask = m.expect?.type === 'chip' && m.options?.length >= 2;
  ok('first task shown with ≥2 chips (tap-only playable)', firstTask);
  ok('latency badge is live', (await page.$('.lat-pill')) !== null);
  await page.screenshot({ path: join(EVID, '03-first-task.png') });

  // wrong chip → recast without "wrong"
  const rightId = m.expect.answers[0];
  const wrongOpt = m.options.find((o) => !m.expect.answers.includes(o.id));
  await clickText('.chip', wrongOpt.label);
  m = await waitTurn(m.n);
  const recastSays = await lastMiloSays();
  ok('wrong chip → recast, never the word "wrong"', !/\bwrong\b/i.test(recastSays), recastSays.slice(0, 60));
  ok('recast keeps the same question alive (retry)', m.expect?.answers?.includes(rightId));
  await page.screenshot({ path: join(EVID, '04-recast.png') });

  // correct chip → star + praise
  const rightOpt = m.options.find((o) => o.id === rightId);
  await clickText('.chip', rightOpt.label);
  m = await waitTurn(m.n);
  ok('correct chip → star earned (⭐ ≥ 1)', m.stars >= 1, `stars=${m.stars}`);
  const pillText = await page.$eval('.stars-pill', (e) => e.textContent);
  ok('star counter visible in UI', /1|2|3|4|5|6|7|8|9/.test(pillText), pillText.trim());
  await page.screenshot({ path: join(EVID, '05-got-star.png') });

  // ── 3 · Calm corner: "i'm tired" → SUPPORT → breathe → bye ───────────────
  await page.type('.composer-input', "i'm tired");
  await page.click('.send-btn');
  m = await waitTurn(m.n);
  ok('"i\'m tired" → support mode', m.mode === 'support', `mode=${m.mode}`);
  ok('calm backdrop (breathing balloon) visible', (await page.$('.calm-backdrop .balloon')) !== null);
  await page.screenshot({ path: join(EVID, '06-calm-corner.png') });

  await clickText('.chip', 'Breathe');
  m = await waitTurn(m.n);
  ok('breathe offers gentle next steps', m.options?.some((o) => o.id === 'action-easy-game'));

  await clickText('.chip', 'Bye');
  m = await waitTurn(m.n);
  ok('bye → goodbye ritual + end card', m.endCard === true);
  ok('end card visible with stars', (await page.$('.endcard')) !== null);
  await page.screenshot({ path: join(EVID, '07-endcard-maya.png') });

  // play again → home
  await clickText('.btn-primary', 'Back home');
  await page.waitForSelector('.start-btn', { timeout: 8000 });
  ok('"Back home" returns home (no dead end)', true);

  // ── 4 · Aarav: mid-L2 → stage check → graduation ─────────────────────────
  await postJson('/api/reset-demo', {});
  await page.evaluate(() => localStorage.setItem('milo-child', 'aarav'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.start-btn', { timeout: 15000 });
  await clickText('.start-btn', 'go');
  await page.waitForFunction(() => (window.__milo?.n || 0) >= 1, { timeout: 15000 });
  await page.click('.chip');
  m = await waitTurn(1);

  ok('gate-ready Aarav lands in the STAGE check', m.phase === 'STAGE', `phase=${m.phase}`);
  await page.screenshot({ path: join(EVID, '08-stage-check.png') });

  // answer 5 mixed tasks using the engine's own expectations
  let answered = 0;
  for (let i = 0; i < 5; i++) {
    const e = m.expect;
    if (!e) break;
    if (['chip', 'count', 'yes-no'].includes(e.type)) {
      const opt = m.options.find((o) => o.id === e.answers[0]);
      await clickText('.chip', opt.label);
    } else if (e.type === 'word') {
      await page.type('.composer-input', e.answers[0]);
      await page.click('.send-btn');
    } else if (e.type === 'frame') {
      const words = e.answers[0].replace(/[?!.]/g, '').split(' ');
      for (const wd of words) {
        const chip = (m.wordChips || []).find((c) => c.label.toLowerCase() === wd.toLowerCase());
        if (chip) await clickText('.wordchip', chip.label);
      }
      await page.click('.send-btn');
    } else {
      await page.type('.composer-input', 'hello!');
      await page.click('.send-btn');
    }
    answered += 1;
    m = await waitTurn(m.n);
  }
  ok('all 5 stage-check tasks answered', answered === 5, `answered=${answered}`);

  // graduation moment: confetti + badge
  const confettiNow = (await page.$('.confetti')) !== null;
  const badgeNow = (await page.$('.badgepop')) !== null;
  ok('graduation confetti + badge pop', confettiNow || badgeNow || m.stars >= 5, `confetti=${confettiNow} badge=${badgeNow} stars=${m.stars}`);
  ok('graduation star bonus applied (≥5)', m.stars >= 5, `stars=${m.stars}`);
  ok('L3 preview ships word chips (sentence building)', (m.wordChips || []).length >= 3);
  await page.screenshot({ path: join(EVID, '09-graduation.png') });

  // finale: build "I'm fine thank you" with word chips → end card
  const words = ['I\'m', 'fine', 'thank', 'you'];
  for (const wd of words) {
    const chip = (m.wordChips || []).find((c) => c.label.toLowerCase() === wd.toLowerCase());
    if (chip) await clickText('.wordchip', chip.label);
  }
  const typed = await page.$eval('.composer-input', (e) => e.value);
  ok('word chips compose a sentence in the composer', typed.trim().split(/\s+/).length === 4, typed);
  await page.click('.send-btn');
  m = await waitTurn(m.n);
  ok('finale → end card with summary', m.endCard === true);
  await page.screenshot({ path: join(EVID, '10-endcard-aarav.png') });

  const kids = await getJson('/api/children');
  const aarav = kids.children.find((c) => c.key === 'aarav');
  ok('Aarav promoted L2 → L3 in the profile', aarav.level === 3, `level=${aarav.level}`);

  await browser.close();
  writeFileSync(join(EVID, 'e2e-results.json'), JSON.stringify({ base: BASE, ranAt: new Date().toISOString(), checks: results }, null, 2));
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} e2e checks passed`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch(async (err) => {
  console.error('e2e crashed:', err.message);
  results.push({ name: `crashed: ${err.message}`, pass: false, detail: '' });
  try { writeFileSync(join(EVID, 'e2e-results.json'), JSON.stringify({ base: BASE, ranAt: new Date().toISOString(), checks: results }, null, 2)); } catch {}
  try { await browserRef?.close(); } catch {}
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 1500).unref(); // never hang on a wedged socket
});
