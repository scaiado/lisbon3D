"""The hero microcar: an invented one-seat electric pastry-delivery car (STYLE-C.md).

Pillowy superellipsoid forms in storybook proportions: a glossy teal tub, a wraparound glass bubble cab with a
teal roof cap on slim pillars, a rounded cream cargo box with the painted tart roundel on both sides, small oval
lamps, chrome bumpers and chunky wheels. It is not based on any real car.

Local frame (Blender): origin on the ground between the wheels, nose toward +Y (exported glTF: facing -Z).
"""
import math

from .geo import MeshBuilder

WHEEL_R = 0.27
TRACK = 0.62           # wheel centre x
AXLE_Y = 0.74          # wheel centre y (front +, rear -)


def superellipsoid(mb, mat, c, r, e=2.6, nu=28, nv=14, z_min=None, z_max=None, smooth=True):
    """Rounded box: |x/rx|^e + |y/ry|^e + |z/rz|^e = 1. z_min/z_max (local, -1..1) keep only a band of it."""
    cx, cy, cz = c
    rx, ry, rz = r
    p = 2.0 / e

    def sgnpow(v):
        return math.copysign(abs(v) ** p, v)

    def point(i, j):
        th = 2 * math.pi * i / nu
        ph = -math.pi / 2 + math.pi * j / nv
        x = sgnpow(math.cos(ph)) * sgnpow(math.cos(th))
        y = sgnpow(math.cos(ph)) * sgnpow(math.sin(th))
        z = sgnpow(math.sin(ph))
        return x, y, z

    def keep(i, j):
        z0, z1 = point(i, j)[2], point(i, j + 1)[2]
        return (z_min is None or z1 >= z_min) and (z_max is None or z0 <= z_max)

    mb.grid(mat, nu, nv, lambda i, j: (cx + rx * point(i, j)[0], cy + ry * point(i, j)[1], cz + rz * point(i, j)[2]),
            smooth=smooth, keep=keep)


def wheel(mb, x, y):
    s = 1 if x > 0 else -1
    w = 0.2
    mb.cyl('car_tyre', (x - s * w / 2, y, WHEEL_R), (x + s * w / 2, y, WHEEL_R), WHEEL_R, seg=20)
    # soft tyre shoulder and a domed chrome hub cap
    mb.cyl('car_tyre', (x + s * w / 2, y, WHEEL_R), (x + s * (w / 2 + 0.02), y, WHEEL_R), WHEEL_R - 0.03, r1=WHEEL_R - 0.08, seg=20)
    mb.sphere('car_chrome', (x + s * (w / 2 + 0.02), y, WHEEL_R), 0.12, seg=14, rings=6, sz=(0.04, 0.12, 0.12))
    mb.cyl('car_cream', (x + s * (w / 2 + 0.01), y, WHEEL_R), (x + s * (w / 2 + 0.025), y, WHEEL_R), 0.165, seg=16)


def build(collection):
    mb = MeshBuilder()
    for x in (-TRACK, TRACK):
        for y in (-AXLE_Y, AXLE_Y):
            wheel(mb, x, y)

    # tub: the teal lower body, with wheels tucked under its rounded flanks
    superellipsoid(mb, 'car_teal', (0, 0.05, 0.6), (0.66, 1.12, 0.36), e=2.8)
    # dark rubbing strip around the waist, chrome bumpers front and back
    superellipsoid(mb, 'car_trim', (0, 0.05, 0.6), (0.675, 1.135, 0.035), e=3.2, nv=4, smooth=True)
    for y, s in ((1.13, 1), (-1.05, -1)):
        mb.tube('car_chrome', [(-0.5, y - s * 0.06, 0.36), (-0.3, y, 0.35), (0.3, y, 0.35), (0.5, y - s * 0.06, 0.36)], 0.045, seg=10)

    # cab: wraparound glass bubble, roof cap on four slim pillars, seat and wheel visible inside
    superellipsoid(mb, 'car_glass', (0, 0.42, 0.92), (0.56, 0.6, 0.56), e=2.4, z_min=0.0, z_max=0.86)
    superellipsoid(mb, 'car_teal', (0, 0.38, 1.42), (0.5, 0.5, 0.075), e=3.0, nv=8)
    for x in (-0.5, 0.5):
        for y, lean in ((0.88, -0.1), (-0.08, 0.04)):
            mb.tube('car_teal', [(x * 1.06, y, 0.95), (x * 0.96, y + lean, 1.2), (x * 0.9, y + lean * 1.4, 1.4)], 0.035, seg=8)
    mb.box('car_seat', (-0.3, -0.12, 0.9), (0.3, 0.3, 1.02))
    mb.box('car_seat', (-0.3, -0.12, 1.0), (0.3, -0.0, 1.35))
    mb.tube('car_trim', [(0.0, 0.62, 0.95), (0.0, 0.7, 1.1)], 0.02, seg=6)
    mb.cyl('car_trim', (0.0, 0.68, 1.08), (0.0, 0.72, 1.14), 0.14, seg=16, caps=False)

    # cargo box: rounded cream crate behind the cab, roundel decals on both sides and the back
    superellipsoid(mb, 'car_cream', (0, -0.62, 1.12), (0.6, 0.46, 0.48), e=3.6)
    for s in (-1, 1):
        x = s * 0.604
        pts = [(x, -0.95, 0.8), (x, -0.29, 0.8), (x, -0.29, 1.46), (x, -0.95, 1.46)]
        uvs = [(1, 0), (0, 0), (0, 1), (1, 1)] if s < 0 else [(0, 0), (1, 0), (1, 1), (0, 1)]
        mb.poly('car_box', pts if s > 0 else pts[::-1], uvs=uvs if s > 0 else uvs[::-1])
    pts = [(0.33, -1.084, 0.8), (-0.33, -1.084, 0.8), (-0.33, -1.084, 1.46), (0.33, -1.084, 1.46)]
    mb.poly('car_box', pts, uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
    mb.box('car_trim', (-0.62, -1.1, 1.58), (0.62, -0.14, 1.62), bevel=True)          # roof-rack rail
    for y in (-1.0, -0.26):
        mb.box('car_trim', (-0.6, y - 0.02, 1.52), (0.6, y + 0.02, 1.6), bevel=False)

    # lamps: small oval headlamps with chrome bezels, warm tail lamps, side mirrors
    for x in (-0.38, 0.38):
        mb.sphere('car_chrome', (x, 1.1, 0.74), 0.13, seg=16, rings=8, sz=(0.13, 0.05, 0.1))
        mb.sphere('car_lamp', (x, 1.13, 0.74), 0.11, seg=16, rings=8, sz=(0.11, 0.04, 0.085))
        mb.sphere('car_tail', (x * 1.15, -1.03, 0.62), 0.07, seg=12, rings=6, sz=(0.07, 0.03, 0.05))
        s = 1 if x > 0 else -1
        mb.tube('car_chrome', [(s * 0.6, 0.78, 0.95), (s * 0.72, 0.8, 1.05)], 0.012, seg=5)
        mb.sphere('car_chrome', (s * 0.75, 0.8, 1.07), 0.06, seg=10, rings=5, sz=(0.03, 0.06, 0.045))
    # little nose grille: three chrome slats
    for k in range(3):
        z = 0.5 + k * 0.05
        mb.tube('car_chrome', [(-0.16, 1.14 - 0.01 * k, z), (0.16, 1.14 - 0.01 * k, z)], 0.012, seg=5)

    return mb.build('microcar', collection, bevel_width=0.015, bevel_segments=2, smooth_angle=50.0)
