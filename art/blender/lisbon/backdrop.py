"""Mid-ground city, the riverfront, the river and the painted far cards.

The mid-ground is a field of city blocks on a street grid, stepping down the hill to the river. Each block is a
ring of individual buildings around a courtyard. Every building has its own footprint, setback, height, colour (a
per-face tint on one shared painted-façade material), cornice and eaves, and its roof is one of: hip, gable,
mansard with dormers, or a flat terrace with a parapet and a small rooftop room. Blocks near the authored street get
real canal-tile roof geometry; farther ones use textured planes. One church with two bell towers and a row of larger
riverfront buildings with trees give the view a few landmarks. The river is one plane; the far shore and the bridge
are painted cards (backdrop_*, unlit, with their haze painted in).
"""
import math
import random

from mathutils import Vector

from .geo import MeshBuilder, tr, rot_z
from . import kit_roof as R
from . import street as S
from .materials import hex_lin

QUAY_Y = 290.0
QUAY_Z = S.road_z(S.LENGTH) - 18.0      # Cais do Sodré is ~45 m below the top of the Bica
RIVER_Z = QUAY_Z - 3.0
X_MIN, X_MAX = -170.0, 330.0
ROOF_T = (16 * R.PERIOD, 16 * R.ROW)    # roof texture period in metres

WALL_COLOURS = ['#D9A14E', '#D98E7A', '#EFE2C6', '#F2EDE2', '#9DB4C6', '#E8BE5A', '#A9BFA0', '#E3B38E', '#C9B79A',
                '#E8D3A8', '#D4A4A0', '#BFC9C2']
ROOF_TINTS = [(1.0, 1.0, 1.0), (0.94, 0.9, 0.88), (1.04, 0.98, 0.94), (0.9, 0.86, 0.84), (1.0, 0.95, 0.9)]


def terrain(x, y):
    """Ground of the mid-ground: the Bica slope easing out to the flat riverfront, with Chiado rising to the east (-x)
    and the Santa Catarina shoulder to the west (+x) near the top."""
    if y <= 0:
        base = 0.6
    elif y <= S.LENGTH:
        base = S.road_z(y)
    else:
        t = min(1.0, (y - S.LENGTH) / (QUAY_Y - S.LENGTH))
        t = t * t * (3 - 2 * t)
        base = S.road_z(S.LENGTH) + (QUAY_Z - S.road_z(S.LENGTH)) * t
    fade = max(0.0, 1.0 - max(0.0, y) / (QUAY_Y - 30))
    east = 0.14 * max(0.0, -x - 18) * fade
    west = 6.0 * math.exp(-((x - 70) / 45) ** 2) * math.exp(-((y - 20) / 60) ** 2)
    return base + east + west


def lin_tint(h):
    return hex_lin(h)


def occupied(x0, x1, y0, y1):
    """Keep clear of the authored street and its buildings, the cross street, the bottom street and the river."""
    if y1 > QUAY_Y - 14:
        return True
    if y1 > S.CROSS_Y0 - 1 and y0 < S.CROSS_Y1 + 1:
        return True
    if x1 > -15 and x0 < 15 and y0 < S.LENGTH + 2:
        return True
    if x1 > -6 and x0 < 6:
        return True
    if S.LENGTH + 2 <= y1 and y0 < S.LENGTH + 11:
        return True
    return False


