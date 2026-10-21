"""Post-export GLB tidy-up with no dependencies: store COLOR_0 (baked AO and tints) as normalized 8-bit RGBA
instead of 32-bit floats, then repack the binary buffer. Standard glTF 2.0, no extension needed."""
import json
import struct

import numpy as np

FLOAT, UBYTE = 5126, 5121
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def _read(path):
    data = open(path, 'rb').read()
    jlen = struct.unpack('<I', data[12:16])[0]
    j = json.loads(data[20:20 + jlen])
    off = 20 + jlen
    blen = struct.unpack('<I', data[off:off + 4])[0]
    return j, bytearray(data[off + 8:off + 8 + blen])


def pack_colors(path):
    j, binbuf = _read(path)
    views = j['bufferViews']
    new_chunks = []          # list of (bytes, view dict) in the new buffer order
    view_bytes = [bytes(binbuf[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]) for v in views]
    replaced = {}
    for m in j['meshes']:
        for p in m['primitives']:
            ai = p['attributes'].get('COLOR_0')
            if ai is None or ai in replaced:
                continue
            acc = j['accessors'][ai]
            if acc['componentType'] != FLOAT:
                continue
            n, c = acc['count'], NCOMP[acc['type']]
            v = views[acc['bufferView']]
            stride = v.get('byteStride', 4 * c)
            raw = np.frombuffer(view_bytes[acc['bufferView']], np.uint8)
            start = acc.get('byteOffset', 0)
            rows = np.lib.stride_tricks.as_strided(raw[start:], (n, 4 * c), (stride, 1)).copy()
            f = rows.view(np.float32).reshape(n, c)
            out = np.full((n, 4), 255, np.uint8)
            out[:, :c] = np.clip(np.round(f[:, :min(c, 4)] * 255), 0, 255).astype(np.uint8)
            views.append({'buffer': 0, 'byteLength': out.nbytes, 'target': 34962})
            view_bytes.append(out.tobytes())
            acc.update(bufferView=len(views) - 1, byteOffset=0, componentType=UBYTE, normalized=True, type='VEC4')
            acc.pop('min', None)
            acc.pop('max', None)
            replaced[ai] = True
    # repack only the views still referenced
    used = set()
    for a in j['accessors']:
        if 'bufferView' in a:
            used.add(a['bufferView'])
    for im in j.get('images', []):
        if 'bufferView' in im:
            used.add(im['bufferView'])
    remap = {}
    blob = bytearray()
    new_views = []
    for i, v in enumerate(views):
        if i not in used:
            continue
        while len(blob) % 4:
            blob.append(0)
        nv = dict(v)
        nv['byteOffset'] = len(blob)
        nv['byteLength'] = len(view_bytes[i])
        blob += view_bytes[i]
        remap[i] = len(new_views)
        new_views.append(nv)
    while len(blob) % 4:
        blob.append(0)
    for a in j['accessors']:
        if 'bufferView' in a:
            a['bufferView'] = remap[a['bufferView']]
    for im in j.get('images', []):
        if 'bufferView' in im:
            im['bufferView'] = remap[im['bufferView']]
    j['bufferViews'] = new_views
    j['buffers'] = [{'byteLength': len(blob)}]
    js = json.dumps(j, separators=(',', ':')).encode()
    while len(js) % 4:
        js += b' '
    total = 12 + 8 + len(js) + 8 + len(blob)
    with open(path, 'wb') as fh:
        fh.write(struct.pack('<III', 0x46546C67, 2, total))
        fh.write(struct.pack('<I', len(js)) + b'JSON' + js)
        fh.write(struct.pack('<I', len(blob)) + b'BIN\x00' + bytes(blob))
    return len(replaced)
