// God Killer — game rules. Pure logic on a plain state object: no DOM, so it also runs in the Node balance sim.
(function(root){
'use strict';
const D = root.GKDATA;
const SAVE_VERSION = 2;
const MAX_OFFLINE_SEC = 8*3600;
const JOB_KINDS = ['train','skill','mon'];

// meta survives rebirth; everything else in the state is one run
function newMeta(){
  return { gp:0, gpTotal:0, rebirths:0, bestGods:0, dpLife:0, up:{}, ach:{},
           pets:{}, team:[], mats:{}, gear:{}, dgBest:{}, run:null, dgAuto:true,
           chal:{}, ub:[], mp:0, mpTotal:0, might:{},
           tut:0, seen:{}, plan:{ on:false, train:40, skill:30, mon:30 }, autoFight:false };
}
function newState(meta){
  return {
    v: SAVE_VERSION,
    meta: meta || newMeta(),
    dp: 0,
    dpTotal: 0,
    clones: 0,
    train: D.TRAININGS.map(()=>({ lv:0, prog:0, n:0 })),
    skill: D.SKILLS.map(()=>({ lv:0, prog:0, n:0 })),
    mon: D.MONSTERS.map(()=>({ n:0, kills:0, acc:0, dacc:0 })),
    battleRaw: 0,
    own: {}, made: {},
    gen: 0,
    mono: {},
    challenge: null,
    create: { target:'clone', cur:null, prog:0, autoClone:true },
    gods: 0,
    fight: null,
    hp: 100,
    clonesLost: 0,
    playTime: 0,
    lastSave: Date.now(),
    log: []
  };
}

// ---------- unlocks ----------
const unlockedBy = (s, what) => s.gods > D.UNLOCK_AT[what];
const inChallenge = (s, key) => s.challenge === key;
const skillsUnlocked = s => unlockedBy(s, 'skills') && !inChallenge(s, 'nomagic');
const createUnlocked = s => unlockedBy(s, 'create') && !inChallenge(s, 'nocreate');
const genUnlocked = s => unlockedBy(s, 'gen');
const monumentsUnlocked = s => unlockedBy(s, 'monuments') && !inChallenge(s, 'nocreate');
// rebirth stays available in later runs once the unlocking god has ever fallen
const rebirthUnlocked = s => s.meta.bestGods > D.UNLOCK_AT.rebirth;
const petsUnlocked = s => s.meta.bestGods > D.UNLOCK_AT.pets;
const ubUnlocked = s => s.meta.bestGods >= D.GODS.length;
const mightUnlocked = s => ubUnlocked(s);
const mightLv = (s, key) => s.meta.might[key] || 0;
const planUnlocked = s => s.meta.bestGods >= D.PLAN_UNLOCK_GODS;
const autoFightUnlocked = s => s.meta.rebirths >= D.AUTOFIGHT_UNLOCK_REBIRTHS;
function rowUnlocked(s, kind, i){
  if(kind === 'mon') return i < monstersUnlocked(s);
  if(kind === 'skill' && !skillsUnlocked(s)) return false;
  return i === 0 || s[kind][i-1].lv >= D.ROW_UNLOCK_LEVEL;
}
function monstersUnlocked(s){ return Math.min(D.MONSTERS.length, 2 + 2*s.gods); }
function creationUnlocked(s, i){
  if(i === 0) return true;
  if(!createUnlocked(s)) return false;
  return i === 1 || (s.made[D.CREATIONS[i-1].key] || 0) > 0;
}

// ---------- derived numbers ----------
function mults(s){
  const m = { stat:1, phys:1, myst:1, battle:1, clone:1, dp:1, speed:1, create:1, maxClones:D.BASE_MAX_CLONES };
  for(let i=0;i<s.gods;i++){
    const r = D.GODS[i].reward;
    if(r.stat) m.stat *= r.stat;
    if(r.clone) m.clone *= r.clone;
    if(r.dp) m.dp *= r.dp;
    if(r.speed) m.speed *= r.speed;
    if(r.maxClones) m.maxClones += r.maxClones;
  }
  const apply = (defs, levelOf) => defs.forEach(x=>{
    const L = levelOf(x);
    if(!L) return;
    if(x.add) m[x.stat] += x.per*L; else m[x.stat] *= 1 + x.per*L;
  });
  // the 'mortal' challenge switches off every permanent bonus except achievements
  const mortal = inChallenge(s, 'mortal');
  const compound = (defs, levelOf) => defs.forEach(x=>{ const L = levelOf(x); if(L) m[x.stat] *= Math.pow(1 + x.per, L); });
  if(!mortal){
    // God Power upgrades compound so each rebirth clearly pushes the next run past the last one
    apply(D.UPGRADES.filter(u=>u.add), u => s.meta.up[u.key] || 0);
    compound(D.UPGRADES.filter(u=>!u.add), u => s.meta.up[u.key] || 0);
    compound(D.MIGHT.filter(x=>x.stat), x => mightLv(s, x.key));
    compound(D.CHALLENGES.filter(c=>c.stat === 'stat'), c => s.meta.chal[c.key] || 0);
  }
  m.stat *= 1 + D.ACH_BONUS * achCount(s);
  m.phys = m.myst = m.battle = m.stat;
  apply(D.MONUMENTS, mo => s.mono[mo.key] || 0);
  // gear and pet bonuses compound per level, so they stay noticeable on the game's exponential scale
  if(!mortal){
    compound(D.GEAR, g => s.meta.gear[g.key] || 0);
    compound(D.PETS, p => s.meta.pets[p.key] ? s.meta.pets[p.key].lv - 1 : 0);
    compound(D.CHALLENGES.filter(c=>c.stat !== 'stat'), c => s.meta.chal[c.key] || 0);
  }
  D.CREATIONS.forEach(c=>{
    if(!c.bonus) return;
    // bonuses count every unit ever made, so spending items as ingredients never loses their bonus
    const n = Math.min(s.made[c.key] || 0, c.bonus.cap);
    if(!n) return;
    if(c.bonus.add) m[c.bonus.stat] += n*c.bonus.per;
    else m[c.bonus.stat] *= 1 + n*c.bonus.per;
  });
  // applied last so no bonus can lift the challenge's cap
  if(inChallenge(s, 'few')) m.maxClones = Math.min(m.maxClones, D.FEW_CLONES);
  return m;
}

function rowGainTotal(rows, defs){
  let t = 0;
  for(let i=0;i<rows.length;i++) t += rows[i].lv * defs[i].gain;
  return t;
}

function derive(s){
  const m = mults(s);
  const phys = rowGainTotal(s.train, D.TRAININGS) * m.phys;
  const myst = rowGainTotal(s.skill, D.SKILLS) * m.myst;
  const battle = s.battleRaw * m.battle;
  const atk = 5 + phys + battle*0.5;
  const def = 2 + myst + battle*0.5;
  const maxHp = 100 + (phys + myst)*4 + battle*2;
  const clonePower = (atk + def) * 0.25 * m.clone;
  return { m, phys, myst, battle, atk, def, maxHp, clonePower, maxClones: Math.floor(m.maxClones) };
}

function assigned(s){
  let n = 0;
  JOB_KINDS.forEach(k=>{ const rows = s[k]; for(let i=0;i<rows.length;i++) n += rows[i].n; });
  return n;
}
const idle = s => Math.max(0, s.clones - assigned(s));
const achCount = s => Object.keys(s.meta.ach).length;
function sumLv(rows){ let t = 0; for(const r of rows) t += r.lv; return t; }
function sumKills(s){ let t = 0; for(const r of s.mon) t += r.kills; return t; }
function sumMade(s){ let t = 0; for(const k in s.made) if(k !== 'clone') t += s.made[k]; return t; }
function sumMono(s){ let t = 0; for(const k in s.mono) t += s.mono[k]; return t; }
function achValue(s, type){
  switch(type){
    case 'clones': return s.clones;
    case 'trainLv': return sumLv(s.train);
    case 'skillLv': return sumLv(s.skill);
    case 'kills': return sumKills(s);
    case 'made': return sumMade(s);
    case 'gods': return s.gods;
    case 'rebirths': return s.meta.rebirths;
    case 'dpLife': return s.meta.dpLife;
    case 'monuments': return sumMono(s);
    case 'genLv': return s.gen;
  }
  return 0;
}
function checkAchievements(s, ev){
  for(const a of D.ACHIEVEMENTS){
    if(s.meta.ach[a.key] || achValue(s, a.type) < a.n) continue;
    s.meta.ach[a.key] = 1;
    if(ev) ev.push({ type:'ach', key:a.key });
  }
}

// ---------- clone plan ----------
function topRow(s, kind){ let best = -1; for(let i=0;i<s[kind].length;i++) if(rowUnlocked(s, kind, i)) best = i; return best; }
// the monster that pays the most DP without killing clones (-1 when every open monster is too strong)
function bestSafeMonster(s, d){
  let best = -1, bestV = 0;
  for(let i=0;i<monstersUnlocked(s);i++){
    const ratio = d.clonePower / D.MONSTERS[i].power;
    if(ratio < 1) continue;
    const v = Math.min(ratio, D.KILL_RATIO_CAP) * D.MONSTERS[i].dp;
    if(v > bestV){ bestV = v; best = i; }
  }
  return best;
}
function bestRowFor(s, kind, d){ return kind === 'mon' ? bestSafeMonster(s, d || derive(s)) : topRow(s, kind); }
// put every clone already working in `kind` on its best row
function moveToBest(s, kind){
  if(!JOB_KINDS.includes(kind)) return false;
  const i = bestRowFor(s, kind);
  if(i < 0) return false;
  let n = 0;
  for(const r of s[kind]){ n += r.n; r.n = 0; }
  s[kind][i].n = n;
  return true;
}
// with the plan on, clones are split by the plan's shares onto the best row of each job; runs every second
function applyPlan(s){
  const p = s.meta.plan;
  if(!p.on || !planUnlocked(s)) return;
  const d = derive(s);
  const ti = topRow(s, 'train'), si = skillsUnlocked(s) ? topRow(s, 'skill') : -1, mi = bestSafeMonster(s, d);
  let wT = p.train, wS = si >= 0 ? p.skill : 0, wM = mi >= 0 ? p.mon : 0;
  if(ti < 0){ wT = 0; }
  const sum = wT + wS + wM;
  JOB_KINDS.forEach(k=>s[k].forEach(r=>{ r.n = 0; }));
  if(!sum) return;
  const n = s.clones;
  const nS = Math.floor(n * wS / sum), nM = Math.floor(n * wM / sum);
  if(wT){ s.train[ti].n = n - nS - nM; }
  else if(wS) { s.skill[si].n += n - nS - nM; }
  else s.mon[mi].n += n - nS - nM;
  if(nS) s.skill[si].n += nS;
  if(nM) s.mon[mi].n += nM;
}
function setPlan(s, preset){
  const p = D.PLAN_PRESETS.find(x=>x.key===preset);
  if(!p) return false;
  Object.assign(s.meta.plan, { train:p.train, skill:p.skill, mon:p.mon });
  applyPlan(s);
  return true;
}
function togglePlan(s, on){
  if(!planUnlocked(s)) return false;
  s.meta.plan.on = !!on;
  applyPlan(s);
  return true;
}

// how much stronger (atk, def and HP scaled together) the hero must get to beat target tg from full HP
function neededFactor(s, d, tg){
  const wins = f => {
    const dealt = blow(d.atk*f, tg.def), taken = blow(tg.atk, d.def*f);
    return Math.ceil(tg.hp / dealt) <= Math.ceil(d.maxHp*f / taken);
  };
  if(wins(1)) return 1;
  let lo = 1, hi = 2;
  while(!wins(hi) && hi < 1e30) hi *= 2;
  for(let k=0;k<40;k++){ const mid = Math.sqrt(lo*hi); if(wins(mid)) hi = mid; else lo = mid; }
  return hi;
}

// ---------- generator, monuments, upgrades ----------
const genRate = (s, d) => s.gen ? D.GEN_RATE * Math.pow(D.GEN_GROWTH, s.gen-1) * d.m.dp : 0;
const genCost = s => D.GEN_COST * Math.pow(D.GEN_COST_GROWTH, s.gen);
function upgradeGen(s){
  if(!genUnlocked(s)) return false;
  const c = genCost(s);
  if(s.dp < c) return false;
  s.dp -= c; s.gen++;
  return true;
}
function monumentCost(mo, L){ return { dp: mo.dp * Math.pow(10, L), items: mo.n * (L+1) }; }
function canBuild(s, mo){
  const c = monumentCost(mo, s.mono[mo.key] || 0);
  return s.dp >= c.dp && (s.own[mo.item]||0) >= c.items;
}
function buildMonument(s, key){
  const mo = D.MONUMENTS.find(x=>x.key===key);
  if(!mo || !monumentsUnlocked(s) || !canBuild(s, mo)) return false;
  const c = monumentCost(mo, s.mono[key] || 0);
  s.dp -= c.dp; s.own[mo.item] -= c.items;
  s.mono[key] = (s.mono[key] || 0) + 1;
  return true;
}
const upgradeCost = (s, u) => Math.ceil(u.cost * Math.pow(D.UPGRADE_COST_GROWTH, s.meta.up[u.key] || 0));
function buyUpgrade(s, key){
  const u = D.UPGRADES.find(x=>x.key===key);
  if(!u) return false;
  const c = upgradeCost(s, u);
  if(s.meta.gp < c) return false;
  s.meta.gp -= c;
  s.meta.up[key] = (s.meta.up[key] || 0) + 1;
  return true;
}

// ---------- pets & dungeons (kept in meta, so they survive rebirth) ----------
function petConditionMet(s, p){
  const u = p.unlock;
  if(u.type === 'gods') return s.meta.bestGods >= u.n;
  if(u.type === 'rebirths') return s.meta.rebirths >= u.n;
  if(u.type === 'ach') return achCount(s) >= u.n;
  return false;
}
function checkPets(s, ev){
  if(!petsUnlocked(s)) return;
  for(const p of D.PETS){
    if(s.meta.pets[p.key] || !petConditionMet(s, p)) continue;
    s.meta.pets[p.key] = { lv:1, exp:0 };
    if(s.meta.team.length < D.TEAM_SIZE) s.meta.team.push(p.key);
    if(ev) ev.push({ type:'pet', key:p.key });
  }
}
const petDef = key => D.PETS.find(p=>p.key===key);
const petPower = (s, key) => { const st = s.meta.pets[key]; return st ? petDef(key).base * Math.pow(D.PET_GROWTH, st.lv-1) : 0; };
function teamPower(s){ let t = 0; for(const k of s.meta.team) t += petPower(s, k); return t; }
const petExpNeed = lv => D.PET_EXP_BASE * Math.pow(D.PET_EXP_GROWTH, lv-1);
function gainExp(s, key, exp, ev){
  const st = s.meta.pets[key];
  st.exp += exp;
  while(st.lv < D.PET_MAX_LV && st.exp >= petExpNeed(st.lv)){ st.exp -= petExpNeed(st.lv); st.lv++; if(ev) ev.push({ type:'petLv', key, lv:st.lv }); }
  if(st.lv >= D.PET_MAX_LV) st.exp = 0;
}
function toggleTeam(s, key){
  const t = s.meta.team, i = t.indexOf(key);
  if(i >= 0){ t.splice(i, 1); return true; }
  if(!petDef(key) || !s.meta.pets[key] || t.length >= D.TEAM_SIZE) return false;
  t.push(key);
  return true;
}
const dungeonPower = (i, depth) => D.DUNGEONS[i].power * Math.pow(D.DEPTH_GROWTH, depth-1);
function dungeonUnlocked(s, i){
  return Number.isInteger(i) && i >= 0 && i < D.DUNGEONS.length && petsUnlocked(s) && (i === 0 || (s.meta.dgBest[D.DUNGEONS[i-1].key] || 0) >= D.DUNGEON_UNLOCK_DEPTH);
}
const maxDepth = (s, i) => Math.min(D.MAX_DEPTH, (s.meta.dgBest[D.DUNGEONS[i].key] || 0) + 1);
function winChance(s, i, depth){ const r = teamPower(s) / dungeonPower(i, depth); return r >= 1 ? 1 : r*r; }
function startDungeon(s, i, depth){
  if(!dungeonUnlocked(s, i) || !s.meta.team.length || !Number.isInteger(depth) || depth < 1 || depth > maxDepth(s, i)) return false;
  s.meta.run = { i, depth, t:0 };
  return true;
}
function stopDungeon(s){ s.meta.run = null; }
const dungeonTime = (s, i) => D.DUNGEONS[i].time * (1 - 0.2*mightLv(s, 'swift'));
function finishRun(s, ev){
  const run = s.meta.run, dg = D.DUNGEONS[run.i];
  const win = Math.random() < winChance(s, run.i, run.depth);
  const exp = dg.exp * run.depth * (win ? 1 : 0.25);
  for(const k of s.meta.team) gainExp(s, k, exp, ev);
  let qty = 0;
  if(win){
    qty = run.depth + 1;
    s.meta.mats[dg.mat] = (s.meta.mats[dg.mat] || 0) + qty;
    const best = s.meta.dgBest[dg.key] || 0;
    if(run.depth > best){
      s.meta.dgBest[dg.key] = run.depth;
      if(ev) ev.push({ type:'dgDepth', i:run.i, depth:run.depth });
      if(run.depth === D.DUNGEON_UNLOCK_DEPTH && run.i+1 < D.DUNGEONS.length && ev) ev.push({ type:'dgUnlock', i:run.i+1 });
    }
  }
  if(ev) ev.push({ type:'dgRun', win, i:run.i, depth:run.depth, qty });
  // auto-repeat goes one depth deeper whenever the team is sure to win there
  if(win && s.meta.dgAuto && run.depth < maxDepth(s, run.i) && winChance(s, run.i, run.depth + 1) >= 1) run.depth++;
}
function stepDungeon(s, dt, ev){
  const run = s.meta.run;
  if(!run) return;
  if(!s.meta.team.length){ s.meta.run = null; return; }
  run.t += dt;
  const time = dungeonTime(s, run.i);
  while(s.meta.run && run.t >= time){
    run.t -= time;
    finishRun(s, ev);
    if(!s.meta.dgAuto) s.meta.run = null;
  }
}

// ---------- gear ----------
const forgeCost = L => Math.ceil(D.FORGE_COST * Math.pow(D.FORGE_GROWTH, L));
const forgeChance = L => L === 0 ? 1 : Math.max(D.FORGE_MIN_CHANCE, 0.95 - 0.03*L);
// returns true on success, false on a failed attempt (materials are spent), null when it can't be tried
function forge(s, key){
  const g = D.GEAR.find(x=>x.key===key);
  if(!g || !petsUnlocked(s)) return null;
  const L = s.meta.gear[key] || 0, cost = forgeCost(L);
  if((s.meta.mats[g.mat] || 0) < cost) return null;
  s.meta.mats[g.mat] -= cost;
  if(Math.random() < forgeChance(L)){ s.meta.gear[key] = L + 1; return true; }
  return false;
}

// ---------- rebirth ----------
function rebirthGain(s){ let g = 0; for(let i=0;i<s.gods;i++) g += D.GODS[i].gp; return g; }
// start a new run in place: pays God Power for this run's gods; meta, the log and the auto-clone choice carry over
function resetRun(s, challenge){
  const gain = rebirthGain(s);
  const meta = s.meta, log = s.log, autoClone = s.create.autoClone;
  meta.gp += gain; meta.gpTotal += gain;
  if(gain) meta.rebirths++;
  const fresh = newState(meta);
  fresh.log = log;
  fresh.challenge = challenge || null;
  fresh.create.autoClone = autoClone;
  for(const k of Object.keys(s)) if(!(k in fresh)) delete s[k];
  Object.assign(s, fresh);
  if(challenge === 'mortal') return gain;   // 'mortal' runs start with no permanent help at all
  const L = mightLv(s, 'legacy');
  if(L) s.dp = Math.pow(10, L + 3);
  if(mightLv(s, 'fullArmy')) s.clones = derive(s).maxClones;
  return gain;
}
function rebirth(s){
  if(!rebirthUnlocked(s) || !rebirthGain(s)) return 0;
  return resetRun(s, null);
}

// ---------- challenges ----------
const chalDone = (s, key) => s.meta.chal[key] || 0;
const chalGoal = (s, key) => Math.min(D.GODS.length - 1, D.CHAL_FIRST_GOAL + chalDone(s, key));
function startChallenge(s, key){
  if(!rebirthUnlocked(s) || s.challenge || !D.CHALLENGES.some(c=>c.key===key) || chalDone(s, key) >= D.CHAL_MAX) return false;
  resetRun(s, key);
  return true;
}
function abandonChallenge(s){ s.challenge = null; }

// ---------- ultimate beings & might ----------
const ubLevel = (s, i) => s.meta.ub[i] || 0;
function ubStats(s, i){
  const last = D.GODS[D.GODS.length-1], u = D.ULTIMATES[i], k = u.mult * Math.pow(D.UB_GROWTH, ubLevel(s, i));
  return { name:u.name, hp:last.hp*k, atk:last.atk*k, def:last.def*k };
}
const ubOpen = (s, i) => Number.isInteger(i) && i >= 0 && i < D.ULTIMATES.length && ubUnlocked(s) && (i === 0 || ubLevel(s, i-1) >= D.UB_UNLOCK_LV);
const mightCost = (s, x) => x.flat ? x.cost : x.cost * (mightLv(s, x.key) + 1);
function buyMight(s, key){
  const x = D.MIGHT.find(y=>y.key===key);
  if(!x || !mightUnlocked(s) || mightLv(s, key) >= x.max) return false;
  const c = mightCost(s, x);
  if(s.meta.mp < c) return false;
  s.meta.mp -= c;
  s.meta.might[key] = mightLv(s, key) + 1;
  return true;
}

function levelTime(def, lv){ return def.base * (1 + D.LEVEL_TIME_GROWTH*lv); }
// blows traded per HIT_INTERVAL: attack squared over (attack + defence) keeps damage positive and rewards stacking attack
function blow(atk, def){
  if(!(atk > 0)) return 0;
  const r = def / atk;
  return atk / (1 + (r === r ? r : 1));   // = atk^2/(atk+def), written so huge values can't produce NaN
}

function monsterRates(s, i, d){
  const mon = D.MONSTERS[i], n = s.mon[i].n;
  const ratio = d.clonePower / mon.power;
  return {
    ratio,
    kills: n * D.KILL_RATE * Math.min(ratio, D.KILL_RATIO_CAP),
    deaths: ratio < 1 ? n * (1 - ratio) * D.DEATH_RATE : 0
  };
}

function canAfford(s, c){
  if(s.dp < c.dp) return false;
  for(const k in c.needs) if((s.own[k]||0) < c.needs[k]) return false;
  return true;
}
// n units of c (negative n refunds)
function pay(s, c, n){
  s.dp -= n*c.dp;
  for(const k in c.needs) s.own[k] = (s.own[k]||0) - n*c.needs[k];
}
const creationByKey = key => D.CREATIONS.find(c=>c.key===key);

// ---------- simulation ----------
// ev collects things worth telling the player: {type, ...}
function step(s, dt, ev){
  if(!(dt > 0)) return;
  dt = Math.min(dt, MAX_OFFLINE_SEC);
  s.playTime += dt;
  let d = derive(s);

  // clone jobs: training and skills
  ['train','skill'].forEach(kind=>{
    const defs = kind==='train' ? D.TRAININGS : D.SKILLS;
    const rows = s[kind];
    for(let i=0;i<rows.length;i++){
      const r = rows[i];
      if(!r.n) continue;
      r.prog += r.n * d.m.speed * dt;
      let need = levelTime(defs[i], r.lv), guard = 0;
      while(r.prog >= need && guard++ < 100000){
        r.prog -= need; r.lv++;
        if(r.lv === D.ROW_UNLOCK_LEVEL && i+1 < rows.length && ev) ev.push({ type:'rowUnlock', kind, i:i+1 });
        need = levelTime(defs[i], r.lv);
      }
    }
  });

  // clone jobs: monsters
  for(let i=0;i<s.mon.length;i++){
    const r = s.mon[i];
    if(!r.n) continue;
    const rt = monsterRates(s, i, d);
    r.acc += rt.kills * dt;
    if(r.acc >= 1){
      const k = Math.floor(r.acc); r.acc -= k;
      r.kills += k;
      const gain = k * D.MONSTERS[i].dp * d.m.dp;
      s.dp += gain; s.dpTotal += gain; s.meta.dpLife += gain;
      s.battleRaw += k * D.MONSTERS[i].battle;
    }
    r.dacc += rt.deaths * dt;
    if(r.dacc >= 1){
      const k = Math.min(r.n, Math.floor(r.dacc)); r.dacc -= k;
      r.n -= k; s.clones -= k; s.clonesLost += k;
      if(!r.n) r.dacc = 0;
    }
  }

  d = derive(s);
  if(s.gen){ const g = genRate(s, d) * dt; s.dp += g; s.dpTotal += g; s.meta.dpLife += g; }
  stepCreate(s, dt, d, ev);
  stepFight(s, dt, d, ev);
  if(!s.fight){
    const dd = derive(s);
    if(s.hp >= dd.maxHp*0.999){
      const god = s.gods < D.GODS.length && D.GODS[s.gods];
      if(god && s.meta.autoFight && autoFightUnlocked(s) && outlook(s, dd, god, god.hp).win) startFight(s);
      else if(mightLv(s, 'autoUb') && !(god && outlook(s, dd, god, god.hp).win)){
        for(let i=D.ULTIMATES.length-1;i>=0;i--){
          if(!ubOpen(s, i)) continue;
          const st = ubStats(s, i);
          if(outlook(s, dd, st, st.hp).win){ startUbFight(s, i); break; }
        }
      }
    }
  }
  stepDungeon(s, dt, ev);
  s.achT = (s.achT || 0) + dt;
  if(s.achT >= 1){ s.achT = 0; checkAchievements(s, ev); checkPets(s, ev); applyPlan(s); }
}

// what to make next for `key`: the item itself if affordable, otherwise the first missing ingredient (recursively);
// null when only DP is short, so the hero waits
// returns { key, want }: want caps how many are worth making in a row (the shortfall for an ingredient)
function resolveCreation(s, key, depth, want){
  const c = creationByKey(key);
  if(canAfford(s, c)) return { key, want };
  if(depth > 12) return null;
  for(const k in c.needs){ const short = c.needs[k] - (s.own[k]||0); if(short > 0) return resolveCreation(s, k, depth+1, short); }
  return null;
}
function nextCreation(s, d){
  const c = s.create, room = d.maxClones - s.clones;
  if(c.autoClone && room > 0) return { key:'clone', want:room };
  if(c.target === 'clone') return room > 0 ? { key:'clone', want:room } : null;
  return resolveCreation(s, c.target, 0, Infinity);
}
function affordableCount(s, c){
  let k = c.dp ? Math.floor(s.dp / c.dp) : Infinity;
  for(const n in c.needs) k = Math.min(k, Math.floor((s.own[n]||0) / c.needs[n]));
  return k;
}
// everything needed to make one `key` from scratch: unit counts per item, total time and DP (static, so cached)
const treeCache = {};
function recipeTree(key){
  if(treeCache[key]) return treeCache[key];
  const counts = {}; let time = 0, dp = 0;
  (function add(k, n){
    const c = creationByKey(k);
    counts[k] = (counts[k]||0) + n; time += c.time*n; dp += c.dp*n;
    for(const x in c.needs) add(x, c.needs[x]*n);
  })(key, 1);
  return treeCache[key] = { counts, time, dp };
}
function finishItems(s, item, k, d, ev){
  if(item.key === 'clone') s.clones += k;
  else s.own[item.key] = (s.own[item.key]||0) + k;
  const first = !s.made[item.key];
  s.made[item.key] = (s.made[item.key]||0) + k;
  if(first && item.key !== 'clone' && ev) ev.push({ type:'firstCreate', key:item.key });
  // only clones and max-clone bonuses change the clone cap; recomputing stats for every item is costly in catch-up
  if(item.key === 'clone' || (item.bonus && item.bonus.stat === 'maxClones')) d.maxClones = derive(s).maxClones;
}

function stepCreate(s, dt, d, ev){
  const c = s.create;
  let left = dt * d.m.create, guard = 0;
  while(left > 0 && guard++ < 1000){
    if(!c.cur){
      const next = nextCreation(s, d);
      // with time for several complete targets (fast creation, offline catch-up), make whole recipe trees at once
      if(next && next.key !== 'clone' && c.target !== 'clone'){
        const tree = recipeTree(c.target);
        const k = Math.min(Math.floor(left / tree.time), tree.dp ? Math.floor(s.dp / tree.dp) : Infinity);
        if(k >= 2){
          s.dp -= k * tree.dp; left -= k * tree.time;
          for(const x in tree.counts){
            if(x === c.target) continue;
            if(!s.made[x] && ev) ev.push({ type:'firstCreate', key:x });
            s.made[x] = (s.made[x]||0) + tree.counts[x] * k;
          }
          finishItems(s, creationByKey(c.target), k, d, ev);
          continue;
        }
      }
      const item = next && creationByKey(next.key);
      if(!item || !canAfford(s, item)) { c.prog = 0; return; }
      // whole units that fit in the remaining time are finished in one batch, so fast creation stays cheap to simulate
      const k = Math.min(Math.floor(left / item.time), affordableCount(s, item), next.want);
      if(k >= 1){ pay(s, item, k); finishItems(s, item, k, d, ev); left -= k * item.time; continue; }
      pay(s, item, 1);
      c.cur = item.key; c.prog = 0;
    }
    const item = creationByKey(c.cur);
    const need = item.time - c.prog;
    if(left < need){ c.prog += left; return; }
    left -= need;
    c.cur = null; c.prog = 0;
    finishItems(s, item, 1, d, ev);
  }
}

function stepFight(s, dt, d, ev){
  const f = s.fight;
  if(!f){
    s.hp = Math.min(d.maxHp, s.hp + d.maxHp*D.HP_REGEN*dt);
    return;
  }
  const tg = fightTarget(s, f);
  f.t += dt;
  while(f.t >= D.HIT_INTERVAL){
    f.t -= D.HIT_INTERVAL;
    f.ghp -= blow(d.atk, tg.def);
    f.hits = (f.hits||0) + 1;
    if(f.ghp <= 0){
      s.fight = null;
      if(f.kind === 'ub') winUltimate(s, f.i, ev);
      else winGod(s, ev);
      s.hp = derive(s).maxHp;
      return;
    }
    s.hp -= blow(tg.atk, d.def);
    if(s.hp <= 0){
      s.hp = 0;
      s.fight = null;
      if(ev) ev.push({ type: f.kind === 'ub' ? 'ubLose' : 'godLose', i: f.kind === 'ub' ? f.i : s.gods });
      return;
    }
  }
}
const fightTarget = (s, f) => f.kind === 'ub' ? ubStats(s, f.i) : D.GODS[s.gods];
function winGod(s, ev){
  s.gods++;
  if(s.gods > s.meta.bestGods) s.meta.bestGods = s.gods;
  if(ev) ev.push({ type:'godWin', i:s.gods-1 });
  const c = s.challenge;
  if(c && s.gods - 1 >= chalGoal(s, c)){
    s.meta.chal[c] = chalDone(s, c) + 1;
    s.challenge = null;
    if(ev) ev.push({ type:'chalDone', key:c, n:s.meta.chal[c] });
  }
}
function winUltimate(s, i, ev){
  const mp = D.ULTIMATES[i].mp;
  s.meta.ub[i] = ubLevel(s, i) + 1;
  s.meta.mp += mp; s.meta.mpTotal += mp;
  if(ev) ev.push({ type:'ubWin', i, lv:s.meta.ub[i], mp });
}
// can the hero win from the current HP? hits are traded evenly, so compare blows needed on each side
function outlook(s, d, tg, ghp){
  const dealt = blow(d.atk, tg.def), taken = blow(tg.atk, d.def);
  const hitsToKill = Math.ceil(ghp / dealt), hitsToDie = Math.ceil(s.hp / taken);
  return { win: hitsToKill <= hitsToDie, secs: hitsToKill * D.HIT_INTERVAL, share: Math.min(0.99, hitsToDie*dealt/ghp) };
}

// advance in chunks so long offline gaps stay accurate (level-ups, deaths and rewards each apply as they happen)
function advance(s, sec, ev){
  sec = Math.min(Math.max(0, sec), MAX_OFFLINE_SEC);
  const CHUNK = 1;
  while(sec > 0){ const dt = Math.min(CHUNK, sec); step(s, dt, ev); sec -= dt; }
}

// ---------- player actions ----------
function assign(s, kind, i, delta){
  if(!JOB_KINDS.includes(kind) || !Number.isInteger(i) || i < 0 || i >= s[kind].length || !rowUnlocked(s, kind, i)) return 0;
  const r = s[kind][i];
  delta = Math.trunc(delta);
  if(!delta) return 0;
  if(delta > 0) delta = Math.min(delta, idle(s));
  else delta = Math.max(delta, -r.n);
  r.n += delta;
  return delta;
}
function unassignKind(s, kind){ if(JOB_KINDS.includes(kind)) s[kind].forEach(r=>{ r.n = 0; }); }

function setCreateTarget(s, key){
  const i = D.CREATIONS.findIndex(c=>c.key===key);
  if(i < 0 || !creationUnlocked(s, i)) return false;
  const c = s.create;
  if(key === c.target) return true;   // re-selecting keeps the ingredient already in progress
  if(c.cur && c.cur !== key){ pay(s, creationByKey(c.cur), -1); c.cur = null; c.prog = 0; }
  c.target = key;
  return true;
}

function startFight(s){
  if(s.fight || s.gods >= D.GODS.length) return false;
  s.fight = { kind:'god', ghp: D.GODS[s.gods].hp, t:0, hits:0 };
  return true;
}
function startUbFight(s, i){
  if(s.fight || !ubOpen(s, i)) return false;
  s.fight = { kind:'ub', i, ghp: ubStats(s, i).hp, t:0, hits:0 };
  return true;
}
function flee(s){ s.fight = null; }

// ---------- saves ----------
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const nonNeg = (v, dflt) => isNum(v) ? Math.max(0, v) : dflt;
const capped = (v, max) => Math.min(max, nonNeg(v, 0));   // counts and levels from a save stay in a sane range
function sanitize(raw){
  const d = newState();
  if(!raw || typeof raw !== 'object' || raw.v !== SAVE_VERSION) return d;
  ['dp','dpTotal','battleRaw','clonesLost','playTime','hp'].forEach(k=>{ d[k] = nonNeg(raw[k], d[k]); });
  d.clones = Math.floor(capped(raw.clones, 1e9));
  d.gods = Math.min(D.GODS.length, Math.floor(nonNeg(raw.gods, 0)));
  d.lastSave = isNum(raw.lastSave) && raw.lastSave > 0 && raw.lastSave <= Date.now() ? raw.lastSave : Date.now();
  ['train','skill'].forEach(kind=>{
    if(!Array.isArray(raw[kind])) return;
    d[kind].forEach((r,i)=>{
      const x = raw[kind][i];
      if(!x || typeof x !== 'object') return;
      r.lv = Math.floor(capped(x.lv, 1e6)); r.prog = nonNeg(x.prog, 0); r.n = Math.floor(capped(x.n, 1e9));
    });
  });
  if(Array.isArray(raw.mon)) d.mon.forEach((r,i)=>{
    const x = raw.mon[i];
    if(!x || typeof x !== 'object') return;
    r.n = Math.floor(capped(x.n, 1e9)); r.kills = Math.floor(nonNeg(x.kills, 0));
    r.acc = Math.min(1, nonNeg(x.acc, 0)); r.dacc = Math.min(1, nonNeg(x.dacc, 0));
  });
  ['own','made'].forEach(k=>{
    if(!raw[k] || typeof raw[k] !== 'object') return;
    D.CREATIONS.forEach(c=>{ if(isNum(raw[k][c.key])) d[k][c.key] = Math.floor(capped(raw[k][c.key], 1e15)); });
  });
  if(raw.create && typeof raw.create === 'object'){
    if(creationByKey(raw.create.target)) d.create.target = raw.create.target;
    if(creationByKey(raw.create.cur)) { d.create.cur = raw.create.cur; d.create.prog = nonNeg(raw.create.prog, 0); }
    if(typeof raw.create.autoClone === 'boolean') d.create.autoClone = raw.create.autoClone;
  }
  if(Array.isArray(raw.log)) d.log = raw.log.filter(l => typeof l === 'string').slice(0, 60);
  d.gen = Math.floor(capped(raw.gen, 150));
  if(raw.mono && typeof raw.mono === 'object') D.MONUMENTS.forEach(mo=>{ if(isNum(raw.mono[mo.key])) d.mono[mo.key] = Math.floor(capped(raw.mono[mo.key], 300)); });
  const rm = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
  const m = d.meta;
  ['gp','gpTotal','rebirths','dpLife'].forEach(k=>{ m[k] = nonNeg(rm[k], 0); });
  m.rebirths = Math.floor(m.rebirths);
  // a phase-1 save has no meta: its current run is the best so far
  m.bestGods = Math.min(D.GODS.length, Math.floor(Math.max(nonNeg(rm.bestGods, 0), d.gods)));
  if(rm.up && typeof rm.up === 'object') D.UPGRADES.forEach(u=>{ if(isNum(rm.up[u.key])) m.up[u.key] = Math.floor(capped(rm.up[u.key], 300)); });
  if(rm.ach && typeof rm.ach === 'object') D.ACHIEVEMENTS.forEach(a=>{ if(rm.ach[a.key]) m.ach[a.key] = 1; });
  if(!rm.dpLife) m.dpLife = d.dpTotal;
  if(rm.pets && typeof rm.pets === 'object') D.PETS.forEach(p=>{
    const x = rm.pets[p.key];
    if(x && typeof x === 'object') m.pets[p.key] = { lv: Math.min(D.PET_MAX_LV, Math.max(1, Math.floor(nonNeg(x.lv, 1)))), exp: nonNeg(x.exp, 0) };
  });
  if(Array.isArray(rm.team)) m.team = [...new Set(rm.team.filter(k => D.PETS.some(p=>p.key===k) && Object.prototype.hasOwnProperty.call(m.pets, k)))].slice(0, D.TEAM_SIZE);
  if(rm.mats && typeof rm.mats === 'object') for(const k in D.MATERIALS) if(isNum(rm.mats[k])) m.mats[k] = Math.floor(Math.max(0, rm.mats[k]));
  if(rm.gear && typeof rm.gear === 'object') D.GEAR.forEach(g=>{ if(isNum(rm.gear[g.key])) m.gear[g.key] = Math.floor(capped(rm.gear[g.key], 200)); });
  if(rm.dgBest && typeof rm.dgBest === 'object') D.DUNGEONS.forEach(g=>{ if(isNum(rm.dgBest[g.key])) m.dgBest[g.key] = Math.min(D.MAX_DEPTH, Math.floor(Math.max(0, rm.dgBest[g.key]))); });
  if(typeof rm.dgAuto === 'boolean') m.dgAuto = rm.dgAuto;
  if(rm.chal && typeof rm.chal === 'object') D.CHALLENGES.forEach(c=>{ if(isNum(rm.chal[c.key])) m.chal[c.key] = Math.min(D.CHAL_MAX, Math.floor(Math.max(0, rm.chal[c.key]))); });
  if(Array.isArray(rm.ub)) m.ub = D.ULTIMATES.map((u,i)=>Math.floor(capped(rm.ub[i], 2000)));
  m.mp = nonNeg(rm.mp, 0); m.mpTotal = nonNeg(rm.mpTotal, 0);
  if(rm.might && typeof rm.might === 'object') D.MIGHT.forEach(x=>{ if(isNum(rm.might[x.key])) m.might[x.key] = Math.min(x.max, Math.floor(Math.max(0, rm.might[x.key]))); });
  if(D.CHALLENGES.some(c=>c.key===raw.challenge) && chalDone(d, raw.challenge) < D.CHAL_MAX && d.gods <= chalGoal(d, raw.challenge)) d.challenge = raw.challenge;
  // tutorial progress; saves from before the tutorial existed skip it once past the basics
  if(rm.plan && typeof rm.plan === 'object'){
    const p = rm.plan;
    if(typeof p.on === 'boolean') m.plan.on = p.on;
    ['train','skill','mon'].forEach(k=>{ if(isNum(p[k])) m.plan[k] = Math.min(100, Math.max(0, p[k])); });
  }
  m.autoFight = rm.autoFight === true || !!(rm.might && rm.might.autoFight);
  if(rm.might && rm.might.autoFight) m.mp += D.MIGHT_AUTOFIGHT_REFUND;   // that perk became a free toggle: give its cost back once
  m.tut = isNum(rm.tut) ? Math.floor(Math.max(0, rm.tut)) : (m.bestGods >= 2 || m.rebirths ? 999 : 0);
  if(rm.seen && typeof rm.seen === 'object') for(const k in rm.seen) if(rm.seen[k] === 1) m.seen[k] = 1;
  const r = rm.run;
  if(r && typeof r === 'object' && Number.isInteger(r.i) && r.i >= 0 && r.i < D.DUNGEONS.length && Number.isInteger(r.depth) && r.depth >= 1 && r.depth <= D.MAX_DEPTH)
    m.run = { i:r.i, depth:r.depth, t: Math.min(nonNeg(r.t, 0), D.DUNGEONS[r.i].time) };
  // never trust more assigned clones than exist
  let over = assigned(d) - d.clones;
  for(const kind of JOB_KINDS){ for(const r of d[kind]){ if(over <= 0) break; const k = Math.min(r.n, over); r.n -= k; over -= k; } }
  const dd = derive(d);
  d.clones = Math.min(d.clones, dd.maxClones);
  // a clone in progress at the cap would push clones past it; an item that isn't unlocked can't be the target
  if(d.create.cur === 'clone' && d.clones >= dd.maxClones){ d.create.cur = null; d.create.prog = 0; }
  if(!creationUnlocked(d, D.CREATIONS.findIndex(c=>c.key===d.create.target))) d.create.target = 'clone';
  if(d.create.cur && !creationUnlocked(d, D.CREATIONS.findIndex(c=>c.key===d.create.cur))){ d.create.cur = null; d.create.prog = 0; }
  if(d.create.cur) d.create.prog = Math.min(d.create.prog, creationByKey(d.create.cur).time);
  over = assigned(d) - d.clones;
  for(const kind of JOB_KINDS){ for(const r of d[kind]){ if(over <= 0) break; const k = Math.min(r.n, over); r.n -= k; over -= k; } }
  d.hp = Math.min(d.hp, dd.maxHp);
  return d;
}

root.GK = {
  SAVE_VERSION, MAX_OFFLINE_SEC, D,
  newState, sanitize, derive, mults, assigned, idle, levelTime, monsterRates, blow,
  skillsUnlocked, createUnlocked, genUnlocked, monumentsUnlocked, rebirthUnlocked,
  rowUnlocked, monstersUnlocked, creationUnlocked, canAfford, creationByKey,
  achValue, achCount, genRate, genCost, upgradeGen, monumentCost, canBuild, buildMonument,
  upgradeCost, buyUpgrade, rebirthGain, rebirth,
  petsUnlocked, petDef, petPower, teamPower, petExpNeed, toggleTeam, petConditionMet,
  dungeonPower, dungeonUnlocked, maxDepth, winChance, startDungeon, stopDungeon, forgeCost, forgeChance, forge, dungeonTime,
  chalDone, chalGoal, startChallenge, abandonChallenge, ubUnlocked, ubOpen, ubLevel, ubStats, startUbFight, fightTarget, outlook,
  mightUnlocked, mightLv, mightCost, buyMight,
  planUnlocked, autoFightUnlocked, topRow, bestSafeMonster, bestRowFor, moveToBest, applyPlan, setPlan, togglePlan, neededFactor,
  step, advance, assign, unassignKind, setCreateTarget, startFight, flee
};
})(typeof window !== 'undefined' ? window : globalThis);
