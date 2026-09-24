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
  if(r.unlock === 'skills') out.push('ปลดล็อก <b>วิชาเวท</b>');
  if(r.unlock === 'create') out.push('ปลดล็อก <b>การสร้างสรรพสิ่ง</b>');
  if(r.unlock === 'gen') out.push('ปลดล็อก <b>เครื่องผลิตพลังเทวะ</b>');
  if(r.unlock === 'monuments') out.push('ปลดล็อก <b>อนุสรณ์</b>');
  if(r.unlock === 'rebirth') out.push('ปลดล็อก <b>การเกิดใหม่</b>');
  if(r.unlock === 'pets') out.push('ปลดล็อก <b>คู่หูและดันเจี้ยน</b>');
  out.push('<b>' + D.GODS[i].gp + ' God Power</b> เมื่อเกิดใหม่');
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
  sec.innerHTML = toolbarHTML(kind) + '<div class="jobList">' + rows + '</div>';
  if(kind === 'mon') loadArt(sec);
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
      const now = Date.now();   // at most one pulse per row every 1.5s, so fast late-game levels don't strobe
      if(ref._lv !== undefined && r.lv > ref._lv && !motionOff() && !(now - ref._lvAt < 1500)){ ref._lvAt = now; replayAnim(ref.el, 'lvUp'); replayAnim(ref.lv, 'bump'); }
      ref._lv = r.lv;
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
  setShown(sec.hint, free > 0 && !planOn);
  if(free > 0 && !planOn) setText(sec.hint, 'มีร่างเงาว่าง ' + fmt(free) + ' ร่าง — กด + เพื่อส่งมาทำงาน' + (kind==='mon' ? ' (เลือกศัตรูสีเขียวเพื่อไม่ให้ร่างเงาตาย)' : ''));
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
    setText(sec.planNote, 'ร่างเงาถูกจัดให้เองทุกวินาที: ฝึกกาย ' + p.train + '% · วิชาเวท ' + p.skill + '% · สนามรบ ' + p.mon +
      '% ไปที่ขั้นสูงสุดและศัตรูสีเขียวที่ดีที่สุด (ส่วนที่ยังใช้ไม่ได้จะย้ายไปฝึกกาย) · จำไว้ข้ามการเกิดใหม่');
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
  if(!createOpen){
    if(s.challenge === 'nocreate') setHTML($('createLock'), 'ความท้าทาย "โลกไร้สรรพสิ่ง" — สร้างได้แค่ร่างเงาจนกว่าจะผ่าน');
    else setHTML($('createLock'), 'สร้างได้แค่ร่างเงาก่อน — ปลดล็อกการสร้างสรรพสิ่งเมื่อสังหาร <b>' + D.GODS[1].name + '</b>');
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
    if(!open){ setText(ref.lock, 'ปลดล็อกเมื่อสร้าง ' + D.CREATIONS[i-1].name + ' ได้ครั้งแรก'); return; }
    setClass(ref.el, 'active', c.target === item.key);
    setText(ref.btn, c.target === item.key ? 'กำลังเลือก' : 'เลือกสร้าง');
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
    <path d="M28 34 Q42 30 56 34 L56 50 Q42 68 28 50 Z" fill="#1c1832" stroke="${c}" stroke-width="1.5"/>
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
function godTarget(){ const g = D.GODS[s.gods]; return { kind:'god', i:s.gods, name:g.name, hp:g.hp, atk:g.atk, def:g.def, art:'g'+s.gods }; }
function ubTarget(i){ const u = G.ubStats(s, i); return { kind:'ub', i, name:u.name + ' Lv.' + G.ubLevel(s, i), hp:u.hp, atk:u.atk, def:u.def, art:'u'+i }; }
function fightOutlook(d, tg){
  tg = tg || arenaTarget();
  const ghp = s.fight ? s.fight.ghp : tg.hp;
  return G.outlook(s, d, tg, ghp);
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
        ? 'รางวัลเมื่อชนะ: <b>+' + D.ULTIMATES[tg.i].mp + ' แต้ม Might</b> · เลเวลถัดไปแข็งขึ้น ×' + D.UB_GROWTH
        : 'รางวัลเมื่อสังหาร: ' + rewardParts(tg.i).join(' · '));
      setText($('aGodName'), tg.name);
      setText($('aHeroHpTxt'), fmt(s.hp) + ' / ' + fmt(d.maxHp));
      setText($('aGodHpTxt'), fmt(s.fight ? s.fight.ghp : tg.hp) + ' / ' + fmt(tg.hp));
      setText($('aHeroAtk'), fmt(d.atk)); setText($('aHeroDef'), fmt(d.def));
      setText($('aGodAtk'), fmt(tg.atk)); setText($('aGodDef'), fmt(tg.def));
      setClass($('arena'), 'fighting', !!s.fight);
      const o = fightOutlook(d, tg);
      const pred = $('predict');
      setClass(pred, 'win', o.win); setClass(pred, 'lose', !o.win);
      let txt = o.win ? 'คาดการณ์: ชนะ ภายในราว ' + fmtTime(o.secs)
        : (G.neededFactor(s, d, tg) <= 1.0001 ? 'คาดการณ์: แพ้ตอนนี้ — รอพลังชีวิตฟื้นเต็มแล้วจะชนะ'
          : 'คาดการณ์: แพ้ — ต้องแข็งแกร่งขึ้นอีกราว ×' + fmt(G.neededFactor(s, d, tg)) + ' (ตอนนี้ทำดาเมจได้ ' + Math.floor(o.share*100) + '%)');
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
    setText(ref.desc, 'HP ' + fmt(st.hp) + ' · โจมตี ' + fmt(st.atk) + ' · ป้องกัน ' + fmt(st.def));
    setHTML(ref.cost, '<span class="pow ' + (o.win ? 'safe' : 'deadly') + '">' + (o.win ? 'คาดว่าชนะ' : 'คาดว่าแพ้') + '</span> · ชนะได้ +' + u.mp + ' Might');
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
  return compound ? '×' + fmt(Math.pow(1 + x.per, L)) : '+' + Math.round(x.per*L*100) + '%';
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
  if(!open) setHTML($('monoLock'), s.challenge === 'nocreate' ? 'ความท้าทาย "โลกไร้สรรพสิ่ง" ปิดอนุสรณ์ไว้จนกว่าจะผ่าน'
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
const ACH_LABEL = { clones:'มีร่างเงา', trainLv:'เลเวลฝึกกายรวม', skillLv:'เลเวลวิชาเวทรวม', kills:'ฆ่ามอนสเตอร์ในรอบเดียว', made:'สร้างของในรอบเดียว',
  gods:'สังหารเทพในรอบเดียว', rebirths:'เกิดใหม่', dpLife:'พลังเทวะสะสมตลอดกาล', monuments:'เลเวลอนุสรณ์รวม', genLv:'เครื่องผลิต Lv.' };
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
    setText(ref.lv, 'สำเร็จ ' + n + '/' + D.CHAL_MAX);
    setText(ref.desc, 'รางวัลต่อครั้ง: ' + c.rdesc + (n ? ' · ตอนนี้ ×' + fmt(Math.pow(1+c.per, n)) : ''));
    setText(ref.cost, maxed ? 'ทำครบแล้ว' : 'เป้าหมาย: สังหาร ' + D.GODS[G.chalGoal(s, c.key)].name);
    setText(ref.btn, active ? (isArmed('quit:' + c.key) ? 'แตะอีกครั้งเพื่อยอมแพ้' : 'ยอมแพ้')
                            : (isArmed('chal:' + c.key) ? 'แตะอีกครั้งเพื่อเกิดใหม่' : 'เริ่ม'));
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
    setHTML(ref.cost, maxed ? 'สูงสุดแล้ว' : '<span class="' + (m.mp < c ? 'short' : '') + '">' + c + ' Might</span>');
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
  setText($('rbInfo'), 'เกิดใหม่แล้ว ' + m.rebirths + ' ครั้ง · ถ้าเกิดใหม่ตอนนี้จะได้ +' + gain + ' God Power (จากเทพ ' + s.gods + ' องค์ที่สังหารในรอบนี้)');
  const armed = isArmed('rebirth');
  setText($('rbBtn'), !gain ? 'ต้องสังหารเทพอย่างน้อย 1 องค์ในรอบนี้' : armed ? 'แตะอีกครั้งเพื่อยืนยันการเกิดใหม่' : 'เกิดใหม่ · +' + gain + ' God Power');
  setDisabled($('rbBtn'), !gain);
  setClass($('rbBtn'), 'flee', armed);
  D.UPGRADES.forEach((u,i)=>{
    const ref = R.up[i], L = m.up[u.key] || 0, c = G.upgradeCost(s, u);
    setText(ref.lv, 'Lv.' + L);
    setText(ref.desc, u.desc + ' ต่อเลเวล' + (u.add ? '' : ' (ทบต้น)') + (L ? ' · ตอนนี้ ' + bonusText(u, L, true) : ''));
    setHTML(ref.cost, '<span class="' + (m.gp < c ? 'short' : '') + '">' + c + ' God Power</span>');
    setDisabled(ref.btn, m.gp < c); setDisabled(ref.max, m.gp < c);
  });
  const n = G.achCount(s);
  setText($('achSum'), n + '/' + D.ACHIEVEMENTS.length + ' · ค่าสถานะทั้งหมด +' + Math.round(n*D.ACH_BONUS*100) + '%');
  D.ACHIEVEMENTS.forEach((a,i)=>{
    const done = !!m.ach[a.key];
    setClass(R.ach[i].el, 'done', done);
    setBar(R.ach[i].bar, done ? 1 : G.achValue(s, a.type) / a.n);
  });
}

// ---------- pets: dungeons, pets, gear ----------
const STAT_TH = { phys:'กาย', myst:'เวท', dp:'พลังเทวะที่ได้', battle:'ยุทธ์', speed:'ความเร็วฝึก', clone:'พลังร่างเงา' };
let petView = 'dg';
const dgDepthSel = {}, dgMaxSeen = {};
function petUnlockText(p){
  const u = p.unlock;
  if(u.type === 'gods') return 'เข้าร่วมเมื่อสังหารเทพได้ ' + u.n + ' องค์ในรอบเดียว';
  if(u.type === 'rebirths') return 'เข้าร่วมเมื่อเกิดใหม่ ' + u.n + ' ครั้ง';
  return 'เข้าร่วมเมื่อได้ความสำเร็จ ' + u.n + ' อย่าง';
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
  $('gearList').innerHTML = D.GEAR.map(g=>`<div class="cItem">
      <div class="jobHead"><span class="jobName">${g.name}</span><span class="jobLv"></span></div>
      <div class="cDesc"></div>
      <div class="cFoot"><span class="cCost"></span><button class="selBtn" data-act="forge" data-key="${g.key}"></button></div>
    </div>`).join('');
  R.gear = [...document.querySelectorAll('#gearList .cItem')].map(el=>({ lv: el.querySelector('.jobLv'), desc: el.querySelector('.cDesc'),
    cost: el.querySelector('.cCost'), btn: el.querySelector('.selBtn') }));
}
function matsText(){
  return Object.keys(D.MATERIALS).map(k=>D.MATERIALS[k] + ' ' + fmt(s.meta.mats[k] || 0)).join(' · ');
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
      : (m.team.length ? 'เลือกดันเจี้ยนด้านล่างแล้วกดสำรวจ' : 'ยังไม่มีคู่หูในทีม — จัดทีมที่แท็บย่อย "คู่หู"'));
    if($('dgAuto').checked !== m.dgAuto) $('dgAuto').checked = m.dgAuto;
    setShown($('dgStop'), !!run);
    setText($('teamPow'), 'พลังทีม ' + fmt(tp));
    setText($('matLine'), matsText());
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
      setText(ref.lv, 'ผ่านสูงสุดชั้น ' + (m.dgBest[g.key] || 0) + '/' + D.MAX_DEPTH);
      setText(ref.time, fmtTime(G.dungeonTime(s, i)));
      setText(ref.n, 'ชั้น ' + dep);
      setDisabled(ref.dec, dep <= 1); setDisabled(ref.inc, dep >= maxD);
      setHTML(ref.info, 'พลังศัตรู ' + fmt(pow) + ' · <span class="' + (wc >= 1 ? 'pow safe' : wc >= 0.5 ? 'pow risky' : 'pow deadly') + '">โอกาสชนะ ' + Math.round(wc*100) + '%</span> · ชนะได้ ' + D.MATERIALS[g.mat] + ' ×' + (dep+1) + ', exp ' + fmt(g.exp*dep));
      const cur = run && run.i === i && run.depth === dep;
      setText(ref.go, cur ? 'กำลังสำรวจ' : 'สำรวจ');
      setDisabled(ref.go, cur || !m.team.length);
    });
  } else if(petView === 'pets'){
    setDisabled($('bestTeam'), Object.keys(m.pets).length === 0);
    setText($('teamLine'), 'ทีม ' + m.team.length + '/' + D.TEAM_SIZE + ' · พลังทีม ' + fmt(tp) + ' · คู่หูทุกตัวที่มีให้โบนัส แม้ไม่ได้อยู่ในทีม');
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
      setText(ref.desc, 'พลัง ' + fmt(G.petPower(s, p.key)) + ' · โบนัส ' + STAT_TH[p.stat] + ' ×' + fmt(Math.pow(1+p.per, st.lv-1)) + ' (ทบ ' + Math.round(p.per*100) + '%/เลเวล)');
      setText(ref.cost, st.lv >= D.PET_MAX_LV ? 'เลเวลสูงสุดแล้ว' : 'exp ' + fmt(st.exp) + '/' + fmt(need));
      setText(ref.btn, inTeam ? 'ออกจากทีม' : 'เข้าทีม');
      setDisabled(ref.btn, !inTeam && m.team.length >= D.TEAM_SIZE);
    });
  } else {
    setText($('matLine2'), matsText());
    D.GEAR.forEach((g,i)=>{
      const ref = R.gear[i], L = m.gear[g.key] || 0, cost = G.forgeCost(L), have = m.mats[g.mat] || 0;
      setText(ref.lv, L ? '+' + L : 'ยังไม่มี');
      setText(ref.desc, g.desc + ' ต่อเลเวล (ทบต้น)' + (L ? ' · ตอนนี้ ×' + fmt(Math.pow(1+g.per, L)) : ''));
      setHTML(ref.cost, '<span class="' + (have < cost ? 'short' : '') + '">' + D.MATERIALS[g.mat] + ' ' + fmt(have) + '/' + fmt(cost) + '</span> · โอกาสสำเร็จ ' + Math.round(G.forgeChance(L)*100) + '%');
      setText(ref.btn, L ? 'ตีบวก' : 'สร้าง');
      setDisabled(ref.btn, have < cost);
    });
  }
}

