'use strict';
/* Upstox market-data adapter (READ-ONLY, free). Uses an Upstox "Analytics Token": 1-year validity, read-only, no OAuth, no static IP needed.
 * Create it once: Upstox Developer Apps page -> Analytics tab -> Generate. Put it in the Render env var UPSTOX_TOKEN. It can never place orders.
 * Covers: LTP quotes (indices, equities, India VIX), option chain with greeks (real F&O premiums), 15m/1h/day candles back to 2022 (backtests), instrument master.
 * Everything fails soft: if UPSTOX_TOKEN is missing/expired the callers fall back to Yahoo / modeled prices and the dashboard says so. */
const zlib = require('zlib');
const E = process.env, TOKEN = (E.UPSTOX_TOKEN || '').trim(), API = E.UPSTOX_API || 'https://api.upstox.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const S = { calls: 0, errs: 0, lastErr: null, lastOkAt: 0, last401: 0, instAt: 0, instErr: null, instCount: 0, gap: +E.UPSTOX_GAP_MS || 250, last: 0 };
let chainQ = Promise.resolve();
const configured = () => !!TOKEN && Date.now() - S.last401 > 6 * 3600e3;
const enc = encodeURIComponent;

/* serialised, paced GET (Upstox allows ~50 req/s but 500/min and 2000/30 min; we stay far below) */
function get(path, ms) {
  const run = async () => {
    const w = S.last + S.gap - Date.now(); if (w > 0) await sleep(w); S.last = Date.now(); S.calls++;
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 15000);
    try {
      const r = await fetch(API + path, { headers: { Accept: 'application/json', Authorization: 'Bearer ' + TOKEN }, signal: c.signal });
      if (r.status === 401) { S.last401 = Date.now(); throw new Error('Upstox 401: token invalid/expired — regenerate the Analytics Token and update UPSTOX_TOKEN'); }
      if (r.status === 429) throw new Error('Upstox 429 rate limited');
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || j.status === 'error') throw new Error('Upstox HTTP ' + r.status + ' ' + (j && j.errors && j.errors[0] ? j.errors[0].message || j.errors[0].errorCode : ''));
      S.lastOkAt = Date.now(); return j;
    } catch (e) { S.errs++; S.lastErr = e.message; throw e; } finally { clearTimeout(t); }
  };
  const p = chainQ.then(run, run); chainQ = p.catch(() => {}); return p;
}

