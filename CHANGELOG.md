# Changelog — CIA platform

## 1.0.0 — 2026-10-22 · Step 15 of 15: one connected platform
- **Organization profile** (`#profile`, key `cia-org:v1`): register once — names in Arabic and English, legal name, CR no., sector, size,
  country, city, sites, departments, people, report "prepared for / by", contacts, scope, certifications held and targeted, fiscal year,
  language, logo (resized in the browser to 512 px, ≤ 300 KB; SVG cleaned) and brand colour. Export/import JSON, import from the Executive
  Cockpit with a preview, clear. Header button and a first-visit prompt on the home page.
- **Every tool** carries the shared organization kit (`cia-org-js`): the organization's logo and name on the cover of every HTML/PDF report
  (unchanged when no profile exists), a "fill the empty fields" bar on organization forms, and suggestions for site, department and person fields.
- **Tool-to-tool links**: 177 read-only links (111 before). New panels in CAPA (start a CAPA from ISO checklist findings, self-assessment answers
  of 0–1, EFQM/KAQA areas for improvement), ISO 31000 Risk Studio (start a risk from SWOT/PESTLE/stakeholder outcomes, FMEA high rows, ISO
  NCRs), IMS Builder (the ISO toolkits' readiness; start the integrated gap), Smart Audit (ISO checklists as criteria), Strategy Studio
  (SWOT/PESTLE/stakeholder and EFQM/KAQA inputs), EFQM and KAQA (Strategy KPIs; PDCA/A3/DMAIC projects as evidence), PMO Excellence (lessons),
  Executive Cockpit (the 14 toolbox tools by the hub's adapters, the organization profile, the integrated report).
- **Integration map** (`#map`), **Follow-up register** (`#actions`) and the **integrated report** with its consolidated action plan (CSV) and
  report snapshots (`cia-org-reports:v1`).
- The hub overlay asks before replacing a tool with unsaved edits in its form.
- Author name "مدثر سلامه" in the English texts of 25 tools and the hub; share card, description and version stamp on every page; WCAG
  contrast of muted text (hub and tools) and valid tab roles in the toolbox tools' side menu.
- README, DEPLOY checklist and this changelog.

## 0.14.1 — 2026-10-22 · Guides centre
Hub `#guides`: 39 tools, 95 explanation links; `tests/build/links_inventory.py`.

## 0.14 — 2026-10-17 → 22 · Stakeholder Analysis (the 39th tool; the toolbox is complete)
## 0.13 — 2026-10-17 · PESTLE · 0.12 — SWOT
## 0.11 — 2026-10-16 · Lessons Learned · 0.10 — FMEA · 0.9 — ISO 10009:2024 guide · 0.8 — DMAIC · 0.7 — A3
## 0.6 — 2026-10-15 · RCA · 0.5 — Pareto
## 0.4 — 2026-10-11 · Fishbone · 0.3 — 5 Whys · 0.2 — CAPA, the shared toolbox engine, hub home v2 and the Tool Advisor
## 0.1 — 2026-10-10 · Platform audit and close-out of open gaps (PDCA linked, Explain Kits, "Assess this", knowledge-centre links)
Details of each step: `tests/build/README.md` and the project document `claude/platform-audit-2026-10-10.md`.
