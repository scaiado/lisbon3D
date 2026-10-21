"""The Bica funicular car (stylised, ours) and its overhead wire.

Real Lisbon funicular cars are stepped so every compartment floor stays level on the slope. This one keeps that
idea and silhouette in direction C's chunky storybook proportions: three level compartments stepping down the
hill, yellow lower body, a wide window band with chunky pillars, a cream upper band and a dark roof with a soft
overhang, on a sloped underframe riding the rails.
"""
import math

from .geo import MeshBuilder
from . import street as S

CENTRE_Y = 46.0         # halfway down the authored zone, as in the style frame
LENGTH = 8.4
HALF_W = 1.05
COMPARTMENTS = 3


def build(collection, centre_y=CENTRE_Y):
    mb = MeshBuilder()
    y_top = centre_y - LENGTH / 2
    seg = LENGTH / COMPARTMENTS
    # underframe follows the slope; wheels sit on the rails
    frame = []
    for k in range(COMPARTMENTS + 1):
        y = y_top + k * seg
        frame.append((y, S.road_z(y) + 0.32))
    for (ya, za), (yb, zb) in zip(frame[:-1], frame[1:]):
        mb.poly('funicular_dark', [(-0.62, ya, za), (0.62, ya, za), (0.62, yb, zb), (-0.62, yb, zb)][::-1])
        for s in (-1, 1):
            x = s * 0.62
            pts = [(x, ya, za), (x, yb, zb), (x, yb, zb + 0.28), (x, ya, za + 0.28)]
            mb.poly('funicular_dark', pts if s > 0 else pts[::-1])
    for y in (y_top + 0.9, y_top + LENGTH - 0.9):
        z = S.road_z(y) + 0.3
        for s in (-1, 1):
            mb.cyl('funicular_dark', (s * S.RAIL_X - 0.05, y, z), (s * S.RAIL_X + 0.05, y, z), 0.3, seg=14)
            mb.cyl('rail_steel', (s * S.RAIL_X - 0.06, y, z), (s * S.RAIL_X + 0.06, y, z), 0.12, seg=10)

    for k in range(COMPARTMENTS):
        ya = y_top + k * seg + 0.04
        yb = y_top + (k + 1) * seg - 0.04
        z0 = S.road_z(yb) + 0.62          # level floor, clear of the frame at the downhill end
        compartment(mb, ya, yb, z0, first=(k == 0), last=(k == COMPARTMENTS - 1))
        if k < COMPARTMENTS - 1:
            # skirt that hides the step between compartments
            zn = S.road_z(yb + 0.08 + seg) + 0.62
            mb.box('funicular_yellow', (-HALF_W + 0.04, yb - 0.02, zn), (HALF_W - 0.04, yb + 0.1, z0 + 0.06))

    # trolley pole up to the overhead wire, and the wire itself
    ym = centre_y
    zr = S.road_z(ym) + 0.62 + 2.55
    mb.box('funicular_dark', (-0.18, ym - 0.3, zr), (0.18, ym + 0.3, zr + 0.14))
    mb.tube('iron', [(0.0, ym, zr + 0.14), (0.0, ym - 1.4, S.road_z(ym - 1.4) + 5.38)], 0.025, seg=6)
    S.wires(mb)
    obj = mb.build('funicular', collection, bevel_width=0.03, bevel_segments=2)
    return obj


def compartment(mb, ya, yb, z0, first, last):
    w = HALF_W
    belt, sill, head, roof = z0 + 0.95, z0 + 1.05, z0 + 1.95, z0 + 2.32
    # lower body, belt rail, window band pillars, cream upper band
    mb.box('funicular_yellow', (-w, ya, z0), (w, yb, belt))
    mb.box('funicular_white', (-w - 0.03, ya, belt), (w + 0.03, yb, sill))
    mb.box('funicular_white', (-w, ya, head), (w, yb, roof - 0.08))
    n_win = 2
    span = (yb - ya)
    pillar = 0.16
    for s in (-1, 1):
        x_out, x_in = s * w, s * (w - 0.06)
        for i in range(n_win + 1):
            yc = ya + span * i / n_win
            y0 = max(ya, yc - pillar / 2)
            y1 = min(yb, yc + pillar / 2)
            mb.box('funicular_yellow', (min(x_out, x_in), y0, sill), (max(x_out, x_in), y1, head))
        # glass set back in the window band
        pts = [(x_in, ya, sill), (x_in, yb, sill), (x_in, yb, head), (x_in, ya, head)]
        mb.poly('glass', pts if s > 0 else pts[::-1], uvs=[(0, 0), (1, 0), (1, 1), (0, 1)] if s > 0 else [(0, 0), (0, 1), (1, 1), (1, 0)])
        # door outline and handle on the lower body
        yd = (ya + yb) / 2
        mb.box('funicular_dark', (s * w - 0.01, yd - 0.42, z0 + 0.1), (s * w + 0.015 * s, yd - 0.38, belt - 0.05))
        mb.box('funicular_dark', (s * w - 0.01, yd + 0.38, z0 + 0.1), (s * w + 0.015 * s, yd + 0.42, belt - 0.05))
        mb.box('brass', (s * w, yd + 0.25, z0 + 0.55), (s * (w + 0.04), yd + 0.31, z0 + 0.6))
    # roof: soft overhang, lantern strip
    mb.box('funicular_dark', (-w - 0.08, ya - 0.06, roof - 0.08), (w + 0.08, yb + 0.06, roof + 0.04))
    mb.box('funicular_white', (-w * 0.55, ya + 0.2, roof + 0.04), (w * 0.55, yb - 0.2, roof + 0.16))
    # ends: big end windows on the first and last compartments, lamp and bumper downhill
    for end, y_face, sgn in ((first, ya, -1), (last, yb, 1)):
        if not end:
            continue
        yo = y_face + sgn * 0.02
        mb.box('funicular_white', (-w, min(y_face, yo), belt), (w, max(y_face, yo), sill))
        for x0, x1 in ((-w + 0.12, -0.08), (0.08, w - 0.12)):
            pts = [(x0, y_face + sgn * 0.01, sill + 0.05), (x1, y_face + sgn * 0.01, sill + 0.05),
                   (x1, y_face + sgn * 0.01, head - 0.05), (x0, y_face + sgn * 0.01, head - 0.05)]
            mb.poly('glass', pts if sgn < 0 else pts[::-1], uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
        mb.box('funicular_dark', (-w - 0.05, y_face, z0 + 0.12), (w + 0.05, y_face + sgn * 0.12, z0 + 0.3))
        mb.sphere('lamp_glow', (0.0, y_face + sgn * 0.05, z0 + 0.7), 0.13, seg=12, rings=6, sz=(0.13, 0.06, 0.13))
        mb.box('brass', (-0.17, y_face, z0 + 0.55), (0.17, y_face + sgn * 0.03, z0 + 0.85))
