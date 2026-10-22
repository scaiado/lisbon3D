"""Geometry check without Blender: runs the kit builders with stub bpy/bmesh modules and writes a clay GLB
(flat material colours, no textures, no bevels, no AO) plus <out>-microcar.glb.

Needs only Python 3.13 with numpy and mathutils (pip install numpy mathutils), so shapes can be checked in an
environment without Blender. The real assets always come from build_proof.py in Blender.

    python art/blender/clay_preview.py . /tmp/clay.glb [street buildings funicular backdrop microcar]
"""
import json, math, os, struct, sys, time, types

repo, out = sys.argv[1], sys.argv[2]
what = sys.argv[3:] or ['street', 'buildings', 'funicular', 'backdrop', 'microcar']
sys.modules['bpy'] = types.ModuleType('bpy')
sys.modules['bmesh'] = types.ModuleType('bmesh')
sys.path.insert(0, os.path.join(repo, 'art', 'blender'))
import numpy as np
from lisbon import geo, materials as M

OBJECTS = []

class Obj:
    def __init__(self, name, mb):
        self.name, self.mb = name, mb

def fake_build(self, name, collection, **kw):
    o = Obj(name, self)
    OBJECTS.append(o)
    return o
geo.MeshBuilder.build = fake_build
geo.tri_count = lambda o: sum(len(f[0]) - 2 for f in o.mb.faces)

def colour(mat):
    d = M.DEF.get(mat, {})
    h = d.get('tint') or d.get('color')
    if not h:
        h = {'lioz': '#E6D7BC', 'granite': '#9A958C', 'setts': '#8E8478', 'calcada': '#E9E2D2', 'roof_tile': '#B8552E',
             'azulejo_blue': '#4F7DB0', 'azulejo_lattice': '#6F93C0', 'azulejo_green': '#4E8A6E', 'glass': '#33424C',
             'signs': '#C9A35A', 'fabric': '#C6533C', 'foliage': '#5E7F3A', 'river': '#9CC3CF', 'car_box': '#F1E6CC',
             'backdrop_far_shore': '#C9AFA6', 'backdrop_bridge': '#A8706A', 'far_roof': '#B8552E'}.get(mat, '#FF00FF')
    h = h.lstrip('#')
    return [M.srgb_to_lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)] + [1.0]

def write_glb(path, objs):
    bin_ = bytearray(); views = []; accs = []; meshes = []; nodes = []; mats = []; mat_index = {}
    def add(arr, target, comp, typ, minmax=False):
        off = len(bin_); data = arr.astype(np.float32 if comp == 5126 else np.uint32).tobytes()
        bin_.extend(data); bin_.extend(b'\0' * ((4 - len(data) % 4) % 4))
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data), 'target': target})
        a = {'bufferView': len(views) - 1, 'componentType': comp, 'count': len(arr), 'type': typ}
        if minmax: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
        accs.append(a); return len(accs) - 1
    for o in objs:
        V = np.array([tuple(v) for v in o.mb.verts], np.float64)
        prims = {}
        for idx, mat, uvs, bev, sm in o.mb.faces:
            tris = prims.setdefault(mat, [])
            for k in range(1, len(idx) - 1):
                tris.append((idx[0], idx[k], idx[k + 1]))
        P = []
        for mat, tris in prims.items():
            t = np.array(tris)
            pos = V[t.reshape(-1)].reshape(-1, 3, 3)
            n = np.cross(pos[:, 1] - pos[:, 0], pos[:, 2] - pos[:, 0])
            n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
            pos = pos.reshape(-1, 3); nor = np.repeat(n, 3, 0)
            # Blender Z-up -> glTF Y-up
            pos = np.stack([pos[:, 0], pos[:, 2], -pos[:, 1]], 1); nor = np.stack([nor[:, 0], nor[:, 2], -nor[:, 1]], 1)
            if mat not in mat_index:
                mat_index[mat] = len(mats)
                d = M.DEF.get(mat, {})
                mats.append({'name': mat, 'pbrMetallicRoughness': {'baseColorFactor': colour(mat), 'metallicFactor': d.get('metal', 0.0), 'roughnessFactor': d.get('rough', 0.8)}, 'doubleSided': True})
            P.append({'attributes': {'POSITION': add(pos, 34962, 5126, 'VEC3', True), 'NORMAL': add(nor, 34962, 5126, 'VEC3')}, 'material': mat_index[mat]})
        meshes.append({'name': o.name, 'primitives': P}); nodes.append({'name': o.name, 'mesh': len(meshes) - 1})
    gltf = {'asset': {'version': '2.0', 'generator': 'lisbon clay harness'}, 'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}],
            'nodes': nodes, 'meshes': meshes, 'materials': mats, 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(bin_)}]}
    js = json.dumps(gltf).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(bin_), 0x004E4942)); f.write(bin_)

t0 = time.time()
from lisbon import street, recipes, buildings
if 'street' in what: street.build(None)
if 'buildings' in what:
    for r in recipes.all_recipes():
        buildings.build(r, None, detail=r.get('detail', 2))
if 'funicular' in what:
    from lisbon import funicular; funicular.build(None); funicular.build_wire(None)
if 'backdrop' in what:
    from lisbon import backdrop; backdrop.build(None)
cars = []
if 'microcar' in what:
    from lisbon import microcar; microcar.build(None); cars = [OBJECTS.pop()]
for o in OBJECTS + cars:
    print('%-28s %8d tris' % (o.name, geo.tri_count(o)))
print('scene tris', sum(geo.tri_count(o) for o in OBJECTS), 'in %.1fs' % (time.time() - t0))
write_glb(out, OBJECTS)
if cars: write_glb(out.replace('.glb', '-microcar.glb'), cars)
