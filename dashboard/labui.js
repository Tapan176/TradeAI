/* ===== AI Lab + Charts tabs (server mode only). Self-updating: render() leaves these two tabs alone. ===== */
var LAB={d:null,at:0,busy:false,mk:'IN',ch:{sym:'^NSEI',tf:'15m',ema:true,mk:true,data:null,at:0,busy:false,key:''},px:null,pxAt:0,syms:null,tgmsg:''};
var BOTCOL={A:'#0072B2',B:'#E69F00',C:'#009E73',C0:'#CC79A7',Q:'#D55E00'},MKT={IN:'India (₹)',CRYPTO:'Crypto ($)'};
/* Live redraws replace innerHTML, which recreates every sideways-scrollable table/strip at scrollLeft 0 ("jumps back left").
 * setHTML() remembers each scrolled element by its child-index path, writes the new HTML, then puts the offsets back. */
function hsSave(root){var out=[];if(!root)return out;var all=root.getElementsByTagName('*');for(var i=0;i<all.length;i++){var e=all[i];if(e.scrollLeft>0){var p=[],n=e;while(n&&n!==root){var k=0,s=n;while((s=s.previousElementSibling))k++;p.unshift(k);n=n.parentElement}if(n===root)out.push([p,e.scrollLeft])}}return out}
function hsRestore(root,saved){saved.forEach(function(x){var n=root;for(var i=0;i<x[0].length&&n;i++)n=n.children[x[0][i]];if(n)n.scrollLeft=x[1]})}
function setHTML(el,h){var x=el.scrollLeft,s=hsSave(el);el.innerHTML=h;if(s.length)hsRestore(el,s);if(x)el.scrollLeft=x}
document.addEventListener('scroll',function(){if(typeof SCROLLAT!=='undefined')SCROLLAT=Date.now()},{capture:true,passive:true});   /* element scrolls (tables, chip strips) do not bubble to window: capture them so redraws wait */
/* hash routing: #bot/C opens the AI Lab bot page of bot C; every other tab is its plain id */
function hashTab(){var p=location.hash.slice(1).split('/');if(p[0]==='bot'&&p[1]&&/^[A-Za-z0-9]{1,4}$/.test(p[1])){LAB.bot=p[1];try{localStorage.setItem('paperbot4:labbot',p[1])}catch(e){}}if(p[0]==='acct'&&p[1]&&/^[a-z0-9_]{1,20}$/.test(p[1]))LAB.acct=p[1];return p[0]}
function tabHash(){return ui.tab==='bot'&&LAB.bot?'bot/'+LAB.bot:ui.tab==='acct'&&LAB.acct?'acct/'+LAB.acct:ui.tab}
function lpct(x,d){return x==null?'–':(x*100).toFixed(d==null?1:d)+'%'}
function lsgn(x,d){return x==null?'–':(x>0?'+':'')+x.toFixed(d==null?2:d)}
function cls2(x){return x==null?'':x>0?'up':x<0?'dn':''}
function ago(ms){if(!ms)return 'never';var s=Math.round((Date.now()-ms)/1000);return s<90?s+'s ago':s<5400?Math.round(s/60)+'m ago':Math.round(s/3600)+'h ago'}
function istStr(t){var d=new Date((t+19800)*1000);return d.toISOString().slice(5,16).replace('T',' ')}
function labFetch(){
  if(LAB.busy)return;LAB.busy=true;
  fetch('/api/lab',{cache:'no-store'}).then(function(r){return r.json()}).then(function(j){LAB.d=j;LAB.at=Date.now();LAB.busy=false;if(ui.tab==='lab')labPaint();else if(ui.tab==='bot'&&window.botPgPaint)botPgPaint();if(typeof sbRefreshLLM==='function'&&typeof SB!=='undefined'&&SB.open)sbRefreshLLM()}).catch(function(){LAB.busy=false});
}
function labToken(){var t=null;try{t=sessionStorage.getItem('pbtoken')}catch(e){}if(!t){t=window.prompt('Admin token (ADMIN_TOKEN env var on your server):');if(t){try{sessionStorage.setItem('pbtoken',t)}catch(e){}}}return t}
function llmSet(on){
  var tk=labToken();if(!tk)return;
  fetch('/api/lab/llm',{method:'POST',headers:{'x-admin-token':tk,'Content-Type':'application/json'},body:JSON.stringify({paused:on})}).then(function(r){if(r.status===401){try{sessionStorage.removeItem('pbtoken')}catch(e){}say('Wrong or missing admin token. Alternative: set LLM_PAUSED=1 in Render → Environment.');return null}return r.json()}).then(function(j){
    if(!j)return;if(LAB.d&&LAB.d.llm){LAB.d.llm.paused=j.paused;LAB.d.llm.forced=j.forced}
    say(j.paused?(on?'LLM bots paused — no credits will be used':'Still paused: LLM_PAUSED is set on the server'):'LLM bots resumed');LAB.at=0;labFetch();if(typeof sbRefreshLLM==='function')sbRefreshLLM();if(ui.tab==='lab')labPaint()}).catch(function(){say('Could not reach the server')});
}
function chip(ok,txt){return '<span class="badge" style="margin:2px 4px 2px 0"><span class="dot '+(ok===true?'on':ok===false?'crit':'warn')+'"></span> '+txt+'</span>'}
function labStatus(d){
  var L=d.llm,V=d.vault,T=d.tg,h='';
  h+=chip(L.configured?(L.paused?null:true):false,'LLM '+(L.configured?(L.paused?'PAUSED':esc(L.tier||'on'))+' · '+L.calls+'/'+(L.cap||'?')+' calls today'+(L.backingOff?' · backing off':''):'no key'));
  h+=chip(V.configured,'Vault '+(V.configured?(V.lastCommit?'commit '+esc(V.lastCommit)+' · '+ago(V.lastAt):'waiting for first sync'):'off'));
  h+=chip(T.channel?(T.err?false:true):null,'Telegram '+(T.channel?'@'+esc(T.channel)+(T.err?' · '+esc(T.err):' · polled '+ago(T.lastPoll)):'no channel'));
  h+=chip(null,'queue '+d.queue+' · up '+d.uptimeMin+'m');
  var warn='';
  if(L.configured)warn+='<div class="'+(L.paused?'warnbox':'')+'" style="margin:6px 0;display:flex;gap:10px;align-items:center;justify-content:space-between"><span class="sub" style="flex:1">'+(L.paused?'<b>LLM bots paused.</b> B, C, C0, lesson-writing and Telegram parsing use no credits; open trades still exit on their stop or target. Bots A and Q keep trading.':'LLM bots running (B, C, C0, lessons, Telegram parser).')+(L.forced?' <b>Forced by LLM_PAUSED on the server.</b>':'')+((L.savedCalls||L.prescreened)?' '+(L.savedCalls||0)+' calls avoided'+(L.prescreened?' ('+L.prescreened+' flat charts pre-screened)':'')+'.':'')+'</span><button data-llm="'+(L.paused?'resume':'pause')+'" style="min-height:34px">'+(L.paused?'Resume LLM bots':'Pause LLM bots')+'</button></div>';
  if(!L.configured)warn+='<div class="warnbox"><b>LLM key missing.</b> Set <code>LLM_API_KEY</code> (OpenRouter key) in Render → Environment. Until then only the rule bot (A) trades; B, C, C0 sit idle. Nothing else is needed.</div>';
  if(L.lastError&&L.configured)warn+='<div class="warnbox">Last LLM error: '+esc(L.lastError.msg)+' · '+ago(L.lastError.at)+'</div>';
  if(V.lastError)warn+='<div class="warnbox">Vault error: '+esc(V.lastError)+'</div>';
  if(!V.configured)warn+='<div class="sub" style="margin:4px 0">Vault off: set <code>VAULT_REPO</code> + <code>VAULT_TOKEN</code> to keep permanent notes and survive restarts.</div>';
  return '<div class="card"><h2>Status</h2>'+h+warn+'</div>';
}
function labCompare(d){
  var mk=LAB.mk,seg='<span class="seg">'+['IN','CRYPTO'].map(function(k){return '<button data-labmk="'+k+'" class="'+(mk===k?'on':'')+'">'+MKT[k]+'</button>'}).join('')+'</span>';
  var rows=d.bots.map(function(b){var m=b.byBook[mk],v=b.vsRule,tag=(m.trades<30?'<span class="mut"> · tiny sample</span>':'');
    var vs=b.id==='A'?'<span class="mut">benchmark</span>':(v&&v.mean!=null?'<span class="'+cls2(v.mean)+'">'+lsgn(v.mean)+'R/day</span>'+(v.ci?' <span class="mut">['+lsgn(v.ci[0])+', '+lsgn(v.ci[1])+']</span>':''):'<span class="mut">needs 5+ days</span>');
    return '<tr data-tab="bot" data-bot="'+esc(b.id)+'" data-botmk-go="'+mk+'" style="cursor:pointer"><td><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:'+BOTCOL[b.id]+';margin-right:6px;vertical-align:middle"></i><b>'+esc(b.id)+'</b><div class="sub" style="font-size:11px;line-height:1.2">'+esc(b.name)+'</div></td><td class="r num">'+m.trades+tag+'</td><td class="r num">'+(m.hit==null?'–':lpct(m.hit,0)+' <span class="mut">('+lpct(m.hitCI[0],0)+'–'+lpct(m.hitCI[1],0)+')</span>')+'</td><td class="r num '+cls2(m.expR)+'">'+(m.expR==null?'–':lsgn(m.expR))+'</td><td class="r num '+cls2(m.pnlPct)+'">'+lsgn(m.pnlPct*100)+'%</td><td class="r num">'+m.open+'</td><td class="r num">'+(b.stats.vetoed||0)+'/'+(b.stats.unreviewed||0)+'</td><td class="r">'+vs+'</td></tr>'}).join('');
  return '<div class="card"><div class="row"><h2>Bots, judged per market</h2>'+seg+'</div><div class="scroll"><table><tr><th>Bot</th><th class="r">Trades</th><th class="r">Hit rate (95% CI)</th><th class="r">Expect. R</th><th class="r">P&amp;L</th><th class="r">Open</th><th class="r" title="vetoed / could not be reviewed">Veto/skip</th><th class="r">vs rule bot</th></tr>'+rows+'</table></div>'+
    '<div class="sub" style="margin-top:6px">Same data, fees (4–5 bps) and 0.5% risk per trade for every bot. R = profit in units of the amount risked. Do not trust any ranking before ~100 trades per bot per market; an LLM bot can only be judged on forward results, never on a back-test.</div></div>';
}
function labPositions(d){
  var P=d.positions.filter(function(p){return (p.cur==='₹')===(LAB.mk==='IN')});
  var h=P.length?P.map(function(p){return '<div class="pos"><div class="row"><b><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:'+BOTCOL[p.bot]+';margin-right:5px"></i>'+esc(p.bot)+' · '+esc(p.side)+' '+esc(p.name)+'</b><span class="num '+cls2(p.r)+'">'+lsgn(p.r)+'R</span></div><div class="sub num">in '+p.cur+p.entry.toFixed(2)+' · now '+p.cur+p.last.toFixed(2)+' · stop '+p.stop.toFixed(2)+(p.target?' · target '+p.target.toFixed(2):'')+'</div><div class="sub">'+esc((p.why||'').slice(0,480))+'</div></div>'}).join(''):'<div class="sub">No open positions in this market.</div>';
  var T=d.trades.filter(function(t){return t.book===LAB.mk}).slice(0,25);
  var th=T.length?'<div class="scroll"><table><tr><th>Closed</th><th>Bot</th><th>Trade</th><th class="r">R</th><th class="r">Net</th><th>Exit</th></tr>'+T.map(function(t){return '<tr><td>'+istStr(t.closeT)+'</td><td>'+esc(t.bot)+'</td><td>'+esc(t.side)+' '+esc(t.name)+'</td><td class="r num '+cls2(t.r)+'">'+lsgn(t.r)+'</td><td class="r num '+cls2(t.pnl)+'">'+money(t.cur,t.pnl)+'</td><td>'+esc(t.reason)+'</td></tr>'}).join('')+'</table></div>':'<div class="sub">No closed trades yet in this market.</div>';
  return '<div class="card"><h2>Open positions · '+MKT[LAB.mk]+'</h2>'+h+'</div><div class="card" style="margin-top:8px"><h2>Recent closed trades · '+MKT[LAB.mk]+' (times IST)</h2>'+th+'</div>';
}
function labScan(d){
  var rows=d.scan.map(function(s){var c=s.cur==='₹'?'₹':'$';return '<tr><td>'+esc(s.name)+'</td><td class="r num">'+(s.price!=null?c+s.price.toFixed(2):'–')+'</td><td>'+(s.open?'open':'<span class="mut">closed</span>')+(s.stale?' · <span class="dn">stale</span>':'')+'</td><td>'+esc(s.regime||'–')+'</td><td class="r num">'+(s.rsi==null?'–':s.rsi)+'</td><td class="r num">'+(s.adx==null?'–':s.adx)+'</td><td>'+(s.sig>0?'<span class="up">long</span>':s.sig<0?'<span class="dn">short</span>':'<span class="mut">none</span>')+'</td></tr>'}).join('');
  return '<div class="card"><h2>Live scan (15-minute bars)</h2><div class="scroll"><table><tr><th>Instrument</th><th class="r">Price</th><th>Market</th><th>Regime</th><th class="r">RSI</th><th class="r">ADX</th><th>Rule signal</th></tr>'+rows+'</table></div></div>';
}
function labLessons(d){
  var Ls=d.lessons.filter(function(l){return l.cond.indexOf('book='+LAB.mk)>=0});
  var h=Ls.length?Ls.map(function(l){return '<div class="pos"><div class="row"><b>'+esc(l.id)+' · '+esc(l.claim)+'</b><span class="badge">'+esc(l.status)+'</span></div><div class="sub">if '+esc(l.cond)+' · evidence '+l.support+' agree / '+l.contra+' disagree'+(l.meanR!=null?' · avg '+lsgn(l.meanR)+'R':'')+(l.retiredWhy?' · retired: '+esc(l.retiredWhy):'')+'</div></div>'}).join(''):'<div class="sub">No lessons yet. The hybrid bot reviews each closed trade; a lesson is only a candidate until '+d.cfg.lessonMinN+'+ later trades confirm it, and only active lessons can shrink position size.</div>';
  return '<div class="card"><h2>Lessons learned · '+MKT[LAB.mk]+'</h2>'+h+'</div>';
}
function labDecisions(d){
  var h=d.decisions.slice(0,40).map(function(x){return '<tr><td class="num">'+new Date(x.t+19800000).toISOString().slice(11,16)+'</td><td>'+esc(x.bot)+'</td><td>'+esc(x.sym)+'</td><td><span class="badge">'+esc(x.kind)+'</span></td><td>'+esc(x.text)+'</td></tr>'}).join('');
  return '<div class="card"><h2>Decision log (IST)</h2><div class="scroll"><table><tr><th>Time</th><th>Bot</th><th>Symbol</th><th>Kind</th><th>Detail</th></tr>'+h+'</table></div></div>';
}
function labTg(d){
  var T=d.tg,S=T.score,h='<div class="card"><h2>Telegram channel follower (Bot D)</h2>';
  if(!T.channel)h+='<div class="warnbox">No channel set. Add env <code>TG_CHANNEL</code> (the public channel username, as in t.me/<b>name</b>), or paste calls below.</div>';
  h+='<div class="sumbar"><span>Calls seen <b>'+S.called+'</b></span><span>Triggered <b>'+S.triggered+'</b></span><span>Never triggered <b>'+S.notTriggered+'</b></span><span>Hit rate <b>'+(S.hit==null?'–':lpct(S.hit,0)+' ('+lpct(S.hitCI[0],0)+'–'+lpct(S.hitCI[1],0)+')')+'</b></span><span>Expectancy <b>'+(S.expR==null?'–':lsgn(S.expR)+'R')+'</b></span><span>Unscored <b>'+S.unscored+'</b></span></div>';
  h+='<div class="sub">Scored conservatively: entry only after we first saw the message, stop assumed first if one bar touches both levels, targets split equally, no history backfill. Index-option calls use modelled option prices (NSE option chain is not reachable), and are skipped when the modelled premium disagrees with the quoted one.</div>';
  h+='<div style="margin-top:8px"><textarea id="tgtxt" rows="3" style="width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);padding:8px;font:inherit" placeholder="Paste a channel call here, e.g. BUY RELIANCE CMP 2895 SL 2870 T1 2930 T2 2960"></textarea><button id="tgsend" style="margin-top:6px">Add call</button> <span class="sub" id="tgmsg">'+esc(LAB.tgmsg)+'</span></div>';
  var rows=T.signals.slice(0,30).map(function(s){var o=s.outcome||s.state;return '<tr><td>'+new Date(s.seenAt+19800000).toISOString().slice(5,16).replace('T',' ')+'</td><td>'+esc((s.und||'')+(s.strike?' '+s.strike+(s.opt||''):'')+' '+(s.side||''))+'</td><td>'+esc(s.text.slice(0,80))+'</td><td>'+esc(o)+(s.note&&s.state!=='closed'?' <span class="mut">· '+esc(String(s.note).slice(0,40))+'</span>':'')+'</td><td class="r num '+cls2(s.r)+'">'+(s.r==null?'':lsgn(s.r)+'R')+'</td></tr>'}).join('');
  h+=rows?'<div class="scroll" style="margin-top:8px"><table><tr><th>Seen (IST)</th><th>Instrument</th><th>Message</th><th>Outcome</th><th class="r">R</th></tr>'+rows+'</table></div>':'<div class="sub" style="margin-top:8px">No calls captured yet. Calls posted after the bot starts are picked up automatically; older posts are ignored on purpose.</div>';
  return h+'</div>';
}
function labPaint(){
  var d=LAB.d,el=$('#labroot');if(!d||!el)return;
  var ae=document.activeElement;if(ae&&ae.id==='tgtxt'&&ae.value){ /* keep typing intact */ var keep=ae.value;setHTML(el,labStatus(d)+labCompare(d)+'<div id="labeq" class="card" style="margin-top:8px"><h2>Equity, % of start · '+MKT[LAB.mk]+'</h2><div class="lwc" data-h="220" id="labeqc"></div><div class="legend" id="labeqleg"></div></div><div style="margin-top:8px">'+labPositions(d)+'</div><div style="margin-top:8px">'+labScan(d)+'</div><div style="margin-top:8px">'+labLessons(d)+'</div><div style="margin-top:8px">'+labTg(d)+'</div><div style="margin-top:8px">'+labDecisions(d)+'</div>');var t=$('#tgtxt');if(t){t.value=keep;t.focus()}}
  else setHTML(el,labStatus(d)+labCompare(d)+'<div id="labeq" class="card" style="margin-top:8px"><h2>Equity, % of start · '+MKT[LAB.mk]+'</h2><div class="lwc" data-h="220" id="labeqc"></div><div class="legend" id="labeqleg"></div></div><div style="margin-top:8px">'+labPositions(d)+'</div><div style="margin-top:8px">'+labScan(d)+'</div><div style="margin-top:8px">'+labLessons(d)+'</div><div style="margin-top:8px">'+labTg(d)+'</div><div style="margin-top:8px">'+labDecisions(d)+'</div>');
  labEquity(d);
}
var labEq=null;
function labEquity(d){
  var host=$('#labeqc');if(!host||!LW)return;if(labEq){try{labEq.remove()}catch(e){}labEq=null}
  var chart=LW.createChart(host,{width:Math.max(260,host.clientWidth),height:220,layout:{background:{type:'solid',color:'transparent'},textColor:cssv('--ink2'),fontSize:11,attributionLogo:true},grid:{vertLines:{color:cssv('--grid')},horzLines:{color:cssv('--grid')}},rightPriceScale:{borderColor:cssv('--line')},timeScale:{borderColor:cssv('--line'),timeVisible:true,secondsVisible:false}});labEq=chart;
  var any=false,leg='';
  d.bots.forEach(function(b){var c=d.curves[b.id][LAB.mk]||[],st=d.cfg.books[LAB.mk];leg+='<span><i style="border-color:'+BOTCOL[b.id]+'"></i>'+esc(b.id)+' '+esc(b.name)+'</span>';
    var pts=[],last=0;c.forEach(function(p){var t=p[0]+19800;if(t>last){pts.push({time:t,value:(p[1]/st-1)*100});last=t}});
    if(pts.length>1){any=true;var s=chart.addSeries(LW.LineSeries,{color:BOTCOL[b.id],lineWidth:2,priceLineVisible:false,lastValueVisible:true,priceFormat:{type:'custom',formatter:function(v){return v.toFixed(2)+'%'}}});s.setData(pts)}});
  $('#labeqleg').innerHTML=leg+(any?'':'<span class="mut">curves appear after the first 15-minute marks</span>');
  chart.timeScale().fitContent();
}
/* ---------- Charts tab ---------- */
function emaArr(cs,n){var k=2/(n+1),e=null,out=[];cs.forEach(function(c){e=e==null?c.close:c.close*k+e*(1-k);out.push({time:c.time,value:e})});return out}
var chObj=null;
function chLoad(force){
  var C=LAB.ch;if(C.busy)return;C.busy=true;var want=C.sym+'|'+C.tf;
  fetch('/api/candles?sym='+encodeURIComponent(C.sym)+'&tf='+C.tf,{cache:'no-store'}).then(function(r){return r.json()}).then(function(j){C.busy=false;if(want!==C.sym+'|'+C.tf){chLoad(true);return}if(j.error){C.err=j.error;C.data=null}else{C.err=null;C.data=j;C.at=Date.now();if(typeof chApplyLive==='function')chApplyLive()}if(ui.tab==='charts'){chPaint(force);try{chStrip(true)}catch(e){}}}).catch(function(e){C.busy=false;C.err=String(e);if(ui.tab==='charts')chPaint(false)});
}
function chPx(){
  if(Date.now()-LAB.pxAt<15000)return;LAB.pxAt=Date.now();
  fetch('/api/lab/prices',{cache:'no-store'}).then(function(r){return r.json()}).then(function(j){LAB.px=j;if(typeof overlayPx==='function')overlayPx();if(ui.tab==='charts')chStrip()}).catch(function(){});
}
function chStrip(){
  var el=$('#chstrip');if(!el||!LAB.px)return;
  el.innerHTML=LAB.px.map(function(q){if(q.err||q.price==null)return '<button class="chip'+(q.sym===LAB.ch.sym?' on':'')+'" data-chsym="'+esc(q.sym)+'">'+esc(q.name||q.sym)+' · n/a</button>';
    var c=q.cur==='₹'?'₹':(q.cur||''),chg=q.chg==null?null:q.chg*100;return '<button class="chip'+(q.sym===LAB.ch.sym?' on':'')+'" data-chsym="'+esc(q.sym)+'">'+esc(q.name||q.sym)+' <b class="num">'+c+(+q.price).toLocaleString('en-IN',{maximumFractionDigits:q.price<10?4:2})+'</b> <span class="'+cls2(chg)+'">'+(chg==null?'':lsgn(chg)+'%')+'</span></button>'}).join('');
}
function chScaffold(){
  var C=LAB.ch;
  $('#view').innerHTML='<div class="card"><div class="row"><h2>Live charts</h2><span class="sub" id="chinfo"></span></div><div id="chstrip" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px"></div><div style="margin:2px 0 6px"><input id="chsearch" type="search" autocomplete="off" placeholder="Search any stock, index, ETF, crypto, commodity…" style="width:100%;min-height:38px"><div id="chres" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"></div></div>'+
   '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0"><span class="seg">'+['5m','15m','1h','1d'].map(function(t){return '<button data-chtf="'+t+'" class="'+(C.tf===t?'on':'')+'">'+t+'</button>'}).join('')+'</span><button id="chema" class="'+(C.ema?'on':'')+'">EMA 20/50</button><button id="chmk" class="'+(C.mk?'on':'')+'">Bot trades</button></div>'+
   '<div class="lwc" id="chhost" data-h="420" style="height:420px"></div><div class="legend"><span><i style="border-color:#2a78d6"></i>EMA 20</span><span><i style="border-color:#eb6834"></i>EMA 50</span><span>dashed: <b style="color:#d03b3b">stop</b> / <b style="color:#0ca30c">target</b> / entry of open bot trades</span><span>▲ long entry · ▼ short entry · ● exit (letter = bot A/B/C/D…)</span></div><div class="sub" style="margin-top:6px">Times are IST. Prices come from free feeds (Yahoo, Coinbase) and can lag a few minutes; India indices and stocks only move during NSE hours.</div></div>';
  chObj=null;chStrip();
}
function chPaint(force){
  var C=LAB.ch,host=$('#chhost');if(!host)return;if(!LW){host.innerHTML='<div class="sub">Chart library not loaded.</div>';return}
  if(!C.data){host.innerHTML='<div class="sub" style="padding:20px">'+(C.err?'Could not load '+esc(C.sym)+': '+esc(C.err):'Loading…')+'</div>';chObj=null;return}
  var key=C.sym+'|'+C.tf,sh=19800,step={'5m':300,'15m':900,'1h':3600,'1d':86400}[C.tf];
  var cs=C.data.candles.map(function(c){return {time:c.t+sh,open:c.o,high:c.h,low:c.l,close:c.c}}),vol=C.data.candles.map(function(c){return {time:c.t+sh,value:c.v||0,color:c.c>=c.o?'rgba(12,163,12,.35)':'rgba(208,59,59,.35)'}});
  if(!chObj||chObj.key!==key||force){
    host.innerHTML='';if(chObj){try{chObj.chart.remove()}catch(e){}}
    var chart=LW.createChart(host,{width:Math.max(260,host.clientWidth),height:420,layout:{background:{type:'solid',color:'transparent'},textColor:cssv('--ink2'),fontSize:11,attributionLogo:true},grid:{vertLines:{color:cssv('--grid')},horzLines:{color:cssv('--grid')}},rightPriceScale:{borderColor:cssv('--line')},timeScale:{borderColor:cssv('--line'),timeVisible:C.tf!=='1d',secondsVisible:false,rightOffset:5},crosshair:{mode:0}});
    var cd=chart.addSeries(LW.CandlestickSeries,{upColor:'#0ca30c',downColor:'#d03b3b',borderVisible:false,wickUpColor:'#0ca30c',wickDownColor:'#d03b3b'});
    var vs=chart.addSeries(LW.HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'vol',lastValueVisible:false,priceLineVisible:false});chart.priceScale('vol').applyOptions({scaleMargins:{top:.82,bottom:0}});
    var e1=chart.addSeries(LW.LineSeries,{color:'#2a78d6',lineWidth:1,priceLineVisible:false,lastValueVisible:false}),e2=chart.addSeries(LW.LineSeries,{color:'#eb6834',lineWidth:1,priceLineVisible:false,lastValueVisible:false});
    chObj={key:key,chart:chart,cd:cd,vs:vs,e1:e1,e2:e2,lines:[],mk:null,first:true};
  }
  var o=chObj;o.cd.setData(cs);o.vs.setData(vol);
  if(C.ema){o.e1.setData(emaArr(cs,20));o.e2.setData(emaArr(cs,50))}else{o.e1.setData([]);o.e2.setData([])}
  o.lines.forEach(function(l){try{o.cd.removePriceLine(l)}catch(e){}});o.lines=[];
  (C.data.lines||[]).forEach(function(l){o.lines.push(o.cd.createPriceLine({price:l.px,color:l.kind==='stop'?'#d03b3b':l.kind==='target'?'#0ca30c':'#82827c',lineWidth:1,lineStyle:2,axisLabelVisible:false,title:''}))});
  var ms=[];if(C.mk){var first=cs.length?cs[0].time:0;(C.data.markers||[]).forEach(function(m){var t=Math.floor((m.t+sh)/step)*step;if(t<first)return;ms.push(m.kind==='in'?{time:t,position:m.side==='LONG'?'belowBar':'aboveBar',color:BOTCOL[m.bot]||'#888',shape:m.side==='LONG'?'arrowUp':'arrowDown',text:m.bot}:{time:t,position:'inBar',color:BOTCOL[m.bot]||'#888',shape:'circle',text:m.bot+(m.r!=null?' '+(m.r>0?'+':'')+m.r.toFixed(1)+'R':'')})})}
  ms.sort(function(a,b){return a.time-b.time});
  try{if(!o.mk)o.mk=LW.createSeriesMarkers(o.cd,ms);else o.mk.setMarkers(ms)}catch(e){}
  if(o.first){o.chart.timeScale().fitContent();o.chart.timeScale().setVisibleLogicalRange({from:Math.max(0,cs.length-110),to:cs.length+5});o.first=false}
  var li=cs.length?cs[cs.length-1]:null;$('#chinfo').textContent=(C.data.name||C.sym)+' · '+(C.data.open?'market open':'market closed')+' · '+(C.data.src||'')+' · updated '+new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
}
function labTab(){
  var cc=$('#ctrl');if(cc)cc.style.display=(ui.tab==='lab'||ui.tab==='charts'||ui.tab==='bot')?'none':'';
  if(ui.tab==='lab'){
    if(!$('#labroot')){$('#view').innerHTML='<div id="labroot"><div class="card sub">Loading AI Lab…</div></div>';labFetch()}
    else if(Date.now()-LAB.at>10000)labFetch();
  }else if(ui.tab==='bot'){
    if(!$('#botpgroot')){$('#view').innerHTML='<div id="botpgroot"><div class="card sub">Loading bot…</div></div>';labFetch();if(LAB.d)botPgPaint(true)}
    else if(Date.now()-LAB.at>10000)labFetch();
  }else if(ui.tab==='charts'){
    if(!$('#chhost')){chScaffold();chPx();chLoad(true)}
    else{chPx();if(Date.now()-LAB.ch.at>20000)chLoad(false)}
  }
}
document.addEventListener('click',function(e){
  var t=e.target,b;
  if((b=t.closest('[data-llm]'))){llmSet(b.getAttribute('data-llm')==='pause');return}
  if((b=t.closest('[data-chpick]'))){chPick(b.getAttribute('data-chpick'));return}
  if((b=t.closest('[data-labmk]'))){LAB.mk=b.getAttribute('data-labmk');labPaint();return}
  if((b=t.closest('[data-chsym]'))){LAB.ch.sym=b.getAttribute('data-chsym');LAB.ch.data=null;chStrip();chPaint(true);chLoad(true);return}
  if((b=t.closest('[data-chtf]'))){LAB.ch.tf=b.getAttribute('data-chtf');LAB.ch.data=null;[].forEach.call(document.querySelectorAll('[data-chtf]'),function(x){x.classList.toggle('on',x===b)});chPaint(true);chLoad(true);return}
  if(t.closest('#chema')){LAB.ch.ema=!LAB.ch.ema;$('#chema').classList.toggle('on',LAB.ch.ema);chPaint(false);return}
  if(t.closest('#chmk')){LAB.ch.mk=!LAB.ch.mk;$('#chmk').classList.toggle('on',LAB.ch.mk);chPaint(false);return}
  if(t.closest('#tgsend')){var v=($('#tgtxt')||{}).value;if(!v)return;var tk=labToken();if(!tk)return;fetch('/api/lab/tg/ingest',{method:'POST',headers:{'x-admin-token':tk,'Content-Type':'application/json'},body:JSON.stringify({text:v})}).then(function(r){if(r.status===401){try{sessionStorage.removeItem('pbtoken')}catch(e){}LAB.tgmsg='Wrong admin token';return {}}return r.json()}).then(function(j){if(j.accepted){LAB.tgmsg='Added ('+j.state+')';var x=$('#tgtxt');if(x)x.value=''}else if(j.accepted===false)LAB.tgmsg='Ignored: not a trade call or already seen';labFetch()});return}
},true);
window.addEventListener('resize',function(){if(ui.tab==='lab')labEquity(LAB.d||{bots:[],curves:{},cfg:{books:{}}});if(ui.tab==='charts'&&chObj){var h=$('#chhost');if(h)chObj.chart.applyOptions({width:Math.max(260,h.clientWidth)})}});
setInterval(function(){if(ui.tab==='lab'||ui.tab==='charts'||ui.tab==='bot')labTab()},3000);