// ---------- tutorial & first-visit tips ----------
// each step finishes itself once its condition holds; the last one waits for the player
const TUT = [
  { tab:'train',  text:'ร่างเงาจะถูกสร้างขึ้นเองทีละร่าง — กด + ที่ "วิดพื้น" เพื่อส่งไปฝึก (เลือก "ทั้งหมด" เพื่อส่งทุกร่างในครั้งเดียว)', done:()=>s.train.some(r=>r.n>0) || s.meta.bestGods >= 1 },
  { tab:'mon',    text:'ส่งร่างเงาบางส่วนไปสู้ "ภูตหมอก" เพื่อหาพลังเทวะและค่ายุทธ์ — ศัตรูสีเขียวแปลว่าร่างเงาจะไม่ตาย', done:()=>s.mon.some(r=>r.n>0) || s.meta.bestGods >= 1 },
  { tab:'train',  text:'วิดพื้นถึง Lv.10 แล้ว "ซิทอัพ" จะปลดล็อก — ย้ายร่างเงาไปขั้นที่สูงกว่า เพราะได้พลังต่อเลเวลมากกว่า 6 เท่า', done:()=>s.train[1].n>0 || s.meta.bestGods >= 1 },
  { tab:'gods',   text:'ดูคาดการณ์ที่แท็บท้าเทพ เมื่อขึ้นว่า "ชนะ" ให้กดท้าสู้เทพสายฟ้า', done:()=>s.meta.bestGods >= 1 },
  { tab:'skill',  text:'วิชาเวทปลดล็อกแล้ว! แบ่งร่างเงาไปฝึกวิชาเวทเพื่อเพิ่มพลังป้องกัน — จำเป็นสำหรับเทพองค์ต่อไป', done:()=>s.skill.some(r=>r.n>0) || s.meta.bestGods >= 2 },
  { tab:'gods',   text:'เป้าหมายต่อไป: สังหารเทพสงคราม เพื่อปลดล็อกการสร้างสรรพสิ่ง', done:()=>s.meta.bestGods >= 2 },
  { tab:'create', text:'การสร้างปลดล็อกแล้ว! เลือกสร้าง "แสงสวรรค์" — ของทุกชิ้นที่เคยสร้างให้โบนัสถาวรจนจบรอบ', done:()=>(s.made.light||0) > 0 || s.meta.rebirths > 0 },
  { tab:null,     text:'จบบทสอนพื้นฐานแล้ว! ระบบใหม่จะปลดล็อกเมื่อสังหารเทพเพิ่ม — จุดสีทองบนแท็บบอกว่ามีอะไรใหม่', manual:true }
];
const TIPS = {
  mon:'ร่างเงาที่อ่อนกว่าศัตรูจะตาย! ดูสีพลังศัตรู: เขียว = ปลอดภัย, เหลือง = เสี่ยง, แดง = อันตราย',
  create:'เลือกของที่ต้องการ แล้วตัวละครจะสร้างต่อเนื่องเอง ถ้าวัตถุดิบขาดจะทำวัตถุดิบให้ก่อนอัตโนมัติ',
  gods:'ตัวละครสู้เองโดยแลกหมัดทุก 0.5 วินาที ถ้าแพ้ พลังชีวิตจะฟื้นเองเมื่อออกจากการต่อสู้',
  temple:'เครื่องผลิตสร้างพลังเทวะให้เองตลอดเวลา · อนุสรณ์ใช้พลังเทวะกับของที่สร้างไว้แลกตัวคูณ — ทั้งคู่รีเซ็ตเมื่อเกิดใหม่',
  pets:'คู่หู อุปกรณ์ และวัตถุดิบอยู่ถาวรข้ามการเกิดใหม่ · ส่งทีมไปดันเจี้ยนเก็บเลเวล แล้วนำวัตถุดิบไปตีบวกอุปกรณ์',
  rebirth:'ติดเทพองค์ไหนนานๆ ให้เกิดใหม่ — God Power ที่ได้ใช้ซื้ออัปเกรดถาวร ทำให้รอบต่อไปแข็งแกร่งกว่าเดิมมาก'
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
    if(s.fight) return 'กำลังสู้กับ ' + tg.name + '...';
    if(o.win) return 'พร้อมท้า ' + tg.name + ' แล้ว! ไปที่แท็บท้าเทพ (คาดว่าชนะใน ' + fmtTime(o.secs) + ')';
    const f = G.neededFactor(s, d, tg);
    let t = 'ต้องแข็งแกร่งขึ้นอีก ×' + fmt(f) + ' เพื่อชนะ ' + tg.name;
    if(rb && f > 20) t += ' · ยังห่างอีกมาก ลองเกิดใหม่ได้ +' + gain + ' God Power';
    return t;
  }
  if(G.ubUnlocked(s)) return 'สังหารเทพครบแล้ว! สู้สิ่งมีชีวิตสูงสุดเพื่อเก็บแต้ม Might' + (rb ? ' · หรือเกิดใหม่ได้ +' + gain + ' God Power' : '');
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
    try{ next = decodeSave($('importBox').value); }catch(e){ msg('โค้ดไม่ถูกต้อง — ตรวจว่าคัดลอกมาครบทั้งหมด'); return; }
    replaceState(next);
    $('importBox').value = '';
    addLog('โหลดเซฟจากโค้ดสำเร็จ');
    msg('โหลดเซฟสำเร็จ!');
    toast('โหลดเซฟสำเร็จ!');
  });
  $('wipeBtn').addEventListener('click', ()=>{
    if(!confirmTap('wipe')){ render(true); return; }
    replaceState(G.newState());
    addLog('เริ่มเกมใหม่ทั้งหมด — เริ่มต้นเส้นทางสังหารเทพอีกครั้ง');
    msg('ลบเซฟแล้ว เริ่มใหม่ตั้งแต่ต้น');
    selectTab('train');
  });
}

