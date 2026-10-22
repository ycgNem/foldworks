"""Which palette colours a sheet uses (by name, with counts): for planning the island recolours.
python census.py <name>..."""
import sys
from collections import Counter

from c4 import P, SRC_ART, OUT
from PIL import Image

INV = {}
for k, v in P.items():
    INV[tuple(int(v.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))] = k

for n in sys.argv[1:]:
    p = SRC_ART / f"{n}.png"
    if not p.exists():
        p = OUT / f"{n}.png"
    im = Image.open(p).convert("RGBA")
    c = Counter(INV.get(px[:3], str(px[:3])) for px in im.getdata() if px[3])
    print(n, " ".join(f"{k}:{v}" for k, v in c.most_common()))
