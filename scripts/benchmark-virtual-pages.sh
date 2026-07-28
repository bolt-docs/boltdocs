#!/bin/bash
set -e
cd /home/jesusalcala/Projects/boltdocs/docs
rm -rf .boltdocs dist
pkill -9 -f 'render-worker' 2>/dev/null || true
pkill -9 -f 'boltdocs build' 2>/dev/null || true
sleep 2
start=$(date +%s)
CI=true timeout 300 pnpm exec boltdocs build > build-output.log 2>&1
status=$?
end=$(date +%s)
echo "EXIT: $status" >> build-output.log
echo "TOTAL: $((end - start))s" >> build-output.log
