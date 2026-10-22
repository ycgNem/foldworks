"""The decorations: full replacement sheets of the Workshop's Dock and Hopper (32x32; the Dock 2
frames at 2 fps, the Hopper 3 at 3 fps; anchor (0, 0)).

Dock geometry: a pennant on a pole top-left (flag x 3..11, rows 1..6), the back rail rows 4..8,
the slip of water rows 11..24, the front plank row 26 and the front posts rows 28..30.
Hopper geometry: the brass rim rows 2..9, the teal funnel rows 10..18, the box with its flask rows
18..26, the steel base rows 25..31; rows 0..1 are free above the rim.

    mayoral      skin_mayoral_dock      drawn over `dock_lily` (whoever has it has Bramble at rep 5,
                                        so the frog flag already flies): the chain of office swagged
                                        along the front with a gold medallion
    bunting      skin_bunting_dock      flags along the back rail and the front, fluttering
    sunburst     skin_sunburst_dock     the pennant sky-blue with a very small sun for a coin, its
                                        rays turning between the two frames
    specimen     skin_specimen_hopper   the funnel a glass jar with a screw lid, a label (CONTENTS:
                                        EVERYTHING, EVENTUALLY, as ink lines), specimens floating
    mortarboard  skin_mortarboard_hopper  a graduation cap on the rim, its tassel swinging
    tinfoil      skin_tinfoil_hopper    the funnel and rim crinkled foil, a foil antenna with a red
                                        tip that blinks
"""
import json

from draw import h, rm, shape
from m11 import SRC_ART, skin


# ------------------------------------------------------------------ the Dock
def mayoral(f):
    for x in range(3, 29):
        t = (x - 15.5) / 12.5
        y = 26 + round(2.6 * (1 - t * t))
        f.put(x, y, "lamp2" if x % 2 else "brass1")
    shape(f, 14, 28, [".GG.", "GLlG", "GllG", ".GG."], {"G": "brass1", "L": "lamp3", "l": "lamp2"}, avoid_pip=False)
    f.put(15, 27, "red")
    f.put(16, 27, "red")


FLAGS = ["red", "lamp2", "teal", "iron2", "violet"]


