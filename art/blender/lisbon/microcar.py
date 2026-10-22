"""The player car: a plain, familiar modern electric saloon in the Tesla Model 3 mould, in the STYLE-C look.
It carries no Tesla (or any other) logo, badge or lettering.

The shape is a long smooth fastback. A low grille-less nose has slim swept headlamps and a black lower intake; the
black glasshouse runs into a dark glass roof that flows down to a short tail with a small ducktail lip. Slim
wrap-around tail lamps, flush door handles, black mirror bases, aero wheel covers and blank EU plates complete it,
and the interior has a centre touchscreen. The paint is pearl white. The only branding is a subtle pastry roundel on
each front door.

Local frame (Blender): origin on the ground midway between the axles, nose toward +Y (exported glTF: facing -Z).
The four wheels are separate child objects (wheel_FL, wheel_FR, wheel_RL, wheel_RR) with their origins on the hub
centres, so the engine can spin and steer them.
"""
import math

import bpy
from mathutils import Vector

from .geo import MeshBuilder, apply_modifiers

WHEEL_R = 0.34          # axle height = wheel radius
TRACK = 1.58
WHEEL_X = TRACK / 2
WHEELBASE = 2.875
AXLE_Y = WHEELBASE / 2
ARCH_R = WHEEL_R + 0.04
LENGTH = 3.55
FRONT_Y = 2.315
REAR_Y = -2.40
PAINT = 'car_paint'

# lower body cross-sections: (y, half width, bottom z, shoulder top z, superellipse exponent)
TUB = [
    (-2.400, 0.40, 0.38, 0.86, 2.4),
    (-2.370, 0.78, 0.30, 0.94, 3.2),
    (-2.220, 0.89, 0.24, 0.99, 4.5),
    (-1.850, 0.92, 0.20, 1.01, 6.0),
    (-0.900, 0.925, 0.18, 1.02, 6.0),
    (0.400, 0.925, 0.18, 1.015, 6.0),
    (0.900, 0.92, 0.185, 0.975, 5.8),
    (1.250, 0.915, 0.19, 0.915, 5.5),
    (1.650, 0.90, 0.21, 0.83, 5.0),
    (2.000, 0.86, 0.25, 0.75, 4.0),
    (2.200, 0.76, 0.29, 0.68, 3.2),
    (2.280, 0.56, 0.33, 0.63, 2.6),
    (2.315, 0.25, 0.38, 0.59, 2.2),
]
N_SECTION = 44

