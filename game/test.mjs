import assert from 'node:assert/strict';
import {createGame as newGame,build,repair,upgrade,advance,findPath,free,movePlayer,stopPlayer,startAssault,stopAssault,placement,blink,GATE,info,LEVELS,SLOTS,upgradeOptions,towerAddonOptions,attachTowerAddon,trade,castSkill,buyItem,trollStats,trollSpell,trollVisible,damageAfterArmor,requirement,hasUnit} from './game.mjs';
import {INDEX} from './classic-data.mjs';
const createGame=(practice=false)=>newGame(practice,{auto:false});
const run=(s,seconds)=>{for(let i=0;i<Math.ceil(seconds/.05);i++)advance(s,.05);};
const completed=(s,type,level=0,slot=0)=>{const d=LEVELS[type][level],b={id:s.nextId++,type,level,...SLOTS[type][slot],hp:d.hp,progress:1,started:true,fire:0,pulse:0,workClock:0,upgrade:null};s.buildings.push(b);s.nav++;return b;};
const s=createGame();assert.equal(s.gold,30);assert.equal(s.wood,0);assert.equal(s.test,null);
assert(findPath(s,{x:900,y:432},{x:410,y:432}));
assert.equal(build(s,'wall',GATE.x,GATE.y),'');let wall=s.buildings[0];
assert(!wall.started);run(s,.2);assert(wall.progress<1);run(s,10);assert.equal(wall.progress,1);
assert.equal(info(wall).hp,50);assert.equal(findPath(s,{x:900,y:432},{x:410,y:432}),null);assert(!free(s,GATE.x,GATE.y));
assert(placement(s,'wall',GATE).error.includes('一堵'));assert(movePlayer(s,{x:900,y:432}).includes('封住'));
assert.equal(upgrade(s,wall),'');run(s,1);assert.equal(findPath(s,{x:900,y:432},{x:410,y:432}),null);
run(s,3);assert.equal(wall.level,1);assert.equal(info(wall).hp,70);
movePlayer(s,{x:250,y:375});run(s,3);wall.hp=10;s.gold=0;const wood=s.wood;
assert.equal(repair(s,wall),'');run(s,.1);assert.equal(wall.hp,10,'不能远程回血');run(s,3);assert(wall.hp>10);assert.equal(s.gold,0);assert.equal(s.wood,wood,'修理不扣金木');
stopPlayer(s);const hp=wall.hp;run(s,.5);assert.equal(wall.hp,hp);
s.gold=100;wall.level=5;wall.hp=info(wall).hp;startAssault(s);run(s,6);
assert(s.test.x>GATE.x+GATE.halfW);assert(wall.hp<info(wall).hp);assert(s.trollWallet.gold>50,'攻墙伤害转金币');
wall.hp=1;run(s,5);assert.equal(wall.hp,0);assert(s.test.x<GATE.x,'破墙恢复通路');
const breached=createGame(true);breached.player.hp=1;startAssault(breached);run(breached,30);assert.equal(breached.result,'巨魔获胜','破门后巨魔追击精灵并结束游戏');
stopAssault(s);s.result='';s.player.hp=1;assert.equal(build(s,'wall',GATE.x,GATE.y),'');run(s,10);assert.equal(findPath(s,{x:900,y:432},{x:410,y:432}),null);
assert.equal(blink(s,{x:720,y:432}),'');assert.equal(blink(s,{x:500,y:430}),'闪烁冷却中');
const economy=createGame();economy.gold=5000;economy.wood=200;const house=completed(economy,'house');assert(requirement(economy,LEVELS.house[1]).includes('岩墙'));
const practiceUpgrade=createGame(true),practiceHouse=completed(practiceUpgrade,'house');practiceUpgrade.gold=practiceUpgrade.wood=0;
assert.equal(build(practiceUpgrade,'tower',SLOTS.tower[0].x,SLOTS.tower[0].y,'h001'),'','界面指定基础塔 rawcode 时应正常建造');
assert.equal(upgrade(practiceUpgrade,practiceHouse),'','练习局升级免金木和建筑前置');assert.equal(practiceUpgrade.gold,0);assert.equal(practiceUpgrade.wood,0);run(practiceUpgrade,3);assert.equal(practiceHouse.level,1);
assert.equal(build(practiceUpgrade,'lab',SLOTS.lab[0].x,SLOTS.lab[0].y),'','练习局建造免金木和科技前置');assert.equal(build(practiceUpgrade,'mine',SLOTS.mine[0].x,SLOTS.mine[0].y),'','练习局建矿无需采金者');
const queued=createGame(true);assert.equal(build(queued,'wall',GATE.x,GATE.y),'');assert.equal(build(queued,'tower',SLOTS.tower[0].x,SLOTS.tower[0].y),'');
assert.equal(queued.player.orders.length,1,'后续建造应排队');run(queued,20);assert(queued.buildings.every(b=>b.progress===1),'精灵应依次完成墙和塔');
const orders=createGame(true);build(orders,'wall',GATE.x,GATE.y);const orderedWall=orders.buildings[0];
repair(orders,orderedWall);assert.equal(orders.player.orders.length,0,'重复施工指令不能把当前建筑再次排队');
build(orders,'tower',SLOTS.tower[0].x,SLOTS.tower[0].y);stopPlayer(orders);run(orders,2);assert(orders.buildings.every(b=>b.progress===0),'停止应同时取消当前施工和后续队列');
repair(orders,orderedWall);run(orders,10);repair(orders,orders.buildings[1]);repair(orders,orderedWall);assert.equal(orders.player.order.kind,'repair','紧急修墙应立即替换施工指令');
assert.equal(movePlayer(orders,{x:350,y:375}),'');assert.equal(orders.player.order,null);assert.equal(orders.player.orders.length,0,'移动取消修墙和队列');
const standard=createGame();standard.gold=100;const standardHouse=completed(standard,'house');assert(upgrade(standard,standardHouse).includes('需要：岩墙'),'标准局保留升级前置');standard.gold=0;assert.equal(build(standard,'tower',SLOTS.tower[0].x,SLOTS.tower[0].y),'资源不足','标准局建造仍需金币');
completed(economy,'wall',5);completed(economy,'tech',2);completed(economy,'grove');completed(economy,'guild');
const tree=economy.buildings.find(b=>b.type==='grove'),treeWood=economy.wood;run(economy,3);assert(Math.abs(economy.wood-treeWood-1)<1e-6,'远古之树基础产木为1/3秒');
assert.deepEqual(upgradeOptions(tree).map(d=>d.id),['wood-e000'],'采木只有单一连续升级路径');const oldTreeGold=economy.gold;assert.equal(upgrade(economy,tree,'wood-e000'),'');assert.equal(economy.gold,oldTreeGold-512,'采木建筑升级按等级收金币');run(economy,3);assert.equal(info(tree).name,'基础伐木场');assert(Math.abs(economy.woodRate-(1/3+.125))<1e-10,'升级后同一建筑产木提升至0.458/秒');
const beforeTrade={g:economy.gold,w:economy.wood};assert.equal(trade(economy,'buy',10),'');assert.equal(economy.wood,beforeTrade.w+10);assert.equal(economy.gold,beforeTrade.g-155);assert.equal(economy.market.buy,160);
assert.equal(trade(economy,'sell',10),'');assert.equal(economy.gold,beforeTrade.g-5);assert.equal(economy.market.buy,155);
const tradeBalance=[economy.gold,economy.wood];assert.equal(trade(economy,'invalid',10),'交易方向无效');assert.deepEqual([economy.gold,economy.wood],tradeBalance,'非法交易不能改变资源');
const mineWood=economy.wood;assert.equal(build(economy,'mine',SLOTS.mine[0].x,SLOTS.mine[0].y),'');assert.equal(economy.wood,mineWood-32,'直接建矿只扣建筑木材');run(economy,10);assert(economy.income===2,'帐篷1 + 史前矿1');economy.wood=256;assert.equal(upgrade(economy,economy.buildings.find(b=>b.type==='mine')),'');assert.equal(economy.wood,0,'旧金矿升级扣256木');run(economy,3);assert.equal(economy.income,9,'升级旧金矿后产金由1增至8，加帐篷共9金/秒');
const choices=createGame(true);const tower=completed(choices,'tower');assert.deepEqual(upgradeOptions(tower).map(o=>o.id),['h002']);assert(upgrade(choices,tower,'h00E').includes('没有该升级选择'));
assert.equal(upgrade(choices,tower,'h002'),'');run(choices,3);assert.equal(info(tower).id,'h002');
for(let level=1;level<12;level++){tower.level=level;assert.deepEqual(upgradeOptions(tower).map(o=>o.id),[LEVELS.tower[level+1].id]);}
assert(!towerAddonOptions(choices,{...tower,level:0}).some(d=>d.id==='xczc'),'攻击附塔不能从基础塔跳级');
tower.level=5;assert(towerAddonOptions(choices,tower).some(d=>d.id==='xczc'));assert(!towerAddonOptions(choices,tower).some(d=>d.id==='jhfj'));
choices.gold=choices.wood=0;assert.equal(attachTowerAddon(choices,tower,'xczc'),'');assert.equal(choices.gold,0);assert.equal(tower.addon.id,'xczc');assert.equal(upgrade(choices,tower,'h007'),'');run(choices,3);assert.equal(tower.level,6,'装附塔后主塔仍可逐阶升级');
const addonCombat=createGame(true),addonTower=completed(addonCombat,'tower',5,1);assert.equal(attachTowerAddon(addonCombat,addonTower,'xczc'),'');addonTower.fire=999;startAssault(addonCombat);run(addonCombat,6);assert(addonCombat.test.hp<addonCombat.test.maxHp,'攻击附塔实际造成伤害');
for(let slot=0;slot<SLOTS.tower.length;slot++){const rangeGame=createGame(true);completed(rangeGame,'wall',17);completed(rangeGame,'tower',0,slot);startAssault(rangeGame);run(rangeGame,7);assert(rangeGame.test.hp<rangeGame.test.maxHp,'每个固定塔位的基础塔都应覆盖墙外攻墙点');}
const paidAddon=createGame(),paidTower=completed(paidAddon,'tower',5);assert(towerAddonOptions(paidAddon,paidTower).some(d=>d.id==='xczc'));assert(!towerAddonOptions(paidAddon,paidTower).some(d=>d.id==='dfsf'),'标准局治疗附塔仍需恶魔墙');assert(attachTowerAddon(paidAddon,paidTower,'xczc').includes('资源不足'));paidAddon.gold=500;assert.equal(attachTowerAddon(paidAddon,paidTower,'xczc'),'');assert.equal(paidAddon.gold,0,'标准局附塔扣款');
const sight=createGame(true),sightTower=completed(sight,'tower',0,1);assert.equal(attachTowerAddon(sight,sightTower,'n001'),'');startAssault(sight);sight.test.invisible=20;run(sight,6);assert(sight.test.hp<sight.test.maxHp,'真视附塔使隐身巨魔受到塔攻击');
const healing=createGame(true),healingWall=completed(healing,'wall',5),healingTower=completed(healing,'tower',0,1);healingWall.hp=100;assert.equal(attachTowerAddon(healing,healingTower,'dfsf'),'');run(healing,.1);assert(healingWall.hp>100,'治疗附塔实际修复建筑');
const life=createGame(true);life.gold=life.wood=0;assert.equal(build(life,'tower',SLOTS.tower[0].x,SLOTS.tower[0].y,' ngn'),'');run(life,10);assert.equal(life.buildings[0].level,14,'生死塔作为原图独立塔型建造');
const skills=createGame(true);const shieldWall=completed(skills,'wall',5);skills.player.x=520;skills.player.y=432;startAssault(skills);run(skills,5);
assert.equal(castSkill(skills,'shield'),'');const protectedHp=shieldWall.hp,gain=skills.trollWallet.gold;run(skills,2);assert.equal(shieldWall.hp,protectedHp);assert.equal(skills.trollWallet.gold,gain,'无伤害不得金币');
assert(castSkill(skills,'shield').includes('冷却'));assert.equal(castSkill(skills,'root'),'');const rootX=skills.test.x;run(skills,1);assert.equal(skills.test.x,rootX);
assert.equal(castSkill(skills,'silence'),'');assert(trollSpell(skills,'invisible').includes('沉默'));
const shop=createGame(true);assert.equal(buyItem(shop,'I004'),'');assert.equal(trollStats(shop).attack,11);assert.equal(buyItem(shop,'I00G'),'');assert.equal(trollStats(shop).armor,1);assert(damageAfterArmor(100,10)<100);
startAssault(shop);run(shop,4);assert(buyItem(shop,'I005').includes('出生点'));
const stealth=newGame();const stealthWall=completed(stealth,'wall',5),stealthTower=completed(stealth,'tower',3,1);
run(stealth,30.1);stealth.test.x=716;stealth.test.y=432;stealth.test.path=[];stealth.test.stage='attack';stealth.test.hit=100;
const hiddenHp=stealth.test.hp;assert.equal(trollVisible(stealth),false,'隐身巨魔不应在无真视时可见');
run(stealth,1);assert.equal(stealth.test.hp,hiddenHp,'塔不能攻击未被发现的隐身巨魔');
assert(castSkill(stealth,'root').includes('隐身'),'精灵不能精准对隐身目标施法');
assert.equal(castSkill(stealth,'ward'),'');assert(trollVisible(stealth),'侦察守卫揭示隐身巨魔');
run(stealth,1);assert(stealth.test.hp<hiddenHp,'揭示后防塔可以攻击隐身巨魔');
const combat=createGame(true);completed(combat,'wall',17);const frost=completed(combat,'tower',10,1);startAssault(combat);combat.test.hp=combat.test.maxHp=1e8;run(combat,5);assert(combat.test.statuses.frost>0,'冰塔实际减速');
frost.level=11;run(combat,2);assert(combat.test.statuses.poison>0,'毒塔真实上毒');
const damaged=combat.buildings[0];damaged.hp-=1000;frost.level=13;frost.fire=0;const damagedHp=damaged.hp;run(combat,.1);assert(damaged.hp>damagedHp,'治疗塔实际恢复建筑');
for(const type of ['house','wall','tower'])for(const d of LEVELS[type]){assert(d.gold>=0&&d.wood>=0);for(const next of d.next)assert(INDEX[next],d.id+'升级目标缺失');}
assert.equal(LEVELS.house.length,10);assert.equal(LEVELS.wall.length,18);assert.equal(LEVELS.tower.length,21);
const empty=newGame();run(empty,29);assert.equal(empty.test,null);run(empty,1.1);assert(empty.test,'30秒自动入场');run(empty,30);assert.equal(empty.result,'巨魔获胜');
const growth=newGame();completed(growth,'wall',17);run(growth,121);assert.equal(growth.encounter.tier,1);assert(growth.test.maxHp>=625);assert(growth.test.attack>=11);assert(growth.encounter.raids>=2,'巨魔回店后再进攻');
assert(growth.test.x>GATE.x,'强化过程中依然不能穿墙');

