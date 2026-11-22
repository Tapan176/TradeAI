/* Strategy factory: generate thousands of long/flat strategies, test them on 24 NSE indices with costs, filter with multiple-testing control. */
const fs = require('fs'), path = require('path');
const S = require('../server/signals.js');
const SYMS = ['NIFTY_100','NIFTY_200','NIFTY_50','NIFTY_500','NIFTY_AUTO','NIFTY_BANK','NIFTY_COMMODITIES','NIFTY_DIVIDEND_OPPORTUNITIES_50','NIFTY_ENERGY','NIFTY_FINANCIAL_SERVICES','NIFTY_FMCG','NIFTY_INDIA_CONSUMPTION','NIFTY_INFRASTRUCTURE','NIFTY_IT','NIFTY_MEDIA','NIFTY_METAL','NIFTY_MIDCAP_50','NIFTY_MNC','NIFTY_NEXT_50','NIFTY_PHARMA','NIFTY_PSE','NIFTY_PSU_BANK','NIFTY_REALTY','NIFTY_SERVICES_SECTOR'];
const COST = 0.001, RF = 0.05 / 252, DESIGN = ['2013-03-01', '2018-12-31'], TEST = ['2019-01-01', '9999'];
const t00 = Date.now(), tl = (m) => console.error(((Date.now() - t00) / 1000).toFixed(0) + 's', m);

/* ---------- data on a common calendar (Nifty 50 trading days) ---------- */
const read = f => fs.readFileSync(path.join(__dirname, '../data/idx', f.toLowerCase() + '.csv'), 'utf8').trim().split('\n').slice(1).map(l => l.split(',')).filter(r => +r[4] > 0).map(r => ({ d: r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4] }));
const raw = {}; SYMS.forEach(s => { raw[s] = read(s); });
const cal = raw.NIFTY_50.map(r => r.d), T = cal.length, di = {}; cal.forEach((d, i) => { di[d] = i; });
const idx = SYMS.map(s => {
  const rows = raw[s].filter(r => r.d in di), start = di[rows[0].d];   // series on calendar days only
  const o = new Float64Array(rows.length), h = new Float64Array(rows.length), l = new Float64Array(rows.length), c = new Float64Array(rows.length), pos = [];
  rows.forEach((r, i) => { o[i] = r.o; h[i] = r.h; l[i] = r.l; c[i] = r.c; pos.push(di[r.d]); });
  const ret = new Float32Array(T);   // calendar-aligned returns (0 on missing days / before start)
  for (let i = 1; i < rows.length; i++) { const a = pos[i - 1], b = pos[i]; ret[b] = c[i] / c[i - 1] - 1; }   // a gap-day return lands on day b
  return { s, ctx: S.makeCtx(o, h, l, c), pos, ret, start: pos[0], n: rows.length };
});
const wIdx = (w) => { let a = cal.findIndex(d => d >= w[0]); let b = cal.length - 1; for (let i = cal.length - 1; i >= 0; i--) if (cal[i] <= w[1]) { b = i; break; } return [a, b]; };
const [dA, dB] = wIdx(DESIGN), [tA, tB] = wIdx(TEST);
const nValid = new Float32Array(T); idx.forEach(x => { for (let t = x.start + 1; t < T; t++) nValid[t]++; });
tl('data loaded: ' + SYMS.length + ' indices, ' + T + ' days, design ' + cal[dA] + '→' + cal[dB] + ', test ' + cal[tA] + '→' + cal[tB]);

/* ---------- evaluation ---------- */
function fillPos(x, pos, out) {   // calendar-aligned position (carry over missing days)
  out.fill(0); let k = 0, cur = 0;
  for (let t = x.start; t < T; t++) { while (k < x.n && x.pos[k] <= t) { cur = pos[k]; k++; } out[t] = cur; }
}
const pbuf = idx.map(() => new Int8Array(T));
function evalSpec(posByIdx, keepIdxStats, shiftOff) {
  const port = new Float32Array(T), per = keepIdxStats ? idx.map(() => ({ d: [0, 0, 0], t: [0, 0, 0] })) : null;
  idx.forEach((x, i) => {
    const p = posByIdx[i], sh = shiftOff ? shiftOff[i] : 0, r = x.ret;
    for (let t = x.start + 2; t < T; t++) {
      const a = p[((t - 1 - sh) % T + T) % T], b = p[((t - 2 - sh) % T + T) % T];
      const v = a * r[t] + (1 - a) * RF - (a !== b ? COST : 0);
      port[t] += v / nValid[t];
      if (per) { if (t >= dA && t <= dB) { const q = per[i].d; q[0]++; q[1] += v - RF; q[2] += (v - RF) * (v - RF); } else if (t >= tA && t <= tB) { const q = per[i].t; q[0]++; q[1] += v - RF; q[2] += (v - RF) * (v - RF); } }
    }
  });
  return { port, per };
}
function stats(port, a, b) {   // excess Sharpe, cagr, maxdd over [a,b]
  let n = 0, s = 0, q = 0, eq = 1, pk = 1, dd = 0;
  for (let t = a; t <= b; t++) { const e = port[t] - RF; n++; s += e; q += e * e; eq *= 1 + port[t]; pk = Math.max(pk, eq); dd = Math.max(dd, 1 - eq / pk); }
  const m = s / n, sd = Math.sqrt(Math.max(q / n - m * m, 1e-18));
  return { sharpe: m / sd * Math.sqrt(252), cagr: Math.pow(eq, 252 / n) - 1, dd, n };
}
const sh = q => q[0] > 30 ? (q[1] / q[0]) / Math.sqrt(Math.max(q[2] / q[0] - Math.pow(q[1] / q[0], 2), 1e-18)) * Math.sqrt(252) : NaN;