/* ---------- instrument master (public file, no auth): maps names/symbols -> instrument_key ---------- */
const NAME2KEY = {}, SYM2KEY = {}, IDX = {};
const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
const FALLBACK_IDX = { NIFTY_50: 'NSE_INDEX|Nifty 50', NIFTY_BANK: 'NSE_INDEX|Nifty Bank', INDIA_VIX: 'NSE_INDEX|India VIX', NIFTY_100: 'NSE_INDEX|Nifty 100', NIFTY_200: 'NSE_INDEX|Nifty 200', NIFTY_500: 'NSE_INDEX|Nifty 500', NIFTY_AUTO: 'NSE_INDEX|Nifty Auto', NIFTY_IT: 'NSE_INDEX|Nifty IT', NIFTY_FMCG: 'NSE_INDEX|Nifty FMCG', NIFTY_PHARMA: 'NSE_INDEX|Nifty Pharma', NIFTY_METAL: 'NSE_INDEX|Nifty Metal', NIFTY_REALTY: 'NSE_INDEX|Nifty Realty', NIFTY_MEDIA: 'NSE_INDEX|Nifty Media', NIFTY_ENERGY: 'NSE_INDEX|Nifty Energy', NIFTY_PSU_BANK: 'NSE_INDEX|Nifty PSU Bank', NIFTY_NEXT_50: 'NSE_INDEX|Nifty Next 50', NIFTY_MIDCAP_50: 'NSE_INDEX|Nifty Midcap 50' };
const ALIAS = { NIFTY_FINANCIAL_SERVICES: ['NIFTY_FIN_SERVICE', 'NIFTY_FINANCIAL_SERVICES'], NIFTY_INDIA_CONSUMPTION: ['NIFTY_INDIA_CONSUMPTION', 'NIFTY_CONSUMPTION'], NIFTY_INFRASTRUCTURE: ['NIFTY_INFRA', 'NIFTY_INFRASTRUCTURE'], NIFTY_DIVIDEND_OPPORTUNITIES_50: ['NIFTY_DIV_OPPS_50', 'NIFTY_DIVIDEND_OPPORTUNITIES_50'], NIFTY_SERVICES_SECTOR: ['NIFTY_SERV_SECTOR', 'NIFTY_SERVICES_SECTOR'], NIFTY_COMMODITIES: ['NIFTY_COMMODITIES'], NIFTY_MNC: ['NIFTY_MNC'], NIFTY_PSE: ['NIFTY_PSE'] };
Object.keys(FALLBACK_IDX).forEach(k => { IDX[k] = FALLBACK_IDX[k]; });
async function loadInstruments() {
  if (!TOKEN && E.UPSTOX_INSTRUMENTS !== 'always') return false;
  try {
    const r = await fetch((E.UPSTOX_ASSETS || 'https://assets.upstox.com') + '/market-quote/instruments/exchange/NSE.json.gz', { headers: { 'User-Agent': 'paperbot/1.0' } });
    if (!r.ok) throw new Error('instrument master HTTP ' + r.status);
    const arr = JSON.parse(zlib.gunzipSync(Buffer.from(await r.arrayBuffer())).toString('utf8')); let n = 0;
    arr.forEach(x => {
      if (x.segment === 'NSE_INDEX') { NAME2KEY[norm(x.name)] = x.instrument_key; n++; }
      else if (x.segment === 'NSE_EQ' && (x.instrument_type === 'EQ' || !x.instrument_type)) { SYM2KEY[String(x.trading_symbol).toUpperCase()] = x.instrument_key; n++; }
    });
    Object.keys(NAME2KEY).forEach(k => { IDX[k] = NAME2KEY[k]; });
    Object.keys(ALIAS).forEach(want => { if (IDX[want] && IDX[want] !== FALLBACK_IDX[want]) return; for (const a of ALIAS[want]) if (NAME2KEY[a]) { IDX[want] = NAME2KEY[a]; break; } });
    S.instAt = Date.now(); S.instCount = n; S.instErr = null; return true;
  } catch (e) { S.instErr = e.message; return false; }
}
/* our symbol -> Upstox key. '^NSEI'/'^NSEBANK'/'^INDIAVIX'/'RELIANCE.NS' (Yahoo style) or an NSE index id like 'NIFTY_50' */
function keyFor(sym) {
  const s = String(sym);
  const Y = { '^NSEI': 'NIFTY_50', '^NSEBANK': 'NIFTY_BANK', '^INDIAVIX': 'INDIA_VIX', '^CNXIT': 'NIFTY_IT', '^NSMIDCP': 'NIFTY_NEXT_50', '^CNXAUTO': 'NIFTY_AUTO', '^CNXPHARMA': 'NIFTY_PHARMA', '^CNXMETAL': 'NIFTY_METAL', '^CNXFMCG': 'NIFTY_FMCG' };
  if (Y[s]) return IDX[Y[s]] || null;
  if (/\.NS$/.test(s)) return SYM2KEY[s.replace(/\.NS$/, '').toUpperCase()] || null;
  return IDX[norm(s)] || null;
}

