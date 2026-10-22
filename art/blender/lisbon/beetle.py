"""The hero car: a small, charming old car clearly inspired by the classic Beetle, in the STYLE-C look.
It carries no real-world badges or logos.

- Shell: one continuous rounded arch in side profile. A short rounded bonnet runs down to the front valance; the small,
  fairly upright windscreen leads into a domed roof that flows down the long engine lid to the tail. Strong tumblehome.
- Fenders: four separate bulbous fenders stand proud of the body. The front ones hold the round headlamps; the rear
  ones carry upright oval tail lamps. Running boards sit between them.
- Glass: a curved-top door window and a small quarter window each side, a small oval rear window and the windscreen,
  all with thin chrome trim, in translucent glass with the interior visible (left-hand drive).
- Details: chrome blade bumpers with overriders, cream steel wheels with chrome hubcaps and whitewall tyres, round
  door mirrors, chrome handles, horn grilles, engine-lid louvres, a plain chrome strip on the bonnet and blank
  EU-style plates.
- Branding: subtle only, a small pastry roundel on each door.

Local frame (Blender): origin on the ground midway between the axles, nose toward +Y (exported glTF: facing -Z).
"""
import math

import bpy
from mathutils import Vector

from .geo import MeshBuilder, apply_modifiers, tr, rot_x

WHEEL_R = 0.31
WHEELBASE = 2.40
AXLE_Y = WHEELBASE / 2
TRACK_F, TRACK_R = 1.31, 1.35
NOSE_Y, TAIL_Y = 2.01, -2.06          # body ends; bumpers reach ~ +2.13 / -2.18
PAINT = 'car_paint_mint'
N_SECTION = 36

# shell sections: (y, half width, bottom z, z of the widest line, top z, top exponent, bottom exponent)
SHELL = [
    (-2.060, 0.22, 0.52, 0.60, 0.64, 2.2, 2.2),
    (-2.030, 0.48, 0.44, 0.62, 0.74, 2.3, 2.6),
    (-1.950, 0.59, 0.39, 0.64, 0.86, 2.4, 3.0),
    (-1.800, 0.65, 0.37, 0.66, 0.96, 2.6, 3.6),
    (-1.550, 0.68, 0.36, 0.68, 1.02, 2.8, 4.0),
    (-1.250, 0.70, 0.36, 0.70, 1.035, 3.0, 4.0),
    (-0.800, 0.71, 0.36, 0.71, 1.02, 3.2, 4.0),
    (-0.300, 0.71, 0.36, 0.72, 1.005, 3.2, 4.0),
    (0.200, 0.71, 0.36, 0.72, 1.005, 3.2, 4.0),
    (0.600, 0.705, 0.36, 0.72, 1.03, 3.0, 4.0),
    (0.880, 0.69, 0.36, 0.72, 1.10, 2.8, 4.0),
    (1.100, 0.67, 0.37, 0.72, 1.095, 2.8, 3.8),
    (1.350, 0.645, 0.39, 0.72, 1.05, 2.7, 3.4),
    (1.600, 0.61, 0.42, 0.71, 0.985, 2.6, 3.0),
    (1.800, 0.55, 0.45, 0.69, 0.90, 2.5, 2.8),
    (1.930, 0.45, 0.48, 0.67, 0.80, 2.4, 2.5),
    (1.990, 0.30, 0.52, 0.65, 0.72, 2.2, 2.3),
    (2.010, 0.12, 0.55, 0.63, 0.67, 2.0, 2.0),
]

# fender sections: (y, inner x, outer x, bottom z, top z, exponent)
FRONT_FENDER = [
    (1.950, 0.40, 0.52, 0.52, 0.70, 2.2),
    (1.890, 0.40, 0.67, 0.45, 0.83, 2.5),
    (1.750, 0.40, 0.76, 0.40, 0.92, 2.8),
    (1.480, 0.40, 0.80, 0.36, 0.96, 3.0),
    (1.200, 0.40, 0.805, 0.35, 0.965, 3.0),
    (0.950, 0.40, 0.795, 0.35, 0.89, 3.0),
    (0.780, 0.40, 0.76, 0.35, 0.70, 2.8),
    (0.680, 0.40, 0.74, 0.35, 0.53, 2.6),
    (0.620, 0.40, 0.72, 0.35, 0.41, 2.4),
]
REAR_FENDER = [
    (-0.620, 0.40, 0.72, 0.35, 0.43, 2.4),
    (-0.700, 0.40, 0.745, 0.35, 0.57, 2.6),
    (-0.900, 0.40, 0.775, 0.35, 0.80, 2.9),
    (-1.200, 0.40, 0.785, 0.35, 0.92, 3.0),
    (-1.500, 0.40, 0.78, 0.36, 0.91, 3.0),
    (-1.750, 0.40, 0.755, 0.39, 0.87, 2.8),
    (-1.920, 0.40, 0.69, 0.45, 0.81, 2.6),
    (-2.020, 0.40, 0.57, 0.52, 0.74, 2.4),
    (-2.060, 0.40, 0.47, 0.57, 0.68, 2.2),
]


