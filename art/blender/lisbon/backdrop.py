"""Mid-ground roofs, the river and painted far cards.

Beyond the authored street the city is a field of simple painted blocks: plaster walls carrying the painted
far-façade texture, real pitched roofs with an overhang and chimneys, stepping down the hill to the riverfront.
They take fog and shadows in the engine. The river is one plane; the far shore and the bridge are painted cards
(named backdrop_*, unlit, no fog: their haze is painted in). The cards sit closer than the real south bank
(1.1–1.3 km, not 2–3 km) so they read in the review views, as in the style frame.
"""
import math
import random

from .geo import MeshBuilder
from . import street as S

QUAY_Y = 280.0
QUAY_Z = S.road_z(S.LENGTH) - 18.0      # Cais do Sodré is ~45 m below the top of the Bica
RIVER_Z = QUAY_Z - 3.0
FAR_MATS = ['far_ochre', 'far_rose', 'far_cream', 'far_yellow']


def terrain(y):
    """Ground height of the mid-ground: the Bica slope, easing out to the flat riverfront."""
    if y <= 0:
        return 0.6
    if y <= S.LENGTH:
        return S.road_z(y)
    t = min(1.0, (y - S.LENGTH) / (QUAY_Y - S.LENGTH))
    t = t * t * (3 - 2 * t)
    return S.road_z(S.LENGTH) + (QUAY_Z - S.road_z(S.LENGTH)) * t


def occupied(x0, x1, y0, y1):
    """Keep clear of the authored buildings, the streets and the river."""
    if y1 > QUAY_Y - 6:
        return True
    if y1 > S.CROSS_Y0 - 1 and y0 < S.CROSS_Y1 + 1 and abs(x0 + x1) / 2 < 70:
        return True       # the cross street at the top
    if x1 > -16 and x0 < 16 and y1 > S.CROSS_Y1 and y0 < S.LENGTH + 2:
        return True       # the authored Bica buildings
    if x1 > -6 and x0 < 6 and y0 >= S.LENGTH:
        return True       # Rua de São Paulo and the street line below the Bica
    if S.LENGTH + 2 <= y0 < S.LENGTH + 10:
        return True       # the cross street at the bottom
    return False


def build(collection, seed=401):
    rnd = random.Random(seed)
    mid = MeshBuilder()
    cell = 10.0
    for gy in range(-7, int(QUAY_Y / cell)):
        for gx in range(-9, 9):
            x0 = gx * cell + rnd.uniform(0.2, 0.8)
            y0 = gy * cell + rnd.uniform(0.2, 0.8)
            w = rnd.uniform(8.0, 9.4)
            d = rnd.uniform(8.0, 9.4)
            if occupied(x0, x0 + w, y0, y0 + d):
                continue
            block(mid, rnd, x0, y0, w, d)
    # ground between the blocks so no sky shows through alleys
    mid.grid('setts', 36, 60, lambda i, j: (-90 + 5 * i, -70 + 5.9 * j, terrain(-70 + 5.9 * j) - 0.05), smooth=False,
             keep=lambda i, j: not (abs(-90 + 5 * i + 2.5) < 8 and -12 < -70 + 5.9 * j < S.LENGTH + 2))
    objs = [mid.build('midground', collection, bevel_width=0.0)]

    water = MeshBuilder()
    water.poly('river', [(-3000, QUAY_Y, RIVER_Z), (3000, QUAY_Y, RIVER_Z), (3000, 1400, RIVER_Z), (-3000, 1400, RIVER_Z)])
    water.box('granite', (-400, QUAY_Y - 6, RIVER_Z - 2), (400, QUAY_Y, QUAY_Z + 0.3), bevel=False)
    objs.append(water.build('river', collection, bevel_width=0.0))

    objs.append(card('backdrop_far_shore', 'backdrop_far_shore', collection, -2600, 2600, 1300, RIVER_Z - 2, RIVER_Z + 170))
    objs.append(card('backdrop_bridge', 'backdrop_bridge', collection, 150, 1550, 1100, RIVER_Z - 4, RIVER_Z + 140))
    return objs


def block(mb, rnd, x0, y0, w, d):
    x1, y1 = x0 + w, y0 + d
    base = min(terrain(y0), terrain(y1))
    top = max(terrain(y0), terrain(y1)) + rnd.choice((9.6, 12.8, 12.8, 16.0))
    mat = rnd.choice(FAR_MATS)
    mb.box(mat, (x0, y0, base - 30.0), (x1, y1, top), bevel=False, skip=('-z', '+z'))
    pitch = math.radians(rnd.uniform(22, 30))
    ov = 0.35
    along_x = rnd.random() < 0.5
    if along_x:
        rise = (d / 2 + ov) * math.tan(pitch)
        yc = (y0 + y1) / 2
        prof = [(y0 - ov, top - 0.05), (y1 + ov, top - 0.05), (yc, top + rise)]
        mb.prism('far_roof', prof, x0 - ov, x1 + ov, bevel=False)
    else:
        rise = (w / 2 + ov) * math.tan(pitch)
        xc = (x0 + x1) / 2
        with mb.at(_swap_xy()):
            prof = [(x1 + ov, top - 0.05), (x0 - ov, top - 0.05), (xc, top + rise)]
            mb.prism('far_roof', prof, y0 - ov, y1 + ov, bevel=False)
    for _ in range(rnd.choice((0, 1, 1, 2))):
        cx = rnd.uniform(x0 + 1.2, x1 - 1.6)
        cy = rnd.uniform(y0 + 1.2, y1 - 1.6)
        mb.box('far_cream', (cx, cy, top), (cx + 0.5, cy + 0.7, top + rise + 0.7), bevel=False)


def _swap_xy():
    from mathutils import Matrix
    return Matrix(((0, 1, 0, 0), (1, 0, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1)))


def card(name, mat, collection, x0, x1, y, z0, z1):
    mb = MeshBuilder()
    mb.poly(mat, [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
    return mb.build(name, collection, bevel_width=0.0)
