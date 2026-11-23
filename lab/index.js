'use strict';
/* AI Lab: five paper bots on the same live 15-minute data, same fees, same risk engine, so they can be compared fairly.
 *   A  rule      — transparent EMA/ADX/RSI trend rule (the benchmark every other bot must beat)
 *   B  llm       — LLM-only: reads anonymised indicator snapshots, returns bull/bear case + decision (code sets size and enforces stops)
 *   C  hybrid    — takes only the rule bot's signals; the LLM may veto or shrink size; learns lessons from closed trades (reflection memory -> Obsidian vault)
 *   C0 control   — identical to C but with memory OFF (to prove whether "learning" helps)
 *   D  telegram  — follows a Telegram channel's calls and scores their accuracy on live prices (tg.js)
 * Nothing here is investment advice. Paper money only. LLM output cannot be back-tested on past data (the model may remember it), so only forward results count. */
const D = require('./data.js'), P = require('./paper.js'), LLM = require('./llm.js'), V = require('./vault.js'), TG = require('./tg.js');
const S = (() => { try { return require('../signals.js'); } catch (e) { return require('../../signals.js'); } })();
const E = process.env, FNO = (() => { try { return require('../fno.js'); } catch (e) { try { return require('../../fno.js'); } catch (e2) { return null; } } })();
const SYMS = (E.LAB_SYMS || '^NSEI,^NSEBANK,RELIANCE.NS,HDFCBANK.NS,BTC-USD,ETH-USD').split(',').map(s => s.trim()).filter(Boolean);
const EXTRA = (E.CHART_SYMS || 'GC=F,SI=F,CL=F,INR=X,^GSPC,^IXIC,^N225,^INDIAVIX').split(',').map(s => s.trim()).filter(Boolean);
const POLL = +E.LAB_POLL_MS || 60000, MIN_CONF = +E.LAB_MIN_CONF || 0.6, STOP_ATR = +E.LAB_STOP_ATR || 1.5, TGT_ATR = +E.LAB_TARGET_ATR || 2.5, NOENTRY_MIN = +E.LAB_NO_ENTRY_MIN || 30, MAXHOLD = +E.LAB_MAX_HOLD_BARS || 48;
const MAX_COST_R = +E.LAB_MAX_COST_R || 0;   // 0 = off. Skip entries whose round-trip cost exceeds this many R (backtests show costs, not signals, are what lose money on 15m bars)
const LESSON_N = +E.LESSON_MIN_N || 20, LESSON_DAYS = +E.LESSON_DAYS || 60, ON = (E.LAB || 'on') !== 'off';
const TFS = 900, BOTS = ['A', 'B', 'C', 'C0'];
const BOT_INFO = { A: ['Rule bot', 'EMA20/50 + ADX + RSI trend rule, ATR stop/target. The benchmark.'], B: ['LLM-only', 'LLM analyses an anonymised snapshot and decides. Code sets size and enforces stops.'], C: ['Hybrid + memory', 'Rule signals only; LLM can veto/shrink; learns lessons from closed trades.'], C0: ['Hybrid control', 'Same as Hybrid with memory OFF — shows whether memory helps.'] };
let LIB = null; try { LIB = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'replay', 'strategy_library.json'), 'utf8')).specs; } catch (e) { try { LIB = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'replay', 'strategy_library.json'), 'utf8')).specs; } catch (e2) { LIB = null; } }

const st = { bots: {}, lessons: [], lessonSeq: 0, lastBar: {}, cool: {}, decisions: [], tg: { lastId: 0, signals: [], seq: 0, lastPoll: 0, err: null, baselined: false, polls: 0, newMsgs: 0 }, started: Date.now(), vaultAt: 0 };
BOTS.forEach(id => { st.bots[id] = P.newBot(id, BOT_INFO[id][0], BOT_INFO[id][1]); });
const scan = {}, tasks = [], mem = { px: {}, seenTrades: new Set(), dirty: true, draining: false, lastFlush: 0, lastSave: 0, vix: 15 };
let store = null;
const now = () => Math.floor(Date.now() / 1000), r2 = P.r2;

/* ---------- features ---------- */
function features(cs, meta, tNow) {
  if (cs.length < 70) return null;
  const c = S.ctxFromCandles(cs.slice(-320)), n = c.N - 1, close = c.c[n], ema20 = c.ema(20)[n], ema50 = c.ema(50)[n], rsi = c.rsi(14)[n], adx = c.adx(14)[n], atr = c.atr(14)[n];
  if (![close, ema20, ema50, rsi, adx, atr].every(isFinite) || atr <= 0) return null;
  const regime = close > ema20 && ema20 > ema50 && adx >= 20 ? 'trend_up' : close < ema20 && ema20 < ema50 && adx >= 20 ? 'trend_down' : 'range';
  const t = D.istParts(tNow * 1000), phase = meta.sess === 'IN' ? (t.mins < 630 ? 'open' : t.mins < 840 ? 'mid' : 'close') : '24h';
  const today = meta.sess === 'IN' ? cs.filter(b => D.istParts(b.t * 1000).date === t.date) : cs.slice(-96), hi = Math.max.apply(null, today.map(b => b.h)), lo = Math.min.apply(null, today.map(b => b.l));
  const h20 = c.hh(20, true)[n], l20 = c.ll(20, true)[n], last = cs.slice(-13), path = []; for (let i = 1; i < last.length; i++) path.push(r2((last[i].c / last[i - 1].c - 1) * 100));
  let lib = null; if (LIB) { try { const v = S.libVote(cs.slice(-420), LIB, 420); lib = v ? r2(v.vote) : null; } catch (e) { lib = null; } }
  return { close, ema20, ema50, rsi: r2(rsi), adx: r2(adx), atr, atrPct: r2(atr / close * 100), regime, phase, vsEma20: r2((close / ema20 - 1) * 100), vsEma50: r2((close / ema50 - 1) * 100), dayPos: hi > lo ? r2((close - lo) / (hi - lo)) : 0.5, toHighAtr: r2((h20 - close) / atr), toLowAtr: r2((close - l20) / atr), path, lib };
}
function ruleSignal(f) {
  if (f.regime === 'trend_up' && f.rsi >= 50 && f.rsi <= 72) return 1;
  if (f.regime === 'trend_down' && f.rsi >= 28 && f.rsi <= 50) return -1; return 0;
}
const cls = meta => meta.sym.startsWith('^') ? 'equity index' : meta.book === 'CRYPTO' ? 'crypto' : 'equity';
const snapOf = (meta, f) => ({ instrument_class: cls(meta), timeframe: '15m', session_phase: f.phase, rsi14: f.rsi, adx14: f.adx, atr14_pct_of_price: f.atrPct, regime: f.regime, price_vs_ema20_pct: f.vsEma20, price_vs_ema50_pct: f.vsEma50, range_position_today_0to1: f.dayPos, distance_to_20bar_high_in_atr: f.toHighAtr, distance_to_20bar_low_in_atr: f.toLowAtr, last_12_bar_pct_changes: f.path, daily_strategy_library_long_vote_0to1: f.lib });
const featLite = f => ({ regime: f.regime, rsi: f.rsi, adx: f.adx, atrPct: f.atrPct, phase: f.phase, dayPos: f.dayPos, vsEma20: f.vsEma20 });

