"""Authored building recipes for the Bica proof scene.

Twelve hand-written buildings, six per side, fill the first ~45 m below the junction (the high-detail zone of
every review view). Below that, quieter variants of the same recipes (re-coloured, re-roofed, mirrored bays,
lower detail) carry the street down to the river end. Two families: Pombaline Chiado blocks (stone frames,
string courses, big cornice, dormers) and narrow Bica houses (beirado eaves, azulejo fronts, shutters, laundry).
"""
import copy

AUTHORED = [
    # ------------------------------------------------------------------ west side (x < 0), top to bottom
    dict(name='w01_combro_corner', side='W', y0=0.0, width=11.6, depth=10.0, family='pombaline',
         plaster='plaster_yellow', shutters='wood_green', door='wood_brown', shopwood='wood_green', corner=True,
         storeys=[dict(h=4.3, bays='S D S'), dict(h=3.4, bays='B B B B'), dict(h=3.3, bays='J J J J'),
                  dict(h=3.1, bays='W W W W')],
         corner_storeys=[dict(h=4.3, bays='S W'), dict(h=3.4, bays='B B B'), dict(h=3.3, bays='W W W'),
                         dict(h=3.1, bays='W W W')],
         corner_sign=3, corner_awning=1,
         signs={0: 2, 2: 0}, awnings={0: 0, 2: 9}, shutter_states='oohcooohoocho',
         roof=dict(kind='hip', pitch=24, dormers=[3.2, 8.4], chimneys=[(2.0, 6.5), (9.5, 4.0)], aerials=[(5.5, 6.0)]),
         lean=-0.3, bow=0.03, seed=101),
    dict(name='w02_bica_blue_tiles', side='W', y0=11.6, width=5.8, depth=8.0, family='bica',
         plaster='plaster_cream', shutters='wood_green', door='wood_blue', pilasters=False, cornice=None, beirado=True,
         tiles=dict(mat='azulejo_blue', from_storey=1),
         storeys=[dict(h=3.1, bays='D W'), dict(h=2.9, bays='B W'), dict(h=2.8, bays='W W'), dict(h=2.7, bays='W W')],
         shutter_states='hohoc', laundry=[2], pots=True, string_courses=False,
         roof=dict(kind='gable', pitch=27, chimneys=[(1.2, 5.5)], aerials=[(4.0, 3.5)]), lean=0.5, seed=102),
    dict(name='w03_bica_rose', side='W', y0=17.4, width=6.6, depth=9.0, family='bica',
         plaster='plaster_rose', shutters='wood_ochre', door='wood_green', shopwood='wood_blue', beirado=True, cornice=None,
         storeys=[dict(h=3.2, bays='S D'), dict(h=2.9, bays='J J'), dict(h=2.8, bays='W W')],
         signs={0: 1}, awnings={0: 1}, shutter_states='oohc', pots=True,
         roof=dict(kind='hip', pitch=25, chimneys=[(4.8, 5.0)]), lean=-0.4, bow=0.04, seed=103),
    dict(name='w04_pombaline_green_tiles', side='W', y0=24.0, width=9.2, depth=10.0, family='pombaline',
         plaster='plaster_white', shutters='wood_brown', door='wood_green', tiles=dict(mat='azulejo_green', from_storey=1),
         storeys=[dict(h=4.0, bays='D W W'), dict(h=3.3, bays='B B B'), dict(h=3.2, bays='W W W'), dict(h=3.0, bays='W W W')],
         shutter_states='nnhonohcon', laundry=[3],
         roof=dict(kind='gable', pitch=25, dormers=[2.3, 6.9], chimneys=[(4.6, 7.0)]), lean=0.2, seed=104),
    dict(name='w05_bica_ochre_narrow', side='W', y0=33.2, width=5.2, depth=8.0, family='bica',
         plaster='plaster_ochre', shutters='wood_green', door='wood_brown', pilasters=False, beirado=True, cornice=None,
         storeys=[dict(h=3.0, bays='D s'), dict(h=2.8, bays='J W'), dict(h=2.8, bays='W W'), dict(h=2.6, bays='W W')],
         shutter_states='ocoohh', laundry=[1, 2], pots=True, string_courses=False,
         roof=dict(kind='gable', pitch=28, chimneys=[(3.8, 3.0)], aerials=[(1.5, 4.5)]), lean=-0.7, bow=0.05, seed=105),
    dict(name='w06_bica_blue_plaster', side='W', y0=38.4, width=7.4, depth=9.0, family='bica',
         plaster='plaster_blue', shutters='wood_white', door='wood_brown', shopwood='wood_brown', beirado=True,
         storeys=[dict(h=3.2, bays='S D'), dict(h=3.0, bays='B B'), dict(h=2.8, bays='W W')],
         signs={0: 3}, shutter_states='ooco', pots=True,
         roof=dict(kind='hip', pitch=24, chimneys=[(2.0, 4.5)]), lean=0.4, seed=106),
    # ------------------------------------------------------------------ east side (x > 0), top to bottom
    dict(name='e01_loreto_corner', side='E', y0=0.0, width=10.4, depth=10.0, family='pombaline',
         plaster='plaster_white', shutters='wood_blue', door='wood_brown', shopwood='wood_blue', corner=True,
         tiles=dict(mat='azulejo_lattice', from_storey=1),
         storeys=[dict(h=4.2, bays='S S D'), dict(h=3.4, bays='B J B'), dict(h=3.2, bays='W W W'), dict(h=3.0, bays='W W W')],
         corner_storeys=[dict(h=4.2, bays='D S'), dict(h=3.4, bays='J J J'), dict(h=3.2, bays='W W W'),
                         dict(h=3.0, bays='W W W')],
         corner_sign=0, signs={0: 0, 1: 1}, awnings={1: 2}, shutter_states='ocooohcoon',
         roof=dict(kind='hip', pitch=24, dormers=[5.2], chimneys=[(1.6, 5.0), (8.6, 7.0)], aerials=[(7.0, 4.0)]),
         lean=0.3, seed=201),
    dict(name='e02_bica_ochre_balconies', side='E', y0=10.4, width=6.2, depth=8.0, family='bica',
         plaster='plaster_ochre', shutters='wood_green', door='wood_green', shopwood='wood_green', beirado=True, cornice=None,
         storeys=[dict(h=3.2, bays='S D'), dict(h=2.9, bays='B B'), dict(h=2.8, bays='W W'), dict(h=2.7, bays='W W')],
         signs={0: 2}, awnings={0: 3}, shutter_states='oohocc', laundry=[3], pots=True,
         roof=dict(kind='gable', pitch=27, chimneys=[(5.0, 2.5)]), lean=-0.5, bow=0.04, seed=202),
    dict(name='e03_bica_tiled_house', side='E', y0=16.6, width=5.0, depth=8.0, family='bica',
         plaster='plaster_cream', shutters='wood_ochre', door='wood_blue', pilasters=False, beirado=True, cornice=None,
         tiles=dict(mat='azulejo_blue', from_storey=0), string_courses=False,
         storeys=[dict(h=3.0, bays='D W'), dict(h=2.8, bays='J W'), dict(h=2.7, bays='W W')],
         shutter_states='nhonc', pots=True,
         roof=dict(kind='gable', pitch=28, aerials=[(2.5, 4.0)]), lean=0.6, seed=203),
    dict(name='e04_pombaline_rose', side='E', y0=21.6, width=10.0, depth=10.0, family='pombaline',
         plaster='plaster_rose', shutters='wood_green', door='wood_brown', shopwood='wood_brown',
         storeys=[dict(h=4.1, bays='S D S'), dict(h=3.3, bays='B B B'), dict(h=3.2, bays='J J J'), dict(h=3.0, bays='W W W')],
         signs={2: 3}, awnings={0: 9}, shutter_states='oocohooon', laundry=[],
         roof=dict(kind='gable', pitch=25, dormers=[2.6, 7.4], chimneys=[(1.4, 7.5), (8.6, 7.5)]), lean=-0.2, seed=204),
    dict(name='e05_bica_green_panel', side='E', y0=31.6, width=6.0, depth=9.0, family='bica',
         plaster='plaster_green', shutters='wood_white', door='wood_brown', beirado=True, cornice=None,
         storeys=[dict(h=3.1, bays='D P'), dict(h=2.9, bays='W W'), dict(h=2.8, bays='W W')],
         panel_mat='azulejo_blue', shutter_states='ohco', pots=True, laundry=[1],
         roof=dict(kind='hip', pitch=25, chimneys=[(1.5, 4.5)]), lean=0.5, bow=0.05, seed=205),
    dict(name='e06_bica_lattice_tiles', side='E', y0=37.6, width=6.8, depth=9.0, family='bica',
         plaster='plaster_white', shutters='wood_green', door='wood_green', shopwood='wood_green', beirado=True,
         tiles=dict(mat='azulejo_lattice', from_storey=1), cornice=None,
         storeys=[dict(h=3.2, bays='S D'), dict(h=2.9, bays='B B'), dict(h=2.8, bays='W W'), dict(h=2.7, bays='W W')],
         signs={0: 0}, shutter_states='ooccoh', laundry=[2], pots=True,
         roof=dict(kind='gable', pitch=27, chimneys=[(3.4, 6.0)], aerials=[(1.4, 3.0)]), lean=-0.3, seed=206),
]

