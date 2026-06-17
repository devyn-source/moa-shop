// Parse an AAMA/ASTM apparel DXF and extract the FRONT SHELL piece's true
// dimensions, so placement calibration comes from the cut geometry the factory
// actually uses — not a silhouette guessed off a product photo.
//
// Reality this handles (learned from real MOA factory exports):
//  • Units are often undeclared ($INSUNITS null) and INCONSISTENT between files
//    (one export is mm, another is inches) → auto-resolve by body-length sanity,
//    overridable by the operator.
//  • Pieces are Chinese-labeled (GB2312, read here as latin1 byte markers):
//    前 front · 后 back · 里 lining · 胆 down-fill · 袋 pocket · 领 collar ·
//    帽 hood · 网 mesh · 袖 sleeve. The front SHELL = a 前 piece that is none of
//    those layers. Fabric names vary by factory, so we DON'T require 面布.
//  • Geometry sits in BLOCK definitions placed by INSERTs; the cut line is the
//    densest polyline (marker/grain rectangles have ~4 points).
//  • A single front with a straight vertical CF edge is a half (zip front or cut
//    on fold) → double it for the full front width.
//
// A 2× (fold) / 10× (mm↔cm) error is invisible on the page but ruinous on the
// floor, so the output is a PROPOSAL an operator confirms in /admin — never an
// unattended commit.

export type PatternUnit = "mm" | "cm" | "in";
export type Pt = [number, number];

// GB2312 ideographs as latin1 byte pairs (the encoding these DXFs ship in).
const MARK = {
  front: "\xC7\xB0", // 前
  back: "\xBA\xF3", // 后
  lining: "\xC0\xEF", // 里
  fill: "\xB5\xA8", // 胆
  pocket: "\xB4\xFC", // 袋
  collar: "\xC1\xEC", // 领
  hood: "\xC3\xB1", // 帽
  mesh: "\xCD\xF8", // 网
  sleeve: "\xD0\xE4", // 袖
} as const;
const NON_SHELL = [MARK.lining, MARK.fill, MARK.pocket, MARK.collar, MARK.hood, MARK.mesh, MARK.sleeve];

type Poly = { pts: Pt[] };
type Block = { polys: Poly[]; texts: string[] };

type Piece = { name: string; outline: Pt[]; bbox: [number, number, number, number]; nv: number };

export type PatternFront = {
  unit: PatternUnit;
  paneled: boolean; // front is L+R panels (summed) vs a single piece
  onFold: boolean; // single piece is a half → width doubled
  bodyLengthIn: number; // HPS → hem (vertical extent of the front shell)
  frontWidthIn: number; // full flat front width across the chest
  chestCircIn: number; // implied finished chest ≈ frontWidth × 2 (display aid)
  outlineIn: Pt[]; // front shell outline in inches, origin at top-left (for the confirm preview)
  pieces: string[]; // chosen piece block names
  confidence: "high" | "medium" | "low";
  notes: string[];
};

// --- DXF pair stream → blocks + inserts -------------------------------------
function parseDxf(text: string): { blocks: Record<string, Block>; inserts: { n: string }[] } {
  const lines = text.split(/\r?\n/);
  const P: [string, string][] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) P.push([lines[i].trim(), lines[i + 1]]);

  const blocks: Record<string, Block> = {};
  const inserts: { n: string }[] = [];
  const ens = (n: string) => (blocks[n] ||= { polys: [], texts: [] });
  let cur: Block | null = null;
  let i = 0;
  while (i < P.length) {
    const [g, v] = P[i];
    if (g === "0" && v === "BLOCK") {
      let n = "?";
      for (let j = i + 1; j < i + 40 && j < P.length; j++) {
        if (P[j][0] === "2") { n = P[j][1]; break; }
        if (P[j][0] === "0") break;
      }
      cur = ens(n); i++; continue;
    }
    if (g === "0" && v === "ENDBLK") { cur = null; i++; continue; }
    if (g === "0" && v === "POLYLINE") {
      const pts: Pt[] = []; i++;
      while (i < P.length && !(P[i][0] === "0" && P[i][1] === "SEQEND")) {
        if (P[i][0] === "0" && P[i][1] === "VERTEX") {
          let x: number | null = null, y: number | null = null, k = i + 1;
          while (k < P.length && P[k][0] !== "0") {
            if (P[k][0] === "10") x = parseFloat(P[k][1]);
            if (P[k][0] === "20") y = parseFloat(P[k][1]);
            k++;
          }
          if (x != null && y != null) pts.push([x, y]);
          i = k; continue;
        }
        i++;
      }
      (cur ?? ens("__entities__")).polys.push({ pts });
      continue;
    }
    if (g === "0" && (v === "TEXT" || v === "MTEXT")) {
      let s = "", k = i + 1;
      while (k < P.length && P[k][0] !== "0") { if (P[k][0] === "1") s = P[k][1]; k++; }
      (cur ?? ens("__entities__")).texts.push(s);
      i = k; continue;
    }
    if (g === "0" && v === "INSERT") {
      let n = "?", k = i + 1;
      while (k < P.length && P[k][0] !== "0") { if (P[k][0] === "2") n = P[k][1]; k++; }
      inserts.push({ n });
      i = k; continue;
    }
    i++;
  }
  return { blocks, inserts };
}

function bbox(pts: Pt[]): [number, number, number, number] {
  let a: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of pts) {
    if (x < a[0]) a[0] = x;
    if (y < a[1]) a[1] = y;
    if (x > a[2]) a[2] = x;
    if (y > a[3]) a[3] = y;
  }
  return a;
}

