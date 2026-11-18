#!/usr/bin/env python3
"""Phase 14 builder — accounts, administration and release (idempotent; keeps every approval).

Writes
  data/i18n/en.json, ar.json    the "p14" interface strings (same keys and placeholders in both languages)
  data/seed/navigation.json     the "admin" entry becomes active: account menu, administrators and reviewers, route /admin
                                (no new top-level item; tier stays "free")
  data/config.json              version 2.0.0-rc.1 and `backend: { apiBase: "", analytics: true }` — accounts stay OFF until
                                the owner configures an API address (tools/configure_backend.mjs)
  index.html                    Content-Security-Policy meta tag; the inline language script moves to src/boot-lang.js
Never touches published content, governance blocks or approval hashes. Run order: … build:phase13 → build:phase14 → build:phase10a.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools" / "phase14"))
import i18n_p14  # noqa: E402

VERSION = "2.0.0-rc.1"


def write_json(path, data, compact=False):
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":")) if compact else json.dumps(data, ensure_ascii=False, indent=2)
    path.write_text(text + ("" if compact else "\n"), encoding="utf-8")


def placeholders(s):
    return set(re.findall(r"\{(\w+)\}", s))


# ---------------------------------------------------------------- strings
for k, v in i18n_p14.flatten(i18n_p14.S):
    assert v["en"].strip() and v["ar"].strip(), ("empty string", k)
    assert placeholders(v["en"]) == placeholders(v["ar"]), ("placeholders differ", k)
    low = v["en"].lower()
    for bad in ("accredited by cia", "cia certifies", "pdu", "recognised cpd", "efqm assessment", "certified by cia"):
        assert bad not in low, ("claim wording", k, bad)

for lang in ("en", "ar"):
    p = ROOT / "data" / "i18n" / f"{lang}.json"
    raw = p.read_text(encoding="utf-8")
    d = json.loads(raw)
    d["p14"] = i18n_p14.tree(lang)
    compact = "\n" not in raw.strip()
    write_json(p, d, compact=compact)

# ---------------------------------------------------------------- navigation
nav_path = ROOT / "data" / "seed" / "navigation.json"
nav = json.loads(nav_path.read_text(encoding="utf-8"))
admin = next(e for e in nav["items"] if e["id"] == "admin")
admin.update({"status": "active", "placement": "user", "route": "/admin", "roles": ["reviewer", "admin"], "phase": 14})
write_json(nav_path, nav)

# ---------------------------------------------------------------- config
cfg_path = ROOT / "data" / "config.json"
cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
cfg["version"] = VERSION
backend = cfg.get("backend") or {}
cfg["backend"] = {"apiBase": backend.get("apiBase", ""), "analytics": backend.get("analytics", True)}
write_json(cfg_path, cfg, compact=True)

# ---------------------------------------------------------------- CSP and the language script
idx_path = ROOT / "index.html"
html = idx_path.read_text(encoding="utf-8")
inline = re.search(r"<script>\s*/\* Apply the platform-wide language.*?</script>\n", html, re.S)
boot = ROOT / "src" / "boot-lang.js"
if inline:
    body = inline.group(0)[len("<script>"):-len("</script>\n")]
    boot.write_text("/* Phase 14 (CSP): moved from an inline script in index.html — applies the platform-wide language before first paint. */" + body.rstrip() + "\n", encoding="utf-8")
    html = html.replace(inline.group(0), '<script src="./src/boot-lang.js"></script>\n')
api_origin = ""
m = re.match(r"^(https://[^/]+)", cfg["backend"]["apiBase"] or "")
if m:
    api_origin = " " + m.group(1)
# The optional coach model adapter (D-98, off unless the owner configures it) talks to its own https proxy.
coach = cfg.get("coach") or {}
mc = re.match(r"^(https://[^/]+)", str(coach.get("endpoint") or "")) if coach.get("enabled") is True else None
if mc and mc.group(1) not in api_origin:
    api_origin += " " + mc.group(1)
csp = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; "
       f"connect-src 'self'{api_origin}; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'self'; worker-src 'self'")
tag = f'<meta http-equiv="Content-Security-Policy" content="{csp}">'
if 'assets/css/admin.css' not in html:
    html = html.replace('<link rel="stylesheet" href="./assets/css/coach.css">\n', '<link rel="stylesheet" href="./assets/css/coach.css">\n<link rel="stylesheet" href="./assets/css/admin.css">\n', 1)
html = re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>\n?', "", html)
html = html.replace('<meta charset="UTF-8">\n', '<meta charset="UTF-8">\n' + tag + "\n", 1)
idx_path.write_text(html, encoding="utf-8")

print(f"Phase 14 build: {sum(1 for _ in i18n_p14.flatten(i18n_p14.S))} p14 strings × 2 languages; admin entry active (account menu); "
      f"config {VERSION} (backend off unless apiBase is set); CSP written{' with API ' + api_origin.strip() if api_origin else ''}.")
