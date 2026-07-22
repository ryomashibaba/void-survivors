"use strict";

/*
 * 中盤以降の「敵は即死・敵弾だけ大量・回復過多」をまとめて調整する。
 * 既存セーブ、権能、ボスは変更せず、通常敵と戦闘資源だけを上書きする。
 */
(() => {
  if (typeof window === "undefined" || typeof Game === "undefined" ||
      typeof Player === "undefined" || typeof Enemy === "undefined" ||
      typeof EnemyProjectile === "undefined" || typeof Treasure === "undefined" ||
      typeof ExpGem === "undefined") return;

  const VERSION = 1;
  const GAME_VERSION = "2026.07.22.3";
  const PROJECTILE_CAP = 140;
  const THREAT_BUDGET = 8;
  const BOSS_THREAT_BUDGET = 5;
  const TAU = Math.PI * 2;

  const ROLE = {
    normal:    {hp:.95, adapt:.28, area:1,    hitCap:1,   threat:0},
    fast:      {hp:1.25,adapt:.48, area:.88,  hitCap:.72, threat:1},
    heavy:     {hp:3.55,adapt:.92, area:.50,  hitCap:.38, threat:2},
    ranged:    {hp:2.45,adapt:.78, area:.62,  hitCap:.48, threat:2},
    splitter:  {hp:1.90,adapt:.62, area:.76,  hitCap:.58, threat:2},
    splitmini: {hp:.72, adapt:.20, area:1,    hitCap:1,   threat:0},
    elite:     {hp:4.80,adapt:1.05,area:.42,  hitCap:.26, threat:4}
  };
  const PRECISION = new Set(["world_cutter","hunter_verdict","mirror_legion","storm_throne"]);
  const POWER_IDS = new Set(Object.keys(window.__abyssSystems?.POWER_CATALOG || {}));
  const SYNERGY_IDS = new Set(Object.keys(window.__abyssSystems?.SYNERGIES || {}));
  const HOOK_NAMES=["beforeUpdate","afterUpdate","damageEnemy","damageBoss","onStart","onEnemyDeath"];
  const voidHooks=window.__voidHooks&&typeof window.__voidHooks==="object"?window.__voidHooks:{};
  for(const name of HOOK_NAMES)if(!Array.isArray(voidHooks[name]))voidHooks[name]=[];
  voidHooks.register=function(name,handler){if(!HOOK_NAMES.includes(name)||typeof handler!=="function")throw new Error(`Unknown VOID hook: ${name}`);this[name].push(handler);return handler;};
  window.__voidHooks=voidHooks;

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rand=(a,b)=>a+Math.random()*(b-a);
  const dist2=(ax,ay,bx,by)=>{const x=ax-bx,y=ay-by;return x*x+y*y;};
  const angle=(ax,ay,bx,by)=>Math.atan2(by-ay,bx-ax);
  const roleOf=e=>ROLE[e?.type]||ROLE.normal;
  const systemSource=s=>POWER_IDS.has(s)||SYNERGY_IDS.has(s)||s==="overdrive"||s==="深淵オーバードライブ";
  const runHooks=(name,payload)=>{for(const handler of voidHooks[name])handler(payload);};
  const runDamageHooks=(name,payload)=>{for(const handler of voidHooks[name]){const next=handler(payload);if(Number.isFinite(next))payload.damage=next;}return payload.damage;};

  const ENCOUNTER_PACKS={
    1:[{id:"pincer",types:["fast","fast"]},{id:"bulwark",types:["heavy"]},{id:"artillery",types:["ranged","normal","normal"]}],
    2:[{id:"pincer",types:["fast","fast"]},{id:"bulwark",types:["heavy","normal"]},{id:"artillery",types:["ranged","normal","normal"]},{id:"minefield",types:["splitter","normal","normal"]},{id:"elite_hunt",types:["elite","normal","normal"]}],
    3:[{id:"bulwark",types:["heavy","heavy"]},{id:"artillery",types:["ranged","ranged","normal"]},{id:"minefield",types:["splitter","splitter","normal"]},{id:"elite_hunt",types:["elite","fast","normal"]}],
    4:[{id:"pincer",types:["fast","fast","fast"]},{id:"artillery",types:["ranged","ranged","heavy"]},{id:"minefield",types:["splitter","splitter","fast"]},{id:"elite_hunt",types:["elite","ranged","normal"]}]
  };

  function encounterState(game){return game._encounterDirector||(game._encounterDirector={nextPack:30,lastPack:"",lowWave:0});}
  function fillEncounter(types,count,stage,state){
    while(types.length<count){const fast=stage>0&&state.lowWave++%Math.max(2,5-stage)===0;types.push(fast?"fast":"normal");}
    return types.slice(0,count);
  }
  function selectEnemyWaveTypes(game,count){
    const time=Math.max(0,game?.elapsed||0),state=encounterState(game),stage=time<90?0:time<180?1:time<300?2:time<420?3:4;
    if(time<30)return Array(count).fill("normal");
    if(time<60){if(time>=state.nextPack){state.nextPack=time+20;return fillEncounter(["fast"],count,stage,state);}return Array(count).fill("normal");}
    if(time<90){if(time>=state.nextPack){state.nextPack=time+20;return fillEncounter(["heavy"],count,stage,state);}return Array(count).fill("normal");}
    if(time<state.nextPack)return fillEncounter([],count,stage,state);
    state.nextPack=time+12;
    const available=(ENCOUNTER_PACKS[stage]||ENCOUNTER_PACKS[4]).filter(pack=>pack.id!==state.lastPack);
    const pack=available[Math.floor(Math.random()*available.length)]||ENCOUNTER_PACKS[stage][0];state.lastPack=pack.id;
    return fillEncounter(pack.types.slice(),count,stage,state);
  }
  window.__selectEnemyWaveTypes=selectEnemyWaveTypes;

  function targetLevelScale(level){
    const n=Math.max(0,Math.floor(Number(level)||1)-1);
    return Math.min(1.75,1+Math.min(20,n)*.025+Math.max(0,n-20)*.008);
  }
  function levelCorrection(level){
    return targetLevelScale(level)/(1+Math.max(0,(Number(level)||1)-1)*.055);
  }

  function initEnemy(enemy,game){
    if(enemy._combatRoleReady)return enemy._combatAI;
    const role=roleOf(enemy);
    const time=clamp(((game?.elapsed||0)-120)/360,0,1);
    const level=clamp(((game?.player?.level||1)-18)*.018,0,.48);
    const adaptive=1+time*role.adapt+level*(role.threat?1:.35);
    enemy.maxHp=Math.max(1,Math.round(enemy.maxHp*role.hp*adaptive));
    enemy.hp=enemy.maxHp;
    enemy._combatRoleReady=true;
    enemy._combatThreat=role.threat;
    enemy._combatSpawnGuard=role.threat?.55:0;
    enemy._combatDamageWindow=0;
    enemy._combatDamageTaken=0;
    return enemy._combatAI={cd:rand(.9,2.3),windup:0,attack:"",cost:0,dash:0,
      dx:1,dy:0,tx:enemy.x,ty:enemy.y,pattern:0};
  }

  class WarningEffect{
    constructor(x,y,opt={}){Object.assign(this,{x,y,kind:opt.kind||"ring",angle:opt.angle||0,
      radius:opt.radius||120,length:opt.length||520,width:opt.width||32,color:opt.color||"#ff5268",
      life:opt.life||.7,maxLife:opt.life||.7,dead:false,critical:true});
      if(this.kind==="line")this.radius=this.length;
    }
    update(dt){if((this.life-=dt)<=0)this.dead=true;}
    draw(ctx,cam){
      const p=1-clamp(this.life/this.maxLife,0,1),a=.62+Math.sin(p*Math.PI*12)*.18;
      ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.rotate(this.angle);
      ctx.globalCompositeOperation="source-over";ctx.globalAlpha=clamp(a,.28,.9);
      ctx.strokeStyle=this.color;ctx.fillStyle="rgba(255,82,104,.14)";ctx.lineWidth=5;
      ctx.setLineDash([16,11]);ctx.lineDashOffset=-performance.now()*.08;
      if(this.kind==="line"){ctx.fillRect(0,-this.width/2,this.length,this.width);ctx.strokeRect(0,-this.width/2,this.length,this.width);}
      else{ctx.beginPath();ctx.arc(0,0,this.radius,0,TAU);ctx.fill();ctx.stroke();}
      ctx.setLineDash([]);ctx.restore();
    }
  }

  class PulseEffect{
    constructor(x,y,radius,color="#ff5268",life=.42){Object.assign(this,{x,y,radius,color,life,maxLife:life,dead:false,critical:false});}
    update(dt){if((this.life-=dt)<=0)this.dead=true;}
    draw(ctx,cam){
      const a=clamp(this.life/this.maxLife,0,1),p=1-a;
      ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.globalAlpha=a;
      ctx.strokeStyle=this.color;ctx.lineWidth=7-p*4;ctx.beginPath();ctx.arc(0,0,this.radius*(.2+p*.8),0,TAU);ctx.stroke();ctx.restore();
    }
  }

  function addEffect(game,effect){game?.addEffect?.(effect);}
  function activeThreat(game){
    let shots=0,total=0;
    for(const p of game.enemyProjectiles||[])if(!p.dead)shots++;
    total=Math.min(5,shots*.12);
    for(const e of game.enemies||[])if(!e.dead&&e._combatAI?.windup>0)total+=e._combatAI.cost||1;
    return total;
  }
  function canAttack(game,cost){
    const budget=game.boss&&!game.boss.dead?BOSS_THREAT_BUDGET:THREAT_BUDGET;
    return activeThreat(game)+cost<=budget;
  }
  function shot(game,source,a,speed,damage,radius,cost=.25,persist=false){
    if(!game?.enemyProjectiles||game.enemyProjectiles.length>=PROJECTILE_CAP)return false;
    const p=new EnemyProjectile(source.x,source.y,Math.cos(a)*speed,Math.sin(a)*speed,
      Math.max(1,Math.round(damage)),radius,source.color||"#ff5268");
    p._combatSourceUid=source.uid;p._combatThreatCost=cost;
    p._combatPersistAfterDeath=persist||source.type==="elite";
    game.enemyProjectiles.push(p);return true;
  }

  class MineEffect{
    constructor(game,source,x,y,damage){Object.assign(this,{game,sourceUid:source.uid,x,y,damage,
      color:source.color||"#b45cff",radius:42,life:1.05,maxLife:1.05,dead:false,critical:true});}
    update(dt){
      this.life-=dt;
      if(!this.game.enemies.some(e=>e.uid===this.sourceUid&&!e.dead)){this.dead=true;return;}
      if(this.life<=0&&!this.dead){
        this.dead=true;
        const source={uid:this.sourceUid,type:"splitter",x:this.x,y:this.y,color:this.color};
        for(let i=0;i<6;i++)shot(this.game,source,i/6*TAU,250,this.damage,7,.25,false);
        addEffect(this.game,new PulseEffect(this.x,this.y,110,this.color,.48));
      }
    }
    draw(ctx,cam){
      const p=1-clamp(this.life/this.maxLife,0,1),a=.7+Math.sin(p*Math.PI*18)*.24;
      ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.rotate(p*6);ctx.globalAlpha=clamp(a,.35,1);
      ctx.fillStyle="rgba(180,92,255,.12)";ctx.strokeStyle=p>.55?"#fff0a8":this.color;ctx.lineWidth=4;
      ctx.beginPath();ctx.arc(0,0,20+p*10,0,TAU);ctx.fill();ctx.stroke();ctx.restore();
    }
  }

  function moveEnemy(e,dt,obstacles,game,a,mul=1){
    let vx=Math.cos(a),vy=Math.sin(a),sx=0,sy=0,count=0;
    const visit=o=>{if(o===e||o.dead)return;const min=e.radius+o.radius+8,d=dist2(e.x,e.y,o.x,o.y);
      if(d>.01&&d<min*min){const n=Math.sqrt(d);sx+=(e.x-o.x)/n;sy+=(e.y-o.y)/n;count++;}};
    if(game._enemySpatial?.forEachNearby)game._enemySpatial.forEachNearby(e.x,e.y,e.radius*3+36,visit);
    else for(const o of game.enemies)visit(o);
    if(count){vx+=sx/count*.72;vy+=sy/count*.72;}
    for(const o of obstacles){const d=Math.hypot(e.x-o.x,e.y-o.y);if(d<o.radius+e.radius+34){const away=angle(o.x,o.y,e.x,e.y);vx+=Math.cos(away)*1.2;vy+=Math.sin(away)*1.2;}}
    const len=Math.hypot(vx,vy)||1;vx/=len;vy/=len;
    const nx=e.x+vx*e.speed*mul*dt,ny=e.y+vy*e.speed*mul*dt;
    if(!circleHitObstacle(nx,e.y,e.radius,obstacles))e.x=nx;
    if(!circleHitObstacle(e.x,ny,e.radius,obstacles))e.y=ny;
    e.x=clamp(e.x,e.radius,CONFIG.MAP_W-e.radius);e.y=clamp(e.y,e.radius,CONFIG.MAP_H-e.radius);e.facing=Math.atan2(vy,vx);
  }
  function contact(e,p,game,mul=1){
    if(e.contactCd>0||dist2(e.x,e.y,p.x,p.y)>=Math.pow(e.radius+p.radius,2))return;
    p.takeDamage(Math.max(1,Math.round(e.atk*mul)),game);e.contactCd=.72;
  }
  function begin(e,game,name,windup,cost,warning){
    const ai=e._combatAI;
    if(!canAttack(game,cost)){ai.cd=rand(.35,.7);return false;}
    ai.attack=name;ai.windup=windup;ai.cost=cost;addEffect(game,warning);return true;
  }
  function execute(e,p,game){
    const ai=e._combatAI,name=ai.attack;ai.attack="";ai.cost=0;
    if(name==="dash"){ai.dash=.42;ai.cd=rand(3.4,4.4);return;}
    if(name==="slam"){
      if(dist2(e.x,e.y,p.x,p.y)<=175*175)p.takeDamage(Math.round(e.atk*1.35),game);
      addEffect(game,new PulseEffect(e.x,e.y,175,e.color,.5));ai.cd=rand(4.6,5.8);return;
    }
    if(name==="fan"){
      const a=angle(e.x,e.y,p.x,p.y);for(const o of[-.22,0,.22])shot(game,e,a+o,305,e.atk*.92,8,.45);
      ai.cd=rand(2.9,3.7);return;
    }
    if(name==="mine"){addEffect(game,new MineEffect(game,e,ai.tx,ai.ty,Math.round(e.atk*.92)));ai.cd=rand(5.2,6.4);return;}
    if(name==="eliteRadial"){
      const off=e.animT*.45;for(let i=0;i<8;i++)shot(game,e,off+i/8*TAU,255,e.atk*.82,8,.55,true);
      ai.cd=rand(4,4.9);return;
    }
    if(name==="eliteFan"){
      const a=angle(e.x,e.y,p.x,p.y);for(const o of[-.3,0,.3])shot(game,e,a+o,335,e.atk*1.02,9,.7,true);
      ai.cd=rand(3.7,4.6);return;
    }
    if(name==="eliteSlam"){
      if(dist2(ai.tx,ai.ty,p.x,p.y)<=210*210)p.takeDamage(Math.round(e.atk*1.5),game);
      addEffect(game,new PulseEffect(ai.tx,ai.ty,210,"#b45cff",.55));ai.cd=rand(4.2,5);}
  }

  const oldEnemyUpdate=Enemy.prototype.update;
  Enemy.prototype.update=function(dt,p,enemies,obstacles,game){
    if(!game||!p)return oldEnemyUpdate.call(this,dt,p,enemies,obstacles,game);
    const ai=initEnemy(this,game);
    this.animT+=dt;this.spawnAge+=dt;if(this.hitFlash>0)this.hitFlash-=dt;if(this.contactCd>0)this.contactCd-=dt;
    if(this._combatSpawnGuard>0)this._combatSpawnGuard-=dt;
    if(this._combatDamageWindow>0)this._combatDamageWindow-=dt;else this._combatDamageTaken=0;
    if(game._systemTimeStop>0)return;
    ai.cd-=dt;const d=Math.hypot(p.x-this.x,p.y-this.y),base=angle(this.x,this.y,p.x,p.y);
    if(ai.windup>0){ai.windup-=dt;if(ai.windup<=0)execute(this,p,game);contact(this,p,game);return;}
    if(ai.dash>0){
      ai.dash-=dt;const nx=this.x+ai.dx*this.speed*5.3*dt,ny=this.y+ai.dy*this.speed*5.3*dt;
      if(!circleHitObstacle(nx,ny,this.radius,obstacles)){this.x=clamp(nx,this.radius,CONFIG.MAP_W-this.radius);this.y=clamp(ny,this.radius,CONFIG.MAP_H-this.radius);}
      this.facing=Math.atan2(ai.dy,ai.dx);contact(this,p,game,1.38);return;
    }
    let a=base,mul=1;
    if(this.type==="normal")a+=Math.sin(this.animT*2.1+this.seed)*.2;
    else if(this.type==="fast"){
      a+=Math.sin(this.animT*5.2+this.seed)*.34;mul=1.08;
      if(ai.cd<=0&&d<760){const tx=p.x+(p.lastMove?.x||0)*.24,ty=p.y+(p.lastMove?.y||0)*.24,da=angle(this.x,this.y,tx,ty);ai.dx=Math.cos(da);ai.dy=Math.sin(da);
        begin(this,game,"dash",.62,1,new WarningEffect(this.x,this.y,{kind:"line",angle:da,length:540,width:38,color:this.color,life:.62}));}
    }else if(this.type==="heavy"){
      mul=.78;if(ai.cd<=0&&d<360)begin(this,game,"slam",.9,2,new WarningEffect(this.x,this.y,{radius:175,color:this.color,life:.9}));
    }else if(this.type==="ranged"){
      const desired=430;if(d<desired-55)a=base+Math.PI;else if(d<desired+55)a=base+Math.PI/2*(this.avoidAngleOffset>0?1:-1);mul=.88;
      if(ai.cd<=0&&d<860)begin(this,game,"fan",.58,2,new WarningEffect(this.x,this.y,{kind:"line",angle:base,length:700,width:30,color:this.color,life:.58}));
    }else if(this.type==="splitter"){
      a+=Math.sin(this.animT*1.5+this.seed)*.26;
      if(ai.cd<=0&&d<760){ai.tx=clamp(p.x+(p.lastMove?.x||0)*.22,80,CONFIG.MAP_W-80);ai.ty=clamp(p.y+(p.lastMove?.y||0)*.22,80,CONFIG.MAP_H-80);
        begin(this,game,"mine",.82,2,new WarningEffect(ai.tx,ai.ty,{radius:95,color:this.color,life:.82}));}
    }else if(this.type==="splitmini"){a+=Math.sin(this.animT*7+this.seed)*.66;mul=1.16;}
    else if(this.type==="elite"){
      a+=Math.sin(this.animT+this.seed)*.2;mul=.86;
      if(ai.cd<=0&&d<940){const pattern=ai.pattern++%3;
        if(pattern===0)begin(this,game,"eliteRadial",.82,4,new WarningEffect(this.x,this.y,{radius:220,color:"#b45cff",life:.82}));
        else if(pattern===1)begin(this,game,"eliteFan",.72,3,new WarningEffect(this.x,this.y,{kind:"line",angle:base,length:760,width:42,color:"#ffd447",life:.72}));
        else{ai.tx=clamp(p.x+(p.lastMove?.x||0)*.18,100,CONFIG.MAP_W-100);ai.ty=clamp(p.y+(p.lastMove?.y||0)*.18,100,CONFIG.MAP_H-100);
          begin(this,game,"eliteSlam",.92,4,new WarningEffect(ai.tx,ai.ty,{radius:210,color:"#b45cff",life:.92}));}}
    }
    if(ai.windup<=0)moveEnemy(this,dt,obstacles,game,a,mul);
    contact(this,p,game,this.type==="elite"?1.2:1);
  };

  const oldEnemyDraw=Enemy.prototype.draw;
  Enemy.prototype.draw=function(ctx,cam){
    oldEnemyDraw.call(this,ctx,cam);const role=roleOf(this);if(!this._combatRoleReady||!role.threat||this.dead)return;
    ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.globalAlpha=.72+Math.sin(this.animT*4+this.seed)*.14;
    ctx.strokeStyle=this.type==="elite"?"#ffd447":this.type==="ranged"?"#65d9ff":this.color;ctx.lineWidth=this.type==="elite"?4:3;
    ctx.setLineDash(this.type==="heavy"?[11,8]:[]);ctx.beginPath();ctx.arc(0,0,this.radius+9,-Math.PI*.85,Math.PI*.15);ctx.stroke();
    ctx.beginPath();ctx.arc(0,0,this.radius+9,Math.PI*.15,Math.PI*1.15);ctx.stroke();ctx.setLineDash([]);
    if(this._combatSpawnGuard>0){ctx.globalAlpha=clamp(this._combatSpawnGuard/.55,0,1)*.7;ctx.strokeStyle="#fff7dc";ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,this.radius+15,0,TAU);ctx.stroke();}
    ctx.restore();
  };

  const oldDamageEnemy=Game.prototype.damageEnemy;
  Game.prototype.damageEnemy=function(enemy,damage,crit){
    if(!enemy||enemy.dead)return;if(!enemy._combatRoleReady)initEnemy(enemy,this);
    const source=this._damageSource||"unknown",payload={game:this,enemy,damage:Math.max(0,Number(damage)||0),crit:!!crit,source};
    let value=Math.max(0,Number(runDamageHooks("damageEnemy",payload))||0);const role=roleOf(enemy);
    if(systemSource(source)){value*=levelCorrection(this.player?.level||1);if(!PRECISION.has(source))value*=role.area;}
    else if(source==="death_explosion")value*=role.area*.75;
    if(enemy._combatSpawnGuard>0&&role.threat)value*=PRECISION.has(source)?.58:.2;
    if(role.hitCap<1&&value>0){
      if(enemy._combatDamageWindow<=0){enemy._combatDamageWindow=.12;enemy._combatDamageTaken=0;}
      value=Math.min(value,Math.max(1,enemy.maxHp*role.hitCap-(enemy._combatDamageTaken||0)));
      enemy._combatDamageTaken=(enemy._combatDamageTaken||0)+value;
    }
    const hp=this.player?.hp??0,result=oldDamageEnemy.call(this,enemy,Math.max(1,Math.round(value)),crit);
    if(enemy.dead&&this.player&&this.player.hp>hp)this.player.hp=Math.min(this.player.hp,hp+Math.max(1,Math.round(this.player.maxHp*.02)));
    return result;
  };

  const oldDamageBoss=Game.prototype.damageBoss;
  Game.prototype.damageBoss=function(damage,crit){
    const source=this._damageSource||"unknown",payload={game:this,boss:this.boss,damage:Math.max(0,Number(damage)||0),crit:!!crit,source};
    let value=Math.max(0,Number(runDamageHooks("damageBoss",payload))||0);if(systemSource(source))value*=levelCorrection(this.player?.level||1);
    return oldDamageBoss.call(this,Math.max(1,Math.round(value)),crit);
  };

  const oldEnemyDeath=Enemy.prototype.onDeath;
  Enemy.prototype.onDeath=function(game){
    if(this._combatBalanceDeathHandled)return oldEnemyDeath.call(this,game);this._combatBalanceDeathHandled=true;const hookPayload={game,enemy:this,phase:"before"};runHooks("onEnemyDeath",hookPayload);
    const itemStart=game?.items?.length||0,result=oldEnemyDeath.call(this,game);
    let converted=0;for(const p of game?.enemyProjectiles||[]){
      if(p.dead||p._combatSourceUid!==this.uid||p._combatPersistAfterDeath)continue;p.dead=true;
      if(converted++<10)addEffect(game,new PulseEffect(p.x,p.y,22,p.color||this.color,.18));
    }
    if(game?.items?.length>itemStart){const keep=this.type==="elite"?.8:roleOf(this).threat?.45:.28;
      for(let i=game.items.length-1;i>=itemStart;i--){const penalty=game.items[i]?.type==="heal"?.55:1;if(Math.random()>keep*penalty)game.items.splice(i,1);}}
    hookPayload.result=result;hookPayload.phase="after";runHooks("onEnemyDeath",hookPayload);return result;
  };

  const oldTreasureUpdate=Treasure.prototype.update;
  Treasure.prototype.update=function(dt,p){const collected=this.collected,hp=p.hp,result=oldTreasureUpdate.call(this,dt,p);
    if(!collected&&this.collected&&p.hp>hp)p.hp=Math.min(p.hp,hp+Math.round(p.maxHp*.15));return result;};

  const oldApplyItem=Player.prototype.applyItem;
  Player.prototype.applyItem=function(type){const hp=this.hp,result=oldApplyItem.call(this,type);
    if(type==="heal"&&this.hp>hp)this.hp=Math.min(this.hp,hp+Math.round(this.maxHp*.22));return result;};

  const oldGemUpdate=ExpGem.prototype.update;
  ExpGem.prototype.update=function(dt,p){
    const dead=this.dead,hp=p.hp,rank=Math.max(0,Math.floor(p?.upgradeRanks?.abyss_banquet||0));
    const need=Math.max(1,Math.round(([32,23,16][clamp(rank-1,0,2)]||32)*(p?.powerEvolutions?.abyss_banquet?.72:1)));
    const suppress=rank>0&&(p._combatBanquetCooldown||0)>0,stored=p._banquetGems||0;
    if(suppress)p._banquetGems=-100000;const result=oldGemUpdate.call(this,dt,p);
    if(suppress){p._banquetGems=stored+(!dead&&this.dead?1:0);if(p._banquetGems>=need)p._banquetGems=need;}
    else if(p.hp>hp){p.hp=Math.min(p.hp,hp+Math.round(p.maxHp*.07));p._combatBanquetCooldown=2.5;}
    return result;
  };

  const oldStartGame=Game.prototype.startGame;
  Game.prototype.startGame=function(){const result=oldStartGame.apply(this,arguments);this._encounterDirector={nextPack:30,lastPack:"",lowWave:0};runHooks("onStart",{game:this,result});return result;};

  const oldGameUpdate=Game.prototype.update;
  Game.prototype.update=function(dt){
    const updatePayload={game:this,dt};runHooks("beforeUpdate",updatePayload);
    if(this.player){
      if(!this.player._combatRecoveryPrepared){this.player._combatRecoveryPrepared=true;this.player._combatOriginalInvDuration=this.player.invDuration;
        this.player.invDuration=.58+Math.max(0,this.player._combatOriginalInvDuration-.9)*.6;this.player.hpRegen*=.5;}
      if(this.player._combatBanquetCooldown>0)this.player._combatBanquetCooldown=Math.max(0,this.player._combatBanquetCooldown-Math.max(0,dt||0));
    }
    const result=oldGameUpdate.apply(this,arguments);
    if(this.player){if(this.player._feastShield>this.player.maxHp*.2)this.player._feastShield=this.player.maxHp*.2;this.player.hp=clamp(this.player.hp,0,this.player.maxHp);}
    if(this.enemyProjectiles?.length>PROJECTILE_CAP){let excess=this.enemyProjectiles.length-PROJECTILE_CAP;
      for(const p of this.enemyProjectiles){if(excess<=0)break;if(p.dead||p._combatPersistAfterDeath)continue;p.dead=true;excess--;}}
    updatePayload.result=result;runHooks("afterUpdate",updatePayload);return result;
  };

  const applyVersion=()=>{const el=document.getElementById("gameVersion");if(el)el.textContent=`VER. ${window.__VOID_SURVIVORS_VERSION||GAME_VERSION}`;};
  if(document.readyState==="loading")window.addEventListener("DOMContentLoaded",applyVersion,{once:true});else applyVersion();
  window.addEventListener("load",applyVersion,{once:true});
  if(typeof CONFIG.MAX_ENEMY_PROJECTILES==="number")CONFIG.MAX_ENEMY_PROJECTILES=Math.min(CONFIG.MAX_ENEMY_PROJECTILES,PROJECTILE_CAP);
  if(typeof CONFIG.EXPLOSION_DAMAGE_RATIO==="number")CONFIG.EXPLOSION_DAMAGE_RATIO=Math.min(CONFIG.EXPLOSION_DAMAGE_RATIO,.025);

  window.__combatBalance={version:VERSION,gameVersion:GAME_VERSION,projectileCap:PROJECTILE_CAP,threatBudget:THREAT_BUDGET,
    targetLevelScale,levelDamageCorrection:levelCorrection,validate(){const problems=[];
      if(PROJECTILE_CAP<80||PROJECTILE_CAP>180)problems.push("projectile cap outside intended range");
      if(targetLevelScale(1)!==1||targetLevelScale(60)>1.75)problems.push("invalid level scale");
      for(const [type,r] of Object.entries(ROLE))if(!(r.hp>0)||!(r.area>0&&r.area<=1))problems.push(`invalid role ${type}`);
      return{ok:!problems.length,problems};}};
})();
