"""The sky island style test, every output in order (docs/sky-island.md, phase 1).
Run `python build.py` from this folder: the palette check, then ground, island, sky, props, the
Factory platform sketch, then the mocks. Everything lands in pixel-art/sky/out/ (nothing in src/).
"""
import pal
import ground
import island
import sky
import props
import fplat
import mock

if __name__ == "__main__":
    res, _ = pal.check()
    bad = [r for r in res if not r[1]]
    for name, ok, val in res:
        print(("ok  " if ok else "FAIL"), name, val)
    if bad:
        raise SystemExit("palette rules fail")
    for m in (ground, island, sky, props, fplat, mock):
        m.build()
        print("built", m.__name__)
