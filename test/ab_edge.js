const PB = require('../engine.js');
const N=40,T=12000;
for (const dm of [0.0004,0.0008]) {
  const res={static:[],adaptive:[]},tr={static:[],adaptive:[]};
  for(let s=1;s<=N;s++) for(const mode of ['static','adaptive']){
    const b=PB.createBot({seed:s*104729,cfg:{adaptive:mode==='adaptive',driftMag:dm},now:()=>1e12});
    b.step(T);const m=b.metrics();res[mode].push(m.totalPnl);tr[mode].push(m.trades);
  }
  const f=a=>(a.reduce((x,y)=>x+y,0)/a.length);
  console.log('driftMag',dm,'| static',f(res.static).toFixed(2),'trades',f(tr.static).toFixed(0),'| adaptive',f(res.adaptive).toFixed(2),'trades',f(tr.adaptive).toFixed(0),'| %profitable s/a',(res.static.filter(x=>x>0).length/N*100).toFixed(0),(res.adaptive.filter(x=>x>0).length/N*100).toFixed(0));
}
