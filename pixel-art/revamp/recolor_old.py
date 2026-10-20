"""Every sprite in src/art/ still drawn in palette A is swapped into Lantern Bayou colour by colour
(pal.A_TO_B: each A slot to the B colour that plays its role), so the whole game is in one palette
while the redraws land. Sprites already in B are left alone. Run once before the redraws; the
redraw scripts overwrite their own sheets afterwards.
  python recolor_old.py [--dry]"""
import sys

from PIL import Image

from common import SRC_ART, rgb, ART_RGB
from pal import A_TO_B, PIPS

A2B = {rgb(k): rgb(v) for k, v in A_TO_B.items()}
B_SET = set(ART_RGB)
PIP_SET = {rgb(v) for v in PIPS.values()}

if __name__ == "__main__":
    dry = "--dry" in sys.argv
    changed = []
    for p in sorted(SRC_ART.glob("*.png")):
        im = Image.open(p).convert("RGBA")
        cols = {c[:3] for c in im.getdata() if c[3]}
        a_only = cols - B_SET - PIP_SET
        if not a_only:
            continue
        unknown = {c for c in a_only if c not in A2B}
        if unknown:
            print("!", p.name, "has colours outside palette A:", sorted(unknown)[:4])
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                c = px[x, y]
                if c[3] and c[:3] in A2B:
                    px[x, y] = A2B[c[:3]] + (c[3],)
        changed.append(p.name)
        if not dry:
            im.save(p)
    print(len(changed), "recoloured:", " ".join(changed))
