/* ===== PRO layer (server mode): Today tab, Backtest tab, command palette, hash routing, mobile bottom nav, tooltips, toasts, trade drawer ===== */
var PRO={feeds:null,feedsAt:0,feedsBusy:false,bt:null,btAt:0,btBusy:false,btFull:null,btFullAt:0,book:'IN',sort:'oosExp',dir:-1,strat:'all',gate:'all',minN:15,show:25,pin:null,toast:[],pal:{open:false,q:'',i:0},more:false};
var STRATN={rule:'Live rule (EMA/ADX/RSI)',rule_f:'Rule + strict filters',donch:'Donchian breakout',rsi2:'RSI(2) pullback',orb:'Opening-range breakout'};
var STRATC={rule:'#0072B2',rule_f:'#E69F00',donch:'#009E73',rsi2:'#CC79A7',orb:'#56B4E9'};
var POS='#2a78d6',NEG='#eb6834';   /* polarity (diverging) pair: blue = positive, orange = negative; never red/green, which are reserved for status */
var TIPS={R:'R = profit measured in units of the amount risked. A stop-out is about −1R before costs; a full target at 2.5/1.5 is about +1.67R.',expectancy:'Expectancy = average net R per trade after fees and slippage. Positive means the system makes money per trade on average.',hit:'Hit rate = share of trades that ended in profit. It only matters together with the reward-to-risk ratio.',pf:'Profit factor = gross profit divided by gross loss. Above 1 is profitable, below 1 loses.',oos:'Out of sample: trades after the 60% point of the timeline. Variants were ranked on the first 60% only, so this tail is the honest test.',t:'t-stat = mean R divided by its standard error. Around 2 or more means unlikely to be luck for ONE test; with hundreds of variants tested you want more.',cost:'Cost in R = round-trip fees + slippage divided by the stop distance. 0.5R means every trade starts half a stop-loss in the hole.',gate:'Cost gate: skip an entry when its round-trip cost is above 0.2R.',dd:'Drawdown = largest peak-to-trough fall of the equity curve.'};
function tip(k,label){return '<span class="tip2" tabindex="0" data-tip="'+esc(TIPS[k]||'')+'">'+(label||k)+'</span>'}
function jf(u,o){return fetch(u,o||{cache:'no-store'}).then(function(r){return r.json()})}
function num(x,d){return x==null?'–':(+x).toLocaleString('en-IN',{maximumFractionDigits:d==null?0:d,minimumFractionDigits:d==null?0:d})}
function rfmt(x,d){return x==null?'–':(x>0?'+':x<0?'−':'')+Math.abs(x).toFixed(d==null?2:d)+'R'}
function rcls(x){return x==null?'':x>0?'pos2':x<0?'neg2':''}
function say(msg,kind){PRO.toast.push({m:msg,k:kind||'',t:Date.now()});var el=$('#toasts');if(!el)return;el.innerHTML=PRO.toast.slice(-3).map(function(t){return '<div class="toast '+t.k+'">'+esc(t.m)+'</div>'}).join('');setTimeout(function(){PRO.toast=PRO.toast.filter(function(t){return Date.now()-t.t<3800});var e2=$('#toasts');if(e2)e2.innerHTML=PRO.toast.map(function(t){return '<div class="toast '+t.k+'">'+esc(t.m)+'</div>'}).join('')},4000)}

/* ---------- styles ---------- */
(function(){var s=document.createElement('style');s.textContent=[
'@media(min-width:1000px){.wrap{max-width:1140px}}',
'.g2{display:grid;gap:10px}@media(min-width:900px){.g2{grid-template-columns:1fr 1fr}.g2 .full{grid-column:1/-1}.g3{grid-template-columns:repeat(3,1fr)}}',
'.g3{display:grid;gap:10px;grid-template-columns:1fr 1fr}@media(min-width:900px){.g3{grid-template-columns:repeat(3,1fr)}}',
'.kpi{border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--card)}.kpi .v{font-size:21px;font-weight:650;font-variant-numeric:tabular-nums;line-height:1.2}.kpi .l{font-size:11px;color:var(--ink2);text-transform:uppercase;letter-spacing:.4px}.kpi .s{font-size:12px;color:var(--ink2);margin-top:2px}',
'.pos2{color:'+POS+'}.neg2{color:'+NEG+'}',
'.tip2{border-bottom:1px dotted var(--mut);cursor:help;position:relative}.tip2:hover::after,.tip2:focus::after{content:attr(data-tip);position:absolute;left:0;top:130%;z-index:30;width:260px;max-width:70vw;white-space:normal;background:var(--ink);color:var(--bg);padding:7px 9px;border-radius:8px;font-size:12px;font-weight:400;line-height:1.4;text-transform:none;letter-spacing:0;box-shadow:0 4px 18px rgba(0,0,0,.3)}',
'.slotc{display:block;width:100%;text-align:left;border:1px solid var(--line);border-radius:12px;background:var(--card);padding:10px 12px;cursor:pointer;min-height:0}.slotc:hover{border-color:var(--ink2)}.slotc .t{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.slotc .n{font-weight:650}.slotc .f{font-size:12px;color:var(--ink2);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.pill2{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:650;border-radius:999px;padding:1px 8px;border:1px solid var(--line);background:var(--chip)}',
'.hrow{display:flex;gap:9px;align-items:flex-start;padding:7px 0;border-top:1px solid var(--line);font-size:13px}.hrow:first-of-type{border-top:0}.hrow .d{flex:0 0 auto;margin-top:5px}.hrow .x{flex:1}.hrow .h{color:var(--ink2);font-size:12px}',
'.meter{height:10px;border-radius:5px;background:var(--grid);overflow:hidden;display:flex}.meter i{display:block;height:100%}',
'.prog{height:6px;border-radius:3px;background:var(--grid);overflow:hidden}.prog i{display:block;height:100%;background:'+POS+';transition:width .4s}',
'.skel{background:linear-gradient(90deg,var(--grid),var(--chip),var(--grid));background-size:200% 100%;animation:sk 1.2s infinite;border-radius:8px;min-height:14px}@keyframes sk{to{background-position:-200% 0}}',
'#toasts{position:fixed;left:50%;transform:translateX(-50%);bottom:84px;z-index:60;display:flex;flex-direction:column;gap:6px;align-items:center;pointer-events:none}.toast{background:var(--ink);color:var(--bg);padding:8px 14px;border-radius:999px;font-size:13px;box-shadow:0 4px 18px rgba(0,0,0,.3)}.toast.bad{background:#b3261e;color:#fff}',
'#pal{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:70;display:none;align-items:flex-start;justify-content:center;padding-top:12vh}#pal.on{display:flex}#pal .box{width:min(560px,92vw);background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:0 12px 50px rgba(0,0,0,.45);overflow:hidden}#pal input{width:100%;border:0;border-bottom:1px solid var(--line);padding:14px 16px;font-size:16px;background:transparent;color:var(--ink);outline:none;font-family:inherit}#pal .li{max-height:46vh;overflow:auto}#pal .it{display:flex;justify-content:space-between;gap:10px;padding:9px 16px;cursor:pointer;font-size:14px}#pal .it.on{background:var(--chip)}#pal .it small{color:var(--mut)}',
'#drw{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:65;display:none}#drw.on{display:block}#drw .sheet{position:absolute;right:0;top:0;bottom:0;width:min(440px,100vw);background:var(--card);border-left:1px solid var(--line);padding:16px;overflow:auto;box-shadow:-8px 0 40px rgba(0,0,0,.35)}@media(max-width:639px){#drw .sheet{top:auto;height:78vh;width:100vw;border-left:0;border-top:1px solid var(--line);border-radius:16px 16px 0 0}}',
'#bnav{display:none;position:fixed;left:0;right:0;bottom:0;z-index:50;background:var(--card);border-top:1px solid var(--line);padding:4px 4px calc(4px + env(safe-area-inset-bottom))}#bnav button{flex:1;border:0;background:transparent;display:flex;flex-direction:column;align-items:center;gap:1px;font-size:10.5px;color:var(--ink2);padding:5px 2px;min-height:48px;border-radius:10px}#bnav button b{font-size:18px;line-height:1.1;font-weight:400}#bnav button.on{color:var(--ink);background:var(--chip);font-weight:650}',
'@media(max-width:639px){.tabs{display:none}#bnav{display:flex}.wrap{padding-bottom:84px}.c2{display:none}}',
'#view select{border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);padding:4px 8px}',
'.rowlink{cursor:pointer}.rowlink:hover td{background:var(--chip)}',
'.hint{font-size:11.5px;color:var(--mut)}.kbd{font:11px ui-monospace,monospace;border:1px solid var(--line);border-radius:5px;padding:1px 5px;background:var(--chip)}',
'#livedot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--good);margin-right:5px;animation:pl 2s infinite}@keyframes pl{50%{opacity:.35}}'
].join('\n');document.head.appendChild(s);
var d=document.createElement('div');d.innerHTML='<div id="toasts"></div><div id="pal"><div class="box"><input id="palq" placeholder="Jump to… (tabs, markets, charts, actions)" autocomplete="off"><div class="li" id="pall"></div></div></div><div id="drw"><div class="sheet" id="drwb"></div></div><nav id="bnav"></nav>';while(d.firstChild)document.body.appendChild(d.firstChild)})();

