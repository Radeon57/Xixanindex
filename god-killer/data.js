// God Killer — game data. Every tunable number lives here so balance changes never touch the engine.
(function(root){
'use strict';

// Clone jobs level up like this: a level takes base*(1 + LEVEL_TIME_GROWTH*lv) clone-seconds.
const LEVEL_TIME_GROWTH = 0.1;
// A job row unlocks once the row above it reaches this level.
const ROW_UNLOCK_LEVEL = 10;

const TRAININGS = [
  { name:'ยืนม้า',       base:1.5 },
  { name:'ชกหุ่นไม้',        base:6 },
  { name:'วิ่งบันไดพันขั้น',     base:24 },
  { name:'ว่ายทวนน้ำตก',   base:96 },
  { name:'ชกศิลา',        base:384 },
  { name:'แบกภูผา',       base:1536 },
  { name:'ยืนฝ่าอัสนี',     base:6144 },
  { name:'ต้านพายุสวรรค์',  base:24576 }
].map((t,i)=>({ ...t, gain: Math.pow(6, i) }));

const SKILLS = [
  { name:'เคล็ดลมปราณเบื้องต้น',  base:2 },
  { name:'หมัดพยัคฆ์คู่',        base:8 },
  { name:'เกราะชี่คุ้มกาย',    base:32 },
  { name:'วิชาตัวเบา',        base:128 },
  { name:'ฝ่ามือเพลิงหยาง',     base:512 },
  { name:'เนตรทิพย์ส่องฟ้า',      base:2048 },
  { name:'กระบี่จิตไร้รูป',        base:8192 },
  { name:'ตราผนึกเทพ',       base:32768 }
].map((t,i)=>({ ...t, gain: Math.pow(6, i) }));

// Clones fight monsters for Divinity (DP) and Battle. Clones weaker than the monster also die.
const KILL_RATE = 0.25;      // kills per clone per second when clone power equals monster power
const KILL_RATIO_CAP = 2;    // being stronger than this many times the monster no longer speeds kills up
const DEATH_RATE = 0.5;      // clone deaths per clone per second at 0 power ratio (scales down to 0 at ratio 1)
const MONSTERS = [
  'วิญญาณหมอกพันปี','หมาป่าอสูรเงา','หุ่นศิลาเฝ้าสุสาน','อสรพิษทมิฬพันพิษ','ปีศาจเพลิงนรก',
  'ยักษ์เฝ้าขุนเขา','เทพพระเจ้ามักกร','อสูรอัสนีปีกดำ','อสูรกงล้อกาล','จักรพรรดิมาร'
].map((name,i)=>({ name, power: 1.5*Math.pow(6, i), dp: Math.pow(5, i), battle: 0.05*Math.pow(6, i) }));

// The hero creates one item at a time; higher items consume lower ones as ingredients.
// Every unit ever made gives a bonus (up to `cap` units), so using items as ingredients keeps their bonus.
// bonus.stat is a key of the multiplier table in engine.js; add:true means a flat addition instead of +per*count %.
const CREATIONS = [
  { key:'clone', name:'ร่างเงา',   time:1,   dp:0,      needs:{},                    bonus:null,                     desc:'+1 ร่างเงา' },
  { key:'light', name:'แสงสวรรค์', time:5,   dp:50,     needs:{},                    bonus:{ stat:'create', per:0.02, cap:50 },  desc:'+2% ความเร็วการสร้าง' },
  { key:'stone', name:'ศิลา',     time:10,  dp:500,    needs:{ light:2 },           bonus:{ stat:'phys',   per:0.01, cap:100 }, desc:'+1% กาย' },
  { key:'soil',  name:'ปฐพี',     time:20,  dp:5000,    needs:{ stone:2 },           bonus:{ stat:'dp',     per:0.01, cap:100 }, desc:'+1% พลังเทวะที่ได้' },
  { key:'air',   name:'วายุ',     time:40,  dp:5e4,   needs:{ soil:2, light:1 },   bonus:{ stat:'speed',  per:0.01, cap:100 }, desc:'+1% ความเร็วฝึก' },
  { key:'water', name:'ธารา',     time:80,  dp:5e5,  needs:{ air:2 },             bonus:{ stat:'myst',   per:0.01, cap:100 }, desc:'+1% เวท' },
  { key:'plant', name:'พฤกษา',    time:160, dp:5e6,  needs:{ water:2, soil:2 },   bonus:{ stat:'clone',  per:0.01, cap:100 }, desc:'+1% พลังร่างเงา' },
  { key:'beast', name:'สัตว์ป่า',   time:320, dp:5e7, needs:{ plant:2 },           bonus:{ stat:'battle', per:0.01, cap:100 }, desc:'+1% ค่ายุทธ์' },
  { key:'human', name:'มนุษย์',    time:640, dp:5e8, needs:{ beast:2, water:1 },  bonus:{ stat:'maxClones', per:1, cap:50, add:true }, desc:'+1 ร่างเงาสูงสุด' }
];

const BASE_MAX_CLONES = 10;
const HIT_INTERVAL = 0.5;      // seconds between blows in a god fight
const HP_REGEN = 0.1;          // share of max HP regained per second outside a fight
// active strike in a fight: the bigger of STRIKE_BLOWS normal blows or STRIKE_SHARE of the foe's max HP, then a cooldown
const STRIKE_CD = 12, STRIKE_SHARE = 0.04, STRIKE_BLOWS = 5;

// Gods are fought by the hero. Each one killed unlocks something and makes the hero stronger.
// unlock: 'skills' | 'create' | 'gen' | 'monuments' | 'pets' | 'rebirth'; monsters unlock two at a time per god.
// gp: God Power paid out on rebirth for every god killed in that run.
const GODS = [
  { name:'จอมเทพอัสนี',   hp:7800, atk:37, def:190,       gp:3,  reward:{ unlock:'skills', maxClones:10, stat:1.3 } },
  { name:'เทพสงครามกระบี่โลหิต',   hp:3.7e5, atk:4400, def:8800,     gp:3,  reward:{ unlock:'create', maxClones:20, stat:1.3 } },
  { name:'ราชันยมโลก',    hp:2.4e7, atk:3.3e5, def:5.8e5,   gp:6,  reward:{ unlock:'gen', maxClones:30, stat:1.3, clone:2 } },
  { name:'เทพีลิขิตฟ้า',  hp:2.7e9, atk:3.7e7, def:6.5e7,       gp:9,  reward:{ unlock:'monuments', maxClones:40, stat:1.3, dp:2 } },
  { name:'ราชามังกรทะเลบูรพา',    hp:2.5e11, atk:3.5e9, def:6.1e9,  gp:12,  reward:{ unlock:'pets', maxClones:50, stat:1.3, speed:2 } },
  { name:'เทพเพลิงจูหรง',    hp:9.5e11, atk:1.2e10, def:2.2e10,  gp:18,  reward:{ unlock:'rebirth', maxClones:60, stat:1.5 } },
  { name:'เซียนเฒ่ากาลเวลา',  hp:8.9e14, atk:1.2e13, def:2.1e13,  gp:30, reward:{ maxClones:80, stat:1.5, speed:2 } },
  { name:'เทพธิดาฉางเอ๋อ',   hp:5.8e15, atk:7.9e13, def:1.4e14,gp:45, reward:{ maxClones:100, stat:1.5, dp:3 } },
  { name:'จักรพรรดิสุริยัน',   hp:2.8e16, atk:3.8e14, def:6.7e14,  gp:75, reward:{ maxClones:120, stat:1.5, clone:3 } },
  { name:'จักรพรรดิหยก', hp:1.4e17, atk:1.9e15, def:3.3e15,gp:120, reward:{ stat:2 } }
];
// the god whose defeat unlocks each system (index into GODS)
const UNLOCK_AT = { skills:0, create:1, gen:2, monuments:3, pets:4, rebirth:5 };

// Permanent upgrades bought with God Power; survive rebirth. Level L costs cost*UPGRADE_COST_GROWTH^L GP (rounded up),
// so pouring everything into one upgrade runs into diminishing returns.
// Multipliers compound per level ((1+per)^L); maxClones adds per*L.
const UPGRADE_COST_GROWTH = 1.15;
const UPGRADES = [
  { key:'might',  name:'พลังแห่งเทพ',   stat:'stat',      per:0.25,       cost:1, desc:'ค่าสถานะทั้งหมด ×1.25' },
  { key:'legion', name:'กองทัพเงา',     stat:'maxClones', per:10, add:true, cost:1, desc:'+10 ร่างเงาสูงสุด' },
  { key:'focus',  name:'สมาธิเทพ',      stat:'speed',     per:0.25,       cost:2, desc:'ความเร็วฝึก ×1.25' },
  { key:'faith',  name:'ศรัทธาแห่งทวยเทพ', stat:'dp',     per:0.5,        cost:2, desc:'พลังเทวะที่ได้ ×1.5' },
  { key:'maker',  name:'หัตถ์สร้างโลก',   stat:'create',    per:0.25,       cost:2, desc:'ความเร็วการสร้าง ×1.25' },
  { key:'shade',  name:'เงาอมตะ',       stat:'clone',     per:0.25,       cost:2, desc:'พลังร่างเงา ×1.25' }
];

// Divinity generator: produces DP by itself. Level L makes GEN_RATE*GEN_GROWTH^(L-1) DP/s; next level costs GEN_COST*GEN_COST_GROWTH^L DP.
const GEN_RATE = 100, GEN_GROWTH = 4, GEN_COST = 1e5, GEN_COST_GROWTH = 5;

// Monuments are bought with DP plus created items. Level L costs dp*10^L DP and n*(L+1) items.
const MONUMENTS = [
  { key:'statue', name:'รูปปั้นขุนพล',   stat:'phys',      per:0.5,        dp:1e6, item:'stone', n:10, desc:'+50% กาย' },
  { key:'shrine', name:'ศาลาเต๋า',    stat:'myst',      per:0.5,        dp:3e6, item:'water', n:4,  desc:'+50% เวท' },
  { key:'temple', name:'ศาลเจ้าเทวะ',     stat:'dp',        per:0.5,        dp:1e7, item:'soil',  n:6,  desc:'+50% พลังเทวะที่ได้' },
  { key:'tower',  name:'เจดีย์เงา',     stat:'clone',     per:0.5,        dp:3e7, item:'plant', n:3,  desc:'+50% พลังร่างเงา' },
  { key:'clock',  name:'หอระฆังสวรรค์', stat:'speed',     per:0.3,        dp:1e8, item:'air',   n:5,  desc:'+30% ความเร็วฝึก' },
  { key:'city',   name:'วังสวรรค์',       stat:'maxClones', per:20, add:true, dp:1e9, item:'human', n:1,  desc:'+20 ร่างเงาสูงสุด' }
];

// ---------- phase 3: pets, dungeons, gear. All of it is kept through rebirth. ----------
// A pet joins when its condition is met (type 'gods' = best gods ever killed in one run, 'rebirths', 'ach' = achievements).
// Pet power = base * PET_GROWTH^(lv-1); every level past 1 also multiplies one hero stat by (1+per), compounding.
const PETS = [
  { key:'crane',   name:'กระเรียนหยก',   base:10, stat:'phys',   per:0.03, color:'#7fe0c0', unlock:{ type:'gods', n:5 } },
  { key:'fox',     name:'จิ้งจอกเก้าหาง',  base:12, stat:'dp',     per:0.03, color:'#ff9a6b', unlock:{ type:'gods', n:6 } },
  { key:'turtle',  name:'เต่าดำเสวียนอู่',  base:15, stat:'myst',   per:0.03, color:'#7fb0ff', unlock:{ type:'rebirths', n:1 } },
  { key:'tiger',   name:'พยัคฆ์เพลิง',     base:20, stat:'battle', per:0.03, color:'#ff6b6b', unlock:{ type:'gods', n:7 } },
  { key:'phoenix', name:'นกเพลิงจูเชว่',        base:25, stat:'speed',  per:0.03, color:'#ffb454', unlock:{ type:'ach', n:12 } },
  { key:'qilin',   name:'กิเลนสวรรค์',    base:30, stat:'clone',  per:0.03, color:'#e8c76f', unlock:{ type:'gods', n:9 } }
];
const PET_GROWTH = 1.12, PET_EXP_BASE = 50, PET_EXP_GROWTH = 1.12, PET_MAX_LV = 100, TEAM_SIZE = 3;

// A dungeon run takes `time` seconds. Depth d has power*DEPTH_GROWTH^(d-1). Team power >= that always wins;
// below it the win chance is (team/dungeon)^2. A win gives d+1 of the material and exp*d to every pet in the team,
// a loss gives a quarter of the exp. The next dungeon opens once the previous one is cleared to DUNGEON_UNLOCK_DEPTH.
const DUNGEONS = [
  { key:'cave',    name:'ถ้ำผลึกวิญญาณ',  time:120,  power:8,    mat:'ore',   exp:20 },
  { key:'forest',  name:'ป่าอสูรหมื่นลี้',  time:300,  power:120,  mat:'wood',  exp:60 },
  { key:'volcano', name:'ภูผาเพลิงนรก', time:600,  power:1000, mat:'ember', exp:180 },
  { key:'abyss',   name:'วังมังกรใต้สมุทร',  time:1200, power:8000, mat:'pearl', exp:500 }
];
const DEPTH_GROWTH = 1.6, MAX_DEPTH = 10, DUNGEON_UNLOCK_DEPTH = 5;
const MATERIALS = { ore:'แร่ผลึกวิญญาณ', wood:'ไม้หอมพันปี', ember:'แก่นเพลิงหยาง', pearl:'ไข่มุกมังกร' };

// Hero gear, crafted and then reinforced with dungeon materials. Level L -> L+1 costs FORGE_COST*FORGE_GROWTH^L
// of the gear's material; the first craft always works, later ones succeed with max(FORGE_MIN_CHANCE, 0.95 - 0.03L).
// Each level multiplies the stat by (1+per), compounding.
const GEAR = [
  { key:'weapon', name:'กระบี่สังหารเทพ', stat:'phys',  per:0.15, mat:'ore',   desc:'กาย ×1.15' },
  { key:'armor',  name:'เสื้อเกราะเทวะ',    stat:'myst',  per:0.15, mat:'wood',  desc:'เวท ×1.15' },
  { key:'ring',   name:'แหวนหยกศรัทธา',   stat:'dp',    per:0.2,  mat:'ember', desc:'พลังเทวะที่ได้ ×1.2' },
  { key:'amulet', name:'จี้หยกวิญญาณ',   stat:'clone', per:0.2,  mat:'pearl', desc:'พลังร่างเงา ×1.2' }
];
const FORGE_COST = 5, FORGE_GROWTH = 1.35, FORGE_MIN_CHANCE = 0.3;

// ---------- phase 4: challenges, ultimate beings, might ----------
// A challenge restarts the run under a rule. Killing the goal god (index CHAL_FIRST_GOAL + completions, capped at the
// last god) completes it, lifts the rule for the rest of the run and permanently multiplies a stat by (1+per).
const CHALLENGES = [
  { key:'few',      name:'กองทัพน้อย',     rule:'ร่างเงามีได้ไม่เกิน 10 ร่าง',                         stat:'clone', per:0.25, rdesc:'พลังร่างเงา ×1.25' },
  { key:'nocreate', name:'โลกไร้สรรพสิ่ง',  rule:'สร้างได้เพียงร่างเงา ไร้สรรพสิ่งและอนุสรณ์',                   stat:'dp',    per:0.3,  rdesc:'พลังเทวะที่ได้ ×1.3' },
  { key:'nomagic',  name:'ไร้มนตรา',       rule:'ฝึกวิชาเวทไม่ได้เลย',                                        stat:'myst',  per:0.3,  rdesc:'เวท ×1.3' },
  { key:'mortal',   name:'มนุษย์ธรรมดา',    rule:'ตัดผลของอัปเกรดถาวร บารมี สัตว์คู่กาย อุปกรณ์ และบททดสอบอื่น',   stat:'stat',  per:0.2,  rdesc:'ค่าสถานะทั้งหมด ×1.2' }
];
const CHAL_MAX = 6, CHAL_FIRST_GOAL = 3, FEW_CLONES = 10;

// Ultimate beings: repeatable bosses after the last god. Level L has the last god's stats * mult * UB_GROWTH^L.
// Each kill raises the level and pays mp Might points. Being i opens once being i-1 reaches UB_UNLOCK_LV.
const ULTIMATES = [
  { name:'เทพพิทักษ์ประตูสวรรค์',     mult:2,  mp:1, color:'#9fe7ff' },
  { name:'อสูรโกลาหลฮุ่นตุ้น',      mult:6,  mp:2, color:'#c77dff' },
  { name:'ปฐมเทพผานกู่',   mult:20, mp:3, color:'#ffffff' }
];
const UB_GROWTH = 1.3, UB_UNLOCK_LV = 5;

// Might perks, bought with Might points; permanent. Level L costs cost*(L+1), or just cost when flat.
const MIGHT = [
  { key:'fullArmy',  name:'จุติพร้อมทัพ',       max:1,  cost:1, desc:'จุติใหม่พร้อมร่างเงาเต็มอัตราทันที' },
  { key:'autoUb',    name:'สัญชาตญาณนักล่า',    max:1,  cost:2, desc:'ท้าสิ่งสูงสุดตนที่แกร่งที่สุดซึ่งคาดว่าชนะได้ให้เอง เมื่อพลังชีวิตเต็มและไม่มีเทพเหลือให้สู้' },
  { key:'legacy',    name:'มรดกศรัทธา',        max:10, cost:1, desc:'จุติใหม่พร้อมพลังเทวะ 10^(เลเวล+3)' },
  { key:'power',     name:'พลังยุทธ์เทพ',       max:200, cost:1, stat:'stat', per:0.2, desc:'ค่าสถานะทั้งหมด ×1.2 ต่อเลเวล (ทบต้น)' },
  { key:'swift',     name:'ทีมสำรวจว่องไว',     max:3,  cost:2, desc:'เวลาสำรวจแดนลับ -20% ต่อเลเวล' }
];

// Clone plan presets (share of clones for training / skills / monsters, in percent).
const PLAN_PRESETS = [
  { key:'balanced', name:'สมดุล',   train:40, skill:30, mon:30 },
  { key:'body',     name:'เน้นกาย',  train:60, skill:20, mon:20 },
  { key:'mind',     name:'เน้นเวท',  train:30, skill:50, mon:20 },
  { key:'hunt',     name:'เน้นล่า',   train:30, skill:20, mon:50 }
];
// the clone plan unlocks with the first god; auto-fighting gods with the first rebirth
const PLAN_UNLOCK_GODS = 1, AUTOFIGHT_UNLOCK_REBIRTHS = 1;
// MP refunded to saves that bought the old auto-fight Might perk (it is now a free toggle)
const MIGHT_AUTOFIGHT_REFUND = 1;

// Fortune (โชควาสนา): while the page is open, a spirit treasure appears every few minutes for a short time; tapping it
// pays one reward. Spawning and the timer are UI-side only (never during offline catch-up); the rewards are engine rules.
// Balance: about one treasure per ~4.7 min, each reward type worth ~40s of its resource, so a player who taps every one
// gains roughly +5-9% in one resource at a time; the idle bot never taps, so its god timings are unchanged.
//   every: [min, max] seconds of visible play between treasures; life: seconds a treasure stays before it fades
//   dpSecs: 'dp' pays this many seconds of the current Divinity income (at least dpMin)
//   boostSecs/boostMult/boostCap: 'speed' multiplies training and skill speed for boostSecs (stacks up to boostCap seconds)
//   createSecs: 'create' finishes this many seconds of creation work at once
//   each catch in a row adds streakBonus to the next reward (up to streakMax catches); a treasure left to fade breaks the streak
const FORTUNE = {
  unlockGods: 1, first: [60, 120], every: [180, 360], life: 12,
  dpSecs: 40, dpMin: 10, boostSecs: 40, boostMult: 2, boostCap: 120, createSecs: 40,
  streakBonus: 0.05, streakMax: 5,
  items: [
    { kind:'dp',     name:'ผลท้อเซียน',  color:'#ff9ab8', desc:'พลังเทวะเท่ากับรายได้หลายสิบวินาที' },
    { kind:'speed',  name:'คัมภีร์ลับ',   color:'#9fe7ff', desc:'ความเร็วฝึกกายและวิชาเวท ×2 ชั่วครู่' },
    { kind:'create', name:'เม็ดยาทิพย์', color:'#e8c76f', desc:'เร่งการสร้างให้เสร็จทันที' }
  ]
};

// Achievements are permanent and each adds ACH_BONUS to all stats.
// type: what is measured (see engine.achValue); n: the target.
const ACH_BONUS = 0.03;
const ACHIEVEMENTS = [
  { key:'cl50',   name:'กองทัพเงา',        type:'clones',   n:50 },
  { key:'cl200',  name:'ทัพเงามหึมา',       type:'clones',   n:200 },
  { key:'tr100',  name:'กายเหล็กไหล',       type:'trainLv',  n:100 },
  { key:'tr500',  name:'กายาเทพ',          type:'trainLv',  n:500 },
  { key:'sk100',  name:'ผู้ฝึกเวท',          type:'skillLv',  n:100 },
  { key:'sk500',  name:'จอมเวท',           type:'skillLv',  n:500 },
  { key:'k1e3',   name:'นักล่าอสูร',          type:'kills',    n:1e3 },
  { key:'k1e5',   name:'ผู้พิชิตอสูร',        type:'kills',    n:1e5 },
  { key:'k1e7',   name:'มหันตภัยแห่งอสูร',    type:'kills',    n:1e6 },
  { key:'m50',    name:'ผู้สร้าง',           type:'made',     n:50 },
  { key:'m1000',  name:'ผู้สร้างโลก',         type:'made',     n:1000 },
  { key:'g1',     name:'สังหารเทพองค์แรก',      type:'gods',     n:1 },
  { key:'g6',     name:'สิ้นยุคเทพเก่า',      type:'gods',     n:6 },
  { key:'g10',    name:'ผู้สังหารเทพ',        type:'gods',     n:10 },
  { key:'r1',     name:'จุติครั้งแรก',         type:'rebirths', n:1 },
  { key:'r5',     name:'วัฏจักรนิรันดร์',       type:'rebirths', n:5 },
  { key:'dp1e9',  name:'ผู้มั่งคั่งศรัทธา',      type:'dpLife',   n:1e9 },
  { key:'dp1e15', name:'ทะเลแห่งศรัทธา',      type:'dpLife',   n:1e15 },
  { key:'mo10',   name:'สถาปนิกสวรรค์',      type:'monuments',n:10 },
  { key:'gen10',  name:'ต้นธารเทวะ',      type:'genLv',    n:10 }
];

root.GKDATA = {
  LEVEL_TIME_GROWTH, ROW_UNLOCK_LEVEL, TRAININGS, SKILLS,
  KILL_RATE, KILL_RATIO_CAP, DEATH_RATE, MONSTERS,
  CREATIONS, BASE_MAX_CLONES, HIT_INTERVAL, HP_REGEN, STRIKE_CD, STRIKE_SHARE, STRIKE_BLOWS, GODS, UNLOCK_AT,
  UPGRADES, UPGRADE_COST_GROWTH, GEN_RATE, GEN_GROWTH, GEN_COST, GEN_COST_GROWTH, MONUMENTS, ACH_BONUS, ACHIEVEMENTS,
  PETS, PET_GROWTH, PET_EXP_BASE, PET_EXP_GROWTH, PET_MAX_LV, TEAM_SIZE,
  DUNGEONS, DEPTH_GROWTH, MAX_DEPTH, DUNGEON_UNLOCK_DEPTH, MATERIALS, GEAR, FORGE_COST, FORGE_GROWTH, FORGE_MIN_CHANCE,
  CHALLENGES, CHAL_MAX, CHAL_FIRST_GOAL, FEW_CLONES, ULTIMATES, UB_GROWTH, UB_UNLOCK_LV, MIGHT,
  PLAN_PRESETS, PLAN_UNLOCK_GODS, AUTOFIGHT_UNLOCK_REBIRTHS, MIGHT_AUTOFIGHT_REFUND, FORTUNE
};
})(typeof window !== 'undefined' ? window : globalThis);
