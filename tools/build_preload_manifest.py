#!/usr/bin/env python3
"""Write `const PRE={"<screen>|<state>": [image urls]}` into each lesson HTML.

The lesson player prefetches the next screens' pictures (and narration) and waits —
at most 1.5 s — until a screen's pictures are decoded before swapping to it, so no
screen paints with an empty box that pops in later. Which pictures a screen really
shows is decided at render time by diagrams.js / reading.js / interact.js, so this
tool renders every screen/state once (`?frame=N&state=…`) in headless Chromium and
records the <img> URLs left in #view.

RE-RUN after changing which images a screen uses (diagrams.js, IMGS, interact-data).
A stale list only costs prefetching; the lesson still works.
Run: /workspace/pwv/bin/python tools/build_preload_manifest.py   (needs playwright)"""
import sys, asyncio, functools, http.server, json, os, posixpath, re, threading
from urllib.parse import urlparse, unquote
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LESSONS = sys.argv[1:] or ['index.html', 'unit1-v2/index.html', 'unit2/index.html', 'unit3/index.html', 'unit4/index.html', 'science-review/index.html']

def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = functools.partial(Quiet, directory=ROOT)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

async def main():
    srv = serve(); origin = 'http://127.0.0.1:%d/' % srv.server_address[1]
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page(viewport={'width': 1180, 'height': 820})
        for rel in LESSONS:
            pdir = posixpath.dirname(rel); url = origin + (pdir + '/' if pdir else '')
            await pg.goto(url); types = await pg.evaluate('SCREENS.map(s=>s.type)')
            pre = {}
            for i, t in enumerate(types):
                for st in (['ask', 'reveal'] if t in ('pause', 'retell') else ['show']):
                    await pg.goto('%s?frame=%d&state=%s' % (url, i, st)); await pg.wait_for_timeout(250)
                    srcs = await pg.evaluate("[...document.querySelectorAll('#view img')].map(i=>i.getAttribute('data-rfsrc')?new URL(i.getAttribute('data-rfsrc'),location.href).href:i.src).filter(Boolean)")
                    out = []
                    for s in srcs:
                        u = urlparse(s)
                        if s.startswith(origin):
                            r = posixpath.relpath(unquote(u.path).lstrip('/'), pdir or '.') + (('?' + u.query) if u.query else '')
                            if r not in out: out.append(r)
                    pre['%d|%s' % (i, st)] = out
            p_ = os.path.join(ROOT, rel); h = open(p_, encoding='utf-8').read()
            line = 'const PRE=' + json.dumps(pre, ensure_ascii=False, separators=(',', ':')) + ';\n'
            if re.search(r'^const PRE=.*;\n', h, re.M): h = re.sub(r'^const PRE=.*;\n', lambda m: line, h, count=1, flags=re.M)
            else:
                m = re.search(r'^const AUD=.*;\n', h, re.M); h = h[:m.end()] + line + h[m.end():]
            open(p_, 'w', encoding='utf-8').write(h)
            print('%-26s %d screen states, %d image refs' % (rel, len(pre), sum(len(v) for v in pre.values())))
        await br.close()
    srv.shutdown()
asyncio.run(main())
