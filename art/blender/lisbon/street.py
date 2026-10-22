"""The Bica street and the junction at its top.

World frame (Blender, Z up): origin on the Bica centreline at the top junction. The Bica descends toward +Y
(exported glTF: -Z) to the river. The cross street at the top (Calçada do Combro / Rua do Loreto) runs along X.
"""
import math

from .geo import MeshBuilder

LENGTH = 124.0      # Bica length modelled (m)
SLOPE = 0.18        # average gradient
EASE = 6.0          # metres over which the junction plateau eases into the slope
ROAD_HW = 1.7       # half width of the sett road
KERB_W = 0.16
FACADE_X = 3.1      # façade line on both sides
STEP = 1.0          # pavement step spacing (Bica pavements are stairs)
CROSS_Y0, CROSS_Y1 = -11.0, 0.0     # cross street band
CROSS_X = 26.0
CROSS_PAVE = 1.8
RAIL_X = 0.45       # 900 mm gauge
KERB_H = 0.12


def road_z(y):
    if y <= 0:
        return 0.0
    if y < EASE:
        return -SLOPE * y * y / (2 * EASE)
    return -SLOPE * (y - EASE / 2)


def step_index(y):
    return math.floor(y / STEP)


def pave_z(y):
    """Pavement tread height at y: flat treads, each level with the kerb top at its downhill end."""
    if y < 0:
        return KERB_H
    k = step_index(y)
    return road_z((k + 1) * STEP) + KERB_H


def ground_z(x, y):
    """Ground under a point (used by buildings and props)."""
    if y < 0 and CROSS_Y0 <= y:
        if abs(x) < FACADE_X and CROSS_Y0 + CROSS_PAVE < y < CROSS_Y1 - CROSS_PAVE:
            return 0.0
        return KERB_H
    if abs(x) <= ROAD_HW:
        return road_z(y)
    return pave_z(y)


