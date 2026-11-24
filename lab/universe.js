'use strict';
/* Symbol universe: what exists, what the bots trade, what the Charts tab can open.
 * Design: nobody can poll thousands of symbols on a free server (Yahoo rate-limits a shared cloud IP within minutes), so
 *   1. the lab TRADES a small liquid watchlist (LAB_EXTRA is appended to LAB_SYMS),
 *   2. the Charts tab can OPEN ANY symbol Yahoo or Coinbase knows, on demand (search below), because a chart is one request when you look at it,
 *   3. the numbers of what exists come from the exchanges' own files where reachable (live) and are marked approximate otherwise. */
const D = require('./data.js');
const E = process.env;
const list = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);

/* additions to the traded watchlist (liquid, tight spreads, valid Yahoo / Coinbase tickers). LAB_SYMS_EXTRA=off disables, or give your own comma list */
const LAB_EXTRA = E.LAB_SYMS_EXTRA === 'off' ? [] : (E.LAB_SYMS_EXTRA ? list(E.LAB_SYMS_EXTRA) : ['ICICIBANK.NS', 'TCS.NS', 'INFY.NS', 'SBIN.NS', 'DOGE-USD', 'ADA-USD', 'AVAX-USD', 'LINK-USD']);
/* extra chart-only tickers shown in the Charts strip (quoted, not traded) */
const CHART_EXTRA = E.CHART_SYMS_EXTRA === 'off' ? [] : (E.CHART_SYMS_EXTRA ? list(E.CHART_SYMS_EXTRA) : ['^BSESN', '^CNXIT', 'NIFTYBEES.NS', 'GOLDBEES.NS', 'BZ=F', 'NG=F', 'HG=F', '^DJI', '^RUT', '^FTSE', '^GDAXI', '^HSI', 'EURUSD=X', 'AAPL', 'NVDA', 'SPY']);