# ---------------------------------------------------------------------------- one mid-ground building
def building(mb, rnd, x0, y0, x1, y1, ground, detail_roof, church_like=False):
    w, d = x1 - x0, y1 - y0
    storeys = rnd.choice((3, 4, 4, 5, 5, 6))
    h = storeys * 3.1 + rnd.uniform(-0.3, 0.6)
    top = ground + h
    wall = rnd.choice(WALL_COLOURS)
    mb.set_tint(lin_tint(wall))
    mb.box('mid_wall', (x0, y0, ground - 8.0), (x1, y1, top), bevel=False, skip=('-z', '+z'))
    # stone base course and cornice band, all four sides
    mb.set_tint((1.0, 1.0, 1.0))
    mb.box('lioz', (x0 - 0.06, y0 - 0.06, ground - 1.0), (x1 + 0.06, y1 + 0.06, ground + 0.6), bevel=False, skip=('-z',))
    ck = rnd.choice(('cornice', 'cornice', 'eave'))
    if ck == 'cornice':
        mb.box('lioz', (x0 - 0.22, y0 - 0.22, top - 0.1), (x1 + 0.22, y1 + 0.22, top + 0.32), bevel=False, skip=('-z',))
        eave = top + 0.32
    else:
        mb.box('lioz', (x0 - 0.12, y0 - 0.12, top - 0.05), (x1 + 0.12, y1 + 0.12, top + 0.12), bevel=False, skip=('-z',))
        eave = top + 0.12
    # a string course and balcony lines on some
    if storeys >= 4 and rnd.random() < 0.6:
        z = ground + 3.6
        mb.box('lioz', (x0 - 0.05, y0 - 0.05, z), (x1 + 0.05, y1 + 0.05, z + 0.18), bevel=False)
    if rnd.random() < 0.45:
        side = rnd.choice(('-y', '+y', '-x', '+x'))
        for k in range(1, min(storeys, 4)):
            z = ground + 3.6 + (k - 1) * 3.1 + 0.05
            balcony_line(mb, side, x0, y0, x1, y1, z)

    kind = 'terrace' if rnd.random() < 0.1 else rnd.choice(('hip', 'hip', 'gable', 'mansard'))
    roof_tint = rnd.choice(ROOF_TINTS)
    mb.set_tint(roof_tint)
    ov = 0.3
    if kind == 'terrace':
        mb.set_tint(lin_tint(wall))
        for (a, b, c, e) in ((x0, y0, x1, y0 + 0.25), (x0, y1 - 0.25, x1, y1), (x0, y0, x0 + 0.25, y1), (x1 - 0.25, y0, x1, y1)):
            mb.box('mid_wall', (a, b, eave), (c, e, eave + 1.0), bevel=False, skip=('-z',))
        mb.set_tint((1.0, 1.0, 1.0))
        mb.quad('setts', (x0, y0, eave + 0.05), (x1, y0, eave + 0.05), (x1, y1, eave + 0.05), (x0, y1, eave + 0.05))
        # small rooftop room with its own tiled roof
        rx0 = x0 + rnd.uniform(0.6, w * 0.4)
        ry0 = y0 + rnd.uniform(0.6, d * 0.4)
        rw, rd = min(4.0, w * 0.45), min(3.5, d * 0.45)
        mb.set_tint(lin_tint(wall))
        mb.box('mid_wall', (rx0, ry0, eave), (rx0 + rw, ry0 + rd, eave + 2.6), bevel=False, skip=('-z', '+z'))
        mb.set_tint(roof_tint)
        hip(mb, rx0, ry0, rx0 + rw, ry0 + rd, eave + 2.6, 0.2, 24, False)
    elif kind == 'gable':
        gable(mb, x0, y0, x1, y1, eave, ov, rnd.uniform(22, 30), detail_roof, wall)
    elif kind == 'mansard':
        mansard(mb, rnd, x0, y0, x1, y1, eave, wall)
    else:
        hip(mb, x0, y0, x1, y1, eave, ov, rnd.uniform(22, 30), detail_roof)
    # chimneys
    mb.set_tint(lin_tint(wall))
    for _ in range(rnd.choice((0, 1, 1, 2, 3))):
        cx = rnd.uniform(x0 + 1.0, x1 - 1.5)
        cy = rnd.uniform(y0 + 1.0, y1 - 1.5)
        hgt = rnd.uniform(2.2, 3.4)
        mb.box('mid_wall', (cx, cy, eave), (cx + 0.55, cy + 0.45, eave + hgt), bevel=False, skip=('-z',))
        mb.set_tint((1.0, 1.0, 1.0))
        mb.box('lioz', (cx - 0.06, cy - 0.06, eave + hgt), (cx + 0.61, cy + 0.51, eave + hgt + 0.1), bevel=False, skip=('-z',))
        mb.set_tint(lin_tint(wall))
    if rnd.random() < 0.18:
        ax, ay = rnd.uniform(x0 + 1, x1 - 1), rnd.uniform(y0 + 1, y1 - 1)
        mb.set_tint((1.0, 1.0, 1.0))
        mb.cyl('iron', (ax, ay, eave), (ax, ay, eave + 4.5), 0.03, seg=4, caps=False)
        mb.cyl('iron', (ax - 0.6, ay, eave + 4.2), (ax + 0.6, ay, eave + 4.2), 0.02, seg=3, caps=False)


