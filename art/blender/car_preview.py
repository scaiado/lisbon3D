"""Studio previews of the microcar on its own: side profile, front and rear three-quarters, and a backface-culled
check that catches faces pointing the wrong way (they would vanish in the engine).

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python art/blender/car_preview.py -- [--cull]

Writes art/blender/out/car/*.png.
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from lisbon import textures, microcar, geo, materials as Mt  # noqa: E402

OUT = os.path.join(HERE, 'out', 'car')
os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(HERE, 'out', 'textures'), exist_ok=True)
textures.OUT = os.path.join(HERE, 'out', 'textures')
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
c = bpy.data.collections.new('car')
scene.collection.children.link(c)
car = microcar.build(c)
from lisbon import bake  # noqa: E402
bake.fill_white(car)
print('[car] triangles', geo.tri_count(car))

ground = bpy.data.meshes.new('ground')
ground.from_pydata([(-20, -20, 0), (20, -20, 0), (20, 20, 0), (-20, 20, 0)], [], [(0, 1, 2, 3)])
g = bpy.data.objects.new('ground', ground)
c.objects.link(g)
gm = bpy.data.materials.new('ground')
gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*Mt.hex_lin('#D8CCB4'), 1)
ground.materials.append(gm)

sun_d = bpy.data.lights.new('sun', 'SUN')
sun_d.energy = 4.0
sun_d.color = Mt.hex_lin('#FFD7A0')
sun = bpy.data.objects.new('sun', sun_d)
sun.rotation_euler = (Vector((0.6, -0.5, -0.62))).to_track_quat('-Z', 'Y').to_euler()
c.objects.link(sun)
world = bpy.data.worlds.new('w')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (*Mt.hex_lin('#8A94C4'), 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.2

SHOTS = {
    'side': ((6.5, 0.0, 0.75), (0, 0, 0.72), 22),
    'front34': ((4.2, 4.6, 1.6), (0, 0.1, 0.7), 26),
    'rear34': ((-4.0, -4.8, 1.9), (0, -0.1, 0.75), 26),
    'chase': ((0.0, -5.0, 2.0), (0, 1.0, 0.6), 50),
}
cull = '--cull' in argv
for name, (pos, tgt, fov) in SHOTS.items():
    cd = bpy.data.cameras.new(name)
    cd.sensor_fit = 'VERTICAL'
    cd.angle = math.radians(fov)
    cam = bpy.data.objects.new(name, cd)
    cam.location = pos
    cam.rotation_euler = (Vector(tgt) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
    c.objects.link(cam)
    scene.camera = cam
    if cull:
        scene.render.engine = 'BLENDER_WORKBENCH'
        scene.display.shading.show_backface_culling = True
        scene.display.shading.color_type = 'MATERIAL'
    else:
        scene.render.engine = 'CYCLES'
        scene.cycles.device = 'CPU'
        scene.cycles.samples = 48
        scene.cycles.use_denoising = True
        scene.view_settings.view_transform = 'AgX'
    scene.render.resolution_x, scene.render.resolution_y = 1200, 700
    scene.render.filepath = os.path.join(OUT, name + ('_cull' if cull else '') + '.png')
    bpy.ops.render.render(write_still=True)
    print('[car] rendered', name)
