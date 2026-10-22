"""Bakes the drivable ground and the collision map of the Bica from the raw Blender export.

    python tools/bake_collision.py art/exports/bica.glb public/assets/play/bica_collision.bin

Needs Python 3 with numpy only. The output is a small binary the game loads next to bica.glb:

    header (little-endian): magic 'LBCM', version u32, nx u32, nz u32, x0 f32, z0 f32, cell f32
    floor   nx*nz int16   ground height in centimetres (glTF y), or -32768 where there is no drivable ground
    sdf     nx*nz int8    signed distance to the nearest obstacle in units of 2 cm (+ free, - inside), clamped ±127

Cells are row-major with x fastest; cell (i, k) covers x0 + i*cell .. + cell, z0 + k*cell .. + cell (glTF axes:
x east, y up, z = -Blender y, so the street descends toward -z).

Every triangle of the street, buildings and people is sampled densely. Relative to the authored ground at that point
(the street.py formulas, copied below), a sample within ground - 0.6 .. + 0.4 m is drivable ground (road, kerbs,
pavement treads, door steps); a sample from + 0.4 m up to + 2.0 m is an obstacle (walls, bollards, café tables,
people). Anything higher (balconies, awnings, wires) is overhead and ignored. Cells that end up with no ground at all
(inside buildings, beyond the modelled area) are obstacles too. The funicular is left out: it moves, and the game
collides with it separately. Animals are left out so the car never stops dead for a pigeon.
"""
import json
import math
import struct
import sys

import numpy as np

# ---- street.py (art/blender/lisbon/street.py): keep in sync -----------------------------------------------------
SLOPE, EASE, ROAD_HW, STEP, KERB_H = 0.18, 6.0, 1.7, 1.0, 0.12
FACADE_X, CROSS_Y0, CROSS_Y1, CROSS_PAVE = 3.1, -11.0, 0.0, 1.8


def road_z(y):
    y = np.asarray(y, dtype=np.float64)
    return np.where(y <= 0, 0.0, np.where(y < EASE, -SLOPE * y * y / (2 * EASE), -SLOPE * (y - EASE / 2)))


def ground_z(x, y):
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    pave = road_z((np.floor(y / STEP) + 1) * STEP) + KERB_H
    pave = np.where(y < 0, KERB_H, pave)
    street = np.where(np.abs(x) <= ROAD_HW, road_z(y), pave)
    cross_road = (np.abs(x) < FACADE_X) & (y > CROSS_Y0 + CROSS_PAVE) & (y < CROSS_Y1 - CROSS_PAVE)
    cross = np.where(cross_road, 0.0, KERB_H)
    return np.where((y < 0) & (y >= CROSS_Y0), cross, street)
# -------------------------------------------------------------------------------------------------------------------

CELL = 0.2
X0, X1 = -28.0, 28.0
Z0, Z1 = -128.0, 14.0          # glTF z; Blender y = -z runs -14 .. 128
FLOOR_BELOW, FLOOR_ABOVE, OBSTACLE_TOP = 0.6, 0.4, 2.0
SKIP = ('backdrop', 'midground', 'river', 'funicular', 'props_animals')
SDF_UNIT = 0.02
SDF_RADIUS = 2.5


def read_glb(path):
    data = open(path, 'rb').read()
    json_len = struct.unpack_from('<I', data, 12)[0]
    gltf = json.loads(data[20:20 + json_len])
    bin_start = 20 + json_len + 8
    blob = data[bin_start:]
    comps = {5126: ('<f4', 4), 5125: ('<u4', 4), 5123: ('<u2', 2), 5121: ('<u1', 1)}
    sizes = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

    def accessor(index):
        acc = gltf['accessors'][index]
        view = gltf['bufferViews'][acc['bufferView']]
        dtype, size = comps[acc['componentType']]
        n = sizes[acc['type']]
        offset = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
        stride = view.get('byteStride', size * n)
        raw = np.frombuffer(blob, dtype=np.uint8, count=stride * (acc['count'] - 1) + size * n, offset=offset)
        if stride == size * n:
            return np.frombuffer(raw.tobytes(), dtype=dtype).reshape(acc['count'], n)
        rows = np.lib.stride_tricks.as_strided(raw, (acc['count'], size * n), (stride, 1))
        return np.frombuffer(rows.copy().tobytes(), dtype=dtype).reshape(acc['count'], n)

    for node in gltf['nodes']:
        name = node.get('name', '')
        if 'mesh' not in node or name.startswith(SKIP):
            continue
        assert not any(k in node for k in ('translation', 'rotation', 'scale', 'matrix')), name
        for prim in gltf['meshes'][node['mesh']]['primitives']:
            pos = accessor(prim['attributes']['POSITION']).astype(np.float64)
            idx = accessor(prim['indices']).reshape(-1).astype(np.int64)
            yield name, pos[idx.reshape(-1, 3)]


