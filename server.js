'use strict';
/* PaperBot server v3 — zero dependencies (Node >= 18). Runs independently of any browser:
 *   india     live NSE ETFs (Yahoo Finance, unofficial) — trades only 09:15–15:30 IST, daily bars, learning ON
 *   crypto    live Coinbase/Kraken prices (15m bars by default), 24/7, learning ON
 *   practice  endless replay of 24 real NSE indices (2016→now): learns continuously; its learned state warm-starts `india`
 * Each bot persists separately (file and/or Upstash Redis REST) and resumes after restarts.
 *
 * ENV: PORT · ADMIN_TOKEN · DATA_DIR · UPSTASH_REDIS_REST_URL/TOKEN · SELF_URL (self-ping) · SLOTS=india,crypto,practice
 *      CRYPTO_FEED=auto|coinbase|kraken|sim · GRANULARITY=900 · POLL_MS=10000 · PRACTICE_BARS_PER_POLL=5
 *      START_BALANCE_INDIA=10000 · START_BALANCE_CRYPTO=20 · LEARNING=on|off (default on)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const PB = require('./engine.js');
try { const L = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'replay', 'strategy_library.json'), 'utf8')); if (process.env.LIBRARY !== 'off') PB.setLibrary(L.specs); } catch (e) { console.log('strategy library not loaded:', e.message); }
const FNO = require('./fno.js');

const PORT = +process.env.PORT || 3000;
const TOKEN = process.env.ADMIN_TOKEN || '';
const POLL = +process.env.POLL_MS || 10000;
const GRAN = +process.env.GRANULARITY || 900;
// LIVE_WARM=on copies what the practice bot learned into the live bots. Default OFF: after a full 10-year replay the learner's last-regime
// stats had every trend arm in 'shadow', i.e. a live bot that sits in cash. Off = live bots start in 'explore' (small real trades) and learn live.
const LIVE_WARM = process.env.LIVE_WARM === 'on';
const LEARN = (process.env.LEARNING || 'on') !== 'off';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UP_URL = process.env.UPSTASH_REDIS_REST_URL, UP_TOK = process.env.UPSTASH_REDIS_REST_TOKEN;
const WANT = (process.env.SLOTS || 'nse,fno,instocks,gstocks,macro,india,crypto').split(',').map(s => s.trim());
const CRYPTO_FEED = (process.env.CRYPTO_FEED || 'auto').toLowerCase();
const PBPP = +process.env.PRACTICE_BARS_PER_POLL || 5;
const UA = { 'User-Agent': 'Mozilla/5.0 paperbot/3.0', Accept: 'application/json' };

const IN_SYMS = { NIFTYBEES: 'NIFTYBEES.NS', JUNIORBEES: 'JUNIORBEES.NS', BANKBEES: 'BANKBEES.NS', ITBEES: 'ITBEES.NS', PSUBNKBEES: 'PSUBNKBEES.NS', GOLDBEES: 'GOLDBEES.NS' };
const CRYPTO = ['BTC-USD', 'ETH-USD', 'SOL-USD'];
const CF = require('./lab/cryptofeeds.js');
const KRAKEN = { 'BTC-USD': 'XBTUSD', 'ETH-USD': 'ETHUSD', 'SOL-USD': 'SOLUSD' };
const NSE_HDR = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', Accept: 'application/json, text/plain, */*', 'Accept-Language': 'en-US,en;q=0.9' };
let NSE_IDS = new Set();
const YH = 'https://query1.finance.yahoo.com/v8/finance/chart/';

