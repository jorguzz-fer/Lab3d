// Gera models/pele_fina_procedural.glb (e .usdz para AR no iPhone) a partir de src/skin-model.js,
// rodando o three.js num Chromium headless. Uso: npm run build:pele [-- --previews] [-- --usdz]
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };

const server = http.createServer(async (req, res) => {
  const p = normalize(join(ROOT, decodeURIComponent(req.url.split('?')[0])));
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try { const b = await readFile(p); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => { console.error('[page error]', e); process.exitCode = 1; });
  await page.goto(`http://localhost:${port}/tools/export.html`);
  await page.waitForFunction('window.READY === true', null, { timeout: 60000 });

  const glb = Buffer.from(await page.evaluate('exportGLB()'), 'base64');
  await writeFile(join(ROOT, 'models/pele_fina_procedural.glb'), glb);
  console.log(`GLB: ${(glb.length / 1024).toFixed(0)} KB`);
  // a página da aula carrega o GLB como texto base64 (o host de artifacts não serve .glb)
  await mkdir(join(ROOT, 'web/models'), { recursive: true });
  await writeFile(join(ROOT, 'web/models/pele_fina_procedural.txt'), glb.toString('base64'));
  if (process.argv.includes('--usdz')) { // AR no iPhone (Quick Look); arquivo grande, não versionado
    const usdz = Buffer.from(await page.evaluate('exportUSDZ()'), 'base64');
    await writeFile(join(ROOT, 'models/pele_fina_procedural.usdz'), usdz);
    console.log(`USDZ: ${(usdz.length / 1024).toFixed(0)} KB`);
  }

  if (process.argv.includes('--previews')) {
    await mkdir(join(ROOT, 'docs/previews'), { recursive: true });
    const views = [['corte_3-4', 0.55, 0.42, 7.2, true], ['corte_frente', 0, 0.05, 6.4, true], ['bloco_fechado', 0.7, 0.5, 7.2, false], ['corte_lateral', 1.15, 0.25, 6.5, true]];
    for (const [name, az, el, d, cut] of views) {
      const url = await page.evaluate(([a, e, dd, c]) => preview(a, e, dd, c), [az, el, d, cut]);
      await writeFile(join(ROOT, `docs/previews/procedural_${name}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
    }
    console.log('prévias em docs/previews/');
  }
} finally { await browser.close(); server.close(); }
