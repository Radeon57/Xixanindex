// God Killer — adventure mode, 3D view (Three.js). Same zones, maps and rules as the 2D view:
// the tile map from adv-art.js becomes terrain with hills (heightmap), blended ground colors (texture splatting),
// an animated water shader, InstancedMesh trees and rocks, houses and bridges, sun light with shadows,
// and 2D billboard sprites for the hero and monsters (2.5D). Loaded as an ES module on first use.
import * as THREE from './vendor/three.module.min.js';

const A = window.GKAdvArt;
const { MAP_W, MAP_H, THEMES, rng, makeMap, walkable, findPath } = A;
const MON_PER_ZONE = A.MON_PER_ZONE;
const RES = 2;                           // terrain vertices per tile edge
const WATER_Y = -0.35;
const CAM_OFF = new THREE.Vector3(0, 10, 8);

let api = null, el = null, renderer = null, scene = null, camera = null, clock = null, awake = false;
let world = null;                        // everything that belongs to the current zone
const keys = {};

// ---------- helpers ----------
const col = hex => new THREE.Color(hex);
function valueNoise(seed){
  const r = rng(seed), G = 12, g = [];
  for(let i = 0; i < (G+1)*(G+1); i++) g.push(r());
  return (x, y)=>{   // x, y in 0..1
    const fx = x*G, fy = y*G, ix = Math.min(G-1, fx|0), iy = Math.min(G-1, fy|0), tx = fx - ix, ty = fy - iy;
    const s = t => t*t*(3 - 2*t), a = g[iy*(G+1)+ix], b = g[iy*(G+1)+ix+1], c = g[(iy+1)*(G+1)+ix], d = g[(iy+1)*(G+1)+ix+1];
    return (a + (b-a)*s(tx)) + ((c + (d-c)*s(tx)) - (a + (b-a)*s(tx)))*s(ty);
  };
}
function spriteFrames(canvas, cols, rows){
  const base = new THREE.CanvasTexture(canvas);
  base.magFilter = THREE.NearestFilter; base.minFilter = THREE.NearestFilter; base.colorSpace = THREE.SRGBColorSpace;
  return (frame, row)=>{ const t = base.clone(); t.needsUpdate = true; t.repeat.set(1/cols, 1/rows); t.offset.set((frame % cols)/cols, 1 - (row+1)/rows); return t; };
}
function setFrame(tex, cols, rows, frame, row){ tex.offset.set((frame % cols)/cols, 1 - (row+1)/rows); }

