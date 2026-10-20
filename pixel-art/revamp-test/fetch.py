"""Download PixelLab outputs into raw/ (run once per job; the build scripts read raw/ only).

  python fetch.py tileset <name> <tileset_id>
  python fetch.py url <name.png> <url>
"""
import json
import sys
import urllib.request
from pathlib import Path

RAW = Path(__file__).resolve().parent / "raw"
RAW.mkdir(exist_ok=True)
API = "https://api.pixellab.ai/mcp"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "foldworks-art/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


if __name__ == "__main__":
    kind = sys.argv[1]
    if kind == "tileset":
        name, tid = sys.argv[2], sys.argv[3]
        (RAW / f"{name}.png").write_bytes(get(f"{API}/tilesets/{tid}/image?inline=true"))
        meta = json.loads(get(f"{API}/tilesets/{tid}/metadata"))
        (RAW / f"{name}.json").write_text(json.dumps(meta, indent=1))
        print("ok", name)
    elif kind == "object":
        # a 64-candidate review pack: raw/<name>/frame_N.png plus a numbered sheet to look at
        from PIL import Image, ImageDraw
        name, oid = sys.argv[2], sys.argv[3]
        n = int(sys.argv[4]) if len(sys.argv) > 4 else 64
        d = RAW / name
        d.mkdir(exist_ok=True)
        base = ("https://backblaze.pixellab.ai/file/pixellab-characters/objects/"
                f"859e3c7d-c1c3-4eee-9e06-c95bf333277b/{oid}/rotations")
        frames = []
        for i in range(n):
            p = d / f"frame_{i}.png"
            if not p.exists():
                p.write_bytes(get(f"{base}/frame_{i}.png"))
            frames.append(Image.open(p).convert("RGBA"))
        w, h = frames[0].size
        sc = max(1, 96 // w)
        cols = 8
        rows = (n + cols - 1) // cols
        cw, ch = w * sc + 4, h * sc + 14
        sheet = Image.new("RGBA", (cols * cw, rows * ch), (90, 90, 100, 255))
        dr = ImageDraw.Draw(sheet)
        for i, f in enumerate(frames):
            x, y = (i % cols) * cw, (i // cols) * ch
            sheet.paste(f.resize((w * sc, h * sc), Image.NEAREST), (x + 2, y + 12), f.resize((w * sc, h * sc), Image.NEAREST))
            dr.text((x + 2, y), str(i), fill=(255, 255, 255, 255))
        sheet.save(RAW / f"{name}_sheet.png")
        print("ok", name, n)
    elif kind == "url":
        (RAW / sys.argv[2]).write_bytes(get(sys.argv[3]))
        print("ok", sys.argv[2])
