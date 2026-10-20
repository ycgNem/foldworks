"""The game palette after the art revamp: direction B, "Lantern Bayou" (DECISIONS.md, the art
revamp). Phase 1's 48 colours (pixel-art/revamp-test/palettes.py) plus three the full game needed
(a lighter deck board, a bright violet for Patents and plastic, a light teal for research and
glass) plus the five pip colours, which stay code-only (never in sprite art).

ROLES maps every slot name of palette A's `C` object (src/data/palette.ts) to the B colour that
plays that role now, so code keeps reading the same names. A_TO_B maps palette A's 32 hexes to B,
used to recolour any old sprite that has not been redrawn yet.
"""

B = {
    # night inks, violet-leaning so the dark reads as dusk, not as black
    "ink": "#130e1c", "ink1": "#211a30", "ink2": "#322944",
    # deep teal-green water
    "water0": "#0e2629", "water1": "#143638", "water2": "#1c4a49", "water3": "#2a625c", "water4": "#4a8a78",
    # moss and swamp greens
    "moss0": "#1d2f22", "moss1": "#2b4628", "moss2": "#3d5f2d", "moss3": "#587b34", "moss4": "#7e9b3e", "moss5": "#a8bf55",
    # warm wood (planks, pilings, frames); wood5 is the lit deck board (new in phase 2)
    "wood0": "#3a221f", "wood1": "#583428", "wood2": "#7a4b33", "wood3": "#9e6a42", "wood4": "#c28f5a",
    "wood5": "#dcb07a",
    # packed earth
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
    # slag, violet, teal accents
    "slag0": "#4f3658", "slag1": "#83568a", "violet": "#b45aa0", "teal": "#7ccdb4",
    "bone": "#eee2c6", "lily": "#c2db74", "red": "#c43a32",
}
# status pips: code-only, apart by lightness (yellow > green > blue > red > grey)
PIPS = {"pipGreen": "#66cc50", "pipYellow": "#ffe466", "pipRed": "#c8362e", "pipGrey": "#3d3c42",
        "pipBlue": "#4a8fe2"}   # unchanged from palette A (their lightness order is tested in STYLE.md)

ART = list(B.values())                    # every colour a sprite may use
PALETTE = ART + list(PIPS.values())        # src/data/palette.ts PALETTE (the art scripts snap to it)

# palette A's slot names -> B colours (src/data/palette.ts keeps every name)
ROLES = {
    "ink": B["ink"], "shadow": B["ink1"], "bone": B["bone"],
    "ground0": B["wood0"], "ground1": B["wood1"], "ground2": B["wood2"],
    "hull0": B["steel1"], "hull1": B["steel2"], "hull2": B["steel3"], "hull3": B["steel4"],
    "iron0": B["iron0"], "iron1": B["iron1"], "iron2": B["iron2"],
    "copper0": B["copper0"], "copper1": B["copper1"], "copper2": B["copper2"],
    "slag": B["slag1"],
    "brass0": B["brass1"], "brass1": B["brass2"], "glow": B["lamp1"], "hot": B["lamp3"],
    "teal0": B["water3"], "teal1": B["teal"],
    "moss": B["moss3"], "leaf": B["moss5"],
    "violet": B["violet"],
    **PIPS,
    "gold": B["lamp2"],
}

A_HEX = {
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
    "pipGreen": "#66cc50", "pipYellow": "#ffe466", "pipRed": "#c8362e", "pipGrey": "#3d3c42", "pipBlue": "#4a8fe2",
    "gold": "#ffcc3d",
}
A_TO_B = {A_HEX[k]: ROLES[k] for k in A_HEX}

if __name__ == "__main__":
    print(len(ART), "art colours,", len(PALETTE), "with pips")
