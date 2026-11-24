/* ===== APP layer (server mode): broker-style mobile shell — app bar, 5-tab bottom nav, Bots screen, Today hero + watchlist, More sheet, overflow fixes ===== */
(function(){var s=document.createElement('style');s.textContent=[
/* --- overflow root cause: grid/flex children defaulted to min-width:auto, so one long unbroken line widened the whole page and pushed the fixed nav off-screen --- */
'.wrap{overflow-x:clip}.card,.kpi,.slotc,.bcard,.g2>*,.g3>*,.row>*,.hrow .x{min-width:0}',
'.g2{grid-template-columns:minmax(0,1fr)}.g3{grid-template-columns:repeat(2,minmax(0,1fr))}@media(min-width:900px){.g2{grid-template-columns:repeat(2,minmax(0,1fr))}.g3{grid-template-columns:repeat(3,minmax(0,1fr))}}',
'#homeroot div[style*="display:grid"],#botsroot div[style*="display:grid"]{grid-template-columns:minmax(0,1fr)}',
'.card,.kpi .s,.hrow .x,.note,.sub{overflow-wrap:break-word}.chip{flex:0 0 auto;white-space:nowrap}.card table{overflow-wrap:normal}img,svg,canvas{max-width:100%}',
'.row{flex-wrap:wrap}',
/* --- app bar --- */
'#topbar{display:none;position:sticky;top:0;z-index:40;background:var(--bg);border-bottom:1px solid var(--line)}#appbar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:calc(8px + env(safe-area-inset-top)) 12px 6px}',
'#appbar .l{display:flex;align-items:center;gap:10px;min-width:0}#appbar .logo{flex:0 0 auto;width:34px;height:34px;border-radius:10px;background:var(--ink);color:var(--bg);display:grid;place-items:center;font-weight:800;font-size:16px;letter-spacing:-.5px}',
'#appbar b{font-size:16px;line-height:1.1;display:block}#appbar small{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'#appbar .r{display:flex;align-items:center;gap:6px}#appbar .r button{min-height:36px;min-width:36px;padding:0 9px;border-radius:10px;display:grid;place-items:center;font-size:17px;line-height:1}#appbar .paper{font-size:10px;font-weight:700;letter-spacing:.5px;border:1px solid var(--line);border-radius:999px;padding:3px 8px;background:var(--chip);white-space:nowrap}',
'@media(max-width:639px){header,#banner{display:none!important}#topbar{display:block}.wrap{padding:0 12px 96px}#view{min-height:60vh}}',
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
'.mlist button{display:flex;align-items:center;gap:12px;width:100%;text-align:left;margin:6px 0;padding:11px 12px;border-radius:13px;min-height:0}.mlist .ic{flex:0 0 auto;width:34px;height:34px;border-radius:10px;background:var(--chip);display:grid;place-items:center}.mlist .ic svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.mlist small{display:block;color:var(--ink2);font-size:11.5px}.mlist b{font-size:14px}',
/* --- sub navigation strip, dropdowns, position rows --- */
'#subnav{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 12px 8px}#subnav::-webkit-scrollbar{display:none}#subnav:empty{display:none}#subnav button{flex:0 0 auto;white-space:nowrap;border-radius:999px;min-height:32px;padding:4px 14px;font-size:13px}',
'.msel{display:flex;align-items:center;gap:8px;width:100%}.msel>span{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink2);flex:0 0 auto}',
'.msel select,.chsel select,.sect select{appearance:none;-webkit-appearance:none;font:inherit;font-size:14px;color:var(--ink);background:var(--card) url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%277%27 viewBox=%270 0 12 7%27><path d=%27M1 1l5 5 5-5%27 fill=%27none%27 stroke=%27%23888%27 stroke-width=%271.8%27 stroke-linecap=%27round%27/></svg>") no-repeat right 12px center;border:1px solid var(--line);border-radius:12px;padding:8px 34px 8px 12px;min-height:40px;min-width:0;max-width:100%;flex:1 1 0;text-overflow:ellipsis}',
'.sect select{flex:0 1 auto;min-height:34px;padding:4px 30px 4px 12px;font-size:13px;width:auto}',
'#ctrl .r1{width:100%}#ctrl .r1 .seg{flex-wrap:wrap}',
'.chsel{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:8px;margin-bottom:8px}',
'.chq{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:2px 2px 8px}.chq b{font-size:15px}.chq .num{font-size:20px;font-weight:700}',
'.chchips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:4px}.chchips::-webkit-scrollbar{display:none}',
'.prow{display:flex;align-items:center;gap:10px;padding:10px 2px;border-top:1px solid var(--line)}.prow:first-child{border-top:0}.prow .pdot{flex:0 0 auto;width:10px;height:10px;border-radius:3px}.prow .pm{min-width:0;flex:1}.prow .pm b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.prow .pm small{display:block;font-size:11.5px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.prow .pv{flex:0 0 auto;text-align:right;font-variant-numeric:tabular-nums}.prow .pv b{display:block;font-size:14px}.prow .pv small{font-size:11.5px}',
'.slotx{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}'
].join('\n');document.head.appendChild(s);
try{history.scrollRestoration='manual'}catch(e){}
var ab=document.createElement('div');ab.id='appbar';ab.innerHTML='<button class="l" id="abmenu" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="sidebar"><span class="logo">P</span><span style="min-width:0;display:block"><b>PaperBot</b><small id="abstat">connecting…</small></span></button><div class="r"><span class="paper">PAPER</span><button id="abinst" title="Install as an app" style="display:none">⬇</button><button id="abtheme" title="Theme">◐</button><button id="absearch" title="Search">⌕</button></div>';
var tb=document.createElement('div');tb.id='topbar';tb.appendChild(ab);var sn=document.createElement('nav');sn.id='subnav';sn.setAttribute('aria-label','Section');tb.appendChild(sn);var w=document.querySelector('.wrap');w.parentNode.insertBefore(tb,w)})();

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
if(SERVER&&!TABS.some(function(t){return t[0]==='bots'}))TABS.splice(1,0,['bots','My bots']);
if(SERVER&&!TABS.some(function(t){return t[0]==='funds'}))TABS.splice(2,0,['funds','Funds']);
TABICON.bots='✦';
var APPREADY,APP={mk:'ALL',chmk:'ALL',navStarted:false};
/* nav groups: bottom bar shows the group; the sub-strip under the app bar moves between its pages */
var GROUPS=[{id:'home',label:'Home',ic:'home',tabs:['home']},{id:'markets',label:'Markets',ic:'charts',tabs:['charts','market','setups']},{id:'bots',label:'Bots',ic:'bots',tabs:['bots','funds','lab','overview','strategies']},{id:'orders',label:'Orders',ic:'trades',tabs:['trades']}];
function grpOf(tab){for(var i=0;i<GROUPS.length;i++)if(GROUPS[i].tabs.indexOf(tab)>=0)return GROUPS[i];return null}
var TABNAME={home:'Home',charts:'Charts',market:'Segments',setups:'Setups',bots:'My bots',funds:'Funds',lab:'AI Lab',overview:'Paper books',strategies:'Strategies',trades:'Trades',bt:'Backtest',system:'System'};
TABS.forEach(function(t){if(TABNAME[t[0]])t[1]=TABNAME[t[0]]});
function renderTabs(){
  if(!APPREADY)return;
  if(window.SB&&SB.open)sbClose();
  $('#tabs').innerHTML=TABS.map(function(t){return '<button data-tab="'+t[0]+'" class="'+(ui.tab===t[0]?'on':'')+'">'+t[1]+'</button>'}).join('');
  var g=grpOf(ui.tab);
  var nav=GROUPS.map(function(x){return '<button data-tab="'+x.tabs[0]+'" class="'+(g===x?'on':'')+'" aria-label="'+x.label+'"'+(g===x?' aria-current="page"':'')+'>'+ico(x.ic)+x.label+'</button>'}).join('')+'<button data-more="1" class="'+(g?'':'on')+'" aria-label="More">'+ico('more')+'More</button>';
  var n=$('#bnav');if(n)n.innerHTML=nav;
  var sn=$('#subnav');if(sn){var list=g?g.tabs:(ui.tab==='bt'||ui.tab==='system'?['bt','system']:[]);sn.innerHTML=list.length>1?list.map(function(id){var t=TABS.filter(function(x){return x[0]===id})[0];return t?'<button data-tab="'+id+'" class="'+(ui.tab===id?'on':'')+'">'+t[1]+'</button>':''}).join(''):'';var on=sn.querySelector('.on');if(on&&on.scrollIntoView)try{on.scrollIntoView({inline:'center',block:'nearest'})}catch(e){}}
  try{if(location.hash.slice(1)!==ui.tab){history[APP.navStarted?'pushState':'replaceState'](null,'','#'+ui.tab)}APP.navStarted=true}catch(e){}
  document.title='PaperBot · '+((TABS.filter(function(x){return x[0]===ui.tab})[0]||[0,''])[1]);
  if(window.abUpdate)abUpdate();
}
function proTab(){var cc=$('#ctrl');if(cc)cc.style.display='none';if(ui.tab==='home')homeTab();else if(ui.tab==='bt')btTab();else if(ui.tab==='bots')botsTab();else if(ui.tab==='funds')fundsTab()}

