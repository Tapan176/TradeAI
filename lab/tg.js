'use strict';
/* Bot D: Telegram signal follower. Reads a PUBLIC channel's web preview (https://t.me/s/<channel>) — no login, no userbot — or messages you forward/paste via /api/lab/tg/ingest.
 * Parses Indian-market tip messages (regex first, LLM fallback), then scores every call on live prices with conservative rules:
 *  - fills only on prices AFTER the time we first saw the message; first-seen text is scored (edits are ignored); every call is counted, including never-triggered ones
 *  - if one bar touches both stop and target the STOP is assumed first; targets split the position equally; time stop 15:15 IST (cash/options) or 24 h (crypto)
 *  - index-option calls are scored on a MODELED premium (Black-Scholes from live spot + India VIX) and only when the model agrees with the premium the channel quotes. */
const D = require('./data.js'), FNO = (() => { try { return require('../fno.js'); } catch (e) { try { return require('../../fno.js'); } catch (e2) { return null; } } })();
const E = process.env, CHAN = (E.TG_CHANNEL || '').replace(/^https?:\/\/t\.me\/(s\/)?/, '').replace(/^@/, '').replace(/\/.*$/, '');
const IDX = { NIFTY: { y: '^NSEI', und: 'NIFTY' }, BANKNIFTY: { y: '^NSEBANK', und: 'BANKNIFTY' }, FINNIFTY: { y: null, und: 'FINNIFTY' }, SENSEX: { y: '^BSESN', und: null }, NIFTYBANK: { y: '^NSEBANK', und: 'BANKNIFTY' } };
const CRY = { BTC: 'BTC-USD', BITCOIN: 'BTC-USD', ETH: 'ETH-USD', ETHEREUM: 'ETH-USD', SOL: 'SOL-USD', SOLANA: 'SOL-USD' };
const SKIP = new Set(['BUY', 'SELL', 'ABOVE', 'BELOW', 'TGT', 'SL', 'CMP', 'NEAR', 'ENTRY', 'LONG', 'SHORT', 'CE', 'PE', 'CALL', 'PUT', 'INTRADAY', 'BTST', 'STBT', 'RISKY', 'JACKPOT', 'LEVEL', 'LEVELS', 'TARGET', 'STOPLOSS', 'AND', 'THE', 'FOR', 'ONLY', 'AT', 'ON', 'TO', 'NOW', 'TODAY', 'WITH', 'BOOK', 'PROFIT', 'EXIT', 'HOLD', 'HIT', 'DONE', 'ALL', 'TRADE', 'CALLS', 'OPTION', 'OPTIONS']);

