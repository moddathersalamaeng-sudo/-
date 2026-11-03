#!/usr/bin/env python3
"""Regenerate data/seed/platform-modules.json from the live hub (../index.html).

The hub's SYSTEMS + URLS constants are the single source of truth for the
existing toolkits (39 in Nov 2026). The hub's cloud-config.js decides which tools open
without an account (gate + free list); each module records that as `access`. The Academy never hand-edits that list: run this script after
the hub changes so the Academy's links cannot drift (risk R-17).
Usage: python3 tools/sync_platform_modules.py [path/to/hub/index.html]
"""
import json, re, sys, datetime, pathlib

here = pathlib.Path(__file__).resolve().parent.parent
hub = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else here.parent / 'index.html'
src = hub.read_text(encoding='utf-8')

urls = dict(re.findall(r'^\s*(\w+):\s*"(\./modules/[\w.-]+\.html)"', src[src.index('const URLS'):src.index('};', src.index('const URLS'))], re.M))
sys_block = src[src.index('const SYSTEMS'):src.index('\n];', src.index('const SYSTEMS'))]
systems = [(m.start(), m.group(1)) for m in re.finditer(r'\{\s*id:"(\w+)"', sys_block)]
sys_names = {m.group(1): {'en': m.group(2), 'ar': m.group(3)} for m in re.finditer(r'\{\s*id:"(\w+)"[^\n]*\n\s*name:\{en:"([^"]+)",\s*ar:"([^"]+)"\}', sys_block)}
mod_re = re.compile(r'\{k:"(\w+)",\s*status:"(\w+)",\s*name:\{en:"([^"]+)",\s*ar:"([^"]+)"\},\s*note:\{en:"([^"]+)",\s*ar:"([^"]+)"\}\}')

def system_at(pos):
    cur = None
    for p, sid in systems:
        if p <= pos: cur = sid
    return cur

today = datetime.date.today().isoformat()

# Which tools open without an account: cloud-config.js → gate:true + free:[…] (a missing file or gate:false → all open).
cfg_path = hub.parent / 'cloud-config.js'
cfg = cfg_path.read_text(encoding='utf-8') if cfg_path.exists() else ''
gate = bool(re.search(r'\bgate\s*:\s*true', cfg)) and bool(re.search(r'\burl\s*:\s*"https?://', cfg))
free_m = re.search(r'\bfree\s*:\s*\[([^\]]*)\]', cfg)
free = re.findall(r'"(\w+)"', free_m.group(1)) if free_m else ['iso9001']
access_of = lambda k: 'open' if (not gate or k in free) else 'account'
items, seen = [], set()
for m in mod_re.finditer(sys_block):
    k, status, en, ar, nen, nar = m.groups()
    if k in seen or k not in urls: continue
    seen.add(k)
    items.append({
        'id': k, 'system': system_at(m.start()), 'status': status,
        'href': '../#m=' + k, 'file': urls[k].replace('./', '../'),
        'name': {'en': en, 'ar': ar}, 'note': {'en': nen, 'ar': nar}, 'access': access_of(k),
        'governance': {'content_status': 'published', 'content_source': 'owner', 'version': 'hub-sync',
                       'reviewer': 'Owner publication (live hub)', 'review_date': today,
                       'note': 'Mirrors the toolkit list the owner published on the live hub; no Academy review implied. Edition labels pending external verification (V-01).'}
    })
missing = sorted(set(urls) - seen)
out = {'source': 'hub index.html — SYSTEMS + URLS; access from cloud-config.js', 'syncedAt': today, 'accountGate': gate, 'freeTools': free, 'systems': sys_names, 'items': items}
(here / 'data/seed/platform-modules.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'{len(items)} modules synced; URLS without SYSTEMS entry: {missing or "none"}')
