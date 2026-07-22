"use strict";

/*
 * VOID SURVIVORS / OVERDRIVE IMPACT
 *
 * Adds a clearly different combat state on top of overdrive-mode.js:
 * a screen transformation, projectile purge, synchronized power volleys,
 * repeated prism barrages, a visible player crown, and a finishing blast.
 */
(() => {
  if (
    typeof window === "undefined" ||
    typeof Game === "undefined" ||
    typeof Player === "undefined" ||
    window.__overdriveImpact
  ) {
    return;
  }

  const IMPACT_VERSION = 1;
  const BARRAGE_INTERVAL = 0.48;
  const BARRAGE_TARGETS = 7;
  const BARRAGE_RANGE = 1250;
  const SYNC_INTERVAL = 1.45;
  const PULSE_INTERVAL = 1.05;
  const SOURCE_NAME = "深淵オーバードライブ";
  const GAME_VERSION = "2026.07.22.2";

  function active(game){
    return !!(game?._overdriveState?.active > 0 && game?.player);
  }

  function impactState(game){
    if (!game._overdriveImpactState){
      game._overdriveImpactState = {
        active: false,
        barrageTimer: 0,
        syncTimer: 0,
        pulseTimer: 0,
        lastSoundAt: 0
      };
    }
    return game._overdriveImpactState;
  }

  function scaledDamage(game, multiplier){
    const player = game.player;
    const levelScale = 1 + Math.max(0, (player.level || 1) - 1) * 0.045;
    return Math.max(1, Math.round(
      (player.atk || 12) *
      levelScale *
      (player.systemDamageMul || 1) *
      multiplier
    ));
  }

  function withDamageSource(game, action){
    const previous = game._damageSource;
    game._damageSource = SOURCE_NAME;
    try{
      return action();
    }finally{
      game._damageSource = previous;
    }
  }

  function nearestTargets(game, count, range, includeBoss=true){
    const player = game.player;
    const maxDistance2 = range * range;
    const targets = [];

    if (includeBoss && game.boss && !game.boss.dead){
      targets.push({target:game.boss, boss:true, distance:U.dist2(player.x,player.y,game.boss.x,game.boss.y)-maxDistance2});
    }

    for (const enemy of game.enemies || []){
      if (!enemy || enemy.dead) continue;
      const distance = U.dist2(player.x,player.y,enemy.x,enemy.y);
      if (distance > maxDistance2) continue;
      targets.push({target:enemy,boss:false,distance});
    }

    targets.sort((a,b)=>a.distance-b.distance);
    return targets.slice(0,count);
  }

  class OverdriveBeamEffect{
    constructor(ax,ay,bx,by,seed=0){
      this.life = 0.22;
      this.maxLife = 0.22;
      this.dead = false;
      this.ax = ax;
      this.ay = ay;
      this.bx = bx;
      this.by = by;
      this.points = [];
      const dx = bx-ax, dy = by-ay;
      const length = Math.hypot(dx,dy) || 1;
      const nx = -dy/length, ny = dx/length;
      const segments = 7;
      for (let i=0;i<=segments;i++){
        const t = i/segments;
        const edge = i===0 || i===segments;
        const wave = edge ? 0 : Math.sin((seed+1)*7.31+i*4.77)*10;
        this.points.push({x:ax+dx*t+nx*wave,y:ay+dy*t+ny*wave});
      }
    }
    update(dt){
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
    }
    draw(ctx,cam){
      const alpha = Math.max(0,this.life/this.maxLife);
      const drawPath = (width,color)=>{
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        for (let i=0;i<this.points.length;i++){
          const point = this.points[i];
          const x = point.x-cam.x, y = point.y-cam.y;
          if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.stroke();
      };
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      drawPath(18*alpha,`rgba(255,82,104,${0.28*alpha})`);
      drawPath(9*alpha,`rgba(255,212,71,${0.8*alpha})`);
      drawPath(3.2*alpha,`rgba(255,255,245,${alpha})`);
      ctx.translate(this.bx-cam.x,this.by-cam.y);
      ctx.rotate(Math.PI*.25);
      ctx.strokeStyle = `rgba(255,255,245,${alpha})`;
      ctx.fillStyle = `rgba(255,82,104,${0.28*alpha})`;
      ctx.lineWidth = 3;
      ctx.fillRect(-12,-12,24,24);
      ctx.strokeRect(-12,-12,24,24);
      ctx.restore();
    }
  }

  function addBeam(game,target,index){
    if (!target) return;
    game.addEffect?.(new OverdriveBeamEffect(
      game.player.x,
      game.player.y,
      target.x,
      target.y,
      index+(game.elapsed||0)
    ));
    if (typeof ImpactEffect !== "undefined"){
      game.addEffect?.(new ImpactEffect(target.x,target.y,"#ffd447",48,.24,index*.7,true));
    }
  }

  function purgeEnemyProjectiles(game){
    let purged = 0;
    for (const projectile of game.enemyProjectiles || []){
      if (!projectile || projectile.dead) continue;
      projectile.dead = true;
      purged++;
    }
    return purged;
  }

  function forcePowerVolley(game){
    if (!game._powerTimers) return;
    for (const id of Object.keys(game._powerTimers)) game._powerTimers[id] = 0;
  }

  function fireBarrage(game, opening=false){
    const targetCount = opening ? 12 : BARRAGE_TARGETS;
    const targets = nearestTargets(game,targetCount,opening?1600:BARRAGE_RANGE,true);
    if (!targets.length) return;
    const damage = scaledDamage(game,opening?3.6:2.05);
    withDamageSource(game,()=>{
      targets.forEach((entry,index)=>{
        addBeam(game,entry.target,index);
        if (entry.boss) game.damageBoss(opening?Math.round(damage*1.35):damage,false);
        else game.damageEnemy(entry.target,damage,false);
      });
    });

    const state = impactState(game);
    const now = performance.now();
    if (now-state.lastSoundAt>210){
      state.lastSoundAt = now;
      game.sound?.lightning?.();
    }
  }

  function fireClosePulse(game, finishing=false){
    const radius = finishing ? 620 : 270;
    const damage = scaledDamage(game,finishing?4.2:1.35);
    let hits = 0;
    withDamageSource(game,()=>{
      for (const enemy of game.enemies || []){
        if (!enemy || enemy.dead) continue;
        if (U.dist2(game.player.x,game.player.y,enemy.x,enemy.y)>Math.pow(radius+enemy.radius,2)) continue;
        game.damageEnemy(enemy,damage,false);
        if (++hits>=24) break;
      }
      if (game.boss && !game.boss.dead && U.dist2(game.player.x,game.player.y,game.boss.x,game.boss.y)<=Math.pow(radius+game.boss.radius,2)){
        game.damageBoss(Math.round(damage*1.25),false);
      }
    });
    if (typeof ShockwaveEffect !== "undefined"){
      game.addEffect?.(new ShockwaveEffect(game.player.x,game.player.y,finishing?"#ff5268":"#65d9ff",radius,.55,{inner:28,fill:true}));
    }
    if (typeof spawnParticles === "function"){
      spawnParticles(game.particles,game.player.x,game.player.y,finishing?42:16,finishing?"#ffd447":"#65d9ff",finishing?380:220,finishing?.8:.42,finishing?8:5);
    }
  }

  function installUi(){
    if (document.getElementById("overdriveImpactLayer")) return;
    const style = document.createElement("style");
    style.id = "overdriveImpactStyles";
    style.textContent = `
      #overdriveImpactLayer{
        position:fixed;
        inset:0;
        z-index:880;
        pointer-events:none;
        opacity:0;
        overflow:hidden;
        transition:opacity .12s linear;
      }
      #overdriveImpactLayer::before{
        content:"";
        position:absolute;
        inset:0;
        background:
          linear-gradient(115deg,rgba(255,82,104,.12),transparent 28%,transparent 68%,rgba(101,217,255,.12)),
          radial-gradient(circle at 50% 50%,transparent 0 38%,rgba(9,7,24,.34) 76%,rgba(9,7,24,.68) 100%);
        border:6px solid rgba(255,212,71,.75);
        box-sizing:border-box;
      }
      #overdriveImpactLayer::after{
        content:"";
        position:absolute;
        inset:-20%;
        background:repeating-linear-gradient(118deg,transparent 0 30px,rgba(255,255,245,.055) 31px 33px,transparent 34px 66px);
        animation:overdrive-stripes .55s linear infinite;
      }
      body.overdrive-impact-active #overdriveImpactLayer{opacity:1;}
      body.overdrive-impact-active #gameCanvas{filter:saturate(1.28) contrast(1.08);}
      body.overdrive-impact-active #overdriveControl{
        border-width:4px;
        box-shadow:8px 8px 0 #ff5268,-6px -6px 0 #65d9ff;
      }
      #overdriveImpactBanner{
        position:absolute;
        left:50%;
        top:19%;
        transform:translate(-50%,-20px) rotate(-2deg) scale(.86);
        padding:9px 18px 8px;
        border:4px solid #090718;
        background:#ffd447;
        color:#090718;
        box-shadow:8px 8px 0 #ff5268;
        font:1000 clamp(22px,3.8vw,54px)/.92 Arial Black,sans-serif;
        letter-spacing:.04em;
        opacity:0;
      }
      #overdriveImpactBanner.show{animation:overdrive-banner .92s cubic-bezier(.18,.8,.2,1);}
      @keyframes overdrive-stripes{to{transform:translate3d(50px,-24px,0);}}
      @keyframes overdrive-banner{
        0%{opacity:0;transform:translate(-50%,-55px) rotate(-5deg) scale(.72);}
        18%,68%{opacity:1;transform:translate(-50%,0) rotate(-2deg) scale(1);}
        100%{opacity:0;transform:translate(-50%,24px) rotate(1deg) scale(1.08);}
      }
    `;
    document.head.appendChild(style);
    const layer = document.createElement("div");
    layer.id = "overdriveImpactLayer";
    layer.innerHTML = '<div id="overdriveImpactBanner">CHROMA LIMIT BREAK</div>';
    document.body.appendChild(layer);
  }

  function showBanner(){
    const banner = document.getElementById("overdriveImpactBanner");
    if (!banner) return;
    banner.classList.remove("show");
    void banner.offsetWidth;
    banner.classList.add("show");
  }

  function decorateHud(game){
    const control = document.getElementById("overdriveControl");
    if (!control) return;
    const label = control.querySelector(".overdrive-head span");
    const hint = document.getElementById("overdriveHint");
    if (active(game)){
      if (label) label.textContent = "CHROMA LIMIT BREAK";
      if (hint) hint.textContent = "自動プリズム砲撃 / 全権能同期発動 / 敵弾消去";
    }else if (label){
      label.textContent = "ABYSS OVERDRIVE";
    }
  }

  function beginImpact(game){
    const state = impactState(game);
    state.active = true;
    state.barrageTimer = BARRAGE_INTERVAL;
    state.syncTimer = SYNC_INTERVAL;
    state.pulseTimer = PULSE_INTERVAL;
    document.body.classList.add("overdrive-impact-active");
    showBanner();
    const purged = purgeEnemyProjectiles(game);
    forcePowerVolley(game);
    fireBarrage(game,true);
    fireClosePulse(game,false);
    game.shake?.(22,.55);
    game.sound?.explosion?.();
    if (typeof ShockwaveEffect !== "undefined"){
      game.addEffect?.(new ShockwaveEffect(game.player.x,game.player.y,"#ffd447",520,.85,{inner:42,fill:true}));
    }
    game.showSystemToast?.(
      "✦",
      "CHROMA LIMIT BREAK",
      "通常攻撃の強化ではなく、機体が専用の殲滅形態へ移行した。",
      `敵弾 ${purged} 発消去 / プリズム一斉砲撃 / 全権能同期発動`,
      "#ffd447"
    );
    decorateHud(game);
  }

  function finishImpact(game,natural=true){
    const state = impactState(game);
    if (!state.active) return;
    state.active = false;
    document.body.classList.remove("overdrive-impact-active");
    if (natural && game.state === "playing" && game.player){
      fireClosePulse(game,true);
      game.shake?.(16,.38);
      game.sound?.explosion?.();
    }
    decorateHud(game);
  }

  function updateImpact(game,dt){
    const state = impactState(game);
    if (!active(game)) return;

    state.barrageTimer -= dt;
    state.syncTimer -= dt;
    state.pulseTimer -= dt;

    if (state.barrageTimer <= 0){
      state.barrageTimer += BARRAGE_INTERVAL;
      fireBarrage(game,false);
    }
    if (state.syncTimer <= 0){
      state.syncTimer += SYNC_INTERVAL;
      forcePowerVolley(game);
      if (typeof ShockwaveEffect !== "undefined"){
        game.addEffect?.(new ShockwaveEffect(game.player.x,game.player.y,"#ffd447",180,.32,{inner:54}));
      }
    }
    if (state.pulseTimer <= 0){
      state.pulseTimer += PULSE_INTERVAL;
      fireClosePulse(game,false);
      for (const projectile of game.enemyProjectiles || []){
        if (!projectile || projectile.dead) continue;
        if (U.dist2(game.player.x,game.player.y,projectile.x,projectile.y)<340*340) projectile.dead = true;
      }
    }
    decorateHud(game);
  }

  function cleanup(game){
    if (game?._overdriveImpactState) game._overdriveImpactState.active = false;
    document.body.classList.remove("overdrive-impact-active");
  }

  function drawPlayerCrown(player,ctx,cam){
    const game = window.__game;
    if (!active(game)) return;
    const x = player.x-cam.x, y = player.y-cam.y;
    const t = player.animT || 0;
    const remain = Math.max(0,Math.min(1,game._overdriveState.active/9));
    ctx.save();
    ctx.translate(x,y);
    ctx.globalCompositeOperation = "source-over";
    const gradient = ctx.createRadialGradient(0,0,18,0,0,105);
    gradient.addColorStop(0,"rgba(255,255,245,.18)");
    gradient.addColorStop(.45,"rgba(255,212,71,.12)");
    gradient.addColorStop(1,"rgba(255,82,104,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();ctx.arc(0,0,105,0,Math.PI*2);ctx.fill();

    ctx.rotate(t*2.4);
    ctx.strokeStyle = `rgba(255,212,71,${.65+.25*remain})`;
    ctx.lineWidth = 4;
    ctx.setLineDash([18,8,5,8]);
    ctx.beginPath();ctx.arc(0,0,58,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);

    ctx.rotate(-t*4.1);
    for (let i=0;i<6;i++){
      ctx.save();
      ctx.rotate(i/6*Math.PI*2);
      ctx.translate(84,0);
      ctx.rotate(Math.PI*.25);
      ctx.fillStyle = i%2?"#65d9ff":"#ff5268";
      ctx.strokeStyle = "#fff7dc";
      ctx.lineWidth = 2;
      ctx.fillRect(-7,-7,14,14);
      ctx.strokeRect(-7,-7,14,14);
      ctx.restore();
    }
    ctx.restore();
  }

  function installVersionOverride(){
    const apply = ()=>{
      const version = document.getElementById("gameVersion");
      if (version) version.textContent = `VER. ${GAME_VERSION}`;
    };
    apply();
    setTimeout(apply,0);
  }

  installUi();
  window.addEventListener("DOMContentLoaded",()=>{
    installUi();
    installVersionOverride();
  },{once:true});

  const previousUpdate = Game.prototype.update;
  Game.prototype.update = function(dt){
    const wasActive = impactState(this).active;
    const result = previousUpdate.call(this,dt);
    const isActive = active(this);
    const simulatedDt = dt * Math.max(1,Math.min(5,Math.round(Number(this.timeScale)||1)));
    if (isActive && !wasActive) beginImpact(this);
    if (isActive) updateImpact(this,simulatedDt);
    else if (wasActive) finishImpact(this,true);
    return result;
  };

  const previousPlayerDraw = Player.prototype.draw;
  Player.prototype.draw = function(ctx,cam){
    const result = previousPlayerDraw.call(this,ctx,cam);
    drawPlayerCrown(this,ctx,cam);
    return result;
  };

  for (const method of ["startGame","toTitle","onPlayerDeath","onClear"]){
    const previous = Game.prototype[method];
    if (typeof previous !== "function") continue;
    Game.prototype[method] = function(...args){
      cleanup(this);
      return previous.apply(this,args);
    };
  }

  window.__overdriveImpact = {
    version: IMPACT_VERSION,
    gameVersion: GAME_VERSION,
    validate(){
      const problems = [];
      if (!(BARRAGE_INTERVAL>0)) problems.push("barrage interval must be positive");
      if (!(BARRAGE_TARGETS>=1 && BARRAGE_TARGETS<=12)) problems.push("barrage target count out of range");
      if (!(SYNC_INTERVAL>=1)) problems.push("sync interval too short");
      return {ok:problems.length===0,problems};
    }
  };
})();