def _sgnpow(v, p):
    return math.copysign(abs(v) ** p, v)


def _interp(table, y, keys):
    rows = sorted(table)
    if not (rows[0][0] <= y <= rows[-1][0]):
        return None
    for a, b in zip(rows[:-1], rows[1:]):
        if a[0] <= y <= b[0]:
            t = (y - a[0]) / (b[0] - a[0]) if b[0] > a[0] else 0.0
            return [a[k] + (b[k] - a[k]) * t for k in keys]
    return None


# ---------------------------------------------------------------- shell
def shell_section(y, hw, zb, zm, zt, et, eb, n=N_SECTION):
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n - math.pi / 2
        c, s = math.cos(t), math.sin(t)
        if s >= 0:
            p = 2.0 / et
            pts.append((hw * _sgnpow(c, p), y, zm + (zt - zm) * _sgnpow(s, p)))
        else:
            p = 2.0 / eb
            pts.append((hw * _sgnpow(c, p), y, zm + (zm - zb) * _sgnpow(s, p)))
    return pts


def shell_half_width(y, z):
    r = _interp(SHELL, y, (1, 2, 3, 4, 5, 6))
    if r is None:
        return 0.0
    hw, zb, zm, zt, et, eb = r
    if z >= zm:
        s, e = (z - zm) / max(zt - zm, 1e-4), et
    else:
        s, e = (zm - z) / max(zm - zb, 1e-4), eb
    if s >= 1.0:
        return 0.0
    return hw * (1 - s ** e) ** (1.0 / e)


def shell_top(y):
    r = _interp(SHELL, y, (4,))
    return r[0] if r else 0.0


def shell_surface_y(x, z, front=True):
    """Front- or rear-most shell surface point at (x, z) by bisection along y; None if the shell never reaches it."""
    lo = 0.0
    hi = NOSE_Y if front else TAIL_Y
    if shell_half_width(lo, z) < max(abs(x), 1e-3):
        found = False
        for k in range(1, 40):
            yy = lo + (hi - lo) * k / 40
            if shell_half_width(yy, z) >= max(abs(x), 1e-3):
                lo, found = yy, True
                break
        if not found:
            return None
    for _ in range(30):
        mid = (lo + hi) / 2
        if shell_half_width(mid, z) >= max(abs(x), 1e-3):
            lo = mid
        else:
            hi = mid
    return lo


# ---------------------------------------------------------------- fenders
def fender_section(y, xi, xo, zb, zt, e, side, n=24):
    xc, hwx = (xi + xo) / 2, (xo - xi) / 2
    zc, hz = (zb + zt) / 2, (zt - zb) / 2
    p = 2.0 / e
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n - math.pi / 2
        pts.append((side * (xc + hwx * _sgnpow(math.cos(t), p)), y, zc + hz * _sgnpow(math.sin(t), p)))
    return pts


def fender_outer(table, y, z):
    """Outer half width of a fender at (y, z), 0 if outside."""
    r = _interp(table, y, (1, 2, 3, 4, 5))
    if r is None:
        return 0.0
    xi, xo, zb, zt, e = r
    xc, hwx = (xi + xo) / 2, (xo - xi) / 2
    zc, hz = (zb + zt) / 2, (zt - zb) / 2
    s = abs(z - zc) / hz
    if s >= 1:
        return 0.0
    return xc + hwx * (1 - s ** e) ** (1.0 / e)


def fender_surface_y(table, x, z, front=True):
    ys = sorted(r[0] for r in table)
    mid_y = (ys[0] + ys[-1]) / 2
    lo, hi = (mid_y, ys[-1]) if front else (mid_y, ys[0])
    if fender_outer(table, lo, z) < max(abs(x), 1e-3):
        return None
    for _ in range(30):
        mid = (lo + hi) / 2
        if fender_outer(table, mid, z) >= max(abs(x), 1e-3):
            lo = mid
        else:
            hi = mid
    return lo


