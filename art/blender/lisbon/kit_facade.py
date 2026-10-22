"""Façade kit. All modules are built in the façade's local frame:
x along the façade (0..W), wall face at y=0 with the street on -y, building body toward +y, z up from the
ground-floor datum. Sizes follow Lisbon proportions with STYLE-C's push: openings ~10% larger, chunkier stone.
"""
import math
import random

from .geo import MeshBuilder, tr, rot_x, rot_y, rot_z

# family presets (metres)
FAMILY = {
    'pombaline': dict(win_w=1.2, win_h=2.05, sill=0.85, door_w=1.35, door_h=2.9, bal_h=2.6, frame=0.17,
                      reveal=0.26, shop_w=2.5, shop_h=3.0, panes=(2, 3)),
    'bica': dict(win_w=1.0, win_h=1.55, sill=0.95, door_w=1.1, door_h=2.45, bal_h=2.25, frame=0.15,
                 reveal=0.22, shop_w=2.1, shop_h=2.55, panes=(2, 2)),
}


class Opening:
    def __init__(self, x0, x1, z0, z1, kind, frame):
        self.x0, self.x1, self.z0, self.z1, self.kind, self.frame = x0, x1, z0, z1, kind, frame

    def hole(self):
        return (self.x0, self.x1, self.z0, self.z1)


# ------------------------------------------------------------------ wall with holes
def wall(mb, W, z_bot, z_top, holes, mat_fn, step=0.55, y=0.0):
    """Wall plane 0..W x z_bot..z_top facing -y with rectangular holes. mat_fn(z) picks the material
    (plaster vs grout behind azulejos). Cells are split on every hole edge and on the material bands."""
    xs = {0.0, W}
    zs = {z_bot, z_top}
    for (x0, x1, z0, z1) in holes:
        xs.update((max(0, min(W, x0)), max(0, min(W, x1))))
        zs.update((max(z_bot, min(z_top, z0)), max(z_bot, min(z_top, z1))))
    for b in getattr(mat_fn, 'bands', ()):
        if z_bot < b < z_top:
            zs.add(b)
    xs = sorted(xs)
    zs = sorted(zs)
    for i in range(len(xs) - 1):
        for j in range(len(zs) - 1):
            cx = (xs[i] + xs[i + 1]) / 2
            cz = (zs[j] + zs[j + 1]) / 2
            if any(x0 < cx < x1 and z0 < cz < z1 for (x0, x1, z0, z1) in holes):
                continue
            if xs[i + 1] - xs[i] < 1e-4 or zs[j + 1] - zs[j] < 1e-4:
                continue
            mb.panel(mat_fn(cz), xs[i], xs[i + 1], zs[j], zs[j + 1], y=y, step=step)


def reveal(mb, o, depth, mat):
    """The four inner faces of an opening, from the wall face to depth."""
    x0, x1, z0, z1 = o.hole()
    mb.quad(mat, (x0, depth, z0), (x0, depth, z1), (x0, 0, z1), (x0, 0, z0))          # left jamb faces +x
    mb.quad(mat, (x1, 0, z1), (x1, depth, z1), (x1, depth, z0), (x1, 0, z0))          # right jamb faces -x
    mb.quad(mat, (x0, depth, z1), (x1, depth, z1), (x1, 0, z1), (x0, 0, z1))          # head faces -z
    mb.quad(mat, (x1, 0, z0), (x1, depth, z0), (x0, depth, z0), (x0, 0, z0))          # bottom faces +z


def stone_frame(mb, o, fw, proud=0.05, cap=False, sill=True, keystone=False, mat='lioz'):
    x0, x1, z0, z1 = o.hole()
    # jambs
    mb.box(mat, (x0 - fw, -proud, z0 - (0.0 if sill else 0.0)), (x0, 0.02, z1))
    mb.box(mat, (x1, -proud, z0), (x1 + fw, 0.02, z1))
    # lintel
    lh = fw * 1.25
    mb.box(mat, (x0 - fw, -proud - 0.01, z1), (x1 + fw, 0.02, z1 + lh))
    if keystone:
        cx = (x0 + x1) / 2
        mb.box(mat, (cx - 0.11, -proud - 0.04, z1 - 0.06), (cx + 0.11, 0.02, z1 + lh + 0.05))
    if cap:
        # small cornice over the lintel: two stepped slabs
        mb.box(mat, (x0 - fw - 0.06, -proud - 0.07, z1 + lh), (x1 + fw + 0.06, 0.02, z1 + lh + 0.06))
        mb.box(mat, (x0 - fw - 0.10, -proud - 0.12, z1 + lh + 0.06), (x1 + fw + 0.10, 0.02, z1 + lh + 0.12))
    if sill:
        mb.box(mat, (x0 - fw - 0.06, -0.13, z0 - 0.08), (x1 + fw + 0.06, 0.02, z0))
        # two small corbels under the sill
        for cx in (x0 + 0.06, x1 - 0.06):
            mb.box(mat, (cx - 0.05, -0.09, z0 - 0.2), (cx + 0.05, 0.0, z0 - 0.08))


