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
    version.textContent = `VER. ${GAME_VERSION}`;
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