/* ---------- lessons (reflection memory) ---------- */
const COND_KEYS = ['regime', 'side', 'rsiBelow', 'rsiAbove', 'adxBelow', 'adxAbove', 'session', 'book'];
function cleanCond(c) {
  if (!c || typeof c !== 'object') return null; const o = {};
  if (['trend_up', 'trend_down', 'range'].includes(c.regime)) o.regime = c.regime; if (['long', 'short'].includes(c.side)) o.side = c.side; if (['open', 'mid', 'close'].includes(c.session)) o.session = c.session; if (['IN', 'CRYPTO'].includes(c.book)) o.book = c.book;
  ['rsiBelow', 'rsiAbove', 'adxBelow', 'adxAbove'].forEach(k => { if (isFinite(+c[k]) && c[k] !== null && c[k] !== '') o[k] = +c[k]; });
  const keys = Object.keys(o).filter(k => k !== 'book'); return keys.length >= 1 ? o : null;
}
function matches(c, f, side, book) {
  if (!f) return false; if (c.regime && f.regime !== c.regime) return false; if (c.side && c.side !== side) return false; if (c.session && f.phase !== c.session) return false; if (c.book && c.book !== book) return false;
  if (c.rsiBelow != null && !(f.rsi < c.rsiBelow)) return false; if (c.rsiAbove != null && !(f.rsi > c.rsiAbove)) return false; if (c.adxBelow != null && !(f.adx < c.adxBelow)) return false; if (c.adxAbove != null && !(f.adx > c.adxAbove)) return false; return true;
}
const condText = c => Object.keys(c).map(k => k + '=' + c[k]).join(' AND ');
function lessonCheck() {   // promotion gate / retirement
  const A = st.bots.A.trades, tNow = now(), baseOf = bk => { const x = A.filter(t => t.book === bk); return x.length ? x.reduce((s, t) => s + t.r, 0) / x.length : 0; };   // baseline is per market
  st.lessons.forEach(L => {
    if (L.status === 'retired') return; const base = baseOf(L.cond.book); const n = L.support + L.contra, mean = n ? L.sumR / n : 0;
    if (tNow > L.expires) { L.status = 'retired'; L.retiredWhy = 'expired'; mem.dirty = true; return; }
    if (L.status === 'candidate' && n >= LESSON_N && L.support / n >= 0.6 && mean <= base - 0.2) { L.status = 'active'; L.activatedAt = tNow; mem.dirty = true; }
    else if (n >= 10 && L.contra > L.support) { L.status = 'retired'; L.retiredWhy = 'contradicted'; mem.dirty = true; }
  });
}
function lessonEvidence(tr) {   // every closed rule-bot trade is out-of-sample evidence for every lesson whose condition it matches
  const f = tr.extra && tr.extra.f; if (!f) return;
  st.lessons.forEach(L => { if (L.status === 'retired' || tr.openT < L.created) return; if (matches(L.cond, f, tr.side === 'LONG' ? 'long' : 'short', tr.book)) { if (tr.r < 0) L.support++; else L.contra++; L.sumR += tr.r; mem.dirty = true; } });
}

