"""Contact sheet for Foldworks' three bitmap faces (docs/hud-180.md "Typography").

Parses the glyph tables straight out of src/ui/font.ts (Reed, Bullfrog, Pip) and the old
Sprocket & Sprout tables out of `git show main:src/ui/font.ts`, and renders:

  pixel-art/fonts/out/fonts.png     at 1x
  pixel-art/fonts/out/fonts@3x.png  the same, nearest-neighbour 3x

Each face's full set; the same sample lines in S&S / Reed / Bullfrog / Pip, ink on paper and bone
with an ink outline on the two floor colours; and a crop of Last Watt's HUD beside them.

Run from the repo root:  python pixel-art/fonts/sheet.py
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "pixel-art" / "fonts" / "out"
LAST_WATT = Path(r"C:\Users\jacks\Documents\candlepower\e2e\out\midrun-bot.png")

INK = (0x13, 0x0E, 0x1C)
PAPER = (0xEE, 0xE2, 0xC6)
BONE = (0xEE, 0xE2, 0xC6)
WOOD = (0x9E, 0x6A, 0x42)
WATER = (0x14, 0x36, 0x38)
SHEET = (0x2A, 0x22, 0x30)
LABEL = (0xC8, 0xB8, 0x98)

ENTRY = re.compile(
    r"""(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|([A-Za-z_$][\w$]*))\s*:\s*'([^']*)'"""
)


def unescape(s: str) -> str:
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c == "\\" and i + 1 < len(s):
            n = s[i + 1]
            if n == "u":
                out.append(chr(int(s[i + 2 : i + 6], 16)))
                i += 6
                continue
            out.append({"n": "\n", "t": "\t"}.get(n, n))
            i += 2
            continue
        out.append(c)
        i += 1
    return "".join(out)


def table(src: str, name: str) -> dict[str, list[str]]:
    m = re.search(r"const " + re.escape(name) + r": Record<string, string> = \{(.*?)\n\};", src, re.S)
    if not m:
        raise SystemExit(f"no table {name}")
    body = re.sub(r"//[^\n]*", "", m.group(1))
    out: dict[str, list[str]] = {}
    for mm in ENTRY.finditer(body):
        key = unescape(mm.group(1) if mm.group(1) is not None else mm.group(2) if mm.group(2) is not None else mm.group(3))
        out[key] = mm.group(4).split("|")
    return out


class Face:
    def __init__(self, name: str, glyphs: dict[str, list[str]], h: int, caps: bool = False, hang: int = 0):
        self.name, self.glyphs, self.h, self.caps = name, glyphs, h, caps
        for ch, rows in glyphs.items():
            if len({len(r) for r in rows}) != 1:
                print(f"WARN {name} {ch!r}: ragged rows {rows}", file=sys.stderr)
            if len(rows) > h + hang:
                print(f"WARN {name} {ch!r}: {len(rows)} rows > {h}", file=sys.stderr)

    def get(self, ch: str) -> list[str]:
        g = self.glyphs.get(ch)
        if g is None and self.caps:
            g = self.glyphs.get(ch.upper())
        return g if g is not None else self.glyphs["?"]

    def width(self, s: str) -> int:
        return max(0, sum(len(self.get(c)[0]) + 1 for c in s) - 1)

    def draw(self, img: Image.Image, s: str, x: int, y: int, col, outline=None) -> int:
        if outline is not None:
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    if dx or dy:
                        self._raw(img, s, x + dx, y + dy, outline)
        return self._raw(img, s, x, y, col)

    def _raw(self, img: Image.Image, s: str, x: int, y: int, col) -> int:
        px = img.load()
        cx = x
        for c in s:
            rows = self.get(c)
            if c != " ":
                for ry, row in enumerate(rows):
                    for rx, v in enumerate(row):
                        if v == "#":
                            X, Y = cx + rx, y + ry
                            if 0 <= X < img.width and 0 <= Y < img.height:
                                px[X, Y] = col
            cx += len(rows[0]) + 1
        return cx - x


def fill(img: Image.Image, box, col) -> None:
    img.paste(col, box)


