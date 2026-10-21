"""The hero microcar: an invented two-door city car that delivers pastries (STYLE-C.md). Not based on any real car.

It reads as a small car first. A rounded teal body lofted from cross-sections gives it a short sloping bonnet,
a clear nose and tail and real wheel arches (cut with a boolean, finished with flares). The glasshouse has a raked
windscreen, A and B pillars, side windows, a rear window and a cream roof. Round headlamp pods, a small oval
grille, chrome bumpers, tail lamps, door lines, handles and mirrors complete it. The pastry branding is an accessory:
a small rounded box on a roof rack, plus a modest roundel on each door.

Local frame (Blender): origin on the ground midway between the axles, nose toward +Y (exported glTF: facing -Z).
"""
import math

import bpy
from mathutils import Vector

from .geo import MeshBuilder, apply_modifiers

WHEEL_R = 0.27          # axle height = wheel radius
TRACK = 0.60            # wheel centre x
WHEELBASE = 1.70
AXLE_Y = WHEELBASE / 2
ARCH_R = 0.345

# body cross-sections: (y, half width, bottom z, top z, superellipse exponent)
TUB = [
    (-1.300, 0.16, 0.46, 0.60, 2.2),
    (-1.285, 0.42, 0.36, 0.72, 2.5),
    (-1.240, 0.60, 0.28, 0.83, 2.9),
    (-1.150, 0.69, 0.21, 0.91, 3.3),
    (-0.950, 0.715, 0.18, 0.95, 3.7),
    (-0.400, 0.725, 0.17, 0.96, 3.9),
    (0.400, 0.725, 0.17, 0.96, 3.9),
    (0.780, 0.72, 0.18, 0.93, 3.7),
    (1.020, 0.70, 0.20, 0.86, 3.3),
    (1.200, 0.64, 0.25, 0.77, 2.9),
    (1.290, 0.46, 0.33, 0.67, 2.5),
    (1.315, 0.18, 0.42, 0.58, 2.2),
]
N_SECTION = 40

# glasshouse sections: (y, half width at belt, half width at roof, belt z, roof z, kind of the segment that STARTS here)
CAB = [
    (-1.050, 0.48, 0.42, 0.86, 0.90, 'rear'),
    (-0.960, 0.58, 0.52, 0.86, 1.28, 'rear'),
    (-0.820, 0.615, 0.545, 0.86, 1.44, 'side'),
    (-0.330, 0.625, 0.555, 0.86, 1.52, 'pillar'),
    (-0.250, 0.625, 0.555, 0.86, 1.525, 'side'),
    (0.180, 0.62, 0.555, 0.86, 1.50, 'screen'),
    (0.440, 0.58, 0.54, 0.86, 1.21, 'screen'),
    (0.640, 0.47, 0.44, 0.86, 0.92, None),
]


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


def tub_half_width(y, z):
    """Half width of the body surface at (y, z), for placing trim on the flanks."""
    for a, b in zip(TUB[:-1], TUB[1:]):
        if a[0] <= y <= b[0]:
            t = (y - a[0]) / (b[0] - a[0])
            hw, zb, zt, e = [a[k] + (b[k] - a[k]) * t for k in (1, 2, 3, 4)]
            zc, h = (zb + zt) / 2, (zt - zb) / 2
            s = min(1.0, abs(z - zc) / h)
            return hw * (1 - s ** e) ** (1.0 / e)
    return 0.0


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
    r = 0.09
    pts = []
    for k in range(4):                       # left side, bottom -> top (k=0 belt)
        t = k / 3.0
        z = zb + (zt - r - zb) * t * (1.0 if k < 3 else 1.0)
        pts.append((-(hwb + (hwt - hwb) * (z - zb) / max(zt - zb, 1e-3)), y, z))
    for k in range(1, 5):                    # left roof arc
        a = math.pi - (math.pi / 2) * k / 4
        pts.append((-(hwt - r) + r * math.cos(a), y, zt - r + r * math.sin(a)))
    for k in range(1, 4):                    # roof span
        pts.append((-(hwt - r) + 2 * (hwt - r) * k / 4, y, zt))
    for k in range(0, 4):                    # right roof arc
        a = math.pi / 2 - (math.pi / 2) * k / 4
        pts.append(((hwt - r) + r * math.cos(a), y, zt - r + r * math.sin(a)))
    for k in range(3, -1, -1):               # right side, top -> bottom
        t = k / 3.0
        z = zb + (zt - r - zb) * t
        pts.append(((hwb + (hwt - hwb) * (z - zb) / max(zt - zb, 1e-3)), y, z))
    pts.append((0.0, y, zb - 0.02))          # bottom centre (hidden inside the body)
    return pts


