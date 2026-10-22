"""Building assembler: turns an authored recipe (see recipes.py) into one merged object per building
(one material slot per material), placed on the Bica.

Recipe keys:
  name, side ('W'|'E'), y0 (uphill end along the street), width, depth, family ('pombaline'|'bica'),
  plaster, shutters (wood material), door (wood material), joinery (sash colour)
  storeys: list of dict(h, bays) where bays is a string of tokens:
      W window, B balcony door with slab, J French window with juliet railing, D street door,
      S shopfront, s small window, - blank bay, P azulejo panel (ground floor)
  options: tiles=dict(mat, from_storey), cornice ('pombaline'|'bica'), beirado (bool), string_courses (bool),
      pilasters (bool), roof=dict(kind, pitch, chimneys=[(x, y)], dormers=[x...], aerials=[(x, y)]),
      shutter_states (string, one char per window: o open, c closed, h half, n none), corner (bool),
      signs={bay index: cell}, awnings={bay index: fabric cell}, laundry=[storey indices], pots (bool),
      lean (deg), bow (m), seed
"""
import math
import random

from mathutils import Matrix, Vector

from . import kit_facade as F
from . import kit_roof as R
from . import street as S
from .geo import MeshBuilder, tr, rot_z


def frame_for(recipe):
    """Local façade frame -> world matrix (without datum), and the world y of local x."""
    W = recipe['width']
    if recipe['side'] == 'W':
        M = tr(-S.FACADE_X, recipe['y0'], 0) @ rot_z(90)
        wy = lambda x: recipe['y0'] + x
    else:
        M = tr(S.FACADE_X, recipe['y0'] + W, 0) @ rot_z(-90)
        wy = lambda x: recipe['y0'] + W - x
    return M, wy


def bay_centres(W, n, margin):
    return [margin + (W - 2 * margin) * (k + 0.5) / n for k in range(n)]


