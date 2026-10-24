# Reading Future Discover 1 — Science Weather (private family use)

## Live
- [Unit 1 · Animals' Weather](./) — Learn
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