def balcony_line(mb, side, x0, y0, x1, y1, z):
    mb.set_tint((1.0, 1.0, 1.0))
    if side in ('-y', '+y'):
        y = y0 if side == '-y' else y1
        s = -1 if side == '-y' else 1
        mb.box('lioz', (x0 + 0.4, y, z), (x1 - 0.4, y + s * 0.7, z + 0.12), bevel=False)
        mb.box('iron', (x0 + 0.4, y + s * 0.66, z + 0.12), (x1 - 0.4, y + s * 0.7, z + 1.0), bevel=False)
    else:
        x = x0 if side == '-x' else x1
        s = -1 if side == '-x' else 1
        mb.box('lioz', (x, y0 + 0.4, z), (x + s * 0.7, y1 - 0.4, z + 0.12), bevel=False)
        mb.box('iron', (x + s * 0.66, y0 + 0.4, z + 0.12), (x + s * 0.7, y1 - 0.4, z + 1.0), bevel=False)


def plane(mb, a, b, c, d, origin, along):
    """Textured roof plane (quad or triangle when c == d) with UVs in roof-texture periods."""
    O = Vector(origin)
    A = Vector(along).normalized()
    pts = [Vector(p) for p in (a, b, c, d)]
    up = (pts[1] - pts[0]).cross(pts[3] - pts[0]) if (pts[3] - pts[0]).length > 1e-6 else (pts[1] - pts[0]).cross(pts[2] - pts[0])
    V = up.cross(A).normalized()
    if V.z < 0:
        V = -V
    uvs = [((p - O).dot(A) / ROOF_T[0], (p - O).dot(V) / ROOF_T[1]) for p in pts]
    if (pts[2] - pts[3]).length < 1e-6:
        mb.poly('roof_tile', [tuple(p) for p in pts[:3]], uvs=uvs[:3])
    else:
        mb.poly('roof_tile', [tuple(p) for p in pts], uvs=uvs)


def hip(mb, x0, y0, x1, y1, z, ov, pitch, detail_roof):
    w, d = x1 - x0, y1 - y0
    t = math.tan(math.radians(pitch))
    along_x = w >= d
    if detail_roof:
        with mb.at(tr(x0, y0, 0) if along_x else tr(x1, y0, 0) @ rot_z(90)):
            W, D = (w, d) if along_x else (d, w)
            R.build_roof(mb, W, D, z, 'hip', pitch, ov_front=ov, ov_back=ov, detail=1)
        return
    X0, Y0, X1, Y1 = x0 - ov, y0 - ov, x1 + ov, y1 + ov
    ze = z - ov * t
    if along_x:
        half = (Y1 - Y0) / 2
        zr = ze + half * t
        ym = (Y0 + Y1) / 2
        r0, r1 = (X0 + half, ym, zr), (X1 - half, ym, zr)
        if r0[0] > r1[0]:
            r0 = r1 = ((X0 + X1) / 2, ym, zr)
        plane(mb, (X0, Y0, ze), (X1, Y0, ze), r1, r0, (X0, Y0, ze), (1, 0, 0))
        plane(mb, (X1, Y1, ze), (X0, Y1, ze), r0, r1, (X1, Y1, ze), (-1, 0, 0))
        plane(mb, (X0, Y1, ze), (X0, Y0, ze), r0, r0, (X0, Y1, ze), (0, -1, 0))
        plane(mb, (X1, Y0, ze), (X1, Y1, ze), r1, r1, (X1, Y0, ze), (0, 1, 0))
    else:
        half = (X1 - X0) / 2
        zr = ze + half * t
        xm = (X0 + X1) / 2
        r0, r1 = (xm, Y0 + half, zr), (xm, Y1 - half, zr)
        if r0[1] > r1[1]:
            r0 = r1 = (xm, (Y0 + Y1) / 2, zr)
        plane(mb, (X1, Y0, ze), (X1, Y1, ze), r1, r0, (X1, Y0, ze), (0, 1, 0))
        plane(mb, (X0, Y1, ze), (X0, Y0, ze), r0, r1, (X0, Y1, ze), (0, -1, 0))
        plane(mb, (X0, Y0, ze), (X1, Y0, ze), r0, r0, (X0, Y0, ze), (1, 0, 0))
        plane(mb, (X1, Y1, ze), (X0, Y1, ze), r1, r1, (X1, Y1, ze), (-1, 0, 0))
    # soffit
    mb.set_tint((1.0, 1.0, 1.0))
    mb.poly('wood_brown', [(X0, Y0, ze - 0.03), (X0, Y1, ze - 0.03), (X1, Y1, ze - 0.03), (X1, Y0, ze - 0.03)])


