/* PaperBot v2 — adaptive multi-agent paper-trading engine (no DOM; browser or Node).
 *
 * Agents (shared activity feed):
 *   Supervisor  orchestrates one pipeline pass per closed candle
 *   Data        market feed: SIMULATED, or live prices injected via step(1, {prices, newCandle})
 *   Analyst     indicator skills (EMA, RSI, ATR, Bollinger, Donchian) + regime (trend state)
 *   Strategy    skills: trend (EMA cross), breakout (Donchian), mean-reversion (Bollinger+RSI)
 *   Learner     continuous learning (see below)
 *   Risk        ATR sizing, exposure caps, cost-edge check, loss-streak pause, drawdown scaling, kill switch
 *   Executor    paper broker: fees, slippage, stop / target / trailing stop
 *   Reporter    PnL, drawdown, win-rate, profit factor
 *
 * Learner (what "adaptive" means here — deliberately conservative):
 *   1. Every signal becomes a trade: real, or a *shadow* (virtual) trade with identical rules and costs.
 *      So every strategy x regime "arm" keeps accumulating evidence even while switched off.
 *   2. Arms (strategy | trend-state) are scored on net R-multiples with an exponentially-decayed mean
 *      and a lower confidence bound. New arms explore at half size; proven arms get real size;
 *      arms that stop working drop to shadow-only and can earn their way back (hysteresis).
 *   3. An online logistic meta-model predicts P(trade wins net of costs) from context features.
 *      It is evaluated prequentially (predict first, then learn) and only allowed to veto trades
 *      once it beats the base-rate baseline on log-loss.
 *   4. Walk-forward tuner: periodically back-tests a small parameter grid on recent candles,
 *      requires train AND hold-out improvement with a margin, and logs every decision.
 *   5. Risk scale shrinks as drawdown deepens; kill switch halts entries.
 *
 * No part of this guarantees profit. On a driftless random walk the correct learned behaviour is
 * "trade rarely / not at all".  Long-only spot, fractional quantity, USD, $20 start.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PaperBot = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* strategy library (from research/factory.js) — optional; needs signals.js (Node require or global PaperSignals) */
  let SIG = null, LIBRARY = null; const LIBMEMO = new Map();
  try { SIG = (typeof PaperSignals !== 'undefined') ? PaperSignals : (typeof require === 'function' ? require('./signals.js') : null); } catch (e) { SIG = null; }
  function setLibrary(specs) { LIBMEMO.clear(); LIBRARY = (specs && specs.length) ? specs : null; }

  const DEFAULTS = {
    startBalance: 20,
    sizePct: 0,               // overrides per-strategy fixed sizing (fraction of equity per position)
    cashYieldPa: 0,           // annual yield on idle cash, applied once per replayed bar
    currency: '$',
    integerQty: false,        // true for Indian cash-market units (no fractional shares)
    feeRate: 0.001,           // 0.10% per side
    slippage: 0.0005,         // 0.05% per side
    ticksPerCandle: 5,
    warmupCandles: 160,
    maxCandles: 600,
    emaFast: 9, emaSlow: 21, rsiLen: 14, atrLen: 14, bbLen: 20, bbMult: 2,
    donchianIn: 20, donchianOut: 10,
    minConfidence: 0.5,
    riskPerTrade: 0.02,
    maxPositionPct: 0.45,
    maxPositions: 2,
    minNotional: 1,
    stopAtr: 2, tpAtr: 3, trailAtr: 1.5,
    minEdgeMult: 3,
    cooldownCandles: 6,
    maxConsecLosses: 3, lossPauseCandles: 20,
    haltDrawdown: 0.20,
    scanEvery: 3, reportEvery: 12,
    maxLogs: 400, maxEquityPts: 1500,
    // ---- learning ----
    adaptive: true,
    enabled: ['trend', 'breakout', 'meanrev'],   // crypto-sim default; India presets enable core + donchian55
    exploreTrials: 8, exploreScale: 0.5,
    armAlpha: 0.08,
    armOn: { mean: 0.03, lcb: -0.15 },
    armOff: { mean: -0.02, lcb: -0.25 },
    minEV: 0.05,
    modelMinSamples: 40, modelLR: 0.05, modelL2: 0.002,
    optEvery: 120, optMinCandles: 300, optWindow: 450, optMargin: 0.05,
    optMinTrain: 15, optMinHold: 8,
    vMaxHold: 80, maxVTrades: 300,
    symbols: [
      { id: 'BTC-SIM', price: 67000, vol: 0.0020 },
      { id: 'ETH-SIM', price: 3400, vol: 0.0026 },
      { id: 'SOL-SIM', price: 165, vol: 0.0034 }
    ]
  };
  /* India preset: NSE ETFs (whole units), INR, ~0.20% round-trip costs (approx: brokerage+STT+GST+stamp+slippage — verify with your broker),
   * daily bars, core index-trend strategy. Evidence: see knowledge base; active strategies had no reliable edge on real data. */
  const PRESETS = {
    india: {
      currency: '\u20B9', integerQty: true, startBalance: 10000, feeRate: 0.0005, slippage: 0.0005,
      enabled: ['trendvote'], sizePct: 0.16, adaptive: true, maxPositions: 6, maxPositionPct: 0.2, cooldownCandles: 3, maxConsecLosses: 999, haltDrawdown: 0.30,
      symbols: ['NIFTYBEES', 'JUNIORBEES', 'BANKBEES', 'ITBEES', 'PSUBNKBEES', 'GOLDBEES'].map(id => ({ id, price: 1, vol: 0.01 }))
    }
  };
  /* Indices preset: practise across ~24 NSE equity indices (broad, sector, thematic). Index funds/ETFs assumed investable (fractional ok). */
  PRESETS.indices = {
    currency: '\u20B9', integerQty: false, startBalance: 100000, feeRate: 0.0005, slippage: 0.0005, cashYieldPa: 0.05,
    enabled: ['trendvote'], adaptive: true, sizePct: 0.05, maxPositions: 24, maxPositionPct: 0.1,
    cooldownCandles: 3, maxConsecLosses: 999, haltDrawdown: 0.30, maxCandles: 600
  };
  const AGENTS = ['Supervisor', 'Data', 'Analyst', 'Strategy', 'Learner', 'Risk', 'Executor', 'Reporter'];
  const GRID = { stopAtr: [1.5, 2, 2.5], tpAtr: [2, 3, 4], ema: [[9, 21], [12, 26], [5, 13]] };

  /* ---------- helpers ---------- */
  function rand(S) {
    S.rng = (S.rng + 0x6D2B79F5) >>> 0;
    let t = S.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function randn(S) {
    let u = 0;
    while (u === 0) u = rand(S);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand(S));
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sigmoid = z => 1 / (1 + Math.exp(-z));
  function fmtP(p) { return p >= 1000 ? p.toFixed(1) : p >= 100 ? p.toFixed(2) : p >= 1 ? p.toFixed(3) : p.toFixed(5); }
  let CUR = '$';
  const usd = (x) => (x < 0 ? '-' : '') + CUR + Math.abs(x).toFixed(2);
  const sgn = (x, d) => (x >= 0 ? '+' : '') + x.toFixed(d == null ? 2 : d);

  /* ---------- indicator skills ---------- */
  function emaSeries(vals, n) {
    const k = 2 / (n + 1);
    let e = vals[0];
    const out = [e];
    for (let i = 1; i < vals.length; i++) { e = vals[i] * k + e * (1 - k); out.push(e); }
    return out;
  }
  function rsiLast(closes, n) {
    if (closes.length <= n) return 50;
    let g = 0, l = 0;
    for (let i = 1; i <= n; i++) { const d = closes[i] - closes[i - 1]; if (d >= 0) g += d; else l -= d; }
    g /= n; l /= n;
    for (let i = n + 1; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      g = (g * (n - 1) + Math.max(d, 0)) / n;
      l = (l * (n - 1) + Math.max(-d, 0)) / n;
    }
    return l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  function atrLast(c, n) {
    if (c.length <= n) return null;
    const tr = [];
    for (let i = 1; i < c.length; i++) {
      tr.push(Math.max(c[i].h - c[i].l, Math.abs(c[i].h - c[i - 1].c), Math.abs(c[i].l - c[i - 1].c)));
    }
    let a = 0;
    for (let i = 0; i < n; i++) a += tr[i];
    a /= n;
    for (let i = n; i < tr.length; i++) a = (a * (n - 1) + tr[i]) / n;
    return a;
  }
  function analyze(P, candles, wantLib) {
    const closes = candles.map(c => c.c);
    const ef = emaSeries(closes, P.emaFast), es = emaSeries(closes, P.emaSlow);
    const n = closes.length, price = closes[n - 1];
    const win = closes.slice(-P.bbLen);
    const mean = win.reduce((a, b) => a + b, 0) / win.length;
    const sd = Math.sqrt(win.reduce((a, b) => a + (b - mean) * (b - mean), 0) / win.length);
    const bbU = mean + P.bbMult * sd, bbL = mean - P.bbMult * sd;
    const prevIn = candles.slice(-(P.donchianIn + 1), -1);
    const prevOut = candles.slice(-(P.donchianOut + 1), -1);
    const prev55 = candles.slice(-56, -1), prev20 = candles.slice(-21, -1);
    const gap = (ef[n - 1] - es[n - 1]) / es[n - 1];
    const atr = atrLast(candles, P.atrLen);
    // trend-vote ensemble: share of 14 classic trend signals that are ON (SMA trend 50-250, EMA/SMA crosses, momentum 63/126/252)
    let vote = null;
    if (n >= 260) {
      const smaN = L2 => { let t = 0; for (let k = n - L2; k < n; k++) t += closes[k]; return t / L2; };
      const emaN = L2 => emaSeries(closes, L2)[n - 1];
      const s10 = smaN(10), s30 = smaN(30), s50 = smaN(50), s100 = smaN(100), s150 = smaN(150), s200 = smaN(200), s250 = smaN(250);
      const sig = [price > s50, price > s100, price > s150, price > s200, price > s250,
        emaN(5) > emaN(20), emaN(9) > emaN(21), emaN(12) > emaN(26), emaN(20) > emaN(50), s10 > s30, s50 > s100,
        price > closes[n - 64], price > closes[n - 127], price > closes[n - 253]];
      vote = sig.reduce((a, b) => a + (b ? 1 : 0), 0) / sig.length;
    }
    let lib = null;
    if (wantLib && LIBRARY && SIG && n >= 260) {
      const ck = n + '|' + price + '|' + candles[n - 2].c + '|' + candles[0].c;
      if (LIBMEMO.has(ck)) lib = LIBMEMO.get(ck);
      else { const r = SIG.libVote(candles, LIBRARY, 420); lib = r ? r.vote : null; if (LIBMEMO.size > 60000) LIBMEMO.clear(); LIBMEMO.set(ck, lib); }
    }
    const L = P.longLen || 200;
    const smaAt = k => { const w = closes.slice(n - L - k, n - k); return w.length === L ? w.reduce((a, b) => a + b, 0) / L : null; };
    const smaL = smaAt(0), smaLp = smaAt(20);
    return {
      smaL, smaLp, vote, lib,
      hh55: prev55.length === 55 ? Math.max.apply(null, prev55.map(c => c.h)) : null,
      ll20: prev20.length === 20 ? Math.min.apply(null, prev20.map(c => c.l)) : null,
      price, emaF: ef[n - 1], emaS: es[n - 1], emaFp: ef[n - 2], emaSp: es[n - 2],
      rsi: rsiLast(closes, P.rsiLen), atr, atrPct: atr ? atr / price : 0,
      bbU, bbM: mean, bbL, pctB: bbU === bbL ? 0.5 : (price - bbL) / (bbU - bbL),
      hh: Math.max.apply(null, prevIn.map(c => c.h)),
      ll: Math.min.apply(null, prevOut.map(c => c.l)),
      gap, trend: gap > 0.001 ? 'UP' : gap < -0.001 ? 'DOWN' : 'FLAT'
    };
  }

  /* ---------- strategy skills ---------- */
  const STRATEGIES = {
    trend: {
      id: 'trend', name: 'Trend (EMA cross)',
      entry(a) {
        if (a.emaFp <= a.emaSp && a.emaF > a.emaS && a.rsi >= 45 && a.rsi <= 72 && a.price > a.emaS)
          return { conf: clamp(0.5 + (a.rsi - 50) / 100, 0.4, 0.8), reason: 'EMA fast crossed above slow, RSI ' + a.rsi.toFixed(0) };
        return null;
      },
      exit(a) { return (a.emaF < a.emaS && a.emaFp >= a.emaSp) ? 'Trend reversal (fast EMA < slow EMA)' : null; }
    },
    breakout: {
      id: 'breakout', name: 'Breakout (20-candle high)',
      entry(a) {
        if (a.price > a.hh && a.emaF > a.emaS && a.rsi < 78)
          return { conf: clamp(0.55 + (a.rsi - 55) / 200, 0.45, 0.75), reason: 'Closed above 20-candle high, uptrend intact' };
        return null;
      },
      exit(a) { return a.price < a.ll ? 'Broke 10-candle low' : null; }
    },
    trendhold: {
      id: 'trendhold', name: 'Trend hold (200-bar filter)',
      plan: { stopAtr: 3.5, tpAtr: 60, trailAtr: 3.5 },
      entry(a) {
        if (a.smaL && a.smaLp && a.price > a.smaL && a.smaL > a.smaLp && a.emaF > a.emaS)
          return { conf: 0.6, reason: 'Price above rising 200-bar average, EMAs aligned' };
        return null;
      },
      exit(a) { return (a.smaL && a.price < a.smaL * 0.985) ? 'Closed >1.5% below 200-bar average' : null; }
    },
    trendvote: {
      id: 'trendvote', name: 'Trend-vote ensemble (14 signals)',
      plan: { stopAtr: 8, tpAtr: 200, trailAtr: 8, sizePct: 0.05, exploreScale: 1 },
      entry(a) { return (a.vote != null && a.vote >= 0.55) ? { conf: 0.6 + (a.vote - 0.55) * 0.4, reason: 'Trend vote ' + Math.round(a.vote * 14) + '/14 signals on' } : null; },
      exit(a) { return (a.vote != null && a.vote <= 0.3) ? 'Trend vote fell to ' + Math.round(a.vote * 14) + '/14' : null; }
    },
    libvote: {
      id: 'libvote', name: 'Strategy-library vote (factory-vetted)',
      plan: { stopAtr: 8, tpAtr: 200, trailAtr: 8, sizePct: 0.05, exploreScale: 1 },
      entry(a) { return (a.lib != null && a.lib >= 0.55) ? { conf: 0.6 + (a.lib - 0.55) * 0.4, reason: 'Library vote ' + Math.round(a.lib * 100) + '% of vetted strategies long' } : null; },
      exit(a) { return (a.lib != null && a.lib <= 0.3) ? 'Library vote fell to ' + Math.round(a.lib * 100) + '%' : null; }
    },
    donchian55: {
      id: 'donchian55', name: 'Donchian 55/20 breakout',
      plan: { stopAtr: 8, tpAtr: 200, trailAtr: 8, sizePct: 0.05, exploreScale: 1 },
      entry(a) { return (a.hh55 && a.price > a.hh55) ? { conf: 0.6, reason: 'Closed above 55-bar high' } : null; },
      exit(a) { return (a.ll20 && a.price < a.ll20) ? 'Closed below 20-bar low' : null; }
    },
    core: {
      id: 'core', name: 'Core index trend (200-bar filter)',
      plan: { stopAtr: 8, tpAtr: 200, trailAtr: 8, sizePct: 0.30, exploreScale: 1 },
      entry(a) { return (a.smaL && a.price > a.smaL * 1.005) ? { conf: 0.6, reason: 'Price above 200-bar average' } : null; },
      exit(a) { return (a.smaL && a.price < a.smaL * 0.995) ? 'Price closed below 200-bar average' : null; }
    },
    meanrev: {
      id: 'meanrev', name: 'Mean reversion (Bollinger + RSI)',
      entry(a) {
        if (a.price <= a.bbL && a.rsi < 32 && a.gap > -0.004)
          return { conf: clamp(0.5 + (32 - a.rsi) / 60, 0.45, 0.8), reason: 'Below lower band, RSI ' + a.rsi.toFixed(0) + ', no strong downtrend' };
        return null;
      },
      exit(a) {
        if (a.price >= a.bbM) return 'Reverted to mean (middle band)';
        if (a.rsi > 55) return 'RSI recovered above 55';
        return null;
      }
    }
  };

  /* ---------- learning helpers ---------- */
  function featureVec(a, strategy, conf) {
    return [
      1,
      (a.rsi - 50) / 50,
      clamp(a.gap * 100, -1.5, 1.5) / 1.5,
      clamp(a.atrPct * 100 - 0.6, -1, 1.5),
      a.pctB - 0.5,
      a.trend === 'UP' ? 1 : 0,
      a.trend === 'DOWN' ? 1 : 0,
      strategy === 'trend' ? 1 : 0,
      strategy === 'breakout' ? 1 : 0,
      strategy === 'meanrev' ? 1 : 0,
      conf - 0.5
    ];
  }
  const NFEAT = 11;
  function newModel() {
    const w = new Array(NFEAT).fill(0);
    w[0] = Math.log(0.4 / 0.6);
    return { w, n: 0, lossM: 0.67, lossB: 0.67, base: 0.4, active: false, avgWinR: 1.2, avgLossR: 1.0 };
  }
  function pxCost(P) { return P; }
  function rMult(P, entryFill, exitFill, stopDist) {
    return (exitFill * (1 - P.feeRate) - entryFill * (1 + P.feeRate)) / stopDist;
  }

  /* walk-forward tuner: pure functions on candle arrays */
  function precomputeAnalyses(candles, P, from) {
    const out = new Array(candles.length).fill(null);
    for (let i = from; i < candles.length; i++) out[i] = analyze(P, candles.slice(Math.max(0, i - 200), i + 1));
    return out;
  }
  function simulateR(candles, analyses, from, cfg, stopAtr, tpAtr) {
    const res = [], open = {};
    const slip = cfg.slippage;
    function close(k, px, i, reason) {
      const p = open[k]; delete open[k];
      const exitFill = px * (1 - slip);
      res.push({ r: rMult(cfg, p.entry, exitFill, p.stopDist), idx: p.idx, strat: k });
    }
    for (let i = from; i < candles.length; i++) {
      const c = candles[i], a = analyses[i];
      Object.keys(open).forEach(function (k) {
        const p = open[k];
        if (p.idx === i) return;
        if (c.l <= p.stop) { close(k, Math.min(c.o, p.stop), i); return; }
        if (c.h >= p.tp) { close(k, Math.max(c.o, p.tp), i); return; }
        if (c.h > p.high) p.high = c.h;
        if (p.high - p.entry >= p.atr0) p.stop = Math.max(p.stop, p.high - cfg.trailAtr * p.atr0);
        if (i - p.idx >= cfg.vMaxHold) close(k, c.c, i);
      });
      if (!a || !a.atr) continue;
      Object.keys(STRATEGIES).filter(k => !STRATEGIES[k].plan).forEach(function (k) {
        if (open[k]) {
          if (STRATEGIES[k].exit(a)) close(k, c.c, i);
          return;
        }
        const e = STRATEGIES[k].entry(a);
        if (e && e.conf >= cfg.minConfidence) {
          const entry = c.c * (1 + slip), sd = stopAtr * a.atr;
          open[k] = { entry, stop: entry - sd, tp: entry + tpAtr * a.atr, high: entry, atr0: a.atr, stopDist: sd, idx: i };
        }
      });
    }
    return res;
  }

  /* ---------- factory ---------- */
  function createBot(opts) {
    opts = opts || {};
    const cfg = Object.assign({}, DEFAULTS, opts.cfg || {});
    const now = opts.now || Date.now;
    const seed = opts.seed != null ? opts.seed : (Date.now() ^ 0x9E3779B9) >>> 0;
    const S = {
      v: 2, cfg, seed, rng: seed >>> 0, tick: 0, candleIdx: 0, startedAt: now(),
      cash: cfg.startBalance, positions: [], trades: [], log: [], equity: [],
      symbols: {}, analysis: {}, agents: {}, halted: null, pauseUntil: 0,
      consecLosses: 0, cooldown: {}, peak: cfg.startBalance, maxDD: 0, seq: 0, lastScan: '',
      params: { stopAtr: cfg.stopAtr, tpAtr: cfg.tpAtr, emaFast: cfg.emaFast, emaSlow: cfg.emaSlow },
      learn: { arms: {}, model: newModel(), vpos: [], vtrades: [], observed: 0, optimizer: { lastCandle: 0, runs: 0, history: [], last: null } },
      feed: { mode: opts.history ? 'live' : 'sim', note: '' }
    };
    cfg.symbols.forEach(function (s) {
      S.symbols[s.id] = {
        id: s.id, start: s.price, price: s.price, vol: s.vol, candles: [],
        cur: { o: s.price, h: s.price, l: s.price, c: s.price, n: 0 },
        regime: newRegime(S)
      };
    });
    AGENTS.forEach(a => { S.agents[a] = { status: 'idle', last: 'Waiting for first candle', count: 0, tick: 0 }; });
    if (opts.history) {
      Object.keys(opts.history).forEach(function (id) {
        const s = S.symbols[id]; if (!s) return;
        s.candles = opts.history[id].slice(-cfg.maxCandles);
        const last = s.candles[s.candles.length - 1];
        s.price = last.c; s.start = last.c;
        s.cur = { o: last.c, h: last.c, l: last.c, c: last.c, n: 0 };
      });
      S.candleIdx = cfg.warmupCandles = Math.max(...Object.keys(S.symbols).map(id => S.symbols[id].candles.length));
    } else {
      for (let i = 0; i < cfg.warmupCandles * cfg.ticksPerCandle; i++) marketTick(S);
      S.candleIdx = cfg.warmupCandles;
    }
    if (opts.warm) {   // carry over what was learned elsewhere (arms, meta-model, tuned params) — not trades, cash or positions
      const w = JSON.parse(JSON.stringify(opts.warm));
      S.learn.arms = w.arms || {}; S.learn.model = w.model || S.learn.model; S.learn.observed = w.observed || 0;
      Object.keys(S.learn.arms).forEach(k => { S.learn.arms[k].since = 0; });
      if (w.params) S.params = w.params;
      if (w.optimizer) { S.learn.optimizer.runs = w.optimizer.runs || 0; S.learn.optimizer.history = w.optimizer.history || []; S.learn.optimizer.last = w.optimizer.last || null; }
    }
    S.equity.push({ t: 0, eq: cfg.startBalance });
    return makeAPI(S, now);
  }
  function restoreBot(state, opts) { return makeAPI(state, (opts && opts.now) || Date.now, true); }

  /* ---------- market (SIMULATED unless live prices injected) ---------- */
  function newRegime(S) {
    const r = rand(S);
    const drift = r < 0.25 ? -1 : r < 0.5 ? 1 : 0;
    const volMult = rand(S) < 0.25 ? 1.8 : 0.9 + rand(S) * 0.3;
    return { drift: drift * (S.cfg.driftMag || 0.00015), volMult, left: 40 + Math.floor(rand(S) * 120) };
  }
  function pushCandle(S, s) {
    const c = s.cur;
    s.candles.push({ o: c.o, h: c.h, l: c.l, c: c.c });
    if (s.candles.length > S.cfg.maxCandles) s.candles.shift();
    s.cur = { o: c.c, h: c.c, l: c.c, c: c.c, n: 0 };
  }
  function marketTick(S) {
    const cfg = S.cfg, m = randn(S);
    Object.keys(S.symbols).forEach(function (id) {
      const s = S.symbols[id];
      const z = 0.6 * m + 0.8 * randn(S);
      s.price *= Math.exp(s.regime.drift + s.vol * s.regime.volMult * z);
      const c = s.cur;
      c.c = s.price; c.h = Math.max(c.h, s.price); c.l = Math.min(c.l, s.price); c.n++;
      if (c.n >= cfg.ticksPerCandle) { pushCandle(S, s); if (--s.regime.left <= 0) s.regime = newRegime(S); }
    });
  }
  function applyPrices(S, prices) {
    Object.keys(prices).forEach(function (id) {
      const s = S.symbols[id]; const p = prices[id];
      if (!s || !(p > 0)) return;
      s.price = p; const c = s.cur;
      c.c = p; c.h = Math.max(c.h, p); c.l = Math.min(c.l, p); c.n++;
    });
  }

  /* ---------- API ---------- */
  function makeAPI(S, now, quiet) {
    const cfg = S.cfg, L = S.learn;
    CUR = cfg.currency || '$';
    const P = () => Object.assign({}, cfg, S.params);

    function touch(agent, msg, working) {
      const a = S.agents[agent];
      a.last = msg; a.count++; a.tick = S.tick; a.status = working ? 'working' : 'idle';
    }
    function log(agent, level, msg) {
      S.log.push({ id: ++S.seq, ts: now(), tick: S.tick, agent, level, msg });
      if (S.log.length > cfg.maxLogs) S.log.splice(0, S.log.length - cfg.maxLogs);
      touch(agent, msg, level !== 'info' || agent === 'Executor');
    }
    const priceOf = id => S.symbols[id].price;
    const positionsValue = () => S.positions.reduce((a, p) => a + p.qty * priceOf(p.symbol), 0);
    const equity = () => S.cash + positionsValue();

    /* ----- Learner ----- */
    function getArm(key) {
      return L.arms[key] || (L.arms[key] = { key, n: 0, mean: 0, m2: 0.25, mode: 'explore', real: 0, shadow: 0, since: S.candleIdx });
    }
    function armLCB(arm) {
      const neff = Math.max(1, Math.min(arm.n, 1 / cfg.armAlpha));
      return arm.mean - Math.sqrt(Math.max(arm.m2 - arm.mean * arm.mean, 0.01) / neff);
    }
    function updateArm(key, r, virtual) {
      const arm = getArm(key);
      const a = Math.max(1 / (arm.n + 1), cfg.armAlpha);
      arm.mean += a * (r - arm.mean);
      arm.m2 += a * (r * r - arm.m2);
      arm.n++; if (virtual) arm.shadow++; else arm.real++;
      const lcb = armLCB(arm), before = arm.mode;
      if (arm.n < cfg.exploreTrials) arm.mode = 'explore';
      else if (arm.mode === 'explore' || arm.mode === 'shadow') arm.mode = (arm.mean >= cfg.armOn.mean && lcb >= cfg.armOn.lcb) ? 'active' : 'shadow';
      else if (arm.mode === 'active' && (arm.mean < cfg.armOff.mean || lcb < cfg.armOff.lcb)) arm.mode = 'shadow';
      if (arm.mode !== before) {
        arm.since = S.candleIdx;
        log('Learner', arm.mode === 'active' ? 'learn' : 'warn', 'Arm ' + key + ' → ' + arm.mode.toUpperCase() + ' (mean ' + sgn(arm.mean) + 'R, LCB ' + sgn(lcb) + 'R, n=' + arm.n + ')');
      }
    }
    function modelP(x) {
      let z = 0; const w = L.model.w;
      for (let i = 0; i < NFEAT; i++) z += w[i] * x[i];
      return sigmoid(z);
    }
    function modelEV(p) { return p * L.model.avgWinR - (1 - p) * L.model.avgLossR; }
    function updateModel(x, pPred, r) {
      const m = L.model, y = r > 0 ? 1 : 0, eps = 1e-6;
      const ll = pr => -(y * Math.log(Math.max(pr, eps)) + (1 - y) * Math.log(Math.max(1 - pr, eps)));
      m.lossM += 0.05 * (ll(pPred) - m.lossM);
      m.lossB += 0.05 * (ll(m.base) - m.lossB);
      m.base += Math.max(1 / (m.n + 2), 0.02) * (y - m.base);
      const g = y - pPred;
      for (let i = 0; i < NFEAT; i++) m.w[i] += cfg.modelLR * (g * x[i] - cfg.modelL2 * m.w[i]);
      if (r > 0) m.avgWinR += 0.05 * (r - m.avgWinR); else m.avgLossR += 0.05 * (-r - m.avgLossR);
      m.n++;
      const was = m.active;
      m.active = m.n >= cfg.modelMinSamples && m.lossM < m.lossB - 0.005;
      if (m.active !== was) log('Learner', m.active ? 'learn' : 'warn', 'Meta-model ' + (m.active ? 'ACTIVATED' : 'DEACTIVATED') + ' (log-loss ' + m.lossM.toFixed(3) + ' vs baseline ' + m.lossB.toFixed(3) + ', n=' + m.n + ')');
    }
    function learnFrom(ctx, r, virtual) {
      if (!cfg.adaptive || !ctx) return;
      L.observed++;
      updateArm(ctx.key, r, virtual);
      updateModel(ctx.x, ctx.p, r);
    }
    function decide(cand, a) {
      const ctx = { key: cand.strategy + '|' + a.trend, x: featureVec(a, cand.strategy, cand.conf), strategy: cand.strategy, trend: a.trend };
      ctx.p = modelP(ctx.x);
      if (!cfg.adaptive) return { take: true, scale: 1, ctx, why: '' };
      const arm = getArm(ctx.key), m = L.model, ev = modelEV(ctx.p);
      if (arm.mode === 'shadow') return { take: false, ctx, why: 'arm ' + ctx.key + ' in shadow (mean ' + sgn(arm.mean) + 'R, n=' + arm.n + ')' };
      if (m.active && ev < cfg.minEV) return { take: false, ctx, why: 'meta-model EV ' + sgn(ev) + 'R < ' + cfg.minEV + 'R (p=' + (ctx.p * 100).toFixed(0) + '%)' };
      const sp0 = STRATEGIES[cand.strategy].plan || {};
      const scale = arm.mode === 'explore' ? (sp0.exploreScale != null ? sp0.exploreScale : cfg.exploreScale) : (sp0.sizePct ? 1 : clamp(0.6 + arm.mean, 0.5, 1.25));
      return { take: true, scale, ctx, why: (arm.mode === 'explore' ? 'exploring ' : 'proven ') + ctx.key + ' → size ×' + scale.toFixed(2) };
    }

    /* ----- Executor (paper broker) ----- */
    function buy(sig, plan, ctx) {
      const px = priceOf(sig.symbol);
      const fill = px * (1 + cfg.slippage);
      const qty = plan.qty;
      const cost0 = qty * fill, fee = cost0 * cfg.feeRate;
      S.cash -= cost0 + fee;
      S.positions.push({
        id: ++S.seq, symbol: sig.symbol, strategy: sig.strategy, qty, entry: fill, entryFee: fee,
        cost: cost0 + fee, stop: plan.stop, stop0: plan.stop, tp: plan.tp, high: fill, atr0: plan.atr, trail: plan.trail || cfg.trailAtr,
        stopDist0: fill - plan.stop, openCandle: S.candleIdx, openTick: S.tick, openTs: now(), ctx
      });
      log('Executor', 'trade', 'BUY ' + qty.toPrecision(4) + ' ' + sig.symbol + ' @ ' + fmtP(fill) + ' (' + usd(cost0) + ', fee ' + usd(fee) + ') · stop ' + fmtP(plan.stop) + ' · target ' + fmtP(plan.tp));
    }
    function sell(pos, reason) {
      const px = priceOf(pos.symbol);
      const fill = px * (1 - cfg.slippage);
      const proceeds = pos.qty * fill, fee = proceeds * cfg.feeRate;
      S.cash += proceeds - fee;
      const pnl = proceeds - fee - pos.cost;
      S.positions = S.positions.filter(p => p !== pos);
      const r = pnl / (pos.qty * pos.stopDist0);
      S.trades.push({
        id: pos.id, symbol: pos.symbol, strategy: pos.strategy, qty: pos.qty, entry: pos.entry, exit: fill,
        pnl, pnlPct: pnl / pos.cost, r, fees: pos.entryFee + fee, reason,
        openCandle: pos.openCandle, closeCandle: S.candleIdx, openTs: pos.openTs, closeTs: now(),
        held: S.candleIdx - pos.openCandle, arm: pos.ctx ? pos.ctx.key : null,
        dir: 'LONG', legs: [{ act: 'BUY', exitAct: 'SELL', what: pos.symbol, qty: pos.qty, inPx: pos.entry, outPx: fill, how: reason }]
      });
      S.cooldown[pos.symbol] = S.candleIdx + cfg.cooldownCandles;
      log('Executor', 'trade', 'SELL ' + pos.symbol + ' @ ' + fmtP(fill) + ' · ' + reason + ' · PnL ' + (pnl >= 0 ? '+' : '') + usd(pnl) + ' (' + sgn(r) + 'R)');
      learnFrom(pos.ctx, r, false);
      if (pnl < 0) {
        S.consecLosses++;
        if (S.consecLosses >= cfg.maxConsecLosses) {
          S.pauseUntil = S.candleIdx + cfg.lossPauseCandles;
          S.consecLosses = 0;
          log('Risk', 'warn', cfg.maxConsecLosses + ' losses in a row — new entries paused for ' + cfg.lossPauseCandles + ' candles');
        }
      } else S.consecLosses = 0;
    }
    function trailUpdate(pos, px) {
      if (px > pos.high) pos.high = px;
      if (pos.high - pos.entry >= pos.atr0) pos.stop = Math.max(pos.stop, pos.high - (pos.trail || cfg.trailAtr) * pos.atr0);
    }
    function manageStops() {
      S.positions.slice().forEach(function (pos) {
        const px = priceOf(pos.symbol);
        trailUpdate(pos, px);
        if (px <= pos.stop) sell(pos, pos.stop > pos.stop0 ? 'Trailing stop hit' : 'Stop-loss hit');
        else if (px >= pos.tp) sell(pos, 'Target hit');
      });
      L.vpos.slice().forEach(function (v) {
        const px = priceOf(v.symbol);
        trailUpdate(v, px);
        if (px <= v.stop) closeVirtual(v, v.stop > v.stop0 ? 'Trailing stop' : 'Stop-loss');
        else if (px >= v.tp) closeVirtual(v, 'Target');
      });
    }

    /* ----- shadow (virtual) trades ----- */
    function openVirtual(cand, a, ctx) {
      if (!cfg.adaptive || !a.atr) return;
      if (L.vpos.some(v => v.symbol === cand.symbol && v.strategy === cand.strategy)) return;
      const p = P(), vp = STRATEGIES[cand.strategy].plan || {}, entry = a.price * (1 + cfg.slippage), sd = (vp.stopAtr || p.stopAtr) * a.atr;
      L.vpos.push({ symbol: cand.symbol, strategy: cand.strategy, entry, stop: entry - sd, stop0: entry - sd, tp: entry + (vp.tpAtr || p.tpAtr) * a.atr,
        high: entry, atr0: a.atr, trail: vp.trailAtr || cfg.trailAtr, stopDist0: sd, openCandle: S.candleIdx, ctx });
    }
    function closeVirtual(v, reason) {
      L.vpos = L.vpos.filter(x => x !== v);
      const exitFill = priceOf(v.symbol) * (1 - cfg.slippage);
      const r = rMult(cfg, v.entry, exitFill, v.stopDist0);
      L.vtrades.push({ symbol: v.symbol, strategy: v.strategy, r, reason, arm: v.ctx.key, closeCandle: S.candleIdx });
      if (L.vtrades.length > cfg.maxVTrades) L.vtrades.shift();
      learnFrom(v.ctx, r, true);
    }

    /* ----- Risk ----- */
    function ddScale() {
      if (!cfg.adaptive) return 1;
      const dd = (S.peak - equity()) / S.peak;
      return clamp(1 - 0.75 * dd / cfg.haltDrawdown, 0.25, 1);
    }
    function evaluate(sig, a, scale) {
      if (S.halted) return { ok: false, why: 'kill switch active' };
      if (S.pauseUntil > S.candleIdx) return { ok: false, why: 'loss-streak pause (' + (S.pauseUntil - S.candleIdx) + ' candles left)' };
      if ((S.cooldown[sig.symbol] || 0) > S.candleIdx) return { ok: false, why: 'cooldown after last exit' };
      if (S.positions.length >= cfg.maxPositions) return { ok: false, why: 'max ' + cfg.maxPositions + ' open positions' };
      if (!a.atr || a.atr <= 0) return { ok: false, why: 'ATR unavailable' };
      const p = P(), eq = equity();
      const entry = a.price * (1 + cfg.slippage);
      const sp = STRATEGIES[sig.strategy].plan || {};
      const stopDist = (sp.stopAtr || p.stopAtr) * a.atr, tpDist = (sp.tpAtr || p.tpAtr) * a.atr;
      const rtCost = entry * (2 * cfg.feeRate + 2 * cfg.slippage);
      if (tpDist < cfg.minEdgeMult * rtCost) return { ok: false, why: 'target ' + (tpDist / entry * 100).toFixed(2) + '% too small vs costs ' + (rtCost / entry * 100).toFixed(2) + '%' };
      let riskNotional = (cfg.riskPerTrade * eq / stopDist) * entry;
      if (sp.sizePct) riskNotional = eq * (cfg.sizePct || sp.sizePct);
      const cap = Math.min(S.cash / (1 + cfg.feeRate) * 0.99, eq * cfg.maxPositionPct);
      const capped = riskNotional > cap;
      const dds = ddScale();
      const notional = Math.min(riskNotional, cap) * scale * dds;
      if (notional < cfg.minNotional) return { ok: false, why: 'size ' + usd(notional) + ' below $' + cfg.minNotional + ' minimum' };
      let qty = notional / entry;
      if (cfg.integerQty) {
        qty = Math.floor(qty);
        if (qty < 1) return { ok: false, why: 'cannot afford 1 unit at ' + fmtP(entry) + ' within size limits' };
      }
      const notional2 = qty * entry;
      return { ok: true, qty, notional: notional2, atr: a.atr, stop: entry - stopDist, tp: entry + tpDist, risk: qty * stopDist, capped, dds, trail: sp.trailAtr || cfg.trailAtr };
    }

    /* ----- walk-forward tuner ----- */
    function runOptimizer(n) {
      const O = L.optimizer;
      O.lastCandle = S.candleIdx; O.runs++;
      const ids = Object.keys(S.symbols);
      const windows = ids.map(id => S.symbols[id].candles.slice(-cfg.optWindow));
      const minLen = Math.min.apply(null, windows.map(w => w.length));
      if (minLen < cfg.optMinCandles) return;
      const from = 60, split = Math.floor(from + (minLen - from) * 0.7);
      const cache = {};
      function analysesFor(pair) {
        const key = pair.join('/');
        if (!cache[key]) {
          const Pp = Object.assign({}, cfg, { emaFast: pair[0], emaSlow: pair[1] });
          cache[key] = windows.map(w => precomputeAnalyses(w, Pp, from));
        }
        return cache[key];
      }
      function score(pair, stopAtr, tpAtr) {
        const an = analysesFor(pair);
        const tr = [], ho = [];
        windows.forEach(function (w, k) {
          simulateR(w, an[k], from, cfg, stopAtr, tpAtr).forEach(t => (t.idx < split ? tr : ho).push(t.r));
        });
        const m = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
        return { nTr: tr.length, mTr: m(tr), nHo: ho.length, mHo: m(ho) };
      }
      const cur = score([S.params.emaFast, S.params.emaSlow], S.params.stopAtr, S.params.tpAtr);
      let best = null, tested = 0;
      GRID.ema.forEach(pair => GRID.stopAtr.forEach(sa => GRID.tpAtr.forEach(ta => {
        if (pair[0] === S.params.emaFast && pair[1] === S.params.emaSlow && sa === S.params.stopAtr && ta === S.params.tpAtr) return;
        tested++;
        const s = score(pair, sa, ta);
        const ok = s.nTr >= cfg.optMinTrain && s.nHo >= cfg.optMinHold && s.mHo >= cur.mHo + cfg.optMargin && s.mTr >= cur.mTr && s.mHo > 0;
        if (ok && (!best || (s.mTr + s.mHo) > (best.s.mTr + best.s.mHo))) best = { pair, sa, ta, s };
      })));
      const base = 'Tuner: tested ' + tested + ' param sets on ' + minLen + ' candles · current train ' + sgn(cur.mTr) + 'R (' + cur.nTr + ') / hold-out ' + sgn(cur.mHo) + 'R (' + cur.nHo + ')';
      if (best) {
        const old = Object.assign({}, S.params);
        S.params = { stopAtr: best.sa, tpAtr: best.ta, emaFast: best.pair[0], emaSlow: best.pair[1] };
        O.history.push({ candle: n, from: old, to: Object.assign({}, S.params), hold: best.s.mHo, train: best.s.mTr });
        O.last = 'PROMOTED';
        log('Learner', 'learn', base + ' → PROMOTED EMA ' + best.pair.join('/') + ', stop ' + best.sa + '×ATR, target ' + best.ta + '×ATR (train ' + sgn(best.s.mTr) + 'R, hold-out ' + sgn(best.s.mHo) + 'R)');
      } else {
        O.last = 'KEPT';
        log('Learner', 'info', base + ' → kept (no candidate cleared train + hold-out + ' + cfg.optMargin + 'R margin)');
      }
    }

    /* ----- Supervisor: one pass per closed candle ----- */
    function onCandleClose() {
      S.candleIdx++;
      const ids = Object.keys(S.symbols);
      const n = S.candleIdx - cfg.warmupCandles;
      const p = P();
      if (n % 12 === 1) log('Data', 'info', 'Feed OK · ' + ids.length + ' symbols · candle #' + n + ' · ' + (S.feed.mode === 'sim' ? 'SIMULATED prices' : 'LIVE prices'));
      else touch('Data', 'Candle #' + n + ' received for ' + ids.length + ' symbols', false);

      const flips = [];
      ids.forEach(function (id) {
        const prev = S.analysis[id];
        const a = analyze(p, S.symbols[id].candles, !!(cfg.scanLib || (cfg.enabled || []).indexOf('libvote') >= 0));
        S.analysis[id] = a;
        if (prev && prev.trend !== a.trend) flips.push(id + ' trend ' + prev.trend + ' → ' + a.trend + ' (RSI ' + a.rsi.toFixed(0) + ')');
      });
      flips.forEach(f => log('Analyst', 'info', f));
      if (n % cfg.scanEvery === 0) {
        S.lastScan = ids.map(id => id.split('-')[0] + ' RSI ' + S.analysis[id].rsi.toFixed(0) + ' ' + S.analysis[id].trend.toLowerCase()).join(' · ');
        log('Analyst', 'info', 'Scan: ' + S.lastScan);
      }

      const entries = [];
      ids.forEach(function (id) {
        const a = S.analysis[id];
        const pos = S.positions.find(x => x.symbol === id);
        if (pos) {
          const why = STRATEGIES[pos.strategy].exit(a);
          if (why) { log('Strategy', 'signal', 'SELL signal ' + id + ' (' + pos.strategy + '): ' + why); sell(pos, why); }
          return;
        }
        const cands = [];
        Object.keys(STRATEGIES).filter(k => !cfg.enabled || cfg.enabled.indexOf(k) >= 0).forEach(function (k) {
          const r = STRATEGIES[k].entry(a);
          if (r) cands.push({ symbol: id, strategy: k, conf: r.conf, reason: r.reason });
        });
        if (!cands.length) return;
        cands.sort((x, y) => y.conf - x.conf);
        const best = cands[0];
        if (cands.length > 1) { best.conf = Math.min(0.95, best.conf + 0.1); best.reason += ' (+' + (cands.length - 1) + ' confirming)'; }
        if (best.conf < cfg.minConfidence) {
          log('Strategy', 'info', 'Ignored ' + id + ' ' + best.strategy + ' setup — conviction ' + (best.conf * 100).toFixed(0) + '% < ' + (cfg.minConfidence * 100).toFixed(0) + '%');
          cands.forEach(c => openVirtual(c, a, { key: c.strategy + '|' + a.trend, x: featureVec(a, c.strategy, c.conf), p: modelP(featureVec(a, c.strategy, c.conf)) }));
          return;
        }
        log('Strategy', 'signal', 'BUY signal ' + id + ' (' + best.strategy + ', ' + (best.conf * 100).toFixed(0) + '%): ' + best.reason);
        const d = decide(best, a);
        // every other strategy that fired is observed as a shadow trade
        cands.slice(1).forEach(c => { const x = featureVec(a, c.strategy, c.conf); openVirtual(c, a, { key: c.strategy + '|' + a.trend, x, p: modelP(x) }); });
        if (!d.take) {
          log('Learner', 'warn', 'SKIP ' + id + ': ' + d.why + ' — tracked as shadow trade');
          openVirtual(best, a, d.ctx);
          return;
        }
        entries.push(Object.assign({}, best, { d }));
      });
      entries.sort((x, y) => y.conf - x.conf).forEach(function (sig) {
        const plan = evaluate(sig, S.analysis[sig.symbol], sig.d.scale);
        if (!plan.ok) { log('Risk', 'warn', 'REJECTED ' + sig.symbol + ': ' + plan.why + ' — tracked as shadow trade'); openVirtual(sig, S.analysis[sig.symbol], sig.d.ctx); return; }
        log('Risk', 'risk', 'APPROVED ' + sig.symbol + ': ' + usd(plan.notional) + (plan.capped ? ' (exposure-capped)' : '') + ', risk ' + usd(plan.risk) + ' (' + (plan.risk / equity() * 100).toFixed(1) + '% of equity)' + (cfg.adaptive ? ' · ' + sig.d.why + (plan.dds < 1 ? ' · drawdown scale ×' + plan.dds.toFixed(2) : '') : ''));
        buy(sig, plan, sig.d.ctx);
      });

      // virtual positions: strategy exits at candle close
      L.vpos.slice().forEach(function (v) {
        const a = S.analysis[v.symbol];
        const why = STRATEGIES[v.strategy].exit(a);
        if (why) closeVirtual(v, why);
        else if (S.candleIdx - v.openCandle >= cfg.vMaxHold) closeVirtual(v, 'Max hold');
      });

      // kill switch
      const eq = equity();
      if (!S.halted && eq <= cfg.startBalance * (1 - cfg.haltDrawdown)) {
        S.halted = { reason: 'Equity fell ' + (cfg.haltDrawdown * 100) + '% below the starting balance', tick: S.tick, candle: n };
        log('Risk', 'critical', 'KILL SWITCH: ' + S.halted.reason + '. New entries disabled; open positions stay under stop-loss management.');
      } else touch('Risk', S.halted ? 'Kill switch active' : (S.pauseUntil > S.candleIdx ? 'Loss-streak pause' : 'Limits OK · ' + S.positions.length + '/' + cfg.maxPositions + ' positions · size ×' + ddScale().toFixed(2)), false);

      // learning cadence
      if (cfg.adaptive) {
        if (n % 24 === 0) log('Learner', 'info', 'Observed ' + L.observed + ' outcomes (' + S.trades.length + ' real, ' + (L.observed - S.trades.length) + ' shadow) · ' + Object.keys(L.arms).filter(k => L.arms[k].mode === 'active').length + ' arms active');
        if (S.candleIdx - L.optimizer.lastCandle >= cfg.optEvery && S.symbols[ids[0]].candles.length >= cfg.optMinCandles) runOptimizer(n);
        else touch('Learner', L.observed + ' outcomes · model ' + (L.model.active ? 'active' : 'learning') + ' · params EMA ' + S.params.emaFast + '/' + S.params.emaSlow, false);
      }

      if (n % cfg.reportEvery === 0) {
        const m = metrics();
        log('Reporter', 'info', 'Equity ' + usd(m.equity) + ' · PnL ' + (m.totalPnl >= 0 ? '+' : '') + usd(m.totalPnl) + ' (' + (m.totalPnlPct * 100).toFixed(1) + '%) · ' + m.trades + ' trades · win ' + (m.trades ? (m.winRate * 100).toFixed(0) + '%' : '–') + ' · max DD ' + (m.maxDD * 100).toFixed(1) + '%');
      }
      touch('Supervisor', 'Candle #' + n + ' pipeline complete', false);
    }

    /* step(count)            → simulated market
     * step(1, {prices, newCandle}) → live prices; caller says when a new candle bucket starts */
    function step(count, feed) {
      count = count || 1;
      for (let k = 0; k < count; k++) {
        S.tick++;
        if (feed) {
          if (feed.newCandle) {
            Object.keys(S.symbols).forEach(id => { if (S.symbols[id].cur.n > 0) pushCandle(S, S.symbols[id]); });
            onCandleClose();
          }
          applyPrices(S, feed.prices || {});
          manageStops();
        } else {
          marketTick(S);
          manageStops();
          if (S.tick % cfg.ticksPerCandle === 0) onCandleClose();
        }
        book();
      }
    }

    function book() {
      const eq = equity();
      if (eq > S.peak) S.peak = eq;
      const dd = (S.peak - eq) / S.peak;
      if (dd > S.maxDD) S.maxDD = dd;
      S.equity.push({ t: S.tick, eq });
      if (S.equity.length > cfg.maxEquityPts) S.equity = S.equity.filter((q, i) => i % 2 === 0 || i === S.equity.length - 1);
    }

    /* Replay one real OHLC bar per symbol: cm = { id: {o,h,l,c} }.
     * Intrabar path (o, then low/high, then close) lets stops/targets trigger; gaps fill at the gap price.
     * Signals are computed on the bar close and filled at that close (like a close-auction order). */
    function stepCandle(cm) {
      const ids = Object.keys(S.symbols).filter(id => cm[id]);
      const seq = [c => c.o, c => (c.c >= c.o ? c.l : c.h), c => (c.c >= c.o ? c.h : c.l), c => c.c];
      seq.forEach(function (f) {
        S.tick++;
        ids.forEach(id => { S.symbols[id].price = f(cm[id]); });
        manageStops();
        book();
      });
      ids.forEach(function (id) {
        const s = S.symbols[id], c = cm[id];
        s.cur = { o: c.o, h: c.h, l: c.l, c: c.c, n: 1 };
        pushCandle(S, s);
      });
      if (cfg.cashYieldPa) { const y = S.cash * cfg.cashYieldPa / 252; S.cash += y; S.interest = (S.interest || 0) + y; }
      onCandleClose();
      book();
    }

    function closeAll(reason) {
      const open = S.positions.slice();
      open.forEach(p => sell(p, reason || 'Closed manually'));
      return open.length;
    }

    function metrics() {
      const eq = equity();
      const realized = S.trades.reduce((a, t) => a + t.pnl, 0);
      const unreal = S.positions.reduce((a, p) => a + p.qty * priceOf(p.symbol) - p.cost, 0);
      const wins = S.trades.filter(t => t.pnl > 0), losses = S.trades.filter(t => t.pnl <= 0);
      const gw = wins.reduce((a, t) => a + t.pnl, 0), gl = -losses.reduce((a, t) => a + t.pnl, 0);
      const fees = S.trades.reduce((a, t) => a + t.fees, 0) + S.positions.reduce((a, p) => a + p.entryFee, 0);
      return {
        equity: eq, cash: S.cash, positionsValue: positionsValue(), realized, unrealized: unreal,
        totalPnl: eq - cfg.startBalance, totalPnlPct: (eq - cfg.startBalance) / cfg.startBalance,
        trades: S.trades.length, wins: wins.length, losses: losses.length,
        winRate: S.trades.length ? wins.length / S.trades.length : 0,
        profitFactor: gl > 0 ? gw / gl : (gw > 0 ? 99 : 0),
        avgWin: wins.length ? gw / wins.length : 0, avgLoss: losses.length ? -gl / losses.length : 0,
        expectancy: S.trades.length ? realized / S.trades.length : 0,
        best: S.trades.length ? Math.max.apply(null, S.trades.map(t => t.pnl)) : 0,
        worst: S.trades.length ? Math.min.apply(null, S.trades.map(t => t.pnl)) : 0,
        interest: S.interest || 0, fees, maxDD: S.maxDD, peak: S.peak, exposure: eq > 0 ? positionsValue() / eq : 0
      };
    }

    function learning() {
      const m = L.model;
      const arms = Object.keys(L.arms).map(k => {
        const a = L.arms[k];
        return { key: k, n: a.n, real: a.real, shadow: a.shadow, mean: a.mean, lcb: armLCB(a), mode: a.mode };
      }).sort((x, y) => y.n - x.n);
      return {
        adaptive: cfg.adaptive, observed: L.observed, real: S.trades.length, shadowOpen: L.vpos.length,
        arms, params: Object.assign({}, S.params), optimizer: { runs: L.optimizer.runs, last: L.optimizer.last, history: L.optimizer.history.slice(-5), every: cfg.optEvery },
        model: { n: m.n, active: m.active, lossM: m.lossM, lossB: m.lossB, base: m.base, minSamples: cfg.modelMinSamples },
        ddScale: ddScale()
      };
    }


    /* compact JSON for dashboards (same shape locally and from the server) */
    function snapshot(o) {
      o = o || {};
      const nC = o.candles || 110, nL = o.logs || 150, nT = o.trades || 80;
      const eqPts = S.equity, stride = Math.max(1, Math.ceil(eqPts.length / 400));
      const eqOut = eqPts.filter((q, i) => i % stride === 0 || i === eqPts.length - 1);
      const symbols = {};
      Object.keys(S.symbols).forEach(function (id) {
        const s = S.symbols[id];
        symbols[id] = { id, price: s.price, start: s.start, candles: s.candles.slice(-nC), cur: s.cur, analysis: S.analysis[id] || null };
      });
      return {
        v: 2, currency: cfg.currency, ts: now(), startedAt: S.startedAt, tick: S.tick, candleIdx: S.candleIdx, warmup: cfg.warmupCandles,
        feed: S.feed, halted: S.halted, pausedUntil: S.pauseUntil, startBalance: cfg.startBalance,
        metrics: metrics(), learning: learning(), equity: eqOut,
        positions: S.positions.map(p => ({ id: p.id, symbol: p.symbol, strategy: p.strategy, qty: p.qty, entry: p.entry, price: priceOf(p.symbol),
          stop: p.stop, tp: p.tp, pnl: p.qty * priceOf(p.symbol) - p.cost, pnlPct: (p.qty * priceOf(p.symbol) - p.cost) / p.cost, held: S.candleIdx - p.openCandle, openTs: p.openTs })),
        trades: S.trades.slice(-nT).reverse(), log: S.log.slice(-nL).reverse(),
        agents: S.agents, symbols, params: S.params, lastScan: S.lastScan,
        risk: { riskPerTrade: cfg.riskPerTrade, maxPositionPct: cfg.maxPositionPct, maxPositions: cfg.maxPositions, haltDrawdown: cfg.haltDrawdown, feeRate: cfg.feeRate, slippage: cfg.slippage }
      };
    }

    if (!quiet) log('Supervisor', 'info', 'Bot online · paper account ' + usd(cfg.startBalance) + ' · ' + Object.keys(S.symbols).length + ' markets · 3 strategies · ' + (cfg.adaptive ? 'ADAPTIVE learning ON' : 'static rules (learning OFF)') + ' · risk ' + (cfg.riskPerTrade * 100) + '%/trade');
    Object.keys(S.symbols).forEach(id => { if (S.symbols[id].candles.length > cfg.atrLen + 2) S.analysis[id] = analyze(P(), S.symbols[id].candles, !!cfg.scanLib); });

    function exportLearn() { return JSON.parse(JSON.stringify({ arms: L.arms, model: L.model, observed: L.observed, params: S.params, optimizer: { runs: L.optimizer.runs, last: L.optimizer.last, history: L.optimizer.history } })); }

    return { state: S, exportLearn, step, stepCandle, closeAll, metrics, learning, snapshot, equity, STRATEGIES, AGENTS };
  }

  return { createBot, restoreBot, setLibrary, PRESETS, DEFAULTS, AGENTS, STRATEGIES, GRID, analyze, usd, fmtP };
});
