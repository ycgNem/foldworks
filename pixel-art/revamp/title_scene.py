"""title_scene: the title screen's key art, 320x180 x8 at 8 fps (the game draws it at an integer
scale that covers the screen, centred and cropped).

The backdrop is PixelLab's dusk bayou (raw/title/bg_a.png, prompts.md), regraded into Lantern
Bayou by region: the lower sky to dusk violet, the far hills to a blue-grey haze, the water to the
bayou's teal. Over it, by hand, the game's own sprites: the Workshop deck at the bottom left with
an ore patch, a miner, a smelter and a belt running into the Dock, a brass module glowing on the
deck; at the right a boardwalk with Mayor Bramble (top hat, sash, medal) and a frog townsperson
under a lamp post; lily pads on the water.

Motion: the lantern and moon reflections shimmer row by row, the horizon town's windows and every
lantern flicker, stars twinkle, the belt runs and items ride it into the Dock, the module's band
lanterns breathe. The calm areas the title screen draws on: the sky band behind the logo and
tagline (y 14-66), the open water in the middle (x 120-200, y 100-140) under the buttons, and the
dark water along the bottom for the last line."""
import math

from PIL import Image

from common import P, RAW, SRC_ART, new, draw, rgb, recolor, snap, export, scale, OUT, from_rows

W, H, N = 320, 180, 8
LAMPS = [P["lamp0"], P["lamp1"], P["lamp2"], P["lamp3"]]


def sprite(name, i=0, row=None):
    import json
    meta = json.loads((SRC_ART / f"{name}.json").read_text())
    fw, fh = meta["frame"]
    im = Image.open(SRC_ART / f"{name}.png").convert("RGBA")
    y = (row or 0) * fh
    return im.crop((i * fw, y, i * fw + fw, y + fh))


def regrade(bg):
    out = bg.copy()
    sky = recolor(bg, {P["iron0"]: P["slag0"], P["iron1"]: P["steel3"]})
    hills = recolor(bg, {P["iron1"]: P["steel2"]})
    water = recolor(bg, {P["iron0"]: P["water1"], P["iron1"]: P["water2"], P["ink2"]: P["water0"]})
    out.paste(sky.crop((0, 0, W, 60)), (0, 0))
    out.paste(hills.crop((0, 60, W, 92)), (0, 60))
    out.paste(water.crop((0, 92, W, H)), (0, 92))
    return out


REFLECT = {rgb(P[c]) for c in ("copper3", "wood5", "teal", "steel4", "water3", "lamp2", "lamp3", "bone")}


def shimmer(bg, f):
    """Reflections below the horizon slide a pixel left or right, row by row, in a slow wave."""
    out = bg.copy()
    a, o = bg.load(), out.load()
    for y in range(96, H):
        dx = round(math.sin(f * math.pi / 4 + y * 0.9))
        for x in range(W):
            if a[x, y][:3] in REFLECT:
                o[x, y] = rgb(P["water1"]) + (255,)
        for x in range(W):
            if a[x, y][:3] in REFLECT and 0 <= x + dx < W:
                o[x + dx, y] = a[x, y]
    return out


def flicker(im, f, box):
    """Step the lamp ramp up or down a notch inside box (frames 0..7)."""
    shift = [0, 1, 0, -1, 0, 1, 1, 0][f]
    if not shift:
        return im
    m = {c: LAMPS[max(0, min(3, i + shift))] for i, c in enumerate(LAMPS)}
    m[P["copper3"]] = P["lamp3"] if shift > 0 else P["copper2"]
    reg = recolor(im.crop(box), m)
    out = im.copy()
    out.paste(reg, box[:2])
    return out


def twinkle(im, f):
    out = im.copy()
    a = out.load()
    k = 0
    for y in range(0, 58):
        for x in range(W):
            c = a[x, y][:3]
            if c in (rgb(P["steel4"]), rgb(P["bone"]), rgb(P["steel3"])) and not (180 <= x <= 222 and 14 <= y <= 46):
                k += 1
                if (k + f) % 5 == 0:
                    a[x, y] = rgb(P["steel1"]) + (255,)
    return out


