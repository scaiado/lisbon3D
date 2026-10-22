"""Roof kit: canal-tile ('telha de canudo') surfaces as real geometry with stepped rows, ridge and hip
capping, the double-row 'beirado' eave, chimneys, dormers and aerials. Built in the building's local frame
(façade along x at y=0, street on -y)."""
import math

from mathutils import Vector

from .geo import tr, rot_z

PERIOD = 0.24      # channel + cap width
ROW = 0.42         # tile row length along the slope


def tile_height(u, f):
    """Heightfield over the roof plane: rounded caps, shallow channels, a lip at each row's lower edge."""
    s = (u / PERIOD) % 1.0
    w = math.sin(2 * math.pi * s)
    h = 0.042 * (max(w, 0.0) ** 0.6) - 0.012 * (max(-w, 0.0) ** 0.6)
    return h + 0.026 * (1.0 - f)


def roof_plane(mb, O, U, V, Lu, Lv, hip_l=0.0, hip_r=0.0, detail=2, mat='roof_tile'):
    """Plane from eave (v=0) to ridge (v=Lv). O = eave-left corner, U = unit along eave, V = unit up-slope.
    hip_l / hip_r: how far the left/right boundary moves inward at the ridge (hips); 0 for a gable."""
    O, U, V = Vector(O), Vector(U).normalized(), Vector(V).normalized()
    N = U.cross(V).normalized()
    k = 4 if detail >= 2 else 2
    nu = max(2, int(math.ceil(Lu / PERIOD)) * k)
    rows = max(1, int(math.ceil(Lv / ROW)))
    fs = (0.0, 0.88) if detail >= 2 else (0.0,)
    vs = []
    for r in range(rows):
        for f in fs:
            v = (r + f) * ROW
            if v < Lv:
                vs.append((v, f))
    vs.append((Lv, 0.5))
    nv = len(vs) - 1

    def P(i, j):
        v, f = vs[j]
        t = v / Lv
        a = hip_l * t
        b = Lu - hip_r * t
        u = Lu * i / nu
        uc = min(max(u, a), b)
        h = tile_height(u, f) if a <= u <= b else tile_height(uc, f)
        p = O + U * uc + V * v + N * h
        return (p.x, p.y, p.z)

    # 16 x 16 tiles per texture period; offset each plane so neighbouring roofs don't line up
    ou = (abs(O.x * 7.31 + O.y * 3.17) % 16) / 16.0
    ov = (abs(O.x * 1.93 + O.z * 5.71) % 16) / 16.0

    def UV(i, j):
        return (ou + Lu * i / nu / (16 * PERIOD), ov + vs[j][0] / (16 * ROW))

    def keep(i, j):
        # drop quads lying wholly outside the hip boundaries (they would collapse onto the hip line)
        u0, u1 = Lu * i / nu, Lu * (i + 1) / nu
        for jj in (j, j + 1):
            t = vs[jj][0] / Lv
            if u1 > hip_l * t - 1e-6 and u0 < Lu - hip_r * t + 1e-6:
                return True
        return False

    mb.grid(mat, nu, nv, P, uvfn=UV, smooth=True, keep=keep if (hip_l or hip_r) else None)
    # underside so the eave overhang is never see-through
    E0 = O
    E1 = O + U * Lu
    T0 = O + U * hip_l + V * Lv
    T1 = O + U * (Lu - hip_r) + V * Lv
    off = -N * 0.03
    mb.poly('wood_brown', [tuple(E0 + off), tuple(T0 + off), tuple(T1 + off), tuple(E1 + off)])


def cap_line(mb, a, b, r=0.1, mat='roof_tile', piece=0.4):
    """Row of rounded capping tiles along a ridge or hip line."""
    a, b = Vector(a), Vector(b)
    L = (b - a).length
    n = max(1, int(L / piece))
    for k in range(n):
        p0 = a + (b - a) * (k / n)
        p1 = a + (b - a) * ((k + 1) / n) + (b - a).normalized() * 0.03
        mb.cyl(mat, tuple(p0 + Vector((0, 0, 0.02))), tuple(p1 + Vector((0, 0, 0.02))), r * 0.92, seg=8, r1=r * 1.08)


