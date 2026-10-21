"""Procedural hand-painted textures, generated with numpy and saved as PNG.

Everything here is ours: brush washes are band-limited noise shaped into strokes, patterns (calçada waves,
azulejos, setts, roof tiles) are drawn from distance fields. All textures tile seamlessly (noise is built in
the frequency domain, cell patterns wrap). Arrays are [row, col, channel] with row 0 at the bottom (UV v=0)
and hold display (sRGB) values in 0..1; normal maps are OpenGL (+Y) tangent-space.
"""
import math
import os

import bpy
import numpy as np

OUT = None          # set by build script: folder for PNGs
_cache = {}


# ---------------------------------------------------------------- noise basics
def _freqs(n):
    f = np.fft.fftfreq(n).astype(np.float32)
    return f[None, :], f[:, None]


def noise(n, sx, sy=None, angle=0.0, seed=0):
    """Tileable gaussian-filtered noise, std 1. sx, sy: feature size in pixels along the rotated axes."""
    sy = sx if sy is None else sy
    rng = np.random.default_rng(seed)
    w = rng.standard_normal((n, n)).astype(np.float32)
    fx, fy = _freqs(n)
    c, s = math.cos(angle), math.sin(angle)
    u = fx * c + fy * s
    v = -fx * s + fy * c
    g = np.exp(-2.0 * math.pi ** 2 * ((u * sx) ** 2 + (v * sy) ** 2)).astype(np.float32)
    r = np.real(np.fft.ifft2(np.fft.fft2(w) * g)).astype(np.float32)
    r -= r.mean()
    r /= (r.std() + 1e-8)
    return r


