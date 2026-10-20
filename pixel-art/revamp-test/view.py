"""Scale PNGs up (nearest) for looking at: python view.py <scale> <in.png> ... -> <in>@<scale>x.png"""
import sys
from pathlib import Path
from PIL import Image

sc = int(sys.argv[1])
for p in sys.argv[2:]:
    im = Image.open(p).convert("RGBA")
    bg = Image.new("RGBA", im.size, (90, 90, 100, 255))
    bg.alpha_composite(im)
    out = Path(p).with_name(Path(p).stem + f"@{sc}x.png")
    bg.resize((im.width * sc, im.height * sc), Image.NEAREST).save(out)
    print(out)
