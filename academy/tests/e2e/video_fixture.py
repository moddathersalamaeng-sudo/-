#!/usr/bin/env python3
"""Test set-up (Phase 18): the Academy shows the owner's videos from <platform>/cia-videos/ (the cia-videos repository,
same origin on GitHub Pages). Test runs have no copy of that repository, so lesson and course pages would request posters
that do not exist and log 404s. This creates a small stand-in folder (one 40-second sample video and poster for every
catalogued id) when the folder is missing; it never touches an existing folder. Usage: python3 tests/e2e/video_fixture.py [--remove]"""
import json, shutil, sys, pathlib
ACADEMY = pathlib.Path(__file__).resolve().parents[2]
VDIR = ACADEMY.parent / 'cia-videos'
MARK = VDIR / '.test-fixture'
if '--remove' in sys.argv:
    if MARK.exists(): shutil.rmtree(VDIR)
    sys.exit(0)
if VDIR.exists(): print(f'video folder present: {VDIR}'); sys.exit(0)
FX = ACADEMY / 'tests' / 'fixtures' / 'video'
for k in 'vpst': (VDIR / k).mkdir(parents=True, exist_ok=True)
for v in json.loads((ACADEMY / 'data' / 'seed' / 'videos.json').read_text(encoding='utf-8'))['items']:
    shutil.copy(FX / 'sample.mp4', VDIR / 'v' / f"{v['id']}.mp4"); shutil.copy(FX / 'sample.jpg', VDIR / 'p' / f"{v['id']}.jpg")
    if v['sheet']: (VDIR / 's' / f"{v['id']}.html").write_text(f"<!doctype html><title>{v['id']}</title><h1>Worksheet {v['id']}</h1>", encoding='utf-8')
    if v['transcript']: (VDIR / 't' / f"{v['id']}.txt").write_text(f"Transcript line one for {v['id']}\nLine two", encoding='utf-8')
MARK.write_text('stand-in created by tests/e2e/video_fixture.py\n')
print(f'video stand-in created: {VDIR}')
