"use strict";

(() => {
  const CACHE_SCALE = 0.5;
  const CACHE_MARGIN = 220;
  const CACHE_REFRESH_DISTANCE = 150;
  const LANDMARK_COUNT = 28;

  function resetContext(ctx){
    ctx.setTransform(1,0,0,1,0,0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "rgba(0,0,0,0)";
    ctx.lineWidth = 1;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  function drawStageMotif(ctx, motif, x, y, size, color, secondary, seed){
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(seed*Math.PI*2);
    ctx.fillStyle = color;
    ctx.strokeStyle = secondary;
    ctx.lineWidth = Math.max(1,size*.06);

    if (motif === "cell"){
      ctx.beginPath();
      ctx.arc(0,0,size,0,Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0,0,size*.55,0,Math.PI*2);
      ctx.stroke();
    }else if (motif === "spore"){
      for (let i=0;i<5;i++){
        const angle = i/5*Math.PI*2;
        ctx.beginPath();
        ctx.arc(
          Math.cos(angle)*size*.52,
          Math.sin(angle)*size*.52,
          size*(i===0?.42:.28),
          0,
          Math.PI*2
        );
        ctx.fill();
      }
    }else if (motif === "rift"){
      ctx.beginPath();
      ctx.moveTo(-size,-size*.65);
      ctx.lineTo(-size*.25,-size*.18);
      ctx.lineTo(-size*.5,size*.25);
      ctx.lineTo(size*.15,size*.08);
      ctx.lineTo(size,size*.72);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size*.15,-size*.7);
      ctx.lineTo(size*.12,-size*.16);
      ctx.lineTo(size*.68,size*.08);
      ctx.stroke();
    }else if (motif === "eye"){
      ctx.beginPath();
      ctx.ellipse(0,0,size,size*.42,0,0,Math.PI*2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = secondary;
      ctx.beginPath();
      ctx.arc(0,0,size*.22,0,Math.PI*2);
      ctx.fill();
    }else{
      for (let i=0;i<5;i++){
        const angle = i/5*Math.PI*2;
        ctx.save();
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0,-size*.48,size*.28,size*.66,0,0,Math.PI*2);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  function drawBackground(game, ctx, originX, originY, width, height, stage){
    const st = STAGE_VISUALS[stage];
    const elapsed = game.elapsed || 0;

    resetContext(ctx);
    ctx.setTransform(CACHE_SCALE,0,0,CACHE_SCALE,0,0);

    const base = ctx.createLinearGradient(0,0,width,height);
    base.addColorStop(0,st.bg0);
    base.addColorStop(.55,st.floor);
    base.addColorStop(1,st.bg1);
    ctx.fillStyle = base;
    ctx.fillRect(0,0,width,height);

    const ambient = ctx.createLinearGradient(0,height,0,0);
    ambient.addColorStop(0,rgba(st.accent,.16));
    ambient.addColorStop(.5,rgba("#fff7dc",.025));
    ambient.addColorStop(1,rgba(st.accent2,.12));
    ctx.fillStyle = ambient;
    ctx.fillRect(0,0,width,height);

    const nebula = [
      {x:560,y:640,r:620,c:st.danger,a:.18},
      {x:3350,y:820,r:760,c:st.accent,a:.15},
      {x:3100,y:3300,r:850,c:st.fog,a:.2},
      {x:950,y:3200,r:690,c:st.accent2,a:.13}
    ];

    for (const field of nebula){
      const x = field.x-originX;
      const y = field.y-originY;
      if (
        x+field.r < 0 ||
        x-field.r > width ||
        y+field.r < 0 ||
        y-field.r > height
      ){
        continue;
      }

      const gradient = ctx.createRadialGradient(x,y,0,x,y,field.r);
      gradient.addColorStop(0,rgba(field.c,field.a));
      gradient.addColorStop(.55,rgba(field.c,field.a*.45));
      gradient.addColorStop(1,rgba(field.c,0));
      ctx.fillStyle = gradient;
      ctx.fillRect(
        Math.max(0,x-field.r),
        Math.max(0,y-field.r),
        Math.min(width,field.r*2),
        Math.min(height,field.r*2)
      );
    }

    ctx.save();
    ctx.translate(-originX,-originY);
    ctx.lineCap = "round";

    for (let lane=0;lane<3;lane++){
      ctx.beginPath();
      for (let i=0;i<=42;i++){
        const worldX = i/42*CONFIG.MAP_W;
        const worldY =
          650+lane*1280+
          Math.sin(i*.52+lane*2.1)*210+
          Math.sin(i*.17+stage*.8)*55;

        if (i===0) ctx.moveTo(worldX,worldY);
        else ctx.lineTo(worldX,worldY);
      }

      ctx.strokeStyle = rgba(
        lane===1 ? st.accent2 : st.accent,
        .08
      );
      ctx.lineWidth = 96-lane*10;
      ctx.stroke();

      ctx.strokeStyle = rgba(
        lane===1 ? st.accent : st.accent2,
        .3
      );
      ctx.lineWidth = 3;
      ctx.setLineDash([28,34]);
      ctx.lineDashOffset = -(stage+1)*13;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const centerX = CONFIG.MAP_W/2;
    const centerY = CONFIG.MAP_H/2;
    for (let ring=0;ring<8;ring++){
      const radius = 260+ring*245;
      ctx.beginPath();
      for (let i=0;i<=72;i++){
        const angle = i/72*Math.PI*2;
        const wobble =
          Math.sin(angle*(4+ring%3)+ring*.9)*22+
          Math.sin(angle*11-ring)*8;
        const x = centerX+Math.cos(angle)*(radius+wobble);
        const y = centerY+Math.sin(angle)*(radius+wobble);
        if (i===0) ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
      }
      ctx.closePath();
      ctx.strokeStyle = ring%3===0
        ? rgba(st.accent2,.22)
        : rgba(st.accent,.12);
      ctx.lineWidth = ring%3===0 ? 3 : 1.5;
      ctx.stroke();
    }

    ctx.restore();

    const cell = 150;
    const gx0 = Math.floor(originX/cell)-2;
    const gy0 = Math.floor(originY/cell)-2;
    const gx1 = Math.ceil((originX+width)/cell)+2;
    const gy1 = Math.ceil((originY+height)/cell)+2;

    for (let gy=gy0;gy<=gy1;gy++){
      for (let gx=gx0;gx<=gx1;gx++){
        const random = U.hash(gx,gy);
        if (random>=.24) continue;

        const x = gx*cell+cell*.5-originX;
        const y = gy*cell+cell*.5-originY;
        const size = 13+random*34;
        drawStageMotif(
          ctx,
          st.motif,
          x,
          y,
          size,
          rgba(
            [st.accent,st.accent2,st.danger,st.fog][Math.floor(random*100)%4],
            .1+.12*U.hash(gx+7,gy-4)
          ),
          rgba("#fff7dc",.2),
          random
        );
      }
    }

    for (let i=0;i<LANDMARK_COUNT;i++){
      const x = 90+U.hash(i+41,stage+13)*(CONFIG.MAP_W-180)-originX;
      const y = 90+U.hash(i+99,stage+31)*(CONFIG.MAP_H-180)-originY;
      const radius = 48+U.hash(i+5,103)*105;

      if (
        x+radius < 0 ||
        x-radius > width ||
        y+radius < 0 ||
        y-radius > height
      ){
        continue;
      }

      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(U.hash(i+21,43)*Math.PI*2);
      ctx.strokeStyle = rgba(i%2 ? st.accent : st.accent2,.28);
      ctx.fillStyle = rgba(i%3 ? st.fog : st.danger,.08);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0,0,radius,0,Math.PI*2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0,0,radius*.62,0,Math.PI*2);
      ctx.stroke();

      for (let tick=0;tick<10;tick++){
        const angle = tick/10*Math.PI*2;
        ctx.beginPath();
        ctx.moveTo(
          Math.cos(angle)*radius*.72,
          Math.sin(angle)*radius*.72
        );
        ctx.lineTo(
          Math.cos(angle)*radius,
          Math.sin(angle)*radius
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(-originX,-originY);
    ctx.strokeStyle = rgba(st.danger,.8);
    ctx.lineWidth = 5;
    ctx.setLineDash([28,12,5,12]);
    ctx.lineDashOffset = -(stage+1)*17;
    ctx.strokeRect(0,0,CONFIG.MAP_W,CONFIG.MAP_H);
    ctx.restore();

    ctx.fillStyle = rgba("#fff7dc",.18);
    for (let i=0;i<44;i++){
      const worldX = U.hash(i,stage+71)*CONFIG.MAP_W;
      const worldY = U.hash(i+9,stage+77)*CONFIG.MAP_H;
      const x = worldX-originX;
      const y = worldY-originY;
      if (x<0||x>width||y<0||y>height) continue;
      const radius = .8+U.hash(i+17,stage+3)*1.8;
      ctx.beginPath();
      ctx.arc(x,y,radius,0,Math.PI*2);
      ctx.fill();
    }

    ctx.fillStyle = rgba(st.accent,.035+.01*Math.sin(elapsed*.1));
    ctx.fillRect(0,0,width,height);
  }

  function ensureGroundCache(game, cam, width, height){
    const stage = stageIndexForTime(game.elapsed||0);
    const logicalWidth = Math.ceil(width+CACHE_MARGIN*2);
    const logicalHeight = Math.ceil(height+CACHE_MARGIN*2);
    const pixelWidth = Math.max(1,Math.round(logicalWidth*CACHE_SCALE));
    const pixelHeight = Math.max(1,Math.round(logicalHeight*CACHE_SCALE));
    let cache = game._visualGroundCache;

    const needsCanvas =
      !cache ||
      !cache.canvas ||
      cache.canvas.width!==pixelWidth ||
      cache.canvas.height!==pixelHeight;

    const needsRefresh =
      needsCanvas ||
      cache.stage!==stage ||
      Math.abs(cam.x-cache.anchorX)>CACHE_REFRESH_DISTANCE ||
      Math.abs(cam.y-cache.anchorY)>CACHE_REFRESH_DISTANCE;

    if (!needsRefresh) return cache;

    if (!cache){
      cache = {
        canvas:document.createElement("canvas"),
        ctx:null,
        stage:-1,
        anchorX:NaN,
        anchorY:NaN,
        originX:0,
        originY:0
      };
      game._visualGroundCache = cache;
    }

    if (needsCanvas){
      cache.canvas.width = pixelWidth;
      cache.canvas.height = pixelHeight;
      cache.ctx = cache.canvas.getContext("2d",{alpha:false});
      cache.ctx.imageSmoothingEnabled = true;
    }

    cache.stage = stage;
    cache.anchorX = cam.x;
    cache.anchorY = cam.y;
    cache.originX = cam.x-CACHE_MARGIN;
    cache.originY = cam.y-CACHE_MARGIN;

    drawBackground(
      game,
      cache.ctx,
      cache.originX,
      cache.originY,
      logicalWidth,
      logicalHeight,
      stage
    );

    return cache;
  }

  function ensurePlayerLight(game){
    const stage = stageIndexForTime(game.elapsed||0);
    if (!game._visualPlayerLight){
      const canvas = document.createElement("canvas");
      canvas.width = 384;
      canvas.height = 384;
      game._visualPlayerLight = {canvas,ctx:canvas.getContext("2d"),stage:-1};
    }

    const light = game._visualPlayerLight;
    if (light.stage===stage) return light.canvas;

    const st = STAGE_VISUALS[stage];
    const center = 192;
    light.ctx.clearRect(0,0,384,384);
    const gradient = light.ctx.createRadialGradient(
      center,center,0,
      center,center,center
    );
    gradient.addColorStop(0,rgba("#fff7dc",.2));
    gradient.addColorStop(.24,rgba(st.accent,.16));
    gradient.addColorStop(.62,rgba(st.accent2,.055));
    gradient.addColorStop(1,rgba(st.accent,0));
    light.ctx.fillStyle = gradient;
    light.ctx.fillRect(0,0,384,384);
    light.stage = stage;
    return light.canvas;
  }

  Game.prototype.drawGroundCached = function(ctx,cam,width,height){
    const cache = ensureGroundCache(this,cam,width,height);
    const sourceX = Math.round((cam.x-cache.originX)*CACHE_SCALE);
    const sourceY = Math.round((cam.y-cache.originY)*CACHE_SCALE);
    const sourceWidth = Math.min(
      cache.canvas.width-sourceX,
      Math.max(1,Math.round(width*CACHE_SCALE))
    );
    const sourceHeight = Math.min(
      cache.canvas.height-sourceY,
      Math.max(1,Math.round(height*CACHE_SCALE))
    );

    ctx.drawImage(
      cache.canvas,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      width,
      height
    );

    if (this.player){
      const light = ensurePlayerLight(this);
      const diameter = 720;
      const x = this.player.x-cam.x;
      const y = this.player.y-cam.y;
      ctx.drawImage(
        light,
        x-diameter*.5,
        y-diameter*.5,
        diameter,
        diameter
      );
    }
  };

  function ensureAtmosphere(game,width,height){
    const stage = stageIndexForTime(game.elapsed||0);
    const pixelWidth = Math.max(1,Math.round(width*.35));
    const pixelHeight = Math.max(1,Math.round(height*.35));
    let cache = game._visualAtmosphere;

    if (!cache){
      const canvas = document.createElement("canvas");
      cache = {canvas,ctx:canvas.getContext("2d"),stage:-1,width:0,height:0};
      game._visualAtmosphere = cache;
    }

    if (
      cache.stage===stage &&
      cache.width===pixelWidth &&
      cache.height===pixelHeight
    ){
      return cache.canvas;
    }

    cache.canvas.width = pixelWidth;
    cache.canvas.height = pixelHeight;
    cache.width = pixelWidth;
    cache.height = pixelHeight;
    cache.stage = stage;

    const ctx = cache.ctx;
    const st = STAGE_VISUALS[stage];
    const scale = .35;
    ctx.setTransform(scale,0,0,scale,0,0);
    ctx.clearRect(0,0,width,height);

    const vignette = ctx.createRadialGradient(
      width/2,height/2,Math.min(width,height)*.28,
      width/2,height/2,Math.max(width,height)*.76
    );
    vignette.addColorStop(0,"rgba(0,0,0,0)");
    vignette.addColorStop(.72,"rgba(0,0,0,.02)");
    vignette.addColorStop(1,"rgba(0,0,0,.26)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0,0,width,height);

    const tint = ctx.createLinearGradient(0,0,0,height);
    tint.addColorStop(0,rgba(st.fog,.09));
    tint.addColorStop(.3,rgba(st.fog,0));
    tint.addColorStop(.72,rgba(st.danger,0));
    tint.addColorStop(1,rgba(st.danger,.07));
    ctx.fillStyle = tint;
    ctx.fillRect(0,0,width,height);

    return cache.canvas;
  }

  Game.prototype.drawAtmosphereOverlay = function(ctx,width,height){
    ctx.drawImage(
      ensureAtmosphere(this,width,height),
      0,
      0,
      width,
      height
    );

    if (!(this.stageTransition>0)) return;

    const st = stageVisualForTime(this.elapsed||0);
    const total = this.stageIndex===0 ? 1.9 : 2.35;
    const alpha =
      U.clamp(this.stageTransition/.42,0,1)*
      U.clamp((total-this.stageTransition)/.35,0,1);

    if (alpha<=0) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(34,height*.34);
    ctx.fillStyle = rgba("#090718",.82);
    ctx.fillRect(0,-54,320,100);
    ctx.fillStyle = st.accent;
    ctx.fillRect(0,-54,8,100);
    ctx.fillStyle = "#fff7dc";
    ctx.font = "1000 38px Arial Black, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(st.name,24,-4);
    ctx.fillStyle = st.accent2;
    ctx.font = "900 11px monospace";
    ctx.fillText(st.code+" / CHROMA ABYSS",26,24);
    ctx.restore();
  };
})();
