// God Killer — visual effects: qi particles, floating gains, seal stamps, the rebirth wheel.
// Pure decoration: it never reads or changes game state, only what ui.js hands it (window.GKFX).
// Everything is off when ui.js marks <html data-motion="reduced"> (the motionOff() setting / OS preference).
(function(){
'use strict';
const root = document.documentElement;
const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
// same answer as ui.js motionOff(): ui.js mirrors it into data-motion; before boot fall back to the OS setting
function off(){
  if(document.hidden) return true;
  const m = root.dataset.motion;
  return m ? m === 'reduced' : !!(mq && mq.matches);
}
function replay(el, cls){ el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
// centre of an element in viewport space, or null when it isn't on screen
function posOf(el){
  if(!el) return null;
  const r = el.getBoundingClientRect();
  if(!(r.width > 0) || r.bottom < 0 || r.top > innerHeight) return null;
  return { x: r.left + r.width/2, y: r.top + r.height/2, r };
}

// ---------- one fixed canvas for every burst; the loop runs only while particles are alive ----------
const MAX = 170, TAU = Math.PI*2;
let cv = null, ctx = null, W = 0, H = 0, dirty = true, running = false, last = 0;
const parts = [];
function layer(){
  if(!cv){
    cv = document.createElement('canvas');
    cv.id = 'fxLayer'; cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    ctx = cv.getContext('2d');
    window.addEventListener('resize', ()=>{ dirty = true; });
  }
  if(dirty && !running){
    dirty = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);   // phones: fewer pixels to clear each frame
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  return !!ctx;
}
// soft glow dots and four-point glints, drawn once per colour and reused
const sprites = {};
function sprite(color, star){
  const key = color + (star ? '*' : '');
  if(sprites[key]) return sprites[key];
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, '#fff'); grd.addColorStop(0.22, color); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  if(star){
    g.globalAlpha = 0.55; g.beginPath(); g.arc(16, 16, 7, 0, TAU); g.fill(); g.globalAlpha = 1;
    g.fillRect(15, 0, 2, 32); g.fillRect(0, 15, 32, 2);
  } else { g.beginPath(); g.arc(16, 16, 16, 0, TAU); g.fill(); }
  return (sprites[key] = c);
}
function start(){
  if(running) return;
  running = true; last = performance.now();
  requestAnimationFrame(frame);
}
function frame(now){
  const dt = Math.min(0.05, (now - last)/1000); last = now;
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  let n = 0;
  for(let i=0;i<parts.length;i++){
    const p = parts[i];
    p.life += dt;
    if(p.life >= p.max) continue;
    parts[n++] = p;
    if(p.life < 0) continue;                       // delayed start
    const t = p.life/p.max;
    if(p.ring){
      const e = 1 - (1-t)*(1-t)*(1-t);
      ctx.globalAlpha = (1-t)*p.a;
      ctx.strokeStyle = p.color; ctx.lineWidth = p.w*(1-t) + 0.6;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r0 + (p.r1-p.r0)*e, 0, TAU); ctx.stroke();
      continue;
    }
    if(p.tx !== undefined){                        // drawn in toward a point (rebirth)
      const e = t*t*t;
      p.x = p.ox + (p.tx - p.ox)*e; p.y = p.oy + (p.ty - p.oy)*e;
    } else {
      const k = Math.pow(p.drag, dt*60);
      p.vx *= k; p.vy = p.vy*k + p.g*dt;
      p.x += p.vx*dt; p.y += p.vy*dt;
    }
    ctx.globalAlpha = (t < 0.12 ? t/0.12 : 1 - (t-0.12)/0.88) * p.a;
    const sz = p.s*(1 - 0.45*t);
    ctx.drawImage(p.img, p.x - sz/2, p.y - sz/2, sz, sz);
  }
  parts.length = n;
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if(n && !document.hidden) requestAnimationFrame(frame);
  else { parts.length = 0; running = false; ctx.clearRect(0, 0, W, H); }
}
// o: n, colors, speed, size, life, g (px/s², negative rises), drag, delay, star, spread (start radius), up (upward bias)
function burst(x, y, o){
  if(!layer()) return;
  const cols = o.colors;
  for(let i=0;i<o.n && parts.length < MAX;i++){
    const a = o.up ? -Math.PI/2 + (Math.random()-0.5)*(o.arc || 1.6) : Math.random()*TAU;
    const v = o.speed*(0.35 + Math.random()*0.85), sp = (o.spread || 0)*Math.random();
    parts.push({ x: x + Math.cos(a)*sp, y: y + Math.sin(a)*sp, vx: Math.cos(a)*v, vy: Math.sin(a)*v,
      g: o.g || 0, drag: o.drag || 0.94, s: o.size*(0.6 + Math.random()*0.8), a: 1,
      life: -(o.delay || 0) - Math.random()*(o.jitter || 0), max: o.life*(0.6 + Math.random()*0.7),
      img: sprite(cols[i % cols.length], o.star) });
  }
  start();
}
function ring(x, y, r0, r1, color, w, dur, delay){
  if(!layer() || parts.length >= MAX) return;
  parts.push({ ring:true, x, y, r0, r1, color, w, a:0.9, life: -(delay || 0), max: dur });
  start();
}

// ---------- DOM effects (transform/opacity animations, removed when done) ----------
let floats = 0;
function float(el, text, cls){
  const p = posOf(el);
  if(!p || floats >= 6) return;
  const f = document.createElement('span');
  f.className = 'fxFloat ' + (cls || '');
  f.textContent = text;
  f.style.left = Math.round(Math.max(30, Math.min(innerWidth - 30, p.x))) + 'px';
  f.style.top = Math.round(p.r.top - 4) + 'px';
  f.setAttribute('aria-hidden', 'true');
  document.body.appendChild(f);
  floats++;
  setTimeout(()=>{ f.remove(); floats--; }, 1300);
}

// seal stamp for unlocks and achievements; one at a time, the most important wins
const SEAL = { chalDone:[4,'勝'], ach:[3,'成'], pet:[2,'契'], dgUnlock:[2,'開'], firstCreate:[1,'創'], rowUnlock:[1,'悟'] };
let sealEl = null, sealUntil = 0, sealPrio = 0;
function seal(glyph, prio){
  const now = performance.now();
  if(now < sealUntil && prio <= sealPrio) return;
  if(!sealEl){
    sealEl = document.createElement('div');
    sealEl.id = 'fxSeal'; sealEl.setAttribute('aria-hidden', 'true');
    sealEl.innerHTML = '<span></span>';
    document.body.appendChild(sealEl);
  }
  sealEl.firstChild.textContent = glyph;
  sealPrio = prio; sealUntil = now + 1500;
  replay(sealEl, 'show');
  setTimeout(()=>{                                  // ink and qi splash when the seal lands
    const p = posOf(sealEl);
    if(!p || off()) return;
    ring(p.x, p.y, 20, 64, '#e8c76f', 3, 0.55);
    burst(p.x, p.y, { n:12, colors:['#ff7a5c','#e8c76f'], speed:170, size:9, life:0.55, drag:0.9, spread:24 });
  }, 260);
}

function kill(){
  const el = document.getElementById('godArt');
  let p = posOf(el);
  if(p){ replay(el, 'fxSlain'); setTimeout(()=>el.classList.remove('fxSlain'), 1200); }   // drop it so hit jolts work again
  else p = { x: innerWidth/2, y: innerHeight*0.38 };  // god slain on another tab: bloom under the banner
  const R = Math.min(innerWidth, 480);
  ring(p.x, p.y, 16, R*0.42, '#fff3c4', 5, 0.7);
  ring(p.x, p.y, 10, R*0.3, '#8b5cf6', 4, 0.8, 0.12);
  burst(p.x, p.y, { n:40, colors:['#e8c76f','#fff3d0','#ffd66b'], speed:330, size:12, life:0.9, drag:0.92 });
  burst(p.x, p.y, { n:22, colors:['#b39cf0','#8b5cf6','#7fb0ff'], speed:70, size:14, life:1.6, g:-60, drag:0.97, spread:30, delay:0.1, jitter:0.3 });
}

let wheel = null;
function rebirth(){
  if(off()) return;
  if(!wheel){
    wheel = document.createElement('div');
    wheel.id = 'fxWheel'; wheel.setAttribute('aria-hidden', 'true');
    wheel.innerHTML = '<i></i><i></i><i></i><b>輪</b>';
    document.body.appendChild(wheel);
  }
  replay(wheel, 'show');
  const cx = innerWidth/2, cy = innerHeight*0.45, R = Math.max(innerWidth, innerHeight)*0.55;
  if(!layer()) return;
  for(let i=0;i<48 && parts.length < MAX;i++){        // qi drawn into the centre ...
    const a = Math.random()*TAU, d = R*(0.55 + Math.random()*0.45);
    parts.push({ ox: cx + Math.cos(a)*d, oy: cy + Math.sin(a)*d, tx: cx, ty: cy, x:0, y:0, s: 8 + Math.random()*8, a:1,
      life: -Math.random()*0.15, max: 0.55 + Math.random()*0.1, img: sprite(i % 3 ? '#e8c76f' : '#b39cf0') });
  }
  start();
  // ... then released as a new life begins
  burst(cx, cy, { n:44, colors:['#fff3d0','#e8c76f','#b39cf0'], speed:420, size:13, life:1.0, drag:0.93, delay:0.62 });
  ring(cx, cy, 10, R*0.9, '#fff3c4', 6, 0.9, 0.62);
  ring(cx, cy, 10, R*0.6, '#8b5cf6', 4, 1.0, 0.75);
}

const api = {
  off,
  // engine events from ui.js handleEvents (not called for the offline catch-up)
  events(ev){
    if(off()) return;
    let best = null, killed = false;
    for(const e of ev){
      if(e.type === 'godWin' || e.type === 'ubWin') killed = true;
      const sd = SEAL[e.type];
      if(sd && (!best || sd[0] > best[0])) best = sd;
    }
    if(killed) kill();
    if(best) seal(best[1], best[0]);
  },
  // a training row levelled up: golden glints rise off its level tag
  sparkle(el){
    if(off()) return;
    const p = posOf(el);
    if(p) burst(p.x, p.y, { n:7, colors:['#ffe7a3','#e8c76f'], speed:60, size:11, life:0.8, g:-40, drag:0.95, star:true, spread:10, up:true, arc:2.4 });
  },
  // floats "+gain" above a counter at most every 1.6s while its value climbs; a drop (spent, rebirth) resets it
  watch(el, v, fmt){
    if(!el || !Number.isFinite(v)) return;
    const now = performance.now();
    if(el._fxV === undefined || v < el._fxV){ el._fxV = v; el._fxT = now; return; }
    if(now - el._fxT < 1600) return;
    const dv = v - el._fxV;
    el._fxV = v; el._fxT = now;
    if(dv > 0 && !off()) float(el, '+' + fmt(dv), 'dp');
  },
  // a heavy blow: the whole arena jolts
  shake(el){ if(el && !off()) replay(el, 'fxShake'); },
  rebirth,
  kill, seal, burst, ring
};
window.GKFX = api;

// ---------- drifting qi motes behind the page, made once; CSS moves them ----------
function motes(){
  const bg = document.getElementById('bgScene');
  if(!bg || bg.querySelector('.fxMote')) return;
  const n = innerWidth < 600 ? 7 : 12;
  for(let i=0;i<n;i++){
    const m = document.createElement('span');
    m.className = 'fxMote' + (i % 3 === 0 ? ' v' : '');
    m.style.left = (4 + Math.random()*92).toFixed(1) + '%';
    m.style.animationDuration = (14 + Math.random()*12).toFixed(1) + 's';
    m.style.animationDelay = (-Math.random()*26).toFixed(1) + 's';
    bg.appendChild(m);
  }
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', motes); else motes();
})();