/* ---------- app bar status: connection + market state (broker style) ---------- */
function abUpdate(){
  var el=$('#abstat');if(!el)return;var c=nseClock(),age=LAB.at?Date.now()-LAB.at:1e9,ok=navigator.onLine!==false&&(liveFresh()||age<60000||!!snap);
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
    moreItem('bt','Backtest','Which strategies survive real costs','bt')+
    moreItem('system','System','Agents, learning, feeds and activity log','system')+
    '<h3 style="margin:14px 2px 2px;color:var(--ink2);font-size:12px;text-transform:uppercase;letter-spacing:.5px">Jump to</h3>'+
    moreItem('funds','Funds','Every account: start, cash, in trades, P&amp;L','bots')+
    moreItem('lab','AI Lab','Bots A / B / C / C0 / Q with live decisions','lab')+
    moreItem('overview','Paper books','Per-market bots: India, F&amp;O, stocks, global, commodities, crypto','overview')+
    moreItem('market','Segments','Segments, regimes and signals','market')+
    moreItem('strategies','Strategies','Strategy registry and scores','strategies')+
    moreItem('setups','Setups','Trade setups scanner','setups')+
    '<button id="m_search"><span class="ic">'+ico('search')+'</span><span><b>Search</b><small>Jump to a tab, market or chart</small></span></button>'+
    '<button id="m_refresh"><span class="ic">'+ico('refresh')+'</span><span><b>Refresh data</b><small>Re-fetch everything now</small></span></button>'+
    '<button id="m_theme"><span class="ic">'+ico('theme')+'</span><span><b>Theme</b><small>Light / dark</small></span></button>'+
    (canInst?'<button id="m_inst"><span class="ic">'+ico('install')+'</span><span><b>Install app</b><small>Add PaperBot to your home screen</small></span></button>':'')+'</div>');
}
document.addEventListener('click',function(e){var t=e.target;if(!t.closest)return;
  if(t.closest('[data-more]')){e.stopImmediatePropagation();moreSheet();return}
  if(t.closest('#m_search')){closeDrawer();palOpen();return}
  if(t.closest('#m_refresh')){closeDrawer();PRO.feedsAt=0;PRO.btAt=0;PRO.posAt=0;LAB.at=0;LAB.pxAt=0;render();say('Refreshing…');return}
  if(t.closest('#m_theme')){var b=$('#theme');if(b)b.click();return}
  if(t.closest('#m_inst')){closeDrawer();var i=$('#install');if(i)i.click();return}
  var hg=t.closest('[data-botmk-go]');if(hg)LAB.mk=hg.getAttribute('data-botmk-go');
  var bm=t.closest('[data-botmk]');if(bm){LAB.mk=bm.getAttribute('data-botmk');botsPaint(true);return}
},true);

