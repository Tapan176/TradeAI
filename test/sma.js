const {align}=require('./load.js');
function sim(bars,name,L,cost,band){
  let pos=0,eq=1,peak=1,mdd=0,trades=0,hist=[];const closes=[];
  for(let i=0;i<bars.length;i++){
    const c=bars[i][name].c;closes.push(c);
    if(i>0){const r=c/closes[i-2<0?0:i-1]-1; if(pos)eq*=1+r; }
    if(i>=L){const sma=closes.slice(i-L+1,i+1).reduce((a,b)=>a+b,0)/L;
      if(!pos&&c>sma*(1+band)){pos=1;eq*=1-cost;trades++}
      else if(pos&&c<sma*(1-band)){pos=0;eq*=1-cost;trades++}}
    peak=Math.max(peak,eq);mdd=Math.max(mdd,(peak-eq)/peak);
  }
  return {eq,mdd,trades};
}
function bh(bars,name){let eq=1,peak=1,mdd=0;for(let i=1;i<bars.length;i++){eq*=bars[i][name].c/bars[i-1][name].c;peak=Math.max(peak,eq);mdd=Math.max(mdd,(peak-eq)/peak)}return {eq,mdd}}
const f=x=>(x*100).toFixed(1)+'%';
for(const name of ['niftybees','bankbees']){
  const A=align([name]);const iT=A.dates.findIndex(d=>d>='2019-01-01');
  for(const [lab,a,z] of [['2007-26 full',200,A.dates.length],['07-18 design',200,iT],['19-26 test',iT-200,A.dates.length]]){
    const b=A.bars.slice(a,z),yrs=(b.length-200)/248;
    const s=sim(b,name,200,0.002,0.0),h=bh(b.slice(200),name);
    console.log(name.padEnd(10),lab.padEnd(13),'SMA200 CAGR',f(Math.pow(s.eq,1/yrs)-1),'maxDD',f(s.mdd),'trades',s.trades,'| hold CAGR',f(Math.pow(h.eq,1/yrs)-1),'maxDD',f(h.mdd));
  }
}
