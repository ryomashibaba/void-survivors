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