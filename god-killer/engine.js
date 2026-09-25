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
           tut:0, seen:{}, plan:{ on:false, train:40, skill:30, mon:30 }, autoFight:false, createPref:null,
           fortune:{ streak:0, best:0, caught:0 },
           splits:D.GODS.map(()=>0), lastSplits:[], lastGain:0, bestRealm:0,
           mchain:0 };
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
    splits: [],
    strikeAt: 0,
    boostT: 0,          // seconds of play left on a fortune training boost
    realm: { r:0, st:1, trib:null, cdAt:0, peak:0 },   // realm, minor stage, tribulation clock (null = none), retry time, peak noted
    lastSave: Date.now(),
    missions: [], mseq: 0, buff: 0,
    achT: 0,            // play seconds since the last once-a-second check (achievements, pets, plan, missions)
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
  m.stat *= Math.pow(D.REALM_STAT, s.realm.r);
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
  if(s.boostT > 0) m.speed *= D.FORTUNE.boostMult;   // fortune boost: a short burst, so it counts even in 'mortal'
  if(s.buff > 0) m.speed *= D.MISSION_BUFF;   // sect-mission reward
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
    case 'realm': return s.meta.bestRealm;
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

// buy the same thing until it can't be afforded; returns how many were bought
function buyRepeat(f){ let n = 0; while(n < 10000 && f()) n++; return n; }
const upgradeGenMax = s => buyRepeat(()=>upgradeGen(s));
const buildMonumentMax = (s, key) => buyRepeat(()=>buildMonument(s, key));
const buyUpgradeMax = (s, key) => buyRepeat(()=>buyUpgrade(s, key));

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
  requeueChain(s);
  const meta = s.meta, log = s.log, autoClone = s.create.autoClone;
  rememberRun(s, gain);
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

