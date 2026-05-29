// 2D projective transform (homography) → CSS matrix3d.
// Maps a flat element's box corners onto an arbitrary quad, so artwork lands
// perspective-correct inside an authored placement region.

type Mat3 = number[]; // length 9, row-major

function adj(m: Mat3): Mat3 {
  return [
    m[4] * m[8] - m[5] * m[7],
    m[2] * m[7] - m[1] * m[8],
    m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8],
    m[0] * m[8] - m[2] * m[6],
    m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6],
    m[1] * m[6] - m[0] * m[7],
    m[0] * m[4] - m[1] * m[3]
  ];
}

function multmm(a: Mat3, b: Mat3): Mat3 {
  const c = new Array(9).fill(0) as Mat3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) sum += a[3 * i + k] * b[3 * k + j];
      c[3 * i + j] = sum;
    }
  }
  return c;
}

function multmv(m: Mat3, v: number[]): number[] {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
  ];
}

function basisToPoints(p: number[]): Mat3 {
  // p = [x1,y1, x2,y2, x3,y3, x4,y4]
  const m: Mat3 = [p[0], p[2], p[4], p[1], p[3], p[5], 1, 1, 1];
  const v = multmv(adj(m), [p[6], p[7], 1]);
  return multmm(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
}

function general2DProjection(src: number[], dst: number[]): Mat3 {
  const s = basisToPoints(src);
  const d = basisToPoints(dst);
  return multmm(d, adj(s));
}

// Corner order for both src and dst: TL, TR, BR, BL.
export function quadTransform(
  w: number,
  h: number,
  dst: [number, number, number, number, number, number, number, number]
): string {
  const src = [0, 0, w, 0, w, h, 0, h];
  const t = general2DProjection(src, [...dst]);
  for (let i = 0; i < 9; i++) t[i] = t[i] / t[8];
  const m = [
    t[0], t[3], 0, t[6],
    t[1], t[4], 0, t[7],
    0, 0, 1, 0,
    t[2], t[5], 0, t[8]
  ];
  return `matrix3d(${m.join(",")})`;
}
