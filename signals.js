/* PaperBot signal library — a registry of parametric long/flat strategies used by (a) the strategy factory (thousands of variants are
 * generated from FAMILIES x grids and tested) and (b) the live bot (the survivors are evaluated on the latest candles).
 * Every family returns an Int8Array pos[t] in {0,1}, decided at the CLOSE of bar t (the caller applies it to bar t+1: no lookahead).
 * candles = [{o,h,l,c}], oldest first. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PaperSignals = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- indicator context (memoised per series) ---------- */
  function makeCtx(o, h, l, c) {
    const N = c.length, memo = {};
    const M = (k, f) => memo[k] || (memo[k] = f());
    const nan = () => { const a = new Float64Array(N); a.fill(NaN); return a; };
    const X = { N, o, h, l, c };
    X.sma = n => M('sma' + n, () => { const a = nan(); let s = 0; for (let i = 0; i < N; i++) { s += c[i]; if (i >= n) s -= c[i - n]; if (i >= n - 1) a[i] = s / n; } return a; });
    X.ema = n => M('ema' + n, () => { const a = nan(), k = 2 / (n + 1); let e = NaN; for (let i = 0; i < N; i++) { if (i === n - 1) { let s = 0; for (let j = 0; j < n; j++) s += c[j]; e = s / n; a[i] = e; } else if (i >= n) { e = c[i] * k + e * (1 - k); a[i] = e; } } return a; });
    X.hh = (n, src) => M('hh' + n + (src ? 'h' : 'c'), () => { const s = src ? h : c, a = nan(); for (let i = n - 1; i < N; i++) { let m = -Infinity; for (let j = i - n + 1; j <= i; j++) if (s[j] > m) m = s[j]; a[i] = m; } return a; });   // rolling high over n bars INCLUDING today
    X.ll = (n, src) => M('ll' + n + (src ? 'l' : 'c'), () => { const s = src ? l : c, a = nan(); for (let i = n - 1; i < N; i++) { let m = Infinity; for (let j = i - n + 1; j <= i; j++) if (s[j] < m) m = s[j]; a[i] = m; } return a; });
    X.hhPrev = (n, src) => M('hp' + n + (src ? 'h' : 'c'), () => { const s = src ? h : c, a = nan(); for (let i = n; i < N; i++) { let m = -Infinity; for (let j = i - n; j < i; j++) if (s[j] > m) m = s[j]; a[i] = m; } return a; });   // previous n bars, EXCLUDING today (breakout reference)
    X.llPrev = (n, src) => M('lp' + n + (src ? 'l' : 'c'), () => { const s = src ? l : c, a = nan(); for (let i = n; i < N; i++) { let m = Infinity; for (let j = i - n; j < i; j++) if (s[j] < m) m = s[j]; a[i] = m; } return a; });
    X.roc = n => M('roc' + n, () => { const a = nan(); for (let i = n; i < N; i++) a[i] = c[i] / c[i - n] - 1; return a; });
    X.std = n => M('std' + n, () => { const a = nan(); for (let i = n - 1; i < N; i++) { let s = 0, q = 0; for (let j = i - n + 1; j <= i; j++) { s += c[j]; q += c[j] * c[j]; } const m = s / n; a[i] = Math.sqrt(Math.max(q / n - m * m, 0)); } return a; });
    X.rsi = n => M('rsi' + n, () => { const a = nan(); let ag = 0, al = 0; for (let i = 1; i < N; i++) { const d = c[i] - c[i - 1], g = d > 0 ? d : 0, ls = d < 0 ? -d : 0; if (i <= n) { ag += g / n; al += ls / n; if (i === n) a[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); } else { ag = (ag * (n - 1) + g) / n; al = (al * (n - 1) + ls) / n; a[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); } } return a; });
    X.tr = () => M('tr', () => { const a = nan(); a[0] = h[0] - l[0]; for (let i = 1; i < N; i++) a[i] = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])); return a; });
    X.atr = n => M('atr' + n, () => { const t = X.tr(), a = nan(); let v = 0; for (let i = 0; i < N; i++) { if (i < n) { v += t[i] / n; if (i === n - 1) a[i] = v; } else { v = (v * (n - 1) + t[i]) / n; a[i] = v; } } return a; });
    X.adx = n => M('adx' + n, () => {
      const a = nan(), pdm = new Float64Array(N), mdm = new Float64Array(N), t = X.tr();
      for (let i = 1; i < N; i++) { const up = h[i] - h[i - 1], dn = l[i - 1] - l[i]; pdm[i] = up > dn && up > 0 ? up : 0; mdm[i] = dn > up && dn > 0 ? dn : 0; }
      let st = 0, sp = 0, sm = 0, dx = [], adx = NaN;
      for (let i = 1; i < N; i++) {
        if (i <= n) { st += t[i]; sp += pdm[i]; sm += mdm[i]; } else { st = st - st / n + t[i]; sp = sp - sp / n + pdm[i]; sm = sm - sm / n + mdm[i]; }
        if (i >= n) { const pi = 100 * sp / st, mi = 100 * sm / st, d = 100 * Math.abs(pi - mi) / Math.max(pi + mi, 1e-9); dx.push(d); if (dx.length === n) { adx = dx.reduce((x, y) => x + y, 0) / n; a[i] = adx; } else if (dx.length > n) { adx = (adx * (n - 1) + d) / n; a[i] = adx; } }
      } return a; });
    X.stoch = n => M('st' + n, () => { const hh = X.hh(n, true), ll = X.ll(n, true), a = nan(); for (let i = n - 1; i < N; i++) a[i] = 100 * (c[i] - ll[i]) / Math.max(hh[i] - ll[i], 1e-9); return a; });
    X.cci = n => M('cci' + n, () => { const tp = new Float64Array(N), a = nan(); for (let i = 0; i < N; i++) tp[i] = (h[i] + l[i] + c[i]) / 3; for (let i = n - 1; i < N; i++) { let m = 0; for (let j = i - n + 1; j <= i; j++) m += tp[j]; m /= n; let d = 0; for (let j = i - n + 1; j <= i; j++) d += Math.abs(tp[j] - m); d /= n; a[i] = (tp[i] - m) / (0.015 * Math.max(d, 1e-9)); } return a; });
    X.linslope = n => M('ls' + n, () => { const a = nan(); let sx = 0, sxx = 0; for (let j = 0; j < n; j++) { sx += j; sxx += j * j; } const den = n * sxx - sx * sx; for (let i = n - 1; i < N; i++) { let sy = 0, sxy = 0; for (let j = 0; j < n; j++) { const y = Math.log(c[i - n + 1 + j]); sy += y; sxy += j * y; } a[i] = (n * sxy - sx * sy) / den; } return a; });   // log-price slope per bar
    X.aroon = n => M('ar' + n, () => { const up = nan(), dn = nan(); for (let i = n; i < N; i++) { let hi = -Infinity, lo = Infinity, hk = 0, lk = 0; for (let j = i - n; j <= i; j++) { if (h[j] >= hi) { hi = h[j]; hk = j; } if (l[j] <= lo) { lo = l[j]; lk = j; } } up[i] = 100 * (n - (i - hk)) / n; dn[i] = 100 * (n - (i - lk)) / n; } return { up, dn }; });
    X.supertrend = (n, mult) => M('stx' + n + '_' + mult, () => {
      const atr = X.atr(n), dir = new Int8Array(N); let fu = NaN, fl = NaN, d = 1;
      for (let i = 0; i < N; i++) {
        if (isNaN(atr[i])) continue; const hl2 = (h[i] + l[i]) / 2, bu = hl2 + mult * atr[i], bl = hl2 - mult * atr[i];
        if (isNaN(fu)) { fu = bu; fl = bl; d = c[i] > hl2 ? 1 : -1; }
        else { fu = (bu < fu || c[i - 1] > fu) ? bu : fu; fl = (bl > fl || c[i - 1] < fl) ? bl : fl; if (d === -1 && c[i] > fu) d = 1; else if (d === 1 && c[i] < fl) d = -1; }
        dir[i] = d;
      } return dir; });
    X.macd = (f, s, g) => M('macd' + f + '_' + s + '_' + g, () => { const ef = X.ema(f), es = X.ema(s), m = nan(), sg = nan(), k = 2 / (g + 1); let e = NaN, cnt = 0; for (let i = 0; i < N; i++) { if (isNaN(ef[i]) || isNaN(es[i])) continue; m[i] = ef[i] - es[i]; cnt++; if (cnt === g) { let q = 0; for (let j = i - g + 1; j <= i; j++) q += m[j]; e = q / g; sg[i] = e; } else if (cnt > g) { e = m[i] * k + e * (1 - k); sg[i] = e; } } return { m, sg }; });
    X.kama = (n, fa, sl) => M('kama' + n + '_' + fa + '_' + sl, () => { const a = nan(), f = 2 / (fa + 1), s = 2 / (sl + 1); let k = NaN; for (let i = n; i < N; i++) { if (isNaN(k)) { k = c[i]; a[i] = k; continue; } let vol = 0; for (let j = i - n + 1; j <= i; j++) vol += Math.abs(c[j] - c[j - 1]); const er = vol > 0 ? Math.abs(c[i] - c[i - n]) / vol : 0, sc = Math.pow(er * (f - s) + s, 2); k = k + sc * (c[i] - k); a[i] = k; } return a; });
    X.rvol = n => M('rv' + n, () => { const a = nan(); for (let i = n; i < N; i++) { let s = 0, q = 0; for (let j = i - n + 1; j <= i; j++) { const r = Math.log(c[j] / c[j - 1]); s += r; q += r * r; } const m = s / n; a[i] = Math.sqrt(Math.max(q / n - m * m, 0)); } return a; });
    X.runMemo = (f, p) => M('run' + f + JSON.stringify(p), () => F[f].run(X, p));
    return X;
  }
  const state = (N, enter, exit) => { const p = new Int8Array(N); for (let i = 1; i < N; i++) p[i] = enter(i) ? 1 : exit(i) ? 0 : p[i - 1]; return p; };
  const level = (N, f) => { const p = new Int8Array(N); for (let i = 0; i < N; i++) p[i] = f(i) ? 1 : 0; return p; };
  const ok = (...v) => v.every(x => x === x);   // not NaN
  const rng = (a, b, s) => { const o = []; for (let x = a; x <= b + 1e-9; x += s) o.push(Math.round(x * 1000) / 1000); return o; };

  /* ---------- families: { grid: [params...], run(ctx, p) -> pos } ---------- */
  const F = {};
  F.sma_price = { grid: rng(20, 300, 5).map(n => ({ n })), run: (x, p) => { const m = x.sma(p.n); return level(x.N, i => ok(m[i]) && x.c[i] > m[i]); } };
  F.ema_price = { grid: rng(10, 300, 5).map(n => ({ n })), run: (x, p) => { const m = x.ema(p.n); return level(x.N, i => ok(m[i]) && x.c[i] > m[i]); } };
  F.sma_band = { grid: [].concat(...[50, 100, 150, 200, 250].map(n => [0.01, 0.02, 0.03, 0.05].map(b => ({ n, b })))), run: (x, p) => { const m = x.sma(p.n); return state(x.N, i => ok(m[i]) && x.c[i] > m[i] * (1 + p.b), i => ok(m[i]) && x.c[i] < m[i] * (1 - p.b)); } };
  const FS = [[3, 10], [5, 20], [5, 30], [8, 21], [10, 30], [10, 50], [13, 34], [20, 50], [20, 100], [25, 100], [30, 100], [40, 120], [50, 100], [50, 150], [50, 200], [75, 200], [100, 250], [20, 200], [30, 150], [60, 180]];
  F.sma_cross = { grid: FS.map(([f, s]) => ({ f, s })), run: (x, p) => { const a = x.sma(p.f), b = x.sma(p.s); return level(x.N, i => ok(a[i], b[i]) && a[i] > b[i]); } };
  F.ema_cross = { grid: FS.concat([[12, 26], [9, 21], [4, 18], [7, 28]]).map(([f, s]) => ({ f, s })), run: (x, p) => { const a = x.ema(p.f), b = x.ema(p.s); return level(x.N, i => ok(a[i], b[i]) && a[i] > b[i]); } };
  F.triple_ma = { grid: [[5, 20, 50], [10, 30, 100], [20, 50, 100], [20, 50, 200], [10, 50, 200], [8, 21, 55], [13, 34, 89], [25, 75, 150]].map(([a, b, c]) => ({ a, b, c })), run: (x, p) => { const a = x.ema(p.a), b = x.ema(p.b), c = x.ema(p.c); return level(x.N, i => ok(a[i], b[i], c[i]) && a[i] > b[i] && b[i] > c[i]); } };
  F.donchian = { grid: [].concat(...[10, 20, 30, 40, 55, 80, 100, 120, 150, 200, 250].map(n => [5, 10, 15, 20, 30, 40, 55, 80, 100].filter(m => m < n).map(m => ({ n, m })))), run: (x, p) => { const hi = x.hhPrev(p.n), lo = x.llPrev(p.m); return state(x.N, i => ok(hi[i]) && x.c[i] > hi[i], i => ok(lo[i]) && x.c[i] < lo[i]); } };
  F.donchian_hl = { grid: [].concat(...[20, 40, 55, 100, 150, 250].map(n => [10, 20, 40].filter(m => m < n).map(m => ({ n, m })))), run: (x, p) => { const hi = x.hhPrev(p.n, true), lo = x.llPrev(p.m, true); return state(x.N, i => ok(hi[i]) && x.c[i] > hi[i], i => ok(lo[i]) && x.c[i] < lo[i]); } };
  F.roc = { grid: [].concat(...rng(10, 260, 5).map(n => [0, 0.02, 0.05, 0.1].map(t => ({ n, t })))), run: (x, p) => { const r = x.roc(p.n); return level(x.N, i => ok(r[i]) && r[i] > p.t * Math.sqrt(p.n / 252) * 2.5); } };
  F.roc_band = { grid: [].concat(...[20, 63, 126, 252].map(n => [0.01, 0.03, 0.05].map(b => ({ n, b })))), run: (x, p) => { const r = x.roc(p.n); return state(x.N, i => ok(r[i]) && r[i] > p.b, i => ok(r[i]) && r[i] < -p.b); } };
  F.tsmom = { grid: [[21, 63, 126], [63, 126, 252], [21, 63, 252], [42, 126, 252], [10, 42, 126], [63, 126], [126, 252], [21, 126, 252], [5, 21, 63], [30, 90, 180]].map(a => ({ a })).concat([0.34, 0.5, 0.67, 1].map(q => ({ a: [21, 63, 126, 252], q }))), run: (x, p) => { const rs = p.a.map(n => x.roc(n)), need = p.q === undefined ? 0.5 : p.q; return level(x.N, i => { let v = 0, k = 0; for (const r of rs) { if (!ok(r[i])) return false; k++; if (r[i] > 0) v++; } return v / k > need - 1e-9 && v > 0 && (p.q === undefined ? v / k >= 0.5 : v / k >= need); }); } };
  F.macd = { grid: [].concat(...[[8, 21], [12, 26], [16, 35], [20, 50], [10, 40], [5, 35]].map(([f, s]) => [5, 9, 14].map(g => [0, 1].map(mode => ({ f, s, g, mode })))).flat()), run: (x, p) => { const { m, sg } = x.macd(p.f, p.s, p.g); return p.mode === 0 ? level(x.N, i => ok(m[i]) && m[i] > 0) : level(x.N, i => ok(m[i], sg[i]) && m[i] > sg[i]); } };
  F.rsi_trend = { grid: [].concat(...[5, 7, 14, 21, 30, 50, 100].map(n => [[50, 50], [55, 45], [60, 40], [65, 45], [55, 40], [60, 50]].map(([u, d]) => ({ n, u, d })))), run: (x, p) => { const r = x.rsi(p.n); return state(x.N, i => ok(r[i]) && r[i] > p.u, i => ok(r[i]) && r[i] < p.d); } };
  F.rsi_mr = { grid: [].concat(...[2, 3, 4, 5, 7, 10, 14].map(n => [5, 10, 15, 20, 30, 40].map(lo => [50, 60, 70, 80].map(hi => ({ n, lo, hi })))).flat()), run: (x, p) => { const r = x.rsi(p.n); return state(x.N, i => ok(r[i]) && r[i] < p.lo, i => ok(r[i]) && r[i] > p.hi); } };
  F.rsi_mr_trend = { grid: [].concat(...[2, 3, 5, 7, 14].map(n => [10, 20, 30, 40].map(lo => [100, 200].map(m => ({ n, lo, m })))).flat()), run: (x, p) => { const r = x.rsi(p.n), s = x.sma(p.m); return state(x.N, i => ok(r[i], s[i]) && r[i] < p.lo && x.c[i] > s[i], i => ok(r[i]) && r[i] > 65); } };
  F.boll_break = { grid: [].concat(...[10, 20, 30, 50, 100].map(n => [1, 1.5, 2, 2.5, 3].map(k => ({ n, k })))), run: (x, p) => { const m = x.sma(p.n), s = x.std(p.n); return state(x.N, i => ok(m[i], s[i]) && x.c[i] > m[i] + p.k * s[i], i => ok(m[i]) && x.c[i] < m[i]); } };
  F.boll_mr = { grid: [].concat(...[10, 20, 30, 50].map(n => [1.5, 2, 2.5, 3].map(k => [0, 1].map(e => ({ n, k, e })))).flat()), run: (x, p) => { const m = x.sma(p.n), s = x.std(p.n); return state(x.N, i => ok(m[i], s[i]) && x.c[i] < m[i] - p.k * s[i], i => ok(m[i]) && (p.e ? x.c[i] > m[i] + 0.5 * s[i] : x.c[i] > m[i])); } };
  F.keltner = { grid: [].concat(...[10, 20, 50, 100].map(n => [1, 1.5, 2, 3, 4].map(k => ({ n, k })))), run: (x, p) => { const m = x.ema(p.n), a = x.atr(Math.min(p.n, 20)); return state(x.N, i => ok(m[i], a[i]) && x.c[i] > m[i] + p.k * a[i], i => ok(m[i]) && x.c[i] < m[i]); } };
  F.supertrend = { grid: [].concat(...[7, 10, 14, 20, 30, 50].map(n => [1.5, 2, 2.5, 3, 4, 5, 6].map(k => ({ n, k })))), run: (x, p) => { const d = x.supertrend(p.n, p.k); return level(x.N, i => d[i] === 1); } };
  F.adx_trend = { grid: [].concat(...[20, 50, 100, 150, 200].map(n => [10, 15, 20, 25, 30].map(a => [14, 20].map(len => ({ n, a, len })))).flat()), run: (x, p) => { const m = x.sma(p.n), ad = x.adx(p.len); return level(x.N, i => ok(m[i], ad[i]) && x.c[i] > m[i] && ad[i] > p.a); } };
  F.aroon = { grid: [].concat(...[14, 25, 50, 100, 150, 250].map(n => [50, 70, 90].map(t => ({ n, t })))), run: (x, p) => { const { up, dn } = x.aroon(p.n); return state(x.N, i => ok(up[i], dn[i]) && up[i] > p.t && up[i] > dn[i], i => ok(up[i], dn[i]) && dn[i] > up[i]); } };
  F.stoch = { grid: [].concat(...[5, 9, 14, 21, 50].map(n => [[20, 80], [30, 70], [10, 60], [25, 75], [15, 85]].map(([lo, hi]) => [0, 1].map(mode => ({ n, lo, hi, mode })))).flat()), run: (x, p) => { const k = x.stoch(p.n); return p.mode === 0 ? state(x.N, i => ok(k[i]) && k[i] < p.lo, i => ok(k[i]) && k[i] > p.hi) : state(x.N, i => ok(k[i]) && k[i] > p.hi, i => ok(k[i]) && k[i] < p.lo); } };
  F.cci = { grid: [].concat(...[10, 20, 40, 100].map(n => [50, 100, 150, 200].map(t => [0, 1].map(mode => ({ n, t, mode })))).flat()), run: (x, p) => { const v = x.cci(p.n); return p.mode === 0 ? state(x.N, i => ok(v[i]) && v[i] < -p.t, i => ok(v[i]) && v[i] > 0) : state(x.N, i => ok(v[i]) && v[i] > p.t, i => ok(v[i]) && v[i] < 0); } };
  F.linreg = { grid: [].concat(...rng(20, 250, 10).map(n => [0, 0.0002, 0.0005].map(t => ({ n, t })))), run: (x, p) => { const s = x.linslope(p.n); return level(x.N, i => ok(s[i]) && s[i] > p.t); } };
  F.kama = { grid: [].concat(...[10, 20, 30].map(n => [2, 4].map(f => [30, 50].map(s => [0, 1].map(mode => ({ n, f, s, mode }))))).flat(2)), run: (x, p) => { const k = x.kama(p.n, p.f, p.s); return p.mode === 0 ? level(x.N, i => ok(k[i]) && x.c[i] > k[i]) : level(x.N, i => ok(k[i], k[i - 1]) && k[i] > k[i - 1]); } };
  F.near_high = { grid: [].concat(...[60, 120, 180, 250].map(n => [0, 0.02, 0.05, 0.1, 0.15].map(t => ({ n, t })))), run: (x, p) => { const hi = x.hh(p.n); return level(x.N, i => ok(hi[i]) && x.c[i] >= hi[i] * (1 - p.t)); } };
  F.dd_filter = { grid: [].concat(...[120, 250].map(n => [0.03, 0.05, 0.08, 0.12].map(t => [50, 100, 200].map(m => ({ n, t, m })))).flat()), run: (x, p) => { const hi = x.hh(p.n), s = x.sma(p.m); return level(x.N, i => ok(hi[i], s[i]) && x.c[i] > hi[i] * (1 - p.t) && x.c[i] > s[i]); } };
  F.vol_trend = { grid: [].concat(...[50, 100, 150, 200].map(n => [10, 20, 40].map(a => [1.0, 1.25, 1.5].map(r => ({ n, a, r })))).flat()), run: (x, p) => { const m = x.sma(p.n), a = x.rvol(p.a), b = x.rvol(Math.max(60, p.a * 3)); return level(x.N, i => ok(m[i], a[i], b[i]) && x.c[i] > m[i] && a[i] < b[i] * p.r); } };
  F.vol_target_trend = { grid: [].concat(...[50, 100, 200].map(n => [0.12, 0.18, 0.25, 0.4].map(v => ({ n, v })))), run: (x, p) => { const m = x.sma(p.n), a = x.rvol(20); return level(x.N, i => ok(m[i], a[i]) && x.c[i] > m[i] && a[i] * Math.sqrt(252) < p.v); } };
  F.ichimoku = { grid: [[9, 26, 52], [7, 22, 44], [10, 30, 60], [12, 36, 72], [20, 60, 120], [5, 15, 30]].map(([t, k, s]) => ({ t, k, s })), run: (x, p) => { const th = x.hh(p.t, true), tl = x.ll(p.t, true), kh = x.hh(p.k, true), kl = x.ll(p.k, true), sh = x.hh(p.s, true), sl = x.ll(p.s, true); return level(x.N, i => { if (i < p.k + 1 || !ok(th[i], tl[i], kh[i], kl[i], sh[i - p.k], sl[i - p.k], kh[i - p.k], kl[i - p.k], th[i - p.k], tl[i - p.k])) return false; const sa = ((th[i - p.k] + tl[i - p.k]) / 2 + (kh[i - p.k] + kl[i - p.k]) / 2) / 2, sb = (sh[i - p.k] + sl[i - p.k]) / 2; return x.c[i] > Math.max(sa, sb); }); } };
  F.gap_pullback = { grid: [].concat(...[50, 100, 200].map(n => [3, 5, 10].map(d => [0.02, 0.04, 0.06].map(t => ({ n, d, t })))).flat()), run: (x, p) => { const s = x.sma(p.n), r = x.roc(p.d); return state(x.N, i => ok(s[i], r[i]) && x.c[i] > s[i] && r[i] < -p.t, i => ok(s[i]) && (x.c[i] < s[i] || (ok(r[i]) && r[i] > p.t))); } };
  F.ma_slope = { grid: [].concat(...[20, 50, 100, 200].map(n => [5, 10, 20].map(k => ({ n, k })))), run: (x, p) => { const m = x.sma(p.n); return level(x.N, i => i >= p.k && ok(m[i], m[i - p.k]) && m[i] > m[i - p.k]); } };
  F.ma_slope_price = { grid: [].concat(...[50, 100, 200].map(n => [5, 10, 20].map(k => [0, 1].map(e => ({ n, k, e })))).flat()), run: (x, p) => { const m = p.e ? x.ema(p.n) : x.sma(p.n); return level(x.N, i => i >= p.k && ok(m[i], m[i - p.k]) && m[i] > m[i - p.k] && x.c[i] > m[i]); } };


  /* combo family: AND of a slow trend filter with a faster timing signal drawn from the other families (thousands of variants) */
  (function () {
    const filters = [{ f: 'sma_price', p: { n: 100 } }, { f: 'sma_price', p: { n: 150 } }, { f: 'sma_price', p: { n: 200 } }, { f: 'ema_price', p: { n: 100 } }, { f: 'ema_price', p: { n: 200 } }, { f: 'sma_cross', p: { f: 50, s: 200 } },
      { f: 'sma_cross', p: { f: 50, s: 100 } }, { f: 'roc', p: { n: 126, t: 0 } }, { f: 'roc', p: { n: 252, t: 0 } }, { f: 'ma_slope', p: { n: 200, k: 20 } }, { f: 'supertrend', p: { n: 20, k: 3 } }, { f: 'near_high', p: { n: 250, t: 0.1 } }];
    const base = Object.keys(F).filter(k => k !== 'combo' && k !== 'sma_price' && k !== 'ema_price');
    const timing = []; base.forEach(k => F[k].grid.forEach((p, i) => { if (i % 2 === 0) timing.push({ f: k, p }); }));   // every 2nd variant keeps the grid bounded
    const grid = []; filters.forEach(fl => timing.forEach(t => grid.push({ a: fl, b: t })));
    F.combo = { grid, run: (x, p) => { const A = x.runMemo(p.a.f, p.a.p), B = x.runMemo(p.b.f, p.b.p), o = new Int8Array(x.N); for (let i = 0; i < x.N; i++) o[i] = A[i] && B[i] ? 1 : 0; return o; } };
  })();


  /* ---------- Pine-style / TradingView-community strategies, ported by hand (long/flat, daily bars, no lookahead) ----------
   * Marked pine:true: they are TESTED by the factory but kept out of the live library until they pass out-of-sample. */
  (function () {
    const wma = (a, n, N) => { const o = new Float64Array(N); o.fill(NaN); const den = n * (n + 1) / 2; for (let i = n - 1; i < N; i++) { let v = 0, ok2 = true; for (let j = 0; j < n; j++) { const q = a[i - n + 1 + j]; if (q !== q) { ok2 = false; break; } v += q * (j + 1); } if (ok2) o[i] = v / den; } return o; };
    const linregEnd = (a, n, N) => { const o = new Float64Array(N); o.fill(NaN); let sx = 0, sxx = 0; for (let j = 0; j < n; j++) { sx += j; sxx += j * j; } const den = n * sxx - sx * sx; for (let i = n - 1; i < N; i++) { let sy = 0, sxy = 0, good = true; for (let j = 0; j < n; j++) { const q = a[i - n + 1 + j]; if (q !== q) { good = false; break; } sy += q; sxy += j * q; } if (!good) continue; const b = (n * sxy - sx * sy) / den, A = (sy - b * sx) / n; o[i] = A + b * (n - 1); } return o; };
    F.pine_squeeze = { pine: true, name: 'Squeeze Momentum (LazyBear)', grid: [].concat(...[14, 20, 30].map(n => [1.5, 2].map(k => [0, 1].map(mode => ({ n, k, mode })))).flat()), run: (x, p) => {
      const mid = new Float64Array(x.N); const hh = x.hh(p.n, true), ll = x.ll(p.n, true), sm = x.sma(p.n); for (let i = 0; i < x.N; i++) mid[i] = x.c[i] - ((hh[i] + ll[i]) / 2 + sm[i]) / 2;
      const mom = linregEnd(mid, p.n, x.N), sd = x.std(p.n), at = x.atr(p.n);
      return level(x.N, i => { if (!ok(mom[i], mom[i - 1])) return false; if (p.mode === 0) return mom[i] > 0; const sq = ok(sd[i], at[i]) && 2 * sd[i] < p.k * at[i]; return mom[i] > 0 && mom[i] > mom[i - 1] && !sq; }); } };
    F.pine_utbot = { pine: true, name: 'UT Bot Alerts (ATR trailing stop)', grid: [].concat(...[1, 2, 3, 4, 5].map(k => [1, 5, 10, 14, 20, 50].map(a => ({ k, a })))), run: (x, p) => {
      const at = x.atr(p.a), tr = new Float64Array(x.N), pos = new Int8Array(x.N); let prev = NaN;
      for (let i = 1; i < x.N; i++) { if (!ok(at[i])) { continue; } const nl = p.k * at[i], c = x.c[i], c1 = x.c[i - 1]; let t;
        if (prev !== prev) t = c - nl; else if (c > prev && c1 > prev) t = Math.max(prev, c - nl); else if (c < prev && c1 < prev) t = Math.min(prev, c + nl); else t = c > prev ? c - nl : c + nl;
        tr[i] = t; prev = t; pos[i] = c > t ? 1 : 0; } return pos; } };
    F.pine_ha = { pine: true, name: 'Heikin-Ashi trend', grid: [].concat(...[1, 2, 3, 4].map(k => [0, 50, 100, 200].map(f => ({ k, f })))), run: (x, p) => {
      const hc = new Float64Array(x.N), ho = new Float64Array(x.N); for (let i = 0; i < x.N; i++) { hc[i] = (x.o[i] + x.h[i] + x.l[i] + x.c[i]) / 4; ho[i] = i ? (ho[i - 1] + hc[i - 1]) / 2 : (x.o[0] + x.c[0]) / 2; }
      const m = p.f ? x.sma(p.f) : null; const bull = i => hc[i] > ho[i];
      return state(x.N, i => { for (let j = 0; j < p.k; j++) if (i - j < 0 || !bull(i - j)) return false; return !m || (ok(m[i]) && x.c[i] > m[i]); }, i => !bull(i)); } };
    F.pine_ob = { pine: true, name: 'Order block retest (SMC, long-only)', grid: [].concat(...[1, 1.5, 2, 3].map(k => [3, 5, 8].map(m => [20, 50, 100].map(life => ({ k, m, life }))))).flat(), run: (x, p) => {
      const at = x.atr(14), pos = new Int8Array(x.N), obs = []; let cur = null;   // obs: {lo,hi,born}
      for (let i = 0; i < x.N; i++) {
        // detect: candle j = i-m..i-1 that is bearish, followed by close above its high by k*ATR (confirmed at bar i)
        if (ok(at[i])) for (let j = Math.max(1, i - p.m); j < i; j++) { if (x.c[j] < x.o[j] && x.c[i] > x.h[j] + p.k * at[i] && !(cur && cur.j === j) && !obs.some(o => o.j === j)) { obs.push({ j, lo: x.l[j], hi: x.h[j], born: i }); } }
        while (obs.length && (i - obs[0].born > p.life)) obs.shift();
        // invalidate zones closed below
        for (let q = obs.length - 1; q >= 0; q--) if (x.c[i] < obs[q].lo) obs.splice(q, 1);
        if (cur && (x.c[i] < cur.lo || i - cur.born > p.life)) cur = null;
        if (!cur) for (const o of obs) { if (i > o.born && x.l[i] <= o.hi && x.c[i] > (o.lo + o.hi) / 2) { cur = o; break; } }
        pos[i] = cur ? 1 : 0; }
      return pos; } };
    F.pine_bos = { pine: true, name: 'Break of structure / CHoCH (swing pivots)', grid: [3, 5, 8, 13, 21, 34].map(n => ({ n })), run: (x, p) => {
      const pos = new Int8Array(x.N); let ph = NaN, pl = NaN; const n = p.n;
      for (let i = 0; i < x.N; i++) { const k = i - n; if (k >= n) { let isH = true, isL = true; for (let j = k - n; j <= k + n; j++) { if (j === k) continue; if (x.h[j] >= x.h[k]) isH = false; if (x.l[j] <= x.l[k]) isL = false; } if (isH) ph = x.h[k]; if (isL) pl = x.l[k]; }
        if (i > 0) pos[i] = ok(ph) && x.c[i] > ph ? 1 : (ok(pl) && x.c[i] < pl ? 0 : pos[i - 1]); } return pos; } };
    F.pine_connors = { pine: true, name: 'Connors RSI(2) pullback', grid: [].concat(...[2, 3, 4].map(n => [5, 10, 15, 20].map(lo => [100, 200].map(f => ({ n, lo, f }))))).flat(), run: (x, p) => {
      const r = x.rsi(p.n), m = x.sma(p.f), s5 = x.sma(5);
      return state(x.N, i => ok(r[i], m[i]) && x.c[i] > m[i] && r[i] < p.lo, i => ok(s5[i]) && x.c[i] > s5[i]); } };
    F.pine_ribbon = { pine: true, name: 'EMA ribbon alignment', grid: [[5, 10, 20, 40], [8, 13, 21, 34, 55], [10, 20, 40, 80], [20, 40, 80, 160], [5, 10, 20, 40, 80, 160], [10, 25, 50, 100, 200]].map(a => ({ a })), run: (x, p) => { const e = p.a.map(n => x.ema(n)); return level(x.N, i => { if (!e.every(v => ok(v[i]))) return false; for (let k = 0; k < e.length - 1; k++) if (!(e[k][i] > e[k + 1][i])) return false; return x.c[i] > e[0][i]; }); } };
    F.pine_stochrsi = { pine: true, name: 'Stochastic RSI cross', grid: [].concat(...[9, 14, 21].map(n => [20, 30, 40].map(lo => [0, 200].map(f => ({ n, lo, f }))))).flat(), run: (x, p) => {
      const r = x.rsi(p.n), N = x.N, k = new Float64Array(N); k.fill(NaN); for (let i = 2 * p.n; i < N; i++) { let hi = -Infinity, lo = Infinity; for (let j = i - p.n + 1; j <= i; j++) { if (r[j] > hi) hi = r[j]; if (r[j] < lo) lo = r[j]; } k[i] = 100 * (r[i] - lo) / Math.max(hi - lo, 1e-9); }
      const kk = new Float64Array(N), dd = new Float64Array(N); kk.fill(NaN); dd.fill(NaN); for (let i = 2 * p.n + 3; i < N; i++) { kk[i] = (k[i] + k[i - 1] + k[i - 2]) / 3; } for (let i = 2 * p.n + 6; i < N; i++) dd[i] = (kk[i] + kk[i - 1] + kk[i - 2]) / 3; const m = p.f ? x.sma(p.f) : null;
      return state(N, i => ok(kk[i], dd[i], kk[i - 1], dd[i - 1]) && kk[i - 1] <= dd[i - 1] && kk[i] > dd[i] && kk[i] < p.lo + 40 && (!m || (ok(m[i]) && x.c[i] > m[i])), i => ok(kk[i], dd[i]) && kk[i] < dd[i] && kk[i] > 70); } };
    F.pine_hma = { pine: true, name: 'Hull MA direction', grid: [9, 16, 21, 30, 50, 80, 100, 150, 200].map(n => ({ n })), run: (x, p) => {
      const w1 = wma(x.c, Math.max(2, Math.round(p.n / 2)), x.N), w2 = wma(x.c, p.n, x.N), d = new Float64Array(x.N); for (let i = 0; i < x.N; i++) d[i] = 2 * w1[i] - w2[i];
      const h = wma(d, Math.max(2, Math.round(Math.sqrt(p.n))), x.N); return level(x.N, i => ok(h[i], h[i - 1]) && h[i] > h[i - 1]); } };
  })();

  /* ---------- helpers ---------- */
  const process_env_pine = () => (typeof process !== 'undefined' && process.env && process.env.PINE === '1');
  function allSpecs(only) { const out = []; Object.keys(F).forEach(f => { if (only && only.indexOf(f) < 0) return; if (!only && F[f].pine && !process_env_pine()) return; F[f].grid.forEach(p => out.push({ f, p })); }); return out; }
  const specKey = s => s.f + ':' + JSON.stringify(s.p);
  function runSpec(ctx, s) { return F[s.f].run(ctx, s.p); }
  function ctxFromCandles(cs) { const n = cs.length, o = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), c = new Float64Array(n); for (let i = 0; i < n; i++) { o[i] = cs[i].o; h[i] = cs[i].h; l[i] = cs[i].l; c[i] = cs[i].c; } return makeCtx(o, h, l, c); }
  /* live: library vote at the latest bar = average of the specs' positions (0..1). Uses the last `win` candles (state machines warm up inside the window). */
  function libVote(cs, specs, win) {
    if (!specs || !specs.length) return null;
    const w = cs.length > (win || 420) ? cs.slice(-(win || 420)) : cs; if (w.length < 60) return null;
    const x = ctxFromCandles(w); let s = 0, n = 0, parts = [];
    for (const sp of specs) { const f = F[sp.f]; if (!f) continue; let v; try { v = f.run(x, sp.p)[w.length - 1]; } catch (e) { continue; } s += v; n++; parts.push(v); }
    return n ? { vote: s / n, n, parts } : null;
  }
  return { makeCtx, FAMILIES: F, allSpecs, specKey, runSpec, ctxFromCandles, libVote };
});
