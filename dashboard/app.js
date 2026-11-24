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
if(SERVER&&!TABS.some(function(t){return t[0]==='bot'})){var _li=TABS.map(function(t){return t[0]}).indexOf('lab');TABS.splice(_li>=0?_li+1:TABS.length,0,['bot','Bot page'])}
TABICON.bots='✦';
var APPREADY,APP={mk:'ALL',chmk:'ALL',navStarted:false};
/* nav groups: bottom bar shows the group; the sub-strip under the app bar moves between its pages */
var GROUPS=[{id:'home',label:'Home',ic:'home',tabs:['home']},{id:'markets',label:'Markets',ic:'charts',tabs:['charts','market','setups']},{id:'bots',label:'Accounts',ic:'bots',tabs:['bots','lab','funds'],also:['bot','overview','strategies']},{id:'orders',label:'Orders',ic:'trades',tabs:['trades']}];
function grpOf(tab){for(var i=0;i<GROUPS.length;i++)if(GROUPS[i].tabs.indexOf(tab)>=0||(GROUPS[i].also||[]).indexOf(tab)>=0)return GROUPS[i];return null}
var TABNAME={home:'Home',charts:'Charts',market:'Segments',setups:'Setups',bots:'Accounts',funds:'Funds',lab:'AI Lab',bot:'Bot page',overview:'Paper books',strategies:'Strategies',trades:'Trades',bt:'Backtest',system:'System'};
TABS.forEach(function(t){if(TABNAME[t[0]])t[1]=TABNAME[t[0]]});
function renderTabs(){
  if(!APPREADY)return;
  if(window.SB&&SB.open)sbClose();
  $('#tabs').innerHTML=TABS.map(function(t){return '<button data-tab="'+t[0]+'" class="'+(ui.tab===t[0]?'on':'')+'">'+t[1]+'</button>'}).join('');
  var g=grpOf(ui.tab);
  var nav=GROUPS.map(function(x){return '<button data-tab="'+x.tabs[0]+'" class="'+(g===x?'on':'')+'" aria-label="'+x.label+'"'+(g===x?' aria-current="page"':'')+'>'+ico(x.ic)+x.label+'</button>'}).join('')+'<button data-more="1" class="'+(g?'':'on')+'" aria-label="More">'+ico('more')+'More</button>';
  var n=$('#bnav');if(n)n.innerHTML=nav;
  var sn=$('#subnav');if(sn){var list=g?g.tabs:(ui.tab==='bt'||ui.tab==='system'?['bt','system']:[]);sn.innerHTML=list.length>1?list.map(function(id){var t=TABS.filter(function(x){return x[0]===id})[0];return t?'<button data-tab="'+id+'" class="'+(ui.tab===id?'on':'')+'">'+t[1]+'</button>':''}).join(''):'';var on=sn.querySelector('.on');if(on&&on.scrollIntoView)try{on.scrollIntoView({inline:'center',block:'nearest'})}catch(e){}}
  try{if(location.hash.slice(1)!==tabHash()){history[APP.navStarted?'pushState':'replaceState'](null,'','#'+tabHash())}APP.navStarted=true}catch(e){}
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
    moreItem('bot','Bot pages','One page per bot: positions, trades, decisions, rules','bots')+
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
  var hb=t.closest('[data-bot]');if(hb){LAB.bot=hb.getAttribute('data-bot');try{localStorage.setItem('paperbot4:labbot',LAB.bot)}catch(e){}}
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
homePaint=function(){var el0=$('#homeroot'),hs=hsSave(el0);_homePaint();var el=$('#homeroot');if(el){el.insertAdjacentHTML('afterbegin',heroHtml());if(hs.length)hsRestore(el,hs)}wlFetch()};
document.addEventListener('click',function(e){var w=e.target.closest&&e.target.closest('[data-wl]');if(w){LAB.ch.sym=w.getAttribute('data-wl');LAB.ch.data=null;goTab('charts');try{chLoad(true)}catch(x){}}},true);

/* ---------- Bots screen ---------- */
var BOTROLE={A:'Rule bot · no LLM',B:'LLM trader · decides entries & exits',C:'Rule + LLM approval · with lessons',C0:'Rule + LLM approval · no memory',Q:'Rule + written checklist · no LLM'};
function botCard(b,mk){
  var m=b.byBook[mk]||{},bk=b.books[mk],c=nseClock(),live=mk==='CRYPTO'||c.open,col=BOTCOL[b.id]||'#555',trading=b.open>0;
  var status=trading?'<span class="pill2"><span class="dot on"></span>In trade</span>':live?'<span class="pill2"><span class="dot on"></span>Watching</span>':'<span class="pill2"><span class="dot warn"></span>Market closed</span>';
  return '<button class="bcard" data-tab="bot" data-bot="'+esc(b.id)+'" data-botmk-go="'+mk+'"><div class="top"><span class="av" style="background:'+col+'">'+esc(b.id)+'</span><span class="nmx"><b>'+esc(b.name)+'</b><small>'+esc(BOTROLE[b.id]||b.desc||'')+'</small></span>'+status+'</div>'+
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
/* ---------- Accounts: every account (AI Lab bots + paper books) in one list, grouped by market so currencies never mix ---------- */
(function(){var st=document.createElement('style');st.textContent='.acfil{display:flex;gap:6px;overflow-x:auto;padding:2px 0 6px;scrollbar-width:none}.acfil::-webkit-scrollbar{display:none}.acfil button{flex:0 0 auto;padding:7px 13px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit;font-size:13px;font-weight:600}.acfil button.on{background:var(--ink);color:var(--card);border-color:var(--ink)}.actot{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:4px 0 12px}.actot .x{border:1px solid var(--line);border-radius:16px;background:var(--card);padding:12px 14px}.actot .k{font-size:12px;color:var(--ink2);font-weight:600}.actot .v{font-size:22px;font-weight:750;font-variant-numeric:tabular-nums;margin-top:2px;letter-spacing:-.3px}.actot .p{font-size:12.5px;font-weight:650;margin-top:2px}.acsec{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:14px 2px 6px}.acsec h3{margin:0;font-size:13px;letter-spacing:.3px}.acsec span{font-size:12px;color:var(--ink2);font-variant-numeric:tabular-nums}.aclist{border:1px solid var(--line);border-radius:16px;background:var(--card);overflow:hidden}.acr{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:12px 14px;border:0;border-top:1px solid var(--line);background:none;color:var(--ink);font:inherit}.acr:first-child{border-top:0}.acr:active{background:var(--chip)}.acr .av{flex:0 0 auto;width:36px;height:36px;border-radius:11px;display:grid;place-items:center;color:#fff;font-weight:750;font-size:13px}.acr .av.pb{background:var(--chip);color:var(--ink);border:1px solid var(--line)}.acr .m{flex:1;min-width:0}.acr .m b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.acr .m small{display:block;color:var(--ink2);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.acr .r{text-align:right;flex:0 0 auto}.acr .r b{display:block;font-size:15px;font-variant-numeric:tabular-nums}.acr .r small{font-size:12px;font-weight:650}.acr .chev{color:var(--ink2);font-size:18px;margin-left:-4px}';document.head.appendChild(st)})();
var ACMK=[['ALL','All'],['IN','India ₹'],['CRYPTO','Crypto $'],['GLOBAL','Global $']],ACTY=[['ALL','All types'],['LAB','AI Lab bots'],['BOOK','Paper books']];
try{APP.acmk=localStorage.getItem('paperbot4:acmk')||'ALL';APP.acty=localStorage.getItem('paperbot4:acty')||'ALL'}catch(e){APP.acmk='ALL';APP.acty='ALL'}
var PBABBR={nse:'NI',india:'ET',fno:'FO',instocks:'IS',gstocks:'US',macro:'GL',crypto:'CR'};
function accounts(){
  var out=[],L=LAB.d,F=PRO.funds,FS={};(PRO.feeds&&PRO.feeds.slots||[]).forEach(function(s){FS[s.slot]=s});
  if(L)L.bots.forEach(function(b){['IN','CRYPTO'].forEach(function(k){var bk=b.books&&b.books[k];if(!bk)return;var m=b.byBook&&b.byBook[k]||{};
    out.push({kind:'LAB',mk:k,id:b.id,name:b.name,sub:'AI Lab · '+(BOTROLE[b.id]||b.desc||''),cur:bk.cur,eq:bk.equity,start:bk.start,pct:bk.pnlPct,open:m.open||0,trades:m.trades||0,col:BOTCOL[b.id]||'#555',attr:'data-tab="bot" data-bot="'+esc(b.id)+'" data-botmk-go="'+k+'"'})})});
  if(F&&F.books)F.books.forEach(function(x){if(x.practice)return;var mk=SLOTMK[x.slot]||'IN',fs=FS[x.slot]||{},live=fs.feed==='live';
    out.push({kind:'BOOK',mk:mk,id:x.slot,name:slotShort(x.label),sub:'Paper book · '+(!x.ready?'not running yet':live?'live':(fs.feed||'idle'))+(x.strategies?' · '+x.strategies.join(', '):''),cur:x.currency||(mk==='IN'?'₹':'$'),eq:x.ready?x.equity:null,start:x.start,pct:x.ready?x.pnlPct:null,open:x.open||0,trades:x.trades||0,ready:x.ready,attr:'data-goslot="'+esc(x.slot)+'"'})});
  return out;
}
function acRow(a){
  var av=a.kind==='LAB'?'<span class="av" style="background:'+a.col+'">'+esc(a.id)+'</span>':'<span class="av pb">'+esc(PBABBR[a.id]||a.id.slice(0,2).toUpperCase())+'</span>';
  return '<button class="acr" '+a.attr+'>'+av+'<span class="m"><b>'+esc(a.name)+'</b><small>'+esc(a.sub)+(a.open?' · '+a.open+' open':'')+'</small></span><span class="r"><b>'+(a.eq==null?'–':money(a.cur,a.eq))+'</b><small class="'+plCls(a.pct)+'">'+(a.pct==null?'&nbsp;':plPct(a.pct))+'</small></span><span class="chev">›</span></button>';
}
function botsPaint(force){
  var el=$('#botsroot');if(!el)return;
  if(!force){if(scrolling()){DIRTY.bots=1;return}}
  DIRTY.bots=0;
  var all=accounts(),mk=APP.acmk,ty=APP.acty,h='';
  var shown=all.filter(function(a){return (mk==='ALL'||a.mk===mk)&&(ty==='ALL'||a.kind===ty)});
  /* totals per currency for what is shown (rupees and dollars are never added together) */
  var T={};shown.forEach(function(a){if(a.eq==null)return;var t=T[a.cur]||(T[a.cur]={e:0,s:0,n:0});t.e+=a.eq;t.s+=a.start;t.n++});
  h+='<div class="actot">'+(Object.keys(T).length?Object.keys(T).map(function(c){var t=T[c],pl=t.e-t.s;return '<div class="x"><div class="k">Total in '+(c==='₹'?'rupees':'dollars')+' · '+t.n+' accounts</div><div class="v">'+money(c,t.e)+'</div><div class="p '+plCls(pl)+'">'+(pl>=0?'+':'−')+c+num(Math.abs(pl),Math.abs(pl)<100?2:0)+' · '+plPct(t.s?pl/t.s:0)+'</div></div>'}).join(''):'<div class="skel" style="height:84px"></div><div class="skel" style="height:84px"></div>')+'</div>';
  h+='<div class="acfil">'+ACMK.map(function(o){return '<button data-acmk="'+o[0]+'" class="'+(mk===o[0]?'on':'')+'">'+o[1]+'</button>'}).join('')+'</div>';
  h+='<div class="acfil">'+ACTY.map(function(o){return '<button data-acty="'+o[0]+'" class="'+(ty===o[0]?'on':'')+'">'+o[1]+'</button>'}).join('')+'</div>';
  [['IN','India · rupees'],['CRYPTO','Crypto · dollars'],['GLOBAL','Global stocks & commodities · dollars']].forEach(function(sec){
    var A=shown.filter(function(a){return a.mk===sec[0]});if(!A.length)return;
    var e=0,s=0,c=A[0].cur;A.forEach(function(a){if(a.eq!=null){e+=a.eq;s+=a.start}});
    h+='<div class="acsec"><h3>'+sec[1]+'</h3><span>'+money(c,e)+' · <b class="'+plCls(e-s)+'">'+plPct(s?(e-s)/s:0)+'</b></span></div><div class="aclist">'+A.map(acRow).join('')+'</div>';
  });
  if(!all.length)h+='<div class="aclist"><div class="skel" style="height:62px"></div><div class="skel" style="height:62px;margin-top:2px"></div></div>';
  else if(!shown.length)h+='<div class="card sub" style="margin-top:10px">No accounts match these filters.</div>';
  /* open positions stay here until the Activity page replaces them */
  var ps=allPos(),counts={ALL:ps.length,IN:0,CRYPTO:0,GLOBAL:0};ps.forEach(function(p){if(counts[p.mk]!=null)counts[p.mk]++});
  var sp=ps.filter(function(p){return APP.mk==='ALL'||p.mk===APP.mk});
  h+='<div class="sect" id="botspos" style="scroll-margin-top:120px;margin-top:16px"><h3>Open positions · '+sp.length+'</h3>'+mkSelect('posmk',APP.mk,counts)+'</div>';
  h+='<div class="card">'+(sp.length?sp.slice(0,40).map(posRow).join(''):'<div class="sub">'+((LAB.d&&PRO.pos)?'No open positions'+(APP.mk==='ALL'?'':' in this market')+'.':'Loading…')+'</div>')+'</div>';
  h+='<div class="hint" style="margin:12px 2px">AI Lab bots and paper books are separate pots of paper money. Tap any account to see its page. Start amounts and sizing can be changed on <a href="#funds" data-tab="funds">Funds</a>.</div>';
  if(el.__h===h&&el.firstElementChild)return;
  el.__h=h;setHTML(el,h);
}
document.addEventListener('click',function(e){var t=e.target;if(!t.closest)return;var x;
  if((x=t.closest('[data-acmk]'))){APP.acmk=x.getAttribute('data-acmk');try{localStorage.setItem('paperbot4:acmk',APP.acmk)}catch(er){}botsPaint(true);return}
  if((x=t.closest('[data-acty]'))){APP.acty=x.getAttribute('data-acty');try{localStorage.setItem('paperbot4:acty',APP.acty)}catch(er){}botsPaint(true);return}
});
function botsTab(){
  if(!$('#botsroot')){$('#view').innerHTML='<div id="botsroot"></div>';botsPaint()}
  if(Date.now()-LAB.at>8000)labFetch();posFetch();
  if(!PRO.fundsBusy&&!(liveFresh()&&PRO.funds)&&Date.now()-(PRO.fundsAt||0)>8000){PRO.fundsBusy=true;jf('/api/funds').then(function(j){PRO.funds=j;PRO.fundsAt=Date.now();PRO.fundsBusy=false;if(ui.tab==='bots')botsPaint()}).catch(function(){PRO.fundsBusy=false})}
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
/* ---------- editable amounts (admin token). Defaults are the original values; "Reset" restores them. ---------- */
(function(){var st=document.createElement('style');st.textContent='.fedit{border:1px dashed var(--line);border-radius:12px;padding:10px;margin-top:10px;display:grid;gap:8px}.ffld{display:grid;gap:3px;font-size:12.5px}.ffld span{color:var(--ink2);font-weight:600}.ffld input{width:100%;box-sizing:border-box;padding:9px 10px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit;font-size:15px}.ffld small{color:var(--ink2);font-size:11.5px}.fbtns{display:flex;flex-wrap:wrap;gap:8px;margin-top:2px}.fbtns button,.fbtn{padding:8px 12px;border-radius:10px;border:1px solid var(--line);background:var(--chip);color:var(--ink);font:inherit;font-size:13px;font-weight:650}.fbtns button.pri{background:var(--ink);color:var(--card);border-color:var(--ink)}.fbtn{margin-top:8px}.fnote2{font-size:12px;color:var(--ink2);line-height:1.4}';document.head.appendChild(st)})();
function ffield(id,label,val,def,min,max,step,unit){return '<label class="ffld"><span>'+label+'</span><input data-ff="'+id+'" type="number" inputmode="decimal" min="'+min+'" max="'+max+'" step="'+step+'" value="'+val+'"><small>default '+def+(unit||'')+(String(val)!==String(def)?' · changed':'')+'</small></label>'}
function fform(key,fields,note){return '<div class="fedit" data-fform="'+key+'">'+fields+'<div class="fnote2">'+note+'</div><div class="fbtns"><button class="pri" data-fsave="'+key+'">Save</button><button data-freset="'+key+'">Reset to defaults</button><button data-fcancel="1">Cancel</button></div></div>'}
function fLabEdit(F){var e=F.labCfg&&F.labCfg.edit;if(!e)return '';
  var h='<div class="sect"><h3>AI Lab amounts</h3></div><div class="fa"><div class="h"><div class="t"><b>Start amount, risk and size</b><small>shared by all lab bots · '+(e.overridden.length?e.overridden.length+' changed from default':'all at default')+'</small></div></div>';
  if(APP.fedit!=='lab')return h+'<button class="fbtn" data-fedit="lab">Edit amounts</button></div>';
  var v=e.values,d=e.defaults,L=e.limits;
  return h+fform('lab',ffield('startIN','India start amount (₹)',v.startIN,d.startIN,L.startIN[0],L.startIN[1],'any')+ffield('startCRYPTO','Crypto start amount ($)',v.startCRYPTO,d.startCRYPTO,L.startCRYPTO[0],L.startCRYPTO[1],'any')+ffield('riskPct','Risk per trade (% of equity at the stop)',v.riskPct,d.riskPct,L.riskPct[0],L.riskPct[1],'any','%')+ffield('maxNotional','Max size of one trade (× equity)',v.maxNotional,d.maxNotional,L.maxNotional[0],L.maxNotional[1],'any','×')+ffield('maxPos','Max open trades per market',v.maxPos,d.maxPos,L.maxPos[0],L.maxPos[1],'1'),
    'Risk % and max size cap how big each new trade is, so lowering them is the safest way to cut exposure. A new start amount works like a deposit or withdrawal: profit and loss stay as they are. Open trades keep their size; changes apply to the next entry.')+'</div>'}
function fBookEdit(b){var e=b.edit;if(!e||!e.editable)return '';
  if(APP.fedit!==b.slot)return '<button class="fbtn" data-fedit="'+b.slot+'">Edit amounts'+(e.edited?' · changed':'')+'</button>';
  var v=e.values,d=e.defaults,L=e.limits,f=ffield('startBalance','Start amount ('+b.currency+')',v.startBalance,d.startBalance,L.startBalance[0],L.startBalance[1],'any');
  if(v.maxPositions!=null)f+=ffield('maxPositions','Max open positions',v.maxPositions,d.maxPositions,L.maxPositions[0],L.maxPositions[1],'1');
  if(v.sizePct!=null)f+=ffield('sizePct','Size of each trade (% of equity)',v.sizePct,d.sizePct,L.sizePct[0],Math.min(L.sizePct[1],e.capPct||L.sizePct[1]),'any','%');
  return fform(b.slot,f,'A new start amount works like a deposit or withdrawal: profit and loss stay as they are. You can only withdraw cash that is not in open positions. Open positions keep their size; changes apply to the next entry.')}
function fSave(key,reset){
  var tk=labToken();if(!tk)return;var box=document.querySelector('.fedit[data-fform="'+key+'"]'),patch={};
  if(reset)patch.reset=true;else if(box)Array.prototype.forEach.call(box.querySelectorAll('input[data-ff]'),function(i){patch[i.getAttribute('data-ff')]=i.value});
  var url='/api/lab/cfg';if(key!=='lab'){url='/api/funds/set';patch.slot=key}
  fetch(url,{method:'POST',headers:{'x-admin-token':tk,'Content-Type':'application/json'},body:JSON.stringify(patch)}).then(function(r){if(r.status===401){try{sessionStorage.removeItem('pbtoken')}catch(e){}say('Wrong or missing admin token (ADMIN_TOKEN on Render).');return null}return r.json().then(function(j){return {ok:r.ok,j:j}})}).then(function(x){
    if(!x)return;if(!x.ok){say(x.j&&x.j.error||'Not saved');return}
    say(x.j.changed&&x.j.changed.length?'Saved · '+x.j.changed.join(' · '):'Nothing changed');APP.fedit=null;
    jf('/api/funds').then(function(j){PRO.funds=j;PRO.fundsAt=Date.now();fundsPaint(true)}).catch(function(){fundsPaint(true)})}).catch(function(){say('Could not reach the server')})}
document.addEventListener('click',function(e){var t=e.target;if(!t.closest)return;
  var a=t.closest('[data-fedit]');if(a){var k=a.getAttribute('data-fedit');APP.fedit=APP.fedit===k?null:k;fundsPaint(true);return}
  if(t.closest('[data-fcancel]')){APP.fedit=null;fundsPaint(true);return}
  var s=t.closest('[data-fsave]');if(s){fSave(s.getAttribute('data-fsave'),false);return}
  var r=t.closest('[data-freset]');if(r){fSave(r.getAttribute('data-freset'),true);return}});
function fundsPaint(force){
  var el=$('#fundsroot');if(!el)return;
  if(!force){if(APP.fedit){DIRTY.funds=1;return}if(scrolling()){DIRTY.funds=1;return}var ae=document.activeElement;if(ae&&ae.tagName==='SELECT'&&el.contains(ae))return}
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
  h+=fLabEdit(F);
  /* AI Lab */
  ['CRYPTO','IN'].forEach(function(k){
    var L=lab.filter(function(a){return a.book===k});if(!L.length)return;var c=L[0].currency;
    h+='<div class="sect"><h3>AI Lab · '+(k==='CRYPTO'?'Crypto':'India')+' accounts</h3><span class="hint">'+money(c,L[0].start)+' each</span></div><div class="fgrid">';
    L.forEach(function(a){var pl=a.equity-a.start,over=a.exposure>1;
      h+='<div class="fa"><div class="h"><span class="av" style="width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:#fff;font-weight:700;background:'+(BOTCOL[a.bot]||'#555')+'">'+esc(a.bot)+'</span><div class="t"><b>'+esc(a.name)+'</b><small>its own money</small></div><div class="e"><b>'+money(c,a.equity)+'</b><small class="'+plCls(pl)+'">'+plPct(a.start?pl/a.start:0)+'</small></div></div>'+
        fgauge(a.exposure)+'<div class="hint" style="margin-bottom:4px">'+(a.open?money(c,a.notional)+' in '+a.open+' open trade'+(a.open>1?'s':'')+' · '+a.exposure.toFixed(2)+'× equity':'nothing in use')+'</div>'+
        frow('Start'+(((F.labCfg.edit||{}).overridden||[]).indexOf(k==='IN'?'startIN':'startCRYPTO')>=0?' (edited)':' (set by '+a.env+')'),money(c,a.start))+frow('Closed-trade P&amp;L, after fees',sgn(c,a.realized),plCls(a.realized))+frow('Open-trade P&amp;L',sgn(c,a.unrealized),plCls(a.unrealized))+frow('Fees paid',money(c,a.fees))+
        frow('Max loss if every open stop hits',money(c,a.riskAtStop)+(a.equity>0?' ('+(a.riskAtStop/a.equity*100).toFixed(1)+'%)':''))+frow('Open slots',a.open+' / '+a.maxPos)+frow('Closed trades',String(a.trades))+
        (over?'<span class="ftag w">exposure above 1× equity — the lab has no margin check</span>':'')+'<button class="fbtn" data-tab="bot" data-bot="'+esc(a.bot)+'" data-botmk-go="'+k+'">Open bot page →</button></div>'});
    h+='</div>'});
  /* paper books */
  if(bk.length){h+='<div class="sect"><h3>Paper books · own engine, own cash</h3></div><div class="fgrid">';
    bk.forEach(function(b){
      if(!b.ready){h+='<div class="fa"><div class="h"><div class="t"><b>'+esc(slotShort(b.label))+'</b><small>not running yet · no balance to show</small></div></div></div>';return}
      var c=b.currency,use=b.equity>0?b.inPositions/b.equity:0;
      h+='<div class="fa"><div class="h"><div class="t"><b>'+esc(slotShort(b.label))+'</b><small>'+(b.practice?'practice replay · not live money':'its own cash')+(b.strategies?' · '+esc(b.strategies.join(', ')):'')+'</small></div><div class="e"><b>'+money(c,b.equity)+'</b><small class="'+plCls(b.pnl)+'">'+plPct(b.pnlPct)+'</small></div></div>'+
        fgauge(use)+'<div class="hint" style="margin-bottom:4px">'+(b.open?money(c,b.inPositions)+' in '+b.open+' position'+(b.open>1?'s':'')+' · '+(use*100).toFixed(0)+'% of equity':'nothing in use')+'</div>'+
        frow('Start'+(b.edit&&b.edit.edited?' (edited)':b.env?' (set by '+b.env+')':' (fixed in code)'),money(c,b.start))+frow('Free cash',money(c,b.cash))+frow('In open positions',money(c,b.inPositions))+frow('Closed-trade P&amp;L',sgn(c,b.realized),plCls(b.realized))+frow('Open-trade P&amp;L',sgn(c,b.unrealized),plCls(b.unrealized))+
        (b.fees!=null?frow('Fees paid',money(c,b.fees)):'')+frow('Open positions',b.open+(b.maxPositions?' / '+b.maxPositions:''))+frow('Closed trades',String(b.trades))+
        '<span class="ftag'+(b.restored?'':' w')+'">'+(b.restored?'balance restored from '+esc(b.restored)+' at boot':'started fresh at boot — no saved state was found')+'</span>'+(b.halted?'<span class="ftag w">halted by drawdown limit</span>':'')+fBookEdit(b)+'</div>'});
    h+='</div>'}
  h+='<div class="sect"><h3>How to read this</h3></div><div class="fnote">Every account is virtual paper money and trades only its own balance. AI Lab accounts and paper books are separate: the same BTC or Nifty move can appear in both, so do not add them as one pool. AI Lab sizes each trade by risk ('+(F.labCfg.riskPct!=null?(F.labCfg.riskPct*100).toFixed(1):'?')+'% of equity at the stop, up to '+(F.labCfg.maxNotional!=null?F.labCfg.maxNotional+'× equity':'?')+' per trade, '+(F.labCfg.maxPos||'?')+' slots) and does not deduct cash when a trade opens, so "in use" there is exposure, not spent money. Paper books do track cash. Use Edit amounts to change an account\'s start amount, trade size and slots (admin token needed). The original values are kept as defaults, so Reset puts them back. Changing a start amount acts like a deposit or withdrawal: profit and loss stay as they are.</div>';
  if(el.__h===h&&el.firstElementChild)return;el.__h=h;setHTML(el,h);
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
  else if(t==='bot'){if(now-LIVE.labAt>4000){LIVE.labAt=now;botPgPaint()}}
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
   '<h4>Portfolio</h4>'+sbItem('funds','Funds','overview')+sbItem('bots','Positions','trades',np,' data-sbjump="botspos"')+sbItem('trades','Orders','trades')+sbItem('overview','Paper books','overview')+sbItem('bot','Bot pages','bots')+
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
setInterval(function(){if(scrolling())return;if(DIRTY.lab&&ui.tab==='lab')labPaint();if(DIRTY.botpg&&ui.tab==='bot')botPgPaint();if(DIRTY.home&&ui.tab==='home')homePaint();if(DIRTY.bots&&ui.tab==='bots')botsPaint();if(DIRTY.funds&&ui.tab==='funds')fundsPaint()},400);
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
/* ---------- AI Lab bot pages: one page per bot, with its own data options (like the paper-book segment pages) ---------- */
(function(){var st=document.createElement('style');st.textContent='.bpstrip{display:flex;gap:8px;overflow-x:auto;padding:2px 0 8px;scrollbar-width:none}.bpstrip::-webkit-scrollbar{display:none}.bpb{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border-radius:14px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit}.bpb.on{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}.bpb .av{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;color:#fff;font-weight:700;font-size:12px}.bpb b{display:block;font-size:12.5px;line-height:1.1}.bpb small{font-size:11.5px;font-weight:650}.bpsub{display:flex;gap:6px;overflow-x:auto;padding:0 0 8px;scrollbar-width:none}.bpsub::-webkit-scrollbar{display:none}.bpsub button{flex:0 0 auto;padding:7px 13px;border-radius:999px;border:1px solid var(--line);background:var(--chip);color:var(--ink);font:inherit;font-size:13px;font-weight:600}.bpsub button.on{background:var(--ink);color:var(--card);border-color:var(--ink)}.bptop{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:2px 0 8px}.bpback{border:0;background:none;color:var(--ink2);font:inherit;font-size:14px;font-weight:600;padding:6px 2px}.bptiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:8px 0}.bpt{border:1px solid var(--line);border-radius:14px;background:var(--card);padding:10px 12px}.bpt .k{font-size:11.5px;color:var(--ink2);font-weight:600}.bpt .v{font-size:19px;font-weight:700;font-variant-numeric:tabular-nums;margin-top:2px}.bpt .s{font-size:11.5px;color:var(--ink2);margin-top:2px}.bpn{display:flex;justify-content:space-between;gap:10px;margin-top:10px}.bpn button{flex:1;padding:10px;border-radius:12px;border:1px solid var(--line);background:var(--chip);color:var(--ink);font:inherit;font-weight:600}';document.head.appendChild(st)})();
var BSUBS=[['overview','Overview'],['positions','Positions'],['trades','Trades'],['decisions','Decisions'],['lessons','Lessons'],['rules','Rules']];
var BOTHOW={A:'EMA20/50 trend with ADX and RSI filters. Enters when the rule fires, sets an ATR stop and target, and holds at most 48 bars. This is the benchmark every other bot is compared against.',B:'An LLM reads an anonymised indicator snapshot and decides whether to enter, and can exit early. Code sets the size and enforces the stop and target, so the LLM cannot override risk. Judged on forward results only.',C:'Takes the rule bot\'s signals only. An LLM can approve, shrink or veto each one, and learns lessons from its closed trades. A lesson only changes size after later trades confirm it.',C0:'Same as the hybrid bot but with memory off. The gap between C and C0 shows whether the lessons help at all.',Q:'Takes the rule bot\'s signals only if a written checklist passes: not chasing a move, room to move, trend strength, and a cap on same-direction trades. No LLM, no credits.'};
try{LAB.bsub=localStorage.getItem('paperbot4:labbsub')||'overview'}catch(e){LAB.bsub='overview'}
if(!BSUBS.some(function(x){return x[0]===LAB.bsub}))LAB.bsub='overview';
if(!LAB.bot){try{LAB.bot=localStorage.getItem('paperbot4:labbot')||null}catch(e){}}
var bpEq=null;
function bpTrades(L,id,mk){return (L.trades||[]).filter(function(t){return t.bot===id&&t.book===mk})}
function bpHead(L,b,mk,sub){
  var h='<div class="bptop"><button class="bpback" data-tab="lab">‹ AI Lab</button><span class="seg">'+['IN','CRYPTO'].map(function(k){return '<button data-bpmk="'+k+'" class="'+(mk===k?'on':'')+'">'+MKT[k]+'</button>'}).join('')+'</span></div>';
  h+='<div class="bpstrip">'+L.bots.map(function(x){var bk=x.books[mk]||{};return '<button class="bpb'+(x.id===b.id?' on':'')+'" data-bpbot="'+esc(x.id)+'"><span class="av" style="background:'+(BOTCOL[x.id]||'#555')+'">'+esc(x.id)+'</span><span><b>'+esc(x.name)+'</b><small class="'+plCls(bk.pnlPct)+'">'+plPct(bk.pnlPct)+'</small></span></button>'}).join('')+'</div>';
  h+='<div class="bpsub">'+BSUBS.filter(function(s){return s[0]!=='lessons'||b.id==='C'}).map(function(s){return '<button data-bpsub="'+s[0]+'" class="'+(sub===s[0]?'on':'')+'">'+s[1]+'</button>'}).join('')+'</div>';
  return h;
}
function bpTile(k,v,s,cls){return '<div class="bpt"><div class="k">'+k+'</div><div class="v '+(cls||'')+'">'+v+'</div>'+(s?'<div class="s">'+s+'</div>':'')+'</div>'}
function bpOverview(L,b,mk){
  var m=b.byBook[mk]||{},bk=b.books[mk]||{},cur=bk.cur||'$',T=bpTrades(L,b.id,mk),vs=b.vsRule,h='';
  var ci=m.hitCI?lpct(m.hitCI[0],0)+'–'+lpct(m.hitCI[1],0)+' (95%)':'';
  h+='<div class="bptiles">'+bpTile('Account value',money(cur,bk.equity),'started with '+money(cur,bk.start))+bpTile('Profit / loss',plPct(bk.pnlPct),(bk.equity-bk.start>=0?'+':'−')+cur+num(Math.abs(bk.equity-bk.start),Math.abs(bk.equity-bk.start)<100?2:0)+' after fees',plCls(bk.pnlPct))+
    bpTile('Closed trades',String(m.trades||0),m.trades<30?'tiny sample — do not rank yet':m.trades<100?'weak sample':'')+bpTile('Hit rate',m.hit==null?'–':Math.round(m.hit*100)+'%',ci)+
    bpTile('Expectancy',m.expR==null?'–':rfmt(m.expR),'average result per trade, in R',m.expR>0?'pos2':m.expR<0?'neg2':'')+bpTile('Worst drawdown',bk.maxDD==null?'–':(bk.maxDD*100).toFixed(1)+'%','from the equity peak')+
    bpTile('Open now',String(m.open||0),'of '+((L.cfg&&L.cfg.maxPos)||3)+' slots')+bpTile(b.id==='A'?'Role':'vs rule bot',b.id==='A'?'Benchmark':(vs&&vs.mean!=null?lsgn(vs.mean)+'R/day':'–'),b.id==='A'?'others are compared to it':(vs&&vs.ci?'['+lsgn(vs.ci[0])+', '+lsgn(vs.ci[1])+']':'needs 5+ days'),vs&&vs.mean>0?'pos2':vs&&vs.mean<0?'neg2':'')+'</div>';
  if(b.stats&&(b.stats.vetoed||b.stats.unreviewed||b.stats.skipped))h+='<div class="hint" style="margin:-2px 0 8px">Vetoed '+(b.stats.vetoed||0)+' · could not be reviewed '+(b.stats.unreviewed||0)+' · skipped '+(b.stats.skipped||0)+' (all markets)</div>';
  h+='<div class="card"><h2>Equity, % of start · '+MKT[mk]+'</h2><div class="lwc" data-h="200" id="bpeqc"></div></div>';
  if(T.length){
    var grp=function(keyf){var o={};T.forEach(function(t){var k=keyf(t);(o[k]=o[k]||{n:0,w:0,r:0,pnl:0});o[k].n++;if(t.r>0)o[k].w++;o[k].r+=t.r;o[k].pnl+=t.pnl});return o};
    var row=function(k,g){return '<tr><td>'+esc(k)+'</td><td class="r num">'+g.n+'</td><td class="r num">'+Math.round(g.w/g.n*100)+'%</td><td class="r num '+cls2(g.r)+'">'+lsgn(g.r/g.n)+'</td><td class="r num '+cls2(g.pnl)+'">'+money(cur,g.pnl)+'</td></tr>'};
    var tbl=function(title,o,lim){var ks=Object.keys(o).sort(function(a,c){return o[c].n-o[a].n}).slice(0,lim||12);return '<div class="card" style="margin-top:8px"><h2>'+title+'</h2><div class="scroll"><table><tr><th></th><th class="r">Trades</th><th class="r">Hit</th><th class="r">Avg R</th><th class="r">Net</th></tr>'+ks.map(function(k){return row(k,o[k])}).join('')+'</table></div></div>'};
    h+='<div class="hint" style="margin:10px 2px 0">Splits below use this bot\'s latest '+T.length+' closed trades in this market.</div>';
    h+=tbl('Long vs short',grp(function(t){return t.side}))+tbl('How trades ended',grp(function(t){return t.reason||'–'}))+tbl('By instrument',grp(function(t){return t.name||t.sym}),8);
  }else h+='<div class="card" style="margin-top:8px"><div class="sub">No closed trades in this market yet, so there is nothing to split.</div></div>';
  return h;
}
function bpPositions(L,b,mk){
  var P=(L.positions||[]).filter(function(p){return p.bot===b.id&&(p.cur==='₹')===(mk==='IN')}),oth=(L.positions||[]).filter(function(p){return p.bot===b.id&&(p.cur==='₹')!==(mk==='IN')}).length;
  var h='<div class="card"><h2>Open positions · '+MKT[mk]+'</h2>'+(P.length?P.map(function(p){return '<div class="pos"><div class="row"><b>'+esc(p.side)+' '+esc(p.name)+'</b><span class="num '+cls2(p.r)+'">'+lsgn(p.r)+'R</span></div><div class="sub num">in '+p.cur+p.entry.toFixed(2)+' · now '+p.cur+p.last.toFixed(2)+' · stop '+p.stop.toFixed(2)+(p.target?' · target '+p.target.toFixed(2):'')+' · P&amp;L '+money(p.cur,p.pnl)+'</div><div class="sub">opened '+istStr(p.openT)+' IST · '+esc((p.why||'').slice(0,480))+'</div></div>'}).join(''):'<div class="sub">No open positions in this market.</div>')+'</div>';
  if(oth)h+='<div class="hint" style="margin:8px 2px">'+oth+' more open in the other market — switch the market above.</div>';
  return h;
}
function bpTradesTab(L,b,mk){
  var T=bpTrades(L,b.id,mk),h='<div class="card"><h2>Closed trades · '+MKT[mk]+' (IST)</h2>';
  if(!T.length)return h+'<div class="sub">No closed trades yet in this market.</div></div>';
  return h+'<div class="hint" style="margin-bottom:6px">Latest '+T.length+' trades, newest first.</div>'+T.map(function(t){return '<div class="pos"><div class="row"><b>'+esc(t.side)+' '+esc(t.name)+'</b><span class="num '+cls2(t.r)+'">'+lsgn(t.r)+'R · '+money(t.cur,t.pnl)+'</span></div><div class="sub num">'+istStr(t.openT)+' → '+istStr(t.closeT)+' · in '+t.cur+t.entry.toFixed(2)+' · out '+t.cur+t.exit.toFixed(2)+' · '+esc(t.reason)+'</div>'+(t.why?'<div class="sub">'+esc(String(t.why).slice(0,300))+'</div>':'')+'</div>'}).join('')+'</div>';
}
function bpDecisions(L,b){
  var D=(L.decisions||[]).filter(function(x){return x.bot===b.id}).slice(0,60);
  return '<div class="card"><h2>Decision log · bot '+esc(b.id)+' (IST)</h2>'+(D.length?'<div class="scroll"><table><tr><th>Time</th><th>Symbol</th><th>Kind</th><th>Detail</th></tr>'+D.map(function(x){return '<tr><td class="num">'+new Date(x.t+19800000).toISOString().slice(5,16).replace('T',' ')+'</td><td>'+esc(x.sym)+'</td><td><span class="badge">'+esc(x.kind)+'</span></td><td>'+esc(x.text)+'</td></tr>'}).join('')+'</table></div><div class="hint" style="margin-top:6px">Shows this bot\'s entries in the lab\'s latest 80 decisions.</div>':'<div class="sub">Nothing recent from this bot in the lab\'s latest decisions.</div>')+'</div>';
}
function bpRules(L,b,mk){
  var c=L.cfg||{},q=L.qcfg||{},fee=(c.feeBps||{})[mk],slip=(c.slipBps||{})[mk],h='<div class="card"><h2>How bot '+esc(b.id)+' decides</h2><div class="sub" style="font-size:13.5px;line-height:1.45">'+esc(BOTHOW[b.id]||b.desc||'')+'</div></div>';
  var rows=[['Risk per trade',(c.riskPct!=null?(+c.riskPct).toFixed(2):'–')+'% of equity at the stop'],['Stop / target',(c.stopAtr||'–')+' / '+(c.targetAtr||'–')+' × ATR'],['Max hold','48 bars of 15 minutes'],['Cost gate','skips a trade if fees + slippage exceed '+(c.maxCostR||'–')+'R'],['Fees + slippage ('+MKT[mk]+')',(fee!=null?fee:'–')+' + '+(slip!=null?slip:'–')+' bps per side'],['Start amount',money(((b.books[mk]||{}).cur)||'$',(b.books[mk]||{}).start)+' (shared by all bots in this market)']];
  if(b.id==='Q')rows.push(['Checklist','trend strength (ADX) ≥ '+q.adx+' · ≤ '+q.ext+' ATR from the average · ≥ '+q.room+' ATR of room · ≤ '+q.cap+' trades in the same direction']);
  if(b.id==='B'||b.id==='C'||b.id==='C0'){var l=L.llm||{};rows.push(['LLM',l.paused?'paused — no new entries or reviews':(l.configured?'on · '+(l.model||'model set')+' · '+(l.calls||0)+' calls today':'no API key set')])}
  return h+'<div class="card" style="margin-top:8px"><h2>Live settings</h2>'+rows.map(function(r){return frow(r[0],r[1])}).join('')+'</div><div class="hint" style="margin:8px 2px">Same data, fees and sizing for every bot, so differences come from the decision logic only. Amounts can be changed on the Funds tab.</div>';
}
function bpEquity(L,b,mk){
  var host=$('#bpeqc');if(!host||!LW)return;if(bpEq){try{bpEq.remove()}catch(e){}bpEq=null}
  var st=(L.cfg.books||{})[mk],c=((L.curves||{})[b.id]||{})[mk]||[],pts=[],last=0;
  c.forEach(function(p){var t=p[0]+19800;if(t>last&&st){pts.push({time:t,value:(p[1]/st-1)*100});last=t}});
  if(pts.length<2){host.outerHTML='<div class="sub">The curve appears after this bot\'s first closed trades.</div>';return}
  var chart=LW.createChart(host,{width:Math.max(260,host.clientWidth),height:200,layout:{background:{type:'solid',color:'transparent'},textColor:cssv('--ink2'),fontSize:11,attributionLogo:true},grid:{vertLines:{color:cssv('--grid')},horzLines:{color:cssv('--grid')}},rightPriceScale:{borderColor:cssv('--line')},timeScale:{borderColor:cssv('--line'),timeVisible:true,secondsVisible:false}});bpEq=chart;
  var s=chart.addSeries(LW.LineSeries,{color:BOTCOL[b.id]||'#555',lineWidth:2,priceLineVisible:false,lastValueVisible:true,priceFormat:{type:'custom',formatter:function(v){return v.toFixed(2)+'%'}}});s.setData(pts);chart.timeScale().fitContent();
}
function botPgPaint(force){
  var el=$('#botpgroot');if(!el)return;
  if(!force){if(scrolling()){DIRTY.botpg=1;return}}
  DIRTY.botpg=0;var L=LAB.d;
  if(!L||!L.bots||!L.bots.length){el.innerHTML='<div class="card sub">Loading bot…</div>';return}
  var ids=L.bots.map(function(x){return x.id});if(!LAB.bot||ids.indexOf(LAB.bot)<0)LAB.bot=ids[0];
  var b=L.bots.filter(function(x){return x.id===LAB.bot})[0],mk=LAB.mk,sub=LAB.bsub;
  if(sub==='lessons'&&b.id!=='C'){sub=LAB.bsub='overview'}
  var body={overview:bpOverview,positions:bpPositions,trades:bpTradesTab,decisions:bpDecisions,lessons:function(L2){return labLessons(L2)},rules:bpRules}[sub]||bpOverview;
  var h=bpHead(L,b,mk,sub)+body(L,b,mk);
  var i=ids.indexOf(b.id),pv=L.bots[(i+ids.length-1)%ids.length],nx=L.bots[(i+1)%ids.length];
  h+='<div class="bpn"><button data-bpbot="'+esc(pv.id)+'">‹ '+esc(pv.id)+' · '+esc(pv.name)+'</button><button data-bpbot="'+esc(nx.id)+'">'+esc(nx.id)+' · '+esc(nx.name)+' ›</button></div>';
  if(el.__h===h&&el.firstElementChild)return;
  el.__h=h;setHTML(el,h);if(sub==='overview')bpEquity(L,b,mk);
  document.title='PaperBot · Bot '+b.id+' · '+b.name;
}
document.addEventListener('click',function(e){var t=e.target;if(!t.closest||ui.tab!=='bot')return;var x;
  if((x=t.closest('[data-bpbot]'))){LAB.bot=x.getAttribute('data-bpbot');try{localStorage.setItem('paperbot4:labbot',LAB.bot)}catch(er){}try{history.replaceState(null,'','#'+tabHash())}catch(er){}botPgPaint(true);window.scrollTo(0,0);return}
  if((x=t.closest('[data-bpsub]'))){LAB.bsub=x.getAttribute('data-bpsub');try{localStorage.setItem('paperbot4:labbsub',LAB.bsub)}catch(er){}botPgPaint(true);return}
  if((x=t.closest('[data-bpmk]'))){LAB.mk=x.getAttribute('data-bpmk');botPgPaint(true);return}
});
window.addEventListener('resize',function(){if(ui.tab==='bot')botPgPaint(true)});
APPREADY=true;(function(){var h=hashTab();if(h&&TABS.some(function(t){return t[0]===h}))ui.tab=h})();renderTabs();try{render()}catch(e){}