/* ---------- parsing ---------- */
function norm(t) {
  return String(t || '').toUpperCase().replace(/[₹$]/g, ' ').replace(/(\d),(\d{3})/g, '$1$2').replace(/[‐‑–—−]/g, '-').replace(/[^\x20-\x7E\n]/g, ' ')
    .replace(/\b(STOP\s*LOSS|STOPLOSS|S\/L|SL\s*:)/g, ' SL ').replace(/\b(TARGETS?|TGTS?|TP|T)\s*\d?\b\s*[:\-=]?/g, ' TGT ').replace(/\b(ABV|ON CROSSING|ON BREAKING|ABOVE)\b/g, ' ABOVE ').replace(/\b(BLW)\b/g, ' BELOW ')
    .replace(/\b(ENTRY|ENTER)\s*(AT|@|:)?/g, ' @ ').replace(/\bCALL\b/g, ' CE ').replace(/\bPUT\b/g, ' PE ').replace(/[ \t]+/g, ' ');
}
const num = s => { const v = parseFloat(s); return isFinite(v) ? v : null; };
function parseRule(raw) {
  const t = norm(raw); if (!/\b(BUY|SELL|LONG|SHORT)\b/.test(t) || !/SL\b/.test(t) || !/TGT/.test(t)) return null;
  const side = /\b(SELL|SHORT)\b/.test(t) && !/\b(BUY|LONG)\b/.test(t.split(/SL|TGT/)[0]) ? -1 : 1;
  const sl = num((/SL\s*[:\-@]?\s*(\d+(?:\.\d+)?)/.exec(t) || [])[1]); if (sl == null) return null;
  const targets = []; { const re = /TGT\s*[:\-@]?\s*([\d.\/ ,\-]+)/g; let m; while ((m = re.exec(t))) (m[1].match(/\d+(?:\.\d+)?/g) || []).forEach(x => { if (+x > 0) targets.push(+x); }); } if (!targets.length) return null;
  const head = t.split(/\bSL\b/)[0];
  const op = /\b(\d{3,6})\s*(CE|PE)\b/.exec(head), und = (/\b(BANKNIFTY|NIFTYBANK|FINNIFTY|NIFTY|SENSEX|BTC|BITCOIN|ETH|ETHEREUM|SOL|SOLANA)\b/.exec(head) || [])[1];
  let ent = /(ABOVE|BELOW|@|NEAR|AT|CMP|BUY|SELL)\s*[:\-]?\s*(\d+(?:\.\d+)?)(?:\s*(?:-|TO)\s*(\d+(?:\.\d+)?))?/.exec(head.replace(/\b(\d{3,6})\s*(CE|PE)\b/, ' OPT '));
  if (!ent) { const m = /(\d+(?:\.\d+)?)\s*(?:-|TO)\s*(\d+(?:\.\d+)?)/.exec(head); if (m) ent = [m[0], 'RANGE', m[1], m[2]]; }
  if (!ent) return null;
  const kw = ent[1], lo = num(ent[2]), hi = ent[3] ? num(ent[3]) : null; if (lo == null) return null;
  const out = { entryType: kw === 'ABOVE' ? 'above' : kw === 'BELOW' ? 'below' : (hi != null || kw === 'RANGE') ? 'range' : 'at', entryLo: lo, entryHi: hi, sl, targets, side };
  if (op) { out.kind = 'index_opt'; out.strike = +op[1]; out.optType = op[2]; out.undName = und && IDX[und] ? (IDX[und].und || und) : null; out.sym = und && IDX[und] ? IDX[und].y : null; out.side = 1; /* long the option */ }
  else if (und && CRY[und]) { out.kind = 'crypto'; out.sym = CRY[und]; out.undName = und; }
  else if (und && IDX[und]) { out.kind = 'index'; out.sym = IDX[und].y; out.undName = und; }
  else {
    const stock = (head.match(/\b[A-Z][A-Z&\-]{1,14}\b/g) || []).find(w => !SKIP.has(w) && !/^(NIFTY|BANKNIFTY|SENSEX)$/.test(w));
    if (!stock) return null; out.kind = 'stock'; out.sym = stock.replace(/&/g, '%26') + '.NS'; out.undName = stock;
  }
  const e0 = out.entryHi != null ? (out.entryLo + out.entryHi) / 2 : out.entryLo;
  if (out.side > 0 ? !(sl < e0 && targets.every(x => x > e0)) : !(sl > e0 && targets.every(x => x < e0))) { out.insane = 'levels not ordered (SL/entry/targets)'; }
  return out;
}
function validLLM(d) {
  if (!d || typeof d !== 'object') return 'not an object'; if (d.is_signal === false) return null;
  if (!['BUY', 'SELL'].includes(String(d.action).toUpperCase())) return 'action'; if (!(+d.sl > 0)) return 'sl'; if (!Array.isArray(d.targets) || !d.targets.length || d.targets.some(x => !(+x > 0))) return 'targets';
  if (!(+d.entry_low > 0)) return 'entry_low'; if (!d.underlying) return 'underlying'; return null;
}
function fromLLM(d) {
  if (d.is_signal === false) return null; const und = String(d.underlying).toUpperCase().replace(/\s+/g, ''), opt = d.opt_type ? String(d.opt_type).toUpperCase() : null, side = String(d.action).toUpperCase() === 'SELL' && !opt ? -1 : 1;
  const out = { entryType: ['above', 'below', 'at', 'range', 'cmp'].includes(d.entry_type) ? (d.entry_type === 'cmp' ? 'at' : d.entry_type) : 'at', entryLo: +d.entry_low, entryHi: d.entry_high ? +d.entry_high : null, sl: +d.sl, targets: d.targets.map(Number), side, llm: true };
  if (opt === 'CE' || opt === 'PE') { out.kind = 'index_opt'; out.strike = +d.strike; out.optType = opt; out.undName = IDX[und] ? IDX[und].und : null; out.sym = IDX[und] ? IDX[und].y : null; out.side = 1; if (!out.strike) return null; }
  else if (CRY[und]) { out.kind = 'crypto'; out.sym = CRY[und]; out.undName = und; } else if (IDX[und]) { out.kind = 'index'; out.sym = IDX[und].y; out.undName = und; } else { out.kind = 'stock'; out.sym = und.replace(/&/g, '%26') + '.NS'; out.undName = und; }
  const e0 = out.entryHi != null ? (out.entryLo + out.entryHi) / 2 : out.entryLo; if (out.side > 0 ? !(out.sl < e0 && out.targets.every(x => x > e0)) : !(out.sl > e0 && out.targets.every(x => x < e0))) out.insane = 'levels not ordered (SL/entry/targets)';
  return out;
}
const SYS = 'You extract trade signals from Indian stock/index/crypto Telegram tip messages. Reply with ONLY a JSON object. If the message is not a new trade call (e.g. a "target hit" update, chat, ad), reply {"is_signal":false}. Otherwise: {"is_signal":true,"action":"BUY|SELL","underlying":"BANKNIFTY|NIFTY|FINNIFTY|SENSEX|BTC|ETH|<NSE stock symbol>","strike":number|null,"opt_type":"CE|PE|null","expiry":"text or null","entry_type":"above|below|at|range|cmp","entry_low":number,"entry_high":number|null,"sl":number,"targets":[numbers]}. Premium levels for options are option prices, not index levels.';

