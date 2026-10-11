"""Static checks: Explain Kit byte identity, tour layer identity, node syntax check of every inline script,
and the checksum list of changed files against the previous release folder (CIA_ORIG_DIR)."""
import os, re, sys, json, hashlib, subprocess, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from common import ROOT, RES, Report, modules

ORIG_DIR = os.environ.get("CIA_ORIG_DIR", "/home/claude/orig")
R = Report("static")


def block(s, tag, id_):
    i = s.find('<%s id="%s">' % (tag, id_))
    if i < 0:
        return None
    j = s.find('</%s>' % tag, i)
    return s[i:j + len(tag) + 3]


tpl = open(os.path.join(ROOT, "templates", "explain-kit-template.html"), encoding="utf-8").read()
T_CSS, T_JS = block(tpl, "style", "cia-explain-kit-css"), block(tpl, "script", "cia-explain-kit-js")
R.check("template has both kit blocks", T_CSS and T_JS)

kit_tools, no_kit = [], []
tour_variants = {}
for m in modules():
    s = open(os.path.join(ROOT, "modules", m + ".html"), encoding="utf-8").read()
    css, js = block(s, "style", "cia-explain-kit-css"), block(s, "script", "cia-explain-kit-js")
    if css is None and js is None:
        no_kit.append(m)
    else:
        kit_tools.append(m)
        R.check(f"{m}: kit CSS block byte-identical to template", css == T_CSS, "differs")
        R.check(f"{m}: kit JS block byte-identical to template", js == T_JS, "differs")
        R.check(f"{m}: each kit block appears once", s.count('id="cia-explain-kit-css"') == 1 and s.count('id="cia-explain-kit-js"') == 1)
    tj = block(s, "script", "cia-tour-js")
    tc = block(s, "style", "cia-tour-css")
    R.check(f"{m}: guided tour layer present", tj is not None and tc is not None)
    if tj:
        norm = re.sub(r'var CFG=\{.*?\};', 'var CFG={};', tj, count=1)
        h = hashlib.sha1((norm + (tc or "")).encode()).hexdigest()[:10]
        tour_variants.setdefault(h, []).append(m)
R.check("every module carries the Explain Kit", not no_kit, no_kit)
same = [v for v in tour_variants.values() if "pdca" in v][0]
R.check("PDCA tour layer identical to the ISO 9001 one apart from its CFG line", "iso9001" in same, tour_variants)
# other tools keep the tour variant they were released with (information only)

# ---- node --check of every inline script
SCRIPT = re.compile(r'<script(?![^>]*\bsrc=)([^>]*)>(.*?)</script>', re.S | re.I)
files = ["index.html"] + ["modules/" + m + ".html" for m in modules()] + \
        ["templates/" + f for f in sorted(os.listdir(os.path.join(ROOT, "templates"))) if f.endswith(".html")]
n_scripts = 0
tmpd = tempfile.mkdtemp()
for f in files:
    s = open(os.path.join(ROOT, f), encoding="utf-8").read()
    bad = []
    for k, m in enumerate(SCRIPT.finditer(s)):
        attrs, body = m.group(1), m.group(2)
        ty = re.search(r'type\s*=\s*"([^"]+)"', attrs)
        if ty and ty.group(1).lower() not in ("text/javascript", "module", "application/javascript"):
            continue
        if not body.strip():
            continue
        n_scripts += 1
        p = os.path.join(tmpd, "s%d.%s" % (k, "mjs" if ty and ty.group(1) == "module" else "js"))
        open(p, "w", encoding="utf-8").write(body)
        r = subprocess.run(["node", "--check", p], capture_output=True, text=True)
        if r.returncode != 0:
            bad.append((k, attrs.strip()[:60], r.stderr.strip().splitlines()[-1][:200] if r.stderr.strip() else "?"))
    R.check(f"{f}: every inline script passes node --check", not bad, bad)

# ---- changed files against the previous release (checksums)
def tree(d):
    out = {}
    for base, _, fs in os.walk(d):
        for x in fs:
            p = os.path.join(base, x)
            rel = os.path.relpath(p, d)
            if rel.startswith("tests/platform/results") or "__pycache__" in rel:
                continue
            out[rel] = hashlib.sha256(open(p, "rb").read()).hexdigest()
    return out

changes = {}
if os.path.isdir(ORIG_DIR):
    a, b = tree(ORIG_DIR), tree(ROOT)
    changes = {"changed": sorted(k for k in a if k in b and a[k] != b[k]),
               "added": sorted(k for k in b if k not in a),
               "removed": sorted(k for k in a if k not in b),
               "unchanged": len([k for k in a if k in b and a[k] == b[k]]),
               "sha256": {k: b[k] for k in sorted(b) if k not in a or a[k] != b[k]}}
    R.check("no file removed from the previous release", not changes["removed"], changes["removed"])
    print("changed:", len(changes["changed"]), "added:", len(changes["added"]), "unchanged:", changes["unchanged"])

R.save({"kit_tools": kit_tools, "no_kit": no_kit, "inline_scripts_checked": n_scripts, "changes": changes,
        "tour_variants": {k: len(v) for k, v in tour_variants.items()}})