def gable(mb, x0, y0, x1, y1, z, ov, pitch, detail_roof, wall):
    w, d = x1 - x0, y1 - y0
    t = math.tan(math.radians(pitch))
    along_x = w >= d
    if detail_roof:
        with mb.at(tr(x0, y0, 0) if along_x else tr(x1, y0, 0) @ rot_z(90)):
            W, D = (w, d) if along_x else (d, w)
            R.build_roof(mb, W, D, z, 'gable', pitch, ov_front=ov, ov_back=ov, detail=1)
            mb.set_tint(lin_tint(wall))
            for xe, flip in ((0.0, False), (W, True)):
                pts = [(xe, 0.0, z), (xe, D / 2, z + D / 2 * t), (xe, D, z)]
                mb.poly('mid_wall', pts if not flip else pts[::-1])
        return
    X0, Y0, X1, Y1 = x0 - (0.1 if along_x else ov), y0 - (ov if along_x else 0.1), x1 + (0.1 if along_x else ov), y1 + (ov if along_x else 0.1)
    if along_x:
        ze = z - ov * t
        ym = (y0 + y1) / 2
        zr = z + (d / 2) * t
        plane(mb, (X0, Y0, ze), (X1, Y0, ze), (X1, ym, zr), (X0, ym, zr), (X0, Y0, ze), (1, 0, 0))
        plane(mb, (X1, Y1, ze), (X0, Y1, ze), (X0, ym, zr), (X1, ym, zr), (X1, Y1, ze), (-1, 0, 0))
        mb.set_tint(lin_tint(wall))
        mb.poly('mid_wall', [(x0, y0, z), (x0, y1, z), (x0, ym, zr)][::-1])
        mb.poly('mid_wall', [(x1, y0, z), (x1, y1, z), (x1, ym, zr)])
    else:
        ze = z - ov * t
        xm = (x0 + x1) / 2
        zr = z + (w / 2) * t
        plane(mb, (X1, Y0, ze), (X1, Y1, ze), (xm, Y1, zr), (xm, Y0, zr), (X1, Y0, ze), (0, 1, 0))
        plane(mb, (X0, Y1, ze), (X0, Y0, ze), (xm, Y0, zr), (xm, Y1, zr), (X0, Y1, ze), (0, -1, 0))
        mb.set_tint(lin_tint(wall))
        mb.poly('mid_wall', [(x0, y0, z), (x1, y0, z), (xm, y0, zr)])
        mb.poly('mid_wall', [(x0, y1, z), (x1, y1, z), (xm, y1, zr)][::-1])


