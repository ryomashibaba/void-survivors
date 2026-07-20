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