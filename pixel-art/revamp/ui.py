"""UI icon atlases: the Milestone 1-4 icons (recoloured into Lantern Bayou) keep their places,
and the Milestone 5-6 icons are appended (append-only, STYLE.md): patents, blueprint, reset,
overnight (src/app/chrome.ts UICON 29-32) and bearings (33, the Committee's Raccoon Bearings).
16x16 in ui_icons, redrawn for 8x8 in ui_icons_small (not squeezed)."""
import json

from PIL import Image

from common import P, SRC_ART, from_rows, export, new

BIG = {
    "patents": ([
        "................",
        "..oooooooooooo..",
        ".o222222222221o.",
        ".o2oooooooo221o.",
        ".o222222222221o.",
        ".o2ooooooo2221o.",
        ".o222222222221o.",
        ".o2ooooo222221o.",
        ".o22222222oooo..",
        ".o2222222ovvvvo.",
        ".o222222ovVVvvvo",
        ".o111111ovVvvvvo",
        "..ooooooovvvvvvo",
        "........oovvvvo.",
        "........ovo..ovo",
        ".........o....o.",
    ], {"o": P["ink"], "1": P["steel3"], "2": P["bone"], "v": P["slag1"], "V": P["violet"]}),
    "blueprint": ([
        "................",
        "..ooooooooooooo.",
        ".obbbbbbbbbbbbo.",
        ".obBbBbBbBbBbbo.",
        ".obbbbbbbbbbbbo.",
        ".obBwwwwwwwBbbo.",
        ".obbwbbbbbwbbbo.",
        ".obBwbBbBbwBbbo.",
        ".obbwwwwwwwbbbo.",
        ".obBbBbBbBbBbbo.",
        ".obbbbbbbbbbbbo.",
        ".oaaaaaaaaaaaao.",
        ".o2222222222220.",
        ".o3oooooooooooo.",
        "..oo............",
        "................",
    ], {"o": P["ink"], "b": P["iron0"], "B": P["iron1"], "w": P["bone"], "a": P["brass2"], "2": P["bone"],
        "3": P["brass2"], "0": P["steel3"]}),
    "reset": ([
        "................",
        ".....oooooo.....",
        "...oovvvvvvoo...",
        "..ovvoooooovvo..",
        ".ovvo......ovvo.",
        ".ovo..oooo..ovo.",
        "ovvo.o2222o.ovvo",
        "ovo..o2221o..ovo",
        "ovo..o2111o..ovo",
        "ovvo.oooooo.oooo",
        ".ovo.......ovVVo",
        ".ovvo.......oVo.",
        "..ovvoooooo..o..",
        "...oovvvvvvoo...",
        ".....oooooo.....",
        "................",
    ], {"o": P["ink"], "v": P["slag1"], "V": P["violet"], "1": P["steel3"], "2": P["bone"]}),
    "overnight": ([
        "....oooo........",
        "...o33oo........",
        "..o33o..........",
        "..o3o.......o...",
        "..o3o......oLo..",
        "..o33o......o...",
        "...o33oooo.ooo..",
        "....oo3333oaaao.",
        "......oooooa1aao",
        "..........ol2l1o",
        "..........ol3l1o",
        "..........ol2l1o",
        "..........oaaaao",
        "...........oooo.",
        "................",
        "................",
    ], {"o": P["ink"], "3": P["lamp3"], "L": P["lamp2"], "a": P["brass1"], "1": P["brass2"], "l": P["lamp1"],
        "2": P["lamp2"]}),
    "bearings": ([
        "................",
        ".....oooooo.....",
        "...oo444444oo...",
        "..o4433333344o..",
        ".o43oo3oo3oo34o.",
        ".o43owo..owo34o.",
        "o433oo....oo334o",
        "o43o........o34o",
        "o43o........o32o",
        "o433oo....oo322o",
        ".o23owo..owo32o.",
        ".o23oo3oo3oo32o.",
        "..o2233333322o..",
        "...oo222222oo...",
        ".....oooooo.....",
        "................",
    ], {"o": P["ink"], "2": P["steel2"], "3": P["steel3"], "4": P["steel4"], "w": P["bone"]}),
}
SMALL = {
    "patents": ([
        "oooooo..",
        "o2222o..",
        "o2oo2o..",
        "o2222oo.",
        "o222ovvo",
        "oooovVvo",
        "....ovvo",
        "....o.o.",
    ], {"o": P["ink"], "2": P["bone"], "v": P["slag1"], "V": P["violet"]}),
    "blueprint": ([
        "ooooooo.",
        "obBbBbo.",
        "obwwwbo.",
        "obwbwbo.",
        "obwwwbo.",
        "oaaaaao.",
        "o22222o.",
        "ooooooo.",
    ], {"o": P["ink"], "b": P["iron0"], "B": P["iron1"], "w": P["bone"], "a": P["brass2"], "2": P["bone"]}),
    "reset": ([
        "..oooo..",
        ".ovvvvo.",
        "ovo..ovo",
        "ov.oo.vo",
        "ov.oo.oo",
        "ovo..oVo",
        ".ovvvo.o",
        "..ooo...",
    ], {"o": P["ink"], "v": P["slag1"], "V": P["violet"]}),
    "overnight": ([
        ".ooo....",
        "o33o....",
        "o3o..o..",
        "o33ooLo.",
        ".oo3ooo.",
        "....oaao",
        "....o2lo",
        "....oooo",
    ], {"o": P["ink"], "3": P["lamp3"], "L": P["lamp2"], "a": P["brass2"], "2": P["lamp2"], "l": P["lamp1"]}),
    "bearings": ([
        "..oooo..",
        ".o4433o.",
        "o4oooo3o",
        "o3o..o3o",
        "o3o..o2o",
        "o3oooo2o",
        ".o3222o.",
        "..oooo..",
    ], {"o": P["ink"], "2": P["steel2"], "3": P["steel3"], "4": P["steel4"]}),
}
NEW = ["patents", "blueprint", "reset", "overnight", "bearings"]


def append(name, size, drawings):
    meta = json.loads((SRC_ART / f"{name}.json").read_text())
    names = meta["names"]
    img = Image.open(SRC_ART / f"{name}.png").convert("RGBA")
    n0 = len(names)
    frames = [img.crop((i * size, 0, i * size + size, size)) for i in range(meta["frames"])]
    for k in NEW:
        rows, key = drawings[k]
        icon = from_rows(rows, key)
        assert icon.size == (size, size), (k, icon.size)
        if k in names:
            frames[names.index(k)] = icon
        else:
            names.append(k)
            frames.append(icon)
    export(name, frames, 0, extra={"names": names})
    return n0, len(names)


def build():
    print("ui_icons", append("ui_icons", 16, BIG))
    print("ui_icons_small", append("ui_icons_small", 8, SMALL))


if __name__ == "__main__":
    build()
