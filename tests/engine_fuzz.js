// God Killer engine invariant / fuzz test. Run from the repo root: node tests/engine_fuzz.js
// Exits non-zero on the first broken invariant or thrown error. Deterministic (seeded Math.random).
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'god-killer');
let rng = 1;
const seed = n => { rng = (n >>> 0) || 1; };
Math.random = () => { rng ^= rng << 13; rng >>>= 0; rng ^= rng >>> 17; rng ^= rng << 5; rng >>>= 0; return rng / 4294967296; };
vm.runInThisContext(fs.readFileSync(path.join(dir, 'data.js'), 'utf8'));
vm.runInThisContext(fs.readFileSync(path.join(dir, 'engine.js'), 'utf8'));
const G = globalThis.GK, D = G.D;
const R = () => Math.random(), pick = a => a[Math.floor(R() * a.length)];
const clone = o => JSON.parse(JSON.stringify(o));
const T0 = Date.now();
let checks = 0;

function fail(msg, ctx){
  console.error('FAIL:', msg);
  if(ctx) console.error(String(ctx).slice(0, 2000));
  process.exit(1);
}

// ---------- invariants ----------
function invariants(s, where){
  checks++;
  const bad = [];
  (function walk(o, p){
    for(const k in o){
      const v = o[k];
      if(typeof v === 'number'){
        if(!Number.isFinite(v)) bad.push(p + k + '=' + v);
        else if(v < 0 && k !== 'v') bad.push(p + k + '=' + v);
      } else if(v && typeof v === 'object') walk(v, p + k + '.');
    }
  })(s, '');
  const d = G.derive(s);
  for(const k of ['atk','def','maxHp','clonePower','maxClones']) if(!Number.isFinite(d[k])) bad.push('derive.' + k + '=' + d[k]);
  const isInt = v => Number.isInteger(v);
  if(!isInt(s.clones)) bad.push('clones not integer ' + s.clones);
  if(s.clones > d.maxClones) bad.push('clones ' + s.clones + ' > max ' + d.maxClones);
  if(G.assigned(s) > s.clones) bad.push('assigned ' + G.assigned(s) + ' > clones ' + s.clones);
  for(const k of ['train','skill','mon']) s[k].forEach((r, i) => {
    if(!isInt(r.n)) bad.push(k + i + '.n ' + r.n);
    if(k !== 'mon' && !isInt(r.lv)) bad.push(k + i + '.lv ' + r.lv);
  });
  if(s.hp < 0 || s.hp > d.maxHp * (1 + 1e-9)) bad.push('hp ' + s.hp + ' / ' + d.maxHp);
  if(!isInt(s.gods) || s.gods > D.GODS.length) bad.push('gods ' + s.gods);
  if(s.meta.bestGods < s.gods) bad.push('bestGods < gods');
  if(!isInt(s.gen)) bad.push('gen ' + s.gen);
  for(const k in s.mono) if(!isInt(s.mono[k])) bad.push('mono ' + k);
  const m = s.meta;
  if(!Array.isArray(m.team) || m.team.length > D.TEAM_SIZE) bad.push('team size');
  if(new Set(m.team).size !== m.team.length) bad.push('team dupes');
  for(const k of m.team) if(!G.petDef(k) || !Object.prototype.hasOwnProperty.call(m.pets, k)) bad.push('team member not a pet: ' + k);
  for(const k in m.pets){ const p = m.pets[k]; if(!G.petDef(k) || !isInt(p.lv) || p.lv < 1 || p.lv > D.PET_MAX_LV) bad.push('pet ' + k); }
  for(const k in m.up) if(!isInt(m.up[k])) bad.push('up ' + k);
  for(const k in m.gear) if(!isInt(m.gear[k])) bad.push('gear ' + k);
  for(const k in m.mats) if(!isInt(m.mats[k])) bad.push('mat ' + k);
  for(const k in m.might){ const x = D.MIGHT.find(y => y.key === k); if(!x || !isInt(m.might[k]) || m.might[k] > x.max) bad.push('might ' + k); }
  m.ub.forEach((l, i) => { if(!isInt(l)) bad.push('ub ' + i); });
  for(const k in m.dgBest) if(!isInt(m.dgBest[k]) || m.dgBest[k] > D.MAX_DEPTH) bad.push('dgBest ' + k);
  if(m.run){
    if(!isInt(m.run.i) || !D.DUNGEONS[m.run.i]) bad.push('run.i ' + m.run.i);
    else if(!isInt(m.run.depth) || m.run.depth < 1 || m.run.depth > D.MAX_DEPTH) bad.push('run.depth ' + m.run.depth);
  }
  for(const k in m.chal){ if(!D.CHALLENGES.some(c => c.key === k) || !isInt(m.chal[k]) || m.chal[k] > D.CHAL_MAX) bad.push('chal ' + k); }
  if(s.challenge !== null){
    if(!D.CHALLENGES.some(c => c.key === s.challenge)) bad.push('challenge key ' + s.challenge);
    else {
      if(G.chalDone(s, s.challenge) >= D.CHAL_MAX) bad.push('challenge already maxed');
      if(s.gods > G.chalGoal(s, s.challenge)) bad.push('challenge past its goal (can never complete)');
    }
  }
  if(typeof m.plan.on !== 'boolean') bad.push('plan.on ' + m.plan.on);
  const ci = D.CREATIONS.findIndex(c => c.key === s.create.target);
  if(ci < 0 || !G.creationUnlocked(s, ci)) bad.push('create target ' + s.create.target);
  if(s.create.cur && !G.creationByKey(s.create.cur)) bad.push('create cur ' + s.create.cur);
  if(s.fight){
    if(s.fight.kind === 'god' && s.gods >= D.GODS.length) bad.push('god fight with no god left');
    if(s.fight.kind === 'ub' && !G.ubOpen(s, s.fight.i)) bad.push('ub fight not open');
  }
  if(bad.length) fail(where + ': ' + bad.slice(0, 8).join('; '), JSON.stringify(s).slice(0, 1500));
}