def sample(tris, step=0.08):
    """Dense barycentric samples over each triangle, grouped by subdivision count."""
    edges = np.stack([np.linalg.norm(tris[:, 1] - tris[:, 0], axis=1), np.linalg.norm(tris[:, 2] - tris[:, 1], axis=1),
                      np.linalg.norm(tris[:, 0] - tris[:, 2], axis=1)], 1).max(1)
    counts = np.maximum(1, np.ceil(edges / step)).astype(np.int64)
    for n in np.unique(counts):
        group = tris[counts == n]
        a, b = np.meshgrid(np.arange(n + 1), np.arange(n + 1), indexing='ij')
        keep = a + b <= n
        u = (a[keep] / n)[:, None]
        v = (b[keep] / n)[:, None]
        w = 1 - u - v
        for start in range(0, len(group), max(1, 4_000_000 // len(u))):
            g = group[start:start + max(1, 4_000_000 // len(u))]
            pts = w[None] * g[:, None, 0] + u[None] * g[:, None, 1] + v[None] * g[:, None, 2]
            yield pts.reshape(-1, 3)


def main(src, out):
    nx, nz = round((X1 - X0) / CELL), round((Z1 - Z0) / CELL)
    floor = np.full(nx * nz, -np.inf)
    blocked = np.zeros(nx * nz, dtype=bool)
    total = 0
    for name, tris in read_glb(src):
        lo, hi = tris.min(1), tris.max(1)
        inside = (hi[:, 0] >= X0) & (lo[:, 0] <= X1) & (hi[:, 2] >= Z0) & (lo[:, 2] <= Z1)
        centre = tris.mean(1)
        g = ground_z(centre[:, 0], -centre[:, 2])
        near = (lo[:, 1] <= g + OBSTACLE_TOP + 1.0) & (hi[:, 1] >= g - FLOOR_BELOW - 1.0)
        tris = tris[inside & near]
        for pts in sample(tris):
            x, h, z = pts[:, 0], pts[:, 1], pts[:, 2]
            ok = (x >= X0) & (x < X1) & (z >= Z0) & (z < Z1)
            x, h, z = x[ok], h[ok], z[ok]
            cell = ((z - Z0) / CELL).astype(np.int64) * nx + ((x - X0) / CELL).astype(np.int64)
            rel = h - ground_z(x, -z)
            ground = (rel >= -FLOOR_BELOW) & (rel <= FLOOR_ABOVE)
            np.maximum.at(floor, cell[ground], h[ground])
            obstacle = (rel > FLOOR_ABOVE) & (rel <= OBSTACLE_TOP)
            blocked[cell[obstacle]] = True
            total += len(h)
    blocked |= ~np.isfinite(floor)
    print(f'{total / 1e6:.1f} M samples, {blocked.mean() * 100:.1f} % of cells blocked')

    mask = blocked.reshape(nz, nx)
    sdf = signed_distance(mask)
    floor_cm = np.where(np.isfinite(floor), np.round(floor * 100), -32768).astype('<i2')
    sdf_q = np.clip(np.round(sdf / SDF_UNIT), -127, 127).astype('i1')
    with open(out, 'wb') as f:
        f.write(b'LBCM' + struct.pack('<IIIfff', 1, nx, nz, X0, Z0, CELL))
        f.write(floor_cm.tobytes())
        f.write(sdf_q.reshape(-1).tobytes())
    print(f'wrote {out}: {nx} x {nz} cells of {CELL} m')


def distance_to(mask):
    """Distance (m) from every cell centre to the nearest cell where mask is true, exact up to SDF_RADIUS."""
    r = math.ceil(SDF_RADIUS / CELL)
    nz, nx = mask.shape
    padded = np.pad(mask, r, constant_values=False)
    best = np.full(mask.shape, SDF_RADIUS)
    for dz in range(-r, r + 1):
        for dx in range(-r, r + 1):
            d = math.hypot(dx, dz) * CELL
            if d >= SDF_RADIUS:
                continue
            shifted = padded[r + dz:r + dz + nz, r + dx:r + dx + nx]
            best = np.where(shifted & (d < best), d, best)
    return best


def signed_distance(blocked):
    """Positive in free space (distance to the nearest obstacle edge), negative inside obstacles."""
    outside = distance_to(blocked) - CELL / 2
    inside = distance_to(~blocked) - CELL / 2
    return np.where(blocked, -inside, outside)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
