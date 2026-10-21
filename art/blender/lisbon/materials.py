"""Material registry.

Each material is a glTF-friendly Principled BSDF:
  base colour = image texture x colour factor (Mix multiply) x vertex colour (baked AO, COLOR_0)
  plus scalar roughness/metallic and an optional normal map.
Colours are given as sRGB hex from the STYLE-C palette. For tinted neutral textures the factor is solved so the
textured average lands on the palette colour.
"""
import bpy

from . import textures as T

# name: texture, tint (hex or None), tile size in metres for box-projected UVs, roughness, metallic, normal map, extra
DEF = {
    # plaster (one neutral wash texture, tinted)
    'plaster_ochre': dict(tex='plaster', tint='#D9A14E', tile=4.0, rough=0.92, normal='plaster_n'),
    'plaster_rose': dict(tex='plaster', tint='#D98E7A', tile=4.0, rough=0.92, normal='plaster_n'),
    'plaster_cream': dict(tex='plaster', tint='#EFE2C6', tile=4.0, rough=0.92, normal='plaster_n'),
    'plaster_white': dict(tex='plaster', tint='#F2EDE2', tile=4.0, rough=0.92, normal='plaster_n'),
    'plaster_blue': dict(tex='plaster', tint='#9DB4C6', tile=4.0, rough=0.92, normal='plaster_n'),
    'plaster_yellow': dict(tex='plaster', tint='#E8BE5A', tile=4.0, rough=0.92, normal='plaster_n'),
    'plaster_green': dict(tex='plaster', tint='#A9BFA0', tile=4.0, rough=0.92, normal='plaster_n'),
    # stone
    'lioz': dict(tex='lioz', tile=1.6, rough=0.75, normal='lioz_n'),
    'granite': dict(tex='granite', tile=1.2, rough=0.85),
    'setts': dict(tex='setts', tile=1.2, rough=0.8, normal='setts_n'),
    'calcada': dict(tex='calcada', tile=3.2, rough=0.6, normal='calcada_n'),
    # tiles
    'roof_tile': dict(tex='roof_tile', tile=1.0, rough=0.8),
    'azulejo_blue': dict(tex='azulejo_blue', tile=0.56, rough=0.18),
    'azulejo_lattice': dict(tex='azulejo_lattice', tile=0.56, rough=0.18),
    'azulejo_green': dict(tex='azulejo_green', tile=0.56, rough=0.18),
    'grout': dict(tex='plaster', tint='#CFC6B4', tile=4.0, rough=0.95),
    # joinery and metal
    'wood_green': dict(tex='wood_paint', tint='#2E5B45', tile=1.0, rough=0.65, normal='wood_paint_n'),
    'wood_ochre': dict(tex='wood_paint', tint='#B9822F', tile=1.0, rough=0.65, normal='wood_paint_n'),
    'wood_brown': dict(tex='wood_paint', tint='#5E3B26', tile=1.0, rough=0.6, normal='wood_paint_n'),
    'wood_blue': dict(tex='wood_paint', tint='#2F5D8C', tile=1.0, rough=0.6, normal='wood_paint_n'),
    'wood_white': dict(tex='wood_paint', tint='#EDE6D6', tile=1.0, rough=0.55, normal='wood_paint_n'),
    'iron': dict(tex=None, color='#22282A', rough=0.55, metal=0.4),
    'glass': dict(tex='glass', tile=1.0, rough=0.08),
    'rail_steel': dict(tex=None, color='#8D8B87', rough=0.3, metal=1.0),
    'brass': dict(tex=None, color='#C99B4A', rough=0.35, metal=1.0),
    # props and cloth
    'signs': dict(tex='signs', tile=1.0, rough=0.7),
    'fabric': dict(tex='fabric', tile=1.0, rough=0.9),
    'foliage': dict(tex='foliage', tile=0.8, rough=0.8),
    'terracotta_pot': dict(tex='roof_tile', tint='#C46A3E', tile=0.6, rough=0.85),
    'bin_green': dict(tex='paint_metal', tint='#3E6B4A', tile=1.0, rough=0.5),
    'cat': dict(tex=None, color='#C98B44', rough=0.9),
    'gull': dict(tex=None, color='#ECE8E0', rough=0.8),
    'dark': dict(tex=None, color='#2A2624', rough=0.8),
    # funicular
    'funicular_yellow': dict(tex='paint_metal', tint='#F2B632', tile=2.0, rough=0.45),
    'funicular_white': dict(tex='paint_metal', tint='#F1EADB', tile=2.0, rough=0.5),
    'funicular_dark': dict(tex='paint_metal', tint='#3A3634', tile=2.0, rough=0.6),
    'lamp_glow': dict(tex=None, color='#FFE2A8', rough=0.3, emit='#FFD58A'),
    # microcar
    'car_teal': dict(tex=None, color='#2A9C9A', rough=0.22, clearcoat=True),
    'car_box': dict(tex='pastry_box', tile=1.0, rough=0.4),
    'car_cream': dict(tex=None, color='#F1E6CC', rough=0.4),
    'car_tyre': dict(tex=None, color='#252322', rough=0.85),
    'car_chrome': dict(tex=None, color='#D9D6CF', rough=0.15, metal=1.0),
    'car_glass': dict(tex=None, color='#1F2E36', rough=0.05),
    'car_lamp': dict(tex=None, color='#FFF1D2', rough=0.1, emit='#FFE7B0'),
    'car_tail': dict(tex=None, color='#C2362B', rough=0.2, emit='#7A1A12'),
    'car_trim': dict(tex=None, color='#2B3033', rough=0.6),
    'car_seat': dict(tex=None, color='#8A4A2E', rough=0.7),
    # mid-ground and backdrop
    'far_ochre': dict(tex='far_facade', tint='#D9A14E', tile=3.2, rough=0.95),
    'far_rose': dict(tex='far_facade', tint='#D98E7A', tile=3.2, rough=0.95),
    'far_cream': dict(tex='far_facade', tint='#EFE2C6', tile=3.2, rough=0.95),
    'far_yellow': dict(tex='far_facade', tint='#E8BE5A', tile=3.2, rough=0.95),
    'far_roof': dict(tex='roof_tile', tile=3.0, rough=0.9),
    'river': dict(tex='river', tile=60.0, rough=0.12),
    'backdrop_sky': dict(tex='sky', unlit=True),
    'backdrop_far_shore': dict(tex='far_shore', unlit=True, alpha=True),
    'backdrop_bridge': dict(tex='bridge', unlit=True, alpha=True),
}

