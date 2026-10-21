"""The ore outcrops re-seated on the sky island's ground (docs/sky-island.md: the ores bake the
deck's shadow colours, wood0-3, round their holes; those are remapped onto paving and meadow).

Source: pixel-art/revamp/ores.py's own outputs (pixel-art/revamp/out/tile_ore_<ore>.png and
_spill.png, the outcrops as drawn for the plank deck), never src/art (so a rerun never remaps
twice). Only the ground round the rock is remapped: the wood pixels reachable from the clear
area without crossing the rock's ink outline (the cast shadow, the hole's rim, the spill's
stains), so a rock's own warm facets keep their colour.

Outputs to src/art (and out/):
- tile_ore_<ore>.png, 9 frames: 0 the whole outcrop at 16x16 (unchanged, for the Survey Office),
  1-4 the quadrants (TL TR BL BR) seated on paving, 5-8 the same seated on meadow. The JSON keeps
  "glints" (and "embers") and adds "seats": ["pave", "meadow"].
- tile_ore_<ore>_spill.png, 32 frames: 0-15 the 4x4 apron on paving, 16-31 on meadow.
Run `python ores_reseat.py` from this folder.
"""
import json
from collections import deque
from pathlib import Path

from PIL import Image

from common import P, OUT, SRC_ART, rgb, export, new, sheet_spaced, scale

REV = Path(__file__).resolve().parents[1] / "revamp" / "out"
SEATS = {
    "pave": {"wood0": "pave0", "wood1": "pave0", "wood2": "pave1", "wood3": "pave2"},
    "meadow": {"wood0": "grass0", "wood1": "grass0", "wood2": "grass1", "wood3": "grass2"},
}
INK = rgb(P["ink"])


def frames_of(path, fw=16):
    img = Image.open(path).convert("RGBA")
    return [img.crop((i * fw, 0, i * fw + fw, img.height)) for i in range(img.width // fw)]


def ground_mask(img, outlined=True):
    """Pixels of `img` reachable from its clear area (or the frame edge) without crossing ink."""
    w, h = img.size
    px = img.load()
    seen = set()
    q = deque()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0:
                seen.add((x, y))
                q.append((x, y))
    # the frame's edge counts as outside too (a quadrant's cut edge is still ground)
    for x in range(w):
        for y in (0, h - 1):
            if (x, y) not in seen and px[x, y][:3] != INK:
                seen.add((x, y))
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if (x, y) not in seen and px[x, y][:3] != INK:
                seen.add((x, y))
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if 0 <= n[0] < w and 0 <= n[1] < h and n not in seen and (not outlined or px[n][:3] != INK):
                seen.add(n)
                q.append(n)
    return seen


def reseat(img, seat, outlined=True):
    m = {rgb(P[k]): rgb(P[v]) for k, v in SEATS[seat].items()}
    out = img.copy()
    px = out.load()
    for (x, y) in ground_mask(img, outlined):
        p = px[x, y]
        if p[3] and p[:3] in m:
            px[x, y] = m[p[:3]] + (255,)
    return out


def whole(q):
    o = new(32, 32)
    for i, (x, y) in enumerate(((0, 0), (16, 0), (0, 16), (16, 16))):
        o.alpha_composite(q[i], (x, y))
    return o


def quads(o):
    return [o.crop((0, 0, 16, 16)), o.crop((16, 0, 32, 16)), o.crop((0, 16, 16, 32)), o.crop((16, 16, 32, 32))]


def apron(sp):
    a = new(64, 64)
    for i, f in enumerate(sp):
        a.alpha_composite(f, ((i % 4) * 16, (i // 4) * 16))
    return a


def tiles(a):
    return [a.crop(((i % 4) * 16, (i // 4) * 16, (i % 4) * 16 + 16, (i // 4) * 16 + 16)) for i in range(16)]


def build():
    looks = []
    for k in ("iron", "copper", "coal", "sand"):
        meta = json.loads((REV / f"tile_ore_{k}.json").read_text())
        fr = frames_of(REV / f"tile_ore_{k}.png")
        rock = whole(fr[1:5])
        sp = apron(frames_of(REV / f"tile_ore_{k}_spill.png"))
        outlined = k != "sand"          # the dune has no ink outline: its whole apron is ground
        seated = {s: reseat(rock, s, outlined) for s in SEATS}
        # the spill has no rock in it: every wood pixel there is a stain on the ground
        spills = {s: reseat(sp, s, False) for s in SEATS}
        extra = {key: meta[key] for key in ("glints", "embers") if key in meta}
        extra["seats"] = list(SEATS)
        export(f"tile_ore_{k}", [fr[0]] + quads(seated["pave"]) + quads(seated["meadow"]), extra=extra, src=True)
        export(f"tile_ore_{k}_spill", tiles(spills["pave"]) + tiles(spills["meadow"]), extra={"seats": list(SEATS)}, src=True)
        looks.append((k, seated, spills))
    # a look: each ore with its apron on a 4x4 of paving and of meadow, at 1x then 4x
    import ground
    pave = [ground.pave_C(v) for v in range(4)]
    grass = [ground.grass(v) for v in range(4)]
    sheet = Image.new("RGBA", (4 * 68 + 4, 2 * 68 + 4), rgb(P["ink1"]) + (255,))
    for i, (k, seated, spills) in enumerate(looks):
        for j, (seat, base) in enumerate((("pave", pave), ("meadow", grass))):
            sc = Image.new("RGBA", (64, 64))
            for y in range(4):
                for x in range(4):
                    sc.alpha_composite(base[(x * 3 + y * 5) % 4], (x * 16, y * 16))
            sc.alpha_composite(spills[seat])
            sc.alpha_composite(seated[seat], (16, 16))
            sheet.alpha_composite(sc, (4 + i * 68, 4 + j * 68))
    sheet.save(OUT / "ores_reseat_look.png")
    scale(sheet, 4).save(OUT / "ores_reseat_look@4x.png")


if __name__ == "__main__":
    build()