/* ---------- helpers ---------- */
const LABD = require('./lab/data.js'), BT = require('./lab/backtest.js'), UPX = require('./lab/upstox.js');
async function jget(url, ms) {
  if (url.indexOf('finance.yahoo.com') > 0) return LABD.ygate(url, { ttl: /range=(2y|1y|5y|max)/.test(url) ? 6 * 3600e3 : /range=1d&/.test(url) ? 45000 : 30000, pri: 1, ms: Math.max(ms || 0, 15000) });   // one paced, cached, 429-aware queue for the whole process
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms || 9000);
  try { const r = await fetch(url, { headers: UA, signal: c.signal }); if (!r.ok) throw new Error(url.split('/')[2] + ' HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
const FORCE_OPEN = process.env.FORCE_MARKET_OPEN === '1';   // testing only: pretend NSE is open
function marketOpen(t) { return FORCE_OPEN || (t.day >= 1 && t.day <= 5 && t.mins >= 555 && t.mins <= 930); }
function istNow() { const d = new Date(Date.now() + 5.5 * 3600e3); return { day: d.getUTCDay(), mins: d.getUTCHours() * 60 + d.getUTCMinutes(), date: d.toISOString().slice(0, 10) }; }
const fsKey = n => path.join(DATA_DIR, 'state-' + n + '.json');
const upKey = n => 'paperbot:v3:' + n;
async function upstash(cmd, body) {
  const r = await fetch(UP_URL + '/' + cmd, { method: 'POST', headers: { Authorization: 'Bearer ' + UP_TOK }, body });
  if (!r.ok) throw new Error('upstash ' + r.status);
  return r.json();
}
const LAB = require('./lab/index.js'), zlib = require('zlib'), VAULT = require('./lab/vault.js');
const enc = obj => 'gz:' + zlib.gzipSync(JSON.stringify(obj), { level: 6 }).toString('base64');
const dec = str => { if (!str) return null; const s = String(str); return JSON.parse(s.startsWith('gz:') ? zlib.gunzipSync(Buffer.from(s.slice(3), 'base64')).toString('utf8') : s); };
const lastSaved = {}, vaultQ = {};
// Save order of safety: local file (instant, but wiped on every Render restart) -> Upstash (survives restarts; compressed, only when changed) -> GitHub vault (batched, see vaultStates)
async function persist(name, obj) {
  const z = enc(obj);
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(fsKey(name), z); } catch (e) { /* ephemeral FS ok */ }
  vaultQ[name] = z;
  if (UP_URL && UP_TOK && lastSaved[name] !== z) {
    if (z.length >= 950000) { console.error('persist', name, 'too big for upstash even compressed:', z.length); return; }
    try { await upstash('set/' + upKey(name), z); lastSaved[name] = z; } catch (e) { console.error('persist', name, e.message); }
  }
}
async function restore(name) {
  try { if (UP_URL && UP_TOK) { const r = await upstash('get/' + upKey(name)); if (r && r.result) { console.log('restored', name, 'from upstash'); return dec(r.result); } } } catch (e) { console.error('restore', name, e.message); }
  try { const o = dec(fs.readFileSync(fsKey(name), 'utf8')); if (o) { console.log('restored', name, 'from file'); return o; } } catch (e) { /* none */ }
  try { if (VAULT.configured()) { const t = await VAULT.get('State/slot-' + name + '.json.gz64'); if (t) { console.log('restored', name, 'from vault'); return dec(t); } } } catch (e) { console.error('restore vault', name, e.message); }
  return null;
}
const persistMode = () => [UP_URL && UP_TOK ? 'upstash' : null, VAULT.configured() ? 'vault' : null, 'file'].filter(Boolean).join('+');
async function vaultStates(why) {   // slot snapshots into the GitHub vault: infrequent on purpose (keeps the repo small)
  if (!VAULT.configured()) return; const ks = Object.keys(vaultQ); if (!ks.length) return;
  ks.forEach(n => VAULT.put('State/slot-' + n + '.json.gz64', vaultQ[n])); try { await VAULT.flush(why || 'Slot state snapshot'); } catch (e) { console.error('vault states', e.message); }
}

/* ---------- feeds (NOT testable from the build sandbox: market-data hosts were blocked there) ---------- */
const feeds = {
  async yahooHistory() {
    const out = {}, today = istNow().date;
    for (const id of Object.keys(IN_SYMS)) {
      const j = await jget(YH + IN_SYMS[id] + '?range=2y&interval=1d');
      const r = j.chart.result[0], q = r.indicators.quote[0], bars = [];
      r.timestamp.forEach((t, i) => {
        const date = new Date(t * 1000 + 5.5 * 3600e3).toISOString().slice(0, 10);
        if (date >= today || q.open[i] == null || q.close[i] == null) return;
        bars.push({ o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i] });
      });
      out[id] = bars;
    }
    return out;
  },
  async yahooPrices() {
    const out = {}, today = istNow().date; let fresh = 0;
    await Promise.all(Object.keys(IN_SYMS).map(async id => {
      const m = (await jget(YH + IN_SYMS[id] + '?range=1d&interval=1d')).chart.result[0].meta;
      out[id] = +m.regularMarketPrice;
      if (new Date(m.regularMarketTime * 1000 + 5.5 * 3600e3).toISOString().slice(0, 10) === today) fresh++;
    }));
    return { px: out, fresh: fresh >= Math.ceil(Object.keys(IN_SYMS).length / 2) };
  },

  /* NSE public index feed (free, no key): https://www.nseindia.in/api/allIndices — all NSE indices, live intraday `last` + previousClose.
     NSE wants a browser-like UA + session cookie from the home page; we bootstrap one and retry the other host on failure. */
  async nseIndices() {
    if (UPX.configured()) { try { const q = await UPX.indices(Array.from(NSE_IDS)); feeds._idxSrc = 'upstox'; feeds._idxMissing = q.missing || [];
        if (q.missing && q.missing.length) { const R = loadReplay(), n = R ? R.dates.length : 0; q.missing.forEach(id => { const v = R && R.C[id] ? R.C[id][n - 1] : 0; if (v > 0) { q.px[id] = v; q.prev[id] = v; } }); }   // no live quote for this index: hold its last replay close (flat) so the slot still runs
        return q; } catch (e) { feeds._idxSrc = 'nse (upstox failed: ' + e.message + ')'; } }   // NSE blocks Render's IPs (HTTP 403); Upstox is the reliable free source
    const hosts = ['https://www.nseindia.in', 'https://www.nseindia.com'];
    let lastErr;
    for (const h of hosts) {
      try {
        if (!feeds._nseCookie || Date.now() - feeds._nseCookieAt > 10 * 60e3 || feeds._nseHost !== h) {
          const r0 = await fetch(h + '/', { headers: NSE_HDR });
          const sc = (r0.headers.getSetCookie ? r0.headers.getSetCookie() : [r0.headers.get('set-cookie') || '']).map(x => x.split(';')[0]).filter(Boolean).join('; ');
          feeds._nseCookie = sc; feeds._nseCookieAt = Date.now(); feeds._nseHost = h;
        }
        const c = new AbortController(), t = setTimeout(() => c.abort(), 12000);
        let r; try { r = await fetch(h + '/api/allIndices', { headers: Object.assign({}, NSE_HDR, { Cookie: feeds._nseCookie || '', Referer: h + '/market-data/live-market-indices' }), signal: c.signal }); } finally { clearTimeout(t); }
        if (!r.ok) throw new Error(h.split('/')[2] + ' HTTP ' + r.status);
        const j = await r.json();
        if (!j || !Array.isArray(j.data)) throw new Error('unexpected NSE payload');
        const px = {}, prev = {}; let moved = 0, n = 0, prevDay = '', vix = 0;
        for (const e of j.data) {
          if (String(e.index || '').toUpperCase() === 'INDIA VIX' && e.last > 0) vix = +e.last;
          const id = String(e.index || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
          if (!NSE_IDS.has(id) || !(e.last > 0)) continue;
          px[id] = +e.last; prev[id] = +e.previousClose; n++; if (e.last !== e.previousClose) moved++; if (e.previousDay) prevDay = e.previousDay;
        }
        if (n < NSE_IDS.size) throw new Error('NSE feed missing indices (' + n + '/' + NSE_IDS.size + ')');
        const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(prevDay), MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
        const prevDate = m ? m[3] + '-' + String(MON[m[2].toLowerCase()]).padStart(2, '0') + '-' + m[1] : null;
        return { px, prev, prevDate, vix, fresh: moved >= Math.ceil(n / 2) };
      } catch (e) { lastErr = e; feeds._nseCookie = null; }
    }
    throw lastErr;
  },

  /* NSE option chain (best effort, free): /api/option-chain-indices?symbol=NIFTY. Falls back to MODELED prices when blocked. */
  async nseChain(sym) {
    if (UPX.configured()) { try { return await UPX.chain(sym); } catch (e) { feeds._chainErr = e.message; } }
    const h = feeds._nseHost || 'https://www.nseindia.in';
    if (!feeds._nseCookie) await feeds.nseIndices();   // bootstraps cookie
    const c = new AbortController(), t = setTimeout(() => c.abort(), 15000);
    let r; try { r = await fetch(h + '/api/option-chain-indices?symbol=' + sym, { headers: Object.assign({}, NSE_HDR, { Cookie: feeds._nseCookie || '', Referer: h + '/option-chain' }), signal: c.signal }); } finally { clearTimeout(t); }
    if (!r.ok) throw new Error('option-chain HTTP ' + r.status);
    const j = await r.json(), rec = j && j.records; if (!rec || !Array.isArray(rec.data)) throw new Error('unexpected option-chain payload');
    const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    const toIso = d => { const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(d || ''); return m ? m[3] + '-' + String(MON[m[2].toLowerCase()]).padStart(2, '0') + '-' + m[1] : null; };
    const spot = +rec.underlyingValue, rows = {}, exps = new Set();
    for (const e of rec.data) {
      const exp = toIso(e.expiryDate), K = +e.strikePrice; if (!exp || !K || Math.abs(K / spot - 1) > 0.15) continue;
      const side = o => o ? { ltp: +o.lastPrice || 0, bid: +o.bidprice || 0, ask: +o.askPrice || 0, iv: +o.impliedVolatility || 0, oi: +o.openInterest || 0 } : null;
      (rows[exp] || (rows[exp] = {}))[K] = { ce: side(e.CE), pe: side(e.PE) }; exps.add(exp);
    }
    if (!exps.size) throw new Error('empty option chain');
    return { spot, expiries: Array.from(exps).sort(), rows };
  },
  async yahooBars(sym, range) {
    const j = await jget(YH + encodeURIComponent(sym) + '?range=' + (range || '2y') + '&interval=1d', 15000);
    const r = j.chart.result[0], q = r.indicators.quote[0], bars = [], dates = [];
    r.timestamp.forEach((t, i) => { if (q.open[i] == null || q.close[i] == null) return; bars.push({ o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i] }); dates.push(t); });
    return { bars, dates, meta: r.meta };
  },
  async coinbaseHistory() {
    const out = {};
    for (const p of CRYPTO) { const rows = await jget(`https://api.exchange.coinbase.com/products/${p}/candles?granularity=${GRAN}`); out[p] = rows.slice().reverse().map(r => ({ o: r[3], h: r[2], l: r[1], c: r[4] })); }
    return out;
  },
  async _ex(src) { const out = {}; for (const p of CRYPTO) { const cs = await CF.fromSource(src, p, GRAN === 900 ? '15m' : GRAN === 300 ? '5m' : GRAN === 3600 ? '1h' : '15m'); out[p] = cs.map(r => ({ o: r.o, h: r.h, l: r.l, c: r.c })); } return out; },
  async _exPrices(src) { const o = {}; await Promise.all(CRYPTO.map(async p => { const cs = await CF.fromSource(src, p, '5m'); o[p] = cs[cs.length - 1].c; })); return o; },
  async okxHistory() { return this._ex('okx'); }, async okxPrices() { return this._exPrices('okx'); },
  async bybitHistory() { return this._ex('bybit'); }, async bybitPrices() { return this._exPrices('bybit'); },
  async binanceHistory() { return this._ex('binance'); }, async binancePrices() { return this._exPrices('binance'); },
  async kucoinHistory() { return this._ex('kucoin'); }, async kucoinPrices() { return this._exPrices('kucoin'); },
  async coinbasePrices() { const o = {}; await Promise.all(CRYPTO.map(async p => { o[p] = +(await jget(`https://api.exchange.coinbase.com/products/${p}/ticker`)).price; })); return o; },
  async krakenHistory() {
    const out = {}, iv = Math.max(1, Math.round(GRAN / 60));
    for (const p of CRYPTO) { const j = await jget(`https://api.kraken.com/0/public/OHLC?pair=${KRAKEN[p]}&interval=${iv}`); const k = Object.keys(j.result).find(x => x !== 'last'); out[p] = j.result[k].map(r => ({ o: +r[1], h: +r[2], l: +r[3], c: +r[4] })); }
    return out;
  },
  async krakenPrices() {
    const o = {}, j = await jget(`https://api.kraken.com/0/public/Ticker?pair=${CRYPTO.map(p => KRAKEN[p]).join(',')}`), keys = Object.keys(j.result);
    CRYPTO.forEach(p => { const k = keys.find(x => x.startsWith(KRAKEN[p].slice(0, 4)) || x.includes(KRAKEN[p].slice(0, 3))); if (k) o[p] = +j.result[k].c[0]; });
    return o;
  }
};

/* ---------- practice data ---------- */
let REPLAY = null;
function loadReplay() {
  if (REPLAY) return REPLAY;
  try { REPLAY = JSON.parse(fs.readFileSync(path.join(__dirname, 'replay', 'indices_replay.json'), 'utf8')); } catch (e) { console.error('no replay data:', e.message); }
  return REPLAY;
}
function practiceBot(learn) {
  const D = loadReplay(), H = 260;
  const hist = {}; D.syms.forEach(id => { hist[id] = D.C[id].slice(0, H).map(c => ({ o: c, h: c, l: c, c })); });
  const cfg = Object.assign({}, PB.PRESETS.indices, { adaptive: LEARN, symbols: D.syms.map(id => ({ id, price: 1, vol: 0.01 })) });
  const b = PB.createBot({ seed: 7, cfg, history: hist, warm: learn || null });
  b.state.replayBar = H;
  b.state.feed = { mode: 'replay', name: 'NSE indices', note: 'practice: REAL NSE index closes replayed endlessly; learning carries across passes' };
  return b;
}
function practiceStep(b, n) {
  const D = loadReplay();
  for (let i = 0; i < n; i++) {
    const k = b.state.replayBar; if (k >= D.dates.length) return false;
    const cm = {}; D.syms.forEach(id => { const c = D.C[id][k]; cm[id] = { o: c, h: c, l: c, c }; });
    b.stepCandle(cm); b.state.replayBar = k + 1;
  }
  return true;
}
function holdNow(b) {   // value of just holding Nifty 50 from the start of the pass
  const D = loadReplay(), k = Math.min(b.state.replayBar, D.dates.length) - 1;
  return b.state.cfg.startBalance * D.C.NIFTY_50[k] / D.C.NIFTY_50[259];
}

