// God Killer — adventure mode art and maps.
// Everything is drawn procedurally onto canvases, so there are no image files to load.
(function(){
'use strict';
const T = 16;                 // tile size in world pixels (the camera zooms 2x, so the art stays crisp)
const MAP_W = 44, MAP_H = 30; // tiles per zone
const SOLID = [3, 4, 5, 9, 10, 11, 12];   // water, tree, rock; in the realm also pavilion, spring, furnace, lotus
const MON_PER_ZONE = 8;

// one palette per zone, in the order of D.MONSTERS
const THEMES = [
  { g1:'#5d7a6a', g2:'#688777', path:'#9a9486', water:'#6f9bb0', tree:'#2f4a3e', rock:'#8a8f92', mon:'#dff6f2' },   // mist spirit
  { g1:'#3c5a34', g2:'#46663c', path:'#7d6a4c', water:'#3f6f8a', tree:'#1f3320', rock:'#6d6a70', mon:'#2a2236' },   // shadow wolf
  { g1:'#6f7a54', g2:'#7b865e', path:'#a99d82', water:'#5a8aa0', tree:'#3e4a2e', rock:'#8d8d95', mon:'#8a8a92' },   // stone golem
  { g1:'#4b5f36', g2:'#55693e', path:'#6f6044', water:'#4f6b4a', tree:'#26351c', rock:'#5d6258', mon:'#1f2b1f' },   // venom cobra
  { g1:'#5a3c2c', g2:'#664434', path:'#8a6a4a', water:'#c8501e', tree:'#2e1a14', rock:'#5a4a44', mon:'#c0341e' },   // fire demon
  { g1:'#3f6a3a', g2:'#497542', path:'#8a7a52', water:'#3f7fa0', tree:'#1f4020', rock:'#707a6a', mon:'#3aa05a' },   // yaksha
  { g1:'#3d6670', g2:'#467380', path:'#b8a878', water:'#2a5f8a', tree:'#23434a', rock:'#6a7f86', mon:'#1c2a3a' },   // makara
  { g1:'#44485e', g2:'#4d526a', path:'#7c7a8a', water:'#3b4f7a', tree:'#23253a', rock:'#6c6f86', mon:'#9fb8ff' },   // lightning demon
  { g1:'#4a3f5e', g2:'#54486a', path:'#8a7f9a', water:'#5a4a8a', tree:'#2a2238', rock:'#7a6f8a', mon:'#ff5a8a' },   // time demon
  { g1:'#4a2a2e', g2:'#553136', path:'#7a5a50', water:'#8a1e1e', tree:'#26141a', rock:'#5a4448', mon:'#ff3a3a' }    // demon king
];

// small deterministic RNG so every zone is the same map each visit
function rng(seed){ return ()=>{ seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- procedural pixel art (tileset + sprite sheets drawn onto canvases) ----------
function px(ctx, c, x, y, w, h){ ctx.fillStyle = c; ctx.fillRect(x, y, w || 1, h || 1); }
function shade(hex, k){
  const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return '#' + [f(n >> 16), f(n >> 8 & 255), f(n & 255)].map(v=>v.toString(16).padStart(2, '0')).join('');
}
// tileset: 0 grass, 1 grass alt, 2 path, 3 water, 4 tree, 5 rock, 6 flowers, 7 portal
function drawTileset(th){
  const c = document.createElement('canvas'); c.width = T * 8; c.height = T;
  const x = c.getContext('2d'), r = rng(7);
  const grass = (o, base) => { px(x, base, o, 0, T, T); for(let i = 0; i < 14; i++) px(x, shade(base, r() < .5 ? 1.18 : .82), o + (r()*T|0), r()*T|0, 1, 2); };
  grass(0, th.g1); grass(T, th.g2);
  px(x, th.path, 2*T, 0, T, T); for(let i = 0; i < 10; i++) px(x, shade(th.path, r() < .5 ? 1.15 : .85), 2*T + (r()*T|0), r()*T|0, 2, 1);
  px(x, th.water, 3*T, 0, T, T); for(let i = 0; i < 4; i++) px(x, shade(th.water, 1.3), 3*T + 2 + (r()*10|0), 2 + i*4, 4, 1);
  grass(4*T, th.g1); px(x, shade(th.tree, .7), 4*T + 7, 11, 2, 5);
  x.fillStyle = th.tree; x.beginPath(); x.arc(4*T + 8, 7, 6.5, 0, 7); x.fill();
  px(x, shade(th.tree, 1.35), 4*T + 5, 4, 2, 2); px(x, shade(th.tree, 1.2), 4*T + 9, 6, 2, 1);
  grass(5*T, th.g2); x.fillStyle = th.rock; x.beginPath(); x.ellipse(5*T + 8, 10, 6.5, 5, 0, 0, 7); x.fill();
  px(x, shade(th.rock, 1.3), 5*T + 5, 7, 3, 1); px(x, shade(th.rock, .7), 5*T + 6, 13, 6, 1);
  grass(6*T, th.g1); [['#ffd66b',4,5],['#ff8aa8',10,3],['#ffffff',7,11],['#ffd66b',12,12]].forEach(([c2,a,b])=>{ px(x, c2, 6*T + a, b, 2, 2); });
  px(x, th.path, 7*T, 0, T, T); x.strokeStyle = '#e8c76f'; x.lineWidth = 2; x.beginPath(); x.arc(7*T + 8, 8, 5.5, 0, 7); x.stroke();
  px(x, '#c9a6ff', 7*T + 6, 6, 4, 4);
  return c;
}
// hero sheet: 4 rows (down, left, right, up) × 6 frames (0 idle, 1-4 walk, 5 attack), 16×16 each
function drawHero(){
  const c = document.createElement('canvas'); c.width = T * 6; c.height = T * 4;
  const x = c.getContext('2d');
  const P = { hair:'#241a3d', skin:'#e8c49a', armor:'#6941b3', light:'#8b5cf6', gold:'#e8c76f', blade:'#fff3d0', leg:'#1c1832' };
  for(let d = 0; d < 4; d++) for(let f = 0; f < 6; f++){
    const ox = f*T, oy = d*T, bob = f >= 1 && f <= 4 ? (f % 2) : 0, step = f === 1 ? 1 : f === 3 ? -1 : 0;
    px(x, P.leg, ox + 5 + (step > 0 ? 1 : 0), oy + 12, 2, 3); px(x, P.leg, ox + 9 - (step < 0 ? 1 : 0), oy + 12, 2, 3);
    px(x, P.armor, ox + 4, oy + 7 - bob, 8, 5); px(x, P.light, ox + 5, oy + 8 - bob, 2, 3); px(x, P.gold, ox + 4, oy + 11 - bob, 8, 1);
    px(x, P.skin, ox + 5, oy + 2 - bob, 6, 5); px(x, P.hair, ox + 4, oy + 1 - bob, 8, 2);
    if(d === 3) px(x, P.hair, ox + 5, oy + 3 - bob, 6, 3);                         // back of the head
    else if(d === 0){ px(x, '#1a1420', ox + 6, oy + 4 - bob); px(x, '#1a1420', ox + 9, oy + 4 - bob); }
    else px(x, '#1a1420', ox + (d === 1 ? 6 : 9), oy + 4 - bob);
    // sword: held at the side, swung forward on the attack frame
    const sx = d === 1 ? 2 : d === 2 ? 13 : 12, atk = f === 5;
    if(atk){
      if(d === 0) px(x, P.blade, ox + 7, oy + 12, 2, 4);
      else if(d === 3) px(x, P.blade, ox + 7, oy, 2, 4);
      else px(x, P.blade, d === 1 ? ox : ox + 12, oy + 8, 4, 2);
    } else px(x, P.blade, ox + sx, oy + 5 - bob, 1, 6);
  }
  return c;
}
// monster sheet: one row per zone, 2 frames (bob), drawn with a shape per monster kind
function drawMonsters(){
  const c = document.createElement('canvas'); c.width = T * 2; c.height = T * THEMES.length;
  const x = c.getContext('2d');
  THEMES.forEach((th, z)=>{
    for(let f = 0; f < 2; f++){
      const ox = f*T, oy = z*T, b = f, col = th.mon, dark = shade(col, .6), eye = z === 0 ? '#1a3a3a' : ['#ffd24a','#6ff0ff','#aaff5a','#ffe27a','#ff4040','#ff5a5a','#dff0ff','#fff','#ff3a3a'][z-1] || '#fff';
      x.globalAlpha = z === 0 ? .85 : 1;
      if(z === 0){ px(x, col, ox + 4, oy + 3 + b, 8, 10); px(x, col, ox + 3, oy + 13 + b, 2, 2); px(x, col, ox + 7, oy + 13 + b, 2, 2); px(x, col, ox + 11, oy + 13 + b, 2, 2); }
      else if(z === 1){ px(x, col, ox + 3, oy + 6 + b, 10, 7); px(x, col, ox + 3, oy + 3 + b, 2, 3); px(x, col, ox + 11, oy + 3 + b, 2, 3); px(x, dark, ox + 6, oy + 11 + b, 4, 3); }
      else if(z === 2){ px(x, col, ox + 3, oy + 3 + b, 10, 11); px(x, '#5a8a4a', ox + 3, oy + 3 + b, 10, 2); px(x, dark, ox + 5, oy + 11 + b, 6, 1); }
      else if(z === 3){ px(x, col, ox + 5, oy + 2 + b, 6, 8); px(x, col, ox + 7, oy + 10 + b, 3, 5); px(x, '#5aff7a', ox + 5, oy + 6 + b, 6, 1); }
      else if(z === 4){ px(x, col, ox + 4, oy + 4 + b, 8, 10); px(x, '#2a1410', ox + 3, oy + 1 + b, 2, 4); px(x, '#2a1410', ox + 11, oy + 1 + b, 2, 4); px(x, '#ff9a3c', ox + 5, oy + 13 + b, 6, 1); }
      else if(z === 5){ px(x, col, ox + 3, oy + 4 + b, 10, 10); px(x, '#ffd24a', ox + 4, oy + 1 + b, 8, 3); px(x, '#ffd24a', ox + 7, oy + b, 2, 1); px(x, '#fff', ox + 5, oy + 11 + b, 1, 2); px(x, '#fff', ox + 10, oy + 11 + b, 1, 2); }
      else if(z === 6){ px(x, col, ox + 2, oy + 6 + b, 12, 6); px(x, col, ox + 1, oy + 4 + b, 4, 4); px(x, '#e8c76f', ox + 6, oy + 5 + b, 6, 1); px(x, col, ox + 12, oy + 10 + b, 3, 2); }
      else if(z === 7){ px(x, col, ox + 5, oy + 5 + b, 6, 8); px(x, dark, ox, oy + 4 + b, 5, 5); px(x, dark, ox + 11, oy + 4 + b, 5, 5); px(x, '#fff27a', ox + 7, oy + 8 + b, 2, 4); }
      else if(z === 8){ x.fillStyle = '#2a2440'; x.beginPath(); x.arc(ox + 8, oy + 8 + b, 6.5, 0, 7); x.fill(); x.strokeStyle = '#ffe9a8'; x.lineWidth = 1; x.stroke(); px(x, '#ffe9a8', ox + 8, oy + 5 + b, 1, 4); px(x, '#ffe9a8', ox + 8, oy + 8 + b, 3, 1); }
      else { px(x, '#1e1a24', ox + 4, oy + 4 + b, 8, 10); px(x, '#c02020', ox + 4, oy + 1 + b, 8, 3); px(x, '#0e0a12', ox + 2, oy + 2 + b, 2, 4); px(x, '#0e0a12', ox + 12, oy + 2 + b, 2, 4); px(x, '#3a0a14', ox + 3, oy + 12 + b, 10, 3); }
      x.globalAlpha = 1;
      if(z !== 8){ px(x, eye, ox + 6, oy + 7 + b, 1, 1); px(x, eye, ox + 9, oy + 7 + b, 1, 1); }
      else { px(x, eye, ox + 5, oy + 7 + b); px(x, eye, ox + 11, oy + 7 + b); }
    }
  });
  return c;
}

// ---------- map generation ----------
function makeMap(zone){
  const r = rng(9973 * (zone + 1)), m = [];
  for(let y = 0; y < MAP_H; y++){ const row = []; for(let x = 0; x < MAP_W; x++) row.push(r() < .5 ? 0 : 1); m.push(row); }
  const put = (x, y, v) => { if(x > 0 && y > 0 && x < MAP_W - 1 && y < MAP_H - 1) m[y][x] = v; };
  for(let x = 0; x < MAP_W; x++){ m[0][x] = 4; m[MAP_H-1][x] = 4; }
  for(let y = 0; y < MAP_H; y++){ m[y][0] = 4; m[y][MAP_W-1] = 4; }
  for(let i = 0; i < 16; i++){                              // tree and rock clusters
    const cx = 3 + (r()*(MAP_W-6)|0), cy = 3 + (r()*(MAP_H-6)|0), v = r() < .6 ? 4 : 5, n = 3 + (r()*7|0);
    for(let k = 0; k < n; k++) put(cx + (r()*5|0) - 2, cy + (r()*5|0) - 2, v);
  }
  for(let i = 0; i < 2; i++){                               // ponds
    const cx = 6 + (r()*(MAP_W-12)|0), cy = 5 + (r()*(MAP_H-10)|0), rw = 2 + (r()*3|0), rh = 2 + (r()*2|0);
    for(let y = -rh; y <= rh; y++) for(let x = -rw; x <= rw; x++) if(x*x/(rw*rw) + y*y/(rh*rh) <= 1) put(cx + x, cy + y, 3);
  }
  for(let i = 0; i < 40; i++) { const x = 1 + (r()*(MAP_W-2)|0), y = 1 + (r()*(MAP_H-2)|0); if(m[y][x] < 2) m[y][x] = 6; }
  // a winding road from the west gate to the east gate keeps the zone crossable
  let y = MAP_H >> 1;
  for(let x = 1; x < MAP_W - 1; x++){
    if(x % 4 === 0) y = Math.max(3, Math.min(MAP_H - 4, y + (r()*3|0) - 1));
    for(let k = -1; k <= 1; k++) m[y + k][x] = 2;
  }
  const mid = MAP_H >> 1;
  for(let k = -1; k <= 1; k++){ m[mid + k][0] = 2; m[mid + k][MAP_W-1] = 2; }
  for(let yy = mid - 2; yy <= mid + 2; yy++) for(let x = 1; x <= 3; x++) m[yy][x] = 2;   // clear spawn
  // connect the road ends to the gates on the middle row
  const joinCol = (x)=>{ for(let yy = 1; yy < MAP_H - 1; yy++) if(m[yy][x] === 2){ const a = Math.min(yy, mid), b = Math.max(yy, mid); for(let q = a; q <= b; q++) m[q][x] = 2; return; } };
  joinCol(1); joinCol(MAP_W - 2);
  m[mid][MAP_W-1] = 7; m[mid][0] = 7;
  return m;
}
const walkable = v => SOLID.indexOf(v) < 0;

// A* over the tile grid (4-way), for tap-to-move
function findPath(map, sx, sy, tx, ty){
  if(!map[ty] || !walkable(map[ty][tx])) return null;
  const key = (x, y) => y * MAP_W + x, open = [[sx, sy]], g = new Map([[key(sx, sy), 0]]), from = new Map();
  const h = (x, y) => Math.abs(x - tx) + Math.abs(y - ty);
  const f = new Map([[key(sx, sy), h(sx, sy)]]);
  let guard = 0;
  while(open.length && guard++ < 4000){
    let bi = 0; for(let i = 1; i < open.length; i++) if(f.get(key(...open[i])) < f.get(key(...open[bi]))) bi = i;
    const [x, y] = open.splice(bi, 1)[0];
    if(x === tx && y === ty){ const p = [[x, y]]; let k = key(x, y); while(from.has(k)){ const q = from.get(k); p.unshift(q); k = key(...q); } return p; }
    for(const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx = x + dx, ny = y + dy;
      if(nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || !walkable(map[ny][nx])) continue;
      const ng = g.get(key(x, y)) + 1, nk = key(nx, ny);
      if(ng < (g.has(nk) ? g.get(nk) : Infinity)){ g.set(nk, ng); f.set(nk, ng + h(nx, ny)); from.set(nk, [x, y]); if(!open.some(o=>o[0] === nx && o[1] === ny)) open.push([nx, ny]); }
    }
  }
  return null;
}

// ---------- the personal realm (มิติส่วนตัว) ----------
// realm tiles: 0 grass, 1 grass alt, 2 stone path, 3 pond, 4 bamboo, 5 rock, 6 flowers, 7 gate,
// 8 tilled plot, 9 pavilion, 10 spirit spring, 11 alchemy furnace, 12 lotus on water
const REALM_PLOT_MAX = 18;
const plotPos = i => [27 + (i % 6) * 2, 19 + Math.floor(i / 6) * 3];
function drawRealmTiles(){
  const c = document.createElement('canvas'); c.width = T * 13; c.height = T;
  const x = c.getContext('2d'), r = rng(11), g1 = '#4f8a5a', g2 = '#5a9664';
  const grass = (o, base) => { px(x, base, o, 0, T, T); for(let i = 0; i < 14; i++) px(x, shade(base, r() < .5 ? 1.2 : .82), o + (r()*T|0), r()*T|0, 1, 2); };
  grass(0, g1); grass(T, g2);
  px(x, '#a8a498', 2*T, 0, T, T); px(x, '#8a877c', 2*T, 7, T, 1); px(x, '#8a877c', 2*T + 7, 0, 1, 7); px(x, '#8a877c', 2*T + 3, 8, 1, 8); px(x, '#8a877c', 2*T + 12, 8, 1, 8);
  px(x, '#3f7fa0', 3*T, 0, T, T); for(let i = 0; i < 4; i++) px(x, '#7fc0e0', 3*T + 2 + (r()*10|0), 2 + i*4, 4, 1);
  grass(4*T, g2); [[3,'#6fbf5a'],[7,'#5aa84a'],[11,'#7fd06a']].forEach(([bx, col])=>{ px(x, col, 4*T + bx, 0, 2, T); for(let y = 3; y < T; y += 5) px(x, '#2f5a2a', 4*T + bx, y, 2, 1); px(x, '#8ae07a', 4*T + bx + 2, 4 + bx % 5, 2, 1); });
  grass(5*T, g1); x.fillStyle = '#9aa0a4'; x.beginPath(); x.ellipse(5*T + 8, 10, 6.5, 5, 0, 0, 7); x.fill(); px(x, '#c4c8cc', 5*T + 5, 7, 3, 1);
  grass(6*T, g1); [['#ffd66b',4,5],['#ffb0c8',10,3],['#ffffff',7,11],['#c9a6ff',12,12]].forEach(([c2,a,b])=>px(x, c2, 6*T + a, b, 2, 2));
  px(x, '#a8a498', 7*T, 0, T, T); x.strokeStyle = '#e8c76f'; x.lineWidth = 2; x.beginPath(); x.arc(7*T + 8, 8, 5.5, 0, 7); x.stroke(); px(x, '#c9a6ff', 7*T + 6, 6, 4, 4);
  px(x, '#5a3e2a', 8*T, 0, T, T); for(let y = 2; y < T; y += 4) px(x, '#3e2a1c', 8*T + 1, y, T - 2, 1);
  px(x, '#c0392b', 9*T, 0, T, 6); px(x, '#8a2a1e', 9*T, 5, T, 1); px(x, '#e8c76f', 9*T, 0, T, 1); px(x, '#d8c8a8', 9*T, 6, T, 10); px(x, '#8a2a1e', 9*T + 2, 6, 2, 10); px(x, '#8a2a1e', 9*T + 12, 6, 2, 10);
  grass(10*T, g1); x.fillStyle = '#6ff0ff'; x.beginPath(); x.ellipse(10*T + 8, 9, 6.5, 5, 0, 0, 7); x.fill(); px(x, '#dffcff', 10*T + 5, 7, 4, 1); px(x, '#a8a498', 10*T + 1, 13, 14, 2);
  grass(11*T, g2); x.fillStyle = '#8a6a2a'; x.beginPath(); x.arc(11*T + 8, 10, 5.5, 0, 7); x.fill(); px(x, '#e8c76f', 11*T + 3, 5, 10, 2); px(x, '#5a3e14', 11*T + 4, 14, 2, 2); px(x, '#5a3e14', 11*T + 10, 14, 2, 2); px(x, '#ff9a3c', 11*T + 6, 8, 4, 2);
  px(x, '#3f7fa0', 12*T, 0, T, T); x.fillStyle = '#3f8a4a'; x.beginPath(); x.arc(12*T + 8, 9, 5, 0, 7); x.fill(); px(x, '#ffb0c8', 12*T + 6, 5, 4, 3); px(x, '#fff', 12*T + 7, 5, 2, 1);
  return c;
}
function makeRealmMap(lv, plots){
  const r = rng(424242), m = [];
  for(let y = 0; y < MAP_H; y++){ const row = []; for(let x = 0; x < MAP_W; x++) row.push(r() < .5 ? 0 : 1); m.push(row); }
  for(let y = 0; y < MAP_H; y++) for(let x = 0; x < MAP_W; x++) if(x < 2 || y < 2 || x > MAP_W - 3 || y > MAP_H - 3) m[y][x] = 4;   // bamboo wall
  for(let i = 0; i < 40; i++){ const x = 3 + (r()*(MAP_W-6)|0), y = 3 + (r()*(MAP_H-6)|0); m[y][x] = r() < .7 ? 6 : 5; }
  for(let y = -4; y <= 4; y++) for(let x = -6; x <= 6; x++) if(x*x/36 + y*y/16 <= 1) m[21 + y][10 + x] = r() < .18 ? 12 : 3;   // lotus pond
  for(let y = 4; y <= 8; y++) for(let x = 18; x <= 25; x++) m[y][x] = 9;                                                      // pavilion
  for(let y = 9; y <= 14; y++) for(let x = 21; x <= 22; x++) m[y][x] = 2;
  m[6][30] = m[6][31] = m[7][30] = m[7][31] = 10;                                                                                // spirit spring
  m[10][27] = m[10][28] = m[11][27] = m[11][28] = 11;                                                                            // furnace
  const mid = MAP_H >> 1;
  for(let x = 2; x < MAP_W; x++){ m[mid][x] = 2; m[mid+1][x] = 2; }
  for(let y = mid; y <= 28; y++) m[y][25] = 2;
  for(let y = 17; y <= 27; y++) for(let x = 26; x <= 38; x++) if(m[y][x] !== 2) m[y][x] = r() < .5 ? 0 : 1;
  for(let i = 0; i < Math.min(plots, REALM_PLOT_MAX); i++){ const [px2, py] = plotPos(i); m[py][px2] = 8; }
  m[mid][MAP_W-1] = 7; m[mid+1][MAP_W-1] = 7; m[mid][MAP_W-2] = 2; m[mid+1][MAP_W-2] = 2;
  return m;
}
// herbs: one column per growth stage (sprout, growing, ripe), one row per herb in D.HERBS order
function drawHerbs(colors){
  const c = document.createElement('canvas'); c.width = T * 3; c.height = T * colors.length;
  const x = c.getContext('2d');
  colors.forEach((col, h)=>{
    const oy = h*T;
    px(x, '#6fbf5a', 7, oy + 11, 2, 4); px(x, '#8ae07a', 5, oy + 12, 2, 1); px(x, '#8ae07a', 9, oy + 11, 2, 1);                       // sprout
    px(x, '#5aa84a', T + 7, oy + 6, 2, 9); px(x, '#8ae07a', T + 4, oy + 9, 3, 2); px(x, '#8ae07a', T + 9, oy + 7, 3, 2); px(x, col, T + 6, oy + 4, 4, 3);
    px(x, '#4a9a3a', 2*T + 7, oy + 5, 2, 10); px(x, '#8ae07a', 2*T + 3, oy + 9, 4, 2); px(x, '#8ae07a', 2*T + 9, oy + 8, 4, 2);          // ripe
    x.fillStyle = col; x.beginPath(); x.arc(2*T + 8, oy + 4, 4, 0, 7); x.fill(); px(x, '#ffffff', 2*T + 6, oy + 2, 2, 1);
  });
  return c;
}
// pets for the realm: small critters in each pet's color, 2 bob frames
function drawPets(colors){
  const c = document.createElement('canvas'); c.width = T * 2; c.height = T * colors.length;
  const x = c.getContext('2d');
  colors.forEach((col, i)=>{ for(let f = 0; f < 2; f++){
    const ox = f*T, oy = i*T + f;
    px(x, col, ox + 4, oy + 7, 8, 6); px(x, col, ox + 9, oy + 4, 5, 5); px(x, shade(col, .7), ox + 4, oy + 13, 2, 2); px(x, shade(col, .7), ox + 10, oy + 13, 2, 2);
    px(x, '#1a1420', ox + 12, oy + 6); px(x, shade(col, 1.25), ox + 2, oy + 6, 3, 2);
  } });
  return c;
}

window.GKAdvArt = { T, MAP_W, MAP_H, SOLID, MON_PER_ZONE, THEMES, rng, shade, drawTileset, drawHero, drawMonsters, makeMap, walkable, findPath,
  REALM_PLOT_MAX, plotPos, drawRealmTiles, makeRealmMap, drawHerbs, drawPets };
})();