// ---------- states ----------
function lateSave(){
  const s = G.newState();
  s.gods = 10; s.meta.bestGods = 10; s.meta.rebirths = 6; s.meta.gp = 400; s.meta.gpTotal = 2000;
  s.meta.mp = 60; s.meta.mpTotal = 60; s.meta.ub = [6, 5, 1]; s.meta.might = { power: 5 };
  D.PETS.forEach((p, i) => { s.meta.pets[p.key] = { lv: 20 + i, exp: 0 }; });
  s.meta.team = D.PETS.slice(0, 3).map(p => p.key);
  s.meta.mats = { ore: 80, wood: 60, ember: 30, pearl: 5 }; s.meta.gear = { weapon: 5, armor: 4 };
  s.meta.dgBest = { cave: 6, forest: 5, volcano: 2 }; s.meta.up = { might: 30, legion: 20, focus: 15, faith: 10, maker: 4, shade: 3 };
  s.meta.chal = { few: 1, nomagic: 2 };
  s.train.forEach((r, i) => { r.lv = Math.max(0, 400 - 50 * i); });
  s.skill.forEach((r, i) => { r.lv = Math.max(0, 300 - 40 * i); });
  s.battleRaw = 1e14; s.dp = 1e12; s.gen = 20; s.mono = { statue: 3, shrine: 2 };
  s.made = { clone: 300, light: 50, stone: 60, soil: 40, air: 20, water: 10, plant: 5, beast: 2, human: 1 };
  s.own = { light: 4, stone: 10, soil: 6 };
  s.clones = 200; s.train[0].n = 100; s.mon[0].n = 50;
  return G.sanitize(clone(s));
}
function midSave(){
  const s = lateSave();
  s.gods = 3; s.meta.ub = [0, 0, 0]; s.meta.bestGods = 6; s.meta.mp = 0; s.meta.might = {};
  return G.sanitize(clone(s));
}

