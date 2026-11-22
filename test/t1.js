const PB = require('../engine.js');
function run(seed, adaptive, ticks, cfg) {
  const b = PB.createBot({ seed, cfg: Object.assign({ adaptive }, cfg || {}), now: () => 1e12 });
  b.step(ticks);
  return b;
}
// 1. determinism
const a1 = run(42, true, 6000), a2 = run(42, true, 6000);
console.log('deterministic:', JSON.stringify(a1.metrics()) === JSON.stringify(a2.metrics()));
// 2. accounting identity + NaN
let bad = 0;
for (let s = 1; s <= 20; s++) {
  const b = run(s, true, 8000);
  const m = b.metrics();
  const id = Math.abs(m.equity - (20 + m.realized + m.unrealized));
  if (id > 1e-6 || [m.equity, m.cash, m.maxDD].some(x => !isFinite(x))) { bad++; console.log('BAD', s, id, m); }
  if (b.state.cash < -1e-9) { bad++; console.log('negative cash', s, b.state.cash); }
}
console.log('identity/NaN failures:', bad);
const m = a1.metrics(), l = a1.learning();
console.log(JSON.stringify(m, null, 0));
console.log('arms', l.arms.map(x => `${x.key}:${x.mode}:n${x.n}:${x.mean.toFixed(2)}`).join(' | '));
console.log('model', l.model, 'opt', l.optimizer.runs, l.optimizer.last, l.params);
console.log(a1.state.log.slice(-12).map(x => `[${x.agent}] ${x.msg}`).join('\n'));
