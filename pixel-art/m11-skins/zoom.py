"""zoom.py <src_art name> <k> [frame] : out/zoom_<name>.png, one frame (or the whole sheet) enlarged
with a pixel grid every pixel and a stronger line every 4, to place details by coordinate."""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
SRC = HERE.parents[1] / "src" / "art"
OUT = HERE / "out"

name, k = sys.argv[1], int(sys.argv[2])
img = Image.open((OUT if name.startswith("skin_") and (OUT / f"{name}.png").exists() else SRC) / f"{name}.png").convert("RGBA")
if len(sys.argv) > 3:
    import json
    meta = json.loads((SRC / f"{name}.json").read_text())
    fw, fh = meta["frame"]
    i = int(sys.argv[3])
    per = img.width // fw
    img = img.crop(((i % per) * fw, (i // per) * fh, (i % per) * fw + fw, (i // per) * fh + fh))
bg = Image.new("RGBA", img.size, (185, 173, 151, 255))
bg.alpha_composite(img)
big = bg.resize((img.width * k, img.height * k), Image.NEAREST)
d = ImageDraw.Draw(big)
for x in range(img.width + 1):
    d.line([(x * k, 0), (x * k, big.height)], fill=(0, 0, 0, 255) if x % 4 == 0 else (90, 90, 90, 255))
for y in range(img.height + 1):
    d.line([(0, y * k), (big.width, y * k)], fill=(0, 0, 0, 255) if y % 4 == 0 else (90, 90, 90, 255))
big.save(OUT / f"zoom_{name}.png")