# ---------------------------------------------------------------- generic helpers
def loft(mb, sections, mat, close=True, smooth=True, flip=False):
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
            mb.faces.append((q[::-1] if flip else q, mat, None, False, smooth))
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
                mb.faces.append((f, mat, None, False, smooth))


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


def lathe_y(mb, mat, prof, c, direction=1, seg=24, smooth=True):
    """Revolve [(r, a)] around the y axis through c; a is the offset along direction (+1 forward, -1 back)."""
    cx, cy, cz = c
    base = len(mb.verts)
    n = len(prof)
    m = mb.m
    for s in range(seg):
        t = 2 * math.pi * s / seg
        for (r, a) in prof:
            mb.verts.append(m @ Vector((cx + r * math.cos(t), cy + a * direction, cz + r * math.sin(t))))
    for s in range(seg):
        s2 = (s + 1) % seg
        for k in range(n - 1):
            q = (base + s * n + k, base + s2 * n + k, base + s2 * n + k + 1, base + s * n + k + 1)
            if direction > 0:
                q = q[::-1]
            mb.faces.append((q, mat, None, False, smooth))


def radial_patch(mb, mat, outline, project, rings=4, uv=None):
    """Fill a closed 2D outline with concentric rings toward its centre, each point projected onto the body by
    project(u, v) -> 3D point or None. Quads with a missing corner are skipped. The outline's order sets the winding."""
    n = len(outline)
    cu = sum(p[0] for p in outline) / n
    cv = sum(p[1] for p in outline) / n
    grid = {}
    for r in range(rings):
        t = 1.0 - r / rings
        for i in range(n):
            u = cu + (outline[i][0] - cu) * t
            v = cv + (outline[i][1] - cv) * t
            grid[r, i] = project(u, v)
    centre = project(cu, cv)
    for r in range(rings):
        for i in range(n):
            j = (i + 1) % n
            if r < rings - 1:
                corners = [grid[r, i], grid[r, j], grid[r + 1, j], grid[r + 1, i]]
            else:
                corners = [grid[r, i], grid[r, j], centre]
            if any(c is None for c in corners):
                continue
            mb.poly(mat, corners, smooth=True)


def side_projector(s, lift):
    def proj(y, z):
        hw = shell_half_width(y, z)
        if hw < 0.05:
            return None
        return (s * (hw + lift), y, z)
    return proj


def front_projector(lift):
    def proj(x, z):
        y = shell_surface_y(x, z, True)
        return None if y is None else (x, y + lift, z)
    return proj


def rear_projector(lift):
    def proj(x, z):
        y = shell_surface_y(x, z, False)
        return None if y is None else (x, y - lift, z)
    return proj


def rounded_outline(pts):
    """Smooth a closed polygon of (u, v) control points (three Chaikin passes)."""
    out = list(pts)
    for _ in range(3):
        new = []
        for i in range(len(out)):
            a, b = out[i], out[(i + 1) % len(out)]
            new.append((0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]))
            new.append((0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]))
        out = new
    return out


def trim_loop(mb, mat, outline, proj, r):
    pts = [proj(u, v) for (u, v) in outline]
    pts = [p for p in pts if p]
    if len(pts) > 3:
        mb.sweep(mat, pts + pts[:1], r, seg=5, caps=False)


# ---------------------------------------------------------------- glass
def ccw(outline):
    """Counter-clockwise version of a closed (u, v) outline."""
    n = len(outline)
    a = sum(outline[i][0] * outline[(i + 1) % n][1] - outline[(i + 1) % n][0] * outline[i][1] for i in range(n))
    return outline if a > 0 else outline[::-1]


CABIN = (-1.06, 0.64, 0.585)   # open cabin: rear y, front y, half width (rolled door tops sit outside this)


def cabin_cutter(collection):
    """Rounded tub cut out of the shell above z = 0.50: the open cabin."""
    y0, y1, hw = CABIN
    yc, hy = (y0 + y1) / 2, (y1 - y0) / 2
    secs = []
    for z in (0.50, 2.0):
        sec = []
        for i in range(40):
            t = 2 * math.pi * i / 40
            sec.append((hw * _sgnpow(math.cos(t), 2 / 5.0), yc + hy * _sgnpow(math.sin(t), 2 / 5.0), z))
        secs.append(sec)
    mb = MeshBuilder()
    loft(mb, secs, 'car_interior', flip=True)
    return mb.build('cabin_cutter', collection, bevel_width=0.0, smooth_angle=30.0)


