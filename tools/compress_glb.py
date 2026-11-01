"""Recomprime as texturas de um GLB (redimensiona e regrava em JPEG/PNG menor).

Uso: python3 tools/compress_glb.py entrada.glb saida.glb [--max 2048] [--q 85]
Mantém geometria e materiais; troca só os bytes das imagens e refaz o buffer binário.
"""
import argparse, io, json, struct
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--max', type=int, default=2048); ap.add_argument('--q', type=int, default=85)
a = ap.parse_args()

data = open(a.src, 'rb').read()
magic, ver, _ = struct.unpack('<4sII', data[:12])
assert magic == b'glTF' and ver == 2
jl, = struct.unpack('<I', data[12:16]); j = json.loads(data[20:20 + jl])
o = 20 + jl; bl, = struct.unpack('<I', data[o:o + 4]); binc = data[o + 8:o + 8 + bl]

views = [binc[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for v in j['bufferViews']]
for img in j.get('images', []):
    i = img['bufferView']; im = Image.open(io.BytesIO(views[i])); im.load()
    if max(im.size) > a.max:
        im = im.resize((a.max, a.max) if im.size[0] == im.size[1] else (round(im.size[0] * a.max / max(im.size)), round(im.size[1] * a.max / max(im.size))), Image.LANCZOS)
    buf = io.BytesIO()
    if im.mode in ('RGBA', 'LA') and im.getextrema()[-1][0] < 255:  # transparência real: mantém PNG
        im.save(buf, 'PNG', optimize=True); img['mimeType'] = 'image/png'
    else:
        im.convert('RGB').save(buf, 'JPEG', quality=a.q, optimize=True); img['mimeType'] = 'image/jpeg'
    views[i] = buf.getvalue()

out = bytearray()
for v, b in zip(j['bufferViews'], views):
    while len(out) % 4: out.append(0)
    v['byteOffset'] = len(out); v['byteLength'] = len(b); v['buffer'] = 0; out += b
while len(out) % 4: out.append(0)
j['buffers'] = [{'byteLength': len(out)}]
js = json.dumps(j, separators=(',', ':')).encode()
js += b' ' * ((4 - len(js) % 4) % 4)
total = 12 + 8 + len(js) + 8 + len(out)
with open(a.dst, 'wb') as f:
    f.write(struct.pack('<4sII', b'glTF', 2, total))
    f.write(struct.pack('<I4s', len(js), b'JSON')); f.write(js)
    f.write(struct.pack('<I4s', len(out), b'BIN\x00')); f.write(out)
print(f'{a.src} -> {a.dst}: {len(data) // 1024} KB -> {total // 1024} KB')
