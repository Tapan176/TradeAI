const {res,S,U}=require('./screen.js');
// Ensemble: for each index, vote = share of K trend-family signals that are ON; weight = vote/N (cap) ; designed BEFORE looking at test (all trend-family members, equal vote)
const R=require('./research.js');
const N=U.names.length,T=U.dates.length;
// rebuild per-index signal fns by reusing the strategies: they return EW weights, so extract per-index ON from weights
const members=Object.keys(S).filter(n=>/^(sma_trend_|sma_cross_|ema_cross_|donchian_|tsmom_|macd_zero|supertrend|keltner|atr_trailing)/.test(n));
console.log('members',members.length);
// precompute member weight paths by running each (stateful closures advance in order)
const paths=members.map(n=>{const out=[];let w=new Array(N).fill(0);const fn=S[n];for(let i=0;i<T;i++){out.push(fn(i,w,U).slice())}return out});
const ens=(i)=>{const w=new Array(N).fill(0);for(let k=0;k<N;k++){let v=0;paths.forEach(p=>{if(p[i][k]>0)v++});w[k]=(v/paths.length)/N}return w};
const thr=(lo,hi)=>{let on=new Array(N).fill(false);return (i)=>{const w=new Array(N).fill(0);for(let k=0;k<N;k++){let v=0;paths.forEach(p=>{if(p[i][k]>0)v++});v/=paths.length;if(!on[k]&&v>=hi)on[k]=true;else if(on[k]&&v<=lo)on[k]=false;if(on[k])w[k]=1/N}return w}};
const iT=U.dates.findIndex(d=>d>='2019-01-01'),FROM=260,off=iT-FROM;
function ev(name,fn){const r=R.run(U,fn,FROM,T),rs=r.rs;const part=(a,b)=>{const x=rs.slice(a,b),n=x.length,m=x.reduce((p,q)=>p+q,0)/n,sd=Math.sqrt(x.reduce((p,q)=>p+(q-m)**2,0)/n);let eq=1,pk=1,dd=0;x.forEach(v=>{eq*=1+v;pk=Math.max(pk,eq);dd=Math.max(dd,(pk-eq)/pk)});return [Math.pow(eq,252/n)-1,(m-0.05/252)/sd*Math.sqrt(252),dd]};const a=part(0,off),b=part(off,rs.length);const f=x=>(x*100).toFixed(1)+'%';console.log(name.padEnd(28),'DESIGN CAGR',f(a[0]),'Sh',a[1].toFixed(2),'DD',f(a[2]),'| TEST CAGR',f(b[0]),'Sh',b[1].toFixed(2),'DD',f(b[2]),'| turn',r.turn.toFixed(1))}
ev('ENSEMBLE vote-weighted',ens);ev('ENSEMBLE enter>=.6 exit<=.3',thr(0.3,0.6));ev('ENSEMBLE enter>=.5 exit<=.25',thr(0.25,0.5));
ev('hold nifty50',S.BENCH_hold_nifty50);ev('hold EW',S.BENCH_hold_ew);
