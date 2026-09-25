// God Killer — screen and input. Game rules live in engine.js, numbers in data.js.
(function(){
'use strict';
const G = window.GK, D = G.D;
const SAVE_KEY = 'godKillerSave2';
const UI_INTERVAL_MS = 200;   // text refresh; bars move every frame
const JOB_DEFS = { train: D.TRAININGS, skill: D.SKILLS, mon: D.MONSTERS };
const GOD_COLORS = ['#7fb0ff','#ff6b6b','#b8c4cc','#e8c76f','#4fd1c5','#ff9a3c'];

let s = G.newState();
let storageOk = true;
let activeTab = 'train';
let stepSize = 1;
let logDirty = true;
let fx = null;
const alerts = {};
function clearAlerts(){ for(const k in alerts) delete alerts[k]; }
const $ = id => document.getElementById(id);

// ---------- DOM helpers: a write happens only when the value changed ----------
function setText(el, v){ v = String(v); if(el._v !== v){ el._v = v; el.textContent = v; } }
function setHTML(el, v){ if(el._h !== v){ el._h = v; el.innerHTML = v; } }
function setDisabled(el, v){ if(el.disabled !== v) el.disabled = v; }
function setShown(el, v, how){ const d = v ? (how||'block') : 'none'; if(el._d !== d){ el._d = d; el.style.display = d; } }
function setClass(el, cls, on){ if(el.classList.contains(cls) !== on) el.classList.toggle(cls, on); }
// 'on' marks the chosen button of a toggle or segmented control; mirror it for screen readers
function setOn(el, on){ setClass(el, 'on', on); if(el.getAttribute('aria-pressed') !== String(on)) el.setAttribute('aria-pressed', String(on)); }
const OS_REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
// effects off when the OS asks for less motion, or the player chose it in settings
function motionOff(){ return settings.motion === 'reduced' || (settings.motion !== 'full' && OS_REDUCED); }
// restart a one-shot CSS animation class
function replayAnim(el, cls){ el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
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
  if(settings.sci) return n.toExponential(2).replace('e+','e');
  let x = n, u = -1;
  while(x >= 1000 && u < UNITS.length-1){ x /= 1000; u++; }
  let str = x.toFixed(x < 100 ? 2 : 1);
  if(x < 100 && +str >= 100) str = x.toFixed(1);        // 99.999 -> "100.0", not "100.00"
  if(+str >= 1000){                                     // 999.99 rounds up into the next unit
    if(u >= UNITS.length-1) return n.toExponential(2).replace('e+','e');
    x /= 1000; u++; str = x.toFixed(2);
  }
  if(x >= 1000) return n.toExponential(2).replace('e+','e');
  return str + UNITS[u];
}
// ---------- power scale ----------
// stats are shown compressed (see POW_K in data.js); the engine keeps the real values
const pw = x => x > 0 ? D.POW_C * Math.pow(x, D.POW_K) : 0;          // a stat as shown
const pwM = f => Math.pow(f, D.POW_K);                               // a multiplier on a stat, as shown
const pwGain = (from, add) => pw(from + add) - pw(from);             // how much a shown stat rises when `add` is added
const pwPool = (cur, max) => max > 0 ? pw(max) * Math.max(0, cur) / max : 0;   // HP and damage: a share of the shown max
const STAT_KEYS = ['stat', 'phys', 'myst', 'battle', 'clone'];
const statM = (stat, f) => STAT_KEYS.includes(stat) ? pwM(f) : f;     // shown multiplier of a bonus to `stat`
const fmtX = f => String(+pwM(f).toFixed(2));
function fmtTime(sec){
  if(!Number.isFinite(sec)) return '—';
  if(sec < 60) return (sec < 10 ? sec.toFixed(1) : Math.round(sec)) + ' วิ';
  if(sec < 3600) return (sec/60).toFixed(1) + ' นาที';
  if(sec < 86400) return (sec/3600).toFixed(1) + ' ชม.';
  return (sec/86400).toFixed(1) + ' วัน';
}

// ---------- two-step confirm for destructive buttons ----------
// the first tap arms for 4s; the confirming tap only counts 0.4s or more later, so an accidental double-tap never confirms
const armedAt = {};
const CONFIRM_WINDOW = 4000, CONFIRM_MIN_GAP = 400;
function isArmed(id){ const t = armedAt[id]; return !!t && Date.now() - t < CONFIRM_WINDOW; }
function confirmTap(id){
  const now = Date.now(), t = armedAt[id];
  if(t && now - t < CONFIRM_WINDOW){
    if(now - t < CONFIRM_MIN_GAP) return false;
    delete armedAt[id];
    return true;
  }
  armedAt[id] = now;
  return false;
}
function disarmAll(){ for(const k in armedAt) delete armedAt[k]; }

// ---------- log & toast ----------
function addLog(msg){
  const t = new Date().toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' });
  s.log.unshift('['+t+'] '+msg);
  if(s.log.length > 60) s.log.length = 60;
  logDirty = true;
}
function renderLog(){
  logDirty = false;
  const box = $('logList');
  if(!s.log.length){ box.textContent = 'ยังไม่มีบันทึก'; return; }
  box.replaceChildren(...s.log.map(l=>{ const d = document.createElement('div'); d.textContent = l; return d; }));
}
// messages that arrive together (a god kill often brings achievements and unlocks) become one toast
let toastTimer = 0, toastQ = [], toastFlushT = 0;
function toast(msg, prio){
  toastQ.push({ msg, prio: prio || 1 });
  if(!toastFlushT) toastFlushT = setTimeout(flushToast, 150);
}
function flushToast(){
  toastFlushT = 0;
  if(!toastQ.length) return;
  toastQ.sort((a,b)=>b.prio - a.prio);
  const extra = toastQ.length - 1;
  const t = $('toast');
  t.textContent = toastQ[0].msg + (extra ? ' (+' + extra + ' เรื่องในบันทึก)' : '');
  toastQ = [];
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), extra ? 2600 : 1800);
}

// ---------- rewards text ----------
function rewardParts(i){
  const r = D.GODS[i].reward, out = [];
  if(r.unlock === 'skills') out.push('ปลดล็อก <b>การฝึกจิต</b>');
  if(r.unlock === 'create') out.push('ปลดล็อก <b>การสร้างสรรพสิ่ง</b>');
  if(r.unlock === 'gen') out.push('ปลดล็อก <b>เครื่องผลิตพลังเทวะ</b>');
  if(r.unlock === 'monuments') out.push('ปลดล็อก <b>อนุสรณ์</b>');
  if(r.unlock === 'rebirth') out.push('ปลดล็อก <b>การจุติใหม่</b>');
  if(r.unlock === 'pets') out.push('ปลดล็อก <b>สัตว์คู่กายและแดนลับ</b>');
  out.push('<b>' + D.GODS[i].gp + ' ปราณเทพ</b> เมื่อจุติใหม่');
  const monBefore = Math.min(D.MONSTERS.length, 2 + 2*i), monAfter = Math.min(D.MONSTERS.length, 2 + 2*(i+1));
  if(monAfter > monBefore) out.push('สนามรบใหม่ <b>'+(monAfter-monBefore)+' แห่ง</b>');
  if(r.maxClones) out.push('ร่างเงาสูงสุด <b>+'+r.maxClones+'</b>');
  if(r.stat) out.push('ค่าสถานะทั้งหมด <b>×'+fmtX(r.stat)+'</b>');
  if(r.clone) out.push('พลังร่างเงา <b>×'+fmtX(r.clone)+'</b>');
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
    <div class="planBar" data-r="planBar">
      <button class="miniBtn" data-act="best" data-kind="${kind}">ย้ายไปขั้นที่ดีที่สุด</button>
      <button class="miniBtn planBtn" data-act="plan" data-r="planBtn">จัดอัตโนมัติ: ปิด</button>
    </div>
    <div class="planBox" data-r="planBox">
      <div class="seg planSeg" role="group" aria-label="แผนจัดร่างเงา">${D.PLAN_PRESETS.map(p=>`<button data-act="preset" data-v="${p.key}">${p.name}</button>`).join('')}</div>
      <div class="note" data-r="planNote"></div>
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
      ? `<span class="jobName">${artHTML('monsters', i, GOD_COLORS[i % GOD_COLORS.length], sigil(d.name))}${d.name}</span><span class="jobLv pow"></span>`
      : `<span class="jobName">${artHTML(kind, i, kind === 'train' ? '#e6c275' : '#8fd6be', iconHTML(kind, i))}${d.name}</span><span class="jobLv"></span>`;
    const info = kind === 'mon'
      ? `<div class="jobSub s1"></div><div class="jobSub s2"></div>`
      : (d.desc ? `<div class="jobDesc">${d.desc}</div>` : '') + `<div class="bar thin"><i></i></div><div class="jobSub s1"></div>`;
    return `<div class="job" data-i="${i}">
        <div class="jobHead">${head}</div>
        <div class="jobBody"><div class="jobInfo">${info}</div>${ctlHTML(kind, i, d.name)}</div>
        <div class="lockTxt"></div>
      </div>`;
  }).join('');
  sec.innerHTML = toolbarHTML(kind) + '<div class="jobList">' + rows + '</div>';
  loadArt(sec);   // painted art (img/train, img/skill, img/monsters); the drawn icon stays if a file is missing
  SEC[kind] = { idle: sec.querySelector('[data-r="idle"]'), sum1: sec.querySelector('[data-r="sum1"]'),
                sum2: sec.querySelector('[data-r="sum2"]'), hint: sec.querySelector('[data-r="hint"]'),
                planBar: sec.querySelector('[data-r="planBar"]'), planBtn: sec.querySelector('[data-r="planBtn"]'),
                planBox: sec.querySelector('[data-r="planBox"]'), planNote: sec.querySelector('[data-r="planNote"]'),
                presets: [...sec.querySelectorAll('[data-act="preset"]')], seg: [...sec.querySelectorAll('[data-act="step"]')] };
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
  const free = G.idle(s), planOn = s.meta.plan.on && G.planUnlocked(s);
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
    setDisabled(ref.dec, planOn || r.n === 0);
    setDisabled(ref.inc, planOn || free === 0);
    if(kind === 'mon'){
      const rt = G.monsterRates(s, i, d);
      setText(ref.lv, 'พลัง ' + fmt(pw(defs[i].power)));
      const cls = rt.ratio >= 1 ? 'safe' : rt.ratio >= 0.5 ? 'risky' : 'deadly';
      if(ref.lv._c !== cls){ ref.lv._c = cls; ref.lv.className = 'jobLv pow ' + cls; }
      setText(ref.s1, 'ต่อตัว +' + fmt(defs[i].dp*d.m.dp) + ' DP · +' + fmt(pwGain(d.battle, defs[i].battle*d.m.battle)) + ' ค่ายุทธ์ · ปราบแล้ว ' + fmt(r.kills));
      let rate;
      if(r.n) rate = 'ปราบ ' + fmt(rt.kills) + '/วิ' + (rt.deaths ? ' · <span class="die">ร่างเงาสลาย ' + fmt(rt.deaths) + '/วิ</span>' : '');
      else if(rt.ratio >= 1) rate = 'ร่างเงาแข็งแกร่งกว่า ×' + fmt(pwM(rt.ratio)) + ' — ปลอดภัย';
      else rate = '<span class="die">ร่างเงาอ่อนกว่า (' + Math.round(pwM(rt.ratio)*100) + '%) — จะถูกสังหาร</span>';
      setHTML(ref.s2, rate);
    } else {
      const mult = kind === 'train' ? d.m.phys : d.m.myst;
      const now = Date.now();   // at most one pulse per row every 1.5s, so fast late-game levels don't strobe
      if(ref._lv !== undefined && r.lv > ref._lv && !motionOff() && !(now - ref._lvAt < 1500)){ ref._lvAt = now; replayAnim(ref.el, 'lvUp'); replayAnim(ref.lv, 'bump'); if(window.GKFX) GKFX.sparkle(ref.lv); }
      ref._lv = r.lv;
      setText(ref.lv, 'Lv.' + r.lv);
      const eta = r.n ? fmtTime((G.levelTime(defs[i], r.lv) - r.prog) / (r.n * d.m.speed)) : 'ต้องมีร่างเงาก่อน';
      setText(ref.s1, '+' + fmt(pwGain(kind==='train' ? d.phys : d.myst, defs[i].gain*mult)) + ' ' + (kind==='train' ? 'กาย' : 'จิต') + '/เลเวล · เลเวลถัดไป: ' + eta);
    }
  }
  if(!full) return;
  const sec = SEC[kind];
  setText(sec.idle, fmt(free));
  if(kind === 'train'){ setHTML(sec.sum1, 'กายรวม <b>' + fmt(pw(d.phys)) + '</b>'); setText(sec.sum2, 'ความเร็วฝึก ×' + fmt(d.m.speed)); }
  if(kind === 'skill'){ setHTML(sec.sum1, 'จิตรวม <b>' + fmt(pw(d.myst)) + '</b>'); setText(sec.sum2, 'ความเร็วฝึก ×' + fmt(d.m.speed)); }
  if(kind === 'mon'){ setHTML(sec.sum1, 'พลังร่างเงา <b>' + fmt(pw(d.clonePower)) + '</b>'); setHTML(sec.sum2, 'ค่ายุทธ์รวม <b>' + fmt(pw(d.battle)) + '</b>'); }
  setShown(sec.hint, free > 0 && !planOn);
  if(free > 0 && !planOn) setText(sec.hint, 'มีร่างเงาว่าง ' + fmt(free) + ' ร่าง — กด + เพื่อส่งไปทำงาน' + (kind==='mon' ? ' (เลือกอสูรสีเขียว ร่างเงาจะไม่สลาย)' : ''));
  const pu = G.planUnlocked(s), p = s.meta.plan;
  setShown(sec.planBar, true, 'flex');
  setShown(sec.planBtn, pu, 'inline-block');
  setText(sec.planBtn, 'จัดอัตโนมัติ: ' + (planOn ? 'เปิด' : 'ปิด'));
  setOn(sec.planBtn, planOn);
  setShown(sec.planBox, planOn);
  sec.seg.forEach(b=>setDisabled(b, planOn));
  setDisabled(sec.planBar.querySelector('[data-act="best"]'), planOn);
  if(planOn){
    sec.presets.forEach(b=>{ const pr = D.PLAN_PRESETS.find(x=>x.key===b.dataset.v); setOn(b, pr.train===p.train && pr.skill===p.skill && pr.mon===p.mon); });
    setText(sec.planNote, 'จัดร่างเงาให้อัตโนมัติทุกวินาที: ฝึกกาย ' + p.train + '% · ฝึกจิต ' + p.skill + '% · สนามรบ ' + p.mon +
      '% ลงขั้นสูงสุดและอสูรสีเขียวที่ดีที่สุด (ส่วนที่ยังใช้ไม่ได้จะไปฝึกกายแทน) · ค่านี้คงอยู่แม้จุติใหม่');
  }
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
      <div class="jobHead"><span class="jobName">${artHTML('create', i, '#e6c275', iconHTML('create', c.key))}${c.name}</span><span class="cOwn"></span></div>
      <div class="cDesc">${c.bonus ? c.desc + ' ต่อชิ้น (สูงสุด ' + c.bonus.cap + ' ชิ้น)' : c.desc + ' (ใช้เพียงเวลา)'}</div>
      <div class="cFoot"><span class="cCost"></span><button class="selBtn" data-act="target" data-key="${c.key}">เลือกสร้าง</button></div>
      <div class="lockTxt"></div>
    </div>`).join('');
  loadArt($('createList'));
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
    else if(c.cur !== c.target) note = 'กำลังสร้างวัตถุดิบให้ ' + target.name;
  } else if(c.target === 'clone'){
    note = s.clones >= d.maxClones ? (G.createUnlocked(s) ? 'ร่างเงาเต็มแล้ว — เลือกสิ่งที่จะสร้างด้านล่าง' : 'ร่างเงาเต็มแล้ว') : '';
  } else {
    const blk = dpBlocker(c.target);
    if(blk) note = 'รอพลังเทวะ ' + fmt(blk.dp) + ' เพื่อสร้าง ' + blk.name + ' (ตอนนี้มี ' + fmt(s.dp) + ')';
  }
  setText($('cCurNote'), note);
  setText($('cSpeed'), fmt(d.m.create));
  const box = $('autoClone');
  if(box.checked !== c.autoClone) box.checked = c.autoClone;
  const createOpen = G.createUnlocked(s);
  setShown($('createLock'), !createOpen);
  if(!createOpen){
    if(s.challenge === 'nocreate') setHTML($('createLock'), 'บททดสอบ "โลกไร้สรรพสิ่ง" — สร้างได้เพียงร่างเงาจนกว่าจะผ่าน');
    else setHTML($('createLock'), 'ตอนนี้สร้างได้เพียงร่างเงา — สังหาร <b>' + D.GODS[1].name + '</b> เพื่อปลดล็อกการสร้างสรรพสิ่ง');
  }
  let lockedShown = false;
  D.CREATIONS.forEach((item, i)=>{
    const ref = R.create[i];
    const open = G.creationUnlocked(s, i);
    const show = open || (createOpen && !lockedShown);
    if(!open) lockedShown = true;
    setShown(ref.el, show);
    if(!show) return;
    setClass(ref.el, 'locked', !open);
    if(!open){ setText(ref.lock, 'ปลดล็อกเมื่อสร้าง ' + D.CREATIONS[i-1].name + ' สำเร็จครั้งแรก'); return; }
    setClass(ref.el, 'active', c.target === item.key);
    setText(ref.btn, c.target === item.key ? 'เลือกอยู่' : 'เลือกสร้าง');
    if(item.key === 'clone') setText(ref.own, fmt(s.clones) + '/' + fmt(d.maxClones));
    else setText(ref.own, 'มี ' + fmt(s.own[item.key]||0) + ' · โบนัส ' + Math.min(s.made[item.key]||0, item.bonus.cap) + '/' + item.bonus.cap);
    setHTML(ref.cost, costHTML(item, d));
  });
}

// ---------- build: gods ----------
// ---------- art ----------
// Portraits are optional files at god-killer/img/<set>/<NN>.webp (list in god-killer/img/PROMPTS.md).
// Until a file exists the drawn fallback stays; each path is probed once per page load.
const artOk = {};   // path -> true once loaded, false once it failed
function artPath(set, i){ return 'god-killer/img/' + set + '/' + String(i+1).padStart(2,'0') + '.webp'; }
function sigil(name){ return '<span class="sigil">' + (name.match(/[ก-ฮ]/) || [name[0]])[0] + '</span>'; }
// drawn icons for rows without portraits (god-killer/icons.js); rows just go without if that file is missing
function iconHTML(set, k){ return window.GKICONS ? GKICONS.badge(set, k) : ''; }
function matIcon(k){ return window.GKICONS ? GKICONS.mat(k) : ''; }
function artHTML(set, i, color, fallback){ return `<span class="art" style="--c:${color}" data-art="${artPath(set, i)}">${fallback}</span>`; }
function loadArt(root){
  root.querySelectorAll('.art[data-art]').forEach(el=>{
    const p = el.dataset.art;
    if(artOk[p] === false) return;
    const img = new Image();
    img.alt = ''; img.decoding = 'async';
    img.onload = ()=>{ artOk[p] = true; el.textContent = ''; el.appendChild(img); el.classList.add('hasImg'); };
    img.onerror = ()=>{ artOk[p] = false; };
    img.src = p;
  });
}
function godSVG(i, color){
  const c = color || GOD_COLORS[i % GOD_COLORS.length];
  return `<svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
    <defs><radialGradient id="godGlow${i}" cx="50%" cy="45%" r="55%"><stop offset="0%" stop-color="${c}" stop-opacity=".55"/><stop offset="100%" stop-color="${c}" stop-opacity="0"/></radialGradient></defs>
    <circle cx="42" cy="42" r="40" fill="url(#godGlow${i})"/>
    <circle cx="42" cy="42" r="30" fill="none" stroke="${c}" stroke-width="1.2" opacity=".55"/>
    <path d="M25 31 L28 15 L35 24 L42 10 L49 24 L56 15 L59 31 Z" fill="${c}"/>
    <path d="M28 34 Q42 30 56 34 L56 50 Q42 68 28 50 Z" fill="#1a140e" stroke="${c}" stroke-width="1.5"/>
    <rect x="33" y="41" width="6" height="3" rx="1" fill="${c}"/><rect x="45" y="41" width="6" height="3" rx="1" fill="${c}"/>
    <path d="M37 55 L47 55" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
}
function buildGods(){
  $('godList').innerHTML = D.GODS.map((g,i)=>`<div class="godRow" data-i="${i}"><span class="gMark"></span><span class="gName"></span><span class="gInfo" style="margin-left:auto"></span></div>`).join('');
  R.gods = [...document.querySelectorAll('#godList .godRow')].map(el=>({ el, mark: el.querySelector('.gMark'), name: el.querySelector('.gName'), info: el.querySelector('.gInfo') }));
}
let shownArt = '', lastHits = 0;
let arenaSel = 'god';   // 'god' or the index of an ultimate being
// what the arena shows: the current fight, else the chosen opponent
function arenaTarget(){
  const f = s.fight;
  if(f) return f.kind === 'ub' ? ubTarget(f.i) : godTarget();
  if(arenaSel !== 'god' && G.ubOpen(s, arenaSel)) return ubTarget(arenaSel);
  if(s.gods < D.GODS.length) return godTarget();
  if(G.ubUnlocked(s)){ arenaSel = 0; return ubTarget(0); }
  return null;
}
function godTarget(){ const g = D.GODS[s.gods]; return { kind:'god', i:s.gods, name:g.name, hp:g.hp, atk:g.atk, def:g.def, mech:g.mech, art:'g'+s.gods }; }
function ubTarget(i){ const u = G.ubStats(s, i); return { kind:'ub', i, name:u.name + ' Lv.' + G.ubLevel(s, i), hp:u.hp, atk:u.atk, def:u.def, art:'u'+i }; }
// the god's mechanic, with a live hint during the fight (ultimate beings have none)
function renderMech(tg){
  const el = $('godMech'), m = tg.kind === 'god' ? tg.mech : null;
  setShown(el, !!m);
  if(!m) return;
  const f = s.fight, k = f ? (f.hits || 0) : 0;
  let st = '', hot = false;
  if(f){
    if(m.type === 'charge'){ const left = m.n - (k % m.n); st = left === 1 ? 'การโจมตีถัดไปจะแรง ×' + m.mul + '!' : 'อีก ' + left + ' ครั้งจะโจมตีแรง'; hot = left === 1; }
    else if(m.type === 'miss'){ const left = m.n - (k % m.n); st = left === 1 ? 'การโจมตีถัดไปของท่านจะพลาด' : 'อีก ' + left + ' ครั้งจะพลาดเป้า'; hot = left === 1; }
    else if(m.type === 'rage'){ st = k >= m.after ? 'คลั่งแล้ว! พลังโจมตี ×' + m.mul : 'จะคลั่งในอีก ' + Math.ceil((m.after - k) * D.HIT_INTERVAL) + ' วินาที'; hot = k >= m.after; }
    else if(m.type === 'revive'){ st = f.rev ? 'ใช้การฟื้นคืนไปแล้ว' : 'ยังฟื้นคืนได้อีกหนึ่งครั้ง'; hot = !f.rev; }
    else if(m.type === 'guard'){ const up = f.ghp > m.above * tg.hp; st = up ? 'เกราะยังอยู่ — ความเสียหายลดครึ่ง' : 'เกราะแตกแล้ว!'; hot = up; }
    else if(m.type === 'burn'){ st = 'ความร้อนตอนนี้ ×' + (1 + m.grow * k).toFixed(2); hot = k > 20; }
  }
  setHTML(el, '⚔ กลไก: <b>' + m.name + '</b> — ' + m.desc + (st ? '<span class="mst' + (hot ? ' hot' : '') + '">' + st + '</span>' : '') +
    (f ? '' : '<span class="mst">⚡ ฟาดฟันเทวะไม่ถูกกลไกใดขัดขวาง</span>'));
}
function fightOutlook(d, tg){
  tg = tg || arenaTarget();
  const ghp = s.fight ? s.fight.ghp : tg.hp;
  return G.outlook(s, d, tg, ghp, s.fight);
}
function buildUltimates(){
  $('ubList').innerHTML = D.ULTIMATES.map((u,i)=>`<div class="cItem" data-i="${i}">
      <div class="jobHead"><span class="jobName"><span class="petDot" style="background:${u.color}"></span>${u.name}</span><span class="jobLv"></span></div>
      <div class="cDesc"></div>
      <div class="cFoot"><span class="cCost"></span><button class="selBtn" data-act="ubSel" data-i="${i}">เลือกสู้</button></div>
      <div class="lockTxt"></div>
    </div>`).join('');
  R.ub = [...document.querySelectorAll('#ubList .cItem')].map(el=>({ el, lv: el.querySelector('.jobLv'), desc: el.querySelector('.cDesc'),
    cost: el.querySelector('.cCost'), btn: el.querySelector('.selBtn'), lock: el.querySelector('.lockTxt') }));
}
function renderGods(d, full){
  const tg = arenaTarget();
  setShown($('arenaWrap'), !!tg);
  setShown($('godsDone'), !tg);
  if(tg){
    setBar($('aHeroHp'), s.hp / d.maxHp);
    setBar($('aGodHp'), s.fight ? s.fight.ghp / tg.hp : 1);
    if(s.fight && s.fight.hits !== lastHits){ lastHits = s.fight.hits; hitFx(); }
    if(!s.fight) lastHits = 0;
    if(full){
      if(shownArt !== tg.art){
        shownArt = tg.art;
        $('godArt').innerHTML = tg.kind === 'ub'
          ? artHTML('ultimates', tg.i, D.ULTIMATES[tg.i].color, godSVG(100+tg.i, D.ULTIMATES[tg.i].color))
          : artHTML('gods', tg.i, GOD_COLORS[tg.i % GOD_COLORS.length], godSVG(tg.i));
        loadArt($('godArt'));
      }
      setHTML($('godReward'), tg.kind === 'ub'
        ? 'รางวัลเมื่อชนะ: <b>+' + D.ULTIMATES[tg.i].mp + ' บารมี</b> · เลเวลถัดไปแกร่งขึ้น ×' + fmtX(D.UB_GROWTH)
        : 'รางวัลเมื่อสังหาร: ' + rewardParts(tg.i).join(' · '));
      renderMech(tg);
      setText($('aGodName'), tg.name);
      setText($('aHeroHpTxt'), fmt(pwPool(s.hp, d.maxHp)) + ' / ' + fmt(pw(d.maxHp)));
      setText($('aGodHpTxt'), fmt(pwPool(s.fight ? s.fight.ghp : tg.hp, tg.hp)) + ' / ' + fmt(pw(tg.hp)));
      setText($('aHeroAtk'), fmt(pw(d.atk))); setText($('aHeroDef'), fmt(pw(d.def)));
      setText($('aGodAtk'), fmt(pw(tg.atk))); setText($('aGodDef'), fmt(pw(tg.def)));
      setClass($('arena'), 'fighting', !!s.fight);
      const o = fightOutlook(d, tg);
      const pred = $('predict');
      setClass(pred, 'win', o.win); setClass(pred, 'lose', !o.win);
      let txt = o.win ? 'คาดการณ์: ชนะในราว ' + fmtTime(o.secs)
        : (G.neededFactor(s, d, tg) <= 1.0001 ? 'คาดการณ์: ตอนนี้แพ้ — รอพลังชีวิตฟื้นเต็มก่อนจึงจะชนะ'
          : 'คาดการณ์: แพ้ — ต้องแข็งแกร่งขึ้นอีกราว ×' + fmt(pwM(G.neededFactor(s, d, tg))) + ' (ตอนนี้ทำดาเมจได้ ' + Math.floor(o.share*100) + '%)');
      if(!s.fight && s.hp < d.maxHp*0.999) txt += ' (พลังชีวิตยังฟื้นไม่เต็ม)';
      setText(pred, txt);
      setText($('fightLabel'), s.fight ? 'ถอยหนี' : 'ท้าสู้ ' + tg.name);
      setClass($('fightBtn'), 'flee', !!s.fight);
      renderStrike();
    }
  }
  if(full){
    const afOpen = G.autoFightUnlocked(s);
    const godsLeft = s.gods < D.GODS.length;
    setShown($('autoFightRow'), afOpen && godsLeft, 'flex');
    setShown($('autoFightLock'), !afOpen && godsLeft && s.meta.bestGods >= 1);
    if($('autoFight').checked !== s.meta.autoFight) $('autoFight').checked = s.meta.autoFight;
  }
  if(!full) return;
  D.GODS.forEach((g,i)=>{
    const ref = R.gods[i];
    const state = i < s.gods ? 'done' : i === s.gods ? 'next' : 'later';
    setShown(ref.el, i <= Math.max(s.gods, s.meta.bestGods) + 1, 'flex');   // one unknown god as a teaser, not the whole list
    setClass(ref.el, 'done', state === 'done'); setClass(ref.el, 'next', state === 'next');
    setText(ref.mark, state === 'done' ? '✓' : state === 'next' ? '⚔' : '🔒');
    setText(ref.name, state === 'later' && i >= s.meta.bestGods ? '???' : g.name);
    setText(ref.info, state === 'done' ? 'สังหารแล้ว' : state === 'next' ? 'เป้าหมายถัดไป' : '');
  });
  const ubOn = G.ubUnlocked(s);
  setShown($('ubLock'), !ubOn);
  setShown($('ubList'), ubOn, 'grid');
  setShown($('backToGod'), ubOn && arenaSel !== 'god' && s.gods < D.GODS.length && !s.fight, 'inline-block');
  if(!ubOn) return;
  let lockedShown = false;
  D.ULTIMATES.forEach((u,i)=>{
    const ref = R.ub[i], open = G.ubOpen(s, i);
    const show = open || !lockedShown;
    if(!open) lockedShown = true;
    setShown(ref.el, show);
    if(!show) return;
    setClass(ref.el, 'locked', !open);
    if(!open){ setText(ref.lock, 'ปลดล็อกเมื่อ ' + D.ULTIMATES[i-1].name + ' ถึง Lv.' + D.UB_UNLOCK_LV); return; }
    const st = G.ubStats(s, i), o = G.outlook(s, d, st, st.hp);
    setText(ref.lv, 'Lv.' + G.ubLevel(s, i));
    setText(ref.desc, 'HP ' + fmt(pw(st.hp)) + ' · โจมตี ' + fmt(pw(st.atk)) + ' · ป้องกัน ' + fmt(pw(st.def)));
    setHTML(ref.cost, '<span class="pow ' + (o.win ? 'safe' : 'deadly') + '">' + (o.win ? 'คาดว่าชนะ' : 'คาดว่าแพ้') + '</span> · ชนะได้ +' + u.mp + ' บารมี');
    const sel = arenaSel === i;
    setText(ref.btn, sel ? 'เลือกอยู่' : 'เลือกสู้');
    setDisabled(ref.btn, sel || !!s.fight);
  });
}

