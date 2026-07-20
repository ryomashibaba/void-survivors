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
      ctx.shadowBlur = 20;
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