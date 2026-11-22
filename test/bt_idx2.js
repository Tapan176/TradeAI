const PB=require('../engine.js'),R=require('./research.js');
const U=R.build();const names=U.names;
function go(from,to,over){
  const H=260;const hist={};names.forEach((n,k)=>hist[n]=U.C[k].slice(from-H,from).map(c=>({o:c,h:c,l:c,c})));
  const cfg=Object.assign({},PB.PRESETS.indices,{symbols:names.map(id=>({id,price:1,vol:0.01}))},over||{});
  const b=PB.createBot({seed:1,cfg,history:hist,now:()=>0});
  for(let i=from;i<to;i++){const cm={};names.forEach((n,k)=>{const c=U.C[k][i];cm[n]={o:c,h:c,l:c,c}});b.stepCandle(cm)}
  const m=b.metrics(),yrs=(to-from)/252;
  return {m,cagr:Math.pow(1+m.totalPnlPct,1/yrs)-1};
}
const iT=U.dates.findIndex(d=>d>='2019-01-01');const f=x=>(x*100).toFixed(1)+'%';
for(const [lab,a,z] of [['2013-26 full',260,U.dates.length],['2013-18',260,iT],['2019-26',iT,U.dates.length]]){
  for(const [vl,ov] of [['trendvote',{enabled:['trendvote']}],['trendvote+LEARN',{enabled:['trendvote'],adaptive:true}],['tv+core+donch',{enabled:['trendvote','core','donchian55']}],['tv+core+don+LEARN',{enabled:['trendvote','core','donchian55'],adaptive:true}]]){
    const r=go(a,z,ov);console.log(lab.padEnd(13),vl.padEnd(14),'CAGR',f(r.cagr).padStart(6),'maxDD',f(r.m.maxDD).padStart(6),'trades',String(r.m.trades).padStart(4),'win',f(r.m.winRate),'PF',r.m.profitFactor.toFixed(2),'exposure~',f(r.m.exposure))}
  const hb=U.C[U.names.indexOf('nifty_50')];console.log(lab.padEnd(13),'hold nifty50   CAGR',f(Math.pow(hb[z-1]/hb[a],252/(z-a))-1));
}
