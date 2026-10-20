"""Shared helpers for the Foldworks UI art (pixel-art/ui/).

Everything here is a thin hand for placing pixels with pixelstudio's Sprite: the palette read
from src/data/palette.ts (the source of truth), ASCII pixel maps, a symmetric ellipse, the
export to src/art/ (1x strip + JSON sidecar), a palette check, previews, a 9-slice renderer
(tile mode, the way the game should draw them) and the game's own bitmap font, parsed from
src/ui/font.ts, so previews and the HUD mock show real text.
"""
import sys
import re
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
_local = ROOT / ".claude/skills/pixel-art-studio/scripts"
sys.path.insert(0, str(_local if _local.exists() else Path.home() / ".claude/skills/pixel-art-studio/scripts"))
from pixelstudio import Sprite, hex2rgba  # noqa: E402
from PIL import Image  # noqa: E402

ART = ROOT / "src" / "art"
OUT = HERE / "out"
ART.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- palette (from palette.ts)
_pal_src = (ROOT / "src" / "data" / "palette.ts").read_text(encoding="utf-8")
_block = re.search(r"const A = \{(.*?)\} as const;", _pal_src, re.S).group(1)
P = dict(re.findall(r"(\w+):\s*'(#[0-9a-fA-F]{6})'", _block))
PIPS = {P[k] for k in ("pipGreen", "pipYellow", "pipRed", "pipGrey", "pipBlue")}
ART_PAL = [h for k, h in P.items() if h not in PIPS]  # 27 colours sprite art may use
ALL_PAL = list(P.values())
assert len(ALL_PAL) == 32, len(ALL_PAL)

# short keys for ASCII maps
KEY = {
    ".": None,
    "k": P["ink"], "s": P["shadow"], "b": P["bone"],
    "d": P["ground0"], "W": P["ground1"], "w": P["ground2"],
    "0": P["hull0"], "1": P["hull1"], "2": P["hull2"], "3": P["hull3"],
    "i": P["iron0"], "I": P["iron1"], "J": P["iron2"],
    "c": P["copper0"], "C": P["copper1"], "p": P["copper2"],
    "x": P["slag"], "y": P["brass0"], "Y": P["brass1"], "o": P["glow"], "H": P["hot"],
    "t": P["teal0"], "T": P["teal1"], "m": P["moss"], "l": P["leaf"], "v": P["violet"],
    "g": P["gold"],
}


def new(w, h, n=1):
    s = Sprite(w, h, palette=ART_PAL)
    for _ in range(n - 1):
        s.add_frame(copy=False)
    s.frame(1)
    return s


def ascii_(s, x0, y0, rows, key=None, only=None):
    """Draw an ASCII pixel map; '.' (and space) is skipped, never erased."""
    key = key or KEY
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in ". ":
                continue
            s.px(x0 + i, y0 + j, key[ch], only=only)


def ell(s, cx, cy, rx, ry, color, only=None):
    """Filled ellipse centred on (cx, cy) in pixel-edge coordinates (cx=8 is the line between
    pixels 7 and 8): symmetric at every size, which PIL's isn't."""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx = (x + 0.5 - cx) / max(rx, 0.01)
            dy = (y + 0.5 - cy) / max(ry, 0.01)
            if dx * dx + dy * dy <= 1.0:
                s.px(x, y, color, only=only)


def ring(s, cx, cy, r0, r1, color, only=None):
    """Annulus r0 < d <= r1 (pixel-centre distance), centre in pixel-edge coordinates."""
    for y in range(int(cy - r1) - 1, int(cy + r1) + 2):
        for x in range(int(cx - r1) - 1, int(cx + r1) + 2):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if r0 < d <= r1:
                s.px(x, y, color, only=only)


def strip(s):
    """All frames left to right as one RGBA image."""
    im = Image.new("RGBA", (s.w * s.n_frames, s.h), (0, 0, 0, 0))
    for i in range(s.n_frames):
        im.alpha_composite(s.composite(i + 1), (i * s.w, 0))
    return im


def check_palette(im, name):
    pal = {hex2rgba(h)[:3] for h in ART_PAL}
    pips = {hex2rgba(h)[:3] for h in PIPS}
    bad, semi, cols = set(), 0, set()
    for r, g, b, a in im.getdata():
        if a == 0:
            continue
        if a != 255:
            semi += 1
        if (r, g, b) in pips or (r, g, b) not in pal:
            bad.add((r, g, b))
        cols.add((r, g, b))
    assert not bad, f"{name}: off-palette or pip colours {bad}"
    assert semi == 0, f"{name}: {semi} semi-transparent pixels"
    return len(cols)


REPORT = {}


