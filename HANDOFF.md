# God Killer — handoff guide for the next AI (or human)

This is the guide for continuing work on God Killer with any AI coding assistant, such as Claude Code, Cursor, Copilot, Codex or Gemini. Read it once from top to bottom before changing anything. [AGENTS.md](AGENTS.md) is the short rulebook; this file is the longer "how to work on it" guide.

- **Live game:** https://radeon57.github.io/Xixanindex/ (redirects to `god-killer.html`)
- **Repo:** https://github.com/Radeon57/Xixanindex, branch `main`. Any push or merge to `main` redeploys GitHub Pages in about 1 minute.
- **Owner:** Radeon57. The owner writes in Thai, keeps an eye on usage limits, and wants short answers and working results over long explanations.

---

## 1. What the game is

God Killer is a Thai-language idle/incremental browser game with a Chinese cultivation (xianxia) theme, inspired by *Idling to Rule the Gods*.

**The core loop**
1. Shadow clones (ร่างเงา) spawn over time.
2. The player assigns them to:
   - ฝึกกาย (body training), which raises attack
   - ฝึกจิต (mind training), which raises defence
   - สนามรบ (battlefield), where they fight monsters for พลังเทวะ (DP, the main currency) and ค่ายุทธ์ (battle stat)
3. The hero challenges 10 gods in turn. Each kill unlocks a system:
   - skills
   - creation
   - DP generator
   - monuments
   - pets, dungeons and gear
   - rebirth
4. Rebirth (จุติใหม่) resets the run for ปราณเทพ (GP), which buys permanent upgrades.

**Later systems**
- challenges (บททดสอบ)
- ultimate beings (สิ่งสูงสุด), which pay บารมี (might points)
- achievements
- cultivation realms with a heavenly-tribulation breakthrough (ขอบเขตบำเพ็ญ / ฝ่าทัณฑ์สวรรค์)
- sect missions (ภารกิจสำนัก)
- a tap-to-collect fortune event (โชควาสนา)
- auto clone plan and auto-fight

It works offline (up to 8h of progress), and there is a welcome-back summary.

---

## 2. Tech stack and files

Plain HTML + CSS + JavaScript. **No build step, no framework, no npm dependencies for the game itself.** Opening the HTML file over a local web server is enough.

| File | Lines | What it holds |
|---|---|---|
| `god-killer.html` | ~1000 | All markup and **all CSS** in one `<style>`. Mobile-first; desktop, tablet and landscape rules are in labeled blocks near the end. |
| `god-killer/data.js` | ~300 | **Every tunable number and every name** (`globalThis.GKDATA`). Balance changes go here, not in the engine. |
| `god-killer/engine.js` | ~1200 | **Pure game rules** (`globalThis.GK`). No DOM. Runs in Node for tests. |
| `god-killer/ui.js` | ~2000 | Rendering and input, one IIFE. All player-facing strings that are not in data.js live here. |
| `god-killer/fx.js` | ~250 | Visual effects (`window.GKFX`): particles, seal stamps, floating numbers, the rebirth wheel. |
| `god-killer/icons.js` | ~200 | Inline SVG fallback icons (`window.GKICONS`) and the fallback hero portrait. |
| `god-killer/img/` | — | WebP art. See §8. |
| `sw.js`, `manifest.webmanifest` | — | PWA: network-first service worker (`CACHE = 'god-killer-v2'`) and install manifest. |
| `index.html` | — | Redirects to `god-killer.html`. |
| `tests/engine_fuzz.js` | — | Engine invariants, fuzzing and a 10-hour bot run. About 5 s. |
| `tests/ui_smoke.py` | — | Browser click-through test (Playwright). About 1–3 min. |
| `tests/fixtures/save_*.json` | — | An early save and a late save (6/10 gods, 9 rebirths) used by the smoke test. |

**Script load order** (`god-killer.html`, end of `<body>`): `data.js` → `engine.js` → `fx.js` → `icons.js` → `ui.js`.

---

## 3. Setup and running

```bash
git clone https://github.com/Radeon57/Xixanindex.git
cd Xixanindex
python3 -m http.server 8000
# open http://localhost:8000/god-killer.html
```

