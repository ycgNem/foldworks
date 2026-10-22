"""Tools for the island variants (isles.py): reading Home's sheets, remapping ramps, distance from
the sky inside an edge tile, snow caps, and the variant naming rule.

The naming rule (the renderer swaps a whole sheet set per island by it): a Home sheet `isle_X`
becomes `isle_<world>_X`, any other Home sheet `N` becomes `isle_<world>_N`:

    isle_edge -> isle_cinder_edge        tile_grass -> isle_cinder_tile_grass
    isle_cliff -> isle_cinder_cliff      prop_tree  -> isle_cinder_prop_tree

A variant has exactly the Home sheet's frame size, frame count and order, anchor, fps and names
(isle_vein adds four names for the island's exotic, after Home's sixteen). Where an island ships
no variant of a sheet, Home's is used.
"""
from collections import deque

from c4 import P, get, hsh, load, new, put, rgb

HOME_SHEETS = ["tile_pave", "tile_pave_edge", "tile_pave_seam", "tile_grass", "tile_grass_deco", "tile_plot",
               "isle_edge", "isle_cliff", "isle_vein", "isle_under", "isle_under_deco", "isle_tip", "isle_fall_top",
               "isle_fall_head", "isle_fall", "isle_fall_foam", "prop_tree", "prop_bush", "prop_fence",
               # Home's ore outcrops re-seated on the island's meadow (frames 5-8 and spill 16-31)
               "tile_ore_iron", "tile_ore_copper", "tile_ore_coal", "tile_ore_sand",
               "tile_ore_iron_spill", "tile_ore_copper_spill", "tile_ore_coal_spill", "tile_ore_sand_spill"]
ORES = ["iron", "copper", "coal", "sand"]


def ore_seats(out, ramp):
    """Home's outcrops with their meadow seats (the only grass in those sheets) on the island's
    own ground: the same frames, the grass remapped by `ramp`."""
    for o in ORES:
        for n in (f"tile_ore_{o}", f"tile_ore_{o}_spill"):
            fr, _ = home(n)
            out[n] = [remap(f, ramp) for f in fr]


def vname(world, base):
    return f"isle_{world}_" + (base[5:] if base.startswith("isle_") else base)


def home(name):
    return load(name)


RGB = {k: rgb(v) for k, v in P.items()}
INV = {v: k for k, v in RGB.items()}


def nm(img, x, y):
    p = get(img, x, y)
    return INV.get(p[:3]) if p[3] else None


def remap(img, mapping):
    """Palette name -> palette name (None clears)."""
    out = img.copy()
    px = out.load()
    m = {RGB[k]: (RGB[v] + (255,) if v else (0, 0, 0, 0)) for k, v in mapping.items()}
    for y in range(out.height):
        for x in range(out.width):
            p = px[x, y]
            if p[3] and p[:3] in m:
                px[x, y] = m[p[:3]]
    return out


def sky_dist(img, mask=None, cap=12):
    """4-neighbour distance (1 = touching the sky) of every opaque pixel from a clear pixel, or from
    outside the frame on a side the mask leaves open (N=1 E=2 S=4 W=8 = land there) and outside
    the corners of two open sides. {(x, y): d}."""
    w, h = img.size
    px = img.load()
    dist = {}
    q = deque()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0:
                dist[(x, y)] = 0
                q.append((x, y))
    if mask is not None:
        seeds = []
        if not mask & 1:
            seeds += [(x, -1) for x in range(w)]
        if not mask & 4:
            seeds += [(x, h) for x in range(w)]
        if not mask & 8:
            seeds += [(-1, y) for y in range(h)]
        if not mask & 2:
            seeds += [(w, y) for y in range(h)]
        for s in seeds:
            dist[s] = 0
            q.append(s)
    while q:
        x, y = q.popleft()
        d = dist[(x, y)]
        if d >= cap:
            continue
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if 0 <= n[0] < w and 0 <= n[1] < h and n not in dist and px[n][3]:
                dist[n] = d + 1
                q.append(n)
    return {k: v for k, v in dist.items() if v > 0}


def top_exposed(img, x, y, outline=("ink", "ink1")):
    """The pixel has sky (clear) or an outline pixel straight above it."""
    a = nm(img, x, y - 1)
    return a is None or a in outline


def snow_cap(img, body, depth=(("cloud3",), ("cloud2",)), outline=("ink", "ink1"), skip=()):
    """Snow on every upward-facing run of `body` colours: the first pixel under the sky (or under
    an outline) turns cloud3, the next cloud2. Returns a new image."""
    out = img.copy()
    w, h = img.size
    for x in range(w):
        for y in range(h):
            n = nm(img, x, y)
            if n not in body or n in skip:
                continue
            if top_exposed(img, x, y, outline):
                for k, cols in enumerate(depth):
                    yy = y + k
                    if nm(img, x, yy) in body:
                        put(out, x, yy, P[cols[hsh(x, yy, 7) % len(cols)]])
    return out


def frames_strip(frames, w=16):
    """Frames side by side (the 64 px cliff strip from its four variants of one row)."""
    out = new(w * len(frames), frames[0].height)
    for i, f in enumerate(frames):
        out.alpha_composite(f, (i * w, 0))
    return out


def unstrip(strip, n, w=16):
    return [strip.crop((i * w, 0, i * w + w, strip.height)) for i in range(n)]


def h01(*v):
    return (hsh(*v) & 0xFFFF) / 65535