def cab_zone(i):
    """Classify the face starting at cab section point i (20 points per section)."""
    if i in (0, 17):
        return 'side_low'
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
    if kind == 'rear':
        return 'car_glass' if z == 'roof' else ('car_cream' if z == 'arc' else 'car_teal')
    if kind == 'side':
        if z == 'side':
            return 'car_glass'
        return 'car_cream' if z in ('roof', 'arc') else 'car_teal'
    if kind == 'pillar':
        return 'car_cream' if z in ('roof', 'arc') else 'car_teal'
    if kind == 'screen':
        if z == 'roof':
            return 'car_glass'
        return 'car_cream' if z == 'arc' else 'car_teal'
    return 'car_teal'


def lathe(mb, mat, prof, c, axis_sign=1, seg=24, smooth=True):
    """Revolve a profile [(r, a)] around the x axis through centre c (a = offset along x * axis_sign)."""
    cx, cy, cz = c
    base = len(mb.verts)
    n = len(prof)
    m = mb.m
    for s in range(seg):
        t = 2 * math.pi * s / seg
        for (r, a) in prof:
            mb.verts.append(m @ Vector((cx + a * axis_sign, cy + r * math.cos(t), cz + r * math.sin(t))))
    for s in range(seg):
        s2 = (s + 1) % seg
        for k in range(n - 1):
            q = (base + s * n + k, base + s * n + k + 1, base + s2 * n + k + 1, base + s2 * n + k)
            if axis_sign > 0:
                q = q[::-1]
            mb.faces.append((q, mat, None, False, smooth))


def wheel(mb, x, y):
    s = 1 if x > 0 else -1
    R, w = WHEEL_R, 0.19
    tyre = [(0.165, -w / 2), (0.215, -w / 2 - 0.005), (0.255, -w / 2 + 0.01), (R, -w / 2 + 0.04), (R, w / 2 - 0.04),
            (0.255, w / 2 - 0.01), (0.215, w / 2 + 0.005), (0.165, w / 2)]
    lathe(mb, 'car_tyre', tyre, (x, y, R), axis_sign=s, seg=28)
    # cream steel wheel with a chrome ring and a domed teal centre cap
    rim = [(0.165, w / 2), (0.15, w / 2 + 0.005), (0.11, w / 2 - 0.01), (0.09, w / 2 - 0.005)]
    lathe(mb, 'car_cream', rim, (x, y, R), axis_sign=s, seg=24)
    ring = [(0.168, w / 2 + 0.002), (0.16, w / 2 + 0.012), (0.15, w / 2 + 0.006)]
    lathe(mb, 'car_chrome', ring, (x, y, R), axis_sign=s, seg=24)
    cap = [(0.09, w / 2 - 0.005), (0.075, w / 2 + 0.02), (0.045, w / 2 + 0.035), (0.0, w / 2 + 0.04)]
    lathe(mb, 'car_teal', cap, (x, y, R), axis_sign=s, seg=20)
    # back face so the wheel never shows a hole from inside the arch
    lathe(mb, 'car_tyre', [(0.0, -w / 2), (0.165, -w / 2)], (x, y, R), axis_sign=s, seg=20)


def arch_cutter(collection):
    mb = MeshBuilder()
    for y in (-AXLE_Y, AXLE_Y):
        mb.cyl('car_trim', (-1.0, y, WHEEL_R + 0.01), (1.0, y, WHEEL_R + 0.01), ARCH_R, seg=40, smooth=False)
    obj = mb.build('arch_cutter', collection, bevel_width=0.0)
    return obj


