const PB = require('../engine.js');
const N = +process.argv[2] || 60, T = +process.argv[3] || 12000;
function stats(a){const m=a.reduce((x,y)=>x+y,0)/a.length;const sd=Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/a.length);return {m,sd,se:sd/Math.sqrt(a.length),med:[...a].sort((x,y)=>x-y)[a.length>>1]}}
const out={static:[],adaptive:[]}, tr={static:[],adaptive:[]}, dd={static:[],adaptive:[]};
const t0=Date.now();
for(let s=1;s<=N;s++){
  for(const mode of ['static','adaptive']){
    const b=PB.createBot({seed:s*7919,cfg:{adaptive:mode==='adaptive'},now:()=>1e12});
    b.step(T); const m=b.metrics();
    out[mode].push(m.totalPnl); tr[mode].push(m.trades); dd[mode].push(m.maxDD);
  }
}
for(const k of ['static','adaptive']){
  const s=stats(out[k]);
  console.log(k.padEnd(9),'meanPnL',s.m.toFixed(3),'±',s.se.toFixed(3),'median',s.med.toFixed(3),'trades',stats(tr[k]).m.toFixed(1),'maxDD',(stats(dd[k]).m*100).toFixed(1)+'%','%profitable',(out[k].filter(x=>x>0).length/N*100).toFixed(0)+'%');
}
const diff=out.adaptive.map((x,i)=>x-out.static[i]);const d=stats(diff);
console.log('paired diff (adaptive-static)',d.m.toFixed(3),'±',d.se.toFixed(3),'t=',(d.m/d.se).toFixed(2),'secs',((Date.now()-t0)/1000).toFixed(1));
