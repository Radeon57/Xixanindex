// God Killer — adventure mode: a walkable top-down 2D world built with Phaser.
// Loaded on demand by ui.js the first time the adventure tab opens. Game rules and rewards stay in engine.js
// (G.advStats / G.advKill); this file only draws the world and runs the moment-to-moment action.
(function(){
'use strict';

const { T, MAP_W, MAP_H, SOLID, MON_PER_ZONE, THEMES, rng, drawTileset, drawHero, drawMonsters, makeMap, walkable, findPath,
  plotPos, drawRealmTiles, makeRealmMap, drawHerbs, drawPets } = window.GKAdvArt;
const REALM = -1;   // zone number of the personal realm; secret lands are 0..9
const ZOOM = 2;

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
    this.textures.addSpriteSheet('herbs', drawHerbs(api.herbColors()), { frameWidth:T, frameHeight:T });
    this.textures.addSpriteSheet('pets', drawPets(api.petColors()), { frameWidth:T, frameHeight:T });
    this.loadZone(api.startZone(), 'west');
  }
  // the personal realm: no monsters; herb plots that grow, the owner's pets wandering, a gate to the secret lands
  loadRealm(from){
    const r = api.realm();
    if(!this.textures.exists('tilesR')) this.textures.addCanvas('tilesR', drawRealmTiles());
    this.grid = makeRealmMap(r.lv, r.plots.length);
    this.realmPlots = r.plots.length;
    this.map = this.make.tilemap({ data:this.grid, tileWidth:T, tileHeight:T });
    this.layer = this.map.createLayer(0, this.map.addTilesetImage('tilesR', 'tilesR', T, T, 0, 0), 0, 0);
    this.layer.setCollision(SOLID);
    this.plotSprites = r.plots.map((p, i)=>{ const [x, y] = plotPos(i); return this.add.sprite(x*T + T/2, y*T + T/2 - 2, 'herbs', 0).setDepth(8).setVisible(false); });
    this.petSprites = api.ownedPets().map(pi=>{
      const [x, y] = [8 + (Math.random()*28|0), 17 + (Math.random()*10|0)];
      const sp = this.add.sprite(x*T, y*T, 'pets', pi*2).setDepth(9);
      sp.pi = pi; sp.wx = sp.x; sp.wy = sp.y; sp.until = 0;
      return sp;
    });
    this.plotsAt = 0;
    return from === 'east' ? [(MAP_W - 3) * T + T/2, (MAP_H >> 1) * T + T/2] : [5 * T + T/2, (MAP_H >> 1) * T + T/2];
  }
  loadZone(zone, from){
    this.zone = zone;
    if(this.layer){ this.layer.destroy(); this.map.destroy(); }
    (this.cols || []).forEach(c=>c.destroy()); this.cols = [];
    (this.mons || []).forEach(m=>{ m.bar.destroy(); m.destroy(); });
    (this.plotSprites || []).forEach(p=>p.destroy()); (this.petSprites || []).forEach(p=>p.destroy());
    this.plotSprites = []; this.petSprites = [];
    const mid = MAP_H >> 1;
    let sx, sy;
    if(zone === REALM) [sx, sy] = this.loadRealm(from);
    else {
      const th = THEMES[zone], key = 'tiles' + zone;
      if(!this.textures.exists(key)) this.textures.addCanvas(key, drawTileset(th));
      this.grid = makeMap(zone);
      this.map = this.make.tilemap({ data:this.grid, tileWidth:T, tileHeight:T });
      const ts = this.map.addTilesetImage(key, key, T, T, 0, 0);
      this.layer = this.map.createLayer(0, ts, 0, 0);
      this.layer.setCollision(SOLID);
      sx = from === 'east' ? (MAP_W - 3) * T + T/2 : 2 * T + T/2; sy = mid * T + T/2;
    }
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
    for(let i = 0; i < (zone === REALM ? 0 : MON_PER_ZONE); i++){
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
    this.stats = zone === REALM ? null : api.stats(zone); this.statsAt = 0;
    api.zoneChanged(zone);
    this.cameras.main.flash(250, 232, 199, 111, true);
  }
  onTap(p){
    if(this.dead) return;
    const wx = p.worldX, wy = p.worldY;
    if(this.zone === REALM){
      const tx = Math.floor(wx / T), ty = Math.floor(wy / T), v = this.grid[ty] && this.grid[ty][tx];
      const pi = this.plotSprites.findIndex((sp, i)=>{ const [x, y] = plotPos(i); return x === tx && y === ty; });
      if(pi >= 0){ api.plotTap(pi); this.burst(tx*T + T/2, ty*T + T/2, 6, 0x8ae07a); this.refreshPlots(); return; }
      if(v === 11){ api.openPanel('furnace'); return; }
      if(v === 10){ api.openPanel('spring'); return; }
    }
    const hit = this.mons.find(m=>m.alive && Math.abs(m.x - wx) < 12 && Math.abs(m.y - wy) < 12);
    this.target = hit || null;
    const tx = Math.floor((hit ? hit.x : wx) / T), ty = Math.floor((hit ? hit.y : wy) / T);
    const path = findPath(this.grid, Math.floor(this.hero.x / T), Math.floor(this.hero.y / T), tx, ty);
    this.path = path ? path.slice(1) : null;
  }
  refreshPlots(){
    const plots = api.realm().plots;
    this.plotSprites.forEach((sp, i)=>{
      const p = plots[i];
      if(!p || !p.herb){ sp.setVisible(false); return; }
      const h = api.herbIndex(p.herb), f = p.t / api.herbTime(p.herb), stage = f >= 1 ? 2 : f >= .4 ? 1 : 0;
      sp.setFrame(h*3 + stage).setVisible(true);
      sp.ripe = stage === 2;
    });
  }
  updateRealm(time, dt){
    if(api.realm().plots.length !== this.realmPlots){ this.loadZone(REALM, 'west'); return; }   // the realm grew
    if(time - this.plotsAt > 400){
      this.plotsAt = time; this.refreshPlots();
      this.plotSprites.forEach(sp=>{ if(sp.ripe && !api.reduced() && Math.random() < .25){ this.sparks.setParticleTint(0xe8c76f); this.sparks.explode(1, sp.x + (Math.random()*8 - 4), sp.y - 4); } });
    }
    for(const sp of this.petSprites){   // pets wander around the realm
      const dx = sp.wx - sp.x, dy = sp.wy - sp.y, d = Math.hypot(dx, dy);
      if(d < 2){
        if(time > sp.until){ sp.until = time + 1500 + Math.random()*3000; const tx = 4 + (Math.random()*36|0), ty = 3 + (Math.random()*24|0); if(walkable(this.grid[ty][tx])){ sp.wx = tx*T + T/2; sp.wy = ty*T + T/2; } }
        sp.setFrame(sp.pi*2);
      } else {
        const st = Math.min(d, 22*dt); sp.x += dx/d*st; sp.y += dy/d*st; sp.setFlipX(dx < 0);
        sp.setFrame(sp.pi*2 + (Math.floor(time/200) % 2));
      }
    }
  }
  attack(){
    const now = this.time.now;
    if(this.dead || now - this.atkAt < 380) return;
    this.atkAt = now;
    const i = ['down','left','right','up'].indexOf(this.dir);
    this.hero.anims.stop(); this.hero.setFrame(i*6 + 5);
    if(this.zone === REALM){ this.burst(this.hero.x, this.hero.y, 4, 0xc9a6ff); return; }
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
    if(this.zone !== REALM && time - this.statsAt > 2000){ this.statsAt = time; this.stats = api.stats(this.zone); }
    if(this.zone === REALM) this.updateRealm(time, dt);
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
        if(this.zone === REALM){ this.hero.x -= 6; api.message('ประตูสู่ดินแดนลับจะเปิดเมื่อปลดล็อกโหมดนี้'); return; }
        this.hero.x -= 6; api.message('เขตถัดไปปลดล็อกเมื่อสนามรบของ ' + api.monName(this.zone + 1) + ' เปิดในเกมหลัก');
      } else if(tx <= 0){
        if(this.zone >= 0){ this.loadZone(this.zone - 1, 'east'); return; }
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
