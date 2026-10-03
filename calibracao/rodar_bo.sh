#!/bin/sh
cd "$(dirname "$0")"
for s in 1 2 3; do [ -f bo_aprende_$s.json ] || node bo.js aprende $s bo_aprende_$s.json; done
for s in 1 2 3; do [ -f rs_aprende_$s.json ] || node bo.js aprende $s rs_aprende_$s.json aleatoria; done
echo FIM
