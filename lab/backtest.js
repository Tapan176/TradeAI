'use strict';
/* Intraday backtester that mirrors the live AI-Lab rule bot (same indicators, same ATR stop/target, same fees + slippage, stop-first on a bar that touches both).
 * Runs on the server because only Render can reach the market-data hosts. Results go to GET /api/backtest and to the log (one JSON line per run).
 *
 * What it answers (the questions behind "why did the bots lose money?"):
 *   1. How much of each trade's risk (1R = stop distance) is eaten by fees+slippage?  (cost-in-R = round-trip cost / stop distance)
 *   2. Does the live rule beat RANDOM entries that use the same exits + costs?  (if not, it has no entry edge)
 *   3. Does any variant keep working OUT OF SAMPLE?  (first 60% of the timeline chooses, last 40% judges; median variant is reported next to the best one)
 * Honest limits: without Upstox, Yahoo only serves ~60 days of 15m bars (out-of-sample ~3 weeks); with UPSTOX_TOKEN set, Indian 15m history goes back to 2022. Treat everything as "evidence of what NOT to trade", not proof of an edge.
 * Upstox historical candles (minutes since 2022) are the way to get a conclusive sample. */
const D = require('./data.js'), P = require('./paper.js'), UPX = require('./upstox.js');
const S = (() => { try { return require('../signals.js'); } catch (e) { return require('../../signals.js'); } })();
const E = process.env;
const SYMS = { IN: (E.BT_SYMS_IN || '^NSEI,^NSEBANK,RELIANCE.NS,HDFCBANK.NS').split(',').map(s => s.trim()).filter(Boolean), CRYPTO: (E.BT_SYMS_CRYPTO || 'BTC-USD,ETH-USD').split(',').map(s => s.trim()).filter(Boolean) };
const FEE = P.CFG.feeBps, SLIP = P.CFG.slipBps;
const r2 = P.r2, r3 = x => Math.round(x * 1000) / 1000;
const tick = () => new Promise(r => setImmediate(r));

const st = { running: false, startedAt: 0, finishedAt: 0, progress: '', error: null, result: null, data: {}, dataAt: 0 };

/* ---------- series prep ---------- */
function istMins(t) { const d = new Date((t + 19800) * 1000); return d.getUTCHours() * 60 + d.getUTCMinutes(); }
function istDate(t) { return new Date((t + 19800) * 1000).toISOString().slice(0, 10); }
function inSession(cs) {   // keep only regular NSE session bars (Yahoo can include odd prints)
  return cs.filter(b => { const m = istMins(b.t); return m >= 555 && m < 930; });
}
function aggregate(cs, book, secs) {
  const out = []; let cur = null, key = null;
  cs.forEach(b => {
    const k = book === 'IN' ? istDate(b.t) + '|' + Math.floor((istMins(b.t) - 555) / (secs / 60)) : Math.floor(b.t / secs);
    if (k !== key) { if (cur) out.push(cur); cur = { t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v || 0 }; key = k; }
    else { cur.h = Math.max(cur.h, b.h); cur.l = Math.min(cur.l, b.l); cur.c = b.c; cur.v += b.v || 0; }
  });
  if (cur) out.push(cur); return out;
}
function prep(cs, book, tfSec) {
  const X = S.ctxFromCandles(cs);
  return { cs, X, book, tfSec, atr: X.atr(14), ema20: X.ema(20), ema50: X.ema(50), ema100: X.ema(100), rsi: X.rsi(14), rsi2: X.rsi(2), adx: X.adx(14), h20: X.hh(20, true), l20: X.ll(20, true), sigs: {} };
}