/* ---------- tabs (override: icons, hash routing, mobile nav) ---------- */
var TABICON={home:'◉',charts:'↗',lab:'✦',bt:'⚖',overview:'▦',market:'◈',trades:'☰',strategies:'♞',setups:'⚑',system:'⚙'};
var NAVMAIN=['home','charts','lab','bt'];
function renderTabs(){
  $('#tabs').innerHTML=TABS.map(function(t){return '<button data-tab="'+t[0]+'" class="'+(ui.tab===t[0]?'on':'')+'">'+t[1]+'</button>'}).join('');
  var nav=NAVMAIN.map(function(id){var t=TABS.filter(function(x){return x[0]===id})[0];return t?'<button data-tab="'+id+'" class="'+(ui.tab===id?'on':'')+'"><b>'+TABICON[id]+'</b>'+t[1]+'</button>':''}).join('')+'<button data-more="1" class="'+(NAVMAIN.indexOf(ui.tab)<0?'on':'')+'"><b>☰</b>More</button>';
  var n=$('#bnav');if(n)n.innerHTML=nav;
  try{if(location.hash.slice(1)!==ui.tab)history.replaceState(null,'','#'+ui.tab)}catch(e){}
  document.title='PaperBot · '+((TABS.filter(function(x){return x[0]===ui.tab})[0]||[0,''])[1]);
}
function goTab(id){ui.tab=id;renderTabs();render();window.scrollTo(0,0)}
function goSlot(ns){if(ns===ui.slot){goTab('overview');return}ui.slot=ns;try{localStorage.setItem('paperbot4:slot',ns)}catch(e){}snap=null;ui.tab='overview';renderTabs();$('#status').textContent='loading '+ns+'…';poll().then(function(){openStream()})}
window.addEventListener('hashchange',function(){var h=location.hash.slice(1);if(h&&h!==ui.tab&&TABS.some(function(t){return t[0]===h}))goTab(h)});

