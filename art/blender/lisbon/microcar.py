"""The hero car: an ordinary five-door European city hatchback (A/B segment), slightly compact for the game, in
the STYLE-C look. It is generic: no make or model, no brand-like grille, logo or signature lamps.

It is a two-box shape. A short bonnet slopes gently to a raked windscreen, then a mostly flat roof, then a
near-vertical hatch with a small spoiler lip. The beltline is fairly high with a slight rise toward the C pillar.
The glasshouse has front and rear door windows, a small rear quarter glass and the hatch glass, with A, B and C
pillars; the B pillar is blacked out and every window has a dark seal along the belt. The bumpers are body-coloured
with black lower intakes. It has black arch lips and sills, door shut lines, pull handles, mirrors, a fuel flap,
swept-back headlamps, vertical tail lamps, a third brake light, blank EU-style plates, wipers, 5-spoke alloys and a
visible interior with left-hand drive. The only branding is a small pastry roundel on each front door.

Local frame (Blender): origin on the ground midway between the axles, nose toward +Y (exported glTF: facing -Z).
"""
import math

import bpy
from mathutils import Vector

from .geo import MeshBuilder, apply_modifiers

WHEEL_R = 0.29          # axle height = wheel radius
TRACK = 1.40
WHEEL_X = TRACK / 2
WHEELBASE = 2.36
AXLE_Y = WHEELBASE / 2
ARCH_R = WHEEL_R + 0.045
LENGTH = 3.55
FRONT_Y = AXLE_Y + 0.68     # 1.86
REAR_Y = -(AXLE_Y + 0.51)   # -1.69
PAINT = 'car_teal'

# lower body cross-sections: (y, half width, bottom z, shoulder top z, superellipse exponent)
TUB = [
    (-1.695, 0.30, 0.44, 0.90, 2.4),
    (-1.688, 0.60, 0.32, 0.99, 3.0),
    (-1.660, 0.76, 0.22, 1.03, 4.0),
    (-1.500, 0.80, 0.17, 1.045, 5.5),
    (-0.800, 0.81, 0.14, 1.035, 6.0),
    (0.400, 0.81, 0.14, 1.015, 6.0),
    (0.900, 0.805, 0.15, 0.97, 5.6),
    (1.300, 0.80, 0.17, 0.885, 5.0),
    (1.600, 0.78, 0.20, 0.815, 4.2),
    (1.780, 0.72, 0.24, 0.765, 3.4),
    (1.845, 0.56, 0.29, 0.725, 2.8),
    (1.862, 0.26, 0.35, 0.675, 2.2),
]
N_SECTION = 44

# glasshouse sections: (y, half width at belt, half width at roof, belt z, roof z, kind of the segment starting here)
CAB = [
    (-1.640, 0.56, 0.50, 0.985, 1.03, 'hatch'),
    (-1.600, 0.66, 0.565, 0.985, 1.12, 'hatch'),
    (-1.300, 0.69, 0.585, 0.98, 1.44, 'cpillar'),
    (-1.050, 0.695, 0.59, 0.978, 1.46, 'quarter'),
    (-0.880, 0.70, 0.595, 0.975, 1.47, 'dpillar'),
    (-0.830, 0.70, 0.595, 0.975, 1.472, 'side'),
    (-0.120, 0.70, 0.595, 0.97, 1.49, 'bpillar'),
    (-0.020, 0.70, 0.595, 0.97, 1.493, 'side'),
    (0.160, 0.70, 0.595, 0.965, 1.488, 'side_screen'),
    (0.700, 0.695, 0.605, 0.96, 1.17, 'screen'),
    (1.020, 0.66, 0.62, 0.95, 0.955, None),
]
SIDE_FRACS = (0.0, 0.09, 0.55, 1.0)


def _sgnpow(v, p):
    return math.copysign(abs(v) ** p, v)


def tub_section(y, hw, zb, zt, e, n=N_SECTION):
    zc, b = (zb + zt) / 2, (zt - zb) / 2
    p = 2.0 / e
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n - math.pi / 2
        pts.append((hw * _sgnpow(math.cos(t), p), y, zc + b * _sgnpow(math.sin(t), p)))
    return pts


def _tub_at(y):
    for a, b in zip(TUB[:-1], TUB[1:]):
        if a[0] <= y <= b[0]:
            t = (y - a[0]) / (b[0] - a[0])
            return [a[k] + (b[k] - a[k]) * t for k in (1, 2, 3, 4)]
    return None