/* ---------- entry signals (computed once per series) ---------- */
function signals(sr, strat) {
  if (sr.sigs[strat]) return sr.sigs[strat];
  const { cs, book } = sr, n = cs.length, s = new Int8Array(n), c = i => cs[i].c;
  const okv = (...a) => a.every(Number.isFinite);
  let orH = 0, orL = 0, orDay = '', fired = 0;
  for (let i = 100; i < n; i++) {
    const px = c(i), e20 = sr.ema20[i], e50 = sr.ema50[i], e100 = sr.ema100[i], rsi = sr.rsi[i], rsi2 = sr.rsi2[i], adx = sr.adx[i];
    if (!okv(px, e20, e50, e100, rsi, rsi2, adx, sr.atr[i])) continue;
    if (strat === 'rule' || strat === 'rule_f') {
      let v = 0;
      if (px > e20 && e20 > e50 && adx >= 20 && rsi >= 50 && rsi <= 72) v = 1; else if (px < e20 && e20 < e50 && adx >= 20 && rsi >= 28 && rsi <= 50) v = -1;
      if (strat === 'rule_f' && v) { if (adx < 25 || (v > 0 && px < e100) || (v < 0 && px > e100)) v = 0; }
      s[i] = v;
    } else if (strat === 'donch') {
      if (px > sr.h20[i] && adx >= 20 && px > e100) s[i] = 1; else if (px < sr.l20[i] && adx >= 20 && px < e100) s[i] = -1;
    } else if (strat === 'rsi2') {
      if (rsi2 < 10 && px > e100) s[i] = 1; else if (rsi2 > 90 && px < e100) s[i] = -1;
    } else if (strat === 'orb' && book === 'IN' && sr.tfSec === 900) {
      const d = istDate(cs[i].t), m = istMins(cs[i].t);
      if (d !== orDay) { orDay = d; orH = -Infinity; orL = Infinity; fired = 0; }
      if (m < 585) { orH = Math.max(orH, cs[i].h); orL = Math.min(orL, cs[i].l); }
      else if (!fired && orH > orL) { if (px > orH) { s[i] = 1; fired = 1; } else if (px < orL) { s[i] = -1; fired = 1; } }
    }
  }
  return (sr.sigs[strat] = s);
}
function randSignals(sr, seed, p) {
  const n = sr.cs.length, s = new Int8Array(n); let x = seed * 2654435761 >>> 0; const rnd = () => (x = (x * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 100; i < n; i++) if (rnd() < p) s[i] = rnd() < 0.5 ? -1 : 1; return s;
}

/* ---------- simulator ---------- */
const WIN = { live: [555, 900], tight: [585, 870] };   // entry-bar start window (IST minutes) for Indian instruments
function simulate(sr, sig, cfg) {
  const { cs, atr, book, tfSec } = sr, n = cs.length, out = [], feeF = FEE[book] / 1e4, slipF = SLIP[book] / 1e4, rtF = 2 * (feeF + slipF), cool = tfSec === 900 ? 4 : 2, w = WIN[cfg.win] || WIN.live;
  let i = 100;
  while (i < n - 2) {
    const side = sig[i]; if (!side || (cfg.sides === 'long' && side < 0)) { i++; continue; }
    const j = i + 1, bj = cs[j];
    if (book === 'IN') { if (istDate(cs[i].t) !== istDate(bj.t)) { i++; continue; } const m = istMins(bj.t); if (m < w[0] || m >= w[1]) { i++; continue; } }
    else if (bj.t - cs[i].t > tfSec * 1.5) { i++; continue; }
    const a = atr[i], sd = cfg.stop * a, entry = bj.o * (1 + side * slipF), costR = rtF * entry / sd;
    if (!(sd > 0) || (cfg.gate && costR > cfg.gate)) { i++; continue; }
    let stop = entry - side * sd, tgt = cfg.tgt ? entry + side * cfg.tgt * a : null, ext = entry, k = j, exit = null, why = '';
    for (; k < n; k++) {
      const b = cs[k], lowHit = side > 0 ? b.l <= stop : b.h >= stop;
      if (lowHit) { const gap = side > 0 ? b.o < stop : b.o > stop; exit = gap ? b.o : stop; why = 'stop'; break; }
      if (tgt != null && (side > 0 ? b.h >= tgt : b.l <= tgt)) { const gap = side > 0 ? b.o > tgt : b.o < tgt; exit = gap ? b.o : tgt; why = 'target'; break; }
      if (cfg.trail) { ext = side > 0 ? Math.max(ext, b.h) : Math.min(ext, b.l); const ns = ext - side * cfg.trail * a; stop = side > 0 ? Math.max(stop, ns) : Math.min(stop, ns); }
      const endM = book === 'IN' ? istMins(b.t) + tfSec / 60 : 0;
      if ((book === 'IN' && endM >= 915) || k - j + 1 >= cfg.hold) { exit = b.c; why = book === 'IN' && endM >= 915 ? 'eod' : 'time'; break; }
      if (k === n - 1) { exit = b.c; why = 'end'; break; }
    }
    if (exit == null) break;
    const xf = exit * (1 - side * slipF), gross = side * (xf - entry) / sd, net = gross - (2 * feeF * entry) / sd;
    out.push({ t0: bj.t, t1: cs[Math.min(k, n - 1)].t, side, r: net, costR: costR, why });
    i = Math.min(k, n - 1) + cool;
  }
  return out;
}
const sd = a => { const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / Math.max(1, a.length - 1)); };
function stats(tr) {
  const n = tr.length; if (!n) return { n: 0 };
  const R = tr.map(t => t.r), mean = R.reduce((s, x) => s + x, 0) / n, s = n > 1 ? sd(R) : 0, gw = R.filter(x => x > 0).reduce((a, x) => a + x, 0), gl = -R.filter(x => x <= 0).reduce((a, x) => a + x, 0);
  const sorted = tr.slice().sort((a, b) => a.t1 - b.t1); let cum = 0, pk = 0, dd = 0; sorted.forEach(t => { cum += t.r; if (cum > pk) pk = cum; dd = Math.max(dd, pk - cum); });
  return { n, hit: R.filter(x => x > 0).length / n, expR: mean, pf: gl > 0 ? gw / gl : null, t: s > 0 ? mean / (s / Math.sqrt(n)) : 0, sumR: cum, ddR: dd, costR: tr.reduce((a, x) => a + x.costR, 0) / n };
}
const rnd = o => { const q = {}; Object.keys(o).forEach(k => { q[k] = typeof o[k] === 'number' ? r3(o[k]) : o[k]; }); return q; };

