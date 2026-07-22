"use strict";

window.__VOID_SURVIVORS_VERSION = "2026.07.22.4";

/* =========================================================================
   VOID SURVIVORS - 見下ろし型ローグライクサバイバルゲーム
   すべて Canvas + Vanilla JS で実装。外部ライブラリ・画像は使用しない。
   ========================================================================= */

/* ============================== 定数定義 ============================== */
const CONFIG = {
  MAP_W: 4200,
  MAP_H: 4200,
  TILE: 96,
  GAME_TIME: 600,          // 10分
  BOSS_INTERVAL: 120,      // 2分ごと
  MAX_ENEMIES: 160,
  MAX_PLAYER_PROJECTILES: 500,
  MAX_ENEMY_PROJECTILES: 260,
  MAX_PARTICLES: 400,
  MAX_DAMAGE_TEXTS: 120,
  MAX_EFFECTS: 180,
  MAX_CANVAS_PIXELS: 2300000,
  MAX_DPR: 1.25,
  GROUND_RENDER_SCALE: 0.55,
  GROUND_REFRESH_MS: 80,
  HUD_REFRESH_INTERVAL: 0.1,
  DRAW_MARGIN: 140,
  EXP_BASE: 8,
  EXP_GROWTH: 1.25,
  SPAWN_RING_MIN: 580,
  SPAWN_RING_MAX: 820,
  OBSTACLE_COUNT: 70,
  // 新機能用
  EXPLOSION_DAMAGE_RATIO: 0.3,  // 敵のMaxHPの30%がエリア爆発ダメージ
  AURA_DAMAGE_BASE: 8,
  AURA_RADIUS_BASE: 80,
  SUPERMODE_THRESHOLD: 20,  // 20体連続撃破でスーパーモード発動
  SUPERMODE_DURATION: 6,    // 6秒間
  SUPERMODE_MULTIPLIER: 2.0, // 能力2倍
};

const BASE_BALANCE = { hpMul:1, atkMul:1, spawnMul:1 };

const ENEMY_BASE = {
  normal:  { hp: 22,  speed: 95,  atk: 8,  radius: 15, exp: 4,  color: "#ff5f7f", score: 5  },
  fast:    { hp: 11,  speed: 190, atk: 6,  radius: 11, exp: 4,  color: "#55e7ff", score: 6  },
  heavy:   { hp: 85,  speed: 55,  atk: 16, radius: 22, exp: 8,  color: "#6c64ff", score: 10 },
  ranged:  { hp: 18,  speed: 80,  atk: 7,  radius: 14, exp: 6,  color: "#ffd84f", score: 9  },
  splitter:{ hp: 30,  speed: 90,  atk: 9,  radius: 17, exp: 7,  color: "#ff9654", score: 9  },
  splitmini:{hp: 8,   speed: 140, atk: 5,  radius: 9,  exp: 2,  color: "#ffb67d", score: 2  },
  elite:   { hp: 240, speed: 75,  atk: 22, radius: 30, exp: 28, color: "#dc56ff", score: 40 },
};

/* ============================== ユーティリティ ============================== */
const U = {
  rand(min, max){ return Math.random() * (max - min) + min; },
  randInt(min, max){ return Math.floor(U.rand(min, max + 1)); },
  dist(ax, ay, bx, by){ const dx = ax - bx, dy = ay - by; return Math.sqrt(dx*dx + dy*dy); },
  dist2(ax, ay, bx, by){ const dx = ax - bx, dy = ay - by; return dx*dx + dy*dy; },
  clamp(v, min, max){ return v < min ? min : (v > max ? max : v); },
  angle(ax, ay, bx, by){ return Math.atan2(by - ay, bx - ax); },
  lerp(a, b, t){ return a + (b - a) * t; },
  choice(arr){ return arr[Math.floor(Math.random() * arr.length)]; },
  hash(x,y){ let n=(x*374761393+y*668265263)>>>0; n=(n^(n>>13))*1274126177; return ((n^(n>>16))>>>0)/4294967295; },
};

const STAGE_VISUALS = [
  {name:"侵入", code:"GATE 01", bg0:"#17254b", bg1:"#354f7d", floor:"#385d82", accent:"#5dffd2", accent2:"#ffe66b", danger:"#ff7290", fog:"#8292ff", motif:"petal"},
  {name:"変色", code:"GATE 02", bg0:"#2d1847", bg1:"#694278", floor:"#76508a", accent:"#7ce8ff", accent2:"#ff86a0", danger:"#ffad63", fog:"#cf7dff", motif:"cell"},
  {name:"増殖", code:"GATE 03", bg0:"#153f4b", bg1:"#347a79", floor:"#3e887d", accent:"#c7ff70", accent2:"#71f4dc", danger:"#ff7187", fog:"#51c8db", motif:"spore"},
  {name:"崩壊", code:"GATE 04", bg0:"#45212c", bg1:"#87454c", floor:"#95545b", accent:"#ffdc69", accent2:"#ff8c68", danger:"#ff5878", fog:"#c65d7f", motif:"rift"},
  {name:"深淵", code:"GATE 05", bg0:"#1d1738", bg1:"#42356a", floor:"#514073", accent:"#e57aff", accent2:"#76e8ff", danger:"#ff5c82", fog:"#8065db", motif:"eye"},
];
function stageIndexForTime(t){ return t<90?0:t<180?1:t<300?2:t<420?3:4; }
function stageVisualForTime(t){ return STAGE_VISUALS[stageIndexForTime(t)]; }
const RGBA_RGB_CACHE = new Map();
function rgba(hex,a){
  let rgb = RGBA_RGB_CACHE.get(hex);
  if (!rgb){
    const h=hex.replace("#",""); const v=parseInt(h.length===3?h.split("").map(c=>c+c).join(""):h,16);
    rgb=[(v>>16)&255,(v>>8)&255,v&255];
    RGBA_RGB_CACHE.set(hex,rgb);
  }
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}
function worldObjectVisible(obj,cam,w,h,margin){
  if(!obj||!Number.isFinite(obj.x)||!Number.isFinite(obj.y))return true;
  const r=Number.isFinite(obj.radius)?obj.radius:Number.isFinite(obj.size)?obj.size:40;
  const m=margin==null?CONFIG.DRAW_MARGIN:margin;
  return obj.x+r>=cam.x-m&&obj.x-r<=cam.x+w+m&&obj.y+r>=cam.y-m&&obj.y-r<=cam.y+h+m;
}
function polygonPath(ctx, pts){
  ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.closePath();
}
function drawRingTicks(ctx,r,count,len,rot){
  ctx.save();ctx.rotate(rot||0);for(let i=0;i<count;i++){const a=i/count*Math.PI*2;ctx.beginPath();ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);ctx.lineTo(Math.cos(a)*(r+len),Math.sin(a)*(r+len));ctx.stroke();}ctx.restore();
}

/* ============================== 効果音 ============================== */
class SoundManager {
  constructor(){
    this.ctx = null;
    this.volume = 0.6;
    this.enabled = true;
  }
  ensure(){
    if (!this.enabled) return false;
    if (!this.ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC){ this.enabled = false; return false; }
      try{ this.ctx = new AC(); }catch(e){ this.enabled = false; return false; }
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(()=>{});
    return true;
  }
  tone(freq, dur, type, vol, opt){
    if (!this.enabled) return;
    if (!this.ensure()) return;
    opt = opt || {};
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (opt.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1,opt.slideTo), t0 + dur);
    const v = (vol == null ? 0.3 : vol) * this.volume;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001,v), t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  noise(dur, vol){
    if (!this.enabled) return;
    if (!this.ensure()) return;
    const ctx = this.ctx;
    const bufferSize = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime((vol==null?0.25:vol) * this.volume, ctx.currentTime);
    src.connect(gain).connect(ctx.destination);
    src.start();
  }
  attack(){ this.tone(U.rand(520,620), 0.05, "square", 0.12); }
  hit(){ this.tone(U.rand(180,240), 0.06, "square", 0.15); }
  kill(){ this.tone(340, 0.12, "sawtooth", 0.18, {slideTo:120}); }
  damaged(){ this.noise(0.15, 0.25); this.tone(110,0.15,"sawtooth",0.2,{slideTo:60}); }
  levelUp(){ [0,1,2].forEach((i)=> setTimeout(()=> this.tone(440 + i*180, 0.16, "triangle", 0.25), i*90)); }
  item(){ this.tone(700, 0.08, "sine", 0.2, {slideTo:1000}); }
  bossAppear(){ this.tone(80,0.5,"sawtooth",0.3,{slideTo:60}); this.noise(0.5,0.2); }
  gameOver(){ [400,300,200,100].forEach((f,i)=> setTimeout(()=> this.tone(f,0.3,"sawtooth",0.25),i*160)); }
  clear(){ [523,659,784,1047].forEach((f,i)=> setTimeout(()=> this.tone(f,0.28,"triangle",0.28),i*140)); }
  explosion(){ this.noise(0.3, 0.3); this.tone(70,0.3,"sawtooth",0.25,{slideTo:30}); }
  lightning(){ this.tone(1200,0.08,"square",0.18,{slideTo:200}); }
  laser(){ this.tone(900,0.1,"sawtooth",0.12,{slideTo:1400}); }
}

/* ============================== 入力管理 ============================== */
class InputManager {
  constructor(){
    this.keys = new Set();
    window.addEventListener("keydown", (e)=>{
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) e.preventDefault();
      this.keys.add(e.key.toLowerCase());
      if (e.key === "Escape") window.dispatchEvent(new CustomEvent("game-escape"));
    });
    window.addEventListener("keyup", (e)=>{
      this.keys.delete(e.key.toLowerCase());
    });
    // フォーカスを失った時にキー入力が残ってしまうバグを防止
    window.addEventListener("blur", ()=> this.keys.clear());
    document.addEventListener("visibilitychange", ()=> { if (document.hidden) this.keys.clear(); });
    document.addEventListener("keydown", (e)=>{
      const el = e.target.closest && e.target.closest('[role="button"]');
      if (el && (e.key === "Enter" || e.key === " ")){ e.preventDefault(); el.click(); }
    });
  }
  isDown(...names){ return names.some(n => this.keys.has(n)); }
  getAxis(){
    let x = 0, y = 0;
    if (this.isDown("a","arrowleft")) x -= 1;
    if (this.isDown("d","arrowright")) x += 1;
    if (this.isDown("w","arrowup")) y -= 1;
    if (this.isDown("s","arrowdown")) y += 1;
    const len = Math.hypot(x,y);
    if (len > 0){ x/=len; y/=len; }
    return {x,y};
  }
}

/* ============================== オブジェクトプール的配列操作 ============================== */
function removeDead(arr){
  for (let i = arr.length - 1; i >= 0; i--){
    if (arr[i].dead) arr.splice(i,1);
  }
}

