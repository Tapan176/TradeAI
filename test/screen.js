// Screen ~50 public strategies on 24 NSE indices. Textbook parameters only. Select on DESIGN (2013-18), judge on TEST (2019-26).
const R=require('./research.js');
const U=R.build(),N=U.names.length,T=U.dates.length,C=U.C,Hh=U.H,Ll=U.L;
const iT=U.dates.findIndex(d=>d>='2019-01-01'),FROM=260;
// cached indicators
const cache={};
function memo(key,fn){return cache[key]||(cache[key]=fn())}
function SMA(k,L){return memo('sma'+k+'_'+L,()=>{const a=C[k],o=new Array(T).fill(null);let s=0;for(let i=0;i<T;i++){s+=a[i];if(i>=L)s-=a[i-L];if(i>=L-1)o[i]=s/L}return o})}
function EMA(k,L){return memo('ema'+k+'_'+L,()=>{const a=C[k],kk=2/(L+1),o=[a[0]];for(let i=1;i<T;i++)o.push(a[i]*kk+o[i-1]*(1-kk));return o})}
function RSI(k,L){return memo('rsi'+k+'_'+L,()=>{const a=C[k],o=new Array(T).fill(50);let g=0,l=0;for(let i=1;i<T;i++){const d=a[i]-a[i-1];if(i<=L){g+=Math.max(d,0)/L;l+=Math.max(-d,0)/L}else{g=(g*(L-1)+Math.max(d,0))/L;l=(l*(L-1)+Math.max(-d,0))/L}if(i>=L)o[i]=l===0?100:100-100/(1+g/l)}return o})}
function ATR(k,L){return memo('atr'+k+'_'+L,()=>{const o=new Array(T).fill(null);let a=null;for(let i=1;i<T;i++){const tr=Math.max(Hh[k][i]-Ll[k][i],Math.abs(Hh[k][i]-C[k][i-1]),Math.abs(Ll[k][i]-C[k][i-1]));if(i<=L){a=(a||0)+tr/L}else{a=(a*(L-1)+tr)/L}if(i>=L)o[i]=a}return o})}
function HH(k,L){return memo('hh'+k+'_'+L,()=>{const o=new Array(T).fill(null);for(let i=L;i<T;i++){let m=-1e18;for(let j=i-L;j<i;j++)m=Math.max(m,Hh[k][j]);o[i]=m}return o})}
function LL(k,L){return memo('ll'+k+'_'+L,()=>{const o=new Array(T).fill(null);for(let i=L;i<T;i++){let m=1e18;for(let j=i-L;j<i;j++)m=Math.min(m,Ll[k][j]);o[i]=m}return o})}
function STD(k,L){return memo('std'+k+'_'+L,()=>{const a=C[k],o=new Array(T).fill(null);for(let i=L-1;i<T;i++){let s=0,q=0;for(let j=i-L+1;j<=i;j++){s+=a[j];q+=a[j]*a[j]}const m=s/L;o[i]=Math.sqrt(Math.max(q/L-m*m,0))}return o})}
function VOL(k,L){return memo('vol'+k+'_'+L,()=>{const a=C[k],o=new Array(T).fill(null);for(let i=L;i<T;i++){let s=0,q=0;for(let j=i-L+1;j<=i;j++){const r=a[j]/a[j-1]-1;s+=r;q+=r*r}const m=s/L;o[i]=Math.sqrt(Math.max(q/L-m*m,0))}return o})}
const ret=(k,i,L)=>i>=L?C[k][i]/C[k][i-L]-1:null;

