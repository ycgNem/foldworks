"""Act III's UI icons, appended to the UI atlases (append-only, STYLE.md "Atlases"): district (a
sky platform carrying two brass modules on its rotor struts) and chute (a steel funnel dropping a
crate down a brass chute), src/app/chrome.ts UICON 34-35 after the atlas's own 'bearings' (33).
16x16 in ui_icons, redrawn for 8x8 in ui_icons_small (not squeezed).

Run on its own from this folder: `python ui3.py` (it borrows pixel-art/revamp/'s common and pal,
as revamp/ui.py does, so it is not part of build.py, whose helpers are the sky folder's)."""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REVAMP = HERE.parent / "revamp"
sys.path.insert(0, str(REVAMP))

from PIL import Image  # noqa: E402

from common import P, SRC_ART, from_rows, export  # noqa: E402  (pixel-art/revamp/common.py)

K = {"o": P["ink"], "w": P["bone"], "4": P["steel4"], "3": P["steel3"], "1": P["steel1"],
     "a": P["brass1"], "b": P["brass2"], "c": P["brass3"], "d": P["ink1"]}

BIG = {
    # the District: a white-and-brass sky platform, two brass modules on its deck, rotor struts under
    "district": [
        "................",
        "..oooo....oooo..",
        "..occo....occo..",
        "..ocdo....ocdo..",
        "..obbo....obbo..",
        ".oooooooooooooo.",
        "owwwwwwwwwwwwwwo",
        "o44444444444444o",
        "obbbbbbbbbbbbbbo",
        ".oooooooooooooo.",
        "...o1o....o1o...",
        ".oooooooooooooo.",
        ".o3333o..o3333o.",
        ".oooooo..oooooo.",
        "................",
        "................",
    ],
    # the Chute: a steel funnel, the brass chute under it, a crate dropping out of its foot
    "chute": [
        ".oooooooooooooo.",
        ".owwwwwwwwwwwwo.",
        "..o4444444444o..",
        "...o33333333o...",
        "....o333333o....",
        ".....obbbbo.....",
        ".....obccbo.....",
        ".....obbbbo.....",
        "....oooooooo....",
        "....oaaaaaao....",
        "....oacbbcao....",
        "....oaaaaaao....",
        "....oooooooo....",
        ".......oo.......",
        "......o..o......",
        "................",
    ],
}
SMALL = {
    "district": [
        "........",
        ".ooo.ooo",
        ".obo.obo",
        "oooooooo",
        "owwwwwwo",
        "obbbbbbo",
        "oooooooo",
        "..o..o..",
    ],
    "chute": [
        "oooooooo",
        "ow4444wo",
        ".o3333o.",
        "..obbo..",
        ".oooooo.",
        ".oaccao.",
        ".oooooo.",
        "...oo...",
    ],
}
NEW = ["district", "chute"]


def append(name, size, drawings):
    meta = json.loads((SRC_ART / f"{name}.json").read_text())
    names = meta["names"]
    img = Image.open(SRC_ART / f"{name}.png").convert("RGBA")
    n0 = len(names)
    frames = [img.crop((i * size, 0, i * size + size, size)) for i in range(meta["frames"])]
    for k in NEW:
        icon = from_rows(drawings[k], K)
        assert icon.size == (size, size), (k, icon.size)
        if k in names:
            frames[names.index(k)] = icon
        else:
            names.append(k)
            frames.append(icon)
    export(name, frames, 0, extra={"names": names})
    return n0, len(names)


if __name__ == "__main__":
    print("ui_icons", append("ui_icons", 16, BIG))
    print("ui_icons_small", append("ui_icons_small", 8, SMALL))