/* ---------- scoring ---------- */
function bsPrice(und, spot, strike, type, T, vix) { if (!FNO || !und || !FNO.UND[und]) return null; const iv = FNO.ivModel(und, vix || 15, spot, strike, Math.max(T, 1 / 365 / 24)); return FNO.bs(type, spot, strike, Math.max(T, 1e-5), iv).p; }
function nextExpiry(und, dateStr) { if (!FNO || !und || !FNO.UND[und]) return null; return (FNO.expiries(und, dateStr) || [])[0] || null; }
function expiryEnd(dateStr) { return Date.parse(dateStr + 'T10:00:00Z'); }   // 15:30 IST
const R4 = x => Math.round(x * 1e4) / 1e4;

function mkSignal(id, parsed, text, msgTs, seenAt, src) {
  return { id, text: String(text).slice(0, 500), hash: require('crypto').createHash('sha256').update(String(text)).digest('hex').slice(0, 12), msgTs, seenAt, src: src || 'channel', p: parsed, state: parsed ? (parsed.insane ? 'unscored' : 'pending') : 'unparsed', note: parsed && parsed.insane || '', fills: [], chk: 0 };
}
/* advance one signal using its price bars. sigBars: [{t,o,h,l,c}] (5m). returns true when state changed */
function advance(sig, bars, ctx) {
  const p = sig.p; if (!p || sig.state === 'unscored' || sig.state === 'closed' || sig.state === 'unparsed') return false;
  const start = Math.ceil(sig.seenAt / 1000 / 300) * 300, isOpt = p.kind === 'index_opt', isIN = p.kind !== 'crypto';
  const tlimit = isIN ? (() => { const d = D.istParts(sig.seenAt); const base = Date.parse(d.date + 'T09:45:00Z'); /* 15:15 IST */ return (sig.seenAt > base ? base + 864e5 : base) / 1000; })() : (sig.seenAt / 1000 + 86400);
  let changed = false;
  if (isOpt) {   // modeled premium path
    if (!sig.opt) {
      const und = p.undName, ex = nextExpiry(und, D.istParts(sig.seenAt).date); if (!ex || !p.strike) { sig.state = 'unscored'; sig.note = 'option contract not identifiable'; return true; }
      const b0 = bars.find(b => b.t >= start - 300) || bars[0]; if (!b0) return false; const T0 = (expiryEnd(ex) - sig.seenAt) / 31557600e3, m0 = bsPrice(und, b0.c, p.strike, p.optType, T0, ctx.vix);
      const ref = p.entryHi != null ? (p.entryLo + p.entryHi) / 2 : p.entryLo;
      if (m0 == null || Math.abs(ref / m0 - 1) > 0.4) { sig.state = 'unscored'; sig.note = 'modeled premium ' + (m0 == null ? 'n/a' : m0.toFixed(1)) + ' disagrees with the quoted ' + ref + ' (no real option prices here)'; return true; }
      sig.opt = { ex, ref, m0: R4(m0) }; changed = true;
    }
  }
  const px = b => { if (!isOpt) return { hi: b.h, lo: b.l, op: b.o, cl: b.c }; const T = (expiryEnd(sig.opt.ex) - b.t * 1000) / 31557600e3, f = x => bsPrice(p.undName, x, p.strike, p.optType, T, ctx.vix), a = [f(b.o), f(b.h), f(b.l), f(b.c)]; if (a.some(x => x == null)) return null; return { hi: Math.max.apply(null, a), lo: Math.min.apply(null, a), op: a[0], cl: a[3] }; };
  const entLo = p.entryLo, entHi = p.entryHi != null ? p.entryHi : p.entryLo, risk = Math.abs(((p.entryHi != null ? (entLo + entHi) / 2 : entLo)) - p.sl);
  for (const b of bars) {
    if (b.t < start || b.t <= sig.chk) continue; const q = px(b); if (!q) continue; const dir = p.side;
    if (sig.state === 'pending') {
      if (b.t >= tlimit) { sig.state = 'closed'; sig.outcome = 'not_triggered'; sig.r = 0; sig.closeT = b.t; return true; }
      let fill = null;
      if (p.entryType === 'above') { if (q.hi >= entLo) fill = Math.max(entLo, q.op); } else if (p.entryType === 'below') { if (q.lo <= entLo) fill = Math.min(entLo, q.op); }
      else if (p.entryType === 'range') { if (q.lo <= entHi && q.hi >= entLo) fill = dir > 0 ? Math.min(entHi, Math.max(entLo, q.op)) : Math.max(entLo, Math.min(entHi, q.op)); } else { fill = q.op; }   // 'at'/CMP: first price after we saw it
      if (fill != null) { const slip = isOpt ? 0.01 : (p.kind === 'crypto' ? 0.0003 : 0.0002); fill = fill * (1 + dir * slip); sig.state = 'open'; sig.entry = R4(fill); sig.openT = b.t; sig.remaining = p.targets.length; sig.realized = 0; sig.risk = Math.abs(fill - p.sl); sig.hits = 0; changed = true; if (!(sig.risk > 0)) { sig.state = 'unscored'; sig.note = 'zero risk'; return true; } }
      else { sig.chk = b.t; continue; }
    }
    if (sig.state === 'open') {
      const hitS = dir > 0 ? q.lo <= p.sl : q.hi >= p.sl, tg = p.targets.slice().sort((a, c) => dir > 0 ? a - c : c - a);
      if (hitS) { const gap = dir > 0 ? q.op < p.sl : q.op > p.sl, ex = gap ? q.op : p.sl; sig.realized += sig.remaining * dir * (ex - sig.entry) / sig.risk; sig.remaining = 0; sig.exitReason = sig.hits ? 'stop after T' + sig.hits : 'stop'; }
      else { while (sig.remaining > 0 && sig.hits < tg.length && (dir > 0 ? q.hi >= tg[sig.hits] : q.lo <= tg[sig.hits])) { sig.realized += dir * (tg[sig.hits] - sig.entry) / sig.risk; sig.hits++; sig.remaining--; } if (sig.remaining === 0) sig.exitReason = 'all targets'; }
      if (sig.remaining > 0 && b.t >= tlimit) { sig.realized += sig.remaining * dir * (q.cl - sig.entry) / sig.risk; sig.remaining = 0; sig.exitReason = 'time stop'; }
      if (sig.remaining === 0) { const n = p.targets.length; sig.r = R4(sig.realized / n); sig.state = 'closed'; sig.outcome = sig.r > 0 ? 'win' : 'loss'; sig.closeT = b.t; changed = true; sig.chk = b.t; return true; }
    }
    sig.chk = b.t;
  }
  return changed;
}

/* ---------- channel poller ---------- */
function decodeEnt(s) { return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d)); }
function parseHtml(html) {
  const out = [], parts = String(html).split(/class="tgme_widget_message_wrap/).slice(1);
  for (const w of parts) {
    const post = /data-post="([^"\/]+)\/(\d+)"/.exec(w); if (!post) continue; const tx = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(w); if (!tx) continue;
    const dt = /<time[^>]*datetime="([^"]+)"/.exec(w), text = decodeEnt(tx[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''));
    out.push({ chan: post[1], id: +post[2], ts: dt ? Date.parse(dt[1]) : null, text });
  }
  return out;
}
async function fetchChannel(chan) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), 15000);
  try { const r = await fetch('https://t.me/s/' + chan, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36', 'Accept-Language': 'en' }, signal: c.signal }); if (!r.ok) throw new Error('t.me HTTP ' + r.status); const h = await r.text(); const m = parseHtml(h); if (!m.length && !/tgme_channel_info|tgme_page/.test(h)) throw new Error('channel preview not available (private channel or preview disabled)'); return m; } finally { clearTimeout(t); }
}
module.exports = { CHAN, parseRule, parseHtml, fetchChannel, mkSignal, advance, fromLLM, validLLM, SYS, norm };