def flares(mb):
    """Rounded lips around each arch, following the body flank."""
    for y0 in (-AXLE_Y, AXLE_Y):
        for s in (-1, 1):
            pts = []
            for k in range(25):
                a = math.radians(-12 + 204 * k / 24)
                y = y0 + (ARCH_R + 0.015) * math.cos(a)
                z = WHEEL_R + 0.01 + (ARCH_R + 0.015) * math.sin(a)
                if z < 0.17:
                    continue
                x = s * (tub_half_width(y, z) - 0.005)
                pts.append((x, y, z))
            mb.sweep('car_teal', pts, 0.03, seg=8)


def flank_line(mb, pts, s, mat='car_trim', r=0.005, off=0.003):
    out = [(s * (tub_half_width(y, z) + off), y, z) for (y, z) in pts]
    mb.sweep(mat, out, r, seg=5)


def door_details(mb):
    for s in (-1, 1):
        # door outline: front edge behind the front arch, rear edge at the B pillar, curved bottom corners
        line = [(0.47, 0.84), (0.47, 0.58), (0.44, 0.40), (0.34, 0.31), (-0.20, 0.31), (-0.30, 0.38), (-0.32, 0.52),
                (-0.32, 0.84)]
        flank_line(mb, line, s)
        # chrome handle
        y, z = -0.20, 0.74
        x = s * (tub_half_width(y, z) + 0.012)
        mb.box('car_chrome', (x - 0.012, y - 0.08, z - 0.015), (x + 0.012, y + 0.04, z + 0.015), bevel=False)
        # small door badge (the pastry branding, kept modest): a round decal just proud of the flank
        badge(mb, s, 0.07, 0.58, 0.14)
        # chrome waist strip
        strip = [(y_, 0.80) for y_ in [1.0 - 0.1 * k for k in range(21)]]
        flank_line(mb, strip, s, 'car_chrome', r=0.009, off=0.004)
        # wing mirror on a short stalk at the A pillar
        mx = s * 0.66
        mb.tube('car_chrome', [(mx, 0.62, 0.86), (s * 0.76, 0.6, 0.94)], 0.012, seg=5)
        mb.sphere('car_teal', (s * 0.79, 0.58, 0.96), 0.07, seg=12, rings=6, sz=(0.035, 0.06, 0.045))


def lamps(mb):
    for s in (-1, 1):
        # round headlamp pods on the wings: a teal pod, chrome bezel, domed lens
        cx, cz = s * 0.43, 0.70
        mb.cyl('car_teal', (cx, 1.0, cz - 0.03), (cx, 1.25, cz), 0.115, seg=20, r1=0.12)
        lathe_y(mb, 'car_chrome', [(0.125, 0.0), (0.13, 0.012), (0.115, 0.022), (0.1, 0.018)], (cx, 1.25, cz))
        lathe_y(mb, 'car_lamp', [(0.1, 0.015), (0.08, 0.035), (0.045, 0.048), (0.0, 0.052)], (cx, 1.25, cz))
        # round tail lamps
        ty = -1.265
        lathe_y(mb, 'car_chrome', [(0.075, 0.0), (0.08, -0.01), (0.065, -0.018)], (s * 0.47, ty, 0.70))
        lathe_y(mb, 'car_tail', [(0.065, -0.012), (0.04, -0.03), (0.0, -0.036)], (s * 0.47, ty, 0.70))
    # small oval grille: a chrome ring with three slats on a dark inset
    gy, gz = 1.305, 0.47
    pts = [(0.17 * math.cos(2 * math.pi * k / 24), gy + 0.0 * k, gz + 0.075 * math.sin(2 * math.pi * k / 24)) for k in range(25)]
    mb.sweep('car_chrome', pts, 0.014, seg=6, caps=False)
    mb.sphere('car_trim', (0.0, gy - 0.01, gz), 0.16, seg=16, rings=6, sz=(0.16, 0.03, 0.065))
    for k in (-1, 0, 1):
        z = gz + k * 0.035
        w = 0.15 * math.sqrt(max(0.0, 1 - (k * 0.035 / 0.075) ** 2))
        mb.tube('car_chrome', [(-w, gy + 0.012, z), (w, gy + 0.012, z)], 0.007, seg=4)