/* ---------- Today tab ---------- */
function istNowParts(){var d=new Date(Date.now()+19800e3);return {day:d.getUTCDay(),mins:d.getUTCHours()*60+d.getUTCMinutes()}}
function nseClock(){
  var t=istNowParts(),open=t.day>=1&&t.day<=5&&t.mins>=555&&t.mins<930;
  if(open){var m=930-t.mins;return {open:true,txt:'NSE open · closes in '+Math.floor(m/60)+'h '+(m%60)+'m (15:30 IST)'}}
  var addDays=0,day=t.day,mins=t.mins;if(day>=1&&day<=5&&mins<555)addDays=0;else{addDays=1;day=(day+1)%7;while(day===0||day===6){addDays++;day=(day+1)%7}}
  var wait=addDays*1440+555-t.mins;if(wait<0)wait+=1440;return {open:false,txt:'NSE closed · opens '+(addDays?['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]+' ':'')+'09:15 IST (in '+Math.floor(wait/60)+'h '+(wait%60)+'m)'}
}
function homeFetch(force){
  if(!PRO.feedsBusy&&(force||Date.now()-PRO.feedsAt>8000)){PRO.feedsBusy=true;jf('/api/feeds').then(function(j){PRO.feeds=j;PRO.feedsAt=Date.now();PRO.feedsBusy=false;if(ui.tab==='home')homePaint()}).catch(function(){PRO.feedsBusy=false})}
  if(Date.now()-LAB.at>10000)labFetch();
  btFetch(false);
}
function dotc(ok){return ok===true?'on':ok===false?'crit':'warn'}
function hrow(ok,title,hint){return '<div class="hrow"><span class="dot '+dotc(ok)+' d"></span><div class="x"><b>'+title+'</b>'+(hint?'<div class="h">'+hint+'</div>':'')+'</div></div>'}
function healthRows(){
  var F=PRO.feeds||{},U=F.upstox||{},Y=F.yahoo||{},L=LAB.d,h='';
  h+=hrow(U.configured?(U.ok?true:(U.tokenRejected?false:null)):null,'India data: Upstox '+(U.configured?(U.ok?'live':U.tokenRejected?'token rejected':'waiting'):'not connected'),U.configured?(U.lastErr?esc(U.lastErr):'exchange feed · '+num(U.calls)+' calls · index quotes '+(F.indexSource||'–')+(F.indexMissing&&F.indexMissing.length?' · '+F.indexMissing.length+' indices without a quote':'')):'The NSE site blocks cloud servers (HTTP 403), so India indices and F&O only run with a broker feed. Set <code>UPSTOX_TOKEN</code> (free Analytics Token, valid 1 year, read-only).');
  h+=hrow(Y.cooling>0?false:(Y.n429>0?null:true),'Yahoo Finance gateway'+(Y.cooling>0?' · cooling '+Y.cooling+'s':''),num(Y.calls)+' calls · '+num(Y.cacheHits)+' cache hits · '+num(Y.n429)+' rate-limits · '+num(Y.stale)+' stale answers served'+(Y.lastErr?' · last: '+esc(Y.lastErr):''));
  if(L){var LL=L.llm,V=L.vault,T=L.tg;
    h+=hrow(LL.configured?(LL.paused?null:true):false,'LLM bots (B, C, C0) '+(LL.configured?(LL.paused?'PAUSED · no credits used':'on · '+LL.calls+' calls today'):'off'),LL.configured?(LL.paused?'Resume from the menu (profile icon → Bots) or the AI Lab status card. '+(LL.savedCalls||0)+' calls avoided so far.':(LL.lastError?esc(LL.lastError.msg):'model '+esc(LL.tier||''))):'Set <code>LLM_API_KEY</code> in Render. Until then only the rule bot (A) trades.');
    h+=hrow(V.configured,'Memory vault '+(V.configured?'on':'off'),V.configured?'last commit '+esc(V.lastCommit||'–'):'Set <code>VAULT_REPO</code> + <code>VAULT_TOKEN</code> so trades and lessons survive restarts.');
    h+=hrow(T.channel?(T.err?false:true):null,'Telegram follower '+(T.channel?'@'+esc(T.channel):'no channel'),T.channel?(T.err?esc(T.err):'polled '+ago(T.lastPoll)):'Optional: set <code>TG_CHANNEL</code>.');
    h+=hrow(L.cfg.maxCostR>0?true:null,'Cost gate '+(L.cfg.maxCostR>0?'on · skips entries costing more than '+L.cfg.maxCostR+'R':'off'),L.cfg.maxCostR>0?'Fees + slippage must stay under '+L.cfg.maxCostR+' of the stop distance.':'Backtests say costs are what lose money on 15-minute bars. Set <code>LAB_MAX_COST_R=0.25</code> to skip trades that cannot pay their own costs.')}
  var per=snap&&snap.server&&snap.server.persist||'';h+=hrow(/EPHEMERAL/.test(per)?false:true,'Persistence: '+esc(per||'unknown'),/EPHEMERAL/.test(per)?'Trades are lost on every restart/redeploy. Set <code>VAULT_*</code> or <code>UPSTASH_*</code>.':'State survives restarts.');
  return h;
}
function slotCard(s){
  var up=s.pnlPct>0,dn=s.pnlPct<0,live=s.feed==='live',cs=s.currency||'';
  return '<button class="slotc" data-goslot="'+esc(s.slot)+'"><div class="t"><span class="n">'+esc(s.label)+'</span><span class="num '+(up?'pos2':dn?'neg2':'')+'">'+(s.pnlPct==null?'–':(up?'▲ +':dn?'▼ −':'')+Math.abs(s.pnlPct*100).toFixed(2)+'%')+'</span></div><div class="f"><span class="pill2"><span class="dot '+(!s.ready?'crit':live?'on':'warn')+'"></span>'+(!s.ready?'no data':live?'live':esc(s.feed||'idle'))+'</span> '+(s.equity!=null?cs+num(s.equity):'')+'</div><div class="f" title="'+esc(s.note||'')+'">'+esc(s.note||'')+'</div></button>';
}
function homePaint(){
  var el=$('#homeroot');if(!el)return;var F=PRO.feeds,L=LAB.d,clock=nseClock(),h='';
  h+='<div class="g3"><div class="kpi"><div class="l">India market</div><div class="v" style="font-size:16px"><span class="dot '+(clock.open?'on':'warn')+'"></span>'+(clock.open?'Open':'Closed')+'</div><div class="s">'+esc(clock.txt)+'</div></div>'+
     '<div class="kpi"><div class="l">Crypto</div><div class="v" style="font-size:16px"><span class="dot on"></span>24 × 7</div><div class="s">always open · Coinbase feed</div></div>';
  var best=null,worst=null;if(F&&F.slots)F.slots.forEach(function(s){if(s.pnlPct==null||!s.ready)return;if(!best||s.pnlPct>best.pnlPct)best=s;if(!worst||s.pnlPct<worst.pnlPct)worst=s});
  h+='<div class="kpi"><div class="l">Best / worst slot</div><div class="v" style="font-size:16px">'+(best?'<span class="pos2">▲ '+esc(best.label.split(' · ')[0])+' '+(best.pnlPct*100).toFixed(2)+'%</span>':'–')+'</div><div class="s">'+(worst&&worst!==best?'<span class="neg2">▼ '+esc(worst.label.split(' · ')[0])+' '+(worst.pnlPct*100).toFixed(2)+'%</span>':'')+'</div></div></div>';
  h+='<div class="g2" style="margin-top:10px"><div class="card"><div class="row"><h2>Paper books (tap to open)</h2><span class="hint">all slots, since start</span></div><div style="display:grid;gap:8px;margin-top:6px">'+(F&&F.slots?F.slots.map(slotCard).join(''):'<div class="skel" style="height:64px"></div><div class="skel" style="height:64px"></div>')+'</div></div>';
  h+='<div class="card"><div class="row"><h2>System health</h2><span class="hint">'+(PRO.feedsAt?'checked '+ago(PRO.feedsAt):'')+'</span></div>'+(F?healthRows():'<div class="skel" style="height:120px"></div>')+'</div>';
  /* AI lab strip */
  if(L){var A=L.bots,mk=LAB.mk;h+='<div class="card full"><div class="row"><h2>AI Lab · '+MKT[mk]+'</h2><span class="seg">'+['IN','CRYPTO'].map(function(k){return '<button data-labmk2="'+k+'" class="'+(mk===k?'on':'')+'">'+MKT[k]+'</button>'}).join('')+'</span></div><div class="scroll"><table><tr><th>Bot</th><th class="r">Trades</th><th class="r">'+tip('hit','Hit rate')+'</th><th class="r">'+tip('expectancy','Expectancy')+'</th><th class="r">P&amp;L</th><th class="r">'+tip('dd','Max DD')+'</th></tr>'+A.map(function(b){var m=b.byBook[mk];return '<tr><td><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:'+BOTCOL[b.id]+';margin-right:6px"></i><b>'+esc(b.id)+'</b> <span class="mut">'+esc(b.name)+'</span></td><td class="r">'+m.trades+'</td><td class="r">'+(m.hit==null?'–':Math.round(m.hit*100)+'%')+'</td><td class="r '+rcls(m.expR)+'">'+rfmt(m.expR)+'</td><td class="r '+(m.pnlPct>0?'pos2':m.pnlPct<0?'neg2':'')+'">'+(m.pnlPct>0?'▲ +':m.pnlPct<0?'▼ −':'')+Math.abs(m.pnlPct*100).toFixed(2)+'%</td><td class="r">'+(m.maxDD*100).toFixed(1)+'%</td></tr>'}).join('')+'</table></div><div class="hint" style="margin-top:6px">Judge a bot only after ~100 trades in a market. Fewer than 30 is noise.</div></div>'}
  /* research verdict */
  if(PRO.bt&&PRO.bt.result&&PRO.bt.result.verdict){h+='<div class="card full"><div class="row"><h2>What the backtests say</h2><button data-tab="bt" style="min-height:30px;padding:3px 10px">Open Backtest →</button></div><ul class="tight">'+PRO.bt.result.verdict.slice(0,6).map(function(v){return '<li>'+esc(v)+'</li>'}).join('')+'</ul></div>'}
  else h+='<div class="card full"><div class="row"><h2>What the backtests say</h2><button data-tab="bt" style="min-height:30px;padding:3px 10px">Open Backtest →</button></div><div class="sub">'+(PRO.bt&&PRO.bt.status&&PRO.bt.status.running?'Running: '+esc(PRO.bt.status.progress||''):'The first run starts a few minutes after each deploy.')+'</div></div>';
  /* activity */
  if(L){var ev=[];L.trades.slice(0,12).forEach(function(t){ev.push({t:t.closeT*1000,h:'<b>'+esc(t.bot)+'</b> closed '+esc(t.side)+' '+esc(t.name)+' <span class="'+rcls(t.r)+'">'+rfmt(t.r)+'</span> · '+esc(t.reason)})});L.decisions.slice(0,14).forEach(function(x){ev.push({t:x.t,h:'<b>'+esc(x.bot)+'</b> '+esc(x.kind)+' · '+esc(x.sym)+' · '+esc(x.text)})});ev.sort(function(a,b){return b.t-a.t});
    h+='<div class="card full"><h2>Latest activity</h2>'+(ev.length?ev.slice(0,12).map(function(e){return '<div class="hrow"><span class="hint num" style="flex:0 0 78px">'+new Date(e.t+19800e3).toISOString().slice(5,16).replace('T',' ')+'</span><div class="x">'+e.h+'</div></div>'}).join(''):'<div class="sub">Nothing yet. Bots act on closed 15-minute bars while a market is open.</div>')+'</div>'}
  h+='</div><div class="hint" style="margin-top:8px">Shortcuts: <span class="kbd">Ctrl</span>+<span class="kbd">K</span> or <span class="kbd">/</span> search · <span class="kbd">1</span>–<span class="kbd">9</span> switch tab · <span class="kbd">T</span> theme</div>';
  el.innerHTML=h;
}

/* ---------- Backtest tab ---------- */
function btFetch(force){
  if(PRO.btBusy)return;var run=PRO.bt&&PRO.bt.status&&PRO.bt.status.running;if(!force&&!run&&Date.now()-PRO.btAt<20000)return;if(run&&Date.now()-PRO.btAt<2500)return;
  PRO.btBusy=true;jf('/api/backtest').then(function(j){var was=PRO.bt&&PRO.bt.status&&PRO.bt.status.running;PRO.bt=j;PRO.btAt=Date.now();PRO.btBusy=false;if(was&&!j.status.running){PRO.btFull=null;say(j.status.error?'Backtest failed: '+j.status.error:'Backtest finished',j.status.error?'bad':'')}if(ui.tab==='bt')btPaint();if(ui.tab==='home')homePaint()}).catch(function(){PRO.btBusy=false})
}
function btFull(){if(PRO.btFull||PRO.btFullBusy||!PRO.bt||!PRO.bt.result)return;PRO.btFullBusy=true;jf('/api/backtest?full=1').then(function(j){PRO.btFull=j.result&&j.result.variants||null;PRO.btFullBusy=false;if(ui.tab==='bt')btPaint()}).catch(function(){PRO.btFullBusy=false})}
function btRun(){var tk=null;fetch('/api/backtest/run',{method:'POST'}).then(function(r){if(r.status===401){tk=labToken();if(!tk)return null;return fetch('/api/backtest/run',{method:'POST',headers:{'x-admin-token':tk}})}return r}).then(function(r){if(!r)return;say(r.ok||r.status===202?'Backtest started — takes a minute or two':'Could not start ('+r.status+')',r.ok||r.status===202?'':'bad');PRO.btAt=0;btFetch(true)})}
function btVariants(){var B=PRO.btFull&&PRO.btFull[PRO.book];return B||[]}
function btFiltered(){
  var seen={};
  return btVariants().filter(function(v){var k=[v.strat,v.tf,v.stop,v.tgt,v.trail,v.hold,v.sides,v.n,v.expR,v.oosExp].join('|');if(seen[k]&&PRO.gate==='all')return false;seen[k]=1;return true}).filter(function(v){return v.n>=PRO.minN&&(PRO.strat==='all'||v.strat===PRO.strat)&&(PRO.gate==='all'||(PRO.gate==='on'?v.gate>0:!v.gate))&&v.oosN>=8}).sort(function(a,b){var x=a[PRO.sort],y=b[PRO.sort];x=x==null?-9e9:x;y=y==null?-9e9:y;return (x-y)*PRO.dir});
}
function costViz(R){
  var c=R.costAnatomy||{};return ['15m','1h'].filter(function(k){return c[k]}).map(function(k){var x=c[k],pctc=Math.min(1,x.costInR);return '<div style="margin:8px 0"><div class="row"><span><b>'+k+' bars</b> <span class="hint">stop ≈ '+x.stopPct+'% of price · round trip '+x.roundTripBps+' bps</span></span><span class="num '+(x.costInR>0.3?'neg2':'')+'"><b>'+x.costInR.toFixed(2)+'R</b> cost</span></div><div class="meter" title="Share of one stop-loss (1R) already spent on costs"><i style="width:'+pctc*100+'%;background:'+NEG+'"></i></div><div class="hint">'+tip('cost','Cost in R')+' · needs a '+Math.round(x.breakEvenHitRate_at_RR1_67*100)+'% hit rate to break even at 2.5:1.5 reward:risk</div></div>'}).join('');
}
function stratBars(R){
  var rows=(R.byStrat||[]).slice().sort(function(a,b){return b.medianOosExpR-a.medianOosExpR}),nullv=R.liveNullExpR,W=560,Hh=rows.length*34+34,vals=rows.map(function(r){return r.medianOosExpR}).concat([nullv==null?0:nullv,-0.1,0.1]),mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals),L0=150,Rr=W-120;
  var sx=function(v){return L0+(v-mn)/(mx-mn)*(Rr-L0)},z=sx(0),s='<svg viewBox="0 0 '+W+' '+Hh+'" style="width:100%;height:auto" role="img" aria-label="Median out-of-sample expectancy per strategy">';
  s+='<line x1="'+z+'" x2="'+z+'" y1="6" y2="'+(Hh-26)+'" stroke="var(--ink2)" stroke-width="1"/>';
  rows.forEach(function(r,i){var y=10+i*34,v=r.medianOosExpR,x0=Math.min(z,sx(v)),w=Math.max(2,Math.abs(sx(v)-z));
    s+='<text x="'+(L0-8)+'" y="'+(y+14)+'" text-anchor="end" font-size="12" fill="var(--ink)">'+esc(STRATN[r.strat]||r.strat).replace(/ \(.*\)$/,'')+'</text><rect data-tt="'+esc((STRATN[r.strat]||r.strat)+': median '+rfmt(v)+' out of sample · '+Math.round(r.shareOosPositive*100)+'% of '+r.variants+' variants positive')+'" x="'+x0+'" y="'+y+'" width="'+w+'" height="20" rx="3" fill="'+(v>=0?POS:NEG)+'"/><text x="'+(W-4)+'" y="'+(y+14)+'" text-anchor="end" font-size="11.5" fill="var(--ink2)" class="num">'+rfmt(v)+' · '+Math.round(r.shareOosPositive*100)+'% pos</text>'});
  if(nullv!=null){var nx=sx(nullv);s+='<line x1="'+nx+'" x2="'+nx+'" y1="4" y2="'+(Hh-26)+'" stroke="var(--ink2)" stroke-dasharray="4 3" stroke-width="1.5"/><text x="'+nx+'" y="'+(Hh-8)+'" text-anchor="middle" font-size="11" fill="var(--ink2)">dashed = random entries, same exits ('+rfmt(nullv)+')</text>'}
  return s+'</svg>';
}
function scatter(vs){
  if(!vs.length)return '<div class="sub">Loading variants…</div>';var W=560,H=300,m={l:46,r:12,t:10,b:34},xs=vs.map(function(v){return v.isExp}),ys=vs.map(function(v){return v.oosExp});
  var xmn=Math.min(-0.2,Math.min.apply(null,xs)),xmx=Math.max(0.2,Math.max.apply(null,xs)),ymn=Math.min(-0.2,Math.min.apply(null,ys)),ymx=Math.max(0.2,Math.max.apply(null,ys));
  var X=function(v){return m.l+(v-xmn)/(xmx-xmn)*(W-m.l-m.r)},Y=function(v){return H-m.b-(v-ymn)/(ymx-ymn)*(H-m.t-m.b)};
  var s='<svg id="scsvg" viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;touch-action:none" role="img" aria-label="In-sample versus out-of-sample expectancy of every tested variant">';
  s+='<rect x="'+X(0)+'" y="'+m.t+'" width="'+(W-m.r-X(0))+'" height="'+(Y(0)-m.t)+'" fill="'+POS+'" opacity=".08"/>';
  s+='<line x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+Y(0)+'" y2="'+Y(0)+'" stroke="var(--ink2)"/><line x1="'+X(0)+'" x2="'+X(0)+'" y1="'+m.t+'" y2="'+(H-m.b)+'" stroke="var(--ink2)"/>';
  [xmn,0,xmx].forEach(function(v){s+='<text x="'+X(v)+'" y="'+(H-m.b+14)+'" text-anchor="middle" font-size="10.5" fill="var(--ink2)">'+v.toFixed(2)+'</text>'});[ymn,0,ymx].forEach(function(v){s+='<text x="'+(m.l-6)+'" y="'+(Y(v)+4)+'" text-anchor="end" font-size="10.5" fill="var(--ink2)">'+v.toFixed(2)+'</text>'});
  s+='<text x="'+(W/2)+'" y="'+(H-4)+'" text-anchor="middle" font-size="11" fill="var(--ink2)">in-sample expectancy (R) — first 60% of time</text><text transform="rotate(-90)" x="'+(-H/2)+'" y="12" text-anchor="middle" font-size="11" fill="var(--ink2)">out-of-sample (R)</text>';
  s+='<text x="'+(W-m.r-4)+'" y="'+(m.t+12)+'" text-anchor="end" font-size="11" fill="'+POS+'">works in both ✓</text>';
  vs.forEach(function(v,i){s+='<circle cx="'+X(v.isExp).toFixed(1)+'" cy="'+Y(v.oosExp).toFixed(1)+'" r="3.5" fill="'+(STRATC[v.strat]||'#888')+'" stroke="var(--card)" stroke-width="1" opacity=".85"/>'});
  s+='<circle id="scpin" r="7" fill="none" stroke="var(--ink)" stroke-width="2" display="none"/></svg>';
  var leg='<div class="legend">'+Object.keys(STRATC).map(function(k){return '<span><i class="sq" style="border-color:'+STRATC[k]+';background:'+STRATC[k]+'"></i>'+esc(STRATN[k])+'</span>'}).join('')+'</div>';
  return s+leg+'<div class="hint">Every dot is one tested variant. Honest edges sit top-right; dots left of the vertical line or below the horizontal line lost money. Hover or tap a dot for details.</div>';
}
function vlabel(v){return (STRATN[v.strat]||v.strat)+' · '+v.tf+' · stop '+v.stop+'×ATR '+(v.trail?'trail '+v.trail+'×':v.tgt?'target '+v.tgt+'×':'')+' · hold '+v.hold+' bars · '+(v.sides==='long'?'long only':'long+short')+(v.gate?' · cost gate':'')+(v.win==='tight'?' · tight hours':'')}
var STRATS={rule:'Rule',rule_f:'Rule+filters',donch:'Donchian',rsi2:'RSI(2)',orb:'ORB'};
function vshort(v){return '<b>'+esc(STRATS[v.strat]||v.strat)+'</b> <span class="mut">'+v.tf+' · '+v.stop+'×'+(v.trail?' trail '+v.trail:v.tgt?'/'+v.tgt:'')+' · h'+v.hold+' · '+(v.sides==='long'?'L':'L+S')+(v.gate?' · gate':'')+(v.win==='tight'?' · tight':'')+'</span>'}
function btTable(){
  var all=btFiltered(),rows=all.slice(0,PRO.show),cols=[['expR','Net R/trade'],['oosExp','OOS R'],['isExp','In-sample R'],['n','Trades'],['hit','Hit'],['t','t-stat']];
  var head='<tr><th>Variant</th>'+cols.map(function(c){return '<th class="r rowlink'+(/isExp|^n$|^t$/.test(c[0])?' c2':'')+'" data-btsort="'+c[0]+'">'+c[1]+(PRO.sort===c[0]?(PRO.dir<0?' ▼':' ▲'):'')+'</th>'}).join('')+'</tr>';
  var body=rows.map(function(v){return '<tr class="rowlink" data-vid="'+esc(v.id)+'"><td style="white-space:nowrap">'+vshort(v)+'</td><td class="r '+rcls(v.expR)+'">'+rfmt(v.expR)+'</td><td class="r '+rcls(v.oosExp)+'">'+rfmt(v.oosExp)+' <span class="hint">n'+v.oosN+'</span></td><td class="r c2 '+rcls(v.isExp)+'">'+rfmt(v.isExp)+'</td><td class="r c2">'+v.n+'</td><td class="r">'+Math.round(v.hit*100)+'%</td><td class="r c2">'+(v.t==null?'–':v.t.toFixed(1))+'</td></tr>'}).join('');
  return '<div class="scroll"><table>'+head+body+'</table></div>'+(all.length>rows.length?'<button id="btmore" style="margin-top:8px">Show 25 more ('+(all.length-rows.length)+' left)</button>':'')+(all.length?'':'<div class="sub">No variants match these filters.</div>');
}
function btPaint(){
  var el=$('#btroot');if(!el)return;var B=PRO.bt,R=B&&B.result&&B.result.books[PRO.book],S=B&&B.status,h='';
  var head='<div class="card"><div class="row"><h2>Backtests</h2><span style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="seg">'+['IN','CRYPTO'].map(function(k){return '<button data-btbook="'+k+'" class="'+(PRO.book===k?'on':'')+'">'+MKT[k]+'</button>'}).join('')+'</span><button id="btrun"'+(S&&S.running?' disabled':'')+'>'+(S&&S.running?'Running…':'Run again')+'</button></span></div>';
  if(S&&S.running)head+='<div class="prog" style="margin:8px 0"><i style="width:'+(35+Math.min(60,(Date.now()-S.startedAt)/2000))+'%"></i></div><div class="hint">'+esc(S.progress||'')+'</div>';
  head+='<div class="hint" style="margin-top:6px">'+(B&&B.result?'Last run '+ago(B.result.at)+' · '+B.result.days+' days of 15-minute bars · fees '+JSON.stringify(B.result.fees.feeBps)+' bps/side + slippage '+JSON.stringify(B.result.fees.slipBps)+' bps/side':'No result yet — the first run starts ~2.5 minutes after boot.')+(PRO.book==='IN'?' · India data: Upstox if connected, else Yahoo (58 days)':'')+'</div></div>';
  h+=head;
  if(S&&S.error)h+='<div class="warnbox crit">Last run failed: '+esc(S.error)+'</div>';
  if(!R){h+='<div class="card" style="margin-top:8px">'+(B?'<div class="sub">'+(R===undefined?'No data for this market yet.':'')+'</div>':'<div class="skel" style="height:120px"></div>')+'</div>';el.innerHTML=h;return}
  if(R.error){h+='<div class="warnbox">'+esc(R.error)+' — data source unreachable for this market.</div>';el.innerHTML=h;return}
  h+='<div class="card" style="margin-top:8px"><h2>Verdict</h2><ul class="tight">'+B.result.verdict.filter(function(v){return v.indexOf(PRO.book+' ')===0||v.indexOf('Sample')===0}).map(function(v){return '<li>'+esc(v)+'</li>'}).join('')+'</ul></div>';
  var lv=R.live;
  h+='<div class="g2" style="margin-top:8px"><div class="card"><h2>Why trades lose before the signal matters</h2>'+costViz(R)+(lv?'<div class="sub" style="margin-top:8px">Live rule today (15m, 1.5/2.5 ATR): <b>'+lv.n+'</b> trades · '+tip('hit','hit')+' <b>'+Math.round(lv.hit*100)+'%</b> · '+tip('expectancy','net expectancy')+' <b class="'+rcls(lv.expR)+'">'+rfmt(lv.expR)+'</b>'+(R.liveNullExpR!=null?' vs random entries <b>'+rfmt(R.liveNullExpR)+'</b>':'')+'</div>':'')+'</div>';
  h+='<div class="card"><h2>Median '+tip('oos','out-of-sample')+' expectancy by strategy</h2>'+stratBars(R)+'<div class="hint">Median across all tested exits/holds/filters, so one lucky variant cannot hide the typical outcome. '+tip('gate','Cost gate')+' median: '+rfmt(R.walkForward.gateOnMedianOos)+' with vs '+rfmt(R.walkForward.gateOffMedianOos)+' without.</div></div></div>';
  var W2=R.winners||[];
  h+='<div class="card" style="margin-top:8px"><h2>Candidates that held up</h2>'+(W2.length?'<div class="scroll"><table><tr><th>Variant</th><th class="r c2">In-sample</th><th class="r">OOS</th><th class="r c2">OOS trades</th><th class="r c2">t</th></tr>'+W2.map(function(v){return '<tr class="rowlink" data-vid="'+esc(v.id)+'"><td style="white-space:nowrap">'+vshort(v)+'</td><td class="r c2">'+rfmt(v.isExp)+'</td><td class="r pos2">'+rfmt(v.oosExp)+' <span class="hint">n'+v.oosN+'</span></td><td class="r c2">'+v.oosN+'</td><td class="r c2">'+(v.oosT==null?'–':v.oosT.toFixed(1))+'</td></tr>'}).join('')+'</table></div><div class="hint" style="margin-top:6px">Needs in-sample ≥ +0.10R, out-of-sample ≥ +0.10R, ≥ 20 OOS trades and t ≥ 1.5. With '+R.variantsTested+' variants tested a few pass by luck — treat these as hypotheses to confirm on live paper trades, not as proven edges.</div>':'<div class="sub"><b>None.</b> No tested variant earned a positive expectancy in-sample and out-of-sample after costs. That is the honest result: do not trade these rules with money.</div>')+'</div>';
  h+='<div class="card" style="margin-top:8px"><h2>All variants: in-sample vs out-of-sample</h2>'+(PRO.btFull?scatter(btFiltered()):'<div class="skel" style="height:220px"></div>')+'</div>';
  h+='<div class="card" style="margin-top:8px"><div class="row"><h2>Variant explorer</h2><span class="hint">tap a row for details</span></div><div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0"><select id="btstrat" style="min-height:34px"><option value="all">All strategies</option>'+Object.keys(STRATN).map(function(k){return '<option value="'+k+'"'+(PRO.strat===k?' selected':'')+'>'+esc(STRATN[k])+'</option>'}).join('')+'</select><select id="btgate" style="min-height:34px"><option value="all">Cost gate: any</option><option value="on"'+(PRO.gate==='on'?' selected':'')+'>Cost gate on</option><option value="off"'+(PRO.gate==='off'?' selected':'')+'>Cost gate off</option></select><select id="btmin" style="min-height:34px">'+[15,30,60,120].map(function(n){return '<option value="'+n+'"'+(PRO.minN===n?' selected':'')+'>≥ '+n+' trades</option>'}).join('')+'</select></div>'+(PRO.btFull?btTable():'<div class="skel" style="height:160px"></div>')+'</div>';
  h+='<div class="hint" style="margin:8px 0">Method: signals on closed bars, entry at the next open, stop/target in ATR, a bar touching both counts as a stop, fees and slippage on both sides, one position per symbol. Variants are ranked on the first 60% of the timeline and judged on the last 40%. Past results do not predict future ones.</div>';
  el.innerHTML=h;btFull();
}
function btTab(){
  if(!$('#btroot')){$('#view').innerHTML='<div id="btroot"><div class="card"><div class="skel" style="height:90px"></div></div></div>';btFetch(true);if(PRO.bt)btPaint()}else btFetch(false);
}
function homeTab(){
  if(!$('#homeroot')){$('#view').innerHTML='<div id="homeroot"></div>';homePaint();homeFetch(true)}else{homeFetch(false);if(PRO.labSeen!==LAB.at){PRO.labSeen=LAB.at;homePaint()}}
}
function proTab(){var cc=$('#ctrl');if(cc)cc.style.display='none';if(ui.tab==='home')homeTab();else if(ui.tab==='bt')btTab()}

/* ---------- trade / variant drawer ---------- */
function drawer(html){$('#drwb').innerHTML='<div class="row"><b>Details</b><button id="drwx" style="min-height:30px;padding:2px 10px">Close ✕</button></div>'+html;$('#drw').classList.add('on')}
function closeDrawer(){$('#drw').classList.remove('on')}
function tradeDrawer(id){
  var t=(LAB.d&&LAB.d.trades||[]).filter(function(x){return x.id===id})[0];if(!t)return;var f=(t.extra&&t.extra.f)||{};
  drawer('<h3 style="margin:10px 0 2px">'+esc(t.bot)+' · '+esc(t.side)+' '+esc(t.name)+'</h3><div class="sub">'+istStr(t.openT)+' → '+istStr(t.closeT)+' IST · '+esc(t.reason)+'</div>'+
   '<div class="g3" style="margin:10px 0"><div class="kpi"><div class="l">Result</div><div class="v '+rcls(t.r)+'">'+rfmt(t.r)+'</div><div class="s">'+t.cur+num(t.pnl,2)+' net</div></div><div class="kpi"><div class="l">Fees paid</div><div class="v">'+t.cur+num(t.fees,2)+'</div><div class="s">'+(t.extra&&t.extra.costR!=null?tip('cost','cost')+' '+t.extra.costR+'R':'')+'</div></div><div class="kpi"><div class="l">MFE / MAE</div><div class="v" style="font-size:16px">'+rfmt(t.mfeR,1)+' / '+rfmt(-t.maeR,1)+'</div><div class="s">best / worst while open</div></div></div>'+
   '<table><tr><td>Entry</td><td class="r">'+num(t.entry,2)+'</td></tr><tr><td>Stop</td><td class="r">'+num(t.stop,2)+'</td></tr><tr><td>Target</td><td class="r">'+(t.target?num(t.target,2):'none')+'</td></tr><tr><td>Exit</td><td class="r">'+num(t.exit,2)+'</td></tr></table>'+
   '<h3 style="margin:12px 0 4px">Why it entered</h3><div class="sub">'+esc(t.why||'–')+'</div>'+(f.regime?'<h3 style="margin:12px 0 4px">Market state at entry</h3><div class="sub">regime '+esc(f.regime)+' · RSI '+f.rsi+' · ADX '+f.adx+' · ATR '+f.atrPct+'% · phase '+esc(f.phase||'')+'</div>':''));
}
function variantDrawer(id){
  var v=btVariants().filter(function(x){return x.id===id})[0]||(((PRO.bt.result.books[PRO.book]||{}).winners)||[]).filter(function(x){return x.id===id})[0];if(!v)return;
  drawer('<h3 style="margin:10px 0 2px">'+esc(STRATN[v.strat]||v.strat)+'</h3><div class="sub">'+esc(vlabel(v))+'</div><div class="g3" style="margin:10px 0"><div class="kpi"><div class="l">Net / trade</div><div class="v '+rcls(v.expR)+'">'+rfmt(v.expR)+'</div><div class="s">'+v.n+' trades · hit '+Math.round(v.hit*100)+'%</div></div><div class="kpi"><div class="l">In-sample</div><div class="v '+rcls(v.isExp)+'">'+rfmt(v.isExp)+'</div><div class="s">'+v.isN+' trades</div></div><div class="kpi"><div class="l">Out of sample</div><div class="v '+rcls(v.oosExp)+'">'+rfmt(v.oosExp)+'</div><div class="s">'+v.oosN+' trades'+(v.oosHit!=null?' · hit '+Math.round(v.oosHit*100)+'%':'')+'</div></div></div><table><tr><td>'+tip('pf','Profit factor')+'</td><td class="r">'+(v.pf==null?'–':v.pf.toFixed(2))+'</td></tr><tr><td>Total R</td><td class="r">'+rfmt(v.sumR,1)+'</td></tr><tr><td>Worst drawdown</td><td class="r">'+rfmt(-v.ddR,1)+'</td></tr><tr><td>Average '+tip('cost','cost')+' per trade</td><td class="r">'+rfmt(-v.costR)+'</td></tr><tr><td>'+tip('t','t-stat')+'</td><td class="r">'+(v.t==null?'–':v.t.toFixed(2))+'</td></tr></table><div class="hint" style="margin-top:10px">To try this live, set the matching env vars on Render (<code>LAB_STOP_ATR</code>, <code>LAB_TARGET_ATR</code>, <code>LAB_MAX_COST_R</code>). Strategy family changes need a code change; ask Claude.</div>');
}

/* ---------- command palette ---------- */
function palItems(){
  var it=TABS.map(function(t){return {k:'tab',id:t[0],l:'Go to '+t[1],s:'tab'}});
  if(PRO.feeds&&PRO.feeds.slots)PRO.feeds.slots.forEach(function(s){it.push({k:'slot',id:s.slot,l:'Open '+s.label,s:'market'})});
  if(LAB.px)LAB.px.forEach(function(q){it.push({k:'chart',id:q.sym,l:'Chart · '+(q.name||q.sym),s:q.price!=null?(q.cur==='₹'?'₹':q.cur||'')+num(q.price,2):''})});
  it.push({k:'act',id:'theme',l:'Toggle dark / light',s:'T'},{k:'act',id:'bt',l:'Run backtests again',s:''},{k:'act',id:'refresh',l:'Refresh data now',s:''});
  var q=PRO.pal.q.toLowerCase();return it.filter(function(x){return !q||x.l.toLowerCase().indexOf(q)>=0}).slice(0,40);
}
function palPaint(){var L=palItems();if(PRO.pal.i>=L.length)PRO.pal.i=Math.max(0,L.length-1);$('#pall').innerHTML=L.map(function(x,i){return '<div class="it'+(i===PRO.pal.i?' on':'')+'" data-pi="'+i+'"><span>'+esc(x.l)+'</span><small>'+esc(x.s)+'</small></div>'}).join('')||'<div class="it"><small>No match</small></div>';return L}
function palOpen(){PRO.pal={open:true,q:'',i:0};$('#pal').classList.add('on');$('#palq').value='';palPaint();setTimeout(function(){$('#palq').focus()},20);if(!PRO.feeds)homeFetch(true);if(!LAB.px)chPx()}
function palClose(){PRO.pal.open=false;$('#pal').classList.remove('on')}
function palRun(x){palClose();if(!x)return;if(x.k==='tab')goTab(x.id);else if(x.k==='slot')goSlot(x.id);else if(x.k==='chart'){LAB.ch.sym=x.id;LAB.ch.data=null;goTab('charts');chLoad(true)}else if(x.id==='theme'){var b=$('#theme');if(b)b.click()}else if(x.id==='bt'){goTab('bt');btRun()}else if(x.id==='refresh'){PRO.feedsAt=0;PRO.btAt=0;LAB.at=0;render();say('Refreshing…')}}
document.addEventListener('keydown',function(e){
  var tg=e.target,typing=tg&&/INPUT|TEXTAREA|SELECT/.test(tg.tagName);
  if((e.key==='k'&&(e.ctrlKey||e.metaKey))||(e.key==='/'&&!typing)){e.preventDefault();PRO.pal.open?palClose():palOpen();return}
  if(PRO.pal.open){var L=palItems();if(e.key==='Escape'){palClose()}else if(e.key==='ArrowDown'){e.preventDefault();PRO.pal.i=Math.min(L.length-1,PRO.pal.i+1);palPaint()}else if(e.key==='ArrowUp'){e.preventDefault();PRO.pal.i=Math.max(0,PRO.pal.i-1);palPaint()}else if(e.key==='Enter'){palRun(L[PRO.pal.i])}return}
  if(e.key==='Escape'){closeDrawer();return}
  if(typing||e.ctrlKey||e.metaKey||e.altKey)return;
  if(/^[1-9]$/.test(e.key)){var t=TABS[+e.key-1];if(t)goTab(t[0])}else if(e.key==='t'||e.key==='T'){var b=$('#theme');if(b)b.click()}
});
document.addEventListener('input',function(e){if(e.target.id==='palq'){PRO.pal.q=e.target.value;PRO.pal.i=0;palPaint()}});

/* ---------- clicks ---------- */
document.addEventListener('click',function(e){
  var t=e.target,b;
  if(t.closest('#pal')&&!t.closest('.box')){palClose();return}
  if((b=t.closest('#pall [data-pi]'))){palRun(palItems()[+b.getAttribute('data-pi')]);return}
  if(t.id==='drw'||t.closest('#drwx')){closeDrawer();return}
  if(t.closest('[data-more]')){PRO.more=true;drawer('<h3 style="margin:10px 0">All sections</h3>'+TABS.map(function(x){return '<button data-tab="'+x[0]+'" style="display:block;width:100%;text-align:left;margin:6px 0;padding:12px">'+TABICON[x[0]]+'  '+x[1]+'</button>'}).join('')+'<button id="palopen" style="display:block;width:100%;text-align:left;margin:6px 0;padding:12px">⌕  Search…</button>');return}
  if(t.closest('#palopen')){closeDrawer();palOpen();return}
  if((b=t.closest('[data-tab]'))&&$('#drw').classList.contains('on'))closeDrawer();
  if((b=t.closest('[data-goslot]'))){goSlot(b.getAttribute('data-goslot'));return}
  if((b=t.closest('[data-labmk2]'))){LAB.mk=b.getAttribute('data-labmk2');homePaint();return}
  if((b=t.closest('[data-btbook]'))){PRO.book=b.getAttribute('data-btbook');PRO.show=25;btPaint();return}
  if(t.closest('#btrun')){btRun();return}
  if(t.closest('#btmore')){PRO.show+=25;btPaint();return}
  if((b=t.closest('[data-btsort]'))){var k=b.getAttribute('data-btsort');if(PRO.sort===k)PRO.dir=-PRO.dir;else{PRO.sort=k;PRO.dir=-1}btPaint();return}
  if((b=t.closest('[data-vid]'))){variantDrawer(b.getAttribute('data-vid'));return}
  if((b=t.closest('[data-trade]'))){tradeDrawer(b.getAttribute('data-trade'));return}
},true);
document.addEventListener('change',function(e){var id=e.target.id;if(id==='btstrat'){PRO.strat=e.target.value;PRO.show=25;btPaint()}else if(id==='btgate'){PRO.gate=e.target.value;PRO.show=25;btPaint()}else if(id==='btmin'){PRO.minN=+e.target.value;PRO.show=25;btPaint()}});

/* ---------- scatter + bar tooltips ---------- */
var ttEl=null;
function tt(x,y,html){if(!ttEl){ttEl=document.createElement('div');ttEl.className='tip';ttEl.style.position='fixed';ttEl.style.zIndex=80;document.body.appendChild(ttEl)}ttEl.innerHTML=html;ttEl.style.display='block';var w=ttEl.offsetWidth;ttEl.style.left=Math.max(6,Math.min(innerWidth-w-6,x+12))+'px';ttEl.style.top=(y+14)+'px'}
function ttHide(){if(ttEl)ttEl.style.display='none'}
document.addEventListener('pointermove',function(e){
  var s=e.target.closest&&e.target.closest('#scsvg');
  if(s){var r=s.getBoundingClientRect(),vs=btFiltered(),sx=560/r.width,mx=(e.clientX-r.left)*sx,my=(e.clientY-r.top)*sx;
    var xs=vs.map(function(v){return v.isExp}),ys=vs.map(function(v){return v.oosExp}),xmn=Math.min(-0.2,Math.min.apply(null,xs)),xmx=Math.max(0.2,Math.max.apply(null,xs)),ymn=Math.min(-0.2,Math.min.apply(null,ys)),ymx=Math.max(0.2,Math.max.apply(null,ys));
    var best=null,bd=22*22;vs.forEach(function(v){var px=46+(v.isExp-xmn)/(xmx-xmn)*(560-46-12),py=300-34-(v.oosExp-ymn)/(ymx-ymn)*(300-10-34),d=(px-mx)*(px-mx)+(py-my)*(py-my);if(d<bd){bd=d;best=[v,px,py]}});
    var pin=$('#scpin');if(best){pin.setAttribute('cx',best[1]);pin.setAttribute('cy',best[2]);pin.setAttribute('display','');var v=best[0];tt(e.clientX,e.clientY,'<b>'+esc(STRATN[v.strat])+'</b><br>'+esc(vlabel(v).split(' · ').slice(1).join(' · '))+'<br>in-sample '+rfmt(v.isExp)+' · OOS '+rfmt(v.oosExp)+' ('+v.oosN+' trades)')}else{pin.setAttribute('display','none');ttHide()}return}
  var d=e.target.closest&&e.target.closest('[data-tt]');if(d)tt(e.clientX,e.clientY,esc(d.getAttribute('data-tt')));else ttHide();
});
window.addEventListener('scroll',ttHide,{passive:true});

/* ---------- boot ---------- */
(function(){
  var ids=TABS.map(function(t){return t[0]}),h=location.hash.slice(1);
  ui.tab=ids.indexOf(h)>=0?h:'home';
  renderTabs();
  setInterval(function(){if(ui.tab==='home'||ui.tab==='bt'){var a=document.activeElement;if(a&&/SELECT|INPUT/.test(a.tagName))return;proTab()}},4000);
})();

/* ---- install-as-app button (Android Chrome / Edge / desktop Chrome fire beforeinstallprompt) ---- */
(function(){var ip=null,b=function(){return document.getElementById('install')};
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();ip=e;var x=b();if(x)x.style.display=''});
window.addEventListener('appinstalled',function(){ip=null;var x=b();if(x)x.style.display='none'});
document.addEventListener('click',function(e){var x=e.target&&e.target.id==='install';if(!x||!ip)return;ip.prompt();ip.userChoice&&ip.userChoice.then(function(){ip=null;var y=b();if(y)y.style.display='none'})});
if(window.matchMedia&&matchMedia('(display-mode: standalone)').matches){var x=b();if(x)x.style.display='none'}})();
