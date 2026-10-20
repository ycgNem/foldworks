"""Download PixelLab outputs into raw/ (the build scripts read raw/ only, never the network).

  python fetch.py dirs <name> <object_id>             east/south/west/north rotations -> raw/<name>/<dir>.png
  python fetch.py anim <name> <object_id> <dir> <url-prefix-or-'-'>   (see anim_urls)
  python fetch.py object <name> <object_id> [n]       a review pack: raw/<name>/frame_N.png + sheet
  python fetch.py tileset <name> <tileset_id>
  python fetch.py url <file> <url>
"""
import json
import sys
import urllib.request
from pathlib import Path

RAW = Path(__file__).resolve().parent / "raw"
RAW.mkdir(exist_ok=True)
API = "https://api.pixellab.ai/mcp"
BB = "https://backblaze.pixellab.ai/file/pixellab-characters/objects/859e3c7d-c1c3-4eee-9e06-c95bf333277b"
DIRS = ["east", "south", "west", "north"]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "foldworks-art/1.0"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()


def sheet_of(name, files, sc=None):
    from PIL import Image, ImageDraw
    frames = [Image.open(f).convert("RGBA") for f in files]
    w = max(f.width for f in frames)
    h = max(f.height for f in frames)
    sc = sc or max(1, 96 // w)
    cols = min(8, len(frames))
    rows = (len(frames) + cols - 1) // cols
    cw, ch = w * sc + 4, h * sc + 14
    out = Image.new("RGBA", (cols * cw, rows * ch), (122, 75, 51, 255))
    d = ImageDraw.Draw(out)
    for i, f in enumerate(frames):
        x, y = (i % cols) * cw, (i // cols) * ch
        big = f.resize((f.width * sc, f.height * sc), Image.NEAREST)
        out.alpha_composite(big, (x + 2, y + 12))
        d.text((x + 2, y), Path(files[i]).stem, fill=(255, 255, 255, 255))
    out.save(RAW / f"{name}_sheet.png")


if __name__ == "__main__":
    kind = sys.argv[1]
    if kind == "dirs":
        name, oid = sys.argv[2], sys.argv[3]
        d = RAW / name
        d.mkdir(exist_ok=True)
        files = []
        for k in DIRS:
            p = d / f"{k}.png"
            if not p.exists():
                p.write_bytes(get(f"{BB}/{oid}/rotations/{k}.png"))
            files.append(p)
        sheet_of(name, files)
        print("ok", name)
    elif kind == "animurls":
        # python fetch.py animurls <name> <json-file with {dir: [urls]}>
        name, jf = sys.argv[2], sys.argv[3]
        urls = json.loads(Path(jf).read_text())
        d = RAW / name
        d.mkdir(exist_ok=True)
        files = []
        for k, lst in urls.items():
            for i, u in enumerate(lst):
                p = d / f"{k}_{i}.png"
                if not p.exists():
                    p.write_bytes(get(u))
                files.append(p)
        sheet_of(name, files)
        print("ok", name, len(files))
    elif kind == "object":
        name, oid = sys.argv[2], sys.argv[3]
        n = int(sys.argv[4]) if len(sys.argv) > 4 else 64
        d = RAW / name
        d.mkdir(exist_ok=True)
        files = []
        for i in range(n):
            p = d / f"frame_{i}.png"
            if not p.exists():
                p.write_bytes(get(f"{BB}/{oid}/rotations/frame_{i}.png"))
            files.append(p)
        sheet_of(name, files)
        print("ok", name, n)
    elif kind == "tileset":
        name, tid = sys.argv[2], sys.argv[3]
        (RAW / f"{name}.png").write_bytes(get(f"{API}/tilesets/{tid}/image?inline=true"))
        (RAW / f"{name}.json").write_text(json.dumps(json.loads(get(f"{API}/tilesets/{tid}/metadata")), indent=1))
        print("ok", name)
    elif kind == "url":
        (RAW / sys.argv[2]).write_bytes(get(sys.argv[3]))
        print("ok", sys.argv[2])