def lathe_y(mb, mat, prof, c, seg=20):
    """Revolve [(r, a)] around the y axis through c; a is the offset along +y."""
    cx, cy, cz = c
    base = len(mb.verts)
    n = len(prof)
    m = mb.m
    for s in range(seg):
        t = 2 * math.pi * s / seg
        for (r, a) in prof:
            mb.verts.append(m @ Vector((cx + r * math.cos(t), cy + a, cz + r * math.sin(t))))
    forward = (prof[-1][1] - prof[0][1]) >= 0
    for s in range(seg):
        s2 = (s + 1) % seg
        for k in range(n - 1):
            q = (base + s * n + k, base + s2 * n + k, base + s2 * n + k + 1, base + s * n + k + 1)
            mb.faces.append((q[::-1] if forward else q, mat, None, False, True))


def bumpers(mb):
    def ring(y0, ys, z, half):
        pts = []
        for k in range(15):
            t = -1 + 2 * k / 14
            x = half * t
            y = y0 + ys * 0.11 * (1 - t * t) ** 0.5 - ys * 0.11
            pts.append((x, y, z))
        return pts
    mb.sweep('car_chrome', ring(1.33, 1, 0.33, 0.66), 0.035, seg=10)
    mb.sweep('car_chrome', ring(-1.31, -1, 0.34, 0.64), 0.035, seg=10)
    for s in (-1, 1):
        for (y, d) in ((1.27, 1), (-1.25, -1)):
            mb.cyl('car_chrome', (s * 0.3, y - d * 0.06, 0.33), (s * 0.3, y + d * 0.05, 0.33), 0.03, seg=8)


def roof_box(mb):
    """The pastry-delivery accessory: a roof rack with a small rounded cream box and roundels on its sides."""
    zr = 1.525
    for s in (-1, 1):
        x = s * 0.36
        mb.tube('car_chrome', [(x, -0.62, zr + 0.06), (x, 0.10, zr + 0.06)], 0.015, seg=6)
        for y in (-0.55, 0.03):
            mb.cyl('car_trim', (x, y, 1.42), (x, y, zr + 0.06), 0.022, seg=8)
    # a round pastry tin with a teal lid: reads as a cake box, not as part of the body
    cx, cy, z0, r, h = 0.0, -0.26, zr + 0.08, 0.27, 0.24
    mb.cyl('car_cream', (cx, cy, z0), (cx, cy, z0 + h), r, seg=28, smooth=True)
    mb.cyl('car_teal', (cx, cy, z0 + h - 0.01), (cx, cy, z0 + h + 0.045), r + 0.02, seg=28, smooth=True)
    mb.sphere('car_teal', (cx, cy, z0 + h + 0.06), 0.035, seg=10, rings=5)
    for a in (0.0, math.pi):
        # roundels on both sides of the tin, bent to its curve
        ring = []
        uvs = []
        for k in range(17):
            t = 2 * math.pi * k / 16
            ang = a + 0.42 * math.cos(t)
            ring.append((cx + (r + 0.004) * math.cos(ang), cy + (r + 0.004) * math.sin(ang), z0 + h / 2 - 0.01 + 0.1 * math.sin(t)))
            uvs.append((0.5 + 0.34 * math.cos(t) * (1 if a == 0 else -1), 0.5 + 0.34 * math.sin(t)))
        mb.poly('car_box', ring[:-1][::-1] if a == 0 else ring[:-1], uvs=uvs[:-1][::-1] if a == 0 else uvs[:-1])
    for dy in (-0.09, 0.09):     # two straps to the rack
        mb.box('car_trim', (-r - 0.01, cy + dy - 0.012, zr + 0.06), (r + 0.01, cy + dy + 0.012, zr + 0.09), bevel=False)


def badge(mb, s, y, z, r):
    pts, uvs = [], []
    for k in range(20):
        t = 2 * math.pi * k / 20
        yy, zz = y + r * math.cos(t), z + r * math.sin(t)
        pts.append((s * (tub_half_width(yy, zz) + 0.004), yy, zz))
        uvs.append((0.5 + 0.34 * math.cos(t), 0.5 + 0.34 * math.sin(t)))
    if s < 0:
        pts, uvs = pts[::-1], uvs[::-1]
    mb.poly('car_box', pts, uvs=uvs)