// ---------- HUD & tabs ----------
function renderHud(d, full){
  setBar($('hudHpBar'), s.hp / d.maxHp);
  if(!full) return;
  setText($('hudGods'), s.gods + '/' + D.GODS.length);
  const ch = s.challenge && D.CHALLENGES.find(c=>c.key===s.challenge);
  setShown($('chalBar'), !!ch);
  if(ch) setText($('chalBar'), '⚔ ความท้าทาย: ' + ch.name + ' — เป้าหมาย: สังหาร ' + D.GODS[G.chalGoal(s, ch.key)].name);
  setText($('hudHp'), fmt(s.hp) + '/' + fmt(d.maxHp));
  setText($('hudAtk'), fmt(d.atk));
  setText($('hudDef'), fmt(d.def));
  setText($('hudDp'), fmt(s.dp));
  setText($('hudClones'), fmt(s.clones) + '/' + fmt(d.maxClones));
}
const TABS = ['train','skill','mon','create','temple','pets','gods','rebirth','adv','log'];
const TAB_LOCK = { skill:['skills', ()=>G.skillsUnlocked(s)], temple:['gen', ()=>G.genUnlocked(s)], rebirth:['rebirth', ()=>G.rebirthUnlocked(s)], pets:['pets', ()=>G.petsUnlocked(s)], adv:['adv', ()=>G.advUnlocked(s)] };
const TAB_NAME = { adv:'โหมดผจญภัย', skill:'วิชาเวท', temple:'เทวาลัย', rebirth:'การเกิดใหม่', pets:'คู่หู' };
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
    toast(blocker ? 'ความท้าทาย "' + D.CHALLENGES.find(c=>c.key===s.challenge).name + '" ปิดวิชาเวทไว้จนกว่าจะผ่าน'
                  : 'ปลดล็อก' + TAB_NAME[name] + 'เมื่อสังหาร ' + D.GODS[D.UNLOCK_AT[TAB_LOCK[name][0]]].name);
    return;
  }
  if(name !== activeTab) $('main').scrollTop = 0;
  if(activeTab === 'adv' && name !== 'adv' && window.GKAdventure) GKAdventure.sleep();
  activeTab = name;
  alerts[name] = false;
  TABS.forEach(t=>setShown($('tab-'+t), t === name));
  document.querySelectorAll('.tab').forEach(t=>t.setAttribute('aria-pressed', t.dataset.tab === name ? 'true' : 'false'));
  setOn($('logBtn'), name === 'log');
  if(name === 'log') renderLog();
  if(name === 'adv') ensureAdv();
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
  else if(activeTab === 'adv'){ if(full) renderAdv(); }
  else if(activeTab === 'log'){ if(logDirty) renderLog(); if(full) setText($('wipeBtn'), isArmed('wipe') ? 'แตะอีกครั้งเพื่อลบทุกอย่าง' : 'เริ่มใหม่ทั้งหมด'); }
  if(full){ renderTabs(d); renderTutor(); }
}

