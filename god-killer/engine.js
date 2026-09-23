// God Killer — game rules. Pure logic on a plain state object: no DOM, so it also runs in the Node balance sim.
(function(root){
'use strict';
const D = root.GKDATA;
const SAVE_VERSION = 2;
const MAX_OFFLINE_SEC = 8*3600;
const JOB_KINDS = ['train','skill','mon'];

function newState(){
  return {
    v: SAVE_VERSION,
    dp: 0,
    dpTotal: 0,
    clones: 0,
    train: D.TRAININGS.map(()=>({ lv:0, prog:0, n:0 })),
    skill: D.SKILLS.map(()=>({ lv:0, prog:0, n:0 })),
    mon: D.MONSTERS.map(()=>({ n:0, kills:0, acc:0, dacc:0 })),
    battleRaw: 0,
    own: {}, made: {},
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
const skillsUnlocked = s => s.gods >= 1;
const createUnlocked = s => s.gods >= 2;
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
  m.phys = m.myst = m.battle = m.stat;
  D.CREATIONS.forEach(c=>{
    if(!c.bonus) return;
    // bonuses count every unit ever made, so spending items as ingredients never loses their bonus
    const n = Math.min(s.made[c.key] || 0, c.bonus.cap);
    if(!n) return;
    if(c.bonus.add) m[c.bonus.stat] += n*c.bonus.per;
    else m[c.bonus.stat] *= 1 + n*c.bonus.per;
  });
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

function levelTime(def, lv){ return def.base * (1 + D.LEVEL_TIME_GROWTH*lv); }
// blows traded per HIT_INTERVAL: attack squared over (attack + defence) keeps damage positive and rewards stacking attack
function blow(atk, def){ return atk*atk / (atk + def); }

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
function pay(s, c, sign){
  s.dp -= sign*c.dp;
  for(const k in c.needs) s.own[k] = (s.own[k]||0) - sign*c.needs[k];
}
const creationByKey = key => D.CREATIONS.find(c=>c.key===key);

// ---------- simulation ----------
// ev collects things worth telling the player: {type, ...}
function step(s, dt, ev){
  if(!(dt > 0)) return;
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
      s.dp += gain; s.dpTotal += gain;
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
  stepCreate(s, dt, d, ev);
  stepFight(s, dt, d, ev);
}

// what to make next for `key`: the item itself if affordable, otherwise the first missing ingredient (recursively);
// null when only DP is short, so the hero waits
function resolveCreation(s, key, depth){
  const c = creationByKey(key);
  if(canAfford(s, c)) return key;
  if(depth > 12) return null;
  for(const k in c.needs) if((s.own[k]||0) < c.needs[k]) return resolveCreation(s, k, depth+1);
  return null;
}
function nextCreation(s, d){
  const c = s.create;
  if(c.autoClone && s.clones < d.maxClones) return 'clone';
  if(c.target === 'clone') return s.clones < d.maxClones ? 'clone' : null;
  return resolveCreation(s, c.target, 0);
}

function stepCreate(s, dt, d, ev){
  const c = s.create;
  let left = dt * d.m.create, guard = 0;
  while(left > 0 && guard++ < 10000){
    if(!c.cur){
      const key = nextCreation(s, d);
      const item = key && creationByKey(key);
      if(!item || !canAfford(s, item)) { c.prog = 0; return; }
      pay(s, item, 1);
      c.cur = key; c.prog = 0;
    }
    const item = creationByKey(c.cur);
    const need = item.time - c.prog;
    if(left < need){ c.prog += left; return; }
    left -= need;
    if(item.key === 'clone') s.clones++;
    else s.own[item.key] = (s.own[item.key]||0) + 1;
    const first = !s.made[item.key];
    s.made[item.key] = (s.made[item.key]||0) + 1;
    if(first && item.key !== 'clone' && ev) ev.push({ type:'firstCreate', key:item.key });
    c.cur = null; c.prog = 0;
    if(item.key === 'clone') d.maxClones = derive(s).maxClones;
  }
}

function stepFight(s, dt, d, ev){
  const f = s.fight;
  if(!f){
    s.hp = Math.min(d.maxHp, s.hp + d.maxHp*D.HP_REGEN*dt);
    return;
  }
  const god = D.GODS[s.gods];
  f.t += dt;
  while(f.t >= D.HIT_INTERVAL){
    f.t -= D.HIT_INTERVAL;
    f.ghp -= blow(d.atk, god.def);
    f.hits = (f.hits||0) + 1;
    if(f.ghp <= 0){
      s.fight = null;
      s.gods++;
      s.hp = derive(s).maxHp;
      if(ev) ev.push({ type:'godWin', i:s.gods-1 });
      return;
    }
    s.hp -= blow(god.atk, d.def);
    if(s.hp <= 0){
      s.hp = 0;
      s.fight = null;
      if(ev) ev.push({ type:'godLose', i:s.gods });
      return;
    }
  }
}

// advance in chunks so long offline gaps stay accurate (level-ups, deaths and rewards each apply as they happen)
function advance(s, sec, ev){
  sec = Math.min(Math.max(0, sec), MAX_OFFLINE_SEC);
  const CHUNK = 1;
  while(sec > 0){ const dt = Math.min(CHUNK, sec); step(s, dt, ev); sec -= dt; }
}

// ---------- player actions ----------
function assign(s, kind, i, delta){
  if(!JOB_KINDS.includes(kind) || !rowUnlocked(s, kind, i)) return 0;
  const r = s[kind][i];
  if(delta > 0) delta = Math.min(delta, idle(s));
  else delta = Math.max(delta, -r.n);
  r.n += delta;
  return delta;
}
function unassignKind(s, kind){ s[kind].forEach(r=>{ r.n = 0; }); }

function setCreateTarget(s, key){
  const i = D.CREATIONS.findIndex(c=>c.key===key);
  if(i < 0 || !creationUnlocked(s, i)) return false;
  const c = s.create;
  if(c.cur && c.cur !== key){ pay(s, creationByKey(c.cur), -1); c.cur = null; c.prog = 0; }
  c.target = key;
  return true;
}

function startFight(s){
  if(s.fight || s.gods >= D.GODS.length) return false;
  s.fight = { ghp: D.GODS[s.gods].hp, t:0, hits:0 };
  return true;
}
function flee(s){ s.fight = null; }

// ---------- saves ----------
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const nonNeg = (v, dflt) => isNum(v) ? Math.max(0, v) : dflt;
function sanitize(raw){
  const d = newState();
  if(!raw || typeof raw !== 'object' || raw.v !== SAVE_VERSION) return d;
  ['dp','dpTotal','battleRaw','clonesLost','playTime','hp'].forEach(k=>{ d[k] = nonNeg(raw[k], d[k]); });
  d.clones = Math.floor(nonNeg(raw.clones, 0));
  d.gods = Math.min(D.GODS.length, Math.floor(nonNeg(raw.gods, 0)));
  d.lastSave = isNum(raw.lastSave) && raw.lastSave > 0 && raw.lastSave <= Date.now() ? raw.lastSave : Date.now();
  ['train','skill'].forEach(kind=>{
    if(!Array.isArray(raw[kind])) return;
    d[kind].forEach((r,i)=>{
      const x = raw[kind][i];
      if(!x || typeof x !== 'object') return;
      r.lv = Math.floor(nonNeg(x.lv, 0)); r.prog = nonNeg(x.prog, 0); r.n = Math.floor(nonNeg(x.n, 0));
    });
  });
  if(Array.isArray(raw.mon)) d.mon.forEach((r,i)=>{
    const x = raw.mon[i];
    if(!x || typeof x !== 'object') return;
    r.n = Math.floor(nonNeg(x.n, 0)); r.kills = Math.floor(nonNeg(x.kills, 0));
    r.acc = Math.min(1, nonNeg(x.acc, 0)); r.dacc = Math.min(1, nonNeg(x.dacc, 0));
  });
  ['own','made'].forEach(k=>{
    if(!raw[k] || typeof raw[k] !== 'object') return;
    D.CREATIONS.forEach(c=>{ if(isNum(raw[k][c.key])) d[k][c.key] = Math.floor(Math.max(0, raw[k][c.key])); });
  });
  if(raw.create && typeof raw.create === 'object'){
    if(creationByKey(raw.create.target)) d.create.target = raw.create.target;
    if(creationByKey(raw.create.cur)) { d.create.cur = raw.create.cur; d.create.prog = nonNeg(raw.create.prog, 0); }
    if(typeof raw.create.autoClone === 'boolean') d.create.autoClone = raw.create.autoClone;
  }
  if(Array.isArray(raw.log)) d.log = raw.log.filter(l => typeof l === 'string').slice(0, 60);
  // never trust more assigned clones than exist
  let over = assigned(d) - d.clones;
  for(const kind of JOB_KINDS){ for(const r of d[kind]){ if(over <= 0) break; const k = Math.min(r.n, over); r.n -= k; over -= k; } }
  d.hp = Math.min(d.hp, derive(d).maxHp);
  return d;
}

root.GK = {
  SAVE_VERSION, MAX_OFFLINE_SEC, D,
  newState, sanitize, derive, mults, assigned, idle, levelTime, monsterRates, blow,
  skillsUnlocked, createUnlocked, rowUnlocked, monstersUnlocked, creationUnlocked, canAfford, creationByKey,
  step, advance, assign, unassignKind, setCreateTarget, startFight, flee
};
})(typeof window !== 'undefined' ? window : globalThis);
