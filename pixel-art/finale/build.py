"""The Floating City lifting off (the core ending, src/app/finale.ts).

Raw: one PixelLab pixflux generation (pixel-art/finale/prompts.md), its palette forced to the
title scene's 48 most used colours so it sits in the key art. This script cleans it by plain rules:
the cloud puffs it drew under the rotors are cut (the finale draws its own puffs, moving), stray
outline pixels left by them are removed, the canvas is cropped to the city, and the rotor tips (the
lowest pixel of each brass stalk) go to the sidecar so the finale can spin a blade on each.
Run: py -3.13 pixel-art/finale/build.py
"""
import json, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, '..', '..', 'src', 'art')

im = Image.open(os.path.join(HERE, 'raw', 'city_pixellab.png')).convert('RGBA')
W, H = im.size
px = im.load()


def light(c):
    r, g, b, a = c
    return a > 0 and min(r, g, b) > 120 and max(r, g, b) - min(r, g, b) < 60


# the cloud puffs: light, unsaturated pixels under the platform's rim
RIM = 62
for y in range(RIM, H):
    for x in range(W):
        if light(px[x, y]):
            px[x, y] = (0, 0, 0, 0)
# their cool grey shading: under the rim's underside only the warm brass stalks stand
for y in range(RIM + 4, H):
    for x in range(W):
        r, g, b, a = px[x, y]
        if a and b > r + 4:
            px[x, y] = (0, 0, 0, 0)
# their outlines, left floating: pixels under the rim with fewer than two opaque 4-neighbours
for _ in range(4):
    kill = []
    for y in range(RIM, H):
        for x in range(W):
            if px[x, y][3] == 0:
                continue
            n = sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                    if 0 <= x + dx < W and 0 <= y + dy < H and px[x + dx, y + dy][3] > 0)
            if n < 2:
                kill.append((x, y))
    for x, y in kill:
        px[x, y] = (0, 0, 0, 0)

bbox = im.getbbox()
im = im.crop(bbox)
W, H = im.size
px = im.load()
rim = RIM - bbox[1]

# rotor tips: under the rim, each run of columns with pixels low down; its lowest pixel
tips = []
x = 0
while x < W:
    low_cols = [y for y in range(rim + 6, H) if px[x, y][3] > 0]
    if low_cols:
        x0, low = x, max(low_cols)
        while x + 1 < W and any(px[x + 1, y][3] > 0 for y in range(rim + 6, H)):
            x += 1
            low = max([low] + [y for y in range(rim + 6, H) if px[x, y][3] > 0])
        tips.append([(x0 + x) // 2, low])
    x += 1

im.save(os.path.join(ART, 'finale_city.png'))
with open(os.path.join(ART, 'finale_city.json'), 'w') as f:
    json.dump({'frame': [W, H], 'frames': 1, 'anchor': [0, 0], 'fps': 0, 'rotors': tips}, f)
im.resize((W * 5, H * 5), Image.NEAREST).save(os.path.join(HERE, 'out', 'finale_city_x5.png'))
print(W, H, tips)
