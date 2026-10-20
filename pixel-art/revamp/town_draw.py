"""The town pieces drawn by hand in Milestone 4 (pixel-art/town/: Unit 7's observatory, Dame
Voltaire's pavilion, the frog townsfolk, lily pads and reeds, the boardwalk), redrawn in Lantern
Bayou through recipes.py, with the town's B choices:

- the waterline and every ripple in the bayou's own water ramp (water3 rings, a water4 glint),
  not palette A's iron blue;
- the boardwalk, decks and pilings in the Workshop deck's lighter boards (wood1 seams and faces,
  wood3 boards, wood4 lit rims), so the walkway reads as the same timber as the floors;
- the windows lantern-lit (lamp1 glass, lamp3 hot corner).

python town_draw.py"""
import common as rc   # the revamp's own helpers (export); bound before the stand-in replaces it

from recipes import ROOT, B, role, shim, load, frames

TOWN = ROOT / "pixel-art" / "town"


def build():
    shim(role())
    ct = load(TOWN / "common_town.py")
    mods = {n: load(TOWN / f"{n}.py") for n in ("boardwalk", "frog", "lily", "unit7", "voltaire")}
    # the water: B's own ramp for every ripple and glint
    for m in (ct, mods["boardwalk"], mods["lily"]):
        m.I0, m.T0 = B["water3"], B["water4"]
    # the timber: the deck's lighter boards
    for m in (ct, mods["boardwalk"], mods["unit7"], mods["voltaire"]):
        m.G0, m.G1, m.G2 = B["wood1"], B["wood3"], B["wood4"]
    out = {}
    for name, mod in mods.items():
        out[name] = frames(mod.build())
    rc.export("town_boardwalk", out["boardwalk"], 0, extra={"order": mods["boardwalk"].ORDER})
    rc.export("town_frog", out["frog"], 8)
    rc.export("town_lily", out["lily"], 0, extra={"order": mods["lily"].ORDER})
    rc.export("town_unit7", out["unit7"], 4)
    rc.export("town_voltaire", out["voltaire"], 8)


if __name__ == "__main__":
    build()
