"""Compare ways to bring a 32 px draft down to a 16 px tile: python look2.py out.png names..."""
import sys

from PIL import Image

from common import RAW, halve, rgb, P, new, clean_edges, despeckle, lum, draw

DIRS = ["east", "south", "west", "north"]


def shrink_fit(im, box=15, method=Image.NEAREST):
    bb = im.getbbox()
    c = im.crop(bb)
    s = min(box / c.width, box / c.height)
    w, h = max(1, round(c.width * s)), max(1, round(c.height * s))
    r = c.resize((w, h), method)
    a = r.split()[3].point(lambda v: 255 if v >= 128 else 0)
    r.putalpha(a)
    out = new(16, 16)
    out.alpha_composite(r, ((16 - w) // 2, 16 - h))
    return out


def strip_outline(im):
    """Peel the draft's own dark outer ring before shrinking, so it is not doubled."""
    im = im.copy()
    px = im.load()
    w, h = im.size
    kill = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and lum(px[x, y]) < 40:
                if any(not (0 <= x + dx < w and 0 <= y + dy < h) or not px[x + dx, y + dy][3]
                       for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))):
                    kill.append((x, y))
    for x, y in kill:
        px[x, y] = (0, 0, 0, 0)
    return im


if __name__ == "__main__":
    out, names = sys.argv[1], sys.argv[2:]
    img = Image.new("RGBA", (18 * 4 * 3 + 16, 18 * len(names)), rgb(P["wood3"]) + (255,))
    for j, n in enumerate(names):
        for i, d in enumerate(DIRS):
            im = Image.open(RAW / n / f"{d}.png").convert("RGBA")
            a = clean_edges(halve(im))
            b = clean_edges(shrink_fit(strip_outline(im)))
            c = clean_edges(shrink_fit(strip_outline(im), 14))
            for k, v in enumerate((a, b, c)):
                img.alpha_composite(v, (k * (18 * 4 + 8) + i * 18 + 1, j * 18 + 1))
    img.resize((img.width * 5, img.height * 5), Image.NEAREST).save(out)
