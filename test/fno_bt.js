// Synthetic F&O backtest: real Nifty/BankNifty daily OHLC + real India VIX history; option prices MODELED (Black-Scholes at VIX, skew approx).
const fs=require('fs'),path=require('path');
const F=require('../server/fno.js');
const load=f=>{const rows=fs.readFileSync(path.join(__dirname,'../data/idx',f),'utf8').trim().split('\n').slice(1).map(l=>l.split(','));const o={};rows.forEach(r=>{if(+r[4]>0)o[r[0]]={o:+r[1],h:+r[2],l:+r[3],c:+r[4]}});return o};
const NIF=load('nifty_50.csv'),BNK=load('nifty_bank.csv'),VIX=load('india_vix.csv');
const dates=Object.keys(VIX).filter(d=>NIF[d]&&BNK[d]).sort();
function run(enabled,opts){opts=opts||{};const from=opts.from||'2015-06-01',to=opts.to||'2026-11-13';
  const all=Object.keys(NIF).filter(d=>BNK[d]).sort(); const pre=all.filter(d=>d<from).slice(-300);
  const hist={NIFTY:pre.map(d=>NIF[d]),BANKNIFTY:pre.map(d=>BNK[d])};
  const bot=F.create({quiet:true,cfg:{enabled,adaptive:opts.adaptive!==false,underlyings:opts.und||['NIFTY','BANKNIFTY'],startBalance:1000000},history:hist,vixHist:pre.map(d=>VIX[d]?VIX[d].c:15)});
  const ds=dates.filter(d=>d>=from&&d<=to);let eq0=1e6,peak=1e6,mdd=0,vals=[];
  for(const d of ds){bot.step({date:d,spot:{NIFTY:NIF[d].c,BANKNIFTY:BNK[d].c},vix:VIX[d].c,newDay:true});const e=bot.equity();vals.push(e);peak=Math.max(peak,e);mdd=Math.max(mdd,(peak-e)/peak)}
  bot.closeAll('end');const m=bot.metrics(),yrs=ds.length/252,cagr=Math.pow(m.equity/1e6,1/yrs)-1;
  return {cagr,mdd,trades:m.trades,win:m.winRate,pf:m.profitFactor,pnl:m.totalPnl,fees:m.fees,seg:bot.segmentStats(),bot};
}
module.exports={run,dates};
if(require.main===module){
  const f=(x)=>(x*100).toFixed(1)+'%';
  const strats=['fut_trend','long_call','long_put','bull_call_spread','bear_put_spread','iron_condor'];
  console.log('strategy            CAGR    maxDD  trades win   PF   fees(₹)   [learning OFF, NIFTY+BANKNIFTY, 2015-06→2026-11, ₹10L]');
  for(const s of strats){const r=run([s],{adaptive:false});console.log(s.padEnd(19),f(r.cagr).padStart(6),f(r.mdd).padStart(7),String(r.trades).padStart(6),f(r.win).padStart(6),r.pf.toFixed(2).padStart(5),Math.round(r.fees).toString().padStart(9))}
  for(const [nm,en] of [['combo (default 4)',['fut_trend','bull_call_spread','bear_put_spread','iron_condor']],['all 6',strats]]){for(const ad of [false,true]){const r=run(en,{adaptive:ad});console.log((nm+(ad?' +learn':'')).padEnd(26),f(r.cagr).padStart(6),f(r.mdd).padStart(7),String(r.trades).padStart(6),f(r.win).padStart(6),r.pf.toFixed(2).padStart(5))}}
}