def checker(w, h, a="#2b2330", b="#352c3a", sq=8):
    im = Image.new("RGBA", (w, h), hex2rgba(a))
    pb = hex2rgba(b)
    px = im.load()
    for y in range(h):
        for x in range(w):
            if ((x // sq) + (y // sq)) % 2:
                px[x, y] = pb
    return im


def up(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def export(s, name, fps=0, slice_=None, anchor=(0, 0), scale=8, extra=None):
    """Write src/art/<name>.png (1x strip) + .json, and out/<name>_1x.png / _<scale>x.png."""
    im = strip(s)
    ncol = check_palette(im, name)
    im.save(ART / f"{name}.png")
    meta = {"frame": [s.w, s.h], "frames": s.n_frames, "anchor": list(anchor), "fps": fps}
    if slice_ is not None:
        meta["slice"] = list(slice_)
    if extra:
        meta.update(extra)
    (ART / f"{name}.json").write_text(json.dumps(meta) + "\n", encoding="utf-8")
    # previews: 1x on a dark checker, and scaled with 1px gaps between frames
    bg = checker(im.width, im.height, sq=4)
    bg.alpha_composite(im)
    bg.save(OUT / f"{name}_1x.png")
    big = checker(im.width * scale + (s.n_frames - 1) * scale, im.height * scale, sq=scale * 2)
    for i in range(s.n_frames):
        big.alpha_composite(up(s.composite(i + 1), scale), (i * (s.w * scale + scale), 0))
    big.save(OUT / f"{name}_{scale}x.png")
    REPORT[name] = {"frame": [s.w, s.h], "frames": s.n_frames, "colours": ncol, "fps": fps,
                    **({"slice": list(slice_)} if slice_ else {})}
    (OUT / "report.json").write_text(json.dumps(REPORT, indent=1), encoding="utf-8")
    print(f"{name}: {s.w}x{s.h} x{s.n_frames}  colours {ncol}" + (f"  slice {slice_}" if slice_ else ""))
    return im


# ---------------------------------------------------------------- 9-slice (tile mode)
def frame_of(img, fw, i):
    return img.crop((i * fw, 0, (i + 1) * fw, img.height))


def nine(src, sl, w, h):
    """Render a 9-slice at w x h: corners as is, edges and centre TILED (not stretched)."""
    L, T, R, B = sl
    W, H = src.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    cw, ch = W - L - R, H - T - B

    def tile(box, dx0, dy0, dw, dh):
        piece = src.crop(box)
        pw, ph = piece.size
        for yy in range(0, dh, ph):
            for xx in range(0, dw, pw):
                part = piece.crop((0, 0, min(pw, dw - xx), min(ph, dh - yy)))
                out.alpha_composite(part, (dx0 + xx, dy0 + yy))

    iw, ih = w - L - R, h - T - B
    tile((0, 0, L, T), 0, 0, L, T)
    tile((W - R, 0, W, T), w - R, 0, R, T)
    tile((0, H - B, L, H), 0, h - B, L, B)
    tile((W - R, H - B, W, H), w - R, h - B, R, B)
    if iw > 0:
        tile((L, 0, L + cw, T), L, 0, iw, T)
        tile((L, H - B, L + cw, H), L, h - B, iw, B)
    if ih > 0:
        tile((0, T, L, T + ch), 0, T, L, ih)
        tile((W - R, T, W, T + ch), w - R, T, R, ih)
    if iw > 0 and ih > 0:
        tile((L, T, L + cw, T + ch), L, T, iw, ih)
    return out


# ---------------------------------------------------------------- the game's bitmap font
_font_src = (ROOT / "src" / "ui" / "font.ts").read_text(encoding="utf-8")
GLYPH = {}
for m in re.finditer(r"^\s*('(?:\\.|[^'])*'|\"[^\"]*\"|[A-Za-z_$]\w*):\s*'([.#|]+)'", _font_src, re.M):
    k, v = m.group(1), m.group(2)
    if k[0] in "'\"":
        k = k[1:-1]
        if k.startswith("\\u"):
            k = chr(int(k[2:], 16))
        elif k == "\\\\":
            k = "\\"
        elif k == "\\'":
            k = "'"
    GLYPH[k] = v.split("|")
ICONCH = {"heart": "\u0001", "coin": "\u0002", "bolt": "\u0003", "star": "\u0004", "clock": "\u0005",
          "up": "\u0006", "down": "\u0007", "right": "\u0008", "cog": "\u000f", "crate": "\u0010",
          "flask": "\u0011", "check": "\u0012", "cross": "\u0013", "lock": "\u0014", "pip": "\u0015"}


def text_w(t, sc=1):
    w = 0
    for ch in t:
        g = GLYPH.get(ch, GLYPH["?"])
        w += len(g[0]) + 1
    return max(0, w - 1) * sc


def text(im, t, x, y, color, sc=1, shadow=None, align="left"):
    if align == "center":
        x -= text_w(t, sc) // 2
    elif align == "right":
        x -= text_w(t, sc)
    if shadow:
        _text(im, t, x + sc, y + sc, shadow, sc)
    return _text(im, t, x, y, color, sc)


def _text(im, t, x, y, color, sc):
    c = hex2rgba(color)
    px = im.load()
    cx = x
    for ch in t:
        g = GLYPH.get(ch, GLYPH["?"])
        for j, row in enumerate(g):
            for i, b in enumerate(row):
                if b == "#":
                    for yy in range(sc):
                        for xx in range(sc):
                            X, Y = cx + i * sc + xx, y + j * sc + yy
                            if 0 <= X < im.width and 0 <= Y < im.height:
                                px[X, Y] = c
        cx += (len(g[0]) + 1) * sc
    return cx - x


def sheet(items, path, scale=4, pad=6, bg="#2b2330", cols=None, label=True):
    """Contact sheet: items = [(label, PIL image)], drawn at `scale` with labels under each."""
    cols = cols or len(items)
    rows = [items[i:i + cols] for i in range(0, len(items), cols)]
    cell_w = max(it[1].width for it in items) * scale
    cell_h = max(it[1].height for it in items) * scale + (12 if label else 0)
    W = cols * (cell_w + pad) + pad
    H = len(rows) * (cell_h + pad) + pad
    out = Image.new("RGBA", (W, H), hex2rgba(bg))
    for r, row in enumerate(rows):
        for c, (lab, im) in enumerate(row):
            x = pad + c * (cell_w + pad)
            y = pad + r * (cell_h + pad)
            out.alpha_composite(up(im, scale), (x, y))
            if label:
                text(out, lab, x, y + im.height * scale + 2, P["hull2"])
    out.save(path)
    return out
