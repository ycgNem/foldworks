"""Shared helpers for Milestone 11's cosmetic skins (docs/endgame.md, "Milestone 11 skins as built").

A skin sheet is `src/art/skin_<id>_<base>.png` + `.json`: a drop-in replacement for the base sheet
`<base>` (the same frame size, frame count, order, facings, names, anchor and fps; the sidecar adds
`"skin": <id>` and `"base": <base>`). `<id>` is the cosmetic's id exactly as `src/data/cosmetics.ts`
spells it (camelCase kept: `skin_straightArrow_belt`); `<base>` is the sheet the renderer draws for
that kind (snake_case: `steam_engine`, `smelter_mk2`, and one sheet per floor for a module).

Everything comes from pixel-art/act5/c5.py (which loads act4/c4.py, sky/common.py, sky/pal.py and
act3/c3.py): the palette B extended (69 art colours; nothing added here), the skid, `check`.
Every skin is a recolour by rule over the base frames plus a detail pass of pixels placed on
purpose by the skin's own function; the skid (STYLE.md: it says "machine" at 1x), the ink and the
top-right pip corner (a 5x5 margin, PIP) are kept calm.
"""
import json
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ACT5 = HERE.parent / "act5"
if str(ACT5) not in sys.path:
    sys.path.insert(0, str(ACT5))

import c5  # noqa: E402
from c5 import P, SRC_ART, check, colours, hsh, new, rgb, scale, skid  # noqa: E402,F401

OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
INV = {rgb(v): k for k, v in P.items()}
SHIPPED = []


def base(name):
    img = Image.open(SRC_ART / f"{name}.png").convert("RGBA")
    meta = json.loads((SRC_ART / f"{name}.json").read_text())
    return img, meta


