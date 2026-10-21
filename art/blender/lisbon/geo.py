"""Mesh building helpers.

MeshBuilder collects faces per material in world space (through a transform stack) and turns them
into one Blender object per building (or per prop group), with one material slot per material.
Faces without explicit UVs get world-space box-projected UVs scaled per material (see materials.TILE).
Faces added with bevel=True get bevel weight on their edges so a single Bevel modifier rounds every
hard edge of the masonry and joinery while thin ironwork stays crisp.
"""
import math
import bmesh
import bpy
from mathutils import Matrix, Vector

from . import materials as M


def rot_z(deg):
    return Matrix.Rotation(math.radians(deg), 4, 'Z')


def rot_x(deg):
    return Matrix.Rotation(math.radians(deg), 4, 'X')


def rot_y(deg):
    return Matrix.Rotation(math.radians(deg), 4, 'Y')


def tr(x, y, z):
    return Matrix.Translation((x, y, z))


def scl(x, y, z):
    return Matrix.Diagonal((x, y, z, 1.0))


class MeshBuilder:
    def __init__(self):
        self.verts = []          # world-space Vectors
        self.faces = []          # (vertex index tuple, material name, uv tuple or None, bevel flag, smooth flag)
        self.stack = [Matrix.Identity(4)]

    # ---- transform stack -------------------------------------------------
    @property
    def m(self):
        return self.stack[-1]

    def push(self, mat):
        self.stack.append(self.stack[-1] @ mat)
        return self

    def pop(self):
        self.stack.pop()

    class _Ctx:
        def __init__(self, mb, mat):
            self.mb, self.mat = mb, mat

        def __enter__(self):
            self.mb.push(self.mat)
            return self.mb

        def __exit__(self, *a):
            self.mb.pop()

    def at(self, mat):
        """with mb.at(tr(...) @ rot_z(...)): ..."""
        return MeshBuilder._Ctx(self, mat)

    # ---- primitives -------------------------------------------------------
    def poly(self, mat, pts, uvs=None, bevel=False, smooth=False):
        base = len(self.verts)
        m = self.m
        for p in pts:
            self.verts.append(m @ Vector(p))
        self.faces.append((tuple(range(base, base + len(pts))), mat, uvs, bevel, smooth))

    def quad(self, mat, a, b, c, d, uvs=None, bevel=False, smooth=False):
        self.poly(mat, (a, b, c, d), uvs, bevel, smooth)

    def box(self, mat, mn, mx, bevel=True, skip=(), smooth=False):
        """Axis-aligned box (in the current frame). skip: faces to omit, any of '-x +x -y +y -z +z'."""
        x0, y0, z0 = mn
        x1, y1, z1 = mx
        if x1 < x0: x0, x1 = x1, x0
        if y1 < y0: y0, y1 = y1, y0
        if z1 < z0: z0, z1 = z1, z0
        P = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
             (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
        F = {'-z': (0, 3, 2, 1), '+z': (4, 5, 6, 7), '-y': (0, 1, 5, 4),
             '+y': (2, 3, 7, 6), '-x': (3, 0, 4, 7), '+x': (1, 2, 6, 5)}
        base = len(self.verts)
        m = self.m
        for p in P:
            self.verts.append(m @ Vector(p))
        for k, f in F.items():
            if k in skip:
                continue
            self.faces.append((tuple(base + i for i in f), mat, None, bevel, smooth))

    def prism(self, mat, profile, x0, x1, bevel=True, caps=True, smooth=False):
        """Extrude a 2D profile [(y, z), ...] (counter-clockwise seen from +x) along x from x0 to x1."""
        n = len(profile)
        base = len(self.verts)
        m = self.m
        for x in (x0, x1):
            for (y, z) in profile:
                self.verts.append(m @ Vector((x, y, z)))
        for i in range(n):
            j = (i + 1) % n
            self.faces.append(((base + i, base + j, base + n + j, base + n + i), mat, None, bevel, smooth))
        if caps:
            self.faces.append((tuple(base + i for i in reversed(range(n))), mat, None, bevel, smooth))
            self.faces.append((tuple(base + n + i for i in range(n)), mat, None, bevel, smooth))

    def cyl(self, mat, p0, p1, r, seg=8, caps=True, r1=None, smooth=True, bevel=False):
        """Cylinder (or cone frustum) between two points in the current frame."""
        p0, p1 = Vector(p0), Vector(p1)
        axis = p1 - p0
        if axis.length < 1e-6:
            return
        r1 = r if r1 is None else r1
        q = axis.to_track_quat('Z', 'Y')
        rm = q.to_matrix().to_4x4()
        base = len(self.verts)
        m = self.m
        for k, (c, rr) in enumerate(((p0, r), (p1, r1))):
            for i in range(seg):
                a = 2 * math.pi * i / seg
                local = rm @ Vector((math.cos(a) * rr, math.sin(a) * rr, 0.0))
                self.verts.append(m @ (c + local.to_3d()))
        for i in range(seg):
            j = (i + 1) % seg
            self.faces.append(((base + i, base + j, base + seg + j, base + seg + i), mat, None, bevel, smooth))
        if caps:
            self.faces.append((tuple(base + i for i in reversed(range(seg))), mat, None, bevel, False))
            self.faces.append((tuple(base + seg + i for i in range(seg)), mat, None, bevel, False))

    def tube(self, mat, pts, r, seg=6, smooth=True):
        """Polyline tube (ironwork scrolls, cables)."""
        for a, b in zip(pts[:-1], pts[1:]):
            self.cyl(mat, a, b, r, seg=seg, caps=False, smooth=smooth)

    def sphere(self, mat, c, r, seg=10, rings=6, sz=None, smooth=True):
        cx, cy, cz = c
        sx, sy, szz = (r, r, r) if sz is None else sz
        base = len(self.verts)
        m = self.m
        self.verts.append(m @ Vector((cx, cy, cz - szz)))
        for j in range(1, rings):
            t = math.pi * j / rings - math.pi / 2
            for i in range(seg):
                a = 2 * math.pi * i / seg
                self.verts.append(m @ Vector((cx + math.cos(t) * math.cos(a) * sx,
                                              cy + math.cos(t) * math.sin(a) * sy,
                                              cz + math.sin(t) * szz)))
        top = len(self.verts)
        self.verts.append(m @ Vector((cx, cy, cz + szz)))
        for i in range(seg):
            j = (i + 1) % seg
            self.faces.append(((base, base + 1 + j, base + 1 + i), mat, None, False, smooth))
        for r_ in range(rings - 2):
            o = base + 1 + r_ * seg
            for i in range(seg):
                j = (i + 1) % seg
                self.faces.append(((o + i, o + j, o + seg + j, o + seg + i), mat, None, False, smooth))
        o = base + 1 + (rings - 2) * seg
        for i in range(seg):
            j = (i + 1) % seg
            self.faces.append(((o + i, o + j, top), mat, None, False, smooth))

    def grid(self, mat, nu, nv, fn, uvfn=None, smooth=True, bevel=False, keep=None):
        """Parametric surface: fn(i, j) -> (x, y, z) for i in 0..nu, j in 0..nv."""
        base = len(self.verts)
        m = self.m
        for j in range(nv + 1):
            for i in range(nu + 1):
                self.verts.append(m @ Vector(fn(i, j)))
        w = nu + 1
        for j in range(nv):
            for i in range(nu):
                if keep is not None and not keep(i, j):
                    continue
                idx = (base + j * w + i, base + j * w + i + 1, base + (j + 1) * w + i + 1, base + (j + 1) * w + i)
                uvs = None
                if uvfn:
                    uvs = (uvfn(i, j), uvfn(i + 1, j), uvfn(i + 1, j + 1), uvfn(i, j + 1))
                self.faces.append((idx, mat, uvs, bevel, smooth))

    def panel(self, mat, x0, x1, z0, z1, y=0.0, step=0.6, normal='-y'):
        """Subdivided flat wall panel in the xz plane facing -y (or +y), so vertex AO has resolution."""
        nu = max(1, math.ceil((x1 - x0) / step))
        nv = max(1, math.ceil((z1 - z0) / step))
        if normal == '-y':
            fn = lambda i, j: (x0 + (x1 - x0) * i / nu, y, z0 + (z1 - z0) * j / nv)
        else:
            fn = lambda i, j: (x1 - (x1 - x0) * i / nu, y, z0 + (z1 - z0) * j / nv)
        self.grid(mat, nu, nv, fn, smooth=False)

    def merge(self, other):
        base = len(self.verts)
        self.verts.extend(other.verts)
        for f, mat, uv, bv, sm in other.faces:
            self.faces.append((tuple(i + base for i in f), mat, uv, bv, sm))

    # ---- post transforms ---------------------------------------------------
    def deform(self, fn, start=0):
        """Apply fn(Vector)->Vector to all vertices from index start (e.g. wall lean / bow)."""
        for i in range(start, len(self.verts)):
            self.verts[i] = fn(self.verts[i])

    # ---- output -------------------------------------------------------------
    def build(self, name, collection, bevel_width=0.025, bevel_segments=1, smooth_angle=35.0, origin=None):
        if not self.faces:
            return None
        mats = []
        for _, mat, _, _, _ in self.faces:
            if mat not in mats:
                mats.append(mat)
        mesh = bpy.data.meshes.new(name)
        bm = bmesh.new()
        bverts = [bm.verts.new(v) for v in self.verts]
        uv_layer = bm.loops.layers.uv.new('UVMap')
        bw = bm.edges.layers.float.new('bevel_weight_edge')
        for idx, mat, uvs, bev, smooth in self.faces:
            try:
                f = bm.faces.new([bverts[i] for i in idx])
            except ValueError:
                continue  # duplicate face
            f.material_index = mats.index(mat)
            f.smooth = smooth
            if uvs is None:
                f.normal_update()
                n = f.normal
                t = M.tile_size(mat)
                ax = max(range(3), key=lambda k: abs(n[k]))
                for l in f.loops:
                    co = l.vert.co
                    if ax == 2:
                        u, v = co.x, co.y * (1 if n.z > 0 else -1)
                    elif ax == 0:
                        u, v = co.y * (1 if n.x > 0 else -1), co.z
                    else:
                        u, v = -co.x * (1 if n.y > 0 else -1), co.z
                    l[uv_layer].uv = (u / t, v / t)
            else:
                for l, uv in zip(f.loops, uvs):
                    l[uv_layer].uv = uv
            if bev:
                for e in f.edges:
                    e[bw] = 1.0
        mark_sharp(bm, smooth_angle)
        bm.to_mesh(mesh)
        bm.free()
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
        for mname in mats:
            mesh.materials.append(M.get(mname))
        if bevel_width > 0 and any(f[3] for f in self.faces):
            mod = obj.modifiers.new('bevel', 'BEVEL')
            mod.width = bevel_width
            mod.segments = bevel_segments
            mod.limit_method = 'WEIGHT'
            mod.miter_outer = 'MITER_ARC'
            mod.use_clamp_overlap = True
            mod.harden_normals = True
            apply_modifiers(obj)
        if origin is not None:
            set_origin(obj, origin)
        return obj


def apply_modifiers(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    mesh = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    old = obj.data
    obj.modifiers.clear()
    obj.data = mesh
    mesh.name = old.name
    bpy.data.meshes.remove(old)


def mark_sharp(bm, angle_deg):
    """Faces flagged smooth stay smooth; edges sharper than angle_deg, or touching a flat face, are sharp."""
    bm.normal_update()
    lim = math.radians(angle_deg)
    for e in bm.edges:
        if len(e.link_faces) == 2:
            a, b = e.link_faces
            if a.normal.angle(b.normal, 0.0) > lim or not (a.smooth and b.smooth):
                e.smooth = False
        else:
            e.smooth = False
    # every face smooth; flatness comes from the sharp edges
    for f in bm.faces:
        f.smooth = True


def set_origin(obj, origin):
    o = Vector(origin)
    obj.data.transform(Matrix.Translation(-o))
    obj.location = o


def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)
