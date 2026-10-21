"""Palette B extended: "Lantern Bayou, with the sky" (docs/sky-island.md, the style test).

B's 51 art colours and 5 pips are imported unchanged from pixel-art/revamp/pal.py (indices never
move); the sky island's colours are appended after the pips, in the order below, and named here
and (at production) in src/data/palette.ts `C`.

Rules (the doc's, checked by `python pal.py`):
- paving stays apart from the paper `bone` #eee2c6 (floor tags read on it) and mid enough that the
  machines' dark steel skids and the dark belts pop: pave2 (the fill) is at least 12 points of
  OKLab L under bone and 30 over steel1 (the skid); the grout pave0 at least 10 over steel1, so a
  grout line never reads as a belt;
- grass is brighter and more saturated than B's moss (moss stays the swampy accent);
- the sky's lightest step (sky4) sits under the horizon only;
- cloud3 is the only pure white, used on lit cloud tops, waterfall foam and nothing on the plot.
"""
import importlib.util
import math
from pathlib import Path

# pixel-art/revamp/pal.py, palette B (loaded by path: it shares this module's name)
_spec = importlib.util.spec_from_file_location("pal_b", Path(__file__).resolve().parents[1] / "revamp" / "pal.py")
_b = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_b)

B = dict(_b.B)
PIPS = dict(_b.PIPS)

# ---------------------------------------------------------------- the new colours (appended)
SKY = {
    # zenith to horizon: a clear, saturated day blue falling to a pale haze
    "sky0": "#3570cc", "sky1": "#4f8ae0", "sky2": "#76aaec", "sky3": "#a2cbf4", "sky4": "#d2e9fa",
    # cloud: deep shade (blue, it takes the sky's colour) to the lit top
    "cloud0": "#93add6", "cloud1": "#bdd2ee", "cloud2": "#e4eefa", "cloud3": "#ffffff",
    # meadow: bright, saturated, yellow-leaning in the light (sun), blue-leaning in the shade;
    # its fill (grass2) sits ~10 L under the paving's so owned and for-sale land differ in
    # lightness too, not only in hue (a deuteranope sees both as mustard-beige otherwise)
    "grass0": "#275f35", "grass1": "#3b8539", "grass2": "#58a843", "grass3": "#8bcb57",
    # warm paving: grout to lit edge; stays well under bone and well over the steel skid
    "pave0": "#7a7064", "pave1": "#9c9080", "pave2": "#b9ad97", "pave3": "#d2c6ac",
    # the horizon's warm glow round the sun
    "sun": "#ffe6b8",
}

ART = list(B.values()) + list(SKY.values())         # every colour a sprite may use (pips never)
PALETTE = list(B.values()) + list(PIPS.values()) + list(SKY.values())   # src/data/palette.ts order
P = {**B, **SKY}


# ---------------------------------------------------------------- checks
def _rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def oklab(h):
    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(c) for c in _rgb(h))
    l_ = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m_ = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s_ = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    return L * 100, a * 100, bb * 100


def chroma(h):
    _, a, b = oklab(h)
    return math.hypot(a, b)


_CVD = {"deut": [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
        "prot": [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]]}


def cvd(h, kind):
    """The colour as a dichromat sees it (Machado et al. 2009, severity 1), as a hex."""
    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    def unlin(c):
        return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
    r, g, b = (lin(c) for c in _rgb(h))
    m = _CVD[kind]
    o = [max(0.0, min(1.0, m[i][0] * r + m[i][1] * g + m[i][2] * b)) for i in range(3)]
    return "#" + "".join(f"{int(unlin(c) * 255 + 0.5):02x}" for c in o)


def check():
    L = {k: oklab(v)[0] for k, v in P.items()}
    out = []
    out.append(("pave2 >= 12 L under bone", L["bone"] - L["pave2"] >= 12, round(L["bone"] - L["pave2"], 1)))
    out.append(("pave3 >= 6 L under bone", L["bone"] - L["pave3"] >= 6, round(L["bone"] - L["pave3"], 1)))
    out.append(("pave2 >= 30 L over steel1 (the skid)", L["pave2"] - L["steel1"] >= 30, round(L["pave2"] - L["steel1"], 1)))
    out.append(("pave0 (grout) >= 10 L over steel1", L["pave0"] - L["steel1"] >= 10, round(L["pave0"] - L["steel1"], 1)))
    out.append(("grass2 brighter than moss4", L["grass2"] > L["moss4"], round(L["grass2"] - L["moss4"], 1)))
    out.append(("grass more saturated than moss", chroma(P["grass2"]) > chroma(P["moss4"]), round(chroma(P["grass2"]) - chroma(P["moss4"]), 1)))
    for ramp in (["sky0", "sky1", "sky2", "sky3", "sky4"], ["cloud0", "cloud1", "cloud2", "cloud3"],
                 ["grass0", "grass1", "grass2", "grass3"], ["pave0", "pave1", "pave2", "pave3"]):
        steps = [round(L[ramp[i + 1]] - L[ramp[i]], 1) for i in range(len(ramp) - 1)]
        out.append((f"{ramp[0][:-1]} ramp rises", all(s > 4 for s in steps), steps))
    # owned (pave2) vs for-sale (grass2) under deuteranopia and protanopia (Machado 2009, full
    # severity): at least 10 OKLab dE apart, with the paving the lighter
    for kind in ("deut", "prot"):
        a, b = oklab(cvd(P["pave2"], kind)), oklab(cvd(P["grass2"], kind))
        d = math.dist(a, b)
        out.append((f"pave2 vs grass2 under {kind} >= 10 dE, paving lighter", d >= 10 and a[0] > b[0], round(d, 1)))
    # nothing new duplicates an old colour
    old = set(B.values()) | set(PIPS.values())
    out.append(("no duplicates", not (set(SKY.values()) & old) and len(set(SKY.values())) == len(SKY), len(SKY)))
    return out, L


if __name__ == "__main__":
    res, L = check()
    for name, ok, val in res:
        print(("ok  " if ok else "FAIL"), name, val)
    print(len(B), "B colours +", len(SKY), "new =", len(ART), "art colours,", len(PALETTE), "with pips")
    for k in SKY:
        print(f"  {k:7s} {SKY[k]}  L {L[k]:5.1f}  C {chroma(SKY[k]):5.1f}")
    print("  bone    ", B["bone"], f" L {L['bone']:5.1f}", "  steel1", B["steel1"], f"L {L['steel1']:5.1f}",
          "  moss4", B["moss4"], f"L {L['moss4']:5.1f} C {chroma(B['moss4']):5.1f}")
