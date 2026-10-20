"""Look at shipped sheets: python sheetlook.py <scale> <out.png> <name>... (src/art/<name>.png),
one per row on deck brown (wood3), so sprites are judged on the floor they stand on."""
import sys

from PIL import Image

from common import SRC_ART, rgb, P

sc, out, names = int(sys.argv[1]), sys.argv[2], sys.argv[3:]
ims = [Image.open(SRC_ART / f"{n}.png").convert("RGBA") for n in names]
W = max(i.width for i in ims) + 4
H = sum(i.height + 4 for i in ims)
img = Image.new("RGBA", (W, H), rgb(P["wood3"]) + (255,))
y = 2
for im in ims:
    img.alpha_composite(im, (2, y))
    y += im.height + 4
img.resize((W * sc, H * sc), Image.NEAREST).save(out)
