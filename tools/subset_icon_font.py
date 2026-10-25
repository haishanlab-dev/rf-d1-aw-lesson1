#!/usr/bin/env python3
"""Subset Material Symbols Rounded to the icons this site uses.

Keeps the text of every class="ms" element in the repo's .html/.js files, plus the names
in DYNAMIC below (icons set from code, not written inside a class="ms" tag), and their
FILL twins + a-z/0-9/_. A new icon written as <span class="ms">name</span> is picked up
automatically; one set from code (textContent, data-icon, a variable) must go in DYNAMIC. All axes and GSUB features stay, so
outlines are byte-for-byte the original ones. RE-RUN THIS after adding a new icon name anywhere,
otherwise the new icon shows as plain text. Bump ?v= in assets/fonts/material-symbols.css
and the preload links (grep MaterialSymbolsRounded-sub) when the output changes.
Run: /workspace/pwv/bin/python tools/subset_icon_font.py   (needs fonttools + brotli)"""
import json, os, re, sys
from fontTools.ttLib import TTFont
from fontTools import subset
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
# Icons put into a .ms element from code. Keep in sync when adding one.
DYNAMIC = {
    'face',                                   # prefs-boot.js splash, progress-api.js name chip
    'play_arrow', 'pause',                    # lesson pause FAB (setPauseIcon)
    'arrow_forward', 'insights', 'home', 'replay',  # end-actions.js
    'mic', 'stop',                            # retell-recorder.js
    'star', 'star_half', 'star_border',       # progress/ star row
    'check_circle', 'play_circle', 'brightness_5',  # progress/ stop badges
    'pets', 'umbrella', 'ac_unit', 'water_drop',    # progress/ data-icon
}
SPAN = re.compile(r"""class=\\?["'][^"']*\bms\b[^"']*\\?["'][^>]*>\s*([a-z0-9_]+)\s*<""")
toks = set(DYNAMIC)
for dp, dn, fs in os.walk(ROOT):
    if '.git' in dp: continue
    for fn in fs:
        if fn.endswith(('.html', '.js')):
            s = open(os.path.join(dp, fn), encoding='utf-8', errors='ignore').read()
            toks |= set(SPAN.findall(s))
missing = sorted(t for t in toks if t not in names)
if missing: sys.exit('not icon names (typo?): ' + ', '.join(missing))
used = sorted(toks)
chars = 'abcdefghijklmnopqrstuvwxyz0123456789_'
glyphs = {names[t] for t in used} | {cmap[ord(c)] for c in chars if ord(c) in cmap}
# FILL>=0.99 swaps each icon for its filled twin through a FeatureVariations 'rclt'
# single substitution; keep those twins or filled icons render as outlines.
for lk in f['GSUB'].table.LookupList.Lookup:
    for st in lk.SubTable:
        if st.LookupType == 7: st = st.ExtSubTable
        for a, b in getattr(st, 'mapping', {}).items():
            if a in glyphs: glyphs.add(b)
opts = subset.Options(); opts.layout_closure = False; opts.layout_features = ['*']
opts.notdef_outline = True; opts.name_IDs = ['*']; opts.glyph_names = True
sub = subset.Subsetter(opts); sub.populate(glyphs=sorted(glyphs), unicodes=[ord(c) for c in chars]); sub.subset(f)
f.flavor = 'woff2'; f.save(OUT)
print(len(used), 'icons ->', OUT, os.path.getsize(OUT), 'bytes')
print(' '.join(used))
