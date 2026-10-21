"""A contact sheet for looking: python look.py <scale> <out.png> <png> [<png> ...] (paths from the
repo root or absolute), each strip on its own row over a sky-blue backdrop, nearest neighbour."""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]


def main():
    k, out = int(sys.argv[1]), sys.argv[2]
    ims = []
    for n in sys.argv[3:]:
        p = Path(n)
        im = Image.open(p if p.is_absolute() else ROOT / p).convert("RGBA")
        ims.append(im.crop((0, 0, min(im.width, 400), im.height)))
    W = max(i.width for i in ims) + 4
    H = sum(i.height + 4 for i in ims)
    sheet = Image.new("RGBA", (W, H), (118, 170, 236, 255))
    y = 2
    for i in ims:
        sheet.alpha_composite(i, (2, y))
        y += i.height + 4
    sheet.resize((W * k, H * k), Image.NEAREST).save(out)


if __name__ == "__main__":
    main()
