// Copia models/*.glb para web/models/*.txt em base64 (o host de artifacts não serve .glb).
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
await mkdir(join(ROOT, 'web/models'), { recursive: true });
for (const f of (await readdir(join(ROOT, 'models'))).filter(f => f.endsWith('.glb'))) {
  const b = await readFile(join(ROOT, 'models', f));
  await writeFile(join(ROOT, 'web/models', f.replace(/\.glb$/, '.txt')), b.toString('base64'));
  console.log(`web/models/${f.replace(/\.glb$/, '.txt')} (${(b.length / 1024).toFixed(0)} KB)`);
}
