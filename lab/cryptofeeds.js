'use strict';
/* Multi-exchange crypto market data (free, no keys). One normaliser per exchange, tried in order with a sticky "last good" source per symbol,
 * so one blocked host (Render's shared IP gets 403/451 from some exchanges) never leaves a symbol without data.
 * candles(sym, tf) -> { candles:[{t,o,h,l,c,v}] ascending, src }   (t = bar open, unix seconds; last bar may still be forming) */
const UA = { 'User-Agent': 'Mozilla/5.0 paperbot-lab/1.0', Accept: 'application/json' };
async function jget(url, ms) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 10000);
  try { const r = await fetch(url, { headers: UA, signal: c.signal }); if (!r.ok) throw new Error(url.split('/')[2] + ' HTTP ' + r.status); return await r.json(); } finally { clearTimeout(t); }
}
const base = sym => String(sym).replace(/-USD[T]?$/, '');
const TFS = {
  '5m': { cb: 300, kr: 5, okx: '5m', by: '5', bn: '5m', ku: '5min' },
  '15m': { cb: 900, kr: 15, okx: '15m', by: '15', bn: '15m', ku: '15min' },
  '1h': { cb: 3600, kr: 60, okx: '1H', by: '60', bn: '1h', ku: '1hour' },
  '1d': { cb: 86400, kr: 1440, okx: '1D', by: 'D', bn: '1d', ku: '1day' }
};
const num = x => +x;
const SRC = {
  coinbase: async (sym, tf) => (await jget('https://api.exchange.coinbase.com/products/' + sym + '/candles?granularity=' + TFS[tf].cb)).slice().reverse().map(r => ({ t: r[0], o: r[3], h: r[2], l: r[1], c: r[4], v: r[5] })),
  kraken: async (sym, tf) => {
    const b = base(sym), pair = (b === 'BTC' ? 'XBT' : b) + 'USD', j = await jget('https://api.kraken.com/0/public/OHLC?pair=' + pair + '&interval=' + TFS[tf].kr);
    if (j.error && j.error.length) throw new Error('kraken ' + j.error[0]); const k = Object.keys(j.result).find(x => x !== 'last');
    return j.result[k].map(r => ({ t: +r[0], o: num(r[1]), h: num(r[2]), l: num(r[3]), c: num(r[4]), v: num(r[6]) }));
  },
  okx: async (sym, tf) => { const j = await jget('https://www.okx.com/api/v5/market/candles?instId=' + base(sym) + '-USDT&bar=' + TFS[tf].okx + '&limit=300'); if (j.code !== '0') throw new Error('okx ' + j.msg); return j.data.slice().reverse().map(r => ({ t: Math.floor(r[0] / 1000), o: num(r[1]), h: num(r[2]), l: num(r[3]), c: num(r[4]), v: num(r[5]) })); },
  bybit: async (sym, tf) => { const j = await jget('https://api.bybit.com/v5/market/kline?category=spot&symbol=' + base(sym) + 'USDT&interval=' + TFS[tf].by + '&limit=200'); if (j.retCode !== 0) throw new Error('bybit ' + j.retMsg); return j.result.list.slice().reverse().map(r => ({ t: Math.floor(r[0] / 1000), o: num(r[1]), h: num(r[2]), l: num(r[3]), c: num(r[4]), v: num(r[5]) })); },
  binance: async (sym, tf) => (await jget('https://data-api.binance.vision/api/v3/klines?symbol=' + base(sym) + 'USDT&interval=' + TFS[tf].bn + '&limit=500')).map(r => ({ t: Math.floor(r[0] / 1000), o: num(r[1]), h: num(r[2]), l: num(r[3]), c: num(r[4]), v: num(r[5]) })),
  kucoin: async (sym, tf) => { const j = await jget('https://api.kucoin.com/api/v1/market/candles?type=' + TFS[tf].ku + '&symbol=' + base(sym) + '-USDT'); if (j.code !== '200000') throw new Error('kucoin ' + j.msg); return j.data.slice().reverse().map(r => ({ t: +r[0], o: num(r[1]), h: num(r[3]), l: num(r[4]), c: num(r[2]), v: num(r[5]) })); }
};
const ORDER = (process.env.CRYPTO_SOURCES || 'coinbase,kraken,okx,bybit,binance,kucoin').split(',').map(s => s.trim()).filter(s => SRC[s]);
const sticky = {}, health = {};   // sticky[sym] = last good source; health[src] = {ok, fail, last, lastErr, ms}
function note(src, ok, err, ms) { const h = health[src] || (health[src] = { ok: 0, fail: 0 }); if (ok) { h.ok++; h.lastOk = Date.now(); h.ms = ms; } else { h.fail++; h.lastFail = Date.now(); h.lastErr = String(err).slice(0, 120); } }

