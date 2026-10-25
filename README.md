# Continual Improvement Academy — CIA platform

**أكاديمية التحسين المستمر — منصة واحدة متصلة حول منشأة واحدة**
Prepared by مدثر سلامه · version 1.0.0 (2026-10-22)

A bilingual (Arabic default, English) static web platform of 39 interactive tools for ISO management systems, governance, risk and
compliance, PMO, organizational excellence, strategy and performance, audit and continual improvement. Every tool runs in the browser
with no server; the hub (`index.html`) connects them around one organization profile.

## What the platform does
- **39 tools in seven systems** — ISO toolkits (9001, 14001, 45001, 27001, 27701, 22301, 37301, 37001, 42001, 42005, IMS Builder),
  GRC (ISO 31000 Risk Studio, ISO 37000 governance, compliance & anti-bribery centre, AI regulatory readiness), PMO (P3M3, ISO 21500,
  P3O, PMO Excellence), excellence (EFQM 2025, King Abdulaziz Quality Award), strategy & performance (Strategy Studio), audit &
  improvement (Smart Audit, Operations Excellence and the 14-tool continual-improvement toolbox: PDCA, CAPA, 5 Whys, Fishbone, Pareto,
  RCA, A3, DMAIC, ISO 10009 guide, FMEA, Lessons Learned, SWOT, PESTLE, Stakeholder Analysis), and the Executive Cockpit.
- **Organization profile** (`#profile`) — register the organization once (name, logo, sites, departments, people, scope,
  certifications). Every tool shows it on the cover of its HTML/PDF reports, offers to fill its empty organization fields from it, and
  suggests the sites, departments and people.
- **Integration map** (`#map`) — how the tools complete each other, drawn from the links found in the code (`tests/build/links.json`).
- **Follow-up** (`#actions`) — every open finding, gap, nonconformity, risk treatment and action from every tool, read-only, each row
  opening its record in its tool.
- **Integrated report** — one A4 report from every tool that holds data (cover, executive summary, map, status, action plans,
  consolidated roadmap, verification and closure, re-assessment plan, appendix) plus the consolidated action plan as CSV.
- **Dashboard, Tool Advisor, Guides centre, Knowledge centre** and a request form for consultation and training.

Data stays in the user's browser (`localStorage`); a tool reads another tool's data but never writes it.

## Folder structure
```
index.html                 the hub (home, advisor, dashboard, tools, guides, map, follow-up, profile, systems, knowledge, FAQ, request, about)
modules/*.html             the 39 tools, each one self-contained (works on its own and inside the hub's overlay)
assets/                    share images, icons, screenshots (shots/), labels of the ISO toolkits (cia-labels.json)
templates/                 shared blocks carried byte-identical by the tools: explain-kit-template.html, org-profile-kit.html
tests/build/               the scripts that built every file of this package (see tests/build/README.md)
tests/platform/            the platform test suite (static, sweep, kit, tour, hub, example, regression, organization profile, links)
tests/hub/                 hub suites (home and Advisor, guides, profile, map, follow-up, integrated report, overlay)
tests/<tool>/              each toolbox tool's own suite
CHANGELOG.md · DEPLOY.md   release history · GitHub Pages deployment checklist
```

## Storage keys (one per tool, plus the shared ones)
Tools: see the registry `TOOLS` in `index.html` (e.g. `iso9001tk:v1`, `cia-capa:v1`, `strategy-studio:v1`).
Shared: `cia-org:v1` (organization profile, written only by the hub), `cia-org-reports:v1` (numbers of each integrated report),
`cia-hub-dash:v1` (dashboard selection and snapshots), `cia-advisor:v1`, `cia-lang`, `cia-tour:*`, `cia-nav:<file>` (one-time
navigation hints, sessionStorage). The schema of `cia-org:v1` is documented at the top of the `cia-org-js` block.

## Run the tests
```
python3 -m http.server 8802 --directory .                 # this package
python3 -m http.server 8801 --directory <previous release>  # for the regression tests
CIA_ORIG_DIR=<previous release> CIA_JOBS=4 bash tests/platform/run_all.sh
```
Needs Python 3 with Playwright and Chromium (`/opt/pw-browsers`), Node.js (syntax check) and Pillow (hub profile suite).
Results: `tests/platform/results/*.json` and `summary.txt`.

## Rebuild
`bash tests/build/build_step15.sh` reproduces every module and `index.html` of this release byte for byte from the step-14.1 package
(earlier steps: `tests/build/README.md`).

## Deploy
Static hosting (GitHub Pages): see `DEPLOY.md`.

## Notes
Explanations are interpretive summaries, not the official text of the standards; examples are illustrative. Clause numbers come only
from the official texts uploaded to the project (ISO 9001:2026, ISO 9000:2026, ISO 19011:2026, ISO 10009:2024, EFQM Model 2025, P3M3).
© 2026 مدثر سلامه — Continual Improvement Academy.