def tub_half_width(y, z):
    """Half width of the body surface at (y, z) (0 outside the body)."""
    s_ = _tub_at(y)
    if s_ is None:
        return 0.0
    hw, zb, zt, e = s_
    zc, h = (zb + zt) / 2, (zt - zb) / 2
    s = abs(z - zc) / h
    if s >= 1.0:
        return 0.0
    return hw * (1 - s ** e) ** (1.0 / e)


def surface_y(x, z, front=True):
    """Front- or rear-most body surface point at (x, z), by bisection along y."""
    if front:
        lo, hi = 0.5, TUB[-1][0]
        if tub_half_width(lo, z) < abs(x):
            return None
        for _ in range(30):
            mid = (lo + hi) / 2
            if tub_half_width(mid, z) >= abs(x):
                lo = mid
            else:
                hi = mid
        return lo
    lo, hi = -0.5, TUB[0][0]
    if tub_half_width(lo, z) < abs(x):
        return None
    for _ in range(30):
        mid = (lo + hi) / 2
        if tub_half_width(mid, z) >= abs(x):
            lo = mid
        else:
            hi = mid
    return lo


def loft(mb, sections, mat_fn, close=True, smooth=True, flip=False):
    """Quads between consecutive sections (equal point counts); ends closed with fans."""
    m = mb.m
    n = len(sections[0])
    base = len(mb.verts)
    for sec in sections:
        for p in sec:
            mb.verts.append(m @ Vector(p))
    for k in range(len(sections) - 1):
        for i in range(n):
            j = (i + 1) % n
            a, b = base + k * n + i, base + k * n + j
            c, d = base + (k + 1) * n + j, base + (k + 1) * n + i
            q = (a, d, c, b)
            mb.faces.append((q[::-1] if flip else q, mat_fn(k, i), None, False, smooth))
    if close:
        for k, rev in ((0, False), (len(sections) - 1, True)):
            sec = sections[k]
            cen = Vector(tuple(sum(p[q] for p in sec) / n for q in range(3)))
            ci = len(mb.verts)
            mb.verts.append(m @ cen)
            for i in range(n):
                j = (i + 1) % n
                a, b = base + k * n + i, base + k * n + j
                f = (b, a, ci) if rev != flip else (a, b, ci)
                mb.faces.append((f, mat_fn(k, i), None, False, smooth))


def cab_section(y, hwb, hwt, zb, zt):
    """Rounded trapezoid, 20 points: left side up, roof arc, roof span, right arc, right side down, bottom."""
    r = min(0.08, (zt - zb) * 0.4)
    pts = []
    zs = [zb + (zt - r - zb) * f for f in SIDE_FRACS]
    side_x = lambda z: hwb + (hwt - hwb) * min(1.0, max(0.0, (z - zb) / max(zt - r - zb, 1e-3)))
    for z in zs:
        pts.append((-side_x(z), y, z))
    for k in range(1, 5):
        a = math.pi - (math.pi / 2) * k / 4
        pts.append((-(hwt - r) + r * math.cos(a), y, zt - r + r * math.sin(a)))
    for k in range(1, 4):
        pts.append((-(hwt - r) + 2 * (hwt - r) * k / 4, y, zt + 0.012 * math.sin(math.pi * k / 4)))
    for k in range(0, 4):
        a = math.pi / 2 - (math.pi / 2) * k / 4
        pts.append(((hwt - r) + r * math.cos(a), y, zt - r + r * math.sin(a)))
    for z in reversed(zs):
        pts.append((side_x(z), y, z))
    pts.append((0.0, y, zb - 0.03))
    return pts


def cab_zone(i):
    if i in (0, 17):
        return 'seal'
    if i in (1, 2, 15, 16):
        return 'side'
    if 3 <= i <= 6 or 11 <= i <= 14:
        return 'arc'
    if 7 <= i <= 10:
        return 'roof'
    return 'bottom'


def cab_mat(k, i):
    kind = CAB[k][5] if k < len(CAB) else None
    z = cab_zone(i)
    if z == 'seal':
        return 'car_trim'
    if kind == 'hatch':
        return 'car_glass' if z == 'roof' else PAINT
    if kind in ('side', 'quarter'):
        return 'car_glass' if z == 'side' else PAINT
    if kind == 'side_screen':
        return 'car_glass' if z in ('side', 'roof') else PAINT
    if kind == 'screen':
        return 'car_glass' if z == 'roof' else PAINT
    if kind in ('bpillar', 'dpillar'):
        return 'car_trim' if z == 'side' else PAINT
    return PAINT