/* ---------- shared helpers ---------- */
function plPct(x){return x==null?'–':(x>0?'▲ +':x<0?'▼ −':'')+Math.abs(x*100).toFixed(2)+'%'}
function plCls(x){return x>0?'pos2':x<0?'neg2':''}
function money(cur,x){return x==null?'–':cur+num(x,x<100?2:0)}
function bookSum(mk){var L=LAB.d;if(!L)return null;var s={eq:0,st:0,open:0,tr:0};L.bots.forEach(function(b){var m=b.books&&b.books[mk];if(m){s.eq+=m.equity;s.st+=m.start}s.open+=b.open||0;s.tr+=(b.byBook&&b.byBook[mk]?b.byBook[mk].trades:0)});s.cur=L.bots[0]&&L.bots[0].books[mk]?L.bots[0].books[mk].cur:'';s.pct=s.st?s.eq/s.st-1:0;return s}
function wlFetch(){if(LAB.pxBusy||Date.now()-(LAB.pxAt||0)<15000)return;LAB.pxBusy=true;jf('/api/lab/prices').then(function(j){LAB.px=j;overlayPx();LAB.pxAt=Date.now();LAB.pxBusy=false;if(ui.tab==='home')homePaint()}).catch(function(){LAB.pxBusy=false})}

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
var BOTROLE={A:'Rule bot · no LLM',B:'LLM trader · decides entries & exits',C:'Rule + LLM approval · with lessons',C0:'Rule + LLM approval · no memory',Q:'Rule + written checklist · no LLM'};
function botCard(b,mk){
  var m=b.byBook[mk]||{},bk=b.books[mk],c=nseClock(),live=mk==='CRYPTO'||c.open,col=BOTCOL[b.id]||'#555',trading=b.open>0;
  var status=trading?'<span class="pill2"><span class="dot on"></span>In trade</span>':live?'<span class="pill2"><span class="dot on"></span>Watching</span>':'<span class="pill2"><span class="dot warn"></span>Market closed</span>';
  return '<button class="bcard" data-tab="lab"><div class="top"><span class="av" style="background:'+col+'">'+esc(b.id)+'</span><span class="nmx"><b>'+esc(b.name)+'</b><small>'+esc(BOTROLE[b.id]||b.desc||'')+'</small></span>'+status+'</div>'+
    '<div class="mid"><span class="eq">'+money(bk.cur,bk.equity)+'</span><span class="pl '+plCls(bk.pnlPct)+'">'+plPct(bk.pnlPct)+'</span></div>'+
    '<div class="hint" style="margin-top:2px">own '+(mk==='CRYPTO'?'crypto':'India')+' account · started with '+money(bk.cur,bk.start)+'</div>'+
    '<div class="bst"><span>'+(m.trades||0)+' trades</span><span>hit '+(m.hit==null?'–':Math.round(m.hit*100)+'%')+'</span><span>exp '+(m.expR==null?'–':rfmt(m.expR))+'</span><span>'+b.open+' open</span>'+(b.stats&&b.stats.vetoed?'<span>'+b.stats.vetoed+' vetoed</span>':'')+'</span></div></button>';
}
var MKOPT=[['ALL','All markets'],['IN','India'],['CRYPTO','Crypto'],['GLOBAL','Global & commodities']];
var SLOTMK={nse:'IN',india:'IN',fno:'IN',instocks:'IN',crypto:'CRYPTO',gstocks:'GLOBAL',macro:'GLOBAL'};
var LABSLOT={nse:'IN',crypto:'CRYPTO'};
function slotShort(l){return String(l||'').split(' · ')[0].replace(/ \(live\)$/,'')}
/* every open position: AI Lab bots + every paper-book slot, tagged by market */
function allPos(){
  var out=[],L=LAB.d;
  if(L)(L.positions||[]).forEach(function(p){out.push({src:'AI Lab · bot '+p.bot,col:BOTCOL[p.bot]||'#555',mk:p.cur==='₹'?'IN':'CRYPTO',name:p.name||p.sym,side:p.side,cur:p.cur,entry:p.entry,price:p.last,stop:p.stop,pnl:p.pnl,r:p.r,pct:null})});
  (PRO.pos||[]).forEach(function(s){(s.positions||[]).forEach(function(p){out.push({src:'Paper book · '+slotShort(s.label),col:'#8a8a84',mk:SLOTMK[s.slot]||'OTHER',slot:s.slot,name:p.name||p.symbol,side:p.side,cur:s.currency,entry:p.entry,price:p.price,stop:p.stop,pnl:p.pnl,r:null,pct:p.pnlPct})})});
  return out;
}
function posRow(p){
  var n=function(x){return x==null?'–':p.cur+num(x,Math.abs(x)<100?2:0)},c=p.pnl==null?'':p.pnl>0?'pos2':p.pnl<0?'neg2':'';
  return '<div class="prow"><span class="pdot" style="background:'+p.col+'"></span><div class="pm"><b>'+esc(p.side||'')+' '+esc(p.name)+'</b><small>'+esc(p.src)+' · in '+n(p.entry)+' · now '+n(p.price)+(p.stop!=null?' · stop '+n(p.stop):'')+'</small></div><div class="pv"><b class="'+c+'">'+(p.pnl==null?'–':(p.pnl>0?'+':p.pnl<0?'−':'')+p.cur+num(Math.abs(p.pnl),Math.abs(p.pnl)<100?2:0))+'</b><small class="'+c+'">'+(p.r!=null?rfmt(p.r):p.pct!=null?(p.pct>0?'+':p.pct<0?'−':'')+Math.abs(p.pct*100).toFixed(2)+'%':'')+'</small></div></div>';
}
function posFetch(){if(liveFresh()&&PRO.pos)return;if(PRO.posBusy||Date.now()-(PRO.posAt||0)<8000)return;PRO.posBusy=true;jf('/api/positions').then(function(j){PRO.pos=j;PRO.posAt=Date.now();PRO.posBusy=false;if(ui.tab==='bots')botsPaint()}).catch(function(){PRO.posBusy=false})}
function mkSelect(id,val,counts){return '<select id="'+id+'" aria-label="Market">'+MKOPT.map(function(o){return '<option value="'+o[0]+'"'+(val===o[0]?' selected':'')+'>'+o[1]+(counts&&counts[o[0]]!=null?' ('+counts[o[0]]+')':'')+'</option>'}).join('')+'</select>'}
function scrolling(){return Date.now()-SCROLLAT<700}
var DIRTY={};
function botsPaint(force){
  var el=$('#botsroot');if(!el)return;
  if(!force){
    if(scrolling()){DIRTY.bots=1;return}
    var ae=document.activeElement;if(ae&&ae.tagName==='SELECT'&&el.contains(ae))return;
  }
  DIRTY.bots=0;
  var L=LAB.d,F=PRO.feeds,mk=LAB.mk,h='';
  h+='<div class="sect"><h3>AI Lab bots</h3><select id="botmk" aria-label="Bot market"><option value="CRYPTO"'+(mk==='CRYPTO'?' selected':'')+'>Crypto ($)</option><option value="IN"'+(mk==='IN'?' selected':'')+'>India (₹)</option></select></div>';
  h+='<button class="fundlink" data-tab="funds">Funds · what each bot and account holds, and what is in use <span>→</span></button>';
  h+=L?'<div class="bgrid">'+L.bots.map(function(b){return botCard(b,mk)}).join('')+'</div>':'<div class="bgrid"><div class="skel" style="height:120px"></div><div class="skel" style="height:120px"></div></div>';
  var ps=allPos(),counts={ALL:ps.length,IN:0,CRYPTO:0,GLOBAL:0};ps.forEach(function(p){if(counts[p.mk]!=null)counts[p.mk]++});
  var shown=ps.filter(function(p){return APP.mk==='ALL'||p.mk===APP.mk});
  h+='<div class="sect" id="botspos" style="scroll-margin-top:120px"><h3>Open positions · '+shown.length+'</h3>'+mkSelect('posmk',APP.mk,counts)+'</div>';
  h+='<div class="card">'+(shown.length?shown.slice(0,40).map(posRow).join(''):'<div class="sub">'+((L&&PRO.pos)?'No open positions'+(APP.mk==='ALL'?'':' in this market')+'. Bots act on closed 15-minute bars when their market is open.':'Loading…')+'</div>')+'</div>';
  h+='<div class="sect"><h3>Paper books · per market</h3><span class="hint">tap to open</span></div><div style="display:grid;gap:8px">'+(F&&F.slots?F.slots.map(slotCard).join(''):'<div class="skel" style="height:64px"></div><div class="skel" style="height:64px"></div>')+'</div>';
  if(el.__h===h&&el.firstElementChild)return;
  el.__h=h;el.innerHTML=h;
}
function botsTab(){
  if(!$('#botsroot')){$('#view').innerHTML='<div id="botsroot"></div>';botsPaint()}
  if(Date.now()-LAB.at>8000)labFetch();posFetch();
  if(!PRO.feedsBusy&&Date.now()-PRO.feedsAt>10000){PRO.feedsBusy=true;jf('/api/feeds').then(function(j){PRO.feeds=j;PRO.feedsAt=Date.now();PRO.feedsBusy=false;if(ui.tab==='bots')botsPaint()}).catch(function(){PRO.feedsBusy=false})}
  if(PRO.botsSeen!==LAB.at){PRO.botsSeen=LAB.at;botsPaint()}
}
/* keep Bots fresh when lab data arrives */
var _labFetch=labFetch;labFetch=function(){_labFetch.apply(this,arguments);};
setInterval(function(){if(ui.tab==='bots'||ui.tab==='home')render()},6000);
setTimeout(function(){window.scrollTo(0,0)},60);


