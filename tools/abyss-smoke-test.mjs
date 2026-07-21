import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

class ClassList {
  constructor(element){ this.element=element; this.values=new Set(); }
  add(...names){ for(const name of names) if(name) this.values.add(name); this._sync(); }
  remove(...names){ for(const name of names) this.values.delete(name); this._sync(); }
  toggle(name,force){
    const enabled=force===undefined?!this.values.has(name):!!force;
    if(enabled)this.values.add(name);else this.values.delete(name);this._sync();return enabled;
  }
  contains(name){ return this.values.has(name); }
  setFromString(value){ this.values=new Set(String(value||'').split(/\s+/).filter(Boolean)); }
  _sync(){ this.element._className=[...this.values].join(' '); }
}

class FakeElement {
  constructor(tag='div',document=null){
    this.tagName=String(tag).toUpperCase();this.ownerDocument=document;this.children=[];this.parentNode=null;
    this._id='';this._className='';this.classList=new ClassList(this);this.style={setProperty(){}};
    this.dataset={};this.listeners={};this.attributes={};this.textContent='';this._innerHTML='';this.value='';this.checked=false;
    this.disabled=false;this.tabIndex=0;this.scrollTop=0;this.type='';
  }
  set id(value){this._id=String(value||'');if(this.ownerDocument&&this._id)this.ownerDocument.registry.set(this._id,this);} get id(){return this._id;}
  set className(value){this._className=String(value||'');this.classList.setFromString(this._className);} get className(){return this._className;}
  set innerHTML(value){this._innerHTML=String(value??'');if(value==='')this.children=[];} get innerHTML(){return this._innerHTML;}
  get options(){return this.children.filter(child=>child.tagName==='OPTION');}
  appendChild(child){if(!child)return child;child.parentNode=this;this.children.push(child);return child;}
  insertAdjacentElement(_position,child){return this.parentNode?this.parentNode.appendChild(child):this.appendChild(child);}
  insertBefore(child,reference){child.parentNode=this;const index=this.children.indexOf(reference);if(index<0)this.children.push(child);else this.children.splice(index,0,child);return child;}
  replaceChildren(...children){this.children=[];for(const child of children)this.appendChild(child);}
  setAttribute(name,value){this.attributes[name]=String(value);if(name==='id')this.id=value;if(name==='class')this.className=value;}
  addEventListener(type,handler){(this.listeners[type]??=[]).push(handler);}
  dispatchEvent(event){event.target??=this;for(const handler of this.listeners[event.type]||[])handler.call(this,event);return true;}
  click(){if(this.disabled)return;this.dispatchEvent({type:'click',target:this,stopPropagation(){},preventDefault(){}});}
  remove(){if(!this.parentNode)return;const index=this.parentNode.children.indexOf(this);if(index>=0)this.parentNode.children.splice(index,1);this.parentNode=null;}
  insertAdjacentHTML(_position,html){this._innerHTML+=String(html);if(String(html).includes('run-analysis')){const section=new FakeElement('section',this.ownerDocument);section.className='run-analysis';this.parentNode?.appendChild(section);}}
  scrollTo(){}
  matches(selector){
    if(!selector)return false;
    if(selector.startsWith('#'))return this.id===selector.slice(1);
    if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));
    const [tag,klass]=selector.split('.');return this.tagName===tag.toUpperCase()&&(!klass||this.classList.contains(klass));
  }
  descendants(){const result=[];for(const child of this.children){result.push(child,...child.descendants());}return result;}
  querySelector(selector){return queryFrom(this,selector,false)[0]||null;}
  querySelectorAll(selector){return queryFrom(this,selector,true);}
}

function queryFrom(root,selector,all){
  const selectors=String(selector).split(',').map(value=>value.trim()).filter(Boolean);const results=[];
  for(const individual of selectors){
    const parts=individual.split(/\s+/);let current=[root];
    for(const part of parts){const next=[];for(const node of current){for(const candidate of node.descendants())if(candidate.matches(part))next.push(candidate);}current=[...new Set(next)];}
    for(const item of current)if(!results.includes(item))results.push(item);
  }
  return all?results:results.slice(0,1);
}

