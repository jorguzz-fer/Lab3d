// Captura os slides de web/index.html nos temas escuro e claro (Playwright).
// Uso: node tools/test-page.mjs <pasta-de-saída>
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WEB = join(ROOT, 'web');
const OUT = process.argv[2] || join(ROOT, 'docs/previews');
const { chromium } = createRequire(import.meta.url)('playwright');
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.txt': 'text/plain', '.jpg': 'image/jpeg' };
const server = http.createServer(async (req, res) => {
  const p = normalize(join(WEB, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html')));
  try { const b = await readFile(p); res.writeHead(200, { 'content-type': T[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const wait = ms => new Promise(r => setTimeout(r, ms));
for (const scheme of ['dark', 'light']) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, colorScheme: scheme });
  page.on('pageerror', e => console.error('[page error]', e.message));
  page.on('console', m => m.type() === 'error' && console.error('[console]', m.text()));
  await page.route(/cdn\.jsdelivr\.net\/npm\/three@0\.169\.0\/(.*)/, async (route) => {
    const rel = route.request().url().split('three@0.169.0/')[1];
    route.fulfill({ body: await readFile(join(ROOT, 'node_modules/three', rel)), contentType: 'text/javascript' });
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(`http://localhost:${server.address().port}/`);
  await page.waitForFunction('window.__lab', null, { timeout: 120000 });
  const slides = scheme === 'dark' ? [0, 1, 2, 3, 4, 5] : [0, 2, 4];
  for (const i of slides) {
    await page.evaluate(i => DECK.go(i), i); await wait(i === 0 || i === 2 ? 4000 : 1200);
    await page.screenshot({ path: join(OUT, `${scheme}_s${i + 1}.png`), timeout: 120000 });
  }
  if (scheme === 'dark') { // interações do slide 3
    await page.evaluate(() => DECK.go(2)); await wait(800);
    await page.click('#mLabels'); await wait(1500);
    await page.screenshot({ path: join(OUT, 'dark_s3_nomes.png'), timeout: 120000 });
    await page.click('#mLabels');
    await page.evaluate(() => { __lab.select('Glândulas sebáceas'); const r = document.getElementById('explode'); r.value = 70; r.dispatchEvent(new Event('input')); });
    await wait(2500);
    await page.screenshot({ path: join(OUT, 'dark_s3_explodido.png'), timeout: 120000 });
  }
  await page.close();
}
await browser.close(); server.close();
