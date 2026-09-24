// God Killer: inline SVG icons for rows that have no portrait (trainings, skills, creations, gear, materials).
// Ink-brush / jade-and-gold style on a 32x32 grid. Glyphs in badges stay inside a radius ~12.5 circle, since the badge is round.
// Exposed as window.GKICONS; ui.js calls GKICONS.badge(set, key) and GKICONS.mat(key). Prompts for AI versions: img/PROMPTS.md.
(function(root){
'use strict';
const G = '#e8c76f', J = '#6fd3b0', R = '#e0604e', K = '#0b0a17', W = '#f2e6d8';
const f = n => +n.toFixed(2);

// tapered brush stroke: a quadratic curve thick in the middle (w) and pointed at both ends
function b(x1, y1, cx, cy, x2, y2, w, c){
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy/l*w, ny = dx/l*w;
  return `<path d="M${x1} ${y1}Q${f(cx+nx)} ${f(cy+ny)} ${x2} ${y2}Q${f(cx-nx)} ${f(cy-ny)} ${x1} ${y1}Z" fill="${c || G}"/>`;
}
const ln = (d, c, w, o) => `<path d="${d}" stroke="${c || G}" stroke-width="${w || 1.8}"${o ? ` opacity="${o}"` : ''}/>`;
const fl = (d, c, o) => `<path d="${d}" fill="${c || G}" stroke="none"${o ? ` opacity="${o}"` : ''}/>`;
const ci = (x, y, r, c, o) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c || G}" stroke="none"${o ? ` opacity="${o}"` : ''}/>`;
const svg = (body, cls) => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 32 32" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

// shared pieces
const figure = (x, c, o) => ci(x, 10, 2.6, c, o) + fl(`M${x-5} 26Q${x-4.5} 15 ${x} 14Q${x+4.5} 15 ${x+5} 26Z`, c, o);
const sword = (c, o, t) => `<g transform="${t}"${o ? ` opacity="${o}"` : ''}>` + fl('M16 5L17.6 8V20H14.4V8Z', c) +
  `<rect x="11.5" y="20" width="9" height="1.8" rx=".9" fill="${c}"/><rect x="15.1" y="21.8" width="1.8" height="4.4" fill="${c}"/>` + ci(16, 27, 1.3, c) + '</g>';
const rays = (n, r1, r2, w) => Array.from({ length:n }, (_, i)=>{
  const a = i/n*Math.PI*2, s = i % 2 ? .75 : 1, c = Math.cos(a), si = Math.sin(a);
  const x1 = f(16 + c*r1), y1 = f(16 + si*r1), x2 = f(16 + c*r2*s), y2 = f(16 + si*r2*s);
  return b(x1, y1, f((x1+x2)/2), f((y1+y2)/2), x2, y2, w);
}).join('');

const train = [
  // horse stance
  `<ellipse cx="16" cy="27" rx="8" ry="1.8" fill="${J}" opacity=".35"/>` + ci(16, 7.5, 2.6) + b(16, 10.5, 16.6, 14.5, 16, 18.5, 2.8) +
    b(16, 12.5, 12, 11.6, 8.5, 13, 1.9) + b(16, 12.5, 20, 11.6, 23.5, 13, 1.9) + ci(7.6, 13, 1.5) + ci(24.4, 13, 1.5) +
    ln('M16 18.5L10.5 20.2L9.8 26M16 18.5L21.5 20.2L22.2 26', G, 2.4),
  // wooden dummy
  `<rect x="13" y="4.5" width="6" height="21" rx="2" fill="${J}" fill-opacity=".3" stroke="${G}" stroke-width="1.6"/>` +
    ln('M19 10L25.5 8.2M13 10L6.5 8.2M19 15.5L25 17.2M19 21Q23 22 23.6 26.5', G, 2.2) + ln('M14.5 7H17.5M14.5 23H17.5', G, 1, .6) + ln('M10 27.5H22', J, 2),
  // thousand steps
  fl('M5 24H10V20H14V16H18V12H22V8H27V29H5Z', J, .3) + ln('M5 24H10V20H14V16H18V12H22V8H26', G, 1.9) + ci(10, 10.5, 2.8, R, .9) +
    ln('M20 25.5Q23 24 26 25.5', J, 1.2, .8),
  // carp swimming up a waterfall
  ln('M9 4V20M12.5 3V13M19.5 3V13M23 4V20', J, 1.4, .7) + ln('M4.5 25Q7.3 22 10 25T16 25T22 25T27.5 25', J, 1.9) +
    fl('M16 6C20.5 10 20.5 16 16 20C11.5 16 11.5 10 16 6Z') + fl('M16 19L12.5 24L16 22.2L19.5 24Z') +
    ci(14.7, 10.2, .8, K) + ci(17.3, 10.2, .8, K) + ln('M13.4 14Q16 15.6 18.6 14', K, .8, .6),
  // punching a boulder
  `<path d="M6.5 25.5L4.5 18L9 10.5L17.5 7L25.5 11.5L27.5 20.5L22.5 26.5Z" fill="${J}" fill-opacity=".25" stroke="${G}" stroke-width="1.6"/>` +
    ln('M17 7.5L14.5 14L18.5 17.5L15 25.5M14.5 14L9 15.5M18.5 17.5L24.5 18.5', G, 1.4) + ci(22, 13.5, 1, R),
  // carrying a mountain
  `<path d="M7 13L13 5.5L16 8.5L19.5 4.5L25 13Z" fill="${J}" fill-opacity=".35" stroke="${G}" stroke-width="1.6"/>` + ci(16, 16.5, 2.1) +
    ln('M12.5 21L10 13.8M19.5 21L22 13.8M12.5 21Q16 19.2 19.5 21', G, 2) + b(16, 19.5, 16.4, 22.5, 16, 25.5, 2.6) + ln('M16 25L12.8 28.3M16 25L19.2 28.3', G, 2),
  // standing through lightning
  `<path d="M8 13Q6 9 10 8.6Q11 5 15 6Q18 3.8 21 6.6Q25 6.2 25 10Q27 13 23.5 13.5Z" fill="${J}" fill-opacity=".45" stroke="${G}" stroke-width="1.2"/>` +
    fl('M17 11L11.5 19.5H15.5L13 27L21 16.5H17L19.5 11Z') + ln('M8 18L6.5 20.5M25 17.5L26 20', J, 1.2, .8),
  // resisting the heavenly storm
  ln('M14.5 16a1.5 1.5 0 1 1 3 0a3.5 3.5 0 1 1 -7 0a5.5 5.5 0 1 1 11 0', G, 1.9) + ln('M21.5 16a7.5 7.5 0 1 1 -15 0a9.5 9.5 0 1 1 19 0', J, 1.7)
];

const skill = [
  // qi breathing
  `<circle cx="16" cy="15" r="10.5" stroke="${J}" stroke-width="1.2" stroke-dasharray="2 2.3"/>` + ci(16, 8.8, 2.4) +
    fl('M12.3 20Q12.8 12.8 16 12.3Q19.2 12.8 19.7 20Z') + fl('M7.5 22.5Q16 18 24.5 22.5Q16 25.8 7.5 22.5Z') + ci(16, 17.3, 1.2, J),
  // twin tiger fists: claw slashes
  ci(16, 16, 11, J, .14) + b(8, 9, 11, 16, 16, 25, 2.8) + b(12.5, 7, 15.5, 14, 20.5, 23, 2.8) + b(17, 6, 20, 12.5, 24.5, 20, 2.6),
  // qi armour
  `<path d="M16 4L26 10V22L16 28L6 22V10Z" fill="${J}" fill-opacity=".22" stroke="${J}" stroke-width="1.6"/>` +
    `<path d="M16 7.5L23 11.6V20.4L16 24.5L9 20.4V11.6Z" stroke="${G}" stroke-width=".8" opacity=".55"/>` + ci(16, 11, 2.2) + fl('M11.8 23Q12.2 15 16 14.5Q19.8 15 20.2 23Z'),
  // lightness: a feather over a cloud wisp
  `<path d="M23 6C27 12 22 20 12.5 23C11 17 15 9 23 6Z" fill="${J}" fill-opacity=".45" stroke="${G}" stroke-width="1.2"/>` +
    ln('M8.5 25.5Q15 17 23 6', G, 1.6) + ln('M14.5 19.3L18 17.8M16.6 15.8L20.4 14.2M18.8 12.2L22 11', K, 1, .45) + ln('M5.5 21Q8 18.8 10.5 20.5', J, 1.3),
  // yang fire palm
  fl('M16 3.5C19.5 8 25 9.5 24 17C23 23 19.5 25.5 16 25.5C12.5 25.5 9 23 8 17C7 9.5 12.5 8 16 3.5Z', R, .35) +
    fl('M11.3 27L11 18.5L8.3 14.2Q7.9 12.6 9.3 12.9L11.5 15V8.6Q12.5 7.3 13.5 8.6L13.7 13.5L13.9 7.1Q15 5.8 16.1 7.1L16.2 13.5L16.8 7.9Q18 6.9 18.9 8.1L18.7 14.2L19.6 10.2Q20.8 9.4 21.5 10.6L21 19.2Q20.6 24 20.3 27Z') +
    fl('M16 15C18 17.5 19 19.5 17.6 22Q16 23.2 14.4 22C13 20 14.5 18.3 16 15Z', R),
  // heavenly eye
  `<path d="M4.5 16Q16 5 27.5 16Q16 27 4.5 16Z" fill="${J}" fill-opacity=".25" stroke="${G}" stroke-width="1.6"/>` + ci(16, 16, 4.2) + ci(16, 16, 1.8, K) + ci(17.2, 14.8, .7, W) +
    ln('M16 4.2V6.6M9.8 6L11.1 8.2M22.2 6L20.9 8.2M16 27.8V25.4M9.8 26L11.1 23.8M22.2 26L20.9 23.8', G, 1.4),
  // formless mind sword: the blade and its jade after-image
  sword(J, .45, 'translate(-4 3) rotate(45 16 16)') + sword(G, 0, 'rotate(45 16 16)') + ln('M5.5 13Q8 7 14 5.5M26.5 19Q24 25 18 26.5', J, 1.3, .8),
  // divine seal: a talisman in a seal ring
  `<circle cx="16" cy="16" r="11.5" stroke="${J}" stroke-width="1" stroke-dasharray="1.5 2"/>` +
    `<g transform="rotate(-8 16 16)"><rect x="10.5" y="4.5" width="11" height="23" rx="1" fill="${G}"/>` +
    `<circle cx="16" cy="9" r="2" stroke="${R}" stroke-width="1.3"/>` + ln('M13 13H19M16 13V24.5M13 16.3Q16 18.3 19 16.3M13.6 20L18.4 22.6M18.4 20L13.6 22.6', R, 1.3) + '</g>'
];

const create = {
  clone: figure(12.5, J, .55) + figure(19, G),
  light: ci(16, 16, 7.5, J, .25) + rays(8, 7, 12.5, 1.9) + ci(16, 16, 4.6),
  stone: `<g fill="${J}" fill-opacity=".45" stroke="${G}" stroke-width="1.3"><ellipse cx="16" cy="24" rx="8.5" ry="3.6"/>` +
    '<ellipse cx="16" cy="17.6" rx="6" ry="3"/><ellipse cx="16" cy="12" rx="4" ry="2.4"/><ellipse cx="16" cy="7.6" rx="2.3" ry="1.6"/></g>',
  soil: `<path d="M4 23Q10 11.5 16 11.5Q22 11.5 28 23Z" fill="${J}" fill-opacity=".35" stroke="${G}" stroke-width="1.5"/>` +
    ln('M7.5 18.5Q16 15 24.5 18.5', G, 1, .7) + ln('M5 26.5H27', G, 1.6) + ci(12, 20.8, 1) + ci(17.5, 21.3, .8) + ci(21.5, 20.4, .9) +
    b(16, 11.5, 14, 8.4, 12, 7.2, 1.7, J) + b(16, 11.5, 18, 8.8, 20.3, 8.2, 1.7, J),
  air: ln('M5 11H18Q22 11 22 7.5Q22 5 19.5 5Q17.5 5 17.5 7', G, 1.8) + ln('M5 16.5H23Q27 16.5 27 19.8Q27 22.6 24.2 22.6Q21.8 22.6 21.8 20.4', J, 1.8) +
    ln('M7 21.5H14.5Q17.5 21.5 17.5 24.2Q17.5 26.5 15.3 26.5', G, 1.4),
  water: `<path d="M16 4C21 10 23 14 23 18.5A7 7 0 0 1 9 18.5C9 14 11 10 16 4Z" fill="${J}" fill-opacity=".35" stroke="${G}" stroke-width="1.5"/>` +
    ln('M10.5 18.5Q13 16.5 15.5 18.5T20.5 18.5', G, 1.3) + ln('M11.8 22Q14 20.2 16.2 22T20.2 22', G, 1.1) + ci(13, 12.5, .9, W, .8),
  plant: ln('M14 27.5V4.5', G, 2.6) + ln('M12.4 20.5H15.6M12.4 13H15.6', K, 1) +
    b(14.6, 13, 19, 10.4, 25, 10.8, 2.2, J) + b(14.6, 13, 19, 13.8, 24, 17, 2, J) + b(14.6, 20.5, 18.2, 19.8, 22, 23, 1.8, J) + b(13.4, 9, 10.5, 6.8, 7.8, 7.4, 1.8, J),
  beast: ln('M13 12.5Q11 8 12 4.5M12 8.5L9 6.3M19 12.5Q21 8 20 4.5M20 8.5L23 6.3', G, 1.6) +
    fl('M11 13Q16 11 21 13L18.5 24Q16 26.5 13.5 24Z') + fl('M11.5 13.5L6.8 11.8L10.4 16.2ZM20.5 13.5L25.2 11.8L21.6 16.2Z', J) +
    ci(14, 16.5, .95, K) + ci(18, 16.5, .95, K) + ci(16, 23.3, 1.1, K),
  // the character for "person", with a red seal
  human: b(17, 5, 15, 17, 6, 26, 3.2) + b(15.5, 14, 19, 21.5, 26.5, 25.5, 3.6) + `<rect x="19.5" y="6.5" width="4.5" height="4.5" rx=".6" fill="${R}"/>` + ln('M20.8 8.7H22.7', W, .8, .8)
};

const gear = {
  weapon: fl('M16 3.5L18 6.5V19H14V6.5Z', '#bfeede') + ln('M16 6V18.5', J, .8) + fl('M10.5 19Q16 22.5 21.5 19L21 21Q16 23.5 11 21Z') +
    `<rect x="15" y="21.8" width="2" height="4.8" fill="#b8913e"/>` + ci(16, 27.2, 1.3) + ln('M16 27.8Q18.5 29.2 20.5 27.4M18.6 28.6L19.2 26.8', R, 1.3),
  armor: fl('M6.5 14.5Q7 8.5 13 8L14 12.5Q10 12.5 8.5 16.5ZM25.5 14.5Q25 8.5 19 8L18 12.5Q22 12.5 23.5 16.5Z') +
    `<path d="M11 9.5Q16 12.5 21 9.5L22 14V25Q16 28 10 25V14Z" fill="${J}" fill-opacity=".3" stroke="${G}" stroke-width="1.4"/>` +
    ln('M10.5 19.5q1.4 1.8 2.8 0q1.4 1.8 2.8 0q1.4 1.8 2.8 0q1.4 1.8 2.8 0', G, .9) + ln('M10.5 23.3H21.5', R, 1.6) + ln('M13 9.3Q16 12.8 19 9.3', G, 1.1) +
    `<circle cx="16" cy="15.3" r="2.4" fill="${J}" stroke="${G}" stroke-width="1"/>`,
  ring: `<ellipse cx="16" cy="19.5" rx="7.8" ry="5.8" stroke="${G}" stroke-width="2.8"/>` +
    `<path d="M12.5 11L14 7.5H18L19.5 11L16 14.5Z" fill="${J}" stroke="${G}" stroke-width="1.2"/>` + ln('M14 7.5L16 11L18 7.5M12.5 11H19.5', G, .7, .7),
  amulet: ln('M11.5 5L16 11L20.5 5', G, 1.2) + ci(16, 11, 1.1, R) +
    fl('M16 12a5.5 5.5 0 1 0 0.01 0ZM16 15.7a1.8 1.8 0 1 1 -0.01 0Z', J) + `<circle cx="16" cy="17.5" r="3.7" stroke="${G}" stroke-width=".8"/>` +
    ln('M16 23V28M14.8 24L14 28M17.2 24L18 28', R, 1.3)
};

// materials are shown small and inline, so they use bolder shapes and the full box
const mat = {
  ore: `<g fill="${J}" stroke="${G}" stroke-width="1.3"><path d="M8.5 27L6.5 15.5L10.5 9L14 17.5Z"/><path d="M13 27L13.8 12L18 3L22.2 12L21 27Z"/><path d="M20.5 27L23 13.5L27 18L25.5 27Z"/></g>` +
    ln('M18 3.5V26M13.8 12H22.2', W, .8, .6),
  wood: `<ellipse cx="16" cy="16.5" rx="11" ry="10" fill="#b8894d" stroke="${G}" stroke-width="1.5"/>` +
    `<g stroke="#5a3f1e" stroke-width="1.1"><ellipse cx="16" cy="16.5" rx="7.4" ry="6.7"/><ellipse cx="16" cy="16.5" rx="3.8" ry="3.4"/></g>` + ci(16, 16.5, 1.1, '#5a3f1e') + ln('M18 5.5Q20 3 22.5 4.2', J, 1.4),
  ember: fl('M16 3C20 9 26 12 24.5 20C23.5 25 19.8 29 16 29C12.2 29 8.5 25 7.5 20C6.5 14 12 12 12 7C14 9 15 10 16 3Z', '#ff8a4a') +
    fl('M16 13C18.5 17 20.5 19 19 23Q16 26 13 23C12 20 14.5 17.5 16 13Z', G),
  pearl: ci(16, 17, 9.5, '#cfe0f0') + ci(16, 17, 9.5, J, .18) + ci(12.8, 13.6, 2.8, '#fff', .85) +
    ln('M4.5 21Q3.5 10.5 12 5.5M27.5 13Q28.5 23.5 20 28.5', G, 1.5)
};

const ring = {
  train: G, skill: J,
  create: { clone:'#9fb4c8', light:'#ffe9a8', stone:'#a9b1bd', soil:'#c79a5b', air:'#9fe7ff', water:'#7fb0ff', plant:'#6fd49a', beast:'#ff9a6b', human:G },
  gear: { weapon:'#ff9a6b', armor:'#7fb0ff', ring:G, amulet:J }
};
const sets = { train, skill, create, gear, mat };

// Hero portrait: a young cultivator swordsman, ink wash with gold linework, on a 100x100 round frame.
// Fallback for img/hero/01.webp; the figure sits in .heroFig so CSS can move it without moving the frame.
const SKIN = '#ecd3b2', HAIR = '#120e1c', ROBE = '#173a35';
const HERO = `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" stroke-linecap="round" stroke-linejoin="round">
<defs><radialGradient id="gkhBg" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="#2a2119"/><stop offset="1" stop-color="${K}"/></radialGradient>
<radialGradient id="gkhAura" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${J}" stop-opacity=".55"/><stop offset=".6" stop-color="${J}" stop-opacity=".16"/><stop offset="1" stop-color="${J}" stop-opacity="0"/></radialGradient>
<linearGradient id="gkhRobe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ROBE}"/><stop offset="1" stop-color="#0c1a18"/></linearGradient>
<filter id="gkhGlow" x="-60%" y="-10%" width="220%" height="120%"><feGaussianBlur stdDeviation="1.8"/></filter></defs>
<rect width="100" height="100" fill="url(#gkhBg)"/>
<path d="M0 74L12 64L22 70L35 57L47 67L60 55L73 66L86 58L100 67V100H0Z" fill="#1b1610" opacity=".9"/>
<path d="M0 84L16 76L30 82L46 74L62 81L78 73L100 80V100H0Z" fill="#110d09"/>
<circle cx="50" cy="47" r="36" fill="url(#gkhAura)"/>
<circle cx="50" cy="42" r="27" fill="none" stroke="${G}" stroke-width=".6" opacity=".45"/>
<circle cx="50" cy="42" r="31" fill="none" stroke="${G}" stroke-width=".5" stroke-dasharray="1.5 3" opacity=".4"/>
<path d="M76 30Q86 44 80 62M24 30Q17 20 27 11M71 13Q79 17 82 24" fill="none" stroke="${J}" stroke-width="1" opacity=".55"/>
<g class="heroFig">
<path d="M41 30Q33 44 30.5 58Q29 67 24 72Q33 70.5 37 63Q39.5 58 40.5 53ZM59 28Q68 32 74 41Q79 48 87 51Q79 56.5 70.5 50.5Q64 46 60.5 41Z" fill="${HAIR}" stroke="${G}" stroke-width=".5" stroke-opacity=".6"/>
<path d="M61 33Q70 40 81 50M39.5 37Q34 50 28.5 66" fill="none" stroke="${G}" stroke-width=".5" opacity=".45"/>
<path d="M20 100Q22 70 34 62Q42 57 50 57Q58 57 66 62Q78 70 80 100Z" fill="url(#gkhRobe)" stroke="${G}" stroke-width=".9"/>
<path d="M43 57L50 71L57 57L54 57L50 64L46 57Z" fill="${W}"/>
<path d="M40.5 58L50 76.5M59.5 58L50 76.5M64 64Q62 80 66 100M36 64Q38 80 34 100" fill="none" stroke="${G}" stroke-width=".9"/>
<path d="M67 69q3.5-3 6 .5q-3.2.8-1.6 3.6M31 73q-1.5-3.6 2.4-4.6q.2 3 3 2.6M58 80q3-2 5 .6" fill="none" stroke="${G}" stroke-width=".7" opacity=".7"/>
<path d="M27 88Q50 93 73 88L73 93Q50 98 27 93Z" fill="${R}" stroke="${G}" stroke-width=".7"/>
<rect x="46" y="44" width="8" height="10" rx="3" fill="#d4b594"/>
<ellipse cx="50" cy="36" rx="9.3" ry="11.3" fill="${SKIN}"/>
<path d="M40.5 37Q38 22 50 20.5Q62 22 59.5 37Q58.5 28.5 52 27.5Q46.5 28 44 33.5Q42 31.5 40.5 37Z" fill="${HAIR}"/>
<path d="M41.5 34Q39 46 42.5 57M58.5 34Q61 46 57.5 56" fill="none" stroke="${HAIR}" stroke-width="2.4"/>
<circle cx="50" cy="17" r="5" fill="${HAIR}"/><path d="M46 17H54L53 13.5H47Z" fill="${G}"/><path d="M41.5 15.8L59 13.2" stroke="${G}" stroke-width="1.2"/><circle cx="59" cy="13.2" r="1.2" fill="${J}"/>
<path d="M43.5 32.2L47.8 33.4M56.5 32.2L52.2 33.4" stroke="${HAIR}" stroke-width="1.3"/>
<path d="M44.2 36.5Q46.2 34.9 48.3 36.1M51.7 36.1Q53.8 34.9 55.8 36.5" fill="none" stroke="${HAIR}" stroke-width="1.3"/><circle cx="46.4" cy="36.6" r=".95" fill="${HAIR}"/><circle cx="53.6" cy="36.6" r=".95" fill="${HAIR}"/>
<path d="M50 38L49.4 40.6H50.8M48.6 43.6Q50 44.3 51.4 43.6" fill="none" stroke="#9c7258" stroke-width=".8"/>
<circle cx="50" cy="28.8" r=".9" fill="${R}"/>
<g transform="translate(29 85) rotate(-9)">
<path d="M0 -67L2.7 -61V-15H-2.7V-61Z" fill="none" stroke="${J}" stroke-width="3" filter="url(#gkhGlow)"/>
<path d="M0 -67L2.7 -61V-15H-2.7V-61Z" fill="#eefaf5"/><path d="M1.5 -61V-16" stroke="#8ff0cf" stroke-width=".8"/>
<path d="M-8 -15Q0 -11 8 -15L7 -12Q0 -8.5 -7 -12Z" fill="${G}"/>
<rect x="-1.8" y="-11.5" width="3.6" height="9.5" fill="#2a1c12"/><path d="M-1.8 -9H1.8M-1.8 -6H1.8" stroke="${G}" stroke-width=".6"/>
<circle cx="0" cy="-1.2" r="2" fill="${G}"/><path d="M0 .5Q-3 5 -1 10M0 .5Q2 5 1.5 9" fill="none" stroke="${R}" stroke-width="1"/>
</g>
<path d="M35 62Q26 69 23.5 80Q29 83 34.5 80Q35.5 71 41 66Z" fill="url(#gkhRobe)" stroke="${G}" stroke-width=".9"/>
<ellipse cx="28.2" cy="77.5" rx="3.6" ry="3" fill="${SKIN}"/><path d="M26.5 76.4H30M26.6 78.3H29.8" stroke="#b08c6e" stroke-width=".5"/>
</g>
<circle cx="50" cy="50" r="48.6" fill="none" stroke="${G}" stroke-width="1.6" opacity=".8"/>
</svg>`;

root.GKICONS = {
  sets,
  // raw <svg> for a set entry (index for train/skill, key otherwise), or '' if unknown
  svg(set, k, cls){ const body = sets[set] && sets[set][k]; return body ? svg(body, cls) : ''; },
  // round badge that sits in a .jobName like a portrait; same .art frame as monster/pet portraits
  badge(set, k){
    const body = sets[set] && sets[set][k];
    if(!body) return '';
    const c = typeof ring[set] === 'string' ? ring[set] : (ring[set] && ring[set][k]) || G;
    return `<span class="art gki" style="--c:${c}">${svg(body)}</span>`;
  },
  // small inline material icon for text lines
  mat(k){ return mat[k] ? svg(mat[k], 'gkm') : ''; },
  // hero portrait svg (fallback for img/hero/01.webp)
  hero(){ return HERO; }
};
})(typeof window !== 'undefined' ? window : globalThis);