def mansard(mb, rnd, x0, y0, x1, y1, z, wall):
    """Pombaline mansard: a steep lower ring with dormers, then a low hip on top."""
    inset = 1.1
    zt = z + 2.0
    X0, Y0, X1, Y1 = x0 + inset, y0 + inset, x1 - inset, y1 - inset
    e = 0.15
    plane(mb, (x0 - e, y0 - e, z), (x1 + e, y0 - e, z), (X1, Y0, zt), (X0, Y0, zt), (x0, y0, z), (1, 0, 0))
    plane(mb, (x1 + e, y1 + e, z), (x0 - e, y1 + e, z), (X0, Y1, zt), (X1, Y1, zt), (x1, y1, z), (-1, 0, 0))
    plane(mb, (x0 - e, y1 + e, z), (x0 - e, y0 - e, z), (X0, Y0, zt), (X0, Y1, zt), (x0, y1, z), (0, -1, 0))
    plane(mb, (x1 + e, y0 - e, z), (x1 + e, y1 + e, z), (X1, Y1, zt), (X1, Y0, zt), (x1, y0, z), (0, 1, 0))
    hip(mb, X0, Y0, X1, Y1, zt, 0.05, 16, False)
    # dormers on the long sides
    long_x = (x1 - x0) >= (y1 - y0)
    n = max(1, int(((x1 - x0) if long_x else (y1 - y0)) / 3.2))
    for k in range(n):
        t = (k + 0.5) / n
        mb.set_tint(lin_tint(wall))
        if long_x:
            cx = x0 + (x1 - x0) * t
            for (yy, s) in ((y0 + 0.35, -1), (y1 - 0.35, 1)):
                mb.box('mid_wall', (cx - 0.55, yy - 0.6, z), (cx + 0.55, yy + 0.6, z + 1.6), bevel=False, skip=('-z',))
                mb.set_tint((1.0, 1.0, 1.0))
                mb.quad('glass', (cx - 0.3, yy + s * 0.61, z + 0.3), (cx + 0.3, yy + s * 0.61, z + 0.3), (cx + 0.3, yy + s * 0.61, z + 1.3),
                        (cx - 0.3, yy + s * 0.61, z + 1.3), uvs=((0, 0), (1, 0), (1, 1), (0, 1))) if s < 0 else \
                    mb.quad('glass', (cx + 0.3, yy + s * 0.61, z + 0.3), (cx - 0.3, yy + s * 0.61, z + 0.3), (cx - 0.3, yy + s * 0.61, z + 1.3),
                            (cx + 0.3, yy + s * 0.61, z + 1.3), uvs=((0, 0), (1, 0), (1, 1), (0, 1)))
                mb.set_tint(rnd.choice(ROOF_TINTS))
                plane(mb, (cx - 0.7, yy - 0.7, z + 1.6), (cx + 0.7, yy - 0.7, z + 1.6), (cx + 0.7, yy, z + 2.1), (cx - 0.7, yy, z + 2.1),
                      (cx - 0.7, yy - 0.7, z + 1.6), (1, 0, 0))
                plane(mb, (cx + 0.7, yy + 0.7, z + 1.6), (cx - 0.7, yy + 0.7, z + 1.6), (cx - 0.7, yy, z + 2.1), (cx + 0.7, yy, z + 2.1),
                      (cx + 0.7, yy + 0.7, z + 1.6), (-1, 0, 0))
                mb.set_tint(lin_tint(wall))
        else:
            cy = y0 + (y1 - y0) * t
            for (xx, s) in ((x0 + 0.35, -1), (x1 - 0.35, 1)):
                mb.box('mid_wall', (xx - 0.6, cy - 0.55, z), (xx + 0.6, cy + 0.55, z + 1.6), bevel=False, skip=('-z',))
                mb.set_tint(rnd.choice(ROOF_TINTS))
                plane(mb, (xx + 0.7, cy - 0.7, z + 1.6), (xx + 0.7, cy + 0.7, z + 1.6), (xx, cy + 0.7, z + 2.1), (xx, cy - 0.7, z + 2.1),
                      (xx + 0.7, cy - 0.7, z + 1.6), (0, 1, 0))
                plane(mb, (xx - 0.7, cy + 0.7, z + 1.6), (xx - 0.7, cy - 0.7, z + 1.6), (xx, cy - 0.7, z + 2.1), (xx, cy + 0.7, z + 2.1),
                      (xx - 0.7, cy + 0.7, z + 1.6), (0, -1, 0))
                mb.set_tint(lin_tint(wall))


