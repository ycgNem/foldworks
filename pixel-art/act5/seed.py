"""The Seed (docs/endgame.md, Milestone 10): the whole World folded into one tile, now the first
machine of a new universe. kind `seed`, 1x1, not removable; it hums and digs a little of each raw
ore out of its four sides.

seed 16x16, 4 frames, 4 fps (one hum a second), one facing (it digs on all four sides, so it has
no front), on the standard skid (STYLE.md: every machine stands on it).

The picture: a tiny floating island (a grass top lit from the top-left, a rock cone under it, a
gilded square on the grass where the World's floor is folded up, a tree) hovering over a brass
cradle on the skid, a pool of lantern light between them. The cradle's front carries four small
ore lamps (iron blue, copper orange, coal dark, sand gold): the four raw ores it digs. The hum: the
island bobs up a pixel and back, the pool of light breathes (lamp ramp +1/0/-1/0), the gold square
glints. Frame 0 is the still pose (a stopped Seed holds it). The top-right 4x4 is empty sky in every
frame (the pip's corner).
"""
from c5 import INK, INK1, L1, L2, L3, B0, B1, B2, B3, P, hline, new, outline, put, seat, ship

BOB = [0, -1, -1, 0]
GLOW = [L1, L2, L3, L2]


def island(dy, f):
    """The island, tip at row 7 (+dy): a grass top rows 1-3 lit from the left, a rock cone rows
    4-7, a gilded square (the World folded up) standing on the grass, a bush, a spring."""
    img = new(16, 16)
    t = 1 + dy
    grass = {t: (3, 9), t + 1: (2, 10), t + 2: (2, 10)}
    for y, (a, b) in grass.items():
        for x in range(a, b + 1):
            u = (x - a) / max(1, b - a)
            c = P["grass3"] if u < 0.5 else P["grass2"] if u < 0.85 else P["grass1"]
            put(img, x, y, c)
    hline(img, 2, 10, t + 2, P["grass1"])          # the grass lip over the rock
    put(img, 2, t + 2, P["grass2"])
    put(img, 3, t + 2, P["grass2"])
    cone = {t + 3: (2, 10), t + 4: (3, 9), t + 5: (4, 8), t + 6: (5, 7)}
    for y, (a, b) in cone.items():
        for x in range(a, b + 1):
            u = (x - a) / max(1, b - a)
            put(img, x, y, P["earth3"] if u < 0.35 else P["earth2"] if u < 0.75 else P["earth1"])
    put(img, 9, t + 3, P["sky3"])                   # a spring trickling off the lip
    put(img, 9, t + 4, P["sky2"])
    put(img, 4, t + 4, P["violet"])                 # a crystal in the rock
    # the World folded up: a gilded square on the plot, lit top-left, a glint on the hum
    for (x, y, c) in ((6, t - 1, B3), (7, t - 1, B2), (6, t, B2), (7, t, B1), (8, t, INK1)):
        put(img, x, y, c)
    if f in (1, 2):
        put(img, 6, t - 1, L3)
    put(img, 3, t, P["grass1"])                     # a bush
    put(img, 3, t - 1, P["grass2"])
    put(img, 9, t, P["moss3"])                      # a fence post on the rim
    img = outline(img, INK)
    return img


def cradle(f):
    """A brass dish standing on the skid (rows 9-11): a lit rim, a pool of light in it, four ore
    lamps on its front face."""
    img = new(16, 16)
    hline(img, 4, 10, 9, INK)
    put(img, 3, 10, INK)
    put(img, 11, 10, INK)
    put(img, 4, 10, B3)
    put(img, 10, 10, B1)
    for x in range(5, 10):
        put(img, x, 10, B2 if x in (5, 9) else GLOW[f] if x in (6, 8) else (L3 if f == 2 else L2))
    put(img, 3, 11, INK)
    put(img, 11, 11, INK)
    hline(img, 4, 10, 11, B1)
    # the four ores it digs: iron, copper, coal, sand, small lamps on the dish's front
    for x, c in ((4, P["iron2"]), (6, P["copper2"]), (8, P["steel2"]), (10, P["lamp2"])):
        put(img, x, 11, c)
    return img


def frame(f):
    img = seat(cradle(f))
    img.alpha_composite(island(BOB[f], f))
    # the light under the island's point, a pixel above the dish
    put(img, 6, 8 + BOB[f], GLOW[f])
    if BOB[f]:
        put(img, 6, 8, L1)
    return img


def build():
    frames = [frame(f) for f in range(4)]
    ship("seed", frames, 4, look=8)
    return frames


if __name__ == "__main__":
    build()
