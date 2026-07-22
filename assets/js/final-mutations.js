"use strict";

(() => {
  if (
    typeof window === "undefined" ||
    typeof Game === "undefined" ||
    typeof pickUpgradeChoices !== "function" ||
    typeof getUpgradePreview !== "function" ||
    !window.__abyssSystems?.POWER_CATALOG
  ) {
    return;
  }

  const VERSION = 1;
  const POWER_CATALOG = window.__abyssSystems.POWER_CATALOG;
  const EVOLUTIONS = window.__abyssSystems.EVOLUTIONS || {};
  const CATEGORY_COLORS = {
    annihilation: "#ff5268",
    dominion: "#b45cff",
    motion: "#65d9ff",
    defense: "#42e8bd",
    harvest: "#ffd447",
    chaos: "#ff8a4c"
  };
  const MUTATION_COLORS = {
    collapse: "#ff5268",
    echo: "#65d9ff",
    chain: "#ffd447"
  };
  const MUTATION_LABELS = {
    collapse: "崩壊相",
    echo: "残響相",
    chain: "連鎖相"
  };
  const FINAL_PREFIX = "final:";

  function rankOf(player, id){
    return Math.max(0, Math.floor(Number(player?.upgradeRanks?.[id]) || 0));
  }

  function mutationOf(player, id){
    return player?.finalPowerMutations?.[id] || null;
  }

  function multiplyPowerDamage(player, id, multiplier){
    player.powerDamageById = player.powerDamageById || {};
    player.powerDamageById[id] = (player.powerDamageById[id] || 1) * multiplier;
  }

  function installStyles(){
    if (document.getElementById("finalMutationStyles")) return;
    const style = document.createElement("style");
    style.id = "finalMutationStyles";
    style.textContent = `
      .abyss-power-card.kind-final-mutation{
        border-width:4px;
        box-shadow:8px 8px 0 #090718, 12px 12px 0 var(--card-color);
        transform:rotate(-.35deg);
      }
      .abyss-power-card.kind-final-mutation:nth-child(even){transform:rotate(.35deg);}
      .abyss-power-card.kind-final-mutation .power-category{
        display:inline-block;
        padding:4px 8px;
        background:var(--card-color);
        color:#090718;
        font-weight:1000;
        letter-spacing:.12em;
      }
      .abyss-power-card.kind-final-mutation .power-trigger{
        border-left:6px solid var(--card-color);
        padding-left:9px;
      }
      .final-mutation-badge{
        display:inline-block;
        margin-left:7px;
        padding:2px 6px;
        border:2px solid currentColor;
        background:#090718;
        color:var(--mutation-color, #ffd447);
        font:1000 10px/1.2 monospace;
        letter-spacing:.08em;
        transform:rotate(-2deg);
      }
      .abyss-ability.has-final-mutation{
        border-left:7px solid var(--mutation-color, #ffd447);
      }
      @media (max-width:760px){
        .abyss-power-card.kind-final-mutation{box-shadow:5px 5px 0 #090718, 8px 8px 0 var(--card-color);}
        .final-mutation-badge{display:block;margin:5px 0 0;width:max-content;}
      }
    `;
    document.head.appendChild(style);
  }

  const GENERIC_MUTATIONS = [
    {
      key: "collapse",
      icon: "◆",
      label: MUTATION_LABELS.collapse,
      summary: "この権能の最終ダメージ ×1.55。単発火力とボス削りへ特化する。",
      after: "固有ダメージ ×1.55",
      apply(game, id){ multiplyPowerDamage(game.player, id, 1.55); }
    },
    {
      key: "echo",
      icon: "≋",
      label: MUTATION_LABELS.echo,
      summary: "固有ダメージ ×1.10。命中時、最大32%で同じ標的へ55%威力の残響を返す。",
      after: "固有ダメージ ×1.10 / 最大32%で55%残響",
      apply(game, id){ multiplyPowerDamage(game.player, id, 1.10); }
    },
    {
      key: "chain",
      icon: "✣",
      label: MUTATION_LABELS.chain,
      summary: "固有ダメージ ×1.12。撃破時、半径180へ直前ダメージの48%を連鎖放出する。",
      after: "固有ダメージ ×1.12 / 撃破時48%連鎖",
      apply(game, id){ multiplyPowerDamage(game.player, id, 1.12); }
    }
  ];

  const SPECIAL_MUTATIONS = {
    overdrive_contract: [
      {
        key: "critical_drive", icon: "⏩", label: "臨界駆動", color: "#65d9ff",
        summary: "全権能CD ×0.72、全権能ダメージ ×0.90。発動密度を極端に高める。",
        after: "全権能CD ×0.72 / 全権能ダメージ ×0.90",
        apply(game){ game.player.systemCooldownMul *= .72; game.player.systemDamageMul *= .90; }
      },
      {
        key: "output_conversion", icon: "◆", label: "出力転換", color: "#ff5268",
        summary: "全権能ダメージ ×1.28、全権能CD ×1.10。頻度を捨てて一撃へ変換する。",
        after: "全権能ダメージ ×1.28 / 全権能CD ×1.10",
        apply(game){ game.player.systemDamageMul *= 1.28; game.player.systemCooldownMul *= 1.10; }
      },
      {
        key: "stable_drive", icon: "⬢", label: "安定駆動", color: "#42e8bd",
        summary: "全権能CD ×0.86、最大HP ×1.18。契約の代償を耐久へ戻す。",
        after: "全権能CD ×0.86 / 最大HP ×1.18",
        apply(game){
          game.player.systemCooldownMul *= .86;
          const before = game.player.maxHp;
          game.player.maxHp = Math.max(1, Math.round(before * 1.18));
          game.player.hp = Math.min(game.player.maxHp, game.player.hp + game.player.maxHp - before);
        }
      }
    ],
    chaos_oracle: [
      {
        key: "double_oracle", icon: "?!", label: "二重神託", color: "#b45cff",
        summary: "時間発動型権能の残響率 +24%。混沌神託以外の権能も連続発動しやすくなる。",
        after: "時間発動型権能の残響率 +24%",
        apply(game){ game.player.systemEchoChance = Math.min(.65, (game.player.systemEchoChance || 0) + .24); }
      },
      {
        key: "rapid_oracle", icon: "⌛", label: "高速神託", color: "#65d9ff",
        summary: "全権能CD ×0.78、全権能ダメージ ×0.92。抽選回数を増やす。",
        after: "全権能CD ×0.78 / 全権能ダメージ ×0.92",
        apply(game){ game.player.systemCooldownMul *= .78; game.player.systemDamageMul *= .92; }
      },
      {
        key: "violent_oracle", icon: "☄", label: "暴走神託", color: "#ff5268",
        summary: "全権能ダメージ ×1.30、全権能CD ×1.08。抽選結果を巨大化する。",
        after: "全権能ダメージ ×1.30 / 全権能CD ×1.08",
        apply(game){ game.player.systemDamageMul *= 1.30; game.player.systemCooldownMul *= 1.08; }
      }
    ]
  };

  function mutationDefinitions(id){
    return SPECIAL_MUTATIONS[id] || GENERIC_MUTATIONS;
  }

  function makeMutationChoice(player, id, mutation){
    const power = POWER_CATALOG[id];
    const color = mutation.color || MUTATION_COLORS[mutation.key] || CATEGORY_COLORS[power.category] || "#ffd447";
    return {
      id: `${FINAL_PREFIX}${id}:${mutation.key}`,
      sourceId: id,
      mutationKey: mutation.key,
      kind: "final-mutation",
      name: `${power.name}・${mutation.label}`,
      icon: mutation.icon,
      category: power.category,
      color,
      desc: mutation.summary,
      trigger: "Lv.3 + 進化済み / 最終分岐・再選択不可",
      weight: 100,
      apply(game){
        const target = game.player;
        target.finalPowerMutations = target.finalPowerMutations || {};
        if (target.finalPowerMutations[id]) return;
        target.finalPowerMutations[id] = mutation.key;
        mutation.apply(game, id);
        if (game._runStats){
          game._runStats.finalMutations = game._runStats.finalMutations || [];
          game._runStats.finalMutations.push(`${id}:${mutation.key}`);
        }
      }
    };
  }

  function nextFinalMutationChoices(player){
    if (!player || player._originDraft) return [];
    player.finalPowerMutations = player.finalPowerMutations || {};
    for (const [id, power] of Object.entries(POWER_CATALOG)){
      if (rankOf(player, id) < (power.max || 3)) continue;
      if (!player.powerEvolutions?.[id]) continue;
      if (player.finalPowerMutations[id]) continue;
      return mutationDefinitions(id).map(mutation => makeMutationChoice(player, id, mutation));
    }
    return [];
  }

  function parseFinalId(id){
    if (typeof id !== "string" || !id.startsWith(FINAL_PREFIX)) return null;
    const body = id.slice(FINAL_PREFIX.length);
    const split = body.lastIndexOf(":");
    if (split <= 0) return null;
    return { powerId: body.slice(0, split), mutationKey: body.slice(split + 1) };
  }

  function mutationDefinition(powerId, mutationKey){
    return mutationDefinitions(powerId).find(item => item.key === mutationKey) || null;
  }

  const previousPickUpgradeChoices = pickUpgradeChoices;
  pickUpgradeChoices = function(player, count){
    const finals = nextFinalMutationChoices(player);
    if (finals.length) return finals.slice(0, 3);
    return previousPickUpgradeChoices(player, count);
  };

  const previousGetUpgradePreview = getUpgradePreview;
  getUpgradePreview = function(id, player){
    const parsed = parseFinalId(id);
    if (!parsed) return previousGetUpgradePreview(id, player);
    const power = POWER_CATALOG[parsed.powerId];
    const mutation = mutationDefinition(parsed.powerId, parsed.mutationKey);
    return {
      now: `${power?.name || parsed.powerId} Lv.3 / ${EVOLUTIONS[parsed.powerId]?.name || "進化済み"}`,
      after: mutation?.after || "最終変異"
    };
  };

  const previousOpenLevelUp = Game.prototype.openLevelUp;
  Game.prototype.openLevelUp = function(...args){
    const result = previousOpenLevelUp.apply(this, args);
    const choices = Array.isArray(this._levelUpChoices) ? this._levelUpChoices : [];
    const finalChoices = choices.filter(item => item?.kind === "final-mutation");
    if (!finalChoices.length) return result;

    const title = document.querySelector("#levelUpScreen .upgrade-title");
    const powerName = POWER_CATALOG[finalChoices[0].sourceId]?.name || "権能";
    if (title) title.textContent = `${powerName}：最終変異を選択`;

    const cards = document.querySelectorAll("#upgradeChoices .upgrade-card");
    cards.forEach((card, index) => {
      if (choices[index]?.kind !== "final-mutation") return;
      card.classList.remove("kind-evolution", "kind-power", "kind-synergy", "kind-utility");
      card.classList.add("kind-final-mutation");
      const category = card.querySelector(".power-category");
      if (category) category.textContent = "FINAL MUTATION";
    });

    const controls = document.querySelector("#upgradeChoices .levelup-controls");
    if (controls) controls.remove();
    return result;
  };

  const previousUpdateWeaponBarDOM = Game.prototype.updateWeaponBarDOM;
  Game.prototype.updateWeaponBarDOM = function(...args){
    const result = previousUpdateWeaponBarDOM.apply(this, args);
    const player = this.player;
    const bar = document.getElementById("weaponBar");
    if (!player || !bar) return result;

    const powerIds = Object.keys(POWER_CATALOG).filter(id => rankOf(player, id) > 0);
    const panels = Array.from(bar.querySelectorAll(".abyss-ability"));
    powerIds.forEach((id, index) => {
      const key = mutationOf(player, id);
      const panel = panels[index + 1];
      if (!key || !panel) return;
      const def = mutationDefinition(id, key);
      const color = def?.color || MUTATION_COLORS[key] || CATEGORY_COLORS[POWER_CATALOG[id]?.category] || "#ffd447";
      panel.classList.add("has-final-mutation");
      panel.style.setProperty("--mutation-color", color);
      const level = panel.querySelector(".ability-level");
      if (level && !level.querySelector(".final-mutation-badge")){
        const badge = document.createElement("span");
        badge.className = "final-mutation-badge";
        badge.style.setProperty("--mutation-color", color);
        badge.textContent = def?.label || MUTATION_LABELS[key] || "FINAL";
        level.appendChild(badge);
      }
    });
    return result;
  };

  function queueEcho(game, source, target, damage, boss){
    if (!target || target.dead || damage <= 0) return;
    const now = performance.now();
    game._finalMutationEchoGate = game._finalMutationEchoGate || {};
    if ((game._finalMutationEchoGate[source] || 0) > now) return;
    if (Math.random() >= .32) return;
    game._finalMutationEchoGate[source] = now + 120;
    game._finalMutationEchoQueue = game._finalMutationEchoQueue || [];
    if (game._finalMutationEchoQueue.length >= 24) return;
    game._finalMutationEchoQueue.push({
      delay: .13,
      source,
      target,
      boss,
      damage: Math.max(1, Math.round(damage * .55))
    });
  }

  const previousDamageEnemy = Game.prototype.damageEnemy;
  Game.prototype.damageEnemy = function(enemy, damage, crit){
    if (!enemy || enemy.dead) return previousDamageEnemy.call(this, enemy, damage, crit);
    const source = this._damageSource;
    const mutation = mutationOf(this.player, source);
    const wasAlive = !enemy.dead;
    const x = enemy.x;
    const y = enemy.y;
    const result = previousDamageEnemy.call(this, enemy, damage, crit);

    if (!mutation || this._finalMutationProc) return result;
    if (mutation === "echo" && !enemy.dead) queueEcho(this, source, enemy, damage, false);

    if (mutation === "chain" && wasAlive && enemy.dead){
      this._finalMutationProc = true;
      const previousSource = this._damageSource;
      this._damageSource = source;
      try{
        const radius = 180;
        const splash = Math.max(1, Math.round(damage * .48));
        let hits = 0;
        if (typeof ShockwaveEffect !== "undefined") this.addEffect(new ShockwaveEffect(x, y, MUTATION_COLORS.chain, radius, .38, {inner:18, fill:true}));
        for (const other of this.enemies){
          if (other.dead || other === enemy) continue;
          if (U.dist2(x, y, other.x, other.y) > Math.pow(radius + other.radius, 2)) continue;
          previousDamageEnemy.call(this, other, splash, false);
          if (++hits >= 8) break;
        }
        if (this.boss && !this.boss.dead && U.dist2(x, y, this.boss.x, this.boss.y) <= Math.pow(radius + this.boss.radius, 2)){
          previousDamageBoss.call(this, splash, false);
        }
      } finally {
        this._damageSource = previousSource;
        this._finalMutationProc = false;
      }
    }
    return result;
  };

  const previousDamageBoss = Game.prototype.damageBoss;
  Game.prototype.damageBoss = function(damage, crit){
    const boss = this.boss;
    const source = this._damageSource;
    const mutation = mutationOf(this.player, source);
    const result = previousDamageBoss.call(this, damage, crit);
    if (mutation === "echo" && boss && !boss.dead && !this._finalMutationProc){
      queueEcho(this, source, boss, damage, true);
    }
    return result;
  };

  const previousGameUpdate = Game.prototype.update;
  Game.prototype.update = function(dt){
    const result = previousGameUpdate.call(this, dt);
    const queue = this._finalMutationEchoQueue;
    if (!Array.isArray(queue) || !queue.length) return result;

    for (let index = queue.length - 1; index >= 0; index--){
      const item = queue[index];
      item.delay -= dt;
      if (item.delay > 0) continue;
      queue.splice(index, 1);
      if (this.state !== "playing" || !item.target || item.target.dead) continue;

      const previousSource = this._damageSource;
      this._damageSource = item.source;
      this._finalMutationProc = true;
      try{
        if (typeof ImpactEffect !== "undefined") this.addEffect(new ImpactEffect(item.target.x, item.target.y, MUTATION_COLORS.echo, 34, .24, 0, true));
        if (item.boss) previousDamageBoss.call(this, item.damage, false);
        else previousDamageEnemy.call(this, item.target, item.damage, false);
      } finally {
        this._finalMutationProc = false;
        this._damageSource = previousSource;
      }
    }
    return result;
  };

  installStyles();

  window.__finalMutations = {
    version: VERSION,
    nextChoices: nextFinalMutationChoices,
    validate(){
      const problems = [];
      for (const [id, power] of Object.entries(POWER_CATALOG)){
        if (!power?.name || !power?.max) problems.push(`invalid power ${id}`);
        if (!mutationDefinitions(id).length) problems.push(`missing mutations ${id}`);
      }
      return {ok: problems.length === 0, problems, powerCount: Object.keys(POWER_CATALOG).length};
    }
  };
})();