def sash_window(mb, o, depth, panes, wood='wood_white', glass='glass', open_frac=0.0):
    """Sash ('guilhotina') window set back in the reveal: frame, two sashes with glazing bars, glass."""
    x0, x1, z0, z1 = o.hole()
    y = depth
    t = 0.07
    mb.box(wood, (x0, y - 0.06, z0), (x1, y, z0 + t))
    mb.box(wood, (x0, y - 0.06, z1 - t), (x1, y, z1))
    mb.box(wood, (x0, y - 0.06, z0), (x0 + t, y, z1))
    mb.box(wood, (x1 - t, y - 0.06, z0), (x1, y, z1))
    zm = (z0 + z1) / 2 + open_frac * (z1 - z0) * 0.3
    mb.box(wood, (x0, y - 0.09, zm - 0.035), (x1, y - 0.03, zm + 0.035))   # meeting rail
    cols, rows = panes
    for c in range(1, cols):
        xx = x0 + t + (x1 - x0 - 2 * t) * c / cols
        mb.box(wood, (xx - 0.017, y - 0.075, z0 + t), (xx + 0.017, y - 0.03, z1 - t), bevel=False)
    for half, (za, zb) in enumerate(((z0 + t, zm - 0.035), (zm + 0.035, z1 - t))):
        for r in range(1, rows):
            zz = za + (zb - za) * r / rows
            mb.box(wood, (x0 + t, y - 0.075, zz - 0.017), (x1 - t, y - 0.03, zz + 0.017), bevel=False)
    # glass: one quad, UV 0..1 over the opening (painted reflection)
    mb.quad(glass, (x0, y - 0.04, z0), (x1, y - 0.04, z0), (x1, y - 0.04, z1), (x0, y - 0.04, z1),
            uvs=((0, 0), (1, 0), (1, 1), (0, 1)))


def louvred_leaf(mb, w, h, mat, slats=True):
    """One shutter leaf in its own frame: x 0..w, z 0..h, front at y=0 (facing -y)."""
    st = 0.06
    mb.box(mat, (0, 0, 0), (st, 0.04, h))
    mb.box(mat, (w - st, 0, 0), (w, 0.04, h))
    mb.box(mat, (st, 0, 0), (w - st, 0.04, st * 1.4))
    mb.box(mat, (st, 0, h - st), (w - st, 0.04, h))
    mb.box(mat, (st, 0.005, h * 0.45), (w - st, 0.035, h * 0.45 + st))
    if slats:
        n = int((h - 2 * st) / 0.095)
        for k in range(n):
            z = st * 1.4 + k * (h - 2.4 * st) / n
            # tilted slat: a thin prism (ends hidden in the stiles, so no caps)
            mb.prism(mat, [(0.004, z), (0.034, z + 0.014), (0.034, z + 0.064), (0.004, z + 0.05)], st, w - st,
                     bevel=False, caps=False)
    else:
        mb.box(mat, (st, 0.01, st), (w - st, 0.03, h - st), bevel=False)


def shutters(mb, o, state, mat, depth, slats=True, rnd=None):
    """Exterior louvred shutters: 'open' (folded back against the wall, a little ajar), 'closed', 'half'."""
    x0, x1, z0, z1 = o.hole()
    w = (x1 - x0) / 2
    h = z1 - z0
    if state == 'closed':
        for k, xa in enumerate((x0, x0 + w)):
            with mb.at(tr(xa, depth - 0.16, z0)):
                louvred_leaf(mb, w - 0.005, h, mat, slats)
    elif state in ('open', 'half'):
        fw = o.frame
        ang_l = 172 if state == 'open' else 120
        ang_r = 172 if state == 'open' else 95
        if rnd:
            ang_l += rnd.uniform(-6, 4)
            ang_r += rnd.uniform(-6, 4)
        # hinged at the outer edge of the opening, swung out toward the wall
        with mb.at(tr(x0 - 0.01, -0.06, z0) @ rot_z(-ang_l)):
            louvred_leaf(mb, w, h, mat, slats)
        with mb.at(tr(x1 + 0.01, -0.06, z0) @ rot_z(ang_r - 180)):
            louvred_leaf(mb, w, h, mat, slats)
        # iron hinge pins
        for xx in (x0 - 0.01, x1 + 0.01):
            for zz in (z0 + 0.2, z1 - 0.2):
                mb.box('iron', (xx - 0.02, -0.08, zz - 0.02), (xx + 0.02, 0.0, zz + 0.02), bevel=False)


