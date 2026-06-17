# MOA Catalog — 3D Garment Model Delivery Specification

> For MOA's 3D production partner. These models drive a live product configurator:
> customers place their artwork directly on the 3D garment, and that placement is
> transferred to the real production pattern and the factory tech pack. Following
> this spec is what makes that transfer accurate (~98%). v1 — June 2026.

---

## 0. What these models are used for (read first)

Each model is a **made-to-order blank** a customer customizes in the browser:

1. They pick a color — MOA **tints the garment to an exact Pantone** at runtime.
2. They place a logo/artwork on the garment — MOA records **where on the mesh** it lands (the UV coordinate).
3. That UV is mapped to the garment's **real cut pattern** → exact print position in inches → the factory tech pack.

So two things matter above all else: **the UV layout must match the real pattern**, and **the base color must be neutral** so we can tint it. Everything below serves those two goals.

---

## 1. Pattern-aligned UVs — the keystone (most important)

The UV unwrap is not cosmetic here — **UV space *is* pattern space.** When a customer drops a logo on the chest, we read the UV at that point and map it onto the real front-body pattern piece. If the UV matches the pattern, the printed placement is exact.

Requirements, in priority order (**front body and back body panels are critical**; sleeves/collar are secondary):

- **One UV island per garment piece**, matching the actual cut piece — same **proportions / aspect ratio** as the sewn pattern, not squashed or stretched to fill the texture sheet.
- **Oriented HPS-up, hem-down** (high-point-shoulder at the top of the island, hem at the bottom) and **upright** — not rotated or flipped.
- **Center-front (CF) on a consistent edge** across styles (e.g. CF along the island's left edge), so "distance from center front" reads the same everywhere.
- **No mirrored or overlapping UVs on the front/back body.** Left and right may be separate islands, but they must **not** share/overlap UV space (mirrored UVs make a left-chest logo also appear on the right).
- **Low distortion:** keep UV stretch under ~2% on the body panels (use a checker map to confirm even, square cells across the chest/back).
- **Normalized 0–1 space**, no tiling on the body.

> Rule of thumb: if you laid the UV islands flat, they should look like the pattern pieces the factory cuts. That's the target.

---

## 2. Color / albedo — deliver it neutral

MOA applies the exact brand/Pantone color at render time, so the model must **not** carry a garment color.

- **Base color (albedo) = pure white**, or a neutral ~50% grey. No baked-in garment color, no tints.
- Bake only **color-independent** surface detail (seams, stitch lines, fabric grain) as needed — not lighting or color.
- **Ambient occlusion: minimal and soft.** Heavy AO darkens the tint and shifts the Pantone — keep it subtle or omit it. No baked drop shadows or studio lighting.
- No emissive, no baked highlights.

---

## 3. Textures — keep them light (or skip them)

MOA **replaces the base color and applies its own fabric micro-texture at render**, so the model's color/normal maps are largely discarded on our side. Don't spend budget there.

- Textures should be **minimal and small** (≤ 1K where used) — or omitted entirely.
- **Geometry detail beats texture detail.** Put effort into clean silhouette, drape, and the collar/cuff/hem, not high-res maps.
- If you include a normal/roughness map for your own preview, fine — just don't rely on it for the final look.

---

## 4. Geometry / mesh

- **Triangle budget: ~30k–120k tris** per garment. These render in-browser on phones — stay web-light. A clean 60k tee beats a 500k one.
- **Clean, manifold mesh** — no non-manifold edges, no stray loose geometry, no flipped/inconsistent normals (normals face outward).
- **Even quad/tri topology** across the body so the surface tints and shades smoothly.
- Real-world proportions; **scale will be normalized on our end**, so absolute size isn't critical, but model at a sane real scale and keep it consistent.

---

## 5. Format & export

- **glTF 2.0 binary — single `.glb` file**, everything embedded (geometry + any textures in the one file).
- **Y-up**, real-world units (meters preferred; state the unit if not meters).
- **Centered and upright**, facing +Z (front of garment toward camera).
- **Meshopt or Draco compression is welcome** (it loads faster — we already compress on our end, but pre-compressed is fine).
- Single material per piece is ideal; PBR metallic-roughness workflow, **metalness = 0** (fabric).

---

## 6. Naming & structure

- **One model per style**, filename = the **SKU slug** we provide (e.g. `heavyweight-tee.glb`, `zip-sherpa.glb`, `down-puffer.glb`). We'll send the slug list.
- **Name each mesh by garment piece** where possible so we can target the right panel:
  `front-body`, `back-body`, `sleeve-l`, `sleeve-r`, `collar`, `cuff`, `pocket`, `hood`.
- Keep pieces as **separate named meshes** rather than one merged mesh — it lets us isolate the front panel for placement.

---

## 7. Delivery checklist (self-check before sending)

- [ ] UV islands match the cut pattern: right proportions, HPS-up, CF on a consistent edge
- [ ] Front & back body UVs are **not** mirrored or overlapping
- [ ] Checker map shows even, low-distortion cells on chest/back (<~2% stretch)
- [ ] Albedo is white/neutral — **no garment color baked in**
- [ ] AO is minimal/soft; no baked lighting or shadows
- [ ] Triangles within ~30k–120k; mesh is manifold, normals outward
- [ ] Exported as a single `.glb`, Y-up, centered, units stated
- [ ] Filename = SKU slug; meshes named per garment piece
- [ ] Opens cleanly in [gltf-viewer](https://gltf-viewer.donmccurdy.com/) with no errors

---

*Questions on a specific style or the slug list → MOA production. Send one sample style first so we can confirm the UV → pattern mapping before you batch the rest.*
