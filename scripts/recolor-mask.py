#!/usr/bin/env python3
"""Build a fabric-only recolor mask from a processed grey base.

The live recolor multiplies a tint over the whole garment. Hardware (gold/brass
zippers, metal snaps, buttons) is rendered with real colour/saturation in the
base, so we exclude it here: the mask is opaque where the garment is neutral
fabric and transparent over hardware (and, optionally, very bright panels that
must stay white — e.g. a trucker foam front).

Usage:
    recolor-mask.py <base.png> <mask.png> [--sat 0.16] [--bright 0] [--feather 1.2]

Output is RGBA: alpha 255 = recolour this pixel, alpha 0 = leave the base as-is.
"""
import argparse
import sys

from PIL import Image, ImageFilter


def build(base_path: str, out_path: str, sat: float, bright: float, feather: float) -> None:
    img = Image.open(base_path).convert("RGBA")
    px = img.load()
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    mpx = mask.load()

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a <= 25:
                continue  # background
            mx = max(r, g, b)
            mn = min(r, g, b)
            val = mx / 255.0
            sval = (mx - mn) / mx if mx > 0 else 0.0
            if sval >= sat:
                continue  # saturated hardware (gold zipper, snaps) -> keep base
            if bright > 0 and val >= bright:
                continue  # bright panel that must stay white (trucker front)
            mpx[x, y] = 255  # neutral fabric -> recolour

    if feather > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(feather))

    out = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    out.putalpha(mask)
    out.save(out_path, "PNG")
    print(f"✓ {out_path}  ({w}x{h})")


def main() -> int:
    p = argparse.ArgumentParser(description="Build a fabric-only recolor mask.")
    p.add_argument("base")
    p.add_argument("out")
    p.add_argument("--sat", type=float, default=0.16, help="saturation at/above which a pixel is hardware")
    p.add_argument("--bright", type=float, default=0.0, help="value at/above which a pixel stays uncoloured (0 = off)")
    p.add_argument("--feather", type=float, default=1.2, help="gaussian blur radius on the mask edge")
    args = p.parse_args()
    try:
        build(args.base, args.out, args.sat, args.bright, args.feather)
    except Exception as exc:  # noqa: BLE001
        print(f"✗ {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
