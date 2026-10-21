"""The island assembler for the mocks: exactly the rules island.py's docstring gives the code.

Land is any set of tiles (an organic outline, rows may have several runs). The cliff hangs from
every land pixel that has sky below it (per pixel column, from the top surface's own silhouette),
drawn first; the top surface is drawn over it, so land further south hides the cliff behind it,
as it should in the 3/4 view. Under the island's lowest edge the cliff runs down to the underside,
which steps in by tile column to the tip. One ink outline round the whole body.
"""
from common import P, T, new, hsh, outline
import island


class Island:
    CLIFF_ROWS = 4

    def __init__(self, tiles, veins=()):
        self.tiles = set(tiles)
        self.veins = list(veins)          # (ore, tile x, variant)
        self.xs = sorted({x for x, _ in self.tiles})

    def land(self, x, y):
        return (x, y) in self.tiles

    def mask(self, x, y):
        return (1 if self.land(x, y - 1) else 0) | (2 if self.land(x + 1, y) else 0) | \
               (4 if self.land(x, y + 1) else 0) | (8 if self.land(x - 1, y) else 0)

    def bottom(self, x):
        return max(y for (xx, y) in self.tiles if xx == x)

    def under_rows(self, depth=9):
        """{x: (first underside row, bottom row exclusive)}: the underside starts CLIFF_ROWS under
        each column's lowest land tile and is 1 tile deep at the island's ends, `depth` in the
        middle, so the bottom tapers to the tip; never shallower than the column beside it
        towards the middle (the taper stays monotone)."""
        cx = (self.xs[0] + self.xs[-1] + 1) / 2
        hw = (self.xs[-1] - self.xs[0] + 1) / 2
        ub = {x: self.bottom(x) + 1 + self.CLIFF_ROWS for x in self.xs}
        bot = {}
        for x in self.xs:
            t = max(0.0, 1 - abs(x + 0.5 - cx) / hw)
            bot[x] = ub[x] + 1 + int(round((depth - 1) * t ** 1.8))
        # monotone towards the middle: each column at least as deep as its outer neighbour
        left = [x for x in self.xs if x + 0.5 <= cx]
        right = [x for x in reversed(self.xs) if x + 0.5 > cx]
        for side in (left, right):
            for a, b in zip(side, side[1:]):
                bot[b] = max(bot[b], bot[a])
        return {x: (ub[x], bot[x]) for x in self.xs}

    def bake(self, ox, oy, W, H, ground_at):
        body, top = new(W, H), new(W, H)
        tex = island.cliff_texture()
        for (x, y) in sorted(self.tiles, key=lambda t: (t[1], t[0])):
            m = self.mask(x, y)
            tile = ground_at(x, y) if m == 15 else island.edge(m, hsh(x, y) % 4)
            top.alpha_composite(tile, (ox + x * T, oy + y * T))
        tp = top.load()
        bp = body.load()
        under = self.under_rows()
        for x in self.xs:
            lowest = self.bottom(x)
            end_low = oy + under[x][0] * T
            for i in range(T):
                wx = ox + x * T + i
                if not (0 <= wx < W):
                    continue
                tx = (x * T + i) % island.CW
                ys = [yy for yy in range(H - 1) if tp[wx, yy][3] and not tp[wx, yy + 1][3]]
                for yb in ys:
                    last = yb >= oy + lowest * T
                    end = end_low if last else yb + 1 + self.CLIFF_ROWS * T
                    for k, y in enumerate(range(yb + 1, end)):
                        left = end - y
                        sy = k if k < 16 else (32 + 16 - left) if left <= 16 else 16 + (k - 16) % 16
                        if 0 <= y < H:
                            bp[wx, y] = tex.getpixel((tx, sy))
        # ore veins in the face: on a mid row of the column's cliff, clipped to the rock
        for (ore, x, v) in self.veins:
            vy = oy + (self.bottom(x) + 2) * T + 2
            vi = island.vein(ore, v)
            for j in range(T):
                for i in range(T):
                    p = vi.getpixel((i, j))
                    X, Y = ox + x * T + i, vy + j
                    if p[3] and 0 <= X < W and 0 <= Y < H and bp[X, Y][3]:
                        bp[X, Y] = p
        cells = {(x, r) for x, (u0, u1) in under.items() for r in range(u0, u1)}
        deepest = max(u1 for (u0, u1) in under.values())
        dx = [x for x, (u0, u1) in under.items() if u1 == deepest]
        mid = (min(dx) + max(dx) + 1) / 2          # the tip hangs under the middle two columns
        tip_cols = {int(mid) - 1, int(mid)}
        for (x, r) in cells:
            if (x, r + 1) in cells or (r == deepest - 1 and x in tip_cols):
                kind = "fill"
            elif (x - 1, r) not in cells:
                kind = "left"
            elif (x + 1, r) not in cells:
                kind = "right"
            else:
                kind = "bottom"
            body.alpha_composite(island.under(kind, x % 4), (ox + x * T, oy + r * T))
        tcx = mid * T
        body.alpha_composite(island.tip(), (ox + int(tcx) - 24, oy + deepest * T))
        body = outline(body, P["ink"])
        self.deepest_y = oy + deepest * T + 32
        return body, top

    def falls(self, ox, oy, W, H, at, f=0, sea_y=None):
        """at: tile x of each fall (on its column's lowest tile). Returns (top overlay, falling)."""
        topl, lay = new(W, H), new(W, H)
        for fx in at:
            fy = self.bottom(fx)
            topl.alpha_composite(island.fall_top(f), (ox + fx * T, oy + fy * T))
            lay.alpha_composite(island.fall_head(f), (ox + fx * T, oy + (fy + 1) * T))
            y = oy + (fy + 2) * T
            end = sea_y if sea_y is not None else H
            seg = island.fall(f)
            while y < end:
                lay.alpha_composite(seg.crop((0, 0, 16, min(32, end - y))), (ox + fx * T, y))
                y += 32
            if sea_y is not None:
                lay.alpha_composite(island.foam(f), (ox + fx * T - 8, sea_y - 8))
        return topl, lay


