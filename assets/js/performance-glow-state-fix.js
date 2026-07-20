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