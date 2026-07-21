"use strict";

(() => {
  const STYLE_ID = "void-selection-screen-layout";
  const MANAGED_CARD_SELECTOR = ".upgrade-card.abyss-power-card";

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