class FakeDocument {
  constructor(){this.registry=new Map();this.body=new FakeElement('body',this);this.listeners={};}
  createElement(tag){return new FakeElement(tag,this);}
  createTextNode(text){const node=new FakeElement('#text',this);node.textContent=String(text);return node;}
  getElementById(id){return this.registry.get(id)||null;}
  querySelector(selector){if(selector==='body')return this.body;return this.body.querySelector(selector);}
  querySelectorAll(selector){return this.body.querySelectorAll(selector);}
  addEventListener(type,handler){(this.listeners[type]??=[]).push(handler);}
  dispatchEvent(event){for(const handler of this.listeners[event.type]||[])handler(event);}
}

const document=new FakeDocument();
function add(id,{tag='div',className='',parent=document.body}={}){const el=document.createElement(tag);el.id=id;el.className=className;parent.appendChild(el);return el;}
const title=add('titleScreen');const titleBlock=add('',{className:'title-block',parent:title});add('',{className:'title-note',parent:titleBlock});add('',{className:'meta-progress-card',parent:titleBlock});add('',{className:'title-actions',parent:titleBlock});add('skillTreeBtn',{parent:titleBlock});add('titleSettingsBtn',{parent:titleBlock});
const hud=add('hud');for(const id of ['stageRuleIcon','stageRuleName','stageRuleText','buildSlotText','buildCoreText','buildSynergyText'])add(id,{parent:hud});
const pause=add('pauseScreen');const pausePanel=add('',{className:'title-block',parent:pause});add('pauseSettingsBtn',{parent:pausePanel});add('quitBtn',{parent:pausePanel});
const skill=add('skillTreeScreen');add('',{tag:'h2',parent:skill});add('',{className:'skill-tree-kicker',parent:skill});const skillHeader=add('',{className:'skill-tree-header',parent:skill});add('',{tag:'p',parent:skillHeader});
const level=add('levelUpScreen');add('',{className:'upgrade-title',parent:level});add('upgradeChoices',{parent:level});
for(const [id,stats,weapons] of [['gameOverScreen','overStats','overWeapons'],['clearScreen','clearStats','clearWeapons']]){const screen=add(id);const panel=add('',{className:'title-block',parent:screen});add(stats,{parent:panel});add(weapons,{className:'result-weapons',parent:panel});}
add('weaponBar');add('upgradeToast');add('volSlider',{tag:'input'}).value='60';add('resultSkillBtn1');add('resultSkillBtn2');
// Pre-existing injected UI prevents the integration script from needing an HTML parser.
add('abyssSettingsScreen');add('abyssRewardScreen');add('rewardChoices');add('rewardTitle');add('rewardKicker');add('rewardDescription');
add('abyssLayerValue');add('abyssLayerSummary');add('challengeSelect',{tag:'select'});add('challengeSummary');add('abyssLayerUp',{tag:'button'});add('abyssLayerDown',{tag:'button'});
for(const id of ['masterVolumeSetting','musicVolumeSetting','sfxVolumeSetting','shakeSetting','effectsSetting','damageTextSetting','flashSetting','contrastSetting','motionSetting','projectileSetting','masterVolumeOut','musicVolumeOut','sfxVolumeOut','shakeOut','settingsCloseBtn'])add(id);

const localStore=new Map();
const localStorage={getItem:key=>localStore.has(key)?localStore.get(key):null,setItem:(key,value)=>localStore.set(key,String(value)),removeItem:key=>localStore.delete(key)};
const windowListeners={};
const windowObject={document,localStorage,__game:null,addEventListener(type,handler){(windowListeners[type]??=[]).push(handler);},dispatchEvent(event){for(const handler of windowListeners[event.type]||[])handler(event);},setTimeout,clearTimeout};
windowObject.window=windowObject;

