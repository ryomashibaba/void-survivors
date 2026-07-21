"use strict";

/*
 * CHROMA REBIRTH
 * 旧ラン強化・旧星座盤を全面置換し、豪快な自動権能、強化敵AI、
 * 宝箱吸引、スクロール式パワーアーカイブを追加する。
 */
(() => {
  const REBIRTH_VERSION = 2;
  const SAVE_KEY = "void_survivors_records";
  const oldSkillNodes = SKILL_NODES.map(node => ({
    id: node.id,
    max: node.max,
    costs: Array.isArray(node.costs) ? node.costs.slice() : [0]
  }));

  const categoryInfo = {
    annihilation:{label:"殲滅権能",color:"#ff5268"},
    dominion:{label:"支配現象",color:"#b45cff"},
    motion:{label:"機動兵装",color:"#65d9ff"},
    defense:{label:"不滅機構",color:"#42e8bd"},
    harvest:{label:"深淵収奪",color:"#ffd447"},
    chaos:{label:"混沌契約",color:"#ff8a4c"}
  };

  const pick = (rank, values) => values[Math.max(0,Math.min(values.length-1,rank-1))];
  const num = (value,digits=2) => {
    if (!Number.isFinite(value)) return "-";
    if (Math.abs(value-Math.round(value))<.005) return String(Math.round(value));
    return value.toFixed(digits).replace(/0+$/,'').replace(/\.$/,'');
  };
  const rankOf = (player,id) => player?.upgradeRanks?.[id] || 0;
  const areaMul = player => player?.powerAreaMul || 1;
  const cooldownMul = player => player?.skillCooldownMul || 1;
  const damageMul = player => player?.powerDamageMul || 1;
  const controlMul = player => player?.controlDurationMul || 1;
  const killChargeMul = player => player?.killChargeMul || 1;

  const POWER_DEFS = {
    solar_funeral:{
      name:"太陽葬送砲",icon:"☀",category:"annihilation",max:3,
      desc:"機体を中心に白熱する二重衝撃波を放ち、周囲を一度に焼き払う。",
      trigger:r=>`${num(pick(r,[9,7.4,6]))}秒ごとに自動発動`,
      stats:r=>({cooldown:pick(r,[9,7.4,6]),radius:pick(r,[340,440,560]),damage:pick(r,[2.4,3.35,4.55])}),
      lines:r=>{const s=POWER_DEFS.solar_funeral.stats(r);return [`半径 ${s.radius}`,`攻撃力 ×${num(s.damage)}`,`再発動 ${num(s.cooldown)}秒`];}
    },
    world_cutter:{
      name:"世界断ち",icon:"╱",category:"annihilation",max:3,
      desc:"最も近い敵の方向へ、画面を横断する巨大な斬撃を一閃する。",
      trigger:r=>`${num(pick(r,[10.5,8.4,6.6]))}秒ごとに自動発動`,
      stats:r=>({cooldown:pick(r,[10.5,8.4,6.6]),range:1320,width:pick(r,[82,116,152]),damage:pick(r,[3.25,4.55,6.1])}),
      lines:r=>{const s=POWER_DEFS.world_cutter.stats(r);return [`射程 ${s.range} / 幅 ${s.width}`,`攻撃力 ×${num(s.damage)}`,`再発動 ${num(s.cooldown)}秒`];}
    },
    storm_throne:{
      name:"雷帝の玉座",icon:"⚡",category:"annihilation",max:3,
      desc:"周囲の多数の敵へ同時落雷。密集していなくても確実に複数体を狙う。",
      trigger:r=>`${num(pick(r,[7.2,5.9,4.8]))}秒ごとに自動発動`,
      stats:r=>({cooldown:pick(r,[7.2,5.9,4.8]),targets:pick(r,[7,12,18]),damage:pick(r,[1.5,2.15,3])}),
      lines:r=>{const s=POWER_DEFS.storm_throne.stats(r);return [`最大 ${s.targets}体`, `1体へ攻撃力 ×${num(s.damage)}`,`再発動 ${num(s.cooldown)}秒`];}
    },
    gravity_coffin:{
      name:"重力棺",icon:"◉",category:"dominion",max:3,
      desc:"敵の密集地点へ重力場を設置。吸い寄せた後、中心から大爆発する。",
      trigger:r=>`${num(pick(r,[12,9.8,7.8]))}秒ごとに設置`,
      stats:r=>({cooldown:pick(r,[12,9.8,7.8]),duration:pick(r,[2.3,2.7,3.1]),radius:pick(r,[240,300,370]),damage:pick(r,[3,4.2,5.7])}),
      lines:r=>{const s=POWER_DEFS.gravity_coffin.stats(r);return [`吸引半径 ${s.radius}`,`収束 ${num(s.duration)}秒 → 攻撃力 ×${num(s.damage)}`,`再設置 ${num(s.cooldown)}秒`];}
    },
    meteor_scripture:{
      name:"流星聖典",icon:"☄",category:"annihilation",max:3,
      desc:"複数の敵へ着弾予告を刻み、少し後に巨大流星を同時落下させる。",
      trigger:r=>`${num(pick(r,[9.5,7.7,6.1]))}秒ごとに自動詠唱`,
      stats:r=>({cooldown:pick(r,[9.5,7.7,6.1]),count:pick(r,[3,5,8]),radius:pick(r,[145,175,210]),damage:pick(r,[2.5,3.4,4.6])}),
      lines:r=>{const s=POWER_DEFS.meteor_scripture.stats(r);return [`流星 ${s.count}発 / 半径 ${s.radius}`,`1発 攻撃力 ×${num(s.damage)}`,`予告 0.8秒`];}
    },
    razor_constellation:{
      name:"刃星座",icon:"✦",category:"motion",max:3,
      desc:"巨大な刃を常時公転させる。接近した敵を短い間隔で繰り返し切断する。",
      trigger:()=>"常時発動・機体周囲を公転",
      stats:r=>({count:pick(r,[3,5,7]),radius:pick(r,[112,132,154]),damage:pick(r,[.95,1.35,1.85]),hitCd:pick(r,[.38,.31,.25])}),
      lines:r=>{const s=POWER_DEFS.razor_constellation.stats(r);return [`刃 ${s.count}枚 / 公転半径 ${s.radius}`,`1Hit 攻撃力 ×${num(s.damage)}`,`同一敵へ ${num(s.hitCd)}秒間隔`];}
    },
    comet_wake:{
      name:"彗星航跡",icon:"➤",category:"motion",max:3,
      desc:"移動した軌跡へ爆縮弾を残す。追ってくる敵を連続爆破し、移動そのものを武器にする。",
      trigger:()=>"移動中に自動設置",
      stats:r=>({spacing:pick(r,[74,58,44]),radius:pick(r,[105,132,162]),damage:pick(r,[1.15,1.6,2.2])}),
      lines:r=>{const s=POWER_DEFS.comet_wake.stats(r);return [`移動 ${s.spacing}ごとに設置`,`爆発半径 ${s.radius}`,`攻撃力 ×${num(s.damage)}`];}
    },
    mirror_legion:{
      name:"鏡像軍団",icon:"◇◇",category:"motion",max:3,
      desc:"機体の周囲に鏡像を展開。各鏡像が別々の敵へ瞬間砲撃を行う。",
      trigger:r=>`${num(pick(r,[1.45,1.16,.92]))}秒ごとに全鏡像が射撃`,
      stats:r=>({count:pick(r,[2,3,4]),cooldown:pick(r,[1.45,1.16,.92]),damage:pick(r,[.9,1.2,1.55])}),
      lines:r=>{const s=POWER_DEFS.mirror_legion.stats(r);return [`鏡像 ${s.count}機`,`各砲撃 攻撃力 ×${num(s.damage)}`,`射撃間隔 ${num(s.cooldown)}秒`];}
    },
    void_choir:{
      name:"虚無聖歌",icon:"✺",category:"annihilation",max:3,
      desc:"全方向へ巨大な光条を一斉放射。周囲を囲む敵列をまとめて貫く。",
      trigger:r=>`${num(pick(r,[8.2,6.5,5.1]))}秒ごとに全周斉射`,
      stats:r=>({cooldown:pick(r,[8.2,6.5,5.1]),rays:pick(r,[12,18,26]),width:pick(r,[26,34,44]),damage:pick(r,[1.35,1.85,2.55])}),
      lines:r=>{const s=POWER_DEFS.void_choir.stats(r);return [`光条 ${s.rays}本 / 幅 ${s.width}`,`攻撃力 ×${num(s.damage)}`,`再発動 ${num(s.cooldown)}秒`];}
    },
    doom_bloom:{
      name:"終末開花",icon:"❋",category:"annihilation",max:3,
      desc:"一定数の撃破ごとに死体位置から花弁状の連鎖砲撃を放ち、次の群れを刈り取る。",
      trigger:r=>`${pick(r,[16,12,9])}体撃破ごとに発動`,
      stats:r=>({kills:pick(r,[16,12,9]),targets:pick(r,[8,13,20]),damage:pick(r,[1.35,1.9,2.65])}),
      lines:r=>{const s=POWER_DEFS.doom_bloom.stats(r);return [`必要撃破 ${s.kills}体`,`最大 ${s.targets}体へ花弁砲撃`,`1体へ攻撃力 ×${num(s.damage)}`];}
    },
    black_sun:{
      name:"黒い太陽",icon:"●",category:"dominion",max:3,
      desc:"機体の外周を黒い恒星が公転。触れた敵を継続的に焼き、進路を切り開く。",
      trigger:()=>"常時発動・外周を公転",
      stats:r=>({orbit:pick(r,[190,220,250]),radius:pick(r,[82,105,130]),dps:pick(r,[2.3,3.35,4.8])}),
      lines:r=>{const s=POWER_DEFS.black_sun.stats(r);return [`公転半径 ${s.orbit} / 恒星半径 ${s.radius}`,`毎秒 攻撃力 ×${num(s.dps)}`,`接触中は連続ダメージ`];}
    },
    time_execution:{
      name:"時間処刑",icon:"⌛",category:"dominion",max:3,
      desc:"敵と敵弾を完全停止。停止終了時、凍結していた全敵へ同時ダメージを与える。",
      trigger:r=>`${num(pick(r,[13,10.5,8.2]))}秒ごとに時間停止`,
      stats:r=>({cooldown:pick(r,[13,10.5,8.2]),duration:pick(r,[1.35,1.9,2.55]),damage:pick(r,[1.9,2.65,3.65])}),
      lines:r=>{const s=POWER_DEFS.time_execution.stats(r);return [`完全停止 ${num(s.duration)}秒`,`終了時 全敵へ攻撃力 ×${num(s.damage)}`,`再発動 ${num(s.cooldown)}秒`];}
    },
    leviathan_shell:{
      name:"巨獣殻",icon:"⬢",category:"defense",max:3,
      desc:"一定間隔で一度だけ攻撃を無効化する殻を再生。破壊時に巨大反撃波を放つ。",
      trigger:r=>`${num(pick(r,[14,10.8,8]))}秒で防壁を再生`,
      stats:r=>({cooldown:pick(r,[14,10.8,8]),radius:pick(r,[300,390,500]),damage:pick(r,[2.4,3.35,4.65])}),
      lines:r=>{const s=POWER_DEFS.leviathan_shell.stats(r);return [`1回の被弾を完全無効化`,`破壊時 半径 ${s.radius}`,`反撃 攻撃力 ×${num(s.damage)}`];}
    },
    blood_eclipse:{
      name:"血蝕皆既",icon:"◒",category:"defense",max:3,
      desc:"HP35%以下で自動覚醒。無敵化しながら短時間に複数の赤い衝撃波を連射する。",
      trigger:r=>`瀕死時に発動 / 再使用 ${pick(r,[18,14,10])}秒`,
      stats:r=>({cooldown:pick(r,[18,14,10]),duration:pick(r,[2.1,2.7,3.4]),pulse:pick(r,[.65,.85,1.15]),radius:pick(r,[260,340,430])}),
      lines:r=>{const s=POWER_DEFS.blood_eclipse.stats(r);return [`無敵 ${num(s.duration)}秒`,`0.5秒ごと 半径 ${s.radius}`,`1波 攻撃力 ×${num(s.pulse)}`];}
    },
    hunter_verdict:{
      name:"狩神判決",icon:"†",category:"dominion",max:3,
      desc:"撃破を重ねると最もHPの高い雑魚を即処刑。ボスには最大HP割合ダメージを与える。",
      trigger:r=>`${pick(r,[10,7,5])}体撃破ごとに執行`,
      stats:r=>({kills:pick(r,[10,7,5]),execute:pick(r,[.36,.48,.62]),boss:pick(r,[.08,.12,.17])}),
      lines:r=>{const s=POWER_DEFS.hunter_verdict.stats(r);return [`雑魚：HP${Math.round(s.execute*100)}%以下を即死`,`ボス：最大HPの ${Math.round(s.boss*100)}%`,`必要撃破 ${s.kills}体`];}
    },
    prism_web:{
      name:"プリズム蜘蛛網",icon:"⌗",category:"dominion",max:3,
      desc:"多数の敵を光線で結び、線に触れた別の敵までまとめて切り裂く。",
      trigger:r=>`${num(pick(r,[5.8,4.6,3.6]))}秒ごとに展開`,
      stats:r=>({cooldown:pick(r,[5.8,4.6,3.6]),nodes:pick(r,[6,10,15]),width:pick(r,[24,31,40]),damage:pick(r,[1.25,1.75,2.4])}),
      lines:r=>{const s=POWER_DEFS.prism_web.stats(r);return [`接続 ${s.nodes}体 / 線幅 ${s.width}`,`攻撃力 ×${num(s.damage)}`,`再展開 ${num(s.cooldown)}秒`];}
    },
    chaos_oracle:{
      name:"混沌神託",icon:"?",category:"chaos",max:3,
      desc:"太陽砲・世界断ち・落雷・流星から一つをランダム発動。予測不能だが高頻度。",
      trigger:r=>`${num(pick(r,[7,5.7,4.5]))}秒ごとにランダム発動`,
      stats:r=>({cooldown:pick(r,[7,5.7,4.5]),power:pick(r,[.78,1,1.28])}),
      lines:r=>{const s=POWER_DEFS.chaos_oracle.stats(r);return [`4種類からランダム`,`各権能の威力 ×${num(s.power)}`,`再抽選 ${num(s.cooldown)}秒`];}
    },
    treasure_singularity:{
      name:"宝物特異点",icon:"▣",category:"harvest",max:3,
      desc:"宝箱取得時に画面規模の財宝爆発。回復と大量経験値も同時に得る。",
      trigger:()=>"宝箱を取得するたび発動",
      stats:r=>({radius:pick(r,[420,560,720]),damage:pick(r,[3.2,4.8,6.8]),exp:pick(r,[.35,.65,1])}),
      lines:r=>{const s=POWER_DEFS.treasure_singularity.stats(r);return [`爆発半径 ${s.radius}`,`攻撃力 ×${num(s.damage)}`,`次Lv必要経験値の ${Math.round(s.exp*100)}%獲得`];}
    },
    overdrive_contract:{
      name:"過剰駆動契約",icon:"✕",category:"chaos",max:3,
      desc:"すべての自動権能を大幅高速化する代わりに、最大HPを恒久的に削る危険な契約。",
      trigger:()=>"取得直後から常時適用",
      stats:r=>({cooldown:Math.pow(.82,r),hp:Math.pow(.9,r)}),
      lines:r=>{const s=POWER_DEFS.overdrive_contract.stats(r);return [`権能クールダウン ×${num(s.cooldown)}`,`最大HP ×${num(s.hp)}`,`火力は低下しない`];},
      tradeoff:true,
      onAcquire(player){
        player.skillCooldownMul=(player.skillCooldownMul||1)*.82;
        player.maxHp=Math.max(1,Math.round(player.maxHp*.9));
        player.hp=Math.min(player.hp,player.maxHp);
      }
    },
    abyss_banquet:{
      name:"深淵饗宴",icon:"♢",category:"harvest",max:3,
      desc:"経験値を一定数回収すると捕食波を放ち、全方向の敵を食らってHPを回復する。",
      trigger:r=>`経験値ジェム ${pick(r,[32,23,16])}個回収ごと`,
      stats:r=>({gems:pick(r,[32,23,16]),radius:pick(r,[430,560,720]),damage:pick(r,[2.2,3.2,4.6]),heal:pick(r,[.05,.08,.12])}),
      lines:r=>{const s=POWER_DEFS.abyss_banquet.stats(r);return [`必要ジェム ${s.gems}個`,`半径 ${s.radius} / 攻撃力 ×${num(s.damage)}`,`最大HPの ${Math.round(s.heal*100)}%回復`];}
    }
  };

  const POWER_IDS = Object.keys(POWER_DEFS);

  /* ------------------------------ 永続星座盤の全面置換 ------------------------------ */
  const NEW_BRANCHES = [
    {id:"core",name:"終末中枢",icon:"◇",color:"#ffd447",desc:"すべての権能を起動する再誕核",focus:{x:630,y:410}},
    {id:"havoc",name:"殲滅神格",icon:"☄",color:"#ff5268",desc:"威力・開幕権能・極端な火力教義",focus:{x:235,y:215}},
    {id:"dominion",name:"現象支配",icon:"◉",color:"#b45cff",desc:"範囲・制御時間・クールダウン操作",focus:{x:1025,y:215}},
    {id:"aegis",name:"不滅機構",icon:"⬢",color:"#42e8bd",desc:"防壁・復活・瀕死時の逆転",focus:{x:235,y:625}},
    {id:"harvest",name:"深淵収奪",icon:"▣",color:"#65d9ff",desc:"経験値・宝箱・深淵片・開始選択",focus:{x:1025,y:625}}
  ];

  const NEW_NODES = [
    {id:"core_awakening",branch:"core",name:"再誕核",icon:"◇",type:"origin",x:630,y:410,max:1,costs:[0],requires:[],desc:"旧回路を破棄し、権能駆動型の新しい機体を起動する。",effect:r=>r?"CHROMA REBIRTH ONLINE":"未起動"},
    {id:"rebirth_output",branch:"core",name:"神格出力",icon:"◆",type:"minor",x:630,y:285,max:2,costs:[4,7],requires:[{id:"core_awakening",rank:1}],desc:"すべての新権能の最終ダメージを大きく増やす。",effect:r=>`権能ダメージ +${r*12}%`},
    {id:"rebirth_clock",branch:"core",name:"時喰い時計",icon:"⌛",type:"minor",x:755,y:410,max:2,costs:[4,7],requires:[{id:"core_awakening",rank:1}],desc:"すべての時間発動型権能を高速化する。",effect:r=>`権能クールダウン -${r*8}%`},
    {id:"rebirth_frame",branch:"core",name:"巨神フレーム",icon:"♥",type:"minor",x:630,y:535,max:2,costs:[4,7],requires:[{id:"core_awakening",rank:1}],desc:"最大HPを割合で増加させる。",effect:r=>`最大HP +${r*14}%`},
    {id:"rebirth_draft",branch:"core",name:"四択宣言",icon:"▤",type:"notable",x:505,y:410,max:1,costs:[10],requires:[{id:"core_awakening",rank:1}],desc:"毎回のレベルアップ候補を3つから4つへ増やす。",effect:r=>r?"強化候補 3 → 4":"未取得"},

    {id:"havoc_seed",branch:"havoc",name:"開幕の凶兆",icon:"✹",type:"notable",x:405,y:275,max:1,costs:[9],requires:[{id:"rebirth_output",rank:1}],desc:"ラン開始時、ランダムな新権能をLv.1で獲得する。",effect:r=>r?"開始時ランダム権能 Lv.1":"未取得"},
    {id:"havoc_overkill",branch:"havoc",name:"過剰殺戮炉",icon:"☠",type:"notable",x:285,y:185,max:2,costs:[7,11],requires:[{id:"havoc_seed",rank:1}],desc:"撃破数で発動する権能を早め、全権能の威力も増幅する。",effect:r=>`権能ダメージ +${r*10}% / 必要撃破 -${r*10}%`},
    {id:"redline_god",branch:"havoc",name:"赤線神格",icon:"✕",type:"keystone",x:105,y:170,max:1,costs:[16],requires:[{id:"havoc_overkill",rank:1}],branchReq:2,exclusive:"havoc_doctrine",desc:"HPを大幅に犠牲にし、威力と発動速度を極限まで高める。",effect:r=>r?"権能ダメージ ×1.40 / CD ×0.82 / 最大HP ×0.68":"未選択",tradeoff:true},
    {id:"colossus_god",branch:"havoc",name:"巨像神格",icon:"▰",type:"keystone",x:105,y:325,max:1,costs:[16],requires:[{id:"havoc_seed",rank:1}],branchReq:2,exclusive:"havoc_doctrine",desc:"移動速度を犠牲に、巨大な範囲と重い一撃を得る。",effect:r=>r?"権能範囲 ×1.35 / 権能ダメージ ×1.18 / 移動速度 ×0.82":"未選択",tradeoff:true},
    {id:"havoc_mastery",branch:"havoc",name:"黙示録の種",icon:"☄",type:"mastery",x:105,y:65,max:1,costs:[22],requires:[{id:"havoc_overkill",rank:2}],branchReq:4,desc:"ラン開始時のランダム権能を2種類へ増やす。",effect:r=>r?"開始時ランダム権能 +2種類":"未取得"},

    {id:"dominion_area",branch:"dominion",name:"世界拡張",icon:"◎",type:"minor",x:855,y:275,max:2,costs:[5,8],requires:[{id:"rebirth_output",rank:1}],desc:"円・線・爆発を含む全権能の判定範囲を拡大する。",effect:r=>`権能範囲 +${r*13}%`},
    {id:"dominion_control",branch:"dominion",name:"停止法則",icon:"⌛",type:"notable",x:975,y:180,max:2,costs:[7,11],requires:[{id:"dominion_area",rank:1}],desc:"時間停止と重力場などの支配時間を延長する。",effect:r=>`支配時間 +${r*18}%`},
    {id:"chaos_clock",branch:"dominion",name:"乱数時計",icon:"?",type:"keystone",x:1150,y:170,max:1,costs:[16],requires:[{id:"dominion_control",rank:1}],branchReq:2,exclusive:"dominion_doctrine",desc:"全権能を高速化するが、個々の威力を少し落とす。",effect:r=>r?"権能CD ×0.70 / 権能ダメージ ×0.88":"未選択",tradeoff:true},
    {id:"precision_law",branch:"dominion",name:"絶対法則",icon:"†",type:"keystone",x:1150,y:325,max:1,costs:[16],requires:[{id:"dominion_area",rank:2}],branchReq:2,exclusive:"dominion_doctrine",desc:"発動間隔を長くする代わりに、すべての一撃を巨大化する。",effect:r=>r?"権能ダメージ ×1.38 / 権能CD ×1.16":"未選択",tradeoff:true},
    {id:"dominion_mastery",branch:"dominion",name:"二重現実",icon:"◇◇",type:"mastery",x:1150,y:65,max:1,costs:[22],requires:[{id:"dominion_control",rank:2}],branchReq:4,desc:"一定確率で時間発動型権能が弱い残響を追加発動する。",effect:r=>r?"22%で残響発動（45%威力）":"未取得"},

    {id:"aegis_shell",branch:"aegis",name:"原初防壁",icon:"⬢",type:"notable",x:405,y:555,max:1,costs:[9],requires:[{id:"rebirth_frame",rank:1}],desc:"巨獣殻を持っていなくても、一定間隔で一度だけ被弾を無効化する。",effect:r=>r?"18秒ごとに1Hit防壁":"未取得"},
    {id:"aegis_blood",branch:"aegis",name:"瀕死炉心",icon:"◒",type:"notable",x:285,y:650,max:2,costs:[7,11],requires:[{id:"aegis_shell",rank:1}],desc:"HP35%以下で威力と移動速度を大きく増やす。",effect:r=>`瀕死時：権能威力 +${r*18}% / 速度 +${r*12}%`},
    {id:"glass_god",branch:"aegis",name:"硝子の神",icon:"◇",type:"keystone",x:105,y:540,max:1,costs:[16],requires:[{id:"aegis_blood",rank:1}],branchReq:2,exclusive:"aegis_doctrine",desc:"最大HPを半減させ、全攻撃を暴力的に増幅する。",effect:r=>r?"全ダメージ ×1.55 / 最大HP ×0.55":"未選択",tradeoff:true},
    {id:"fortress_god",branch:"aegis",name:"不動の神",icon:"▣",type:"keystone",x:105,y:695,max:1,costs:[16],requires:[{id:"aegis_shell",rank:1}],branchReq:2,exclusive:"aegis_doctrine",desc:"移動速度を犠牲に、巨大HPと常時軽減を得る。",effect:r=>r?"最大HP ×1.65 / 被ダメージ -12% / 速度 ×0.82":"未選択",tradeoff:true},
    {id:"aegis_mastery",branch:"aegis",name:"死者拒絶",icon:"☀",type:"mastery",x:105,y:790,max:1,costs:[22],requires:[{id:"aegis_blood",rank:2}],branchReq:4,desc:"1ランに一度、死亡を拒絶してHP45%・3秒無敵で復帰する。",effect:r=>r?"復活1回 / HP45% / 3秒無敵":"未取得"},

    {id:"harvest_growth",branch:"harvest",name:"暴食学習",icon:"♢",type:"minor",x:855,y:555,max:2,costs:[5,8],requires:[{id:"rebirth_clock",rank:1}],desc:"すべての経験値獲得量を大きく増やす。",effect:r=>`経験値 +${r*10}%`},
    {id:"harvest_magnet",branch:"harvest",name:"財宝磁界",icon:"◎",type:"notable",x:975,y:650,max:1,costs:[10],requires:[{id:"harvest_growth",rank:1}],desc:"宝箱が広範囲から自動で吸い寄せられる。",effect:r=>r?"宝箱吸引半径 760":"未取得"},
    {id:"swift_harvest",branch:"harvest",name:"疾走収奪",icon:"↯",type:"keystone",x:1150,y:540,max:1,costs:[16],requires:[{id:"harvest_growth",rank:2}],branchReq:2,exclusive:"harvest_doctrine",desc:"成長速度を優先し、持ち帰る深淵片を少し減らす。",effect:r=>r?"経験値 ×1.30 / 深淵片 ×0.82":"未選択",tradeoff:true},
    {id:"deep_harvest",branch:"harvest",name:"深層収奪",icon:"▣",type:"keystone",x:1150,y:695,max:1,costs:[16],requires:[{id:"harvest_magnet",rank:1}],branchReq:2,exclusive:"harvest_doctrine",desc:"成長を少し遅らせ、持ち帰る深淵片を大幅に増やす。",effect:r=>r?"深淵片 ×1.45 / 経験値 ×0.90":"未選択",tradeoff:true},
    {id:"harvest_mastery",branch:"harvest",name:"黄金雨",icon:"✦",type:"mastery",x:1150,y:790,max:1,costs:[22],requires:[{id:"harvest_magnet",rank:1},{id:"harvest_growth",rank:2}],branchReq:4,desc:"60体撃破ごとに宝箱を強制出現させる。",effect:r=>r?"60撃破ごとに宝箱 +1":"未取得"}
  ];

  SKILL_BRANCHES.splice(0,SKILL_BRANCHES.length,...NEW_BRANCHES);
  SKILL_NODES.splice(0,SKILL_NODES.length,...NEW_NODES);
  for (const key of Object.keys(SKILL_LOOKUP)) delete SKILL_LOOKUP[key];
  for (const node of SKILL_NODES){
    const branch=SKILL_BRANCHES.find(item=>item.id===node.branch);
    SKILL_LOOKUP[node.id]={...node,branchName:branch?.name||"",branchColor:branch?.color||"#fff"};
  }

  function refundOldTree(rawTree){
    if (!rawTree || typeof rawTree!=="object" || Array.isArray(rawTree)) return 0;
    let refund=0;
    for (const node of oldSkillNodes){
      if (node.id==="core_awakening") continue;
      const rank=Math.max(0,Math.min(node.max,Math.floor(Number(rawTree[node.id])||0)));
      for(let i=0;i<rank;i++) refund+=node.costs[i]??node.costs[node.costs.length-1]??0;
    }
    return refund;
  }

  const previousLoadRecords=Game.prototype.loadRecords;
  Game.prototype.loadRecords=function(){
    let raw={};
    try{raw=JSON.parse(localStorage.getItem(SAVE_KEY)||"{}");}catch(e){raw={};}
    const needsMigration=Number(raw.chromaRebirthVersion||0)<REBIRTH_VERSION;
    const refund=needsMigration?refundOldTree(raw.skillTree):0;
    previousLoadRecords.call(this);
    if (needsMigration){
      this.records.shards=Math.max(0,Math.floor(Number(this.records.shards)||0))+refund;
      this.records.totalShards=Math.max(this.records.shards,Math.floor(Number(this.records.totalShards)||0));
      this.records.skillTree={core_awakening:1};
      this.records.chromaRebirthVersion=REBIRTH_VERSION;
      try{localStorage.setItem(SAVE_KEY,JSON.stringify(this.records));}catch(e){}
      this._rebirthRefund=refund;
      this.updateMetaUI();
    }
  };

  /* ------------------------------ 軽量ダメージと共通演出 ------------------------------ */
  function powerDamage(game,multiplier,scale=1){
    const p=game.player;
    const lowBonus=p.hp/Math.max(1,p.maxHp)<=.35?(p.lowPowerBonus||0):0;
    return Math.max(1,Math.round(p.atk*p.effAtkMul*p.damageAmp*damageMul(p)*(1+lowBonus)*multiplier*scale));
  }

  function addDamageText(game,x,y,value,color){
    if (!game.damageTexts || game.damageTexts.length>=CONFIG.MAX_DAMAGE_TEXTS) return;
    game.damageTexts.push(new DamageText(x,y,String(Math.round(value)),color||"#fff7dc",false));
  }

  function reducedEnemyDamage(enemy,damage){
    return enemy?damage*(enemy._rebirthGuard>0?.3:1):damage;
  }

  function leanHit(game,enemy,damage,showText=false){
    if (!enemy || enemy.dead || enemy._deathEffectQueued || enemy._deathEffectFinished) return false;
    const dealt=Math.max(1,Math.round(reducedEnemyDamage(enemy,damage)));
    enemy.hp-=dealt;
    enemy.hitFlash=.14;
    if(showText)addDamageText(game,enemy.x,enemy.y-enemy.radius,dealt,"#fff7dc");
    if(enemy.hp>0)return false;
    enemy.onDeath(game);
    if(Math.random()<game.player.lifestealChance){
      game.player.hp=Math.min(game.player.maxHp,game.player.hp+Math.round(game.player.maxHp*.04));
    }
    return true;
  }

  function leanBossHit(game,damage,showText=true){
    const boss=game.boss;
    if(!boss||boss.dead)return false;
    const dealt=Math.max(1,Math.round(damage));
    boss.hp-=dealt;boss.hitFlash=.18;
    if(showText)addDamageText(game,boss.x,boss.y-boss.radius-8,dealt,"#ffd447");
    if(boss.hp>0)return false;
    boss.onDeath(game);
    document.getElementById("bossBarWrap")?.classList.add("hidden");
    game.boss=null;
    return true;
  }

  function enemiesInRadius(game,x,y,radius){
    const result=[];
    const r2=radius*radius;
    for(const enemy of game.enemies){
      if(!enemy.dead&&U.dist2(x,y,enemy.x,enemy.y)<=Math.pow(radius+enemy.radius,2))result.push(enemy);
    }
    return result;
  }

  function segmentDistance(px,py,ax,ay,bx,by){
    const dx=bx-ax,dy=by-ay,len2=dx*dx+dy*dy;
    if(len2<=.0001)return Math.hypot(px-ax,py-ay);
    const t=U.clamp(((px-ax)*dx+(py-ay)*dy)/len2,0,1);
    return Math.hypot(px-(ax+dx*t),py-(ay+dy*t));
  }

  function areaBlast(game,x,y,radius,damage,color,textLimit=5){
    let shown=0;
    for(const enemy of enemiesInRadius(game,x,y,radius))leanHit(game,enemy,damage,shown++<textLimit);
    if(game.boss&&!game.boss.dead&&U.dist2(x,y,game.boss.x,game.boss.y)<=Math.pow(radius+game.boss.radius,2))leanBossHit(game,damage);
    game.addEffect(new ShockwaveEffect(x,y,color,radius,.62,{inner:22,fill:true}));
  }

  class LayeredPulse{
    constructor(x,y,radius,color,life=.55){this.x=x;this.y=y;this.radius=radius;this.color=color;this.life=life;this.maxLife=life;this.dead=false;}
    update(dt){this.life-=dt;if(this.life<=0)this.dead=true;}
    draw(ctx,cam){
      const p=1-this.life/this.maxLife,a=Math.max(0,this.life/this.maxLife),r=this.radius*(.18+.82*(1-Math.pow(1-p,3)));
      ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.globalCompositeOperation="source-over";
      const g=ctx.createRadialGradient(0,0,0,0,0,Math.max(1,r));
      g.addColorStop(0,`rgba(255,255,255,${a*.7})`);g.addColorStop(.25,rgba(this.color,a*.32));g.addColorStop(1,rgba(this.color,0));
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
      for(let i=0;i<3;i++){ctx.strokeStyle=i===1?rgba("#fff7dc",a*.9):rgba(this.color,a*(.65-i*.12));ctx.lineWidth=Math.max(1,9-i*3);ctx.beginPath();ctx.arc(0,0,r*(.65+i*.16),0,Math.PI*2);ctx.stroke();}
      ctx.restore();
    }
  }

  class PowerBeam{
    constructor(ax,ay,bx,by,width,color,life=.3){this.ax=ax;this.ay=ay;this.bx=bx;this.by=by;this.x=(ax+bx)/2;this.y=(ay+by)/2;this.radius=Math.hypot(bx-ax,by-ay)/2;this.width=width;this.color=color;this.life=life;this.maxLife=life;this.dead=false;}
    update(dt){this.life-=dt;if(this.life<=0)this.dead=true;}
    draw(ctx,cam){const a=Math.max(0,this.life/this.maxLife);ctx.save();ctx.translate(-cam.x,-cam.y);ctx.lineCap="round";for(const [w,c] of [[this.width*2.4,rgba(this.color,a*.14)],[this.width,rgba(this.color,a*.8)],[Math.max(3,this.width*.18),rgba("#fff7dc",a)]]){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(this.ax,this.ay);ctx.lineTo(this.bx,this.by);ctx.stroke();}ctx.restore();}
  }

  class WarningEffect{
    constructor(x,y,opt={}){this.x=x;this.y=y;this.radius=opt.radius||120;this.angle=opt.angle||0;this.length=opt.length||500;this.width=opt.width||24;this.kind=opt.kind||"ring";this.color=opt.color||"#ff5268";this.life=opt.life||.7;this.maxLife=this.life;this.dead=false;}
    update(dt){this.life-=dt;if(this.life<=0)this.dead=true;}
    draw(ctx,cam){const a=Math.max(0,this.life/this.maxLife),pulse=.6+.4*Math.sin((1-a)*Math.PI*12);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.rotate(this.angle);ctx.globalAlpha=.55+.45*pulse;ctx.strokeStyle=this.color;ctx.fillStyle=rgba(this.color,.1);ctx.lineWidth=5;ctx.setLineDash([16,10]);ctx.lineDashOffset=-performance.now()*.08;
      if(this.kind==="line"){ctx.fillRect(0,-this.width/2,this.length,this.width);ctx.strokeRect(0,-this.width/2,this.length,this.width);}else if(this.kind==="cross"){ctx.fillRect(-this.length,-this.width/2,this.length*2,this.width);ctx.fillRect(-this.width/2,-this.length,this.width,this.length*2);ctx.strokeRect(-this.length,-this.width/2,this.length*2,this.width);ctx.strokeRect(-this.width/2,-this.length,this.width,this.length*2);}else{ctx.beginPath();ctx.arc(0,0,this.radius,0,Math.PI*2);ctx.fill();ctx.stroke();}
      ctx.setLineDash([]);ctx.restore();}
  }

  class GravityCoffinEffect{
    constructor(game,x,y,rank,scale=1){const s=POWER_DEFS.gravity_coffin.stats(rank);this.game=game;this.x=x;this.y=y;this.radius=s.radius*areaMul(game.player);this.damage=powerDamage(game,s.damage,scale);this.life=s.duration*controlMul(game.player);this.maxLife=this.life;this.dead=false;this.tick=0;this.color="#b45cff";}
    update(dt){
      this.life-=dt;this.tick-=dt;
      if(this.tick<=0){this.tick=.08;for(const enemy of enemiesInRadius(this.game,this.x,this.y,this.radius)){const d=Math.max(20,U.dist(enemy.x,enemy.y,this.x,this.y)),pull=(1-d/this.radius)*1150;enemy.x+=((this.x-enemy.x)/d)*pull*.08;enemy.y+=((this.y-enemy.y)/d)*pull*.08;}}
      if(this.life<=0&&!this.dead){areaBlast(this.game,this.x,this.y,this.radius,this.damage,this.color,8);this.game.addEffect(new LayeredPulse(this.x,this.y,this.radius,this.color,.7));this.game.shake(14,.35);this.dead=true;}
    }
    draw(ctx,cam){const a=Math.max(0,this.life/this.maxLife),r=this.radius*(.82+.08*Math.sin(performance.now()*.01));ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.globalCompositeOperation="source-over";const g=ctx.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,rgba("#090718",.72));g.addColorStop(.55,rgba(this.color,.18));g.addColorStop(1,rgba(this.color,0));ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle=rgba(this.color,.85*a);ctx.lineWidth=6;ctx.setLineDash([20,12]);ctx.lineDashOffset=-performance.now()*.05;ctx.beginPath();ctx.arc(0,0,r*.82,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();}
  }

  class MeteorMarker{
    constructor(game,x,y,rank,scale=1){const s=POWER_DEFS.meteor_scripture.stats(rank);this.game=game;this.x=x;this.y=y;this.radius=s.radius*areaMul(game.player);this.damage=powerDamage(game,s.damage,scale);this.life=.8;this.maxLife=.8;this.dead=false;}
    update(dt){this.life-=dt;if(this.life<=0&&!this.dead){areaBlast(this.game,this.x,this.y,this.radius,this.damage,"#ff8a4c",4);this.game.addEffect(new LayeredPulse(this.x,this.y,this.radius,"#ffd447",.55));this.dead=true;}}
    draw(ctx,cam){const p=1-this.life/this.maxLife,a=.45+.55*Math.sin(p*Math.PI*10);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.strokeStyle=`rgba(255,82,104,${a})`;ctx.fillStyle="rgba(255,138,76,.12)";ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,this.radius*(.55+.45*p),0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(-this.radius,0);ctx.lineTo(this.radius,0);ctx.moveTo(0,-this.radius);ctx.lineTo(0,this.radius);ctx.stroke();ctx.restore();}
  }

  class CometMine{
    constructor(game,x,y,rank){const s=POWER_DEFS.comet_wake.stats(rank);this.game=game;this.x=x;this.y=y;this.radius=s.radius*areaMul(game.player);this.damage=powerDamage(game,s.damage);this.life=.48;this.maxLife=.48;this.dead=false;}
    update(dt){this.life-=dt;if(this.life<=0&&!this.dead){areaBlast(this.game,this.x,this.y,this.radius,this.damage,"#65d9ff",3);this.dead=true;}}
    draw(ctx,cam){const a=Math.max(0,this.life/this.maxLife);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.rotate(performance.now()*.004);ctx.strokeStyle=rgba("#65d9ff",a);ctx.fillStyle=rgba("#5164ff",.16);ctx.lineWidth=4;polygonPath(ctx,[[0,-18],[18,0],[0,18],[-18,0]]);ctx.fill();ctx.stroke();ctx.restore();}
  }

  class ChoirEffect{
    constructor(x,y,rays,width,color){this.x=x;this.y=y;this.radius=1250;this.rays=rays;this.width=width;this.color=color;this.life=.34;this.maxLife=.34;this.dead=false;this.rotation=Math.random()*Math.PI*2;}
    update(dt){this.life-=dt;if(this.life<=0)this.dead=true;}
    draw(ctx,cam){const a=Math.max(0,this.life/this.maxLife);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.rotate(this.rotation);ctx.lineCap="round";for(let i=0;i<this.rays;i++){const ang=i/this.rays*Math.PI*2;ctx.save();ctx.rotate(ang);ctx.strokeStyle=rgba(this.color,a*.28);ctx.lineWidth=this.width*1.8;ctx.beginPath();ctx.moveTo(28,0);ctx.lineTo(this.radius,0);ctx.stroke();ctx.strokeStyle=rgba("#fff7dc",a);ctx.lineWidth=Math.max(2,this.width*.18);ctx.beginPath();ctx.moveTo(28,0);ctx.lineTo(this.radius,0);ctx.stroke();ctx.restore();}ctx.restore();}
  }

  class WebEffect{
    constructor(points,width,color){this.points=points;this.x=points[0]?.x||0;this.y=points[0]?.y||0;this.radius=900;this.width=width;this.color=color;this.life=.34;this.maxLife=.34;this.dead=false;}
    update(dt){this.life-=dt;if(this.life<=0)this.dead=true;}
    draw(ctx,cam){const a=Math.max(0,this.life/this.maxLife);ctx.save();ctx.translate(-cam.x,-cam.y);ctx.lineCap="round";for(let i=1;i<this.points.length;i++){const p=this.points[i-1],q=this.points[i];ctx.strokeStyle=rgba(this.color,a*.35);ctx.lineWidth=this.width*2;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();ctx.strokeStyle=rgba("#fff7dc",a);ctx.lineWidth=Math.max(2,this.width*.18);ctx.stroke();}ctx.restore();}
  }

  class AbyssMine{
    constructor(game,x,y,damage,color="#ff5268"){this.game=game;this.x=x;this.y=y;this.finalDamage=damage;this.damage=0;this.radius=5;this.color=color;this.life=2.1;this.maxLife=2.1;this.dead=false;this.age=0;}
    update(dt){if(window.__rebirthTimeStop)return;this.age+=dt;this.life-=dt;this.radius=this.age<.75?5:14;this.damage=this.age<.75?0:this.finalDamage;if(this.life<=0&&!this.dead){this.dead=true;for(let i=0;i<8;i++){const a=i/8*Math.PI*2;spawnEnemyShot(this.game,this.x,this.y,a,245,this.finalDamage,7,this.color);}}}
    draw(ctx,cam){const armed=this.age>=.75,pulse=.7+.3*Math.sin(this.age*15);ctx.save();ctx.translate(this.x-cam.x,this.y-cam.y);ctx.rotate(this.age*2);ctx.strokeStyle=armed?rgba(this.color,pulse):rgba("#ffd447",pulse);ctx.fillStyle=rgba(this.color,.2);ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,armed?22:14,0,Math.PI*2);ctx.fill();ctx.stroke();for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.fillRect(18,-2,13,4);}ctx.restore();}
  }

  /* ------------------------------ 権能の発動 ------------------------------ */
  function nearestTargets(game,count,range=1000){
    const p=game.player,items=[];
    for(const enemy of game.enemies){if(enemy.dead)continue;const d2=U.dist2(p.x,p.y,enemy.x,enemy.y);if(d2<=range*range)items.push({enemy,d2});}
    items.sort((a,b)=>a.d2-b.d2);return items.slice(0,count).map(item=>item.enemy);
  }

  function castSolar(game,rank,scale=1){const s=POWER_DEFS.solar_funeral.stats(rank),r=s.radius*areaMul(game.player),d=powerDamage(game,s.damage,scale);areaBlast(game,game.player.x,game.player.y,r,d,"#ffd447",8);game.addEffect(new LayeredPulse(game.player.x,game.player.y,r,"#ff5268",.72));game.shake(13,.34);game.sound.explosion();}
  function castWorldCutter(game,rank,scale=1){const p=game.player,s=POWER_DEFS.world_cutter.stats(rank),target=nearestEnemy(p.x,p.y,game.enemies,1400)||(game.boss&&!game.boss.dead?game.boss:null);if(!target)return;const a=U.angle(p.x,p.y,target.x,target.y),r=s.range,ex=p.x+Math.cos(a)*r,ey=p.y+Math.sin(a)*r,w=s.width*areaMul(p),d=powerDamage(game,s.damage,scale);let shown=0;for(const enemy of game.enemies){if(!enemy.dead&&segmentDistance(enemy.x,enemy.y,p.x,p.y,ex,ey)<=enemy.radius+w)leanHit(game,enemy,d,shown++<7);}if(game.boss&&!game.boss.dead&&segmentDistance(game.boss.x,game.boss.y,p.x,p.y,ex,ey)<=game.boss.radius+w)leanBossHit(game,d);game.addEffect(new PowerBeam(p.x,p.y,ex,ey,w,"#ff5268",.38));game.shake(16,.25);game.sound.laser();}
  function castStorm(game,rank,scale=1){const s=POWER_DEFS.storm_throne.stats(rank),targets=nearestTargets(game,s.targets,1100),d=powerDamage(game,s.damage,scale);targets.forEach((enemy,i)=>{game.addEffect(new LightningEffect(game.player.x,game.player.y,enemy.x,enemy.y,i%2?"#b45cff":"#65d9ff",.22,7));leanHit(game,enemy,d,i<6);});if(game.boss&&!game.boss.dead&&targets.length<s.targets){game.addEffect(new LightningEffect(game.player.x,game.player.y,game.boss.x,game.boss.y,"#ffd447",.24,9));leanBossHit(game,d);}if(targets.length)game.sound.lightning();}
  function castGravity(game,rank,scale=1){const targets=nearestTargets(game,12,1050);let x=game.player.x,y=game.player.y;if(targets.length){x=targets.reduce((s,e)=>s+e.x,0)/targets.length;y=targets.reduce((s,e)=>s+e.y,0)/targets.length;}game.addEffect(new GravityCoffinEffect(game,x,y,rank,scale));game.addEffect(new WarningEffect(x,y,{radius:POWER_DEFS.gravity_coffin.stats(rank).radius*areaMul(game.player),color:"#b45cff",life:.45}));}
  function castMeteors(game,rank,scale=1){const s=POWER_DEFS.meteor_scripture.stats(rank),targets=nearestTargets(game,s.count,1200);for(const enemy of targets)game.addEffect(new MeteorMarker(game,enemy.x,enemy.y,rank,scale));if(game.boss&&!game.boss.dead&&targets.length<s.count)game.addEffect(new MeteorMarker(game,game.boss.x,game.boss.y,rank,scale));}
  function castMirror(game,rank,scale=1){const s=POWER_DEFS.mirror_legion.stats(rank),targets=nearestTargets(game,s.count,1050),p=game.player,d=powerDamage(game,s.damage,scale);targets.forEach((enemy,i)=>{const a=(p.animT*1.4+i/s.count*Math.PI*2),x=p.x+Math.cos(a)*82,y=p.y+Math.sin(a)*82;game.addEffect(new PowerBeam(x,y,enemy.x,enemy.y,15,"#65d9ff",.22));leanHit(game,enemy,d,i<4);});}
  function castChoir(game,rank,scale=1){const p=game.player,s=POWER_DEFS.void_choir.stats(rank),rotation=Math.random()*Math.PI*2,w=s.width*areaMul(p),d=powerDamage(game,s.damage,scale),range=1250;let shown=0;for(const enemy of game.enemies){if(enemy.dead)continue;const dx=enemy.x-p.x,dy=enemy.y-p.y,dist=Math.hypot(dx,dy);if(dist>range)continue;const angle=(Math.atan2(dy,dx)-rotation+Math.PI*4)%(Math.PI*2),step=Math.PI*2/s.rays,delta=Math.min(angle%step,step-angle%step);if(Math.sin(delta)*dist<=w+enemy.radius)leanHit(game,enemy,d,shown++<7);}if(game.boss&&!game.boss.dead){const dx=game.boss.x-p.x,dy=game.boss.y-p.y,dist=Math.hypot(dx,dy),angle=(Math.atan2(dy,dx)-rotation+Math.PI*4)%(Math.PI*2),step=Math.PI*2/s.rays,delta=Math.min(angle%step,step-angle%step);if(dist<=range&&Math.sin(delta)*dist<=w+game.boss.radius)leanBossHit(game,d);}const effect=new ChoirEffect(p.x,p.y,s.rays,w,"#b45cff");effect.rotation=rotation;game.addEffect(effect);game.shake(10,.2);}
  function castWeb(game,rank,scale=1){const p=game.player,s=POWER_DEFS.prism_web.stats(rank),targets=nearestTargets(game,s.nodes,1050);if(targets.length<2)return;const points=[{x:p.x,y:p.y},...targets.map(e=>({x:e.x,y:e.y}))],w=s.width*areaMul(p),d=powerDamage(game,s.damage,scale);let shown=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];for(const enemy of game.enemies){if(!enemy.dead&&segmentDistance(enemy.x,enemy.y,a.x,a.y,b.x,b.y)<=enemy.radius+w)leanHit(game,enemy,d,shown++<6);}}game.addEffect(new WebEffect(points,w,"#65d9ff"));}
  function castBanquet(game,rank){const s=POWER_DEFS.abyss_banquet.stats(rank),r=s.radius*areaMul(game.player),d=powerDamage(game,s.damage);areaBlast(game,game.player.x,game.player.y,r,d,"#42e8bd",8);game.player.hp=Math.min(game.player.maxHp,game.player.hp+Math.round(game.player.maxHp*s.heal));game.addEffect(new LayeredPulse(game.player.x,game.player.y,r,"#42e8bd",.82));game.sound.item();}

  function castChaos(game,rank){const power=POWER_DEFS.chaos_oracle.stats(rank).power;switch(Math.floor(Math.random()*4)){case 0:castSolar(game,Math.min(3,rank+1),power);break;case 1:castWorldCutter(game,Math.min(3,rank+1),power);break;case 2:castStorm(game,Math.min(3,rank+1),power);break;default:castMeteors(game,Math.min(3,rank+1),power);break;}}

  const ECHOABLE=new Set(["solar_funeral","world_cutter","storm_throne","gravity_coffin","meteor_scripture","mirror_legion","void_choir","prism_web"]);
  function maybeEcho(game,id,rank,cast){
    cast();
    if(!ECHOABLE.has(id))return;
    const chance=game.player.powerEchoChance||0;
    if(chance<=0||Math.random()>=chance)return;
    game._delayedPowerCasts.push({delay:.62,id,rank,scale:.45});
  }

  function executeDelayed(game,item){
    switch(item.id){
      case"solar_funeral":castSolar(game,item.rank,item.scale);break;
      case"world_cutter":castWorldCutter(game,item.rank,item.scale);break;
      case"storm_throne":castStorm(game,item.rank,item.scale);break;
      case"gravity_coffin":castGravity(game,item.rank,item.scale);break;
      case"meteor_scripture":castMeteors(game,item.rank,item.scale);break;
      case"mirror_legion":castMirror(game,item.rank,item.scale);break;
      case"void_choir":castChoir(game,item.rank,item.scale);break;
      case"prism_web":castWeb(game,item.rank,item.scale);break;
    }
  }

  function timerCast(game,id,dt,baseCooldown,cast){
    const rank=rankOf(game.player,id);if(!rank)return;
    const timers=game._powerTimers;
    timers[id]=(timers[id]??.35)-dt;
    if(timers[id]>0)return;
    timers[id]+=Math.max(.18,baseCooldown*cooldownMul(game.player));
    maybeEcho(game,id,rank,cast);
  }

  function updateContinuousPowers(game,dt,moved){
    const p=game.player;
    let rank=rankOf(p,"razor_constellation");
    if(rank){
      const s=POWER_DEFS.razor_constellation.stats(rank),count=s.count,r=s.radius*areaMul(p),d=powerDamage(game,s.damage);
      p._razorAngle=(p._razorAngle||0)+dt*(2.4+rank*.35);p._razorHitTimers=p._razorHitTimers||new Map();
      for(const [uid,time] of p._razorHitTimers){const next=time-dt;if(next<=0)p._razorHitTimers.delete(uid);else p._razorHitTimers.set(uid,next);}
      for(let i=0;i<count;i++){const a=p._razorAngle+i/count*Math.PI*2,x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;for(const enemy of enemiesInRadius(game,x,y,30)){if(p._razorHitTimers.has(enemy.uid))continue;p._razorHitTimers.set(enemy.uid,s.hitCd);leanHit(game,enemy,d,i<2);}}
    }
    rank=rankOf(p,"black_sun");
    if(rank){const s=POWER_DEFS.black_sun.stats(rank);p._blackSunAngle=(p._blackSunAngle||0)+dt*(1.15+rank*.18);p._blackSunTick=(p._blackSunTick||0)-dt;if(p._blackSunTick<=0){p._blackSunTick=.2;const orbit=s.orbit*areaMul(p),x=p.x+Math.cos(p._blackSunAngle)*orbit,y=p.y+Math.sin(p._blackSunAngle)*orbit,d=powerDamage(game,s.dps*.2);let shown=0;for(const enemy of enemiesInRadius(game,x,y,s.radius*areaMul(p)))leanHit(game,enemy,d,shown++<2);}}
    rank=rankOf(p,"comet_wake");
    if(rank&&moved>0){const s=POWER_DEFS.comet_wake.stats(rank);p._cometDistance=(p._cometDistance||0)+moved;if(p._cometDistance>=s.spacing){p._cometDistance%=s.spacing;game.addEffect(new CometMine(game,p.x,p.y,rank));}}
    rank=rankOf(p,"blood_eclipse");
    if(rank){p._eclipseCd=Math.max(0,(p._eclipseCd||0)-dt);if(p._eclipseActive>0){p._eclipseActive-=dt;p.invBuffTimer=Math.max(p.invBuffTimer,.15);p._eclipsePulse=(p._eclipsePulse||0)-dt;if(p._eclipsePulse<=0){p._eclipsePulse=.5;const s=POWER_DEFS.blood_eclipse.stats(rank),r=s.radius*areaMul(p),d=powerDamage(game,s.pulse);areaBlast(game,p.x,p.y,r,d,"#ff5268",4);}}else if(p.hp/p.maxHp<=.35&&p._eclipseCd<=0){const s=POWER_DEFS.blood_eclipse.stats(rank);p._eclipseActive=s.duration*controlMul(p);p._eclipseCd=s.cooldown*cooldownMul(p);p._eclipsePulse=0;game.addEffect(new LayeredPulse(p.x,p.y,s.radius*areaMul(p),"#ff5268",.9));}}
    rank=rankOf(p,"leviathan_shell");
    const permanentShield=p.permanentShieldRecharge||0;
    if(rank||permanentShield){const cooldown=rank?POWER_DEFS.leviathan_shell.stats(rank).cooldown:permanentShield;p._shellTimer=Math.max(0,(p._shellTimer??0)-dt);if(!p._shellReady&&p._shellTimer<=0){p._shellReady=true;game.sound.item();game.addEffect(new ShockwaveEffect(p.x,p.y,"#42e8bd",100,.45,{inner:18,fill:true}));}}
  }

  function updateTimedPowers(game,dt){
    const p=game.player;
    timerCast(game,"solar_funeral",dt,POWER_DEFS.solar_funeral.stats(rankOf(p,"solar_funeral")).cooldown,()=>castSolar(game,rankOf(p,"solar_funeral")));
    timerCast(game,"world_cutter",dt,POWER_DEFS.world_cutter.stats(rankOf(p,"world_cutter")).cooldown,()=>castWorldCutter(game,rankOf(p,"world_cutter")));
    timerCast(game,"storm_throne",dt,POWER_DEFS.storm_throne.stats(rankOf(p,"storm_throne")).cooldown,()=>castStorm(game,rankOf(p,"storm_throne")));
    timerCast(game,"gravity_coffin",dt,POWER_DEFS.gravity_coffin.stats(rankOf(p,"gravity_coffin")).cooldown,()=>castGravity(game,rankOf(p,"gravity_coffin")));
    timerCast(game,"meteor_scripture",dt,POWER_DEFS.meteor_scripture.stats(rankOf(p,"meteor_scripture")).cooldown,()=>castMeteors(game,rankOf(p,"meteor_scripture")));
    timerCast(game,"mirror_legion",dt,POWER_DEFS.mirror_legion.stats(rankOf(p,"mirror_legion")).cooldown,()=>castMirror(game,rankOf(p,"mirror_legion")));
    timerCast(game,"void_choir",dt,POWER_DEFS.void_choir.stats(rankOf(p,"void_choir")).cooldown,()=>castChoir(game,rankOf(p,"void_choir")));
    timerCast(game,"prism_web",dt,POWER_DEFS.prism_web.stats(rankOf(p,"prism_web")).cooldown,()=>castWeb(game,rankOf(p,"prism_web")));
    timerCast(game,"chaos_oracle",dt,POWER_DEFS.chaos_oracle.stats(rankOf(p,"chaos_oracle")).cooldown,()=>castChaos(game,rankOf(p,"chaos_oracle")));
    const timeRank=rankOf(p,"time_execution");
    if(timeRank){const s=POWER_DEFS.time_execution.stats(timeRank);timerCast(game,"time_execution",dt,s.cooldown,()=>{game._timeStopTimer=s.duration*controlMul(p);game._timeExecutionDamage=powerDamage(game,s.damage);game._timeBurstPending=true;game.addEffect(new LayeredPulse(p.x,p.y,Math.max(game.viewW,game.viewH),"#65d9ff",s.duration));game.sound.lightning();});}
  }

  function updatePowers(game,dt,moved){
    updateTimedPowers(game,dt);updateContinuousPowers(game,dt,moved);
    for(let i=game._delayedPowerCasts.length-1;i>=0;i--){const item=game._delayedPowerCasts[i];item.delay-=dt;if(item.delay<=0){game._delayedPowerCasts.splice(i,1);executeDelayed(game,item);}}
  }

  /* ------------------------------ 新ラン強化プール ------------------------------ */
  buildUpgradePool=function(player){
    const recent=window.__recentUpgrades||[];
    return POWER_IDS.filter(id=>rankOf(player,id)<POWER_DEFS[id].max).map(id=>{
      const def=POWER_DEFS[id],current=rankOf(player,id);
      return {
        id,name:def.name,icon:def.icon,category:def.category,color:categoryInfo[def.category].color,
        desc:def.desc,trigger:def.trigger(current+1),weight:recent.includes(id)?.55:1,
        apply(p){
          p.upgradeRanks=p.upgradeRanks||{};
          p.upgradeRanks[id]=Math.min(def.max,(p.upgradeRanks[id]||0)+1);
          def.onAcquire?.(p,p.upgradeRanks[id]);
        }
      };
    });
  };

  pickUpgradeChoices=function(player,n){
    const pool=buildUpgradePool(player),picked=[];
    const categories=new Map();
    for(const item of pool){if(!categories.has(item.category))categories.set(item.category,[]);categories.get(item.category).push(item);}
    const weightedPick=list=>{let total=list.reduce((s,x)=>s+(x.weight||1),0),roll=Math.random()*total;for(const item of list){roll-=item.weight||1;if(roll<=0)return item;}return list[list.length-1];};
    const preferred=["annihilation","dominion","defense","motion","harvest","chaos"];
    while(picked.length<n&&pool.length){
      const availableCategories=preferred.filter(cat=>categories.get(cat)?.some(item=>!picked.includes(item)));
      const underrepresented=availableCategories.filter(cat=>!picked.some(item=>item.category===cat));
      const category=U.choice(underrepresented.length?underrepresented:availableCategories);
      const candidates=(categories.get(category)||[]).filter(item=>!picked.includes(item));
      const item=weightedPick(candidates.length?candidates:pool.filter(x=>!picked.includes(x)));
      if(!item)break;picked.push(item);
    }
    return picked;
  };

  getUpgradePreview=function(id,player){
    const def=POWER_DEFS[id];
    if(!def)return {now:"旧強化は廃止済み",after:"取得不可"};
    const current=rankOf(player,id),next=Math.min(def.max,current+1);
    return {now:current?`Lv.${current}｜${def.lines(current).join(" / ")}`:"未取得",after:`Lv.${next}｜${def.lines(next).join(" / ")}`};
  };

  function powerDisplayData(player,id){
    const def=POWER_DEFS[id],rank=rankOf(player,id),category=categoryInfo[def.category];
    return {name:def.name,icon:def.icon,color:category.color,level:`Lv.${rank} / ${category.label}`,desc:`${def.trigger(rank)}。${def.desc}`,stats:def.lines(rank)};
  }

  getCoreUpgradeData=function(player){
    const owned=POWER_IDS.filter(id=>rankOf(player,id)>0);
    return {name:"権能アーカイブ",icon:"▤",color:"#ffd447",level:`${owned.length} POWERS`,desc:"旧強化はすべて廃止。現在取得している新権能だけを表示しています。",stats:[`権能威力 ×${num(damageMul(player))}`,`権能範囲 ×${num(areaMul(player))}`,`権能CD ×${num(cooldownMul(player))}`,`取得権能 ${owned.length}種`]};
  };

  Game.prototype.updateWeaponBarDOM=function(){
    const bar=document.getElementById("weaponBar");if(!bar||!this.player)return;
    const scroll=bar.scrollTop;bar.innerHTML="";
    const ids=POWER_IDS.filter(id=>rankOf(this.player,id)>0);
    const entries=[getCoreUpgradeData(this.player),...ids.map(id=>powerDisplayData(this.player,id))];
    for(const data of entries){const el=document.createElement("div");el.className="ability-panel rebirth-power";el.style.setProperty("--ability-color",data.color);const stats=data.stats.slice(0,4).map((value,index)=>`<span class="ability-stat ${index<2?"strong":""}">${value}</span>`).join("");el.innerHTML=`<div class="ability-icon">${data.icon}</div><div class="ability-main"><div class="ability-head"><div class="ability-name">${data.name}</div><div class="ability-level">${data.level}</div></div><div class="ability-desc">${data.desc}</div><div class="ability-stats">${stats}</div></div>`;bar.appendChild(el);}
    bar.scrollTop=scroll;
  };

  Game.prototype.openLevelUp=function(){
    this.input.keys.clear();this.state="levelup";this._levelUpSelectionLocked=false;
    const choices=pickUpgradeChoices(this.player,3+(this.player.levelUpChoiceBonus||0));this._levelUpChoices=choices;
    const wrap=document.getElementById("upgradeChoices");wrap.innerHTML="";
    choices.forEach((choice,index)=>{const def=POWER_DEFS[choice.id],current=rankOf(this.player,choice.id),next=current+1,preview=getUpgradePreview(choice.id,this.player),category=categoryInfo[choice.category];const card=document.createElement("div");card.className="upgrade-card rebirth-card";card.style.setProperty("--card-color",category.color);card.dataset.index=String(index+1).padStart(2,"0");card.dataset.rankLabel=`Lv.${current} → Lv.${next}`;card.tabIndex=0;card.setAttribute("role","button");card.innerHTML=`<div class="power-category">${category.label}</div><div class="upgrade-icon">${choice.icon}</div><div class="upgrade-name">${choice.name}</div><div class="power-trigger">発動条件｜${choice.trigger}</div><div class="upgrade-desc">${choice.desc}${def.tradeoff?'<br><span class="rebirth-warning">代償を含む契約です。</span>':''}</div><div class="upgrade-current"><span class="now">現在｜${preview.now}</span><span class="after">取得後｜${preview.after}</span></div>`;card.addEventListener("click",()=>{if(this._levelUpSelectionLocked)return;this._levelUpSelectionLocked=true;window.__recentUpgrades=(window.__recentUpgrades||[]).concat(choice.id).slice(-7);choice.apply(this.player);this.updateWeaponBarDOM();this.showSystemToast(choice.icon,choice.name,choice.desc,`取得後：${getUpgradePreview(choice.id,this.player).now}`,category.color);this.closeLevelUp();});wrap.appendChild(card);});
    document.getElementById("levelUpScreen").classList.remove("hidden");this.sound.levelUp();
  };

  /* ------------------------------ 永続効果の適用 ------------------------------ */
  function applyPermanentBuild(game){
    const p=game.player,mr=id=>skillRank(game.records.skillTree,id);
    p.auraDamage=0;p.auraRadius=0;p.superModeThreshold=Number.POSITIVE_INFINITY;p.killStreak=0;p.superModeTimer=0;
    p.powerDamageMul=(1+mr("rebirth_output")*.12)*(1+mr("havoc_overkill")*.1);
    p.skillCooldownMul=Math.pow(.92,mr("rebirth_clock"));
    p.powerAreaMul=1+mr("dominion_area")*.13;
    p.controlDurationMul=1+mr("dominion_control")*.18;
    p.killChargeMul=Math.pow(.9,mr("havoc_overkill"));
    p.levelUpChoiceBonus+=mr("rebirth_draft");
    p.maxHp=Math.round(p.maxHp*(1+mr("rebirth_frame")*.14));p.hp=p.maxHp;
    p.expGainMul*=1+mr("harvest_growth")*.1;
    p.treasureMagnetRange=mr("harvest_magnet")?760:0;
    p.permanentShieldRecharge=mr("aegis_shell")?18:0;
    p.lowPowerBonus=mr("aegis_blood")*.18;
    p.lowSpeedBonus=mr("aegis_blood")*.12;
    p.reviveCharges+=mr("aegis_mastery");
    if(mr("aegis_mastery"))p._rebirthRevive=true;
    if(mr("redline_god")){p.powerDamageMul*=1.4;p.skillCooldownMul*=.82;p.maxHp=Math.max(1,Math.round(p.maxHp*.68));p.hp=p.maxHp;}
    if(mr("colossus_god")){p.powerAreaMul*=1.35;p.powerDamageMul*=1.18;p.speed*=.82;}
    if(mr("chaos_clock")){p.skillCooldownMul*=.7;p.powerDamageMul*=.88;}
    if(mr("precision_law")){p.powerDamageMul*=1.38;p.skillCooldownMul*=1.16;}
    if(mr("dominion_mastery"))p.powerEchoChance=.22;
    if(mr("glass_god")){p.damageAmp*=1.55;p.maxHp=Math.max(1,Math.round(p.maxHp*.55));p.hp=p.maxHp;}
    if(mr("fortress_god")){p.maxHp=Math.round(p.maxHp*1.65);p.hp=p.maxHp;p.damageReduction=Math.min(.72,p.damageReduction+.12);p.speed*=.82;}
    if(mr("swift_harvest")){p.expGainMul*=1.3;p.shardGainMul*=.82;}
    if(mr("deep_harvest")){p.expGainMul*=.9;p.shardGainMul*=1.45;}
    p._goldenRain=mr("harvest_mastery")>0;
    const startCount=mr("havoc_mastery")?2:mr("havoc_seed")?1:0;
    if(startCount){const available=POWER_IDS.filter(id=>id!=="overdrive_contract");for(let i=0;i<startCount;i++){const candidates=available.filter(id=>!rankOf(p,id));const id=U.choice(candidates);if(!id)break;p.upgradeRanks[id]=1;POWER_DEFS[id].onAcquire?.(p,1);}}
  }

  /* ------------------------------ アイテム・宝箱 ------------------------------ */
  const previousTreasureUpdate=Treasure.prototype.update;
  Treasure.prototype.update=function(dt,player){
    const range=player.treasureMagnetRange||0;
    const d=U.dist(this.x,this.y,player.x,player.y);
    if(!this.collected&&(this.attracted||(range>0&&d<range))){this.attracted=true;const angle=U.angle(this.x,this.y,player.x,player.y),speed=U.clamp(1050-d,420,1050);this.x+=Math.cos(angle)*speed*dt;this.y+=Math.sin(angle)*speed*dt;}
    const before=this.collected;previousTreasureUpdate.call(this,dt,player);
    if(!before&&this.collected&&this.game)onTreasureCollected(this.game,this);
  };

  function onTreasureCollected(game,treasure){const rank=rankOf(game.player,"treasure_singularity");if(!rank)return;const s=POWER_DEFS.treasure_singularity.stats(rank),r=s.radius*areaMul(game.player),d=powerDamage(game,s.damage);areaBlast(game,treasure.x,treasure.y,r,d,"#ffd447",9);game.player.gainExp(game.player.expToNext*s.exp);game.addEffect(new LayeredPulse(treasure.x,treasure.y,r,"#ffd447",.9));game.shake(18,.45);}

  window.addEventListener("collect-all-exp",()=>{const game=window.__game;if(!game)return;for(const treasure of game.treasures)treasure.attracted=true;});

  const previousGemUpdate=ExpGem.prototype.update;
  ExpGem.prototype.update=function(dt,player){const wasDead=this.dead;previousGemUpdate.call(this,dt,player);if(!wasDead&&this.dead){const game=window.__game,rank=rankOf(player,"abyss_banquet");if(game&&rank){player._banquetGems=(player._banquetGems||0)+1;const need=POWER_DEFS.abyss_banquet.stats(rank).gems;if(player._banquetGems>=need){player._banquetGems=0;castBanquet(game,rank);}}}};

  /* ------------------------------ 敵AI・大幅強化 ------------------------------ */
  getTimeScale=function(t){
    let hp,atk,speed,spawnCount,spawnInterval;
    if(t<60){const q=t/60;hp=U.lerp(1.05,1.35,q);atk=U.lerp(1,1.22,q);speed=U.lerp(1,1.08,q);spawnCount=1;spawnInterval=U.lerp(1.05,.88,q);}
    else if(t<180){const q=(t-60)/120;hp=U.lerp(1.35,2.05,q);atk=U.lerp(1.22,1.72,q);speed=U.lerp(1.08,1.22,q);spawnCount=U.lerp(2,3,q);spawnInterval=U.lerp(.78,.58,q);}
    else if(t<360){const q=(t-180)/180;hp=U.lerp(2.05,3.35,q);atk=U.lerp(1.72,2.45,q);speed=U.lerp(1.22,1.4,q);spawnCount=U.lerp(3,5,q);spawnInterval=U.lerp(.58,.38,q);}
    else if(t<480){const q=(t-360)/120;hp=U.lerp(3.35,4.8,q);atk=U.lerp(2.45,3.25,q);speed=U.lerp(1.4,1.55,q);spawnCount=U.lerp(5,7,q);spawnInterval=U.lerp(.38,.27,q);}
    else{const q=Math.min(1,(t-480)/120);hp=U.lerp(4.8,6.4,q);atk=U.lerp(3.25,4.25,q);speed=U.lerp(1.55,1.72,q);spawnCount=U.lerp(7,9,q);spawnInterval=U.lerp(.27,.2,q);}
    return {hp,atk,speed,spawnCount:Math.round(spawnCount),spawnInterval};
  };

  function spawnEnemyShot(game,x,y,angle,speed,damage,radius,color){if(game.enemyProjectiles.length>=CONFIG.MAX_ENEMY_PROJECTILES)return;game.enemyProjectiles.push(new EnemyProjectile(x,y,Math.cos(angle)*speed,Math.sin(angle)*speed,damage,radius,color));}
  function radialShots(game,enemy,count,speed,damage,offset=0,color=enemy.color){for(let i=0;i<count;i++)spawnEnemyShot(game,enemy.x,enemy.y,offset+i/count*Math.PI*2,speed,damage,7,color);}
  function fanShots(game,enemy,player,count,spread,speed,damage){const base=U.angle(enemy.x,enemy.y,player.x,player.y);for(let i=0;i<count;i++){const angle=base+(i-(count-1)/2)*(spread/Math.max(1,count-1));spawnEnemyShot(game,enemy.x,enemy.y,angle,speed,damage,7,enemy.color);}}

  function initEnemyAI(enemy){
    if(enemy._rebirthAI)return enemy._rebirthAI;
    const hpMul={normal:1.12,fast:1.05,heavy:1.38,ranged:1.18,splitter:1.2,splitmini:1,elite:1.5}[enemy.type]||1;
    const atkMul={normal:1.05,fast:1.1,heavy:1.18,ranged:1.12,splitter:1.08,splitmini:1,elite:1.25}[enemy.type]||1;
    enemy.maxHp=Math.round(enemy.maxHp*hpMul);enemy.hp=enemy.maxHp;enemy.atk=Math.round(enemy.atk*atkMul);
    enemy._rebirthAI={cooldown:U.rand(1.2,3),windup:0,dash:0,pattern:0,dir:{x:1,y:0}};
    return enemy._rebirthAI;
  }

  function nearbySeparation(enemy,game){let sx=0,sy=0,count=0;const grid=game._enemySpatial;if(grid&&typeof grid.forEachNearby==="function"){grid.forEachNearby(enemy.x,enemy.y,enemy.radius*3+30,other=>{if(other===enemy||other.dead)return;const dx=enemy.x-other.x,dy=enemy.y-other.y,d2=dx*dx+dy*dy,min=enemy.radius+other.radius+8;if(d2>.01&&d2<min*min){const d=Math.sqrt(d2);sx+=dx/d;sy+=dy/d;count++;}});}return count?{x:sx/count,y:sy/count}:{x:0,y:0};}

  function moveEnemy(enemy,dt,player,obstacles,game,angle,speedMul=1){const sep=nearbySeparation(enemy,game);let vx=Math.cos(angle)+sep.x*.75,vy=Math.sin(angle)+sep.y*.75,len=Math.hypot(vx,vy)||1;vx/=len;vy/=len;for(const obstacle of obstacles){const d=U.dist(enemy.x,enemy.y,obstacle.x,obstacle.y);if(d<obstacle.radius+enemy.radius+34){const a=U.angle(obstacle.x,obstacle.y,enemy.x,enemy.y);vx+=Math.cos(a)*1.2;vy+=Math.sin(a)*1.2;}}
    len=Math.hypot(vx,vy)||1;vx/=len;vy/=len;const nx=enemy.x+vx*enemy.speed*speedMul*dt,ny=enemy.y+vy*enemy.speed*speedMul*dt;if(!circleHitObstacle(nx,enemy.y,enemy.radius,obstacles))enemy.x=nx;if(!circleHitObstacle(enemy.x,ny,enemy.radius,obstacles))enemy.y=ny;enemy.x=U.clamp(enemy.x,enemy.radius,CONFIG.MAP_W-enemy.radius);enemy.y=U.clamp(enemy.y,enemy.radius,CONFIG.MAP_H-enemy.radius);enemy.facing=Math.atan2(vy,vx);}

  function contactEnemy(enemy,player,game){const d=U.dist(enemy.x,enemy.y,player.x,player.y);if(enemy.contactCd>0)enemy.contactCd-=game._rebirthDt||0;if(d<enemy.radius+player.radius&&enemy.contactCd<=0){player.takeDamage(enemy.atk,game);enemy.contactCd=.6;}return d;}

  const previousEnemyUpdate=Enemy.prototype.update;
  Enemy.prototype.update=function(dt,player,enemies,obstacles,game){
    this.animT+=dt;this.spawnAge+=dt;if(this.hitFlash>0)this.hitFlash-=dt;if(this._rebirthGuard>0)this._rebirthGuard-=dt;
    const ai=initEnemyAI(this);if(game._timeStopTimer>0)return;ai.cooldown-=dt;if(ai.windup>0){ai.windup-=dt;if(ai.windup<=0){
        if(this.type==="normal")radialShots(game,this,6,235,this.atk*.65,this.animT*.4);
        else if(this.type==="fast"){ai.dash=.48;const lead=.28,tx=player.x+(player.lastMove?.x||0)*lead,ty=player.y+(player.lastMove?.y||0)*lead,a=U.angle(this.x,this.y,tx,ty);ai.dir={x:Math.cos(a),y:Math.sin(a)};}
        else if(this.type==="heavy"){this._rebirthGuard=1.1;radialShots(game,this,10,205,this.atk*.72,this.animT*.3);}
        else if(this.type==="ranged")fanShots(game,this,player,5,.78,285,this.atk*.72);
        else if(this.type==="splitter"){for(let i=0;i<3;i++){const a=i/3*Math.PI*2+this.animT,x=player.x+Math.cos(a)*U.rand(150,260),y=player.y+Math.sin(a)*U.rand(150,260);if(game.enemyProjectiles.length<CONFIG.MAX_ENEMY_PROJECTILES)game.enemyProjectiles.push(new AbyssMine(game,x,y,this.atk*.68,this.color));}}
        else if(this.type==="elite"){const pattern=ai.pattern++%3;if(pattern===0)fanShots(game,this,player,7,1.15,310,this.atk*.72);else if(pattern===1)radialShots(game,this,16,245,this.atk*.58,this.animT*.65);else{for(let i=0;i<4;i++){const a=i/4*Math.PI*2,x=player.x+Math.cos(a)*220,y=player.y+Math.sin(a)*220;if(game.enemyProjectiles.length<CONFIG.MAX_ENEMY_PROJECTILES)game.enemyProjectiles.push(new AbyssMine(game,x,y,this.atk*.7,"#b45cff"));}}}
      }}
    if(ai.dash>0){ai.dash-=dt;const nx=this.x+ai.dir.x*this.speed*5.2*dt,ny=this.y+ai.dir.y*this.speed*5.2*dt;if(!circleHitObstacle(nx,ny,this.radius,obstacles)){this.x=nx;this.y=ny;}contactEnemy(this,player,game);return;}
    const d=U.dist(this.x,this.y,player.x,player.y),base=U.angle(this.x,this.y,player.x,player.y);let moveAngle=base,speedMul=1;
    if(this.type==="normal"){moveAngle+=Math.sin(this.animT*2+this.seed)*.22;if(ai.cooldown<=0&&d<560){ai.cooldown=U.rand(4.2,5.2);ai.windup=.68;game.addEffect(new WarningEffect(this.x,this.y,{radius:130,color:this.color,life:.68}));}}
    else if(this.type==="fast"){moveAngle+=Math.sin(this.animT*5+this.seed)*.42;speedMul=1.1;if(ai.cooldown<=0&&d<760){ai.cooldown=U.rand(3.3,4.2);ai.windup=.52;game.addEffect(new WarningEffect(this.x,this.y,{kind:"line",angle:base,length:520,width:34,color:this.color,life:.52}));}}
    else if(this.type==="heavy"){speedMul=.82;if(ai.cooldown<=0&&d<650){ai.cooldown=U.rand(5,6.3);ai.windup=.82;game.addEffect(new WarningEffect(this.x,this.y,{radius:180,color:this.color,life:.82}));}}
    else if(this.type==="ranged"){const desired=400;if(d<desired-40)moveAngle=base+Math.PI;else if(d<desired+40)moveAngle=base+Math.PI/2*(this.avoidAngleOffset>0?1:-1);speedMul=.9;if(ai.cooldown<=0&&d<850){ai.cooldown=U.rand(2.1,2.8);ai.windup=.42;game.addEffect(new WarningEffect(this.x,this.y,{kind:"line",angle:base,length:650,width:22,color:this.color,life:.42}));}}
    else if(this.type==="splitter"){moveAngle+=Math.sin(this.animT*1.6+this.seed)*.35;if(ai.cooldown<=0&&d<720){ai.cooldown=U.rand(5.3,6.4);ai.windup=.72;game.addEffect(new WarningEffect(player.x,player.y,{radius:250,color:this.color,life:.72}));}}
    else if(this.type==="splitmini"){moveAngle+=Math.sin(this.animT*7+this.seed)*.8;speedMul=1.18;}
    else if(this.type==="elite"){moveAngle+=Math.sin(this.animT*.9+this.seed)*.25;if(ai.cooldown<=0&&d<900){ai.cooldown=U.rand(3.4,4.4);ai.windup=.78;game.addEffect(new WarningEffect(this.x,this.y,{radius:230,color:"#b45cff",life:.78}));}}
    if(ai.windup<=0)moveEnemy(this,dt,player,obstacles,game,moveAngle,speedMul);contactEnemy(this,player,game);
  };

  const previousDamageEnemy=Game.prototype.damageEnemy;
  Game.prototype.damageEnemy=function(enemy,damage,crit){return previousDamageEnemy.call(this,enemy,reducedEnemyDamage(enemy,damage),crit);};

  const previousBossUpdate=Boss.prototype.update;
  Boss.prototype.update=function(dt,player,enemies,obstacles,game){
    if(!this._rebirthBoss){this._rebirthBoss=true;this.maxHp=Math.round(this.maxHp*1.55);this.hp=this.maxHp;this.atk=Math.round(this.atk*1.28);this._rebirthCd=3.5;this._rebirthWindup=0;this._rebirthPattern=0;}
    if(game._timeStopTimer>0){this.animT+=dt*.15;return;}
    previousBossUpdate.call(this,dt,player,enemies,obstacles,game);
    this._rebirthCd-=dt;
    if(this._rebirthWindup>0){this._rebirthWindup-=dt;if(this._rebirthWindup<=0){const pattern=this._rebirthPattern++%4;if(pattern===0){for(let i=0;i<22;i++)spawnEnemyShot(game,this.x,this.y,i/22*Math.PI*2+this.animT*.55,275,this.atk*.58,8,"#ff5268");}else if(pattern===1){for(let i=0;i<6;i++){const a=i/6*Math.PI*2,x=player.x+Math.cos(a)*260,y=player.y+Math.sin(a)*260;if(game.enemyProjectiles.length<CONFIG.MAX_ENEMY_PROJECTILES)game.enemyProjectiles.push(new AbyssMine(game,x,y,this.atk*.72,"#ffd447"));}}else if(pattern===2){const width=54,a=this.animT*.7,dx=player.x-this.x,dy=player.y-this.y;for(const offset of[0,Math.PI/2]){const ang=Math.atan2(dy,dx)+offset,ex=this.x+Math.cos(ang)*1400,ey=this.y+Math.sin(ang)*1400;game.addEffect(new PowerBeam(this.x,this.y,ex,ey,width,"#ff5268",.42));if(segmentDistance(player.x,player.y,this.x,this.y,ex,ey)<=player.radius+width)player.takeDamage(this.atk*1.25,game);}}else{for(let i=0;i<3&&enemies.length<CONFIG.MAX_ENEMIES;i++){const a=i/3*Math.PI*2;enemies.push(new Enemy("elite",this.x+Math.cos(a)*120,this.y+Math.sin(a)*120,game.currentScale));}radialShots(game,this,12,220,this.atk*.62,this.animT,"#b45cff");}}}
    if(this._rebirthCd<=0&&this._rebirthWindup<=0){this._rebirthCd=Math.max(3.3,6-this.index*.35);this._rebirthWindup=.9;const kind=this._rebirthPattern%4===2?"cross":"ring";game.addEffect(new WarningEffect(this.x,this.y,{kind,angle:U.angle(this.x,this.y,player.x,player.y),radius:280,length:900,width:54,color:this._rebirthPattern%2?"#ffd447":"#ff5268",life:.9}));}
  };

  const previousEnemyProjectileUpdate=EnemyProjectile.prototype.update;
  EnemyProjectile.prototype.update=function(dt){if(window.__rebirthTimeStop)return;previousEnemyProjectileUpdate.call(this,dt);};

  /* ------------------------------ 被弾防壁・復活 ------------------------------ */
  const previousTakeDamage=Player.prototype.takeDamage;
  Player.prototype.takeDamage=function(amount,game){
    if(this._shellReady&&!this.invincible){this._shellReady=false;const rank=rankOf(this,"leviathan_shell"),s=rank?POWER_DEFS.leviathan_shell.stats(rank):{cooldown:this.permanentShieldRecharge||18,radius:250,damage:1.7};this._shellTimer=s.cooldown*cooldownMul(this);const r=s.radius*areaMul(this),d=powerDamage(game,s.damage);areaBlast(game,this.x,this.y,r,d,"#42e8bd",7);game.addEffect(new LayeredPulse(this.x,this.y,r,"#42e8bd",.72));game.shake(13,.3);game.sound.explosion();return;}
    const beforeRevives=this.reviveCharges;previousTakeDamage.call(this,amount,game);if(this._rebirthRevive&&beforeRevives>this.reviveCharges&&this.hp>0){this.hp=Math.max(this.hp,Math.round(this.maxHp*.45));this.invBuffTimer=Math.max(this.invBuffTimer,3);}
  };

  const previousEffSpeed=Object.getOwnPropertyDescriptor(Player.prototype,"effSpeed");
  if(previousEffSpeed?.get){Object.defineProperty(Player.prototype,"effSpeed",{configurable:true,get(){const base=previousEffSpeed.get.call(this);return this.hp/Math.max(1,this.maxHp)<=.35?base*(1+(this.lowSpeedBonus||0)):base;}});}

  function drawPersistentPowers(player,ctx,cam){
    let rank=rankOf(player,"razor_constellation");if(rank){const s=POWER_DEFS.razor_constellation.stats(rank),r=s.radius*areaMul(player),count=s.count,a=player._razorAngle||0;for(let i=0;i<count;i++){const angle=a+i/count*Math.PI*2,x=player.x-cam.x+Math.cos(angle)*r,y=player.y-cam.y+Math.sin(angle)*r;ctx.save();ctx.translate(x,y);ctx.rotate(angle+Math.PI/2);ctx.fillStyle="#ff5268";ctx.strokeStyle="#fff7dc";ctx.lineWidth=3;polygonPath(ctx,[[0,-24],[9,-5],[5,20],[0,29],[-5,20],[-9,-5]]);ctx.fill();ctx.stroke();ctx.restore();}}
    rank=rankOf(player,"black_sun");if(rank){const s=POWER_DEFS.black_sun.stats(rank),orbit=s.orbit*areaMul(player),a=player._blackSunAngle||0,x=player.x-cam.x+Math.cos(a)*orbit,y=player.y-cam.y+Math.sin(a)*orbit,r=s.radius*.42;ctx.save();ctx.translate(x,y);const g=ctx.createRadialGradient(0,0,0,0,0,r*2.5);g.addColorStop(0,"#fff7dc");g.addColorStop(.18,"#ff8a4c");g.addColorStop(.42,"#191426");g.addColorStop(1,"rgba(180,92,255,0)");ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r*2.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#b45cff";ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,r*1.4,0,Math.PI*2);ctx.stroke();ctx.restore();}
    rank=rankOf(player,"mirror_legion");if(rank){const s=POWER_DEFS.mirror_legion.stats(rank);for(let i=0;i<s.count;i++){const a=player.animT*1.4+i/s.count*Math.PI*2,x=player.x-cam.x+Math.cos(a)*82,y=player.y-cam.y+Math.sin(a)*82;ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.globalAlpha=.72;ctx.fillStyle="#65d9ff";ctx.strokeStyle="#191426";ctx.lineWidth=3;polygonPath(ctx,[[18,0],[-9,10],[-4,0],[-9,-10]]);ctx.fill();ctx.stroke();ctx.restore();}}
    if(player._shellReady){ctx.save();ctx.translate(player.x-cam.x,player.y-cam.y);ctx.strokeStyle="rgba(66,232,189,.9)";ctx.lineWidth=5;ctx.setLineDash([12,8]);ctx.lineDashOffset=-player.animT*40;ctx.beginPath();ctx.arc(0,0,42+Math.sin(player.animT*5)*3,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();}
  }

  const previousPlayerDraw=Player.prototype.draw;
  Player.prototype.draw=function(ctx,cam){previousPlayerDraw.call(this,ctx,cam);drawPersistentPowers(this,ctx,cam);};

  /* ------------------------------ ゲームライフサイクル ------------------------------ */
  const previousStartGame=Game.prototype.startGame;
  Game.prototype.startGame=function(){
    const result=previousStartGame.call(this);
    this._powerTimers={};this._delayedPowerCasts=[];this._timeStopTimer=0;this._timeBurstPending=false;this._goldenRainKills=0;this._rebirthDt=0;
    this.player.skillCooldownMul=1;this.player.powerDamageMul=1;this.player.powerAreaMul=1;this.player.controlDurationMul=1;this.player.killChargeMul=1;this.player.powerEchoChance=0;this.player._shellReady=false;this.player._shellTimer=0;this.player._banquetGems=0;
    applyPermanentBuild(this);
    this.updateWeaponBarDOM();
    if(this._rebirthRefund>0){this.showSystemToast("◇","旧星座盤を全額返還","旧スキルを廃止したため、投資済みの深淵片を返還しました。",`返還 +${this._rebirthRefund} 深淵片`,"#ffd447");this._rebirthRefund=0;}
    return result;
  };

  const previousUpdate=Game.prototype.update;
  Game.prototype.update=function(dt){
    this._rebirthDt=dt;const player=this.player,ox=player?.x||0,oy=player?.y||0;
    window.__rebirthTimeStop=!!(this._timeStopTimer>0);
    const result=previousUpdate.call(this,dt);
    if(this._timeStopTimer>0){this._timeStopTimer=Math.max(0,this._timeStopTimer-dt);if(this._timeStopTimer===0&&this._timeBurstPending){this._timeBurstPending=false;let shown=0;for(const enemy of this.enemies)if(!enemy.dead)leanHit(this,enemy,this._timeExecutionDamage,shown++<8);if(this.boss&&!this.boss.dead)leanBossHit(this,this._timeExecutionDamage);this.addEffect(new LayeredPulse(this.player.x,this.player.y,Math.max(this.viewW,this.viewH),"#65d9ff",.7));this.shake(15,.35);}}
    window.__rebirthTimeStop=false;
    if(this.state==="playing"&&this.player){const moved=Math.hypot(this.player.x-ox,this.player.y-oy);this.player.lastMove={x:(this.player.x-ox)/Math.max(dt,.001),y:(this.player.y-oy)/Math.max(dt,.001)};updatePowers(this,dt,moved);}
    return result;
  };

  const previousEnemyOnDeath=Enemy.prototype.onDeath;
  Enemy.prototype.onDeath=function(game){
    const fresh=!this.dead&&!this._deathEffectQueued&&!this._deathEffectFinished;
    const x=this.x,y=this.y,maxHp=this.maxHp;
    const result=previousEnemyOnDeath.call(this,game);
    if(!fresh||!game?.player)return result;
    const player=game.player;
    let rank=rankOf(player,"doom_bloom");if(rank&&!game._doomBloomActive){player._doomBloomKills=(player._doomBloomKills||0)+1;const s=POWER_DEFS.doom_bloom.stats(rank),need=Math.max(1,Math.round(s.kills*killChargeMul(player)));if(player._doomBloomKills>=need){player._doomBloomKills=0;game._doomBloomActive=true;try{const targets=nearestTargets(game,s.targets,1050),d=powerDamage(game,s.damage);targets.forEach((enemy,i)=>{game.addEffect(new PowerBeam(x,y,enemy.x,enemy.y,16,"#ff5268",.25));leanHit(game,enemy,d,i<5);});}finally{game._doomBloomActive=false;}game.addEffect(new LayeredPulse(x,y,190,"#ff5268",.55));}}
    rank=rankOf(player,"hunter_verdict");if(rank&&!game._verdictActive){player._verdictKills=(player._verdictKills||0)+1;const s=POWER_DEFS.hunter_verdict.stats(rank),need=Math.max(1,Math.round(s.kills*killChargeMul(player)));if(player._verdictKills>=need){player._verdictKills=0;game._verdictActive=true;try{let target=null;for(const enemy of game.enemies)if(!enemy.dead&&(!target||enemy.hp>target.hp))target=enemy;if(target&&target.hp/target.maxHp<=s.execute){target.hp=0;target.onDeath(game);game.addEffect(new PowerBeam(player.x,player.y,target.x,target.y,38,"#ffd447",.3));}else if(target){leanHit(game,target,powerDamage(game,4.5),true);}if(game.boss&&!game.boss.dead)leanBossHit(game,Math.min(game.boss.maxHp*s.boss,powerDamage(game,9)));}finally{game._verdictActive=false;}}}
    if(player._goldenRain){player._goldenRainKills=(player._goldenRainKills||0)+1;if(player._goldenRainKills>=60){player._goldenRainKills=0;const treasure=new Treasure(x,y);treasure.game=game;treasure.bounceVel=340;game.treasures.push(treasure);game.addEffect(new LayeredPulse(x,y,120,"#ffd447",.7));}}
    return result;
  };

  const previousShowResult=Game.prototype.showResult;
  Game.prototype.showResult=function(clear){previousShowResult.call(this,clear);const powers=POWER_IDS.filter(id=>rankOf(this.player,id)>0).map(id=>`${POWER_DEFS[id].name} Lv.${rankOf(this.player,id)}`).join("　/　")||"権能未取得";const el=document.getElementById(clear?"clearWeapons":"overWeapons");if(el)el.textContent="取得権能： "+powers;};

  /* ------------------------------ 表示文言 ------------------------------ */
  const treeTitle=document.querySelector("#skillTreeScreen h2");if(treeTitle)treeTitle.textContent="終末星座盤";
  const treeKicker=document.querySelector(".skill-tree-kicker");if(treeKicker)treeKicker.textContent="CHROMA REBIRTH / PERMANENT GODFORM";
  const treeDescription=document.querySelector(".skill-tree-header p");if(treeDescription)treeDescription.innerHTML="旧スキルは全廃・投資分は自動返還。<span class=\"rebirth-tree-note\">小さな数値ではなく、ランの戦い方を変える回路だけを残した。</span>";
  const treeButton=document.getElementById("skillTreeBtn");if(treeButton)treeButton.textContent="終末星座盤";
  document.querySelectorAll("#resultSkillBtn1,#resultSkillBtn2").forEach(button=>button.textContent="終末星座盤");
  const titleNote=document.querySelector(".title-note");if(titleNote)titleNote.textContent="旧強化を破棄し、20種の豪快な権能で深淵を破壊する。敵は固有攻撃を獲得し、星座盤も権能駆動型へ再誕した。";
})();
