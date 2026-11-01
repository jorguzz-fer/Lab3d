// Modelo procedural de um bloco de pele fina (histologia), em milímetros.
// Cada estrutura vira um nó nomeado no GLB, para o visualizador poder
// clicar, esconder, destacar ou afastar cada parte.
//
// Eixos: x = comprimento do bloco, y = profundidade (0 = superfície), z = largura.
// O plano z = 0 é o "plano de corte": cada camada tem uma metade posterior
// (z < 0) e uma anterior (z > 0). Esconder as anteriores mostra o corte,
// igual à lâmina histológica.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- dimensões (mm, valores didáticos) ----------
const X0 = -1.5, X1 = 1.5, Z0 = -1.0, Z1 = 1.0;
const Y_CORNEO = 0.03;      // espessura do estrato córneo, acima de y = 0
const Y_PAPILAR = -0.36;    // limite derme papilar / reticular
const Y_RETICULAR = -1.65;  // limite derme / hipoderme
const Y_BASE = -2.25;       // fundo do bloco

// junção dermoepidérmica ondulada (cristas epidérmicas e papilas dérmicas)
const jde = (x, z) => -0.1 - 0.035 * (0.5 + 0.5 * Math.sin(x * 13.0 + 0.6) * Math.cos(z * 11.0));
const surf = (x, z) => 0.006 * Math.sin(x * 23) * Math.sin(z * 19);

// ---------- texturas tipo H&E (canvas) ----------
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function canvasTex(draw, { size = 512, seed = 1, repeat = 1 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size, rng(seed));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.userData.mimeType = 'image/jpeg';
  return t;
}

// fundo + ruído + núcleos (pontos roxos) + fibras opcionais.
// Tudo é desenhado nas 9 posições vizinhas para a textura ladrilhar sem emenda.
function heTexture({ base, noise = 18, nuclei = 0, nucColor = '#4b2a7a', nucR = [2, 4], fibers = 0, fiberColor = null, cells = 0, cellLine = null, seed = 1, size = 512 }) {
  return canvasTex((g, S, R) => {
    const wrap = fn => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) {
      const a = (R() - 0.5) * noise, x = R() * S, y = R() * S, w = 2 + R() * 6, h = 2 + R() * 6;
      g.fillStyle = a > 0 ? `rgba(255,255,255,${a / 255})` : `rgba(60,0,60,${-a / 255})`;
      wrap(() => g.fillRect(x, y, w, h));
    }
    if (cells) { // células poligonais (adipócitos, sebócitos)
      g.strokeStyle = cellLine; g.lineWidth = 3;
      for (let i = 0; i < cells; i++) {
        const x = R() * S, y = R() * S, r = 22 + R() * 16, pts = [];
        for (let k = 0; k <= 7; k++) { const a = k / 7 * Math.PI * 2, rr = r * (0.85 + R() * 0.3); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
        wrap(() => { g.beginPath(); pts.forEach(([px, py]) => g.lineTo(px, py)); g.stroke(); });
      }
    }
    if (fibers) { // fibras de colágeno onduladas
      g.strokeStyle = fiberColor; g.lineCap = 'round';
      for (let i = 0; i < fibers; i++) {
        let x = R() * S, y = R() * S; const ang = (R() - 0.5) * 1.2, lw = 2 + R() * 4, pts = [[x, y]];
        for (let k = 0; k < 8; k++) { x += Math.cos(ang) * 14; y += Math.sin(ang) * 14 + Math.sin(k * 1.4) * 4; pts.push([x, y]); }
        wrap(() => { g.lineWidth = lw; g.beginPath(); pts.forEach(([px, py]) => g.lineTo(px, py)); g.stroke(); });
      }
    }
    g.fillStyle = nucColor;
    for (let i = 0; i < nuclei; i++) {
      const x = R() * S, y = R() * S, r = nucR[0] + R() * (nucR[1] - nucR[0]), e = 1 + R() * 0.6, rot = R() * 3;
      wrap(() => { g.beginPath(); g.ellipse(x, y, r * e, r, rot, 0, Math.PI * 2); g.fill(); });
    }
  }, { seed, size });
}

