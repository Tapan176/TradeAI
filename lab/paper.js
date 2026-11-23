'use strict';
/* Shared paper broker + statistics for every lab bot. Same fees, same risk %, same slippage for all bots => fair comparison.
 * Long & short, futures-like (no cash accounting): equity = start + realized + unrealized. Stops are filled at the stop (or the bar open on gaps); if one bar touches
 * both stop and target the STOP is assumed to hit first (conservative). */
const E = process.env, N = (k, d) => (E[k] != null && E[k] !== '' && isFinite(+E[k])) ? +E[k] : d;
const CFG = {
  riskPct: N('LAB_RISK_PCT', 0.5) / 100, maxPos: N('LAB_MAX_POS', 3), maxNotional: N('LAB_MAX_NOTIONAL', 1.0),
  start: { IN: N('LAB_START_INR', 100000), CRYPTO: N('LAB_START_USD', 1000) },
  feeBps: { IN: N('LAB_FEE_BPS_IN', 4), CRYPTO: N('LAB_FEE_BPS_CRYPTO', 5) }, slipBps: { IN: N('LAB_SLIP_BPS_IN', 2), CRYPTO: N('LAB_SLIP_BPS_CRYPTO', 3) }
};
const cur = { IN: '₹', CRYPTO: '$' };
const r2 = x => Math.round(x * 100) / 100, r4 = x => Math.round(x * 1e4) / 1e4;

function newBot(id, name, desc) {
  const b = { id, name, desc, seq: 0, pos: [], trades: [], curve: { IN: [], CRYPTO: [] }, stats: { vetoed: 0, unreviewed: 0, skipped: 0, signals: 0 }, log: [] };
  return b;
}
function equity(bot, book, px) {
  let e = CFG.start[book];
  bot.trades.forEach(t => { if (t.book === book) e += t.pnl; });
  bot.pos.forEach(p => { if (p.book === book) { const last = px && px[p.sym] != null ? px[p.sym] : p.last != null ? p.last : p.entry; e += p.side * (last - p.entry) * p.qty - p.feeIn; } });
  return e;
}
function open(bot, a) {   // a: {sym, meta:{book}, side, price, stopDist, targetDist, t, why, extra}
  if (bot.pos.some(p => p.sym === a.sym)) return null;
  if (bot.pos.filter(p => p.book === a.meta.book).length >= CFG.maxPos) return null;
  const book = a.meta.book, eq = equity(bot, book), sizeMult = a.sizeMult == null ? 1 : a.sizeMult;
  if (!(a.stopDist > 0) || !(a.price > 0)) return null;
  const slip = CFG.slipBps[book] / 1e4, fill = a.price * (1 + a.side * slip);
  let qty = (eq * CFG.riskPct * sizeMult) / a.stopDist; const cap = (eq * CFG.maxNotional) / fill; if (qty > cap) qty = cap; if (!(qty > 0)) return null;
  const feeIn = qty * fill * CFG.feeBps[book] / 1e4, p = {
    id: bot.id + '-' + (++bot.seq), bot: bot.id, sym: a.sym, name: a.meta.name, book, cur: cur[book], side: a.side, qty, entry: fill, stop: fill - a.side * a.stopDist, target: a.targetDist > 0 ? fill + a.side * a.targetDist : null,
    stop0: fill - a.side * a.stopDist, riskAmt: qty * a.stopDist, feeIn, openT: a.t, chk: Math.floor(a.t / 900) * 900, mfe: 0, mae: 0, why: a.why || '', extra: a.extra || {}, last: fill
  };
  bot.pos.push(p); return p;
}
function close(bot, p, price, t, reason) {
  const slip = CFG.slipBps[p.book] / 1e4, fill = price * (1 - p.side * slip), gross = p.side * (fill - p.entry) * p.qty, feeOut = p.qty * fill * CFG.feeBps[p.book] / 1e4, fees = p.feeIn + feeOut, pnl = gross - fees;
  const tr = { id: p.id, bot: p.bot, sym: p.sym, name: p.name, book: p.book, cur: p.cur, side: p.side > 0 ? 'LONG' : 'SHORT', qty: p.qty, entry: p.entry, exit: fill, stop: p.stop0, target: p.target, openT: p.openT, closeT: t, reason, gross, fees, pnl,
    r: p.riskAmt > 0 ? pnl / p.riskAmt : 0, mfeR: p.riskAmt > 0 ? p.mfe * p.qty / p.riskAmt : 0, maeR: p.riskAmt > 0 ? p.mae * p.qty / p.riskAmt : 0, why: p.why, extra: p.extra };
  bot.trades.push(tr); bot.pos = bot.pos.filter(x => x !== p);
  const c = bot.curve[p.book]; c.push([t, r2(equity(bot, p.book))]); if (c.length > 2000) c.splice(0, c.length - 2000);
  return tr;
}
/* walk bars after the position's last-checked bar; returns closed trade or null. closedUpTo: bars with t < closedUpTo are final */
function manage(bot, p, bars, tfSec, nowSec) {
  for (const b of bars) {
    if (b.t <= p.chk) continue;
    const fin = b.t + tfSec <= nowSec;
    if (p.side > 0) { p.mfe = Math.max(p.mfe, b.h - p.entry); p.mae = Math.max(p.mae, p.entry - b.l); } else { p.mfe = Math.max(p.mfe, p.entry - b.l); p.mae = Math.max(p.mae, b.h - p.entry); }
    const hitS = p.side > 0 ? b.l <= p.stop : b.h >= p.stop, hitT = p.target != null && (p.side > 0 ? b.h >= p.target : b.l <= p.target);
    if (hitS) { const gap = p.side > 0 ? b.o < p.stop : b.o > p.stop; return close(bot, p, gap ? b.o : p.stop, Math.min(b.t + tfSec, nowSec), 'stop'); }
    if (hitT) { const gap = p.side > 0 ? b.o > p.target : b.o < p.target; return close(bot, p, gap ? b.o : p.target, Math.min(b.t + tfSec, nowSec), 'target'); }
    p.last = b.c; if (fin) p.chk = b.t;
  }
  return null;
}