def scroll(mb, cx, cz, r0, turns, flip, y, mat='iron', rad=0.007, plane='xz'):
    pts = []
    n = int(10 * turns)
    for k in range(n + 1):
        t = k / n * turns * 2 * math.pi
        r = r0 * (1 - 0.75 * k / n)
        x = cx + flip * r * math.cos(t)
        z = cz + r * math.sin(t)
        pts.append((x, y, z))
    mb.tube(mat, pts, rad, seg=3)


def railing(mb, x0, x1, z0, h, y, motif=True, mat='iron', posts=True):
    """Wrought-iron railing along x at depth y: rails, square bars, a band of C-scrolls."""
    mb.box(mat, (x0, y - 0.025, z0 + h - 0.035), (x1, y + 0.025, z0 + h), bevel=False)      # handrail
    mb.box(mat, (x0, y - 0.012, z0 + 0.08), (x1, y + 0.012, z0 + 0.11), bevel=False)        # bottom rail
    mb.box(mat, (x0, y - 0.01, z0 + h - 0.24), (x1, y + 0.01, z0 + h - 0.22), bevel=False)  # scroll band rail
    n = max(2, int((x1 - x0) / 0.115))
    for k in range(n + 1):
        x = x0 + (x1 - x0) * k / n
        mb.box(mat, (x - 0.008, y - 0.008, z0 + 0.08), (x + 0.008, y + 0.008, z0 + h - 0.24), bevel=False)
    if motif:
        m = max(1, int((x1 - x0) / 0.24))
        for k in range(m):
            cx = x0 + (x1 - x0) * (k + 0.5) / m
            scroll(mb, cx - 0.045, z0 + h - 0.13, 0.05, 1.1, -1, y, mat)
            scroll(mb, cx + 0.045, z0 + h - 0.13, 0.05, 1.1, 1, y, mat)
    if posts:
        for x in (x0, x1):
            mb.box(mat, (x - 0.018, y - 0.018, z0), (x + 0.018, y + 0.018, z0 + h + 0.02), bevel=False)
            mb.sphere(mat, (x, y, z0 + h + 0.045), 0.03, seg=6, rings=4)


def balcony(mb, o, floor_z, depth=0.62, overhang=0.32, mat_slab='lioz', detail=2):
    x0, x1 = o.x0 - overhang, o.x1 + overhang
    zt = floor_z + 0.02
    mb.box(mat_slab, (x0, -depth, zt - 0.13), (x1, 0.0, zt))
    # moulded edge under the slab
    mb.prism(mat_slab, [(-depth + 0.02, zt - 0.13), (-depth + 0.09, zt - 0.2), (-depth + 0.14, zt - 0.2),
                        (-depth + 0.14, zt - 0.13)], x0 + 0.03, x1 - 0.03)
    # wrought-iron brackets
    for bx in (x0 + 0.18, x1 - 0.18):
        pts = [(bx, -(depth - 0.12) * (1 - math.cos(a)) - 0.0, zt - 0.2 - 0.42 * (1 - math.sin(a)))
               for a in [i * (math.pi / 2) / 8 for i in range(9)]]
        mb.tube('iron', pts, 0.014, seg=5)
        mb.box('iron', (bx - 0.015, 0.0, zt - 0.66), (bx + 0.015, 0.02, zt - 0.2), bevel=False)
    # railing: front and two returns
    yf = -depth + 0.05
    railing(mb, x0 + 0.05, x1 - 0.05, zt, 1.0, yf, motif=detail >= 2)
    for xx in (x0 + 0.05, x1 - 0.05):
        n = max(2, int((depth - 0.05) / 0.115))
        mb.box('iron', (xx - 0.012, yf, zt + 1.0 - 0.035), (xx + 0.012, -0.02, zt + 1.0), bevel=False)
        mb.box('iron', (xx - 0.01, yf, zt + 0.08), (xx + 0.01, -0.02, zt + 0.11), bevel=False)
        for k in range(1, n):
            y = yf + (-0.02 - yf) * k / n
            mb.box('iron', (xx - 0.008, y - 0.008, zt + 0.08), (xx + 0.008, y + 0.008, zt + 0.98), bevel=False)


