/* Renna – interfaccia dell'editor (viste 2D, 3D, pannelli, salvataggi). */
(function () {
  "use strict";
  const RC = window.RennaCore;
  const $ = (id) => document.getElementById(id);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const KEY = "renna-progetto-v2", OLDKEY = "renna-corpo-v1";
  const SHORT = { corpo: "Corpo", testa: "Collo e testa", AS: "Ant. sinistra", AD: "Ant. destra", PS: "Post. sinistra", PD: "Post. destra" };
  let proj = null;
  try { const s = localStorage.getItem(KEY); if (s) proj = RC.migrate(JSON.parse(s)); } catch (e) {}
  if (!proj) { try { const s = localStorage.getItem(OLDKEY); if (s) proj = RC.migrate(JSON.parse(s)); } catch (e) {} }
  if (!proj) proj = RC.defaultProject();
  const DEF = RC.defaultProject();
  RC.ORDER.forEach(k => { if (!proj.pieces[k]) proj.pieces[k] = clone(DEF.pieces[k]); });
  if (!proj.pieces[proj.cur]) proj.cur = "corpo";
  let st = proj.pieces[proj.cur];
  let D = RC.derive(st), others = {};
  const hist = [];
  function derOthers() { others = {}; RC.ORDER.forEach(k => { if (k !== proj.cur) others[k] = RC.derive(proj.pieces[k]); }); }
  derOthers();
  function pushHist() { hist.push(JSON.stringify(proj)); if (hist.length > 100) hist.shift(); updButtons(); }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(proj)); } catch (e) {} }
  function changed() { D = RC.derive(st); persist(); drawAll(); renderPanel(); }
  const css = () => { const s = getComputedStyle(document.documentElement); const g = (n) => s.getPropertyValue(n).trim(); return {
    grid: g("--grid"), grid5: g("--grid5"), wire: g("--wire"), horiz: g("--horiz"), ring: g("--ring"), tie: g("--tie"),
    start: g("--start"), sel: g("--sel"), muted: g("--muted"), ink: g("--ink"), panel: g("--panel"), line: g("--line") }; };
  const snap = (v) => $("snap").checked ? Math.round(v * 2) / 2 : Math.round(v * 10) / 10;
  const ax = () => D.ax || RC.axisInfo(st.axis);

  // ------------------------------------------------ vista 2D generica
  function View(canvas, opts) {
    this.c = canvas; this.ctx = canvas.getContext("2d"); this.o = opts; this.sel = null; this.drag = null;
    const v = this;
    new ResizeObserver(() => v.resize()).observe(canvas);
    canvas.addEventListener("pointerdown", (e) => v.down(e));
    canvas.addEventListener("pointermove", (e) => v.move(e));
    canvas.addEventListener("pointerup", () => v.up());
    canvas.addEventListener("pointercancel", () => v.up());
    canvas.addEventListener("dblclick", (e) => v.dbl(e));
    canvas.addEventListener("contextmenu", (e) => { e.preventDefault(); const h = v.hit(e); if (h && h.kind === "pt") { v.sel = h.pt; v.o.del(h.pt); } });
  }
  View.prototype.resize = function () {
    const r = this.c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    this.c.width = Math.max(10, Math.round(r.width * dpr)); this.c.height = Math.max(10, Math.round(r.height * dpr));
    this.dpr = dpr; this.draw();
  };
  View.prototype.fit = function () {
    const b = this.o.bounds(); const W = this.c.width, H = this.c.height, pad = 16 * this.dpr;
    const s = Math.min((W - 2 * pad) / (b[2] - b[0]), (H - 2 * pad) / (b[3] - b[1]));
    this.s = s; this.ox = (W - s * (b[2] - b[0])) / 2 - s * b[0]; this.oy = (H + s * (b[3] - b[1])) / 2 + s * b[1];
  };
  View.prototype.X = function (x) { return this.ox + x * this.s; };
  View.prototype.Y = function (y) { return this.oy - y * this.s; };
  View.prototype.w2 = function (e) { const r = this.c.getBoundingClientRect(); const px = (e.clientX - r.left) * this.dpr, py = (e.clientY - r.top) * this.dpr;
    return [(px - this.ox) / this.s, (this.oy - py) / this.s, px, py]; };
  View.prototype.near = function (px, py) {
    const R = 11 * this.dpr;
    for (const pt of this.o.points()) if (Math.hypot(this.X(pt.p[0]) - px, this.Y(pt.p[1]) - py) < R) return pt;
    return null;
  };
  View.prototype.hit = function (e) {
    const [, , px, py] = this.w2(e);
    const R = 11 * this.dpr; let best = null, bd = R;
    for (const pt of this.o.points()) { const d = Math.hypot(this.X(pt.p[0]) - px, this.Y(pt.p[1]) - py); if (d < bd) { bd = d; best = { kind: "pt", pt }; } }
    const hs = this.o.handles ? this.o.handles() : [];
    for (const h of hs) if (h.dist) { const d = h.dist(px, py, this); if (d < bd + 2 * this.dpr) { bd = d; best = { kind: "h", h }; } }
    if (best) return best;
    for (const h of hs) if (!h.dist && h.test(px, py, this)) return { kind: "h", h };
    return null;
  };
  View.prototype.down = function (e) {
    const h = this.hit(e);
    if (!h) { this.sel = null; this.o.onSel(null); this.draw(); return; }
    this.pending = true; this.drag = h; this.c.setPointerCapture(e.pointerId);
    if (h.kind === "pt") { this.sel = h.pt; this.o.onSel(h.pt); }
    this.draw();
  };
  View.prototype.move = function (e) {
    if (!this.drag) { const h = this.hit(e); this.c.style.cursor = h ? (h.kind === "h" ? h.h.cursor : "grab") : "default"; return; }
    if (this.pending) { pushHist(); this.pending = false; }
    const [x, y] = this.w2(e);
    if (this.drag.kind === "pt") this.o.movePt(this.drag.pt, snap(x), snap(y)); else this.drag.h.move(snap(x), snap(y), [x, y]);
    changed();
  };
  View.prototype.up = function () { if (this.drag) { this.drag = null; this.o.onSel(this.sel); } };
  View.prototype.dbl = function (e) { const [x, y] = this.w2(e); const pt = this.o.insert(snap(x), snap(y)); if (pt) { this.sel = pt; this.o.onSel(pt); } };
  View.prototype.isSel = function (kind, i) { return this.sel && this.sel.kind === kind && this.sel.i === i; };
  View.prototype.grid = function (b, C) {
    const ctx = this.ctx; ctx.lineWidth = 1;
    const x0 = Math.floor(b[0]), x1 = Math.ceil(b[2]), y0 = Math.floor(b[1]), y1 = Math.ceil(b[3]);
    for (let g = x0; g <= x1; g++) { ctx.strokeStyle = g % 5 ? C.grid : C.grid5; ctx.beginPath(); ctx.moveTo(this.X(g), this.Y(y0)); ctx.lineTo(this.X(g), this.Y(y1)); ctx.stroke(); }
    for (let g = y0; g <= y1; g++) { ctx.strokeStyle = g % 5 ? C.grid : C.grid5; ctx.beginPath(); ctx.moveTo(this.X(x0), this.Y(g)); ctx.lineTo(this.X(x1), this.Y(g)); ctx.stroke(); }
    ctx.fillStyle = C.muted; ctx.font = `${10 * this.dpr}px IBM Plex Mono, monospace`;
    for (let g = Math.ceil(x0 / 10) * 10; g <= x1; g += 10) ctx.fillText(String(g), this.X(g) + 2 * this.dpr, this.Y(y0) - 3 * this.dpr);
    for (let g = Math.ceil(y0 / 10) * 10; g <= y1; g += 10) ctx.fillText(String(g), this.X(x0) + 2 * this.dpr, this.Y(g) - 3 * this.dpr);
  };
  View.prototype.path = function (c, color, w, dash, alpha) {
    const ctx = this.ctx; ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.strokeStyle = color; ctx.lineWidth = w * this.dpr;
    ctx.setLineDash(dash ? dash.map(d => d * this.dpr) : []); ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.beginPath();
    c.forEach((p, i) => i ? ctx.lineTo(this.X(p[0]), this.Y(p[1])) : ctx.moveTo(this.X(p[0]), this.Y(p[1]))); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  };
  View.prototype.dot = function (x, y, color, r, filled, square) {
    const ctx = this.ctx, X = this.X(x), Y = this.Y(y), R = r * this.dpr; ctx.beginPath();
    if (square) ctx.rect(X - R, Y - R, 2 * R, 2 * R); else ctx.arc(X, Y, R, 0, Math.PI * 2);
    ctx.fillStyle = filled ? color : this.C.panel; ctx.fill(); ctx.lineWidth = 2 * this.dpr; ctx.strokeStyle = color; ctx.stroke();
  };
  View.prototype.label = function (t, x, y, color, dx, dy, align) {
    const ctx = this.ctx; ctx.fillStyle = color; ctx.font = `600 ${10.5 * this.dpr}px Archivo, sans-serif`; ctx.textAlign = align || "left";
    ctx.fillText(t, this.X(x) + (dx || 0) * this.dpr, this.Y(y) + (dy || 0) * this.dpr); ctx.textAlign = "left";
  };
  View.prototype.draw = function () {
    if (!this.c.width) return; this.C = css();
    this.ctx.clearRect(0, 0, this.c.width, this.c.height); this.fit(); this.o.draw(this, this.C);
  };
  function nearestSeg(pts, x, y, closed) {
    let best = -1, bd = 1e9; const n = pts.length, m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L));
      const d = Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y); if (d < bd) { bd = d; best = i; }
    }
    return { i: best, d: bd };
  }
  function segHit(v, a, b, px, py, tol) {
    const ax_ = v.X(a[0]), ay = v.Y(a[1]), bx = v.X(b[0]), by = v.Y(b[1]), dx = bx - ax_, dy = by - ay, L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax_) * dx + (py - ay) * dy) / L));
    return Math.hypot(ax_ + t * dx - px, ay + t * dy - py) < tol * v.dpr;
  }
  function dring(rg) { const r = D.ok && D.ringOf ? D.ringOf(rg) : null; return r && !r.bad ? r : null; }
  function setSA(rg, s, a) { const q = RC.ringFromSA(D.V, D.ax, D.s0, s, a); if (q) { rg.p1 = q.p1; rg.p2 = q.p2; } }
  const bboxV = () => {
    const xs = st.v.map(p => p[0]), ys = st.v.map(p => p[1]);
    const y0 = st.type === "zampa" ? Math.min(-1, Math.min(...ys) - 4) : Math.min(...ys) - 4;
    return [Math.min(...xs) - 6, y0, Math.max(...xs) + 6, Math.max(...ys) + 7];
  };

  // ------------------------------------------------ vista di lato
  const side = new View($("cvSide"), {
    bounds: bboxV,
    points: () => st.v.map((p, i) => ({ kind: "v", i, p })).concat(st.axis.map((p, i) => ({ kind: "axis", i, p }))),
    onSel: (pt) => renderSel("side", pt),
    movePt: (pt, x, y) => { (pt.kind === "v" ? st.v : st.axis)[pt.i] = [x, y]; },
    insert: (x, y) => {
      const rv = nearestSeg(st.v, x, y, true), ra = nearestSeg(st.axis, x, y, false);
      if (Math.min(rv.d, ra.d) > 3) return null;
      pushHist();
      if (ra.d < rv.d) { st.axis.splice(ra.i + 1, 0, [x, y]); changed(); return { kind: "axis", i: ra.i + 1, p: [x, y] }; }
      st.v.splice(rv.i + 1, 0, [x, y]); changed(); return { kind: "v", i: rv.i + 1, p: [x, y] };
    },
    del: (pt) => {
      const arr = pt.kind === "v" ? st.v : st.axis; if (arr.length <= (pt.kind === "v" ? 5 : 2)) return;
      pushHist(); arr.splice(pt.i, 1); side.sel = null; changed(); renderSel("side", null);
    },
    handles: () => {
      const hs = [];
      if (!D.ok) return hs;
      st.rings.forEach((rg) => {
        const r = dring(rg);
        const pts = r ? [[r.topKey, r.pt], [r.topKey === "p1" ? "p2" : "p1", r.pb]] : [["p1", rg.p1], ["p2", rg.p2]];
        pts.forEach(([key, p]) => hs.push({ cursor: "grab",
          dist: (px, py, v) => Math.hypot(px - v.X(p[0]), py - v.Y(p[1])),
          move: (x, y, raw) => { const q = RC.nearestOnCurve(D.V, raw[0], raw[1]); rg[key] = [+q[0].toFixed(2), +q[1].toFixed(2)]; } }));
      });
      st.rings.forEach((rg) => {
        const r = dring(rg); if (!r) return;
        const o1 = rg.p1.slice(), o2 = rg.p2.slice(); let anchor = null;
        hs.push({ cursor: "move", test: (px, py, v) => segHit(v, r.pb, r.pt, px, py, 6),
          move: (x, y, raw) => {
            if (!anchor) anchor = raw.slice();
            const dx = raw[0] - anchor[0], dy = raw[1] - anchor[1];
            const q1 = RC.nearestOnCurve(D.V, o1[0] + dx, o1[1] + dy), q2 = RC.nearestOnCurve(D.V, o2[0] + dx, o2[1] + dy);
            rg.p1 = [+q1[0].toFixed(2), +q1[1].toFixed(2)]; rg.p2 = [+q2[0].toFixed(2), +q2[1].toFixed(2)];
          } });
      });
      return hs;
    },
    draw: (v, C) => {
      const b = bboxV(); v.grid(b, C);
      const ctx = v.ctx; ctx.fillStyle = C.muted; ctx.font = `500 ${10 * v.dpr}px Archivo, sans-serif`;
      ctx.fillText("◀ muso", v.X(b[0]) + 30 * v.dpr, v.Y(b[3]) + 14 * v.dpr);
      if (b[1] < 0) v.path([[b[0], 0], [b[2], 0]], C.muted, 1, [2, 3]);
      Object.values(others).forEach(o => v.path(o.V, C.muted, 1.4, null, 0.35));
      v.path(st.axis, C.horiz, 1.5, [6, 4]);
      if (D.ok) {
        D.rings.forEach(r => { v.path([r.pb, r.pt], C.ring, 2.2);
          v.label(r.n + (r.a ? ` ${r.a}°` : ""), r.pt[0] + r.d[0] * 1.6, r.pt[1] + r.d[1] * 1.6, C.ring, 0, -6, "center"); });
        st.rings.forEach(rg => { if (!dring(rg)) v.path([rg.p1, rg.p2], C.ring, 1.5, [3, 3]); });
      }
      v.path(D.V, C.wire, 3);
      if (D.ok) { v.dot(D.c0[0], D.c0[1], C.tie, 4.5, true); v.dot(D.c1[0], D.c1[1], C.tie, 4.5, true);
        D.bends.forEach(bd => v.label(`${Math.abs(bd.deg).toFixed(0)}°`, bd.p[0], bd.p[1], C.horiz, 9, 4)); }
      v.path(st.v.concat([st.v[0]]), C.muted, 1, [2, 3]);
      if (D.ok) D.rings.forEach(r => { v.dot(r.pt[0], r.pt[1], C.ring, 4.5, true); v.dot(r.pb[0], r.pb[1], C.ring, 4.5, true); });
      st.v.forEach((p, i) => v.dot(p[0], p[1], v.isSel("v", i) ? C.sel : C.wire, v.isSel("v", i) ? 6.5 : 5, v.isSel("v", i)));
      st.axis.forEach((p, i) => v.dot(p[0], p[1], v.isSel("axis", i) ? C.sel : C.horiz, v.isSel("axis", i) ? 6 : 4.5, true, true));
    },
  });

  // ------------------------------------------------ secondo anello (s, z)
  const bboxT = () => { const S = D.ok ? D.S : 50; const wm = Math.max(6, ...st.top.map(p => p[1])); return [-5, -wm - 3.5, S + 5, wm + 3.5]; };
  const top = new View($("cvTop"), {
    bounds: bboxT,
    points: () => st.top.map((p, i) => ({ kind: "top", i, p })),
    onSel: (pt) => renderSel("top", pt),
    movePt: (pt, x, y) => { st.top[pt.i] = [x, Math.max(0.5, Math.abs(y))]; },
    insert: (x, y) => {
      if (!D.ok) return null; const w = Math.abs(y);
      const pts = [[0, 0], ...st.top.slice().sort((a, b) => a[0] - b[0]), [D.S, 0]];
      if (nearestSeg(pts, x, w, false).d > 3) return null;
      pushHist(); st.top.push([x, Math.max(0.5, w)]); st.top.sort((a, b) => a[0] - b[0]); changed();
      const i = st.top.findIndex(p => p[0] === x); return { kind: "top", i, p: st.top[i] };
    },
    del: (pt) => { if (st.top.length <= 3) return; pushHist(); st.top.splice(pt.i, 1); top.sel = null; changed(); renderSel("top", null); },
    handles: () => st.rings.map((rg) => { const r = dring(rg); return { cursor: "ew-resize", test: (px, py, v) => !!r && Math.abs(px - v.X(r.s)) < 6 * v.dpr && !v.near(px, py),
      move: (x) => { if (r) setSA(rg, Math.max(0.5, Math.min((D.S || 50) - 0.5, x)), r.a); } }; }),
    draw: (v, C) => {
      const b = bboxT(); v.grid(b, C);
      const ctx = v.ctx; ctx.fillStyle = C.muted; ctx.font = `500 ${10 * v.dpr}px Archivo, sans-serif`;
      ctx.fillText("fianco destro", v.X(b[0]) + 30 * v.dpr, v.Y(b[3]) + 14 * v.dpr);
      ctx.fillText("fianco sinistro", v.X(b[0]) + 30 * v.dpr, v.Y(b[1]) - 6 * v.dpr);
      ctx.textAlign = "right";
      const cr = RC.TYPES[st.type].cross; ctx.fillText(`${cr[0]} ◀    ▶ ${cr[1]}`, v.X(b[2]) - 6 * v.dpr, v.Y(b[3]) + 14 * v.dpr);
      ctx.textAlign = "left";
      v.path([[b[0] + 1, 0], [b[2] - 1, 0]], C.wire, 1.2, [6, 4]);
      if (!D.ok) return;
      D.bends.forEach(bd => { v.path([[bd.s, b[1] + 1], [bd.s, b[3] - 1]], C.sel, 1.5, [4, 3]); v.label(`piega ${Math.abs(bd.deg).toFixed(0)}°`, bd.s, b[1] + 1, C.sel, 4, -4); });
      D.rings.forEach(r => { v.path([[r.s, -r.w], [r.s, r.w]], C.ring, 2.2); v.label(r.n, r.s, r.w, C.ring, 0, -8, "center"); });
      v.path(D.H, C.horiz, 3);
      v.dot(0, 0, C.tie, 4.5, true); v.dot(D.S, 0, C.tie, 4.5, true);
      st.top.forEach((p, i) => { v.dot(p[0], -p[1], C.horiz, 2.5, true); v.dot(p[0], p[1], v.isSel("top", i) ? C.sel : C.horiz, v.isSel("top", i) ? 6.5 : 5, v.isSel("top", i)); });
    },
  });

  // ------------------------------------------------ vista 3D
  const c3 = $("cv3d"), x3 = c3.getContext("2d"); let yaw = -0.75, pitch = 0.32, drag3 = null;
  new ResizeObserver(() => { const r = c3.getBoundingClientRect(), d = window.devicePixelRatio || 1; c3.width = Math.round(r.width * d); c3.height = Math.round(r.height * d); draw3d(); }).observe(c3);
  c3.addEventListener("pointerdown", (e) => { drag3 = [e.clientX, e.clientY, yaw, pitch]; c3.setPointerCapture(e.pointerId); c3.style.cursor = "grabbing"; });
  c3.addEventListener("pointermove", (e) => { if (!drag3) return; yaw = drag3[2] + (e.clientX - drag3[0]) * 0.01; pitch = Math.max(-1.4, Math.min(1.4, drag3[3] + (e.clientY - drag3[1]) * 0.01)); draw3d(); });
  const end3 = () => { drag3 = null; c3.style.cursor = "grab"; };
  c3.addEventListener("pointerup", end3); c3.addEventListener("pointercancel", end3);
  function pieceLines(P, d, pc, color, w, alpha, out) {
    if (!d.ok) { const z = pc.zoff; for (let i = 1; i < d.V.length; i++) out.push(seg(P, [d.V[i - 1][0], d.V[i - 1][1], z], [d.V[i][0], d.V[i][1], z], color.wire, w, alpha)); return; }
    const z0 = pc.zoff;
    const add = (pts, col) => { for (let i = 1; i < pts.length; i++) out.push(seg(P, pts[i - 1], pts[i], col, w, alpha)); };
    add(d.V.map(p => [p[0], p[1], z0]), color.wire);
    add(d.H.map(p => d.toWorldB(p[0], p[1])), color.horiz);
    d.rings.forEach(r => add(r.curve.map(p => [r.c[0] + p[1] * r.d[0], r.c[1] + p[1] * r.d[1], p[0] + z0]), color.ring));
  }
  function seg(P, a, b, color, w, alpha) { const A = P(...a), B = P(...b); return { a: A, b: B, z: (A[2] + B[2]) / 2, color, w, alpha }; }
  function draw3d() {
    if (!c3.width) return; const C = css(), W = c3.width, H = c3.height, dpr = window.devicePixelRatio || 1;
    x3.clearRect(0, 0, W, H);
    const cx = 44, cy = 42, cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const P = (x, y, z) => { x -= cx; y -= cy; z = -z; const X = x * cyw - z * syw, Z = x * syw + z * cyw; return [X, y * cp - Z * sp, y * sp + Z * cp]; };
    const sc = Math.min(W / 86, H / 80), S = (p) => [W / 2 + p[0] * sc, H / 2 - p[1] * sc];
    // terreno
    x3.strokeStyle = C.grid5; x3.lineWidth = dpr;
    for (let g = -40; g <= 40; g += 10) { const a = S(P(cx + g, 0, -20)), b = S(P(cx + g, 0, 20)); x3.beginPath(); x3.moveTo(...a); x3.lineTo(...b); x3.stroke(); }
    for (let g = -20; g <= 20; g += 10) { const a = S(P(cx - 40, 0, g)), b = S(P(cx + 40, 0, g)); x3.beginPath(); x3.moveTo(...a); x3.lineTo(...b); x3.stroke(); }
    const lines = [];
    const faint = { wire: C.muted, horiz: C.muted, ring: C.muted };
    RC.ORDER.forEach(k => { if (k === proj.cur) return; pieceLines(P, others[k], proj.pieces[k], faint, 1.2, 0.35, lines); });
    pieceLines(P, D, st, { wire: C.wire, horiz: C.horiz, ring: C.ring }, 2.4, 1, lines);
    lines.sort((p, q) => q.z - p.z);
    x3.lineCap = "round";
    for (const l of lines) { x3.globalAlpha = l.alpha; x3.strokeStyle = l.color; x3.lineWidth = l.w * dpr; const a = S(l.a), b = S(l.b); x3.beginPath(); x3.moveTo(...a); x3.lineTo(...b); x3.stroke(); }
    x3.globalAlpha = 1;
    const m = S(P(8, 72, 0)); x3.fillStyle = C.muted; x3.font = `500 ${11 * dpr}px Archivo, sans-serif`; x3.fillText("◀ muso", m[0], m[1]);
  }

  // ------------------------------------------------ pannello
  function renderSel(which, pt) {
    if (which === "side") top.sel = null; else side.sel = null;
    $("selSide").innerHTML = ""; $("selTop").innerHTML = "";
    const box = which === "side" ? $("selSide") : $("selTop");
    if (!pt) { box.textContent = "Nessun punto selezionato."; drawAll(); return; }
    const arr = pt.kind === "v" ? st.v : pt.kind === "axis" ? st.axis : st.top;
    const what = pt.kind === "v" ? "Punto del profilo" : pt.kind === "axis" ? "Punto dell'asse" : "Punto";
    const lx = pt.kind === "top" ? "s" : "x", ly = pt.kind === "top" ? "mezza larghezza" : "y";
    box.innerHTML = `<span>${what} ${pt.i + 1}</span>
      <label>${lx} <input id="px" type="number" step="0.5" value="${arr[pt.i][0]}"></label>
      <label>${ly} <input id="py" type="number" step="0.5" value="${arr[pt.i][1]}"></label>
      <button type="button" id="pdel">Elimina punto</button>`;
    $("px").onchange = $("py").onchange = () => {
      pushHist(); const x = parseFloat($("px").value), y = parseFloat($("py").value);
      if (isFinite(x) && isFinite(y)) { arr[pt.i] = [x, pt.kind === "top" ? Math.max(0.5, Math.abs(y)) : y]; changed(); }
    };
    $("pdel").onclick = () => (which === "side" ? side : top).o.del(pt);
    drawAll();
  }
  function renderTabs() {
    const t = $("tabs"); t.innerHTML = "";
    RC.ORDER.forEach(k => {
      const b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", k === proj.cur ? "true" : "false"); b.textContent = SHORT[k];
      b.title = proj.pieces[k].name; b.onclick = () => selectPiece(k); t.appendChild(b);
    });
    const sel = $("copyFrom"); sel.innerHTML = "";
    RC.ORDER.forEach(k => { if (k !== proj.cur && proj.pieces[k].type === st.type) { const o = document.createElement("option"); o.value = k; o.textContent = proj.pieces[k].name; sel.appendChild(o); } });
    $("copyFrom").disabled = $("copyBtn").disabled = !sel.options.length;
    $("cvSide").style.aspectRatio = st.type === "zampa" ? "16 / 12" : st.type === "testa" ? "16 / 10" : "";
    const T = RC.TYPES[st.type];
    $("titleA").textContent = `Di lato · ${T.loopA.toLowerCase()}`;
    $("titleB").textContent = `${T.loopB} · ${T.bView}`;
    $("hintB").textContent = st.type === "corpo" ? "simmetrico: modifichi la metà superiore, l'altra si specchia" : "disteso lungo l'asse · simmetrico: modifichi la metà superiore";
    $("cvTop").style.aspectRatio = st.type === "testa" ? "16 / 5" : "";
  }
  function selectPiece(k) {
    proj.cur = k; st = proj.pieces[k]; side.sel = top.sel = null;
    D = RC.derive(st); derOthers(); persist(); renderTabs(); renderPanel(); renderSel("side", null);
  }
  function straightAxis() { return st.axis.length === 2 && Math.abs(st.axis[0][1] - st.axis[1][1]) < 1e-6; }
  function renderPanel() {
    $("rowYh").hidden = !(st.type === "corpo" && straightAxis());
    if (!$("rowYh").hidden) $("yh").value = st.axis[0][1].toFixed(1);
    $("rowZ").hidden = st.type !== "zampa"; $("zoff").value = Math.abs(st.zoff).toFixed(1);
    $("n").value = st.n; $("nVal").textContent = st.n.toFixed(2);
    const rs = $("rings"); rs.innerHTML = "";
    st.rings.map((rg, k) => [rg, k, dring(rg)]).sort((a, b) => (a[2] ? a[2].s : 1e9) - (b[2] ? b[2].s : 1e9)).forEach(([rg, k, r], j) => {
      const row = document.createElement("div"); row.className = "ringrow";
      row.innerHTML = `<b>A${j + 1}</b><span class="dim">${r ? `${(r.ut + r.ub).toFixed(1)} × ${(2 * r.w).toFixed(1)} cm` : "fuori dal pezzo"}</span>
        <label>s <input type="number" step="0.5" value="${r ? r.s.toFixed(1) : ""}" id="rs${k}" ${r ? "" : "disabled"}></label>
        <label>incl. <input type="number" step="1" min="-60" max="60" value="${r ? r.a : ""}" id="ra${k}" style="width:58px" ${r ? "" : "disabled"}>°</label>
        <button type="button" title="Togli questo anello">Togli</button>`;
      const ins = row.querySelectorAll("input");
      ins[0].onchange = (e) => { const v = parseFloat(e.target.value); if (isFinite(v) && r) { pushHist(); setSA(rg, v, r.a); changed(); } };
      ins[1].onchange = (e) => { const v = parseFloat(e.target.value); if (isFinite(v) && r) { pushHist(); setSA(rg, r.s, Math.max(-60, Math.min(60, v))); changed(); } };
      row.querySelector("button").onclick = () => { if (st.rings.length <= 1) return; pushHist(); st.rings.splice(k, 1); changed(); };
      rs.appendChild(row);
    });
    const sum = $("sum");
    if (!D.ok) sum.innerHTML = "";
    else {
      const T = RC.TYPES[st.type];
      let h = `<tr><td><span class="tag" style="background:var(--wire)"></span>${T.loopA}</td><td class="n">${D.LV.toFixed(0)} + 5 cm</td></tr>
        <tr><td><span class="tag" style="background:var(--horiz)"></span>${T.loopB}</td><td class="n">${D.LH.toFixed(0)} + 5 cm</td></tr>`;
      D.rings.forEach(r => { h += `<tr><td><span class="tag" style="background:var(--ring)"></span>Anello ${r.n}</td><td class="n">${r.L.toFixed(0)} + 5 cm</td></tr>`; });
      h += `<tr class="tot"><td>Totale ${st.name.toLowerCase()}</td><td class="n">≈ ${(D.tot / 100).toFixed(1)} m</td></tr>`;
      let all = 0, okAll = true; RC.ORDER.forEach(k => { const d = k === proj.cur ? D : others[k]; if (d.ok) all += d.tot; else okAll = false; });
      h += `<tr><td>Tutta la renna (6 pezzi)</td><td class="n">${okAll ? "≈ " + (all / 100).toFixed(1) + " m" : "–"}</td></tr>`;
      sum.innerHTML = h;
    }
    const w = $("warn"); if (D.warn.length) { w.hidden = false; w.innerHTML = D.warn.map(t => `<div>${t}</div>`).join(""); } else w.hidden = true;
    $("pdf").disabled = !D.ok;
    $("pdf").textContent = `PDF · ${SHORT[proj.cur]}`;
    updButtons();
  }
  function updButtons() { $("undo").disabled = !hist.length; }
  function drawAll() { side.draw(); top.draw(); draw3d(); }

  $("pname").value = proj.name || "renna";
  $("pname").onchange = () => { proj.name = $("pname").value.trim() || "renna"; persist(); };
  $("yh").onchange = (e) => { const v = parseFloat(e.target.value); if (isFinite(v)) { pushHist(); st.axis[0][1] = st.axis[1][1] = v; changed(); } };
  $("zoff").onchange = (e) => { const v = parseFloat(e.target.value); if (isFinite(v)) { pushHist(); const sg = (proj.cur === "AS" || proj.cur === "PS") ? -1 : 1; st.zoff = sg * Math.abs(v); changed(); } };
  $("n").addEventListener("pointerdown", () => pushHist());
  $("n").addEventListener("keydown", () => pushHist());
  $("n").oninput = (e) => { st.n = parseFloat(e.target.value); changed(); };
  $("addRing").onclick = () => {
    if (!D.ok) return; pushHist();
    const ss = [1.5, ...D.rings.map(r => r.s).sort((a, b) => a - b), D.S - 1.5];
    let gap = 0, at = D.S / 2;
    for (let i = 1; i < ss.length; i++) if (ss[i] - ss[i - 1] > gap) { gap = ss[i] - ss[i - 1]; at = (ss[i] + ss[i - 1]) / 2; }
    const q = RC.ringFromSA(D.V, D.ax, D.s0, snap(at), 0); if (q) st.rings.push(q); changed();
  };
  function undo() { if (!hist.length) return; proj = JSON.parse(hist.pop()); st = proj.pieces[proj.cur]; side.sel = top.sel = null; D = RC.derive(st); derOthers(); persist(); $("pname").value = proj.name; renderTabs(); renderPanel(); renderSel("side", null); }
  $("undo").onclick = undo;
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && !/INPUT|SELECT/.test(document.activeElement.tagName)) {
      if (side.sel) side.o.del(side.sel); else if (top.sel) top.o.del(top.sel);
    }
  });
  let pendingConfirm = null;
  function ask(text, fn) { $("confirmText").textContent = text; $("confirmBox").hidden = false; pendingConfirm = fn; }
  $("confirmNo").onclick = () => { $("confirmBox").hidden = true; pendingConfirm = null; };
  $("confirmYes").onclick = () => { $("confirmBox").hidden = true; const f = pendingConfirm; pendingConfirm = null; if (f) f(); };
  $("reset").onclick = () => ask(`Riportare «${st.name}» alla forma originale? (puoi ancora usare Annulla)`, () => {
    pushHist(); proj.pieces[proj.cur] = clone(DEF.pieces[proj.cur]); selectPiece(proj.cur); status("Forma originale ripristinata.");
  });
  $("copyBtn").onclick = () => {
    const k = $("copyFrom").value; if (!k) return;
    ask(`Copiare in «${st.name}» la forma di «${proj.pieces[k].name}»?`, () => {
      pushHist(); const src = clone(proj.pieces[k]);
      Object.assign(st, { v: src.v, axis: src.axis, top: src.top, rings: src.rings, n: src.n });
      selectPiece(proj.cur); status(`Forma copiata da «${src.name}».`);
    });
  };

  function status(t) { $("status").textContent = t; }
  const slug = (t) => (t || "renna").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "renna";
  let dl = null; const dlReady = (window.claude && window.claude.use) ? window.claude.use("downloads").then(x => { dl = x; return x; }).catch(() => null) : Promise.resolve(null);
  async function offer(filename, data) {
    await dlReady;
    if (!dl) {   // fuori da claude.ai (es. sul tuo PC): download normale del browser
      try {
        const blob = data instanceof Blob ? data : new Blob([data], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob), a = document.createElement("a");
        a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        status(`${filename} scaricato.`); return true;
      } catch (e) { status("Non è stato possibile salvare il file."); return false; }
    }
    try { await dl.save({ filename, data }); status(`${filename} pronto.`); return true; }
    catch (err) {
      const c = err && err.code;
      if (c === "declined") status("Salvataggio annullato.");
      else if (c === "rate_limited") status("C'è già una richiesta di salvataggio aperta: chiudila e riprova.");
      else status("Non è stato possibile salvare il file qui.");
      return false;
    }
  }
  $("save").onclick = () => { proj.name = $("pname").value.trim() || "renna"; offer(`${slug(proj.name)}.json`, JSON.stringify(Object.assign({}, proj, { snapshots: snaps }), null, 1)); };

  // ------------------------------------------------ punti salvati
  const SNAPKEY = "renna-punti-v1";
  let snaps = [];
  try { const s = localStorage.getItem(SNAPKEY); if (s) snaps = JSON.parse(s) || []; } catch (e) {}
  const saveSnaps = () => { try { localStorage.setItem(SNAPKEY, JSON.stringify(snaps)); } catch (e) {} };
  const fmt = (t) => { const d = new Date(t); const p = (n) => String(n).padStart(2, "0"); return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  function renderSnaps() {
    const ul = $("snapList"); ul.innerHTML = "";
    if (!snaps.length) { const li = document.createElement("li"); li.innerHTML = '<span class="empty">Nessun punto salvato. Dai un nome alla forma attuale e premi «Salva punto»: potrai tornarci quando vuoi.</span>'; li.style.gridTemplateColumns = "1fr"; ul.appendChild(li); return; }
    snaps.slice().sort((a, b) => b.t - a.t).forEach(sn => {
      const li = document.createElement("li");
      const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = sn.name;
      const tm = document.createElement("span"); tm.className = "tm"; tm.textContent = fmt(sn.t); nm.appendChild(tm);
      const b1 = document.createElement("button"); b1.type = "button"; b1.textContent = "Ripristina";
      const b2 = document.createElement("button"); b2.type = "button"; b2.textContent = "Elimina";
      b1.onclick = () => ask(`Tornare al punto «${sn.name}»? Se ci ripensi, Annulla ti riporta allo stato di adesso.`, () => {
        const o = RC.migrate(JSON.parse(sn.data)); if (!o) { status("Questo punto non si può aprire."); return; }
        RC.ORDER.forEach(k => { if (!o.pieces[k]) o.pieces[k] = clone(DEF.pieces[k]); });
        pushHist(); proj = o; $("pname").value = proj.name; selectPiece(proj.pieces[proj.cur] ? proj.cur : "corpo");
        status(`Tornato al punto «${sn.name}».`);
      });
      b2.onclick = () => ask(`Eliminare il punto «${sn.name}»?`, () => { snaps = snaps.filter(x => x.id !== sn.id); saveSnaps(); renderSnaps(); status("Punto eliminato."); });
      li.append(nm, b1, b2); ul.appendChild(li);
    });
  }
  $("snapForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("snapName").value.trim() || `Prova ${snaps.length + 1}`;
    snaps.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, t: Date.now(), data: JSON.stringify(proj) });
    saveSnaps(); renderSnaps(); $("snapName").value = ""; status(`Punto «${name}» salvato.`);
  });
  renderSnaps();
  $("load").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const parsed = JSON.parse(await f.text()); const fileSnaps = Array.isArray(parsed && parsed.snapshots) ? parsed.snapshots : [];
      if (parsed) delete parsed.snapshots;
      const o = RC.migrate(parsed); if (!o) throw 0;
      fileSnaps.forEach(sn => { if (sn && sn.id && sn.data && !snaps.some(x => x.id === sn.id)) snaps.push(sn); }); saveSnaps(); renderSnaps();
      RC.ORDER.forEach(k => { if (!o.pieces[k]) o.pieces[k] = clone(DEF.pieces[k]); });
      if (!o.name) o.name = f.name.replace(/\.json$/i, "");
      pushHist(); proj = o; $("pname").value = proj.name; selectPiece(proj.pieces[proj.cur] ? proj.cur : "corpo");
      status(`Progetto «${proj.name}» aperto.`);
    } catch (err) { status("Il file non è un progetto della renna valido."); }
    e.target.value = "";
  };
  $("pdf").onclick = async () => {
    if (!window.jspdf) { status("Il generatore di PDF non si è caricato: ricarica la pagina."); return; }
    status("Preparo il PDF…");
    await new Promise(r => setTimeout(r, 30));
    try {
      const { doc, pages } = RC.makePdf(window.jspdf.jsPDF, st);
      const ok = await offer(`${slug(proj.name)}_${slug(st.name)}.pdf`, doc.output("blob"));
      if (ok) status(`PDF di ${pages} pagine pronto. Stampalo al 100% e controlla la barra da 5 cm.`);
    } catch (err) { status("Non riesco a creare il PDF: " + (err.message || err)); }
  };

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener && mq.addEventListener("change", drawAll);
  new MutationObserver(drawAll).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  renderTabs(); renderPanel(); renderSel("side", null);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawAll);
})();
