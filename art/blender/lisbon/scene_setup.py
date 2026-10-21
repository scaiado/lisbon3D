"""Lighting and review cameras for Blender target renders (not exported: the engine lights the scene)."""
import math
import os

import bpy
from mathutils import Vector

from . import street as S
from . import materials as Mt

# low warm sun ahead-right of the downhill view (south-west), 17 degrees up
TO_SUN = Vector((0.72, 0.62, math.tan(math.radians(17)))).normalized()

VIEWS = {
    # name: (camera position, look-at target, vertical fov degrees)
    'view1_chase': ((0.35, -3.2, 2.25), (0.0, 40.0, -5.5), 50.0),
    'view2_facade': ((1.3, 9.2, S.pave_z(9.2) + 1.55), (-3.1, 14.6, S.pave_z(14.6) + 3.2), 50.0),
    'view3_establishing': ((9.0, -16.0, 26.0), (-1.0, 90.0, -18.0), 45.0),
}


def setup_light(collection):
    sun_data = bpy.data.lights.new('sun', 'SUN')
    sun_data.energy = 4.2
    sun_data.color = Mt.hex_lin('#FFD7A0')
    sun_data.angle = math.radians(1.5)
    sun = bpy.data.objects.new('sun', sun_data)
    sun.rotation_euler = (-TO_SUN).to_track_quat('-Z', 'Y').to_euler()
    collection.objects.link(sun)
    world = bpy.context.scene.world or bpy.data.worlds.new('World')
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes.get('Background') or nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Color'].default_value = (*Mt.hex_lin('#7F8CC0'), 1.0)   # blue-violet sky fill
    bg.inputs['Strength'].default_value = 0.9
    return sun


def camera(name, collection):
    pos, target, fov = VIEWS[name]
    cd = bpy.data.cameras.new(name)
    cd.sensor_fit = 'VERTICAL'
    cd.angle = math.radians(fov)
    cd.clip_start = 0.1
    cd.clip_end = 5000
    cam = bpy.data.objects.new(name, cd)
    cam.location = pos
    d = Vector(target) - Vector(pos)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    collection.objects.link(cam)
    return cam


def render(name, collection, path, res=(1920, 1080), samples=96):
    scene = bpy.context.scene
    cam = bpy.data.objects.get(name) or camera(name, collection)
    scene.camera = cam
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast' if 'AgX - Medium High Contrast' in [
        i.identifier for i in scene.view_settings.bl_rna.properties['look'].enum_items] else 'None'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.render.render(write_still=True)