// ---------- temple: generator & monuments ----------
function buildTemple(){
  $('monoList').innerHTML = D.MONUMENTS.map((mo,i)=>`<div class="cItem" data-i="${i}">
      <div class="jobHead"><span class="jobName">${mo.name}</span><span class="jobLv"></span></div>
      <div class="cDesc"></div>
      <div class="cFoot"><span class="cCost"></span><button class="miniBtn maxBtn" data-act="buildMax" data-key="${mo.key}">สูงสุด</button><button class="selBtn" data-act="build" data-key="${mo.key}">สร้าง</button></div>
    </div>`).join('');
  R.mono = [...document.querySelectorAll('#monoList .cItem')].map(el=>({
    el, lv: el.querySelector('.jobLv'), desc: el.querySelector('.cDesc'), cost: el.querySelector('.cCost'), btn: el.querySelector('.selBtn'),
    max: el.querySelector('.maxBtn')
  }));
}
function bonusText(x, L, compound){
  if(x.add) return '+' + fmt(x.per*L) + ' ร่างเงาสูงสุด';
  const v = statM(x.stat, compound ? Math.pow(1 + x.per, L) : 1 + x.per*L);
  return compound ? '×' + fmt(v) : '+' + Math.round((v - 1)*100) + '%';
}
function renderTemple(d, full){
  if(!full) return;
  const cost = G.genCost(s);
  setText($('genLv'), 'Lv.' + s.gen);
  const next = D.GEN_RATE * Math.pow(D.GEN_GROWTH, s.gen) * d.m.dp;
  setText($('genRate'), (s.gen ? 'ผลิต ' + fmt(G.genRate(s, d)) + ' DP/วิ' : 'ยังไม่ได้สร้าง') + ' · เลเวลถัดไป ' + fmt(next) + ' DP/วิ');
  setText($('genBtn'), (s.gen ? 'อัปเกรด' : 'สร้างเครื่องผลิต') + ' · ' + fmt(cost) + ' DP');
  setDisabled($('genBtn'), s.dp < cost); setDisabled($('genMaxBtn'), s.dp < cost);
  const open = G.monumentsUnlocked(s);
  setShown($('monoLock'), !open);
  if(!open) setHTML($('monoLock'), s.challenge === 'nocreate' ? 'บททดสอบ "โลกไร้สรรพสิ่ง" ผนึกอนุสรณ์ไว้จนกว่าจะผ่าน'
    : 'ปลดล็อกอนุสรณ์เมื่อสังหาร <b>' + D.GODS[D.UNLOCK_AT.monuments].name + '</b>');
  setShown($('monoTitle'), open);
  setShown($('monoList'), open, 'grid');
  if(!open) return;
  D.MONUMENTS.forEach((mo,i)=>{
    const ref = R.mono[i], L = s.mono[mo.key] || 0, c = G.monumentCost(mo, L);
    const have = s.own[mo.item] || 0, itemName = G.creationByKey(mo.item).name;
    setText(ref.lv, 'Lv.' + L);
    setText(ref.desc, mo.desc + ' ต่อเลเวล' + (L ? ' · ตอนนี้ ' + bonusText(mo, L) : ''));
    setHTML(ref.cost, '<span class="' + (s.dp < c.dp ? 'short' : '') + '">DP ' + fmt(c.dp) + '</span> · <span class="' + (have < c.items ? 'short' : '') + '">' +
      itemName + ' ' + fmt(have) + '/' + fmt(c.items) + '</span>');
    setDisabled(ref.btn, !G.canBuild(s, mo)); setDisabled(ref.max, !G.canBuild(s, mo));
  });
}

// ---------- rebirth: God Power shop & achievements ----------
const ACH_LABEL = { clones:'มีร่างเงา', trainLv:'เลเวลฝึกกายรวม', skillLv:'เลเวลฝึกจิตรวม', kills:'ปราบอสูรในรอบเดียว', made:'สร้างสรรพสิ่งในรอบเดียว',
  gods:'สังหารเทพในรอบเดียว', rebirths:'จุติใหม่', dpLife:'พลังเทวะสะสมตลอดกาล', monuments:'เลเวลอนุสรณ์รวม', genLv:'เครื่องผลิต Lv.' };
