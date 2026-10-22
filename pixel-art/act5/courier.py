"""Beyond's carrier (docs/endgame.md, Milestone 10: `courier`, the high-floor routes' craft on the
fifth floor, as the District's skiff and the World's barge): up where there is no air for a
rotor, the parcels are carried by **folded paper cranes** (the game's fold, flying). A bone-white
crane drawn in profile facing right (the code flips it, as the skiff), neck and beak forward, tail
up behind, its wing beating up, level, down, level; a brass-strapped crate hangs under it on a
string.

courier 16x12, 4 frames (up, level, down, level), 8 fps, anchor (8, 11): the parcel's foot, as the
barge's keel. The paper reads on Beyond's dark floor and its night sky (bone and pave on ink); the
ink outline keeps it off the floor's slate.
"""
from c5 import B1, B2, B3, INK, P, new, outline, put, ship

LIT, MID, SHADE, CREASE = P["bone"], P["pave3"], P["pave2"], P["pave1"]

BODY = {5: (5, 10), 6: (6, 9)}
NECK = [(11, 4), (12, 3), (13, 2)]
HEAD = [(14, 2)]
BEAK = [(15, 3)]
TAIL = [(4, 5), (3, 4), (2, 3), (1, 2)]
WINGS = {
    "up": {0: (8, 8), 1: (7, 8), 2: (7, 9), 3: (6, 9), 4: (6, 10)},
    "level": {3: (8, 11), 4: (5, 11)},
    "down": {6: (4, 9), 7: (3, 7), 8: (2, 4)},
}
POSES = ["up", "level", "down", "level"]


def crane(pose):
    img = new(16, 12)
    for y, (a, b) in BODY.items():
        for x in range(a, b + 1):
            put(img, x, y, MID if y == 5 else SHADE)
    put(img, 5, 5, LIT)
    put(img, 6, 5, LIT)
    for (x, y) in NECK + HEAD:
        put(img, x, y, LIT)
    for (x, y) in BEAK:
        put(img, x, y, SHADE)
    for i, (x, y) in enumerate(TAIL):
        put(img, x, y, MID if i else LIT)
    w = WINGS[pose]
    for y, (a, b) in w.items():
        for x in range(a, b + 1):
            # the wing's lit face toward the light, a crease down its middle
            put(img, x, y, LIT if (pose == "up" and x <= 7) or (pose != "up" and y == min(w)) else MID)
    if pose == "up":
        for y in range(1, 5):
            put(img, 8, y, CREASE if y > 1 else MID)
    elif pose == "down":
        put(img, 5, 6, CREASE)
        put(img, 4, 7, CREASE)
    else:
        put(img, 8, 4, CREASE)
    return img


def parcel():
    img = new(16, 12)
    for y in (9, 10):
        for x in (7, 8, 9):
            put(img, x, y, P["wood4"] if y == 9 else P["wood3"])
    put(img, 8, 9, B3)
    put(img, 8, 10, B2)
    put(img, 7, 9, P["wood5"])
    return img


def frame(f):
    pose = POSES[f % 4]
    img = new(16, 12)
    p = outline(parcel(), INK)
    img.alpha_composite(p)
    put(img, 8, 7, B1)                       # the string from the crane's feet
    c = outline(crane(pose), INK)
    img.alpha_composite(c)
    return img


def build():
    ship("courier", [frame(f) for f in range(4)], 8, anchor=(8, 11), bg=P["ink1"], look=8)


if __name__ == "__main__":
    build()
