"""Ambient-occlusion bake into vertex colour 'Col' (exported as COLOR_0). No sun light or shadows are baked:
the engine lights the scene. Occlusion is tinted toward STYLE-C's blue-violet shade so corners and reveals
read as coloured shade rather than grey."""
import time

import bpy
import numpy as np

SHADE = np.array([0.30, 0.31, 0.50], np.float32)   # colour at full occlusion (linear-ish multiply)


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


def tint(obj, strength=0.85):
    attr = obj.data.color_attributes['Col']
    n = len(attr.data)
    c = np.empty(n * 4, np.float32)
    attr.data.foreach_get('color', c)
    c = c.reshape(n, 4)
    ao = np.clip(c[:, 0], 0, 1) ** 0.9
    occ = (1 - ao)[:, None] * strength
    rgb = 1 - occ * (1 - SHADE[None, :])
    c[:, :3] = rgb
    c[:, 3] = 1
    attr.data.foreach_set('color', c.ravel())