/* ---------- run every spec ---------- */
const specs = S.allSpecs(); tl('specs: ' + specs.length);
const R = [], PORT = [], POS = [];
const hold = evalSpec(idx.map((x, i) => { const p = new Int8Array(T); for (let t = x.start; t < T; t++) p[t] = 1; return p; }), true);
const bh = { d: stats(hold.port, dA, dB), t: stats(hold.port, tA, tB) };
let done = 0;
for (const sp of specs) {
  idx.forEach((x, i) => { fillPos(x, S.runSpec(x.ctx, sp), pbuf[i]); });
  const ev = evalSpec(pbuf, true);
  const dS = stats(ev.port, dA, dB), tS = stats(ev.port, tA, tB);
  let expo = 0, chg = 0, cnt = 0; idx.forEach((x, i) => { const p = pbuf[i]; for (let t = dA; t <= tB; t++) { expo += p[t]; cnt++; if (p[t] !== p[t - 1]) chg++; } });
  const brD = ev.per.filter(q => sh(q.d) > 0).length / idx.length, brT = ev.per.filter(q => sh(q.t) > 0).length / idx.length;
  R.push({ f: sp.f, p: sp.p, dSh: dS.sharpe, tSh: tS.sharpe, dCagr: dS.cagr, tCagr: tS.cagr, dDD: dS.dd, tDD: tS.dd, brD, brT, expo: expo / cnt, turn: chg / idx.length / ((tB - dA) / 252) });
  PORT.push(ev.port);
  // keep calendar positions for null shifting (int8 per idx) only for specs we may need: store compactly
  POS.push(pbuf.map(p => Int8Array.from(p)));
  if (++done % 1000 === 0) tl(done + '/' + specs.length);
}
tl('evaluated all specs');

/* ---------- null: circularly shift each index's position series by a random offset (keeps exposure/turnover, destroys timing) ---------- */
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const NREP = 3, nullSh = [], maxPerRep = [];
for (let rep = 0; rep < NREP; rep++) {
  let mx = -9;
  for (let k = 0; k < specs.length; k++) {
    const off = idx.map(() => Math.floor(200 + rnd() * (T - 400)));
    const ev = evalSpec(POS[k], false, off), d = stats(ev.port, dA, dB).sharpe; nullSh.push(d); if (d > mx) mx = d;
  }
  maxPerRep.push(mx); tl('null rep ' + (rep + 1) + ' best ' + mx.toFixed(2));
}
nullSh.sort((a, b) => a - b);
const q = p => nullSh[Math.min(nullSh.length - 1, Math.floor(p * nullSh.length))];
const thr = { p95: q(0.95), p99: q(0.99), p999: q(0.999), maxRep: Math.min.apply(null, maxPerRep) };
tl('null design-Sharpe quantiles: p95 ' + thr.p95.toFixed(2) + ' p99 ' + thr.p99.toFixed(2) + ' p99.9 ' + thr.p999.toFixed(2) + ' max-of-' + specs.length + ' (min over reps) ' + thr.maxRep.toFixed(2));

