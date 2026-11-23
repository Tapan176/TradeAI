'use strict';
/* Market-data bus for the AI Lab and the Charts tab: intraday OHLC with REAL timestamps.
 * Yahoo Finance chart API (NSE indices/stocks, commodities, FX, global indices) + Coinbase (Kraken fallback) for crypto. Free, no keys. */
const UPX = require('./upstox.js');
const UA = { 'User-Agent': 'Mozilla/5.0 paperbot-lab/1.0', Accept: 'application/json' };
const YH = 'https://query1.finance.yahoo.com/v8/finance/chart/';
async function jget(url, ms) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 12000);
  try { const r = await fetch(url, { headers: UA, signal: c.signal }); if (!r.ok) throw new Error(url.split('/')[2] + ' HTTP ' + r.status); return await r.json(); } finally { clearTimeout(t); }
}
const TF = { '5m': { y: '5m', r: '5d', cb: 300, ks: 5, s: 300 }, '15m': { y: '15m', r: '10d', cb: 900, ks: 15, s: 900 }, '1h': { y: '60m', r: '1mo', cb: 3600, ks: 60, s: 3600 }, '1d': { y: '1d', r: '1y', cb: 86400, ks: 1440, s: 86400 } };
const KRAKEN = { 'BTC-USD': 'XBTUSD', 'ETH-USD': 'ETHUSD', 'SOL-USD': 'SOLUSD', 'XRP-USD': 'XRPUSD', 'DOGE-USD': 'DOGEUSD' };
const NAMES = { '^NSEI': 'NIFTY 50', '^NSEBANK': 'BANK NIFTY', '^BSESN': 'SENSEX', '^CNXIT': 'NIFTY IT', 'BTC-USD': 'Bitcoin', 'ETH-USD': 'Ethereum', 'SOL-USD': 'Solana', 'GC=F': 'Gold', 'SI=F': 'Silver', 'HG=F': 'Copper', 'CL=F': 'WTI crude', 'BZ=F': 'Brent crude', 'NG=F': 'Natural gas', 'INR=X': 'USD/INR', 'EURUSD=X': 'EUR/USD', 'GBPUSD=X': 'GBP/USD', 'USDJPY=X': 'USD/JPY', 'DX-Y.NYB': 'Dollar index', '^GSPC': 'S&P 500', '^IXIC': 'Nasdaq', '^DJI': 'Dow Jones', '^N225': 'Nikkei 225', '^FTSE': 'FTSE 100', '^GDAXI': 'DAX', '^HSI': 'Hang Seng', 'GOLDBEES.NS': 'Gold BeES' };

/* instrument metadata: which book/session an instrument trades in */
function inst(sym) {
  const s = String(sym).trim();
  if (/-USD$/.test(s)) return { sym: s, name: NAMES[s] || s.replace('-USD', ''), src: 'coinbase', cur: '$', book: 'CRYPTO', sess: '24x7', tz: 'UTC' };
  if (/^\^(NSE|BSE|CNX)/.test(s) || /\.NS$/.test(s) || /\.BO$/.test(s)) return { sym: s, name: NAMES[s] || s.replace(/\.(NS|BO)$/, ''), src: 'yahoo', cur: '₹', book: 'IN', sess: 'IN', tz: 'Asia/Kolkata' };
  return { sym: s, name: NAMES[s] || s, src: 'yahoo', cur: /=X$/.test(s) ? '' : '$', book: 'OTHER', sess: 'UTC5', tz: 'UTC' };
}
/* is the instrument's market open right now? (entries allowed window for Indian cash/index: 09:30-15:15 IST) */
function istParts(ms) { const d = new Date((ms || Date.now()) + 5.5 * 3600e3); return { day: d.getUTCDay(), mins: d.getUTCHours() * 60 + d.getUTCMinutes(), date: d.toISOString().slice(0, 10) }; }
function sessionOpen(meta, ms) {
  if (meta.sess === '24x7') return true;
  if (meta.sess === 'IN') { const t = istParts(ms); return t.day >= 1 && t.day <= 5 && t.mins >= 555 && t.mins <= 930; }
  const d = new Date(ms || Date.now()); return d.getUTCDay() >= 1 && d.getUTCDay() <= 5;
}
function minsToClose(meta, ms) { if (meta.sess !== 'IN') return 1e9; const t = istParts(ms); return 930 - t.mins; }


