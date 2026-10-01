import { MAP,CAMP,GATE,ROAD,LEVELS,INDEX,WORKERS,ITEMS,SHOPS,SLOTS,TOWER_ADDONS,UPGRADE_TIME,SKILLS,dist,clamp,info,footprint,createGame,placement,build,repair,upgrade,stopPlayer,blink,movePlayer,startAssault,stopAssault,advance,hasUnit,requirement,upgradeOptions,towerAddonOptions,attachTowerAddon,recruit,trade,castSkill,trollStats,buyItem,trollSpell,trollVisible,retreat } from './simulation.mjs';
export * from './simulation.mjs';
if(typeof document!=='undefined')startBrowser();


function startBrowser() {
  const $ = id => document.getElementById(id);
  const upgradeRequirements=$('upgrade-requirements')||Object.assign(document.createElement('small'),{id:'upgrade-requirements'});
  if(!upgradeRequirements.isConnected)$('command-tip').before(upgradeRequirements);
  const canvas = $('field'), ctx = canvas.getContext('2d'), mini = $('minimap'), miniCtx = mini.getContext('2d');
  const portrait = $('portrait-canvas'), portraitCtx = portrait.getContext('2d');
  const background = new Image(), atlas = new Image(), actors = new Image(), walls = new Image(), elfWork = new Image(), trollAttack = new Image();
  background.src = 'assets/snow-map.png'; atlas.src = 'assets/atlas.png'; actors.src = 'assets/actors.png';
  walls.src = 'assets/walls.png';
  elfWork.src = 'assets/elf-work.png'; trollAttack.src = 'assets/troll-attack.png';
  // 每帧用脚底锚点对齐，挥出的武器不改变角色站位。
  const workFrames = [[59,212,392,491,280,702],[579,75,393,629,798,703],[1078,221,535,483,1292,703],[1621,213,393,490,1838,702]];
  const attackFrames = [[50,264,492,410,247,673],[614,16,416,653,812,668],[1035,281,581,388,1398,668],[1691,259,468,412,1846,670]];
  const elfWalkFrames = [[84,41,198,246,196,286],[381,43,194,243,487,285],[681,44,178,245,788,288],[961,43,196,242,1071,284]];
  const trollWalkFrames = [[33,639,250,252,182,890],[374,639,239,243,489,881],[649,641,230,254,772,894],[942,639,258,255,1094,893]];
  const wallFrames = [];
  let game = createGame(), selected = game.player, mode = '', started = false, paused = false, loaded = false;
  let camera = { x: 60, y: 200 }, zoom = 1.15, view = { w: 0, h: 0 }, pointer = null, hover = null;
  let last = 0, hudTime = 0, signature = '', toastTime = 0, audio = null, sound = false;
  const terrain = document.createElement('canvas'); terrain.width = MAP.w; terrain.height = MAP.h;
  const terrainCtx = terrain.getContext('2d');
  const sizes = { house:[106,108],tower:[91,122],grove:[110,102],wall:[90,100],tech:[110,112],lab:[95,120],guild:[102,95],mine:[90,80] };
  const cell={house:[2,0],tower:[1,1],grove:[2,1],wall:[0,1],tech:[2,0],lab:[1,1],guild:[2,1],mine:[0,1]};
  const effectNames={arrow:'实体箭矢',arcane:'奥术弹',fire:'毁灭爆破',lightning:'闪电',frost:'冰霜减速',poison:'毒伤与减速',chaos:'终局暴击',heal:'治疗建筑',life:'攻击 / 治疗'};
  const effectColors={arrow:'#e3cd99',arcane:'#d59cff',fire:'#ff974e',lightning:'#e8c1ff',frost:'#8dedff',poison:'#9bee68',chaos:'#ff726f',heal:'#88edb5',life:'#80e8bd'};
  const statusColors={root:'#94c171',silence:'#d3a0f2',frost:'#9be8ff',poison:'#a3e36d',shield:'#c3c9ff'};
  const labels = { house: '建小屋', wall: '建主墙', tower: '建防塔', grove: '建远古之树', upgrade: '升级', catalog:'建筑目录',economy:'采木 / 经济',skills:'技能书',repair: '免费修理', blink: '闪烁', stop: '停止', cancel: '取消', select: '选择精灵' };
  const defaults=Object.fromEntries(Object.entries(SLOTS).map(([k,v])=>[k,v[0]]));
  let panelMode='',shopIndex=0,catalogTab=0,towerTab=0,towerBuildId='h001',shownResult='';
  function resize() {
    const previous = { x: camera.x + view.w / zoom / 2, y: camera.y + view.h / zoom / 2 };
    view.w = canvas.clientWidth; view.h = canvas.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(view.w * dpr); canvas.height = Math.round(view.h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!started) { zoom = view.w < 900 ? .95 : 1.2; center({ x: 500, y: 407 }); }
    else center(previous);
  }
  function center(p) {
    camera.x = clamp(p.x - view.w / zoom / 2, 0, Math.max(0, MAP.w - view.w / zoom));
    camera.y = clamp(p.y - view.h / zoom / 2, 0, Math.max(0, MAP.h - view.h / zoom));
  }
  window.addEventListener('resize', resize); resize();
  function tone(kind) {
    if (!sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
      oscillator.type = kind === 'impact' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(kind === 'impact' ? 130 : kind === 'spark' ? 900 : 530, now);
      oscillator.frequency.exponentialRampToValueAtTime(80, now + .09);
      gain.gain.setValueAtTime(.035, now); gain.gain.exponentialRampToValueAtTime(.001, now + .11);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(now + .12);
    } catch { sound = false; }
  }
  function tell(text) {
    $('notice').textContent = text; $('notice').classList.add('show'); toastTime = performance.now() + 2600;
  }
  function select(target) { selected = target || game.player; signature = ''; hud(); }
  function canAct() {
    if (!started || game.result) return false;
    if (paused) { tell('当前已暂停，请先继续'); return false; }
    return true;
  }
  function availableUpgrades(b) { return b?.type?upgradeOptions(b).filter(d=>game.practice||(!requirement(game,d)&&game.gold>=d.gold&&game.wood>=d.wood)):[]; }
  function availableAddons(b) { return towerAddonOptions(game,b).filter(d=>game.practice||(game.gold>=d.gold&&game.wood>=d.wood)); }
  function upgradeConditions(d) {
    const names=d.requires.map(id=>INDEX[id]?LEVELS[INDEX[id].type][INDEX[id].level].name:id);
    const tech='前置：'+(names.join('、')||'无');
    if(game.practice)return tech+' · 练习场免前置与费用';
    const missing=[requirement(game,d)];
    if(game.gold<d.gold)missing.push('缺 '+Math.ceil(d.gold-game.gold).toLocaleString()+' 金');
    if(game.wood<d.wood)missing.push('缺 '+Math.ceil(d.wood-game.wood).toLocaleString()+' 木');
    return tech+'\n'+(missing.filter(Boolean).join('；')||'条件已满足，可以升级');
  }
  function upgradeDetails(b) {
    if(!b)return '';
    if(b.progress<1)return '建筑建成后才能升级';
    if(b.upgrade)return '正在升级至：'+LEVELS[b.type][b.upgrade.target].name;
    const options=upgradeOptions(b);
    return options.length?options.map(d=>'下一阶：'+d.name+' · '+d.gold.toLocaleString()+' 金 / '+d.wood.toLocaleString()+' 木\n'+upgradeConditions(d)).join('\n'):'主建筑已满级';
  }
  function toWorld(e) { const r = canvas.getBoundingClientRect(); return { x: camera.x + (e.clientX - r.left) / zoom, y: camera.y + (e.clientY - r.top) / zoom }; }
  function hit(p) {
    const objects = [...game.buildings.filter(b => b.hp > 0), game.player, ...(trollVisible(game) ? [game.test] : [])].sort((a, b) => b.y - a.y);
    return objects.find(o => {
      const w = o.type ? sizes[o.type][0] : o.id === 'troll' ? 100 : 70;
      const h = o.type ? sizes[o.type][1] : o.id === 'troll' ? 100 : 85;
      return p.x >= o.x - w * .48 && p.x <= o.x + w * .48 && p.y >= o.y - h * .8 && p.y <= o.y + 15;
    });
  }
  function command(kind,variantId) {
    if(!started||game.result)return;
    if ((kind in SKILLS || ['repair','stop'].includes(kind)) && !canAct()) return;
    if (kind in LEVELS || kind === 'blink') {
      const same=mode===kind&&(kind!=='tower'||towerBuildId===(variantId||'h001'));
      if(kind==='tower')towerBuildId=variantId||'h001';
      mode = same ? '' : kind; hover = defaults[kind] || { x: game.player.x + 120, y: game.player.y };
      tell(mode ? kind === 'wall' ? '主墙吸附到唯一窄口；点击金色入口开始施工' : kind === 'blink' ? '选择闪烁落点' : '选择空地，精灵会走过去施工' : '已取消放置');
    } else if(kind==='upgrade'){
      const options=availableUpgrades(selected),addons=availableAddons(selected);
      if(options.length+addons.length===1){if(!canAct())return;const error=options.length?upgrade(game,selected,options[0].id):attachTowerAddon(game,selected,addons[0].id);tell(error||'升级开始');$('library').hidden=true;panelMode='';}
      else openPanel(kind);
    } else if(kind==='economy')openPanel(kind);
    else if(kind==='catalog'||kind==='skills')openPanel(kind);
    else if(kind in SKILLS)tell(castSkill(game,kind,selected)||'技能已释放');
    else if (kind === 'repair') tell(repair(game, selected) || '精灵将走到墙边持续修理；移动或停止可中断');
    else if (kind === 'stop') { stopPlayer(game); tell('精灵已停止当前工作'); }
    else if (kind === 'select') { select(game.player); center(game.player); }
    else mode = '';
    signature = ''; tone('click'); hud();
  }
  function mapClick(p, right = false) {
    if(!canAct())return;
    if (right && mode) { mode = ''; signature = ''; return; }
    if (mode === 'blink') {
      const error = blink(game, p); tell(error || '闪烁'); if (!error) mode = '';
    } else if (mode in LEVELS) {
      const error = build(game, mode, p.x, p.y,mode==='tower'?towerBuildId:undefined); if (error) tell(error);
      else { mode = ''; select(game.buildings.at(-1)); }
    } else {
      const object = hit(p);
      if (object && right && object.type) { select(object); tell(repair(game, object) || '精灵正在前往工作'); }
      else if (object && !right) select(object);
      else {const pad=Object.entries(SLOTS).find(([kind,slots])=>slots.some(slot=>dist(slot,p)<24&&!game.buildings.some(b=>b.hp>0&&dist(slot,b)<20)));if(pad&&!right){command(pad[0]);tell('再次点击基座开始施工');}else{const error=movePlayer(game,p);if(error)tell(error);else select(game.player);}}
    }
    signature = ''; tone('click'); hud();
  }
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); mapClick(toWorld(e), true); });
  canvas.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    canvas.setPointerCapture(e.pointerId); hover = toWorld(e);
    pointer = { x: e.clientX, y: e.clientY, cameraX: camera.x, cameraY: camera.y, dragged: false };
  });
  canvas.addEventListener('pointermove', e => {
    hover = toWorld(e);
    if (!pointer) return;
    const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
    if (Math.hypot(dx, dy) > 7) pointer.dragged = true;
    if (pointer.dragged) {
      camera.x = clamp(pointer.cameraX - dx / zoom, 0, Math.max(0, MAP.w - view.w / zoom));
      camera.y = clamp(pointer.cameraY - dy / zoom, 0, Math.max(0, MAP.h - view.h / zoom));
    }
  });
  canvas.addEventListener('pointerup', e => { if (pointer && !pointer.dragged) mapClick(toWorld(e)); pointer = null; });
  canvas.addEventListener('pointercancel', () => { pointer = null; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault(); const p = toWorld(e), old = zoom;
    zoom = clamp(zoom * (e.deltaY > 0 ? .9 : 1.1), .7, 1.8);
    camera.x = p.x - (p.x - camera.x) * old / zoom; camera.y = p.y - (p.y - camera.y) * old / zoom;
    camera.x = clamp(camera.x, 0, Math.max(0, MAP.w - view.w / zoom)); camera.y = clamp(camera.y, 0, Math.max(0, MAP.h - view.h / zoom));
  }, { passive: false });
  mini.addEventListener('pointerdown', e => { const r = mini.getBoundingClientRect(); center({ x: (e.clientX - r.left) / r.width * MAP.w, y: (e.clientY - r.top) / r.height * MAP.h }); });
  $('portrait').addEventListener('click', () => command('select'));
  window.addEventListener('keydown', e => {
    if (!started || e.repeat) return;
    const key = e.key.toLowerCase(), bindings = { '1': 'house', '2': 'wall', '3': 'tower', '4': 'grove', q:'blink',e:'root',z:'shield',w:'silence',v:'ward',n:'stars',r:'repair',u:'upgrade',s:'stop',b:'catalog', escape: 'cancel', f1: 'select' };
    if (key === ' ') { e.preventDefault(); center(game.player); }
    else if (bindings[key]) { e.preventDefault(); command(bindings[key]); }
  });
  $('pause').addEventListener('click', () => { paused = !paused; $('pause').textContent = paused ? '继续' : '暂停'; });
  $('sound').addEventListener('click', () => { sound = !sound; $('sound').textContent = sound ? '声音 开' : '声音 关'; tone('click'); });
  $('assault').addEventListener('click',()=>{if(game.practice&&canAct())tell(startAssault(game)||'巨魔进入试炼道路');});
  $('stop-test').addEventListener('click',()=>{if(game.practice&&canAct())stopAssault(game);});
  function reset(practice=game.practice) { game = createGame(practice); selected = game.player; paused = false; mode = '';towerBuildId='h001';signature = ''; $('pause').textContent = '暂停'; $('speed').textContent='速度 ×1'; shownResult='';$('result-modal').hidden=true;$('library').hidden=true;panelMode='';center({x:500,y:407});hud();}
  $('reset').addEventListener('click', () => { reset(); tell('营地已重置'); });
  $('start').addEventListener('click', () => { if (!loaded) return; reset(false); started = true; $('start-modal').classList.add('hidden'); });
  $('practice').addEventListener('click',()=>{if(!loaded)return;reset(true);started=true;$('start-modal').classList.add('hidden');});
  $('speed').addEventListener('click',()=>{game.speed=game.speed>=32?1:game.speed*2;$('speed').textContent='速度 ×'+game.speed;});
  $('open-catalog').addEventListener('click',()=>openPanel('catalog'));
  $('open-economy').addEventListener('click',()=>openPanel('economy'));
  $('open-skills').addEventListener('click',()=>openPanel('skills'));
  $('open-shop').addEventListener('click',()=>openPanel('shop'));
  $('panel-close').addEventListener('click',()=>{$('library').hidden=true;panelMode='';});
  $('return-shop').addEventListener('click',()=>{if(game.practice&&canAct())tell(retreat(game)||'巨魔沿道路返回商店');});
  document.querySelectorAll('[data-skill]').forEach(button=>button.addEventListener('click',()=>command(button.dataset.skill)));
  $('replay').addEventListener('click',()=>{reset();started=true;});
  $('back-menu').addEventListener('click',()=>{reset();started=false;$('start-modal').classList.remove('hidden');});
  function openPanel(which){
    panelMode=which;$('library').hidden=false;const body=$('library-body');body.replaceChildren();
    $('library-title').textContent=({catalog:'建筑与固定基座',upgrade:'选择升级目标',skills:'精灵技能书',economy:'经济与辅助单位',shop:'巨魔商店 · 独立背包'})[which];
    const paragraph=text=>{const p=document.createElement('p');p.className='library-note';p.textContent=text;body.append(p);};
    const card=(title,detail,action,tag='',art='')=>{const button=document.createElement('button');button.className='library-card';const words=document.createElement('span');words.className='library-words';const name=document.createElement('b'),description=document.createElement('span');name.textContent=title;description.textContent=detail;words.append(name,description);if(tag){const small=document.createElement('small');small.textContent=tag;words.append(small);}if(art){const icon=document.createElement('span');icon.className='library-art command-art art-'+art;if(art.startsWith('icon:')){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS('http://www.w3.org/2000/svg','use');svg.setAttribute('viewBox','0 0 64 64');use.setAttribute('href','assets/ui-icons.svg#'+art.slice(5));svg.append(use);icon.append(svg);}button.append(icon);}button.append(words);button.addEventListener('click',action);body.append(button);return button;};
    const price=d=>d.gold.toLocaleString()+' 金 / '+d.wood.toLocaleString()+' 木';
    const perform=fn=>{if(!canAct())return;const error=fn();tell(error||'操作成功');hud();if(which==='upgrade'&&!error){$('library').hidden=true;panelMode='';}else openPanel(which);};
    if(which==='catalog'){
      paragraph(game.practice?'练习局建造与升级免费、免科技前置；仍需逐阶升级并在固定基座施工。':'固定基座自动吸附，入口只容纳一堵墙。升级与科技前置采用 4.7 B5.5 配置。');
      const tabs=document.createElement('div');tabs.className='library-tabs';['营地','防御','科技与经济'].forEach((name,i)=>{const button=document.createElement('button');button.textContent=name;button.className=i===catalogTab?'active':'';button.addEventListener('click',()=>{catalogTab=i;openPanel('catalog');});tabs.append(button);});body.append(tabs);
      for(const type of [['house','grove'],['wall','tower'],['tech','guild','lab','mine']][catalogTab]){const d=LEVELS[type][0];card(d.name,(game.practice?'练习免费':price(d))+' · '+(game.practice?'免前置':requirement(game,d)||'可以建造'),()=>{command(type);$('library').hidden=true;},type==='grove'?'建成后产木 '+d.income.toFixed(3)+'/秒；升级远古之树提高产量':type==='mine'?'精灵直接施工；建成后产金 '+d.income+' 金/秒':type==='tech'?'解锁科技、交易与高阶建筑':'固定位置 '+SLOTS[type].length+' 处',type);}
      if(catalogTab===1){const d=LEVELS.tower[14];card(d.name,(game.practice?'练习免费':price(d))+' · 攻击并治疗建筑',()=>{command('tower',d.id);$('library').hidden=true;},'原图独立塔型，占用一个塔基座','tower');}
    }else if(which==='upgrade'){
      if(!selected?.type){paragraph('请先点选自己的建筑。');return;}
      if(selected.upgrade){paragraph('正在升级，完成后可查看下一阶。');return;}
      paragraph('当前：'+info(selected).name+'。升级由建筑自行完成，墙的阻挡不会消失。');
      if(selected.type==='tower'){
        const tabs=document.createElement('div');tabs.className='library-tabs';['主塔逐阶升级','塔旁附塔'].forEach((name,i)=>{const button=document.createElement('button');button.textContent=name;button.className=i===towerTab?'active':'';button.addEventListener('click',()=>{towerTab=i;openPanel('upgrade');});tabs.append(button);});body.append(tabs);
        if(towerTab===1){if(selected.addon)paragraph('已建附塔：'+TOWER_ADDONS.find(d=>d.id===selected.addon.id).name);const addons=availableAddons(selected);if(!addons.length&&!selected.addon)paragraph('当前没有满足资源条件的附塔。');for(const d of addons)card(d.name,(game.practice?'练习免费':price(d))+' · '+(d.heal?'治疗 '+d.heal:d.damage?'额外攻击 '+d.damage:'侦测隐身'),()=>perform(()=>attachTowerAddon(game,selected,d.id)),'原图 Build-On Buddy 附塔','icon:'+(d.heal?'heal':d.effect==='sight'?'sight':'arrow'));return;}
      }
      const options=upgradeOptions(selected),ready=new Set(availableUpgrades(selected).map(d=>d.id));
      if(!options.length)paragraph('没有后续升级。');
      for(const d of options){const unit=selected.type==='grove'?'木':'金',button=card(d.name,(game.practice?'练习免费':price(d))+' · 生命 '+d.hp+' / 护甲 '+d.armor+(d.income?' · 产'+unit+' '+d.income.toFixed(3)+' '+unit+'/秒（+'+(d.income-info(selected).income).toFixed(3)+'）':'')+(d.effect?' · '+effectNames[d.effect]:''),()=>perform(()=>upgrade(game,selected,d.id)),upgradeConditions(d),selected.type==='tower'?'icon:'+(d.effect==='life'?'life':d.effect):selected.type);button.disabled=!ready.has(d.id)||selected.progress<1;}
    }else if(which==='skills'){
      paragraph('魔法 '+Math.floor(game.player.mana??200)+'/200，恢复 3/秒。护盾保护墙；缠绕控制巨魔；沉默只封锁主动技能。');
      card('闪烁 Q','冷却 19 秒 · 0 魔法',()=>{command('blink');$('library').hidden=true;},'','icon:blink');
      for(const [key,d] of Object.entries(SKILLS))card(d.name,d.mana+' 魔法 · '+d.tip,()=>perform(()=>castSkill(game,key,selected)),game.cooldowns[key]>0?'冷却剩余 '+Math.ceil(game.cooldowns[key])+' 秒':'可释放','icon:'+({shield:'armor',ward:'sight'}[key]||key));
    }else if(which==='economy'){
      paragraph('金币来自房屋和金矿；木材由远古之树生产。升级远古之树可提升木材产量，修墙不消耗金木。');
      card('买入 10 木',game.market.buy+' 金',()=>perform(()=>trade(game,'buy',10)));
      card('卖出 10 木','获得 '+game.market.sell+' 金',()=>perform(()=>trade(game,'sell',10)));
      card('批量交易 200 木','买入 '+(20*game.market.buy+950)+' 金',()=>perform(()=>trade(game,'buy',200)));
      card('卖出 200 木','获得 '+(20*game.market.sell-950)+' 金',()=>perform(()=>trade(game,'sell',200)));
      const producers=game.buildings.filter(b=>b.hp>0&&b.progress===1),houseGold=producers.filter(b=>b.type==='house').reduce((n,b)=>n+info(b).income,0),mineGold=producers.filter(b=>b.type==='mine').reduce((n,b)=>n+info(b).income,0);
      paragraph('金币产量 '+(houseGold+mineGold)+' 金/秒 = 房屋 '+houseGold+' + 金矿 '+mineGold+'；升级房屋或金矿可增加产量。');
      const mine=game.buildings.find(b=>b.type==='mine'&&b.hp>0);
      if(mine){card(info(mine).name,mine.progress<1?'施工中，建成后产金 '+info(mine).income+' 金/秒':'当前产金 '+info(mine).income+' 金/秒',()=>{select(mine);openPanel('upgrade');},'点击查看下一阶金矿与产量','mine');}
      else card('建造金矿',(game.practice?'练习局免费':price(LEVELS.mine[0]))+' · 精灵直接施工',()=>{command('mine');$('library').hidden=true;},'建成后产金 '+LEVELS.mine[0].income+' 金/秒','mine');
      const tree=game.buildings.find(b=>b.type==='grove'&&b.hp>0);
      if(tree?.progress<1)paragraph('远古之树施工中，完工后开始产木。');
      else if(tree){const next=upgradeOptions(tree)[0];paragraph('采木只由远古之树升级，当前产量 '+info(tree).income.toFixed(3)+' 木/秒。');if(next)card('升级采木建筑：'+next.name,price(next)+' · '+next.income.toFixed(3)+' 木/秒（增加 '+(next.income-info(tree).income).toFixed(3)+'）',()=>perform(()=>upgrade(game,tree,next.id)),'点击直接升级','grove');else paragraph('采木建筑已达最高等级。');}
      else card('建造采木建筑：远古之树',game.practice?'练习局免费':price(LEVELS.grove[0])+' · '+LEVELS.grove[0].income.toFixed(3)+' 木/秒',()=>{command('grove');$('library').hidden=true;},'建成后可逐级升级产木','grove');
      paragraph('修理工：需要工人行会，训练后自动到墙后免费修墙。');
      WORKERS.forEach((d,i)=>card(d.name,price(d)+' · 修理时间系数 '+d.ratio.toFixed(2),()=>perform(()=>recruit(game,'worker',i))));
    }else{
      paragraph('巨魔资金独立：'+Math.floor(game.trollWallet.gold)+' 金 / '+Math.floor(game.trollWallet.wood)+' 木。攻墙实际伤害会转为金币；购买需要回出生地。背包 '+game.trollWallet.items.length+'/6。');
      const gear=trollStats(game);paragraph('攻击 '+gear.attack+' / 护甲 '+gear.armor+' / 生命 '+gear.maxHp+' / 回复 '+gear.regen+'/秒 / 攻速加成 '+Math.round(gear.haste*100)+'%');
      if(game.trollWallet.items.length)paragraph('装备：'+game.trollWallet.items.map(id=>ITEMS[id].name).join('、'));
      const tabs=document.createElement('div');tabs.className='library-tabs';SHOPS.forEach((shop,i)=>{const b=document.createElement('button');b.textContent=(i<3?'装备店 ':'特殊店 ')+(i%3+1);b.className=i===shopIndex?'active':'';b.addEventListener('click',()=>{shopIndex=i;openPanel('shop');});tabs.append(b);});body.append(tabs);
      for(const id of SHOPS[shopIndex].items){const d=ITEMS[id],names={attack:'攻击',armor:'护甲',hp:'生命',regen:'回复/秒',haste:'攻速',agility:'敏捷',strength:'力量',move:'移速',vision:'真视',lumber:'木材'};const bonuses=Object.entries(d.bonus).map(([k,v])=>(names[k]||k)+' +'+(k==='haste'?Math.round(v*100)+'%':v)).join(' / ');card(d.name,price(d)+' · '+bonuses,()=>game.auto?tell('单机局中巨魔会在回店时自行购置装备'):perform(()=>buyItem(game,id)),'','icon:'+(d.bonus.attack?'weapon':d.bonus.armor?'armor':d.bonus.lumber?'wood':d.bonus.haste?'haste':d.bonus.vision?'sight':'life'));}
      if(game.auto){paragraph('这些是巨魔的独立资源与装备；回店后会自行购买下一档。');return;}
      paragraph('巨魔技能（手动操作）：被沉默时不可施放。');
      for(const [key,title] of [['invisible','隐身 15 秒'],['teleport','传送回出生点'],['reveal','揭示营地']])card(title,'使用巨魔的主动技能',()=>perform(()=>trollSpell(game,key)));
    }
  }
  function buttonData(kind) {
    let title = labels[kind], price = '', disabled = false, hint = '';
    const b = selected?.type && selected.hp > 0 ? selected : null;
    if (kind in LEVELS) {
      const d = kind==='tower'&&mode==='tower'?LEVELS.tower[INDEX[towerBuildId].level]:LEVELS[kind][0];
      if(kind==='tower'&&d.id===' ngn')title='建生死塔';
      price = game.practice?'练习免费':d.gold + ' 金' + (d.wood ? ' / ' + d.wood + ' 木' : '');
      hint = kind === 'wall' ? '每个营地限一堵，封住窄口。精灵到达后施工。' : '占地预览 → 点击位置 → 精灵走近 → 施工完成。';
      disabled = (!game.practice && game.gold < d.gold) || (kind !== 'tower' && game.buildings.some(v => v.type === kind && v.hp > 0));
    } else if (kind === 'upgrade') {
      const next=b&&availableUpgrades(b),addon=b&&availableAddons(b);
      const target=b&&upgradeOptions(b)[0];
      price=next?.length+addon?.length===1?(game.practice?'立即升级':'升级 '+(next.length?next[0].name:addon[0].name)):(next?.length||addon?.length?'选择升级':target?(requirement(game,target)||'升级资源不足'):'主建筑已满级');
      if(b?.progress<1)price='建成后可升级';else if(b?.upgrade)price='正在升级';
      disabled=(!next?.length&&!addon?.length)||!b||b.progress<1||!!b.upgrade;
      hint = upgradeDetails(b);
    } else if (kind === 'repair') {
      const unfinished = b && b.progress < 1;
      title = unfinished ? '继续施工' : b?.type === 'wall' ? '精灵修墙' : '无需修理';
      price = unfinished ? '需精灵靠近' : b?.type === 'wall' ? '免费 · 不消耗金木' : '只有墙要动手';
      disabled = !b || (!unfinished && (b.type !== 'wall'));
      hint = '只有修墙要精灵动手：精灵走到墙边持续修理，移动或停止会中断。';
    } else if (kind === 'blink') { price = game.player.blink > 0 ? Math.ceil(game.player.blink) + ' 秒冷却' : '短距位移 · Q'; disabled = game.player.blink > 0; hint = '可越过墙，落点必须是能站立的地面。'; }
    else if (kind === 'stop') { price = '中断当前指令'; hint = '停止行走、施工或修理。未完成建筑可以继续施工。'; }
    else if(kind==='catalog')price='建筑 / 前置 / 固定基座';
    else if(kind==='economy')price='产木 / 雇佣 / 交易';
    else if(kind==='skills')price='护盾 / 缠绕 / 沉默';
    else if (kind === 'select') price = 'F1 / 空格定位';
    else price = 'Esc';
    return { kind, title, price, disabled, hint };
  }
  function hud() {
    $('trial-controls').hidden=game.auto;
    $('growth').textContent=game.auto?('巨魔 '+(game.encounter.tier+1)+' 阶 · '+Math.max(0,Math.ceil(game.encounter.nextGrowth-game.time))+' 秒后强化'):'练习场 · 自由测试';
    $('objective').textContent=!game.buildings.some(b=>b.type==='house'&&b.hp>0)?'先在小屋基座建帐篷，开始产金':!game.buildings.some(b=>b.type==='wall'&&b.hp>0)?'在窄口基座筑墙，阻挡巨魔':!game.buildings.some(b=>b.type==='tower'&&b.hp>0)?'墙后建塔；点墙按 R 持续免费修理':!game.buildings.some(b=>b.type==='tech'&&b.hp>0)?'升级房屋和主墙，建大厅解锁后续科技':'发展木材与科技，升级塔，配合技能击败巨魔';
    if(game.player.order?.kind==='build'){const target=game.buildings.find(b=>b.id===game.player.order.id);if(target)$('objective').textContent='施工中：'+info(target).name+(game.player.orders.length?' · 后续 '+game.player.orders.length+' 项':'')+'；危急时选墙按 R 优先修理';}
    if (selected?.type && selected.hp <= 0) selected = game.player;
    $('gold').textContent = Math.floor(game.gold); $('wood').textContent = Math.floor(game.wood); $('income').textContent = '+' + game.income;
    const seconds = Math.floor(game.time); $('clock').textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    const wall = game.buildings.find(b => b.type === 'wall' && b.hp > 0 && b.started);
    $('status').textContent = wall ? '窄口已封锁' : '入口畅通'; $('status').classList.toggle('sealed', !!wall);
    $('test-status').textContent = !game.test ? game.auto?'准备阶段 · '+Math.max(0,Math.ceil(30-game.time))+' 秒后入场':'手动试炼' : game.test.invisible>0&&!trollVisible(game)?'巨魔隐身中 · 侦察守卫可揭示':({ shop:'巨魔正在出生点补给',retreat:'巨魔正在回商店',approach: '巨魔正在沿路接近', attack: '巨魔被挡在墙外', breach: '入口已打开，巨魔正进入', done: '巨魔已通过入口', defeated: '防御成功：巨魔倒下' })[game.test.stage];
    const b = selected?.type ? selected : null, max = b ? info(b).hp : selected.maxHp;
    upgradeRequirements.hidden=!b;
    upgradeRequirements.textContent=upgradeDetails(b);
    $('selected-name').textContent = b ? info(b).name + ' · ' + (b.level + 1) + ' 阶' : selected.id === 'troll' ? '攻墙试炼 · 巨魔' : '精灵工匠';
    $('selected-health').textContent = Math.ceil(selected.hp) + ' / ' + max;
    $('health-fill').style.width = clamp(selected.hp / max * 100, 0, 100) + '%';
    $('health-fill').classList.toggle('danger', selected.hp / max < .35);
    const actionNames = { build: '施工', repair: '修墙' }, job = game.player.order;
    $('order-status').textContent = job ? (game.player.moving ? '前往' : '正在') + actionNames[job.kind] + (game.player.orders.length ? ' · 后续 ' + game.player.orders.length + ' 项' : '') : game.player.moving ? '正在沿道路移动' : '等待指令';
    const progress = b?.upgrade ? b.upgrade.progress : b?.progress < 1 ? b.progress : null;
    $('work-progress').hidden = progress === null; $('work-fill').style.width = (progress || 0) * 100 + '%';
    $('selected-detail').textContent = b ? progress !== null ? (b.upgrade ? '升级中 ' : b.started ? '施工中 ' : '等待精灵 ') + Math.floor(progress * 100) + '%' : b.type === 'wall' ? '实体碰撞 · 封锁唯一窄口 · R 持续修理' : b.type === 'house' ? '每秒产生 ' + info(b).income + ' 金币' : b.type === 'grove' ? '自动产木 '+info(b).income.toFixed(3)+' 木/秒 · 可持续升级' : '每 3 秒产生 1 木材' : '移动 / 建造 / 施工 / 持续修理 / 闪烁';
    const kinds=b?['catalog',b.type==='grove'?'economy':'skills','select','upgrade','repair',mode?'cancel':'stop']:['house','wall','tower','catalog','skills',mode?'cancel':'blink'];
    const data = kinds.map(buttonData), nextSig = JSON.stringify(data) + mode;
    if (signature !== nextSig) {
      signature = nextSig;
      $('commands').replaceChildren(...data.map((d, i) => {
        const button = document.createElement('button'); button.type = 'button'; button.disabled = d.disabled; button.setAttribute('aria-label', d.title);
        button.className = 'command' + (mode === d.kind ? ' active' : ''); button.title = d.title + '：' + d.price + '。' + d.hint;
        const icon = document.createElement('span'); icon.className = 'command-art art-' + d.kind;
        if (!(d.kind in LEVELS)) icon.textContent = { upgrade: '↑', repair: '⚒', blink: '✧', stop: '■', cancel: '×', select:'⌖',catalog:'⌂',economy:'◆',skills:'✧' }[d.kind];
        const words = document.createElement('span'); words.className = 'command-words';
        const title = document.createElement('b'); title.textContent = d.title;
        const cost = document.createElement('small'); cost.textContent = d.price;
        words.append(title, cost); button.append(icon, words);
        button.addEventListener('click', () => command(d.kind));
        button.addEventListener('pointerenter', () => { $('command-tip').textContent = d.hint || d.price; });
        $('command-tip').textContent ||= '先造小屋，再在金色窄口建墙；选墙后按 R 修理。';
        return button;
      }));
    }
    $('modebar').hidden = !mode; $('mode-text').textContent = mode ? mode === 'wall' ? '放置主墙 · 自动对齐入口' : mode === 'blink' ? '选择闪烁落点' : '放置 ' + (mode==='tower'?LEVELS.tower[INDEX[towerBuildId].level].name:LEVELS[mode][0].name) : '';
    $('mana').textContent=Math.floor(game.player.mana??200);
    $('wood-rate').textContent=game.woodRate.toFixed(2)+'/秒';
    $('troll-resources').textContent='巨魔 '+Math.floor(game.trollWallet.gold)+' 金 / '+Math.floor(game.trollWallet.wood)+' 木';
    const enemy=game.test||trollStats(game);
    $('troll-combat').textContent='攻击 '+enemy.attack+' · 护甲 '+enemy.armor+' · 生命 '+(game.test?Math.ceil(enemy.hp)+'/':'')+enemy.maxHp;
    if(selected.id==='troll'){
      $('selected-name').textContent='巨魔 · '+(game.encounter.tier+1)+' 阶';
      $('selected-detail').textContent='攻击 '+selected.attack+' / 护甲 '+selected.armor+' / 回复 '+selected.regen+'/秒 / 攻速加成 '+Math.round(selected.haste*100)+'%';
    }
    if(b){const d=info(b);$('selected-name').textContent=d.name+' · '+(b.level+1)+' 阶';if(b.progress===1&&!b.upgrade)$('selected-detail').textContent=b.type==='tower'?'攻击 '+d.damage+' / 射程 '+d.range+' / 间隔 '+d.interval+'秒 / '+(effectNames[d.effect]||'')+(b.addon?' / 附塔 '+TOWER_ADDONS.find(a=>a.id===b.addon.id).name:''):b.type==='grove'?'自动产木 '+d.income.toFixed(3)+' 木/秒 · 可持续升级':'护甲 '+d.armor+' · '+(b.type==='wall'?'近身修理免费':d.income?'收入 '+d.income+' 金/秒':d.original);}
    $('skill-readout').textContent=Object.entries(SKILLS).map(([k,v])=>v.name+(game.cooldowns[k]>0?' '+Math.ceil(game.cooldowns[k])+'s':' 就绪')).join(' · ');
    if(game.result)$('test-status').textContent=game.result+' · 点击重置开始新局';
    if(game.result&&shownResult!==game.result){shownResult=game.result;$('result-title').textContent=game.result;$('result-detail').textContent='对局 '+$('clock').textContent+' · 巨魔最高 '+(game.encounter.tier+1)+' 阶 · 建筑升级 '+game.stats.upgrades+' 次 · 释放技能 '+game.stats.spells+' 次';$('result-modal').hidden=false;$('library').hidden=true;}
    drawPortrait();
  }
  $('cancel-placement').addEventListener('click', () => command('cancel'));
  function drawPortrait() {
    if (!loaded) return;
    portraitCtx.clearRect(0, 0, portrait.width, portrait.height);
    const gradient = portraitCtx.createRadialGradient(60, 45, 10, 60, 70, 95); gradient.addColorStop(0, '#42666a'); gradient.addColorStop(1, '#0a1820');
    portraitCtx.fillStyle = gradient; portraitCtx.fillRect(0, 0, portrait.width, portrait.height);
    if (selected.type) {
      const [col, row] = cell[selected.type]; portraitCtx.drawImage(atlas, col * 512, row * 512, 512, 512, 0, 0, 116, 116);
    } else {
      const row = selected.id === 'troll' ? 2 : 0;
      portraitCtx.drawImage(actors, 0, row * actors.height / 4, actors.width / 4, actors.height / 4, -2, -8, 124, 130);
    }
  }
  function makeTerrain() {
    terrainCtx.drawImage(background,0,0,MAP.w,MAP.h);
  }
  function ring(x, y, radius, color, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 2 / zoom;
    ctx.beginPath(); ctx.ellipse(x, y, radius, radius * .5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  function imageSprite(kind, x, y, w, h) {
    const [col, row] = cell[kind]; ctx.drawImage(atlas, col * 512, row * 512, 512, 512, x-w/2, y-h*.87, w, h);
  }
  function wallSprite(b, alpha = 1) {
    const frame = wallFrames[b.level < 5 ? 0 : b.level < 12 ? 1 : 2];
    if (!frame) return;
    ctx.save(); ctx.globalAlpha *= alpha;
    const h = 146 + Math.min(b.level, 12) * 1.4, w = 85;
    if (b.hp < info(b).hp * .35) ctx.filter = 'brightness(.72) saturate(.65)';
    ctx.drawImage(walls, ...frame, b.x - w / 2, b.y + GATE.halfH - h, w, h);
    ctx.restore();
  }
  function drawBuilding(b, ghost = false) {
    const [w,h] = sizes[b.type], selectedHere=selected===b;
    ctx.save(); ctx.globalAlpha = ghost ? .5 : b.started ? 1 : .38;
    ctx.fillStyle='#13223050';ctx.beginPath();ctx.ellipse(b.x+7,b.y+4,w*.4,13,0,0,7);ctx.fill();
    if (b.pulse>0) ctx.translate(Math.sin(b.pulse*80)*2,0);
    if (!ghost && b.progress<1 && b.started) {
      ctx.save();ctx.beginPath();ctx.rect(b.x-w,b.y-h*b.progress-6,w*2,h*b.progress+30);ctx.clip();
      if(b.type==='wall')wallSprite(b);else imageSprite(b.type,b.x,b.y,w,h);ctx.restore();
      ctx.strokeStyle='#806e4d';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(b.x-w*.4,b.y);ctx.lineTo(b.x-w*.4,b.y-h*.6);ctx.lineTo(b.x+w*.4,b.y-h*.6);ctx.lineTo(b.x+w*.4,b.y);ctx.moveTo(b.x-w*.4,b.y-h*.3);ctx.lineTo(b.x+w*.4,b.y-h*.3);ctx.moveTo(b.x-w*.4,b.y);ctx.lineTo(b.x+w*.4,b.y-h*.6);ctx.stroke();
    } else if(b.type==='wall') wallSprite(b); else {
      if(b.level>0)ctx.filter=b.type==='tower'?'hue-rotate('+({arrow:0,arcane:35,fire:175,lightning:285,frost:0,poison:240,chaos:160,heal:235,life:220}[info(b).effect]||0)+'deg)':'brightness('+Math.min(1.4,1+b.level*.03)+')'; imageSprite(b.type,b.x,b.y,w*(1+Math.min(4,b.level)*.025),h*(1+Math.min(4,b.level)*.025));ctx.filter='none';
    }
    ctx.restore();
    if(!ghost){
      if(b.addon){ctx.save();ctx.fillStyle=b.addon.id==='n001'?'#91dded':'#e8c780';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=8;ctx.beginPath();ctx.arc(b.x+28,b.y-68,8,0,7);ctx.fill();ctx.restore();}
      if(b.shield>0){ctx.save();ctx.strokeStyle='#d2d5ff';ctx.lineWidth=3;ctx.shadowColor='#8291ff';ctx.shadowBlur=18;ctx.beginPath();ctx.ellipse(b.x,b.y-30,49,70,0,0,7);ctx.stroke();ctx.restore();}
      if(selectedHere)ring(b.x,b.y,w*.46,'#efd17e');
      if(b.progress<1||b.upgrade) bar(b.x,b.y-h*.82-9, b.upgrade?b.upgrade.progress:b.progress,1,64,'#d6b769');
      else if(selectedHere||b.hp<info(b).hp)bar(b.x,b.y-h*.82-9,b.hp,info(b).hp,60);
      if(b.type==='tower'&&b.progress===1){const color=effectColors[info(b).effect]||'#79eaff',radius=16+Math.sin(game.time*3)*2;const g=ctx.createRadialGradient(b.x,b.y-66,0,b.x,b.y-66,radius);g.addColorStop(0,color+'aa');g.addColorStop(1,color+'00');ctx.fillStyle=g;ctx.fillRect(b.x-20,b.y-86,40,40);}
    }
  }
  function bar(x,y,value,max,w,color){ctx.fillStyle='#0c1727d9';ctx.fillRect(x-w/2-2,y-2,w+4,8);ctx.fillStyle=color||(value/max<.35?'#d66351':'#74c564');ctx.fillRect(x-w/2,y,clamp(value/max,0,1)*w,4);}
  function drawActor(u) {
    const troll=u.id==='troll', working=['build','repair','upgrade'].includes(u.action), attacking=u.action==='attack'&&u.stage==='attack';
    const col=u.moving?Math.floor((u.walkDistance||0)/18)%4:working?Math.floor((u.workPhase??u.anim)*6)%4:attacking?(Math.floor((1-clamp(u.hit/(u.attackPeriod||1.2),0,1))*4)+2)%4:0;
    const w=troll?109:78,h=troll?114:82;
    ctx.fillStyle='#12202a55';ctx.beginPath();ctx.ellipse(u.x+2,u.y+2,troll?28:15,troll?11:7,0,0,7);ctx.fill();
    if(selected===u)ring(u.x,u.y,troll?32:23,troll?'#db7c61':'#7adfbe');
    if(troll){for(const [key,left] of Object.entries(u.statuses||{}))if(left>0){ring(u.x,u.y,key==='root'?35:31,statusColors[key]||'#cc8bea',.8);ctx.font='11px system-ui';ctx.fillStyle=statusColors[key];ctx.textAlign='center';ctx.fillText(({root:'缠绕',silence:'沉默',frost:'冰霜减速',poison:'中毒'})[key]+' '+left.toFixed(1)+'s',u.x,u.y+24+Object.keys(u.statuses).indexOf(key)*13);}}
    ctx.save();if(troll&&u.invisible>0)ctx.globalAlpha=.25;ctx.translate(u.x,u.y);const flip=troll?(u.facing>0?-1:1):(u.facing<0?-1:1);ctx.scale(flip,1);
    const bob=u.moving?Math.sin((u.walkDistance||0)/18*Math.PI)*1.2:Math.sin(game.time*2.5)*.4;
    if(working)ctx.rotate(Math.sin(u.anim*6*Math.PI/2)*.025);
    if(attacking)ctx.translate(Math.sin((1-clamp(u.hit/(u.attackPeriod||1.2),0,1))*Math.PI*2)*3,0);
    if(u.hp<=0){ctx.rotate(-.8);ctx.globalAlpha=.6;}
    if(u.hurt>0)ctx.filter='brightness(1.7)';
    if(u.casting>0){ctx.shadowColor='#9cf0dd';ctx.shadowBlur=16;}
    const frames=attacking?attackFrames:working&&!troll?workFrames:troll?trollWalkFrames:elfWalkFrames;
    const sheet=attacking?trollAttack:working&&!troll?elfWork:actors, frame=frames[col],scale=attacking?.24:working&&!troll?.15:troll?.39:.29;
    ctx.drawImage(sheet,...frame.slice(0,4),(frame[0]-frame[4])*scale,(frame[1]-frame[5])*scale+bob,frame[2]*scale,frame[3]*scale);ctx.restore();
    if(troll||selected===u)bar(u.x,u.y-h*.85-8,u.hp,u.maxHp,troll?59:41);
  }
  function effect(e) {
    const a=e.age/e.life;ctx.save();ctx.globalAlpha=1-a;
    if(e.kind==='foot'){ctx.fillStyle='#5c768633';ctx.beginPath();ctx.ellipse(e.x+(e.side?4:-4),e.y,2.5,5,.6,0,7);ctx.fill();}
    else if(['command','blink','complete','cast'].includes(e.kind)){ring(e.x,e.y,12+a*(e.kind==='blink'?60:35),['blink','cast'].includes(e.kind)?'#82dfff':'#e5cb87',1-a);}
    else if(e.kind==='muzzle'){ctx.fillStyle=effectColors[e.color]||'#dcf6ff';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=15;ctx.beginPath();ctx.arc(e.x,e.y,9*(1-a),0,Math.PI*2);ctx.fill();}
    else if(e.kind==='healbeam'){ctx.strokeStyle='#8eeeaf';ctx.lineWidth=4;ctx.shadowColor='#89ffba';ctx.shadowBlur=16;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.tx,e.ty);ctx.stroke();}
    else if(e.kind==='damage'){ctx.font='bold 15px system-ui';ctx.textAlign='center';ctx.fillStyle='#edb094';ctx.strokeStyle='#1e1d25';ctx.lineWidth=3;ctx.strokeText(e.text,e.x,e.y-a*23);ctx.fillText(e.text,e.x,e.y-a*23);}
    else {const color=effectColors[e.kind]||statusColors[e.kind]||(e.kind==='repair'?'#a4e3bc':e.kind==='debris'?'#8d9fa8':'#e6c987');
      if(['fire','frost','chaos','impact'].includes(e.kind)){ring(e.x,e.y,5+a*32,color,1-a);ctx.shadowColor=color;ctx.shadowBlur=8;}
      for(let i=0;i<8;i++){const angle=i*.79, radius=a*30;ctx.fillStyle=color;ctx.fillRect(e.x+Math.cos(angle)*radius,e.y+Math.sin(angle)*radius*.6-a*12,2+(!i?2:0),2);}}
    ctx.restore();
  }
  function render(now) {
    ctx.clearRect(0,0,view.w,view.h);ctx.save();ctx.scale(zoom,zoom);ctx.translate(-camera.x,-camera.y);ctx.drawImage(terrain,0,0);
    // 营地范围之外保持场景纹理，真正行走范围由同一碰撞模型决定。
    for(const [kind,slots] of Object.entries(SLOTS))for(const pad of slots){if(kind==='wall'||game.buildings.some(b=>b.hp>0&&dist(b,pad)<20))continue;ctx.save();ctx.strokeStyle=mode===kind?'#e6d18a':'#a0bfbe88';ctx.setLineDash([5,5]);ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(pad.x,pad.y,30,18,0,0,7);ctx.stroke();ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillStyle='#e6efde';ctx.strokeStyle='#153142';ctx.lineWidth=3;const label=LEVELS[kind][0].name;ctx.strokeText(label,pad.x,pad.y+30);ctx.fillText(label,pad.x,pad.y+30);ctx.restore();}
    if(!game.buildings.some(b=>b.type==='wall'&&b.hp>0)){
      ctx.save();ctx.strokeStyle='#e2c47c';ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.strokeRect(GATE.x-GATE.halfW,GATE.y-GATE.halfH,GATE.halfW*2,GATE.halfH*2);ctx.restore();
      ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillStyle='#182633bb';ctx.fillRect(GATE.x-67,GATE.y+56,134,24);ctx.fillStyle='#ead4a3';ctx.fillText('唯一窄口 · 在此封墙',GATE.x,GATE.y+72);
    }
    if(selected?.type==='tower'&&selected.hp>0){ctx.save();ctx.strokeStyle='#8edfe999';ctx.fillStyle='#8edfe90a';ctx.lineWidth=1.2;ctx.setLineDash([8,7]);ctx.beginPath();ctx.arc(selected.x,selected.y,info(selected).range,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}
    if(selected===game.player&&game.player.path.length){ctx.save();ctx.strokeStyle='#95d8c280';ctx.setLineDash([3,7]);ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(game.player.x,game.player.y);for(const p of game.player.path)ctx.lineTo(p.x,p.y);ctx.stroke();ctx.restore();}
    game.effects.filter(e=>e.kind==='foot').forEach(effect);
    const objects=[...game.buildings.filter(b=>b.hp>0),game.player,...game.workers,...(trollVisible(game)?[game.test]:[])].sort((a,b)=>a.y-b.y);
    for(const o of objects)if(o.type)drawBuilding(o);else drawActor(o);
    for(const p of game.projectiles)if(game.test){
      const t=clamp(p.age/.38,0,1),x=p.fromX+(game.test.x-p.fromX)*t,y=p.fromY+(game.test.y-40-p.fromY)*t-Math.sin(t*Math.PI)*25;
      const color=effectColors[p.effect]||'#bff4ff';ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=p.effect==='arrow'?2:4;ctx.shadowColor=color;ctx.shadowBlur=p.effect==='arrow'?0:20;
      if(p.effect==='lightning'){ctx.beginPath();ctx.moveTo(p.fromX,p.fromY);for(let i=1;i<=8;i++)ctx.lineTo(p.fromX+(x-p.fromX)*i/8+(i<8?Math.sin(i*31+game.time*30)*12:0),p.fromY+(y-p.fromY)*i/8);ctx.stroke();}
      else {const previous=Math.max(0,t-.1),tailX=p.fromX+(game.test.x-p.fromX)*previous,tailY=p.fromY+(game.test.y-40-p.fromY)*previous-Math.sin(previous*Math.PI)*25;ctx.beginPath();ctx.moveTo(tailX,tailY);ctx.lineTo(x,y);ctx.stroke();ctx.beginPath();ctx.arc(x,y,p.effect==='fire'?8:p.effect==='arrow'?2:5,0,Math.PI*2);ctx.fill();}
      ctx.restore();
    }
    game.effects.filter(e=>e.kind!=='foot').forEach(effect);
    if(mode in LEVELS&&hover){const p=placement(game,mode,hover),level=mode==='tower'?INDEX[towerBuildId].level:0,b={...p,type:mode,level,progress:1,started:true,hp:LEVELS[mode][level].hp};drawBuilding(b,true);ctx.save();ctx.strokeStyle=p.error?'#e49380':'#80ddc1';ctx.lineWidth=2;ctx.setLineDash([5,4]);if(mode==='wall')ctx.strokeRect(p.x-GATE.halfW,p.y-GATE.halfH,GATE.halfW*2,GATE.halfH*2);else{const r=footprint(mode)+6;ctx.strokeRect(p.x-r,p.y-r,r*2,r*2);}ctx.restore();}
    if(mode==='blink'){ring(game.player.x,game.player.y,250,'#90d7ed',.4);if(hover)ring(hover.x,hover.y,18,'#91deef');}
    for(const ward of game.wards)if(ward.until>game.time){ring(ward.x,ward.y,30,'#efc77b');ctx.fillStyle='#edcb81';ctx.fillRect(ward.x-3,ward.y-35,6,35);}
    ctx.restore();
    if(game.night){ctx.fillStyle='#15235055';ctx.fillRect(0,0,view.w,view.h);}
    const vignette=ctx.createRadialGradient(view.w*.48,view.h*.45,view.h*.28,view.w*.5,view.h*.5,view.w*.7);vignette.addColorStop(0,'#00121b00');vignette.addColorStop(1,'#04131a90');ctx.fillStyle=vignette;ctx.fillRect(0,0,view.w,view.h);
    for(let i=0;i<45;i++){const x=(i*83.37+now*.006*(1+i%3))%view.w,y=(i*49.93+now*.014*(1+i%2))%view.h;ctx.fillStyle='#ebf5f5'+(i%3?'55':'99');ctx.fillRect(x,y,i%3?1:2,2);}
    miniCtx.drawImage(terrain,0,0,mini.width,mini.height);miniCtx.fillStyle='#0a1c2840';miniCtx.fillRect(0,0,mini.width,mini.height);
    for(const o of [...game.buildings.filter(b=>b.hp>0),game.player,...game.workers,...(trollVisible(game)?[game.test]:[])]){miniCtx.fillStyle=o.id==='troll'?'#ed9471':o.type==='wall'?'#f1cf80':'#85e0c4';miniCtx.fillRect(o.x/MAP.w*mini.width-2,o.y/MAP.h*mini.height-2,4,4);}
    miniCtx.strokeStyle='#e8d29a';miniCtx.strokeRect(camera.x/MAP.w*mini.width,camera.y/MAP.h*mini.height,view.w/zoom/MAP.w*mini.width,view.h/zoom/MAP.h*mini.height);
  }
  function frame(now) {
    const elapsed=last?Math.min((now-last)/1000,.1):0;last=now;
    if(started&&!paused){let left=elapsed;while(left>0){const step=Math.min(left,.05);for(let i=0;i<game.speed;i++)advance(game,step);left-=step;}}
    while(game.events.length)tell(game.events.shift());
    if(performance.now()>toastTime)$('notice').classList.remove('show');
    for(const e of game.effects)if(!e.sounded&&['spark','impact','complete'].includes(e.kind)){tone(e.kind);e.sounded=true;}
    render(now);if(now-hudTime>120){hud();hudTime=now;}requestAnimationFrame(frame);
  }
  Promise.all([background.decode(),atlas.decode(),actors.decode(),walls.decode(),elfWork.decode(),trollAttack.decode()]).then(()=>{
    const sheet=document.createElement('canvas');sheet.width=walls.width;sheet.height=walls.height;
    const sc=sheet.getContext('2d');sc.drawImage(walls,0,0);const pixels=sc.getImageData(0,0,sheet.width,sheet.height).data;
    for(let col=0;col<3;col++){const start=Math.floor(col*sheet.width/3),end=Math.floor((col+1)*sheet.width/3);let left=end,top=sheet.height,right=start,bottom=0;
      for(let y=0;y<sheet.height;y++)for(let x=start;x<end;x++)if(pixels[(y*sheet.width+x)*4+3]>40){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      wallFrames.push([left,top,right-left+1,bottom-top+1]);
    }
    loaded=true;makeTerrain();$('start').disabled=false;$('start').textContent='标准开局 · 30 金';hud();requestAnimationFrame(frame);}).catch(error=>{$('load-status').textContent='资源加载失败，请刷新：'+error.message;});
}