/* ---------- filter & out-of-sample check ---------- */
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const med = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const corr = (a, b, s, e) => { let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0; for (let t = s; t <= e; t++) { n++; sa += a[t]; sb += b[t]; saa += a[t] * a[t]; sbb += b[t] * b[t]; sab += a[t] * b[t]; } return (sab / n - sa / n * sb / n) / Math.sqrt((saa / n - Math.pow(sa / n, 2)) * (sbb / n - Math.pow(sb / n, 2)) + 1e-18); };
const finite = R.filter(r => isFinite(r.dSh) && isFinite(r.tSh));
const summ = (arr, nm) => ({ set: nm, n: arr.length, designSharpe: mean(arr.map(r => r.dSh)), testSharpe: mean(arr.map(r => r.tSh)), testCagr: mean(arr.map(r => r.tCagr)), testDD: mean(arr.map(r => r.tDD)), shareTestBeatsHold: arr.filter(r => r.tSh > bh.t.sharpe).length / arr.length });
const survivors = finite.filter(r => r.dSh > thr.p999 && r.brD >= 0.7 && r.dDD < 0.25);
const topN = finite.slice().sort((a, b) => b.dSh - a.dSh).slice(0, Math.max(20, survivors.length));
const rho = (() => { const x = finite.map(r => r.dSh), y = finite.map(r => r.tSh), rk = a => { const o = a.map((v, i) => [v, i]).sort((p, q2) => p[0] - q2[0]), r2 = new Array(a.length); o.forEach((e, k) => { r2[e[1]] = k; }); return r2; }, rx = rk(x), ry = rk(y), n = x.length, d2 = rx.reduce((s, v, i) => s + (v - ry[i]) * (v - ry[i]), 0); return 1 - 6 * d2 / (n * (n * n - 1)); })();
const families = {}; finite.forEach(r => { const f = families[r.f] || (families[r.f] = { n: 0, d: 0, t: 0 }); f.n++; f.d += r.dSh; f.t += r.tSh; });
const famTable = Object.keys(families).map(k => ({ family: k, n: families[k].n, designSharpe: families[k].d / families[k].n, testSharpe: families[k].t / families[k].n })).sort((a, b) => b.testSharpe - a.testSharpe);

/* ---------- walk-forward: every year pick top-K by trailing 5y robust score (past data only), hold it for the next year ---------- */
function wf(K, scoreFn) {
  const out = new Float32Array(T); let start = -1;
  const years = []; for (let y = 2016; y <= 2026; y++) { const a = cal.findIndex(d => d >= y + '-01-01'), b0 = cal.findIndex(d => d >= (y + 1) + '-01-01'); if (a >= 0) years.push([y, a, b0 < 0 ? T - 1 : b0 - 1]); }
  for (const [y, a, b] of years) {
    const from = Math.max(0, a - 252 * 5), sc = [];
    for (let k = 0; k < specs.length; k++) { const s = stats(PORT[k], from, a - 1); if (isFinite(s.sharpe)) sc.push([scoreFn(s, k), k]); }
    sc.sort((p, q2) => q2[0] - p[0]); const pick = sc.slice(0, K).map(e => e[1]);
    for (let t = a; t <= b; t++) { let v = 0; pick.forEach(k => { v += PORT[k][t]; }); out[t] = v / pick.length; }
    if (start < 0) start = a;
  }
  return { port: out, start };
}
const wfTop = wf(25, s => s.sharpe);
const eqAll = (() => { const out = new Float32Array(T); for (let t = 0; t < T; t++) { let v = 0; for (let k = 0; k < specs.length; k++) v += PORT[k][t]; out[t] = v / specs.length; } return out; })();
const wfStats = (p) => stats(p, wfTop.start, tB);
const wfRes = { 'walk-forward top-25 (re-picked yearly on trailing 5y)': wfStats(wfTop.port), ['equal-weight of ALL ' + specs.length + ' strategies']: wfStats(eqAll), 'buy & hold (equal-weight 24 indices)': stats(hold.port, wfTop.start, tB) };

/* ---------- library: diversified survivors (correlation-pruned) ---------- */
const lib = []; const pool = (survivors.length >= 10 ? survivors : topN).slice().sort((a, b) => b.dSh - a.dSh);
for (const r of pool) { const k = R.indexOf(r); if (lib.every(m => corr(PORT[m.k], PORT[k], dA, dB) < 0.93)) lib.push({ k, r }); if (lib.length >= 25) break; }
const ens = new Float32Array(T); for (let t = 0; t < T; t++) { let v = 0; lib.forEach(m => { v += PORT[m.k][t]; }); ens[t] = lib.length ? v / lib.length : 0; }
const libStats = { design: stats(ens, dA, dB), test: stats(ens, tA, tB) };

