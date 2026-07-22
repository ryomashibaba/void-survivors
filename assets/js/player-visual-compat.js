"use strict";

/*
 * Restores the persistent-power renderer installed by abyss-systems.js after
 * combat-readability.js finishes its load-time setup. This keeps Black Sun's
 * visible body aligned with its original gameplay contact area.
 */
(() => {
  if (typeof window === "undefined" || typeof Player === "undefined") return;

  const drawAbyssPlayer = Player.prototype.draw;
  const VISUAL_VERSION = "2026.07.22-R3";

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

  function drawLocatorOverlay(player, ctx, cam){
    const x = player.x - cam.x;
    const y = player.y - cam.y;

    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#fff7dc";
    ctx.strokeStyle = "#090718";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.translate(0, -43);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(7, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-7, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function install(){
    if (Player.prototype.draw?.__abyssVisualCompat) return;

    function drawWithOriginalPowers(ctx, cam){
      drawLocatorUnderlay(this, ctx, cam);
      drawAbyssPlayer.call(this, ctx, cam);
      drawLocatorOverlay(this, ctx, cam);
    }

    drawWithOriginalPowers.__abyssVisualCompat = true;
    Player.prototype.draw = drawWithOriginalPowers;

    const style = document.querySelector('link[href="assets/css/hud-readable-scale.css"]');
    if (style && style.parentNode === document.head) document.head.appendChild(style);

    const version = document.getElementById("gameVersion");
    if (version) version.textContent = `VER. ${window.__VOID_SURVIVORS_VERSION || VISUAL_VERSION}`;
  }

  window.addEventListener("load", install, {once:true});
})();
