"""stack.py <out_name> look_a look_b ... : the looks side by side (to read several at once)."""
import sys
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent / "out"
ims = [Image.open(OUT / f"look_{n}.png") for n in sys.argv[2:]]
w = sum(i.width + 8 for i in ims)
h = max(i.height for i in ims)
s = Image.new("RGBA", (w, h), (24, 20, 32, 255))
x = 0
for i in ims:
    s.paste(i, (x, 0))
    x += i.width + 8
s.save(OUT / f"stack_{sys.argv[1]}.png")
