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
    const amount = Math.abs(Number(String(text).replace(/[^\d.]/g,""))) || 0;
    this.amountScale = U.clamp(1 + Math.log10(Math.max(1,amount))*0.16, 1, 1.72);
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
      ctx.font = `bold ${Math.round(186*this.amountScale)}px sans-serif`;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    } else {
      ctx.font = `bold ${Math.round(114*this.amountScale)}px sans-serif`;
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



/*
 * Runtime extensions consolidated from the former post-load correction scripts.
 * Keep each section below in this order: several systems intentionally wrap
 * the method installed by the preceding section.
 *
 * - performance-kill-fix.js
 * - performance-kill-render-fix.js
 * - performance-core-fix.js
 * - performance-longrun-fix.js
 * - performance-critical-fix.js
 * - performance-compositor-fix.js
 * - performance-glow-state-fix.js
 * - background-visual-restore.js
 * - selection-screen.js
 * - stability-fix.js
 * - combat-readability.js
 * - abyss-systems.js
 * - player-visual-compat.js
 * - overdrive-mode.js
 * - speed-controls.js
 * - overdrive-impact.js
 * - combat-balance-overhaul.js
 */


/* ===== Extension: performance-kill-fix.js ===== */
"use strict";

(() => {
  const MAX_CHAIN_HITS_PER_FRAME = 8;
  const KILL_SOUND_INTERVAL_MS = 45;

  // 粒子上限到達時に、粒子1個ごとにArray.shift()する処理を避ける。
  spawnParticles = function(list, x, y, count, color, speed, life, size){
    const emitCount = Math.max(0, Math.floor(count));
    if (emitCount === 0) return;

    const overflow = Math.max(
      0,
      list.length + emitCount - CONFIG.MAX_PARTICLES
    );

    if (overflow > 0) {
      list.splice(0, overflow);
    }

    for (let i=0; i<emitCount; i++){
      const ang = Math.random()*Math.PI*2;
      const spd = U.rand(speed*0.3, speed);

      list.push(new Particle(
        x,
        y,
        Math.cos(ang)*spd,
        Math.sin(ang)*spd,
        U.rand(life*0.6, life),
        color,
        U.rand(size*0.5, size)
      ));
    }
  };

  // 死亡爆発の二次ダメージだけをキューへ移す。
  // 撃破報酬、経験値、爆発演出、ドロップは従来どおり即時処理する。
  const originalEnemyOnDeath = Enemy.prototype.onDeath;

  Enemy.prototype.onDeath = function(game){
    if (this.dead) return;

    const previousDamageEnemy = game.damageEnemy;
    const queue =
      game._deathChainQueue ||
      (game._deathChainQueue = []);

    game.damageEnemy = function(target, damage, crit){
      if (!target || target.dead) return;

      queue.push({
        target,
        damage,
        crit: !!crit
      });
    };

    try{
      originalEnemyOnDeath.call(this, game);
    }finally{
      game.damageEnemy = previousDamageEnemy;
    }
  };

  window.addEventListener("DOMContentLoaded", () => {
    const game = window.__game;
    if (!game) return;

    game._deathChainQueue = [];
    game._deathChainHead = 0;
    game._effectReplaceIndex = 0;

    // 演出上限時に配列全体をshiftせず、古い演出を1つ置き換える。
    game.addEffect = function(effect){
      if (!effect) return;

      if (this.effects.length < CONFIG.MAX_EFFECTS){
        this.effects.push(effect);
        return;
      }

      const index =
        this._effectReplaceIndex % CONFIG.MAX_EFFECTS;

      this.effects[index] = effect;
      this._effectReplaceIndex =
        (index + 1) % CONFIG.MAX_EFFECTS;
    };

    const originalStartGame = game.startGame;

    game.startGame = function(){
      this._deathChainQueue.length = 0;
      this._deathChainHead = 0;
      this._effectReplaceIndex = 0;

      return originalStartGame.call(this);
    };

    const originalUpdate = game.update;

    game.update = function(dt){
      const queue = this._deathChainQueue;
      let head = this._deathChainHead;

      const processCount = Math.min(
        MAX_CHAIN_HITS_PER_FRAME,
        queue.length - head
      );

      // このフレーム開始時点に存在した処理だけを実行する。
      // 新しく発生した連鎖は次のフレーム以降へ回す。
      for (let i=0; i<processCount; i++){
        const hit = queue[head++];

        if (hit && !hit.target.dead){
          this.damageEnemy(
            hit.target,
            hit.damage,
            hit.crit
          );
        }
      }

      if (head >= queue.length){
        queue.length = 0;
        head = 0;
      }else if (
        head > 256 &&
        head*2 > queue.length
      ){
        queue.splice(0, head);
        head = 0;
      }

      this._deathChainHead = head;

      const result = originalUpdate.call(this, dt);

      // 撃破スコア文字が一度に増えすぎるのを防ぐ。
      if (
        this.damageTexts.length >
        CONFIG.MAX_DAMAGE_TEXTS
      ){
        this.damageTexts.splice(
          0,
          this.damageTexts.length -
            CONFIG.MAX_DAMAGE_TEXTS
        );
      }

      return result;
    };

    // 大量撃破時にWeb Audioの音源を同一フレームで大量生成しない。
    const originalKillSound =
      game.sound.kill.bind(game.sound);

    let lastKillSoundAt = -Infinity;

    game.sound.kill = function(){
      const now = performance.now();

      if (
        now - lastKillSoundAt <
        KILL_SOUND_INTERVAL_MS
      ){
        return;
      }

      lastKillSoundAt = now;
      originalKillSound();
    };
  });
})();

/* ===== Extension: performance-kill-render-fix.js ===== */
"use strict";

(() => {
  const MAX_DEATH_EFFECTS_PER_FRAME = 2;

  function drawParticleShape(ctx,shape,size){
    if(shape===0){
      ctx.beginPath();
      ctx.arc(0,0,size,0,Math.PI*2);
      ctx.fill();
      return;
    }

    if(shape===1){
      polygonPath(ctx,[
        [size*1.5,0],
        [0,size*.55],
        [-size*1.5,0],
        [0,-size*.55]
      ]);
      ctx.fill();
      return;
    }

    ctx.fillRect(
      -size*.35,
      -size*1.4,
      size*.7,
      size*2.8
    );
  }

  const particleSprites = new Map();

  function particleSprite(color,shape){
    const key = color + ":" + shape;

    if(particleSprites.has(key)){
      return particleSprites.get(key);
    }

    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;

    const ctx = canvas.getContext("2d");
    ctx.translate(32,32);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 0;

    drawParticleShape(ctx,shape,8);

    ctx.shadowBlur = 0;
    ctx.globalAlpha = .45;
    drawParticleShape(ctx,shape,8);

    particleSprites.set(key,canvas);
    return canvas;
  }

  const radialSprites = new Map();

  function radialSprite(color,type){
    const key = type + ":" + color;

    if(radialSprites.has(key)){
      return radialSprites.get(key);
    }

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;

    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(
      64,64,0,
      64,64,64
    );

    if(type === "explosion"){
      gradient.addColorStop(
        0,
        rgba("#fff8ca",.65)
      );

      gradient.addColorStop(
        .35,
        rgba(color,.32)
      );

      gradient.addColorStop(
        1,
        rgba(color,0)
      );
    }else{
      gradient.addColorStop(
        0,
        rgba(color,0)
      );

      gradient.addColorStop(
        .7,
        rgba(color,.12)
      );

      gradient.addColorStop(
        1,
        rgba(color,0)
      );
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0,0,128,128);

    radialSprites.set(key,canvas);
    return canvas;
  }

  Particle.prototype.draw = function(ctx,cam){
    const alpha = Math.max(
      0,
      this.life/this.maxLife
    );

    const size =
      this.size*(.35+.65*alpha);

    const scale = size/8;

    ctx.save();
    ctx.translate(
      this.x-cam.x,
      this.y-cam.y
    );

    ctx.rotate(this.rot);
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "source-over";

    ctx.drawImage(
      particleSprite(
        this.color,
        this.shape
      ),
      -32*scale,
      -32*scale,
      64*scale,
      64*scale
    );

    ctx.restore();
  };

  ExplosionArea.prototype.draw = function(ctx,cam){
    const progress =
      1-Math.max(
        0,
        this.life/this.maxLife
      );

    const alpha = Math.max(
      0,
      this.life/this.maxLife
    );

    const x = this.x-cam.x;
    const y = this.y-cam.y;

    const radius =
      this.radius*(.25+.75*progress);

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = alpha;

    ctx.drawImage(
      radialSprite(
        this.color,
        "explosion"
      ),
      x-radius,
      y-radius,
      radius*2,
      radius*2
    );

    ctx.globalAlpha = 1;
    ctx.strokeStyle =
      rgba(this.color,alpha*.9);

    ctx.lineWidth =
      8*(1-progress)+2;

    ctx.beginPath();
    ctx.arc(
      x,
      y,
      radius,
      0,
      Math.PI*2
    );

    ctx.stroke();
    ctx.restore();
  };

  ShockwaveEffect.prototype.draw = function(ctx,cam){
    const progress =
      1-this.life/this.maxLife;

    const alpha = Math.max(
      0,
      this.life/this.maxLife
    );

    const radius = U.lerp(
      this.inner,
      this.radius,
      1-Math.pow(1-progress,3)
    );

    const x = this.x-cam.x;
    const y = this.y-cam.y;

    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    if(this.fill){
      ctx.globalAlpha = alpha;

      ctx.drawImage(
        radialSprite(
          this.color,
          "shockwave"
        ),
        x-radius,
        y-radius,
        radius*2,
        radius*2
      );

      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle =
      rgba(this.color,alpha*.75);

    ctx.lineWidth =
      U.lerp(10,1,progress);

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      radius,
      0,
      Math.PI*2
    );

    ctx.stroke();
    ctx.restore();
  };

  ExpGem.prototype.draw = function(ctx,cam){
    const bob =
      Math.sin(this.bobT)*3;

    const x = this.x-cam.x;
    const y = this.y-cam.y+bob;

    const color =
      this.value>=8
        ? "#65dcff"
        : "#ffd94e";

    const radius = this.radius;

    ctx.save();
    ctx.translate(x,y);

    ctx.rotate(
      Math.PI/4+
      this.bobT*.12
    );

    ctx.globalCompositeOperation =
      "source-over";

    ctx.fillStyle =
      rgba(color,.2);

    ctx.fillRect(
      -radius*2.5,
      -radius*2.5,
      radius*5,
      radius*5
    );

    ctx.fillStyle = color;

    polygonPath(ctx,[
      [0,-radius*1.5],
      [radius,0],
      [0,radius*1.5],
      [-radius,0]
    ]);

    ctx.fill();
    ctx.fillStyle = "#fff7dc";

    polygonPath(ctx,[
      [0,-radius*1.2],
      [radius*.28,0],
      [0,radius*.35],
      [-radius*.18,0]
    ]);

    ctx.fill();
    ctx.restore();
  };

  removeDead = function(arr){
    let write = 0;

    for(
      let read=0;
      read<arr.length;
      read++
    ){
      const item = arr[read];

      if(!item.dead){
        arr[write++] = item;
      }
    }

    arr.length = write;
  };

  const previousOnDeath =
    Enemy.prototype.onDeath;

  Enemy.prototype.onDeath = function(game){
    if(
      this._deathEffectQueued ||
      this._deathEffectFinished
    ){
      return;
    }

    this.dead = true;
    this._deathEffectQueued = true;

    const queue =
      game._deathEffectQueue ||
      (game._deathEffectQueue=[]);

    queue.push(this);
  };

  window.addEventListener(
    "DOMContentLoaded",
    () => {
      const game = window.__game;

      if(!game){
        return;
      }

      // 最初の撃破中に画像生成が起きないよう、
      // タイトル画面でキャッシュを準備する。
      const warmColors = new Set([
        ...Object.values(
          ENEMY_BASE
        ).map(info=>info.color),
        "#ffffff",
        "#ffdf5b",
        "#ffd94e"
      ]);

      for(const color of warmColors){
        for(
          let shape=0;
          shape<3;
          shape++
        ){
          particleSprite(
            color,
            shape
          );
        }

        radialSprite(
          color,
          "explosion"
        );

        radialSprite(
          color,
          "shockwave"
        );
      }

      game._deathEffectQueue = [];
      game._deathEffectHead = 0;

      const previousStart =
        game.startGame;

      game.startGame = function(){
        this._deathEffectQueue.length=0;
        this._deathEffectHead=0;

        return previousStart.call(this);
      };

      const previousUpdate =
        game.update;

      game.update = function(dt){
        let head =
          this._deathEffectHead;

        const count = Math.min(
          MAX_DEATH_EFFECTS_PER_FRAME,
          this._deathEffectQueue.length-head
        );

        for(
          let i=0;
          i<count;
          i++
        ){
          const enemy =
            this._deathEffectQueue[
              head++
            ];

          if(
            !enemy ||
            enemy._deathEffectFinished
          ){
            continue;
          }

          enemy._deathEffectQueued=false;
          enemy._deathEffectFinished=true;

          // 既存の撃破処理はdead判定を持つため、
          // 実行直前だけ戻し、完了後に再び死亡状態へする。
          enemy.dead=false;

          previousOnDeath.call(
            enemy,
            this
          );

          enemy.dead=true;
        }

        if(
          head >=
          this._deathEffectQueue.length
        ){
          this._deathEffectQueue.length=0;
          head=0;
        }else if(
          head>256 &&
          head*2 >
          this._deathEffectQueue.length
        ){
          this._deathEffectQueue.splice(
            0,
            head
          );

          head=0;
        }

        this._deathEffectHead=head;

        return previousUpdate.call(
          this,
          dt
        );
      };
    }
  );
})();

/* ===== Extension: performance-core-fix.js ===== */
"use strict";

(() => {
  const WORLD_SCALE = CONFIG.GROUND_RENDER_SCALE;
  const ATMOSPHERE_SCALE = 0.5;
  const DUST_COUNT = 36;

  const originalResize = Game.prototype.resize;

  Game.prototype.resize = function(){
    originalResize.call(this);

    const worldWidth = Math.max(
      1,
      Math.round(CONFIG.MAP_W * WORLD_SCALE)
    );

    const worldHeight = Math.max(
      1,
      Math.round(CONFIG.MAP_H * WORLD_SCALE)
    );

    if (
      this.groundCanvas.width !== worldWidth ||
      this.groundCanvas.height !== worldHeight
    ){
      this.groundCanvas.width = worldWidth;
      this.groundCanvas.height = worldHeight;
    }

    this.groundCtx.setTransform(
      WORLD_SCALE,0,0,WORLD_SCALE,0,0
    );

    this.groundCtx.imageSmoothingEnabled = true;

    this._staticGroundStage = -1;
    this._staticGroundDirty = true;
    this._playerLightStage = -1;
    this._atmosphereStage = -1;
    this._atmosphereWidth = 0;
    this._atmosphereHeight = 0;
  };

  Game.prototype.refreshGroundCache = function(){
    const stage = stageIndexForTime(
      this.elapsed || 0
    );

    if (
      !this._staticGroundDirty &&
      this._staticGroundStage === stage
    ){
      return;
    }

    const ctx = this.groundCtx;
    const savedPlayer = this.player;

    ctx.setTransform(1,0,0,1,0,0);

    ctx.clearRect(
      0,
      0,
      this.groundCanvas.width,
      this.groundCanvas.height
    );

    ctx.setTransform(
      WORLD_SCALE,0,0,WORLD_SCALE,0,0
    );

    this.player = null;

    try{
      this.drawGround(
        ctx,
        {x:0,y:0},
        CONFIG.MAP_W,
        CONFIG.MAP_H
      );
    }finally{
      this.player = savedPlayer;
    }

    this._staticGroundStage = stage;
    this._staticGroundDirty = false;
  };

  Game.prototype._ensurePlayerLightSprite = function(){
    const stage = stageIndexForTime(
      this.elapsed || 0
    );

    if (!this._playerLightCanvas){
      this._playerLightCanvas =
        document.createElement("canvas");

      this._playerLightCanvas.width = 512;
      this._playerLightCanvas.height = 512;

      this._playerLightCtx =
        this._playerLightCanvas.getContext("2d");
    }

    if (this._playerLightStage === stage){
      return;
    }

    const ctx = this._playerLightCtx;
    const st = STAGE_VISUALS[stage];
    const center = 256;

    ctx.clearRect(0,0,512,512);

    const gradient = ctx.createRadialGradient(
      center,
      center,
      0,
      center,
      center,
      center
    );

    gradient.addColorStop(
      0,
      rgba("#fff7dc",.13)
    );

    gradient.addColorStop(
      .22,
      rgba(st.accent,.16)
    );

    gradient.addColorStop(
      .55,
      rgba(st.accent2,.055)
    );

    gradient.addColorStop(
      1,
      rgba(st.accent,0)
    );

    ctx.fillStyle = gradient;
    ctx.fillRect(0,0,512,512);

    this._playerLightStage = stage;
  };

  Game.prototype._drawDynamicGroundLayer =
  function(ctx,cam,w,h){
    const time = this.elapsed || 0;
    const stage = stageIndexForTime(time);
    const st = STAGE_VISUALS[stage];

    if (this.player){
      this._ensurePlayerLightSprite();

      const diameter = 860;
      const x = this.player.x-cam.x;
      const y = this.player.y-cam.y;

      ctx.drawImage(
        this._playerLightCanvas,
        x-diameter*.5,
        y-diameter*.5,
        diameter,
        diameter
      );
    }

    for (let i=0; i<DUST_COUNT; i++){
      const seed = U.hash(i,stage+71);

      const wx = (
        seed*CONFIG.MAP_W +
        time*(8+seed*14)
      ) % CONFIG.MAP_W;

      const wy = (
        U.hash(i+9,77)*CONFIG.MAP_H +
        Math.sin(time*.2+i)*20
      ) % CONFIG.MAP_H;

      const x = wx-cam.x*.45;
      const y = wy-cam.y*.45;

      if (
        x < -20 ||
        x > w+20 ||
        y < -20 ||
        y > h+20
      ){
        continue;
      }

      ctx.fillStyle = rgba(
        i%3 ? st.accent : "#fff7dc",
        .16+seed*.25
      );

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        .8+seed*1.7,
        0,
        Math.PI*2
      );

      ctx.fill();
    }
  };

  Game.prototype.drawGroundCached =
  function(ctx,cam,w,h){
    this.refreshGroundCache();

    const sourceWidth = Math.min(
      this.groundCanvas.width,
      Math.max(1,w*WORLD_SCALE)
    );

    const sourceHeight = Math.min(
      this.groundCanvas.height,
      Math.max(1,h*WORLD_SCALE)
    );

    const sourceX = U.clamp(
      cam.x*WORLD_SCALE,
      0,
      Math.max(
        0,
        this.groundCanvas.width-sourceWidth
      )
    );

    const sourceY = U.clamp(
      cam.y*WORLD_SCALE,
      0,
      Math.max(
        0,
        this.groundCanvas.height-sourceHeight
      )
    );

    ctx.drawImage(
      this.groundCanvas,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      w,
      h
    );

    this._drawDynamicGroundLayer(
      ctx,
      cam,
      w,
      h
    );
  };

  Game.prototype._ensureAtmosphereCache =
  function(w,h){
    const stage = stageIndexForTime(
      this.elapsed || 0
    );

    const width = Math.max(
      1,
      Math.round(w*ATMOSPHERE_SCALE)
    );

    const height = Math.max(
      1,
      Math.round(h*ATMOSPHERE_SCALE)
    );

    if (!this._atmosphereCanvas){
      this._atmosphereCanvas =
        document.createElement("canvas");

      this._atmosphereCtx =
        this._atmosphereCanvas.getContext("2d");
    }

    if (
      this._atmosphereStage === stage &&
      this._atmosphereWidth === width &&
      this._atmosphereHeight === height
    ){
      return;
    }

    this._atmosphereCanvas.width = width;
    this._atmosphereCanvas.height = height;

    const ctx = this._atmosphereCtx;
    const st = STAGE_VISUALS[stage];

    ctx.setTransform(
      ATMOSPHERE_SCALE,
      0,
      0,
      ATMOSPHERE_SCALE,
      0,
      0
    );

    ctx.clearRect(0,0,w,h);

    const vignette =
      ctx.createRadialGradient(
        w/2,
        h/2,
        Math.min(w,h)*.25,
        w/2,
        h/2,
        Math.max(w,h)*.72
      );

    vignette.addColorStop(
      0,
      "rgba(0,0,0,0)"
    );

    vignette.addColorStop(
      .72,
      "rgba(0,0,0,.025)"
    );

    vignette.addColorStop(
      1,
      "rgba(0,0,0,.30)"
    );

    ctx.fillStyle = vignette;
    ctx.fillRect(0,0,w,h);

    const top =
      ctx.createLinearGradient(0,0,0,h);

    top.addColorStop(
      0,
      rgba(st.fog,.11)
    );

    top.addColorStop(
      .25,
      rgba(st.fog,0)
    );

    top.addColorStop(
      .75,
      rgba(st.danger,0)
    );

    top.addColorStop(
      1,
      rgba(st.danger,.08)
    );

    ctx.fillStyle = top;
    ctx.fillRect(0,0,w,h);

    this._atmosphereStage = stage;
    this._atmosphereWidth = width;
    this._atmosphereHeight = height;
  };

  Game.prototype._ensureScanlinePattern =
  function(ctx){
    if (this._scanlinePattern){
      return this._scanlinePattern;
    }

    const canvas =
      document.createElement("canvas");

    canvas.width = 1;
    canvas.height = 7;

    const patternCtx =
      canvas.getContext("2d");

    patternCtx.fillStyle =
      "rgba(255,255,255,.035)";

    patternCtx.fillRect(0,0,1,1);

    this._scanlinePattern =
      ctx.createPattern(canvas,"repeat");

    return this._scanlinePattern;
  };

  Game.prototype.drawAtmosphereOverlay =
  function(ctx,w,h){
    const st = stageVisualForTime(
      this.elapsed || 0
    );

    const time = this.elapsed || 0;

    this._ensureAtmosphereCache(w,h);

    ctx.drawImage(
      this._atmosphereCanvas,
      0,
      0,
      w,
      h
    );

    const pattern =
      this._ensureScanlinePattern(ctx);

    if (pattern){
      ctx.save();

      ctx.translate(
        0,
        (time*18)%7
      );

      ctx.fillStyle = pattern;

      ctx.fillRect(
        0,
        -7,
        w,
        h+14
      );

      ctx.restore();
    }

    if (this.stageTransition>0){
      const total =
        this.stageIndex===0
          ? 1.9
          : 2.35;

      const alpha =
        U.clamp(
          this.stageTransition/.42,
          0,
          1
        ) *
        U.clamp(
          (total-this.stageTransition)/.35,
          0,
          1
        );

      const progress =
        1-this.stageTransition/total;

      ctx.save();

      ctx.translate(
        48,
        h*.34
      );

      ctx.globalAlpha = alpha;
      ctx.textAlign = "left";

      ctx.fillStyle =
        rgba("#090718",.76);

      ctx.fillRect(
        -18,
        -62,
        330,
        112
      );

      ctx.fillStyle = st.accent;

      ctx.fillRect(
        -18,
        -62,
        9,
        112
      );

      ctx.shadowColor = st.accent;
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff7dc";

      ctx.font =
        `1000 ${
          Math.round(
            40+
            8*Math.sin(
              progress*Math.PI
            )
          )
        }px Arial Black, sans-serif`;

      ctx.fillText(
        st.name,
        8,
        -5
      );

      ctx.shadowBlur = 0;
      ctx.fillStyle = st.accent2;
      ctx.font = "900 11px monospace";

      ctx.fillText(
        st.code+" / CHROMA ABYSS",
        10,
        24
      );

      ctx.strokeStyle =
        rgba(st.accent,.75);

      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10,36);
      ctx.lineTo(270,36);
      ctx.stroke();

      ctx.fillStyle =
        rgba(st.accent,.18);

      ctx.font =
        "1000 70px Arial Black";

      ctx.fillText(
        String(
          this.stageIndex+1
        ).padStart(2,"0"),
        225,
        10
      );

      ctx.restore();
    }
  };

  const originalStartGame =
    Game.prototype.startGame;

  Game.prototype.startGame =
  function(){
    this._staticGroundDirty = true;
    this._staticGroundStage = -1;
    this._playerLightStage = -1;
    this._atmosphereStage = -1;

    return originalStartGame.call(this);
  };

  class SpatialHash{
    constructor(cellSize){
      this.cellSize = cellSize;
      this.buckets = new Map();
    }

    clear(){
      this.buckets.clear();
    }

    _key(cx,cy){
      return cx+":"+cy;
    }

    insert(item){
      const cx = Math.floor(
        item.x/this.cellSize
      );

      const cy = Math.floor(
        item.y/this.cellSize
      );

      const key = this._key(cx,cy);

      let bucket =
        this.buckets.get(key);

      if (!bucket){
        bucket = [];
        this.buckets.set(
          key,
          bucket
        );
      }

      bucket.push(item);
    }

    rebuild(items,skipDead){
      this.clear();

      for (const item of items){
        if (
          !item ||
          (skipDead && item.dead)
        ){
          continue;
        }

        this.insert(item);
      }
    }

    forEachNearby(
      x,
      y,
      radius,
      callback
    ){
      const minX = Math.floor(
        (x-radius)/this.cellSize
      );

      const maxX = Math.floor(
        (x+radius)/this.cellSize
      );

      const minY = Math.floor(
        (y-radius)/this.cellSize
      );

      const maxY = Math.floor(
        (y+radius)/this.cellSize
      );

      for (
        let cy=minY;
        cy<=maxY;
        cy++
      ){
        for (
          let cx=minX;
          cx<=maxX;
          cx++
        ){
          const bucket =
            this.buckets.get(
              this._key(cx,cy)
            );

          if (!bucket){
            continue;
          }

          for (const item of bucket){
            callback(item);
          }
        }
      }
    }
  }

  const originalCircleHitObstacle =
    circleHitObstacle;

  circleHitObstacle =
  function(x,y,radius,obstacles){
    const game = window.__game;

    if (
      !game ||
      obstacles !== game.obstacles ||
      !game._obstacleSpatial
    ){
      return originalCircleHitObstacle(
        x,
        y,
        radius,
        obstacles
      );
    }

    let hit = null;

    game._obstacleSpatial.forEachNearby(
      x,
      y,
      radius+90,
      obstacle => {
        if (hit){
          return;
        }

        const total =
          radius+obstacle.radius;

        if (
          U.dist2(
            x,
            y,
            obstacle.x,
            obstacle.y
          ) < total*total
        ){
          hit = obstacle;
        }
      }
    );

    return hit;
  };

  Enemy.prototype.update =
  function(
    dt,
    player,
    enemies,
    obstacles,
    game
  ){
    this.animT += dt;
    this.spawnAge += dt;

    if (this.hitFlash>0){
      this.hitFlash -= dt;
    }

    if (this.contactCd>0){
      this.contactCd -= dt;
    }

    const distanceToPlayer =
      U.dist(
        this.x,
        this.y,
        player.x,
        player.y
      );

    let moveAngle =
      U.angle(
        this.x,
        this.y,
        player.x,
        player.y
      );

    this.facing = moveAngle;

    if (this.type === "ranged"){
      const desired = 340;

      if (
        distanceToPlayer <
        desired-30
      ){
        moveAngle += Math.PI;
      }else if (
        distanceToPlayer <
        desired+30
      ){
        moveAngle +=
          Math.PI/2 *
          (
            this.avoidAngleOffset>0
              ? 1
              : -1
          );
      }

      this.shootCd -= dt;

      if (
        this.shootCd<=0 &&
        distanceToPlayer<700
      ){
        this.shootCd =
          U.rand(1.6,2.4) /
          game.balanceMul.spawnMul;

        const angle =
          U.angle(
            this.x,
            this.y,
            player.x,
            player.y
          );

        if (
          game.enemyProjectiles.length <
          CONFIG.MAX_ENEMY_PROJECTILES
        ){
          game.enemyProjectiles.push(
            new EnemyProjectile(
              this.x,
              this.y,
              Math.cos(angle)*260,
              Math.sin(angle)*260,
              this.atk,
              7,
              "#ffd84f"
            )
          );
        }

        game.addEffect(
          new MuzzleEffect(
            this.x,
            this.y,
            angle,
            "#ffd84f",
            25
          )
        );
      }
    }

    const obstacleGrid =
      game._obstacleSpatial;

    if (obstacleGrid){
      obstacleGrid.forEachNearby(
        this.x,
        this.y,
        this.radius+100,
        obstacle => {
          const total =
            obstacle.radius+
            this.radius+
            40;

          if (
            U.dist2(
              this.x,
              this.y,
              obstacle.x,
              obstacle.y
            ) < total*total
          ){
            const away =
              U.angle(
                obstacle.x,
                obstacle.y,
                this.x,
                this.y
              );

            moveAngle =
              moveAngle*.5+
              away*.5;
          }
        }
      );
    }else{
      for (const obstacle of obstacles){
        const distance =
          U.dist(
            this.x,
            this.y,
            obstacle.x,
            obstacle.y
          );

        if (
          distance <
          obstacle.radius+
          this.radius+
          40
        ){
          const away =
            U.angle(
              obstacle.x,
              obstacle.y,
              this.x,
              this.y
            );

          moveAngle =
            moveAngle*.5+
            away*.5;
        }
      }
    }

    let separationX = 0;
    let separationY = 0;
    let separationCount = 0;

    const enemyGrid =
      game._enemySpatial;

    const separateFrom =
    other => {
      if (
        other===this ||
        other.dead
      ){
        return;
      }

      const distance2 =
        U.dist2(
          this.x,
          this.y,
          other.x,
          other.y
        );

      const minDistance =
        this.radius+
        other.radius+
        8;

      if (
        distance2 <
        minDistance*minDistance &&
        distance2>.01
      ){
        const distance =
          Math.sqrt(distance2);

        separationX +=
          (this.x-other.x)/distance;

        separationY +=
          (this.y-other.y)/distance;

        separationCount++;
      }
    };

    if (enemyGrid){
      enemyGrid.forEachNearby(
        this.x,
        this.y,
        this.radius+70,
        separateFrom
      );
    }else{
      for (const other of enemies){
        separateFrom(other);
      }
    }

    let moveX = Math.cos(moveAngle);
    let moveY = Math.sin(moveAngle);

    if (separationCount>0){
      moveX +=
        separationX /
        separationCount *
        1.1;

      moveY +=
        separationY /
        separationCount *
        1.1;

      const length =
        Math.hypot(
          moveX,
          moveY
        ) || 1;

      moveX /= length;
      moveY /= length;
    }

    const nextX =
      this.x+
      moveX*this.speed*dt;

    const nextY =
      this.y+
      moveY*this.speed*dt;

    if (
      !circleHitObstacle(
        nextX,
        this.y,
        this.radius,
        obstacles
      )
    ){
      this.x = nextX;
    }

    if (
      !circleHitObstacle(
        this.x,
        nextY,
        this.radius,
        obstacles
      )
    ){
      this.y = nextY;
    }

    this.x = U.clamp(
      this.x,
      this.radius,
      CONFIG.MAP_W-this.radius
    );

    this.y = U.clamp(
      this.y,
      this.radius,
      CONFIG.MAP_H-this.radius
    );

    if (
      distanceToPlayer <
      this.radius+player.radius &&
      this.contactCd<=0
    ){
      player.takeDamage(
        this.atk,
        game
      );

      this.contactCd = .6;
    }
  };

  window.addEventListener(
    "DOMContentLoaded",
    () => {
      const game = window.__game;

      if (!game){
        return;
      }

      game._enemySpatial =
        new SpatialHash(160);

      game._obstacleSpatial =
        new SpatialHash(192);

      game._obstacleSpatialLength = -1;
      game._obstacleSpatialSource = null;

      const previousUpdate =
        game.update;

      game.update = function(dt){
        this._enemySpatial.rebuild(
          this.enemies,
          true
        );

        if (
          this._obstacleSpatialSource !==
            this.obstacles ||
          this._obstacleSpatialLength !==
            this.obstacles.length
        ){
          this._obstacleSpatial.rebuild(
            this.obstacles,
            false
          );

          this._obstacleSpatialSource =
            this.obstacles;

          this._obstacleSpatialLength =
            this.obstacles.length;
        }

        return previousUpdate.call(
          this,
          dt
        );
      };
    }
  );

  const style =
    document.createElement("style");

  style.textContent = `
    #gameCanvas{
      filter:none!important;
      transform:translateZ(0);
      backface-visibility:hidden;
      contain:paint
    }

    body::before{
      opacity:.045!important;
      mix-blend-mode:normal!important
    }
  `;

  document.head.appendChild(style);
})();

/* ===== Extension: performance-longrun-fix.js ===== */
"use strict";

(() => {
  const MAX_ACTIVE_GEMS = 180;
  const HIT_TIMER_RETENTION_MS = 1400;

  const QUALITY_LEVELS = [
    { pixels:2300000, dpr:1.25 },
    { pixels:1650000, dpr:1.00 },
    { pixels:1200000, dpr:0.85 }
  ];

  function forEachEnemyNear(
    game,
    x,
    y,
    radius,
    callback
  ){
    const grid = game && game._enemySpatial;

    if(
      grid &&
      typeof grid.forEachNearby === "function"
    ){
      grid.forEachNearby(
        x,
        y,
        radius,
        callback
      );

      return;
    }

    for(const enemy of game.enemies){
      callback(enemy);
    }
  }

  /*
   * 背景の動的描画を停止。
   * 地形キャッシュ自体はカメラに合わせて移動するが、
   * 星屑・プレイヤー光・背景アニメーションは動かさない。
   */
  Game.prototype._drawDynamicGroundLayer =
  function(){};

  /*
   * 大気レイヤーの移動スキャンラインを停止。
   */
  Game.prototype._ensureScanlinePattern =
  function(){
    return null;
  };

  function freezeDecorations(game){
    for(
      const decoration of
      game.decorations || []
    ){
      if(
        !decoration ||
        decoration._staticPerformanceDraw ||
        typeof decoration.draw !== "function"
      ){
        continue;
      }

      const originalDraw =
        decoration.draw;

      decoration.draw =
      function(
        ctx,
        cam,
        stageVisual
      ){
        return originalDraw.call(
          this,
          ctx,
          cam,
          stageVisual,
          0
        );
      };

      decoration._staticPerformanceDraw =
        true;
    }
  }

  const previousStartGame =
    Game.prototype.startGame;

  Game.prototype.startGame =
  function(){
    const result =
      previousStartGame.call(this);

    freezeDecorations(this);

    return result;
  };

  /*
   * 経験値ジェムは時間とともに増え続ける。
   * 180個を超えた分は既存ジェムへ値を合算する。
   * 経験値の総量は変化しない。
   */
  const previousSpawnExpGem =
    Game.prototype.spawnExpGem;

  if(
    typeof previousSpawnExpGem ===
    "function"
  ){
    Game.prototype.spawnExpGem =
    function(x,y,value){
      const gems = this.gems;

      if(
        !gems ||
        gems.length <
          MAX_ACTIVE_GEMS
      ){
        return previousSpawnExpGem.call(
          this,
          x,
          y,
          value
        );
      }

      const length = gems.length;
      const start =
        this._gemMergeCursor || 0;

      const sampleCount =
        Math.min(40,length);

      let target = null;
      let bestDistance2 = Infinity;

      for(
        let i=0;
        i<sampleCount;
        i++
      ){
        const index =
          (start+i*17)%length;

        const gem = gems[index];

        if(
          !gem ||
          gem.dead ||
          gem.attracted
        ){
          continue;
        }

        const distance2 =
          U.dist2(
            x,
            y,
            gem.x,
            gem.y
          );

        if(
          distance2 <
          bestDistance2
        ){
          bestDistance2 =
            distance2;

          target = gem;
        }
      }

      this._gemMergeCursor =
        (
          start+
          sampleCount
        ) %
        Math.max(1,length);

      if(!target){
        for(const gem of gems){
          if(gem && !gem.dead){
            target = gem;
            break;
          }
        }
      }

      if(!target){
        return previousSpawnExpGem.call(
          this,
          x,
          y,
          value
        );
      }

      target.value += value;

      target.radius =
        target.value>=8
          ? 6
          : 4;

      target.x =
        target.x*.82+
        x*.18;

      target.y =
        target.y*.82+
        y*.18;

      return target;
    };
  }

  /*
   * 通常の索敵を全敵走査から空間グリッド検索へ変更。
   */
  if(
    typeof nearestEnemy ===
    "function"
  ){
    const previousNearestEnemy =
      nearestEnemy;

    nearestEnemy =
    function(
      x,
      y,
      enemies,
      maxDistance
    ){
      const game = window.__game;
      const grid =
        game && game._enemySpatial;

      if(
        !game ||
        enemies !== game.enemies ||
        !grid ||
        typeof grid.forEachNearby !==
          "function"
      ){
        return previousNearestEnemy(
          x,
          y,
          enemies,
          maxDistance
        );
      }

      const radius =
        Number.isFinite(maxDistance)
          ? maxDistance
          : Math.max(
              CONFIG.MAP_W,
              CONFIG.MAP_H
            );

      let nearest = null;
      let nearestDistance2 =
        radius*radius;

      grid.forEachNearby(
        x,
        y,
        radius,
        enemy => {
          if(
            !enemy ||
            enemy.dead
          ){
            return;
          }

          const distance2 =
            U.dist2(
              x,
              y,
              enemy.x,
              enemy.y
            );

          if(
            distance2 <
            nearestDistance2
          ){
            nearestDistance2 =
              distance2;

            nearest = enemy;
          }
        }
      );

      return nearest;
    };
  }

  /*
   * 旋回ブレード。
   * 各ブレードが全敵を調べず、周囲の敵だけを調べる。
   */
  Game.prototype.updateBladeWeapon =
  function(w,dt){
    const p = this.player;
    const count = 1+w.level;

    const orbitRadius =
      60+w.level*10;

    const now =
      performance.now();

    w.spinAngle +=
      dt*(2.4+w.level*.2);

    const bladeDamage =
      Math.round(
        p.atk *
        (.5+w.level*.18) *
        p.effAtkMul *
        p.damageAmp *
        this.weaponPower(w)
      );

    for(
      let i=0;
      i<count;
      i++
    ){
      const angle =
        w.spinAngle+
        (i/count)*Math.PI*2;

      const bx =
        p.x+
        Math.cos(angle)*
        orbitRadius;

      const by =
        p.y+
        Math.sin(angle)*
        orbitRadius;

      forEachEnemyNear(
        this,
        bx,
        by,
        90,
        enemy => {
          if(
            !enemy ||
            enemy.dead
          ){
            return;
          }

          const hitRadius =
            enemy.radius+12;

          if(
            U.dist2(
              bx,
              by,
              enemy.x,
              enemy.y
            ) >=
            hitRadius*hitRadius
          ){
            return;
          }

          const key =
            enemy.uid+"_"+i;

          const last =
            w.hitTimers.get(key) ||
            0;

          if(now-last<=380){
            return;
          }

          w.hitTimers.set(
            key,
            now
          );

          const crit =
            Math.random() <
            p.critChance;

          this.damageEnemy(
            enemy,
            crit
              ? bladeDamage*
                p.critMult
              : bladeDamage,
            crit,
            enemy
          );
        }
      );

      if(
        this.boss &&
        !this.boss.dead
      ){
        const hitRadius =
          this.boss.radius+12;

        if(
          U.dist2(
            bx,
            by,
            this.boss.x,
            this.boss.y
          ) <
          hitRadius*hitRadius
        ){
          const key =
            "boss_"+i;

          const last =
            w.hitTimers.get(key) ||
            0;

          if(now-last>380){
            w.hitTimers.set(
              key,
              now
            );

            const crit =
              Math.random() <
              p.critChance;

            this.damageBoss(
              crit
                ? bladeDamage*
                  p.critMult
                : bladeDamage,
              crit
            );
          }
        }
      }
    }
  };

  /*
   * 雷の次の連鎖先を近隣グリッドから検索。
   */
  Game.prototype.strikeLightning =
  function(
    target,
    dmg,
    crit,
    chainsLeft,
    hitSet,
    fromX,
    fromY
  ){
    if(
      !target ||
      target.dead
    ){
      return;
    }

    const sx =
      fromX==null
        ? this.player.x
        : fromX;

    const sy =
      fromY==null
        ? this.player.y
        : fromY;

    this.addEffect(
      new LightningEffect(
        sx,
        sy,
        target.x,
        target.y,
        WEAPON_DEFS.lightning.color,
        .2,
        crit ? 6 : 4
      )
    );

    this.addEffect(
      new ShockwaveEffect(
        target.x,
        target.y,
        WEAPON_DEFS.lightning.color,
        48,
        .22,
        {inner:4}
      )
    );

    spawnParticles(
      this.particles,
      target.x,
      target.y,
      10,
      WEAPON_DEFS.lightning.color,
      200,
      .3,
      4
    );

    this.damageEnemyOrBoss(
      target,
      dmg,
      crit
    );

    hitSet.add(
      target===this.boss
        ? "boss"
        : target.uid
    );

    if(chainsLeft<=0){
      return;
    }

    let next = null;
    let bestDistance2 =
      260*260;

    forEachEnemyNear(
      this,
      target.x,
      target.y,
      260,
      enemy => {
        if(
          !enemy ||
          enemy.dead ||
          hitSet.has(enemy.uid)
        ){
          return;
        }

        const distance2 =
          U.dist2(
            target.x,
            target.y,
            enemy.x,
            enemy.y
          );

        if(
          distance2 <
          bestDistance2
        ){
          bestDistance2 =
            distance2;

          next = enemy;
        }
      }
    );

    if(next){
      this.strikeLightning(
        next,
        Math.round(dmg*.8),
        crit,
        chainsLeft-1,
        hitSet,
        target.x,
        target.y
      );
    }
  };

  /*
   * 範囲爆発の対象検索を空間グリッド化。
   */
  Game.prototype.updateExplosionWeapon =
  function(w,dt){
    const p = this.player;

    if(w.explosionGhost){
      w.explosionGhost.life -= dt;

      if(
        w.explosionGhost.life<=0
      ){
        w.explosionGhost = null;
      }
    }

    if(w.pendingExplosion){
      w.pendingExplosion.delay -= dt;

      if(
        w.pendingExplosion.delay<=0
      ){
        const explosion =
          w.pendingExplosion;

        w.pendingExplosion = null;

        this.sound.explosion();
        this.shake(8,.22);

        this.addEffect(
          new ShockwaveEffect(
            explosion.x,
            explosion.y,
            WEAPON_DEFS.explosion.color,
            explosion.radius*1.28,
            .55,
            {
              inner:18,
              fill:true
            }
          )
        );

        this.addEffect(
          new ImpactEffect(
            explosion.x,
            explosion.y,
            "#fff7dc",
            explosion.radius*.55,
            .35,
            0,
            explosion.crit
          )
        );

        spawnParticles(
          this.particles,
          explosion.x,
          explosion.y,
          42,
          WEAPON_DEFS.explosion.color,
          330,
          .65,
          7
        );

        forEachEnemyNear(
          this,
          explosion.x,
          explosion.y,
          explosion.radius+80,
          enemy => {
            if(
              !enemy ||
              enemy.dead
            ){
              return;
            }

            const hitRadius =
              explosion.radius+
              enemy.radius;

            if(
              U.dist2(
                explosion.x,
                explosion.y,
                enemy.x,
                enemy.y
              ) <
              hitRadius*hitRadius
            ){
              this.damageEnemy(
                enemy,
                explosion.dmg,
                explosion.crit
              );
            }
          }
        );

        if(
          this.boss &&
          !this.boss.dead
        ){
          const hitRadius =
            explosion.radius+
            this.boss.radius;

          if(
            U.dist2(
              explosion.x,
              explosion.y,
              this.boss.x,
              this.boss.y
            ) <
            hitRadius*hitRadius
          ){
            this.damageBoss(
              explosion.dmg,
              explosion.crit
            );
          }
        }
      }

      return;
    }

    const interval =
      2.2/
      (
        1+
        (w.level-1)*.1
      );

    if(w.cd>0){
      return;
    }

    w.cd = interval;

    const radius =
      (
        100+
        w.level*16+
        (w.tier-1)*22
      ) *
      p.explosionRadiusMul;

    const result =
      this.computeDamage(
        p.atk,
        (
          1.1+
          (w.level-1)*.3
        ) *
        this.weaponPower(w) *
        p.explosionDamageMul
      );

    w.pendingExplosion = {
      x:p.x,
      y:p.y,
      radius,
      dmg:result.dmg,
      crit:result.crit,
      delay:.45
    };

    w.explosionGhost = {
      x:p.x,
      y:p.y,
      radius,
      life:.45,
      maxLife:.45
    };

    spawnParticles(
      this.particles,
      p.x,
      p.y,
      5,
      WEAPON_DEFS.explosion.color,
      48,
      .4,
      3
    );
  };

  /*
   * レーザーの対象検索を空間グリッド化。
   */
  Game.prototype.updateLaserWeapon =
  function(w,dt){
    const p = this.player;

    const interval =
      2.6/
      (
        1+
        (w.level-1)*.1
      );

    const duration =
      .9+w.level*.1;

    if(w.laserActiveTime>0){
      w.laserActiveTime -= dt;

      const angle =
        w.laserTargetAngle;

      const range = 620;

      const endX =
        p.x+
        Math.cos(angle)*range;

      const endY =
        p.y+
        Math.sin(angle)*range;

      const laserWidth =
        20+
        (w.tier-1)*5;

      w.laserTickTimer -= dt;

      if(
        w.laserTickTimer<=0
      ){
        const tick = .1;

        w.laserTickTimer += tick;

        const damagePerSecond =
          p.atk *
          (
            .9+
            (w.level-1)*.2
          ) *
          p.effAtkMul *
          p.damageAmp *
          this.weaponPower(w);

        const damage =
          Math.max(
            1,
            Math.round(
              damagePerSecond*
              tick
            )
          );

        const centerX =
          (p.x+endX)*.5;

        const centerY =
          (p.y+endY)*.5;

        forEachEnemyNear(
          this,
          centerX,
          centerY,
          range*.5+100,
          enemy => {
            if(
              !enemy ||
              enemy.dead
            ){
              return;
            }

            if(
              pointToSegmentDist(
                enemy.x,
                enemy.y,
                p.x,
                p.y,
                endX,
                endY
              ) <
              enemy.radius+
              laserWidth
            ){
              this.damageEnemy(
                enemy,
                damage,
                false
              );
            }
          }
        );

        if(
          this.boss &&
          !this.boss.dead &&
          pointToSegmentDist(
            this.boss.x,
            this.boss.y,
            p.x,
            p.y,
            endX,
            endY
          ) <
          this.boss.radius+
          laserWidth
        ){
          this.damageBoss(
            damage,
            false
          );
        }
      }

      if(Math.random()<.3){
        const distance =
          U.rand(
            50,
            range*.8
          );

        spawnParticles(
          this.particles,
          p.x+
            Math.cos(angle)*
            distance,
          p.y+
            Math.sin(angle)*
            distance,
          1,
          WEAPON_DEFS.laser.color,
          30,
          .2,
          3
        );
      }

      if(
        w.laserActiveTime<=0
      ){
        w.cd = interval;
      }

      return;
    }

    if(w.cd>0){
      return;
    }

    const target =
      nearestEnemy(
        p.x,
        p.y,
        this.enemies,
        900
      ) ||
      (
        this.boss &&
        !this.boss.dead
          ? this.boss
          : null
      );

    if(!target){
      return;
    }

    w.laserTargetAngle =
      U.angle(
        p.x,
        p.y,
        target.x,
        target.y
      );

    w.laserActiveTime =
      duration;

    w.laserTickTimer = 0;

    this.sound.laser();
  };

  function createFpsBadge(){
    let badge =
      document.getElementById(
        "fpsCounter"
      );

    if(badge){
      return badge;
    }

    badge =
      document.createElement(
        "div"
      );

    badge.id = "fpsCounter";
    badge.textContent = "FPS --";

    badge.setAttribute(
      "aria-label",
      "frames per second"
    );

    document.body.appendChild(
      badge
    );

    return badge;
  }

  const style =
    document.createElement(
      "style"
    );

  style.textContent = `
    #fpsCounter{
      position:fixed;
      left:14px;
      bottom:14px;
      z-index:120;
      min-width:86px;
      padding:7px 10px;
      border:2px solid #fff7dc;
      background:#090718e6;
      color:#5dffd2;
      box-shadow:4px 4px 0 #5868ff;
      font:900 17px/1 "Arial Black","Yu Gothic UI",sans-serif;
      letter-spacing:.04em;
      text-align:center;
      pointer-events:none;
      font-variant-numeric:tabular-nums;
    }
  `;

  document.head.appendChild(
    style
  );

  window.addEventListener(
    "DOMContentLoaded",
    () => {
      const game = window.__game;

      const badge =
        createFpsBadge();

      if(!game){
        return;
      }

      let qualityLevel = 0;
      let lowSamples = 0;
      let highSamples = 0;

      let lastQualityChange =
        -Infinity;

      let frameCount = 0;

      let sampleStart =
        performance.now();

      function applyQuality(
        level,
        now
      ){
        if(level===qualityLevel){
          return;
        }

        qualityLevel = level;

        CONFIG.MAX_CANVAS_PIXELS =
          QUALITY_LEVELS[
            level
          ].pixels;

        CONFIG.MAX_DPR =
          QUALITY_LEVELS[
            level
          ].dpr;

        game.resize();

        lastQualityChange = now;
        lowSamples = 0;
        highSamples = 0;
      }

      const previousUpdate =
        game.update;

      game._performanceCleanupTimer =
        0;

      game.update =
      function(dt){
        this._performanceCleanupTimer +=
          dt;

        if(
          this._performanceCleanupTimer >=
          2
        ){
          this._performanceCleanupTimer =
            0;

          const cutoff =
            performance.now()-
            HIT_TIMER_RETENTION_MS;

          for(
            const weapon of
            this.player?.weapons || []
          ){
            if(
              !(
                weapon.hitTimers
                instanceof Map
              )
            ){
              continue;
            }

            for(
              const [
                key,
                time
              ] of
              weapon.hitTimers
            ){
              if(time<cutoff){
                weapon.hitTimers.delete(
                  key
                );
              }
            }
          }

          freezeDecorations(this);
        }

        return previousUpdate.call(
          this,
          dt
        );
      };

      function fpsLoop(now){
        frameCount++;

        const elapsed =
          now-sampleStart;

        if(elapsed>=750){
          const fps =
            frameCount*
            1000/
            elapsed;

          badge.textContent =
            "FPS "+
            Math.round(fps);

          badge.style.color =
            fps>=50
              ? "#5dffd2"
              : fps>=30
                ? "#ffd94e"
                : "#ff617e";

          if(
            game.state==="playing" &&
            now-lastQualityChange>8000
          ){
            if(fps<30){
              lowSamples++;
              highSamples = 0;
            }else if(fps>52){
              highSamples++;

              lowSamples =
                Math.max(
                  0,
                  lowSamples-1
                );
            }else{
              lowSamples =
                Math.max(
                  0,
                  lowSamples-1
                );

              highSamples = 0;
            }

            if(
              lowSamples>=4 &&
              qualityLevel <
                QUALITY_LEVELS.length-1
            ){
              applyQuality(
                qualityLevel+1,
                now
              );
            }else if(
              highSamples>=12 &&
              qualityLevel>0
            ){
              applyQuality(
                qualityLevel-1,
                now
              );
            }
          }

          frameCount = 0;
          sampleStart = now;
        }

        requestAnimationFrame(
          fpsLoop
        );
      }

      requestAnimationFrame(
        fpsLoop
      );
    }
  );
})();

/* ===== Extension: performance-critical-fix.js ===== */
"use strict";

(() => {
  const GEM_CELL_SIZE = 360;
  const GEM_COMPACT_INTERVAL = 0.45;

  const perf = {
    updateMs: 0,
    renderMs: 0,
    gemTimer: 0
  };

  function setPresentationMode(game){
    const isTitle =
      game.state === "title";

    const isSkillTree =
      game.state === "skilltree";

    game.canvas.style.display =
      isTitle || isSkillTree
        ? "none"
        : "block";

    document.body.classList.toggle(
      "skill-tree-performance-mode",
      isSkillTree
    );
  }

  /*
   * 放置された経験値ジェムを地域単位で統合する。
   * valueは合算するため、取得できる経験値総量は変化しない。
   */
  function compactGems(game){
    const gems = game.gems;

    if (
      !Array.isArray(gems) ||
      gems.length < 180
    ){
      return;
    }

    const kept = [];
    const cells = new Map();

    for (const gem of gems){
      if (!gem || gem.dead){
        continue;
      }

      /*
       * すでにプレイヤーへ向かっているジェムは
       * 統合せず、そのまま回収させる。
       */
      if (gem.attracted){
        kept.push(gem);
        continue;
      }

      const cellX =
        Math.floor(
          gem.x /
          GEM_CELL_SIZE
        );

      const cellY =
        Math.floor(
          gem.y /
          GEM_CELL_SIZE
        );

      const key =
        cellX + ":" + cellY;

      const existing =
        cells.get(key);

      if (!existing){
        cells.set(key, gem);
        kept.push(gem);
        continue;
      }

      const oldValue =
        Math.max(
          0,
          Number(existing.value) || 0
        );

      const addValue =
        Math.max(
          0,
          Number(gem.value) || 0
        );

      const totalValue =
        oldValue + addValue;

      if (totalValue > 0){
        existing.x =
          (
            existing.x * oldValue +
            gem.x * addValue
          ) /
          totalValue;

        existing.y =
          (
            existing.y * oldValue +
            gem.y * addValue
          ) /
          totalValue;
      }

      existing.value =
        totalValue;

      existing.radius =
        totalValue >= 8
          ? 6
          : 4;

      existing.bobT =
        Math.min(
          existing.bobT,
          gem.bobT
        );
    }

    game.gems = kept;
  }

  /*
   * タイトル・星座盤では元のrender()を呼ばない。
   * 元実装はCanvas全体をclearRectした後でreturnしていた。
   */
  const previousRender =
    Game.prototype.render;

  Game.prototype.render =
  function(){
    if (
      this.state === "title" ||
      this.state === "skilltree"
    ){
      return;
    }

    const startedAt =
      performance.now();

    const result =
      previousRender.call(this);

    const elapsed =
      performance.now() -
      startedAt;

    perf.renderMs =
      perf.renderMs === 0
        ? elapsed
        : perf.renderMs * 0.88 +
          elapsed * 0.12;

    return result;
  };

  const previousUpdate =
    Game.prototype.update;

  Game.prototype.update =
  function(dt){
    const startedAt =
      performance.now();

    perf.gemTimer += dt;

    if (
      perf.gemTimer >=
      GEM_COMPACT_INTERVAL
    ){
      perf.gemTimer = 0;
      compactGems(this);
    }

    const result =
      previousUpdate.call(
        this,
        dt
      );

    const elapsed =
      performance.now() -
      startedAt;

    perf.updateMs =
      perf.updateMs === 0
        ? elapsed
        : perf.updateMs * 0.88 +
          elapsed * 0.12;

    return result;
  };

  const previousOpenSkillTree =
    Game.prototype.openSkillTree;

  Game.prototype.openSkillTree =
  function(){
    const result =
      previousOpenSkillTree.call(
        this
      );

    setPresentationMode(this);

    return result;
  };

  const previousCloseSkillTree =
    Game.prototype.closeSkillTree;

  Game.prototype.closeSkillTree =
  function(){
    const result =
      previousCloseSkillTree.call(
        this
      );

    setPresentationMode(this);

    return result;
  };

  const previousToTitle =
    Game.prototype.toTitle;

  Game.prototype.toTitle =
  function(){
    const result =
      previousToTitle.call(this);

    setPresentationMode(this);

    return result;
  };

  const previousStartGame =
    Game.prototype.startGame;

  Game.prototype.startGame =
  function(){
    const result =
      previousStartGame.call(
        this
      );

    setPresentationMode(this);
    perf.gemTimer = 0;

    return result;
  };

  /*
   * 星座盤の定常GPU負荷を削減。
   * 色、形、取得状態、接続線の太さは維持する。
   */
  const style =
    document.createElement(
      "style"
    );

  style.textContent = `
    body.skill-tree-performance-mode::before{
      display:none!important
    }

    body.skill-tree-performance-mode #gameCanvas{
      display:none!important
    }

    #skillTreeScreen{
      contain:layout paint style
    }

    #skillTreeScreen *,
    #skillTreeScreen *::before,
    #skillTreeScreen *::after{
      animation:none!important;
      transition:none!important
    }

    #skillTreeScreen .skill-link,
    #skillTreeScreen .tree-node,
    #skillTreeScreen .tree-node.locked,
    #skillTreeScreen .tree-node.conflict{
      filter:none!important
    }

    #skillTreeScreen .tree-node-shell{
      box-shadow:none!important
    }

    #skillTreeScreen .tree-node.available .tree-node-shell{
      box-shadow:
        0 0 0 2px
        rgba(255,255,255,.18)
        !important
    }

    #skillTreeScreen .tree-node.owned .tree-node-shell,
    #skillTreeScreen .tree-node.maxed .tree-node-shell{
      box-shadow:
        0 0 0 2px
        var(--node-color)
        !important
    }

    #skillTreeScreen .tree-node.keystone.owned .tree-node-shell,
    #skillTreeScreen .tree-node.keystone.maxed .tree-node-shell,
    #skillTreeScreen .tree-node.mastery.owned .tree-node-shell,
    #skillTreeScreen .tree-node.mastery.maxed .tree-node-shell{
      box-shadow:
        inset 0 0 0 4px
        #fff6dc
        !important
    }

    #skillTreeScreen .tree-node.origin .tree-node-shell{
      box-shadow:none!important
    }

    #skillTreeScreen .skill-link.owned{
      filter:none!important
    }

    #skillTreeScreen .skill-tree-wallet>span,
    #skillTreeScreen .skill-tree-header h2{
      text-shadow:none!important
    }

    #skillTreeScreen .skill-tree-shell{
      box-shadow:
        8px 8px 0
        #4e5bff
        !important
    }

    #performanceBreakdown{
      position:fixed;
      left:14px;
      bottom:58px;
      z-index:121;
      min-width:225px;
      padding:7px 9px;
      border:2px solid #fff7dc;
      background:#090718e8;
      color:#fff7dc;
      box-shadow:4px 4px 0 #ff5268;
      font:900 11px/1.35 monospace;
      letter-spacing:.02em;
      pointer-events:none;
      white-space:pre
    }
  `;

  document.head.appendChild(
    style
  );

  window.addEventListener(
    "DOMContentLoaded",
    () => {
      const game =
        window.__game;

      if (!game){
        return;
      }

      setPresentationMode(game);

      const panel =
        document.createElement(
          "div"
        );

      panel.id =
        "performanceBreakdown";

      document.body.appendChild(
        panel
      );

      window.setInterval(
        () => {
          const playerProjectiles =
            game.projectiles?.length || 0;

          const enemyProjectiles =
            game.enemyProjectiles?.length || 0;

          const effects =
            (game.effects?.length || 0) +
            (game.particles?.length || 0) +
            (game.explosions?.length || 0);

          panel.textContent =
            `U ${perf.updateMs.toFixed(1)}ms  ` +
            `R ${perf.renderMs.toFixed(1)}ms\n` +
            `E ${game.enemies?.length || 0}  ` +
            `P ${playerProjectiles}/${enemyProjectiles}  ` +
            `G ${game.gems?.length || 0}  ` +
            `FX ${effects}\n` +
            `DPR ${(game.renderDpr || 1).toFixed(2)}  ` +
            `${game.state}`;
        },
        500
      );
    }
  );
})();

/* ===== Extension: performance-compositor-fix.js ===== */
"use strict";

(() => {
  const style = document.createElement("style");

  style.textContent = `
    /*
     * 全画面ノイズは、Canvasが更新されるたびに
     * 画面全体の再合成を発生させるため停止する。
     */
    body::before{
      display:none!important
    }

    #gameCanvas{
      filter:none!important;
      transform:none!important;
      backface-visibility:visible!important;
      contain:none!important
    }

    /*
     * 武器一覧全体へ適用されていたdrop-shadowを停止。
     * 子パネル数が増えるほど急激に重くなる原因を除去する。
     */
    #weaponBar{
      filter:none!important;
      contain:layout paint!important;
      isolation:auto!important
    }

    .ability-panel{
      transform:none!important;
      will-change:auto!important;
      background:#fffceb!important;
      box-shadow:
        4px 4px 0
        var(--ability-color)
        !important
    }

    .ability-panel *,
    .ability-panel *::before,
    .ability-panel *::after{
      filter:none!important;
      will-change:auto!important;
      text-shadow:none!important
    }

    /*
     * 半透明HUDと動くCanvasの連続合成を避ける。
     */
    #topLeftHud,
    #topRightHud,
    #controlsHint,
    #volCtrl{
      background:#fff7dc!important
    }

    .bar-inner,
    #bossBarInner{
      transition:none!important
    }

    .overlay-screen{
      animation:none!important
    }

    /*
     * レベルアップ画面は完全に不透明な単一背景にする。
     */
    #levelUpScreen{
      background:#1b1040!important
    }

    #levelUpScreen::before,
    #levelUpScreen::after{
      display:none!important
    }

    #levelUpScreen .upgrade-icon{
      filter:none!important
    }

    #levelUpScreen .upgrade-card{
      transition:none!important;
      box-shadow:
        6px 6px 0
        var(--cobalt)
        !important
    }

    #levelUpScreen .upgrade-card:nth-child(2){
      box-shadow:
        6px 6px 0
        var(--coral)
        !important
    }

    #levelUpScreen .upgrade-card:nth-child(3){
      box-shadow:
        6px 6px 0
        var(--sun)
        !important
    }

    /*
     * レベルアップ中は背後のゲーム画面を合成しない。
     */
    body.levelup-performance-mode #gameCanvas,
    body.levelup-performance-mode #hud{
      visibility:hidden!important
    }

    #upgradeToast.show{
      animation:none!important;
      opacity:1!important;
      transform:none!important
    }

    #warningBanner{
      text-shadow:none!important
    }
  `;

  document.head.appendChild(style);

  /*
   * 既存の自動画質調整が解像度を再び上げないよう、
   * resizeを呼ぶたびに上限を適用する。
   */
  const previousResize =
    Game.prototype.resize;

  Game.prototype.resize =
  function(){
    CONFIG.MAX_DPR =
      Math.min(
        CONFIG.MAX_DPR,
        0.68
      );

    CONFIG.MAX_CANVAS_PIXELS =
      Math.min(
        CONFIG.MAX_CANVAS_PIXELS,
        900000
      );

    return previousResize.call(this);
  };

  function setLevelUpMode(enabled){
    document.body.classList.toggle(
      "levelup-performance-mode",
      enabled
    );
  }

  const previousOpenLevelUp =
    Game.prototype.openLevelUp;

  Game.prototype.openLevelUp =
  function(){
    const result =
      previousOpenLevelUp.call(this);

    setLevelUpMode(true);

    return result;
  };

  const previousCloseLevelUp =
    Game.prototype.closeLevelUp;

  Game.prototype.closeLevelUp =
  function(){
    const result =
      previousCloseLevelUp.call(this);

    setLevelUpMode(
      this.state === "levelup"
    );

    return result;
  };

  const previousStartGame =
    Game.prototype.startGame;

  Game.prototype.startGame =
  function(){
    setLevelUpMode(false);

    return previousStartGame.call(
      this
    );
  };

  const previousToTitle =
    Game.prototype.toTitle;

  Game.prototype.toTitle =
  function(){
    setLevelUpMode(false);

    return previousToTitle.call(
      this
    );
  };

  window.addEventListener(
    "DOMContentLoaded",
    () => {
      const game =
        window.__game;

      if (!game){
        return;
      }

      CONFIG.MAX_DPR =
        Math.min(
          CONFIG.MAX_DPR,
          0.68
        );

      CONFIG.MAX_CANVAS_PIXELS =
        Math.min(
          CONFIG.MAX_CANVAS_PIXELS,
          900000
        );

      game.resize();
    }
  );
})();

/* ===== Extension: performance-glow-state-fix.js ===== */
"use strict";

(() => {
  // FINAL_PERFORMANCE_FIX_V2
  const STATIC_BACKGROUND_WIDTH = 480;
  const MAX_LIVE_PARTICLES = 120;
  const MAX_LIVE_EFFECTS = 72;
  const MAX_LIVE_DAMAGE_TEXTS = 48;

  function resetContext(ctx){
    if (!ctx) return;

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "rgba(0,0,0,0)";
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineDashOffset = 0;

    if (typeof ctx.setLineDash === "function"){
      ctx.setLineDash([]);
    }

    if ("filter" in ctx){
      ctx.filter = "none";
    }
  }

  function guardDraw(ctor){
    if (!ctor || !ctor.prototype) return;

    const original = ctor.prototype.draw;

    if (
      typeof original !== "function" ||
      original.__voidContextGuard
    ){
      return;
    }

    function guardedDraw(ctx, ...args){
      ctx.save();
      resetContext(ctx);

      try{
        return original.call(
          this,
          ctx,
          ...args
        );
      }finally{
        ctx.restore();
      }
    }

    guardedDraw.__voidContextGuard = true;
    ctor.prototype.draw = guardedDraw;
  }

  if (typeof Projectile === "function"){
    guardDraw(Projectile);
  }

  if (typeof EnemyProjectile === "function"){
    guardDraw(EnemyProjectile);
  }

  if (typeof Player === "function"){
    guardDraw(Player);
  }

  if (typeof Enemy === "function"){
    guardDraw(Enemy);
  }

  if (typeof Boss === "function"){
    guardDraw(Boss);
  }

  if (typeof Particle === "function"){
    guardDraw(Particle);
  }

  if (typeof DamageText === "function"){
    guardDraw(DamageText);
  }

  if (typeof ImpactEffect === "function"){
    guardDraw(ImpactEffect);
  }

  if (typeof ExplosionArea === "function"){
    guardDraw(ExplosionArea);
  }

  if (typeof ShockwaveEffect === "function"){
    guardDraw(ShockwaveEffect);
  }

  if (typeof LightningEffect === "function"){
    guardDraw(LightningEffect);
  }

  if (typeof MuzzleEffect === "function"){
    guardDraw(MuzzleEffect);
  }

  if (typeof ExpGem === "function"){
    guardDraw(ExpGem);
  }

  if (typeof Item === "function"){
    guardDraw(Item);
  }

  if (typeof Treasure === "function"){
    guardDraw(Treasure);
  }

  if (typeof Decoration === "function"){
    guardDraw(Decoration);
  }

  if (typeof Obstacle === "function"){
    guardDraw(Obstacle);
  }

  const previousDamageEnemy =
    Game.prototype.damageEnemy;

  const previousDamageBoss =
    Game.prototype.damageBoss;

  /*
   * クリティカル時のダメージは維持する。
   * 大型発光、粒子、画面振動、連続効果音のみ撤去する。
   */
  Game.prototype.damageEnemy =
  function(enemy, damage, crit){
    if (!crit){
      return previousDamageEnemy.call(
        this,
        enemy,
        damage,
        false
      );
    }

    if (!enemy || enemy.dead){
      return;
    }

    enemy.hp -= damage;
    enemy.hitFlash = 0.06;

    if (
      this.damageTexts.length >=
      MAX_LIVE_DAMAGE_TEXTS
    ){
      this.damageTexts.splice(
        0,
        this.damageTexts.length -
          MAX_LIVE_DAMAGE_TEXTS +
          1
      );
    }

    this.damageTexts.push(
      new DamageText(
        enemy.x,
        enemy.y-enemy.radius,
        "✦"+String(Math.round(damage)),
        "#ffd447",
        false
      )
    );

    if (enemy.hp<=0){
      enemy.onDeath(this);

      if (
        Math.random() <
        this.player.lifestealChance
      ){
        this.player.hp = Math.min(
          this.player.maxHp,
          this.player.hp+
            Math.round(
              this.player.maxHp*.04
            )
        );
      }
    }
  };

  Game.prototype.damageBoss =
  function(damage, crit){
    if (!crit){
      return previousDamageBoss.call(
        this,
        damage,
        false
      );
    }

    const boss = this.boss;

    if (!boss || boss.dead){
      return;
    }

    boss.hp -= damage;
    boss.hitFlash = 0.06;

    if (
      this.damageTexts.length >=
      MAX_LIVE_DAMAGE_TEXTS
    ){
      this.damageTexts.splice(
        0,
        this.damageTexts.length -
          MAX_LIVE_DAMAGE_TEXTS +
          1
      );
    }

    this.damageTexts.push(
      new DamageText(
        boss.x,
        boss.y-boss.radius-10,
        "✦"+String(Math.round(damage)),
        "#ffd447",
        false
      )
    );

    if (boss.hp<=0){
      boss.onDeath(this);

      document
        .getElementById("bossBarWrap")
        .classList
        .add("hidden");

      this.boss = null;
    }
  };

  /*
   * 障害物と動的背景装飾を完全に撤去する。
   */
  Game.prototype.generateObstacles =
  function(){
    this.obstacles = [];
  };

  Game.prototype.generateDecorations =
  function(){
    this.decorations = [];
  };

  /*
   * 巨大なワールド背景の切り出しをやめ、
   * 小さな静止背景をステージごとに1回だけ生成する。
   */
  Game.prototype.drawGroundCached =
  function(ctx, cam, width, height){
    const stage =
      stageIndexForTime(
        this.elapsed||0
      );

    const backgroundHeight =
      Math.max(
        240,
        Math.round(
          STATIC_BACKGROUND_WIDTH *
          height /
          Math.max(1,width)
        )
      );

    if (
      !this._flatBackgroundCanvas ||
      this._flatBackgroundStage !==
        stage ||
      this._flatBackgroundCanvas
        .height !==
        backgroundHeight
    ){
      const canvas =
        this._flatBackgroundCanvas ||
        document.createElement(
          "canvas"
        );

      canvas.width =
        STATIC_BACKGROUND_WIDTH;

      canvas.height =
        backgroundHeight;

      const background =
        canvas.getContext(
          "2d",
          {alpha:false}
        );

      const stageVisual =
        STAGE_VISUALS[stage];

      resetContext(background);

      const gradient =
        background.createLinearGradient(
          0,
          0,
          canvas.width,
          canvas.height
        );

      gradient.addColorStop(
        0,
        stageVisual.bg0
      );

      gradient.addColorStop(
        1,
        stageVisual.bg1
      );

      background.fillStyle =
        gradient;

      background.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      background.globalAlpha =
        0.32;

      background.fillStyle =
        stageVisual.floor;

      background.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      background.globalAlpha = 1;

      for (let i=0; i<14; i++){
        const seed =
          U.hash(
            i+41,
            stage+17
          );

        const x =
          seed*canvas.width;

        const y =
          U.hash(
            i+73,
            stage+29
          ) *
          canvas.height;

        const size =
          8+seed*20;

        background.save();
        background.translate(x,y);

        background.rotate(
          seed*Math.PI*2
        );

        background.globalAlpha =
          .08+seed*.08;

        background.fillStyle =
          i%2
            ? stageVisual.accent
            : stageVisual.accent2;

        polygonPath(
          background,
          [
            [0,-size],
            [
              size*.8,
              -size*.15
            ],
            [
              size*.25,
              size
            ],
            [
              -size*.75,
              size*.35
            ],
            [
              -size*.6,
              -size*.55
            ]
          ]
        );

        background.fill();
        background.restore();
      }

      this._flatBackgroundCanvas =
        canvas;

      this._flatBackgroundStage =
        stage;
    }

    ctx.drawImage(
      this._flatBackgroundCanvas,
      0,
      0,
      width,
      height
    );
  };

  Game.prototype
    ._drawDynamicGroundLayer =
  function(){};

  Game.prototype
    .drawAtmosphereOverlay =
  function(){};

  /*
   * 巨大背景Canvasの再確保を避け、
   * メインCanvasだけを固定DPRで初期化する。
   */
  Game.prototype.resize =
  function(){
    this.viewW =
      window.innerWidth;

    this.viewH =
      window.innerHeight;

    const dpr = .55;

    this.renderDpr = dpr;

    this.canvas.style.width =
      this.viewW+"px";

    this.canvas.style.height =
      this.viewH+"px";

    this.canvas.width =
      Math.max(
        1,
        Math.round(
          this.viewW*dpr
        )
      );

    this.canvas.height =
      Math.max(
        1,
        Math.round(
          this.viewH*dpr
        )
      );

    this.ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );

    this.ctx.imageSmoothingEnabled =
      true;

    if (this.groundCanvas){
      this.groundCanvas.width = 1;
      this.groundCanvas.height = 1;
    }

    this._flatBackgroundStage = -1;
  };

  const previousRender =
    Game.prototype.render;

  Game.prototype.render =
  function(){
    resetContext(this.ctx);

    try{
      return previousRender.call(
        this
      );
    }finally{
      resetContext(this.ctx);
    }
  };

  function trimOldest(
    array,
    maxLength
  ){
    if (
      !Array.isArray(array) ||
      array.length<=maxLength
    ){
      return;
    }

    array.splice(
      0,
      array.length-maxLength
    );
  }

  function installGameHooks(){
    const game =
      window.__game;

    if (
      !game ||
      game.__finalPerformanceHooksInstalled
    ){
      return;
    }

    game.__finalPerformanceHooksInstalled =
      true;

    const previousStartGame =
      game.startGame;

    game.startGame =
    function(){
      const result =
        previousStartGame.call(
          this
        );

      this.obstacles = [];
      this.decorations = [];
      this._flatBackgroundStage = -1;

      if (
        this.player &&
        Array.isArray(
          this.player.trail
        )
      ){
        this.player.trail.length = 0;
      }

      return result;
    };

    const previousUpdate =
      game.update;

    game.update =
    function(dt){
      const result =
        previousUpdate.call(
          this,
          dt
        );

      if (
        Array.isArray(
          this.obstacles
        )
      ){
        this.obstacles.length = 0;
      }

      if (
        Array.isArray(
          this.decorations
        )
      ){
        this.decorations.length = 0;
      }

      if (
        this.player &&
        Array.isArray(
          this.player.trail
        )
      ){
        this.player.trail.length = 0;
        this.player.trailTimer = .08;
      }

      for (
        const projectile of
        this.projectiles||[]
      ){
        if (
          Array.isArray(
            projectile.trail
          )
        ){
          projectile.trail.length = 0;
        }
      }

      for (
        const projectile of
        this.enemyProjectiles||[]
      ){
        if (
          Array.isArray(
            projectile.trail
          )
        ){
          projectile.trail.length = 0;
        }
      }

      trimOldest(
        this.particles,
        MAX_LIVE_PARTICLES
      );

      trimOldest(
        this.effects,
        MAX_LIVE_EFFECTS
      );

      trimOldest(
        this.damageTexts,
        MAX_LIVE_DAMAGE_TEXTS
      );

      return result;
    };

    game.obstacles = [];
    game.decorations = [];

    const diagnostics =
      document.getElementById(
        "performanceBreakdown"
      );

    if (diagnostics){
      diagnostics.style.display =
        "none";
    }

    game.resize();

    resetContext(game.ctx);
    resetContext(game.groundCtx);
  }

  if (
    document.readyState ===
    "loading"
  ){
    window.addEventListener(
      "DOMContentLoaded",
      installGameHooks
    );
  }else{
    installGameHooks();
  }
})();

/* ===== Extension: background-visual-restore.js ===== */
"use strict";

(() => {
  const CACHE_SCALE = 0.5;
  const CACHE_MARGIN = 220;
  const CACHE_REFRESH_DISTANCE = 150;
  const LANDMARK_COUNT = 28;

  function resetContext(ctx){
    ctx.setTransform(1,0,0,1,0,0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "rgba(0,0,0,0)";
    ctx.lineWidth = 1;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  function drawStageMotif(ctx, motif, x, y, size, color, secondary, seed){
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(seed*Math.PI*2);
    ctx.fillStyle = color;
    ctx.strokeStyle = secondary;
    ctx.lineWidth = Math.max(1,size*.06);

    if (motif === "cell"){
      ctx.beginPath();
      ctx.arc(0,0,size,0,Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0,0,size*.55,0,Math.PI*2);
      ctx.stroke();
    }else if (motif === "spore"){
      for (let i=0;i<5;i++){
        const angle = i/5*Math.PI*2;
        ctx.beginPath();
        ctx.arc(
          Math.cos(angle)*size*.52,
          Math.sin(angle)*size*.52,
          size*(i===0?.42:.28),
          0,
          Math.PI*2
        );
        ctx.fill();
      }
    }else if (motif === "rift"){
      ctx.beginPath();
      ctx.moveTo(-size,-size*.65);
      ctx.lineTo(-size*.25,-size*.18);
      ctx.lineTo(-size*.5,size*.25);
      ctx.lineTo(size*.15,size*.08);
      ctx.lineTo(size,size*.72);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size*.15,-size*.7);
      ctx.lineTo(size*.12,-size*.16);
      ctx.lineTo(size*.68,size*.08);
      ctx.stroke();
    }else if (motif === "eye"){
      ctx.beginPath();
      ctx.ellipse(0,0,size,size*.42,0,0,Math.PI*2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = secondary;
      ctx.beginPath();
      ctx.arc(0,0,size*.22,0,Math.PI*2);
      ctx.fill();
    }else{
      for (let i=0;i<5;i++){
        const angle = i/5*Math.PI*2;
        ctx.save();
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0,-size*.48,size*.28,size*.66,0,0,Math.PI*2);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  function drawBackground(game, ctx, originX, originY, width, height, stage){
    const st = STAGE_VISUALS[stage];
    const elapsed = game.elapsed || 0;

    resetContext(ctx);
    ctx.setTransform(CACHE_SCALE,0,0,CACHE_SCALE,0,0);

    const base = ctx.createLinearGradient(0,0,width,height);
    base.addColorStop(0,st.bg0);
    base.addColorStop(.55,st.floor);
    base.addColorStop(1,st.bg1);
    ctx.fillStyle = base;
    ctx.fillRect(0,0,width,height);

    const ambient = ctx.createLinearGradient(0,height,0,0);
    ambient.addColorStop(0,rgba(st.accent,.16));
    ambient.addColorStop(.5,rgba("#fff7dc",.025));
    ambient.addColorStop(1,rgba(st.accent2,.12));
    ctx.fillStyle = ambient;
    ctx.fillRect(0,0,width,height);

    const nebula = [
      {x:560,y:640,r:620,c:st.danger,a:.18},
      {x:3350,y:820,r:760,c:st.accent,a:.15},
      {x:3100,y:3300,r:850,c:st.fog,a:.2},
      {x:950,y:3200,r:690,c:st.accent2,a:.13}
    ];

    for (const field of nebula){
      const x = field.x-originX;
      const y = field.y-originY;
      if (
        x+field.r < 0 ||
        x-field.r > width ||
        y+field.r < 0 ||
        y-field.r > height
      ){
        continue;
      }

      const gradient = ctx.createRadialGradient(x,y,0,x,y,field.r);
      gradient.addColorStop(0,rgba(field.c,field.a));
      gradient.addColorStop(.55,rgba(field.c,field.a*.45));
      gradient.addColorStop(1,rgba(field.c,0));
      ctx.fillStyle = gradient;
      ctx.fillRect(
        Math.max(0,x-field.r),
        Math.max(0,y-field.r),
        Math.min(width,field.r*2),
        Math.min(height,field.r*2)
      );
    }

    ctx.save();
    ctx.translate(-originX,-originY);
    ctx.lineCap = "round";

    for (let lane=0;lane<3;lane++){
      ctx.beginPath();
      for (let i=0;i<=42;i++){
        const worldX = i/42*CONFIG.MAP_W;
        const worldY =
          650+lane*1280+
          Math.sin(i*.52+lane*2.1)*210+
          Math.sin(i*.17+stage*.8)*55;

        if (i===0) ctx.moveTo(worldX,worldY);
        else ctx.lineTo(worldX,worldY);
      }

      ctx.strokeStyle = rgba(
        lane===1 ? st.accent2 : st.accent,
        .08
      );
      ctx.lineWidth = 96-lane*10;
      ctx.stroke();

      ctx.strokeStyle = rgba(
        lane===1 ? st.accent : st.accent2,
        .3
      );
      ctx.lineWidth = 3;
      ctx.setLineDash([28,34]);
      ctx.lineDashOffset = -(stage+1)*13;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const centerX = CONFIG.MAP_W/2;
    const centerY = CONFIG.MAP_H/2;
    for (let ring=0;ring<8;ring++){
      const radius = 260+ring*245;
      ctx.beginPath();
      for (let i=0;i<=72;i++){
        const angle = i/72*Math.PI*2;
        const wobble =
          Math.sin(angle*(4+ring%3)+ring*.9)*22+
          Math.sin(angle*11-ring)*8;
        const x = centerX+Math.cos(angle)*(radius+wobble);
        const y = centerY+Math.sin(angle)*(radius+wobble);
        if (i===0) ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
      }
      ctx.closePath();
      ctx.strokeStyle = ring%3===0
        ? rgba(st.accent2,.22)
        : rgba(st.accent,.12);
      ctx.lineWidth = ring%3===0 ? 3 : 1.5;
      ctx.stroke();
    }

    ctx.restore();

    const cell = 150;
    const gx0 = Math.floor(originX/cell)-2;
    const gy0 = Math.floor(originY/cell)-2;
    const gx1 = Math.ceil((originX+width)/cell)+2;
    const gy1 = Math.ceil((originY+height)/cell)+2;

    for (let gy=gy0;gy<=gy1;gy++){
      for (let gx=gx0;gx<=gx1;gx++){
        const random = U.hash(gx,gy);
        if (random>=.24) continue;

        const x = gx*cell+cell*.5-originX;
        const y = gy*cell+cell*.5-originY;
        const size = 13+random*34;
        drawStageMotif(
          ctx,
          st.motif,
          x,
          y,
          size,
          rgba(
            [st.accent,st.accent2,st.danger,st.fog][Math.floor(random*100)%4],
            .1+.12*U.hash(gx+7,gy-4)
          ),
          rgba("#fff7dc",.2),
          random
        );
      }
    }

    for (let i=0;i<LANDMARK_COUNT;i++){
      const x = 90+U.hash(i+41,stage+13)*(CONFIG.MAP_W-180)-originX;
      const y = 90+U.hash(i+99,stage+31)*(CONFIG.MAP_H-180)-originY;
      const radius = 48+U.hash(i+5,103)*105;

      if (
        x+radius < 0 ||
        x-radius > width ||
        y+radius < 0 ||
        y-radius > height
      ){
        continue;
      }

      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(U.hash(i+21,43)*Math.PI*2);
      ctx.strokeStyle = rgba(i%2 ? st.accent : st.accent2,.28);
      ctx.fillStyle = rgba(i%3 ? st.fog : st.danger,.08);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0,0,radius,0,Math.PI*2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0,0,radius*.62,0,Math.PI*2);
      ctx.stroke();

      for (let tick=0;tick<10;tick++){
        const angle = tick/10*Math.PI*2;
        ctx.beginPath();
        ctx.moveTo(
          Math.cos(angle)*radius*.72,
          Math.sin(angle)*radius*.72
        );
        ctx.lineTo(
          Math.cos(angle)*radius,
          Math.sin(angle)*radius
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(-originX,-originY);
    ctx.strokeStyle = rgba(st.danger,.8);
    ctx.lineWidth = 5;
    ctx.setLineDash([28,12,5,12]);
    ctx.lineDashOffset = -(stage+1)*17;
    ctx.strokeRect(0,0,CONFIG.MAP_W,CONFIG.MAP_H);
    ctx.restore();

    ctx.fillStyle = rgba("#fff7dc",.18);
    for (let i=0;i<44;i++){
      const worldX = U.hash(i,stage+71)*CONFIG.MAP_W;
      const worldY = U.hash(i+9,stage+77)*CONFIG.MAP_H;
      const x = worldX-originX;
      const y = worldY-originY;
      if (x<0||x>width||y<0||y>height) continue;
      const radius = .8+U.hash(i+17,stage+3)*1.8;
      ctx.beginPath();
      ctx.arc(x,y,radius,0,Math.PI*2);
      ctx.fill();
    }

    ctx.fillStyle = rgba(st.accent,.035+.01*Math.sin(elapsed*.1));
    ctx.fillRect(0,0,width,height);
  }

  function ensureGroundCache(game, cam, width, height){
    const stage = stageIndexForTime(game.elapsed||0);
    const logicalWidth = Math.ceil(width+CACHE_MARGIN*2);
    const logicalHeight = Math.ceil(height+CACHE_MARGIN*2);
    const pixelWidth = Math.max(1,Math.round(logicalWidth*CACHE_SCALE));
    const pixelHeight = Math.max(1,Math.round(logicalHeight*CACHE_SCALE));
    let cache = game._visualGroundCache;

    const needsCanvas =
      !cache ||
      !cache.canvas ||
      cache.canvas.width!==pixelWidth ||
      cache.canvas.height!==pixelHeight;

    const needsRefresh =
      needsCanvas ||
      cache.stage!==stage ||
      Math.abs(cam.x-cache.anchorX)>CACHE_REFRESH_DISTANCE ||
      Math.abs(cam.y-cache.anchorY)>CACHE_REFRESH_DISTANCE;

    if (!needsRefresh) return cache;

    if (!cache){
      cache = {
        canvas:document.createElement("canvas"),
        ctx:null,
        stage:-1,
        anchorX:NaN,
        anchorY:NaN,
        originX:0,
        originY:0
      };
      game._visualGroundCache = cache;
    }

    if (needsCanvas){
      cache.canvas.width = pixelWidth;
      cache.canvas.height = pixelHeight;
      cache.ctx = cache.canvas.getContext("2d",{alpha:false});
      cache.ctx.imageSmoothingEnabled = true;
    }

    cache.stage = stage;
    cache.anchorX = cam.x;
    cache.anchorY = cam.y;
    cache.originX = cam.x-CACHE_MARGIN;
    cache.originY = cam.y-CACHE_MARGIN;

    drawBackground(
      game,
      cache.ctx,
      cache.originX,
      cache.originY,
      logicalWidth,
      logicalHeight,
      stage
    );

    return cache;
  }

  function ensurePlayerLight(game){
    const stage = stageIndexForTime(game.elapsed||0);
    if (!game._visualPlayerLight){
      const canvas = document.createElement("canvas");
      canvas.width = 384;
      canvas.height = 384;
      game._visualPlayerLight = {canvas,ctx:canvas.getContext("2d"),stage:-1};
    }

    const light = game._visualPlayerLight;
    if (light.stage===stage) return light.canvas;

    const st = STAGE_VISUALS[stage];
    const center = 192;
    light.ctx.clearRect(0,0,384,384);
    const gradient = light.ctx.createRadialGradient(
      center,center,0,
      center,center,center
    );
    gradient.addColorStop(0,rgba("#fff7dc",.2));
    gradient.addColorStop(.24,rgba(st.accent,.16));
    gradient.addColorStop(.62,rgba(st.accent2,.055));
    gradient.addColorStop(1,rgba(st.accent,0));
    light.ctx.fillStyle = gradient;
    light.ctx.fillRect(0,0,384,384);
    light.stage = stage;
    return light.canvas;
  }

  Game.prototype.drawGroundCached = function(ctx,cam,width,height){
    const cache = ensureGroundCache(this,cam,width,height);
    const sourceX = Math.round((cam.x-cache.originX)*CACHE_SCALE);
    const sourceY = Math.round((cam.y-cache.originY)*CACHE_SCALE);
    const sourceWidth = Math.min(
      cache.canvas.width-sourceX,
      Math.max(1,Math.round(width*CACHE_SCALE))
    );
    const sourceHeight = Math.min(
      cache.canvas.height-sourceY,
      Math.max(1,Math.round(height*CACHE_SCALE))
    );

    ctx.drawImage(
      cache.canvas,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      width,
      height
    );

    if (this.player){
      const light = ensurePlayerLight(this);
      const diameter = 720;
      const x = this.player.x-cam.x;
      const y = this.player.y-cam.y;
      ctx.drawImage(
        light,
        x-diameter*.5,
        y-diameter*.5,
        diameter,
        diameter
      );
    }
  };

  function ensureAtmosphere(game,width,height){
    const stage = stageIndexForTime(game.elapsed||0);
    const pixelWidth = Math.max(1,Math.round(width*.35));
    const pixelHeight = Math.max(1,Math.round(height*.35));
    let cache = game._visualAtmosphere;

    if (!cache){
      const canvas = document.createElement("canvas");
      cache = {canvas,ctx:canvas.getContext("2d"),stage:-1,width:0,height:0};
      game._visualAtmosphere = cache;
    }

    if (
      cache.stage===stage &&
      cache.width===pixelWidth &&
      cache.height===pixelHeight
    ){
      return cache.canvas;
    }

    cache.canvas.width = pixelWidth;
    cache.canvas.height = pixelHeight;
    cache.width = pixelWidth;
    cache.height = pixelHeight;
    cache.stage = stage;

    const ctx = cache.ctx;
    const st = STAGE_VISUALS[stage];
    const scale = .35;
    ctx.setTransform(scale,0,0,scale,0,0);
    ctx.clearRect(0,0,width,height);

    const vignette = ctx.createRadialGradient(
      width/2,height/2,Math.min(width,height)*.28,
      width/2,height/2,Math.max(width,height)*.76
    );
    vignette.addColorStop(0,"rgba(0,0,0,0)");
    vignette.addColorStop(.72,"rgba(0,0,0,.02)");
    vignette.addColorStop(1,"rgba(0,0,0,.26)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0,0,width,height);

    const tint = ctx.createLinearGradient(0,0,0,height);
    tint.addColorStop(0,rgba(st.fog,.09));
    tint.addColorStop(.3,rgba(st.fog,0));
    tint.addColorStop(.72,rgba(st.danger,0));
    tint.addColorStop(1,rgba(st.danger,.07));
    ctx.fillStyle = tint;
    ctx.fillRect(0,0,width,height);

    return cache.canvas;
  }

  Game.prototype.drawAtmosphereOverlay = function(ctx,width,height){
    ctx.drawImage(
      ensureAtmosphere(this,width,height),
      0,
      0,
      width,
      height
    );

    if (!(this.stageTransition>0)) return;

    const st = stageVisualForTime(this.elapsed||0);
    const total = this.stageIndex===0 ? 1.9 : 2.35;
    const alpha =
      U.clamp(this.stageTransition/.42,0,1)*
      U.clamp((total-this.stageTransition)/.35,0,1);

    if (alpha<=0) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(34,height*.34);
    ctx.fillStyle = rgba("#090718",.82);
    ctx.fillRect(0,-54,320,100);
    ctx.fillStyle = st.accent;
    ctx.fillRect(0,-54,8,100);
    ctx.fillStyle = "#fff7dc";
    ctx.font = "1000 38px Arial Black, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(st.name,24,-4);
    ctx.fillStyle = st.accent2;
    ctx.font = "900 11px monospace";
    ctx.fillText(st.code+" / CHROMA ABYSS",26,24);
    ctx.restore();
  };
})();


/* ===== Extension: selection-screen.js ===== */
"use strict";

(() => {
  const STYLE_ID = "void-selection-screen-layout";
  const MANAGED_CARD_SELECTOR = ".upgrade-card.abyss-power-card";

  const POWER_INFO = {
    solar_funeral: { name: "太陽葬送砲", category: "annihilation" },
    world_cutter: { name: "世界断ち", category: "annihilation" },
    storm_throne: { name: "雷帝の玉座", category: "annihilation" },
    gravity_coffin: { name: "重力棺", category: "dominion" },
    meteor_scripture: { name: "流星聖典", category: "annihilation" },
    razor_constellation: { name: "刃星座", category: "motion" },
    comet_wake: { name: "彗星航跡", category: "motion" },
    mirror_legion: { name: "鏡像軍団", category: "motion" },
    void_choir: { name: "虚無聖歌", category: "annihilation" },
    doom_bloom: { name: "終末開花", category: "annihilation" },
    black_sun: { name: "黒い太陽", category: "dominion" },
    time_execution: { name: "時間処刑", category: "dominion" },
    leviathan_shell: { name: "巨獣殻", category: "defense" },
    blood_eclipse: { name: "血蝕皆既", category: "defense" },
    hunter_verdict: { name: "狩神判決", category: "dominion" },
    prism_web: { name: "プリズム蜘蛛網", category: "dominion" },
    chaos_oracle: { name: "混沌神託", category: "chaos" },
    treasure_singularity: { name: "宝物特異点", category: "harvest" },
    overdrive_contract: { name: "過剰駆動契約", category: "chaos" },
    abyss_banquet: { name: "深淵饗宴", category: "harvest" }
  };

  const RELIC_RELATIONS = {
    "空白王座": {
      mode: "global",
      detail: "権能枠を増やし、新しい系統を追加できる"
    },
    "進化核": {
      mode: "evolution"
    },
    "殲滅封印": {
      mode: "category",
      category: "annihilation",
      label: "殲滅権能"
    },
    "支配封印": {
      mode: "category",
      category: "dominion",
      label: "支配権能"
    },
    "機動封印": {
      mode: "category",
      category: "motion",
      label: "機動権能"
    },
    "不滅封印": {
      mode: "global",
      detail: "最大HPと被ダメージ軽減を強化する"
    },
    "残響プリズム": {
      mode: "powers",
      powers: [
        "solar_funeral", "world_cutter", "storm_throne", "gravity_coffin",
        "meteor_scripture", "mirror_legion", "void_choir", "time_execution",
        "prism_web", "chaos_oracle"
      ],
      targetLabel: "時間発動型権能"
    },
    "欠けた時計": {
      mode: "all",
      detail: "所持中の全権能の再発動を高速化する"
    },
    "選別行列": {
      mode: "global",
      detail: "リロールと除外を増やす選択支援"
    },
    "財宝方位器": {
      mode: "powers",
      powers: ["treasure_singularity"],
      targetLabel: "宝箱系権能"
    },
    "血流機関": {
      mode: "powers",
      powers: ["blood_eclipse"],
      targetLabel: "瀕死・逆転系権能"
    },
    "蠕界心臓": {
      mode: "powers",
      powers: ["razor_constellation", "comet_wake"],
      targetLabel: "刃星座・彗星航跡"
    },
    "骨王冠": {
      mode: "powers",
      powers: ["leviathan_shell"],
      targetLabel: "防壁系権能",
      indirectDetail: "最大HP強化は現在のビルドにも有効"
    },
    "嵐喰らいの眼": {
      mode: "powers",
      powers: ["storm_throne"],
      targetLabel: "雷帝の玉座",
      indirectDetail: "全権能CD短縮は現在のビルドにも有効"
    },
    "終焉印章": {
      mode: "synergy",
      detail: "進化核と共鳴威力を強化する"
    },
    "深淵配当": {
      mode: "global",
      detail: "ラン終了時の深淵片獲得量を増やす"
    }
  };

  /*
   * stability-fix.js は古いカードの二重選択を document の capture で防ぐ。
   * このモジュールを stability-fix.js より前に読み込み、クリックイベントの
   * 同じ capture フェーズで新カードを一時的に管理対象として印付けする。
   * これにより古いロックが先に立たず、abyss-systems.js 側の選択処理が動く。
   */
  document.addEventListener("click", event => {
    const target = event.target;
    const card =
      target && typeof target.closest === "function"
        ? target.closest(MANAGED_CARD_SELECTOR)
        : null;

    if (!card) return;

    card.classList.add("rebirth-card");
    setTimeout(() => card.classList.remove("rebirth-card"), 0);
  }, true);

  function powerRank(player, id){
    return Number(player?.upgradeRanks?.[id]) || 0;
  }

  function ownedPowerLabels(player, ids){
    return ids
      .filter(id => powerRank(player, id) > 0)
      .map(id => `${POWER_INFO[id].name} Lv.${powerRank(player, id)}`);
  }

  function allOwnedPowerLabels(player){
    return Object.keys(POWER_INFO)
      .filter(id => powerRank(player, id) > 0)
      .map(id => `${POWER_INFO[id].name} Lv.${powerRank(player, id)}`);
  }

  function rewardRelation(name, player){
    const relation = RELIC_RELATIONS[name];
    if (!relation) return null;

    if (relation.mode === "global"){
      return {
        kind: "indirect",
        title: "全ビルド共通",
        detail: relation.detail
      };
    }

    if (relation.mode === "all"){
      const owned = allOwnedPowerLabels(player);
      return owned.length
        ? {
            kind: "direct",
            title: "所持中の全権能に有効",
            detail: `${owned.length}種の権能を強化`
          }
        : {
            kind: "future",
            title: "権能取得後に有効",
            detail: relation.detail
          };
    }

    if (relation.mode === "category"){
      const ids = Object.keys(POWER_INFO).filter(
        id => POWER_INFO[id].category === relation.category
      );
      const owned = ownedPowerLabels(player, ids);
      return owned.length
        ? {
            kind: "direct",
            title: "所持中の権能を直接強化",
            detail: owned.join(" / ")
          }
        : {
            kind: "future",
            title: `対象の${relation.label}は未取得`,
            detail: ids.map(id => POWER_INFO[id].name).join(" / ")
          };
    }

    if (relation.mode === "powers"){
      const owned = ownedPowerLabels(player, relation.powers);
      if (owned.length){
        return {
          kind: "direct",
          title: "所持中の権能を直接強化",
          detail: owned.join(" / ")
        };
      }
      if (relation.indirectDetail){
        return {
          kind: "indirect",
          title: "対象権能は未取得",
          detail: `${relation.targetLabel}向け / ${relation.indirectDetail}`
        };
      }
      return {
        kind: "future",
        title: "対象権能は未取得",
        detail: relation.powers.map(id => POWER_INFO[id].name).join(" / ")
      };
    }

    if (relation.mode === "evolution"){
      const owned = Object.keys(POWER_INFO).filter(id => powerRank(player, id) > 0);
      const evolvable = owned.filter(
        id => powerRank(player, id) >= 3 && !player?.powerEvolutions?.[id]
      );
      if (evolvable.length){
        return {
          kind: "direct",
          title: "現在の権能を進化可能",
          detail: evolvable.map(id => `${POWER_INFO[id].name} Lv.3`).join(" / ")
        };
      }
      return owned.length
        ? {
            kind: "indirect",
            title: "所持権能の進化準備",
            detail: "Lv.3到達後に進化へ使用できる"
          }
        : {
            kind: "future",
            title: "権能取得後に使用",
            detail: "Lv.3権能を最終形態へ進化させる"
          };
    }

    if (relation.mode === "synergy"){
      const synergyCount = Object.keys(player?.powerSynergies || {}).length;
      return synergyCount > 0
        ? {
            kind: "direct",
            title: "現在の共鳴を直接強化",
            detail: `成立中の共鳴 ${synergyCount}種 / ${relation.detail}`
          }
        : {
            kind: "indirect",
            title: "共鳴成立後に有効",
            detail: relation.detail
          };
    }

    return null;
  }

  function annotateBossRewards(){
    const game = window.__game;
    const player = game?.player;
    const choices = document.getElementById("rewardChoices");
    const title = document.getElementById("rewardTitle");

    if (!player || !choices || title?.textContent !== "王の遺産を選択") return;

    choices.querySelectorAll(".abyss-reward-card").forEach(card => {
      card.querySelector(".reward-build-fit")?.remove();
      card.classList.remove(
        "build-fit-direct",
        "build-fit-indirect",
        "build-fit-future"
      );

      const name = card.querySelector(".reward-name")?.textContent?.trim();
      const relation = rewardRelation(name, player);
      if (!relation) return;

      const fit = document.createElement("span");
      fit.className = `reward-build-fit fit-${relation.kind}`;

      const heading = document.createElement("strong");
      heading.textContent = relation.title;
      const detail = document.createElement("small");
      detail.textContent = relation.detail;

      fit.append(heading, detail);
      card.appendChild(fit);
      card.classList.add(`build-fit-${relation.kind}`);
    });
  }

  function bindBossRewardObserver(){
    const choices = document.getElementById("rewardChoices");
    if (!choices || choices.dataset.buildRelationBound === "1") return;

    choices.dataset.buildRelationBound = "1";
    const observer = new MutationObserver(() => {
      requestAnimationFrame(annotateBossRewards);
    });
    observer.observe(choices, { childList: true });
    annotateBossRewards();
  }

  const bindWhenReady = () => setTimeout(bindBossRewardObserver, 0);
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bindWhenReady, { once: true });
  } else {
    bindWhenReady();
  }

  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #levelUpScreen{
      align-items:flex-start!important;
      padding:14px 18px 12px!important;
      overflow:hidden!important;
    }

    #levelUpScreen>div{
      width:min(1580px,calc(100vw - 36px))!important;
      max-width:none!important;
      min-width:0;
    }

    #levelUpScreen .upgrade-title{
      margin:0 0 10px!important;
      padding:0 4px;
      font-size:clamp(36px,3.2vw,52px)!important;
      line-height:1!important;
    }

    #levelUpScreen .upgrade-choices{
      width:100%;
      grid-template-columns:repeat(4,minmax(0,1fr))!important;
      gap:14px!important;
      align-items:stretch;
      max-height:none!important;
      overflow:visible!important;
      padding:10px 8px 8px!important;
    }

    #levelUpScreen .upgrade-card.abyss-power-card{
      min-width:0;
      min-height:0!important;
      height:clamp(430px,calc(100vh - 190px),590px);
      padding:20px 18px 62px!important;
      overflow:hidden;
    }

    #levelUpScreen .abyss-power-card .power-category{
      margin-bottom:8px;
      padding:5px 8px;
      font-size:11px;
    }

    #levelUpScreen .abyss-power-card .upgrade-icon{
      margin-bottom:12px;
      font-size:52px;
      line-height:1;
    }

    #levelUpScreen .abyss-power-card .upgrade-name{
      margin-bottom:9px;
      font-size:clamp(20px,1.55vw,26px);
      line-height:1.18;
    }

    #levelUpScreen .abyss-power-card .power-trigger{
      margin-bottom:8px;
      font-size:12px;
      line-height:1.4;
    }

    #levelUpScreen .abyss-power-card .upgrade-desc{
      font-size:14px;
      line-height:1.55;
    }

    #levelUpScreen .abyss-power-card .upgrade-current{
      margin-top:11px;
      margin-bottom:42px;
      padding:9px 10px;
      font-size:12px;
      line-height:1.45;
    }

    #levelUpScreen .abyss-power-card .upgrade-current .after{
      font-size:13px;
      line-height:1.4;
    }

    #levelUpScreen .abyss-power-card::after{
      max-width:64%;
      font-size:10px;
      line-height:1.25;
    }

    #levelUpScreen .levelup-controls{
      margin-top:0;
    }

    #levelUpScreen .levelup-reroll{
      min-width:260px;
      padding:10px 18px;
      font-size:15px;
    }

    .reward-build-fit{
      display:block;
      margin-top:15px;
      padding:10px 11px;
      border:3px solid var(--abyss-ink,#100b24);
      text-align:left;
      box-shadow:4px 4px 0 var(--abyss-ink,#100b24);
    }

    .reward-build-fit strong{
      display:block;
      margin-bottom:5px;
      font:1000 12px/1.2 "Arial Black","Yu Gothic UI",sans-serif;
    }

    .reward-build-fit small{
      display:block;
      font:900 10px/1.45 "Yu Gothic UI",sans-serif;
    }

    .reward-build-fit.fit-direct{
      background:#42e8bd;
      color:#100b24;
    }

    .reward-build-fit.fit-indirect{
      background:#ffd447;
      color:#100b24;
    }

    .reward-build-fit.fit-future{
      background:#eadfff;
      color:#4e3b62;
      border-style:dashed;
    }

    .abyss-reward-card.build-fit-direct{
      box-shadow:10px 10px 0 #42e8bd!important;
    }

    .abyss-reward-card.build-fit-indirect{
      box-shadow:10px 10px 0 #ffd447!important;
    }

    .abyss-reward-card.build-fit-future{
      opacity:.9;
    }

    @media (max-width:1179px){
      #levelUpScreen{
        overflow:auto!important;
      }

      #levelUpScreen .upgrade-choices{
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        max-height:none!important;
        overflow:visible!important;
      }

      #levelUpScreen .upgrade-card.abyss-power-card{
        height:auto;
        min-height:380px!important;
      }
    }

    @media (max-width:780px){
      #levelUpScreen{
        padding:10px 10px 18px!important;
      }

      #levelUpScreen>div{
        width:100%!important;
      }

      #levelUpScreen .upgrade-title{
        font-size:clamp(28px,8vw,40px)!important;
      }

      #levelUpScreen .upgrade-choices{
        grid-template-columns:1fr!important;
        padding:8px 5px 18px!important;
      }

      #levelUpScreen .upgrade-card.abyss-power-card{
        min-height:0!important;
        padding-bottom:64px!important;
      }
    }
  `;
  document.head.appendChild(style);
})();


/* ===== Extension: stability-fix.js ===== */
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

    // CHROMA REBIRTHのカードは、カード自身の処理で重複選択を防ぐ。
    if (card.classList.contains("rebirth-card")) return;

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


/* ===== Extension: combat-readability.js ===== */
"use strict";

/*
 * VOID SURVIVORS / COMBAT READABILITY
 *
 * This layer leaves combat values and hit areas unchanged. It only reorganizes
 * information density and replaces oversized persistent-power rendering with
 * clearer, bounded silhouettes.
 */
(() => {
  if (typeof window === "undefined" || typeof Player === "undefined" || typeof Game === "undefined") return;

  // Captured before abyss-systems.js wraps Player.draw. This lets the final
  // renderer retain the ship while replacing only the persistent-power layer.
  const drawBasePlayer = Player.prototype.draw;
  const READABILITY_VERSION = "2026.07.21-R2";
  const RULE_EXPANDED_MS = 4200;
  const HINT_VISIBLE_MS = 6500;

  function clamp(value, min, max){
    return Math.max(min, Math.min(max, value));
  }

  function rankOf(player, id){
    const value = Number(player?.upgradeRanks?.[id]);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }

  function isEvolved(player, id){
    return !!player?.powerEvolutions?.[id];
  }

  function polygon(ctx, points){
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
  }

  function drawLocatorUnderlay(player, ctx, cam){
    const x = player.x - cam.x;
    const y = player.y - cam.y;
    const pulse = 1 + Math.sin((player.animT || 0) * 4.5) * 0.045;
    const radius = 30 * pulse;

    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(9,7,24,.18)";
    ctx.beginPath();
    ctx.arc(0, 0, radius + 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,247,220,.84)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.lineDashOffset = -(player.animT || 0) * 18;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "rgba(66,232,189,.9)";
    ctx.lineWidth = 3;
    for (let index = 0; index < 4; index++){
      const angle = index * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * (radius - 2), Math.sin(angle) * (radius - 2));
      ctx.lineTo(Math.cos(angle) * (radius + 7), Math.sin(angle) * (radius + 7));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBlackSuns(player, ctx, cam){
    const rank = rankOf(player, "black_sun");
    if (!rank) return;

    const area = Number.isFinite(player.systemAreaMul) ? player.systemAreaMul : 1;
    const orbit = [190, 220, 250][clamp(rank, 1, 3) - 1] * area;
    const hitRadius = [82, 105, 130][clamp(rank, 1, 3) - 1] * area;
    const count = isEvolved(player, "black_sun") ? 2 : 1;
    const baseAngle = player._blackSunAngle || 0;

    for (let index = 0; index < count; index++){
      const direction = index % 2 ? -1 : 1;
      const angle = baseAngle * direction + index * Math.PI;
      const x = player.x - cam.x + Math.cos(angle) * orbit;
      const y = player.y - cam.y + Math.sin(angle) * orbit;
      const core = clamp(hitRadius * 0.26, 24, 38);
      const halo = core * 1.72;
      const pulse = 1 + Math.sin((player.animT || 0) * 5.2 + index * Math.PI) * 0.05;

      ctx.save();
      ctx.translate(x, y);
      ctx.globalCompositeOperation = "source-over";

      // The thin dashed boundary communicates the real contact area without
      // filling the arena with an opaque glow.
      ctx.strokeStyle = "rgba(180,92,255,.42)";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 9]);
      ctx.lineDashOffset = -(player.animT || 0) * 20 * direction;
      ctx.beginPath();
      ctx.arc(0, 0, hitRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const gradient = ctx.createRadialGradient(0, 0, 1, 0, 0, halo * pulse);
      gradient.addColorStop(0, "rgba(255,253,242,.98)");
      gradient.addColorStop(.13, "rgba(255,138,76,.96)");
      gradient.addColorStop(.43, "rgba(25,20,38,.96)");
      gradient.addColorStop(.74, "rgba(25,20,38,.72)");
      gradient.addColorStop(1, "rgba(180,92,255,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, halo * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#130e22";
      ctx.beginPath();
      ctx.arc(0, 0, core, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#b45cff";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.strokeStyle = "rgba(255,138,76,.9)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, core * .68, -1.15, 1.15);
      ctx.stroke();
      ctx.fillStyle = "#fff7dc";
      ctx.beginPath();
      ctx.arc(core * .13, 0, Math.max(3, core * .13), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawRazorConstellation(player, ctx, cam){
    const rank = rankOf(player, "razor_constellation");
    if (!rank) return;

    const area = Number.isFinite(player.systemAreaMul) ? player.systemAreaMul : 1;
    const count = [3, 5, 7][clamp(rank, 1, 3) - 1] + (isEvolved(player, "razor_constellation") ? 2 : 0);
    const radius = [112, 132, 154][clamp(rank, 1, 3) - 1] * area;
    const baseAngle = player._razorAngle || 0;

    for (let index = 0; index < count; index++){
      const angle = baseAngle + index / count * Math.PI * 2;
      const x = player.x - cam.x + Math.cos(angle) * radius;
      const y = player.y - cam.y + Math.sin(angle) * radius;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = "#ff5268";
      ctx.strokeStyle = "#fff7dc";
      ctx.lineWidth = 2.5;
      polygon(ctx, [[0, -20], [7, -4], [4, 17], [0, 24], [-4, 17], [-7, -4]]);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawMirrorLegion(player, ctx, cam){
    const rank = rankOf(player, "mirror_legion");
    if (!rank) return;

    const count = [2, 3, 4][clamp(rank, 1, 3) - 1] + (isEvolved(player, "mirror_legion") ? 1 : 0);
    for (let index = 0; index < count; index++){
      const angle = (player.animT || 0) * 1.4 + index / count * Math.PI * 2;
      const x = player.x - cam.x + Math.cos(angle) * 86;
      const y = player.y - cam.y + Math.sin(angle) * 86;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = .76;
      ctx.fillStyle = "#65d9ff";
      ctx.strokeStyle = "#191426";
      ctx.lineWidth = 2.5;
      polygon(ctx, [[16, 0], [-8, 9], [-3, 0], [-8, -9]]);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawPlayerOverlays(player, ctx, cam){
    const x = player.x - cam.x;
    const y = player.y - cam.y;

    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = "source-over";

    if ((player._shellCharges || 0) > 0){
      ctx.strokeStyle = "rgba(66,232,189,.88)";
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 7]);
      ctx.lineDashOffset = -(player.animT || 0) * 36;
      ctx.beginPath();
      ctx.arc(0, 0, 39 + (player._shellCharges - 1) * 7 + Math.sin((player.animT || 0) * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (player._feastShield > 0){
      ctx.strokeStyle = "rgba(255,212,71,.82)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 47, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Exact center marker: visible even when multiple effects overlap the hull.
    ctx.fillStyle = "#fff7dc";
    ctx.strokeStyle = "#090718";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.translate(0, -43);
    ctx.fillStyle = "#fff7dc";
    ctx.strokeStyle = "#090718";
    ctx.lineWidth = 2.5;
    polygon(ctx, [[0, -8], [7, 5], [0, 2], [-7, 5]]);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function installPlayerRenderer(){
    Player.prototype.draw = function(ctx, cam){
      drawBlackSuns(this, ctx, cam);
      drawRazorConstellation(this, ctx, cam);
      drawMirrorLegion(this, ctx, cam);
      drawLocatorUnderlay(this, ctx, cam);
      drawBasePlayer.call(this, ctx, cam);
      drawPlayerOverlays(this, ctx, cam);
    };
  }

  function installBackgroundCalming(){
    const refreshGroundCache = Game.prototype.refreshGroundCache;
    if (typeof refreshGroundCache !== "function" || refreshGroundCache.__readabilityWrapped) return;

    function readableGroundCache(...args){
      const result = refreshGroundCache.apply(this, args);
      const stage = Number.isFinite(this._staticGroundStage) ? this._staticGroundStage : -1;
      if (!this.groundCtx || !this.groundCanvas || this._readabilityWashedStage === stage) return result;

      // One inexpensive wash per stage cache refresh. No additional full-screen
      // gradient is created during normal frame rendering.
      const ctx = this.groundCtx;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(9,7,24,.055)";
      ctx.fillRect(0, 0, this.groundCanvas.width, this.groundCanvas.height);
      ctx.restore();
      this._readabilityWashedStage = stage;
      return result;
    }

    readableGroundCache.__readabilityWrapped = true;
    Game.prototype.refreshGroundCache = readableGroundCache;
  }

  function installBuildPanel(){
    const hud = document.getElementById("hud");
    const weaponBar = document.getElementById("weaponBar");
    if (!hud || !weaponBar || document.getElementById("buildPanelToggle")) return;

    const shell = document.createElement("section");
    shell.id = "buildRailShell";
    shell.setAttribute("aria-label", "現在のビルド");
    weaponBar.parentNode.insertBefore(shell, weaponBar);

    const toggle = document.createElement("button");
    toggle.id = "buildPanelToggle";
    toggle.type = "button";
    toggle.setAttribute("aria-controls", "weaponBar");
    toggle.setAttribute("aria-expanded", "false");
    toggle.title = "ビルド詳細を開く（Bキー）";
    toggle.textContent = "BUILD DETAIL [B]";
    shell.appendChild(toggle);
    shell.appendChild(weaponBar);

    const setOpen = open => {
      const enabled = !!open;
      document.body.classList.toggle("build-panel-open", enabled);
      toggle.setAttribute("aria-expanded", String(enabled));
      toggle.textContent = enabled ? "CLOSE BUILD [B]" : "BUILD DETAIL [B]";
      toggle.title = enabled ? "ビルド詳細を閉じる（Bキー）" : "ビルド詳細を開く（Bキー）";
      if (enabled) weaponBar.scrollTop = 0;
    };

    toggle.addEventListener("click", () => setOpen(!document.body.classList.contains("build-panel-open")));
    window.addEventListener("keydown", event => {
      const target = event.target;
      const editing = target && (target.matches?.("input,select,textarea") || target.isContentEditable);
      if (editing || event.repeat || String(event.key).toLowerCase() !== "b") return;
      const game = window.__game;
      if (!game || !["playing", "paused", "levelup"].includes(game.state)) return;
      event.preventDefault();
      setOpen(!document.body.classList.contains("build-panel-open"));
    });

    const hudObserver = new MutationObserver(() => {
      if (hud.classList.contains("hidden")) setOpen(false);
    });
    hudObserver.observe(hud, {attributes:true, attributeFilter:["class"]});

    const startGame = Game.prototype.startGame;
    Game.prototype.startGame = function(...args){
      setOpen(false);
      return startGame.apply(this, args);
    };
  }

  function installStageRuleBehavior(){
    const hud = document.getElementById("stageRuleHud");
    const name = document.getElementById("stageRuleName");
    const text = document.getElementById("stageRuleText");
    if (!hud || !name || !text) return;

    hud.tabIndex = 0;
    hud.setAttribute("role", "status");
    hud.setAttribute("aria-live", "polite");

    let previous = "";
    let collapseTimer = 0;
    const expand = () => {
      hud.classList.add("is-expanded");
      clearTimeout(collapseTimer);
      collapseTimer = window.setTimeout(() => hud.classList.remove("is-expanded"), RULE_EXPANDED_MS);
    };

    const inspect = () => {
      const signature = `${name.textContent}\n${text.textContent}`;
      if (signature && signature !== previous){
        previous = signature;
        expand();
      }
    };
    inspect();
    window.setInterval(inspect, 250);
  }

  function installControlsHint(){
    const hint = document.getElementById("controlsHint");
    const dock = document.getElementById("pauseBtnWrap");
    if (!hint || !dock) return;

    let hideTimer = 0;
    const show = (duration = HINT_VISIBLE_MS) => {
      clearTimeout(hideTimer);
      hint.classList.remove("hint-hidden");
      hint.classList.add("hint-visible");
      hideTimer = window.setTimeout(() => {
        hint.classList.remove("hint-visible");
        hint.classList.add("hint-hidden");
      }, duration);
    };
    const hideSoon = () => {
      clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        hint.classList.remove("hint-visible");
        hint.classList.add("hint-hidden");
      }, 900);
    };

    const help = document.createElement("button");
    help.id = "controlsHelpBtn";
    help.type = "button";
    help.textContent = "?";
    help.title = "操作方法を表示";
    help.setAttribute("aria-label", "操作方法を表示");
    help.addEventListener("click", () => show(5000));
    dock.appendChild(help);

    window.addEventListener("keydown", event => {
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(String(event.key).toLowerCase())) hideSoon();
    });

    const startGame = Game.prototype.startGame;
    Game.prototype.startGame = function(...args){
      const result = startGame.apply(this, args);
      window.setTimeout(() => show(), 120);
      return result;
    };
    hint.classList.add("hint-hidden");
  }

  function installToastTiming(){
    const showSystemToast = Game.prototype.showSystemToast;
    if (typeof showSystemToast !== "function") return;
    Game.prototype.showSystemToast = function(...args){
      const result = showSystemToast.apply(this, args);
      clearTimeout(this._upgradeToastTimer);
      this._upgradeToastTimer = window.setTimeout(() => {
        const toast = document.getElementById("upgradeToast");
        toast?.classList.remove("show");
        toast?.classList.add("hidden");
      }, 3150);
      return result;
    };
  }

  function installVersionLabel(){
    const version = document.getElementById("gameVersion");
    const dock = document.getElementById("pauseBtnWrap");
    if (!version) return;
    version.textContent = `VER. ${window.__VOID_SURVIVORS_VERSION || READABILITY_VERSION}`;
    version.title = "VOID SURVIVORS build version";
    if (dock){
      const help = document.getElementById("controlsHelpBtn");
      dock.insertBefore(version, help || null);
    }
  }


  function installStylePriority(){
    const link = document.querySelector('link[href="assets/css/combat-readability.css"]');
    if (link && link.parentNode === document.head) document.head.appendChild(link);
  }

  function install(){
    if (document.body.classList.contains("combat-readability-ready")) return;
    document.body.classList.add("combat-readability-ready");
    installStylePriority();
    installPlayerRenderer();
    installBackgroundCalming();
    installBuildPanel();
    installStageRuleBehavior();
    installControlsHint();
    installToastTiming();
    installVersionLabel();
  }

  window.addEventListener("load", install, {once:true});
})();


/* ===== Extension: abyss-systems.js ===== */
"use strict";

/*
 * VOID SURVIVORS: ABYSS SYSTEMS
 *
 * CHROMA REBIRTH の権能・敵AI・永続成長を統合し、
 * ビルド枠 / 進化 / 共鳴、固有ボス、ステージルール、報酬、
 * 深淵層、戦闘統計、設定、軽量な自動生成BGMを一つの責務層にまとめる。
 */
(() => {
  if (
    typeof window === "undefined" ||
    typeof Game === "undefined" ||
    typeof Player === "undefined" ||
    typeof Enemy === "undefined" ||
    typeof Boss === "undefined"
  ) {
    return;
  }

  const SYSTEM_VERSION = 3;
  const SAVE_KEY = "void_survivors_records";
  const MAX_ABYSS_LAYER = 12;
  const BASE_POWER_SLOTS = 5;
  const BASE_REROLLS = 1;
  const MAX_RUN_HISTORY = 10;

  if (typeof CONFIG.EXPLOSION_DAMAGE_RATIO === "number") {
    CONFIG.EXPLOSION_DAMAGE_RATIO = Math.min(CONFIG.EXPLOSION_DAMAGE_RATIO,.06);
  }

  const CATEGORY_INFO = {
    annihilation: { label: "殲滅権能", color: "#ff5268", icon: "☄" },
    dominion: { label: "支配現象", color: "#b45cff", icon: "◉" },
    motion: { label: "機動兵装", color: "#65d9ff", icon: "↗" },
    defense: { label: "不滅機構", color: "#42e8bd", icon: "⬢" },
    harvest: { label: "深淵収奪", color: "#ffd447", icon: "▣" },
    chaos: { label: "混沌契約", color: "#ff8a4c", icon: "?" }
  };

  const POWER_CATALOG = {
    solar_funeral: {
      name: "太陽葬送砲", icon: "☀", category: "annihilation", max: 3,
      tags: ["blast", "fire", "area"],
      desc: "機体を中心に二重衝撃波を放ち、接近した群れを焼き払う。"
    },
    world_cutter: {
      name: "世界断ち", icon: "╱", category: "annihilation", max: 3,
      tags: ["beam", "line", "precision"],
      desc: "最も近い敵へ、画面を横断する巨大な斬撃を放つ。"
    },
    storm_throne: {
      name: "雷帝の玉座", icon: "⚡", category: "annihilation", max: 3,
      tags: ["lightning", "multi", "chain"],
      desc: "周囲の多数の敵へ同時落雷を行い、散開した群れも刈る。"
    },
    gravity_coffin: {
      name: "重力棺", icon: "◉", category: "dominion", max: 3,
      tags: ["gravity", "control", "blast"],
      desc: "敵の密集地点へ吸引場を設置し、収束後に爆縮させる。"
    },
    meteor_scripture: {
      name: "流星聖典", icon: "☄", category: "annihilation", max: 3,
      tags: ["meteor", "fire", "delayed"],
      desc: "複数の標的へ予告を刻み、巨大流星を同時落下させる。"
    },
    razor_constellation: {
      name: "刃星座", icon: "✦", category: "motion", max: 3,
      tags: ["blade", "orbit", "contact"],
      desc: "巨大な刃を常時公転させ、近距離の敵を連続切断する。"
    },
    comet_wake: {
      name: "彗星航跡", icon: "➤", category: "motion", max: 3,
      tags: ["movement", "mine", "blast"],
      desc: "移動した軌跡へ爆縮弾を残し、追跡する敵を迎撃する。"
    },
    mirror_legion: {
      name: "鏡像軍団", icon: "◇◇", category: "motion", max: 3,
      tags: ["summon", "multi", "beam"],
      desc: "機体の周囲へ鏡像を展開し、別々の敵へ瞬間砲撃する。"
    },
    void_choir: {
      name: "虚無聖歌", icon: "✺", category: "annihilation", max: 3,
      tags: ["beam", "radial", "area"],
      desc: "全方向へ巨大な光条を放射し、敵列をまとめて貫く。"
    },
    doom_bloom: {
      name: "終末開花", icon: "❋", category: "annihilation", max: 3,
      tags: ["kill", "chain", "multi"],
      desc: "一定数の撃破ごとに、死体位置から花弁砲撃を連鎖させる。"
    },
    black_sun: {
      name: "黒い太陽", icon: "●", category: "dominion", max: 3,
      tags: ["orbit", "burn", "contact"],
      desc: "外周を公転する黒い恒星が、接触した敵を継続的に焼く。"
    },
    time_execution: {
      name: "時間処刑", icon: "⌛", category: "dominion", max: 3,
      tags: ["time", "control", "burst"],
      desc: "敵と敵弾を停止し、停止終了時に全敵へ同時ダメージを与える。"
    },
    leviathan_shell: {
      name: "巨獣殻", icon: "⬢", category: "defense", max: 3,
      tags: ["shield", "counter", "blast"],
      desc: "一定間隔で被弾を無効化する殻を再生し、破壊時に反撃する。"
    },
    blood_eclipse: {
      name: "血蝕皆既", icon: "◒", category: "defense", max: 3,
      tags: ["lowhp", "invincible", "pulse"],
      desc: "瀕死時に自動覚醒し、無敵化しながら衝撃波を連射する。"
    },
    hunter_verdict: {
      name: "狩神判決", icon: "†", category: "dominion", max: 3,
      tags: ["kill", "execute", "boss"],
      desc: "撃破を重ねると高HPの敵を処刑し、ボスへ割合損傷を与える。"
    },
    prism_web: {
      name: "プリズム蜘蛛網", icon: "⌗", category: "dominion", max: 3,
      tags: ["beam", "control", "multi"],
      desc: "複数の敵を光線で結び、線に触れた敵まで切り裂く。"
    },
    chaos_oracle: {
      name: "混沌神託", icon: "?", category: "chaos", max: 3,
      tags: ["random", "echo", "contract"],
      desc: "複数の殲滅権能から一つを高頻度でランダム発動する。"
    },
    treasure_singularity: {
      name: "宝物特異点", icon: "▣", category: "harvest", max: 3,
      tags: ["treasure", "blast", "growth"],
      desc: "宝箱取得時に財宝爆発を起こし、経験値と回復も得る。"
    },
    overdrive_contract: {
      name: "過剰駆動契約", icon: "✕", category: "chaos", max: 3,
      tags: ["contract", "cooldown", "tradeoff"],
      desc: "最大HPを代償に、すべての権能の再発動を高速化する。",
      tradeoff: true
    },
    abyss_banquet: {
      name: "深淵饗宴", icon: "♢", category: "harvest", max: 3,
      tags: ["gem", "heal", "pulse"],
      desc: "経験値ジェムを一定数集めると捕食波を放ち、HPを回復する。"
    }
  };

  const POWER_IDS = Object.keys(POWER_CATALOG);

  const EVOLUTIONS = {
    solar_funeral: { name: "双星葬送", icon: "☀☀", summary: "衝撃波が時間差で再発動する。" },
    world_cutter: { name: "終界断層", icon: "╳", summary: "主斬撃に直交する第二斬撃を追加する。" },
    storm_throne: { name: "天獄連鎖", icon: "⚡✦", summary: "落雷が近隣の敵へ追加連鎖する。" },
    gravity_coffin: { name: "特異点墓標", icon: "◎", summary: "爆縮後に小型特異点を残す。" },
    meteor_scripture: { name: "滅星聖典", icon: "☄☄", summary: "着弾地点へ灼熱領域を残す。" },
    razor_constellation: { name: "七曜断輪", icon: "✦✦", summary: "刃数と再命中性能が大きく上昇する。" },
    comet_wake: { name: "彗星墓道", icon: "➤➤", summary: "航跡弾が隣の航跡へ連鎖爆発する。" },
    mirror_legion: { name: "万華軍勢", icon: "◇◇◇", summary: "鏡像が交差砲撃を追加する。" },
    void_choir: { name: "虚無大聖堂", icon: "✺✺", summary: "角度をずらした第二斉射を行う。" },
    doom_bloom: { name: "終末花園", icon: "❋❋", summary: "花弁砲撃の撃破が次の花弁を生む。" },
    black_sun: { name: "蝕王星", icon: "●●", summary: "逆回転する第二の黒い太陽を展開する。" },
    time_execution: { name: "永劫処刑", icon: "⌛†", summary: "停止が延長され、瀕死の雑魚を終了時に処刑する。" },
    leviathan_shell: { name: "巨神反殻", icon: "⬢⬢", summary: "防壁を二重装填できる。" },
    blood_eclipse: { name: "紅月皆既", icon: "◒◒", summary: "発動閾値と衝撃波の速度が上昇する。" },
    hunter_verdict: { name: "神狩終判", icon: "††", summary: "必要撃破数が減り、ボスへの割合損傷が増える。" },
    prism_web: { name: "無限晶網", icon: "⌗⌗", summary: "蜘蛛網が短時間に二度脈動する。" },
    chaos_oracle: { name: "混沌福音", icon: "?!", summary: "抽選した権能を弱い残響付きで発動する。" },
    treasure_singularity: { name: "黄金特異界", icon: "▣✦", summary: "宝箱変異の発生率が上昇する。" },
    overdrive_contract: { name: "臨界契約", icon: "✕✕", summary: "追加高速化を得るが、最大HPの代償が固定化する。" },
    abyss_banquet: { name: "深淵大餐", icon: "♢♢", summary: "必要ジェムが減り、超過回復を一時防壁へ変換する。" }
  };

  const SYNERGIES = {
    helios_scripture: {
      name: "太陽暦聖典", icon: "☀☄", powers: ["solar_funeral", "meteor_scripture"],
      summary: "流星着弾時、太陽葬送砲の小型衝撃波を発生させる。"
    },
    frozen_thunder: {
      name: "凍雷刑場", icon: "⌛⚡", powers: ["time_execution", "storm_throne"],
      summary: "時間停止終了時、生存中の敵へ追加落雷する。"
    },
    horizon_blade: {
      name: "事象断界", icon: "◉╱", powers: ["gravity_coffin", "world_cutter"],
      summary: "重力棺の爆縮地点へ世界断ちを追撃する。"
    },
    kinetic_guillotine: {
      name: "運動断頭輪", icon: "✦➤", powers: ["razor_constellation", "comet_wake"],
      summary: "移動量に応じて刃の回転速度と威力が上昇する。"
    },
    infinite_refraction: {
      name: "無限屈折軍", icon: "◇⌗", powers: ["mirror_legion", "prism_web"],
      summary: "鏡像が蜘蛛網の追加接続点になる。"
    },
    eclipse_choir: {
      name: "蝕界聖歌", icon: "●✺", powers: ["black_sun", "void_choir"],
      summary: "虚無聖歌が黒い太陽からも補助斉射される。"
    },
    execution_garden: {
      name: "処刑花園", icon: "†❋", powers: ["hunter_verdict", "doom_bloom"],
      summary: "狩神判決が成立すると終末開花の撃破蓄積を進める。"
    },
    crimson_carapace: {
      name: "紅殻皆既", icon: "⬢◒", powers: ["leviathan_shell", "blood_eclipse"],
      summary: "巨獣殻の破壊時、短い血蝕皆既を即時発動する。"
    },
    golden_feast: {
      name: "黄金饗宴", icon: "▣♢", powers: ["treasure_singularity", "abyss_banquet"],
      summary: "宝箱取得が深淵饗宴のジェム蓄積として数えられる。"
    },
    ruin_engine: {
      name: "破滅機関", icon: "?✕", powers: ["chaos_oracle", "overdrive_contract"],
      summary: "混沌神託が低確率で二種類を連続発動する。"
    }
  };

  const CHALLENGES = {
    none: {
      name: "標準航行", reward: 1,
      desc: "追加制約なし。現在の深淵層だけが適用される。"
    },
    glass_march: {
      name: "硝子行軍", reward: 1.35,
      desc: "最大HP -35%。深淵片報酬 +35%。"
    },
    swarm_tide: {
      name: "群体潮流", reward: 1.25,
      desc: "敵出現量 +30%。深淵片報酬 +25%。"
    },
    hollow_recovery: {
      name: "空洞修復", reward: 1.3,
      desc: "宝箱の通常回復を無効化。深淵片報酬 +30%。"
    },
    boss_covenant: {
      name: "王契約", reward: 1.4,
      desc: "ボスHP・攻撃 +35%。ボス報酬候補 +1。深淵片報酬 +40%。"
    },
    one_god: {
      name: "一神教義", reward: 1.5,
      desc: "権能枠を3枠に固定。進化核を1個所持して開始。深淵片報酬 +50%。"
    }
  };

  const STAGE_RULES = [
    {
      name: "共鳴門域", icon: "◎",
      desc: "中央の門域内では経験値 +18%、権能CD -10%。敵の出現も増える。"
    },
    {
      name: "三相変色", icon: "△",
      desc: "18秒ごとに赤・青・緑の相が切り替わり、双方の性能が変化する。"
    },
    {
      name: "増殖巣", icon: "❋",
      desc: "定期的に増殖巣が出現。破壊すると宝箱と大量経験値を得る。"
    },
    {
      name: "崩壊亀裂", icon: "╳",
      desc: "予告後に亀裂が開き、一定時間その上へ継続ダメージを発生させる。"
    },
    {
      name: "深淵脈動", icon: "●",
      desc: "安全域が提示され、脈動時に安全域外へいると割合ダメージを受ける。"
    }
  ];

  const RELICS = {
    extra_slot: {
      name: "空白王座", icon: "+", color: "#65d9ff",
      desc: "権能枠 +1。新しい系統をビルドへ追加できる。",
      apply(game){ game.player.powerSlotLimit += 1; }
    },
    evolution_core: {
      name: "進化核", icon: "◇", color: "#ffd447",
      desc: "進化核 +2。Lv.3権能を最終形態へ進化できる。",
      apply(game){ game.player.evolutionCores += 2; }
    },
    annihilation_seal: {
      name: "殲滅封印", icon: "☄", color: "#ff5268",
      desc: "殲滅権能ダメージ +22%。支配権能範囲 -8%。",
      apply(game){ addCategoryModifier(game.player,"annihilation",1.22); game.player.systemAreaMul *= .92; }
    },
    dominion_seal: {
      name: "支配封印", icon: "◉", color: "#b45cff",
      desc: "支配時間・範囲 +20%。全権能ダメージ -6%。",
      apply(game){ game.player.controlDurationMul *= 1.2; game.player.systemAreaMul *= 1.2; game.player.systemDamageMul *= .94; }
    },
    motion_seal: {
      name: "機動封印", icon: "↗", color: "#65d9ff",
      desc: "移動速度 +14%。機動権能ダメージ +18%。",
      apply(game){ game.player.speed *= 1.14; addCategoryModifier(game.player,"motion",1.18); }
    },
    aegis_seal: {
      name: "不滅封印", icon: "⬢", color: "#42e8bd",
      desc: "最大HP +24%、被ダメージ -6%。",
      apply(game){ game.player.maxHp=Math.round(game.player.maxHp*1.24); game.player.hp=game.player.maxHp; game.player.damageReduction=Math.min(.72,game.player.damageReduction+.06); }
    },
    echo_prism: {
      name: "残響プリズム", icon: "◇◇", color: "#b45cff",
      desc: "時間発動型権能が18%で45%威力の残響を起こす。",
      apply(game){ game.player.systemEchoChance = Math.max(game.player.systemEchoChance||0,.18); }
    },
    rapid_clock: {
      name: "欠けた時計", icon: "⌛", color: "#ffd447",
      desc: "権能CD ×0.82、最大HP ×0.90。",
      apply(game){ game.player.systemCooldownMul*=.82; game.player.maxHp=Math.max(1,Math.round(game.player.maxHp*.9)); game.player.hp=Math.min(game.player.hp,game.player.maxHp); }
    },
    reroll_matrix: {
      name: "選別行列", icon: "↻", color: "#65d9ff",
      desc: "リロール +3、除外回数 +1。",
      apply(game){ game.player.rerolls+=3; game.player.banishes+=1; }
    },
    treasure_compass: {
      name: "財宝方位器", icon: "▣", color: "#ffd447",
      desc: "宝箱変異率 +18%、宝箱吸引範囲 +520。",
      apply(game){ game.player.treasureMutationChance+=.18; game.player.treasureMagnetRange=Math.max(game.player.treasureMagnetRange,520); }
    },
    blood_engine: {
      name: "血流機関", icon: "◒", color: "#ff5268",
      desc: "HP35%以下で権能威力 +30%、移動速度 +16%。",
      apply(game){ game.player.lowPowerBonus=(game.player.lowPowerBonus||0)+.3; game.player.lowSpeedBonus=(game.player.lowSpeedBonus||0)+.16; }
    },
    worm_heart: {
      name: "蠕界心臓", icon: "➤", color: "#ff5268", signature:0,
      desc: "ヴォイド・ワーム固有遺産。移動速度 +12%、刃星座と彗星航跡の威力 +24%。",
      apply(game){ game.player.speed*=1.12; addPowerModifier(game.player,"razor_constellation",1.24); addPowerModifier(game.player,"comet_wake",1.24); }
    },
    throne_crown: {
      name: "骨王冠", icon: "♛", color: "#ffd447", signature:1,
      desc: "骨の玉座主固有遺産。最大HP +16%、即時に防壁を2枚装填する。",
      apply(game){ game.player.maxHp=Math.round(game.player.maxHp*1.16); game.player.hp=game.player.maxHp; game.player._shellCharges=(game.player._shellCharges||0)+2; }
    },
    storm_eye: {
      name: "嵐喰らいの眼", icon: "⚡", color: "#65d9ff", signature:2,
      desc: "嵐喰らいの影固有遺産。雷帝の玉座 +35%、全権能CD ×0.94。",
      apply(game){ addPowerModifier(game.player,"storm_throne",1.35); game.player.systemCooldownMul*=.94; }
    },
    herald_seal: {
      name: "終焉印章", icon: "†", color: "#b45cff", signature:3,
      desc: "終焉の使者固有遺産。進化核 +1、共鳴威力 +25%。",
      apply(game){ game.player.evolutionCores+=1; game.player.synergyDamageBonus=(game.player.synergyDamageBonus||0)+.25; }
    },
    abyss_dividend: {
      name: "深淵配当", icon: "◇", color: "#ffd447",
      desc: "このランの深淵片 +30%。敵HP +12%。",
      apply(game){ game.player.shardGainMul*=1.3; game._runEnemyHpBonus=(game._runEnemyHpBonus||1)*1.12; }
    }
  };

  const MUTATIONS = {
    random_rank: {
      name: "強制覚醒", icon: "↑", color: "#ff5268",
      desc: "ランダムな取得済み権能を1レベル強化する。",
      eligible(game){ return ownedPowerIds(game.player).some(id=>rankOf(game.player,id)<POWER_CATALOG[id].max); },
      apply(game){
        const pool=ownedPowerIds(game.player).filter(id=>rankOf(game.player,id)<POWER_CATALOG[id].max);
        const id=choice(pool); if(id) acquirePower(game.player,id);
      }
    },
    evolution_core: {
      name: "核晶化", icon: "◇", color: "#ffd447",
      desc: "進化核 +1。",
      eligible(){ return true; },
      apply(game){ game.player.evolutionCores+=1; }
    },
    reroll: {
      name: "選択再構成", icon: "↻", color: "#65d9ff",
      desc: "リロール +2。",
      eligible(){ return true; },
      apply(game){ game.player.rerolls+=2; }
    },
    category_surge: {
      name: "系統暴走", icon: "✦", color: "#b45cff",
      desc: "最も多く取得しているカテゴリの権能ダメージ +16%。",
      eligible(game){ return ownedPowerIds(game.player).length>0; },
      apply(game){ const category=dominantCategory(game.player); if(category)addCategoryModifier(game.player,category,1.16); }
    },
    emergency_shell: {
      name: "応急巨殻", icon: "⬢", color: "#42e8bd",
      desc: "HPを45%回復し、次の1Hitを無効化する。",
      eligible(){ return true; },
      apply(game){ game.player.hp=Math.min(game.player.maxHp,game.player.hp+Math.round(game.player.maxHp*.45)); game.player._shellCharges=Math.max(1,game.player._shellCharges||0); }
    },
    slot_fragment: {
      name: "空白断片", icon: "+", color: "#65d9ff",
      desc: "権能枠 +1。ただし全権能ダメージ -5%。",
      eligible(game){ return game.player.powerSlotLimit<8; },
      apply(game){ game.player.powerSlotLimit+=1; game.player.systemDamageMul*=.95; }
    }
  };

  const LEGACY_REBIRTH_COSTS = {
    core_awakening:[0], rebirth_output:[4,7], rebirth_clock:[4,7], rebirth_frame:[4,7], rebirth_draft:[10],
    havoc_seed:[9], havoc_overkill:[7,11], redline_god:[16], colossus_god:[16], havoc_mastery:[22],
    dominion_area:[5,8], dominion_control:[7,11], chaos_clock:[16], precision_law:[16], dominion_mastery:[22],
    aegis_shell:[9], aegis_blood:[7,11], glass_god:[16], fortress_god:[16], aegis_mastery:[22],
    harvest_growth:[5,8], harvest_magnet:[10], swift_harvest:[16], deep_harvest:[16], harvest_mastery:[22]
  };

  const BASE_SKILL_SNAPSHOT = Array.isArray(SKILL_NODES)
    ? SKILL_NODES.map(node=>({id:node.id,max:node.max,costs:Array.isArray(node.costs)?node.costs.slice():[0]}))
    : [];

  const NEW_BRANCHES = [
    {id:"core",name:"再誕中枢",icon:"◇",color:"#ffd447",desc:"権能枠・選択・基礎出力",focus:{x:630,y:410}},
    {id:"havoc",name:"殲滅神格",icon:"☄",color:"#ff5268",desc:"開幕権能・火力・進化",focus:{x:235,y:215}},
    {id:"dominion",name:"現象支配",icon:"◉",color:"#b45cff",desc:"範囲・制御・共鳴",focus:{x:1025,y:215}},
    {id:"aegis",name:"不滅機構",icon:"⬢",color:"#42e8bd",desc:"防壁・復活・瀕死逆転",focus:{x:235,y:625}},
    {id:"harvest",name:"深淵収奪",icon:"▣",color:"#65d9ff",desc:"経験値・宝箱・深淵層",focus:{x:1025,y:625}}
  ];

  const NEW_NODES = [
    {id:"core_awakening",branch:"core",name:"再誕核",icon:"◇",type:"origin",x:630,y:410,max:1,costs:[0],requires:[],desc:"権能駆動型の機体を起動する中枢。",effect:r=>r?"ABYSS SYSTEMS ONLINE":"未起動"},
    {id:"rebirth_output",branch:"core",name:"神格出力",icon:"◆",type:"minor",x:630,y:285,max:3,costs:[4,7,10],requires:[{id:"core_awakening",rank:1}],desc:"全権能の最終ダメージを増やす。",effect:r=>`権能ダメージ +${r*10}%`},
    {id:"rebirth_clock",branch:"core",name:"時喰い時計",icon:"⌛",type:"minor",x:755,y:350,max:3,costs:[4,7,10],requires:[{id:"core_awakening",rank:1}],desc:"時間発動型権能を高速化する。",effect:r=>`権能CD -${r*6}%`},
    {id:"rebirth_frame",branch:"core",name:"巨神フレーム",icon:"♥",type:"minor",x:690,y:535,max:3,costs:[4,7,10],requires:[{id:"core_awakening",rank:1}],desc:"最大HPを割合で増やす。",effect:r=>`最大HP +${r*12}%`},
    {id:"rebirth_draft",branch:"core",name:"四択宣言",icon:"▤",type:"notable",x:505,y:350,max:1,costs:[10],requires:[{id:"core_awakening",rank:1}],desc:"レベルアップ候補を3つから4つへ増やす。",effect:r=>r?"強化候補 3 → 4":"未取得"},
    {id:"core_slots",branch:"core",name:"空白王座",icon:"+",type:"notable",x:505,y:485,max:2,costs:[12,18],requires:[{id:"rebirth_frame",rank:1}],desc:"ラン中に装備できる権能枠を増やす。",effect:r=>`権能枠 +${r}`},
    {id:"core_reroll",branch:"core",name:"再選択回路",icon:"↻",type:"notable",x:790,y:485,max:2,costs:[8,13],requires:[{id:"rebirth_clock",rank:1}],desc:"各ランのリロール回数を増やす。",effect:r=>`開始リロール +${r}`},

    {id:"havoc_seed",branch:"havoc",name:"開幕の凶兆",icon:"✹",type:"notable",x:405,y:275,max:1,costs:[9],requires:[{id:"rebirth_output",rank:1}],desc:"開始時にランダムな権能を1つ得る。",effect:r=>r?"開始時ランダム権能 Lv.1":"未取得"},
    {id:"havoc_overkill",branch:"havoc",name:"過剰殺戮炉",icon:"☠",type:"notable",x:285,y:185,max:2,costs:[7,11],requires:[{id:"havoc_seed",rank:1}],desc:"撃破発動権能を早め、全権能の威力を増幅する。",effect:r=>`権能ダメージ +${r*9}% / 必要撃破 -${r*9}%`},
    {id:"forge_core",branch:"havoc",name:"進化炉心",icon:"◇",type:"notable",x:285,y:345,max:2,costs:[10,15],requires:[{id:"havoc_seed",rank:1}],desc:"進化核を所持してランを開始する。",effect:r=>`開始進化核 +${r}`},
    {id:"redline_god",branch:"havoc",name:"赤線神格",icon:"✕",type:"keystone",x:105,y:170,max:1,costs:[16],requires:[{id:"havoc_overkill",rank:1}],branchReq:3,exclusive:"havoc_doctrine",desc:"HPを犠牲に威力と発動速度を極限まで高める。",effect:r=>r?"権能ダメージ ×1.38 / CD ×0.82 / 最大HP ×0.68":"未選択",tradeoff:true},
    {id:"colossus_god",branch:"havoc",name:"巨像神格",icon:"▰",type:"keystone",x:105,y:325,max:1,costs:[16],requires:[{id:"forge_core",rank:1}],branchReq:3,exclusive:"havoc_doctrine",desc:"機動力を犠牲に範囲と一撃を巨大化する。",effect:r=>r?"権能範囲 ×1.35 / ダメージ ×1.18 / 速度 ×0.82":"未選択",tradeoff:true},
    {id:"havoc_mastery",branch:"havoc",name:"黙示録の種",icon:"☄",type:"mastery",x:105,y:65,max:1,costs:[22],requires:[{id:"havoc_overkill",rank:2},{id:"forge_core",rank:1}],branchReq:5,desc:"開始時ランダム権能を2種類へ増やす。",effect:r=>r?"開始時ランダム権能 +2種類":"未取得"},

    {id:"dominion_area",branch:"dominion",name:"世界拡張",icon:"◎",type:"minor",x:855,y:275,max:3,costs:[5,8,11],requires:[{id:"rebirth_output",rank:1}],desc:"円・線・爆発を含む権能範囲を拡張する。",effect:r=>`権能範囲 +${r*10}%`},
    {id:"dominion_control",branch:"dominion",name:"停止法則",icon:"⌛",type:"notable",x:975,y:180,max:2,costs:[7,11],requires:[{id:"dominion_area",rank:1}],desc:"時間停止・重力場・安全域の持続を延ばす。",effect:r=>`支配時間 +${r*16}%`},
    {id:"synergy_matrix",branch:"dominion",name:"共鳴行列",icon:"◆◆",type:"notable",x:975,y:345,max:2,costs:[10,15],requires:[{id:"dominion_area",rank:1}],desc:"取得済み共鳴効果の最終威力を増幅する。",effect:r=>`共鳴ダメージ +${r*18}%`},
    {id:"chaos_clock",branch:"dominion",name:"乱数時計",icon:"?",type:"keystone",x:1150,y:170,max:1,costs:[16],requires:[{id:"dominion_control",rank:1}],branchReq:3,exclusive:"dominion_doctrine",desc:"全権能を高速化する代わりに威力を少し落とす。",effect:r=>r?"権能CD ×0.70 / 権能ダメージ ×0.88":"未選択",tradeoff:true},
    {id:"precision_law",branch:"dominion",name:"絶対法則",icon:"†",type:"keystone",x:1150,y:325,max:1,costs:[16],requires:[{id:"synergy_matrix",rank:1}],branchReq:3,exclusive:"dominion_doctrine",desc:"発動間隔を延ばし、一撃と共鳴を巨大化する。",effect:r=>r?"権能ダメージ ×1.38 / 権能CD ×1.16":"未選択",tradeoff:true},
    {id:"dominion_mastery",branch:"dominion",name:"二重現実",icon:"◇◇",type:"mastery",x:1150,y:65,max:1,costs:[22],requires:[{id:"dominion_control",rank:2},{id:"synergy_matrix",rank:1}],branchReq:5,desc:"時間発動型権能が一定確率で残響する。",effect:r=>r?"20%で残響発動（45%威力）":"未取得"},

    {id:"aegis_shell",branch:"aegis",name:"原初防壁",icon:"⬢",type:"notable",x:405,y:555,max:1,costs:[9],requires:[{id:"rebirth_frame",rank:1}],desc:"巨獣殻がなくても一定間隔で防壁を再生する。",effect:r=>r?"18秒ごとに1Hit防壁":"未取得"},
    {id:"aegis_blood",branch:"aegis",name:"瀕死炉心",icon:"◒",type:"notable",x:285,y:650,max:2,costs:[7,11],requires:[{id:"aegis_shell",rank:1}],desc:"HP35%以下で威力と移動速度を高める。",effect:r=>`瀕死時：権能威力 +${r*16}% / 速度 +${r*10}%`},
    {id:"glass_god",branch:"aegis",name:"硝子の神",icon:"◇",type:"keystone",x:105,y:540,max:1,costs:[16],requires:[{id:"aegis_blood",rank:1}],branchReq:2,exclusive:"aegis_doctrine",desc:"最大HPを半減させ、全権能を暴力的に増幅する。",effect:r=>r?"権能ダメージ ×1.52 / 最大HP ×0.56":"未選択",tradeoff:true},
    {id:"fortress_god",branch:"aegis",name:"不動の神",icon:"▣",type:"keystone",x:105,y:695,max:1,costs:[16],requires:[{id:"aegis_shell",rank:1}],branchReq:2,exclusive:"aegis_doctrine",desc:"移動速度を犠牲に巨大HPと軽減を得る。",effect:r=>r?"最大HP ×1.62 / 被ダメージ -12% / 速度 ×0.82":"未選択",tradeoff:true},
    {id:"aegis_mastery",branch:"aegis",name:"死者拒絶",icon:"☀",type:"mastery",x:105,y:790,max:1,costs:[22],requires:[{id:"aegis_blood",rank:2}],branchReq:4,desc:"1ランに一度、HP45%・3秒無敵で復帰する。",effect:r=>r?"復活1回 / HP45% / 3秒無敵":"未取得"},

    {id:"harvest_growth",branch:"harvest",name:"暴食学習",icon:"♢",type:"minor",x:855,y:555,max:3,costs:[5,8,11],requires:[{id:"rebirth_clock",rank:1}],desc:"経験値獲得量を増やす。",effect:r=>`経験値 +${r*8}%`},
    {id:"harvest_magnet",branch:"harvest",name:"財宝磁界",icon:"◎",type:"notable",x:975,y:650,max:1,costs:[10],requires:[{id:"harvest_growth",rank:1}],desc:"宝箱を広範囲から吸い寄せる。",effect:r=>r?"宝箱吸引半径 700":"未取得"},
    {id:"boss_legacy",branch:"harvest",name:"王遺産",icon:"♛",type:"notable",x:975,y:500,max:2,costs:[9,14],requires:[{id:"harvest_growth",rank:1}],desc:"ボス報酬の選択肢と進化核獲得を強化する。",effect:r=>`ボス報酬候補 +${r} / 2撃破ごと進化核 +${r}`},
    {id:"swift_harvest",branch:"harvest",name:"疾走収奪",icon:"↯",type:"keystone",x:1150,y:540,max:1,costs:[16],requires:[{id:"harvest_growth",rank:2}],branchReq:3,exclusive:"harvest_doctrine",desc:"成長速度を優先し、持ち帰る深淵片を少し減らす。",effect:r=>r?"経験値 ×1.28 / 深淵片 ×0.84":"未選択",tradeoff:true},
    {id:"deep_harvest",branch:"harvest",name:"深層収奪",icon:"▣",type:"keystone",x:1150,y:695,max:1,costs:[16],requires:[{id:"harvest_magnet",rank:1}],branchReq:3,exclusive:"harvest_doctrine",desc:"成長を少し遅らせ、深淵片を大幅に増やす。",effect:r=>r?"深淵片 ×1.42 / 経験値 ×0.90":"未選択",tradeoff:true},
    {id:"harvest_mastery",branch:"harvest",name:"黄金雨",icon:"✦",type:"mastery",x:1150,y:790,max:1,costs:[22],requires:[{id:"harvest_magnet",rank:1},{id:"boss_legacy",rank:1}],branchReq:5,desc:"55体撃破ごとに宝箱を強制出現させる。",effect:r=>r?"55撃破ごとに宝箱 +1":"未取得"}
  ];

  function replaceSkillTree(){
    if (!Array.isArray(SKILL_BRANCHES) || !Array.isArray(SKILL_NODES)) return;
    SKILL_BRANCHES.splice(0,SKILL_BRANCHES.length,...NEW_BRANCHES);
    SKILL_NODES.splice(0,SKILL_NODES.length,...NEW_NODES);
    if (typeof SKILL_LOOKUP === "object" && SKILL_LOOKUP){
      for (const key of Object.keys(SKILL_LOOKUP)) delete SKILL_LOOKUP[key];
      for (const node of SKILL_NODES){
        const branch=SKILL_BRANCHES.find(item=>item.id===node.branch);
        SKILL_LOOKUP[node.id]={...node,branchName:branch?.name||"",branchColor:branch?.color||"#fff"};
      }
    }
  }

  replaceSkillTree();

  function clamp(value,min,max){ return Math.max(min,Math.min(max,value)); }
  function finite(value,fallback=0){ return Number.isFinite(Number(value))?Number(value):fallback; }
  function choice(list){ return list&&list.length?list[Math.floor(Math.random()*list.length)]:null; }
  function shuffle(list){
    const out=list.slice();
    for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
    return out;
  }
  function formatNumber(value,digits=2){
    if(!Number.isFinite(value))return "-";
    if(Math.abs(value-Math.round(value))<.005)return String(Math.round(value));
    return value.toFixed(digits).replace(/0+$/,'').replace(/\.$/,'');
  }
  function rankOf(player,id){ return Math.max(0,Math.floor(finite(player?.upgradeRanks?.[id],0))); }
  function ownedPowerIds(player){ return POWER_IDS.filter(id=>rankOf(player,id)>0); }
  function isEvolved(player,id){ return !!player?.powerEvolutions?.[id]; }
  function hasSynergy(player,id){ return !!player?.powerSynergies?.[id]; }
  function dominantCategory(player){
    const counts={};
    for(const id of ownedPowerIds(player)){
      const category=POWER_CATALOG[id].category;
      counts[category]=(counts[category]||0)+rankOf(player,id);
    }
    return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
  }
  function addCategoryModifier(player,category,multiplier){
    player.categoryDamageMul=player.categoryDamageMul||{};
    player.categoryDamageMul[category]=(player.categoryDamageMul[category]||1)*multiplier;
  }
  function addPowerModifier(player,id,multiplier){
    player.powerDamageById=player.powerDamageById||{};
    player.powerDamageById[id]=(player.powerDamageById[id]||1)*multiplier;
  }
  function categoryMultiplier(player,id){
    const category=POWER_CATALOG[id]?.category;
    return (player?.categoryDamageMul?.[category]||1)*(player?.powerDamageById?.[id]||1);
  }
  function synergyMultiplier(player){ return 1+(finite(player?.synergyDamageBonus,0)); }
  function currentChallenge(game){ return CHALLENGES[game?.records?.challengeSelected]||CHALLENGES.none; }
  function selectedLayer(game){ return clamp(Math.floor(finite(game?.records?.abyssSelected,0)),0,MAX_ABYSS_LAYER); }

  window.__abyssSystems = {
    version:SYSTEM_VERSION,
    POWER_CATALOG,
    EVOLUTIONS,
    SYNERGIES,
    CHALLENGES,
    STAGE_RULES,
    validate(){
      const problems=[];
      for(const [id,evolution] of Object.entries(EVOLUTIONS))if(!POWER_CATALOG[id]||!evolution.name)problems.push(`invalid evolution ${id}`);
      for(const [id,synergy] of Object.entries(SYNERGIES))for(const power of synergy.powers)if(!POWER_CATALOG[power])problems.push(`invalid synergy ${id}:${power}`);
      const signatures=Object.values(RELICS).filter(relic=>Number.isInteger(relic.signature));
      if(signatures.length!==4||new Set(signatures.map(relic=>relic.signature)).size!==4)problems.push("four unique boss signature relics are required");
      if(new Set(POWER_IDS).size!==POWER_IDS.length)problems.push("duplicate power id");
      return {ok:problems.length===0,problems,powerCount:POWER_IDS.length,synergyCount:Object.keys(SYNERGIES).length,bossSignatureCount:signatures.length};
    }
  };

  /* ============================== UI / 保存 ============================== */
  function injectUi(){
    if(document.getElementById("abyssSettingsScreen"))return;

    const titleActions=document.querySelector("#titleScreen .title-actions");
    if(titleActions){
      const settingsButton=document.createElement("div");
      settingsButton.className="btn abyss-settings-open";
      settingsButton.id="titleSettingsBtn";
      settingsButton.tabIndex=0;
      settingsButton.setAttribute("role","button");
      settingsButton.textContent="設定";
      titleActions.appendChild(settingsButton);
    }

    const metaCard=document.querySelector("#titleScreen .meta-progress-card");
    if(metaCard){
      const layerCard=document.createElement("section");
      layerCard.id="abyssLayerCard";
      layerCard.className="abyss-layer-card";
      layerCard.innerHTML=`
        <div class="abyss-layer-head">
          <div><small>POST-CLEAR DESCENT</small><strong>深淵層</strong></div>
          <div class="abyss-layer-stepper">
            <button id="abyssLayerDown" type="button" aria-label="深淵層を下げる">−</button>
            <span id="abyssLayerValue">0</span>
            <button id="abyssLayerUp" type="button" aria-label="深淵層を上げる">＋</button>
          </div>
        </div>
        <div id="abyssLayerLock" class="abyss-layer-lock" hidden>初回クリア後に深淵層と追加チャレンジが解放されます。</div>
        <div id="abyssLayerSummary" class="abyss-layer-summary"></div>
        <label class="challenge-select-label" for="challengeSelect">追加チャレンジ</label>
        <select id="challengeSelect" class="challenge-select"></select>
        <div id="challengeSummary" class="challenge-summary"></div>`;
      metaCard.insertAdjacentElement("afterend",layerCard);
    }

    const pausePanel=document.querySelector("#pauseScreen .title-block");
    if(pausePanel){
      const button=document.createElement("div");
      button.className="btn";
      button.id="pauseSettingsBtn";
      button.tabIndex=0;
      button.setAttribute("role","button");
      button.textContent="設定";
      pausePanel.insertBefore(button,document.getElementById("quitBtn"));
      pausePanel.insertBefore(document.createElement("br"),document.getElementById("quitBtn"));
    }

    const hud=document.getElementById("hud");
    if(hud){
      const stageRule=document.createElement("div");
      stageRule.id="stageRuleHud";
      stageRule.innerHTML=`<span id="stageRuleIcon">◎</span><div><strong id="stageRuleName">共鳴門域</strong><small id="stageRuleText"></small></div>`;
      hud.appendChild(stageRule);

      const build=document.createElement("div");
      build.id="buildStatusHud";
      build.innerHTML=`<span id="buildSlotText">権能 0/5</span><span id="buildCoreText">進化核 0</span><span id="buildSynergyText">共鳴 0</span>`;
      hud.appendChild(build);
    }

    const settings=document.createElement("div");
    settings.id="abyssSettingsScreen";
    settings.className="overlay-screen hidden";
    settings.innerHTML=`
      <div class="abyss-settings-shell">
        <header><div><small>SIGNAL CALIBRATION</small><h2>表示・音響設定</h2></div><button id="settingsCloseBtn" type="button">閉じる</button></header>
        <div class="abyss-settings-grid">
          <label>全体音量 <output id="masterVolumeOut">60</output><input id="masterVolumeSetting" type="range" min="0" max="100" value="60"></label>
          <label>BGM音量 <output id="musicVolumeOut">35</output><input id="musicVolumeSetting" type="range" min="0" max="100" value="35"></label>
          <label>効果音量 <output id="sfxVolumeOut">70</output><input id="sfxVolumeSetting" type="range" min="0" max="100" value="70"></label>
          <label>画面揺れ <output id="shakeOut">70</output><input id="shakeSetting" type="range" min="0" max="100" value="70"></label>
          <label>エフェクト密度<select id="effectsSetting"><option value="low">低</option><option value="normal">標準</option><option value="high">高</option></select></label>
          <label>ダメージ数字<select id="damageTextSetting"><option value="low">少ない</option><option value="normal">標準</option><option value="high">多い</option></select></label>
          <label class="setting-toggle"><input id="flashSetting" type="checkbox"><span>画面フラッシュを表示</span></label>
          <label class="setting-toggle"><input id="contrastSetting" type="checkbox"><span>高コントラスト表示</span></label>
          <label class="setting-toggle"><input id="motionSetting" type="checkbox"><span>演出の動きを軽減</span></label>
          <label class="setting-toggle"><input id="projectileSetting" type="checkbox"><span>敵弾の白縁を強調</span></label>
        </div>
        <p class="settings-note">BGMは外部音源を使わず、Web Audioでステージごとに自動生成します。設定はlocalStorageへ保存されます。</p>
      </div>`;
    document.body.appendChild(settings);

    const reward=document.createElement("div");
    reward.id="abyssRewardScreen";
    reward.className="overlay-screen hidden";
    reward.innerHTML=`
      <div class="abyss-reward-shell">
        <header><small id="rewardKicker">BOSS LEGACY</small><h2 id="rewardTitle">報酬を選択</h2><p id="rewardDescription"></p></header>
        <div id="rewardChoices" class="abyss-reward-choices"></div>
      </div>`;
    document.body.appendChild(reward);
  }

  injectUi();

  const DEFAULT_SETTINGS = {
    musicVolume:35,
    sfxVolume:70,
    shake:70,
    effects:"normal",
    damageText:"normal",
    flashes:true,
    highContrast:false,
    reducedMotion:false,
    projectileOutline:true
  };

  function normalizeSettings(raw){
    const settings=Object.assign({},DEFAULT_SETTINGS,raw&&typeof raw==="object"?raw:{});
    settings.musicVolume=clamp(Math.round(finite(settings.musicVolume,35)),0,100);
    settings.sfxVolume=clamp(Math.round(finite(settings.sfxVolume,70)),0,100);
    settings.shake=clamp(Math.round(finite(settings.shake,70)),0,100);
    if(!["low","normal","high"].includes(settings.effects))settings.effects="normal";
    if(!["low","normal","high"].includes(settings.damageText))settings.damageText="normal";
    settings.flashes=settings.flashes!==false;
    settings.highContrast=!!settings.highContrast;
    settings.reducedMotion=!!settings.reducedMotion;
    settings.projectileOutline=settings.projectileOutline!==false;
    return settings;
  }

  function rawSavedRecords(){
    try{return JSON.parse(localStorage.getItem(SAVE_KEY)||"{}");}catch(error){return {};}
  }

  function legacyRefund(rawTree){
    if(!rawTree||typeof rawTree!=="object"||Array.isArray(rawTree))return 0;
    const newIds=new Set(NEW_NODES.map(node=>node.id));
    const costsById={};
    for(const node of BASE_SKILL_SNAPSHOT)costsById[node.id]=node.costs;
    for(const [id,costs] of Object.entries(LEGACY_REBIRTH_COSTS))costsById[id]=costs;
    let refund=0;
    for(const [id,value] of Object.entries(rawTree)){
      if(newIds.has(id))continue;
      const costs=costsById[id];
      if(!costs)continue;
      const rank=Math.max(0,Math.floor(finite(value,0)));
      for(let i=0;i<rank;i++)refund+=costs[i]??costs[costs.length-1]??0;
    }
    return refund;
  }

  const previousLoadRecords=Game.prototype.loadRecords;
  Game.prototype.loadRecords=function(){
    const raw=rawSavedRecords();
    previousLoadRecords.call(this);
    this.records.settings=normalizeSettings(raw.settings||this.records.settings);
    const legacyClear=finite(this.records.bestTime,0)>=CONFIG.GAME_TIME-1;
    this.records.abyssUnlocked=clamp(Math.max(Math.floor(finite(raw.abyssUnlocked,0)),legacyClear?1:0),0,MAX_ABYSS_LAYER);
    this.records.abyssSelected=clamp(Math.floor(finite(raw.abyssSelected,0)),0,this.records.abyssUnlocked);
    this.records.challengeSelected=CHALLENGES[raw.challengeSelected]?raw.challengeSelected:"none";
    if(this.records.abyssUnlocked<=0)this.records.challengeSelected="none";
    this.records.challengeBest=raw.challengeBest&&typeof raw.challengeBest==="object"?raw.challengeBest:{};
    this.records.runHistory=Array.isArray(raw.runHistory)?raw.runHistory.slice(0,MAX_RUN_HISTORY):[];
    this.records.onboardingVersion=clamp(Math.floor(finite(raw.onboardingVersion,0)),0,1);
    this.records.systemVersion=Math.floor(finite(raw.systemVersion,0));

    if(this.records.systemVersion<SYSTEM_VERSION){
      const refund=legacyRefund(raw.skillTree);
      if(refund>0)this.records.shards=Math.max(0,Math.floor(finite(this.records.shards,0)))+refund;
      this.records.systemVersion=SYSTEM_VERSION;
      this.records.lastSystemRefund=refund;
      try{localStorage.setItem(SAVE_KEY,JSON.stringify(this.records));}catch(error){}
    }

    this.sound.volume=clamp(finite(this.records.volume,60)/100,0,1);
    updateTitleControls(this);
    applySettings(this);
  };

  const previousSaveRecords=Game.prototype.saveRecords;
  Game.prototype.saveRecords=function(){
    this.records.settings=normalizeSettings(this.records.settings);
    this.records.abyssUnlocked=clamp(Math.floor(finite(this.records.abyssUnlocked,0)),0,MAX_ABYSS_LAYER);
    this.records.abyssSelected=clamp(Math.floor(finite(this.records.abyssSelected,0)),0,this.records.abyssUnlocked);
    this.records.onboardingVersion=clamp(Math.floor(finite(this.records.onboardingVersion,0)),0,1);
    if(!CHALLENGES[this.records.challengeSelected])this.records.challengeSelected="none";
    return previousSaveRecords.call(this);
  };

  function applySettings(game){
    const settings=normalizeSettings(game?.records?.settings);
    if(game?.records)game.records.settings=settings;
    document.body.classList.toggle("abyss-high-contrast",settings.highContrast);
    document.body.classList.toggle("abyss-reduced-motion",settings.reducedMotion);
    document.body.classList.toggle("abyss-projectile-outline",settings.projectileOutline);
    const baseDamageTexts=CONFIG._abyssBaseDamageTexts||(CONFIG._abyssBaseDamageTexts=CONFIG.MAX_DAMAGE_TEXTS);
    CONFIG.MAX_DAMAGE_TEXTS=settings.damageText==="low"?Math.max(40,Math.round(baseDamageTexts*.55)):settings.damageText==="high"?Math.round(baseDamageTexts*1.4):baseDamageTexts;
    const master=document.getElementById("masterVolumeSetting");
    const music=document.getElementById("musicVolumeSetting");
    const sfx=document.getElementById("sfxVolumeSetting");
    const shake=document.getElementById("shakeSetting");
    const effects=document.getElementById("effectsSetting");
    const damageText=document.getElementById("damageTextSetting");
    const flash=document.getElementById("flashSetting");
    const contrast=document.getElementById("contrastSetting");
    const motion=document.getElementById("motionSetting");
    const projectile=document.getElementById("projectileSetting");
    if(master)master.value=String(game?.records?.volume??60);
    if(music)music.value=String(settings.musicVolume);
    if(sfx)sfx.value=String(settings.sfxVolume);
    if(shake)shake.value=String(settings.shake);
    if(effects)effects.value=settings.effects;
    if(damageText)damageText.value=settings.damageText;
    if(flash)flash.checked=settings.flashes;
    if(contrast)contrast.checked=settings.highContrast;
    if(motion)motion.checked=settings.reducedMotion;
    if(projectile)projectile.checked=settings.projectileOutline;
    updateSettingOutputs(game);
  }

  function updateSettingOutputs(game){
    const pairs=[
      ["masterVolumeOut",game?.records?.volume??60],
      ["musicVolumeOut",game?.records?.settings?.musicVolume??35],
      ["sfxVolumeOut",game?.records?.settings?.sfxVolume??70],
      ["shakeOut",game?.records?.settings?.shake??70]
    ];
    for(const [id,value] of pairs){const el=document.getElementById(id);if(el)el.textContent=String(value);}
  }

  function openSettings(game){
    if(!game)return;
    game._settingsReturnState=game.state;game._settingsOpen=true;
    game.input?.keys?.clear?.();
    if(game.state!=="title")game.state="settings";
    applySettings(game);
    document.getElementById("abyssSettingsScreen")?.classList.remove("hidden");
  }

  function closeSettings(game){
    if(!game)return;
    game._settingsOpen=false;
    document.getElementById("abyssSettingsScreen")?.classList.add("hidden");
    const returnState=game._settingsReturnState||"title";
    game.state=returnState==="playing"?"paused":returnState;
    if(game.state==="paused")document.getElementById("pauseScreen")?.classList.remove("hidden");
    game.lastTime=performance.now();
    game.saveRecords();
  }

  function updateTitleControls(game){
    if(!game?.records)return;
    const unlocked=(game.records.abyssUnlocked||0)>0||finite(game.records.bestTime,0)>=CONFIG.GAME_TIME-1;
    const card=document.getElementById("abyssLayerCard");
    const lock=document.getElementById("abyssLayerLock");
    if(card)card.classList.toggle("is-locked",!unlocked);
    if(lock)lock.hidden=unlocked;
    const layer=clamp(Math.floor(finite(game.records.abyssSelected,0)),0,game.records.abyssUnlocked||0);
    game.records.abyssSelected=layer;
    const value=document.getElementById("abyssLayerValue");
    const summary=document.getElementById("abyssLayerSummary");
    if(value)value.textContent=String(layer);
    if(summary){
      const hp=Math.round(layer*12),atk=Math.round(layer*8),reward=Math.round(layer*10);
      summary.textContent=!unlocked?"標準航行で10分間生存し、深淵への入口を開け。":layer===0?"標準層。敵補正なし。":"敵HP +"+hp+"% / 敵攻撃 +"+atk+"% / 深淵片 +"+reward+"%";
    }
    const select=document.getElementById("challengeSelect");
    if(select){
      if(!select.options.length){
        for(const [id,data] of Object.entries(CHALLENGES)){
          const option=document.createElement("option");option.value=id;option.textContent=data.name;select.appendChild(option);
        }
      }
      select.value=game.records.challengeSelected||"none";
      select.disabled=!unlocked;
    }
    const challenge=CHALLENGES[game.records.challengeSelected]||CHALLENGES.none;
    const challengeSummary=document.getElementById("challengeSummary");
    if(challengeSummary)challengeSummary.textContent=unlocked?challenge.desc:"追加チャレンジは初回クリア後に選択できます。";
    const up=document.getElementById("abyssLayerUp");
    const down=document.getElementById("abyssLayerDown");
    if(up)up.disabled=!unlocked||layer>=game.records.abyssUnlocked;
    if(down)down.disabled=!unlocked||layer<=0;
  }

  function bindInjectedUi(){
    const getGame=()=>window.__game;
    document.getElementById("titleSettingsBtn")?.addEventListener("click",()=>openSettings(getGame()));
    document.getElementById("pauseSettingsBtn")?.addEventListener("click",()=>{
      document.getElementById("pauseScreen")?.classList.add("hidden");
      openSettings(getGame());
    });
    document.getElementById("settingsCloseBtn")?.addEventListener("click",()=>closeSettings(getGame()));
    document.getElementById("abyssLayerDown")?.addEventListener("click",()=>{
      const game=getGame();if(!game)return;game.records.abyssSelected=Math.max(0,game.records.abyssSelected-1);game.saveRecords();updateTitleControls(game);
    });
    document.getElementById("abyssLayerUp")?.addEventListener("click",()=>{
      const game=getGame();if(!game)return;game.records.abyssSelected=Math.min(game.records.abyssUnlocked,game.records.abyssSelected+1);game.saveRecords();updateTitleControls(game);
    });
    document.getElementById("challengeSelect")?.addEventListener("change",event=>{
      const game=getGame();if(!game)return;game.records.challengeSelected=CHALLENGES[event.target.value]?event.target.value:"none";game.saveRecords();updateTitleControls(game);
    });

    const saveSetting=()=>{
      const game=getGame();if(!game)return;
      const settings=normalizeSettings(game.records.settings);
      game.records.volume=clamp(Math.round(finite(document.getElementById("masterVolumeSetting")?.value,60)),0,100);
      settings.musicVolume=clamp(Math.round(finite(document.getElementById("musicVolumeSetting")?.value,35)),0,100);
      settings.sfxVolume=clamp(Math.round(finite(document.getElementById("sfxVolumeSetting")?.value,70)),0,100);
      settings.shake=clamp(Math.round(finite(document.getElementById("shakeSetting")?.value,70)),0,100);
      settings.effects=document.getElementById("effectsSetting")?.value||"normal";
      settings.damageText=document.getElementById("damageTextSetting")?.value||"normal";
      settings.flashes=!!document.getElementById("flashSetting")?.checked;
      settings.highContrast=!!document.getElementById("contrastSetting")?.checked;
      settings.reducedMotion=!!document.getElementById("motionSetting")?.checked;
      settings.projectileOutline=!!document.getElementById("projectileSetting")?.checked;
      game.records.settings=settings;
      game.sound.volume=game.records.volume/100;
      applySettings(game);
      game.saveRecords();
    };
    for(const id of ["masterVolumeSetting","musicVolumeSetting","sfxVolumeSetting","shakeSetting","effectsSetting","damageTextSetting","flashSetting","contrastSetting","motionSetting","projectileSetting"]){
      document.getElementById(id)?.addEventListener("input",saveSetting);
      document.getElementById(id)?.addEventListener("change",saveSetting);
    }
    if(!window.__abyssLevelHotkeysBound){
      window.__abyssLevelHotkeysBound=true;
      window.addEventListener("keydown",event=>{
        const game=getGame();
        if(!game||game.state!=="levelup"||event.repeat)return;
        const target=event.target;
        if(target&&["INPUT","SELECT","TEXTAREA"].includes(target.tagName))return;
        const index=Number(event.key)-1;
        if(index>=0&&index<4&&game._levelUpSelectActions?.[index]){
          event.preventDefault();game._levelUpSelectActions[index]();
        }else if(event.key.toLowerCase()==="r"&&game._levelUpRerollAction){
          event.preventDefault();game._levelUpRerollAction();
        }
      });
    }
  }

  window.addEventListener("DOMContentLoaded",()=>{
    bindInjectedUi();
    const game=window.__game;
    if(game){updateTitleControls(game);applySettings(game);}
    if(!window.__abyssSettingsEscapeBound){
      window.__abyssSettingsEscapeBound=true;
      window.addEventListener("game-escape",()=>{const current=window.__game;if(current?._settingsOpen)closeSettings(current);});
    }
  });

  /* ============================== 統計 ============================== */
  function newRunStats(){
    return {
      damageBySource:{},killsBySource:{},damageTaken:0,healing:0,treasures:0,gems:0,
      bossKills:0,evolutions:[],synergies:[],relics:[],mutations:[],rerolls:0,banishes:0,
      stageNests:0,startedAt:Date.now()
    };
  }

  function sourceLabel(source){
    if(POWER_CATALOG[source])return POWER_CATALOG[source].name;
    if(SYNERGIES[source])return SYNERGIES[source].name;
    const aliases={death_explosion:"撃破爆発",stage_nest:"増殖巣",boss_reward:"ボス報酬",unknown:"その他"};
    return aliases[source]||source||"その他";
  }

  function recordDamage(game,source,amount,killed){
    if(!game?._runStats||amount<=0)return;
    const key=source||"unknown";
    game._runStats.damageBySource[key]=(game._runStats.damageBySource[key]||0)+amount;
    if(killed)game._runStats.killsBySource[key]=(game._runStats.killsBySource[key]||0)+1;
  }

  function withDamageSource(game,source,action){
    const previous=game._damageSource;
    game._damageSource=source;
    try{return action();}finally{game._damageSource=previous;}
  }

  const previousDamageEnemy=Game.prototype.damageEnemy;
  Game.prototype.damageEnemy=function(enemy,damage,crit){
    if(!enemy||enemy.dead)return;
    const before=Math.max(0,finite(enemy.hp,0));
    const wasDead=!!enemy.dead;
    const result=previousDamageEnemy.call(this,enemy,damage,crit);
    const after=Math.max(0,finite(enemy.hp,0));
    recordDamage(this,this._damageSource||"unknown",Math.max(0,before-after),!wasDead&&!!enemy.dead);
    return result;
  };

  const previousDamageBoss=Game.prototype.damageBoss;
  Game.prototype.damageBoss=function(damage,crit){
    const boss=this.boss;
    if(!boss||boss.dead)return;
    const before=Math.max(0,finite(boss.hp,0));
    const result=previousDamageBoss.call(this,damage,crit);
    const after=this.boss===boss?Math.max(0,finite(boss.hp,0)):0;
    recordDamage(this,this._damageSource||"unknown",Math.max(0,before-after),false);
    return result;
  };

  const previousEnemyDeath=Enemy.prototype.onDeath;
  Enemy.prototype.onDeath=function(game){
    if(this._systemDeathHandled)return;
    this._systemDeathHandled=true;
    return withDamageSource(game,"death_explosion",()=>previousEnemyDeath.call(this,game));
  };

  const previousPlayerDamage=Player.prototype.takeDamage;
  Player.prototype.takeDamage=function(amount,game){
    const before=Math.max(0,this.hp);
    if(this._shellCharges>0&&!this.invincible){
      this._shellCharges--;
      this._shellTimer=this._shellRecharge||16;
      const radius=260*(this.systemAreaMul||1);
      const damage=powerDamage(game,"leviathan_shell",2.2);
      areaDamage(game,this.x,this.y,radius,damage,"leviathan_shell",6);
      game.addEffect(new SystemPulse(this.x,this.y,radius,"#42e8bd",.65));
      if(hasSynergy(this,"crimson_carapace"))activateBloodEclipse(game,.9);
      game.shake(10,.25);
      return;
    }
    const result=previousPlayerDamage.call(this,amount,game);
    const taken=Math.max(0,before-this.hp);
    if(game?._runStats)game._runStats.damageTaken+=taken;
    return result;
  };

  /* ============================== 共通戦闘処理 / エフェクト ============================== */
  function effectDensity(game){ return game?.records?.settings?.effects||"normal"; }

  class SystemPulse{
    constructor(x,y,radius,color,life=.55,fill=true){
      this.x=x;this.y=y;this.radius=radius;this.color=color;this.life=life;this.maxLife=life;this.dead=false;this.fill=fill;this.critical=false;
    }
    update(dt){this.life-=dt;if(this.life<=0)this.dead=true;}
    draw(ctx,cam){
      const progress=1-clamp(this.life/this.maxLife,0,1),alpha=clamp(this.life/this.maxLife,0,1);
      const radius=this.radius*(.16+.84*(1-Math.pow(1-progress,3)));
      ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.globalCompositeOperation="source-over";
      if(this.fill){const gradient=ctx.createRadialGradient(0,0,0,0,0,Math.max(1,radius));gradient.addColorStop(0,rgba("#fff7dc",alpha*.52));gradient.addColorStop(.35,rgba(this.color,alpha*.24));gradient.addColorStop(1,rgba(this.color,0));ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();}
      for(let i=0;i<3;i++){ctx.strokeStyle=i===1?rgba("#fff7dc",alpha*.9):rgba(this.color,alpha*(.75-i*.16));ctx.lineWidth=Math.max(1,9-i*3);ctx.beginPath();ctx.arc(0,0,radius*(.64+i*.16),0,Math.PI*2);ctx.stroke();}
      ctx.restore();
    }
  }

  class SystemBeam{
    constructor(ax,ay,bx,by,width,color,life=.32){
      this.ax=ax;this.ay=ay;this.bx=bx;this.by=by;this.x=(ax+bx)/2;this.y=(ay+by)/2;this.radius=Math.hypot(bx-ax,by-ay)/2;this.width=width;this.color=color;this.life=life;this.maxLife=life;this.dead=false;this.critical=false;
    }
    update(dt){this.life-=dt;if(this.life<=0)this.dead=true;}
    draw(ctx,cam){
      const alpha=clamp(this.life/this.maxLife,0,1);ctx.save();ctx.translate(-cam.x,-cam.y);ctx.lineCap="round";
      for(const [width,color] of [[this.width*2.5,rgba(this.color,alpha*.14)],[this.width,rgba(this.color,alpha*.82)],[Math.max(3,this.width*.18),rgba("#fff7dc",alpha)]]){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(this.ax,this.ay);ctx.lineTo(this.bx,this.by);ctx.stroke();}
      ctx.restore();
    }
  }

  class SystemWarning{
    constructor(x,y,opt={}){
      this.x=x;this.y=y;this.radius=opt.radius||120;this.angle=opt.angle||0;this.length=opt.length||500;this.width=opt.width||26;this.kind=opt.kind||"ring";this.color=opt.color||"#ff5268";this.life=opt.life||.7;this.maxLife=this.life;this.dead=false;this.critical=true;
    }
    update(dt){this.life-=dt;if(this.life<=0)this.dead=true;}
    draw(ctx,cam){
      const alpha=clamp(this.life/this.maxLife,0,1),pulse=.6+.4*Math.sin((1-alpha)*Math.PI*12);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.rotate(this.angle);ctx.globalAlpha=.55+.45*pulse;ctx.strokeStyle=this.color;ctx.fillStyle=rgba(this.color,.13);ctx.lineWidth=5;ctx.setLineDash([16,10]);ctx.lineDashOffset=-performance.now()*.08;
      if(this.kind==="line"){ctx.fillRect(0,-this.width/2,this.length,this.width);ctx.strokeRect(0,-this.width/2,this.length,this.width);}
      else if(this.kind==="cross"){ctx.fillRect(-this.length,-this.width/2,this.length*2,this.width);ctx.fillRect(-this.width/2,-this.length,this.width,this.length*2);ctx.strokeRect(-this.length,-this.width/2,this.length*2,this.width);ctx.strokeRect(-this.width/2,-this.length,this.width,this.length*2);}
      else{ctx.beginPath();ctx.arc(0,0,this.radius,0,Math.PI*2);ctx.fill();ctx.stroke();}
      ctx.setLineDash([]);ctx.restore();
    }
  }

  class GravityField{
    constructor(game,x,y,rank,scale=1){
      const stats=getPowerStats(game.player,"gravity_coffin",rank);this.game=game;this.x=x;this.y=y;this.radius=stats.radius;this.damage=powerDamage(game,"gravity_coffin",stats.damage*scale);this.life=stats.duration;this.maxLife=this.life;this.dead=false;this.tick=0;this.color="#b45cff";this.critical=true;
    }
    update(dt){
      this.life-=dt;this.tick-=dt;
      if(this.tick<=0){
        this.tick=.08;
        for(const enemy of enemiesInRadius(this.game,this.x,this.y,this.radius)){
          const distance=Math.max(20,U.dist(enemy.x,enemy.y,this.x,this.y));
          const pull=(1-distance/this.radius)*1050;
          enemy.x+=((this.x-enemy.x)/distance)*pull*.08;
          enemy.y+=((this.y-enemy.y)/distance)*pull*.08;
        }
      }
      if(this.life<=0&&!this.dead){
        areaDamage(this.game,this.x,this.y,this.radius,this.damage,"gravity_coffin",8);
        this.game.addEffect(new SystemPulse(this.x,this.y,this.radius,this.color,.72));
        if(isEvolved(this.game.player,"gravity_coffin"))this.game._delayedSystemCasts.push({delay:.65,type:"mini_gravity",x:this.x,y:this.y,damage:Math.round(this.damage*.55),radius:this.radius*.55});
        if(hasSynergy(this.game.player,"horizon_blade"))castWorldCutter(this.game,rankOf(this.game.player,"world_cutter"),.72,{x:this.x,y:this.y});
        this.game.shake(13,.32);this.dead=true;
      }
    }
    draw(ctx,cam){
      const alpha=clamp(this.life/this.maxLife,0,1),radius=this.radius*(.82+.06*Math.sin(performance.now()*.01));ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);const gradient=ctx.createRadialGradient(0,0,0,0,0,radius);gradient.addColorStop(0,rgba("#090718",.74));gradient.addColorStop(.58,rgba(this.color,.22));gradient.addColorStop(1,rgba(this.color,0));ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();ctx.strokeStyle=rgba(this.color,.9*alpha);ctx.lineWidth=6;ctx.setLineDash([20,12]);ctx.lineDashOffset=-performance.now()*.05;ctx.beginPath();ctx.arc(0,0,radius*.82,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();
    }
  }

  class MeteorMarker{
    constructor(game,x,y,rank,scale=1){
      const stats=getPowerStats(game.player,"meteor_scripture",rank);this.game=game;this.x=x;this.y=y;this.radius=stats.radius;this.damage=powerDamage(game,"meteor_scripture",stats.damage*scale);this.life=.82;this.maxLife=.82;this.dead=false;this.critical=true;
    }
    update(dt){
      this.life-=dt;
      if(this.life<=0&&!this.dead){
        areaDamage(this.game,this.x,this.y,this.radius,this.damage,"meteor_scripture",5);
        this.game.addEffect(new SystemPulse(this.x,this.y,this.radius,"#ff8a4c",.58));
        if(isEvolved(this.game.player,"meteor_scripture"))this.game.addEffect(new BurnField(this.game,this.x,this.y,this.radius*.72,this.damage*.22,"meteor_scripture",3.2));
        if(hasSynergy(this.game.player,"helios_scripture"))areaDamage(this.game,this.x,this.y,this.radius*.8,powerDamage(this.game,"solar_funeral",.9),"helios_scripture",3);
        this.dead=true;
      }
    }
    draw(ctx,cam){
      const progress=1-this.life/this.maxLife,alpha=.45+.55*Math.sin(progress*Math.PI*10);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.strokeStyle=`rgba(255,82,104,${alpha})`;ctx.fillStyle="rgba(255,138,76,.14)";ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,this.radius*(.55+.45*progress),0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(-this.radius,0);ctx.lineTo(this.radius,0);ctx.moveTo(0,-this.radius);ctx.lineTo(0,this.radius);ctx.stroke();ctx.restore();
    }
  }

  class BurnField{
    constructor(game,x,y,radius,dps,source,life=3){this.game=game;this.x=x;this.y=y;this.radius=radius;this.dps=dps;this.source=source;this.life=life;this.maxLife=life;this.tick=0;this.dead=false;this.critical=false;}
    update(dt){this.life-=dt;this.tick-=dt;if(this.tick<=0){this.tick=.25;areaDamage(this.game,this.x,this.y,this.radius,this.dps*.25,this.source,2,false);}if(this.life<=0)this.dead=true;}
    draw(ctx,cam){const alpha=clamp(this.life/this.maxLife,0,1);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);const gradient=ctx.createRadialGradient(0,0,0,0,0,this.radius);gradient.addColorStop(0,rgba("#ffd447",.18*alpha));gradient.addColorStop(.5,rgba("#ff5268",.13*alpha));gradient.addColorStop(1,rgba("#ff5268",0));ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(0,0,this.radius,0,Math.PI*2);ctx.fill();ctx.strokeStyle=rgba("#ff8a4c",.45*alpha);ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,this.radius*(.9+.04*Math.sin(performance.now()*.012)),0,Math.PI*2);ctx.stroke();ctx.restore();}
  }

  class CometMine{
    constructor(game,x,y,rank){const stats=getPowerStats(game.player,"comet_wake",rank);this.game=game;this.x=x;this.y=y;this.radius=stats.radius;this.damage=powerDamage(game,"comet_wake",stats.damage);this.life=.5;this.maxLife=.5;this.dead=false;this.critical=false;}
    update(dt){this.life-=dt;if(this.life<=0&&!this.dead){areaDamage(this.game,this.x,this.y,this.radius,this.damage,"comet_wake",4);this.game.addEffect(new SystemPulse(this.x,this.y,this.radius,"#65d9ff",.4));if(isEvolved(this.game.player,"comet_wake")){const nearest=nearestTargets(this.game,1,430,{x:this.x,y:this.y})[0];if(nearest)this.game._delayedSystemCasts.push({delay:.16,type:"comet_chain",x:nearest.x,y:nearest.y,damage:Math.round(this.damage*.68),radius:this.radius*.82});}this.dead=true;}}
    draw(ctx,cam){const alpha=clamp(this.life/this.maxLife,0,1);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.rotate(performance.now()*.004);ctx.strokeStyle=rgba("#65d9ff",alpha);ctx.fillStyle=rgba("#5164ff",.2);ctx.lineWidth=4;polygonPath(ctx,[[0,-18],[18,0],[0,18],[-18,0]]);ctx.fill();ctx.stroke();ctx.restore();}
  }

  class RiftHazard{
    constructor(game,x,y,angle){this.game=game;this.x=x;this.y=y;this.angle=angle;this.length=420;this.width=54;this.life=4.2;this.maxLife=4.2;this.telegraph=1.05;this.tick=0;this.dead=false;this.critical=true;}
    update(dt){
      this.life-=dt;
      if(this.life<this.maxLife-this.telegraph){
        this.tick-=dt;
        if(this.tick<=0){this.tick=.45;const p=this.game.player,ex=this.x+Math.cos(this.angle)*this.length,ey=this.y+Math.sin(this.angle)*this.length;if(pointToSegmentDistance(p.x,p.y,this.x-Math.cos(this.angle)*this.length,this.y-Math.sin(this.angle)*this.length,ex,ey)<p.radius+this.width*.5)p.takeDamage(Math.max(5,Math.round(p.maxHp*.07)),this.game);}
      }
      if(this.life<=0)this.dead=true;
    }
    draw(ctx,cam){
      const elapsed=this.maxLife-this.life,active=elapsed>=this.telegraph,alpha=active?clamp(this.life/1.2,0,1):.55+.35*Math.sin(elapsed*16);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.rotate(this.angle);ctx.fillStyle=active?rgba("#ff5268",.2*alpha):rgba("#ffd447",.1);ctx.strokeStyle=active?rgba("#fff7dc",.82*alpha):rgba("#ffd447",alpha);ctx.lineWidth=active?6:4;ctx.setLineDash(active?[]:[18,12]);ctx.fillRect(-this.length,-this.width/2,this.length*2,this.width);ctx.strokeRect(-this.length,-this.width/2,this.length*2,this.width);ctx.setLineDash([]);ctx.restore();
    }
  }

  class AbyssPulse{
    constructor(game,x,y,radius){this.game=game;this.x=x;this.y=y;this.radius=radius;this.life=2.7;this.maxLife=2.7;this.triggered=false;this.dead=false;this.critical=true;}
    update(dt){
      this.life-=dt;
      if(!this.triggered&&this.life<=.45){
        this.triggered=true;
        const player=this.game.player;
        if(U.dist2(player.x,player.y,this.x,this.y)>this.radius*this.radius)player.takeDamage(Math.max(8,Math.round(player.maxHp*.16)),this.game);
        this.game.addEffect(new SystemPulse(this.x,this.y,this.radius,"#b45cff",.7,false));
        this.game.shake(12,.35);
      }
      if(this.life<=0)this.dead=true;
    }
    draw(ctx,cam){
      const progress=1-this.life/this.maxLife,pulse=.65+.35*Math.sin(progress*25);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.fillStyle=rgba("#42e8bd",.06);ctx.strokeStyle=rgba("#42e8bd",.65*pulse);ctx.lineWidth=6;ctx.setLineDash([18,12]);ctx.lineDashOffset=-performance.now()*.05;ctx.beginPath();ctx.arc(0,0,this.radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=rgba("#090718",.25*progress);ctx.beginPath();ctx.rect(-this.game.viewW,-this.game.viewH,this.game.viewW*2,this.game.viewH*2);ctx.arc(0,0,this.radius,0,Math.PI*2,true);ctx.fill("evenodd");ctx.restore();
    }
  }

  function enemiesInRadius(game,x,y,radius){
    const result=[];const r2=radius*radius;
    for(const enemy of game.enemies){if(!enemy.dead&&U.dist2(x,y,enemy.x,enemy.y)<=Math.pow(radius+enemy.radius,2))result.push(enemy);}
    return result;
  }

  function pointToSegmentDistance(px,py,ax,ay,bx,by){
    const dx=bx-ax,dy=by-ay,length2=dx*dx+dy*dy;
    if(length2<=.0001)return Math.hypot(px-ax,py-ay);
    const t=clamp(((px-ax)*dx+(py-ay)*dy)/length2,0,1);
    return Math.hypot(px-(ax+dx*t),py-(ay+dy*t));
  }

  function nearestTargets(game,count,range=1100,origin){
    const source=origin||game.player,items=[];
    for(const enemy of game.enemies){if(enemy.dead)continue;const distance=U.dist2(source.x,source.y,enemy.x,enemy.y);if(distance<=range*range)items.push({enemy,distance});}
    items.sort((a,b)=>a.distance-b.distance);
    return items.slice(0,count).map(item=>item.enemy);
  }

  function powerDamage(game,id,multiplier,scale=1){
    const player=game.player;
    const levelScale=1+Math.max(0,player.level-1)*.055;
    const lowBonus=player.hp/Math.max(1,player.maxHp)<=.35?(player.lowPowerBonus||0):0;
    const evolvedMul=isEvolved(player,id)?1.22:1;
    return Math.max(1,Math.round(
      player.atk*levelScale*(player.systemDamageMul||1)*(game._stageDamageMul||1)*categoryMultiplier(player,id)*(1+lowBonus)*evolvedMul*multiplier*scale
    ));
  }

  function areaDamage(game,x,y,radius,damage,source,textLimit=6,includeBoss=true){
    let shown=0;
    withDamageSource(game,source,()=>{
      for(const enemy of enemiesInRadius(game,x,y,radius)){
        const previousTexts=game.damageTexts.length;
        game.damageEnemy(enemy,damage,false);
        if(shown++>=textLimit&&game.damageTexts.length>previousTexts)game.damageTexts.pop();
      }
      if(includeBoss&&game.boss&&!game.boss.dead&&U.dist2(x,y,game.boss.x,game.boss.y)<=Math.pow(radius+game.boss.radius,2))game.damageBoss(damage,false);
    });
  }

  function lineDamage(game,ax,ay,bx,by,width,damage,source,textLimit=6){
    let shown=0;
    withDamageSource(game,source,()=>{
      for(const enemy of game.enemies){
        if(enemy.dead||pointToSegmentDistance(enemy.x,enemy.y,ax,ay,bx,by)>enemy.radius+width)continue;
        const previousTexts=game.damageTexts.length;game.damageEnemy(enemy,damage,false);if(shown++>=textLimit&&game.damageTexts.length>previousTexts)game.damageTexts.pop();
      }
      if(game.boss&&!game.boss.dead&&pointToSegmentDistance(game.boss.x,game.boss.y,ax,ay,bx,by)<=game.boss.radius+width)game.damageBoss(damage,false);
    });
  }

  function spawnEnemyShot(game,x,y,angle,speed,damage,radius,color){
    if(game.enemyProjectiles.length>=CONFIG.MAX_ENEMY_PROJECTILES)return;
    game.enemyProjectiles.push(new EnemyProjectile(x,y,Math.cos(angle)*speed,Math.sin(angle)*speed,damage,radius,color));
  }

  function radialShots(game,source,count,speed,damage,offset=0,color=source.color||"#ff5268"){
    for(let i=0;i<count;i++)spawnEnemyShot(game,source.x,source.y,offset+i/count*Math.PI*2,speed,damage,7,color);
  }

  function fanShots(game,source,player,count,spread,speed,damage,color=source.color||"#ff5268"){
    const base=U.angle(source.x,source.y,player.x,player.y);
    for(let i=0;i<count;i++){
      const angle=base+(i-(count-1)/2)*(spread/Math.max(1,count-1));
      spawnEnemyShot(game,source.x,source.y,angle,speed,damage,7,color);
    }
  }

  function queueCast(game,item){game._delayedSystemCasts.push(item);}

  /* ============================== 権能定義 / 発動 ============================== */
  function getPowerStats(player,id,rank=rankOf(player,id)){
    const r=clamp(rank,1,3),area=player?.systemAreaMul||1,control=player?.controlDurationMul||1,evolved=isEvolved(player,id);
    switch(id){
      case"solar_funeral":return{cooldown:[9,7.4,6][r-1],radius:[340,440,560][r-1]*area,damage:[2.4,3.35,4.55][r-1],pulses:evolved?2:1};
      case"world_cutter":return{cooldown:[10.5,8.4,6.6][r-1],range:1320,width:[82,116,152][r-1]*area,damage:[3.25,4.55,6.1][r-1],cross:evolved};
      case"storm_throne":return{cooldown:[7.2,5.9,4.8][r-1],targets:[7,12,18][r-1]+(evolved?4:0),damage:[1.5,2.15,3][r-1],chain:evolved?1:0};
      case"gravity_coffin":return{cooldown:[12,9.8,7.8][r-1],duration:[2.3,2.7,3.1][r-1]*control,radius:[240,300,370][r-1]*area,damage:[3,4.2,5.7][r-1]};
      case"meteor_scripture":return{cooldown:[9.5,7.7,6.1][r-1],count:[3,5,8][r-1]+(evolved?2:0),radius:[145,175,210][r-1]*area,damage:[2.5,3.4,4.6][r-1]};
      case"razor_constellation":return{count:[3,5,7][r-1]+(evolved?2:0),radius:[112,132,154][r-1]*area,damage:[.95,1.35,1.85][r-1],hitCd:[.38,.31,.25][r-1]*(evolved ? .78 : 1)};
      case"comet_wake":return{spacing:[74,58,44][r-1]*(evolved ? .82 : 1),radius:[105,132,162][r-1]*area,damage:[1.15,1.6,2.2][r-1]};
      case"mirror_legion":return{cooldown:[1.45,1.16,.92][r-1],count:[2,3,4][r-1]+(evolved?1:0),damage:[.9,1.2,1.55][r-1],cross:evolved};
      case"void_choir":return{cooldown:[8.2,6.5,5.1][r-1],rays:[12,18,26][r-1],width:[26,34,44][r-1]*area,damage:[1.35,1.85,2.55][r-1],volleys:evolved?2:1};
      case"doom_bloom":return{kills:[16,12,9][r-1]*(evolved ? .8 : 1),targets:[8,13,20][r-1],damage:[1.35,1.9,2.65][r-1]};
      case"black_sun":return{orbit:[190,220,250][r-1]*area,radius:[82,105,130][r-1]*area,dps:[2.3,3.35,4.8][r-1],count:evolved?2:1};
      case"time_execution":return{cooldown:[13,10.5,8.2][r-1],duration:[1.35,1.9,2.55][r-1]*control*(evolved?1.25:1),damage:[1.9,2.65,3.65][r-1],execute:evolved ? .18 : 0};
      case"leviathan_shell":return{cooldown:[14,10.8,8][r-1],radius:[300,390,500][r-1]*area,damage:[2.4,3.35,4.65][r-1],charges:evolved?2:1};
      case"blood_eclipse":return{cooldown:[18,14,10][r-1],duration:[2.1,2.7,3.4][r-1]*control,radius:[260,340,430][r-1]*area,pulse:[.65,.85,1.15][r-1],threshold:evolved ? .45 : .35,pulseInterval:evolved ? .36 : .5};
      case"hunter_verdict":return{kills:[10,7,5][r-1]*(evolved ? .72 : 1),execute:[.36,.48,.62][r-1]+(evolved ? .08 : 0),boss:[.08,.12,.17][r-1]+(evolved ? .04 : 0)};
      case"prism_web":return{cooldown:[5.8,4.6,3.6][r-1],nodes:[6,10,15][r-1]+(evolved?3:0),width:[24,31,40][r-1]*area,damage:[1.25,1.75,2.4][r-1],pulses:evolved?2:1};
      case"chaos_oracle":return{cooldown:[7,5.7,4.5][r-1],power:[.78,1,1.28][r-1]*(evolved?1.12:1)};
      case"treasure_singularity":return{radius:[420,560,720][r-1]*area,damage:[3.2,4.8,6.8][r-1],exp:[.35,.65,1][r-1],mutation:evolved ? .22 : 0};
      case"overdrive_contract":return{cooldown:Math.pow(evolved ? .79 : .84,r),hp:Math.pow(.92,r)};
      case"abyss_banquet":return{gems:Math.round([32,23,16][r-1]*(evolved ? .72 : 1)),radius:[430,560,720][r-1]*area,damage:[2.2,3.2,4.6][r-1],heal:[.05,.08,.12][r-1]};
      default:return{};
    }
  }

  function powerLines(player,id,rank=rankOf(player,id)){
    const stats=getPowerStats(player,id,rank);
    switch(id){
      case"solar_funeral":return[`半径 ${Math.round(stats.radius)}`,`攻撃力 ×${formatNumber(stats.damage)}`,`${formatNumber(stats.cooldown)}秒ごと${stats.pulses>1?" / 2連":""}`];
      case"world_cutter":return[`射程 ${stats.range} / 幅 ${Math.round(stats.width)}`,`攻撃力 ×${formatNumber(stats.damage)}`,`${formatNumber(stats.cooldown)}秒ごと${stats.cross?" / 十字斬":""}`];
      case"storm_throne":return[`最大 ${stats.targets}体`,`1体へ ×${formatNumber(stats.damage)}`,`${formatNumber(stats.cooldown)}秒ごと${stats.chain?" / 追加連鎖":""}`];
      case"gravity_coffin":return[`吸引半径 ${Math.round(stats.radius)}`,`収束 ${formatNumber(stats.duration)}秒 → ×${formatNumber(stats.damage)}`,`再設置 ${formatNumber(stats.cooldown)}秒`];
      case"meteor_scripture":return[`流星 ${stats.count}発 / 半径 ${Math.round(stats.radius)}`,`1発 ×${formatNumber(stats.damage)}`,`再詠唱 ${formatNumber(stats.cooldown)}秒`];
      case"razor_constellation":return[`刃 ${stats.count}枚 / 公転 ${Math.round(stats.radius)}`,`1Hit ×${formatNumber(stats.damage)}`,`再Hit ${formatNumber(stats.hitCd)}秒`];
      case"comet_wake":return[`移動 ${Math.round(stats.spacing)}ごと`,`爆発半径 ${Math.round(stats.radius)}`,`攻撃力 ×${formatNumber(stats.damage)}`];
      case"mirror_legion":return[`鏡像 ${stats.count}機`,`各砲撃 ×${formatNumber(stats.damage)}`,`射撃 ${formatNumber(stats.cooldown)}秒`];
      case"void_choir":return[`光条 ${stats.rays}本 / 幅 ${Math.round(stats.width)}`,`攻撃力 ×${formatNumber(stats.damage)}`,`再発動 ${formatNumber(stats.cooldown)}秒${stats.volleys>1?" / 2斉射":""}`];
      case"doom_bloom":return[`必要撃破 ${Math.round(stats.kills)}体`,`最大 ${stats.targets}体`,`1体へ ×${formatNumber(stats.damage)}`];
      case"black_sun":return[`恒星 ${stats.count}個 / 公転 ${Math.round(stats.orbit)}`,`接触半径 ${Math.round(stats.radius)}`,`毎秒 ×${formatNumber(stats.dps)}`];
      case"time_execution":return[`完全停止 ${formatNumber(stats.duration)}秒`,`終了時 全敵へ ×${formatNumber(stats.damage)}`,`再発動 ${formatNumber(stats.cooldown)}秒`];
      case"leviathan_shell":return[`防壁 ${stats.charges}枚`,`破壊時 半径 ${Math.round(stats.radius)}`,`再生 ${formatNumber(stats.cooldown)}秒`];
      case"blood_eclipse":return[`HP${Math.round(stats.threshold*100)}%以下`,`無敵 ${formatNumber(stats.duration)}秒`,`1波 ×${formatNumber(stats.pulse)}`];
      case"hunter_verdict":return[`必要撃破 ${Math.round(stats.kills)}体`,`雑魚処刑 ${Math.round(stats.execute*100)}%以下`,`ボス最大HP ${Math.round(stats.boss*100)}%`];
      case"prism_web":return[`接続 ${stats.nodes}体 / 幅 ${Math.round(stats.width)}`,`攻撃力 ×${formatNumber(stats.damage)}`,`再展開 ${formatNumber(stats.cooldown)}秒`];
      case"chaos_oracle":return[`4権能から抽選`,`抽選威力 ×${formatNumber(stats.power)}`,`再抽選 ${formatNumber(stats.cooldown)}秒`];
      case"treasure_singularity":return[`爆発半径 ${Math.round(stats.radius)}`,`攻撃力 ×${formatNumber(stats.damage)}`,`次Lv経験値 ${Math.round(stats.exp*100)}%`];
      case"overdrive_contract":return[`権能CD ×${formatNumber(stats.cooldown)}`,`最大HP段階 ×${formatNumber(stats.hp)}`,`火力低下なし`];
      case"abyss_banquet":return[`必要ジェム ${stats.gems}個`,`半径 ${Math.round(stats.radius)} / ×${formatNumber(stats.damage)}`,`最大HP ${Math.round(stats.heal*100)}%回復`];
      default:return[];
    }
  }

  function acquirePower(player,id){
    const def=POWER_CATALOG[id];if(!def)return false;
    player.upgradeRanks=player.upgradeRanks||{};
    const before=rankOf(player,id);
    if(before>=def.max)return false;
    player.upgradeRanks[id]=before+1;
    if(id==="overdrive_contract"){
      const ratio=player.hp/Math.max(1,player.maxHp);
      player.maxHp=Math.max(1,Math.round(player.maxHp*.92));
      player.hp=Math.max(1,Math.round(player.maxHp*ratio));
    }
    return true;
  }

  function evolvePower(game,id){
    if(!POWER_CATALOG[id]||rankOf(game.player,id)<POWER_CATALOG[id].max||game.player.evolutionCores<=0)return false;
    game.player.powerEvolutions=game.player.powerEvolutions||{};
    if(game.player.powerEvolutions[id])return false;
    game.player.evolutionCores--;
    game.player.powerEvolutions[id]=true;
    game._runStats?.evolutions.push(id);
    game.showSystemToast(EVOLUTIONS[id].icon,EVOLUTIONS[id].name,EVOLUTIONS[id].summary,`${POWER_CATALOG[id].name}が最終形態へ進化` ,CATEGORY_INFO[POWER_CATALOG[id].category].color);
    return true;
  }

  function acquireSynergy(game,id){
    const synergy=SYNERGIES[id];if(!synergy||hasSynergy(game.player,id))return false;
    game.player.powerSynergies=game.player.powerSynergies||{};
    game.player.powerSynergies[id]=true;
    game._runStats?.synergies.push(id);
    game.showSystemToast(synergy.icon,synergy.name,synergy.summary,"共鳴成立", "#ffd447");
    return true;
  }

  function effectiveCooldown(game,base){
    return Math.max(.22,base*(game.player.systemCooldownMul||1)*(game._stageCooldownMul||1));
  }

  function castSolar(game,rank,scale=1,origin){
    const stats=getPowerStats(game.player,"solar_funeral",rank),x=origin?.x??game.player.x,y=origin?.y??game.player.y;
    areaDamage(game,x,y,stats.radius,powerDamage(game,"solar_funeral",stats.damage,scale),"solar_funeral",8);
    game.addEffect(new SystemPulse(x,y,stats.radius,"#ff5268",.7));game.shake(12,.3);game.sound.explosion();
    if(stats.pulses>1)queueCast(game,{delay:.42,type:"solar_echo",x,y,rank,scale:.72});
  }

  function castWorldCutter(game,rank,scale=1,targetPoint){
    const stats=getPowerStats(game.player,"world_cutter",rank),player=game.player;
    let target=targetPoint;
    if(!target){const enemy=nearestTargets(game,1,1500)[0]||(game.boss&&!game.boss.dead?game.boss:null);if(!enemy)return;target=enemy;}
    const angle=U.angle(player.x,player.y,target.x,target.y),endX=player.x+Math.cos(angle)*stats.range,endY=player.y+Math.sin(angle)*stats.range,damage=powerDamage(game,"world_cutter",stats.damage,scale);
    lineDamage(game,player.x,player.y,endX,endY,stats.width,damage,"world_cutter",8);game.addEffect(new SystemBeam(player.x,player.y,endX,endY,stats.width,"#ff5268",.4));game.shake(15,.24);game.sound.laser();
    if(stats.cross){const angle2=angle+Math.PI/2,ax=target.x-Math.cos(angle2)*stats.range*.55,ay=target.y-Math.sin(angle2)*stats.range*.55,bx=target.x+Math.cos(angle2)*stats.range*.55,by=target.y+Math.sin(angle2)*stats.range*.55;lineDamage(game,ax,ay,bx,by,stats.width*.72,Math.round(damage*.72),"world_cutter",5);game.addEffect(new SystemBeam(ax,ay,bx,by,stats.width*.72,"#ffd447",.36));}
  }

  function castStorm(game,rank,scale=1){
    const stats=getPowerStats(game.player,"storm_throne",rank),targets=nearestTargets(game,stats.targets,1200),damage=powerDamage(game,"storm_throne",stats.damage,scale);
    withDamageSource(game,"storm_throne",()=>{
      targets.forEach((enemy,index)=>{game.addEffect(new LightningEffect(game.player.x,game.player.y,enemy.x,enemy.y,index%2?"#b45cff":"#65d9ff",.22,7));game.damageEnemy(enemy,damage,false);if(stats.chain){const next=nearestTargets(game,1,260,enemy).find(item=>item!==enemy);if(next){game.addEffect(new LightningEffect(enemy.x,enemy.y,next.x,next.y,"#ffd447",.18,5));game.damageEnemy(next,Math.round(damage*.58),false);}}});
      if(game.boss&&!game.boss.dead&&targets.length<stats.targets){game.addEffect(new LightningEffect(game.player.x,game.player.y,game.boss.x,game.boss.y,"#ffd447",.24,9));game.damageBoss(damage,false);}
    });
    if(targets.length)game.sound.lightning();
  }

  function castGravity(game,rank,scale=1){
    const targets=nearestTargets(game,12,1100);let x=game.player.x,y=game.player.y;
    if(targets.length){x=targets.reduce((sum,e)=>sum+e.x,0)/targets.length;y=targets.reduce((sum,e)=>sum+e.y,0)/targets.length;}
    const stats=getPowerStats(game.player,"gravity_coffin",rank);game.addEffect(new GravityField(game,x,y,rank,scale));game.addEffect(new SystemWarning(x,y,{radius:stats.radius,color:"#b45cff",life:.55}));
  }

  function castMeteors(game,rank,scale=1){
    const stats=getPowerStats(game.player,"meteor_scripture",rank),targets=nearestTargets(game,stats.count,1250);
    for(const enemy of targets)game.addEffect(new MeteorMarker(game,enemy.x,enemy.y,rank,scale));
    if(game.boss&&!game.boss.dead&&targets.length<stats.count)game.addEffect(new MeteorMarker(game,game.boss.x,game.boss.y,rank,scale));
  }

  function castMirror(game,rank,scale=1){
    const stats=getPowerStats(game.player,"mirror_legion",rank),targets=nearestTargets(game,stats.count,1150),damage=powerDamage(game,"mirror_legion",stats.damage,scale),player=game.player;
    withDamageSource(game,"mirror_legion",()=>targets.forEach((enemy,index)=>{const angle=player.animT*1.4+index/stats.count*Math.PI*2,x=player.x+Math.cos(angle)*86,y=player.y+Math.sin(angle)*86;game.addEffect(new SystemBeam(x,y,enemy.x,enemy.y,15,"#65d9ff",.24));game.damageEnemy(enemy,damage,false);if(stats.cross){const second=targets[(index+1)%targets.length];if(second&&second!==enemy){game.addEffect(new SystemBeam(x,y,second.x,second.y,9,"#b45cff",.2));game.damageEnemy(second,Math.round(damage*.48),false);}}}));
  }

  function choirVolley(game,rank,scale,rotation,origin,source="void_choir"){
    const stats=getPowerStats(game.player,"void_choir",rank),player=game.player,x=origin?.x??player.x,y=origin?.y??player.y,range=1350,damage=powerDamage(game,"void_choir",stats.damage,scale),step=Math.PI*2/stats.rays;
    withDamageSource(game,source,()=>{
      for(const enemy of game.enemies){if(enemy.dead)continue;const dx=enemy.x-x,dy=enemy.y-y,distance=Math.hypot(dx,dy);if(distance>range)continue;const angle=(Math.atan2(dy,dx)-rotation+Math.PI*8)%(Math.PI*2),delta=Math.min(angle%step,step-angle%step);if(Math.sin(delta)*distance<=stats.width+enemy.radius)game.damageEnemy(enemy,damage,false);}
      if(game.boss&&!game.boss.dead){const dx=game.boss.x-x,dy=game.boss.y-y,distance=Math.hypot(dx,dy),angle=(Math.atan2(dy,dx)-rotation+Math.PI*8)%(Math.PI*2),delta=Math.min(angle%step,step-angle%step);if(distance<=range&&Math.sin(delta)*distance<=stats.width+game.boss.radius)game.damageBoss(damage,false);}
    });
    for(let i=0;i<stats.rays;i++){const angle=rotation+i*step;game.addEffect(new SystemBeam(x,y,x+Math.cos(angle)*range,y+Math.sin(angle)*range,stats.width,"#b45cff",.34));}
  }

  function castChoir(game,rank,scale=1){
    const stats=getPowerStats(game.player,"void_choir",rank),rotation=Math.random()*Math.PI*2;choirVolley(game,rank,scale,rotation);
    if(stats.volleys>1)queueCast(game,{delay:.35,type:"choir_echo",rank,scale:.7,rotation:rotation+Math.PI/stats.rays});
    if(hasSynergy(game.player,"eclipse_choir")){const black=getBlackSunPositions(game)[0];if(black)choirVolley(game,rank,.42,rotation+Math.PI/(stats.rays*2),black,"eclipse_choir");}
    game.shake(9,.2);
  }

  function castWeb(game,rank,scale=1){
    const stats=getPowerStats(game.player,"prism_web",rank),targets=nearestTargets(game,stats.nodes,1150);if(targets.length<2)return;
    const points=[{x:game.player.x,y:game.player.y},...targets.map(enemy=>({x:enemy.x,y:enemy.y}))];
    if(hasSynergy(game.player,"infinite_refraction")){const mirror=getMirrorPositions(game);points.splice(1,0,...mirror);}
    const damage=powerDamage(game,"prism_web",stats.damage,scale);
    const pulse=()=>{for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];lineDamage(game,a.x,a.y,b.x,b.y,stats.width,damage,"prism_web",6);game.addEffect(new SystemBeam(a.x,a.y,b.x,b.y,stats.width,"#65d9ff",.32));}};
    pulse();if(stats.pulses>1)queueCast(game,{delay:.38,type:"web_echo",points,damage:Math.round(damage*.62),width:stats.width});
  }

  function castBanquet(game,rank){
    const stats=getPowerStats(game.player,"abyss_banquet",rank),before=game.player.hp;
    areaDamage(game,game.player.x,game.player.y,stats.radius,powerDamage(game,"abyss_banquet",stats.damage),"abyss_banquet",8);
    const heal=Math.round(game.player.maxHp*stats.heal);game.player.hp=Math.min(game.player.maxHp,game.player.hp+heal);
    const overflow=Math.max(0,before+heal-game.player.maxHp);if(isEvolved(game.player,"abyss_banquet")&&overflow>0)game.player._feastShield=(game.player._feastShield||0)+overflow;
    game.addEffect(new SystemPulse(game.player.x,game.player.y,stats.radius,"#42e8bd",.82));game.sound.item();
  }

  function castChaos(game,rank,scale=1){
    const stats=getPowerStats(game.player,"chaos_oracle",rank),pool=["solar_funeral","world_cutter","storm_throne","meteor_scripture"],first=choice(pool);
    castPowerById(game,first,Math.min(3,rank+1),stats.power*scale,false);
    const doubleCast=hasSynergy(game.player,"ruin_engine")&&Math.random()<.28;
    if(doubleCast){const second=choice(pool.filter(id=>id!==first));queueCast(game,{delay:.28,type:"power",id:second,rank:Math.min(3,rank+1),scale:stats.power*.72*scale,allowEcho:false});}
    if(isEvolved(game.player,"chaos_oracle"))queueCast(game,{delay:.55,type:"power",id:first,rank:Math.min(3,rank+1),scale:stats.power*.42*scale,allowEcho:false});
  }

  function castTimeExecution(game,rank){
    const stats=getPowerStats(game.player,"time_execution",rank);game._systemTimeStop=stats.duration;game._timeExecutionDamage=powerDamage(game,"time_execution",stats.damage);game._timeExecutionRank=rank;game._timeBurstPending=true;game.addEffect(new SystemPulse(game.player.x,game.player.y,Math.max(game.viewW,game.viewH),"#65d9ff",stats.duration,false));game.sound.lightning();
  }

  function castPowerById(game,id,rank,scale=1,allowEcho=true){
    switch(id){
      case"solar_funeral":castSolar(game,rank,scale);break;
      case"world_cutter":castWorldCutter(game,rank,scale);break;
      case"storm_throne":castStorm(game,rank,scale);break;
      case"gravity_coffin":castGravity(game,rank,scale);break;
      case"meteor_scripture":castMeteors(game,rank,scale);break;
      case"mirror_legion":castMirror(game,rank,scale);break;
      case"void_choir":castChoir(game,rank,scale);break;
      case"prism_web":castWeb(game,rank,scale);break;
      case"chaos_oracle":castChaos(game,rank,scale);break;
      case"time_execution":castTimeExecution(game,rank);break;
    }
    if(allowEcho&&game.player.systemEchoChance>0&&id!=="chaos_oracle"&&Math.random()<game.player.systemEchoChance)queueCast(game,{delay:.62,type:"power",id,rank,scale:.45,allowEcho:false});
  }

  function timerCast(game,id,dt){
    const rank=rankOf(game.player,id);if(!rank)return;
    const stats=getPowerStats(game.player,id,rank),base=stats.cooldown;if(!base)return;
    game._powerTimers[id]=(game._powerTimers[id]??.4)-dt;
    if(game._powerTimers[id]>0)return;
    game._powerTimers[id]+=effectiveCooldown(game,base);
    castPowerById(game,id,rank,1,true);
  }

  function getMirrorPositions(game){
    const rank=rankOf(game.player,"mirror_legion");if(!rank)return[];
    const stats=getPowerStats(game.player,"mirror_legion",rank),positions=[];
    for(let i=0;i<stats.count;i++){const angle=game.player.animT*1.4+i/stats.count*Math.PI*2;positions.push({x:game.player.x+Math.cos(angle)*86,y:game.player.y+Math.sin(angle)*86});}
    return positions;
  }

  function getBlackSunPositions(game){
    const rank=rankOf(game.player,"black_sun");if(!rank)return[];
    const stats=getPowerStats(game.player,"black_sun",rank),positions=[];
    for(let i=0;i<stats.count;i++){const direction=i%2?-1:1,angle=(game.player._blackSunAngle||0)*direction+i*Math.PI;positions.push({x:game.player.x+Math.cos(angle)*stats.orbit,y:game.player.y+Math.sin(angle)*stats.orbit});}
    return positions;
  }

  function updateContinuousPowers(game,dt,moved){
    const player=game.player;
    let rank=rankOf(player,"razor_constellation");
    if(rank){
      const stats=getPowerStats(player,"razor_constellation",rank),kinetic=hasSynergy(player,"kinetic_guillotine"),movementBoost=kinetic?clamp(moved/8,0,.8):0;
      player._razorAngle=(player._razorAngle||0)+dt*(2.35+rank*.35)*(1+movementBoost);player._razorHits=player._razorHits||new Map();
      for(const [key,time] of player._razorHits){const next=time-dt;if(next<=0)player._razorHits.delete(key);else player._razorHits.set(key,next);}
      const damage=powerDamage(game,"razor_constellation",stats.damage*(1+movementBoost*.45));
      for(let i=0;i<stats.count;i++){
        const angle=player._razorAngle+i/stats.count*Math.PI*2,x=player.x+Math.cos(angle)*stats.radius,y=player.y+Math.sin(angle)*stats.radius;
        for(const enemy of enemiesInRadius(game,x,y,30)){if(player._razorHits.has(enemy.uid))continue;player._razorHits.set(enemy.uid,stats.hitCd);withDamageSource(game,"razor_constellation",()=>game.damageEnemy(enemy,damage,false));}
        if(game.boss&&!game.boss.dead&&U.dist2(x,y,game.boss.x,game.boss.y)<=Math.pow(game.boss.radius+30,2)){const key=`boss_${i}`;if(!player._razorHits.has(key)){player._razorHits.set(key,stats.hitCd);withDamageSource(game,"razor_constellation",()=>game.damageBoss(damage,false));}}
      }
    }

    rank=rankOf(player,"black_sun");
    if(rank){
      const stats=getPowerStats(player,"black_sun",rank);player._blackSunAngle=(player._blackSunAngle||0)+dt*(1.12+rank*.18);player._blackSunTick=(player._blackSunTick||0)-dt;
      if(player._blackSunTick<=0){player._blackSunTick=.2;const damage=powerDamage(game,"black_sun",stats.dps*.2);for(const position of getBlackSunPositions(game))areaDamage(game,position.x,position.y,stats.radius,damage,"black_sun",2);}
    }

    rank=rankOf(player,"comet_wake");
    if(rank&&moved>0){const stats=getPowerStats(player,"comet_wake",rank);player._cometDistance=(player._cometDistance||0)+moved;if(player._cometDistance>=stats.spacing){player._cometDistance%=stats.spacing;game.addEffect(new CometMine(game,player.x,player.y,rank));}}

    rank=rankOf(player,"blood_eclipse");
    if(rank){
      const stats=getPowerStats(player,"blood_eclipse",rank);player._eclipseCd=Math.max(0,(player._eclipseCd||0)-dt);
      if(player._eclipseActive>0){player._eclipseActive-=dt;player.invBuffTimer=Math.max(player.invBuffTimer,.15);player._eclipsePulse=(player._eclipsePulse||0)-dt;if(player._eclipsePulse<=0){player._eclipsePulse=stats.pulseInterval;areaDamage(game,player.x,player.y,stats.radius,powerDamage(game,"blood_eclipse",stats.pulse),"blood_eclipse",4);game.addEffect(new SystemPulse(player.x,player.y,stats.radius,"#ff5268",.38));}}
      else if(player.hp/player.maxHp<=stats.threshold&&player._eclipseCd<=0)activateBloodEclipse(game,stats.duration);
    }

    rank=rankOf(player,"leviathan_shell");
    if(rank||player.permanentShieldRecharge){
      const stats=rank?getPowerStats(player,"leviathan_shell",rank):{cooldown:player.permanentShieldRecharge,charges:1};
      player._shellRecharge=effectiveCooldown(game,stats.cooldown);player._shellTimer=Math.max(0,(player._shellTimer||0)-dt);
      if((player._shellCharges||0)<stats.charges&&player._shellTimer<=0){player._shellCharges=(player._shellCharges||0)+1;player._shellTimer=player._shellRecharge;game.sound.item();game.addEffect(new SystemPulse(player.x,player.y,105,"#42e8bd",.45));}
    }

    if(player._feastShield>0)player._feastShield=Math.max(0,player._feastShield-dt*player.maxHp*.025);
  }

  function activateBloodEclipse(game,durationOverride){
    const rank=rankOf(game.player,"blood_eclipse");if(!rank)return;
    const stats=getPowerStats(game.player,"blood_eclipse",rank);game.player._eclipseActive=Math.max(game.player._eclipseActive||0,durationOverride||stats.duration);game.player._eclipseCd=effectiveCooldown(game,stats.cooldown);game.player._eclipsePulse=0;game.addEffect(new SystemPulse(game.player.x,game.player.y,stats.radius,"#ff5268",.9));
  }

  function updateTimedPowers(game,dt){
    for(const id of ["solar_funeral","world_cutter","storm_throne","gravity_coffin","meteor_scripture","mirror_legion","void_choir","prism_web","chaos_oracle","time_execution"])timerCast(game,id,dt);
  }

  function executeDelayedCast(game,item){
    switch(item.type){
      case"power":castPowerById(game,item.id,item.rank,item.scale,item.allowEcho!==false);break;
      case"solar_echo":castSolar(game,item.rank,item.scale,{x:item.x,y:item.y});break;
      case"choir_echo":choirVolley(game,item.rank,item.scale,item.rotation);break;
      case"web_echo":for(let i=1;i<item.points.length;i++){const a=item.points[i-1],b=item.points[i];lineDamage(game,a.x,a.y,b.x,b.y,item.width,item.damage,"prism_web",4);game.addEffect(new SystemBeam(a.x,a.y,b.x,b.y,item.width*.75,"#b45cff",.28));}break;
      case"mini_gravity":areaDamage(game,item.x,item.y,item.radius,item.damage,"gravity_coffin",4);game.addEffect(new SystemPulse(item.x,item.y,item.radius,"#b45cff",.5));break;
      case"comet_chain":areaDamage(game,item.x,item.y,item.radius,item.damage,"comet_wake",3);game.addEffect(new SystemPulse(item.x,item.y,item.radius,"#65d9ff",.4));break;
      case"boss_action":item.action?.();break;
    }
  }

  function updatePowers(game,dt,moved){
    updateTimedPowers(game,dt);updateContinuousPowers(game,dt,moved);
    for(let index=game._delayedSystemCasts.length-1;index>=0;index--){const item=game._delayedSystemCasts[index];item.delay-=dt;if(item.delay<=0){game._delayedSystemCasts.splice(index,1);executeDelayedCast(game,item);}}
  }

  /* ============================== 敵AI ============================== */
  function nearbySeparation(enemy,game){
    let x=0,y=0,count=0;
    const visit=other=>{if(other===enemy||other.dead)return;const dx=enemy.x-other.x,dy=enemy.y-other.y,d2=dx*dx+dy*dy,min=enemy.radius+other.radius+8;if(d2>.01&&d2<min*min){const distance=Math.sqrt(d2);x+=dx/distance;y+=dy/distance;count++;}};
    if(game._enemySpatial?.forEachNearby)game._enemySpatial.forEachNearby(enemy.x,enemy.y,enemy.radius*3+32,visit);else for(const other of game.enemies)visit(other);
    return count?{x:x/count,y:y/count}:{x:0,y:0};
  }

  function moveEnemy(enemy,dt,player,obstacles,game,angle,speedMultiplier=1){
    const separation=nearbySeparation(enemy,game);let vx=Math.cos(angle)+separation.x*.78,vy=Math.sin(angle)+separation.y*.78;
    for(const obstacle of obstacles){const distance=U.dist(enemy.x,enemy.y,obstacle.x,obstacle.y);if(distance<obstacle.radius+enemy.radius+34){const away=U.angle(obstacle.x,obstacle.y,enemy.x,enemy.y);vx+=Math.cos(away)*1.25;vy+=Math.sin(away)*1.25;}}
    const length=Math.hypot(vx,vy)||1;vx/=length;vy/=length;
    const nx=enemy.x+vx*enemy.speed*speedMultiplier*dt,ny=enemy.y+vy*enemy.speed*speedMultiplier*dt;
    if(!circleHitObstacle(nx,enemy.y,enemy.radius,obstacles))enemy.x=nx;
    if(!circleHitObstacle(enemy.x,ny,enemy.radius,obstacles))enemy.y=ny;
    enemy.x=clamp(enemy.x,enemy.radius,CONFIG.MAP_W-enemy.radius);enemy.y=clamp(enemy.y,enemy.radius,CONFIG.MAP_H-enemy.radius);enemy.facing=Math.atan2(vy,vx);
  }

  function contactEnemy(enemy,player,game,dt){
    if(enemy.contactCd>0)enemy.contactCd-=dt;
    const distance=U.dist(enemy.x,enemy.y,player.x,player.y);
    if(distance<enemy.radius+player.radius&&enemy.contactCd<=0){player.takeDamage(enemy.atk,game);enemy.contactCd=.6;}
    return distance;
  }

  function initEnemySystem(enemy){
    if(enemy._abyssAI)return enemy._abyssAI;
    const hpMultiplier={normal:1.08,fast:1.03,heavy:1.3,ranged:1.12,splitter:1.16,splitmini:1,elite:1.42}[enemy.type]||1;
    const attackMultiplier={normal:1.04,fast:1.08,heavy:1.15,ranged:1.1,splitter:1.08,splitmini:1,elite:1.22}[enemy.type]||1;
    enemy.maxHp=Math.round(enemy.maxHp*hpMultiplier);enemy.hp=enemy.maxHp;enemy.atk=Math.max(1,Math.round(enemy.atk*attackMultiplier));
    enemy._abyssAI={cooldown:U.rand(1.2,3),windup:0,dash:0,pattern:0,dir:{x:1,y:0},pending:null};
    return enemy._abyssAI;
  }

  Enemy.prototype.update=function(dt,player,enemies,obstacles,game){
    this.animT+=dt;this.spawnAge+=dt;if(this.hitFlash>0)this.hitFlash-=dt;if(this._systemGuard>0)this._systemGuard-=dt;
    if(game._systemTimeStop>0)return;
    const ai=initEnemySystem(this);ai.cooldown-=dt;

    if(ai.windup>0){
      ai.windup-=dt;
      if(ai.windup<=0){
        if(this.type==="normal")radialShots(game,this,6,235,this.atk*.62,this.animT*.4);
        else if(this.type==="fast"){ai.dash=.48;const lead=.26,tx=player.x+(player.lastMove?.x||0)*lead,ty=player.y+(player.lastMove?.y||0)*lead,angle=U.angle(this.x,this.y,tx,ty);ai.dir={x:Math.cos(angle),y:Math.sin(angle)};}
        else if(this.type==="heavy"){this._systemGuard=1.15;radialShots(game,this,10,205,this.atk*.7,this.animT*.3);}
        else if(this.type==="ranged")fanShots(game,this,player,5,.8,285,this.atk*.7);
        else if(this.type==="splitter"){for(let i=0;i<3;i++){const angle=i/3*Math.PI*2+this.animT,x=player.x+Math.cos(angle)*U.rand(150,260),y=player.y+Math.sin(angle)*U.rand(150,260);game.addEffect(new SystemMine(game,x,y,this.atk*.68,this.color));}}
        else if(this.type==="elite"){
          const pattern=ai.pattern++%3;
          if(pattern===0)fanShots(game,this,player,7,1.15,315,this.atk*.7);
          else if(pattern===1)radialShots(game,this,16,245,this.atk*.56,this.animT*.65);
          else for(let i=0;i<4;i++){const angle=i/4*Math.PI*2,x=player.x+Math.cos(angle)*220,y=player.y+Math.sin(angle)*220;game.addEffect(new SystemMine(game,x,y,this.atk*.7,"#b45cff"));}
        }
      }
    }

    if(ai.dash>0){
      ai.dash-=dt;const nx=this.x+ai.dir.x*this.speed*5.1*dt,ny=this.y+ai.dir.y*this.speed*5.1*dt;
      if(!circleHitObstacle(nx,ny,this.radius,obstacles)){this.x=nx;this.y=ny;}
      contactEnemy(this,player,game,dt);return;
    }

    const distance=U.dist(this.x,this.y,player.x,player.y),base=U.angle(this.x,this.y,player.x,player.y);let moveAngle=base,speedMultiplier=1;
    if(this.type==="normal"){
      moveAngle+=Math.sin(this.animT*2+this.seed)*.22;
      if(ai.cooldown<=0&&distance<560){ai.cooldown=U.rand(4.2,5.2);ai.windup=.68;game.addEffect(new SystemWarning(this.x,this.y,{radius:130,color:this.color,life:.68}));}
    }else if(this.type==="fast"){
      moveAngle+=Math.sin(this.animT*5+this.seed)*.42;speedMultiplier=1.1;
      if(ai.cooldown<=0&&distance<760){ai.cooldown=U.rand(3.3,4.2);ai.windup=.52;game.addEffect(new SystemWarning(this.x,this.y,{kind:"line",angle:base,length:520,width:34,color:this.color,life:.52}));}
    }else if(this.type==="heavy"){
      speedMultiplier=.82;
      if(ai.cooldown<=0&&distance<650){ai.cooldown=U.rand(5,6.3);ai.windup=.82;game.addEffect(new SystemWarning(this.x,this.y,{radius:180,color:this.color,life:.82}));}
    }else if(this.type==="ranged"){
      const desired=400;if(distance<desired-40)moveAngle=base+Math.PI;else if(distance<desired+40)moveAngle=base+Math.PI/2*(this.avoidAngleOffset>0?1:-1);speedMultiplier=.9;
      if(ai.cooldown<=0&&distance<850){ai.cooldown=U.rand(2.1,2.8);ai.windup=.42;game.addEffect(new SystemWarning(this.x,this.y,{kind:"line",angle:base,length:650,width:22,color:this.color,life:.42}));}
    }else if(this.type==="splitter"){
      moveAngle+=Math.sin(this.animT*1.6+this.seed)*.35;
      if(ai.cooldown<=0&&distance<720){ai.cooldown=U.rand(5.3,6.4);ai.windup=.72;game.addEffect(new SystemWarning(player.x,player.y,{radius:250,color:this.color,life:.72}));}
    }else if(this.type==="splitmini"){
      moveAngle+=Math.sin(this.animT*7+this.seed)*.8;speedMultiplier=1.18;
    }else if(this.type==="elite"){
      moveAngle+=Math.sin(this.animT*.9+this.seed)*.25;
      if(ai.cooldown<=0&&distance<900){ai.cooldown=U.rand(3.4,4.4);ai.windup=.78;game.addEffect(new SystemWarning(this.x,this.y,{radius:230,color:"#b45cff",life:.78}));}
    }
    if(ai.windup<=0)moveEnemy(this,dt,player,obstacles,game,moveAngle,speedMultiplier);
    contactEnemy(this,player,game,dt);
  };

  class SystemMine{
    constructor(game,x,y,damage,color="#ff5268"){this.game=game;this.x=x;this.y=y;this.damage=damage;this.color=color;this.life=2.15;this.maxLife=2.15;this.dead=false;this.critical=true;}
    update(dt){this.life-=dt;if(this.life<=0&&!this.dead){this.dead=true;for(let i=0;i<8;i++)spawnEnemyShot(this.game,this.x,this.y,i/8*Math.PI*2,245,this.damage,7,this.color);}}
    draw(ctx,cam){const progress=1-this.life/this.maxLife,pulse=.7+.3*Math.sin(progress*20);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.rotate(progress*7);ctx.strokeStyle=progress>.35?rgba(this.color,pulse):rgba("#ffd447",pulse);ctx.fillStyle=rgba(this.color,.18);ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,progress>.35?22:14,0,Math.PI*2);ctx.fill();ctx.stroke();for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.fillRect(18,-2,13,4);}ctx.restore();}
  }

  const previousEnemyProjectileUpdate=EnemyProjectile.prototype.update;
  EnemyProjectile.prototype.update=function(dt){
    const game=window.__game;if(game?._systemTimeStop>0)return;
    const bluePhase=game&&stageIndex(game)===1&&game._stageCycle===1;
    previousEnemyProjectileUpdate.call(this,dt*(bluePhase?1.08:1));
  };

  const guardedDamageEnemy=Game.prototype.damageEnemy;
  Game.prototype.damageEnemy=function(enemy,damage,crit){
    const adjusted=enemy?damage*(enemy._systemGuard > 0 ? .32 : 1):damage;
    return guardedDamageEnemy.call(this,enemy,adjusted,crit);
  };

  /* ============================== 固有ボス ============================== */
  function initBossSystem(boss,game){
    if(boss._abyssBoss)return boss._abyssBoss;
    const layer=selectedLayer(game),challenge=game.records.challengeSelected;
    const hpMultiplier=(1+layer*.12)*(challenge==="boss_covenant"?1.35:1)*(game._runEnemyHpBonus||1);
    const attackMultiplier=(1+layer*.08)*(challenge==="boss_covenant"?1.35:1);
    boss.maxHp=Math.round(boss.maxHp*1.5*hpMultiplier);boss.hp=boss.maxHp;boss.atk=Math.round(boss.atk*1.2*attackMultiplier);
    boss._abyssBoss={timer:1.6,pattern:0,windup:0,pending:null,chargeTime:0,chargeDir:{x:1,y:0},phase:1,hidden:0};
    return boss._abyssBoss;
  }

  function moveBossToward(boss,player,obstacles,dt,speedMultiplier=1,angleOffset=0){
    const angle=U.angle(boss.x,boss.y,player.x,player.y)+angleOffset,nx=boss.x+Math.cos(angle)*boss.speed*speedMultiplier*dt,ny=boss.y+Math.sin(angle)*boss.speed*speedMultiplier*dt;
    if(!circleHitObstacle(nx,boss.y,boss.radius,obstacles))boss.x=nx;if(!circleHitObstacle(boss.x,ny,boss.radius,obstacles))boss.y=ny;
    boss.x=clamp(boss.x,boss.radius,CONFIG.MAP_W-boss.radius);boss.y=clamp(boss.y,boss.radius,CONFIG.MAP_H-boss.radius);boss.facing=angle;
  }

  function bossContact(boss,player,game,dt,multiplier=1){
    if(boss.contactCd>0)boss.contactCd-=dt;
    if(U.dist(boss.x,boss.y,player.x,player.y)<boss.radius+player.radius&&boss.contactCd<=0){player.takeDamage(boss.atk*multiplier,game);boss.contactCd=.6;}
  }

  function scheduleBossAction(game,boss,windup,warning,action){
    const state=boss._abyssBoss;state.windup=windup;state.pending=action;if(warning)game.addEffect(warning);
  }

  function wormPattern(boss,game,phase){
    const state=boss._abyssBoss,pattern=state.pattern++%3,player=game.player;
    if(pattern===0){
      const lead=.35,tx=player.x+(player.lastMove?.x||0)*lead,ty=player.y+(player.lastMove?.y||0)*lead,angle=U.angle(boss.x,boss.y,tx,ty);
      scheduleBossAction(game,boss,.75,new SystemWarning(boss.x,boss.y,{kind:"line",angle,length:760,width:58,color:"#ff5268",life:.75}),()=>{state.chargeDir={x:Math.cos(angle),y:Math.sin(angle)};state.chargeTime=.72+(phase-1)*.12;});
    }else if(pattern===1){
      scheduleBossAction(game,boss,.7,new SystemWarning(boss.x,boss.y,{radius:220,color:"#ffd447",life:.7}),()=>{radialShots(game,boss,14+phase*4,250+phase*18,boss.atk*.58,boss.animT*.55,"#ff5268");game.addEffect(new SystemPulse(boss.x,boss.y,230,"#ff5268",.55));});
    }else{
      scheduleBossAction(game,boss,.9,new SystemWarning(player.x,player.y,{radius:280,color:"#b45cff",life:.9}),()=>{const angle=Math.random()*Math.PI*2;boss.x=clamp(player.x+Math.cos(angle)*430,70,CONFIG.MAP_W-70);boss.y=clamp(player.y+Math.sin(angle)*430,70,CONFIG.MAP_H-70);for(let i=0;i<3+phase;i++){const a=i/(3+phase)*Math.PI*2;game.addEffect(new SystemMine(game,player.x+Math.cos(a)*220,player.y+Math.sin(a)*220,boss.atk*.68,"#b45cff"));}});
    }
  }

  function throneGuardsAlive(game){return game.enemies.some(enemy=>!enemy.dead&&enemy._throneGuard);}
  function thronePattern(boss,game,phase){
    const state=boss._abyssBoss,pattern=state.pattern++%3,player=game.player;
    if(pattern===0&&!throneGuardsAlive(game)){
      scheduleBossAction(game,boss,.85,new SystemWarning(boss.x,boss.y,{radius:250,color:"#ffd447",life:.85}),()=>{for(let i=0;i<2+phase;i++){if(game.enemies.length>=CONFIG.MAX_ENEMIES)break;const angle=i/(2+phase)*Math.PI*2,guard=new Enemy(phase>=3?"elite":"heavy",boss.x+Math.cos(angle)*135,boss.y+Math.sin(angle)*135,game.currentScale);guard._throneGuard=true;guard.color="#ffd447";game.enemies.push(guard);}game.addEffect(new SystemPulse(boss.x,boss.y,240,"#ffd447",.7));});
    }else if(pattern===1){
      const angle=U.angle(boss.x,boss.y,player.x,player.y);scheduleBossAction(game,boss,.65,new SystemWarning(boss.x,boss.y,{kind:"line",angle,length:760,width:80,color:"#ffd447",life:.65}),()=>{for(let wave=0;wave<3;wave++)queueCast(game,{delay:wave*.22,type:"boss_action",action:()=>fanShots(game,boss,player,7+phase,1.15,285+wave*15,boss.atk*.62,"#ffd447")});});
    }else{
      scheduleBossAction(game,boss,.85,new SystemWarning(boss.x,boss.y,{kind:"cross",angle:boss.animT*.3,length:720,width:48,color:"#ff5268",life:.85}),()=>{const angle=boss.animT*.3;for(const offset of[0,Math.PI/2]){const a=angle+offset,ax=boss.x-Math.cos(a)*720,ay=boss.y-Math.sin(a)*720,bx=boss.x+Math.cos(a)*720,by=boss.y+Math.sin(a)*720;game.addEffect(new SystemBeam(ax,ay,bx,by,48,"#ff5268",.45));if(pointToSegmentDistance(player.x,player.y,ax,ay,bx,by)<player.radius+48)player.takeDamage(boss.atk*1.18,game);}});
    }
  }

  function stormPattern(boss,game,phase){
    const state=boss._abyssBoss,pattern=state.pattern++%3,player=game.player;
    if(pattern===0){
      const x=player.x,y=player.y,angle=Math.random()*Math.PI; scheduleBossAction(game,boss,.8,new SystemWarning(x,y,{kind:"cross",angle,length:760,width:44,color:"#65d9ff",life:.8}),()=>{for(const offset of[0,Math.PI/2]){const a=angle+offset,ax=x-Math.cos(a)*760,ay=y-Math.sin(a)*760,bx=x+Math.cos(a)*760,by=y+Math.sin(a)*760;game.addEffect(new SystemBeam(ax,ay,bx,by,44,"#65d9ff",.42));if(pointToSegmentDistance(player.x,player.y,ax,ay,bx,by)<player.radius+44)player.takeDamage(boss.atk*1.12,game);}});
    }else if(pattern===1){
      scheduleBossAction(game,boss,.65,new SystemWarning(boss.x,boss.y,{radius:250,color:"#b45cff",life:.65}),()=>{for(let wave=0;wave<3+phase;wave++)queueCast(game,{delay:wave*.16,type:"boss_action",action:()=>radialShots(game,boss,12+phase*2,250+wave*10,boss.atk*.52,boss.animT+wave*.17,"#65d9ff")});});
    }else{
      scheduleBossAction(game,boss,.7,new SystemWarning(player.x,player.y,{radius:260,color:"#ffd447",life:.7}),()=>{for(let i=0;i<3+phase;i++){const angle=i/(3+phase)*Math.PI*2,radius=150+i*35;game.addEffect(new SystemMine(game,player.x+Math.cos(angle)*radius,player.y+Math.sin(angle)*radius,boss.atk*.66,"#65d9ff"));}});
    }
  }

  function heraldPattern(boss,game,phase){
    const state=boss._abyssBoss,pattern=state.pattern++%4,player=game.player;
    if(pattern===0){
      const angle=U.angle(boss.x,boss.y,player.x,player.y);scheduleBossAction(game,boss,.9,new SystemWarning(boss.x,boss.y,{kind:"cross",angle,length:950,width:58,color:"#ff5268",life:.9}),()=>{for(const offset of[0,Math.PI/2]){const a=angle+offset,ex=boss.x+Math.cos(a)*1450,ey=boss.y+Math.sin(a)*1450;game.addEffect(new SystemBeam(boss.x,boss.y,ex,ey,58,"#ff5268",.5));if(pointToSegmentDistance(player.x,player.y,boss.x,boss.y,ex,ey)<player.radius+58)player.takeDamage(boss.atk*1.25,game);}});
    }else if(pattern===1){
      scheduleBossAction(game,boss,.72,new SystemWarning(player.x,player.y,{radius:300,color:"#ffd447",life:.72}),()=>{for(let i=0;i<5+phase;i++){const angle=i/(5+phase)*Math.PI*2,radius=i%2?190:285;game.addEffect(new SystemMine(game,player.x+Math.cos(angle)*radius,player.y+Math.sin(angle)*radius,boss.atk*.7,i%2?"#ffd447":"#b45cff"));}});
    }else if(pattern===2){
      scheduleBossAction(game,boss,.82,new SystemWarning(boss.x,boss.y,{radius:285,color:"#b45cff",life:.82}),()=>{for(let i=0;i<Math.min(3,phase)&&game.enemies.length<CONFIG.MAX_ENEMIES;i++){const angle=i/Math.min(3,phase)*Math.PI*2,enemy=new Enemy("elite",boss.x+Math.cos(angle)*140,boss.y+Math.sin(angle)*140,game.currentScale);enemy.color="#b45cff";game.enemies.push(enemy);}radialShots(game,boss,14+phase*2,235,boss.atk*.58,boss.animT,"#b45cff");});
    }else{
      const radius=Math.max(190,330-phase*35),x=clamp(player.x+U.rand(-180,180),radius,CONFIG.MAP_W-radius),y=clamp(player.y+U.rand(-180,180),radius,CONFIG.MAP_H-radius);scheduleBossAction(game,boss,.35,null,()=>game.addEffect(new AbyssPulse(game,x,y,radius)));
    }
  }

  Boss.prototype.update=function(dt,player,enemies,obstacles,game){
    this.animT+=dt;this.spawnAge+=dt;if(this.hitFlash>0)this.hitFlash-=dt;
    const state=initBossSystem(this,game);if(game._systemTimeStop>0)return;
    const hpRatio=this.hp/Math.max(1,this.maxHp),phase=hpRatio>.67?1:hpRatio>.34?2:3;
    if(phase!==state.phase){
      state.phase=phase;game._bossClarityTimer=.75;
      game.showSystemToast("PHASE",this.name,phase===2?"攻撃パターンが加速した。":"最終局面。固有攻撃が最大強度へ移行。",`HP ${Math.round(hpRatio*100)}% / PHASE ${phase}`,phase===2?"#ffd447":"#ff5268");
    }

    if(state.chargeTime>0){
      state.chargeTime-=dt;const nx=this.x+state.chargeDir.x*this.speed*(6.2+phase*.6)*dt,ny=this.y+state.chargeDir.y*this.speed*(6.2+phase*.6)*dt;if(!circleHitObstacle(nx,ny,this.radius,obstacles)){this.x=nx;this.y=ny;}else state.chargeTime=0;if(Math.random()<.22)game.addEffect(new SystemMine(game,this.x,this.y,this.atk*.48,"#ff5268"));bossContact(this,player,game,dt,1.35);return;
    }

    if(state.windup>0){state.windup-=dt;if(state.windup<=0&&state.pending){const action=state.pending;state.pending=null;action();}}
    else{
      state.timer-=dt;
      if(state.timer<=0){state.timer=Math.max(1.25,3.3-phase*.35-selectedLayer(game)*.035);const variant=this.index%4;if(variant===0)wormPattern(this,game,phase);else if(variant===1)thronePattern(this,game,phase);else if(variant===2)stormPattern(this,game,phase);else heraldPattern(this,game,phase);}
      const variant=this.index%4;if(variant===1)moveBossToward(this,player,obstacles,dt,.48,Math.sin(this.animT*.45)*.5);else if(variant===2)moveBossToward(this,player,obstacles,dt,.78,Math.PI/2*(Math.sin(this.animT*.3)>0?1:-1));else moveBossToward(this,player,obstacles,dt,.72+phase*.08,Math.sin(this.animT*.7)*.2);
    }
    bossContact(this,player,game,dt);
  };

  const bossDamageWithGuard=Game.prototype.damageBoss;
  Game.prototype.damageBoss=function(damage,crit){
    const boss=this.boss;
    const guarded=boss&&boss.index%4===1&&throneGuardsAlive(this);
    return bossDamageWithGuard.call(this,guarded?damage*.28:damage,crit);
  };

  const previousBossDeath=Boss.prototype.onDeath;
  Boss.prototype.onDeath=function(game){
    if(this._systemBossDeathHandled)return;
    this._systemBossDeathHandled=true;const index=this.index;
    const result=previousBossDeath.call(this,game);
    if(game?._runStats){game._runStats.bossKills++;}
    const legacy=typeof game.getSkillRank==="function"?game.getSkillRank("boss_legacy"):0;
    game.player.evolutionCores+=1+(legacy>0&&(game._runStats?.bossKills||0)%2===0?legacy:0);
    game._pendingBossReward={index};
    return result;
  };

  /* ============================== ステージ固有ルール ============================== */
  function stageIndex(game){ return typeof stageIndexForTime==="function"?stageIndexForTime(game.elapsed||0):Math.min(4,Math.floor((game.elapsed||0)/120)); }

  function setStageHud(game,index,extra=""){
    const rule=STAGE_RULES[index]||STAGE_RULES[0];
    const icon=document.getElementById("stageRuleIcon"),name=document.getElementById("stageRuleName"),text=document.getElementById("stageRuleText");
    if(icon)icon.textContent=rule.icon;if(name)name.textContent=rule.name;if(text)text.textContent=extra||rule.desc;
  }

  function spawnStageNest(game){
    if(game.enemies.filter(enemy=>!enemy.dead&&enemy._stageNest).length>=2)return;
    const angle=Math.random()*Math.PI*2,distance=U.rand(430,680),x=clamp(game.player.x+Math.cos(angle)*distance,70,CONFIG.MAP_W-70),y=clamp(game.player.y+Math.sin(angle)*distance,70,CONFIG.MAP_H-70);
    const nest=new Enemy("heavy",x,y,{hp:game.currentScale.hp*2.4*(game._runEnemyHpBonus||1),atk:game.currentScale.atk,speed:.2});
    nest._stageNest=true;nest.speed=0;nest.radius=38;nest.color="#c7ff70";nest.maxHp=Math.round(nest.maxHp*2.5);nest.hp=nest.maxHp;nest._nestTimer=1.8;
    nest.update=function(dt,player,enemies,obstacles,currentGame){
      this.animT+=dt;if(this.hitFlash>0)this.hitFlash-=dt;if(currentGame._systemTimeStop>0)return;this._nestTimer-=dt;
      if(this._nestTimer<=0){this._nestTimer=Math.max(1.3,2.8-selectedLayer(currentGame)*.06);if(enemies.length<CONFIG.MAX_ENEMIES){const a=Math.random()*Math.PI*2,type=Math.random()<.45?"fast":Math.random()<.7?"splitmini":"normal";enemies.push(new Enemy(type,this.x+Math.cos(a)*55,this.y+Math.sin(a)*55,currentGame.currentScale));}currentGame.addEffect(new SystemPulse(this.x,this.y,75,"#c7ff70",.35));}
      if(U.dist(this.x,this.y,player.x,player.y)<this.radius+player.radius&&this.contactCd<=0){player.takeDamage(this.atk,currentGame);this.contactCd=.7;}if(this.contactCd>0)this.contactCd-=dt;
    };
    const nestDeath=Enemy.prototype.onDeath;
    nest.onDeath=function(currentGame){
      if(this._stageNestRewarded)return;this._stageNestRewarded=true;nestDeath.call(this,currentGame);
      const treasure=new Treasure(this.x,this.y);treasure.game=currentGame;treasure.bounceVel=360;currentGame.treasures.push(treasure);
      for(let i=0;i<7;i++)currentGame.spawnExpGem(this.x+U.rand(-35,35),this.y+U.rand(-35,35),12);
      if(currentGame._runStats)currentGame._runStats.stageNests++;
    };
    game.enemies.push(nest);game.addEffect(new SystemWarning(x,y,{radius:150,color:"#c7ff70",life:.8}));
  }

  function updateStageRules(game,dt){
    const index=stageIndex(game),player=game.player;
    if(game._systemStageIndex!==index){
      game._systemStageIndex=index;game._stageRuleTimer=0;game._stageCycle=0;game._stageDamageMul=1;game._stageCooldownMul=1;game._stageXpMul=1;game._stageSpawnMul=1;
      setStageHud(game,index);
    }

    game._stageDamageMul=1;game._stageCooldownMul=1;game._stageXpMul=1;game._stageSpawnMul=1;
    if(index===0){
      const centerX=CONFIG.MAP_W/2,centerY=CONFIG.MAP_H/2,inside=U.dist2(player.x,player.y,centerX,centerY)<520*520;
      if(inside){game._stageXpMul=1.18;game._stageCooldownMul=.9;game._stageSpawnMul=1.2;setStageHud(game,index,"門域内：経験値 +18% / 権能CD -10% / 敵出現 +20%");}
      else setStageHud(game,index,"中央の発光門域へ入ると成長と発動速度が上昇する。");
    }else if(index===1){
      const phase=Math.floor((game.elapsed-90)/18)%3;game._stageCycle=phase;
      if(phase===0){game._stageDamageMul=1.2;game._stageSpawnMul=1.08;setStageHud(game,index,"赤相：権能ダメージ +20% / 敵出現 +8%");}
      else if(phase===1){game._stageCooldownMul=.85;setStageHud(game,index,"青相：権能CD -15% / 敵弾速度 +8%");}
      else{game._stageXpMul=1.12;player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.0025*dt);setStageHud(game,index,"緑相：経験値 +12% / HPを毎秒0.25%修復");}
    }else if(index===2){
      game._stageRuleTimer-=dt;if(game._stageRuleTimer<=0){game._stageRuleTimer=Math.max(18,29-selectedLayer(game)*.45);spawnStageNest(game);}
      const count=game.enemies.filter(enemy=>!enemy.dead&&enemy._stageNest).length;setStageHud(game,index,`活動中の増殖巣 ${count} / 破壊で宝箱を確定獲得`);
    }else if(index===3){
      game._stageRuleTimer-=dt;if(game._stageRuleTimer<=0){game._stageRuleTimer=Math.max(6.5,9.5-selectedLayer(game)*.12);for(let i=0;i<2+(selectedLayer(game)>=6?1:0);i++){const x=clamp(player.x+U.rand(-260,260),80,CONFIG.MAP_W-80),y=clamp(player.y+U.rand(-220,220),80,CONFIG.MAP_H-80),angle=Math.random()*Math.PI;game.addEffect(new RiftHazard(game,x,y,angle));}}
      setStageHud(game,index,"亀裂は1.05秒予告後に活性化。帯の外へ退避する。");
    }else{
      game._stageRuleTimer-=dt;if(game._stageRuleTimer<=0){game._stageRuleTimer=Math.max(9.5,14-selectedLayer(game)*.18);const radius=Math.max(190,330-selectedLayer(game)*5),x=clamp(player.x+U.rand(-260,260),radius,CONFIG.MAP_W-radius),y=clamp(player.y+U.rand(-220,220),radius,CONFIG.MAP_H-radius);game.addEffect(new AbyssPulse(game,x,y,radius));}
      setStageHud(game,index,"緑の安全域へ移動。脈動時に外側へいると最大HP16%損傷。");
    }
  }

  const previousGainExp=Player.prototype.gainExp;
  Player.prototype.gainExp=function(value){const game=window.__game,multiplier=game?game._stageXpMul||1:1;return previousGainExp.call(this,value*multiplier);};

  const previousGetTimeScale=getTimeScale;
  getTimeScale=function(time){
    const scale=previousGetTimeScale(time),game=window.__game,layer=selectedLayer(game),challenge=game?.records?.challengeSelected||"none";
    const hp=(1+layer*.12)*(game?game._runEnemyHpBonus||1:1),attack=1+layer*.08,spawn=(1+layer*.04)*(challenge==="swarm_tide"?1.3:1)*(game?game._stageSpawnMul||1:1);
    return {hp:scale.hp*hp,atk:scale.atk*attack,speed:scale.speed*(1+layer*.012),spawnCount:Math.max(1,Math.round(scale.spawnCount*spawn)),spawnInterval:Math.max(.16,scale.spawnInterval/(1+layer*.025))};
  };

  function drawStageRuleLayer(game,ctx,cam){
    if(!game.player)return;const index=stageIndex(game);
    if(index===0){const x=CONFIG.MAP_W/2-cam.x,y=CONFIG.MAP_H/2-cam.y;ctx.save();ctx.fillStyle="rgba(93,255,210,.055)";ctx.strokeStyle="rgba(255,230,107,.5)";ctx.lineWidth=4;ctx.setLineDash([18,14]);ctx.lineDashOffset=-game.elapsed*25;ctx.beginPath();ctx.arc(x,y,520,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.restore();}
    if(index===1){const colors=["rgba(255,82,104,.08)","rgba(101,217,255,.08)","rgba(66,232,189,.07)"];ctx.save();ctx.fillStyle=colors[game._stageCycle||0];ctx.fillRect(0,0,game.viewW,game.viewH);ctx.restore();}
  }

  /* ============================== ボス・宝箱報酬 ============================== */
  function rewardCardData(id,type){
    if(type==="boss"){const def=RELICS[id];return{id,name:def.name,icon:def.icon,color:def.color,desc:def.desc};}
    const def=MUTATIONS[id];return{id,name:def.name,icon:def.icon,color:def.color,desc:def.desc};
  }

  function openRewardScreen(game,type,ids){
    if(!game||!ids.length)return false;
    game.input.keys.clear();game._rewardReturnState="playing";game.state="reward";
    const screen=document.getElementById("abyssRewardScreen"),choices=document.getElementById("rewardChoices"),title=document.getElementById("rewardTitle"),kicker=document.getElementById("rewardKicker"),description=document.getElementById("rewardDescription");
    if(!screen||!choices)return false;
    title.textContent=type==="boss"?"王の遺産を選択":"宝箱変異を選択";
    kicker.textContent=type==="boss"?"BOSS LEGACY / BUILD PIVOT":"TREASURE MUTATION / BUILD PIVOT";
    description.textContent=type==="boss"?"ボス撃破で進化核を1個獲得。さらにランを変える遺産を1つ選ぶ。":"通常の回復と経験値に加え、ビルドを変化させる変異を1つ選ぶ。";
    choices.innerHTML="";
    for(const id of ids){
      const data=rewardCardData(id,type),card=document.createElement("button");card.type="button";card.className="abyss-reward-card";card.style.setProperty("--reward-color",data.color);card.innerHTML=`<span class="reward-icon">${data.icon}</span><span class="reward-name">${data.name}</span><span class="reward-desc">${data.desc}</span>`;
      card.addEventListener("click",()=>{
        if(game._rewardLocked)return;game._rewardLocked=true;
        if(type==="boss"){RELICS[id].apply(game);game._runStats?.relics.push(id);}
        else{MUTATIONS[id].apply(game);game._runStats?.mutations.push(id);}
        screen.classList.add("hidden");game.state="playing";game.lastTime=performance.now();game._rewardLocked=false;rebuildSystemMultipliers(game);game.updateWeaponBarDOM();updateBuildHud(game);
      });choices.appendChild(card);
    }
    screen.classList.remove("hidden");return true;
  }

  function chooseRelics(game,bossIndex){
    const count=3+(game.records.challengeSelected==="boss_covenant"?1:0)+(game.getSkillRank?.("boss_legacy")||0);
    const signature=Object.keys(RELICS).find(id=>RELICS[id].signature===bossIndex);
    const general=shuffle(Object.keys(RELICS).filter(id=>RELICS[id].signature==null&&id!==signature));
    return [signature,...general].filter(Boolean).slice(0,Math.min(5,count));
  }

  function chooseMutations(game){
    const eligible=Object.keys(MUTATIONS).filter(id=>MUTATIONS[id].eligible(game));
    return shuffle(eligible).slice(0,Math.min(3,eligible.length));
  }

  function processPendingModal(game){
    if(game.state!=="playing")return;
    if(game._pendingBossReward){const reward=game._pendingBossReward;game._pendingBossReward=null;openRewardScreen(game,"boss",chooseRelics(game,reward.index));return;}
    if(game._pendingTreasureMutation){game._pendingTreasureMutation=false;openRewardScreen(game,"treasure",chooseMutations(game));}
  }

  const previousTreasureUpdate=Treasure.prototype.update;
  Treasure.prototype.update=function(dt,player){
    const game=this.game||window.__game;if(!game)return previousTreasureUpdate.call(this,dt,player);
    const range=player.treasureMagnetRange||0,distance=U.dist(this.x,this.y,player.x,player.y);
    if(!this.collected&&(this.attracted||(range>0&&distance<range))){this.attracted=true;const angle=U.angle(this.x,this.y,player.x,player.y),speed=clamp(1050-distance,420,1050);this.x+=Math.cos(angle)*speed*dt;this.y+=Math.sin(angle)*speed*dt;}
    const beforeCollected=this.collected,beforeHp=player.hp;previousTreasureUpdate.call(this,dt,player);
    if(!beforeCollected&&this.collected){
      if(game.records.challengeSelected==="hollow_recovery")player.hp=Math.min(player.hp,beforeHp);
      if(game._runStats)game._runStats.treasures++;
      const rank=rankOf(player,"treasure_singularity");
      if(rank){const stats=getPowerStats(player,"treasure_singularity",rank);areaDamage(game,this.x,this.y,stats.radius,powerDamage(game,"treasure_singularity",stats.damage),"treasure_singularity",9);player.gainExp(player.expToNext*stats.exp);game.addEffect(new SystemPulse(this.x,this.y,stats.radius,"#ffd447",.9));}
      if(hasSynergy(player,"golden_feast")){player._banquetGems=(player._banquetGems||0)+10;}
      const chance=clamp((player.treasureMutationChance||.24)+(rank?getPowerStats(player,"treasure_singularity",rank).mutation:0),0,.85);
      if(!game._pendingTreasureMutation&&game.elapsed-(game._lastMutationTime||-999)>18&&Math.random()<chance){game._pendingTreasureMutation=true;game._lastMutationTime=game.elapsed;}
    }
  };

  const previousGemUpdate=ExpGem.prototype.update;
  ExpGem.prototype.update=function(dt,player){
    const wasDead=this.dead;previousGemUpdate.call(this,dt,player);
    if(!wasDead&&this.dead){const game=window.__game;if(game?._runStats)game._runStats.gems++;const rank=rankOf(player,"abyss_banquet");if(game&&rank){player._banquetGems=(player._banquetGems||0)+1;const need=getPowerStats(player,"abyss_banquet",rank).gems;if(player._banquetGems>=need){player._banquetGems%=need;castBanquet(game,rank);}}}
  };

  /* ============================== 撃破発動 / ビルド構築 ============================== */
  const systemEnemyDeath=Enemy.prototype.onDeath;
  Enemy.prototype.onDeath=function(game){
    const fresh=!this.dead&&!this._systemDeathHandled;
    const x=this.x,y=this.y;
    const result=systemEnemyDeath.call(this,game);
    if(!fresh||!game?.player)return result;
    const player=game.player;

    let rank=rankOf(player,"doom_bloom");
    if(rank&&!game._doomBloomActive){
      player._doomBloomKills=(player._doomBloomKills||0)+1;
      const stats=getPowerStats(player,"doom_bloom",rank),need=Math.max(1,Math.round(stats.kills*(player.killChargeMul||1)));
      if(player._doomBloomKills>=need){
        player._doomBloomKills=0;game._doomBloomActive=true;
        try{
          const targets=nearestTargets(game,stats.targets,1100,{x,y}),damage=powerDamage(game,"doom_bloom",stats.damage);
          withDamageSource(game,"doom_bloom",()=>targets.forEach((enemy,index)=>{game.addEffect(new SystemBeam(x,y,enemy.x,enemy.y,16,"#ff5268",.25));game.damageEnemy(enemy,damage,false);if(isEvolved(player,"doom_bloom")&&enemy.dead&&index<5){const next=nearestTargets(game,1,300,enemy)[0];if(next){game.addEffect(new SystemBeam(enemy.x,enemy.y,next.x,next.y,10,"#ffd447",.2));game.damageEnemy(next,Math.round(damage*.55),false);}}}));
        }finally{game._doomBloomActive=false;}
        game.addEffect(new SystemPulse(x,y,190,"#ff5268",.55));
      }
    }

    rank=rankOf(player,"hunter_verdict");
    if(rank&&!game._verdictActive){
      player._verdictKills=(player._verdictKills||0)+1;
      const stats=getPowerStats(player,"hunter_verdict",rank),need=Math.max(1,Math.round(stats.kills*(player.killChargeMul||1)));
      if(player._verdictKills>=need){
        player._verdictKills=0;game._verdictActive=true;
        try{
          let target=null;for(const enemy of game.enemies)if(!enemy.dead&&(!target||enemy.hp>target.hp))target=enemy;
          if(target){const execute=target.hp/target.maxHp<=stats.execute,damage=execute?target.hp+1:powerDamage(game,"hunter_verdict",4.5);game.addEffect(new SystemBeam(player.x,player.y,target.x,target.y,38,"#ffd447",.3));withDamageSource(game,"hunter_verdict",()=>game.damageEnemy(target,damage,false));}
          if(game.boss&&!game.boss.dead){const damage=Math.min(game.boss.maxHp*stats.boss,powerDamage(game,"hunter_verdict",10));withDamageSource(game,"hunter_verdict",()=>game.damageBoss(damage,false));}
          if(hasSynergy(player,"execution_garden"))player._doomBloomKills=(player._doomBloomKills||0)+Math.ceil((getPowerStats(player,"doom_bloom",Math.max(1,rankOf(player,"doom_bloom"))).kills||10)*.45);
        }finally{game._verdictActive=false;}
      }
    }

    if(player._goldenRain){
      player._goldenRainKills=(player._goldenRainKills||0)+1;
      if(player._goldenRainKills>=55){player._goldenRainKills=0;const treasure=new Treasure(x,y);treasure.game=game;treasure.bounceVel=340;game.treasures.push(treasure);game.addEffect(new SystemPulse(x,y,120,"#ffd447",.7));}
    }
    return result;
  };

  const feastShieldDamage=Player.prototype.takeDamage;
  Player.prototype.takeDamage=function(amount,game){
    if(this._feastShield>0&&!this.invincible){const absorbed=Math.min(this._feastShield,amount);this._feastShield-=absorbed;amount-=absorbed;if(game)game.addEffect(new SystemPulse(this.x,this.y,70,"#42e8bd",.28));if(amount<=0)return;}
    return feastShieldDamage.call(this,amount,game);
  };

  function powerSlotsUsed(player){return ownedPowerIds(player).length;}
  function canUnlockPower(player){return powerSlotsUsed(player)<(player.powerSlotLimit||BASE_POWER_SLOTS);}

  function powerChoice(player,id){
    const def=POWER_CATALOG[id],current=rankOf(player,id),next=current+1,category=CATEGORY_INFO[def.category];
    return {
      id,kind:"power",name:def.name,icon:def.icon,category:def.category,color:category.color,
      desc:def.desc,trigger:current?`Lv.${current} → Lv.${next}`:`新規権能 / 枠を1つ使用`,weight:current?1.25:1,
      apply(game){acquirePower(game.player,id);rebuildSystemMultipliers(game);}
    };
  }

  function evolutionChoice(player,id){
    const evolution=EVOLUTIONS[id],def=POWER_CATALOG[id];
    return{id:`evo:${id}`,sourceId:id,kind:"evolution",name:evolution.name,icon:evolution.icon,category:def.category,color:"#ffd447",desc:evolution.summary,trigger:"進化核を1個消費 / 権能枠は増えない",weight:2.3,apply(game){evolvePower(game,id);}};
  }

  function synergyChoice(id){
    const synergy=SYNERGIES[id];
    return{id:`syn:${id}`,sourceId:id,kind:"synergy",name:synergy.name,icon:synergy.icon,category:"synergy",color:"#ffd447",desc:synergy.summary,trigger:"2権能の共鳴 / 権能枠は増えない",weight:2.1,apply(game){acquireSynergy(game,id);}};
  }

  function utilityChoices(player){
    return [
      {id:"util:repair",kind:"utility",name:"緊急修復",icon:"+",category:"defense",color:"#42e8bd",desc:"HPを最大HPの45%回復する。",trigger:"候補枯渇時の安全弁",weight:.5,apply(game){const before=game.player.hp;game.player.hp=Math.min(game.player.maxHp,game.player.hp+Math.round(game.player.maxHp*.45));if(game._runStats)game._runStats.healing+=game.player.hp-before;}},
      {id:"util:overclock",kind:"utility",name:"一時過給",icon:"↯",category:"chaos",color:"#ff8a4c",desc:"全権能ダメージ +8%、最大HP -5%。",trigger:"ラン中永続 / 代償あり",weight:.45,apply(game){game.player.systemDamageMul*=1.08;game.player.maxHp=Math.max(1,Math.round(game.player.maxHp*.95));game.player.hp=Math.min(game.player.hp,game.player.maxHp);}}
    ];
  }

  buildUpgradePool=function(player){
    const pool=[],banned=player.bannedPowers||new Set(),origin=!!player._originDraft;
    for(const id of POWER_IDS){
      const rank=rankOf(player,id),def=POWER_CATALOG[id];
      if(banned.has(id)||rank>=def.max)continue;
      if(origin){if(rank===0&&["annihilation","dominion","motion"].includes(def.category)&&id!=="time_execution")pool.push(powerChoice(player,id));continue;}
      if(rank===0&&!canUnlockPower(player))continue;
      pool.push(powerChoice(player,id));
    }
    if(!origin){
      if(player.evolutionCores>0)for(const id of POWER_IDS)if(rankOf(player,id)>=POWER_CATALOG[id].max&&!isEvolved(player,id))pool.push(evolutionChoice(player,id));
      for(const [id,synergy] of Object.entries(SYNERGIES))if(!hasSynergy(player,id)&&synergy.powers.every(power=>rankOf(player,power)>=2))pool.push(synergyChoice(id));
      if(pool.length<3)pool.push(...utilityChoices(player));
    }
    return pool;
  };

  pickUpgradeChoices=function(player,count){
    const pool=buildUpgradePool(player),picked=[];
    const weightedChoice=list=>{
      let total=list.reduce((sum,item)=>sum+(item.weight||1),0),roll=Math.random()*total;
      for(const item of list){roll-=item.weight||1;if(roll<=0)return item;}
      return list[list.length-1]||null;
    };
    const addPicked=item=>{if(item&&!picked.some(entry=>entry.id===item.id))picked.push(item);};

    if(!player._originDraft){
      const priority=pool.filter(item=>item.kind==="evolution"||item.kind==="synergy");
      addPicked(weightedChoice(priority));
      const ownedRanks=pool.filter(item=>item.kind==="power"&&rankOf(player,item.id)>0);
      addPicked(weightedChoice(ownedRanks));
    }
    while(picked.length<count){
      const candidates=pool.filter(item=>!picked.some(entry=>entry.id===item.id));if(!candidates.length)break;
      const represented=new Set(picked.map(item=>item.category));const diverse=candidates.filter(item=>!represented.has(item.category));const list=diverse.length?diverse:candidates;
      addPicked(weightedChoice(list));
    }
    return picked;
  };

  getUpgradePreview=function(id,player){
    if(id.startsWith("evo:")){const source=id.slice(4);return{now:`${POWER_CATALOG[source].name} Lv.3`,after:`進化：${EVOLUTIONS[source].name}`};}
    if(id.startsWith("syn:")){const source=id.slice(4),synergy=SYNERGIES[source];return{now:synergy.powers.map(power=>POWER_CATALOG[power].name).join(" ＋ "),after:`共鳴：${synergy.name}`};}
    if(id.startsWith("util:"))return{now:"ビルド補助",after:id==="util:repair"?"HPを45%回復":"権能ダメージ +8% / 最大HP -5%"};
    const def=POWER_CATALOG[id];if(!def)return{now:"-",after:"-"};
    const current=rankOf(player,id),next=Math.min(def.max,current+1);
    return{now:current?`Lv.${current}｜${powerLines(player,id,current).join(" / ")}`:"未取得",after:`Lv.${next}｜${powerLines(player,id,next).join(" / ")}`};
  };

  function acquiredSummary(item,player){
    if(item.kind==="power"){
      const rank=rankOf(player,item.id);
      return `Lv.${rank}｜${powerLines(player,item.id,rank).join(" / ")}`;
    }
    if(item.kind==="evolution")return `進化：${item.name}`;
    if(item.kind==="synergy")return `共鳴：${item.name}`;
    return getUpgradePreview(item.id,player).after;
  }

  function choiceTags(player,item){
    if(item.kind==="evolution")return["進化核 1","枠維持","Lv.3到達"];
    if(item.kind==="synergy"){
      const synergy=SYNERGIES[item.sourceId];
      return["共鳴",...(synergy?.powers||[]).map(id=>POWER_CATALOG[id]?.name).filter(Boolean)];
    }
    if(item.kind!=="power")return["ビルド補助"];
    const current=rankOf(player,item.id),tags=[current?"権能枠を維持":`新規 ${powerSlotsUsed(player)+1}/${player.powerSlotLimit||BASE_POWER_SLOTS}`];
    if(current>=2)tags.push("進化候補");
    const partners=[];
    for(const synergy of Object.values(SYNERGIES)){
      if(!synergy.powers.includes(item.id))continue;
      const other=synergy.powers.find(id=>id!==item.id);
      if(other&&rankOf(player,other)>0)partners.push(POWER_CATALOG[other].name);
    }
    if(partners.length)tags.push(`共鳴候補 ${partners.join("・")}`);
    return tags;
  }

  function renderLevelChoices(game,choices){
    const wrap=document.getElementById("upgradeChoices");if(!wrap)return;wrap.innerHTML="";
    choices.forEach((item,index)=>{
      const canBanish=item.kind==="power"&&game.player.banishes>0&&!game.player._originDraft;
      const preview=getUpgradePreview(item.id,game.player),card=document.createElement(canBanish?"div":"button");if(!canBanish)card.type="button";card.className=`upgrade-card abyss-power-card kind-${item.kind}`;card.style.setProperty("--card-color",item.color);card.dataset.index=String(index+1).padStart(2,"0");card.dataset.rankLabel=item.trigger;
      const tags=choiceTags(game.player,item).map(value=>`<span>${value}</span>`).join("");
      card.innerHTML=`<div class="power-category">${item.kind==="evolution"?"EVOLUTION":item.kind==="synergy"?"RESONANCE":CATEGORY_INFO[item.category]?.label||"SYSTEM"}</div><div class="upgrade-icon">${item.icon}</div><div class="upgrade-name">${item.name}</div><div class="power-build-tags">${tags}</div><div class="power-trigger">${item.trigger}</div><div class="upgrade-desc">${item.desc}</div><div class="upgrade-current"><span class="now">現在｜${preview.now}</span><span class="after">取得後｜${preview.after}</span></div>`;
      if(canBanish){card.tabIndex=0;card.setAttribute("role","button");const banish=document.createElement("button");banish.type="button";banish.className="banish-choice";banish.textContent=`除外 ${game.player.banishes}`;banish.addEventListener("click",event=>{event.stopPropagation();if(game.player.banishes<=0)return;game.player.banishes--;game.player.bannedPowers.add(item.id);game._runStats.banishes++;renderLevelChoices(game,pickUpgradeChoices(game.player,3+(game.player.levelUpChoiceBonus||0)));});card.appendChild(banish);}
      const select=()=>{if(game._levelUpSelectionLocked)return;game._levelUpSelectionLocked=true;item.apply(game);game.player._originDraft=false;game.updateWeaponBarDOM();updateBuildHud(game);game.showSystemToast(item.icon,item.name,item.desc,`現在：${acquiredSummary(item,game.player)}`,item.color);game.closeLevelUp();};
      game._levelUpSelectActions[index]=select;
      card.addEventListener("click",select);if(canBanish)card.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();select();}});wrap.appendChild(card);
    });

    const controls=document.createElement("div");controls.className="levelup-controls";
    const reroll=document.createElement("button");reroll.type="button";reroll.className="levelup-reroll";reroll.disabled=game.player.rerolls<=0;reroll.textContent=`↻ リロール ${game.player.rerolls} [R]`;game._levelUpRerollAction=()=>{if(game.player.rerolls<=0)return;game.player.rerolls--;game._runStats.rerolls++;const count=game.player._originDraft?4:3+(game.player.levelUpChoiceBonus||0);renderLevelChoices(game,pickUpgradeChoices(game.player,count));};reroll.addEventListener("click",game._levelUpRerollAction);controls.appendChild(reroll);wrap.appendChild(controls);
  }

  Game.prototype.openLevelUp=function(){
    this.input.keys.clear();this.state="levelup";this._levelUpSelectionLocked=false;this._levelUpSelectActions=[];this._levelUpRerollAction=null;
    const count=this.player._originDraft?4:3+(this.player.levelUpChoiceBonus||0),choices=pickUpgradeChoices(this.player,count);this._levelUpChoices=choices;
    const title=document.querySelector("#levelUpScreen .upgrade-title");if(title)title.textContent=this.player._originDraft?"起源権能を選択":"レベルアップ！強化を選択";
    renderLevelChoices(this,choices);document.getElementById("levelUpScreen").classList.remove("hidden");this.sound.levelUp();
  };

  /* ============================== 永続効果 / ライフサイクル ============================== */
  function rebuildSystemMultipliers(game){
    const player=game.player;if(!player)return;
    const overdrive=rankOf(player,"overdrive_contract"),applied=player._appliedOverdriveRank||0;
    if(overdrive>applied){for(let i=applied;i<overdrive;i++)player.systemCooldownMul*=.84;player._appliedOverdriveRank=overdrive;}
    if(isEvolved(player,"overdrive_contract")&&!player._overdriveEvolutionApplied){player.systemCooldownMul*=.82;player._overdriveEvolutionApplied=true;}
    updateBuildHud(game);
  }

  function applyPermanentBuild(game){
    const player=game.player,rank=id=>game.getSkillRank?.(id)||0;
    player.weapons=[];player.auraDamage=0;player.auraRadius=0;player.superModeThreshold=Number.POSITIVE_INFINITY;player.killStreak=0;player.superModeTimer=0;
    player.upgradeRanks={};player.powerEvolutions={};player.powerSynergies={};player.bannedPowers=new Set();player.categoryDamageMul={};player.powerDamageById={};
    player.systemDamageMul=(1+rank("rebirth_output")*.1)*(1+rank("havoc_overkill")*.09);
    player.systemCooldownMul=Math.pow(.94,rank("rebirth_clock"));
    player.systemAreaMul=1+rank("dominion_area")*.1;
    player.controlDurationMul=1+rank("dominion_control")*.16;
    player.killChargeMul=Math.pow(.91,rank("havoc_overkill"));
    player.synergyDamageBonus=rank("synergy_matrix")*.18;
    player.systemEchoChance=rank("dominion_mastery") ? .2 : 0;
    player.powerSlotLimit=BASE_POWER_SLOTS+rank("core_slots");
    player.rerolls=BASE_REROLLS+rank("core_reroll");player.banishes=1;
    player.evolutionCores=rank("forge_core");
    player.treasureMutationChance=.24;player.treasureMagnetRange=rank("harvest_magnet")?700:0;
    player.permanentShieldRecharge=rank("aegis_shell")?18:0;player.lowPowerBonus=rank("aegis_blood")*.16;player.lowSpeedBonus=rank("aegis_blood")*.1;
    player.reviveCharges=rank("aegis_mastery")?1:0;player._rebirthRevive=rank("aegis_mastery")>0;player._goldenRain=rank("harvest_mastery")>0;
    player.levelUpChoiceBonus=rank("rebirth_draft");
    player.expGainMul*=1+rank("harvest_growth")*.08;
    player.maxHp=Math.round(player.maxHp*(1+rank("rebirth_frame")*.12));player.hp=player.maxHp;
    player.shardGainMul=1;

    if(rank("redline_god")){player.systemDamageMul*=1.38;player.systemCooldownMul*=.82;player.maxHp=Math.max(1,Math.round(player.maxHp*.68));player.hp=player.maxHp;}
    if(rank("colossus_god")){player.systemAreaMul*=1.35;player.systemDamageMul*=1.18;player.speed*=.82;}
    if(rank("chaos_clock")){player.systemCooldownMul*=.7;player.systemDamageMul*=.88;}
    if(rank("precision_law")){player.systemDamageMul*=1.38;player.systemCooldownMul*=1.16;}
    if(rank("glass_god")){player.systemDamageMul*=1.52;player.maxHp=Math.max(1,Math.round(player.maxHp*.56));player.hp=player.maxHp;}
    if(rank("fortress_god")){player.maxHp=Math.round(player.maxHp*1.62);player.hp=player.maxHp;player.damageReduction=Math.min(.72,player.damageReduction+.12);player.speed*=.82;}
    if(rank("swift_harvest")){player.expGainMul*=1.28;player.shardGainMul*=.84;}
    if(rank("deep_harvest")){player.expGainMul*=.9;player.shardGainMul*=1.42;}

    const challenge=game.records.challengeSelected||"none";
    if(challenge==="glass_march"){player.maxHp=Math.max(1,Math.round(player.maxHp*.65));player.hp=player.maxHp;}
    if(challenge==="one_god"){player.powerSlotLimit=3;player.evolutionCores+=1;}

    const startCount=rank("havoc_mastery")?2:rank("havoc_seed")?1:0;
    const startPool=POWER_IDS.filter(id=>["annihilation","dominion","motion"].includes(POWER_CATALOG[id].category)&&id!=="time_execution");
    for(let i=0;i<startCount;i++){const candidates=startPool.filter(id=>!rankOf(player,id));const id=choice(candidates);if(id)acquirePower(player,id);}
    rebuildSystemMultipliers(game);
  }

  function updateBuildHud(game){
    if(!game?.player)return;
    const slots=document.getElementById("buildSlotText"),cores=document.getElementById("buildCoreText"),synergies=document.getElementById("buildSynergyText");
    if(slots)slots.textContent=`権能 ${powerSlotsUsed(game.player)}/${game.player.powerSlotLimit||BASE_POWER_SLOTS}`;
    if(cores)cores.textContent=`進化核 ${game.player.evolutionCores||0}`;
    if(synergies)synergies.textContent=`共鳴 ${Object.keys(game.player.powerSynergies||{}).length}`;
  }

  function powerDisplayData(player,id){
    const def=POWER_CATALOG[id],rank=rankOf(player,id),evolution=isEvolved(player,id)?EVOLUTIONS[id]:null,category=CATEGORY_INFO[def.category];
    return{name:evolution?evolution.name:def.name,icon:evolution?evolution.icon:def.icon,color:category.color,level:`Lv.${rank}${evolution?" / EVOLVED":""}`,desc:def.desc,stats:powerLines(player,id,rank)};
  }

  getCoreUpgradeData=function(player){
    return{name:"ビルド中枢",icon:"▤",color:"#ffd447",level:`${powerSlotsUsed(player)}/${player.powerSlotLimit||BASE_POWER_SLOTS} SLOTS`,desc:"権能枠・進化核・共鳴・選択資源。",stats:[`権能威力 ×${formatNumber(player.systemDamageMul||1)}`,`権能範囲 ×${formatNumber(player.systemAreaMul||1)}`,`権能CD ×${formatNumber(player.systemCooldownMul||1)}`,`進化核 ${player.evolutionCores||0}`,`共鳴 ${Object.keys(player.powerSynergies||{}).length}`,`リロール ${player.rerolls||0}`]};
  };

  Game.prototype.updateWeaponBarDOM=function(){
    const bar=document.getElementById("weaponBar");if(!bar||!this.player)return;const scroll=bar.scrollTop;bar.innerHTML="";
    const entries=[getCoreUpgradeData(this.player),...ownedPowerIds(this.player).map(id=>powerDisplayData(this.player,id))];
    for(const data of entries){const element=document.createElement("div");element.className="ability-panel abyss-ability";element.style.setProperty("--ability-color",data.color);const stats=data.stats.slice(0,5).map((value,index)=>`<span class="ability-stat ${index<2?"strong":""}">${value}</span>`).join("");element.innerHTML=`<div class="ability-icon">${data.icon}</div><div class="ability-main"><div class="ability-head"><div class="ability-name">${data.name}</div><div class="ability-level">${data.level}</div></div><div class="ability-desc">${data.desc}</div><div class="ability-stats">${stats}</div></div>`;bar.appendChild(element);}
    bar.scrollTop=scroll;updateBuildHud(this);
  };

  class AbyssMusic{
    constructor(game){this.game=game;this.timer=.1;this.step=0;this.lastStage=-1;this.active=true;}
    note(frequency,duration,volume,type="triangle"){
      const game=this.game,ctx=game.sound?.ctx;if(!ctx||ctx.state==="closed")return;
      const settings=game.records.settings||DEFAULT_SETTINGS,master=(game.records.volume??60)/100,music=(settings.musicVolume??35)/100;if(master<=0||music<=0)return;
      const now=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(Math.max(30,frequency),now);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,volume*master*music),now+.018);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain).connect(ctx.destination);osc.start(now);osc.stop(now+duration+.03);
    }
    update(dt){
      const game=this.game;if(!this.active||game.state!=="playing")return;this.timer-=dt;if(this.timer>0)return;
      const stage=stageIndex(game),boss=!!game.boss;if(stage!==this.lastStage){this.lastStage=stage;this.step=0;}const roots=[110,123.47,130.81,98,82.41],root=roots[stage],patterns=[[0,7,12,7],[0,3,10,7],[0,5,8,12],[0,1,6,10],[0,-2,5,11]],pattern=patterns[stage],semitone=pattern[this.step%pattern.length],frequency=root*Math.pow(2,semitone/12);
      this.note(frequency,boss ? .22 : .14,boss ? .05 : .032,boss?"sawtooth":"triangle");if(this.step%2===0)this.note(frequency/2,.34,boss ? .032 : .02,"sine");if(this.step%4===3)this.note(frequency*2,.12,.012,"square");
      this.step++;this.timer=boss ? .26 : .38;
    }
    stop(){this.active=false;}
  }

  const baseTone=SoundManager.prototype.tone;
  SoundManager.prototype.tone=function(freq,dur,type,vol,opt){const settings=window.__game?.records?.settings||DEFAULT_SETTINGS;return baseTone.call(this,freq,dur,type,(vol == null ? .3 : vol)*(settings.sfxVolume/100),opt);};
  const baseNoise=SoundManager.prototype.noise;
  SoundManager.prototype.noise=function(dur,vol){const settings=window.__game?.records?.settings||DEFAULT_SETTINGS;return baseNoise.call(this,dur,(vol == null ? .25 : vol)*(settings.sfxVolume/100));};

  const baseShake=Game.prototype.shake;
  Game.prototype.shake=function(magnitude,time){const settings=this.records?.settings||DEFAULT_SETTINGS,scale=(settings.shake/100)*(settings.reducedMotion ? .35 : 1);return baseShake.call(this,magnitude*scale,time*(settings.reducedMotion ? .65 : 1));};
  const baseHitFlash=Game.prototype.triggerHitFlash;
  Game.prototype.triggerHitFlash=function(){if(this.records?.settings?.flashes===false)return;return baseHitFlash.call(this);};

  const baseSpawnParticles=spawnParticles;
  spawnParticles=function(list,x,y,count,color,speed,life,size){const game=window.__game,density=effectDensity(game),scale=density === "low" ? .45 : density === "high" ? 1.15 : 1;return baseSpawnParticles(list,x,y,Math.max(0,Math.round(count*scale)),color,speed,life,size);};

  const baseAddEffect=Game.prototype.addEffect;
  Game.prototype.addEffect=function(effect){
    if(!effect)return;const density=effectDensity(this);
    if(this._bossClarityTimer>0&&!effect.critical)return;
    if(!effect.critical&&density==="low"&&this.effects?.length>CONFIG.MAX_EFFECTS*.45&&Math.random()<.5)return;
    return baseAddEffect.call(this,effect);
  };

  const baseDamageTextDraw=DamageText.prototype.draw;
  DamageText.prototype.draw=function(ctx,cam){
    const setting=window.__game?.records?.settings?.damageText||"normal";
    if(setting==="low"&&!this.crit&&Math.abs(Math.floor(this.x+this.y))%3!==0)return;
    return baseDamageTextDraw.call(this,ctx,cam);
  };

  const baseProjectileDraw=EnemyProjectile.prototype.draw;
  EnemyProjectile.prototype.draw=function(ctx,cam){
    baseProjectileDraw.call(this,ctx,cam);
    if(window.__game?.records?.settings?.projectileOutline===false)return;
    ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.strokeStyle="rgba(255,255,245,.88)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,this.radius+4,0,Math.PI*2);ctx.stroke();ctx.restore();
  };

  function drawPersistentPowers(player,ctx,cam){
    let rank=rankOf(player,"razor_constellation");
    if(rank){const stats=getPowerStats(player,"razor_constellation",rank),angle=player._razorAngle||0;for(let i=0;i<stats.count;i++){const a=angle+i/stats.count*Math.PI*2,x=player.x-cam.x+Math.cos(a)*stats.radius,y=player.y-cam.y+Math.sin(a)*stats.radius;ctx.save();ctx.translate(x,y);ctx.rotate(a+Math.PI/2);ctx.fillStyle="#ff5268";ctx.strokeStyle="#fff7dc";ctx.lineWidth=3;polygonPath(ctx,[[0,-24],[9,-5],[5,20],[0,29],[-5,20],[-9,-5]]);ctx.fill();ctx.stroke();ctx.restore();}}
    rank=rankOf(player,"black_sun");
    if(rank){const stats=getPowerStats(player,"black_sun",rank);for(const position of getBlackSunPositions(window.__game)){const x=position.x-cam.x,y=position.y-cam.y,r=stats.radius*.42;ctx.save();ctx.translate(x,y);const gradient=ctx.createRadialGradient(0,0,0,0,0,r*2.5);gradient.addColorStop(0,"#fff7dc");gradient.addColorStop(.18,"#ff8a4c");gradient.addColorStop(.42,"#191426");gradient.addColorStop(1,"rgba(180,92,255,0)");ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(0,0,r*2.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#b45cff";ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,r*1.4,0,Math.PI*2);ctx.stroke();ctx.restore();}}
    rank=rankOf(player,"mirror_legion");
    if(rank)for(const position of getMirrorPositions(window.__game)){ctx.save();ctx.translate(position.x-cam.x,position.y-cam.y);ctx.rotate(player.animT*1.4);ctx.globalAlpha=.75;ctx.fillStyle="#65d9ff";ctx.strokeStyle="#191426";ctx.lineWidth=3;polygonPath(ctx,[[18,0],[-9,10],[-4,0],[-9,-10]]);ctx.fill();ctx.stroke();ctx.restore();}
    if((player._shellCharges||0)>0){ctx.save();ctx.translate(player.x-cam.x,player.y-cam.y);ctx.strokeStyle="rgba(66,232,189,.92)";ctx.lineWidth=5;ctx.setLineDash([12,8]);ctx.lineDashOffset=-player.animT*40;ctx.beginPath();ctx.arc(0,0,42+(player._shellCharges-1)*8+Math.sin(player.animT*5)*3,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();}
    if(player._feastShield>0){ctx.save();ctx.translate(player.x-cam.x,player.y-cam.y);ctx.strokeStyle="rgba(255,212,71,.82)";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,50,0,Math.PI*2);ctx.stroke();ctx.restore();}
    ctx.save();ctx.translate(player.x-cam.x,player.y-cam.y-42);ctx.fillStyle="#fff7dc";ctx.strokeStyle="#090718";ctx.lineWidth=3;polygonPath(ctx,[[0,-9],[8,5],[0,2],[-8,5]]);ctx.fill();ctx.stroke();ctx.restore();
  }

  const basePlayerDraw=Player.prototype.draw;
  Player.prototype.draw=function(ctx,cam){basePlayerDraw.call(this,ctx,cam);drawPersistentPowers(this,ctx,cam);};

  const baseDrawGroundCached=Game.prototype.drawGroundCached;
  Game.prototype.drawGroundCached=function(ctx,cam,w,h,now){const result=baseDrawGroundCached.call(this,ctx,cam,w,h,now);drawStageRuleLayer(this,ctx,cam);return result;};

  const baseStartGame=Game.prototype.startGame;
  Game.prototype.startGame=function(){
    const recordBaseline={highScore:finite(this.records?.highScore,0),bestTime:finite(this.records?.bestTime,0),maxKills:finite(this.records?.maxKills,0)};
    const result=baseStartGame.call(this);
    this._runStats=newRunStats();this._resultRecorded=false;this._powerTimers={};this._delayedSystemCasts=[];this._systemTimeStop=0;this._timeBurstPending=false;this._systemStageIndex=-1;this._stageRuleTimer=0;this._stageDamageMul=1;this._stageCooldownMul=1;this._stageXpMul=1;this._stageSpawnMul=1;this._pendingBossReward=null;this._pendingTreasureMutation=false;this._lastMutationTime=-999;this._runEnemyHpBonus=1;
    applyPermanentBuild(this);this.player._originDraft=true;this.player.lastMove={x:0,y:0};window.__recentUpgrades=[];this._abyssMusic=new AbyssMusic(this);this._runRecordBaseline=recordBaseline;this._onboardingStep=this.records.onboardingVersion>=1?3:0;this.updateWeaponBarDOM();updateBuildHud(this);setStageHud(this,0);
    this.pendingLevelUps=(this.pendingLevelUps||0)+1;if(this.state==="playing")this.openLevelUp();
    if(this.records.lastSystemRefund>0){this.showSystemToast("◇","旧回路を返還","廃止された旧ノードの投資を自動返還しました。",`返還 +${this.records.lastSystemRefund} 深淵片`,"#ffd447");this.records.lastSystemRefund=0;this.saveRecords();}
    return result;
  };

  const baseUpdate=Game.prototype.update;
  Game.prototype.update=function(dt){
    const player=this.player,oldX=player?.x||0,oldY=player?.y||0,oldHp=player?.hp||0;
    const result=baseUpdate.call(this,dt);
    if(!this.player)return result;
    if(this.state==="playing"){
      const moved=Math.hypot(this.player.x-oldX,this.player.y-oldY);this.player.lastMove={x:(this.player.x-oldX)/Math.max(dt,.001),y:(this.player.y-oldY)/Math.max(dt,.001)};
      updateStageRules(this,dt);updatePowers(this,dt,moved);
      if(this._systemTimeStop>0){
        this._systemTimeStop=Math.max(0,this._systemTimeStop-dt);
        if(this._systemTimeStop===0&&this._timeBurstPending){
          this._timeBurstPending=false;const stats=getPowerStats(this.player,"time_execution",this._timeExecutionRank||1),damage=this._timeExecutionDamage;
          withDamageSource(this,"time_execution",()=>{for(const enemy of this.enemies){if(enemy.dead)continue;if(stats.execute&&enemy.hp/enemy.maxHp<=stats.execute)this.damageEnemy(enemy,enemy.hp+1,false);else this.damageEnemy(enemy,damage,false);}if(this.boss&&!this.boss.dead)this.damageBoss(damage,false);});
          if(hasSynergy(this.player,"frozen_thunder")){const targets=nearestTargets(this,Math.min(20,this.enemies.length),1400),extra=powerDamage(this,"storm_throne",1.1);withDamageSource(this,"frozen_thunder",()=>targets.forEach(enemy=>{this.addEffect(new LightningEffect(this.player.x,this.player.y,enemy.x,enemy.y,"#65d9ff",.2,6));this.damageEnemy(enemy,extra,false);}));}
          this.addEffect(new SystemPulse(this.player.x,this.player.y,Math.max(this.viewW,this.viewH),"#65d9ff",.7));this.shake(14,.34);
        }
      }
      if(this.player.hp>oldHp&&this._runStats)this._runStats.healing+=this.player.hp-oldHp;
      if(this._onboardingStep<3){
        const tips=[
          {at:1,icon:"↗",name:"移動",desc:"WASD または矢印キーで危険地帯から離脱。",effect:"止まらず、敵の包囲に出口を作る。"},
          {at:15,icon:"◇",name:"自動攻撃と経験値",desc:"攻撃は自動。落ちた経験値を回収して権能を育てる。",effect:"敵へ近づくより、回収経路を選ぶ。"},
          {at:32,icon:"!",name:"危険予告",desc:"色付きの線・円・十字は敵攻撃の予告。",effect:"エフェクトではなく予告範囲の外へ回避。"}
        ];
        const tip=tips[this._onboardingStep];
        if(tip&&this.elapsed>=tip.at){
          this.showSystemToast(tip.icon,tip.name,tip.desc,tip.effect,"#65d9ff");this._onboardingStep++;
          if(this._onboardingStep>=3){this.records.onboardingVersion=1;this.saveRecords();}
        }
      }
      if(this._bossClarityTimer>0)this._bossClarityTimer=Math.max(0,this._bossClarityTimer-dt);
      this._abyssMusic?.update(dt);processPendingModal(this);
      this._buildHudTimer=(this._buildHudTimer||0)-dt;if(this._buildHudTimer<=0){this._buildHudTimer=.25;updateBuildHud(this);}
    }
    return result;
  };

  const baseCalculateShardReward=Game.prototype.calculateShardReward;
  Game.prototype.calculateShardReward=function(clear){const base=baseCalculateShardReward.call(this,clear),layer=selectedLayer(this),challenge=currentChallenge(this);return Math.max(1,Math.floor(base*(1+layer*.1)*challenge.reward));};

  const baseOnClear=Game.prototype.onClear;
  Game.prototype.onClear=function(){
    const layer=selectedLayer(this);this.records.abyssUnlocked=Math.max(this.records.abyssUnlocked||0,Math.min(MAX_ABYSS_LAYER,layer+1));
    const challenge=this.records.challengeSelected||"none";if(challenge!=="none")this.records.challengeBest[challenge]=Math.max(finite(this.records.challengeBest[challenge],-1),layer);
    return baseOnClear.call(this);
  };

  function resultAnalyticsHtml(game,clear){
    const stats=game._runStats||newRunStats(),entries=Object.entries(stats.damageBySource).sort((a,b)=>b[1]-a[1]),total=entries.reduce((sum,item)=>sum+item[1],0),top=entries.slice(0,8);
    const damageRows=top.length?top.map(([source,damage])=>`<div class="damage-source-row"><span>${sourceLabel(source)}</span><span>${Math.round(damage).toLocaleString()} <small>${total?Math.round(damage/total*100):0}%</small></span></div>`).join(""):"<div class=\"damage-source-empty\">ダメージ記録なし</div>";
    const evolved=Object.keys(game.player.powerEvolutions||{}).map(id=>EVOLUTIONS[id]?.name).filter(Boolean).join(" / ")||"なし",synergy=Object.keys(game.player.powerSynergies||{}).map(id=>SYNERGIES[id]?.name).filter(Boolean).join(" / ")||"なし";
    const baseline=game._runRecordBaseline||{},records=[];
    if(game.player.score>finite(baseline.highScore,0))records.push("ハイスコア");
    if(game.elapsed>finite(baseline.bestTime,0))records.push("生存時間");
    if(game.player.kills>finite(baseline.maxKills,0))records.push("撃破数");
    const affordable=SKILL_NODES.find(node=>{const rank=game.getSkillRank?.(node.id)||0,cost=node.costs?.[rank];return rank<(node.max||1)&&Number.isFinite(cost)&&cost<=finite(game.records.shards,0)&&game.skillRequirementsMet?.(node);});
    const challengeName=CHALLENGES[game.records.challengeSelected]?.name||"標準航行",challengeDepth=finite(game.records.challengeBest?.[game.records.challengeSelected],-1);
    const nextGoal=affordable?`星座盤「${affordable.name}」を取得可能`:clear?`深淵層 ${Math.min(MAX_ABYSS_LAYER,selectedLayer(game)+1)}へ挑戦可能`:`あと ${Math.max(0,Math.ceil(CONFIG.GAME_TIME-game.elapsed))}秒生存で初回クリア`;
    return `<section class="run-analysis"><header><strong>RUN ANALYSIS</strong><span>深淵層 ${selectedLayer(game)} / ${challengeName}</span></header><div class="analysis-grid"><div><h3>権能別ダメージ</h3>${damageRows}</div><div><h3>戦闘記録</h3><div class="analysis-stat"><span>総ダメージ</span><b>${Math.round(total).toLocaleString()}</b></div><div class="analysis-stat"><span>被ダメージ</span><b>${Math.round(stats.damageTaken).toLocaleString()}</b></div><div class="analysis-stat"><span>回復量</span><b>${Math.round(stats.healing).toLocaleString()}</b></div><div class="analysis-stat"><span>宝箱 / 増殖巣</span><b>${stats.treasures} / ${stats.stageNests}</b></div><div class="analysis-stat"><span>進化</span><b>${evolved}</b></div><div class="analysis-stat"><span>共鳴</span><b>${synergy}</b></div><div class="analysis-stat"><span>チャレンジ最高深度</span><b>${challengeDepth>=0?challengeDepth:"未記録"}</b></div></div></div><div class="run-next-goal"><span>${records.length?`NEW RECORD｜${records.join("・")}`:"RUN COMPLETE"}</span><strong>${nextGoal}</strong></div></section>`;
  }

  function recordRunHistory(game,clear){
    if(game._resultRecorded)return;game._resultRecorded=true;
    const stats=game._runStats||newRunStats(),damageTotal=Object.values(stats.damageBySource).reduce((sum,value)=>sum+value,0),entry={date:Date.now(),clear:!!clear,layer:selectedLayer(game),challenge:game.records.challengeSelected||"none",time:Math.floor(game.elapsed),kills:game.player.kills,level:game.player.level,damage:Math.round(damageTotal),powers:ownedPowerIds(game.player),evolutions:Object.keys(game.player.powerEvolutions||{}),synergies:Object.keys(game.player.powerSynergies||{})};
    game.records.runHistory=[entry,...(game.records.runHistory||[])].slice(0,MAX_RUN_HISTORY);game.saveRecords();
  }

  const baseShowResult=Game.prototype.showResult;
  Game.prototype.showResult=function(clear){baseShowResult.call(this,clear);recordRunHistory(this,clear);const panel=document.querySelector(`#${clear?"clearScreen":"gameOverScreen"} .title-block`);if(panel){panel.querySelector(".run-analysis")?.remove();panel.querySelector(".result-weapons")?.insertAdjacentHTML("afterend",resultAnalyticsHtml(this,clear));}};

  const baseToTitle=Game.prototype.toTitle;
  Game.prototype.toTitle=function(){this._abyssMusic?.stop();const result=baseToTitle.call(this);updateTitleControls(this);return result;};
  const basePlayerDeath=Game.prototype.onPlayerDeath;
  Game.prototype.onPlayerDeath=function(){this._abyssMusic?.stop();return basePlayerDeath.call(this);};

  const baseUpdateHud=Game.prototype.updateHUD;
  Game.prototype.updateHUD=function(){baseUpdateHud.call(this);updateBuildHud(this);};

  /* ============================== 起動後の補正 ============================== */
  const originalVolumeInput=document.getElementById("volSlider");
  originalVolumeInput?.addEventListener("input",()=>{const game=window.__game;if(game){game.records.volume=Number(originalVolumeInput.value);game.sound.volume=game.records.volume/100;updateSettingOutputs(game);}});

  const treeTitle=document.querySelector("#skillTreeScreen h2");if(treeTitle)treeTitle.textContent="再誕星座盤";
  const treeKicker=document.querySelector(".skill-tree-kicker");if(treeKicker)treeKicker.textContent="ABYSS SYSTEMS / PERMANENT BUILD";
  const treeDescription=document.querySelector(".skill-tree-header p");if(treeDescription)treeDescription.innerHTML="権能枠・進化核・共鳴・深淵層を支える永続回路。<span class=\"rebirth-tree-note\">数値だけでなく、ランの構築手順そのものを変える。</span>";
  document.getElementById("skillTreeBtn")?.replaceChildren(document.createTextNode("再誕星座盤"));
  document.querySelectorAll("#resultSkillBtn1,#resultSkillBtn2").forEach(button=>button.textContent="再誕星座盤");
  const titleNote=document.querySelector(".title-note");if(titleNote)titleNote.textContent="5枠の権能を選び、Lv.3進化と二権能共鳴でビルドを完成させる。固有ボスと5つの環境法則を突破し、より深い層へ降下せよ。";

})();


/* ===== Extension: player-visual-compat.js ===== */
"use strict";

/*
 * Restores the persistent-power renderer installed by abyss-systems.js after
 * combat-readability.js finishes its load-time setup. This keeps Black Sun's
 * visible body aligned with its original gameplay contact area.
 */
(() => {
  if (typeof window === "undefined" || typeof Player === "undefined") return;

  const drawAbyssPlayer = Player.prototype.draw;
  const VISUAL_VERSION = "2026.07.22-R3";

  function drawLocatorUnderlay(player, ctx, cam){
    const x = player.x - cam.x;
    const y = player.y - cam.y;
    const pulse = 1 + Math.sin((player.animT || 0) * 4.5) * 0.045;
    const radius = 30 * pulse;

    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(9,7,24,.18)";
    ctx.beginPath();
    ctx.arc(0, 0, radius + 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,247,220,.84)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.lineDashOffset = -(player.animT || 0) * 18;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "rgba(66,232,189,.9)";
    ctx.lineWidth = 3;
    for (let index = 0; index < 4; index++){
      const angle = index * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * (radius - 2), Math.sin(angle) * (radius - 2));
      ctx.lineTo(Math.cos(angle) * (radius + 7), Math.sin(angle) * (radius + 7));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLocatorOverlay(player, ctx, cam){
    const x = player.x - cam.x;
    const y = player.y - cam.y;

    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#fff7dc";
    ctx.strokeStyle = "#090718";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.translate(0, -43);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(7, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-7, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function install(){
    if (Player.prototype.draw?.__abyssVisualCompat) return;

    function drawWithOriginalPowers(ctx, cam){
      drawLocatorUnderlay(this, ctx, cam);
      drawAbyssPlayer.call(this, ctx, cam);
      drawLocatorOverlay(this, ctx, cam);
    }

    drawWithOriginalPowers.__abyssVisualCompat = true;
    Player.prototype.draw = drawWithOriginalPowers;

    const style = document.querySelector('link[href="assets/css/hud-readable-scale.css"]');
    if (style && style.parentNode === document.head) document.head.appendChild(style);

    const version = document.getElementById("gameVersion");
    if (version) version.textContent = `VER. ${window.__VOID_SURVIVORS_VERSION || VISUAL_VERSION}`;
  }

  window.addEventListener("load", install, {once:true});
})();


/* ===== Extension: overdrive-mode.js ===== */
"use strict";

/*
 * VOID SURVIVORS / ABYSS OVERDRIVE
 *
 * Once the normal upgrade pool is exhausted, gained EXP charges one simple
 * player-controlled burst instead of repeatedly offering repair/tradeoff cards.
 */
(() => {
  if (
    typeof window === "undefined" ||
    typeof Game === "undefined" ||
    typeof Player === "undefined" ||
    typeof buildUpgradePool !== "function"
  ) {
    return;
  }

  const POWER_CATALOG = window.__abyssSystems?.POWER_CATALOG || {};
  const DRIVE_DURATION = 9;
  const DRIVE_DAMAGE_MUL = 1.35;
  const DRIVE_COOLDOWN_MUL = 0.5;
  const DRIVE_SPEED_MUL = 1.2;
  const DRIVE_BOSS_MUL = 1.25;
  const QUEUED_LEVEL_REFUND = 0.6;

  function makeState(){
    return {
      charge: 0,
      need: 0,
      active: 0,
      available: false,
      introduced: false,
      applied: false,
      player: null,
      lastHudRender: 0
    };
  }

  function getState(game){
    if (!game._overdriveState) game._overdriveState = makeState();
    return game._overdriveState;
  }

  function meaningfulChoices(player){
    try{
      const pool = buildUpgradePool(player) || [];
      return pool.filter(choice => choice && choice.kind !== "utility");
    }catch(e){
      return null;
    }
  }

  function isBuildComplete(player){
    if (!player || player._originDraft) return false;
    const owned = Object.keys(POWER_CATALOG).some(id => Number(player.upgradeRanks?.[id]) > 0);
    const choices = meaningfulChoices(player);
    return owned && Array.isArray(choices) && choices.length === 0;
  }

  function syncNeed(game){
    const state = getState(game);
    const rawNeed = Math.round((game.player?.expToNext || 240) * .85);
    const nextNeed = Math.max(220, Math.min(800, rawNeed));
    if (state.need > 0 && state.need !== nextNeed){
      state.charge = Math.min(nextNeed, state.charge / state.need * nextNeed);
    }
    state.need = nextNeed;
    return state;
  }

  function setAvailability(game){
    const state = getState(game);
    state.available = isBuildComplete(game.player);
    if (state.available) syncNeed(game);
    return state.available;
  }

  function addCharge(game, amount){
    const state = syncNeed(game);
    state.charge = Math.min(state.need, state.charge + Math.max(0, Number(amount) || 0));
    renderHud(game, true);
  }

  function introduceOverdrive(game){
    const state = syncNeed(game);
    if (state.introduced) return state;
    state.introduced = true;
    state.player = game.player;
    if (game.player.exp > 0){
      state.charge = Math.min(state.need, state.charge + game.player.exp);
      game.player.exp = 0;
    }
    game.showSystemToast?.(
      "↯",
      "深淵オーバードライブ解禁",
      "ビルド完成後の経験値はゲージへ変換される。満タンになったら任意のタイミングで発動できる。",
      "SPACE またはゲージをクリックして9秒間起動",
      "#ffd447"
    );
    return state;
  }

  function ensureAvailable(game){
    if (!setAvailability(game)) return null;
    return introduceOverdrive(game);
  }

  function installStyles(){
    if (document.getElementById("overdriveModeStyles")) return;
    const style = document.createElement("style");
    style.id = "overdriveModeStyles";
    style.textContent = `
      #overdriveControl{
        position:fixed;
        left:50%;
        bottom:18px;
        z-index:940;
        display:none;
        width:min(370px,42vw);
        min-width:270px;
        padding:7px 9px 8px;
        transform:translateX(-50%);
        border:3px solid #fff7dc;
        background:#090718;
        color:#fff7dc;
        box-shadow:6px 6px 0 #5164ff;
        font-family:monospace;
        cursor:pointer;
        user-select:none;
      }
      #overdriveControl.visible{display:block;}
      #overdriveControl:focus-visible{
        outline:3px solid #ffd447;
        outline-offset:3px;
      }
      #overdriveControl[data-state="ready"]{
        border-color:#ffd447;
        box-shadow:6px 6px 0 #ff5268;
      }
      #overdriveControl[data-state="active"]{
        border-color:#ff5268;
        box-shadow:6px 6px 0 #ffd447;
      }
      .overdrive-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin-bottom:5px;
        font:1000 11px/1.1 Arial Black, sans-serif;
        letter-spacing:.1em;
      }
      #overdriveValue{color:#ffd447;font-size:14px;letter-spacing:0;}
      #overdriveControl[data-state="active"] #overdriveValue{color:#ff8a4c;}
      .overdrive-track{
        position:relative;
        height:12px;
        overflow:hidden;
        border:2px solid #fff7dc;
        background:#241b3f;
      }
      #overdriveFill{
        width:0;
        height:100%;
        background:#65d9ff;
        transition:width .08s linear;
      }
      #overdriveControl[data-state="ready"] #overdriveFill{background:#ffd447;}
      #overdriveControl[data-state="active"] #overdriveFill{background:#ff5268;}
      #overdriveHint{
        margin-top:5px;
        color:#b9b1c9;
        font:900 9px/1.2 monospace;
        letter-spacing:.08em;
        text-align:right;
      }
      #overdriveControl[data-state="ready"] #overdriveHint{color:#fff7dc;}
      @media (max-width:760px){
        #overdriveControl{
          bottom:12px;
          width:min(330px,58vw);
          min-width:230px;
          padding:6px 7px;
          box-shadow:4px 4px 0 #5164ff;
        }
        .overdrive-head{font-size:10px;}
        #overdriveHint{font-size:8px;}
      }
    `;
    document.head.appendChild(style);
  }

  function installHud(){
    installStyles();
    if (document.getElementById("overdriveControl")) return;
    const hud = document.getElementById("hud");
    if (!hud) return;
    const control = document.createElement("button");
    control.type = "button";
    control.id = "overdriveControl";
    control.setAttribute("aria-label", "深淵オーバードライブを発動");
    control.innerHTML = `
      <span class="overdrive-head"><span>ABYSS OVERDRIVE</span><strong id="overdriveValue">0%</strong></span>
      <span class="overdrive-track"><span id="overdriveFill"></span></span>
      <span id="overdriveHint">ビルド完成後のEXPで充填</span>
    `;
    control.addEventListener("click", () => activateOverdrive(window.__game));
    hud.appendChild(control);
  }

  function renderHud(game, force=false){
    const control = document.getElementById("overdriveControl");
    if (!control || !game?.player) return;
    const state = getState(game);
    const now = performance.now();
    if (!force && now - state.lastHudRender < 70) return;
    state.lastHudRender = now;

    const visible = state.active > 0 || state.available;
    control.classList.toggle("visible", visible);
    if (!visible) return;

    const fill = document.getElementById("overdriveFill");
    const value = document.getElementById("overdriveValue");
    const hint = document.getElementById("overdriveHint");

    if (state.active > 0){
      const ratio = Math.max(0, Math.min(1, state.active / DRIVE_DURATION));
      control.dataset.state = "active";
      fill.style.width = `${ratio * 100}%`;
      value.textContent = `${state.active.toFixed(1)}s`;
      hint.textContent = "出力×1.35 / CD半減 / 移動×1.20";
      control.setAttribute("aria-disabled", "true");
      return;
    }

    const ratio = state.need > 0 ? Math.max(0, Math.min(1, state.charge / state.need)) : 0;
    const ready = ratio >= 1;
    control.dataset.state = ready ? "ready" : "charging";
    fill.style.width = `${ratio * 100}%`;
    value.textContent = ready ? "READY" : `${Math.floor(ratio * 100)}%`;
    hint.textContent = ready ? "SPACE / CLICK で発動" : "完成後のEXPをゲージへ変換中";
    control.setAttribute("aria-disabled", ready ? "false" : "true");
  }

  function applyOverdrive(game){
    const state = getState(game);
    const player = game.player;
    state.applied = true;
    state.player = player;
    player.systemDamageMul = (player.systemDamageMul || 1) * DRIVE_DAMAGE_MUL;
    player.systemCooldownMul = (player.systemCooldownMul || 1) * DRIVE_COOLDOWN_MUL;
    player.speed *= DRIVE_SPEED_MUL;
    if (game._powerTimers){
      for (const id of Object.keys(game._powerTimers)) game._powerTimers[id] *= .35;
    }
  }

  function removeOverdrive(game){
    const state = getState(game);
    const player = state.player;
    if (!state.applied || !player) return;
    player.systemDamageMul = (player.systemDamageMul || 1) / DRIVE_DAMAGE_MUL;
    player.systemCooldownMul = (player.systemCooldownMul || 1) / DRIVE_COOLDOWN_MUL;
    player.speed /= DRIVE_SPEED_MUL;
    state.applied = false;
  }

  function activateOverdrive(game){
    if (!game || game.state !== "playing" || !game.player) return false;
    const state = ensureAvailable(game);
    if (!state || state.active > 0 || state.need <= 0 || state.charge < state.need) return false;

    state.charge = Math.max(0, state.charge - state.need);
    state.active = DRIVE_DURATION;
    applyOverdrive(game);
    game.sound?.levelUp?.();
    game.shake?.(13, .35);
    if (typeof ShockwaveEffect !== "undefined"){
      game.addEffect?.(new ShockwaveEffect(game.player.x, game.player.y, "#ffd447", 280, .7, {inner:24, fill:true}));
    }
    if (typeof spawnParticles === "function"){
      spawnParticles(game.particles, game.player.x, game.player.y, 34, "#ff5268", 320, .75, 7);
    }
    game.showSystemToast?.(
      "↯",
      "オーバードライブ起動",
      "完成したビルドを短時間だけ限界駆動する。",
      "9秒間：権能ダメージ ×1.35 / 権能CD ×0.50 / 移動速度 ×1.20",
      "#ff5268"
    );
    renderHud(game, true);
    return true;
  }

  function stopOverdrive(game, hide=false){
    if (!game?._overdriveState) return;
    const state = game._overdriveState;
    removeOverdrive(game);
    state.active = 0;
    if (hide){
      state.available = false;
      document.getElementById("overdriveControl")?.classList.remove("visible");
    }
    renderHud(game, true);
  }

  const previousGainExp = Player.prototype.gainExp;
  Player.prototype.gainExp = function(value){
    const game = window.__game;
    if (!game || game.player !== this) return previousGainExp.call(this, value);
    const state = getState(game);
    const useDrive = state.active > 0 || isBuildComplete(this);
    if (!useDrive) return previousGainExp.call(this, value);

    state.available = isBuildComplete(this);
    if (state.available) introduceOverdrive(game);
    const effectiveExp = Math.max(0, Number(value) || 0) * (this.expGainMul || 1);
    addCharge(game, effectiveExp);
    this.exp = 0;
  };

  const previousOpenLevelUp = Game.prototype.openLevelUp;
  Game.prototype.openLevelUp = function(...args){
    if (this.player && isBuildComplete(this.player)){
      const state = introduceOverdrive(this);
      state.available = true;
      const queued = Math.max(1, Math.floor(Number(this.pendingLevelUps) || 0));
      addCharge(this, state.need * QUEUED_LEVEL_REFUND * queued);
      this.pendingLevelUps = 0;
      document.getElementById("levelUpScreen")?.classList.add("hidden");
      this.state = "playing";
      this.lastTime = performance.now();
      return;
    }
    return previousOpenLevelUp.apply(this, args);
  };

  const previousCloseLevelUp = Game.prototype.closeLevelUp;
  Game.prototype.closeLevelUp = function(...args){
    const result = previousCloseLevelUp.apply(this, args);
    if (this.player){
      setAvailability(this);
      if (this._overdriveState.available) introduceOverdrive(this);
      renderHud(this, true);
    }
    return result;
  };

  const previousUpdateWeaponBarDOM = Game.prototype.updateWeaponBarDOM;
  Game.prototype.updateWeaponBarDOM = function(...args){
    const result = previousUpdateWeaponBarDOM.apply(this, args);
    if (this.player && this._overdriveState){
      setAvailability(this);
      renderHud(this, true);
    }
    return result;
  };

  const previousDamageBoss = Game.prototype.damageBoss;
  Game.prototype.damageBoss = function(damage, crit){
    const active = this._overdriveState?.active > 0;
    return previousDamageBoss.call(this, active ? damage * DRIVE_BOSS_MUL : damage, crit);
  };

  const previousUpdate = Game.prototype.update;
  Game.prototype.update = function(dt){
    const result = previousUpdate.call(this, dt);
    const state = this._overdriveState;
    if (state?.active > 0 && this.state === "playing"){
      state.active = Math.max(0, state.active - dt);
      if (state.active <= 0) removeOverdrive(this);
    }
    renderHud(this);
    return result;
  };

  const previousStartGame = Game.prototype.startGame;
  Game.prototype.startGame = function(...args){
    stopOverdrive(this, true);
    const result = previousStartGame.apply(this, args);
    this._overdriveState = makeState();
    renderHud(this, true);
    return result;
  };

  const previousToTitle = Game.prototype.toTitle;
  Game.prototype.toTitle = function(...args){
    stopOverdrive(this, true);
    return previousToTitle.apply(this, args);
  };

  const previousOnPlayerDeath = Game.prototype.onPlayerDeath;
  Game.prototype.onPlayerDeath = function(...args){
    stopOverdrive(this, true);
    return previousOnPlayerDeath.apply(this, args);
  };

  const previousOnClear = Game.prototype.onClear;
  Game.prototype.onClear = function(...args){
    stopOverdrive(this, true);
    return previousOnClear.apply(this, args);
  };

  window.addEventListener("keydown", event => {
    if (event.code !== "Space" || event.repeat) return;
    if (event.target && /INPUT|TEXTAREA|SELECT|BUTTON/.test(event.target.tagName)) return;
    activateOverdrive(window.__game);
  });

  installHud();
  window.addEventListener("DOMContentLoaded", installHud, {once:true});

  window.__overdriveMode = {
    version: 1,
    isBuildComplete,
    activate(){ return activateOverdrive(window.__game); },
    validate(){
      const problems = [];
      if (!(DRIVE_DURATION > 0)) problems.push("duration must be positive");
      if (!(DRIVE_DAMAGE_MUL > 1)) problems.push("damage multiplier must exceed 1");
      if (!(DRIVE_COOLDOWN_MUL > 0 && DRIVE_COOLDOWN_MUL < 1)) problems.push("cooldown multiplier must be between 0 and 1");
      return {ok: problems.length === 0, problems};
    }
  };
})();


/* ===== Extension: speed-controls.js ===== */
"use strict";

(() => {
  const MIN_SPEED = 1;
  const MAX_SPEED = 5;
  const GAME_VERSION = "2026.07.22.1";

  function clampSpeed(value){
    const speed = Math.round(Number(value) || MIN_SPEED);
    return Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));
  }

  const previousUpdate = Game.prototype.update;

  Game.prototype.update = function(dt){
    const speed = clampSpeed(this.timeScale);

    for (let step = 0; step < speed; step++){
      if (this.state !== "playing") break;
      previousUpdate.call(this, dt);
    }
  };

  function installStyles(){
    if (document.getElementById("speedControlStyles")) return;

    const style = document.createElement("style");
    style.id = "speedControlStyles";
    style.textContent = `
      #gameSpeedControl{
        display:flex;
        align-items:stretch;
        gap:4px;
        height:36px;
        padding:3px;
        border:2px solid #fff7dc;
        background:#090718e8;
        box-shadow:4px 4px 0 #5dffd2;
        font-family:monospace;
      }

      .game-speed-btn{
        appearance:none;
        width:30px;
        min-width:30px;
        border:0;
        background:#fff7dc;
        color:#090718;
        font:1000 18px/1 Arial Black, sans-serif;
        cursor:pointer;
      }

      .game-speed-btn:hover:not(:disabled),
      .game-speed-btn:focus-visible:not(:disabled){
        background:#5dffd2;
        outline:2px solid #090718;
        outline-offset:-4px;
      }

      .game-speed-btn:disabled{
        opacity:.3;
        cursor:default;
      }

      #gameSpeedReadout{
        display:flex;
        min-width:48px;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        color:#fff7dc;
        line-height:1;
      }

      #gameSpeedReadout small{
        margin-bottom:2px;
        color:#a9a2bd;
        font:900 8px/1 monospace;
        letter-spacing:.12em;
      }

      #gameSpeedValue{
        font:1000 16px/1 Arial Black, sans-serif;
      }

      #gameSpeedControl[data-speed="5"]{
        border-color:#ffdc69;
        box-shadow:4px 4px 0 #ff5878;
      }

      #gameSpeedControl[data-speed="5"] #gameSpeedValue{
        color:#ffdc69;
      }

      #gameVersion{
        position:fixed;
        left:8px;
        bottom:6px;
        z-index:10000;
        color:rgba(255,247,220,.58);
        font:900 9px/1 monospace;
        letter-spacing:.08em;
        text-shadow:1px 1px 0 #090718;
        pointer-events:none;
        user-select:none;
      }

      @media (max-width:760px){
        #gameSpeedControl{
          height:32px;
        }

        .game-speed-btn{
          width:26px;
          min-width:26px;
          font-size:16px;
        }

        #gameSpeedReadout{
          min-width:42px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function installControls(game){
    const pauseWrap = document.getElementById("pauseBtnWrap");
    if (!pauseWrap || document.getElementById("gameSpeedControl")) return;

    game.timeScale = clampSpeed(game.timeScale);

    const control = document.createElement("div");
    control.id = "gameSpeedControl";
    control.setAttribute("aria-label", "ゲーム速度");
    control.innerHTML = `
      <button class="game-speed-btn" id="gameSpeedDown" type="button" aria-label="ゲーム速度を1段階下げる">−</button>
      <div id="gameSpeedReadout">
        <small>SPEED</small>
        <strong id="gameSpeedValue" aria-live="polite">×1</strong>
      </div>
      <button class="game-speed-btn" id="gameSpeedUp" type="button" aria-label="ゲーム速度を1段階上げる">＋</button>
    `;

    pauseWrap.insertBefore(control, pauseWrap.firstChild);

    const downButton = document.getElementById("gameSpeedDown");
    const upButton = document.getElementById("gameSpeedUp");
    const value = document.getElementById("gameSpeedValue");

    const render = () => {
      const speed = clampSpeed(game.timeScale);
      game.timeScale = speed;
      control.dataset.speed = String(speed);
      value.textContent = `×${speed}`;
      downButton.disabled = speed <= MIN_SPEED;
      upButton.disabled = speed >= MAX_SPEED;
    };

    downButton.addEventListener("click", () => {
      game.timeScale = clampSpeed(game.timeScale - 1);
      render();
    });

    upButton.addEventListener("click", () => {
      game.timeScale = clampSpeed(game.timeScale + 1);
      render();
    });

    render();
  }

  function installVersion(){
    if (document.getElementById("gameVersion")) return;

    const version = document.createElement("div");
    version.id = "gameVersion";
    version.textContent = `VER. ${window.__VOID_SURVIVORS_VERSION || GAME_VERSION}`;
    document.body.appendChild(version);
  }

  window.addEventListener("DOMContentLoaded", () => {
    const game = window.__game;
    if (!game) return;

    installStyles();
    installControls(game);
    installVersion();
  });
})();


/* ===== Extension: overdrive-impact.js ===== */
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
      if (version) version.textContent = `VER. ${window.__VOID_SURVIVORS_VERSION || GAME_VERSION}`;
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


/* ===== Extension: combat-balance-overhaul.js ===== */
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
