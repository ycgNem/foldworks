"""The three style-test palettes (phase 1 of the PixelLab revamp test).

A is the game's palette A ("Foundry", src/data/palette.ts) exactly, minus the five pip colours
(pips are code-drawn and never appear in sprite art). B and C are new, drawn for this test as
hue-shifted ramps: each ramp walks warmer/lighter toward the light and cooler/darker into shade.
Running this file writes each direction's palette.hex, palette.json and a swatch PNG.
"""
import json
from pathlib import Path

# --- A: "Foundry, remastered" (src/data/palette.ts PALETTE, pips removed) -------------------
A = {
    "ink": "#1d1420", "shadow": "#3a2532", "bone": "#f2e6cf",
    "ground0": "#4a3431", "ground1": "#62473b", "ground2": "#7e624c",
    "hull0": "#463f50", "hull1": "#847f87", "hull2": "#b4ada9", "hull3": "#dccfb8",
    "iron0": "#333a5a", "iron1": "#5c6d93", "iron2": "#96a9c6",
    "copper0": "#722d2a", "copper1": "#c4633b", "copper2": "#ec9e78",
    "slag": "#74586e",
    "brass0": "#7a5418", "brass1": "#c99a3a", "glow": "#f5952a", "hot": "#ffeca0",
    "teal0": "#2a6566", "teal1": "#6fc1ae",
    "moss": "#5a6a2e", "leaf": "#9cb446",
    "violet": "#9a4a88",
    "gold": "#ffcc3d",
}
A_PIPS = ["#66cc50", "#ffe466", "#c8362e", "#3d3c42", "#4a8fe2"]  # reserved, code-drawn

# --- B: "Lantern Bayou" (dusk swamp, 50 colours) --------------------------------------------
B = {
    # night inks, violet-leaning so the dark reads as dusk, not as black
    "ink": "#130e1c", "ink1": "#211a30", "ink2": "#322944",
    # deep teal-green water, five steps
    "water0": "#0e2629", "water1": "#143638", "water2": "#1c4a49", "water3": "#2a625c", "water4": "#4a8a78",
    # moss and swamp greens
    "moss0": "#1d2f22", "moss1": "#2b4628", "moss2": "#3d5f2d", "moss3": "#587b34", "moss4": "#7e9b3e", "moss5": "#a8bf55",
    # warm wood (planks, pilings, frames)
    "wood0": "#3a221f", "wood1": "#583428", "wood2": "#7a4b33", "wood3": "#9e6a42", "wood4": "#c28f5a",
    # packed earth of the work floor
    "earth0": "#3e302d", "earth1": "#56433a", "earth2": "#705847", "earth3": "#8c7258",
    # machine steel, cool blue-violet
    "steel0": "#2c3042", "steel1": "#464c65", "steel2": "#6b7290", "steel3": "#98a0b8", "steel4": "#cbd0de",
    # iron
    "iron0": "#273a68", "iron1": "#4066a8", "iron2": "#76a3dc",
    # copper
    "copper0": "#6a2723", "copper1": "#aa472d", "copper2": "#de7a44", "copper3": "#f4ac74",
    # lantern light and heat
    "lamp0": "#b4561c", "lamp1": "#ee8a26", "lamp2": "#ffbe48", "lamp3": "#fff0a6",
    # brass
    "brass0": "#5b4016", "brass1": "#91701f", "brass2": "#c8a13a", "brass3": "#ecd27c",
    # slag and violet accents
    "slag0": "#4f3658", "slag1": "#83568a",
    "bone": "#eee2c6", "lily": "#c2db74", "red": "#c43a32",
}

# --- C: "Daylight Workshop" (sunlit, high key, 50 colours) ----------------------------------
C = {
    "ink": "#221d2b", "ink1": "#3a3344",
    # sunlit lily-pad swamp: green-turquoise water
    "water0": "#1f5e6a", "water1": "#2b7f86", "water2": "#3ea4a3", "water3": "#62c6b8", "water4": "#a2e6d2",
    # lily pads and grass
    "leaf0": "#24502e", "leaf1": "#357a38", "leaf2": "#52a63f", "leaf3": "#80cc4c", "leaf4": "#bde879",
    # light warm work floor (sanded planks / sandstone)
    "floor0": "#8a6646", "floor1": "#ad875c", "floor2": "#c9a676", "floor3": "#e2c795", "floor4": "#f4e2b8",
    # wood
    "wood0": "#4e3024", "wood1": "#734431", "wood2": "#9c6240",
    # machine steel, cool and clean
    "steel0": "#3e4558", "steel1": "#616b82", "steel2": "#8e9bb0", "steel3": "#c2ccda", "steel4": "#eef3f8",
    # iron (saturated blue)
    "iron0": "#26468e", "iron1": "#3f75d0", "iron2": "#7cb0f0",
    # copper
    "copper0": "#8e321f", "copper1": "#d65e2c", "copper2": "#f49458", "copper3": "#ffc796",
    # heat
    "heat0": "#ff7d1a", "heat1": "#ffc23a", "heat2": "#fff3ae",
    # brass
    "brass0": "#82591a", "brass1": "#c38f28", "brass2": "#eec44a", "brass3": "#fff0a2",
    # accents
    "red": "#d6403a", "red1": "#9a2a30", "slag0": "#6e5482", "slag1": "#a483b6",
    "frog0": "#2f6b2a", "pink": "#f08aa0", "white": "#fffaf0", "sky": "#d8f4ff",
}

PALETTES = {"A": A, "B": B, "C": C}


def hexes(name):
    return list(PALETTES[name].values())


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


if __name__ == "__main__":
    from PIL import Image
    here = Path(__file__).resolve().parent
    for name, pal in PALETTES.items():
        out = here / name
        out.mkdir(exist_ok=True)
        (out / "palette.hex").write_text("\n".join(h.lstrip("#") for h in pal.values()) + "\n")
        (out / "palette.json").write_text(json.dumps(pal, indent=1))
        cols = list(pal.values())
        w = 10
        rows = (len(cols) + w - 1) // w
        img = Image.new("RGB", (w, rows), (0, 0, 0))
        for i, c in enumerate(cols):
            img.putpixel((i % w, i // w), rgb(c))
        img.save(out / "palette.png")
        img.resize((w * 16, rows * 16), Image.NEAREST).save(out / "palette_swatch.png")
        print(name, len(cols), "colours")