/* ---------- run ---------- */
const EXITS = [[1, 1.5, 0], [1, 2.5, 0], [1, 4, 0], [1.5, 1.5, 0], [1.5, 2.5, 0], [1.5, 4, 0], [2.5, 1.5, 0], [2.5, 2.5, 0], [2.5, 4, 0], [2, 0, 2], [3, 0, 3]];   // [stop ATR, target ATR (0 = none), trail ATR (0 = none)]
const STRATS = ['rule', 'rule_f', 'donch', 'rsi2', 'orb'];
async function loadSeries(book, days) {
  if (st.data[book] && Date.now() - st.dataAt < 3 * 3600e3) return st.data[book];
  const out = [];
  for (const sym of SYMS[book]) {
    st.progress = 'downloading ' + sym;
    try { let cs = await D.history15(sym, book === 'CRYPTO' ? Math.min(days, +E.BT_CRYPTO_DAYS || 120) : days); if (book === 'IN') cs = inSession(cs); if (cs.length > 300) out.push({ sym, cs }); } catch (e) { out.push({ sym, err: e.message, cs: [] }); }
    await D.sleep(150);
  }
  st.data[book] = out; st.dataAt = Date.now(); return out;
}
async function runBook(book, days) {
  const series = (await loadSeries(book, days)).filter(x => x.cs.length > 300), meta = { syms: [], variants: 0 };
  if (!series.length) return { book, error: 'no data' };
  const tfs = [900, 3600], variants = [], allT0 = [];
  const prepped = [];
  series.forEach(s => {
    meta.syms.push({ sym: s.sym, bars: s.cs.length, from: s.cs[0].t, to: s.cs[s.cs.length - 1].t, buyHoldPct: r2((s.cs[s.cs.length - 1].c / s.cs[0].o - 1) * 100) });
    tfs.forEach(tf => prepped.push({ sym: s.sym, tf, sr: prep(tf === 900 ? s.cs : aggregate(s.cs, book, tf), book, tf) }));
    allT0.push(s.cs[0].t, s.cs[s.cs.length - 1].t);
  });
  const tMin = Math.min.apply(null, allT0), tMax = Math.max.apply(null, allT0), tSplit = tMin + (tMax - tMin) * 0.6;
  const wins = book === 'IN' ? ['live', 'tight'] : ['live'], holds = [16, 48], sidesL = ['both', 'long'], gates = [0, 0.2];
  /* cost anatomy at the live setting (1.5 ATR stop) */
  const rt = 2 * (FEE[book] + SLIP[book]) / 1e4, anatomy = {};
  prepped.forEach(p => { const a = p.sr.atr, cs = p.sr.cs, xs = []; for (let i = 100; i < cs.length; i += 3) if (Number.isFinite(a[i])) xs.push(1.5 * a[i] / cs[i].c); xs.sort((x, y) => x - y); const med = xs[xs.length >> 1] || 0; (anatomy[p.tf] = anatomy[p.tf] || []).push(med); });
  const costAnatomy = {}; Object.keys(anatomy).forEach(tf => { const m = anatomy[tf].reduce((s, x) => s + x, 0) / anatomy[tf].length; costAnatomy[tf === '900' ? '15m' : '1h'] = { stopPct: r3(m * 100), roundTripBps: r2(rt * 1e4), costInR: r3(rt / m), breakEvenHitRate_at_RR1_67: r3((1 + rt / m) / (1 + 2.5 / 1.5)) }; });
  let done = 0; const total = STRATS.length * tfs.length;
  for (const strat of STRATS) for (const tf of tfs) {
    st.progress = book + ' ' + strat + ' ' + (tf === 900 ? '15m' : '1h') + ' (' + (++done) + '/' + total + ')'; await tick();
    const group = prepped.filter(p => p.tf === tf); if (strat === 'orb' && (book !== 'IN' || tf !== 900)) continue;
    const sigs = group.map(p => signals(p.sr, strat));
    for (const [stopA, tgtA, trailA] of EXITS) { await tick(); for (const hold of holds) for (const sides of sidesL) for (const gate of gates) for (const win of wins) {
      const cfg = { stop: stopA, tgt: tgtA, trail: trailA, hold, sides, gate, win }, all = [];
      group.forEach((p, gi) => simulate(p.sr, sigs[gi], cfg).forEach(t => all.push(t)));
      if (all.length < 8) continue;
      const is = all.filter(t => t.t0 < tSplit), oos = all.filter(t => t.t0 >= tSplit), a = stats(all), si = stats(is), so = stats(oos);
      variants.push({ id: strat + '|' + (tf === 900 ? '15m' : '1h') + '|' + stopA + '/' + (trailA ? 'trail' + trailA : tgtA) + '|h' + hold + '|' + sides + '|g' + gate + '|' + win, strat, tf: tf === 900 ? '15m' : '1h', stop: stopA, tgt: tgtA, trail: trailA, hold, sides, gate, win,
        n: a.n, hit: a.hit, expR: a.expR, pf: a.pf, t: a.t, sumR: a.sumR, ddR: a.ddR, costR: a.costR, isN: si.n || 0, isExp: si.n ? si.expR : null, oosN: so.n || 0, oosExp: so.n ? so.expR : null, oosT: so.n ? so.t : null, oosHit: so.n ? so.hit : null });
    } }
  }
  /* random-entry null: same exits/costs, random side at random bars (p=2% per bar), 6 seeds */
  st.progress = book + ' random baseline'; await tick();
  const nullR = [];
  for (const tf of tfs) for (const [stopA, tgtA, trailA] of EXITS) {
    const group = prepped.filter(p => p.tf === tf), vals = [];
    for (let seed = 1; seed <= 6; seed++) { const all = []; group.forEach((p, gi) => simulate(p.sr, randSignals(p.sr, seed * 97 + gi, 0.02), { stop: stopA, tgt: tgtA, trail: trailA, hold: 48, sides: 'both', gate: 0, win: 'live' }).forEach(t => all.push(t))); if (all.length) vals.push(stats(all).expR); }
    if (vals.length) nullR.push({ tf: tf === 900 ? '15m' : '1h', stop: stopA, tgt: tgtA, trail: trailA, expR: vals.reduce((s, x) => s + x, 0) / vals.length });
  }
  const find = id => variants.find(v => v.id === id);
  const live = find('rule|15m|1.5/2.5|h48|both|g0|live'), liveNull = nullR.find(x => x.tf === '15m' && x.stop === 1.5 && x.tgt === 2.5);
  /* walk-forward selection: pick by in-sample expectancy (n>=25), judge on the untouched tail */
  const elig = variants.filter(v => v.isN >= 25 && v.oosN >= 8), byIS = elig.slice().sort((a, b) => b.isExp - a.isExp), top = byIS.slice(0, 10), oosVals = elig.map(v => v.oosExp).sort((a, b) => a - b);
  const median = a => a.length ? a[a.length >> 1] : null, gateOn = elig.filter(v => v.gate), gateOff = elig.filter(v => !v.gate);
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  const byStrat = STRATS.map(sn => { const vs = elig.filter(v => v.strat === sn); if (!vs.length) return null; return { strat: sn, variants: vs.length, medianOosExpR: r3(median(vs.map(v => v.oosExp).sort((a, b) => a - b))), shareOosPositive: r3(vs.filter(v => v.oosExp > 0).length / vs.length), bestIS: rnd(vs.slice().sort((a, b) => b.isExp - a.isExp)[0]) }; }).filter(Boolean);
  const nTrials = variants.length, tDefl = +Math.sqrt(2 * Math.log(Math.max(2, nTrials))).toFixed(2);   // expected best t-stat among N pure-noise trials (Bailey & López de Prado idea): a real edge must clear this, not just 1.5
  const seenW = new Set();
  const winners = elig.filter(v => v.isExp >= 0.1 && v.oosExp >= 0.1 && v.oosN >= 20 && v.oosT >= 1.5)
    .sort((a, b) => b.oosExp - a.oosExp || (a.gate ? 1 : 0) - (b.gate ? 1 : 0) || (a.win === 'live' ? 0 : 1) - (b.win === 'live' ? 0 : 1))
    .filter(v => { const k = [v.strat, v.tf, v.stop, v.tgt, v.trail, v.hold, v.sides, v.isN, v.oosN, v.isExp, v.oosExp].join('|'); if (seenW.has(k)) return false; seenW.add(k); return true; }).slice(0, 10).map(v => Object.assign(v, { defl: v.oosT >= tDefl }));   // variants that behave identically (a gate or window that never changed a trade) are listed once
  const res = {
    book, syms: meta.syms, split: tSplit, variantsTested: variants.length, costAnatomy,
    live: live ? rnd(live) : null, liveNullExpR: liveNull ? r3(liveNull.expR) : null,
    walkForward: { selectedByInSample: top.map(rnd), medianOosExpR: r3(median(oosVals)), shareOosPositive: r3(oosVals.filter(x => x > 0).length / Math.max(1, oosVals.length)), eligible: elig.length, gateOnMedianOos: r3(median(gateOn.map(v => v.oosExp).sort((a, b) => a - b))), gateOffMedianOos: r3(median(gateOff.map(v => v.oosExp).sort((a, b) => a - b))), meanCostR_gateOff: r3(avg(gateOff.map(v => v.costR))), meanCostR_gateOn: r3(avg(gateOn.map(v => v.costR))) },
    byStrat, nullBaseline: nullR.map(rnd), winners: winners.map(rnd), tDeflated: tDefl, survivors: winners.filter(v => v.defl).length, worstLive: variants.filter(v => v.n >= 25).sort((a, b) => a.expR - b.expR).slice(0, 5).map(rnd)
  };
  res._variants = variants.map(rnd); return res;
}
function vname(v) { return ({ rule: 'live rule', rule_f: 'rule+filters', donch: 'Donchian', rsi2: 'RSI(2)', orb: 'opening-range breakout' })[v.strat] + ' ' + v.tf + ', stop ' + v.stop + '×ATR' + (v.trail ? ', trail ' + v.trail + '×' : v.tgt ? ', target ' + v.tgt + '×' : '') + ', hold ' + v.hold + ' bars'; }
function verdict(R) {
  const L = [];
  ['IN', 'CRYPTO'].forEach(b => {
    const r = R.books[b]; if (!r || r.error) { L.push(b + ': no data (' + (r && r.error) + ')'); return; }
    const c = r.costAnatomy['15m'], lv = r.live;
    if (c) L.push(b + ' costs: round trip ' + c.roundTripBps + ' bps vs a 1.5-ATR stop of ~' + c.stopPct + '% on 15m bars, so costs take ' + c.costInR + 'R of every trade; at 2.5/1.5 reward:risk you need a ' + Math.round(c.breakEvenHitRate_at_RR1_67 * 100) + '% hit rate just to break even.');
    if (lv) L.push(b + ' live rule on 15m (' + lv.n + ' trades): hit ' + Math.round(lv.hit * 100) + '%, expectancy ' + lv.expR + 'R net of costs' + (r.liveNullExpR != null ? ' vs ' + r.liveNullExpR + 'R for random entries with the same exits' : '') + (lv.expR <= (r.liveNullExpR == null ? 0 : r.liveNullExpR) ? ' — no entry edge over random.' : ' — better than random.'));
    L.push(b + ' walk-forward: median variant is ' + r.walkForward.medianOosExpR + 'R out of sample, ' + Math.round(r.walkForward.shareOosPositive * 100) + '% of variants positive; cost gate (skip when cost > 0.2R) median ' + r.walkForward.gateOnMedianOos + 'R vs ' + r.walkForward.gateOffMedianOos + 'R without.');
    L.push(b + ' multiple-testing check: with ' + r.variantsTested + ' variants tried, pure luck is expected to produce a best t-stat near ' + r.tDeflated + '; ' + (r.survivors ? r.survivors + ' candidate(s) clear that bar.' : 'no candidate clears that bar, so none can be called a real edge yet.'));
    L.push(b + ' candidates passing in-sample ≥0.1R, out-of-sample ≥0.1R, ≥20 OOS trades, t ≥ 1.5: ' + (r.winners.length ? r.winners.slice(0, 3).map(w => vname(w) + ' (OOS ' + w.oosExp + 'R, n=' + w.oosN + ')').join('; ') : 'none') + '.');
  });
  L.push('Sample: ' + (R.days > 100 ? 'Upstox history, ~' + Math.round(R.days * 0.4 / 30) + ' months out-of-sample for India' : 'Yahoo gives only ~58 days of 15m bars, so out-of-sample is ~3 weeks (set UPSTOX_TOKEN for years)') + '. Variants tested: ' + ['IN', 'CRYPTO'].map(b => b + ' ' + ((R.books[b] && R.books[b].variantsTested) || 0)).join(', ') + ' — a few "winners" are expected by luck alone.');
  return L;
}
async function run(opts) {
  if (st.running) return { running: true };
  st.running = true; st.startedAt = Date.now(); st.error = null; st.progress = 'starting'; const days = (opts && opts.days) || (UPX.configured() ? +E.BT_DAYS_UPSTOX || 730 : 58);
  try {
    const R = { at: Date.now(), days, fees: { feeBps: FEE, slipBps: SLIP }, books: {} }, full = {};
    for (const b of ['IN', 'CRYPTO']) { try { full[b] = await runBook(b, days); } catch (e) { full[b] = { book: b, error: e.message }; } R.books[b] = Object.assign({}, full[b]); delete R.books[b]._variants; await tick(); }
    R.verdict = verdict(R); st.variants = { IN: full.IN && full.IN._variants, CRYPTO: full.CRYPTO && full.CRYPTO._variants }; st.result = R; st.finishedAt = Date.now(); st.progress = 'done';
    console.log('BACKTEST ' + JSON.stringify({ at: R.at, verdict: R.verdict }));
    ['IN', 'CRYPTO'].forEach(b => { const x = R.books[b]; if (x && !x.error) console.log('BACKTEST_' + b + ' ' + JSON.stringify({ costAnatomy: x.costAnatomy, live: x.live, liveNullExpR: x.liveNullExpR, walkForward: Object.assign({}, x.walkForward, { selectedByInSample: x.walkForward.selectedByInSample.slice(0, 5) }), byStrat: x.byStrat.map(s => ({ strat: s.strat, med: s.medianOosExpR, pos: s.shareOosPositive })), winners: x.winners.slice(0, 5) })); });
  } catch (e) { st.error = e.message; st.progress = 'failed'; console.error('backtest', e.message); }
  st.running = false; return { ok: !st.error };
}
function status() { return { running: st.running, progress: st.progress, error: st.error, startedAt: st.startedAt, finishedAt: st.finishedAt, hasResult: !!st.result, yahoo: D.ygStatus() }; }
function result(full) { if (!st.result) return null; return full ? Object.assign({}, st.result, { variants: st.variants }) : st.result; }
module.exports = { run, status, result, simulate, stats, prep, signals, aggregate, EXITS, STRATS };