// ---------- world building ----------
function buildZone(zone){
  const th = THEMES[zone], grid = makeMap(zone), r = rng(4242 + zone), noise = valueNoise(77 + zone*13), noise2 = valueNoise(991 + zone);
  const group = new THREE.Group(), blocked = new Set(), mid = MAP_H >> 1;
  const tile = (x, z) => { const tx = Math.max(0, Math.min(MAP_W-1, Math.floor(x))), tz = Math.max(0, Math.min(MAP_H-1, Math.floor(z))); return grid[tz][tx]; };
  const nearWater = (tx, tz) => [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>grid[tz+dz] && grid[tz+dz][tx+dx] === 3);

  // heightmap: rolling hills, flattened roads, carved ponds; bridges where the road crosses water
  const W = MAP_W*RES, H = MAP_H*RES, hts = new Float32Array((W+1)*(H+1));
  for(let j = 0; j <= H; j++) for(let i = 0; i <= W; i++){
    const x = i/RES, z = j/RES, v = tile(x - .01, z - .01);
    let h = 1.3*noise(x/MAP_W, z/MAP_H) + .35*noise2(x/MAP_W*3 % 1, z/MAP_H*3 % 1) - .3;
    if(v === 2) h = .12 + h*.15;
    if(v === 3) h = -.9;
    if(v === 2 && nearWater(Math.floor(x), Math.floor(z))) h = -.9;   // water under the bridge
    if(v === 4 || v === 5) h += .25;
    hts[j*(W+1)+i] = h;
  }
  for(let pass = 0; pass < 2; pass++){                                // soften steps between tiles
    const cp = hts.slice();
    for(let j = 1; j < H; j++) for(let i = 1; i < W; i++){ const k = j*(W+1)+i; hts[k] = (cp[k]*4 + cp[k-1] + cp[k+1] + cp[k-W-1] + cp[k+W+1]) / 8; }
  }
  const heightAt = (x, z)=>{
    const fx = Math.max(0, Math.min(W - .001, x*RES)), fz = Math.max(0, Math.min(H - .001, z*RES)), i = fx|0, j = fz|0, tx = fx - i, tz = fz - j;
    const a = hts[j*(W+1)+i], b = hts[j*(W+1)+i+1], c = hts[(j+1)*(W+1)+i], d = hts[(j+1)*(W+1)+i+1];
    return (a*(1-tx) + b*tx)*(1-tz) + (c*(1-tx) + d*tx)*tz;
  };

  // terrain mesh with per-vertex splat colors (grass / grass alt / dirt road / rock on slopes / sand by water)
  const geo = new THREE.PlaneGeometry(MAP_W, MAP_H, W, H);
  geo.rotateX(-Math.PI/2); geo.translate(MAP_W/2, 0, MAP_H/2);
  const pos = geo.attributes.position, colors = new Float32Array(pos.count*3);
  const cG1 = col(th.g1), cG2 = col(th.g2), cPath = col(th.path), cRock = col(th.rock), cSand = col('#b8a878'), c = new THREE.Color();
  for(let k = 0; k < pos.count; k++){
    const x = pos.getX(k), z = pos.getZ(k), h = heightAt(x, z);
    pos.setY(k, h);
    const v = tile(x - .01, z - .01), slope = Math.abs(heightAt(x + .5, z) - heightAt(x - .5, z)) + Math.abs(heightAt(x, z + .5) - heightAt(x, z - .5));
    c.copy(cG1).lerp(cG2, noise2((x/MAP_W*5) % 1, (z/MAP_H*5) % 1));
    if(v === 2) c.lerp(cPath, .85);
    if(h < WATER_Y + .25) c.lerp(cSand, .7);
    c.lerp(cRock, Math.min(.9, Math.max(0, slope - .5)));
    colors[k*3] = c.r; colors[k*3+1] = c.g; colors[k*3+2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const tmat = new THREE.MeshLambertMaterial({ vertexColors:true });
  tmat.onBeforeCompile = sh=>{   // fine ground detail: a little per-pixel noise so the blend doesn't look flat
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nfloat hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 0.88 + 0.24 * hsh(floor(vWPos.xz * 6.0));');
  };
  const terrain = new THREE.Mesh(geo, tmat);
  terrain.receiveShadow = true;
  group.add(terrain);

  // water: one animated plane under everything (shader: moving ripples + light glints)
  const wmat = new THREE.ShaderMaterial({
    transparent:true, uniforms:{ uTime:{ value:0 }, uCol:{ value:col(th.water) } },
    vertexShader:'varying vec2 vUv; uniform float uTime; void main(){ vUv = uv; vec3 p = position; p.z += sin(p.x*1.7 + uTime*1.3)*0.04 + cos(p.y*1.3 + uTime)*0.04; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
    fragmentShader:'varying vec2 vUv; uniform float uTime; uniform vec3 uCol; void main(){ vec2 q = vUv*vec2(44.0,30.0); float w = sin(q.x*2.1 + uTime*1.6)*0.5 + sin(q.y*2.7 - uTime*1.2)*0.5 + sin((q.x+q.y)*1.3 + uTime)*0.5; float g = smoothstep(1.1, 1.45, w); gl_FragColor = vec4(mix(uCol*0.85, vec3(0.92,0.97,1.0), g*0.6), 0.82); }'
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H, 44, 30), wmat);
  water.rotation.x = -Math.PI/2; water.position.set(MAP_W/2, WATER_Y, MAP_H/2);
  group.add(water);

  // trees and rocks: one InstancedMesh each for trunks, crowns and rocks
  const trees = [], rocks = [];
  for(let z = 0; z < MAP_H; z++) for(let x = 0; x < MAP_W; x++){ if(grid[z][x] === 4) trees.push([x, z]); else if(grid[z][x] === 5) rocks.push([x, z]); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p3 = new THREE.Vector3();
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.09, .13, .7, 6), new THREE.MeshLambertMaterial({ color:'#5a3e2a' }), trees.length);
  const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(.55, 1.4, 7), new THREE.MeshLambertMaterial({ color:'#ffffff' }), trees.length);
  trees.forEach(([x, z], i)=>{
    const s = .8 + r()*.5, px = x + .5 + (r()-.5)*.3, pz = z + .5 + (r()-.5)*.3, y = heightAt(px, pz);
    q.setFromAxisAngle(new THREE.Vector3(0,1,0), r()*6.28);
    trunk.setMatrixAt(i, m4.compose(p3.set(px, y + .35*s, pz), q, sc.set(s, s, s)));
    crown.setMatrixAt(i, m4.compose(p3.set(px, y + (.7 + .6)*s, pz), q, sc.set(s, s*(0.9 + r()*.3), s)));
    crown.setColorAt(i, col(th.tree).multiplyScalar(1.5 + r()*.5));
  });
  const rock = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.42, 0), new THREE.MeshLambertMaterial({ color:th.rock, flatShading:true }), rocks.length);
  rocks.forEach(([x, z], i)=>{
    const s = .7 + r()*.6, px = x + .5, pz = z + .5;
    q.setFromEuler(new THREE.Euler(r(), r()*6.28, r()));
    rock.setMatrixAt(i, m4.compose(p3.set(px, heightAt(px, pz) + .15, pz), q, sc.set(s, s*.7, s)));
  });
  [trunk, crown, rock].forEach(m=>{ m.castShadow = true; m.receiveShadow = true; group.add(m); });

  // bridges: planks and rails wherever the road crosses water
  const plank = new THREE.MeshLambertMaterial({ color:'#8a6a44' });
  for(let z = 1; z < MAP_H-1; z++) for(let x = 1; x < MAP_W-1; x++){
    if(grid[z][x] !== 2 || !nearWater(x, z)) continue;
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.02, .1, 1.02), plank);
    b.position.set(x + .5, .12, z + .5); b.castShadow = b.receiveShadow = true; group.add(b);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.02, .08, .06), plank);
    [-.48, .48].forEach(o=>{ const rr = rail.clone(); rr.position.set(x + .5, .42, z + .5 + o); rr.castShadow = true; group.add(rr); });
  }

  // a few houses beside the road (blocked for walking)
  const wall = new THREE.MeshLambertMaterial({ color:'#d8c8a8' }), roofM = new THREE.MeshLambertMaterial({ color:'#8a3a2a' });
  let houses = 0, guard = 0;
  while(houses < 3 && guard++ < 400){
    const x = 6 + (r()*(MAP_W-12)|0), z = 2 + (r()*(MAP_H-4)|0);
    const ok = [[0,0],[1,0],[0,1],[1,1]].every(([dx,dz])=>{ const v = grid[z+dz] && grid[z+dz][x+dx]; return v === 0 || v === 1 || v === 6; });
    const byRoad = [[-1,0],[2,0],[0,-1],[0,2],[1,-1],[1,2]].some(([dx,dz])=>grid[z+dz] && grid[z+dz][x+dx] === 2);
    if(!ok || !byRoad) continue;
    const y = Math.min(heightAt(x + .5, z + .5), heightAt(x + 1.5, z + 1.5));
    const hb = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 1.6), wall); hb.position.set(x + 1, y + .55, z + 1);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.45, .9, 4), roofM); roof.position.set(x + 1, y + 1.55, z + 1); roof.rotation.y = Math.PI/4;
    const door = new THREE.Mesh(new THREE.BoxGeometry(.35, .6, .05), plank); door.position.set(x + 1, y + .3, z + 1.82);
    [hb, roof, door].forEach(o=>{ o.castShadow = o.receiveShadow = true; group.add(o); });
    [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dz])=>blocked.add((z+dz)*MAP_W + x+dx));
    houses++;
  }

  // gold gates at both ends of the road
  const gateM = new THREE.MeshLambertMaterial({ color:'#e8c76f', emissive:'#6a5010' });
  [[MAP_W - .5, 'east'], [.5, 'west']].forEach(([gx])=>{
    const g = new THREE.Mesh(new THREE.TorusGeometry(.7, .09, 8, 20), gateM);
    g.position.set(gx, heightAt(gx, mid + .5) + .8, mid + .5); g.rotation.y = Math.PI/2; group.add(g);
  });

  const walk = (x, z)=>{
    const tx = Math.floor(x), tz = Math.floor(z);
    if(tx < 0 || tz < 0 || tx >= MAP_W || tz >= MAP_H) return false;
    return walkable(grid[tz][tx]) && !blocked.has(tz*MAP_W + tx);
  };
  const pathGrid = grid.map((row, z)=>row.map((v, x)=>blocked.has(z*MAP_W + x) ? 4 : v));
  // where a character stands: on bridge planks over water, otherwise on the ground
  const standY = (x, z)=>{ const h = heightAt(x, z); return tile(x, z) === 2 && h < .12 ? .17 : Math.max(h, WATER_Y); };
  return { zone, group, grid, pathGrid, heightAt, standY, walk, water:wmat, theme:th };
}