def beirado(mb, x0, x1, z, rows=2, mat='roof_tile', backing='plaster_white'):
    """Portuguese eave: rows of canal-tile ends bedded in lime mortar, stepping out under the roof edge."""
    mb.box(backing, (x0 - 0.05, -0.30, z - 0.26), (x1 + 0.05, 0.02, z), bevel=True)
    for r in range(rows):
        zz = z - 0.05 - r * 0.12
        out = 0.42 - r * 0.14
        n = int((x1 - x0) / PERIOD)
        off = (PERIOD / 2) * (r % 2)
        for k in range(n):
            cx = x0 + off + (k + 0.5) * (x1 - x0 - off) / n
            mb.cyl(mat, (cx, -0.2, zz), (cx, -out, zz), 0.065, seg=8, r1=0.075, caps=True)


def chimney(mb, x, y, z_base, z_top, mat='plaster_white', w=0.62, d=0.48):
    mb.box(mat, (x - w / 2, y - d / 2, z_base), (x + w / 2, y + d / 2, z_top))
    mb.box('lioz', (x - w / 2 - 0.05, y - d / 2 - 0.05, z_top), (x + w / 2 + 0.05, y + d / 2 + 0.05, z_top + 0.08))
    # four little posts and a two-slope tile hood
    for sx in (-1, 1):
        for sy in (-1, 1):
            mb.box(mat, (x + sx * (w / 2 - 0.06) - 0.05, y + sy * (d / 2 - 0.06) - 0.05, z_top + 0.08),
                   (x + sx * (w / 2 - 0.06) + 0.05, y + sy * (d / 2 - 0.06) + 0.05, z_top + 0.3))
    zh = z_top + 0.3
    for s in (-1, 1):
        q = [(x - w / 2 - 0.1, y + s * (d / 2 + 0.12), zh), (x + w / 2 + 0.1, y + s * (d / 2 + 0.12), zh),
             (x + w / 2 + 0.1, y, zh + 0.22), (x - w / 2 - 0.1, y, zh + 0.22)]
        uv = [(0, 0), (0.25, 0), (0.25, 0.06), (0, 0.06)]
        if s > 0:
            q, uv = q[::-1], uv[::-1]
        mb.quad('roof_tile', *q, uvs=uv)
    mb.cyl('roof_tile', (x - w / 2 - 0.12, y, zh + 0.23), (x + w / 2 + 0.12, y, zh + 0.23), 0.06, seg=6)
    # soot
    mb.box('dark', (x - w / 2 + 0.1, y - d / 2 + 0.1, z_top + 0.075), (x + w / 2 - 0.1, y + d / 2 - 0.1, z_top + 0.09), bevel=False)


def aerial(mb, x, y, z, h=2.2):
    mb.cyl('iron', (x, y, z), (x, y, z + h), 0.018, seg=5)
    for k, L in enumerate((0.9, 0.7, 0.5)):
        zz = z + h - 0.15 - k * 0.28
        mb.cyl('iron', (x - L / 2, y, zz), (x + L / 2, y, zz), 0.008, seg=4, caps=False)
        for t in range(5):
            xx = x - L / 2 + L * t / 4
            mb.cyl('iron', (xx, y - 0.12, zz), (xx, y + 0.12, zz), 0.005, seg=3, caps=False)
    mb.cyl('iron', (x, y, z + h * 0.55), (x + 0.6, y + 0.9, z), 0.006, seg=3, caps=False)   # stay wire


def dormer(mb, cx, y_front, z_floor, w, wall_mat, wood='wood_white', pitch=28):
    """Pombaline 'trapeira': a small dormer with its own sash window and a two-slope tiled roof."""
    from .kit_facade import Opening, sash_window, reveal
    h = 1.45
    d = 1.6
    x0, x1 = cx - w / 2, cx + w / 2
    # cheeks and front wall around the window opening
    o = Opening(cx - 0.36, cx + 0.36, z_floor + 0.25, z_floor + 1.25, 'win', 0.1)
    mb.box(wall_mat, (x0, y_front, z_floor - 0.3), (x0 + 0.12, y_front + d, z_floor + h))
    mb.box(wall_mat, (x1 - 0.12, y_front, z_floor - 0.3), (x1, y_front + d, z_floor + h))
    mb.box(wall_mat, (x0, y_front, z_floor - 0.3), (x1, y_front + 0.1, o.z0))
    mb.box(wall_mat, (x0, y_front, o.z1), (x1, y_front + 0.1, z_floor + h))
    mb.box(wall_mat, (x0, y_front, o.z0), (o.x0, y_front + 0.1, o.z1))
    mb.box(wall_mat, (o.x1, y_front, o.z0), (x1, y_front + 0.1, o.z1))
    with mb.at(tr(0, y_front, 0)):
        reveal(mb, o, 0.18, wall_mat)
        sash_window(mb, o, 0.18, (2, 2), wood)
        mb.box('lioz', (o.x0 - 0.1, -0.04, o.z0 - 0.06), (o.x1 + 0.1, 0.02, o.z0))
    # small gable roof
    rise = (w / 2 + 0.15) * math.tan(math.radians(pitch))
    zt = z_floor + h
    for s in (-1, 1):
        a = Vector((cx + s * (w / 2 + 0.15), y_front - 0.15, zt))
        b = Vector((cx, y_front - 0.15, zt + rise))
        Lu = d + 0.15
        U = Vector((0, 1, 0))
        V = (b - a)
        Lv = V.length
        if s > 0:
            roof_plane(mb, a, U, V, Lu, Lv, detail=1)
        else:
            roof_plane(mb, a + U * Lu, -U, V, Lu, Lv, detail=1)
    cap_line(mb, (cx, y_front - 0.15, zt + rise), (cx, y_front + d, zt + rise), r=0.08)
    # gable triangle over the window
    mb.poly(wall_mat, [(cx - w / 2, y_front, zt), (cx + w / 2, y_front, zt), (cx, y_front, zt + rise - 0.05)])
    mb.box('lioz', (cx - w / 2 - 0.05, y_front - 0.06, zt - 0.08), (cx + w / 2 + 0.05, y_front + 0.02, zt))


