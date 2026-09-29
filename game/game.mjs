// 雪林营地：共享碰撞、施工与修理规则。场景不包含 AI 决策。
export const MAP = { w: 1672, h: 941, cell: 16 };
export const CAMP = { x: 310, y: 375, rx: 230, ry: 170 };
export const GATE = { x: 584, y: 432, halfW: 24, halfH: 44 };
export const ROAD = [{ x: 488, y: 432 }, { x: 1130, y: 432 }];
export const LEVELS = {
  house: [
    { name: '林间小屋', gold: 0, wood: 0, hp: 160, income: 2 },
    { name: '守林宅邸', gold: 50, wood: 0, hp: 280, income: 4 },
    { name: '雪林庄园', gold: 120, wood: 8, hp: 440, income: 8 },
  ],
  wall: [
    { name: '入口石墙', gold: 4, wood: 0, hp: 220 },
    { name: '坚固壁垒', gold: 35, wood: 0, hp: 440 },
    { name: '符纹壁垒', gold: 100, wood: 10, hp: 800 },
  ],
  tower: [
    { name: '青晶哨塔', gold: 16, wood: 0, hp: 100, damage: 10 },
    { name: '霜光塔', gold: 50, wood: 3, hp: 180, damage: 22 },
    { name: '极光塔', gold: 140, wood: 12, hp: 300, damage: 40 },
  ],
  grove: [{ name: '采木工坊', gold: 45, wood: 0, hp: 150 }],
};
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const info = b => LEVELS[b.type][b.level];
const footprint = type => ({ house: 30, tower: 23, grove: 29, wall: 32 })[type];
const buildTime = type => ({ house: 4, wall: 5, tower: 6, grove: 6 })[type];
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
  return { id, x, y, hp: 80, maxHp: 80, path: [], goal: null, order: null, moving: false, action: 'idle', facing: 1, anim: 0, step: 0, blink: 0 };
}
export function createGame() {
  return { time: 0, gold: 120, wood: 12, income: 0, bank: 0, nextId: 1, nav: 0, player: actor('player', 350, 375), buildings: [], effects: [], projectiles: [], events: [], test: null };
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
  unit.x = nx; unit.y = ny; unit.moving = true; unit.anim += dt; unit.step += move;
  if (unit.step >= 26) { unit.step = 0; fx(game, 'foot', unit.x, unit.y, { life: 3, side: Math.floor(unit.anim * 7) % 2 }); }
  if (move >= length - .01) unit.path.shift();
}
export function movePlayer(game, point) {
  if (!free(game, point.x, point.y)) return '树林、岩壁和建筑不能穿行';
  if (!route(game, game.player, point)) return '通路被封住了；可用闪烁越过墙体';
  game.player.order = null; game.player.action = 'idle';
  fx(game, 'command', point.x, point.y, { life: .9 });
  return '';
}
export function placement(game, type, point) {
  if (!LEVELS[type]) return { error: '未知建筑' };
  const p = type === 'wall' ? { x: GATE.x, y: GATE.y } : { x: Math.round(point.x / 16) * 16, y: Math.round(point.y / 16) * 16 };
  const alive = game.buildings.filter(b => b.hp > 0);
  let error = '';
  if (type === 'wall') {
    if (dist(point, GATE) > 110) error = '主墙须建在金色标记的唯一窄口';
    else if (alive.some(b => b.type === 'wall')) error = '营地同时只能有一堵主墙，请升级或修理现有墙';
    else if ([game.player, game.test].filter(Boolean).some(u => Math.abs(u.x - p.x) < 45 && Math.abs(u.y - p.y) < 65)) error = '入口有人，暂时不能封墙';
  } else {
    if (((p.x - CAMP.x) / (CAMP.rx - 42)) ** 2 + ((p.y - CAMP.y) / (CAMP.ry - 42)) ** 2 > 1) error = '请选择营地内的空地，入口要留给主墙';
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
  const arrival = approach(game, game.player, b);
  if (!arrival) return '无法靠近建筑，请先恢复通路';
  game.player.order = { kind, id: b.id, point: arrival.point };
  game.player.goal = arrival.point; game.player.path = arrival.path; game.player.nav = game.nav;
  return '';
}
export function build(game, type, x, y) {
  const pos = placement(game, type, { x, y }); if (pos.error) return pos.error;
  const price = LEVELS[type][0];
  if (game.gold < price.gold || game.wood < price.wood) return '资源不足';
  const b = { id: game.nextId++, type, level: 0, x: pos.x, y: pos.y, hp: 1, started: false, progress: 0, fire: 0, pulse: 0, workClock: 0, upgrade: null };
  const error = assignWork(game, b, 'build'); if (error) return error;
  game.gold -= price.gold; game.wood -= price.wood; game.buildings.push(b);
  fx(game, 'command', b.x, b.y); notify(game, '精灵正在前往施工位置');
  return '';
}
export function repair(game, b) {
  if (!b || b.hp <= 0) return '请先选中自己的建筑';
  if (b.progress < 1) return assignWork(game, b, 'build');
  if (b.upgrade) return assignWork(game, b, 'upgrade');
  if (b.hp >= info(b).hp - .01) return '建筑已经完好';
  if (game.gold < 1) return '修理需要金币：每秒 1 金';
  return assignWork(game, b, 'repair');
}
export function upgrade(game, b) {
  if (!b || b.hp <= 0 || b.progress < 1) return '建筑建成后才能升级';
  if (b.upgrade) return assignWork(game, b, 'upgrade');
  const next = LEVELS[b.type][b.level + 1];
  if (!next) return '已达到本场景最高等级';
  if (game.gold < next.gold || game.wood < next.wood) return '升级资源不足';
  const error = assignWork(game, b, 'upgrade'); if (error) return error;
  game.gold -= next.gold; game.wood -= next.wood; b.upgrade = { progress: 0 };
  return '';
}
export function stopPlayer(game) { game.player.path = []; game.player.goal = null; game.player.order = null; game.player.action = 'idle'; }
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
  if (!b) { stopPlayer(game); return; }
  if (dist(unit, order.point) > 5) {
    if (!unit.path.length && !route(game, unit, order.point)) { stopPlayer(game); notify(game, '施工位置的通路被阻挡'); }
    return;
  }
  unit.action = order.kind; unit.anim += dt; unit.facing = b.x > unit.x ? 1 : -1;
  b.workClock += dt;
  if (b.workClock >= .45) { b.workClock = 0; fx(game, order.kind === 'repair' ? 'repair' : 'spark', b.x - 10, b.y - 25); }
  if (order.kind === 'build') {
    if (!b.started) {
      if (game.test && Math.abs(game.test.x - b.x) < 45 && Math.abs(game.test.y - b.y) < 60) { notify(game, '入口被占据，精灵等待施工'); return; }
      b.started = true; b.hp = info(b).hp * .15; game.nav++;
    }
    const delta = Math.min(dt / buildTime(b.type), 1 - b.progress);
    b.progress += delta; b.hp = Math.min(info(b).hp, b.hp + info(b).hp * .85 * delta);
    if (b.progress >= 1 - 1e-7) { b.progress = 1; stopPlayer(game); fx(game, 'complete', b.x, b.y, { life: 1 }); notify(game, info(b).name + '建造完成'); }
  } else if (order.kind === 'upgrade') {
    b.upgrade.progress += dt / 5;
    if (b.upgrade.progress >= 1) {
      const oldMax = info(b).hp; b.level++; b.hp += info(b).hp - oldMax; b.upgrade = null; stopPlayer(game);
      fx(game, 'complete', b.x, b.y, { life: 1 }); notify(game, '升级完成：' + info(b).name);
    }
  } else {
    const fraction = Math.min(dt, game.gold, (info(b).hp - b.hp) / 28);
    game.gold = Math.max(0, game.gold - fraction); b.hp = Math.min(info(b).hp, b.hp + fraction * 28);
    if (b.hp >= info(b).hp - .01 || game.gold < .001) { stopPlayer(game); notify(game, b.hp >= info(b).hp - .01 ? '修理完成' : '金币不足，修理暂停'); }
  }
}
// 手动试验单位只执行外侧入口→攻墙→通过入口的固定指令，不搜索或决策。
export function startAssault(game) {
  game.test = { ...actor('troll', 1080, 432), hp: 900, maxHp: 900, hit: 0, stage: 'approach', facing: -1 };
  route(game, game.test, { x: GATE.x + 66, y: GATE.y });
  notify(game, '攻墙测试开始：观察窄口与墙后修理');
}
export function stopAssault(game) { game.test = null; game.projectiles = []; notify(game, '攻墙测试已停止'); }
function hurt(game, b, damage) {
  const actual = Math.min(b.hp, damage); b.hp -= actual; b.pulse = .22;
  fx(game, 'damage', b.x, b.y - 40, { text: '−' + Math.round(actual), life: .8 });
  if (b.hp <= 0) { b.hp = 0; game.nav++; fx(game, 'debris', b.x, b.y, { life: 1.3 }); notify(game, info(b).name + '被毁，通路恢复'); }
}
function assaultTick(game, dt) {
  const t = game.test; if (!t || t.hp <= 0) return;
  t.hit = Math.max(0, t.hit - dt);
  const wall = game.buildings.find(b => b.type === 'wall' && b.started && b.hp > 0);
  if (wall) {
    const outside = { x: GATE.x + 66, y: GATE.y };
    if (Math.abs(t.x - outside.x) > 4 || Math.abs(t.y - outside.y) > 4) {
      t.stage = 'approach';
      if (!t.path.length || t.nav !== game.nav) route(game, t, outside);
      stepUnit(game, t, dt, 105); return;
    }
    t.path = []; t.stage = 'attack'; t.action = 'attack'; t.anim += dt;
    if (t.hit <= 0) { hurt(game, wall, 22); t.hit = 1.2; fx(game, 'impact', wall.x + 15, wall.y - 18); }
  } else {
    const inside = { x: 410, y: 432 };
    t.stage = 'breach'; t.action = 'idle';
    if (!t.path.length && dist(t, inside) > 5) route(game, t, inside);
    stepUnit(game, t, dt, 100);
    if (dist(t, inside) < 5) { t.stage = 'done'; t.moving = false; }
  }
}
export function advance(game, dt) {
  dt = Math.min(dt, .05); game.time += dt;
  game.player.action = 'idle'; game.player.blink = Math.max(0, game.player.blink - dt);
  stepUnit(game, game.player, dt, 150); workTick(game, dt);
  game.income = game.buildings.filter(b => b.type === 'house' && b.hp > 0 && b.progress >= 1).reduce((sum, b) => sum + info(b).income, 0);
  game.gold += game.income * dt;
  if (game.buildings.some(b => b.type === 'grove' && b.hp > 0 && b.progress === 1)) game.wood += dt / 3;
  if (game.test) { game.test.moving = false; assaultTick(game, dt); }
  for (const b of game.buildings) {
    b.pulse = Math.max(0, b.pulse - dt);
    if (b.type !== 'tower' || b.hp <= 0 || b.progress < 1 || !game.test || game.test.hp <= 0) continue;
    b.fire -= dt;
    if (dist(b, game.test) <= 270 && b.fire <= 0) {
      b.fire = 1.2; game.projectiles.push({ x: b.x, y: b.y - 58, fromX: b.x, fromY: b.y - 58, age: 0, damage: info(b).damage });
    }
  }
  for (const shot of game.projectiles) {
    shot.age += dt;
    if (game.test && shot.age >= .38 && !shot.done) {
      game.test.hp = Math.max(0, game.test.hp - shot.damage); shot.done = true;
      fx(game, 'ice', game.test.x, game.test.y - 38);
      if (game.test.hp <= 0) { game.test.stage = 'defeated'; game.test.path = []; notify(game, '巨魔倒下，防线测试成功'); }
    }
  }
  game.projectiles = game.projectiles.filter(p => !p.done && p.age < 1);
  for (const e of game.effects) e.age += dt;
  game.effects = game.effects.filter(e => e.age < e.life);
}
if (typeof document !== 'undefined') startBrowser();