/* ---------- slot cards: show open counts (paper book + AI Lab) ---------- */
var _slotCard=slotCard;
slotCard=function(s){
  var h=_slotCard(s),n=s.open||0,mk=LABSLOT[s.slot],lab=(mk&&LAB.d)?(LAB.d.positions||[]).filter(function(p){return (p.cur==='₹'?'IN':'CRYPTO')===mk}).length:0;
  var x='<div class="slotx"><span class="pill2">'+n+' open</span>'+(lab?'<span class="pill2">+ '+lab+' AI Lab</span>':'')+'</div>';
  return h.replace(/<\/button>$/,x+'</button>');
};
/* ---------- market dropdown instead of a row of 8 buttons ---------- */
var SLOTNAME={nse:'India live',fno:'F&O',instocks:'India stocks',gstocks:'Global stocks',macro:'Commodities & FX',india:'India ETFs',crypto:'Crypto',practice:'Practice'};
var _renderCtrl=renderCtrl;
renderCtrl=function(){
  _renderCtrl();
  var r1=document.querySelector('#ctrl .r1');if(!r1||!snap||!snap.server||!snap.server.slots)return;
  r1.innerHTML='<label class="msel"><span>Market</span><select id="slotsel" aria-label="Market">'+snap.server.slots.map(function(x){return '<option value="'+x.slot+'"'+(ui.slot===x.slot?' selected':'')+'>'+(SLOTNAME[x.slot]||x.slot)+'</option>'}).join('')+'</select></label>';
};
/* ---------- AI Lab positions also appear in the matching market's Paper-books view ---------- */
function labPosCard(){
  var mk=LABSLOT[ui.slot];if(!mk||!LAB.d)return '';
  var ps=(LAB.d.positions||[]).filter(function(p){return (p.cur==='₹'?'IN':'CRYPTO')===mk}).map(function(p){return {src:'AI Lab · bot '+p.bot,col:BOTCOL[p.bot]||'#555',name:p.name||p.sym,side:p.side,cur:p.cur,entry:p.entry,price:p.last,stop:p.stop,pnl:p.pnl,r:p.r}});
  return '<div class="card" id="labpos" style="margin-bottom:10px"><div class="row"><h2>AI Lab bots · open in '+(mk==='IN'?'India':'Crypto')+' · '+ps.length+'</h2><button data-tab="bots" style="min-height:28px;padding:2px 10px;font-size:12px">All bots →</button></div>'+(ps.length?ps.map(posRow).join(''):'<div class="sub">No open AI Lab positions in this market.</div>')+'</div>';
}
function postView(v){
  if(ui.tab==='market')return v+fnoCard();
  if(ui.tab==='system')return v+coverageCard();
  if(ui.tab!=='overview')return v;
  if(!LAB.d||Date.now()-LAB.at>15000)labFetch();
  var h=labPosCard();if(!h)return v;
  h=h.replace('margin-bottom:10px','margin-top:8px');
  var mark='<div class="card" style="margin-top:8px"><h2>Open positions (',i=v.indexOf(mark);
  return i>=0?v.slice(0,i)+h+v.slice(i):v+h;
}
/* ---------- Markets / Charts: market + symbol dropdowns ---------- */
function qMk(q){return q.cur==='₹'?'IN':/-USD$/.test(q.sym)?'CRYPTO':'GLOBAL'}
function chStrip(partial){
  var el=$('#chstrip');if(!el||!LAB.px)return;
  var ae=document.activeElement;if(!partial&&ae&&ae.tagName==='SELECT'&&el.contains(ae))return;
  var px=LAB.px,cur=px.filter(function(q){return q.sym===LAB.ch.sym})[0],cd=LAB.ch.data;
  if(!cur&&cd&&cd.sym===LAB.ch.sym&&cd.candles&&cd.candles.length)cur={sym:cd.sym,name:cd.name,cur:cd.cur||'',price:cd.candles[cd.candles.length-1].c,chg:null,open:cd.open,live:false};
  if(cur&&APP.chmk!=='ALL'&&qMk(cur)!==APP.chmk)APP.chmk=qMk(cur);
  var list=px.filter(function(q){return APP.chmk==='ALL'||qMk(q)===APP.chmk}),cnt={ALL:px.length,IN:0,CRYPTO:0,GLOBAL:0};px.forEach(function(q){cnt[qMk(q)]++});
  var fmt=function(q){return q.cur+(+q.price).toLocaleString('en-IN',{maximumFractionDigits:q.price<10?4:2})};
  var chg=function(q){var c=q.chg==null?null:q.chg*100;return c==null?'':'<span class="'+cls2(c)+'">'+lsgn(c)+'%</span>'};
  var qh=cur&&cur.price!=null?'<div class="chq"><b>'+esc(cur.name||cur.sym)+'</b><span class="num">'+fmt(cur)+'</span>'+chg(cur)+'<span class="sub">'+(cur.live?'live':cur.open?'market open':'market closed')+'</span></div>':'';
  var ch='<div class="chchips">'+list.map(function(q){return '<button class="chip'+(q.sym===LAB.ch.sym?' on':'')+'" data-chsym="'+esc(q.sym)+'">'+esc(q.name||q.sym)+(q.price!=null?' '+chg(q):'')+'</button>'}).join('')+'</div>';
  if(partial&&el.querySelector('.chsel')){
    var oq=el.querySelector('.chq');if(oq&&qh){if(oq.outerHTML!==qh)oq.outerHTML=qh}else if(!oq&&qh)el.querySelector('.chsel').insertAdjacentHTML('afterend',qh);
    var oc=el.querySelector('.chchips');if(oc){var sl=oc.scrollLeft;oc.outerHTML=ch;var nc=el.querySelector('.chchips');if(nc)nc.scrollLeft=sl}
    return;
  }
  el.style.display='block';el.style.overflow='visible';
  el.innerHTML='<div class="chsel"><select id="chmkt" aria-label="Market">'+MKOPT.map(function(o){return '<option value="'+o[0]+'"'+(APP.chmk===o[0]?' selected':'')+'>'+o[1]+' ('+cnt[o[0]]+')</option>'}).join('')+'</select><select id="chsymsel" aria-label="Symbol">'+list.map(function(q){return '<option value="'+esc(q.sym)+'"'+(q.sym===LAB.ch.sym?' selected':'')+'>'+esc(q.name||q.sym)+(q.price!=null?' · '+fmt(q):' · n/a')+'</option>'}).join('')+'</select></div>'+qh+ch;
}
document.addEventListener('change',function(e){
  var id=e.target&&e.target.id,v=e.target&&e.target.value;
  if(e.target&&e.target.tagName==='SELECT'){try{e.target.blur()}catch(x){}}
  if(id==='chmkt'){APP.chmk=v;var f=(LAB.px||[]).filter(function(q){return v==='ALL'||qMk(q)===v})[0];if(f){LAB.ch.sym=f.sym;LAB.ch.data=null;chStrip();chPaint(true);chLoad(true)}else chStrip()}
  else if(id==='chsymsel'){LAB.ch.sym=v;LAB.ch.data=null;chStrip();chPaint(true);chLoad(true)}
  else if(id==='slotsel'){if(v!==ui.slot){ui.slot=v;try{localStorage.setItem('paperbot4:slot',v)}catch(x){}snap=null;$('#status').textContent='loading '+v+'…';poll().then(function(){openStream()})}}
  else if(id==='posmk'){APP.mk=v;botsPaint(true)}
  else if(id==='botmk'){LAB.mk=v;botsPaint(true)}
  else if(id==='fundmk'){APP.fmk=v;fundsPaint(true)}
},true);

