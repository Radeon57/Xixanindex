# God Killer — notes for AI assistants and contributors

> สรุปภาษาไทย: ไฟล์นี้อธิบายโครงสร้างเกม God Killer, วิธีรัน/ทดสอบ, กติกาการแก้โค้ด และงานที่ยังค้าง
> ให้ AI ตัวอื่นอ่านก่อนเริ่มแก้งาน

An idle game in Thai, modeled on *Idling to Rule the Gods*. It is plain HTML, CSS and JS with no build step, hosted on GitHub Pages:
https://radeon57.github.io/Xixanindex/god-killer.html (`index.html` redirects there).

## Files
| File | What it holds |
|---|---|
| `god-killer.html` | Markup and all CSS, in one `<style>`. The layout is mobile-first; the desktop, tablet and landscape rules are in labeled blocks near the end. |
| `god-killer/data.js` | Every tunable number and name: trainings, monsters, creations, gods, upgrades, pets, dungeons, gear, challenges, ultimates, might, achievements. |
| `god-killer/engine.js` | Pure game rules with no DOM access, exported as `globalThis.GK`. It also runs in Node via `vm.runInThisContext`. |
| `god-killer/ui.js` | Rendering and input, in one IIFE. |
| `god-killer/fx.js` | Decorative effects exposed as `window.GKFX` (loaded before ui.js): a full-screen particle canvas, floating gains, seal stamps, the rebirth wheel and background qi motes. It reads `<html data-motion>` (set by ui.js `applyMotion`) to respect `motionOff()`, and ui.js calls it through a few `if(window.GKFX)` one-liners. |
| `god-killer/icons.js` | Inline SVG art as `window.GKICONS`: icons for trainings, skills, creations, gear and materials, plus the hero portrait fallback. |
| `god-killer/img/<set>/<NN>.webp` | 256×256 portraits for `gods`, `ultimates`, `monsters`, `pets`, `dungeons` and `hero`. A missing file falls back to a drawn sigil. The prompts used are in `img/PROMPTS.md`. |
| `tests/engine_fuzz.js` | Engine invariant, fuzz and long-run test. Run it with `node tests/engine_fuzz.js`, about 5s. |

## Rules that keep the game working
- **Saves.** The localStorage key is `godKillerSave2` and the save has `v:2`.
  - `meta` survives rebirth; everything else is per-run.
  - Every new state field must be added to `newState`/`newMeta` **and** to `sanitize()` with a safe default, so old saves still load.
- **Rendering.**
  - `render(full)` runs with `full` set every 200ms and without it every frame. Without `full`, it only updates bars.
  - Use the change-checked setters (`setText`, `setHTML`, `setShown`, `setClass`, `setBar`). Don't write to the DOM every frame.
- **Animations** use transform and opacity only, and must respect `prefers-reduced-motion`.
- **Offline progress** is `G.advance`, which runs in 1s chunks up to 8h. `G.step` must give the same results as `advance`.
- **Sect missions** (ภารกิจสำนัก) are checked and paid in the engine every second (`checkMissions`), so offline play counts. The guide chain is `MISSION_CHAIN` in data.js and its position is `meta.mchain`; the UI is the "sect missions" block near the end of ui.js.
- **Destructive buttons** use a two-tap confirm (`confirmTap`), with the second tap at least 400ms after the first.
- **UI text** is Thai. Keep new text in natural Thai.
- **Balance.** A fresh-save bot kills gods 1–6 at about 4 / 10 / 17 / 27 / 38 / 52 minutes (`first god within ~4 min` keeps the opening fun). Late-save idle-bot timings were about 3.4 / 4.8 / 6.6 / 9.1 hours for gods 7–10. Re-check them if you change numbers in `data.js`.
- **Fortune (โชควาสนา).** The spirit-treasure spawn timer lives in ui.js (`fortuneTick`) and counts only seconds when the tab is visible and no dialog is open, so offline catch-up never spawns one. Rewards are `G.claimFortune` in the engine, and the numbers are `FORTUNE` in data.js. On localhost or with `?debug`, `GKDebug.fortune('dp'|'speed'|'create')` spawns one right away.

## Test before pushing
1. `node --check god-killer/ui.js god-killer/engine.js god-killer/data.js`
2. `node tests/engine_fuzz.js`
3. Serve locally with `python3 -m http.server 8000`, then open `http://localhost:8000/god-killer.html`:
   - at phone size (360×740) and PC size (1366×768)
   - visit every tab
   - check the console shows no errors

## Settings
Player settings live in localStorage key `godKillerSettings` (separate from the save): `sound`, `vol`, `vibrate`, `sci` (number format), `motion` (`auto` | `full` | `reduced`). Use `motionOff()` in ui.js before any JS effect.

## Not done yet (ideas for next work)
- `sw.js` caches network-first; bump `CACHE` if the caching strategy changes.
