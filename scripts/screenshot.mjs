/**
 * Ambil 2 screenshot UI untuk README memakai Chrome DevTools Protocol.
 * Prasyarat: `npm run dev` berjalan di http://localhost:5173 dan Chrome tersedia.
 *
 * Pemakaian: node scripts/screenshot.mjs
 * Hasil: docs/screenshot-gantt.png dan docs/screenshot-pert.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEV_URL = 'http://localhost:5173/';
const DEBUG_PORT = 9223;
const OUT_DIR = fileURLToPath(new URL('../docs/', import.meta.url));
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    try {
      execFileSync(process.platform === 'win32' ? 'cmd' : 'test', process.platform === 'win32' ? ['/c', 'if', 'exist', p, 'exit', '0', '&', 'exit', '1'] : [p], { stdio: 'ignore' });
      return p;
    } catch {
      /* coba berikutnya */
    }
  }
  return null;
}

async function connectCdp(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (pending.delete(id)) reject(new Error(`timeout: ${method}`));
      }, 20000);
    });
  return { send, close: () => ws.close() };
}

async function main() {
  const chrome = findChrome();
  if (!chrome) throw new Error('Chrome tidak ditemukan');
  mkdirSync(OUT_DIR, { recursive: true });

  const child = spawn(
    chrome,
    [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${fileURLToPath(new URL('../.chrome-shot-profile/', import.meta.url))}`,
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--window-size=1440,900',
      'about:blank',
    ],
    { stdio: 'ignore', detached: false },
  );

  // Tunggu endpoint DevTools siap
  let targets = null;
  for (let i = 0; i < 40 && !targets; i++) {
    await sleep(250);
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      targets = await res.json();
    } catch {
      /* belum siap */
    }
  }
  if (!targets) {
    child.kill();
    throw new Error('Endpoint DevTools tidak tersedia');
  }
  const page = targets.find((t) => t.type === 'page');
  if (!page) {
    child.kill();
    throw new Error('Target halaman tidak ditemukan');
  }

  const { send, close } = await connectCdp(page.webSocketDebuggerUrl);
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: DEV_URL });
  await sleep(3500);

  async function shot(file, expression) {
    if (expression) {
      await send('Runtime.evaluate', { expression, awaitPromise: true });
      await sleep(1800);
    }
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const path = fileURLToPath(new URL(`../docs/${file}`, import.meta.url));
    writeFileSync(path, Buffer.from(res.data, 'base64'));
    const { statSync } = await import('node:fs');
    console.log(`OK ${file} (${statSync(path).size} bytes)`);
  }

  // 1) Tampilan Gantt Chart (tab default)
  await shot('screenshot-gantt.png');

  // 2) Tab Analisis: jalur kritis + diagram PERT
  await shot(
    'screenshot-pert.png',
    `(() => {
      const tab = [...document.querySelectorAll('.tab')].find((t) => t.textContent.trim() === 'Analisis');
      if (tab) tab.click();
      return true;
    })()`,
  );

  close();
  child.kill();
}

main().catch((err) => {
  console.error('GAGAL:', err.message);
  process.exit(1);
});