function buildRebirth(){
  $('upList').innerHTML = D.UPGRADES.map((u,i)=>`<div class="cItem" data-i="${i}">
      <div class="jobHead"><span class="jobName">${u.name}</span><span class="jobLv"></span></div>
      <div class="cDesc"></div>
      <div class="cFoot"><span class="cCost"></span><button class="miniBtn maxBtn" data-act="upgradeMax" data-key="${u.key}">สูงสุด</button><button class="selBtn" data-act="upgrade" data-key="${u.key}">ซื้อ</button></div>
    </div>`).join('');
  R.up = [...document.querySelectorAll('#upList .cItem')].map(el=>({
    lv: el.querySelector('.jobLv'), desc: el.querySelector('.cDesc'), cost: el.querySelector('.cCost'), btn: el.querySelector('.selBtn'),
    max: el.querySelector('.maxBtn')
  }));
  $('achList').innerHTML = D.ACHIEVEMENTS.map(a=>`<div class="ach" data-key="${a.key}"><b>${a.name}</b><span>${ACH_LABEL[a.type]} ${fmt(a.n)}</span><div class="bar gold"><i></i></div></div>`).join('');
  R.ach = [...document.querySelectorAll('#achList .ach')].map(el=>({ el, bar: el.querySelector('.bar>i') }));
}
let rbView = 'main';
function buildPhase4(){
  $('chalList').innerHTML = D.CHALLENGES.map(c=>`<div class="cItem" data-key="${c.key}">
      <div class="jobHead"><span class="jobName">${c.name}</span><span class="jobLv"></span></div>
      <div class="note">กฎ: ${c.rule}</div>
      <div class="cDesc"></div>
      <div class="cFoot"><span class="cCost"></span><button class="selBtn" data-act="chal" data-key="${c.key}"></button></div>
    </div>`).join('');
  R.chal = [...document.querySelectorAll('#chalList .cItem')].map(el=>({ el, lv: el.querySelector('.jobLv'), desc: el.querySelector('.cDesc'),
    cost: el.querySelector('.cCost'), btn: el.querySelector('.selBtn') }));
  $('mightList').innerHTML = D.MIGHT.map(x=>`<div class="cItem">
      <div class="jobHead"><span class="jobName">${x.name}</span><span class="jobLv"></span></div>
      <div class="cDesc">${x.desc}</div>
      <div class="cFoot"><span class="cCost"></span><button class="selBtn" data-act="might" data-key="${x.key}">ซื้อ</button></div>
    </div>`).join('');
  R.might = [...document.querySelectorAll('#mightList .cItem')].map(el=>({ lv: el.querySelector('.jobLv'), desc: el.querySelector('.cDesc'), cost: el.querySelector('.cCost'), btn: el.querySelector('.selBtn') }));
}
function renderChallenges(){
  const m = s.meta;
  D.CHALLENGES.forEach((c,i)=>{
    const ref = R.chal[i], n = G.chalDone(s, c.key), maxed = n >= D.CHAL_MAX, active = s.challenge === c.key;
    setClass(ref.el, 'active', active);
    setText(ref.lv, 'ผ่านแล้ว ' + n + '/' + D.CHAL_MAX);
    setText(ref.desc, 'รางวัลต่อครั้ง: ' + c.rdesc + (n ? ' · ตอนนี้ ×' + fmt(statM(c.stat, Math.pow(1+c.per, n))) : ''));
    setText(ref.cost, maxed ? 'ผ่านครบแล้ว' : 'เป้าหมาย: สังหาร ' + D.GODS[G.chalGoal(s, c.key)].name);
    setText(ref.btn, active ? (isArmed('quit:' + c.key) ? 'แตะอีกครั้งเพื่อยอมแพ้' : 'ยอมแพ้')
                            : (isArmed('chal:' + c.key) ? 'แตะอีกครั้งเพื่อจุติ' : 'เริ่ม'));
    setDisabled(ref.btn, !active && (maxed || !!s.challenge || !G.rebirthUnlocked(s)));
  });
}
function renderMight(){
  const m = s.meta, open = G.mightUnlocked(s);
  setText($('mpTxt'), fmt(m.mp));
  setShown($('mightLock'), !open);
  D.MIGHT.forEach((x,i)=>{
    const ref = R.might[i], L = G.mightLv(s, x.key), maxed = L >= x.max, c = G.mightCost(s, x);
    setText(ref.lv, x.max === 1 ? (L ? 'มีแล้ว' : '') : 'Lv.' + L + '/' + x.max);
    if(x.key === 'legacy') setText(ref.desc, 'เริ่มรอบใหม่พร้อมพลังเทวะ ' + (L ? fmt(Math.pow(10, L+3)) + ' (เลเวลถัดไป ' + fmt(Math.pow(10, L+4)) + ')' : fmt(1e4) + ' ที่เลเวล 1'));
    setHTML(ref.cost, maxed ? 'สูงสุดแล้ว' : '<span class="' + (m.mp < c ? 'short' : '') + '">' + c + ' บารมี</span>');
    setDisabled(ref.btn, !open || maxed || m.mp < c);
  });
}
function renderRebirth(d, full){
  if(!full) return;
  ['main','chal','might','ach'].forEach(v=>setShown($('rv-'+v), v === rbView));
  document.querySelectorAll('[data-act="rbView"]').forEach(b=>setOn(b, b.dataset.v === rbView));
  if(rbView === 'chal') return renderChallenges();
  if(rbView === 'might') return renderMight();
  const m = s.meta, gain = G.rebirthGain(s);
  setText($('gpTxt'), fmt(m.gp));
  setText($('rbInfo'), 'จุติมาแล้ว ' + m.rebirths + ' ครั้ง · หากจุติตอนนี้จะได้ +' + gain + ' ปราณเทพ (จากเทพ ' + s.gods + ' องค์ที่สังหารในรอบนี้)');
  const armed = isArmed('rebirth');
  setText($('rbBtn'), !gain ? 'ต้องสังหารเทพอย่างน้อย 1 องค์ในรอบนี้' : armed ? 'แตะอีกครั้งเพื่อยืนยันการจุติ' : 'จุติใหม่ · +' + gain + ' ปราณเทพ');
  setDisabled($('rbBtn'), !gain);
  setClass($('rbBtn'), 'flee', armed);
  renderRebirthPay();
  D.UPGRADES.forEach((u,i)=>{
    const ref = R.up[i], L = m.up[u.key] || 0, c = G.upgradeCost(s, u);
    setText(ref.lv, 'Lv.' + L);
    setText(ref.desc, u.desc + ' ต่อเลเวล' + (u.add ? '' : ' (ทบต้น)') + (L ? ' · ตอนนี้ ' + bonusText(u, L, true) : ''));
    setHTML(ref.cost, '<span class="' + (m.gp < c ? 'short' : '') + '">' + c + ' ปราณเทพ</span>');
    setDisabled(ref.btn, m.gp < c); setDisabled(ref.max, m.gp < c);
  });
  const n = G.achCount(s);
  setText($('achSum'), n + '/' + D.ACHIEVEMENTS.length + ' · ค่าสถานะทั้งหมด +' + Math.round((pwM(1 + n*D.ACH_BONUS) - 1)*100) + '%');
  D.ACHIEVEMENTS.forEach((a,i)=>{
    const done = !!m.ach[a.key];
    setClass(R.ach[i].el, 'done', done);
    setBar(R.ach[i].bar, done ? 1 : G.achValue(s, a.type) / a.n);
  });
}

// ---------- pets: dungeons, pets, gear ----------
const STAT_TH = { phys:'กาย', myst:'จิต', dp:'พลังเทวะที่ได้', battle:'ค่ายุทธ์', speed:'ความเร็วฝึก', clone:'พลังร่างเงา' };
let petView = 'dg';
const dgDepthSel = {}, dgMaxSeen = {};
function petUnlockText(p){
  const u = p.unlock;
  if(u.type === 'gods') return 'เข้าร่วมเมื่อสังหารเทพได้ ' + u.n + ' องค์ในรอบเดียว';
  if(u.type === 'rebirths') return 'เข้าร่วมเมื่อจุติครบ ' + u.n + ' ครั้ง';
  return 'เข้าร่วมเมื่อปลดล็อกความสำเร็จ ' + u.n + ' รายการ';
}
function buildPets(){
  $('dgList').innerHTML = D.DUNGEONS.map((g,i)=>`<div class="cItem" data-i="${i}">
      <div class="jobHead"><span class="jobName">${artHTML('dungeons', i, GOD_COLORS[(i+2) % GOD_COLORS.length], sigil(g.name))}${g.name}</span><span class="jobLv"></span></div>
      <div class="cDesc">ได้${D.MATERIALS[g.mat]} + ค่าประสบการณ์ · รอบละ <span class="dgTime"></span></div>
      <div class="cFoot">
        <div class="ctl"><button class="ctlBtn" data-act="depth" data-i="${i}" data-d="-1" aria-label="ลดชั้น">−</button><b class="ctlN"></b><button class="ctlBtn plus" data-act="depth" data-i="${i}" data-d="1" aria-label="เพิ่มชั้น">+</button></div>
        <button class="selBtn" data-act="dgGo" data-i="${i}">สำรวจ</button>
      </div>
      <div class="note dgInfo"></div>
      <div class="lockTxt"></div>
    </div>`).join('');
  R.dg = [...document.querySelectorAll('#dgList .cItem')].map(el=>({ el, lv: el.querySelector('.jobLv'), n: el.querySelector('.ctlN'),
    dec: el.querySelector('[data-d="-1"]'), inc: el.querySelector('[data-d="1"]'), go: el.querySelector('[data-act="dgGo"]'),
    info: el.querySelector('.dgInfo'), lock: el.querySelector('.lockTxt'), time: el.querySelector('.dgTime') }));
  $('petList').innerHTML = D.PETS.map((p,i)=>`<div class="cItem" data-key="${p.key}">
      <div class="jobHead"><span class="jobName">${artHTML('pets', i, p.color, sigil(p.name))}${p.name}</span><span class="jobLv"></span></div>
      <div class="bar thin"><i></i></div>
      <div class="cDesc"></div>
      <div class="cFoot"><span class="cCost"></span><button class="selBtn" data-act="team" data-key="${p.key}"></button></div>
      <div class="lockTxt"></div>
    </div>`).join('');
  loadArt($('dgList')); loadArt($('petList'));
  R.pet = [...document.querySelectorAll('#petList .cItem')].map(el=>({ el, lv: el.querySelector('.jobLv'), bar: el.querySelector('.bar>i'),
    desc: el.querySelector('.cDesc'), cost: el.querySelector('.cCost'), btn: el.querySelector('.selBtn'), lock: el.querySelector('.lockTxt') }));
  $('gearList').innerHTML = D.GEAR.map((g,i)=>`<div class="cItem">
      <div class="jobHead"><span class="jobName">${artHTML('gear', i, '#e6c275', iconHTML('gear', g.key))}${g.name}</span><span class="jobLv"></span></div>
      <div class="cDesc"></div>
      <div class="cFoot"><span class="cCost"></span><button class="selBtn" data-act="forge" data-key="${g.key}"></button></div>
    </div>`).join('');
  loadArt($('gearList'));
  R.gear = [...document.querySelectorAll('#gearList .cItem')].map(el=>({ lv: el.querySelector('.jobLv'), desc: el.querySelector('.cDesc'),
    cost: el.querySelector('.cCost'), btn: el.querySelector('.selBtn') }));
}
function matsText(){
  return Object.keys(D.MATERIALS).map(k=>matIcon(k) + D.MATERIALS[k] + ' ' + fmt(s.meta.mats[k] || 0)).join(' · ');
}
function renderPets(d, full){
  const m = s.meta, run = m.run;
  setBar($('dgBar'), run ? run.t / G.dungeonTime(s, run.i) : 0);
  if(!full) return;
  ['dg','pets','gear'].forEach(v=>setShown($('pv-'+v), v === petView));
  document.querySelectorAll('[data-act="petView"]').forEach(b=>setOn(b, b.dataset.v === petView));
  const tp = G.teamPower(s);
  if(petView === 'dg'){
    setText($('dgCur'), run ? D.DUNGEONS[run.i].name + ' ชั้น ' + run.depth : '—');
    setText($('dgNote'), run ? 'เหลือ ' + fmtTime(G.dungeonTime(s, run.i) - run.t) + ' · โอกาสชนะ ' + Math.round(G.winChance(s, run.i, run.depth)*100) + '%'
      : (m.team.length ? 'เลือกแดนลับด้านล่างแล้วกดสำรวจ' : 'ยังไม่มีสัตว์คู่กายในทีม — จัดทีมที่แท็บย่อย "คู่หู"'));
    if($('dgAuto').checked !== m.dgAuto) $('dgAuto').checked = m.dgAuto;
    setShown($('dgStop'), !!run);
    setText($('teamPow'), 'พลังทีม ' + fmt(tp));
    setHTML($('matLine'), matsText());
    let lockedShown = false;
    D.DUNGEONS.forEach((g,i)=>{
      const ref = R.dg[i], open = G.dungeonUnlocked(s, i);
      const show = open || !lockedShown;
      if(!open) lockedShown = true;
      setShown(ref.el, show);
      if(!show) return;
      setClass(ref.el, 'locked', !open);
      if(!open){ setText(ref.lock, 'ปลดล็อกเมื่อผ่าน ' + D.DUNGEONS[i-1].name + ' ชั้น ' + D.DUNGEON_UNLOCK_DEPTH); return; }
      const maxD = G.maxDepth(s, i);
      if(dgMaxSeen[i] && dgDepthSel[i] === dgMaxSeen[i] && maxD > dgMaxSeen[i]) dgDepthSel[i] = maxD;
      dgMaxSeen[i] = maxD;
      let dep = Math.min(dgDepthSel[i] || maxD, maxD);
      dgDepthSel[i] = dep;
      const pow = G.dungeonPower(i, dep), wc = G.winChance(s, i, dep);
      setText(ref.lv, 'ผ่านได้ถึงชั้น ' + (m.dgBest[g.key] || 0) + '/' + D.MAX_DEPTH);
      setText(ref.time, fmtTime(G.dungeonTime(s, i)));
      setText(ref.n, 'ชั้น ' + dep);
      setDisabled(ref.dec, dep <= 1); setDisabled(ref.inc, dep >= maxD);
      setHTML(ref.info, 'พลังศัตรู ' + fmt(pow) + ' · <span class="' + (wc >= 1 ? 'pow safe' : wc >= 0.5 ? 'pow risky' : 'pow deadly') + '">โอกาสชนะ ' + Math.round(wc*100) + '%</span> · ชนะได้ ' + D.MATERIALS[g.mat] + ' ×' + (dep+1) + ' · exp ' + fmt(g.exp*dep));
      const cur = run && run.i === i && run.depth === dep;
      setText(ref.go, cur ? 'กำลังสำรวจ' : 'สำรวจ');
      setDisabled(ref.go, cur || !m.team.length);
    });
  } else if(petView === 'pets'){
    setDisabled($('bestTeam'), Object.keys(m.pets).length === 0);
    setText($('teamLine'), 'ทีม ' + m.team.length + '/' + D.TEAM_SIZE + ' · พลังทีม ' + fmt(tp) + ' · สัตว์คู่กายทุกตัวให้โบนัส แม้ไม่ได้อยู่ในทีม');
    D.PETS.forEach((p,i)=>{
      const ref = R.pet[i], st = m.pets[p.key];
      setClass(ref.el, 'locked', !st);
      if(!st){ setText(ref.lock, petUnlockText(p)); setText(ref.lv, ''); setShown(ref.bar.parentNode, false); setShown(ref.desc, false); setShown(ref.cost.parentNode, false); setShown(ref.lock, true); return; }
      setShown(ref.bar.parentNode, true); setShown(ref.desc, true); setShown(ref.cost.parentNode, true, 'flex'); setShown(ref.lock, false);
      const inTeam = m.team.includes(p.key);
      setClass(ref.el, 'inTeam', inTeam);
      setText(ref.lv, 'Lv.' + st.lv + (st.lv >= D.PET_MAX_LV ? ' (สูงสุด)' : ''));
      const need = G.petExpNeed(st.lv);
      setBar(ref.bar, st.lv >= D.PET_MAX_LV ? 1 : st.exp / need);
      setText(ref.desc, 'พลัง ' + fmt(G.petPower(s, p.key)) + ' · โบนัส ' + STAT_TH[p.stat] + ' ×' + fmt(statM(p.stat, Math.pow(1+p.per, st.lv-1))) + ' (ทบ ' + +((statM(p.stat, 1+p.per) - 1)*100).toFixed(1) + '%/เลเวล)');
      setText(ref.cost, st.lv >= D.PET_MAX_LV ? 'เลเวลสูงสุดแล้ว' : 'exp ' + fmt(st.exp) + '/' + fmt(need));
      setText(ref.btn, inTeam ? 'ออกจากทีม' : 'เข้าทีม');
      setDisabled(ref.btn, !inTeam && m.team.length >= D.TEAM_SIZE);
    });
  } else {
    setHTML($('matLine2'), matsText());
    D.GEAR.forEach((g,i)=>{
      const ref = R.gear[i], L = m.gear[g.key] || 0, cost = G.forgeCost(L), have = m.mats[g.mat] || 0;
      setText(ref.lv, L ? '+' + L : 'ยังไม่มี');
      setText(ref.desc, g.desc + ' ต่อเลเวล (ทบต้น)' + (L ? ' · ตอนนี้ ×' + fmt(statM(g.stat, Math.pow(1+g.per, L))) : ''));
      setHTML(ref.cost, '<span class="' + (have < cost ? 'short' : '') + '">' + matIcon(g.mat) + D.MATERIALS[g.mat] + ' ' + fmt(have) + '/' + fmt(cost) + '</span> · โอกาสสำเร็จ ' + Math.round(G.forgeChance(L)*100) + '%');
      setText(ref.btn, L ? 'ตีบวก' : 'หลอม');
      setDisabled(ref.btn, have < cost);
    });
  }
}

// ---------- tutorial & first-visit tips ----------
// each step finishes itself once its condition holds; the last one waits for the player
const TUT = [
  { tab:'train',  text:`ร่างเงาจะก่อกำเนิดขึ้นเองทีละร่าง — กด + ที่ "${D.TRAININGS[0].name}" เพื่อส่งไปฝึก (เลือก "ทั้งหมด" เพื่อส่งทุกร่างพร้อมกัน)`, done:()=>s.train.some(r=>r.n>0) || s.meta.bestGods >= 1 },
  { tab:'mon',    text:`แบ่งร่างเงาบางส่วนไปปราบ "${D.MONSTERS[0].name}" เพื่อเก็บพลังเทวะและค่ายุทธ์ — ศัตรูสีเขียวแปลว่าร่างเงาจะไม่ตาย`, done:()=>s.mon.some(r=>r.n>0) || s.meta.bestGods >= 1 },
  { tab:'train',  text:`เมื่อ${D.TRAININGS[0].name}ถึง Lv.10 จะปลดล็อก "${D.TRAININGS[1].name}" — ย้ายร่างเงาไปขั้นที่สูงกว่า เพราะได้พลังต่อเลเวลมากกว่า 6 เท่า`, done:()=>s.train[1].n>0 || s.meta.bestGods >= 1 },
  { tab:'gods',   text:`ดูบรรทัดคาดการณ์ในแท็บท้าเทพ เมื่อขึ้นว่า "ชนะ" ให้กดท้าสู้${D.GODS[0].name}`, done:()=>s.meta.bestGods >= 1 },
  { tab:'skill',  text:'ปลดล็อกการฝึกจิตแล้ว! แบ่งร่างเงาไปฝึกจิตเพื่อเสริมพลังป้องกัน — จำเป็นต่อการท้าเทพองค์ถัดไป', done:()=>s.skill.some(r=>r.n>0) || s.meta.bestGods >= 2 },
  { tab:'gods',   text:`เป้าหมายถัดไป: สังหาร${D.GODS[1].name} เพื่อปลดล็อกการสร้างสรรพสิ่ง`, done:()=>s.meta.bestGods >= 2 },
  { tab:'create', text:'ปลดล็อกการสร้างแล้ว! เลือกสร้าง "แสงสวรรค์" — ของทุกชิ้นที่สร้างไว้ให้โบนัสไปจนจบรอบ', done:()=>(s.made.light||0) > 0 || s.meta.rebirths > 0 },
  { tab:null,     text:'จบบทเรียนพื้นฐานแล้ว! ระบบใหม่จะปลดล็อกเมื่อสังหารเทพได้มากขึ้น — จุดสีทองบนแท็บหมายถึงมีสิ่งใหม่', manual:true }
];
const TIPS = {
  mon:'ร่างเงาที่อ่อนกว่าศัตรูจะตาย! ดูสีพลังของอสูร: เขียว = ปลอดภัย, เหลือง = เสี่ยง, แดง = อันตราย',
  create:'เลือกของที่ต้องการ ตัวละครจะสร้างต่อเนื่องเอง หากวัตถุดิบไม่พอจะทำวัตถุดิบให้ก่อนโดยอัตโนมัติ',
  gods:'ตัวละครสู้เอง แลกกระบวนท่ากันทุก 0.5 วินาที หากแพ้ พลังชีวิตจะฟื้นฟูเองเมื่อออกจากการต่อสู้',
  temple:'เครื่องผลิตสร้างพลังเทวะให้ตลอดเวลา · อนุสรณ์ใช้พลังเทวะและของที่สร้างไว้แลกตัวคูณ — ทั้งคู่รีเซ็ตเมื่อจุติใหม่',
  pets:'สัตว์คู่กาย อุปกรณ์ และวัตถุดิบคงอยู่ข้ามการจุติ · ส่งทีมไปแดนลับเพื่อเก็บเลเวล แล้วนำวัตถุดิบไปตีบวกอุปกรณ์',
  rebirth:'ติดเทพองค์ใดนานเกินไป ให้จุติใหม่ — ปราณเทพ (GP) ที่ได้ใช้ซื้ออัปเกรดถาวร ทำให้รอบต่อไปแข็งแกร่งขึ้นมาก'
};
function renderTutor(){
  const m = s.meta;
  while(m.tut < TUT.length && !TUT[m.tut].manual && TUT[m.tut].done()) m.tut++;
  const step = TUT[m.tut];
  const goal = !step && nextGoal();
  setShown($('tutor'), !!step || !!goal, 'flex');
  setClass($('tutor'), 'goal', !!goal);
  setShown($('tutorBtn'), !!step, 'inline-block');
  if(goal){ setText($('tutorStep'), 'เป้าหมาย'); setText($('tutorText'), goal); }
  document.querySelectorAll('.tab').forEach(t=>setClass(t, 'guide', !!step && step.tab === t.dataset.tab && activeTab !== step.tab));
  if(step){
    setText($('tutorStep'), step.manual ? '✓' : (m.tut+1) + '/' + (TUT.length-1));
    setText($('tutorText'), step.text);
    setText($('tutorBtn'), step.manual ? 'เริ่มลุย!' : 'ข้าม');
  }
  const k = activeTab, basics = ['mon','create','gods'].includes(k);
  const tip = TIPS[k] && !m.seen[k] && !tabLocked(k) && (!basics || m.tut >= TUT.length);
  setShown($('tabTip'), !!tip, 'flex');
  if(tip) setText($('tabTipText'), TIPS[k]);
}

