/* Indicator audit.
 * 1) dumps signals.js + engine.js indicators on real NIFTY 50 OHLC to /tmp/ind_js.json (compared to the `ta` library by research/indicator_ref.py)
 * 2) truncation-invariance (no-lookahead) test: position at bar i must be identical whether or not future bars exist
 * 3) configuration audit: every family/param runs, yields no NaN/undefined, trades (non-constant) and warm-up is respected
 */
process.env.PINE = '1';
const fs = require('fs'), path = require('path'), S = require('../server/signals.js');
const rows = fs.readFileSync(path.join(__dirname, '../data/idx/nifty_50.csv'), 'utf8').trim().split('\n').slice(1).map(l => l.split(',')).filter(r => +r[4] > 0).map(r => ({ d: r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4] }));
const N = rows.length, a = k => Float64Array.from(rows.map(r => r[k]));
const o = a('o'), h = a('h'), l = a('l'), c = a('c'), X = S.makeCtx(o, h, l, c);
// engine internals (not exported): expose through a patched copy of the source in memory
let src = fs.readFileSync(path.join(__dirname, '../server/engine.js'), 'utf8');
src = src.replace('return { createBot, restoreBot,', 'return { _ind: { emaSeries, rsiLast, atrLast }, createBot, restoreBot,');
const m = { exports: {} }; new Function('module', 'exports', 'require', src)(m, m.exports, require);
const E = m.exports._ind; if (!E) throw new Error('engine patch failed');
const cand = rows.map(r => ({ o: r.o, h: r.h, l: r.l, c: r.c }));
const arr = f => Array.from(f, v => (Number.isFinite(v) ? v : null));
const out = { n: N, dates: rows.map(r => r.d), o: Array.from(o), h: Array.from(h), l: Array.from(l), c: Array.from(c), sig: {}, eng: {} };
[14, 20, 50, 200].forEach(n => { out.sig['sma' + n] = arr(X.sma(n)); out.sig['ema' + n] = arr(X.ema(n)); out.sig['std' + n] = arr(X.std(n)); });
[2, 7, 14, 21].forEach(n => out.sig['rsi' + n] = arr(X.rsi(n)));
[14, 20].forEach(n => { out.sig['atr' + n] = arr(X.atr(n)); out.sig['adx' + n] = arr(X.adx(n)); out.sig['cci' + n] = arr(X.cci(n)); out.sig['stoch' + n] = arr(X.stoch(n)); });
{ const { m, sg } = X.macd(12, 26, 9); out.sig.macd = arr(m); out.sig.macdsig = arr(sg); }
{ const { up, dn } = X.aroon(25); out.sig.aroonUp = arr(up); out.sig.aroonDn = arr(dn); }
out.sig.kama = arr(X.kama(10, 2, 30)); out.sig.roc20 = arr(X.roc(20));
out.sig.hh20 = arr(X.hh(20, true)); out.sig.ll20 = arr(X.ll(20, true));
// engine functions evaluated on rolling prefixes (last value) at 40 sample points
const pts = []; for (let i = 300; i < N; i += Math.floor((N - 300) / 40)) pts.push(i);
out.eng.pts = pts;
out.eng.rsi14 = pts.map(i => E.rsiLast(Array.from(c.slice(0, i + 1)), 14));
out.eng.atr14 = pts.map(i => E.atrLast(cand.slice(0, i + 1), 14));
out.eng.ema20 = pts.map(i => E.emaSeries(Array.from(c.slice(0, i + 1)), 20)[i]);
out.eng.ema50 = pts.map(i => E.emaSeries(Array.from(c.slice(0, i + 1)), 50)[i]);
fs.writeFileSync('/tmp/ind_js.json', JSON.stringify(out));
console.log('wrote /tmp/ind_js.json, bars', N);

// 2) truncation invariance + 3) config audit
const specs = S.allSpecs(), byF = {}; specs.forEach(s => (byF[s.f] = byF[s.f] || []).push(s));
const cuts = [400, 900, 1500, 2200, 2800].filter(k => k < N - 50);
const ctxCut = cuts.map(k => ({ k, x: S.makeCtx(o.slice(0, k), h.slice(0, k), l.slice(0, k), c.slice(0, k)) }));
let lookahead = [], cfg = [], famRows = [];
for (const f of Object.keys(byF)) {
  const L = byF[f]; const pick = [L[0], L[Math.floor(L.length / 3)], L[Math.floor(2 * L.length / 3)], L[L.length - 1]];
  let bad = 0, nanBad = 0, constant = 0, onFrac = [], firstOn = [];
  for (const sp of L.filter((_, i) => i % Math.max(1, Math.floor(L.length / 25)) === 0).concat(pick)) {
    const full = S.runSpec(X, sp);
    if (full.length !== N) { cfg.push(f + ' ' + JSON.stringify(sp.p) + ' length ' + full.length); continue; }
    let on = 0, first = -1; for (let i = 0; i < N; i++) { if (full[i] !== 0 && full[i] !== 1) nanBad++; if (full[i] === 1) { on++; if (first < 0) first = i; } }
    onFrac.push(on / N); firstOn.push(first); if (on === 0 || on === N) constant++;
    for (const { k, x } of ctxCut) { const cut = S.runSpec(x, sp); for (let i = 0; i < k; i++) if (cut[i] !== full[i]) { bad++; lookahead.push(f + ' ' + JSON.stringify(sp.p) + ' cut@' + k + ' bar ' + i); break; } }
  }
  famRows.push({ f, tested: onFrac.length, lookahead: bad, nonBinary: nanBad, constantSeries: constant, avgTimeInMarket: +(onFrac.reduce((a, b) => a + b, 0) / onFrac.length).toFixed(2) });
}
console.log('\nfamily lookahead nonBinary constant timeInMkt');
famRows.forEach(r => console.log(r.f.padEnd(18), r.lookahead, r.nonBinary, r.constantSeries, r.avgTimeInMarket));
console.log('\nLOOKAHEAD VIOLATIONS:', lookahead.length); lookahead.slice(0, 15).forEach(x => console.log('  ' + x));
console.log('CONFIG ISSUES:', cfg.length); cfg.slice(0, 15).forEach(x => console.log('  ' + x));
fs.writeFileSync(path.join(__dirname, 'indicator_audit.json'), JSON.stringify({ families: famRows, lookahead, cfg }, null, 1));
