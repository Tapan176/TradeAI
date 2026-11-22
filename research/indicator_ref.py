"""Compare signals.js / engine.js indicators with the `ta` library (pip install ta pandas numpy)."""
import json, numpy as np, pandas as pd, ta, sys
J = json.load(open('/tmp/ind_js.json')); df = pd.DataFrame({k: J[k] for k in 'ohlc'}); df.columns = ['open', 'high', 'low', 'close']
c, h, l = df.close, df.high, df.low
def cmp(name, js, ref, tol=1e-6, skip=0):
    js = pd.Series(js, dtype='float64'); ref = pd.Series(ref, dtype='float64'); m = js.notna() & ref.notna(); m.iloc[:skip] = False
    if m.sum() == 0: print(f'{name:14s} NO OVERLAP'); return False
    rel = ((js[m] - ref[m]).abs() / (ref[m].abs() + 1e-9)); mx, md = rel.max(), rel.median()
    ok = mx < tol; print(f"{name:14s} {'PASS' if ok else 'DIFF'}  max rel err {mx:.2e}  median {md:.2e}  n={m.sum()}"); return ok
S = J['sig']; res = []
for n in (14, 20, 50, 200):
    res.append(cmp(f'sma{n}', S[f'sma{n}'], c.rolling(n).mean()))
    res.append(cmp(f'ema{n}', S[f'ema{n}'], ta.trend.EMAIndicator(c, n, fillna=False).ema_indicator(), tol=1e-6, skip=n * 8))  # ta seeds at bar 0, we seed with SMA(n) (TradingView convention): equal after ~8n bars
    res.append(cmp(f'std{n}', S[f'std{n}'], c.rolling(n).std(ddof=0)))
for n in (14, 21):   # ta RSI uses Wilder smoothing from first n diffs: same seed as ours
    res.append(cmp(f'rsi{n}', S[f'rsi{n}'], ta.momentum.RSIIndicator(c, n).rsi(), tol=1e-4, skip=n * 15))
for n in (14, 20):
    res.append(cmp(f'atr{n}', S[f'atr{n}'], ta.volatility.AverageTrueRange(h, l, c, n).average_true_range(), tol=1e-4, skip=n * 8))
    res.append(cmp(f'cci{n}', S[f'cci{n}'], ta.trend.CCIIndicator(h, l, c, n, constant=0.015).cci(), tol=1e-6))
    res.append(cmp(f'stoch{n}', S[f'stoch{n}'], ta.momentum.StochasticOscillator(h, l, c, n, 1).stoch(), tol=1e-6))
mi = ta.trend.MACD(c, 26, 12, 9); res.append(cmp('macd', S['macd'], mi.macd(), tol=1e-3, skip=300)); res.append(cmp('macd_signal', S['macdsig'], mi.macd_signal(), tol=1e-3, skip=300))
ar = ta.trend.AroonIndicator(h, l, 25); res.append(cmp('aroonUp', S['aroonUp'], ar.aroon_up() if hasattr(ar, 'aroon_up') else ar._aroon_up if False else None, tol=1e-6)) if False else None
# aroon reference by hand (window n+1 incl. today)
n = 25; up = h.rolling(n + 1).apply(lambda x: 100 * (np.argmax(x[::-1] == x.max()) * -1 + n) / n if False else 100 * (n - (len(x) - 1 - np.where(x == x.max())[0][-1])) / n, raw=True)
dn = l.rolling(n + 1).apply(lambda x: 100 * (n - (len(x) - 1 - np.where(x == x.min())[0][-1])) / n, raw=True)
res.append(cmp('aroonUp', S['aroonUp'], up)); res.append(cmp('aroonDn', S['aroonDn'], dn))
res.append(cmp('hh20', S['hh20'], h.rolling(20).max())); res.append(cmp('ll20', S['ll20'], l.rolling(20).min()))
res.append(cmp('roc20', S['roc20'], c / c.shift(20) - 1))
kr = ta.momentum.KAMAIndicator(c, 10, 2, 30).kama(); res.append(cmp('kama', S['kama'], kr, tol=1e-2, skip=200))
# ADX (Wilder) via ta
adx = {n: ta.trend.ADXIndicator(h, l, c, n).adx() for n in (14, 20)}
for n in (14, 20): res.append(cmp(f'adx{n}', S[f'adx{n}'], adx[n], tol=2e-2, skip=n * 10))
# engine.js functions evaluated at sample points
E = J['eng']; pts = E['pts']; ref = {'rsi14': ta.momentum.RSIIndicator(c, 14).rsi(), 'atr14': ta.volatility.AverageTrueRange(h, l, c, 14).average_true_range(), 'ema20': ta.trend.EMAIndicator(c, 20).ema_indicator(), 'ema50': ta.trend.EMAIndicator(c, 50).ema_indicator()}
for k in ('rsi14', 'atr14', 'ema20', 'ema50'):
    res.append(cmp('engine.' + k, [E[k][i] for i in range(len(pts))], [ref[k].iloc[p] for p in pts], tol=5e-3))
print(f"\n{sum(1 for r in res if r)}/{len([r for r in res if r is not None])} indicators match the reference")
