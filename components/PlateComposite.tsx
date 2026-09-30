"use client";

// Photoreal composite: the artwork is laid onto a pre-rendered garment plate by
// looking up every pixel's exact pattern position (mm), so what you see sits at
// the same inches as the factory sheet. It bends with the folds (shading pass),
// stays on its pattern piece (piece mask) and takes the decoration method's finish.
// Drag the artwork on the photo to move it; the parent receives inches.
import { useEffect, useRef, useState } from "react";
import {
  loadDataPng, sampleAt, artRectMm, inchesFromCentreMm, plateUrl, WEARER_LEFT_SIGN, MM,
  buildCoverage, checkPrintable, mmToPx,
  type Coverage, type DecodedMap, type PlateManifest, type PlatePlacement, type PlateView, type PrintCheck,
} from "@/lib/plates";

const CLEARANCE_IN = 0.75;

const MAX = 4;
const METHOD_ID: Record<string, number> = { screen_print: 0, embroidery: 1, rubber_applique: 2 };

const VS = `#version 300 es
in vec2 aPos; out vec2 vSt;
void main() { vSt = vec2((aPos.x + 1.0) * 0.5, 1.0 - (aPos.y + 1.0) * 0.5); gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
in vec2 vSt; out vec4 outColor;
uniform sampler2D uBeauty, uShading, uArt0, uArt1, uArt2, uArt3;
uniform highp usampler2D uUv; uniform highp usampler2D uPieces;
uniform vec2 uSize; uniform int uCount;
uniform vec4 uRect[${MAX}];   // u0, vTop, w, h (mm)
uniform vec4 uMeta[${MAX}];   // piece, method, rotation (rad), unused

vec4 art(int i, vec2 st) {
  if (i == 0) return texture(uArt0, st);
  if (i == 1) return texture(uArt1, st);
  if (i == 2) return texture(uArt2, st);
  return texture(uArt3, st);
}

void main() {
  vec4 base = texture(uBeauty, vSt);
  ivec2 px = ivec2(clamp(vSt * uSize, vec2(0.0), uSize - 1.0));
  uvec4 e = texelFetch(uUv, px, 0);
  float piece = float(texelFetch(uPieces, px, 0).r);
  vec3 col = base.rgb;
  if (e.r + e.g + e.b + e.a > 0u && base.a > 0.0) {
    float u = float(e.r * 256u + e.g) / 32.0 - 1000.0;
    float v = float(e.b * 256u + e.a) / 32.0 - 1000.0;
    float shade = texture(uShading, vSt).r * (255.0 / 235.0);
    float lum = dot(base.rgb, vec3(0.2126, 0.7152, 0.0722));
    for (int i = 0; i < ${MAX}; i++) {
      if (i >= uCount) break;
      vec4 r = uRect[i]; vec4 m = uMeta[i];
      if (abs(piece - m.x) > 0.5) continue;
      // art space, rotated about its centre
      vec2 c = vec2(r.x + r.z * 0.5, r.y - r.w * 0.5);
      vec2 d = vec2(u, v) - c;
      float cr = cos(-m.z), sr = sin(-m.z);
      d = vec2(d.x * cr - d.y * sr, d.x * sr + d.y * cr);
      vec2 st = vec2(d.x / r.z + 0.5, 0.5 - d.y / r.w);
      int method = int(m.y + 0.5);
      // soft drop shadow for raised finishes (rubber)
      if (method == 2) {
        vec2 so = st - vec2(0.9 / r.z, -0.9 / r.w);
        if (all(greaterThanEqual(so, vec2(0.0))) && all(lessThanEqual(so, vec2(1.0)))) col *= 1.0 - 0.28 * art(i, so).a;
      }
      if (any(lessThan(st, vec2(0.0))) || any(greaterThan(st, vec2(1.0)))) continue;
      vec4 a = art(i, st);
      if (a.a < 0.003) continue;
      vec3 ink;
      if (method == 1) {
        // embroidery: satin stitch rows at 45 degrees, thread sheen, bevelled edge
        float ph = (u * 0.7071 + v * 0.7071) / 0.45;
        float rows = 0.86 + 0.14 * abs(sin(ph * 3.14159));
        vec2 o = vec2(0.6 / r.z, 0.6 / r.w);
        float gx = art(i, st + vec2(o.x, 0.0)).a - art(i, st - vec2(o.x, 0.0)).a;
        float gy = art(i, st + vec2(0.0, o.y)).a - art(i, st - vec2(0.0, o.y)).a;
        float bevel = 1.0 + 0.45 * (-gx - gy);
        ink = a.rgb * shade * rows * bevel + 0.05 * rows;
      } else if (method == 2) {
        // rubber: raised, smooth, a little specular on the lit edge
        vec2 o = vec2(0.8 / r.z, 0.8 / r.w);
        float gx = art(i, st + vec2(o.x, 0.0)).a - art(i, st - vec2(o.x, 0.0)).a;
        float gy = art(i, st + vec2(0.0, o.y)).a - art(i, st - vec2(0.0, o.y)).a;
        float edge = -gx - gy;
        ink = a.rgb * mix(1.0, shade, 0.6) * (1.0 + 0.5 * edge) + vec3(0.25) * pow(max(edge, 0.0), 2.0);
      } else {
        // screen print: ink sits in the knit, follows the folds, fabric grain shows through
        float grain = mix(1.0, lum / max(0.001, dot(vec3(0.72), vec3(0.2126, 0.7152, 0.0722))), 0.06);
        ink = a.rgb * shade * grain;
      }
      col = mix(col, clamp(ink, 0.0, 1.0), a.a * (method == 0 ? 0.97 : 1.0));
    }
  }
  outColor = vec4(col * base.a, base.a);
}`;