/* ---------- slots ---------- */
const slots = {};
function mkSlot(name) { return slots[name] = { name, bot: null, paused: false, clients: new Set(), note: '', failStreak: 0, lastPollOk: 0, extra: {}, feed: '' }; }

async function initIndia(sl, fresh) {
  const saved = fresh ? null : await restore('india');
  if (saved && saved.v === 2) { sl.bot = PB.restoreBot(saved); sl.bot.state.cfg.adaptive = LEARN; return; }
  let hist; try { hist = await feeds.yahooHistory(); } catch (e) { sl.note = 'Yahoo unavailable: ' + e.message; return; }
  if (!Object.keys(hist).every(k => hist[k].length >= 210)) { sl.note = 'Yahoo returned too little history'; return; }
  const cfg = Object.assign({}, PB.PRESETS.india, { adaptive: LEARN, startBalance: +process.env.START_BALANCE_INDIA || 10000, warmupCandles: 260 });
  const warm = (LIVE_WARM && slots.practice && slots.practice.bot) ? slots.practice.bot.exportLearn() : null;
  sl.bot = PB.createBot({ cfg, history: hist, warm });
  sl.bot.state.feed = { mode: 'live', name: 'yahoo', note: 'live Yahoo Finance · NSE ETFs · daily bars' + (warm ? ' · warm-started from practice' : '') };
  sl.bot.state.candleIdx = cfg.warmupCandles;
}
async function tickIndia(sl) {
  const b = sl.bot, t = istNow(), open = marketOpen(t);
  if (!open) { b.state.feed.note = 'NSE closed (09:15–15:30 IST, Mon–Fri) — bot idle, state saved'; return; }
  const q = await feeds.yahooPrices();
  if (!q.fresh) { b.state.feed.note = 'no fresh quote today (holiday or stale feed) — bot idle'; return; }
  const closing = t.mins >= 920 && b.state.lastClosed !== t.date;   // evaluate ~15:20 IST, fill near the close
  b.step(1, { prices: q.px, newCandle: closing });
  if (closing) b.state.lastClosed = t.date;
  b.state.feed.note = 'live Yahoo Finance · NSE ETFs · daily bars'; sl.lastPollOk = Date.now(); sl.failStreak = 0;
}


async function initNse(sl, fresh) {
  const D = loadReplay(); if (!D) { sl.note = 'replay data missing (needed as warm-up history)'; return; }
  NSE_IDS = new Set(D.syms);
  const saved = fresh ? null : await restore('nse');
  if (saved && saved.v === 2) { sl.bot = PB.restoreBot(saved); sl.bot.state.cfg.adaptive = LEARN; return; }
  let q; try { q = await feeds.nseIndices(); } catch (e) { sl.note = 'NSE feed unavailable: ' + e.message; return; }
  const H = 259, n = D.dates.length, last = D.dates[n - 1], hist = {};
  const bridge = q.prevDate && q.prevDate > last;     // add NSE's previous close as one bridging bar if replay data is older than that
  D.syms.forEach(id => { const a = D.C[id].slice(n - H, n).map(c => ({ o: c, h: c, l: c, c })); if (bridge) a.push({ o: q.prev[id], h: q.prev[id], l: q.prev[id], c: q.prev[id] }); else a.unshift({ o: D.C[id][n - H - 1], h: D.C[id][n - H - 1], l: D.C[id][n - H - 1], c: D.C[id][n - H - 1] }); hist[id] = a; });
  const cfg = Object.assign({}, PB.PRESETS.indices, { adaptive: LEARN, scanLib: true, symbols: D.syms.map(id => ({ id, price: 1, vol: 0.01 })) });
  const warm = (LIVE_WARM && slots.practice && slots.practice.bot) ? slots.practice.bot.exportLearn() : null;
  sl.bot = PB.createBot({ seed: 11, cfg, history: hist, warm });
  sl.bot.state.feed = { mode: 'live', name: 'nse', note: 'live NSE index feed · 24 indices · daily bars · history to ' + last + (bridge ? ' + ' + q.prevDate + ' close' : '') + (warm ? ' · warm-started from practice' : '') };
}
async function tickNse(sl) {
  const b = sl.bot, t = istNow(), open = marketOpen(t);
  if (!open) { b.state.feed.note = 'NSE closed (09:15–15:30 IST, Mon–Fri) — bot idle, state saved'; return; }
  const q = await feeds.nseIndices();
  if (!q.fresh) { b.state.feed.note = 'no fresh quote today (holiday or stale feed) — bot idle'; return; }
  const closing = t.mins >= 920 && b.state.lastClosed !== t.date;   // evaluate ~15:20 IST, fill near the close
  b.step(1, { prices: q.px, newCandle: closing });
  if (closing) b.state.lastClosed = t.date;
  b.state.feed.note = 'LIVE NSE indices · last update ' + new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST'; sl.lastPollOk = Date.now(); sl.failStreak = 0;
}

/* ---------- F&O slot: index futures + options (paper) ---------- */
let FNO_HIST = null;
function loadFnoHist() { if (!FNO_HIST) { try { FNO_HIST = JSON.parse(fs.readFileSync(path.join(__dirname, 'replay', 'fno_hist.json'), 'utf8')); } catch (e) { console.error('no fno history:', e.message); } } return FNO_HIST; }
const FNO_UNDS = (process.env.FNO_UNDERLYINGS || 'NIFTY,BANKNIFTY').split(',').map(x => x.trim().toUpperCase()).filter(x => FNO.UND[x]);
async function initFno(sl, fresh) {
  const H = loadFnoHist(); if (!H) { sl.note = 'F&O history file missing'; return; }
  const saved = fresh ? null : await restore('fno');
  if (saved && saved.v === 3 && saved.kind === 'fno') { sl.bot = FNO.restore(saved); sl.bot.state.cfg.adaptive = LEARN; return; }
  if (!NSE_IDS.size && loadReplay()) NSE_IDS = new Set(loadReplay().syms);
  let q; try { q = await feeds.nseIndices(); } catch (e) { sl.note = 'NSE feed unavailable (needed for spot + India VIX): ' + e.message; return; }
  const hist = {}; FNO_UNDS.forEach(u => { hist[u] = H[u].map(b => ({ o: b.o, h: b.h, l: b.l, c: b.c })); const id = FNO.UND[u].idx; if (q.prevDate && q.prevDate > H[u][H[u].length - 1].d && q.prev[id]) hist[u].push({ o: q.prev[id], h: q.prev[id], l: q.prev[id], c: q.prev[id] }); });
  sl.bot = FNO.create({ cfg: { adaptive: LEARN, underlyings: FNO_UNDS, startBalance: +process.env.START_BALANCE_FNO || 1000000 }, history: hist, vixHist: H.VIX.map(x => x.c), date: istNow().date });
  sl.bot.state.vix = q.vix || H.VIX[H.VIX.length - 1].c;
}
async function tickFno(sl) {
  const b = sl.bot, t = istNow(), open = marketOpen(t);
  if (!open) { b.state.feed.note = 'NSE closed (09:15–15:30 IST, Mon–Fri) — F&O bot idle, state saved'; return; }
  if (!NSE_IDS.size && loadReplay()) NSE_IDS = new Set(loadReplay().syms);
  const q = await feeds.nseIndices();
  if (!q.fresh) { b.state.feed.note = 'no fresh quote today (holiday or stale feed) — F&O bot idle'; return; }
  const spot = {}; FNO_UNDS.forEach(u => { spot[u] = q.px[FNO.UND[u].idx]; });
  // option chain refresh (best effort, at most once a minute per underlying); failures fall back to modeled prices
  sl.chain = sl.chain || {}; sl.chainErr = sl.chainErr || '';
  for (const u of FNO_UNDS) {
    const c = sl.chain[u];
    if (!c || Date.now() - c.at > 60000) { try { const ch = await feeds.nseChain(u); sl.chain[u] = { at: Date.now(), expiries: ch.expiries, rows: ch.rows }; sl.chainErr = ''; } catch (e) { sl.chainErr = e.message; if (c && Date.now() - c.at > 300000) delete sl.chain[u]; } }
  }
  const chain = {}; FNO_UNDS.forEach(u => { if (sl.chain[u]) chain[u] = sl.chain[u]; });
  const closing = t.mins >= 920 && b.state.lastClosed !== t.date;
  b.step({ date: t.date, spot, vix: q.vix || b.state.vix, chain, newDay: closing, note: sl.chainErr ? 'chain: ' + sl.chainErr : '' });
  if (closing) b.state.lastClosed = t.date;
  sl.lastPollOk = Date.now(); sl.failStreak = 0;
}