const CONFIG={MAX_ENEMY_PROJECTILES:260,MAX_EFFECTS:180,MAX_DAMAGE_TEXTS:120,MAX_PARTICLES:400,MAP_W:4200,MAP_H:4200,GAME_TIME:600,MAX_ENEMIES:160};
const U={rand:(a,b)=>a+Math.random()*(b-a),dist:(a,b,c,d)=>Math.hypot(a-c,b-d),dist2:(a,b,c,d)=>(a-c)**2+(b-d)**2,angle:(a,b,c,d)=>Math.atan2(d-b,c-a),clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),choice:a=>a[Math.floor(Math.random()*a.length)]};
function rgba(){return 'rgba(255,255,255,.5)';}function polygonPath(){}function circleHitObstacle(){return null;}function stageIndexForTime(t){return t<90?0:t<180?1:t<300?2:t<420?3:4;}function spawnParticles(){}
const SKILL_BRANCHES=[];const SKILL_NODES=[];const SKILL_LOOKUP={};
function getTimeScale(){return{hp:1,atk:1,speed:1,spawnCount:1,spawnInterval:1};}
function buildUpgradePool(){return [];}function pickUpgradeChoices(){return [];}function getUpgradePreview(){return{now:'',after:''};}function getCoreUpgradeData(){return{};}
class SoundManager{constructor(){this.volume=.6;this.ctx=null;}tone(){}noise(){}item(){}explosion(){}laser(){}lightning(){}levelUp(){}kill(){}damaged(){}gameOver(){}clear(){}ensure(){return false;}}
class ShockwaveEffect{constructor(){this.dead=false;this.x=0;this.y=0;this.radius=1;}update(){this.dead=true;}draw(){}}
class LightningEffect extends ShockwaveEffect{constructor(ax,ay,bx,by){super();this.x=(ax+bx)/2;this.y=(ay+by)/2;}}
class DamageText{constructor(x=0,y=0){this.x=x;this.y=y;this.dead=false;this.crit=false;}draw(){}update(){}}
class EnemyProjectile{constructor(x,y,vx,vy,damage,radius,color){Object.assign(this,{x,y,vx,vy,damage,radius,color,dead:false});}update(dt){this.x+=this.vx*dt;this.y+=this.vy*dt;}draw(){}}
class ExpGem{constructor(){this.dead=false;}update(){this.dead=true;}}
class Treasure{constructor(x,y){Object.assign(this,{x,y,dead:false,collected:false,bounceVel:0});}update(_dt,p){this.collected=true;this.dead=true;p.hp=Math.min(p.maxHp,p.hp+10);}}
class Player{
  constructor(){Object.assign(this,{x:2100,y:2100,hp:120,maxHp:120,atk:12,level:1,speed:250,damageReduction:0,expGainMul:1,reviveCharges:0,invTimer:0,invBuffTimer:0,animT:0,upgradeRanks:{},weapons:[],kills:0,score:0,lastMove:{x:0,y:0},damageAmp:1,pickupRange:90,critChance:.05,critMult:1.6,hpRegen:0,atkSpeedMul:1,bulletSpeedMul:1,bulletSizeMul:1,pierceBonus:0,multishot:0,shardGainMul:1,levelUpChoiceBonus:0});}
  get invincible(){return this.invTimer>0||this.invBuffTimer>0;} get effAtkMul(){return 1;} get effSpeed(){return this.speed;}
  takeDamage(amount,game){this.hp-=amount;if(this.hp<=0&&this.reviveCharges>0){this.reviveCharges--;this.hp=Math.round(this.maxHp*.35);}else if(this.hp<=0){this.hp=0;game?.onPlayerDeath?.();}}
  gainExp(){} draw(){}
}
let uid=1;
class Enemy{constructor(type='normal',x=0,y=0,scale={hp:1,atk:1,speed:1}){Object.assign(this,{uid:uid++,type,x,y,radius:15,maxHp:100*scale.hp,hp:100*scale.hp,atk:8*scale.atk,speed:80*scale.speed,color:'#f55',dead:false,contactCd:0,animT:0,spawnAge:0,hitFlash:0,seed:1,avoidAngleOffset:1});}update(){}draw(){}onDeath(game){if(this.dead)return;this.dead=true;game.player.kills++;}}
class Boss{constructor(index=0){Object.assign(this,{index,x:2300,y:2100,radius:46,maxHp:1000,hp:1000,atk:20,speed:70,dead:false,contactCd:0,animT:0,spawnAge:0,hitFlash:0,name:'boss'});}update(){}draw(){}onDeath(){this.dead=true;}}
class Game{
  constructor(){this.records={volume:60,shards:0,totalShards:0,skillTree:{core_awakening:1},challengeBest:{}};this.sound=new SoundManager();this.input={keys:new Set()};this.state='title';this.effects=[];this.enemies=[];this.enemyProjectiles=[];this.damageTexts=[];this.treasures=[];this.gems=[];this.projectiles=[];this.particles=[];this.explosions=[];this.obstacles=[];this.viewW=1280;this.viewH=720;this.elapsed=0;this.currentScale=getTimeScale(0);this.camera={x:0,y:0};this.bossKills=0;this.loadRecords();}
  loadRecords(){}saveRecords(){localStorage.setItem('void_survivors_records',JSON.stringify(this.records));}getSkillRank(id){return this.records.skillTree[id]||0;}addEffect(effect){this.effects.push(effect);}shake(){}triggerHitFlash(){}
  damageEnemy(enemy,damage){if(enemy.dead)return;enemy.hp-=damage;if(enemy.hp<=0)enemy.onDeath(this);}damageBoss(damage){if(!this.boss||this.boss.dead)return;this.boss.hp-=damage;if(this.boss.hp<=0){const boss=this.boss;boss.onDeath(this);this.boss=null;}}
  startGame(){this.player=new Player();this.enemies=[];this.enemyProjectiles=[];this.effects=[];this.treasures=[];this.gems=[];this.damageTexts=[];this.projectiles=[];this.particles=[];this.explosions=[];this.obstacles=[];this.pendingLevelUps=0;this.state='playing';this.elapsed=0;this.currentScale=getTimeScale(0);}
  update(dt){this.elapsed+=dt;this.currentScale=getTimeScale(this.elapsed);for(const enemy of this.enemies)enemy.update(dt,this.player,this.enemies,this.obstacles,this);if(this.boss)this.boss.update(dt,this.player,this.enemies,this.obstacles,this);for(const effect of this.effects)effect.update?.(dt);this.effects=this.effects.filter(effect=>!effect.dead);}
  closeLevelUp(){document.getElementById('levelUpScreen').classList.add('hidden');this.pendingLevelUps=Math.max(0,(this.pendingLevelUps||0)-1);if(this.pendingLevelUps>0)this.openLevelUp();else this.state='playing';}
  showSystemToast(){}updateWeaponBarDOM(){}updateHUD(){}calculateShardReward(){return 10;}onClear(){this.state='clear';this.showResult(true);}onPlayerDeath(){this.state='gameover';this.showResult(false);}
  showResult(clear){document.getElementById(clear?'clearScreen':'gameOverScreen').classList.remove('hidden');}toTitle(){this.state='title';}spawnExpGem(){this.gems.push(new ExpGem());}
  drawGroundCached(){}
}

