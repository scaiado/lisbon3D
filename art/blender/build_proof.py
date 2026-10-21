"""Build the Bica-to-Tejo proof scene and the hero microcar.

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python art/blender/build_proof.py

Options after `--`:
    --only w01,e01      build only these buildings (name prefixes); default all
    --no-bake           skip the AO bake (fast preview)
    --no-export         skip the glTF export
    --render v1,v2,v3   Cycles target renders of the review views (art/renders/)
    --preview           renders at 960x540 with fewer samples into out/previews instead
    --samples N         render samples (default 96)

Writes art/blender/out/proof.blend, art/exports/bica.glb and art/exports/microcar.glb.
"""
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))

import bpy  # noqa: E402

from lisbon import textures, recipes, buildings, street, bake, scene_setup, geo  # noqa: E402
from lisbon import funicular, backdrop, microcar, life  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def opt(name, default=None):
    if name in argv:
        i = argv.index(name)
        return argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith('--') else True
    return default


OUT = os.path.join(HERE, 'out')
EXPORTS = os.path.join(ROOT, 'art', 'exports')
RENDERS = os.path.join(ROOT, 'art', 'renders')
for d in (OUT, os.path.join(OUT, 'textures'), EXPORTS):
    os.makedirs(d, exist_ok=True)
textures.OUT = os.path.join(OUT, 'textures')

LOG = []


def log(*a):
    s = ' '.join(str(x) for x in a)
    LOG.append(s)
    print('[proof]', s, flush=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    return scene


def coll(name):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(c)
    return c


def stats(objs):
    tris = sum(geo.tri_count(o) for o in objs)
    prims = sum(len({p.material_index for p in o.data.polygons}) for o in objs)
    return tris, prims


def export(objs, path):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_vertex_color='ACTIVE', export_lights=False,
                              export_cameras=False, export_image_format='AUTO', export_materials='EXPORT',
                              export_extras=False)
    from lisbon import glb_pack
    n = glb_pack.pack_colors(path)
    log('exported %s (%.1f MB, %d colour accessors packed to 8-bit)' % (os.path.relpath(path, ROOT), os.path.getsize(path) / 1e6, n))


def main():
    t0 = time.time()
    reset()
    scene_c = coll('scene')
    only = opt('--only')
    only = only.split(',') if isinstance(only, str) else None

    objs = []
    t = time.time()
    objs.append(street.build(scene_c))
    log('street: %.1fs' % (time.time() - t))

    for r in recipes.all_recipes():
        if only and not any(r['name'].startswith(p) for p in only):
            continue
        t = time.time()
        obj, info = buildings.build(r, scene_c, detail=r.get('detail', 2))
        objs.append(obj)
        log('%s: %d tris, %.1fs' % (obj.name, geo.tri_count(obj), time.time() - t))

    if not only:
        t = time.time()
        objs.append(funicular.build(scene_c))
        far = backdrop.build(scene_c)
        objs.extend(life.build(scene_c))
        log('funicular + mid-ground + backdrop: %.1fs' % (time.time() - t))
    else:
        far = []
    cards = [o for o in far if o.name.startswith('backdrop')]
    objs.extend(o for o in far if o not in cards)

    if not opt('--no-bake'):
        bake.bake_ao(objs, log=log)
    else:
        for o in objs:
            bake.fill_white(o)
    for o in cards:
        bake.fill_white(o)
    objs.extend(cards)

    tris, prims = stats(objs)
    log('scene: %d objects, %d primitives (mesh x material), %d triangles' % (len(objs), prims, tris))

    if not opt('--no-export'):
        export(objs, os.path.join(EXPORTS, 'bica.glb'))

    # hero microcar: built and baked on its own, far above the street so the street doesn't occlude it
    car_c = coll('microcar')
    car = microcar.build(car_c)
    car.location = (0.0, 0.0, 500.0)
    if not opt('--no-bake'):
        bake.bake_ao([car], log=log)
    else:
        bake.fill_white(car)
    car.location = (0.0, 0.0, 0.0)
    log('microcar: %d tris' % geo.tri_count(car))
    if not opt('--no-export'):
        export([car], os.path.join(EXPORTS, 'microcar.glb'))
    # park it where the engine's chase view puts it, for the Cycles target renders
    car.location = (1.1, 7.0, street.road_z(7.0))
    car.rotation_euler = (-math.atan(street.SLOPE), 0.0, 0.0)

    rv = opt('--render')
    if rv:
        light_c = coll('lights_cameras')
        scene_setup.setup_light(light_c)
        preview = bool(opt('--preview'))
        samples = int(opt('--samples', 32 if preview else 96))
        names = {'v1': 'view1_chase', 'v2': 'view2_facade', 'v3': 'view3_establishing', 'v4': 'view4_carside'}
        for k in rv.split(','):
            name = names.get(k, k)
            t = time.time()
            if preview:
                path = os.path.join(OUT, 'previews', name + '.png')
                scene_setup.render(name, light_c, path, res=(960, 540), samples=samples)
            else:
                path = os.path.join(RENDERS, name + '_blender_target.png')
                scene_setup.render(name, light_c, path, samples=samples)
            log('render %s: %.1fs' % (name, time.time() - t))

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'proof.blend'), compress=True)
    log('total %.1fs' % (time.time() - t0))


main()