# ---------------------------------------------------------------------------- blocks, landmarks, river
def city_block(mb, rnd, bx0, by0, bx1, by1, near):
    """A ring of buildings around a courtyard, with varied widths, depths and setbacks."""
    for side in ('-y', '+y', '-x', '+x'):
        if side in ('-y', '+y'):
            x, x_end = bx0, bx1
            while x < x_end - 3.0:
                w = min(rnd.uniform(6.0, 13.0), x_end - x)
                if x_end - (x + w) < 4.0:
                    w = x_end - x
                dpt = rnd.uniform(8.0, 12.0)
                sb = rnd.choice((0.0, 0.0, 0.3, 0.6, 1.0))
                if side == '-y':
                    y0, y1 = by0 + sb, by0 + sb + dpt
                else:
                    y0, y1 = by1 - sb - dpt, by1 - sb
                xa = x + (0 if x == bx0 else 0.0)
                xb = x + w
                # corners belong to the -y/+y rows; the side rows fill between them
                g = min(terrain(xa, y0), terrain(xb, y0), terrain(xa, y1), terrain(xb, y1))
                if not occupied(xa, xb, y0, y1):
                    building(mb, rnd, xa, y0, xb, y1, g, near)
                x += w
        else:
            y, y_end = by0 + 12.5, by1 - 12.5
            while y < y_end - 3.0:
                d = min(rnd.uniform(6.0, 11.0), y_end - y)
                if y_end - (y + d) < 4.0:
                    d = y_end - y
                dpt = rnd.uniform(8.0, 11.0)
                sb = rnd.choice((0.0, 0.0, 0.4, 0.8))
                if side == '-x':
                    x0, x1 = bx0 + sb, bx0 + sb + dpt
                else:
                    x0, x1 = bx1 - sb - dpt, bx1 - sb
                g = min(terrain(x0, y), terrain(x1, y), terrain(x0, y + d), terrain(x1, y + d))
                if not occupied(x0, x1, y, y + d):
                    building(mb, rnd, x0, y, x1, y + d, g, near)
                y += d