/* ---------- statistics ---------- */
function wilson(k, n, z) { z = z || 1.96; if (!n) return [0, 0]; const p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - h), Math.min(1, c + h)]; }
function maxDD(curve, start) { let pk = start, dd = 0; curve.forEach(([, e]) => { if (e > pk) pk = e; dd = Math.max(dd, 1 - e / pk); }); return dd; }
function metrics(bot, px) {
  const T = bot.trades, n = T.length, w = T.filter(t => t.pnl > 0), l = T.filter(t => t.pnl <= 0), wl = wilson(w.length, n);
  const sum = a => a.reduce((s, x) => s + x, 0), gw = sum(w.map(t => t.pnl)), gl = -sum(l.map(t => t.pnl));
  const books = {}; ['IN', 'CRYPTO'].forEach(k => { const eq = equity(bot, k, px), st = CFG.start[k]; books[k] = { cur: cur[k], start: st, equity: r2(eq), pnlPct: r4(eq / st - 1), maxDD: r4(maxDD(bot.curve[k], st)), trades: T.filter(t => t.book === k).length }; });
  return { id: bot.id, name: bot.name, desc: bot.desc, trades: n, wins: w.length, hit: n ? w.length / n : null, hitCI: n ? wl : null, expR: n ? sum(T.map(t => t.r)) / n : null, avgWinR: w.length ? sum(w.map(t => t.r)) / w.length : null,
    avgLossR: l.length ? sum(l.map(t => t.r)) / l.length : null, pf: gl > 0 ? gw / gl : null, open: bot.pos.length, books, stats: bot.stats, minSample: n >= 100 ? 'ok' : n >= 30 ? 'weak' : 'tiny' };
}
const istDay = t => new Date((t + 19800) * 1000).toISOString().slice(0, 10);
function dayR(bot) { const m = {}; bot.trades.forEach(t => { const d = istDay(t.closeT); m[d] = (m[d] || 0) + t.r; }); return m; }
/* paired bootstrap of daily R difference (bot - base); needs >= 5 days where either traded */
function pairedDiff(bot, base, iters) {
  const a = dayR(bot), b = dayR(base), days = Array.from(new Set(Object.keys(a).concat(Object.keys(b)))), d = days.map(k => (a[k] || 0) - (b[k] || 0));
  if (d.length < 5) return { days: d.length, mean: null, ci: null };
  const mean = d.reduce((s, x) => s + x, 0) / d.length, bs = [], I = iters || 1500; let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < I; i++) { let s = 0; for (let j = 0; j < d.length; j++) s += d[Math.floor(rnd() * d.length)]; bs.push(s / d.length); }
  bs.sort((x, y) => x - y); return { days: d.length, mean: r4(mean), ci: [r4(bs[Math.floor(I * 0.025)]), r4(bs[Math.floor(I * 0.975)])] };
}
module.exports = { CFG, newBot, equity, open, close, manage, metrics, wilson, pairedDiff, istDay, r2, r4, cur };