Useful in the browser:
- `?debug`, or any localhost URL, exposes `GKDebug.fortune('dp'|'speed'|'create')`, which spawns a fortune treasure right away.
- Saves live in `localStorage['godKillerSave2']` and settings in `localStorage['godKillerSettings']`. Clear both to start fresh.
- To test with a specific save, paste a fixture from `tests/fixtures/` through the in-game save tools (log panel → paste save code → load), or set localStorage from the console.

---

## 4. The test routine (run it before every push)

```bash
node --check god-killer/data.js god-killer/engine.js god-killer/ui.js god-killer/fx.js god-killer/icons.js
node tests/engine_fuzz.js          # must end with: engine_fuzz: all ok ...
python3 tests/ui_smoke.py          # must end with: ALL PASS
```

- `ui_smoke.py` needs `pip install playwright` and a Chromium build. Set `CHROMIUM=/path/to/chromium` if Playwright's own browser isn't installed.
- The smoke test blocks Google Fonts on purpose, because sandboxes often can't reach them.
- It fails on:
  - page errors
  - console errors, including a 404 for a missing image
  - `NaN` or `undefined` shown to the player
  - horizontal scrolling

Also look at the page yourself at **360×740** (phone) and **1366×768** (PC) after any visual change. The owner checks both.

**Balance check** (after any change to numbers in `data.js`): the fuzz file's section D runs a 10-hour bot. For a fresh-save timeline, copy the `bot()` function from `tests/engine_fuzz.js` into a small Node script. Step `G.step(s, 1, [])` once per simulated second, call the bot every 3 s, and log the time of each god kill. The targets are in §6.

---

## 5. Rules you must not break

These are the rules that keep old saves loading and the game correct. Most bugs in this project's history came from breaking one of them.

1. **Save compatibility.**
   - Key `godKillerSave2`, `v:2`. `meta` survives rebirth; everything else is per run.
   - **Every new state field goes into `newState()`/`newMeta()` AND `sanitize()` with a safe default.** `sanitize()` must accept anything, including old saves, truncated JSON and hostile values, and return a valid state.
   - Add an invariant for the new field in `tests/engine_fuzz.js`.
2. **The engine stays pure.** No DOM, no `Date.now()` and no `Math.random()` inside rules. Pass randomness in as an argument (see `G.rollFortune(s, r)`). UI-only timers, such as the fortune spawn timer, live in ui.js.
3. **Offline equals online.** `G.advance(s, sec)` runs `G.step` in 1 s chunks up to 8 h. Anything that happens over time must give the same result through `step` and `advance`, and the fuzz test checks this.
4. **Rendering performance.**
   - `render(full)` runs every frame with `full=false`, which only updates bars, and every 200 ms with `full=true`.
   - Always use the change-checked setters `setText`, `setHTML`, `setShown`, `setClass`, `setBar` and `setDisabled`.
   - Never rebuild lists every frame.
5. **Animations** use only `transform` and `opacity`, must respect `prefers-reduced-motion`, and must check `motionOff()` in ui.js (or `GKFX.off()`) before any JS effect.
6. **Destructive buttons**, such as rebirth or resetting a save, use the two-tap `confirmTap`.
7. **Power display scale.**
   - Real stats grow to 1e16 and beyond, so every **power** number shown goes through ui.js `pw(x) = 10·√x`. That covers attack, defence, HP, clone and monster power, ค่ายุทธ์, god and ultimate stats, and tribulation damage.
   - Multipliers on those stats show as `pwM(f)` / `statM(stat, f)`, and HP and damage as `pwPool(cur, max)`.
   - Stat-bonus descriptions in data.js use `px()` / `pp()` / `pa()`.
   - **The engine always uses real values.**
   - DP, GP, speed and clone counts are **not** scaled. If you add a new power number to the UI, wrap it in `pw()`.
