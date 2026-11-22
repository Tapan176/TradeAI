// Research harness: daily, long-only, no leverage, signals at close t -> return of t+1 (no lookahead).
const fs=require('fs'),path=require('path');
const DIR=path.join(__dirname,'../data/idx');
const COST=0.001;          // per side per unit turnover (fee+slippage), ~0.20% round trip
const CASH_Y=0.05/252;     // liquid-fund style yield on uninvested cash
function loadAll(){
  const m={};
  fs.readdirSync(DIR).filter(f=>f.endsWith('.csv')).forEach(f=>{
    const name=f.slice(0,-4);if(/vix/.test(name))return;
    const rows=fs.readFileSync(path.join(DIR,f),'utf8').trim().split('\n').slice(1).map(l=>l.split(','));
    const d={};rows.forEach(r=>{const c=+r[4];if(c>0)d[r[0]]={o:+r[1],h:+r[2],l:+r[3],c,pe:+r[6]||null}});
    m[name]=d;
  });
  return m;
}
function build(minRows=3600){
  const all=loadAll();
  const names=Object.keys(all).filter(n=>Object.keys(all[n]).length>=minRows).sort();
  let dates=Object.keys(all[names[0]]).filter(d=>names.every(n=>all[n][d])).sort();
  const C=names.map(n=>dates.map(d=>all[n][d].c));
  const PE=names.map(n=>dates.map(d=>all[n][d].pe));
  const Hh=names.map(n=>dates.map(d=>all[n][d].h)), Ll=names.map(n=>dates.map(d=>all[n][d].l));
  return {names,dates,C,PE,H:Hh,L:Ll};
}
const sma=(a,i,L)=>{if(i<L-1)return null;let s=0;for(let k=i-L+1;k<=i;k++)s+=a[k];return s/L};
function rsi(a,i,L){if(i<L)return 50;let g=0,l=0;for(let k=i-L+1;k<=i;k++){const d=a[k]-a[k-1];if(d>0)g+=d;else l-=d}return l===0?100:100-100/(1+g/l)}
const ret=(a,i,L)=>i>=L?a[i]/a[i-L]-1:null;
function vol(a,i,L){if(i<L)return null;const r=[];for(let k=i-L+1;k<=i;k++)r.push(a[k]/a[k-1]-1);const m=r.reduce((x,y)=>x+y,0)/L;return Math.sqrt(r.reduce((x,y)=>x+(y-m)**2,0)/L)}

