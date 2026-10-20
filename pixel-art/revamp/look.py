"""Contact strips for looking at drafts: python look.py <scale> <out.png> <name>... (raw/<name>/<dir>.png)
and, under each, the 16 px halving."""
import sys

from PIL import Image

from common import RAW, halve, rgb, P

DIRS = ["east", "south", "west", "north"]
sc, out, names = int(sys.argv[1]), sys.argv[2], sys.argv[3:]
cell = 36
img = Image.new("RGBA", (cell * 4 * 2 + 8, cell * len(names)), rgb(P["wood3"]) + (255,))
for j, n in enumerate(names):
    for i, d in enumerate(DIRS):
        p = RAW / n / f"{d}.png"
        if not p.exists():
            continue
        im = Image.open(p).convert("RGBA")
        img.alpha_composite(im, (i * cell + 1, j * cell + 1))
        img.alpha_composite(halve(im), (cell * 4 + 8 + i * 18 + 1, j * cell + 9))
img.resize((img.width * sc, img.height * sc), Image.NEAREST).save(out)