/* ---------- Yahoo gateway: ONE paced queue for every Yahoo call in the process (lab, ETF slot, stock slots, backtests).
 * Why: Render's shared IP got HTTP 429 when slots polled independently. Now: min gap between calls, priority lanes, response cache, in-flight de-dup,
 * exponential cool-down after a 429, and stale-on-error (a cached answer up to 6h old beats no answer for charts/quotes). */
const YG = { gap: +process.env.YAHOO_GAP_MS || 350, last: 0, coolMs: 0, coolUntil: 0, calls: 0, hits: 0, n429: 0, stale: 0, errs: 0, lastErr: null, last429: 0 };
const YC = new Map(), YIN = new Map(), YQ = [];
let yRun = false;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function yFetch(url, ms) {
  const wait = Math.max(YG.coolUntil, YG.last + YG.gap) - Date.now(); if (wait > 0) await sleep(wait);
  YG.last = Date.now(); YG.calls++;
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 15000);
  try {
    const r = await fetch(url, { headers: UA, signal: c.signal });
    if (r.status === 429) { YG.n429++; YG.last429 = Date.now(); YG.coolMs = Math.min(Math.max(YG.coolMs * 2, 20000), 600000); YG.coolUntil = Date.now() + YG.coolMs; throw new Error('yahoo HTTP 429 (cooling ' + Math.round(YG.coolMs / 1000) + 's)'); }
    if (!r.ok) throw new Error('yahoo HTTP ' + r.status);
    YG.coolMs = Math.max(0, YG.coolMs / 2 | 0); if (YG.coolMs < 1000) YG.coolMs = 0;
    return await r.json();
  } finally { clearTimeout(t); }
}
async function yPump() {
  if (yRun) return; yRun = true;
  while (YQ.length) {
    YQ.sort((a, b) => b.pri - a.pri || a.at - b.at); const j = YQ.shift();
    try { j.res(await yFetch(j.url, j.ms)); } catch (e) { YG.errs++; YG.lastErr = e.message; j.rej(e); }
  }
  yRun = false;
}
/* ygate(url, {ttl, pri, ms}) — pri: 3 = live bots/quotes, 2 = charts, 1 = slots/bulk, 0 = backtests/history */
function ygate(url, o) {
  o = o || {}; const ttl = o.ttl == null ? 20000 : o.ttl, now = Date.now(), c = YC.get(url);
  if (c && now - c.at < ttl) { YG.hits++; return Promise.resolve(c.j); }
  if (YIN.has(url)) return YIN.get(url);
  if (now < YG.coolUntil) { if (c && now - c.at < 6 * 3600e3) { YG.stale++; return Promise.resolve(c.j); } return Promise.reject(new Error('yahoo cooling down ' + Math.ceil((YG.coolUntil - now) / 1000) + 's')); }
  const p = new Promise((res, rej) => { YQ.push({ url, ms: o.ms, pri: o.pri == null ? 1 : o.pri, at: now, res, rej }); yPump(); })
    .then(j => { YC.set(url, { at: Date.now(), j }); if (YC.size > 400) YC.delete(YC.keys().next().value); return j; })
    .catch(e => { if (c && Date.now() - c.at < 6 * 3600e3) { YG.stale++; return c.j; } throw e; })
    .finally(() => YIN.delete(url));
  YIN.set(url, p); return p;
}
const ygStatus = () => ({ calls: YG.calls, cacheHits: YG.hits, n429: YG.n429, stale: YG.stale, errs: YG.errs, lastErr: YG.lastErr, cooling: Math.max(0, Math.ceil((YG.coolUntil - Date.now()) / 1000)), queue: YQ.length, last429: YG.last429 || null });