/* ---------- Stock slots (India NSE stocks, ₹  ·  global US-listed stocks incl. ADRs, $) ---------- */
const IN_STOCKS = (process.env.INSTOCKS || 'RELIANCE,TCS,HDFCBANK,ICICIBANK,INFY,BHARTIARTL,SBIN,ITC,LT,KOTAKBANK,HINDUNILVR,AXISBANK,BAJFINANCE,ASIANPAINT,MARUTI,SUNPHARMA,TITAN,NTPC,ULTRACEMCO,ONGC,TATASTEEL,POWERGRID,WIPRO,M&M,ADANIENT,ADANIPORTS,JSWSTEEL,COALINDIA,HCLTECH,NESTLEIND,BAJAJFINSV,TECHM,GRASIM,HINDALCO,DRREDDY,CIPLA,EICHERMOT,BRITANNIA,APOLLOHOSP,SBILIFE,HDFCLIFE,TRENT,BPCL,HEROMOTOCO,INDUSINDBK,SHRIRAMFIN,BEL,ETERNAL,HAL,DMART,PIDILITIND,SIEMENS,TATAPOWER,VEDL,GAIL,IOC,BANKBARODA,CANBK,PNB,DLF,LODHA,JIOFIN,INDIGO,ADANIPOWER,ZYDUSLIFE,AMBUJACEM,HAVELLS,ABB,CHOLAFIN,MUTHOOTFIN,TVSMOTOR,POLYCAB')
  .split(',').map(x => x.trim()).filter(Boolean);
const G_STOCKS = (process.env.GSTOCKS || 'AAPL,MSFT,NVDA,GOOGL,AMZN,META,TSLA,AVGO,BRK-B,JPM,V,MA,LLY,UNH,XOM,WMT,COST,HD,PG,JNJ,ORCL,NFLX,AMD,CRM,ADBE,KO,PEP,BAC,CVX,MRK,ABBV,TMO,CSCO,ACN,MCD,LIN,WFC,DIS,QCOM,INTC,IBM,CAT,GE,BA,NKE,UBER,PLTR,SHOP,TSM,ASML,SAP,TM,SONY,BABA,NVO,AZN,HSBC,SHEL,TTE,UL,SNY,INFY,HDB,IBN,MU,AMAT,PANW,NOW,INTU,GS,MS,SCHW,BLK,PFE,AMGN,GILD,LOW,SBUX,UPS,HON,RTX,LMT,DE,MMM,F,GM')
  .split(',').map(x => x.trim()).filter(Boolean);
const MACRO_SYMS = (process.env.MACRO || 'GC=F,SI=F,HG=F,PL=F,CL=F,BZ=F,NG=F,INR=X,EURUSD=X,GBPUSD=X,USDJPY=X,AUDUSD=X,DX-Y.NYB,^GSPC,^IXIC,^DJI,^RUT,^FTSE,^GDAXI,^N225,^HSI,^STOXX50E').split(',').map(x => x.trim()).filter(Boolean);
const MACRO_NAME = { 'GC=F': 'Gold', 'SI=F': 'Silver', 'HG=F': 'Copper', 'PL=F': 'Platinum', 'CL=F': 'WTI crude', 'BZ=F': 'Brent crude', 'NG=F': 'Natural gas', 'INR=X': 'USD/INR', 'EURUSD=X': 'EUR/USD', 'GBPUSD=X': 'GBP/USD', 'USDJPY=X': 'USD/JPY', 'AUDUSD=X': 'AUD/USD', 'DX-Y.NYB': 'US Dollar Index', '^GSPC': 'S&P 500', '^IXIC': 'Nasdaq Comp', '^DJI': 'Dow Jones', '^RUT': 'Russell 2000', '^FTSE': 'FTSE 100', '^GDAXI': 'DAX', '^N225': 'Nikkei 225', '^HSI': 'Hang Seng', '^STOXX50E': 'Euro Stoxx 50' };
const macroSeg = id => /=F$/.test(id) ? 'COMM' : (/=X$|^DX-/.test(id) ? 'FX' : 'WORLD');
const STOCK_DEFS = {
  macro:    { label: 'Commodities · FX · Global indices (live)', cur: '$', syms: MACRO_SYMS, yh: id => id, tz: 'UTC', open: 0, close: 24 * 60, evalAt: 21 * 60 + 30, start: +process.env.START_BALANCE_MACRO || 20000, integer: false, fee: 0.0005, cfg: { maxPositions: 8, sizePct: 0.12 } },
  instocks: { label: 'India stocks · NSE (live)', cur: '₹', syms: IN_STOCKS, yh: id => id + '.NS', tz: 'Asia/Kolkata', open: 9 * 60 + 15, close: 15 * 60 + 30, evalAt: 15 * 60 + 20, start: +process.env.START_BALANCE_INSTOCKS || 500000, integer: true, fee: 0.0006, cfg: { maxPositions: 20, sizePct: 0.06 } },
  gstocks:  { label: 'Global stocks · US-listed (live)', cur: '$', syms: G_STOCKS, yh: id => id, tz: 'America/New_York', open: 9 * 60 + 30, close: 16 * 60, evalAt: 15 * 60 + 40, start: +process.env.START_BALANCE_GSTOCKS || 20000, integer: false, fee: 0.0005, cfg: { maxPositions: 25, sizePct: 0.05 } }
};
function localClock(tz) {
  const p = {}; new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
  return { day: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday], mins: (+p.hour % 24) * 60 + +p.minute, date: p.year + '-' + p.month + '-' + p.day };
}
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (e) { out[k] = null; } } })); return out; }
async function initStocks(sl, fresh) {
  const D = STOCK_DEFS[sl.name], saved = fresh ? null : await restore(sl.name);
  if (saved && saved.v === 2) { sl.bot = PB.restoreBot(saved); sl.bot.state.cfg.adaptive = LEARN; return; }
  const got = await pool(D.syms, 6, id => feeds.yahooBars(D.yh(id), '2y'));
  const hist = {}; D.syms.forEach((id, i) => { if (got[i] && got[i].bars.length >= 210) hist[id] = got[i].bars.slice(-300); });
  const ids = Object.keys(hist);
  if (ids.length < 5) { sl.note = 'Yahoo returned history for only ' + ids.length + '/' + D.syms.length + ' symbols (blocked or rate-limited)'; return; }
  const cfg = Object.assign({}, PB.PRESETS.indices, { scanLib: true, currency: D.cur, integerQty: D.integer, startBalance: D.start, feeRate: D.fee, slippage: 0.0005, adaptive: LEARN, cashYieldPa: 0.04, maxConsecLosses: 999, cooldownCandles: 3 }, D.cfg,
    { symbols: ids.map(id => ({ id, price: 1, vol: 0.015 })), warmupCandles: 250 });
  sl.bot = PB.createBot({ seed: 21, cfg, history: hist });
  sl.bot.state.feed = { mode: 'live', name: 'yahoo', note: 'live Yahoo Finance · ' + ids.length + ' stocks (' + (D.syms.length - ids.length) + ' skipped: no data) · daily bars' };
  sl.bot.state.candleIdx = 250;
}
async function tickStocks(sl) {
  const D = STOCK_DEFS[sl.name], b = sl.bot, t = localClock(D.tz), open = FORCE_OPEN || (t.day >= 1 && t.day <= 5 && t.mins >= D.open && t.mins <= D.close);
  if (!open) { b.state.feed.note = 'market closed (' + D.tz + ' ' + Math.floor(D.open / 60) + ':' + String(D.open % 60).padStart(2, '0') + '–' + Math.floor(D.close / 60) + ':00, Mon–Fri) — bot idle, state saved'; return; }
  const ids = Object.keys(b.state.symbols), px = {}; let fresh = 0;
  await pool(ids, 6, async id => { const m = (await feeds.yahooBars(D.yh(id), '1d')).meta; px[id] = +m.regularMarketPrice; const d = new Date(m.regularMarketTime * 1000).toLocaleDateString('en-CA', { timeZone: D.tz }); if (d === t.date) fresh++; });
  if (Object.keys(px).length < ids.length / 2) throw new Error('only ' + Object.keys(px).length + '/' + ids.length + ' quotes returned');
  if (fresh < ids.length / 3 && !FORCE_OPEN) { b.state.feed.note = 'no fresh quotes today (holiday or stale feed) — bot idle'; return; }
  const closing = (process.env.FORCE_EVAL === '1' || t.mins >= D.evalAt) && b.state.lastClosed !== t.date;
  b.step(1, { prices: px, newCandle: closing }); if (closing) b.state.lastClosed = t.date;
  b.state.feed.note = 'LIVE Yahoo · ' + ids.length + ' stocks · last update ' + new Date().toLocaleTimeString('en-GB', { timeZone: D.tz }) + ' (' + D.tz.split('/').pop().replace('_', ' ') + ')'; sl.lastPollOk = Date.now(); sl.failStreak = 0;
}