function startBrowser() {
  const $ = id => document.getElementById(id);
  const canvas = $('field'), ctx = canvas.getContext('2d'), mini = $('minimap'), miniCtx = mini.getContext('2d');
  const portrait = $('portrait-canvas'), portraitCtx = portrait.getContext('2d');
  const background = new Image(), atlas = new Image(), actors = new Image();
  background.src = 'assets/snow-map.png'; atlas.src = 'assets/atlas.png'; actors.src = 'assets/actors.png';
  let game = createGame(), selected = game.player, mode = '', started = false, paused = false, loaded = false;
  let camera = { x: 60, y: 200 }, zoom = 1.15, view = { w: 0, h: 0 }, pointer = null, hover = null;
  let last = 0, hudTime = 0, signature = '', toastTime = 0, audio = null, sound = false;
  const terrain = document.createElement('canvas'); terrain.width = MAP.w; terrain.height = MAP.h;
  const terrainCtx = terrain.getContext('2d');
  const sizes = { house: [106, 108], tower: [91, 122], grove: [110, 102], wall: [90, 100] };
  const cell = { house: [2, 0], tower: [1, 1], grove: [2, 1], wall: [0, 1] };
  const labels = { house: '建小屋', wall: '建主墙', tower: '建防塔', grove: '建工坊', upgrade: '升级', repair: '持续修理', blink: '闪烁', stop: '停止', cancel: '取消', select: '选择精灵' };
  const defaults = { house: { x: 272, y: 336 }, wall: GATE, tower: { x: 464, y: 384 }, grove: { x: 256, y: 464 } };
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
  function toWorld(e) { const r = canvas.getBoundingClientRect(); return { x: camera.x + (e.clientX - r.left) / zoom, y: camera.y + (e.clientY - r.top) / zoom }; }
  function hit(p) {
    const objects = [...game.buildings.filter(b => b.hp > 0), game.player, ...(game.test ? [game.test] : [])].sort((a, b) => b.y - a.y);
    return objects.find(o => {
      const w = o.type ? sizes[o.type][0] : o.id === 'troll' ? 100 : 70;
      const h = o.type ? sizes[o.type][1] : o.id === 'troll' ? 100 : 85;
      return p.x >= o.x - w * .48 && p.x <= o.x + w * .48 && p.y >= o.y - h * .8 && p.y <= o.y + 15;
    });
  }
  function command(kind) {
    if (!started) return;
    if (kind in LEVELS || kind === 'blink') {
      mode = mode === kind ? '' : kind; hover = defaults[kind] || { x: game.player.x + 120, y: game.player.y };
      tell(mode ? kind === 'wall' ? '主墙吸附到唯一窄口；点击金色入口开始施工' : kind === 'blink' ? '选择闪烁落点' : '选择空地，精灵会走过去施工' : '已取消放置');
    } else if (kind === 'upgrade') tell(upgrade(game, selected) || '精灵将前往升级建筑');
    else if (kind === 'repair') tell(repair(game, selected) || '精灵将靠近并持续工作；移动或停止可中断');
    else if (kind === 'stop') { stopPlayer(game); tell('精灵已停止当前工作'); }
    else if (kind === 'select') { select(game.player); center(game.player); }
    else mode = '';
    signature = ''; tone('click'); hud();
  }
  function mapClick(p, right = false) {
    if (!started) return;
    if (paused) { tell('当前已暂停，请先继续'); return; }
    if (right && mode) { mode = ''; signature = ''; return; }
    if (mode === 'blink') {
      const error = blink(game, p); tell(error || '闪烁'); if (!error) mode = '';
    } else if (mode in LEVELS) {
      const error = build(game, mode, p.x, p.y); if (error) tell(error);
      else { mode = ''; select(game.buildings.at(-1)); }
    } else {
      const object = hit(p);
      if (object && right && object.type) { select(object); tell(repair(game, object) || '精灵正在前往工作'); }
      else if (object && !right) select(object);
      else { const error = movePlayer(game, p); if (error) tell(error); else select(game.player); }
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
    const key = e.key.toLowerCase(), bindings = { '1': 'house', '2': 'wall', '3': 'tower', '4': 'grove', q: 'blink', r: 'repair', u: 'upgrade', s: 'stop', escape: 'cancel', f1: 'select' };
    if (key === ' ') { e.preventDefault(); center(game.player); }
    else if (bindings[key]) { e.preventDefault(); command(bindings[key]); }
  });
  $('pause').addEventListener('click', () => { paused = !paused; $('pause').textContent = paused ? '继续' : '暂停'; });
  $('sound').addEventListener('click', () => { sound = !sound; $('sound').textContent = sound ? '声音 开' : '声音 关'; tone('click'); });
  $('assault').addEventListener('click', () => { if (!started) return; startAssault(game); });
  $('stop-test').addEventListener('click', () => stopAssault(game));
  function reset() { game = createGame(); selected = game.player; paused = false; mode = ''; signature = ''; $('pause').textContent = '暂停'; center({ x: 500, y: 407 }); hud(); }
  $('reset').addEventListener('click', () => { reset(); tell('营地已重置'); });
  $('start').addEventListener('click', () => { if (!loaded) return; reset(); started = true; $('start-modal').classList.add('hidden'); });
  function buttonData(kind) {
    let title = labels[kind], price = '', disabled = false, hint = '';
    const b = selected?.type && selected.hp > 0 ? selected : null;
    if (kind in LEVELS) {
      const d = LEVELS[kind][0]; price = d.gold + ' 金' + (d.wood ? ' / ' + d.wood + ' 木' : '');
      hint = kind === 'wall' ? '每个营地限一堵，封住窄口。精灵到达后施工。' : '占地预览 → 点击位置 → 精灵走近 → 施工完成。';
      disabled = game.gold < d.gold || (kind !== 'tower' && game.buildings.some(v => v.type === kind && v.hp > 0));
    } else if (kind === 'upgrade') {
      const next = b && LEVELS[b.type][b.level + 1];
      price = next ? next.gold + ' 金 / ' + next.wood + ' 木' : '已满级';
      disabled = !next || b.progress < 1 || !!b.upgrade || game.gold < next.gold || game.wood < next.wood;
      hint = '精灵靠近施工 5 秒；升级期间墙保持阻挡。';
    } else if (kind === 'repair') {
      title = b?.progress < 1 ? '继续施工' : b?.upgrade ? '继续升级' : '修理建筑';
      price = b?.progress < 1 || b?.upgrade ? '需精灵靠近' : '28 生命 / 秒 · 1 金 / 秒';
      disabled = !b || (b.progress === 1 && !b.upgrade && b.hp >= info(b).hp - .01);
      hint = '派精灵走到建筑旁持续修理。移动、停止或金币用尽会中断。';
    } else if (kind === 'blink') { price = game.player.blink > 0 ? Math.ceil(game.player.blink) + ' 秒冷却' : '短距位移 · Q'; disabled = game.player.blink > 0; hint = '可越过墙，落点必须是能站立的地面。'; }
    else if (kind === 'stop') { price = '中断当前指令'; hint = '停止行走、施工或修理。未完成建筑可以继续施工。'; }
    else if (kind === 'select') price = 'F1 / 空格定位';
    else price = 'Esc';
    return { kind, title, price, disabled, hint };
  }
  function hud() {
    if (selected?.type && selected.hp <= 0) selected = game.player;
    $('gold').textContent = Math.floor(game.gold); $('wood').textContent = Math.floor(game.wood); $('income').textContent = '+' + game.income;
    const seconds = Math.floor(game.time); $('clock').textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    const wall = game.buildings.find(b => b.type === 'wall' && b.hp > 0 && b.started);
    $('status').textContent = wall ? '窄口已封锁' : '入口畅通'; $('status').classList.toggle('sealed', !!wall);
    $('test-status').textContent = !game.test ? '无 AI · 手动试炼' : ({ approach: '巨魔正在沿路接近', attack: '巨魔被挡在墙外', breach: '入口已打开，巨魔正进入', done: '巨魔已通过入口', defeated: '防御成功：巨魔倒下' })[game.test.stage];
    const b = selected?.type ? selected : null, max = b ? info(b).hp : selected.maxHp;
    $('selected-name').textContent = b ? info(b).name + ' · ' + (b.level + 1) + ' 阶' : selected.id === 'troll' ? '攻墙试炼 · 巨魔' : '精灵工匠';
    $('selected-health').textContent = Math.ceil(selected.hp) + ' / ' + max;
    $('health-fill').style.width = clamp(selected.hp / max * 100, 0, 100) + '%';
    $('health-fill').classList.toggle('danger', selected.hp / max < .35);
    const actionNames = { build: '施工', repair: '修理', upgrade: '升级' }, job = game.player.order;
    $('order-status').textContent = job ? (game.player.moving ? '前往' : '正在') + actionNames[job.kind] : game.player.moving ? '正在沿道路移动' : '等待指令';
    const progress = b?.upgrade ? b.upgrade.progress : b?.progress < 1 ? b.progress : null;
    $('work-progress').hidden = progress === null; $('work-fill').style.width = (progress || 0) * 100 + '%';
    $('selected-detail').textContent = b ? progress !== null ? (b.upgrade ? '升级中 ' : b.started ? '施工中 ' : '等待精灵 ') + Math.floor(progress * 100) + '%' : b.type === 'wall' ? '实体碰撞 · 封锁唯一窄口 · R 持续修理' : b.type === 'tower' ? '攻击 ' + info(b).damage + ' · 射程 270' : b.type === 'house' ? '每秒产生 ' + info(b).income + ' 金币' : '每 3 秒产生 1 木材' : '移动 / 建造 / 施工 / 持续修理 / 闪烁';
    const kinds = b ? ['house', 'wall', 'tower', 'select', 'upgrade', mode ? 'cancel' : 'repair'] : ['house', 'wall', 'tower', 'grove', 'blink', mode ? 'cancel' : 'stop'];
    const data = kinds.map(buttonData), nextSig = JSON.stringify(data) + mode;
    if (signature !== nextSig) {
      signature = nextSig;
      $('commands').replaceChildren(...data.map((d, i) => {
        const button = document.createElement('button'); button.type = 'button'; button.disabled = d.disabled; button.setAttribute('aria-label', d.title);
        button.className = 'command' + (mode === d.kind ? ' active' : ''); button.title = d.title + '：' + d.price + '。' + d.hint;
        const icon = document.createElement('span'); icon.className = 'command-art art-' + d.kind;
        if (!(d.kind in LEVELS)) icon.textContent = { upgrade: '↑', repair: '⚒', blink: '✧', stop: '■', cancel: '×', select: '⌖' }[d.kind];
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
    $('modebar').hidden = !mode; $('mode-text').textContent = mode ? mode === 'wall' ? '放置主墙 · 自动对齐入口' : mode === 'blink' ? '选择闪烁落点' : '放置 ' + LEVELS[mode][0].name : '';
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
    terrainCtx.drawImage(background, 0, 0, MAP.w, MAP.h);
    // 场景道路与寻路区域共用 ROAD，岩壁包住单一宽度的入口。
    terrainCtx.lineCap = 'round';
    for (const [lineWidth, color] of [[88, '#39494dc9'], [76, '#8b9fa8'], [65, '#c3d1d5'], [48, '#b5c5cb']]) {
      terrainCtx.lineWidth = lineWidth; terrainCtx.strokeStyle = color; terrainCtx.beginPath(); terrainCtx.moveTo(ROAD[0].x, ROAD[0].y); terrainCtx.lineTo(ROAD[1].x, ROAD[1].y); terrainCtx.stroke();
    }
    for (let i = 0; i < 900; i++) {
      const x = 485 + ((i * 37.73) % 675), y = 403 + ((i * 23.17) % 58);
      terrainCtx.fillStyle = i % 3 ? '#dce5e54d' : '#6c849333'; terrainCtx.fillRect(x, y, 2 + i % 3, 1);
    }
    for (const side of [-1, 1]) for (let i = 0; i < 13; i++) {
      const x = 545 + (i % 4) * 23, y = GATE.y + side * (57 + Math.floor(i / 4) * 24);
      rock(terrainCtx, x, y, 22 + i % 3 * 3);
    }
  }
  function rock(c, x, y, r) {
    c.fillStyle = '#142c3e66'; c.beginPath(); c.ellipse(x + 8, y + 8, r * 1.3, r * .65, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#4e6476'; c.beginPath(); c.moveTo(x-r,y+5); c.lineTo(x-r*.7,y-r); c.lineTo(x+r*.25,y-r*1.3); c.lineTo(x+r,y-r*.25); c.lineTo(x+r*.7,y+r*.6); c.lineTo(x-r*.7,y+r*.55); c.closePath(); c.fill();
    c.fillStyle = '#afc5d2'; c.beginPath(); c.moveTo(x-r*.7,y-r); c.lineTo(x+r*.25,y-r*1.3); c.lineTo(x+r,y-r*.25); c.lineTo(x+r*.3,y-r*.1); c.lineTo(x-r*.5,y-r*.3); c.closePath(); c.fill();
    c.strokeStyle = '#e0e8e7'; c.lineWidth = 3; c.beginPath(); c.moveTo(x-r*.7,y-r); c.lineTo(x+r*.25,y-r*1.3); c.lineTo(x+r*.7,y-r*.65); c.stroke();
  }
  function ring(x, y, radius, color, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 2 / zoom;
    ctx.beginPath(); ctx.ellipse(x, y, radius, radius * .5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  function imageSprite(kind, x, y, w, h) {
    const [col, row] = cell[kind]; ctx.drawImage(atlas, col * 512, row * 512, 512, 512, x-w/2, y-h*.87, w, h);
  }
  function wallSprite(b, alpha = 1) {
    const h = 43 + b.level * 8, x = b.x, y = b.y, half = 39;
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.fillStyle = '#253b4b'; ctx.beginPath(); ctx.moveTo(x+22,y-half-h); ctx.lineTo(x+22,y+half-h); ctx.lineTo(x+22,y+half); ctx.lineTo(x+22,y-half); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#647888'; ctx.beginPath(); ctx.moveTo(x-22,y+half-h); ctx.lineTo(x+22,y+half-h); ctx.lineTo(x+22,y+half); ctx.lineTo(x-22,y+half); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#314652'; ctx.lineWidth = 2;
    for (let i=1;i<5;i++) { ctx.beginPath(); ctx.moveTo(x-22,y+half-h+i*h/5); ctx.lineTo(x+22,y+half-h+i*h/5); ctx.stroke(); }
    ctx.fillStyle = '#bccbd0'; ctx.beginPath(); ctx.moveTo(x-22,y-half-h);ctx.lineTo(x+22,y-half-h);ctx.lineTo(x+22,y+half-h);ctx.lineTo(x-22,y+half-h);ctx.closePath();ctx.fill();
    for (let i=0;i<5;i++) {
      const by=y-half+i*18;ctx.fillStyle='#526d7d';ctx.fillRect(x+12,by-h-9,14,14);ctx.fillStyle='#e0e9e6';ctx.fillRect(x+10,by-h-12,17,5);
    }
    ctx.fillStyle = '#275c73';ctx.fillRect(x-5,y+half-h+5,14,26);ctx.strokeStyle='#d0b774';ctx.strokeRect(x-5,y+half-h+5,14,26);
    if (b.hp < info(b).hp * .5) {ctx.strokeStyle='#27333d';ctx.beginPath();ctx.moveTo(x+5,y+half-h+9);ctx.lineTo(x+2,y+half-13);ctx.lineTo(x+11,y+half-4);ctx.stroke();}
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
      if(b.level>0)ctx.filter='brightness('+(1+b.level*.08)+')'; imageSprite(b.type,b.x,b.y,w*(1+b.level*.04),h*(1+b.level*.04));ctx.filter='none';
    }
    ctx.restore();
    if(!ghost){
      if(selectedHere)ring(b.x,b.y,w*.46,'#efd17e');
      if(b.progress<1||b.upgrade) bar(b.x,b.y-h*.82-9, b.upgrade?b.upgrade.progress:b.progress,1,64,'#d6b769');
      else if(selectedHere||b.hp<info(b).hp)bar(b.x,b.y-h*.82-9,b.hp,info(b).hp,60);
      if(b.type==='tower'&&b.progress===1){const g=ctx.createRadialGradient(b.x,b.y-66,0,b.x,b.y-66,19);g.addColorStop(0,'#79eaff99');g.addColorStop(1,'#79eaff00');ctx.fillStyle=g;ctx.fillRect(b.x-20,b.y-86,40,40);}
    }
  }
  function bar(x,y,value,max,w,color){ctx.fillStyle='#0c1727d9';ctx.fillRect(x-w/2-2,y-2,w+4,8);ctx.fillStyle=color||(value/max<.35?'#d66351':'#74c564');ctx.fillRect(x-w/2,y,clamp(value/max,0,1)*w,4);}
  function drawActor(u) {
    const troll=u.id==='troll', working=['build','repair','upgrade'].includes(u.action), attacking=u.action==='attack'&&u.stage==='attack';
    let row=troll?(attacking?3:2):(working?1:0), col=u.moving?Math.floor(u.anim*9)%4:working?Math.floor(u.anim*6)%4:attacking?(Math.floor((1.2-u.hit)/1.2*4)+2)%4:0;
    const w=troll?109:78,h=troll?114:82;
    ctx.fillStyle='#12202a55';ctx.beginPath();ctx.ellipse(u.x+2,u.y+2,troll?28:15,troll?11:7,0,0,7);ctx.fill();
    if(selected===u)ring(u.x,u.y,troll?32:23,troll?'#db7c61':'#7adfbe');
    ctx.save();ctx.translate(u.x,u.y);const flip=troll?(u.facing>0?-1:1):(u.facing<0?-1:1);ctx.scale(flip,1);
    const bob=u.moving?Math.sin(u.anim*17)*1.2:Math.sin(game.time*2.5)*.4;
    if(u.hp<=0){ctx.rotate(-.8);ctx.globalAlpha=.6;}
    ctx.drawImage(actors,col*actors.width/4,row*actors.height/4,actors.width/4,actors.height/4,-w/2,-h*.92+bob,w,h);ctx.restore();
    if(troll||selected===u)bar(u.x,u.y-h*.85-8,u.hp,u.maxHp,troll?59:41);
  }
  function effect(e) {
    const a=e.age/e.life;ctx.save();ctx.globalAlpha=1-a;
    if(e.kind==='foot'){ctx.fillStyle='#5c768633';ctx.beginPath();ctx.ellipse(e.x+(e.side?4:-4),e.y,2.5,5,.6,0,7);ctx.fill();}
    else if(['command','blink','complete'].includes(e.kind)){ring(e.x,e.y,12+a*(e.kind==='blink'?60:35),e.kind==='blink'?'#82dfff':'#e5cb87',1-a);}
    else if(e.kind==='damage'){ctx.font='bold 15px system-ui';ctx.textAlign='center';ctx.fillStyle='#edb094';ctx.strokeStyle='#1e1d25';ctx.lineWidth=3;ctx.strokeText(e.text,e.x,e.y-a*23);ctx.fillText(e.text,e.x,e.y-a*23);}
    else {for(let i=0;i<8;i++){const angle=i*.79, radius=a*30;ctx.fillStyle=e.kind==='repair'?'#a4e3bc':e.kind==='ice'?'#99eaff':e.kind==='debris'?'#8d9fa8':'#e6c987';ctx.fillRect(e.x+Math.cos(angle)*radius,e.y+Math.sin(angle)*radius*.6-a*12,2+(!i?2:0),2);}}
    ctx.restore();
  }
  function render(now) {
    ctx.clearRect(0,0,view.w,view.h);ctx.save();ctx.scale(zoom,zoom);ctx.translate(-camera.x,-camera.y);ctx.drawImage(terrain,0,0);
    // 营地范围之外保持场景纹理，真正行走范围由同一碰撞模型决定。
    if(!game.buildings.some(b=>b.type==='wall'&&b.hp>0)){
      ctx.save();ctx.strokeStyle='#e2c47c';ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.strokeRect(GATE.x-GATE.halfW,GATE.y-GATE.halfH,GATE.halfW*2,GATE.halfH*2);ctx.restore();
      ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillStyle='#182633bb';ctx.fillRect(GATE.x-67,GATE.y+56,134,24);ctx.fillStyle='#ead4a3';ctx.fillText('唯一窄口 · 在此封墙',GATE.x,GATE.y+72);
    }
    if(selected?.type==='tower'&&selected.hp>0){ctx.save();ctx.strokeStyle='#8edfe966';ctx.setLineDash([8,7]);ctx.beginPath();ctx.arc(selected.x,selected.y,270,0,7);ctx.stroke();ctx.restore();}
    if(selected===game.player&&game.player.path.length){ctx.save();ctx.strokeStyle='#95d8c280';ctx.setLineDash([3,7]);ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(game.player.x,game.player.y);for(const p of game.player.path)ctx.lineTo(p.x,p.y);ctx.stroke();ctx.restore();}
    game.effects.filter(e=>e.kind==='foot').forEach(effect);
    const objects=[...game.buildings.filter(b=>b.hp>0),game.player,...(game.test?[game.test]:[])].sort((a,b)=>a.y-b.y);
    for(const o of objects)if(o.type)drawBuilding(o);else drawActor(o);
    for(const p of game.projectiles)if(game.test){const t=clamp(p.age/.38,0,1),x=p.fromX+(game.test.x-p.fromX)*t,y=p.fromY+(game.test.y-40-p.fromY)*t-Math.sin(t*Math.PI)*25;ctx.strokeStyle='#a5eaff88';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-9,y+3);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle='#bff4ff';ctx.shadowColor='#6ccfff';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(x,y,3.5,0,7);ctx.fill();ctx.shadowBlur=0;}
    game.effects.filter(e=>e.kind!=='foot').forEach(effect);
    if(mode in LEVELS&&hover){const p=placement(game,mode,hover),b={...p,type:mode,level:0,progress:1,started:true,hp:LEVELS[mode][0].hp};drawBuilding(b,true);ctx.save();ctx.strokeStyle=p.error?'#e49380':'#80ddc1';ctx.lineWidth=2;ctx.setLineDash([5,4]);if(mode==='wall')ctx.strokeRect(p.x-GATE.halfW,p.y-GATE.halfH,GATE.halfW*2,GATE.halfH*2);else{const r=footprint(mode)+6;ctx.strokeRect(p.x-r,p.y-r,r*2,r*2);}ctx.restore();}
    if(mode==='blink'){ring(game.player.x,game.player.y,250,'#90d7ed',.4);if(hover)ring(hover.x,hover.y,18,'#91deef');}
    ctx.restore();
    const vignette=ctx.createRadialGradient(view.w*.48,view.h*.45,view.h*.28,view.w*.5,view.h*.5,view.w*.7);vignette.addColorStop(0,'#00121b00');vignette.addColorStop(1,'#04131a90');ctx.fillStyle=vignette;ctx.fillRect(0,0,view.w,view.h);
    for(let i=0;i<45;i++){const x=(i*83.37+now*.006*(1+i%3))%view.w,y=(i*49.93+now*.014*(1+i%2))%view.h;ctx.fillStyle='#ebf5f5'+(i%3?'55':'99');ctx.fillRect(x,y,i%3?1:2,2);}
    miniCtx.drawImage(terrain,0,0,mini.width,mini.height);miniCtx.fillStyle='#0a1c2840';miniCtx.fillRect(0,0,mini.width,mini.height);
    for(const o of [...game.buildings.filter(b=>b.hp>0),game.player,...(game.test?[game.test]:[])]){miniCtx.fillStyle=o.id==='troll'?'#ed9471':o.type==='wall'?'#f1cf80':'#85e0c4';miniCtx.fillRect(o.x/MAP.w*mini.width-2,o.y/MAP.h*mini.height-2,4,4);}
    miniCtx.strokeStyle='#e8d29a';miniCtx.strokeRect(camera.x/MAP.w*mini.width,camera.y/MAP.h*mini.height,view.w/zoom/MAP.w*mini.width,view.h/zoom/MAP.h*mini.height);
  }
  function frame(now) {
    const elapsed=last?Math.min((now-last)/1000,.1):0;last=now;
    if(started&&!paused){let left=elapsed;while(left>0){const step=Math.min(left,.05);advance(game,step);left-=step;}}
    while(game.events.length)tell(game.events.shift());
    if(performance.now()>toastTime)$('notice').classList.remove('show');
    for(const e of game.effects)if(!e.sounded&&['spark','impact','complete'].includes(e.kind)){tone(e.kind);e.sounded=true;}
    render(now);if(now-hudTime>120){hud();hudTime=now;}requestAnimationFrame(frame);
  }
  Promise.all([background.decode(),atlas.decode(),actors.decode()]).then(()=>{loaded=true;makeTerrain();$('start').disabled=false;$('start').textContent='进入营地';hud();requestAnimationFrame(frame);}).catch(error=>{$('load-status').textContent='资源加载失败，请刷新：'+error.message;});
}