// per-index stateless signals: sig(k,i)->bool ; stateful via closure memory (arrays)
function perIndex(signalFactory){ // returns strat: EW over indices with signal on, 1/N each
  const sigs=[];for(let k=0;k<N;k++)sigs.push(signalFactory(k));
  return (i,prev)=>{const w=new Array(N).fill(0);for(let k=0;k<N;k++)if(sigs[k](i))w[k]=1/N;return w}
}
function stateful(entry,exit){ // enter when entry, hold until exit
  return k=>{let on=false,last=-1;return i=>{if(i===last)return on;last=i;if(!on){if(entry(k,i))on=true}else if(exit(k,i))on=false;return on}}
}
const S={};
// 1 SMA trend
[50,100,150,200,250].forEach(L=>S['sma_trend_'+L]=perIndex(k=>i=>{const s=SMA(k,L)[i];return s&&C[k][i]>s}));
// 2 SMA/EMA crossovers
[[20,50],[50,200],[10,30],[50,100],[30,90]].forEach(([f,s])=>S[`sma_cross_${f}_${s}`]=perIndex(k=>i=>{const a=SMA(k,f)[i],b=SMA(k,s)[i];return a&&b&&a>b}));
[[12,26],[9,21],[20,50],[5,20]].forEach(([f,s])=>S[`ema_cross_${f}_${s}`]=perIndex(k=>i=>i>s&&EMA(k,f)[i]>EMA(k,s)[i]));
// 3 Donchian
[[20,10],[55,20],[100,50],[40,20],[30,15]].forEach(([n,m])=>S[`donchian_${n}_${m}`]=perIndex(stateful((k,i)=>HH(k,n)[i]&&C[k][i]>HH(k,n)[i],(k,i)=>LL(k,m)[i]&&C[k][i]<LL(k,m)[i])));
// 4 TSMOM
[21,63,126,189,252].forEach(L=>S['tsmom_'+L]=perIndex(k=>i=>{const r=ret(k,i,L);return r!==null&&r>0}));
// 5 MACD
S.macd_12_26_9=perIndex(k=>{const m=[],sg=[];const e1=EMA(k,12),e2=EMA(k,26);let s=0;for(let i=0;i<T;i++){m.push(e1[i]-e2[i]);s=i?m[i]*0.2+s*0.8:m[0];sg.push(s)}return i=>i>35&&m[i]>sg[i]});
S.macd_zero=perIndex(k=>i=>i>35&&EMA(k,12)[i]>EMA(k,26)[i]);
// 6 Bollinger
S.boll_breakout_20=perIndex(stateful((k,i)=>{const m=SMA(k,20)[i],s=STD(k,20)[i];return m&&C[k][i]>m+2*s},(k,i)=>C[k][i]<SMA(k,20)[i]));
S.boll_revert_20=perIndex(stateful((k,i)=>{const m=SMA(k,20)[i],s=STD(k,20)[i],t=SMA(k,200)[i];return m&&t&&C[k][i]<m-2*s&&C[k][i]>t},(k,i)=>C[k][i]>SMA(k,20)[i]));
// 7 RSI
S.rsi14_revert_uptrend=perIndex(stateful((k,i)=>{const t=SMA(k,200)[i];return t&&C[k][i]>t&&RSI(k,14)[i]<35},(k,i)=>RSI(k,14)[i]>55));
S.rsi2_revert_uptrend=perIndex(stateful((k,i)=>{const t=SMA(k,200)[i];return t&&C[k][i]>t&&RSI(k,2)[i]<10},(k,i)=>RSI(k,2)[i]>70));
S.rsi14_momentum_60=perIndex(k=>i=>RSI(k,14)[i]>60);
S.rsi14_gt50_sma200=perIndex(k=>i=>{const t=SMA(k,200)[i];return t&&C[k][i]>t&&RSI(k,14)[i]>50});
// 8 Keltner / ATR breakout
S.keltner_breakout=perIndex(stateful((k,i)=>{const m=EMA(k,20)[i],a=ATR(k,20)[i];return a&&C[k][i]>m+2*a},(k,i)=>C[k][i]<EMA(k,20)[i]));
S.atr_trailing_3=perIndex(k=>{let on=false,hi=0,last=-1;return i=>{if(i===last)return on;last=i;const a=ATR(k,14)[i];if(!a)return false;if(!on){if(HH(k,55)[i]&&C[k][i]>HH(k,55)[i]){on=true;hi=C[k][i]}}else{hi=Math.max(hi,C[k][i]);if(C[k][i]<hi-3*a)on=false}return on}});
// 9 Supertrend-lite (ATR band flip)
S.supertrend_10_3=perIndex(k=>{let dir=0,fub=null,flb=null,last=-1;return i=>{if(i===last)return dir>0;last=i;const a=ATR(k,10)[i];if(!a)return false;const hl2=(Hh[k][i]+Ll[k][i])/2,ub=hl2+3*a,lb=hl2-3*a;fub=(fub===null||ub<fub||C[k][i-1]>fub)?ub:fub;flb=(flb===null||lb>flb||C[k][i-1]<flb)?lb:flb;if(dir<=0&&C[k][i]>fub)dir=1;else if(dir>=0&&C[k][i]<flb)dir=-1;return dir>0}});
// 10 ADX-lite: trend strength via 14d directional efficiency
S.efficiency_trend=perIndex(k=>i=>{if(i<30)return false;const net=Math.abs(C[k][i]-C[k][i-20]);let p=0;for(let j=i-19;j<=i;j++)p+=Math.abs(C[k][j]-C[k][j-1]);return C[k][i]>C[k][i-20]&&net/p>0.3});
// 11 52-week high proximity
[0.9,0.95].forEach(x=>S['near_52wk_high_'+x]=perIndex(k=>i=>{if(i<252)return false;let m=0;for(let j=i-251;j<=i;j++)m=Math.max(m,C[k][j]);return C[k][i]>=x*m}));
// 12 vol filter variants
S.sma200_lowvol=perIndex(k=>i=>{const s=SMA(k,200)[i],v1=VOL(k,20)[i],v2=VOL(k,100)[i];return s&&v1&&C[k][i]>s&&v1<v2*1.2});
S.sma200_and_tsmom126=perIndex(k=>i=>{const s=SMA(k,200)[i],r=ret(k,i,126);return s&&r!==null&&C[k][i]>s&&r>0});
// 13 calendar: turn of month (market level, Nifty 50 + EW)
const dates=U.dates;
S.turn_of_month=(i)=>{const w=new Array(N).fill(0);const d=dates[i],mo=d.slice(0,7);let idxInMonth=0,left=0;for(let j=i;j>=0&&dates[j].slice(0,7)===mo;j--)idxInMonth++;for(let j=i;j<T&&dates[j].slice(0,7)===mo;j++)left++;const on=idxInMonth<=3||left<=2;if(on)for(let k=0;k<N;k++)w[k]=1/N;return w};
// 14 cross-sectional rotation (monthly)
const mEnd=i=>{const n=dates[i+1];return !n||dates[i].slice(0,7)!==n.slice(0,7)};
function rot(scoreFn,K,filter200){let held=new Array(N).fill(0);return (i)=>{if(!mEnd(i))return held;const sc=[];for(let k=0;k<N;k++){const s=scoreFn(k,i);if(s===null)continue;if(filter200){const m=SMA(k,200)[i];if(!m||C[k][i]<=m)continue}sc.push([s,k])}sc.sort((a,b)=>b[0]-a[0]);const w=new Array(N).fill(0);sc.slice(0,K).forEach(x=>w[x[1]]=1/K);held=w;return w}}
[[63,3],[126,3],[126,5],[252,5],[252,3],[126,8]].forEach(([L,K])=>{S[`xs_mom_${L}_top${K}`]=rot((k,i)=>ret(k,i,L),K,false);S[`xs_mom_${L}_top${K}_sma200`]=rot((k,i)=>ret(k,i,L),K,true)});
S.xs_lowvol_top5_sma200=rot((k,i)=>{const v=VOL(k,60)[i];return v===null?null:-v},5,true);
S.xs_reversal_21_top5=rot((k,i)=>{const r=ret(k,i,21);const m=SMA(k,200)[i];return r===null||!m||C[k][i]<m?null:-r},5,false);
// benchmarks
S.BENCH_hold_nifty50=(i)=>{const w=new Array(N).fill(0);w[U.names.indexOf('nifty_50')]=1;return w};
S.BENCH_hold_ew=(i)=>new Array(N).fill(1/N);