const cache = new Map();   // key -> {at, p}
function cached(key, ttl, fn) { const c = cache.get(key), now = Date.now(); if (c && now - c.at < ttl) return c.p; const p = fn().catch(e => { cache.delete(key); throw e; }); cache.set(key, { at: now, p }); if (cache.size > 200) cache.delete(cache.keys().next().value); return p; }


/* Upstox is the primary source for Indian instruments when UPSTOX_TOKEN is set (exchange data, no Yahoo rate limits). Historical part cached; only today's intraday call repeats. */
let UPXERR = null; const upxHist = new Map();
async function upxRecent(sym, tf) {
  const key = UPX.keyFor(sym), M = { '5m': ['minutes', 5, 6], '15m': ['minutes', 15, 12], '1h': ['hours', 1, 45], '1d': ['days', 1, 400] }[tf], ck = key + '|' + tf, c = upxHist.get(ck), now = Date.now();
  let hist; if (c && now - c.at < (tf === '1d' ? 3600e3 : 600e3)) hist = c.cs; else { hist = await UPX.candlesRange(key, M[0], M[1], now - M[2] * 86400e3, now - 86400e3); upxHist.set(ck, { at: now, cs: hist }); }
  let today = []; try { today = await UPX.intradayToday(key, tf === '1d' ? 'days' : M[0], M[1]); } catch (e) { /* closed / holiday */ }
  const seen = new Set(); return hist.concat(today).sort((a, b) => a.t - b.t).filter(b => !seen.has(b.t) && seen.add(b.t));
}
const upxErr = () => UPXERR;
async function yahooCandles(sym, tf) {
  const T = TF[tf], j = await ygate(YH + encodeURIComponent(sym) + '?range=' + T.r + '&interval=' + T.y + '&includePrePost=false', { ttl: tf === '1d' ? 90000 : 20000, pri: tf === '15m' ? 3 : 2 });
  const r = j.chart && j.chart.result && j.chart.result[0]; if (!r || !r.timestamp) throw new Error('no data for ' + sym);
  const q = r.indicators.quote[0], out = [];
  r.timestamp.forEach((t, i) => { if (q.open[i] == null || q.close[i] == null || q.high[i] == null || q.low[i] == null) return; out.push({ t, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume ? (q.volume[i] || 0) : 0 }); });
  return { candles: out, meta: { price: r.meta.regularMarketPrice, time: r.meta.regularMarketTime, prevClose: r.meta.chartPreviousClose, exchange: r.meta.exchangeName } };
}
async function coinbaseCandles(sym, tf) {
  const T = TF[tf], rows = await jget('https://api.exchange.coinbase.com/products/' + sym + '/candles?granularity=' + T.cb, 12000);
  return { candles: rows.slice().reverse().map(r => ({ t: r[0], o: r[3], h: r[2], l: r[1], c: r[4], v: r[5] })), meta: {} };
}
async function krakenCandles(sym, tf) {
  const T = TF[tf], p = KRAKEN[sym]; if (!p) throw new Error('no kraken pair for ' + sym);
  const j = await jget('https://api.kraken.com/0/public/OHLC?pair=' + p + '&interval=' + T.ks, 12000), k = Object.keys(j.result).find(x => x !== 'last');
  return { candles: j.result[k].map(r => ({ t: +r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[6] })), meta: {} };
}
/* candles(sym, tf) -> { candles:[{t,o,h,l,c,v}], meta, src } ; the last candle may be still forming (see closedCount) */
async function candles(sym, tf, ttlMs) {
  tf = TF[tf] ? tf : '15m'; const m = inst(sym);
  return cached(sym + '|' + tf, ttlMs == null ? 25000 : ttlMs, async () => {
    let r, src = m.src;
    if (m.src === 'coinbase') { try { r = await coinbaseCandles(sym, tf); } catch (e) { r = await krakenCandles(sym, tf); src = 'kraken'; } }
    else if (m.book === 'IN' && UPX.configured() && UPX.keyFor(sym)) { try { const cs = await upxRecent(sym, tf); if (cs.length < 20) throw new Error('too few Upstox candles'); r = { candles: cs, meta: {} }; src = 'upstox'; } catch (e) { UPXERR = e.message; r = await yahooCandles(sym, tf); src = 'yahoo'; } }
    else r = await yahooCandles(sym, tf);
    return { candles: r.candles, meta: r.meta, src, tf };
  });
}