// one line of advice after the tutorial: the next god, or when rebirth pays off
function nextGoal(){
  const d = G.derive(s), gain = G.rebirthGain(s), rb = G.rebirthUnlocked(s) && gain > 0;
  if(s.gods < D.GODS.length){
    const tg = godTarget(), o = fightOutlook(d, tg);
    if(s.fight) return 'กำลังต่อสู้กับ ' + arenaTarget().name + '...';   // may be an ultimate being, not the next god
    if(o.win) return 'พร้อมท้า ' + tg.name + ' แล้ว! ไปที่แท็บท้าเทพ (คาดว่าชนะใน ' + fmtTime(o.secs) + ')';
    const f = G.neededFactor(s, d, tg);
    let t = 'ต้องแข็งแกร่งขึ้นอีก ×' + fmt(pwM(f)) + ' เพื่อชนะ ' + tg.name;
    if(rb && f > 20) t += ' · ยังห่างอีกมาก ลองจุติใหม่ได้ +' + gain + ' ปราณเทพ';
    return t;
  }
  if(G.ubUnlocked(s)) return 'สังหารเทพครบแล้ว! ท้าสู้สิ่งสูงสุดเพื่อสั่งสมบารมี' + (rb ? ' · หรือจุติใหม่ได้ +' + gain + ' ปราณเทพ' : '');
  return '';
}

// ---------- save transfer ----------
const CODE_PREFIX = 'GK2.';
function exportCode(){ return CODE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(s)))); }
function decodeSave(code){
  code = code.trim().replace(/\s+/g, '');
  if(code.startsWith(CODE_PREFIX)) code = code.slice(CODE_PREFIX.length);
  const raw = JSON.parse(decodeURIComponent(escape(atob(code))));
  if(!raw || typeof raw !== 'object' || raw.v !== G.SAVE_VERSION) throw new Error('bad save');
  return G.sanitize(raw);
}
// swap in a whole new state and drop every cache tied to the old one
function replaceState(next){
  s = next;
  lastLost = s.clonesLost; shownArt = ''; arenaSel = 'god'; lastHits = 0;
  logDirty = true;
  disarmAll(); clearAlerts();
  if(fortune.cur){ removeFortune(fortune.cur, ''); fortune.cur = null; }   // a treasure from the old game must not pay into this one
  $('exportBox').value = '';
  lastTickAt = Date.now();
  save();
  render(true);
}
function initSaveTools(){
  const msg = t => setText($('saveMsg'), t);
  $('exportBtn').addEventListener('click', ()=>{ save(); $('exportBox').value = exportCode(); msg('สร้างโค้ดแล้ว — คัดลอกไปวางในเครื่องอื่นที่ช่อง "วางโค้ดเซฟ"'); });
  $('copyBtn').addEventListener('click', ()=>{
    const box = $('exportBox');
    save(); box.value = exportCode();   // always the current state, never a code made earlier
    const fallback = ()=>{ box.select(); try{ document.execCommand('copy'); msg('คัดลอกแล้ว'); }catch(e){ msg('คัดลอกอัตโนมัติไม่ได้ — กดค้างที่ช่องโค้ดแล้วคัดลอกเอง'); } };
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(box.value).then(()=>msg('คัดลอกแล้ว'), fallback);
    else fallback();
  });
  $('importBtn').addEventListener('click', ()=>{
    let next;
    try{ next = decodeSave($('importBox').value); }catch(e){ msg('โค้ดไม่ถูกต้อง — ตรวจดูว่าคัดลอกมาครบถ้วน'); return; }
    replaceState(next);
    $('importBox').value = '';
    addLog('โหลดเซฟจากโค้ดสำเร็จ');
    msg('โหลดเซฟสำเร็จ!');
    toast('โหลดเซฟสำเร็จ!');
  });
  $('wipeBtn').addEventListener('click', ()=>{
    if(!confirmTap('wipe')){ render(true); return; }
    replaceState(G.newState());
    addLog('เริ่มเกมใหม่ทั้งหมด — ก้าวสู่เส้นทางสังหารเทพอีกครั้ง');
    msg('ลบเซฟแล้ว เริ่มใหม่ตั้งแต่ต้น');
    selectTab('train');
  });
}

// ---------- HUD & tabs ----------
function renderHud(d, full){
  setBar($('hudHpBar'), s.hp / d.maxHp);
  if(!full) return;
  renderRealm(d);
  setText($('hudGods'), s.gods + '/' + D.GODS.length);
  const ch = s.challenge && D.CHALLENGES.find(c=>c.key===s.challenge);
  setShown($('chalBar'), !!ch);
  if(ch) setText($('chalBar'), '⚔ บททดสอบ: ' + ch.name + ' — เป้าหมาย: สังหาร ' + D.GODS[G.chalGoal(s, ch.key)].name);
  setText($('hudHp'), fmt(pwPool(s.hp, d.maxHp)) + '/' + fmt(pw(d.maxHp)));
  setText($('hudAtk'), fmt(pw(d.atk)));
  setText($('hudDef'), fmt(pw(d.def)));
  setText($('hudDp'), fmt(s.dp));
  if(window.GKFX) GKFX.watch($('hudDp'), s.dp, fmt);
  setText($('hudClones'), fmt(s.clones) + '/' + fmt(d.maxClones));
}
const TABS = ['train','skill','mon','create','temple','pets','gods','rebirth','log'];
const TAB_LOCK = { skill:['skills', ()=>G.skillsUnlocked(s)], temple:['gen', ()=>G.genUnlocked(s)], rebirth:['rebirth', ()=>G.rebirthUnlocked(s)], pets:['pets', ()=>G.petsUnlocked(s)] };
const TAB_NAME = { skill:'ฝึกจิต', temple:'เทวาลัย', rebirth:'การจุติ', pets:'คู่หู' };
function tabLocked(name){ const l = TAB_LOCK[name]; return !!l && !l[1](); }
function renderTabs(d){
  if(s.gods < D.GODS.length && !s.fight && s.hp >= d.maxHp*0.999 && fightOutlook(d, godTarget()).win) alerts.gods = true;
  document.querySelectorAll('.tab').forEach(t=>{
    const name = t.dataset.tab;
    setClass(t, 'active', name === activeTab);
    setClass(t, 'locked', tabLocked(name));
    setClass(t, 'alert', !!alerts[name] && name !== activeTab && !tabLocked(name));
  });
}
function selectTab(name){
  if(tabLocked(name)){
    const blocker = s.challenge && (name === 'skill' && s.challenge === 'nomagic');
    toast(blocker ? 'บททดสอบ "' + D.CHALLENGES.find(c=>c.key===s.challenge).name + '" ปิดการฝึกจิตไว้จนกว่าจะผ่าน'
                  : 'ปลดล็อก' + TAB_NAME[name] + 'เมื่อสังหาร ' + D.GODS[D.UNLOCK_AT[TAB_LOCK[name][0]]].name);
    return;
  }
  if(name !== activeTab) $('main').scrollTop = 0;
  activeTab = name;
  alerts[name] = false;
  TABS.forEach(t=>setShown($('tab-'+t), t === name));
  document.querySelectorAll('.tab').forEach(t=>t.setAttribute('aria-pressed', t.dataset.tab === name ? 'true' : 'false'));
  setOn($('logBtn'), name === 'log');
  if(name === 'log') renderLog();
  render(true);
}
function renderSteps(){
  document.querySelectorAll('[data-act="step"]').forEach(b=>setOn(b, String(stepSize) === b.dataset.v));
}

function render(full){
  const d = G.derive(s);
  renderHud(d, full);
  if(activeTab === 'train' || activeTab === 'skill' || activeTab === 'mon') renderJobs(activeTab, d, full);
  else if(activeTab === 'create') renderCreate(d, full);
  else if(activeTab === 'gods') renderGods(d, full);
  else if(activeTab === 'temple') renderTemple(d, full);
  else if(activeTab === 'rebirth') renderRebirth(d, full);
  else if(activeTab === 'pets') renderPets(d, full);
  else if(activeTab === 'log'){ if(logDirty) renderLog(); if(full) setText($('wipeBtn'), isArmed('wipe') ? 'แตะอีกครั้งเพื่อลบทุกอย่าง' : 'เริ่มใหม่ทั้งหมด'); }
  if(full){ renderTabs(d); renderTutor(); renderMissions(); }
}

// ---------- engine events ----------
let lastLost = 0, lastDeathToast = 0;
function handleEvents(ev, quiet){
  if(!quiet && ev.length && window.GKFX) GKFX.events(ev);
  for(const e of ev){
    if(realmEvent(e, quiet)) continue;
    if(e.type === 'rowUnlock'){
      const def = JOB_DEFS[e.kind][e.i];
      addLog('ปลดล็อก' + (e.kind === 'train' ? 'การฝึกกาย' : 'การฝึกจิต') + 'ใหม่: ' + def.name);
      alerts[e.kind] = true;
      if(!quiet){ toast('ปลดล็อกใหม่: ' + def.name); sfx('ping'); }
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
      if(r.unlock === 'gen' || r.unlock === 'monuments') alerts.temple = true;
      if(r.unlock === 'rebirth') alerts.rebirth = true;
      if(r.unlock === 'pets') alerts.pets = true;
      alerts.mon = true;
      if(!quiet){ toast(splitToast(e), 3); celebrate(); banner('⚔ สังหาร ' + god.name + '!'); sfx('win'); buzz([40,40,80]); }
      save();
    } else if(e.type === 'ach'){
      const a = D.ACHIEVEMENTS.find(x=>x.key===e.key);
      addLog('🏆 ความสำเร็จ: ' + a.name + ' (ค่าสถานะทั้งหมด +' + +((pwM(1 + D.ACH_BONUS) - 1)*100).toFixed(1) + '%)');
      alerts.rebirth = G.rebirthUnlocked(s);
      if(!quiet){ toast('🏆 ความสำเร็จ: ' + a.name); sfx('ping'); }
    } else if(e.type === 'pet'){
      const p = G.petDef(e.key);
      addLog('🐾 สัตว์คู่กายใหม่: ' + p.name + ' เข้าร่วมทีม!');
      alerts.pets = true;
      if(!quiet) toast('🐾 สัตว์คู่กายใหม่: ' + p.name, 2);
    } else if(e.type === 'dgDepth'){
      addLog('ผ่าน ' + D.DUNGEONS[e.i].name + ' ชั้น ' + e.depth + ' เป็นครั้งแรก');
    } else if(e.type === 'dgUnlock'){
      addLog('ปลดล็อกแดนลับใหม่: ' + D.DUNGEONS[e.i].name);
      alerts.pets = true;
      if(!quiet) toast('ปลดล็อกแดนลับ: ' + D.DUNGEONS[e.i].name);
    } else if(e.type === 'chalDone'){
      const c = D.CHALLENGES.find(x=>x.key===e.key);
      addLog('🏅 ผ่านบททดสอบ ' + c.name + ' ครั้งที่ ' + e.n + '! ' + c.rdesc + ' ถาวร');
      if(!quiet){ toast('🏅 ผ่านบททดสอบ: ' + c.name, 3); celebrate(); }
      save();
    } else if(e.type === 'ubWin'){
      const u = D.ULTIMATES[e.i];
      addLog('💥 ชนะ ' + u.name + ' → Lv.' + e.lv + ' ได้บารมี +' + e.mp);
      alerts.rebirth = true;
      if(!quiet){ toast('💥 ชนะ ' + u.name + '! +' + e.mp + ' บารมี', 2); celebrate(); banner('💥 ชนะ ' + u.name + '!'); sfx('win'); }
      save();
    } else if(e.type === 'ubLose'){
      addLog('พ่ายแพ้ต่อ ' + D.ULTIMATES[e.i].name + ' — ต้องแข็งแกร่งกว่านี้');
      if(!quiet){ toast('พ่ายแพ้... ต้องแข็งแกร่งกว่านี้', 2); banner('พ่ายแพ้...', true); sfx('lose'); }
    } else if(e.type === 'godLose'){
      addLog('พ่ายแพ้ต่อ ' + D.GODS[e.i].name + ' — ฝึกให้แข็งแกร่งขึ้นแล้วกลับมาใหม่');
      if(!quiet){ toast('พ่ายแพ้... ต้องแข็งแกร่งกว่านี้', 2); banner('พ่ายแพ้...', true); sfx('lose'); }
    } else if(e.type === 'mechRevive'){
      addLog('⚠ ' + D.GODS[e.i].name + ' ใช้ ' + D.GODS[e.i].mech.name + ' ฟื้นคืนพลังชีวิต!');
      if(!quiet){ toast('⚠ ' + D.GODS[e.i].mech.name + '! เทพฟื้นคืนพลังชีวิต', 2); sfx('ping'); }
    } else if(e.type === 'mechRage'){
      addLog('⚠ ' + D.GODS[e.i].name + ' คลั่ง! (' + D.GODS[e.i].mech.name + ')');
      if(!quiet){ toast('⚠ ' + D.GODS[e.i].name + ' คลั่งแล้ว! พลังโจมตี ×' + D.GODS[e.i].mech.mul, 2); sfx('ping'); }
    } else if(e.type === 'mission') onMissionDone(e, quiet);
  }
  ev.length = 0;
  if(s.clonesLost > lastLost){
    const n = s.clonesLost - lastLost;
    lastLost = s.clonesLost;
    const now = Date.now();
    if(!quiet && now - lastDeathToast > 15000){
      lastDeathToast = now;
      toast('ร่างเงาถูกสังหารในสนามรบ ' + fmt(n) + ' ร่าง!');
      addLog('ร่างเงาถูกศัตรูที่แกร่งกว่าสังหาร — ย้ายไปสู้ศัตรูสีเขียวเพื่อความปลอดภัย');
      alerts.mon = true;
    }
  }
}

// ---------- effects ----------
// Hero portrait: img/hero/01.webp when it loads, else the drawn SVG from icons.js. Keeps the #heroPixel id the hit effects use.
function drawHero(){
  const el = $('heroPixel');
  el.style.setProperty('--c', '#e8c76f'); el.dataset.art = artPath('hero', 0);
  el.innerHTML = window.GKICONS ? GKICONS.hero() : '';
  loadArt(el.parentNode);
}