// ---------- A. every action with valid, invalid and extreme arguments ----------
const junk = [undefined, null, NaN, Infinity, -Infinity, -1, 0, 0.5, 1, 2, 3, 7, 9, 10, 99, 1e308, -1e308, '0', '1', 'x', '', true, false, {}, [],
  'constructor', 'toString', '__proto__', 'hasOwnProperty', 'train', 'skill', 'mon', 'log', 'meta', 'clone', 'light', 'human',
  'crane', 'fox', 'qilin', 'few', 'mortal', 'nocreate', 'nomagic', 'might', 'legion', 'power', 'autoUb', 'swift', 'fullArmy',
  'statue', 'city', 'weapon', 'amulet', 'balanced', 'hunt', Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER];
const J = () => pick(junk);
const validArgs = {
  kind: () => pick(['train','skill','mon']),
  i: k => Math.floor(R() * (k === 'mon' ? D.MONSTERS.length : 8)),
};
const actions = [
  s => G.assign(s, R() < .7 ? validArgs.kind() : J(), R() < .7 ? Math.floor(R() * 10) : J(), R() < .6 ? Math.floor((R() - .4) * 50) : J()),
  s => G.unassignKind(s, R() < .7 ? validArgs.kind() : J()),
  s => G.moveToBest(s, R() < .7 ? validArgs.kind() : J()),
  s => G.setCreateTarget(s, R() < .7 ? pick(D.CREATIONS).key : J()),
  s => G.buildMonument(s, R() < .7 ? pick(D.MONUMENTS).key : J()),
  s => G.upgradeGen(s),
  s => G.buyUpgrade(s, R() < .7 ? pick(D.UPGRADES).key : J()),
  s => G.buyMight(s, R() < .7 ? pick(D.MIGHT).key : J()),
  s => G.startFight(s),
  s => G.flee(s),
  s => G.startUbFight(s, R() < .6 ? Math.floor(R() * 4) : J()),
  s => G.rebirth(s),
  s => G.startChallenge(s, R() < .7 ? pick(D.CHALLENGES).key : J()),
  s => G.abandonChallenge(s),
  s => G.startDungeon(s, R() < .6 ? Math.floor(R() * 5) : J(), R() < .6 ? Math.floor(R() * 12) : J()),
  s => G.stopDungeon(s),
  s => G.toggleTeam(s, R() < .7 ? pick(D.PETS).key : J()),
  s => G.forge(s, R() < .7 ? pick(D.GEAR).key : J()),
  s => G.togglePlan(s, R() < .7 ? R() < .5 : J()),
  s => G.setPlan(s, R() < .7 ? pick(D.PLAN_PRESETS).key : J()),
  s => G.step(s, R() < .8 ? R() * 2 : J(), []),
  s => G.advance(s, R() < .8 ? R() * 120 : J(), []),
];
// read-only helpers the UI calls every frame must not throw either
function readers(s){
  const d = G.derive(s);
  G.mults(s); G.idle(s); G.rebirthGain(s); G.genCost(s); G.genRate(s, d); G.teamPower(s);
  for(let i = 0; i < D.DUNGEONS.length; i++){ if(G.dungeonUnlocked(s, i)){ G.maxDepth(s, i); G.winChance(s, i, G.maxDepth(s, i)); G.dungeonTime(s, i); } }
  for(let i = 0; i < D.ULTIMATES.length; i++){ const u = G.ubStats(s, i); G.outlook(s, d, u, u.hp); }
  if(s.gods < D.GODS.length){ const g = D.GODS[s.gods]; G.outlook(s, d, g, g.hp); G.neededFactor(s, d, g); }
  if(s.fight) G.fightTarget(s, s.fight);
}
function fuzzActions(name, make, n){
  const s = make();
  invariants(s, name + ' start');
  for(let k = 0; k < n; k++){
    const a = Math.floor(R() * actions.length);
    try { actions[a](s); readers(s); }
    catch(e){ fail(name + ': action #' + a + ' threw: ' + e.stack); }
    invariants(s, name + ' after action #' + a + ' (' + actions[a].toString().slice(6, 60) + ')');
  }
}
seed(11); fuzzActions('fresh', () => G.newState(), 4000);
seed(12); fuzzActions('mid', midSave, 4000);
seed(13); fuzzActions('late', lateSave, 4000);
{ // targeted regressions for invalid arguments that used to throw or corrupt state
  const s = lateSave();
  s.meta.team = []; G.toggleTeam(s, 'constructor'); G.teamPower(s); invariants(s, 'toggleTeam(constructor)');
  if(G.startDungeon(s, 9, 1) || G.startDungeon(s, -1, 1) || G.startDungeon(s, 0, NaN) || G.startDungeon(s, 0, 1.5)) fail('startDungeon accepted a bad dungeon/depth');
  s.meta.ub = [9, 9, 9]; if(G.startUbFight(s, 3)) fail('startUbFight accepted index 3');
  if(G.assign(s, 'train', 0, NaN) || G.assign(s, 'mon', -1, 1) || G.assign(s, 'train', 99, 1)) fail('assign accepted a bad row/delta');
  G.unassignKind(s, 'train'); G.assign(s, 'train', 0, 1.5); invariants(s, 'assign(1.5)');
  G.step(s, Infinity, []); invariants(s, 'step(Infinity)');
}
console.log('A actions ok', ((Date.now() - T0) / 1000).toFixed(1) + 's');