def cabin_trim(mb):
    """Thin chrome strip along the rolled top edge of the cockpit opening, and a rubber seal inside it."""
    y0, y1, hw = CABIN
    yc, hy = (y0 + y1) / 2, (y1 - y0) / 2
    pts = []
    for i in range(49):
        t = 2 * math.pi * i / 48
        x = (hw + 0.012) * _sgnpow(math.cos(t), 2 / 5.0)
        y = yc + (hy + 0.012) * _sgnpow(math.sin(t), 2 / 5.0)
        z = shell_top_at(x, y) + 0.004
        pts.append((x, y, z))
    mb.sweep('car_chrome', pts, 0.011, seg=5, caps=False)


def shell_top_at(x, y):
    """Height of the shell's upper surface above (x, y)."""
    r = _interp(SHELL, y, (1, 2, 3, 4, 5, 6))
    if r is None:
        return 0.0
    hw, zb, zm, zt, et, eb = r
    u = min(1.0, abs(x) / hw)
    return zm + (zt - zm) * (1 - u ** et) ** (1.0 / et)


def windscreen(mb):
    """Framed, fairly upright windscreen on the cowl: body-colour frame with side posts and a top rail, chrome
    inner bead, glass inside, wipers at the base and an interior mirror on the top rail."""
    base_y, base_z = 0.80, 1.075
    top_y, top_z = 0.62, 1.40
    hb, ht = 0.64, 0.60          # half widths at base and top
    wrap = 0.06                  # the glass curves back at the sides

    def P(u, v):                 # u in -1..1 across, v in 0..1 up
        hw = hb + (ht - hb) * v
        y = base_y + (top_y - base_y) * v - wrap * u * u
        z = base_z + (top_z - base_z) * v
        return (u * hw, y, z)

    nu, nv = 10, 4
    for j in range(nv):
        for i in range(nu):
            u0, u1 = -1 + 2 * i / nu, -1 + 2 * (i + 1) / nu
            v0, v1 = j / nv, (j + 1) / nv
            q = [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)]
            mb.poly('car_glass', q[::-1])          # facing forward (materials export double-sided)
    frame = [P(-1.0, 0.0), P(-1.0, 0.5), P(-1.0, 1.0)] + [P(u, 1.0) for u in [-0.8 + 0.2 * k for k in range(9)]] + \
        [P(1.0, 1.0), P(1.0, 0.5), P(1.0, 0.0)]
    mb.sweep(PAINT, frame, 0.024, seg=8)
    bead = [P(-0.97, 0.03), P(-0.97, 0.97)] + [P(u, 0.97) for u in [-0.8 + 0.2 * k for k in range(9)]] + [P(0.97, 0.97), P(0.97, 0.03)]
    mb.sweep('car_chrome', bead, 0.008, seg=5)
    # little hinge feet into the cowl
    for s in (-1, 1):
        x, y, z = P(s * 1.0, 0.0)
        mb.box('car_chrome', (x - 0.03, y - 0.04, z - 0.03), (x + 0.03, y + 0.04, z + 0.02), bevel=True)
    # wipers parked on the cowl, interior mirror on the top rail
    for x0 in (-0.5, 0.05):
        mb.sweep('car_trim', [(x0, 0.86, 1.09), (x0 + 0.4, 0.87, 1.09)], 0.007, seg=4)
        mb.sweep('car_chrome', [(x0 + 0.02, 0.88, 1.085), (x0 + 0.02, 0.92, 1.07)], 0.006, seg=4)
    tx, ty, tz = P(0.0, 1.0)
    mb.sweep('car_chrome', [(tx, ty - 0.02, tz - 0.02), (tx, ty - 0.06, tz - 0.08)], 0.006, seg=4)
    mb.box('car_trim', (tx - 0.1, ty - 0.08, tz - 0.13), (tx + 0.1, ty - 0.05, tz - 0.07), bevel=True)


