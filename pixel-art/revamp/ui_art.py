"""The UI art the game still draws, redrawn in Lantern Bayou from its own recipes (recipes.py),
colours fitted by role:

    ui_panel, ui_panel_light, ui_inset   (ui/chrome.py) the ornate menu frame kept ornate: B's
        four-step brass for the rod and the corner plates (brass3 highlights, lamp3 glints on the
        rivets only), the wood frame a step warmer (wood1-3), the face night-violet (ink1);
    ui_node, ui_stamp_ring                (ui/chrome.py) the same brass;
    ui_coin, ui_coin_small                (ui/icons.py)  lantern gold coins;
    ui_grade                              (ui/letters.py) S A B C D S+, frame order fixed (S+ is 6);
    ui_audit                              (m5/audit.py)  the audit clock.

python ui_art.py"""
import common as rc   # the revamp's helpers, bound before the stand-in replaces `common`

import recipes as R

FRAME = dict(gold="brass3", brass0="brass0", brass1="brass2", ground0="wood1", ground1="wood2", ground2="wood3",
             shadow="ink1")
# coins and grade letters: the logo's folded brass (deepest brass0 under lantern gold)
BRASS = dict(brass0="brass0", brass1="brass2")
# the audit clock: a bone face, a copper case warmed a step, a lamp-lit hand
CLOCK = dict(copper0="copper1", copper1="copper2", copper2="copper3")


def recipe(path, role, name=None, fw=False):
    P = R.role(**role)
    m = R.shim(P)
    if fw:
        m.fw = R.load_fw(P)
    m.frames = R.frames
    return R.load(path, name)


def meta(name):
    import json
    return json.loads((rc.SRC_ART / f"{name}.json").read_text())


def replace_named(name, size, order, new_frames):
    """Put each recipe frame into the shipped atlas at its name's place; keep the rest."""
    from PIL import Image
    m = meta(name)
    names = m["names"]
    img = Image.open(rc.SRC_ART / f"{name}.png").convert("RGBA")
    frames = [img.crop((i * size, 0, i * size + size, size)) for i in range(m["frames"])]
    done = 0
    for n, f in zip(order, new_frames):
        if n in names:
            frames[names.index(n)] = f
            done += 1
    rc.export(name, frames, m["fps"], extra={"names": names})
    print(name, done, "of", len(names), "redrawn from recipes")


def build():
    ch = recipe(R.ROOT / "pixel-art/ui/chrome.py", FRAME, "chrome")
    for name, fn in (("ui_panel", ch.panel), ("ui_panel_light", ch.paper), ("ui_inset", ch.inset),
                     ("ui_node", ch.node), ("ui_stamp_ring", ch.stamp_ring)):
        m = meta(name)
        extra = {k: v for k, v in m.items() if k not in ("frame", "frames", "anchor", "fps")}
        rc.export(name, R.frames(fn()), m["fps"], extra=extra or None)
    R.shim(R.role(**BRASS))
    R.load(R.ROOT / "pixel-art/ui/icons_m4.py")          # icons.py imports it (its M4 icons)
    ic = R.load(R.ROOT / "pixel-art/ui/icons.py", "icons_ui")
    rc.export("ui_coin", R.frames(ic.coin(16)), 10)
    rc.export("ui_coin_small", R.frames(ic.coin(8)), 10)
    # the icon atlases: every Milestone 1-5 icon from its recipe in B, by name, in place (the
    # atlases are append-only; icons with no recipe here, the Milestone 5-6 ones, are kept)
    replace_named("ui_icons", 16, ic.ICON_ORDER, R.frames(ic.icons()))
    m = R.shim(R.role(**BRASS))
    m.ICONCH, m.Sprite = {}, R.Sprite
    R.load(R.ROOT / "pixel-art/m2/common_m2.py", "common_m2")
    sp = R.load(R.ROOT / "pixel-art/m2/sprites.py", "sprites_m2")
    replace_named("ui_icons_small", 8, sp.ICON_ORDER, R.frames(sp.icons_small()))
    ri = recipe(R.ROOT / "pixel-art/m5/research_icons.py", BRASS, "research_icons_ui")
    rc.export("ui_research", R.frames(ri.build()), 0, extra={k: v for k, v in meta("ui_research").items()
                                                             if k not in ("frame", "frames", "anchor", "fps")})
    le = recipe(R.ROOT / "pixel-art/ui/letters.py", BRASS, "letters_ui")
    rc.export("ui_grade", R.frames(le.grades()), 0, extra={"order": ["S", "A", "B", "C", "D", "S+"]})
    au = recipe(R.ROOT / "pixel-art/m5/audit.py", CLOCK, "audit_ui")
    rc.export("ui_audit", R.frames(au.build()), meta("ui_audit")["fps"])


if __name__ == "__main__":
    build()
