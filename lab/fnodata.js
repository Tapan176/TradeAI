'use strict';
/* NSE end-of-day F&O data from NSE's public file archive (nsearchives.nseindia.com): no key, no login, free.
 *   - F&O bhavcopy (UDiFF layout, with a fallback for the older layout): every futures/options contract's close, open interest, change in OI, volume
 *   - Participant-wise open interest (FII / DII / Client / Pro) for index and stock futures and options
 * What we derive (all arithmetic on the exchange's own numbers, nothing predicted):
 *   futures OI build-up class per underlying, option put/call ratio (OI), max-pain strike, the biggest call/put OI strikes (the market's own support/resistance map),
 *   FII net positioning and its one-day change.
 * Why end-of-day only: NSE's live option-chain API refuses cloud IPs; live F&O needs a broker feed (UPSTOX_TOKEN, free, see upstox.js).
 * Everything fails soft: if the archive is unreachable the status says why (HTTP code) and the UI shows that instead of numbers. */
const zlib = require('zlib');
const A = 'https://nsearchives.nseindia.com';
const HDR = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', Accept: '*/*', 'Accept-Language': 'en-US,en;q=0.9', Referer: 'https://www.nseindia.com/all-reports-derivatives' };
const st = { at: 0, busy: false, ok: null, err: null, asOf: null, tried: [], ms: 0, bytes: 0, rows: 0, header: null, sample: null, data: null, part: null };
const INDEXES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'NIFTYNXT50'];

async function getBuf(url, ms) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 30000);
  try { const r = await fetch(url, { headers: HDR, signal: c.signal }); if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; } return Buffer.from(await r.arrayBuffer()); }
  finally { clearTimeout(t); }
}
function unzipFirst(buf) {   // minimal zip reader (first entry): enough for NSE's single-file archives, no dependency
  let e = -1; for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('not a zip file (archive returned a web page?)');
  const cd = buf.readUInt32LE(e + 16); if (buf.readUInt32LE(cd) !== 0x02014b50) throw new Error('bad zip directory');
  const method = buf.readUInt16LE(cd + 10), csize = buf.readUInt32LE(cd + 20), lho = buf.readUInt32LE(cd + 42);
  const ds = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28), raw = buf.subarray(ds, ds + csize);
  return (method === 0 ? raw : zlib.inflateRawSync(raw)).toString('utf8');
}
const MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
function isoDate(s) {   // '2026-12-29' | '29-DEC-2026' | '29-Dec-2026' | '29/12/2026' -> '2026-12-29'
  s = String(s || '').trim(); let m;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return m[1] + '-' + m[2] + '-' + m[3];
  if ((m = /^(\d{1,2})[-\/ ]([A-Za-z]{3})[a-z]*[-\/ ](\d{4})/.exec(s)) && MON[m[2].toUpperCase()] != null) return m[3] + '-' + String(MON[m[2].toUpperCase()] + 1).padStart(2, '0') + '-' + m[1].padStart(2, '0');
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s))) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  return null;
}
function ist(offsetDays) { const d = new Date(Date.now() + 5.5 * 3600e3 - offsetDays * 86400e3), y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, '0'), dd = String(d.getUTCDate()).padStart(2, '0'); return { dow: d.getUTCDay(), ymd: '' + y + m + dd, dmy: dd + m + y, iso: y + '-' + m + '-' + dd }; }
const num = x => { const v = parseFloat(String(x).replace(/,/g, '')); return isFinite(v) ? v : 0; };

/* ---- bhavcopy -> normalised contract rows ---- */
function parseBhav(text) {
  const lines = text.split(/\r?\n/).filter(Boolean); if (lines.length < 10) throw new Error('bhavcopy too short (' + lines.length + ' lines)');
  const head = lines[0].split(',').map(h => h.trim().toLowerCase()), ix = {}; head.forEach((h, i) => { ix[h] = i; });
  const col = (...ns) => { for (const n of ns) if (ix[n.toLowerCase()] != null) return ix[n.toLowerCase()]; return -1; };
  const C = { typ: col('FinInstrmTp', 'INSTRUMENT'), sym: col('TckrSymb', 'SYMBOL'), exp: col('XpryDt', 'FininstrmActlXpryDt', 'EXPIRY_DT'), strike: col('StrkPric', 'STRIKE_PR'), ot: col('OptnTp', 'OPTION_TYP'), close: col('ClsPric', 'CLOSE'), prev: col('PrvsClsgPric', 'PREVCLOSE'), settle: col('SttlmPric', 'SETTLE_PR'), und: col('UndrlygPric'), oi: col('OpnIntrst', 'OPEN_INT'), doi: col('ChngInOpnIntrst', 'CHG_IN_OI'), vol: col('TtlTradgVol', 'CONTRACTS'), lot: col('NewBrdLotQty') };
  const miss = ['typ', 'sym', 'exp', 'close', 'oi', 'doi'].filter(k => C[k] < 0); if (miss.length) throw new Error('unrecognised bhavcopy columns, missing ' + miss.join(',') + ' in: ' + head.join(',').slice(0, 300));
  st.header = head; const rows = [], T = { IDF: 'IF', STF: 'SF', IDO: 'IO', STO: 'SO', FUTIDX: 'IF', FUTSTK: 'SF', OPTIDX: 'IO', OPTSTK: 'SO' };
  for (let i = 1; i < lines.length; i++) {
    const a = lines[i].split(','), t = T[String(a[C.typ] || '').trim().toUpperCase()]; if (!t) continue;
    const ot = C.ot >= 0 ? String(a[C.ot] || '').trim().toUpperCase().replace(/^(CALL|C)$/, 'CE').replace(/^(PUT|P)$/, 'PE') : ''; const exp = isoDate(a[C.exp]); if (!exp) continue;
    rows.push({ t, sym: String(a[C.sym]).trim().toUpperCase(), exp, k: C.strike >= 0 ? num(a[C.strike]) : 0, ot: ot === 'CE' || ot === 'PE' ? ot : null, close: num(a[C.close]), prev: C.prev >= 0 ? num(a[C.prev]) : 0, und: C.und >= 0 ? num(a[C.und]) : 0, oi: num(a[C.oi]), doi: num(a[C.doi]), vol: C.vol >= 0 ? num(a[C.vol]) : 0 });
  }
  if (!rows.length) throw new Error('no F&O rows recognised'); st.sample = rows.slice(0, 2); return rows;
}
function maxPain(opts) {   // strike at which option writers' total payout is smallest
  const ks = [...new Set(opts.map(o => o.k))].sort((a, b) => a - b); let best = null, bv = Infinity;
  ks.forEach(K => { let v = 0; opts.forEach(o => { v += o.oi * (o.ot === 'CE' ? Math.max(0, K - o.k) : Math.max(0, o.k - K)); }); if (v < bv) { bv = v; best = K; } });
  return best;
}
function buildup(pricePct, oiPct) {
  if (pricePct == null || oiPct == null) return null;
  if (Math.abs(pricePct) < 0.15 || Math.abs(oiPct) < 1) return 'neutral';
  return pricePct > 0 ? (oiPct > 0 ? 'long buildup' : 'short covering') : (oiPct > 0 ? 'short buildup' : 'long unwinding');
}
function analyse(rows, tradeDate) {
  const u = {}; rows.forEach(r => { const o = u[r.sym] = u[r.sym] || { sym: r.sym, fut: [], opt: [], idx: r.t[0] === 'I' }; (r.t[1] === 'F' ? o.fut : o.opt).push(r); });
  const out = [];
  Object.values(u).forEach(o => {
    o.fut.sort((a, b) => a.exp < b.exp ? -1 : 1); const f = o.fut.find(x => x.exp >= tradeDate) || o.fut[0], res = { sym: o.sym, index: o.idx, spot: (o.fut.concat(o.opt).find(x => x.und > 0) || {}).und || null };
    if (f) { const oiPrev = f.oi - f.doi, pp = f.prev > 0 ? (f.close / f.prev - 1) * 100 : null, op = oiPrev > 0 ? f.doi / oiPrev * 100 : null; res.fut = { expiry: f.exp, close: f.close, pricePct: pp, oi: f.oi, dOi: f.doi, oiPct: op, vol: f.vol, class: buildup(pp, op) }; res.futOiAll = o.fut.reduce((s, x) => s + x.oi, 0); }
    if (o.opt.length) {
      const exps = [...new Set(o.opt.map(x => x.exp))].sort(), e1 = exps.find(x => x >= tradeDate) || exps[0], near = o.opt.filter(x => x.exp === e1), ce = near.filter(x => x.ot === 'CE'), pe = near.filter(x => x.ot === 'PE');
      const sum = (a, k) => a.reduce((s, x) => s + x[k], 0), ceOi = sum(ce, 'oi'), peOi = sum(pe, 'oi'), allCe = sum(o.opt.filter(x => x.ot === 'CE'), 'oi'), allPe = sum(o.opt.filter(x => x.ot === 'PE'), 'oi');
      const top = a => a.slice().sort((x, y) => y.oi - x.oi).slice(0, 3).map(x => ({ k: x.k, oi: x.oi, dOi: x.doi }));
      res.opt = { expiry: e1, ceOi, peOi, pcr: ceOi > 0 ? peOi / ceOi : null, pcrAll: allCe > 0 ? allPe / allCe : null, maxPain: maxPain(near.filter(x => x.ot)), resist: top(ce), support: top(pe), vol: sum(near, 'vol') };
    }
    out.push(res);
  });
  const stocks = out.filter(x => !x.index && x.fut), liquid = stocks.slice().sort((a, b) => b.fut.oi * b.fut.close - a.fut.oi * a.fut.close).slice(0, 120);   // rank by notional OI so thin names do not dominate the lists
  const pick = (cl, key, dir) => liquid.filter(x => x.fut.class === cl).sort((a, b) => dir * (b.fut[key] - a.fut[key])).slice(0, 8).map(x => ({ sym: x.sym, pricePct: x.fut.pricePct, oiPct: x.fut.oiPct, oi: x.fut.oi }));
  const breadth = { 'long buildup': 0, 'short buildup': 0, 'short covering': 0, 'long unwinding': 0, neutral: 0 }; liquid.forEach(x => { if (breadth[x.fut.class] != null) breadth[x.fut.class]++; });
  const idxs = INDEXES.map(s => out.find(x => x.sym === s)).filter(Boolean);
  return { tradeDate, underlyings: out.length, stocksWithFutures: stocks.length, indices: idxs, breadth, leaders: { 'long buildup': pick('long buildup', 'oiPct', 1), 'short buildup': pick('short buildup', 'oiPct', 1), 'short covering': pick('short covering', 'oiPct', -1), 'long unwinding': pick('long unwinding', 'oiPct', -1) } };
}

