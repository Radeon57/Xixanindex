// God Killer — adventure mode: a walkable top-down 2D world built with Phaser.
// Loaded on demand by ui.js the first time the adventure tab opens. Game rules and rewards stay in engine.js
// (G.advStats / G.advKill); this file only draws the world and runs the moment-to-moment action.
(function(){
'use strict';
const T = 16;                 // tile size in world pixels (the camera zooms 2x, so the art stays crisp)
const MAP_W = 44, MAP_H = 30; // tiles per zone
const SOLID = [3, 4, 5];      // water, tree, rock
const MON_PER_ZONE = 8;
const ZOOM = 2;

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

// ---------- the scene ----------
let game = null, api = null, scene = null;

class World extends Phaser.Scene {
  constructor(){ super('world'); }
  create(){
    scene = this;
    this.textures.addSpriteSheet('hero', drawHero(), { frameWidth:T, frameHeight:T });
    this.textures.addSpriteSheet('mons', drawMonsters(), { frameWidth:T, frameHeight:T });
    const sp = document.createElement('canvas'); sp.width = sp.height = 4; const sx = sp.getContext('2d'); sx.fillStyle = '#fff'; sx.fillRect(0, 0, 4, 4);
    this.textures.addCanvas('spark', sp);
    ['down','left','right','up'].forEach((d, i)=>{
      this.anims.create({ key:'walk-' + d, frames:this.anims.generateFrameNumbers('hero', { start:i*6 + 1, end:i*6 + 4 }), frameRate:9, repeat:-1 });
      this.anims.create({ key:'idle-' + d, frames:[{ key:'hero', frame:i*6 }] });
    });
    for(let z = 0; z < THEMES.length; z++) this.anims.create({ key:'mon-' + z, frames:this.anims.generateFrameNumbers('mons', { start:z*2, end:z*2 + 1 }), frameRate:3, repeat:-1 });
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,J,SPACE', false);   // no capture: typing elsewhere on the page keeps working
    this.input.on('pointerdown', p=>this.onTap(p));
    this.sparks = this.add.particles(0, 0, 'spark', { speed:{ min:30, max:110 }, lifespan:{ min:250, max:500 }, scale:{ start:.9, end:0 }, alpha:{ start:1, end:0 }, emitting:false });
    this.sparks.setDepth(20);
    this.hp = 100; this.lastHit = -9999; this.atkAt = 0; this.dir = 'down'; this.dead = false;
    this.path = null; this.target = null;
    this.loadZone(api.startZone(), 'west');
  }
  loadZone(zone, from){
    this.zone = zone;
    if(this.layer){ this.layer.destroy(); this.map.destroy(); }
    (this.cols || []).forEach(c=>c.destroy()); this.cols = [];
    (this.mons || []).forEach(m=>{ m.bar.destroy(); m.destroy(); });
    const th = THEMES[zone], key = 'tiles' + zone;
    if(!this.textures.exists(key)) this.textures.addCanvas(key, drawTileset(th));
    this.grid = makeMap(zone);
    this.map = this.make.tilemap({ data:this.grid, tileWidth:T, tileHeight:T });
    const ts = this.map.addTilesetImage(key, key, T, T, 0, 0);
    this.layer = this.map.createLayer(0, ts, 0, 0);
    this.layer.setCollision(SOLID);
    const mid = MAP_H >> 1;
    const sx = from === 'east' ? (MAP_W - 3) * T + T/2 : 2 * T + T/2, sy = mid * T + T/2;
    if(!this.hero){
      this.hero = this.physics.add.sprite(sx, sy, 'hero', 0).setDepth(10);
      this.hero.body.setSize(10, 8).setOffset(3, 8);
      this.cameras.main.startFollow(this.hero, true, .15, .15).setZoom(ZOOM).setRoundPixels(true);
    } else this.hero.setPosition(sx, sy);
    if(this.heroCol) this.heroCol.destroy();
    this.heroCol = this.physics.add.collider(this.hero, this.layer);
    this.physics.world.setBounds(0, 0, MAP_W*T, MAP_H*T);
    this.cameras.main.setBounds(0, 0, MAP_W*T, MAP_H*T);
    this.path = null; this.target = null;
    // monsters spawn on open ground away from the west gate
    const r = rng(31 * (zone + 3)); this.mons = [];
    for(let i = 0; i < MON_PER_ZONE; i++){
      let tx, ty, guard = 0;
      do { tx = 8 + (r()*(MAP_W-10)|0); ty = 2 + (r()*(MAP_H-4)|0); } while(!walkable(this.grid[ty][tx]) && guard++ < 50);
      const m = this.physics.add.sprite(tx*T + T/2, ty*T + T/2, 'mons', zone*2).setDepth(9);
      m.body.setSize(12, 10).setOffset(2, 5);
      m.play('mon-' + zone);
      m.home = { x:m.x, y:m.y }; m.state = 'idle'; m.until = 0; m.hp = 100; m.atkAt = 0; m.alive = true;
      m.bar = this.add.rectangle(m.x, m.y - 10, 12, 2, 0xff6b6b).setOrigin(0, .5).setDepth(11).setVisible(false);
      this.cols.push(this.physics.add.collider(m, this.layer));
      this.mons.push(m);
    }
    this.stats = api.stats(zone); this.statsAt = 0;
    api.zoneChanged(zone);
    this.cameras.main.flash(250, 232, 199, 111, true);
  }
  onTap(p){
    if(this.dead) return;
    const wx = p.worldX, wy = p.worldY;
    const hit = this.mons.find(m=>m.alive && Math.abs(m.x - wx) < 12 && Math.abs(m.y - wy) < 12);
    this.target = hit || null;
    const tx = Math.floor((hit ? hit.x : wx) / T), ty = Math.floor((hit ? hit.y : wy) / T);
    const path = findPath(this.grid, Math.floor(this.hero.x / T), Math.floor(this.hero.y / T), tx, ty);
    this.path = path ? path.slice(1) : null;
  }
  attack(){
    const now = this.time.now;
    if(this.dead || now - this.atkAt < 380) return;
    this.atkAt = now;
    const i = ['down','left','right','up'].indexOf(this.dir);
    this.hero.anims.stop(); this.hero.setFrame(i*6 + 5);
    api.sfx('hit');
    const reach = 22, fx = { down:[0,1], left:[-1,0], right:[1,0], up:[0,-1] }[this.dir];
    const ax = this.hero.x + fx[0]*10, ay = this.hero.y + fx[1]*10;
    let any = false;
    for(const m of this.mons){
      if(!m.alive || Phaser.Math.Distance.Between(ax, ay, m.x, m.y) > reach) continue;
      any = true;
      m.hp -= this.stats.heroDmg;
      m.state = 'chase';
      this.burst(m.x, m.y, 7, 0xfff3d0);
      this.floatText(m.x, m.y - 8, '-' + Math.round(this.stats.heroDmg), '#fff3d0');
      if(!api.reduced()) this.tweens.add({ targets:m, alpha:.3, duration:60, yoyo:true });
      if(m.hp <= 0) this.killMonster(m);
    }
    if(!any) this.burst(ax, ay, 3, 0xcfc6e8);
  }
  killMonster(m){
    m.alive = false; m.body.enable = false; m.bar.setVisible(false);
    this.burst(m.x, m.y, 22, 0xe8c76f);
    const gain = api.kill(this.zone);
    this.floatText(m.x, m.y - 14, '+' + api.fmt(gain) + ' DP', '#e8c76f');
    this.tweens.add({ targets:m, alpha:0, scale:1.6, duration:300, onComplete:()=>m.setVisible(false) });
    if(this.target === m) this.target = null;
    this.time.delayedCall(8000, ()=>{ if(!m.scene) return; m.setPosition(m.home.x, m.home.y).setAlpha(1).setScale(1).setVisible(true); m.body.enable = true; m.hp = 100; m.alive = true; m.state = 'idle'; });
  }
  burst(x, y, n, tint){ if(api.reduced()) n = Math.min(n, 3); this.sparks.setParticleTint(tint); this.sparks.explode(n, x, y); }
  floatText(x, y, s, color){
    const t = this.add.text(x, y, s, { fontFamily:'Trebuchet MS, sans-serif', fontSize:'16px', color, stroke:'#000', strokeThickness:3 }).setOrigin(.5).setScale(.5).setDepth(30);
    this.tweens.add({ targets:t, y:y - 14, alpha:0, duration:700, onComplete:()=>t.destroy() });
  }
  heroHurt(dmg){
    if(this.dead) return;
    this.hp -= dmg; this.lastHit = this.time.now;
    this.burst(this.hero.x, this.hero.y, 5, 0xff6b6b);
    if(!api.reduced()) this.cameras.main.shake(80, .004);
    if(this.hp <= 0){
      this.hp = 0; this.dead = true; this.hero.setVelocity(0, 0); this.hero.setTint(0x555555);
      api.message('พ่ายแพ้! กลับจุดเริ่มต้นใน 2 วินาที');
      api.sfx('lose');
      this.time.delayedCall(2000, ()=>{ this.hero.clearTint(); this.dead = false; this.hp = 100; this.loadZone(this.zone, 'west'); });
    }
  }
  update(time, dtMs){
    const dt = dtMs / 1000;
    if(time - this.statsAt > 2000){ this.statsAt = time; this.stats = api.stats(this.zone); }
    // hero movement: keyboard first, then a tapped path
    const k = this.keys, sp = 90;
    let vx = 0, vy = 0;
    if(!this.dead){
      if(k.A.isDown || k.LEFT.isDown) vx = -1; else if(k.D.isDown || k.RIGHT.isDown) vx = 1;
      if(k.W.isDown || k.UP.isDown) vy = -1; else if(k.S.isDown || k.DOWN.isDown) vy = 1;
      if(vx || vy){ this.path = null; this.target = null; }
      else if(this.target && this.target.alive && Phaser.Math.Distance.Between(this.hero.x, this.hero.y, this.target.x, this.target.y) < 20){
        this.path = null; const dx = this.target.x - this.hero.x, dy = this.target.y - this.hero.y;
        this.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
        this.attack();
      } else if(this.path && this.path.length){
        const [tx, ty] = this.path[0], gx = tx*T + T/2, gy = ty*T + T/2;
        const dx = gx - this.hero.x, dy = gy - this.hero.y;
        if(Math.abs(dx) < 2 && Math.abs(dy) < 2) this.path.shift();
        else { vx = Math.abs(dx) > 1 ? Math.sign(dx) : 0; vy = Math.abs(dy) > 1 ? Math.sign(dy) : 0; }
      }
      if(Phaser.Input.Keyboard.JustDown(k.J) || Phaser.Input.Keyboard.JustDown(k.SPACE) || api.takeAttack()) this.attack();
    }
    const len = Math.hypot(vx, vy) || 1;
    this.hero.setVelocity(vx / len * sp, vy / len * sp);
    const attacking = time - this.atkAt < 160;
    if(vx || vy){
      this.dir = Math.abs(vx) >= Math.abs(vy) && vx ? (vx < 0 ? 'left' : 'right') : (vy < 0 ? 'up' : 'down');
      if(!attacking) this.hero.anims.play('walk-' + this.dir, true);
      if(!api.reduced() && Math.random() < dt * 6){ this.sparks.setParticleTint(0x8a8070); this.sparks.explode(1, this.hero.x, this.hero.y + 7); }
    } else if(!attacking) this.hero.anims.play('idle-' + this.dir, true);
    if(!this.dead && time - this.lastHit > 3000 && this.hp < 100) this.hp = Math.min(100, this.hp + 8 * dt);
    // gates: walk onto the east gate to go deeper, the west gate to go back
    const tx = Math.floor(this.hero.x / T), ty = Math.floor(this.hero.y / T);
    if(!this.dead && this.grid[ty] && this.grid[ty][tx] === 7){
      if(tx >= MAP_W - 1){
        if(this.zone + 1 < api.zones()) { this.loadZone(this.zone + 1, 'west'); return; }
        this.hero.x -= 6; api.message('เขตถัดไปปลดล็อกเมื่อสนามรบของ ' + api.monName(this.zone + 1) + ' เปิดในเกมหลัก');
      } else if(tx <= 0){
        if(this.zone > 0){ this.loadZone(this.zone - 1, 'east'); return; }
        this.hero.x += 6;
      }
    }
    // monster FSM: idle → wander → chase → attack → return home
    for(const m of this.mons){
      if(!m.alive) continue;
      const dh = Phaser.Math.Distance.Between(m.x, m.y, this.hero.x, this.hero.y), dHome = Phaser.Math.Distance.Between(m.x, m.y, m.home.x, m.home.y);
      if(m.state !== 'return' && !this.dead && dh < 70) m.state = dh < 15 ? 'attack' : 'chase';
      if((m.state === 'chase' || m.state === 'attack') && (dHome > 150 || this.dead)) m.state = 'return';
      let mvx = 0, mvy = 0, spd = 0;
      if(m.state === 'idle'){ if(time > m.until){ m.state = 'wander'; m.until = time + 1500 + Math.random()*1500; m.wx = m.home.x + (Math.random()*64 - 32); m.wy = m.home.y + (Math.random()*64 - 32); } }
      else if(m.state === 'wander'){ mvx = m.wx - m.x; mvy = m.wy - m.y; spd = 25; if(time > m.until || Math.hypot(mvx, mvy) < 3){ m.state = 'idle'; m.until = time + 800 + Math.random()*1600; } }
      else if(m.state === 'chase'){ mvx = this.hero.x - m.x; mvy = this.hero.y - m.y; spd = 55; if(dh >= 90) m.state = 'return'; }
      else if(m.state === 'attack'){
        if(dh >= 18) m.state = 'chase';
        else if(time - m.atkAt > 1000){ m.atkAt = time; this.heroHurt(this.stats.monDmg); if(!api.reduced()) this.tweens.add({ targets:m, scale:1.25, duration:80, yoyo:true }); }
      }
      else if(m.state === 'return'){ mvx = m.home.x - m.x; mvy = m.home.y - m.y; spd = 60; if(dHome < 4){ m.state = 'idle'; m.hp = Math.min(100, m.hp + 50); } }
      const l = Math.hypot(mvx, mvy);
      m.setVelocity(l > 1 ? mvx / l * spd : 0, l > 1 ? mvy / l * spd : 0);
      if(mvx) m.setFlipX(mvx < 0);
      const hurt = m.hp < 100;
      m.bar.setVisible(hurt);
      if(hurt){ m.bar.setPosition(m.x - 6, m.y - 10); m.bar.setSize(Math.max(.5, 12 * m.hp / 100), 2); }
    }
    api.hud(this.hp, this.zone);
  }
}

window.GKAdventure = {
  mount(el, hostApi){
    api = hostApi;
    game = new Phaser.Game({
      type: Phaser.AUTO, parent: el, backgroundColor: '#0b0a17', pixelArt: true,
      scale: { mode: Phaser.Scale.RESIZE, width: el.clientWidth || 360, height: el.clientHeight || 360 },
      physics: { default: 'arcade', arcade: { debug: false } },
      input: { keyboard: { target: window } },
      audio: { noAudio: true },
      scene: [World]
    });
  },
  sleep(){ if(game && game.loop) game.loop.sleep(); },
  wake(){ if(game && game.loop) game.loop.wake(); },
  goZone(z){ if(scene && scene.zone !== z) scene.loadZone(z, 'west'); },
  zone(){ return scene ? scene.zone : 0; },
  scene(){ return scene; }   // for automated tests
};
})();
