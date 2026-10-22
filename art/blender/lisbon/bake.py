"""Ambient-occlusion bake into vertex colour 'Col' (exported as COLOR_0). No sun light or shadows are baked:
the engine lights the scene. Occlusion is tinted toward STYLE-C's blue-violet shade so corners and reveals
read as coloured shade rather than grey."""
import math
import time

import bpy
import numpy as np

SHADE = np.array([0.24, 0.25, 0.50], np.float32)   # colour at full occlusion: STYLE-C blue-violet


def ensure_col(obj):
    me = obj.data
    if 'Col' not in me.color_attributes:
        me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    attr = me.color_attributes['Col']
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = me.color_attributes.find('Col')
    return attr


def fill_white(obj):
    attr = ensure_col(obj)
    n = len(attr.data)
    attr.data.foreach_set('color', np.ones(n * 4, np.float32))
    tint(obj)       # no occlusion, but keep the tints and the world-space variation


def bake_ao(objs, samples=48, distance=2.5, log=print):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.light_settings.distance = distance
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        ensure_col(o)
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    t = time.time()
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS', use_clear=True, margin=0)
    log('AO bake: %d objects in %.1fs' % (len(objs), time.time() - t))
    for o in objs:
        tint(o)
        o.select_set(False)


def _field(P, seed, scale, n=6):
    """Cheap non-repeating smooth field in world space: a sum of randomly oriented sines, roughly -1..1."""
    rng = np.random.default_rng(seed)
    out = np.zeros(len(P), np.float32)
    for _ in range(n):
        d = rng.normal(size=3)
        d /= np.linalg.norm(d)
        f = scale * rng.uniform(0.6, 1.6)
        out += np.sin(P @ (d * f) + rng.uniform(0, 6.283))
    return out / math.sqrt(n / 2)


def tint(obj, strength=0.9):
    """AO -> blue-violet shade, times the per-face tint, times soft world-space variation (stains on plaster,
    colour drift on roofs, rising damp near the ground) so repeated textures don't read as repeats."""
    me = obj.data
    attr = me.color_attributes['Col']
    n = len(attr.data)
    c = np.empty(n * 4, np.float32)
    attr.data.foreach_get('color', c)
    c = c.reshape(n, 4)
    ao = np.clip(c[:, 0], 0, 1) ** 0.9
    occ = (1 - ao)[:, None] * strength
    rgb = 1 - occ * (1 - SHADE[None, :])

    if 'Tint' in me.color_attributes:
        t = np.empty(n * 4, np.float32)
        me.color_attributes['Tint'].data.foreach_get('color', t)
        rgb *= t.reshape(n, 4)[:, :3]
        me.color_attributes.remove(me.color_attributes['Tint'])
        me.color_attributes.active_color = me.color_attributes['Col']
        attr = me.color_attributes['Col']

    # per-corner world positions and material names
    vi = np.empty(n, np.int32)
    me.loops.foreach_get('vertex_index', vi)
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    M = np.array(obj.matrix_world, np.float32)
    P = co @ M[:3, :3].T + M[:3, 3]
    P = P[vi]
    pm = np.empty(len(me.polygons), np.int32)
    me.polygons.foreach_get('material_index', pm)
    lt = np.empty(len(me.polygons), np.int32)
    me.polygons.foreach_get('loop_total', lt)
    loop_mat = np.repeat(pm, lt)
    names = [m.name if m else '' for m in me.materials]
    kind = np.array([0 if not nm else (1 if nm.startswith(('plaster', 'grout', 'far_', 'mid_wall')) else
                                       (2 if 'roof' in nm else 0)) for nm in names] or [0], np.int32)
    k = kind[loop_mat] if len(names) else np.zeros(n, np.int32)

    wall = k == 1
    if wall.any():
        v = 1 + 0.055 * _field(P[wall], 11, 0.35) + 0.03 * _field(P[wall], 12, 1.2)
        if obj.name.startswith('building_'):
            from . import street as S
            y = P[wall, 1]
            road = np.where(y <= 0, 0.0, np.where(y < S.EASE, -S.SLOPE * y * y / (2 * S.EASE), -S.SLOPE * (y - S.EASE / 2)))
            zrel = P[wall, 2] - (road + S.KERB_H)
            damp = np.clip(1 - zrel / 1.1, 0, 1)
            v *= 1 - 0.13 * damp * (0.7 + 0.3 * _field(P[wall], 13, 2.0))
        rgb[wall] *= v[:, None]
    roof = k == 2
    if roof.any():
        f = _field(P[roof], 21, 0.12)
        rgb[roof] *= np.stack([1 + 0.05 * f, 1 + 0.02 * f, 1 - 0.03 * f], -1) * (1 + 0.04 * _field(P[roof], 22, 0.6))[:, None]

    c[:, :3] = np.clip(rgb, 0, 1)
    c[:, 3] = 1
    attr.data.foreach_set('color', c.ravel())
