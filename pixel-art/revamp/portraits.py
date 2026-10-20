"""Customer portraits, 48x48 (frame 0 the face, frame 1 a blink) with a cheer pair (frame 1 the
top of a bounce, 1 px up) and a 24x24 small version.

Bramble: PixelLab img2img over his Milestone 1 portrait (same face, richer shading), cheer the
same over his cheer. The Committee: PixelLab's raccoon in a fedora and trench coat, and the gag
finished by hand: a second raccoon peeking between the lapels and a third one's ringed tail out
of the hem (three raccoons, one coat). Unit 7 and Dame Voltaire keep their hand-drawn portraits,
recoloured into Lantern Bayou (img2img lost Unit 7's screen face and changed Voltaire's skin)."""
from PIL import Image

from common import P, RAW, SRC_ART, new, draw, export, snap, from_rows, get, halve, rgb, OUT, scale, on_bg

PR = RAW / "portraits"


def load(p):
    return snap(Image.open(p).convert("RGBA"))


def blink(im, eyes, skin, lid=None):
    """Close the eyes: each eye box is filled with the skin colour and a lid line drawn across."""
    out = im.copy()
    for (x0, y0, x1, y1) in eyes:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if get(out, x, y)[3]:
                    draw(out, [(x, y)], skin)
        mid = (y0 + y1) // 2 + 1
        draw(out, [(x, mid) for x in range(x0 + 1, x1)], lid or P["ink"])
        draw(out, [(x0, mid - 1), (x1, mid - 1)], lid or P["ink"])
    return out


def bounce(im):
    out = new(48, 48)
    out.alpha_composite(im.crop((0, 1, 48, 48)), (0, 0))
    return out


PEEK = [       # the second raccoon, peeking between the lapels
    "kg.....gk",
    "kgwgggwgk",
    "gkkkgkkkg",
    "gkekgkekg",
    "gwwwkwwwg",
    ".gwwwwwg.",
    "..kgggk..",
]
TAIL = [       # the third one's ringed tail out of the hem
    "...kk.",
    "..kggk",
    "..kkkk",
    ".kggk.",
    ".kkkk.",
    "kggk..",
    "kkkk..",
    "kkk...",
]
KEY = {"g": P["steel3"], "w": P["bone"], "k": P["ink"], "e": P["steel4"], "n": P["ink2"]}


def committee_extras(im, peek_at, tail_at):
    out = im.copy()
    out.alpha_composite(from_rows(PEEK, KEY), peek_at)
    out.alpha_composite(from_rows(TAIL, KEY), tail_at)
    return out


def small(im, ox=1, oy=1):
    """48 -> 24: one pixel of each 2x2 block, (ox, oy) inside it (lower-right by default; the
    Committee reads best from the lower-left, which keeps the raccoon's mask and eyes)."""
    out = new(24, 24)
    a = im.load()
    for y in range(24):
        for x in range(24):
            out.putpixel((x, y), a[2 * x + ox, 2 * y + oy])
    return out


def old(name):
    """A hand-drawn portrait sheet from Milestones 1-4, already recoloured into B in src/art."""
    im = Image.open(SRC_ART / f"{name}.png").convert("RGBA")
    return [im.crop((i * 48, 0, i * 48 + 48, 48)) for i in range(im.width // 48)]


def build():
    # Bramble
    b = load(PR / "bramble.png")
    green = P["moss5"]
    b_blink = blink(b, [(14, 16, 19, 22), (34, 16, 39, 22)], green, P["moss2"])
    export("portrait_bramble", [b, b_blink])
    bc = load(PR / "bramble_cheer.png")
    export("portrait_bramble_cheer", [bc, bounce(bc)])
    export("portrait_bramble_small", [small(b)])
    # the Committee
    c = committee_extras(load(PR / "committee.png"), (19, 33), (1, 39))
    c_blink = blink(c, [(17, 17, 21, 20), (28, 17, 32, 20)], P["ink2"], P["ink"])
    export("portrait_committee", [c, c_blink])
    cc = committee_extras(load(PR / "committee_cheer.png"), (19, 35), (1, 39))
    export("portrait_committee_cheer", [cc, bounce(cc)])
    export("portrait_committee_small", [small(c, 0, 1)])
    # Unit 7 and Dame Voltaire: their own portraits (recoloured), plus small versions
    for who in ("unit7", "voltaire"):
        fr = old(f"portrait_{who}")
        export(f"portrait_{who}_small", [small(fr[0])])
    look = new(52 * 8, 52)
    ims = [b, b_blink, bc, c, c_blink, cc, old("portrait_unit7")[0], old("portrait_voltaire")[0]]
    for i, im in enumerate(ims):
        look.alpha_composite(im, (i * 52 + 2, 2))
    scale(on_bg(look, P["ink1"]), 4).save(OUT / "portraits_look@4x.png")


if __name__ == "__main__":
    build()
