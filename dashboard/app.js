/* ===== APP layer (server mode): broker-style mobile shell — app bar, 5-tab bottom nav, Bots screen, Today hero + watchlist, More sheet, overflow fixes ===== */
(function(){var s=document.createElement('style');s.textContent=[
/* --- overflow root cause: grid/flex children defaulted to min-width:auto, so one long unbroken line widened the whole page and pushed the fixed nav off-screen --- */
'.wrap{overflow-x:clip}.card,.kpi,.slotc,.bcard,.g2>*,.g3>*,.row>*,.hrow .x{min-width:0}',
'.g2{grid-template-columns:minmax(0,1fr)}.g3{grid-template-columns:repeat(2,minmax(0,1fr))}@media(min-width:900px){.g2{grid-template-columns:repeat(2,minmax(0,1fr))}.g3{grid-template-columns:repeat(3,minmax(0,1fr))}}',
'#homeroot div[style*="display:grid"],#botsroot div[style*="display:grid"]{grid-template-columns:minmax(0,1fr)}',
'.card,.kpi .s,.hrow .x,.note,.sub{overflow-wrap:anywhere}.card table{overflow-wrap:normal}img,svg,canvas{max-width:100%}',
'.row{flex-wrap:wrap}',
/* --- app bar --- */
'#appbar{display:none;position:sticky;top:0;z-index:40;align-items:center;justify-content:space-between;gap:8px;padding:calc(8px + env(safe-area-inset-top)) 12px 8px;background:var(--bg);border-bottom:1px solid var(--line)}',
'#appbar .l{display:flex;align-items:center;gap:10px;min-width:0}#appbar .logo{flex:0 0 auto;width:34px;height:34px;border-radius:10px;background:var(--ink);color:var(--bg);display:grid;place-items:center;font-weight:800;font-size:16px;letter-spacing:-.5px}',
'#appbar b{font-size:16px;line-height:1.1;display:block}#appbar small{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'#appbar .r{display:flex;align-items:center;gap:6px}#appbar .r button{min-height:36px;min-width:36px;padding:0 9px;border-radius:10px;display:grid;place-items:center;font-size:17px;line-height:1}#appbar .paper{font-size:10px;font-weight:700;letter-spacing:.5px;border:1px solid var(--line);border-radius:999px;padding:3px 8px;background:var(--chip);white-space:nowrap}',
'@media(max-width:639px){header,#banner{display:none!important}#appbar{display:flex}.wrap{padding:0 12px 96px}#view{min-height:60vh}}',
/* --- bottom nav (broker style) --- */
'#bnav{padding:6px 6px calc(6px + env(safe-area-inset-bottom));box-shadow:0 -6px 24px rgba(0,0,0,.06)}#bnav button{gap:3px;font-size:10.5px;min-height:52px;position:relative;border-radius:12px}#bnav button svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}#bnav button.on{background:transparent;color:var(--ink)}#bnav button.on::before{content:"";position:absolute;top:-7px;left:28%;right:28%;height:3px;border-radius:0 0 3px 3px;background:var(--ink)}#bnav button.on svg{stroke-width:2.3}',
/* --- hero + watchlist --- */
'.hero{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:10px}.hc{border:1px solid var(--line);border-radius:16px;padding:12px 13px;background:var(--card);text-align:left;min-height:0;display:block;width:100%}.hc .k{font-size:11px;color:var(--ink2);text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;gap:5px}.hc .big{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.15;margin-top:4px}.hc .pl{font-size:13px;font-weight:650;margin-top:2px;font-variant-numeric:tabular-nums}.hc .s{font-size:11.5px;color:var(--ink2);margin-top:5px}',
'.chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:0 0 10px;padding-bottom:2px}.chips::-webkit-scrollbar{display:none}.chips .cp{flex:0 0 auto;font-size:12px;border:1px solid var(--line);border-radius:999px;padding:5px 10px;background:var(--card);display:inline-flex;gap:6px;align-items:center;white-space:nowrap}',
'.wl .it{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 2px;border-top:1px solid var(--line);cursor:pointer}.wl .it:first-of-type{border-top:0}.wl .nm{min-width:0}.wl .nm b{display:block;font-size:14px}.wl .nm small{font-size:11.5px;color:var(--ink2)}.wl .px{text-align:right;font-variant-numeric:tabular-nums}.wl .px b{display:block;font-size:14.5px}.wl .px span{font-size:12px;font-weight:650}',
/* --- bot cards --- */
'.bgrid{display:grid;gap:10px;grid-template-columns:minmax(0,1fr)}@media(min-width:640px){.bgrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(min-width:1000px){.bgrid{grid-template-columns:repeat(4,minmax(0,1fr))}}',
'.bcard{display:block;width:100%;text-align:left;border:1px solid var(--line);border-radius:16px;background:var(--card);padding:12px 13px;min-height:0}.bcard:hover{border-color:var(--ink2)}.bcard .top{display:flex;align-items:center;gap:10px}.bcard .av{flex:0 0 auto;width:36px;height:36px;border-radius:11px;color:#fff;display:grid;place-items:center;font-weight:800;font-size:13px}.bcard .nmx{min-width:0;flex:1}.bcard .nmx b{display:block;font-size:14.5px}.bcard .nmx small{display:block;color:var(--ink2);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'.bcard .mid{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-top:10px}.bcard .eq{font-size:19px;font-weight:700;font-variant-numeric:tabular-nums}.bcard .pl{font-size:13px;font-weight:650;font-variant-numeric:tabular-nums}.bcard .bst{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.bcard .bst span{font-size:11px;color:var(--ink2);background:var(--chip);border-radius:7px;padding:2px 7px}',
'.sect{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:14px 2px 8px}.sect h3{margin:0;font-size:13px;color:var(--ink2);text-transform:uppercase;letter-spacing:.5px;font-weight:650}',
/* --- more sheet --- */
'.mlist button{display:flex;align-items:center;gap:12px;width:100%;text-align:left;margin:6px 0;padding:11px 12px;border-radius:13px;min-height:0}.mlist .ic{flex:0 0 auto;width:34px;height:34px;border-radius:10px;background:var(--chip);display:grid;place-items:center}.mlist .ic svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.mlist small{display:block;color:var(--ink2);font-size:11.5px}.mlist b{font-size:14px}'
].join('\n');document.head.appendChild(s);
try{history.scrollRestoration='manual'}catch(e){}
var ab=document.createElement('div');ab.id='appbar';ab.innerHTML='<div class="l"><span class="logo">P</span><div style="min-width:0"><b>PaperBot</b><small id="abstat">connecting…</small></div></div><div class="r"><span class="paper">PAPER</span><button id="abinst" title="Install as an app" style="display:none">⬇</button><button id="abtheme" title="Theme">◐</button><button id="absearch" title="Search">⌕</button></div>';
var w=document.querySelector('.wrap');w.parentNode.insertBefore(ab,w)})();

/* ---------- icons ---------- */
var IC={home:'<path d="M3 11l9-8 9 8"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
charts:'<path d="M3 17l5-6 4 3 8-9"/><path d="M15 5h5v5"/>',
bots:'<rect x="4.5" y="8" width="15" height="11" rx="3.5"/><path d="M12 8V4.5"/><circle cx="12" cy="3.6" r=".6"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M9.5 16.2h5"/>',
trades:'<path d="M8.5 6h11M8.5 12h11M8.5 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
more:'<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
lab:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>',
bt:'<path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z"/>',
overview:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 10h16M10 10v10"/>',
market:'<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 3v9h9"/>',
strategies:'<path d="M8 21h8M10 21v-4M14 21v-4M9 17c-2-2-3-4-1-7 0-2 2-4 4-5 1 2 3 3 4 5 1 3 0 5-1 7"/>',
setups:'<path d="M6 21V4M6 4h11l-2 4 2 4H6"/>',
system:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
search:'<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
theme:'<circle cx="12" cy="12" r="8"/><path d="M12 4v16" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
install:'<path d="M12 3v12M7 11l5 5 5-5M5 21h14"/>',
refresh:'<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'};
function ico(k){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+(IC[k]||'')+'</svg>'}

/* ---------- navigation: 5-tab broker bar; Bots groups Bots/AI Lab/Overview; everything else lives under More ---------- */
if(SERVER&&!TABS.some(function(t){return t[0]==='bots'}))TABS.splice(1,0,['bots','Bots']);
TABICON.bots='✦';
var APPREADY;
function renderTabs(){
  if(!APPREADY)return;
  var NAV5=[['home','Home','home'],['charts','Markets','charts'],['bots','Bots','bots'],['trades','Orders','trades']],BOTSGRP=['bots','lab','overview'];
  if(!TABS.some(function(t){return t[0]==='bots'}))TABS.splice(1,0,['bots','Bots']);
  $('#tabs').innerHTML=TABS.map(function(t){return '<button data-tab="'+t[0]+'" class="'+(ui.tab===t[0]?'on':'')+'">'+t[1]+'</button>'}).join('');
  var inMain=function(id){return id==='bots'?BOTSGRP.indexOf(ui.tab)>=0:ui.tab===id};
  var nav=NAV5.map(function(x){return '<button data-tab="'+x[0]+'" class="'+(inMain(x[0])?'on':'')+'" aria-label="'+x[1]+'">'+ico(x[2])+x[1]+'</button>'}).join('')+'<button data-more="1" class="'+(NAV5.some(function(x){return inMain(x[0])})?'':'on')+'" aria-label="More">'+ico('more')+'More</button>';
  var n=$('#bnav');if(n)n.innerHTML=nav;
  try{if(location.hash.slice(1)!==ui.tab)history.replaceState(null,'','#'+ui.tab)}catch(e){}
  document.title='PaperBot · '+((TABS.filter(function(x){return x[0]===ui.tab})[0]||[0,''])[1]);
  if(window.abUpdate)abUpdate();
}
function proTab(){var cc=$('#ctrl');if(cc)cc.style.display='none';if(ui.tab==='home')homeTab();else if(ui.tab==='bt')btTab();else if(ui.tab==='bots')botsTab()}

/* ---------- app bar status: connection + market state (broker style) ---------- */
function abUpdate(){
  var el=$('#abstat');if(!el)return;var c=nseClock(),age=LAB.at?Date.now()-LAB.at:1e9,ok=navigator.onLine!==false&&(age<60000||!!snap);
  el.innerHTML='<span class="dot '+(ok?'on':'warn')+'" style="margin:0"></span>'+(ok?'Live':'Reconnecting')+' · India '+(c.open?'open':'closed');
}
setInterval(abUpdate,4000);
document.addEventListener('click',function(e){var t=e.target;
  if(t.closest&&t.closest('#abtheme')){var b=$('#theme');if(b)b.click();return}
  if(t.closest&&t.closest('#absearch')){palOpen();return}
  if(t.closest&&t.closest('#abinst')){var i=$('#install');if(i)i.click();return}
},true);
(function(){var obs=new MutationObserver(function(){var i=$('#install'),a=$('#abinst');if(i&&a)a.style.display=i.style.display==='none'?'none':''});var i=document.getElementById('install');if(i)obs.observe(i,{attributes:true,attributeFilter:['style']})})();

/* ---------- More sheet ---------- */
function moreItem(id,t,d,ic){return '<button data-tab="'+id+'"><span class="ic">'+ico(ic||id)+'</span><span><b>'+t+'</b><small>'+d+'</small></span></button>'}
function moreSheet(){
  var inst=$('#install'),canInst=inst&&inst.style.display!=='none';
  drawer('<div class="mlist"><h3 style="margin:10px 2px 4px">More</h3>'+
    moreItem('lab','AI Lab','Bots A / B / C / C0 with live decisions','lab')+
    moreItem('overview','Paper books','Per-market bots: India, F&amp;O, stocks, global, commodities, crypto','overview')+
    moreItem('bt','Backtest','Which strategies survive real costs','bt')+
    moreItem('market','Market','Segments, regimes and signals','market')+
    moreItem('strategies','Strategies','Strategy registry and scores','strategies')+
    moreItem('setups','Setups','Trade setups scanner','setups')+
    moreItem('system','System','Agents, learning and activity log','system')+
    '<button id="m_search"><span class="ic">'+ico('search')+'</span><span><b>Search</b><small>Jump to a tab, market or chart</small></span></button>'+
    '<button id="m_refresh"><span class="ic">'+ico('refresh')+'</span><span><b>Refresh data</b><small>Re-fetch everything now</small></span></button>'+
    '<button id="m_theme"><span class="ic">'+ico('theme')+'</span><span><b>Theme</b><small>Light / dark</small></span></button>'+
    (canInst?'<button id="m_inst"><span class="ic">'+ico('install')+'</span><span><b>Install app</b><small>Add PaperBot to your home screen</small></span></button>':'')+'</div>');
}
document.addEventListener('click',function(e){var t=e.target;if(!t.closest)return;
  if(t.closest('[data-more]')){e.stopImmediatePropagation();moreSheet();return}
  if(t.closest('#m_search')){closeDrawer();palOpen();return}
  if(t.closest('#m_refresh')){closeDrawer();PRO.feedsAt=0;PRO.btAt=0;LAB.at=0;LAB.pxAt=0;render();say('Refreshing…');return}
  if(t.closest('#m_theme')){var b=$('#theme');if(b)b.click();return}
  if(t.closest('#m_inst')){closeDrawer();var i=$('#install');if(i)i.click();return}
  var hg=t.closest('[data-botmk-go]');if(hg)LAB.mk=hg.getAttribute('data-botmk-go');
  var bm=t.closest('[data-botmk]');if(bm){LAB.mk=bm.getAttribute('data-botmk');botsPaint();return}
},true);

/* ---------- shared helpers ---------- */
function plPct(x){return x==null?'–':(x>0?'▲ +':x<0?'▼ −':'')+Math.abs(x*100).toFixed(2)+'%'}
function plCls(x){return x>0?'pos2':x<0?'neg2':''}
function money(cur,x){return x==null?'–':cur+num(x,x<100?2:0)}
function bookSum(mk){var L=LAB.d;if(!L)return null;var s={eq:0,st:0,open:0,tr:0};L.bots.forEach(function(b){var m=b.books&&b.books[mk];if(m){s.eq+=m.equity;s.st+=m.start}s.open+=b.open||0;s.tr+=(b.byBook&&b.byBook[mk]?b.byBook[mk].trades:0)});s.cur=L.bots[0]&&L.bots[0].books[mk]?L.bots[0].books[mk].cur:'';s.pct=s.st?s.eq/s.st-1:0;return s}
function wlFetch(){if(LAB.pxBusy||Date.now()-(LAB.pxAt||0)<15000)return;LAB.pxBusy=true;jf('/api/lab/prices').then(function(j){LAB.px=j;LAB.pxAt=Date.now();LAB.pxBusy=false;if(ui.tab==='home')homePaint()}).catch(function(){LAB.pxBusy=false})}

/* ---------- Today: hero + watchlist go on top of the existing sections ---------- */
function heroHtml(){
  var L=LAB.d,h='';
  var one=function(mk,label){var s=bookSum(mk);if(!s)return '<div class="hc"><div class="k">'+label+'</div><div class="skel" style="height:44px;margin-top:8px"></div></div>';
    return '<button class="hc" data-tab="bots" data-botmk-go="'+mk+'"><div class="k">'+label+'</div><div class="big">'+money(s.cur,s.eq)+'</div><div class="pl '+plCls(s.pct)+'">'+plPct(s.pct)+' <span style="font-weight:400;color:var(--ink2)">'+(s.eq-s.st>=0?'+':'−')+s.cur+num(Math.abs(s.eq-s.st),Math.abs(s.eq-s.st)<100?2:0)+'</span></div><div class="s">'+s.open+' open · '+s.tr+' closed trades · 4 bots</div></button>'};
  h+='<div class="hero">'+one('CRYPTO','AI Lab · Crypto')+one('IN','AI Lab · India')+'</div>';
  var c=nseClock();
  h+='<div class="chips"><span class="cp"><span class="dot '+(c.open?'on':'warn')+'" style="margin:0"></span>India '+(c.open?'open':'closed')+'</span><span class="cp"><span class="dot on" style="margin:0"></span>Crypto 24×7</span>'+(L?'<span class="cp">LLM '+(L.llm.configured?L.llm.calls+'/'+(L.llm.cap||'–')+' calls':'off')+'</span><span class="cp">Vault '+(L.vault.configured?'on':'off')+'</span>':'')+'</div>';
  var px=LAB.px;
  h+='<div class="card wl" style="margin-bottom:10px"><div class="row"><h2>Watchlist</h2><button data-tab="charts" style="min-height:28px;padding:2px 10px;font-size:12px">Charts →</button></div>'+(px&&px.length?px.map(function(p){var up=p.chg>0,dn=p.chg<0;return '<div class="it" data-wl="'+esc(p.sym)+'"><div class="nm"><b>'+esc(p.name)+'</b><small>'+esc(p.sym)+' · '+(p.open?'open':'closed')+'</small></div><div class="px"><b>'+esc(p.cur)+num(p.price,p.price<100?2:0)+'</b><span class="'+(up?'pos2':dn?'neg2':'')+'">'+(p.chg==null?'–':(up?'▲ +':dn?'▼ −':'')+Math.abs(p.chg*100).toFixed(2)+'%')+'</span></div></div>'}).join(''):'<div class="skel" style="height:90px"></div>')+'</div>';
  return h;
}
var _homePaint=homePaint;
homePaint=function(){_homePaint();var el=$('#homeroot');if(el)el.insertAdjacentHTML('afterbegin',heroHtml());wlFetch()};
document.addEventListener('click',function(e){var w=e.target.closest&&e.target.closest('[data-wl]');if(w){LAB.ch.sym=w.getAttribute('data-wl');LAB.ch.data=null;goTab('charts');try{chLoad(true)}catch(x){}}},true);

/* ---------- Bots screen ---------- */
var BOTROLE={A:'Rule bot · no LLM',B:'LLM trader · decides entries & exits',C:'Rule + LLM approval · with lessons',C0:'Rule + LLM approval · no memory'};
function botCard(b,mk){
  var m=b.byBook[mk]||{},bk=b.books[mk],c=nseClock(),live=mk==='CRYPTO'||c.open,col=BOTCOL[b.id]||'#555',trading=b.open>0;
  var status=trading?'<span class="pill2"><span class="dot on"></span>In trade</span>':live?'<span class="pill2"><span class="dot on"></span>Watching</span>':'<span class="pill2"><span class="dot warn"></span>Market closed</span>';
  return '<button class="bcard" data-tab="lab"><div class="top"><span class="av" style="background:'+col+'">'+esc(b.id)+'</span><span class="nmx"><b>'+esc(b.name)+'</b><small>'+esc(BOTROLE[b.id]||b.desc||'')+'</small></span>'+status+'</div>'+
    '<div class="mid"><span class="eq">'+money(bk.cur,bk.equity)+'</span><span class="pl '+plCls(bk.pnlPct)+'">'+plPct(bk.pnlPct)+'</span></div>'+
    '<div class="bst"><span>'+(m.trades||0)+' trades</span><span>hit '+(m.hit==null?'–':Math.round(m.hit*100)+'%')+'</span><span>exp '+(m.expR==null?'–':rfmt(m.expR))+'</span><span>'+b.open+' open</span>'+(b.stats&&b.stats.vetoed?'<span>'+b.stats.vetoed+' vetoed</span>':'')+'</span></div></button>';
}
function botsPaint(){
  var el=$('#botsroot');if(!el)return;var L=LAB.d,F=PRO.feeds,mk=LAB.mk,h='';
  h+='<div class="sect"><h3>AI Lab bots</h3><span class="seg">'+['CRYPTO','IN'].map(function(k){return '<button data-botmk="'+k+'" class="'+(mk===k?'on':'')+'" style="min-height:30px;padding:3px 12px">'+(k==='IN'?'India':'Crypto')+'</button>'}).join('')+'</span></div>';
  h+=L?'<div class="bgrid">'+L.bots.map(function(b){return botCard(b,mk)}).join('')+'</div>':'<div class="bgrid"><div class="skel" style="height:120px"></div><div class="skel" style="height:120px"></div></div>';
  if(L){var open=(L.positions||[]).filter(function(p){return (p.cur==='₹')===(mk==='IN')});h+='<div class="sect"><h3>Open positions'+(open.length?' · '+open.length:'')+'</h3><button data-tab="lab" style="min-height:28px;padding:2px 10px;font-size:12px">AI Lab →</button></div>';
    h+='<div class="card">'+(open.length?open.slice(0,8).map(function(p){var r=p.r;return '<div class="hrow"><span class="d"><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:'+(BOTCOL[p.bot]||'#555')+'"></i></span><div class="x"><b>'+esc(p.bot)+' · '+esc(p.side)+' '+esc(p.name||p.sym)+'</b><div class="h">'+(p.entry!=null?'in '+p.cur+num(p.entry,p.entry<100?2:0):'')+(p.last!=null?' · now '+p.cur+num(p.last,p.last<100?2:0):'')+(p.stop!=null?' · stop '+num(p.stop,p.stop<100?2:0):'')+'</div></div>'+(r!=null?'<span class="num '+rcls(r)+'"><b>'+rfmt(r)+'</b></span>':'')+'</div>'}).join(''):'<div class="sub">No open positions. Bots act on closed 15-minute bars when their market is open.</div>')+'</div>'}
  h+='<div class="sect"><h3>Paper books · per market</h3><span class="hint">tap to open</span></div><div style="display:grid;gap:8px">'+(F&&F.slots?F.slots.map(slotCard).join(''):'<div class="skel" style="height:64px"></div><div class="skel" style="height:64px"></div>')+'</div>';
  el.innerHTML=h;
}
function botsTab(){
  if(!$('#botsroot')){$('#view').innerHTML='<div id="botsroot"></div>';botsPaint()}
  if(Date.now()-LAB.at>8000)labFetch();if(!PRO.feedsBusy&&Date.now()-PRO.feedsAt>10000){PRO.feedsBusy=true;jf('/api/feeds').then(function(j){PRO.feeds=j;PRO.feedsAt=Date.now();PRO.feedsBusy=false;if(ui.tab==='bots')botsPaint()}).catch(function(){PRO.feedsBusy=false})}
  if(PRO.botsSeen!==LAB.at){PRO.botsSeen=LAB.at;botsPaint()}
}
/* keep Bots fresh when lab data arrives */
var _labFetch=labFetch;labFetch=function(){_labFetch.apply(this,arguments);};
setInterval(function(){if(ui.tab==='bots'||ui.tab==='home')render()},6000);
setTimeout(function(){window.scrollTo(0,0)},60);

try{if(!nseClock().open)LAB.mk='CRYPTO'}catch(e){}
APPREADY=true;(function(){var h=location.hash.slice(1);if(h&&TABS.some(function(t){return t[0]===h}))ui.tab=h})();renderTabs();try{render()}catch(e){}