// ---------- characters (billboard sprites) ----------
let heroFrames = null, monFrames = null, blobGeo = null, blobMat = null;
function makeBillboard(tex, size){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, alphaTest:.3 }));
  s.center.set(.5, .05); s.scale.set(size, size, 1);
  const blob = new THREE.Mesh(blobGeo, blobMat); blob.rotation.x = -Math.PI/2;
  return { s, blob };
}

// ---------- particles (a small pooled Points cloud) ----------
const PMAX = 240;
let pts = null, pPos = null, pCol = null, pVel = [], pLife = [];
function initParticles(){
  const g = new THREE.BufferGeometry();
  pPos = new Float32Array(PMAX*3); pCol = new Float32Array(PMAX*3);
  g.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); g.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  pts = new THREE.Points(g, new THREE.PointsMaterial({ size:.12, vertexColors:true, transparent:true, depthWrite:false }));
  pts.frustumCulled = false;
  for(let i = 0; i < PMAX; i++){ pVel.push(new THREE.Vector3()); pLife.push(0); pPos[i*3+1] = -99; }
  scene.add(pts);
}
function burst(x, y, z, n, hex){
  if(api.reduced()) n = Math.min(n, 3);
  const c = col(hex);
  for(let k = 0, i = 0; k < n && i < PMAX; i++){
    if(pLife[i] > 0) continue;
    pLife[i] = .4 + Math.random()*.4; pPos[i*3] = x; pPos[i*3+1] = y; pPos[i*3+2] = z;
    pVel[i].set((Math.random()-.5)*4, Math.random()*3 + 1, (Math.random()-.5)*4);
    pCol[i*3] = c.r; pCol[i*3+1] = c.g; pCol[i*3+2] = c.b; k++;
  }
}
function stepParticles(dt){
  for(let i = 0; i < PMAX; i++){
    if(pLife[i] <= 0) continue;
    pLife[i] -= dt;
    if(pLife[i] <= 0){ pPos[i*3+1] = -99; continue; }
    pVel[i].y -= 7*dt;
    pPos[i*3] += pVel[i].x*dt; pPos[i*3+1] += pVel[i].y*dt; pPos[i*3+2] += pVel[i].z*dt;
  }
  pts.geometry.attributes.position.needsUpdate = true; pts.geometry.attributes.color.needsUpdate = true;
}
function floatText(x, y, z, text, color){
  if(!el) return;
  const v = new THREE.Vector3(x, y, z).project(camera), span = document.createElement('span');
  span.className = 'adv3dTxt'; span.textContent = text; span.style.color = color;
  span.style.left = ((v.x + 1)/2*el.clientWidth) + 'px'; span.style.top = ((1 - v.y)/2*el.clientHeight) + 'px';
  el.appendChild(span); setTimeout(()=>span.remove(), 750);
}