async function initCrypto(sl, fresh) {
  const saved = fresh ? null : await restore('crypto');
  if (saved && saved.v === 2) { sl.bot = PB.restoreBot(saved); sl.bot.state.cfg.adaptive = LEARN; sl.feed = saved.feed && saved.feed.name || 'sim'; return; }
  const order = CRYPTO_FEED === 'sim' ? [] : CRYPTO_FEED === 'auto' ? ['coinbase', 'kraken', 'okx', 'bybit', 'binance', 'kucoin'] : [CRYPTO_FEED];
  for (const f of order) {
    try {
      const hist = await feeds[f + 'History']();
      if (CRYPTO.every(p => hist[p] && hist[p].length >= 100)) {
        const cfg = { startBalance: +process.env.START_BALANCE_CRYPTO || 20, adaptive: LEARN, symbols: CRYPTO.map(id => ({ id, price: 1, vol: 0.002 })) };
        sl.bot = PB.createBot({ cfg, history: hist }); sl.feed = f; sl.kick = true;
        sl.bot.state.feed = { mode: 'live', name: f, note: 'live ' + f + ' · ' + GRAN / 60 + 'm candles' }; return;
      }
    } catch (e) { sl.note = f + ' unavailable: ' + e.message; }
  }
  sl.bot = PB.createBot({ cfg: { startBalance: +process.env.START_BALANCE_CRYPTO || 20, adaptive: LEARN } }); sl.feed = 'sim';
  sl.bot.state.feed = { mode: 'sim', name: 'sim', note: 'SIMULATED prices (live crypto feed unreachable: ' + (sl.note || 'not configured') + ')' };
}
async function tickCrypto(sl) {
  const b = sl.bot;
  if (b.state.feed.mode !== 'live') { b.step(Math.max(1, Math.round(POLL / 2000))); return; }
  let px; try { px = await feeds[sl.feed + 'Prices'](); } catch (e0) {
    for (const f of ['coinbase', 'kraken', 'okx', 'bybit', 'binance', 'kucoin'].filter(x => x !== sl.feed)) { try { px = await feeds[f + 'Prices'](); b.state.feed.note = 'live ' + f + ' (failover from ' + sl.feed + ': ' + e0.message.slice(0, 60) + ')'; sl.feed = f; b.state.feed.name = f; break; } catch (e) { /* next */ } }
    if (!px) throw e0;
  }
  const bucket = Math.floor(Date.now() / 1000 / GRAN), nc = (!!sl.lastBucket && bucket > sl.lastBucket) || !!sl.kick; sl.kick = false; sl.lastBucket = bucket;
  b.step(1, { prices: px, newCandle: nc }); sl.lastPollOk = Date.now(); sl.failStreak = 0;
}

async function initPractice(sl, fresh) {
  if (!loadReplay()) { sl.note = 'replay data missing'; return; }
  const saved = fresh ? null : await restore('practice');
  sl.pass = saved ? saved.pass : 1; sl.passes = saved ? saved.passes : []; sl.learn = saved ? saved.learn : null;
  sl.bot = practiceBot(sl.learn);
  // quick first pass so `india` can be warm-started with something real on a cold boot
  if (!saved) { const t0 = Date.now(); practiceStep(sl.bot, 1e9); finishPass(sl); console.log('practice pass 1 done in', Date.now() - t0, 'ms'); }
  updExtra(sl);
}
function finishPass(sl) {
  const b = sl.bot, m = b.metrics(), D = loadReplay();
  const hold = holdNow(b) / b.state.cfg.startBalance - 1;
  sl.passes.push({ pass: sl.pass, ret: m.totalPnlPct, maxDD: m.maxDD, trades: m.trades, hold, observed: b.learning().observed, at: new Date().toISOString() });
  if (sl.passes.length > 30) sl.passes.shift();
  sl.learn = b.exportLearn(); sl.pass++;
  sl.bot = practiceBot(sl.learn);
  persist('practice', { pass: sl.pass, passes: sl.passes, learn: sl.learn });
}
async function tickPractice(sl) {
  if (!practiceStep(sl.bot, PBPP)) finishPass(sl);
  updExtra(sl);
}
function updExtra(sl) {
  sl.extra = { holdNow: holdNow(sl.bot), pass: sl.pass, passes: sl.passes, replayDate: loadReplay().dates[Math.min(sl.bot.state.replayBar, loadReplay().dates.length) - 1] };
}

const DEFS = {
  fno: { init: initFno, tick: tickFno, every: 1, label: 'F&O · index futures & options' },
  instocks: { init: initStocks, tick: tickStocks, every: 1, label: STOCK_DEFS.instocks.label },
  gstocks: { init: initStocks, tick: tickStocks, every: 1, label: STOCK_DEFS.gstocks.label },
  macro: { init: initStocks, tick: tickStocks, every: 1, label: STOCK_DEFS.macro.label },
  nse: { init: initNse, tick: tickNse, every: 1, label: 'India indices · LIVE (NSE)' },
  india: { init: initIndia, tick: tickIndia, every: 1, label: 'India · NSE ETFs (live)' },
  crypto: { init: initCrypto, tick: tickCrypto, every: 1, label: 'Crypto (live)' },
  practice: { init: initPractice, tick: tickPractice, every: 1, label: 'Practice · 24 indices (replay)' }
};

async function loop(sl) {
  const def = DEFS[sl.name];
  try {
    if (!sl.bot) { await def.init(sl, false); if (!sl.bot) return; }
    if (!sl.paused) await def.tick(sl);
  } catch (e) {
    sl.failStreak++; console.error(sl.name, e.message);
    if (sl.bot) sl.bot.state.feed.note = 'feed error (' + sl.failStreak + '): ' + e.message; else sl.note = 'error: ' + e.message;
  }
  push(sl);
}


const SLOT_SEG = { nse: 'IDX', practice: 'IDX', india: 'EQ', instocks: 'EQ', gstocks: 'EQ', macro: 'COMM', crypto: 'CRYPTO' };
function tagSeg(snap, slot) { const sg = SLOT_SEG[slot]; if (!sg) return snap; const sf = slot === 'macro' ? (x => { x.segment = x.segment || macroSeg(x.symbol || x.sym || x.id || ''); x.name = x.name || MACRO_NAME[x.symbol || x.sym || x.id]; }) : (x => { x.segment = x.segment || sg; }); snap.positions.forEach(sf); snap.trades.forEach(sf); return snap; }
function segmentReport() {   // structured analysis: slot × segment × strategy (each slot keeps its own currency)
  const rows = [];
  Object.keys(slots).forEach(n => {
    const s = slots[n]; if (!s.bot || n === 'practice') return;
    const cur = s.bot.state.cfg.currency || '$', acc = {};
    s.bot.state.trades.forEach(t => {
      const seg = t.segment || SLOT_SEG[n] || 'EQ', k = seg + '|' + t.strategy, a = acc[k] || (acc[k] = { slot: n, label: DEFS[n].label, segment: seg, strategy: t.strategy, currency: cur, trades: 0, wins: 0, pnl: 0, gw: 0, gl: 0, r: 0, fees: 0 });
      a.trades++; a.pnl += t.pnl; a.r += t.r || 0; a.fees += t.fees || 0; if (t.pnl > 0) { a.wins++; a.gw += t.pnl; } else a.gl -= t.pnl;
    });
    Object.keys(acc).forEach(k => { const a = acc[k]; rows.push({ slot: a.slot, label: a.label, segment: a.segment, strategy: a.strategy, currency: a.currency, trades: a.trades, wins: a.wins, winRate: a.wins / a.trades, pnl: a.pnl, pf: a.gl > 0 ? a.gw / a.gl : (a.gw > 0 ? 99 : 0), avgR: a.r / a.trades, fees: a.fees }); });
  });
  return rows;
}

/* ---------- HTTP ---------- */
function body(sl) {
  if (!sl.bot) return JSON.stringify({ error: 'waiting for market-data feed', note: sl.note });
  return JSON.stringify(Object.assign(tagSeg(sl.bot.snapshot(), sl.name), {
    extra: sl.extra, server: { slot: sl.name, label: DEFS[sl.name].label, paused: sl.paused, pollMs: POLL, lastPollOk: sl.lastPollOk, failStreak: sl.failStreak, learning: LEARN, persist: persistMode()+(UP_URL||VAULT.configured()?'':' (EPHEMERAL on free Render: set UPSTASH_* or VAULT_*)'), admin: !!TOKEN, slots: summary() }
  }));
}

