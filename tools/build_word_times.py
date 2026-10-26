#!/usr/bin/env python3
"""Word timings for read-along clips (Listen and Read screens).

For each lesson page, finds the screens whose title is "Listen and Read",
runs faster-whisper (word_timestamps) on their narration clip in both voices,
and writes assets/voice/<voice>/<slug>/words.json:
  { "10_n": [[start, end, "word"], ...], ... }
reading.js uses it to grow the word being read (dock effect). Without the
file it falls back to sentence highlight.

Run: python3 tools/build_word_times.py [page.html ...]
Needs: pip install faster-whisper numpy  (+ ffmpeg)
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = sys.argv[1:] or ['index.html', 'unit1-v2/index.html', 'unit2/index.html', 'unit3/index.html', 'unit4/index.html']


def load(a):
    import numpy as np
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', a, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def main():
    from faster_whisper import WhisperModel
    m = WhisperModel('base.en', device='cpu', compute_type='int8')
    for page in PAGES:
        h = open(os.path.join(ROOT, page), encoding='utf-8').read()
        S = json.loads(re.search(r'^const SCREENS=(.*);$', h, re.M).group(1))
        A = json.loads(re.search(r'^const AUD=(.*);$', h, re.M).group(1))
        keys = ['%02d_n' % s['i'] for s in S if s['zh'] == 'Listen and Read']
        gb = A[keys[0]].split('?')[0]
        slug = gb.split('/')[-2]
        for voice in ('en-GB', 'en-US'):
            d = os.path.join(ROOT, 'assets/voice', voice, slug)
            out = {}
            for k in keys:
                f = os.path.join(d, k + '.mp3')
                if not os.path.exists(f):
                    continue
                segs, _ = m.transcribe(load(f), word_timestamps=True, language='en')
                out[k] = [[round(w.start, 2), round(w.end, 2), w.word.strip()] for s in segs for w in s.words]
            json.dump(out, open(os.path.join(d, 'words.json'), 'w'), separators=(',', ':'))
            print(page, voice, slug, {k: len(v) for k, v in out.items()})


if __name__ == '__main__':
    main()
