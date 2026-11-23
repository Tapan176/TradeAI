/* PaperBot F&O engine — index FUTURES and OPTIONS, paper money only.
 *
 * Underlyings: NIFTY (lot 65), BANKNIFTY (30), FINNIFTY (60)   [lot sizes: NSE circulars effective Jan 2026]
 * Segments:    FUT (long/short index futures)  ·  OPT (long options, debit spreads, iron condors)
 * Prices:      real option-chain quotes when the caller supplies them, otherwise Black-Scholes from spot + India VIX (MODELED, flagged).
 * Costs:       brokerage Rs20/order, STT (post 1-Apr-2026: futures 0.05% on sell, options 0.15% on sell premium and on ITM-long settlement),
 *              exchange/SEBI/stamp/GST approximations. Slippage = half a modeled bid/ask spread.
 * Margin:      approximations (futures 12% notional, long option = premium, spreads = max loss). Not a broker SPAN calculation.
 * Learner:     arms = strategy|trend-regime, scored by R (pnl / planned risk). Switched-off arms get one probation trade every 30 candles.
 *
 * Everything is plain JSON in `state`, so the server can persist/restore it. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine'));
  else root.PaperFno = factory(root.PaperBot);
})(typeof self !== 'undefined' ? self : this, function (PB) {
  'use strict';

  const UND = {
    NIFTY:     { lot: 65, step: 50,  idx: 'NIFTY_50',                 weekly: true,  vixMult: 1.00 },
    BANKNIFTY: { lot: 30, step: 100, idx: 'NIFTY_BANK',               weekly: false, vixMult: 1.15 },
    FINNIFTY:  { lot: 60, step: 50,  idx: 'NIFTY_FINANCIAL_SERVICES', weekly: false, vixMult: 1.10 }
  };
  const R_FREE = 0.065, DIV_Y = 0.013, CARRY = R_FREE - DIV_Y;
  const DEFAULTS = {
    currency: '₹', startBalance: 1000000, underlyings: ['NIFTY', 'BANKNIFTY'], adaptive: true,
    enabled: ['fut_trend', 'bull_call_spread', 'bear_put_spread', 'iron_condor'],   // long_call / long_put available but off by default (negative in research)
    futMarginPct: 0.12, maxMarginPct: 0.60, maxPositions: 6, maxLossPerTradePct: 0.04,
    haltDrawdown: 0.25, exploreTrials: 6, probationEvery: 30, armAlpha: 0.15, armOn: { mean: 0.0, lcb: -0.5 }, armOff: { mean: -0.10, lcb: -0.8 },
    brokerage: 20, slippageFut: 0.0001, spreadPct: 0.004, minSpread: 0.05,
    futStopAtr: 2.5, condorMinVixPct: 0.35, condorDteMin: 20, condorDteMax: 45, closeDte: 4,
    cashYieldPa: 0.05, futShorts: true, maxLogs: 300, maxEquityPts: 1500
  };
  const STRAT_LABEL = { fut_trend: 'Futures trend (long/short)', long_call: 'Long call', long_put: 'Long put', bull_call_spread: 'Bull call spread', bear_put_spread: 'Bear put spread', iron_condor: 'Iron condor' };

  /* ---------- pricing ---------- */
  function ncdf(x) { const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989423 * Math.exp(-x * x / 2); let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; }
  function bs(type, S, K, T, iv) {   // returns { p, delta }
    if (T <= 0 || iv <= 0) { const p = type === 'CE' ? Math.max(S - K, 0) : Math.max(K - S, 0); return { p, delta: type === 'CE' ? (S > K ? 1 : 0) : (S < K ? -1 : 0) }; }
    const sq = iv * Math.sqrt(T), d1 = (Math.log(S / K) + (R_FREE - DIV_Y + iv * iv / 2) * T) / sq, d2 = d1 - sq;
    const eq = Math.exp(-DIV_Y * T), er = Math.exp(-R_FREE * T);
    return type === 'CE' ? { p: S * eq * ncdf(d1) - K * er * ncdf(d2), delta: eq * ncdf(d1) } : { p: K * er * ncdf(-d2) - S * eq * ncdf(-d1), delta: -eq * ncdf(-d1) };
  }
  const futPrice = (S, T) => S * Math.exp(CARRY * Math.max(T, 0));
  function ivModel(und, vix, S, K, T) { const f = futPrice(S, T), base = vix / 100 * UND[und].vixMult, sk = 1 - 1.2 * Math.log(K / f); return Math.max(0.05, base * Math.min(1.6, Math.max(0.7, sk))); }

  /* ---------- calendar ---------- */
  const D = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const iso = ms => new Date(ms).toISOString().slice(0, 10);
  const dte = (from, to) => Math.round((D(to) - D(from)) / 864e5);
  function lastTuesday(y, m) { let d = new Date(Date.UTC(y, m + 1, 0)); while (d.getUTCDay() !== 2) d = new Date(d - 864e5); return iso(+d); }
  function expiries(und, date) {   // upcoming expiry dates (modeled calendar; replaced by real chain expiries when available)
    const out = new Set(), t0 = D(date), dt = new Date(t0);
    for (let k = 0; k < 4; k++) { const e = lastTuesday(dt.getUTCFullYear(), dt.getUTCMonth() + k); if (e >= date) out.add(e); }
    if (UND[und].weekly) for (let k = 0; k < 6; k++) { let d = new Date(t0 + k * 7 * 864e5); while (d.getUTCDay() !== 2) d = new Date(+d + 864e5); if (iso(+d) >= date) out.add(iso(+d)); }
    return Array.from(out).sort();
  }
  const monthlyExp = (und, date) => { const dt = new Date(D(date)); for (let k = 0; k < 4; k++) { const e = lastTuesday(dt.getUTCFullYear(), dt.getUTCMonth() + k); if (e >= date) return e; } };
  function pickExpiry(list, date, lo, hi) { const ok = list.filter(e => { const d = dte(date, e); return d >= lo && d <= hi; }); return ok.length ? ok[ok.length - 1] : null; }   // farthest inside window (prefers monthly)

  /* ---------- factory ---------- */
  function create(opts) {
    opts = opts || {};
    const cfg = Object.assign({}, DEFAULTS, opts.cfg || {});
    let S = opts.state || null;
    if (!S) {
      S = { v: 3, kind: 'fno', cfg, startedAt: Date.now(), tick: 0, candleIdx: 0, date: opts.date || null, realized: 0, fees: 0, peak: cfg.startBalance, maxDD: 0,
        positions: [], trades: [], log: [], equity: [], nextId: 1, arms: {}, observed: 0, halted: null, cooldown: {},
        und: {}, vix: 15, vixHist: (opts.vixHist || []).slice(-300), feed: { mode: 'modeled', name: 'modeled', note: '' }, lastScan: '', quoteSrc: 'modeled',
        agents: ['Supervisor', 'Data', 'Analyst', 'Strategy', 'Learner', 'Risk', 'Executor', 'Reporter'].reduce((o, n) => (o[n] = { status: 'idle', last: '—', tick: 0, count: 0 }, o), {}) };
      cfg.underlyings.forEach(u => { S.und[u] = { candles: ((opts.history || {})[u] || []).slice(-400), price: 0, start: 0, chain: null, analysis: null }; });
    } else Object.assign(cfg, S.cfg || {}), S.cfg = cfg;
    const quiet = !!opts.quiet;
    const lotOf = u => UND[u].lot;
    const agent = (n, last) => { const a = S.agents[n]; a.status = 'working'; a.last = last; a.tick = S.tick; a.count++; };
    function log(agentName, level, msg) { S.log.push({ ts: Date.now(), agent: agentName, level, msg }); if (S.log.length > cfg.maxLogs) S.log.shift(); }
    const usd = v => cfg.currency + (Math.round(v * 100) / 100).toLocaleString('en-IN');

    /* ----- quotes ----- */
    function chainRow(und, exp, K) { const c = S.und[und].chain; return c && c[exp] && c[exp][K]; }
    function quote(und, kind, K, exp) {   // { mid, bid, ask, iv, delta, src }
      const u = S.und[und], spot = u.price, T = Math.max(dte(S.date, exp), 0) / 365;
      if (kind === 'FUT') { const m = futPrice(spot, T), h = m * cfg.slippageFut; return { mid: m, bid: m - h, ask: m + h, iv: 0, delta: 1, src: 'model' }; }
      const row = chainRow(und, exp, K), side = row && row[kind === 'CE' ? 'ce' : 'pe'];
      if (side && side.ltp > 0) {
        const mid = side.bid > 0 && side.ask > 0 ? (side.bid + side.ask) / 2 : side.ltp, h = side.bid > 0 && side.ask > 0 ? (side.ask - side.bid) / 2 : Math.max(cfg.minSpread, mid * cfg.spreadPct / 2);
        const iv = side.iv > 0 ? side.iv / 100 : ivModel(und, S.vix, spot, K, T);
        return { mid, bid: Math.max(0.05, mid - h), ask: mid + h, iv, delta: bs(kind, spot, K, T, iv).delta, src: 'chain' };
      }
      const iv = ivModel(und, S.vix, spot, K, T), g = bs(kind, spot, K, T, iv), h = Math.max(cfg.minSpread, g.p * cfg.spreadPct / 2);
      return { mid: g.p, bid: Math.max(0.05, g.p - h), ask: g.p + h, iv, delta: g.delta, src: 'model' };
    }
    const intrinsic = (kind, spot, K) => kind === 'FUT' ? spot : kind === 'CE' ? Math.max(spot - K, 0) : Math.max(K - spot, 0);

    /* ----- costs (approximate; see header) ----- */
    function orderFee(kind, side, price, qtyUnits, brokerage) {
      const turnover = price * qtyUnits, br = brokerage === undefined ? cfg.brokerage : brokerage;
      const isFut = kind === 'FUT', txn = turnover * (isFut ? 0.0000173 : 0.0003503), sebi = turnover * 0.000001;
      const stt = side < 0 ? turnover * (isFut ? 0.0005 : 0.0015) : 0, stamp = side > 0 ? turnover * (isFut ? 0.00002 : 0.00003) : 0;
      return br + txn + sebi + stt + stamp + 0.18 * (br + txn + sebi);
    }
    const settleFee = (kind, spot, K, side, units) => (kind !== 'FUT' && side > 0 && intrinsic(kind, spot, K) > 0) ? intrinsic(kind, spot, K) * units * 0.0015 : 0;   // STT on ITM long at expiry

    /* ----- valuation ----- */
    function legExitPx(l, und) { const q = quote(und, l.kind, l.K, l.exp); return l.side > 0 ? q.bid : q.ask; }   // liquidation price
    function posValue(p) { return p.legs.reduce((a, l) => a + l.side * legExitPx(l, p.und), 0); }                 // per-unit liquidation value
    const posPnl = (p, v) => (v - p.entryVal) * p.lot * p.lots;
    function unrealized() { return S.positions.reduce((a, p) => a + posPnl(p, posValue(p)), 0); }
    const equity = () => cfg.startBalance + S.realized - S.fees + unrealized();
    const marginUsed = () => S.positions.reduce((a, p) => a + p.margin, 0);

    /* ----- open / close ----- */
    function open(und, strat, legsSpec, lots, ctx, extra) {
      const lot = lotOf(und);
      const legs = legsSpec.map(l => { const q = quote(und, l.kind, l.K, l.exp); return { kind: l.kind, K: l.K, exp: l.exp, side: l.side, fill: l.side > 0 ? q.ask : q.bid, src: q.src }; });
      const entryVal = legs.reduce((a, l) => a + l.side * l.fill, 0);
      let fee = 0; legs.forEach(l => { fee += orderFee(l.kind, l.side, l.fill, lot * lots); });
      const spot = S.und[und].price;
      const seg = legs[0].kind === 'FUT' ? 'FUT' : 'OPT';
      let margin, riskUnit;   // riskUnit = planned loss per unit (for R)
      if (seg === 'FUT') { margin = cfg.futMarginPct * spot * lot * lots; riskUnit = extra.stopDist; }
      else if (strat === 'iron_condor') { riskUnit = extra.width + entryVal * 1; /* entryVal<0 for credit => width-credit */ margin = Math.max(riskUnit, 0) * lot * lots * 1.05; }
      else { riskUnit = entryVal > 0 ? entryVal * extra.slFrac : extra.stopDist; margin = Math.max(entryVal, 0) * lot * lots; }
      const eq = equity();
      if (marginUsed() + margin > cfg.maxMarginPct * eq) return { ok: false, why: 'margin ' + usd(margin) + ' would exceed ' + Math.round(cfg.maxMarginPct * 100) + '% of equity' };
      if (riskUnit * lot * lots > cfg.maxLossPerTradePct * eq * (extra.riskScale || 1) * 2.5) return { ok: false, why: 'planned loss ' + usd(riskUnit * lot * lots) + ' too large for account' };
      const p = { id: S.nextId++, und, strat, seg, legs, lots, lot, entryVal, entryFee: fee, margin, openTs: Date.now(), openCandle: S.candleIdx, openDate: S.date, ctx, riskUnit,
        stopVal: extra.stopVal, tpVal: extra.tpVal, stopSpot: extra.stopSpot, dir: extra.dir || 0, spot0: spot, label: label(und, legs, strat) };
      S.fees += fee; S.positions.push(p);
      log('Executor', 'trade', 'OPEN ' + p.label + ' × ' + lots + ' lot' + (lots > 1 ? 's' : '') + ' (' + strat + ') · ' + (entryVal >= 0 ? 'debit ' : 'credit ') + Math.abs(entryVal).toFixed(2) + '/unit · margin ' + usd(margin) + ' · fees ' + usd(fee) + ' · prices ' + legs[0].src);
      return { ok: true, p };
    }
    function close(p, reason, settleSpot) {
      let fee = 0, v;
      if (settleSpot !== undefined) {   // expiry settlement at intrinsic
        v = p.legs.reduce((a, l) => a + l.side * intrinsic(l.kind, settleSpot, l.K), 0);
        p.legs.forEach(l => { fee += settleFee(l.kind, settleSpot, l.K, l.side, p.lot * p.lots); l.out = intrinsic(l.kind, settleSpot, l.K); l.how = 'expiry settlement'; });
      } else {
        v = 0; p.legs.forEach(l => { const px = legExitPx(l, p.und); v += l.side * px; l.out = px; l.how = 'closed'; fee += orderFee(l.kind, -l.side, px, p.lot * p.lots); });
      }
      const gross = (v - p.entryVal) * p.lot * p.lots, net = gross - fee - p.entryFee;
      S.realized += gross; S.fees += fee; S.positions = S.positions.filter(x => x !== p);
      const r = p.riskUnit > 0 ? net / (p.riskUnit * p.lot * p.lots) : 0;
      S.trades.push({ id: p.id, symbol: p.label, und: p.und, segment: p.seg, strategy: p.strat, entry: Math.abs(p.entryVal), exit: Math.abs(v), side: p.entryVal >= 0 ? 'debit' : 'credit', structure: p.entryVal >= 0 ? 'debit' : 'credit',
        dir: p.dir > 0 ? 'LONG' : p.dir < 0 ? 'SHORT' : 'NEUTRAL', lotSize: p.lot, spot0: p.spot0, spotExit: settleSpot !== undefined ? settleSpot : S.und[p.und].price,
        legs: p.legs.map(l => ({ act: l.side > 0 ? 'BUY' : 'SELL', exitAct: l.side > 0 ? 'SELL' : 'BUY', kind: l.kind, K: l.K, exp: l.exp, inPx: l.fill, outPx: l.out, how: l.how })), lots: p.lots, qty: p.lots,
        pnl: net, pnlPct: p.margin > 0 ? net / p.margin : 0, r, fees: fee + p.entryFee, held: S.candleIdx - p.openCandle, reason, openTs: p.openTs, closeTs: Date.now(), openCandle: p.openCandle, closeCandle: S.candleIdx, openDate: p.openDate, closeDate: S.date });
      if (S.trades.length > 1500) S.trades.shift();
      S.cooldown[p.und + '|' + p.strat] = S.candleIdx + 1;
      learn(p.ctx, r);
      log('Executor', 'trade', 'CLOSE ' + p.label + ' · ' + reason + ' · net ' + usd(net) + ' (' + (r >= 0 ? '+' : '') + r.toFixed(2) + 'R)');
      if (net < 0 && !quiet) agent('Risk', 'closed ' + p.label + ' at a loss');
    }

    /* ----- learner ----- */
    function arm(key) { return S.arms[key] || (S.arms[key] = { key, n: 0, mean: 0, m2: 0.25, mode: 'explore', real: 0, shadow: 0, lastTry: -999 }); }
    const lcb = a => a.mean - Math.sqrt(Math.max(a.m2 - a.mean * a.mean, 0.01) / Math.max(1, Math.min(a.n, 1 / cfg.armAlpha)));
    function learn(ctx, r) {
      if (!ctx) return;
      const a = arm(ctx.key), al = Math.max(1 / (a.n + 1), cfg.armAlpha), before = a.mode;
      a.mean += al * (r - a.mean); a.m2 += al * (r * r - a.m2); a.n++; a.real++; S.observed++;
      const l = lcb(a);
      if (a.n < cfg.exploreTrials) a.mode = 'explore';
      else if (a.mode === 'explore' || a.mode === 'shadow') a.mode = (a.mean >= cfg.armOn.mean && l >= cfg.armOn.lcb) ? 'active' : 'shadow';
      else if (a.mode === 'active' && (a.mean < cfg.armOff.mean || l < cfg.armOff.lcb)) a.mode = 'shadow';
      if (a.mode !== before) log('Learner', a.mode === 'active' ? 'learn' : 'warn', 'Arm ' + ctx.key + ' → ' + a.mode.toUpperCase() + ' (mean ' + a.mean.toFixed(2) + 'R, LCB ' + l.toFixed(2) + 'R, n=' + a.n + ')');
    }
    function armGate(key) {   // returns { take, scale, why }
      if (!cfg.adaptive) return { take: true, scale: 1 };
      const a = arm(key);
      if (a.mode === 'active') return { take: true, scale: 1 };
      if (a.mode === 'explore') return { take: true, scale: 0.5 };
      if (S.candleIdx - a.lastTry >= cfg.probationEvery) { a.lastTry = S.candleIdx; return { take: true, scale: 0.5, probation: true }; }
      return { take: false, why: 'arm ' + key + ' in shadow (mean ' + a.mean.toFixed(2) + 'R, n=' + a.n + ')' };
    }

    /* ----- labels ----- */
    function label(und, legs, strat) {
      const e = legs[0].exp.slice(5), ks = legs.map(l => l.K + (l.kind === 'FUT' ? '' : l.kind)).join('/');
      return legs[0].kind === 'FUT' ? und + ' FUT ' + e : und + ' ' + ks + ' ' + e;
    }

    /* ----- signals (evaluated once per day at the close) ----- */
    const vixPct = () => { const h = S.vixHist; if (h.length < 60) return 0.5; const v = S.vix; return h.filter(x => x <= v).length / h.length; };
    function analysis(und) { const u = S.und[und]; if (u.candles.length < 30) return null; return PB.analyze({ emaFast: 9, emaSlow: 21, rsiLen: 14, atrLen: 14, bbLen: 20, bbMult: 2, donchianIn: 20, donchianOut: 10 }, u.candles); }
    const roundK = (und, x) => Math.round(x / UND[und].step) * UND[und].step;

    function exitsFor(p, a, spot) {
      const dtem = Math.min.apply(null, p.legs.map(l => dte(S.date, l.exp)));
      if (dtem <= 0) return ['expiry', true];
      if (dtem <= cfg.closeDte && p.seg === 'OPT') return ['close before expiry (DTE ' + dtem + ')', false];
      if (p.seg === 'FUT' && dtem <= 1) return ['roll: contract expiring', false];
      const v = posValue(p);
      if (p.strat === 'iron_condor') { const c = -v; if (c >= p.stopVal) return ['stop: cost-to-close ' + c.toFixed(1) + ' ≥ ' + p.stopVal.toFixed(1), false]; if (c <= p.tpVal) return ['take profit (50% of credit)', false]; return null; }
      if (p.seg === 'OPT') { if (v <= p.stopVal) return ['stop loss', false]; if (v >= p.tpVal) return ['take profit', false]; }
      if (a) {
        if (p.dir > 0 && a.vote < 0.3) return ['trend vote flipped (' + a.vote.toFixed(2) + ')', false];
        if (p.dir < 0 && a.vote > 0.45) return ['trend vote flipped (' + a.vote.toFixed(2) + ')', false];
      }
      if (p.seg === 'FUT') { if (p.dir > 0 && spot <= p.stopSpot) return ['stop (' + cfg.futStopAtr + '×ATR)', false]; if (p.dir < 0 && spot >= p.stopSpot) return ['stop (' + cfg.futStopAtr + '×ATR)', false]; }
      return null;
    }
    function markStops() {   // intraday stop checks on every tick (not only at the close)
      S.positions.slice().forEach(p => {
        const spot = S.und[p.und].price;
        if (p.seg === 'FUT') { if ((p.dir > 0 && spot <= p.stopSpot) || (p.dir < 0 && spot >= p.stopSpot)) close(p, 'stop (' + cfg.futStopAtr + '×ATR)'); return; }
        const v = posValue(p);
        if (p.strat === 'iron_condor') { const c = -v; if (c >= p.stopVal) close(p, 'stop: cost-to-close ' + c.toFixed(1)); else if (c <= p.tpVal) close(p, 'take profit (50% of credit)'); }
        else if (v <= p.stopVal) close(p, 'stop loss'); else if (v >= p.tpVal) close(p, 'take profit');
      });
    }

    function evaluate() {
      const eq = equity();
      if (S.halted) return;
      const dd = (S.peak - eq) / S.peak;
      if (dd > cfg.haltDrawdown) { S.halted = { reason: 'drawdown ' + (dd * 100).toFixed(1) + '% > ' + cfg.haltDrawdown * 100 + '%' }; S.positions.slice().forEach(p => close(p, 'kill switch')); log('Risk', 'crit', 'KILL SWITCH: ' + S.halted.reason); return; }
      const scale = Math.max(0.25, 1 - 0.75 * dd / cfg.haltDrawdown);
      const vp = vixPct();
      cfg.underlyings.forEach(und => {
        const u = S.und[und], a = u.analysis; if (!a || !u.price) return;
        const spot = u.price, atr = a.atr, trend = a.trend, regime = trend;   // UP / DOWN / FLAT
        const exps = S.und[und].expList || expiries(und, S.date), dir = a.vote >= 0.55 ? 1 : a.vote <= 0.15 ? -1 : 0;
        // ---- exits (daily-close rules) ----
        S.positions.filter(p => p.und === und).forEach(p => { const x = exitsFor(p, a, spot); if (x) close(p, x[0], x[1] ? spot : undefined); });
        const has = s => S.positions.some(p => p.und === und && p.strat === s) || (S.cooldown[und + '|' + s] || 0) > S.candleIdx;
        const tryOpen = (strat, build) => {
          if (!cfg.enabled.includes(strat) || has(strat)) return;
          if (S.positions.length >= cfg.maxPositions) return;
          const key = strat + '|' + regime, g = armGate(key);
          if (!g.take) { log('Learner', 'warn', 'SKIP ' + und + ' ' + strat + ': ' + g.why); return; }
          const b = build(); if (!b) return;
          const lots = Math.max(1, Math.floor((b.lots || 1) * (g.scale >= 1 ? 1 : 1) * 1));
          const r = open(und, strat, b.legs, lots, { key, strat, regime }, Object.assign({ riskScale: scale * g.scale }, b.extra));
          if (!r.ok) log('Risk', 'warn', 'REJECTED ' + und + ' ' + strat + ': ' + r.why);
        };
        agent('Strategy', und + ' vote ' + a.vote.toFixed(2) + ' · VIX ' + S.vix.toFixed(1) + ' (pct ' + Math.round(vp * 100) + ')');
        // ---- futures trend (long/short) ----
        if (dir !== 0 && (dir > 0 || cfg.futShorts)) tryOpen('fut_trend', () => {
          const mon = exps.filter(e => e >= S.date).find(e => dte(S.date, e) >= 6 && (e === monthlyExp(und, S.date) || dte(S.date, e) >= 20)) || monthlyExp(und, S.date), exp = mon;   // nearest liquid monthly with at least 6 days left
          const sd = cfg.futStopAtr * atr;
          return { legs: [{ kind: 'FUT', K: 0, exp, side: dir }], extra: { stopDist: sd, stopSpot: spot - dir * sd, dir } };
        });
        // ---- directional options ----
        const monthly = pickExpiry(exps, S.date, 25, 50) || monthlyExp(und, S.date);
        const atm = roundK(und, spot);
        if (dir > 0) {
          tryOpen('long_call', () => ({ legs: [{ kind: 'CE', K: atm, exp: monthly, side: 1 }], extra: { slFrac: 0.4, dir: 1 }, ...stops(und, 'CE', atm, monthly, 0.4, 0.8) }));
          tryOpen('bull_call_spread', () => { const w = roundK(und, spot * 0.03), K2 = atm + w; return spread(und, 'CE', atm, K2, monthly, 1, w); });
        } else if (dir < 0) {
          tryOpen('long_put', () => ({ legs: [{ kind: 'PE', K: atm, exp: monthly, side: 1 }], extra: { slFrac: 0.4, dir: -1 }, ...stops(und, 'PE', atm, monthly, 0.4, 0.8) }));
          tryOpen('bear_put_spread', () => { const w = roundK(und, spot * 0.03), K2 = atm - w; return spread(und, 'PE', atm, K2, monthly, -1, w); });
        }
        // ---- premium selling (defined risk): iron condor in rich-vol, non-trending conditions ----
        if (Math.abs(a.vote - 0.5) < 0.3 && vp >= cfg.condorMinVixPct) tryOpen('iron_condor', () => {
          const exp = pickExpiry(exps, S.date, cfg.condorDteMin, cfg.condorDteMax); if (!exp) return null;
          const T = dte(S.date, exp) / 365, sig = (S.vix / 100) * UND[und].vixMult * Math.sqrt(T), f = futPrice(spot, T);
          const sc = roundK(und, f * Math.exp(1.0 * sig)), sp = roundK(und, f * Math.exp(-1.0 * sig)), w = Math.max(UND[und].step * 2, roundK(und, spot * 0.025));
          const legs = [{ kind: 'PE', K: sp - w, exp, side: 1 }, { kind: 'PE', K: sp, exp, side: -1 }, { kind: 'CE', K: sc, exp, side: -1 }, { kind: 'CE', K: sc + w, exp, side: 1 }];
          const qs = legs.map(l => quote(und, l.kind, l.K, exp)), credit = -(qs[0].ask - qs[1].bid - qs[2].bid + qs[3].ask);
          if (credit < 0.12 * w) return null;   // not enough credit for the risk
          return { legs, extra: { width: w, stopVal: credit * 2, tpVal: credit * 0.5 } };   // value space: cost-to-close (positive); entryVal is -credit
        });
      });
    }
    function stops(und, kind, K, exp, slFrac, tpFrac) { const q = quote(und, kind, K, exp), px = q.ask; return { extra: { slFrac, stopVal: px * (1 - slFrac), tpVal: px * (1 + tpFrac), dir: kind === 'CE' ? 1 : -1 } }; }
    function spread(und, kind, K1, K2, exp, dir, w) {
      const a = quote(und, kind, K1, exp), b = quote(und, kind, K2, exp), debit = a.ask - b.bid;
      if (debit <= 0 || debit > 0.7 * w) return null;
      return { legs: [{ kind, K: K1, exp, side: 1 }, { kind, K: K2, exp, side: -1 }], extra: { slFrac: 0.5, stopVal: debit * 0.5, tpVal: debit + 0.6 * (w - debit), dir } };
    }

    /* ----- main step: caller supplies a market snapshot -----
       mk = { date:'YYYY-MM-DD', spot:{NIFTY:..}, vix, chain?:{NIFTY:{expiries:[..], rows:{exp:{K:{ce:{ltp,bid,ask,iv,oi},pe:{..}}}}}}, newDay:bool (true = run the daily-close evaluation), prevOHLC?:{} } */
    function step(mk) {
      S.tick++;
      if (mk.date && mk.date !== S.date) { S.date = mk.date; }
      S.vix = mk.vix || S.vix; agent('Data', 'spot ' + cfg.underlyings.map(u => u + ' ' + (mk.spot[u] || 0).toFixed(0)).join(' · ') + ' · VIX ' + S.vix.toFixed(2));
      cfg.underlyings.forEach(u => {
        const x = S.und[u], px = mk.spot[u]; if (!px) return;
        if (!x.start) x.start = px; x.price = px;
        x.cur = x.cur && x.cur.n ? { o: x.cur.o, h: Math.max(x.cur.h, px), l: Math.min(x.cur.l, px), c: px, n: x.cur.n + 1 } : { o: px, h: px, l: px, c: px, n: 1 };
        x.chain = mk.chain && mk.chain[u] ? mk.chain[u].rows : null; x.expList = mk.chain && mk.chain[u] ? mk.chain[u].expiries : null;
        if (!x.analysis && x.candles.length >= 30) x.analysis = analysis(u);
      });
      S.quoteSrc = cfg.underlyings.some(u => S.und[u].chain) ? 'chain' : 'modeled';
      S.feed.note = (mk.note ? mk.note + ' · ' : '') + 'option prices: ' + (S.quoteSrc === 'chain' ? 'LIVE option chain (broker feed)' : 'MODELED (Black-Scholes from live spot + India VIX)');
      S.feed.mode = S.quoteSrc === 'chain' ? 'live' : 'modeled';
      // expiry settlement happens at the close of expiry day
      if (mk.newDay) {
        agent('Analyst', 'daily close · evaluating signals');
        S.positions.slice().forEach(p => { if (Math.min.apply(null, p.legs.map(l => dte(S.date, l.exp))) <= 0) close(p, 'expiry settlement', S.und[p.und].price); });
        S.candleIdx++;
        if (cfg.cashYieldPa) { const y = Math.max(0, cfg.startBalance + S.realized - S.fees) * cfg.cashYieldPa / 252; S.realized += y; S.interest = (S.interest || 0) + y; }
        cfg.underlyings.forEach(u => { const x = S.und[u]; if (x.cur && x.cur.n) { x.candles.push({ o: x.cur.o, h: x.cur.h, l: x.cur.l, c: x.price }); if (x.candles.length > 500) x.candles.shift(); } x.cur = null; x.analysis = analysis(u); });
        S.vixHist.push(S.vix); if (S.vixHist.length > 300) S.vixHist.shift();
        evaluate();
        S.lastScan = 'daily close ' + S.date + ' · ' + cfg.underlyings.map(u => u + ' vote ' + (S.und[u].analysis ? S.und[u].analysis.vote.toFixed(2) : '–')).join(' · ');
      } else markStops();
      const eq = equity(); S.peak = Math.max(S.peak, eq); S.maxDD = Math.max(S.maxDD, (S.peak - eq) / S.peak);
      if (!S.equity.length || S.tick % 2 === 0 || mk.newDay) { S.equity.push({ t: S.tick, eq }); if (S.equity.length > cfg.maxEquityPts) S.equity.splice(1, 1); }
      Object.keys(S.agents).forEach(n => { if (S.tick - S.agents[n].tick > 2) S.agents[n].status = 'idle'; });
    }

    /* ----- reporting (dashboard-compatible shape) ----- */
    function metrics() {
      const t = S.trades, wins = t.filter(x => x.pnl > 0), losses = t.filter(x => x.pnl <= 0), gw = wins.reduce((a, x) => a + x.pnl, 0), gl = -losses.reduce((a, x) => a + x.pnl, 0), un = unrealized(), eq = equity();
      const realizedNet = t.reduce((a, x) => a + x.pnl, 0);
      return { equity: eq, cash: eq - marginUsed(), positionsValue: marginUsed(), realized: realizedNet + (S.interest || 0), unrealized: un, totalPnl: eq - cfg.startBalance, totalPnlPct: (eq - cfg.startBalance) / cfg.startBalance,
        trades: t.length, wins: wins.length, losses: losses.length, winRate: t.length ? wins.length / t.length : 0, profitFactor: gl > 0 ? gw / gl : (gw > 0 ? 99 : 0),
        avgWin: wins.length ? gw / wins.length : 0, avgLoss: losses.length ? gl / losses.length : 0, expectancy: t.length ? realizedNet / t.length : 0,
        best: t.length ? Math.max.apply(null, t.map(x => x.pnl)) : 0, worst: t.length ? Math.min.apply(null, t.map(x => x.pnl)) : 0, interest: S.interest || 0, fees: S.fees, maxDD: S.maxDD, peak: S.peak, exposure: eq > 0 ? marginUsed() / eq : 0 };
    }
    function segmentStats() {   // by segment and by strategy
      const out = { segment: {}, strategy: {} };
      const add = (o, k, t) => { const s = o[k] || (o[k] = { trades: 0, wins: 0, pnl: 0, gw: 0, gl: 0, r: 0, fees: 0 }); s.trades++; s.pnl += t.pnl; s.r += t.r; s.fees += t.fees; if (t.pnl > 0) { s.wins++; s.gw += t.pnl; } else s.gl -= t.pnl; };
      S.trades.forEach(t => { add(out.segment, t.segment, t); add(out.strategy, t.segment + '|' + t.strategy, t); });
      return out;
    }
    function learning() {
      const arms = Object.keys(S.arms).map(k => { const a = S.arms[k]; return { key: k, n: a.n, real: a.real, shadow: 0, mean: a.mean, lcb: lcb(a), mode: a.mode }; }).sort((x, y) => y.n - x.n);
      return { adaptive: cfg.adaptive, observed: S.observed, real: S.trades.length, shadowOpen: 0, arms, params: { emaFast: 9, emaSlow: 21, stopAtr: cfg.futStopAtr, tpAtr: 0 }, optimizer: { runs: 0, last: null, history: [], every: 0 },
        model: { n: 0, active: false, lossM: 0, lossB: 0, base: 0, minSamples: 0 }, ddScale: Math.max(0.25, 1 - 0.75 * ((S.peak - equity()) / S.peak) / cfg.haltDrawdown) };
    }
    function snapshot(o) {
      o = o || {};
      const nC = o.candles || 110, symbols = {};
      cfg.underlyings.forEach(u => { const x = S.und[u]; symbols[u] = { id: u, price: x.price, start: x.start || x.price, candles: x.candles.slice(-nC), cur: x.cur || { n: 0 }, analysis: x.analysis }; });
      const eqPts = S.equity, stride = Math.max(1, Math.ceil(eqPts.length / 400)), eqOut = eqPts.filter((q, i) => i % stride === 0 || i === eqPts.length - 1);
      return { v: 3, kind: 'fno', currency: cfg.currency, ts: Date.now(), startedAt: S.startedAt, tick: S.tick, candleIdx: S.candleIdx, warmup: 0, feed: S.feed, halted: S.halted, pausedUntil: 0, startBalance: cfg.startBalance,
        metrics: metrics(), learning: learning(), equity: eqOut, segStats: segmentStats(),
        positions: S.positions.map(p => { const v = posValue(p), pnl = posPnl(p, v), credit = p.entryVal < 0;
          return { id: p.id, symbol: p.label, segment: p.seg, strategy: p.strat, qty: p.lots, lots: p.lots, lotSize: p.lot, entry: Math.abs(p.entryVal), price: Math.abs(v), stop: p.seg === 'FUT' ? Math.abs(p.entryVal) - p.dir * Math.abs(p.spot0 - p.stopSpot) : p.stopVal, tp: p.seg === 'FUT' ? Math.abs(p.entryVal) + p.dir * 2 * Math.abs(p.spot0 - p.stopSpot) : p.tpVal,
            pnl, pnlPct: p.margin > 0 ? pnl / p.margin : 0, held: S.candleIdx - p.openCandle, openTs: p.openTs, margin: p.margin, structure: credit ? 'credit' : 'debit', dir: p.dir,
            legs: p.legs.map(l => (l.side > 0 ? 'BUY ' : 'SELL ') + (l.kind === 'FUT' ? 'FUT' : l.K + l.kind) + ' ' + l.exp.slice(5)).join(' · '), und: p.und }; }),
        trades: S.trades.slice(-(o.trades || 80)).reverse(), log: S.log.slice(-(o.logs || 150)).reverse(),
        agents: S.agents, symbols, params: { emaFast: 9, emaSlow: 21 }, lastScan: S.lastScan,
        risk: { riskPerTrade: cfg.maxLossPerTradePct, maxPositionPct: cfg.maxMarginPct, maxPositions: cfg.maxPositions, haltDrawdown: cfg.haltDrawdown, feeRate: 0.0005, slippage: cfg.slippageFut },
        fno: { lots: Object.keys(UND).reduce((o2, k) => (o2[k] = UND[k].lot, o2), {}), vix: S.vix, vixPct: vixPct(), marginUsed: marginUsed(), freeMargin: equity() - marginUsed(), quoteSrc: S.quoteSrc, enabled: cfg.enabled } };
    }
    function closeAll(reason) { const n = S.positions.length; S.positions.slice().forEach(p => close(p, reason || 'manual')); return n; }
    if (!quiet) log('Supervisor', 'info', 'F&O bot online · paper account ' + usd(cfg.startBalance) + ' · ' + cfg.underlyings.join(', ') + ' · strategies: ' + cfg.enabled.join(', ') + ' · learning ' + (cfg.adaptive ? 'ON' : 'OFF'));
    cfg.underlyings.forEach(u => { if (S.und[u].candles.length >= 30) S.und[u].analysis = analysis(u); });
    return { state: S, cfg, step, snapshot, metrics, learning, segmentStats, closeAll, quote, equity, expiries, exportLearn: () => JSON.parse(JSON.stringify({ arms: S.arms })) };
  }
  function restore(state) { return create({ state }); }
  return { create, restore, UND, DEFAULTS, STRAT_LABEL, bs, expiries, lastTuesday, futPrice, ivModel };
});
