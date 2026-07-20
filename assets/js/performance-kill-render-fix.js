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