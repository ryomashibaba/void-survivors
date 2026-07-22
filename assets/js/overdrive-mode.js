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