/* ---------- decision log + vault notes ---------- */
function logDec(bot, sym, kind, text, extra) { st.decisions.push(Object.assign({ t: Date.now(), bot, sym, kind, text: String(text).slice(0, 220) }, extra || {})); if (st.decisions.length > 300) st.decisions.splice(0, st.decisions.length - 300); mem.dirty = true; }
const fmtT = t => new Date(t * 1000).toISOString().replace('T', ' ').slice(0, 16) + 'Z';
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
function tradeNote(t) {
  const d = new Date(t.closeT * 1000), ym = d.toISOString().slice(0, 7).replace('-', '/'), day = d.toISOString().slice(0, 10), ex = t.extra || {}, f = ex.f || {};
  const md = ['---', 'id: ' + t.id, 'type: trade', 'bot: ' + t.bot, 'symbol: ' + t.sym, 'side: ' + t.side.toLowerCase(), 'entry_time: ' + new Date(t.openT * 1000).toISOString(), 'entry: ' + r2(t.entry), 'stop: ' + r2(t.stop), 'target: ' + (t.target ? r2(t.target) : 'none'), 'exit_time: ' + d.toISOString(), 'exit: ' + r2(t.exit), 'exit_reason: ' + t.reason, 'fees: ' + r2(t.fees), 'pnl: ' + r2(t.pnl), 'r_multiple: ' + r2(t.r), 'regime: ' + (f.regime || ''), 'model: ' + (ex.model || ''), 'lessons_used: [' + (ex.lessons || []).join(', ') + ']', 'tags: [trade, ' + t.bot + ', ' + slug(t.name) + ', ' + (f.regime || 'na') + ', ' + (t.r > 0 ? 'win' : 'loss') + ']', '---', '',
    '# ' + t.bot + ' ' + t.side + ' ' + t.name + ' (' + r2(t.r) + 'R)', '', '**Why:** ' + (t.why || ''), '', '**Snapshot at entry:** ' + JSON.stringify(f), '', '**Result:** ' + t.reason + ', net ' + t.cur + r2(t.pnl) + ', MFE ' + r2(t.mfeR) + 'R, MAE ' + r2(t.maeR) + 'R', ''].join('\n');
  return ['Trades/' + ym + '/' + day + '_' + t.id + '_' + slug(t.name) + '.md', md];
}
function lessonNote(L) { return ['Lessons/' + L.id + '_' + slug(L.claim) + '.md', ['---', 'id: ' + L.id, 'type: lesson', 'status: ' + L.status, 'condition: "' + condText(L.cond) + '"', 'created: ' + fmtT(L.created), 'expires: ' + fmtT(L.expires), 'support: ' + L.support, 'contradict: ' + L.contra, 'sum_r_matching: ' + r2(L.sumR), 'tags: [lesson, ' + L.status + ']', '---', '', '# ' + L.claim, '', 'Condition: `' + condText(L.cond) + '`', '', 'Evidence: ' + L.support + ' matching rule-bot trades lost, ' + L.contra + ' won (out-of-sample since creation). Promotion needs ' + LESSON_N + '+ matches, >=60% losing and clearly worse than the baseline.', '', L.retiredWhy ? 'Retired: ' + L.retiredWhy : '', ''].join('\n')]; }
function dailyNote() {
  const day = new Date().toISOString().slice(0, 10), m = BOTS.map(id => P.metrics(st.bots[id], mem.px)), rows = m.map(x => '| ' + x.id + ' ' + x.name + ' | ' + x.trades + ' | ' + (x.hit == null ? '-' : Math.round(x.hit * 100) + '% (' + Math.round(x.hitCI[0] * 100) + '-' + Math.round(x.hitCI[1] * 100) + ')') + ' | ' + (x.expR == null ? '-' : r2(x.expR)) + ' | ' + x.books.IN.pnlPct * 100 + '% / ' + x.books.CRYPTO.pnlPct * 100 + '% |');
  const sc = tgScore();
  return ['Daily/' + day + '.md', ['---', 'type: daily', 'date: ' + day, 'tags: [daily]', '---', '', '# ' + day, '', '| Bot | Trades | Hit rate (95% CI) | Expectancy R | P&L IN / CRYPTO |', '|---|---|---|---|---|'].concat(rows).concat(['', '**Telegram channel** `' + (TG.CHAN || '-') + '`: ' + sc.called + ' calls, ' + sc.triggered + ' triggered, hit rate ' + (sc.hit == null ? '-' : Math.round(sc.hit * 100) + '%') + ', expectancy ' + (sc.expR == null ? '-' : sc.expR) + 'R', '', '**Active lessons:** ' + (st.lessons.filter(l => l.status === 'active').map(l => l.id).join(', ') || 'none'), '', 'LLM calls today: ' + LLM.status().calls, '']).join('\n')];
}
function vaultSync(force) {
  if (!V.configured()) return;
  BOTS.forEach(id => st.bots[id].trades.forEach(t => { if (!mem.seenTrades.has(t.id)) { mem.seenTrades.add(t.id); const [p, md] = tradeNote(t); V.put(p, md); } }));
  st.lessons.forEach(L => { const [p, md] = lessonNote(L); V.put(p, md); });
  const sigs = st.tg.signals.filter(s => s.state === 'closed' || s.state === 'unscored').slice(-60);
  if (sigs.length) V.put('Signals/telegram_' + (TG.CHAN || 'manual') + '/' + new Date().toISOString().slice(0, 10) + '.md', '# Telegram calls (first-seen text, scored conservatively)\n\n' + sigs.map(s => '- ' + fmtT(s.seenAt / 1000) + ' · ' + s.p.kind + ' ' + (s.p.undName || '') + ' · ' + (s.outcome || s.state) + ' · ' + (s.r != null ? s.r + 'R' : '') + (s.note ? ' · ' + s.note : '') + '\n  - `' + s.text.replace(/\n/g, ' ').slice(0, 160) + '`').join('\n') + '\n');
  const [dp, dm] = dailyNote(); V.put(dp, dm);
  V.put('_index/lessons.json', JSON.stringify(st.lessons.map(l => ({ id: l.id, status: l.status, claim: l.claim, cond: l.cond, support: l.support, contra: l.contra, sumR: l.sumR, expires: l.expires }))));
  V.put('_index/index.json', JSON.stringify(BOTS.reduce((a, id) => a.concat(st.bots[id].trades.slice(-300).map(t => ({ id: t.id, bot: t.bot, sym: t.sym, side: t.side, r: r2(t.r), date: new Date(t.closeT * 1000).toISOString().slice(0, 10), regime: t.extra && t.extra.f && t.extra.f.regime }))), [])));
  V.put('State/lab.json', JSON.stringify(exportState()));
}
const KEEP = ['bots', 'lessons', 'lessonSeq', 'lastBar', 'cool', 'decisions', 'tg'];
function exportState() { const o = { v: 1 }; KEEP.forEach(k => { o[k] = st[k]; }); return o; }
function importState(o) {
  if (!o || o.v !== 1) return false;
  BOTS.forEach(id => { if (o.bots && o.bots[id]) st.bots[id] = Object.assign(P.newBot(id, BOT_INFO[id][0], BOT_INFO[id][1]), o.bots[id]); });
  ['lessons', 'lessonSeq', 'lastBar', 'cool', 'decisions'].forEach(k => { if (o[k] != null) st[k] = o[k]; }); if (o.tg) st.tg = Object.assign(st.tg, o.tg);
  BOTS.forEach(id => st.bots[id].trades.forEach(t => mem.seenTrades.add(t.id))); return true;
}
async function save() { if (!store) return; try { await store.save('lab', exportState()); mem.lastSave = Date.now(); } catch (e) { console.error('lab save', e.message); } }