function makeMaterials() {
  const M = (name, opts) => { const m = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0, ...opts }); m.name = name; return m; };
  return {
    corneo: M('estrato_corneo', { map: heTexture({ base: '#efb3cf', noise: 22, fibers: 40, fiberColor: 'rgba(250,210,230,.6)', seed: 3 }), roughness: 0.5 }),
    epiderme: M('epiderme', { map: heTexture({ base: '#b783c0', nuclei: 900, nucColor: '#47206e', nucR: [3, 5], seed: 5 }) }),
    papilar: M('derme_papilar', { map: heTexture({ base: '#f2bfd6', fibers: 140, fiberColor: 'rgba(225,120,170,.55)', nuclei: 70, nucR: [2, 3.5], seed: 7 }) }),
    reticular: M('derme_reticular', { map: heTexture({ base: '#e595bb', fibers: 260, fiberColor: 'rgba(200,70,130,.55)', nuclei: 40, nucR: [2, 3], seed: 9 }) }),
    hipoderme: M('hipoderme', { map: heTexture({ base: '#f8eedf', noise: 10, cells: 160, cellLine: '#c48ab0', nuclei: 25, nucR: [2, 3], seed: 11 }), roughness: 0.45 }),
    // bainha translúcida: deixa ver o pelo e a papila dentro do folículo
    foliculo: M('foliculo_piloso', { map: heTexture({ base: '#9c62b0', nuclei: 700, nucColor: '#3e1c62', nucR: [3, 5], seed: 13 }), transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }),
    pelo: M('pelo', { color: '#4a2a18', roughness: 0.35 }),
    papila: M('papila_dermica', { color: '#e07aa6' }),
    sebacea: M('glandula_sebacea', { map: heTexture({ base: '#d9b6e4', noise: 12, cells: 90, cellLine: '#a877bd', nuclei: 220, nucColor: '#5a2d86', nucR: [3, 4.5], seed: 15 }), roughness: 0.4 }),
    musculo: M('musculo_eretor', { map: heTexture({ base: '#c9566a', fibers: 120, fiberColor: 'rgba(240,140,160,.5)', nuclei: 60, nucColor: '#4b1d55', nucR: [2, 3], seed: 17 }) }),
    arteria: M('arteria', { color: '#c4302b', roughness: 0.4 }),
    veia: M('veia', { color: '#3561b8', roughness: 0.4 }),
    sudoripara: M('glandula_sudoripara', { map: heTexture({ base: '#b87cc8', nuclei: 300, nucColor: '#3e1c62', nucR: [2.5, 4], seed: 19 }) }),
  };
}

