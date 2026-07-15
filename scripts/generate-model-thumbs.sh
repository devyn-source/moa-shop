#!/bin/bash
# Generate catalog thumbnails for 3D-model SKUs.
#
# For each slug: renders /render-model/<slug> (full-bleed single-model view),
# screenshots the WebGL canvas via agent-browser, crops/resizes to the standard
# 1000x1200 thumb, and uploads to Supabase storage sku-models/thumbs/<slug>.png
# (public bucket — the shop grid reads thumbs live via listModelThumbs()).
#
# Usage:
#   ./scripts/generate-model-thumbs.sh <base-url> <slug> [slug...]
#   ./scripts/generate-model-thumbs.sh http://localhost:3001 heavyweight-hoodie standard-tote
#
# Requires: agent-browser, python3 + PIL, SUPABASE_SERVICE_ROLE_KEY in .env.local.
set -euo pipefail

BASE_URL="${1:?usage: generate-model-thumbs.sh <base-url> <slug> [slug...]}"
shift
ENV_FILE="$(dirname "$0")/../.env.local"
SRK=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV_FILE" | cut -d'"' -f2)
SUPA_URL=$(grep '^SUPABASE_URL=' "$ENV_FILE" | cut -d'"' -f2)
TMP=$(mktemp -d)

for slug in "$@"; do
  echo "── $slug"
  agent-browser open "$BASE_URL/render-model/$slug" >/dev/null
  # Wait for the GLB to stream + settle (canvas paints progressively).
  agent-browser wait 9000 >/dev/null
  # Read the WebGL canvas pixels directly (preserveDrawingBuffer is enabled in
  # Garment3D) — avoids capturing page chrome (header, promo banner, dev badge).
  agent-browser eval "document.querySelector('canvas').toDataURL('image/png')" > "$TMP/$slug.dataurl"
  python3 - "$TMP/$slug.dataurl" "$TMP/$slug.png" <<'PY'
import sys, base64, io, re
from PIL import Image
raw = open(sys.argv[1]).read().strip().strip('"')
b64 = re.sub(r"^.*?base64,", "", raw)
im = Image.open(io.BytesIO(base64.b64decode(b64)))
# Composite onto the brand cream (canvas is transparent around the garment).
bg = Image.new("RGB", im.size, (238, 234, 227))
if im.mode == "RGBA":
    bg.paste(im, (0, 0), im)
else:
    bg.paste(im, (0, 0))
w, h = bg.size
# Center-crop to 5:6 (1000x1200 thumb standard).
target = 5 / 6
cw = min(w, int(h * target))
ch = min(h, int(cw / target))
x0 = (w - cw) // 2
y0 = max(0, (h - ch) // 2)
bg.crop((x0, y0, x0 + cw, y0 + ch)).resize((1000, 1200), Image.LANCZOS).save(sys.argv[2], "PNG")
PY
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "$SUPA_URL/storage/v1/object/sku-models/thumbs/$slug.png" \
    -H "Authorization: Bearer $SRK" -H "apikey: $SRK" \
    -H "Content-Type: image/png" -H "x-upsert: true" \
    --data-binary "@$TMP/$slug.png")
  echo "   uploaded: HTTP $code"
done
rm -rf "$TMP"
echo "done — thumbs appear on the shop grid immediately (no deploy needed)."