def lathe_x(mb, mat, prof, c, side, seg=24, smooth=True):
    """Revolve [(r, a)] around the x axis through c; a is the offset outward (toward side = +1 or -1)."""
    cx, cy, cz = c
    base = len(mb.verts)
    n = len(prof)
    m = mb.m
    for s in range(seg):
        t = 2 * math.pi * s / seg
        for (r, a) in prof:
            mb.verts.append(m @ Vector((cx + a * side, cy + r * math.cos(t), cz + r * math.sin(t))))
    for s in range(seg):
        s2 = (s + 1) % seg
        for k in range(n - 1):
            q = (base + s * n + k, base + s * n + k + 1, base + s2 * n + k + 1, base + s2 * n + k)
            if side > 0:
                q = q[::-1]
            mb.faces.append((q, mat, None, False, smooth))


def wheel(mb, x, y):
    s = 1 if x > 0 else -1
    R, w = WHEEL_R, 0.185
    tyre = [(0.195, -w / 2), (0.24, -w / 2 - 0.004), (0.275, -w / 2 + 0.012), (R, -w / 2 + 0.035), (R, w / 2 - 0.035),
            (0.275, w / 2 - 0.012), (0.24, w / 2 + 0.004), (0.195, w / 2)]
    lathe_x(mb, 'car_tyre', tyre, (x, y, R), s, seg=32)
    # plain 5-spoke alloy: recessed dish, rim lip, spokes, centre cap
    rim = [(0.195, w / 2), (0.19, w / 2 - 0.012), (0.17, w / 2 - 0.03), (0.06, w / 2 - 0.035)]
    lathe_x(mb, 'car_alloy', rim, (x, y, R), s, seg=28)
    lathe_x(mb, 'car_trim', [(0.17, w / 2 - 0.032), (0.0, w / 2 - 0.04)], (x, y, R), s, seg=20)
    for k in range(5):
        a = 2 * math.pi * k / 5 + 0.3
        p0 = Vector((x + s * (w / 2 - 0.02), y + 0.05 * math.cos(a), R + 0.05 * math.sin(a)))
        p1 = Vector((x + s * (w / 2 - 0.028), y + 0.175 * math.cos(a), R + 0.175 * math.sin(a)))
        mb.sweep('car_alloy', [tuple(p0), tuple(p1)], 0.024, seg=6)
    lathe_x(mb, 'car_alloy', [(0.065, w / 2 - 0.03), (0.055, w / 2 - 0.012), (0.03, w / 2 - 0.006), (0.0, w / 2 - 0.004)],
            (x, y, R), s, seg=16)


def arch_cutter(collection):
    mb = MeshBuilder()
    for y in (-AXLE_Y, AXLE_Y):
        mb.cyl('car_trim', (-1.2, y, WHEEL_R + 0.01), (1.2, y, WHEEL_R + 0.01), ARCH_R, seg=44, smooth=False)
    return mb.build('arch_cutter', collection, bevel_width=0.0)


def flank(y, z, off=0.0):
    return tub_half_width(y, z) + off


def flank_sweep(mb, pts, s, mat, r, off=0.004, seg=5):
    out = [(s * flank(y, z, off), y, z) for (y, z) in pts if flank(y, z) > 0.05]
    if len(out) > 1:
        mb.sweep(mat, out, r, seg=seg)


def arch_lips(mb):
    for y0 in (-AXLE_Y, AXLE_Y):
        for s in (-1, 1):
            pts = []
            for k in range(29):
                a = math.radians(-8 + 196 * k / 28)
                pts.append((y0 + (ARCH_R + 0.01) * math.cos(a), WHEEL_R + 0.01 + (ARCH_R + 0.01) * math.sin(a)))
            pts = [p for p in pts if p[1] > 0.16]
            flank_sweep(mb, pts, s, 'car_trim', 0.028, off=-0.004, seg=7)