def folded_hood(mb):
    """Classic cabrio hood folded on the rear deck behind the bench: a thick padded bundle of canvas folds,
    rounded, as wide as the cabin, with stitched fold lines and two straps."""
    yc, zc_base = -1.25, shell_top(-1.25)
    secs = []
    n = 24
    xs = [-0.66 + 1.32 * k / 12 for k in range(13)]
    for x in xs:
        t = abs(x) / 0.66
        shrink = (1 - t ** 6) ** 0.5
        hy, hz = 0.32 * (0.6 + 0.4 * shrink), 0.155 * (0.45 + 0.55 * shrink)
        zc = zc_base + hz - 0.03
        sec = []
        for i in range(n):
            a = 2 * math.pi * i / n
            y = yc + hy * _sgnpow(math.cos(a), 2 / 3.0) - 0.04 * math.sin(a)
            z = zc + hz * _sgnpow(math.sin(a), 2 / 3.0)
            sec.append((x, y, z))
        secs.append(sec)
    loft(mb, secs, 'car_hood', flip=True)
    # fold lines across the top, and two leather straps
    top = zc_base + 2 * 0.155 - 0.03
    for dy, dz in ((-0.16, -0.035), (-0.05, 0.0), (0.06, 0.0), (0.17, -0.035)):
        pts = [(x, yc + dy, top + dz - 0.12 * (abs(x) / 0.66) ** 6 + 0.006) for x in [-0.6 + 0.1 * k for k in range(13)]]
        mb.sweep('car_hood_dark', pts, 0.008, seg=4)
    for x in (-0.3, 0.3):
        ring = []
        for i in range(17):
            a = 2 * math.pi * i / 16
            ring.append((x, yc + 0.335 * math.cos(a), zc_base + 0.155 - 0.03 + 0.162 * math.sin(a)))
        mb.sweep('car_trim', ring, 0.012, seg=4, caps=False)


# ---------------------------------------------------------------- lamps, bumpers, details
def headlamps_and_front(mb):
    for s in (-1, 1):
        x, z = s * 0.58, 0.745
        y = (fender_surface_y(FRONT_FENDER, x, z, True) or 1.8) - 0.045
        # big round lamp: a bucket emerging from the fender front, a chrome ring (~0.21 m) and a domed lens
        with mb.at(tr(x, y, z) @ rot_x(3)):
            mb.cyl(PAINT, (0, -0.2, 0), (0, 0.025, 0), 0.118, seg=28)
            lathe_y(mb, 'car_chrome', [(0.118, 0.025), (0.106, 0.04), (0.104, 0.054), (0.092, 0.052)], (0, 0, 0), 1, seg=28)
            lathe_y(mb, 'car_lamp', [(0.094, 0.048), (0.075, 0.072), (0.04, 0.085), (0.0, 0.089)], (0, 0, 0), 1, seg=28)
        # bullet indicator on top of the fender
        yi, zi = 1.42, 0.97
        mb.sphere('car_chrome', (s * 0.60, yi, zi), 0.035, seg=10, rings=5, sz=(0.03, 0.06, 0.03))
        mb.sphere('car_amber', (s * 0.60, yi + 0.045, zi), 0.026, seg=10, rings=5, sz=(0.024, 0.03, 0.024))
        # small horn grille below the headlamp, on the front valance
        hx, hz = s * 0.30, 0.62
        hy = shell_surface_y(hx, hz, True)
        if hy:
            ring = []
            for k in range(17):
                a = 2 * math.pi * k / 16
                px, pz = hx + 0.06 * math.cos(a), hz + 0.035 * math.sin(a)
                ring.append((px, (shell_surface_y(px, pz, True) or hy) + 0.006, pz))
            mb.sweep('car_chrome', ring, 0.007, seg=4, caps=False)
            for k in range(3):
                zz = hz - 0.02 + k * 0.02
                pts = [(hx + dx, (shell_surface_y(hx + dx, zz, True) or hy) + 0.004, zz) for dx in (-0.045, 0.0, 0.045)]
                mb.sweep('car_trim', pts, 0.006, seg=4)
    # plain chrome strip down the centre of the bonnet, and the bonnet handle
    strip = [(0.0, y, shell_top(y) + 0.004) for y in [0.98 + 0.1 * k for k in range(9)]]
    mb.sweep('car_chrome', strip, 0.009, seg=5)
    yh = shell_surface_y(0.0, 0.80, True)
    if yh:
        mb.sweep('car_chrome', [(-0.07, yh + 0.012, 0.80), (0.0, yh + 0.02, 0.805), (0.07, yh + 0.012, 0.80)], 0.012, seg=6)
    hood = rounded_outline([(-0.42, 0.76), (0.42, 0.76), (0.47, 0.87), (0.45, 1.02), (-0.45, 1.02), (-0.47, 0.87)])
    trim_loop(mb, 'car_trim', hood, front_projector(0.003), 0.004)


