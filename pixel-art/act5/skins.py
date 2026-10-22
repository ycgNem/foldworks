"""The Endless Ledger's cosmetics (docs/endgame.md, Milestone 10: every tenth Ledger order pays a
machine skin): recolours and trims of three common machines, each sheet the base sheet's exact
frame layout (16x16 Mk1 cells or 32x32 Mk2 cells, `"facings": 4` rows east, south, west, north,
frames left to right, the base's fps), so the code swaps the sheet name and nothing else.

    skin_gilded_miner            gold-plated body, a silver (diamond) drill
    skin_candy_press             red-and-bone candy-cane stripes on the diagonal, mint trim
    skin_candy_press_mk2         the same on the Mk2 press
    skin_starlit_assembler       night-blue body sprinkled with stars, a moonlit top
    skin_starlit_assembler_mk2   the same on the Mk2 assembler

The skid is never recoloured (STYLE.md: the dark steel skid says "machine" at 1x before the body
is read): a pixel on the skid's rows that matches the standard skid is kept. Ink, shadows, the
workpieces and every lamp stay as drawn, so working machines still animate the same way and the
pip corner (top-right 4x4) stays calm (stars are never put there). The sidecar names the skin and
its base: {"skin": "gilded", "base": "miner"}.
"""
import json

from PIL import Image

from c5 import P, SRC_ART, hsh, rgb, ship, skid


def rgbm(m):
    return {rgb(P[k]): rgb(P[v]) for k, v in m.items()}


GILDED = rgbm({"steel0": "brass0", "steel1": "brass1", "steel2": "brass2", "steel3": "brass3",
               "brass0": "steel0", "brass1": "steel2", "brass2": "steel3", "brass3": "steel4"})
CANDY_RED = rgbm({"steel0": "copper0", "steel1": "red", "steel2": "copper2", "steel3": "copper3",
                  "brass0": "water2", "brass1": "water4", "brass2": "teal", "brass3": "cloud2"})
CANDY_WHITE = rgbm({"steel0": "pave1", "steel1": "pave3", "steel2": "bone", "steel3": "cloud2",
                    "brass0": "water2", "brass1": "water4", "brass2": "teal", "brass3": "cloud2"})
STARLIT = rgbm({"steel0": "ink2", "steel1": "iron0", "steel2": "iron1", "steel3": "sky1", "steel4": "sky3"})
STARS = [rgb(P["lamp3"]), rgb(P["cloud2"]), rgb(P["bone"])]


def base(name):
    img = Image.open(SRC_ART / f"{name}.png").convert("RGBA")
    meta = json.loads((SRC_ART / f"{name}.json").read_text())
    return img, meta


def skin(name, kind):
    img, meta = base(name)
    fw, fh = meta["frame"]
    top = 12 if fw == 16 else 25
    sk = skid(fw).load()
    out = img.copy()
    px = out.load()
    for y in range(img.height):
        for x in range(img.width):
            p = px[x, y]
            if not p[3]:
                continue
            lx, ly = x % fw, y % fh
            if ly >= top and sk[lx, ly][3] and sk[lx, ly][:3] == p[:3]:
                continue                      # the skid stays the skid
            c = p[:3]
            if kind == "gilded":
                c = GILDED.get(c, c)
            elif kind == "candy":
                k = 2 if fw == 16 else 3      # stripe width
                red = ((lx + ly) // k) % 2 == 0
                c = (CANDY_RED if red else CANDY_WHITE).get(c, c)
            elif kind == "starlit":
                n = STARLIT.get(c, c)
                # stars on the night body, never in the pip corner, sparse, by position
                if n in (rgb(P["iron0"]), rgb(P["ink2"])) and not (lx >= fw - 5 and ly <= 4) \
                        and hsh(lx, ly, fw, 7) % (6 if fw == 16 else 11) == 0:
                    n = STARS[hsh(lx, ly, 3) % 3]
                c = n
            px[x, y] = c + (255,)
    return out, meta


SKINS = [("gilded", "miner"), ("candy", "press"), ("candy", "press_mk2"), ("starlit", "assembler"),
         ("starlit", "assembler_mk2")]


def build():
    for kind, name in SKINS:
        img, meta = skin(name, kind)
        fw, fh = meta["frame"]
        cols, rows = img.width // fw, img.height // fh
        grid = [[img.crop((c * fw, r * fh, c * fw + fw, r * fh + fh)) for c in range(cols)] for r in range(rows)]
        extra = {k: v for k, v in meta.items() if k not in ("frame", "frames", "anchor", "fps")}
        extra.update({"skin": kind, "base": name})
        ship(f"skin_{kind}_{name}", None, meta["fps"], tuple(meta["anchor"]), extra=extra, rows=grid, look=5)


if __name__ == "__main__":
    build()
