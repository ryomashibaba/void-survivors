"use strict";

/*
 * VOID SURVIVORS: ABYSS SYSTEMS
 *
 * CHROMA REBIRTH の権能・敵AI・永続成長を統合し、
 * ビルド枠 / 進化 / 共鳴、固有ボス、ステージルール、報酬、
 * 深淵層、戦闘統計、設定、軽量な自動生成BGMを一つの責務層にまとめる。
 */
(() => {
  if (
    typeof window === "undefined" ||
    typeof Game === "undefined" ||
    typeof Player === "undefined" ||
    typeof Enemy === "undefined" ||
    typeof Boss === "undefined"
  ) {
    return;
  }

  const SYSTEM_VERSION = 3;
  const SAVE_KEY = "void_survivors_records";
  const MAX_ABYSS_LAYER = 12;
  const BASE_POWER_SLOTS = 5;
  const BASE_REROLLS = 1;
  const MAX_RUN_HISTORY = 10;

  if (typeof CONFIG.EXPLOSION_DAMAGE_RATIO === "number") {
    CONFIG.EXPLOSION_DAMAGE_RATIO = Math.min(CONFIG.EXPLOSION_DAMAGE_RATIO,.06);
  }

  const CATEGORY_INFO = {
    annihilation: { label: "殲滅権能", color: "#ff5268", icon: "☄" },
    dominion: { label: "支配現象", color: "#b45cff", icon: "◉" },
    motion: { label: "機動兵装", color: "#65d9ff", icon: "↗" },
    defense: { label: "不滅機構", color: "#42e8bd", icon: "⬢" },
    harvest: { label: "深淵収奪", color: "#ffd447", icon: "▣" },
    chaos: { label: "混沌契約", color: "#ff8a4c", icon: "?" }
  };

  const POWER_CATALOG = {
    solar_funeral: {
      name: "太陽葬送砲", icon: "☀", category: "annihilation", max: 3,
      tags: ["blast", "fire", "area"],
      desc: "機体を中心に二重衝撃波を放ち、接近した群れを焼き払う。"
    },
    world_cutter: {
      name: "世界断ち", icon: "╱", category: "annihilation", max: 3,
      tags: ["beam", "line", "precision"],
      desc: "最も近い敵へ、画面を横断する巨大な斬撃を放つ。"
    },
    storm_throne: {
      name: "雷帝の玉座", icon: "⚡", category: "annihilation", max: 3,
      tags: ["lightning", "multi", "chain"],
      desc: "周囲の多数の敵へ同時落雷を行い、散開した群れも刈る。"
    },
    gravity_coffin: {
      name: "重力棺", icon: "◉", category: "dominion", max: 3,
      tags: ["gravity", "control", "blast"],
      desc: "敵の密集地点へ吸引場を設置し、収束後に爆縮させる。"
    },
    meteor_scripture: {
      name: "流星聖典", icon: "☄", category: "annihilation", max: 3,
      tags: ["meteor", "fire", "delayed"],
      desc: "複数の標的へ予告を刻み、巨大流星を同時落下させる。"
    },
    razor_constellation: {
      name: "刃星座", icon: "✦", category: "motion", max: 3,
      tags: ["blade", "orbit", "contact"],
      desc: "巨大な刃を常時公転させ、近距離の敵を連続切断する。"
    },
    comet_wake: {
      name: "彗星航跡", icon: "➤", category: "motion", max: 3,
      tags: ["movement", "mine", "blast"],
      desc: "移動した軌跡へ爆縮弾を残し、追跡する敵を迎撃する。"
    },
    mirror_legion: {
      name: "鏡像軍団", icon: "◇◇", category: "motion", max: 3,
      tags: ["summon", "multi", "beam"],
      desc: "機体の周囲へ鏡像を展開し、別々の敵へ瞬間砲撃する。"
    },
    void_choir: {
      name: "虚無聖歌", icon: "✺", category: "annihilation", max: 3,
      tags: ["beam", "radial", "area"],
      desc: "全方向へ巨大な光条を放射し、敵列をまとめて貫く。"
    },
    doom_bloom: {
      name: "終末開花", icon: "❋", category: "annihilation", max: 3,
      tags: ["kill", "chain", "multi"],
      desc: "一定数の撃破ごとに、死体位置から花弁砲撃を連鎖させる。"
    },
    black_sun: {
      name: "黒い太陽", icon: "●", category: "dominion", max: 3,
      tags: ["orbit", "burn", "contact"],
      desc: "外周を公転する黒い恒星が、接触した敵を継続的に焼く。"
    },
    time_execution: {
      name: "時間処刑", icon: "⌛", category: "dominion", max: 3,
      tags: ["time", "control", "burst"],
      desc: "敵と敵弾を停止し、停止終了時に全敵へ同時ダメージを与える。"
    },
    leviathan_shell: {
      name: "巨獣殻", icon: "⬢", category: "defense", max: 3,
      tags: ["shield", "counter", "blast"],
      desc: "一定間隔で被弾を無効化する殻を再生し、破壊時に反撃する。"
    },
    blood_eclipse: {
      name: "血蝕皆既", icon: "◒", category: "defense", max: 3,
      tags: ["lowhp", "invincible", "pulse"],
      desc: "瀕死時に自動覚醒し、無敵化しながら衝撃波を連射する。"
    },
    hunter_verdict: {
      name: "狩神判決", icon: "†", category: "dominion", max: 3,
      tags: ["kill", "execute", "boss"],
      desc: "撃破を重ねると高HPの敵を処刑し、ボスへ割合損傷を与える。"
    },
    prism_web: {
      name: "プリズム蜘蛛網", icon: "⌗", category: "dominion", max: 3,
      tags: ["beam", "control", "multi"],
      desc: "複数の敵を光線で結び、線に触れた敵まで切り裂く。"
    },
    chaos_oracle: {
      name: "混沌神託", icon: "?", category: "chaos", max: 3,
      tags: ["random", "echo", "contract"],
      desc: "複数の殲滅権能から一つを高頻度でランダム発動する。"
    },
    treasure_singularity: {
      name: "宝物特異点", icon: "▣", category: "harvest", max: 3,
      tags: ["treasure", "blast", "growth"],
      desc: "宝箱取得時に財宝爆発を起こし、経験値と回復も得る。"
    },
    overdrive_contract: {
      name: "過剰駆動契約", icon: "✕", category: "chaos", max: 3,
      tags: ["contract", "cooldown", "tradeoff"],
      desc: "最大HPを代償に、すべての権能の再発動を高速化する。",
      tradeoff: true
    },
    abyss_banquet: {
      name: "深淵饗宴", icon: "♢", category: "harvest", max: 3,
      tags: ["gem", "heal", "pulse"],
      desc: "経験値ジェムを一定数集めると捕食波を放ち、HPを回復する。"
    }
  };

  const POWER_IDS = Object.keys(POWER_CATALOG);

  const EVOLUTIONS = {
    solar_funeral: { name: "双星葬送", icon: "☀☀", summary: "衝撃波が時間差で再発動する。" },
    world_cutter: { name: "終界断層", icon: "╳", summary: "主斬撃に直交する第二斬撃を追加する。" },
    storm_throne: { name: "天獄連鎖", icon: "⚡✦", summary: "落雷が近隣の敵へ追加連鎖する。" },
    gravity_coffin: { name: "特異点墓標", icon: "◎", summary: "爆縮後に小型特異点を残す。" },
    meteor_scripture: { name: "滅星聖典", icon: "☄☄", summary: "着弾地点へ灼熱領域を残す。" },
    razor_constellation: { name: "七曜断輪", icon: "✦✦", summary: "刃数と再命中性能が大きく上昇する。" },
    comet_wake: { name: "彗星墓道", icon: "➤➤", summary: "航跡弾が隣の航跡へ連鎖爆発する。" },
    mirror_legion: { name: "万華軍勢", icon: "◇◇◇", summary: "鏡像が交差砲撃を追加する。" },
    void_choir: { name: "虚無大聖堂", icon: "✺✺", summary: "角度をずらした第二斉射を行う。" },
    doom_bloom: { name: "終末花園", icon: "❋❋", summary: "花弁砲撃の撃破が次の花弁を生む。" },
    black_sun: { name: "蝕王星", icon: "●●", summary: "逆回転する第二の黒い太陽を展開する。" },
    time_execution: { name: "永劫処刑", icon: "⌛†", summary: "停止が延長され、瀕死の雑魚を終了時に処刑する。" },
    leviathan_shell: { name: "巨神反殻", icon: "⬢⬢", summary: "防壁を二重装填できる。" },
    blood_eclipse: { name: "紅月皆既", icon: "◒◒", summary: "発動閾値と衝撃波の速度が上昇する。" },
    hunter_verdict: { name: "神狩終判", icon: "††", summary: "必要撃破数が減り、ボスへの割合損傷が増える。" },
    prism_web: { name: "無限晶網", icon: "⌗⌗", summary: "蜘蛛網が短時間に二度脈動する。" },
    chaos_oracle: { name: "混沌福音", icon: "?!", summary: "抽選した権能を弱い残響付きで発動する。" },
    treasure_singularity: { name: "黄金特異界", icon: "▣✦", summary: "宝箱変異の発生率が上昇する。" },
    overdrive_contract: { name: "臨界契約", icon: "✕✕", summary: "追加高速化を得るが、最大HPの代償が固定化する。" },
    abyss_banquet: { name: "深淵大餐", icon: "♢♢", summary: "必要ジェムが減り、超過回復を一時防壁へ変換する。" }
  };

  const SYNERGIES = {
    helios_scripture: {
      name: "太陽暦聖典", icon: "☀☄", powers: ["solar_funeral", "meteor_scripture"],
      summary: "流星着弾時、太陽葬送砲の小型衝撃波を発生させる。"
    },
    frozen_thunder: {
      name: "凍雷刑場", icon: "⌛⚡", powers: ["time_execution", "storm_throne"],
      summary: "時間停止終了時、生存中の敵へ追加落雷する。"
    },
    horizon_blade: {
      name: "事象断界", icon: "◉╱", powers: ["gravity_coffin", "world_cutter"],
      summary: "重力棺の爆縮地点へ世界断ちを追撃する。"
    },
    kinetic_guillotine: {
      name: "運動断頭輪", icon: "✦➤", powers: ["razor_constellation", "comet_wake"],
      summary: "移動量に応じて刃の回転速度と威力が上昇する。"
    },
    infinite_refraction: {
      name: "無限屈折軍", icon: "◇⌗", powers: ["mirror_legion", "prism_web"],
      summary: "鏡像が蜘蛛網の追加接続点になる。"
    },
    eclipse_choir: {
      name: "蝕界聖歌", icon: "●✺", powers: ["black_sun", "void_choir"],
      summary: "虚無聖歌が黒い太陽からも補助斉射される。"
    },
    execution_garden: {
      name: "処刑花園", icon: "†❋", powers: ["hunter_verdict", "doom_bloom"],
      summary: "狩神判決が成立すると終末開花の撃破蓄積を進める。"
    },
    crimson_carapace: {
      name: "紅殻皆既", icon: "⬢◒", powers: ["leviathan_shell", "blood_eclipse"],
      summary: "巨獣殻の破壊時、短い血蝕皆既を即時発動する。"
    },
    golden_feast: {
      name: "黄金饗宴", icon: "▣♢", powers: ["treasure_singularity", "abyss_banquet"],
      summary: "宝箱取得が深淵饗宴のジェム蓄積として数えられる。"
    },
    ruin_engine: {
      name: "破滅機関", icon: "?✕", powers: ["chaos_oracle", "overdrive_contract"],
      summary: "混沌神託が低確率で二種類を連続発動する。"
    }
  };

  const CHALLENGES = {
    none: {
      name: "標準航行", reward: 1,
      desc: "追加制約なし。現在の深淵層だけが適用される。"
    },
    glass_march: {
      name: "硝子行軍", reward: 1.35,
      desc: "最大HP -35%。深淵片報酬 +35%。"
    },
    swarm_tide: {
      name: "群体潮流", reward: 1.25,
      desc: "敵出現量 +30%。深淵片報酬 +25%。"
    },
    hollow_recovery: {
      name: "空洞修復", reward: 1.3,
      desc: "宝箱の通常回復を無効化。深淵片報酬 +30%。"
    },
    boss_covenant: {
      name: "王契約", reward: 1.4,
      desc: "ボスHP・攻撃 +35%。ボス報酬候補 +1。深淵片報酬 +40%。"
    },
    one_god: {
      name: "一神教義", reward: 1.5,
      desc: "権能枠を3枠に固定。進化核を1個所持して開始。深淵片報酬 +50%。"
    }
  };

  const STAGE_RULES = [
    {
      name: "共鳴門域", icon: "◎",
      desc: "中央の門域内では経験値 +18%、権能CD -10%。敵の出現も増える。"
    },
    {
      name: "三相変色", icon: "△",
      desc: "18秒ごとに赤・青・緑の相が切り替わり、双方の性能が変化する。"
    },
    {
      name: "増殖巣", icon: "❋",
      desc: "定期的に増殖巣が出現。破壊すると宝箱と大量経験値を得る。"
    },
    {
      name: "崩壊亀裂", icon: "╳",
      desc: "予告後に亀裂が開き、一定時間その上へ継続ダメージを発生させる。"
    },
    {
      name: "深淵脈動", icon: "●",
      desc: "安全域が提示され、脈動時に安全域外へいると割合ダメージを受ける。"
    }
  ];

  const RELICS = {
    extra_slot: {
      name: "空白王座", icon: "+", color: "#65d9ff",
      desc: "権能枠 +1。新しい系統をビルドへ追加できる。",
      apply(game){ game.player.powerSlotLimit += 1; }
    },
    evolution_core: {
      name: "進化核", icon: "◇", color: "#ffd447",
      desc: "進化核 +2。Lv.3権能を最終形態へ進化できる。",
      apply(game){ game.player.evolutionCores += 2; }
    },
    annihilation_seal: {
      name: "殲滅封印", icon: "☄", color: "#ff5268",
      desc: "殲滅権能ダメージ +22%。支配権能範囲 -8%。",
      apply(game){ addCategoryModifier(game.player,"annihilation",1.22); game.player.systemAreaMul *= .92; }
    },
    dominion_seal: {
      name: "支配封印", icon: "◉", color: "#b45cff",
      desc: "支配時間・範囲 +20%。全権能ダメージ -6%。",
      apply(game){ game.player.controlDurationMul *= 1.2; game.player.systemAreaMul *= 1.2; game.player.systemDamageMul *= .94; }
    },
    motion_seal: {
      name: "機動封印", icon: "↗", color: "#65d9ff",
      desc: "移動速度 +14%。機動権能ダメージ +18%。",
      apply(game){ game.player.speed *= 1.14; addCategoryModifier(game.player,"motion",1.18); }
    },
    aegis_seal: {
      name: "不滅封印", icon: "⬢", color: "#42e8bd",
      desc: "最大HP +24%、被ダメージ -6%。",
      apply(game){ game.player.maxHp=Math.round(game.player.maxHp*1.24); game.player.hp=game.player.maxHp; game.player.damageReduction=Math.min(.72,game.player.damageReduction+.06); }
    },
    echo_prism: {
      name: "残響プリズム", icon: "◇◇", color: "#b45cff",
      desc: "時間発動型権能が18%で45%威力の残響を起こす。",
      apply(game){ game.player.systemEchoChance = Math.max(game.player.systemEchoChance||0,.18); }
    },
    rapid_clock: {
      name: "欠けた時計", icon: "⌛", color: "#ffd447",
      desc: "権能CD ×0.82、最大HP ×0.90。",
      apply(game){ game.player.systemCooldownMul*=.82; game.player.maxHp=Math.max(1,Math.round(game.player.maxHp*.9)); game.player.hp=Math.min(game.player.hp,game.player.maxHp); }
    },
    reroll_matrix: {
      name: "選別行列", icon: "↻", color: "#65d9ff",
      desc: "リロール +3、除外回数 +1。",
      apply(game){ game.player.rerolls+=3; game.player.banishes+=1; }
    },
    treasure_compass: {
      name: "財宝方位器", icon: "▣", color: "#ffd447",
      desc: "宝箱変異率 +18%、宝箱吸引範囲 +520。",
      apply(game){ game.player.treasureMutationChance+=.18; game.player.treasureMagnetRange=Math.max(game.player.treasureMagnetRange,520); }
    },
    blood_engine: {
      name: "血流機関", icon: "◒", color: "#ff5268",
      desc: "HP35%以下で権能威力 +30%、移動速度 +16%。",
      apply(game){ game.player.lowPowerBonus=(game.player.lowPowerBonus||0)+.3; game.player.lowSpeedBonus=(game.player.lowSpeedBonus||0)+.16; }
    },
    worm_heart: {
      name: "蠕界心臓", icon: "➤", color: "#ff5268", signature:0,
      desc: "ヴォイド・ワーム固有遺産。移動速度 +12%、刃星座と彗星航跡の威力 +24%。",
      apply(game){ game.player.speed*=1.12; addPowerModifier(game.player,"razor_constellation",1.24); addPowerModifier(game.player,"comet_wake",1.24); }
    },
    throne_crown: {
      name: "骨王冠", icon: "♛", color: "#ffd447", signature:1,
      desc: "骨の玉座主固有遺産。最大HP +16%、即時に防壁を2枚装填する。",
      apply(game){ game.player.maxHp=Math.round(game.player.maxHp*1.16); game.player.hp=game.player.maxHp; game.player._shellCharges=(game.player._shellCharges||0)+2; }
    },
    storm_eye: {
      name: "嵐喰らいの眼", icon: "⚡", color: "#65d9ff", signature:2,
      desc: "嵐喰らいの影固有遺産。雷帝の玉座 +35%、全権能CD ×0.94。",
      apply(game){ addPowerModifier(game.player,"storm_throne",1.35); game.player.systemCooldownMul*=.94; }
    },
    herald_seal: {
      name: "終焉印章", icon: "†", color: "#b45cff", signature:3,
      desc: "終焉の使者固有遺産。進化核 +1、共鳴威力 +25%。",
      apply(game){ game.player.evolutionCores+=1; game.player.synergyDamageBonus=(game.player.synergyDamageBonus||0)+.25; }
    },
    abyss_dividend: {
      name: "深淵配当", icon: "◇", color: "#ffd447",
      desc: "このランの深淵片 +30%。敵HP +12%。",
      apply(game){ game.player.shardGainMul*=1.3; game._runEnemyHpBonus=(game._runEnemyHpBonus||1)*1.12; }
    }
  };

  const MUTATIONS = {
    random_rank: {
      name: "強制覚醒", icon: "↑", color: "#ff5268",
      desc: "ランダムな取得済み権能を1レベル強化する。",
      eligible(game){ return ownedPowerIds(game.player).some(id=>rankOf(game.player,id)<POWER_CATALOG[id].max); },
      apply(game){
        const pool=ownedPowerIds(game.player).filter(id=>rankOf(game.player,id)<POWER_CATALOG[id].max);
        const id=choice(pool); if(id) acquirePower(game.player,id);
      }
    },
    evolution_core: {
      name: "核晶化", icon: "◇", color: "#ffd447",
      desc: "進化核 +1。",
      eligible(){ return true; },
      apply(game){ game.player.evolutionCores+=1; }
    },
    reroll: {
      name: "選択再構成", icon: "↻", color: "#65d9ff",
      desc: "リロール +2。",
      eligible(){ return true; },
      apply(game){ game.player.rerolls+=2; }
    },
    category_surge: {
      name: "系統暴走", icon: "✦", color: "#b45cff",
      desc: "最も多く取得しているカテゴリの権能ダメージ +16%。",
      eligible(game){ return ownedPowerIds(game.player).length>0; },
      apply(game){ const category=dominantCategory(game.player); if(category)addCategoryModifier(game.player,category,1.16); }
    },
    emergency_shell: {
      name: "応急巨殻", icon: "⬢", color: "#42e8bd",
      desc: "HPを45%回復し、次の1Hitを無効化する。",
      eligible(){ return true; },
      apply(game){ game.player.hp=Math.min(game.player.maxHp,game.player.hp+Math.round(game.player.maxHp*.45)); game.player._shellCharges=Math.max(1,game.player._shellCharges||0); }
    },
    slot_fragment: {
      name: "空白断片", icon: "+", color: "#65d9ff",
      desc: "権能枠 +1。ただし全権能ダメージ -5%。",
      eligible(game){ return game.player.powerSlotLimit<8; },
      apply(game){ game.player.powerSlotLimit+=1; game.player.systemDamageMul*=.95; }
    }
  };

  const LEGACY_REBIRTH_COSTS = {
    core_awakening:[0], rebirth_output:[4,7], rebirth_clock:[4,7], rebirth_frame:[4,7], rebirth_draft:[10],
    havoc_seed:[9], havoc_overkill:[7,11], redline_god:[16], colossus_god:[16], havoc_mastery:[22],
    dominion_area:[5,8], dominion_control:[7,11], chaos_clock:[16], precision_law:[16], dominion_mastery:[22],
    aegis_shell:[9], aegis_blood:[7,11], glass_god:[16], fortress_god:[16], aegis_mastery:[22],
    harvest_growth:[5,8], harvest_magnet:[10], swift_harvest:[16], deep_harvest:[16], harvest_mastery:[22]
  };

  const BASE_SKILL_SNAPSHOT = Array.isArray(SKILL_NODES)
    ? SKILL_NODES.map(node=>({id:node.id,max:node.max,costs:Array.isArray(node.costs)?node.costs.slice():[0]}))
    : [];

  const NEW_BRANCHES = [
    {id:"core",name:"再誕中枢",icon:"◇",color:"#ffd447",desc:"権能枠・選択・基礎出力",focus:{x:630,y:410}},
    {id:"havoc",name:"殲滅神格",icon:"☄",color:"#ff5268",desc:"開幕権能・火力・進化",focus:{x:235,y:215}},
    {id:"dominion",name:"現象支配",icon:"◉",color:"#b45cff",desc:"範囲・制御・共鳴",focus:{x:1025,y:215}},
    {id:"aegis",name:"不滅機構",icon:"⬢",color:"#42e8bd",desc:"防壁・復活・瀕死逆転",focus:{x:235,y:625}},
    {id:"harvest",name:"深淵収奪",icon:"▣",color:"#65d9ff",desc:"経験値・宝箱・深淵層",focus:{x:1025,y:625}}
  ];

  const NEW_NODES = [
    {id:"core_awakening",branch:"core",name:"再誕核",icon:"◇",type:"origin",x:630,y:410,max:1,costs:[0],requires:[],desc:"権能駆動型の機体を起動する中枢。",effect:r=>r?"ABYSS SYSTEMS ONLINE":"未起動"},
    {id:"rebirth_output",branch:"core",name:"神格出力",icon:"◆",type:"minor",x:630,y:285,max:3,costs:[4,7,10],requires:[{id:"core_awakening",rank:1}],desc:"全権能の最終ダメージを増やす。",effect:r=>`権能ダメージ +${r*10}%`},
    {id:"rebirth_clock",branch:"core",name:"時喰い時計",icon:"⌛",type:"minor",x:755,y:350,max:3,costs:[4,7,10],requires:[{id:"core_awakening",rank:1}],desc:"時間発動型権能を高速化する。",effect:r=>`権能CD -${r*6}%`},
    {id:"rebirth_frame",branch:"core",name:"巨神フレーム",icon:"♥",type:"minor",x:690,y:535,max:3,costs:[4,7,10],requires:[{id:"core_awakening",rank:1}],desc:"最大HPを割合で増やす。",effect:r=>`最大HP +${r*12}%`},
    {id:"rebirth_draft",branch:"core",name:"四択宣言",icon:"▤",type:"notable",x:505,y:350,max:1,costs:[10],requires:[{id:"core_awakening",rank:1}],desc:"レベルアップ候補を3つから4つへ増やす。",effect:r=>r?"強化候補 3 → 4":"未取得"},
    {id:"core_slots",branch:"core",name:"空白王座",icon:"+",type:"notable",x:505,y:485,max:2,costs:[12,18],requires:[{id:"rebirth_frame",rank:1}],desc:"ラン中に装備できる権能枠を増やす。",effect:r=>`権能枠 +${r}`},
    {id:"core_reroll",branch:"core",name:"再選択回路",icon:"↻",type:"notable",x:790,y:485,max:2,costs:[8,13],requires:[{id:"rebirth_clock",rank:1}],desc:"各ランのリロール回数を増やす。",effect:r=>`開始リロール +${r}`},

    {id:"havoc_seed",branch:"havoc",name:"開幕の凶兆",icon:"✹",type:"notable",x:405,y:275,max:1,costs:[9],requires:[{id:"rebirth_output",rank:1}],desc:"開始時にランダムな権能を1つ得る。",effect:r=>r?"開始時ランダム権能 Lv.1":"未取得"},
    {id:"havoc_overkill",branch:"havoc",name:"過剰殺戮炉",icon:"☠",type:"notable",x:285,y:185,max:2,costs:[7,11],requires:[{id:"havoc_seed",rank:1}],desc:"撃破発動権能を早め、全権能の威力を増幅する。",effect:r=>`権能ダメージ +${r*9}% / 必要撃破 -${r*9}%`},
    {id:"forge_core",branch:"havoc",name:"進化炉心",icon:"◇",type:"notable",x:285,y:345,max:2,costs:[10,15],requires:[{id:"havoc_seed",rank:1}],desc:"進化核を所持してランを開始する。",effect:r=>`開始進化核 +${r}`},
    {id:"redline_god",branch:"havoc",name:"赤線神格",icon:"✕",type:"keystone",x:105,y:170,max:1,costs:[16],requires:[{id:"havoc_overkill",rank:1}],branchReq:3,exclusive:"havoc_doctrine",desc:"HPを犠牲に威力と発動速度を極限まで高める。",effect:r=>r?"権能ダメージ ×1.38 / CD ×0.82 / 最大HP ×0.68":"未選択",tradeoff:true},
    {id:"colossus_god",branch:"havoc",name:"巨像神格",icon:"▰",type:"keystone",x:105,y:325,max:1,costs:[16],requires:[{id:"forge_core",rank:1}],branchReq:3,exclusive:"havoc_doctrine",desc:"機動力を犠牲に範囲と一撃を巨大化する。",effect:r=>r?"権能範囲 ×1.35 / ダメージ ×1.18 / 速度 ×0.82":"未選択",tradeoff:true},
    {id:"havoc_mastery",branch:"havoc",name:"黙示録の種",icon:"☄",type:"mastery",x:105,y:65,max:1,costs:[22],requires:[{id:"havoc_overkill",rank:2},{id:"forge_core",rank:1}],branchReq:5,desc:"開始時ランダム権能を2種類へ増やす。",effect:r=>r?"開始時ランダム権能 +2種類":"未取得"},

    {id:"dominion_area",branch:"dominion",name:"世界拡張",icon:"◎",type:"minor",x:855,y:275,max:3,costs:[5,8,11],requires:[{id:"rebirth_output",rank:1}],desc:"円・線・爆発を含む権能範囲を拡張する。",effect:r=>`権能範囲 +${r*10}%`},
    {id:"dominion_control",branch:"dominion",name:"停止法則",icon:"⌛",type:"notable",x:975,y:180,max:2,costs:[7,11],requires:[{id:"dominion_area",rank:1}],desc:"時間停止・重力場・安全域の持続を延ばす。",effect:r=>`支配時間 +${r*16}%`},
    {id:"synergy_matrix",branch:"dominion",name:"共鳴行列",icon:"◆◆",type:"notable",x:975,y:345,max:2,costs:[10,15],requires:[{id:"dominion_area",rank:1}],desc:"取得済み共鳴効果の最終威力を増幅する。",effect:r=>`共鳴ダメージ +${r*18}%`},
    {id:"chaos_clock",branch:"dominion",name:"乱数時計",icon:"?",type:"keystone",x:1150,y:170,max:1,costs:[16],requires:[{id:"dominion_control",rank:1}],branchReq:3,exclusive:"dominion_doctrine",desc:"全権能を高速化する代わりに威力を少し落とす。",effect:r=>r?"権能CD ×0.70 / 権能ダメージ ×0.88":"未選択",tradeoff:true},
    {id:"precision_law",branch:"dominion",name:"絶対法則",icon:"†",type:"keystone",x:1150,y:325,max:1,costs:[16],requires:[{id:"synergy_matrix",rank:1}],branchReq:3,exclusive:"dominion_doctrine",desc:"発動間隔を延ばし、一撃と共鳴を巨大化する。",effect:r=>r?"権能ダメージ ×1.38 / 権能CD ×1.16":"未選択",tradeoff:true},
    {id:"dominion_mastery",branch:"dominion",name:"二重現実",icon:"◇◇",type:"mastery",x:1150,y:65,max:1,costs:[22],requires:[{id:"dominion_control",rank:2},{id:"synergy_matrix",rank:1}],branchReq:5,desc:"時間発動型権能が一定確率で残響する。",effect:r=>r?"20%で残響発動（45%威力）":"未取得"},

    {id:"aegis_shell",branch:"aegis",name:"原初防壁",icon:"⬢",type:"notable",x:405,y:555,max:1,costs:[9],requires:[{id:"rebirth_frame",rank:1}],desc:"巨獣殻がなくても一定間隔で防壁を再生する。",effect:r=>r?"18秒ごとに1Hit防壁":"未取得"},
    {id:"aegis_blood",branch:"aegis",name:"瀕死炉心",icon:"◒",type:"notable",x:285,y:650,max:2,costs:[7,11],requires:[{id:"aegis_shell",rank:1}],desc:"HP35%以下で威力と移動速度を高める。",effect:r=>`瀕死時：権能威力 +${r*16}% / 速度 +${r*10}%`},
    {id:"glass_god",branch:"aegis",name:"硝子の神",icon:"◇",type:"keystone",x:105,y:540,max:1,costs:[16],requires:[{id:"aegis_blood",rank:1}],branchReq:2,exclusive:"aegis_doctrine",desc:"最大HPを半減させ、全権能を暴力的に増幅する。",effect:r=>r?"権能ダメージ ×1.52 / 最大HP ×0.56":"未選択",tradeoff:true},
    {id:"fortress_god",branch:"aegis",name:"不動の神",icon:"▣",type:"keystone",x:105,y:695,max:1,costs:[16],requires:[{id:"aegis_shell",rank:1}],branchReq:2,exclusive:"aegis_doctrine",desc:"移動速度を犠牲に巨大HPと軽減を得る。",effect:r=>r?"最大HP ×1.62 / 被ダメージ -12% / 速度 ×0.82":"未選択",tradeoff:true},
    {id:"aegis_mastery",branch:"aegis",name:"死者拒絶",icon:"☀",type:"mastery",x:105,y:790,max:1,costs:[22],requires:[{id:"aegis_blood",rank:2}],branchReq:4,desc:"1ランに一度、HP45%・3秒無敵で復帰する。",effect:r=>r?"復活1回 / HP45% / 3秒無敵":"未取得"},

    {id:"harvest_growth",branch:"harvest",name:"暴食学習",icon:"♢",type:"minor",x:855,y:555,max:3,costs:[5,8,11],requires:[{id:"rebirth_clock",rank:1}],desc:"経験値獲得量を増やす。",effect:r=>`経験値 +${r*8}%`},
    {id:"harvest_magnet",branch:"harvest",name:"財宝磁界",icon:"◎",type:"notable",x:975,y:650,max:1,costs:[10],requires:[{id:"harvest_growth",rank:1}],desc:"宝箱を広範囲から吸い寄せる。",effect:r=>r?"宝箱吸引半径 700":"未取得"},
    {id:"boss_legacy",branch:"harvest",name:"王遺産",icon:"♛",type:"notable",x:975,y:500,max:2,costs:[9,14],requires:[{id:"harvest_growth",rank:1}],desc:"ボス報酬の選択肢と進化核獲得を強化する。",effect:r=>`ボス報酬候補 +${r} / 2撃破ごと進化核 +${r}`},
    {id:"swift_harvest",branch:"harvest",name:"疾走収奪",icon:"↯",type:"keystone",x:1150,y:540,max:1,costs:[16],requires:[{id:"harvest_growth",rank:2}],branchReq:3,exclusive:"harvest_doctrine",desc:"成長速度を優先し、持ち帰る深淵片を少し減らす。",effect:r=>r?"経験値 ×1.28 / 深淵片 ×0.84":"未選択",tradeoff:true},
    {id:"deep_harvest",branch:"harvest",name:"深層収奪",icon:"▣",type:"keystone",x:1150,y:695,max:1,costs:[16],requires:[{id:"harvest_magnet",rank:1}],branchReq:3,exclusive:"harvest_doctrine",desc:"成長を少し遅らせ、深淵片を大幅に増やす。",effect:r=>r?"深淵片 ×1.42 / 経験値 ×0.90":"未選択",tradeoff:true},
    {id:"harvest_mastery",branch:"harvest",name:"黄金雨",icon:"✦",type:"mastery",x:1150,y:790,max:1,costs:[22],requires:[{id:"harvest_magnet",rank:1},{id:"boss_legacy",rank:1}],branchReq:5,desc:"55体撃破ごとに宝箱を強制出現させる。",effect:r=>r?"55撃破ごとに宝箱 +1":"未取得"}
  ];

  function replaceSkillTree(){
    if (!Array.isArray(SKILL_BRANCHES) || !Array.isArray(SKILL_NODES)) return;
    SKILL_BRANCHES.splice(0,SKILL_BRANCHES.length,...NEW_BRANCHES);
    SKILL_NODES.splice(0,SKILL_NODES.length,...NEW_NODES);
    if (typeof SKILL_LOOKUP === "object" && SKILL_LOOKUP){
      for (const key of Object.keys(SKILL_LOOKUP)) delete SKILL_LOOKUP[key];
      for (const node of SKILL_NODES){
        const branch=SKILL_BRANCHES.find(item=>item.id===node.branch);
        SKILL_LOOKUP[node.id]={...node,branchName:branch?.name||"",branchColor:branch?.color||"#fff"};
      }
    }
  }

  replaceSkillTree();

  function clamp(value,min,max){ return Math.max(min,Math.min(max,value)); }
  function finite(value,fallback=0){ return Number.isFinite(Number(value))?Number(value):fallback; }
  function choice(list){ return list&&list.length?list[Math.floor(Math.random()*list.length)]:null; }
  function shuffle(list){
    const out=list.slice();
    for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
    return out;
  }
  function formatNumber(value,digits=2){
    if(!Number.isFinite(value))return "-";
    if(Math.abs(value-Math.round(value))<.005)return String(Math.round(value));
    return value.toFixed(digits).replace(/0+$/,'').replace(/\.$/,'');
  }
  function rankOf(player,id){ return Math.max(0,Math.floor(finite(player?.upgradeRanks?.[id],0))); }
  function ownedPowerIds(player){ return POWER_IDS.filter(id=>rankOf(player,id)>0); }
  function isEvolved(player,id){ return !!player?.powerEvolutions?.[id]; }
  function hasSynergy(player,id){ return !!player?.powerSynergies?.[id]; }
  function dominantCategory(player){
    const counts={};
    for(const id of ownedPowerIds(player)){
      const category=POWER_CATALOG[id].category;
      counts[category]=(counts[category]||0)+rankOf(player,id);
    }
    return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
  }
  function addCategoryModifier(player,category,multiplier){
    player.categoryDamageMul=player.categoryDamageMul||{};
    player.categoryDamageMul[category]=(player.categoryDamageMul[category]||1)*multiplier;
  }
  function addPowerModifier(player,id,multiplier){
    player.powerDamageById=player.powerDamageById||{};
    player.powerDamageById[id]=(player.powerDamageById[id]||1)*multiplier;
  }
  function categoryMultiplier(player,id){
    const category=POWER_CATALOG[id]?.category;
    return (player?.categoryDamageMul?.[category]||1)*(player?.powerDamageById?.[id]||1);
  }
  function synergyMultiplier(player){ return 1+(finite(player?.synergyDamageBonus,0)); }
  function currentChallenge(game){ return CHALLENGES[game?.records?.challengeSelected]||CHALLENGES.none; }
  function selectedLayer(game){ return clamp(Math.floor(finite(game?.records?.abyssSelected,0)),0,MAX_ABYSS_LAYER); }

  window.__abyssSystems = {
    version:SYSTEM_VERSION,
    POWER_CATALOG,
    EVOLUTIONS,
    SYNERGIES,
    CHALLENGES,
    STAGE_RULES,
    validate(){
      const problems=[];
      for(const [id,evolution] of Object.entries(EVOLUTIONS))if(!POWER_CATALOG[id]||!evolution.name)problems.push(`invalid evolution ${id}`);
      for(const [id,synergy] of Object.entries(SYNERGIES))for(const power of synergy.powers)if(!POWER_CATALOG[power])problems.push(`invalid synergy ${id}:${power}`);
      const signatures=Object.values(RELICS).filter(relic=>Number.isInteger(relic.signature));
      if(signatures.length!==4||new Set(signatures.map(relic=>relic.signature)).size!==4)problems.push("four unique boss signature relics are required");
      if(new Set(POWER_IDS).size!==POWER_IDS.length)problems.push("duplicate power id");
      return {ok:problems.length===0,problems,powerCount:POWER_IDS.length,synergyCount:Object.keys(SYNERGIES).length,bossSignatureCount:signatures.length};
    }
  };

  /* ============================== UI / 保存 ============================== */
  function injectUi(){
    if(document.getElementById("abyssSettingsScreen"))return;

    const titleActions=document.querySelector("#titleScreen .title-actions");
    if(titleActions){
      const settingsButton=document.createElement("div");
      settingsButton.className="btn abyss-settings-open";
      settingsButton.id="titleSettingsBtn";
      settingsButton.tabIndex=0;
      settingsButton.setAttribute("role","button");
      settingsButton.textContent="設定";
      titleActions.appendChild(settingsButton);
    }

    const metaCard=document.querySelector("#titleScreen .meta-progress-card");
    if(metaCard){
      const layerCard=document.createElement("section");
      layerCard.id="abyssLayerCard";
      layerCard.className="abyss-layer-card";
      layerCard.innerHTML=`
        <div class="abyss-layer-head">
          <div><small>POST-CLEAR DESCENT</small><strong>深淵層</strong></div>
          <div class="abyss-layer-stepper">
            <button id="abyssLayerDown" type="button" aria-label="深淵層を下げる">−</button>
            <span id="abyssLayerValue">0</span>
            <button id="abyssLayerUp" type="button" aria-label="深淵層を上げる">＋</button>
          </div>
        </div>
        <div id="abyssLayerLock" class="abyss-layer-lock" hidden>初回クリア後に深淵層と追加チャレンジが解放されます。</div>
        <div id="abyssLayerSummary" class="abyss-layer-summary"></div>
        <label class="challenge-select-label" for="challengeSelect">追加チャレンジ</label>
        <select id="challengeSelect" class="challenge-select"></select>
        <div id="challengeSummary" class="challenge-summary"></div>`;
      metaCard.insertAdjacentElement("afterend",layerCard);
    }

    const pausePanel=document.querySelector("#pauseScreen .title-block");
    if(pausePanel){
      const button=document.createElement("div");
      button.className="btn";
      button.id="pauseSettingsBtn";
      button.tabIndex=0;
      button.setAttribute("role","button");
      button.textContent="設定";
      pausePanel.insertBefore(button,document.getElementById("quitBtn"));
      pausePanel.insertBefore(document.createElement("br"),document.getElementById("quitBtn"));
    }

    const hud=document.getElementById("hud");
    if(hud){
      const stageRule=document.createElement("div");
      stageRule.id="stageRuleHud";
      stageRule.innerHTML=`<span id="stageRuleIcon">◎</span><div><strong id="stageRuleName">共鳴門域</strong><small id="stageRuleText"></small></div>`;
      hud.appendChild(stageRule);

      const build=document.createElement("div");
      build.id="buildStatusHud";
      build.innerHTML=`<span id="buildSlotText">権能 0/5</span><span id="buildCoreText">進化核 0</span><span id="buildSynergyText">共鳴 0</span>`;
      hud.appendChild(build);
    }

    const settings=document.createElement("div");
    settings.id="abyssSettingsScreen";
    settings.className="overlay-screen hidden";
    settings.innerHTML=`
      <div class="abyss-settings-shell">
        <header><div><small>SIGNAL CALIBRATION</small><h2>表示・音響設定</h2></div><button id="settingsCloseBtn" type="button">閉じる</button></header>
        <div class="abyss-settings-grid">
          <label>全体音量 <output id="masterVolumeOut">60</output><input id="masterVolumeSetting" type="range" min="0" max="100" value="60"></label>
          <label>BGM音量 <output id="musicVolumeOut">35</output><input id="musicVolumeSetting" type="range" min="0" max="100" value="35"></label>
          <label>効果音量 <output id="sfxVolumeOut">70</output><input id="sfxVolumeSetting" type="range" min="0" max="100" value="70"></label>
          <label>画面揺れ <output id="shakeOut">70</output><input id="shakeSetting" type="range" min="0" max="100" value="70"></label>
          <label>エフェクト密度<select id="effectsSetting"><option value="low">低</option><option value="normal">標準</option><option value="high">高</option></select></label>
          <label>ダメージ数字<select id="damageTextSetting"><option value="low">少ない</option><option value="normal">標準</option><option value="high">多い</option></select></label>
          <label class="setting-toggle"><input id="flashSetting" type="checkbox"><span>画面フラッシュを表示</span></label>
          <label class="setting-toggle"><input id="contrastSetting" type="checkbox"><span>高コントラスト表示</span></label>
          <label class="setting-toggle"><input id="motionSetting" type="checkbox"><span>演出の動きを軽減</span></label>
          <label class="setting-toggle"><input id="projectileSetting" type="checkbox"><span>敵弾の白縁を強調</span></label>
        </div>
        <p class="settings-note">BGMは外部音源を使わず、Web Audioでステージごとに自動生成します。設定はlocalStorageへ保存されます。</p>
      </div>`;
    document.body.appendChild(settings);

    const reward=document.createElement("div");
    reward.id="abyssRewardScreen";
    reward.className="overlay-screen hidden";
    reward.innerHTML=`
      <div class="abyss-reward-shell">
        <header><small id="rewardKicker">BOSS LEGACY</small><h2 id="rewardTitle">報酬を選択</h2><p id="rewardDescription"></p></header>
        <div id="rewardChoices" class="abyss-reward-choices"></div>
      </div>`;
    document.body.appendChild(reward);
  }

  injectUi();

  const DEFAULT_SETTINGS = {
    musicVolume:35,
    sfxVolume:70,
    shake:70,
    effects:"normal",
    damageText:"normal",
    flashes:true,
    highContrast:false,
    reducedMotion:false,
    projectileOutline:true
  };

  function normalizeSettings(raw){
    const settings=Object.assign({},DEFAULT_SETTINGS,raw&&typeof raw==="object"?raw:{});
    settings.musicVolume=clamp(Math.round(finite(settings.musicVolume,35)),0,100);
    settings.sfxVolume=clamp(Math.round(finite(settings.sfxVolume,70)),0,100);
    settings.shake=clamp(Math.round(finite(settings.shake,70)),0,100);
    if(!["low","normal","high"].includes(settings.effects))settings.effects="normal";
    if(!["low","normal","high"].includes(settings.damageText))settings.damageText="normal";
    settings.flashes=settings.flashes!==false;
    settings.highContrast=!!settings.highContrast;
    settings.reducedMotion=!!settings.reducedMotion;
    settings.projectileOutline=settings.projectileOutline!==false;
    return settings;
  }

  function rawSavedRecords(){
    try{return JSON.parse(localStorage.getItem(SAVE_KEY)||"{}");}catch(error){return {};}
  }

  function legacyRefund(rawTree){
    if(!rawTree||typeof rawTree!=="object"||Array.isArray(rawTree))return 0;
    const newIds=new Set(NEW_NODES.map(node=>node.id));
    const costsById={};
    for(const node of BASE_SKILL_SNAPSHOT)costsById[node.id]=node.costs;
    for(const [id,costs] of Object.entries(LEGACY_REBIRTH_COSTS))costsById[id]=costs;
    let refund=0;
    for(const [id,value] of Object.entries(rawTree)){
      if(newIds.has(id))continue;
      const costs=costsById[id];
      if(!costs)continue;
      const rank=Math.max(0,Math.floor(finite(value,0)));
      for(let i=0;i<rank;i++)refund+=costs[i]??costs[costs.length-1]??0;
    }
    return refund;
  }

  const previousLoadRecords=Game.prototype.loadRecords;
  Game.prototype.loadRecords=function(){
    const raw=rawSavedRecords();
    previousLoadRecords.call(this);
    this.records.settings=normalizeSettings(raw.settings||this.records.settings);
    const legacyClear=finite(this.records.bestTime,0)>=CONFIG.GAME_TIME-1;
    this.records.abyssUnlocked=clamp(Math.max(Math.floor(finite(raw.abyssUnlocked,0)),legacyClear?1:0),0,MAX_ABYSS_LAYER);
    this.records.abyssSelected=clamp(Math.floor(finite(raw.abyssSelected,0)),0,this.records.abyssUnlocked);
    this.records.challengeSelected=CHALLENGES[raw.challengeSelected]?raw.challengeSelected:"none";
    if(this.records.abyssUnlocked<=0)this.records.challengeSelected="none";
    this.records.challengeBest=raw.challengeBest&&typeof raw.challengeBest==="object"?raw.challengeBest:{};
    this.records.runHistory=Array.isArray(raw.runHistory)?raw.runHistory.slice(0,MAX_RUN_HISTORY):[];
    this.records.onboardingVersion=clamp(Math.floor(finite(raw.onboardingVersion,0)),0,1);
    this.records.systemVersion=Math.floor(finite(raw.systemVersion,0));

    if(this.records.systemVersion<SYSTEM_VERSION){
      const refund=legacyRefund(raw.skillTree);
      if(refund>0)this.records.shards=Math.max(0,Math.floor(finite(this.records.shards,0)))+refund;
      this.records.systemVersion=SYSTEM_VERSION;
      this.records.lastSystemRefund=refund;
      try{localStorage.setItem(SAVE_KEY,JSON.stringify(this.records));}catch(error){}
    }

    this.sound.volume=clamp(finite(this.records.volume,60)/100,0,1);
    updateTitleControls(this);
    applySettings(this);
  };

  const previousSaveRecords=Game.prototype.saveRecords;
  Game.prototype.saveRecords=function(){
    this.records.settings=normalizeSettings(this.records.settings);
    this.records.abyssUnlocked=clamp(Math.floor(finite(this.records.abyssUnlocked,0)),0,MAX_ABYSS_LAYER);
    this.records.abyssSelected=clamp(Math.floor(finite(this.records.abyssSelected,0)),0,this.records.abyssUnlocked);
    this.records.onboardingVersion=clamp(Math.floor(finite(this.records.onboardingVersion,0)),0,1);
    if(!CHALLENGES[this.records.challengeSelected])this.records.challengeSelected="none";
    return previousSaveRecords.call(this);
  };

  function applySettings(game){
    const settings=normalizeSettings(game?.records?.settings);
    if(game?.records)game.records.settings=settings;
    document.body.classList.toggle("abyss-high-contrast",settings.highContrast);
    document.body.classList.toggle("abyss-reduced-motion",settings.reducedMotion);
    document.body.classList.toggle("abyss-projectile-outline",settings.projectileOutline);
    const baseDamageTexts=CONFIG._abyssBaseDamageTexts||(CONFIG._abyssBaseDamageTexts=CONFIG.MAX_DAMAGE_TEXTS);
    CONFIG.MAX_DAMAGE_TEXTS=settings.damageText==="low"?Math.max(40,Math.round(baseDamageTexts*.55)):settings.damageText==="high"?Math.round(baseDamageTexts*1.4):baseDamageTexts;
    const master=document.getElementById("masterVolumeSetting");
    const music=document.getElementById("musicVolumeSetting");
    const sfx=document.getElementById("sfxVolumeSetting");
    const shake=document.getElementById("shakeSetting");
    const effects=document.getElementById("effectsSetting");
    const damageText=document.getElementById("damageTextSetting");
    const flash=document.getElementById("flashSetting");
    const contrast=document.getElementById("contrastSetting");
    const motion=document.getElementById("motionSetting");
    const projectile=document.getElementById("projectileSetting");
    if(master)master.value=String(game?.records?.volume??60);
    if(music)music.value=String(settings.musicVolume);
    if(sfx)sfx.value=String(settings.sfxVolume);
    if(shake)shake.value=String(settings.shake);
    if(effects)effects.value=settings.effects;
    if(damageText)damageText.value=settings.damageText;
    if(flash)flash.checked=settings.flashes;
    if(contrast)contrast.checked=settings.highContrast;
    if(motion)motion.checked=settings.reducedMotion;
    if(projectile)projectile.checked=settings.projectileOutline;
    updateSettingOutputs(game);
  }

  function updateSettingOutputs(game){
    const pairs=[
      ["masterVolumeOut",game?.records?.volume??60],
      ["musicVolumeOut",game?.records?.settings?.musicVolume??35],
      ["sfxVolumeOut",game?.records?.settings?.sfxVolume??70],
      ["shakeOut",game?.records?.settings?.shake??70]
    ];
    for(const [id,value] of pairs){const el=document.getElementById(id);if(el)el.textContent=String(value);}
  }

  function openSettings(game){
    if(!game)return;
    game._settingsReturnState=game.state;game._settingsOpen=true;
    game.input?.keys?.clear?.();
    if(game.state!=="title")game.state="settings";
    applySettings(game);
    document.getElementById("abyssSettingsScreen")?.classList.remove("hidden");
  }

  function closeSettings(game){
    if(!game)return;
    game._settingsOpen=false;
    document.getElementById("abyssSettingsScreen")?.classList.add("hidden");
    const returnState=game._settingsReturnState||"title";
    game.state=returnState==="playing"?"paused":returnState;
    if(game.state==="paused")document.getElementById("pauseScreen")?.classList.remove("hidden");
    game.lastTime=performance.now();
    game.saveRecords();
  }

  function updateTitleControls(game){
    if(!game?.records)return;
    const unlocked=(game.records.abyssUnlocked||0)>0||finite(game.records.bestTime,0)>=CONFIG.GAME_TIME-1;
    const card=document.getElementById("abyssLayerCard");
    const lock=document.getElementById("abyssLayerLock");
    if(card)card.classList.toggle("is-locked",!unlocked);
    if(lock)lock.hidden=unlocked;
    const layer=clamp(Math.floor(finite(game.records.abyssSelected,0)),0,game.records.abyssUnlocked||0);
    game.records.abyssSelected=layer;
    const value=document.getElementById("abyssLayerValue");
    const summary=document.getElementById("abyssLayerSummary");
    if(value)value.textContent=String(layer);
    if(summary){
      const hp=Math.round(layer*12),atk=Math.round(layer*8),reward=Math.round(layer*10);
      summary.textContent=!unlocked?"標準航行で10分間生存し、深淵への入口を開け。":layer===0?"標準層。敵補正なし。":"敵HP +"+hp+"% / 敵攻撃 +"+atk+"% / 深淵片 +"+reward+"%";
    }
    const select=document.getElementById("challengeSelect");
    if(select){
      if(!select.options.length){
        for(const [id,data] of Object.entries(CHALLENGES)){
          const option=document.createElement("option");option.value=id;option.textContent=data.name;select.appendChild(option);
        }
      }
      select.value=game.records.challengeSelected||"none";
      select.disabled=!unlocked;
    }
    const challenge=CHALLENGES[game.records.challengeSelected]||CHALLENGES.none;
    const challengeSummary=document.getElementById("challengeSummary");
    if(challengeSummary)challengeSummary.textContent=unlocked?challenge.desc:"追加チャレンジは初回クリア後に選択できます。";
    const up=document.getElementById("abyssLayerUp");
    const down=document.getElementById("abyssLayerDown");
    if(up)up.disabled=!unlocked||layer>=game.records.abyssUnlocked;
    if(down)down.disabled=!unlocked||layer<=0;
  }

  function bindInjectedUi(){
    const getGame=()=>window.__game;
    document.getElementById("titleSettingsBtn")?.addEventListener("click",()=>openSettings(getGame()));
    document.getElementById("pauseSettingsBtn")?.addEventListener("click",()=>{
      document.getElementById("pauseScreen")?.classList.add("hidden");
      openSettings(getGame());
    });
    document.getElementById("settingsCloseBtn")?.addEventListener("click",()=>closeSettings(getGame()));
    document.getElementById("abyssLayerDown")?.addEventListener("click",()=>{
      const game=getGame();if(!game)return;game.records.abyssSelected=Math.max(0,game.records.abyssSelected-1);game.saveRecords();updateTitleControls(game);
    });
    document.getElementById("abyssLayerUp")?.addEventListener("click",()=>{
      const game=getGame();if(!game)return;game.records.abyssSelected=Math.min(game.records.abyssUnlocked,game.records.abyssSelected+1);game.saveRecords();updateTitleControls(game);
    });
    document.getElementById("challengeSelect")?.addEventListener("change",event=>{
      const game=getGame();if(!game)return;game.records.challengeSelected=CHALLENGES[event.target.value]?event.target.value:"none";game.saveRecords();updateTitleControls(game);
    });

    const saveSetting=()=>{
      const game=getGame();if(!game)return;
      const settings=normalizeSettings(game.records.settings);
      game.records.volume=clamp(Math.round(finite(document.getElementById("masterVolumeSetting")?.value,60)),0,100);
      settings.musicVolume=clamp(Math.round(finite(document.getElementById("musicVolumeSetting")?.value,35)),0,100);
      settings.sfxVolume=clamp(Math.round(finite(document.getElementById("sfxVolumeSetting")?.value,70)),0,100);
      settings.shake=clamp(Math.round(finite(document.getElementById("shakeSetting")?.value,70)),0,100);
      settings.effects=document.getElementById("effectsSetting")?.value||"normal";
      settings.damageText=document.getElementById("damageTextSetting")?.value||"normal";
      settings.flashes=!!document.getElementById("flashSetting")?.checked;
      settings.highContrast=!!document.getElementById("contrastSetting")?.checked;
      settings.reducedMotion=!!document.getElementById("motionSetting")?.checked;
      settings.projectileOutline=!!document.getElementById("projectileSetting")?.checked;
      game.records.settings=settings;
      game.sound.volume=game.records.volume/100;
      applySettings(game);
      game.saveRecords();
    };
    for(const id of ["masterVolumeSetting","musicVolumeSetting","sfxVolumeSetting","shakeSetting","effectsSetting","damageTextSetting","flashSetting","contrastSetting","motionSetting","projectileSetting"]){
      document.getElementById(id)?.addEventListener("input",saveSetting);
      document.getElementById(id)?.addEventListener("change",saveSetting);
    }
    if(!window.__abyssLevelHotkeysBound){
      window.__abyssLevelHotkeysBound=true;
      window.addEventListener("keydown",event=>{
        const game=getGame();
        if(!game||game.state!=="levelup"||event.repeat)return;
        const target=event.target;
        if(target&&["INPUT","SELECT","TEXTAREA"].includes(target.tagName))return;
        const index=Number(event.key)-1;
        if(index>=0&&index<4&&game._levelUpSelectActions?.[index]){
          event.preventDefault();game._levelUpSelectActions[index]();
        }else if(event.key.toLowerCase()==="r"&&game._levelUpRerollAction){
          event.preventDefault();game._levelUpRerollAction();
        }
      });
    }
  }

  window.addEventListener("DOMContentLoaded",()=>{
    bindInjectedUi();
    const game=window.__game;
    if(game){updateTitleControls(game);applySettings(game);}
    if(!window.__abyssSettingsEscapeBound){
      window.__abyssSettingsEscapeBound=true;
      window.addEventListener("game-escape",()=>{const current=window.__game;if(current?._settingsOpen)closeSettings(current);});
    }
  });

  /* ============================== 統計 ============================== */
  function newRunStats(){
    return {
      damageBySource:{},killsBySource:{},damageTaken:0,healing:0,treasures:0,gems:0,
      bossKills:0,evolutions:[],synergies:[],relics:[],mutations:[],rerolls:0,banishes:0,
      stageNests:0,startedAt:Date.now()
    };
  }

  function sourceLabel(source){
    if(POWER_CATALOG[source])return POWER_CATALOG[source].name;
    if(SYNERGIES[source])return SYNERGIES[source].name;
    const aliases={death_explosion:"撃破爆発",stage_nest:"増殖巣",boss_reward:"ボス報酬",unknown:"その他"};
    return aliases[source]||source||"その他";
  }

  function recordDamage(game,source,amount,killed){
    if(!game?._runStats||amount<=0)return;
    const key=source||"unknown";
    game._runStats.damageBySource[key]=(game._runStats.damageBySource[key]||0)+amount;
    if(killed)game._runStats.killsBySource[key]=(game._runStats.killsBySource[key]||0)+1;
  }

  function withDamageSource(game,source,action){
    const previous=game._damageSource;
    game._damageSource=source;
    try{return action();}finally{game._damageSource=previous;}
  }

  const previousDamageEnemy=Game.prototype.damageEnemy;
  Game.prototype.damageEnemy=function(enemy,damage,crit){
    if(!enemy||enemy.dead)return;
    const before=Math.max(0,finite(enemy.hp,0));
    const wasDead=!!enemy.dead;
    const result=previousDamageEnemy.call(this,enemy,damage,crit);
    const after=Math.max(0,finite(enemy.hp,0));
    recordDamage(this,this._damageSource||"unknown",Math.max(0,before-after),!wasDead&&!!enemy.dead);
    return result;
  };

  const previousDamageBoss=Game.prototype.damageBoss;
  Game.prototype.damageBoss=function(damage,crit){
    const boss=this.boss;
    if(!boss||boss.dead)return;
    const before=Math.max(0,finite(boss.hp,0));
    const result=previousDamageBoss.call(this,damage,crit);
    const after=this.boss===boss?Math.max(0,finite(boss.hp,0)):0;
    recordDamage(this,this._damageSource||"unknown",Math.max(0,before-after),false);
    return result;
  };

  const previousEnemyDeath=Enemy.prototype.onDeath;
  Enemy.prototype.onDeath=function(game){
    if(this._systemDeathHandled)return;
    this._systemDeathHandled=true;
    return withDamageSource(game,"death_explosion",()=>previousEnemyDeath.call(this,game));
  };

  const previousPlayerDamage=Player.prototype.takeDamage;
  Player.prototype.takeDamage=function(amount,game){
    const before=Math.max(0,this.hp);
    if(this._shellCharges>0&&!this.invincible){
      this._shellCharges--;
      this._shellTimer=this._shellRecharge||16;
      const radius=260*(this.systemAreaMul||1);
      const damage=powerDamage(game,"leviathan_shell",2.2);
      areaDamage(game,this.x,this.y,radius,damage,"leviathan_shell",6);
      game.addEffect(new SystemPulse(this.x,this.y,radius,"#42e8bd",.65));
      if(hasSynergy(this,"crimson_carapace"))activateBloodEclipse(game,.9);
      game.shake(10,.25);
      return;
    }
    const result=previousPlayerDamage.call(this,amount,game);
    const taken=Math.max(0,before-this.hp);
    if(game?._runStats)game._runStats.damageTaken+=taken;
    return result;
  };

  /* ============================== 共通戦闘処理 / エフェクト ============================== */
  function effectDensity(game){ return game?.records?.settings?.effects||"normal"; }

  class SystemPulse{
    constructor(x,y,radius,color,life=.55,fill=true){
      this.x=x;this.y=y;this.radius=radius;this.color=color;this.life=life;this.maxLife=life;this.dead=false;this.fill=fill;this.critical=false;
    }
    update(dt){this.life-=dt;if(this.life<=0)this.dead=true;}
    draw(ctx,cam){
      const progress=1-clamp(this.life/this.maxLife,0,1),alpha=clamp(this.life/this.maxLife,0,1);
      const radius=this.radius*(.16+.84*(1-Math.pow(1-progress,3)));
      ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.globalCompositeOperation="source-over";
      if(this.fill){const gradient=ctx.createRadialGradient(0,0,0,0,0,Math.max(1,radius));gradient.addColorStop(0,rgba("#fff7dc",alpha*.52));gradient.addColorStop(.35,rgba(this.color,alpha*.24));gradient.addColorStop(1,rgba(this.color,0));ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();}
      for(let i=0;i<3;i++){ctx.strokeStyle=i===1?rgba("#fff7dc",alpha*.9):rgba(this.color,alpha*(.75-i*.16));ctx.lineWidth=Math.max(1,9-i*3);ctx.beginPath();ctx.arc(0,0,radius*(.64+i*.16),0,Math.PI*2);ctx.stroke();}
      ctx.restore();
    }
  }

  class SystemBeam{
    constructor(ax,ay,bx,by,width,color,life=.32){
      this.ax=ax;this.ay=ay;this.bx=bx;this.by=by;this.x=(ax+bx)/2;this.y=(ay+by)/2;this.radius=Math.hypot(bx-ax,by-ay)/2;this.width=width;this.color=color;this.life=life;this.maxLife=life;this.dead=false;this.critical=false;
    }
    update(dt){this.life-=dt;if(this.life<=0)this.dead=true;}
    draw(ctx,cam){
      const alpha=clamp(this.life/this.maxLife,0,1);ctx.save();ctx.translate(-cam.x,-cam.y);ctx.lineCap="round";
      for(const [width,color] of [[this.width*2.5,rgba(this.color,alpha*.14)],[this.width,rgba(this.color,alpha*.82)],[Math.max(3,this.width*.18),rgba("#fff7dc",alpha)]]){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(this.ax,this.ay);ctx.lineTo(this.bx,this.by);ctx.stroke();}
      ctx.restore();
    }
  }

  class SystemWarning{
    constructor(x,y,opt={}){
      this.x=x;this.y=y;this.radius=opt.radius||120;this.angle=opt.angle||0;this.length=opt.length||500;this.width=opt.width||26;this.kind=opt.kind||"ring";this.color=opt.color||"#ff5268";this.life=opt.life||.7;this.maxLife=this.life;this.dead=false;this.critical=true;
    }
    update(dt){this.life-=dt;if(this.life<=0)this.dead=true;}
    draw(ctx,cam){
      const alpha=clamp(this.life/this.maxLife,0,1),pulse=.6+.4*Math.sin((1-alpha)*Math.PI*12);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.rotate(this.angle);ctx.globalAlpha=.55+.45*pulse;ctx.strokeStyle=this.color;ctx.fillStyle=rgba(this.color,.13);ctx.lineWidth=5;ctx.setLineDash([16,10]);ctx.lineDashOffset=-performance.now()*.08;
      if(this.kind==="line"){ctx.fillRect(0,-this.width/2,this.length,this.width);ctx.strokeRect(0,-this.width/2,this.length,this.width);}
      else if(this.kind==="cross"){ctx.fillRect(-this.length,-this.width/2,this.length*2,this.width);ctx.fillRect(-this.width/2,-this.length,this.width,this.length*2);ctx.strokeRect(-this.length,-this.width/2,this.length*2,this.width);ctx.strokeRect(-this.width/2,-this.length,this.width,this.length*2);}
      else{ctx.beginPath();ctx.arc(0,0,this.radius,0,Math.PI*2);ctx.fill();ctx.stroke();}
      ctx.setLineDash([]);ctx.restore();
    }
  }

  class GravityField{
    constructor(game,x,y,rank,scale=1){
      const stats=getPowerStats(game.player,"gravity_coffin",rank);this.game=game;this.x=x;this.y=y;this.radius=stats.radius;this.damage=powerDamage(game,"gravity_coffin",stats.damage*scale);this.life=stats.duration;this.maxLife=this.life;this.dead=false;this.tick=0;this.color="#b45cff";this.critical=true;
    }
    update(dt){
      this.life-=dt;this.tick-=dt;
      if(this.tick<=0){
        this.tick=.08;
        for(const enemy of enemiesInRadius(this.game,this.x,this.y,this.radius)){
          const distance=Math.max(20,U.dist(enemy.x,enemy.y,this.x,this.y));
          const pull=(1-distance/this.radius)*1050;
          enemy.x+=((this.x-enemy.x)/distance)*pull*.08;
          enemy.y+=((this.y-enemy.y)/distance)*pull*.08;
        }
      }
      if(this.life<=0&&!this.dead){
        areaDamage(this.game,this.x,this.y,this.radius,this.damage,"gravity_coffin",8);
        this.game.addEffect(new SystemPulse(this.x,this.y,this.radius,this.color,.72));
        if(isEvolved(this.game.player,"gravity_coffin"))this.game._delayedSystemCasts.push({delay:.65,type:"mini_gravity",x:this.x,y:this.y,damage:Math.round(this.damage*.55),radius:this.radius*.55});
        if(hasSynergy(this.game.player,"horizon_blade"))castWorldCutter(this.game,rankOf(this.game.player,"world_cutter"),.72,{x:this.x,y:this.y});
        this.game.shake(13,.32);this.dead=true;
      }
    }
    draw(ctx,cam){
      const alpha=clamp(this.life/this.maxLife,0,1),radius=this.radius*(.82+.06*Math.sin(performance.now()*.01));ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);const gradient=ctx.createRadialGradient(0,0,0,0,0,radius);gradient.addColorStop(0,rgba("#090718",.74));gradient.addColorStop(.58,rgba(this.color,.22));gradient.addColorStop(1,rgba(this.color,0));ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();ctx.strokeStyle=rgba(this.color,.9*alpha);ctx.lineWidth=6;ctx.setLineDash([20,12]);ctx.lineDashOffset=-performance.now()*.05;ctx.beginPath();ctx.arc(0,0,radius*.82,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();
    }
  }

  class MeteorMarker{
    constructor(game,x,y,rank,scale=1){
      const stats=getPowerStats(game.player,"meteor_scripture",rank);this.game=game;this.x=x;this.y=y;this.radius=stats.radius;this.damage=powerDamage(game,"meteor_scripture",stats.damage*scale);this.life=.82;this.maxLife=.82;this.dead=false;this.critical=true;
    }
    update(dt){
      this.life-=dt;
      if(this.life<=0&&!this.dead){
        areaDamage(this.game,this.x,this.y,this.radius,this.damage,"meteor_scripture",5);
        this.game.addEffect(new SystemPulse(this.x,this.y,this.radius,"#ff8a4c",.58));
        if(isEvolved(this.game.player,"meteor_scripture"))this.game.addEffect(new BurnField(this.game,this.x,this.y,this.radius*.72,this.damage*.22,"meteor_scripture",3.2));
        if(hasSynergy(this.game.player,"helios_scripture"))areaDamage(this.game,this.x,this.y,this.radius*.8,powerDamage(this.game,"solar_funeral",.9),"helios_scripture",3);
        this.dead=true;
      }
    }
    draw(ctx,cam){
      const progress=1-this.life/this.maxLife,alpha=.45+.55*Math.sin(progress*Math.PI*10);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.strokeStyle=`rgba(255,82,104,${alpha})`;ctx.fillStyle="rgba(255,138,76,.14)";ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,this.radius*(.55+.45*progress),0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(-this.radius,0);ctx.lineTo(this.radius,0);ctx.moveTo(0,-this.radius);ctx.lineTo(0,this.radius);ctx.stroke();ctx.restore();
    }
  }

  class BurnField{
    constructor(game,x,y,radius,dps,source,life=3){this.game=game;this.x=x;this.y=y;this.radius=radius;this.dps=dps;this.source=source;this.life=life;this.maxLife=life;this.tick=0;this.dead=false;this.critical=false;}
    update(dt){this.life-=dt;this.tick-=dt;if(this.tick<=0){this.tick=.25;areaDamage(this.game,this.x,this.y,this.radius,this.dps*.25,this.source,2,false);}if(this.life<=0)this.dead=true;}
    draw(ctx,cam){const alpha=clamp(this.life/this.maxLife,0,1);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);const gradient=ctx.createRadialGradient(0,0,0,0,0,this.radius);gradient.addColorStop(0,rgba("#ffd447",.18*alpha));gradient.addColorStop(.5,rgba("#ff5268",.13*alpha));gradient.addColorStop(1,rgba("#ff5268",0));ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(0,0,this.radius,0,Math.PI*2);ctx.fill();ctx.strokeStyle=rgba("#ff8a4c",.45*alpha);ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,this.radius*(.9+.04*Math.sin(performance.now()*.012)),0,Math.PI*2);ctx.stroke();ctx.restore();}
  }

  class CometMine{
    constructor(game,x,y,rank){const stats=getPowerStats(game.player,"comet_wake",rank);this.game=game;this.x=x;this.y=y;this.radius=stats.radius;this.damage=powerDamage(game,"comet_wake",stats.damage);this.life=.5;this.maxLife=.5;this.dead=false;this.critical=false;}
    update(dt){this.life-=dt;if(this.life<=0&&!this.dead){areaDamage(this.game,this.x,this.y,this.radius,this.damage,"comet_wake",4);this.game.addEffect(new SystemPulse(this.x,this.y,this.radius,"#65d9ff",.4));if(isEvolved(this.game.player,"comet_wake")){const nearest=nearestTargets(this.game,1,430,{x:this.x,y:this.y})[0];if(nearest)this.game._delayedSystemCasts.push({delay:.16,type:"comet_chain",x:nearest.x,y:nearest.y,damage:Math.round(this.damage*.68),radius:this.radius*.82});}this.dead=true;}}
    draw(ctx,cam){const alpha=clamp(this.life/this.maxLife,0,1);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.rotate(performance.now()*.004);ctx.strokeStyle=rgba("#65d9ff",alpha);ctx.fillStyle=rgba("#5164ff",.2);ctx.lineWidth=4;polygonPath(ctx,[[0,-18],[18,0],[0,18],[-18,0]]);ctx.fill();ctx.stroke();ctx.restore();}
  }

  class RiftHazard{
    constructor(game,x,y,angle){this.game=game;this.x=x;this.y=y;this.angle=angle;this.length=420;this.width=54;this.life=4.2;this.maxLife=4.2;this.telegraph=1.05;this.tick=0;this.dead=false;this.critical=true;}
    update(dt){
      this.life-=dt;
      if(this.life<this.maxLife-this.telegraph){
        this.tick-=dt;
        if(this.tick<=0){this.tick=.45;const p=this.game.player,ex=this.x+Math.cos(this.angle)*this.length,ey=this.y+Math.sin(this.angle)*this.length;if(pointToSegmentDistance(p.x,p.y,this.x-Math.cos(this.angle)*this.length,this.y-Math.sin(this.angle)*this.length,ex,ey)<p.radius+this.width*.5)p.takeDamage(Math.max(5,Math.round(p.maxHp*.07)),this.game);}
      }
      if(this.life<=0)this.dead=true;
    }
    draw(ctx,cam){
      const elapsed=this.maxLife-this.life,active=elapsed>=this.telegraph,alpha=active?clamp(this.life/1.2,0,1):.55+.35*Math.sin(elapsed*16);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.rotate(this.angle);ctx.fillStyle=active?rgba("#ff5268",.2*alpha):rgba("#ffd447",.1);ctx.strokeStyle=active?rgba("#fff7dc",.82*alpha):rgba("#ffd447",alpha);ctx.lineWidth=active?6:4;ctx.setLineDash(active?[]:[18,12]);ctx.fillRect(-this.length,-this.width/2,this.length*2,this.width);ctx.strokeRect(-this.length,-this.width/2,this.length*2,this.width);ctx.setLineDash([]);ctx.restore();
    }
  }

  class AbyssPulse{
    constructor(game,x,y,radius){this.game=game;this.x=x;this.y=y;this.radius=radius;this.life=2.7;this.maxLife=2.7;this.triggered=false;this.dead=false;this.critical=true;}
    update(dt){
      this.life-=dt;
      if(!this.triggered&&this.life<=.45){
        this.triggered=true;
        const player=this.game.player;
        if(U.dist2(player.x,player.y,this.x,this.y)>this.radius*this.radius)player.takeDamage(Math.max(8,Math.round(player.maxHp*.16)),this.game);
        this.game.addEffect(new SystemPulse(this.x,this.y,this.radius,"#b45cff",.7,false));
        this.game.shake(12,.35);
      }
      if(this.life<=0)this.dead=true;
    }
    draw(ctx,cam){
      const progress=1-this.life/this.maxLife,pulse=.65+.35*Math.sin(progress*25);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.fillStyle=rgba("#42e8bd",.06);ctx.strokeStyle=rgba("#42e8bd",.65*pulse);ctx.lineWidth=6;ctx.setLineDash([18,12]);ctx.lineDashOffset=-performance.now()*.05;ctx.beginPath();ctx.arc(0,0,this.radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=rgba("#090718",.25*progress);ctx.beginPath();ctx.rect(-this.game.viewW,-this.game.viewH,this.game.viewW*2,this.game.viewH*2);ctx.arc(0,0,this.radius,0,Math.PI*2,true);ctx.fill("evenodd");ctx.restore();
    }
  }

  function enemiesInRadius(game,x,y,radius){
    const result=[];const r2=radius*radius;
    for(const enemy of game.enemies){if(!enemy.dead&&U.dist2(x,y,enemy.x,enemy.y)<=Math.pow(radius+enemy.radius,2))result.push(enemy);}
    return result;
  }

  function pointToSegmentDistance(px,py,ax,ay,bx,by){
    const dx=bx-ax,dy=by-ay,length2=dx*dx+dy*dy;
    if(length2<=.0001)return Math.hypot(px-ax,py-ay);
    const t=clamp(((px-ax)*dx+(py-ay)*dy)/length2,0,1);
    return Math.hypot(px-(ax+dx*t),py-(ay+dy*t));
  }

  function nearestTargets(game,count,range=1100,origin){
    const source=origin||game.player,items=[];
    for(const enemy of game.enemies){if(enemy.dead)continue;const distance=U.dist2(source.x,source.y,enemy.x,enemy.y);if(distance<=range*range)items.push({enemy,distance});}
    items.sort((a,b)=>a.distance-b.distance);
    return items.slice(0,count).map(item=>item.enemy);
  }

  function powerDamage(game,id,multiplier,scale=1){
    const player=game.player;
    const levelScale=1+Math.max(0,player.level-1)*.055;
    const lowBonus=player.hp/Math.max(1,player.maxHp)<=.35?(player.lowPowerBonus||0):0;
    const evolvedMul=isEvolved(player,id)?1.22:1;
    return Math.max(1,Math.round(
      player.atk*levelScale*(player.systemDamageMul||1)*(game._stageDamageMul||1)*categoryMultiplier(player,id)*(1+lowBonus)*evolvedMul*multiplier*scale
    ));
  }

  function areaDamage(game,x,y,radius,damage,source,textLimit=6,includeBoss=true){
    let shown=0;
    withDamageSource(game,source,()=>{
      for(const enemy of enemiesInRadius(game,x,y,radius)){
        const previousTexts=game.damageTexts.length;
        game.damageEnemy(enemy,damage,false);
        if(shown++>=textLimit&&game.damageTexts.length>previousTexts)game.damageTexts.pop();
      }
      if(includeBoss&&game.boss&&!game.boss.dead&&U.dist2(x,y,game.boss.x,game.boss.y)<=Math.pow(radius+game.boss.radius,2))game.damageBoss(damage,false);
    });
  }

  function lineDamage(game,ax,ay,bx,by,width,damage,source,textLimit=6){
    let shown=0;
    withDamageSource(game,source,()=>{
      for(const enemy of game.enemies){
        if(enemy.dead||pointToSegmentDistance(enemy.x,enemy.y,ax,ay,bx,by)>enemy.radius+width)continue;
        const previousTexts=game.damageTexts.length;game.damageEnemy(enemy,damage,false);if(shown++>=textLimit&&game.damageTexts.length>previousTexts)game.damageTexts.pop();
      }
      if(game.boss&&!game.boss.dead&&pointToSegmentDistance(game.boss.x,game.boss.y,ax,ay,bx,by)<=game.boss.radius+width)game.damageBoss(damage,false);
    });
  }

  function spawnEnemyShot(game,x,y,angle,speed,damage,radius,color){
    if(game.enemyProjectiles.length>=CONFIG.MAX_ENEMY_PROJECTILES)return;
    game.enemyProjectiles.push(new EnemyProjectile(x,y,Math.cos(angle)*speed,Math.sin(angle)*speed,damage,radius,color));
  }

  function radialShots(game,source,count,speed,damage,offset=0,color=source.color||"#ff5268"){
    for(let i=0;i<count;i++)spawnEnemyShot(game,source.x,source.y,offset+i/count*Math.PI*2,speed,damage,7,color);
  }

  function fanShots(game,source,player,count,spread,speed,damage,color=source.color||"#ff5268"){
    const base=U.angle(source.x,source.y,player.x,player.y);
    for(let i=0;i<count;i++){
      const angle=base+(i-(count-1)/2)*(spread/Math.max(1,count-1));
      spawnEnemyShot(game,source.x,source.y,angle,speed,damage,7,color);
    }
  }

  function queueCast(game,item){game._delayedSystemCasts.push(item);}

  /* ============================== 権能定義 / 発動 ============================== */
  function getPowerStats(player,id,rank=rankOf(player,id)){
    const r=clamp(rank,1,3),area=player?.systemAreaMul||1,control=player?.controlDurationMul||1,evolved=isEvolved(player,id);
    switch(id){
      case"solar_funeral":return{cooldown:[9,7.4,6][r-1],radius:[340,440,560][r-1]*area,damage:[2.4,3.35,4.55][r-1],pulses:evolved?2:1};
      case"world_cutter":return{cooldown:[10.5,8.4,6.6][r-1],range:1320,width:[82,116,152][r-1]*area,damage:[3.25,4.55,6.1][r-1],cross:evolved};
      case"storm_throne":return{cooldown:[7.2,5.9,4.8][r-1],targets:[7,12,18][r-1]+(evolved?4:0),damage:[1.5,2.15,3][r-1],chain:evolved?1:0};
      case"gravity_coffin":return{cooldown:[12,9.8,7.8][r-1],duration:[2.3,2.7,3.1][r-1]*control,radius:[240,300,370][r-1]*area,damage:[3,4.2,5.7][r-1]};
      case"meteor_scripture":return{cooldown:[9.5,7.7,6.1][r-1],count:[3,5,8][r-1]+(evolved?2:0),radius:[145,175,210][r-1]*area,damage:[2.5,3.4,4.6][r-1]};
      case"razor_constellation":return{count:[3,5,7][r-1]+(evolved?2:0),radius:[112,132,154][r-1]*area,damage:[.95,1.35,1.85][r-1],hitCd:[.38,.31,.25][r-1]*(evolved ? .78 : 1)};
      case"comet_wake":return{spacing:[74,58,44][r-1]*(evolved ? .82 : 1),radius:[105,132,162][r-1]*area,damage:[1.15,1.6,2.2][r-1]};
      case"mirror_legion":return{cooldown:[1.45,1.16,.92][r-1],count:[2,3,4][r-1]+(evolved?1:0),damage:[.9,1.2,1.55][r-1],cross:evolved};
      case"void_choir":return{cooldown:[8.2,6.5,5.1][r-1],rays:[12,18,26][r-1],width:[26,34,44][r-1]*area,damage:[1.35,1.85,2.55][r-1],volleys:evolved?2:1};
      case"doom_bloom":return{kills:[16,12,9][r-1]*(evolved ? .8 : 1),targets:[8,13,20][r-1],damage:[1.35,1.9,2.65][r-1]};
      case"black_sun":return{orbit:[190,220,250][r-1]*area,radius:[82,105,130][r-1]*area,dps:[2.3,3.35,4.8][r-1],count:evolved?2:1};
      case"time_execution":return{cooldown:[13,10.5,8.2][r-1],duration:[1.35,1.9,2.55][r-1]*control*(evolved?1.25:1),damage:[1.9,2.65,3.65][r-1],execute:evolved ? .18 : 0};
      case"leviathan_shell":return{cooldown:[14,10.8,8][r-1],radius:[300,390,500][r-1]*area,damage:[2.4,3.35,4.65][r-1],charges:evolved?2:1};
      case"blood_eclipse":return{cooldown:[18,14,10][r-1],duration:[2.1,2.7,3.4][r-1]*control,radius:[260,340,430][r-1]*area,pulse:[.65,.85,1.15][r-1],threshold:evolved ? .45 : .35,pulseInterval:evolved ? .36 : .5};
      case"hunter_verdict":return{kills:[10,7,5][r-1]*(evolved ? .72 : 1),execute:[.36,.48,.62][r-1]+(evolved ? .08 : 0),boss:[.08,.12,.17][r-1]+(evolved ? .04 : 0)};
      case"prism_web":return{cooldown:[5.8,4.6,3.6][r-1],nodes:[6,10,15][r-1]+(evolved?3:0),width:[24,31,40][r-1]*area,damage:[1.25,1.75,2.4][r-1],pulses:evolved?2:1};
      case"chaos_oracle":return{cooldown:[7,5.7,4.5][r-1],power:[.78,1,1.28][r-1]*(evolved?1.12:1)};
      case"treasure_singularity":return{radius:[420,560,720][r-1]*area,damage:[3.2,4.8,6.8][r-1],exp:[.35,.65,1][r-1],mutation:evolved ? .22 : 0};
      case"overdrive_contract":return{cooldown:Math.pow(evolved ? .79 : .84,r),hp:Math.pow(.92,r)};
      case"abyss_banquet":return{gems:Math.round([32,23,16][r-1]*(evolved ? .72 : 1)),radius:[430,560,720][r-1]*area,damage:[2.2,3.2,4.6][r-1],heal:[.05,.08,.12][r-1]};
      default:return{};
    }
  }

  function powerLines(player,id,rank=rankOf(player,id)){
    const stats=getPowerStats(player,id,rank);
    switch(id){
      case"solar_funeral":return[`半径 ${Math.round(stats.radius)}`,`攻撃力 ×${formatNumber(stats.damage)}`,`${formatNumber(stats.cooldown)}秒ごと${stats.pulses>1?" / 2連":""}`];
      case"world_cutter":return[`射程 ${stats.range} / 幅 ${Math.round(stats.width)}`,`攻撃力 ×${formatNumber(stats.damage)}`,`${formatNumber(stats.cooldown)}秒ごと${stats.cross?" / 十字斬":""}`];
      case"storm_throne":return[`最大 ${stats.targets}体`,`1体へ ×${formatNumber(stats.damage)}`,`${formatNumber(stats.cooldown)}秒ごと${stats.chain?" / 追加連鎖":""}`];
      case"gravity_coffin":return[`吸引半径 ${Math.round(stats.radius)}`,`収束 ${formatNumber(stats.duration)}秒 → ×${formatNumber(stats.damage)}`,`再設置 ${formatNumber(stats.cooldown)}秒`];
      case"meteor_scripture":return[`流星 ${stats.count}発 / 半径 ${Math.round(stats.radius)}`,`1発 ×${formatNumber(stats.damage)}`,`再詠唱 ${formatNumber(stats.cooldown)}秒`];
      case"razor_constellation":return[`刃 ${stats.count}枚 / 公転 ${Math.round(stats.radius)}`,`1Hit ×${formatNumber(stats.damage)}`,`再Hit ${formatNumber(stats.hitCd)}秒`];
      case"comet_wake":return[`移動 ${Math.round(stats.spacing)}ごと`,`爆発半径 ${Math.round(stats.radius)}`,`攻撃力 ×${formatNumber(stats.damage)}`];
      case"mirror_legion":return[`鏡像 ${stats.count}機`,`各砲撃 ×${formatNumber(stats.damage)}`,`射撃 ${formatNumber(stats.cooldown)}秒`];
      case"void_choir":return[`光条 ${stats.rays}本 / 幅 ${Math.round(stats.width)}`,`攻撃力 ×${formatNumber(stats.damage)}`,`再発動 ${formatNumber(stats.cooldown)}秒${stats.volleys>1?" / 2斉射":""}`];
      case"doom_bloom":return[`必要撃破 ${Math.round(stats.kills)}体`,`最大 ${stats.targets}体`,`1体へ ×${formatNumber(stats.damage)}`];
      case"black_sun":return[`恒星 ${stats.count}個 / 公転 ${Math.round(stats.orbit)}`,`接触半径 ${Math.round(stats.radius)}`,`毎秒 ×${formatNumber(stats.dps)}`];
      case"time_execution":return[`完全停止 ${formatNumber(stats.duration)}秒`,`終了時 全敵へ ×${formatNumber(stats.damage)}`,`再発動 ${formatNumber(stats.cooldown)}秒`];
      case"leviathan_shell":return[`防壁 ${stats.charges}枚`,`破壊時 半径 ${Math.round(stats.radius)}`,`再生 ${formatNumber(stats.cooldown)}秒`];
      case"blood_eclipse":return[`HP${Math.round(stats.threshold*100)}%以下`,`無敵 ${formatNumber(stats.duration)}秒`,`1波 ×${formatNumber(stats.pulse)}`];
      case"hunter_verdict":return[`必要撃破 ${Math.round(stats.kills)}体`,`雑魚処刑 ${Math.round(stats.execute*100)}%以下`,`ボス最大HP ${Math.round(stats.boss*100)}%`];
      case"prism_web":return[`接続 ${stats.nodes}体 / 幅 ${Math.round(stats.width)}`,`攻撃力 ×${formatNumber(stats.damage)}`,`再展開 ${formatNumber(stats.cooldown)}秒`];
      case"chaos_oracle":return[`4権能から抽選`,`抽選威力 ×${formatNumber(stats.power)}`,`再抽選 ${formatNumber(stats.cooldown)}秒`];
      case"treasure_singularity":return[`爆発半径 ${Math.round(stats.radius)}`,`攻撃力 ×${formatNumber(stats.damage)}`,`次Lv経験値 ${Math.round(stats.exp*100)}%`];
      case"overdrive_contract":return[`権能CD ×${formatNumber(stats.cooldown)}`,`最大HP段階 ×${formatNumber(stats.hp)}`,`火力低下なし`];
      case"abyss_banquet":return[`必要ジェム ${stats.gems}個`,`半径 ${Math.round(stats.radius)} / ×${formatNumber(stats.damage)}`,`最大HP ${Math.round(stats.heal*100)}%回復`];
      default:return[];
    }
  }

  function acquirePower(player,id){
    const def=POWER_CATALOG[id];if(!def)return false;
    player.upgradeRanks=player.upgradeRanks||{};
    const before=rankOf(player,id);
    if(before>=def.max)return false;
    player.upgradeRanks[id]=before+1;
    if(id==="overdrive_contract"){
      const ratio=player.hp/Math.max(1,player.maxHp);
      player.maxHp=Math.max(1,Math.round(player.maxHp*.92));
      player.hp=Math.max(1,Math.round(player.maxHp*ratio));
    }
    return true;
  }

  function evolvePower(game,id){
    if(!POWER_CATALOG[id]||rankOf(game.player,id)<POWER_CATALOG[id].max||game.player.evolutionCores<=0)return false;
    game.player.powerEvolutions=game.player.powerEvolutions||{};
    if(game.player.powerEvolutions[id])return false;
    game.player.evolutionCores--;
    game.player.powerEvolutions[id]=true;
    game._runStats?.evolutions.push(id);
    game.showSystemToast(EVOLUTIONS[id].icon,EVOLUTIONS[id].name,EVOLUTIONS[id].summary,`${POWER_CATALOG[id].name}が最終形態へ進化` ,CATEGORY_INFO[POWER_CATALOG[id].category].color);
    return true;
  }

  function acquireSynergy(game,id){
    const synergy=SYNERGIES[id];if(!synergy||hasSynergy(game.player,id))return false;
    game.player.powerSynergies=game.player.powerSynergies||{};
    game.player.powerSynergies[id]=true;
    game._runStats?.synergies.push(id);
    game.showSystemToast(synergy.icon,synergy.name,synergy.summary,"共鳴成立", "#ffd447");
    return true;
  }

  function effectiveCooldown(game,base){
    return Math.max(.22,base*(game.player.systemCooldownMul||1)*(game._stageCooldownMul||1));
  }

  function castSolar(game,rank,scale=1,origin){
    const stats=getPowerStats(game.player,"solar_funeral",rank),x=origin?.x??game.player.x,y=origin?.y??game.player.y;
    areaDamage(game,x,y,stats.radius,powerDamage(game,"solar_funeral",stats.damage,scale),"solar_funeral",8);
    game.addEffect(new SystemPulse(x,y,stats.radius,"#ff5268",.7));game.shake(12,.3);game.sound.explosion();
    if(stats.pulses>1)queueCast(game,{delay:.42,type:"solar_echo",x,y,rank,scale:.72});
  }

  function castWorldCutter(game,rank,scale=1,targetPoint){
    const stats=getPowerStats(game.player,"world_cutter",rank),player=game.player;
    let target=targetPoint;
    if(!target){const enemy=nearestTargets(game,1,1500)[0]||(game.boss&&!game.boss.dead?game.boss:null);if(!enemy)return;target=enemy;}
    const angle=U.angle(player.x,player.y,target.x,target.y),endX=player.x+Math.cos(angle)*stats.range,endY=player.y+Math.sin(angle)*stats.range,damage=powerDamage(game,"world_cutter",stats.damage,scale);
    lineDamage(game,player.x,player.y,endX,endY,stats.width,damage,"world_cutter",8);game.addEffect(new SystemBeam(player.x,player.y,endX,endY,stats.width,"#ff5268",.4));game.shake(15,.24);game.sound.laser();
    if(stats.cross){const angle2=angle+Math.PI/2,ax=target.x-Math.cos(angle2)*stats.range*.55,ay=target.y-Math.sin(angle2)*stats.range*.55,bx=target.x+Math.cos(angle2)*stats.range*.55,by=target.y+Math.sin(angle2)*stats.range*.55;lineDamage(game,ax,ay,bx,by,stats.width*.72,Math.round(damage*.72),"world_cutter",5);game.addEffect(new SystemBeam(ax,ay,bx,by,stats.width*.72,"#ffd447",.36));}
  }

  function castStorm(game,rank,scale=1){
    const stats=getPowerStats(game.player,"storm_throne",rank),targets=nearestTargets(game,stats.targets,1200),damage=powerDamage(game,"storm_throne",stats.damage,scale);
    withDamageSource(game,"storm_throne",()=>{
      targets.forEach((enemy,index)=>{game.addEffect(new LightningEffect(game.player.x,game.player.y,enemy.x,enemy.y,index%2?"#b45cff":"#65d9ff",.22,7));game.damageEnemy(enemy,damage,false);if(stats.chain){const next=nearestTargets(game,1,260,enemy).find(item=>item!==enemy);if(next){game.addEffect(new LightningEffect(enemy.x,enemy.y,next.x,next.y,"#ffd447",.18,5));game.damageEnemy(next,Math.round(damage*.58),false);}}});
      if(game.boss&&!game.boss.dead&&targets.length<stats.targets){game.addEffect(new LightningEffect(game.player.x,game.player.y,game.boss.x,game.boss.y,"#ffd447",.24,9));game.damageBoss(damage,false);}
    });
    if(targets.length)game.sound.lightning();
  }

  function castGravity(game,rank,scale=1){
    const targets=nearestTargets(game,12,1100);let x=game.player.x,y=game.player.y;
    if(targets.length){x=targets.reduce((sum,e)=>sum+e.x,0)/targets.length;y=targets.reduce((sum,e)=>sum+e.y,0)/targets.length;}
    const stats=getPowerStats(game.player,"gravity_coffin",rank);game.addEffect(new GravityField(game,x,y,rank,scale));game.addEffect(new SystemWarning(x,y,{radius:stats.radius,color:"#b45cff",life:.55}));
  }

  function castMeteors(game,rank,scale=1){
    const stats=getPowerStats(game.player,"meteor_scripture",rank),targets=nearestTargets(game,stats.count,1250);
    for(const enemy of targets)game.addEffect(new MeteorMarker(game,enemy.x,enemy.y,rank,scale));
    if(game.boss&&!game.boss.dead&&targets.length<stats.count)game.addEffect(new MeteorMarker(game,game.boss.x,game.boss.y,rank,scale));
  }

  function castMirror(game,rank,scale=1){
    const stats=getPowerStats(game.player,"mirror_legion",rank),targets=nearestTargets(game,stats.count,1150),damage=powerDamage(game,"mirror_legion",stats.damage,scale),player=game.player;
    withDamageSource(game,"mirror_legion",()=>targets.forEach((enemy,index)=>{const angle=player.animT*1.4+index/stats.count*Math.PI*2,x=player.x+Math.cos(angle)*86,y=player.y+Math.sin(angle)*86;game.addEffect(new SystemBeam(x,y,enemy.x,enemy.y,15,"#65d9ff",.24));game.damageEnemy(enemy,damage,false);if(stats.cross){const second=targets[(index+1)%targets.length];if(second&&second!==enemy){game.addEffect(new SystemBeam(x,y,second.x,second.y,9,"#b45cff",.2));game.damageEnemy(second,Math.round(damage*.48),false);}}}));
  }

  function choirVolley(game,rank,scale,rotation,origin,source="void_choir"){
    const stats=getPowerStats(game.player,"void_choir",rank),player=game.player,x=origin?.x??player.x,y=origin?.y??player.y,range=1350,damage=powerDamage(game,"void_choir",stats.damage,scale),step=Math.PI*2/stats.rays;
    withDamageSource(game,source,()=>{
      for(const enemy of game.enemies){if(enemy.dead)continue;const dx=enemy.x-x,dy=enemy.y-y,distance=Math.hypot(dx,dy);if(distance>range)continue;const angle=(Math.atan2(dy,dx)-rotation+Math.PI*8)%(Math.PI*2),delta=Math.min(angle%step,step-angle%step);if(Math.sin(delta)*distance<=stats.width+enemy.radius)game.damageEnemy(enemy,damage,false);}
      if(game.boss&&!game.boss.dead){const dx=game.boss.x-x,dy=game.boss.y-y,distance=Math.hypot(dx,dy),angle=(Math.atan2(dy,dx)-rotation+Math.PI*8)%(Math.PI*2),delta=Math.min(angle%step,step-angle%step);if(distance<=range&&Math.sin(delta)*distance<=stats.width+game.boss.radius)game.damageBoss(damage,false);}
    });
    for(let i=0;i<stats.rays;i++){const angle=rotation+i*step;game.addEffect(new SystemBeam(x,y,x+Math.cos(angle)*range,y+Math.sin(angle)*range,stats.width,"#b45cff",.34));}
  }

  function castChoir(game,rank,scale=1){
    const stats=getPowerStats(game.player,"void_choir",rank),rotation=Math.random()*Math.PI*2;choirVolley(game,rank,scale,rotation);
    if(stats.volleys>1)queueCast(game,{delay:.35,type:"choir_echo",rank,scale:.7,rotation:rotation+Math.PI/stats.rays});
    if(hasSynergy(game.player,"eclipse_choir")){const black=getBlackSunPositions(game)[0];if(black)choirVolley(game,rank,.42,rotation+Math.PI/(stats.rays*2),black,"eclipse_choir");}
    game.shake(9,.2);
  }

  function castWeb(game,rank,scale=1){
    const stats=getPowerStats(game.player,"prism_web",rank),targets=nearestTargets(game,stats.nodes,1150);if(targets.length<2)return;
    const points=[{x:game.player.x,y:game.player.y},...targets.map(enemy=>({x:enemy.x,y:enemy.y}))];
    if(hasSynergy(game.player,"infinite_refraction")){const mirror=getMirrorPositions(game);points.splice(1,0,...mirror);}
    const damage=powerDamage(game,"prism_web",stats.damage,scale);
    const pulse=()=>{for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];lineDamage(game,a.x,a.y,b.x,b.y,stats.width,damage,"prism_web",6);game.addEffect(new SystemBeam(a.x,a.y,b.x,b.y,stats.width,"#65d9ff",.32));}};
    pulse();if(stats.pulses>1)queueCast(game,{delay:.38,type:"web_echo",points,damage:Math.round(damage*.62),width:stats.width});
  }

  function castBanquet(game,rank){
    const stats=getPowerStats(game.player,"abyss_banquet",rank),before=game.player.hp;
    areaDamage(game,game.player.x,game.player.y,stats.radius,powerDamage(game,"abyss_banquet",stats.damage),"abyss_banquet",8);
    const heal=Math.round(game.player.maxHp*stats.heal);game.player.hp=Math.min(game.player.maxHp,game.player.hp+heal);
    const overflow=Math.max(0,before+heal-game.player.maxHp);if(isEvolved(game.player,"abyss_banquet")&&overflow>0)game.player._feastShield=(game.player._feastShield||0)+overflow;
    game.addEffect(new SystemPulse(game.player.x,game.player.y,stats.radius,"#42e8bd",.82));game.sound.item();
  }

  function castChaos(game,rank,scale=1){
    const stats=getPowerStats(game.player,"chaos_oracle",rank),pool=["solar_funeral","world_cutter","storm_throne","meteor_scripture"],first=choice(pool);
    castPowerById(game,first,Math.min(3,rank+1),stats.power*scale,false);
    const doubleCast=hasSynergy(game.player,"ruin_engine")&&Math.random()<.28;
    if(doubleCast){const second=choice(pool.filter(id=>id!==first));queueCast(game,{delay:.28,type:"power",id:second,rank:Math.min(3,rank+1),scale:stats.power*.72*scale,allowEcho:false});}
    if(isEvolved(game.player,"chaos_oracle"))queueCast(game,{delay:.55,type:"power",id:first,rank:Math.min(3,rank+1),scale:stats.power*.42*scale,allowEcho:false});
  }

  function castTimeExecution(game,rank){
    const stats=getPowerStats(game.player,"time_execution",rank);game._systemTimeStop=stats.duration;game._timeExecutionDamage=powerDamage(game,"time_execution",stats.damage);game._timeExecutionRank=rank;game._timeBurstPending=true;game.addEffect(new SystemPulse(game.player.x,game.player.y,Math.max(game.viewW,game.viewH),"#65d9ff",stats.duration,false));game.sound.lightning();
  }

  function castPowerById(game,id,rank,scale=1,allowEcho=true){
    switch(id){
      case"solar_funeral":castSolar(game,rank,scale);break;
      case"world_cutter":castWorldCutter(game,rank,scale);break;
      case"storm_throne":castStorm(game,rank,scale);break;
      case"gravity_coffin":castGravity(game,rank,scale);break;
      case"meteor_scripture":castMeteors(game,rank,scale);break;
      case"mirror_legion":castMirror(game,rank,scale);break;
      case"void_choir":castChoir(game,rank,scale);break;
      case"prism_web":castWeb(game,rank,scale);break;
      case"chaos_oracle":castChaos(game,rank,scale);break;
      case"time_execution":castTimeExecution(game,rank);break;
    }
    if(allowEcho&&game.player.systemEchoChance>0&&id!=="chaos_oracle"&&Math.random()<game.player.systemEchoChance)queueCast(game,{delay:.62,type:"power",id,rank,scale:.45,allowEcho:false});
  }

  function timerCast(game,id,dt){
    const rank=rankOf(game.player,id);if(!rank)return;
    const stats=getPowerStats(game.player,id,rank),base=stats.cooldown;if(!base)return;
    game._powerTimers[id]=(game._powerTimers[id]??.4)-dt;
    if(game._powerTimers[id]>0)return;
    game._powerTimers[id]+=effectiveCooldown(game,base);
    castPowerById(game,id,rank,1,true);
  }

  function getMirrorPositions(game){
    const rank=rankOf(game.player,"mirror_legion");if(!rank)return[];
    const stats=getPowerStats(game.player,"mirror_legion",rank),positions=[];
    for(let i=0;i<stats.count;i++){const angle=game.player.animT*1.4+i/stats.count*Math.PI*2;positions.push({x:game.player.x+Math.cos(angle)*86,y:game.player.y+Math.sin(angle)*86});}
    return positions;
  }

  function getBlackSunPositions(game){
    const rank=rankOf(game.player,"black_sun");if(!rank)return[];
    const stats=getPowerStats(game.player,"black_sun",rank),positions=[];
    for(let i=0;i<stats.count;i++){const direction=i%2?-1:1,angle=(game.player._blackSunAngle||0)*direction+i*Math.PI;positions.push({x:game.player.x+Math.cos(angle)*stats.orbit,y:game.player.y+Math.sin(angle)*stats.orbit});}
    return positions;
  }

  function updateContinuousPowers(game,dt,moved){
    const player=game.player;
    let rank=rankOf(player,"razor_constellation");
    if(rank){
      const stats=getPowerStats(player,"razor_constellation",rank),kinetic=hasSynergy(player,"kinetic_guillotine"),movementBoost=kinetic?clamp(moved/8,0,.8):0;
      player._razorAngle=(player._razorAngle||0)+dt*(2.35+rank*.35)*(1+movementBoost);player._razorHits=player._razorHits||new Map();
      for(const [key,time] of player._razorHits){const next=time-dt;if(next<=0)player._razorHits.delete(key);else player._razorHits.set(key,next);}
      const damage=powerDamage(game,"razor_constellation",stats.damage*(1+movementBoost*.45));
      for(let i=0;i<stats.count;i++){
        const angle=player._razorAngle+i/stats.count*Math.PI*2,x=player.x+Math.cos(angle)*stats.radius,y=player.y+Math.sin(angle)*stats.radius;
        for(const enemy of enemiesInRadius(game,x,y,30)){if(player._razorHits.has(enemy.uid))continue;player._razorHits.set(enemy.uid,stats.hitCd);withDamageSource(game,"razor_constellation",()=>game.damageEnemy(enemy,damage,false));}
        if(game.boss&&!game.boss.dead&&U.dist2(x,y,game.boss.x,game.boss.y)<=Math.pow(game.boss.radius+30,2)){const key=`boss_${i}`;if(!player._razorHits.has(key)){player._razorHits.set(key,stats.hitCd);withDamageSource(game,"razor_constellation",()=>game.damageBoss(damage,false));}}
      }
    }

    rank=rankOf(player,"black_sun");
    if(rank){
      const stats=getPowerStats(player,"black_sun",rank);player._blackSunAngle=(player._blackSunAngle||0)+dt*(1.12+rank*.18);player._blackSunTick=(player._blackSunTick||0)-dt;
      if(player._blackSunTick<=0){player._blackSunTick=.2;const damage=powerDamage(game,"black_sun",stats.dps*.2);for(const position of getBlackSunPositions(game))areaDamage(game,position.x,position.y,stats.radius,damage,"black_sun",2);}
    }

    rank=rankOf(player,"comet_wake");
    if(rank&&moved>0){const stats=getPowerStats(player,"comet_wake",rank);player._cometDistance=(player._cometDistance||0)+moved;if(player._cometDistance>=stats.spacing){player._cometDistance%=stats.spacing;game.addEffect(new CometMine(game,player.x,player.y,rank));}}

    rank=rankOf(player,"blood_eclipse");
    if(rank){
      const stats=getPowerStats(player,"blood_eclipse",rank);player._eclipseCd=Math.max(0,(player._eclipseCd||0)-dt);
      if(player._eclipseActive>0){player._eclipseActive-=dt;player.invBuffTimer=Math.max(player.invBuffTimer,.15);player._eclipsePulse=(player._eclipsePulse||0)-dt;if(player._eclipsePulse<=0){player._eclipsePulse=stats.pulseInterval;areaDamage(game,player.x,player.y,stats.radius,powerDamage(game,"blood_eclipse",stats.pulse),"blood_eclipse",4);game.addEffect(new SystemPulse(player.x,player.y,stats.radius,"#ff5268",.38));}}
      else if(player.hp/player.maxHp<=stats.threshold&&player._eclipseCd<=0)activateBloodEclipse(game,stats.duration);
    }

    rank=rankOf(player,"leviathan_shell");
    if(rank||player.permanentShieldRecharge){
      const stats=rank?getPowerStats(player,"leviathan_shell",rank):{cooldown:player.permanentShieldRecharge,charges:1};
      player._shellRecharge=effectiveCooldown(game,stats.cooldown);player._shellTimer=Math.max(0,(player._shellTimer||0)-dt);
      if((player._shellCharges||0)<stats.charges&&player._shellTimer<=0){player._shellCharges=(player._shellCharges||0)+1;player._shellTimer=player._shellRecharge;game.sound.item();game.addEffect(new SystemPulse(player.x,player.y,105,"#42e8bd",.45));}
    }

    if(player._feastShield>0)player._feastShield=Math.max(0,player._feastShield-dt*player.maxHp*.025);
  }

  function activateBloodEclipse(game,durationOverride){
    const rank=rankOf(game.player,"blood_eclipse");if(!rank)return;
    const stats=getPowerStats(game.player,"blood_eclipse",rank);game.player._eclipseActive=Math.max(game.player._eclipseActive||0,durationOverride||stats.duration);game.player._eclipseCd=effectiveCooldown(game,stats.cooldown);game.player._eclipsePulse=0;game.addEffect(new SystemPulse(game.player.x,game.player.y,stats.radius,"#ff5268",.9));
  }

  function updateTimedPowers(game,dt){
    for(const id of ["solar_funeral","world_cutter","storm_throne","gravity_coffin","meteor_scripture","mirror_legion","void_choir","prism_web","chaos_oracle","time_execution"])timerCast(game,id,dt);
  }

  function executeDelayedCast(game,item){
    switch(item.type){
      case"power":castPowerById(game,item.id,item.rank,item.scale,item.allowEcho!==false);break;
      case"solar_echo":castSolar(game,item.rank,item.scale,{x:item.x,y:item.y});break;
      case"choir_echo":choirVolley(game,item.rank,item.scale,item.rotation);break;
      case"web_echo":for(let i=1;i<item.points.length;i++){const a=item.points[i-1],b=item.points[i];lineDamage(game,a.x,a.y,b.x,b.y,item.width,item.damage,"prism_web",4);game.addEffect(new SystemBeam(a.x,a.y,b.x,b.y,item.width*.75,"#b45cff",.28));}break;
      case"mini_gravity":areaDamage(game,item.x,item.y,item.radius,item.damage,"gravity_coffin",4);game.addEffect(new SystemPulse(item.x,item.y,item.radius,"#b45cff",.5));break;
      case"comet_chain":areaDamage(game,item.x,item.y,item.radius,item.damage,"comet_wake",3);game.addEffect(new SystemPulse(item.x,item.y,item.radius,"#65d9ff",.4));break;
      case"boss_action":item.action?.();break;
    }
  }

  function updatePowers(game,dt,moved){
    updateTimedPowers(game,dt);updateContinuousPowers(game,dt,moved);
    for(let index=game._delayedSystemCasts.length-1;index>=0;index--){const item=game._delayedSystemCasts[index];item.delay-=dt;if(item.delay<=0){game._delayedSystemCasts.splice(index,1);executeDelayedCast(game,item);}}
  }

  /* ============================== 敵AI ============================== */
  function nearbySeparation(enemy,game){
    let x=0,y=0,count=0;
    const visit=other=>{if(other===enemy||other.dead)return;const dx=enemy.x-other.x,dy=enemy.y-other.y,d2=dx*dx+dy*dy,min=enemy.radius+other.radius+8;if(d2>.01&&d2<min*min){const distance=Math.sqrt(d2);x+=dx/distance;y+=dy/distance;count++;}};
    if(game._enemySpatial?.forEachNearby)game._enemySpatial.forEachNearby(enemy.x,enemy.y,enemy.radius*3+32,visit);else for(const other of game.enemies)visit(other);
    return count?{x:x/count,y:y/count}:{x:0,y:0};
  }

  function moveEnemy(enemy,dt,player,obstacles,game,angle,speedMultiplier=1){
    const separation=nearbySeparation(enemy,game);let vx=Math.cos(angle)+separation.x*.78,vy=Math.sin(angle)+separation.y*.78;
    for(const obstacle of obstacles){const distance=U.dist(enemy.x,enemy.y,obstacle.x,obstacle.y);if(distance<obstacle.radius+enemy.radius+34){const away=U.angle(obstacle.x,obstacle.y,enemy.x,enemy.y);vx+=Math.cos(away)*1.25;vy+=Math.sin(away)*1.25;}}
    const length=Math.hypot(vx,vy)||1;vx/=length;vy/=length;
    const nx=enemy.x+vx*enemy.speed*speedMultiplier*dt,ny=enemy.y+vy*enemy.speed*speedMultiplier*dt;
    if(!circleHitObstacle(nx,enemy.y,enemy.radius,obstacles))enemy.x=nx;
    if(!circleHitObstacle(enemy.x,ny,enemy.radius,obstacles))enemy.y=ny;
    enemy.x=clamp(enemy.x,enemy.radius,CONFIG.MAP_W-enemy.radius);enemy.y=clamp(enemy.y,enemy.radius,CONFIG.MAP_H-enemy.radius);enemy.facing=Math.atan2(vy,vx);
  }

  function contactEnemy(enemy,player,game,dt){
    if(enemy.contactCd>0)enemy.contactCd-=dt;
    const distance=U.dist(enemy.x,enemy.y,player.x,player.y);
    if(distance<enemy.radius+player.radius&&enemy.contactCd<=0){player.takeDamage(enemy.atk,game);enemy.contactCd=.6;}
    return distance;
  }

  function initEnemySystem(enemy){
    if(enemy._abyssAI)return enemy._abyssAI;
    const hpMultiplier={normal:1.08,fast:1.03,heavy:1.3,ranged:1.12,splitter:1.16,splitmini:1,elite:1.42}[enemy.type]||1;
    const attackMultiplier={normal:1.04,fast:1.08,heavy:1.15,ranged:1.1,splitter:1.08,splitmini:1,elite:1.22}[enemy.type]||1;
    enemy.maxHp=Math.round(enemy.maxHp*hpMultiplier);enemy.hp=enemy.maxHp;enemy.atk=Math.max(1,Math.round(enemy.atk*attackMultiplier));
    enemy._abyssAI={cooldown:U.rand(1.2,3),windup:0,dash:0,pattern:0,dir:{x:1,y:0},pending:null};
    return enemy._abyssAI;
  }

  Enemy.prototype.update=function(dt,player,enemies,obstacles,game){
    this.animT+=dt;this.spawnAge+=dt;if(this.hitFlash>0)this.hitFlash-=dt;if(this._systemGuard>0)this._systemGuard-=dt;
    if(game._systemTimeStop>0)return;
    const ai=initEnemySystem(this);ai.cooldown-=dt;

    if(ai.windup>0){
      ai.windup-=dt;
      if(ai.windup<=0){
        if(this.type==="normal")radialShots(game,this,6,235,this.atk*.62,this.animT*.4);
        else if(this.type==="fast"){ai.dash=.48;const lead=.26,tx=player.x+(player.lastMove?.x||0)*lead,ty=player.y+(player.lastMove?.y||0)*lead,angle=U.angle(this.x,this.y,tx,ty);ai.dir={x:Math.cos(angle),y:Math.sin(angle)};}
        else if(this.type==="heavy"){this._systemGuard=1.15;radialShots(game,this,10,205,this.atk*.7,this.animT*.3);}
        else if(this.type==="ranged")fanShots(game,this,player,5,.8,285,this.atk*.7);
        else if(this.type==="splitter"){for(let i=0;i<3;i++){const angle=i/3*Math.PI*2+this.animT,x=player.x+Math.cos(angle)*U.rand(150,260),y=player.y+Math.sin(angle)*U.rand(150,260);game.addEffect(new SystemMine(game,x,y,this.atk*.68,this.color));}}
        else if(this.type==="elite"){
          const pattern=ai.pattern++%3;
          if(pattern===0)fanShots(game,this,player,7,1.15,315,this.atk*.7);
          else if(pattern===1)radialShots(game,this,16,245,this.atk*.56,this.animT*.65);
          else for(let i=0;i<4;i++){const angle=i/4*Math.PI*2,x=player.x+Math.cos(angle)*220,y=player.y+Math.sin(angle)*220;game.addEffect(new SystemMine(game,x,y,this.atk*.7,"#b45cff"));}
        }
      }
    }

    if(ai.dash>0){
      ai.dash-=dt;const nx=this.x+ai.dir.x*this.speed*5.1*dt,ny=this.y+ai.dir.y*this.speed*5.1*dt;
      if(!circleHitObstacle(nx,ny,this.radius,obstacles)){this.x=nx;this.y=ny;}
      contactEnemy(this,player,game,dt);return;
    }

    const distance=U.dist(this.x,this.y,player.x,player.y),base=U.angle(this.x,this.y,player.x,player.y);let moveAngle=base,speedMultiplier=1;
    if(this.type==="normal"){
      moveAngle+=Math.sin(this.animT*2+this.seed)*.22;
      if(ai.cooldown<=0&&distance<560){ai.cooldown=U.rand(4.2,5.2);ai.windup=.68;game.addEffect(new SystemWarning(this.x,this.y,{radius:130,color:this.color,life:.68}));}
    }else if(this.type==="fast"){
      moveAngle+=Math.sin(this.animT*5+this.seed)*.42;speedMultiplier=1.1;
      if(ai.cooldown<=0&&distance<760){ai.cooldown=U.rand(3.3,4.2);ai.windup=.52;game.addEffect(new SystemWarning(this.x,this.y,{kind:"line",angle:base,length:520,width:34,color:this.color,life:.52}));}
    }else if(this.type==="heavy"){
      speedMultiplier=.82;
      if(ai.cooldown<=0&&distance<650){ai.cooldown=U.rand(5,6.3);ai.windup=.82;game.addEffect(new SystemWarning(this.x,this.y,{radius:180,color:this.color,life:.82}));}
    }else if(this.type==="ranged"){
      const desired=400;if(distance<desired-40)moveAngle=base+Math.PI;else if(distance<desired+40)moveAngle=base+Math.PI/2*(this.avoidAngleOffset>0?1:-1);speedMultiplier=.9;
      if(ai.cooldown<=0&&distance<850){ai.cooldown=U.rand(2.1,2.8);ai.windup=.42;game.addEffect(new SystemWarning(this.x,this.y,{kind:"line",angle:base,length:650,width:22,color:this.color,life:.42}));}
    }else if(this.type==="splitter"){
      moveAngle+=Math.sin(this.animT*1.6+this.seed)*.35;
      if(ai.cooldown<=0&&distance<720){ai.cooldown=U.rand(5.3,6.4);ai.windup=.72;game.addEffect(new SystemWarning(player.x,player.y,{radius:250,color:this.color,life:.72}));}
    }else if(this.type==="splitmini"){
      moveAngle+=Math.sin(this.animT*7+this.seed)*.8;speedMultiplier=1.18;
    }else if(this.type==="elite"){
      moveAngle+=Math.sin(this.animT*.9+this.seed)*.25;
      if(ai.cooldown<=0&&distance<900){ai.cooldown=U.rand(3.4,4.4);ai.windup=.78;game.addEffect(new SystemWarning(this.x,this.y,{radius:230,color:"#b45cff",life:.78}));}
    }
    if(ai.windup<=0)moveEnemy(this,dt,player,obstacles,game,moveAngle,speedMultiplier);
    contactEnemy(this,player,game,dt);
  };

  class SystemMine{
    constructor(game,x,y,damage,color="#ff5268"){this.game=game;this.x=x;this.y=y;this.damage=damage;this.color=color;this.life=2.15;this.maxLife=2.15;this.dead=false;this.critical=true;}
    update(dt){this.life-=dt;if(this.life<=0&&!this.dead){this.dead=true;for(let i=0;i<8;i++)spawnEnemyShot(this.game,this.x,this.y,i/8*Math.PI*2,245,this.damage,7,this.color);}}
    draw(ctx,cam){const progress=1-this.life/this.maxLife,pulse=.7+.3*Math.sin(progress*20);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.rotate(progress*7);ctx.strokeStyle=progress>.35?rgba(this.color,pulse):rgba("#ffd447",pulse);ctx.fillStyle=rgba(this.color,.18);ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,progress>.35?22:14,0,Math.PI*2);ctx.fill();ctx.stroke();for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.fillRect(18,-2,13,4);}ctx.restore();}
  }

  const previousEnemyProjectileUpdate=EnemyProjectile.prototype.update;
  EnemyProjectile.prototype.update=function(dt){
    const game=window.__game;if(game?._systemTimeStop>0)return;
    const bluePhase=game&&stageIndex(game)===1&&game._stageCycle===1;
    previousEnemyProjectileUpdate.call(this,dt*(bluePhase?1.08:1));
  };

  const guardedDamageEnemy=Game.prototype.damageEnemy;
  Game.prototype.damageEnemy=function(enemy,damage,crit){
    const adjusted=enemy?damage*(enemy._systemGuard > 0 ? .32 : 1):damage;
    return guardedDamageEnemy.call(this,enemy,adjusted,crit);
  };

  /* ============================== 固有ボス ============================== */
  function initBossSystem(boss,game){
    if(boss._abyssBoss)return boss._abyssBoss;
    const layer=selectedLayer(game),challenge=game.records.challengeSelected;
    const hpMultiplier=(1+layer*.12)*(challenge==="boss_covenant"?1.35:1)*(game._runEnemyHpBonus||1);
    const attackMultiplier=(1+layer*.08)*(challenge==="boss_covenant"?1.35:1);
    boss.maxHp=Math.round(boss.maxHp*1.5*hpMultiplier);boss.hp=boss.maxHp;boss.atk=Math.round(boss.atk*1.2*attackMultiplier);
    boss._abyssBoss={timer:1.6,pattern:0,windup:0,pending:null,chargeTime:0,chargeDir:{x:1,y:0},phase:1,hidden:0};
    return boss._abyssBoss;
  }

  function moveBossToward(boss,player,obstacles,dt,speedMultiplier=1,angleOffset=0){
    const angle=U.angle(boss.x,boss.y,player.x,player.y)+angleOffset,nx=boss.x+Math.cos(angle)*boss.speed*speedMultiplier*dt,ny=boss.y+Math.sin(angle)*boss.speed*speedMultiplier*dt;
    if(!circleHitObstacle(nx,boss.y,boss.radius,obstacles))boss.x=nx;if(!circleHitObstacle(boss.x,ny,boss.radius,obstacles))boss.y=ny;
    boss.x=clamp(boss.x,boss.radius,CONFIG.MAP_W-boss.radius);boss.y=clamp(boss.y,boss.radius,CONFIG.MAP_H-boss.radius);boss.facing=angle;
  }

  function bossContact(boss,player,game,dt,multiplier=1){
    if(boss.contactCd>0)boss.contactCd-=dt;
    if(U.dist(boss.x,boss.y,player.x,player.y)<boss.radius+player.radius&&boss.contactCd<=0){player.takeDamage(boss.atk*multiplier,game);boss.contactCd=.6;}
  }

  function scheduleBossAction(game,boss,windup,warning,action){
    const state=boss._abyssBoss;state.windup=windup;state.pending=action;if(warning)game.addEffect(warning);
  }

  function wormPattern(boss,game,phase){
    const state=boss._abyssBoss,pattern=state.pattern++%3,player=game.player;
    if(pattern===0){
      const lead=.35,tx=player.x+(player.lastMove?.x||0)*lead,ty=player.y+(player.lastMove?.y||0)*lead,angle=U.angle(boss.x,boss.y,tx,ty);
      scheduleBossAction(game,boss,.75,new SystemWarning(boss.x,boss.y,{kind:"line",angle,length:760,width:58,color:"#ff5268",life:.75}),()=>{state.chargeDir={x:Math.cos(angle),y:Math.sin(angle)};state.chargeTime=.72+(phase-1)*.12;});
    }else if(pattern===1){
      scheduleBossAction(game,boss,.7,new SystemWarning(boss.x,boss.y,{radius:220,color:"#ffd447",life:.7}),()=>{radialShots(game,boss,14+phase*4,250+phase*18,boss.atk*.58,boss.animT*.55,"#ff5268");game.addEffect(new SystemPulse(boss.x,boss.y,230,"#ff5268",.55));});
    }else{
      scheduleBossAction(game,boss,.9,new SystemWarning(player.x,player.y,{radius:280,color:"#b45cff",life:.9}),()=>{const angle=Math.random()*Math.PI*2;boss.x=clamp(player.x+Math.cos(angle)*430,70,CONFIG.MAP_W-70);boss.y=clamp(player.y+Math.sin(angle)*430,70,CONFIG.MAP_H-70);for(let i=0;i<3+phase;i++){const a=i/(3+phase)*Math.PI*2;game.addEffect(new SystemMine(game,player.x+Math.cos(a)*220,player.y+Math.sin(a)*220,boss.atk*.68,"#b45cff"));}});
    }
  }

  function throneGuardsAlive(game){return game.enemies.some(enemy=>!enemy.dead&&enemy._throneGuard);}
  function thronePattern(boss,game,phase){
    const state=boss._abyssBoss,pattern=state.pattern++%3,player=game.player;
    if(pattern===0&&!throneGuardsAlive(game)){
      scheduleBossAction(game,boss,.85,new SystemWarning(boss.x,boss.y,{radius:250,color:"#ffd447",life:.85}),()=>{for(let i=0;i<2+phase;i++){if(game.enemies.length>=CONFIG.MAX_ENEMIES)break;const angle=i/(2+phase)*Math.PI*2,guard=new Enemy(phase>=3?"elite":"heavy",boss.x+Math.cos(angle)*135,boss.y+Math.sin(angle)*135,game.currentScale);guard._throneGuard=true;guard.color="#ffd447";game.enemies.push(guard);}game.addEffect(new SystemPulse(boss.x,boss.y,240,"#ffd447",.7));});
    }else if(pattern===1){
      const angle=U.angle(boss.x,boss.y,player.x,player.y);scheduleBossAction(game,boss,.65,new SystemWarning(boss.x,boss.y,{kind:"line",angle,length:760,width:80,color:"#ffd447",life:.65}),()=>{for(let wave=0;wave<3;wave++)queueCast(game,{delay:wave*.22,type:"boss_action",action:()=>fanShots(game,boss,player,7+phase,1.15,285+wave*15,boss.atk*.62,"#ffd447")});});
    }else{
      scheduleBossAction(game,boss,.85,new SystemWarning(boss.x,boss.y,{kind:"cross",angle:boss.animT*.3,length:720,width:48,color:"#ff5268",life:.85}),()=>{const angle=boss.animT*.3;for(const offset of[0,Math.PI/2]){const a=angle+offset,ax=boss.x-Math.cos(a)*720,ay=boss.y-Math.sin(a)*720,bx=boss.x+Math.cos(a)*720,by=boss.y+Math.sin(a)*720;game.addEffect(new SystemBeam(ax,ay,bx,by,48,"#ff5268",.45));if(pointToSegmentDistance(player.x,player.y,ax,ay,bx,by)<player.radius+48)player.takeDamage(boss.atk*1.18,game);}});
    }
  }

  function stormPattern(boss,game,phase){
    const state=boss._abyssBoss,pattern=state.pattern++%3,player=game.player;
    if(pattern===0){
      const x=player.x,y=player.y,angle=Math.random()*Math.PI; scheduleBossAction(game,boss,.8,new SystemWarning(x,y,{kind:"cross",angle,length:760,width:44,color:"#65d9ff",life:.8}),()=>{for(const offset of[0,Math.PI/2]){const a=angle+offset,ax=x-Math.cos(a)*760,ay=y-Math.sin(a)*760,bx=x+Math.cos(a)*760,by=y+Math.sin(a)*760;game.addEffect(new SystemBeam(ax,ay,bx,by,44,"#65d9ff",.42));if(pointToSegmentDistance(player.x,player.y,ax,ay,bx,by)<player.radius+44)player.takeDamage(boss.atk*1.12,game);}});
    }else if(pattern===1){
      scheduleBossAction(game,boss,.65,new SystemWarning(boss.x,boss.y,{radius:250,color:"#b45cff",life:.65}),()=>{for(let wave=0;wave<3+phase;wave++)queueCast(game,{delay:wave*.16,type:"boss_action",action:()=>radialShots(game,boss,12+phase*2,250+wave*10,boss.atk*.52,boss.animT+wave*.17,"#65d9ff")});});
    }else{
      scheduleBossAction(game,boss,.7,new SystemWarning(player.x,player.y,{radius:260,color:"#ffd447",life:.7}),()=>{for(let i=0;i<3+phase;i++){const angle=i/(3+phase)*Math.PI*2,radius=150+i*35;game.addEffect(new SystemMine(game,player.x+Math.cos(angle)*radius,player.y+Math.sin(angle)*radius,boss.atk*.66,"#65d9ff"));}});
    }
  }

  function heraldPattern(boss,game,phase){
    const state=boss._abyssBoss,pattern=state.pattern++%4,player=game.player;
    if(pattern===0){
      const angle=U.angle(boss.x,boss.y,player.x,player.y);scheduleBossAction(game,boss,.9,new SystemWarning(boss.x,boss.y,{kind:"cross",angle,length:950,width:58,color:"#ff5268",life:.9}),()=>{for(const offset of[0,Math.PI/2]){const a=angle+offset,ex=boss.x+Math.cos(a)*1450,ey=boss.y+Math.sin(a)*1450;game.addEffect(new SystemBeam(boss.x,boss.y,ex,ey,58,"#ff5268",.5));if(pointToSegmentDistance(player.x,player.y,boss.x,boss.y,ex,ey)<player.radius+58)player.takeDamage(boss.atk*1.25,game);}});
    }else if(pattern===1){
      scheduleBossAction(game,boss,.72,new SystemWarning(player.x,player.y,{radius:300,color:"#ffd447",life:.72}),()=>{for(let i=0;i<5+phase;i++){const angle=i/(5+phase)*Math.PI*2,radius=i%2?190:285;game.addEffect(new SystemMine(game,player.x+Math.cos(angle)*radius,player.y+Math.sin(angle)*radius,boss.atk*.7,i%2?"#ffd447":"#b45cff"));}});
    }else if(pattern===2){
      scheduleBossAction(game,boss,.82,new SystemWarning(boss.x,boss.y,{radius:285,color:"#b45cff",life:.82}),()=>{for(let i=0;i<Math.min(3,phase)&&game.enemies.length<CONFIG.MAX_ENEMIES;i++){const angle=i/Math.min(3,phase)*Math.PI*2,enemy=new Enemy("elite",boss.x+Math.cos(angle)*140,boss.y+Math.sin(angle)*140,game.currentScale);enemy.color="#b45cff";game.enemies.push(enemy);}radialShots(game,boss,14+phase*2,235,boss.atk*.58,boss.animT,"#b45cff");});
    }else{
      const radius=Math.max(190,330-phase*35),x=clamp(player.x+U.rand(-180,180),radius,CONFIG.MAP_W-radius),y=clamp(player.y+U.rand(-180,180),radius,CONFIG.MAP_H-radius);scheduleBossAction(game,boss,.35,null,()=>game.addEffect(new AbyssPulse(game,x,y,radius)));
    }
  }

  Boss.prototype.update=function(dt,player,enemies,obstacles,game){
    this.animT+=dt;this.spawnAge+=dt;if(this.hitFlash>0)this.hitFlash-=dt;
    const state=initBossSystem(this,game);if(game._systemTimeStop>0)return;
    const hpRatio=this.hp/Math.max(1,this.maxHp),phase=hpRatio>.67?1:hpRatio>.34?2:3;
    if(phase!==state.phase){
      state.phase=phase;game._bossClarityTimer=.75;
      game.showSystemToast("PHASE",this.name,phase===2?"攻撃パターンが加速した。":"最終局面。固有攻撃が最大強度へ移行。",`HP ${Math.round(hpRatio*100)}% / PHASE ${phase}`,phase===2?"#ffd447":"#ff5268");
    }

    if(state.chargeTime>0){
      state.chargeTime-=dt;const nx=this.x+state.chargeDir.x*this.speed*(6.2+phase*.6)*dt,ny=this.y+state.chargeDir.y*this.speed*(6.2+phase*.6)*dt;if(!circleHitObstacle(nx,ny,this.radius,obstacles)){this.x=nx;this.y=ny;}else state.chargeTime=0;if(Math.random()<.22)game.addEffect(new SystemMine(game,this.x,this.y,this.atk*.48,"#ff5268"));bossContact(this,player,game,dt,1.35);return;
    }

    if(state.windup>0){state.windup-=dt;if(state.windup<=0&&state.pending){const action=state.pending;state.pending=null;action();}}
    else{
      state.timer-=dt;
      if(state.timer<=0){state.timer=Math.max(1.25,3.3-phase*.35-selectedLayer(game)*.035);const variant=this.index%4;if(variant===0)wormPattern(this,game,phase);else if(variant===1)thronePattern(this,game,phase);else if(variant===2)stormPattern(this,game,phase);else heraldPattern(this,game,phase);}
      const variant=this.index%4;if(variant===1)moveBossToward(this,player,obstacles,dt,.48,Math.sin(this.animT*.45)*.5);else if(variant===2)moveBossToward(this,player,obstacles,dt,.78,Math.PI/2*(Math.sin(this.animT*.3)>0?1:-1));else moveBossToward(this,player,obstacles,dt,.72+phase*.08,Math.sin(this.animT*.7)*.2);
    }
    bossContact(this,player,game,dt);
  };

  const bossDamageWithGuard=Game.prototype.damageBoss;
  Game.prototype.damageBoss=function(damage,crit){
    const boss=this.boss;
    const guarded=boss&&boss.index%4===1&&throneGuardsAlive(this);
    return bossDamageWithGuard.call(this,guarded?damage*.28:damage,crit);
  };

  const previousBossDeath=Boss.prototype.onDeath;
  Boss.prototype.onDeath=function(game){
    if(this._systemBossDeathHandled)return;
    this._systemBossDeathHandled=true;const index=this.index;
    const result=previousBossDeath.call(this,game);
    if(game?._runStats){game._runStats.bossKills++;}
    const legacy=typeof game.getSkillRank==="function"?game.getSkillRank("boss_legacy"):0;
    game.player.evolutionCores+=1+(legacy>0&&(game._runStats?.bossKills||0)%2===0?legacy:0);
    game._pendingBossReward={index};
    return result;
  };

  /* ============================== ステージ固有ルール ============================== */
  function stageIndex(game){ return typeof stageIndexForTime==="function"?stageIndexForTime(game.elapsed||0):Math.min(4,Math.floor((game.elapsed||0)/120)); }

  function setStageHud(game,index,extra=""){
    const rule=STAGE_RULES[index]||STAGE_RULES[0];
    const icon=document.getElementById("stageRuleIcon"),name=document.getElementById("stageRuleName"),text=document.getElementById("stageRuleText");
    if(icon)icon.textContent=rule.icon;if(name)name.textContent=rule.name;if(text)text.textContent=extra||rule.desc;
  }

  function spawnStageNest(game){
    if(game.enemies.filter(enemy=>!enemy.dead&&enemy._stageNest).length>=2)return;
    const angle=Math.random()*Math.PI*2,distance=U.rand(430,680),x=clamp(game.player.x+Math.cos(angle)*distance,70,CONFIG.MAP_W-70),y=clamp(game.player.y+Math.sin(angle)*distance,70,CONFIG.MAP_H-70);
    const nest=new Enemy("heavy",x,y,{hp:game.currentScale.hp*2.4*(game._runEnemyHpBonus||1),atk:game.currentScale.atk,speed:.2});
    nest._stageNest=true;nest.speed=0;nest.radius=38;nest.color="#c7ff70";nest.maxHp=Math.round(nest.maxHp*2.5);nest.hp=nest.maxHp;nest._nestTimer=1.8;
    nest.update=function(dt,player,enemies,obstacles,currentGame){
      this.animT+=dt;if(this.hitFlash>0)this.hitFlash-=dt;if(currentGame._systemTimeStop>0)return;this._nestTimer-=dt;
      if(this._nestTimer<=0){this._nestTimer=Math.max(1.3,2.8-selectedLayer(currentGame)*.06);if(enemies.length<CONFIG.MAX_ENEMIES){const a=Math.random()*Math.PI*2,type=Math.random()<.45?"fast":Math.random()<.7?"splitmini":"normal";enemies.push(new Enemy(type,this.x+Math.cos(a)*55,this.y+Math.sin(a)*55,currentGame.currentScale));}currentGame.addEffect(new SystemPulse(this.x,this.y,75,"#c7ff70",.35));}
      if(U.dist(this.x,this.y,player.x,player.y)<this.radius+player.radius&&this.contactCd<=0){player.takeDamage(this.atk,currentGame);this.contactCd=.7;}if(this.contactCd>0)this.contactCd-=dt;
    };
    const nestDeath=Enemy.prototype.onDeath;
    nest.onDeath=function(currentGame){
      if(this._stageNestRewarded)return;this._stageNestRewarded=true;nestDeath.call(this,currentGame);
      const treasure=new Treasure(this.x,this.y);treasure.game=currentGame;treasure.bounceVel=360;currentGame.treasures.push(treasure);
      for(let i=0;i<7;i++)currentGame.spawnExpGem(this.x+U.rand(-35,35),this.y+U.rand(-35,35),12);
      if(currentGame._runStats)currentGame._runStats.stageNests++;
    };
    game.enemies.push(nest);game.addEffect(new SystemWarning(x,y,{radius:150,color:"#c7ff70",life:.8}));
  }

  function updateStageRules(game,dt){
    const index=stageIndex(game),player=game.player;
    if(game._systemStageIndex!==index){
      game._systemStageIndex=index;game._stageRuleTimer=0;game._stageCycle=0;game._stageDamageMul=1;game._stageCooldownMul=1;game._stageXpMul=1;game._stageSpawnMul=1;
      setStageHud(game,index);
    }

    game._stageDamageMul=1;game._stageCooldownMul=1;game._stageXpMul=1;game._stageSpawnMul=1;
    if(index===0){
      const centerX=CONFIG.MAP_W/2,centerY=CONFIG.MAP_H/2,inside=U.dist2(player.x,player.y,centerX,centerY)<520*520;
      if(inside){game._stageXpMul=1.18;game._stageCooldownMul=.9;game._stageSpawnMul=1.2;setStageHud(game,index,"門域内：経験値 +18% / 権能CD -10% / 敵出現 +20%");}
      else setStageHud(game,index,"中央の発光門域へ入ると成長と発動速度が上昇する。");
    }else if(index===1){
      const phase=Math.floor((game.elapsed-90)/18)%3;game._stageCycle=phase;
      if(phase===0){game._stageDamageMul=1.2;game._stageSpawnMul=1.08;setStageHud(game,index,"赤相：権能ダメージ +20% / 敵出現 +8%");}
      else if(phase===1){game._stageCooldownMul=.85;setStageHud(game,index,"青相：権能CD -15% / 敵弾速度 +8%");}
      else{game._stageXpMul=1.12;player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.0025*dt);setStageHud(game,index,"緑相：経験値 +12% / HPを毎秒0.25%修復");}
    }else if(index===2){
      game._stageRuleTimer-=dt;if(game._stageRuleTimer<=0){game._stageRuleTimer=Math.max(18,29-selectedLayer(game)*.45);spawnStageNest(game);}
      const count=game.enemies.filter(enemy=>!enemy.dead&&enemy._stageNest).length;setStageHud(game,index,`活動中の増殖巣 ${count} / 破壊で宝箱を確定獲得`);
    }else if(index===3){
      game._stageRuleTimer-=dt;if(game._stageRuleTimer<=0){game._stageRuleTimer=Math.max(6.5,9.5-selectedLayer(game)*.12);for(let i=0;i<2+(selectedLayer(game)>=6?1:0);i++){const x=clamp(player.x+U.rand(-260,260),80,CONFIG.MAP_W-80),y=clamp(player.y+U.rand(-220,220),80,CONFIG.MAP_H-80),angle=Math.random()*Math.PI;game.addEffect(new RiftHazard(game,x,y,angle));}}
      setStageHud(game,index,"亀裂は1.05秒予告後に活性化。帯の外へ退避する。");
    }else{
      game._stageRuleTimer-=dt;if(game._stageRuleTimer<=0){game._stageRuleTimer=Math.max(9.5,14-selectedLayer(game)*.18);const radius=Math.max(190,330-selectedLayer(game)*5),x=clamp(player.x+U.rand(-260,260),radius,CONFIG.MAP_W-radius),y=clamp(player.y+U.rand(-220,220),radius,CONFIG.MAP_H-radius);game.addEffect(new AbyssPulse(game,x,y,radius));}
      setStageHud(game,index,"緑の安全域へ移動。脈動時に外側へいると最大HP16%損傷。");
    }
  }

  const previousGainExp=Player.prototype.gainExp;
  Player.prototype.gainExp=function(value){const game=window.__game,multiplier=game?game._stageXpMul||1:1;return previousGainExp.call(this,value*multiplier);};

  const previousGetTimeScale=getTimeScale;
  getTimeScale=function(time){
    const scale=previousGetTimeScale(time),game=window.__game,layer=selectedLayer(game),challenge=game?.records?.challengeSelected||"none";
    const hp=(1+layer*.12)*(game?game._runEnemyHpBonus||1:1),attack=1+layer*.08,spawn=(1+layer*.04)*(challenge==="swarm_tide"?1.3:1)*(game?game._stageSpawnMul||1:1);
    return {hp:scale.hp*hp,atk:scale.atk*attack,speed:scale.speed*(1+layer*.012),spawnCount:Math.max(1,Math.round(scale.spawnCount*spawn)),spawnInterval:Math.max(.16,scale.spawnInterval/(1+layer*.025))};
  };

  function drawStageRuleLayer(game,ctx,cam){
    if(!game.player)return;const index=stageIndex(game);
    if(index===0){const x=CONFIG.MAP_W/2-cam.x,y=CONFIG.MAP_H/2-cam.y;ctx.save();ctx.fillStyle="rgba(93,255,210,.055)";ctx.strokeStyle="rgba(255,230,107,.5)";ctx.lineWidth=4;ctx.setLineDash([18,14]);ctx.lineDashOffset=-game.elapsed*25;ctx.beginPath();ctx.arc(x,y,520,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.restore();}
    if(index===1){const colors=["rgba(255,82,104,.08)","rgba(101,217,255,.08)","rgba(66,232,189,.07)"];ctx.save();ctx.fillStyle=colors[game._stageCycle||0];ctx.fillRect(0,0,game.viewW,game.viewH);ctx.restore();}
  }

  /* ============================== ボス・宝箱報酬 ============================== */
  function rewardCardData(id,type){
    if(type==="boss"){const def=RELICS[id];return{id,name:def.name,icon:def.icon,color:def.color,desc:def.desc};}
    const def=MUTATIONS[id];return{id,name:def.name,icon:def.icon,color:def.color,desc:def.desc};
  }

  function openRewardScreen(game,type,ids){
    if(!game||!ids.length)return false;
    game.input.keys.clear();game._rewardReturnState="playing";game.state="reward";
    const screen=document.getElementById("abyssRewardScreen"),choices=document.getElementById("rewardChoices"),title=document.getElementById("rewardTitle"),kicker=document.getElementById("rewardKicker"),description=document.getElementById("rewardDescription");
    if(!screen||!choices)return false;
    title.textContent=type==="boss"?"王の遺産を選択":"宝箱変異を選択";
    kicker.textContent=type==="boss"?"BOSS LEGACY / BUILD PIVOT":"TREASURE MUTATION / BUILD PIVOT";
    description.textContent=type==="boss"?"ボス撃破で進化核を1個獲得。さらにランを変える遺産を1つ選ぶ。":"通常の回復と経験値に加え、ビルドを変化させる変異を1つ選ぶ。";
    choices.innerHTML="";
    for(const id of ids){
      const data=rewardCardData(id,type),card=document.createElement("button");card.type="button";card.className="abyss-reward-card";card.style.setProperty("--reward-color",data.color);card.innerHTML=`<span class="reward-icon">${data.icon}</span><span class="reward-name">${data.name}</span><span class="reward-desc">${data.desc}</span>`;
      card.addEventListener("click",()=>{
        if(game._rewardLocked)return;game._rewardLocked=true;
        if(type==="boss"){RELICS[id].apply(game);game._runStats?.relics.push(id);}
        else{MUTATIONS[id].apply(game);game._runStats?.mutations.push(id);}
        screen.classList.add("hidden");game.state="playing";game.lastTime=performance.now();game._rewardLocked=false;rebuildSystemMultipliers(game);game.updateWeaponBarDOM();updateBuildHud(game);
      });choices.appendChild(card);
    }
    screen.classList.remove("hidden");return true;
  }

  function chooseRelics(game,bossIndex){
    const count=3+(game.records.challengeSelected==="boss_covenant"?1:0)+(game.getSkillRank?.("boss_legacy")||0);
    const signature=Object.keys(RELICS).find(id=>RELICS[id].signature===bossIndex);
    const general=shuffle(Object.keys(RELICS).filter(id=>RELICS[id].signature==null&&id!==signature));
    return [signature,...general].filter(Boolean).slice(0,Math.min(5,count));
  }

  function chooseMutations(game){
    const eligible=Object.keys(MUTATIONS).filter(id=>MUTATIONS[id].eligible(game));
    return shuffle(eligible).slice(0,Math.min(3,eligible.length));
  }

  function processPendingModal(game){
    if(game.state!=="playing")return;
    if(game._pendingBossReward){const reward=game._pendingBossReward;game._pendingBossReward=null;openRewardScreen(game,"boss",chooseRelics(game,reward.index));return;}
    if(game._pendingTreasureMutation){game._pendingTreasureMutation=false;openRewardScreen(game,"treasure",chooseMutations(game));}
  }

  const previousTreasureUpdate=Treasure.prototype.update;
  Treasure.prototype.update=function(dt,player){
    const game=this.game||window.__game;if(!game)return previousTreasureUpdate.call(this,dt,player);
    const range=player.treasureMagnetRange||0,distance=U.dist(this.x,this.y,player.x,player.y);
    if(!this.collected&&(this.attracted||(range>0&&distance<range))){this.attracted=true;const angle=U.angle(this.x,this.y,player.x,player.y),speed=clamp(1050-distance,420,1050);this.x+=Math.cos(angle)*speed*dt;this.y+=Math.sin(angle)*speed*dt;}
    const beforeCollected=this.collected,beforeHp=player.hp;previousTreasureUpdate.call(this,dt,player);
    if(!beforeCollected&&this.collected){
      if(game.records.challengeSelected==="hollow_recovery")player.hp=Math.min(player.hp,beforeHp);
      if(game._runStats)game._runStats.treasures++;
      const rank=rankOf(player,"treasure_singularity");
      if(rank){const stats=getPowerStats(player,"treasure_singularity",rank);areaDamage(game,this.x,this.y,stats.radius,powerDamage(game,"treasure_singularity",stats.damage),"treasure_singularity",9);player.gainExp(player.expToNext*stats.exp);game.addEffect(new SystemPulse(this.x,this.y,stats.radius,"#ffd447",.9));}
      if(hasSynergy(player,"golden_feast")){player._banquetGems=(player._banquetGems||0)+10;}
      const chance=clamp((player.treasureMutationChance||.24)+(rank?getPowerStats(player,"treasure_singularity",rank).mutation:0),0,.85);
      if(!game._pendingTreasureMutation&&game.elapsed-(game._lastMutationTime||-999)>18&&Math.random()<chance){game._pendingTreasureMutation=true;game._lastMutationTime=game.elapsed;}
    }
  };

  const previousGemUpdate=ExpGem.prototype.update;
  ExpGem.prototype.update=function(dt,player){
    const wasDead=this.dead;previousGemUpdate.call(this,dt,player);
    if(!wasDead&&this.dead){const game=window.__game;if(game?._runStats)game._runStats.gems++;const rank=rankOf(player,"abyss_banquet");if(game&&rank){player._banquetGems=(player._banquetGems||0)+1;const need=getPowerStats(player,"abyss_banquet",rank).gems;if(player._banquetGems>=need){player._banquetGems%=need;castBanquet(game,rank);}}}
  };

  /* ============================== 撃破発動 / ビルド構築 ============================== */
  const systemEnemyDeath=Enemy.prototype.onDeath;
  Enemy.prototype.onDeath=function(game){
    const fresh=!this.dead&&!this._systemDeathHandled;
    const x=this.x,y=this.y;
    const result=systemEnemyDeath.call(this,game);
    if(!fresh||!game?.player)return result;
    const player=game.player;

    let rank=rankOf(player,"doom_bloom");
    if(rank&&!game._doomBloomActive){
      player._doomBloomKills=(player._doomBloomKills||0)+1;
      const stats=getPowerStats(player,"doom_bloom",rank),need=Math.max(1,Math.round(stats.kills*(player.killChargeMul||1)));
      if(player._doomBloomKills>=need){
        player._doomBloomKills=0;game._doomBloomActive=true;
        try{
          const targets=nearestTargets(game,stats.targets,1100,{x,y}),damage=powerDamage(game,"doom_bloom",stats.damage);
          withDamageSource(game,"doom_bloom",()=>targets.forEach((enemy,index)=>{game.addEffect(new SystemBeam(x,y,enemy.x,enemy.y,16,"#ff5268",.25));game.damageEnemy(enemy,damage,false);if(isEvolved(player,"doom_bloom")&&enemy.dead&&index<5){const next=nearestTargets(game,1,300,enemy)[0];if(next){game.addEffect(new SystemBeam(enemy.x,enemy.y,next.x,next.y,10,"#ffd447",.2));game.damageEnemy(next,Math.round(damage*.55),false);}}}));
        }finally{game._doomBloomActive=false;}
        game.addEffect(new SystemPulse(x,y,190,"#ff5268",.55));
      }
    }

    rank=rankOf(player,"hunter_verdict");
    if(rank&&!game._verdictActive){
      player._verdictKills=(player._verdictKills||0)+1;
      const stats=getPowerStats(player,"hunter_verdict",rank),need=Math.max(1,Math.round(stats.kills*(player.killChargeMul||1)));
      if(player._verdictKills>=need){
        player._verdictKills=0;game._verdictActive=true;
        try{
          let target=null;for(const enemy of game.enemies)if(!enemy.dead&&(!target||enemy.hp>target.hp))target=enemy;
          if(target){const execute=target.hp/target.maxHp<=stats.execute,damage=execute?target.hp+1:powerDamage(game,"hunter_verdict",4.5);game.addEffect(new SystemBeam(player.x,player.y,target.x,target.y,38,"#ffd447",.3));withDamageSource(game,"hunter_verdict",()=>game.damageEnemy(target,damage,false));}
          if(game.boss&&!game.boss.dead){const damage=Math.min(game.boss.maxHp*stats.boss,powerDamage(game,"hunter_verdict",10));withDamageSource(game,"hunter_verdict",()=>game.damageBoss(damage,false));}
          if(hasSynergy(player,"execution_garden"))player._doomBloomKills=(player._doomBloomKills||0)+Math.ceil((getPowerStats(player,"doom_bloom",Math.max(1,rankOf(player,"doom_bloom"))).kills||10)*.45);
        }finally{game._verdictActive=false;}
      }
    }

    if(player._goldenRain){
      player._goldenRainKills=(player._goldenRainKills||0)+1;
      if(player._goldenRainKills>=55){player._goldenRainKills=0;const treasure=new Treasure(x,y);treasure.game=game;treasure.bounceVel=340;game.treasures.push(treasure);game.addEffect(new SystemPulse(x,y,120,"#ffd447",.7));}
    }
    return result;
  };

  const feastShieldDamage=Player.prototype.takeDamage;
  Player.prototype.takeDamage=function(amount,game){
    if(this._feastShield>0&&!this.invincible){const absorbed=Math.min(this._feastShield,amount);this._feastShield-=absorbed;amount-=absorbed;if(game)game.addEffect(new SystemPulse(this.x,this.y,70,"#42e8bd",.28));if(amount<=0)return;}
    return feastShieldDamage.call(this,amount,game);
  };

  function powerSlotsUsed(player){return ownedPowerIds(player).length;}
  function canUnlockPower(player){return powerSlotsUsed(player)<(player.powerSlotLimit||BASE_POWER_SLOTS);}

  function powerChoice(player,id){
    const def=POWER_CATALOG[id],current=rankOf(player,id),next=current+1,category=CATEGORY_INFO[def.category];
    return {
      id,kind:"power",name:def.name,icon:def.icon,category:def.category,color:category.color,
      desc:def.desc,trigger:current?`Lv.${current} → Lv.${next}`:`新規権能 / 枠を1つ使用`,weight:current?1.25:1,
      apply(game){acquirePower(game.player,id);rebuildSystemMultipliers(game);}
    };
  }

  function evolutionChoice(player,id){
    const evolution=EVOLUTIONS[id],def=POWER_CATALOG[id];
    return{id:`evo:${id}`,sourceId:id,kind:"evolution",name:evolution.name,icon:evolution.icon,category:def.category,color:"#ffd447",desc:evolution.summary,trigger:"進化核を1個消費 / 権能枠は増えない",weight:2.3,apply(game){evolvePower(game,id);}};
  }

  function synergyChoice(id){
    const synergy=SYNERGIES[id];
    return{id:`syn:${id}`,sourceId:id,kind:"synergy",name:synergy.name,icon:synergy.icon,category:"synergy",color:"#ffd447",desc:synergy.summary,trigger:"2権能の共鳴 / 権能枠は増えない",weight:2.1,apply(game){acquireSynergy(game,id);}};
  }

  function utilityChoices(player){
    return [
      {id:"util:repair",kind:"utility",name:"緊急修復",icon:"+",category:"defense",color:"#42e8bd",desc:"HPを最大HPの45%回復する。",trigger:"候補枯渇時の安全弁",weight:.5,apply(game){const before=game.player.hp;game.player.hp=Math.min(game.player.maxHp,game.player.hp+Math.round(game.player.maxHp*.45));if(game._runStats)game._runStats.healing+=game.player.hp-before;}},
      {id:"util:overclock",kind:"utility",name:"一時過給",icon:"↯",category:"chaos",color:"#ff8a4c",desc:"全権能ダメージ +8%、最大HP -5%。",trigger:"ラン中永続 / 代償あり",weight:.45,apply(game){game.player.systemDamageMul*=1.08;game.player.maxHp=Math.max(1,Math.round(game.player.maxHp*.95));game.player.hp=Math.min(game.player.hp,game.player.maxHp);}}
    ];
  }

  buildUpgradePool=function(player){
    const pool=[],banned=player.bannedPowers||new Set(),origin=!!player._originDraft;
    for(const id of POWER_IDS){
      const rank=rankOf(player,id),def=POWER_CATALOG[id];
      if(banned.has(id)||rank>=def.max)continue;
      if(origin){if(rank===0&&["annihilation","dominion","motion"].includes(def.category)&&id!=="time_execution")pool.push(powerChoice(player,id));continue;}
      if(rank===0&&!canUnlockPower(player))continue;
      pool.push(powerChoice(player,id));
    }
    if(!origin){
      if(player.evolutionCores>0)for(const id of POWER_IDS)if(rankOf(player,id)>=POWER_CATALOG[id].max&&!isEvolved(player,id))pool.push(evolutionChoice(player,id));
      for(const [id,synergy] of Object.entries(SYNERGIES))if(!hasSynergy(player,id)&&synergy.powers.every(power=>rankOf(player,power)>=2))pool.push(synergyChoice(id));
      if(pool.length<3)pool.push(...utilityChoices(player));
    }
    return pool;
  };

  pickUpgradeChoices=function(player,count){
    const pool=buildUpgradePool(player),picked=[];
    const weightedChoice=list=>{
      let total=list.reduce((sum,item)=>sum+(item.weight||1),0),roll=Math.random()*total;
      for(const item of list){roll-=item.weight||1;if(roll<=0)return item;}
      return list[list.length-1]||null;
    };
    const addPicked=item=>{if(item&&!picked.some(entry=>entry.id===item.id))picked.push(item);};

    if(!player._originDraft){
      const priority=pool.filter(item=>item.kind==="evolution"||item.kind==="synergy");
      addPicked(weightedChoice(priority));
      const ownedRanks=pool.filter(item=>item.kind==="power"&&rankOf(player,item.id)>0);
      addPicked(weightedChoice(ownedRanks));
    }
    while(picked.length<count){
      const candidates=pool.filter(item=>!picked.some(entry=>entry.id===item.id));if(!candidates.length)break;
      const represented=new Set(picked.map(item=>item.category));const diverse=candidates.filter(item=>!represented.has(item.category));const list=diverse.length?diverse:candidates;
      addPicked(weightedChoice(list));
    }
    return picked;
  };

  getUpgradePreview=function(id,player){
    if(id.startsWith("evo:")){const source=id.slice(4);return{now:`${POWER_CATALOG[source].name} Lv.3`,after:`進化：${EVOLUTIONS[source].name}`};}
    if(id.startsWith("syn:")){const source=id.slice(4),synergy=SYNERGIES[source];return{now:synergy.powers.map(power=>POWER_CATALOG[power].name).join(" ＋ "),after:`共鳴：${synergy.name}`};}
    if(id.startsWith("util:"))return{now:"ビルド補助",after:id==="util:repair"?"HPを45%回復":"権能ダメージ +8% / 最大HP -5%"};
    const def=POWER_CATALOG[id];if(!def)return{now:"-",after:"-"};
    const current=rankOf(player,id),next=Math.min(def.max,current+1);
    return{now:current?`Lv.${current}｜${powerLines(player,id,current).join(" / ")}`:"未取得",after:`Lv.${next}｜${powerLines(player,id,next).join(" / ")}`};
  };

  function acquiredSummary(item,player){
    if(item.kind==="power"){
      const rank=rankOf(player,item.id);
      return `Lv.${rank}｜${powerLines(player,item.id,rank).join(" / ")}`;
    }
    if(item.kind==="evolution")return `進化：${item.name}`;
    if(item.kind==="synergy")return `共鳴：${item.name}`;
    return getUpgradePreview(item.id,player).after;
  }

  function choiceTags(player,item){
    if(item.kind==="evolution")return["進化核 1","枠維持","Lv.3到達"];
    if(item.kind==="synergy"){
      const synergy=SYNERGIES[item.sourceId];
      return["共鳴",...(synergy?.powers||[]).map(id=>POWER_CATALOG[id]?.name).filter(Boolean)];
    }
    if(item.kind!=="power")return["ビルド補助"];
    const current=rankOf(player,item.id),tags=[current?"権能枠を維持":`新規 ${powerSlotsUsed(player)+1}/${player.powerSlotLimit||BASE_POWER_SLOTS}`];
    if(current>=2)tags.push("進化候補");
    const partners=[];
    for(const synergy of Object.values(SYNERGIES)){
      if(!synergy.powers.includes(item.id))continue;
      const other=synergy.powers.find(id=>id!==item.id);
      if(other&&rankOf(player,other)>0)partners.push(POWER_CATALOG[other].name);
    }
    if(partners.length)tags.push(`共鳴候補 ${partners.join("・")}`);
    return tags;
  }

  function renderLevelChoices(game,choices){
    const wrap=document.getElementById("upgradeChoices");if(!wrap)return;wrap.innerHTML="";
    choices.forEach((item,index)=>{
      const canBanish=item.kind==="power"&&game.player.banishes>0&&!game.player._originDraft;
      const preview=getUpgradePreview(item.id,game.player),card=document.createElement(canBanish?"div":"button");if(!canBanish)card.type="button";card.className=`upgrade-card abyss-power-card kind-${item.kind}`;card.style.setProperty("--card-color",item.color);card.dataset.index=String(index+1).padStart(2,"0");card.dataset.rankLabel=item.trigger;
      const tags=choiceTags(game.player,item).map(value=>`<span>${value}</span>`).join("");
      card.innerHTML=`<div class="power-category">${item.kind==="evolution"?"EVOLUTION":item.kind==="synergy"?"RESONANCE":CATEGORY_INFO[item.category]?.label||"SYSTEM"}</div><div class="upgrade-icon">${item.icon}</div><div class="upgrade-name">${item.name}</div><div class="power-build-tags">${tags}</div><div class="power-trigger">${item.trigger}</div><div class="upgrade-desc">${item.desc}</div><div class="upgrade-current"><span class="now">現在｜${preview.now}</span><span class="after">取得後｜${preview.after}</span></div>`;
      if(canBanish){card.tabIndex=0;card.setAttribute("role","button");const banish=document.createElement("button");banish.type="button";banish.className="banish-choice";banish.textContent=`除外 ${game.player.banishes}`;banish.addEventListener("click",event=>{event.stopPropagation();if(game.player.banishes<=0)return;game.player.banishes--;game.player.bannedPowers.add(item.id);game._runStats.banishes++;renderLevelChoices(game,pickUpgradeChoices(game.player,3+(game.player.levelUpChoiceBonus||0)));});card.appendChild(banish);}
      const select=()=>{if(game._levelUpSelectionLocked)return;game._levelUpSelectionLocked=true;item.apply(game);game.player._originDraft=false;game.updateWeaponBarDOM();updateBuildHud(game);game.showSystemToast(item.icon,item.name,item.desc,`現在：${acquiredSummary(item,game.player)}`,item.color);game.closeLevelUp();};
      game._levelUpSelectActions[index]=select;
      card.addEventListener("click",select);if(canBanish)card.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();select();}});wrap.appendChild(card);
    });

    const controls=document.createElement("div");controls.className="levelup-controls";
    const reroll=document.createElement("button");reroll.type="button";reroll.className="levelup-reroll";reroll.disabled=game.player.rerolls<=0;reroll.textContent=`↻ リロール ${game.player.rerolls} [R]`;game._levelUpRerollAction=()=>{if(game.player.rerolls<=0)return;game.player.rerolls--;game._runStats.rerolls++;const count=game.player._originDraft?4:3+(game.player.levelUpChoiceBonus||0);renderLevelChoices(game,pickUpgradeChoices(game.player,count));};reroll.addEventListener("click",game._levelUpRerollAction);controls.appendChild(reroll);wrap.appendChild(controls);
  }

  Game.prototype.openLevelUp=function(){
    this.input.keys.clear();this.state="levelup";this._levelUpSelectionLocked=false;this._levelUpSelectActions=[];this._levelUpRerollAction=null;
    const count=this.player._originDraft?4:3+(this.player.levelUpChoiceBonus||0),choices=pickUpgradeChoices(this.player,count);this._levelUpChoices=choices;
    const title=document.querySelector("#levelUpScreen .upgrade-title");if(title)title.textContent=this.player._originDraft?"起源権能を選択":"レベルアップ！強化を選択";
    renderLevelChoices(this,choices);document.getElementById("levelUpScreen").classList.remove("hidden");this.sound.levelUp();
  };

  /* ============================== 永続効果 / ライフサイクル ============================== */
  function rebuildSystemMultipliers(game){
    const player=game.player;if(!player)return;
    const overdrive=rankOf(player,"overdrive_contract"),applied=player._appliedOverdriveRank||0;
    if(overdrive>applied){for(let i=applied;i<overdrive;i++)player.systemCooldownMul*=.84;player._appliedOverdriveRank=overdrive;}
    if(isEvolved(player,"overdrive_contract")&&!player._overdriveEvolutionApplied){player.systemCooldownMul*=.82;player._overdriveEvolutionApplied=true;}
    updateBuildHud(game);
  }

  function applyPermanentBuild(game){
    const player=game.player,rank=id=>game.getSkillRank?.(id)||0;
    player.weapons=[];player.auraDamage=0;player.auraRadius=0;player.superModeThreshold=Number.POSITIVE_INFINITY;player.killStreak=0;player.superModeTimer=0;
    player.upgradeRanks={};player.powerEvolutions={};player.powerSynergies={};player.bannedPowers=new Set();player.categoryDamageMul={};player.powerDamageById={};
    player.systemDamageMul=(1+rank("rebirth_output")*.1)*(1+rank("havoc_overkill")*.09);
    player.systemCooldownMul=Math.pow(.94,rank("rebirth_clock"));
    player.systemAreaMul=1+rank("dominion_area")*.1;
    player.controlDurationMul=1+rank("dominion_control")*.16;
    player.killChargeMul=Math.pow(.91,rank("havoc_overkill"));
    player.synergyDamageBonus=rank("synergy_matrix")*.18;
    player.systemEchoChance=rank("dominion_mastery") ? .2 : 0;
    player.powerSlotLimit=BASE_POWER_SLOTS+rank("core_slots");
    player.rerolls=BASE_REROLLS+rank("core_reroll");player.banishes=1;
    player.evolutionCores=rank("forge_core");
    player.treasureMutationChance=.24;player.treasureMagnetRange=rank("harvest_magnet")?700:0;
    player.permanentShieldRecharge=rank("aegis_shell")?18:0;player.lowPowerBonus=rank("aegis_blood")*.16;player.lowSpeedBonus=rank("aegis_blood")*.1;
    player.reviveCharges=rank("aegis_mastery")?1:0;player._rebirthRevive=rank("aegis_mastery")>0;player._goldenRain=rank("harvest_mastery")>0;
    player.levelUpChoiceBonus=rank("rebirth_draft");
    player.expGainMul*=1+rank("harvest_growth")*.08;
    player.maxHp=Math.round(player.maxHp*(1+rank("rebirth_frame")*.12));player.hp=player.maxHp;
    player.shardGainMul=1;

    if(rank("redline_god")){player.systemDamageMul*=1.38;player.systemCooldownMul*=.82;player.maxHp=Math.max(1,Math.round(player.maxHp*.68));player.hp=player.maxHp;}
    if(rank("colossus_god")){player.systemAreaMul*=1.35;player.systemDamageMul*=1.18;player.speed*=.82;}
    if(rank("chaos_clock")){player.systemCooldownMul*=.7;player.systemDamageMul*=.88;}
    if(rank("precision_law")){player.systemDamageMul*=1.38;player.systemCooldownMul*=1.16;}
    if(rank("glass_god")){player.systemDamageMul*=1.52;player.maxHp=Math.max(1,Math.round(player.maxHp*.56));player.hp=player.maxHp;}
    if(rank("fortress_god")){player.maxHp=Math.round(player.maxHp*1.62);player.hp=player.maxHp;player.damageReduction=Math.min(.72,player.damageReduction+.12);player.speed*=.82;}
    if(rank("swift_harvest")){player.expGainMul*=1.28;player.shardGainMul*=.84;}
    if(rank("deep_harvest")){player.expGainMul*=.9;player.shardGainMul*=1.42;}

    const challenge=game.records.challengeSelected||"none";
    if(challenge==="glass_march"){player.maxHp=Math.max(1,Math.round(player.maxHp*.65));player.hp=player.maxHp;}
    if(challenge==="one_god"){player.powerSlotLimit=3;player.evolutionCores+=1;}

    const startCount=rank("havoc_mastery")?2:rank("havoc_seed")?1:0;
    const startPool=POWER_IDS.filter(id=>["annihilation","dominion","motion"].includes(POWER_CATALOG[id].category)&&id!=="time_execution");
    for(let i=0;i<startCount;i++){const candidates=startPool.filter(id=>!rankOf(player,id));const id=choice(candidates);if(id)acquirePower(player,id);}
    rebuildSystemMultipliers(game);
  }

  function updateBuildHud(game){
    if(!game?.player)return;
    const slots=document.getElementById("buildSlotText"),cores=document.getElementById("buildCoreText"),synergies=document.getElementById("buildSynergyText");
    if(slots)slots.textContent=`権能 ${powerSlotsUsed(game.player)}/${game.player.powerSlotLimit||BASE_POWER_SLOTS}`;
    if(cores)cores.textContent=`進化核 ${game.player.evolutionCores||0}`;
    if(synergies)synergies.textContent=`共鳴 ${Object.keys(game.player.powerSynergies||{}).length}`;
  }

  function powerDisplayData(player,id){
    const def=POWER_CATALOG[id],rank=rankOf(player,id),evolution=isEvolved(player,id)?EVOLUTIONS[id]:null,category=CATEGORY_INFO[def.category];
    return{name:evolution?evolution.name:def.name,icon:evolution?evolution.icon:def.icon,color:category.color,level:`Lv.${rank}${evolution?" / EVOLVED":""}`,desc:def.desc,stats:powerLines(player,id,rank)};
  }

  getCoreUpgradeData=function(player){
    return{name:"ビルド中枢",icon:"▤",color:"#ffd447",level:`${powerSlotsUsed(player)}/${player.powerSlotLimit||BASE_POWER_SLOTS} SLOTS`,desc:"権能枠・進化核・共鳴・選択資源。",stats:[`権能威力 ×${formatNumber(player.systemDamageMul||1)}`,`権能範囲 ×${formatNumber(player.systemAreaMul||1)}`,`権能CD ×${formatNumber(player.systemCooldownMul||1)}`,`進化核 ${player.evolutionCores||0}`,`共鳴 ${Object.keys(player.powerSynergies||{}).length}`,`リロール ${player.rerolls||0}`]};
  };

  Game.prototype.updateWeaponBarDOM=function(){
    const bar=document.getElementById("weaponBar");if(!bar||!this.player)return;const scroll=bar.scrollTop;bar.innerHTML="";
    const entries=[getCoreUpgradeData(this.player),...ownedPowerIds(this.player).map(id=>powerDisplayData(this.player,id))];
    for(const data of entries){const element=document.createElement("div");element.className="ability-panel abyss-ability";element.style.setProperty("--ability-color",data.color);const stats=data.stats.slice(0,5).map((value,index)=>`<span class="ability-stat ${index<2?"strong":""}">${value}</span>`).join("");element.innerHTML=`<div class="ability-icon">${data.icon}</div><div class="ability-main"><div class="ability-head"><div class="ability-name">${data.name}</div><div class="ability-level">${data.level}</div></div><div class="ability-desc">${data.desc}</div><div class="ability-stats">${stats}</div></div>`;bar.appendChild(element);}
    bar.scrollTop=scroll;updateBuildHud(this);
  };

  class AbyssMusic{
    constructor(game){this.game=game;this.timer=.1;this.step=0;this.lastStage=-1;this.active=true;}
    note(frequency,duration,volume,type="triangle"){
      const game=this.game,ctx=game.sound?.ctx;if(!ctx||ctx.state==="closed")return;
      const settings=game.records.settings||DEFAULT_SETTINGS,master=(game.records.volume??60)/100,music=(settings.musicVolume??35)/100;if(master<=0||music<=0)return;
      const now=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(Math.max(30,frequency),now);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,volume*master*music),now+.018);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain).connect(ctx.destination);osc.start(now);osc.stop(now+duration+.03);
    }
    update(dt){
      const game=this.game;if(!this.active||game.state!=="playing")return;this.timer-=dt;if(this.timer>0)return;
      const stage=stageIndex(game),boss=!!game.boss;if(stage!==this.lastStage){this.lastStage=stage;this.step=0;}const roots=[110,123.47,130.81,98,82.41],root=roots[stage],patterns=[[0,7,12,7],[0,3,10,7],[0,5,8,12],[0,1,6,10],[0,-2,5,11]],pattern=patterns[stage],semitone=pattern[this.step%pattern.length],frequency=root*Math.pow(2,semitone/12);
      this.note(frequency,boss ? .22 : .14,boss ? .05 : .032,boss?"sawtooth":"triangle");if(this.step%2===0)this.note(frequency/2,.34,boss ? .032 : .02,"sine");if(this.step%4===3)this.note(frequency*2,.12,.012,"square");
      this.step++;this.timer=boss ? .26 : .38;
    }
    stop(){this.active=false;}
  }

  const baseTone=SoundManager.prototype.tone;
  SoundManager.prototype.tone=function(freq,dur,type,vol,opt){const settings=window.__game?.records?.settings||DEFAULT_SETTINGS;return baseTone.call(this,freq,dur,type,(vol == null ? .3 : vol)*(settings.sfxVolume/100),opt);};
  const baseNoise=SoundManager.prototype.noise;
  SoundManager.prototype.noise=function(dur,vol){const settings=window.__game?.records?.settings||DEFAULT_SETTINGS;return baseNoise.call(this,dur,(vol == null ? .25 : vol)*(settings.sfxVolume/100));};

  const baseShake=Game.prototype.shake;
  Game.prototype.shake=function(magnitude,time){const settings=this.records?.settings||DEFAULT_SETTINGS,scale=(settings.shake/100)*(settings.reducedMotion ? .35 : 1);return baseShake.call(this,magnitude*scale,time*(settings.reducedMotion ? .65 : 1));};
  const baseHitFlash=Game.prototype.triggerHitFlash;
  Game.prototype.triggerHitFlash=function(){if(this.records?.settings?.flashes===false)return;return baseHitFlash.call(this);};

  const baseSpawnParticles=spawnParticles;
  spawnParticles=function(list,x,y,count,color,speed,life,size){const game=window.__game,density=effectDensity(game),scale=density === "low" ? .45 : density === "high" ? 1.15 : 1;return baseSpawnParticles(list,x,y,Math.max(0,Math.round(count*scale)),color,speed,life,size);};

  const baseAddEffect=Game.prototype.addEffect;
  Game.prototype.addEffect=function(effect){
    if(!effect)return;const density=effectDensity(this);
    if(this._bossClarityTimer>0&&!effect.critical)return;
    if(!effect.critical&&density==="low"&&this.effects?.length>CONFIG.MAX_EFFECTS*.45&&Math.random()<.5)return;
    return baseAddEffect.call(this,effect);
  };

  const baseDamageTextDraw=DamageText.prototype.draw;
  DamageText.prototype.draw=function(ctx,cam){
    const setting=window.__game?.records?.settings?.damageText||"normal";
    if(setting==="low"&&!this.crit&&Math.abs(Math.floor(this.x+this.y))%3!==0)return;
    return baseDamageTextDraw.call(this,ctx,cam);
  };

  const baseProjectileDraw=EnemyProjectile.prototype.draw;
  EnemyProjectile.prototype.draw=function(ctx,cam){
    baseProjectileDraw.call(this,ctx,cam);
    if(window.__game?.records?.settings?.projectileOutline===false)return;
    ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.strokeStyle="rgba(255,255,245,.88)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,this.radius+4,0,Math.PI*2);ctx.stroke();ctx.restore();
  };

  function drawPersistentPowers(player,ctx,cam){
    let rank=rankOf(player,"razor_constellation");
    if(rank){const stats=getPowerStats(player,"razor_constellation",rank),angle=player._razorAngle||0;for(let i=0;i<stats.count;i++){const a=angle+i/stats.count*Math.PI*2,x=player.x-cam.x+Math.cos(a)*stats.radius,y=player.y-cam.y+Math.sin(a)*stats.radius;ctx.save();ctx.translate(x,y);ctx.rotate(a+Math.PI/2);ctx.fillStyle="#ff5268";ctx.strokeStyle="#fff7dc";ctx.lineWidth=3;polygonPath(ctx,[[0,-24],[9,-5],[5,20],[0,29],[-5,20],[-9,-5]]);ctx.fill();ctx.stroke();ctx.restore();}}
    rank=rankOf(player,"black_sun");
    if(rank){const stats=getPowerStats(player,"black_sun",rank);for(const position of getBlackSunPositions(window.__game)){const x=position.x-cam.x,y=position.y-cam.y,r=stats.radius*.42;ctx.save();ctx.translate(x,y);const gradient=ctx.createRadialGradient(0,0,0,0,0,r*2.5);gradient.addColorStop(0,"#fff7dc");gradient.addColorStop(.18,"#ff8a4c");gradient.addColorStop(.42,"#191426");gradient.addColorStop(1,"rgba(180,92,255,0)");ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(0,0,r*2.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#b45cff";ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,r*1.4,0,Math.PI*2);ctx.stroke();ctx.restore();}}
    rank=rankOf(player,"mirror_legion");
    if(rank)for(const position of getMirrorPositions(window.__game)){ctx.save();ctx.translate(position.x-cam.x,position.y-cam.y);ctx.rotate(player.animT*1.4);ctx.globalAlpha=.75;ctx.fillStyle="#65d9ff";ctx.strokeStyle="#191426";ctx.lineWidth=3;polygonPath(ctx,[[18,0],[-9,10],[-4,0],[-9,-10]]);ctx.fill();ctx.stroke();ctx.restore();}
    if((player._shellCharges||0)>0){ctx.save();ctx.translate(player.x-cam.x,player.y-cam.y);ctx.strokeStyle="rgba(66,232,189,.92)";ctx.lineWidth=5;ctx.setLineDash([12,8]);ctx.lineDashOffset=-player.animT*40;ctx.beginPath();ctx.arc(0,0,42+(player._shellCharges-1)*8+Math.sin(player.animT*5)*3,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();}
    if(player._feastShield>0){ctx.save();ctx.translate(player.x-cam.x,player.y-cam.y);ctx.strokeStyle="rgba(255,212,71,.82)";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,50,0,Math.PI*2);ctx.stroke();ctx.restore();}
    ctx.save();ctx.translate(player.x-cam.x,player.y-cam.y-42);ctx.fillStyle="#fff7dc";ctx.strokeStyle="#090718";ctx.lineWidth=3;polygonPath(ctx,[[0,-9],[8,5],[0,2],[-8,5]]);ctx.fill();ctx.stroke();ctx.restore();
  }

  const basePlayerDraw=Player.prototype.draw;
  Player.prototype.draw=function(ctx,cam){basePlayerDraw.call(this,ctx,cam);drawPersistentPowers(this,ctx,cam);};

  const baseDrawGroundCached=Game.prototype.drawGroundCached;
  Game.prototype.drawGroundCached=function(ctx,cam,w,h,now){const result=baseDrawGroundCached.call(this,ctx,cam,w,h,now);drawStageRuleLayer(this,ctx,cam);return result;};

  const baseStartGame=Game.prototype.startGame;
  Game.prototype.startGame=function(){
    const recordBaseline={highScore:finite(this.records?.highScore,0),bestTime:finite(this.records?.bestTime,0),maxKills:finite(this.records?.maxKills,0)};
    const result=baseStartGame.call(this);
    this._runStats=newRunStats();this._resultRecorded=false;this._powerTimers={};this._delayedSystemCasts=[];this._systemTimeStop=0;this._timeBurstPending=false;this._systemStageIndex=-1;this._stageRuleTimer=0;this._stageDamageMul=1;this._stageCooldownMul=1;this._stageXpMul=1;this._stageSpawnMul=1;this._pendingBossReward=null;this._pendingTreasureMutation=false;this._lastMutationTime=-999;this._runEnemyHpBonus=1;
    applyPermanentBuild(this);this.player._originDraft=true;this.player.lastMove={x:0,y:0};window.__recentUpgrades=[];this._abyssMusic=new AbyssMusic(this);this._runRecordBaseline=recordBaseline;this._onboardingStep=this.records.onboardingVersion>=1?3:0;this.updateWeaponBarDOM();updateBuildHud(this);setStageHud(this,0);
    this.pendingLevelUps=(this.pendingLevelUps||0)+1;if(this.state==="playing")this.openLevelUp();
    if(this.records.lastSystemRefund>0){this.showSystemToast("◇","旧回路を返還","廃止された旧ノードの投資を自動返還しました。",`返還 +${this.records.lastSystemRefund} 深淵片`,"#ffd447");this.records.lastSystemRefund=0;this.saveRecords();}
    return result;
  };

  const baseUpdate=Game.prototype.update;
  Game.prototype.update=function(dt){
    const player=this.player,oldX=player?.x||0,oldY=player?.y||0,oldHp=player?.hp||0;
    const result=baseUpdate.call(this,dt);
    if(!this.player)return result;
    if(this.state==="playing"){
      const moved=Math.hypot(this.player.x-oldX,this.player.y-oldY);this.player.lastMove={x:(this.player.x-oldX)/Math.max(dt,.001),y:(this.player.y-oldY)/Math.max(dt,.001)};
      updateStageRules(this,dt);updatePowers(this,dt,moved);
      if(this._systemTimeStop>0){
        this._systemTimeStop=Math.max(0,this._systemTimeStop-dt);
        if(this._systemTimeStop===0&&this._timeBurstPending){
          this._timeBurstPending=false;const stats=getPowerStats(this.player,"time_execution",this._timeExecutionRank||1),damage=this._timeExecutionDamage;
          withDamageSource(this,"time_execution",()=>{for(const enemy of this.enemies){if(enemy.dead)continue;if(stats.execute&&enemy.hp/enemy.maxHp<=stats.execute)this.damageEnemy(enemy,enemy.hp+1,false);else this.damageEnemy(enemy,damage,false);}if(this.boss&&!this.boss.dead)this.damageBoss(damage,false);});
          if(hasSynergy(this.player,"frozen_thunder")){const targets=nearestTargets(this,Math.min(20,this.enemies.length),1400),extra=powerDamage(this,"storm_throne",1.1);withDamageSource(this,"frozen_thunder",()=>targets.forEach(enemy=>{this.addEffect(new LightningEffect(this.player.x,this.player.y,enemy.x,enemy.y,"#65d9ff",.2,6));this.damageEnemy(enemy,extra,false);}));}
          this.addEffect(new SystemPulse(this.player.x,this.player.y,Math.max(this.viewW,this.viewH),"#65d9ff",.7));this.shake(14,.34);
        }
      }
      if(this.player.hp>oldHp&&this._runStats)this._runStats.healing+=this.player.hp-oldHp;
      if(this._onboardingStep<3){
        const tips=[
          {at:1,icon:"↗",name:"移動",desc:"WASD または矢印キーで危険地帯から離脱。",effect:"止まらず、敵の包囲に出口を作る。"},
          {at:15,icon:"◇",name:"自動攻撃と経験値",desc:"攻撃は自動。落ちた経験値を回収して権能を育てる。",effect:"敵へ近づくより、回収経路を選ぶ。"},
          {at:32,icon:"!",name:"危険予告",desc:"色付きの線・円・十字は敵攻撃の予告。",effect:"エフェクトではなく予告範囲の外へ回避。"}
        ];
        const tip=tips[this._onboardingStep];
        if(tip&&this.elapsed>=tip.at){
          this.showSystemToast(tip.icon,tip.name,tip.desc,tip.effect,"#65d9ff");this._onboardingStep++;
          if(this._onboardingStep>=3){this.records.onboardingVersion=1;this.saveRecords();}
        }
      }
      if(this._bossClarityTimer>0)this._bossClarityTimer=Math.max(0,this._bossClarityTimer-dt);
      this._abyssMusic?.update(dt);processPendingModal(this);
      this._buildHudTimer=(this._buildHudTimer||0)-dt;if(this._buildHudTimer<=0){this._buildHudTimer=.25;updateBuildHud(this);}
    }
    return result;
  };

  const baseCalculateShardReward=Game.prototype.calculateShardReward;
  Game.prototype.calculateShardReward=function(clear){const base=baseCalculateShardReward.call(this,clear),layer=selectedLayer(this),challenge=currentChallenge(this);return Math.max(1,Math.floor(base*(1+layer*.1)*challenge.reward));};

  const baseOnClear=Game.prototype.onClear;
  Game.prototype.onClear=function(){
    const layer=selectedLayer(this);this.records.abyssUnlocked=Math.max(this.records.abyssUnlocked||0,Math.min(MAX_ABYSS_LAYER,layer+1));
    const challenge=this.records.challengeSelected||"none";if(challenge!=="none")this.records.challengeBest[challenge]=Math.max(finite(this.records.challengeBest[challenge],-1),layer);
    return baseOnClear.call(this);
  };

  function resultAnalyticsHtml(game,clear){
    const stats=game._runStats||newRunStats(),entries=Object.entries(stats.damageBySource).sort((a,b)=>b[1]-a[1]),total=entries.reduce((sum,item)=>sum+item[1],0),top=entries.slice(0,8);
    const damageRows=top.length?top.map(([source,damage])=>`<div class="damage-source-row"><span>${sourceLabel(source)}</span><span>${Math.round(damage).toLocaleString()} <small>${total?Math.round(damage/total*100):0}%</small></span></div>`).join(""):"<div class=\"damage-source-empty\">ダメージ記録なし</div>";
    const evolved=Object.keys(game.player.powerEvolutions||{}).map(id=>EVOLUTIONS[id]?.name).filter(Boolean).join(" / ")||"なし",synergy=Object.keys(game.player.powerSynergies||{}).map(id=>SYNERGIES[id]?.name).filter(Boolean).join(" / ")||"なし";
    const baseline=game._runRecordBaseline||{},records=[];
    if(game.player.score>finite(baseline.highScore,0))records.push("ハイスコア");
    if(game.elapsed>finite(baseline.bestTime,0))records.push("生存時間");
    if(game.player.kills>finite(baseline.maxKills,0))records.push("撃破数");
    const affordable=SKILL_NODES.find(node=>{const rank=game.getSkillRank?.(node.id)||0,cost=node.costs?.[rank];return rank<(node.max||1)&&Number.isFinite(cost)&&cost<=finite(game.records.shards,0)&&game.skillRequirementsMet?.(node);});
    const challengeName=CHALLENGES[game.records.challengeSelected]?.name||"標準航行",challengeDepth=finite(game.records.challengeBest?.[game.records.challengeSelected],-1);
    const nextGoal=affordable?`星座盤「${affordable.name}」を取得可能`:clear?`深淵層 ${Math.min(MAX_ABYSS_LAYER,selectedLayer(game)+1)}へ挑戦可能`:`あと ${Math.max(0,Math.ceil(CONFIG.GAME_TIME-game.elapsed))}秒生存で初回クリア`;
    return `<section class="run-analysis"><header><strong>RUN ANALYSIS</strong><span>深淵層 ${selectedLayer(game)} / ${challengeName}</span></header><div class="analysis-grid"><div><h3>権能別ダメージ</h3>${damageRows}</div><div><h3>戦闘記録</h3><div class="analysis-stat"><span>総ダメージ</span><b>${Math.round(total).toLocaleString()}</b></div><div class="analysis-stat"><span>被ダメージ</span><b>${Math.round(stats.damageTaken).toLocaleString()}</b></div><div class="analysis-stat"><span>回復量</span><b>${Math.round(stats.healing).toLocaleString()}</b></div><div class="analysis-stat"><span>宝箱 / 増殖巣</span><b>${stats.treasures} / ${stats.stageNests}</b></div><div class="analysis-stat"><span>進化</span><b>${evolved}</b></div><div class="analysis-stat"><span>共鳴</span><b>${synergy}</b></div><div class="analysis-stat"><span>チャレンジ最高深度</span><b>${challengeDepth>=0?challengeDepth:"未記録"}</b></div></div></div><div class="run-next-goal"><span>${records.length?`NEW RECORD｜${records.join("・")}`:"RUN COMPLETE"}</span><strong>${nextGoal}</strong></div></section>`;
  }

  function recordRunHistory(game,clear){
    if(game._resultRecorded)return;game._resultRecorded=true;
    const stats=game._runStats||newRunStats(),damageTotal=Object.values(stats.damageBySource).reduce((sum,value)=>sum+value,0),entry={date:Date.now(),clear:!!clear,layer:selectedLayer(game),challenge:game.records.challengeSelected||"none",time:Math.floor(game.elapsed),kills:game.player.kills,level:game.player.level,damage:Math.round(damageTotal),powers:ownedPowerIds(game.player),evolutions:Object.keys(game.player.powerEvolutions||{}),synergies:Object.keys(game.player.powerSynergies||{})};
    game.records.runHistory=[entry,...(game.records.runHistory||[])].slice(0,MAX_RUN_HISTORY);game.saveRecords();
  }

  const baseShowResult=Game.prototype.showResult;
  Game.prototype.showResult=function(clear){baseShowResult.call(this,clear);recordRunHistory(this,clear);const panel=document.querySelector(`#${clear?"clearScreen":"gameOverScreen"} .title-block`);if(panel){panel.querySelector(".run-analysis")?.remove();panel.querySelector(".result-weapons")?.insertAdjacentHTML("afterend",resultAnalyticsHtml(this,clear));}};

  const baseToTitle=Game.prototype.toTitle;
  Game.prototype.toTitle=function(){this._abyssMusic?.stop();const result=baseToTitle.call(this);updateTitleControls(this);return result;};
  const basePlayerDeath=Game.prototype.onPlayerDeath;
  Game.prototype.onPlayerDeath=function(){this._abyssMusic?.stop();return basePlayerDeath.call(this);};

  const baseUpdateHud=Game.prototype.updateHUD;
  Game.prototype.updateHUD=function(){baseUpdateHud.call(this);updateBuildHud(this);};

  /* ============================== 起動後の補正 ============================== */
  const originalVolumeInput=document.getElementById("volSlider");
  originalVolumeInput?.addEventListener("input",()=>{const game=window.__game;if(game){game.records.volume=Number(originalVolumeInput.value);game.sound.volume=game.records.volume/100;updateSettingOutputs(game);}});

  const treeTitle=document.querySelector("#skillTreeScreen h2");if(treeTitle)treeTitle.textContent="再誕星座盤";
  const treeKicker=document.querySelector(".skill-tree-kicker");if(treeKicker)treeKicker.textContent="ABYSS SYSTEMS / PERMANENT BUILD";
  const treeDescription=document.querySelector(".skill-tree-header p");if(treeDescription)treeDescription.innerHTML="権能枠・進化核・共鳴・深淵層を支える永続回路。<span class=\"rebirth-tree-note\">数値だけでなく、ランの構築手順そのものを変える。</span>";
  document.getElementById("skillTreeBtn")?.replaceChildren(document.createTextNode("再誕星座盤"));
  document.querySelectorAll("#resultSkillBtn1,#resultSkillBtn2").forEach(button=>button.textContent="再誕星座盤");
  const titleNote=document.querySelector(".title-note");if(titleNote)titleNote.textContent="5枠の権能を選び、Lv.3進化と二権能共鳴でビルドを完成させる。固有ボスと5つの環境法則を突破し、より深い層へ降下せよ。";

})();
