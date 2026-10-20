"""The contact sheet: the three directions' scenes at 3x, stacked with labels, each with its
Mayor Bramble portrait at 3x, plus a strip of the three scenes at true 1x size.
Run after A/B/C build.py: python contact.py"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
DIRS = [("A", "Foundry, remastered", "palette A exactly (27 art colours + 5 code-drawn pips)"),
        ("B", "Lantern Bayou", "new dusk palette, 48 colours"),
        ("C", "Daylight Workshop", "new daylight palette, 47 colours")]
BG = (24, 22, 30, 255)
FG = (238, 230, 214, 255)
DIM = (150, 144, 150, 255)


def font(n):
    try:
        return ImageFont.load_default(size=n)
    except TypeError:
        return ImageFont.load_default()


def main():
    scenes = [Image.open(HERE / d / "scene.png").convert("RGBA") for d, _, _ in DIRS]
    ports = [Image.open(HERE / d / "portrait_bramble.png").convert("RGBA") for d, _, _ in DIRS]
    sw, sh = scenes[0].width * 3, scenes[0].height * 3
    pw = 48 * 3
    pad, head = 24, 44
    W = pad + sw + pad + pw + pad
    strip_h = scenes[0].height + 30
    H = pad + strip_h + len(DIRS) * (head + sh + pad) + pad
    out = Image.new("RGBA", (W, H), BG)
    d = ImageDraw.Draw(out)
    d.text((pad, pad - 6), "Foldworks revamp style test, phase 1: the same Workshop in three directions. "
           "Top: true size (1x). Below: 3x.", fill=FG, font=font(18))
    x = pad
    for (k, name, _), s in zip(DIRS, scenes):
        out.alpha_composite(s, (x, pad + 22))
        d.text((x, pad + 22 + s.height + 2), k, fill=DIM, font=font(14))
        x += s.width + 16
    y = pad + strip_h + pad
    for (k, name, note), s, p in zip(DIRS, scenes, ports):
        d.text((pad, y + 6), f"{k}  {name}", fill=FG, font=font(26))
        d.text((pad + 440, y + 14), note, fill=DIM, font=font(16))
        y += head
        out.alpha_composite(s.resize((sw, sh), Image.NEAREST), (pad, y))
        pbg = Image.new("RGBA", (48, 48), s.getpixel((2, 2)))
        pbg.alpha_composite(p)
        out.alpha_composite(pbg.resize((pw, pw), Image.NEAREST), (pad + sw + pad, y))
        d.text((pad + sw + pad, y + pw + 6), "Mayor Bramble 48x48", fill=DIM, font=font(14))
        y += sh + pad
    out.save(HERE / "contact.png")
    print(out.size)


if __name__ == "__main__":
    main()