BRAMBLE = [
    "......kkkk......",
    "......kddk......",
    ".....kkkkkk.....",
    ".....kk..kk.....",
    "....kbbkkbbk....",
    "....kbkGGbkk....",
    "...kGGGGGGGGk...",
    "...kGGGGGGGGGk..",
    "...kmGGGGkkkkk..",
    "...kkmmGGGGGGk..",
    "..kckRccccccck..",
    ".kRRkmIIIgIIk...",
    "..kkkmIIIIIk....",
    ".....kmmmmk.....",
    "...kmk...kGk....",
    "..kmmk..kGGk....",
]
BRAMBLE_KEY = {"k": P["ink"], "d": P["ink2"], "b": P["bone"], "G": P["moss5"], "m": P["moss3"],
               "c": P["copper1"], "R": P["copper0"], "I": P["iron0"], "g": P["lamp2"]}


def foreground(img, f):
    put = lambda im, x, y: img.alpha_composite(im, (x, y))
    # the deck: back edge (moss lip), three rows of planks, its front face and pilings, its side
    for x in range(0, 112, 16):
        put(sprite("tile_shore", 2), x, 104)
        for r, y in enumerate((120, 136, 152)):
            put(sprite("tile_floor", (x // 16 + r) % 4), x, y)
        put(sprite("tile_shore", 0), x, 168)
    # the deck's east edge: plank ends, an ink line, its shadow on the water
    draw(img, [(112, y) for y in range(118, 172)], P["ink"])
    draw(img, [(111, y) for y in range(120, 168) if y % 16 not in (7, 8)], P["wood1"])
    draw(img, [(113, y) for y in range(120, 172) if y % 3], P["water0"])
    # an iron ore patch, a miner on it, a smelter, a belt into the Dock
    for i, (dx, dy) in enumerate(((0, 0), (16, 0), (0, 16), (16, 16))):
        put(sprite("tile_ore_iron", i), dx, 120 + dy)
    for x in (48, 64):
        put(sprite("belt", f % 4), x, 128)
    put(sprite("miner", f % 4, row=0), 16, 128)
    put(sprite("smelter", f % 4, row=0), 32, 128)
    items = [sprite("items", 2), sprite("items", 2)]          # iron ingots from the smelter
    for k in range(2):
        ix = 48 + ((f * 2 + k * 16) % 32)
        if ix < 76:
            put(items[k], ix + 4, 132)
    put(sprite("dock", f // 4 % 2), 80, 120)
    put(sprite("heap", 3), 32, 144)
    # a brass module glowing on the deck, a Gizmo in its well
    put(sprite("module"), 56, 148)
    put(sprite("items", 9), 60, 152)                          # the Gizmo
    put(sprite("module_glow", f % 4), 56, 148)
    # the boardwalk at the right, Bramble and a townsperson under a lamp
    put(sprite("town_boardwalk", 7), 208, 136)
    for x in range(224, 320, 16):
        put(sprite("town_boardwalk", 0), x, 136)
    put(sprite("town_lamp", f % 4), 290, 116)
    bram = from_rows(BRAMBLE, BRAMBLE_KEY)
    put(bram, 246, 130 - (1 if f in (2, 3) else 0))
    frog = sprite("town_frog", 0).transpose(Image.FLIP_LEFT_RIGHT)
    put(frog, 266, 130)
    # lily pads drifting on the open water, clear of the buttons
    put(sprite("town_lily", 0), 140, 146)
    put(sprite("town_lily", 2), 200, 140)


def build():
    bg = regrade(snap(Image.open(RAW / "title" / "bg_a.png").convert("RGBA")))
    frames = []
    for f in range(N):
        im = shimmer(bg, f)
        im = flicker(im, f, (0, 70, W, 100))
        im = twinkle(im, f)
        foreground(im, f)
        im = flicker(im, (f + 3) % N, (280, 110, 320, 135))
        frames.append(im)
    export("title_scene", frames, 8)
    scale(frames[0], 3).save(OUT / "title_scene_f0@3x.png")


if __name__ == "__main__":
    build()
