"""Look helper: PNGs enlarged on a background, stacked, written to out/look_<tag>.png.
python look.py <tag> <scale> <bg hex> <png>...  (names resolve in src/art/ unless the path exists)"""
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ART = HERE.parents[1] / "src" / "art"


def main():
    tag, k, bg = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    ims = []
    for p in sys.argv[4:]:
        q = Path(p) if Path(p).exists() else ART / p
        if not q.exists():
            q = HERE / "out" / p
        ims.append(Image.open(q).convert("RGBA"))
    W = max(i.width for i in ims) * k
    H = sum(i.height * k + 4 for i in ims)
    out = Image.new("RGBA", (W, H), bg)
    y = 0
    for i in ims:
        b = Image.new("RGBA", i.size, bg)
        b.alpha_composite(i)
        out.paste(b.resize((i.width * k, i.height * k), Image.NEAREST), (0, y))
        y += i.height * k + 4
    (HERE / "out").mkdir(exist_ok=True)
    out.save(HERE / "out" / f"look_{tag}.png")


main()
