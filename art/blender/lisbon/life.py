"""A few art-directed people and animals for scale and life (props_people, props_animals).

Storybook figures, not realistic humans: chunky, simple, slightly large heads, no drawn faces, soft painted cloth.
Each one is placed by hand and dropped onto the built street or roofs with a ray cast, so nothing floats.
Local figure frame: origin between the feet, facing +y, z up.
"""
import math

import bpy
from mathutils import Vector

from .geo import MeshBuilder, tr, rot_z, rot_x


def lathe_z(mb, mat, prof, c=(0, 0, 0), sx=1.0, sy=1.0, seg=16, cap_bottom=True):
    """Revolve [(r, z)] (bottom to top) around the local z axis, squashed by sx, sy."""
    cx, cy, cz = c
    m = mb.m
    base = len(mb.verts)
    n = len(prof)
    for s in range(seg):
        t = 2 * math.pi * s / seg
        for (r, z) in prof:
            mb.verts.append(m @ Vector((cx + r * math.cos(t) * sx, cy + r * math.sin(t) * sy, cz + z)))
    for s in range(seg):
        s2 = (s + 1) % seg
        for k in range(n - 1):
            mb.faces.append(((base + s * n + k, base + s2 * n + k, base + s2 * n + k + 1, base + s * n + k + 1), mat, None, False, True))
    if cap_bottom and prof[0][0] > 1e-4:
        mb.faces.append((tuple(base + s * n for s in reversed(range(seg))), mat, None, False, False))
    if prof[-1][0] > 1e-4:
        mb.faces.append((tuple(base + s * n + n - 1 for s in range(seg)), mat, None, False, False))


def limb(mb, mat, a, b, r0, r1, seg=8):
    mb.cyl(mat, a, b, r0, seg=seg, r1=r1, caps=False)
    mb.sphere(mat, a, r0, seg=seg, rings=4)
    mb.sphere(mat, b, r1, seg=seg, rings=4)


