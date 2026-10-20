"""Halving a 32 px PixelLab draft to a 16 px Mk1 sprite, then cleaning it.

A 2x2 block becomes one pixel: transparent when most of it is; otherwise its commonest colour,
with ties going to the darker colour (outlines survive) and a lone bright pixel kept when the
block is a highlight. Then the outline is redrawn 1 px outside the shape in ink, orphan pixels
go, and the result is snapped to the palette."""
from collections import Counter

from PIL import Image


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def halve(img, alpha_min=2):
    img = img.convert("RGBA")
    w, h = img.width // 2, img.height // 2
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    p, o = img.load(), out.load()
    for y in range(h):
        for x in range(w):
            px = [p[2 * x + i, 2 * y + j] for j in (0, 1) for i in (0, 1)]
            op = [q[:3] for q in px if q[3] >= 128]
            if len(op) < alpha_min:
                continue
            cnt = Counter(op).most_common()
            top = cnt[0][1]
            cands = [c for c, n in cnt if n == top]
            c = min(cands, key=lum) if len(cands) > 1 else cands[0]
            o[x, y] = c + (255,)
    return out


def crop_to(img, w, h, anchor="bottom"):
    """Fit a sprite on a w x h canvas: centred, bottom-aligned (its feet on the last row)."""
    bb = img.getbbox()
    if not bb:
        return Image.new("RGBA", (w, h))
    s = img.crop(bb)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    x = (w - s.width) // 2
    y = h - s.height if anchor == "bottom" else (h - s.height) // 2
    out.alpha_composite(s, (max(0, x), max(0, y)) if s.width <= w and s.height <= h else (x, y))
    return out