def rows_to_tiles(rows):
    """rows: {y: [(x0, x1), ...]} inclusive runs -> a set of tiles."""
    return {(x, y) for y, runs in rows.items() for (a, b) in runs for x in range(a, b + 1)}


# The Workshop island: the 24x16 plot (0..23, 0..15) with a rim 1-3 tiles wide on the sides, the
# town's four rows on the north and two lobes on the south lip where the waterfalls start.
# Each coast is monotone (it steps out going south to the widest rows, then only steps in), so a
# south face shows only round the island's lower half, never as a pillar beside the land.
_L = {-7: 6, -6: 1, -5: -1, -4: -2, -3: -3, -2: -3, -1: -3, 0: -3, 1: -4, 2: -4, 3: -4, 4: -4, 5: -4,
      6: -4, 7: -4, 8: -4, 9: -4, 10: -4, 11: -3, 12: -3, 13: -3, 14: -2, 15: -2, 16: -1, 17: 0}
_R = {-7: 17, -6: 22, -5: 24, -4: 25, -3: 26, -2: 26, -1: 26, 0: 26, 1: 26, 2: 26, 3: 26, 4: 27,
      5: 27, 6: 27, 7: 27, 8: 27, 9: 27, 10: 27, 11: 26, 12: 26, 13: 26, 14: 25, 15: 25, 16: 24, 17: 23}
WORKSHOP_ROWS = {y: [(_L[y], _R[y])] for y in _L}
WORKSHOP_ROWS[18] = [(2, 6), (14, 21)]      # two lobes on the south lip, where the falls start
WORKSHOP_FALLS = [4, 18]
# the island's ores showing in its south face: iron under the Yard, copper, coal, sand to the east
WORKSHOP_VEINS = [("iron", 1, 0), ("iron", 7, 2), ("copper", 11, 1), ("sand", 15, 3), ("coal", 20, 0), ("iron", 23, 3)]
