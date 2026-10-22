"""Look at the base sheets the Milestone 11 skins replace (out/bases_*.png, enlarged on the paving)."""
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
SRC = HERE.parents[1] / "src" / "art"
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
BG = (185, 173, 151, 255)


def look(names, k, tag):
    ims = [Image.open(SRC / f"{n}.png").convert("RGBA") for n in names]
    w = max(i.width for i in ims) + 4
    h = sum(i.height + 4 for i in ims)
    out = Image.new("RGBA", (w, h), BG)
    y = 2
    for i in ims:
        out.alpha_composite(i, (2, y))
        y += i.height + 4
    out.resize((w * k, h * k), Image.NEAREST).save(OUT / f"bases_{tag}.png")


if __name__ == "__main__":
    look(sys.argv[3:], int(sys.argv[1]), sys.argv[2])
