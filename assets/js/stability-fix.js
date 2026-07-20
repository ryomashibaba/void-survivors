"use strict";

(() => {
  const SAVE_KEY = "void_survivors_records";

  function nonNegativeNumber(value, fallback, integer){
    const parsed = Number(value);
    const safe = Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : fallback;

    return integer ? Math.floor(safe) : safe;
  }

  function sanitizeRecords(records){
    const safe = records && typeof records === "object" && !Array.isArray(records)
      ? records
      : {};

    safe.highScore = nonNegativeNumber(safe.highScore, 0, true);
    safe.bestTime = nonNegativeNumber(safe.bestTime, 0, false);
    safe.maxKills = nonNegativeNumber(safe.maxKills, 0, true);

    const volume = Number(safe.volume);
    safe.volume = U.clamp(Number.isFinite(volume) ? volume : 60, 0, 100);

    safe.shards = nonNegativeNumber(safe.shards, 0, true);
    safe.totalShards = Math.max(
      safe.shards,
      nonNegativeNumber(safe.totalShards, safe.shards, true)
    );

    safe.skillTree = normalizeSkillTree(safe.skillTree);
    return safe;
  }

  /*
   * Escapeやrole=buttonのキー長押しで、同じ操作が自動反復されるのを防ぐ。
   * 通常の単発入力はそのまま通す。
   */
  window.addEventListener("keydown", event => {
    if (!event.repeat) return;

    const target = event.target;
    const roleButton =
      (event.key === "Enter" || event.key === " ") &&
      target &&
      typeof target.closest === "function" &&
      target.closest('[role="button"]');

    if (event.key === "Escape" || roleButton){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  const previousLoadRecords = Game.prototype.loadRecords;
  Game.prototype.loadRecords = function(){
    previousLoadRecords.call(this);

    this.records = sanitizeRecords(this.records);

    const slider = document.getElementById("volSlider");
    if (slider) slider.value = String(this.records.volume);

    if (this.sound){
      this.sound.volume = this.records.volume / 100;
    }

    this.updateMetaUI();

    try{
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify(this.records)
      );
    }catch(e){}
  };

  const previousOpenLevelUp = Game.prototype.openLevelUp;
  Game.prototype.openLevelUp = function(){
    this._levelUpSelectionLocked = false;
    return previousOpenLevelUp.call(this);
  };

  const previousStartGame = Game.prototype.startGame;
  Game.prototype.startGame = function(){
    this._runFinalized = false;
    this._levelUpSelectionLocked = false;
    return previousStartGame.call(this);
  };

  const previousFinalizeRun = Game.prototype.finalizeRun;
  Game.prototype.finalizeRun = function(clear){
    if (this._runFinalized) return;
    this._runFinalized = true;
    return previousFinalizeRun.call(this, clear);
  };

  /*
   * クリック、Enter、Spaceが同一カードへ重複して届いても、
   * 1回のレベルアップにつき強化は1回だけ適用する。
   */
  document.addEventListener("click", event => {
    const target = event.target;
    const card =
      target &&
      typeof target.closest === "function"
        ? target.closest(".upgrade-card")
        : null;

    if (!card) return;

    const game = window.__game;
    if (
      !game ||
      game.state !== "levelup" ||
      game._levelUpSelectionLocked
    ){
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    game._levelUpSelectionLocked = true;
  }, true);
})();

/* ============================== ラン中スキル再設計 ============================== */
(() => {
  const PROTOCOL_LIMITS = {
    protocol_reactor: 4,
    protocol_fortress: 3,
    protocol_predator: 3,
    protocol_shell: 3
  };
  const SIGNATURE_LIMIT = 3;

  const signatureStats = {
    skill_nova(rank){
      return {
        interval: 10-rank*1.2,
        radius: 260+rank*70,
        damageMul: 1.6+rank*.55
      };
    },
    skill_rail(rank){
      return {
        interval: 12-rank*1.4,
        range: 1080,
        width: 50+rank*16,
        damageMul: 2.2+rank*.75
      };
    },
    skill_storm(rank){
      return {
        interval: 8.5-rank*.9,
        targets: 4+rank*3,
        damageMul: .9+rank*.35
      };
    },
    skill_cataclysm(rank){
      return {
        kills: [22,18,14][rank-1],
        radius: 430+rank*90,
        damageMul: 1.7+rank*.7
      };
    }
  };

  function rankOf(player,id){
    return player && player.upgradeRanks
      ? player.upgradeRanks[id] || 0
      : 0;
  }

  function fmt(value,digits=2){
    if (!Number.isFinite(value)) return "-";
    if (Math.abs(value-Math.round(value)) < .005) return String(Math.round(value));
    return value.toFixed(digits).replace(/0+$/,'').replace(/\.$/,'');
  }

  function addDamageText(game,x,y,damage,color){
    if (!game.damageTexts || game.damageTexts.length >= CONFIG.MAX_DAMAGE_TEXTS) return;
    game.damageTexts.push(new DamageText(x,y,String(Math.round(damage)),color || "#ffffff",false));
  }

  function leanHit(game,enemy,damage,showText){
    if (!enemy || enemy.dead || enemy._deathEffectQueued || enemy._deathEffectFinished) return false;
    enemy.hp -= damage;
    enemy.hitFlash = .14;
    if (showText) addDamageText(game,enemy.x,enemy.y-enemy.radius,damage,"#fff7dc");
    if (enemy.hp > 0) return false;
    enemy.onDeath(game);
    if (Math.random() < game.player.lifestealChance){
      game.player.hp = Math.min(
        game.player.maxHp,
        game.player.hp + Math.round(game.player.maxHp*.04)
      );
    }
    return true;
  }

  function leanBossHit(game,damage){
    const boss = game.boss;
    if (!boss || boss.dead) return;
    boss.hp -= damage;
    boss.hitFlash = .18;
    addDamageText(game,boss.x,boss.y-boss.radius-10,damage,"#ffd94e");
    if (boss.hp > 0) return;
    boss.onDeath(game);
    const bossBar = document.getElementById("bossBarWrap");
    if (bossBar) bossBar.classList.add("hidden");
    game.boss = null;
  }

  function segmentDistance(px,py,ax,ay,bx,by){
    const dx=bx-ax,dy=by-ay,len2=dx*dx+dy*dy;
    if (len2 <= .0001) return Math.hypot(px-ax,py-ay);
    const t=U.clamp(((px-ax)*dx+(py-ay)*dy)/len2,0,1);
    return Math.hypot(px-(ax+dx*t),py-(ay+dy*t));
  }

  class RailEffect{
    constructor(ax,ay,bx,by,width){
      this.ax=ax;this.ay=ay;this.bx=bx;this.by=by;
      this.x=(ax+bx)/2;this.y=(ay+by)/2;this.radius=Math.hypot(bx-ax,by-ay)/2;
      this.width=width;this.life=.28;this.maxLife=.28;this.dead=false;
    }
    update(dt){this.life-=dt;if(this.life<=0)this.dead=true;}
    draw(ctx,cam){
      const alpha=Math.max(0,this.life/this.maxLife);
      ctx.save();
      ctx.translate(-cam.x,-cam.y);
      ctx.lineCap="round";
      ctx.strokeStyle=`rgba(93,255,210,${alpha*.18})`;
      ctx.lineWidth=this.width*2.2;
      ctx.beginPath();ctx.moveTo(this.ax,this.ay);ctx.lineTo(this.bx,this.by);ctx.stroke();
      ctx.strokeStyle=`rgba(101,220,255,${alpha*.7})`;
      ctx.lineWidth=this.width;
      ctx.beginPath();ctx.moveTo(this.ax,this.ay);ctx.lineTo(this.bx,this.by);ctx.stroke();
      ctx.strokeStyle=`rgba(255,247,220,${alpha})`;
      ctx.lineWidth=Math.max(4,this.width*.2);
      ctx.beginPath();ctx.moveTo(this.ax,this.ay);ctx.lineTo(this.bx,this.by);ctx.stroke();
      ctx.restore();
    }
  }

  function fireNova(game,rank){
    const p=game.player,s=signatureStats.skill_nova(rank);
    const damage=Math.max(1,Math.round(p.atk*p.effAtkMul*p.damageAmp*s.damageMul));
    let shown=0;
    for (const enemy of game.enemies){
      if (!enemy.dead && U.dist2(p.x,p.y,enemy.x,enemy.y) <= Math.pow(s.radius+enemy.radius,2)){
        leanHit(game,enemy,damage,shown++<6);
      }
    }
    if (game.boss && !game.boss.dead && U.dist2(p.x,p.y,game.boss.x,game.boss.y) <= Math.pow(s.radius+game.boss.radius,2)){
      leanBossHit(game,damage);
    }
    game.addEffect(new ShockwaveEffect(p.x,p.y,"#5dffd2",s.radius,.55,{inner:28,fill:true}));
    game.shake(8,.22);
  }

  function fireRail(game,rank){
    const p=game.player,s=signatureStats.skill_rail(rank);
    const target=nearestEnemy(p.x,p.y,game.enemies,1200) || (game.boss&&!game.boss.dead?game.boss:null);
    if (!target) return;
    const angle=U.angle(p.x,p.y,target.x,target.y);
    const bx=p.x+Math.cos(angle)*s.range,by=p.y+Math.sin(angle)*s.range;
    const damage=Math.max(1,Math.round(p.atk*p.effAtkMul*p.damageAmp*s.damageMul));
    let shown=0;
    for (const enemy of game.enemies){
      if (!enemy.dead && segmentDistance(enemy.x,enemy.y,p.x,p.y,bx,by) <= enemy.radius+s.width){
        leanHit(game,enemy,damage,shown++<6);
      }
    }
    if (game.boss && !game.boss.dead && segmentDistance(game.boss.x,game.boss.y,p.x,p.y,bx,by) <= game.boss.radius+s.width){
      leanBossHit(game,damage);
    }
    game.addEffect(new RailEffect(p.x,p.y,bx,by,s.width));
    game.shake(10,.18);
    if (game.sound && game.sound.laser) game.sound.laser();
  }

  function fireStorm(game,rank){
    const p=game.player,s=signatureStats.skill_storm(rank);
    const candidates=[];
    for (const enemy of game.enemies){
      if (enemy.dead) continue;
      const d2=U.dist2(p.x,p.y,enemy.x,enemy.y);
      if (d2<900*900) candidates.push({enemy,d2});
    }
    candidates.sort((a,b)=>a.d2-b.d2);
    const damage=Math.max(1,Math.round(p.atk*p.effAtkMul*p.damageAmp*s.damageMul));
    const count=Math.min(s.targets,candidates.length);
    for (let i=0;i<count;i++){
      const enemy=candidates[i].enemy;
      game.addEffect(new LightningEffect(p.x,p.y,enemy.x,enemy.y,"#65dcff",.2,5+rank));
      leanHit(game,enemy,damage,i<5);
    }
    if (game.boss && !game.boss.dead && count<s.targets){
      game.addEffect(new LightningEffect(p.x,p.y,game.boss.x,game.boss.y,"#ffd94e",.22,7));
      leanBossHit(game,damage);
    }
    if (count>0 && game.sound && game.sound.lightning) game.sound.lightning();
  }

  function fireCataclysm(game,rank){
    const p=game.player,s=signatureStats.skill_cataclysm(rank);
    const damage=Math.max(1,Math.round(p.atk*p.effAtkMul*p.damageAmp*s.damageMul));
    game._cataclysmActive=true;
    try{
      let shown=0;
      for (const enemy of game.enemies){
        if (!enemy.dead && U.dist2(p.x,p.y,enemy.x,enemy.y) <= Math.pow(s.radius+enemy.radius,2)){
          leanHit(game,enemy,damage,shown++<8);
        }
      }
      if (game.boss && !game.boss.dead && U.dist2(p.x,p.y,game.boss.x,game.boss.y) <= Math.pow(s.radius+game.boss.radius,2)){
        leanBossHit(game,damage);
      }
    }finally{
      game._cataclysmActive=false;
    }
    game.addEffect(new ShockwaveEffect(p.x,p.y,"#ff617e",s.radius,.78,{inner:42,fill:true}));
    game.addEffect(new ShockwaveEffect(p.x,p.y,"#ffd94e",s.radius*.72,.58,{inner:20,fill:false}));
    game.shake(16,.42);
    if (game.sound && game.sound.explosion) game.sound.explosion();
  }

  function updateSignatureSkills(game,dt){
    const p=game.player;
    let rank=rankOf(p,"skill_nova");
    if (rank>0){
      p._novaTimer=(p._novaTimer||.25)-dt;
      if (p._novaTimer<=0){fireNova(game,rank);p._novaTimer+=signatureStats.skill_nova(rank).interval;}
    }
    rank=rankOf(p,"skill_rail");
    if (rank>0){
      p._railTimer=(p._railTimer||.5)-dt;
      if (p._railTimer<=0){fireRail(game,rank);p._railTimer+=signatureStats.skill_rail(rank).interval;}
    }
    rank=rankOf(p,"skill_storm");
    if (rank>0){
      p._stormTimer=(p._stormTimer||.75)-dt;
      if (p._stormTimer<=0){fireStorm(game,rank);p._stormTimer+=signatureStats.skill_storm(rank).interval;}
    }
  }

  function disableDeathChain(game){
    const queue=game && game._deathChainQueue;
    if (!Array.isArray(queue) || queue._skillOverhaulDisabled) return;
    queue.length=0;
    queue.push=function(){return this.length;};
    Object.defineProperty(queue,"_skillOverhaulDisabled",{value:true,configurable:true});
    game._deathChainHead=0;
  }

  const previousPreview=getUpgradePreview;
  const previousCoreData=getCoreUpgradeData;

  buildUpgradePool=function(player){
    const pool=[];
    const recent=window.__recentUpgrades||[];
    const add=(id,name,icon,desc,cond,apply,weight)=>{
      if (cond && !cond(player)) return;
      const finalWeight=recent.includes(id)?(weight||1)*.5:(weight||1);
      pool.push({
        id,name,icon,desc,weight:finalWeight,
        apply(p){
          apply(p);
          p.upgradeRanks=p.upgradeRanks||{};
          p.upgradeRanks[id]=(p.upgradeRanks[id]||0)+1;
        }
      });
    };
    const under=(id,max)=>rankOf(player,id)<max;

    add("protocol_reactor","暴走プリズム炉","◆","火力・連射・会心を同時に引き上げる攻撃プロトコル。",()=>under("protocol_reactor",PROTOCOL_LIMITS.protocol_reactor),p=>{
      p.damageAmp*=1.18;p.atkSpeedMul*=1.1;p.critChance=Math.min(.75,p.critChance+.04);p.critMult+=.18;
    },1.35);
    add("protocol_fortress","生体要塞化","▣","最大HP・軽減・再生をまとめて強化する防御プロトコル。",()=>under("protocol_fortress",PROTOCOL_LIMITS.protocol_fortress),p=>{
      const inc=Math.round(p.maxHp*.2);p.maxHp+=inc;p.hp+=inc;p.damageReduction=Math.min(.65,p.damageReduction+.05);p.hpRegen+=.35;
    },1.1);
    add("protocol_predator","捕食航行形態","◇","移動・回収・撃破回復を束ねた高速生存プロトコル。",()=>under("protocol_predator",PROTOCOL_LIMITS.protocol_predator),p=>{
      p.speed*=1.1;p.pickupRange*=1.24;p.lifestealChance=Math.min(.5,p.lifestealChance+.05);
    },1);
    add("protocol_shell","超質量弾殻","⬢","投射物の威力・大きさ・速度・貫通を一括強化する。",()=>under("protocol_shell",PROTOCOL_LIMITS.protocol_shell),p=>{
      p.projectileDamageMul*=1.18;p.bulletSizeMul*=1.15;p.bulletSpeedMul*=1.1;p.pierceBonus+=1;
    },1.15);

    add("skill_nova","ABYSS NOVA","◎","一定間隔で機体を中心に巨大衝撃波を放つ。弾を生成せず広範囲を一掃。",()=>under("skill_nova",SIGNATURE_LIMIT),p=>{p._novaTimer=.25;},1.15);
    add("skill_rail","PRISM RAIL","▰","最寄りの敵方向へ画面を横断する極太プリズム砲を発射。",()=>under("skill_rail",SIGNATURE_LIMIT),p=>{p._railTimer=.45;},1.05);
    add("skill_storm","STORM CROWN","⚡","周囲の複数目標へ同時落雷。残留弾を作らず瞬時に処理する。",()=>under("skill_storm",SIGNATURE_LIMIT),p=>{p._stormTimer=.65;},1.05);
    add("skill_cataclysm","CHROMA CATACLYSM","✹","一定数撃破するたび、周囲を色彩崩壊させる超広範囲爆発。",()=>under("skill_cataclysm",SIGNATURE_LIMIT),p=>{p._cataclysmCharge=0;},1.1);

    if (player.hp<player.maxHp*.45){
      add("emergency_repair","緊急再構築","✚","危険域のHPを最大HPの55%分だけ即時回復する。",null,p=>{p.hp=Math.min(p.maxHp,p.hp+Math.round(p.maxHp*.55));},2.2);
    }

    const weaponCard=(type,weight)=>{
      const w=player.getWeapon(type),def=WEAPON_DEFS[type];
      const canTake=!w || w.level<5 || w.tier<3;
      if (!canTake) return;
      const mode=!w?"解放":w.level<5?"強化":"進化";
      const desc=!w
        ? `${def.name}をLv.1で解放する。`
        : w.level<5
          ? `${def.name}をLv.${w.level+1}へ強化する。`
          : `${def.name}をTIER ${["Ⅱ","Ⅲ"][w.tier-1]}へ進化し、Lv.1から再構築する。`;
      add("w_"+type,`${def.name} ${mode}`,def.icon,desc,null,p=>{
        let weapon=p.getWeapon(type);
        if (!weapon){p.weapons.push(new Weapon(type));return;}
        if (weapon.level<5){weapon.level+=1;return;}
        weapon.evolve();
      },weight);
    };
    weaponCard("normal",1.2);
    weaponCard("pierce",1.18);
    weaponCard("blade",1.12);
    weaponCard("lightning",1.08);
    weaponCard("explosion",1.04);
    weaponCard("laser",1);

    const fusion=(a,b,name,icon)=>{
      add(`fus_${a}_${b}`,name,icon,"2兵装を同期し、両方の最終威力を×1.35する。",p=>{
        const wa=p.getWeapon(a),wb=p.getWeapon(b);
        return wa&&wb&&!wa.fusionPartner&&!wb.fusionPartner;
      },p=>{p.getWeapon(a).fusionPartner=b;p.getWeapon(b).fusionPartner=a;},.75);
    };
    fusion("normal","pierce","融合：PRISM LANCE","◆","◆");
    fusion("blade","lightning","融合：THUNDER HALO","✦⚡","✦⚡");

    return pool;
  };

  getUpgradePreview=function(id,p){
    const r=p.upgradeRanks||{},current=r[id]||0,next=current+1;
    const simple=(now,after)=>({now,after});
    if (id==="protocol_reactor") return simple(`Lv.${current} / 全ダメージ×${fmt(p.damageAmp)}・攻速×${fmt(p.atkSpeedMul)}`,`Lv.${next} / 全ダメージ×${fmt(p.damageAmp*1.18)}・攻速×${fmt(p.atkSpeedMul*1.1)}・会心+4%`);
    if (id==="protocol_fortress"){const inc=Math.round(p.maxHp*.2);return simple(`Lv.${current} / HP${p.maxHp}・軽減${Math.round(p.damageReduction*100)}%`,`Lv.${next} / HP${p.maxHp+inc}・軽減${Math.round(Math.min(.65,p.damageReduction+.05)*100)}%・再生+0.35/秒`);}
    if (id==="protocol_predator") return simple(`Lv.${current} / 移動${Math.round(p.speed)}・回収${Math.round(p.pickupRange)}`,`Lv.${next} / 移動${Math.round(p.speed*1.1)}・回収${Math.round(p.pickupRange*1.24)}・撃破回復+5%`);
    if (id==="protocol_shell") return simple(`Lv.${current} / 投射物×${fmt(p.projectileDamageMul)}・貫通+${p.pierceBonus}`,`Lv.${next} / 投射物×${fmt(p.projectileDamageMul*1.18)}・サイズ×${fmt(p.bulletSizeMul*1.15)}・貫通+${p.pierceBonus+1}`);
    if (signatureStats[id]){
      const before=current>0?signatureStats[id](current):null,after=signatureStats[id](next);
      if (id==="skill_nova") return simple(before?`Lv.${current} / ${fmt(before.interval)}秒・半径${before.radius}`:"未取得",`Lv.${next} / ${fmt(after.interval)}秒・半径${after.radius}・攻撃×${fmt(after.damageMul)}`);
      if (id==="skill_rail") return simple(before?`Lv.${current} / ${fmt(before.interval)}秒・幅${before.width}`:"未取得",`Lv.${next} / ${fmt(after.interval)}秒・幅${after.width}・攻撃×${fmt(after.damageMul)}`);
      if (id==="skill_storm") return simple(before?`Lv.${current} / ${before.targets}体・${fmt(before.interval)}秒`:"未取得",`Lv.${next} / ${after.targets}体・${fmt(after.interval)}秒・攻撃×${fmt(after.damageMul)}`);
      return simple(before?`Lv.${current} / ${before.kills}撃破・半径${before.radius}`:"未取得",`Lv.${next} / ${after.kills}撃破・半径${after.radius}・攻撃×${fmt(after.damageMul)}`);
    }
    if (id==="emergency_repair") return simple(`HP ${Math.ceil(p.hp)}/${p.maxHp}`,`HP ${Math.min(p.maxHp,Math.ceil(p.hp)+Math.round(p.maxHp*.55))}/${p.maxHp}`);
    if (id.startsWith("w_")){
      const type=id.slice(2),w=p.getWeapon(type);
      if (!w) return simple("未取得",`${WEAPON_DEFS[type].name} Lv.1 解放`);
      const currentData=getWeaponDisplayData(p,w);
      const preview=Object.assign({},w);
      if (preview.level<5) preview.level+=1;
      else if (preview.tier<3){preview.tier+=1;preview.level=1;}
      const afterData=getWeaponDisplayData(p,preview);
      return simple(`${currentData.level} / ${currentData.stats.slice(0,2).join("・")}`,`${afterData.level} / ${afterData.stats.slice(0,2).join("・")}`);
    }
    if (id.startsWith("fus_")) return simple("未融合","融合成立 / 両武器の最終威力×1.35");
    return previousPreview(id,p);
  };

  getCoreUpgradeData=function(player){
    const data=previousCoreData(player),r=player.upgradeRanks||{},stats=[];
    const addSignature=(id,label)=>{
      const rank=r[id]||0;if(!rank)return;
      const s=signatureStats[id](rank);
      if(id==="skill_nova")stats.push(`${label} Lv.${rank} / ${fmt(s.interval)}秒・半径${s.radius}`);
      else if(id==="skill_rail")stats.push(`${label} Lv.${rank} / ${fmt(s.interval)}秒・幅${s.width}`);
      else if(id==="skill_storm")stats.push(`${label} Lv.${rank} / ${s.targets}体・${fmt(s.interval)}秒`);
      else stats.push(`${label} Lv.${rank} / ${s.kills}撃破・半径${s.radius}`);
    };
    addSignature("skill_nova","NOVA");
    addSignature("skill_rail","RAIL");
    addSignature("skill_storm","STORM");
    addSignature("skill_cataclysm","CATACLYSM");
    if(r.protocol_reactor)stats.push(`暴走炉 Lv.${r.protocol_reactor} / 全ダメージ×${fmt(player.damageAmp)}`);
    if(r.protocol_fortress)stats.push(`要塞化 Lv.${r.protocol_fortress} / HP${player.maxHp}・軽減${Math.round(player.damageReduction*100)}%`);
    if(r.protocol_predator)stats.push(`捕食形態 Lv.${r.protocol_predator} / 移動${Math.round(player.speed)}・回収${Math.round(player.pickupRange)}`);
    if(r.protocol_shell)stats.push(`質量弾殻 Lv.${r.protocol_shell} / 投射物×${fmt(player.projectileDamageMul)}・貫通+${player.pierceBonus}`);
    for(const line of data.stats){if(stats.length>=8)break;if(!stats.includes(line))stats.push(line);}
    data.stats=stats;
    data.desc="派手な固有スキルと、複数能力をまとめた戦闘プロトコルの現在性能。";
    return data;
  };

  const previousStart=Game.prototype.startGame;
  Game.prototype.startGame=function(){
    const result=previousStart.call(this);
    if (this.player){
      this.player._novaTimer=.25;
      this.player._railTimer=.45;
      this.player._stormTimer=.65;
      this.player._cataclysmCharge=0;
    }
    disableDeathChain(this);
    return result;
  };

  const previousUpdate=Game.prototype.update;
  Game.prototype.update=function(dt){
    const result=previousUpdate.call(this,dt);
    disableDeathChain(this);
    if (this.state==="playing" && this.player) updateSignatureSkills(this,dt);
    return result;
  };

  const previousEnemyOnDeath=Enemy.prototype.onDeath;
  Enemy.prototype.onDeath=function(game){
    const player=game&&game.player;
    const cataclysmRank=rankOf(player,"skill_cataclysm");
    const shouldCharge=!!(
      player && cataclysmRank>0 && !game._cataclysmActive &&
      !this.dead && !this._deathEffectQueued && !this._deathEffectFinished
    );
    const result=previousEnemyOnDeath.call(this,game);
    if (shouldCharge){
      player._cataclysmCharge=(player._cataclysmCharge||0)+1;
      const needed=signatureStats.skill_cataclysm(cataclysmRank).kills;
      if (player._cataclysmCharge>=needed){
        player._cataclysmCharge=0;
        fireCataclysm(game,cataclysmRank);
      }
    }
    return result;
  };
})();
