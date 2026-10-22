"""Small drawing helpers over m11.F frames: ramps, motifs, little shapes placed by hand."""
from m11 import hsh

RAMPS = {
    "steel": ["steel0", "steel1", "steel2", "steel3", "steel4"],
    "brass": ["brass0", "brass1", "brass2", "brass3"],
    "wood": ["wood0", "wood1", "wood2", "wood3", "wood4", "wood5"],
    "earth": ["earth0", "earth1", "earth2", "earth3"],
    "copper": ["copper0", "copper1", "copper2", "copper3"],
    "lamp": ["lamp0", "lamp1", "lamp2", "lamp3"],
    "moss": ["moss0", "moss1", "moss2", "moss3", "moss4", "moss5"],
    "water": ["water0", "water1", "water2", "water3", "water4"],
    "iron": ["iron0", "iron1", "iron2"],
    "cloud": ["cloud0", "cloud1", "cloud2", "cloud3"],
    "sky": ["sky0", "sky1", "sky2", "sky3", "sky4"],
    "grass": ["grass0", "grass1", "grass2", "grass3"],
    "pave": ["pave0", "pave1", "pave2", "pave3"],
}


def rm(*pairs, **kw):
    """A name -> name dict from pairs of equal-length lists, plus keyword entries."""
    d = {}
    for a, b in zip(pairs[::2], pairs[1::2]):
        for x, y in zip(a, b):
            d[x] = y
    d.update(kw)
    return d


def body_px(f, extra_skip=()):
    """The body: opaque, not the skid, not ink."""
    for x, y in f.opaque():
        n = f.name(x, y)
        if n in ("ink",) or n in extra_skip or f.on_skid(x, y):
            continue
        yield x, y, n


def shape(f, ox, oy, rows, key, only=None, avoid_pip=True):
    """Stamp a little picture: rows of chars, key maps a char to a colour name ('.' skips)."""
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            c = key.get(ch)
            if c is None:
                continue
            x, y = ox + i, oy + j
            if avoid_pip and f.pip(x, y):
                continue
            if only == "opaque" and not f.name(x, y):
                continue
            f.put(x, y, c or None)


def body_bbox(f):
    xs, ys = [], []
    for x, y, n in body_px(f, extra_skip=("ink1",)):
        xs.append(x)
        ys.append(y)
    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def h(*v):
    return hsh(*v)
