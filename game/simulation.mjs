// 雪林防线：固定步长单机模拟；寻路、经济、技能和战斗共用这一份状态。
export const MAP = { w: 1672, h: 941, cell: 16 };
export const CAMP = { x: 310, y: 375, rx: 230, ry: 170 };
export const GATE = { x: 650, y: 432, halfW: 24, halfH: 44 };
export const ROAD = [{ x: 488, y: 432 }, { x: 1130, y: 432 }];
import { LEVELS as CLASSIC_LEVELS, INDEX as CLASSIC_INDEX, COLLECTORS, WORKERS, ITEMS, SHOPS } from './classic-data.mjs';
export { WORKERS, ITEMS, SHOPS };
const WOOD_YIELDS = [1/3, ...COLLECTORS.map(d => 1/3 + d.rate)];
const WOOD_LEVELS = [
  {...CLASSIC_LEVELS.grove[0], income:WOOD_YIELDS[0], next:['wood-e000']},
  ...COLLECTORS.map((d,i)=>({id:'wood-'+d.id,name:['基础伐木场','简易伐木场','专业伐木场','复合伐木场','秘银伐木场','离子伐木场','超声伐木场','终极伐木场'][i],original:d.name,gold:d.gold,wood:d.wood,hp:50,armor:0,requires:[],next:i<COLLECTORS.length-1?['wood-'+COLLECTORS[i+1].id]:[],repairGold:0,repairWood:0,income:WOOD_YIELDS[i+1]}))
];
export const LEVELS = {...CLASSIC_LEVELS,grove:WOOD_LEVELS};
export const INDEX = {...CLASSIC_INDEX,...Object.fromEntries(WOOD_LEVELS.map((d,level)=>[d.id,{type:'grove',level}]))};
export const SLOTS = { house:[{x:224,y:288}], wall:[GATE], tower:[{x:456,y:320},{x:480,y:400},{x:432,y:480}], grove:[{x:160,y:432}], tech:[{x:320,y:272}], lab:[{x:160,y:336}], guild:[{x:320,y:496}], mine:[{x:224,y:496}] };
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const info = b => LEVELS[b.type][b.level];
// ponytail: 网页每塔只留一个附塔位；若需复刻多座 Buddy，再改为独立建筑。
export const TOWER_ADDONS = [...LEVELS.tower.slice(13).filter(d=>d.id!==' ngn'),{id:'n001',name:'真视附塔',gold:0,wood:50,requires:['u014'],damage:0,heal:0,range:350,effect:'sight'}];
export const footprint = type => ({ house: 26, tower: 22, grove: 26, wall: 32, tech:25,lab:25,guild:25,mine:25 })[type];
const buildTime = type => ({ house: 4, wall: 5, tower: 6, grove: 6,tech:5,lab:5,guild:5,mine:5 })[type];
export const UPGRADE_TIME = 2.5;
const width = Math.ceil(MAP.w / MAP.cell), height = Math.ceil(MAP.h / MAP.cell);
const cellAt = p => Math.floor(p.y / MAP.cell) * width + Math.floor(p.x / MAP.cell);
const centerOf = id => ({ x: id % width * MAP.cell + 8, y: Math.floor(id / width) * MAP.cell + 8 });
export function ground(x, y) {
  return ((x - CAMP.x) / CAMP.rx) ** 2 + ((y - CAMP.y) / CAMP.ry) ** 2 <= 1
    || (x >= 488 && x <= 1130 && y >= 398 && y <= 466)
    || ((x - 1120) / 110) ** 2 + ((y - 432) / 100) ** 2 <= 1;
}
function terrainFree(x, y) {
  return [[-12, -12], [12, -12], [-12, 12], [12, 12]].every(([dx, dy]) => ground(x + dx, y + dy));
}
export function free(game, x, y) {
  if (!terrainFree(x, y)) return false;
  return !game.buildings.some(b => {
    if (b.hp <= 0 || !b.started) return false;
    if (b.type === 'wall') return Math.abs(x - b.x) < GATE.halfW + 13 && Math.abs(y - b.y) < GATE.halfH + 13;
    return Math.hypot(x - b.x, y - b.y) < footprint(b.type) + 13;
  });
}
function clearLine(game, a, b) {
  const steps = Math.ceil(dist(a, b) / 5);
  for (let i = 1; i <= steps; i++) if (!free(game, a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps)) return false;
  return true;
}
export function findPath(game, from, to) {
  if (!free(game, to.x, to.y)) return null;
  if (clearLine(game, from, to)) return [{ x: to.x, y: to.y }];
  const start = cellAt(from), goal = cellAt(to), size = width * height;
  const parents = new Int32Array(size).fill(-1), queue = new Int32Array(size);
  const valid = new Int8Array(size);
  let head = 0, tail = 0;
  queue[tail++] = start; parents[start] = start;
  while (head < tail && parents[goal] === -1) {
    const id = queue[head++], x = id % width, y = Math.floor(id / width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (parents[next] !== -1) continue;
      if (!valid[next]) { const p = centerOf(next); valid[next] = free(game, p.x, p.y) ? 1 : -1; }
      if (valid[next] < 0) continue;
      parents[next] = id; queue[tail++] = next;
    }
  }
  if (parents[goal] < 0) return null;
  const points = [{ x: to.x, y: to.y }];
  for (let at = goal; at !== start; at = parents[at]) points.push(centerOf(at));
  points.reverse();
  // 栅格负责防穿墙，合并可直达节点，让角色沿道路平顺行走。
  const path = []; let previous = from, i = 0;
  while (i < points.length) {
    let next = i;
    while (next + 1 < points.length && clearLine(game, previous, points[next + 1])) next++;
    path.push(points[next]); previous = points[next]; i = next + 1;
  }
  return path;
}
function actor(id, x, y) {
  return { id, x, y, hp: 1, maxHp: 1, mana:200, path: [], goal: null, order: null, orders: [], moving: false, action: 'idle', facing: 1, anim: 0, step: 0, blink: 0 };
}
export function createGame(practice = false, options = {}) {
  return { time: 0, auto:!practice&&options.auto!==false, encounter:{tier:0,spawnAt:30,nextGrowth:120,warned:false,raids:0}, stats:{blocked:0,upgrades:0,spells:0}, gold: practice ? 5000 : 30, wood: practice ? 200 : 0, practice, income: 0, woodRate:0, workers:[], market:{buy:155,sell:145}, cooldowns:{}, wards:[], night:false, speed:1, result:'', trollWallet:{gold:practice?5000:50,wood:practice?8:0,items:[]}, bank: 0, nextId: 1, nav: 0, player: actor('player', 350, 375), buildings: [], effects: [], projectiles: [], events: [], test: null };
}
function notify(game, text) { game.events.push(text); }
function fx(game, kind, x, y, extra = {}) { game.effects.push({ kind, x, y, age: 0, life: .7, ...extra }); }
function route(game, unit, destination) {
  const path = findPath(game, unit, destination);
  if (!path) return false;
  unit.goal = { ...destination }; unit.path = path; unit.nav = game.nav;
  return true;
}
function stepUnit(game, unit, dt, speed) {
  unit.moving = false;
  if (!unit.path.length) return;
  if (unit.nav !== game.nav) {
    const path = findPath(game, unit, unit.goal);
    unit.nav = game.nav;
    if (!path) { unit.path = []; return; }
    unit.path = path;
  }
  const p = unit.path[0], length = dist(unit, p), move = Math.min(speed * dt, length);
  if (length < .01) { unit.path.shift(); return; }
  const nx = unit.x + (p.x - unit.x) / length * move, ny = unit.y + (p.y - unit.y) / length * move;
  if (!clearLine(game, unit, { x: nx, y: ny })) { unit.path = []; return; }
  if (Math.abs(nx - unit.x) > .1) unit.facing = nx > unit.x ? 1 : -1;
  unit.x = nx; unit.y = ny; unit.moving = true; unit.anim += dt; unit.step += move; unit.walkDistance = (unit.walkDistance || 0) + move;
  if (unit.step >= 26) { unit.step = 0; fx(game, 'foot', unit.x, unit.y, { life: 3, side: Math.floor(unit.anim * 7) % 2 }); }
  if (move >= length - .01) unit.path.shift();
}
export function movePlayer(game, point) {
  if (!free(game, point.x, point.y)) return '树林、岩壁和建筑不能穿行';
  if (!route(game, game.player, point)) return '通路被封住了；可用闪烁越过墙体';
  game.player.order = null; game.player.orders = []; game.player.action = 'idle';
  fx(game, 'command', point.x, point.y, { life: .9 });
  return '';
}
export function placement(game, type, point) {
  if (!LEVELS[type]) return { error: '未知建筑' };
  const slot = [...SLOTS[type]].sort((a,b)=>dist(a,point)-dist(b,point))[0];
  const p = {...slot};
  const alive = game.buildings.filter(b => b.hp > 0);
  let error = dist(p,point)>90 ? '请点击对应建筑的固定基座' : '';
  if (!error && type === 'wall') {
    if (dist(point, GATE) > 110) error = '主墙须建在金色标记的唯一窄口';
    else if (alive.some(b => b.type === 'wall')) error = '营地同时只能有一堵主墙，请升级或修理现有墙';
    else if ([game.player, game.test].filter(Boolean).some(u => Math.abs(u.x - p.x) < 45 && Math.abs(u.y - p.y) < 65)) error = '入口有人，暂时不能封墙';
  } else {
    if (error) return {...p,error};
    if (!terrainFree(p.x,p.y)) error = '基座不可用';
    else if (type !== 'tower' && alive.some(b => b.type === type)) error = '这类建筑同时只能有一座';
    else if (type === 'tower' && alive.filter(b => b.type === type).length >= 3) error = '练习营地最多容纳三座防御塔';
  }
  if (!error && alive.some(b => dist(p, b) < footprint(type) + footprint(b.type) + 22)) error = '建筑占地重叠，请留出行走空间';
  return { ...p, error };
}
function approach(game, unit, b) {
  const points = b.type === 'wall'
    ? [{ x: b.x - 64, y: b.y }, { x: b.x + 64, y: b.y }]
    : Array.from({ length: 12 }, (_, i) => ({ x: b.x + Math.cos(i * Math.PI / 6) * (footprint(b.type) + 31), y: b.y + Math.sin(i * Math.PI / 6) * (footprint(b.type) + 31) }));
  points.sort((a, c) => dist(unit, a) - dist(unit, c));
  for (const p of points) { const path = findPath(game, unit, p); if (path) return { point: p, path }; }
  return null;
}
function assignWork(game, b, kind) {
  if (game.player.order?.id === b.id && game.player.order.kind === kind) return '';
  const arrival = approach(game, game.player, b);
  if (!arrival) return '无法靠近建筑，请先恢复通路';
  if (kind === 'repair' || game.player.order?.kind === 'repair') stopPlayer(game);
  else if (game.player.order) {
    if (!game.player.orders.some(o => o.id === b.id && o.kind === kind)) game.player.orders.push({ kind, id: b.id });
    return '';
  }
  game.player.order = { kind, id: b.id, point: arrival.point };
  game.player.workPhase = 0;
  game.player.goal = arrival.point; game.player.path = arrival.path; game.player.nav = game.nav;
  return '';
}
function nextWork(game) {
  game.player.path = []; game.player.goal = null; game.player.order = null; game.player.action = 'idle';
  while (game.player.orders.length) {
    const order = game.player.orders.shift(), b = game.buildings.find(v => v.id === order.id && v.hp > 0);
    if (!b || (order.kind === 'build' && b.progress === 1)) continue;
    const error = assignWork(game, b, order.kind);
    if (!error) return;
    notify(game, info(b).name + '等待施工：' + error);
  }
}
export function build(game, type, x, y, targetId) {
  const pos = placement(game, type, { x, y }); if (pos.error) return pos.error;
  const level=type==='tower'&&targetId===' ngn'?14:0;
  if(targetId&&!(type==='tower'&&['h001',' ngn'].includes(targetId)))return '没有该建筑选择';
  const price = LEVELS[type][level];
  if(!game.practice){
    const missing = requirement(game,price); if(missing) return missing;
    if (game.gold < price.gold || game.wood < price.wood) return '资源不足';
  }
  const b = { id: game.nextId++, type, level, x: pos.x, y: pos.y, hp: 1, started: false, progress: 0, fire: 0, pulse: 0, workClock: 0, upgrade: null };
  const error = assignWork(game, b, 'build'); if (error) return error;
  if(!game.practice){game.gold -= price.gold;game.wood -= price.wood;}
  game.buildings.push(b);
  fx(game, 'command', b.x, b.y); notify(game, game.player.order.id === b.id ? '精灵正在前往施工位置' : info(b).name + '已加入施工队列');
  return '';
}
// 只有墙需要精灵动手；未建完的建筑仍然要精灵继续施工。
export function repair(game, b) {
  if (!b || b.hp <= 0) return '请先选中自己的建筑';
  if (b.progress < 1) return assignWork(game, b, 'build');

  if (b.type !== 'wall') return '墙体之外的建筑不必手工修理';
  return assignWork(game, b, 'repair');
}
// 升级是建筑自身的行为：点一下就开工，精灵不必到场。
export function upgrade(game, b, targetId) {
  if (!b || b.hp <= 0 || b.progress < 1) return '建筑建成后才能升级';
  if (b.upgrade) return '正在升级中';
  const options=upgradeOptions(b), next=options.find(d=>d.id===targetId)||(!targetId?options[0]:null);
  if (!next) return '没有该升级选择';
  if(!game.practice){
    const missing=requirement(game,next);if(missing)return missing;
    if (game.gold < next.gold || game.wood < next.wood) return '升级资源不足';
    game.gold-=next.gold;game.wood-=next.wood;
  }
  b.upgrade={progress:0,target:INDEX[next.id].level};
  fx(game,'spark',b.x,b.y-25);notify(game,'开始升级：'+next.name);return '';
}
export function stopPlayer(game) { game.player.path = []; game.player.goal = null; game.player.order = null; game.player.orders = []; game.player.action = 'idle'; }
export function blink(game, point) {
  if (game.player.blink > 0) return '闪烁冷却中';
  if (dist(game.player, point) > 250) return '闪烁距离不能超过 250';
  if (!free(game, point.x, point.y)) return '落点被地形或建筑占据';
  fx(game, 'blink', game.player.x, game.player.y, { life: .8 });
  stopPlayer(game); game.player.x = point.x; game.player.y = point.y; game.player.blink = 19;
  fx(game, 'blink', point.x, point.y, { life: .8 }); return '';
}
function workTick(game, dt) {
  const unit = game.player, order = unit.order;
  if (!order) return;
  const b = game.buildings.find(v => v.id === order.id && v.hp > 0);
  if (!b) { nextWork(game); return; }
  if (dist(unit, order.point) > 5) {
    if (!unit.path.length && !route(game, unit, order.point)) { nextWork(game); notify(game, '施工位置的通路被阻挡'); }
    return;
  }
  unit.action = order.kind; unit.anim += dt; unit.facing = b.x > unit.x ? 1 : -1;
  const previousFrame = Math.floor(unit.workPhase * 6) % 4;
  unit.workPhase += dt;
  if (previousFrame !== 2 && Math.floor(unit.workPhase * 6) % 4 === 2) fx(game, order.kind === 'repair' ? 'repair' : 'spark', b.x - 10, b.y - 25);
  if (order.kind === 'build') {
    if (!b.started) {
      if (game.test && Math.abs(game.test.x - b.x) < 45 && Math.abs(game.test.y - b.y) < 60) { notify(game, '入口被占据，精灵等待施工'); return; }
      b.started = true; b.hp = info(b).hp * .15; game.nav++;
    }
    const delta = Math.min(dt / buildTime(b.type), 1 - b.progress);
    b.progress += delta; b.hp = Math.min(info(b).hp, b.hp + info(b).hp * .85 * delta);
    if (b.progress >= 1 - 1e-7) { b.progress = 1; nextWork(game); fx(game, 'complete', b.x, b.y, { life: 1 }); notify(game, info(b).name + '建造完成'); }
  } else {
    // 地图主墙 ugor/ulur 为 0：持续修理不扣金木。
    const amount = Math.min(dt * 28 * Math.sqrt(info(b).hp/50),info(b).hp-b.hp);
    b.hp += amount;
    // 修满后保留修墙指令，等待下一次受击；移动或停止才取消。
  }
}
// 手动试验单位只执行外侧入口→攻墙→通过入口的固定指令，不搜索或决策。
export function startAssault(game) {
  if(game.player.hp<=0||game.result)return '对局已结束，请重新开局';
  game.projectiles=[];
  const stats=trollStats(game); game.test = { ...actor('troll',1080,432),...stats,hp:stats.maxHp,hit:0,stage:'approach',facing:-1,statuses:{},invisible:0,spellCooldowns:{} }; game.encounter.raids++;game.test.raidAt=game.time;game.test.shopAt=0;
  route(game, game.test, { x: GATE.x + 66, y: GATE.y });
  notify(game,game.auto?'巨魔进入雪林，守住入口！':'攻墙测试开始：观察窄口与墙后修理');return '';
}
export function stopAssault(game) { game.test = null; game.projectiles = []; notify(game, '攻墙测试已停止'); }
function hurt(game, b, damage) {
  if(b.shield>0)return;
  const actual = Math.min(b.hp, damageAfterArmor(damage,info(b).armor)); b.hp -= actual; game.stats.blocked+=actual;game.trollWallet.gold+=actual; b.pulse = .22;
  fx(game, 'damage', b.x, b.y - 40, { text: '−' + Math.round(actual), life: .8 });
  if (b.hp <= 0) { b.hp = 0; game.nav++; fx(game, 'debris', b.x, b.y, { life: 1.3 }); notify(game, info(b).name + '被毁，通路恢复'); }
}
function assaultTick(game, dt) {
  const t = game.test; if (!t || t.hp <= 0) return;
  t.hit=Math.max(0,t.hit-dt);
  if(t.statuses.root>0){t.moving=false;t.action='idle';return;}
  if(t.stage==='retreat'){if(!t.path.length)route(game,t,{x:1080,y:432});stepUnit(game,t,dt,120);if(t.x>1040){t.stage='shop';t.action='idle';t.shopAt=game.time;if(game.auto)autoEquip(game);}return;}
  if(t.stage==='shop'){t.hp=Math.min(t.maxHp,t.hp+dt*t.maxHp*.035);if(game.auto&&game.time-t.shopAt>=5){t.stage='approach';t.raidAt=game.time;game.encounter.raids++;route(game,t,{x:GATE.x+66,y:GATE.y});if(t.statuses.silence<=0)trollSpell(game,'invisible');notify(game,'巨魔补给完成，再次进攻');}return;}
  if(game.auto&&t.x>GATE.x+40&&game.time-t.raidAt>42&&t.hp>t.maxHp*.12){if(!retreat(game))notify(game,'巨魔负伤回店，趁机发展经济');return;}
  const slow=t.statuses.frost>0||t.statuses.poison>0;
  const speed=slow?.55:1;
  const wall = game.buildings.find(b => b.type === 'wall' && b.started && b.hp > 0);
  if (wall) {
    const outside={x:GATE.x+(t.x<GATE.x?-66:66),y:GATE.y};
    if (Math.abs(t.x - outside.x) > 4 || Math.abs(t.y - outside.y) > 4) {
      t.stage = 'approach';
      if (!t.path.length || t.nav !== game.nav) route(game, t, outside);
      stepUnit(game, t, dt, 105*speed); return;
    }
    t.path = []; t.stage = 'attack'; t.action = 'attack'; t.anim += dt;
    if (t.hit <= 0) { hurt(game, wall, t.attack); t.invisible=0; t.attackPeriod=1.2/(1+t.haste)*(slow?1.5:1); t.hit=t.attackPeriod; fx(game, 'impact', wall.x + 15, wall.y - 18); }
  } else if(t.stage!=='done') {
    const inside = { x: 410, y: 432 };
    t.stage = 'breach'; t.action = 'idle';
    if (!t.path.length && dist(t, inside) > 5) route(game, t, inside);
    stepUnit(game, t, dt, 100*speed);
    if (dist(t, inside)<5) { t.stage='done';t.path=[]; }
  }
  if(t.stage==='done'){
    if(dist(t,game.player)>45){if(!t.path.length||t.nav!==game.nav||!t.goal||dist(t.goal,game.player)>24)route(game,t,{x:game.player.x,y:game.player.y});stepUnit(game,t,dt,115*speed);}
    else if(t.hit<=0){game.player.hp=Math.max(0,game.player.hp-t.attack);t.hit=1.2;if(game.player.hp<=0){game.result='巨魔获胜';notify(game,'你的精灵阵亡，巨魔获胜');}}
  }
}
export function advance(game, dt) {
  if(game.result)return;dt=Math.min(dt,.05);game.time+=dt;enemyDirector(game);
  game.player.mana=Math.min(200,(game.player.mana??200)+dt*3);
  for(const key in game.cooldowns)game.cooldowns[key]=Math.max(0,game.cooldowns[key]-dt);
  for(const b of game.buildings)b.shield=Math.max(0,(b.shield||0)-dt);
  if(game.test){const t=game.test;for(const k in t.statuses)t.statuses[k]=Math.max(0,t.statuses[k]-dt);t.invisible=Math.max(0,t.invisible-dt);if(t.statuses.poison>0)t.hp=Math.max(0,t.hp-dt*512);if(t.hp>0)t.hp=Math.min(t.maxHp,t.hp+dt*t.regen);}
  game.player.action = 'idle'; game.player.blink = Math.max(0, game.player.blink - dt); game.player.casting = Math.max(0, (game.player.casting || 0) - dt);
  if(game.test)game.test.hurt=Math.max(0,(game.test.hurt||0)-dt);
  stepUnit(game, game.player, dt, 150); workTick(game, dt);
  game.income = game.buildings.filter(b => ['house','mine'].includes(b.type) && b.hp > 0 && b.progress >= 1).reduce((sum, b) => sum + info(b).income, 0);
  game.gold += game.income * dt;
  game.woodRate=woodProduction(game);game.wood+=game.woodRate*dt;
  for(const worker of game.workers){stepUnit(game,worker,dt,130);const wall=game.buildings.find(b=>b.type==='wall'&&b.hp>0&&b.progress===1);worker.action='idle';if(wall&&dist(worker,wall)<100&&wall.hp<info(wall).hp){worker.action='repair';worker.anim+=dt;wall.hp=Math.min(info(wall).hp,wall.hp+dt*info(wall).hp/(Math.max(.03,WORKERS[worker.tier].ratio)*10));}}
  if (game.test) { game.test.moving = false; assaultTick(game, dt); }
  const revealed=game.test&&(game.wards.some(w=>w.until>game.time&&dist(w,game.test)<350)||game.buildings.some(b=>b.type==='tower'&&b.hp>0&&b.progress===1&&b.addon?.id==='n001'&&dist(b,game.test)<350));
  for (const b of game.buildings) {
    b.pulse = Math.max(0, b.pulse - dt);
    if(b.hp<=0)continue;
    if (b.upgrade) {
      b.upgrade.progress += dt / UPGRADE_TIME;
      if (b.upgrade.progress >= 1) {
        const oldMax = info(b).hp; b.level=b.upgrade.target; b.hp += info(b).hp - oldMax; b.upgrade = null;
        game.stats.upgrades++;fx(game, 'complete', b.x, b.y, { life: 1 }); notify(game, '升级完成：' + info(b).name);
      }
    }
    if(b.type!=='tower'||b.hp<=0||b.progress<1)continue;
    b.fire-=dt;const data=info(b);
    if(b.addon){
      const addon=TOWER_ADDONS.find(d=>d.id===b.addon.id);b.addon.fire-=dt;
      if(addon.heal&&b.addon.fire<=0){const target=game.buildings.find(v=>v.hp>0&&v.progress===1&&v.hp<info(v).hp&&dist(b,v)<addon.range);if(target){target.hp=Math.min(info(target).hp,target.hp+addon.heal);fx(game,'healbeam',b.x+20,b.y-45,{tx:target.x,ty:target.y-25,life:.65});b.addon.fire=2;}}
      if(game.test?.hp>0&&addon.damage&&b.addon.fire<=0&&dist(b,game.test)<=addon.range&&(game.test.invisible<=0||revealed)){game.projectiles.push({fromX:b.x+20,fromY:b.y-45,age:0,damage:addon.damage,effect:addon.effect});b.addon.fire=addon.interval;}
    }
    if(data.heal&&b.fire<=0){const hurtBuilding=game.buildings.find(v=>v.hp>0&&v.progress===1&&v.hp<info(v).hp&&dist(b,v)<350);if(hurtBuilding){hurtBuilding.hp=Math.min(info(hurtBuilding).hp,hurtBuilding.hp+data.heal);fx(game,'healbeam',b.x,b.y-55,{tx:hurtBuilding.x,ty:hurtBuilding.y-25,life:.65});b.fire=2;}}
    if(!game.test||game.test.hp<=0||!data.damage)continue;
    if(game.test.invisible>0&&!revealed)continue;
    if(dist(b,game.test)<=data.range&&b.fire<=0){b.fire=data.interval;fx(game,'muzzle',b.x,b.y-58,{life:.18,color:data.effect});game.projectiles.push({fromX:b.x,fromY:b.y-58,age:0,damage:data.damage,effect:data.effect});}
  }
  for(const shot of game.projectiles){
    shot.age+=dt;
    if(game.test&&shot.age>=.38&&!shot.done){
      let damage=damageAfterArmor(shot.damage,game.test.armor);if(shot.effect==='chaos'){game.seed=((game.seed||12345)*1664525+1013904223)>>>0;if(game.seed/4294967296<.1)damage*=5;}
      game.test.hp=Math.max(0,game.test.hp-damage);game.test.hurt=.12;shot.done=true;
      if(shot.effect==='frost')game.test.statuses.frost=3;
      if(shot.effect==='poison')game.test.statuses.poison=3;
      fx(game,shot.effect,game.test.x,game.test.y-38,{life:.7});fx(game,'damage',game.test.x,game.test.y-58,{text:'−'+Math.round(damage),life:.8});
    }
  }
  if(game.test?.hp<=0&&game.test.stage!=='defeated'){game.test.stage='defeated';game.test.path=[];game.result='精灵获胜';notify(game,'巨魔阵亡，精灵获胜');}

  game.projectiles = game.projectiles.filter(p => !p.done && p.age < 1);
  for (const e of game.effects) e.age += dt;
  game.effects = game.effects.filter(e => e.age < e.life);
}
export function hasUnit(game,id){
  const wanted=INDEX[id];if(!wanted)return false;
  return game.buildings.some(b=>b.hp>0&&b.progress===1&&b.type===wanted.type&&(b.type==='tower'?(wanted.level<13?b.level<13&&b.level>=wanted.level:b.level===wanted.level):b.level>=wanted.level));
}
export function requirement(game,data){
  const missing=data.requires.filter(id=>!hasUnit(game,id));
  return missing.length?'需要：'+missing.map(id=>INDEX[id]?LEVELS[INDEX[id].type][INDEX[id].level].name:id).join('、'):'';
}
export function upgradeOptions(b){
  const next=LEVELS[b.type][b.level+1];
  const ids=b.type==='mine'&&next?[next.id]:info(b).next;
  return ids.filter(id=>INDEX[id]?.type===b.type&&INDEX[id].level===b.level+1).map(id=>LEVELS[b.type][b.level+1]);
}
export function towerAddonOptions(game,b){
  if(!b||b.type!=='tower'||b.level>=13||b.addon)return [];
  return TOWER_ADDONS.filter(d=>{
    const towerReq=d.requires.find(id=>INDEX[id]?.type==='tower');
    return (!towerReq||b.level>=INDEX[towerReq].level)&&(game.practice||!requirement(game,d));
  });
}
export function attachTowerAddon(game,b,id){
  if(!b||b.hp<=0||b.progress<1||b.upgrade)return '塔建成后才能建附塔';
  const data=towerAddonOptions(game,b).find(d=>d.id===id);
  if(!data)return '当前塔不能建造该附塔';
  if(!game.practice){if(game.gold<data.gold||game.wood<data.wood)return '附塔资源不足';game.gold-=data.gold;game.wood-=data.wood;}
  b.addon={id,fire:0};notify(game,'附塔建成：'+data.name);return '';
}
export function damageAfterArmor(damage,armor=0){return damage*(armor>=0?1/(1+.06*armor):2-Math.pow(.94,-armor));}
function woodProduction(game){const tree=game.buildings.find(b=>b.type==='grove'&&b.hp>0&&b.progress===1);return tree?info(tree).income:0;}
export function recruit(game,kind,tier=0){
  if(kind!=='worker')return '采木由远古之树升级，不再单独雇佣';
  const list=WORKERS,data=list[tier];
  if(!Number.isInteger(tier)||!data)return '无此单位';
  if(!hasUnit(game,'u00V'))return '先建工人行会';
  if(game.workers.length>=12)return '该类单位上限 12';
  if(game.gold<data.gold||game.wood<data.wood)return '资源不足';
  game.gold-=data.gold;game.wood-=data.wood;
  const guild=game.buildings.find(b=>b.type==='guild'&&b.hp>0),w={...actor('worker',guild.x+50,guild.y),tier};game.workers.push(w);route(game,w,{x:GATE.x-70,y:GATE.y-8-(game.workers.length%3)*8});
  return '';
}
export function trade(game,action,qty=10){
  if(!['buy','sell'].includes(action))return '交易方向无效';
  if(!hasUnit(game,'u00H'))return '先建大厅，解锁金木交易';if(![10,200].includes(qty))return '交易数量无效';
  const n=qty/10,price=action==='buy'?n*game.market.buy+5*n*(n-1)/2:n*game.market.sell-5*n*(n-1)/2;
  if(action==='buy'){if(game.gold<price)return '金币不足';game.gold-=price;game.wood+=qty;game.market.buy+=5*n;game.market.sell+=5*n;}
  else{if(game.wood<qty||price<0)return '木材不足或当前价格不可售出';game.wood-=qty;game.gold+=price;game.market.buy-=5*n;game.market.sell-=5*n;}
  return '';
}
export const SKILLS={
  root:{name:'缠绕',mana:75,cd:35,duration:3,tip:'定身并阻止攻击 3 秒；冷却 35 秒'},
  shield:{name:'神之护盾',mana:0,cd:600,duration:10,tip:'保护主墙 10 秒，期间免受伤害'},
  silence:{name:'沉默',mana:75,cd:60,duration:5,tip:'封锁巨魔主动技能 5 秒，不影响普通攻击'},
  ward:{name:'侦察守卫',mana:100,cd:30,duration:200,tip:'揭示营地入口，侦测隐身，持续 200 秒'},
  stars:{name:'星辰之夜',mana:100,cd:60,duration:0,tip:'切换为夜间光照，持续修理和塔攻击照常进行'},
};
export function castSkill(game,key,target){
  const skill=SKILLS[key];if(!skill)return '未知技能';if(game.cooldowns[key]>0)return '技能冷却中';
  if((game.player.mana??200)<skill.mana)return '魔法不足';
  const wall=game.buildings.find(b=>b.type==='wall'&&b.hp>0);
  if(key==='shield'&&!wall)return '没有可保护的主墙';
  if(['root','silence'].includes(key)&&(!game.test||game.test.hp<=0))return '没有活着的巨魔';
  if(['root','silence'].includes(key)&&!trollVisible(game))return '巨魔正在隐身，先使用侦察守卫或真视附塔';
  const victim=key==='shield'?wall:['root','silence'].includes(key)?game.test:game.player;
  if(dist(game.player,victim)>(key==='shield'?700:500))return '目标不在施法范围内';
  game.stats.spells++;game.player.mana=(game.player.mana??200)-skill.mana;game.cooldowns[key]=skill.cd;
  game.player.casting=.45;fx(game,'cast',game.player.x,game.player.y-22,{life:.6});
  if(key==='shield'){wall.shield=10;fx(game,'shield',wall.x,wall.y-25,{life:1});}
  else if(key==='root'||key==='silence'){game.test.statuses[key]=skill.duration;fx(game,key,game.test.x,game.test.y-25,{life:1});}
  else if(key==='ward')game.wards.push({x:GATE.x+85,y:GATE.y-55,until:game.time+200});
  else game.night=!game.night;
  notify(game,skill.name+'已释放');return '';
}
export function trollStats(game){
  const tier=game.auto?game.encounter.tier:0;
  const stats={maxHp:Math.round(500*Math.pow(1.25,tier)),attack:Math.round(9*Math.pow(1.17,tier)),armor:tier,regen:0,haste:Math.min(.6,tier*.035)};
  for(const id of game.trollWallet.items){const b=ITEMS[id].bonus;stats.maxHp+=(b.hp||0)+(b.strength||0)*25;stats.attack+=(b.attack||0)+(b.agility||0);stats.armor+=b.armor||0;stats.regen+=b.regen||0;stats.haste+=(b.haste||0)+(b.agility||0)*.02;}
  stats.haste=Math.min(4,stats.haste);return stats;
}
export function buyItem(game,id){
  const item=ITEMS[id];if(!item||!SHOPS.some(s=>s.items.includes(id)))return '此商品未在商店上架';
  if(game.test&&game.test.x<980)return '巨魔需要先回到出生点商店';
  if(game.trollWallet.gold<item.gold||game.trollWallet.wood<item.wood)return '巨魔资源不足（与精灵分开结算）';
  if(!item.bonus.lumber&&game.trollWallet.items.length>=6)return '巨魔背包最多 6 格';
  if(id==='I01N'&&game.trollWallet.items.includes(id))return '速度之靴不可重复购买';
  const old=trollStats(game);game.trollWallet.gold-=item.gold;game.trollWallet.wood-=item.wood;
  if(item.bonus.lumber)game.trollWallet.wood+=item.bonus.lumber;else game.trollWallet.items.push(id);
  if(game.test){Object.assign(game.test,trollStats(game));game.test.hp+=game.test.maxHp-old.maxHp;}
  return '';
}
export function trollSpell(game,key){
  const t=game.test;if(!t||t.hp<=0)return '没有活着的巨魔';if(t.statuses.silence>0)return '巨魔被沉默，无法施法';
  if((t.spellCooldowns[key]||0)>game.time)return '巨魔技能冷却中';
  if(key==='invisible'){t.invisible=15;t.spellCooldowns[key]=game.time+45;}
  else if(key==='teleport'){t.x=1080;t.y=432;t.path=[];t.stage='shop';t.action='idle';t.spellCooldowns[key]=game.time+45;}
  else if(key==='reveal'){fx(game,'reveal',CAMP.x,CAMP.y,{life:5});t.spellCooldowns[key]=game.time+60;}
  return '';
}
export function trollVisible(game){
  const t=game.test;
  return !!t&&(t.invisible<=0||game.wards.some(w=>w.until>game.time&&dist(w,t)<350)||game.buildings.some(b=>b.type==='tower'&&b.hp>0&&b.progress===1&&b.addon?.id==='n001'&&dist(b,t)<350));
}
export function retreat(game){const t=game.test;if(!t)return '未开始试炼';if(!route(game,t,{x:1080,y:432}))return '回城道路被阻挡';t.stage='retreat';t.action='idle';return '';}
export function enemyDirector(game){
  if(!game.auto)return;
  if(!game.test&&game.time>=game.encounter.spawnAt){startAssault(game);trollSpell(game,'invisible');notify(game,'巨魔隐身入场，可用侦察守卫发现它');}
  const t=game.test;if(!t||t.hp<=0)return;
  if(!game.encounter.warned&&game.time>=game.encounter.nextGrowth-10){game.encounter.warned=true;notify(game,'10 秒后巨魔强化，检查主墙和塔的等级');}
  while(game.time>=game.encounter.nextGrowth){
    const ratio=t.hp/t.maxHp;game.encounter.tier++;Object.assign(t,trollStats(game));t.hp=Math.max(1,ratio*t.maxHp);
    game.encounter.nextGrowth+=90;game.encounter.warned=false;
    fx(game,'chaos',t.x,t.y-35,{life:1.6});notify(game,'巨魔强化至 '+(game.encounter.tier+1)+' 阶：攻击、生命与护甲提升');
  }
}
function autoEquip(game){
  // 每次回店购置一件买得起的下一档装备，保持 6 格背包限制。
  const lines=[['I00C','I00D','I00E','I00F','I00X','I00Z','I00Y','I010'],['I004','I005','I006','I007','I00M','I00N','I00O','I00P'],['I00G','I00H','I002','I00I','I00Q','I00R','I00S','I00T']];
  for(const family of lines){
    const owned=family.findIndex(id=>game.trollWallet.items.includes(id)),next=family[owned+1];
    if(!next||game.trollWallet.gold<ITEMS[next].gold)continue;
    const slot=owned>=0?game.trollWallet.items.indexOf(family[owned]):-1;
    if(slot<0&&game.trollWallet.items.length>=6)continue;
    game.trollWallet.gold-=ITEMS[next].gold;if(slot>=0)game.trollWallet.items[slot]=next;else game.trollWallet.items.push(next);
    const ratio=game.test.hp/game.test.maxHp;Object.assign(game.test,trollStats(game));game.test.hp=ratio*game.test.maxHp;
    notify(game,'巨魔购买了 '+ITEMS[next].name);break;
  }
}