// ---------- split times ----------
// seconds into the run (s.playTime: reset by newState, advanced only in step, so offline catch-up counts too) at which each god fell.
// s.splits = this run (0 = time unknown, e.g. an older save); meta.splits = best per god index (0 = never);
// meta.lastSplits / lastGain = the previous paid rebirth, so the UI can show the run-over-run speed-up.
function recordSplit(s, i){
  const t = s.playTime, m = s.meta, prev = m.splits[i] || 0;
  while(s.splits.length < i) s.splits.push(0);
  s.splits[i] = t;
  if(!prev || t < prev) m.splits[i] = t;
  return { t, prev };
}
function rememberRun(s, gain){
  if(!gain) return;
  s.meta.lastSplits = s.splits.slice(0, D.GODS.length);
  s.meta.lastGain = gain;
}
function sanitizeSplits(raw, rm, d){
  const m = d.meta, list = (v, n, max) => Array.isArray(v) ? v.slice(0, n).map(x => Math.min(max, nonNeg(x, 0))) : [];
  d.splits = list(raw.splits, d.gods, d.playTime);
  const best = list(rm.splits, D.GODS.length, 1e200);
  m.splits = D.GODS.map((g, i) => best[i] || 0);
  d.splits.forEach((t, i) => { if(t && (!m.splits[i] || t < m.splits[i])) m.splits[i] = t; });
  m.lastSplits = list(rm.lastSplits, D.GODS.length, 1e200);
  m.lastGain = Math.min(1e200, nonNeg(rm.lastGain, 0));
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

// ---------- cultivation realms (per run; meta.bestRealm is kept) ----------
// qi is every training and skill level of this run; minor stages pass by themselves, a realm needs a tribulation
function realmQi(s){ return sumLv(s.train) + sumLv(s.skill); }
const realmStart = r => r > 0 ? D.REALMS[r-1].qi : 0;
function realmStage(s, qi){
  const r = s.realm.r, lo = realmStart(r), span = D.REALMS[r].qi - lo;
  if(qi === undefined) qi = realmQi(s);
  return Math.max(1, Math.min(D.REALM_STAGES, 1 + Math.floor(D.REALM_STAGES * (qi - lo) / span)));
}
// share of the current minor stage done (1 once the realm's end is reached)
function stageFrac(s, qi){
  const r = s.realm.r, lo = realmStart(r), per = (D.REALMS[r].qi - lo) / D.REALM_STAGES;
  if(qi === undefined) qi = realmQi(s);
  return Math.max(0, Math.min(1, (qi - lo - (realmStage(s, qi) - 1) * per) / per));
}
const lastRealm = s => s.realm.r >= D.REALMS.length - 1;
const atRealmPeak = s => !lastRealm(s) && realmQi(s) >= D.REALMS[s.realm.r].qi;
const tribWait = s => Math.max(0, s.realm.cdAt - s.playTime);
const canTribulate = s => atRealmPeak(s) && s.realm.trib === null && tribWait(s) <= 0;
// the tribulation's verdict is a pure function of the hero's stats: total bolt damage against max HP
function tribOutlook(s, d){
  d = d || derive(s);
  const r = s.realm.r, atk = lastRealm(s) ? 0 : D.REALMS[r].trib;
  const bolt = blow(atk, d.def), dmg = bolt * D.TRIB_BOLTS;
  return { bolt, dmg, hp: d.maxHp, ok: dmg < d.maxHp };
}
function startTribulation(s){
  if(!canTribulate(s)) return false;
  s.realm.trib = 0;
  return true;
}
function stepRealm(s, dt, ev){
  const R = s.realm;
  if(R.trib !== null){
    R.trib += dt;
    if(R.trib >= D.TRIB_TIME){
      R.trib = null;
      if(tribOutlook(s).ok){
        R.r++;
        if(R.r > s.meta.bestRealm) s.meta.bestRealm = R.r;
        R.st = realmStage(s);
        s.hp = derive(s).maxHp;   // the breakthrough renews the body
        if(ev) ev.push({ type:'realmUp', r:R.r });
      } else {
        R.cdAt = s.playTime + D.TRIB_COOLDOWN;
        if(ev) ev.push({ type:'tribFail', r:R.r });
      }
    }
  }
  const st = realmStage(s);
  if(st > R.st){ R.st = st; if(ev) ev.push({ type:'realmStage', r:R.r, st }); }
  // reaching the realm's peak is worth one note (the stage number stays 9)
  const peak = atRealmPeak(s) ? 1 : 0;
  if(peak !== R.peak){ R.peak = peak; if(peak && ev) ev.push({ type:'realmPeak', r:R.r }); }
}
function sanitizeRealm(raw, d){
  const x = raw.realm && typeof raw.realm === 'object' ? raw.realm : {};
  const R = d.realm, qi = realmQi(d);
  R.r = Math.min(D.REALMS.length - 1, Math.floor(nonNeg(x.r, 0)));
  while(R.r > 0 && qi < realmStart(R.r)) R.r--;   // never above what this run's qi allows
  R.st = realmStage(d, qi);
  R.trib = isNum(x.trib) && !lastRealm(d) && qi >= D.REALMS[R.r].qi ? Math.min(Math.max(0, x.trib), D.TRIB_TIME) : null;
  R.cdAt = Math.min(nonNeg(x.cdAt, 0), d.playTime + D.TRIB_COOLDOWN);
  R.peak = atRealmPeak(d) ? 1 : 0;   // a loaded save already at a peak shows its button without a fresh note
  const rm = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
  d.meta.bestRealm = Math.max(R.r, Math.min(D.REALMS.length - 1, Math.floor(nonNeg(rm.bestRealm, 0))));
}

// ---------- sect missions (ภารกิจสำนัก) ----------
// D.MISSION_SLOTS missions stay open. Each free slot takes the next hand-written chain mission (meta.mchain, so the
// guide never repeats after rebirth) once it can be done, otherwise a mission generated from the current progress.
// Missions are checked with achievements (every second, also offline) and pay out by themselves.
const MISSION_TYPES = ['job','lv','kills','gods','made','clones','gen','mono','dp'];
const MISSION_DELTA = { kills:1, made:1, dp:1 };   // counted from the moment the mission opened
function missionValue(s, m){
  switch(m.t){
    case 'job': return s[m.kind].some((r, i) => i >= m.i && r.n > 0) ? 1 : 0;   // that row or a higher one
    case 'lv': return s[m.kind][m.i].lv;
    case 'kills': { let t = 0; for(let i=m.i || 0;i<s.mon.length;i++) t += s.mon[i].kills; return t; }   // monster i or stronger
    case 'gods': return s.gods;
    case 'made': return s.made[m.key] || 0;
    case 'clones': return s.clones;
    case 'gen': return s.gen;
    case 'mono': return sumMono(s);
    case 'dp': return s.dpTotal;
  }
  return 0;
}
function missionProgress(s, m){
  const n = m.t === 'job' ? 1 : m.n;
  return { v: Math.min(n, Math.max(0, missionValue(s, m) - (m.base || 0))), n };
}
// steady พลังเทวะ per second right now: the generator plus monsters fought without losses (unlike dpRate, clones
// that are dying don't count, so a reward can't swing on which second a clone falls)
function dpIncome(s, d){
  let inc = genRate(s, d);
  for(let i=0;i<s.mon.length;i++){
    if(!s.mon[i].n) continue;
    const rt = monsterRates(s, i, d);
    if(rt.ratio >= 1) inc += rt.kills * D.MONSTERS[i].dp * d.m.dp;
  }
  return inc;
}
function missionReward(s, m, d){
  if(m.r === 'buff') return { buff: D.MISSION_BUFF_SECS };
  d = d || derive(s);
  const mi = Math.max(0, bestSafeMonster(s, d));
  return { dp: Math.max(dpIncome(s, d) * D.MISSION_DP_SECS, D.MISSION_DP_FLOOR_KILLS * D.MONSTERS[mi].dp * d.m.dp) };
}
function makeMission(s, spec, c){
  const m = { id: ++s.mseq, t: spec.t, n: spec.t === 'job' ? 1 : spec.n, base: 0, r: spec.r === 'buff' ? 'buff' : 'dp' };
  if(spec.kind !== undefined) m.kind = spec.kind;
  if(spec.i !== undefined) m.i = spec.i;
  if(spec.key !== undefined) m.key = spec.key;
  if(c !== undefined) m.c = c;
  if(MISSION_DELTA[m.t]) m.base = missionValue(s, m);
  return m;
}
const sameMission = (a, b) => a.t === b.t && a.kind === b.kind && a.i === b.i && a.key === b.key;
// 2 significant digits, so targets read like 150 or 2.4K
function niceNum(x){
  if(!(x > 10)) return Math.max(1, Math.round(x || 0));
  const p = Math.pow(10, Math.floor(Math.log10(x)) - 1);
  return Math.round(x / p) * p;
}
function chainReady(s, c){
  if((c.req || 0) > s.gods) return false;
  const ci = c.key ? D.CREATIONS.findIndex(x=>x.key===c.key) : -1;
  switch(c.t){
    case 'job': return rowUnlocked(s, c.kind, c.i);
    case 'lv': return rowUnlocked(s, c.kind, c.i) || (c.i > 0 && rowUnlocked(s, c.kind, c.i-1));
    case 'kills': return c.i === undefined || c.i < monstersUnlocked(s);
    case 'made': return creationUnlocked(s, ci) || (ci > 1 && creationUnlocked(s, ci-1));
    case 'gen': return genUnlocked(s);
    case 'mono': return monumentsUnlocked(s);
  }
  return true;
}
function nextChainMission(s){
  const k = s.meta.mchain, c = D.MISSION_CHAIN[k];
  if(!c || !chainReady(s, c) || s.missions.some(m=>sameMission(m, c))) return null;
  s.meta.mchain++;
  return makeMission(s, c, k);
}
// templates, tried in turn from a rotating start so consecutive missions differ
const MISSION_GEN = [
  (s, d) => genLevel(s, d, 'train'),
  (s, d) => {
    const i = bestSafeMonster(s, d);
    if(i < 0) return null;
    const per = D.KILL_RATE * Math.min(d.clonePower / D.MONSTERS[i].power, D.KILL_RATIO_CAP);
    const n = Math.max(s.mon[i].n, Math.floor(s.clones*0.3), 1);
    return { t:'kills', i, n: niceNum(Math.max(10, per * n * D.MISSION_TARGET_SECS)), r:'dp' };
  },
  (s, d) => genLevel(s, d, 'skill'),
  (s, d) => {
    if(!createUnlocked(s)) return null;
    const inc = dpIncome(s, d), keys = [];
    if(s.create.target !== 'clone') keys.push(s.create.target);
    for(let i=D.CREATIONS.length-1;i>=1;i--) if(creationUnlocked(s, i)) keys.push(D.CREATIONS[i].key);
    for(const key of keys){
      const tree = recipeTree(key);
      let n = Math.floor(D.MISSION_TARGET_SECS * d.m.create / tree.time);
      if(tree.dp) n = Math.min(n, Math.floor((s.dp + inc * D.MISSION_TARGET_SECS) / tree.dp));
      n = Math.min(n, 50);
      if(n >= 1) return { t:'made', key, n: n > 10 ? niceNum(n) : n, r:'dp' };
    }
    return null;
  },
  (s, d) => { const inc = dpIncome(s, d); return inc > 0 ? { t:'dp', n: niceNum(inc * D.MISSION_TARGET_SECS), r:'dp' } : null; },
  (s, d) => s.gods < D.GODS.length && neededFactor(s, d, D.GODS[s.gods]) <= 2 ? { t:'gods', n: s.gods + 1, r:'dp' } : null
];
// the top open row of `kind`: up to Lv.10 (opens the next row) or about MISSION_TARGET_SECS of training
function genLevel(s, d, kind){
  if(kind === 'skill' && !skillsUnlocked(s)) return null;
  const i = topRow(s, kind);
  if(i < 0) return null;
  const r = s[kind][i], def = (kind === 'train' ? D.TRAININGS : D.SKILLS)[i];
  const budget = Math.max(r.n, Math.floor(s.clones*0.4), 1) * d.m.speed * D.MISSION_TARGET_SECS + r.prog;
  let L = r.lv, used = 0;
  while(L < r.lv + 500){ used += levelTime(def, L); if(used > budget) break; L++; }
  let n = Math.max(r.lv + 2, L);
  if(r.lv < D.ROW_UNLOCK_LEVEL && i + 1 < s[kind].length) n = Math.min(n, D.ROW_UNLOCK_LEVEL);
  return { t:'lv', kind, i, n: n > 20 ? Math.max(r.lv + 2, niceNum(n)) : n, r:'buff' };
}
function genMission(s){
  const d = derive(s), T = MISSION_GEN.length;
  for(let k=0;k<T;k++){
    const spec = MISSION_GEN[(s.mseq + k) % T](s, d);
    if(spec && !s.missions.some(m=>sameMission(m, spec))) return makeMission(s, spec);
  }
  return null;
}
function nextMission(s){ return nextChainMission(s) || genMission(s); }
function checkMissions(s, ev){
  const ms = s.missions;
  let d = null;
  for(let j=0;j<ms.length;j++){
    const m = ms[j], p = missionProgress(s, m);
    if(p.v < p.n) continue;
    const rw = missionReward(s, m, d || (d = derive(s)));
    if(rw.dp){
      s.dp += rw.dp; s.dpTotal += rw.dp; s.meta.dpLife += rw.dp; d = null;
      for(const o of ms) if(o.t === 'dp') o.base += rw.dp;   // rewards don't count as earned
    }
    if(rw.buff){ s.buff = Math.min(D.MISSION_BUFF_MAX, s.buff + rw.buff); d = null; }
    if(ev) ev.push({ type:'mission', m, reward:rw });
    const next = nextMission(s);
    if(next) ms[j] = next; else { ms.splice(j, 1); j--; }
  }
  while(ms.length < D.MISSION_SLOTS){ const m = nextMission(s); if(!m) break; ms.push(m); }
}
// chain missions still open when a run ends come back in the next run
function requeueChain(s){
  for(const m of s.missions) if(m.c !== undefined) s.meta.mchain = Math.min(s.meta.mchain, m.c);
}
function sanitizeMissions(d, raw, rm){
  const CH = D.MISSION_CHAIN.length, kinds = ['train','skill','mon'];
  d.meta.mchain = isNum(rm.mchain) ? Math.min(CH, Math.floor(Math.max(0, rm.mchain))) : (d.meta.bestGods >= 2 || d.meta.rebirths ? CH : 0);
  d.buff = Math.min(D.MISSION_BUFF_MAX, nonNeg(raw.buff, 0));
  d.mseq = Math.floor(capped(raw.mseq, 1e12));
  if(!Array.isArray(raw.missions)) return;
  const ok = x => {
    if(!x || typeof x !== 'object' || !MISSION_TYPES.includes(x.t)) return null;
    const m = { id: Math.floor(capped(x.id, 1e12)), t:x.t, n: Math.max(1, Math.floor(capped(x.n, 1e300))), base: Math.min(1e300, nonNeg(x.base, 0)), r: x.r === 'buff' ? 'buff' : 'dp' };
    if(m.t === 'job' || m.t === 'lv'){
      if(!(m.t === 'job' ? kinds : kinds.slice(0, 2)).includes(x.kind) || !Number.isInteger(x.i) || x.i < 0 || x.i >= d[x.kind].length) return null;
      m.kind = x.kind; m.i = x.i;
      if(m.t === 'job') m.n = 1;
    }
    if(m.t === 'kills' && x.i !== undefined){
      if(!Number.isInteger(x.i) || x.i < 0 || x.i >= D.MONSTERS.length) return null;
      m.i = x.i;
    }
    if(m.t === 'made'){ if(!D.CREATIONS.some(c=>c.key===x.key)) return null; m.key = x.key; }
    if(Number.isInteger(x.c) && x.c >= 0 && x.c < CH) m.c = x.c;
    return m;
  };
  d.missions = raw.missions.map(ok).filter(Boolean).slice(0, D.MISSION_SLOTS);
  for(const m of d.missions) d.mseq = Math.max(d.mseq, m.id);
  const ids = new Set();
  for(const m of d.missions){ if(!m.id || ids.has(m.id)) m.id = ++d.mseq; ids.add(m.id); }   // ids tell the UI which slot is new
}

// ---------- simulation ----------
// ev collects things worth telling the player: {type, ...}
function step(s, dt, ev){
  if(!(dt > 0)) return;
  dt = Math.min(dt, MAX_OFFLINE_SEC);
  // a fortune boost that runs out inside this step: split the step there, so any step size gives the same result
  if(s.boostT > 0 && s.boostT < dt){ const a = s.boostT; step(s, a, ev); step(s, dt - a, ev); return; }
  if(s.buff > 0 && s.buff < dt){ const a = s.buff; step(s, a, ev); step(s, dt - a, ev); return; }   // same for a mission buff
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
  stepRealm(s, dt, ev);
  stepDungeon(s, dt, ev);
  if(s.boostT > 0) s.boostT = Math.max(0, s.boostT - dt);
  if(s.buff > 0) s.buff = Math.max(0, s.buff - dt);
  // once a second of play: keep the remainder (at most 1s), so any step size checks as often as advance's 1s chunks
  s.achT = (s.achT || 0) + dt;
  if(s.achT >= 1){ s.achT = Math.min(1, s.achT - 1); checkAchievements(s, ev); checkPets(s, ev); applyPlan(s); checkMissions(s, ev); }
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
  // after a rebirth, go back to the player's last choice as soon as it unlocks again
  if(c.target === 'clone' && s.meta.createPref && creationUnlocked(s, D.CREATIONS.findIndex(x=>x.key===s.meta.createPref))) c.target = s.meta.createPref;
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
// active strike: only during a fight, then a cooldown counted in play time
const strikeWait = s => Math.max(0, (s.strikeAt || 0) - s.playTime);
function strike(s){
  const f = s.fight;
  if(!f || strikeWait(s) > 0) return 0;
  const tg = fightTarget(s, f), dmg = Math.max(D.STRIKE_BLOWS * blow(derive(s).atk, tg.def), D.STRIKE_SHARE * tg.hp);
  f.ghp -= dmg;
  if(f.ghp <= 0){ f.ghp = Number.MIN_VALUE; f.t = D.HIT_INTERVAL; }   // HP stays positive; the next blow (next step) kills
  s.strikeAt = s.playTime + D.STRIKE_CD;
  return dmg;
}
const fightTarget = (s, f) => f.kind === 'ub' ? ubStats(s, f.i) : D.GODS[s.gods];
function winGod(s, ev){
  s.gods++;
  if(s.gods > s.meta.bestGods) s.meta.bestGods = s.gods;
  const sp = recordSplit(s, s.gods-1);
  if(ev) ev.push({ type:'godWin', i:s.gods-1, t:sp.t, best:sp.prev });
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

// ---------- fortune: spirit treasures the player taps (the UI decides when one appears) ----------
const fortuneUnlocked = s => s.meta.bestGods >= D.FORTUNE.unlockGods;
const fortuneItem = kind => D.FORTUNE.items.find(x=>x.kind===kind) || null;
// expected Divinity per second right now: monster kills plus the generator
function dpRate(s, d){
  d = d || derive(s);
  let r = genRate(s, d);
  for(let i=0;i<s.mon.length;i++) if(s.mon[i].n) r += monsterRates(s, i, d).kills * D.MONSTERS[i].dp * d.m.dp;
  return r;
}
// rewards that would help right now; never empty
function fortuneKinds(s){
  const out = [];
  if(createUnlocked(s) || genUnlocked(s)) out.push('dp');   // before that, Divinity has no use yet
  if((s.train.some(r=>r.n) || s.skill.some(r=>r.n)) && s.boostT + D.FORTUNE.boostSecs <= D.FORTUNE.boostCap) out.push('speed');
  if(createUnlocked(s) && nextCreation(s, derive(s))) out.push('create');
  return out.length ? out : ['speed'];
}
// pick the treasure that appears, from a random number in [0,1)
function rollFortune(s, r){
  const k = fortuneKinds(s);
  r = isNum(r) ? r : 0;
  return k[Math.min(k.length - 1, Math.max(0, Math.floor(r * k.length)))];
}
// reward multiplier from treasures caught in a row
const fortuneMult = s => 1 + D.FORTUNE.streakBonus * Math.min(s.meta.fortune.streak, D.FORTUNE.streakMax);
// tap a treasure: pays its reward (or, if that stopped being useful since it appeared, another one) and extends the streak.
// returns what was paid: { kind, mult, streak, dp | secs, made }, or null for an unknown kind
function claimFortune(s, kind, ev){
  if(!fortuneItem(kind)) return null;
  const F = D.FORTUNE, f = s.meta.fortune, kinds = fortuneKinds(s);
  if(!kinds.includes(kind)) kind = kinds[0];
  const mult = fortuneMult(s), d = derive(s), out = { kind, mult };
  if(kind === 'dp'){
    const g = Math.max(F.dpMin, dpRate(s, d) * F.dpSecs) * mult;
    s.dp += g; s.dpTotal += g; s.meta.dpLife += g;
    out.dp = g;
  } else if(kind === 'speed'){
    out.secs = Math.max(0, Math.min(F.boostCap, s.boostT + F.boostSecs * mult) - s.boostT);
    s.boostT += out.secs;
  } else {
    let before = 0; for(const k in s.made) before += s.made[k];
    out.secs = F.createSecs * mult;
    stepCreate(s, out.secs, d, ev);
    let after = 0; for(const k in s.made) after += s.made[k];
    out.made = after - before;
  }
  f.streak++; f.caught++;
  if(f.streak > f.best) f.best = f.streak;
  out.streak = f.streak;
  return out;
}
// a treasure faded before it was tapped: the streak starts over
function missFortune(s){ s.meta.fortune.streak = 0; }

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
  s.meta.createPref = key === 'clone' ? null : key;   // remembered across rebirth
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
  ['dp','dpTotal','battleRaw','clonesLost','playTime','hp'].forEach(k=>{ d[k] = Math.min(1e200, nonNeg(raw[k], d[k])); });   // far above real play, low enough that multipliers stay finite
  d.strikeAt = Math.min(nonNeg(raw.strikeAt, 0), d.playTime + D.STRIKE_CD);
  d.boostT = Math.min(nonNeg(raw.boostT, 0), D.FORTUNE.boostCap);
  d.achT = Math.min(nonNeg(raw.achT, 0), 1);
  d.clones = Math.floor(capped(raw.clones, 1e9));
  d.gods = Math.min(D.GODS.length, Math.floor(nonNeg(raw.gods, 0)));
  d.lastSave = isNum(raw.lastSave) && raw.lastSave > 0 && raw.lastSave <= Date.now() ? raw.lastSave : Date.now();
  ['train','skill'].forEach(kind=>{
    if(!Array.isArray(raw[kind])) return;
    d[kind].forEach((r,i)=>{
      const x = raw[kind][i];
      if(!x || typeof x !== 'object') return;
      r.lv = Math.floor(capped(x.lv, 1e6)); r.prog = Math.min(nonNeg(x.prog, 0), levelTime((kind==='train' ? D.TRAININGS : D.SKILLS)[i], r.lv)); r.n = Math.floor(capped(x.n, 1e9));
    });
  });
  if(Array.isArray(raw.mon)) d.mon.forEach((r,i)=>{
    const x = raw.mon[i];
    if(!x || typeof x !== 'object') return;
    r.n = Math.floor(capped(x.n, 1e9)); r.kills = Math.floor(capped(x.kills, 1e15));   // summed for missions and achievements
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
  m.gp = Math.min(m.gp, 1e15);   // spendable GP buys upgrade levels: far above real play, too little to buy past their cap
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
  if(rm.mats && typeof rm.mats === 'object') for(const k in D.MATERIALS) if(isNum(rm.mats[k])) m.mats[k] = Math.floor(capped(rm.mats[k], 1e15));   // same for gear levels
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
  m.createPref = typeof rm.createPref === 'string' && rm.createPref !== 'clone' && D.CREATIONS.some(c=>c.key===rm.createPref) ? rm.createPref : null;
  const rf = rm.fortune && typeof rm.fortune === 'object' ? rm.fortune : {};
  ['streak','best','caught'].forEach(k=>{ m.fortune[k] = Math.floor(capped(rf[k], 1e9)); });
  m.fortune.best = Math.max(m.fortune.best, m.fortune.streak);
  m.fortune.caught = Math.max(m.fortune.caught, m.fortune.best);
  if(rm.seen && typeof rm.seen === 'object') for(const k in rm.seen) if(rm.seen[k] === 1) m.seen[k] = 1;
  sanitizeSplits(raw, rm, d);
  const r = rm.run;
  if(r && typeof r === 'object' && Number.isInteger(r.i) && r.i >= 0 && r.i < D.DUNGEONS.length && Number.isInteger(r.depth) && r.depth >= 1 && r.depth <= D.MAX_DEPTH)
    m.run = { i:r.i, depth:r.depth, t: Math.min(nonNeg(r.t, 0), D.DUNGEONS[r.i].time) };
  if(m.run) m.run.depth = Math.min(m.run.depth, Math.min(D.MAX_DEPTH, (m.dgBest[D.DUNGEONS[m.run.i].key] || 0) + 1));   // never deeper than unlocked
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
  sanitizeRealm(raw, d);
  d.hp = Math.min(d.hp, derive(d).maxHp);
  sanitizeMissions(d, raw, rm);
  return d;
}

root.GK = {
  SAVE_VERSION, MAX_OFFLINE_SEC, D,
  newState, sanitize, derive, mults, assigned, idle, levelTime, monsterRates, blow,
  skillsUnlocked, createUnlocked, genUnlocked, monumentsUnlocked, rebirthUnlocked,
  rowUnlocked, monstersUnlocked, creationUnlocked, canAfford, creationByKey,
  achValue, achCount, genRate, genCost, upgradeGen, monumentCost, canBuild, buildMonument,
  upgradeCost, buyUpgrade, rebirthGain, rebirth, upgradeGenMax, buildMonumentMax, buyUpgradeMax,
  petsUnlocked, petDef, petPower, teamPower, petExpNeed, toggleTeam, petConditionMet,
  dungeonPower, dungeonUnlocked, maxDepth, winChance, startDungeon, stopDungeon, forgeCost, forgeChance, forge, dungeonTime,
  chalDone, chalGoal, startChallenge, abandonChallenge, ubUnlocked, ubOpen, ubLevel, ubStats, startUbFight, fightTarget, outlook,
  mightUnlocked, mightLv, mightCost, buyMight,
  planUnlocked, autoFightUnlocked, topRow, bestSafeMonster, bestRowFor, moveToBest, applyPlan, setPlan, togglePlan, neededFactor,
  fortuneUnlocked, fortuneItem, dpRate, fortuneKinds, rollFortune, fortuneMult, claimFortune, missFortune,
  realmQi, realmStage, stageFrac, atRealmPeak, tribWait, canTribulate, tribOutlook, startTribulation,
  strike, strikeWait, step, advance, assign, unassignKind, setCreateTarget, startFight, flee,
  missionValue, missionProgress, missionReward, dpIncome, checkMissions
};
})(typeof window !== 'undefined' ? window : globalThis);
