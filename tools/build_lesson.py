#!/usr/bin/env python3
"""Build a lesson page from one content file (content/<slug>.json).

The content file holds every screen: type, titles, on-screen lines, the narration
text (`n` before / `rn` at the reveal), an optional parent tip (`tip`, Chinese),
`imgs` for extra pictures (name -> path under assets/), `photo` to pick the
photo a title / reading screen shows (a name in IMGS),
`practice: true` for speaking screens that are not saved, and an optional
interaction (`ix`: choice / rows / sort / sortIntro, same shape as interact-data.js).

This tool:
  1. makes the narration clips that are new or whose text changed
     (en-GB Sonia + en-US Jenny, edge-tts, rate -20% — same voices as the other lessons)
     into assets/voice/<voice>/<slug>/<NN>_n.mp3 / <NN>_rn.mp3,
  2. makes feedback clips for the interaction lines (assets/voice/<voice>/fb/<fnv>.mp3),
  3. writes SCREENS / AUD / DUR_US into the lesson page and
     assets/voice/en-US/<slug>/dur.json,
  4. writes assets/interact-data-<slug>.js (window.RF_IX.units[<ix_unit>]).

Clip texts are kept in assets/voice/<voice>/<slug>/texts.json so a re-run only
re-records what changed. After it, run tools/build_preload_manifest.py.

Run: python3 tools/build_lesson.py content/unit1-v2.json
Needs: pip install edge-tts mutagen   (TLS proxy: add its CA to certifi's bundle)
"""
import asyncio, hashlib, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICES = {'en-GB': 'en-GB-SoniaNeural', 'en-US': 'en-US-JennyNeural'}
RATE = '-20%'
SCREEN_KEYS = ['i', 's', 'part', 'zh', 'en', 'img', 'rimg', 'type', 'body', 'q', 'reveal', 'page', 'map', 'dn', 'dr', 'tip', 'practice', 'photo']


def fnv(t):
    h = 0x811c9dc5
    for ch in t:
        h ^= ord(ch); h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h


def sha8(path):
    return hashlib.sha1(open(path, 'rb').read()).hexdigest()[:8]


def dur(path):
    from mutagen.mp3 import MP3
    return round(MP3(path).info.length, 3)


async def tts(text, voice, out):
    import edge_tts
    for k in range(5):
        try:
            await edge_tts.Communicate(text, VOICES[voice], rate=RATE).save(out)
            if os.path.getsize(out) > 500:
                return
        except Exception as e:  # network hiccup: retry
            print('  retry', os.path.basename(out), e)
        await asyncio.sleep(2)
    raise RuntimeError('TTS failed: ' + out)


def fb_lines(ix):
    out = []
    if not ix:
        return out
    for r in ix.get('rows') or [ix]:
        for k in ('why', 'hint', 'explain', 'ask'):
            if r.get(k): out.append(r[k])
    for c in ix.get('cards') or []:
        for k in ('why', 'hint'):
            if c.get(k): out.append(c[k])
    return out