// ---------- game state ----------
const G3 = { hero:null, dir:'down', hp:100, lastHit:-9, atkAt:-9, dead:false, path:null, target:null, mons:[], stats:null, statsAt:-9, t:0, flashAt:-9 };
const DIRS = ['down','left','right','up'];
const MOVE = { down:[0,1], left:[-1,0], right:[1,0], up:[0,-1] };

function loadZone(zone, from){
  if(world){ scene.remove(world.group); world.group.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); }); }
  G3.mons.forEach(m=>{ scene.remove(m.s); scene.remove(m.blob); });
  world = buildZone(zone);
  scene.add(world.group);
  const th = world.theme;
  scene.fog.color.set(th.g1).lerp(col('#0b0a17'), .55); scene.background = scene.fog.color.clone();
  const mid = MAP_H >> 1;
  G3.x = from === 'east' ? MAP_W - 2.5 : 2.5; G3.z = mid + .5;
  G3.path = null; G3.target = null;
  // monsters on open ground, away from the west gate
  const r = rng(31 * (zone + 3)); G3.mons = [];
  for(let i = 0; i < MON_PER_ZONE; i++){
    let tx, tz, guard = 0;
    do { tx = 8 + (r()*(MAP_W-10)|0); tz = 2 + (r()*(MAP_H-4)|0); } while(!world.walk(tx + .5, tz + .5) && guard++ < 50);
    const tex = monFrames(zone*2, zone), b = makeBillboard(tex, 1.05);
    const m = { s:b.s, blob:b.blob, tex, x:tx + .5, z:tz + .5, home:{ x:tx + .5, z:tz + .5 }, state:'idle', until:0, hp:100, atkAt:0, alive:true, respawn:0, hurtAt:-9 };
    scene.add(m.s); scene.add(m.blob);
    G3.mons.push(m);
  }
  G3.stats = api.stats(zone); G3.statsAt = G3.t;
  api.zoneChanged(zone);
  G3.flashAt = G3.t;
}

