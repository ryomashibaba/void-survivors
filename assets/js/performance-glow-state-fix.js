"use strict";

(() => {
  function resetContext(ctx){
    if (!ctx) return;

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "rgba(0,0,0,0)";

    if ("filter" in ctx){
      ctx.filter = "none";
    }
  }

  /*
   * クリティカル文字や着弾演出が描画状態を変更しても、
   * 他の敵・弾・障害物へ引き継がせない。
   */
  function guardDraw(ctor){
    if (
      !ctor ||
      !ctor.prototype
    ){
      return;
    }

    const original =
      ctor.prototype.draw;

    if (
      typeof original !== "function" ||
      original.__voidContextGuard
    ){
      return;
    }

    function guardedDraw(
      ctx,
      ...args
    ){
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

    guardedDraw.__voidContextGuard =
      true;

    ctor.prototype.draw =
      guardedDraw;
  }

  if (
    typeof DamageText ===
    "function"
  ){
    guardDraw(DamageText);
  }

  if (
    typeof ImpactEffect ===
    "function"
  ){
    guardDraw(ImpactEffect);
  }

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

  window.addEventListener(
    "DOMContentLoaded",
    () => {
      const game =
        window.__game;

      if (!game){
        return;
      }

      resetContext(game.ctx);
      resetContext(game.groundCtx);
    }
  );
})();