def bumpers(mb):
    def blade(y_centre, y_end, z, half=0.80):
        pts = []
        for k in range(17):
            t = -1 + 2 * k / 16
            pts.append((half * t, y_end + (y_centre - y_end) * (1 - t * t) ** 0.5, z))
        return pts
    for (yc, ye, d) in ((2.10, 1.95, 1), (-2.15, -2.00, -1)):
        for dz in (0.0, 0.035):
            mb.sweep('car_chrome', blade(yc, ye, 0.50 + dz), 0.024, seg=8)
        for xo in (-0.36, 0.36):
            yb = ye + (yc - ye) * (1 - (xo / 0.8) ** 2) ** 0.5
            mb.sweep('car_chrome', [(xo, yb + 0.02 * d, 0.42), (xo, yb + 0.03 * d, 0.53), (xo, yb + 0.015 * d, 0.68)], 0.026, seg=8)
            ya, yb2 = sorted((yb - 0.14 * d, yb))
            mb.box('car_trim', (xo - 0.03, ya, 0.48), (xo + 0.03, yb2, 0.52), bevel=False)
    # front plate on the bumper, rear plate on the engine lid
    mb.quad('car_plate', (0.24, 2.128, 0.53), (-0.24, 2.128, 0.53), (-0.24, 2.128, 0.63), (0.24, 2.128, 0.63),
            uvs=((1, 0), (0, 0), (0, 1), (1, 1)))
    y = (shell_surface_y(0.0, 0.72, False) or -2.0) - 0.012
    mb.quad('car_plate', (-0.24, y, 0.67), (0.24, y, 0.67), (0.24, y, 0.765), (-0.24, y, 0.765),
            uvs=((0, 0), (1, 0), (1, 1), (0, 1)))
    mb.box('car_chrome', (-0.09, y - 0.03, 0.77), (0.09, y + 0.005, 0.80), bevel=True)          # plate lamp hood


def rear_details(mb):
    for s in (-1, 1):
        x, z = s * 0.58, 0.77
        y = fender_surface_y(REAR_FENDER, x, z, False) or -1.95
        ring = [(x + 0.05 * math.cos(2 * math.pi * k / 20), y - 0.006, z + 0.095 * math.sin(2 * math.pi * k / 20)) for k in range(21)]
        mb.sweep('car_chrome', ring, 0.009, seg=5, caps=False)
        mb.sphere('car_tail', (x, y - 0.004, z), 0.05, seg=14, rings=7, sz=(0.046, 0.03, 0.09))
    # engine-lid louvres, shut line and handle
    for s in (-1, 1):
        for k in range(4):
            xx = s * (0.12 + 0.06 * k)
            slot = ccw(rounded_outline([(xx - 0.016, 0.84), (xx + 0.016, 0.84), (xx + 0.016, 0.895), (xx - 0.016, 0.895)]))
            radial_patch(mb, 'car_trim', slot, rear_projector(0.003), rings=2)
    lid = rounded_outline([(-0.42, 0.66), (0.42, 0.66), (0.46, 0.80), (0.40, 0.925), (-0.40, 0.925), (-0.46, 0.80)])
    trim_loop(mb, 'car_trim', lid, rear_projector(0.003), 0.004)
    yh = (shell_surface_y(0.0, 0.81, False) or -2.0) - 0.014
    mb.sweep('car_chrome', [(-0.07, yh + 0.004, 0.81), (0.0, yh - 0.004, 0.815), (0.07, yh + 0.004, 0.81)], 0.012, seg=6)


def doors(mb):
    for s in (-1, 1):
        ctrl = [(0.70, 0.95), (0.75, 0.72), (0.71, 0.41), (-0.45, 0.41), (-0.46, 0.95)]
        pts = []
        for (a, b) in zip(ctrl[:-1], ctrl[1:]):
            for k in range(6):
                t = k / 6
                pts.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
        pts.append(ctrl[-1])
        proj = side_projector(s, 0.002)
        line = [proj(y, z) for (y, z) in pts]
        line = [p for p in line if p]
        mb.sweep('car_trim', line, 0.0045, seg=4)
        # chrome handle, round mirror on a stalk
        hy, hz = -0.32, 0.91
        hx = s * (shell_half_width(hy, hz) + 0.012)
        mb.sweep('car_chrome', [(hx, hy, hz), (hx, hy + 0.11, hz)], 0.012, seg=6)
        my, mz = 0.55, 1.0
        mx = s * (shell_half_width(my, 0.97) - 0.01)
        mb.sweep('car_chrome', [(mx, my, mz), (mx + s * 0.07, my - 0.01, mz + 0.06), (mx + s * 0.11, my - 0.02, mz + 0.1)], 0.009, seg=5)
        mc = (mx + s * 0.12, my - 0.03, mz + 0.13)
        lathe_y(mb, 'car_chrome', [(0.0, 0.03), (0.04, 0.035), (0.058, 0.02), (0.06, 0.0)], mc, 1, seg=16)
        lathe_y(mb, 'car_glass', [(0.06, 0.0), (0.04, -0.004), (0.0, -0.006)], mc, 1, seg=16)
        # the subtle branding: a small pastry roundel on the door
        badge(mb, s, 0.10, 0.74, 0.13)