def church(mb, x0, y0, ground):
    """A baroque parish church: lime-washed nave with tall windows and a pedimented front, two bell towers with
    tiled pyramid caps and finials. The front (-y end) faces downhill."""
    w, d, h = 14.0, 28.0, 13.0
    x1, y1 = x0 + w, y0 + d
    xm = (x0 + x1) / 2
    wall = 'plaster_white'
    mb.set_tint((1.0, 1.0, 1.0))
    mb.box(wall, (x0, y0, ground - 6), (x1, y1, ground + h), bevel=False, skip=('-z', '+z'))
    mb.box('lioz', (x0 - 0.3, y0 - 0.3, ground + h - 0.2), (x1 + 0.3, y1 + 0.3, ground + h + 0.5), bevel=False, skip=('-z',))
    mb.box('lioz', (x0 - 0.15, y0 - 0.15, ground - 1), (x1 + 0.15, y1 + 0.15, ground + 1.0), bevel=False, skip=('-z',))
    for xc in (x0, x1 - 0.6):
        mb.box('lioz', (xc - 0.1, y0 - 0.12, ground), (xc + 0.7, y0 + 0.4, ground + h), bevel=False)      # corner pilasters
    # tall arched windows along both sides, a portal and an oculus on the front
    for k in range(5):
        yc = y0 + 7.0 + k * 4.2
        for (xx, s) in ((x0 - 0.02, -1), (x1 + 0.02, 1)):
            q = [(xx, yc - 0.8, ground + 5.5), (xx, yc + 0.8, ground + 5.5), (xx, yc + 0.8, ground + 10.0), (xx, yc - 0.8, ground + 10.0)]
            mb.poly('dark', q if s > 0 else q[::-1])
            mb.box('lioz', (xx - 0.12, yc - 1.05, ground + 5.2), (xx + 0.12, yc + 1.05, ground + 5.5), bevel=False)
    mb.quad('wood_brown', (xm - 1.4, y0 - 0.03, ground), (xm + 1.4, y0 - 0.03, ground), (xm + 1.4, y0 - 0.03, ground + 4.6),
            (xm - 1.4, y0 - 0.03, ground + 4.6))
    for (a_, b_) in ((xm - 2.0, xm - 1.4), (xm + 1.4, xm + 2.0)):
        mb.box('lioz', (a_, y0 - 0.25, ground), (b_, y0 + 0.02, ground + 5.2), bevel=False)
    mb.box('lioz', (xm - 2.0, y0 - 0.3, ground + 4.6), (xm + 2.0, y0 + 0.02, ground + 5.4), bevel=False)
    mb.sphere('dark', (xm, y0 - 0.02, ground + 9.0), 1.0, seg=14, rings=6, sz=(1.0, 0.05, 1.0))
    # nave roof (ridge along y) and pediments
    t = math.tan(math.radians(30))
    zr = ground + h + 0.5 + (w / 2) * t
    mb.set_tint(ROOF_TINTS[1])
    plane(mb, (x1 + 0.3, y0, ground + h + 0.4), (x1 + 0.3, y1, ground + h + 0.4), (xm, y1, zr), (xm, y0, zr), (x1, y0, 0), (0, 1, 0))
    plane(mb, (x0 - 0.3, y1, ground + h + 0.4), (x0 - 0.3, y0, ground + h + 0.4), (xm, y0, zr), (xm, y1, zr), (x0, y1, 0), (0, -1, 0))
    mb.set_tint((1.0, 1.0, 1.0))
    mb.poly(wall, [(x0, y0 - 0.02, ground + h + 0.5), (x1, y0 - 0.02, ground + h + 0.5), (xm, y0 - 0.02, zr + 0.8)])
    mb.poly(wall, [(x0, y1 + 0.02, ground + h + 0.5), (xm, y1 + 0.02, zr), (x1, y1 + 0.02, ground + h + 0.5)])
    for tx in (x0 - 1.0, x1 - 4.0):
        tw = 5.0
        mb.box(wall, (tx, y0 - 1.0, ground - 6), (tx + tw, y0 + 4.0, ground + h + 8.0), bevel=False, skip=('-z', '+z'))
        for zz in (ground + h + 0.2, ground + h + 8.0):
            mb.box('lioz', (tx - 0.25, y0 - 1.25, zz - 0.2), (tx + tw + 0.25, y0 + 4.25, zz + 0.35), bevel=False, skip=('-z',))
        # belfry openings: dark arches on each face
        zb = ground + h + 2.6
        mb.quad('dark', (tx + 1.4, y0 - 1.02, zb), (tx + 3.6, y0 - 1.02, zb), (tx + 3.6, y0 - 1.02, zb + 3.6), (tx + 1.4, y0 - 1.02, zb + 3.6))
        mb.quad('dark', (tx + 3.6, y0 + 4.02, zb), (tx + 1.4, y0 + 4.02, zb), (tx + 1.4, y0 + 4.02, zb + 3.6), (tx + 3.6, y0 + 4.02, zb + 3.6))
        mb.quad('dark', (tx - 0.02, y0 + 2.6, zb), (tx - 0.02, y0 + 0.4, zb), (tx - 0.02, y0 + 0.4, zb + 3.6), (tx - 0.02, y0 + 2.6, zb + 3.6))
        mb.quad('dark', (tx + tw + 0.02, y0 + 0.4, zb), (tx + tw + 0.02, y0 + 2.6, zb), (tx + tw + 0.02, y0 + 2.6, zb + 3.6),
                (tx + tw + 0.02, y0 + 0.4, zb + 3.6))
        # tiled pyramid cap with a finial
        mb.set_tint(ROOF_TINTS[0])
        zc = ground + h + 8.35
        c = (tx + tw / 2, y0 + 1.5, zc + 3.4)
        corners = [(tx - 0.2, y0 - 1.2, zc), (tx + tw + 0.2, y0 - 1.2, zc), (tx + tw + 0.2, y0 + 4.2, zc), (tx - 0.2, y0 + 4.2, zc)]
        for k in range(4):
            a, b = corners[k], corners[(k + 1) % 4]
            mb.poly('roof_tile', [a, b, c], uvs=[(0, 0), (0.4, 0), (0.2, 0.3)])
        mb.set_tint((1.0, 1.0, 1.0))
        mb.cyl('brass', c, (c[0], c[1], c[2] + 1.4), 0.07, seg=6)
        mb.sphere('brass', (c[0], c[1], c[2] + 0.35), 0.26, seg=8, rings=5)


def trees(mb, rnd, pts):
    for (x, y) in pts:
        g = terrain(x, y)
        h = rnd.uniform(5.5, 8.0)
        mb.set_tint((1.0, 1.0, 1.0))
        mb.cyl('wood_brown', (x, y, g), (x, y, g + h * 0.6), 0.18, seg=6, r1=0.12)
        mb.set_tint((rnd.uniform(0.85, 1.05), rnd.uniform(0.9, 1.05), rnd.uniform(0.85, 1.0)))
        for k in range(4):
            a = rnd.uniform(0, 6.28)
            r = rnd.uniform(1.4, 2.4)
            mb.sphere('foliage', (x + math.cos(a) * 1.2, y + math.sin(a) * 1.2, g + h * 0.62 + rnd.uniform(0, 1.6)), r, seg=10, rings=6,
                      sz=(r, r, r * 0.8))