// ---------- B. step with small dt matches advance ----------
function compareRuns(name, make, secs, dt, prep){
  const a = make(), b = clone(a);
  if(prep){ prep(a); prep(b); }
  seed(77); G.advance(a, secs, []);
  seed(77); for(let t = 0, n = Math.round(secs / dt); t < n; t++) G.step(b, dt, []);
  invariants(a, name + ' advance'); invariants(b, name + ' step');
  const close = (x, y, tol) => Math.abs(x - y) <= tol * Math.max(1, Math.abs(x), Math.abs(y));
  const cmp = [['gods', a.gods, b.gods, 0], ['dpTotal', a.dpTotal, b.dpTotal, 0.05],
    ['phys', G.derive(a).phys, G.derive(b).phys, 0.05], ['myst', G.derive(a).myst, G.derive(b).myst, 0.05],
    ['ub0', a.meta.ub[0] || 0, b.meta.ub[0] || 0, 0], ['clonesLost', a.clonesLost, b.clonesLost, 0.1],
    ['dgBest', JSON.stringify(a.meta.dgBest), JSON.stringify(b.meta.dgBest)],
    ['petLv', D.PETS.map(p => a.meta.pets[p.key] ? a.meta.pets[p.key].lv : 0).join(), D.PETS.map(p => b.meta.pets[p.key] ? b.meta.pets[p.key].lv : 0).join()]];
  for(const [k, x, y, tol] of cmp){
    const ok = typeof x === 'number' ? close(x, y, tol) || Math.abs(x - y) <= 2 : x === y;
    if(!ok) fail(name + ': step vs advance differ on ' + k + ': advance=' + x + ' step=' + y);
  }
  return [a, b];
}
{
  // across a god kill: the mid save can beat god 3 right away
  const [a] = compareRuns('god kill', midSave, 120, 0.1, s => { s.meta.run = null; G.startFight(s); });
  if(a.gods < 4) fail('god kill scenario did not kill a god (gods=' + a.gods + ')');
  // across dungeon completions (cave, 120s per run) with auto-repeat
  const [c] = compareRuns('dungeon', lateSave, 400, 0.25, s => { s.meta.dgAuto = true; G.startDungeon(s, 0, 1); });
  if(!c.meta.run || c.meta.run.depth < 2) fail('dungeon scenario did not complete a run');
  // early game: clone creation, training, monster deaths
  compareRuns('early', () => G.newState(), 900, 0.2, s => { s.clones = 10; s.mon[1].n = 5; s.train[0].n = 5; });
  // an ultimate-being fight
  compareRuns('ub fight', lateSave, 60, 0.1, s => { s.meta.ub = [0, 0, 0]; s.meta.run = null; G.startUbFight(s, 0); });
}
console.log('B step/advance ok', ((Date.now() - T0) / 1000).toFixed(1) + 's');