def juliet(mb, o, floor_z):
    """'Sacada' without a slab: a shallow iron railing across the lower part of a French window."""
    yf = -0.12
    railing(mb, o.x0 - 0.04, o.x1 + 0.04, floor_z + 0.05, 0.95, yf, motif=True)
    mb.box('lioz', (o.x0 - 0.12, -0.16, floor_z - 0.06), (o.x1 + 0.12, 0.02, floor_z + 0.05))


def door(mb, o, depth, mat, fanlight=True, steps=0, step_h=0.17):
    x0, x1, z0, z1 = o.hole()
    w = x1 - x0
    zf = z1 - (0.6 if fanlight else 0.0)
    y = depth - 0.05
    # two leaves with raised panels
    for k, (a, b) in enumerate(((x0, x0 + w / 2), (x0 + w / 2, x1))):
        mb.box(mat, (a + 0.005, y - 0.05, z0), (b - 0.005, y, zf))
        for (pa, pb) in ((z0 + 0.15, z0 + (zf - z0) * 0.45), (z0 + (zf - z0) * 0.5, zf - 0.15)):
            mb.box(mat, (a + 0.11, y - 0.08, pa), (b - 0.11, y - 0.05, pb))
        mb.sphere('brass', ((a + b) / 2 + (0.18 if k == 0 else -0.18), y - 0.1, z0 + 1.05), 0.03, seg=6, rings=4)
    if fanlight:
        mb.box(mat, (x0, y - 0.06, zf), (x1, y, zf + 0.07))
        mb.quad('glass', (x0, y - 0.01, zf + 0.07), (x1, y - 0.01, zf + 0.07), (x1, y - 0.01, z1), (x0, y - 0.01, z1),
                uvs=((0, 0.6), (1, 0.6), (1, 1), (0, 1)))
        # radial iron grille
        cx = (x0 + x1) / 2
        for k in range(7):
            a = math.pi * (k + 0.5) / 7
            r = min(w / 2, z1 - zf) - 0.02
            mb.tube('iron', [(cx, y - 0.04, zf + 0.08), (cx + math.cos(a) * r, y - 0.04, zf + 0.08 + math.sin(a) * r * 0.9)], 0.008, seg=4)
        mb.cyl('iron', (cx - 0.12, y - 0.04, zf + 0.08), (cx + 0.12, y - 0.04, zf + 0.08), 0.01, seg=4)
    # threshold + steps down to the pavement
    mb.box('lioz', (x0 - 0.1, -0.06, z0 - 0.06), (x1 + 0.1, depth, z0))
    for s in range(steps):
        zt = z0 - (s + 1) * step_h + step_h * 0.0
        mb.box('lioz', (x0 - 0.12, -0.32 * (s + 1) - 0.06, zt - step_h * 0.4), (x1 + 0.12, -0.06 - 0.32 * s, zt + 0.0 + 0.0))


