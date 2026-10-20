"""Machines in 3/4 view with four facings (rows east, south, west, north), from PixelLab
8-direction drafts (32 px, palette B, see prompts.md), finished here:

- Mk1 (16x16): the draft's own dark rim is peeled, the sprite shrunk to fit 15x15 with one crop box
  and scale shared by every frame and facing (no jitter, one size), its outline redrawn in ink.
- Mk2 (32x32): the same draft at full size, centred on its 2x2 footprint, outline cleaned.
- Working animation: PixelLab's animate_object frames where the motion is mechanical (drill,
  ram, arms, flywheel, drum); a hand-made fire flicker (glow colours cycled) where it is heat.
- "front" is the output side. PixelLab's east/west are swapped on some drafts; `swap` fixes that.
"""
from pathlib import Path

from PIL import Image

from common import P, RAW, new, clean_edges, export, recolor, lum, rgb, draw, get

DIRS = ["east", "south", "west", "north"]

MACHINES = {
    # name: raw folder, swap east/west, animation ('anim' folder from animate_object | 'fire' | None), fps
    "miner": dict(src="t_miner", swap=False, anim="miner_work", fps=12),
    "smelter": dict(src="t_smelter2", swap=True, anim="fire", fps=8),
    "press": dict(src="press", swap=False, anim="press_work", fps=8),
    "assembler": dict(src="assembler", swap=False, anim="assembler_work", fps=8),
    "furnace": dict(src="furnace", swap=False, anim="fire", fps=8),
    "boiler": dict(src="boiler", swap=False, anim="fire", fps=8),
    "steam_engine": dict(src="steam_engine", swap=True, anim="steam_engine_work", fps=10),
    "generator": dict(src="generator", swap=False, anim="fire", fps=12),
    "kiln": dict(src="kiln", swap=False, anim="fire", fps=8),
    "mixer": dict(src="mixer", swap=False, anim="mixer_work", fps=8),
    "refinery": dict(src="refinery", swap=False, anim="fire", fps=6),
}
MK2 = {"smelter_mk2": "smelter", "press_mk2": "press", "assembler_mk2": "assembler"}

GLOW = [P["lamp0"], P["lamp1"], P["lamp2"], P["lamp3"]]
VIOLET_GLOW = [P["slag1"], P["violet"]]


def strip_rim(im):
    """Peel the draft's dark outer ring (it would double up once shrunk and re-outlined)."""
    im = im.copy()
    px = im.load()
    w, h = im.size
    kill = [(x, y) for y in range(h) for x in range(w)
            if px[x, y][3] and lum(px[x, y]) < 40 and any(
                not (0 <= x + dx < w and 0 <= y + dy < h) or not px[x + dx, y + dy][3]
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)))]
    for x, y in kill:
        px[x, y] = (0, 0, 0, 0)
    return im


def harden(im):
    a = im.split()[3].point(lambda v: 255 if v >= 128 else 0)
    im.putalpha(a)
    return im


def flicker(im, f):
    """Fire: the glow colours step up or down a notch per frame (f 0..3), the hottest pixels
    staying hot; a frame of the cycle is a little dimmer so the fire breathes."""
    shift = [0, 1, 0, -1][f % 4]
    if not shift:
        return im
    m = {}
    for i, c in enumerate(GLOW):
        j = max(0, min(len(GLOW) - 1, i + shift))
        m[c] = GLOW[j]
    m[VIOLET_GLOW[0]] = VIOLET_GLOW[1] if shift > 0 else VIOLET_GLOW[0]
    return recolor(im, m)


def load_dir(name, d):
    return Image.open(RAW / name / f"{d}.png").convert("RGBA")


def frames_for(spec, d):
    """The working frames of one facing at draft size (frame 0 is the idle pose)."""
    base = load_dir(spec["src"], d)
    anim = spec["anim"]
    if anim == "fire":
        return [flicker(base, f) for f in range(4)]
    if anim and (RAW / anim / f"{d}_0.png").exists():
        # the animation's own frames only: its canvas may sit differently from the rotation's,
        # and frame 0 (the stopped pose) is its first frame
        out = []
        i = 0
        while (RAW / anim / f"{d}_{i}.png").exists():
            out.append(Image.open(RAW / anim / f"{d}_{i}.png").convert("RGBA"))
            i += 1
        return out
    return [base]