const context={console,window:windowObject,document,localStorage,CONFIG,U,rgba,polygonPath,circleHitObstacle,stageIndexForTime,spawnParticles,SKILL_BRANCHES,SKILL_NODES,SKILL_LOOKUP,getTimeScale,buildUpgradePool,pickUpgradeChoices,getUpgradePreview,getCoreUpgradeData,SoundManager,ShockwaveEffect,LightningEffect,DamageText,EnemyProjectile,ExpGem,Treasure,Player,Enemy,Boss,Game,performance:{now:()=>Date.now()},Math,Date,Set,Map,Object,Array,Number,String,Boolean,JSON,setTimeout,clearTimeout};
context.globalThis=context;windowObject.performance=context.performance;
vm.createContext(context);
const source=fs.readFileSync(new URL('../assets/js/abyss-systems.js',import.meta.url),'utf8');
vm.runInContext(source,context,{filename:'abyss-systems.js'});

const validation=context.window.__abyssSystems.validate();
assert.equal(validation.ok,true,validation.problems.join('\n'));
assert.equal(validation.powerCount,20);assert.equal(validation.synergyCount,10);
assert.ok(context.SKILL_NODES.length>=30,'new skill tree not installed');

const game=new context.Game();context.window.__game=game;
for(const handler of windowListeners.DOMContentLoaded||[])handler({type:'DOMContentLoaded'});
// Settings opened from the title must not make the renderer enter a gameplay-only state.
document.getElementById('titleSettingsBtn').click();assert.equal(game.state,'title');assert.equal(game._settingsOpen,true);windowObject.dispatchEvent({type:'game-escape'});assert.equal(game._settingsOpen,false);assert.equal(game.state,'title');
game.startGame();
assert.equal(game.state,'levelup','origin draft should open immediately');
let cards=document.querySelectorAll('.abyss-power-card');assert.ok(cards.length>=3,'origin cards missing');cards[0].click();
assert.equal(game.state,'playing');assert.equal(Object.values(game.player.upgradeRanks).reduce((a,b)=>a+b,0),1);