// evaluate
const res=[];
for(const [name,fn] of Object.entries(S)){
  // fresh closures need new instance per run: rebuild via fn already created; run once over FROM..T so state evolves in order
  const r=R.run(U,fn,FROM,T);
  const rs=r.rs,off=iT-FROM; // run index offset
  const part=(a,b)=>{const x=rs.slice(a,b);const n=x.length,m=x.reduce((p,q)=>p+q,0)/n,sd=Math.sqrt(x.reduce((p,q)=>p+(q-m)**2,0)/n);let eq=1,pk=1,dd=0;x.forEach(v=>{eq*=1+v;pk=Math.max(pk,eq);dd=Math.max(dd,(pk-eq)/pk)});return {cagr:Math.pow(eq,252/n)-1,sh:(m-0.05/252)/sd*Math.sqrt(252),dd,n}};
  res.push({name,design:part(0,off),test:part(off,rs.length),all:part(0,rs.length),turn:r.turn});
}
module.exports={res,S,U};
if(require.main===module){
  const f=x=>(x*100).toFixed(1)+'%';
  const strat=res.filter(r=>!r.name.startsWith('BENCH'));
  const M=strat.length;
  // rank correlation design vs test Sharpe
  const rank=a=>{const idx=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]);const r=[];idx.forEach((p,k)=>r[p[1]]=k);return r};
  const rd=rank(strat.map(r=>r.design.sh)),rt=rank(strat.map(r=>r.test.sh));
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  const md=mean(rd),mt=mean(rt);const corr=rd.reduce((s,_,i)=>s+(rd[i]-md)*(rt[i]-mt),0)/Math.sqrt(rd.reduce((s,x)=>s+(x-md)**2,0)*rt.reduce((s,x)=>s+(x-mt)**2,0));
  console.log('strategies tested:',M,'| rank-correlation design→test Sharpe:',corr.toFixed(2));
  const top=[...strat].sort((a,b)=>b.design.sh-a.design.sh).slice(0,10);
  console.log('avg TEST Sharpe of ALL strategies',mean(strat.map(r=>r.test.sh)).toFixed(2),'| of TOP-10 by DESIGN Sharpe',mean(top.map(r=>r.test.sh)).toFixed(2));
  const bn=res.find(r=>r.name==='BENCH_hold_nifty50'),be=res.find(r=>r.name==='BENCH_hold_ew');
  console.log('\nBENCH hold nifty50 design',bn.design.sh.toFixed(2),f(bn.design.cagr),f(bn.design.dd),'| test',bn.test.sh.toFixed(2),f(bn.test.cagr),f(bn.test.dd));
  console.log('BENCH hold EW      design',be.design.sh.toFixed(2),f(be.design.cagr),f(be.design.dd),'| test',be.test.sh.toFixed(2),f(be.test.cagr),f(be.test.dd));
  console.log('\nname'.padEnd(32),'DESIGN Sh  CAGR  maxDD  |  TEST Sh  CAGR  maxDD | turn');
  [...strat].sort((a,b)=>(b.design.sh+b.test.sh)-(a.design.sh+a.test.sh)).forEach(r=>console.log(r.name.padEnd(30),r.design.sh.toFixed(2).padStart(6),f(r.design.cagr).padStart(7),f(r.design.dd).padStart(7),'|',r.test.sh.toFixed(2).padStart(6),f(r.test.cagr).padStart(7),f(r.test.dd).padStart(7),'|',r.turn.toFixed(1).padStart(5)));
  // deflated-sharpe style threshold: expected max Sharpe of M null trials
  const sds=Math.sqrt(strat.reduce((s,r)=>s+(r.all.sh-mean(strat.map(x=>x.all.sh)))**2,0)/M);
  const invN=p=>{const a=[-39.69683028665376,220.9460984245005,-275.9285104469687,138.357751867269,-30.66479806614716,2.506628277459239],b=[-54.47609879822406,161.5858368580409,-155.6989798598506,66.80131188771625,-13.28068155288572],c=[-0.007784894002430293,-0.3223964580411365,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783],d=[0.007784695709041462,0.3224671290700398,2.445134137142996,3.754408661907416];const pl=0.02425;let q,r;if(p<pl){q=Math.sqrt(-2*Math.log(p));return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}if(p>1-pl){q=Math.sqrt(-2*Math.log(1-p));return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}q=p-0.5;r=q*q;return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)};
  const g=0.5772156649,emax=sds*((1-g)*invN(1-1/M)+g*invN(1-1/(M*Math.E)));
  console.log('\nCross-sectional Sharpe dispersion',sds.toFixed(2),'→ expected best-of-'+M+' Sharpe from luck alone ≈',emax.toFixed(2),'above the average');
}
