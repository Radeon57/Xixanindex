#!/usr/bin/env python3
"""Browser smoke test for God Killer.

Serves the repo on a local port, then for each screen size (phone 360x740, PC 1366x768) and each save
(a fresh game, tests/fixtures/save_early.json, tests/fixtures/save_late.json) it opens every tab and
sub-tab, clicks every visible enabled button once, and fails on:
  - page errors or console errors (Google Fonts are blocked on purpose, so their net::ERR_FAILED is ignored;
    a missing local file still fails as a 404)
  - "NaN" or "undefined" anywhere in the page text
  - horizontal scrolling

Usage:  python3 tests/ui_smoke.py            (needs: pip install playwright; a Chromium build)
        CHROMIUM=/path/to/chromium python3 tests/ui_smoke.py
Exit code 0 = pass, 1 = fail. Takes about 1-3 minutes.
"""
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8791
URL = f'http://localhost:{PORT}/god-killer.html'
TABS = ['train', 'skill', 'mon', 'create', 'temple', 'pets', 'gods', 'rebirth']
SAVES = [None, 'save_early.json', 'save_late.json']
SIZES = [(360, 740), (1366, 768)]
IGNORE = ('fonts.googleapis', 'fonts.gstatic', 'net::ERR_FAILED', 'ERR_CERT_AUTHORITY_INVALID', 'ERR_TUNNEL', 'ERR_NAME_NOT_RESOLVED')

def launch(p):
    exe = os.environ.get('CHROMIUM') or ('/opt/pw-browsers/chromium' if os.path.exists('/opt/pw-browsers/chromium') else None)
    return p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()

def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT)], cwd=ROOT,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    bad = 0
    try:
        with sync_playwright() as p:
            b = launch(p)
            for w, h in SIZES:
                for save in SAVES:
                    ctx = b.new_context(viewport={'width': w, 'height': h})
                    ctx.route('**/fonts.g*/**', lambda r: r.abort())
                    pg = ctx.new_page(); errs = []
                    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
                    pg.on('console', lambda m: errs.append('console: ' + m.text)
                          if m.type == 'error' and not any(s in m.text for s in IGNORE) else None)
                    pg.goto(URL); pg.wait_for_timeout(300)
                    if save:
                        sd = json.load(open(os.path.join(ROOT, 'tests', 'fixtures', save)))
                        sd['lastSave'] = int(time.time() * 1000) - 600e3   # 10 min away -> welcome-back card
                        pg.evaluate('s=>localStorage.setItem("godKillerSave2",s)', json.dumps(sd))
                        # stop the page from saving over the fixture during the test
                        pg.evaluate('()=>{Storage.prototype.setItem=function(){}}')
                        pg.reload(); pg.wait_for_timeout(1200)
                        cont = pg.locator('#wbClose')
                        if cont.count() and cont.first.is_visible(): cont.first.click()
                    clicks = 0
                    for t in TABS:
                        tab = pg.locator(f'.tab[data-tab="{t}"]')
                        if not tab.is_visible(): continue
                        tab.click(); pg.wait_for_timeout(150)
                        subs = pg.locator(f'#tab-{t} .subSeg button')
                        for si in range(max(1, subs.count())):
                            if subs.count():
                                if not subs.nth(si).is_visible(): continue   # sub-tab still locked
                                subs.nth(si).click(); pg.wait_for_timeout(100)
                            btns = pg.locator(f'#tab-{t} button:visible')
                            for i in range(min(btns.count(), 60)):
                                bt = btns.nth(i)
                                try:
                                    if bt.get_attribute('id', timeout=300) == 'rbBtn' or not bt.is_enabled(timeout=300):
                                        continue   # never press rebirth
                                    bt.click(timeout=800); clicks += 1
                                except Exception:
                                    pass       # the list re-rendered under us; not an error
                    txt = pg.evaluate('()=>document.body.innerText')
                    anom = [x for x in ('NaN', 'undefined') if x in txt]
                    hs = pg.evaluate('()=>document.documentElement.scrollWidth > innerWidth + 1')
                    ok = not errs and not anom and not hs
                    bad += 0 if ok else 1
                    print(f"{'PASS' if ok else 'FAIL'} {w}x{h} {save or 'fresh':16} clicks={clicks:3} "
                          f"errors={errs[:3]} anomalies={anom} hscroll={hs}")
                    ctx.close()
            b.close()
    finally:
        srv.kill()
    print('ALL PASS' if not bad else f'{bad} FAILED')
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    main()
