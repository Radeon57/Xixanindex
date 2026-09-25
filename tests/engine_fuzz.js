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
  if(s.boostT > D.FORTUNE.boostCap) bad.push('boostT ' + s.boostT);
  const fo = m.fortune;
  if(!fo || !isInt(fo.streak) || !isInt(fo.best) || !isInt(fo.caught) || fo.best < fo.streak || fo.caught < fo.streak) bad.push('fortune ' + JSON.stringify(fo));
  // split times: this run's kills are timed inside the run, and the best per god is never slower than this run's
  if(!Array.isArray(s.splits) || s.splits.length > s.gods) bad.push('splits length ' + (s.splits && s.splits.length) + ' > gods ' + s.gods);
  else s.splits.forEach((t, i) => {
    if(typeof t !== 'number' || t > s.playTime + 1e-6) bad.push('split ' + i + '=' + t + ' after playTime ' + s.playTime);
    if(t && !(m.splits[i] > 0 && m.splits[i] <= t)) bad.push('best split ' + i + '=' + m.splits[i] + ' slower than run split ' + t);
  });
  if(!Array.isArray(m.splits) || m.splits.length !== D.GODS.length || m.splits.some(x => typeof x !== 'number')) bad.push('meta.splits ' + JSON.stringify(m.splits));
  if(!Array.isArray(m.lastSplits) || m.lastSplits.length > D.GODS.length || m.lastSplits.some(x => typeof x !== 'number')) bad.push('meta.lastSplits');
  if(typeof m.lastGain !== 'number') bad.push('meta.lastGain ' + m.lastGain);
  const ci = D.CREATIONS.findIndex(c => c.key === s.create.target);
  if(ci < 0 || !G.creationUnlocked(s, ci)) bad.push('create target ' + s.create.target);
  if(s.create.cur && !G.creationByKey(s.create.cur)) bad.push('create cur ' + s.create.cur);
  const rl = s.realm;
  if(!rl || !isInt(rl.r) || rl.r >= D.REALMS.length) bad.push('realm.r ' + (rl && rl.r));
  else {
    if(!isInt(rl.st) || rl.st < 1 || rl.st > D.REALM_STAGES || rl.st !== G.realmStage(s)) bad.push('realm.st ' + rl.st + ' vs ' + G.realmStage(s));
    if(rl.r > 0 && G.realmQi(s) < D.REALMS[rl.r - 1].qi) bad.push('realm above its qi');
    if(rl.trib !== null && !(rl.trib >= 0 && rl.trib <= D.TRIB_TIME)) bad.push('realm.trib ' + rl.trib);
    if(rl.trib !== null && !G.atRealmPeak(s)) bad.push('tribulation below the peak');
    if(rl.cdAt > s.playTime + D.TRIB_COOLDOWN + 1e-9) bad.push('realm.cdAt too far ' + rl.cdAt);
    if(rl.peak !== (G.atRealmPeak(s) ? 1 : 0)) bad.push('realm.peak ' + rl.peak);
    if(m.bestRealm < rl.r || !isInt(m.bestRealm) || m.bestRealm >= D.REALMS.length) bad.push('bestRealm ' + m.bestRealm);
    const f = G.stageFrac(s); if(!(f >= 0 && f <= 1)) bad.push('stageFrac ' + f);
  }
  if(s.fight){
    if(s.fight.kind === 'god' && s.gods >= D.GODS.length) bad.push('god fight with no god left');
    if(s.fight.kind === 'ub' && !G.ubOpen(s, s.fight.i)) bad.push('ub fight not open');
  }
  // sect missions
  if(!Array.isArray(s.missions) || s.missions.length > D.MISSION_SLOTS) bad.push('missions ' + JSON.stringify(s.missions));
  else {
    const ids = new Set();
    for(const x of s.missions){
      if(!x || !['job','lv','kills','gods','made','clones','gen','mono','dp'].includes(x.t)) { bad.push('mission type ' + JSON.stringify(x)); continue; }
      if(!(x.n >= 1) || !isInt(x.id) || x.id > s.mseq || ids.has(x.id)) bad.push('mission n/id ' + JSON.stringify(x));
      ids.add(x.id);
      if((x.t === 'job' || x.t === 'lv') && !(s[x.kind] && isInt(x.i) && x.i < s[x.kind].length)) bad.push('mission row ' + JSON.stringify(x));
      if(x.t === 'made' && !G.creationByKey(x.key)) bad.push('mission item ' + x.key);
      if(x.c !== undefined && !(isInt(x.c) && x.c < D.MISSION_CHAIN.length)) bad.push('mission chain ' + x.c);
      const p = G.missionProgress(s, x);
      if(!(p.v >= 0 && p.v <= p.n)) bad.push('mission progress ' + JSON.stringify(p));
    }
  }
  if(!isInt(m.mchain) || m.mchain > D.MISSION_CHAIN.length) bad.push('mchain ' + m.mchain);
  if(!(s.buff <= D.MISSION_BUFF_MAX)) bad.push('buff ' + s.buff);
  if(!(s.achT >= 0 && s.achT <= 1)) bad.push('achT ' + s.achT);
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
  s => G.strike(s),
  s => G.startTribulation(s),
  s => G.upgradeGenMax(s),
  s => G.buyUpgradeMax(s, R() < .7 ? pick(D.UPGRADES).key : J()),
  s => G.toggleTeam(s, R() < .7 ? pick(D.PETS).key : J()),
  s => G.forge(s, R() < .7 ? pick(D.GEAR).key : J()),
  s => G.togglePlan(s, R() < .7 ? R() < .5 : J()),
  s => G.setPlan(s, R() < .7 ? pick(D.PLAN_PRESETS).key : J()),
  s => G.step(s, R() < .8 ? R() * 2 : J(), []),
  s => G.advance(s, R() < .8 ? R() * 120 : J(), []),
  s => G.claimFortune(s, R() < .7 ? G.rollFortune(s, R() < .8 ? R() : J()) : J(), []),
  s => G.missFortune(s),
];
// read-only helpers the UI calls every frame must not throw either
function readers(s){
  const d = G.derive(s);
  G.mults(s); G.idle(s); G.rebirthGain(s); G.genCost(s); G.genRate(s, d); G.teamPower(s);
  for(let i = 0; i < D.DUNGEONS.length; i++){ if(G.dungeonUnlocked(s, i)){ G.maxDepth(s, i); G.winChance(s, i, G.maxDepth(s, i)); G.dungeonTime(s, i); } }
  for(let i = 0; i < D.ULTIMATES.length; i++){ const u = G.ubStats(s, i); G.outlook(s, d, u, u.hp); }
  if(s.gods < D.GODS.length){ const g = D.GODS[s.gods]; G.outlook(s, d, g, g.hp); G.neededFactor(s, d, g); }
  if(s.fight) G.fightTarget(s, s.fight);
  G.dpRate(s, d); G.fortuneKinds(s); G.fortuneMult(s); G.fortuneUnlocked(s);
  G.realmQi(s); G.stageFrac(s); G.tribOutlook(s, d); G.tribWait(s); G.canTribulate(s);
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
{ // split times: recorded on each kill from the run timer, best kept across rebirth, previous run remembered
  const s = midSave(); s.meta.run = null; s.playTime = 500; s.splits = [100, 200, 300]; s.meta.splits = D.GODS.map((g, i) => i < 3 ? 90 : 0);
  const ev = []; G.startFight(s); G.advance(s, 120, ev);
  const w = ev.find(e => e.type === 'godWin');
  if(!w || w.i !== 3 || !(w.t > 500 && w.t <= 620) || w.best !== 0) fail('godWin split event ' + JSON.stringify(w));
  if(s.splits[3] !== w.t || s.meta.splits[3] !== w.t) fail('split not recorded ' + JSON.stringify(s.splits) + ' / ' + JSON.stringify(s.meta.splits));
  invariants(s, 'split recorded');
  const gain = G.rebirthGain(s), kills = s.splits.slice();
  G.rebirth(s);
  if(s.splits.length || s.playTime !== 0) fail('rebirth did not reset the run timer/splits');
  if(s.meta.lastGain !== gain || JSON.stringify(s.meta.lastSplits) !== JSON.stringify(kills)) fail('rebirth did not remember the last run');
  // a faster kill replaces the best, a slower one does not
  s.gods = 3; s.splits = [1, 2, 3]; s.playTime = 10; s.meta.splits[3] = 50; s.fight = { kind:'god', ghp:1e-9, t:0, hits:0 };
  G.step(s, 2, []); if(s.meta.splits[3] !== 12) fail('faster split not kept: ' + s.meta.splits[3]);
  s.gods = 3; s.splits = [1, 2, 3]; s.playTime = 90; s.fight = { kind:'god', ghp:1e-9, t:0, hits:0 };
  G.step(s, 2, []); if(s.meta.splits[3] !== 12 || s.splits[3] !== 92) fail('slower split replaced best: ' + s.meta.splits[3]);
  // old saves without the fields load with safe defaults; bad values are dropped
  const old = clone(s); delete old.splits; delete old.meta.splits; delete old.meta.lastSplits; delete old.meta.lastGain;
  const o = G.sanitize(old); invariants(o, 'sanitize(no splits)');
  if(o.splits.length || o.meta.splits.length !== D.GODS.length || o.meta.lastGain !== 0) fail('split defaults');
  const bad = clone(s); bad.splits = [1e300, -5, 'x', NaN, 7]; bad.meta.splits = { a:1 }; bad.meta.lastSplits = [Infinity]; bad.meta.lastGain = -3;
  invariants(G.sanitize(bad), 'sanitize(bad splits)');
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
    ['ub0', a.meta.ub[0] || 0, b.meta.ub[0] || 0, 0], ['lastSplit', a.splits[a.splits.length - 1] || 0, b.splits[b.splits.length - 1] || 0, 0], ['realm', a.realm.r + '/' + a.realm.st, b.realm.r + '/' + b.realm.st],
    ['bestRealm', a.meta.bestRealm, b.meta.bestRealm, 0], ['clonesLost', a.clonesLost, b.clonesLost, 0.1], ['mchain', a.meta.mchain, b.meta.mchain, 0],
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
  // a tribulation that passes and one that fails, timed across chunk boundaries
  const [t1] = compareRuns('tribulation pass', lateSave, 20, 0.1, s => { s.meta.run = null; s.realm.r = 3; s.meta.bestRealm = 3; s.realm.st = G.realmStage(s); G.startTribulation(s); });
  if(t1.realm.r !== 4 || t1.meta.bestRealm < 4) fail('tribulation pass scenario did not break through (r=' + t1.realm.r + ')');
  const [t2] = compareRuns('tribulation fail', lateSave, 20, 0.1, s => { s.meta.run = null; s.realm.r = 6; s.meta.bestRealm = 6; s.train.forEach(r => { r.lv = 3000; }); s.realm.st = G.realmStage(s); s.battleRaw = 0; s.meta.up = {}; G.startTribulation(s); });
  if(t2.realm.r !== 6 || t2.realm.trib !== null || !(G.tribWait(t2) > 0)) fail('tribulation fail scenario: r=' + t2.realm.r + ' wait=' + G.tribWait(t2));
  // early game: clone creation, training, monster deaths
  compareRuns('early', () => G.newState(), 900, 0.2, s => { s.clones = 10; s.mon[1].n = 5; s.train[0].n = 5; });
  // an ultimate-being fight
  compareRuns('ub fight', lateSave, 60, 0.1, s => { s.meta.ub = [0, 0, 0]; s.meta.run = null; G.startUbFight(s, 0); });
  // a fortune training boost that runs out part-way through a step
  for(const dt of [0.1, 0.3, 0.7]){
    const [a, b] = compareRuns('fortune boost dt=' + dt, midSave, 60, dt, s => { s.meta.run = null; s.boostT = 30.55; });
    if(a.boostT !== 0 || b.boostT !== 0) fail('fortune boost did not run out: ' + a.boostT + ' / ' + b.boostT);
  }
  // the once-a-second rules (achievements, pets, clone plan, missions) run once per second of play at any step size:
  // odd frame sizes and the UI's jittery ~1s background ticks used to drop the leftover and check up to half as often.
  // Seen through the clone plan, which re-assigns every clone on each check.
  for(const [name, size] of [['1', () => 1], ['1/60', () => 1/60], ['0.1', () => 0.1], ['0.3', () => 0.3], ['0.7', () => 0.7], ['0.98/1.02', k => k % 2 ? 1.02 : 0.98]]){
    const s = G.newState(); s.gods = 1; s.meta.bestGods = 1; s.clones = 10; G.togglePlan(s, true);
    let t = 0, k = 0, checks = 0;
    while(t < 100 - 1e-9){
      const dt = Math.min(size(k++), 100 - t);
      for(const kind of ['train','skill','mon']) G.unassignKind(s, kind);
      G.step(s, dt, []); t += dt;
      if(G.assigned(s)) checks++;
    }
    if(checks < 99 || checks > 101) fail('once-a-second rules ran ' + checks + ' times in 100s at dt=' + name);
    invariants(s, 'once-a-second dt=' + name);
  }
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
  // huge counters from a save: GP and materials can't buy past sanitize's own level caps (upgrades 300, gear 200),
  // and summed kills stay finite. These used to reach Infinity/NaN after one "buy max" or a few minutes of play.
  const huge = clone(lateSave());
  huge.meta.gp = 1e300; huge.meta.mats = { ore: 1e308, wood: 1e308, ember: 1e308, pearl: 1e308 }; huge.mon.forEach(r => { r.kills = 1e308; });
  const h = G.sanitize(huge);
  invariants(h, 'sanitize(huge counters)');
  if(!Number.isFinite(G.missionValue(h, { t:'kills' })) || !Number.isFinite(G.achValue(h, 'kills'))) fail('summed kills overflow');
  D.UPGRADES.forEach(u => G.buyUpgradeMax(h, u.key));
  D.GEAR.forEach(g => { for(let k = 0; k < 5000 && G.forge(h, g.key) !== null; k++); });
  for(const k in h.meta.up) if(h.meta.up[k] > 300) fail('GP from a save bought ' + k + ' Lv.' + h.meta.up[k]);
  for(const k in h.meta.gear) if(h.meta.gear[k] > 200) fail('materials from a save forged ' + k + ' Lv.' + h.meta.gear[k]);
  invariants(h, 'huge counters spent');
  seed(22); for(let t = 0; t < 600; t++){ G.step(h, 1, []); if(t % 3 === 0) bot(h); }
  invariants(h, 'huge counters + 10 min play');
}
console.log('C sanitize ok', ((Date.now() - T0) / 1000).toFixed(1) + 's');

// ---------- E. fortune (spirit treasure) rules ----------
{
  const F = D.FORTUNE, near = (x, y, tol) => Math.abs(x - y) <= (tol || 1e-9) * Math.max(1, Math.abs(x), Math.abs(y));
  // locked until the first god; kinds are always valid and never empty
  const fresh = G.newState();
  if(G.fortuneUnlocked(fresh)) fail('fortune open before the first god');
  if(!G.fortuneUnlocked(midSave())) fail('fortune closed on a mid save');
  for(const make of [() => G.newState(), midSave, lateSave]){
    const s = make(), kinds = G.fortuneKinds(s);
    if(!kinds.length || kinds.some(k => !G.fortuneItem(k))) fail('fortuneKinds: ' + kinds);
    for(const r of [0, 0.3, 0.5, 0.999999, 1, 5, -1, NaN, Infinity, 'x', undefined]) if(!kinds.includes(G.rollFortune(s, r))) fail('rollFortune(' + r + ') gave ' + G.rollFortune(s, r));
  }
  // before creation and the generator, Divinity is useless, so only the boost appears
  { const s = G.newState(); s.gods = 1; s.meta.bestGods = 1; s.clones = 5; s.train[0].n = 5;
    if(JSON.stringify(G.fortuneKinds(s)) !== '["speed"]') fail('early fortune kinds: ' + G.fortuneKinds(s)); }
  // unknown kinds change nothing
  { const s = midSave(), before = JSON.stringify(s);
    for(const k of [undefined, null, 'x', 'constructor', '__proto__', 1, {}]) if(G.claimFortune(s, k, []) !== null) fail('claimFortune accepted ' + k);
    if(JSON.stringify(s) !== before) fail('claimFortune(junk) changed the state'); }
  // 'dp' pays dpSecs of income, times the streak bonus
  { const s = midSave(); s.mon[0].n = 20; s.clones = Math.max(s.clones, G.assigned(s));
    const want = Math.max(F.dpMin, G.dpRate(s) * F.dpSecs), dp0 = s.dp, life0 = s.meta.dpLife;
    const r = G.claimFortune(s, 'dp', []);
    if(r.kind !== 'dp' || !near(r.dp, want) || !near(s.dp - dp0, want) || !near(s.meta.dpLife - life0, want)) fail('dp reward ' + JSON.stringify(r) + ' want ' + want);
    // measured income over 60s agrees with dpRate within 15% (kills are whole numbers)
    const t = midSave(); t.meta.run = null; t.gen = 0; t.mon.forEach(x => { x.n = 0; }); t.mon[0].n = 20; t.clones = Math.max(t.clones, G.assigned(t)); t.create.autoClone = false; t.create.target = 'clone';
    const rate = G.dpRate(t), d0 = t.dpTotal, tev = []; G.advance(t, 60, tev);
    const paid = tev.reduce((a, e) => a + (e.type === 'mission' && e.reward.dp || 0), 0);   // sect-mission rewards aren't income
    if(!(rate > 0) || Math.abs((t.dpTotal - d0 - paid) / 60 - rate) > 0.15 * rate) fail('dpRate ' + rate + ' vs measured ' + (t.dpTotal - d0 - paid) / 60); }
  // 'speed' doubles training for boostSecs, stacks up to boostCap, and runs out
  { const a = midSave(); a.meta.run = null; a.fight = null; a.train.forEach(r => { r.n = 0; }); a.skill.forEach(r => { r.n = 0; }); a.mon.forEach(r => { r.n = 0; });
    a.train[0].n = 10; a.train[0].lv = 0; a.train[0].prog = 0; a.create.autoClone = false; a.create.target = 'clone';
    const b = clone(a);
    const r = G.claimFortune(b, 'speed', []);
    if(r.kind !== 'speed' || r.secs !== F.boostSecs || b.boostT !== F.boostSecs) fail('speed reward ' + JSON.stringify(r));
    if(!near(G.derive(b).m.speed, G.derive(a).m.speed * F.boostMult)) fail('boost does not multiply speed');
    const work = s => { let w = 0; for(let L = 0; L < s.train[0].lv; L++) w += G.levelTime(D.TRAININGS[0], L); return w + s.train[0].prog; };
    G.advance(a, 10, []); G.advance(b, 10, []);
    if(!near(work(b), work(a) * F.boostMult, 1e-6)) fail('boosted training ' + work(b) + ' vs ' + work(a));
    for(let i = 0; i < 10; i++) G.claimFortune(b, 'speed', []);
    if(b.boostT > F.boostCap) fail('boost over cap ' + b.boostT);
    G.advance(b, F.boostCap + 5, []);
    a.buff = b.buff = 0;   // a sect-mission speed buff may have been paid meanwhile
    if(b.boostT !== 0 || !near(G.derive(b).m.speed, G.derive(a).m.speed)) fail('boost did not end'); }
  // 'create' finishes createSecs of creation work
  { const s = lateSave(); s.meta.fortune.streak = 0;
    if(!G.fortuneKinds(s).includes('create')) fail('late save cannot use a creation treasure');
    const made0 = JSON.stringify(s.made), r = G.claimFortune(s, 'create', []);
    if(r.kind !== 'create' || r.secs !== F.createSecs || !(r.made > 0) || JSON.stringify(s.made) === made0) fail('create reward ' + JSON.stringify(r)); }
  // a reward that stopped being useful falls back to one that is
  { const s = G.newState(); s.gods = 1; s.meta.bestGods = 1; s.clones = 5; s.train[0].n = 5;
    const r = G.claimFortune(s, 'create', []);
    if(!r || r.kind !== 'speed') fail('fallback reward ' + JSON.stringify(r)); }
  // the streak grows the reward up to streakMax, a miss resets it, the best is kept
  { const s = midSave();
    for(let i = 0; i < F.streakMax + 3; i++){
      const want = 1 + F.streakBonus * Math.min(i, F.streakMax), r = G.claimFortune(s, 'dp', []);
      if(!near(r.mult, want) || r.streak !== i + 1) fail('streak ' + i + ': ' + JSON.stringify(r));
    }
    G.missFortune(s);
    if(s.meta.fortune.streak !== 0 || s.meta.fortune.best !== F.streakMax + 3 || s.meta.fortune.caught !== F.streakMax + 3 || G.fortuneMult(s) !== 1) fail('miss ' + JSON.stringify(s.meta.fortune));
    // streak survives rebirth (meta), the boost does not (one run)
    s.meta.fortune.streak = 2; s.boostT = 30; G.rebirth(s);
    if(s.meta.fortune.streak !== 2 || s.boostT !== 0) fail('rebirth fortune ' + JSON.stringify(s.meta.fortune) + ' boostT ' + s.boostT);
    // save round trip, and bad values
    s.boostT = 12.5; s.meta.fortune = { streak: 3, best: 7, caught: 20 };
    const t = G.sanitize(clone(s));
    if(t.boostT !== 12.5 || JSON.stringify(t.meta.fortune) !== JSON.stringify(s.meta.fortune)) fail('fortune save round trip');
    const u = G.sanitize(Object.assign(clone(s), { boostT: 1e9, meta: Object.assign(clone(s.meta), { fortune: { streak: 9.7, best: 2, caught: -4 } }) }));
    if(u.boostT !== F.boostCap || u.meta.fortune.streak !== 9 || u.meta.fortune.best !== 9 || u.meta.fortune.caught !== 9) fail('fortune sanitize ' + u.boostT + ' ' + JSON.stringify(u.meta.fortune));
    invariants(u, 'fortune sanitize'); }
  // balance guard: an active player who catches every treasure gains at most ~10% of any one resource
  { const cycle = (F.every[0] + F.every[1]) / 2 + F.life / 2, top = 1 + F.streakBonus * F.streakMax;
    for(const [k, secs] of [['dp', F.dpSecs], ['speed', F.boostSecs * (F.boostMult - 1)], ['create', F.createSecs]]){
      const share = secs * top / cycle / 2;   // at least two reward kinds share the treasures once more than one is useful
      if(share > 0.1) fail('fortune ' + k + ' reward too big: +' + (share * 100).toFixed(1) + '% for an active player');
    } }
}
console.log('E fortune ok', ((Date.now() - T0) / 1000).toFixed(1) + 's');

// ---------- D. long bot run across rebirths, challenges and ultimate beings ----------
function bot(s, t){
  const d = G.derive(s);
  if(G.planUnlocked(s) && !s.meta.plan.on){ G.togglePlan(s, true); G.setPlan(s, 'balanced'); }
  if(!s.meta.plan.on){ const idle = G.idle(s); if(idle > 0){ G.assign(s, 'train', G.topRow(s, 'train'), Math.ceil(idle / 2)); const mi = G.bestSafeMonster(s, d); G.assign(s, mi >= 0 ? 'mon' : 'train', mi >= 0 ? mi : 0, G.idle(s)); } }
  if(G.autoFightUnlocked(s)) s.meta.autoFight = true;
  G.startTribulation(s);
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
// ---------- F. sect missions ----------
{
  seed(41);
  // a fresh save played by the bot: the chain advances in order, every completion pays out, slots stay full
  const s = G.newState(), ev = [];
  let done = 0, dpPaid = 0, buffs = 0, lastC = -1;
  for(let t = 0; t < 20 * 60; t++){
    G.step(s, 1, ev);
    if(t % 3 === 0) bot(s, t);
    for(const e of ev){
      if(e.type !== 'mission') continue;
      done++;
      if(!(e.reward.dp > 0 || e.reward.buff > 0)) fail('mission paid nothing: ' + JSON.stringify(e));
      if(e.reward.dp) dpPaid += e.reward.dp; else buffs++;
      if(s.missions.some(m => m.id === e.m.id)) fail('completed mission still open');
      if(e.m.c !== undefined){ if(e.m.c < lastC - D.MISSION_SLOTS) fail('chain went backwards'); lastC = Math.max(lastC, e.m.c); }
    }
    ev.length = 0;
    if(t > 5 && s.missions.length !== D.MISSION_SLOTS) fail('mission slots not full at t=' + t + ': ' + s.missions.length);
    if(t % 60 === 0) invariants(s, 'missions t=' + t);
  }
  if(done < 15 || s.meta.mchain < 12 || !dpPaid || !buffs) fail('missions barely progressed: done=' + done + ' chain=' + s.meta.mchain);
  // chain position survives rebirth, missions and the buff do not; unfinished chain missions come back
  const open = s.missions.filter(m => m.c !== undefined).map(m => m.c);
  s.meta.bestGods = 6; s.gods = Math.max(s.gods, 1);
  const before = s.meta.mchain;
  G.rebirth(s);
  if(s.missions.length || s.buff) fail('rebirth kept missions/buff');
  if(s.meta.mchain !== (open.length ? Math.min(before, ...open) : before)) fail('rebirth lost the chain position: ' + before + ' -> ' + s.meta.mchain);
  G.step(s, 1, []); invariants(s, 'missions after rebirth');
  if(s.missions.length !== D.MISSION_SLOTS) fail('no missions after rebirth');
  // offline progress completes missions too
  const o = G.newState(), oev = [];
  o.clones = 10; o.train[0].n = 6; o.mon[0].n = 4;
  G.advance(o, 1800, oev);
  const od = oev.filter(e => e.type === 'mission').length;
  if(od < 4 || o.meta.mchain < 4) fail('offline advance completed only ' + od + ' missions');
  invariants(o, 'missions offline');
  // the buff speeds training and runs out
  const b = G.newState(); b.buff = 10;
  const sp = G.derive(b).m.speed; G.advance(b, 12, []);
  if(Math.abs(sp / G.derive(b).m.speed - D.MISSION_BUFF) > 1e-9 || b.buff !== 0) fail('mission buff');
  // earning-พลังเทวะ missions don't count other missions' rewards
  const r = G.newState(); r.missions = [{ id:1, t:'dp', n:1e9, base:0, r:'buff' }, { id:2, t:'clones', n:1, base:0, r:'dp' }]; r.mseq = 2; r.clones = 1;
  G.step(r, 1, []);
  if(r.missions[0].base !== r.dpTotal) fail('dp mission counted a reward: base=' + r.missions[0].base + ' dpTotal=' + r.dpTotal);
  // old saves: past the basics skip the chain, fresh ones start it; junk missions are dropped
  const old = clone(midSave()); delete old.meta.mchain; delete old.missions;
  if(G.sanitize(old).meta.mchain !== D.MISSION_CHAIN.length) fail('old save did not skip the chain');
  const early = clone(G.newState()); delete early.meta.mchain;
  if(G.sanitize(early).meta.mchain !== 0) fail('fresh old save skipped the chain');
  const junkM = clone(G.newState());
  junkM.missions = [{ t:'lv', kind:'mon', i:0, n:5 }, { t:'job', kind:'train', i:99 }, { t:'made', key:'toString', n:1 }, { t:'x' }, null, { t:'kills', i:-1, n:3 },
    { id:7, t:'kills', i:2, n:30, base:5, c:3 }, { t:'gods', n:2, c:999 }, { t:'dp', n:1e400, base:-3 }];
  junkM.mseq = -5; junkM.buff = 1e9; junkM.meta.mchain = 1e9;
  const js = G.sanitize(junkM);
  if(js.missions.length !== 3 || js.missions[0].id !== 7 || js.missions[1].c !== undefined || js.buff !== D.MISSION_BUFF_MAX || js.meta.mchain !== D.MISSION_CHAIN.length) fail('sanitize missions: ' + JSON.stringify(js.missions));
  invariants(js, 'sanitize missions'); G.advance(js, 30, []); invariants(js, 'sanitize missions + play');
  console.log('F missions ok: ' + done + ' done in 20 min, chain ' + s.meta.mchain + '/' + D.MISSION_CHAIN.length, ((Date.now() - T0) / 1000).toFixed(1) + 's');
}
console.log('engine_fuzz: all ok,', checks, 'invariant checks in', ((Date.now() - T0) / 1000).toFixed(1) + 's');