/* ---------- Funds: every account, what it holds, who trades it ---------- */
(function(){var st=document.createElement('style');st.textContent='.fa{border:1px solid var(--line);border-radius:16px;background:var(--card);padding:12px 13px;min-width:0}.fa .h{display:flex;align-items:center;gap:10px}.fa .h .t{min-width:0;flex:1}.fa .h .t b{display:block;font-size:14px}.fa .h .t small{color:var(--ink2);font-size:12px}.fa .h .e{text-align:right}.fa .h .e b{display:block;font-size:18px;font-variant-numeric:tabular-nums}.fa .h .e small{font-size:12px;font-weight:650}.frow{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid var(--line);font-size:13px}.frow span{color:var(--ink2)}.frow b{font-weight:600;font-variant-numeric:tabular-nums;text-align:right}.fgauge{height:6px;border-radius:4px;background:var(--chip);overflow:hidden;margin:10px 0 6px}.fgauge i{display:block;height:100%;background:var(--ink2);border-radius:4px}.fgauge.over i{background:#e8590c}.ftag{display:inline-block;font-size:11px;border:1px solid var(--line);border-radius:999px;padding:1px 8px;color:var(--ink2);margin:6px 6px 0 0}.ftag.w{border-color:#e8590c;color:#e8590c}.fgrid{display:grid;gap:8px}.fundlink{display:flex;justify-content:space-between;align-items:center;width:100%;text-align:left;border:1px solid var(--line);border-radius:14px;background:var(--card);padding:10px 13px;margin:2px 0 10px;font-size:13px;min-height:0}.fnote{font-size:12px;color:var(--ink2);line-height:1.5;margin:4px 2px}';document.head.appendChild(st)})();
function sgn(c,x){return x==null?'–':(x>0?'+':x<0?'−':'')+c+num(Math.abs(x),Math.abs(x)<100?2:0)}
function frow(k,v,cls){return '<div class="frow"><span>'+k+'</span><b class="'+(cls||'')+'">'+v+'</b></div>'}
function fgauge(p){var w=Math.max(0,Math.min(100,p*100));return '<div class="fgauge'+(p>1?' over':'')+'"><i style="width:'+w.toFixed(1)+'%"></i></div>'}
function fundsPaint(force){
  var el=$('#fundsroot');if(!el)return;
  if(!force){if(scrolling()){DIRTY.funds=1;return}var ae=document.activeElement;if(ae&&ae.tagName==='SELECT'&&el.contains(ae))return}
  DIRTY.funds=0;
  var F=PRO.funds,mk=APP.fmk||'ALL',h='';
  h+='<div class="sect"><h3>Funds <span class="hint" style="text-transform:none;letter-spacing:0;font-weight:500">'+(F&&liveFresh()?'● live ':'')+(F?new Date(F.ts).toLocaleTimeString('en-IN',{hour12:false}):'')+'</span></h3>'+mkSelect('fundmk',mk,null)+'</div>';
  if(!F){el.innerHTML=h+'<div class="skel" style="height:120px"></div><div class="skel" style="height:160px;margin-top:8px"></div>';return}
  var lab=F.lab.filter(function(a){return mk==='ALL'||a.book===mk}),bk=F.books.filter(function(b){return mk==='ALL'||(SLOTMK[b.slot]||'IN')===mk});
  /* totals per currency: never mix rupees and dollars; practice replay is not live money */
  var T={};function tot(c){return T[c]||(T[c]={lab:{n:0,s:0,e:0},bk:{n:0,s:0,e:0}})}
  lab.forEach(function(a){var t=tot(a.currency).lab;t.n++;t.s+=a.start;t.e+=a.equity});
  bk.forEach(function(b){if(!b.ready||b.practice)return;var t=tot(b.currency).bk;t.n++;t.s+=b.start;t.e+=b.equity});
  h+='<div class="sect"><h3>Totals by currency</h3></div><div class="fgrid">';
  Object.keys(T).forEach(function(c){var t=T[c],all={s:t.lab.s+t.bk.s,e:t.lab.e+t.bk.e};
    var line=function(k,x){return x.n?frow(k+' · '+x.n+' account'+(x.n>1?'s':''),money(c,x.e)+'<small class="'+plCls(x.e-x.s)+'" style="display:block;font-weight:500">start '+money(c,x.s)+' · '+sgn(c,x.e-x.s)+'</small>'):''};
    h+='<div class="fa"><div class="h"><div class="t"><b>'+(c==='₹'?'Indian rupee ₹':'US dollar $')+'</b><small>separate pots that share no money</small></div><div class="e"><b class="'+plCls(all.e-all.s)+'">'+sgn(c,all.e-all.s)+'</b><small>net P&amp;L, all accounts</small></div></div>'+line('AI Lab bots',t.lab)+line('Paper books',t.bk)+frow('Combined now',money(c,all.e)+'<small style="display:block;font-weight:500;color:var(--ink2)">start '+money(c,all.s)+'</small>')+'</div>'});
  h+='</div>';
  /* AI Lab */
  ['CRYPTO','IN'].forEach(function(k){
    var L=lab.filter(function(a){return a.book===k});if(!L.length)return;var c=L[0].currency;
    h+='<div class="sect"><h3>AI Lab · '+(k==='CRYPTO'?'Crypto':'India')+' accounts</h3><span class="hint">'+money(c,L[0].start)+' each</span></div><div class="fgrid">';
    L.forEach(function(a){var pl=a.equity-a.start,over=a.exposure>1;
      h+='<div class="fa"><div class="h"><span class="av" style="width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:#fff;font-weight:700;background:'+(BOTCOL[a.bot]||'#555')+'">'+esc(a.bot)+'</span><div class="t"><b>'+esc(a.name)+'</b><small>its own money</small></div><div class="e"><b>'+money(c,a.equity)+'</b><small class="'+plCls(pl)+'">'+plPct(a.start?pl/a.start:0)+'</small></div></div>'+
        fgauge(a.exposure)+'<div class="hint" style="margin-bottom:4px">'+(a.open?money(c,a.notional)+' in '+a.open+' open trade'+(a.open>1?'s':'')+' · '+a.exposure.toFixed(2)+'× equity':'nothing in use')+'</div>'+
        frow('Start (set by '+a.env+')',money(c,a.start))+frow('Closed-trade P&amp;L, after fees',sgn(c,a.realized),plCls(a.realized))+frow('Open-trade P&amp;L',sgn(c,a.unrealized),plCls(a.unrealized))+frow('Fees paid',money(c,a.fees))+
        frow('Max loss if every open stop hits',money(c,a.riskAtStop)+(a.equity>0?' ('+(a.riskAtStop/a.equity*100).toFixed(1)+'%)':''))+frow('Open slots',a.open+' / '+a.maxPos)+frow('Closed trades',String(a.trades))+
        (over?'<span class="ftag w">exposure above 1× equity — the lab has no margin check</span>':'')+'</div>'});
    h+='</div>'});
  /* paper books */
  if(bk.length){h+='<div class="sect"><h3>Paper books · own engine, own cash</h3></div><div class="fgrid">';
    bk.forEach(function(b){
      if(!b.ready){h+='<div class="fa"><div class="h"><div class="t"><b>'+esc(slotShort(b.label))+'</b><small>not running yet · no balance to show</small></div></div></div>';return}
      var c=b.currency,use=b.equity>0?b.inPositions/b.equity:0;
      h+='<div class="fa"><div class="h"><div class="t"><b>'+esc(slotShort(b.label))+'</b><small>'+(b.practice?'practice replay · not live money':'its own cash')+(b.strategies?' · '+esc(b.strategies.join(', ')):'')+'</small></div><div class="e"><b>'+money(c,b.equity)+'</b><small class="'+plCls(b.pnl)+'">'+plPct(b.pnlPct)+'</small></div></div>'+
        fgauge(use)+'<div class="hint" style="margin-bottom:4px">'+(b.open?money(c,b.inPositions)+' in '+b.open+' position'+(b.open>1?'s':'')+' · '+(use*100).toFixed(0)+'% of equity':'nothing in use')+'</div>'+
        frow('Start'+(b.env?' (set by '+b.env+')':' (fixed in code)'),money(c,b.start))+frow('Free cash',money(c,b.cash))+frow('In open positions',money(c,b.inPositions))+frow('Closed-trade P&amp;L',sgn(c,b.realized),plCls(b.realized))+frow('Open-trade P&amp;L',sgn(c,b.unrealized),plCls(b.unrealized))+
        (b.fees!=null?frow('Fees paid',money(c,b.fees)):'')+frow('Open positions',b.open+(b.maxPositions?' / '+b.maxPositions:''))+frow('Closed trades',String(b.trades))+
        '<span class="ftag'+(b.restored?'':' w')+'">'+(b.restored?'balance restored from '+esc(b.restored)+' at boot':'started fresh at boot — no saved state was found')+'</span>'+(b.halted?'<span class="ftag w">halted by drawdown limit</span>':'')+'</div>'});
    h+='</div>'}
  h+='<div class="sect"><h3>How to read this</h3></div><div class="fnote">Every account is virtual paper money and trades only its own balance. AI Lab accounts and paper books are separate: the same BTC or Nifty move can appear in both, so do not add them as one pool. AI Lab sizes each trade by risk ('+(F.labCfg.riskPct!=null?(F.labCfg.riskPct*100).toFixed(1):'?')+'% of equity at the stop, up to '+(F.labCfg.maxNotional!=null?F.labCfg.maxNotional+'× equity':'?')+' per trade, '+(F.labCfg.maxPos||'?')+' slots) and does not deduct cash when a trade opens, so "in use" there is exposure, not spent money. Paper books do track cash. The start amount of each account comes from its setting on Render; changing it only takes effect for an account that starts fresh.</div>';
  if(el.__h===h&&el.firstElementChild)return;el.__h=h;el.innerHTML=h;
}
function fundsTab(){
  if(!$('#fundsroot')){$('#view').innerHTML='<div id="fundsroot"></div>';fundsPaint(true)}
  if(!PRO.fundsBusy&&!(liveFresh()&&PRO.funds)&&Date.now()-(PRO.fundsAt||0)>6000){PRO.fundsBusy=true;jf('/api/funds').then(function(j){PRO.funds=j;PRO.fundsAt=Date.now();PRO.fundsBusy=false;if(ui.tab==='funds')fundsPaint()}).catch(function(){PRO.fundsBusy=false})}
}