/* ---- chart search: any symbol Yahoo or Coinbase knows opens on demand (the bots trade a short watchlist; charts are free to open) ---- */
var CHS={t:null,q:''};
function chPick(sym){
  LAB.ch.sym=sym;LAB.ch.data=null;var r=$('#chres');if(r)r.innerHTML='';var i=$('#chsearch');if(i)i.value='';chPaint(true);chLoad(true);try{chStrip(true)}catch(e){}
}
document.addEventListener('input',function(e){
  if(!e.target||e.target.id!=='chsearch')return;var q=e.target.value.trim();CHS.q=q;clearTimeout(CHS.t);var r=$('#chres');
  if(q.length<1){if(r)r.innerHTML='';return}
  CHS.t=setTimeout(function(){fetch('/api/universe/search?q='+encodeURIComponent(q),{cache:'no-store'}).then(function(x){return x.json()}).then(function(j){
    if(CHS.q!==q)return;var r=$('#chres');if(!r)return;
    r.innerHTML=(j&&j.length)?j.map(function(x){return '<button class="chip" data-chpick="'+esc(x.sym)+'" title="'+esc(x.group||'')+'">'+esc(x.name)+' <span class="mut">'+esc(x.sym)+'</span></button>'}).join(''):'<span class="sub">No match. Try the ticker (e.g. TATAMOTORS.NS, AAPL, PEPE-USD).</span>'
  }).catch(function(){})},320);
});
