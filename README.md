# PaperBot v3 — always-on paper-trading server + installable dashboard

Zero dependencies (Node >= 18). **Paper money only. No profit guarantee.**

## What runs 24/7 on the server (even when no page is open)
| Slot | What it trades | When |
|---|---|---|
| `fno` | **Index futures + options** (NIFTY, BANKNIFTY): futures trend long/short, bull-call / bear-put spreads, iron condor, long call/put. Live NSE option chain when reachable, else modeled (Black-Scholes from live spot + India VIX). Lots: Nifty 65, Bank Nifty 30. | Mon–Fri 09:15–15:30 IST |
| `instocks` | ~70 NSE stocks (Nifty 50 + others), live Yahoo, ₹ | NSE hours |
| `gstocks` | ~85 US-listed stocks incl. global ADRs, live Yahoo, $ | NYSE/Nasdaq hours |
| `nse` | **24 NSE indices, LIVE from NSE's free public index feed** (no key; paper-trades index levels at the ~15:20 IST close) | Mon–Fri 09:15–15:30 IST |
| `india` | 6 NSE ETFs (Nifty 50, Junior, Bank, IT, PSU Bank, Gold), live Yahoo prices | Mon–Fri 09:15–15:30 IST |
| `crypto` | BTC/ETH/SOL… sim on live Coinbase (Kraken fallback) prices | 24/7 |
| `practice` | 24 NSE indices, real history replayed endlessly; learning carries across passes | 24/7 |

Learning is ON by default (`LEARNING=off` to disable). Closing the dashboard does NOT stop the bots; the browser demo mode (artifact) does stop, the server does not.

## Check the live feeds (do this first after deploy)
Open `https://<your-app>/api/feedtest` (also tests the NSE option chain and Yahoo stock quotes) — it calls NSE, Yahoo, Coinbase and Kraken once and shows ok/error for each. The `nse` slot needs only the NSE line to be ok; `india` needs Yahoo; `crypto` needs Coinbase or Kraken.

## Deploy on Render (free)
1. Push this folder to a GitHub repo. Render → New → Blueprint (uses `render.yaml`) or Web Service → Docker.
2. Env: set `SELF_URL` to your `https://<name>.onrender.com` (self-ping keeps it awake; free tier sleeps after ~15 min idle — also add a free UptimeRobot ping on `/healthz`).
3. State persistence: the free disk is ephemeral. Create a free Upstash Redis DB and set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`; otherwise state resets on redeploy/restart.
4. `ADMIN_TOKEN` (auto-generated) protects pause/resume/close-all/reset (sent as `x-admin-token`).

## Install on Android home screen (PWA)
Open your Render `https://…onrender.com` URL in Chrome → ⋮ menu → **Install app** / **Add to Home screen**. It opens full-screen like an app.

## Desktop
`node server.js` then open http://localhost:3000, or use the standalone exe/launcher (see `desktop/`).

## Env vars
FNO_UNDERLYINGS (default NIFTY,BANKNIFTY), START_BALANCE_FNO (default 1000000 — one Nifty lot is ~₹16L notional), INSTOCKS / GSTOCKS (comma lists of tickers), START_BALANCE_INSTOCKS (500000), START_BALANCE_GSTOCKS (20000), STOCKS_POLL_MS (300000), FORCE_EVAL=1 (testing only).
LIVE_WARM=on copies practice learning into the live bots (default off: after a full replay the learner had every trend arm in 'shadow', so a warm-started live bot sat in cash). NSE_POLL_MS (default 30000). FORCE_MARKET_OPEN=1 is for testing only.
PORT, ADMIN_TOKEN, DATA_DIR, UPSTASH_REDIS_REST_URL/TOKEN, SELF_URL, SLOTS, CRYPTO_FEED, GRANULARITY, POLL_MS, PRACTICE_BARS_PER_POLL, START_BALANCE_INDIA, START_BALANCE_CRYPTO, LEARNING.

## Honest caveats
Live Yahoo/Coinbase/Kraken feeds were only mock-tested from the build sandbox. Backtests: trend-vote on Indian indices ≈ buy-and-hold returns with ~half the drawdown; learning ON lowered return (~7% vs ~10% CAGR) for lower drawdown. Winners were chosen after seeing data; indices aren't directly tradable.

## Charts and third-party code
Charts use TradingView Lightweight Charts 5.3.0 (Apache-2.0), vendored at `public/vendor/lightweight-charts.js` with its licence in `public/vendor/LICENSE-lightweight-charts.txt`. Copyright © TradingView, Inc. https://www.tradingview.com/ — the on-chart attribution logo and the footer link must stay.

## Strategy research
`research/factory.js` (run with `PINE=1 node research/factory.js`) tests thousands of strategies plus hand-ported Pine-style ones on 24 NSE indices. Results: `research/factory_results.json`; the dashboard reads `server/replay/strategy_report.json`. `GET /api/strategies` lists what is in use, testing, rejected or available.

## Multi-market research (research/)
- `research/multi.js` – every strategy family on India indices/ETFs/gold, US indices/stocks, crude (results: `multi_results.json`). Needs the NSE CSVs in `data/idx` (not bundled) plus `data/global`.
- `research/indicator_tests.js` + `indicator_ref.py` – indicator audit vs the `ta` library and a no-lookahead test (results: `indicator_audit.json`).
- Slot `macro` = gold, silver, copper, crude, natgas, USD/INR, FX pairs, dollar index, global indices (Yahoo daily bars; edit with env `MACRO`).