/* ---------- Live stream: money, positions and prices pushed from the server the moment they change ---------- */
var LIVE={es:null,at:0,ok:false,ver:null,homeAt:0,labAt:0,hideT:0};
function liveFresh(){return LIVE.ok&&Date.now()-LIVE.at<15000}
function overlayPx(){var lv=LAB.live;if(!lv||!LAB.px)return;LAB.px.forEach(function(q){var l=lv[q.sym];if(l&&!q.err){q.price=l.p;if(q.prev)q.chg=l.p/q.prev-1;q.live=true}})}
/* move the forming candle with the live price so the chart ticks between server refreshes */
function chApplyLive(){
  var C=LAB.ch,lv=LAB.live&&LAB.live[C.sym];if(!lv||!C.data||!C.data.candles||!C.data.candles.length)return;
  var step={'5m':300,'15m':900,'1h':3600,'1d':86400}[C.tf];if(!step)return;
  var bt=Math.floor(Date.now()/1000/step)*step,cs=C.data.candles,last=cs[cs.length-1],p=lv.p;
  if(last.t===bt){last.c=p;if(p>last.h)last.h=p;if(p<last.l)last.l=p}
  else if(last.t<bt&&bt-last.t<=step*2){last=cs[cs.push({t:bt,o:last.c,h:Math.max(last.c,p),l:Math.min(last.c,p),c:p,v:0})-1]}
  else return;
  if(ui.tab==='charts'&&chObj&&chObj.key===C.sym+'|'+C.tf){try{chObj.cd.update({time:last.t+19800,open:last.o,high:last.h,low:last.l,close:last.c})}catch(e){}}
}
function livePaint(){
  var t=ui.tab,now=Date.now();
  if(t==='funds')fundsPaint();
  else if(t==='bots')botsPaint();
  else if(t==='home'){if(now-LIVE.homeAt>3000){LIVE.homeAt=now;homePaint()}}
  else if(t==='charts'){chStrip(true)}
  else if(t==='lab'){if(now-LIVE.labAt>4000){LIVE.labAt=now;labPaint()}}
  else if(t==='overview'){render()}
  if(SB.open)sbLive();
  abUpdate();
}
function liveApply(j){
  LIVE.at=Date.now();LIVE.ok=true;
  if(j.hb){if(SB.open)sbLive();return}
  if(j.funds)PRO.funds=j.funds;
  if(j.pos){PRO.pos=j.pos;PRO.posAt=Date.now()}
  var Lt=j.lab;
  if(Lt){
    LAB.live=Lt.live||{};
    if(LAB.d){
      LAB.d.positions=Lt.positions;
      Lt.bots.forEach(function(b){var o=LAB.d.bots.filter(function(x){return x.id===b.id})[0];if(!o)return;o.books=b.books;o.open=b.open;['IN','CRYPTO'].forEach(function(k){var bb=o.byBook&&o.byBook[k],nb=b.books[k];if(bb&&nb){bb.equity=nb.equity;bb.pnlPct=nb.pnlPct}})});
    }
    if(LIVE.ver!==Lt.ver){var first=LIVE.ver==null;LIVE.ver=Lt.ver;if(!first||!LAB.d)labFetch()}
    overlayPx();chApplyLive();
  }
  livePaint();
}
function liveOpen(){
  if(!SERVER||LIVE.es||!window.EventSource)return;
  try{
    var es=new EventSource('/api/live');LIVE.es=es;
    es.onopen=function(){LIVE.ok=true;LIVE.at=Date.now()};
    es.onmessage=function(e){try{liveApply(JSON.parse(e.data))}catch(x){}};
    es.onerror=function(){LIVE.ok=false;if(es.readyState===2){LIVE.es=null;setTimeout(liveOpen,4000)}};
  }catch(x){LIVE.es=null}
}
function liveClose(){if(LIVE.es){try{LIVE.es.close()}catch(e){}LIVE.es=null;LIVE.ok=false}}
document.addEventListener('visibilitychange',function(){
  if(document.hidden){clearTimeout(LIVE.hideT);LIVE.hideT=setTimeout(liveClose,30000)}
  else{clearTimeout(LIVE.hideT);if(!LIVE.es||!liveFresh()){liveClose();liveOpen()}}
});
setInterval(function(){if(LIVE.es&&LIVE.at&&Date.now()-LIVE.at>20000){liveClose();liveOpen()}},5000);

/* ---------- Sidebar: opens from the profile icon, collapsed by default ---------- */
(function(){var st=document.createElement('style');st.textContent=
'#appbar button.l{background:none;border:0;padding:0;min-height:36px;text-align:left;color:inherit;font:inherit;cursor:pointer}'+
'#sbback{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:69;opacity:0;pointer-events:none;transition:opacity .2s}#sbback.on{opacity:1;pointer-events:auto}'+
'#sidebar{position:fixed;top:0;bottom:0;left:0;width:min(320px,86vw);background:var(--bg);color:var(--ink);z-index:70;transform:translateX(-103%);visibility:hidden;transition:transform .22s ease,visibility 0s linear .22s;display:flex;flex-direction:column;box-shadow:6px 0 30px rgba(0,0,0,.25);padding-top:env(safe-area-inset-top)}'+
'#sidebar.on{transform:none;visibility:visible;transition:transform .22s ease,visibility 0s}'+
'html.sbopen,html.sbopen body{overflow:hidden}'+
'.sbh{display:flex;align-items:center;gap:12px;padding:16px 14px 8px}.sbh .logo{flex:0 0 auto;width:44px;height:44px;border-radius:13px;background:var(--ink);color:var(--bg);display:grid;place-items:center;font-weight:800;font-size:20px}.sbh .who{flex:1;min-width:0}.sbh .who b{display:block;font-size:16px}.sbh .who small{display:block;font-size:12px;color:var(--ink2)}.sbh button{min-height:36px;min-width:36px;border-radius:10px;font-size:16px}'+
'#sbsum{margin:4px 14px 6px;border:1px solid var(--line);border-radius:14px;background:var(--card);padding:10px 12px}#sbsum .row2{display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:2px 0}#sbsum .row2 span{color:var(--ink2)}#sbsum .row2 b{font-variant-numeric:tabular-nums}#sbsum .st{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink2);margin-bottom:4px}'+
'.sbs{overflow-y:auto;flex:1;padding:0 8px 8px;overscroll-behavior:contain}.sbs h4{margin:14px 10px 2px;font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--ink2);font-weight:650}'+
'.sbi{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:0;background:none;padding:9px 10px;border-radius:12px;min-height:44px;font-size:15px;color:var(--ink)}.sbi:hover{background:var(--chip)}#sidebar .sbi.on{background:var(--chip);color:var(--ink);font-weight:650}#sidebar .sbi{color:var(--ink)}#sidebar .sbi.on svg{stroke:var(--ink)}.sbi .ic{flex:0 0 auto;width:22px;height:22px;display:grid;place-items:center}.sbi svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.sbi .t{flex:1;min-width:0}.sbi .bd{font-size:12px;color:var(--ink2);border:1px solid var(--line);border-radius:999px;padding:1px 8px;font-variant-numeric:tabular-nums}'+
'.sbf{border-top:1px solid var(--line);padding:10px 16px calc(10px + env(safe-area-inset-bottom));font-size:11.5px;color:var(--ink2);line-height:1.45}';
document.head.appendChild(st);
var sb=document.createElement('aside');sb.id='sidebar';sb.setAttribute('role','dialog');sb.setAttribute('aria-modal','true');sb.setAttribute('aria-label','Menu');
var bk=document.createElement('div');bk.id='sbback';document.body.appendChild(bk);document.body.appendChild(sb)})();
var SB={open:false};
function sbItem(id,label,ic,badge,extra){return '<button class="sbi'+(ui.tab===id&&!extra?' on':'')+'" data-tab="'+id+'"'+(extra||'')+'><span class="ic">'+ico(ic)+'</span><span class="t">'+label+'</span>'+(badge!=null?'<span class="bd"'+(extra?' id="sbnpos"':'')+'>'+badge+'</span>':'')+'</button>'}
function sbAct(act,label,ic){return '<button class="sbi" data-sb="'+act+'"><span class="ic">'+ico(ic)+'</span><span class="t">'+label+'</span></button>'}
function sbSummary(){
  var F=PRO.funds,c=nseClock(),h='<div class="st"><span class="dot '+(liveFresh()?'on':'warn')+'" style="margin:0"></span>'+(liveFresh()?'Live · updated '+new Date(LIVE.at).toLocaleTimeString('en-IN',{hour12:false}):'Connecting…')+' · India '+(c.open?'open':'closed')+'</div>';
  if(F){var T={};F.lab.forEach(function(a){var t=T[a.currency]||(T[a.currency]={s:0,e:0});t.s+=a.start;t.e+=a.equity});F.books.forEach(function(b){if(!b.ready||b.practice)return;var t=T[b.currency]||(T[b.currency]={s:0,e:0});t.s+=b.start;t.e+=b.equity});
    Object.keys(T).forEach(function(k){var d=T[k].e-T[k].s;h+='<div class="row2"><span>Net P&amp;L · '+(k==='₹'?'rupee':'dollar')+' accounts</span><b class="'+plCls(d)+'">'+sgn(k,d)+'</b></div>'})}
  else h+='<div class="row2"><span>Loading funds…</span><b></b></div>';
  return h}
