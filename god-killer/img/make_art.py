# Draws the God Killer portraits as SVG and renders them to god-killer/img/<set>/<NN>.webp.
# Run from the repo root:  python3 god-killer/img/make_art.py
# Needs Python Playwright with Chromium. Any file can later be replaced by a hand-made or AI image of the same name.
# WARNING: it overwrites every file in those folders, including the AI-painted portraits now in the repo.
import base64, math, os, random
from playwright.sync_api import sync_playwright

OUT = os.path.dirname(os.path.abspath(__file__))
SIZE = 256

def svg(bg, body, skin=('#f0d2b4', '#a97f64'), defs=''):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="{SIZE}" height="{SIZE}"><defs>'
        f'<radialGradient id="bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="{bg[0]}"/><stop offset="1" stop-color="{bg[1]}"/></radialGradient>'
        '<radialGradient id="vig" cx="50%" cy="50%" r="50%"><stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>'
        f'<linearGradient id="skin" x1="0" x2="1"><stop offset="0" stop-color="{skin[0]}"/><stop offset="1" stop-color="{skin[1]}"/></linearGradient>'
        '<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>'
        '<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
        '<filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>'
        f'{defs}</defs><rect width="256" height="256" fill="url(#bg)"/>{body}'
        '<rect width="256" height="256" fill="url(#vig)"/></svg>')

def aura(c, r=78, cy=112, op=.55):
    return f'<circle cx="128" cy="{cy}" r="{r}" fill="{c}" opacity="{op}" filter="url(#blur)"/>'

def dots(c, pts, r=2):
    return ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}"/>' for x, y in pts)

STARS = [(30,40),(60,22),(210,34),(232,70),(22,110),(236,130),(44,70),(200,18),(150,24),(92,30)]

def bust(c, armor, behind='', hair_back='', hair_front='', top='', front='', eyes=None, face='', trim=None):
    trim = trim or c
    eyes = eyes if eyes is not None else (
        f'<g filter="url(#glow)"><ellipse cx="114" cy="119" rx="7" ry="3" fill="{c}"/><ellipse cx="142" cy="119" rx="7" ry="3" fill="{c}"/></g>')
    return (behind + hair_back +
        f'<path d="M20 256 C26 206 62 186 98 179 L158 179 C194 186 230 206 236 256 Z" fill="{armor}"/>'
        '<path d="M20 256 C26 206 62 186 98 179 L158 179 C194 186 230 206 236 256 Z" fill="url(#shade)"/>'
        f'<path d="M20 256 C26 206 62 186 98 179 L158 179 C194 186 230 206 236 256" fill="none" stroke="{trim}" stroke-width="2.5" opacity=".8"/>'
        '<path d="M111 144 L111 184 Q128 196 145 184 L145 144 Z" fill="url(#skin)"/>'
        '<path d="M111 160 Q128 172 145 160 L145 150 L111 150 Z" fill="#000" opacity=".25"/>'
        f'<path d="M96 180 L128 226 L160 180" fill="none" stroke="{trim}" stroke-width="5" stroke-linejoin="round"/>'
        f'<circle cx="128" cy="222" r="7" fill="{trim}" filter="url(#glow)"/>'
        '<ellipse cx="128" cy="116" rx="33" ry="41" fill="url(#skin)"/>'
        '<path d="M100 132 Q128 166 156 132 Q150 158 128 158 Q106 158 100 132 Z" fill="#000" opacity=".12"/>'
        '<path d="M104 110 L122 112 M134 112 L152 110" stroke="#2a1e24" stroke-width="3" stroke-linecap="round"/>'
        '<path d="M128 120 L124 136 L130 137" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="2"/>'
        '<path d="M118 146 Q128 150 138 146" fill="none" stroke="#5a2e2e" stroke-width="2.5" stroke-linecap="round"/>'
        + face + eyes + hair_front + top + front)

def bolt(x, y, s, c):
    return (f'<path transform="translate({x} {y}) scale({s})" d="M10 0 L0 22 L8 22 L2 42 L20 14 L11 14 L18 0 Z" fill="{c}" filter="url(#glow)"/>')

# ---------------- gods ----------------
def god_thunder():
    c = '#8fc0ff'
    behind = aura(c) + bolt(22, 60, 2.2, '#cfe4ff') + bolt(190, 40, 2.0, '#cfe4ff') + dots('#cfe4ff', STARS, 1.5)
    hair = '<path d="M92 104 Q90 70 110 64 L100 50 L120 58 L122 40 L134 58 L150 44 L148 62 L166 58 Q170 80 164 104 Q150 84 128 84 Q106 84 92 104 Z" fill="#e8f2ff"/>'
    crown = ('<path d="M94 88 L100 58 L110 78 L120 44 L128 72 L136 44 L146 78 L156 58 L162 88 Q128 78 94 88 Z" fill="#ffd66b" stroke="#fff3c4" stroke-width="2"/>'
             f'<circle cx="128" cy="80" r="5" fill="{c}" filter="url(#glow)"/>')
    return svg(('#23397a', '#070a1c'), bust(c, '#2d3f73', behind, hair_front=hair, top=crown, trim='#ffd66b'))

def god_war():
    c = '#ff6b6b'
    spear = lambda t: (f'<g transform="{t}"><path d="M0 0 L0 250" stroke="#8a6a4a" stroke-width="7"/>'
                       '<path d="M-12 0 L0 -40 L12 0 Z" fill="#dfe6ee"/></g>')
    behind = aura(c, op=.45) + spear('translate(60 40) rotate(-28)') + spear('translate(196 40) rotate(28)')
    helm = ('<path d="M92 112 Q90 66 128 62 Q166 66 164 112 L156 112 Q154 80 128 78 Q102 80 100 112 Z" fill="#8c95a6" stroke="#dfe6ee" stroke-width="2"/>'
            '<path d="M124 76 L132 76 L132 128 L124 128 Z" fill="#8c95a6"/>'
            '<path d="M100 72 Q128 20 176 44 Q150 44 128 66 Z" fill="#d23b3b" stroke="#ff9b9b" stroke-width="2"/>')
    pads = ('<ellipse cx="54" cy="210" rx="34" ry="22" fill="#6b2323" stroke="#ffb454" stroke-width="3"/>'
            '<ellipse cx="202" cy="210" rx="34" ry="22" fill="#6b2323" stroke="#ffb454" stroke-width="3"/>')
    scar = '<path d="M146 100 L136 132" stroke="#8a3a3a" stroke-width="2.5"/>'
    return svg(('#5a1a1a', '#12060a'), bust(c, '#4a1a1f', behind, top=helm, front=pads, face=scar, trim='#ffb454'))