TEX_MEAN = {}   # average linear value of neutral textures, filled lazily


def tile_size(name):
    return DEF.get(name, {}).get('tile', 1.0)


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_lin(h):
    h = h.lstrip('#')
    return tuple(srgb_to_lin(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4))


def _mean_lin(img):
    if img.name not in TEX_MEAN:
        import numpy as np
        px = np.empty(len(img.pixels), np.float32)
        img.pixels.foreach_get(px)
        px = px.reshape(-1, 4)[::97, :3]
        lin = np.where(px <= 0.04045, px / 12.92, ((px + 0.055) / 1.055) ** 2.4)
        TEX_MEAN[img.name] = tuple(float(v) for v in lin.mean(0))
    return TEX_MEAN[img.name]


def get(name):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    d = DEF[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    out.location = (600, 0)

    img = T.get(d['tex']) if d.get('tex') else None

    if d.get('unlit'):
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img
        tex.location = (-300, 0)
        if d.get('alpha'):
            mix = nt.nodes.new('ShaderNodeMixShader')
            tr = nt.nodes.new('ShaderNodeBsdfTransparent')
            em = nt.nodes.new('ShaderNodeEmission')
            nt.links.new(tex.outputs['Color'], em.inputs['Color'])
            nt.links.new(tex.outputs['Alpha'], mix.inputs['Fac'])
            nt.links.new(tr.outputs[0], mix.inputs[1])
            nt.links.new(em.outputs[0], mix.inputs[2])
            nt.links.new(mix.outputs[0], out.inputs['Surface'])
            mat.blend_method = 'BLEND' if hasattr(mat, 'blend_method') else None
        else:
            nt.links.new(tex.outputs['Color'], out.inputs['Surface'])
        return mat

    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (250, 0)
    nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
    bsdf.inputs['Roughness'].default_value = d.get('rough', 0.8)
    bsdf.inputs['Metallic'].default_value = d.get('metal', 0.0)
    if d.get('clearcoat'):
        bsdf.inputs['Coat Weight'].default_value = 0.6
        bsdf.inputs['Coat Roughness'].default_value = 0.05

    vc = nt.nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'
    vc.location = (-300, -250)

    if img is not None:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img
        tex.location = (-600, 100)
        col_out = tex.outputs['Color']
        if d.get('tint'):
            tint = hex_lin(d['tint'])
            mean = _mean_lin(img)
            f = [min(1.0, t / max(m, 1e-3)) for t, m in zip(tint, mean)]
            m1 = nt.nodes.new('ShaderNodeMix')
            m1.data_type = 'RGBA'
            m1.blend_type = 'MULTIPLY'
            m1.inputs['Factor'].default_value = 1.0
            m1.inputs[7].default_value = (*f, 1.0)
            m1.location = (-300, 100)
            nt.links.new(col_out, m1.inputs[6])
            col_out = m1.outputs[2]
    else:
        rgb = nt.nodes.new('ShaderNodeRGB')
        rgb.outputs[0].default_value = (*hex_lin(d['color']), 1.0)
        rgb.location = (-600, 100)
        col_out = rgb.outputs[0]

    m2 = nt.nodes.new('ShaderNodeMix')
    m2.data_type = 'RGBA'
    m2.blend_type = 'MULTIPLY'
    m2.inputs['Factor'].default_value = 1.0
    m2.location = (0, 100)
    nt.links.new(col_out, m2.inputs[6])
    nt.links.new(vc.outputs['Color'], m2.inputs[7])
    nt.links.new(m2.outputs[2], bsdf.inputs['Base Color'])

    if d.get('normal'):
        nimg = T.get(d['normal'])
        ntex = nt.nodes.new('ShaderNodeTexImage')
        ntex.image = nimg
        ntex.location = (-600, -500)
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.location = (-300, -500)
        nm.inputs['Strength'].default_value = 1.0
        nt.links.new(ntex.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])

    if d.get('emit'):
        bsdf.inputs['Emission Color'].default_value = (*hex_lin(d['emit']), 1.0)
        bsdf.inputs['Emission Strength'].default_value = 1.0
    return mat
