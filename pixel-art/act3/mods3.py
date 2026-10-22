"""Act III's modules and route craft (docs/endgame.md, Milestone 7).

- dist_module 16x16 x4 (fps 6): a depth-2 module standing on the District, drawn as a small
  workshop block: a copper roof under a brass ridge, white walls between brass corner posts, a
  brass-framed window whose 8x8 inside is the icon well (ink1, code draws the main output's icon
  at x+4, y+6: "icon": [4, 6]), and STYLE.md's module cue, the fold seam as a dog-eared paper
  corner bottom-left. Working: a lamp beside the window breathes and a glint runs round the
  window's brass frame; frame 0 is the still pose. The top-right 4x4 is plain roof (the pip).
  It differs from the Factory's module.png (a flat brass tile with a well) by its roof and walls.
- world_module 16x16 x4 (fps 6): the same idea a scale up for the World (depth 3): a glass dome
  with brass ribs and a gold finial over fluted brass columns and a marble step, the same window
  ("icon": [4, 6]); a glint sweeps the dome and the lamp breathes. The dome's shoulders leave the
  top corners empty, so its silhouette is its own.
- skiff 12x10 x4 (fps 16): a little brass rotor boat carrying a crate, drawn facing right (the
  code flips it), its three-blade rotor turning; anchor (6, 9), the keel's centre.
- barge 16x12 x4 (fps 16): the World's bigger hull, two rotors, crates stacked and lashed, a
  stern cabin with a lit window; anchor (8, 11).
"""
import math

from c3 import (B0, B1, B2, B3, INK, INK1, INK2, L1, L2, L3, P, S2, S3, S4, grid, hline, new, outline, put,
                rect, ship, vline)

CU = {"C": P["copper2"], "c": P["copper1"], "x": P["copper0"]}
KEY = {"k": INK, "K": INK1, "j": INK2, "Q": B3, "q": B2, "b": B1, "o": B0, "W": S4, "w": S3, "v": S2,
       "F": P["bone"], "f": S3, "e": P["cloud2"], **CU}

# the District module, frame 0 (the window's inside, rows 6-13 x 4-11, is the icon well)
DIST = [
    "......kkkk......",
    "....kkCQqckk....",
    "..kkCCCAAcccbk..",
    "kkCCCCCCccccccbk",
    "kxxxxxxxxxxxxxxk",
    "kQeQQQQQQQQQqwbk",
    "kQWQkkkkkkkkqwbk",
    "kQWQKKKKKKKKjwbk",
    "kqWQKKKKKKKKjwbk",
    "kqWQKKKKKKKKjwbk",
    "kqWQKKKKKKKKjwok",
    "kqWQKKKKKKKKjwok",
    "fFWQKKKKKKKKjwok",
    "ffFQKKKKKKKKjwok",
    "fffFbbbbbbbbbbok",
    "kkkkkkkkkkkkkkk.",
]

# the World module: a glass dome on brass columns
GL = {"G": P["sky3"], "g": P["sky2"], "h": P["sky4"], "d": P["sky1"], "L": L2}
WORLD = [
    ".......kk.......",
    "......kLLk......",
    "....kkkqqkkk....",
    "..kkhGgqqgGdkk..",
    ".khGGgGqqGgGddk.",
    "kQQQQQQQQQQQQqbk",
    "kQqQkkkkkkkkqqbk",
    "kQqQKKKKKKKKjqbk",
    "kqQQKKKKKKKKjqbk",
    "kQqQKKKKKKKKjqbk",
    "kqQQKKKKKKKKjqok",
    "kQqQKKKKKKKKjqok",
    "fFqQKKKKKKKKjqok",
    "ffFQKKKKKKKKjqok",
    "fffFbbbbbbbbbbok",
    "kkkWWWWWWWWWWWwk",
]

# a glint running round the window frame (clockwise), one cell a frame
FRAME_GLINT = [(5, 5), (12, 5), (12, 13), None]