8. **UI text is Thai** and uses the glossary in §7. Keep strings short, because 360 px is narrow.
9. **Theme.** Use the `:root` tokens only (`--ink*`, `--gold0/1/2`, `--jade`/`--jade2`, `--cinnabar`, `--paper`, `--muted`). **Never add purple.** Fonts are `var(--fHead)` (Chonburi), `var(--fBody)` (Sarabun) and `var(--fSeal)` (Ma Shan Zheng). The seal font is subset by the `&text=` list in the `<head>` Google Fonts link, so add any new CJK glyph there.
10. **Service worker.** `sw.js` is network-first. Bump `CACHE` only if you change the caching strategy.

---

## 6. Balance targets

**Fresh save, idle bot:**

| God | 1 | 2 | 3 | 4 | 5 | 6 (unlocks rebirth) |
|---|---|---|---|---|---|---|
| Kill time | ~3.5 min | ~9 min | ~16 min | ~25 min | ~36 min | ~48 min |

**Late save, idle bot:** gods 7–10 at roughly 3.4 / 4.8 / 6.6 / 9.1 h. These weren't re-measured after the realm and mission changes, so re-measure before trusting them.

**Design principles** (from research on idle game design):
- The first god must fall within about 4 minutes. That was the main "not fun" problem, when it took 37 minutes.
- A new system should open every few minutes early on.
- Active play (the fortune event, ⚡ strike) should beat idle play by only a few percent, roughly +5–10%.

---

## 7. Thai glossary (use exactly these terms)