def build_roof(mb, W, D, z_e, kind, pitch=26.0, ov_front=0.32, ov_back=0.25, ov_side=0.0, detail=2):
    """kind 'gable': ridge along the façade with gable walls at x=0/W. 'hip': four planes.
    Returns (ridge_z, plane height function z(x, y))."""
    t = math.tan(math.radians(pitch))
    yr = D / 2
    zr = z_e + yr * t
    x0, x1 = -ov_side, W + ov_side
    Lu = x1 - x0
    # front plane: eave at y=-ov_front, ridge at y=yr
    e_front = Vector((x0, -ov_front, z_e - ov_front * t))
    V_front = Vector((0, yr + ov_front, (yr + ov_front) * t))
    e_back = Vector((x1, D + ov_back, z_e - ov_back * t))
    V_back = Vector((0, -(yr + ov_back), (yr + ov_back) * t))
    if kind == 'gable':
        roof_plane(mb, e_front, (1, 0, 0), V_front, Lu, V_front.length, detail=detail)
        roof_plane(mb, e_back, (-1, 0, 0), V_back, Lu, V_back.length, detail=detail)
        cap_line(mb, (x0, yr, zr), (x1, yr, zr))
        # gable-end verge tiles
        for xe in (x0, x1):
            cap_line(mb, (xe, -ov_front, z_e - ov_front * t), (xe, yr, zr), r=0.07)
            cap_line(mb, (xe, yr, zr), (xe, D + ov_back, z_e - ov_back * t), r=0.07)
    else:
        ov = ov_front
        hl = min(yr, W / 2 - 0.2)
        ze = z_e - ov * t
        Lu = W + 2 * ov
        Vf = Vector((0, yr + ov, zr - ze))
        Vb = Vector((0, -(yr + ov), zr - ze))
        roof_plane(mb, (-ov, -ov, ze), (1, 0, 0), Vf, Lu, Vf.length, hip_l=hl + ov, hip_r=hl + ov, detail=detail)
        roof_plane(mb, (W + ov, D + ov, ze), (-1, 0, 0), Vb, Lu, Vb.length, hip_l=hl + ov, hip_r=hl + ov, detail=detail)
        D_tot = D + 2 * ov
        for s_, xe in ((1, -ov), (-1, W + ov)):
            O = Vector((xe, D + ov if s_ > 0 else -ov, ze))
            U = Vector((0, -1 if s_ > 0 else 1, 0))
            V = Vector((s_ * (hl + ov), 0, zr - ze))
            roof_plane(mb, O, U, V, D_tot, V.length, hip_l=yr + ov, hip_r=D_tot - (yr + ov), detail=detail)
        ra = (hl, yr, zr)
        rb = (W - hl, yr, zr)
        cap_line(mb, ra, rb)
        for (cx, cy) in ((-ov, -ov), (W + ov, -ov), (-ov, D + ov), (W + ov, D + ov)):
            top = ra if cx < W / 2 else rb
            cap_line(mb, (cx, cy, ze), top, r=0.08)

    def zf(x, y):
        if y <= yr:
            return z_e + y * t
        return z_e + (D - y) * t
    return zr, zf
