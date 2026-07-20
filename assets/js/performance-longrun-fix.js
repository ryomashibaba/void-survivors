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