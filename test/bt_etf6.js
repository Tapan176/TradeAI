const PB=require('../engine.js'),{align}=require('./load.js');
const NAMES=['niftybees','juniorbees','bankbees','itbees','psubnkbees','goldbees'];
const A=align(NAMES);console.log('aligned',A.dates[0],A.dates.at(-1),A.dates.length);
const H=260;
for(const ad of [false,true]){
  const hist={};NAMES.forEach(n=>hist[n.toUpperCase()]=A.bars.slice(0,H).map(b=>b[n]));
  const cfg=Object.assign({},PB.PRESETS.india,{adaptive:ad,startBalance:100000,integerQty:true,symbols:NAMES.map(n=>({id:n.toUpperCase(),price:1,vol:.01}))});
  const b=PB.createBot({seed:1,cfg,history:hist,now:()=>0});
  for(let i=H;i<A.bars.length;i++){const cm={};NAMES.forEach(n=>cm[n.toUpperCase()]=A.bars[i][n]);b.stepCandle(cm)}
  const m=b.metrics(),yrs=(A.bars.length-H)/252,bh=A.bars.at(-1).niftybees.c/A.bars[H].niftybees.o;
  console.log(ad?'learning ON ':'learning OFF','CAGR',((Math.pow(1+m.totalPnlPct,1/yrs)-1)*100).toFixed(1)+'%','maxDD',(m.maxDD*100).toFixed(1)+'%','trades',m.trades,'PF',m.profitFactor.toFixed(2),'| hold NIFTYBEES CAGR',((Math.pow(bh,1/yrs)-1)*100).toFixed(1)+'%', A.dates[H],'→',A.dates.at(-1));
}