async def main(cfg_path):
    C = json.load(open(cfg_path, encoding='utf-8'))
    slug, page = C['slug'], C['page']
    page_path = os.path.join(ROOT, page)
    rel = os.path.relpath(os.path.join(ROOT, 'assets'), os.path.dirname(page_path)).replace(os.sep, '/')  # '../assets'
    screens = C['screens']
    sem = asyncio.Semaphore(6)

    # 1. narration clips
    jobs, clip_keys = [], []
    for v in VOICES:
        d = os.path.join(ROOT, 'assets/voice', v, slug); os.makedirs(d, exist_ok=True)
        tf = os.path.join(d, 'texts.json')
        texts = json.load(open(tf)) if os.path.exists(tf) else {}
        want = {}
        for i, sc in enumerate(screens):
            k = '%02d' % i
            want[k + '_n'] = sc['n']
            if sc['type'] in ('pause', 'retell'):
                want[k + '_rn'] = sc['rn']
        for key, text in want.items():
            out = os.path.join(d, key + '.mp3')
            if texts.get(key) != text or not os.path.exists(out):
                jobs.append((text, v, out))
        for f in os.listdir(d):  # clips of screens that no longer exist
            if f.endswith('.mp3') and f[:-4] not in want:
                os.remove(os.path.join(d, f))
        json.dump(want, open(tf, 'w'), ensure_ascii=False, indent=0)
        clip_keys = list(want)

    # 2. feedback clips
    for sc in screens:
        for t in fb_lines(sc.get('ix')):
            for v in VOICES:
                out = os.path.join(ROOT, 'assets/voice', v, 'fb', fnv(t) + '.mp3')
                if not os.path.exists(out):
                    jobs.append((t, v, out))

    async def one(j):
        async with sem:
            await tts(*j)
    print(len(jobs), 'clips to record')
    await asyncio.gather(*[one(j) for j in jobs])

    # 3. page data
    gb = os.path.join(ROOT, 'assets/voice/en-GB', slug)
    us = os.path.join(ROOT, 'assets/voice/en-US', slug)
    out_sc, aud, dur_us, ix_units = [], {}, {}, {}
    for i, sc in enumerate(screens):
        k = '%02d' % i
        row = dict(sc); row['i'] = i
        row.setdefault('rimg', None); row.setdefault('body', []); row.setdefault('q', []); row.setdefault('reveal', [])
        row.setdefault('page', None); row.setdefault('map', False)
        row['dn'] = dur(os.path.join(gb, k + '_n.mp3'))
        row['dr'] = dur(os.path.join(gb, k + '_rn.mp3')) if sc['type'] in ('pause', 'retell') else 0
        out_sc.append({kk: row[kk] for kk in SCREEN_KEYS if kk in row})
        ix = sc.get('ix')
        if ix:
            ix = dict(ix)
            if ix.get('kind') == 'sortIntro' and ix.get('ref') == 'next':
                ix['ref'] = i + 1
            ix_units[i] = ix
    for key in clip_keys:
        aud[key] = '%s/voice/en-GB/%s/%s.mp3?v=%s' % (rel, slug, key, sha8(os.path.join(gb, key + '.mp3')))
        dur_us[key] = dur(os.path.join(us, key + '.mp3'))
    json.dump(dur_us, open(os.path.join(us, 'dur.json'), 'w'), indent=0)

    h = open(page_path, encoding='utf-8').read()
    def put(name, val):
        nonlocal h
        line = 'const %s=%s;\n' % (name, json.dumps(val, ensure_ascii=False, separators=(', ', ': ') if name == 'SCREENS' else (',', ':')))
        h, n = re.subn(r'^const %s=.*;\n' % name, lambda m: line, h, count=1, flags=re.M)
        assert n == 1, name
    m = re.search(r'^const IMGS=(.*);\n', h, re.M)
    imgs = json.loads(m.group(1))
    for name, path in (C.get('imgs') or {}).items():  # extra pictures, path relative to assets/
        imgs[name] = '%s/%s?v=%s' % (rel, path, sha8(os.path.join(ROOT, 'assets', path)))
    put('SCREENS', out_sc); put('AUD', aud); put('DUR_US', dur_us); put('IMGS', imgs)
    open(page_path, 'w', encoding='utf-8').write(h)

    # 4. interaction data
    ixu = C.get('ix_unit', slug)
    js = ('/* Generated by tools/build_lesson.py from %s — edit the content file, not this. */\n'
          'window.RF_IX = window.RF_IX || { units: {} };\nwindow.RF_IX.units[%s] = %s;\n') % (
        os.path.relpath(cfg_path, ROOT), json.dumps(ixu), json.dumps(ix_units, ensure_ascii=False, indent=1))
    open(os.path.join(ROOT, 'assets', 'interact-data-%s.js' % slug), 'w', encoding='utf-8').write(js)
    print('%s: %d screens, %d interactions' % (page, len(out_sc), len(ix_units)))


if __name__ == '__main__':
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else 'content/unit1-v2.json'))
