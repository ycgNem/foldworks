"""dump.py <name> [frame] : a frame's pixels as palette-name initials (to place details)."""
import sys

import m11

rows, meta = m11.frames(sys.argv[1])
i = int(sys.argv[2]) if len(sys.argv) > 2 else 0
flat = [f for r in rows for f in r]
f = m11.F(flat[i].copy(), 0, i, meta)
AB = {}
for y in range(f.h):
    line = []
    for x in range(f.w):
        n = f.name(x, y)
        line.append(f"{(n or '.'):>7}")
    print(f"{y:2} " + "".join(line))