def person(mb, kind):
    """kind: 'grandma' (black dress, cardigan, bun, shopping bag), 'walker' (cap, jacket, trousers, mid stride),
    'woman' (mustard dress, satchel, walking uphill)."""
    if kind == 'grandma':
        skin, hair, dress, top = 'skin_light', 'hair_grey', 'cloth_black', 'cloth_cream'
        H = 1.56
        stride = 0.0
    elif kind == 'walker':
        skin, hair, dress, top = 'skin_mid', 'hair_dark', 'cloth_denim', 'cloth_navy'
        H = 1.74
        stride = 0.16
    else:
        skin, hair, dress, top = 'skin_dark', 'hair_dark', 'cloth_mustard', 'cloth_sage'
        H = 1.66
        stride = 0.13
    k = H / 1.66
    hip = 0.86 * k
    # legs and shoes
    for s in (-1, 1):
        fy = stride * s
        foot = (s * 0.085 * k, fy, 0.075 * k)
        leg_mat = 'cloth_black' if kind == 'grandma' else (dress if kind == 'walker' else skin)
        limb(mb, leg_mat, (s * 0.09 * k, fy * 0.3, hip), foot, 0.065 * k, 0.045 * k)
        mb.sphere('shoe', (foot[0], foot[1] + 0.05 * k, 0.04 * k), 0.06 * k, seg=10, rings=5, sz=(0.055 * k, 0.12 * k, 0.045 * k))
    # body
    if kind == 'walker':
        lathe_z(mb, dress, [(0.15, hip - 0.12), (0.17, hip), (0.16, hip + 0.1)], sy=0.75)            # trouser seat
        lathe_z(mb, top, [(0.175, hip - 0.04), (0.19, hip + 0.2), (0.2, hip + 0.42), (0.21, 1.33 * k), (0.15, 1.42 * k),
                          (0.06, 1.47 * k)], sy=0.72)                                                 # jacket
    else:
        hem = (0.46 if kind == 'grandma' else 0.5) * k
        lathe_z(mb, dress, [(0.27 * k, hem), (0.22 * k, hem + 0.2), (0.16 * k, 0.98 * k), (0.15 * k, 1.04 * k)], sy=0.78)
        lathe_z(mb, top, [(0.16 * k, 0.96 * k), (0.18 * k, 1.12 * k), (0.2 * k, 1.3 * k), (0.15 * k, 1.41 * k), (0.06 * k, 1.47 * k)],
                sy=0.75)
    # neck, head, hair
    mb.cyl(skin, (0, 0, 1.44 * k), (0, 0, 1.53 * k), 0.045 * k, seg=8, caps=False)
    hz = 1.6 * k
    mb.sphere(skin, (0, 0.005, hz), 0.115 * k, seg=14, rings=8, sz=(0.105 * k, 0.11 * k, 0.125 * k))
    mb.sphere(skin, (0, 0.11 * k, hz - 0.01 * k), 0.022 * k, seg=6, rings=4)                         # nose
    for s in (-1, 1):
        mb.sphere(skin, (s * 0.105 * k, -0.005, hz), 0.022 * k, seg=6, rings=4, sz=(0.012, 0.022, 0.03))  # ears
    if kind == 'grandma':
        mb.sphere(hair, (0, -0.015, hz + 0.03 * k), 0.12 * k, seg=14, rings=7, sz=(0.112 * k, 0.115 * k, 0.11 * k))
        mb.sphere(hair, (0, -0.1 * k, hz + 0.07 * k), 0.055 * k, seg=10, rings=6)                     # bun
    elif kind == 'walker':
        mb.sphere(hair, (0, -0.02, hz + 0.01 * k), 0.118 * k, seg=14, rings=7, sz=(0.11 * k, 0.11 * k, 0.1 * k))
        # flat cap with a peak
        mb.sphere('cloth_navy', (0, 0.0, hz + 0.075 * k), 0.13 * k, seg=14, rings=6, sz=(0.125 * k, 0.135 * k, 0.05 * k))
        mb.sphere('cloth_navy', (0, 0.11 * k, hz + 0.055 * k), 0.08 * k, seg=10, rings=4, sz=(0.09 * k, 0.06 * k, 0.012 * k))
    else:
        mb.sphere(hair, (0, -0.02, hz + 0.02 * k), 0.13 * k, seg=14, rings=7, sz=(0.125 * k, 0.12 * k, 0.12 * k))
        mb.sphere(hair, (0, -0.09 * k, hz - 0.08 * k), 0.09 * k, seg=10, rings=6, sz=(0.1 * k, 0.07 * k, 0.12 * k))
    # arms: swing opposite to the legs when walking
    for s in (-1, 1):
        sh = (s * 0.2 * k, 0, 1.36 * k)
        swing = -stride * s * 1.4
        el = (s * 0.23 * k, swing * 0.5, 1.12 * k)
        ha = (s * 0.22 * k, swing, 0.9 * k)
        if kind == 'grandma' and s > 0:
            el = (0.24 * k, 0.05, 1.12 * k)
            ha = (0.22 * k, 0.08, 0.92 * k)
        sleeve = top
        limb(mb, sleeve, sh, el, 0.055 * k, 0.048 * k)
        limb(mb, sleeve if kind != 'woman' else skin, el, ha, 0.045 * k, 0.038 * k)
        mb.sphere(skin, (ha[0], ha[1], ha[2] - 0.04 * k), 0.045 * k, seg=8, rings=5)
    # accessories
    if kind == 'grandma':
        # shopping bag with bread and greens poking out
        bx, by, bz = 0.25 * k, 0.1, 0.62 * k
        mb.box('cloth_rose', (bx - 0.05, by - 0.17, bz - 0.25), (bx + 0.05, by + 0.17, bz + 0.05), bevel=True)
        mb.tube('cloth_rose', [(bx, by - 0.1, bz + 0.05), (bx, by - 0.04, bz + 0.26), (bx, by + 0.04, bz + 0.26), (bx, by + 0.1, bz + 0.05)],
                0.012, seg=4)
        mb.cyl('wood_ochre', (bx, by - 0.12, bz), (bx + 0.02, by - 0.05, bz + 0.22), 0.03, seg=6)
        mb.sphere('foliage', (bx, by + 0.08, bz + 0.07), 0.07, seg=8, rings=5)
    elif kind == 'woman':
        mb.tube('cloth_rose', [(-0.2 * k, 0.0, 1.35 * k), (0.0, 0.12, 1.15 * k), (0.2 * k, 0.0, 0.95 * k)], 0.012, seg=4)
        mb.box('cloth_rose', (0.2 * k, -0.1, 0.8 * k), (0.27 * k, 0.12, 1.0 * k), bevel=True)