# glasshouse sections: (y, half width at belt, half width at roof, belt z, roof z, kind of the segment starting here)
CAB = [
    (-1.800, 0.62, 0.55, 0.985, 1.02, 'rear'),
    (-1.720, 0.74, 0.62, 0.985, 1.10, 'rear'),
    (-1.200, 0.80, 0.665, 0.98, 1.32, 'quarter'),
    (-0.950, 0.81, 0.675, 0.978, 1.38, 'dpillar'),
    (-0.900, 0.81, 0.675, 0.978, 1.39, 'side'),
    (-0.100, 0.815, 0.68, 0.975, 1.44, 'bpillar'),
    (0.000, 0.815, 0.68, 0.975, 1.44, 'side'),
    (0.350, 0.81, 0.68, 0.97, 1.40, 'side_screen'),
    (0.800, 0.80, 0.70, 0.955, 1.18, 'screen'),
    (1.250, 0.55, 0.52, 0.91, 0.925, None),
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
    """Tesla-style glasshouse: everything above the belt is black glass or black trim; the roof is dark glass."""
    kind = CAB[k][5] if k < len(CAB) else None
    z = cab_zone(i)
    if z in ('seal', 'arc', 'bottom'):
        return 'car_trim'
    if z == 'roof':
        return 'car_glass' if kind in ('screen', 'side_screen') else 'car_roofglass'
    if kind in ('side', 'quarter', 'side_screen'):
        return 'car_glass'
    return 'car_trim'


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


def wheel(mb, side):
    """Aero wheel centred on its hub (origin): low-profile tyre, grey aero cover with five curved blades."""
    s_ = side
    R, w = WHEEL_R, 0.235
    tyre = [(0.24, -w / 2), (0.29, -w / 2 - 0.004), (0.325, -w / 2 + 0.014), (R, -w / 2 + 0.04), (R, w / 2 - 0.04),
            (0.325, w / 2 - 0.014), (0.29, w / 2 + 0.004), (0.24, w / 2)]
    lathe_x(mb, 'car_tyre', tyre, (0, 0, 0), s_, seg=32)
    cover = [(0.24, w / 2), (0.235, w / 2 - 0.006), (0.2, w / 2 - 0.012), (0.12, w / 2 - 0.016), (0.06, w / 2 - 0.012),
             (0.0, w / 2 - 0.008)]
    lathe_x(mb, 'car_alloy', cover, (0, 0, 0), s_, seg=32)
    lathe_x(mb, 'car_tyre', [(0.0, -w / 2), (0.24, -w / 2)], (0, 0, 0), -s_, seg=20)
    for k in range(5):
        a0 = 2 * math.pi * k / 5
        pts = []
        for j in range(7):
            r = 0.07 + 0.155 * j / 6
            a = a0 + 0.55 * j / 6
            pts.append((s_ * (w / 2 - 0.006), r * math.cos(a), r * math.sin(a)))
        mb.sweep('car_trim', pts, 0.008, seg=4)
    lathe_x(mb, 'car_trim', [(0.045, w / 2 - 0.006), (0.04, w / 2 + 0.002), (0.0, w / 2 + 0.004)], (0, 0, 0), s_, seg=16)


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
        # slim swept headlamps wrapping round the front corners
        t = lambda x: max(0.0, min(1.0, (abs(x) - 0.50) / 0.40))
        lo = lambda x: 0.64 + 0.035 * t(x)
        hi = lambda x: 0.69 - 0.015 * t(x) ** 1.5
        xa, xb = (0.48, 0.905) if s > 0 else (-0.905, -0.48)
        projected_patch(mb, 'car_trim', xa, xb, lambda x: lo(x) - 0.012, lambda x: hi(x) + 0.01, True, nu=18, nv=2, lift=0.004)
        la, lb = (0.50, 0.89) if s > 0 else (-0.89, -0.50)
        projected_patch(mb, 'car_lamp', la, lb, lo, hi, True, nu=18, nv=2, lift=0.008)
        # side repeater on the front wing
        y, z = 1.70, 0.68
        mb.sphere('car_amber', (s * flank(y, z, 0.002), y, z), 0.03, seg=8, rings=4, sz=(0.006, 0.03, 0.01))
    # no grille: a black lower intake in a smooth bumper
    projected_patch(mb, 'car_trim', -0.62, 0.62, lambda x: 0.30 + 0.03 * (abs(x) / 0.62) ** 2, lambda x: 0.39 - 0.01 * (abs(x) / 0.62),
                    True, nu=14, nv=3, lift=0.004)
    y = surface_y(0.0, 0.47, True) + 0.012
    mb.quad('car_plate', (0.26, y, 0.42), (-0.26, y, 0.42), (-0.26, y, 0.53), (0.26, y, 0.53),
            uvs=((1, 0), (0, 0), (0, 1), (1, 1)))
    for x0, x1 in ((-0.62, -0.05), (0.0, 0.55)):
        mb.sweep('car_trim', [(x0, 1.25, 0.93), ((x0 + x1) / 2, 1.245, 0.935), (x1, 1.23, 0.94)], 0.008, seg=4)


def rear(mb):
    for s in (-1, 1):
        # slim wrap-around tail lamps
        xa, xb = (0.40, 0.845) if s > 0 else (-0.845, -0.40)
        projected_patch(mb, 'car_trim', xa, xb, lambda x: 0.785, lambda x: 0.895, False, nu=14, nv=2, lift=0.004)
        # outer part: brake/tail lamp (car_brake, brightened by the engine when braking); inner end: reverse lamp
        ra, rb = (xa + 0.13, xb - 0.005) if s > 0 else (xa + 0.005, xb - 0.13)
        va, vb = (xa + 0.01, xa + 0.13) if s > 0 else (xb - 0.13, xb - 0.01)
        projected_patch(mb, 'car_brake', ra, rb, lambda x: 0.80, lambda x: 0.88, False, nu=11, nv=2, lift=0.008)
        projected_patch(mb, 'car_reverse', va, vb, lambda x: 0.80, lambda x: 0.88, False, nu=3, nv=2, lift=0.008)
    # third brake light at the top of the rear glass
    mb.box('car_brake', (-0.16, -1.74, 1.075), (0.16, -1.70, 1.09), bevel=False)
    # boot shut line, rear plate on the bumper, black diffuser
    projected_patch(mb, 'car_trim', -0.66, 0.66, lambda x: 0.765, lambda x: 0.772, False, nu=14, nv=1, lift=0.003)
    y = surface_y(0.0, 0.62, False) - 0.012
    mb.quad('car_plate', (-0.26, y, 0.56), (0.26, y, 0.56), (0.26, y, 0.67), (-0.26, y, 0.67),
            uvs=((0, 0), (1, 0), (1, 1), (0, 1)))
    projected_patch(mb, 'car_trim', -0.70, 0.70, lambda x: 0.27, lambda x: 0.38, False, nu=12, nv=2, lift=0.004)


def sides(mb):
    for s in (-1, 1):
        sill = [(y_, 0.26) for y_ in [AXLE_Y - ARCH_R - 0.02 - k * 0.1 for k in range(int((2 * (AXLE_Y - ARCH_R) - 0.04) / 0.1) + 1)]]
        flank_sweep(mb, sill, s, 'car_trim', 0.035, off=-0.012, seg=6)
        front_door = [(1.00, 0.97), (1.00, 0.80), (1.00, 0.60), (0.99, 0.42), (0.97, 0.30)]
        bpost = [(-0.06, 0.30), (-0.065, 0.55), (-0.07, 0.97)]
        rear_door = [(-1.00, 0.97), (-1.00, 0.78), (-0.98, 0.66), (-0.96, 0.50), (-0.96, 0.30)]
        for line in (front_door, bpost, rear_door):
            dense = []
            for (a, b) in zip(line[:-1], line[1:]):
                for k in range(4):
                    tt = k / 4
                    dense.append((a[0] + (b[0] - a[0]) * tt, a[1] + (b[1] - a[1]) * tt))
            dense.append(line[-1])
            flank_sweep(mb, dense, s, 'car_trim', 0.005, off=0.0, seg=4)
        # flush door handles
        for y in (0.20, -0.82):
            x = s * flank(y, 0.88, 0.002)
            mb.sweep('car_trim', [(x, y, 0.88), (x, y - 0.13, 0.88)], 0.011, seg=6)
        # door mirror: black base on the door, body-colour housing
        my, mz = 0.86, 1.0
        mb.box('car_trim', (s * 0.80, my - 0.04, mz - 0.03), (s * 0.90, my + 0.06, mz + 0.03), bevel=True)
        mb.sphere(PAINT, (s * 0.95, my - 0.01, mz + 0.05), 0.09, seg=12, rings=7, sz=(0.08, 0.05, 0.055))
        badge(mb, s, 0.45, 0.66, 0.13)


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
    """Seats, dashboard with the centre touchscreen and a left-hand-drive steering wheel, seen through the glass."""
    mb.box('car_trim', (-0.8, -1.55, 0.36), (0.8, 1.1, 0.44), bevel=False)
    mb.box('car_trim', (-0.8, 0.65, 0.70), (0.8, 1.1, 0.95), bevel=True)
    mb.box('car_trim', (-0.17, 0.62, 0.95), (0.17, 0.66, 1.17), bevel=True)               # centre screen
    mb.box('car_glass', (-0.155, 0.615, 0.965), (0.155, 0.62, 1.155), bevel=False)
    for x in (-0.38, 0.38):
        mb.box('car_seat', (x - 0.25, -0.25, 0.44), (x + 0.25, 0.28, 0.62), bevel=True)
        mb.box('car_seat', (x - 0.24, -0.34, 0.58), (x + 0.24, -0.20, 1.22), bevel=True)
        mb.box('car_seat', (x - 0.13, -0.36, 1.22), (x + 0.13, -0.24, 1.34), bevel=True)
    mb.box('car_seat', (-0.72, -1.25, 0.44), (0.72, -0.72, 0.62), bevel=True)
    mb.box('car_seat', (-0.72, -1.33, 0.58), (0.72, -1.2, 1.12), bevel=True)
    c = Vector((-0.38, 0.40, 1.0))
    ring = [(c.x + 0.18 * math.cos(2 * math.pi * k / 20), c.y + 0.06 * math.sin(2 * math.pi * k / 20),
             c.z + 0.16 * math.sin(2 * math.pi * k / 20)) for k in range(21)]
    mb.sweep('car_trim', ring, 0.015, seg=6, caps=False)
    mb.sweep('car_trim', [tuple(c), (-0.38, 0.66, 0.88)], 0.025, seg=6)


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

    # 2. glasshouse and details
    mb = MeshBuilder()
    loft(mb, [cab_section(y, hwb, hwt, zb, zt) for (y, hwb, hwt, zb, zt, _) in CAB], cab_mat, flip=True)
    wheel_wells(mb)
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
    body.name = 'body'
    body.data.name = 'player_car_body'
    root = bpy.data.objects.new('player_car', None)
    collection.objects.link(root)
    body.parent = root

    # 3. wheels as separate children of the root, origins on the hub centres, spinning about local X
    for name, x, y in (('wheel_FL', -WHEEL_X, AXLE_Y), ('wheel_FR', WHEEL_X, AXLE_Y),
                       ('wheel_RL', -WHEEL_X, -AXLE_Y), ('wheel_RR', WHEEL_X, -AXLE_Y)):
        wm = MeshBuilder()
        wheel(wm, 1 if x > 0 else -1)
        w = wm.build(name, collection, bevel_width=0.0, smooth_angle=60.0)
        w.location = (x, y, WHEEL_R)
        w.parent = root
    return root


def meshes(root):
    return [o for o in root.children if o.type == 'MESH']