def fbm(n, size, octaves=4, gain=0.5, seed=0, aniso=1.0, angle=0.0):
    out = np.zeros((n, n), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        out += amp * noise(n, size, size * aniso, angle, seed + o * 17)
        tot += amp
        amp *= gain
        size *= 0.5
    return out / tot


def brush_wash(n, size, seed, strokes=6):
    """Overlapping directional strokes at random angles: the 'painted' low-frequency wash."""
    rng = np.random.default_rng(seed)
    out = np.zeros((n, n), np.float32)
    for k in range(strokes):
        ang = rng.uniform(0, math.pi)
        s = size * rng.uniform(0.6, 1.4)
        out += noise(n, s * 0.35, s * 1.8, ang, seed * 31 + k)
    return out / math.sqrt(strokes)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def hexc(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)


def lerp(a, b, t):
    t = t[..., None] if np.ndim(t) == 2 else t
    return a + (b - a) * t


def voronoi(n, cells_x, cells_y=None, seed=0, jitter=0.85):
    """Periodic voronoi. Returns F1, F2 (in cell units), cell id, cell-centre (x, y) in 0..1 texture space."""
    cells_y = cells_x if cells_y is None else cells_y
    rng = np.random.default_rng(seed)
    jx = rng.uniform(0.5 - jitter / 2, 0.5 + jitter / 2, (cells_y, cells_x)).astype(np.float32)
    jy = rng.uniform(0.5 - jitter / 2, 0.5 + jitter / 2, (cells_y, cells_x)).astype(np.float32)
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    px = (xs + 0.5) / n * cells_x
    py = (ys + 0.5) / n * cells_y
    cx = np.floor(px).astype(np.int32)
    cy = np.floor(py).astype(np.int32)
    f1 = np.full((n, n), 9.0, np.float32)
    f2 = np.full((n, n), 9.0, np.float32)
    cid = np.zeros((n, n), np.int32)
    ccx = np.zeros((n, n), np.float32)
    ccy = np.zeros((n, n), np.float32)
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            gx = cx + ox
            gy = cy + oy
            wx = gx % cells_x
            wy = gy % cells_y
            ptx = gx + jx[wy, wx]
            pty = gy + jy[wy, wx]
            d = np.sqrt((px - ptx) ** 2 + (py - pty) ** 2)
            closer = d < f1
            f2 = np.where(closer, f1, np.minimum(f2, d))
            f1 = np.where(closer, d, f1)
            cid = np.where(closer, wy * cells_x + wx, cid)
            ccx = np.where(closer, (ptx % cells_x) / cells_x, ccx)
            ccy = np.where(closer, (pty % cells_y) / cells_y, ccy)
    return f1, f2, cid, ccx, ccy


def cell_rand(cid, seed, count=None):
    rng = np.random.default_rng(seed)
    table = rng.random(int(cid.max()) + 1 if count is None else count).astype(np.float32)
    return table[cid]


def height_to_normal(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    nz = np.ones_like(h)
    l = np.sqrt(dx * dx + dy * dy + 1)
    return np.stack([(-dx / l) * 0.5 + 0.5, (-dy / l) * 0.5 + 0.5, (nz / l) * 0.5 + 0.5], -1)


def downsample(a, f):
    n = a.shape[0] // f
    return a.reshape(n, f, n, f, *a.shape[2:]).mean(axis=(1, 3))


# ---------------------------------------------------------------- image I/O
def write_png(path, arr):
    """Lossless PNG with per-row Paeth-free 'Sub'/'Up' filtering and zlib level 9: ~30% smaller than Blender's
    default save. arr: (h, w, c) uint8, row 0 = bottom (UV v=0), so rows are flipped for PNG."""
    import struct
    import zlib
    a = arr[::-1]
    h, w, c = a.shape
    a16 = a.astype(np.int16)
    sub = np.concatenate([a16[:, :1], a16[:, 1:] - a16[:, :-1]], 1) % 256
    up = np.concatenate([a16[:1], a16[1:] - a16[:-1]], 0) % 256
    rows = []
    for y in range(h):
        # pick the filter with the smaller sum of absolute signed residuals for this row
        s_cost = np.abs(((sub[y] + 128) % 256) - 128).sum()
        u_cost = np.abs(((up[y] + 128) % 256) - 128).sum()
        if u_cost < s_cost:
            rows.append(b'\x02' + up[y].astype(np.uint8).tobytes())
        else:
            rows.append(b'\x01' + sub[y].astype(np.uint8).tobytes())
    raw = zlib.compress(b''.join(rows), 9)

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6 if c == 4 else 2, 0, 0, 0)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', raw) + chunk(b'IEND', b''))


def save(name, arr, non_color=False):
    """arr: (h, w, 3|4) display values. Writes a compact PNG into OUT and loads it as a Blender image."""
    if name in _cache:
        return _cache[name]
    arr = np.clip(arr, 0, 1)
    u8 = (arr * 255 + 0.5).astype(np.uint8)
    path = os.path.join(OUT, name + '.png')
    write_png(path, u8)
    img = bpy.data.images.load(path, check_existing=False)
    img.name = name
    img.colorspace_settings.name = 'Non-Color' if non_color else 'sRGB'
    _cache[name] = img
    return img


def get(name):
    """Build (once) and return the Blender image for a texture name."""
    if name in _cache:
        return _cache[name]
    fn = GENERATORS[name]
    res = fn()
    if isinstance(res, dict):  # generator produced several images (albedo + normal)
        for k, (arr, nc) in res.items():
            save(k, arr, nc)
        return _cache[name]
    return save(name, res)


# ---------------------------------------------------------------- generators
def plaster():
    """Neutral warm-white lime plaster wash; tinted per building by the material colour factor."""
    n = 2048
    wash = brush_wash(n, 160, 11, 7)
    fine = fbm(n, 22, 3, seed=12)
    blot = fbm(n, 380, 2, seed=13)
    drips = noise(n, 6, 260, 0.0, 14)               # vertical rain streaks
    drip_mask = smoothstep(0.6, 1.8, noise(n, 120, 120, 0, 15))
    L = 0.86 + 0.022 * wash + 0.012 * fine + 0.012 * blot - 0.025 * np.clip(drips, 0, None) * drip_mask
    hue = noise(n, 300, 300, 0, 16)
    warm = np.array([1.0, 0.985, 0.955], np.float32)
    rgb = L[..., None] * warm * (1 + 0.02 * hue[..., None] * np.array([1.0, 0.3, -0.6], np.float32))
    # chipped patches showing the older, pinkish undercoat and a few bricks
    pm = fbm(n, 120, 3, seed=17)
    chip = smoothstep(2.05, 2.15, pm)
    rim = smoothstep(1.85, 2.05, pm) - chip
    under = np.array([0.80, 0.70, 0.64], np.float32) * (0.95 + 0.05 * fine[..., None])
    rgb = lerp(rgb, under, chip)
    rgb = rgb * (1 + 0.06 * rim[..., None])
    # repair patches: rectangles of fresher plaster (tileable via wrap)
    rng = np.random.default_rng(18)
    for _ in range(5):
        x0, y0 = rng.integers(0, n, 2)
        w, h = rng.integers(90, 260, 2)
        ys = (np.arange(y0, y0 + h) % n)[:, None]
        xs = (np.arange(x0, x0 + w) % n)[None, :]
        rgb[ys, xs] *= np.float32(1.03)
    height = 0.6 * wash + 0.25 * fine + 2.0 * chip
    nrm = height_to_normal(downsample(height, 2), 0.7)
    return {'plaster': (rgb, False), 'plaster_n': (nrm, True)}


def lioz():
    """Cream lioz limestone for frames, sills, cornices and balconies."""
    n = 1024
    base = hexc('#E6D7BC')
    v = fbm(n, 90, 4, seed=21)
    veins = np.abs(np.sin((np.mgrid[0:n, 0:n][1] / n * 2 * math.pi * 3) + 3.0 * fbm(n, 140, 3, seed=22)))
    veins = 1 - smoothstep(0.0, 0.08, veins)
    speck = smoothstep(2.4, 2.8, noise(n, 1.4, seed=23))
    grime = smoothstep(0.3, 1.5, fbm(n, 200, 2, seed=24))
    rgb = base * (1 + 0.04 * v[..., None])
    rgb = lerp(rgb, rgb * np.array([0.93, 0.9, 0.86]), veins * 0.6)
    rgb = lerp(rgb, np.array([0.55, 0.48, 0.40]), speck * 0.5)
    rgb = lerp(rgb, rgb * np.array([0.86, 0.84, 0.82]), grime * 0.5)
    nrm = height_to_normal(fbm(n, 10, 3, seed=25), 1.2)
    return {'lioz': (rgb, False), 'lioz_n': (downsample(nrm, 2), True)}


def granite():
    n = 1024
    base = hexc('#A39C90')
    s1 = smoothstep(1.2, 1.6, noise(n, 1.5, seed=31))
    s2 = smoothstep(1.4, 1.8, noise(n, 1.5, seed=32))
    m = fbm(n, 70, 3, seed=33)
    rgb = base * (1 + 0.06 * m[..., None])
    rgb = lerp(rgb, np.array([0.30, 0.29, 0.30]), s1 * 0.8)
    rgb = lerp(rgb, np.array([0.88, 0.84, 0.80]), s2 * 0.6)
    return rgb


def setts():
    """Granite setts in running-bond rows (12 x 10 per tile), with dark joints and worn domes."""
    n = 1024
    cols, rows = 10, 12
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    warp = 0.06
    u = xs / n * cols + warp * noise(n, 40, seed=41)
    v = ys / n * rows + warp * noise(n, 40, seed=42)
    row = np.floor(v)
    u = u + 0.5 * (row % 2)
    col = np.floor(u)
    fu = u - col
    fv = v - row
    d = np.minimum(np.minimum(fu, 1 - fu), np.minimum(fv, 1 - fv))
    cid = ((row.astype(np.int32) % rows) * cols + (col.astype(np.int32) % cols))
    r = cell_rand(cid, 43, rows * cols)
    r2 = cell_rand(cid, 44, rows * cols)
    base = lerp(hexc('#8F887E'), hexc('#B2A897'), r)
    base = lerp(base, hexc('#8A7E70'), (r2 > 0.8) * 0.6)
    gran = granite()
    gran = gran / gran.mean(axis=(0, 1))
    rgb = base * gran
    joint = 1 - smoothstep(0.02, 0.07, d)
    dome = smoothstep(0.0, 0.25, d)
    rgb = rgb * (0.82 + 0.18 * dome[..., None])
    polish = smoothstep(0.15, 0.45, d) * (0.5 + 0.5 * noise(n, 30, seed=45))
    rgb = rgb * (1 + 0.08 * polish[..., None])
    rgb = lerp(rgb, hexc('#3B342E'), joint * 0.85)
    h = dome + 0.15 * noise(n, 3, seed=46)
    return {'setts': (rgb, False), 'setts_n': (height_to_normal(h, 3.0), True)}


def calcada():
    """Calçada portuguesa: white limestone and black basalt cubes in our own wide wave pattern."""
    n = 2048
    cells = 48
    f1, f2, cid, ccx, ccy = voronoi(n, cells, seed=51, jitter=0.7)
    # wave field evaluated at each cube's centre so every cube is one colour
    wave = ccy * 2.0 + 0.16 * np.sin(2 * math.pi * ccx) + 0.05 * np.sin(4 * math.pi * ccx + 1.0)
    band = np.mod(wave, 1.0)
    dark = (band < 0.36).astype(np.float32)
    r = cell_rand(cid, 52)
    r2 = cell_rand(cid, 53)
    white = lerp(hexc('#E9E1D0'), hexc('#D8CCB4'), r)
    black = lerp(hexc('#3A3734'), hexc('#57514A'), r)
    rgb = lerp(white, black, dark)
    rgb = lerp(rgb, rgb * np.array([0.92, 0.86, 0.78]), (r2 > 0.85) * 0.7)   # stained cubes
    edge = f2 - f1
    joint = 1 - smoothstep(0.03, 0.11, edge)
    dome = smoothstep(0.0, 0.35, edge)
    rgb = rgb * (0.86 + 0.14 * dome[..., None])
    grime = smoothstep(0.0, 1.6, fbm(n, 260, 3, seed=54))
    rgb = lerp(rgb, rgb * np.array([0.88, 0.85, 0.8]), grime * 0.5)
    rgb = lerp(rgb, hexc('#4A423A'), joint * 0.85)
    h = dome + 0.1 * noise(n, 4, seed=55)
    nrm = height_to_normal(downsample(h, 2), 2.2)
    return {'calcada': (rgb, False), 'calcada_n': (nrm, True)}


def roof_tile():
    """Terracotta canal tiles: 16 channels x 16 rows per texture (one period of 3.84 m x 6.72 m on the roof), each
    tile its own fired colour, with soft large-scale patches of older and newer tiles so roofs don't checker."""
    n = 2048
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    cu = cv = 16
    u = xs / n * cu
    v = ys / n * cv
    ci = np.floor(u).astype(np.int32) % cu
    cj = np.floor(v).astype(np.int32) % cv
    cid = cj * cu + ci
    r = cell_rand(cid, 61, cu * cv)
    r2 = cell_rand(cid, 62, cu * cv)
    base = lerp(hexc('#BA5A32'), hexc('#C77446'), r)
    base = lerp(base, hexc('#9A4A2C'), (r2 > 0.88) * 0.5)
    patches = brush_wash(n, 420, 66, 5)
    base = lerp(base, hexc('#A85538'), smoothstep(0.3, 1.6, patches) * 0.45)     # older weathered patches
    base = lerp(base, hexc('#D08452'), smoothstep(0.6, 1.9, -patches) * 0.35)    # newer replacement tiles
    fv = v - np.floor(v)
    # lower lip of each tile is darker (it sits in the shadow of the next row), top is sun-bleached
    lip = smoothstep(0.0, 0.12, fv)
    rgb = base * (0.84 + 0.16 * lip[..., None])
    rgb = rgb * (1 + 0.06 * smoothstep(0.6, 1.0, fv)[..., None])
    wash = brush_wash(n, 90, 63, 4)
    rgb = rgb * (1 + 0.04 * wash[..., None])
    lichen = smoothstep(1.8, 2.3, fbm(n, 40, 3, seed=64))
    rgb = lerp(rgb, hexc('#C8B77A'), lichen * 0.6)
    soot = smoothstep(0.8, 2.2, fbm(n, 300, 2, seed=65))
    rgb = lerp(rgb, rgb * 0.8, soot * 0.35)
    return rgb


def _azulejo(seed, ink, ink_light, glaze, motif):
    """4x4 tiles (256 px each). motif(x, y) -> ink coverage, x, y in -1..1 tile space."""
    n = 1024
    tp = n // 4
    out = np.zeros((n, n, 3), np.float32)
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:tp, 0:tp].astype(np.float32)
    for j in range(4):
        for i in range(4):
            off = rng.normal(0, 0.012, 2)
            x = (xx + 0.5) / tp * 2 - 1 + off[0]
            y = (yy + 0.5) / tp * 2 - 1 + off[1]
            ink_amt, light_amt = motif(x, y, i, j)
            g = glaze * (1 + rng.normal(0, 0.015))
            wob = noise(tp, 6, seed=seed * 100 + j * 4 + i)
            col = np.broadcast_to(g, (tp, tp, 3)).copy()
            col = lerp(col, ink_light, np.clip(light_amt + 0.05 * wob, 0, 1))
            col = lerp(col, ink * (1 + 0.08 * wob[..., None]), np.clip(ink_amt + 0.04 * wob, 0, 1))
            # glaze pooling darker at the edge, crackle
            e = np.maximum(np.abs(x), np.abs(y))
            col = col * (1 - 0.10 * smoothstep(0.88, 1.0, e)[..., None])
            out[j * tp:(j + 1) * tp, i * tp:(i + 1) * tp] = col
    crack_f1, crack_f2, *_ = voronoi(n, 22, seed=seed + 1)
    crack = 1 - smoothstep(0.0, 0.025, crack_f2 - crack_f1)
    out = out * (1 - 0.12 * crack[..., None])
    return out


