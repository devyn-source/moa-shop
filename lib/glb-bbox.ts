// Server-side GLB bounding-box reader — NO WebGL / three.js needed.
//
// The 3D-anchored calibration (lib/zones.ts Model3DCalibration) needs one thing
// from each SKU's GLB: the raw model bounding box, so we can reproduce the exact
// normalization the viewer applies (lib/Garment3DDecorator `useNormalizedModel`)
// and convert world units → real inches via the DXF body length.
//
// glTF stores per-accessor POSITION min/max in the JSON chunk, so the box is
// derivable from JSON alone — we never decode the binary mesh. We DO walk the
// node hierarchy and apply each node's world transform (matrix or TRS) so an
// exported root rotation/scale is honoured exactly.

type Vec3 = [number, number, number];
type Mat4 = number[]; // column-major, 16

const ident = (): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// column-major a * b
function mul(a: Mat4, b: Mat4): Mat4 {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}

function fromTRS(t?: number[], q?: number[], s?: number[]): Mat4 {
  const [tx, ty, tz] = t ?? [0, 0, 0];
  const [x, y, z, w] = q ?? [0, 0, 0, 1];
  const [sx, sy, sz] = s ?? [1, 1, 1];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  // column-major rotation*scale, with translation in the last column
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function tp(m: Mat4, p: Vec3): Vec3 {
  const [x, y, z] = p;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

export type GlbBBox = { min: Vec3; max: Vec3; size: Vec3 };

// Parse a GLB ArrayBuffer → world-space bounding box (or null if unreadable /
// no positioned geometry). Honours the full node hierarchy.
export function glbBBox(buf: ArrayBuffer): GlbBBox | null {
  const dv = new DataView(buf);
  if (dv.byteLength < 12 || dv.getUint32(0, true) !== 0x46546c67) return null; // "glTF"
  // first chunk = JSON
  let off = 12;
  let json: Record<string, unknown> | null = null;
  while (off + 8 <= dv.byteLength) {
    const len = dv.getUint32(off, true);
    const type = dv.getUint32(off + 4, true);
    const start = off + 8;
    if (type === 0x4e4f534a) {
      // JSON
      const bytes = new Uint8Array(buf, start, len);
      json = JSON.parse(new TextDecoder().decode(bytes));
      break;
    }
    off = start + len;
  }
  if (!json) return null;

  const accessors = (json.accessors as { min?: number[]; max?: number[] }[]) ?? [];
  const meshes = (json.meshes as { primitives: { attributes: Record<string, number> }[] }[]) ?? [];
  const nodes = (json.nodes as Record<string, unknown>[]) ?? [];
  const scenes = (json.scenes as { nodes?: number[] }[]) ?? [];
  const sceneNodes = scenes[(json.scene as number) ?? 0]?.nodes ?? nodes.map((_, i) => i);

  let mnx = Infinity, mny = Infinity, mnz = Infinity;
  let mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
  let found = false;

  const localMat = (n: Record<string, unknown>): Mat4 =>
    Array.isArray(n.matrix) && n.matrix.length === 16
      ? (n.matrix as number[])
      : fromTRS(n.translation as number[], n.rotation as number[], n.scale as number[]);

  const walk = (idx: number, parent: Mat4) => {
    const n = nodes[idx];
    if (!n) return;
    const world = mul(parent, localMat(n));
    if (typeof n.mesh === "number") {
      const mesh = meshes[n.mesh];
      for (const prim of mesh?.primitives ?? []) {
        const ai = prim.attributes?.POSITION;
        const acc = ai != null ? accessors[ai] : null;
        if (!acc?.min || !acc?.max) continue;
        const [x0, y0, z0] = acc.min as Vec3;
        const [x1, y1, z1] = acc.max as Vec3;
        for (const cx of [x0, x1])
          for (const cy of [y0, y1])
            for (const cz of [z0, z1]) {
              const [wx, wy, wz] = tp(world, [cx, cy, cz]);
              mnx = Math.min(mnx, wx); mny = Math.min(mny, wy); mnz = Math.min(mnz, wz);
              mxx = Math.max(mxx, wx); mxy = Math.max(mxy, wy); mxz = Math.max(mxz, wz);
              found = true;
            }
      }
    }
    for (const c of (n.children as number[]) ?? []) walk(c, world);
  };
  for (const r of sceneNodes) walk(r, ident());

  if (!found) return null;
  return {
    min: [mnx, mny, mnz],
    max: [mxx, mxy, mxz],
    size: [mxx - mnx, mxy - mny, mxz - mnz],
  };
}

// Fetch a GLB URL and return its bounding box.
export async function fetchGlbBBox(url: string): Promise<GlbBBox | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return glbBBox(await res.arrayBuffer());
  } catch {
    return null;
  }
}
