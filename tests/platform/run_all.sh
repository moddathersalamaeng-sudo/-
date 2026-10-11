#!/usr/bin/env bash
# CIA platform test suite (2026-10-10). Run from the platform folder:
#   python3 -m http.server 8802 --directory .            # this package
#   python3 -m http.server 8801 --directory <previous>   # previous release, for the regression test
#   CIA_ORIG_DIR=<previous> bash tests/platform/run_all.sh
# Results: tests/platform/results/*.json (one file per test, every check listed) and summary.txt.
set -u
cd "$(dirname "$0")"
J=${CIA_JOBS:-2}   # parallel shards for the long sweeps
run_sharded () { local t=$1; for ((i=0;i<J;i++)); do python3 "$t" $i $J > "results/${t%.py}-$i.log" 2>&1 & done; wait; }
mkdir -p results
python3 t_static.py      | tee results/static.log
run_sharded t_sweep.py
run_sharded t_kit.py
run_sharded t_tour.py
python3 t_hub.py         > results/hub.log 2>&1
python3 t_example.py     > results/example.log 2>&1
run_sharded t_regress.py
python3 t_regress.py hub > results/regress-hub.log 2>&1
for r in 1 2 3; do python3 ../pdca/test_pdca.py > "results/pdca-run$r.log" 2>&1; done
python3 summary.py | tee results/summary.txt