def _ring(d, r, w):
    return 1 - smoothstep(w * 0.6, w, np.abs(d - r))


def azulejo_blue():
    """Blue and white: quarter-circle corners make full rings across tiles, plus a central four-petal flower."""
    ink, light, glaze = hexc('#2F5D8C'), hexc('#7FA7C9'), hexc('#E9E4D6')

    def motif(x, y, i, j):
        ax, ay = np.abs(x), np.abs(y)
        dc = np.sqrt((ax - 1) ** 2 + (ay - 1) ** 2)            # distance to nearest corner
        ring = _ring(dc, 0.62, 0.09)
        corner = 1 - smoothstep(0.30, 0.34, dc)
        # four-petal flower in the centre
        a = np.arctan2(y, x)
        rr = np.sqrt(x * x + y * y)
        petal = 1 - smoothstep(0.0, 0.03, rr - (0.18 + 0.22 * np.abs(np.cos(2 * a))))
        heart = 1 - smoothstep(0.08, 0.11, rr)
        light_fill = petal * (1 - heart)
        ink_amt = np.clip(ring + corner + heart + 0.9 * (petal - smoothstep(-0.06, -0.02, rr - (0.16 + 0.2 * np.abs(np.cos(2 * a))))), 0, 1)
        return ink_amt, light_fill + 0.6 * (1 - smoothstep(0.5, 0.56, dc)) * (1 - corner)
    return _azulejo(71, ink, light, glaze, motif)