type Loaded = { gl: WebGL2RenderingContext; prog: WebGLProgram; tex: Record<string, WebGLTexture>; uv: DecodedMap; pieces: DecodedMap; size: [number, number] };

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
  return s;
}
const loadImage = (url: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = url; });

function imageTexture(gl: WebGL2RenderingContext, img: TexImageSource, filter: number = gl.LINEAR) {
  const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function dataTexture(gl: WebGL2RenderingContext, m: DecodedMap, single: boolean) {
  const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  let data = m.data;
  if (single && m.channels > 1) { data = new Uint8Array(m.width * m.height); for (let i = 0; i < data.length; i++) data[i] = m.data[i * m.channels]; }
  if (!single && m.channels === 3) { data = new Uint8Array(m.width * m.height * 4); for (let i = 0; i < m.width * m.height; i++) { data[i * 4] = m.data[i * 3]; data[i * 4 + 1] = m.data[i * 3 + 1]; data[i * 4 + 2] = m.data[i * 3 + 2]; } }
  gl.texImage2D(gl.TEXTURE_2D, 0, single ? gl.R8UI : gl.RGBA8UI, m.width, m.height, 0, single ? gl.RED_INTEGER : gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  return t;
}

export default function PlateComposite({ base, colour, view, manifest, placements, onChange, onCheck, guides = true, className }: {
  base: string; // e.g. "/lab/plates/fixture-tee"
  colour: string; view: PlateView; manifest: PlateManifest;
  placements: PlatePlacement[];
  onChange?: (next: PlatePlacement[]) => void;
  onCheck?: (checks: Record<string, PrintCheck>) => void; // printable or not, per placement
  guides?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctx = useRef<Loaded | null>(null);
  const arts = useRef<Map<string, { tex: WebGLTexture; aspect: number }>>(new Map());
  const [ready, setReady] = useState(false);
  // Parents pass a fresh array every render; redraw only when the content changes.
  const placementsKey = JSON.stringify(placements.map((p) => [p.id, p.artUrl, p.piece, p.widthIn, p.belowHpsIn, p.fromCfIn, p.rotDeg ?? 0, p.method ?? ""]));
  const [readout, setReadout] = useState<string | null>(null);
  const drag = useRef<{ id: string; du: number; dv: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const coverage = useRef<Map<number, Coverage>>(new Map());
  const lastChecks = useRef("");
  const [overlay, setOverlay] = useState<{ size: [number, number]; frames: { id: string; pts: string; ok: boolean }[]; cf: string | null; hps: [number, number] | null; dims: { x1: number; y1: number; x2: number; y2: number; label: string }[]; reason: string | null }>({ size: [1, 1], frames: [], cf: null, hps: null, dims: [], reason: null });

  // Load the plate for this colour + view.
  useEffect(() => {
    let dead = false;
    (async () => {
      const cv = canvasRef.current; if (!cv) return;
      const gl = cv.getContext("webgl2", { premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: true });
      if (!gl) return;
      const [beauty, shading, uv, pieces] = await Promise.all([
        loadImage(plateUrl(base, colour, view, "beauty")), loadImage(plateUrl(base, colour, view, "shading")),
        loadDataPng(plateUrl(base, colour, view, "uvmap")), loadDataPng(plateUrl(base, colour, view, "pieces")),
      ]);
      if (dead) return;
      const prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "aPos"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ctx.current = { gl, prog, uv, pieces, size: [uv.width, uv.height], tex: {
        beauty: imageTexture(gl, beauty), shading: imageTexture(gl, shading), uv: dataTexture(gl, uv, false), pieces: dataTexture(gl, pieces, true),
      } };
      arts.current.clear();
      coverage.current.clear();
      setReady(true);
    })().catch((e) => console.error("plate load failed", e));
    return () => { dead = true; setReady(false); };
  }, [base, colour, view]);

  // Load any new artwork, then draw.
  useEffect(() => {
    if (!ready || !ctx.current) return;
    let dead = false;
    (async () => {
      const { gl } = ctx.current!;
      for (const p of placements) {
        if (arts.current.has(p.artUrl)) continue;
        const img = await loadImage(p.artUrl);
        arts.current.set(p.artUrl, { tex: imageTexture(gl, img), aspect: img.naturalWidth / img.naturalHeight || 1 });
      }
      if (!dead) { draw(); measure(); }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, placementsKey, dragging]);

  function cov(piece: number) {
    const c = ctx.current!;
    if (!coverage.current.has(piece)) coverage.current.set(piece, buildCoverage(c.uv, c.pieces, piece, CLEARANCE_IN * MM));
    return coverage.current.get(piece)!;
  }

  function measure() {
    const c = ctx.current; if (!c) return;
    const hps = manifest.hpsUv[view] ?? { u: 0, v: 0 }, cf = manifest.cfU[view] ?? hps.u;
    const frames: { id: string; pts: string; ok: boolean }[] = [], checks: Record<string, PrintCheck> = {};
    const dims: { x1: number; y1: number; x2: number; y2: number; label: string }[] = [];
    let reason: string | null = null, cfLine: string | null = null, hpsPt: [number, number] | null = null;
    const focus = dragging ?? placements[placements.length - 1]?.id;
    for (const p of placements) {
      const a = arts.current.get(p.artUrl); if (!a) continue;
      const cv = cov(p.piece), r = artRectMm(p, view, manifest, a.aspect);
      // frame follows the fabric: sample each edge
      const edge: [number, number][] = [];
      const S = 10;
      for (let i = 0; i <= S; i++) edge.push([r.u0 + (r.w * i) / S, r.vTop]);
      for (let i = 1; i <= S; i++) edge.push([r.u0 + r.w, r.vTop - (r.h * i) / S]);
      for (let i = 1; i <= S; i++) edge.push([r.u0 + r.w - (r.w * i) / S, r.vTop - r.h]);
      for (let i = 1; i < S; i++) edge.push([r.u0, r.vTop - r.h + (r.h * i) / S]);
      const pts = edge.map(([u, v]) => mmToPx(cv, u, v)).filter(Boolean) as [number, number][];
      const chk = checkPrintable(cv, r, CLEARANCE_IN);
      checks[p.id] = chk;
      frames.push({ id: p.id, pts: pts.map((q) => q.join(",")).join(" "), ok: chk.ok });
      if (!chk.ok && p.id === focus) reason = chk.reason ?? null;
      if (p.id === focus && guides) {
        const uc = r.u0 + r.w / 2, mid = r.vTop - r.h / 2;
        const cfPts = [] as [number, number][];
        for (let v = hps.v - 40; v > hps.v - 700; v -= 20) { const q = mmToPx(cv, cf, v); if (q) cfPts.push(q); }
        cfLine = cfPts.map((q) => q.join(",")).join(" ");
        hpsPt = mmToPx(cv, cf, hps.v - 8);
        const top = mmToPx(cv, uc, hps.v - 8), artTop = mmToPx(cv, uc, r.vTop);
        if (top && artTop) dims.push({ x1: top[0], y1: top[1], x2: artTop[0], y2: artTop[1], label: `${p.belowHpsIn} in` });
        const cfMid = mmToPx(cv, cf, mid), artMid = mmToPx(cv, uc, mid);
        if (cfMid && artMid && Math.abs(p.fromCfIn) >= 0.25) dims.push({ x1: cfMid[0], y1: cfMid[1], x2: artMid[0], y2: artMid[1], label: `${Math.abs(p.fromCfIn)} in ${p.fromCfIn > 0 ? "L" : "R"}` });
      }
    }
    setOverlay({ size: c.size, frames, cf: cfLine, hps: hpsPt, dims, reason });
    const sig = JSON.stringify(checks);
    if (sig !== lastChecks.current) { lastChecks.current = sig; onCheck?.(checks); }
  }

  function draw() {
    const c = ctx.current, cv = canvasRef.current; if (!c || !cv) return;
    const { gl, prog, tex, size } = c;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(cv.clientWidth * dpr), h = Math.round((cv.clientWidth * dpr * size[1]) / size[0]);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    const bind = (name: string, t: WebGLTexture, unit: number) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(gl.getUniformLocation(prog, name), unit); };
    bind("uBeauty", tex.beauty, 0); bind("uShading", tex.shading, 1); bind("uUv", tex.uv, 2); bind("uPieces", tex.pieces, 3);
    const list = placements.filter((p) => arts.current.has(p.artUrl)).slice(0, MAX);
    const rect = new Float32Array(MAX * 4), meta = new Float32Array(MAX * 4);
    list.forEach((p, i) => {
      const a = arts.current.get(p.artUrl)!;
      const r = artRectMm(p, view, manifest, a.aspect);
      rect.set([r.u0, r.vTop, r.w, r.h], i * 4);
      meta.set([p.piece, METHOD_ID[p.method ?? "screen_print"] ?? 0, ((p.rotDeg ?? 0) * Math.PI) / 180, 0], i * 4);
      bind(`uArt${i}`, a.tex, 4 + i);
    });
    for (let i = list.length; i < MAX; i++) bind(`uArt${i}`, tex.shading, 4 + i);
    gl.uniform2f(gl.getUniformLocation(prog, "uSize"), size[0], size[1]);
    gl.uniform1i(gl.getUniformLocation(prog, "uCount"), list.length);
    gl.uniform4fv(gl.getUniformLocation(prog, "uRect"), rect);
    gl.uniform4fv(gl.getUniformLocation(prog, "uMeta"), meta);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  useEffect(() => {
    const on = () => draw();
    window.addEventListener("resize", on); return () => window.removeEventListener("resize", on);
  });

  // Pointer -> plate pixel -> pattern mm.
  const hitAt = (e: React.PointerEvent) => {
    const c = ctx.current, cv = canvasRef.current; if (!c || !cv) return null;
    const b = cv.getBoundingClientRect();
    return sampleAt(c.uv, c.pieces, ((e.clientX - b.left) / b.width) * c.size[0], ((e.clientY - b.top) / b.height) * c.size[1]);
  };
  const onDown = (e: React.PointerEvent) => {
    const s = hitAt(e); if (!s) return;
    for (let i = placements.length - 1; i >= 0; i--) {
      const p = placements[i]; const a = arts.current.get(p.artUrl); if (!a || p.piece !== s.piece) continue;
      const r = artRectMm(p, view, manifest, a.aspect);
      if (s.u >= r.u0 && s.u <= r.u0 + r.w && s.v <= r.vTop && s.v >= r.vTop - r.h) {
        drag.current = { id: p.id, du: s.u - (r.u0 + r.w / 2), dv: s.v - r.vTop };
        setDragging(p.id);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || !onChange) return;
    const s = hitAt(e); if (!s) return;
    const next = placements.map((p) => {
      if (p.id !== d.id) return p;
      const inch = inchesFromCentreMm(s.u - d.du, s.v - d.dv, view, manifest);
      const fromCf = Math.abs(inch.fromCfIn) < 0.25 ? 0 : Math.round(inch.fromCfIn * 8) / 8; // snap to centre
      const below = Math.max(0, Math.round(inch.belowHpsIn * 8) / 8);
      setReadout(`${p.widthIn} in wide, ${below} in below HPS, ${fromCf === 0 ? "centred" : `${Math.abs(fromCf)} in wearer's ${fromCf > 0 ? "left" : "right"}`}`);
      return { ...p, fromCfIn: fromCf, belowHpsIn: below };
    });
    onChange(next);
  };
  const onUp = () => { drag.current = null; setDragging(null); setReadout(null); };

  void WEARER_LEFT_SIGN; void MM;
  return (
    <div className={`platex ${className ?? ""}`}>
      <canvas ref={canvasRef} className="platex-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
      {ready ? (
        <svg className="platex-overlay" viewBox={`0 0 ${overlay.size[0]} ${overlay.size[1]}`} preserveAspectRatio="none" aria-hidden>
          {overlay.cf ? <polyline className="platex-cf" points={overlay.cf} /> : null}
          {overlay.hps ? (
            <g className="platex-hps">
              <line x1={overlay.hps[0] - 60} y1={overlay.hps[1]} x2={overlay.hps[0] + 60} y2={overlay.hps[1]} />
              <text x={overlay.hps[0] + 70} y={overlay.hps[1] + 8}>HPS</text>
            </g>
          ) : null}
          {overlay.frames.filter((f) => guides || !f.ok).map((f) => <polygon key={f.id} className={`platex-frame${f.ok ? "" : " is-bad"}`} points={f.pts} />)}
          {overlay.dims.map((d, i) => (
            <g key={i} className="platex-dim">
              <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} />
              <text x={(d.x1 + d.x2) / 2 + 14} y={(d.y1 + d.y2) / 2 + 8}>{d.label}</text>
            </g>
          ))}
        </svg>
      ) : null}
      {overlay.reason ? <p className="platex-reason">{overlay.reason}</p> : null}
      {readout ? <span className="platex-readout">{readout}</span> : null}
      {!ready ? <span className="platex-loading">Loading</span> : null}
    </div>
  );
}
