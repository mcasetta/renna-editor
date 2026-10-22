/* Renna – geometria dei pezzi "a croce" e generatore PDF (misure in cm).
   Ogni pezzo: anello laterale (profilo di lato), asse della croce (polilinea nel piano laterale),
   secondo anello (perpendicolare, disteso lungo l'asse), anelli trasversali. */
(function (root) {
  "use strict";

  // ---------------------------------------------------------- curve
  function catmull(P, closed, n, alpha) {
    n = n || 24; alpha = alpha == null ? 0.5 : alpha;
    let Q;
    if (closed) Q = [P[P.length - 1], ...P, P[0], P[1]];
    else Q = [[2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]], ...P,
              [2 * P[P.length - 1][0] - P[P.length - 2][0], 2 * P[P.length - 1][1] - P[P.length - 2][1]]];
    const out = [];
    const d = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let i = 1; i < Q.length - 2; i++) {
      const p0 = Q[i - 1], p1 = Q[i], p2 = Q[i + 1], p3 = Q[i + 2];
      const t0 = 0, t1 = t0 + Math.pow(d(p0, p1), alpha) + 1e-9;
      const t2 = t1 + Math.pow(d(p1, p2), alpha) + 1e-9, t3 = t2 + Math.pow(d(p2, p3), alpha) + 1e-9;
      for (let k = 0; k < n; k++) {
        const t = t1 + (t2 - t1) * k / n;
        const L = (a, b, ta, tb) => [(tb - t) / (tb - ta) * a[0] + (t - ta) / (tb - ta) * b[0],
                                     (tb - t) / (tb - ta) * a[1] + (t - ta) / (tb - ta) * b[1]];
        const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
        const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
        out.push(L(B1, B2, t1, t2));
      }
    }
    out.push(closed ? out[0].slice() : Q[Q.length - 2].slice());
    return out;
  }
  function length(c) { let s = 0; for (let i = 1; i < c.length; i++) s += Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]); return s; }
  function cut(c, axis, v) {
    const o = 1 - axis, res = [];
    for (let i = 1; i < c.length; i++) {
      const a = c[i - 1], b = c[i];
      if ((a[axis] - v) * (b[axis] - v) <= 0 && a[axis] !== b[axis]) {
        const t = (v - a[axis]) / (b[axis] - a[axis]);
        const val = a[o] + t * (b[o] - a[o]);
        if (!res.some(r => Math.abs(r - val) < 0.3)) res.push(val);
      }
    }
    return res.sort((p, q) => p - q);
  }
  function rotateTo(c, idx) { const cc = c.slice(0, -1); const r = cc.slice(idx).concat(cc.slice(0, idx)); r.push(r[0].slice()); return r; }
  function area(c) { let a = 0; for (let i = 1; i < c.length; i++) a += c[i - 1][0] * c[i][1] - c[i][0] * c[i - 1][1]; return a / 2; }
  function lineCut(c, p, d) {
    const res = [];
    for (let i = 1; i < c.length; i++) {
      const a = c[i - 1], b = c[i];
      const ex = b[0] - a[0], ey = b[1] - a[1];
      const den = d[0] * ey - d[1] * ex;
      if (Math.abs(den) < 1e-12) continue;
      const qx = a[0] - p[0], qy = a[1] - p[1];
      const u = (qx * ey - qy * ex) / den;
      const t = (qx * d[1] - qy * d[0]) / den;
      if (t >= 0 && t <= 1 && !res.some(r => Math.abs(r - u) < 0.3)) res.push(u);
    }
    return res.sort((p1, q1) => p1 - q1);
  }
  function ringCurve(ut, ub, w, n) {
    const e = 2 / n, pts = [], N = 240;
    for (let k = 0; k <= N; k++) {
      const t = -Math.PI / 2 + 2 * Math.PI * k / N;
      const c = Math.cos(t), s = Math.sin(t);
      pts.push([w * Math.sign(c) * Math.pow(Math.abs(c), e), (s >= 0 ? ut : ub) * Math.sign(s) * Math.pow(Math.abs(s), e)]);
    }
    pts[N] = pts[0].slice();
    return pts;
  }

  // ---------------------------------------------------------- asse
  function axisInfo(A) {
    const cum = [0];
    for (let i = 1; i < A.length; i++) cum.push(cum[i - 1] + Math.hypot(A[i][0] - A[i - 1][0], A[i][1] - A[i - 1][1]));
    return { A, cum, L: cum[cum.length - 1] };
  }
  function axisAt(ax, s) {   // punto e tangente alla lunghezza s
    const { A, cum } = ax;
    let i = 1; while (i < A.length - 1 && cum[i] < s) i++;
    const a = A[i - 1], b = A[i], l = cum[i] - cum[i - 1] || 1;
    const t = (s - cum[i - 1]) / l;
    const tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l;
    return { p: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], t: [tx, ty] };
  }
  function axisCross(ax, V) {   // valori s in cui l'asse attraversa il profilo
    const res = [];
    for (let i = 1; i < ax.A.length; i++) {
      const a = ax.A[i - 1], b = ax.A[i], l = ax.cum[i] - ax.cum[i - 1];
      if (l < 1e-9) continue;
      const d = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
      lineCut(V, a, d).forEach(u => { if (u >= -1e-6 && u <= l + 1e-6) { const s = ax.cum[i - 1] + u; if (!res.some(r => Math.abs(r - s) < 0.3)) res.push(s); } });
    }
    return res.sort((p, q) => p - q);
  }
  function axisProject(ax, x, y) {   // s del punto dell'asse più vicino
    let best = 0, bd = 1e9;
    for (let i = 1; i < ax.A.length; i++) {
      const a = ax.A[i - 1], b = ax.A[i], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L));
      const d = Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y);
      if (d < bd) { bd = d; best = ax.cum[i - 1] + t * Math.sqrt(L); }
    }
    return { s: best, d: bd };
  }
  function sideLabels(nrm) {
    if (Math.abs(nrm[1]) >= Math.abs(nrm[0])) return nrm[1] > 0 ? ["SOPRA", "SOTTO"] : ["SOTTO", "SOPRA"];
    return nrm[0] > 0 ? ["DIETRO", "DAVANTI"] : ["DAVANTI", "DIETRO"];
  }

  function nearestOnCurve(c, x, y) {
    let best = null, bd = 1e9;
    for (let i = 1; i < c.length; i++) {
      const a = c[i - 1], b = c[i], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L));
      const px = a[0] + t * dx, py = a[1] + t * dy, d = Math.hypot(px - x, py - y);
      if (d < bd) { bd = d; best = [px, py]; }
    }
    return best;
  }
  // punti di contatto di un anello dati posizione s lungo l'asse e inclinazione a
  function ringFromSA(V, ax, s0, s, a) {
    const at = axisAt(ax, s0 + s), nrm = [-at.t[1], at.t[0]];
    const th = (a || 0) * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
    const d = [nrm[0] * cs + nrm[1] * sn, -nrm[0] * sn + nrm[1] * cs];
    const us = lineCut(V, at.p, d);
    const up = us.filter(u => u > 0), dn = us.filter(u => u < 0);
    if (!up.length || !dn.length) return null;
    const ut = Math.min(...up), ub = -Math.max(...dn);
    return { p1: [+(at.p[0] + d[0] * ut).toFixed(2), +(at.p[1] + d[1] * ut).toFixed(2)],
             p2: [+(at.p[0] - d[0] * ub).toFixed(2), +(at.p[1] - d[1] * ub).toFixed(2)] };
  }

  const TYPES = {
    corpo: { loopA: "Anello verticale", loopB: "Anello orizzontale", bView: "dall'alto", cross: ["petto", "groppa"],
             sLabel: "s (cm dal petto)", bHint: "corpo visto dall'alto" },
    zampa: { loopA: "Anello laterale", loopB: "Anello frontale", bView: "di fronte, distesa", cross: ["cima", "zoccolo"],
             sLabel: "s (cm dalla cima)", bHint: "zampa vista di fronte, distesa" },
    testa: { loopA: "Anello laterale", loopB: "Anello frontale", bView: "di fronte, disteso", cross: ["base del collo", "naso"],
             sLabel: "s (cm dalla base del collo)", bHint: "collo e testa visti di fronte, distesi" },
  };

  // ---------------------------------------------------------- derivazione
  function normPiece(p) {
    p.rings = (p.rings || []).map(r => { if (typeof r === "number") return { s: r, a: 0 }; if (r.p1 && r.p2) return r; if (r.s == null && r.x != null) r.s = +r.x; r.s = +r.s; r.a = +(r.a || 0); delete r.x; return r; });
    if (typeof p.n !== "number") p.n = 2.3;
    if (typeof p.zoff !== "number") p.zoff = 0;
    if (!p.type) p.type = "corpo";
    return p;
  }
  function derive(st) {
    normPiece(st);
    const warn = [], ty = TYPES[st.type] || TYPES.corpo;
    let V = catmull(st.v, true);
    const ax = axisInfo(st.axis);
    // inizio del filo: punto del profilo più lontano dall'asse, verso il "basso" della normale (nascosto)
    const cr = axisCross(ax, V);
    if (cr.length < 2) {
      warn.push("L'asse della croce deve attraversare il profilo da parte a parte: allungalo o spostalo.");
      return { V, H: null, rings: [], warn, ok: false, ax, ty };
    }
    if (cr.length > 2) warn.push("L'asse della croce taglia il profilo in più di due punti: controlla la forma.");
    const s0 = cr[0], s1 = cr[cr.length - 1], S = s1 - s0;
    const mid = axisAt(ax, s0 + S / 2), nm = [-mid.t[1], mid.t[0]];
    let best = 0, bd = -1e9;
    for (let i = 0; i < V.length - 1; i++) { const q = V[i]; const dd = -((q[0] - mid.p[0]) * nm[0] + (q[1] - mid.p[1]) * nm[1]) - 0.15 * Math.hypot(q[0] - mid.p[0], q[1] - mid.p[1]); if (dd > bd) { bd = dd; best = i; } }
    if (st.type === "zampa") { best = 0; for (let i = 1; i < V.length - 1; i++) if (V[i][1] > V[best][1]) best = i; }
    if (st.type === "testa") { best = 0; for (let i = 1; i < V.length - 1; i++) if (V[i][1] < V[best][1]) best = i; }
    V = rotateTo(V, best);
    // secondo anello in coordinate (s, z)
    const inner = st.top.filter(p => p[0] > 0.2 && p[0] < S - 0.2).sort((a, b) => a[0] - b[0]);
    const pts = [[0, 0], ...inner.map(p => [p[0], Math.max(0.3, p[1])]), [S, 0],
                 ...inner.slice().reverse().map(p => [p[0], -Math.max(0.3, p[1])])];
    let H = catmull(pts, true);
    let hb = 0, hd = 1e9;
    for (let i = 0; i < H.length - 1; i++) if (H[i][1] > 0) { const dd = Math.abs(H[i][0] - S / 2); if (dd < hd) { hd = dd; hb = i; } }
    H = rotateTo(H, hb);
    // pieghe dell'asse fra le due croci
    const bends = [];
    for (let i = 1; i < ax.A.length - 1; i++) {
      const s = ax.cum[i] - s0; if (s <= 0.5 || s >= S - 0.5) continue;
      const a = ax.A[i - 1], b = ax.A[i], c = ax.A[i + 1];
      const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]), a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
      let da = (a2 - a1) * 180 / Math.PI; while (da > 180) da -= 360; while (da < -180) da += 360;
      if (Math.abs(da) >= 1) bends.push({ s, deg: da, p: b });
    }
    const raw = [];
    st.rings.forEach((rg) => {
      if (!rg.p1 || !rg.p2) {   // vecchio formato (s, a): converti in due punti di contatto
        const q = ringFromSA(V, ax, s0, rg.s, rg.a);
        if (q) { rg.p1 = q.p1; rg.p2 = q.p2; }
        else {   // non convertibile: lo lascio sull'asse dov'era, da sistemare a mano o togliere
          const at = axisAt(ax, s0 + Math.max(0, Math.min(S, rg.s || 0))).p;
          rg.p1 = [+at[0].toFixed(2), +(at[1] + 0.5).toFixed(2)]; rg.p2 = [+at[0].toFixed(2), +(at[1] - 0.5).toFixed(2)];
          raw.push({ rg, bad: "non sono riuscito a convertirlo dal vecchio formato: trascina i suoi punti sul profilo o toglilo." });
          delete rg.s; delete rg.a; return;
        }
        delete rg.s; delete rg.a;
      }
      const q1 = nearestOnCurve(V, rg.p1[0], rg.p1[1]), q2 = nearestOnCurve(V, rg.p2[0], rg.p2[1]);
      const L12 = Math.hypot(q1[0] - q2[0], q1[1] - q2[1]);
      if (L12 < 1) { raw.push({ rg, bad: "I due punti di contatto sono troppo vicini." }); return; }
      const e = [(q1[0] - q2[0]) / L12, (q1[1] - q2[1]) / L12];
      const us = lineCut(ax.A, q2, e).filter(u => u > 0.2 && u < L12 - 0.2);
      if (!us.length) { raw.push({ rg, bad: "la linea fra i due punti non attraversa l'asse blu." }); return; }
      const c = [q2[0] + e[0] * us[0], q2[1] + e[1] * us[0]];
      const s = axisProject(ax, c[0], c[1]).s - s0;
      if (s <= 0.3 || s >= S - 0.3) { raw.push({ rg, bad: "attraversa l'asse fuori dal pezzo." }); return; }
      const at = axisAt(ax, s0 + s), nrm = [-at.t[1], at.t[0]];
      let top = q1, bot = q2;
      if ((q1[0] - c[0]) * nrm[0] + (q1[1] - c[1]) * nrm[1] < 0) { top = q2; bot = q1; }
      const ut = Math.hypot(top[0] - c[0], top[1] - c[1]), ub = Math.hypot(bot[0] - c[0], bot[1] - c[1]);
      const d = [(top[0] - c[0]) / ut, (top[1] - c[1]) / ut];
      let ang = (Math.atan2(nrm[1], nrm[0]) - Math.atan2(d[1], d[0])) * 180 / Math.PI;
      while (ang > 180) ang -= 360; while (ang < -180) ang += 360;
      const zs = cut(H, 0, s);
      if (zs.length < 2) { raw.push({ rg, bad: "esce dall'anello " + (ty.loopB || "").toLowerCase() + "." }); return; }
      const w = (zs[zs.length - 1] - zs[0]) / 2;
      const curve = ringCurve(ut, ub, w, st.n);
      raw.push({ rg, s, a: Math.round(ang), c, d, ut, ub, w, pt: top, pb: bot, topKey: top === q1 ? "p1" : "p2",
                 lab: sideLabels(nrm), curve, L: length(curve) });
    });
    raw.sort((p, q) => (p.s == null ? 1e9 : p.s) - (q.s == null ? 1e9 : q.s));
    const rings = [];
    raw.forEach((r, i) => { r.n = "A" + (i + 1); if (r.bad) warn.push(`Anello ${r.n}: ${r.bad}`); else rings.push(r); });
    const ringOf = (rg) => raw.find(r => r.rg === rg);
    const LV = length(V), LH = length(H);
    const tot = LV + LH + rings.reduce((s, r) => s + r.L, 0) + 5 * (2 + rings.length);
    const c0 = axisAt(ax, s0).p, c1 = axisAt(ax, s1).p;
    // posizione 3D di un punto (s, z) del secondo anello
    const toWorldB = (s, z) => { const q = axisAt(ax, s0 + s).p; return [q[0], q[1], z + st.zoff]; };
    return { V, H, S, s0, c0, c1, bends, rings, ringOf, LV, LH, tot, warn, ok: true, ax, ty, toWorldB };
  }

  // ---------------------------------------------------------- pelle (solo per la vista 3D)
  // anelli finti fitti lungo l'asse, calcolati come quelli veri (profilo + secondo anello);
  // l'inclinazione segue quella degli anelli veri vicini. Ritorna una griglia di punti 3D:
  // rows[i][k] = punto k (su M) dell'anello i; la prima e l'ultima riga sono i due incroci.
  function skin(st, D, step, M) {
    if (!D || !D.ok) return null;
    step = step || 1.2; M = M || 36;
    const e = 2 / st.n, R = D.rings, z0 = st.zoff;
    const angAt = (s) => {
      if (!R.length) return 0; if (s <= R[0].s) return R[0].a; if (s >= R[R.length - 1].s) return R[R.length - 1].a;
      for (let i = 1; i < R.length; i++) if (s <= R[i].s) { const t = (s - R[i - 1].s) / (R[i].s - R[i - 1].s || 1); return R[i - 1].a + t * (R[i].a - R[i - 1].a); }
      return 0;
    };
    const cs = [], sn = [];
    for (let k = 0; k < M; k++) { const t = -Math.PI / 2 + 2 * Math.PI * k / M; cs.push(Math.cos(t)); sn.push(Math.sin(t)); }
    const pw = (v) => Math.sign(v) * Math.pow(Math.abs(v), e);
    const rows = [Array(M).fill([D.c0[0], D.c0[1], z0])];
    const n = Math.max(2, Math.round(D.S / step));
    for (let i = 1; i < n; i++) {
      const s = D.S * i / n, at = axisAt(D.ax, D.s0 + s), nrm = [-at.t[1], at.t[0]];
      const th = angAt(s) * Math.PI / 180, c = Math.cos(th), si = Math.sin(th);
      const d = [nrm[0] * c + nrm[1] * si, -nrm[0] * si + nrm[1] * c];
      const us = lineCut(D.V, at.p, d), up = us.filter(u => u > 0), dn = us.filter(u => u < 0);
      const zs = cut(D.H, 0, s);
      if (!up.length || !dn.length || zs.length < 2) continue;
      const ut = Math.min(...up), ub = -Math.max(...dn), zc = (zs[0] + zs[zs.length - 1]) / 2, w = (zs[zs.length - 1] - zs[0]) / 2;
      const row = [];
      for (let k = 0; k < M; k++) { const u = (sn[k] >= 0 ? ut : ub) * pw(sn[k]); row.push([at.p[0] + u * d[0], at.p[1] + u * d[1], zc + w * pw(cs[k]) + z0]); }
      rows.push(row);
    }
    rows.push(Array(M).fill([D.c1[0], D.c1[1], z0]));
    return rows;
  }

  // ---------------------------------------------------------- pezzi di partenza
  function bodyFromX(v, yh, topX, ringsX, n) {
    const xs = v.map(p => p[0]);
    const p = { name: "Corpo", type: "corpo", v, axis: [[Math.min(...xs) - 8, yh], [Math.max(...xs) + 8, yh]], top: [], rings: [], n: n || 2.3, zoff: 0 };
    const V = catmull(v, true); const hx = cut(V, 1, yh); const XF = hx.length ? hx[0] : Math.min(...xs);
    p.top = topX.map(q => [+(q[0] - XF).toFixed(2), q[1]]);
    p.rings = ringsX.map(r => typeof r === "number" ? { s: +(r - XF).toFixed(2), a: 0 } : { s: +((r.x != null ? r.x : r.s) - XF).toFixed(2), a: r.a || 0 });
    return p;
  }
  function legFrom(name, v, axis, wTop, ringFr, zoff) {
    const p = { name, type: "zampa", v, axis, top: [], rings: [], n: 2.2, zoff };
    const V = catmull(v, true), ax = axisInfo(axis), cr = axisCross(ax, V);
    const S = cr.length >= 2 ? cr[cr.length - 1] - cr[0] : 50;
    const fr = [0.04, 0.16, 0.32, 0.5, 0.68, 0.84, 0.95];
    p.top = fr.map((f, i) => [+(f * S).toFixed(1), wTop[i]]);
    p.rings = ringFr.map(f => ({ s: +(f * S).toFixed(1), a: 0 }));
    return p;
  }
  const BODY_V = [[40, 34.9], [50, 35.6], [58, 37.2], [64.5, 40.5], [68.0, 46.0], [67.6, 51.2], [64.0, 54.6],
    [56, 55.4], [46, 55.0], [37, 55.6], [29.5, 57.0], [23.5, 54.6], [19.6, 49.5], [19.0, 43.5], [22.0, 38.6], [29, 35.6]];
  const BODY_TOPX = [[19.5, 3.2], [22, 6.0], [26, 7.6], [32, 8.6], [40, 9.4], [48, 9.6], [56, 9.1], [62, 8.0], [65.5, 6.0], [67.2, 3.2]];
  function defaultProject() {
    const F = [3.4, 3.2, 2.5, 2.0, 1.8, 1.7, 1.9], Hh = [4.4, 4.2, 3.2, 2.3, 1.9, 1.7, 1.9];
    const RF = [0.12, 0.27, 0.42, 0.57, 0.72, 0.87];
    return {
      name: "renna", cur: "corpo",
      pieces: {
        corpo: bodyFromX(BODY_V, 45, BODY_TOPX, [24, 31, 38, 45, 52, 59, 64]),
        AS: legFrom("Zampa anteriore sinistra", [[20.2, 45.3], [20.7, 40.4], [21.1, 35.4], [21.1, 30.5], [20.8, 25.5], [20.1, 20.6], [19.6, 15.7], [19.2, 10.7], [18.6, 5.8], [18.6, 1.2], [19.6, 0], [21.4, 0], [22.1, 1.6], [22.5, 7.0], [23.2, 11.9], [24.0, 16.8], [25.0, 21.7], [26.2, 26.5], [27.3, 31.3], [28.4, 36.2], [29.6, 41.0], [30.3, 45.9], [27.4, 49.6], [22.7, 49.4]],
          [[25.4, 53], [22.4, 21], [20.4, -2]], F, RF, -6),
        AD: legFrom("Zampa anteriore destra", [[22.1, 44.6], [23.2, 39.7], [24.5, 35.0], [26.1, 30.2], [27.7, 25.5], [29.1, 20.7], [30.1, 15.9], [30.8, 10.9], [31.2, 6.0], [31.6, 1.2], [32.5, 0], [34.4, 0], [35.1, 1.6], [34.9, 6.9], [34.5, 11.9], [34.2, 16.9], [33.6, 21.8], [32.6, 26.7], [31.9, 31.6], [31.6, 36.6], [31.9, 41.5], [32.1, 46.5], [28.7, 49.9], [24.0, 49.0]],
          [[26.8, 53], [31.4, 21], [33.4, -2]], F, RF, 6),
        PS: legFrom("Zampa posteriore sinistra", [[53.0, 43.2], [54.8, 38.3], [56.9, 33.5], [59.4, 29.0], [61.8, 24.4], [63.7, 19.5], [64.8, 14.4], [65.6, 9.3], [66.0, 4.1], [66.6, 0.6], [67.8, 0], [69.4, 0.3], [70.0, 4.4], [69.2, 9.5], [68.8, 14.7], [68.4, 19.9], [67.4, 25.0], [66.0, 30.0], [65.5, 35.2], [65.9, 40.4], [66.5, 45.6], [63.6, 49.7], [58.6, 50.8], [54.3, 48.1]],
          [[59.4, 53], [60.4, 37], [65.6, 22], [68.2, -2]], Hh, RF, -6),
        PD: legFrom("Zampa posteriore destra", [[50.7, 44.9], [51.2, 39.8], [52.2, 34.7], [53.7, 29.8], [55.4, 24.9], [56.1, 19.8], [55.7, 14.7], [55.0, 9.6], [54.1, 4.5], [54.3, 0.8], [55.4, 0], [57.2, 0.2], [57.9, 3.8], [58.6, 8.9], [59.5, 14.0], [60.7, 19.0], [61.0, 24.2], [60.3, 29.3], [60.9, 34.4], [62.7, 39.2], [64.4, 44.0], [62.5, 48.7], [57.9, 50.9], [53.1, 49.3]],
          [[57.4, 53], [56.6, 37], [58.4, 22.5], [56.2, -2]], Hh, RF, 6),
        testa: { name: "Collo e testa", type: "testa", n: 2.3, zoff: 0,
          v: [[31, 50.5], [30, 55.5], [27.2, 61.5], [23.6, 68.5], [20.4, 74.6], [16, 78.2], [11, 76.8], [5, 73.2], [1.8, 71.4], [1.3, 69.9],
              [4, 68.5], [9, 67.4], [12.6, 65], [14.4, 58], [16.6, 51], [19.6, 46], [24.5, 45.2]],
          axis: [[27.6, 42.5], [21.6, 60], [16.8, 70.6], [6, 71.6], [-2, 71.2]],
          top: [[1.5, 6.2], [8, 5.8], [16, 4.8], [22, 4.3], [28.5, 4.6], [33, 3.8], [37, 2.8], [40, 1.8]],
          rings: [4, 10, 15.5, 20.5, 31, 35, 38.5].map(s => ({ s, a: 0 })) },
      },
    };
  }
  const ORDER = ["corpo", "testa", "AS", "AD", "PS", "PD"];
  // converte un salvataggio vecchio (solo corpo, coordinate x) nel formato a pezzi
  function migrate(o) {
    if (o && o.pieces) { Object.values(o.pieces).forEach(normPiece); return o; }
    if (o && Array.isArray(o.v) && typeof o.yh === "number") {
      const pr = defaultProject();
      pr.pieces.corpo = bodyFromX(o.v, o.yh, o.top, o.rings, o.n);
      return pr;
    }
    if (o && Array.isArray(o.v) && Array.isArray(o.axis)) {   // un singolo pezzo nuovo formato
      const pr = defaultProject(); const k = o.type === "zampa" ? (o.key || "AS") : o.type === "testa" ? "testa" : "corpo";
      pr.pieces[k] = normPiece(o); pr.cur = k; return pr;
    }
    return null;
  }

  // ---------------------------------------------------------- PDF
  const MM = 10, PM = 8, PHEAD = 13, OV = 1.0;
  const C = { ink: [25, 25, 25], grid: [205, 205, 205], grid5: [158, 158, 158], shade: [237, 237, 237],
              wire: [38, 38, 38], horiz: [26, 89, 204], ring: [209, 31, 31], purple: [128, 38, 166],
              green: [13, 140, 64], faint: [180, 180, 180], light: [255, 179, 179], bend: [220, 120, 0] };

  // punti della curva chiusa a distanza massima `step` (così nessun tratto sfugge al controllo dei fogli)
  function densify(c, step) {
    const out = [];
    for (let i = 1; i < c.length; i++) {
      const a = c[i - 1], b = c[i], k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
      for (let j = 0; j < k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]);
    }
    return out;   // senza ripetere il primo punto in fondo
  }
  const GAP = 1.0;   // cm di curva che si possono lasciare fuori dai fogli (si raccordano a mano)
  // tratto scoperto più lungo e totale scoperto, sulla curva chiusa P (len[i] = lunghezza del tratto i→i+1)
  function gaps(cnt, len) {
    const n = cnt.length; let i0 = cnt.findIndex(c => c > 0);
    if (i0 < 0) return { max: 1e9, tot: 1e9 };
    let max = 0, tot = 0, run = 0;
    for (let k = 1; k <= n; k++) {
      const i = (i0 + k) % n;
      if (cnt[i] === 0) { run += len[(i - 1 + n) % n]; tot += len[(i - 1 + n) % n]; }
      else if (run) { run += len[(i - 1 + n) % n]; tot += len[(i - 1 + n) % n]; max = Math.max(max, run); run = 0; }
    }
    return { max, tot };
  }
  function planTiles(curve, extra) {
    extra = extra == null ? 0.7 : extra;
    const P = densify(curve, 0.2), n = P.length;
    const len = P.map((p, i) => { const q = P[(i + 1) % n]; return Math.hypot(q[0] - p[0], q[1] - p[1]); });
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
    const mn = [Math.min(...xs) - extra, Math.min(...ys) - extra], mx = [Math.max(...xs) + extra, Math.max(...ys) + extra];
    const bw = mx[0] - mn[0], bh = mx[1] - mn[1];
    let best = null;
    for (const land of [false, true]) {
      const pw = land ? 297 : 210, ph = land ? 210 : 297;
      const uw = (pw - 2 * PM) / MM, uh = (ph - 2 * PM - PHEAD) / MM, sx = uw - OV, sy = uh - OV;
      const nc = Math.max(1, Math.ceil((bw - OV) / sx)) + 1, nr = Math.max(1, Math.ceil((bh - OV) / sy)) + 1;
      for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) {
        const fx = a / 10, fy = b / 10;
        const x0 = mn[0] - fx * (nc * sx + OV - bw), y0 = mn[1] - fy * (nr * sy + OV - bh);
        let tiles = []; const cnt = new Array(n).fill(0);
        for (let r = 0; r < nr; r++) for (let col = 0; col < nc; col++) {
          const tx = x0 + col * sx, ty = y0 + (nr - 1 - r) * sy, idx = [];
          P.forEach((p, i) => { if (p[0] >= tx + .3 && p[0] <= tx + uw - .3 && p[1] >= ty + .3 && p[1] <= ty + uh - .3) idx.push(i); });
          if (idx.length) { idx.forEach(i => cnt[i]++); tiles.push({ r, col, x0: tx, y0: ty, idx }); }
        }
        if (gaps(cnt, len).max > 1e-6) continue;
        // togli i fogli con solo un pezzetto di curva, se il buco che lasciano resta sotto GAP
        tiles.slice().sort((p, q) => p.idx.length - q.idx.length).forEach(t => {
          t.idx.forEach(i => cnt[i]--);
          if (gaps(cnt, len).max <= GAP) tiles = tiles.filter(q => q !== t); else t.idx.forEach(i => cnt[i]++);
        });
        const g = gaps(cnt, len);
        const score = tiles.length * 10 + g.tot * 2 + Math.abs(fx - .5) + Math.abs(fy - .5);
        if (!best || score < best.score) best = { score, land, uw, uh, tiles: tiles.map(({ idx, ...t }) => t), uncovered: g.tot, maxGap: g.max };
      }
    }
    return best;
  }

  function makePdf(jsPDF, st, opts) {
    opts = opts || {};
    const D = derive(st);
    if (!D.ok) throw new Error(D.warn[0]);
    const ty = D.ty, title = st.name || "Pezzo";
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    let PW = 210, PH = 297, page = 1, first = true;
    function newPage(land) { if (!first) doc.addPage("a4", land ? "landscape" : "portrait"); first = false; PW = land ? 297 : 210; PH = land ? 210 : 297; }
    const stroke = (k) => doc.setDrawColor(...C[k]), fill = (k) => doc.setFillColor(...C[k]), textc = (k) => doc.setTextColor(...C[k]);
    const font = (size, bold) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); };
    function header(t, sub) {
      font(12, true); textc("ink"); doc.text(t, PM, PM + 5);
      font(7.5, false); doc.text(sub, PM, PM + 9.5);
      const x0 = PW - PM - 50, y0 = PM + 9.5;
      stroke("ink"); doc.setLineWidth(0.42); doc.line(x0, y0, x0 + 50, y0);
      for (let i = 0; i <= 5; i++) doc.line(x0 + i * 10, y0, x0 + i * 10, y0 - (i % 5 ? 2.5 : 4));
      font(7, false); doc.text("controllo: questa barra = 5 cm", PW - PM, y0 - 5, { align: "right" });
    }
    function footer() { font(7, false); textc("ink"); doc.text(`${title} - pag. ${page}`, PW - PM, PH - 3, { align: "right" }); page++; }
    let T = null;
    const X = (x) => T.ox + (x - T.x0) * MM, Y = (y) => T.oy - (y - T.y0) * MM;
    function poly(c) { const d = []; for (let i = 1; i < c.length; i++) d.push([(c[i][0] - c[i - 1][0]) * MM, -(c[i][1] - c[i - 1][1]) * MM]); doc.lines(d, X(c[0][0]), Y(c[0][1]), [1, 1], "S", false); }
    function grid(x0, y0, w, h, lx, ly) {
      for (let g = Math.ceil(x0); g <= Math.floor(x0 + w); g++) {
        const major = g % 5 === 0; stroke(major ? "grid5" : "grid"); doc.setLineWidth(major ? 0.21 : 0.09);
        doc.line(X(g), Y(y0), X(g), Y(y0 + h));
        if (major && lx !== null) { font(5.5, false); textc("grid5"); doc.text(`${lx}${g}`, X(g) + 0.6, Y(y0) - 0.8); doc.text(`${lx}${g}`, X(g) + 0.6, Y(y0 + h) + 2.4); }
      }
      for (let g = Math.ceil(y0); g <= Math.floor(y0 + h); g++) {
        const major = g % 5 === 0; stroke(major ? "grid5" : "grid"); doc.setLineWidth(major ? 0.21 : 0.09);
        doc.line(X(x0), Y(g), X(x0 + w), Y(g));
        if (major) { font(5.5, false); textc("grid5"); doc.text(`${ly}${g}`, X(x0) + 0.7, Y(g) - 0.6); doc.text(`${ly}${g}`, X(x0 + w) - 0.7, Y(g) - 0.6, { align: "right" }); }
      }
    }
    function marker(x, y, k, label, dx, dy, square, size) {
      stroke(k); doc.setFillColor(255, 255, 255); doc.setLineWidth(0.5);
      if (square) doc.rect(X(x) - 1.6, Y(y) - 1.6, 3.2, 3.2, "FD"); else doc.circle(X(x), Y(y), 1.45, "FD");
      if (label) { font(size || 7, true); textc(k); doc.text(label, X(x) + (dx == null ? 2.2 : dx), Y(y) - (dy == null ? 1.5 : dy)); }
    }
    function ticks(c) {
      const seg = [0]; for (let i = 1; i < c.length; i++) seg.push(seg[i - 1] + Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]));
      const sgn = area(c) < 0 ? 1 : -1; stroke("ink"); doc.setLineWidth(0.32);
      for (let dd = 10; dd < seg[seg.length - 1]; dd += 10) {
        const i = seg.findIndex(s => s >= dd); if (i < 0) break;
        const p = c[i], a = c[Math.max(0, i - 2)], b = c[Math.min(c.length - 1, i + 2)];
        let tx = b[0] - a[0], tyy = b[1] - a[1]; const l = Math.hypot(tx, tyy); tx /= l; tyy /= l;
        const nx = sgn * tyy, ny = -sgn * tx;
        doc.line(X(p[0] - nx * .5), Y(p[1] - ny * .5), X(p[0] + nx * .9), Y(p[1] + ny * .9));
        if (dd % 20 === 0) { font(6.5, false); textc("ink"); doc.text(String(dd), X(p[0] + nx * 1.6), Y(p[1] + ny * 1.6) + 0.9, { align: "center" }); }
      }
    }
    function start(c, ldx, ldy) {
      const p0 = c[0], p1 = c[Math.min(16, c.length - 1)];
      marker(p0[0], p0[1], "green", "INIZIO / FINE", ldx == null ? 2.5 : ldx, ldy == null ? -4.2 : ldy, false, 7);
      let dx = p1[0] - p0[0], dy = p1[1] - p0[1]; const l = Math.hypot(dx, dy); dx /= l; dy /= l;
      const nx = -dy, ny = dx, s0 = [p0[0] + nx * 1.4, p0[1] + ny * 1.4], s1 = [s0[0] + dx * 3.5, s0[1] + dy * 3.5];
      stroke("green"); doc.setLineWidth(0.55); doc.line(X(s0[0]), Y(s0[1]), X(s1[0]), Y(s1[1]));
      for (const g of [1, -1]) { const e = [s1[0] - dx * .8 + nx * .45 * g, s1[1] - dy * .8 + ny * .45 * g]; doc.line(X(s1[0]), Y(s1[1]), X(e[0]), Y(e[1])); }
    }
    // 4 punti d'incrocio di un anello trasversale; +w è il fianco destro, come nel secondo anello
    function ringMarkers(r) {
      marker(0, r.ut, "purple", r.lab[0], 2, 2, true);
      marker(0, -r.ub, "purple", r.lab[1], 2, 3, true);
      marker(r.w, 0, "purple", "DES.", -8.5, 2.4, true);
      marker(-r.w, 0, "purple", "SIN.", 1.6, 2.4, true);
    }
    const layout = [];   // dove finiscono le sagome (per i test)
    function tiledPiece(name, sub, curve, wireKey, deco, lx, ly) {
      const plan = planTiles(curve);
      const keys = new Set(plan.tiles.map(t => t.r + "," + t.col));
      plan.tiles.forEach((t, i) => {
        newPage(plan.land);
        header(`${name} - foglio ${i + 1}/${plan.tiles.length}`, sub);
        const uw = plan.uw, uh = plan.uh;
        T = { x0: t.x0, y0: t.y0, ox: PM, oy: PM + PHEAD + uh * MM };
        doc.saveGraphicsState();
        doc.rect(PM, PM + PHEAD, uw * MM, uh * MM, null); doc.clip(); doc.discardPath();
        fill("shade");
        if (keys.has(t.r + "," + (t.col + 1))) doc.rect(PM + (uw - OV) * MM, PM + PHEAD, OV * MM, uh * MM, "F");
        if (keys.has((t.r - 1) + "," + t.col)) doc.rect(PM, PM + PHEAD, uw * MM, OV * MM, "F");
        grid(t.x0, t.y0, uw, uh, lx, ly);
        deco("under");
        stroke(wireKey); doc.setLineWidth(1.4); doc.setLineCap("round"); doc.setLineJoin("round");
        poly(curve); ticks(curve); start(curve);
        deco("over");
        doc.restoreGraphicsState(); doc.setLineCap("butt");
        stroke("faint"); doc.setLineWidth(0.15); doc.rect(PM, PM + PHEAD, uw * MM, uh * MM, "S");
        const xs = plan.tiles.map(q => q.x0), ys = plan.tiles.map(q => q.y0);
        const gx0 = Math.min(...xs), gy0 = Math.min(...ys), gw = Math.max(...xs) + uw - gx0, gh = Math.max(...ys) + uh - gy0;
        const sc = Math.min(10.5 / gh, 26 / gw), mx0 = PW - PM - 54 - gw * sc, myb = PM + 11.5;
        plan.tiles.forEach(q => {
          doc.setLineWidth(0.1); doc.setDrawColor(128, 128, 128);
          if (q === t) doc.setFillColor(255, 209, 209); else doc.setFillColor(255, 255, 255);
          doc.rect(mx0 + (q.x0 - gx0) * sc, myb - (q.y0 - gy0 + uh) * sc, uw * sc, uh * sc, "FD");
        });
        stroke(wireKey); doc.setLineWidth(0.2);
        const d = []; for (let k = 1; k < curve.length; k++) d.push([(curve[k][0] - curve[k - 1][0]) * sc, -(curve[k][1] - curve[k - 1][1]) * sc]);
        doc.lines(d, mx0 + (curve[0][0] - gx0) * sc, myb - (curve[0][1] - gy0) * sc, [1, 1], "S", false);
        if (plan.uncovered > 0.05) {
          font(7, false); textc("ink");
          doc.text(`Nota: ${plan.uncovered.toFixed(1)} cm di curva cadono fuori dai fogli (per risparmiare un foglio): raccordali a mano.`, PM, PH - 3);
        }
        footer();
      });
      layout.push({ name, kind: "fogli", sheets: plan.tiles.length, uncovered: plan.uncovered, maxGap: plan.maxGap });
      return plan.tiles.length;
    }

    const R = D.rings;
    const pv = planTiles(D.V).tiles.length, ph = planTiles(D.H).tiles.length;
    const P_V = 2, P_H = P_V + pv, P_R = P_H + ph;
    const ringPages = [], UW = 19.4, UH = 26.8, UHh = 26.4;
    // gli anelli che non stanno in un foglio verticale vanno su più fogli, come gli anelli grandi
    const fits = (r) => 2 * r.w + 0.1 <= UW && r.ut + r.ub + 3.6 <= UHh;
    const big = R.filter(r => !fits(r));
    { // impaginazione a scaffali: righe di anelli, più righe per pagina
      let cur = [], x = 0, yrow = 0, rowH = 0;
      R.filter(fits).forEach(r => {
        const w = Math.min(UW, 2 * r.w + 3.2), h = r.ut + r.ub + 3.6;
        if (x + w > UW && x > 0) { yrow += rowH; x = 0; rowH = 0; }
        if (yrow + h > UHh && cur.length) { ringPages.push(cur); cur = []; x = 0; yrow = 0; rowH = 0; }
        r.box = { x, y: yrow, w, h }; cur.push(r); x += w; rowH = Math.max(rowH, h);
      });
      if (cur.length) ringPages.push(cur);
    }
    ringPages.forEach((pg, i) => pg.forEach(r => { r.page = P_R + i; }));
    { let pg = P_R + ringPages.length; big.forEach(r => { r.page = pg; pg += planTiles(r.curve).tiles.length; }); }

    // ---------------- pagina 1: riepilogo
    newPage(false);
    header(`Renna in fil di ferro - ${title}`, "Sagome 1:1 su A4 - stampa al 100% (\"dimensioni effettive\")");
    const xs = D.V.map(p => p[0]), ysV = D.V.map(p => p[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ysV), maxy = Math.max(...ysV);
    const s = Math.min(0.24, 90 / ((maxy - miny) * MM), 190 / ((maxx - minx) * MM));
    T = { x0: minx, y0: miny, ox: PM + 4, oy: PM + PHEAD + 12 + (maxy - miny) * MM * s };
    const small = (c, k, w, dash) => {
      stroke(k); doc.setLineWidth(w); if (dash) doc.setLineDashPattern(dash, 0);
      const d = []; for (let i = 1; i < c.length; i++) d.push([(c[i][0] - c[i - 1][0]) * MM * s, -(c[i][1] - c[i - 1][1]) * MM * s]);
      doc.lines(d, T.ox + (c[0][0] - T.x0) * MM * s, T.oy - (c[0][1] - T.y0) * MM * s, [1, 1], "S", false);
      doc.setLineDashPattern([], 0);
    };
    font(9, true); textc("ink"); doc.text("Di lato", PM, PM + PHEAD + 6);
    small(D.V, "wire", 0.6);
    small(st.axis, "horiz", 0.3, [1.5, 1]);
    R.forEach(r => small([r.pb, r.pt], "ring", 0.4));
    font(6, true); textc("ring");
    R.forEach(r => doc.text(r.n, T.ox + (r.pt[0] - T.x0) * MM * s, T.oy - (r.pt[1] - T.y0) * MM * s - 1.5, { align: "center" }));
    const topY0 = T.oy + 16;
    font(9, true); textc("ink"); doc.text(`${ty.loopB} (${ty.bView})`, PM, topY0 - 4);
    const zs = D.H.map(p => p[1]); const minz = Math.min(...zs), maxz = Math.max(...zs);
    const s2 = Math.min(0.24, 190 / (D.S * MM));
    T = { x0: 0, y0: minz, ox: PM + 4, oy: topY0 + 2 + (maxz - minz) * MM * s2 };
    const small2 = (c, k, w, dash) => {
      stroke(k); doc.setLineWidth(w); if (dash) doc.setLineDashPattern(dash, 0);
      const d = []; for (let i = 1; i < c.length; i++) d.push([(c[i][0] - c[i - 1][0]) * MM * s2, -(c[i][1] - c[i - 1][1]) * MM * s2]);
      doc.lines(d, T.ox + (c[0][0] - T.x0) * MM * s2, T.oy - (c[0][1] - T.y0) * MM * s2, [1, 1], "S", false);
      doc.setLineDashPattern([], 0);
    };
    small2(D.H, "horiz", 0.6);
    small2([[-1, 0], [D.S + 1, 0]], "wire", 0.3, [1.5, 1]);
    R.forEach(r => small2([[r.s, -r.w], [r.s, r.w]], "ring", 0.4));
    D.bends.forEach(b => small2([[b.s, minz], [b.s, maxz]], "bend", 0.3, [1, 1]));
    let y = T.oy + 12;
    font(9.5, true); textc("ink"); doc.text(`I pezzi: ${title}`, PM, y); y += 5;
    const cols = [PM, PM + 70, PM + 88, PM + 112, PM + 142, PM + 172];
    font(7.6, true); ["Pezzo", "Quanti", "Filo (cm)", "Misure", "Posizione", "Pagine"].forEach((t, i) => doc.text(t, cols[i], y));
    font(7.6, false);
    const rows = [[`${ty.loopA} (di lato)`, "1", `${D.LV.toFixed(0)} + 5`, `${(maxy - miny).toFixed(0)} alto x ${(maxx - minx).toFixed(0)}`, "piano laterale", `${P_V}-${P_H - 1}`, "ink"],
                  [`${ty.loopB} (${ty.bView})`, "1", `${D.LH.toFixed(0)} + 5`, `${(maxz - minz).toFixed(0)} largo x ${D.S.toFixed(0)}`, "lungo l'asse", `${P_H}-${P_R - 1}`, "horiz"]];
    R.forEach(r => rows.push([`Anello trasversale ${r.n}`, "1", `${r.L.toFixed(0)} + 5`, `${(r.ut + r.ub).toFixed(1)} x ${(2 * r.w).toFixed(1)}`, `s${r.s.toFixed(1)}` + (r.a ? ` incl. ${r.a.toFixed(0)}°` : ""), String(r.page), "ring"]));
    rows.forEach(rw => { y += 4.2; textc(rw[6]); rw.slice(0, 6).forEach((t, i) => doc.text(t, cols[i], y)); });
    y += 7; font(8, true); textc("ink");
    doc.text(`Totale filo grosso per questo pezzo: circa ${(D.tot / 100).toFixed(1)} m (+10% di scorta)`, PM, y);
    if (st.type === "zampa") { y += 4.5; font(7.6, false); doc.text(`Distanza del piano della zampa dal centro della renna: ${Math.abs(st.zoff).toFixed(1)} cm verso il fianco ${st.zoff < 0 ? "sinistro" : "destro"}.`, PM, y); }
    y += 8; font(9, true); doc.text("Montaggio", PM, y); y += 4.5; font(8, false);
    const steps = [
      "1. Stampa al 100% e controlla la barra da 5 cm. Unisci i fogli di ogni anello sovrapponendo 1 cm (zona grigia) e facendo combaciare la griglia.",
      "2. Piega ogni anello partendo dal punto verde INIZIO e seguendo la freccia; le tacche ogni 10 cm ti dicono quanto filo hai gia' usato. Chiudi sovrapponendo i capi 3-4 cm e legando.",
      `3. La croce: il ${ty.loopB.toLowerCase()} si incrocia col ${ty.loopA.toLowerCase()} nei due punti viola INCROCIO (${ty.cross[0]} e ${ty.cross[1]}). Legali lì.`,
      ...(D.bends.length ? [`   Il ${ty.loopB.toLowerCase()} si piega prima piatto sul foglio, poi va curvato lungo le linee arancioni PIEGA, dell'angolo indicato, per seguire l'asse.`] : []),
      `4. Anelli trasversali: ognuno ha 4 punti viola. Quelli in alto e in basso nel suo disegno vanno sul ${ty.loopA.toLowerCase()}, SIN. e DES. sul ${ty.loopB.toLowerCase()}, nei punti rossi con lo stesso nome.`,
    ];
    steps.forEach(t => { doc.splitTextToSize(t, 194).forEach(l => { doc.text(l, PM, y); y += 3.8; }); y += 1; });
    footer();

    // ---------------- anello laterale
    tiledPiece(ty.loopA, `${title} - visto di lato - 1:1 - 1 pezzo - filo ${D.LV.toFixed(0)} + 5 cm - muso a sinistra`, D.V, "wire", (layer) => {
      if (layer === "under") {
        stroke("horiz"); doc.setLineWidth(0.35); doc.setLineDashPattern([1.8, 1], 0);
        for (let i = 1; i < st.axis.length; i++) doc.line(X(st.axis[i - 1][0]), Y(st.axis[i - 1][1]), X(st.axis[i][0]), Y(st.axis[i][1]));
        doc.setLineDashPattern([], 0);
        font(6.5, false); textc("horiz");
        const m = axisAt(D.ax, D.s0 + D.S * 0.5).p;
        doc.text(`asse della croce: qui passa il ${ty.loopB.toLowerCase()}`, X(m[0]) + 1.5, Y(m[1]) - 1.2);
        stroke("light"); doc.setLineWidth(0.28); doc.setLineDashPattern([0.7, 1], 0);
        R.forEach(r => doc.line(X(r.pb[0]), Y(r.pb[1]), X(r.pt[0]), Y(r.pt[1]))); doc.setLineDashPattern([], 0);
        return;
      }
      marker(D.c0[0], D.c0[1], "purple", `INCROCIO ${ty.cross[0]}`, 2.5, 2, true);
      marker(D.c1[0], D.c1[1], "purple", `INCROCIO ${ty.cross[1]}`, 2.5, 2, true);
      R.forEach(r => { marker(r.pt[0], r.pt[1], "ring", `${r.n} ${r.lab[0].toLowerCase()}`, 2, 2.4); marker(r.pb[0], r.pb[1], "ring", `${r.n} ${r.lab[1].toLowerCase()}`, 2, -4.5); });
    }, "x", "y");

    // ---------------- secondo anello (s, z)
    tiledPiece(ty.loopB, `${title} - ${ty.bHint} - 1:1 - 1 pezzo - filo ${D.LH.toFixed(0)} + 5 cm`, D.H, "horiz", (layer) => {
      if (layer === "under") {
        doc.setDrawColor(77, 77, 77); doc.setLineWidth(0.35); doc.setLineDashPattern([1.8, 1], 0);
        doc.line(X(-3), Y(0), X(D.S + 3), Y(0)); doc.setLineDashPattern([], 0);
        font(6.5, false); doc.setTextColor(77, 77, 77);
        doc.text(`linea centrale: qui passa il ${ty.loopA.toLowerCase()}`, X(D.S * 0.1), Y(0) - 0.8);
        font(8, true); doc.setTextColor(110, 110, 110);
        const zm = Math.max(...D.H.map(p => p[1]));
        doc.text("FIANCO DESTRO", X(D.S / 2), Y(zm * 0.45), { align: "center" });
        doc.text("FIANCO SINISTRO", X(D.S / 2), Y(-zm * 0.55), { align: "center" });
        doc.text("< " + ty.cross[0].toUpperCase(), X(-0.3), Y(1.2), { align: "right" });
        stroke("light"); doc.setLineWidth(0.28); doc.setLineDashPattern([0.7, 1], 0);
        R.forEach(r => doc.line(X(r.s), Y(-r.w), X(r.s), Y(r.w))); doc.setLineDashPattern([], 0);
        D.bends.forEach(b => {
          stroke("bend"); doc.setLineWidth(0.45); doc.setLineDashPattern([1.2, 0.8], 0);
          doc.line(X(b.s), Y(-zm - 1.5), X(b.s), Y(zm + 1.5)); doc.setLineDashPattern([], 0);
          font(7, true); textc("bend");
          doc.text(`PIEGA ${Math.abs(b.deg).toFixed(0)}°`, X(b.s) + 1, Y(zm + 1.2));
        });
        return;
      }
      marker(0, 0, "purple", `INCROCIO ${ty.cross[0]}`, 2.5, -5, true);
      marker(D.S, 0, "purple", `INCROCIO ${ty.cross[1]}`, -26, -5, true);
      R.forEach(r => { marker(r.s, r.w, "ring", `${r.n} des.`, 1.8, 2.4); marker(r.s, -r.w, "ring", `${r.n} sin.`, 1.8, -4.5); });
    }, "s", "z");

    // ---------------- anelli trasversali
    ringPages.forEach(pg => {
      newPage(false);
      header(`${title} - anelli trasversali ${pg.map(r => r.n).join(", ")}`, "Ogni anello nel suo piano, scala 1:1 - linee tratteggiate = assi della croce");
      const uw = UW, uh = UH;
      T = { x0: 0, y0: 0, ox: PM, oy: PM + PHEAD + uh * MM };
      grid(0, 0, uw, uh, null, "");
      // centra orizzontalmente ogni riga
      const rows = {}; pg.forEach(r => { (rows[r.box.y] = rows[r.box.y] || []).push(r); });
      Object.values(rows).forEach(row => { const tw = row.reduce((a, r) => a + r.box.w, 0); const off = Math.max(0, (uw - tw) / 2); row.forEach(r => { r.box.x += off; }); });
      pg.forEach(r => {
        const cz = r.box.x + r.box.w / 2, cy = uh - 0.4 - r.box.y - 2.0 - r.ut;   // centro della croce in cm di pagina
        // il centro va su una riga della griglia, se così l'anello resta dentro il foglio
        const rz = Math.round(cz), ry = Math.round(cy);
        const zc = rz - r.w >= 0.1 && rz + r.w <= uw - 0.1 ? rz : cz, yc = ry - r.ub >= 0.1 && ry + r.ut + 2.0 <= uh ? ry : cy;
        T = { x0: -zc, y0: -yc, ox: PM, oy: PM + PHEAD + uh * MM };
        layout.push({ name: r.n, kind: "anello", page: r.page, box: [X(-r.w), Y(r.ut), X(r.w), Y(-r.ub)],
                      area: [PM, PM + PHEAD, PM + uw * MM, PM + PHEAD + uh * MM] });
        font(10, true); textc("ink"); doc.text(`${r.n}  (a s${r.s.toFixed(1)}${r.a ? `, inclinato ${r.a.toFixed(0)}\u00b0` : ""})`, X(0), Y(r.ut + 1.6), { align: "center" });
        font(7.5, false); doc.text(`filo ${r.L.toFixed(0)} + 5 cm - ${(r.ut + r.ub).toFixed(1)} x ${(2 * r.w).toFixed(1)} cm`, X(0), Y(r.ut + 1.0), { align: "center" });
        doc.setLineDashPattern([1.4, 1], 0); doc.setLineWidth(0.35);
        stroke("wire"); doc.line(X(0), Y(-r.ub - 0.6), X(0), Y(r.ut + 0.6));
        stroke("horiz"); doc.line(X(-r.w - 0.6), Y(0), X(r.w + 0.6), Y(0));
        doc.setLineDashPattern([], 0);
        stroke("ring"); doc.setLineWidth(1.4); doc.setLineCap("round"); doc.setLineJoin("round");
        poly(r.curve); doc.setLineCap("butt");
        ticks(r.curve); start(r.curve, -10, -5.5);
        ringMarkers(r);
      });
      stroke("faint"); doc.setLineWidth(0.15); doc.rect(PM, PM + PHEAD, uw * MM, uh * MM, "S");
      footer();
    });
    big.forEach(r => tiledPiece(`Anello trasversale ${r.n}`,
      `${title} - anello ${r.n} a s${r.s.toFixed(1)}${r.a ? `, inclinato ${r.a.toFixed(0)}°` : ""} - 1:1 - filo ${r.L.toFixed(0)} + 5 cm - ${(r.ut + r.ub).toFixed(1)} x ${(2 * r.w).toFixed(1)} cm`,
      r.curve, "ring", (layer) => {
        if (layer === "under") {
          doc.setLineDashPattern([1.4, 1], 0); doc.setLineWidth(0.35);
          stroke("wire"); doc.line(X(0), Y(-r.ub - 0.6), X(0), Y(r.ut + 0.6));
          stroke("horiz"); doc.line(X(-r.w - 0.6), Y(0), X(r.w + 0.6), Y(0));
          doc.setLineDashPattern([], 0);
          return;
        }
        ringMarkers(r);
      }, "", ""));
    return { doc, pages: page - 1, D, layout };
  }

  root.RennaCore = { TYPES, ORDER, catmull, length, cut, derive, makePdf, planTiles, normPiece, defaultProject, migrate,
                     axisInfo, axisAt, axisProject, nearestOnCurve, ringFromSA, skin };
  if (typeof module !== "undefined") module.exports = root.RennaCore;
})(typeof window !== "undefined" ? window : globalThis);
