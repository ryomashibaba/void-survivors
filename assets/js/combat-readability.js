"use strict";

/*
 * VOID SURVIVORS / COMBAT READABILITY
 *
 * This layer leaves combat values and hit areas unchanged. It only reorganizes
 * information density and replaces oversized persistent-power rendering with
 * clearer, bounded silhouettes.
 */
(() => {
  if (typeof window === "undefined" || typeof Player === "undefined" || typeof Game === "undefined") return;

  // Captured before abyss-systems.js wraps Player.draw. This lets the final
  // renderer retain the ship while replacing only the persistent-power layer.
  const drawBasePlayer = Player.prototype.draw;
  const READABILITY_VERSION = "2026.07.21-R2";
  const RULE_EXPANDED_MS = 4200;
  const HINT_VISIBLE_MS = 6500;

  function clamp(value, min, max){
    return Math.max(min, Math.min(max, value));
  }

  function rankOf(player, id){
    const value = Number(player?.upgradeRanks?.[id]);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }

  function isEvolved(player, id){
    return !!player?.powerEvolutions?.[id];
  }

  function polygon(ctx, points){
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
  }

  function drawLocatorUnderlay(player, ctx, cam){
    const x = player.x - cam.x;
    const y = player.y - cam.y;
    const pulse = 1 + Math.sin((player.animT || 0) * 4.5) * 0.045;
    const radius = 30 * pulse;

    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(9,7,24,.18)";
    ctx.beginPath();
    ctx.arc(0, 0, radius + 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,247,220,.84)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.lineDashOffset = -(player.animT || 0) * 18;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "rgba(66,232,189,.9)";
    ctx.lineWidth = 3;
    for (let index = 0; index < 4; index++){
      const angle = index * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * (radius - 2), Math.sin(angle) * (radius - 2));
      ctx.lineTo(Math.cos(angle) * (radius + 7), Math.sin(angle) * (radius + 7));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBlackSuns(player, ctx, cam){
    const rank = rankOf(player, "black_sun");
    if (!rank) return;

    const area = Number.isFinite(player.systemAreaMul) ? player.systemAreaMul : 1;
    const orbit = [190, 220, 250][clamp(rank, 1, 3) - 1] * area;
    const hitRadius = [82, 105, 130][clamp(rank, 1, 3) - 1] * area;
    const count = isEvolved(player, "black_sun") ? 2 : 1;
    const baseAngle = player._blackSunAngle || 0;

    for (let index = 0; index < count; index++){
      const direction = index % 2 ? -1 : 1;
      const angle = baseAngle * direction + index * Math.PI;
      const x = player.x - cam.x + Math.cos(angle) * orbit;
      const y = player.y - cam.y + Math.sin(angle) * orbit;
      const core = clamp(hitRadius * 0.26, 24, 38);
      const halo = core * 1.72;
      const pulse = 1 + Math.sin((player.animT || 0) * 5.2 + index * Math.PI) * 0.05;

      ctx.save();
      ctx.translate(x, y);
      ctx.globalCompositeOperation = "source-over";

      // The thin dashed boundary communicates the real contact area without
      // filling the arena with an opaque glow.
      ctx.strokeStyle = "rgba(180,92,255,.42)";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 9]);
      ctx.lineDashOffset = -(player.animT || 0) * 20 * direction;
      ctx.beginPath();
      ctx.arc(0, 0, hitRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const gradient = ctx.createRadialGradient(0, 0, 1, 0, 0, halo * pulse);
      gradient.addColorStop(0, "rgba(255,253,242,.98)");
      gradient.addColorStop(.13, "rgba(255,138,76,.96)");
      gradient.addColorStop(.43, "rgba(25,20,38,.96)");
      gradient.addColorStop(.74, "rgba(25,20,38,.72)");
      gradient.addColorStop(1, "rgba(180,92,255,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, halo * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#130e22";
      ctx.beginPath();
      ctx.arc(0, 0, core, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#b45cff";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.strokeStyle = "rgba(255,138,76,.9)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, core * .68, -1.15, 1.15);
      ctx.stroke();
      ctx.fillStyle = "#fff7dc";
      ctx.beginPath();
      ctx.arc(core * .13, 0, Math.max(3, core * .13), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawRazorConstellation(player, ctx, cam){
    const rank = rankOf(player, "razor_constellation");
    if (!rank) return;

    const area = Number.isFinite(player.systemAreaMul) ? player.systemAreaMul : 1;
    const count = [3, 5, 7][clamp(rank, 1, 3) - 1] + (isEvolved(player, "razor_constellation") ? 2 : 0);
    const radius = [112, 132, 154][clamp(rank, 1, 3) - 1] * area;
    const baseAngle = player._razorAngle || 0;

    for (let index = 0; index < count; index++){
      const angle = baseAngle + index / count * Math.PI * 2;
      const x = player.x - cam.x + Math.cos(angle) * radius;
      const y = player.y - cam.y + Math.sin(angle) * radius;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = "#ff5268";
      ctx.strokeStyle = "#fff7dc";
      ctx.lineWidth = 2.5;
      polygon(ctx, [[0, -20], [7, -4], [4, 17], [0, 24], [-4, 17], [-7, -4]]);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawMirrorLegion(player, ctx, cam){
    const rank = rankOf(player, "mirror_legion");
    if (!rank) return;

    const count = [2, 3, 4][clamp(rank, 1, 3) - 1] + (isEvolved(player, "mirror_legion") ? 1 : 0);
    for (let index = 0; index < count; index++){
      const angle = (player.animT || 0) * 1.4 + index / count * Math.PI * 2;
      const x = player.x - cam.x + Math.cos(angle) * 86;
      const y = player.y - cam.y + Math.sin(angle) * 86;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = .76;
      ctx.fillStyle = "#65d9ff";
      ctx.strokeStyle = "#191426";
      ctx.lineWidth = 2.5;
      polygon(ctx, [[16, 0], [-8, 9], [-3, 0], [-8, -9]]);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawPlayerOverlays(player, ctx, cam){
    const x = player.x - cam.x;
    const y = player.y - cam.y;

    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = "source-over";

    if ((player._shellCharges || 0) > 0){
      ctx.strokeStyle = "rgba(66,232,189,.88)";
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 7]);
      ctx.lineDashOffset = -(player.animT || 0) * 36;
      ctx.beginPath();
      ctx.arc(0, 0, 39 + (player._shellCharges - 1) * 7 + Math.sin((player.animT || 0) * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (player._feastShield > 0){
      ctx.strokeStyle = "rgba(255,212,71,.82)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 47, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Exact center marker: visible even when multiple effects overlap the hull.
    ctx.fillStyle = "#fff7dc";
    ctx.strokeStyle = "#090718";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.translate(0, -43);
    ctx.fillStyle = "#fff7dc";
    ctx.strokeStyle = "#090718";
    ctx.lineWidth = 2.5;
    polygon(ctx, [[0, -8], [7, 5], [0, 2], [-7, 5]]);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function installPlayerRenderer(){
    Player.prototype.draw = function(ctx, cam){
      drawBlackSuns(this, ctx, cam);
      drawRazorConstellation(this, ctx, cam);
      drawMirrorLegion(this, ctx, cam);
      drawLocatorUnderlay(this, ctx, cam);
      drawBasePlayer.call(this, ctx, cam);
      drawPlayerOverlays(this, ctx, cam);
    };
  }

  function installBackgroundCalming(){
    const refreshGroundCache = Game.prototype.refreshGroundCache;
    if (typeof refreshGroundCache !== "function" || refreshGroundCache.__readabilityWrapped) return;

    function readableGroundCache(...args){
      const result = refreshGroundCache.apply(this, args);
      const stage = Number.isFinite(this._staticGroundStage) ? this._staticGroundStage : -1;
      if (!this.groundCtx || !this.groundCanvas || this._readabilityWashedStage === stage) return result;

      // One inexpensive wash per stage cache refresh. No additional full-screen
      // gradient is created during normal frame rendering.
      const ctx = this.groundCtx;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(9,7,24,.055)";
      ctx.fillRect(0, 0, this.groundCanvas.width, this.groundCanvas.height);
      ctx.restore();
      this._readabilityWashedStage = stage;
      return result;
    }

    readableGroundCache.__readabilityWrapped = true;
    Game.prototype.refreshGroundCache = readableGroundCache;
  }

  function installBuildPanel(){
    const hud = document.getElementById("hud");
    const weaponBar = document.getElementById("weaponBar");
    if (!hud || !weaponBar || document.getElementById("buildPanelToggle")) return;

    const shell = document.createElement("section");
    shell.id = "buildRailShell";
    shell.setAttribute("aria-label", "現在のビルド");
    weaponBar.parentNode.insertBefore(shell, weaponBar);

    const toggle = document.createElement("button");
    toggle.id = "buildPanelToggle";
    toggle.type = "button";
    toggle.setAttribute("aria-controls", "weaponBar");
    toggle.setAttribute("aria-expanded", "false");
    toggle.title = "ビルド詳細を開く（Bキー）";
    toggle.textContent = "BUILD DETAIL [B]";
    shell.appendChild(toggle);
    shell.appendChild(weaponBar);

    const setOpen = open => {
      const enabled = !!open;
      document.body.classList.toggle("build-panel-open", enabled);
      toggle.setAttribute("aria-expanded", String(enabled));
      toggle.textContent = enabled ? "CLOSE BUILD [B]" : "BUILD DETAIL [B]";
      toggle.title = enabled ? "ビルド詳細を閉じる（Bキー）" : "ビルド詳細を開く（Bキー）";
      if (enabled) weaponBar.scrollTop = 0;
    };

    toggle.addEventListener("click", () => setOpen(!document.body.classList.contains("build-panel-open")));
    window.addEventListener("keydown", event => {
      const target = event.target;
      const editing = target && (target.matches?.("input,select,textarea") || target.isContentEditable);
      if (editing || event.repeat || String(event.key).toLowerCase() !== "b") return;
      const game = window.__game;
      if (!game || !["playing", "paused", "levelup"].includes(game.state)) return;
      event.preventDefault();
      setOpen(!document.body.classList.contains("build-panel-open"));
    });

    const hudObserver = new MutationObserver(() => {
      if (hud.classList.contains("hidden")) setOpen(false);
    });
    hudObserver.observe(hud, {attributes:true, attributeFilter:["class"]});

    const startGame = Game.prototype.startGame;
    Game.prototype.startGame = function(...args){
      setOpen(false);
      return startGame.apply(this, args);
    };
  }

  function installStageRuleBehavior(){
    const hud = document.getElementById("stageRuleHud");
    const name = document.getElementById("stageRuleName");
    const text = document.getElementById("stageRuleText");
    if (!hud || !name || !text) return;

    hud.tabIndex = 0;
    hud.setAttribute("role", "status");
    hud.setAttribute("aria-live", "polite");

    let previous = "";
    let collapseTimer = 0;
    const expand = () => {
      hud.classList.add("is-expanded");
      clearTimeout(collapseTimer);
      collapseTimer = window.setTimeout(() => hud.classList.remove("is-expanded"), RULE_EXPANDED_MS);
    };

    const inspect = () => {
      const signature = `${name.textContent}\n${text.textContent}`;
      if (signature && signature !== previous){
        previous = signature;
        expand();
      }
    };
    inspect();
    window.setInterval(inspect, 250);
  }

  function installControlsHint(){
    const hint = document.getElementById("controlsHint");
    const dock = document.getElementById("pauseBtnWrap");
    if (!hint || !dock) return;

    let hideTimer = 0;
    const show = (duration = HINT_VISIBLE_MS) => {
      clearTimeout(hideTimer);
      hint.classList.remove("hint-hidden");
      hint.classList.add("hint-visible");
      hideTimer = window.setTimeout(() => {
        hint.classList.remove("hint-visible");
        hint.classList.add("hint-hidden");
      }, duration);
    };
    const hideSoon = () => {
      clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        hint.classList.remove("hint-visible");
        hint.classList.add("hint-hidden");
      }, 900);
    };

    const help = document.createElement("button");
    help.id = "controlsHelpBtn";
    help.type = "button";
    help.textContent = "?";
    help.title = "操作方法を表示";
    help.setAttribute("aria-label", "操作方法を表示");
    help.addEventListener("click", () => show(5000));
    dock.appendChild(help);

    window.addEventListener("keydown", event => {
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(String(event.key).toLowerCase())) hideSoon();
    });

    const startGame = Game.prototype.startGame;
    Game.prototype.startGame = function(...args){
      const result = startGame.apply(this, args);
      window.setTimeout(() => show(), 120);
      return result;
    };
    hint.classList.add("hint-hidden");
  }

  function installToastTiming(){
    const showSystemToast = Game.prototype.showSystemToast;
    if (typeof showSystemToast !== "function") return;
    Game.prototype.showSystemToast = function(...args){
      const result = showSystemToast.apply(this, args);
      clearTimeout(this._upgradeToastTimer);
      this._upgradeToastTimer = window.setTimeout(() => {
        const toast = document.getElementById("upgradeToast");
        toast?.classList.remove("show");
        toast?.classList.add("hidden");
      }, 3150);
      return result;
    };
  }

  function installVersionLabel(){
    const version = document.getElementById("gameVersion");
    const dock = document.getElementById("pauseBtnWrap");
    if (!version) return;
    version.textContent = `VER. ${window.__VOID_SURVIVORS_VERSION || READABILITY_VERSION}`;
    version.title = "VOID SURVIVORS build version";
    if (dock){
      const help = document.getElementById("controlsHelpBtn");
      dock.insertBefore(version, help || null);
    }
  }


  function installStylePriority(){
    const link = document.querySelector('link[href="assets/css/combat-readability.css"]');
    if (link && link.parentNode === document.head) document.head.appendChild(link);
  }

  function install(){
    if (document.body.classList.contains("combat-readability-ready")) return;
    document.body.classList.add("combat-readability-ready");
    installStylePriority();
    installPlayerRenderer();
    installBackgroundCalming();
    installBuildPanel();
    installStageRuleBehavior();
    installControlsHint();
    installToastTiming();
    installVersionLabel();
  }

  window.addEventListener("load", install, {once:true});
})();