def build(collection, seed=401):
    rnd = random.Random(seed)
    near_mb = MeshBuilder()     # blocks next to the authored street: tile geometry on roofs
    far_mb = MeshBuilder()
    # street grid: blocks 34-46 m across, streets 6-8 m
    xs = [X_MIN]
    while xs[-1] < X_MAX:
        xs.append(xs[-1] + rnd.uniform(34, 46) + rnd.uniform(6, 8))
    ys = [S.CROSS_Y0 - 50]
    while ys[-1] < QUAY_Y - 30:
        ys.append(ys[-1] + rnd.uniform(30, 42) + rnd.uniform(6, 8))
    church_done = False
    for i in range(len(xs) - 1):
        for j in range(len(ys) - 1):
            bx0, bx1 = xs[i] + 3.5, xs[i + 1] - 3.5
            by0, by1 = ys[j] + 3.5, ys[j + 1] - 3.5
            cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
            near = False      # tile geometry on mid-ground roofs costs ~430k triangles for no visible gain at 40 m+
            if not church_done and 40 < cx < 110 and 20 < cy < 90:
                church(far_mb, bx0 + 4, by0 + 2, terrain(cx, by0) - 0.3)
                city_block(far_mb, rnd, bx0, by0 + 40, bx1, by1, False)
                church_done = True
                continue
            city_block(near_mb if near else far_mb, rnd, bx0, by0, bx1, by1, near)
    # riverfront: a row of taller buildings along the quay road, and trees on the promenade
    x = X_MIN
    while x < X_MAX - 10:
        w = rnd.uniform(14, 24)
        y1 = QUAY_Y - 22
        if not (-8 < x + w and x < 8):
            building(far_mb, rnd, x, y1 - 14, x + w - 0.5, y1, terrain(x, y1) - 0.2, False)
        x += w
    trees(far_mb, rnd, [(xx, QUAY_Y - 10 + rnd.uniform(-1, 1)) for xx in range(int(X_MIN), int(X_MAX), 14) if abs(xx) > 8])
    # ground between the blocks so no sky shows through alleys
    gm = MeshBuilder()
    gm.set_tint((0.72, 0.72, 0.78))     # streets between blocks sit in shade most of the day
    nx, ny = 50, 60
    gx0, gx1, gy0, gy1 = X_MIN - 20, X_MAX + 20, S.CROSS_Y0 - 60, QUAY_Y
    gm.grid('setts', nx, ny, lambda i, j: (gx0 + (gx1 - gx0) * i / nx, gy0 + (gy1 - gy0) * j / ny,
                                           terrain(gx0 + (gx1 - gx0) * i / nx, gy0 + (gy1 - gy0) * j / ny) - 0.08),
            smooth=False,
            keep=lambda i, j: not (abs(gx0 + (gx1 - gx0) * (i + 0.5) / nx) < 14 and
                                   S.CROSS_Y0 - 2 < gy0 + (gy1 - gy0) * (j + 0.5) / ny < S.LENGTH + 4))
    objs = [o for o in (near_mb.build('midground_near', collection, bevel_width=0.0),
                        far_mb.build('midground', collection, bevel_width=0.0),
                        gm.build('midground_ground', collection, bevel_width=0.0)) if o is not None]

    water = MeshBuilder()
    water.poly('river', [(-3000, QUAY_Y, RIVER_Z), (3000, QUAY_Y, RIVER_Z), (3000, 1600, RIVER_Z), (-3000, 1600, RIVER_Z)])
    water.box('granite', (-600, QUAY_Y - 6, RIVER_Z - 2), (800, QUAY_Y, QUAY_Z + 0.3), bevel=False)
    objs.append(water.build('river', collection, bevel_width=0.0))

    objs.append(card('backdrop_far_shore', 'backdrop_far_shore', collection, -2800, 2800, 1350, RIVER_Z - 2, RIVER_Z + 170))
    objs.append(card('backdrop_bridge', 'backdrop_bridge', collection, 200, 1700, 1150, RIVER_Z - 4, RIVER_Z + 150))
    return objs


def card(name, mat, collection, x0, x1, y, z0, z1):
    mb = MeshBuilder()
    mb.poly(mat, [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
    return mb.build(name, collection, bevel_width=0.0)