// Force and validate evolution.
game.player.upgradeRanks.solar_funeral=3;game.player.evolutionCores=1;game.player._originDraft=false;
let pool=context.buildUpgradePool(game.player);const evolution=pool.find(item=>item.id==='evo:solar_funeral');assert.ok(evolution,'evolution choice missing');evolution.apply(game);assert.equal(game.player.powerEvolutions.solar_funeral,true);assert.equal(game.player.evolutionCores,0);

// Force and validate synergy.
game.player.upgradeRanks.meteor_scripture=2;pool=context.buildUpgradePool(game.player);const synergy=pool.find(item=>item.id==='syn:helios_scripture');assert.ok(synergy,'synergy choice missing');synergy.apply(game);assert.equal(game.player.powerSynergies.helios_scripture,true);

// Boss death must queue and open a unique reward, then return to play.
game.boss=new context.Boss(0);game.boss.onDeath(game);game.boss=null;game.state='playing';game.update(.016);
assert.equal(game.state,'reward','boss reward did not open');const rewardCards=document.querySelectorAll('.abyss-reward-card');assert.ok(rewardCards.length>=3,'boss reward cards missing');assert.ok(rewardCards[0].innerHTML.includes('蠕界心臓'),'boss signature relic missing');rewardCards[0].click();assert.equal(game.state,'playing');

// Damage tracking and result analytics.
const enemy=new context.Enemy('normal',2200,2100,{hp:1,atk:1,speed:1});game.enemies.push(enemy);game._damageSource='solar_funeral';game.damageEnemy(enemy,enemy.hp+1,false);assert.ok(game._runStats.damageBySource.solar_funeral>0,'damage not tracked');
game.showResult(false);assert.ok(document.querySelector('.run-analysis'),'result analytics missing');assert.ok(Array.isArray(game.records.runHistory)&&game.records.runHistory.length===1,'run history missing');