def facings(spec):
    """{facing: [frames]} with east/west swapped where the draft faces the other way."""
    got = {d: frames_for(spec, d) for d in DIRS}
    if spec["swap"]:
        got["east"], got["west"] = got["west"], got["east"]
    return got


def union_box(frames):
    boxes = [f.getbbox() for f in frames if f.getbbox()]
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


def drop_shadow(im, col=None):
    """A 1 px shadow down-right in dark deck brown, baked in: the machine sits on the floor."""
    col = col or P["wood1"]
    out = new(*im.size)
    a = im.load()
    pts = [(x + 1, y + 1) for y in range(im.height) for x in range(im.width) if a[x, y][3]]
    draw(out, pts, col)
    out.alpha_composite(im)
    return out


def shrink(rows, box=15, size=16):
    """Shrink each facing's frames to fill a box x box square (one crop box and scale for all of
    a facing's frames, the same scale for east and west), bottom-centred, re-outlined, shadowed."""
    stripped = {d: [strip_rim(f) for f in fr] for d, fr in rows.items()}
    boxes = {d: union_box(fr) for d, fr in stripped.items()}
    # a long, low facing (a drill seen side-on) may grow up to 1.35x past "fits the width" so it
    # keeps some mass; what then sticks out is cut at the back, never at the front
    fit = {}
    for d, b in boxes.items():
        w0, h0 = b[2] - b[0], b[3] - b[1]
        fit[d] = min(box / h0, 1.35 * min(box / w0, box / h0))
    fit["east"] = fit["west"] = min(fit["east"], fit["west"])
    out = {}
    for d, fr in stripped.items():
        b, s = boxes[d], fit[d]
        w, h = max(1, round((b[2] - b[0]) * s)), max(1, round((b[3] - b[1]) * s))
        res = []
        for f in fr:
            c = harden(f.crop(b).resize((w, h), Image.NEAREST))
            if w > box:
                cut = w - box
                c = c.crop((cut, 0, w, h)) if d == "east" else c.crop((0, 0, w - cut, h)) if d == "west" \
                    else c.crop((cut // 2, 0, w - (cut - cut // 2), h))
            cv = new(size, size)
            cv.alpha_composite(c, ((box - c.width) // 2, box - h))
            res.append(drop_shadow(clean_edges(cv)))
        out[d] = res
    return out


def full(rows, size=32):
    """Mk2: the draft at its own size, bottom-centred on the 2x2 footprint."""
    out = {}
    for d, fr in rows.items():
        b = union_box(fr)
        res = []
        for f in fr:
            c = f.crop(b)
            cv = new(size, size)
            cv.alpha_composite(c, ((size - c.width) // 2, size - c.height - 1))
            res.append(clean_edges(cv))
        out[d] = res
    return out


def to_rows(fs):
    n = max(len(v) for v in fs.values())
    rows = []
    for d in DIRS:
        fr = fs[d]
        rows.append([fr[i % len(fr)] for i in range(n)])
    return rows


def build(only=None):
    done = {}
    for name, spec in MACHINES.items():
        if only and name not in only:
            continue
        if not (RAW / spec["src"]).exists():
            print("missing draft", name)
            continue
        fs = facings(spec)
        mk1 = shrink(fs)
        export(name, to_rows(mk1), spec["fps"], facings=4)
        done[name] = fs
    for mk2, base in MK2.items():
        if only and mk2 not in only and base not in only:
            continue
        spec = MACHINES[base]
        fs = done.get(base) or facings(spec)
        export(mk2, to_rows(full(fs)), spec["fps"], facings=4)
    print("machines:", ", ".join(done))


if __name__ == "__main__":
    import sys
    build(sys.argv[1:] or None)