def frames(name):
    """The base sheet cut into rows (facings) of frames, and its sidecar."""
    img, meta = base(name)
    fw, fh = meta["frame"]
    n = meta["frames"]
    per = max(1, img.width // fw)
    flat = [img.crop(((i % per) * fw, (i // per) * fh, (i % per) * fw + fw, (i // per) * fh + fh)) for i in range(n)]
    fac = meta.get("facings", 1)
    k = n // fac
    rows = [flat[r * k:(r + 1) * k] for r in range(fac)]
    return rows, meta


class F:
    """One frame being skinned: its pixels by palette name, where it sits in the sheet."""

    def __init__(self, img, row, i, meta, sk=None):
        self.img = img
        self.px = img.load()
        self.w, self.h = img.size
        self.row, self.i = row, i
        self.meta = meta
        self.sk = sk

    def name(self, x, y):
        if not (0 <= x < self.w and 0 <= y < self.h):
            return None
        p = self.px[x, y]
        return INV.get(p[:3]) if p[3] else None

    def put(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = rgb(P[c]) + (255,) if c else (0, 0, 0, 0)

    def put_over(self, x, y, c):
        """Only over an opaque pixel."""
        if self.name(x, y):
            self.put(x, y, c)

    def pip(self, x, y):
        """In the calm top-right corner (the code draws the pip at x+10, y+1, 5x5)."""
        return x >= self.w - 6 and y <= 6

    def on_skid(self, x, y):
        if not self.sk:
            return False
        top = 12 if self.w == 16 else 25
        if y < top:
            return False
        s = self.sk[x, y]
        return bool(s[3]) and s[:3] == self.px[x, y][:3]

    def opaque(self):
        for y in range(self.h):
            for x in range(self.w):
                if self.px[x, y][3]:
                    yield x, y

    def recolour(self, m, keep_skid=True, where=None):
        """Recolour by palette name -> name (a dict, or a function (x, y, name) -> name)."""
        for x, y in list(self.opaque()):
            if keep_skid and self.on_skid(x, y):
                continue
            if where and not where(x, y):
                continue
            n = self.name(x, y)
            if n is None:
                continue
            t = m(x, y, n) if callable(m) else m.get(n, n)
            if t and t != n:
                self.put(x, y, t)

    def bbox(self, names=None, skip_skid=True):
        xs, ys = [], []
        for x, y in self.opaque():
            if skip_skid and self.on_skid(x, y):
                continue
            if names and self.name(x, y) not in names:
                continue
            xs.append(x)
            ys.append(y)
        if not xs:
            return None
        return min(xs), min(ys), max(xs), max(ys)


RAMP_OF = {}
for _r in (["steel0", "steel1", "steel2", "steel3", "steel4"], ["brass0", "brass1", "brass2", "brass3"],
           ["wood0", "wood1", "wood2", "wood3", "wood4", "wood5"], ["earth0", "earth1", "earth2", "earth3"],
           ["copper0", "copper1", "copper2", "copper3"], ["lamp0", "lamp1", "lamp2", "lamp3"],
           ["moss0", "moss1", "moss2", "moss3", "moss4", "moss5"], ["water0", "water1", "water2", "water3", "water4"],
           ["iron0", "iron1", "iron2"], ["cloud0", "cloud1", "cloud2", "cloud3"], ["sky0", "sky1", "sky2", "sky3", "sky4"],
           ["grass0", "grass1", "grass2", "grass3"], ["pave0", "pave1", "pave2", "pave3"], ["slag0", "slag1", "violet"]):
    for _i, _n in enumerate(_r):
        RAMP_OF[_n] = _r[:_i + 1]


def lum(c):
    r, g, b = c[:3]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def calm_corner(sk, row, ay, pip):
    """The pip corner (top-right 6x6 of the tile) never gets brighter than the base was there (or
    steel3, whichever is lighter): a brighter recolour steps down its own ramp."""
    if not pip:
        return
    w = sk.width
    lim = max([lum(bs.getpixel((x, y))) for bs in row for x in range(w - 6, w) for y in range(ay, ay + 6)
               if bs.getpixel((x, y))[3]] + [lum(rgb(P["steel3"]))]) + 1
    for y in range(ay, ay + 6):
        for x in range(w - 6, w):
            p = sk.getpixel((x, y))
            if not p[3] or lum(p) <= lim:
                continue
            n = INV.get(p[:3])
            ramp = RAMP_OF.get(n, [n])
            fit = [c for c in ramp if lum(rgb(P[c])) <= lim]
            c = fit[-1] if fit else ramp[0]
            sk.putpixel((x, y), rgb(P[c]) + (255,))


def skin(sid, basename, fn, on_skid=None, pip=True):
    """Ship skin_<sid>_<basename>: fn(F) edits each frame in place."""
    rows, meta = frames(basename)
    fw, fh = meta["frame"]
    if on_skid is None:
        on_skid = "facings" in meta
    sk = skid(fw).load() if on_skid and fw in (16, 32) else None
    out = []
    for r, row in enumerate(rows):
        orow = []
        for i, fr in enumerate(row):
            im = fr.copy()
            fn(F(im, r, i, meta, sk))
            calm_corner(im, row, meta["anchor"][1] if basename == "pole" else 0, pip)
            orow.append(im)
        out.append(orow)
    name = f"skin_{sid}_{basename}"
    cols = max(len(r) for r in out)
    img, _ = base(basename)
    sheet = new(img.width, img.height)
    per = max(1, img.width // fw)
    flat = [f for r in out for f in r]
    for i, f in enumerate(flat):
        sheet.alpha_composite(f, ((i % per) * fw, (i // per) * fh))
    check(name, sheet)
    m = {k: v for k, v in meta.items() if not k.startswith("_")}
    m.update({"skin": sid, "base": basename})
    sheet.save(SRC_ART / f"{name}.png")
    (SRC_ART / f"{name}.json").write_text(json.dumps(m) + "\n", newline="\n")
    sheet.save(OUT / f"{name}.png")
    SHIPPED.append((name, basename))
    print(f"  {name}: {len(flat)} x {fw}x{fh}, {colours(sheet)} colours")
    return sheet