| Concept | Thai term |
|---|---|
| clone | ร่างเงา |
| DP / divinity (main currency) | พลังเทวะ |
| God Power (rebirth currency) | ปราณเทพ (GP) |
| Might points | บารมี |
| rebirth / tab | จุติใหม่ / tab **จุติ** |
| body training (attack) | ฝึกกาย / stat **กาย** |
| mind training (defence) | ฝึกจิต / stat **จิต** (the old "วิชาเวท/เวท" is gone; don't bring it back) |
| monster | อสูร |
| dungeon | แดนลับ |
| pet | สัตว์คู่กาย (tab label: คู่หู) |
| challenge | บททดสอบ |
| ultimate beings | สิ่งสูงสุด |
| battle stat | ค่ายุทธ์ |
| strike | ฟาดฟันเทวะ |
| realms / tribulation | ขอบเขตบำเพ็ญ / ฝ่าทัณฑ์สวรรค์ |
| sect missions | ภารกิจสำนัก |
| fortune event | โชควาสนา |

Trainings and skills have a `desc` field with a one-line meaning that shows under each row. New trainings need one too.

---

## 8. Art pipeline

All art is WebP in `god-killer/img/<set>/<NN>.webp`, where NN is the item index + 1 (`01`, `02`, …). `ui.js` `artHTML(set, i, color, fallback)` + `loadArt(root)` load the file and **keep the drawn fallback if it's missing**, so a missing image never breaks the game.

| Set | Size | Source |
|---|---|---|
| `gods`, `ultimates`, `monsters`, `pets`, `dungeons` | 256² | Leonardo.ai (prompts in `img/PROMPTS.md`) |
| `hero`, `bg/scene_wide`, `bg/scene_tall`, `bg/title`, `fortune` | various | AI Horde, model AlbedoBase XL (see `img/AI_ART.md`) |
| `train`, `skill`, `create`, `gear` | 128², round | Canva AI (gold-and-jade medallions) |

**To add or replace art:**
1. Generate a square image.
2. Crop it to a circle and resize it to 128 px (row icons) or 256 px (portraits).
3. Encode it as WebP at quality ~0.8, which comes out under 15 KB.

There's no PIL in the original sandbox, so the conversion was done in headless Chromium: draw on a canvas, clip to a circle, then `toDataURL('image/webp', 0.82)`.

**Free AI image options that worked from a sandbox:**
- **AI Horde:** `POST https://aihorde.net/api/v2/generate/async` with header `apikey: 0000000000`, poll `/generate/check/<id>`, then fetch `/generate/status/<id>`. Free, no watermark, and slow when the queue is busy.
- **Canva connector** (if available): `generate-image`, then `get-assets` to get a downloadable thumbnail URL. Limited to 10 calls per minute.
- **Pollinations:** works but adds a watermark. Avoid it.

**Style prompt suffix** used for every row icon: *"Game icon medallion, painterly Chinese xianxia fantasy style, ornate circular gold frame with jade gem accents, dark ink-black background, no text."*

---

## 9. Git and deploy workflow

- Work on a feature branch, open a PR into `main`, and merge. Merging deploys.
- Check that the change is live: `curl -s https://radeon57.github.io/Xixanindex/god-killer/ui.js | grep <something new>`. It usually shows up within 30–60 s after the merge.
- Players who opened the game before need **one refresh** to get the new version. The service worker is network-first, so one refresh is enough.
- Keep commits focused. The owner has authorized create+merge PR flows for this project.

---

## 10. Backlog, in priority order

Each item has a ready-to-paste prompt for the next AI.

### 1. Thorough bug hunt (never fully done)
> Read HANDOFF.md and AGENTS.md. Hunt for real bugs in God Killer: read engine.js for edge cases (rebirth resets, challenge rules, sanitize gaps, step vs advance mismatches, Infinity/NaN at late game), then play through with tests/fixtures saves at 360×740 and 1366×768. Fix only confirmed bugs with minimal changes, add a fuzz invariant for each engine bug, run the full test routine, and report what you found.

### 2. A unique mechanic for each god
Fights are currently pure stat checks.
> Give each of the 10 gods in data.js a `mech` field and implement it in engine.js deterministically (fixed timers, no randomness), for example:
> - the thunder god charges a big hit every 8 s, which ⚡strike interrupts
> - Yama heals 5% once at 50% HP
> - Chang'e takes half damage from กาย-heavy builds
> - the Time Sage enrages after 60 s
>
> Auto-fight and offline `advance` must still be able to win, maybe a bit more slowly. Show the mechanic on the fight screen in one Thai line. Keep the god-kill timings in HANDOFF.md §6 within ±15%, and add fuzz coverage.

### 3. Matching art for gods, monsters and pets
They are Leonardo portraits, and their style differs slightly from the Canva medallions.
> Regenerate `img/gods`, `img/monsters` and `img/pets` in the gold-jade painterly style (§8). Keep the file names, compare before and after screenshots, and replace an image only if the new one is clearly better.

### 4. Explanation lines for more rows
Monsters, creations and pets could get a one-line `desc` like the trainings have.

### 5. DP number size
พลังเทวะ still reaches hundreds of billions late in the game. It can't use the display scale, because it's a spent currency and the arithmetic has to stay visible. A real fix means re-tuning the DP economy (monster DP, generator, costs) together.

### 6. Re-measure late-game balance
Measure gods 7–10 and the ultimates with the realms, missions and fortune systems in place, and update §6 and AGENTS.md.

### 7. Ideas from the design research (not started)
- A Dao path chosen at each rebirth (body, mind, beasts or sword), giving ×3 to one system and ×0.5 to another.
- A collection codex with a completion % that feeds a bonus.
- A daily free fortune draw, with no streak to lose.

---

## 11. Lessons from past sessions

- **Don't run many agents on the same files.** Twenty agents editing `ui.js` at once caused merge conflicts and burned the usage limit. What worked was a few agents (3–6), each owning a separate file or line range, with a shared glossary, each committing in its own git worktree, merged one at a time.
- **Measure before tuning.** The "game isn't fun" complaint came from a 37-minute first god, which was only found by simulating the opening with the bot.
- **Art made with code looks bland.** The owner rejected SVG-only art. Painted AI art and a real theme (ink, lacquer and gold) fixed it.
- **The owner rejected** a 3D mode, a 2D adventure mode and a "personal realm" tab. All were removed, so don't bring them back without asking.
- **Numbers that are too big feel "เวอร์" (overblown).** That's why the display scale exists (§5.7).
- **Sandbox quirks:**
  - Google Fonts and some HTTPS hosts fail inside sandboxes (a proxy certificate problem). Tests block fonts on purpose.
  - Kill local test servers by PID, never with `pkill -f`, which can kill your own shell.
- **Report honestly.** Say what was tested and what wasn't. The owner prefers "done and checked" over optimism.