def badge(mb, s, y, z, r, rings=3, seg=24):
    """Round decal laid onto the curved door (concentric rings projected onto the flank), so the body never shows
    through its middle."""
    def P(rr, t):
        yy, zz = y + rr * math.cos(t), z + rr * math.sin(t)
        return (s * (shell_half_width(yy, zz) + 0.005), yy, zz), (0.5 + 0.34 * (rr / r) * math.cos(t), 0.5 + 0.34 * (rr / r) * math.sin(t))
    for k in range(rings):
        r0, r1 = r * (k + 1) / rings, r * k / rings
        for i in range(seg):
            t0, t1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
            pts = [P(r0, t0), P(r0, t1), P(r1, t1), P(r1, t0)] if k else [P(r0, t0), P(r0, t1), P(0.0, 0.0)]
            if s < 0:
                pts = pts[::-1]
            mb.poly('car_box', [p for p, _ in pts], uvs=[uv for _, uv in pts])


def running_boards(mb):
    for s in (-1, 1):
        x0, x1 = sorted((s * 0.55, s * 0.745))
        mb.box(PAINT, (x0, -0.66, 0.34), (x1, 0.68, 0.365), bevel=True)
        mb.box('car_trim', (x0 + 0.01, -0.64, 0.365), (x1 - 0.01, 0.66, 0.385), bevel=False)
        xe = s * 0.745
        mb.sweep('car_chrome', [(xe, -0.64, 0.372), (xe, 0.66, 0.372)], 0.008, seg=4)


def wheel(mb, x, y):
    s = 1 if x > 0 else -1
    R, w = WHEEL_R, 0.15
    tyre = [(0.19, -w / 2), (0.25, -w / 2 - 0.004), (0.29, -w / 2 + 0.015), (R, -w / 2 + 0.04), (R, w / 2 - 0.04),
            (0.29, w / 2 - 0.015), (0.27, w / 2 - 0.004)]
    lathe_x(mb, 'car_tyre', tyre, (x, y, R), s, seg=24)
    lathe_x(mb, 'car_cream', [(0.262, w / 2 - 0.002), (0.245, w / 2 + 0.002), (0.226, w / 2 + 0.002)], (x, y, R), s, seg=28)   # whitewall band
    lathe_x(mb, 'car_tyre', [(0.226, w / 2 + 0.002), (0.21, w / 2 + 0.001), (0.20, w / 2)], (x, y, R), s, seg=28)
    lathe_x(mb, 'car_cream', [(0.20, w / 2), (0.19, w / 2 - 0.01), (0.15, w / 2 - 0.02), (0.12, w / 2 - 0.018)], (x, y, R), s, seg=28)
    lathe_x(mb, 'car_chrome', [(0.125, w / 2 - 0.02), (0.12, w / 2 + 0.0), (0.095, w / 2 + 0.03), (0.05, w / 2 + 0.045),
                               (0.0, w / 2 + 0.05)], (x, y, R), s, seg=24)
    lathe_x(mb, 'car_tyre', [(0.0, -w / 2), (0.19, -w / 2)], (x, y, R), -s, seg=20)