/* ---------- long 15m history for the backtester: Yahoo caps 15m at 60 days; Coinbase pages 300 candles per call ---------- */
async function history15(sym, days) {
  const m = inst(sym); days = days || 58;
  if (m.src === 'coinbase') {
    const end = Math.floor(Date.now() / 1000), start = end - days * 86400, out = []; let to = end;
    while (to > start) {
      const from = Math.max(start, to - 300 * 900), url = 'https://api.exchange.coinbase.com/products/' + sym + '/candles?granularity=900&start=' + new Date(from * 1000).toISOString() + '&end=' + new Date(to * 1000).toISOString();
      const rows = await jget(url, 15000); rows.forEach(r => out.push({ t: r[0], o: r[3], h: r[2], l: r[1], c: r[4], v: r[5] })); to = from; await sleep(350);
    }
    const seen = new Set(); return out.sort((a, b) => a.t - b.t).filter(x => !seen.has(x.t) && seen.add(x.t));
  }
  if (m.book === 'IN' && UPX.configured() && UPX.keyFor(sym)) { const cs = await UPX.candlesRange(UPX.keyFor(sym), 'minutes', 15, Date.now() - days * 86400e3, Date.now()); if (cs.length > 300) return cs; }
  const j = await ygate(YH + encodeURIComponent(sym) + '?range=' + Math.min(days, 59) + 'd&interval=15m&includePrePost=false', { ttl: 6 * 3600e3, pri: 0, ms: 30000 });
  const r = j.chart && j.chart.result && j.chart.result[0]; if (!r || !r.timestamp) throw new Error('no history for ' + sym);
  const q = r.indicators.quote[0], out = []; r.timestamp.forEach((t, i) => { if (q.open[i] == null || q.close[i] == null || q.high[i] == null || q.low[i] == null) return; out.push({ t, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume ? (q.volume[i] || 0) : 0 }); });
  return out;
}

/* number of fully closed bars at `now` (a bar is closed when its end time has passed) */
function closedBars(cs, tf, now) { const s = TF[tf].s, n = Math.floor((now || Date.now()) / 1000); let k = cs.length; while (k > 0 && cs[k - 1].t + s > n) k--; return cs.slice(0, k); }
async function quote(sym) {
  const m = inst(sym), [d, i] = await Promise.all([candles(sym, '1d', 120000).catch(() => null), candles(sym, '15m', 30000).catch(() => null)]);
  const last = i && i.candles.length ? i.candles[i.candles.length - 1] : (d && d.candles.length ? d.candles[d.candles.length - 1] : null);
  if (!last) throw new Error('no quote for ' + sym);
  let prev = null;
  if (d && d.candles.length) {
    const dc = d.candles, lastDay = new Date((dc[dc.length - 1].t + (m.sess === 'IN' ? 19800 : 0)) * 1000).toISOString().slice(0, 10), today = new Date((Date.now() + (m.sess === 'IN' ? 19800e3 : 0))).toISOString().slice(0, 10);
    prev = lastDay === today && dc.length > 1 ? dc[dc.length - 2].c : dc[dc.length - 1].c;
  }
  return { sym, name: m.name, cur: m.cur, price: last.c, prev, chg: prev ? last.c / prev - 1 : null, t: last.t, open: sessionOpen(m) };
}
module.exports = { upxErr, ygate, ygStatus, history15, sleep, inst, candles, closedBars, quote, sessionOpen, minsToClose, istParts, TF, NAMES };