def cat(mb, mat, sitting=True):
    if sitting:
        mb.sphere(mat, (0, -0.05, 0.1), 0.13, seg=12, rings=7, sz=(0.1, 0.13, 0.1))         # haunches
        mb.sphere(mat, (0, 0.04, 0.2), 0.1, seg=12, rings=7, sz=(0.075, 0.08, 0.13))         # chest
        for s in (-1, 1):
            limb(mb, mat, (s * 0.04, 0.08, 0.15), (s * 0.04, 0.1, 0.02), 0.022, 0.02, seg=6)
        hz = 0.33
        mb.sphere(mat, (0, 0.07, hz), 0.07, seg=12, rings=7, sz=(0.07, 0.065, 0.06))
        mb.sphere(mat, (0, 0.125, hz - 0.015), 0.03, seg=8, rings=4, sz=(0.03, 0.02, 0.022))   # muzzle
        for s in (-1, 1):
            mb.cyl(mat, (s * 0.04, 0.07, hz + 0.04), (s * 0.05, 0.065, hz + 0.1), 0.025, seg=4, r1=0.002)  # ears
        tail = [(0.0, -0.17, 0.03), (0.08, -0.12, 0.02), (0.13, -0.02, 0.02), (0.12, 0.08, 0.02), (0.07, 0.12, 0.02)]
        mb.sweep(mat, tail, 0.018, seg=6)
    else:   # lying in the sun, loaf pose
        mb.sphere(mat, (0, 0, 0.09), 0.2, seg=12, rings=7, sz=(0.1, 0.2, 0.09))
        mb.sphere(mat, (0, 0.18, 0.15), 0.07, seg=12, rings=7, sz=(0.07, 0.065, 0.06))
        for s in (-1, 1):
            mb.cyl(mat, (s * 0.04, 0.18, 0.19), (s * 0.05, 0.175, 0.25), 0.025, seg=4, r1=0.002)
        mb.sweep(mat, [(0.0, -0.18, 0.04), (0.1, -0.2, 0.02), (0.15, -0.1, 0.02)], 0.018, seg=6)


def gull(mb, flying=False):
    if flying:
        mb.sphere('gull', (0, 0, 0), 0.2, seg=12, rings=6, sz=(0.08, 0.22, 0.08))
        mb.sphere('gull', (0, 0.22, 0.03), 0.06, seg=10, rings=5)
        mb.cyl('beak', (0, 0.27, 0.03), (0, 0.33, 0.02), 0.014, seg=5, r1=0.003)
        for s in (-1, 1):
            # bent wings: inner and outer panels
            mb.poly('gull_grey', [(0, -0.05, 0.02), (0, 0.08, 0.02), (s * 0.35, 0.05, 0.1), (s * 0.35, -0.08, 0.08)][::(-1 if s > 0 else 1)])
            mb.poly('gull_grey', [(s * 0.35, -0.08, 0.08), (s * 0.35, 0.05, 0.1), (s * 0.7, -0.02, 0.02), (s * 0.66, -0.12, 0.02)][::(-1 if s > 0 else 1)])
            mb.poly('gull_grey', [(0, -0.05, 0.015), (s * 0.35, -0.08, 0.075), (s * 0.35, 0.05, 0.095), (0, 0.08, 0.015)][::(-1 if s > 0 else 1)])
            mb.poly('gull_grey', [(s * 0.35, -0.08, 0.075), (s * 0.66, -0.12, 0.015), (s * 0.7, -0.02, 0.015), (s * 0.35, 0.05, 0.095)][::(-1 if s > 0 else 1)])
        mb.poly('gull', [(-0.05, -0.2, 0.0), (0.05, -0.2, 0.0), (0.0, -0.3, 0.0)])
        return
    mb.sphere('gull', (0, 0, 0.17), 0.13, seg=12, rings=7, sz=(0.075, 0.15, 0.085))
    mb.sphere('gull_grey', (0, -0.03, 0.2), 0.12, seg=12, rings=6, sz=(0.08, 0.15, 0.06))
    mb.sphere('gull', (0, 0.12, 0.29), 0.055, seg=10, rings=6)
    mb.cyl('beak', (0, 0.16, 0.285), (0, 0.22, 0.275), 0.013, seg=5, r1=0.004)
    mb.cyl('cat_dark', (0, -0.15, 0.2), (0, -0.22, 0.19), 0.03, seg=5, r1=0.01)          # dark wing tips
    for s in (-1, 1):
        mb.cyl('beak', (s * 0.03, 0.0, 0.1), (s * 0.03, 0.02, 0.0), 0.008, seg=4)


