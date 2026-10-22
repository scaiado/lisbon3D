"""Lighting and review cameras for Blender target renders (not exported: the engine lights the scene)."""
import math
import os

import bpy
from mathutils import Vector

from . import street as S
from . import materials as Mt

# warm late-afternoon sun over the river, almost straight down the street, 34 degrees up, so light runs down the narrow
# street and grazes the west façades (any real sideways component leaves the street in shade); the engine uses the
# same direction (src/proof/look.ts)
_H = Vector((0.12, 0.99, 0.0)).normalized()
TO_SUN = Vector((_H.x * math.cos(math.radians(34)), _H.y * math.cos(math.radians(34)), math.sin(math.radians(34))))

VIEWS = {
    # name: (camera position, look-at target, vertical fov degrees)
    'view1_chase': ((0.35, -3.2, 2.25), (0.0, 40.0, -5.5), 50.0),
    'view2_facade': ((1.3, 9.2, S.pave_z(9.2) + 1.55), (-3.1, 14.6, S.pave_z(14.6) + 3.2), 50.0),
    # high over the top of the Bica, turned toward the bridge: street and roofs below, layered city, river, far shore
    'view3_establishing': ((-30.0, -40.0, 48.0), (115.0, 320.0, -49.0), 40.0),
    # the parked hatchback in side profile, from the west pavement
    'view4_carside': ((-2.6, 7.0, S.road_z(7.0) + 1.0), (0.85, 7.0, S.road_z(7.0) + 0.75), 55.0),
    # following the funicular down the hill: chase position ~6 m uphill of its rear end, 2 m above the road
    'view5_follow': ((0.0, 35.8, S.road_z(35.8) + 2.0), (0.0, 50.0, S.road_z(50.0) + 1.0), 55.0),
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
    sky_world(world)
    haze()
    return sun


def sky_world(world):
    """Camera rays see the painted 'sky' texture (mapped by azimuth / elevation); lighting rays get a
    blue-violet fill so the shade stays coloured."""
    from . import textures as T
    nt = world.node_tree
    nt.nodes.clear()
    n = nt.nodes.new
    tc = n('ShaderNodeTexCoord')
    sep = n('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    at = n('ShaderNodeMath'); at.operation = 'ARCTAN2'
    nt.links.new(sep.outputs['Y'], at.inputs[0]); nt.links.new(sep.outputs['X'], at.inputs[1])
    u = n('ShaderNodeMath'); u.operation = 'MULTIPLY_ADD'
    u.inputs[1].default_value = 1 / (2 * math.pi); u.inputs[2].default_value = 0.5
    nt.links.new(at.outputs[0], u.inputs[0])
    v = n('ShaderNodeMath'); v.operation = 'MAXIMUM'; v.inputs[1].default_value = 0.0
    nt.links.new(sep.outputs['Z'], v.inputs[0])
    comb = n('ShaderNodeCombineXYZ')
    nt.links.new(u.outputs[0], comb.inputs['X']); nt.links.new(v.outputs[0], comb.inputs['Y'])
    img = n('ShaderNodeTexImage'); img.image = T.get('sky'); img.extension = 'EXTEND'
    nt.links.new(comb.outputs[0], img.inputs['Vector'])
    bg_cam = n('ShaderNodeBackground'); bg_cam.inputs['Strength'].default_value = 1.0
    nt.links.new(img.outputs['Color'], bg_cam.inputs['Color'])
    bg_fill = n('ShaderNodeBackground'); bg_fill.inputs['Strength'].default_value = 1.35
    bg_fill.inputs['Color'].default_value = (*Mt.hex_lin('#7C84C8'), 1.0)   # cooler blue-violet sky fill (STYLE-C shade)
    lp = n('ShaderNodeLightPath')
    mix = n('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs['Fac'])
    nt.links.new(bg_fill.outputs[0], mix.inputs[1]); nt.links.new(bg_cam.outputs[0], mix.inputs[2])
    out = n('ShaderNodeOutputWorld')
    nt.links.new(mix.outputs[0], out.inputs['Surface'])


def haze(start=35.0, depth=900.0, amount=0.42, colour='#F3D2A6'):
    """Light warm atmospheric haze from the mist pass: nothing near the camera, building toward the river."""
    scene = bpy.context.scene
    scene.view_layers[0].use_pass_mist = True
    ms = scene.world.mist_settings
    ms.start, ms.depth, ms.falloff = start, depth, 'QUADRATIC'
    try:
        nt = bpy.data.node_groups.new('haze', 'CompositorNodeTree')
        nt.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
        rl = nt.nodes.new('CompositorNodeRLayers')
        rng = nt.nodes.new('ShaderNodeMapRange')
        rng.inputs['To Max'].default_value = amount
        nt.links.new(rl.outputs['Mist'], rng.inputs['Value'])
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        nt.links.new(rng.outputs['Result'], mix.inputs['Factor'])
        nt.links.new(rl.outputs['Image'], mix.inputs[6])
        mix.inputs[7].default_value = (*Mt.hex_lin(colour), 1.0)
        out = nt.nodes.new('NodeGroupOutput')
        nt.links.new(mix.outputs[2], out.inputs[0])
        scene.compositing_node_group = nt
        scene.render.use_compositing = True
    except Exception as e:  # compositor API differs between Blender versions; renders still work without haze
        print('[proof] haze compositor unavailable:', e)


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
