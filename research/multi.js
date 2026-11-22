/* Multi-market backtest: every strategy (signals.js, incl. Pine-style) on each market group separately.
 * Signal at close t -> position at t+1. Costs 0.10%/side. Idle cash earns a per-group yield. Design vs test split per group. */
const fs = require('fs'), path = require('path');
process.env.PINE = '1';
const S = require('../server/signals.js');
const D = path.join(__dirname, '../data');
const readCsv = (f) => fs.readFileSync(f, 'utf8').trim().split('\n').slice(1).map(l => l.split(',')).filter(r => +r[4] > 0).map(r => ({ d: r[0].slice(0, 10), o: +r[1], h: +r[2], l: +r[3], c: +r[4] }));
const idxFiles = fs.readdirSync(path.join(D, 'idx')).filter(f => f.endsWith('.csv') && f !== 'india_vix.csv');
const nseOK = idxFiles.map(f => ({ name: f.replace('.csv', ''), rows: readCsv(path.join(D, 'idx', f)) })).filter(x => x.rows.length > 2200 && x.rows[0].d <= '2016-01-01');
const g = (f) => ({ name: f, rows: readCsv(path.join(D, 'global', f + '.csv')) });
const etf = (f) => ({ name: f, rows: readCsv(path.join(D, f + '.csv')) });
const usStocks = fs.readdirSync(path.join(D, 'global')).filter(f => f.startsWith('us_')).map(f => g(f.replace('.csv', '')));
const GROUPS = [
  { key: 'India_indices', label: 'India · NSE indices (' + nseOK.length + ')', inst: nseOK, design: ['2013-03-01', '2018-12-31'], test: ['2019-01-01', '2026-12-31'], cash: 0.05 },
  { key: 'India_ETFs', label: 'India · index ETFs (5)', inst: ['niftybees', 'bankbees', 'itbees', 'juniorbees', 'psubnkbees'].map(etf), design: ['2013-03-01', '2018-12-31'], test: ['2019-01-01', '2026-12-31'], cash: 0.05 },
  { key: 'India_gold', label: 'India · gold (Gold BeES, INR)', inst: [etf('goldbees')], design: ['2008-01-01', '2015-12-31'], test: ['2016-01-01', '2026-12-31'], cash: 0.05 },
  { key: 'US_indices', label: 'US · S&P 500 + Nasdaq (OHLC)', inst: [g('sp500_ohlc'), g('nasdaq_ohlc')], design: ['1999-01-01', '2008-12-31'], test: ['2009-01-01', '2018-12-31'], cash: 0.025 },
  { key: 'US_SP500_long', label: 'US · S&P 500 (close, 1990-2022)', inst: [g('sp500_close_1990')], design: ['1990-01-01', '2005-12-31'], test: ['2006-01-01', '2022-12-31'], cash: 0.025 },
  { key: 'US_stocks', label: 'US · 20 large stocks (close, survivors)', inst: usStocks, design: ['1990-01-01', '2006-12-31'], test: ['2007-01-01', '2022-12-31'], cash: 0.025 },
  { key: 'Crude_WTI', label: 'Crude oil · WTI (close)', inst: [g('wti_crude_close')], design: ['1986-01-01', '2002-12-31'], test: ['2003-01-01', '2019-01-31'], cash: 0.025 },
  { key: 'US_Google', label: 'US · Google (OHLC, 2004-13)', inst: [g('goog_ohlc')], design: ['2004-08-01', '2008-12-31'], test: ['2009-01-01', '2013-03-01'], cash: 0.025 }
];
const only = process.env.GROUPS ? process.env.GROUPS.split(',') : null;
const COST = 0.001, t00 = Date.now(), tl = m => console.error(((Date.now() - t00) / 1000).toFixed(0) + 's ' + m);
const specs = S.allSpecs(); tl('specs ' + specs.length);
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
function runGroup(G) {
  const RF = G.cash / 252, dates = [...new Set([].concat(...G.inst.map(x => x.rows.map(r => r.d))))].sort(), T = dates.length, di = {}; dates.forEach((d, i) => { di[d] = i; });
  const idx = G.inst.map(x => {
    const n = x.rows.length, o = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), c = new Float64Array(n), pos = new Int32Array(n);
    x.rows.forEach((r, i) => { o[i] = r.o; h[i] = r.h; l[i] = r.l; c[i] = r.c; pos[i] = di[r.d]; });
    const ret = new Float32Array(T); for (let i = 1; i < n; i++) ret[pos[i]] = c[i] / c[i - 1] - 1;
    return { name: x.name, ctx: S.makeCtx(o, h, l, c), pos, n, start: pos[0], ret };
  });
  const wi = w => { let a = dates.findIndex(d => d >= w[0]); if (a < 0) a = T; let b = T - 1; for (let i = T - 1; i >= 0; i--) if (dates[i] <= w[1]) { b = i; break; } return [a, b]; };
  const [dA, dB] = wi(G.design), [tA, tB] = wi(G.test);
  const nValid = new Float32Array(T); idx.forEach(x => { for (let t = x.start + 1; t < T; t++) nValid[t]++; });
  const pb = idx.map(() => new Int8Array(T));
  const fill = (x, pos, out) => { out.fill(0); let k = 0, cur = 0; for (let t = x.start; t < T; t++) { while (k < x.n && x.pos[k] <= t) { cur = pos[k]; k++; } out[t] = cur; } };
  const port = new Float32Array(T);
  function evalPos(P) { port.fill(0); idx.forEach((x, i) => { const p = P[i], r = x.ret; for (let t = x.start + 2; t < T; t++) { const a = p[t - 1], b = p[t - 2]; port[t] += (a * r[t] + (1 - a) * RF - (a !== b ? COST : 0)) / nValid[t]; } }); return port; }
  const stats = (p, a, b) => { let n = 0, s = 0, q = 0, eq = 1, pk = 1, dd = 0; for (let t = a; t <= b; t++) { const e = p[t] - RF; n++; s += e; q += e * e; eq *= 1 + p[t]; if (eq > pk) pk = eq; dd = Math.max(dd, 1 - eq / pk); } const m = s / n, sd = Math.sqrt(Math.max(q / n - m * m, 1e-18)); return { sharpe: m / sd * Math.sqrt(252), cagr: Math.pow(eq, 252 / n) - 1, dd, n }; };
  const hold = evalPos(idx.map((x) => { const p = new Int8Array(T); for (let t = x.start; t < T; t++) p[t] = 1; return p; })).slice();
  const H = { d: stats(hold, dA, dB), t: stats(hold, tA, tB) };
  const res = [];
  for (const sp of specs) {
    idx.forEach((x, i) => fill(x, S.runSpec(x.ctx, sp), pb[i]));
    const p = evalPos(pb), d = stats(p, dA, dB), t = stats(p, tA, tB); let ex = 0, c = 0; idx.forEach((x, i) => { for (let q = tA; q <= tB; q++) { ex += pb[i][q]; c++; } });
    res.push({ f: sp.f, p: sp.p, dSh: d.sharpe, tSh: t.sharpe, tCagr: t.cagr, tDD: t.dd, expo: ex / c });
  }
  // library ensemble (selected on Indian indices only) -> out-of-market check
  let lib = null; try {
    const L = JSON.parse(fs.readFileSync(path.join(__dirname, '../server/replay/strategy_library.json'), 'utf8')).specs, ens = new Float32Array(T);
    L.forEach(sp => { idx.forEach((x, i) => fill(x, S.runSpec(x.ctx, sp), pb[i])); const p = evalPos(pb); for (let t = 0; t < T; t++) ens[t] += p[t] / L.length; });
    lib = { design: stats(ens, dA, dB), test: stats(ens, tA, tB) };
  } catch (e) { }
  return { dates: [dates[dA], dates[dB], dates[tA], dates[tB]], hold: H, res, lib, inst: idx.length };
}
const out = { generated: new Date().toISOString(), specs: specs.length, cost: COST, groups: {} };
for (const G of GROUPS) {
  if (only && only.indexOf(G.key) < 0) continue;
  const r = runGroup(G); tl(G.key + ' done (' + r.inst + ' instruments)');
  const fam = {}; r.res.forEach(x => { const a = fam[x.f] || (fam[x.f] = { n: 0, d: 0, t: 0, c: 0, dd: 0, beat: 0 }); a.n++; a.d += x.dSh; a.t += x.tSh; a.c += x.tCagr; a.dd += x.tDD; if (x.tSh > r.hold.t.sharpe) a.beat++; });
  const famT = Object.keys(fam).map(k => ({ family: k, n: fam[k].n, designSharpe: fam[k].d / fam[k].n, testSharpe: fam[k].t / fam[k].n, testCagr: fam[k].c / fam[k].n, testDD: fam[k].dd / fam[k].n, shareBeatHold: fam[k].beat / fam[k].n }));
  const top = r.res.slice().sort((a, b) => b.dSh - a.dSh).slice(0, 20), all = r.res;
  out.groups[G.key] = { label: G.label, instruments: r.inst, windows: r.dates, cash: G.cash, hold: r.hold, library: r.lib, allMean: { design: mean(all.map(x => x.dSh)), test: mean(all.map(x => x.tSh)), testCagr: mean(all.map(x => x.tCagr)), testDD: mean(all.map(x => x.tDD)) },
    top20: { design: mean(top.map(x => x.dSh)), test: mean(top.map(x => x.tSh)) }, families: famT };
  fs.writeFileSync(path.join(__dirname, 'multi_results.json'), JSON.stringify(out));
}
tl('finished');