def bunting(f):
    """Flags along the Dock for the first order filled."""
    def string(x0, x1, y0, sag, phase):
        for x in range(x0, x1 + 1):
            t = (x - (x0 + x1) / 2) / ((x1 - x0) / 2)
            y = y0 + round(sag * (1 - t * t))
            f.put(x, y, "bone")
            k = x - x0
            if k % 4 == 1:
                c = FLAGS[(k // 4 + phase) % len(FLAGS)]
                f.put(x, y + 1, c)
                f.put(x + 1, y + 1, c)
                f.put(x + 2, y + 1, c)
                f.put(x + 1 + (1 if f.i % 2 else 0), y + 2, c)
    string(12, 30, 4, 2, 0)
    string(4, 27, 26, 2, 2)


def sunburst(f):
    """A Dock with a very small sun on its sign."""
    f.recolour(rm(moss5="sky3", moss3="sky2"), where=lambda x, y: y <= 7 and 3 <= x <= 11)
    # the coin becomes the sun: a lamp3 heart, lamp2 body, lamp1 rim
    f.recolour(rm(brass1="lamp1"), where=lambda x, y: y <= 6 and 4 <= x <= 9)
    for x, y in ((6, 3), (7, 3), (6, 4), (7, 4)):
        f.put(x, y, "lamp3" if (x, y) == (6, 3) else "lamp2")
    rays = [(6, 1), (7, 1), (4, 3), (4, 4), (9, 3), (9, 4), (6, 6), (7, 6)] if f.i % 2 == 0 else \
        [(4, 1), (9, 1), (4, 6), (9, 6), (5, 1), (8, 6)]
    for x, y in rays:
        if f.name(x, y) in ("sky3", "sky2", "ink"):
            f.put(x, y, "lamp2" if f.name(x, y) != "ink" else "lamp1")


# ------------------------------------------------------------------ the Hopper
def specimen(f):
    """A Hopper with a label: CONTENTS: EVERYTHING, EVENTUALLY."""
    f.recolour(rm(teal="cloud2", water4="cloud1", water3="cloud0", steel4="cloud3"),
               where=lambda x, y: 10 <= y <= 18)
    f.recolour(rm(brass3="steel4", brass2="steel3", brass1="steel2"), where=lambda x, y: y <= 9)
    # the lid's screw thread
    for x in range(3, 28, 2):
        if f.name(x, 8) == "steel2":
            f.put(x, 8, "steel3")
    # the shine down the glass
    for y in range(11, 17):
        x = 7 + (y - 11) // 2 + 1
        if f.name(x, y) in ("cloud1", "cloud2", "cloud0"):
            f.put(x, y, "cloud3")
    # specimens floating in the jar: an ore, a cog, a slag lump, a spark
    for (x, y), c in zip(((22, 11), (20, 16), (10, 11), (24, 12)), ("copper2", "iron1", "slag1", "lamp2")):
        y2 = y + (1 if (f.i + x) % 3 == 0 and y < 16 else 0)
        if f.name(x, y2) in ("cloud0", "cloud1", "cloud2", "cloud3"):
            f.put(x, y2, c)
    # the label: bone, ink lines of writing
    shape(f, 12, 12, ["kkkkkkkk",
                      "bAAAAbAb",
                      "bAAbAAAb",
                      "kkkkkkkk"], {"k": "pave2", "b": "bone", "A": "ink2"}, avoid_pip=False)


BOARD = ["......kkkkkkkk......",
         "...kkkSSSSSSSSkkk...",
         "kkksssssssssssssskkk",
         "..kkkkssssssskkkkk..",
         "......kccccck......."]


def mortarboard(f):
    """A Hopper in a graduation cap. It earned it."""
    shape(f, 5, 0, BOARD, {"k": "ink", "S": "steel2", "s": "steel0", "c": "ink2"}, avoid_pip=False)
    f.put(15, 1, "lamp2")
    tx = 23 + (f.i % 3 == 1)
    for x in range(16, tx):
        f.put(x, 2 if x < 20 else 2, "lamp2")
    for y in range(3, 7):
        f.put(tx, y, "lamp2")
    shape(f, tx - 1, 7, ["lLl", ".l."], {"l": "lamp1", "L": "lamp2"}, avoid_pip=False)


def tinfoil(f):
    """For a Hopper that has heard things: crinkled foil over the funnel and the rim, an antenna."""
    foil = ["steel2", "steel3", "steel4", "cloud2"]

    def crinkle(x, y, n):
        if y <= 9 and n in ("brass3", "brass2", "brass1"):
            base = {"brass3": 3, "brass2": 2, "brass1": 1}[n]
        elif 10 <= y <= 18 and n in ("teal", "water4", "water3", "steel4"):
            base = {"teal": 3, "water4": 2, "water3": 1, "steel4": 3}[n]
        else:
            return n
        k = base + (h(x, y, 11) % 3) - 1
        return foil[max(0, min(3, k))]
    f.recolour(crinkle)
    # the antenna on the rim, its tip blinking
    for y in (0, 1):
        f.put(15, y + 1, "steel4" if y else "steel3")
    f.put(15, 0, "red" if f.i != 1 else "lamp3")
    f.put(14, 2, "ink")
    f.put(16, 2, "ink")


def build():
    skin("mayoral", "dock_lily", mayoral, on_skid=False, pip=False)
    # it replaces the Dock, whichever dock sheet would be drawn: rename to the kind's name
    for ext in ("png", "json"):
        src = SRC_ART / f"skin_mayoral_dock_lily.{ext}"
        dst = SRC_ART / f"skin_mayoral_dock.{ext}"
        if ext == "json":
            m = json.loads(src.read_text())
            m["base"] = "dock"
            m["drawnOver"] = "dock_lily"
            dst.write_text(json.dumps(m) + "\n", newline="\n")
        else:
            dst.write_bytes(src.read_bytes())
        src.unlink()
    import m11
    m11.SHIPPED[-1] = ("skin_mayoral_dock", "dock_lily")
    skin("bunting", "dock", bunting, on_skid=False, pip=False)
    skin("sunburst", "dock", sunburst, on_skid=False, pip=False)
    skin("specimen", "hopper", specimen, on_skid=False, pip=False)
    skin("mortarboard", "hopper", mortarboard, on_skid=False, pip=False)
    skin("tinfoil", "hopper", tinfoil, on_skid=False, pip=False)