def interior(mb):
    """Open cabin: two front buckets and a rear bench in cream-tan upholstery with piping, a body-colour dashboard
    top with a round speedometer, a thin cream steering wheel on the left, gear lever, dark floor."""
    mb.box('car_trim', (-0.6, -1.05, 0.48), (0.6, 0.66, 0.53), bevel=False)                  # floor
    mb.box(PAINT, (-0.6, 0.50, 0.86), (0.6, 0.66, 1.0), bevel=True)                           # dashboard top
    mb.box('car_trim', (-0.58, 0.48, 0.70), (0.58, 0.52, 0.88), bevel=False)                  # dash face
    lathe_y(mb, 'car_chrome', [(0.0, 0.0), (0.075, 0.0), (0.075, -0.015), (0.06, -0.012)], (-0.32, 0.48, 0.92), -1, seg=16)
    lathe_y(mb, 'car_cream', [(0.06, -0.012), (0.0, -0.008)], (-0.32, 0.48, 0.92), -1, seg=16)
    for x in (-0.3, 0.3):
        # soft rounded bucket: plump cushion and an upholstered, slightly reclined backrest with piping
        mb.sphere('car_seat', (x, -0.08, 0.6), 0.23, seg=16, rings=7, sz=(0.22, 0.25, 0.08))
        with mb.at(tr(x, -0.36, 0.86) @ rot_x(-12)):
            mb.sphere('car_seat', (0, 0, 0), 0.25, seg=16, rings=8, sz=(0.21, 0.075, 0.27))
            mb.sweep('car_interior', [(-0.17 + 0.34 * k / 12, -0.065 * (1 - ((k - 6) / 6) ** 2) ** 0.5 - 0.01, 0.24 * (1 - ((k - 6) / 6) ** 2) ** 0.5)
                                      for k in range(13)], 0.008, seg=4)
    mb.sphere('car_seat', (0.0, -0.80, 0.6), 0.5, seg=18, rings=7, sz=(0.54, 0.2, 0.08))        # rear bench
    with mb.at(tr(0.0, -0.98, 0.82) @ rot_x(-10)):
        mb.sphere('car_seat', (0, 0, 0), 0.5, seg=18, rings=8, sz=(0.54, 0.07, 0.22))
    c = Vector((-0.32, 0.30, 1.0))
    ring = [(c.x + 0.19 * math.cos(2 * math.pi * k / 24), c.y + 0.05 * math.sin(2 * math.pi * k / 24),
             c.z + 0.18 * math.sin(2 * math.pi * k / 24)) for k in range(25)]
    mb.sweep('car_cream', ring, 0.011, seg=5, caps=False)
    for a in (0.0, math.pi * 0.5, math.pi):
        mb.sweep('car_cream', [tuple(c), (c.x + 0.18 * math.cos(a), c.y, c.z - 0.17 * math.sin(a) * 0 + 0.0)], 0.007, seg=4)
    mb.sweep('car_trim', [tuple(c), (-0.32, 0.5, 0.86)], 0.02, seg=6)
    mb.sweep('car_chrome', [(0.0, 0.25, 0.53), (0.0, 0.18, 0.78)], 0.01, seg=4)               # gear lever
    mb.sphere('car_cream', (0.0, 0.18, 0.79), 0.03, seg=8, rings=4)


# ---------------------------------------------------------------- assembly
def arch_cutter(collection, axle_y):
    mb = MeshBuilder()
    for s in (-1, 1):
        a, b = sorted((s * 0.40, s * 1.2))
        mb.cyl('car_trim', (a, axle_y, WHEEL_R + 0.02), (b, axle_y, WHEEL_R + 0.02), WHEEL_R + 0.045, seg=40, smooth=False)
    return mb.build('cutter', collection, bevel_width=0.0)


def cut(obj, collection):
    for axle_y in (AXLE_Y, -AXLE_Y):
        c = arch_cutter(collection, axle_y)
        mod = obj.modifiers.new('arch', 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.object = c
        mod.solver = 'EXACT'
        apply_modifiers(obj)
        bpy.data.objects.remove(c)


def build(collection):
    parts = []
    shell = MeshBuilder()
    loft(shell, [shell_section(*s) for s in SHELL], PAINT)
    o = shell.build('car_shell', collection, bevel_width=0.0, smooth_angle=75.0)
    cut(o, collection)
    cc = cabin_cutter(collection)
    mod = o.modifiers.new('cabin', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.object = cc
    mod.solver = 'EXACT'
    apply_modifiers(o)
    bpy.data.objects.remove(cc)
    parts.append(o)
    for table in (FRONT_FENDER, REAR_FENDER):
        for s in (-1, 1):
            fm = MeshBuilder()
            secs = [fender_section(y, xi, xo, zb, zt, e, s) for (y, xi, xo, zb, zt, e) in sorted(table)]
            loft(fm, secs, PAINT, flip=(s < 0))
            f = fm.build('car_fender', collection, bevel_width=0.0, smooth_angle=75.0)
            cut(f, collection)
            parts.append(f)
    mb = MeshBuilder()
    for (y, track) in ((AXLE_Y, TRACK_F), (-AXLE_Y, TRACK_R)):
        for s in (-1, 1):
            wheel(mb, s * track / 2, y)
    windscreen(mb)
    cabin_trim(mb)
    folded_hood(mb)
    headlamps_and_front(mb)
    bumpers(mb)
    rear_details(mb)
    doors(mb)
    running_boards(mb)
    interior(mb)
    parts.append(mb.build('car_parts', collection, bevel_width=0.008, bevel_segments=1, smooth_angle=60.0))

    for ob in bpy.context.view_layer.objects:
        ob.select_set(False)
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    car = parts[0]
    car.name = 'microcar'
    car.data.name = 'microcar'
    return car
