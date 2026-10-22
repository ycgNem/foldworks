"""Contact sheet for looking: sheets stacked, enlarged, on the sky.
python contact.py <out png> <scale> <name>...   (names resolve in src/art/, then out/)"""
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ART = HERE.parents[1] / "src" / "art"


def main():
    out, k, names = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
    rows = []
    for n in names:
        p = ART / f"{n}.png"
        if not p.exists():
            p = HERE / "out" / f"{n}.png"
        im = Image.open(p).convert("RGBA")
        bg = Image.new("RGBA", im.size, (118, 170, 236, 255))
        bg.alpha_composite(im)
        rows.append(bg.resize((im.width * k, im.height * k), Image.NEAREST))
    W = max(r.width for r in rows)
    H = sum(r.height + 6 for r in rows)
    o = Image.new("RGBA", (W, H), (30, 30, 40, 255))
    y = 0
    for r in rows:
        o.paste(r, (0, y))
        y += r.height + 6
    p = Path(out)
    if not p.is_absolute():
        (HERE / "out").mkdir(exist_ok=True)
        p = HERE / "out" / out
    o.save(p)
    print(p, o.size)


if __name__ == "__main__":
    main()