/* try one source, validate the result */
async function from(src, sym, tf) {
  const t0 = Date.now();
  try { const cs = await SRC[src](sym, tf); if (!cs || cs.length < 30) throw new Error('too few candles (' + (cs ? cs.length : 0) + ')'); note(src, true, null, Date.now() - t0); return cs; }
  catch (e) { note(src, false, e.message); throw e; }
}
async function candles(sym, tf) {
  tf = TFS[tf] ? tf : '15m';
  const order = sticky[sym] ? [sticky[sym]].concat(ORDER.filter(s => s !== sticky[sym])) : ORDER, errs = [];
  for (const s of order) { try { const cs = await from(s, sym, tf); sticky[sym] = s; return { candles: cs, src: s }; } catch (e) { errs.push(s + ': ' + e.message); } }
  throw new Error('all crypto feeds failed for ' + sym + ' (' + errs.join('; ') + ')');
}
/* one exchange only (for the main crypto slot, which keeps a single consistent feed) */
async function fromSource(src, sym, tf) { if (!SRC[src]) throw new Error('unknown crypto source ' + src); return from(src, sym, tf || '15m'); }
/* diagnostics: hit every source once for BTC so /api/feeds shows which exchanges Render's IP can actually reach */
async function probe(sym) {
  const out = {}; await Promise.all(Object.keys(SRC).map(async s => { const t0 = Date.now(); try { const cs = await from(s, sym || 'BTC-USD', '15m'); out[s] = { ok: true, ms: Date.now() - t0, bars: cs.length, last: cs[cs.length - 1].c }; } catch (e) { out[s] = { ok: false, err: e.message.slice(0, 100) }; } })); return out;
}

/* ---------- live tickers: last trade price only, polled every few seconds while someone is watching ---------- */
const TICK = {
  coinbase: async sym => +(await jget('https://api.exchange.coinbase.com/products/' + sym + '/ticker', 4000)).price,
  kraken: async sym => { const b = base(sym), j = await jget('https://api.kraken.com/0/public/Ticker?pair=' + (b === 'BTC' ? 'XBT' : b) + 'USD', 4000); if (j.error && j.error.length) throw new Error('kraken ' + j.error[0]); const k = Object.keys(j.result)[0]; return +j.result[k].c[0]; },
  okx: async sym => { const j = await jget('https://www.okx.com/api/v5/market/ticker?instId=' + base(sym) + '-USDT', 4000); if (j.code !== '0') throw new Error('okx ' + j.msg); return +j.data[0].last; },
  bybit: async sym => { const j = await jget('https://api.bybit.com/v5/market/tickers?category=spot&symbol=' + base(sym) + 'USDT', 4000); if (j.retCode !== 0) throw new Error('bybit ' + j.retMsg); return +j.result.list[0].lastPrice; },
  binance: async sym => +(await jget('https://data-api.binance.vision/api/v3/ticker/price?symbol=' + base(sym) + 'USDT', 4000)).price,
  kucoin: async sym => { const j = await jget('https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=' + base(sym) + '-USDT', 4000); if (j.code !== '200000') throw new Error('kucoin ' + j.msg); return +j.data.price; }
};
const tickSticky = {};
async function tick1(sym) {
  const pref = sticky[sym] && TICK[sticky[sym]] ? sticky[sym] : tickSticky[sym], order = (pref ? [pref] : []).concat(ORDER.filter(x => x !== pref && TICK[x]));
  for (const src of order) { try { const p = await TICK[src](sym); if (p > 0 && isFinite(p)) { tickSticky[sym] = src; return { p, src }; } } catch (e) { /* next source */ } }
  return null;
}
/* ticks([sym]) -> { sym: {p, src} } for the symbols that answered */
async function ticks(syms) { const out = {}; await Promise.all(syms.map(async s => { const r = await tick1(s); if (r) out[s] = r; })); return out; }

/* long history for research/backtests: Coinbase only (public, 300 bars per call, paged backwards). Returns ascending, de-duplicated candles. */
const sleepMs = ms => new Promise(r => setTimeout(r, ms));
async function history(sym, tf, days, opts) {
  tf = TFS[tf] ? tf : '15m'; const g = TFS[tf].cb, per = 300 * g, end0 = Math.floor(Date.now() / 1000), start0 = end0 - Math.round(days * 86400), seen = new Map(), gap = (opts && opts.gapMs) || 260;
  let calls = 0, fails = 0;
  for (let e = end0; e > start0; e -= per) {
    const s = Math.max(start0, e - per), url = 'https://api.exchange.coinbase.com/products/' + sym + '/candles?granularity=' + g + '&start=' + new Date(s * 1000).toISOString() + '&end=' + new Date(e * 1000).toISOString();
    let rows = null;
    for (let tries = 0; tries < 4 && !rows; tries++) { try { rows = await jget(url, 12000); } catch (err) { if (/HTTP 40[04]/.test(err.message)) { rows = []; } else await sleepMs(700 * (tries + 1)); } }
    calls++; if (!rows) { if (++fails > 3) throw new Error('coinbase history failed for ' + sym + ' after ' + calls + ' calls'); } else rows.forEach(r => seen.set(r[0], { t: r[0], o: r[3], h: r[2], l: r[1], c: r[4], v: r[5] }));
    await sleepMs(gap);
  }
  const out = [...seen.values()].sort((a, b) => a.t - b.t); if (out.length < 100) throw new Error('coinbase history too short for ' + sym + ' (' + out.length + ' bars)');
  return out;
}
const status = () => ({ order: ORDER, sticky, health });
module.exports = { candles, fromSource, ticks, probe, status, history, sources: Object.keys(SRC) };