/* ---------- TG scoring summary ---------- */
function tgScore() {
  const all = st.tg.signals, closed = all.filter(s => s.state === 'closed' && s.outcome !== 'not_triggered'), wins = closed.filter(s => s.r > 0).length, W = P.wilson(wins, closed.length);
  return { called: all.length, parsed: all.filter(s => s.p).length, unparsed: all.filter(s => s.state === 'unparsed').length, unscored: all.filter(s => s.state === 'unscored').length, notTriggered: all.filter(s => s.outcome === 'not_triggered').length, pending: all.filter(s => s.state === 'pending').length, open: all.filter(s => s.state === 'open').length, triggered: closed.length + all.filter(s => s.state === 'open').length, closed: closed.length, wins, hit: closed.length ? wins / closed.length : null, hitCI: closed.length ? W : null, expR: closed.length ? r2(closed.reduce((s, x) => s + x.r, 0) / closed.length) : null, hitAnyTarget: closed.filter(s => s.hits > 0).length };
}

/* ---------- entries ---------- */
function openFor(botId, sym, meta, side, f, why, extra, sizeMult) {
  const bot = st.bots[botId], ent = D.sessionOpen(meta) && (meta.sess !== 'IN' || D.minsToClose(meta) > NOENTRY_MIN); if (!ent) return null;
  const px = mem.px[sym]; if (!px) return null;
  const stopD = (extra && extra.stopAtr || STOP_ATR) * f.atr, tgtD = (extra && extra.targetAtr || TGT_ATR) * f.atr;
  const costR = 2 * (P.CFG.feeBps[meta.book] + P.CFG.slipBps[meta.book]) / 1e4 * px / stopD;   // round-trip fees+slippage measured in R (1R = stop distance)
  if (MAX_COST_R > 0 && costR > MAX_COST_R) { bot.stats.skipped++; if (!mem.costLog || Date.now() - mem.costLog > 600000) { mem.costLog = Date.now(); logDec(botId, sym, 'skip', 'cost gate: fees+slippage = ' + r2(costR) + 'R > ' + MAX_COST_R + 'R limit (stop only ' + r2(stopD / px * 100) + '% of price)'); } return null; }
  const p = P.open(bot, { sym, meta, side, price: px, stopDist: stopD, targetDist: tgtD, t: now(), why, extra: Object.assign({ f: featLite(f), costR: r2(costR) }, extra || {}), sizeMult });
  if (p) { logDec(botId, sym, 'enter', (side > 0 ? 'LONG ' : 'SHORT ') + meta.name + ' @' + r2(p.entry) + ' stop ' + r2(p.stop) + ' · ' + why); mem.dirty = true; }
  return p;
}
function closeFor(botId, p, price, reason) { const tr = P.close(st.bots[botId], p, price, now(), reason); st.cool[botId + '|' + p.sym] = st.lastBar[p.sym] || 0; onClosed(tr); return tr; }
function onClosed(tr) {
  logDec(tr.bot, tr.sym, 'exit', tr.side + ' ' + tr.name + ' ' + tr.reason + ' ' + r2(tr.r) + 'R'); mem.dirty = true;
  if (tr.bot === 'A') { lessonEvidence(tr); lessonCheck(); }
  if (tr.bot === 'C' && LLM.configured()) tasks.push({ kind: 'reflect', bot: 'R', tr, created: Date.now() });
}

/* ---------- LLM tasks ---------- */
const SYS_B = 'You are a disciplined intraday trading analyst. You only see an anonymised indicator snapshot of one instrument (no name, no date). Decide whether a trade has positive expectancy after costs. Most of the time the right answer is "flat". Reply with ONLY a JSON object: {"bull_case":"<=25 words","bear_case":"<=25 words","action":"long|short|flat","confidence":0..1 (probability your call is right),"stop_atr":0.8..3,"target_atr":1..5,"invalidation":"<=20 words"}.';
const SYS_M = 'You manage one open paper trade. You only see an anonymised snapshot. Reply with ONLY JSON: {"action":"hold|close|breakeven","confidence":0..1,"reason":"<=25 words"}. Use "close" only if the trade thesis is clearly broken; use "breakeven" to move the stop to entry once in profit.';
const SYS_C = 'You are a risk gate for a rule-based trading bot. The rule bot proposes the trade below. You only see an anonymised snapshot. Approve only if the setup looks sound after costs; shrink size when unsure. Reply with ONLY JSON: {"decision":"approve|veto","size_mult":0.5..1,"confidence":0..1,"reason":"<=25 words"}.';
const SYS_R = 'You review one closed paper trade to extract a reusable, general lesson. You see the decision-time snapshot, the decision and the realised result. Judge the PROCESS, not the outcome: "process_error" = the setup should not have been taken given the information available; "bad_luck" = reasonable trade that lost; "good_trade". Only for process_error propose ONE lesson with a machine-checkable condition built from these keys only: regime (trend_up|trend_down|range), side (long|short), session (open|mid|close), rsiBelow, rsiAbove, adxBelow, adxAbove (numbers), book (IN|CRYPTO). Reply with ONLY JSON: {"verdict":"process_error|bad_luck|good_trade","claim":"<=25 words, what to avoid","condition":{...}|null,"tags":["..."]}.';
const inRange = (x, a, b) => typeof x === 'number' && x >= a && x <= b;
const vB = d => !['long', 'short', 'flat'].includes(d.action) ? 'action' : !inRange(+d.confidence, 0, 1) ? 'confidence' : d.action !== 'flat' && (!inRange(+d.stop_atr, 0.3, 6) || !inRange(+d.target_atr, 0.3, 10)) ? 'stop/target' : null;
const vM = d => !['hold', 'close', 'breakeven'].includes(d.action) ? 'action' : !inRange(+d.confidence, 0, 1) ? 'confidence' : null;
const vC = d => !['approve', 'veto'].includes(d.decision) ? 'decision' : !inRange(+d.size_mult, 0.1, 1.2) ? 'size_mult' : !inRange(+d.confidence, 0, 1) ? 'confidence' : null;
const vR = d => !['process_error', 'bad_luck', 'good_trade'].includes(d.verdict) ? 'verdict' : null;
const usr = o => JSON.stringify(o);
function cur(sym) { const meta = D.inst(sym); return { meta, f: scan[sym] && scan[sym].f }; }