/* ---------- quotes ---------- */
async function ltp(keys) {   // -> { key: { last, prev } }   (v3 LTP: last_price + cp = previous close)
  const out = {}; if (!keys.length) return out;
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100), j = await get('/v3/market-quote/ltp?instrument_key=' + chunk.map(enc).join(','));
    Object.keys(j.data || {}).forEach(k => { const v = j.data[k], key = (v.instrument_token || k).replace(':', '|'); const last = +(v.last_price != null ? v.last_price : v.ltp); if (last > 0) out[key] = { last, prev: v.cp != null ? +v.cp : null, name: k }; });
  }
  return out;
}
async function ohlcPrev(keys) {   // fallback for previous close: v3 OHLC (1d) -> prev_ohlc.close
  const out = {}; if (!keys.length) return out;
  const j = await get('/v3/market-quote/ohlc?interval=1d&instrument_key=' + keys.map(enc).join(','));
  Object.keys(j.data || {}).forEach(k => { const v = j.data[k], key = (v.instrument_token || k).replace(':', '|'); out[key] = { last: +(v.last_price || 0), prev: v.prev_ohlc ? +v.prev_ohlc.close : null }; }); return out;
}

/* ---------- candles ---------- */
const isoDay = ms => new Date(ms + 19800e3).toISOString().slice(0, 10);
function parseCandles(j) {   // Upstox: [ts(ISO+05:30), o, h, l, c, vol, oi] newest first
  const c = (j.data && j.data.candles) || []; return c.map(r => ({ t: Math.floor(new Date(r[0]).getTime() / 1000), o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +(r[5] || 0) })).filter(b => b.t > 0 && b.c > 0).sort((a, b) => a.t - b.t);
}
async function candlesRange(key, unit, interval, fromMs, toMs) {   // inclusive IST dates; 15-min requests are chunked to <= 28 days
  const out = [], step = unit === 'minutes' ? 28 : unit === 'hours' ? 85 : 3000; let end = toMs;
  while (end >= fromMs) {
    const start = Math.max(fromMs, end - step * 86400e3), j = await get('/v3/historical-candle/' + enc(key) + '/' + unit + '/' + interval + '/' + isoDay(end) + '/' + isoDay(start), 30000);
    out.push.apply(out, parseCandles(j)); end = start - 86400e3;
  }
  const seen = new Set(); return out.sort((a, b) => a.t - b.t).filter(b => !seen.has(b.t) && seen.add(b.t));
}
async function intradayToday(key, unit, interval) { return parseCandles(await get('/v3/historical-candle/intraday/' + enc(key) + '/' + unit + '/' + interval)); }
/* recent candles for the live lab: history for N previous days + today's intraday, merged */
async function recent(key, tf) {
  const M = { '5m': ['minutes', 5, 6], '15m': ['minutes', 15, 12], '1h': ['hours', 1, 45], '1d': ['days', 1, 400] }[tf]; if (!M) throw new Error('tf ' + tf);
  const now = Date.now(), hist = await candlesRange(key, M[0], M[1], now - M[2] * 86400e3, now - 86400e3);
  let today = []; if (tf !== '1d') { try { today = await intradayToday(key, M[0], M[1]); } catch (e) { /* before the open there is nothing */ } } else { try { today = await intradayToday(key, 'days', 1); } catch (e) {} }
  const seen = new Set(); return hist.concat(today).sort((a, b) => a.t - b.t).filter(b => !seen.has(b.t) && seen.add(b.t));
}

