"""The module tile, hand-drawn (phase 1's design, STYLE.md): a bold 2 px brass band lit from the
top-left, rivets on three corners (the top-right stays calm for the pip), a deep well for the
output icon (code draws it at x+4, y+4), and the fold seam as a dog-eared bottom-left corner.
module_glow and module_od keep their Milestone 4-5 drawings, recoloured (recolor_old.py)."""
from common import P, T, new, draw, export


def module_tile():
    b0, b1, b2, b3 = P["brass0"], P["brass1"], P["brass2"], P["brass3"]
    m = new(T, T)
    for y in range(T):
        for x in range(T):
            ring = min(x, y, 15 - x, 15 - y)
            far = (x == 15 - ring) or (y == 15 - ring)
            c = P["ink"] if ring == 0 else (b0 if far else b3) if ring == 1 else (b1 if far else b2) if ring == 2 \
                else P["ink1"]
            draw(m, [(x, y)], c)
    draw(m, [(3, y) for y in range(3, 13)] + [(x, 3) for x in range(3, 13)], P["ink"])  # the well's lip
    draw(m, [(12, y) for y in range(4, 13)] + [(x, 12) for x in range(4, 13)], P["ink2"])  # its lit far wall
    for rx, ry in ((2, 2), (2, 13), (13, 13)):
        draw(m, [(rx, ry)], b3 if (rx, ry) == (2, 2) else b0)
    # the fold: a dog-eared corner of paper
    draw(m, [(1, 12), (1, 13), (2, 13), (1, 14), (2, 14), (3, 14)], P["steel3"])
    draw(m, [(2, 12), (3, 13), (4, 14)], P["bone"])
    draw(m, [(0, 12), (0, 13), (0, 14), (0, 15), (1, 15), (2, 15), (3, 15), (4, 15)], P["ink"])
    return m


def build():
    export("module", [module_tile()])


if __name__ == "__main__":
    build()
