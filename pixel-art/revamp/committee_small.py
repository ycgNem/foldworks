"""The Committee at 24x24, drawn for its size (not halved): the top raccoon's masked face under a
fedora, the trench coat's lapels parted on a second masked face, and a third one's ringed tail
out of the hem at the bottom left. Three raccoons, one coat, readable in a list row.
python committee_small.py writes out/committee_small@8x.png for a look; portraits.py exports it."""
from common import P, from_rows, OUT, scale, on_bg

ROWS = [
    "........................",
    ".........kkkkkk.........",
    "........kHHHHHHk........",
    "........kHhhhhhk........",
    ".......kbbbbbbbbk.......",
    ".....kkHHHHHHHHHHkk.....",
    "....kkkkkkkkkkkkkkkk....",
    "....kdkGGGGGGGGGGkdk....",
    "....kkGwwwGGGGwwwgkk....",
    ".....kmmmmmGGmmmmmk.....",
    ".....kmwkmmggmmkwmk.....",
    ".....kgmmmgwwgmmmgk.....",
    "......kggwwwwwwggk......",
    ".......kkgwwkwwgkk......",
    ".....kkCkkgwwgkkckk.....",
    "....kCCCkdkkkkdkcck.....",
    "...kCCCCkgwggwgkccck....",
    "..kCCCCCkmmmmmmkcccck...",
    "kGkCCCCCkmwmmwmkcccck...",
    "kdkCCCCCkggwwggkcccck...",
    "kgGkCCCCkkgkkgkkcccck...",
    "kddkCCCCCkkkkkkcccccck..",
    "kgGkCCCCCCkcccccccccck..",
    "kdkkkkkkkkkkkkkkkkkkkk..",
]
KEY = {"k": P["ink"], "G": P["steel4"], "g": P["steel3"], "d": P["steel1"], "w": P["bone"],
       "m": P["ink1"], "H": P["wood2"], "h": P["wood1"], "b": P["ink2"], "C": P["wood4"],
       "c": P["wood3"]}


def committee_small():
    assert all(len(r) == 24 for r in ROWS) and len(ROWS) == 24
    return from_rows(ROWS, KEY)


if __name__ == "__main__":
    scale(on_bg(committee_small(), P["ink1"]), 8).save(OUT / "committee_small@8x.png")