def god_death():
    c = '#c9b8ff'
    wisp = lambda d: f'<path d="{d}" fill="none" stroke="{c}" stroke-width="3" opacity=".6" filter="url(#glow)"/>'
    behind = aura('#7a5cc9', op=.5) + wisp('M30 220 Q10 150 50 110 Q80 80 60 40') + wisp('M226 220 Q246 150 206 110 Q176 80 196 40')
    hood_back = '<path d="M60 250 Q56 120 80 70 Q128 10 176 70 Q200 120 196 250 Z" fill="#1e1830"/>'
    hood_front = ('<path d="M80 150 Q76 70 128 56 Q180 70 176 150 Q170 96 128 86 Q86 96 80 150 Z" fill="#2c2346" stroke="#6a5a9a" stroke-width="2"/>')
    skull = ('<path d="M100 104 Q100 80 128 80 Q156 80 156 104 L156 132 Q156 150 144 152 L144 160 L112 160 L112 152 Q100 150 100 132 Z" fill="#e9e4f4"/>'
             '<ellipse cx="115" cy="118" rx="10" ry="11" fill="#15111f"/><ellipse cx="141" cy="118" rx="10" ry="11" fill="#15111f"/>'
             '<path d="M128 128 L123 140 L133 140 Z" fill="#15111f"/>'
             '<path d="M116 152 L116 160 M124 152 L124 160 M132 152 L132 160 M140 152 L140 160" stroke="#15111f" stroke-width="2"/>')
    eyes = f'<g filter="url(#glow)"><circle cx="115" cy="119" r="4" fill="{c}"/><circle cx="141" cy="119" r="4" fill="{c}"/></g>'
    return svg(('#2a1f4a', '#07050e'), bust(c, '#221b36', behind, hair_back=hood_back, face=skull, eyes=eyes, hair_front=hood_front, trim='#8f7fd0'),
               skin=('#d6d0e4', '#8f86a8'))

def god_fate():
    c = '#ffd66b'
    spokes = ''.join(f'<path d="M128 104 L{128 + 86*math.cos(a*0.7854):.1f} {104 + 86*math.sin(a*0.7854):.1f}" stroke="{c}" stroke-width="3" opacity=".7"/>' for a in range(8))
    wheel = f'<circle cx="128" cy="104" r="86" fill="none" stroke="{c}" stroke-width="5" opacity=".8"/><circle cx="128" cy="104" r="70" fill="none" stroke="{c}" stroke-width="1.5" opacity=".6"/>'
    threads = ''.join(f'<path d="{d}" fill="none" stroke="#ffe9a8" stroke-width="1.6" opacity=".75" filter="url(#glow)"/>' for d in
                      ['M0 180 Q80 140 128 200 T256 160', 'M0 60 Q90 120 150 60 T256 90', 'M20 256 Q60 150 20 40', 'M236 256 Q196 150 236 40'])
    behind = aura(c, op=.4) + spokes + wheel + threads
    hair_back = '<path d="M86 110 Q84 64 128 62 Q172 64 170 110 L182 220 Q160 200 150 170 L106 170 Q96 200 74 220 Z" fill="#3a2418"/>'
    hair_front = '<path d="M94 110 Q96 72 128 70 Q160 72 162 110 Q150 86 128 84 Q106 86 94 110 Z" fill="#4a2e1e"/>'
    band = f'<path d="M94 112 Q128 104 162 112 L162 126 Q128 118 94 126 Z" fill="{c}" stroke="#fff3c4" stroke-width="1.5"/><circle cx="128" cy="118" r="4" fill="#fff" filter="url(#glow)"/>'
    return svg(('#4a3a14', '#0e0a04'), bust(c, '#5a4418', behind, hair_back, hair_front, top=band, eyes='', trim='#ffe9a8'))

def god_sea():
    c = '#4fe0d0'
    behind = aura(c, op=.45) + dots('#bff7ef', [(40, 60), (56, 90), (210, 70), (196, 110), (224, 150), (30, 150)], 5)
    hair_back = '<path d="M84 110 Q80 60 128 58 Q176 60 172 110 Q190 170 200 240 L150 180 L106 180 L56 240 Q66 170 84 110 Z" fill="#1d7f86"/>'
    hair_front = '<path d="M92 110 Q94 70 128 68 Q162 70 164 110 Q150 84 128 82 Q106 84 92 110 Z" fill="#2aa5a5"/>'
    coral = ''.join(f'<path d="{d}" fill="none" stroke="#ff7f7f" stroke-width="6" stroke-linecap="round"/>' for d in
                    ['M104 76 L96 46 M100 60 L86 52', 'M128 70 L128 34 M128 50 L116 40 M128 46 L140 38', 'M152 76 L160 46 M156 60 L170 52'])
    waves = ('<path d="M0 226 Q32 206 64 226 T128 226 T192 226 T256 226 L256 256 L0 256 Z" fill="#1aa6b0" opacity=".85"/>'
             '<path d="M0 240 Q32 222 64 240 T128 240 T192 240 T256 240 L256 256 L0 256 Z" fill="#8ff0e6" opacity=".6"/>')
    return svg(('#0d4a5a', '#030d14'), bust(c, '#14505a', behind, hair_back, hair_front, top=coral, front=waves, trim='#8ff0e6'),
               skin=('#cfe8e0', '#7fa8a4'))

def god_fire():
    c = '#ffb454'
    flame = ('<path d="M76 120 Q60 70 92 40 Q92 70 108 72 Q100 30 132 8 Q128 48 148 60 Q156 30 176 26 Q164 60 178 84 Q188 100 180 120 Q128 70 76 120 Z" fill="url(#fl)" filter="url(#glow)"/>')
    defs = '<linearGradient id="fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff4a1c"/><stop offset=".6" stop-color="#ff9a3c"/><stop offset="1" stop-color="#ffe27a"/></linearGradient>'
    behind = aura('#ff5a1c', r=90, op=.55) + dots('#ffcf6a', [(40, 200), (60, 150), (212, 180), (200, 130), (30, 100), (230, 90), (70, 60), (190, 50)], 3)
    cracks = '<path d="M104 96 L112 104 L108 112 M152 96 L146 106 L150 114 M124 148 L128 156" stroke="#ff9a3c" stroke-width="2" fill="none" filter="url(#glow)"/>'
    eyes = '<g filter="url(#glow)"><ellipse cx="114" cy="119" rx="7" ry="3" fill="#fff2a8"/><ellipse cx="142" cy="119" rx="7" ry="3" fill="#fff2a8"/></g>'
    return svg(('#5a1a08', '#100402'), bust(c, '#3a1a10', behind, hair_front=flame, face=cracks, eyes=eyes, trim='#ff9a3c'),
               skin=('#a9725a', '#5a3428'), defs=defs)