def main() -> None:
    src = (ROOT / "src" / "ui" / "font.ts").read_text(encoding="utf8")
    old_src = subprocess.run(
        ["git", "show", "main:src/ui/font.ts"], cwd=ROOT, capture_output=True, text=True, encoding="utf8", check=True
    ).stdout
    reed = Face("Reed", table(src, "REED"), 9)
    frog = Face("Bullfrog", table(src, "FROG"), 11)
    pip = Face("Pip", table(src, "PIP"), 5, caps=True, hang=1)
    ss = Face("S&S", table(old_src, "G"), 9)
    ss_small = Face("S&S small", table(old_src, "S"), 5, caps=True)

    W, H = 1500, 1180
    img = Image.new("RGB", (W, H), SHEET)
    y = 6

    # ---- every face's full set, on paper
    def full_set(face: Face, y: int, per_row: int, label: str) -> int:
        reed.draw(img, label, 8, y, LABEL)
        y += 13
        chars = list(face.glyphs.keys())
        cell = max(len(r[0]) for r in face.glyphs.values()) + 3
        rows = (len(chars) + per_row - 1) // per_row
        fill(img, (6, y - 2, 10 + per_row * cell, y + rows * (face.h + 4) + 1), PAPER)
        for i, ch in enumerate(chars):
            face.draw(img, ch, 8 + (i % per_row) * cell, y + (i // per_row) * (face.h + 4), INK)
        return y + rows * (face.h + 4) + 8

    y = full_set(reed, y, 40, "REED  body  cap 7  x 5  desc 2  LINE_H 11")
    y = full_set(frog, y, 40, "BULLFROG  display  cap 9  x 7  desc 2  BIG_LINE_H 13")
    y = full_set(pip, y, 48, "PIP  small  cap 5  caps only")
    y = full_set(ss, y, 48, "old S&S (main)")

    # ---- the samples, old vs new, on paper / wood / water
    samples = [
        "Hand Furnace",
        "She's choking on slag! shovel it",
        "27/min of 30",
        "+7,048/min",
        "1,234,567  1.58M  4.2e12",
        "S+ A B C D",
        "PRESSING 33%",
        "Q W E R T Y 25 150 1.2K",
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        "abcdefghijklmnopqrstuvwxyz",
        "0123456789 il1 0O 5S 8B rn m",
    ]
    faces = [(ss, "S&S"), (reed, "Reed"), (frog, "Bull"), (pip, "Pip")]
    y0 = y + 4
    reed.draw(img, "samples: S&S / Reed / Bullfrog / Pip", 8, y0, LABEL)
    y0 += 14
    col_x = [8, 8 + 330, 8 + 660]
    bgs = [(PAPER, INK, None), (WOOD, BONE, INK), (WATER, BONE, INK)]
    yy = y0
    block_h = 9 + 4 + 9 + 4 + 11 + 4 + 5 + 8
    for s in samples:
        for (bg, fg, ol), x in zip(bgs, col_x):
            fill(img, (x, yy - 2, x + 324, yy + block_h - 4), bg)
            ly = yy
            for face, tag in faces:
                face.draw(img, s, x + 4, ly, fg, ol)
                ly += face.h + 4
        yy += block_h
        if yy > H - block_h:
            break

    # ---- Last Watt's HUD (its screenshots are at 2x: halve to 1x)
    if LAST_WATT.exists():
        lw = Image.open(LAST_WATT).convert("RGB")
        top = lw.crop((0, 0, 820, 60)).resize((410, 30), Image.NEAREST)
        bot = lw.crop((196, 628, 1090, 720)).resize((447, 46), Image.NEAREST)
        lx = 8 + 990
        reed.draw(img, "Last Watt HUD (1x)", lx, y0 - 14, LABEL)
        img.paste(top, (lx, y0))
        img.paste(bot, (lx, y0 + 34))
        # the same words in Reed and Bullfrog, for the side-by-side
        ry = y0 + 90
        for line in ["20 LIGHTS  7 MONEY  75 kW SUPPLY", "1 Works  2 Wall  3 Labs  100%", "WAVE 4 / 12   9 left"]:
            fill(img, (lx, ry - 2, lx + 470, ry + 34), WATER)
            ss.draw(img, line, lx + 4, ry, BONE)
            reed.draw(img, line, lx + 4, ry + 11, BONE, INK)
            pip.draw(img, line, lx + 4, ry + 24, BONE, INK)
            ry += 40
        # Bullfrog at 2x, the Purse
        purse = Image.new("RGB", (frog.width("\u0002 1.58M") + 6, 15), WOOD)
        frog.draw(purse, "\u0002 1.58M", 3, 2, (0xF2, 0xC2, 0x4A), INK)
        purse = purse.resize((purse.width * 2, purse.height * 2), Image.NEAREST)
        img.paste(purse, (lx, ry + 6))
        ry += purse.height + 14
        purse2 = Image.new("RGB", (frog.width("+7,048/min") + 6, 15), PAPER)
        frog.draw(purse2, "+7,048/min", 3, 2, INK)
        img.paste(purse2.resize((purse2.width * 2, purse2.height * 2), Image.NEAREST), (lx, ry))

    # metrics
    def avg(face: Face) -> float:
        ws = [len(face.glyphs[c][0]) for c in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" if c in face.glyphs]
        return sum(ws) / len(ws)

    print(f"avg glyph width (a-z A-Z 0-9): S&S {avg(ss):.2f}  Reed {avg(reed):.2f}  Bullfrog {avg(frog):.2f}  Pip {avg(pip):.2f}  S&S small {avg(ss_small):.2f}")
    s = "She's choking on slag! shovel it"
    print(f"'{s}': S&S {ss.width(s)} px, Reed {reed.width(s)} px")

    bbox = (0, 0, W, max(yy, y0 + 400) + 6)
    img = img.crop(bbox)
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / "fonts.png")
    img.resize((img.width * 3, img.height * 3), Image.NEAREST).save(OUT / "fonts@3x.png")
    print("wrote", OUT / "fonts.png", img.size)


if __name__ == "__main__":
    main()
