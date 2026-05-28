#!/usr/bin/env python3
"""Normalize a product shot: remove background, trim, center on a fixed transparent canvas.

Usage:
    process-shot.py <input> <output> [--width 1600] [--height 2000] [--pad 0.88]

Every shot run through this lands on identical dimensions with a transparent
background, so the catalog gallery stays visually uniform.
"""
import argparse
import sys
from io import BytesIO

from PIL import Image


def already_cut(img: Image.Image) -> bool:
    """True if the image already has a transparent background (pre-cut)."""
    if "A" not in img.getbands():
        return False
    rgba = img.convert("RGBA")
    w, h = rgba.size
    corners = [
        rgba.getpixel((1, 1)),
        rgba.getpixel((w - 2, 1)),
        rgba.getpixel((1, h - 2)),
        rgba.getpixel((w - 2, h - 2)),
    ]
    corners_clear = sum(1 for c in corners if c[3] == 0) >= 3
    fully_transparent = rgba.getchannel("A").histogram()[0]
    transparent_frac = fully_transparent / (w * h)
    return corners_clear and transparent_frac > 0.01


def process(input_path: str, output_path: str, width: int, height: int, pad: float, mode: str) -> None:
    src = Image.open(input_path)

    if mode == "keep" or (mode == "auto" and already_cut(src)):
        img = src.convert("RGBA")  # already transparent — don't re-segment
    else:
        from rembg import remove  # imported lazily; only needed for bg removal

        with open(input_path, "rb") as fh:
            img = Image.open(BytesIO(remove(fh.read()))).convert("RGBA")

    # Trim to the non-transparent bounding box.
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    # Scale to fit within the padded target box, preserving aspect.
    max_w = int(width * pad)
    max_h = int(height * pad)
    scale = min(max_w / img.width, max_h / img.height)
    new_size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
    img = img.resize(new_size, Image.LANCZOS)

    # Center on a transparent canvas of fixed size.
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    offset = ((width - img.width) // 2, (height - img.height) // 2)
    canvas.paste(img, offset, img)

    canvas.save(output_path, "PNG")
    print(f"✓ {output_path}  ({width}x{height})")


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize a product shot.")
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--width", type=int, default=1600)
    parser.add_argument("--height", type=int, default=2000)
    parser.add_argument("--pad", type=float, default=0.88, help="fraction of canvas the subject fills")
    parser.add_argument(
        "--mode",
        choices=["auto", "keep", "remove"],
        default="auto",
        help="auto: skip bg removal if source is already transparent; keep: never remove; remove: always remove",
    )
    args = parser.parse_args()

    try:
        process(args.input, args.output, args.width, args.height, args.pad, args.mode)
    except Exception as exc:  # noqa: BLE001
        print(f"✗ {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
