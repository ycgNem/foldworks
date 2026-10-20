"""Prototype: the lantern rim light on the cast portraits (raw/cast) -> out/proto_rim@4x.png."""
from PIL import Image
from common import P, rgb, lum, draw, OUT, scale, on_bg, RAW

INK = rgb(P["ink"])


def rim(im, warm=(P["lamp0"], P["lamp1"], P["lamp2"]), rows=48):
    out = im.copy()
    a = im.load()
    w, h = im.size
    pts = {0: [], 1: [], 2: []}
    for y in range(rows):
        for x in range(w - 2):
            p = a[x, y]
            if not p[3] or p[:3] == INK:
                continue
            if a[x + 1, y][:3] == INK and a[x + 1, y][3] and (x + 2 >= w or not a[x + 2, y][3]):
                L = lum(p)
                pts[0 if L < 90 else 1 if L < 160 else 2].append((x, y))
    for k, v in pts.items():
        draw(out, v, warm[k])
    return out


if __name__ == "__main__":
    ims = []
    for n in ("unit7_0", "unit7_cheer_0", "voltaire_0", "voltaire_cheer_0"):
        im = Image.open(RAW / "cast" / f"{n}.png").convert("RGBA")
        old = Image.open(RAW / "old" / f"portrait_{n.split('_0')[0]}.png").convert("RGBA").crop((0, 0, 48, 48))
        ims += [old, im, rim(im)]
    sheet = Image.new("RGBA", (len(ims) * 50, 50))
    for i, im in enumerate(ims):
        sheet.alpha_composite(im, (i * 50 + 1, 1))
    scale(on_bg(sheet, P["ink1"]), 3).save(OUT / "proto_rim@3x.png")