function onPointer(e){
  if(G3.dead || !world) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - rect.left)/rect.width)*2 - 1, -((e.clientY - rect.top)/rect.height)*2 + 1);
  const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
  const hitMon = ray.intersectObjects(G3.mons.filter(m=>m.alive).map(m=>m.s))[0];
  let tx, tz;
  if(hitMon){ const m = G3.mons.find(x=>x.s === hitMon.object); G3.target = m; tx = m.x; tz = m.z; }
  else {
    const hit = ray.intersectObject(world.group.children[0])[0];   // the terrain
    if(!hit) return;
    G3.target = null; tx = hit.point.x; tz = hit.point.z;
  }
  const p = findPath(world.pathGrid, Math.floor(G3.x), Math.floor(G3.z), Math.floor(tx), Math.floor(tz));
  G3.path = p ? p.slice(1) : null;
}

function attack(){
  if(G3.dead || G3.t - G3.atkAt < .38) return;
  G3.atkAt = G3.t;
  api.sfx('hit');
  const f = MOVE[G3.dir], ax = G3.x + f[0]*.6, az = G3.z + f[1]*.6, ay = world.heightAt(G3.x, G3.z) + .5;
  let any = false;
  for(const m of G3.mons){
    if(!m.alive || Math.hypot(m.x - ax, m.z - az) > 1.4) continue;
    any = true;
    m.hp -= G3.stats.heroDmg; m.state = 'chase'; m.hurtAt = G3.t;
    burst(m.x, ay, m.z, 8, '#fff3d0');
    floatText(m.x, ay + .9, m.z, '-' + Math.round(G3.stats.heroDmg), '#fff3d0');
    if(m.hp <= 0) killMon(m);
  }
  if(!any) burst(ax, ay, az, 3, '#cfc6e8');
}
function killMon(m){
  m.alive = false; m.respawn = G3.t + 8;
  const y = world.heightAt(m.x, m.z) + .5;
  burst(m.x, y, m.z, 24, '#e8c76f');
  const gain = api.kill(world.zone);
  floatText(m.x, y + 1.2, m.z, '+' + api.fmt(gain) + ' DP', '#e8c76f');
  m.s.visible = false; m.blob.visible = false;
  if(G3.target === m) G3.target = null;
}
function hurtHero(dmg){
  if(G3.dead) return;
  G3.hp -= dmg; G3.lastHit = G3.t;
  burst(G3.x, world.heightAt(G3.x, G3.z) + .5, G3.z, 5, '#ff6b6b');
  if(!api.reduced()) G3.shake = .15;
  if(G3.hp <= 0){
    G3.hp = 0; G3.dead = true; G3.hero.s.material.color.set('#555');
    api.message('พ่ายแพ้! กลับจุดเริ่มต้นใน 2 วินาที'); api.sfx('lose');
    setTimeout(()=>{ if(!world) return; G3.hero.s.material.color.set('#fff'); G3.dead = false; G3.hp = 100; loadZone(world.zone, 'west'); }, 2000);
  }
}

