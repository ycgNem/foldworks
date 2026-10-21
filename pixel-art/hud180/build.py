"""Build every piece of the paper-and-ink HUD art (docs/hud-180.md) into src/art/ and out/, then
the contact sheet (out/sheet.png, out/sheet1x.png, out/parts.png, out/zoom_*.png).

    python build.py
"""
import inspector
import paper
import ribbons
import sheet
import wood

if __name__ == "__main__":
    for m in (paper, ribbons, wood, inspector):
        m.build()
    sheet.build()
    print("built", len(paper.export.__globals__["EXPORTED"]), "sprites")
