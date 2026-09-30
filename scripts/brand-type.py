"""Snap app/globals.css to the magnumopus.agency type system (measured 9/30 in a real browser).

MOA site: Archivo Expanded only, 400 body / 700 display + labels, every word in capitals,
scale 11 12 13 14 16 22 28 48 56 64 px, tracking 0.08em (labels) / 0.04em / 0.01em (body),
ink #1E1E1E for copy, ink at 55% for small meta labels. Admin/studio tools are left alone.
"""
import re, sys
p = "app/globals.css"
css = open(p).read()
ADMIN = re.compile(r"^\s*\.(studio3d|ze-|assetmgr|patcal|z3d|admin|spec-|pe-|npf-|aoa-)")

def snap_px(px):
    for lim, v in ((11.5, 11), (12.5, 12), (13.5, 13), (15, 14), (18.5, 16), (25, 22), (38, 28), (52, 48), (60, 56)):
        if px < lim: return v
    return 64

def size(v):
    v = v.strip()
    m = re.fullmatch(r"([\d.]+)rem", v)
    if m: return f"{snap_px(float(m.group(1)) * 16)}px"
    m = re.fullmatch(r"([\d.]+)px", v)
    if m: return f"{snap_px(float(m.group(1)))}px"
    m = re.fullmatch(r"clamp\(([\d.]+)rem,\s*([^,]+),\s*([\d.]+)rem\)", v)
    if m:
        hi = float(m.group(3)) * 16
        if hi >= 34: return f"clamp(32px, {m.group(2).strip()}, 56px)"   # section headings = 56 on desktop
        return f"clamp(22px, {m.group(2).strip()}, 28px)"
    return v

def weight(v):
    v = v.strip(); imp = " !important" if "!important" in v else ""
    n = re.match(r"\d+", v)
    if not n or " " in v.replace(" !important", ""): return v
    return ("400" if int(n.group()) < 600 else "700") + imp

def track(v):
    v = v.strip(); imp = " !important" if "!important" in v else ""
    m = re.match(r"(-?[\d.]+)em", v)
    if not m: return v
    e = float(m.group(1))
    if e < 0: return v
    return ("0.08em" if e >= 0.06 else "0.04em" if e >= 0.02 else "0.01em") + imp

out, stats = [], {"size": 0, "weight": 0, "track": 0, "case": 0, "color": 0}
# walk rule blocks: selector { body }
pos = 0
for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", css):
    sel, body = m.group(1), m.group(2)
    out.append(css[pos:m.start()]); pos = m.end()
    if sel.strip().startswith("@font-face") or ADMIN.match(sel) or re.search(r"\bcode\b|input|textarea|select\b", sel):
        out.append(m.group(0)); continue
    nb = body
    nb, n = re.subn(r"font-size:\s*([^;]+)", lambda k: "font-size: " + size(k.group(1)), nb); stats["size"] += n
    nb, n = re.subn(r"font-weight:\s*([^;]+)", lambda k: "font-weight: " + weight(k.group(1)), nb); stats["weight"] += n
    nb, n = re.subn(r"letter-spacing:\s*([^;]+)", lambda k: "letter-spacing: " + track(k.group(1)), nb); stats["track"] += n
    nb, n = re.subn(r"text-transform:\s*(none|capitalize|lowercase)", "text-transform: uppercase", nb); stats["case"] += n
    # warm grey copy -> MOA ink (body) or ink at 55% (small meta)
    fsm = re.search(r"font-size:\s*(\d+)px", nb)
    small = fsm and int(fsm.group(1)) <= 12
    nb, n = re.subn(r"color:\s*var\(--(color-neutral|muted-foreground)\)",
                    "color: rgba(30, 30, 30, 0.55)" if small else "color: var(--color-charcoal)", nb); stats["color"] += n
    out.append(sel + "{" + nb + "}")
out.append(css[pos:])
css = "".join(out)
css += """
/* MOA brand type (matches magnumopus.agency): every word in capitals, Archivo Expanded,
   400 / 700 only. User-typed text keeps its own case. */
body { text-transform: uppercase; font-weight: 400; letter-spacing: 0.01em; }
input, textarea, select, [contenteditable], code, kbd { text-transform: none; }
input::placeholder, textarea::placeholder { text-transform: uppercase; }
"""
open(p, "w").write(css)
print(stats)
