const R=require('./research.js');
const U=R.build(),S=R.makeStrategies(U),from=210,to=U.dates.length;
const names=['trend_ew','donchian_ew','xs_momentum','low_vol_rot','bank_trend','dual_mom_nifty','trend_nifty','rsi2_nifty'];
const sl={};names.forEach(n=>sl[n]=R.run(U,S[n],from,to).rs);
const hold=R.run(U,S.hold_ew_all,from,to).rs, holdN=R.run(U,S.hold_nifty,from,to).rs;
const T=sl[names[0]].length, dates=U.dates.slice(from+0,to).slice(-T);
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length, sd=a=>{const m=mean(a);return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/a.length)};
const CASHY=0.05/252;
function stats(rs){let eq=1,pk=1,dd=0;rs.forEach(r=>{eq*=1+r;pk=Math.max(pk,eq);dd=Math.max(dd,(pk-eq)/pk)});const n=rs.length;return {cagr:Math.pow(eq,252/n)-1,vol:sd(rs)*Math.sqrt(252),sh:(mean(rs)-CASHY)/sd(rs)*Math.sqrt(252),dd}}
// learner: monthly, weights ∝ max(0, trailing 252d Sharpe lower-bound)  ; LB = sharpe - 1/sqrt(years) (shrink toward 0)
function learner(mode){
  const out=[];let w=null;const W=252;
  for(let t=0;t<T;t++){
    const dnext=dates[t+1],mEnd=!dnext||dates[t].slice(0,7)!==dnext.slice(0,7);
    if(t>=W&&(w===null||mEnd)){
      const sc=names.map(n=>{const a=sl[n].slice(t-W+1,t+1);const s=(mean(a)-CASHY)/(sd(a)||1)*Math.sqrt(252);return Math.max(0,s-0.5)}); // must beat a 0.5 Sharpe-point hurdle (≈ one std. error)
      const tot=sc.reduce((x,y)=>x+y,0);
      if(mode==='best'){const k=sc.indexOf(Math.max(...sc));w=sc.map((_,i)=>i===k&&sc[k]>0?1:0)}
      else w=tot>0?sc.map(x=>x/tot):sc.map(()=>0);
    }
    if(w===null){out.push(null);continue}
    let r=0,inv=0;w.forEach((x,i)=>{r+=x*sl[names[i]][t];inv+=x});r+=(1-inv)*CASHY;out.push(r)
  }
  return out;
}
const eqw=sl[names[0]].map((_,t)=>mean(names.map(n=>sl[n][t])));
const L1=learner('prop'),L2=learner('best');
const iT=dates.findIndex(d=>d>='2019-01-01');
const f=x=>(x*100).toFixed(1)+'%';
function row(lab,rs){const a=rs.slice(252,iT),b=rs.slice(iT);const A=stats(a),B=stats(b),F=stats(rs.slice(252));console.log(lab.padEnd(26),'| 2014-18 CAGR',f(A.cagr),'Sh',A.sh.toFixed(2),'DD',f(A.dd),'| 2019-26 CAGR',f(B.cagr),'Sh',B.sh.toFixed(2),'DD',f(B.dd),'| all Sh',F.sh.toFixed(2))}
row('hold nifty 50',holdN);row('hold EW all indices',hold);
names.forEach(n=>row('sleeve '+n,sl[n]));
row('EW of 8 sleeves',eqw);
row('LEARNER proportional',L1.map(x=>x===null?0:x));
row('LEARNER pick-best',L2.map(x=>x===null?0:x));
const blend=sl.trend_ew.map((_,t)=>0.5*sl.trend_ew[t]+0.5*sl.donchian_ew[t]);
row('BLEND 50/50 trend+donchian',blend);
console.log('universe:',U.names.join(', '));
