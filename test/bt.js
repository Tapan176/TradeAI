const PB=require('../engine.js'), {align}=require('./load.js');
const NAMES=(process.env.SYMS||'niftybees,bankbees,goldbees').split(',');
function run(bars,dates,cfgx,label){
  const H=+process.env.H||260, hist={}; NAMES.forEach(n=>hist[n]=bars.slice(0,H).map(b=>b[n]));
  const cfg=Object.assign({currency:'₹',integerQty:true,startBalance:100000,feeRate:0.0005,slippage:0.0005,symbols:NAMES.map(id=>({id,price:1,vol:0.01})),maxCandles:600,maxPositions:3,maxPositionPct:0.34,sizePct:0.3},cfgx);
  const b=PB.createBot({seed:1,cfg,history:hist,now:()=>0});
  for(let i=H;i<bars.length;i++){const cm={};NAMES.forEach(n=>cm[n]=bars[i][n]);b.stepCandle(cm);}
  const m=b.metrics(), yrs=(bars.length-H)/248;
  const bh=bars[bars.length-1][NAMES[0]].c/bars[H][NAMES[0]].o-1;
  return {label,from:dates[H],to:dates[dates.length-1],ret:m.totalPnlPct,cagr:Math.pow(1+m.totalPnlPct,1/yrs)-1,maxDD:m.maxDD,trades:m.trades,win:m.winRate,pf:m.profitFactor,exp:m.expectancy,fees:m.fees,bh,bhCagr:Math.pow(1+bh,1/yrs)-1,b};
}
const f=x=>(x*100).toFixed(1)+'%';
function show(r){console.log(r.label.padEnd(10),r.from,'→',r.to,'| bot',f(r.ret),'CAGR',f(r.cagr),'maxDD',f(r.maxDD),'trades',r.trades,'win',f(r.win),'PF',r.pf.toFixed(2),'| buy&hold '+NAMES[0],f(r.bh),'CAGR',f(r.bhCagr))}
module.exports={run,show,NAMES};
if(require.main===module){
  const A=align(NAMES);
  const iT=A.dates.findIndex(d=>d>='2019-01-01');
  const sets={etf_core_donchian:['core','donchian55']};
  for(const [sn,en] of Object.entries(sets)) for(const [nm,a,z] of [['DESIGN 07-18',0,iT],['TEST 19-26',iT-260,A.dates.length]]) for(const ad of [false,true]){
    const r=run(A.bars.slice(a,z),A.dates.slice(a,z),{adaptive:ad,enabled:en},sn+' '+(ad?'ADA ':'sta ')+nm);show(r);
  }
}