def god_time():
    c = '#9fe0ff'
    ticks = ''.join(f'<path d="M{128+84*math.cos(i*math.pi/6):.1f} {100+84*math.sin(i*math.pi/6):.1f} L{128+96*math.cos(i*math.pi/6):.1f} {100+96*math.sin(i*math.pi/6):.1f}" stroke="#ffe9a8" stroke-width="{5 if i%3==0 else 3}"/>' for i in range(12))
    clock = (f'<circle cx="128" cy="100" r="100" fill="none" stroke="#ffe9a8" stroke-width="3" opacity=".8"/>{ticks}'
             '<path d="M128 100 L128 16" stroke="#ffe9a8" stroke-width="4" opacity=".7"/><path d="M128 100 L196 60" stroke="#ffe9a8" stroke-width="3" opacity=".7"/>')
    behind = aura(c, op=.4) + clock
    hair_back = '<path d="M88 110 Q86 66 128 62 Q170 66 168 110 L176 180 L80 180 Z" fill="#dfe6ee"/>'
    beard = '<path d="M98 130 Q100 176 128 196 Q156 176 158 130 Q146 150 128 150 Q110 150 98 130 Z" fill="#eef2f6"/><path d="M116 144 Q128 140 140 144" stroke="#9aa6b2" stroke-width="2" fill="none"/>'
    glass = ('<g transform="translate(128 232)"><path d="M-16 -22 L16 -22 L2 0 L16 22 L-16 22 L-2 0 Z" fill="#9fe0ff" opacity=".35" stroke="#ffe9a8" stroke-width="3"/>'
             '<path d="M-8 14 L8 14 L0 4 Z" fill="#ffe9a8"/></g>')
    return svg(('#16304a', '#040a12'), bust(c, '#23384e', behind, hair_back, hair_front=beard, front=glass, trim='#ffe9a8'))

def god_moon():
    c = '#dfe6ff'
    moon = '<path d="M196 36 A34 34 0 1 0 226 86 A26 26 0 1 1 196 36 Z" fill="#eef2ff" filter="url(#glow)"/>'
    behind = aura('#8fa0ff', op=.45) + moon + dots('#eef2ff', STARS, 1.6)
    hair_back = '<path d="M84 112 Q80 58 128 56 Q176 58 172 112 Q184 180 196 250 L156 190 L100 190 L60 250 Q72 180 84 112 Z" fill="#c9d2f0"/>'
    hair_front = '<path d="M92 112 Q92 70 128 68 Q164 70 164 112 Q156 80 128 86 Q100 80 92 112 Z" fill="#e4e9fb"/>'
    diadem = ('<path d="M100 84 Q128 74 156 84" fill="none" stroke="#b8c4ff" stroke-width="3"/>'
              '<path d="M122 60 A12 12 0 1 0 134 82 A9 9 0 1 1 122 60 Z" fill="#fff" filter="url(#glow)"/>')
    return svg(('#1e2452', '#05060f'), bust('#b8c4ff', '#2a3060', behind, hair_back, hair_front, top=diadem, trim='#dfe6ff'),
               skin=('#f4ecf4', '#b4a8c4'))

def god_sun():
    c = '#ffd24a'
    rays = ''.join(f'<path d="M{128+70*math.cos(a):.1f} {100+70*math.sin(a):.1f} L{128+124*math.cos(a+0.08):.1f} {100+124*math.sin(a+0.08):.1f} L{128+124*math.cos(a-0.08):.1f} {100+124*math.sin(a-0.08):.1f} Z" fill="#ffd24a" opacity=".8"/>'
                   for a in [i*math.pi/8 for i in range(16)])
    behind = aura('#ff9a3c', r=100, op=.6) + rays + '<circle cx="128" cy="100" r="72" fill="#ffe27a" filter="url(#glow)"/>'
    hair = '<path d="M92 110 Q92 70 128 68 Q164 70 164 110 Q150 84 128 82 Q106 84 92 110 Z" fill="#b85a14"/>'
    circlet = f'<path d="M96 96 Q128 84 160 96" fill="none" stroke="#fff3c4" stroke-width="4"/><circle cx="128" cy="88" r="6" fill="#ff6b3c" stroke="#fff3c4" stroke-width="2"/>'
    return svg(('#7a4a0a', '#140a02'), bust(c, '#8a5a14', behind, hair_front=hair, top=circlet, trim='#fff3c4',
               eyes='<g filter="url(#glow)"><ellipse cx="114" cy="119" rx="7" ry="3" fill="#fff"/><ellipse cx="142" cy="119" rx="7" ry="3" fill="#fff"/></g>'),
               skin=('#e8b48a', '#9a6440'))

def god_supreme():
    c = '#ffffff'
    rings = ''.join(f'<circle cx="128" cy="104" r="{r}" fill="none" stroke="{col}" stroke-width="{w}" opacity=".75"/>' for r, col, w in
                    [(64, '#ffe9a8', 3), (82, '#c9a6ff', 2), (100, '#9fe7ff', 2), (118, '#ffe9a8', 1.5)])
    galaxy = dots('#fff', STARS + [(20, 200), (236, 210), (60, 240), (200, 244), (100, 12), (170, 10)], 1.8)
    behind = aura('#c9a6ff', r=100, op=.55) + rings + galaxy
    hair_back = '<path d="M86 112 Q82 62 128 60 Q174 62 170 112 L180 190 L76 190 Z" fill="#f4f0ff"/>'
    crown = ('<path d="M96 86 L100 40 L114 66 L128 22 L142 66 L156 40 L160 86 Q128 74 96 86 Z" fill="#ffe27a" stroke="#fff" stroke-width="2"/>'
             '<circle cx="128" cy="52" r="6" fill="#c9a6ff" filter="url(#glow)"/>')
    eye3 = '<ellipse cx="128" cy="98" rx="4" ry="7" fill="#c9a6ff" filter="url(#glow)"/>'
    robe_stars = dots('#ffe9a8', [(60, 230), (80, 210), (180, 224), (196, 240), (150, 246), (100, 244)], 2)
    return svg(('#3a2a6a', '#06040e'), bust('#fff', '#2a2050', behind, hair_back, top=crown, face=eye3, front=robe_stars, trim='#ffe27a',
               eyes='<g filter="url(#glow)"><ellipse cx="114" cy="119" rx="7" ry="3" fill="#fff"/><ellipse cx="142" cy="119" rx="7" ry="3" fill="#fff"/></g>'),
               skin=('#f6eee8', '#b8a8b8'))

