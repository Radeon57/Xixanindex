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
| `god-killer/img/<set>/<NN>.webp` | 256×256 portraits for `gods`, `ultimates`, `monsters`, `pets` and `dungeons`. A missing file falls back to a drawn sigil. The prompts used are in `img/PROMPTS.md`. |
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
- **Destructive buttons** use a two-tap confirm (`confirmTap`), with the second tap at least 400ms after the first.
- **UI text** is Thai. Keep new text in natural Thai.
- **Balance.** Idle-bot timings are about 3.4 / 4.8 / 6.6 / 9.1 hours for gods 7–10. Re-check them if you change numbers in `data.js`.

## Test before pushing
1. `node --check god-killer/ui.js god-killer/engine.js god-killer/data.js`
2. `node tests/engine_fuzz.js`
3. Serve locally with `python3 -m http.server 8000`, then open `http://localhost:8000/god-killer.html`:
   - at phone size (360×740) and PC size (1366×768)
   - visit every tab
   - check the console shows no errors

## Not done yet (ideas for next work)
- Animations: hit and victory effects in the arena, and level-up pulses.
  - The shake animation only targets the SVG fallback (`.fighting .godPortrait svg`), so AI portraits don't shake. Retarget it to `.godPortrait .art`.
- An active "divine strike" button in the arena. To matter, it needs to deal a share of the god's HP.
- "Buy max" for the generator, monuments and God Power upgrades.
- A "next goal" hint after the tutorial ends.
- Keep the creation target across rebirth. Today it resets to ร่างเงา every run.
- Sound effects and a settings panel (sound, vibration, number format).
- An in-game how-to-play guide.
- A PWA (manifest and service worker) so the game can be installed.
- Touch: hold +/− to repeat, and swipe between tabs.