function sbHtml(){
  var np=0;try{np=allPos().length}catch(e){}
  var inst=$('#install'),canInst=inst&&inst.style.display!=='none';
  return '<div class="sbh"><span class="logo">P</span><div class="who"><b>PaperBot</b><small>Paper trading · virtual money</small></div><button type="button" id="sbx" aria-label="Close menu">✕</button></div>'+
   '<div id="sbsum">'+sbSummary()+'</div><div id="sbllm" style="padding:6px 8px 0">'+sbLLM()+'</div>'+
   '<nav class="sbs" aria-label="Menu">'+
   '<h4>Portfolio</h4>'+sbItem('funds','Funds','overview')+sbItem('bots','Positions','trades',np,' data-sbjump="botspos"')+sbItem('trades','Orders','trades')+sbItem('overview','Paper books','overview')+
   '<h4>Trade</h4>'+sbItem('home','Dashboard','home')+sbItem('charts','Charts','charts')+sbItem('market','Segments','market')+sbItem('setups','Setups','setups')+
   '<h4>Bots</h4>'+sbItem('bots','My bots','bots')+sbItem('lab','AI Lab','lab')+sbItem('strategies','Strategies','strategies')+sbItem('bt','Backtest','bt')+
   '<h4>Tools</h4>'+sbAct('search','Search','search')+sbAct('refresh','Refresh data','refresh')+sbAct('theme','Switch theme','theme')+(canInst?sbAct('install','Install app','install'):'')+sbItem('system','System &amp; feeds','system')+
   '</nav><div class="sbf" id="sbfoot">'+sbFoot()+'</div>'}
function sbLLM(){var L=LAB.d&&LAB.d.llm;if(!L||!L.configured)return '';return '<button class="sbi" data-sb="llm"><span class="ic">'+ico('lab')+'</span><span class="t">LLM bots: '+(L.paused?'paused':'running')+'</span><span class="bd" style="'+(L.paused?'background:#d03b3b;color:#fff':'')+'">'+(L.paused?'Resume':'Pause')+'</span></button>'}
function sbRefreshLLM(){var e=$('#sbllm');if(e)e.innerHTML=sbLLM()}
function sbFoot(){return 'Paper trading only — no real orders are placed. Prices stream live from the server; India and stock quotes refresh as fast as their data source allows.'}
function sbOpen(){
  var sb=$('#sidebar');if(!sb)return;sb.innerHTML=sbHtml();sb.classList.add('on');$('#sbback').classList.add('on');document.documentElement.classList.add('sbopen');SB.open=true;
  var m=$('#abmenu');if(m)m.setAttribute('aria-expanded','true');var x=$('#sbx');if(x)try{x.focus({preventScroll:true})}catch(e){}
  if(!PRO.funds&&!liveFresh())fundsTab();if(!LAB.d)labFetch();
}
function sbClose(){
  if(!SB.open)return;var sb=$('#sidebar');if(sb)sb.classList.remove('on');var bk=$('#sbback');if(bk)bk.classList.remove('on');document.documentElement.classList.remove('sbopen');SB.open=false;
  var m=$('#abmenu');if(m){m.setAttribute('aria-expanded','false');try{m.focus({preventScroll:true})}catch(e){}}
}
function sbLive(){var a=$('#sbsum');if(a)a.innerHTML=sbSummary();var n=$('#sbnpos');if(n)try{n.textContent=allPos().length}catch(e){}}
document.addEventListener('click',function(e){
  var t=e.target;if(!t.closest)return;
  if(t.closest('#abmenu')){e.stopImmediatePropagation();e.preventDefault();SB.open?sbClose():sbOpen();return}
  if(t.closest('#sbback')||t.closest('#sbx')){sbClose();return}
  var a=t.closest('#sidebar [data-sb]');
  if(a){e.stopImmediatePropagation();var k=a.getAttribute('data-sb');
    if(k==='theme'){var b=$('#theme');if(b)b.click();return}
    if(k==='llm'){var L0=LAB.d&&LAB.d.llm;if(L0)llmSet(!L0.paused);return}
    sbClose();
    if(k==='search')palOpen();
    else if(k==='refresh'){PRO.feedsAt=0;PRO.btAt=0;PRO.posAt=0;LAB.at=0;LAB.pxAt=0;PRO.fundsAt=0;render();say('Refreshing…')}
    else if(k==='install'){var i=$('#install');if(i)i.click()}
    return}
  var nv=t.closest('#sidebar [data-tab]');if(nv){sbClose()}
  var j=t.closest('#sidebar [data-sbjump]');
  if(j){var id=j.getAttribute('data-sbjump');setTimeout(function(){var el=document.getElementById(id);if(el)el.scrollIntoView({block:'start'})},160)}
},true);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&SB.open)sbClose()});
(function(){var x0=null;var sb=$('#sidebar');if(!sb)return;
  sb.addEventListener('touchstart',function(e){x0=e.touches[0].clientX},{passive:true});
  sb.addEventListener('touchend',function(e){if(x0!=null&&e.changedTouches[0].clientX-x0<-60)sbClose();x0=null},{passive:true})})();