def azulejo_lattice():
    """Blue ground with a white diagonal lattice and small stars: a dense 'carpet' pattern."""
    ink, light, glaze = hexc('#244C78'), hexc('#5F8DB8'), hexc('#ECE6D6')

    def motif(x, y, i, j):
        d1 = np.abs(x + y)
        d2 = np.abs(x - y)
        lattice = 1 - smoothstep(0.08, 0.12, np.minimum(d1, d2))
        rr = np.sqrt(x * x + y * y)
        a = np.arctan2(y, x)
        star = 1 - smoothstep(0.0, 0.03, rr - (0.12 + 0.1 * np.abs(np.cos(4 * a))))
        edge = np.maximum(np.abs(x), np.abs(y))
        bead = 1 - smoothstep(0.08, 0.11, np.sqrt((np.abs(x) - 1) ** 2 + y ** 2))
        bead = np.maximum(bead, 1 - smoothstep(0.08, 0.11, np.sqrt(x ** 2 + (np.abs(y) - 1) ** 2)))
        white = np.clip(lattice + star + bead, 0, 1)
        ink_amt = 1 - white
        return ink_amt * 0.95, 0.4 * (1 - smoothstep(0.55, 0.6, edge)) * ink_amt
    return _azulejo(72, ink, light, glaze, motif)


