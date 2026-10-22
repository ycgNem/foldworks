"""Which palette colours each base sheet uses, by name, most used first (to plan the recolours)."""
import sys
from collections import Counter

import m11

for n in sys.argv[1:]:
    img, meta = m11.base(n)
    c = Counter(m11.INV.get(p[:3], "?") for p in img.getdata() if p[3])
    print(n, " ".join(f"{k}:{v}" for k, v in c.most_common()))