/* ---------- robust library: pick FAMILIES by design-period mean Sharpe, then diversified above-median members (no per-spec cherry-picking) ---------- */
const famD = {}; finite.forEach(r => { (famD[r.f] = famD[r.f] || []).push(r); });
const famRank = Object.keys(famD).filter(f => f !== 'combo' && !(S.FAMILIES[f] && S.FAMILIES[f].pine)).map(f => ({ f, m: mean(famD[f].map(r => r.dSh)) })).sort((a, b) => b.m - a.m).slice(0, 8);
const rlib = [];
famRank.forEach(({ f }) => {
  const arr = famD[f], md = med(arr.map(r => r.dSh)), cand = arr.filter(r => r.dSh >= md && r.brD >= 0.7 && r.dDD < 0.3).sort((a, b) => b.dSh - a.dSh);
  let c = 0; for (const r of cand) { const k = R.indexOf(r); if (rlib.every(m => corr(PORT[m.k], PORT[k], dA, dB) < 0.9)) { rlib.push({ k, r }); if (++c >= 3) break; } }
});
const rens = new Float32Array(T); for (let t = 0; t < T; t++) { let v = 0; rlib.forEach(m => { v += PORT[m.k][t]; }); rens[t] = rlib.length ? v / rlib.length : 0; }
const robust = { families: famRank.map(x => x.f), members: rlib.length, design: stats(rens, dA, dB), test: stats(rens, tA, tB), testFull: stats(rens, tA, tB) };
const trendAll = (() => { const o = new Float32Array(T); let n = 0; const tf = new Set(famRank.map(x => x.f)); for (let k = 0; k < specs.length; k++) if (tf.has(specs[k].f)) { n++; for (let t = 0; t < T; t++) o[t] += PORT[k][t]; } for (let t = 0; t < T; t++) o[t] /= n; return { design: stats(o, dA, dB), test: stats(o, tA, tB), n }; })();

/* ---------- Pine-style families: honest per-family verdicts ---------- */
const pineRes = Object.keys(S.FAMILIES).filter(f => S.FAMILIES[f].pine && famD[f]).map(f => {
  const a = famD[f], bestD = a.slice().sort((x, y) => y.dSh - x.dSh)[0], medV = med(a.map(r => r.tSh));
  const meanT = mean(a.map(r => r.tSh)), meanD = mean(a.map(r => r.dSh));
  const status = meanT >= bh.t.sharpe && meanD >= thr.p95 ? 'passed' : (meanT >= 0.45 || bestD.tSh >= bh.t.sharpe) ? 'testing' : 'rejected';
  return { family: f, name: S.FAMILIES[f].name, variants: a.length, meanDesignSharpe: meanD, meanTestSharpe: meanT, medianTestSharpe: medV, meanTestCagr: mean(a.map(r => r.tCagr)), meanTestDD: mean(a.map(r => r.tDD)), exposure: mean(a.map(r => r.expo)),
    shareBeatHold: a.filter(r => r.tSh > bh.t.sharpe).length / a.length, best: { p: bestD.p, designSharpe: bestD.dSh, testSharpe: bestD.tSh, testCagr: bestD.tCagr }, status };
}).sort((a, b) => b.meanTestSharpe - a.meanTestSharpe);

const out = {
  generated: new Date().toISOString(), specs: specs.length, indices: SYMS.length, design: DESIGN, test: TEST, cost: COST, cash: 0.05,
  hold: bh, nullQuantiles: thr, rankCorrelationDesignVsTest: rho,
  all: summ(finite, 'all strategies'), top100ByDesign: summ(finite.slice().sort((a, b) => b.dSh - a.dSh).slice(0, 100), 'top 100 by design Sharpe'), top20ByDesign: summ(finite.slice().sort((a, b) => b.dSh - a.dSh).slice(0, 20), 'top 20 by design Sharpe'),
  survivorsCount: survivors.length, survivors: summ(survivors, 'survivors (design Sharpe > null p99.9, breadth>=70%, DD<25%)'),
  walkForward: wfRes, ensemble: { members: lib.length, stats: libStats }, robust, topFamiliesAll: trendAll, pine: pineRes,
  families: famTable,
  libraryRobust: rlib.map(m => ({ f: m.r.f, p: m.r.p, designSharpe: m.r.dSh, testSharpe: m.r.tSh })), library: lib.map(m => ({ f: m.r.f, p: m.r.p, designSharpe: m.r.dSh, testSharpe: m.r.tSh, testCagr: m.r.tCagr, testDD: m.r.tDD, breadthDesign: m.r.brD, breadthTest: m.r.brT, exposure: m.r.expo, turnoverPerYr: m.r.turn }))
};
fs.writeFileSync(path.join(__dirname, 'factory_results.json'), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(__dirname, '../server/replay/strategy_library.json'), JSON.stringify({ generated: out.generated, note: 'survivors of the strategy factory; see research/factory_results.json', specs: rlib.map(m => ({ f: m.r.f, p: m.r.p })), cherryPicked: lib.map(m => ({ f: m.r.f, p: m.r.p })) }));
console.log(JSON.stringify(out, (k, v) => typeof v === 'number' ? Math.round(v * 1000) / 1000 : v, 1).slice(0, 6000));