/* ---- participant-wise OI ---- */
function parsePart(text) {
  const lines = text.split(/\r?\n/).map(l => l.split(',').map(c => c.replace(/["']/g, '').trim())), hi = lines.findIndex(l => /client type/i.test(l[0]));
  if (hi < 0) throw new Error('participant file layout not recognised'); const h = lines[hi].map(x => x.toLowerCase()), g = (row, name) => { const i = h.findIndex(x => x.indexOf(name) === 0); return i < 0 ? 0 : num(row[i]); };
  const o = {}; lines.slice(hi + 1).forEach(r => { const k = (r[0] || '').toUpperCase(); if (!k) return; o[k] = { futIdxL: g(r, 'future index long'), futIdxS: g(r, 'future index short'), futStkL: g(r, 'future stock long'), futStkS: g(r, 'future stock short'), callL: g(r, 'option index call long'), callS: g(r, 'option index call short'), putL: g(r, 'option index put long'), putS: g(r, 'option index put short') }; });
  return o;
}
const net = p => p ? { futIdxNet: p.futIdxL - p.futIdxS, longPct: p.futIdxL + p.futIdxS ? p.futIdxL / (p.futIdxL + p.futIdxS) * 100 : null, callNet: p.callL - p.callS, putNet: p.putL - p.putS, futStkNet: p.futStkL - p.futStkS } : null;

async function fetchDay(offset) {   // returns { date, rows } for the first business day (counting back) whose bhavcopy exists
  const d = ist(offset); if (d.dow === 0 || d.dow === 6) return null;
  const urls = [A + '/content/fo/BhavCopy_NSE_FO_0_0_0_' + d.ymd + '_F_0000.csv.zip'];
  for (const u of urls) {
    try { const b = await getBuf(u); st.bytes = b.length; const rows = parseBhav(unzipFirst(b)); st.tried.push(d.iso + ' ok'); return { date: d.iso, d, rows }; }
    catch (e) { st.tried.push(d.iso + ' ' + e.message); if (e.status && e.status !== 404) throw e; }
  }
  return null;
}
async function refresh(force) {
  if (st.busy || (!force && Date.now() - st.at < (st.ok ? 25 : 8) * 60000)) return status();
  st.busy = true; st.at = Date.now(); st.tried = []; const t0 = Date.now();
  try {
    let day = null, off = 0; for (; off < 9 && !day; off++) day = await fetchDay(off);
    if (!day) throw new Error('no F&O bhavcopy found in the last 9 days (' + st.tried.slice(-3).join('; ') + ')');
    const data = analyse(day.rows, day.date); st.rows = day.rows.length; data.asOf = day.date;
    // participant OI: same day and the previous business day (for the change)
    let part = null; try {
      const get = async dm => parsePart(Buffer.from(await getBuf(A + '/content/nsccl/fao_participant_oi_' + dm + '.csv')).toString('utf8'));
      const cur = await get(day.d.dmy); let prev = null; for (let k = 1; k < 6 && !prev; k++) { const p = ist(off - 1 + k); if (p.dow === 0 || p.dow === 6) continue; try { prev = await get(p.dmy); } catch (e) { /* holiday */ } }
      part = { date: day.date }; ['FII', 'DII', 'CLIENT', 'PRO'].forEach(k => { const a = net(cur[k]), b = net(prev && prev[k]); if (a) part[k] = Object.assign(a, { dFutIdxNet: b ? a.futIdxNet - b.futIdxNet : null }); });
    } catch (e) { part = { err: e.message }; }
    data.participants = part; st.data = data; st.part = part; st.asOf = day.date; st.ok = true; st.err = null;
  } catch (e) { st.ok = false; st.err = e.message; }
  finally { st.busy = false; st.ms = Date.now() - t0; }
  return status();
}
function status() { return { ok: st.ok, err: st.err, asOf: st.asOf, busy: st.busy, ms: st.ms, rows: st.rows, bytes: st.bytes, at: st.at, tried: st.tried.slice(-10) }; }
function eod() { return Object.assign({ status: status() }, st.data ? { data: st.data } : {}); }
function debug() { return { status: status(), header: st.header, sample: st.sample }; }
const fmtK = n => n == null ? '?' : (Math.abs(n) >= 1e5 ? (n / 1e5).toFixed(1) + 'L' : Math.abs(n) >= 1e3 ? (n / 1e3).toFixed(0) + 'k' : String(Math.round(n)));
/* one-line, dated context for an index (information only; never used as a trading gate) */
function context(sym) {
  const m = { '^NSEI': 'NIFTY', '^NSEBANK': 'BANKNIFTY' }[sym], d = st.data; if (!m || !d) return '';
  const x = d.indices.find(i => i.sym === m); if (!x || !x.opt) return ''; const f = d.participants && d.participants.FII;
  return 'F&O ' + d.asOf.slice(5) + ' (info, not a gate): PCR ' + (x.opt.pcr != null ? x.opt.pcr.toFixed(2) : '?') + ' · max pain ' + x.opt.maxPain + (x.opt.resist[0] ? ' · call wall ' + x.opt.resist[0].k : '') + (x.opt.support[0] ? ' · put wall ' + x.opt.support[0].k : '') + (f ? ' · FII index-fut net ' + fmtK(f.futIdxNet) : '');
}
module.exports = { refresh, eod, status, debug, context, parseBhav, analyse, parsePart, unzipFirst, isoDate, maxPain, buildup };