/* ---------- strategy registry: what exists, what trades, what is under test, what was rejected ---------- */
let REPORT = null; function report() { if (REPORT) return REPORT; try { REPORT = JSON.parse(fs.readFileSync(path.join(__dirname, 'replay', 'strategy_report.json'), 'utf8')); } catch (e) { REPORT = {}; } return REPORT; }
const SLOT_LBL = { nse: 'India indices', india: 'India ETFs', instocks: 'India stocks', gstocks: 'Global stocks', macro: 'Commodities & FX', crypto: 'Crypto', practice: 'Practice', fno: 'F&O' };
const ENG_LBL = { trend: 'Trend (EMA cross)', breakout: 'Breakout (Donchian)', meanrev: 'Mean reversion (Bollinger + RSI)', trendhold: 'Trend hold (200-bar)', trendvote: 'Trend vote (14 signals)', libvote: 'Strategy-library vote', donchian55: 'Donchian 55/20 breakout', core: 'Core index trend (200-bar)' };
function strategyRegistry() {
  const R = report(), f = x => Math.round(x * 100) / 100, rows = segmentReport(), groups = [];
  const stat = (slot, id) => { const a = rows.filter(r => r.slot === slot && r.strategy === id); const t = a.reduce((s, r) => s + r.trades, 0), w = a.reduce((s, r) => s + r.wins, 0), p = a.reduce((s, r) => s + r.pnl, 0); return t ? { trades: t, winRate: w / t, pnl: p, cur: a[0].currency } : null; };
  const armsOf = (bot, id) => { const L = bot.learning(), a = L.arms.filter(x => x.key.split('|')[0] === id), c = { active: 0, explore: 0, shadow: 0 }; a.forEach(x => { c[x.mode] = (c[x.mode] || 0) + 1; }); return a.length ? c : null; };
  /* 1. trading now */
  const live = []; const enabledEng = {};
  Object.keys(slots).forEach(n => { const s2 = slots[n]; if (!s2.bot || n === 'fno') return; (s2.bot.state.cfg.enabled || []).forEach(id => { (enabledEng[id] = enabledEng[id] || []).push(n); }); });
  Object.keys(enabledEng).forEach(id => live.push({ id, name: ENG_LBL[id] || id, status: 'use', note: 'Trading live on paper money.', by: enabledEng[id].map(n => ({ slot: n, label: SLOT_LBL[n] || n, stats: stat(n, id), arms: armsOf(slots[n].bot, id) })) }));
  if (slots.fno && slots.fno.bot) { const en = slots.fno.bot.state.cfg.enabled || [], FL = require('./fno.js').STRAT_LABEL;
    const syn = { fut_trend: 'Synthetic backtest 2015-26: 5.8% a year, 25% worst drop (cash gives 5%).', bull_call_spread: 'Synthetic backtest: 4.9% a year, 8% worst drop.', bear_put_spread: 'Synthetic backtest: 4.4% a year.', iron_condor: 'Synthetic backtest: 4.7% a year, 2.6% worst drop, profit factor 0.85.', long_call: 'Synthetic backtest: 3.7% a year — off by default.', long_put: 'Synthetic backtest: 3.7% a year — off by default.' };
    Object.keys(FL).forEach(id => { const on = en.includes(id), item = { id, name: FL[id], status: on ? 'use' : 'avail', note: (on ? 'Trading live on paper money. ' : 'Available, not enabled. ') + (syn[id] || ''), by: [{ slot: 'fno', label: 'F&O', stats: stat('fno', id), arms: armsOf(slots.fno.bot, id) }] }; (on ? live : []).push(item); if (!on) item._avail = true; });
  }
  groups.push({ title: 'Trading now', note: 'Strategies currently placing paper trades. The learner can still keep any of them in "explore" (half size), "active" (full size) or "shadow" (virtual only) per market regime.', rows: live });
  /* 2. available but not enabled */
  const avail = Object.keys(PB.STRATEGIES).filter(id => !enabledEng[id]).map(id => ({ id, name: ENG_LBL[id] || id, status: id === 'libvote' ? 'test' : 'avail',
    note: id === 'libvote' ? 'Vetted-library vote. Engine backtest 2019-26 on 24 Indian indices: 7.5% a year, 7.8% worst drop vs 9.4% / 13.3% for trend vote. Lower risk, not higher return. Stays off until it earns a place.' : 'Built into the engine, not enabled in any market right now.', by: [] }));
  if (slots.fno && slots.fno.bot) { const en = slots.fno.bot.state.cfg.enabled || [], FL = require('./fno.js').STRAT_LABEL; Object.keys(FL).filter(id => !en.includes(id)).forEach(id => avail.push({ id, name: FL[id], status: 'avail', note: 'F&O strategy, not enabled. Synthetic backtest 3.7% a year.', by: [] })); }
  groups.push({ title: 'Available, not trading', note: '', rows: avail });
  /* 3. factory */
  if (R.families) {
    const inLib = new Set(R.robust ? R.robust.families : []), hold = R.hold && R.hold.t ? R.hold.t.sharpe : 0.52;
    const fam = R.families.filter(x => !String(x.family).startsWith('pine_') && x.family !== 'combo').map(x => ({ id: x.family, name: x.family.replace(/_/g, ' '), status: inLib.has(x.family) ? 'test' : (x.testSharpe < 0.3 ? 'rej' : 'avail'),
      note: 'Average over ' + x.n + ' variants: Sharpe ' + f(x.designSharpe) + ' (2013-18) → ' + f(x.testSharpe) + ' (2019-26 test). ' + (inLib.has(x.family) ? 'In the vetted library (feeds the library vote).' : x.testSharpe < 0.3 ? 'Rejected: does not hold up.' : 'Tested, not selected.'), by: [] }));
    groups.push({ title: 'Strategy factory — ' + (R.specs || '') + ' variants tested', note: 'All variants run on 24 NSE indices with 0.10% costs per side and 5% cash yield. Buy & hold test Sharpe ' + f(hold) + '. Top-ranked individual variants were overfit (Sharpe ' + f(R.top20ByDesign ? R.top20ByDesign.designSharpe : 0) + ' → ' + f(R.top20ByDesign ? R.top20ByDesign.testSharpe : 0) + '), so whole families were selected, not winners.', rows: fam });
  }
  /* 4. pine */
  if (R.pine) groups.push({ title: 'Pine-style (TradingView community) strategies — ported by hand', note: 'Same test as the factory. "Testing" = looks promising on the test years but did not pass the design-period check, so it is not trusted yet.', rows: R.pine.map(p => ({ id: p.family, name: p.name || p.family, status: p.status === 'passed' ? 'use' : p.status === 'testing' ? 'test' : 'rej',
    note: p.variants + ' variants. Sharpe ' + f(p.meanDesignSharpe) + ' (2013-18) → ' + f(p.meanTestSharpe) + ' (2019-26). Test CAGR ' + Math.round(p.meanTestCagr * 1000) / 10 + '%, drawdown ' + Math.round(p.meanTestDD * 1000) / 10 + '%. ' + Math.round(p.shareBeatHold * 100) + '% of variants beat buy & hold.', by: [] })) });
  /* 5. external */
  groups.push({ title: 'External tools reviewed', note: 'Free resources only. Checked against their licences and terms.', rows: [
    { id: 'lwc', name: 'TradingView Lightweight Charts', status: 'use', note: 'Apache-2.0, free. Draws the candle and equity charts with trade markers.', by: [] },
    { id: 'pine', name: 'Pine strategy ports (awesome-pinescript ideas)', status: 'test', note: 'Ported by hand, tested above. None validated yet.', by: [] },
    { id: 'obk', name: 'order-block.com scanner', status: 'rej', note: 'Paid, no API. Independent tests show order blocks rarely beat buy & hold; our own order-block variant also failed (rejected above).', by: [] },
    { id: 'tvs', name: 'TradingView-Screener (Python)', status: 'rej', note: 'Uses an undocumented TradingView endpoint (against their terms), 15-minute-delayed NSE data on free access, blocked from cloud IPs.', by: [] },
    { id: 'tvm', name: 'tradingview-mcp', status: 'rej', note: 'Needs TradingView Desktop on your own computer; its own disclaimer forbids automated trading use.', by: [] },
    { id: 'twh', name: 'TradingView webhook receiver', status: 'avail', note: 'Needs a paid TradingView plan with 2FA; terms limit alerts to display use. Could be added later as manual-confirm notifications.', by: [] }] });
  groups.forEach(g => { g.rows = g.rows.filter(r => !r._avail); });
  const sum = { use: 0, test: 0, rej: 0, avail: 0 }; groups.forEach(g => g.rows.forEach(r => { sum[r.status]++; }));
  return { ts: Date.now(), summary: sum, groups };
}
function summary() {
  return Object.keys(slots).map(n => { const s = slots[n], m = s.bot && s.bot.metrics(); return { slot: n, label: DEFS[n].label, ready: !!s.bot, paused: s.paused, equity: m ? m.equity : null, pnlPct: m ? m.totalPnlPct : null, currency: s.bot ? s.bot.state.cfg.currency : '$', feed: s.bot ? s.bot.state.feed.mode : null, note: s.bot ? s.bot.state.feed.note : s.note, open: s.bot && Array.isArray(s.bot.state.positions) ? s.bot.state.positions.length : 0 }; });
}
/* open positions of every paper-book slot (compact; used by the dashboard's per-market open-positions view) */
function slotPositions() {
  return Object.keys(slots).map(n => {
    const s = slots[n], S = s.bot && s.bot.state, out = { slot: n, label: DEFS[n].label, ready: !!S, currency: S && S.cfg ? S.cfg.currency : '$', positions: [] };
    if (!S || !Array.isArray(S.positions)) return out;
    try {
      out.positions = S.positions.map(p => {
        const y = S.symbols && S.symbols[p.symbol], pr = y ? y.price : (p.last != null ? p.last : null), cost = p.cost != null ? p.cost : (p.qty && p.entry ? p.qty * p.entry : null);
        const pnl = pr != null && p.qty && cost != null ? p.qty * pr - cost : null;
        return { symbol: p.symbol, name: (y && y.name) || p.name || p.symbol, side: p.side || 'LONG', strategy: p.strategy || null, qty: p.qty, entry: p.entry, price: pr, stop: p.stop != null ? p.stop : null, tp: p.tp != null ? p.tp : null, pnl: pnl, pnlPct: pnl != null && cost ? pnl / cost : null, openTs: p.openTs || null };
      });
    } catch (e) { out.err = String(e.message || e); }
    return out;
  });
}
function push(sl) { if (!sl.clients.size) return; const d = 'data: ' + body(sl) + '\n\n'; sl.clients.forEach(c => { try { c.write(d); } catch (e) { sl.clients.delete(c); } }); }
const authed = (req, url) => TOKEN && (req.headers['x-admin-token'] === TOKEN || url.searchParams.get('token') === TOKEN);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
  const sl = slots[url.searchParams.get('bot') || (slots.nse ? 'nse' : slots.india ? 'india' : Object.keys(slots)[0])];
  if (url.pathname === '/healthz') return send(200, { ok: true, up: process.uptime() | 0, slots: summary().map(s => ({ slot: s.slot, ready: s.ready, feed: s.feed })) });
  if (url.pathname === '/api/slots') return send(200, summary());
  if (url.pathname === '/api/positions') return send(200, slotPositions());
  if (url.pathname === '/api/segments') return send(200, segmentReport());
  if (url.pathname === '/api/setups') {
    const LBL = { nse: 'India live', india: 'India ETFs', instocks: 'India stocks', gstocks: 'Global stocks', macro: 'Commodities & FX', crypto: 'Crypto', practice: 'Practice' };
    const CUR = { nse: '₹', india: '₹', instocks: '₹', gstocks: '$', macro: '$', crypto: '$', practice: '₹' };
    const rows = [], slotsSeen = [], types = new Set(); let scanned = 0;
    for (const name of Object.keys(slots)) {
      const s2 = slots[name]; if (!s2.bot || !LBL[name] || name === 'practice') continue;
      const an = s2.bot.state.analysis || {}; slotsSeen.push({ slot: name, label: LBL[name] });
      for (const id of Object.keys(an)) {
        const a = an[id]; if (!a || !a.price || a.vote == null) continue; scanned++;
        const base = a.lib != null ? 0.5 * a.vote + 0.5 * a.lib : a.vote, up = a.smaL && a.price > a.smaL && a.trend === 'UP';
        const cands = [];
        if (up && base >= 0.55) cands.push(['Trend continuation', base, 'vote ' + Math.round(base * 100) + '% long, price above rising 200-bar average']);
        if (up && a.hh55 && a.price > a.hh55 && base >= 0.5) cands.push(['Breakout', Math.min(1, base * 0.75 + 0.3), 'closed above the 55-bar high']);
        if (up && a.rsi < 45 && base >= 0.55) cands.push(['Pullback in uptrend', Math.min(1, base * 0.8 + (45 - a.rsi) / 100), 'RSI ' + a.rsi.toFixed(0) + ' dip inside an uptrend']);
        if (!cands.length) continue;
        cands.sort((x, y) => y[1] - x[1]); const c = cands[0]; types.add(c[0]);
        const base0 = id.split('-')[0], expr = (base0 === 'NIFTY_50' ? 'Idea: NIFTY futures long or bull call spread' : base0 === 'NIFTY_BANK' ? 'Idea: BANKNIFTY futures long or bull call spread' : '');
        rows.push({ slot: name, label: LBL[name], symbol: id.replace(/_/g, ' '), cur: CUR[name], price: a.price, setup: c[0], score: +c[1].toFixed(3), vote: a.vote, lib: a.lib == null ? null : a.lib, trend: a.trend, rsi: a.rsi, atrPct: a.atrPct,
          stop: a.atr ? a.price - 3 * a.atr : null, target: a.atr ? a.price + 6 * a.atr : null, why: c[2] + ' (display stop 3×ATR, target 6×ATR)', expr });
      }
    }
    rows.sort((x, y) => y.score - x.score);
    return send(200, { ts: Date.now(), scanned, slots: slotsSeen, types: [...types].sort(), rows: rows.slice(0, 500) });
  }
  if (url.pathname === '/api/strategies') return send(200, strategyRegistry());
  if (url.pathname === '/api/trades') {
    if (!sl || !sl.bot) return send(200, { total: 0, rows: [], pages: 0 });
    const g = k => url.searchParams.get(k) || '', sg = SLOT_SEG[sl.name];
    let rows = sl.bot.state.trades.map(t => Object.assign({}, t, { segment: t.segment || sg || 'EQ' }));
    const strategies = [...new Set(rows.map(t => t.strategy))].sort(), symbols = [...new Set(rows.map(t => t.symbol))].sort(), segments = [...new Set(rows.map(t => t.segment))].sort();
    const q = g('q').toLowerCase(), seg = g('seg'), st = g('strategy'), out = g('out'), from = g('from'), to = g('to'), kind = g('kind'), side = g('side');
    const kindOf = t => (t.legs && t.legs[0] && t.legs[0].kind) ? [...new Set(t.legs.map(l => l.kind))] : [t.segment || 'EQ'];
    const dayOf = t => new Date((t.closeTs || t.ts || 0) + 5.5 * 3600e3).toISOString().slice(0, 10);
    rows = rows.filter(t => (!seg || seg === 'all' || t.segment === seg) && (!st || st === 'all' || t.strategy === st) &&
      (!out || out === 'all' || (out === 'win' ? t.pnl > 0 : t.pnl <= 0)) && (!kind || kind === 'all' || kindOf(t).includes(kind)) && (!side || side === 'all' || (t.dir || 'LONG') === side) && (!from || dayOf(t) >= from) && (!to || dayOf(t) <= to) &&
      (!q || (t.symbol + ' ' + t.strategy + ' ' + (t.reason || '')).toLowerCase().includes(q)));
    const key = { time: t => t.closeTs || 0, pnl: t => t.pnl, r: t => t.r || 0, pct: t => t.pnlPct || 0, held: t => t.held || 0, fees: t => t.fees || 0, symbol: t => t.symbol }[g('sort')] || (t => t.closeTs || 0);
    const dir = g('dir') === 'asc' ? 1 : -1;
    rows.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
    const sum = rows.reduce((a, t) => { a.pnl += t.pnl; a.fees += t.fees || 0; a.r += t.r || 0; if (t.pnl > 0) { a.w++; a.gw += t.pnl; } else a.gl -= t.pnl; return a; }, { pnl: 0, fees: 0, r: 0, w: 0, gw: 0, gl: 0 });
    if (g('format') === 'csv') {
      const cols = ['id', 'symbol', 'segment', 'strategy', 'dir', 'legsText', 'structure', 'lots', 'entry', 'exit', 'pnl', 'pnlPct', 'r', 'fees', 'held', 'reason', 'closeTs'];
      const esc = v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      res.writeHead(200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="trades-' + sl.name + '.csv"' });
      return rows.forEach(t => { t.legsText = (t.legs || []).map(l => l.act + ' ' + (l.what || (t.und || '') + (l.kind === 'FUT' ? ' FUT ' : ' ' + l.K + ' ' + l.kind + ' ') + (l.exp || '')) + ' @' + l.inPx + ' -> ' + l.exitAct + ' @' + l.outPx).join(' | '); });
      res.end([cols.join(',')].concat(rows.map(t => cols.map(c => esc(c === 'closeTs' ? (t.closeTs ? new Date(t.closeTs).toISOString() : '') : t[c])).join(','))).join('\n'));
    }
    const per = Math.min(200, Math.max(10, +g('per') || 50)), pages = Math.max(1, Math.ceil(rows.length / per)), page = Math.min(pages - 1, Math.max(0, +g('page') || 0));
    return send(200, { total: rows.length, page, pages, per, rows: rows.slice(page * per, page * per + per), strategies, symbols, segments,
      summary: { n: rows.length, wins: sum.w, winRate: rows.length ? sum.w / rows.length : 0, pnl: sum.pnl, fees: sum.fees, avgR: rows.length ? sum.r / rows.length : 0, pf: sum.gl > 0 ? sum.gw / sum.gl : (sum.gw > 0 ? 99 : 0), currency: sl.bot.state.cfg ? sl.bot.state.cfg.currency : undefined } });
  }
  if (url.pathname === '/api/feedtest') {
    const T = async (name, fn) => { const t0 = Date.now(); try { const v = await fn(); return { feed: name, ok: true, ms: Date.now() - t0, sample: v }; } catch (e) { return { feed: name, ok: false, ms: Date.now() - t0, error: e.message }; } };
    if (!NSE_IDS.size && loadReplay()) NSE_IDS = new Set(loadReplay().syms);
    const r = await Promise.all([
      T('nse_indices (India indices, live)', async () => { const q = await feeds.nseIndices(); return { NIFTY_50: q.px.NIFTY_50, NIFTY_BANK: q.px.NIFTY_BANK, prevClose: q.prev.NIFTY_50, prevDate: q.prevDate, tradedToday: q.fresh }; }),
      T('nse option chain (F&O live prices)', async () => { const c = await feeds.nseChain('NIFTY'); const e = c.expiries[0], ks = Object.keys(c.rows[e]).map(Number).sort((a, b) => a - b), k = ks.reduce((a, b) => Math.abs(b - c.spot) < Math.abs(a - c.spot) ? b : a); return { spot: c.spot, expiries: c.expiries.slice(0, 3), atmStrike: k, ce: c.rows[e][k].ce, pe: c.rows[e][k].pe }; }),
      T('yahoo (stocks: India + global)', async () => { const a = await feeds.yahooBars('RELIANCE.NS', '5d'), b = await feeds.yahooBars('AAPL', '5d'); return { 'RELIANCE.NS': a.meta.regularMarketPrice, AAPL: b.meta.regularMarketPrice }; }),
      T('yahoo (India ETFs)', async () => { const q = await feeds.yahooPrices(); return { px: q.px, freshToday: q.fresh }; }),
      T('coinbase (crypto)', async () => feeds.coinbasePrices()),
      T('kraken (crypto fallback)', async () => feeds.krakenPrices())
    ]);
    return send(200, { istNow: istNow(), feeds: r });
  }

  if (url.pathname === '/api/backtest') return send(200, { status: BT.status(), result: BT.result(url.searchParams.get('full') === '1') });
  if (req.method === 'POST' && url.pathname === '/api/backtest/run') { if (TOKEN && !authed(req, url)) return send(401, { error: 'missing/invalid ADMIN_TOKEN' }); if (!BT.status().running) BT.run({ days: +url.searchParams.get('days') || 58 }); return send(202, BT.status()); }
  if (url.pathname === '/api/feeds') return send(200, { yahoo: LABD.ygStatus(), upstox: UPX.status(), indexSource: feeds._idxSrc || null, crypto: CF.status(), indexMissing: feeds._idxMissing || [], chainError: feeds._chainErr || null, slots: summary() });
  if (url.pathname === '/api/crypto-probe') return send(200, { probe: await CF.probe(url.searchParams.get('sym') || 'BTC-USD'), status: CF.status() });
  if (url.pathname === '/api/lab') return send(200, LAB.snapshot());
  if (url.pathname === '/api/lab/symbols') return send(200, LAB.chartSymbols());
  if (url.pathname === '/api/lab/prices') { try { return send(200, await LAB.prices()); } catch (e) { return send(502, { error: e.message }); } }
  if (url.pathname === '/api/candles') { try { return send(200, await LAB.chart(url.searchParams.get('sym') || '^NSEI', url.searchParams.get('tf') || '15m')); } catch (e) { return send(502, { error: String(e.message || e) }); } }
  if (req.method === 'POST' && url.pathname === '/api/lab/tg/ingest') {
    if (!authed(req, url)) return send(401, { error: 'missing/invalid ADMIN_TOKEN' });
    let b = ''; for await (const ch of req) { b += ch; if (b.length > 20000) break; }
    let text = b; try { const j = JSON.parse(b); text = j.text || j.message || b; } catch (e) { /* raw text */ }
    const sg = LAB.addSignal(text, Date.now() / 1000, 'manual'); return send(200, { accepted: !!sg, state: sg && sg.state, note: sg && sg.note });
  }
  if (req.method === 'POST' && url.pathname === '/api/lab/sync') { if (!authed(req, url)) return send(401, { error: 'missing/invalid ADMIN_TOKEN' }); try { const r = await LAB.flushNow(); await vaultStates('Manual state sync'); return send(200, { ok: true, r }); } catch (e) { return send(500, { error: e.message }); } }

  if (url.pathname.startsWith('/api/') && !sl) return send(404, { error: 'unknown bot' });
  if (url.pathname === '/api/state') { res.writeHead(sl.bot ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(body(sl)); }
  if (url.pathname === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 5000\n\ndata: ' + body(sl) + '\n\n'); sl.clients.add(res); req.on('close', () => sl.clients.delete(res)); return;
  }
  if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
    if (!authed(req, url)) return send(401, { error: 'missing/invalid ADMIN_TOKEN' });
    if (url.pathname === '/api/pause') { sl.paused = true; return send(200, { paused: true }); }
    if (url.pathname === '/api/resume') { sl.paused = false; return send(200, { paused: false }); }
    if (url.pathname === '/api/closeall') { const n = sl.bot ? sl.bot.closeAll('Closed manually (admin)') : 0; await saveAll(); return send(200, { closed: n }); }
    if (url.pathname === '/api/reset') { const keep = sl.bot && sl.bot.exportLearn(); sl.bot = null; sl.lastBucket = 0; await DEFS[sl.name].init(sl, true); if (sl.bot && keep && url.searchParams.get('keepLearning') === '1') { /* learning kept only on request */ } await saveAll(); return send(200, { reset: true }); }
  }
  let f = url.pathname === '/' ? '/index.html' : url.pathname;
  f = path.normalize(f).replace(/^(\.\.[\/\\])+/, '');
  const root = path.join(__dirname, 'public'), fp = path.join(root, f);
  if (!fp.startsWith(root)) return send(403, { error: 'forbidden' });
  fs.readFile(fp, (e, d) => {
    if (e) return send(404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': f === '/sw.js' ? 'no-cache' : 'public, max-age=300' }); res.end(d);
  });
});

