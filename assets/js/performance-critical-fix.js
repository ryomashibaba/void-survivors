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