function tryMove(o, dx, dz){
  const nx = o.x + dx, nz = o.z + dz;
  if(world.walk(nx, nz)){ o.x = nx; o.z = nz; return true; }
  if(dx && world.walk(nx, o.z)){ o.x = nx; return true; }         // slide along walls
  if(dz && world.walk(o.x, nz)){ o.z = nz; return true; }
  return false;
}

function frame(){
  const dt = Math.min(.05, clock.getDelta());
  G3.t += dt;
  if(!world) return;
  if(G3.t - G3.statsAt > 2){ G3.statsAt = G3.t; G3.stats = api.stats(world.zone); }
  world.water.uniforms.uTime.value = G3.t;

  // hero: keyboard, or a tapped path / target
  let vx = 0, vz = 0;
  if(!G3.dead){
    if(keys.KeyA || keys.ArrowLeft) vx = -1; else if(keys.KeyD || keys.ArrowRight) vx = 1;
    if(keys.KeyW || keys.ArrowUp) vz = -1; else if(keys.KeyS || keys.ArrowDown) vz = 1;
    if(vx || vz){ G3.path = null; G3.target = null; }
    else if(G3.target && G3.target.alive && Math.hypot(G3.target.x - G3.x, G3.target.z - G3.z) < 1.25){
      G3.path = null; const dx = G3.target.x - G3.x, dz = G3.target.z - G3.z;
      G3.dir = Math.abs(dx) > Math.abs(dz) ? (dx < 0 ? 'left' : 'right') : (dz < 0 ? 'up' : 'down');
      attack();
    } else if(G3.path && G3.path.length){
      const [tx, tz] = G3.path[0], dx = tx + .5 - G3.x, dz = tz + .5 - G3.z;
      if(Math.abs(dx) < .1 && Math.abs(dz) < .1) G3.path.shift(); else { vx = Math.abs(dx) > .05 ? Math.sign(dx) : 0; vz = Math.abs(dz) > .05 ? Math.sign(dz) : 0; }
    }
    if(keys.attack){ keys.attack = false; attack(); }
    if(api.takeAttack()) attack();
  }
  const len = Math.hypot(vx, vz) || 1, sp = 5.2*dt;
  if(vx || vz){
    tryMove(G3, vx/len*sp, vz/len*sp);
    G3.dir = Math.abs(vx) >= Math.abs(vz) && vx ? (vx < 0 ? 'left' : 'right') : (vz < 0 ? 'up' : 'down');
    if(!api.reduced() && Math.random() < dt*6) burst(G3.x, world.heightAt(G3.x, G3.z) + .05, G3.z, 1, '#8a8070');
  }
  const row = DIRS.indexOf(G3.dir), attacking = G3.t - G3.atkAt < .16;
  setFrame(G3.hero.tex, 6, 4, attacking ? 5 : (vx || vz) ? 1 + (Math.floor(G3.t*9) % 4) : 0, row);
  if(!G3.dead && G3.t - G3.lastHit > 3 && G3.hp < 100) G3.hp = Math.min(100, G3.hp + 8*dt);
  const hy = world.standY(G3.x, G3.z);
  G3.hero.s.position.set(G3.x, hy, G3.z);
  G3.hero.blob.position.set(G3.x, G3.hero.s.position.y + .03, G3.z);

  // gates
  const mid = MAP_H >> 1;
  if(!G3.dead && Math.abs(G3.z - (mid + .5)) < 1.6){
    if(G3.x > MAP_W - 1.2){
      if(world.zone + 1 < api.zones()){ loadZone(world.zone + 1, 'west'); return; }
      G3.x = MAP_W - 1.6; api.message('เขตถัดไปปลดล็อกเมื่อสนามรบของ ' + api.monName(world.zone + 1) + ' เปิดในเกมหลัก');
    } else if(G3.x < 1.2 && world.zone > 0){ loadZone(world.zone - 1, 'east'); return; }
  }

  // monster FSM: idle → wander → chase → attack → return home (same rules as the 2D view)
  for(const m of G3.mons){
    if(!m.alive){
      if(G3.t > m.respawn){ m.alive = true; m.hp = 100; m.x = m.home.x; m.z = m.home.z; m.state = 'idle'; m.s.visible = m.blob.visible = true; }
      continue;
    }
    const dh = Math.hypot(m.x - G3.x, m.z - G3.z), dHome = Math.hypot(m.x - m.home.x, m.z - m.home.z);
    if(m.state !== 'return' && !G3.dead && dh < 4.4) m.state = dh < 1 ? 'attack' : 'chase';
    if((m.state === 'chase' || m.state === 'attack') && (dHome > 9.4 || G3.dead)) m.state = 'return';
    let mx = 0, mz = 0, spd = 0;
    if(m.state === 'idle'){ if(G3.t > m.until){ m.state = 'wander'; m.until = G3.t + 1.5 + Math.random()*1.5; m.wx = m.home.x + (Math.random()*4 - 2); m.wz = m.home.z + (Math.random()*4 - 2); } }
    else if(m.state === 'wander'){ mx = m.wx - m.x; mz = m.wz - m.z; spd = 1.5; if(G3.t > m.until || Math.hypot(mx, mz) < .2){ m.state = 'idle'; m.until = G3.t + .8 + Math.random()*1.6; } }
    else if(m.state === 'chase'){ mx = G3.x - m.x; mz = G3.z - m.z; spd = 3.4; if(dh >= 5.6) m.state = 'return'; }
    else if(m.state === 'attack'){
      if(dh >= 1.15) m.state = 'chase';
      else if(G3.t - m.atkAt > 1){ m.atkAt = G3.t; hurtHero(G3.stats.monDmg); m.bump = .15; }
    }
    else if(m.state === 'return'){ mx = m.home.x - m.x; mz = m.home.z - m.z; spd = 3.7; if(dHome < .25){ m.state = 'idle'; m.hp = Math.min(100, m.hp + 50); } }
    const l = Math.hypot(mx, mz);
    if(l > .05) tryMove(m, mx/l*spd*dt, mz/l*spd*dt);
    setFrame(m.tex, 2, 10, Math.floor(G3.t*3) % 2 + world.zone*2, world.zone);
    const y = world.standY(m.x, m.z), bump = m.bump > 0 ? (m.bump -= dt, 1.2) : 1;
    m.s.position.set(m.x, y, m.z); m.s.scale.set(1.05*bump, 1.05*bump, 1);
    m.s.material.color.set(G3.t - m.hurtAt < .12 ? '#ff8080' : '#ffffff');
    m.blob.position.set(m.x, m.s.position.y + .03, m.z);
  }
  stepParticles(dt);

  // camera follows the hero; the sun's shadow box follows too
  const target = new THREE.Vector3(G3.x, hy, G3.z);
  const want = target.clone().add(CAM_OFF);
  camera.position.lerp(want, 1 - Math.pow(.001, dt));
  if(G3.shake > 0){ G3.shake -= dt; camera.position.x += (Math.random()-.5)*.12; camera.position.y += (Math.random()-.5)*.12; }
  camera.lookAt(target.x, target.y + .6, target.z);
  sun.position.set(G3.x + 6, 12, G3.z + 4); sun.target.position.set(G3.x, 0, G3.z);
  const fl = G3.t - G3.flashAt;
  el.style.setProperty('--advFlash', fl < .3 && !api.reduced() ? String(.6*(1 - fl/.3)) : '0');
  api.hud(G3.hp);
  renderer.render(scene, camera);
}