# ---------------- ultimate beings ----------------
def ub_sky():
    c = '#9fe7ff'
    wing = lambda s: (f'<g transform="translate(128 0) scale({s} 1)">' +
                      ''.join(f'<path d="M20 170 Q{70+i*16} {60+i*18} {110+i*6} {40+i*30} Q{80+i*10} {110+i*16} 20 {190+i*4} Z" fill="#dff8ff" opacity="{.9-i*.15}" stroke="#9fe7ff" stroke-width="1.5"/>' for i in range(4)) + '</g>')
    behind = aura(c, r=100, op=.5) + wing(1) + wing(-1)
    helm = ('<path d="M92 124 Q88 70 128 64 Q168 70 164 124 L150 124 L150 108 L106 108 L106 124 Z" fill="#e8f4ff" stroke="#9fe7ff" stroke-width="2"/>'
            '<path d="M106 110 L150 110 L146 124 L110 124 Z" fill="#9fe7ff" filter="url(#glow)"/>'
            '<path d="M128 64 L128 30" stroke="#ffe9a8" stroke-width="4"/><path d="M118 42 L128 20 L138 42 Z" fill="#ffe9a8"/>')
    return svg(('#1e4a6a', '#040c14'), bust(c, '#cfdcea', behind, top=helm, eyes='', trim='#9fe7ff'))

def ub_chaos():
    rnd = random.Random(7)
    body = ('<path d="M128 30 Q200 30 214 100 Q240 160 200 220 Q160 256 128 240 Q90 256 56 220 Q18 160 42 100 Q56 30 128 30 Z" fill="#3a1a5a" stroke="#c77dff" stroke-width="3"/>')
    tent = ''.join(f'<path d="M{x} {y} Q{x+rnd.randint(-40,40)} {y+40} {x+rnd.randint(-50,50)} 256" stroke="#5a2a8a" stroke-width="{rnd.randint(8,14)}" fill="none" stroke-linecap="round"/>'
                   for x, y in [(60, 200), (100, 220), (156, 220), (196, 200), (128, 230)])
    eyes = ''
    for x, y, r in [(128, 110, 26), (82, 90, 14), (176, 88, 16), (70, 150, 12), (186, 150, 13), (110, 170, 10), (150, 176, 11), (128, 60, 9), (96, 128, 7), (162, 124, 8)]:
        eyes += (f'<circle cx="{x}" cy="{y}" r="{r}" fill="#f4e8ff"/><circle cx="{x}" cy="{y}" r="{r*.55:.1f}" fill="#c77dff" filter="url(#glow)"/>'
                 f'<ellipse cx="{x}" cy="{y}" rx="{r*.15:.1f}" ry="{r*.45:.1f}" fill="#10041a"/>')
    return svg(('#2a0e44', '#06020c'), aura('#c77dff', r=100, op=.5) + tent + body + eyes)

def ub_nameless():
    cracks = ''.join(f'<path d="M128 110 L{128+60*math.cos(a):.0f} {110+60*math.sin(a):.0f} L{128+90*math.cos(a+.15):.0f} {110+90*math.sin(a+.15):.0f} L{128+140*math.cos(a-.05):.0f} {110+140*math.sin(a-.05):.0f}" fill="none" stroke="#fff" stroke-width="2" opacity=".8" filter="url(#glow)"/>'
                     for a in [0.3, 1.2, 2.1, 2.9, 3.8, 4.6, 5.5])
    rings = ''.join(f'<circle cx="128" cy="110" r="{r}" fill="none" stroke="#fff" stroke-width="1" opacity=".35"/>' for r in (56, 76, 96))
    figure = ('<path d="M20 256 C26 206 62 186 98 179 L158 179 C194 186 230 206 236 256 Z" fill="#f6f6fa"/>'
              '<path d="M111 144 L111 184 L145 184 L145 144 Z" fill="#f6f6fa"/><ellipse cx="128" cy="116" rx="33" ry="41" fill="#ffffff"/>'
              '<ellipse cx="128" cy="116" rx="33" ry="41" fill="url(#shade)" opacity=".4"/>')
    return svg(('#202028', '#000000'), aura('#ffffff', r=80, op=.35) + rings + cracks + figure)

