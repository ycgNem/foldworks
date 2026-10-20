"""The pictures, redrawn in Lantern Bayou from their own recipes (recipes.py) with each picture's
colours chosen by role:

    mega_bay      32x32 x6  (m4/bay.py)    the Megaproject Bay on the Factory floor: B's steel pad,
                                           blue gantry, copper-and-brass drill, lamp-lit beacon
    mega_stage1   48x48 x10 (m5/mega.py)   the Megaproject panel's scene: the dusk sky is the bayou's
    research_lab  64x48 x4  (m5/lab.py)    night (ink violets falling to slag and violet), the town's
                                           roofs black against it with lantern-lit windows
    logo          220x40    (ui/letters.py) FOLDWORKS in brass folded along its crease: B's four-step
    logo_glint    220x40 x8                brass gives the lower half a deeper fold, lantern gold above

python pictures.py"""
import common as rc   # the revamp's helpers, bound before the stand-in replaces `common`

import recipes as R

DUSK = dict(iron0="ink2", slag="slag0", violet="slag1", shadow="ink")


def picture(path, role, name=None):
    P = R.role(**role)
    m = R.shim(P)
    fw = R.load_fw(P)
    m.fw = fw
    m.frames = R.frames
    mod = R.load(path, name)
    return mod


def build():
    # the bay's pad a step darker than the Factory's plates (it reads as a pit and a structure),
    # its brass deeper, its beacon and glow lantern-lit
    bay = picture(R.ROOT / "pixel-art/m4/bay.py", dict(hull0="steel0", hull1="steel1", hull2="steel2",
                                                        hull3="steel3", brass0="brass0", brass1="brass2"))
    rc.export("mega_bay", R.frames(bay.build()), 6, extra={"names": bay.NAMES})
    mega = picture(R.ROOT / "pixel-art/m5/mega.py", DUSK)
    rc.export("mega_stage1", R.frames(mega.build()), 4, extra={"names": mega.NAMES})
    lab = picture(R.ROOT / "pixel-art/m5/lab.py", DUSK)
    rc.export("research_lab", R.frames(lab.build()), 6)
    let = picture(R.ROOT / "pixel-art/ui/letters.py", dict(brass0="brass0", brass1="brass2", shadow="ink1"),
                  "letters")
    s, face = let.logo()
    rc.export("logo", R.frames(s), 0)
    rc.export("logo_glint", R.frames(let.logo_glint(face)), 12)


if __name__ == "__main__":
    build()
