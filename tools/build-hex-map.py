#!/usr/bin/env python3
"""
Build the hex-lattice land mask for the roadmap background globe (assets/js/roadmap-map.js).

Source: Natural Earth 1:50m admin-0 countries (public domain) via the `world-atlas` npm package.
    curl -o countries-50m.json https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json
    python3 tools/build-hex-map.py countries-50m.json

Lattice
  A geodesic grid: an icosahedron whose 20 faces are subdivided F times and projected onto the
  sphere. Every point has 6 neighbours (12 have 5), which reads as a hexagonal dot network.
  The point ORDER is fully deterministic and mirrored exactly in roadmap-map.js:
      1. the 12 icosahedron vertices
      2. interior points of the 30 edges (edges sorted as (min,max) index pairs, k = 1..F-1)
      3. interior points of the 20 faces (face order below, i = 1..F-2, j = 1..F-1-i)
  so the browser can rebuild the positions itself; this file only ships each point's kind.

Kinds: 0 sea · 1 land · 2 Vietnam (incl. Hoàng Sa & Trường Sa) · 3 Taiwan — run-length encoded as varints of (run << 2 | kind).
"""
import base64, json, math, os, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else 'countries-50m.json'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'js', 'hex-map-data.js')
F = 180                              # subdivisions per icosahedron edge  (~0.35° spacing)
RES = 0.1                            # land raster cell size in degrees
KIND = {'704': 2, '158': 3}          # ISO numeric: Vietnam, Taiwan

# ---------- 1. rasterise countries (scanline, even-odd) ----------
W, H = int(360 / RES), int(180 / RES)
topo = json.load(open(SRC))
sx, sy = topo['transform']['scale']; tx, ty = topo['transform']['translate']

def decode_arc(arc):
    x = y = 0; pts = []
    for dx, dy in arc:
        x += dx; y += dy
        pts.append((x * sx + tx, y * sy + ty))
    return pts

arcs = [decode_arc(a) for a in topo['arcs']]

def ring_coords(idx):
    pts = []
    for i in idx:
        a = arcs[i] if i >= 0 else arcs[~i][::-1]
        pts.extend(a if not pts else a[1:])
    return pts

grid = bytearray(W * H)
for geom in topo['objects']['countries']['geometries']:
    kind = KIND.get(geom.get('id'), 1)
    polys = geom['arcs'] if geom['type'] == 'MultiPolygon' else [geom['arcs']] if geom['type'] == 'Polygon' else []
    rows = {}
    for poly in polys:
        for ring in poly:
            pts = ring_coords(ring)
            for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
                if abs(x2 - x1) > 180 or y1 == y2:
                    continue
                lo, hi = (y1, y2) if y1 < y2 else (y2, y1)
                for r in range(max(math.ceil((lo + 90) / RES - 0.5), 0), min(math.ceil((hi + 90) / RES - 0.5), H)):
                    lat = -90 + (r + 0.5) * RES
                    rows.setdefault(r, []).append(x1 + (lat - y1) * (x2 - x1) / (y2 - y1))
    for r, xs in rows.items():
        xs.sort(); base = r * W
        for a, b in zip(xs[0::2], xs[1::2]):
            for c in range(max(0, math.ceil((a + 180) / RES - 0.5)), min(W, math.ceil((b + 180) / RES - 0.5))):
                if grid[base + c] < kind:
                    grid[base + c] = kind

# Vietnam's two archipelagos in the East Sea (Biển Đông). They are too small for the 1:50m data, so they are
# added explicitly as small clusters of Vietnam-coloured dots: (lat, lon, radius in degrees).
ARCHIPELAGOS = [
    # Hoàng Sa: Lưỡi Liềm (Crescent) group · An Vĩnh (Amphitrite) group
    (16.50, 111.70, 0.45), (16.90, 112.30, 0.45),
    # Trường Sa: Trường Sa Lớn · Ba Bình · Thị Tứ / Song Tử · Sinh Tồn · An Bang · Thuyền Chài
    (8.64, 111.92, 0.36), (10.38, 114.36, 0.36), (11.25, 114.30, 0.36), (9.88, 114.33, 0.36), (7.89, 112.92, 0.36), (8.10, 113.30, 0.36),
]

def gc_deg(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    d = math.sin(p1) * math.sin(p2) + math.cos(p1) * math.cos(p2) * math.cos(math.radians(lon2 - lon1))
    return math.degrees(math.acos(max(-1.0, min(1.0, d))))

def kind_at(x, y, z):
    # inverse of ll2v() in roadmap-map.js:  x = cosφ·cosλ, y = sinφ, z = −cosφ·sinλ
    n = math.sqrt(x * x + y * y + z * z)
    lat = math.degrees(math.asin(y / n)); lon = math.degrees(math.atan2(-z, x))
    r = min(H - 1, max(0, int((lat + 90) / RES)))
    c = int(((lon + 180) % 360) / RES) % W
    k = grid[r * W + c]
    if k == 0 and 5 < lat < 19 and 110 < lon < 117:
        for alat, alon, rad in ARCHIPELAGOS:
            if gc_deg(lat, lon, alat, alon) <= rad:
                return 2
    return k

# ---------- 2. geodesic lattice in canonical order ----------
t = (1 + 5 ** 0.5) / 2
V = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t),
     (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
FACES = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
         (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
EDGES = sorted({tuple(sorted(e)) for f in FACES for e in ((f[0], f[1]), (f[1], f[2]), (f[2], f[0]))})
assert len(EDGES) == 30

kinds = []
for v in V:
    kinds.append(kind_at(*v))
for a, b in EDGES:
    A, B = V[a], V[b]
    for k in range(1, F):
        u = k / F
        kinds.append(kind_at(*(A[d] + (B[d] - A[d]) * u for d in range(3))))
for a, b, c in FACES:
    A, B, C = V[a], V[b], V[c]
    for i in range(1, F - 1):
        for j in range(1, F - i):
            u, w = i / F, j / F
            kinds.append(kind_at(*(A[d] + (B[d] - A[d]) * u + (C[d] - A[d]) * w for d in range(3))))
assert len(kinds) == 10 * F * F + 2, len(kinds)

# ---------- 3. run-length encode ----------
out = bytearray()
def varint(n):
    while True:
        b = n & 0x7F; n >>= 7
        out.append(b | (0x80 if n else 0))
        if not n: break
run_kind, run_len, runs = kinds[0], 0, 0
for k in kinds:
    if k == run_kind:
        run_len += 1
    else:
        varint(run_len << 2 | run_kind); runs += 1
        run_kind, run_len = k, 1
varint(run_len << 2 | run_kind); runs += 1

b64 = base64.b64encode(bytes(out)).decode()
cnt = [kinds.count(i) for i in range(4)]
with open(OUT, 'w') as f:
    f.write('// Generated by tools/build-hex-map.py from Natural Earth 1:50m (public domain) — do not edit.\n')
    f.write(f'// Geodesic lattice F={F}: {len(kinds)} points · sea {cnt[0]} · land {cnt[1]} · Vietnam {cnt[2]} · Taiwan {cnt[3]}\n')
    f.write(f'export const F = {F};\nexport default "{b64}";\n')
print(f'points={len(kinds)} sea={cnt[0]} land={cnt[1]} VN={cnt[2]} TW={cnt[3]} runs={runs} bytes={len(out)} b64={len(b64)}')