async function saveAll() { for (const n of Object.keys(slots)) { const s = slots[n]; if (s.bot && n !== 'practice') await persist(n, s.bot.state); } }

(async () => {
  server.listen(PORT, () => console.log('listening on', PORT, '· slots:', WANT.join(',')));
  // practice first so india can be warm-started from it
  if (process.env.UPSTOX_TOKEN) { try { await Promise.race([UPX.loadInstruments(), new Promise(r => setTimeout(r, 20000))]); } catch (e) { /* retried in background */ } }
  const order = ['practice', 'nse', 'fno', 'instocks', 'gstocks', 'macro', 'india', 'crypto'].filter(n => WANT.includes(n));
  order.forEach(n => mkSlot(n));
  for (const n of order.filter(x => x === 'practice')) { try { await DEFS[n].init(slots[n], false); } catch (e) { console.error('init', n, e.message); slots[n].note = e.message; } }
  await Promise.all(order.filter(x => x !== 'practice').map(async n => { try { await DEFS[n].init(slots[n], false); } catch (e) { console.error('init', n, e.message); slots[n].note = e.message; } }));
  for (const n of order) setInterval(() => loop(slots[n]), n === 'practice' ? Math.max(2000, POLL / 2) : (n === 'nse' || n === 'fno') ? (+process.env.NSE_POLL_MS || 30000) : (n === 'instocks' || n === 'gstocks' || n === 'macro') ? (+process.env.STOCKS_POLL_MS || 300000) : POLL);
  setInterval(saveAll, +process.env.SAVE_MS || 120000);
  setInterval(() => vaultStates(), (+process.env.VAULT_STATE_MIN || 150) * 60000);
  setTimeout(() => vaultStates('First slot snapshot after boot'), (+process.env.VAULT_FIRST_MIN || 20) * 60000);
  if (process.env.UPSTOX_TOKEN) { const ld = () => UPX.loadInstruments().then(ok => { if (!ok) setTimeout(ld, 120000); }); ld(); setInterval(ld, 12 * 3600e3); }
  LAB.start({ store: { save: persist, load: restore } }).catch(e => console.error('lab start', e.message));
  if ((process.env.BACKTEST || 'on') !== 'off') { setTimeout(() => BT.run(), +process.env.BT_FIRST_MS || 150000); setInterval(() => BT.run(), (+process.env.BT_EVERY_H || 12) * 3600e3); }
  if (process.env.SELF_URL) setInterval(() => fetch(process.env.SELF_URL + '/healthz').catch(() => {}), 10 * 60 * 1000);
  const bye = async () => { try { await saveAll(); await LAB.shutdown(); await vaultStates('Shutdown snapshot'); } catch (e) { /* best effort */ } process.exit(0); };
  process.on('SIGTERM', bye); process.on('SIGINT', bye);
})();
