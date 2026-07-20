"use strict";

(() => {
  const SAVE_KEY = "void_survivors_records";

  function nonNegativeNumber(value, fallback, integer){
    const parsed = Number(value);
    const safe = Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : fallback;

    return integer ? Math.floor(safe) : safe;
  }

  function sanitizeRecords(records){
    const safe = records && typeof records === "object" && !Array.isArray(records)
      ? records
      : {};

    safe.highScore = nonNegativeNumber(safe.highScore, 0, true);
    safe.bestTime = nonNegativeNumber(safe.bestTime, 0, false);
    safe.maxKills = nonNegativeNumber(safe.maxKills, 0, true);

    const volume = Number(safe.volume);
    safe.volume = U.clamp(Number.isFinite(volume) ? volume : 60, 0, 100);

    safe.shards = nonNegativeNumber(safe.shards, 0, true);
    safe.totalShards = Math.max(
      safe.shards,
      nonNegativeNumber(safe.totalShards, safe.shards, true)
    );

    safe.skillTree = normalizeSkillTree(safe.skillTree);
    return safe;
  }

  /*
   * Escapeやrole=buttonのキー長押しで、同じ操作が自動反復されるのを防ぐ。
   * 通常の単発入力はそのまま通す。
   */
  window.addEventListener("keydown", event => {
    if (!event.repeat) return;

    const target = event.target;
    const roleButton =
      (event.key === "Enter" || event.key === " ") &&
      target &&
      typeof target.closest === "function" &&
      target.closest('[role="button"]');

    if (event.key === "Escape" || roleButton){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  const previousLoadRecords = Game.prototype.loadRecords;
  Game.prototype.loadRecords = function(){
    previousLoadRecords.call(this);

    this.records = sanitizeRecords(this.records);

    const slider = document.getElementById("volSlider");
    if (slider) slider.value = String(this.records.volume);

    if (this.sound){
      this.sound.volume = this.records.volume / 100;
    }

    this.updateMetaUI();

    try{
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify(this.records)
      );
    }catch(e){}
  };

  const previousOpenLevelUp = Game.prototype.openLevelUp;
  Game.prototype.openLevelUp = function(){
    this._levelUpSelectionLocked = false;
    return previousOpenLevelUp.call(this);
  };

  const previousStartGame = Game.prototype.startGame;
  Game.prototype.startGame = function(){
    this._runFinalized = false;
    this._levelUpSelectionLocked = false;
    return previousStartGame.call(this);
  };

  const previousFinalizeRun = Game.prototype.finalizeRun;
  Game.prototype.finalizeRun = function(clear){
    if (this._runFinalized) return;
    this._runFinalized = true;
    return previousFinalizeRun.call(this, clear);
  };

  /*
   * クリック、Enter、Spaceが同一カードへ重複して届いても、
   * 1回のレベルアップにつき強化は1回だけ適用する。
   */
  document.addEventListener("click", event => {
    const target = event.target;
    const card =
      target &&
      typeof target.closest === "function"
        ? target.closest(".upgrade-card")
        : null;

    if (!card) return;

    const game = window.__game;
    if (
      !game ||
      game.state !== "levelup" ||
      game._levelUpSelectionLocked
    ){
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    game._levelUpSelectionLocked = true;
  }, true);
})();
