"""Direction A, "Foundry, remastered": palette A exactly (src/data/palette.ts, pips excluded),
night swamp, packed-earth floor. PixelLab supplies the terrain structure and the sprite drafts;
this script recolours, cleans, finishes and composites them. Run: python build.py"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import lib  # noqa: E402
from lib import Image, rgb, frame, snap, outline, recolor, draw, hue_group  # noqa: E402
from palettes import A, hexes  # noqa: E402

PAL = hexes("A")
P = A


# ---- terrain: PixelLab Wang sets, recoloured onto palette A ramps by lightness rank
def classify_wg(c):
    h, s, v = hue_group(c)
    if v < 0.22:
        return "deep"
    return "water" if 165 <= h <= 260 else "grass"


def classify_gf(c):
    h, s, v = hue_group(c)
    if 70 <= h <= 165 and s > 0.35:
        return "grass"
    return "floor"


wg_img = lib.remap_by_groups(
    Image.open(lib.RAW / "A_water_grass.png"), classify_wg,
    {"deep": [P["ink"], P["iron0"]],
     "water": [P["ink"], P["iron0"], P["teal0"], P["iron1"]],
     "grass": [P["shadow"], P["moss"], P["leaf"]]},
    {"deep": [0.5], "water": [0.62, 0.9, 0.975], "grass": [0.18, 0.88]})
gf_img = lib.remap_by_groups(
    Image.open(lib.RAW / "A_grass_floor.png"), classify_gf,
    {"grass": [P["shadow"], P["moss"], P["leaf"]],
     "floor": [P["shadow"], P["ground0"], P["ground1"], P["ground2"]]},
    {"grass": [0.18, 0.88], "floor": [0.02, 0.12, 0.8]})
WATER = [P["ink"], P["iron0"], P["teal0"], P["iron1"]]
GRASS = [P["shadow"], P["moss"], P["leaf"]]
EARTH = [P["ground0"], P["ground1"], P["ground2"]]
textures = {
    "water": (("water", WATER), {"seed": 21, "ripples": 0.008, "glints": 0.0006, "hi": 0.93, "cell": 30}),
    "deep": (("water", WATER), {"seed": 21, "ripples": 0.008, "glints": 0.0006, "hi": 0.93, "cell": 30}),
    "grass": (("grass", GRASS), {"seed": 22, "tufts": 0.03, "lo": 0.28, "hi": 0.8}),
    "floor": (("earth", EARTH), {"seed": 23, "pebbles": 0.004, "specks": 0.012, "lo": 0.24, "hi": 0.83, "cell": 34}),
}
# light pools: one warm step up, hand-picked (the automatic map turned earth into a red stain)
LIGHT = {**{lib.rgb(k): lib.rgb(v) for k, v in {
    P["ground0"]: P["ground1"], P["ground1"]: P["ground2"], P["ground2"]: P["ground2"],
    P["shadow"]: P["ground0"], P["moss"]: P["leaf"], P["leaf"]: P["hot"], P["ink"]: P["shadow"],
    P["iron0"]: P["iron1"], P["teal0"]: P["teal1"]}.items()}}

# ---- sprites: PixelLab drafts (already drawn in palette A), finished by hand
miner = frame("A16", 0)
smelter = frame("A16", 6)
module = frame("A16", 10)
dock = frame("A32", 0)
houses = [frame("A32", 7), frame("A32", 6), frame("A32", 11)]
lamp = frame("A16", 29)
reeds = frame("A16", 30)
lily = frame("A16", 31)

ink = P["ink"]
ore_ramp = [P["iron0"], P["iron1"], P["iron2"], P["bone"]]
icons = {
    "iron_ore": lib.icon("iron_ore", ink, ore_ramp),
    "iron_ingot": lib.icon("iron_ingot", ink, [P["iron0"], P["iron1"], P["iron2"], P["bone"]]),
    "gear": lib.icon("gear", ink, [P["hull0"], P["hull1"], P["hull2"], P["hull3"]]),
}


def module_with(icon_img):
    # hand-drawn: PixelLab's frame (A16 #10, kept in raw/) was too thin to out-read a machine
    return lib.module_tile([P["brass0"], P["brass1"], P["brass1"], P["hot"]], P["shadow"], ink,
                           icon_img, P["hull2"], P["bone"])


belt = lib.belt_tile({"ink": ink, "rail0": P["hull0"], "rail1": P["hull1"], "rail2": P["hull2"],
                      "tread0": P["shadow"], "tread1": P["ink"]})

sprites = {
    "miner": miner, "smelter": smelter, "dock": dock, "lamp": lamp, "reeds": reeds, "lily": lily,
    "house0": houses[0], "house1": houses[1], "house2": houses[2],
    "module_gear": module_with(icons["gear"]), "module_idle": module_with(icons["iron_ingot"]),
    **icons,
}

spec = {
    "tileset01": ("A_water_grass", wg_img), "tileset12": ("A_grass_floor", gf_img),
    "flips": {0: "xy", 1: "xy", 2: "xy"}, "textures": textures,
    "shadow": lib.darken_map(PAL, 0.4, P["ink"]),
    "light": LIGHT, "tex_edge": 1, "ripple_col": P["teal0"],
    "ragged": [("grass", "floor", [P["moss"], P["moss"], P["leaf"]], P["ground0"], 5, 0.55),
               ("grass", "water", [P["moss"], P["shadow"]], P["ink"], 6, 0.3)],
    "edge": P["shadow"],
    "ore_roles": {"pocket": P["shadow"], "ore0": P["ink"], "ore1": P["iron0"], "ore2": P["iron1"],
                  "ore3": P["iron2"]},
    "belt": belt, "sprites": sprites,
    "decor": [("lily", 40, 22), ("lily", 200, 30), ("lily", 330, 14), ("reeds", 120, 50),
              ("reeds", 262, 52), ("reeds", 350, 58)],
    "standing_back": [("house0", 10, 2), ("house1", 74, 6), ("house2", 150, 4), ("house0", 284, 4),
                      ("lamp", 104, 62), ("lamp", 222, 62)],
    "light_pools": [(lib.SMELTER[0] * 16 + 8, lib.SMELTER[1] * 16 + 17, 11, 6),
                    (111, 78, 9, 5), (229, 78, 9, 5)],
}

scene = lib.compose(spec)
scene = snap(scene, PAL)
scene.save(HERE / "scene.png")
lib.scale(scene, 3).save(HERE / "scene@3x.png")

portrait = snap(Image.open(lib.RAW / "A_portrait.png"), PAL)
portrait.save(HERE / "portrait_bramble.png")
lib.scale(lib.on_bg(portrait, P["shadow"]), 6).save(HERE / "portrait_bramble@6x.png")

parts = [miner, smelter, belt, icons["iron_ore"], icons["iron_ingot"], icons["gear"], dock,
         sprites["module_gear"], houses[0], portrait]
one, big = lib.parts_sheet(parts, P["ground1"], 5)
one.save(HERE / "parts.png")
big.save(HERE / "parts@5x.png")
for n, im in sprites.items():
    (HERE / "parts").mkdir(exist_ok=True)
    im.save(HERE / "parts" / f"{n}.png")
used = {p[:3] for p in scene.getdata()}
print("scene colours", len(used), "of", len(PAL))
