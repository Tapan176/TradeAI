'use strict';
/* Market-data bus for the AI Lab and the Charts tab: intraday OHLC with REAL timestamps.
 * Yahoo Finance chart API (NSE indices/stocks, commodities, FX, global indices) + Coinbase (Kraken fallback) for crypto. Free, no keys. */
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

const cache = new Map();   // key -> {at, p}
function cached(key, ttl, fn) { const c = cache.get(key), now = Date.now(); if (c && now - c.at < ttl) return c.p; const p = fn().catch(e => { cache.delete(key); throw e; }); cache.set(key, { at: now, p }); if (cache.size > 200) cache.delete(cache.keys().next().value); return p; }

async function yahooCandles(sym, tf) {
  const T = TF[tf], j = await jget(YH + encodeURIComponent(sym) + '?range=' + T.r + '&interval=' + T.y + '&includePrePost=false', 15000);
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
    else r = await yahooCandles(sym, tf);
    return { candles: r.candles, meta: r.meta, src, tf };
  });
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
module.exports = { inst, candles, closedBars, quote, sessionOpen, minsToClose, istParts, TF, NAMES };