// particle bursts; the loop only runs while particles are alive and the canvas is visible
function initFX(canvas){
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
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
      if(motionOff() || !(w > 0)) return;
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
  if(!fx || activeTab !== 'gods' || !s.fight) return;
  const g = centerOf($('godArt')), h = centerOf($('heroPixel').parentNode);
  fx.burst(g.x, g.y, 6, '#ede3cc', 70);
  fx.burst(h.x, h.y, 4, '#ff6b6b', 50);
  sfx('hit');
  if(!motionOff()){ replayAnim($('godArt'), 'hitFlash'); replayAnim($('heroPixel').parentNode, 'hurtFlash'); }
  const d = G.derive(s), tg = G.fightTarget(s, s.fight);
  floatDmg(g, pwPool(G.blow(d.atk, tg.def), tg.hp), 'dealt');
  floatDmg(h, pwPool(G.blow(tg.atk, d.def), d.maxHp), 'taken');
}
// short-lived damage number; transform/opacity animation only, removed when it ends
function floatDmg(pos, v, cls){
  if(motionOff()) return;
  const el = document.createElement('span');
  el.className = 'dmg ' + cls;
  el.textContent = '-' + fmt(v);
  el.style.left = pos.x + 'px'; el.style.top = (pos.y - 20) + 'px';
  $('arena').appendChild(el);
  setTimeout(()=>el.remove(), 800);
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
  } else if(act === 'build'){
    const mo = D.MONUMENTS.find(x=>x.key===b.dataset.key);
    if(G.buildMonument(s, b.dataset.key)){ addLog('สร้าง ' + mo.name + ' เป็น Lv.' + s.mono[mo.key]); toast(mo.name + ' Lv.' + s.mono[mo.key]); }
  } else if(act === 'buildMax'){
    const mo = D.MONUMENTS.find(x=>x.key===b.dataset.key), n = G.buildMonumentMax(s, b.dataset.key);
    if(n){ addLog('ยกระดับ ' + mo.name + ' +' + n + ' เลเวล เป็น Lv.' + s.mono[mo.key]); toast(mo.name + ' Lv.' + s.mono[mo.key]); }
  } else if(act === 'upgradeMax'){
    const u = D.UPGRADES.find(x=>x.key===b.dataset.key), n = G.buyUpgradeMax(s, b.dataset.key);
    if(n){ addLog('อัปเกรดถาวร ' + u.name + ' +' + n + ' เลเวล เป็น Lv.' + s.meta.up[u.key]); save(); }
  } else if(act === 'plan'){
    G.togglePlan(s, !s.meta.plan.on);
    addLog('จัดร่างเงาอัตโนมัติ: ' + (s.meta.plan.on ? 'เปิด' : 'ปิด'));
    save();
  } else if(act === 'preset'){
    G.setPlan(s, b.dataset.v); save();
  } else if(act === 'best'){
    if(!G.moveToBest(s, b.dataset.kind)) toast(b.dataset.kind === 'mon' ? 'ยังไม่มีศัตรูที่ร่างเงาสู้ได้อย่างปลอดภัย' : 'ยังไม่มีขั้นที่ฝึกได้');
  } else if(act === 'rbView'){
    rbView = b.dataset.v;
  } else if(act === 'ubSel'){
    arenaSel = +b.dataset.i;
    $('main').scrollTop = 0;
  } else if(act === 'might'){
    const x = D.MIGHT.find(y=>y.key===b.dataset.key);
    if(G.buyMight(s, x.key)){ addLog('บารมี: ' + x.name + (x.max > 1 ? ' Lv.' + G.mightLv(s, x.key) : '')); save(); }
  } else if(act === 'chal'){
    const key = b.dataset.key, c = D.CHALLENGES.find(x=>x.key===key);
    if(s.challenge === key){
      if(confirmTap('quit:' + key)){ G.abandonChallenge(s); addLog('ถอนตัวจากบททดสอบ ' + c.name + ' — ยกเลิกกฎพิเศษ รอบนี้เล่นต่อตามปกติ'); }
    }
    else if(confirmTap('chal:' + key)){
      const gain = G.rebirthGain(s);
      if(G.startChallenge(s, key)){
        rebirthFx();
        lastLost = s.clonesLost; shownArt = ''; arenaSel = 'god'; clearAlerts();
        addLog('⚔ เริ่มบททดสอบ ' + c.name + (gain ? ' (ได้ ' + gain + ' ปราณเทพ)' : ''));
        toast('เริ่มบททดสอบ: ' + c.name); save();
        if(gain) showRebirthCard(gain);
      }
    }
  } else if(act === 'petView'){
    petView = b.dataset.v;
  } else if(act === 'depth'){
    const i = +b.dataset.i;
    dgDepthSel[i] = Math.max(1, Math.min(G.maxDepth(s, i), (dgDepthSel[i] || G.maxDepth(s, i)) + (+b.dataset.d)));
  } else if(act === 'dgGo'){
    const i = +b.dataset.i;
    if(G.startDungeon(s, i, dgDepthSel[i] || G.maxDepth(s, i))) addLog('ส่งทีมสำรวจ ' + D.DUNGEONS[i].name + ' ชั้น ' + s.meta.run.depth);
  } else if(act === 'team'){
    G.toggleTeam(s, b.dataset.key);
  } else if(act === 'bestTeam'){
    s.meta.team = Object.keys(s.meta.pets).sort((a,b2)=>G.petPower(s, b2) - G.petPower(s, a)).slice(0, D.TEAM_SIZE);
    addLog('จัดทีมสัตว์คู่กายที่แกร่งที่สุด: ' + s.meta.team.map(k=>G.petDef(k).name).join(', '));
  } else if(act === 'forge'){
    const g = D.GEAR.find(x=>x.key===b.dataset.key), L = s.meta.gear[g.key] || 0;
    const ok = G.forge(s, g.key);
    if(ok === true){ addLog((L ? 'ตีบวก ' : 'สร้าง ') + g.name + ' สำเร็จ! +' + s.meta.gear[g.key]); toast(g.name + ' +' + s.meta.gear[g.key]); }
    else if(ok === false){ addLog('ตีบวก ' + g.name + ' ล้มเหลว วัตถุดิบสูญหาย'); toast('ตีบวกล้มเหลว!'); }
    save();
  } else if(act === 'upgrade'){
    const u = D.UPGRADES.find(x=>x.key===b.dataset.key);
    if(G.buyUpgrade(s, b.dataset.key)){ addLog('อัปเกรดถาวร ' + u.name + ' เป็น Lv.' + s.meta.up[u.key]); save(); }
  }
  if(/^(build|upgrade|buildMax|upgradeMax|might|forge|target|inc)$/.test(act)) sfx('buy');
  render(true);
}
function onGenMax(){
  const n = G.upgradeGenMax(s);
  if(n){ addLog('เครื่องผลิตพลังเทวะ +' + n + ' เลเวล เป็น Lv.' + s.gen); render(true); }
}
function onGen(){
  if(G.upgradeGen(s)){ addLog('เครื่องผลิตพลังเทวะ Lv.' + s.gen); render(true); }
}
function onRebirth(){
  const gain = G.rebirthGain(s);
  if(!gain) return;
  if(!confirmTap('rebirth')){ render(true); return; }
  G.rebirth(s);
  lastLost = s.clonesLost; shownArt = ''; arenaSel = 'god'; clearAlerts();
  addLog('🔄 จุติใหม่ครั้งที่ ' + s.meta.rebirths + ' — ได้รับ ' + gain + ' ปราณเทพ');
  celebrate(); rebirthFx();
  save();
  selectTab('rebirth');
  showRebirthCard(gain);
}
function onFight(){
  const tg = arenaTarget();
  if(s.fight){ G.flee(s); addLog('ถอยออกจาก ' + (tg ? tg.name : 'การต่อสู้')); }
  else if(tg && (tg.kind === 'ub' ? G.startUbFight(s, tg.i) : G.startFight(s))){ addLog('ท้าสู้ ' + tg.name + '!'); lastHits = 0; }
  render(true);
}