PLASTERS = ['plaster_ochre', 'plaster_rose', 'plaster_cream', 'plaster_white', 'plaster_blue', 'plaster_yellow',
            'plaster_green']
WOODS = ['wood_green', 'wood_ochre', 'wood_brown', 'wood_blue', 'wood_white']
TILES = ['azulejo_blue', 'azulejo_lattice', 'azulejo_green']


def variants(end_y=124.0):
    """Quieter buildings below the authored zone: each derived from an authored recipe on the same side."""
    out = []
    for side in ('W', 'E'):
        base = [r for r in AUTHORED if r['side'] == side]
        y = max(r['y0'] + r['width'] for r in base)
        k = 0
        while y < end_y - 2.0:
            src = base[(k * 4 + 1) % len(base)]
            r = copy.deepcopy(src)
            r['name'] = '%s%02d_%s_var' % (side.lower(), 7 + k, src['family'])
            r['y0'] = y
            r['corner'] = False
            r['seed'] = 300 + k + (0 if side == 'W' else 50)
            r['plaster'] = PLASTERS[(PLASTERS.index(src['plaster']) + 2 + k) % len(PLASTERS)]
            r['shutters'] = WOODS[(k * 2 + (side == 'E')) % len(WOODS)]
            r.pop('shutter_states', None)
            if 'tiles' in r and k % 2:
                r.pop('tiles')
            elif 'tiles' not in r and k % 3 == 1:
                r['tiles'] = dict(mat=TILES[k % 3], from_storey=1)
            if 'tiles' in r:
                r['tiles']['mat'] = TILES[(TILES.index(r['tiles']['mat']) + k) % 3]
            r['roof']['kind'] = 'hip' if r['roof'].get('kind') == 'gable' else 'gable'
            r['roof'].pop('dormers', None) if k % 2 else None
            # mirror the bays so the rhythm differs from the source
            for st in r['storeys']:
                st['bays'] = ' '.join(reversed(st['bays'].split()))
            if k % 2 and len(r['storeys']) > 3:
                r['storeys'] = r['storeys'][:-1]
            elif not k % 2 and r['family'] == 'bica' and len(r['storeys']) == 3:
                r['storeys'].append(dict(h=2.7, bays=r['storeys'][-1]['bays']))
            r['signs'] = {i: (c + k) % 4 for i, c in r.get('signs', {}).items()}
            r['awnings'] = {i: (c + 3 * k) % 16 for i, c in r.get('awnings', {}).items()}
            r['lean'] = ((k * 37) % 13 - 6) / 10.0
            r['detail'] = 1
            if y + r['width'] > end_y + 1.0:
                r['width'] = max(4.5, end_y + 1.0 - y)
            out.append(r)
            y += r['width']
            k += 1
    return out


def all_recipes():
    for r in AUTHORED:
        r.setdefault('detail', 2)
    return AUTHORED + variants()