/* ---------- option chain (real premiums + greeks) ---------- */
async function expiries(underKey) {
  const j = await get('/v2/option/contract?instrument_key=' + enc(underKey)), set = new Set();
  (j.data || []).forEach(c => { if (c.expiry) set.add(String(c.expiry).slice(0, 10)); }); return Array.from(set).sort();
}
const expCache = {};
async function chain(sym) {   // sym: 'NIFTY' | 'BANKNIFTY' -> same shape as the NSE chain used by fno.js
  const key = sym === 'BANKNIFTY' ? IDX.NIFTY_BANK : sym === 'NIFTY' ? IDX.NIFTY_50 : IDX[norm(sym)]; if (!key) throw new Error('no Upstox key for ' + sym);
  const today = isoDay(Date.now()), c = expCache[key];
  if (!c || Date.now() - c.at > 3600e3 || c.list[0] < today) expCache[key] = { at: Date.now(), list: (await expiries(key)).filter(d => d >= today) };
  const list = expCache[key].list.slice(0, 3); if (!list.length) throw new Error('no upcoming expiries from Upstox');
  const rows = {}; let spot = 0;
  for (const exp of list) {
    const j = await get('/v2/option/chain?instrument_key=' + enc(key) + '&expiry_date=' + exp, 20000), data = j.data || [];
    data.forEach(e => {
      const K = +e.strike_price; if (e.underlying_spot_price > 0) spot = +e.underlying_spot_price; if (!K) return;
      const side = o => o && o.market_data ? { ltp: +o.market_data.ltp || 0, bid: +o.market_data.bid_price || 0, ask: +o.market_data.ask_price || 0, iv: o.option_greeks && o.option_greeks.iv ? +o.option_greeks.iv : 0, oi: +o.market_data.oi || 0, delta: o.option_greeks ? +o.option_greeks.delta || 0 : 0 } : null;
      if (spot && Math.abs(K / spot - 1) > 0.15) return;
      (rows[exp] || (rows[exp] = {}))[K] = { ce: side(e.call_options), pe: side(e.put_options) };
    });
  }
  const exps = Object.keys(rows).filter(e => Object.keys(rows[e]).length).sort(); if (!exps.length) throw new Error('empty Upstox option chain (market closed or token not yet allowed for options)');
  return { spot, expiries: exps, rows, src: 'upstox' };
}

/* ---------- indices in the shape the NSE slots expect ---------- */
let prevDateCache = { at: 0, v: null };
async function indices(ids) {   // ids: NSE index ids like NIFTY_50 -> { px, prev, prevDate, vix, fresh }
  const keys = ids.map(id => IDX[id]).filter(Boolean), want = keys.concat(IDX.INDIA_VIX ? [IDX.INDIA_VIX] : []);
  let q = await ltp(want); const missPrev = want.filter(k => q[k] && q[k].prev == null);
  if (missPrev.length) { try { const o = await ohlcPrev(missPrev); missPrev.forEach(k => { if (o[k] && o[k].prev != null) q[k].prev = o[k].prev; }); } catch (e) { /* keep going */ } }
  const px = {}, prev = {}; let moved = 0, n = 0;
  ids.forEach(id => { const k = IDX[id], v = k && q[k]; if (!v || !(v.prev > 0)) return; px[id] = v.last; prev[id] = v.prev; n++; if (v.last !== v.prev) moved++; });
  if (n < Math.min(ids.length, 6)) throw new Error('Upstox returned only ' + n + '/' + ids.length + ' index quotes');
  if (Date.now() - prevDateCache.at > 6 * 3600e3 || !prevDateCache.v) {   // last completed trading day = newest daily candle strictly before today (IST)
    try { const d = await candlesRange(IDX.NIFTY_50, 'days', 1, Date.now() - 12 * 86400e3, Date.now()), today = isoDay(Date.now()), past = d.map(b => isoDay(b.t * 1000)).filter(x => x < today); prevDateCache = { at: Date.now(), v: past.length ? past[past.length - 1] : null }; } catch (e) { prevDateCache.at = Date.now() - 5 * 3600e3; }
  }
  const vk = IDX.INDIA_VIX, vix = vk && q[vk] ? q[vk].last : 0;
  return { px, prev, prevDate: prevDateCache.v, vix, fresh: moved >= Math.ceil(n / 2), src: 'upstox', missing: ids.filter(id => !(id in px)) };
}
const status = () => ({ configured: !!TOKEN, ok: configured() && S.lastOkAt > 0 && Date.now() - S.lastOkAt < 30 * 60e3, tokenRejected: !!S.last401 && Date.now() - S.last401 < 6 * 3600e3, calls: S.calls, errs: S.errs, lastErr: S.lastErr, lastOkAt: S.lastOkAt || null, instruments: S.instCount, instErr: S.instErr });
module.exports = { configured, loadInstruments, keyFor, ltp, recent, candlesRange, intradayToday, chain, expiries, indices, status, IDX, SYM2KEY, _get: get };