def azulejo_green():
    """Green and white: a stepped 'ponta de diamante' style relief pattern painted flat, our own variant."""
    ink, light, glaze = hexc('#3E7A5E'), hexc('#7FB197'), hexc('#EAE6D4')

    def motif(x, y, i, j):
        ax, ay = np.abs(x), np.abs(y)
        diamond = ax + ay
        rings = np.mod(diamond * 2.2, 1.0)
        band = 1 - smoothstep(0.12, 0.2, np.abs(rings - 0.5))
        centre = 1 - smoothstep(0.18, 0.22, diamond)
        facet = (x * y > 0).astype(np.float32)
        return np.clip(band * 0.9 + centre, 0, 1), 0.55 * facet * (1 - band)
    return _azulejo(73, ink, light, glaze, motif)


def wood_paint():
    """Neutral painted planks (vertical grain) with chipped paint, tinted per material."""
    n = 512
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    planks = 4
    pu = xs / n * planks
    seam = 1 - smoothstep(0.0, 0.03, np.minimum(pu % 1, 1 - pu % 1))
    grain = noise(n, 1.5, 40, 0.0, 81)
    wash = brush_wash(n, 40, 82, 4)
    chip = smoothstep(1.9, 2.1, fbm(n, 25, 3, seed=83))
    L = 0.92 + 0.03 * grain + 0.03 * wash
    rgb = np.stack([L, L * 0.99, L * 0.97], -1)
    rgb = lerp(rgb, np.array([0.55, 0.50, 0.45]), chip)
    rgb = rgb * (1 - 0.35 * seam[..., None])
    h = -seam + 0.3 * grain * 0.1 - chip * 0.5
    return {'wood_paint': (rgb, False), 'wood_paint_n': (height_to_normal(h, 2.0), True)}


def paint_metal():
    """Neutral enamel paint on metal with soft wear and drips, tinted per material."""
    n = 512
    wash = brush_wash(n, 50, 91, 5)
    chip = smoothstep(2.1, 2.3, fbm(n, 18, 3, seed=92))
    streak = np.clip(noise(n, 3, 90, 0.0, 93), 0, None) * smoothstep(0.5, 1.5, noise(n, 60, seed=94))
    L = 0.95 + 0.02 * wash - 0.04 * streak
    rgb = np.stack([L, L, L * 0.98], -1)
    rgb = lerp(rgb, np.array([0.42, 0.38, 0.36]), chip * 0.8)
    return rgb


def glass():
    """Window glass: a painted reflection of warm sky above and dark room below, with a diagonal sheen."""
    n = 256
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32) / n
    top = hexc('#6E7F8E')
    low = hexc('#1E2630')
    t = smoothstep(0.25, 0.95, ys)
    rgb = lerp(low, top, t)
    sheen = np.exp(-((xs - ys * 0.6 - 0.15) ** 2) / 0.004)
    rgb = rgb + np.array([0.20, 0.17, 0.12]) * sheen[..., None] * 0.7
    return rgb