// ---------- engine events ----------
let lastLost = 0, lastDeathToast = 0;
function handleEvents(ev, quiet){
  for(const e of ev){
    if(e.type === 'rowUnlock'){
      const def = JOB_DEFS[e.kind][e.i];
      addLog('ปลดล็อก' + (e.kind === 'train' ? 'การฝึกกาย' : 'วิชาเวท') + 'ใหม่: ' + def.name);
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
      if(!quiet){ toast('⚔ สังหาร ' + god.name + ' สำเร็จ!', 3); celebrate(); banner('⚔ สังหาร ' + god.name + '!'); sfx('win'); buzz([40,40,80]); }
      save();
    } else if(e.type === 'ach'){
      const a = D.ACHIEVEMENTS.find(x=>x.key===e.key);
      addLog('🏆 ความสำเร็จ: ' + a.name + ' (ค่าสถานะทั้งหมด +' + Math.round(D.ACH_BONUS*100) + '%)');
      alerts.rebirth = G.rebirthUnlocked(s);
      if(!quiet){ toast('🏆 ความสำเร็จ: ' + a.name); sfx('ping'); }
    } else if(e.type === 'pet'){
      const p = G.petDef(e.key);
      addLog('🐾 คู่หูใหม่: ' + p.name + ' เข้าร่วมทีม!');
      alerts.pets = true;
      if(!quiet) toast('🐾 คู่หูใหม่: ' + p.name, 2);
    } else if(e.type === 'dgDepth'){
      addLog('ผ่าน ' + D.DUNGEONS[e.i].name + ' ชั้น ' + e.depth + ' เป็นครั้งแรก');
    } else if(e.type === 'dgUnlock'){
      addLog('ปลดล็อกดันเจี้ยนใหม่: ' + D.DUNGEONS[e.i].name);
      alerts.pets = true;
      if(!quiet) toast('ปลดล็อกดันเจี้ยน: ' + D.DUNGEONS[e.i].name);
    } else if(e.type === 'chalDone'){
      const c = D.CHALLENGES.find(x=>x.key===e.key);
      addLog('🏅 ผ่านความท้าทาย ' + c.name + ' ครั้งที่ ' + e.n + '! ' + c.rdesc + ' ถาวร');
      if(!quiet){ toast('🏅 ผ่านความท้าทาย: ' + c.name, 3); celebrate(); }
      save();
    } else if(e.type === 'ubWin'){
      const u = D.ULTIMATES[e.i];
      addLog('💥 ชนะ ' + u.name + ' → Lv.' + e.lv + ' ได้ ' + e.mp + ' แต้ม Might');
      alerts.rebirth = true;
      if(!quiet){ toast('💥 ชนะ ' + u.name + '! +' + e.mp + ' Might', 2); celebrate(); banner('💥 ชนะ ' + u.name + '!'); sfx('win'); }
      save();
    } else if(e.type === 'ubLose'){
      addLog('พ่ายแพ้ต่อ ' + D.ULTIMATES[e.i].name + ' — ต้องแข็งแกร่งกว่านี้');
      if(!quiet){ toast('พ่ายแพ้... ต้องแข็งแกร่งกว่านี้', 2); banner('พ่ายแพ้...', true); sfx('lose'); }
    } else if(e.type === 'godLose'){
      addLog('พ่ายแพ้ต่อ ' + D.GODS[e.i].name + ' — ฝึกให้แข็งแกร่งขึ้นแล้วกลับมาใหม่');
      if(!quiet){ toast('พ่ายแพ้... ต้องแข็งแกร่งกว่านี้', 2); banner('พ่ายแพ้...', true); sfx('lose'); }
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
  fx.burst(g.x, g.y, 6, '#ece7fb', 70);
  fx.burst(h.x, h.y, 4, '#ff6b6b', 50);
  sfx('hit');
  if(!motionOff()){ replayAnim($('godArt'), 'hitFlash'); replayAnim($('heroPixel').parentNode, 'hurtFlash'); }
  const d = G.derive(s), tg = G.fightTarget(s, s.fight);
  floatDmg(g, G.blow(d.atk, tg.def), 'dealt');
  floatDmg(h, G.blow(tg.atk, d.def), 'taken');
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
    if(n){ addLog('สร้าง ' + mo.name + ' +' + n + ' เลเวล เป็น Lv.' + s.mono[mo.key]); toast(mo.name + ' Lv.' + s.mono[mo.key]); }
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
    if(!G.moveToBest(s, b.dataset.kind)) toast(b.dataset.kind === 'mon' ? 'ยังไม่มีศัตรูที่ร่างเงาสู้ได้อย่างปลอดภัย' : 'ยังไม่มีขั้นที่ใช้ได้');
  } else if(act === 'rbView'){
    rbView = b.dataset.v;
  } else if(act === 'ubSel'){
    arenaSel = +b.dataset.i;
    $('main').scrollTop = 0;
  } else if(act === 'might'){
    const x = D.MIGHT.find(y=>y.key===b.dataset.key);
    if(G.buyMight(s, x.key)){ addLog('Might: ' + x.name + (x.max > 1 ? ' Lv.' + G.mightLv(s, x.key) : '')); save(); }
  } else if(act === 'chal'){
    const key = b.dataset.key, c = D.CHALLENGES.find(x=>x.key===key);
    if(s.challenge === key){
      if(confirmTap('quit:' + key)){ G.abandonChallenge(s); addLog('ยอมแพ้ความท้าทาย ' + c.name + ' — กฎถูกยกเลิก รอบนี้เล่นต่อตามปกติ'); }
    }
    else if(confirmTap('chal:' + key)){
      const gain = G.rebirthGain(s);
      if(G.startChallenge(s, key)){
        rebirthFx();
        lastLost = s.clonesLost; shownArt = ''; arenaSel = 'god'; clearAlerts();
        addLog('⚔ เริ่มความท้าทาย ' + c.name + (gain ? ' (ได้ ' + gain + ' God Power)' : ''));
        toast('เริ่มความท้าทาย: ' + c.name); save();
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
    addLog('จัดทีมคู่หูที่แข็งที่สุด: ' + s.meta.team.map(k=>G.petDef(k).name).join(', '));
  } else if(act === 'forge'){
    const g = D.GEAR.find(x=>x.key===b.dataset.key), L = s.meta.gear[g.key] || 0;
    const ok = G.forge(s, g.key);
    if(ok === true){ addLog((L ? 'ตีบวก ' : 'สร้าง ') + g.name + ' สำเร็จ! +' + s.meta.gear[g.key]); toast(g.name + ' +' + s.meta.gear[g.key]); }
    else if(ok === false){ addLog('ตีบวก ' + g.name + ' ล้มเหลว เสียวัตถุดิบ'); toast('ตีบวกล้มเหลว!'); }
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
  addLog('🔄 เกิดใหม่ครั้งที่ ' + s.meta.rebirths + ' — ได้รับ ' + gain + ' God Power');
  toast('เกิดใหม่สำเร็จ! +' + gain + ' God Power');
  celebrate(); rebirthFx();
  save();
  selectTab('rebirth');
}
function onFight(){
  const tg = arenaTarget();
  if(s.fight){ G.flee(s); addLog('ถอยหนีจาก ' + (tg ? tg.name : 'การต่อสู้')); }
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
  hudHp:'พลังชีวิต — ลดลงระหว่างสู้กับเทพ และฟื้นเองเมื่อไม่ได้สู้ · เพิ่มได้จากกาย เวท และยุทธ์',
  hudAtk:'พลังโจมตี — ดาเมจที่ทำใส่เทพต่อครั้ง · มาจากกาย (ฝึกกาย) และยุทธ์ (สนามรบ)',
  hudDef:'พลังป้องกัน — ลดดาเมจที่ได้รับจากเทพ · มาจากเวท (วิชาเวท) และยุทธ์ (สนามรบ)',
  hudDp:'พลังเทวะ (DP) — ได้จากสนามรบและเครื่องผลิต · ใช้สร้างสรรพสิ่ง อัปเกรดเครื่องผลิต และสร้างอนุสรณ์',
  hudClones:'ร่างเงาที่มี / สูงสุด — ส่งร่างเงาไปฝึกกาย วิชาเวท และสนามรบ · สร้างเพิ่มได้ที่แท็บสร้าง',
  hudGods:'จำนวนเทพที่สังหารในรอบนี้ / ทั้งหมด'
};
const KEY_HELP = [
  ['1 – 8', 'เปิดแท็บตามลำดับ (ฝึกกาย … เกิดใหม่)'],
  ['L', 'เปิด/ปิดบันทึกและเซฟ'],
  ['F / Space', 'ท้าสู้หรือถอยหนี (ในแท็บท้าเทพ)'],
  ['S', 'ฟาดฟันเทวะ ระหว่างต่อสู้'],
  ['W A S D', 'เดินในโหมดผจญภัย (J หรือ Space โจมตี)'],
  ['H', 'เปิด/ปิดวิธีเล่น'],
  ['[ ]', 'สลับมุมมองย่อย (คู่หู · เกิดใหม่)'],
  ['Esc', 'ยกเลิกการยืนยันที่ค้างอยู่ / ปิดบันทึก'],
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
  if(e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  const t = e.target;
  if(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
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
  // in the adventure tab, arrows and Space move and attack instead of scrolling the page
  if(activeTab === 'adv' && /^(Arrow(Up|Down|Left|Right)|Space)$/.test(e.code)){ e.preventDefault(); return; }
  // e.code keeps shortcuts working on a Thai keyboard layout
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
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

function buzz(ms){ if(settings.vibrate && navigator.vibrate) try{ navigator.vibrate(ms); }catch(e){} }
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
        <label class="stRow"><span>สั่นเมื่อมีเหตุการณ์ (มือถือ)</span><input type="checkbox" data-set="vibrate"></label>
        <label class="stRow"><span>รูปแบบตัวเลข</span><select data-set="sci"><option value="0">ย่อ (1.5M, 2.3B)</option><option value="1">วิทยาศาสตร์ (1.50e6)</option></select></label>
        <label class="stRow"><span>อนิเมชัน</span><select data-set="motion"><option value="auto">ตามเครื่อง</option><option value="full">เต็ม</option><option value="reduced">ลดลง</option></select></label>
        <div class="btnPair"><button class="miniBtn" data-open="guide">📖 วิธีเล่น</button><button class="miniBtn" data-open="keys">⌨ ปุ่มลัด</button></div>
        <div class="note">การตั้งค่าเก็บแยกจากเซฟเกม ไม่หายเมื่อเกิดใหม่หรือโหลดเซฟ</div>
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
    if(!motionOff()){ const el = document.createElement('span'); el.className = 'dmg big'; el.textContent = '⚡-' + fmt(dmg); el.style.left = g.x + 'px'; el.style.top = (g.y - 34) + 'px'; $('arena').appendChild(el); setTimeout(()=>el.remove(), 800); }
  }
  render(true);
}
function renderStrike(){
  const b = $('strikeBtn');
  setShown(b, !!s.fight);
  if(!s.fight) return;
  const w = G.strikeWait(s);
  setDisabled(b, w > 0);
  setText($('strikeLabel'), w > 0 ? '⚡ ฟาดฟันเทวะ (พร้อมใน ' + Math.ceil(w) + ' วิ)' : '⚡ ฟาดฟันเทวะ! (S)');
}

// ---------- how-to-play guide ----------
function guideSections(){
  const god = k => D.GODS[D.UNLOCK_AT[k]].name;
  return [
    ['เป้าหมายของเกม', `<p>สังหารเทพทั้ง ${D.GODS.length} องค์ ตั้งแต่ ${D.GODS[0].name} จนถึง ${D.GODS[D.GODS.length-1].name} เทพแต่ละองค์ที่สังหารได้จะปลดล็อกระบบใหม่และทำให้แข็งแกร่งขึ้น</p>`],
    ['ร่างเงา', `<p>ร่างเงาถูกสร้างขึ้นเองทีละร่าง (ที่แท็บสร้าง) ส่งไปทำงานด้วยปุ่ม <b>+</b> เลือก ×1, ×10, ×100 หรือ "ทั้งหมด" เพื่อส่งทีละหลายร่าง บนมือถือกดค้างที่ + เพื่อเพิ่มต่อเนื่อง</p>`],
    ['ฝึกกาย / วิชาเวท', `<p>ฝึกกายเพิ่ม <b>พลังโจมตี</b> วิชาเวทเพิ่ม <b>พลังป้องกัน</b> ขั้นถัดไปปลดล็อกเมื่อขั้นก่อนถึง Lv.${D.ROW_UNLOCK_LEVEL} และให้พลังมากกว่าเดิมหลายเท่า ย้ายร่างเงาไปขั้นสูงสุดเสมอ (ปุ่ม "ย้ายไปขั้นที่ดีที่สุด")</p><p>วิชาเวทปลดล็อกเมื่อสังหาร ${god('skills')}</p>`],
    ['สนามรบ', `<p>ส่งร่างเงาไปสู้มอนสเตอร์เพื่อหา <b>พลังเทวะ (DP)</b> และค่ายุทธ์ ดูสีพลังศัตรู:</p><ul><li><b style="color:var(--ok)">เขียว</b> ปลอดภัย</li><li><b style="color:var(--warn)">เหลือง</b> ร่างเงาบางส่วนตาย</li><li><b style="color:var(--danger)">แดง</b> ร่างเงาตายเร็วมาก</li></ul>`],
    ['การสร้าง', `<p>เลือกของที่อยากสร้าง ตัวละครจะทำวัตถุดิบที่ขาดให้เอง ของทุกชิ้นที่เคยสร้างให้โบนัสจนจบรอบ ปลดล็อกเมื่อสังหาร ${god('create')} เกมจำของที่เลือกไว้ข้ามการเกิดใหม่</p>`],
    ['ท้าเทพ', `<p>ดูบรรทัด <b>คาดการณ์</b> ถ้าขึ้นว่า "ชนะ" ให้กดท้าสู้ ระหว่างสู้กด <b>⚡ ฟาดฟันเทวะ</b> เพื่อโจมตีแรงพิเศษ (ทุก ${D.STRIKE_CD} วินาที) ถ้าแพ้ พลังชีวิตจะฟื้นเองเมื่อออกจากการต่อสู้</p>`],
    ['เทวาลัย', `<p><b>เครื่องผลิต</b> สร้าง DP ให้ตลอดเวลา (ปลดล็อกเมื่อสังหาร ${god('gen')}) · <b>อนุสรณ์</b> ใช้ DP กับของที่สร้างแลกตัวคูณ (ปลดล็อกเมื่อสังหาร ${god('monuments')}) ทั้งคู่รีเซ็ตเมื่อเกิดใหม่ ใช้ปุ่ม "สูงสุด" เพื่อซื้อทีเดียวจนเงินหมด</p>`],
    ['เกิดใหม่และ God Power', `<p>ปลดล็อกเมื่อสังหาร ${god('rebirth')} เกิดใหม่จะเริ่มรอบใหม่ แต่ได้ <b>God Power</b> ตามเทพที่สังหารในรอบนั้น ใช้ซื้ออัปเกรดถาวร ถ้าแถบเป้าหมายบอกว่า "ยังห่างอีกมาก" แปลว่าเกิดใหม่คุ้มแล้ว</p>`],
    ['ความท้าทาย', `<p>เล่นรอบใหม่ภายใต้กฎพิเศษ ${D.CHALLENGES.length} แบบ สังหารเทพเป้าหมายได้จะได้โบนัสถาวร ทำซ้ำได้แบบละ ${D.CHAL_MAX} ครั้ง</p>`],
    ['สิ่งมีชีวิตสูงสุดและ Might', `<p>หลังสังหารเทพครบ ${D.GODS.length} องค์ในรอบเดียว จะสู้สิ่งมีชีวิตสูงสุดได้ไม่จำกัด ชนะแล้วได้แต้ม <b>Might</b> ไว้ซื้อความสามารถถาวร</p>`],
    ['คู่หู ดันเจี้ยน อุปกรณ์', `<p>ปลดล็อกเมื่อสังหาร ${god('pets')} ส่งทีมคู่หู ${D.TEAM_SIZE} ตัวไปดันเจี้ยนเพื่อเก็บเลเวลและวัตถุดิบ แล้วเอาวัตถุดิบไปตีบวกอุปกรณ์ ทั้งหมดอยู่ถาวรข้ามการเกิดใหม่</p>`],
    ['ผจญภัย', `<p>แท็บที่ 9 เป็นโลก 2D ที่ตัวละครเดินได้จริง แต่ละเขตคือสนามรบของมอนสเตอร์หนึ่งชนิด มอนสเตอร์จะไล่ตามเมื่อเข้าใกล้ ฆ่าได้ 1 ตัวเท่ากับฆ่าในสนามรบ ${D.ADV_KILL_WORTH} ตัว (ได้ DP และค่ายุทธ์) ยิ่งร่างเงาแข็งแกร่ง ตัวละครยิ่งตีแรงและทนขึ้น</p><ul><li>คอม: WASD หรือลูกศรเดิน · J หรือ Space โจมตี</li><li>มือถือ: แตะพื้นเพื่อเดิน แตะมอนสเตอร์เพื่อเดินเข้าไปโจมตีเอง</li><li>เดินเข้าประตูทองด้านขวาเพื่อไปเขตถัดไป</li></ul>`],
    ['ความสำเร็จ', `<p>ทุกความสำเร็จเพิ่มค่าสถานะทั้งหมด +${Math.round(D.ACH_BONUS*100)}% ดูได้ที่แท็บเกิดใหม่ › สำเร็จ</p>`],
    ['เล่นตอนออฟไลน์', `<p>ปิดเกมไปก็ยังได้ความคืบหน้าสูงสุด 8 ชั่วโมง กลับมาจะมีการ์ดสรุปให้ดู</p>`],
    ['ย้ายเซฟ', `<p>เซฟเก็บในเบราว์เซอร์ของแต่ละเครื่อง ย้ายเครื่องให้กด "คัดลอกโค้ด" ในหน้านี้ แล้วไปวางที่ช่อง "วางโค้ดเซฟ" ในเครื่องใหม่</p>`],
    ['เคล็ดลับ', `<ul><li>เปิด "จัดอัตโนมัติ" เพื่อให้เกมจัดร่างเงาเอง</li><li>บนคอมกด <b>?</b> ดูปุ่มลัด · บนมือถือปัดซ้าย/ขวาเพื่อเปลี่ยนแท็บ</li><li>ติดตั้งเกมเป็นแอปได้จากเมนูเบราว์เซอร์ "เพิ่มลงหน้าจอหลัก"</li></ul>`]
  ];
}
// sections for systems the player hasn't reached yet are shown locked, without spoilers
const GUIDE_LOCK = { 'ผจญภัย':'adv', 'วิชาเวท':'skills', 'การสร้าง':'create', 'เทวาลัย':'gen', 'เกิดใหม่และ God Power':'rebirth', 'ความท้าทาย':'rebirth', 'คู่หู ดันเจี้ยน อุปกรณ์':'pets' };
function guideLocked(title){
  const m = s.meta;
  if(title === 'สิ่งมีชีวิตสูงสุดและ Might') return G.ubUnlocked(s) || m.mpTotal > 0 ? '' : 'ปลดล็อกเมื่อสังหารเทพครบ ' + D.GODS.length + ' องค์ในรอบเดียว';
  const k = GUIDE_LOCK[title];
  if(!k || m.bestGods > D.UNLOCK_AT[k] || m.rebirths > 0 && (k === 'rebirth' || k === 'skills' || k === 'create' || k === 'gen')) return '';
  return 'ปลดล็อกเมื่อสังหาร ' + D.GODS[D.UNLOCK_AT[k]].name;
}
function guideHTML(){
  const secs = guideSections().map(([t,h])=>{ const lock = guideLocked(t); return [lock ? '🔒 ' + t : t, lock ? '<p class="note">' + lock + ' — รายละเอียดจะเปิดให้อ่านเมื่อปลดล็อก</p>' : h]; });
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
    if(e.target.closest('textarea,input,.seg,#advGame')) return;
    const order = [...document.querySelectorAll('#tabs .tab')].map(x=>x.dataset.tab).filter(n=>!tabLocked(n));
    const i = order.indexOf(activeTab);
    if(i < 0) return;
    const next = order[i + (dx < 0 ? 1 : -1)];
    if(next) selectTab(next);
  }, { passive:true });
}

// ---------- adventure mode host (the Phaser scene lives in adventure.js, loaded on first visit) ----------
let advState = 0, advZone = 0, advAtkQueued = false;   // advState: 0 not loaded, 1 loading, 2 ready
const advApi = {
  startZone: ()=>Math.min(advZone, G.advZones(s) - 1),
  zones: ()=>G.advZones(s),
  stats: z=>G.advStats(s, z),
  kill: z=>{ const g = G.advKill(s, z); if(g) sfx('ping'); return g; },
  zoneChanged: z=>{ advZone = z; renderAdv(); },
  hud: hp=>setBar($('advHp'), hp / 100),
  message: t=>toast(t),
  monName: i=>D.MONSTERS[i] ? D.MONSTERS[i].name : '',
  fmt, sfx, reduced: motionOff,
  takeAttack: ()=>{ const a = advAtkQueued; advAtkQueued = false; return a; }
};
function loadScript(src){ return new Promise((ok, bad)=>{ const e = document.createElement('script'); e.src = src; e.onload = ok; e.onerror = bad; document.head.appendChild(e); }); }
function ensureAdv(){
  if(advState === 2){ GKAdventure.wake(); return; }
  if(advState === 1) return;
  advState = 1;
  setText($('advMsg'), 'กำลังโหลดโลกผจญภัย...');
  loadScript('god-killer/vendor/phaser.min.js').then(()=>loadScript('god-killer/adventure.js')).then(()=>{
    advState = 2;
    setText($('advMsg'), '');
    GKAdventure.mount($('advGame'), advApi);
    if(activeTab !== 'adv') GKAdventure.sleep();
  }).catch(()=>{ advState = 0; setText($('advMsg'), 'โหลดโหมดผจญภัยไม่สำเร็จ — ตรวจการเชื่อมต่อแล้วเปิดแท็บนี้ใหม่'); });
}
function renderAdv(){
  const n = G.advZones(s), z = Math.min(advZone, n - 1), mon = D.MONSTERS[z], rt = G.advStats(s, z);
  setText($('advZone'), (z + 1) + '/' + n + ' ' + mon.name);
  setHTML($('advKills'), 'ฆ่าแล้ว ' + fmt(s.meta.adv.kills) + '<span class="advRatio"> · แข็งกว่ามอนสเตอร์ ×' + fmt(rt.ratio) + '</span>');
  setDisabled($('advPrev'), z <= 0); setDisabled($('advNext'), z >= n - 1);
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
  addLog('ขณะไม่อยู่ ' + fmtTime(sec) + ': พลังเทวะ +' + fmt(s.dpTotal - dp0) + ' · กาย +' + fmt(d1.phys - d0.phys) + ' · เวท +' + fmt(d1.myst - d0.myst) +
    (s.clonesLost > lost0 ? ' · ร่างเงาตาย ' + fmt(s.clonesLost - lost0) : ''));
  if(sec < 60) return;
  const rows = [
    ['พลังเทวะ', '+' + fmt(s.dpTotal - dp0)],
    ['กาย', '+' + fmt(d1.phys - d0.phys)],
    ['เวท', '+' + fmt(d1.myst - d0.myst)],
    ['โจมตี', fmt(d0.atk) + ' → ' + fmt(d1.atk)]
  ];
  if(gods.length) rows.push(['สังหารเทพ', gods.length + ' องค์: ' + gods.join(', ')]);
  if(s.clonesLost > lost0) rows.push(['ร่างเงาตาย', fmt(s.clonesLost - lost0) + ' ร่าง']);
  if(dg.runs) rows.push(['ดันเจี้ยน', dg.runs + ' รอบ (ชนะ ' + dg.wins + ')']);
  if(ubWins) rows.push(['สิ่งมีชีวิตสูงสุด', 'ชนะ ' + ubWins + ' ครั้ง · Might +' + fmt(s.meta.mp - mp0)]);
  if(ach) rows.push(['ความสำเร็จใหม่', ach + ' อย่าง']);
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' })[c]);
  welcomeHTML = '<div class="wbCard" role="dialog" aria-label="สรุปขณะไม่อยู่"><div class="wbTitle">ยินดีต้อนรับกลับ!</div>' +
    '<div class="note">ไม่อยู่ ' + fmtTime(sec) + (raw > G.MAX_OFFLINE_SEC ? ' (นับสูงสุด ' + fmtTime(G.MAX_OFFLINE_SEC) + ')' : '') + '</div>' +
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
  buildCreate(); buildGods(); buildTemple(); buildRebirth(); buildPets(); buildUltimates(); buildPhase4();
  renderSteps();
  drawPixelHero($('heroPixel'));
  fx = initFX($('fx'));

  $('main').addEventListener('click', onMainClick);
  $('fightBtn').addEventListener('click', onFight);
  $('genBtn').addEventListener('click', onGen);
  $('genMaxBtn').addEventListener('click', onGenMax);
  $('strikeBtn').addEventListener('click', onStrike);
  $('advAtk').addEventListener('click', ()=>{ advAtkQueued = true; });
  $('advPrev').addEventListener('click', ()=>{ if(advState === 2) GKAdventure.goZone(Math.max(0, GKAdventure.zone() - 1)); });
  $('advNext').addEventListener('click', ()=>{ if(advState === 2) GKAdventure.goZone(Math.min(G.advZones(s) - 1, GKAdventure.zone() + 1)); });
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
  document.querySelectorAll('svg.ic').forEach(i=>i.setAttribute('aria-hidden', 'true'));   // decorative icons next to text
  $('dgStop').addEventListener('click', ()=>{ G.stopDungeon(s); addLog('หยุดสำรวจดันเจี้ยน'); render(true); });
  $('dgAuto').addEventListener('change', e=>{ s.meta.dgAuto = e.target.checked; render(true); });
  $('rbBtn').addEventListener('click', onRebirth);
  $('logBtn').addEventListener('click', toggleLog);
  $('autoClone').addEventListener('change', e=>{ s.create.autoClone = e.target.checked; render(true); });
  document.querySelectorAll('.tab').forEach(t=>{
    t.addEventListener('click', ()=>selectTab(t.dataset.tab));
    t.addEventListener('keydown', e=>{ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); selectTab(t.dataset.tab); } });
  });

  if(!s.log.length) addLog('เริ่มต้นเส้นทางสังหารเทพ: ร่างเงาจะถูกสร้างขึ้นเองทีละร่าง ส่งไปฝึกกายและสนามรบ แล้วท้าเทพสายฟ้าเมื่อคาดการณ์ว่าชนะ');
  if(!storageOk) addLog('เบราว์เซอร์นี้ไม่อนุญาตให้บันทึกเกม — ความคืบหน้าจะหายเมื่อปิดหน้า');
  selectTab('train');
  initPlatform();
  showWelcome();

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