class ExplosionArea{
  constructor(x,y,radius,damage,color){
    this.x=x;this.y=y;this.radius=radius;this.damage=damage;
    this.life=0.48;this.maxLife=0.48;this.dead=false;this.color=color||"#ff9654";
  }
  update(dt){ this.life-=dt; if(this.life<=0)this.dead=true; }
  draw(ctx,cam){
    const p=1-Math.max(0,this.life/this.maxLife), a=Math.max(0,this.life/this.maxLife);
    const x=this.x-cam.x,y=this.y-cam.y,r=this.radius*(.25+.75*p);
    ctx.save();ctx.globalCompositeOperation="source-over";
    const g=ctx.createRadialGradient(x,y,0,x,y,Math.max(1,r));g.addColorStop(0,rgba("#fff8ca",a*.65));g.addColorStop(.35,rgba(this.color,a*.32));g.addColorStop(1,rgba(this.color,0));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=rgba(this.color,a*.9);ctx.lineWidth=8*(1-p)+2;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
}

class ShockwaveEffect{
  constructor(x,y,color,radius,life,opt){this.x=x;this.y=y;this.color=color;this.radius=radius;this.life=life;this.maxLife=life;this.dead=false;this.inner=opt&&opt.inner||0;this.fill=!!(opt&&opt.fill);}
  update(dt){this.life-=dt;if(this.life<=0)this.dead=true;}
  draw(ctx,cam){const p=1-this.life/this.maxLife,a=Math.max(0,this.life/this.maxLife);const r=U.lerp(this.inner,this.radius,1-Math.pow(1-p,3));ctx.save();ctx.globalCompositeOperation="source-over";if(this.fill){const g=ctx.createRadialGradient(this.x-cam.x,this.y-cam.y,0,this.x-cam.x,this.y-cam.y,r);g.addColorStop(0,rgba(this.color,0));g.addColorStop(.7,rgba(this.color,a*.12));g.addColorStop(1,rgba(this.color,0));ctx.fillStyle=g;ctx.beginPath();ctx.arc(this.x-cam.x,this.y-cam.y,r,0,Math.PI*2);ctx.fill();}ctx.strokeStyle=rgba(this.color,a*.75);ctx.lineWidth=U.lerp(10,1,p);ctx.beginPath();ctx.arc(this.x-cam.x,this.y-cam.y,r,0,Math.PI*2);ctx.stroke();ctx.restore();}
}

class LightningEffect{
  constructor(ax,ay,bx,by,color,life,width){this.ax=ax;this.ay=ay;this.bx=bx;this.by=by;this.color=color;this.life=life||.18;this.maxLife=this.life;this.width=width||4;this.dead=false;this.seed=Math.random()*999;}
  update(dt){this.life-=dt;if(this.life<=0)this.dead=true;}
  makePoints(jitter){const pts=[];const dx=this.bx-this.ax,dy=this.by-this.ay,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;const seg=Math.max(5,Math.min(18,Math.floor(len/35)));for(let i=0;i<=seg;i++){const q=i/seg;const fade=Math.sin(q*Math.PI);const off=(Math.sin((i+this.seed)*12.9898)*43758.5453%1)*jitter*fade;pts.push([U.lerp(this.ax,this.bx,q)+nx*off,U.lerp(this.ay,this.by,q)+ny*off]);}return pts;}
  draw(ctx,cam){const a=Math.max(0,this.life/this.maxLife);ctx.save();ctx.translate(-cam.x,-cam.y);ctx.globalCompositeOperation="source-over";for(const [j,w,alpha] of [[22,this.width*3,.18],[12,this.width*1.7,.35],[5,this.width,.95]]){const pts=this.makePoints(j);ctx.strokeStyle=alpha>.8?rgba("#ffffff",a):rgba(this.color,a*alpha);ctx.lineWidth=w;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();}ctx.restore();}
}

class ImpactEffect{
  constructor(x,y,color,size,life,angle,crit){this.x=x;this.y=y;this.color=color;this.size=size||24;this.life=life||.22;this.maxLife=this.life;this.angle=angle||0;this.crit=!!crit;this.dead=false;this.seed=Math.random()*10;}
  update(dt){this.life-=dt;if(this.life<=0)this.dead=true;}
  draw(ctx,cam){const p=1-this.life/this.maxLife,a=Math.max(0,this.life/this.maxLife);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.rotate(this.angle+this.seed);ctx.globalCompositeOperation="source-over";ctx.strokeStyle=rgba(this.color,a);ctx.lineWidth=this.crit?5:3;const rays=this.crit?10:6;for(let i=0;i<rays;i++){const an=i/rays*Math.PI*2;ctx.beginPath();ctx.moveTo(Math.cos(an)*this.size*.2*p,Math.sin(an)*this.size*.2*p);ctx.lineTo(Math.cos(an)*this.size*(.65+p*.55),Math.sin(an)*this.size*(.65+p*.55));ctx.stroke();}ctx.fillStyle=rgba("#ffffff",a*.8);ctx.beginPath();ctx.arc(0,0,this.size*(.36-.22*p),0,Math.PI*2);ctx.fill();ctx.restore();}
}

class MuzzleEffect{
  constructor(x,y,angle,color,size){this.x=x;this.y=y;this.angle=angle;this.color=color;this.size=size||20;this.life=.12;this.maxLife=.12;this.dead=false;}
  update(dt){this.life-=dt;if(this.life<=0)this.dead=true;}
  draw(ctx,cam){const a=Math.max(0,this.life/this.maxLife),p=1-a;ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.rotate(this.angle);ctx.globalCompositeOperation="source-over";const g=ctx.createLinearGradient(0,0,this.size*(1+p),0);g.addColorStop(0,rgba("#ffffff",a));g.addColorStop(.35,rgba(this.color,a*.9));g.addColorStop(1,rgba(this.color,0));ctx.fillStyle=g;polygonPath(ctx,[[0,-7*a],[this.size*(1+p),0],[0,7*a],[-5,0]]);ctx.fill();ctx.restore();}
}

class Treasure{
  constructor(x,y){this.x=x;this.y=y;this.radius=16;this.dead=false;this.collected=false;this.t=0;this.bounceHeight=0;this.bounceVel=0;}
  update(dt,player){this.t+=dt;this.bounceVel-=600*dt;this.bounceHeight=Math.max(0,this.bounceHeight+this.bounceVel*dt);if(this.bounceHeight<=0){this.bounceHeight=0;this.bounceVel=Math.abs(this.bounceVel)*.6;}const d=U.dist(this.x,this.y,player.x,player.y);if(d<64&&!this.collected){this.collected=true;player.hp=Math.min(player.maxHp,player.hp+Math.round(player.maxHp*.3));player.exp+=Math.round(player.expToNext*.5);spawnParticles(this.game.particles,this.x,this.y,24,"#ffd94e",280,.7,7);this.game.addEffect(new ShockwaveEffect(this.x,this.y,"#ffd94e",100,.5,{inner:8,fill:true}));this.game.sound.item();}if(this.collected)this.dead=true;}
  draw(ctx,cam){const x=this.x-cam.x,y=this.y-cam.y-this.bounceHeight,pulse=1+Math.sin(this.t*4)*.04;ctx.save();ctx.translate(x,y);ctx.scale(pulse,pulse);ctx.fillStyle="rgba(0,0,0,.35)";ctx.beginPath();ctx.ellipse(0,19,22,7,0,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation="source-over";ctx.strokeStyle=rgba("#ffd94e",.45);ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,25+Math.sin(this.t*3)*3,0,Math.PI*2);ctx.stroke();ctx.globalCompositeOperation="source-over";ctx.strokeStyle="#090718";ctx.lineWidth=4;ctx.fillStyle="#45325f";polygonPath(ctx,[[-18,-7],[-12,-15],[12,-15],[18,-7],[18,12],[-18,12]]);ctx.fill();ctx.stroke();ctx.fillStyle="#ffd94e";ctx.fillRect(-15,-6,30,15);ctx.strokeRect(-15,-6,30,15);ctx.fillStyle="#ff617e";ctx.fillRect(-3,-9,6,18);ctx.strokeRect(-3,-9,6,18);ctx.fillStyle="#fff7dc";ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();ctx.restore();}
}

/* ============================== パーティクル / 演出 ============================== */
class Particle{
  constructor(x,y,vx,vy,life,color,size){this.x=x;this.y=y;this.vx=vx;this.vy=vy;this.life=life;this.maxLife=life;this.color=color;this.size=size;this.dead=false;this.rot=Math.random()*Math.PI*2;this.spin=U.rand(-8,8);this.shape=Math.floor(Math.random()*3);}
  update(dt){this.x+=this.vx*dt;this.y+=this.vy*dt;this.vx*=Math.pow(.92,dt*60);this.vy*=Math.pow(.92,dt*60);this.rot+=this.spin*dt;this.life-=dt;if(this.life<=0)this.dead=true;}
  draw(ctx,cam){const a=Math.max(0,this.life/this.maxLife),sz=this.size*(.35+.65*a);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.rotate(this.rot);ctx.globalAlpha=a;ctx.globalCompositeOperation="source-over";ctx.fillStyle=this.color;ctx.shadowColor=this.color;ctx.shadowBlur=0;if(this.shape===0){ctx.beginPath();ctx.arc(0,0,sz,0,Math.PI*2);ctx.fill();}else if(this.shape===1){polygonPath(ctx,[[sz*1.5,0],[0,sz*.55],[-sz*1.5,0],[0,-sz*.55]]);ctx.fill();}else{ctx.fillRect(-sz*.35,-sz*1.4,sz*.7,sz*2.8);}ctx.restore();}
}

class DamageText{
  constructor(x,y,text,color,crit){
    this.x=x;this.y=y;this.text=text;this.color=color;this.life=1.2;this.maxLife=1.2;
    this.vy = crit ? -140 : -80;
    this.crit=crit;this.dead=false;
    this.vx = U.rand(-30,30);
    this.scale = crit ? 1.8 : 1.0;
    this.rot = U.rand(-0.3,0.3);
  }
  update(dt){
    this.y += this.vy*dt; this.x += this.vx*dt; this.vy += (this.crit?40:60)*dt;
    this.scale *= 0.95;
    this.rot += U.rand(-0.08,0.08);
    this.life -= dt;
    if (this.life<=0) this.dead=true;
  }
  draw(ctx,cam){
    const a = Math.max(0,this.life/this.maxLife);
    ctx.save();
    ctx.translate(this.x-cam.x, this.y-cam.y);
    ctx.rotate(this.rot);
    ctx.globalAlpha = a;
    if (this.crit){
      ctx.font = "bold 48px sans-serif";
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    } else {
      ctx.font = "bold 26px sans-serif";
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
    }
    ctx.scale(this.scale, this.scale);
    ctx.fillStyle = this.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,.9)";
    ctx.lineWidth = this.crit ? 5 : 3;
    ctx.strokeText(this.text, 0, 0);
    ctx.fillText(this.text, 0, 0);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function spawnParticles(list, x, y, count, color, speed, life, size){
  for (let i=0;i<count;i++){
    if (list.length >= CONFIG.MAX_PARTICLES) list.shift();
    const ang = Math.random()*Math.PI*2;
    const spd = U.rand(speed*0.3, speed);
    list.push(new Particle(x,y,Math.cos(ang)*spd, Math.sin(ang)*spd, U.rand(life*0.6,life), color, U.rand(size*0.5,size)));
  }
}

/* ============================== 経験値ジェム / アイテム ============================== */
class ExpGem{
  constructor(x,y,value){
    this.x=x;this.y=y;this.value=value;this.dead=false;
    this.radius = value>=8?6:4;
    this.attracted=false;
    this.bobT = Math.random()*10;
  }
  update(dt, player){
    this.bobT += dt*4;
    const d = U.dist(this.x,this.y,player.x,player.y);
    if (d < player.pickupRange || this.attracted){
      this.attracted = true;
      const ang = U.angle(this.x,this.y,player.x,player.y);
      const spd = U.clamp(700 - d, 260, 700);
      this.x += Math.cos(ang)*spd*dt;
      this.y += Math.sin(ang)*spd*dt;
      if (d < 14){ this.dead = true; player.gainExp(this.value); }
    }
  }
  draw(ctx,cam){
    const bob=Math.sin(this.bobT)*3,x=this.x-cam.x,y=this.y-cam.y+bob,c=this.value>=8?"#65dcff":"#ffd94e";ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4+this.bobT*.12);ctx.globalCompositeOperation="source-over";ctx.shadowColor=c;ctx.shadowBlur=0;ctx.fillStyle=rgba(c,.25);ctx.fillRect(-this.radius*1.8,-this.radius*1.8,this.radius*3.6,this.radius*3.6);ctx.fillStyle=c;polygonPath(ctx,[[0,-this.radius*1.5],[this.radius,0],[0,this.radius*1.5],[-this.radius,0]]);ctx.fill();ctx.fillStyle="#fff7dc";polygonPath(ctx,[[0,-this.radius*1.2],[this.radius*.28,0],[0,this.radius*.35],[-this.radius*.18,0]]);ctx.fill();ctx.restore();
  }
}

const ITEM_TYPES = {
  heal:     { color:"#3fd66b", icon:"❤" },
  atkup:    { color:"#e0473f", icon:"⚔" },
  spdup:    { color:"#4fc3e0", icon:"⚡" },
  invincible:{color:"#e0d13f", icon:"★" },
  magnet:   { color:"#c17ee0", icon:"◎" },
  nuke:     { color:"#ff8a3f", icon:"☠" },
};
class Item{
  constructor(x,y,type){
    this.x=x;this.y=y;this.type=type;this.dead=false;this.radius=12;this.t=0;
  }
  update(dt, player){
    this.t += dt;
    const d = U.dist(this.x,this.y,player.x,player.y);
    if (d < player.pickupRange*0.9){
      const ang = U.angle(this.x,this.y,player.x,player.y);
      this.x += Math.cos(ang)*420*dt;
      this.y += Math.sin(ang)*420*dt;
    }
    if (d < 18){ this.dead = true; player.applyItem(this.type); }
  }
  draw(ctx,cam){const info=ITEM_TYPES[this.type],bob=Math.sin(this.t*3)*4,pulse=1+Math.sin(this.t*6)*.08;ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y+bob);ctx.scale(pulse,pulse);ctx.rotate(this.t*.35);ctx.globalCompositeOperation="source-over";ctx.strokeStyle=rgba(info.color,.45);ctx.lineWidth=3;ctx.setLineDash([4,7]);ctx.lineDashOffset=-this.t*18;ctx.beginPath();ctx.arc(0,0,this.radius*1.75,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=rgba(info.color,.28);ctx.shadowColor=info.color;ctx.shadowBlur=0;polygonPath(ctx,[[0,-this.radius*1.25],[this.radius*1.08,-this.radius*.62],[this.radius*1.08,this.radius*.62],[0,this.radius*1.25],[-this.radius*1.08,this.radius*.62],[-this.radius*1.08,-this.radius*.62]]);ctx.fill();ctx.globalCompositeOperation="source-over";ctx.rotate(-this.t*.35);ctx.fillStyle=info.color;ctx.beginPath();ctx.arc(0,0,this.radius,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#090718";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#090718";ctx.font="bold 14px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(info.icon,0,1);ctx.restore();}
}

/* ============================== 弾（プレイヤー） ============================== */
class Projectile{
  constructor(x,y,vx,vy,damage,radius,pierce,color,kind,opt){
    this.x=x;this.y=y;this.vx=vx;this.vy=vy;this.damage=damage;this.radius=radius;
    this.pierce=pierce;this.color=color;this.kind=kind;this.dead=false;this.life=opt&&opt.life||3.2;this.maxLife=this.life;
    this.hitSet=new Set();this.crit=opt&&opt.crit;this.bossHit=false;this.trail=[];this.age=0;this.spin=Math.random()*Math.PI*2;this.angle=Math.atan2(vy,vx);
  }
  update(dt){
    this.age+=dt;this.spin+=dt*9;
    const keep=this.kind==="pierce"?12:8;this.trail.push({x:this.x,y:this.y});if(this.trail.length>keep)this.trail.shift();
    this.x+=this.vx*dt;this.y+=this.vy*dt;this.life-=dt;if(this.life<=0)this.dead=true;
  }
  draw(ctx,cam){
    const x=this.x-cam.x,y=this.y-cam.y;ctx.save();ctx.globalCompositeOperation="source-over";
    if(this.trail.length>1){for(let pass=0;pass<2;pass++){ctx.beginPath();this.trail.forEach((p,i)=>{const px=p.x-cam.x,py=p.y-cam.y;i?ctx.lineTo(px,py):ctx.moveTo(px,py)});ctx.strokeStyle=pass?rgba("#ffffff",.22):rgba(this.color,.20);ctx.lineWidth=pass?Math.max(1,this.radius*.55):this.radius*2.5;ctx.lineCap="round";ctx.stroke();}}
    ctx.translate(x,y);ctx.rotate(this.angle);
    if(this.kind==="pierce"){
      ctx.shadowColor=this.color;ctx.shadowBlur=0;ctx.fillStyle=rgba(this.color,.82);polygonPath(ctx,[[-18,-this.radius*.75],[10,-this.radius],[25,0],[10,this.radius],[-18,this.radius*.75],[-8,0]]);ctx.fill();
      ctx.fillStyle="#fffbe8";polygonPath(ctx,[[-7,-2],[25,0],[-7,2],[-13,0]]);ctx.fill();
      ctx.fillStyle=rgba(this.color,.75);polygonPath(ctx,[[-10,-2],[-22,-10],[-17,0],[-22,10]]);ctx.fill();
    }else{
      ctx.rotate(this.spin);ctx.shadowColor=this.color;ctx.shadowBlur=0;ctx.fillStyle=rgba(this.color,.95);polygonPath(ctx,[[this.radius*1.5,0],[0,this.radius],[-this.radius*1.5,0],[0,-this.radius]]);ctx.fill();ctx.fillStyle="#fffbe8";ctx.beginPath();ctx.arc(0,0,Math.max(2,this.radius*.42),0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
}

class EnemyProjectile{
  constructor(x,y,vx,vy,damage,radius,color){this.x=x;this.y=y;this.vx=vx;this.vy=vy;this.damage=damage;this.radius=radius;this.color=color;this.dead=false;this.life=5;this.age=0;this.trail=[];this.spin=Math.random()*6;}
  update(dt){this.age+=dt;this.spin+=dt*5;this.trail.push({x:this.x,y:this.y});if(this.trail.length>7)this.trail.shift();this.x+=this.vx*dt;this.y+=this.vy*dt;this.life-=dt;if(this.life<=0)this.dead=true;}
  draw(ctx,cam){ctx.save();ctx.globalCompositeOperation="source-over";if(this.trail.length>1){ctx.beginPath();this.trail.forEach((p,i)=>i?ctx.lineTo(p.x-cam.x,p.y-cam.y):ctx.moveTo(p.x-cam.x,p.y-cam.y));ctx.strokeStyle=rgba(this.color,.24);ctx.lineWidth=this.radius*1.6;ctx.lineCap="round";ctx.stroke();}ctx.translate(this.x-cam.x,this.y-cam.y);ctx.rotate(this.spin);ctx.strokeStyle=rgba(this.color,.85);ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,this.radius*1.55,0,Math.PI*1.55);ctx.stroke();ctx.fillStyle=rgba(this.color,.75);ctx.shadowColor=this.color;ctx.shadowBlur=0;polygonPath(ctx,[[this.radius,0],[0,this.radius],[-this.radius,0],[0,-this.radius]]);ctx.fill();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(0,0,Math.max(2,this.radius*.3),0,Math.PI*2);ctx.fill();ctx.restore();}
}

/* ============================== 環境装飾 / 障害物 ============================== */
class Decoration{
  constructor(x,y,r,kind,seed){this.x=x;this.y=y;this.radius=r;this.kind=kind;this.seed=seed;this.rot=seed*Math.PI*2;}
  draw(ctx,cam,st,time){const x=this.x-cam.x,y=this.y-cam.y,r=this.radius;if(x<-r*2||x>window.innerWidth+r*2||y<-r*2||y>window.innerHeight+r*2)return;ctx.save();ctx.translate(x,y);ctx.rotate(this.rot);ctx.globalAlpha=.72;
    if(this.kind===0){ // ancient signal gate
      ctx.fillStyle="rgba(0,0,0,.22)";ctx.beginPath();ctx.ellipse(0,r*.42,r*1.1,r*.3,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=rgba(st.accent,.32);ctx.lineWidth=5;ctx.setLineDash([18,14]);ctx.lineDashOffset=-time*12;ctx.beginPath();ctx.arc(0,0,r*.72,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle=rgba("#fff7dc",.18);ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*.48,0,Math.PI*2);ctx.stroke();drawRingTicks(ctx,r*.72,12,r*.18,time*.12);for(const sx of[-1,1]){ctx.save();ctx.translate(sx*r*.82,0);ctx.fillStyle="#17112c";ctx.strokeStyle=rgba(st.accent2,.35);ctx.lineWidth=3;polygonPath(ctx,[[-r*.12,-r*.55],[r*.12,-r*.45],[r*.16,r*.52],[-r*.16,r*.52]]);ctx.fill();ctx.stroke();ctx.restore();}}
    else if(this.kind===1){ // chroma pool
      ctx.rotate(-this.rot);const g=ctx.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,rgba(st.accent,.25));g.addColorStop(.55,rgba(st.fog,.13));g.addColorStop(1,rgba(st.accent,0));ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,0,r,r*.5,0,0,Math.PI*2);ctx.fill();for(let i=0;i<4;i++){ctx.strokeStyle=rgba(i%2?st.accent2:st.accent,.16);ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(Math.sin(time*.25+i)*r*.12,Math.cos(time*.2+i)*r*.06,r*(.25+i*.13),r*(.09+i*.06),0,0,Math.PI*2);ctx.stroke();}for(let i=0;i<6;i++){const a=i*2.2+this.seed*8;ctx.fillStyle=rgba(st.accent2,.25);polygonPath(ctx,[[Math.cos(a)*r*.65,Math.sin(a)*r*.3-r*.16],[Math.cos(a)*r*.65+r*.08,Math.sin(a)*r*.3],[Math.cos(a)*r*.65-r*.04,Math.sin(a)*r*.3]]);ctx.fill();}}
    else if(this.kind===2){ // rib ruin
      ctx.rotate(-this.rot);ctx.strokeStyle=rgba(st.accent2,.18);ctx.lineWidth=Math.max(4,r*.06);ctx.lineCap="round";for(let i=-3;i<=3;i++){const ox=i*r*.18;ctx.beginPath();ctx.moveTo(ox,r*.4);ctx.bezierCurveTo(ox-r*.24,-r*.1,ox-r*.12,-r*.55,ox,-r*.62);ctx.stroke();}ctx.strokeStyle=rgba(st.accent,.18);ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-r*.7,r*.42);ctx.lineTo(r*.7,r*.42);ctx.stroke();}
    else if(this.kind===3){ // giant organism
      ctx.rotate(time*.04);ctx.strokeStyle=rgba(st.accent,.18);ctx.lineWidth=3;for(let i=0;i<8;i++){ctx.save();ctx.rotate(i/8*Math.PI*2);ctx.fillStyle=rgba(i%2?st.danger:st.accent,.11);polygonPath(ctx,[[r*.15,-r*.08],[r*.9,-r*.28],[r*.72,r*.12],[r*.2,r*.16]]);ctx.fill();ctx.stroke();ctx.restore();}ctx.fillStyle=rgba(st.accent2,.18);ctx.beginPath();ctx.arc(0,0,r*.25+Math.sin(time*.8+this.seed)*r*.03,0,Math.PI*2);ctx.fill();ctx.stroke();}
    else{ // dimensional fissure
      ctx.rotate(-this.rot);ctx.globalCompositeOperation="source-over";ctx.shadowColor=st.danger;ctx.shadowBlur=0;ctx.strokeStyle=rgba(st.danger,.35);ctx.lineWidth=Math.max(5,r*.05);ctx.beginPath();ctx.moveTo(-r*.65,-r*.18);ctx.lineTo(-r*.28,-r*.05);ctx.lineTo(-r*.1,-r*.3);ctx.lineTo(r*.08,r*.08);ctx.lineTo(r*.38,-r*.02);ctx.lineTo(r*.66,r*.25);ctx.stroke();ctx.strokeStyle=rgba("#fff7dc",.18);ctx.lineWidth=2;ctx.stroke();ctx.globalCompositeOperation="source-over";}
    ctx.restore();
  }
}

class Obstacle{
  constructor(x,y,r){this.x=x;this.y=y;this.radius=r;this.seed=U.hash(Math.floor(x),Math.floor(y));this.kind=Math.floor(this.seed*3);this.rot=this.seed*Math.PI*2;}
  draw(ctx,cam){
    const x=this.x-cam.x,y=this.y-cam.y,r=this.radius;ctx.save();ctx.translate(x,y);ctx.rotate(this.rot);ctx.lineJoin="round";
    ctx.fillStyle="rgba(0,0,0,.32)";ctx.beginPath();ctx.ellipse(8,r*.68,r*.95,r*.34,0,0,Math.PI*2);ctx.fill();
    if(this.kind===0){
      ctx.shadowColor="#5967ff";ctx.shadowBlur=0;ctx.fillStyle="#1b123d";ctx.strokeStyle="#080717";ctx.lineWidth=5;polygonPath(ctx,[[0,-r], [r*.72,-r*.28],[r*.42,r*.68],[-r*.35,r],[-r*.78,r*.08]]);ctx.fill();ctx.stroke();
      ctx.fillStyle="#5868ff";polygonPath(ctx,[[0,-r*.8],[r*.25,-r*.2],[-r*.06,r*.58],[-r*.3,-r*.1]]);ctx.fill();ctx.fillStyle="#4ce9c0";ctx.beginPath();ctx.arc(r*.2,-r*.08,Math.max(4,r*.12),0,Math.PI*2);ctx.fill();
    }else if(this.kind===1){
      ctx.strokeStyle="#0b0818";ctx.lineWidth=5;ctx.fillStyle="#40205b";for(let i=0;i<5;i++){ctx.save();ctx.rotate(i/5*Math.PI*2);polygonPath(ctx,[[0,-r*.2],[r*.36,-r*.92],[r*.58,-r*.52],[r*.28,-r*.08]]);ctx.fill();ctx.stroke();ctx.restore();}ctx.fillStyle="#ff617e";ctx.beginPath();ctx.arc(0,0,r*.3,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#ffd94e";ctx.beginPath();ctx.arc(0,0,r*.11,0,Math.PI*2);ctx.fill();
    }else{
      ctx.strokeStyle="#090716";ctx.lineWidth=5;ctx.fillStyle="#172c3d";ctx.beginPath();ctx.arc(0,0,r*.8,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle="#55e7ff";ctx.lineWidth=4;ctx.setLineDash([7,8]);ctx.beginPath();ctx.arc(0,0,r*.58,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="#ffd94e";polygonPath(ctx,[[0,-r*.72],[r*.18,-r*.18],[r*.72,0],[r*.18,r*.18],[0,r*.72],[-r*.18,r*.18],[-r*.72,0],[-r*.18,-r*.18]]);ctx.fill();ctx.stroke();
    }
    ctx.restore();
  }
}

function circleHitObstacle(x,y,r,obstacles){
  for (const o of obstacles){
    const d = U.dist(x,y,o.x,o.y);
    if (d < r + o.radius) return o;
  }
  return null;
}

/* ============================== 武器システム ============================== */
/* 各武器は type, level を持ち、update() で発射管理する */
const WEAPON_DEFS = {
  normal:  { name:"通常弾", icon:"●", color:"#ffd447" },
  pierce:  { name:"貫通弾", icon:"➤", color:"#65d9ff" },
  blade:   { name:"旋回ブレード", icon:"✦", color:"#ff5268" },
  lightning:{name:"雷攻撃", icon:"⚡", color:"#b45cff" },
  explosion:{name:"範囲爆発", icon:"◉", color:"#ff8a4c" },
  laser:   { name:"レーザー", icon:"▮", color:"#42e8bd" },
};

/* ============================== 永続スキルツリー ============================== */
const SKILL_BRANCHES = [
  {id:"core",name:"クロマ・コア",icon:"◇",color:"#ffd94e",desc:"全系統へ接続する基礎回路",focus:{x:630,y:410}},
  {id:"arsenal",name:"プリズム兵装",icon:"➤",color:"#ff5b83",desc:"弾・貫通・クリティカル・多重発射",focus:{x:235,y:215}},
  {id:"resonance",name:"深淵共鳴",icon:"◉",color:"#bd70ff",desc:"オーラ・雷・爆発・連続撃破",focus:{x:1025,y:215}},
  {id:"survival",name:"位相防壁",icon:"⬢",color:"#58e8b9",desc:"HP・防御・修復・復活",focus:{x:235,y:625}},
  {id:"expedition",name:"航行解析",icon:"◎",color:"#62d8ff",desc:"移動・成長・選択肢・報酬",focus:{x:1025,y:625}}
];

const SKILL_NODES = [
  {id:"core_awakening",branch:"core",name:"覚醒核",icon:"◇",type:"origin",x:630,y:410,max:1,costs:[0],requires:[],desc:"星座盤の中心。すべての回路はここから分岐する。",effect:r=>r?"星座盤オンライン":"未起動"},
  {id:"core_output",branch:"core",name:"基礎出力",icon:"◆",type:"minor",x:630,y:300,max:3,costs:[1,2,3],requires:[{id:"core_awakening",rank:1}],desc:"全攻撃の最終出力を少しずつ高める。",effect:r=>`全ダメージ +${r*3}%`},
  {id:"core_cycle",branch:"core",name:"循環速度",icon:"⏱",type:"minor",x:740,y:410,max:3,costs:[1,2,3],requires:[{id:"core_awakening",rank:1}],desc:"全武器の攻撃サイクルを高速化する。",effect:r=>`攻撃速度 +${fmtEffectNumber(r*2.5)}%`},
  {id:"core_frame",branch:"core",name:"基幹フレーム",icon:"♥",type:"minor",x:630,y:520,max:3,costs:[1,2,3],requires:[{id:"core_awakening",rank:1}],desc:"最大HPを増やし、長いランの安定性を上げる。",effect:r=>`最大HP +${r*8}`},
  {id:"core_vector",branch:"core",name:"姿勢制御",icon:"↗",type:"minor",x:520,y:410,max:3,costs:[1,2,3],requires:[{id:"core_awakening",rank:1}],desc:"移動速度と回避の余裕を増やす。",effect:r=>`移動速度 +${r*3}%`},

  {id:"projectile_focus",branch:"arsenal",name:"射出焦点",icon:"●",type:"minor",x:420,y:285,max:5,costs:[2,2,3,4,5],requires:[{id:"core_output",rank:1}],desc:"通常弾と貫通弾のダメージを増幅する。",effect:r=>`投射物ダメージ +${r*5}%`},
  {id:"cycle_accelerator",branch:"arsenal",name:"加速薬室",icon:"⏩",type:"minor",x:315,y:210,max:3,costs:[3,4,5],requires:[{id:"projectile_focus",rank:2}],desc:"攻撃間隔を短縮し、投射物の飛翔速度も高める。",effect:r=>`攻撃速度 +${r*4}% / 弾速 +${r*8}%`},
  {id:"mass_driver",branch:"arsenal",name:"質量投射器",icon:"⬤",type:"minor",x:315,y:350,max:3,costs:[3,4,5],requires:[{id:"projectile_focus",rank:2}],desc:"弾体を大型化し、命中しやすくする。",effect:r=>`弾サイズ +${r*8}%`},
  {id:"piercing_matrix",branch:"arsenal",name:"貫通行列",icon:"➤",type:"notable",x:205,y:145,max:3,costs:[5,7,9],requires:[{id:"cycle_accelerator",rank:1}],desc:"球が敵を通り抜けられる回数を増やす。",effect:r=>`球貫通 +${r}`},
  {id:"precision_lens",branch:"arsenal",name:"臨界レンズ",icon:"✹",type:"notable",x:190,y:275,max:4,costs:[4,5,6,7],requires:[{id:"projectile_focus",rank:3}],desc:"クリティカル率と倍率を同時に伸ばす。",effect:r=>`クリ率 +${r*2}% / クリ倍率 +${fmtEffectNumber(r*.06)}`},
  {id:"burst_chamber",branch:"arsenal",name:"分裂薬室",icon:"●●",type:"notable",x:205,y:405,max:2,costs:[8,12],requires:[{id:"mass_driver",rank:2}],desc:"通常弾の発射数を恒久的に増やす。",effect:r=>`通常弾 +${r}球`},
  {id:"scatter_doctrine",branch:"arsenal",name:"散開教義",icon:"✣",type:"keystone",x:82,y:250,max:1,costs:[13],requires:[{id:"precision_lens",rank:2},{id:"burst_chamber",rank:1}],branchReq:8,exclusive:"arsenal_doctrine",desc:"弾数を大幅に増やす代わりに、1発の重さを落とす。",effect:r=>r?"通常弾 +2 / 投射物ダメージ ×0.72 / 弾サイズ ×0.90":"未選択",tradeoff:true},
  {id:"singularity_doctrine",branch:"arsenal",name:"特異点教義",icon:"◉",type:"keystone",x:82,y:375,max:1,costs:[13],requires:[{id:"piercing_matrix",rank:2},{id:"precision_lens",rank:2}],branchReq:8,exclusive:"arsenal_doctrine",desc:"発射速度を犠牲に、弾を巨大で重い一撃へ変える。",effect:r=>r?"投射物ダメージ ×1.45 / 攻撃速度 ×0.88 / 弾サイズ ×1.18":"未選択",tradeoff:true},
  {id:"prism_apotheosis",branch:"arsenal",name:"プリズム反響",icon:"✦",type:"mastery",x:82,y:105,max:1,costs:[18],requires:[{id:"piercing_matrix",rank:2},{id:"precision_lens",rank:3}],branchReq:13,desc:"投射物が一定確率で弱い反響弾を追加発射する。",effect:r=>r?"20%で反響弾（65%ダメージ）":"未取得"},

  {id:"aura_conductor",branch:"resonance",name:"共鳴導体",icon:"◎",type:"minor",x:840,y:285,max:5,costs:[2,2,3,4,5],requires:[{id:"core_output",rank:1}],desc:"常時オーラの毎秒ダメージを増やす。",effect:r=>`オーラ毎秒 +${fmtEffectNumber(r*1.6)}`},
  {id:"field_geometry",branch:"resonance",name:"場の幾何学",icon:"◌",type:"minor",x:945,y:210,max:4,costs:[3,4,5,6],requires:[{id:"aura_conductor",rank:2}],desc:"オーラの有効半径を広げる。",effect:r=>`オーラ半径 +${r*14}`},
  {id:"volatile_resonance",branch:"resonance",name:"爆裂共鳴",icon:"✺",type:"minor",x:945,y:350,max:4,costs:[3,4,5,6],requires:[{id:"aura_conductor",rank:2}],desc:"爆発攻撃と撃破爆発の威力を増幅する。",effect:r=>`爆発ダメージ +${r*8}%`},
  {id:"lightning_lattice",branch:"resonance",name:"雷鎖格子",icon:"⚡",type:"notable",x:1055,y:145,max:3,costs:[5,7,9],requires:[{id:"field_geometry",rank:2}],desc:"雷攻撃が追加の敵へ連鎖する。",effect:r=>`雷連鎖 +${r}`},
  {id:"blast_matrix",branch:"resonance",name:"衝撃波行列",icon:"◉",type:"notable",x:1070,y:275,max:3,costs:[5,6,8],requires:[{id:"volatile_resonance",rank:2}],desc:"範囲爆発と撃破爆発を大型化する。",effect:r=>`爆発半径 +${r*10}%`},
  {id:"overdrive_protocol",branch:"resonance",name:"過駆動律",icon:"✦",type:"notable",x:1055,y:405,max:3,costs:[5,7,9],requires:[{id:"aura_conductor",rank:3}],desc:"スーパーモードを早く発動し、持続させる。",effect:r=>`必要連続撃破 -${r*2} / 持続 +${fmtEffectNumber(r*.6)}秒`},
  {id:"expanding_field",branch:"resonance",name:"膨張場",icon:"◯",type:"keystone",x:1178,y:250,max:1,costs:[13],requires:[{id:"field_geometry",rank:3},{id:"lightning_lattice",rank:1}],branchReq:8,exclusive:"resonance_doctrine",desc:"広大な制圧範囲を得る代わりに、オーラ単体の威力を落とす。",effect:r=>r?"オーラ半径 ×1.50 / オーラダメージ ×0.70":"未選択",tradeoff:true},
  {id:"compression_field",branch:"resonance",name:"圧縮場",icon:"●",type:"keystone",x:1178,y:375,max:1,costs:[13],requires:[{id:"volatile_resonance",rank:3},{id:"blast_matrix",rank:1}],branchReq:8,exclusive:"resonance_doctrine",desc:"近距離へ圧縮し、オーラを高火力化する。",effect:r=>r?"オーラ半径 ×0.75 / オーラダメージ ×1.75":"未選択",tradeoff:true},
  {id:"resonance_collapse",branch:"resonance",name:"共鳴崩壊",icon:"☄",type:"mastery",x:1178,y:105,max:1,costs:[18],requires:[{id:"lightning_lattice",rank:2},{id:"blast_matrix",rank:2}],branchReq:13,desc:"撃破時に起きる連鎖爆発をさらに強化する。",effect:r=>r?"撃破爆発：威力 ×1.45 / 半径 ×1.25":"未取得"},

  {id:"hull_plating",branch:"survival",name:"多層外殻",icon:"♥",type:"minor",x:420,y:545,max:5,costs:[2,2,3,4,5],requires:[{id:"core_frame",rank:1}],desc:"最大HPを恒久的に増やす。",effect:r=>`最大HP +${r*12}`},
  {id:"phase_armor",branch:"survival",name:"位相装甲",icon:"🛡",type:"minor",x:315,y:500,max:4,costs:[3,4,5,6],requires:[{id:"hull_plating",rank:2}],desc:"受けるダメージを割合で軽減する。",effect:r=>`被ダメージ -${r*2}%`},
  {id:"nanite_repair",branch:"survival",name:"ナノ修復",icon:"♻",type:"minor",x:315,y:640,max:4,costs:[3,4,5,6],requires:[{id:"hull_plating",rank:2}],desc:"戦闘中にHPを自動回復する。",effect:r=>`毎秒HP +${fmtEffectNumber(r*.3)}`},
  {id:"temporal_guard",branch:"survival",name:"時間防護",icon:"◌",type:"notable",x:205,y:470,max:3,costs:[5,7,9],requires:[{id:"phase_armor",rank:2}],desc:"被弾後の無敵時間を延長する。",effect:r=>`被弾無敵 +${fmtEffectNumber(r*.11)}秒`},
  {id:"emergency_thrusters",branch:"survival",name:"緊急推進",icon:"↯",type:"notable",x:190,y:595,max:3,costs:[5,6,8],requires:[{id:"phase_armor",rank:1},{id:"nanite_repair",rank:1}],desc:"HP25%以下で速度と防御を得る。",effect:r=>`瀕死時：速度 +${r*10}% / 追加軽減 ${r*4}%`},
  {id:"phoenix_protocol",branch:"survival",name:"再起動プロトコル",icon:"☀",type:"notable",x:205,y:720,max:1,costs:[14],requires:[{id:"nanite_repair",rank:3},{id:"temporal_guard",rank:1}],desc:"HPが0になった時、一度だけ35%まで復帰する。",effect:r=>r?"1ランにつき復活1回":"未取得"},
  {id:"glass_core",branch:"survival",name:"硝子核",icon:"◇",type:"keystone",x:82,y:540,max:1,costs:[13],requires:[{id:"emergency_thrusters",rank:2}],branchReq:8,exclusive:"survival_doctrine",desc:"最大HPを捨て、全攻撃を大幅に高める。",effect:r=>r?"全ダメージ ×1.35 / 最大HP ×0.68":"未選択",tradeoff:true},
  {id:"fortress_core",branch:"survival",name:"要塞核",icon:"⬢",type:"keystone",x:82,y:665,max:1,costs:[13],requires:[{id:"phase_armor",rank:3},{id:"nanite_repair",rank:2}],branchReq:8,exclusive:"survival_doctrine",desc:"機動力を落とし、巨大な耐久力へ変換する。",effect:r=>r?"最大HP ×1.45 / 移動速度 ×0.85 / 追加軽減 5%":"未選択",tradeoff:true},
  {id:"immortal_circuit",branch:"survival",name:"不滅回路",icon:"∞",type:"mastery",x:82,y:785,max:1,costs:[18],requires:[{id:"phoenix_protocol",rank:1},{id:"emergency_thrusters",rank:2}],branchReq:13,desc:"復活後、そのラン中は出力と移動速度が上昇する。",effect:r=>r?"復活後：全ダメージ ×1.25 / 移動速度 ×1.20":"未取得"},

  {id:"vector_drive",branch:"expedition",name:"ベクタードライブ",icon:"↗",type:"minor",x:840,y:545,max:5,costs:[2,2,3,4,5],requires:[{id:"core_vector",rank:1}],desc:"基本移動速度を高める。",effect:r=>`移動速度 +${r*4}%`},
  {id:"collector_field",branch:"expedition",name:"収集磁場",icon:"◎",type:"minor",x:945,y:500,max:4,costs:[3,4,5,6],requires:[{id:"vector_drive",rank:2}],desc:"経験値ジェムとアイテムの回収範囲を広げる。",effect:r=>`回収範囲 +${r*18}`},
  {id:"growth_protocol",branch:"expedition",name:"成長解析",icon:"▦",type:"minor",x:945,y:640,max:5,costs:[3,4,5,6,7],requires:[{id:"vector_drive",rank:2}],desc:"取得経験値を増やし、ラン内成長を加速する。",effect:r=>`経験値 +${r*4}%`},
  {id:"opening_hand",branch:"expedition",name:"先行適応",icon:"★",type:"notable",x:1055,y:470,max:2,costs:[7,11],requires:[{id:"collector_field",rank:2}],desc:"ラン開始時に追加アップグレードを選ぶ。",effect:r=>`開始時強化選択 +${r}`},
  {id:"choice_expansion",branch:"expedition",name:"選択領域",icon:"▤",type:"notable",x:1070,y:595,max:1,costs:[12],requires:[{id:"collector_field",rank:2},{id:"growth_protocol",rank:2}],desc:"レベルアップ時に提示される候補を増やす。",effect:r=>r?"強化候補 3 → 4":"未取得"},
  {id:"abyss_harvest",branch:"expedition",name:"深淵採取",icon:"◇",type:"notable",x:1055,y:720,max:4,costs:[5,6,7,8],requires:[{id:"growth_protocol",rank:3}],desc:"ラン終了時に獲得する深淵片を増やす。",effect:r=>`深淵片 +${r*8}%`},
  {id:"swift_route",branch:"expedition",name:"疾走航路",icon:"↯",type:"keystone",x:1178,y:540,max:1,costs:[13],requires:[{id:"opening_hand",rank:1},{id:"choice_expansion",rank:1}],branchReq:8,exclusive:"expedition_doctrine",desc:"成長速度を優先し、持ち帰る資源を少し減らす。",effect:r=>r?"経験値 ×1.20 / 深淵片 ×0.85":"未選択",tradeoff:true},
  {id:"treasure_route",branch:"expedition",name:"採掘航路",icon:"◇",type:"keystone",x:1178,y:665,max:1,costs:[13],requires:[{id:"abyss_harvest",rank:2}],branchReq:8,exclusive:"expedition_doctrine",desc:"経験値効率を少し落とし、深淵片の回収へ特化する。",effect:r=>r?"深淵片 ×1.25 / 経験値 ×0.90":"未選択",tradeoff:true},
  {id:"navigator_mastery",branch:"expedition",name:"航行者の特権",icon:"✧",type:"mastery",x:1178,y:785,max:1,costs:[18],requires:[{id:"opening_hand",rank:1},{id:"abyss_harvest",rank:2}],branchReq:13,desc:"各ランをランダムな追加武器1つとともに開始する。",effect:r=>r?"開始時ランダム武器 +1":"未取得"}
];

const SKILL_LOOKUP = Object.fromEntries(SKILL_NODES.map(node=>[node.id,{...node,branchName:SKILL_BRANCHES.find(b=>b.id===node.branch)?.name||"",branchColor:SKILL_BRANCHES.find(b=>b.id===node.branch)?.color||"#fff"}]));
const LEGACY_SKILL_MAP={prism_power:"core_output",rapid_cycle:"core_cycle",critical_lens:"precision_lens",piercing_law:"piercing_matrix",overdrive:"overdrive_protocol",vital_shell:"hull_plating",armor_weave:"phase_armor",regeneration:"nanite_repair",phase_guard:"temporal_guard",phoenix_protocol:"phoenix_protocol",vector_drive:"vector_drive",magnetic_reach:"collector_field",chroma_study:"growth_protocol",void_harvest:"abyss_harvest",pre_adaptation:"opening_hand"};
function safeSkillRanks(ranks){return ranks&&typeof ranks==="object"&&!Array.isArray(ranks)?ranks:{}}
function normalizeSkillTree(ranks){const raw=safeSkillRanks(ranks),next={};for(const [id,val] of Object.entries(raw)){const mapped=SKILL_LOOKUP[id]?id:LEGACY_SKILL_MAP[id];if(!mapped||!SKILL_LOOKUP[mapped])continue;next[mapped]=Math.max(next[mapped]||0,Math.floor(Number(val)||0));}for(const group of new Set(SKILL_NODES.map(s=>s.exclusive).filter(Boolean))){const owned=SKILL_NODES.filter(s=>s.exclusive===group&&next[s.id]>0);for(let i=1;i<owned.length;i++)delete next[owned[i].id];}next.core_awakening=1;return next}
function skillRank(ranks,id){if(id==="core_awakening")return 1;const raw=Math.max(0,Math.floor(Number(safeSkillRanks(ranks)[id])||0)),max=SKILL_LOOKUP[id]?.max??raw;return Math.min(raw,max)}
function skillCost(skill,nextRank){return skill.costs[Math.max(0,nextRank-1)]??skill.costs[skill.costs.length-1]}
function skillInvestedCost(skill,rank){let total=0;for(let i=1;i<=Math.min(rank,skill.max);i++)total+=skillCost(skill,i);return total}
function allSkills(){return SKILL_NODES}
function branchSkillPoints(ranks,branchId){return SKILL_NODES.filter(s=>s.branch===branchId&&s.id!=="core_awakening").reduce((sum,s)=>sum+skillRank(ranks,s.id),0)}
function totalSkillPoints(ranks){return SKILL_NODES.reduce((sum,s)=>sum+(s.id==="core_awakening"?0:skillRank(ranks,s.id)),0)}


class Weapon{
  constructor(type){
    this.type = type;
    this.level = 1;
    this.tier = 1;  // 進化段階 I→II→III
    this.cd = 0;
    this.spinAngle = 0;
    this.laserActiveTime = 0;
    this.laserTargetAngle = 0;
    this.laserTickTimer = 0;
    this.pendingExplosion = null;
    this.hitTimers = new Map(); // 旋回ブレード用の再ヒット管理
    this.fusionPartner = null;  // 融合パートナー武器
  }
  
  evolve(){
    if (this.tier < 3){
      this.tier++;
      this.level = 1;  // tier上昇時にレベルリセット
      return true;
    }
    return false;
  }
}

function nearestEnemy(x, y, enemies, maxDist){
  let best=null, bd=maxDist?maxDist*maxDist:Infinity;
  for (const e of enemies){
    if (e.dead) continue;
    const d2 = U.dist2(x,y,e.x,e.y);
    if (d2 < bd){ bd=d2; best=e; }
  }
  return best;
}

/* ============================== プレイヤー ============================== */
class Player{
  constructor(metaSkillRanks){
    this.metaSkills=normalizeSkillTree(metaSkillRanks);const mr=(id)=>skillRank(this.metaSkills,id);
    const glass=mr("glass_core")>0,fortress=mr("fortress_core")>0,scatter=mr("scatter_doctrine")>0,singularity=mr("singularity_doctrine")>0,expand=mr("expanding_field")>0,compress=mr("compression_field")>0,swift=mr("swift_route")>0,treasure=mr("treasure_route")>0;
    this.x=CONFIG.MAP_W/2;this.y=CONFIG.MAP_H/2;this.radius=16;
    const hpBase=120+mr("core_frame")*8+mr("hull_plating")*12;this.maxHp=Math.round(hpBase*(glass?.68:fortress?1.45:1));this.hp=this.maxHp;
    this.speed=250*(1+mr("core_vector")*.03+mr("vector_drive")*.04)*(fortress?.85:1);this.atk=12;
    this.atkSpeedMul=(1+mr("core_cycle")*.025+mr("cycle_accelerator")*.04)*(singularity?.88:1);this.bulletSpeedMul=1+mr("cycle_accelerator")*.08;
    this.bulletSizeMul=(1+mr("mass_driver")*.08)*(scatter?.9:singularity?1.18:1);this.pierceBonus=mr("piercing_matrix");this.pickupRange=90+mr("collector_field")*18;
    this.level=1;this.exp=0;this.expToNext=CONFIG.EXP_BASE;this.expGainMul=(1+mr("growth_protocol")*.04)*(swift?1.2:treasure?.9:1);
    this.invTimer=0;this.invDuration=.9+mr("temporal_guard")*.11;this.flashTimer=0;this.damageReduction=mr("phase_armor")*.02+(fortress?.05:0);
    this.critChance=.05+mr("precision_lens")*.02;this.critMult=1.6+mr("precision_lens")*.06;this.hpRegen=mr("nanite_repair")*.3;this.regenAcc=0;this.lifestealChance=0;
    this.weapons=[new Weapon("normal")];this.multishot=mr("burst_chamber")+(scatter?2:0);this.facing={x:1,y:0};
    this.atkBuffTimer=0;this.spdBuffTimer=0;this.invBuffTimer=0;this.kills=0;this.killStreak=0;this.superModeTimer=0;
    this.superModeThreshold=Math.max(10,CONFIG.SUPERMODE_THRESHOLD-mr("overdrive_protocol")*2);this.superModeDuration=CONFIG.SUPERMODE_DURATION+mr("overdrive_protocol")*.6;this.score=0;
    const auraRadiusBase=CONFIG.AURA_RADIUS_BASE+mr("field_geometry")*14,auraDamageBase=CONFIG.AURA_DAMAGE_BASE+mr("aura_conductor")*1.6;
    this.auraRadius=auraRadiusBase*(expand?1.5:compress?.75:1);this.auraDamage=auraDamageBase*(expand?.7:compress?1.75:1);this.auraTickTimer=0;
    this.comboMultiplier=1;this.damageAmp=(1+mr("core_output")*.03)*(glass?1.35:1);this.projectileDamageMul=(1+mr("projectile_focus")*.05)*(scatter?.72:singularity?1.45:1);
    this.projectileEchoChance=mr("prism_apotheosis")?.2:0;this.lightningChainBonus=mr("lightning_lattice");this.explosionRadiusMul=1+mr("blast_matrix")*.10;this.explosionDamageMul=1+mr("volatile_resonance")*.08;
    this.deathExplosionDamageMul=(1+mr("volatile_resonance")*.08)*(mr("resonance_collapse")?1.45:1);this.deathExplosionRadiusMul=(1+mr("blast_matrix")*.10)*(mr("resonance_collapse")?1.25:1);
    this.lowHealthSpeedBonus=mr("emergency_thrusters")*.10;this.lowHealthReduction=mr("emergency_thrusters")*.04;
    this.upgradeRanks={};this.reviveCharges=mr("phoenix_protocol");this.reviveEmpower=mr("immortal_circuit")>0;this.startBonusChoices=mr("opening_hand");this.levelUpChoiceBonus=mr("choice_expansion");this.startRandomWeapon=mr("navigator_mastery")>0;
    this.shardGainMul=(1+mr("abyss_harvest")*.08)*(swift?.85:treasure?1.25:1);
    this.animT=0;this.bank=0;this.thrust=0;this.trail=[];this.trailTimer=0;this.lastMove={x:0,y:0};
  }
  get effAtkMul(){return(this.atkBuffTimer>0?2:1)*(this.superModeTimer>0?CONFIG.SUPERMODE_MULTIPLIER:1)}
  get effSpeed(){const low=this.hp/Math.max(1,this.maxHp)<=.25?1+this.lowHealthSpeedBonus:1;return this.speed*low*(this.spdBuffTimer>0?1.6:1)*(this.superModeTimer>0?CONFIG.SUPERMODE_MULTIPLIER:1)}
  get invincible(){return this.invTimer>0||this.invBuffTimer>0}
  update(dt,input,obstacles,game){
    this.animT+=dt;const axis=input.getAxis();if(axis.x||axis.y)this.facing=axis;
    const ox=this.x,oy=this.y;let nx=this.x+axis.x*this.effSpeed*dt,ny=this.y+axis.y*this.effSpeed*dt;
    if(!circleHitObstacle(nx,this.y,this.radius,obstacles))this.x=nx;if(!circleHitObstacle(this.x,ny,this.radius,obstacles))this.y=ny;
    this.x=U.clamp(this.x,this.radius,CONFIG.MAP_W-this.radius);this.y=U.clamp(this.y,this.radius,CONFIG.MAP_H-this.radius);
    const moved=Math.hypot(this.x-ox,this.y-oy)/Math.max(dt,.001);this.thrust=U.lerp(this.thrust,moved>10?1:0,Math.min(1,dt*10));
    const targetBank=(axis.x||axis.y)?Math.sin(this.animT*9)*.08:0;this.bank=U.lerp(this.bank,targetBank,Math.min(1,dt*8));
    this.trailTimer-=dt;if(moved>20&&this.trailTimer<=0){this.trailTimer=.035;this.trail.push({x:this.x,y:this.y,ang:Math.atan2(this.facing.y,this.facing.x),life:.28,maxLife:.28});}
    for(const q of this.trail)q.life-=dt;this.trail=this.trail.filter(q=>q.life>0).slice(-12);
    if(this.invTimer>0)this.invTimer-=dt;if(this.flashTimer>0)this.flashTimer-=dt;if(this.atkBuffTimer>0)this.atkBuffTimer-=dt;if(this.spdBuffTimer>0)this.spdBuffTimer-=dt;if(this.invBuffTimer>0)this.invBuffTimer-=dt;if(this.superModeTimer>0)this.superModeTimer-=dt;
    if(this.hpRegen>0){this.regenAcc+=this.hpRegen*dt;if(this.regenAcc>=1){const heal=Math.floor(this.regenAcc);this.hp=Math.min(this.maxHp,this.hp+heal);this.regenAcc-=heal;}}
    this.auraTickTimer-=dt;if(this.auraDamage>0&&this.auraTickTimer<=0){const tick=.2;this.auraTickTimer+=tick;const dmg=Math.max(1,Math.round(this.auraDamage*tick*this.damageAmp));for(const e of game.enemies){if(!e.dead&&U.dist2(this.x,this.y,e.x,e.y)<Math.pow(this.auraRadius+e.radius,2))game.damageEnemy(e,dmg,false)}if(game.boss&&!game.boss.dead&&U.dist2(this.x,this.y,game.boss.x,game.boss.y)<Math.pow(this.auraRadius+game.boss.radius,2))game.damageBoss(dmg,false);}
  }
  gainExp(v){this.exp+=v*this.expGainMul;while(this.exp>=this.expToNext){this.exp-=this.expToNext;this.level++;this.expToNext=Math.floor(CONFIG.EXP_BASE*Math.pow(CONFIG.EXP_GROWTH,this.level-1));window.dispatchEvent(new CustomEvent("player-levelup"));}}
  takeDamage(amount,game){if(this.invincible)return;const low=this.hp/Math.max(1,this.maxHp)<=.25?this.lowHealthReduction:0;let dmg=Math.max(1,Math.round(amount*(1-U.clamp(this.damageReduction+low,0,.72))));this.hp-=dmg;if(game.damageTexts.length>=CONFIG.MAX_DAMAGE_TEXTS)game.damageTexts.shift();game.damageTexts.push(new DamageText(this.x,this.y-this.radius-8,`-${dmg}`,"#ff617e",false));this.invTimer=this.invDuration;this.flashTimer=.5;game.sound.damaged();game.shake(12,.3);game.addEffect(new ShockwaveEffect(this.x,this.y,"#ff617e",70,.28,{inner:12}));spawnParticles(game.particles,this.x,this.y,14,"#ff617e",190,.5,5);if(this.hp<=0){if(this.reviveCharges>0){this.reviveCharges--;this.hp=Math.max(1,Math.round(this.maxHp*.35));this.invBuffTimer=3;if(this.reviveEmpower){this.damageAmp*=1.25;this.speed*=1.2;}game.sound.levelUp();game.addEffect(new ShockwaveEffect(this.x,this.y,"#ffd94e",240,.9,{inner:20,fill:true}));spawnParticles(game.particles,this.x,this.y,70,"#ffd94e",360,1.1,9);game.showSystemToast("☀","再起動プロトコル発動","致命的損傷から機体を再構成した。",this.reviveEmpower?`HP ${this.hp}/${this.maxHp}｜3秒無敵｜不滅回路で出力上昇`:`HP ${this.hp}/${this.maxHp}｜3秒無敵`,"#ffd94e");}else{this.hp=0;game.onPlayerDeath();}}}
  applyItem(type){switch(type){case"heal":this.hp=Math.min(this.maxHp,this.hp+Math.round(this.maxHp*.35));break;case"atkup":this.atkBuffTimer=8;break;case"spdup":this.spdBuffTimer=8;break;case"invincible":this.invBuffTimer=5;break;case"magnet":window.dispatchEvent(new CustomEvent("collect-all-exp"));break;case"nuke":window.dispatchEvent(new CustomEvent("nuke-screen"));break;}window.dispatchEvent(new CustomEvent("item-pickup",{detail:{type}}));}
  getWeapon(type){return this.weapons.find(w=>w.type===type)}hasWeapon(type){return!!this.getWeapon(type)}
  draw(ctx,cam){
    const px=this.x-cam.x,py=this.y-cam.y,ang=Math.atan2(this.facing.y||0,this.facing.x||1);const blinking=this.invTimer>0&&Math.floor(this.invTimer*16)%2===0;const flashing=this.flashTimer>0&&Math.floor(this.flashTimer*20)%2===0;
    for(const q of this.trail){const a=q.life/q.maxLife;ctx.save();ctx.translate(q.x-cam.x,q.y-cam.y);ctx.rotate(q.ang);ctx.globalAlpha=a*.22;ctx.globalCompositeOperation="source-over";ctx.fillStyle=this.superModeTimer>0?"#ff617e":"#48ecc1";polygonPath(ctx,[[20,0],[-9,9],[-3,0],[-9,-9]]);ctx.fill();ctx.restore();}
    ctx.save();ctx.translate(px,py);
    if(this.auraRadius>CONFIG.AURA_RADIUS_BASE){const pulse=1+Math.sin(this.animT*4)*.025;ctx.globalCompositeOperation="source-over";const g=ctx.createRadialGradient(0,0,this.auraRadius*.15,0,0,this.auraRadius*pulse);g.addColorStop(0,"rgba(72,236,193,0)");g.addColorStop(.72,"rgba(72,236,193,.04)");g.addColorStop(1,"rgba(255,217,78,.18)");ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,this.auraRadius*pulse,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(255,217,78,.42)";ctx.lineWidth=2;ctx.setLineDash([5,12]);ctx.lineDashOffset=-this.animT*30;ctx.beginPath();ctx.arc(0,0,this.auraRadius*pulse,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.globalCompositeOperation="source-over";}
    ctx.fillStyle="rgba(0,0,0,.42)";ctx.beginPath();ctx.ellipse(4,18,25,9,0,0,Math.PI*2);ctx.fill();
    ctx.rotate(ang+this.bank);if(blinking)ctx.globalAlpha=.35;
    // twin engine flames
    const flame=14+this.thrust*12+Math.sin(this.animT*34)*3;ctx.save();ctx.globalCompositeOperation="source-over";for(const yy of[-8,8]){const grad=ctx.createLinearGradient(-12,yy,-12-flame,yy);grad.addColorStop(0,"rgba(255,255,225,.95)");grad.addColorStop(.35,"rgba(72,236,193,.8)");grad.addColorStop(1,"rgba(81,100,255,0)");ctx.fillStyle=grad;polygonPath(ctx,[[-9,yy-3],[-12-flame,yy],[-9,yy+3]]);ctx.fill();}ctx.restore();
    const body=flashing?"#ffffff":this.invBuffTimer>0?"#ffd94e":this.superModeTimer>0?"#ff617e":"#48ecc1";
    ctx.lineJoin="round";ctx.strokeStyle="#090718";ctx.lineWidth=4;ctx.shadowColor=body;ctx.shadowBlur=0;
    ctx.fillStyle="#5868ff";polygonPath(ctx,[[-2,-4],[-25,-19],[-18,-3],[-25,19],[-2,5]]);ctx.fill();ctx.stroke();
    ctx.fillStyle=body;polygonPath(ctx,[[26,0],[5,15],[-12,12],[-4,0],[-12,-12],[5,-15]]);ctx.fill();ctx.stroke();
    ctx.fillStyle="#2d2159";polygonPath(ctx,[[10,-11],[24,0],[10,2],[-1,-1]]);ctx.fill();
    ctx.fillStyle="#fff7dc";polygonPath(ctx,[[9,-7],[18,0],[8,7],[-2,0]]);ctx.fill();ctx.stroke();
    ctx.fillStyle="#ffd94e";ctx.beginPath();ctx.arc(5,0,4+Math.sin(this.animT*7),0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#ff617e";ctx.fillRect(-17,-4,9,8);ctx.strokeRect(-17,-4,9,8);
    // animated winglets
    ctx.fillStyle="#65dcff";for(const sy of[-1,1]){polygonPath(ctx,[[-2,sy*8],[-15,sy*(14+this.thrust*3)],[-8,sy*5]]);ctx.fill();ctx.stroke();}
    if(this.superModeTimer>0){ctx.globalCompositeOperation="source-over";ctx.strokeStyle="#ffd94e";ctx.lineWidth=3;ctx.rotate(-ang-this.bank+this.animT*2.5);ctx.beginPath();ctx.arc(0,0,34,0,Math.PI*1.6);ctx.stroke();drawRingTicks(ctx,34,8,6,this.animT);}
    ctx.restore();
    const w=48,h=6;ctx.fillStyle="rgba(5,4,13,.85)";ctx.fillRect(px-w/2,py-31,w,h);ctx.fillStyle=this.superModeTimer>0?"#ffd94e":"#ff617e";ctx.fillRect(px-w/2+1,py-30,(w-2)*(this.hp/this.maxHp),h-2);ctx.strokeStyle="#fff7dc";ctx.lineWidth=1;ctx.strokeRect(px-w/2,py-31,w,h);
  }
}

/* ============================== 敵 ============================== */
let ENEMY_UID=1;
class Enemy{
  constructor(type,x,y,scale){const base=ENEMY_BASE[type];this.uid=ENEMY_UID++;this.type=type;this.x=x;this.y=y;this.radius=base.radius;this.maxHp=Math.round(base.hp*scale.hp);this.hp=this.maxHp;this.speed=base.speed*scale.speed;this.atk=Math.round(base.atk*scale.atk);this.exp=base.exp;this.color=base.color;this.score=base.score;this.dead=false;this.hitFlash=0;this.contactCd=0;this.shootCd=U.rand(.4,1.2);this.avoidAngleOffset=U.rand(-.6,.6);if(type==="elite")this.radius*=1.6;this.animT=U.rand(0,10);this.facing=0;this.spawnAge=0;this.seed=Math.random()*10;}
  update(dt,player,enemies,obstacles,game){this.animT+=dt;this.spawnAge+=dt;if(this.hitFlash>0)this.hitFlash-=dt;if(this.contactCd>0)this.contactCd-=dt;const d=U.dist(this.x,this.y,player.x,player.y);let moveAng=U.angle(this.x,this.y,player.x,player.y);this.facing=moveAng;
    if(this.type==="ranged"){const desired=340;if(d<desired-30)moveAng+=Math.PI;else if(d<desired+30)moveAng+=Math.PI/2*(this.avoidAngleOffset>0?1:-1);this.shootCd-=dt;if(this.shootCd<=0&&d<700){this.shootCd=U.rand(1.6,2.4)/game.balanceMul.spawnMul;const ang=U.angle(this.x,this.y,player.x,player.y);game.enemyProjectiles.push(new EnemyProjectile(this.x,this.y,Math.cos(ang)*260,Math.sin(ang)*260,this.atk,7,"#ffd84f"));game.addEffect(new MuzzleEffect(this.x,this.y,ang,"#ffd84f",25));}}
    for(const o of obstacles){const od=U.dist(this.x,this.y,o.x,o.y);if(od<o.radius+this.radius+40){const away=U.angle(o.x,o.y,this.x,this.y);moveAng=moveAng*.5+away*.5;}}
    let sepX=0,sepY=0,sepCount=0;for(const other of enemies){if(other===this||other.dead)continue;const od2=U.dist2(this.x,this.y,other.x,other.y),minD=this.radius+other.radius+8;if(od2<minD*minD&&od2>.01){const od=Math.sqrt(od2);sepX+=(this.x-other.x)/od;sepY+=(this.y-other.y)/od;sepCount++;}}
    let mvx=Math.cos(moveAng),mvy=Math.sin(moveAng);if(sepCount>0){mvx+=sepX/sepCount*1.1;mvy+=sepY/sepCount*1.1;const len=Math.hypot(mvx,mvy)||1;mvx/=len;mvy/=len;}
    let nx=this.x+mvx*this.speed*dt,ny=this.y+mvy*this.speed*dt;if(!circleHitObstacle(nx,this.y,this.radius,obstacles))this.x=nx;if(!circleHitObstacle(this.x,ny,this.radius,obstacles))this.y=ny;this.x=U.clamp(this.x,this.radius,CONFIG.MAP_W-this.radius);this.y=U.clamp(this.y,this.radius,CONFIG.MAP_H-this.radius);
    if(d<this.radius+player.radius&&this.contactCd<=0){player.takeDamage(this.atk,game);this.contactCd=.6;}
  }
  onDeath(game){this.dead=true;game.sound.kill();spawnParticles(game.particles,this.x,this.y,this.type==="elite"?55:28,this.color,300,.85,this.type==="elite"?9:6);game.addEffect(new ShockwaveEffect(this.x,this.y,this.color,this.radius*3.4,.34,{inner:this.radius*.4,fill:true}));game.addEffect(new ImpactEffect(this.x,this.y,"#ffffff",this.radius*2,.28,0,this.type==="elite"));game.shake(this.type==="elite"?11:5,this.type==="elite"?.2:.1);game.triggerHitFlash();
    const explosionDamage=Math.max(2,Math.round(this.maxHp*CONFIG.EXPLOSION_DAMAGE_RATIO*(game.player?.deathExplosionDamageMul||1))),explosionRadius=this.radius*4*(game.player?.deathExplosionRadiusMul||1);game.explosions.push(new ExplosionArea(this.x,this.y,explosionRadius,explosionDamage,this.color));for(const e of game.enemies){if(!e.dead&&U.dist2(this.x,this.y,e.x,e.y)<Math.pow(explosionRadius+e.radius,2))game.damageEnemy(e,explosionDamage,false)}
    game.spawnExpGem(this.x,this.y,this.exp);game.damageTexts.push(new DamageText(this.x,this.y-this.radius-5,"+"+this.score,"#ffdf5b",false));game.player.kills++;game.player.killStreak++;game.player.score+=this.score;
    if(game.player.killStreak>=game.player.superModeThreshold){game.player.killStreak=0;game.player.superModeTimer=game.player.superModeDuration;game.sound.levelUp();game.addEffect(new ShockwaveEffect(game.player.x,game.player.y,"#ffd94e",190,.65,{inner:15,fill:true}));spawnParticles(game.particles,game.player.x,game.player.y,40,"#ff617e",300,.8,7);}
    let treasureChance=.04;if(this.type==="elite")treasureChance=.25;else if(this.type==="heavy")treasureChance=.12;else if(this.type==="ranged")treasureChance=.1;if(Math.random()<treasureChance){const treasure=new Treasure(this.x,this.y);treasure.game=game;treasure.bounceVel=300;game.treasures.push(treasure);}if(Math.random()<.09)game.items.push(new Item(this.x,this.y,U.choice(Object.keys(ITEM_TYPES))));
    if(this.type==="splitter"){for(let i=0;i<3;i++){const ang=i/3*Math.PI*2;game.enemies.push(new Enemy("splitmini",this.x+Math.cos(ang)*20,this.y+Math.sin(ang)*20,game.currentScale));}}
  }
  draw(ctx,cam){const x=this.x-cam.x,y=this.y-cam.y,r=this.radius,t=this.animT,flash=this.hitFlash>0,spawn=Math.min(1,this.spawnAge/.28);ctx.save();ctx.translate(x,y);ctx.scale(spawn,spawn);ctx.rotate(this.facing+Math.sin(t*2+this.seed)*.05);ctx.lineJoin="round";
    ctx.fillStyle="rgba(0,0,0,.38)";ctx.beginPath();ctx.ellipse(-2,r*.8,r*.95,r*.34,0,0,Math.PI*2);ctx.fill();ctx.shadowColor=this.color;ctx.shadowBlur=0;ctx.strokeStyle="#080614";ctx.lineWidth=Math.max(2,r*.14);const col=flash?"#ffffff":this.color;
    if(this.type==="normal"){
      ctx.fillStyle="#271334";const breathe=1+Math.sin(t*5+this.seed)*.06;ctx.scale(breathe,1/breathe);polygonPath(ctx,[[r*.95,0],[r*.45,r*.78],[-r*.35,r*.8],[-r*.9,r*.25],[-r*.75,-r*.55],[r*.1,-r*.9]]);ctx.fill();ctx.stroke();ctx.fillStyle=col;ctx.beginPath();ctx.arc(r*.12,0,r*.48,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#fff7dc";ctx.beginPath();ctx.ellipse(r*.3,-r*.04,r*.18,r*.26,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#171026";ctx.beginPath();ctx.arc(r*.35,-r*.03,r*.08,0,Math.PI*2);ctx.fill();
    }else if(this.type==="fast"){
      ctx.fillStyle="#123344";polygonPath(ctx,[[r*1.55,0],[-r*.45,r*.95],[-r*.12,r*.2],[-r*1.2,0],[-r*.12,-r*.2],[-r*.45,-r*.95]]);ctx.fill();ctx.stroke();ctx.fillStyle=col;polygonPath(ctx,[[r*1.2,0],[-r*.25,r*.45],[-r*.55,0],[-r*.25,-r*.45]]);ctx.fill();ctx.stroke();ctx.fillStyle="#fff";ctx.fillRect(r*.35,-r*.24,r*.22,r*.16);ctx.fillRect(r*.35,r*.08,r*.22,r*.16);ctx.globalCompositeOperation="source-over";ctx.fillStyle=rgba(col,.7);polygonPath(ctx,[[-r*.65,-r*.28],[-r*1.5,-r*.5],[-r*.65,-.05]]);ctx.fill();polygonPath(ctx,[[-r*.65,r*.28],[-r*1.5,r*.5],[-r*.65,.05]]);ctx.fill();
    }else if(this.type==="heavy"){
      ctx.rotate(-this.facing);ctx.fillStyle="#181632";polygonPath(ctx,[[-r,-r*.7],[-r*.55,-r],[r*.55,-r],[r,-r*.7],[r,r*.7],[r*.55,r],[-r*.55,r],[-r,r*.7]]);ctx.fill();ctx.stroke();ctx.fillStyle=col;ctx.fillRect(-r*.58,-r*.58,r*1.16,r*1.16);ctx.strokeRect(-r*.58,-r*.58,r*1.16,r*1.16);ctx.fillStyle="#242158";ctx.fillRect(-r*.85,-r*.42,r*.28,r*.84);ctx.fillRect(r*.57,-r*.42,r*.28,r*.84);ctx.fillStyle="#ffd94e";ctx.beginPath();ctx.arc(0,0,r*.22+Math.sin(t*4)*2,0,Math.PI*2);ctx.fill();ctx.stroke();const hp=1-this.hp/this.maxHp;ctx.strokeStyle="#ff617e";ctx.lineWidth=2;for(let i=0;i<Math.floor(hp*5);i++){ctx.beginPath();ctx.moveTo(-r*.3+i*4,-r*.55);ctx.lineTo(-r*.1+i*3,0);ctx.lineTo(-r*.35+i*5,r*.45);ctx.stroke();}
    }else if(this.type==="ranged"){
      ctx.rotate(-this.facing+t*.6);ctx.fillStyle="#342746";for(let i=0;i<6;i++){ctx.save();ctx.rotate(i/6*Math.PI*2);polygonPath(ctx,[[r*.2,-r*.18],[r*1.05,-r*.45],[r*.82,r*.18],[r*.2,r*.18]]);ctx.fill();ctx.stroke();ctx.restore();}ctx.fillStyle=col;ctx.beginPath();ctx.arc(0,0,r*.55,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#1a1430";ctx.beginPath();ctx.arc(0,0,r*.25,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(r*.08,0,r*.1,0,Math.PI*2);ctx.fill();
    }else if(this.type==="splitter"||this.type==="splitmini"){
      ctx.rotate(-this.facing);ctx.fillStyle=col;const lobes=this.type==="splitter"?7:5;ctx.beginPath();for(let i=0;i<=lobes;i++){const a=i/lobes*Math.PI*2,rr=r*(.78+.18*Math.sin(a*3+t*5+this.seed));const px=Math.cos(a)*rr,py=Math.sin(a)*rr;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle="#3b1739";for(let i=0;i<(this.type==="splitter"?3:1);i++){const a=t*(i%2?-.8:.7)+i*2.1;ctx.beginPath();ctx.arc(Math.cos(a)*r*.32,Math.sin(a)*r*.32,r*.16,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.fillStyle="#fff3d6";ctx.beginPath();ctx.arc(r*.18,-r*.08,r*.13,0,Math.PI*2);ctx.fill();
    }else if(this.type==="elite"){
      ctx.rotate(-this.facing+t*.18);ctx.globalCompositeOperation="source-over";ctx.strokeStyle=rgba(col,.55);ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r*1.18,0,Math.PI*2);ctx.stroke();drawRingTicks(ctx,r*1.18,10,r*.22,-t*.8);ctx.globalCompositeOperation="source-over";ctx.fillStyle="#21122e";polygonPath(ctx,[[0,-r],[r*.82,-r*.38],[r*.72,r*.65],[0,r],[-r*.72,r*.65],[-r*.82,-r*.38]]);ctx.fill();ctx.stroke();ctx.fillStyle=col;polygonPath(ctx,[[0,-r*.7],[r*.48,-r*.22],[r*.38,r*.5],[0,r*.72],[-r*.38,r*.5],[-r*.48,-r*.22]]);ctx.fill();ctx.stroke();ctx.fillStyle="#fff7dc";polygonPath(ctx,[[-r*.42,-r*.08],[-r*.08,-r*.25],[-r*.12,r*.05],[-r*.42,r*.12]]);ctx.fill();polygonPath(ctx,[[r*.42,-r*.08],[r*.08,-r*.25],[r*.12,r*.05],[r*.42,r*.12]]);ctx.fill();ctx.fillStyle="#ffd94e";ctx.beginPath();ctx.arc(0,r*.25,r*.13+Math.sin(t*5)*2,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
    if(this.hp<this.maxHp){const bw=Math.max(24,r*2.1),bh=this.type==="elite"?6:4;ctx.fillStyle="rgba(5,4,12,.8)";ctx.fillRect(x-bw/2,y-r-13,bw,bh);ctx.fillStyle=this.color;ctx.fillRect(x-bw/2+1,y-r-12,(bw-2)*Math.max(0,this.hp/this.maxHp),bh-2);}
  }
}

/* ============================== ボス ============================== */
class Boss{
  constructor(index,scale){this.x=0;this.y=0;this.radius=46;const hpMul=index===0?.85:1+(index-1)*.45,atkMul=index===0?.8:1+(index-1)*.3;this.maxHp=Math.round(1500*hpMul*scale.hp);this.hp=this.maxHp;this.atk=Math.round(24*atkMul*scale.atk);this.speed=70;this.dead=false;this.phase="idle";this.phaseTimer=U.rand(1.5,2.5);this.hitFlash=0;this.chargeDir={x:1,y:0};this.contactCd=0;this.index=index;this.name=["ヴォイド・ワーム","骨の玉座主","嵐喰らいの影","終焉の使者"][Math.min(index,3)];this.animT=0;this.facing=0;this.spawnAge=0;}
  update(dt,player,enemies,obstacles,game){this.animT+=dt;this.spawnAge+=dt;if(this.hitFlash>0)this.hitFlash-=dt;if(this.contactCd>0)this.contactCd-=dt;this.phaseTimer-=dt;const d=U.dist(this.x,this.y,player.x,player.y);this.facing=U.angle(this.x,this.y,player.x,player.y);
    switch(this.phase){case"idle":{const ang=this.facing;let nx=this.x+Math.cos(ang)*this.speed*dt,ny=this.y+Math.sin(ang)*this.speed*dt;if(!circleHitObstacle(nx,this.y,this.radius,obstacles))this.x=nx;if(!circleHitObstacle(this.x,ny,this.radius,obstacles))this.y=ny;if(this.phaseTimer<=0){const r=Math.random();if(r<.4){this.phase="telegraph_charge";this.phaseTimer=.7;this.chargeDir={x:Math.cos(ang),y:Math.sin(ang)};}else if(r<.75){this.phase="telegraph_barrage";this.phaseTimer=.9;}else{this.phase="summon";this.phaseTimer=.6;}}break;}case"telegraph_charge":if(this.phaseTimer<=0){this.phase="charging";this.phaseTimer=.8;game.addEffect(new ShockwaveEffect(this.x,this.y,"#ff617e",120,.3,{inner:20}));}break;case"charging":{let nx=this.x+this.chargeDir.x*this.speed*7*dt,ny=this.y+this.chargeDir.y*this.speed*7*dt;if(!circleHitObstacle(nx,ny,this.radius,obstacles)){this.x=nx;this.y=ny}else this.phaseTimer=0;this.x=U.clamp(this.x,this.radius,CONFIG.MAP_W-this.radius);this.y=U.clamp(this.y,this.radius,CONFIG.MAP_H-this.radius);if(d<this.radius+player.radius+10&&this.contactCd<=0){player.takeDamage(this.atk*1.4,game);this.contactCd=.5;}if(Math.random()<.5)spawnParticles(game.particles,this.x,this.y,1,"#ff617e",60,.3,5);if(this.phaseTimer<=0){this.phase="idle";this.phaseTimer=U.rand(1.5,2.2);}break;}case"telegraph_barrage":if(this.phaseTimer<=0){const count=16+this.index*2;for(let i=0;i<count;i++){const a=i/count*Math.PI*2+this.animT*.2;game.enemyProjectiles.push(new EnemyProjectile(this.x,this.y,Math.cos(a)*230,Math.sin(a)*230,this.atk*.6,9,"#ff617e"));}game.sound.explosion();game.addEffect(new ShockwaveEffect(this.x,this.y,"#ff617e",210,.55,{inner:20,fill:true}));this.phase="idle";this.phaseTimer=U.rand(1.8,2.4);}break;case"summon":if(this.phaseTimer<=0){for(let i=0;i<3;i++){const a=i/3*Math.PI*2;if(enemies.length<CONFIG.MAX_ENEMIES)enemies.push(new Enemy(this.index>1?"fast":"normal",this.x+Math.cos(a)*80,this.y+Math.sin(a)*80,game.currentScale));}game.addEffect(new ShockwaveEffect(this.x,this.y,"#d85cff",145,.45,{inner:30}));this.phase="idle";this.phaseTimer=U.rand(2,3);}break;}
    if(d<this.radius+player.radius&&this.contactCd<=0&&this.phase!=="charging"){player.takeDamage(this.atk,game);this.contactCd=.6;}
  }
  onDeath(game){this.dead=true;game.sound.kill();for(let i=0;i<3;i++)game.addEffect(new ShockwaveEffect(this.x,this.y,i%2?"#ffd94e":"#ff617e",180+i*95,.8+i*.12,{inner:20,fill:true}));game.addEffect(new ImpactEffect(this.x,this.y,"#ffffff",120,.7,0,true));spawnParticles(game.particles,this.x,this.y,90,"#ffb347",360,1.2,10);for(let i=0;i<10;i++)game.spawnExpGem(this.x+U.rand(-40,40),this.y+U.rand(-40,40),20);game.player.score+=300+this.index*100;game.player.kills++;game.bossKills=(game.bossKills||0)+1;game.shake(20,.7);}
  draw(ctx,cam){const x=this.x-cam.x,y=this.y-cam.y,r=this.radius,t=this.animT,flash=this.hitFlash>0;ctx.save();ctx.translate(x,y);const spawnScale=Math.min(1,this.spawnAge/.5);ctx.scale(spawnScale*1.12,spawnScale*1.12);ctx.save();ctx.globalCompositeOperation="source-over";const aura=ctx.createRadialGradient(0,0,r*.2,0,0,r*2.25);aura.addColorStop(0,"rgba(216,92,255,.16)");aura.addColorStop(.65,"rgba(255,97,126,.06)");aura.addColorStop(1,"rgba(216,92,255,0)");ctx.fillStyle=aura;ctx.beginPath();ctx.arc(0,0,r*2.25,0,Math.PI*2);ctx.fill();ctx.restore();
    if(this.phase==="telegraph_charge"){ctx.save();ctx.setLineDash([22,12]);ctx.lineDashOffset=-t*90;ctx.strokeStyle="rgba(255,97,126,.88)";ctx.lineWidth=7;ctx.shadowColor="#ff617e";ctx.shadowBlur=0;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(this.chargeDir.x*620,this.chargeDir.y*620);ctx.stroke();ctx.setLineDash([]);ctx.restore();}
    if(this.phase==="telegraph_barrage"){const p=1-U.clamp(this.phaseTimer/.9,0,1);ctx.save();ctx.rotate(t);ctx.strokeStyle=rgba("#ff617e",.75);ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,90+p*55,0,Math.PI*2);ctx.stroke();drawRingTicks(ctx,110,16,16,-t*2);ctx.restore();}
    ctx.fillStyle="rgba(0,0,0,.48)";ctx.beginPath();ctx.ellipse(5,r*.82,r*1.2,r*.42,0,0,Math.PI*2);ctx.fill();ctx.shadowColor="#d85cff";ctx.shadowBlur=0;ctx.strokeStyle="#080513";ctx.lineWidth=6;const col=flash?"#ffffff":["#ff617e","#ffd94e","#65dcff","#d85cff"][Math.min(this.index,3)];
    const variant=Math.min(this.index,3);ctx.rotate(variant===0?this.facing:0);
    if(variant===0){for(let i=0;i<6;i++){ctx.save();ctx.rotate(i/6*Math.PI*2+t*.25);ctx.fillStyle="#261039";polygonPath(ctx,[[r*.2,-r*.12],[r*1.55,-r*.28],[r*1.1,r*.32],[r*.15,r*.18]]);ctx.fill();ctx.stroke();ctx.restore();}ctx.fillStyle=col;ctx.beginPath();ctx.arc(0,0,r*.85,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#1a0b26";ctx.beginPath();ctx.arc(r*.18,0,r*.42,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#fff7dc";ctx.beginPath();ctx.arc(r*.3,0,r*.17,0,Math.PI*2);ctx.fill();}
    else if(variant===1){ctx.rotate(Math.sin(t)*.04);ctx.fillStyle="#26142c";polygonPath(ctx,[[-r,-r*.7],[-r*.45,-r*1.25],[0,-r*.8],[r*.45,-r*1.25],[r,-r*.7],[r*.8,r],[-r*.8,r]]);ctx.fill();ctx.stroke();ctx.fillStyle=col;polygonPath(ctx,[[-r*.62,-r*.35],[0,-r*.75],[r*.62,-r*.35],[r*.48,r*.62],[0,r*.88],[-r*.48,r*.62]]);ctx.fill();ctx.stroke();ctx.fillStyle="#fff7dc";ctx.fillRect(-r*.48,-r*.2,r*.28,r*.17);ctx.fillRect(r*.2,-r*.2,r*.28,r*.17);ctx.fillStyle="#ff617e";ctx.beginPath();ctx.arc(0,r*.25,r*.16+Math.sin(t*5)*2,0,Math.PI*2);ctx.fill();}
    else if(variant===2){for(let k=0;k<3;k++){ctx.save();ctx.rotate(t*(k%2?-.8:.55)+k);ctx.strokeStyle=rgba(k===1?"#ffd94e":col,.75);ctx.lineWidth=5-k;ctx.beginPath();ctx.ellipse(0,0,r*(1.05+k*.25),r*(.48+k*.12),k*.8,0,Math.PI*2);ctx.stroke();ctx.restore();}ctx.fillStyle="#122838";ctx.beginPath();ctx.arc(0,0,r*.76,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=col;polygonPath(ctx,[[0,-r*.62],[r*.52,0],[0,r*.62],[-r*.52,0]]);ctx.fill();ctx.stroke();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(0,0,r*.18,0,Math.PI*2);ctx.fill();}
    else{ctx.rotate(t*.16);ctx.fillStyle="#1a102a";for(let i=0;i<8;i++){ctx.save();ctx.rotate(i/8*Math.PI*2);polygonPath(ctx,[[r*.22,-r*.12],[r*1.35,-r*.28],[r*.9,r*.22],[r*.18,r*.16]]);ctx.fill();ctx.stroke();ctx.restore();}ctx.fillStyle=col;ctx.beginPath();ctx.arc(0,0,r*.82,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#090614";ctx.beginPath();ctx.ellipse(0,0,r*.46,r*.27,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff7dc";ctx.beginPath();ctx.ellipse(0,0,r*.19,r*.25,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#ff617e";ctx.beginPath();ctx.arc(0,0,r*.08,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
}

/* ============================== レベルアップ強化候補 ============================== */
function buildUpgradePool(player){
  const pool = [];
  const recentUpgrades = window.__recentUpgrades || [];
  
  const add = (id,name,icon,desc,cond,apply,weight)=>{
    if (!cond || cond(player)){
      // 最近取得した強化は出現率を半減
      const finalWeight = recentUpgrades.includes(id) ? (weight || 1) * 0.5 : (weight || 1);
      pool.push({id,name,icon,desc,apply:(p)=>{ apply(p); p.upgradeRanks=p.upgradeRanks||{}; p.upgradeRanks[id]=(p.upgradeRanks[id]||0)+1; },weight:finalWeight});
    }
  };

  // HP/防御関連：HPが少なかったら優先度UP
  const hpLow = player.hp < player.maxHp * 0.4;
  add("heal","HP回復","➕","現在HPを大きく回復する",null,(p)=>{ p.hp = Math.min(p.maxHp, p.hp+Math.round(p.maxHp*0.5)); }, hpLow?2:1);
  add("maxhp","最大HP上昇","♥","最大HPが増加し、その分回復する",null,(p)=>{ const inc=Math.round(p.maxHp*0.18); p.maxHp+=inc; p.hp+=inc; }, hpLow?1.8:1.2);
  add("defense","被ダメージ軽減","🛡","受けるダメージが軽減される",(p)=>p.damageReduction<0.5,(p)=>{ p.damageReduction = Math.min(0.5, p.damageReduction+0.08); }, hpLow?1.6:0.8);
  add("regen","HP自動回復","♻","毎秒わずかにHPが回復するようになる",null,(p)=>{ p.hpRegen += 0.6; }, 1.2);

  // 攻撃関連
  add("atk","攻撃力上昇","⚔","全武器の攻撃力が上昇する",null,(p)=>{ p.atk = Math.round(p.atk*1.18+1); }, 1.3);
  add("atkspeed","攻撃速度上昇","⏱","全武器の攻撃間隔が短縮される",null,(p)=>{ p.atkSpeedMul *= 1.15; }, 1.25);
  add("crit","クリティカル率上昇","✹","攻撃がクリティカルする確率が上がる",(p)=>p.critChance<0.6,(p)=>{ p.critChance = Math.min(0.6, p.critChance+0.07); }, 1.1);
  add("critdmg","クリティカルダメージ上昇","✹+","クリティカル時のダメージ倍率が上がる",null,(p)=>{ p.critMult += 0.3; }, 1.0);

  // 移動・ユーティリティ
  add("speed","移動速度上昇","👟","移動速度が上昇する",null,(p)=>{ p.speed *= 1.12; }, 0.9);
  add("pickup","経験値回収範囲上昇","◎","経験値の吸引範囲が広がる",null,(p)=>{ p.pickupRange *= 1.25; }, 1.1);
  add("lifesteal","敵撃破時に低確率で回復","🩸","敵を倒すと低確率でHPが少し回復する",null,(p)=>{ p.lifestealChance = Math.min(0.5,p.lifestealChance+0.1); }, 1.0);

  // 弾の強化
  add("bulletspeed","弾速上昇","➤","弾の速度が上昇する",null,(p)=>{ p.bulletSpeedMul *= 1.18; }, 0.95);
  add("bulletsize","弾サイズ上昇","⬤","弾が大きくなり当たりやすくなる",null,(p)=>{ p.bulletSizeMul *= 1.15; }, 1.05);
  add("pierce","貫通数上昇","🗲","弾が追加で1体貫通するようになる",null,(p)=>{ p.pierceBonus += 1; }, 1.15);
  add("multishot","通常弾追加","●●","通常弾の発射数が1本増える",(p)=>p.hasWeapon("normal"),(p)=>{ p.multishot += 1; }, 1.2);

  // 武器解放・強化（段階的な出現）
  const weaponEntry = (type,name,icon,desc,weight)=>{
    add("w_"+type, name, icon, desc, null, (p)=>{
      let w = p.getWeapon(type);
      if (!w){ w = new Weapon(type); p.weapons.push(w); }
      else { w.level += 1; }
    }, weight);
  };
  weaponEntry("pierce","貫通弾 解放・強化","➤➤","複数の敵を貫通する弾を放つ武器を強化する", 1.3);
  weaponEntry("blade","旋回ブレード 解放・強化","✦","周囲を回転し触れた敵にダメージを与える武器を強化する", 1.25);
  weaponEntry("lightning","雷攻撃 解放・強化","⚡","ランダムな敵に落雷し周囲へ連鎖する武器を強化する", 1.2);
  weaponEntry("explosion","範囲爆発 解放・強化","◉","周囲を爆撃する武器を強化する", 1.15);
  weaponEntry("laser","レーザー 解放・強化","▮","最も近い敵へ照射し続ける武器を強化する", 1.1);

  // 武器進化
  const weaponEvolve = (type, name, icon, desc) => {
    add("ev_"+type, name, icon, desc, 
      (p) => {
        const w = p.getWeapon(type);
        return w && w.tier < 3 && w.level >= 5;
      },
      (p) => {
        const w = p.getWeapon(type);
        if (w) w.evolve();
      }, 1.4);
  };
  weaponEvolve("pierce", "貫通弾 進化Ⅱ", "➤➤", "貫通弾が次段階へ進化する");
  weaponEvolve("blade", "旋回ブレード 進化Ⅱ", "✦✦", "旋回ブレードが次段階へ進化する");
  weaponEvolve("lightning", "雷攻撃 進化Ⅱ", "⚡⚡", "雷攻撃が次段階へ進化する");

  // 武器融合（2つの武器を組み合わせ）
  const fusionEntry = (type1, type2, name, icon, desc) => {
    add("fus_"+type1+"_"+type2, name, icon, desc,
      (p) => p.getWeapon(type1) && p.getWeapon(type2) && !p.getWeapon(type1).fusionPartner,
      (p) => {
        const w1 = p.getWeapon(type1);
        const w2 = p.getWeapon(type2);
        if (w1 && w2){
          w1.fusionPartner = type2;
          w2.fusionPartner = type1;
          w1.level += 2;
          w2.level += 1;
        }
      }, 1.6);
  };
  fusionEntry("normal", "pierce", "融合：通常+貫通", "◆", "通常弾と貫通弾を融合。威力が大幅UP");
  fusionEntry("blade", "lightning", "融合：刃+雷", "✦⚡", "旋回ブレードと雷攻撃を融合。範囲+連鎖");

  // スキルツリー（特殊な複合強化）
  add("tree_combo", "スコア・リミックス", "↻", "獲得スコア倍率が+50%上昇する",
    null,
    (p) => { p.comboMultiplier = (p.comboMultiplier || 1) + 0.5; }, 1.3);
  
  add("tree_aura", "オーラ強化Ⅰ", "◉", "プレイヤー周囲のオーラダメージが上昇",
    null,
    (p) => { p.auraDamage += 3; }, 1.2);

  add("tree_aura2", "オーラ強化Ⅱ", "◉◉", "プレイヤー周囲のオーラ範囲が拡大",
    null,
    (p) => { p.auraRadius += 40; }, 1.1);

  add("tree_chain", "彩層共振", "◫", "すべての攻撃ダメージが12%上昇する",
    null,
    (p) => { p.damageAmp *= 1.12; }, 1.2);

  return pool;
}


function fmtEffectNumber(v, digits=2){
  if (!Number.isFinite(v)) return "-";
  const rounded = Math.abs(v-Math.round(v))<0.005 ? String(Math.round(v)) : v.toFixed(digits).replace(/0+$/,'').replace(/\.$/,'');
  return rounded;
}
function weaponPowerDisplay(w){ return (1+(w.tier-1)*0.55)*(w.fusionPartner?1.35:1); }
function weaponTierLabel(w){ return ["Ⅰ","Ⅱ","Ⅲ"][Math.max(0,Math.min(2,w.tier-1))]; }
function getWeaponDisplayData(player,w){
  const power=weaponPowerDisplay(w), amp=player.damageAmp, atk=player.atk;
  const base={name:WEAPON_DEFS[w.type].name,icon:WEAPON_DEFS[w.type].icon,color:WEAPON_DEFS[w.type].color,level:`Lv.${w.level} / TIER ${weaponTierLabel(w)}${w.fusionPartner?" ◆FUSION":""}`,desc:"" ,stats:[]};
  if(w.type==="normal"){
    const mul=(1+(w.level-1)*.15)*power*amp, interval=.62/(player.atkSpeedMul*(1+(w.level-1)*.12));
    base.desc="近い敵を追尾する基本射撃。連射・追加弾・貫通強化をすべて受ける。";
    base.stats=[`1発 ${Math.round(atk*mul)} dmg`,`ダメージ ×${fmtEffectNumber(mul)}`,`発射 ${1+player.multishot}球`,`球貫通 +${player.pierceBonus}`,`間隔 ${fmtEffectNumber(interval)}秒`];
  }else if(w.type==="pierce"){
    const mul=(.85+(w.level-1)*.2)*power*amp, interval=.95/(player.atkSpeedMul*(1+(w.level-1)*.1));
    base.desc="敵列を一直線に貫く大型弾。密集した敵へ高い効率を発揮する。";
    base.stats=[`1発 ${Math.round(atk*mul)} dmg`,`ダメージ ×${fmtEffectNumber(mul)}`,`貫通 ${2+w.level+player.pierceBonus}体`,`間隔 ${fmtEffectNumber(interval)}秒`];
  }else if(w.type==="blade"){
    const mul=(.5+w.level*.18)*power*amp;
    base.desc="機体の周囲を旋回し、接触した敵を繰り返し切り刻む近接兵装。";
    base.stats=[`1Hit ${Math.round(atk*mul)} dmg`,`刃 ${1+w.level}枚`,`旋回半径 ${60+w.level*10}`,`再Hit 0.38秒`];
  }else if(w.type==="lightning"){
    const mul=(.8+(w.level-1)*.25)*power*amp, interval=1.3/(1+(w.level-1)*.12), chain=2+Math.floor(w.level/2);
    base.desc="敵へ落雷し、近くの別の敵へ威力を保ちながら連鎖する。";
    base.stats=[`初撃 ${Math.round(atk*mul)} dmg`,`ダメージ ×${fmtEffectNumber(mul)}`,`最大 ${chain+1}体`,`間隔 ${fmtEffectNumber(interval)}秒`];
  }else if(w.type==="explosion"){
    const mul=(1.1+(w.level-1)*.3)*power*amp, interval=2.2/(1+(w.level-1)*.1), radius=100+w.level*16+(w.tier-1)*22;
    base.desc="短い予告のあと、機体周囲を広範囲に吹き飛ばす面制圧兵装。";
    base.stats=[`爆発 ${Math.round(atk*mul)} dmg`,`半径 ${radius}`,`ダメージ ×${fmtEffectNumber(mul)}`,`間隔 ${fmtEffectNumber(interval)}秒`];
  }else if(w.type==="laser"){
    const mul=(.9+(w.level-1)*.2)*power*amp, interval=2.6/(1+(w.level-1)*.1), duration=.9+w.level*.1;
    base.desc="狙った方向を持続照射し、線上のすべての敵へ毎秒ダメージを与える。";
    base.stats=[`毎秒 ${Math.round(atk*mul)} dmg`,`威力 ×${fmtEffectNumber(mul)}`,`照射 ${fmtEffectNumber(duration)}秒`,`再装填 ${fmtEffectNumber(interval)}秒`];
  }
  return base;
}
function getCoreUpgradeData(player){
  const r=player.upgradeRanks||{}, auraRangeLv=1+(r.tree_aura2||0), auraPowerLv=1+(r.tree_aura||0);
  const stats=[];
  stats.push(`オーラ範囲 Lv.${auraRangeLv} / 半径 ${Math.round(player.auraRadius)}`);
  stats.push(`オーラ威力 Lv.${auraPowerLv} / 毎秒 ${fmtEffectNumber(player.auraDamage)}`);
  if(player.pierceBonus>0)stats.push(`球貫通 +${player.pierceBonus}`);
  if(player.multishot>0)stats.push(`通常弾 +${player.multishot}球`);
  if(player.damageAmp>1.001)stats.push(`全ダメージ ×${fmtEffectNumber(player.damageAmp)}`);
  if(player.atkSpeedMul>1.001)stats.push(`攻撃速度 ×${fmtEffectNumber(player.atkSpeedMul)}`);
  if(player.critChance>.051)stats.push(`会心率 ${Math.round(player.critChance*100)}%`);
  if(player.damageReduction>.001)stats.push(`被ダメージ -${Math.round(player.damageReduction*100)}%`);
  if(player.hpRegen>.001)stats.push(`HP回復 ${fmtEffectNumber(player.hpRegen)}/秒`);
  if(player.pickupRange>91)stats.push(`回収範囲 ${Math.round(player.pickupRange)}`);
  return {name:"現在の強化",icon:"▦",color:"#ffd94e",level:`BUILD Lv.${player.level}`,desc:"武器すべてへ適用される共通強化と、オーラの現在性能。",stats};
}
function getUpgradePreview(id,p){
  const r=p.upgradeRanks||{}, rank=(r[id]||0);
  const simple=(now,after)=>({now,after});
  if(id==="heal"){const heal=Math.round(p.maxHp*.5);return simple(`HP ${Math.ceil(p.hp)}/${p.maxHp}`,`HP ${Math.min(p.maxHp,Math.ceil(p.hp)+heal)}/${p.maxHp}`)}
  if(id==="maxhp"){const inc=Math.round(p.maxHp*.18);return simple(`最大HP ${p.maxHp}`,`最大HP ${p.maxHp+inc}（+${inc}）`)}
  if(id==="defense")return simple(`被ダメージ -${Math.round(p.damageReduction*100)}%`,`被ダメージ -${Math.round(Math.min(.5,p.damageReduction+.08)*100)}%`);
  if(id==="regen")return simple(`HP回復 ${fmtEffectNumber(p.hpRegen)}/秒`,`HP回復 ${fmtEffectNumber(p.hpRegen+.6)}/秒`);
  if(id==="atk")return simple(`基礎攻撃 ${p.atk}`,`基礎攻撃 ${Math.round(p.atk*1.18+1)}`);
  if(id==="atkspeed")return simple(`攻撃速度 ×${fmtEffectNumber(p.atkSpeedMul)}`,`攻撃速度 ×${fmtEffectNumber(p.atkSpeedMul*1.15)}`);
  if(id==="crit")return simple(`会心率 ${Math.round(p.critChance*100)}%`,`会心率 ${Math.round(Math.min(.6,p.critChance+.07)*100)}%`);
  if(id==="critdmg")return simple(`会心倍率 ×${fmtEffectNumber(p.critMult)}`,`会心倍率 ×${fmtEffectNumber(p.critMult+.3)}`);
  if(id==="speed")return simple(`移動速度 ${Math.round(p.speed)}`,`移動速度 ${Math.round(p.speed*1.12)}`);
  if(id==="pickup")return simple(`回収範囲 ${Math.round(p.pickupRange)}`,`回収範囲 ${Math.round(p.pickupRange*1.25)}`);
  if(id==="lifesteal")return simple(`撃破回復率 ${Math.round(p.lifestealChance*100)}%`,`撃破回復率 ${Math.round(Math.min(.5,p.lifestealChance+.1)*100)}%`);
  if(id==="bulletspeed")return simple(`弾速 ×${fmtEffectNumber(p.bulletSpeedMul)}`,`弾速 ×${fmtEffectNumber(p.bulletSpeedMul*1.18)}`);
  if(id==="bulletsize")return simple(`弾サイズ ×${fmtEffectNumber(p.bulletSizeMul)}`,`弾サイズ ×${fmtEffectNumber(p.bulletSizeMul*1.15)}`);
  if(id==="pierce")return simple(`球貫通 +${p.pierceBonus}`,`球貫通 +${p.pierceBonus+1}`);
  if(id==="multishot")return simple(`通常弾 ${1+p.multishot}球`,`通常弾 ${2+p.multishot}球`);
  if(id==="tree_combo")return simple(`スコア ×${fmtEffectNumber(p.comboMultiplier)}`,`スコア ×${fmtEffectNumber(p.comboMultiplier+.5)}`);
  if(id==="tree_aura")return simple(`オーラ威力 Lv.${1+(r.tree_aura||0)} / ${fmtEffectNumber(p.auraDamage)}/秒`,`オーラ威力 Lv.${2+(r.tree_aura||0)} / ${fmtEffectNumber(p.auraDamage+3)}/秒`);
  if(id==="tree_aura2")return simple(`オーラ範囲 Lv.${1+(r.tree_aura2||0)} / 半径${Math.round(p.auraRadius)}`,`オーラ範囲 Lv.${2+(r.tree_aura2||0)} / 半径${Math.round(p.auraRadius+40)}`);
  if(id==="tree_chain")return simple(`全ダメージ ×${fmtEffectNumber(p.damageAmp)}`,`全ダメージ ×${fmtEffectNumber(p.damageAmp*1.12)}`);
  if(id.startsWith("w_")){
    const type=id.slice(2),w=p.getWeapon(type);
    if(!w)return simple("未取得",`${WEAPON_DEFS[type].name} Lv.1 解放`);
    const current=getWeaponDisplayData(p,w),preview=Object.assign(Object.create(Object.getPrototypeOf(w)),w,{level:w.level+1}),after=getWeaponDisplayData(p,preview);
    return simple(`${current.level} / ${current.stats.slice(0,2).join("・")}`,`${after.level} / ${after.stats.slice(0,2).join("・")}`);
  }
  if(id.startsWith("ev_")){const type=id.slice(3),w=p.getWeapon(type);return simple(`TIER ${weaponTierLabel(w)} / Lv.${w.level}`,`TIER ${["Ⅰ","Ⅱ","Ⅲ"][Math.min(2,w.tier)]} / Lv.1`)}
  if(id.startsWith("fus_"))return simple("未融合","融合成立 / 両武器の威力×1.35");
  return simple(`取得回数 ${rank}`,`取得回数 ${rank+1}`);
}

function pickUpgradeChoices(player, n){
  const pool = buildUpgradePool(player);
  const picked = [];
  const poolCopy = pool.slice();
  
  while (picked.length < n && poolCopy.length){
    // 重み付けランダム選択
    let totalWeight = poolCopy.reduce((sum, item) => sum + (item.weight || 1), 0);
    let r = Math.random() * totalWeight;
    let idx = 0;
    for (let i = 0; i < poolCopy.length; i++){
      r -= (poolCopy[i].weight || 1);
      if (r <= 0){ idx = i; break; }
    }
    const item = poolCopy[idx];
    picked.push(item);
    poolCopy.splice(idx, 1);
  }
  
  return picked;
}

/* ============================== 難易度スケーリング ============================== */
function getTimeScale(t){
  let hp, atk, spd, spawnCount, spawnInterval;
  // 0-60秒：チュートリアル的な柔らかさ、素早い敵投入で学習促進
  if (t < 60){ hp=0.9; atk=0.9; spd=0.95; spawnCount=1; spawnInterval=1.2; }
  // 60-180秒：段階的な強化、エリート敵の登場機会増加
  else if (t < 180){ const p=(t-60)/120; hp=U.lerp(0.9,1.5,p); atk=U.lerp(0.9,1.4,p); spd=U.lerp(0.95,1.15,p); spawnCount=U.lerp(1,1.5,p); spawnInterval=U.lerp(1.2,0.85,p); }
  // 180-360秒：中盤のキープできる難易度、複数敵の脅威
  else if (t < 360){ const p=(t-180)/180; hp=U.lerp(1.5,2.4,p); atk=U.lerp(1.4,2.0,p); spd=U.lerp(1.15,1.3,p); spawnCount=U.lerp(1.5,3,p); spawnInterval=U.lerp(0.85,0.55,p); }
  // 360-480秒：後半戦・激戦突入
  else if (t < 480){ const p=(t-360)/120; hp=U.lerp(2.4,3.2,p); atk=U.lerp(2.0,2.6,p); spd=U.lerp(1.3,1.45,p); spawnCount=U.lerp(3,5.5,p); spawnInterval=U.lerp(0.55,0.35,p); }
  // 480-600秒：最終戦・フルパワー
  else { const p=Math.min(1,(t-480)/120); hp=U.lerp(3.2,4.2,p); atk=U.lerp(2.6,3.4,p); spd=U.lerp(1.45,1.6,p); spawnCount=U.lerp(5.5,8,p); spawnInterval=U.lerp(0.35,0.22,p); }
  return {hp,atk,speed:spd,spawnCount:Math.round(spawnCount),spawnInterval};
}

/* ============================== メインゲームクラス ============================== */
class Game{
  constructor(canvas){
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", {alpha:false});
    this.groundCanvas = document.createElement("canvas");
    this.groundCtx = this.groundCanvas.getContext("2d", {alpha:false});
    this.groundCache = {dirty:true,lastRender:0,lastElapsed:-1,lastCamX:NaN,lastCamY:NaN,stage:-1};
    this.hudRefreshTimer = 0;
    this.input = new InputManager();
    this.sound = new SoundManager();
    this.resize();
    window.addEventListener("resize", ()=>this.resize());

    this.state = "title"; // title, playing, paused, levelup, gameover, clear
    this.loadRecords();
    this.bindUI();

    this.lastTime = 0;
    this.shakeTime = 0; this.shakeMag = 0;
    this.bossWarning = 0;
    this.pendingBossSpawn = false;
    this._hitFlashTime = 0;
    this.stageTransition = 0;
    this.stageIndex = 0;
    requestAnimationFrame((t)=>this.loop(t));

    window.addEventListener("game-escape", ()=>{
      if (this.state==="playing") this.pause();
      else if (this.state==="paused") this.resume();
      else if (this.state==="skilltree") this.closeSkillTree();
    });
    window.addEventListener("collect-all-exp", ()=>{
      for (const g of this.gems) g.attracted = true;
    });
    window.addEventListener("nuke-screen", ()=>{
      for (const e of this.enemies){ if (e.dead) continue; this.damageEnemy(e, e.maxHp*0.6, false); }
      this.shake(14,0.4);
      spawnParticles(this.particles, this.player.x, this.player.y, 40, "#ff8a3f", 320, 0.6, 6);
    });
    window.addEventListener("item-pickup", ()=>{ this.sound.item(); });
    window.addEventListener("player-levelup", ()=>{ this.pendingLevelUps = (this.pendingLevelUps||0)+1; });
  }

  resize(){
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    const rawDpr = Math.min(CONFIG.MAX_DPR, window.devicePixelRatio || 1);
    const pixelCap = Math.sqrt(CONFIG.MAX_CANVAS_PIXELS / Math.max(1, this.viewW*this.viewH));
    const dpr = Math.max(.55, Math.min(rawDpr, pixelCap));
    this.renderDpr = dpr;
    this.canvas.style.width = this.viewW + "px";
    this.canvas.style.height = this.viewH + "px";
    this.canvas.width = Math.max(1,Math.round(this.viewW * dpr));
    this.canvas.height = Math.max(1,Math.round(this.viewH * dpr));
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
    this.ctx.imageSmoothingEnabled = true;
    const groundScale = CONFIG.GROUND_RENDER_SCALE;
    this.groundCanvas.width = Math.max(1,Math.round(this.viewW * groundScale));
    this.groundCanvas.height = Math.max(1,Math.round(this.viewH * groundScale));
    this.groundCtx.setTransform(groundScale,0,0,groundScale,0,0);
    this.groundCtx.imageSmoothingEnabled = true;
    this.groundCache.dirty = true;
  }

  shake(mag,time){this.shakeMag=Math.max(this.shakeMag,mag);this.shakeTime=Math.max(this.shakeTime,time);}
  triggerHitFlash(){this._hitFlashTime=.15;}
  addEffect(effect){if(!effect)return;if(this.effects.length>=CONFIG.MAX_EFFECTS)this.effects.shift();this.effects.push(effect);}
  refreshGroundCache(now,cam,w,h){
    const cache=this.groundCache,elapsed=this.elapsed||0,stage=stageIndexForTime(elapsed);
    const cameraMoved=Math.abs(cam.x-cache.lastCamX)>.5||Math.abs(cam.y-cache.lastCamY)>.5;
    const timeChanged=Math.abs(elapsed-cache.lastElapsed)>.03;
    if(!cache.dirty&&stage===cache.stage&&!cameraMoved&&!timeChanged)return;
    if(!cache.dirty&&stage===cache.stage&&now-cache.lastRender<CONFIG.GROUND_REFRESH_MS)return;
    const gctx=this.groundCtx,scale=CONFIG.GROUND_RENDER_SCALE;
    gctx.setTransform(1,0,0,1,0,0);
    gctx.clearRect(0,0,this.groundCanvas.width,this.groundCanvas.height);
    gctx.setTransform(scale,0,0,scale,0,0);
    this.drawGround(gctx,cam,w,h);
    cache.dirty=false;cache.lastRender=now;cache.lastElapsed=elapsed;cache.lastCamX=cam.x;cache.lastCamY=cam.y;cache.stage=stage;
  }
  drawGroundCached(ctx,cam,w,h,now){this.refreshGroundCache(now,cam,w,h);ctx.drawImage(this.groundCanvas,0,0,w,h);}

  loadRecords(){
    let rec = {};
    try{ rec = JSON.parse(localStorage.getItem("void_survivors_records") || "{}"); }catch(e){ rec = {}; }
    this.records = Object.assign({ highScore:0, bestTime:0, maxKills:0, volume:60, shards:0, totalShards:0, skillTree:{} }, rec);
    this.records.skillTree=normalizeSkillTree(this.records.skillTree);this.records.shards=Math.max(0,Math.floor(Number(this.records.shards)||0));this.records.totalShards=Math.max(this.records.shards,Math.floor(Number(this.records.totalShards)||0));
    document.getElementById("rHigh").textContent = this.records.highScore;
    document.getElementById("rTime").textContent = fmtTime(this.records.bestTime);
    document.getElementById("rKills").textContent = this.records.maxKills;
    document.getElementById("volSlider").value = this.records.volume;
    this.sound.volume = this.records.volume/100;
    this.updateMetaUI();
  }
  saveRecords(){
    try{ localStorage.setItem("void_survivors_records", JSON.stringify(this.records)); }catch(e){}
    this.updateMetaUI();
  }

  bindUI(){
    document.getElementById("startBtn").addEventListener("click", ()=>{ this.sound.ensure(); this.startGame(); });
    document.getElementById("skillTreeBtn").addEventListener("click", ()=>this.openSkillTree());
    document.getElementById("skillTreeCloseBtn").addEventListener("click", ()=>this.closeSkillTree());
    document.getElementById("skillTreeResetBtn").addEventListener("click", ()=>this.resetSkillTree());
    document.getElementById("resultSkillBtn1").addEventListener("click", ()=>{this.toTitle();this.openSkillTree();});
    document.getElementById("resultSkillBtn2").addEventListener("click", ()=>{this.toTitle();this.openSkillTree();});
    document.getElementById("pauseBtn").addEventListener("click", ()=> this.pause());
    document.getElementById("resumeBtn").addEventListener("click", ()=> this.resume());
    document.getElementById("quitBtn").addEventListener("click", ()=> this.toTitle());
    document.getElementById("retryBtn1").addEventListener("click", ()=> this.startGame());
    document.getElementById("retryBtn2").addEventListener("click", ()=> this.startGame());
    document.getElementById("titleBtn1").addEventListener("click", ()=> this.toTitle());
    document.getElementById("titleBtn2").addEventListener("click", ()=> this.toTitle());
    document.getElementById("volSlider").addEventListener("input", (e)=>{
      this.sound.volume = e.target.value/100;
      this.records.volume = Number(e.target.value);
      this.saveRecords();
    });
    document.addEventListener("visibilitychange", ()=>{
      if (document.hidden && this.state==="playing") this.pause(true);
    });
  }

  updateMetaUI(){
    const value=Math.max(0,Math.floor(Number(this.records?.shards)||0));
    const title=document.getElementById("titleShardCount"),tree=document.getElementById("skillTreeShardCount");
    if(title)title.textContent=value;if(tree)tree.textContent=value;
    const high=document.getElementById("rHigh"),time=document.getElementById("rTime"),kills=document.getElementById("rKills");
    if(high)high.textContent=this.records?.highScore||0;if(time)time.textContent=fmtTime(this.records?.bestTime||0);if(kills)kills.textContent=this.records?.maxKills||0;
  }
  getSkillRank(id){return skillRank(this.records.skillTree,id)}
  getBranchPoints(branchId){return branchSkillPoints(this.records.skillTree,branchId)}
  getTotalSkillPoints(){return totalSkillPoints(this.records.skillTree)}
  getExclusiveConflict(skill){if(!skill.exclusive)return null;return SKILL_NODES.find(s=>s.exclusive===skill.exclusive&&s.id!==skill.id&&this.getSkillRank(s.id)>0)||null}
  skillRequirementsMet(skill){
    const direct=(skill.requires||[]).every(req=>this.getSkillRank(req.id)>=req.rank);
    const branch=!skill.branchReq||this.getBranchPoints(skill.branch)>=skill.branchReq;
    const total=!skill.totalReq||this.getTotalSkillPoints()>=skill.totalReq;
    return direct&&branch&&total&&!this.getExclusiveConflict(skill);
  }
  skillRequirementRows(skill){
    const rows=[];
    for(const req of skill.requires||[]){const have=this.getSkillRank(req.id),need=req.rank;rows.push({ok:have>=need,text:`${SKILL_LOOKUP[req.id].name} Lv.${need}（現在 ${have}）`});}
    if(skill.branchReq)rows.push({ok:this.getBranchPoints(skill.branch)>=skill.branchReq,text:`${skill.branchName}へ ${skill.branchReq}ランク投資（現在 ${this.getBranchPoints(skill.branch)}）`});
    if(skill.totalReq)rows.push({ok:this.getTotalSkillPoints()>=skill.totalReq,text:`星座盤全体 ${skill.totalReq}ランク（現在 ${this.getTotalSkillPoints()}）`});
    const conflict=this.getExclusiveConflict(skill);if(conflict)rows.push({ok:false,text:`相互排他：${conflict.name}を取得済み`});
    if(!rows.length)rows.push({ok:true,text:"前提条件なし"});
    return rows;
  }
  skillTypeLabel(type){return({origin:"中枢",minor:"小ノード",notable:"注目ノード",keystone:"キーストーン",mastery:"最終奥義"})[type]||type}
  dominantBuildLabel(){
    const branches=SKILL_BRANCHES.filter(b=>b.id!=="core").map(b=>({b,p:this.getBranchPoints(b.id)})).sort((a,b)=>b.p-a.p);
    if(!branches[0]||branches[0].p<3)return"未形成ビルド";
    const key=SKILL_NODES.find(s=>s.type==="keystone"&&s.branch===branches[0].b.id&&this.getSkillRank(s.id)>0);
    return key?`${branches[0].b.name}｜${key.name}`:`${branches[0].b.name}型`;
  }
  renderSkillTree(){
    this.updateMetaUI();this.records.skillTree=normalizeSkillTree(this.records.skillTree);
    const nodesWrap=document.getElementById("skillTreeNodes"),svg=document.getElementById("skillTreeConnections"),tabs=document.getElementById("skillTreeTabs");nodesWrap.innerHTML="";svg.innerHTML="";tabs.innerHTML="";
    for(const branch of SKILL_BRANCHES){
      const tab=document.createElement("button");tab.className="skill-tree-tab";tab.style.setProperty("--tab-color",branch.color);tab.textContent=`${branch.icon} ${branch.name} ${this.getBranchPoints(branch.id)}`;tab.addEventListener("click",()=>{this.focusSkillBranch(branch.id);for(const t of tabs.children)t.classList.remove("active");tab.classList.add("active")});tabs.appendChild(tab);
      const wm=document.createElement("div");wm.className="branch-watermark";wm.style.left=branch.focus.x+"px";wm.style.top=branch.focus.y+"px";wm.style.color=branch.color;wm.textContent=branch.name;nodesWrap.appendChild(wm);
    }
    for(const skill of SKILL_NODES){
      for(const req of skill.requires||[]){const from=SKILL_LOOKUP[req.id];if(!from)continue;const line=document.createElementNS("http://www.w3.org/2000/svg","line");const reqMet=this.getSkillRank(req.id)>=req.rank,owned=this.getSkillRank(skill.id)>0;line.setAttribute("x1",from.x);line.setAttribute("y1",from.y);line.setAttribute("x2",skill.x);line.setAttribute("y2",skill.y);line.setAttribute("class",`skill-link ${owned?"owned":reqMet?"ready":"locked"}`);line.style.setProperty("--link-color",skill.branchColor);svg.appendChild(line);}
    }
    for(const skill of SKILL_NODES){
      const rank=this.getSkillRank(skill.id),maxed=rank>=skill.max,ready=this.skillRequirementsMet(skill),conflict=this.getExclusiveConflict(skill);const node=document.createElement("button");
      node.className=`tree-node ${skill.type} ${maxed?"maxed":rank>0?"owned":conflict?"conflict":ready?"available":"locked"}${this.selectedSkillId===skill.id?" selected":""}`;node.style.setProperty("--x",skill.x+"px");node.style.setProperty("--y",skill.y+"px");node.style.setProperty("--node-color",skill.branchColor);node.setAttribute("aria-label",skill.name);
      node.innerHTML=`<span class="tree-node-shell"><span class="tree-node-icon">${skill.icon}</span></span><span class="tree-node-rank">${rank}/${skill.max}</span><span class="tree-node-label">${skill.name}</span>`;
      node.addEventListener("click",()=>{this.selectedSkillId=skill.id;this.renderSkillTree()});node.addEventListener("dblclick",()=>this.purchaseSkill(skill.id));nodesWrap.appendChild(node);
    }
    const owned=SKILL_NODES.filter(s=>s.id!=="core_awakening"&&this.getSkillRank(s.id)>0).length,spent=SKILL_NODES.reduce((sum,s)=>sum+skillInvestedCost(s,this.getSkillRank(s.id)),0),total=this.getTotalSkillPoints();
    document.getElementById("skillTreeOwnedCount").textContent=`取得ノード ${owned} / ${SKILL_NODES.length-1}`;document.getElementById("skillTreeSpentCount").textContent=`投資 ${spent} 深淵片`;document.getElementById("skillTreeTotalRank").textContent=`同期ランク ${total}`;document.getElementById("skillTreeBuildLabel").textContent=this.dominantBuildLabel();
    if(!this.selectedSkillId)this.selectedSkillId="core_awakening";this.renderSkillDetail(this.selectedSkillId);
  }
  renderSkillDetail(id){
    const skill=SKILL_LOOKUP[id]||SKILL_LOOKUP.core_awakening,panel=document.getElementById("skillDetailPanel"),rank=this.getSkillRank(skill.id),maxed=rank>=skill.max,ready=this.skillRequirementsMet(skill),cost=maxed?0:skillCost(skill,rank+1),affordable=this.records.shards>=cost,rows=this.skillRequirementRows(skill);
    const typeLabel=this.skillTypeLabel(skill.type),current=skill.effect(rank),next=maxed?"強化完了":skill.effect(rank+1),buttonText=skill.id==="core_awakening"?"中枢ノードは常時有効":maxed?"最大強化済み":!ready?"前提条件を満たしていません":!affordable?`深淵片が ${cost-this.records.shards} 不足`:`深淵片 ${cost} で強化`;
    panel.style.setProperty("--detail-color",skill.branchColor);panel.innerHTML=`
      <div class="skill-detail-kicker">SELECTED CONSTELLATION NODE</div>
      <div class="skill-detail-title-row"><div class="skill-detail-icon" style="--detail-color:${skill.branchColor}">${skill.icon}</div><div><div class="skill-detail-title">${skill.name}</div><div class="skill-detail-meta"><span class="skill-type-badge">${typeLabel}</span>${skill.branchName}｜Lv.${rank}/${skill.max}</div></div></div>
      <div class="skill-detail-desc">${skill.desc}</div>
      <div class="skill-detail-effects"><div class="skill-detail-effect">現在｜${current}</div><div class="skill-detail-effect next">${maxed?"到達済み":"次ランク｜"+next}</div>${skill.tradeoff?'<div class="skill-detail-effect tradeoff">このノードは強力な長所と明確な代償を同時に持ちます。</div>':""}</div>
      <div class="skill-detail-reqs">${rows.map(r=>`<div class="skill-detail-req ${r.ok?"ok":"bad"}">${r.ok?"✓":"×"} ${r.text}</div>`).join("")}</div>
      <div class="skill-detail-action"><button class="skill-purchase-btn" ${skill.id==="core_awakening"||maxed||!ready||!affordable?"disabled":""}>${buttonText}</button><div class="skill-detail-hint">クリックで詳細表示／ダブルクリックでも購入可能。振り直しでは投資した深淵片を全額返却します。</div></div>`;
    const btn=panel.querySelector(".skill-purchase-btn");if(btn&&!btn.disabled)btn.addEventListener("click",()=>this.purchaseSkill(skill.id));
  }
  focusSkillBranch(branchId){const branch=SKILL_BRANCHES.find(b=>b.id===branchId);if(!branch)return;const vp=document.getElementById("skillTreeViewport");vp.scrollTo({left:Math.max(0,branch.focus.x-vp.clientWidth/2),top:Math.max(0,branch.focus.y-vp.clientHeight/2),behavior:"smooth"});}
  purchaseSkill(id){
    const skill=SKILL_LOOKUP[id];if(!skill||skill.id==="core_awakening")return;const rank=this.getSkillRank(id);if(rank>=skill.max||!this.skillRequirementsMet(skill))return;const cost=skillCost(skill,rank+1);if(this.records.shards<cost)return;
    this.records.shards-=cost;this.records.skillTree[id]=rank+1;this.saveRecords();this.sound.item();this.selectedSkillId=id;this.renderSkillTree();
  }
  resetSkillTree(){
    const refund=SKILL_NODES.reduce((sum,skill)=>sum+skillInvestedCost(skill,this.getSkillRank(skill.id)),0);if(refund<=0)return;
    if(!window.confirm(`クロマ星座盤をすべて振り直しますか？
投資した ${refund} 深淵片は全額返却されます。`))return;
    this.records.shards+=refund;this.records.skillTree={core_awakening:1};this.saveRecords();this.selectedSkillId="core_awakening";this.renderSkillTree();
  }
  openSkillTree(){
    this.input.keys.clear();this.state="skilltree";document.getElementById("titleScreen").classList.add("hidden");document.getElementById("gameOverScreen").classList.add("hidden");document.getElementById("clearScreen").classList.add("hidden");document.getElementById("skillTreeScreen").classList.remove("hidden");this.selectedSkillId=this.selectedSkillId||"core_awakening";this.renderSkillTree();requestAnimationFrame(()=>this.focusSkillBranch("core"));
  }
  closeSkillTree(){
    document.getElementById("skillTreeScreen").classList.add("hidden");document.getElementById("titleScreen").classList.remove("hidden");this.state="title";this.updateMetaUI();
  }

  toTitle(){
    this.state = "title";
    document.getElementById("hud").classList.add("hidden");
    document.getElementById("pauseScreen").classList.add("hidden");
    document.getElementById("gameOverScreen").classList.add("hidden");
    document.getElementById("clearScreen").classList.add("hidden");
    document.getElementById("levelUpScreen").classList.add("hidden");
    document.getElementById("skillTreeScreen").classList.add("hidden");
    document.getElementById("titleScreen").classList.remove("hidden");const toast=document.getElementById("upgradeToast");if(toast){toast.classList.add("hidden");toast.classList.remove("show");}
  }

  startGame(){
    document.getElementById("titleScreen").classList.add("hidden");
    document.getElementById("gameOverScreen").classList.add("hidden");
    document.getElementById("clearScreen").classList.add("hidden");
    document.getElementById("hud").classList.remove("hidden");

    this.balanceMul = BASE_BALANCE;
    this.player = new Player(this.records.skillTree);
    if(this.player.startRandomWeapon){const pool=["pierce","blade","lightning","explosion","laser"];this.player.weapons.push(new Weapon(U.choice(pool)));}
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.gems = [];
    this.items = [];
    this.particles = [];
    this.damageTexts = [];
    this.effects = [];
    this.decorations = [];
    this.obstacles = [];
    this.explosions = [];
    this.treasures = [];
    this.boss = null;
    this.nextBossThreshold = CONFIG.BOSS_INTERVAL;
    this.bossIndex = 0;
    this.bossKills = 0;
    this.bossWarning = 0;
    this.pendingBossSpawn = false;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.pendingLevelUps = 0;
    this.currentScale = getTimeScale(0);
    this.camera = {x:0,y:0};
    this._hitFlashTime = 0;
    this.stageIndex = 0;
    this.stageTransition = 1.9;
    this.hudRefreshTimer = 0;
    this.groundCache.dirty = true;

    this.generateObstacles();
    this.generateDecorations();

    this.input.keys.clear();
    this.state = "playing";
    this.lastTime = performance.now();
    document.getElementById("bossBarWrap").classList.add("hidden");
    this.updateWeaponBarDOM();
    this.updateHUD();
    if(this.player.startBonusChoices>0){this.pendingLevelUps=this.player.startBonusChoices;this.openLevelUp();}
  }

  generateObstacles(){
    const cx = CONFIG.MAP_W/2, cy = CONFIG.MAP_H/2;
    let tries=0;
    while (this.obstacles.length < CONFIG.OBSTACLE_COUNT && tries < CONFIG.OBSTACLE_COUNT*8){
      tries++;
      const x = U.rand(120, CONFIG.MAP_W-120);
      const y = U.rand(120, CONFIG.MAP_H-120);
      if (U.dist(x,y,cx,cy) < 260) continue; // 開始地点付近は空ける
      const r = U.rand(28,60);
      let overlap=false;
      for (const o of this.obstacles){ if (U.dist(x,y,o.x,o.y) < o.radius+r+40){ overlap=true; break; } }
      if (!overlap) this.obstacles.push(new Obstacle(x,y,r));
    }
  }

  generateDecorations(){
    this.decorations.push(new Decoration(CONFIG.MAP_W/2,CONFIG.MAP_H/2,190,0,.37));
    const count=42;for(let i=0;i<count;i++){const seed=U.hash(i+41,i*7+13),x=90+U.hash(i,71)*(CONFIG.MAP_W-180),y=90+U.hash(i+99,17)*(CONFIG.MAP_H-180);if(U.dist(x,y,CONFIG.MAP_W/2,CONFIG.MAP_H/2)<310)continue;const r=70+U.hash(i+5,103)*115,kind=Math.floor(U.hash(i+21,43)*5);this.decorations.push(new Decoration(x,y,r,kind,seed));}
  }

  pause(auto){
    if (this.state!=="playing") return;
    this.input.keys.clear();
    this.state = "paused";
    document.getElementById("pauseScreen").classList.remove("hidden");
  }
  resume(){
    if (this.state!=="paused") return;
    this.state = "playing";
    this.lastTime = performance.now();
    document.getElementById("pauseScreen").classList.add("hidden");
  }

  onPlayerDeath(){
    this.state = "gameover";
    this.sound.gameOver();
    this.finalizeRun(false);
    this.showResult(false);
  }
  onClear(){
    this.state = "clear";
    this.sound.clear();
    this.finalizeRun(true);
    this.showResult(true);
  }

  calculateShardReward(clear){
    const survival=Math.floor(this.elapsed/50),kills=Math.floor(this.player.kills/45),levels=Math.floor(this.player.level/4),bosses=(this.bossKills||0)*2,clearBonus=clear?10:0;
    const base=Math.max(1,1+survival+kills+levels+bosses+clearBonus),mult=this.player?.shardGainMul||1;
    return Math.max(1,Math.floor(base*mult));
  }
  finalizeRun(clear){
    const p = this.player;
    p.score += Math.floor(this.elapsed)*2 + p.level*50;
    p.score = Math.round(p.score * p.comboMultiplier);
    if (p.score > this.records.highScore) this.records.highScore = p.score;
    if (this.elapsed > this.records.bestTime) this.records.bestTime = this.elapsed;
    if (p.kills > this.records.maxKills) this.records.maxKills = p.kills;
    this.lastShardReward=this.calculateShardReward(clear);this.records.shards+=this.lastShardReward;this.records.totalShards+=this.lastShardReward;
    this.saveRecords();
  }

  showResult(clear){
    const p = this.player;
    const weaponsText = p.weapons.map(w=> `${WEAPON_DEFS[w.type].name} Lv.${w.level}`).join("　/　");
    const rowsHtml = `
      <div class="result-row"><span>生存時間</span><span>${fmtTime(this.elapsed)}</span></div>
      <div class="result-row"><span>最終レベル</span><span>${p.level}</span></div>
      <div class="result-row"><span>撃破数</span><span>${p.kills}</span></div>
      <div class="result-row"><span>スコア</span><span>${p.score}</span></div>
      <div class="result-row"><span>獲得した深淵片</span><span class="shard-gain">+${this.lastShardReward||0} ◇</span></div>
      <div class="result-row"><span>現在の所持数</span><span>${this.records.shards} ◇</span></div>
    `;
    if (clear){
      document.getElementById("clearStats").innerHTML = rowsHtml;
      document.getElementById("clearWeapons").textContent = "使用武器： " + weaponsText;
      document.getElementById("clearScreen").classList.remove("hidden");
    } else {
      document.getElementById("overStats").innerHTML = rowsHtml;
      document.getElementById("overWeapons").textContent = "使用武器： " + weaponsText;
      document.getElementById("gameOverScreen").classList.remove("hidden");
    }
  }

  spawnExpGem(x,y,value){ this.gems.push(new ExpGem(x,y,value)); }

  spawnEnemyWave(){
    const scale = this.currentScale;
    const count = scale.spawnCount * this.balanceMul.spawnMul;
    const n = Math.max(1, Math.round(count));
    const directedTypes = typeof window.__selectEnemyWaveTypes === "function"
      ? window.__selectEnemyWaveTypes(this, n)
      : null;
    for (let i=0;i<n;i++){
      if (this.enemies.length >= CONFIG.MAX_ENEMIES) break;
      const ang = Math.random()*Math.PI*2;
      const dist = U.rand(CONFIG.SPAWN_RING_MIN, CONFIG.SPAWN_RING_MAX);
      let x = this.player.x + Math.cos(ang)*dist;
      let y = this.player.y + Math.sin(ang)*dist;
      x = U.clamp(x, 24, CONFIG.MAP_W-24);
      y = U.clamp(y, 24, CONFIG.MAP_H-24);
      for (let attempt=0; attempt<6 && circleHitObstacle(x,y,26,this.obstacles); attempt++){
        const nudge = U.rand(70,180), a2 = ang + U.rand(-1.2,1.2);
        x = U.clamp(x + Math.cos(a2)*nudge,24,CONFIG.MAP_W-24);
        y = U.clamp(y + Math.sin(a2)*nudge,24,CONFIG.MAP_H-24);
      }

      let type = Array.isArray(directedTypes) && directedTypes[i] ? directedTypes[i] : "normal";
      const r = Math.random();
      const t = this.elapsed;
      if (!Array.isArray(directedTypes)){
        // 遭遇ディレクターがない場合の従来フォールバック。
        if (t < 90){
          type = r<0.9 ? "normal" : "fast";
        }else if (t < 180){
          if (r<0.48) type="normal"; else if (r<0.68) type="fast"; else if (r<0.85) type="heavy"; else type="ranged";
        }else if (t < 300){
          if (r<0.32) type="normal"; else if (r<0.5) type="fast"; else if (r<0.65) type="heavy";
          else if (r<0.8) type="ranged"; else if (r<0.92) type="splitter"; else type="elite";
        }else if (t < 420){
          if (r<0.2) type="normal"; else if (r<0.35) type="fast"; else if (r<0.5) type="heavy";
          else if (r<0.68) type="ranged"; else if (r<0.85) type="splitter"; else type="elite";
        }else{
          if (r<0.12) type="normal"; else if (r<0.25) type="fast"; else if (r<0.4) type="heavy";
          else if (r<0.62) type="ranged"; else if (r<0.8) type="splitter"; else type="elite";
        }
      }
      const scaleObj = { hp: scale.hp*this.balanceMul.hpMul, atk: scale.atk*this.balanceMul.atkMul, speed: scale.speed };
      this.enemies.push(new Enemy(type, x, y, scaleObj));
    }
  }

  triggerBoss(){
    this.bossWarning = 2.4;
    this.pendingBossSpawn = true;
    this.sound.bossAppear();
    const el = document.getElementById("warningBanner");
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "warnFlash 2.4s ease";
  }

  spawnBossNow(){
    const scaleObj = { hp: this.balanceMul.hpMul, atk: this.balanceMul.atkMul };
    const ang = Math.random()*Math.PI*2;
    const boss = new Boss(this.bossIndex, scaleObj);
    boss.x = U.clamp(this.player.x + Math.cos(ang)*520, 60, CONFIG.MAP_W-60);
    boss.y = U.clamp(this.player.y + Math.sin(ang)*520, 60, CONFIG.MAP_H-60);
    for (let attempt=0; attempt<10 && circleHitObstacle(boss.x,boss.y,boss.radius,this.obstacles); attempt++){
      const a2 = ang + (attempt+1)*0.63;
      boss.x = U.clamp(this.player.x + Math.cos(a2)*(520+attempt*24),60,CONFIG.MAP_W-60);
      boss.y = U.clamp(this.player.y + Math.sin(a2)*(520+attempt*24),60,CONFIG.MAP_H-60);
    }
    this.boss = boss;
    this.bossIndex++;
    document.getElementById("bossBarWrap").classList.remove("hidden");
    document.getElementById("bossName").textContent = boss.name;
  }

  /* ---------- 武器発射処理 ---------- */
  updateWeapons(dt){
    const p = this.player;
    for (const w of p.weapons){
      w.cd -= dt;
      switch (w.type){
        case "normal": this.updateNormalWeapon(w, dt); break;
        case "pierce": this.updatePierceWeapon(w, dt); break;
        case "blade": this.updateBladeWeapon(w, dt); break;
        case "lightning": this.updateLightningWeapon(w, dt); break;
        case "explosion": this.updateExplosionWeapon(w, dt); break;
        case "laser": this.updateLaserWeapon(w, dt); break;
      }
    }
  }

  weaponPower(w){
    const tierMul = 1 + (w.tier-1)*0.55;
    const fusionMul = w.fusionPartner ? 1.35 : 1;
    return tierMul * fusionMul;
  }

  computeDamage(baseAtk, mult){
    const p = this.player;
    let dmg = baseAtk * mult * p.effAtkMul * p.damageAmp;
    let crit = false;
    if (Math.random() < p.critChance){ dmg *= p.critMult; crit = true; }
    return { dmg: Math.round(dmg), crit };
  }

  updateNormalWeapon(w, dt){
    const p = this.player;
    const interval = 0.62 / (p.atkSpeedMul * (1+ (w.level-1)*0.12));
    if (w.cd > 0) return;
    const target = nearestEnemy(p.x,p.y,this.enemies, 900) || (this.boss && !this.boss.dead ? this.boss : null);
    if (!target) return;
    w.cd = interval;
    this.sound.attack();
    const shots = 1 + p.multishot;
    const baseAng = U.angle(p.x,p.y,target.x,target.y);
    for (let i=0;i<shots;i++){
      const spread = (i - (shots-1)/2) * 0.16;
      const ang = baseAng + spread;
      const speed = 480*p.bulletSpeedMul;
      this.addEffect(new MuzzleEffect(p.x+Math.cos(ang)*18,p.y+Math.sin(ang)*18,ang,WEAPON_DEFS.normal.color,20));
      const {dmg,crit} = this.computeDamage(p.atk, (1.0 + (w.level-1)*0.15) * this.weaponPower(w) * p.projectileDamageMul);
      const radius = 5*p.bulletSizeMul;
      if (this.projectiles.length < CONFIG.MAX_PLAYER_PROJECTILES){
        const proj = new Projectile(p.x,p.y,Math.cos(ang)*speed,Math.sin(ang)*speed, dmg, radius, p.pierceBonus, WEAPON_DEFS.normal.color, "normal", {crit});
        this.projectiles.push(proj);
        if(p.projectileEchoChance>0&&Math.random()<p.projectileEchoChance&&this.projectiles.length<CONFIG.MAX_PLAYER_PROJECTILES){const ea=ang+(Math.random()<.5?-.09:.09);this.projectiles.push(new Projectile(p.x,p.y,Math.cos(ea)*speed*1.08,Math.sin(ea)*speed*1.08,Math.max(1,Math.round(dmg*.65)),radius*.88,p.pierceBonus,"#fff4a4","normal",{crit:false,life:2.7}));}
      }
    }
  }

  updatePierceWeapon(w, dt){
    const p = this.player;
    const interval = 0.95 / (p.atkSpeedMul * (1+(w.level-1)*0.1));
    if (w.cd > 0) return;
    const target = nearestEnemy(p.x,p.y,this.enemies, 900) || (this.boss && !this.boss.dead ? this.boss : null);
    if (!target) return;
    w.cd = interval;
    this.sound.attack();
    const ang = U.angle(p.x,p.y,target.x,target.y);
    const speed = 340*p.bulletSpeedMul;
    this.addEffect(new MuzzleEffect(p.x+Math.cos(ang)*18,p.y+Math.sin(ang)*18,ang,WEAPON_DEFS.pierce.color,32));
    const {dmg,crit} = this.computeDamage(p.atk, (0.85 + (w.level-1)*0.2) * this.weaponPower(w) * p.projectileDamageMul);
    const radius = 7*p.bulletSizeMul;
    const pierce = 2 + w.level + p.pierceBonus;
    if (this.projectiles.length < CONFIG.MAX_PLAYER_PROJECTILES){
      this.projectiles.push(new Projectile(p.x,p.y,Math.cos(ang)*speed,Math.sin(ang)*speed,dmg,radius,pierce,WEAPON_DEFS.pierce.color,"pierce",{crit,life:4}));
      if(p.projectileEchoChance>0&&Math.random()<p.projectileEchoChance&&this.projectiles.length<CONFIG.MAX_PLAYER_PROJECTILES){const ea=ang+(Math.random()<.5?-.07:.07);this.projectiles.push(new Projectile(p.x,p.y,Math.cos(ea)*speed*1.08,Math.sin(ea)*speed*1.08,Math.max(1,Math.round(dmg*.65)),radius*.88,Math.max(1,pierce-1),"#fff4a4","pierce",{crit:false,life:3.5}));}
    }
  }

  updateBladeWeapon(w, dt){
    const p = this.player;
    const count = 1 + w.level;
    const radius = 60 + w.level*10;
    w.spinAngle += dt * (2.4 + w.level*0.2);
    const bladeDamage = Math.round(p.atk * (0.5 + w.level*0.18) * p.effAtkMul * p.damageAmp * this.weaponPower(w));
    for (let i=0;i<count;i++){
      const a = w.spinAngle + (i/count)*Math.PI*2;
      const bx = p.x + Math.cos(a)*radius;
      const by = p.y + Math.sin(a)*radius;
      for (const e of this.enemies){
        if (e.dead) continue;
        const d = U.dist(bx,by,e.x,e.y);
        if (d < e.radius + 12){
          const key = e.uid+"_"+i;
          const last = w.hitTimers.get(key) || 0;
          if (performance.now() - last > 380){
            w.hitTimers.set(key, performance.now());
            const crit = Math.random() < p.critChance;
            this.damageEnemy(e, crit?bladeDamage*p.critMult:bladeDamage, crit, e);
          }
        }
      }
      if (this.boss && !this.boss.dead){
        const d = U.dist(bx,by,this.boss.x,this.boss.y);
        if (d < this.boss.radius+12){
          const key = "boss_"+i;
          const last = w.hitTimers.get(key)||0;
          if (performance.now()-last>380){
            w.hitTimers.set(key, performance.now());
            const crit = Math.random()<p.critChance;
            this.damageBoss(crit?bladeDamage*p.critMult:bladeDamage, crit);
          }
        }
      }
    }
  }

  updateLightningWeapon(w, dt){
    const p = this.player;
    const interval = 1.3 / (1+(w.level-1)*0.12);
    if (w.cd > 0) return;
    const alive = this.enemies.filter(e=>!e.dead);
    const bossAlive = this.boss && !this.boss.dead;
    if (!alive.length && !bossAlive) return;
    w.cd = interval;
    this.sound.lightning();
    let target = bossAlive && Math.random()<0.3 ? this.boss : (alive.length?U.choice(alive):this.boss);
    const {dmg,crit} = this.computeDamage(p.atk, (0.8 + (w.level-1)*0.25) * this.weaponPower(w));
    this.strikeLightning(target, dmg, crit, 2+Math.floor(w.level/2)+p.lightningChainBonus, new Set());
  }
  strikeLightning(target,dmg,crit,chainsLeft,hitSet,fromX,fromY){
    if(!target||target.dead)return;const sx=fromX==null?this.player.x:fromX,sy=fromY==null?this.player.y:fromY;
    this.addEffect(new LightningEffect(sx,sy,target.x,target.y,WEAPON_DEFS.lightning.color,.2,crit?6:4));this.addEffect(new ShockwaveEffect(target.x,target.y,WEAPON_DEFS.lightning.color,48,.22,{inner:4}));
    spawnParticles(this.particles,target.x,target.y,10,WEAPON_DEFS.lightning.color,200,.3,4);this.damageEnemyOrBoss(target,dmg,crit);hitSet.add(target===this.boss?"boss":target.uid);if(chainsLeft<=0)return;
    let next=null,bd=260*260;for(const e of this.enemies){if(e.dead||hitSet.has(e.uid))continue;const d2=U.dist2(target.x,target.y,e.x,e.y);if(d2<bd){bd=d2;next=e;}}
    if(next)this.strikeLightning(next,Math.round(dmg*.8),crit,chainsLeft-1,hitSet,target.x,target.y);
  }

  updateExplosionWeapon(w, dt){
    const p = this.player;
    if (w.explosionGhost){
      w.explosionGhost.life -= dt;
      if (w.explosionGhost.life <= 0) w.explosionGhost = null;
    }
    if (w.pendingExplosion){
      w.pendingExplosion.delay -= dt;
      if (w.pendingExplosion.delay <= 0){
        const ex = w.pendingExplosion;
        w.pendingExplosion = null;
        this.sound.explosion();this.shake(8,.22);
        this.addEffect(new ShockwaveEffect(ex.x,ex.y,WEAPON_DEFS.explosion.color,ex.radius*1.28,.55,{inner:18,fill:true}));
        this.addEffect(new ImpactEffect(ex.x,ex.y,"#fff7dc",ex.radius*.55,.35,0,ex.crit));
        spawnParticles(this.particles,ex.x,ex.y,42,WEAPON_DEFS.explosion.color,330,.65,7);
        for (const e of this.enemies){
          if (!e.dead && U.dist2(ex.x,ex.y,e.x,e.y) < Math.pow(ex.radius+e.radius,2)) this.damageEnemy(e,ex.dmg,ex.crit);
        }
        if (this.boss && !this.boss.dead && U.dist2(ex.x,ex.y,this.boss.x,this.boss.y) < Math.pow(ex.radius+this.boss.radius,2)) this.damageBoss(ex.dmg,ex.crit);
      }
      return;
    }
    const interval = 2.2 / (1+(w.level-1)*0.1);
    if (w.cd > 0) return;
    w.cd = interval;
    const radius = (100 + w.level*16 + (w.tier-1)*22)*p.explosionRadiusMul;
    const {dmg,crit} = this.computeDamage(p.atk, (1.1 + (w.level-1)*0.3) * this.weaponPower(w) * p.explosionDamageMul);
    w.pendingExplosion = {x:p.x,y:p.y,radius,dmg,crit,delay:0.45};
    w.explosionGhost = {x:p.x,y:p.y,radius,life:0.45,maxLife:0.45};
    spawnParticles(this.particles,p.x,p.y,5,WEAPON_DEFS.explosion.color,48,0.4,3);
  }

  updateLaserWeapon(w, dt){
    const p = this.player;
    const interval = 2.6 / (1+(w.level-1)*0.1);
    const duration = 0.9 + w.level*0.1;
    if (w.laserActiveTime > 0){
      w.laserActiveTime -= dt;
      const ang = w.laserTargetAngle;
      const range = 620;
      const ex = p.x+Math.cos(ang)*range, ey = p.y+Math.sin(ang)*range;
      const laserWidth = 20 + (w.tier-1)*5;
      w.laserTickTimer -= dt;
      if (w.laserTickTimer <= 0){
        const tick = 0.1;
        w.laserTickTimer += tick;
        const dmgPerSec = p.atk * (0.9 + (w.level-1)*0.2) * p.effAtkMul * p.damageAmp * this.weaponPower(w);
        const dmg = Math.max(1, Math.round(dmgPerSec*tick));
        for (const e of this.enemies){
          if (!e.dead && pointToSegmentDist(e.x,e.y,p.x,p.y,ex,ey) < e.radius+laserWidth) this.damageEnemy(e,dmg,false);
        }
        if (this.boss && !this.boss.dead && pointToSegmentDist(this.boss.x,this.boss.y,p.x,p.y,ex,ey) < this.boss.radius+laserWidth) this.damageBoss(dmg,false);
      }
      if (Math.random()<0.3) spawnParticles(this.particles, p.x+Math.cos(ang)*U.rand(50,range*0.8), p.y+Math.sin(ang)*U.rand(50,range*0.8), 1, WEAPON_DEFS.laser.color, 30, 0.2, 3);
      if (w.laserActiveTime<=0) w.cd = interval;
      return;
    }
    if (w.cd > 0) return;
    const target = nearestEnemy(p.x,p.y,this.enemies,900) || (this.boss && !this.boss.dead?this.boss:null);
    if (!target) return;
    w.laserTargetAngle = U.angle(p.x,p.y,target.x,target.y);
    w.laserActiveTime = duration;
    w.laserTickTimer = 0;
    this.sound.laser();
  }

  damageEnemyOrBoss(target, dmg, crit){
    if (target === this.boss) this.damageBoss(dmg,crit);
    else this.damageEnemy(target, dmg, crit);
  }

  damageEnemy(e, dmg, crit){
    if (e.dead) return;
    e.hp-=dmg;e.hitFlash=crit?.22:.12;
    if(crit||Math.random()<.5)this.addEffect(new ImpactEffect(e.x,e.y,crit?"#ffd94e":e.color,crit?38:22,crit?.3:.18,U.rand(0,Math.PI*2),crit));
    if (this.damageTexts.length >= CONFIG.MAX_DAMAGE_TEXTS) this.damageTexts.shift();
    this.damageTexts.push(new DamageText(e.x,e.y-e.radius,String(Math.round(dmg)),crit?"#ffd447":"#ffffff",crit));
    if (crit){
      spawnParticles(this.particles, e.x, e.y, 20, "#ffdf5b", 260, 0.6, 6);
      this.shake(8, 0.15);
      for (let i=0; i<3; i++){
        setTimeout(()=>{ if(this.state==="playing") this.sound.hit(); }, i*30);
      }
    } else {
      spawnParticles(this.particles, e.x, e.y, 6, "#ffffff", 100, 0.35, 3);
    }
    if (e.hp <= 0){
      e.onDeath(this);
      if (Math.random() < this.player.lifestealChance){
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(this.player.maxHp*0.04));
      }
    }
  }

  damageBoss(dmg, crit){
    const b = this.boss;
    if (!b || b.dead) return;
    b.hp-=dmg;b.hitFlash=crit?.2:.12;
    this.addEffect(new ImpactEffect(b.x+U.rand(-18,18),b.y+U.rand(-18,18),crit?"#ffd94e":"#ff8aa0",crit?52:28,crit?.34:.18,U.rand(0,Math.PI*2),crit));
    if (this.damageTexts.length >= CONFIG.MAX_DAMAGE_TEXTS) this.damageTexts.shift();
    this.damageTexts.push(new DamageText(b.x,b.y-b.radius-10,String(Math.round(dmg)),crit?"#ffd447":"#ffb0b0",crit));
    if (crit){
      spawnParticles(this.particles, b.x, b.y, 28, "#ffdf5b", 300, 0.7, 7);
      this.shake(12, 0.2);
      for (let i=0; i<4; i++){
        setTimeout(()=>{ if(this.state==="playing") this.sound.hit(); }, i*25);
      }
    } else {
      spawnParticles(this.particles, b.x, b.y, 8, "#ffb0b0", 140, 0.4, 4);
    }
    if (b.hp <= 0){
      b.onDeath(this);
      document.getElementById("bossBarWrap").classList.add("hidden");
      this.boss = null;
    }
  }

  updateWeaponBarDOM(){
    const bar = document.getElementById("weaponBar");
    bar.innerHTML = "";
    const entries=this.player.weapons.map(w=>getWeaponDisplayData(this.player,w));
    entries.push(getCoreUpgradeData(this.player));
    for(const data of entries){
      const el=document.createElement("div");
      el.className="ability-panel"+(data.name==="現在の強化"?" core-panel":"");
      el.style.setProperty("--ability-color",data.color);
      const stats=data.stats.slice(0,data.name==="現在の強化"?8:5).map((x,i)=>`<span class="ability-stat ${i<2?"strong":""}">${x}</span>`).join("");
      el.innerHTML=`<div class="ability-icon">${data.icon}</div><div class="ability-main"><div class="ability-head"><div class="ability-name">${data.name}</div><div class="ability-level">${data.level}</div></div><div class="ability-desc">${data.desc}</div><div class="ability-stats">${stats}</div></div>`;
      bar.appendChild(el);
    }
  }

  showSystemToast(icon,name,desc,effect,color){
    const toast=document.getElementById("upgradeToast");
    toast.innerHTML=`<div class="upgrade-toast-card" style="--toast-color:${color}"><div class="upgrade-toast-icon">${icon}</div><div><div class="upgrade-toast-kicker">SYSTEM UPDATE</div><div class="upgrade-toast-name">${name}</div><div class="upgrade-toast-desc">${desc}</div><div class="upgrade-toast-effect">${effect}</div></div></div>`;
    toast.classList.remove("hidden","show");void toast.offsetWidth;toast.classList.add("show");
    clearTimeout(this._upgradeToastTimer);this._upgradeToastTimer=setTimeout(()=>{toast.classList.remove("show");toast.classList.add("hidden");},4200);
  }
  showUpgradeToast(choice){
    const preview=getUpgradePreview(choice.id,this.player);
    const color=choice.id.startsWith("w_")?WEAPON_DEFS[choice.id.slice(2)].color:(choice.id.includes("aura")?"#ffd94e":"#5dffd2");
    this.showSystemToast(choice.icon,choice.name,choice.desc,`現在：${preview.now}`,color);
  }

  /* ---------- レベルアップ処理 ---------- */
  openLevelUp(){
    this.input.keys.clear();
    this.state = "levelup";
    const choices = pickUpgradeChoices(this.player, 3+(this.player.levelUpChoiceBonus||0));
    this._levelUpChoices = choices;
    const wrap = document.getElementById("upgradeChoices");
    wrap.innerHTML = "";
    choices.forEach((c,index)=>{
      const card = document.createElement("div");
      card.className = "upgrade-card";
      card.dataset.index = String(index+1).padStart(2,"0");
      card.tabIndex = 0;
      card.setAttribute("role","button");
      const preview = getUpgradePreview(c.id,this.player);
      card.innerHTML = `
        <div class="upgrade-icon">${c.icon}</div>
        <div class="upgrade-name">${c.name}</div>
        <div class="upgrade-desc">${c.desc}</div>
        <div class="upgrade-current"><span class="now">現在｜${preview.now}</span><span class="after">取得後｜${preview.after}</span></div>
      `;
      card.addEventListener("click", ()=>{
        window.__recentUpgrades = (window.__recentUpgrades || []).concat(c.id).slice(-6);
        c.apply(this.player);
        this.updateWeaponBarDOM();
        this.showUpgradeToast(c);
        this.closeLevelUp();
      });
      wrap.appendChild(card);
    });
    document.getElementById("levelUpScreen").classList.remove("hidden");
    this.sound.levelUp();
  }
  closeLevelUp(){
    document.getElementById("levelUpScreen").classList.add("hidden");
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps-1);
    if (this.pendingLevelUps > 0){ this.openLevelUp(); }
    else { this.state = "playing"; this.lastTime = performance.now(); }
  }

  /* ---------- メインループ ---------- */
  loop(now){
    requestAnimationFrame((t)=>this.loop(t));
    let dt = (now - this.lastTime)/1000;
    this.lastTime = now;
    dt = Math.min(dt, 0.05); // タブ非表示復帰時の大ジャンプ防止

    if(this.state==="playing")this.update(dt);else if(this.stageTransition>0)this.stageTransition=Math.max(0,this.stageTransition-dt);
    this.render();
  }

  update(dt){
    const p = this.player;
    this.elapsed += dt;
    this.currentScale=getTimeScale(this.elapsed);
    const nextStage=stageIndexForTime(this.elapsed);if(nextStage!==this.stageIndex){this.stageIndex=nextStage;this.stageTransition=2.35;this.shake(8,.28);this.addEffect(new ShockwaveEffect(this.player.x,this.player.y,STAGE_VISUALS[nextStage].accent,240,.8,{inner:35,fill:true}));}
    if(this.stageTransition>0)this.stageTransition-=dt;

    if (this.elapsed >= CONFIG.GAME_TIME){ this.onClear(); return; }

    p.update(dt, this.input, this.obstacles, this);

    // カメラ追従
    this.camera.x = U.clamp(p.x - this.viewW/2, 0, CONFIG.MAP_W-this.viewW);
    this.camera.y = U.clamp(p.y - this.viewH/2, 0, CONFIG.MAP_H-this.viewH);
    if (CONFIG.MAP_W < this.viewW) this.camera.x = -(this.viewW-CONFIG.MAP_W)/2;
    if (CONFIG.MAP_H < this.viewH) this.camera.y = -(this.viewH-CONFIG.MAP_H)/2;

    // 敵スポーン
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0){
      this.spawnTimer = this.currentScale.spawnInterval;
      this.spawnEnemyWave();
    }

    // ボス
    if (!this.pendingBossSpawn && !this.boss && this.elapsed >= this.nextBossThreshold && this.nextBossThreshold < CONFIG.GAME_TIME){
      this.triggerBoss();
      this.nextBossThreshold += CONFIG.BOSS_INTERVAL;
    }
    if (this.bossWarning > 0){
      this.bossWarning -= dt;
      if (this.bossWarning <= 0){ this.spawnBossNow(); this.pendingBossSpawn=false; }
    }

    // 武器
    this.updateWeapons(dt);

    // 弾更新
    for (const proj of this.projectiles) proj.update(dt);
    for (const proj of this.enemyProjectiles) proj.update(dt);

    // プレイヤー弾 vs 敵（空間グリッド）
    for (const proj of this.projectiles){
      if (proj.dead) continue;

      if (
        proj.x < -50 ||
        proj.y < -50 ||
        proj.x > CONFIG.MAP_W + 50 ||
        proj.y > CONFIG.MAP_H + 50
      ){
        proj.dead = true;
      }

      const hitEnemy = (enemy)=>{
        if (
          proj.dead ||
          !enemy ||
          enemy.dead ||
          proj.hitSet.has(enemy.uid)
        ){
          return;
        }

        const hitRadius =
          proj.radius +
          enemy.radius;

        if (
          U.dist2(
            proj.x,
            proj.y,
            enemy.x,
            enemy.y
          ) >=
          hitRadius * hitRadius
        ){
          return;
        }

        proj.hitSet.add(enemy.uid);

        this.damageEnemy(
          enemy,
          proj.damage,
          proj.crit
        );

        if (proj.pierce > 0){
          proj.pierce--;
        }else{
          proj.dead = true;
        }
      };

      const enemyGrid =
        this._enemySpatial;

      if (
        enemyGrid &&
        typeof enemyGrid.forEachNearby === "function"
      ){
        enemyGrid.forEachNearby(
          proj.x,
          proj.y,
          proj.radius + 120,
          hitEnemy
        );
      }else{
        for (const enemy of this.enemies){
          hitEnemy(enemy);

          if (proj.dead){
            break;
          }
        }
      }

      if (
        this.boss &&
        !this.boss.dead &&
        !proj.dead &&
        !proj.bossHit
      ){
        const hitRadius =
          proj.radius +
          this.boss.radius;

        if (
          U.dist2(
            proj.x,
            proj.y,
            this.boss.x,
            this.boss.y
          ) <
          hitRadius * hitRadius
        ){
          proj.bossHit = true;

          this.damageBoss(
            proj.damage,
            proj.crit
          );

          if (proj.pierce > 0){
            proj.pierce--;
          }else{
            proj.dead = true;
          }
        }
      }
    }

    // 敵弾 vs プレイヤー
    for (const proj of this.enemyProjectiles){
      if (proj.dead) continue;
      if (proj.x<-50||proj.y<-50||proj.x>CONFIG.MAP_W+50||proj.y>CONFIG.MAP_H+50) proj.dead=true;
      const d = U.dist(proj.x,proj.y,p.x,p.y);
      if (d < proj.radius+p.radius){ p.takeDamage(proj.damage, this); proj.dead=true; }
    }

    // 敵更新
    for (const e of this.enemies) e.update(dt, p, this.enemies, this.obstacles, this);
    if (this.boss && !this.boss.dead) this.boss.update(dt, p, this.enemies, this.obstacles, this);

    // ジェム・アイテム更新
    for (const g of this.gems) g.update(dt, p);
    for (const it of this.items) it.update(dt, p);
    for (const tr of this.treasures) tr.update(dt, p);

    // パーティクル
    for(const pt of this.particles)pt.update(dt);
    for(const fx of this.effects)fx.update(dt);
    for(const ex of this.explosions)ex.update(dt);
    for(const dtxt of this.damageTexts)dtxt.update(dt);

    // 死亡削除
    removeDead(this.enemies);
    removeDead(this.projectiles);
    removeDead(this.enemyProjectiles);
    removeDead(this.gems);
    removeDead(this.items);
    removeDead(this.treasures);
    removeDead(this.particles);
    removeDead(this.effects);
    removeDead(this.explosions);
    removeDead(this.damageTexts);

    if (this.shakeTime > 0) this.shakeTime -= dt; else this.shakeMag = 0;

    if (this.pendingLevelUps > 0 && this.state === "playing"){ this.openLevelUp(); }

    this.hudRefreshTimer-=dt;
    if(this.hudRefreshTimer<=0){
      this.hudRefreshTimer=CONFIG.HUD_REFRESH_INTERVAL;
      if (this.boss) this.updateBossBarDOM();
      this.updateHUD();
    }
  }

  updateBossBarDOM(){
    document.getElementById("bossBarInner").style.width = Math.max(0,(this.boss.hp/this.boss.maxHp)*100) + "%";
  }

  updateHUD(){
    const p = this.player;
    document.getElementById("lvVal").textContent = p.level;
    document.getElementById("hpBar").style.width = Math.max(0,(p.hp/p.maxHp)*100)+"%";
    document.getElementById("hpVal").textContent = `${Math.max(0,Math.ceil(p.hp))}/${p.maxHp}`;
    document.getElementById("expBar").style.width = Math.max(0,(p.exp/p.expToNext)*100)+"%";
    const remain = Math.max(0, CONFIG.GAME_TIME - this.elapsed);
    const tVal = document.getElementById("timerVal");
    tVal.textContent = fmtTime(remain);
    tVal.classList.toggle("warn", remain < 30);
    document.getElementById("elapsedVal").textContent = fmtTime(this.elapsed);
    
    // ステージ表示
    let stage = "STAGE 1";
    if (this.elapsed < 90) stage = "侵入";
    else if (this.elapsed < 180) stage = "変色";
    else if (this.elapsed < 300) stage = "増殖";
    else if (this.elapsed < 420) stage = "崩壊";
    else stage = "深淵";
    document.getElementById("stageVal").textContent = `[${stage}]`;
    
    document.getElementById("killsVal").textContent = p.kills;
    document.getElementById("scoreVal").textContent = Math.round((p.score + Math.floor(this.elapsed)*2 + p.level*50) * p.comboMultiplier);
  }

  /* ---------- 描画 ---------- */
  render(){
    const ctx = this.ctx;
    const w = this.viewW;
    const h = this.viewH;
    ctx.clearRect(0,0,w,h);
    if (this.state === "title" || this.state === "skilltree") return;

    const nowT = performance.now();
    const rdt = this._lastRenderTime ? Math.min(.05,(nowT-this._lastRenderTime)/1000) : .016;
    this._lastRenderTime = nowT;

    ctx.save();
    let sx=0, sy=0;
    if (this.shakeTime>0){
      sx=U.rand(-this.shakeMag,this.shakeMag);
      sy=U.rand(-this.shakeMag,this.shakeMag);
    }
    ctx.translate(sx,sy);
    const cam=this.camera;

    this.drawGroundCached(ctx,cam,w,h,nowT);
    const stageVisual=stageVisualForTime(this.elapsed||0);
    for(const d of this.decorations)d.draw(ctx,cam,stageVisual,this.elapsed||0);
    for (const o of this.obstacles){
      if (!worldObjectVisible(o,cam,w,h,100)) continue;
      o.draw(ctx,cam);
    }
    for (const g of this.gems){if(worldObjectVisible(g,cam,w,h,70))g.draw(ctx,cam);}
    for (const it of this.items){if(worldObjectVisible(it,cam,w,h,70))it.draw(ctx,cam);}
    for (const tr of this.treasures){if(worldObjectVisible(tr,cam,w,h,90))tr.draw(ctx,cam);}
    for (const ex of this.explosions){if(worldObjectVisible(ex,cam,w,h,180))ex.draw(ctx,cam);}
    for (const e of this.enemies){if(worldObjectVisible(e,cam,w,h,100))e.draw(ctx,cam);}
    if (this.boss && !this.boss.dead) this.boss.draw(ctx,cam);
    if (this.player) this.player.draw(ctx,cam);
    for (const proj of this.projectiles){if(worldObjectVisible(proj,cam,w,h,120))proj.draw(ctx,cam);}
    for (const proj of this.enemyProjectiles){if(worldObjectVisible(proj,cam,w,h,120))proj.draw(ctx,cam);}

    const weaponList = this.player ? this.player.weapons : [];
    for (const wp of weaponList){
      if (wp.type === "blade"){
        const p=this.player;
        const count=1+wp.level;
        const radius=60+wp.level*10;
        for (let i=0;i<count;i++){
          const a=wp.spinAngle+i/count*Math.PI*2;
          const bx=p.x+Math.cos(a)*radius;
          const by=p.y+Math.sin(a)*radius;
          ctx.save();
          ctx.translate(bx-cam.x,by-cam.y);
          ctx.rotate(a+wp.spinAngle*1.7);
          ctx.globalCompositeOperation="source-over";
          ctx.strokeStyle=rgba(WEAPON_DEFS.blade.color,.25);
          ctx.lineWidth=10;
          ctx.beginPath();ctx.arc(0,0,15,-1.8,1.8);ctx.stroke();
          ctx.globalCompositeOperation="source-over";
          ctx.fillStyle="#ff617e";ctx.strokeStyle="#100815";ctx.lineWidth=3;
          polygonPath(ctx,[[18,0],[4,8],[-7,4],[-15,11],[-10,0],[-15,-11],[-7,-4],[4,-8]]);
          ctx.fill();ctx.stroke();
          ctx.fillStyle="#fff7dc";ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();
          ctx.restore();
        }
      }

      if (wp.type === "explosion" && wp.explosionGhost){
        const g=wp.explosionGhost;
        if (g.life>0){
          const a=g.life/g.maxLife;
          const p=1-a;
          ctx.save();ctx.translate(g.x-cam.x,g.y-cam.y);ctx.rotate(this.elapsed*1.4);
          ctx.strokeStyle=rgba(WEAPON_DEFS.explosion.color,.35+a*.5);
          ctx.lineWidth=3;ctx.setLineDash([12,10]);ctx.lineDashOffset=-this.elapsed*40;
          ctx.beginPath();ctx.arc(0,0,g.radius*(.92+.08*Math.sin(this.elapsed*8)),0,Math.PI*2);ctx.stroke();
          ctx.setLineDash([]);ctx.strokeStyle=rgba("#ffd94e",a*.7);
          drawRingTicks(ctx,g.radius*.72,12,12,-this.elapsed*2);
          ctx.fillStyle=rgba(WEAPON_DEFS.explosion.color,.04+.08*p);
          ctx.beginPath();ctx.arc(0,0,g.radius,0,Math.PI*2);ctx.fill();ctx.restore();
        }
      }

      if (wp.type === "laser" && wp.laserActiveTime>0){
        const p=this.player;
        const ang=wp.laserTargetAngle;
        const range=620;
        const x0=p.x-cam.x, y0=p.y-cam.y;
        const x1=x0+Math.cos(ang)*range, y1=y0+Math.sin(ang)*range;
        ctx.save();ctx.globalCompositeOperation="source-over";
        const passes=[[34,.12,"#42e8bd"],[20,.3,"#42e8bd"],[8,.9,"#fff7dc"]];
        for (const pass of passes){
          const width=pass[0], alpha=pass[1], color=pass[2];
          const grad=ctx.createLinearGradient(x0,y0,x1,y1);
          grad.addColorStop(0,rgba(color,alpha));
          grad.addColorStop(.75,rgba(color,alpha*.8));
          grad.addColorStop(1,rgba(color,0));
          ctx.strokeStyle=grad;ctx.lineWidth=width+Math.sin(this.elapsed*35)*2;ctx.lineCap="round";
          ctx.beginPath();ctx.moveTo(x0,y0);
          const seg=12;
          for (let i=1;i<=seg;i++){
            const q=i/seg;
            const j=Math.sin(this.elapsed*42+i*8)*Math.sin(q*Math.PI)*2.5;
            ctx.lineTo(U.lerp(x0,x1,q)-Math.sin(ang)*j,U.lerp(y0,y1,q)+Math.cos(ang)*j);
          }
          ctx.stroke();
        }
        ctx.fillStyle="rgba(255,255,255,.9)";ctx.beginPath();ctx.arc(x0,y0,8+Math.sin(this.elapsed*30)*2,0,Math.PI*2);ctx.fill();
        ctx.restore();
      }
    }

    for (const fx of this.effects){if(worldObjectVisible(fx,cam,w,h,220))fx.draw(ctx,cam);}
    for (const pt of this.particles){if(worldObjectVisible(pt,cam,w,h,60))pt.draw(ctx,cam);}
    for (const dtxt of this.damageTexts){if(worldObjectVisible(dtxt,cam,w,h,80))dtxt.draw(ctx,cam);}
    ctx.restore();

    this.drawAtmosphereOverlay(ctx,w,h);
    if (this._hitFlashTime>0){
      this._hitFlashTime-=rdt;
      const a=Math.max(0,this._hitFlashTime/.15);
      ctx.fillStyle=`rgba(255,244,196,${a*.18})`;
      ctx.fillRect(0,0,w,h);
    }
  }

  drawGround(ctx,cam,w,h){
    const st=stageVisualForTime(this.elapsed||0),time=this.elapsed||0;const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,st.bg0);bg.addColorStop(1,st.bg1);ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);const ambient=ctx.createLinearGradient(0,h,0,0);ambient.addColorStop(0,rgba(st.accent,.08));ambient.addColorStop(.55,rgba("#fff7dc",.035));ambient.addColorStop(1,rgba(st.accent2,.07));ctx.fillStyle=ambient;ctx.fillRect(0,0,w,h);
    // soft parallax nebula layers
    const nebula=[{x:560,y:640,r:620,c:st.danger,a:.13,p:.12},{x:3350,y:820,r:760,c:st.accent,a:.11,p:.18},{x:3100,y:3300,r:850,c:st.fog,a:.17,p:.08},{x:950,y:3200,r:690,c:st.accent2,a:.08,p:.22}];
    for(const b of nebula){const x=b.x-cam.x*b.p,y=b.y-cam.y*b.p,g=ctx.createRadialGradient(x,y,0,x,y,b.r);g.addColorStop(0,rgba(b.c,b.a));g.addColorStop(.52,rgba(b.c,b.a*.45));g.addColorStop(1,rgba(b.c,0));ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
    // large floor color field
    ctx.globalAlpha=.66;ctx.fillStyle=st.floor;ctx.fillRect(0,0,w,h);ctx.globalAlpha=1;
    // world-space chroma currents give the arena readable geography
    ctx.save();ctx.translate(-cam.x,-cam.y);for(let lane=0;lane<3;lane++){ctx.beginPath();for(let i=0;i<=42;i++){const wx=i/42*CONFIG.MAP_W,wy=650+lane*1280+Math.sin(i*.52+lane*2.1)*210+Math.sin(i*.17+time*.08)*70;i?ctx.lineTo(wx,wy):ctx.moveTo(wx,wy);}ctx.strokeStyle=rgba(lane===1?st.accent2:st.accent,.055);ctx.lineWidth=110-lane*12;ctx.lineCap="round";ctx.stroke();ctx.strokeStyle=rgba(lane===1?st.accent:st.accent2,.16);ctx.lineWidth=3;ctx.setLineDash([26,35]);ctx.lineDashOffset=-time*(18+lane*5);ctx.stroke();ctx.setLineDash([]);}ctx.restore();
    const cell=150,gx0=Math.floor(cam.x/cell)-2,gy0=Math.floor(cam.y/cell)-2,gx1=Math.ceil((cam.x+w)/cell)+2,gy1=Math.ceil((cam.y+h)/cell)+2;
    for(let gy=gy0;gy<=gy1;gy++)for(let gx=gx0;gx<=gx1;gx++){const rnd=U.hash(gx,gy),x=gx*cell-cam.x,y=gy*cell-cam.y;if(rnd<.2){ctx.save();ctx.translate(x+cell*.5,y+cell*.5);ctx.rotate((rnd-.5)*2);ctx.globalAlpha=.08+.08*U.hash(gx+7,gy-4);ctx.fillStyle=[st.accent,st.accent2,st.danger,st.fog][Math.floor(rnd*100)%4];const sz=18+rnd*32;if(st.motif==="cell"){ctx.beginPath();ctx.arc(0,0,sz,0,Math.PI*2);ctx.fill();ctx.strokeStyle=rgba("#fff7dc",.25);ctx.stroke();}else if(st.motif==="spore"){for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(Math.cos(i*1.8)*sz*.6,Math.sin(i*1.8)*sz*.6,sz*.32,0,Math.PI*2);ctx.fill();}}else{polygonPath(ctx,[[0,-sz],[sz*.8,-sz*.15],[sz*.25,sz],[-sz*.75,sz*.35],[-sz*.6,-sz*.55]]);ctx.fill();}ctx.restore();}
      if(U.hash(gx+19,gy+31)>.91){ctx.save();ctx.translate(x+cell*.5,y+cell*.5);ctx.strokeStyle=rgba(st.accent,.17);ctx.lineWidth=2;ctx.rotate(rnd*6);ctx.beginPath();ctx.arc(0,0,48+rnd*44,0,Math.PI*2);ctx.stroke();drawRingTicks(ctx,48+rnd*44,8,8,time*.15+rnd);ctx.restore();}
      if(st.motif==="rift"&&rnd>.82){ctx.save();ctx.translate(x+cell*.5,y+cell*.5);ctx.strokeStyle=rgba(st.danger,.28);ctx.lineWidth=3;ctx.shadowColor=st.danger;ctx.shadowBlur=0;ctx.beginPath();ctx.moveTo(-45,-30);ctx.lineTo(-15,-8);ctx.lineTo(-25,18);ctx.lineTo(20,7);ctx.lineTo(43,35);ctx.stroke();ctx.restore();}
      if(st.motif==="eye"&&rnd>.9){ctx.save();ctx.translate(x+cell*.5,y+cell*.5);ctx.rotate(rnd*8);ctx.strokeStyle=rgba(st.accent,.22);ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,55,23,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle=rgba(st.danger,.16);ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.fill();ctx.restore();}
    }
    // flowing contour lanes
    const cx=CONFIG.MAP_W/2-cam.x,cy=CONFIG.MAP_H/2-cam.y;for(let ring=0;ring<10;ring++){ctx.beginPath();const base=220+ring*220;for(let i=0;i<=100;i++){const a=i/100*Math.PI*2,wobble=Math.sin(a*(4+ring%3)+ring*.9+time*.05)*24+Math.sin(a*11-ring)*9,x=cx+Math.cos(a)*(base+wobble),y=cy+Math.sin(a)*(base+wobble);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.strokeStyle=ring%3===0?rgba(st.accent2,.15):rgba(st.accent,.08);ctx.lineWidth=ring%3===0?2:1;ctx.stroke();}
    // parallax dust and tiny starlets
    for(let i=0;i<70;i++){const seed=U.hash(i,stageIndexForTime(time)+71),wx=(seed*CONFIG.MAP_W+time*(8+seed*14))%CONFIG.MAP_W,wy=(U.hash(i+9,77)*CONFIG.MAP_H+Math.sin(time*.2+i)*20)%CONFIG.MAP_H,x=wx-cam.x*.45,y=wy-cam.y*.45;if(x<-20||x>w+20||y<-20||y>h+20)continue;ctx.fillStyle=rgba(i%3?st.accent:"#fff7dc",.16+seed*.25);ctx.beginPath();ctx.arc(x,y,.8+seed*1.7,0,Math.PI*2);ctx.fill();}
    if(this.player){const px=this.player.x-cam.x,py=this.player.y-cam.y,g=ctx.createRadialGradient(px,py,0,px,py,430);g.addColorStop(0,rgba("#fff7dc",.13));g.addColorStop(.22,rgba(st.accent,.16));g.addColorStop(.55,rgba(st.accent2,.055));g.addColorStop(1,rgba(st.accent,0));ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
    ctx.save();ctx.setLineDash([28,12,5,12]);ctx.lineDashOffset=-time*24;ctx.strokeStyle=st.danger;ctx.lineWidth=5;ctx.shadowColor=st.fog;ctx.shadowBlur=0;ctx.strokeRect(-cam.x,-cam.y,CONFIG.MAP_W,CONFIG.MAP_H);ctx.restore();
  }

  drawAtmosphereOverlay(ctx,w,h){
    const st=stageVisualForTime(this.elapsed||0),time=this.elapsed||0;ctx.save();
    const v=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.25,w/2,h/2,Math.max(w,h)*.72);v.addColorStop(0,"rgba(0,0,0,0)");v.addColorStop(.72,"rgba(0,0,0,.025)");v.addColorStop(1,"rgba(0,0,0,.30)");ctx.fillStyle=v;ctx.fillRect(0,0,w,h);
    const top=ctx.createLinearGradient(0,0,0,h);top.addColorStop(0,rgba(st.fog,.11));top.addColorStop(.25,rgba(st.fog,0));top.addColorStop(.75,rgba(st.danger,0));top.addColorStop(1,rgba(st.danger,.08));ctx.fillStyle=top;ctx.fillRect(0,0,w,h);
    ctx.globalAlpha=.035;ctx.fillStyle="#fff";for(let y=(time*18)%7;y<h;y+=7)ctx.fillRect(0,y,w,1);ctx.globalAlpha=1;
    if(this.stageTransition>0){
      const total=this.stageIndex===0?1.9:2.35;
      const a=U.clamp(this.stageTransition/.42,0,1)*U.clamp((total-this.stageTransition)/.35,0,1);
      const p=1-this.stageTransition/total;
      ctx.save();ctx.translate(48,h*.34);ctx.globalAlpha=a;ctx.textAlign="left";
      ctx.fillStyle=rgba("#090718",.76);ctx.fillRect(-18,-62,330,112);
      ctx.fillStyle=st.accent;ctx.fillRect(-18,-62,9,112);
      ctx.shadowColor=st.accent;ctx.shadowBlur=0;ctx.fillStyle="#fff7dc";ctx.font=`1000 ${Math.round(40+8*Math.sin(p*Math.PI))}px Arial Black, sans-serif`;ctx.fillText(st.name,8,-5);
      ctx.shadowBlur=0;ctx.fillStyle=st.accent2;ctx.font="900 11px monospace";ctx.fillText(st.code+" / CHROMA ABYSS",10,24);
      ctx.strokeStyle=rgba(st.accent,.75);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(10,36);ctx.lineTo(270,36);ctx.stroke();
      ctx.fillStyle=rgba(st.accent,.18);ctx.font="1000 70px Arial Black";ctx.fillText(String(this.stageIndex+1).padStart(2,"0"),225,10);
      ctx.restore();
    }
    ctx.restore();
  }
}

function pointToSegmentDist(px,py,ax,ay,bx,by){
  const dx=bx-ax, dy=by-ay;
  const len2 = dx*dx+dy*dy;
  let t = len2>0 ? ((px-ax)*dx+(py-ay)*dy)/len2 : 0;
  t = U.clamp(t,0,1);
  const cx=ax+dx*t, cy=ay+dy*t;
  return U.dist(px,py,cx,cy);
}

function fmtTime(sec){
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec/60), s = sec%60;
  return m + ":" + String(s).padStart(2,"0");
}

/* ============================== 起動 ============================== */
window.addEventListener("DOMContentLoaded", ()=>{
  const canvas = document.getElementById("gameCanvas");
  window.__game = new Game(canvas);
});
