"""Guided tour in every tool, Arabic and English: the full tour runs to the end, visits every tab,
has no empty step title, raises no error and brings the page back to where it was.
Usage: python3 t_tour.py [shard_index shard_count]"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import BASE, Report, modules, launch, new_page, bad_words, sync_playwright

k_, n_ = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (0, 1)
MODS = [m for i, m in enumerate(modules()) if i % n_ == k_]
R = Report("tour" + (f"-{k_}" if n_ > 1 else ""))
CUR = """()=>{const v=[...document.querySelectorAll('.tabpane[data-tab]')].filter(e=>e.getClientRects().length&&getComputedStyle(e).display!=='none');
  return v.length?v[0].dataset.tab:''}"""

with sync_playwright() as p:
    b = launch(p)
    for m in MODS:
        for lang in ("ar", "en"):
            ctx, pg, errs = new_page(b, lang, 1280, 900, tour_done=[m])
            pg.goto(f"{BASE}/modules/{m}.html", wait_until="load"); pg.wait_for_timeout(500)
            tag = f"{m} {lang}"
            tabs = [t for t in pg.evaluate("[...document.querySelectorAll('#side button[data-t]')].map(b=>b.dataset.t)") if t != "home"]
            h0 = pg.evaluate("location.hash")
            R.check(f"{tag}: tour API present", pg.evaluate("!!(window.ciaTour&&ciaTour.start)"))
            pg.evaluate("ciaTour.start('full')"); pg.wait_for_timeout(250)
            seen, empty, steps, texts = set(), [], 0, []
            while pg.evaluate("ciaTour.state().active") and steps < 400:
                s = pg.evaluate("ciaTour.state()")
                if not s["title"].strip(): empty.append(s["i"])
                texts.append(pg.evaluate("(document.querySelector('.ciat-card')||{}).innerText||''"))
                cur = pg.evaluate(CUR)
                if cur: seen.add(cur)
                pg.evaluate("ciaTour.next()"); pg.wait_for_timeout(190); steps += 1
            R.check(f"{tag}: full tour finishes ({steps} steps)", 10 < steps < 400, steps)
            miss = [t for t in tabs if t not in seen]
            R.check(f"{tag}: tour visits all {len(tabs)} tabs", not miss, miss)
            R.check(f"{tag}: no empty step title", not empty, empty[:5])
            bw = [w for t in texts for w in bad_words(t)]
            R.check(f"{tag}: tour text has no undefined/NaN/[object Object]", not bw, bw[:3])
            pg.wait_for_timeout(400)
            R.check(f"{tag}: back where it started", pg.evaluate("location.hash") == h0, [h0, pg.evaluate("location.hash")])
            R.check(f"{tag}: no errors", not errs, errs[:3])
            ctx.close()
    b.close()
R.save({"modules": MODS})