def signs():
    """2x2 atlas of painted wooden sign boards with simple pictograms (no lettering)."""
    n = 512
    h = n // 2
    out = np.zeros((n, n, 3), np.float32)
    yy, xx = np.mgrid[0:h, 0:h].astype(np.float32)
    x = (xx + 0.5) / h * 2 - 1
    y = (yy + 0.5) / h * 2 - 1
    boards = [('#2E5B45', '#EFE2C6'), ('#7A2E2A', '#F2C96B'), ('#2F5D8C', '#EFE2C6'), ('#3B2F2A', '#E8B04A')]
    for k, (bg, fg) in enumerate(boards):
        wash = brush_wash(h, 30, 100 + k, 4)
        col = np.broadcast_to(hexc(bg), (h, h, 3)) * (1 + 0.06 * wash[..., None])
        border = (np.maximum(np.abs(x), np.abs(y)) > 0.84) & (np.maximum(np.abs(x), np.abs(y)) < 0.9)
        rr = np.sqrt(x * x + y * y)
        if k == 0:    # coffee cup
            ic = ((np.abs(x) < 0.38) & (y > -0.45) & (y < 0.2)) | ((np.sqrt((x - 0.48) ** 2 + (y + 0.1) ** 2) < 0.16) & (np.sqrt((x - 0.48) ** 2 + (y + 0.1) ** 2) > 0.08))
            ic |= (np.abs(y + 0.55) < 0.05) & (np.abs(x) < 0.55)
            ic |= (np.abs(x - 0.12 * np.sin(y * 12)) < 0.04) & (y > 0.3) & (y < 0.7)
        elif k == 1:  # tart
            ic = (np.abs(x) < 0.55 + 0.08 * (y + 0.4)) & (y > -0.4) & (y < 0.0)
            ic |= (np.sqrt(x * x / 0.3 + (y - 0.0) ** 2 / 0.02) < 1.0)
            ic &= ~((np.sqrt((x + 0.1) ** 2 + (y - 0.02) ** 2) < 0.12))
        elif k == 2:  # fish
            ic = ((x / 0.5) ** 2 + (y / 0.25) ** 2 < 1) | ((x > 0.45) & (np.abs(y) < (x - 0.45) * 0.9) & (x < 0.75))
            ic &= ~(np.sqrt((x + 0.28) ** 2 + (y - 0.05) ** 2) < 0.05)
        else:         # key
            ic = (rr < 0.28) & (rr > 0.15)
            ic |= (np.abs(y) < 0.05) & (x > 0.2) & (x < 0.75)
            ic |= (x > 0.55) & (x < 0.62) & (y < 0) & (y > -0.2)
        col = lerp(col, hexc(fg), (ic | border).astype(np.float32) * 0.95)
        out[(k // 2) * h:(k // 2 + 1) * h, (k % 2) * h:(k % 2 + 1) * h] = col
    return out


def fabric():
    """4x4 atlas of cloth: awning stripes, laundry colours, tablecloth check."""
    n = 512
    c = n // 4
    out = np.zeros((n, n, 3), np.float32)
    yy, xx = np.mgrid[0:c, 0:c].astype(np.float32) / c
    weave = 1 + 0.03 * noise(c, 1.2, seed=111)[..., None]
    specs = [('stripe', '#2E6F8E', '#EFE2C6'), ('stripe', '#B8552E', '#EFE2C6'), ('stripe', '#2E5B45', '#E8D8B0'),
             ('check', '#C8473F', '#F3EEE2'), ('plain', '#F3EEE2', None), ('plain', '#E7B65A', None),
             ('plain', '#7FA7C9', None), ('plain', '#D98E7A', None), ('plain', '#5C7F5A', None),
             ('stripe', '#2F5D8C', '#F3EEE2'), ('plain', '#EFD9D2', None), ('plain', '#3A3F6B', None),
             ('dots', '#F2B632', '#F3EEE2'), ('plain', '#9C4A5A', None), ('plain', '#E9E4D6', None), ('plain', '#6E8FA0', None)]
    for k, (kind, a, b) in enumerate(specs):
        col = np.broadcast_to(hexc(a), (c, c, 3)).copy()
        if kind == 'stripe':
            m = (np.floor(xx * 6) % 2 == 0).astype(np.float32)
            col = lerp(col, hexc(b), m)
        elif kind == 'check':
            m = ((np.floor(xx * 6) + np.floor(yy * 6)) % 2 == 0).astype(np.float32)
            col = lerp(col, hexc(b), m)
        elif kind == 'dots':
            m = ((np.mod(xx * 5, 1) - 0.5) ** 2 + (np.mod(yy * 5, 1) - 0.5) ** 2 < 0.06).astype(np.float32)
            col = lerp(col, hexc(b), m)
        col = col * weave * (1 + 0.05 * brush_wash(c, 12, 120 + k, 3)[..., None])
        out[(k // 4) * c:(k // 4 + 1) * c, (k % 4) * c:(k % 4 + 1) * c] = col
    return out


def foliage():
    """Leafy clumps: dark-to-light greens with bougainvillea magenta and geranium red flowers."""
    n = 512
    f1, f2, cid, *_ = voronoi(n, 28, seed=131)
    r = cell_rand(cid, 132)
    leaf = lerp(hexc('#2F5A2E'), hexc('#6E9A45'), r)
    leaf = leaf * (0.75 + 0.25 * smoothstep(0.0, 0.3, f2 - f1)[..., None])
    fl1 = smoothstep(1.2, 1.5, noise(n, 6, seed=133))
    fl2 = smoothstep(1.6, 1.9, noise(n, 5, seed=134))
    leaf = lerp(leaf, hexc('#C2367A'), fl1 * 0.95)
    leaf = lerp(leaf, hexc('#D8432F'), fl2 * 0.95)
    return leaf


def far_facade():
    """Painted mid-ground façade: 2 window bays x 1 storey per texture tile (3.2 m), tinted per material."""
    n = 512
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32) / n
    wash = brush_wash(n, 40, 141, 4)
    rgb = np.stack([0.93 + 0.03 * wash] * 3, -1) * np.array([1.0, 0.99, 0.97])
    bx = np.mod(xs * 2, 1)
    win = (np.abs(bx - 0.5) < 0.17) & (ys > 0.28) & (ys < 0.8)
    frame = (np.abs(bx - 0.5) < 0.22) & (ys > 0.24) & (ys < 0.84) & ~win
    shut = ((np.abs(bx - 0.5) > 0.17) & (np.abs(bx - 0.5) < 0.3)) & (ys > 0.28) & (ys < 0.8)
    rgb = lerp(rgb, np.array([1.25, 1.22, 1.15]), frame.astype(np.float32) * 0.9)
    rgb = lerp(rgb, hexc('#2E5B45') * 1.3, (shut & ~frame).astype(np.float32) * 0.0)
    glassc = lerp(hexc('#2A313B'), hexc('#6E7F8E'), smoothstep(0.3, 0.8, ys))
    rgb = lerp(rgb, glassc * 1.1, win.astype(np.float32))
    band = (ys < 0.05)
    rgb = lerp(rgb, np.array([1.15, 1.12, 1.05]), band.astype(np.float32) * 0.6)
    return np.clip(rgb, 0, 1.3) / 1.3 * 1.25


def river():
    """Tejo water: blue-grey with wind ripples and warm sun glints, tiling every 60 m."""
    n = 1024
    rip = noise(n, 16, 2, 0.05, 151) * 0.6 + noise(n, 40, 6, 0.03, 152) * 0.4
    base = lerp(hexc('#86AFBE'), hexc('#A9CDD6'), smoothstep(-1.5, 1.5, fbm(n, 200, 2, seed=153)))
    rgb = base * (1 + 0.06 * rip[..., None])
    glint = smoothstep(1.8, 2.4, rip) * smoothstep(0.0, 1.2, noise(n, 90, seed=154))
    rgb = lerp(rgb, hexc('#FFE9C2'), glint * 0.9)
    return rgb


def sky():
    """Painted late-afternoon sky for the backdrop dome: warm haze at the horizon to soft blue above."""
    w, h = 2048, 1024
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    v = ys / h
    u = xs / w
    hz = hexc('#F3D2A6')
    mid = hexc('#E9C9A6')
    top = hexc('#8FB2CF')
    rgb = lerp(hz, mid, smoothstep(0.0, 0.25, v))
    rgb = lerp(rgb, top, smoothstep(0.2, 0.85, v))
    # sun glow toward the west (u ~ 0.62 faces west-south-west in the dome layout)
    d = np.sqrt(((u - 0.62) * 3.0) ** 2 + ((v - 0.12) * 1.5) ** 2)
    rgb = rgb + hexc('#FFD7A0') * (0.55 * np.exp(-d * 3.5))[..., None]
    nz = noise(1024, 110, 22, 0.03, 161)
    nz = np.concatenate([nz, nz], 1)[:h, :w]
    nz2 = noise(1024, 40, 10, 0.05, 162)
    nz2 = np.concatenate([nz2, nz2], 1)[:h, :w]
    cl = smoothstep(0.3, 1.6, nz + 0.35 * nz2) * smoothstep(0.15, 0.35, v) * (1 - smoothstep(0.6, 0.9, v))
    cloud = lerp(hexc('#F7DDBB'), hexc('#B7A7B9'), smoothstep(-0.5, 1.5, nz2))
    rgb = lerp(rgb, cloud, cl * 0.7)
    return np.clip(rgb, 0, 1)


def far_shore():
    """South bank (Almada) as a layered hazy painted silhouette with alpha: two ridges and town specks."""
    w, h = 2048, 512
    xs = np.arange(w, dtype=np.float32) / w
    ys = np.arange(h, dtype=np.float32)[:, None] / h
    ridge1 = 0.42 + 0.10 * np.sin(xs * 6.0 + 0.7) + 0.05 * np.sin(xs * 17 + 2) + 0.02 * np.sin(xs * 53)
    ridge2 = 0.30 + 0.06 * np.sin(xs * 9.0 + 2.1) + 0.03 * np.sin(xs * 23 + 1) + 0.01 * np.sin(xs * 71)
    a1 = (ys < ridge1[None, :]).astype(np.float32)
    a2 = (ys < ridge2[None, :]).astype(np.float32)
    far = hexc('#C9AFA6')
    near = hexc('#A9928F')
    rgb = np.broadcast_to(far, (h, w, 3)).copy()
    rgb = lerp(rgb, near, a2)
    rng = np.random.default_rng(171)
    town = np.zeros((h, w), np.float32)
    for _ in range(1400):
        x = rng.integers(0, w)
        top = int(ridge2[x] * h)
        y = rng.integers(max(0, top - 160), max(1, top))
        ww, hh = rng.integers(3, 9), rng.integers(2, 6)
        town[y:y + hh, x:x + ww] = rng.uniform(0.4, 1.0)
    town *= a2
    rgb = lerp(rgb, hexc('#EAD2B8'), town * 0.6)
    haze = smoothstep(0.0, 0.5, ys)
    rgb = lerp(rgb, hexc('#F3D2A6'), (0.25 + 0.35 * (1 - haze))[..., 0] if False else np.broadcast_to(0.25 + 0.3 * (1 - haze), (h, w)))
    alpha = np.clip(a1 + a2, 0, 1)
    edge = smoothstep(0.0, 0.004, ridge1[None, :] - ys)
    alpha = np.maximum(alpha * edge, a2)
    return np.concatenate([rgb, alpha[..., None]], -1)


def bridge():
    """Suspension bridge silhouette card (generic, hazy): two towers, catenary cables, long deck."""
    w, h = 2048, 512
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    x = xs / w
    y = ys / h
    deck = (np.abs(y - 0.30) < 0.012)
    t1, t2 = 0.33, 0.67
    tower = ((np.abs(x - t1) < 0.006) | (np.abs(x - t2) < 0.006)) & (y > 0.1) & (y < 0.92)
    beams = ((np.abs(x - t1) < 0.012) | (np.abs(x - t2) < 0.012)) & ((np.abs(y - 0.88) < 0.008) | (np.abs(y - 0.6) < 0.006))
    span = 0.92 - 0.30
    def cable(x0, x1, sag_to):
        t = (x - x0) / (x1 - x0)
        yc = 0.92 - (0.92 - sag_to) * (1 - (2 * t - 1) ** 2)
        return (np.abs(y - yc) < 0.004) & (t >= 0) & (t <= 1)
    side_l = (np.abs(y - (0.31 + 0.61 * np.clip(x / t1, 0, 1) ** 1.6)) < 0.004) & (x < t1)
    side_r = (np.abs(y - (0.31 + 0.61 * np.clip((1 - x) / (1 - t2), 0, 1) ** 1.6)) < 0.004) & (x > t2)
    cab = cable(t1, t2, 0.32) | side_l | side_r
    hang = (np.mod(x * 160, 1) < 0.12) & (y > 0.30) & (y < 0.92)
    tc = 0.92 - 0.6 * (1 - (2 * (x - t1) / (t2 - t1) - 1) ** 2)
    hang &= (x > t1) & (x < t2) & (y < tc)
    piers = (np.abs(np.mod(x * 14, 1) - 0.5) < 0.012) & (y < 0.3) & ((x < t1 - 0.05) | (x > t2 + 0.05))
    m = (deck | tower | beams | cab | hang | piers).astype(np.float32)
    col = hexc('#A8706A')   # a hazed red-brown: generic suspension-bridge colour at distance
    rgb = np.broadcast_to(lerp(col, hexc('#C9A9B0'), 0.4), (h, w, 3)).copy()
    return np.concatenate([rgb, m[..., None]], -1)


def pastry_box():
    """Microcar cargo box side: cream enamel with a hand-painted tart icon in a teal roundel."""
    n = 512
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    x = (xs + 0.5) / n * 2 - 1
    y = (ys + 0.5) / n * 2 - 1
    base = hexc('#F1E6CC')
    wash = brush_wash(n, 50, 181, 4)
    rgb = np.broadcast_to(base, (n, n, 3)) * (1 + 0.025 * wash[..., None])
    rr = np.sqrt(x * x + y * y)
    roundel = (rr < 0.62).astype(np.float32)
    ring = ((rr > 0.66) & (rr < 0.70)).astype(np.float32)
    rgb = lerp(rgb, hexc('#2A9C9A'), roundel * 0.95 + ring * 0.9)
    # tart: fluted pastry case (trapezoid with scallops), caramelised custard top with dark spots
    case = (np.abs(x) < 0.42 - 0.12 * (y + 0.05) / 0.3) & (y > -0.32) & (y < -0.02)
    flute = (np.mod((x + 1) * 14, 1) < 0.5) & case
    top = ((x / 0.44) ** 2 + ((y - 0.02) / 0.14) ** 2 < 1)
    spots = top & (noise(n, 6, seed=182) > 1.1)
    rgb = lerp(rgb, hexc('#E2A75A'), case.astype(np.float32))
    rgb = lerp(rgb, hexc('#C98B44'), flute.astype(np.float32) * 0.6)
    rgb = lerp(rgb, hexc('#F2C96B'), top.astype(np.float32))
    rgb = lerp(rgb, hexc('#6B3A1E'), spots.astype(np.float32) * 0.9)
    steam = (np.abs(x - 0.08 * np.sin(y * 14) + 0.12) < 0.025) | (np.abs(x - 0.08 * np.sin(y * 14 + 1) - 0.12) < 0.025)
    steam &= (y > 0.22) & (y < 0.48)
    rgb = lerp(rgb, hexc('#F1E6CC'), steam.astype(np.float32))
    return rgb


def plate():
    """Blank EU-style number plate (no characters): white with a black rim and the blue band with a ring of stars."""
    w, h = 1024, 256
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    rgb = np.broadcast_to(hexc('#F4F2EC'), (h, w, 3)).copy()
    rgb *= (1 + 0.015 * noise(256, 20, seed=191)[np.clip(ys.astype(int) % 256, 0, 255), xs.astype(int) % 256])[..., None]
    rim = (xs < 10) | (xs > w - 11) | (ys < 10) | (ys > h - 11)
    band = (xs >= 10) & (xs < 120) & ~rim
    rgb = lerp(rgb, hexc('#1F3F8F'), band.astype(np.float32))
    cx, cy = 65, h * 0.62
    for k in range(12):
        a = 2 * math.pi * k / 12
        sx, sy = cx + 34 * math.cos(a), cy + 34 * math.sin(a)
        star = ((xs - sx) ** 2 + (ys - sy) ** 2) < 25
        rgb = lerp(rgb, hexc('#F2C230'), star.astype(np.float32))
    rgb = lerp(rgb, hexc('#1E1E1E'), rim.astype(np.float32))
    return rgb


GENERATORS = {
    'plaster': plaster, 'plaster_n': plaster,
    'lioz': lioz, 'lioz_n': lioz,
    'granite': granite,
    'setts': setts, 'setts_n': setts,
    'calcada': calcada, 'calcada_n': calcada,
    'roof_tile': roof_tile,
    'azulejo_blue': azulejo_blue, 'azulejo_lattice': azulejo_lattice, 'azulejo_green': azulejo_green,
    'wood_paint': wood_paint, 'wood_paint_n': wood_paint,
    'paint_metal': paint_metal,
    'glass': glass,
    'signs': signs,
    'fabric': fabric,
    'foliage': foliage,
    'far_facade': far_facade,
    'river': river,
    'sky': sky,
    'far_shore': far_shore,
    'bridge': bridge,
    'pastry_box': pastry_box,
    'plate': plate,
}
