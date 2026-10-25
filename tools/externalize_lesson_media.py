#!/usr/bin/env python3
"""Move inline base64 photos / en-GB narration out of the five lesson HTMLs (idempotent).

Lesson pages keep `const IMGS={name: url}` and `const AUD={key: url}` maps. Older build
scripts (e.g. clipcheck/patch_html.py) write `data:...;base64,` values there. Run this
after any such script; it writes each inline value to a cached file and replaces the
value with a relative URL carrying a content hash (`?v=<sha8>`), so a changed clip or
photo gets a new URL and the iPad never plays a stale cached copy.

  photos  -> assets/lesson-img/<slug>/<name>.jpg   (bytes unchanged)
  en-GB   -> assets/voice/en-GB/<slug>/<key>.mp3   (bytes unchanged; en-US already lives
                                                   in assets/voice/en-US/<slug>/)
Run: python3 tools/externalize_lesson_media.py"""
import base64, hashlib, json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LESSONS = {'index.html': 'lesson1', 'unit2/index.html': 'unit2', 'unit3/index.html': 'unit3',
           'unit4/index.html': 'unit4', 'science-review/index.html': 'science-review'}
EXT = {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/svg+xml': '.svg', 'audio/mpeg': '.mp3'}

def sha8(b): return hashlib.sha1(b).hexdigest()[:8]

def externalize(html_rel, slug):
    p = os.path.join(ROOT, html_rel); h = open(p, encoding='utf-8').read()
    prefix = '' if '/' not in html_rel else '../'
    changed = 0
    for var, sub in (('IMGS', 'assets/lesson-img/' + slug + '/'), ('AUD', 'assets/voice/en-GB/' + slug + '/')):
        m = re.search(r'const ' + var + r'=(\{.*?\});\n', h)
        if not m: raise SystemExit('%s: const %s not found' % (html_rel, var))
        d = json.loads(m.group(1))
        for k, v in list(d.items()):
            mm = re.match(r'data:([a-z0-9/+.\-]+);base64,(.*)$', v, re.S)
            if not mm: continue
            b = base64.b64decode(mm.group(2)); ext = EXT.get(mm.group(1), '')
            stem = re.sub(r'\.(jpe?g|png|webp|svg|mp3)$', '', k, flags=re.I)
            rel = sub + re.sub(r'[^A-Za-z0-9_.\-]', '_', stem) + ext
            os.makedirs(os.path.dirname(os.path.join(ROOT, rel)), exist_ok=True)
            open(os.path.join(ROOT, rel), 'wb').write(b)
            d[k] = prefix + rel + '?v=' + sha8(b); changed += 1
        h = h[:m.start(1)] + json.dumps(d, ensure_ascii=False) + h[m.end(1):]
    open(p, 'w', encoding='utf-8').write(h)
    print('%-26s %3d inline values moved out; html now %d KB' % (html_rel, changed, len(h.encode()) // 1024))

if __name__ == '__main__':
    for rel, slug in LESSONS.items(): externalize(rel, slug)
