// God Killer — screen and input. Game rules live in engine.js, numbers in data.js.
(function(){
'use strict';
const G = window.GK, D = G.D;
const SAVE_KEY = 'godKillerSave2';
const UI_INTERVAL_MS = 200;   // text refresh; bars move every frame
const JOB_DEFS = { train: D.TRAININGS, skill: D.SKILLS, mon: D.MONSTERS };
const GOD_COLORS = ['#7fb0ff','#ff6b6b','#b6a8d6','#e8c76f','#4fd1c5','#ff9a3c'];

let s = G.newState();
let storageOk = true;
let activeTab = 'train';
let stepSize = 1;
let logDirty = true;
let fx = null;
const alerts = {};
const $ = id => document.getElementById(id);

// ---------- DOM helpers: a write happens only when the value changed ----------
function setText(el, v){ v = String(v); if(el._v !== v){ el._v = v; el.textContent = v; } }
function setHTML(el, v){ if(el._h !== v){ el._h = v; el.innerHTML = v; } }
function setDisabled(el, v){ if(el.disabled !== v) el.disabled = v; }
function setShown(el, v, how){ const d = v ? (how||'block') : 'none'; if(el._d !== d){ el._d = d; el.style.display = d; } }
function setClass(el, cls, on){ if(el.classList.contains(cls) !== on) el.classList.toggle(cls, on); }
function setBar(el, frac){
  const k = Math.round(Math.max(0, Math.min(1, frac || 0))*1000);
  if(el._k !== k){ el._k = k; el.style.transform = 'scaleX('+(k/1000)+')'; }
}

// ---------- formatting ----------
const UNITS = ['K','M','B','T','Qa','Qi'];
function fmt(n){
  if(!Number.isFinite(n)) return '∞';
  if(n < 0) return '-'+fmt(-n);
  if(n < 10) return String(+n.toFixed(n < 1 ? 2 : 1));
  if(n < 1000) return String(Math.floor(n));
  let x = n, u = -1;
  while(x >= 1000 && u < UNITS.length-1){ x /= 1000; u++; }
  if(x >= 1000) return n.toExponential(2).replace('e+','e');
  return (x < 100 ? x.toFixed(2) : x.toFixed(1)) + UNITS[u];
}
function fmtTime(sec){
  if(!Number.isFinite(sec)) return '—';
  if(sec < 60) return (sec < 10 ? sec.toFixed(1) : Math.round(sec)) + ' วิ';
  if(sec < 3600) return (sec/60).toFixed(1) + ' นาที';
  if(sec < 86400) return (sec/3600).toFixed(1) + ' ชม.';
  return (sec/86400).toFixed(1) + ' วัน';
}

// ---------- log & toast ----------
function addLog(msg){
  const t = new Date().toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' });
  s.log.unshift('['+t+'] '+msg);
  if(s.log.length > 60) s.log.length = 60;
  logDirty = true;
}
function renderLog(){
  logDirty = false;
  const box = $('tab-log');
  if(!s.log.length){ box.textContent = 'ยังไม่มีบันทึก'; return; }
  box.replaceChildren(...s.log.map(l=>{ const d = document.createElement('div'); d.textContent = l; return d; }));
}
let toastTimer = 0;
function toast(msg){
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 1800);
}

// ---------- rewards text ----------
function rewardParts(i){
  const r = D.GODS[i].reward, out = [];
  if(r.unlock === 'skills') out.push('ปลดล็อก <b>วิชาเวท</b>');
  if(r.unlock === 'create') out.push('ปลดล็อก <b>การสร้างสรรพสิ่ง</b>');
  const monBefore = Math.min(D.MONSTERS.length, 2 + 2*i), monAfter = Math.min(D.MONSTERS.length, 2 + 2*(i+1));
  if(monAfter > monBefore) out.push('สนามรบใหม่ <b>'+(monAfter-monBefore)+' แห่ง</b>');
  if(r.maxClones) out.push('ร่างเงาสูงสุด <b>+'+r.maxClones+'</b>');
  if(r.stat) out.push('ค่าสถานะทั้งหมด <b>×'+r.stat+'</b>');
  if(r.clone) out.push('พลังร่างเงา <b>×'+r.clone+'</b>');
  if(r.dp) out.push('พลังเทวะที่ได้ <b>×'+r.dp+'</b>');
  if(r.speed) out.push('ความเร็วฝึก <b>×'+r.speed+'</b>');
  return out;
}
const stripTags = h => h.replace(/<[^>]+>/g, '');

// ---------- build: clone job lists ----------
const R = { train:[], skill:[], mon:[], create:[], gods:[] };
const SEC = {};

function toolbarHTML(kind){
  const steps = [1,10,100,'all'].map(v=>`<button data-act="step" data-v="${v}">${v==='all' ? 'ทั้งหมด' : '×'+v}</button>`).join('');
  return `<div class="toolbar">
      <span class="idleTxt">ว่าง <b data-r="idle">0</b> ร่าง</span>
      <div class="seg" role="group" aria-label="จำนวนร่างเงาต่อการกด">${steps}</div>
      <button class="miniBtn" data-act="clear" data-kind="${kind}">ถอนทั้งหมด</button>
    </div>
    <div class="summary"><span data-r="sum1"></span><span data-r="sum2"></span></div>
    <div class="hint" data-r="hint"></div>`;
}
function ctlHTML(kind, i, name){
  return `<div class="ctl">
      <button class="ctlBtn" data-act="dec" data-kind="${kind}" data-i="${i}" aria-label="ถอนร่างเงาจาก ${name}">−</button>
      <b class="ctlN">0</b>
      <button class="ctlBtn plus" data-act="inc" data-kind="${kind}" data-i="${i}" aria-label="ส่งร่างเงาไป ${name}">+</button>
    </div>`;
}
function buildJobs(kind){
  const sec = $('tab-'+kind);
  const rows = JOB_DEFS[kind].map((d,i)=>{
    const head = kind === 'mon'
      ? `<span class="jobName">${d.name}</span><span class="jobLv pow"></span>`
      : `<span class="jobName">${d.name}</span><span class="jobLv"></span>`;
    const info = kind === 'mon'
      ? `<div class="jobSub s1"></div><div class="jobSub s2"></div>`
      : `<div class="bar thin"><i></i></div><div class="jobSub s1"></div>`;
    return `<div class="job" data-i="${i}">
        <div class="jobHead">${head}</div>
        <div class="jobBody"><div class="jobInfo">${info}</div>${ctlHTML(kind, i, d.name)}</div>
        <div class="lockTxt"></div>
      </div>`;
  }).join('');
  sec.innerHTML = toolbarHTML(kind) + rows;
  SEC[kind] = { idle: sec.querySelector('[data-r="idle"]'), sum1: sec.querySelector('[data-r="sum1"]'),
                sum2: sec.querySelector('[data-r="sum2"]'), hint: sec.querySelector('[data-r="hint"]') };
  R[kind] = [...sec.querySelectorAll('.job')].map(el=>({
    el, lv: el.querySelector('.jobLv'), bar: el.querySelector('.bar>i'), s1: el.querySelector('.s1'), s2: el.querySelector('.s2'),
    n: el.querySelector('.ctlN'), dec: el.querySelector('[data-act="dec"]'), inc: el.querySelector('[data-act="inc"]'),
    lock: el.querySelector('.lockTxt')
  }));
}

function lockReason(kind, i){
  if(kind === 'mon') return 'ปลดล็อกเมื่อสังหาร ' + D.GODS[Math.floor(i/2)-1].name;
  return 'ปลดล็อกเมื่อ ' + JOB_DEFS[kind][i-1].name + ' ถึง Lv.' + D.ROW_UNLOCK_LEVEL;
}

function renderJobs(kind, d, full){
  const rows = s[kind], defs = JOB_DEFS[kind], refs = R[kind];
  const free = G.idle(s);
  let lockedShown = false;
  for(let i=0;i<rows.length;i++){
    const r = rows[i], ref = refs[i];
    const open = G.rowUnlocked(s, kind, i);
    const show = open || !lockedShown;   // show only the next locked row as a teaser
    if(!open) lockedShown = true;
    setShown(ref.el, show);
    if(!show) continue;
    setClass(ref.el, 'locked', !open);
    if(!open){ if(full) setText(ref.lock, lockReason(kind, i)); continue; }
    if(kind !== 'mon') setBar(ref.bar, r.prog / G.levelTime(defs[i], r.lv));
    if(!full) continue;
    setText(ref.n, fmt(r.n));
    setDisabled(ref.dec, r.n === 0);
    setDisabled(ref.inc, free === 0);
    if(kind === 'mon'){
      const rt = G.monsterRates(s, i, d);
      setText(ref.lv, 'พลัง ' + fmt(defs[i].power));
      const cls = rt.ratio >= 1 ? 'safe' : rt.ratio >= 0.5 ? 'risky' : 'deadly';
      if(ref.lv._c !== cls){ ref.lv._c = cls; ref.lv.className = 'jobLv pow ' + cls; }
      setText(ref.s1, 'ต่อตัว +' + fmt(defs[i].dp*d.m.dp) + ' DP · +' + fmt(defs[i].battle*d.m.battle) + ' ยุทธ์ · ฆ่าแล้ว ' + fmt(r.kills));
      let rate;
      if(r.n) rate = 'ฆ่า ' + fmt(rt.kills) + '/วิ' + (rt.deaths ? ' · <span class="die">ร่างเงาตาย ' + fmt(rt.deaths) + '/วิ</span>' : '');
      else if(rt.ratio >= 1) rate = 'ร่างเงาแข็งแกร่งกว่า ×' + fmt(rt.ratio) + ' — ปลอดภัย';
      else rate = '<span class="die">ร่างเงาอ่อนกว่า (' + Math.round(rt.ratio*100) + '%) — จะถูกฆ่า</span>';
      setHTML(ref.s2, rate);
    } else {
      const mult = kind === 'train' ? d.m.phys : d.m.myst;
      setText(ref.lv, 'Lv.' + r.lv);
      const eta = r.n ? fmtTime((G.levelTime(defs[i], r.lv) - r.prog) / (r.n * d.m.speed)) : 'ไม่มีร่างเงา';
      setText(ref.s1, '+' + fmt(defs[i].gain*mult) + ' ' + (kind==='train' ? 'กาย' : 'เวท') + '/เลเวล · เลเวลถัดไป ' + eta);
    }
  }
  if(!full) return;
  const sec = SEC[kind];
  setText(sec.idle, fmt(free));
  if(kind === 'train'){ setHTML(sec.sum1, 'กายรวม <b>' + fmt(d.phys) + '</b>'); setText(sec.sum2, 'ความเร็วฝึก ×' + fmt(d.m.speed)); }
  if(kind === 'skill'){ setHTML(sec.sum1, 'เวทรวม <b>' + fmt(d.myst) + '</b>'); setText(sec.sum2, 'ความเร็วฝึก ×' + fmt(d.m.speed)); }
  if(kind === 'mon'){ setHTML(sec.sum1, 'พลังร่างเงา <b>' + fmt(d.clonePower) + '</b>'); setHTML(sec.sum2, 'ยุทธ์รวม <b>' + fmt(d.battle) + '</b>'); }
  setShown(sec.hint, free > 0);
  if(free > 0) setText(sec.hint, 'มีร่างเงาว่าง ' + fmt(free) + ' ร่าง — กด + เพื่อส่งมาทำงาน' + (kind==='mon' ? ' (เลือกศัตรูสีเขียวเพื่อไม่ให้ร่างเงาตาย)' : ''));
}

// ---------- build: creation ----------
function costHTML(c, d){
  const parts = [fmtTime(c.time / d.m.create)];
  if(c.dp) parts.push('<span class="' + (s.dp < c.dp ? 'short' : '') + '">DP ' + fmt(c.dp) + '</span>');
  for(const k in c.needs){
    const n = c.needs[k];
    parts.push('<span class="' + ((s.own[k]||0) < n ? 'short' : '') + '">' + G.creationByKey(k).name + ' ×' + n + '</span>');
  }
  return parts.join(' · ');
}
function buildCreate(){
  $('createList').innerHTML = D.CREATIONS.map((c,i)=>`<div class="cItem" data-i="${i}">
      <div class="jobHead"><span class="jobName">${c.name}</span><span class="cOwn"></span></div>
      <div class="cDesc">${c.bonus ? c.desc + ' ต่อชิ้น (สูงสุด ' + c.bonus.cap + ' ชิ้น)' : c.desc + ' (ใช้แค่เวลา)'}</div>
      <div class="cFoot"><span class="cCost"></span><button class="selBtn" data-act="target" data-key="${c.key}">เลือกสร้าง</button></div>
      <div class="lockTxt"></div>
    </div>`).join('');
  R.create = [...document.querySelectorAll('#createList .cItem')].map(el=>({
    el, own: el.querySelector('.cOwn'), cost: el.querySelector('.cCost'), btn: el.querySelector('.selBtn'), lock: el.querySelector('.lockTxt')
  }));
}
// why the hero is idle: the item in the recipe chain that is short on DP
function dpBlocker(key){
  let c = G.creationByKey(key), guard = 0;
  while(c && guard++ < 20){
    let missing = null;
    for(const k in c.needs) if((s.own[k]||0) < c.needs[k]){ missing = k; break; }
    if(!missing) return s.dp < c.dp ? c : null;
    c = G.creationByKey(missing);
  }
  return null;
}
function renderCreate(d, full){
  const c = s.create;
  const cur = c.cur && G.creationByKey(c.cur);
  setBar($('cCurBar'), cur ? c.prog / cur.time : 0);
  if(!full) return;
  const target = G.creationByKey(c.target);
  setText($('cCurName'), cur ? cur.name : '—');
  let note = '';
  if(cur){
    if(c.cur === 'clone' && c.target !== 'clone') note = 'เติมร่างเงาให้เต็มก่อน แล้วจะกลับไปสร้าง ' + target.name;
    else if(c.cur !== c.target) note = 'กำลังทำวัตถุดิบสำหรับ ' + target.name;
  } else if(c.target === 'clone'){
    note = s.clones >= d.maxClones ? (G.createUnlocked(s) ? 'ร่างเงาเต็มแล้ว — เลือกของที่จะสร้างด้านล่าง' : 'ร่างเงาเต็มแล้ว') : '';
  } else {
    const blk = dpBlocker(c.target);
    if(blk) note = 'รอพลังเทวะ ' + fmt(blk.dp) + ' เพื่อสร้าง ' + blk.name + ' (มี ' + fmt(s.dp) + ')';
  }
  setText($('cCurNote'), note);
  setText($('cSpeed'), fmt(d.m.create));
  const box = $('autoClone');
  if(box.checked !== c.autoClone) box.checked = c.autoClone;
  const createOpen = G.createUnlocked(s);
  setShown($('createLock'), !createOpen);
  if(!createOpen) setText($('createLockGod'), D.GODS[1].name);
  let lockedShown = false;
  D.CREATIONS.forEach((item, i)=>{
    const ref = R.create[i];
    const open = G.creationUnlocked(s, i);
    const show = open || (createOpen && !lockedShown);
    if(!open) lockedShown = true;
    setShown(ref.el, show);
    if(!show) return;
    setClass(ref.el, 'locked', !open);
    if(!open){ setText(ref.lock, 'ปลดล็อกเมื่อสร้าง ' + D.CREATIONS[i-1].name + ' ได้ครั้งแรก'); return; }
    setClass(ref.el, 'active', c.target === item.key);
    setText(ref.btn, c.target === item.key ? 'กำลังเลือก' : 'เลือกสร้าง');
    if(item.key === 'clone') setText(ref.own, fmt(s.clones) + '/' + fmt(d.maxClones));
    else setText(ref.own, 'มี ' + fmt(s.own[item.key]||0) + ' · โบนัส ' + Math.min(s.made[item.key]||0, item.bonus.cap) + '/' + item.bonus.cap);
    setHTML(ref.cost, costHTML(item, d));
  });
}

// ---------- build: gods ----------
function godSVG(i){
  const c = GOD_COLORS[i % GOD_COLORS.length];
  return `<svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
    <defs><radialGradient id="godGlow${i}" cx="50%" cy="45%" r="55%"><stop offset="0%" stop-color="${c}" stop-opacity=".55"/><stop offset="100%" stop-color="${c}" stop-opacity="0"/></radialGradient></defs>
    <circle cx="42" cy="42" r="40" fill="url(#godGlow${i})"/>
    <circle cx="42" cy="42" r="30" fill="none" stroke="${c}" stroke-width="1.2" opacity=".55"/>
    <path d="M25 31 L28 15 L35 24 L42 10 L49 24 L56 15 L59 31 Z" fill="${c}"/>
    <path d="M28 34 Q42 30 56 34 L56 50 Q42 68 28 50 Z" fill="#1c1832" stroke="${c}" stroke-width="1.5"/>
    <rect x="33" y="41" width="6" height="3" rx="1" fill="${c}"/><rect x="45" y="41" width="6" height="3" rx="1" fill="${c}"/>
    <path d="M37 55 L47 55" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
}
function buildGods(){
  $('godList').innerHTML = D.GODS.map((g,i)=>`<div class="godRow" data-i="${i}"><span class="gMark"></span><span class="gName"></span><span class="gInfo" style="margin-left:auto"></span></div>`).join('');
  R.gods = [...document.querySelectorAll('#godList .godRow')].map(el=>({ el, mark: el.querySelector('.gMark'), name: el.querySelector('.gName'), info: el.querySelector('.gInfo') }));
}
let shownGod = -1, lastHits = 0;
function fightOutlook(d){
  const god = D.GODS[s.gods];
  const ghp = s.fight ? s.fight.ghp : god.hp;
  const dealt = G.blow(d.atk, god.def), taken = G.blow(god.atk, d.def);
  const hitsToKill = Math.ceil(ghp / dealt), hitsToDie = Math.ceil(s.hp / taken);
  return { win: hitsToKill <= hitsToDie, secs: hitsToKill * D.HIT_INTERVAL, share: Math.min(0.99, hitsToDie*dealt/ghp) };
}
function renderGods(d, full){
  const done = s.gods >= D.GODS.length;
  setShown($('arenaWrap'), !done);
  setShown($('godsDone'), done);
  if(!done){
    const god = D.GODS[s.gods];
    setBar($('aHeroHp'), s.hp / d.maxHp);
    setBar($('aGodHp'), s.fight ? s.fight.ghp / god.hp : 1);
    if(s.fight && s.fight.hits !== lastHits){ lastHits = s.fight.hits; hitFx(); }
    if(!s.fight) lastHits = 0;
    if(full){
      if(shownGod !== s.gods){ shownGod = s.gods; $('godArt').innerHTML = godSVG(s.gods); setHTML($('godReward'), 'รางวัลเมื่อสังหาร: ' + rewardParts(s.gods).join(' · ')); }
      setText($('aGodName'), god.name);
      setText($('aHeroHpTxt'), fmt(s.hp) + ' / ' + fmt(d.maxHp));
      setText($('aGodHpTxt'), fmt(s.fight ? s.fight.ghp : god.hp) + ' / ' + fmt(god.hp));
      setText($('aHeroAtk'), fmt(d.atk)); setText($('aHeroDef'), fmt(d.def));
      setText($('aGodAtk'), fmt(god.atk)); setText($('aGodDef'), fmt(god.def));
      setClass($('arena'), 'fighting', !!s.fight);
      const o = fightOutlook(d);
      const pred = $('predict');
      setClass(pred, 'win', o.win); setClass(pred, 'lose', !o.win);
      let txt = o.win ? 'คาดการณ์: ชนะ ภายในราว ' + fmtTime(o.secs) : 'คาดการณ์: แพ้ — ทำดาเมจได้ราว ' + Math.floor(o.share*100) + '% ก่อนล้ม';
      if(!s.fight && s.hp < d.maxHp*0.999) txt += ' (พลังชีวิตยังฟื้นไม่เต็ม)';
      setText(pred, txt);
      setText($('fightLabel'), s.fight ? 'ถอยหนี' : 'ท้าสู้ ' + god.name);
      setClass($('fightBtn'), 'flee', !!s.fight);
    }
  }
  if(!full) return;
  D.GODS.forEach((g,i)=>{
    const ref = R.gods[i];
    const state = i < s.gods ? 'done' : i === s.gods ? 'next' : 'later';
    setClass(ref.el, 'done', state === 'done'); setClass(ref.el, 'next', state === 'next');
    setText(ref.mark, state === 'done' ? '✓' : state === 'next' ? '⚔' : '🔒');
    setText(ref.name, state === 'later' ? '???' : g.name);
    setText(ref.info, state === 'done' ? 'สังหารแล้ว' : state === 'next' ? 'เป้าหมายถัดไป' : '');
  });
}

// ---------- HUD & tabs ----------
function renderHud(d, full){
  setBar($('hudHpBar'), s.hp / d.maxHp);
  if(!full) return;
  setText($('hudGods'), s.gods + '/' + D.GODS.length);
  setText($('hudHp'), fmt(s.hp) + '/' + fmt(d.maxHp));
  setText($('hudAtk'), fmt(d.atk));
  setText($('hudDef'), fmt(d.def));
  setText($('hudDp'), fmt(s.dp));
  setText($('hudClones'), fmt(s.clones) + '/' + fmt(d.maxClones));
}
const TABS = ['train','skill','mon','create','gods','log'];
function tabLocked(name){ return name === 'skill' && !G.skillsUnlocked(s); }
function renderTabs(d){
  if(s.gods < D.GODS.length && !s.fight && s.hp >= d.maxHp*0.999 && fightOutlook(d).win) alerts.gods = true;
  document.querySelectorAll('.tab').forEach(t=>{
    const name = t.dataset.tab;
    setClass(t, 'active', name === activeTab);
    setClass(t, 'locked', tabLocked(name));
    setClass(t, 'alert', !!alerts[name] && name !== activeTab);
  });
}
function selectTab(name){
  if(tabLocked(name)){ toast('ปลดล็อกวิชาเวทเมื่อสังหาร ' + D.GODS[0].name); return; }
  activeTab = name;
  alerts[name] = false;
  TABS.forEach(t=>setShown($('tab-'+t), t === name));
  document.querySelectorAll('.tab').forEach(t=>t.setAttribute('aria-pressed', t.dataset.tab === name ? 'true' : 'false'));
  if(name === 'log') renderLog();
  render(true);
}
function renderSteps(){
  document.querySelectorAll('[data-act="step"]').forEach(b=>setClass(b, 'on', String(stepSize) === b.dataset.v));
}

function render(full){
  const d = G.derive(s);
  renderHud(d, full);
  if(activeTab === 'train' || activeTab === 'skill' || activeTab === 'mon') renderJobs(activeTab, d, full);
  else if(activeTab === 'create') renderCreate(d, full);
  else if(activeTab === 'gods') renderGods(d, full);
  else if(activeTab === 'log' && logDirty) renderLog();
  if(full) renderTabs(d);
}

// ---------- engine events ----------
let lastLost = 0, lastDeathToast = 0;
function handleEvents(ev, quiet){
  for(const e of ev){
    if(e.type === 'rowUnlock'){
      const def = JOB_DEFS[e.kind][e.i];
      addLog('ปลดล็อก' + (e.kind === 'train' ? 'การฝึกกาย' : 'วิชาเวท') + 'ใหม่: ' + def.name);
      alerts[e.kind] = true;
      if(!quiet) toast('ปลดล็อกใหม่: ' + def.name);
    } else if(e.type === 'firstCreate'){
      const c = G.creationByKey(e.key);
      addLog('สร้าง ' + c.name + ' ได้เป็นครั้งแรก! (' + c.desc + ' ต่อชิ้น)');
      alerts.create = true;
      if(!quiet) toast('สร้าง ' + c.name + ' สำเร็จครั้งแรก!');
    } else if(e.type === 'godWin'){
      const god = D.GODS[e.i], r = god.reward;
      addLog('⚔ สังหาร ' + god.name + ' สำเร็จ! ได้รับ: ' + stripTags(rewardParts(e.i).join(', ')));
      if(r.unlock === 'skills') alerts.skill = true;
      if(r.unlock === 'create') alerts.create = true;
      alerts.mon = true;
      if(!quiet){ toast('⚔ สังหาร ' + god.name + ' สำเร็จ!'); celebrate(); }
      save();
    } else if(e.type === 'godLose'){
      addLog('พ่ายแพ้ต่อ ' + D.GODS[e.i].name + ' — ฝึกให้แข็งแกร่งขึ้นแล้วกลับมาใหม่');
      if(!quiet) toast('พ่ายแพ้... ต้องแข็งแกร่งกว่านี้');
    }
  }
  ev.length = 0;
  if(s.clonesLost > lastLost){
    const n = s.clonesLost - lastLost;
    lastLost = s.clonesLost;
    const now = Date.now();
    if(!quiet && now - lastDeathToast > 15000){
      lastDeathToast = now;
      toast('ร่างเงาถูกฆ่าในสนามรบ ' + fmt(n) + ' ร่าง!');
      addLog('ร่างเงาถูกศัตรูที่แข็งแกร่งกว่าฆ่า — ย้ายไปสู้ศัตรูสีเขียวเพื่อความปลอดภัย');
      alerts.mon = true;
    }
  }
}

// ---------- effects ----------
const HERO_PALETTE = { hair:'#241a3d', skin:'#e8c49a', eye:'#1a1420', armor:'#6941b3', armorLight:'#8b5cf6', gold:'#e8c76f', blade:'#fff3d0', dark:'#1c1832' };
const HERO_BLOCKS = [
  [3,0,4,1,'hair'],[2,1,6,1,'hair'],[2,2,1,3,'hair'],[7,2,1,3,'hair'],[3,2,4,3,'skin'],[3,3,1,1,'eye'],[6,3,1,1,'eye'],
  [4,5,2,1,'skin'],[2,6,6,4,'armor'],[2,7,1,1,'armorLight'],[4,6,2,1,'gold'],[2,10,6,1,'gold'],[2,11,2,4,'dark'],[6,11,2,4,'dark'],
  [2,15,2,1,'gold'],[6,15,2,1,'gold'],[1,7,1,3,'armor'],[1,10,1,1,'skin'],[8,6,1,2,'armor'],[8,4,1,2,'skin'],[7,3,3,1,'gold'],[8,0,1,3,'blade']
];
function drawPixelHero(canvas){
  const unit = 8;
  canvas.width = 10*unit; canvas.height = 16*unit;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  HERO_BLOCKS.forEach(([x,y,w,h,c])=>{ ctx.fillStyle = HERO_PALETTE[c]; ctx.fillRect(x*unit, y*unit, w*unit, h*unit); });
}

// particle bursts; the loop only runs while particles are alive and the canvas is visible
function initFX(canvas){
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MAX = 120;
  const parts = [];
  let w = 0, h = 0, running = false, last = 0;
  function resize(cw, ch){
    w = cw; h = ch;
    if(w > 0 && h > 0){ canvas.width = Math.round(w*DPR); canvas.height = Math.round(h*DPR); ctx.setTransform(DPR,0,0,DPR,0,0); }
  }
  if(window.ResizeObserver) new ResizeObserver(en=>{ const r = en[en.length-1].contentRect; resize(r.width, r.height); }).observe(canvas);
  else { const m = ()=>{ const r = canvas.getBoundingClientRect(); resize(r.width, r.height); }; window.addEventListener('resize', m); m(); }
  function frame(now){
    const dt = Math.min(.05, (now - last)/1000); last = now;
    ctx.clearRect(0, 0, w, h);
    let n = 0;
    for(let i=0;i<parts.length;i++){
      const p = parts[i];
      p.life += dt;
      if(p.life >= p.max) continue;
      const k = 1 - 2.2*dt;
      p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= k; p.vy *= k;
      const t = 1 - p.life/p.max;
      ctx.globalAlpha = t*0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r*(t+0.3), 0, 6.2832); ctx.fill();
      parts[n++] = p;
    }
    parts.length = n;
    ctx.globalAlpha = 1;
    if(n && w > 0 && !document.hidden) requestAnimationFrame(frame);
    else { running = false; ctx.clearRect(0, 0, w, h); }
  }
  return {
    burst(x, y, count, color, speed){
      if(reduced || !(w > 0)) return;
      for(let i=0;i<count && parts.length < MAX;i++){
        const a = Math.random()*Math.PI*2, v = speed*(0.4 + Math.random()*0.8);
        parts.push({ x, y, vx:Math.cos(a)*v, vy:Math.sin(a)*v, r:1.2 + Math.random()*2, life:0, max:0.4 + Math.random()*0.5, color });
      }
      if(!running){ running = true; last = performance.now(); requestAnimationFrame(frame); }
    }
  };
}
function centerOf(el){
  const a = $('arena').getBoundingClientRect(), r = el.getBoundingClientRect();
  return { x: r.left - a.left + r.width/2, y: r.top - a.top + r.height/2 };
}
function hitFx(){
  if(!fx || activeTab !== 'gods') return;
  const g = centerOf($('godArt')), h = centerOf($('heroPixel').parentNode);
  fx.burst(g.x, g.y, 6, '#ece7fb', 70);
  fx.burst(h.x, h.y, 4, '#ff6b6b', 50);
}
function celebrate(){
  const app = $('app');
  app.classList.remove('flash'); void app.offsetWidth; app.classList.add('flash');
  if(fx && activeTab === 'gods'){ const g = centerOf($('godArt')); fx.burst(g.x, g.y, 40, '#e8c76f', 150); }
}

// ---------- input ----------
function onMainClick(e){
  const b = e.target.closest('[data-act]');
  if(!b || b.disabled) return;
  const act = b.dataset.act;
  if(act === 'inc' || act === 'dec'){
    const amt = stepSize === 'all' ? Number.MAX_SAFE_INTEGER : stepSize;
    G.assign(s, b.dataset.kind, +b.dataset.i, act === 'inc' ? amt : -amt);
  } else if(act === 'step'){
    stepSize = b.dataset.v === 'all' ? 'all' : +b.dataset.v;
    renderSteps();
  } else if(act === 'clear'){
    G.unassignKind(s, b.dataset.kind);
  } else if(act === 'target'){
    G.setCreateTarget(s, b.dataset.key);
  }
  render(true);
}
function onFight(){
  if(s.fight){ G.flee(s); addLog('ถอยหนีจาก ' + D.GODS[s.gods].name); }
  else if(G.startFight(s)){ addLog('ท้าสู้ ' + D.GODS[s.gods].name + '!'); lastHits = 0; }
  render(true);
}

// ---------- save / load ----------
function save(){
  s.lastSave = Date.now();
  if(!storageOk) return;
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(s)); }catch(e){ storageOk = false; }
}
function load(){
  let raw = null;
  try{ raw = localStorage.getItem(SAVE_KEY); }catch(e){ storageOk = false; }
  if(!raw) return false;
  let parsed;
  try{ parsed = JSON.parse(raw); }catch(e){ return false; }
  s = G.sanitize(parsed);
  return true;
}
function catchUp(){
  const sec = Math.min((Date.now() - s.lastSave)/1000, G.MAX_OFFLINE_SEC);
  if(!(sec >= 10)) return;
  const d0 = G.derive(s), dp0 = s.dpTotal, lost0 = s.clonesLost;
  const ev = [];
  G.advance(s, sec, ev);
  handleEvents(ev, true);
  const d1 = G.derive(s);
  addLog('ขณะไม่อยู่ ' + fmtTime(sec) + ': พลังเทวะ +' + fmt(s.dpTotal - dp0) + ' · กาย +' + fmt(d1.phys - d0.phys) + ' · เวท +' + fmt(d1.myst - d0.myst) +
    (s.clonesLost > lost0 ? ' · ร่างเงาตาย ' + fmt(s.clonesLost - lost0) : ''));
}

// ---------- main loop ----------
// the game advances every frame (wall-clock based); a 1s timer takes over when frames stop (background tab)
const ev = [];
let lastTickAt = Date.now(), lastUiAt = 0, lastFrameAt = 0;
function tick(){
  const now = Date.now();
  const dt = (now - lastTickAt)/1000;
  lastTickAt = now;
  if(dt <= 0) return;
  if(dt > 2) G.advance(s, dt, ev); else G.step(s, dt, ev);
  handleEvents(ev, dt > 30);
}
function loop(now){
  lastFrameAt = now;
  tick();
  if(now - lastUiAt >= UI_INTERVAL_MS){ lastUiAt = now; render(true); }
  else render(false);
  requestAnimationFrame(loop);
}

function boot(saved){
  if(saved && typeof saved === 'object' && saved.v === G.SAVE_VERSION) s = G.sanitize(saved);
  else if(load()) catchUp();
  lastLost = s.clonesLost;

  buildJobs('train'); buildJobs('skill'); buildJobs('mon');
  buildCreate(); buildGods();
  renderSteps();
  drawPixelHero($('heroPixel'));
  fx = initFX($('fx'));

  $('main').addEventListener('click', onMainClick);
  $('fightBtn').addEventListener('click', onFight);
  $('autoClone').addEventListener('change', e=>{ s.create.autoClone = e.target.checked; render(true); });
  document.querySelectorAll('.tab').forEach(t=>{
    t.addEventListener('click', ()=>selectTab(t.dataset.tab));
    t.addEventListener('keydown', e=>{ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); selectTab(t.dataset.tab); } });
  });

  if(!s.log.length) addLog('เริ่มต้นเส้นทางสังหารเทพ: ร่างเงาจะถูกสร้างขึ้นเองทีละร่าง ส่งไปฝึกกายและสนามรบ แล้วท้าเทพสายฟ้าเมื่อคาดการณ์ว่าชนะ');
  if(!storageOk) addLog('เบราว์เซอร์นี้ไม่อนุญาตให้บันทึกเกม — ความคืบหน้าจะหายเมื่อปิดหน้า');
  selectTab('train');

  lastTickAt = Date.now();
  requestAnimationFrame(loop);
  setInterval(()=>{ if(performance.now() - lastFrameAt > 1500){ tick(); render(true); } }, 1000);
  setInterval(save, 10000);
  window.addEventListener('pagehide', save);
  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) save(); });
  try{ window.claude?.hot?.snapshot(() => s); }catch(e){}
}

if(window.claude?.hot?.ready) window.claude.hot.ready(data=>boot(data));
else boot(window.claude?.hot?.data);
})();