// ---------- keyboard & mouse (desktop / tablet) ----------
let tabBeforeLog = 'train';
function toggleLog(){
  if(activeTab === 'log') return selectTab(tabLocked(tabBeforeLog) ? 'train' : tabBeforeLog);
  tabBeforeLog = activeTab;
  selectTab('log');
}
const HUD_TIPS = {
  hudHp:'พลังชีวิต — ลดลงเมื่อสู้กับเทพ และฟื้นฟูเองเมื่อพักรบ · เพิ่มได้จากกาย จิต และค่ายุทธ์',
  hudAtk:'พลังโจมตี — ความเสียหายที่ทำต่อเทพในแต่ละครั้ง · มาจากกาย (ฝึกกาย) และค่ายุทธ์ (สนามรบ)',
  hudDef:'พลังป้องกัน — ลดความเสียหายที่ได้รับจากเทพ · มาจากจิต (ฝึกจิต) และค่ายุทธ์ (สนามรบ)',
  hudDp:'พลังเทวะ (DP) — ได้จากสนามรบและเครื่องผลิต · ใช้สร้างสรรพสิ่ง อัปเกรดเครื่องผลิต และสร้างอนุสรณ์',
  hudClones:'ร่างเงาที่มี / สูงสุด — ส่งไปฝึกกาย ฝึกจิต หรือออกสนามรบ · สร้างเพิ่มได้ที่แท็บสร้าง',
  hudGods:'เทพที่สังหารแล้วในรอบนี้ / ทั้งหมด'
};
const KEY_HELP = [
  ['1 – 8', 'เปิดแท็บตามลำดับ (ฝึกกาย … จุติ)'],
  ['L', 'เปิด/ปิดบันทึกและเซฟ'],
  ['F / Space', 'ท้าสู้หรือถอยหนี (ในแท็บท้าเทพ)'],
  ['S', 'ใช้ฟาดฟันเทวะระหว่างต่อสู้'],
  ['H', 'เปิด/ปิดวิธีเล่น'],
  ['[ ]', 'สลับหน้าย่อย (คู่หู · จุติ)'],
  ['Esc', 'ยกเลิกปุ่มที่รอยืนยัน / ปิดบันทึก'],
  ['?', 'เปิด/ปิดหน้านี้']
];
function kbd(k){ const e = document.createElement('kbd'); e.className = 'kHint'; e.textContent = k; e.setAttribute('aria-hidden', 'true'); return e; }
function helpOpen(){ return $('keyHelp').classList.contains('open'); }
function showHelp(on){
  const box = $('keyHelp');
  setClass(box, 'open', on);
  if(on){ box._ret = document.activeElement; box.querySelector('.khBox').focus(); }
  else if(box._ret && box._ret.focus) box._ret.focus();
}
function buildHelp(){
  const box = document.createElement('div');
  box.id = 'keyHelp';
  box.innerHTML = `<div class="khBox" role="dialog" aria-modal="true" aria-labelledby="khTitle" tabindex="-1">
      <div class="row"><b id="khTitle">ปุ่มลัดคีย์บอร์ด</b><button class="miniBtn" id="khClose">ปิด</button></div>
      <div class="khList">${KEY_HELP.map(([k,t])=>`<div class="khRow"><span class="khKeys">${k.split(' ').map(x=>/^[–\/]$/.test(x) ? x : '<kbd>'+x+'</kbd>').join(' ')}</span><span>${t}</span></div>`).join('')}</div>
      <div class="note">ปุ่มลัดไม่ทำงานขณะพิมพ์ในช่องข้อความ</div>
    </div>`;
  document.body.appendChild(box);
  box.addEventListener('click', e=>{ if(e.target === box || e.target.id === 'khClose') showHelp(false); });
}
function cycleSubView(dir){
  const seg = document.querySelector('#tab-' + activeTab + ' .subSeg');
  if(!seg) return false;
  const btns = [...seg.querySelectorAll('button')].filter(b=>!b.disabled && b.offsetParent);
  if(!btns.length) return false;
  const cur = btns.findIndex(b=>b.classList.contains('on'));
  btns[((cur < 0 ? 0 : cur) + dir + btns.length) % btns.length].click();
  return true;
}
function onKey(e){
  const t = e.target;
  // a held Enter repeats clicks after ~0.5s, which would pass the two-tap confirm on its own
  if(e.repeat && e.key === 'Enter' && t && t.closest && t.closest('#rbBtn,#wipeBtn,[data-act="chal"]')){ e.preventDefault(); return; }
  if(e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  if(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  // shortcuts act on the page behind, so they wait while a dialog is open; Esc (and H for the guide) still close it
  const dlg = document.querySelector('#guide.open,#settings.open,#welcome');
  if(dlg){
    if(dlg.id === 'guide' && (e.key === 'Escape' || e.code === 'KeyH')){ e.preventDefault(); showGuide(false); }
    else if(dlg.id === 'settings' && e.key === 'Escape'){ e.preventDefault(); showSettings(false); }
    return;
  }
  const help = e.key === '?' || (e.code === 'Slash' && e.shiftKey);
  if(help){ e.preventDefault(); showHelp(!helpOpen()); return; }
  if(helpOpen()){ if(e.key === 'Escape'){ e.preventDefault(); showHelp(false); } return; }
  if(e.key === 'Escape'){
    const armed = Object.keys(armedAt).some(isArmed);
    if(armed){ disarmAll(); render(true); }
    else if(activeTab === 'log') toggleLog();
    else return;
    e.preventDefault(); return;
  }
  if(e.shiftKey) return;
  // e.code keeps shortcuts working on a Thai keyboard layout
  const digit = /^(?:Digit|Numpad)([1-8])$/.exec(e.code);
  if(digit){
    const tab = document.querySelectorAll('#tabs .tab')[+digit[1]-1];
    if(tab){ e.preventDefault(); selectTab(tab.dataset.tab); }
    return;
  }
  if(e.code === 'KeyL'){ e.preventDefault(); toggleLog(); return; }
  if(e.code === 'KeyS' && activeTab === 'gods' && s.fight){ e.preventDefault(); if(!e.repeat) onStrike(); return; }
  if(e.code === 'KeyH'){ e.preventDefault(); showGuide(!($('guide') && $('guide').classList.contains('open'))); return; }
  if(e.code === 'BracketLeft' || e.code === 'BracketRight'){ if(cycleSubView(e.code === 'BracketLeft' ? -1 : 1)) e.preventDefault(); return; }
  const space = e.code === 'Space';
  if((e.code === 'KeyF' || space) && activeTab === 'gods'){
    // Space on a visible control keeps its normal meaning, except on the gods tab button itself
    const ctl = t && t.closest && t.closest('button,[role="button"],a,summary,label');
    if(space && ctl && ctl.offsetParent && !(ctl.classList.contains('tab') && ctl.dataset.tab === 'gods')) return;
    const b = $('fightBtn');
    e.preventDefault();
    if(e.repeat || !b.offsetParent || b.disabled) return;
    b.click();
  }
}
function initPlatform(){
  document.querySelectorAll('#tabs .tab').forEach((t,i)=>{ t.appendChild(kbd(String(i+1))); t.title = t.textContent.trim().replace(/\d$/, '') + ' (' + (i+1) + ')'; });
  $('fightBtn').appendChild(kbd('F'));
  $('logBtn').title = 'บันทึกและเซฟ (L)';
  for(const id in HUD_TIPS){ const el = $(id); const host = el && (el.closest('.chip,.hpRow,.godCount') || el); if(host) host.title = HUD_TIPS[id]; }
  buildHelp();
  const kb = document.createElement('button');
  kb.className = 'logBtn keyBtn'; kb.id = 'keyBtn'; kb.textContent = '?';
  kb.title = 'ปุ่มลัดคีย์บอร์ด (?)'; kb.setAttribute('aria-label', 'ปุ่มลัดคีย์บอร์ด');
  kb.addEventListener('click', ()=>showHelp(true));
  $('logBtn').after(kb);
  document.addEventListener('keydown', onKey);
}

// ---------- sound: tiny synthesized effects, remembered on/off ----------
const SETTINGS_KEY = 'godKillerSettings';
const SETTINGS_DEFAULT = { sound:true, vol:0.8, vibrate:true, sci:false, motion:'auto' };
const settings = (()=>{ try{ return Object.assign({}, SETTINGS_DEFAULT, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); }catch(e){ return Object.assign({}, SETTINGS_DEFAULT); } })();
function saveSettings(){ try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }catch(e){} }
let actx = null, lastSfx = {};
function tone(f, dur, type, vol, f2, delay){
  const t = actx.currentTime + (delay || 0), o = actx.createOscillator(), g = actx.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
  if(f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(Math.max(0.0001, vol * settings.vol), t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
}
const SFX = {
  hit:    ()=>tone(160, 0.06, 'square', 0.025, 90),
  strike: ()=>{ tone(220, 0.25, 'sawtooth', 0.07, 55); tone(880, 0.18, 'triangle', 0.05, 1320, 0.02); },
  win:    ()=>[523, 659, 784, 1047].forEach((f,i)=>tone(f, 0.28, 'triangle', 0.07, 0, i*0.1)),
  lose:   ()=>tone(300, 0.5, 'sawtooth', 0.05, 90),
  ping:   ()=>tone(988, 0.15, 'sine', 0.05, 1480),
  buy:    ()=>tone(660, 0.08, 'triangle', 0.04, 880)
};
const SFX_GAP = { hit:150, ping:300, buy:80 };
function sfx(name){
  if(!settings.sound || document.hidden) return;
  const now = performance.now();
  if(now - (lastSfx[name] || 0) < (SFX_GAP[name] || 60)) return;
  lastSfx[name] = now;
  try{
    if(!actx){ const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return; actx = new AC(); }
    if(actx.state === 'suspended') actx.resume();
    SFX[name]();
  }catch(e){}
}
function renderSoundBtn(){ const b = $('soundBtn'); b.textContent = settings.sound ? '🔊' : '🔇'; b.title = settings.sound ? 'ปิดเสียง' : 'เปิดเสียง'; b.setAttribute('aria-pressed', String(settings.sound)); }

// before the first tap the browser blocks vibration and logs a console error (auto-fight or a tribulation can buzz first)
function buzz(ms){ if(settings.vibrate && navigator.vibrate && !(navigator.userActivation && !navigator.userActivation.hasBeenActive)) try{ navigator.vibrate(ms); }catch(e){} }
function applyMotion(){ document.documentElement.dataset.motion = motionOff() ? 'reduced' : 'full'; }
function showSettings(on){
  let box = $('settings');
  if(!box){
    box = document.createElement('div');
    box.id = 'settings'; box.className = 'modal';
    box.innerHTML = `<div class="gBox" role="dialog" aria-modal="true" aria-labelledby="stTitle" tabindex="-1">
        <div class="row"><b id="stTitle">⚙ ตั้งค่า</b><button class="miniBtn" data-close>ปิด</button></div>
        <label class="stRow"><span>เสียงประกอบ</span><input type="checkbox" data-set="sound"></label>
        <label class="stRow"><span>ความดังเสียง</span><input type="range" min="0" max="1" step="0.05" data-set="vol"></label>
        <label class="stRow"><span>สั่นเมื่อมีเหตุการณ์สำคัญ (มือถือ)</span><input type="checkbox" data-set="vibrate"></label>
        <label class="stRow"><span>รูปแบบตัวเลข</span><select data-set="sci"><option value="0">ย่อ (1.5M, 2.3B)</option><option value="1">วิทยาศาสตร์ (1.50e6)</option></select></label>
        <label class="stRow"><span>แอนิเมชัน</span><select data-set="motion"><option value="auto">ตามเครื่อง</option><option value="full">เต็มที่</option><option value="reduced">ลดน้อยลง</option></select></label>
        <div class="btnPair"><button class="miniBtn" data-open="guide">📖 วิธีเล่น</button><button class="miniBtn" data-open="keys">⌨ ปุ่มลัด</button></div>
        <div class="note">การตั้งค่าเก็บแยกจากเซฟเกม จึงไม่หายเมื่อจุติใหม่หรือโหลดเซฟ</div>
      </div>`;
    document.body.appendChild(box);
    box.addEventListener('click', e=>{
      if(e.target === box || e.target.hasAttribute('data-close')){ showSettings(false); return; }
      const o = e.target.dataset && e.target.dataset.open;
      if(o){ showSettings(false); if(o === 'guide') showGuide(true); else showHelp(true); }
    });
    box.addEventListener('keydown', e=>{ if(e.key === 'Escape'){ e.stopPropagation(); showSettings(false); } });
    box.addEventListener('input', e=>{
      const k = e.target.dataset.set;
      if(!k) return;
      const el = e.target;
      settings[k] = el.type === 'checkbox' ? el.checked : k === 'vol' ? +el.value : k === 'sci' ? el.value === '1' : el.value;
      saveSettings(); renderSoundBtn(); applyMotion();
      if(k === 'vol' || k === 'sound') sfx('ping');
      if(k === 'vibrate' && settings.vibrate) buzz(30);
      render(true);
    });
  }
  box.querySelectorAll('[data-set]').forEach(el=>{
    const v = settings[el.dataset.set];
    if(el.type === 'checkbox') el.checked = !!v; else el.value = el.dataset.set === 'sci' ? (v ? '1' : '0') : String(v);
  });
  setClass(box, 'open', on);
  if(on){ box._ret = document.activeElement; box.querySelector('.gBox').focus(); }
  else if(box._ret && box._ret.focus) box._ret.focus();
}
function rebirthFx(){
  if(motionOff()) return;
  let o = $('rbFx');
  if(!o){ o = document.createElement('div'); o.id = 'rbFx'; o.setAttribute('aria-hidden', 'true'); document.body.appendChild(o); }
  replayAnim(o, 'show');
  if(window.GKFX) GKFX.rebirth();
}

// ---------- big moments: victory / defeat banner ----------
function banner(text, lose){
  if(motionOff() && lose) return;
  let b = $('banner');
  if(!b){ b = document.createElement('div'); b.id = 'banner'; b.setAttribute('aria-hidden', 'true'); document.body.appendChild(b); }
  b.textContent = text;
  setClass(b, 'lose', !!lose);
  replayAnim(b, 'show');
}

// ---------- active strike ----------
function onStrike(){
  const dmg = G.strike(s);
  if(!dmg) return;
  sfx('strike'); buzz(25);
  if(fx && activeTab === 'gods'){
    const g = centerOf($('godArt'));
    fx.burst(g.x, g.y, 24, '#ffd66b', 130);
    if(window.GKFX) GKFX.shake($('arena'));
    if(!motionOff()){ const el = document.createElement('span'); el.className = 'dmg big'; el.textContent = '⚡-' + fmt(pwPool(dmg, arenaTarget().hp)); el.style.left = g.x + 'px'; el.style.top = (g.y - 34) + 'px'; $('arena').appendChild(el); setTimeout(()=>el.remove(), 800); }
  }
  render(true);
}
function renderStrike(){
  const b = $('strikeBtn');
  setShown(b, !!s.fight);
  if(!s.fight) return;
  const w = G.strikeWait(s);
  setDisabled(b, w > 0);
  setText($('strikeLabel'), w > 0 ? '⚡ ฟาดฟันเทวะ (รออีก ' + Math.ceil(w) + ' วิ)' : '⚡ ฟาดฟันเทวะ! (S)');
}

// ---------- how-to-play guide ----------
function guideSections(){
  const god = k => D.GODS[D.UNLOCK_AT[k]].name;
  return [
    ['เป้าหมายของเกม', `<p>ก้าวข้ามขีดจำกัดมนุษย์ แล้วสังหารเทพทั้ง ${D.GODS.length} องค์ ตั้งแต่ ${D.GODS[0].name} ไปจนถึง ${D.GODS[D.GODS.length-1].name} ทุกองค์ที่ล้มลงจะเปิดวิชาและระบบใหม่ ทำให้ท่านแกร่งกล้าขึ้นอีกขั้น</p>`],
    ['ร่างเงา', `<p>ร่างเงาจะก่อกำเนิดขึ้นเองทีละร่าง (ดูที่แท็บสร้าง) ส่งไปฝึกหรือออกรบด้วยปุ่ม <b>+</b> เลือก ×1, ×10, ×100 หรือ "ทั้งหมด" เพื่อส่งทีละหลายร่าง บนมือถือกดค้างที่ + เพื่อส่งต่อเนื่อง</p>`],
    ['ฝึกกาย / ฝึกจิต', `<p>ฝึกกายเสริม <b>พลังโจมตี</b> ฝึกจิตเสริม <b>พลังป้องกัน</b> ขั้นถัดไปจะเปิดเมื่อขั้นก่อนหน้าถึง Lv.${D.ROW_UNLOCK_LEVEL} และให้พลังมากกว่าเดิมหลายเท่า จึงควรย้ายร่างเงาไปขั้นสูงสุดเสมอ (ปุ่ม "ย้ายไปขั้นที่ดีที่สุด")</p><p>ฝึกจิตจะเปิดเมื่อสังหาร ${god('skills')}</p>`],
    ['สนามรบ', `<p>ส่งร่างเงาไปปราบอสูรเพื่อเก็บ <b>พลังเทวะ (DP)</b> และค่ายุทธ์ ดูสีพลังของศัตรูก่อนส่ง:</p><ul><li><b style="color:var(--ok)">เขียว</b> ปลอดภัย</li><li><b style="color:var(--warn)">เหลือง</b> ร่างเงาบางส่วนจะล้มตาย</li><li><b style="color:var(--danger)">แดง</b> ร่างเงาล้มตายอย่างรวดเร็ว</li></ul>`],
    ['การสร้าง', `<p>เลือกสิ่งที่ต้องการสร้าง แล้วตัวละครจะหลอมวัตถุดิบที่ขาดให้เอง ทุกชิ้นที่สร้างไว้ให้โบนัสไปจนจบรอบ ปลดล็อกเมื่อสังหาร ${god('create')} และเกมจะจำสิ่งที่เลือกไว้แม้จุติใหม่</p>`],
    ['ขอบเขตบำเพ็ญ', `<p>ทุกเลเวลฝึกกายและฝึกจิตสะสมเป็นปราณ ขั้นย่อยจะขยับขึ้นเอง ${D.REALM_STAGES} ขั้นต่อขอบเขต เมื่อถึงยอดขอบเขต ปุ่ม <b>⚡ ฝ่าทัณฑ์สวรรค์</b> จะปรากฏใต้ชื่อเกม ผ่านได้เมื่อรับสายฟ้าทั้ง ${D.TRIB_BOLTS} สายไหว (ป้องกันและพลังชีวิตยิ่งสูงยิ่งปลอดภัย) ทะลวงแล้วค่าสถานะทั้งหมด ×${fmtX(D.REALM_STAT)} ต่อขอบเขต หากล้มเหลวปราณไม่หาย รอ ${D.TRIB_COOLDOWN} วินาทีแล้วลองใหม่</p>`],
    ['ภารกิจสำนัก', `<p>ภารกิจสั้น ๆ 3 ข้ออยู่ใต้แถบสถานะเสมอ (บนคอมพิวเตอร์อยู่ใต้เมนู) แตะภารกิจเพื่อไปยังแท็บที่ต้องทำ ทำสำเร็จแล้วรับรางวัลทันที และภารกิจใหม่จะเข้ามาแทน ช่วงแรกเป็นภารกิจนำทางที่สอนระบบทีละขั้น</p>`],
    ['โชควาสนา', `<p>หลังสังหารเทพองค์แรก สมบัติวิญญาณจะปรากฏบนจอเป็นระยะขณะเปิดเกมอยู่ แตะก่อนมันสลายไปใน ${D.FORTUNE.life} วินาที <b>ผลท้อเซียน</b> ให้พลังเทวะ <b>คัมภีร์ลับ</b> เร่งการฝึก ×${D.FORTUNE.boostMult} <b>เม็ดยาทิพย์</b> เร่งการสร้าง เก็บต่อเนื่องได้รางวัลเพิ่มขึ้น</p>`],
    ['ท้าเทพ', `<p>ดูบรรทัด <b>คาดการณ์</b> เมื่อขึ้นว่า "ชนะ" ก็กดท้าสู้ได้ ระหว่างสู้กด <b>⚡ ฟาดฟันเทวะ</b> เพื่อปล่อยการโจมตีรุนแรง (ใช้ได้ทุก ${D.STRIKE_CD} วินาที) หากพ่ายแพ้ พลังชีวิตจะฟื้นคืนเองเมื่อออกจากการต่อสู้</p><p>เทพแต่ละองค์มี <b>กลไกพิเศษ</b> ของตัวเอง เช่น ผ่าสายฟ้าแรงเป็นจังหวะ ฟื้นคืนชีพหนึ่งครั้ง หรือคลั่งเมื่อสู้นาน ดูได้ใต้ภาพเทพ และระหว่างสู้จะบอกจังหวะให้เห็น บรรทัดคาดการณ์คิดกลไกไว้ให้แล้ว ส่วน ⚡ ฟาดฟันเทวะไม่ถูกกลไกใดขัดขวาง</p>`],
    ['เทวาลัย', `<p><b>เครื่องผลิต</b> หลั่งพลังเทวะให้ตลอดเวลา (ปลดล็อกเมื่อสังหาร ${god('gen')}) · <b>อนุสรณ์</b> ใช้พลังเทวะกับของที่สร้างไว้แลกตัวคูณ (ปลดล็อกเมื่อสังหาร ${god('monuments')}) ทั้งสองอย่างรีเซ็ตเมื่อจุติใหม่ ปุ่ม "สูงสุด" จะซื้อรวดเดียวจนทรัพยากรหมด</p>`],
    ['จุติใหม่และปราณเทพ', `<p>ปลดล็อกเมื่อสังหาร ${god('rebirth')} การจุติใหม่จะเริ่มรอบใหม่ แต่ได้ <b>ปราณเทพ (GP)</b> ตามจำนวนเทพที่สังหารในรอบนั้น ใช้ซื้ออัปเกรดถาวร หากแถบเป้าหมายบอกว่า "ยังห่างอีกมาก" แปลว่าถึงเวลาจุติแล้ว</p>`],
    ['บททดสอบ', `<p>จุติเข้าสู่รอบใหม่ภายใต้กฎพิเศษ ${D.CHALLENGES.length} แบบ สังหารเทพเป้าหมายได้จะได้โบนัสถาวร ผ่านซ้ำได้แบบละ ${D.CHAL_MAX} ครั้ง</p>`],
    ['สิ่งสูงสุดและบารมี', `<p>เมื่อสังหารเทพครบ ${D.GODS.length} องค์ในรอบเดียว จะท้าสู้สิ่งสูงสุดได้ไม่จำกัด ชนะแล้วได้ <b>บารมี</b> ไว้ซื้อความสามารถถาวร</p>`],
    ['คู่หู แดนลับ อุปกรณ์', `<p>ปลดล็อกเมื่อสังหาร ${god('pets')} ส่งทีมสัตว์คู่กาย ${D.TEAM_SIZE} ตัวออกสำรวจแดนลับเพื่อเก็บเลเวลและวัตถุดิบ แล้วนำวัตถุดิบไปตีบวกอุปกรณ์ ทั้งหมดคงอยู่ถาวรแม้จุติใหม่</p>`],
    ['ความสำเร็จ', `<p>แต่ละความสำเร็จเพิ่มค่าสถานะทั้งหมด +${+((pwM(1 + D.ACH_BONUS) - 1)*100).toFixed(1)}% ดูได้ที่แท็บจุติ › สำเร็จ</p>`],
    ['ฝึกตนขณะออฟไลน์', `<p>แม้ปิดเกมไป ร่างเงาก็ยังฝึกต่อได้สูงสุด 8 ชั่วโมง เมื่อกลับมาจะมีการ์ดสรุปผลให้ดู</p>`],
    ['ย้ายเซฟ', `<p>เซฟถูกเก็บไว้ในเบราว์เซอร์ของแต่ละเครื่อง หากจะย้ายเครื่อง ให้กด "คัดลอกโค้ด" ในหน้านี้ แล้วนำไปวางที่ช่องโค้ดเซฟของเครื่องใหม่ จากนั้นกด "โหลดจากโค้ด"</p>`],
    ['เคล็ดลับ', `<ul><li>เปิด "จัดอัตโนมัติ" ให้เกมจัดสรรร่างเงาเอง</li><li>บนคอมกด <b>?</b> เพื่อดูปุ่มลัด · บนมือถือปัดซ้าย/ขวาเพื่อเปลี่ยนแท็บ</li><li>ติดตั้งเกมเป็นแอปได้ผ่านเมนูเบราว์เซอร์ "เพิ่มลงหน้าจอหลัก"</li></ul>`]
  ];
}
// sections for systems the player hasn't reached yet are shown locked, without spoilers
const GUIDE_LOCK = { 'ฝึกจิต':'skills', 'การสร้าง':'create', 'เทวาลัย':'gen', 'จุติใหม่และปราณเทพ':'rebirth', 'บททดสอบ':'rebirth', 'คู่หู แดนลับ อุปกรณ์':'pets' };
function guideLocked(title){
  const m = s.meta;
  if(title === 'สิ่งสูงสุดและบารมี') return G.ubUnlocked(s) || m.mpTotal > 0 ? '' : 'ปลดล็อกเมื่อสังหารเทพครบ ' + D.GODS.length + ' องค์ในรอบเดียว';
  const k = GUIDE_LOCK[title];
  if(!k || m.bestGods > D.UNLOCK_AT[k] || m.rebirths > 0 && (k === 'rebirth' || k === 'skills' || k === 'create' || k === 'gen')) return '';
  return 'ปลดล็อกเมื่อสังหาร ' + D.GODS[D.UNLOCK_AT[k]].name;
}
function guideHTML(){
  const secs = guideSections().map(([t,h])=>{ const lock = guideLocked(t); return [lock ? '🔒 ' + t : t, lock ? '<p class="note">' + lock + ' — รายละเอียดจะเผยเมื่อปลดล็อก</p>' : h]; });
  return `<div class="gBox" role="dialog" aria-modal="true" aria-labelledby="gTitle" tabindex="-1">
      <div class="row"><b id="gTitle">📖 วิธีเล่น God Killer</b><button class="miniBtn" id="gClose">ปิด</button></div>
      <div class="gToc">${secs.map((x,i)=>`<a href="#g${i}" data-g="${i}">${x[0]}</a>`).join('')}</div>
      ${secs.map((x,i)=>`<h4 id="g${i}">${x[0]}</h4>${x[1]}`).join('')}
    </div>`;
}
function showGuide(on){
  let box = $('guide');
  if(box && on) box.innerHTML = guideHTML();
  if(!box){
    box = document.createElement('div');
    box.id = 'guide';
    box.innerHTML = guideHTML();
    document.body.appendChild(box);
    box.addEventListener('click', e=>{
      if(e.target === box || e.target.id === 'gClose'){ showGuide(false); return; }
      const a = e.target.closest('[data-g]');
      if(a){ e.preventDefault(); box.querySelector('#g' + a.dataset.g).scrollIntoView({ behavior:'smooth', block:'start' }); }
    });
    box.addEventListener('keydown', e=>{ if(e.key === 'Escape'){ e.stopPropagation(); showGuide(false); } });
  }
  setClass(box, 'open', on);
  if(on){ box._ret = document.activeElement; box.querySelector('.gBox').focus(); }
  else if(box._ret && box._ret.focus) box._ret.focus();
}

// ---------- touch: hold +/− to repeat, swipe between tabs ----------
function initTouch(){
  let holdT = 0, repT = 0, held = null, repeats = 0;
  const stop = ()=>{ clearTimeout(holdT); clearTimeout(repT); held = null; };
  const tick = (start)=>{
    if(!held || held.disabled){ stop(); return; }
    held.click(); repeats++;
    repT = setTimeout(()=>tick(start), Date.now() - start > 2000 ? 50 : 110);
  };
  $('main').addEventListener('pointerdown', e=>{
    const b = e.target.closest('.ctlBtn');
    if(!b || e.button > 0) return;
    stop(); held = b; repeats = 0;
    const start = Date.now();
    holdT = setTimeout(()=>{ buzz(8); tick(start); }, 400);
  });
  ['pointerup','pointercancel','pointerleave'].forEach(t=>$('main').addEventListener(t, stop));
  $('main').addEventListener('pointerout', e=>{ if(held && e.target === held) stop(); });   // finger slid off the button
  $('main').addEventListener('scroll', stop, { passive:true });
  // the click that ends a hold would count once more: swallow it
  $('main').addEventListener('click', e=>{ if(repeats && e.isTrusted && e.target.closest('.ctlBtn')){ repeats = 0; e.stopPropagation(); e.preventDefault(); } }, true);

  if(!window.matchMedia('(pointer: coarse)').matches) return;
  let sx = 0, sy = 0, st = 0;
  $('main').addEventListener('touchstart', e=>{ const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); }, { passive:true });
  $('main').addEventListener('touchend', e=>{
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if(Date.now() - st > 600 || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx)*0.5) return;
    if(e.target.closest('textarea,input,.seg')) return;
    const order = [...document.querySelectorAll('#tabs .tab')].map(x=>x.dataset.tab).filter(n=>!tabLocked(n));
    const i = order.indexOf(activeTab);
    if(i < 0) return;
    const next = order[i + (dx < 0 ? 1 : -1)];
    if(next) selectTab(next);
  }, { passive:true });
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
let welcomeHTML = '';   // built during the load-time catch-up, shown once the page is built
function catchUp(){
  const raw = (Date.now() - s.lastSave)/1000;
  const sec = Math.min(raw, G.MAX_OFFLINE_SEC);
  if(!(sec >= 10)) return;
  const d0 = G.derive(s), dp0 = s.dpTotal, lost0 = s.clonesLost, mp0 = s.meta.mp;
  const ev = [];
  G.advance(s, sec, ev);
  // count what happened before handleEvents empties the list
  const gods = [], dg = { runs:0, wins:0 }; let ach = 0, ubWins = 0;
  for(const e of ev){
    if(e.type === 'godWin') gods.push(D.GODS[e.i].name);
    else if(e.type === 'dgRun'){ dg.runs++; if(e.win) dg.wins++; }
    else if(e.type === 'ach') ach++;
    else if(e.type === 'ubWin') ubWins++;
  }
  handleEvents(ev, true);
  const d1 = G.derive(s);
  addLog('ขณะไม่อยู่ ' + fmtTime(sec) + ': พลังเทวะ +' + fmt(s.dpTotal - dp0) + ' · กาย +' + fmt(pw(d1.phys) - pw(d0.phys)) + ' · จิต +' + fmt(pw(d1.myst) - pw(d0.myst)) +
    (s.clonesLost > lost0 ? ' · ร่างเงาตาย ' + fmt(s.clonesLost - lost0) : ''));
  if(sec < 60) return;
  const rows = [
    ['พลังเทวะ', '+' + fmt(s.dpTotal - dp0)],
    ['กาย', '+' + fmt(pw(d1.phys) - pw(d0.phys))],
    ['จิต', '+' + fmt(pw(d1.myst) - pw(d0.myst))],
    ['พลังโจมตี', fmt(pw(d0.atk)) + ' → ' + fmt(pw(d1.atk))]
  ];
  if(gods.length) rows.push(['สังหารเทพ', gods.length + ' องค์: ' + gods.join(', ')]);
  if(s.clonesLost > lost0) rows.push(['ร่างเงาตาย', fmt(s.clonesLost - lost0) + ' ร่าง']);
  if(dg.runs) rows.push(['แดนลับ', dg.runs + ' รอบ (ชนะ ' + dg.wins + ')']);
  if(ubWins) rows.push(['สิ่งสูงสุด', 'ชนะ ' + ubWins + ' ครั้ง · บารมี +' + fmt(s.meta.mp - mp0)]);
  if(ach) rows.push(['ความสำเร็จใหม่', ach + ' รายการ']);
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' })[c]);
  welcomeHTML = '<div class="wbCard" role="dialog" aria-label="สรุปผลขณะไม่อยู่"><div class="wbTitle">ยินดีต้อนรับกลับมา!</div>' +
    '<div class="note">ห่างหายไป ' + fmtTime(sec) + (raw > G.MAX_OFFLINE_SEC ? ' (นับได้สูงสุด ' + fmtTime(G.MAX_OFFLINE_SEC) + ')' : '') + '</div>' +
    rows.map(r=>'<div class="wbRow"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>').join('') +
    '<button class="b bPrimary" id="wbClose" style="margin-top:10px">เล่นต่อ</button></div>';
}
function showWelcome(){
  if(!welcomeHTML) return;
  const box = document.createElement('div');
  box.id = 'welcome'; box.className = 'wbWrap';
  box.innerHTML = welcomeHTML;
  welcomeHTML = '';
  document.body.appendChild(box);
  const close = ()=>box.remove();
  box.addEventListener('click', e=>{ if(e.target === box || e.target.id === 'wbClose') close(); });
  $('wbClose').focus();
}

// ---------- cultivation realms: HUD title and bar, tribulation button, lightning overlay, breakthrough banner ----------
ACH_LABEL.realm = 'ทะลวงขอบเขตในรอบเดียว';
SFX.thunder = ()=>{ tone(70, 0.45, 'sawtooth', 0.07, 35); tone(1400, 0.08, 'square', 0.02, 300); };
const realmName = r => D.REALMS[r].name;
let tribBolt = 0;
function initRealm(){
  const row = document.createElement('div');
  row.className = 'realmRow'; row.id = 'realmRow';
  row.innerHTML = '<button class="realmTitle" id="realmTitle" type="button"></button>' +
    '<div class="bar realm" id="realmBarWrap"><i id="realmBar"></i></div>' +
    '<button class="realmBtn" id="tribBtn" type="button"><b>⚡ ฝ่าทัณฑ์สวรรค์</b><small id="tribHint"></small></button>';
  document.querySelector('#hud .hudTop').after(row);
  const o = document.createElement('div');
  o.id = 'tribFx'; o.setAttribute('aria-hidden', 'true');
  o.innerHTML = '<div class="tribFlash"></div><div class="tribBolt" id="tribBoltEl"></div>' +
    '<div class="tribBox"><b>ทัณฑ์สวรรค์</b><span id="tribCount"></span><div class="bar hp"><i id="tribBar"></i></div><small id="tribDmg"></small></div>';
  document.body.appendChild(o);
  $('tribBtn').addEventListener('click', ()=>{
    if(!G.startTribulation(s)) return;
    addLog('⚡ เริ่มฝ่าทัณฑ์สวรรค์ เพื่อทะลวงสู่ขั้น' + realmName(s.realm.r + 1));
    tribBolt = 0;
    render(true);
  });
  $('realmTitle').addEventListener('click', ()=>toast(realmInfo()));
}
function realmInfo(){
  const R = s.realm, last = R.r >= D.REALMS.length - 1;
  return realmName(R.r) + ' ขั้น ' + R.st + ' · ปราณ ' + fmt(G.realmQi(s)) + (last ? '' : '/' + fmt(D.REALMS[R.r].qi)) +
    ' (เลเวลฝึกกาย+ฝึกจิตรวม) · ค่าสถานะทั้งหมด ×' + pwM(Math.pow(D.REALM_STAT, R.r)).toFixed(2);
}
function renderRealm(d){
  const R = s.realm, last = R.r >= D.REALMS.length - 1, peak = G.atRealmPeak(s), inTrib = R.trib !== null;
  setText($('realmTitle'), realmName(R.r) + ' · ขั้น ' + R.st + (last && G.realmQi(s) >= D.REALMS[R.r].qi ? ' สมบูรณ์' : ''));
  const info = realmInfo();
  if($('realmTitle').title !== info) $('realmTitle').title = info;
  setShown($('realmBarWrap'), !peak && !inTrib);
  setShown($('tribBtn'), peak || inTrib, 'flex');
  if(!peak && !inTrib) setBar($('realmBar'), G.stageFrac(s));
  else {
    const wait = G.tribWait(s), o = G.tribOutlook(s, d);
    setDisabled($('tribBtn'), !G.canTribulate(s));
    setClass($('tribBtn'), 'risky', !o.ok && !inTrib && wait <= 0);
    setText($('tribHint'), inTrib ? 'สายฟ้ากำลังฟาด…' : wait > 0 ? 'พักฟื้นลมปราณ ' + Math.ceil(wait) + ' วินาที' :
      o.ok ? 'สู่ขั้น' + realmName(R.r + 1) + ' · คาดว่าผ่าน' : 'ร่างยังต้านไม่ไหว · เสริมพลังชีวิต/ป้องกัน');
  }
  // the 6-second storm follows the engine's clock, so a reload mid-storm shows the same moment
  const box = $('tribFx');
  setClass(box, 'show', inTrib);
  if(!inTrib){ tribBolt = 0; return; }
  const bolt = Math.min(D.TRIB_BOLTS, 1 + Math.floor(R.trib / D.TRIB_TIME * D.TRIB_BOLTS));
  const o = G.tribOutlook(s, d);
  setText($('tribCount'), 'สายฟ้าสายที่ ' + bolt + '/' + D.TRIB_BOLTS);
  setBar($('tribBar'), Math.min(1, o.bolt * bolt / o.hp));
  setText($('tribDmg'), 'ความเสียหายรวม ' + fmt(pwPool(o.bolt * bolt, o.hp)) + ' / พลังชีวิต ' + fmt(pw(o.hp)));
  if(bolt !== tribBolt){
    tribBolt = bolt;
    if(!motionOff()){
      const b = $('tribBoltEl');
      b.style.left = (18 + ((bolt * 37) % 64)) + '%';   // bolts land in a fixed, varied pattern
      replayAnim(box.querySelector('.tribFlash'), 'hit'); replayAnim(b, 'hit');
    }
    sfx('thunder'); buzz(20);
  }
}
function realmBanner(title, sub){
  if(motionOff()){ toast(title + ' ' + sub, 3); return; }
  let b = $('realmBanner');
  if(!b){ b = document.createElement('div'); b.id = 'realmBanner'; b.setAttribute('aria-hidden', 'true'); b.innerHTML = '<b></b><span></span>'; document.body.appendChild(b); }
  b.firstChild.textContent = title; b.lastChild.textContent = sub;
  replayAnim(b, 'show');
  if(window.GKFX && !GKFX.off()){
    const x = innerWidth / 2, y = innerHeight * 0.4, R = Math.min(innerWidth, 520);
    GKFX.ring(x, y, 12, R * 0.45, '#fff3c4', 6, 0.9);
    GKFX.ring(x, y, 10, R * 0.3, '#d2503f', 4, 1.0, 0.15);
    GKFX.burst(x, y, { n:48, colors:['#fff3d0','#f1d38a','#8fd6be','#7fd4ff'], speed:380, size:13, life:1.1, drag:0.93 });
  }
}
// engine events for realms; returns true when the event was one of them
function realmEvent(e, quiet){
  if(e.type === 'realmStage'){
    addLog('🌀 ลมปราณก้าวหน้า: ' + realmName(e.r) + ' ขั้น ' + e.st);
    if(!quiet) toast('🌀 ' + realmName(e.r) + ' ขั้น ' + e.st);
  } else if(e.type === 'realmPeak'){
    addLog('⛈ ถึงจุดสูงสุดของขั้น' + realmName(e.r) + ' — กด "ฝ่าทัณฑ์สวรรค์" เพื่อทะลวงสู่ขั้น' + realmName(e.r + 1));
    if(!quiet){ toast('⛈ ถึงจุดสูงสุดของขั้น' + realmName(e.r) + ' พร้อมฝ่าทัณฑ์สวรรค์แล้ว!', 2); sfx('ping'); }
  } else if(e.type === 'realmUp'){
    addLog('⚡ ฝ่าทัณฑ์สวรรค์สำเร็จ! ทะลวงสู่ขั้น' + realmName(e.r) + ' — ค่าสถานะทั้งหมด ×' + fmtX(D.REALM_STAT) + ' และฟื้นพลังชีวิตเต็ม');
    if(!quiet){ realmBanner('ทะลวงสู่ขั้น' + realmName(e.r) + '!', 'ค่าสถานะทั้งหมด ×' + fmtX(D.REALM_STAT) + ' · ฟื้นพลังชีวิตเต็ม'); celebrate(); sfx('win'); buzz([60,40,120]); }
    save();
  } else if(e.type === 'tribFail'){
    addLog('ฝ่าทัณฑ์สวรรค์ไม่สำเร็จ ร่างยังต้านสายฟ้าไม่ไหว — ปราณไม่หายไป พักฟื้น ' + D.TRIB_COOLDOWN + ' วินาทีแล้วลองใหม่');
    if(!quiet){ toast('ทัณฑ์สวรรค์แรงเกินต้าน... ปราณยังอยู่ครบ พักฟื้นแล้วลองใหม่', 2); banner('ฝ่าทัณฑ์ไม่สำเร็จ...', true); sfx('lose'); }
  } else return false;
  return true;
}

// ---------- sect missions (ภารกิจสำนัก) ----------
// three short goals, always in view: a collapsible strip under the HUD on phones, open in the sidebar on wide screens.
// The engine tracks them (offline too) and pays the reward itself; this block only shows them and reports completions.
const MIS_KEY = 'godKillerMissions';   // per-device open/closed choice, not part of the save
const MIS_TAB = { kills:'mon', gods:'gods', made:'create', clones:'create', gen:'temple', mono:'temple', dp:'mon' };
const misRows = [], misIds = [];
let misQuietN = 0, misQuietT = 0;
function missionText(m){
  const c = m.c !== undefined && D.MISSION_CHAIN[m.c];
  if(c && c.text) return c.text;
  const n = fmt(m.n);
  switch(m.t){
    case 'job': return (m.kind === 'mon' ? 'ส่งร่างเงาไปปราบ' : 'ส่งร่างเงาไปฝึก') + JOB_DEFS[m.kind][m.i].name;
    case 'lv': return JOB_DEFS[m.kind][m.i].name + 'ถึง Lv.' + m.n;
    case 'kills': return m.i === undefined ? 'ปราบอสูร ' + n + ' ตัว' : 'ปราบ' + D.MONSTERS[m.i].name + 'ขึ้นไป ' + n + ' ตัว';
    case 'gods': return D.GODS[m.n-1] ? 'สังหาร' + D.GODS[m.n-1].name : 'สังหารเทพ ' + m.n + ' องค์';
    case 'made': return 'สร้าง' + G.creationByKey(m.key).name + ' ' + n + ' ชิ้น';
    case 'clones': return 'รวบรวมร่างเงาให้ครบ ' + n + ' ร่าง';
    case 'gen': return 'ยกระดับเครื่องผลิตพลังเทวะถึง Lv.' + m.n;
    case 'mono': return 'สร้างอนุสรณ์รวม ' + n + ' เลเวล';
    case 'dp': return 'สะสมพลังเทวะอีก ' + n;
  }
  return '';
}
function missionRewardText(rw){ return rw.buff ? 'ฝึกเร็วขึ้น ×' + D.MISSION_BUFF + ' นาน ' + fmtTime(rw.buff) : '+' + fmt(rw.dp) + ' พลังเทวะ'; }
function setMisOpen(open){
  setClass($('missions'), 'closed', !open);
  $('misHead').setAttribute('aria-expanded', String(open || !$('misPeek').offsetParent));
}
function initMissions(){
  const list = $('misList');
  for(let j=0;j<D.MISSION_SLOTS;j++){
    const b = document.createElement('button');
    b.className = 'misRow'; b.dataset.slot = j;
    b.innerHTML = '<i class="misRw"></i><span class="misText"></span><b class="misNum"></b><span class="bar thin"><i></i></span>';
    list.appendChild(b);
    misRows.push({ el:b, rw:b.querySelector('.misRw'), text:b.querySelector('.misText'), num:b.querySelector('.misNum'), bar:b.querySelector('.bar>i') });
  }
  // a mission is also a shortcut to the tab where it is done
  list.addEventListener('click', e=>{
    const b = e.target.closest('.misRow'), m = b && s.missions[+b.dataset.slot];
    if(m) selectTab(MIS_TAB[m.t] || m.kind);
  });
  let open = !(window.matchMedia && matchMedia('(max-width:599px)').matches);   // phones start closed to keep the screen for play
  try{ const v = localStorage.getItem(MIS_KEY); if(v) open = v === 'open'; }catch(e){}
  setMisOpen(open);
  $('misHead').addEventListener('click', ()=>{
    if(!$('misPeek').offsetParent) return;   // the split layout always shows the list
    const next = $('missions').classList.contains('closed');
    setMisOpen(next);
    try{ localStorage.setItem(MIS_KEY, next ? 'open' : 'closed'); }catch(e){}
  });
}
function renderMissions(){
  const ms = s.missions;
  let peek = '', best = -1;
  misRows.forEach((r,j)=>{
    const m = ms[j];
    setShown(r.el, !!m, 'grid');
    if(!m) return;
    const p = G.missionProgress(s, m), f = p.v / p.n, text = missionText(m);
    const num = m.t === 'job' ? '' : fmt(p.v) + '/' + fmt(p.n);
    if(misIds[j] !== m){   // the object, not m.id: ids start over each run (and in a loaded save), so an id can repeat
      // the next mission slides into the slot the finished one left
      if(misIds[j] !== undefined && !motionOff()) replayAnim(r.el, 'misIn');
      misIds[j] = m;
      setClass(r.rw, 'buff', m.r === 'buff');
      r.el.title = 'รางวัล: ' + (m.r === 'buff' ? 'ความเร็วฝึก ×' + D.MISSION_BUFF + ' นาน ' + fmtTime(D.MISSION_BUFF_SECS) : 'พลังเทวะเท่ารายได้ราว ' + D.MISSION_DP_SECS + ' วินาที');
    }
    setText(r.text, text);
    setText(r.num, num);
    setBar(r.bar, f);
    if(f > best){ best = f; peek = text + (num ? ' · ' + num : ''); }
  });
  const buff = $('misBuff');
  setShown(buff, s.buff > 0, 'inline-block');
  if(s.buff > 0) setText(buff, 'ฝึก ×' + D.MISSION_BUFF + ' ' + Math.ceil(s.buff) + ' วิ');
  setText($('misPeek'), peek);
}
function onMissionDone(e, quiet){
  if(quiet){   // offline catch-up or a long background gap: one log line instead of a flood
    misQuietN++;
    if(!misQuietT) misQuietT = setTimeout(()=>{ addLog('ภารกิจสำนักสำเร็จ ' + misQuietN + ' ภารกิจระหว่างที่ไม่อยู่ รับรางวัลแล้ว'); misQuietN = 0; misQuietT = 0; }, 0);
    return;
  }
  const t = missionText(e.m), rw = missionRewardText(e.reward);
  addLog('📜 ภารกิจสำนักสำเร็จ: ' + t + ' · ' + rw);
  toast('📜 ภารกิจสำเร็จ: ' + t + ' · ' + rw);
  sfx('ping');
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

// ---------- fortune (โชควาสนา): a spirit treasure appears now and then while the page is open ----------
// the timer counts only seconds the tab is visible and no dialog is open, so offline catch-up never makes one;
// which reward it pays, and how much, is decided by the engine (G.rollFortune / G.claimFortune)
const FORTUNE_ART = {
  dp: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 13C16 6 5 12 7 25c2 10 11 17 17 17s15-7 17-17c2-13-9-19-17-12z" fill="#ffb3c8"/><path d="M24 13c-3 7-3 19 0 29" stroke="#e0708f" stroke-width="2" fill="none"/><path d="M24 13c2-5 6-8 12-8-1 5-6 8-12 8z" fill="#6fd49a"/><ellipse cx="15" cy="23" rx="3.5" ry="6" fill="#fff" opacity=".4"/></svg>',
  speed: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="10" width="28" height="28" rx="2" fill="#f2e6c8"/><rect x="6" y="7" width="6" height="34" rx="3" fill="#b0763a"/><rect x="36" y="7" width="6" height="34" rx="3" fill="#b0763a"/><path d="M16 17h16M16 23h16M16 29h9" stroke="#3f7fa8" stroke-width="2.4" stroke-linecap="round"/><circle cx="31" cy="31" r="3.5" fill="#d9534f"/></svg>',
  create: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="25" r="14" fill="#e8c76f"/><circle cx="24" cy="25" r="10" fill="none" stroke="#a8873e" stroke-width="1.6"/><path d="M18 27c2 4 9 4 11-1s-4-8-7-5 1 6 4 4" fill="none" stroke="#8a6420" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="18.5" cy="19" rx="4" ry="2.6" fill="#fff" opacity=".55"/></svg>'
};
// painted treasures (img/fortune/NN.webp); the drawn SVG above stands in when a file is missing
const FORTUNE_IMG = { dp: '01', speed: '02', create: '03' };
function fortuneArt(kind){ return FORTUNE_IMG[kind] ? '<img src="god-killer/img/fortune/' + FORTUNE_IMG[kind] + '.webp" alt="" decoding="async">' : FORTUNE_ART[kind]; }
const fortune = { wait: 0, cur: null, lastAt: 0, bar: null };
const fortuneRand = r => r[0] + Math.random() * (r[1] - r[0]);
function fortunePaused(){ return document.hidden || !!$('welcome') || !!document.querySelector('#guide.open,#settings.open,#keyHelp.open,#tribFx.show'); }
function removeFortune(c, cls){
  if(!cls || motionOff()){ c.el.remove(); return; }
  c.el.classList.add(cls);
  setTimeout(()=>c.el.remove(), 650);
}
// somewhere inside the content area, clear of the HUD and the toast: f in [0,1] picks the spot along one axis
function fortuneSpot(axis, f){
  const box = $('main').getBoundingClientRect(), x = axis === 'x', size = x ? window.innerWidth : window.innerHeight;
  const a = Math.max(x ? box.left : box.top, 0) + (x ? 50 : 56), b = Math.min(x ? box.right : box.bottom, size) - (x ? 50 : 96);
  return b > a ? a + Math.max(0, Math.min(1, f)) * (b - a) : size / 2;
}
// keep a treasure on screen when the window is resized or the phone turns
function keepFortuneOnScreen(){
  const c = fortune.cur;
  if(!c) return;
  const clamp = (axis, v)=>{ const a = fortuneSpot(axis, 0), b = fortuneSpot(axis, 1); return b > a ? Math.max(a, Math.min(b, v)) : a; };
  c.x = clamp('x', c.x); c.y = clamp('y', c.y);
  c.el.style.left = c.x + 'px'; c.el.style.top = c.y + 'px';
}
function spawnFortune(kind){
  if(fortune.cur){ removeFortune(fortune.cur, ''); fortune.cur = null; }
  if(!G.fortuneItem(kind)) kind = G.rollFortune(s, Math.random());
  const item = G.fortuneItem(kind), F = D.FORTUNE;
  const x = fortuneSpot('x', Math.random()), y = fortuneSpot('y', Math.random());
  const el = document.createElement('button');
  el.type = 'button'; el.className = 'fortune';
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.setProperty('--fc', item.color);
  el.title = item.name + ' — ' + item.desc;
  el.setAttribute('aria-label', 'แตะเพื่อรับ' + item.name + ': ' + item.desc);
  el.innerHTML = '<span class="fortuneHalo"></span><span class="fortuneBob">' + fortuneArt(kind) + '</span><span class="fortuneName">' + item.name + '</span><span class="fortuneLife"><i></i></span>';
  const art = el.querySelector('.fortuneBob img');
  if(art) art.onerror = ()=>{ art.parentNode.innerHTML = FORTUNE_ART[kind]; };
  el.addEventListener('click', onFortuneTap);
  document.body.appendChild(el);
  fortune.cur = { el, kind, x, y, left: F.life, life: el.querySelector('.fortuneLife>i') };
  sfx('ping');
  if(!s.meta.fortune.caught) toast('✨ โชควาสนา! สมบัติวิญญาณปรากฏ แตะเพื่อรับก่อนมันสลายไป', 2);
}
function onFortuneTap(e){
  const c = fortune.cur;
  if(!c || e.currentTarget !== c.el) return;
  fortune.cur = null;
  fortune.wait = fortuneRand(D.FORTUNE.every);
  removeFortune(c, 'got');
  const r = G.claimFortune(s, c.kind, ev);
  if(!r) return;
  const name = G.fortuneItem(r.kind).name;
  let msg, pop;
  if(r.kind === 'dp'){ msg = 'พลังเทวะ +' + fmt(r.dp); pop = '+' + fmt(r.dp); }
  else if(r.kind === 'speed'){ msg = 'ความเร็วฝึก ×' + D.FORTUNE.boostMult + ' อีก ' + Math.round(r.secs) + ' วิ'; pop = 'ฝึก ×' + D.FORTUNE.boostMult; }
  else { msg = 'เร่งการสร้าง ' + Math.round(r.secs) + ' วิ' + (r.made ? ' ได้ ' + fmt(r.made) + ' ชิ้น' : ''); pop = r.made ? 'สร้าง +' + fmt(r.made) : 'เร่งสร้าง'; }
  const streak = r.mult > 1 ? ' · โชคต่อเนื่อง ' + r.streak + ' ครั้ง (รางวัล +' + Math.round((r.mult - 1) * 100) + '%)' : '';
  addLog('✨ โชควาสนา: ' + name + ' — ' + msg + streak);
  toast('✨ ' + name + ': ' + msg + streak, 2);
  sfx('fortune'); buzz(20);
  if(!motionOff()){
    const g = document.createElement('span');
    g.className = 'fortuneGain'; g.textContent = pop;
    g.style.left = c.x + 'px'; g.style.top = (c.y - 30) + 'px';
    document.body.appendChild(g);
    setTimeout(()=>g.remove(), 1300);
  }
  render(true);
  save();
}
function renderBuff(){
  if(!fortune.bar){
    const b = document.createElement('div');
    b.id = 'buffBar'; b.className = 'buffBar';
    $('chalBar').after(b);
    fortune.bar = b;
  }
  const t = s.boostT || 0;
  setShown(fortune.bar, t > 0);
  if(t > 0) setText(fortune.bar, '📜 ' + G.fortuneItem('speed').name + ': ความเร็วฝึก ×' + D.FORTUNE.boostMult + ' · เหลือ ' + Math.ceil(t) + ' วิ');
}
function fortuneTick(){
  const now = performance.now(), dt = Math.min(1, (now - fortune.lastAt) / 1000);   // a throttled background timer never counts as play
  fortune.lastAt = now;
  renderBuff();
  if(fortunePaused()) return;
  const c = fortune.cur;
  if(c){
    c.left -= dt;
    setBar(c.life, c.left / D.FORTUNE.life);
    setClass(c.el, 'ending', c.left <= 3);
    if(c.left > 0) return;
    fortune.cur = null;
    fortune.wait = fortuneRand(D.FORTUNE.every);
    const had = s.meta.fortune.streak;
    G.missFortune(s);
    removeFortune(c, 'gone');
    if(had >= 2){ addLog(G.fortuneItem(c.kind).name + 'สลายไป — โชคต่อเนื่อง ' + had + ' ครั้งขาดตอน'); toast(G.fortuneItem(c.kind).name + 'สลายไป... โชคต่อเนื่องขาดตอน'); }
    return;
  }
  if(!G.fortuneUnlocked(s)) return;
  fortune.wait -= dt;
  if(fortune.wait <= 0) spawnFortune();
}
function initFortune(){
  SFX.fortune = ()=>[784, 988, 1319, 1568].forEach((f,i)=>tone(f, 0.22, 'sine', 0.05, 0, i*0.07));
  fortune.wait = fortuneRand(D.FORTUNE.first);
  fortune.lastAt = performance.now();
  renderBuff();
  setInterval(fortuneTick, 250);
  window.addEventListener('resize', keepFortuneOnScreen);
  // test hook (local or ?debug only): GKDebug.fortune('dp' | 'speed' | 'create') makes a treasure appear now
  if(/^(localhost|127\.0\.0\.1)$/.test(location.hostname) || /[?&]debug\b/.test(location.search))
    window.GKDebug = Object.assign(window.GKDebug || {}, { fortune: kind=>{ spawnFortune(kind); return fortune.cur.kind; } });
}

// ---------- rebirth payoff: split times, live GP preview, "จุติสำเร็จ" card ----------
// run clock as m:ss or h:mm:ss; 0 means "no time" (never killed, or a kill from before split times were recorded)
function fmtClock(sec){
  if(!(sec > 0)) return '—';
  sec = Math.floor(sec);
  const h = Math.floor(sec/3600), mm = Math.floor(sec/60) % 60, ss = String(sec % 60).padStart(2, '0');
  return h ? h + ':' + String(mm).padStart(2, '0') + ':' + ss : mm + ':' + ss;
}
const fmtMul = x => '×' + (x >= 100 ? fmt(x) : String(+x.toFixed(x < 10 ? 2 : 1)));
function splitToast(e){
  const name = D.GODS[e.i].name;
  if(!(e.t > 0)) return '⚔ สังหาร ' + name + ' สำเร็จ!';
  const head = '⚔ สังหาร ' + name + ' ใน ' + fmtClock(e.t);
  if(!e.best) return head + '!';
  return e.t < e.best ? head + ' · สถิติใหม่! (ดีสุดเดิม ' + fmtClock(e.best) + ')' : head + ' (ดีสุด ' + fmtClock(e.best) + ')';
}
function renderRebirthPay(){
  const m = s.meta, gain = G.rebirthGain(s), next = s.gods < D.GODS.length ? D.GODS[s.gods] : null;
  let h = '<div class="rpBig"><span>ปราณเทพที่จะได้ถ้าจุติตอนนี้</span><b>+' + fmt(gain) + '</b></div>';
  if(m.lastGain) h += '<div class="rpLine">เทียบรอบก่อน (+' + fmt(m.lastGain) + '): <b class="' + (gain > m.lastGain ? 'up' : '') + '">' + fmtMul(gain / m.lastGain) + '</b></div>';
  if(next){
    const after = gain + next.gp, best = m.splits[s.gods];
    h += '<div class="rpLine">สังหาร ' + next.name + ' อีกองค์ → <b class="up">+' + fmt(after) + '</b> (เพิ่ม ' + next.gp + (gain ? ', ' + fmtMul(after / gain) : '') + ')' +
      (best ? ' · สถิติเดิมถึงองค์นี้ ' + fmtClock(best) : '') + '</div>';
  } else h += '<div class="rpLine">สังหารเทพครบทุกองค์แล้ว — จุติเพื่อเก็บปราณเทพเต็มจำนวน</div>';
  setHTML($('rbPay'), h);
  setText($('spSub'), 'รอบนี้ ' + fmtClock(s.playTime) + (s.challenge ? ' · อยู่ในบททดสอบ' : ''));
  const n = Math.min(D.GODS.length, Math.max(m.bestGods, s.gods + 1));
  let t = '<div class="spRow"><span>เทพ</span><span>รอบนี้</span><span>รอบก่อน</span><span>ดีสุด</span></div>';
  for(let i = 0; i < n; i++){
    const cur = s.splits[i] || 0, pb = cur && cur <= m.splits[i];
    t += '<div class="spRow' + (i === s.gods ? ' next' : '') + '"><span>' + D.GODS[i].name + '</span>' +
      '<span class="' + (pb ? 'pb' : '') + '">' + (i === s.gods ? 'กำลังไล่' : fmtClock(cur)) + '</span>' +
      '<span>' + fmtClock(m.lastSplits[i]) + '</span><span>' + fmtClock(m.splits[i]) + '</span></div>';
  }
  setHTML($('spTable'), t);
}
const RB_CHEERS = ['ร่างใหม่ แต่ปราณเทพยังอยู่ครบ — รอบนี้จะเร็วกว่าเดิมมาก',
  'ทุกการจุติคือก้าวที่ไกลขึ้น ไปทวงบัลลังก์สวรรค์อีกครั้ง!',
  'เทพที่เคยล้มเราได้ จะล้มลงเร็วกว่าเดิม',
  'ปราณเทพสะสมแน่นขึ้นทุกรอบ ลองทำลายสถิติเวลาของตัวเองดู!'];
function showRebirthCard(gain){
  if($('welcome')) $('welcome').remove();
  const m = s.meta, mu = G.mults(s);
  const canBuy = D.UPGRADES.filter(u => G.upgradeCost(s, u) <= m.gp).length;
  const rows = [
    ['ปราณเทพที่ได้', '+' + fmt(gain)],
    ['ปราณเทพพร้อมใช้', fmt(m.gp) + ' (สะสมตลอดกาล ' + fmt(m.gpTotal) + ')'],
    ['โบนัสถาวร: ค่าสถานะ', fmtMul(pwM(mu.stat))]
  ];
  if(mu.dp > 1) rows.push(['โบนัสถาวร: พลังเทวะ', fmtMul(mu.dp)]);
  if(mu.speed > 1) rows.push(['โบนัสถาวร: ความเร็วฝึก', fmtMul(mu.speed)]);
  if(mu.clone > 1) rows.push(['โบนัสถาวร: พลังร่างเงา', fmtMul(pwM(mu.clone))]);
  const first = m.lastSplits[0] || m.splits[0];
  if(first) rows.push(['เป้าหมายแรก', D.GODS[0].name + ' ให้เร็วกว่า ' + fmtClock(first)]);
  const cheer = canBuy ? 'ซื้ออัปเกรดถาวรได้ทันที ' + canBuy + ' รายการ — ใช้ก่อนเริ่ม แล้วรอบนี้จะพุ่งไปไกลกว่าเดิม'
                       : RB_CHEERS[m.rebirths % RB_CHEERS.length];
  const box = document.createElement('div');
  box.id = 'welcome'; box.className = 'wbWrap';
  box.innerHTML = '<div class="wbCard rbCard" role="dialog" aria-label="จุติสำเร็จ"><div class="wbTitle">🔄 จุติสำเร็จ · ครั้งที่ ' + m.rebirths + '</div>' +
    rows.map(r=>'<div class="wbRow"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('') +
    '<div class="rbCheer">' + cheer + '</div>' +
    '<button class="b bPrimary" id="wbClose" style="margin-top:10px">' + (canBuy ? 'ไปซื้ออัปเกรด' : 'เริ่มรอบใหม่') + '</button></div>';
  document.body.appendChild(box);
  box.addEventListener('click', e=>{
    if(e.target !== box && e.target.id !== 'wbClose') return;
    box.remove();
    if(canBuy && e.target.id === 'wbClose'){ rbView = 'main'; render(true); }   // "ไปซื้ออัปเกรด" also from the challenge list
  });
  $('wbClose').focus();
}

// ---------- welcome back after the tab was hidden ----------
// the 1s timer keeps ticking while hidden, and a tab the browser froze catches up on its first tick (tick is wall-clock based),
// so progress is already applied exactly once: this only compares a snapshot from when the tab was hidden with now
let hiddenSnap = null;
function welcomeOnReturn(){
  if(document.hidden){
    const d = G.derive(s);
    hiddenSnap = { at: Date.now(), play: s.playTime, rb: s.meta.rebirths, gods: s.gods, dp: s.dpTotal, phys: d.phys, myst: d.myst, atk: d.atk,
      lost: s.clonesLost, mp: s.meta.mp, ub: s.meta.ub.reduce((a, b) => a + b, 0), ach: G.achCount(s), mats: Object.values(s.meta.mats).reduce((a, b) => a + b, 0) };
    return;
  }
  const w = hiddenSnap; hiddenSnap = null;
  const away = w ? (Date.now() - w.at)/1000 : 0;
  if(!w || away <= 60 || $('welcome') || s.meta.rebirths !== w.rb) return;
  tick(); render(true);   // count any time a frozen timer has not ticked yet
  const d = G.derive(s), counted = s.playTime - w.play;
  const rows = [
    ['พลังเทวะ', '+' + fmt(s.dpTotal - w.dp)],
    ['กาย', '+' + fmt(pw(d.phys) - pw(w.phys))],
    ['จิต', '+' + fmt(pw(d.myst) - pw(w.myst))],
    ['พลังโจมตี', fmt(pw(w.atk)) + ' → ' + fmt(pw(d.atk))]
  ];
  if(s.gods > w.gods){
    const names = []; for(let i = w.gods; i < s.gods; i++) names.push(D.GODS[i].name + (s.splits[i] ? ' (' + fmtClock(s.splits[i]) + ')' : ''));
    rows.push(['สังหารเทพ', names.length + ' องค์: ' + names.join(', ')]);
  }
  if(s.clonesLost > w.lost) rows.push(['ร่างเงาตาย', fmt(s.clonesLost - w.lost) + ' ร่าง']);
  const mats = Object.values(s.meta.mats).reduce((a, b) => a + b, 0);
  if(mats > w.mats) rows.push(['วัตถุดิบจากแดนลับ', '+' + fmt(mats - w.mats)]);
  const ub = s.meta.ub.reduce((a, b) => a + b, 0);
  if(ub > w.ub) rows.push(['สิ่งสูงสุด', 'ชนะ ' + (ub - w.ub) + ' ครั้ง · บารมี +' + fmt(s.meta.mp - w.mp)]);
  if(G.achCount(s) > w.ach) rows.push(['ความสำเร็จใหม่', (G.achCount(s) - w.ach) + ' รายการ']);
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' })[c]);
  welcomeHTML = '<div class="wbCard" role="dialog" aria-label="สรุปผลขณะไม่อยู่"><div class="wbTitle">ยินดีต้อนรับกลับมา!</div>' +
    '<div class="note">ห่างหายไป ' + fmtTime(away) + (counted < away - 60 ? ' (นับได้ ' + fmtTime(counted) + ')' : '') + '</div>' +
    rows.map(r=>'<div class="wbRow"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>').join('') +
    '<button class="b bPrimary" id="wbClose" style="margin-top:10px">เล่นต่อ</button></div>';
  showWelcome();
}

function boot(saved){
  if(saved && typeof saved === 'object' && saved.v === G.SAVE_VERSION) s = G.sanitize(saved);
  else if(load()) catchUp();
  lastLost = s.clonesLost;

  buildJobs('train'); buildJobs('skill'); buildJobs('mon');
  buildCreate(); buildGods(); buildTemple(); buildRebirth(); buildPets(); buildUltimates(); buildPhase4(); initRealm();
  renderSteps();
  drawHero();
  fx = initFX($('fx'));

  $('main').addEventListener('click', onMainClick);
  $('fightBtn').addEventListener('click', onFight);
  $('genBtn').addEventListener('click', onGen);
  $('genMaxBtn').addEventListener('click', onGenMax);
  $('strikeBtn').addEventListener('click', onStrike);
  $('guideBtn').addEventListener('click', ()=>showGuide(true));
  $('soundBtn').addEventListener('click', ()=>{ settings.sound = !settings.sound; saveSettings(); renderSoundBtn(); sfx('ping'); });
  renderSoundBtn(); applyMotion();
  $('setBtn').addEventListener('click', ()=>showSettings(true));
  initTouch();
  if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(()=>{});
  $('backToGod').addEventListener('click', ()=>{ arenaSel = 'god'; render(true); });
  $('autoFight').addEventListener('change', e=>{ s.meta.autoFight = e.target.checked; save(); render(true); });
  $('tutorBtn').addEventListener('click', ()=>{ s.meta.tut = 999; save(); render(true); });
  $('tabTipBtn').addEventListener('click', ()=>{ s.meta.seen[activeTab] = 1; save(); render(true); });
  initSaveTools();
  initMissions();
  document.querySelectorAll('svg.ic').forEach(i=>i.setAttribute('aria-hidden', 'true'));   // decorative icons next to text
  $('dgStop').addEventListener('click', ()=>{ G.stopDungeon(s); addLog('หยุดสำรวจแดนลับ'); render(true); });
  $('dgAuto').addEventListener('change', e=>{ s.meta.dgAuto = e.target.checked; render(true); });
  $('rbBtn').addEventListener('click', onRebirth);
  $('logBtn').addEventListener('click', toggleLog);
  $('autoClone').addEventListener('change', e=>{ s.create.autoClone = e.target.checked; render(true); });
  document.querySelectorAll('.tab').forEach(t=>{
    t.addEventListener('click', ()=>selectTab(t.dataset.tab));
    t.addEventListener('keydown', e=>{
      if(e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if(activeTab !== t.dataset.tab) e.stopPropagation();   // opening the gods tab with Space must not also start a fight (onKey)
      selectTab(t.dataset.tab);
    });
  });

  if(!s.log.length) addLog('เส้นทางสังหารเทพเริ่มต้นขึ้น: ร่างเงาจะก่อกำเนิดเองทีละร่าง ส่งไปฝึกกายและออกสนามรบ แล้วท้าสู้' + D.GODS[0].name + ' เมื่อคาดการณ์ว่าชนะ');
  if(!storageOk) addLog('เบราว์เซอร์นี้ไม่อนุญาตให้บันทึกเกม — ความคืบหน้าจะหายไปเมื่อปิดหน้า');
  selectTab('train');
  initPlatform();
  initFortune();
  showWelcome();

  lastTickAt = Date.now();
  requestAnimationFrame(loop);
  setInterval(()=>{ if(performance.now() - lastFrameAt > 1500){ tick(); render(true); } }, 1000);
  setInterval(save, 10000);
  window.addEventListener('pagehide', save);
  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) save(); });
  document.addEventListener('visibilitychange', welcomeOnReturn);
  try{ window.claude?.hot?.snapshot(() => s); }catch(e){}
}

if(window.claude?.hot?.ready) window.claude.hot.ready(data=>boot(data));
else boot(window.claude?.hot?.data);
})();