async function runTask(t) {
  const bid = t.bot;
  if (t.kind === 'entryB') {
    const { meta, f } = t; if (st.bots.B.pos.some(p => p.sym === t.sym)) return; if (Date.now() - t.created > 2 * TFS * 1000) { st.bots.B.stats.skipped++; return; }
    const r = await LLM.call('B', [{ role: 'system', content: SYS_B }, { role: 'user', content: usr(Object.assign(snapOf(meta, f), { risk_per_trade_pct: P.CFG.riskPct * 100 })) }], { validate: vB, maxTokens: 500 });
    if (!r.ok) { st.bots.B.stats.skipped++; logDec('B', t.sym, 'llm-fail', r.error); return; }
    const d = r.data, conf = +d.confidence; logDec('B', t.sym, 'decision', d.action + ' conf ' + r2(conf) + ' · ' + (d.bull_case || '') + ' | ' + (d.bear_case || ''), { model: r.model });
    if (d.action === 'flat' || conf < MIN_CONF) return;
    const clamp = (x, a, b) => Math.min(b, Math.max(a, +x)), side = d.action === 'long' ? 1 : -1;
    openFor('B', t.sym, meta, side, scan[t.sym].f || f, (d.action + ' ' + conf.toFixed(2) + ' · bull: ' + (d.bull_case || '') + ' · bear: ' + (d.bear_case || '') + ' · invalid: ' + (d.invalidation || '')).slice(0, 300), { model: r.model, stopAtr: clamp(d.stop_atr, 0.8, 3), targetAtr: clamp(d.target_atr, 1, 5), conf });
  } else if (t.kind === 'manageB') {
    const p = st.bots.B.pos.find(x => x.sym === t.sym); if (!p) return; const f = scan[t.sym].f || t.f, rNow = (p.side * (mem.px[t.sym] - p.entry) * p.qty) / p.riskAmt;
    const r = await LLM.call('B', [{ role: 'system', content: SYS_M }, { role: 'user', content: usr(Object.assign(snapOf(t.meta, f), { position: { side: p.side > 0 ? 'long' : 'short', r_multiple_now: r2(rNow), bars_held: Math.round((now() - p.openT) / TFS), stop_distance_atr: r2(Math.abs(p.entry - p.stop) / f.atr) } })) }], { validate: vM, maxTokens: 250 });
    if (!r.ok) return; const d = r.data; logDec('B', t.sym, 'manage', d.action + ' ' + r2(+d.confidence) + ' · ' + (d.reason || ''), { model: r.model });
    if (d.action === 'close' && +d.confidence >= MIN_CONF) closeFor('B', p, mem.px[t.sym], 'LLM exit'); else if (d.action === 'breakeven' && rNow >= 0.5 && ((p.side > 0 && p.entry > p.stop) || (p.side < 0 && p.entry < p.stop))) { p.stop = p.entry; }
  } else if (t.kind === 'review') {
    if (st.bots[bid].pos.some(p => p.sym === t.sym)) return; if (Date.now() - t.created > 2 * TFS * 1000) { st.bots[bid].stats.skipped++; return; }
    const f = t.f, side = t.side, sideTxt = side > 0 ? 'long' : 'short'; const matched = bid === 'C' ? st.lessons.filter(L => L.status === 'active' && matches(L.cond, f, sideTxt, t.meta.book)).slice(0, 3) : [];
    const r = await LLM.call(bid, [{ role: 'system', content: SYS_C }, { role: 'user', content: usr(Object.assign(snapOf(t.meta, f), { rule_bot_proposal: { side: sideTxt, stop_atr: STOP_ATR, target_atr: TGT_ATR }, risk_per_trade_pct: P.CFG.riskPct * 100 }, bid === 'C' && matched.length ? { relevant_lessons: matched.map(L => L.claim) } : {})) }], { validate: vC, maxTokens: 250 });
    if (!r.ok) { st.bots[bid].stats.unreviewed++; logDec(bid, t.sym, 'llm-fail', r.error); return; }
    const d = r.data; logDec(bid, t.sym, 'review', d.decision + ' x' + r2(+d.size_mult) + ' · ' + (d.reason || ''), { model: r.model });
    if (d.decision === 'veto') { st.bots[bid].stats.vetoed++; return; }
    let mult = Math.min(1, Math.max(0.5, +d.size_mult)); if (matched.length) mult = Math.min(mult, 0.5);
    openFor(bid, t.sym, t.meta, side, scan[t.sym].f || f, 'rule ' + sideTxt + ' approved · ' + (d.reason || ''), { model: r.model, lessons: matched.map(L => L.id) }, mult);
  } else if (t.kind === 'reflect') {
    const tr = t.tr, ex = tr.extra || {}; const r = await LLM.call('R', [{ role: 'system', content: SYS_R }, { role: 'user', content: usr({ snapshot_at_entry: ex.f, side: tr.side.toLowerCase(), book: tr.book, decision_reason: tr.why, result: { r_multiple: r2(tr.r), exit_reason: tr.reason, max_favourable_r: r2(tr.mfeR), max_adverse_r: r2(tr.maeR) } }) }], { validate: vR, maxTokens: 350 });
    if (!r.ok) return; const d = r.data; logDec('C', tr.sym, 'reflect', d.verdict + ' · ' + (d.claim || ''), { model: r.model });
    if (d.verdict !== 'process_error') return; const cond = cleanCond(d.condition); if (!cond || !d.claim) return; cond.book = tr.book; const key = JSON.stringify(cond);
    if (st.lessons.some(L => L.status !== 'retired' && JSON.stringify(L.cond) === key) || st.lessons.filter(L => L.status === 'candidate').length >= 30) return;
    st.lessons.push({ id: 'L-' + String(++st.lessonSeq).padStart(4, '0'), claim: String(d.claim).slice(0, 160), cond, status: 'candidate', created: now(), expires: now() + LESSON_DAYS * 86400, support: 0, contra: 0, sumR: 0, from: tr.id }); mem.dirty = true;
  } else if (t.kind === 'tgparse') {
    const r = await LLM.call('D', [{ role: 'system', content: TG.SYS }, { role: 'user', content: t.text.slice(0, 600) }], { validate: TG.validLLM, maxTokens: 300 }); const sig = t.sig;
    if (!r.ok) { sig.state = 'unparsed'; sig.note = 'LLM parse failed: ' + r.error; return; } const p = TG.fromLLM(r.data);
    if (!p) { sig.state = 'unparsed'; sig.note = 'not a trade call'; sig.skip = true; return; } sig.p = p; sig.state = p.insane ? 'unscored' : 'pending'; sig.note = p.insane || 'parsed by LLM'; mem.dirty = true;
  }
}
const PRI = { review: 0, manageB: 1, tgparse: 2, entryB: 3, reflect: 4 };
async function drain() {
  if (mem.draining) return; mem.draining = true;
  try {
    let n = 0; while (tasks.length && n < 40) {
      const age = t => (Date.now() - t.created) / 600000; tasks.sort((a, b) => (PRI[a.kind] - age(a)) - (PRI[b.kind] - age(b)));   // aging so reflection is never starved
      const i = tasks.findIndex(t => LLM.allow(t.bot)); if (i < 0) { tasks.filter(t => !LLM.configured() || Date.now() - t.created > 3 * TFS * 1000).forEach(t => { const k = tasks.indexOf(t); if (k >= 0) { tasks.splice(k, 1); if (t.kind === 'review') st.bots[t.bot].stats.unreviewed++; if (t.kind === 'entryB') st.bots.B.stats.skipped++; } }); break; }
      const t = tasks.splice(i, 1)[0]; n++;
      try { await runTask(t); } catch (e) { console.error('lab task', t.kind, e.message); }
    }
  } finally { mem.draining = false; }
}

