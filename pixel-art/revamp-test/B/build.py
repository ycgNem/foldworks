"""Direction B, "Lantern Bayou": a new 48-colour dusk palette (palettes.py), deep teal-green
water, mossy banks, a warm plank work floor, lanterns and their reflections, brass. PixelLab
supplies the terrain structure and the sprite drafts (drawn in this palette); this script
recolours, re-textures, finishes and composites them. Run: python build.py"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import lib  # noqa: E402
from lib import Image, frame, snap, hue_group  # noqa: E402
from palettes import A, B, hexes  # noqa: E402

PAL = hexes("B")
P = B


def classify_wg(c):
    h, s, v = hue_group(c)
    if v < 0.32:
        return "mud"
    return "water" if 140 <= h <= 200 else "grass"


def classify_gf(c):
    h, s, v = hue_group(c)
    return "grass" if 60 <= h <= 130 and s > 0.5 else "floor"


WATER_R = [P["water0"], P["water1"], P["water2"], P["water3"]]
GRASS_R = [P["moss1"], P["moss2"], P["moss3"], P["moss4"]]
WOOD_R = [P["wood0"], P["wood1"], P["wood2"], P["wood3"]]
wg_img = lib.remap_by_groups(
    Image.open(lib.RAW / "B_water_grass.png"), classify_wg,
    {"mud": [P["ink"], P["wood0"], P["moss0"]], "water": WATER_R, "grass": GRASS_R},
    {"mud": [0.45, 0.8], "water": [0.2, 0.7, 0.97], "grass": [0.1, 0.75, 0.97]})
gf_img = lib.remap_by_groups(
    Image.open(lib.RAW / "B_grass_floor.png"), classify_gf,
    {"grass": GRASS_R, "floor": WOOD_R},
    {"grass": [0.1, 0.75, 0.97], "floor": [0.12, 0.45, 0.9]})

textures = {
    "water": (("water", [P["water1"], P["water2"], P["water3"], P["water4"]]),
              {"seed": 31, "ripples": 0.009, "glints": 0.0005, "hi": 0.9, "cell": 30}),
    "grass": (("grass", GRASS_R), {"seed": 32, "tufts": 0.035, "lo": 0.28, "hi": 0.8, "base": 1}),
    "floor": (("planks", [P["wood0"], P["wood1"], P["wood2"]]),
              {"seed": 33, "board": 6, "run": 37, "base": 1, "lo": 0.0, "dark_boards": 0.16, "pebbles": 0.0, "specks": 0.0,
               "edge_every": 3}),
}
LIGHT = {lib.rgb(k): lib.rgb(v) for k, v in {
    P["wood0"]: P["wood1"], P["wood1"]: P["wood2"], P["wood2"]: P["wood3"], P["wood3"]: P["wood4"],
    P["moss1"]: P["moss2"], P["moss2"]: P["moss3"], P["moss3"]: P["moss4"], P["moss4"]: P["moss5"],
    P["water0"]: P["water1"], P["water1"]: P["water2"], P["water2"]: P["water3"],
    P["ink"]: P["wood0"]}.items()}

# B's own 32 px house drafts came out muddy (brown on brown, a dark blot of water baked under
# them), and its miner too; those parts are A's drafts from the same prompts, swapped into B's
# colours role by role. B's smelter, module, dock, lamp, reeds and lilies are its own.
A_TO_B = {
    A["ink"]: P["ink"], A["shadow"]: P["ink1"], A["bone"]: P["bone"],
    A["ground0"]: P["wood0"], A["ground1"]: P["wood1"], A["ground2"]: P["wood3"],
    A["hull0"]: P["steel0"], A["hull1"]: P["steel2"], A["hull2"]: P["steel3"], A["hull3"]: P["steel4"],
    A["iron0"]: P["iron0"], A["iron1"]: P["iron1"], A["iron2"]: P["iron2"],
    A["copper0"]: P["copper0"], A["copper1"]: P["copper1"], A["copper2"]: P["copper2"],
    A["slag"]: P["slag0"], A["violet"]: P["slag1"],
    A["brass0"]: P["brass1"], A["brass1"]: P["brass2"], A["glow"]: P["lamp1"], A["hot"]: P["lamp3"],
    A["gold"]: P["lamp2"], A["teal0"]: P["water2"], A["teal1"]: P["water4"],
    A["moss"]: P["moss2"], A["leaf"]: P["moss4"],
}


def a2b(img):
    return lib.recolor(img, A_TO_B)


miner = a2b(frame("A16", 0))
smelter = frame("B16", 5)
module = frame("B16", 10)
dock = frame("B32", 2)
houses = [a2b(frame("A32", 7)), a2b(frame("A32", 6)), a2b(frame("A32", 11)), a2b(frame("A32", 8))]
lamp = frame("B16", 29)

ink = P["ink"]
icons = {
    "iron_ore": lib.icon("iron_ore", ink, [P["iron0"], P["iron1"], P["iron2"], P["steel4"]]),
    "iron_ingot": lib.icon("iron_ingot", ink, [P["iron0"], P["iron1"], P["iron2"], P["steel4"]]),
    "gear": lib.icon("gear", ink, [P["steel1"], P["steel2"], P["steel3"], P["steel4"]]),
}
belt = lib.belt_tile({"ink": ink, "rail0": P["steel1"], "rail1": P["steel2"], "rail2": P["steel3"],
                      "tread0": P["ink2"], "tread1": P["ink1"]})
def mod(ic):
    # hand-drawn: PixelLab's frame (B16 #10, kept in raw/) was too thin to out-read a machine
    return lib.module_tile([P["brass0"], P["brass1"], P["brass2"], P["brass3"]], P["ink1"], ink, ic,
                           P["steel3"], P["bone"])
sprites = {
    "miner": miner, "smelter": smelter, "dock": dock, "lamp": lamp,
    "reeds": frame("B16", 30), "lily": frame("B16", 31),
    "house0": houses[0], "house1": houses[1], "house2": houses[2], "house3": houses[3],
    "module_gear": mod(icons["gear"]), "module_idle": mod(icons["iron_ingot"]), **icons,
}

lamps = [(100, 62), (222, 62), (330, 64)]
spec = {
    "tileset01": ("B_water_grass", wg_img), "tileset12": ("B_grass_floor", gf_img),
    "flips": {0: "xy", 1: "xy", 2: "x"}, "textures": textures, "tex_edge": 1,
    "shadow": lib.darken_map(PAL, 0.45, P["ink"]), "light": LIGHT,
    "edge": P["ink1"], "ripple_col": P["water3"],
    "ragged": [("grass", "floor", [P["moss2"], P["moss2"], P["moss3"]], P["wood0"], 5, 0.55)],
    "ore_roles": {"pocket": P["ink1"], "ore0": P["ink"], "ore1": P["iron0"], "ore2": P["iron1"],
                  "ore3": P["iron2"]},
    "belt": belt, "sprites": sprites,
    "decor": [("lily", 44, 26), ("lily", 206, 30), ("lily", 252, 8), ("reeds", 128, 50),
              ("reeds", 270, 52), ("reeds", 60, 50)],
    "standing_back": [("house0", 8, 2), ("house1", 74, 4), ("house2", 146, 2), ("house3", 288, 2)]
                     + [("lamp", x, y) for x, y in lamps],
    # lantern pools on the bank and floor; window glow on the water under each house
    "light_pools": [(lib.SMELTER[0] * 16 + 8, lib.SMELTER[1] * 16 + 17, 12, 7)]
                   + [(x + 7, y + 16, 12, 7) for x, y in lamps]
                   + [(lib.DOCK[0] * 16 + 16, lib.DOCK[1] * 16 + 6, 18, 9)],
    "streaks": [(30, 37, 9, P["lamp2"], P["lamp0"]), (100, 37, 9, P["lamp1"], P["lamp0"]),
                (170, 35, 9, P["lamp2"], P["lamp0"]), (308, 37, 9, P["lamp1"], P["lamp0"])],
}

scene = snap(lib.compose(spec), PAL)
scene.save(HERE / "scene.png")
lib.scale(scene, 3).save(HERE / "scene@3x.png")

# PixelLab drew a bowler; Bramble wears a top hat: the crown gets 4 more rows
portrait = lib.hat_lift(snap(Image.open(lib.RAW / "B_portrait.png"), PAL), 5, 4)
portrait.save(HERE / "portrait_bramble.png")
lib.scale(lib.on_bg(portrait, P["ink1"]), 6).save(HERE / "portrait_bramble@6x.png")

parts = [miner, smelter, belt, icons["iron_ore"], icons["iron_ingot"], icons["gear"], dock,
         sprites["module_gear"], houses[0], portrait]
one, big = lib.parts_sheet(parts, P["wood2"], 5)
one.save(HERE / "parts.png")
big.save(HERE / "parts@5x.png")
(HERE / "parts").mkdir(exist_ok=True)
for n, im in sprites.items():
    im.save(HERE / "parts" / f"{n}.png")
print("scene colours", len({p[:3] for p in scene.getdata()}), "of", len(PAL))
