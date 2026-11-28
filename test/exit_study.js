// Pre-registered exit/cap study for the daily index book (trendvote). 6 variants, 3 windows, 1x and 2x costs, learning on and off.
const PB=require('../server/engine.js'),R=require('./research.js');
const U=R.build(),names=U.names;
const V=[
 ['V0 current',{}],
 ['V1 cap60',{maxInvestedPct:0.6}],
 ['V2 BE2+trail3',{beAtr:2,trailOverride:3,trailStartAtr:2}],
 ['V3 V2+time10',{beAtr:2,trailOverride:3,trailStartAtr:2,timeStopCandles:10,timeStopMinR:0.5}],
 ['V4 V3+cap60',{beAtr:2,trailOverride:3,trailStartAtr:2,timeStopCandles:10,timeStopMinR:0.5,maxInvestedPct:0.6}],
 ['V5 trail5',{trailOverride:5}]
];
function go(from,to,over){
  const H=260,hist={};names.forEach((n,k)=>hist[n]=U.C[k].slice(from-H,from).map(c=>({o:c,h:c,l:c,c})));
  const cfg=Object.assign({},PB.PRESETS.indices,{symbols:names.map(id=>({id,price:1,vol:0.01})),enabled:['trendvote']},over);
  const b=PB.createBot({seed:1,cfg,history:hist,now:()=>0});
  for(let i=from;i<to;i++){const cm={};names.forEach((n,k)=>{const c=U.C[k][i];cm[n]={o:c,h:c,l:c,c}});b.stepCandle(cm)}
  const m=b.metrics(),yrs=(to-from)/252,t=b.state?b.state.trades:null;
  return {cagr:Math.pow(1+m.totalPnlPct,1/yrs)-1,dd:m.maxDD,trades:m.trades,pf:m.profitFactor,win:m.winRate,cash:b.snapshot?undefined:undefined};
}
const iT=U.dates.findIndex(d=>d>='2019-01-01');
const W=[['2013-26',260,U.dates.length],['2013-18',260,iT],['2019-26',iT,U.dates.length]];
const vi=+process.argv[2];const [vn,vo]=V[vi];
const out=[];
for(const adaptive of [false,true]) for(const cost of [1,2]) for(const [wn,a,z] of W){
  const over=Object.assign({adaptive,feeRate:0.0005*cost,slippage:0.0005*cost},vo);
  const r=go(a,z,over);
  out.push({v:vn,adaptive,cost,w:wn,cagr:+(r.cagr*100).toFixed(2),dd:+(r.dd*100).toFixed(1),trades:r.trades,pf:+(r.pf||0).toFixed(2),win:+((r.win||0)*100).toFixed(0)});
}
require('fs').writeFileSync('/tmp/exit_'+vi+'.json',JSON.stringify(out));
console.log('done',vn);