let sun = null;
function onKey(e, down){
  if(!awake) return;
  const t = e.target;
  if(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  if(/^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(e.code)) keys[e.code] = down;
  if(down && !e.repeat && (e.code === 'KeyJ' || e.code === 'Space')) keys.attack = true;
}

export function mount(container, hostApi){
  el = container; api = hostApi;
  renderer = new THREE.WebGLRenderer({ antialias: (window.devicePixelRatio || 1) < 2, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#223', 16, 34);
  camera = new THREE.PerspectiveCamera(45, 1, .1, 80);
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#4a4050', 1.35));
  sun = new THREE.DirectionalLight('#fff1d6', 1.6);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left:-12, right:12, top:12, bottom:-12, near:1, far:40 });
  sun.shadow.bias = -.0015;
  scene.add(sun); scene.add(sun.target);
  heroFrames = spriteFrames(A.drawHero(), 6, 4); monFrames = spriteFrames(A.drawMonsters(), 2, 10);
  blobGeo = new THREE.CircleGeometry(.32, 16); blobMat = new THREE.MeshBasicMaterial({ color:'#000', transparent:true, opacity:.35, depthWrite:false });
  const heroTex = heroFrames(0, 0), hb = makeBillboard(heroTex, 1.15);
  G3.hero = { s:hb.s, blob:hb.blob, tex:heroTex };
  scene.add(hb.s); scene.add(hb.blob);
  initParticles();
  clock = new THREE.Clock();
  const resize = ()=>{ const w = el.clientWidth || 360, h = el.clientHeight || 360; renderer.setSize(w, h); camera.aspect = w/h; camera.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(el); resize();
  renderer.domElement.addEventListener('pointerdown', onPointer);
  window.addEventListener('keydown', e=>onKey(e, true));
  window.addEventListener('keyup', e=>onKey(e, false));
  window.addEventListener('blur', ()=>{ for(const k in keys) keys[k] = false; });
  loadZone(api.startZone(), 'west');
  wake();
}
export function sleep(){ awake = false; if(renderer) renderer.setAnimationLoop(null); for(const k in keys) keys[k] = false; }
export function wake(){ if(!renderer) return; awake = true; clock.getDelta(); renderer.setAnimationLoop(frame); }
export function goZone(z){ if(world && world.zone !== z) loadZone(z, 'west'); }
export function zone(){ return world ? world.zone : 0; }
export function state(){ return { g:G3, attack, world }; }   // for automated tests
