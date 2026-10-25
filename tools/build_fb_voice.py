#!/usr/bin/env python3
"""Build feedback/praise clips for assets/interact-data.js in both voice packs.
Same voices/rate as the lesson narration (edge-tts): en-GB Sonia (default), en-US Jenny, rate -20%.
Output: assets/voice/<voice>/fb/<fnv1a32(text)>.mp3. Skips clips that already exist.
Run: /workspace/pwv/bin/python tools/build_fb_voice.py   (needs node for reading the data file)"""
import asyncio, json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICES = {'en-GB': 'en-GB-SoniaNeural', 'en-US': 'en-US-JennyNeural'}
RATE = '-20%'

def fnv(t):
    h = 0x811c9dc5
    for ch in t:  # JS charCodeAt = UTF-16 units; texts here are BMP
        h ^= ord(ch); h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h

def lines():
    js = "global.window={};require(%r);const D=window.RF_IX;const out=new Set();" \
         "['praise','hintLead','explainLead','parentPraise','sortDone'].forEach(k=>D[k].forEach(t=>out.add(t)));" \
         "for(const u of Object.values(D.units))for(const c of Object.values(u)){const rows=c.rows||[c];" \
         "for(const r of rows)['why','hint','explain'].forEach(k=>r[k]&&out.add(r[k]));(c.cards||[]).forEach(x=>{out.add(x.why);out.add(x.hint);});}" \
         "console.log(JSON.stringify([...out]))" % os.path.join(ROOT, 'assets/interact-data.js')
    return json.loads(subprocess.check_output(['node', '-e', js]))

async def main():
    import edge_tts
    L = lines(); sem = asyncio.Semaphore(6); made = 0
    async def one(v, t):
        nonlocal made
        d = os.path.join(ROOT, 'assets/voice', v, 'fb'); os.makedirs(d, exist_ok=True)
        out = os.path.join(d, fnv(t) + '.mp3')
        if os.path.exists(out) and os.path.getsize(out) > 500: return
        async with sem:
            for i in range(5):
                try:
                    await edge_tts.Communicate(t, VOICES[v], rate=RATE).save(out); made += 1; return
                except Exception as e:
                    print('retry', t[:30], e); await asyncio.sleep(2)
            raise RuntimeError('failed ' + t)
    await asyncio.gather(*[one(v, t) for v in VOICES for t in L])
    print(len(L), 'lines;', made, 'new clips')

asyncio.run(main())