// Exercise all 20 powers, evolutions and 10 synergies through the public upgrade pool.
game.state='playing';game.player.powerSlotLimit=30;game.player._originDraft=false;
for(const id of Object.keys(context.window.__abyssSystems.POWER_CATALOG)){
  while((game.player.upgradeRanks[id]||0)<3){
    const item=context.buildUpgradePool(game.player).find(choice=>choice.id===id);assert.ok(item,`power choice missing: ${id}`);item.apply(game);
  }
}
game.player.evolutionCores=30;
for(const id of Object.keys(context.window.__abyssSystems.EVOLUTIONS)){
  const item=context.buildUpgradePool(game.player).find(choice=>choice.id===`evo:${id}`);
  if(!game.player.powerEvolutions[id]){assert.ok(item,`evolution missing: ${id}`);item.apply(game);}
}
for(const id of Object.keys(context.window.__abyssSystems.SYNERGIES)){
  const item=context.buildUpgradePool(game.player).find(choice=>choice.id===`syn:${id}`);
  if(!game.player.powerSynergies[id]){assert.ok(item,`synergy missing: ${id}`);item.apply(game);}
}
assert.equal(Object.keys(game.player.powerEvolutions).length,20);assert.equal(Object.keys(game.player.powerSynergies).length,10);

// Run the combined power engine long enough to execute delayed and continuous attacks.
game._powerTimers={};game._delayedSystemCasts=[];game.player.invBuffTimer=999;game.enemies=[];
for(let i=0;i<45;i++)game.enemies.push(new context.Enemy(i%6===0?'elite':'normal',1900+(i%9)*45,1850+Math.floor(i/9)*70,{hp:8,atk:1,speed:.2}));
for(let i=0;i<140;i++){game.state='playing';game.update(.1);}
assert.ok(Object.keys(game._runStats.damageBySource).length>=8,'combined power engine did not register enough sources');

// Every boss variant must enter its own pattern state without throwing.
game.player.upgradeRanks.time_execution=0;game.player.invBuffTimer=999;
const bossPatterns=[];
for(let index=0;index<4;index++){
  game.boss=new context.Boss(index);game.boss.maxHp=game.boss.hp=1e9;game._systemTimeStop=0;game._delayedSystemCasts=[];game.effects=[];game.enemyProjectiles=[];game.enemies=[];game.state='playing';
  for(let step=0;step<90;step++)game.update(.1);
  assert.ok(game.boss?._abyssBoss?.pattern>0,`boss ${index} did not execute a pattern`);bossPatterns.push(game.boss._abyssBoss.pattern);
}
game.boss=null;

// All five stage rules must initialize, and stage 3 must produce a nest.
const stageTexts=[];
for(const time of [10,100,200,350,500]){game.elapsed=time;game._systemStageIndex=-1;game._stageRuleTimer=0;game.effects=[];game.enemies=[];game.state='playing';game.update(.02);stageTexts.push(document.getElementById('stageRuleName').textContent);}
assert.equal(new Set(stageTexts).size,5,'stage rules are not distinct');

// A guaranteed treasure mutation must open and resolve the build-pivot screen.
game.state='playing';game.elapsed=120;game._pendingBossReward=null;game._pendingTreasureMutation=false;game._lastMutationTime=-999;game.player.treasureMutationChance=1;
const randomBefore=Math.random;Math.random=()=>0;
const treasure=new context.Treasure(game.player.x,game.player.y);treasure.game=game;treasure.update(.016,game.player);game.update(.016);Math.random=randomBefore;
assert.equal(game.state,'reward','treasure mutation did not open');const mutationCard=document.querySelector('.abyss-reward-card');assert.ok(mutationCard,'treasure mutation card missing');mutationCard.click();assert.equal(game.state,'playing');

// Save normalization should preserve the legacy key and system data.
game.saveRecords();const saved=JSON.parse(localStorage.getItem('void_survivors_records'));assert.equal(saved.systemVersion,3);assert.ok(saved.settings);assert.ok('skillTree' in saved);

console.log(JSON.stringify({ok:true,powers:validation.powerCount,synergies:validation.synergyCount,skillNodes:context.SKILL_NODES.length,rewardCards:rewardCards.length,damageSources:Object.keys(game._runStats.damageBySource).length,history:game.records.runHistory.length,bossPatterns,stageTexts,evolutions:Object.keys(game.player.powerEvolutions).length}));