def module_frame(rows, f, world=False):
    img = grid(rows, {**KEY, **GL}, 16, 16)
    # the lamp on the wall left of the window (district) / the finial (world) breathes
    lamp = [L1, L2, L3, L2][f % 4]
    if world:
        put(img, 7, 1, lamp)
        put(img, 8, 1, L2 if f % 2 else L1)
        # a glint sweeping the dome left to right
        gx = [3, 5, 9, 11][f % 4]
        gy = 3 if gx in (3, 11) else 3
        put(img, gx, gy + 1, P["cloud3"] if f in (1, 2) else P["sky4"])
    else:
        put(img, 2, 8, lamp)
        put(img, 2, 9, L1 if f % 2 else L0())
        # the attic window under the ridge glows with the lamp
        put(img, 7, 2, lamp)
        put(img, 8, 2, L2 if f % 2 else L1)
    g = FRAME_GLINT[f % 4]
    if g:
        put(img, g[0], g[1], L3)
    return img


def L0():
    return P["lamp0"]


# ================================================================ skiff and barge
def rotor_line(img, cx, y, f, half):
    """Three blades seen almost edge-on from the side: a long white line whose length beats with
    the frame (full, two thirds, a third, two thirds), red tips, a brass hub."""
    k = [half, round(half * 0.66), round(half * 0.33), round(half * 0.66)][f % 4]
    for x in range(cx - k, cx + k + 1):
        put(img, x, y, S4 if x < cx else S3)
    put(img, cx - k, y, P["red"])
    put(img, cx + k, y, P["red"])
    # the far blade's blur as dots above
    if f % 2:
        for x in (cx - half + 1, cx + half - 1):
            put(img, x, y, P["cloud1"])
    put(img, cx, y, B2)


SKIFF = [
    "............",
    "....kQqk....",
    ".....kk.....",
    ".kkkkkkkk...",
    ".kHWWWWHk...",
    ".kWwwwwWk.kk",
    "kQQQQQQQQQQk",
    "kqqqqqLqqqk.",
    ".kbbbbbbbk..",
    "..kkkkkkk...",
]
SK_KEY = {"k": INK, "Q": B3, "q": B2, "b": B1, "H": P["wood5"], "W": P["wood4"], "w": P["wood3"], "L": L2}


def skiff(f):
    img = grid(SKIFF, SK_KEY, 12, 10)
    # the crate's planks and a brass strap
    put(img, 5, 4, B2)
    put(img, 5, 5, B1)
    rotor_line(img, 5, 0, f, 5)
    # the mast behind the crate
    put(img, 5, 2, S3)
    put(img, 6, 2, S2)
    return img


BARGE = [
    "................",
    "......kQqk......",
    "...kkkkkkkkk....",
    "..kHWWkHWWWk....",
    ".kkWwwkWwwwk.kk.",
    ".kHWWWWHWWWkkLk.",
    ".kWwwwwWwwwkkjk.",
    "kQQQQQQQQQQQQQQk",
    "kqqLqqqqqLqqqqk.",
    "kqqqqqqqqqqqqk..",
    ".kbbbbbbbbbbk...",
    "..kkkkkkkkkk....",
]
BG_KEY = {**SK_KEY, "j": INK2}


def barge(f):
    img = grid(BARGE, BG_KEY, 16, 12)
    for x in (4, 9):
        put(img, x, 3 if x == 4 else 3, B2)
    rotor_line(img, 7, 0, f, 7)
    put(img, 7, 2, S3)
    return img


def build():
    ship("dist_module", [module_frame(DIST, f) for f in range(4)], 6, extra={"icon": [4, 6]}, look=8)
    ship("world_module", [module_frame(WORLD, f, world=True) for f in range(4)], 6, extra={"icon": [4, 6]}, look=8)
    ship("skiff", [skiff(f) for f in range(4)], 16, anchor=(6, 9), bg=P["sky2"], look=8)
    ship("barge", [barge(f) for f in range(4)], 16, anchor=(8, 11), bg=P["sky2"], look=8)


if __name__ == "__main__":
    build()