def wheel_wells(mb):
    zc = WHEEL_R + 0.01
    rr = ARCH_R - 0.006
    angs = [math.radians(-12 + 204 * k / 20) for k in range(21)]
    for y0 in (-AXLE_Y, AXLE_Y):
        for k in range(20):
            a0, a1 = angs[k], angs[k + 1]
            p0 = (y0 + rr * math.cos(a0), zc + rr * math.sin(a0))
            p1 = (y0 + rr * math.cos(a1), zc + rr * math.sin(a1))
            mb.quad('car_trim', (-0.58, p0[0], p0[1]), (0.58, p0[0], p0[1]), (0.58, p1[0], p1[1]), (-0.58, p1[0], p1[1]))
        for s in (-1, 1):
            pts = [(s * 0.58, y0 + rr * math.cos(a), zc + rr * math.sin(a)) for a in angs]
            pts.append((s * 0.58, y0, zc))
            mb.poly('car_trim', pts if s > 0 else pts[::-1])


def projected_patch(mb, mat, x0, x1, zlo, zhi, front, nu=10, nv=4, lift=0.005, uv=None):
    """A grid patch laid onto the front or rear body surface over x in [x0, x1] and z in [zlo(x), zhi(x)]:
    lamps, grille, intakes. Wraps around the corner by itself where the surface turns back along the flank."""
    pts = {}
    for i in range(nu + 1):
        x = x0 + (x1 - x0) * i / nu
        for j in range(nv + 1):
            z = zlo(x) + (zhi(x) - zlo(x)) * j / nv
            y = surface_y(x, z, front)
            if y is not None:
                pts[i, j] = (x, y + (lift if front else -lift), z)
    for i in range(nu):
        for j in range(nv):
            if not all(k in pts for k in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                continue
            q = [pts[i, j], pts[i + 1, j], pts[i + 1, j + 1], pts[i, j + 1]]   # x right, z up: faces -y
            uvs = None
            if uv:
                uvs = [uv(i / nu, j / nv), uv((i + 1) / nu, j / nv), uv((i + 1) / nu, (j + 1) / nv), uv(i / nu, (j + 1) / nv)]
            if front:
                q = q[::-1]
                uvs = uvs[::-1] if uvs else None
            mb.poly(mat, q, uvs=uvs, smooth=True)


def lights_and_front(mb):
    for s in (-1, 1):
        # swept-back headlamps: rounded at the inner end, wrapping round the corner toward the wing
        lo = lambda x: 0.665 + 0.025 * (abs(x) - 0.40) / 0.37
        hi = lambda x: 0.745 - 0.03 * ((abs(x) - 0.40) / 0.37) ** 1.5
        xa, xb = (0.40, 0.775) if s > 0 else (-0.775, -0.40)
        projected_patch(mb, 'car_trim', xa, xb, lambda x: lo(x) - 0.012, lambda x: hi(x) + 0.012, True, nu=16, nv=3, lift=0.004)
        la, lb = (0.42, 0.765) if s > 0 else (-0.765, -0.42)
        projected_patch(mb, 'car_lamp', la, lb, lo, hi, True, nu=16, nv=3, lift=0.009)
        # amber side repeater on the wing
        y, z = 1.45, 0.77
        mb.sphere('car_amber', (s * flank(y, z, 0.002), y, z), 0.03, seg=8, rings=4, sz=(0.008, 0.035, 0.012))
    # slim upper grille slot between the lamps, wide lower intake, fog-lamp blanks
    projected_patch(mb, 'car_trim', -0.36, 0.36, lambda x: 0.66, lambda x: 0.70, True, nu=8, nv=2, lift=0.004)
    projected_patch(mb, 'car_trim', -0.52, 0.52, lambda x: 0.29 + 0.03 * (abs(x) / 0.52) ** 2, lambda x: 0.40 - 0.01 * (abs(x) / 0.52),
                    True, nu=12, nv=3, lift=0.004)
    # front plate: flat, just proud of the bumper
    y = surface_y(0.0, 0.48, True) + 0.012
    mb.quad('car_plate', (0.26, y, 0.43), (-0.26, y, 0.43), (-0.26, y, 0.54), (0.26, y, 0.54),
            uvs=((1, 0), (0, 0), (0, 1), (1, 1)))
    # wipers parked at the base of the windscreen
    for x0, x1 in ((-0.55, 0.0), (-0.02, 0.5)):
        mb.sweep('car_trim', [(x0, 0.99, 0.975), ((x0 + x1) / 2, 0.985, 0.98), (x1, 0.97, 0.99)], 0.008, seg=4)


def rear(mb):
    for s in (-1, 1):
        # vertical tail lamps at the hatch corners, wrapping onto the flank
        xa, xb = (0.54, 0.735) if s > 0 else (-0.735, -0.54)
        projected_patch(mb, 'car_trim', xa - 0.012 * s, xb, lambda x: 0.735, lambda x: 0.985, False, nu=8, nv=6, lift=0.004)
        projected_patch(mb, 'car_tail', xa, xb, lambda x: 0.815, lambda x: 0.975, False, nu=8, nv=5, lift=0.008)
        projected_patch(mb, 'car_amber', xa, xb, lambda x: 0.745, lambda x: 0.81, False, nu=8, nv=1, lift=0.008)
    # small spoiler lip over the hatch glass, with the third brake light under it
    mb.box(PAINT, (-0.54, -1.37, 1.425), (0.54, -1.25, 1.452), bevel=True)
    mb.box('car_tail', (-0.15, -1.375, 1.41), (0.15, -1.355, 1.428), bevel=False)
    # rear plate and hatch handle
    y = surface_y(0.0, 0.68, False) - 0.012
    mb.quad('car_plate', (-0.26, y, 0.62), (0.26, y, 0.62), (0.26, y, 0.73), (-0.26, y, 0.73),
            uvs=((0, 0), (1, 0), (1, 1), (0, 1)))
    yh = surface_y(0.0, 0.79, False) - 0.008
    mb.box('car_chrome', (-0.16, yh - 0.015, 0.775), (0.16, yh + 0.01, 0.795), bevel=False)
    # hatch shut lines and the bumper's top crease
    projected_patch(mb, 'car_trim', -0.62, 0.62, lambda x: 0.598, lambda x: 0.606, False, nu=12, nv=1, lift=0.003)
    for xa in (-0.535, 0.527):
        projected_patch(mb, 'car_trim', xa, xa + 0.008, lambda x: 0.606, lambda x: 0.975, False, nu=1, nv=8, lift=0.003)
    # black lower diffuser strip in the bumper
    projected_patch(mb, 'car_trim', -0.62, 0.62, lambda x: 0.26, lambda x: 0.34, False, nu=10, nv=2, lift=0.004)
    # rear wiper on the hatch glass
    mb.sweep('car_trim', [(0.0, -1.585, 1.14), (-0.30, -1.43, 1.315)], 0.007, seg=4)


def sides(mb):
    for s in (-1, 1):
        # black sill trim between the arches
        sill = [(y_, 0.24) for y_ in [AXLE_Y - ARCH_R - 0.02 - k * 0.1 for k in range(int((2 * (AXLE_Y - ARCH_R) - 0.04) / 0.1) + 1)]]
        flank_sweep(mb, sill, s, 'car_trim', 0.04, off=-0.012, seg=6)
        # subtle shoulder feature line from the headlamp back to the tail lamp
        shoulder = [(y_, 0.86 + 0.04 * (1.6 - y_) / 3.2) for y_ in [1.6 - k * 0.1 for k in range(32)]]
        flank_sweep(mb, shoulder, s, PAINT, 0.008, off=-0.002, seg=5)
        # door shut lines: front door, rear door with its curve over the rear arch
        front_door = [(0.80, 0.95), (0.80, 0.80), (0.80, 0.60), (0.79, 0.42), (0.77, 0.30)]
        bpost = [(-0.07, 0.29), (-0.075, 0.50), (-0.08, 0.75), (-0.085, 0.95)]
        rear_door = [(-0.86, 0.95), (-0.86, 0.80), (-0.85, 0.70), (-0.80, 0.62), (-0.77, 0.50), (-0.77, 0.30)]
        for line in (front_door, bpost, rear_door):
            dense = []
            for (a, b) in zip(line[:-1], line[1:]):
                for k in range(4):
                    t = k / 4
                    dense.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
            dense.append(line[-1])
            flank_sweep(mb, dense, s, 'car_trim', 0.006, off=0.0, seg=4)
        # pull handles
        for y in (0.0, -0.78):
            x = s * flank(y, 0.90, 0.006)
            mb.sweep('car_trim', [(x, y, 0.90), (x, y - 0.12, 0.90)], 0.013, seg=6)
        # door mirror on the front door
        my, mz = 0.60, 1.0
        mb.box('car_trim', (s * 0.69, my - 0.03, mz - 0.03), (s * 0.79, my + 0.06, mz + 0.03), bevel=True)       # sail
        mb.box(PAINT, (s * 0.76, my - 0.045, mz - 0.005), (s * 0.91, my + 0.045, mz + 0.1), bevel=True)          # housing
        mb.box('car_glass', (s * 0.772, my - 0.051, mz + 0.008), (s * 0.898, my - 0.04, mz + 0.088), bevel=False)
        # small pastry roundel on the front door (~0.28 m), the only branding
        badge(mb, s, 0.36, 0.64, 0.14)
    # fuel flap on the right rear quarter
    pts = [(-1.30 + 0.07 * math.cos(2 * math.pi * k / 16), 0.86 + 0.07 * math.sin(2 * math.pi * k / 16)) for k in range(17)]
    flank_sweep(mb, pts, 1, 'car_trim', 0.0035, off=0.0015, seg=4)


def badge(mb, s, y, z, r):
    pts, uvs = [], []
    for k in range(24):
        t = 2 * math.pi * k / 24
        yy, zz = y + r * math.cos(t), z + r * math.sin(t)
        pts.append((s * (tub_half_width(yy, zz) + 0.003), yy, zz))
        uvs.append((0.5 + 0.34 * math.cos(t), 0.5 + 0.34 * math.sin(t)))
    if s < 0:
        pts, uvs = pts[::-1], uvs[::-1]
    mb.poly('car_box', pts, uvs=uvs)


def interior(mb):
    """Seats, dashboard and a left-hand-drive steering wheel, seen through the tinted glass."""
    mb.box('car_trim', (-0.66, -1.45, 0.42), (0.66, 0.95, 0.5), bevel=False)             # floor
    mb.box('car_trim', (-0.66, 0.55, 0.75), (0.66, 0.95, 1.0), bevel=True)               # dashboard
    for x in (-0.36, 0.36):
        mb.box('car_seat', (x - 0.24, -0.35, 0.5), (x + 0.24, 0.15, 0.66), bevel=True)    # cushion
        mb.box('car_seat', (x - 0.23, -0.42, 0.62), (x + 0.23, -0.30, 1.22), bevel=True)  # backrest
        mb.box('car_seat', (x - 0.12, -0.44, 1.22), (x + 0.12, -0.34, 1.36), bevel=True)  # headrest
    mb.box('car_seat', (-0.62, -1.25, 0.5), (0.62, -0.75, 0.66), bevel=True)             # rear bench
    mb.box('car_seat', (-0.62, -1.32, 0.62), (0.62, -1.2, 1.15), bevel=True)
    c = Vector((-0.36, 0.42, 1.0))
    ring = [(c.x + 0.18 * math.cos(2 * math.pi * k / 20), c.y + 0.06 * math.sin(2 * math.pi * k / 20),
             c.z + 0.16 * math.sin(2 * math.pi * k / 20)) for k in range(21)]
    mb.sweep('car_trim', ring, 0.015, seg=6, caps=False)
    mb.sweep('car_trim', [tuple(c), (-0.36, 0.62, 0.88)], 0.025, seg=6)


def build(collection):
    # 1. body: lofted lower body with the arches cut out
    tub = MeshBuilder()
    loft(tub, [tub_section(*s) for s in TUB], lambda k, i: PAINT)
    body = tub.build('microcar_body', collection, bevel_width=0.0, smooth_angle=70.0)
    cutter = arch_cutter(collection)
    mod = body.modifiers.new('arches', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.object = cutter
    mod.solver = 'EXACT'
    apply_modifiers(body)
    bpy.data.objects.remove(cutter)

    # 2. glasshouse, wheels and details
    mb = MeshBuilder()
    loft(mb, [cab_section(y, hwb, hwt, zb, zt) for (y, hwb, hwt, zb, zt, _) in CAB], cab_mat, flip=True)
    for x in (-WHEEL_X, WHEEL_X):
        for y in (-AXLE_Y, AXLE_Y):
            wheel(mb, x, y)
    wheel_wells(mb)
    arch_lips(mb)
    lights_and_front(mb)
    rear(mb)
    sides(mb)
    interior(mb)
    rest = mb.build('microcar_parts', collection, bevel_width=0.01, bevel_segments=1, smooth_angle=60.0)

    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    body.select_set(True)
    rest.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body.name = 'microcar'
    body.data.name = 'microcar'
    return body