// ---------- C. sanitize never throws and always returns a valid state ----------
const oldShaped = [
  // phase-1 save: no meta, gen, mono, challenge
  { v:2, dp:1580, dpTotal:1580, clones:10, train:[{lv:13,prog:0.8,n:0},{lv:10,prog:9,n:0},{lv:4,prog:74,n:6}], skill:[], mon:[{n:0,kills:20,acc:0.7,dacc:0},{n:4,kills:312,acc:0.3,dacc:0}],
    battleRaw:94.6, own:{}, made:{clone:10}, create:{target:'clone',cur:null,prog:0,autoClone:true}, gods:0, fight:null, hp:3003, clonesLost:0, playTime:174, lastSave:1, log:[] },
  // phase-4 save with the old auto-fight Might perk and in a fight
  { v:2, meta:{ gp:5, gpTotal:9, rebirths:1, bestGods:10, up:{might:2}, ach:{g1:1}, pets:{crane:{lv:3,exp:5}}, team:['crane','crane','fox'], ub:[2], mp:3, might:{autoFight:1, power:2} },
    gods:10, clones:500, train:[{lv:50,n:400}], fight:{kind:'god', ghp:5, t:0}, create:{target:'human', cur:'human', prog:9999}, challenge:'few' },
  { v:1, dp:5 }, { v:'2' }, { v:2, meta:[] }, { v:2, train:{}, mon:'x', own:[], made:null, create:[], log:'x' },
  { v:2, clones:1e300, gods:1e9, hp:-5, dp:-1, meta:{ ub:[1e300], up:{faith:1e9}, chal:{few:99}, might:{power:1e9}, run:{i:3, depth:10, t:1e300} }, challenge:'mortal' },
];
function mutate(o){
  const paths = [];
  (function walk(x, p){ if(x && typeof x === 'object') for(const k of Object.keys(x)){ paths.push(p.concat(k)); walk(x[k], p.concat(k)); } })(o, []);
  const n = 1 + Math.floor(R() * 6);
  for(let j = 0; j < n && paths.length; j++){
    const p = pick(paths); let x = o;
    for(let i = 0; i < p.length - 1 && x && typeof x === 'object'; i++) x = x[p[i]];
    if(!x || typeof x !== 'object') continue;
    const r = R();
    if(r < 0.25) delete x[p[p.length - 1]];
    else if(r < 0.35 && Array.isArray(x)) x.length = Math.floor(R() * x.length);
    else x[p[p.length - 1]] = J();
  }
  return o;
}
{
  seed(21);
  const bases = [clone(G.newState()), clone(midSave()), clone(lateSave()), ...oldShaped];
  const fromAll = [...bases, null, undefined, 0, 'x', [], {}, { v:2 }];
  for(const raw of fromAll){ const s = G.sanitize(clone(raw === undefined ? null : raw)); invariants(s, 'sanitize(fixed)'); G.advance(s, 30, []); invariants(s, 'sanitize(fixed)+advance'); }
  for(let it = 0; it < 3000; it++){
    const raw = mutate(clone(pick(bases)));
    if(R() < 0.1 && raw.meta && typeof raw.meta === 'object') raw.meta.team = ['toString', 'crane', 'constructor'];
    let s;
    try { s = G.sanitize(clone(raw)); } catch(e){ fail('sanitize threw: ' + e.stack, JSON.stringify(raw)); }
    invariants(s, 'sanitize(mutated #' + it + ')');
    try { G.advance(s, 5 + R() * 60, []); if(R() < .3){ G.rebirth(s); G.startChallenge(s, pick(D.CHALLENGES).key); G.advance(s, 5, []); } }
    catch(e){ fail('after sanitize: ' + e.stack, JSON.stringify(raw)); }
    invariants(s, 'sanitize(mutated #' + it + ')+play');
    // a sanitized state saved and loaded again must survive unchanged in shape
    invariants(G.sanitize(clone(s)), 'resanitize');
  }
  // truncated JSON text must at worst fail to parse; whatever parses must sanitize
  const txt = JSON.stringify(lateSave());
  for(let it = 0; it < 300; it++){
    let raw; try { raw = JSON.parse(txt.slice(0, Math.floor(R() * txt.length)) + pick(['', '}', ']}', '}}', '"}'])); } catch(e){ continue; }
    invariants(G.sanitize(raw), 'sanitize(truncated)');
  }
}
console.log('C sanitize ok', ((Date.now() - T0) / 1000).toFixed(1) + 's');

