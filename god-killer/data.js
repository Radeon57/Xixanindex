// God Killer — game data. Every tunable number lives here so balance changes never touch the engine.
(function(root){
'use strict';

// Clone jobs level up like this: a level takes base*(1 + LEVEL_TIME_GROWTH*lv) clone-seconds.
const LEVEL_TIME_GROWTH = 0.1;
// A job row unlocks once the row above it reaches this level.
const ROW_UNLOCK_LEVEL = 10;

const TRAININGS = [
  { name:'วิดพื้น',       base:1.5 },
  { name:'ซิทอัพ',        base:6 },
  { name:'วิ่งขึ้นเขา',     base:24 },
  { name:'ว่ายทวนน้ำตก',   base:96 },
  { name:'ชกศิลา',        base:384 },
  { name:'แบกภูผา',       base:1536 },
  { name:'ยืนฝ่าอสนี',     base:6144 },
  { name:'ต้านพายุสวรรค์',  base:24576 }
].map((t,i)=>({ ...t, gain: Math.pow(6, i) }));

const SKILLS = [
  { name:'ลมปราณพื้นฐาน',  base:2 },
  { name:'หมัดคู่',        base:8 },
  { name:'เกราะวิญญาณ',    base:32 },
  { name:'ก้าวเงา',        base:128 },
  { name:'ฝ่ามือเพลิง',     base:512 },
  { name:'เนตรทิพย์',      base:2048 },
  { name:'ดาบจิต',        base:8192 },
  { name:'ผนึกเทพ',       base:32768 }
].map((t,i)=>({ ...t, gain: Math.pow(6, i) }));

// Clones fight monsters for Divinity (DP) and Battle. Clones weaker than the monster also die.
const KILL_RATE = 0.25;      // kills per clone per second when clone power equals monster power
const KILL_RATIO_CAP = 2;    // being stronger than this many times the monster no longer speeds kills up
const DEATH_RATE = 0.5;      // clone deaths per clone per second at 0 power ratio (scales down to 0 at ratio 1)
const MONSTERS = [
  'ภูตหมอก','หมาป่าเงา','โกเลมหิน','งูพิษทมิฬ','อสูรเพลิง',
  'ยักษ์ภูผา','พญานาคดำ','ปีศาจอสนี','อสูรกาลเวลา','ราชันอสูร'
].map((name,i)=>({ name, power: 1.5*Math.pow(6, i), dp: Math.pow(5, i), battle: 0.05*Math.pow(6, i) }));

// The hero creates one item at a time; higher items consume lower ones as ingredients.
// Every unit ever made gives a bonus (up to `cap` units), so using items as ingredients keeps their bonus.
// bonus.stat is a key of the multiplier table in engine.js; add:true means a flat addition instead of +per*count %.
const CREATIONS = [
  { key:'clone', name:'ร่างเงา',   time:1,   dp:0,      needs:{},                    bonus:null,                     desc:'+1 ร่างเงา' },
  { key:'light', name:'แสงสวรรค์', time:5,   dp:50,     needs:{},                    bonus:{ stat:'create', per:0.02, cap:50 },  desc:'+2% ความเร็วสร้าง' },
  { key:'stone', name:'ศิลา',     time:10,  dp:500,    needs:{ light:2 },           bonus:{ stat:'phys',   per:0.01, cap:100 }, desc:'+1% กาย' },
  { key:'soil',  name:'ปฐพี',     time:20,  dp:5000,    needs:{ stone:2 },           bonus:{ stat:'dp',     per:0.01, cap:100 }, desc:'+1% พลังเทวะที่ได้' },
  { key:'air',   name:'วายุ',     time:40,  dp:5e4,   needs:{ soil:2, light:1 },   bonus:{ stat:'speed',  per:0.01, cap:100 }, desc:'+1% ความเร็วฝึก' },
  { key:'water', name:'ธารา',     time:80,  dp:5e5,  needs:{ air:2 },             bonus:{ stat:'myst',   per:0.01, cap:100 }, desc:'+1% เวท' },
  { key:'plant', name:'พฤกษา',    time:160, dp:5e6,  needs:{ water:2, soil:2 },   bonus:{ stat:'clone',  per:0.01, cap:100 }, desc:'+1% พลังร่างเงา' },
  { key:'beast', name:'สัตว์ป่า',   time:320, dp:5e7, needs:{ plant:2 },           bonus:{ stat:'battle', per:0.01, cap:100 }, desc:'+1% ยุทธ์' },
  { key:'human', name:'มนุษย์',    time:640, dp:5e8, needs:{ beast:2, water:1 },  bonus:{ stat:'maxClones', per:1, cap:50, add:true }, desc:'+1 ร่างเงาสูงสุด' }
];

const BASE_MAX_CLONES = 10;
const HIT_INTERVAL = 0.5;      // seconds between blows in a god fight
const HP_REGEN = 0.1;          // share of max HP regained per second outside a fight

// Gods are fought by the hero. Each one killed unlocks something and makes the hero stronger.
// unlock: 'skills' | 'create' ; monsters unlock two at a time per god (see engine.monstersUnlocked).
const GODS = [
  { name:'เทพสายฟ้า',   hp:34000, atk:160, def:810, reward:{ unlock:'skills', maxClones:10, stat:1.3 } },
  { name:'เทพสงคราม',   hp:3.7e5, atk:4400, def:8800, reward:{ unlock:'create', maxClones:20, stat:1.3 } },
  { name:'เทพมรณะ',    hp:2.4e7, atk:3.3e5, def:5.8e5, reward:{ maxClones:30, stat:1.3, clone:2 } },
  { name:'เทพโชคชะตา',  hp:2.9e9, atk:4e7, def:7e7, reward:{ maxClones:40, stat:1.3, dp:2 } },
  { name:'เทพทะเล',    hp:3.1e11, atk:4.3e9, def:7.4e9, reward:{ maxClones:50, stat:1.3, speed:2 } },
  { name:'เทพอัคคี',    hp:1.3e12, atk:1.7e10, def:3e10, reward:{ maxClones:60, stat:1.5 } }
];

root.GKDATA = {
  LEVEL_TIME_GROWTH, ROW_UNLOCK_LEVEL, TRAININGS, SKILLS,
  KILL_RATE, KILL_RATIO_CAP, DEATH_RATE, MONSTERS,
  CREATIONS, BASE_MAX_CLONES, HIT_INTERVAL, HP_REGEN, GODS
};
})(typeof window !== 'undefined' ? window : globalThis);
