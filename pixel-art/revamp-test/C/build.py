"""Direction C, "Daylight Workshop": a new 47-colour high-key palette (palettes.py), a sunlit
lily-pad swamp, a pale sandstone work yard, crisp painted machines and hard noon shadows.
PixelLab supplies the terrain structure and the sprite drafts (drawn in this palette); this
script recolours, re-textures, finishes and composites them. Run: python build.py"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import lib  # noqa: E402
from lib import Image, frame, snap, hue_group  # noqa: E402
from palettes import C, hexes  # noqa: E402

PAL = hexes("C")
P = C


def classify_wg(c):
    h, s, v = hue_group(c)
    if s < 0.25 and v > 0.75:
        return "foam"
    if 140 <= h <= 210:
        return "water"
    if h < 62:
        return "sand"
    return "grass"


def classify_gf(c):
    h, s, v = hue_group(c)
    return "grass" if 62 <= h <= 130 and s > 0.45 else "floor"


WATER_R = [P["water1"], P["water2"], P["water3"], P["water4"]]
GRASS_R = [P["leaf1"], P["leaf2"], P["leaf3"], P["leaf4"]]
FLOOR_R = [P["floor0"], P["floor1"], P["floor2"], P["floor3"]]
wg_img = lib.remap_by_groups(
    Image.open(lib.RAW / "C_water_grass.png"), classify_wg,
    {"foam": [P["water4"], P["white"]], "water": WATER_R, "sand": [P["floor1"], P["floor2"], P["floor3"]],
     "grass": GRASS_R},
    {"foam": [0.5], "water": [0.06, 0.85, 0.97], "sand": [0.3, 0.75], "grass": [0.08, 0.7, 0.96]})
gf_img = lib.remap_by_groups(
    Image.open(lib.RAW / "C_grass_floor.png"), classify_gf,
    {"grass": GRASS_R, "floor": FLOOR_R},
    {"grass": [0.08, 0.7, 0.96], "floor": [0.08, 0.3, 0.9]})

textures = {
    "water": (("water", [P["water2"], P["water3"], P["water4"], P["white"]]),
              {"seed": 41, "ripples": 0.008, "glints": 0.0012, "hi": 0.9, "cell": 30}),
    "grass": (("grass", GRASS_R), {"seed": 42, "tufts": 0.03, "lo": 0.25, "hi": 0.8, "base": 1}),
    "floor": (("flags", FLOOR_R), {"seed": 43, "slab": (22, 13), "base": 2, "lo": 0.2, "hi": 0.85,
                                   "pebbles": 0.0015, "specks": 0.004, "cell": 30}),
}

miner = frame("C16", 0)
smelter = frame("C16", 5)
module = frame("C16", 10)
dock = frame("C32", 2)
houses = [frame("C32", 7), frame("C32", 8), frame("C32", 11), frame("C32", 9)]

ink = P["ink"]
icons = {
    "iron_ore": lib.icon("iron_ore", ink, [P["iron0"], P["iron1"], P["iron2"], P["white"]]),
    "iron_ingot": lib.icon("iron_ingot", ink, [P["iron0"], P["iron1"], P["iron2"], P["white"]]),
    "gear": lib.icon("gear", ink, [P["steel1"], P["steel2"], P["steel3"], P["steel4"]]),
}
belt = lib.belt_tile({"ink": ink, "rail0": P["steel1"], "rail1": P["steel2"], "rail2": P["steel3"],
                      "tread0": P["ink1"], "tread1": P["steel0"]})


def mod(ic):
    # hand-drawn: PixelLab's frame (C16 #10, kept in raw/) was too thin to out-read a machine
    return lib.module_tile([P["brass0"], P["brass1"], P["brass2"], P["brass3"]], P["ink1"], ink, ic,
                           P["steel3"], P["white"])


sprites = {
    "miner": miner, "smelter": smelter, "dock": dock, "lamp": frame("C16", 29),
    "reeds": frame("C16", 30), "lily": frame("C16", 31),
    "house0": houses[0], "house1": houses[1], "house2": houses[2], "house3": houses[3],
    "module_gear": mod(icons["gear"]), "module_idle": mod(icons["iron_ingot"]), **icons,
}

spec = {
    "tileset01": ("C_water_grass", wg_img), "tileset12": ("C_grass_floor", gf_img),
    "flips": {0: "xy", 1: "xy", 2: ""}, "textures": textures, "tex_edge": 1,
    # noon: shadows fall 2 px down-right, cool and hard
    "shadow": lib.darken_map(PAL, 0.32, P["water0"]), "sdx": 2, "sdy": 2,
    "light": None, "edge": P["floor0"], "ripple_col": P["white"],
    "ragged": [("grass", "floor", [P["leaf2"], P["leaf2"], P["leaf3"]], P["floor1"], 5, 0.55)],
    "ore_roles": {"pocket": P["floor0"], "ore0": P["iron0"], "ore1": P["iron1"], "ore2": P["iron2"],
                  "ore3": P["white"]},
    "belt": belt, "sprites": sprites,
    "decor": [("lily", 40, 24), ("lily", 120, 8), ("lily", 200, 28), ("lily", 252, 6), ("lily", 330, 26),
              ("reeds", 128, 50), ("reeds", 270, 52), ("reeds", 352, 56)],
    "standing_back": [("house0", 8, 2), ("house1", 74, 4), ("house2", 150, 2), ("house3", 288, 2),
                      ("lamp", 100, 60), ("lamp", 222, 60)],
}

scene = snap(lib.compose(spec), PAL)
scene.save(HERE / "scene.png")
lib.scale(scene, 3).save(HERE / "scene@3x.png")

# PixelLab drew a short crown; Bramble wears a proper top hat: the crown gets 4 more rows
portrait = lib.hat_lift(snap(Image.open(lib.RAW / "C_portrait.png"), PAL), 6, 4)
portrait.save(HERE / "portrait_bramble.png")
lib.scale(lib.on_bg(portrait, P["water1"]), 6).save(HERE / "portrait_bramble@6x.png")

parts = [miner, smelter, belt, icons["iron_ore"], icons["iron_ingot"], icons["gear"], dock,
         sprites["module_gear"], houses[0], portrait]
one, big = lib.parts_sheet(parts, P["floor2"], 5)
one.save(HERE / "parts.png")
big.save(HERE / "parts@5x.png")
(HERE / "parts").mkdir(exist_ok=True)
for n, im in sprites.items():
    im.save(HERE / "parts" / f"{n}.png")
print("scene colours", len({p[:3] for p in scene.getdata()}), "of", len(PAL))