def build(collection, detail=2):
    mb = MeshBuilder()
    dy = 0.5
    n = int(LENGTH / dy)
    # ---- sett road with a slight crown, split around the rail strips
    cols = [-ROAD_HW, -1.2, -RAIL_X - 0.2, -RAIL_X - 0.04, -RAIL_X + 0.04, -0.03, 0.03, RAIL_X - 0.04, RAIL_X + 0.04,
            RAIL_X + 0.2, 1.2, ROAD_HW]
    crown = lambda x: 0.035 * (1 - (x / ROAD_HW) ** 2)
    mats = ['setts', 'setts', 'granite', 'rail_steel', 'granite', 'dark', 'granite', 'rail_steel', 'granite', 'setts', 'setts']
    y_start = CROSS_Y1 - CROSS_PAVE
    for c in range(len(cols) - 1):
        x0, x1 = cols[c], cols[c + 1]
        m = mats[c]
        lift = 0.012 if m == 'rail_steel' else (-0.02 if m == 'dark' else 0.0)
        ny = int((LENGTH - y_start) / dy)
        mb.grid(m, 1, ny, lambda i, j, x0=x0, x1=x1, lift=lift: (
            x0 + (x1 - x0) * i, y_start + j * dy, road_z(y_start + j * dy) + crown(x0 + (x1 - x0) * i) + lift),
            smooth=False)
    # rail side faces so the steel heads read
    for rx in (-RAIL_X, RAIL_X):
        for s in (-1, 1):
            x = rx + s * 0.04
            ny = int((LENGTH - y_start) / dy)
            for j in range(ny):
                ya, yb = y_start + j * dy, y_start + (j + 1) * dy
                za, zb = road_z(ya) + crown(x), road_z(yb) + crown(x)
                pts = [(x, ya, za), (x, yb, zb), (x, yb, zb + 0.012), (x, ya, za + 0.012)]
                mb.poly('rail_steel', pts if s > 0 else pts[::-1])

    # ---- kerbs, stepped pavements, risers on both sides
    for side in (-1, 1):
        xk0, xk1 = side * ROAD_HW, side * (ROAD_HW + KERB_W)
        xp1 = side * (FACADE_X + 0.3)
        ks = int(LENGTH / STEP)
        for k in range(ks):
            ya, yb = k * STEP, (k + 1) * STEP
            zt = pave_z(ya + 0.01)
            zr_low = min(road_z(yb), road_z(ya)) - 0.15
            # kerb stone
            mb.box('granite', (min(xk0, xk1), ya, zr_low), (max(xk0, xk1), yb - 0.004, zt + 0.004))
            # tread (calçada) subdivided for AO
            xa, xb = sorted((xk1, xp1))
            mb.grid('calcada', 4, 2, lambda i, j, xa=xa, xb=xb, ya=ya, yb=yb, zt=zt: (
                xa + (xb - xa) * i / 4, ya + (yb - ya - 0.14) * j / 2, zt), smooth=False)
            # granite nosing at the downhill edge of the tread and the riser below it
            z_next = pave_z(yb + 0.01)
            mb.box('granite', (xa, yb - 0.16, z_next - 0.02), (xb, yb + 0.0, zt + 0.006))
        # kerb continues up to the cross street
        mb.box('granite', (min(xk0, xk1), CROSS_Y1 - CROSS_PAVE, -0.1), (max(xk0, xk1), 0.0, KERB_H + 0.004))

    # ---- cross street at the top: sett road with tram rails along X, calçada pavements both sides
    yr0, yr1 = CROSS_Y0 + CROSS_PAVE, CROSS_Y1 - CROSS_PAVE
    tram_y = (yr0 + yr1) / 2
    bands = [yr0, tram_y - 0.75, tram_y - 0.49, tram_y - 0.41, tram_y + 0.41, tram_y + 0.49, tram_y + 0.75, yr1]
    bmats = ['setts', 'granite', 'rail_steel', 'setts', 'rail_steel', 'granite', 'setts']
    nx = int(2 * CROSS_X / 1.0)
    for b in range(len(bands) - 1):
        ya, yb = bands[b], bands[b + 1]
        lift = 0.012 if bmats[b] == 'rail_steel' else 0.0
        mb.grid(bmats[b], nx, 1, lambda i, j, ya=ya, yb=yb, lift=lift: (-CROSS_X + 2 * CROSS_X * i / nx, ya + (yb - ya) * j, lift),
                smooth=False)
    for (ya, yb) in ((CROSS_Y0, yr0), (yr1, CROSS_Y1)):
        segs = [(-CROSS_X, -ROAD_HW - KERB_W), (ROAD_HW + KERB_W, CROSS_X)] if yb == CROSS_Y1 else [(-CROSS_X, CROSS_X)]
        for (xa, xb) in segs:
            mb.grid('calcada', int((xb - xa) / 1.0), 2, lambda i, j, xa=xa, xb=xb, ya=ya, yb=yb: (
                xa + (xb - xa) * i / int((xb - xa) / 1.0), ya + (yb - ya) * j / 2, KERB_H), smooth=False)
        ky = yr0 if ya == CROSS_Y0 else yr1
        sgn = 1 if ya == CROSS_Y0 else -1
        for (xa, xb) in segs:
            mb.box('granite', (xa, ky - sgn * KERB_W if sgn < 0 else ky - KERB_W, -0.1), (xb, ky if sgn < 0 else ky, KERB_H + 0.004))
    # bottom: a short flat stretch toward Rua de São Paulo, where the mid-ground takes over
    zb = road_z(LENGTH)
    mb.grid('setts', 8, 6, lambda i, j: (-FACADE_X - 0.3 + (2 * FACADE_X + 0.6) * i / 8, LENGTH + j, zb), smooth=False)
    obj = mb.build('street', collection, bevel_width=0.012, bevel_segments=1)
    return obj


def wires(mb, z_off=5.4):
    """Funicular overhead wire with span wires to the façades every 12 m."""
    pts = []
    for k in range(0, int(LENGTH) + 1, 2):
        y = float(k)
        pts.append((0.0, y, road_z(y) + z_off))
    mb.tube('iron', pts, 0.008, seg=4)
    for y in range(4, int(LENGTH), 12):
        z = road_z(y) + z_off
        mb.tube('iron', [(-FACADE_X + 0.05, y, z + 0.35), (0, y, z + 0.02), (FACADE_X - 0.05, y, z + 0.35)], 0.006, seg=3)
        for s in (-1, 1):
            mb.box('iron', (s * FACADE_X - 0.05, y - 0.05, z + 0.25), (s * FACADE_X + 0.05, y + 0.05, z + 0.45), bevel=False)
        mb.box('iron', (-0.1, y - 0.03, z - 0.02), (0.1, y + 0.03, z + 0.03), bevel=False)
