"use strict";

(() => {
  const STYLE_ID = "void-selection-screen-layout";
  const MANAGED_CARD_SELECTOR = ".upgrade-card.abyss-power-card";

  const POWER_INFO = {
    solar_funeral: { name: "太陽葬送砲", category: "annihilation" },
    world_cutter: { name: "世界断ち", category: "annihilation" },
    storm_throne: { name: "雷帝の玉座", category: "annihilation" },
    gravity_coffin: { name: "重力棺", category: "dominion" },
    meteor_scripture: { name: "流星聖典", category: "annihilation" },
    razor_constellation: { name: "刃星座", category: "motion" },
    comet_wake: { name: "彗星航跡", category: "motion" },
    mirror_legion: { name: "鏡像軍団", category: "motion" },
    void_choir: { name: "虚無聖歌", category: "annihilation" },
    doom_bloom: { name: "終末開花", category: "annihilation" },
    black_sun: { name: "黒い太陽", category: "dominion" },
    time_execution: { name: "時間処刑", category: "dominion" },
    leviathan_shell: { name: "巨獣殻", category: "defense" },
    blood_eclipse: { name: "血蝕皆既", category: "defense" },
    hunter_verdict: { name: "狩神判決", category: "dominion" },
    prism_web: { name: "プリズム蜘蛛網", category: "dominion" },
    chaos_oracle: { name: "混沌神託", category: "chaos" },
    treasure_singularity: { name: "宝物特異点", category: "harvest" },
    overdrive_contract: { name: "過剰駆動契約", category: "chaos" },
    abyss_banquet: { name: "深淵饗宴", category: "harvest" }
  };

  const RELIC_RELATIONS = {
    "空白王座": {
      mode: "global",
      detail: "権能枠を増やし、新しい系統を追加できる"
    },
    "進化核": {
      mode: "evolution"
    },
    "殲滅封印": {
      mode: "category",
      category: "annihilation",
      label: "殲滅権能"
    },
    "支配封印": {
      mode: "category",
      category: "dominion",
      label: "支配権能"
    },
    "機動封印": {
      mode: "category",
      category: "motion",
      label: "機動権能"
    },
    "不滅封印": {
      mode: "global",
      detail: "最大HPと被ダメージ軽減を強化する"
    },
    "残響プリズム": {
      mode: "powers",
      powers: [
        "solar_funeral", "world_cutter", "storm_throne", "gravity_coffin",
        "meteor_scripture", "mirror_legion", "void_choir", "time_execution",
        "prism_web", "chaos_oracle"
      ],
      targetLabel: "時間発動型権能"
    },
    "欠けた時計": {
      mode: "all",
      detail: "所持中の全権能の再発動を高速化する"
    },
    "選別行列": {
      mode: "global",
      detail: "リロールと除外を増やす選択支援"
    },
    "財宝方位器": {
      mode: "powers",
      powers: ["treasure_singularity"],
      targetLabel: "宝箱系権能"
    },
    "血流機関": {
      mode: "powers",
      powers: ["blood_eclipse"],
      targetLabel: "瀕死・逆転系権能"
    },
    "蠕界心臓": {
      mode: "powers",
      powers: ["razor_constellation", "comet_wake"],
      targetLabel: "刃星座・彗星航跡"
    },
    "骨王冠": {
      mode: "powers",
      powers: ["leviathan_shell"],
      targetLabel: "防壁系権能",
      indirectDetail: "最大HP強化は現在のビルドにも有効"
    },
    "嵐喰らいの眼": {
      mode: "powers",
      powers: ["storm_throne"],
      targetLabel: "雷帝の玉座",
      indirectDetail: "全権能CD短縮は現在のビルドにも有効"
    },
    "終焉印章": {
      mode: "synergy",
      detail: "進化核と共鳴威力を強化する"
    },
    "深淵配当": {
      mode: "global",
      detail: "ラン終了時の深淵片獲得量を増やす"
    }
  };

  /*
   * stability-fix.js は古いカードの二重選択を document の capture で防ぐ。
   * このモジュールを stability-fix.js より前に読み込み、クリックイベントの
   * 同じ capture フェーズで新カードを一時的に管理対象として印付けする。
   * これにより古いロックが先に立たず、abyss-systems.js 側の選択処理が動く。
   */
  document.addEventListener("click", event => {
    const target = event.target;
    const card =
      target && typeof target.closest === "function"
        ? target.closest(MANAGED_CARD_SELECTOR)
        : null;

    if (!card) return;

    card.classList.add("rebirth-card");
    setTimeout(() => card.classList.remove("rebirth-card"), 0);
  }, true);

  function powerRank(player, id){
    return Number(player?.upgradeRanks?.[id]) || 0;
  }

  function ownedPowerLabels(player, ids){
    return ids
      .filter(id => powerRank(player, id) > 0)
      .map(id => `${POWER_INFO[id].name} Lv.${powerRank(player, id)}`);
  }

  function allOwnedPowerLabels(player){
    return Object.keys(POWER_INFO)
      .filter(id => powerRank(player, id) > 0)
      .map(id => `${POWER_INFO[id].name} Lv.${powerRank(player, id)}`);
  }

  function rewardRelation(name, player){
    const relation = RELIC_RELATIONS[name];
    if (!relation) return null;

    if (relation.mode === "global"){
      return {
        kind: "indirect",
        title: "全ビルド共通",
        detail: relation.detail
      };
    }

    if (relation.mode === "all"){
      const owned = allOwnedPowerLabels(player);
      return owned.length
        ? {
            kind: "direct",
            title: "所持中の全権能に有効",
            detail: `${owned.length}種の権能を強化`
          }
        : {
            kind: "future",
            title: "権能取得後に有効",
            detail: relation.detail
          };
    }

    if (relation.mode === "category"){
      const ids = Object.keys(POWER_INFO).filter(
        id => POWER_INFO[id].category === relation.category
      );
      const owned = ownedPowerLabels(player, ids);
      return owned.length
        ? {
            kind: "direct",
            title: "所持中の権能を直接強化",
            detail: owned.join(" / ")
          }
        : {
            kind: "future",
            title: `対象の${relation.label}は未取得`,
            detail: ids.map(id => POWER_INFO[id].name).join(" / ")
          };
    }

    if (relation.mode === "powers"){
      const owned = ownedPowerLabels(player, relation.powers);
      if (owned.length){
        return {
          kind: "direct",
          title: "所持中の権能を直接強化",
          detail: owned.join(" / ")
        };
      }
      if (relation.indirectDetail){
        return {
          kind: "indirect",
          title: "対象権能は未取得",
          detail: `${relation.targetLabel}向け / ${relation.indirectDetail}`
        };
      }
      return {
        kind: "future",
        title: "対象権能は未取得",
        detail: relation.powers.map(id => POWER_INFO[id].name).join(" / ")
      };
    }

    if (relation.mode === "evolution"){
      const owned = Object.keys(POWER_INFO).filter(id => powerRank(player, id) > 0);
      const evolvable = owned.filter(
        id => powerRank(player, id) >= 3 && !player?.powerEvolutions?.[id]
      );
      if (evolvable.length){
        return {
          kind: "direct",
          title: "現在の権能を進化可能",
          detail: evolvable.map(id => `${POWER_INFO[id].name} Lv.3`).join(" / ")
        };
      }
      return owned.length
        ? {
            kind: "indirect",
            title: "所持権能の進化準備",
            detail: "Lv.3到達後に進化へ使用できる"
          }
        : {
            kind: "future",
            title: "権能取得後に使用",
            detail: "Lv.3権能を最終形態へ進化させる"
          };
    }

    if (relation.mode === "synergy"){
      const synergyCount = Object.keys(player?.powerSynergies || {}).length;
      return synergyCount > 0
        ? {
            kind: "direct",
            title: "現在の共鳴を直接強化",
            detail: `成立中の共鳴 ${synergyCount}種 / ${relation.detail}`
          }
        : {
            kind: "indirect",
            title: "共鳴成立後に有効",
            detail: relation.detail
          };
    }

    return null;
  }

  function annotateBossRewards(){
    const game = window.__game;
    const player = game?.player;
    const choices = document.getElementById("rewardChoices");
    const title = document.getElementById("rewardTitle");

    if (!player || !choices || title?.textContent !== "王の遺産を選択") return;

    choices.querySelectorAll(".abyss-reward-card").forEach(card => {
      card.querySelector(".reward-build-fit")?.remove();
      card.classList.remove(
        "build-fit-direct",
        "build-fit-indirect",
        "build-fit-future"
      );

      const name = card.querySelector(".reward-name")?.textContent?.trim();
      const relation = rewardRelation(name, player);
      if (!relation) return;

      const fit = document.createElement("span");
      fit.className = `reward-build-fit fit-${relation.kind}`;

      const heading = document.createElement("strong");
      heading.textContent = relation.title;
      const detail = document.createElement("small");
      detail.textContent = relation.detail;

      fit.append(heading, detail);
      card.appendChild(fit);
      card.classList.add(`build-fit-${relation.kind}`);
    });
  }

  function bindBossRewardObserver(){
    const choices = document.getElementById("rewardChoices");
    if (!choices || choices.dataset.buildRelationBound === "1") return;

    choices.dataset.buildRelationBound = "1";
    const observer = new MutationObserver(() => {
      requestAnimationFrame(annotateBossRewards);
    });
    observer.observe(choices, { childList: true });
    annotateBossRewards();
  }

  const bindWhenReady = () => setTimeout(bindBossRewardObserver, 0);
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bindWhenReady, { once: true });
  } else {
    bindWhenReady();
  }

  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #levelUpScreen{
      align-items:flex-start!important;
      padding:14px 18px 12px!important;
      overflow:hidden!important;
    }

    #levelUpScreen>div{
      width:min(1580px,calc(100vw - 36px))!important;
      max-width:none!important;
      min-width:0;
    }

    #levelUpScreen .upgrade-title{
      margin:0 0 10px!important;
      padding:0 4px;
      font-size:clamp(36px,3.2vw,52px)!important;
      line-height:1!important;
    }

    #levelUpScreen .upgrade-choices{
      width:100%;
      grid-template-columns:repeat(4,minmax(0,1fr))!important;
      gap:14px!important;
      align-items:stretch;
      max-height:none!important;
      overflow:visible!important;
      padding:10px 8px 8px!important;
    }

    #levelUpScreen .upgrade-card.abyss-power-card{
      min-width:0;
      min-height:0!important;
      height:clamp(430px,calc(100vh - 190px),590px);
      padding:20px 18px 62px!important;
      overflow:hidden;
    }

    #levelUpScreen .abyss-power-card .power-category{
      margin-bottom:8px;
      padding:5px 8px;
      font-size:11px;
    }

    #levelUpScreen .abyss-power-card .upgrade-icon{
      margin-bottom:12px;
      font-size:52px;
      line-height:1;
    }

    #levelUpScreen .abyss-power-card .upgrade-name{
      margin-bottom:9px;
      font-size:clamp(20px,1.55vw,26px);
      line-height:1.18;
    }

    #levelUpScreen .abyss-power-card .power-trigger{
      margin-bottom:8px;
      font-size:12px;
      line-height:1.4;
    }

    #levelUpScreen .abyss-power-card .upgrade-desc{
      font-size:14px;
      line-height:1.55;
    }

    #levelUpScreen .abyss-power-card .upgrade-current{
      margin-top:11px;
      margin-bottom:42px;
      padding:9px 10px;
      font-size:12px;
      line-height:1.45;
    }

    #levelUpScreen .abyss-power-card .upgrade-current .after{
      font-size:13px;
      line-height:1.4;
    }

    #levelUpScreen .abyss-power-card::after{
      max-width:64%;
      font-size:10px;
      line-height:1.25;
    }

    #levelUpScreen .levelup-controls{
      margin-top:0;
    }

    #levelUpScreen .levelup-reroll{
      min-width:260px;
      padding:10px 18px;
      font-size:15px;
    }

    .reward-build-fit{
      display:block;
      margin-top:15px;
      padding:10px 11px;
      border:3px solid var(--abyss-ink,#100b24);
      text-align:left;
      box-shadow:4px 4px 0 var(--abyss-ink,#100b24);
    }

    .reward-build-fit strong{
      display:block;
      margin-bottom:5px;
      font:1000 12px/1.2 "Arial Black","Yu Gothic UI",sans-serif;
    }

    .reward-build-fit small{
      display:block;
      font:900 10px/1.45 "Yu Gothic UI",sans-serif;
    }

    .reward-build-fit.fit-direct{
      background:#42e8bd;
      color:#100b24;
    }

    .reward-build-fit.fit-indirect{
      background:#ffd447;
      color:#100b24;
    }

    .reward-build-fit.fit-future{
      background:#eadfff;
      color:#4e3b62;
      border-style:dashed;
    }

    .abyss-reward-card.build-fit-direct{
      box-shadow:10px 10px 0 #42e8bd!important;
    }

    .abyss-reward-card.build-fit-indirect{
      box-shadow:10px 10px 0 #ffd447!important;
    }

    .abyss-reward-card.build-fit-future{
      opacity:.9;
    }

    @media (max-width:1179px){
      #levelUpScreen{
        overflow:auto!important;
      }

      #levelUpScreen .upgrade-choices{
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        max-height:none!important;
        overflow:visible!important;
      }

      #levelUpScreen .upgrade-card.abyss-power-card{
        height:auto;
        min-height:380px!important;
      }
    }

    @media (max-width:780px){
      #levelUpScreen{
        padding:10px 10px 18px!important;
      }

      #levelUpScreen>div{
        width:100%!important;
      }

      #levelUpScreen .upgrade-title{
        font-size:clamp(28px,8vw,40px)!important;
      }

      #levelUpScreen .upgrade-choices{
        grid-template-columns:1fr!important;
        padding:8px 5px 18px!important;
      }

      #levelUpScreen .upgrade-card.abyss-power-card{
        min-height:0!important;
        padding-bottom:64px!important;
      }
    }
  `;
  document.head.appendChild(style);
})();