// A strategy = function(ctx, i, prevW) -> target weights array (len N) summing <=1
function makeStrategies(U){
  const {names,C}=U,N=names.length,ix=n=>names.indexOf(n);
  const NIF=ix('nifty_50'),BANK=ix('nifty_bank');
  const MC=ix('nifty_midcap_100');
  const eq=idx=>{const w=new Array(N).fill(0);idx.forEach(k=>w[k]=1/idx.length);return w};
  const zero=()=>new Array(N).fill(0);
  const broad=[NIF,ix('nifty_next_50'),MC,BANK].filter(k=>k>=0);
  const S={};
  S.hold_nifty=(i)=>{const w=zero();w[NIF]=1;return w};
  S.hold_ew_all=(i)=>eq([...Array(N).keys()]);
  S.trend_nifty=(i)=>{const w=zero();const s=sma(C[NIF],i,200);if(s&&C[NIF][i]>s)w[NIF]=1;return w};
  S.trend_ew=(i)=>{const w=zero();let n=0;for(let k=0;k<N;k++){const s=sma(C[k],i,200);if(s&&C[k][i]>s){w[k]=1;n++}}for(let k=0;k<N;k++)w[k]=w[k]/N;return w}; // each index 1/N when above SMA200, rest cash
  S.dual_mom_nifty=(i)=>{const w=zero();const r=ret(C[NIF],i,252);if(r!==null&&r>0)w[NIF]=1;return w};
  let lastRebal=-1,cache=null;
  const monthly=(i,dates)=>{const d=dates[i],nx=dates[i+1];return !nx||d.slice(0,7)!==nx.slice(0,7)};
  S.xs_momentum=(i,prev,U)=>{ // top-5 by 6m return (skip last month), only if above SMA200; monthly
    if(!monthly(i,U.dates))return prev;
    const sc=[];for(let k=0;k<N;k++){const r=i>=147?C[k][i-21]/C[k][i-147]-1:null;const s=sma(C[k],i,200);if(r!==null&&s&&C[k][i]>s)sc.push([r,k])}
    sc.sort((a,b)=>b[0]-a[0]);const top=sc.slice(0,5).map(x=>x[1]);const w=zero();top.forEach(k=>w[k]=1/5);return w};
  S.low_vol_rot=(i,prev,U)=>{ // 5 lowest 60d-vol indices above SMA200; monthly
    if(!monthly(i,U.dates))return prev;
    const sc=[];for(let k=0;k<N;k++){const v=vol(C[k],i,60),s=sma(C[k],i,200);if(v&&s&&C[k][i]>s)sc.push([v,k])}
    sc.sort((a,b)=>a[0]-b[0]);const w=zero();sc.slice(0,5).forEach(x=>w[x[1]]=1/5);return w};
  S.rsi2_nifty=(i,prev)=>{ // buy RSI2<10 in uptrend, exit RSI2>70 or close>5d SMA
    const w=prev.slice();const c=C[NIF],s=sma(c,i,200);if(!s)return zero();
    if(w[NIF]===0){if(c[i]>s&&rsi(c,i,2)<10){const z=zero();z[NIF]=1;return z}return zero()}
    if(rsi(c,i,2)>70||c[i]>sma(c,i,5)*1.0&&rsi(c,i,2)>50)return zero();return prev};
  S.donchian_ew=(i,prev)=>{ // 55-day breakout in, 20-day low out, per index, 1/N slots capped at 20 names
    const w=prev.slice();let held=0;
    for(let k=0;k<N;k++){const c=C[k];if(i<56)continue;
      let hi=-1e18,lo=1e18;for(let j=i-55;j<i;j++)hi=Math.max(hi,c[j]);for(let j=i-20;j<i;j++)lo=Math.min(lo,c[j]);
      if(w[k]>0){if(c[i]<lo)w[k]=0}else if(c[i]>hi)w[k]=1}
    const n=w.filter(x=>x>0).length;if(!n)return zero();return w.map(x=>x>0?Math.min(1/n,0.1):0)};
  S.bank_trend=(i)=>{const w=zero();const s=sma(C[BANK],i,200);if(s&&C[BANK][i]>s)w[BANK]=1;return w};
  return S;
}
function run(U,strat,from,to,opts={}){
  const N=U.names.length;let w=new Array(N).fill(0),eq=1,peak=1,mdd=0,turn=0;const rs=[];
  const wt=new Array(N).fill(0);
  for(let i=Math.max(from,1);i<to;i++){
    // earn today's return on weights decided at close i-1 (w), then decide new weights at close i
    let r=0,inv=0;for(let k=0;k<N;k++)if(w[k]){r+=w[k]*(U.C[k][i]/U.C[k][i-1]-1);inv+=w[k]}
    r+=(1-inv)*CASH_Y;
    const nw=strat(i,w,U);let t=0;for(let k=0;k<N;k++)t+=Math.abs((nw[k]||0)-w[k]);
    r-=t*COST;turn+=t;w=nw.map(x=>x||0);
    eq*=1+r;rs.push(r);peak=Math.max(peak,eq);mdd=Math.max(mdd,(peak-eq)/peak);
  }
  const n=rs.length,m=rs.reduce((a,b)=>a+b,0)/n,sd=Math.sqrt(rs.reduce((a,b)=>a+(b-m)**2,0)/n);
  return {rs,eq,cagr:Math.pow(eq,252/n)-1,vol:sd*Math.sqrt(252),sharpe:(m-CASH_Y)/sd*Math.sqrt(252),mdd,turn:turn/(n/252)};
}
module.exports={build,makeStrategies,run,sma,ret,vol,rsi};
if(require.main===module){
  const U=build();console.log('universe',U.names.length,'indices',U.dates[0],'→',U.dates.at(-1),U.dates.length,'days');
  const S=makeStrategies(U);
  const iT=U.dates.findIndex(d=>d>='2019-01-01');
  const f=x=>(x*100).toFixed(1)+'%';
  const periods=[['FULL 2013-26',210,U.dates.length],['DESIGN 13-18',210,iT],['TEST 19-26',iT,U.dates.length]];
  for(const [pn,a,z] of periods){
    console.log('\n'+pn);
    console.log('strategy'.padEnd(16),'CAGR'.padStart(7),'vol'.padStart(7),'Sharpe'.padStart(7),'maxDD'.padStart(7),'turn/yr'.padStart(8));
    for(const [n,s] of Object.entries(S)){const r=run(U,s,a,z);console.log(n.padEnd(16),f(r.cagr).padStart(7),f(r.vol).padStart(7),r.sharpe.toFixed(2).padStart(7),f(r.mdd).padStart(7),r.turn.toFixed(1).padStart(8))}
  }
}