def interior(mb):
    """Dark cabin, a seat and the steering wheel, seen through the glass in close views."""
    mb.box('car_trim', (-0.58, -0.9, 0.80), (0.58, 0.68, 0.86), bevel=False)
    mb.box('car_seat', (-0.5, -0.55, 0.86), (0.05, -0.05, 1.0))
    mb.box('car_seat', (-0.5, -0.6, 0.98), (0.05, -0.45, 1.36))
    mb.box('car_seat', (0.12, -0.55, 0.86), (0.55, -0.05, 1.0))
    mb.box('car_seat', (0.12, -0.6, 0.98), (0.55, -0.45, 1.36))
    mb.box('car_trim', (-0.5, 0.36, 0.86), (0.5, 0.5, 0.98), bevel=False)      # dashboard
    wheel_c = Vector((-0.22, 0.32, 1.05))
    pts = []
    for k in range(17):
        a = 2 * math.pi * k / 16
        pts.append((wheel_c.x + 0.16 * math.cos(a), wheel_c.y + 0.05 * math.sin(a), wheel_c.z + 0.14 * math.sin(a)))
    mb.tube('car_trim', pts, 0.014, seg=5)
    mb.tube('car_trim', [tuple(wheel_c), (-0.22, 0.5, 0.92)], 0.018, seg=5)


def wheel_wells(mb):
    """Dark arch linings (upper part only) and inner walls, so the cut arches never show the body's inside."""
    zc = WHEEL_R + 0.01
    rr = ARCH_R - 0.008
    angs = [math.radians(-14 + 208 * k / 20) for k in range(21)]
    for y0 in (-AXLE_Y, AXLE_Y):
        for k in range(20):
            a0, a1 = angs[k], angs[k + 1]
            p0 = (y0 + rr * math.cos(a0), zc + rr * math.sin(a0))
            p1 = (y0 + rr * math.cos(a1), zc + rr * math.sin(a1))
            # lining faces the axle (inward)
            mb.quad('car_trim', (-0.5, p0[0], p0[1]), (0.5, p0[0], p0[1]), (0.5, p1[0], p1[1]), (-0.5, p1[0], p1[1]))
        for s in (-1, 1):
            pts = [(s * 0.5, y0 + rr * math.cos(a), zc + rr * math.sin(a)) for a in angs]
            pts.append((s * 0.5, y0, zc))
            mb.poly('car_trim', pts if s > 0 else pts[::-1])


def build(collection):
    # 1. body: lofted tub with arches cut out
    tub = MeshBuilder()
    secs = [tub_section(*s) for s in TUB]
    loft(tub, secs, lambda k, i: 'car_teal')
    body = tub.build('microcar_body', collection, bevel_width=0.0, smooth_angle=60.0)
    cutter = arch_cutter(collection)
    mod = body.modifiers.new('arches', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.object = cutter
    mod.solver = 'EXACT'
    apply_modifiers(body)
    bpy.data.objects.remove(cutter)

    # 2. everything else in one builder
    mb = MeshBuilder()
    loft(mb, [cab_section(y, hwb, hwt, zb, zt) for (y, hwb, hwt, zb, zt, _) in CAB], cab_mat, flip=True)
    for x in (-TRACK, TRACK):
        for y in (-AXLE_Y, AXLE_Y):
            wheel(mb, x, y)
    wheel_wells(mb)
    flares(mb)
    door_details(mb)
    lamps(mb)
    bumpers(mb)
    roof_box(mb)
    interior(mb)
    # rear hatch handle (no number plate)
    mb.tube('car_chrome', [(-0.12, -1.282, 0.78), (0.12, -1.282, 0.78)], 0.012, seg=5)
    rest = mb.build('microcar_parts', collection, bevel_width=0.012, bevel_segments=1, smooth_angle=60.0)

    # 3. join into one object
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    body.select_set(True)
    rest.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body.name = 'microcar'
    body.data.name = 'microcar'
    return body
