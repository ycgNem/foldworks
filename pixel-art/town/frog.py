"""town_frog: a frog townsperson walking right, 16x16, 4 frames (fps 8).

Feet on the bottom row (row 15) so the anchor [0, 0] at (x, deckTop - 15) stands it on a deck.
A big head with two eye bumps (pupils looking the way it walks), a wide mouth line, a copper
scarf whose tail flaps behind, a bone belly, two flipper feet. Contact, pass (body 1 px up),
contact, pass. Lit from straight above, so the game mirrors it for walking left (drawSprite's
flip): no light side to give it away.
"""
from common_town import new, ascii_, KEY

HEAD = [
    ".....kk..kk.....",
    "....kbbkkbbk....",
    "....kbkllbkk....",
    "...kllllllllk...",
    "...klllllllllk..",
    "...kmllllkkkkk..",
    "....kmmllllllk..",
    "....kcCCCCCCk...",
    "....kmlbbbllk...",
    "....kmlbbblk....",
    ".....kmmmmk.....",
]
# legs below the body: contact (wide stance) and pass (feet together under the body)
CONTACT = [
    "...kmk...klk....",
    "..kmmk..kllk....",
]
CONTACT2 = [
    "...klk...kmk....",
    "..kllk..kmmk....",
]
PASS = [
    "......kmlk......",
    "......kmlk......",
    ".....kmmllk.....",
]
# the scarf's tail behind the neck: hanging on contact frames, lifted on pass frames
TAIL = [
    [(3, 10, "C"), (3, 11, "c"), (2, 11, "c")],
    [(3, 10, "C"), (2, 10, "C"), (1, 10, "c")],
]


def draw(s, f):
    up = 1 if f in (1, 3) else 0
    y0 = 3 - up
    ascii_(s, 0, y0, HEAD)
    if f == 0:
        ascii_(s, 0, 14, CONTACT)
    elif f == 2:
        ascii_(s, 0, 14, CONTACT2)
    else:
        ascii_(s, 0, 13, PASS)
    tail = {(x, y - up) for (x, y, ch) in TAIL[f % 2]}
    for (x, y) in tail:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in tail and s.get(*q) is None:
                s.px(q[0], q[1], KEY["k"])
    for (x, y, ch) in TAIL[f % 2]:
        s.px(x, y - up, KEY[ch])


def build():
    s = new(16, 16, 4)
    for f in range(4):
        s.frame(f + 1)
        draw(s, f)
    s.frame(1)
    return s