/* curated, searchable seed (name -> Yahoo/Coinbase ticker). Anything not here is found through the live Yahoo / Coinbase search. */
const SEED = [
  ['India indices', [['NIFTY 50', '^NSEI'], ['BANK NIFTY', '^NSEBANK'], ['SENSEX', '^BSESN'], ['NIFTY IT', '^CNXIT'], ['NIFTY AUTO', '^CNXAUTO'], ['NIFTY FMCG', '^CNXFMCG'], ['NIFTY PHARMA', '^CNXPHARMA'], ['NIFTY METAL', '^CNXMETAL'], ['NIFTY ENERGY', '^CNXENERGY'], ['NIFTY REALTY', '^CNXREALTY'], ['NIFTY FIN SERVICE', 'NIFTY_FIN_SERVICE.NS'], ['NIFTY MIDCAP 100', '^CNXMIDCAP'], ['NIFTY SMALLCAP 100', '^CNXSC'], ['INDIA VIX', '^INDIAVIX']]],
  ['India stocks', ['RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'INFY', 'BHARTIARTL', 'ITC', 'SBIN', 'LT', 'HINDUNILVR', 'KOTAKBANK', 'AXISBANK', 'BAJFINANCE', 'MARUTI', 'SUNPHARMA', 'ASIANPAINT', 'TITAN', 'ULTRACEMCO', 'NTPC', 'POWERGRID', 'ONGC', 'TATASTEEL', 'JSWSTEEL', 'ADANIENT', 'ADANIPORTS', 'COALINDIA', 'WIPRO', 'HCLTECH', 'TECHM', 'NESTLEIND', 'BAJAJFINSV', 'GRASIM', 'CIPLA', 'DRREDDY', 'EICHERMOT', 'HEROMOTOCO', 'HINDALCO', 'INDUSINDBK', 'BPCL', 'BRITANNIA', 'APOLLOHOSP', 'SBILIFE', 'HDFCLIFE', 'TATACONSUM', 'SHRIRAMFIN', 'TRENT', 'BEL', 'LTIM', 'M&M', 'BAJAJ-AUTO', 'VEDL', 'DLF', 'IRCTC', 'HAL', 'PNB', 'BANKBARODA', 'IDFCFIRSTB', 'YESBANK', 'ZOMATO', 'PAYTM'].map(s => [s, s + '.NS'])],
  ['US indices & ETFs', [['S&P 500', '^GSPC'], ['Nasdaq Composite', '^IXIC'], ['Dow Jones', '^DJI'], ['Russell 2000', '^RUT'], ['VIX', '^VIX'], ['SPY', 'SPY'], ['QQQ', 'QQQ'], ['DIA', 'DIA'], ['IWM', 'IWM'], ['GLD', 'GLD'], ['TLT', 'TLT']]],
  ['US stocks', ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AVGO', 'JPM', 'V', 'UNH', 'XOM', 'WMT', 'NFLX', 'AMD', 'ORCL', 'COST', 'BAC', 'DIS', 'INTC', 'COIN', 'PLTR'].map(s => [s, s])],
  ['Global indices', [['Nikkei 225', '^N225'], ['Hang Seng', '^HSI'], ['Shanghai', '000001.SS'], ['FTSE 100', '^FTSE'], ['DAX', '^GDAXI'], ['CAC 40', '^FCHI'], ['Euro Stoxx 50', '^STOXX50E'], ['ASX 200', '^AXJO'], ['KOSPI', '^KS11'], ['Taiwan', '^TWII'], ['Bovespa', '^BVSP']]],
  ['Commodities (futures)', [['Gold', 'GC=F'], ['Silver', 'SI=F'], ['Copper', 'HG=F'], ['WTI crude', 'CL=F'], ['Brent crude', 'BZ=F'], ['Natural gas', 'NG=F'], ['Platinum', 'PL=F'], ['Palladium', 'PA=F'], ['Corn', 'ZC=F'], ['Wheat', 'ZW=F'], ['Soybeans', 'ZS=F'], ['Coffee', 'KC=F'], ['Sugar', 'SB=F'], ['Cotton', 'CT=F'], ['Gold BeES (India)', 'GOLDBEES.NS'], ['Silver BeES (India)', 'SILVERBEES.NS']]],
  ['Currencies', [['USD/INR', 'INR=X'], ['EUR/USD', 'EURUSD=X'], ['GBP/USD', 'GBPUSD=X'], ['USD/JPY', 'JPY=X'], ['EUR/INR', 'EURINR=X'], ['GBP/INR', 'GBPINR=X'], ['Dollar index', 'DX-Y.NYB']]],
  ['Crypto (Coinbase)', ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'LTC', 'BCH', 'ATOM', 'UNI', 'NEAR', 'APT', 'ARB', 'OP', 'SUI', 'INJ', 'AAVE', 'XLM', 'HBAR', 'SHIB', 'PEPE', 'TRX', 'FIL', 'ETC', 'ALGO'].map(s => [s, s + '-USD'])]
];
const FLAT = []; SEED.forEach(([g, a]) => a.forEach(([n, s]) => FLAT.push({ g, n, sym: s })));

/* ---- Coinbase product list (live, cached 6h): used for crypto search and the live pair count ---- */
let CB = { at: 0, list: [], err: null };
async function coinbase() {
  if (Date.now() - CB.at < 6 * 3600e3 && CB.list.length) return CB.list;
  try { const c = new AbortController(), t = setTimeout(() => c.abort(), 10000); const r = await fetch('https://api.exchange.coinbase.com/products', { headers: { 'User-Agent': 'paperbot/1.0' }, signal: c.signal }); clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); CB = { at: Date.now(), list: j.filter(p => p.quote_currency === 'USD' && p.status === 'online' && !p.trading_disabled).map(p => ({ sym: p.id, name: p.base_currency })), err: null }; }
  catch (e) { CB.err = e.message; CB.at = Date.now() - 5.5 * 3600e3; }   // retry in ~30 min
  return CB.list;
}

/* ---- search: curated seed + Coinbase products + Yahoo search API (any listed security worldwide) ---- */
const SQ = { n: 0, at: 0 };   // public endpoint: at most 20 live Yahoo searches a minute, so it can never starve the bots of Yahoo capacity
async function search(q) {
  q = String(q || '').trim().slice(0, 40); if (q.length < 1) return [];
  if (Date.now() - SQ.at > 60000) { SQ.at = Date.now(); SQ.n = 0; }
  const ql = q.toLowerCase(), out = [], seen = new Set(), add = (sym, name, group, src) => { if (seen.has(sym)) return; seen.add(sym); out.push({ sym, name, group, src }); };
  FLAT.filter(x => x.n.toLowerCase().indexOf(ql) >= 0 || x.sym.toLowerCase().indexOf(ql) >= 0).slice(0, 12).forEach(x => add(x.sym, x.n, x.g, 'catalog'));
  try { (await coinbase()).filter(p => p.name.toLowerCase().indexOf(ql) === 0 || p.sym.toLowerCase().indexOf(ql) === 0).slice(0, 8).forEach(p => add(p.sym, p.name, 'Crypto (Coinbase)', 'coinbase')); } catch (e) { /* optional */ }
  if (q.length >= 2 && ++SQ.n <= 20) {
    try {
      const j = await D.ygate('https://query2.finance.yahoo.com/v1/finance/search?quotesCount=12&newsCount=0&listsCount=0&q=' + encodeURIComponent(q), { ttl: 6 * 3600e3, pri: 2 });
      (j.quotes || []).filter(x => x.symbol && ['EQUITY', 'ETF', 'INDEX', 'CURRENCY', 'FUTURE', 'CRYPTOCURRENCY', 'MUTUALFUND'].indexOf(x.quoteType) >= 0).forEach(x => add(x.symbol, x.shortname || x.longname || x.symbol, (x.exchDisp || x.exchange || '') + ' · ' + (x.quoteType || '').toLowerCase(), 'yahoo'));
    } catch (e) { /* Yahoo cooling down: catalog + Coinbase results still returned */ }
  }
  return out.slice(0, 24);
}

/* ---- coverage table: what exists vs what we trade / chart / can open on demand ---- */
function overview(labSyms, chartSyms, fnoCount) {
  const cb = CB.list.length, inLab = s => labSyms.indexOf(s) >= 0, inCh = s => chartSyms.indexOf(s) >= 0;
  const cnt = f => ({ lab: labSyms.filter(f).length, charts: chartSyms.filter(f).length });
  const isIN = s => /\.NS$|\.BO$|^\^(NSE|BSE|CNX)/.test(s) && !/INDIAVIX/.test(s), isIdx = s => /^\^/.test(s), isCr = s => /-USD$/.test(s), isFx = s => /=X$/.test(s), isFut = s => /=F$/.test(s);
  const rows = [
    { id: 'in_fo', label: 'India F&O underlyings (NSE)', exists: fnoCount || 224, how: fnoCount ? 'live' : 'NSE lot-size file, 24 Nov 2026: 6 index + 218 stock', note: 'Daily OI / PCR / max pain for all of them via the F&O card (end of day). Bots trade the cash/index charts, not the contracts.', lab: 0, charts: 0 },
    { id: 'in_eq', label: 'India stocks (NSE listed)', exists: '≈2,100', how: 'approx', note: 'Any NSE/BSE ticker opens in Charts via search (SYMBOL.NS / .BO).', ...cnt(s => /\.NS$|\.BO$/.test(s)) },
    { id: 'in_idx', label: 'India indices', exists: '≈140 NSE + ≈100 BSE', how: 'approx', note: 'Broad, sector, thematic, strategy indices. 14 are in the search catalog.', ...cnt(s => isIN(s) && isIdx(s)) },
    { id: 'us', label: 'US stocks + ETFs (NYSE, Nasdaq)', exists: '≈11,000 tickers', how: 'approx (from Nasdaq symbol files)', note: 'Open any via search. Not traded by the lab (US session is outside the lab\'s clock).', ...cnt(s => !isIN(s) && !isIdx(s) && !isCr(s) && !isFx(s) && !isFut(s)) },
    { id: 'gl_idx', label: 'Global indices', exists: '100+', how: 'approx', note: '11 in the catalog; the rest through search.', ...cnt(s => !isIN(s) && isIdx(s)) },
    { id: 'cmd', label: 'Commodities (futures)', exists: '~40 liquid contracts', how: 'approx', note: 'MCX contracts are not on Yahoo; global futures and India gold/silver ETFs are the free proxies.', ...cnt(isFut) },
    { id: 'fx', label: 'Currency pairs', exists: '150+', how: 'approx', note: '', ...cnt(isFx) },
    { id: 'crypto', label: 'Crypto pairs vs USD (Coinbase)', exists: cb || 399, how: cb ? 'live' : 'checked 24 Nov 2026', note: 'Kraken lists ~668 USD pairs, Binance ~526 USDT pairs, CoinGecko tracks ~21,000 coins. Coinbase is the free candle source the bots use.', ...cnt(isCr) }
  ];
  return { rows, cbErr: CB.err };
}
module.exports = { LAB_EXTRA, CHART_EXTRA, SEED, search, overview, coinbase };