def shopfront(mb, o, depth, wood, sign_cell=None, awning=None, fabric_cell=None, rnd=None):
    """Timber shopfront: stall riser panels, big glazing on mullions, a door, transom, painted sign board."""
    x0, x1, z0, z1 = o.hole()
    w = x1 - x0
    y = depth - 0.06
    zr = z0 + 0.55
    zt = z1 - 0.55
    # outer timber frame
    mb.box(wood, (x0, y - 0.1, z0), (x0 + 0.1, y, z1))
    mb.box(wood, (x1 - 0.1, y - 0.1, z0), (x1, y, z1))
    mb.box(wood, (x0, y - 0.12, zt - 0.06), (x1, y, zt + 0.06))
    mb.box(wood, (x0, y - 0.1, z1 - 0.1), (x1, y, z1))
    # door on the right third
    dx0 = x1 - 0.1 - 0.9
    mb.box(wood, (dx0 - 0.08, y - 0.1, z0), (dx0, y, zt))
    mb.box(wood, (dx0, y - 0.06, z0), (x1 - 0.1, y, z0 + 0.35))
    mb.quad('glass', (dx0, y - 0.03, z0 + 0.35), (x1 - 0.1, y - 0.03, z0 + 0.35), (x1 - 0.1, y - 0.03, zt - 0.06),
            (dx0, y - 0.03, zt - 0.06), uvs=((0, 0), (1, 0), (1, 1), (0, 1)))
    # stall riser panels under the display window
    mb.box(wood, (x0 + 0.1, y - 0.08, z0), (dx0 - 0.08, y, zr))
    mb.box(wood, (x0 + 0.1, y - 0.12, zr - 0.05), (dx0 - 0.08, y, zr + 0.03))
    npan = max(1, int((dx0 - x0) / 0.6))
    for k in range(npan):
        a = x0 + 0.1 + (dx0 - 0.08 - x0 - 0.1) * k / npan
        b = x0 + 0.1 + (dx0 - 0.08 - x0 - 0.1) * (k + 1) / npan
        mb.box(wood, (a + 0.07, y - 0.11, z0 + 0.1), (b - 0.07, y - 0.08, zr - 0.12))
    # display glazing with mullions
    nm = max(1, int((dx0 - x0) / 0.75))
    for k in range(1, nm):
        xx = x0 + 0.1 + (dx0 - 0.08 - x0 - 0.1) * k / nm
        mb.box(wood, (xx - 0.03, y - 0.08, zr), (xx + 0.03, y, zt))
    mb.quad('glass', (x0 + 0.1, y - 0.03, zr + 0.03), (dx0 - 0.08, y - 0.03, zr + 0.03), (dx0 - 0.08, y - 0.03, zt - 0.06),
            (x0 + 0.1, y - 0.03, zt - 0.06), uvs=((0, 0), (1, 0), (1, 1), (0, 1)))
    # transom glazing
    mb.quad('glass', (x0 + 0.1, y - 0.03, zt + 0.06), (x1 - 0.1, y - 0.03, zt + 0.06), (x1 - 0.1, y - 0.03, z1 - 0.1),
            (x0 + 0.1, y - 0.03, z1 - 0.1), uvs=((0, 0.7), (1, 0.7), (1, 1), (0, 1)))
    # interior hint: a shelf of goods behind the display (dark box with warm cells)
    mb.box('wood_brown', (x0 + 0.2, y + 0.3, zr), (dx0 - 0.2, y + 0.5, zr + 0.06))
    # fascia sign board above the opening
    if sign_cell is not None:
        sw = min(1.6, w * 0.7)
        cx = (x0 + x1) / 2
        u0, v0 = (sign_cell % 2) * 0.5, (sign_cell // 2) * 0.5
        mb.box(wood, (cx - sw / 2 - 0.05, -0.08, z1 + 0.12), (cx + sw / 2 + 0.05, 0.0, z1 + 0.62))
        hh = 0.45
        # square icon panel in the middle with plain painted wings
        mb.quad('signs', (cx - hh / 2, -0.085, z1 + 0.145), (cx + hh / 2, -0.085, z1 + 0.145), (cx + hh / 2, -0.085, z1 + 0.595),
                (cx - hh / 2, -0.085, z1 + 0.595), uvs=((u0, v0), (u0 + 0.5, v0), (u0 + 0.5, v0 + 0.5), (u0, v0 + 0.5)))
    if awning:
        awning_fn(mb, x0 - 0.1, x1 + 0.1, z1 + 0.05, fabric_cell if fabric_cell is not None else 0)


def awning_fn(mb, x0, x1, z, cell, proj=1.1, drop=0.55):
    """Fabric awning on an iron frame, with a scalloped valance."""
    u0, v0 = (cell % 4) * 0.25, 1 - ((cell // 4) + 1) * 0.25
    nu = 10
    nv = 4

    def P(i, j):
        x = x0 + (x1 - x0) * i / nu
        t = j / nv
        sag = 0.04 * math.sin(math.pi * i / nu) * math.sin(math.pi * t)
        return (x, -proj * t, z - drop * t - sag)

    mb.grid('fabric', nu, nv, P, uvfn=lambda i, j: (u0 + 0.25 * i / nu, v0 + 0.25 * j / nv), smooth=True)
    # underside (double-sided look)
    mb.grid('fabric', nu, nv, lambda i, j: (lambda p: (p[0], p[1], p[2] - 0.01))(P(nu - i, j)),
            uvfn=lambda i, j: (u0 + 0.25 * (nu - i) / nu, v0 + 0.25 * j / nv), smooth=True)
    # scalloped valance
    ns = max(4, int((x1 - x0) / 0.25))
    for k in range(ns):
        a = x0 + (x1 - x0) * k / ns
        b = x0 + (x1 - x0) * (k + 1) / ns
        m = (a + b) / 2
        yv = -proj
        zv = z - drop
        mb.poly('fabric', [(a, yv - 0.005, zv - 0.14), (m, yv - 0.005, zv - 0.22), (b, yv - 0.005, zv - 0.14), (b, yv - 0.005, zv), (a, yv - 0.005, zv)],
                uvs=[(u0, v0 + 0.05), (u0 + 0.03, v0 + 0.07), (u0 + 0.06, v0 + 0.05), (u0 + 0.06, v0), (u0, v0)])
    for xx in (x0, x1):
        mb.tube('iron', [(xx, 0, z - 0.6), (xx, -proj, z - drop)], 0.012, seg=4)


def cornice_profile(kind):
    """(y, z) profiles, y negative = out from the wall, counter-clockwise seen from +x."""
    if kind == 'pombaline':
        return [(0.02, 0.0), (0.02, 0.62), (-0.42, 0.62), (-0.42, 0.52), (-0.32, 0.47), (-0.28, 0.36),
                (-0.18, 0.30), (-0.14, 0.18), (-0.06, 0.12), (-0.06, 0.0)]
    if kind == 'bica':
        return [(0.02, 0.0), (0.02, 0.34), (-0.24, 0.34), (-0.24, 0.27), (-0.15, 0.22), (-0.10, 0.12),
                (-0.05, 0.08), (-0.05, 0.0)]
    if kind == 'band':
        return [(0.02, 0.0), (0.02, 0.2), (-0.06, 0.2), (-0.07, 0.15), (-0.05, 0.05), (-0.05, 0.0)]
    raise KeyError(kind)


def cornice(mb, x0, x1, z, kind, mat='lioz'):
    prof = [(y, z + zz) for (y, zz) in cornice_profile(kind)]
    mb.prism(mat, prof, x0, x1)


def azulejo_cladding(mb, x0, x1, z0, z1, holes, mat, rnd, tile=0.14, gap=0.004, detail=2):
    """Tile geometry: one slightly proud, slightly uneven quad per glazed tile, skipping openings."""
    if detail < 2:
        mb.quad(mat, (x0, -0.01, z0), (x1, -0.01, z0), (x1, -0.01, z1), (x0, -0.01, z1),
                uvs=((x0 / 0.56, z0 / 0.56), (x1 / 0.56, z0 / 0.56), (x1 / 0.56, z1 / 0.56), (x0 / 0.56, z1 / 0.56)))
        return
    nx = int((x1 - x0) / tile)
    nz = int((z1 - z0) / tile)
    ox = x0 + ((x1 - x0) - nx * tile) / 2
    oz = z0 + ((z1 - z0) - nz * tile) / 2
    for j in range(nz):
        for i in range(nx):
            a = ox + i * tile + gap / 2
            b = a + tile - gap
            c = oz + j * tile + gap / 2
            d = c + tile - gap
            if any(hx0 < b and a < hx1 and hz0 < d and c < hz1 for (hx0, hx1, hz0, hz1) in holes):
                continue
            ys = [-0.012 - rnd.uniform(0, 0.004) for _ in range(4)]
            u0, v0 = (i % 4) * 0.25, (j % 4) * 0.25
            e = 0.25 * 0.02
            mb.quad(mat, (a, ys[0], c), (b, ys[1], c), (b, ys[2], d), (a, ys[3], d),
                    uvs=((u0 + e, v0 + e), (u0 + 0.25 - e, v0 + e), (u0 + 0.25 - e, v0 + 0.25 - e), (u0 + e, v0 + 0.25 - e)))


def tile_panel(mb, cx, z0, w, h, mat, rnd, border='lioz'):
    """A framed azulejo panel on plain plaster (a devotional/house panel without imagery or lettering)."""
    holes = []
    azulejo_cladding(mb, cx - w / 2, cx + w / 2, z0, z0 + h, holes, mat, rnd)
    mb.box(border, (cx - w / 2 - 0.08, -0.04, z0 - 0.08), (cx + w / 2 + 0.08, 0.0, z0))
    mb.box(border, (cx - w / 2 - 0.08, -0.04, z0 + h), (cx + w / 2 + 0.08, 0.0, z0 + h + 0.1))
    mb.box(border, (cx - w / 2 - 0.08, -0.04, z0), (cx - w / 2, 0.0, z0 + h))
    mb.box(border, (cx + w / 2, -0.04, z0), (cx + w / 2 + 0.08, 0.0, z0 + h))
