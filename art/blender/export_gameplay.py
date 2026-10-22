"""Gameplay data for the playable Bica slice, taken from the same recipes and street profile as bica.glb.

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python art/blender/export_gameplay.py

Writes art/exports/bica_gameplay.json in glTF world coordinates: x, y up, z = -(Blender y). The street descends
toward -z. Headings are yaw angles in radians about +y, where 0 faces -z (down the Bica) and +pi/2 faces -x.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from lisbon import textures, recipes, buildings, street as S, funicular  # noqa: E402

textures.OUT = os.path.join(HERE, 'out', 'textures')
os.makedirs(textures.OUT, exist_ok=True)


def gl(v):
    """Blender (x, y, z) -> glTF (x, y up, z)."""
    return [round(v[0], 3), round(v[2], 3), round(-v[1], 3)]


def gl_dir(v):
    return [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]


def heading(dir_b):
    """Yaw about glTF +y for a horizontal Blender direction; 0 faces -z (Blender +y, downhill)."""
    return round(math.atan2(-dir_b[0], dir_b[1]), 4)


bpy.ops.wm.read_factory_settings(use_empty=True)
coll = bpy.data.collections.new('gp')
bpy.context.scene.collection.children.link(coll)

doors = []          # every street door and shopfront on the Bica and the corner façades
for r in recipes.all_recipes():
    obj, info = buildings.build(r, coll, detail=1)
    sets = [(info['matrix'], info['openings'], 'front')]
    if info.get('side'):
        Ms, ops = info['side']
        sets.append((Ms, ops, 'corner'))
    for M, ops, where in sets:
        rot = M.to_3x3()
        for (si, tok, o) in ops:
            if si != 0 or tok not in ('D', 'S'):
                continue
            cx = (o.x0 + o.x1) / 2
            pos = M @ Vector((cx, -0.03, o.z0))
            nrm = (rot @ Vector((0, -1, 0))).normalized()
            doors.append(dict(building=r['name'], side=r['side'], where=where, kind='door' if tok == 'D' else 'shop',
                              pos=pos, normal=nrm, sign=r.get('signs', {}).get(o.bay), width=o.x1 - o.x0))
    bpy.data.objects.remove(obj)

print('[gameplay] candidate doors:', len(doors))


def stand_for(d):
    """Where the car should stop: on the road beside the door, hugging the kerb on the door's side."""
    p = d['pos']
    if d['where'] == 'corner':
        # the bakery on the cross street: stop on the near half of the cross street, opposite the door
        y = S.CROSS_Y1 - S.CROSS_PAVE - 1.6
        return Vector((p.x, y, 0.0)), Vector((1.0 if p.x < 0 else -1.0, 0.0, 0.0))
    x = math.copysign(0.78, p.x)
    return Vector((x, p.y, S.road_z(p.y))), Vector((0.0, 1.0, 0.0))


def nearest(side, y, kind=('door',), exclude=()):
    best = None
    for d in doors:
        if d['where'] != 'front' or d['side'] != side or d['kind'] not in kind or d['building'] in exclude:
            continue
        dist = abs(d['pos'].y - y)
        if best is None or dist < best[0]:
            best = (dist, d)
    return best[1] if best else None


# bakery: the corner shopfront on the Calçada do Combro side, near the top of the Bica
bakery_door = next((d for d in doors if d['where'] == 'corner' and d['kind'] == 'shop' and d['building'].startswith('e01')), None) \
    or next(d for d in doors if d['where'] == 'corner' and d['kind'] == 'shop')

# five customers down the Bica, alternating sides, the last near the bottom; the grandmother's door is the first
plan = [('W', 13.5, 'D. Amélia', 'grandmother waiting at her door'),
        ('E', 24.0, 'Sr. Joaquim', None),
        ('W', 34.0, 'Marta e Rui', None),     # clear of the funicular car parked around y = 42-50
        ('E', 72.0, 'Tia Fernanda', None),
        ('W', 112.0, 'Sr. Abílio', None)]
stops, used = [], set()
for k, (side, y, who, note) in enumerate(plan):
    d = nearest(side, y, exclude=used)
    used.add(d['building'])
    stand, along = stand_for(d)
    number = (1 if side == 'W' else 2) + 2 * int(round(d['pos'].y / 5.5))
    stop = dict(id='stop%d' % (k + 1), recipient=who, houseNumber=str(number), building=d['building'],
                door=gl(d['pos']), doorNormal=gl_dir(d['normal']), stand=gl(stand),
                standHeading=heading(along), radius=2.2)
    if note:
        stop['note'] = note
    stops.append(stop)

b_stand, b_along = stand_for(bakery_door)
bakery = dict(name='Pastelaria Bica Doce', kind='pickup', building=bakery_door['building'], door=gl(bakery_door['pos']),
              doorNormal=gl_dir(bakery_door['normal']), stand=gl(b_stand), standHeading=heading(b_along), radius=2.4)

spawn_b = Vector((0.0, S.CROSS_Y0 + S.CROSS_PAVE + 2.6, 0.0))
centre = [gl(Vector((0.0, y, S.road_z(y) if y > 0 else 0.0))) for y in
          [S.CROSS_Y0 + S.CROSS_PAVE + 1.0] + [float(y) for y in range(0, int(S.LENGTH) + 1, 4)] + [S.LENGTH + 4.0]]
track = [gl(Vector((0.0, float(y), S.road_z(float(y)) + 0.02))) for y in range(2, int(S.LENGTH) - 1, 4)]

data = dict(
    units='metres', frame='glTF world (x, y up, z = -Blender y); the Bica descends toward -z',
    headingConvention='yaw about +y in radians; 0 faces -z (down the Bica), +pi/2 faces -x',
    spawn=dict(position=gl(spawn_b), heading=0.0, note='middle of the cross street at the top, facing down the Bica'),
    bakery=bakery,
    stops=stops,
    funicular=dict(trackCentreline=track, gauge=0.9, carLength=funicular.LENGTH, carCentre=gl(
        Vector((0.0, funicular.CENTRE_Y, S.road_z(funicular.CENTRE_Y)))), carCentreDistanceFromTop=funicular.CENTRE_Y,
        slope=S.SLOPE),
    streetBounds=dict(
        bicaCentreline=centre, roadHalfWidth=S.ROAD_HW, kerbWidth=S.KERB_W, facadeHalfWidth=S.FACADE_X,
        bottomLimit=gl(Vector((0.0, S.LENGTH + 6.0, S.road_z(S.LENGTH)))),
        crossStreet=dict(xMin=-S.CROSS_X, xMax=S.CROSS_X, roadZ=[round(-(S.CROSS_Y1 - S.CROSS_PAVE), 3), round(-(S.CROSS_Y0 + S.CROSS_PAVE), 3)],
                         y=0.0),
        averageGradient=S.SLOPE, pavementStepSpacing=S.STEP, kerbHeight=S.KERB_H),
    allDoors=[dict(building=d['building'], kind=d['kind'], where=d['where'], door=gl(d['pos']), normal=gl_dir(d['normal']))
              for d in sorted(doors, key=lambda d: d['pos'].y)],
)
out = os.path.join(ROOT, 'art', 'exports', 'bica_gameplay.json')
with open(out, 'w') as f:
    json.dump(data, f, indent=1, ensure_ascii=False)
print('[gameplay] wrote', out, 'stops:', [(s['recipient'], s['door']) for s in stops], 'bakery:', bakery['door'])