/* ---------- main cycle ---------- */
async function pollSymbol(sym) {
  const meta = D.inst(sym); if (meta.book === 'OTHER') return;
  if (meta.sess === 'IN') { const t = D.istParts(); if (t.day < 1 || t.day > 5 || t.mins < 540 || t.mins > 945) { if (scan[sym]) scan[sym].open = false; if (!scan[sym]) { try { const r = await D.candles(sym, '15m', 600000); const l = r.candles[r.candles.length - 1]; if (l) { mem.px[sym] = l.c; scan[sym] = { sym, name: meta.name, cur: meta.cur, price: l.c, t: l.t, open: false, stale: false }; } } catch (e) { /* offline */ } } return; } }
  let r; try { r = await D.candles(sym, '15m', 20000); } catch (e) { scan[sym] = Object.assign(scan[sym] || { sym, name: meta.name, cur: meta.cur }, { err: e.message }); return; }
  const cs = r.candles, nowS = now(), last = cs[cs.length - 1]; if (!last) return; mem.px[sym] = last.c;
  const stale = nowS - last.t > 4 * TFS && D.sessionOpen(meta), closed = D.closedBars(cs, '15m', Date.now()), lastClosed = closed[closed.length - 1];
  const s = scan[sym] = Object.assign(scan[sym] || {}, { sym, name: meta.name, cur: meta.cur, price: last.c, t: last.t, open: D.sessionOpen(meta), stale, err: null, src: r.src });
  // manage every open position on this symbol with the newest bars
  BOTS.forEach(id => { const bot = st.bots[id]; bot.pos.filter(p => p.sym === sym).forEach(p => { const tr = P.manage(bot, p, cs, TFS, nowS); if (tr) { st.cool[id + '|' + sym] = lastClosed ? lastClosed.t : 0; onClosed(tr); } }); });
  // time exits
  BOTS.forEach(id => { const bot = st.bots[id]; bot.pos.filter(p => p.sym === sym).forEach(p => { p.last = last.c; if ((meta.sess === 'IN' && D.minsToClose(meta) <= 15) || (meta.sess === '24x7' && nowS - p.openT > MAXHOLD * TFS)) closeFor(id, p, last.c, meta.sess === 'IN' ? 'Intraday close 15:15' : 'Max hold'); }); });
  if (!lastClosed || stale) return;
  const f = features(closed, meta, lastClosed.t + TFS); if (!f) return; s.f = f; s.sig = ruleSignal(f);
  if (st.lastBar[sym] === lastClosed.t) return; const first = st.lastBar[sym] == null; st.lastBar[sym] = lastClosed.t; mem.dirty = true; if (first && st.bots.A.trades.length + st.bots.B.trades.length === 0) { /* first sight: act on the next bar */ }
  if (!D.sessionOpen(meta) || (meta.sess === 'IN' && D.minsToClose(meta) <= NOENTRY_MIN)) return;
  const sig = s.sig;
  if (sig !== 0) {
    st.bots.A.stats.signals++;
    ['A', 'C', 'C0'].forEach(id => { const bot = st.bots[id]; if (bot.pos.some(p => p.sym === sym)) return; if ((st.cool[id + '|' + sym] || 0) + 4 * TFS > lastClosed.t) return; if (id === 'A') openFor('A', sym, meta, sig, f, 'rule: ' + f.regime + ' RSI ' + f.rsi + ' ADX ' + f.adx, {}); else tasks.push({ kind: 'review', bot: id, sym, meta, f, side: sig, created: Date.now() }); });
  }
  if (!st.bots.B.pos.some(p => p.sym === sym)) { if (!tasks.some(t => t.kind === 'entryB' && t.sym === sym) && (st.cool['B|' + sym] || 0) + 2 * TFS <= lastClosed.t) tasks.push({ kind: 'entryB', bot: 'B', sym, meta, f, created: Date.now() }); }
  else if (!tasks.some(t => t.kind === 'manageB' && t.sym === sym)) tasks.push({ kind: 'manageB', bot: 'B', sym, meta, f, created: Date.now() });
}
async function tgTick() {
  const tgS = st.tg; const ctxVix = mem.vix;
  if (TG.CHAN && Date.now() - tgS.lastPoll > (+E.TG_POLL_SEC || 60) * 1000) {
    tgS.lastPoll = Date.now(); tgS.polls++;
    try {
      const msgs = await TG.fetchChannel(TG.CHAN); tgS.err = null; const maxId = msgs.reduce((m, x) => Math.max(m, x.id), 0);
      if (!tgS.baselined) { tgS.baselined = true; tgS.lastId = Math.max(0, maxId - (+E.TG_BACKFILL_MSGS || 0)); }
      msgs.filter(m => m.id > tgS.lastId).sort((a, b) => a.id - b.id).forEach(m => { tgS.lastId = Math.max(tgS.lastId, m.id); tgS.newMsgs++; addSignal(m.text, m.ts, 'channel', m.id); });
    } catch (e) { tgS.err = e.message; }
  }
  for (const sig of tgS.signals) {
    if (sig.state !== 'pending' && sig.state !== 'open') continue; const p = sig.p; if (!p || !p.sym) continue;
    try { const r = await D.candles(p.sym, '5m', 25000); if (TG.advance(sig, r.candles, { vix: ctxVix })) { mem.dirty = true; if (sig.state === 'closed') logDec('D', p.undName || p.sym, 'tg-closed', (sig.outcome || '') + ' ' + (sig.r != null ? sig.r + 'R' : '') + ' ' + (sig.exitReason || '')); } } catch (e) { /* retry next tick */ }
  }
}
function addSignal(text, msgTs, src, id) {
  const tgS = st.tg, t = String(text || '').trim(); if (!t) return null;
  const h = require('crypto').createHash('sha256').update(t).digest('hex').slice(0, 12); if (tgS.signals.some(s => s.hash === h && Date.now() - s.seenAt < 6 * 3600e3)) return null;
  const parsed = TG.parseRule(t), sig = TG.mkSignal(id || ('m' + (++tgS.seq)), parsed, t, msgTs, Date.now(), src); if (parsed) sig.note = parsed.insane || 'parsed by rules';
  if (!parsed) { if (!/\b(BUY|SELL|LONG|SHORT)\b/i.test(t) || !/\d/.test(t)) { sig.state = 'unparsed'; sig.note = 'not a trade call'; sig.skip = true; return null; } sig.state = 'parsing'; tasks.push({ kind: 'tgparse', bot: 'D', text: t, sig, created: Date.now() }); }
  tgS.signals.push(sig); if (tgS.signals.length > 400) tgS.signals.splice(0, tgS.signals.length - 400); mem.dirty = true; return sig;
}
let timer = null, busy = false;
async function tick() {
  if (busy || !ON) return; busy = true;
  try {
    for (const sym of SYMS) { try { await pollSymbol(sym); } catch (e) { console.error('lab poll', sym, e.message); } }
    try { const v = await D.candles('^INDIAVIX', '15m', 120000); const l = v.candles[v.candles.length - 1]; if (l && l.c > 3) mem.vix = l.c; } catch (e) { /* default */ }
    await tgTick(); lessonCheck(); drain().catch(e => console.error('lab drain', e.message));   // LLM latency must never delay price polling / stop checks
    BOTS.forEach(id => { const b = st.bots[id], t = now(); ['IN', 'CRYPTO'].forEach(k => { const c = b.curve[k], last = c[c.length - 1]; if (!last || t - last[0] >= 900) { c.push([t, r2(P.equity(b, k, mem.px))]); if (c.length > 2000) c.splice(0, c.length - 2000); } }); });
    if (Date.now() - mem.lastSave > 60000) await save();
    if (V.configured() && Date.now() - mem.lastFlush > (+E.VAULT_FLUSH_MIN || 15) * 60000) { mem.lastFlush = Date.now(); vaultSync(); await V.flush(); }
  } catch (e) { console.error('lab tick', e.message); } finally { busy = false; }
}
async function start(opts) {
  store = opts && opts.store; if (!ON) { console.log('lab disabled'); return; }
  try { const saved = store && await store.load('lab'); if (saved) importState(saved); } catch (e) { console.error('lab restore', e.message); }
  if (!st.bots.A.trades.length && V.configured()) { try { const t = await V.get('State/lab.json'); if (t) { importState(JSON.parse(t)); console.log('lab state restored from vault'); } } catch (e) { console.error('lab vault restore', e.message); } }
  await LLM.discoverCap(); console.log('lab on · symbols', SYMS.join(','), '· LLM', LLM.configured() ? 'key set' : 'NO KEY', '· vault', V.configured() ? 'on' : 'off', '· telegram', TG.CHAN || 'none');
  setTimeout(tick, 4000); timer = setInterval(tick, POLL);
}
async function shutdown() { try { await save(); if (V.configured()) { vaultSync(); await V.flush('Lab shutdown sync'); } } catch (e) { /* best effort */ } }