// True width of a closed outline at height y — scanline ∩ edges (robust to
// sparse vertices, unlike "points near y").
function widthAtY(pts: Pt[], y: number): number {
  const xs: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    if (y1 === y2) continue;
    if ((y1 <= y && y2 >= y) || (y2 <= y && y1 >= y)) {
      const t = (y - y1) / (y2 - y1);
      xs.push(x1 + t * (x2 - x1));
    }
  }
  return xs.length < 2 ? 0 : Math.max(...xs) - Math.min(...xs);
}

// Front shell pieces: labeled 前, none of the non-shell layers, with a real cut
// line (densest polyline ≥ 8 pts). Lining/fill share the 前 prefix, so the
// NON_SHELL exclusion is what isolates the outer shell.
function frontShell(parsed: ReturnType<typeof parseDxf>): Piece[] {
  const out: Piece[] = [];
  for (const ins of parsed.inserts) {
    const b = parsed.blocks[ins.n];
    if (!b) continue;
    const label = ins.n + " " + b.texts.join(" ");
    if (!label.includes(MARK.front)) continue;
    if (NON_SHELL.some((m) => label.includes(m))) continue;
    let best: Poly | null = null;
    for (const p of b.polys) if (!best || p.pts.length > best.pts.length) best = p;
    if (!best || best.pts.length < 8) continue;
    out.push({ name: ins.n, outline: best.pts, bbox: bbox(best.pts), nv: best.pts.length });
  }
  return out;
}

const TO_IN: Record<PatternUnit, number> = { mm: 1 / 25.4, cm: 1 / 2.54, in: 1 };

// Resolve units by body-length plausibility (45–110 cm covers garments); ties
// break toward ~70 cm. Files rarely declare $INSUNITS and aren't consistent.
function resolveUnit(rawLen: number, override?: PatternUnit): PatternUnit {
  if (override) return override;
  for (const u of ["mm", "in", "cm"] as PatternUnit[]) {
    const cm = rawLen * TO_IN[u] * 2.54;
    if (cm >= 45 && cm <= 110) return u;
  }
  return (["mm", "in", "cm"] as PatternUnit[])
    .map((u) => ({ u, d: Math.abs(rawLen * TO_IN[u] * 2.54 - 70) }))
    .sort((a, b) => a.d - b.d)[0].u;
}

export function parsePatternFront(
  dxf: string,
  opts: { unit?: PatternUnit; onFold?: boolean } = {}
): PatternFront | null {
  const parsed = parseDxf(dxf);
  const pieces = frontShell(parsed);
  if (!pieces.length) return null;

  const notes: string[] = [];
  const rawLen = Math.max(...pieces.map((p) => p.bbox[3] - p.bbox[1]));
  const unit = resolveUnit(rawLen, opts.unit);
  const toIn = (v: number) => v * TO_IN[unit];
  const bodyLengthIn = round1(toIn(rawLen));

  // Chest width: widest scanline across the upper-mid band (below the armhole),
  // summed across panels for a paneled front.
  let chestRaw = 0;
  for (const p of pieces) {
    const top = p.bbox[1], h = p.bbox[3] - p.bbox[1];
    let w = 0;
    for (let fr = 0.15; fr <= 0.5; fr += 0.02) w = Math.max(w, widthAtY(p.outline, top + fr * h));
    chestRaw += w;
  }
  const paneled = pieces.length > 1;

  // Fold/half detection for a single piece: a long straight vertical edge on
  // either side is a CF fold or a paired-half front → double for the full front.
  let onFold = opts.onFold ?? false;
  if (!paneled && opts.onFold === undefined) {
    const p = pieces[0];
    const [minx, , maxx] = p.bbox;
    const spanX = maxx - minx || 1;
    const straight = (side: number) => p.outline.filter(([x]) => Math.abs(x - side) < spanX * 0.02).length;
    onFold = Math.max(straight(minx), straight(maxx)) > p.outline.length * 0.25;
  }
  const frontWidthIn = round1(toIn(chestRaw) * (paneled ? 1 : onFold ? 2 : 1));

  // Build a normalized front outline (inches, top-left origin) for the confirm
  // preview. For a paneled front, render the widest panel (representative).
  const drawPiece = pieces.reduce((a, b) => (b.bbox[2] - b.bbox[0] > a.bbox[2] - a.bbox[0] ? b : a));
  const [bx, by] = drawPiece.bbox;
  const outlineIn: Pt[] = drawPiece.outline.map(([x, y]) => [round2(toIn(x - bx)), round2(toIn(y - by))]);

  // Confidence: plausible body length + a believable chest both lift it.
  const bodyCm = bodyLengthIn * 2.54;
  const chestOk = frontWidthIn >= 16 && frontWidthIn <= 40;
  const lenOk = bodyCm >= 50 && bodyCm <= 95;
  const confidence: PatternFront["confidence"] = lenOk && chestOk ? "high" : lenOk || chestOk ? "medium" : "low";
  if (opts.unit) notes.push(`Unit set to ${unit} by operator.`);
  else notes.push(`Unit auto-resolved to ${unit} (body length ${bodyCm.toFixed(0)} cm).`);
  if (!paneled) notes.push(onFold ? "Single front treated as a half (CF fold / paired) → width doubled." : "Single full front piece.");
  else notes.push(`Paneled front: ${pieces.length} panels summed.`);
  notes.push("Cut-line widths include seam allowance — confirm against the finished chest spec.");

  return {
    unit,
    paneled,
    onFold,
    bodyLengthIn,
    frontWidthIn,
    chestCircIn: round1(frontWidthIn * 2),
    outlineIn,
    pieces: pieces.map((p) => p.name),
    confidence,
    notes,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