// 从 30 金、0 木开始，只用正常建造/升级/免费修理命令跑完整战局。
const match=newGame();let decisionAt=0;
const building=t=>match.buildings.find(b=>b.type===t&&b.hp>0);
for(let tick=0;tick<900*20&&!match.result;tick++){
  advance(match,.05);if(match.time-decisionAt<1)continue;decisionAt=match.time;
  const house=building('house'),wall=building('wall'),tower=building('tower'),tech=building('tech'),grove=building('grove');
  const erect=t=>{const d=LEVELS[t][0],p=SLOTS[t][0];if(match.gold>=d.gold&&match.wood>=d.wood&&!requirement(match,d))build(match,t,p.x,p.y);};
  if(!house){if(!match.player.order)erect('house');continue;}
  if(!wall){if(!match.player.order)erect('wall');continue;}
  if(wall.progress<1)continue;
  if(!tower){if(!match.player.order)erect('tower');continue;}
  if(tower.progress<1)continue;
  const unfinished=match.buildings.find(v=>v.type==='tower'&&v.hp>0&&v.progress<1);
  if(unfinished&&wall.hp>info(wall).hp*.8&&(!match.player.order||match.player.order.kind==='repair')){repair(match,unfinished);continue;}
  if(match.time>28&&!match.player.order)repair(match,wall);
  for(const t of ['wall','house','tech']){const b=building(t);if(!b||b.progress<1||b.upgrade)continue;const d=upgradeOptions(b)[0];if(d&&match.gold>=d.gold&&match.wood>=d.wood&&!requirement(match,d))upgrade(match,b,d.id);}
  for(const b of match.buildings.filter(v=>v.type==='tower'&&v.hp>0&&v.progress===1&&!v.upgrade)){const d=upgradeOptions(b)[0];if(d&&match.gold>=d.gold&&match.wood>=d.wood&&!requirement(match,d))upgrade(match,b,d.id);}
  if(!tech&&match.gold>=64&&wall.hp>info(wall).hp*.7){erect('tech');continue;}
  const towers=match.buildings.filter(v=>v.type==='tower'&&v.hp>0);
  if(towers.length<3&&match.gold>200&&wall.hp>info(wall).hp*.85){const p=SLOTS.tower[towers.length];build(match,'tower',p.x,p.y);continue;}
  if(!grove&&match.gold>=256&&tech){erect('grove');continue;}
}
assert.equal(match.result,'精灵获胜','标准资源开局能靠正常经济与墙塔完成胜局');
assert(match.time>=600&&match.time<=900,'防守策略应在10至15分钟获胜');
assert(match.encounter.tier>=5&&match.encounter.raids>5,'战局经历多轮强化与回店再攻');

console.log('通过：标准资源开局可在 '+Math.round(match.time/60)+' 分钟内赢得完整单机局；自动入场/周期强化/回店再攻/单机败局；实体墙/重建/升级阻挡、免费近身修理、科技前置、固定槽、主塔逐阶升级/攻击治疗真视附塔/独立生死塔、采木/金矿/动态交易、技能魔法/冷却/护盾/缠绕/沉默、独立商店/装备/护甲、冰毒/治疗实效。');
