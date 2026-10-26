# Reading Future Discover 1 — Science Weather (private family use)

## Live
- [Unit 1 · Animals' Weather](./) — Learn
- [Unit 1 · new version (pilot)](./unit1-v2/)
- [Unit 2 · A Rainy Day](./unit2/)
- [Unit 3 · Rain, Snow, and Ice](./unit3/)
- [Unit 4 · Fish from the Sky](./unit4/)
- [Science weather review](./science-review/) — Review tab
- [Book](./book/) — Discover 1 four subjects
- [Progress](./progress/) — Miles snapshot + settings notes
- [Voice practice demo](./voice/)
- [/21st/](./21st/) → Unit 1 Session 2 Part 4

## UI (Marvilo + Calm pilot)
- Calm Classroom cream / blue / gold tokens
- HarmonyOS Sans + Material Symbols Rounded (FILL) — see `assets/fonts/LICENSE.txt`
- Bottom tabs: Learn · Review · Book · Progress
- Course chip opens course list (former Units ☰)
- Large pause/play FAB during lesson play (~96–112px)
- English-only · Sonia British −20% · Miles · parts 1–4 · Retell 10s no auto-advance

## Notes
Do not share widely. Parent-operated on iPad landscape.

## Progress footprints and spoken retells

Lessons sync through the Worker in `cf-progress/` (`https://rf-miles-progress.haishanlab.workers.dev`). The family key is never stored in this repo. On each iPad it lives only in `localStorage` under `rfMilesFamilyKey` — set it in Parent settings (`/progress/parent/`) or once with `?key=` on Progress (the query is removed after it is saved).

`GET`/`PUT /progress` merges. Missing fields stay false or empty, and a `true` is never turned back off. Old records that only have `completed` still load.

| Field | Meaning |
| --- | --- |
| `completed.unit1` … `completed.scienceReview` | Whole lesson done. Units 1–4 turn this on when **both** Session 1 and Session 2 have finished. Weather review is one path, so finishing that path still turns it on. A star already saved stays on. |
| `footprints.{unit}.sessionADone` / `sessionBDone` | That session’s listening path reached the end. |
| `footprints.{unit}.mapParts` | Four booleans, parts 1–4. A part counts when it is played or opened from the map. |
| `footprints.{unit}.retellDone` | The child continued past the retell reveal. No recording required for this flag. |
| `retells.{unit}` | Latest saved speaking: type, time, duration, size. The object key stays in KV only. |

Until this Worker is deployed, new footprint saves and retell uploads soft-fail (the lesson still plays). Deploy it with the site so stars and audio sync. Previously stored stars remain on the old record.

### Retell audio (R2)

On a retell step the iPad can record, play it back, record again, and save. iPad Safari’s `MediaRecorder` uses `audio/mp4` (AAC in an `.m4a`). That file plays on iPad. Other browsers may send WebM; the Worker stores the type it actually received.

Audio bytes go to R2. KV only keeps the latest pointer. Same Bearer family key as progress. No public bucket URL.

Bindings in `cf-progress/wrangler.jsonc`:

- `PROGRESS_KV` — the **existing** KV namespace (`miles:progress`). Replace `REPLACE_WITH_EXISTING_PROGRESS_KV_ID` before deploy (`npx wrangler kv namespace list`).
- `RETELL_BUCKET` — R2 bucket `rf-miles-retell`.
- `FAMILY_KEY` — Worker secret. Not a var in the config file.

```bash
cd cf-progress
npx wrangler login
npx wrangler r2 bucket create rf-miles-retell
# paste the existing KV id into wrangler.jsonc, then:
npx wrangler secret put FAMILY_KEY
npx wrangler deploy
```

`POST /retell/{unitId}` uploads the latest take (max 4 MB). `GET /retell/{unitId}` streams it, including `Range`, for playback. Progress shows **I spoke** when a take is saved. Parent settings can play it or download a backup copy.

### Check on two browsers

1. Deploy the Worker above. On browser A open `/progress/parent/`, enter the family key, then open a lesson.
2. Play Session 1 far enough to pass a map part and the retell. Tap Record, Stop, Play, Save, then Continue. Finish the session.
3. On browser B (another iPad, or a second desktop profile) set the same key and reload Progress:

```js
localStorage.setItem('rfMilesFamilyKey', 'the-same-key')
```

Session 1, the parts that were opened, and **I spoke** should show. Play should be the clip from browser A. The soft star for that lesson waits until Session 2 is finished too (Weather review’s star lights when its single path ends). No key, or offline: the lesson still runs; nothing is thrown.

## Rest break (forced)

`assets/rest-break.js` is loaded in the `<head>` of every app page (Learn/Unit 1, Units 2–4, Weather review, Book, Progress, Parent settings, Voice demo).

- After **20 minutes** of app time with the page visible, a full-screen **10-minute** countdown appears in the middle of the screen. Lesson audio, narration and any recording stop. Every tap, click, key (incl. desktop ←/→ skip and Space), scroll and the bottom tabs are blocked. There is **no close, skip or parent override**.
- State is in `localStorage`: `rfRest.learnSec` (learned seconds) and `rfRest.breakEndsAt` (wall-clock end). Refresh, switching pages or closing the tab does not reset it; the break keeps running while the app is closed and shows the remaining time when reopened. The learn counter goes back to 0 for the next 20 minutes.
- Time on Parent settings does not count as learning, but the page is still locked during a break.
- When it ends the overlay fades out and the lesson stays paused (tap play to continue).
- Limits: clearing website data or moving the device clock forward ends it early; it is per browser/device (not synced through the Worker).

QA only: add `?restTest=1` to any page → 20 s learn / 15 s break, using separate `rfRestTest.*` keys (a real break still shows). It sticks for that tab; `?restTest=0` turns it off.

## Performance notes (as1, Oct 2026)

Lesson pages no longer inline photos or narration. Keep it that way — a single inline clip set made each HTML 4–9 MB and the splash/icons wait for it.

- **Photos** `assets/lesson-img/<slug>/` and **en-GB narration** `assets/voice/en-GB/<slug>/` (en-US stays in `assets/voice/en-US/<slug>/`). `IMGS` / `AUD` in each lesson HTML hold relative URLs with `?v=<sha8>` of the file, so a changed file gets a new URL.
  Any script that writes `data:…;base64,` back into `IMGS`/`AUD` (e.g. `/workspace/rf/clipcheck/patch_html.py`) must be followed by `python3 tools/externalize_lesson_media.py` (idempotent).
- **`assets/rf-assets.js`** prefetches the next 3 screens' pictures + clips, plays narration/feedback from in-memory blobs (same start-at-0 pipeline), and the player waits ≤1.5 s for a screen's pictures to decode before swapping, so nothing pops in.
- **`PRE`** (per screen/state image list) is generated: `/workspace/pwv/bin/python tools/build_preload_manifest.py`. Re-run after changing which images a screen shows (diagrams.js, interact-data, IMGS). Stale lists only cost prefetching.
- **Icon font** `assets/fonts/MaterialSymbolsRounded-sub.woff2` is a 260 KB subset of the 5.4 MB original (same outlines). **After using a new icon name anywhere, run `/workspace/pwv/bin/python tools/subset_icon_font.py` and bump `?v=ms…`** in `assets/fonts/material-symbols.css` and the `<link rel="preload">` lines, otherwise the new icon shows as text.
- The `<img>` that `render()` writes into `.imgbox` uses `data-rfsrc` and only gets its `src` if diagrams/interact did not replace it (most screens do), so unused photos are never downloaded.

## Unit 1 new version (pilot, Oct 2026)

`/unit1-v2/` is a second Unit 1 lesson built on three strands: read closely, say it like the book (one sentence pattern), and think about it (proof / fact or saying / how could we check). The old `/` lesson stays as it is for comparison. Both save progress as `unit1`.

- Content lives in `content/unit1-v2.json` (screens, narration text, parent tips `tip`, interactions `ix`).
- Build: `python3 tools/build_lesson.py content/unit1-v2.json` — records only new or changed clips (edge-tts, en-GB Sonia + en-US Jenny, -20%), writes SCREENS/AUD/DUR_US/IMGS into the page and `assets/interact-data-unit1v2.js`.
- Then: `python3 tools/build_preload_manifest.py unit1-v2/index.html`.
- Screens with `practice: true` let the child record and play back, but nothing is saved or uploaded.
- Parent tips (Chinese, grey line under the question) show by default; `localStorage.rfParentTips='0'` hides them.