/* ---------- API payloads ---------- */
function snapshot() {
  const ms = BOTS.map(id => P.metrics(st.bots[id], mem.px)), base = st.bots.A;
  ms.forEach(m => { m.vsRule = m.id === 'A' ? null : P.pairedDiff(st.bots[m.id], base); });
  ms.forEach(m => {   // per-market breakdown: every bot is judged separately on India and on crypto
    m.byBook = {}; ['IN', 'CRYPTO'].forEach(k => {
      const T = st.bots[m.id].trades.filter(t => t.book === k), w = T.filter(t => t.r > 0).length, bk = m.books[k];
      m.byBook[k] = { trades: T.length, wins: w, hit: T.length ? w / T.length : null, hitCI: T.length ? P.wilson(w, T.length) : null, expR: T.length ? T.reduce((s, t) => s + t.r, 0) / T.length : null, pnlPct: bk.pnlPct, equity: bk.equity, start: bk.start, cur: bk.cur, maxDD: bk.maxDD, open: st.bots[m.id].pos.filter(p => p.book === k).length };
    });
  });
  const positions = [], trades = [];
  BOTS.forEach(id => { const b = st.bots[id]; b.pos.forEach(p => { const last = mem.px[p.sym] != null ? mem.px[p.sym] : p.entry; positions.push({ bot: id, id: p.id, sym: p.sym, name: p.name, cur: p.cur, side: p.side > 0 ? 'LONG' : 'SHORT', entry: p.entry, stop: p.stop, target: p.target, last, r: p.riskAmt ? p.side * (last - p.entry) * p.qty / p.riskAmt : 0, pnl: p.side * (last - p.entry) * p.qty - p.feeIn, openT: p.openT, why: p.why }); }); b.trades.slice(-80).forEach(t => trades.push(Object.assign({}, t, { extra: undefined, f: t.extra && t.extra.f }))); });
  trades.sort((a, b) => b.closeT - a.closeT);
  const tgs = st.tg.signals.slice(-60).reverse().map(s => ({ id: s.id, text: s.text, seenAt: s.seenAt, state: s.state, outcome: s.outcome, r: s.r, hits: s.hits, note: s.note, exitReason: s.exitReason, entry: s.entry, kind: s.p && s.p.kind, und: s.p && s.p.undName, strike: s.p && s.p.strike, opt: s.p && s.p.optType, side: s.p && s.p.side, sl: s.p && s.p.sl, targets: s.p && s.p.targets, entryType: s.p && s.p.entryType, entryLo: s.p && s.p.entryLo, src: s.src, via: s.p && s.p.llm ? 'llm' : 'rules' }));
  return { on: ON, now: Date.now(), cfg: { maxCostR: MAX_COST_R, symbols: SYMS, riskPct: P.CFG.riskPct * 100, minConf: MIN_CONF, stopAtr: STOP_ATR, targetAtr: TGT_ATR, lessonMinN: LESSON_N, books: P.CFG.start, feeBps: P.CFG.feeBps, slipBps: P.CFG.slipBps, noEntryMin: NOENTRY_MIN }, llm: LLM.status(), vault: V.status(), tg: { channel: TG.CHAN || null, err: st.tg.err, polls: st.tg.polls, newMsgs: st.tg.newMsgs, lastPoll: st.tg.lastPoll, baselined: st.tg.baselined, lastId: st.tg.lastId, score: tgScore(), signals: tgs }, bots: ms, positions, trades: trades.slice(0, 120), curves: BOTS.reduce((o, id) => { o[id] = st.bots[id].curve; return o; }, {}),
    scan: Object.values(scan).map(s => ({ sym: s.sym, name: s.name, cur: s.cur, price: s.price, t: s.t, open: s.open, stale: s.stale, err: s.err, regime: s.f && s.f.regime, rsi: s.f && s.f.rsi, adx: s.f && s.f.adx, atrPct: s.f && s.f.atrPct, sig: s.sig, lib: s.f && s.f.lib })), decisions: st.decisions.slice(-80).reverse(), lessons: st.lessons.map(l => ({ id: l.id, status: l.status, claim: l.claim, cond: condText(l.cond), support: l.support, contra: l.contra, meanR: (l.support + l.contra) ? r2(l.sumR / (l.support + l.contra)) : null, expires: l.expires, retiredWhy: l.retiredWhy })), queue: tasks.length, queueKinds: tasks.reduce((o, t) => { o[t.kind] = (o[t.kind] || 0) + 1; return o; }, {}), uptimeMin: Math.round((Date.now() - st.started) / 60000) };
}
async function chart(sym, tf) {
  tf = D.TF[tf] ? tf : '15m'; const meta = D.inst(sym), r = await D.candles(sym, tf, tf === '1d' ? 60000 : 20000), sh = meta.sess === 'IN' ? 19800 : 0;
  const markers = []; BOTS.forEach(id => { st.bots[id].trades.filter(t => t.sym === sym).slice(-60).forEach(t => { markers.push({ t: t.openT, bot: id, kind: 'in', side: t.side, px: t.entry }); markers.push({ t: t.closeT, bot: id, kind: 'out', side: t.side, px: t.exit, r: t.r }); }); st.bots[id].pos.filter(p => p.sym === sym).forEach(p => markers.push({ t: p.openT, bot: id, kind: 'in', side: p.side > 0 ? 'LONG' : 'SHORT', px: p.entry })); });
  const lines = []; BOTS.forEach(id => st.bots[id].pos.filter(p => p.sym === sym).forEach(p => { lines.push({ bot: id, kind: 'entry', px: p.entry }); lines.push({ bot: id, kind: 'stop', px: p.stop }); if (p.target) lines.push({ bot: id, kind: 'target', px: p.target }); }));
  return { sym, name: meta.name, cur: meta.cur, tf, shift: sh, src: r.src, candles: r.candles.slice(-500), markers, lines, open: D.sessionOpen(meta), now: Date.now() };
}
async function prices() {
  const list = SYMS.concat(EXTRA.filter(x => SYMS.indexOf(x) < 0)); const out = await Promise.all(list.map(s => D.quote(s).catch(() => null)));
  return out.map((q, i) => q || { sym: list[i], name: D.inst(list[i]).name, err: true });
}
const chartSymbols = () => SYMS.concat(EXTRA.filter(x => SYMS.indexOf(x) < 0)).map(s => ({ sym: s, name: D.inst(s).name, lab: SYMS.indexOf(s) >= 0 }));
async function flushNow() { vaultSync(); const r = await V.flush('Manual lab sync'); await save(); return r; }
module.exports = { start, tick, snapshot, chart, prices, chartSymbols, addSignal, shutdown, flushNow, features, ruleSignal, cleanCond, matches, state: st, tasks, TGparse: TG.parseRule };
