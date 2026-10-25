#!/usr/bin/env python3
"""Subset Material Symbols Rounded to the icons this site uses (5.4 MB -> ~115 KB).

Scans every .html/.js/.css in the repo for tokens that are icon ligature names, keeps
those glyphs + a-z/0-9/_ and pins FILL=1 / GRAD=0 (the only values the site uses);
wght and opsz stay variable. RE-RUN THIS after adding a new icon name anywhere,
otherwise the new icon shows as plain text. Bump ?v= in assets/fonts/material-symbols.css
and the preload links (grep MaterialSymbolsRounded-sub) when the output changes.
Run: /workspace/pwv/bin/python tools/subset_icon_font.py   (needs fonttools + brotli)"""
import json, os, re, sys
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib import instancer
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/fonts/MaterialSymbolsRounded-var.woff2')
OUT = os.path.join(ROOT, 'assets/fonts/MaterialSymbolsRounded-sub.woff2')
f = TTFont(SRC)
cmap = f.getBestCmap(); rev = {g: chr(c) for c, g in cmap.items()}
names = {}
for lk in f['GSUB'].table.LookupList.Lookup:
    for st in lk.SubTable:
        if st.LookupType == 7: st = st.ExtSubTable
        for first, ligs in getattr(st, 'ligatures', {}).items():
            for lg in ligs: names[''.join(rev.get(g, '?') for g in [first] + lg.Component)] = lg.LigGlyph
toks = set()
for dp, dn, fs in os.walk(ROOT):
    if '.git' in dp: continue
    for fn in fs:
        if fn.endswith(('.html', '.js', '.css')):
            s = open(os.path.join(dp, fn), encoding='utf-8', errors='ignore').read()
            toks |= set(re.findall(r'[a-z0-9_]+', re.sub(r'base64,[A-Za-z0-9+/=]+', '', s)))
used = sorted(t for t in toks if t in names)
chars = 'abcdefghijklmnopqrstuvwxyz0123456789_'
glyphs = {names[t] for t in used} | {cmap[ord(c)] for c in chars if ord(c) in cmap}
opts = subset.Options(); opts.layout_closure = False; opts.layout_features = ['liga', 'rlig', 'calt', 'ccmp']
opts.notdef_outline = True; opts.name_IDs = ['*']; opts.glyph_names = True
sub = subset.Subsetter(opts); sub.populate(glyphs=sorted(glyphs), unicodes=[ord(c) for c in chars]); sub.subset(f)
f = instancer.instantiateVariableFont(f, {'FILL': 1, 'GRAD': 0})
f.flavor = 'woff2'; f.save(OUT)
print(len(used), 'icons ->', OUT, os.path.getsize(OUT), 'bytes')
