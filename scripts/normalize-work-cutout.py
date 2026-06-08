# Normalize a transparent product cutout into the case-study card format so every
# card reads as the SAME visual size: trim transparent margins to the product,
# then center it on a 1000x1250 (4:5) canvas scaled so the product fills ~50% of
# the frame AREA (uniform visual mass regardless of garment aspect ratio).
#
# Usage:  python3 scripts/normalize-work-cutout.py <src.png> <out-name>
#   e.g.  python3 scripts/normalize-work-cutout.py ~/Downloads/foo.png shapes-sweater
import sys, math
from PIL import Image

TW, TH = 1000, 1250          # 4:5 card aspect
AREA = 0.50                  # product bbox = ~50% of frame area
MAXW, MAXH = 0.92 * TW, 0.94 * TH

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGBA")
bb = im.getbbox()
if bb:
    im = im.crop(bb)
w, h = im.size
s = min(math.sqrt(AREA * TW * TH / (w * h)), MAXW / w, MAXH / h)
nw, nh = round(w * s), round(h * s)
im = im.resize((nw, nh), Image.LANCZOS)
canvas = Image.new("RGBA", (TW, TH), (0, 0, 0, 0))
canvas.paste(im, ((TW - nw) // 2, (TH - nh) // 2), im)
canvas.save(f"public/work/{out}.png", optimize=True)
print(f"saved public/work/{out}.png  (product {nw}x{nh})")