def pigeon(mb):
    mb.sphere('pigeon', (0, 0, 0.09), 0.08, seg=10, rings=6, sz=(0.055, 0.09, 0.06))
    mb.sphere('pigeon', (0, 0.07, 0.14), 0.035, seg=8, rings=5)
    mb.cyl('dark', (0, 0.1, 0.14), (0, 0.125, 0.135), 0.008, seg=4, r1=0.002)
    mb.poly('pigeon', [(-0.03, -0.08, 0.08), (0.03, -0.08, 0.08), (0.0, -0.15, 0.07)])
    for s in (-1, 1):
        mb.cyl('beak', (s * 0.02, 0.0, 0.04), (s * 0.02, 0.01, 0.0), 0.006, seg=3)


def drop(x, y, z_from=200.0):
    """Ground (or roof) height under (x, y) in the built scene."""
    dg = bpy.context.evaluated_depsgraph_get()
    hit, loc, *_ = bpy.context.scene.ray_cast(dg, Vector((x, y, z_from)), Vector((0, 0, -1)))
    return loc.z if hit else 0.0


# (kind, x, y, heading in degrees: 0 = facing +y / downhill, 90 = facing -x)
PEOPLE = [
    ('grandma', -2.62, 13.5, -78),     # at her door on the tiled Bica house, turned to the street
    ('walker', 2.45, 23.5, 4),         # walking down the east pavement
    ('woman', -2.45, 34.0, 178),       # walking up the west pavement
]
ANIMALS = [
    ('cat', -2.7, 17.4, -110, True),   # ginger cat sitting by the steps, watching the street
    ('cat_dark', 2.75, 9.6, 30, False),   # dark cat loafing against the east wall
    ('pigeon', -2.3, 5.2, 40), ('pigeon', -2.05, 5.75, 160), ('pigeon', -2.45, 6.3, -20),
    ('gull', -6.4, 4.0, 120), ('gull', 7.2, 13.6, -60),
    ('gull_fly', 1.5, 34.0, 15.0),     # gliding over the street toward the river (absolute height above the road)
]


def build(collection):
    people = MeshBuilder()
    from . import street as S
    for kind, x, y, head in PEOPLE:
        z = drop(x, y, S.ground_z(x, y) + 1.2)     # from just above the pavement, under balconies and awnings
        with people.at(tr(x, y, z) @ rot_z(head)):
            person(people, kind)
    animals = MeshBuilder()
    for a in ANIMALS:
        kind, x, y = a[0], a[1], a[2]
        if kind == 'gull_fly':
            with animals.at(tr(x, y, S.road_z(y) + a[3]) @ rot_z(10) @ rot_x(-6)):
                gull(animals, flying=True)
            continue
        head = a[3]
        z = drop(x, y) if kind == 'gull' else drop(x, y, S.ground_z(x, y) + 1.2)
        with animals.at(tr(x, y, z) @ rot_z(head)):
            if kind in ('cat', 'cat_dark'):
                cat(animals, kind, sitting=a[4])
            elif kind == 'pigeon':
                pigeon(animals)
            else:
                gull(animals)
    return [people.build('props_people', collection, bevel_width=0.0, smooth_angle=70.0),
            animals.build('props_animals', collection, bevel_width=0.0, smooth_angle=70.0)]