/* a repaint while the page is being scrolled snaps the scroll offset back: hold it until the scroll stops */
var _labPaint=labPaint;labPaint=function(){if(scrolling()){DIRTY.lab=1;return}DIRTY.lab=0;_labPaint.apply(this,arguments)};
var _homePaint2=homePaint;homePaint=function(){if(scrolling()){DIRTY.home=1;return}DIRTY.home=0;_homePaint2.apply(this,arguments)};
window.addEventListener('click',function(){SCROLLAT=0},true);
window.addEventListener('change',function(){SCROLLAT=0},true);
setInterval(function(){if(scrolling())return;if(DIRTY.lab&&ui.tab==='lab')labPaint();if(DIRTY.home&&ui.tab==='home')homePaint();if(DIRTY.bots&&ui.tab==='bots')botsPaint();if(DIRTY.funds&&ui.tab==='funds')fundsPaint()},400);
try{if(!nseClock().open)LAB.mk='CRYPTO'}catch(e){}
/* ---------- F&O end of day (NSE archive) and market coverage ---------- */
var FNO={d:null,at:0,busy:false},UNI={d:null,at:0,busy:false};
function fnoFetch(force){if(FNO.busy||(!force&&Date.now()-FNO.at<120000))return;FNO.busy=true;jf('/api/fno/eod'+(force?'?refresh=1':'')).then(function(j){FNO.d=j;FNO.at=Date.now();FNO.busy=false;if(ui.tab==='market')render()}).catch(function(){FNO.busy=false;FNO.at=Date.now()})}
function uniFetch(){if(UNI.busy||(UNI.d&&Date.now()-UNI.at<300000))return;UNI.busy=true;jf('/api/universe').then(function(j){UNI.d=j;UNI.at=Date.now();UNI.busy=false;if(ui.tab==='system')render()}).catch(function(){UNI.busy=false;UNI.at=Date.now()})}
function fk(n){if(n==null)return '–';var a=Math.abs(n),s=n<0?'−':'+';return s+(a>=1e5?(a/1e5).toFixed(2)+'L':a>=1e3?(a/1e3).toFixed(1)+'k':Math.round(a))}
function fnoCard(){
  fnoFetch();var j=FNO.d,h='<div class="card full" style="margin-top:8px"><div class="row"><h2>F&amp;O positioning · NSE end of day</h2><span class="sub">'+(j&&j.data?esc(j.data.asOf):'')+'</span></div>';
  if(!j)return h+'<div class="sub">Loading…</div></div>';
  if(!j.data)return h+'<div class="warnbox">'+(j.status&&j.status.busy?'Fetching the NSE files…':'The NSE file archive could not be read from the server: '+esc((j.status&&j.status.err)||'no data yet')+'.')+'</div><div class="sub">Source: nsearchives.nseindia.com F&amp;O bhavcopy (free, published after the close). Live F&amp;O needs a broker feed: set <code>UPSTOX_TOKEN</code> (free).</div></div>';
  var d=j.data,P=d.participants||{};
  h+='<div class="scroll"><table><tr><th>Index</th><th class="r" title="put open interest / call open interest, nearest expiry">PCR</th><th class="r" title="strike where option writers pay out least">Max pain</th><th class="r" title="strike with the most call open interest: a ceiling traders defend">Call wall</th><th class="r" title="strike with the most put open interest: a floor traders defend">Put wall</th><th>Futures</th></tr>'+d.indices.map(function(x){var o=x.opt||{},f=x.fut||{};return '<tr><td><b>'+esc(x.sym)+'</b><div class="sub num" style="font-size:11px">'+(x.spot?x.spot.toLocaleString('en-IN'):'')+'</div></td><td class="r num">'+(o.pcr!=null?o.pcr.toFixed(2):'–')+'</td><td class="r num">'+(o.maxPain||'–')+'</td><td class="r num">'+(o.resist&&o.resist[0]?o.resist[0].k:'–')+'</td><td class="r num">'+(o.support&&o.support[0]?o.support[0].k:'–')+'</td><td>'+esc(f.class||'–')+'</td></tr>'}).join('')+'</table></div>';
  if(d.expiryDay){var xe=d.indices.filter(function(x){return x.optExpiring});h+='<div class="sub" style="margin-top:6px"><b>Expiry day.</b> The contracts that expired today are settled, not unwound, so futures build-up uses the next series (open interest summed over all series) and the table above uses the next option expiry.'+(xe.length?' Expiring series today: '+xe.map(function(x){return esc(x.sym)+' PCR '+(x.optExpiring.pcr!=null?x.optExpiring.pcr.toFixed(2):'–')+', max pain '+(x.optExpiring.maxPain||'–')}).join(' · ')+'.':'')+'</div>'}
  if(P.FII){h+='<h3 style="margin:12px 0 4px;font-size:14px">Who holds what · index futures (contracts)</h3><div class="scroll"><table><tr><th>Group</th><th class="r">Net</th><th class="r">Change today</th><th class="r">Long share</th></tr>'+['FII','DII','CLIENT','PRO'].filter(function(k){return P[k]}).map(function(k){var x=P[k];return '<tr><td>'+k+'</td><td class="r num '+cls2(x.futIdxNet)+'">'+fk(x.futIdxNet)+'</td><td class="r num '+cls2(x.dFutIdxNet)+'">'+fk(x.dFutIdxNet)+'</td><td class="r num">'+(x.longPct==null?'–':x.longPct.toFixed(0)+'%')+'</td></tr>'}).join('')+'</table></div>'}
  var B=d.breadth||{},L=d.leaders||{};h+='<h3 style="margin:12px 0 4px;font-size:14px">Stock futures: what the '+(d.breadthOf||120)+' biggest are doing</h3><div class="sub">'+['long buildup','short buildup','short covering','long unwinding'].map(function(k){return k+' <b>'+(B[k]||0)+'</b>'}).join(' · ')+'</div>';
  ['long buildup','short buildup','short covering','long unwinding'].forEach(function(k){var a=L[k]||[];if(a.length)h+='<div class="sub" style="margin-top:6px"><b>'+k+'</b>: '+a.slice(0,6).map(function(x){return esc(x.sym)+' <span class="mut">'+lsgn(x.pricePct)+'% / OI '+lsgn(x.oiPct)+'%</span>'}).join(' · ')+'</div>'});
  h+='<div class="sub" style="margin-top:10px">How to read it: <b>PCR</b> above ~1.2 means more puts than calls were written (supportive), below ~0.7 the reverse; at the extremes it flips to a contrarian signal, so it is context, not a trade. <b>Walls</b> are where most option writers are positioned. <b>Build-up</b> compares price and open-interest change (price up + OI up = new longs). Numbers are the exchange\'s, end of day; nothing here is a forecast, and no bot uses it as a trigger (bot Q prints it next to NIFTY / BANKNIFTY entries for context).</div></div>';
  return h}
function coverageCard(){
  uniFetch();var u=UNI.d,h='<div class="card full" style="margin-top:8px"><h2>Market coverage</h2>';
  if(!u)return h+'<div class="sub">Loading…</div></div>';
  h+='<div class="scroll"><table><tr><th>Market</th><th class="r">Exists</th><th class="r" title="symbols the bots scan and trade">Traded</th><th class="r" title="symbols quoted in the Charts strip">In Charts</th></tr>'+u.rows.map(function(r){return '<tr><td>'+esc(r.label)+'<div class="sub" style="font-size:11px;line-height:1.25">'+esc(r.note||'')+'</div></td><td class="r num">'+esc(String(r.exists))+'<div class="sub" style="font-size:10px">'+esc(r.how||'')+'</div></td><td class="r num">'+r.lab+'</td><td class="r num">'+r.charts+'</td></tr>'}).join('')+'</table></div><div class="sub" style="margin-top:8px">Why not trade everything: a free server gets rate-limited by Yahoo within minutes if it polls thousands of symbols, and most extra symbols would only add correlated bets. Instead the bots trade a liquid watchlist and <b>Charts → search</b> opens any listed symbol on demand.</div></div>';
  return h}
liveOpen();
APPREADY=true;(function(){var h=location.hash.slice(1);if(h&&TABS.some(function(t){return t[0]===h}))ui.tab=h})();renderTabs();try{render()}catch(e){}
