// Gera uma grade 2×2 de vistas de um GLB. Uso: node tools/preview-glb.mjs models/x.glb saida.jpg
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const { chromium } = createRequire(import.meta.url)('playwright');
const [glb, out] = process.argv.slice(2);
const T = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer(async (req, res) => {
  const p = normalize(join(ROOT, decodeURIComponent(req.url.split('?')[0])));
  try { const b = await readFile(p); res.writeHead(200, { 'content-type': T[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
page.on('pageerror', e => console.error(e.message));
await page.goto(`http://localhost:${server.address().port}/tools/preview.html?glb=/${relative(ROOT, glb)}`);
await page.waitForFunction('window.READY', null, { timeout: 120000 });
const html = [];
for (const [az, el] of [[0, 0.1], [0.7, 0.4], [Math.PI / 2, 0.15], [Math.PI, 0.3]]) html.push(await page.evaluate(([a, e]) => view(a, e), [az, el]));
await page.setContent(`<body style="margin:0;display:grid;grid-template-columns:450px 450px">${html.map(u => `<img src="${u}" width=450>`).join('')}</body>`);
await page.setViewportSize({ width: 900, height: 900 });
await writeFile(out, await page.screenshot({ type: 'jpeg', quality: 85 }));
await browser.close(); server.close();