// ---------- D. long bot run across rebirths, challenges and ultimate beings ----------
function bot(s, t){
  const d = G.derive(s);
  if(G.planUnlocked(s) && !s.meta.plan.on){ G.togglePlan(s, true); G.setPlan(s, 'balanced'); }
  if(!s.meta.plan.on){ const idle = G.idle(s); if(idle > 0){ G.assign(s, 'train', G.topRow(s, 'train'), Math.ceil(idle / 2)); const mi = G.bestSafeMonster(s, d); G.assign(s, mi >= 0 ? 'mon' : 'train', mi >= 0 ? mi : 0, G.idle(s)); } }
  if(G.autoFightUnlocked(s)) s.meta.autoFight = true;
  if(!s.fight && s.gods < D.GODS.length && s.hp >= d.maxHp * 0.999 && G.outlook(s, d, D.GODS[s.gods], D.GODS[s.gods].hp).win) G.startFight(s);
  let best = 0; for(let i = 0; i < D.CREATIONS.length; i++) if(G.creationUnlocked(s, i)) best = i;
  G.setCreateTarget(s, D.CREATIONS[best].key);
  while(G.upgradeGen(s)){}
  D.MONUMENTS.forEach(mo => { while(G.buildMonument(s, mo.key)){} });
  D.UPGRADES.forEach(u => { while(G.buyUpgrade(s, u.key)){} });
  D.MIGHT.forEach(x => { while(G.buyMight(s, x.key)){} });
  if(G.petsUnlocked(s) && !s.meta.run) for(let i = D.DUNGEONS.length - 1; i >= 0; i--) if(G.dungeonUnlocked(s, i) && G.startDungeon(s, i, G.maxDepth(s, i))) break;
  D.GEAR.forEach(g => { let k = 0; while(G.forge(s, g.key) !== null && k++ < 20){} });
}
{
  seed(31);
  const s = lateSave(); s.meta.might = { power: 20, autoUb: 1, fullArmy: 1, legacy: 3 };
  let lastGods = s.gods, since = 0, chalTried = 0;
  const HOURS = 10;
  for(let t = 0; t < HOURS * 3600; t++){
    G.step(s, 1, []);
    if(t % 5 === 0) bot(s, t);
    if(t % 600 === 0) invariants(s, 'long run t=' + t);
    if(s.gods !== lastGods){ lastGods = s.gods; since = 0; } else since++;
    // stuck for 40 min: start the next challenge if any, otherwise rebirth
    if(since > 2400 && !s.fight){
      if(s.challenge) G.abandonChallenge(s);
      const c = D.CHALLENGES[chalTried++ % D.CHALLENGES.length];
      if(!G.startChallenge(s, c.key) && G.rebirthGain(s)) G.rebirth(s);
      since = 0; lastGods = s.gods;
    }
  }
  invariants(s, 'long run end');
  if(s.meta.mpTotal <= 60) fail('long run: no ultimate being was ever beaten');
  console.log('D long run ok: gods', s.gods, 'rebirths', s.meta.rebirths, 'ub', JSON.stringify(s.meta.ub), 'chal', JSON.stringify(s.meta.chal), ((Date.now() - T0) / 1000).toFixed(1) + 's');
}
console.log('engine_fuzz: all ok,', checks, 'invariant checks in', ((Date.now() - T0) / 1000).toFixed(1) + 's');
