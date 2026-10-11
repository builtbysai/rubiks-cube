#!/usr/bin/env node
// E2E test for the Rubik's Cube PWA update flow.
// Serves a copy of the app, installs vN, "deploys" vN+1, verifies the update
// prompt appears, Later dismisses it, Update-now reloads into the new version.
// Usage: node pwa-update-test.mjs <port> <viewportWidth> <outDir> <vFrom> <vTo>
import { spawn, execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'fs';

const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell';
const [port, vwArg, outDir, vFrom, vTo] = process.argv.slice(2);
const VW = parseInt(vwArg, 10);
const PORT = 19481;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let seq = 0; const handlers = {};
function rpc(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq; handlers[id] = { resolve, reject };
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function ev(ws, expr, timeoutMs = 30000) {
  const r = await rpc(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('JS: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
}
async function waitFor(ws, expr, timeoutMs, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await ev(ws, expr).catch(() => false)) return true;
    await sleep(500);
  }
  throw new Error('timeout waiting for ' + label);
}
async function shot(ws, name) {
  const s = await rpc(ws, 'Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${outDir}/${name}.png`, Buffer.from(s.data, 'base64'));
  console.log('shot', `${outDir}/${name}.png`);
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const appDir = `/tmp/pwa-test-${port}`;
  if (existsSync(appDir)) rmSync(appDir, { recursive: true });
  cpSync('/home/hatch/workspace/rubiks-cube', appDir, { recursive: true, filter: p => !p.includes('/.git') });
  // stamp version vFrom
  let sw = readFileSync(`${appDir}/sw.js`, 'utf8');
  sw = sw.replace(/rubiks-cube-v\d+/, `rubiks-cube-v${vFrom}`);
  writeFileSync(`${appDir}/sw.js`, sw);
  let html = readFileSync(`${appDir}/index.html`, 'utf8');
  html = html.replace("<title>Rubik's Cube · Interactive 3D</title>", `<title>Rubik's Cube · v${vFrom}</title>`);
  writeFileSync(`${appDir}/index.html`, html);

  const server = spawn('python3', ['-m', 'http.server', port, '--directory', appDir], { stdio: 'ignore' });
  await sleep(1500);
  const profile = `/tmp/pwa-prof-${port}`;
  if (existsSync(profile)) rmSync(profile, { recursive: true });
  const browser = spawn(SHELL, ['--headless', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, `--window-size=${VW},900`, 'about:blank'], { stdio: 'ignore' });
  await sleep(3000);
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 256 * 1024 * 1024 });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && handlers[m.id]) { const h = handlers[m.id]; delete handlers[m.id]; m.error ? h.reject(new Error(JSON.stringify(m.error))) : h.resolve(m.result); }
  };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const results = [];
  const check = (name, ok) => { results.push([name, ok]); console.log(ok ? 'PASS' : 'FAIL', '-', name); if (!ok) throw new Error('failed: ' + name); };

  try {
    await rpc(ws, 'Page.enable'); await rpc(ws, 'Runtime.enable');
    await rpc(ws, 'Emulation.setDeviceMetricsOverride', { width: VW, height: 900, deviceScaleFactor: 1, mobile: VW <= 500 });
    await rpc(ws, 'Page.navigate', { url: `http://localhost:${port}/index.html` });
    // wait for SW to take control (first install)
    await waitFor(ws, `!!navigator.serviceWorker.controller`, 30000, 'SW controller (vFrom)');
    await sleep(2000);
    check('no update prompt on first install',
      await ev(ws, `!document.getElementById('swUpdate').classList.contains('show')`));
    check('vFrom cache active',
      await ev(ws, `(async()=> (await caches.keys()).includes('rubiks-cube-v${vFrom}'))()`));
    await shot(ws, `01-installed-${VW}`);

    // ---- deploy vTo ----
    let sw2 = readFileSync(`${appDir}/sw.js`, 'utf8').replace(/rubiks-cube-v\d+/, `rubiks-cube-v${vTo}`);
    writeFileSync(`${appDir}/sw.js`, sw2);
    let html2 = readFileSync(`${appDir}/index.html`, 'utf8').replace(`Rubik's Cube · v${vFrom}`, `Rubik's Cube · v${vTo}`);
    writeFileSync(`${appDir}/index.html`, html2);
    console.log(`deployed v${vTo}`);

    await ev(ws, `window.__swReg.update()`);
    await waitFor(ws, `document.getElementById('swUpdate').classList.contains('show')`, 30000, 'update banner');
    check('update prompt appears after new deploy', true);
    check('prompt copy mentions new version',
      await ev(ws, `document.querySelector('#swUpdate .swMsg strong').textContent.includes('new version')`));
    await shot(ws, `02-update-prompt-${VW}`);

    // Later dismisses; a reload reminds (waiting worker still pending)
    await ev(ws, `document.getElementById('swUpdateLater').click()`);
    await sleep(500);
    check('Later dismisses the banner',
      await ev(ws, `!document.getElementById('swUpdate').classList.contains('show')`));
    await rpc(ws, 'Page.navigate', { url: `http://localhost:${port}/index.html` });
    await waitFor(ws, `document.getElementById('swUpdate').classList.contains('show')`, 30000, 'banner reminder after reload');
    check('pending update is offered again on next visit', true);
    await shot(ws, `02b-reminder-${VW}`);

    // Update now -> activates vTo -> reloads into it
    await ev(ws, `document.getElementById('swUpdateNow').click()`);
    // controllerchange triggers location.reload(); wait for the new title
    await waitFor(ws, `document.title.includes('v${vTo}')`, 30000, 'reloaded into vTo');
    await sleep(2000);
    check('clicking Update now loads the new version',
      await ev(ws, `document.title.includes('v${vTo}')`));
    check('vTo cache is the active one',
      await ev(ws, `(async()=>{const ks=await caches.keys(); return ks.includes('rubiks-cube-v${vTo}') && !ks.includes('rubiks-cube-v${vFrom}');})()`));
    check('no prompt after updating',
      await ev(ws, `!document.getElementById('swUpdate').classList.contains('show')`));
    await shot(ws, `03-updated-${VW}`);
    console.log('ALL PWA CHECKS PASSED');
  } finally {
    ws.close(); browser.kill('SIGKILL'); server.kill('SIGKILL');
  }
}
main().catch(e => { console.error('PWA TEST FAIL:', e.message); process.exit(1); });
