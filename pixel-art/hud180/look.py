"""python look.py <out.png> <scale> name [name ...]: the named sprites' frames side by side on the
deck colour, scaled, for a close look (names from out/, or src/art/ with a 'src:' prefix)."""
import json
import sys

from PIL import Image

from kit import OUT, SRC_ART


def frames(name):
    d = SRC_ART if name.startswith("src:") else OUT
    name = name.removeprefix("src:")
    m = json.loads((d / f"{name}.json").read_text())
    im = Image.open(d / f"{name}.png").convert("RGBA")
    w, h = m["frame"]
    return [im.crop((i * w, 0, i * w + w, h)) for i in range(m["frames"])]


def main():
    out, k, names = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
    fr = [f for n in names for f in frames(n)]
    W = sum(f.width + 4 for f in fr)
    H = max(f.height for f in fr)
    img = Image.new("RGBA", (W, H), (158, 106, 66, 255))
    x = 0
    for f in fr:
        img.alpha_composite(f, (x, H - f.height))
        x += f.width + 4
    img.resize((W * k, H * k), Image.NEAREST).save(OUT / out)


if __name__ == "__main__":
    main()