def build(recipe, collection, detail=2):
    rnd = random.Random(recipe.get('seed', hash(recipe['name']) & 0xffff))
    fam = F.FAMILY[recipe['family']]
    W, D = recipe['width'], recipe['depth']
    M, wy = frame_for(recipe)
    sx = -S.FACADE_X if recipe['side'] == 'W' else S.FACADE_X
    uphill_y = recipe['y0']
    datum = S.ground_z(sx * 0.97, uphill_y + 0.05) + 0.06
    g = lambda x: S.ground_z(sx * 0.97, wy(min(max(x, 0.01), W - 0.01))) - datum

    mb = MeshBuilder()
    plaster = recipe['plaster']
    tiles = recipe.get('tiles')
    pil = 0.42 if recipe.get('pilasters', True) else 0.0
    storeys = recipe['storeys']
    zf = [0.0]
    for st in storeys:
        zf.append(zf[-1] + st['h'])
    H = zf[-1]
    g_min = min(g(x) for x in [i * 0.25 for i in range(int(W / 0.25) + 1)])
    z_bot = g_min - 0.5

    # ---------------------------------------------------------------- openings
    openings = []        # (storey, token, Opening)
    states = recipe.get('shutter_states', '')
    for si, st in enumerate(storeys):
        toks = st['bays'].split()
        xs = st.get('xs') or bay_centres(W, len(toks), pil + 0.35)
        for bi, (tok, cx) in enumerate(zip(toks, xs)):
            base = zf[si] if si > 0 else None
            if tok in ('W', 's'):
                w = fam['win_w'] if tok == 'W' else 0.62
                h = fam['win_h'] if tok == 'W' else 0.85
                if si == 0:
                    z0 = g(cx) + fam['sill'] + 0.15
                else:
                    z0 = zf[si] + fam['sill']
                if tok == 's':
                    z0 += 0.5
                h = min(h, zf[si + 1] - 0.45 - z0)
                o = F.Opening(cx - w / 2, cx + w / 2, z0, z0 + h, tok, fam['frame'])
            elif tok in ('B', 'J'):
                w = fam['win_w'] * 1.05
                z0 = zf[si] + 0.04
                h = min(fam['bal_h'], st['h'] - 0.55)
                o = F.Opening(cx - w / 2, cx + w / 2, z0, z0 + h, tok, fam['frame'])
            elif tok == 'D':
                z0 = g(cx) + 0.02
                top = min(z0 + fam['door_h'], zf[1] - 0.45)
                o = F.Opening(cx - fam['door_w'] / 2, cx + fam['door_w'] / 2, z0, top, tok, fam['frame'] * 1.3)
            elif tok == 'S':
                z0 = g(cx) + 0.02
                w = st.get('shop_w', fam['shop_w'])
                top = min(z0 + fam['shop_h'], zf[1] - 0.6)
                o = F.Opening(cx - w / 2, cx + w / 2, z0, top, tok, fam['frame'] * 1.3)
            else:
                o = F.Opening(cx - 0.4, cx + 0.4, 0, 0, tok, 0)
            o.bay = bi
            openings.append((si, tok, o))

    holes = [o.hole() for (_, t, o) in openings if t in 'WsBJDS']

    # ---------------------------------------------------------------- wall surface
    tile_z0 = zf[tiles['from_storey']] - (0.0 if tiles['from_storey'] > 0 else 10) if tiles else None
    tile_z1 = H - 0.05 if tiles else None

    def mat_fn(z):
        if tiles and tile_z0 < z < tile_z1:
            return 'grout'
        return plaster
    mat_fn.bands = [tile_z0, tile_z1] if tiles else []
    F.wall(mb, W, z_bot, H, holes, mat_fn)
    if tiles:
        tile_holes = [(x0 - 0.2, x1 + 0.2, z0 - 0.2, z1 + 0.3) for (x0, x1, z0, z1) in holes]
        tile_holes += [(-1, pil + 0.02, -99, 99), (W - pil - 0.02, W + 1, -99, 99)]
        for si in range(1, len(storeys)):
            if recipe.get('string_courses', True):
                tile_holes.append((-1, W + 1, zf[si] - 0.12, zf[si] + 0.22))
        F.azulejo_cladding(mb, pil, W - pil, max(tile_z0, g_min + 0.6), tile_z1 - 0.1, tile_holes, tiles['mat'], rnd,
                           detail=detail)

    # side and back walls (plain plaster; gable triangles added with the roof)
    for xe, nrm in ((0.0, -1), (W, 1)):
        P0 = lambda i, j, xe=xe: (xe, D * (i / 6.0) if nrm > 0 else D * (1 - i / 6.0), z_bot + (H - z_bot) * j / 10.0)
        mb.grid(plaster, 6, 10, P0, smooth=False)
    mb.grid(plaster, 8, 6, lambda i, j: (W * (1 - i / 8.0), D, z_bot + (H - z_bot) * j / 6.0), smooth=False)

    # ---------------------------------------------------------------- stone: socle, pilasters, bands, cornice
    seg = 1.0
    for k in range(int(math.ceil(W / seg))):
        a, b = k * seg, min(W, (k + 1) * seg)
        gm = min(g(a + 0.01), g(b - 0.01))
        mb.box('lioz' if recipe['family'] == 'pombaline' else 'granite', (a, -0.07, z_bot), (b, 0.02, gm + 0.5))
    if pil:
        for (a, b) in ((0, pil), (W - pil, W)):
            mb.box('lioz', (a, -0.06, z_bot), (b, 0.02, H))
            # rusticated joints every 0.45 m on the ground floor
            for z in [zz * 0.45 for zz in range(int((zf[1] - z_bot) / 0.45))]:
                zz = z_bot + z
                mb.box('lioz', (a - 0.01, -0.075, zz), (b + 0.01, -0.06, zz + 0.4))
    if recipe.get('string_courses', True):
        for si in range(1, len(storeys)):
            F.cornice(mb, -0.04, W + 0.04, zf[si] - 0.1, 'band')
    ck = recipe.get('cornice', 'pombaline' if recipe['family'] == 'pombaline' else 'bica')
    if ck:
        F.cornice(mb, -0.06, W + 0.06, H, ck)
    eave_z = H + (F.cornice_profile(ck)[1][1] if ck else 0.0)
    if recipe.get('beirado'):
        R.beirado(mb, -0.05, W + 0.05, eave_z + 0.02, rows=2)

    # ---------------------------------------------------------------- openings: frames, joinery, ironwork
    wi = 0
    for (si, tok, o) in openings:
        depth = fam['reveal']
        if tok not in 'WsBJDS':
            if tok == 'P':
                cx = (o.x0 + o.x1) / 2
                F.tile_panel(mb, cx, g(cx) + 1.4, 0.84, 1.12, recipe.get('panel_mat', 'azulejo_blue'), rnd)
            continue
        wall_mat = mat_fn((o.z0 + o.z1) / 2)
        F.reveal(mb, o, depth, plaster)
        if tok in 'Ws':
            F.stone_frame(mb, o, o.frame, cap=(si == 1 and recipe['family'] == 'pombaline'),
                          keystone=(recipe['family'] == 'pombaline' and si > 1))
            F.sash_window(mb, o, depth, fam['panes'] if tok == 'W' else (2, 2), recipe.get('joinery', 'wood_white'),
                          open_frac=rnd.choice((0, 0, 0, 0.6)))
            st = states[wi] if wi < len(states) else rnd.choice('oochn')
            wi += 1
            if st != 'n' and tok == 'W':
                F.shutters(mb, o, {'o': 'open', 'c': 'closed', 'h': 'half'}[st], recipe['shutters'], depth,
                           slats=detail >= 2, rnd=rnd)
            if recipe.get('pots') and tok == 'W' and rnd.random() < 0.45:
                pot(mb, (o.x0 + o.x1) / 2 + rnd.uniform(-0.25, 0.25), -0.12, o.z0, rnd)
        elif tok in 'BJ':
            F.stone_frame(mb, o, o.frame, sill=False, cap=(si == 1 and recipe['family'] == 'pombaline'),
                          keystone=recipe['family'] == 'pombaline')
            F.sash_window(mb, o, depth, (2, 4), recipe.get('joinery', 'wood_white'))
            st = states[wi] if wi < len(states) else rnd.choice('oocn')
            wi += 1
            if st != 'n':
                F.shutters(mb, o, {'o': 'open', 'c': 'closed', 'h': 'half'}[st], recipe['shutters'], depth,
                           slats=detail >= 2, rnd=rnd)
            if tok == 'B':
                F.balcony(mb, o, zf[si], detail=detail)
                if recipe.get('pots'):
                    for k in range(rnd.randint(1, 3)):
                        pot(mb, o.x0 - 0.2 + rnd.uniform(0, o.x1 - o.x0 + 0.4), -0.45, zf[si] + 0.02, rnd)
                if rnd.random() < 0.35 and detail >= 2:
                    birdcage(mb, o.x1 + 0.15, -0.35, zf[si] + 2.0)
            else:
                F.juliet(mb, o, zf[si])
        elif tok == 'D':
            F.stone_frame(mb, o, o.frame, sill=False, cap=recipe['family'] == 'pombaline', keystone=True)
            F.door(mb, o, depth, recipe.get('door', 'wood_brown'), fanlight=(o.z1 - o.z0) > 2.6)
        elif tok == 'S':
            F.stone_frame(mb, o, o.frame, sill=False)
            F.shopfront(mb, o, depth, recipe.get('shopwood', recipe.get('door', 'wood_green')),
                        sign_cell=recipe.get('signs', {}).get(o.bay),
                        awning=o.bay in recipe.get('awnings', {}),
                        fabric_cell=recipe.get('awnings', {}).get(o.bay), rnd=rnd)

    # laundry lines on chosen storeys: two iron arms under a window and hanging cloth
    for si in recipe.get('laundry', []):
        cands = [o for (s_, t, o) in openings if s_ == si and t in 'Ws']
        if cands:
            o = cands[len(cands) // 2]
            laundry(mb, o.x0 - 0.5, o.x1 + 0.5, o.z0 - 0.15, rnd)

    # ---------------------------------------------------------------- roof
    roof = recipe.get('roof', {})
    kind = roof.get('kind', 'gable')
    ov = 0.12 if ck == 'pombaline' else (0.45 if recipe.get('beirado') else 0.3)
    zr, zfn = R.build_roof(mb, W, D, eave_z + 0.06, kind, roof.get('pitch', 26), ov_front=ov, ov_back=0.25,
                           detail=detail)
    if kind == 'gable':
        t = math.tan(math.radians(roof.get('pitch', 26)))
        for xe, flip in ((0.0, False), (W, True)):
            pts = [(xe, 0.0, eave_z), (xe, D / 2, eave_z + D / 2 * t), (xe, D, eave_z)]
            mb.poly(plaster, pts if not flip else pts[::-1])
            mb.poly(plaster, [(xe, 0.0, H), (xe, 0.0, eave_z), (xe, D, eave_z), (xe, D, H)][::(-1 if not flip else 1)])
    clampx = lambda x: min(max(x, 0.7), W - 0.7)
    for (cx, cy) in [(clampx(x), y) for (x, y) in roof.get('chimneys', [])]:
        R.chimney(mb, cx, cy, zfn(cx, cy) - 0.3, zr + roof.get('chimney_h', 0.9), mat=plaster)
    for cx in [clampx(x) for x in roof.get('dormers', []) if x < W - 0.8]:
        R.dormer(mb, cx, 0.35, eave_z + 0.3, 1.25, plaster, recipe.get('joinery', 'wood_white'))
    for (cx, cy) in [(clampx(x), y) for (x, y) in roof.get('aerials', [])]:
        R.aerial(mb, cx, cy, zfn(cx, cy))

    # ---------------------------------------------------------------- corner façade toward the cross street
    if recipe.get('corner'):
        side_frame = tr(0, D, 0) @ rot_z(-90) if recipe['side'] == 'W' else tr(W, 0, 0) @ rot_z(90)
        side = MeshBuilder()
        gs = S.KERB_H - datum
        side_storeys = recipe.get('corner_storeys') or [dict(h=s['h'], bays=' '.join(['W'] * max(2, int(D / 2.6)))) for s in storeys]
        side_ops = side_recipe_build(side, recipe, D, zf, gs, side_storeys, fam, plaster, rnd, detail)
        side.verts = [side_frame @ v for v in side.verts]
        mb.merge(side)

    # ---------------------------------------------------------------- character: lean and bow, then place
    lean = math.radians(recipe.get('lean', rnd.uniform(-0.6, 0.6)))
    bow = recipe.get('bow', rnd.uniform(0.0, 0.05))

    def deform(v):
        z = max(0.0, v.z)
        x = min(max(v.x, 0), W)
        return Vector((v.x, v.y - z * math.tan(lean) + bow * math.sin(math.pi * x / W) * min(1.0, z / H), v.z))
    mb.deform(deform)
    Mw = M @ tr(0, 0, datum)
    mb.verts = [Mw @ v for v in mb.verts]
    obj = mb.build('building_' + recipe['name'], collection)
    info = dict(matrix=Mw, openings=openings, zf=zf, datum=datum, W=W, D=D, H=H, ground=g,
                side=(Mw @ side_frame, side_ops) if recipe.get('corner') else None)
    return obj, info


def side_recipe_build(mb, recipe, D, zf, gs, storeys, fam, plaster, rnd, detail):
    """Secondary façade on the corner: same storey heights, simpler bays, same stone and shutters."""
    W = D
    holes = []
    ops = []
    for si, st in enumerate(storeys):
        toks = st['bays'].split()
        xs = bay_centres(W, len(toks), 0.9)
        for tok, cx in zip(toks, xs):
            if tok == '-':
                continue
            if si == 0:
                z0 = gs + (0.02 if tok in 'DS' else fam['sill'] + 0.2)
                h = (fam['door_h'] if tok == 'D' else (fam['shop_h'] if tok == 'S' else fam['win_h']))
                h = min(h, zf[1] - 0.5 - z0)
                w = fam['door_w'] if tok == 'D' else (fam['shop_w'] if tok == 'S' else fam['win_w'])
            else:
                z0 = zf[si] + (0.04 if tok in 'BJ' else fam['sill'])
                h = fam['bal_h'] if tok in 'BJ' else fam['win_h']
                h = min(h, zf[si + 1] - 0.5 - z0)
                w = fam['win_w']
            o = F.Opening(cx - w / 2, cx + w / 2, z0, z0 + h, tok, fam['frame'])
            o.bay = len(ops)
            ops.append((si, tok, o))
            holes.append(o.hole())
    F.wall(mb, W, gs - 0.5, zf[-1], holes, lambda z: plaster)
    mb.box('lioz' if recipe['family'] == 'pombaline' else 'granite', (0, -0.07, gs - 0.5), (W, 0.02, gs + 0.5))
    if recipe.get('string_courses', True):
        for si in range(1, len(storeys)):
            F.cornice(mb, 0, W + 0.04, zf[si] - 0.1, 'band')
    ck = recipe.get('cornice', 'pombaline' if recipe['family'] == 'pombaline' else 'bica')
    if ck:
        F.cornice(mb, 0, W + 0.06, zf[-1], ck)
    for (si, tok, o) in ops:
        F.reveal(mb, o, fam['reveal'], plaster)
        if tok == 'D':
            F.stone_frame(mb, o, o.frame, sill=False, keystone=True)
            F.door(mb, o, fam['reveal'], recipe.get('door', 'wood_brown'), fanlight=(o.z1 - o.z0) > 2.6)
        elif tok == 'S':
            F.stone_frame(mb, o, o.frame, sill=False)
            F.shopfront(mb, o, fam['reveal'], recipe.get('shopwood', 'wood_green'), sign_cell=recipe.get('corner_sign'),
                        awning=recipe.get('corner_awning') is not None, fabric_cell=recipe.get('corner_awning'), rnd=rnd)
        else:
            F.stone_frame(mb, o, o.frame, sill=tok == 'W', keystone=recipe['family'] == 'pombaline' and si > 1)
            F.sash_window(mb, o, fam['reveal'], fam['panes'] if tok == 'W' else (2, 4), recipe.get('joinery', 'wood_white'))
            if tok == 'B':
                F.balcony(mb, o, zf[si], detail=detail)
            elif tok == 'J':
                F.juliet(mb, o, zf[si])
            if rnd.random() < 0.7:
                F.shutters(mb, o, rnd.choice(('open', 'open', 'closed', 'half')), recipe['shutters'], fam['reveal'],
                           slats=detail >= 2, rnd=rnd)
    return ops


# ------------------------------------------------------------------ small façade dressing
def pot(mb, x, y, z, rnd):
    r = rnd.uniform(0.11, 0.16)
    mb.cyl('terracotta_pot', (x, y, z), (x, y, z + r * 1.4), r * 0.75, seg=10, r1=r)
    mb.cyl('terracotta_pot', (x, y, z + r * 1.4), (x, y, z + r * 1.55), r * 1.08, seg=10)
    for k in range(rnd.randint(2, 4)):
        mb.sphere('foliage', (x + rnd.uniform(-r, r) * 0.6, y + rnd.uniform(-r, r) * 0.6, z + r * 1.6 + rnd.uniform(0.05, 0.2)),
                  r * rnd.uniform(0.8, 1.3), seg=8, rings=5)


def birdcage(mb, x, y, z):
    mb.cyl('iron', (x, y, z + 0.32), (x, y, z + 0.7), 0.006, seg=3, caps=False)
    for k in range(10):
        a = 2 * math.pi * k / 10
        mb.cyl('iron', (x + 0.13 * math.cos(a), y + 0.13 * math.sin(a), z), (x + 0.11 * math.cos(a), y + 0.11 * math.sin(a), z + 0.28),
               0.004, seg=3, caps=False)
    mb.cyl('wood_white', (x, y, z - 0.02), (x, y, z + 0.01), 0.15, seg=12)
    mb.sphere('iron', (x, y, z + 0.28), 0.12, seg=10, rings=4, sz=(0.12, 0.12, 0.06))
    mb.sphere('plaster_yellow', (x, y, z + 0.12), 0.035, seg=6, rings=4)


def laundry(mb, x0, x1, z, rnd):
    for xx in (x0, x1):
        mb.box('iron', (xx - 0.015, -0.75, z - 0.015), (xx + 0.015, 0.0, z + 0.015), bevel=False)
    for yy in (-0.25, -0.5, -0.72):
        mb.tube('iron', [(x0, yy, z + 0.02), ((x0 + x1) / 2, yy, z - 0.03), (x1, yy, z + 0.02)], 0.004, seg=3)
    x = x0 + 0.1
    while x < x1 - 0.3:
        w = rnd.uniform(0.25, 0.6)
        h = rnd.uniform(0.35, 0.8)
        yy = rnd.choice((-0.25, -0.5, -0.72))
        cell = rnd.choice((3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15))
        u0, v0 = (cell % 4) * 0.25, 1 - ((cell // 4) + 1) * 0.25
        sag = rnd.uniform(-0.03, 0.03)
        # cloth with a slight billow: 3 x 2 grid
        def P(i, j, x=x, w=w, h=h, yy=yy, sag=sag):
            return (x + w * i / 3, yy + 0.04 * math.sin(math.pi * i / 3) * (1 - j / 2) + sag * j, z - 0.01 - h * (1 - j / 2))
        mb.grid('fabric', 3, 2, P, uvfn=lambda i, j, u0=u0, v0=v0: (u0 + 0.25 * i / 3, v0 + 0.25 * j / 2))
        mb.grid('fabric', 3, 2, lambda i, j, P=P: (lambda p: (p[0], p[1] + 0.006, p[2]))(P(3 - i, j)),
                uvfn=lambda i, j, u0=u0, v0=v0: (u0 + 0.25 * (3 - i) / 3, v0 + 0.25 * j / 2))
        x += w + rnd.uniform(0.05, 0.2)
