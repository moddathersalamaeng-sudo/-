"""Summary of results/*.json and the PDCA runs."""
import os, json, glob, re
RES = os.path.join(os.path.dirname(__file__), "results")
groups = {}
for f in sorted(glob.glob(os.path.join(RES, "*.json"))):
    name = os.path.basename(f)[:-5]
    if name.startswith("text-diff"):
        continue
    d = json.load(open(f, encoding="utf-8"))
    g = re.sub(r"-\d+$", "", d["name"])
    a = groups.setdefault(g, {"checks": 0, "failed": 0, "fails": [], "extra": []})
    a["checks"] += d["checks"]; a["failed"] += d["failed"]
    a["fails"] += [r["label"] + " :: " + str(r["detail"])[:200] for r in d["rows"] if not r["ok"]]
    if "stats" in d: a["extra"].append(d["stats"])
tot = sum(a["checks"] for a in groups.values()); bad = sum(a["failed"] for a in groups.values())
for g, a in groups.items():
    ex = ""
    if a["extra"]:
        ex = f"  (tab views {sum(x['tabs'] for x in a['extra'])}, slowest switch {max(x['max_ms'] for x in a['extra'])} ms)"
    print(f"{g:14s} {a['checks'] - a['failed']:6d}/{a['checks']:<6d} passed{ex}")
    for x in a["fails"][:20]:
        print("   FAIL", x)
runs = []
for f in sorted(glob.glob(os.path.join(RES, "pdca-run*.log"))):
    m = re.search(r"(\d+)/(\d+) passed", open(f, encoding="utf-8").read())
    runs.append(m.group(0) if m else "no result")
if runs:
    print("pdca suite     " + " | ".join(runs))
print(f"TOTAL          {tot - bad}/{tot} passed")