# ---------------- monsters ----------------
def m_mist():
    ghost = ('<path d="M70 230 Q70 70 128 60 Q186 70 186 230 Q170 214 158 232 Q144 212 128 232 Q112 212 98 232 Q86 214 70 230 Z" fill="#dff6f2" opacity=".85"/>'
             '<ellipse cx="108" cy="130" rx="12" ry="16" fill="#1a3a3a"/><ellipse cx="148" cy="130" rx="12" ry="16" fill="#1a3a3a"/>'
             '<ellipse cx="128" cy="170" rx="10" ry="14" fill="#1a3a3a"/>')
    mist = ''.join(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="18" fill="#bfe8e0" opacity=".45" filter="url(#blur)"/>' for x, y, rx in [(60, 220, 60), (196, 210, 60), (128, 240, 90), (128, 60, 50)])
    return svg(('#2a4a4a', '#050c0c'), mist + ghost)

def m_wolf():
    smoke = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#302040" opacity=".7" filter="url(#blur)"/>' for x, y, r in [(50, 200, 40), (206, 200, 40), (128, 240, 50)])
    head = ('<path d="M70 60 L100 110 L156 110 L186 60 L176 130 Q170 170 150 190 L128 222 L106 190 Q86 170 80 130 Z" fill="#1c1626" stroke="#6a5a8a" stroke-width="2"/>'
            '<path d="M80 72 L98 108 L90 110 Z M176 72 L158 108 L166 110 Z" fill="#4a3a60"/>'
            '<path d="M108 170 L128 222 L148 170 Q128 180 108 170 Z" fill="#2a2236"/><path d="M120 206 L136 206 L128 216 Z" fill="#000"/>'
            '<g filter="url(#glow)"><path d="M98 138 L118 146 L100 150 Z" fill="#ffd24a"/><path d="M158 138 L138 146 L156 150 Z" fill="#ffd24a"/></g>'
            '<path d="M118 214 L122 226 M138 214 L134 226" stroke="#fff" stroke-width="3"/>')
    return svg(('#2a1e3a', '#06040a'), aura('#6a4aa0', op=.4) + smoke + head)

def m_golem():
    head = ('<path d="M64 70 L192 70 L204 190 L172 230 L84 230 L52 190 Z" fill="#7a7a82" stroke="#3a3a42" stroke-width="3"/>'
            '<path d="M64 70 L100 60 L160 58 L192 70 Z" fill="#5a8a4a"/><path d="M52 190 L72 180 L84 230 Z" fill="#5a8a4a"/>'
            '<path d="M84 110 L120 116 L116 134 L82 128 Z M172 110 L136 116 L140 134 L174 128 Z" fill="#2a2a32"/>'
            '<g filter="url(#glow)"><path d="M92 118 L112 122 L110 128 L90 124 Z M164 118 L144 122 L146 128 L166 124 Z" fill="#6ff0ff"/>'
            '<path d="M128 80 L136 92 L128 104 L120 92 Z" fill="#6ff0ff"/></g>'
            '<path d="M96 180 L160 180 L152 198 L104 198 Z" fill="#3a3a42"/>'
            '<path d="M150 150 L170 170 L164 196 M80 150 L96 170" stroke="#3a3a42" stroke-width="2.5" fill="none"/>')
    return svg(('#2e3a3e', '#06080a'), aura('#6ff0ff', op=.25) + head)

def m_serpent():
    hood = ('<path d="M128 40 Q200 50 206 140 Q200 200 150 210 L150 256 L106 256 L106 210 Q56 200 50 140 Q56 50 128 40 Z" fill="#1a1a22" stroke="#5aff7a" stroke-width="2.5"/>'
            '<path d="M128 70 Q170 80 172 140 Q160 176 128 180 Q96 176 84 140 Q86 80 128 70 Z" fill="#2a3a2a"/>'
            '<path d="M100 110 Q128 100 156 110 M96 140 Q128 130 160 140" stroke="#5aff7a" stroke-width="3" fill="none" opacity=".7"/>'
            '<g filter="url(#glow)"><ellipse cx="108" cy="96" rx="9" ry="6" fill="#aaff5a"/><ellipse cx="148" cy="96" rx="9" ry="6" fill="#aaff5a"/></g>'
            '<ellipse cx="108" cy="96" rx="2" ry="5" fill="#000"/><ellipse cx="148" cy="96" rx="2" ry="5" fill="#000"/>'
            '<path d="M116 164 L120 186 L124 164 M132 164 L136 186 L140 164" fill="#fff"/>'
            '<g filter="url(#glow)"><ellipse cx="120" cy="198" rx="3" ry="5" fill="#5aff7a"/><ellipse cx="136" cy="212" rx="3" ry="5" fill="#5aff7a"/></g>')
    return svg(('#16301a', '#030804'), aura('#5aff7a', op=.25) + hood)

def m_firedemon():
    defs = '<linearGradient id="fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff3a1c"/><stop offset="1" stop-color="#ffd24a"/></linearGradient>'
    flames = '<path d="M40 250 Q20 160 60 110 Q60 150 80 150 Q70 80 110 40 Q110 90 128 100 Q146 90 146 40 Q186 80 176 150 Q196 150 196 110 Q236 160 216 250 Z" fill="url(#fl)" opacity=".85" filter="url(#glow)"/>'
    head = ('<path d="M84 110 Q84 70 128 66 Q172 70 172 110 L168 170 Q150 206 128 208 Q106 206 88 170 Z" fill="#a8261c" stroke="#ff9a3c" stroke-width="2"/>'
            '<path d="M90 90 Q60 60 70 20 Q84 60 104 76 Z M166 90 Q196 60 186 20 Q172 60 152 76 Z" fill="#2a1410" stroke="#ff9a3c" stroke-width="2"/>'
            '<path d="M100 120 L120 128 L102 134 Z M156 120 L136 128 L154 134 Z" fill="#ffe27a" filter="url(#glow)"/>'
            '<path d="M106 168 Q128 182 150 168 L146 180 Q128 190 110 180 Z" fill="#2a0a06"/><path d="M112 170 L116 180 L120 172 M136 172 L140 180 L144 170" fill="#fff"/>')
    return svg(('#4a1206', '#0c0302'), flames + head, defs=defs)

def m_yaksha():
    crown = ('<path d="M92 84 Q128 70 164 84 L154 64 L144 66 L138 40 L130 44 L128 6 L126 44 L118 40 L112 66 L102 64 Z" fill="#ffd24a" stroke="#8a5a14" stroke-width="2"/>'
             '<path d="M92 84 Q128 72 164 84 L164 94 Q128 82 92 94 Z" fill="#e0a830"/><circle cx="128" cy="86" r="5" fill="#ff4a4a"/>')
    head = ('<path d="M84 94 L172 94 L178 170 Q166 216 128 220 Q90 216 78 170 Z" fill="#3aa05a" stroke="#1a5a2a" stroke-width="2"/>'
            '<path d="M78 120 L66 110 L70 150 L80 150 Z M178 120 L190 110 L186 150 L176 150 Z" fill="#ffd24a"/>'
            '<circle cx="108" cy="130" r="14" fill="#fff"/><circle cx="148" cy="130" r="14" fill="#fff"/><circle cx="108" cy="130" r="7" fill="#c02020"/><circle cx="148" cy="130" r="7" fill="#c02020"/>'
            '<path d="M92 110 L122 116 M164 110 L134 116" stroke="#0e3a1a" stroke-width="5" stroke-linecap="round"/>'
            '<path d="M100 178 Q128 198 156 178 Q150 206 128 208 Q106 206 100 178 Z" fill="#6a0a0a"/>'
            '<path d="M104 182 L110 160 L114 186 Z M152 182 L146 160 L142 186 Z" fill="#fff"/>')
    return svg(('#1e3a24', '#040a06'), aura('#ffd24a', op=.3) + head + crown)

def m_naga():
    def hd(x, y, s):
        return (f'<g transform="translate({x} {y}) scale({s})">'
                '<path d="M0 -60 Q40 -56 42 -10 Q40 30 14 40 L14 140 L-14 140 L-14 40 Q-40 30 -42 -10 Q-40 -56 0 -60 Z" fill="#141420" stroke="#ffd24a" stroke-width="2.5"/>'
                '<path d="M-26 -58 L-18 -84 L-8 -62 L0 -92 L8 -62 L18 -84 L26 -58 Z" fill="#ffd24a"/>'
                '<g filter="url(#glow)"><ellipse cx="-14" cy="-16" rx="6" ry="4" fill="#ff5a5a"/><ellipse cx="14" cy="-16" rx="6" ry="4" fill="#ff5a5a"/></g>'
                '<path d="M-8 20 L0 30 L8 20" stroke="#ffd24a" stroke-width="2" fill="none"/></g>')
    return svg(('#1a1a3a', '#030308'), aura('#5a5aff', op=.3) + hd(70, 140, .8) + hd(186, 140, .8) + hd(128, 120, 1))

def m_lightning():
    wings = ('<path d="M128 130 Q70 60 14 70 Q40 90 30 110 Q56 110 50 136 Q80 124 90 160 Z" fill="#20203a" stroke="#9fb8ff" stroke-width="2"/>'
             '<path d="M128 130 Q186 60 242 70 Q216 90 226 110 Q200 110 206 136 Q176 124 166 160 Z" fill="#20203a" stroke="#9fb8ff" stroke-width="2"/>')
    body = ('<path d="M96 240 Q90 160 104 130 Q100 90 128 80 Q156 90 152 130 Q166 160 160 240 Z" fill="#2a2a4a"/>'
            '<path d="M108 88 L100 60 L116 80 Z M148 88 L156 60 L140 80 Z" fill="#9fb8ff"/>'
            '<g filter="url(#glow)"><path d="M112 108 L124 112 L112 116 Z M144 108 L132 112 L144 116 Z" fill="#dff0ff"/></g>')
    return svg(('#161a3a', '#030410'), aura('#8fa8ff', op=.4) + wings + body + bolt(104, 150, 2.0, '#fff27a') + bolt(20, 170, 1.3, '#cfe4ff') + bolt(210, 160, 1.3, '#cfe4ff'))

def m_timedemon():
    ticks = ''.join(f'<circle cx="{128+66*math.cos(i*math.pi/6):.1f}" cy="{128+66*math.sin(i*math.pi/6):.1f}" r="{5 if i%3==0 else 3}" fill="#ffe9a8"/>' for i in range(12))
    face = ('<circle cx="128" cy="128" r="84" fill="#2a2440" stroke="#ffe9a8" stroke-width="6"/>' + ticks +
            '<path d="M128 44 L118 100 L136 120 L120 170 L130 212" fill="none" stroke="#0a0810" stroke-width="5"/>'
            '<g filter="url(#glow)"><circle cx="100" cy="112" r="11" fill="#ff5a8a"/><circle cx="156" cy="112" r="11" fill="#ff5a8a"/></g>'
            '<path d="M128 128 L96 170" stroke="#ffe9a8" stroke-width="5" stroke-linecap="round"/><path d="M128 128 L176 150" stroke="#ffe9a8" stroke-width="4" stroke-linecap="round"/>'
            '<path d="M60 60 L40 30 M196 60 L216 30" stroke="#ffe9a8" stroke-width="6" stroke-linecap="round"/>')
    return svg(('#2a1a3a', '#05030a'), aura('#ff5a8a', op=.3) + face)

def m_demonking():
    cape = '<path d="M30 256 Q40 150 80 120 L176 120 Q216 150 226 256 Z" fill="#3a0a14"/><path d="M60 150 Q50 90 90 70 L96 130 Z M196 150 Q206 90 166 70 L160 130 Z" fill="#5a0a1a"/>'
    head = ('<path d="M92 110 Q92 70 128 66 Q164 70 164 110 L160 170 Q146 200 128 202 Q110 200 96 170 Z" fill="#1e1a24" stroke="#ff4a4a" stroke-width="2"/>'
            '<path d="M96 96 Q54 76 44 30 Q70 64 104 76 Z M160 96 Q202 76 212 30 Q186 64 152 76 Z" fill="#0e0a12" stroke="#ff4a4a" stroke-width="2"/>'
            '<path d="M100 78 L108 48 L118 70 L128 38 L138 70 L148 48 L156 78 Z" fill="#c02020" stroke="#ff9a3c" stroke-width="2"/>'
            '<g filter="url(#glow)"><path d="M104 122 L122 128 L104 132 Z M152 122 L134 128 L152 132 Z" fill="#ff3a3a"/></g>'
            '<path d="M112 172 Q128 180 144 172" stroke="#ff4a4a" stroke-width="2" fill="none"/>')
    return svg(('#3a0a10', '#080204'), aura('#ff2a2a', op=.4) + cape + head)

# ---------------- pets ----------------
def p_crane():
    neck = '<path d="M150 256 Q120 200 128 150 Q134 110 120 90" fill="none" stroke="#f4fff8" stroke-width="22" stroke-linecap="round"/>'
    wing = '<path d="M150 256 Q170 180 230 170 Q206 206 226 222 Q196 226 200 256 Z" fill="#7fe0c0" stroke="#dffff4" stroke-width="2"/>'
    head = ('<ellipse cx="118" cy="84" rx="26" ry="22" fill="#f4fff8"/><circle cx="116" cy="64" r="9" fill="#ff4a4a"/>'
            '<path d="M96 88 L40 104 L98 96 Z" fill="#ffd24a"/><circle cx="118" cy="82" r="5" fill="#10201a"/><circle cx="120" cy="80" r="1.8" fill="#fff"/>')
    return svg(('#1a4a3a', '#03100c'), aura('#7fe0c0', op=.45) + wing + neck + head)

def p_fox():
    tails = ''.join(f'<ellipse cx="{128+70*math.cos(a):.1f}" cy="{150+70*math.sin(a):.1f}" rx="16" ry="44" transform="rotate({math.degrees(a)+90:.0f} {128+70*math.cos(a):.1f} {150+70*math.sin(a):.1f})" fill="#ff9a6b" stroke="#ffe0c8" stroke-width="2"/>'
                    for a in [math.pi + i*math.pi/8 for i in range(9)])
    face = ('<path d="M76 90 L92 150 L128 196 L164 150 L180 90 L150 116 L106 116 Z" fill="#ff8a4a"/>'
            '<path d="M80 96 L96 124 L104 118 Z M176 96 L160 124 L152 118 Z" fill="#fff0e0"/>'
            '<path d="M100 150 Q128 140 156 150 L128 196 Z" fill="#fff4ea"/>'
            '<ellipse cx="108" cy="140" rx="7" ry="9" fill="#2a1408"/><ellipse cx="148" cy="140" rx="7" ry="9" fill="#2a1408"/>'
            '<circle cx="110" cy="137" r="2.5" fill="#fff"/><circle cx="150" cy="137" r="2.5" fill="#fff"/><ellipse cx="128" cy="184" rx="6" ry="4" fill="#2a1408"/>'
            '<g filter="url(#glow)"><path d="M128 100 Q120 86 128 72 Q136 86 128 100 Z" fill="#9fe7ff"/></g>')
    return svg(('#4a2410', '#0c0602'), aura('#ff9a6b', op=.4) + tails + face)

def p_turtle():
    hexes = ''.join(f'<path d="' + ' '.join(('M' if k == 0 else 'L') + f'{x+14*math.cos(k*math.pi/3):.1f} {y+14*math.sin(k*math.pi/3):.1f}' for k in range(6)) + ' Z" fill="none" stroke="#9fd0ff" stroke-width="2.5" filter="url(#glow)"/>'
                    for x, y in [(128, 150), (104, 136), (152, 136), (104, 164), (152, 164), (128, 122), (128, 178)])
    body = ('<ellipse cx="60" cy="200" rx="16" ry="12" fill="#6a9a7a"/><ellipse cx="196" cy="200" rx="16" ry="12" fill="#6a9a7a"/>'
            '<ellipse cx="128" cy="80" rx="24" ry="22" fill="#7aaa8a"/><circle cx="118" cy="76" r="5" fill="#10201a"/><circle cx="138" cy="76" r="5" fill="#10201a"/>'
            '<circle cx="120" cy="74" r="1.8" fill="#fff"/><circle cx="140" cy="74" r="1.8" fill="#fff"/><path d="M120 90 Q128 95 136 90" stroke="#10201a" stroke-width="2" fill="none"/>'
            '<ellipse cx="128" cy="152" rx="70" ry="54" fill="#2a4a6a" stroke="#9fd0ff" stroke-width="3"/>')
    return svg(('#16304a', '#030810'), aura('#7fb0ff', op=.4) + body + hexes)

def p_tiger():
    defs = '<linearGradient id="fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff4a1c"/><stop offset="1" stop-color="#ffd24a"/></linearGradient>'
    ears = '<path d="M62 100 Q50 40 90 60 Q80 20 110 50 L100 96 Z M194 100 Q206 40 166 60 Q176 20 146 50 L156 96 Z" fill="url(#fl)" filter="url(#glow)"/>'
    face = ('<ellipse cx="128" cy="140" rx="76" ry="66" fill="#ff8a2a"/>'
            '<path d="M128 76 L120 100 L128 96 L136 100 Z M70 120 L96 128 L70 136 M186 120 L160 128 L186 136 M76 160 L98 156 M180 160 L158 156" stroke="#2a1408" stroke-width="5" fill="#2a1408" stroke-linecap="round"/>'
            '<ellipse cx="128" cy="170" rx="34" ry="26" fill="#fff4e8"/>'
            '<circle cx="104" cy="132" r="10" fill="#2a1408"/><circle cx="152" cy="132" r="10" fill="#2a1408"/><circle cx="107" cy="128" r="3.5" fill="#fff"/><circle cx="155" cy="128" r="3.5" fill="#fff"/>'
            '<path d="M120 160 L136 160 L128 170 Z" fill="#ff5a7a"/><path d="M128 170 Q118 182 110 176 M128 170 Q138 182 146 176" stroke="#2a1408" stroke-width="2.5" fill="none"/>')
    return svg(('#4a1a08', '#0c0402'), aura('#ff6b3c', op=.45) + ears + face, defs=defs)

def p_phoenix():
    defs = '<linearGradient id="fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff4a1c"/><stop offset=".5" stop-color="#ffb454"/><stop offset="1" stop-color="#fff27a"/></linearGradient>'
    tail = ''.join(f'<path d="M128 150 Q{x} 200 {x2} 250" fill="none" stroke="url(#fl)" stroke-width="10" stroke-linecap="round" filter="url(#glow)"/>' for x, x2 in [(90, 60), (128, 128), (166, 196), (70, 30), (186, 226)])
    wings = '<path d="M128 130 Q60 60 20 90 Q60 100 50 130 Q90 120 110 160 Z M128 130 Q196 60 236 90 Q196 100 206 130 Q166 120 146 160 Z" fill="url(#fl)" stroke="#fff27a" stroke-width="2"/>'
    body = ('<ellipse cx="128" cy="140" rx="24" ry="34" fill="#ffb454"/><circle cx="128" cy="92" r="20" fill="#ffd24a"/>'
            '<path d="M120 74 Q116 50 128 40 Q126 56 136 60 Q140 50 146 50 Q140 64 134 76 Z" fill="#ff6b3c"/>'
            '<path d="M140 92 L162 98 L140 102 Z" fill="#ff6b3c"/><circle cx="132" cy="88" r="4" fill="#2a0a02"/><circle cx="133" cy="87" r="1.4" fill="#fff"/>')
    return svg(('#5a2408', '#0e0402'), aura('#ffb454', r=90, op=.5) + tail + wings + body, defs=defs)

def p_qilin():
    cloud = ''.join(f'<path d="M{x} {y} q12 -16 26 -4 q14 -12 24 4 q14 2 6 14 h-52 q-10 -8 -4 -14 Z" fill="#fff8e0" opacity=".55"/>' for x, y in [(20, 220), (190, 230), (40, 60), (190, 50)])
    antlers = '<path d="M100 70 Q90 40 70 30 M88 50 L66 50 M156 70 Q166 40 186 30 M168 50 L190 50" stroke="#c9a6ff" stroke-width="7" fill="none" stroke-linecap="round"/>'
    head = ('<path d="M84 90 Q84 62 128 60 Q172 62 172 90 L178 150 Q170 190 128 196 Q86 190 78 150 Z" fill="#e8c76f" stroke="#fff3c4" stroke-width="2"/>'
            '<path d="M96 100 q8 -6 16 0 M144 100 q8 -6 16 0 M110 170 q18 10 36 0" stroke="#8a5a14" stroke-width="3" fill="none"/>'
            '<path d="M84 150 Q60 170 70 200 M172 150 Q196 170 186 200" stroke="#4fd1c5" stroke-width="8" fill="none" stroke-linecap="round"/>'
            '<circle cx="106" cy="122" r="9" fill="#2a1408"/><circle cx="150" cy="122" r="9" fill="#2a1408"/><circle cx="109" cy="119" r="3" fill="#fff"/><circle cx="153" cy="119" r="3" fill="#fff"/>'
            '<path d="M104 146 Q128 136 152 146 Q150 170 128 174 Q106 170 104 146 Z" fill="#f4dc94"/><path d="M118 152 q3 3 6 0 M132 152 q3 3 6 0" stroke="#6a4010" stroke-width="2.5" fill="none"/>'
            '<path d="M84 64 Q70 40 92 30 Q90 50 104 56 M172 64 Q186 40 164 30 Q166 50 152 56" fill="#4fd1c5"/>'
            + dots('#fff3c4', [(100, 84), (120, 76), (140, 76), (160, 84), (128, 92)], 3))
    return svg(('#3a2e10', '#0a0802'), aura('#e8c76f', op=.45) + cloud + antlers + head)

# ---------------- dungeons ----------------
def d_cave():
    crystals = ''.join(f'<path d="M{x} {y} L{x+w/2} {y-h} L{x+w} {y} Z" fill="#6fd8ff" opacity=".9" stroke="#dff8ff" stroke-width="1.5" filter="url(#glow)"/>' for x, y, w, h in
                       [(40, 256, 30, 90), (64, 256, 22, 60), (180, 256, 34, 110), (208, 256, 22, 70), (110, 256, 16, 40), (140, 256, 20, 54), (60, 30, 18, -50), (180, 20, 22, -60)])
    arch = '<path d="M0 0 L256 0 L256 256 L226 256 Q220 90 128 80 Q36 90 30 256 L0 256 Z" fill="#141a2a"/>'
    return svg(('#1a4a6a', '#02060c'), aura('#6fd8ff', r=70, cy=160, op=.5) + arch + crystals)

def d_forest():
    moon = '<circle cx="176" cy="70" r="30" fill="#e8dcff" filter="url(#glow)"/>'
    tree = lambda x, s: (f'<g transform="translate({x} 256) scale({s})"><path d="M-10 0 Q-6 -80 -20 -130 Q-40 -150 -60 -140 M-14 -100 Q10 -140 40 -150 M-18 -130 Q-10 -170 10 -190" stroke="#0c0812" stroke-width="12" fill="none" stroke-linecap="round"/>'
                         '<path d="M-14 0 Q-8 -80 -18 -130 L-4 -130 Q6 -80 10 0 Z" fill="#0c0812"/></g>')
    mist = ''.join(f'<ellipse cx="{x}" cy="{y}" rx="80" ry="18" fill="#9a6ad0" opacity=".45" filter="url(#blur)"/>' for x, y in [(60, 210), (200, 226), (128, 180)])
    return svg(('#3a2256', '#06030c'), moon + tree(60, 1) + tree(200, -1.1) + tree(130, .7) + mist)

def d_volcano():
    sky = '<rect width="256" height="256" fill="#ff5a1c" opacity=".12"/>'
    mountain = '<path d="M0 256 L90 100 L110 108 L146 108 L166 100 L256 256 Z" fill="#2a1410"/>'
    lava = ('<path d="M110 108 Q120 150 100 200 Q96 230 110 256 L124 256 Q112 220 126 170 Q134 130 146 108 Z" fill="#ff7a1c" filter="url(#glow)"/>'
            '<path d="M146 108 Q160 170 190 256 L200 256 Q176 180 156 110 Z" fill="#ff9a3c" filter="url(#glow)"/>')
    erupt = '<path d="M112 104 Q100 60 128 20 Q156 60 144 104 Z" fill="#ffb454" opacity=".85" filter="url(#glow)"/>'
    ash = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#3a2a2a" opacity=".8" filter="url(#blur)"/>' for x, y, r in [(70, 40, 30), (190, 30, 34), (128, 10, 26)])
    return svg(('#5a1a08', '#0c0302'), sky + ash + erupt + mountain + lava + dots('#ffcf6a', [(90, 60), (170, 50), (60, 90), (200, 80)], 2.5))

def d_palace():
    rays = ''.join(f'<path d="M{x} 0 L{x+30} 0 L{x+70} 256 L{x+40} 256 Z" fill="#9ff0ff" opacity=".12"/>' for x in (20, 90, 160))
    prang = lambda x, s: (f'<g transform="translate({x} 230) scale({s})"><path d="M-30 0 L-24 -60 Q-20 -110 0 -150 Q20 -110 24 -60 L30 0 Z" fill="#12304a" stroke="#6fd8ff" stroke-width="2"/>'
                          '<path d="M-20 -40 L20 -40 M-18 -80 L18 -80 M-12 -115 L12 -115" stroke="#6fd8ff" stroke-width="2"/><path d="M0 -150 L0 -175" stroke="#ffd24a" stroke-width="3"/></g>')
    base = '<rect x="40" y="226" width="176" height="30" fill="#0e2438" stroke="#6fd8ff" stroke-width="2"/>'
    coral = '<path d="M20 256 Q16 220 30 200 M30 230 Q40 214 50 210 M236 256 Q240 214 226 196 M232 226 Q220 214 212 212" stroke="#ff7f9a" stroke-width="7" fill="none" stroke-linecap="round"/>'
    bubbles = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="none" stroke="#bff7ff" stroke-width="1.5"/>' for x, y, r in [(70, 80, 5), (80, 60, 3), (190, 100, 6), (200, 76, 3), (40, 140, 4)])
    return svg(('#0e4a6a', '#010810'), rays + prang(80, .7) + prang(176, .7) + prang(128, 1) + base + coral + bubbles + aura('#6fd8ff', r=40, cy=90, op=.35))

SETS = {
    'gods': [god_thunder, god_war, god_death, god_fate, god_sea, god_fire, god_time, god_moon, god_sun, god_supreme],
    'ultimates': [ub_sky, ub_chaos, ub_nameless],
    'monsters': [m_mist, m_wolf, m_golem, m_serpent, m_firedemon, m_yaksha, m_naga, m_lightning, m_timedemon, m_demonking],
    'pets': [p_crane, p_fox, p_turtle, p_tiger, p_phoenix, p_qilin],
    'dungeons': [d_cave, d_forest, d_volcano, d_palace],
}

RENDER = """async (src) => {
  const img = new Image(); img.src = 'data:image/svg+xml;base64,' + src; await img.decode();
  const c = document.createElement('canvas'); c.width = c.height = %d;
  c.getContext('2d').drawImage(img, 0, 0, %d, %d);
  return c.toDataURL('image/webp', 0.86);
}""" % (SIZE, SIZE, SIZE)

if __name__ == '__main__':
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=os.environ.get('CHROMIUM', '/opt/pw-browsers/chromium') or None)
        page = b.new_page()
        for folder, fns in SETS.items():
            os.makedirs(os.path.join(OUT, folder), exist_ok=True)
            for i, fn in enumerate(fns):
                src = base64.b64encode(fn().encode()).decode()
                data = page.evaluate(RENDER, src)
                with open(os.path.join(OUT, folder, '%02d.webp' % (i + 1)), 'wb') as f:
                    f.write(base64.b64decode(data.split(',', 1)[1]))
        b.close()
    print('done')