// ---------- geometria: placa entre duas superfícies y = top(x,z) e y = bot(x,z) ----------
// UV em unidades do mundo (uvScale mm por repetição) para a textura ter a mesma escala em todas as faces.
function slab(xa, xb, za, zb, top, bot, nx = 60, nz = 40, uvScale = 0.8) {
  const pos = [], uv = [], idx = [];
  const quadGrid = (P, nu, nv, uvf) => { // P(i,j) -> [x,y,z]
    const start = pos.length / 3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const p = P(i / nu, j / nv); pos.push(...p); const t = uvf(p); uv.push(t[0] / uvScale, t[1] / uvScale);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = start + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  };
  const X = u => xa + (xb - xa) * u, Z = v => za + (zb - za) * v;
  const lerp = (a, b, t) => a + (b - a) * t;
  // topo e fundo
  quadGrid((u, v) => [X(u), top(X(u), Z(v)), Z(v)], nx, nz, p => [p[0], p[2]]);
  quadGrid((u, v) => [X(1 - u), bot(X(1 - u), Z(v)), Z(v)], nx, nz, p => [p[0], p[2]]);
  // laterais (seguem as superfícies ondulas)
  const ny = 6;
  quadGrid((u, w) => { const x = X(u), z = zb; return [x, lerp(top(x, z), bot(x, z), w), z]; }, nx, ny, p => [p[0], p[1]]);   // z = zb
  quadGrid((u, w) => { const x = X(1 - u), z = za; return [x, lerp(top(x, z), bot(x, z), w), z]; }, nx, ny, p => [p[0], p[1]]); // z = za
  quadGrid((v, w) => { const z = Z(1 - v), x = xb; return [x, lerp(top(x, z), bot(x, z), w), z]; }, nz, ny, p => [p[2], p[1]]); // x = xb
  quadGrid((v, w) => { const z = Z(v), x = xa; return [x, lerp(top(x, z), bot(x, z), w), z]; }, nz, ny, p => [p[2], p[1]]);     // x = xa
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// tubo ao longo de uma curva com raio variável r(t)
function varTube(curve, rFn, segs = 120, radial = 28, uvScale = 0.5, caps = true) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], uv = [], idx = [];
  const len = curve.getLength();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, p = curve.getPointAt(t), N = frames.normals[i], B = frames.binormals[i], r = rFn(t);
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(p.x + r * (c * N.x + s * B.x), p.y + r * (c * N.y + s * B.y), p.z + r * (c * N.z + s * B.z));
      uv.push(j / radial * (2 * Math.PI * 0.15) / uvScale, t * len / uvScale);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (!caps) return g;
  // tampas com vértices próprios, para a seção do tubo ficar com sombreamento plano
  const parts = [g];
  for (const end of [0, 1]) {
    const p = curve.getPointAt(end), r = rFn(end), N = frames.normals[end * segs], B = frames.binormals[end * segs];
    const disc = new THREE.CircleGeometry(Math.max(r, 1e-4), radial);
    const T = curve.getTangentAt(end).multiplyScalar(end ? 1 : -1);
    disc.applyMatrix4(new THREE.Matrix4().makeBasis(N, B.clone().multiplyScalar(end ? 1 : -1), T));
    disc.translate(p.x, p.y, p.z);
    parts.push(disc);
  }
  return mergeGeometries(parts, false);
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- montagem ----------
export function buildSkinBlock() {
  const mat = makeMaterials();
  const root = new THREE.Group();
  root.name = 'Pele fina';
  root.userData = {
    descricao: 'Bloco de pele fina (histologia), modelo procedural didático. Unidades em milímetros.',
    unidades: 'mm',
  };

  const add = (parent, name, geom, material, extras = {}) => {
    const m = new THREE.Mesh(geom, material); m.name = name; m.userData = extras; parent.add(m); return m;
  };
  const group = (name, extras = {}) => { const g = new THREE.Group(); g.name = name; g.userData = extras; root.add(g); return g; };

  // camadas: cada uma com metade posterior e anterior
  const layers = [
    ['Estrato córneo', 'camada', mat.corneo, (x, z) => Y_CORNEO + surf(x, z), (x, z) => surf(x, z), 'Camada mais externa da epiderme: células mortas, achatadas e cheias de queratina. Na pele fina é delgada.'],
    ['Epiderme', 'camada', mat.epiderme, (x, z) => surf(x, z), jde, 'Epitélio estratificado pavimentoso queratinizado. Na pele fina tem poucas camadas de células e não tem estrato lúcido.'],
    ['Derme papilar', 'camada', mat.papilar, jde, () => Y_PAPILAR, 'Tecido conjuntivo frouxo logo abaixo da epiderme. Forma as papilas dérmicas, com capilares e terminações nervosas.'],
    ['Derme reticular', 'camada', mat.reticular, () => Y_PAPILAR, () => Y_RETICULAR, 'Tecido conjuntivo denso não modelado, com feixes grossos de colágeno. Abriga folículos e glândulas.'],
    ['Hipoderme', 'camada', mat.hipoderme, () => Y_RETICULAR, () => Y_BASE, 'Tecido adiposo unilocular abaixo da derme. Não faz parte da pele, mas a sustenta.'],
  ];
  for (const [name, tipo, m, top, bot, info] of layers) {
    const g = group(name, { tipo, info });
    add(g, name + ' (posterior)', slab(X0, X1, Z0, 0, top, bot), m, { metade: 'posterior' });
    add(g, name + ' (anterior)', slab(X0, X1, 0, Z1, top, bot), m, { metade: 'anterior' });
  }

  // folículo piloso: oblíquo, do óstio na superfície até o bulbo na hipoderme superior
  const fCurve = new THREE.CatmullRomCurve3([V(-0.62, 0.02, 0), V(-0.38, -0.5, 0), V(-0.05, -1.1, 0), V(0.22, -1.55, 0), V(0.36, -1.8, 0)]);
  const fR = t => 0.105 + 0.015 * t + 0.11 * smooth(0.82, 0.97, t) - 0.12 * smooth(0.985, 1.0, t);
  const fol = group('Folículo piloso', { tipo: 'estrutura', info: 'Invaginação da epiderme que produz o pelo. Na base fica o bulbo, com a matriz germinativa envolvendo a papila dérmica.' });
  add(fol, 'Bainha do folículo', varTube(fCurve, fR, 140, 32), mat.foliculo);
  const tipBulb = fCurve.getPointAt(0.965);
  const pap = new THREE.SphereGeometry(0.075, 24, 16); pap.scale(1, 1.35, 1);
  const tan = fCurve.getTangentAt(0.965);
  pap.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), tan.clone().negate()));
  pap.translate(tipBulb.x, tipBulb.y, tipBulb.z);
  add(group('Papila dérmica', { tipo: 'estrutura', info: 'Tecido conjuntivo vascularizado dentro do bulbo. Nutre e regula a matriz que forma o pelo.' }), 'Papila dérmica', pap, mat.papila);

  // pelo: dentro do folículo e saindo acima da superfície
  const out = fCurve.getTangentAt(0).negate();
  const s0 = fCurve.getPointAt(0);
  const hairPts = [];
  for (let i = 0; i <= 8; i++) hairPts.push(fCurve.getPointAt(0.93 - 0.93 * i / 8));
  hairPts.push(s0.clone().addScaledVector(out, 0.45).add(V(-0.02, 0.0, 0)));
  hairPts.push(s0.clone().addScaledVector(out, 0.9).add(V(-0.12, -0.04, 0)));
  hairPts.push(s0.clone().addScaledVector(out, 1.3).add(V(-0.3, -0.14, 0)));
  const hCurve = new THREE.CatmullRomCurve3(hairPts);
  add(group('Pelo', { tipo: 'estrutura', info: 'Haste de queratina dura produzida pela matriz do bulbo. Atravessa o folículo e emerge na superfície.' }),
    'Haste do pelo', varTube(hCurve, t => 0.042 - 0.022 * smooth(0.8, 1, t) + 0.02 * smooth(0.08, 0, t), 160, 16), mat.pelo);

  // glândulas sebáceas: lóbulos em cacho junto ao terço superior do folículo
  const seb = group('Glândulas sebáceas', { tipo: 'estrutura', info: 'Glândulas holócrinas em cacho que desembocam no folículo. Produzem o sebo, que lubrifica pelo e pele.' });
  const R = rng(77);
  const lobes = (center, dir, n, spread) => {
    const geoms = [];
    for (let i = 0; i < n; i++) {
      const r = 0.075 + R() * 0.06;
      const g = new THREE.SphereGeometry(r, 22, 16);
      g.scale(1 + R() * 0.25, 0.85 + R() * 0.3, 1 + R() * 0.2);
      const off = V((R() - 0.5) * spread, (R() - 0.5) * spread * 1.2, (R() - 0.5) * spread * 0.9).addScaledVector(dir, R() * spread * 0.6);
      g.translate(center.x + off.x, center.y + off.y, center.z + off.z);
      geoms.push(g);
    }
    return mergeGeometries(geoms);
  };
  // lado esquerdo (ângulo obtuso, junto ao músculo) e lado direito
  const pL = fCurve.getPointAt(0.33), pR = fCurve.getPointAt(0.38);
  const nrm = V(-tan.y, tan.x, 0).normalize(); // perpendicular ao folículo no plano xy
  const cL = pL.clone().addScaledVector(nrm, -0.26), cR = pR.clone().addScaledVector(nrm, 0.25);
  add(seb, 'Glândula sebácea (lado do músculo)', lobes(cL, nrm.clone().negate(), 7, 0.24), mat.sebacea);
  add(seb, 'Glândula sebácea (lado oposto)', lobes(cR, nrm, 6, 0.22), mat.sebacea);
  // ductos curtos até o folículo
  for (const [c, p] of [[cL, fCurve.getPointAt(0.27)], [cR, fCurve.getPointAt(0.3)]]) {
    add(seb, 'Ducto sebáceo', varTube(new THREE.CatmullRomCurve3([c, c.clone().lerp(p, 0.5).add(V(0, 0.04, 0)), p]), () => 0.04, 24, 12), mat.sebacea);
  }

  // músculo eretor do pelo: do folículo (região do bojo) até a derme papilar
  const mA = fCurve.getPointAt(0.52).add(V(0, 0, 0.05)), mB = V(-1.12, -0.24, 0.06);
  const mCurve = new THREE.CatmullRomCurve3([mA, mA.clone().lerp(mB, 0.5).add(V(-0.05, -0.08, 0)), mB]);
  const mus = varTube(mCurve, t => 0.06 + 0.035 * Math.sin(Math.PI * t), 40, 16);
  add(group('Músculo eretor do pelo', { tipo: 'estrutura', info: 'Feixe de músculo liso preso ao folículo. Ao contrair, endireita o pelo ("arrepio") e espreme a glândula sebácea.' }), 'Músculo eretor do pelo', mus, mat.musculo);

  // glândula sudorípara écrina: novelo na derme profunda + ducto até a superfície
  const sud = group('Glândula sudorípara', { tipo: 'estrutura', info: 'Glândula tubular enovelada na derme profunda. O ducto sobe em espiral e abre na superfície da pele.' });
  const coil = [];
  for (let i = 0; i <= 90; i++) { const a = i / 90 * Math.PI * 9; coil.push(V(0.95 + 0.14 * Math.cos(a) + 0.04 * Math.sin(a * 0.5), -1.48 + 0.18 * (i / 90) + 0.03 * Math.sin(a * 0.33), 0.12 * Math.sin(a) + 0.07)); }
  const top = coil[coil.length - 1];
  for (let i = 1; i <= 40; i++) { const t = i / 40, a = t * Math.PI * 6; coil.push(V(top.x + 0.05 * Math.cos(a) * (1 - t * 0.3) + 0.15 * t, top.y + (0.02 - top.y) * t, top.z + 0.05 * Math.sin(a))); }
  add(sud, 'Glândula sudorípara', varTube(new THREE.CatmullRomCurve3(coil), () => 0.035, 600, 12), mat.sudoripara);

  // vasos: plexo profundo (limite derme/hipoderme) e superficial (derme papilar), terminam no plano de corte
  const vas = group('Vasos sanguíneos', { tipo: 'estrutura', info: 'Plexo profundo, entre derme e hipoderme, e plexo superficial, na derme papilar. Artérias em vermelho, veias em azul.' });
  const vessel = (pts, r, m, name) => add(vas, name, varTube(new THREE.CatmullRomCurve3(pts), () => r, 60, 16), m);
  vessel([V(-1.2, -1.6, -1), V(-1.15, -1.62, -0.5), V(-1.22, -1.58, 0.03)], 0.06, mat.arteria, 'Artéria (plexo profundo)');
  vessel([V(-0.95, -1.62, -1), V(-0.9, -1.6, -0.5), V(-0.97, -1.63, 0.03)], 0.075, mat.veia, 'Veia (plexo profundo)');
  vessel([V(0.55, -0.3, -1), V(0.6, -0.28, -0.5), V(0.56, -0.3, 0.03)], 0.035, mat.arteria, 'Arteríola (plexo superficial)');
  vessel([V(0.75, -0.31, -1), V(0.72, -0.3, -0.5), V(0.76, -0.29, 0.03)], 0.042, mat.veia, 'Vênula (plexo superficial)');
  // um ramo que sobe do plexo profundo ao superficial
  vessel([V(-1.22, -1.58, -0.6), V(-0.6, -1.0, -0.55), V(0.1, -0.55, -0.5), V(0.6, -0.28, -0.5)], 0.03, mat.arteria, 'Arteríola comunicante');

  // marcadores: camadas usam pontos fixos; estruturas usam pontos calculados da geometria
  const r3 = v => [v.x, v.y, v.z].map(n => +n.toFixed(3));
  const computed = {
    'Folículo piloso': r3(fCurve.getPointAt(0.62).add(V(0, 0, 0.12))),
    'Papila dérmica': r3(tipBulb.clone().add(V(0, 0, 0.1))),
    'Pelo': r3(hCurve.getPointAt(0.9)),
    'Glândulas sebáceas': r3(cL.clone().add(V(0, 0, 0.17))),
    'Músculo eretor do pelo': r3(mCurve.getPointAt(0.55).add(V(0, 0, 0.1))),
    'Glândula sudorípara': r3(V(0.95, -1.42, 0.2)),
  };
  for (const [name, p] of LANDMARKS) {
    const g = root.getObjectByName(name);
    if (g) g.userData.marcador = computed[name] || p;
  }
  return root;
}

// pontos de referência para marcadores numerados no visualizador (mm).
// Ficam gravados no GLB, em extras.marcador de cada grupo.
const LANDMARKS = [
  ['Estrato córneo', [-1.3, 0.04, 0.02]],
  ['Epiderme', [-1.05, -0.06, 0.01]],
  ['Derme papilar', [1.25, -0.24, 0.01]],
  ['Derme reticular', [1.25, -1.0, 0.01]],
  ['Hipoderme', [-0.4, -1.98, 0.01]],
  ['Folículo piloso', [-0.08, -1.05, 0.11]],
  ['Pelo', [-1.15, 0.62, 0]],
  ['Glândulas sebáceas', [-0.78, -0.5, 0.14]],
  ['Músculo eretor do pelo', [-0.82, -0.36, 0.06]],
  ['Papila dérmica', [0.34, -1.77, 0.08]],
  ['Glândula sudorípara', [0.95, -1.4, 0.15]],
  ['Vasos sanguíneos', [-1.08, -1.62, 0.08]],
];
